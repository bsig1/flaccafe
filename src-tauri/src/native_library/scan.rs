use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::{json, Value as JsonValue};
use std::collections::{hash_map::DefaultHasher, HashMap, HashSet};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::storage::{open_database, set_setting};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    ".flac", ".mp3", ".m4a", ".ogg", ".opus", ".wav", ".aiff", ".aif",
];
const METADATA_BATCH_SIZE: usize = 100;

static SCAN_JOBS: OnceLock<Mutex<HashMap<String, NativeScanJob>>> = OnceLock::new();

#[derive(Clone)]
struct ScanRequest {
    paths: Vec<PathBuf>,
    save_paths: Vec<PathBuf>,
    native_files: Option<Vec<AudioSnapshot>>,
    native_errors: Vec<String>,
}

#[derive(Clone)]
struct AudioSnapshot {
    path: PathBuf,
    path_text: String,
    path_key: String,
    modified_at: Option<String>,
    modified_ms: Option<i64>,
    size_bytes: Option<i64>,
}

struct FolderPlan {
    folder: PathBuf,
    files: Vec<AudioSnapshot>,
    files_to_read: Vec<AudioSnapshot>,
    current_path_keys: HashSet<String>,
}

#[derive(Clone)]
struct NativeScanJob {
    job_id: String,
    folder_path: String,
    folder_paths: Vec<String>,
    status: String,
    total_files: usize,
    processed_files: usize,
    inserted: usize,
    updated: usize,
    removed: usize,
    skipped: usize,
    errors: Vec<String>,
    current_path: Option<String>,
    started_at: String,
    finished_at: Option<String>,
    error: Option<String>,
    started_instant: Instant,
    cancel_requested: bool,
}

#[derive(Serialize)]
pub(crate) struct NativeScanStartResponse {
    job_id: String,
    folder_path: String,
    folder_paths: Vec<String>,
    status: String,
}

#[derive(Serialize)]
pub(crate) struct NativeScanResult {
    folder_path: String,
    folder_paths: Vec<String>,
    scanned_files: usize,
    inserted: usize,
    updated: usize,
    removed: usize,
    skipped: usize,
    errors: Vec<String>,
}

#[derive(Serialize)]
pub(crate) struct NativeScanProgress {
    job_id: String,
    folder_path: String,
    folder_paths: Vec<String>,
    status: String,
    total_files: usize,
    processed_files: usize,
    inserted: usize,
    updated: usize,
    removed: usize,
    skipped: usize,
    errors: Vec<String>,
    current_path: Option<String>,
    started_at: String,
    finished_at: Option<String>,
    elapsed_seconds: f64,
    eta_seconds: Option<f64>,
    percent: f64,
    error: Option<String>,
}

pub(crate) fn native_scan_library(body: JsonValue) -> Result<NativeScanResult, String> {
    let request = ScanRequest::from_body(&body)?;
    let mut job = NativeScanJob::new("sync".to_string(), &request);
    let result = run_scan(request, Some(&mut job), None)?;
    Ok(result)
}

pub(crate) fn native_start_scan_library(
    body: JsonValue,
) -> Result<NativeScanStartResponse, String> {
    let request = ScanRequest::from_body(&body)?;
    let job_id = new_job_id();
    let job = NativeScanJob::new(job_id.clone(), &request);
    let response = NativeScanStartResponse {
        job_id: job_id.clone(),
        folder_path: job.folder_path.clone(),
        folder_paths: job.folder_paths.clone(),
        status: job.status.clone(),
    };
    jobs()
        .lock()
        .map_err(|_| "Scan job registry is unavailable".to_string())?
        .insert(job_id.clone(), job);

    thread::spawn(move || run_scan_thread(job_id, request));
    Ok(response)
}

pub(crate) fn native_scan_progress(job_id: String) -> Result<NativeScanProgress, String> {
    let jobs = jobs()
        .lock()
        .map_err(|_| "Scan job registry is unavailable".to_string())?;
    let job = jobs
        .get(&job_id)
        .ok_or_else(|| "Scan job not found".to_string())?;
    Ok(job.snapshot())
}

pub(crate) fn native_cancel_scan(job_id: String) -> Result<NativeScanProgress, String> {
    {
        let mut jobs = jobs()
            .lock()
            .map_err(|_| "Scan job registry is unavailable".to_string())?;
        let job = jobs
            .get_mut(&job_id)
            .ok_or_else(|| "Scan job not found".to_string())?;
        job.cancel_requested = true;
        if !matches!(job.status.as_str(), "completed" | "failed" | "cancelled") {
            job.status = "cancelling".to_string();
        }
    }
    native_scan_progress(job_id)
}

fn run_scan_thread(job_id: String, request: ScanRequest) {
    let mut local_job = {
        let jobs = match jobs().lock() {
            Ok(jobs) => jobs,
            Err(_) => return,
        };
        match jobs.get(&job_id).cloned() {
            Some(job) => job,
            None => return,
        }
    };

    let outcome = run_scan(request, Some(&mut local_job), Some(&job_id));
    let mut jobs = match jobs().lock() {
        Ok(jobs) => jobs,
        Err(_) => return,
    };
    if let Some(job) = jobs.get_mut(&job_id) {
        match outcome {
            Ok(result) => {
                job.status = "completed".to_string();
                job.total_files = result.scanned_files;
                job.processed_files = result.scanned_files;
                job.inserted = result.inserted;
                job.updated = result.updated;
                job.removed = result.removed;
                job.skipped = result.skipped;
                job.errors = result.errors;
                job.current_path = None;
                job.finished_at = Some(utc_now());
                job.error = None;
            }
            Err(error) if error == "cancelled" => {
                job.status = "cancelled".to_string();
                job.current_path = None;
                job.finished_at = Some(utc_now());
                job.error = Some("Scan cancelled".to_string());
            }
            Err(error) => {
                job.status = "failed".to_string();
                job.current_path = None;
                job.finished_at = Some(utc_now());
                job.error = Some(error);
            }
        }
    }
}

fn run_scan(
    request: ScanRequest,
    mut local_job: Option<&mut NativeScanJob>,
    registry_job_id: Option<&str>,
) -> Result<NativeScanResult, String> {
    let mut stats = NativeScanResult {
        folder_path: request
            .paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join("; "),
        folder_paths: request
            .paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        scanned_files: 0,
        inserted: 0,
        updated: 0,
        removed: 0,
        skipped: 0,
        errors: request.native_errors.clone(),
    };

    update_job(local_job.as_deref_mut(), registry_job_id, |job| {
        job.status = "counting".to_string();
        job.errors = stats.errors.clone();
    })?;

    let plans = build_scan_plans(&request)?;
    let total_files = plans.iter().map(|plan| plan.files.len()).sum::<usize>();
    let unchanged_files = plans
        .iter()
        .map(|plan| plan.files.len().saturating_sub(plan.files_to_read.len()))
        .sum::<usize>();
    stats.scanned_files = total_files;

    update_job(local_job.as_deref_mut(), registry_job_id, |job| {
        job.status = "scanning".to_string();
        job.total_files = total_files;
        job.processed_files = unchanged_files;
    })?;

    let mut processed = unchanged_files;
    for plan in &plans {
        for chunk in plan.files_to_read.chunks(METADATA_BATCH_SIZE) {
            check_cancelled(registry_job_id)?;
            if let Some(first) = chunk.first() {
                update_job(local_job.as_deref_mut(), registry_job_id, |job| {
                    job.current_path = Some(first.path_text.clone());
                })?;
            }
            let response = read_metadata_batch(chunk)?;
            apply_metadata_results(
                &mut stats,
                &plan.folder,
                &response,
                chunk,
                &mut processed,
                local_job.as_deref_mut(),
                registry_job_id,
            )?;
        }
    }

    update_job(local_job.as_deref_mut(), registry_job_id, |job| {
        job.status = "cleaning".to_string();
        job.current_path = None;
    })?;
    let connection = open_database()?;
    for plan in &plans {
        check_cancelled(registry_job_id)?;
        stats.removed += remove_missing_tracks(&connection, &plan.folder, &plan.current_path_keys)?;
    }
    cleanup_orphan_albums(&connection)?;
    save_library_paths(&connection, &request.save_paths)?;
    if stats.inserted > 0 || stats.updated > 0 || stats.removed > 0 {
        clear_library_query_cache(&connection);
    }
    update_job(local_job.as_deref_mut(), registry_job_id, |job| {
        job.status = "completed".to_string();
        job.processed_files = total_files;
        job.current_path = None;
        job.finished_at = Some(utc_now());
    })?;
    Ok(stats)
}

fn build_scan_plans(request: &ScanRequest) -> Result<Vec<FolderPlan>, String> {
    let mut plans = Vec::new();
    let native_files = request.native_files.clone();
    let existing_states = load_existing_track_states()?;
    for folder in &request.paths {
        if !folder.exists() || !folder.is_dir() {
            return Err(format!("Folder does not exist: {}", folder.display()));
        }
        let files = if let Some(native_files) = &native_files {
            native_files
                .iter()
                .filter(|snapshot| path_is_under_folder(&snapshot.path, folder))
                .cloned()
                .collect::<Vec<_>>()
        } else {
            discover_audio_files(folder)?
        };
        let current_path_keys = files
            .iter()
            .map(|snapshot| snapshot.path_key.clone())
            .collect::<HashSet<_>>();
        let files_to_read = files
            .iter()
            .filter(|snapshot| metadata_needs_read(snapshot, &existing_states))
            .cloned()
            .collect::<Vec<_>>();
        plans.push(FolderPlan {
            folder: folder.clone(),
            files,
            files_to_read,
            current_path_keys,
        });
    }
    Ok(plans)
}

fn discover_audio_files(folder: &Path) -> Result<Vec<AudioSnapshot>, String> {
    let mut files = Vec::new();
    let mut stack = vec![folder.to_path_buf()];
    while let Some(current) = stack.pop() {
        let entries = match fs::read_dir(&current) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };
            if file_type.is_dir() {
                stack.push(path);
            } else if file_type.is_file() && is_supported_audio_path(&path) {
                match AudioSnapshot::from_path(path) {
                    Ok(snapshot) => files.push(snapshot),
                    Err(_) => continue,
                }
            }
        }
    }
    files.sort_by(|left, right| left.path_key.cmp(&right.path_key));
    Ok(files)
}

fn read_metadata_batch(files: &[AudioSnapshot]) -> Result<Vec<JsonValue>, String> {
    let payload_files = files
        .iter()
        .map(|snapshot| {
            json!({
                "path": snapshot.path_text,
                "modified_ms": snapshot.modified_ms,
                "size_bytes": snapshot.size_bytes,
            })
        })
        .collect::<Vec<_>>();
    let response = crate::python_worker::call_python_action_json(
        "read_scan_metadata_batch",
        json!({}),
        Some(json!({ "files": payload_files })),
    )?;
    Ok(response
        .get("results")
        .and_then(JsonValue::as_array)
        .cloned()
        .unwrap_or_default())
}

fn apply_metadata_results(
    stats: &mut NativeScanResult,
    folder: &Path,
    results: &[JsonValue],
    requested_files: &[AudioSnapshot],
    processed: &mut usize,
    mut local_job: Option<&mut NativeScanJob>,
    registry_job_id: Option<&str>,
) -> Result<(), String> {
    let connection = open_database()?;
    let mut requested_by_path = requested_files
        .iter()
        .map(|snapshot| (snapshot.path_text.to_ascii_lowercase(), snapshot))
        .collect::<HashMap<_, _>>();
    for result in results {
        let path_text = result
            .get("path")
            .and_then(JsonValue::as_str)
            .unwrap_or_default()
            .to_string();
        let snapshot = requested_by_path
            .remove(&path_text.to_ascii_lowercase())
            .or_else(|| {
                if requested_files.is_empty() {
                    None
                } else {
                    requested_files.get(*processed % requested_files.len())
                }
            });
        if let Some(error) = result.get("error").and_then(JsonValue::as_str) {
            stats.skipped += 1;
            let label = snapshot
                .map(|snapshot| snapshot.path_text.clone())
                .unwrap_or_else(|| path_text.clone());
            let message = format!("{label}: {error}");
            stats.errors.push(message.clone());
            record_scan_error(
                &connection,
                folder,
                snapshot.map(|item| item.path.as_path()),
                &message,
            );
        } else if let Some(metadata) = result.get("metadata").and_then(JsonValue::as_object) {
            match upsert_track(&connection, metadata) {
                Ok("inserted") => stats.inserted += 1,
                Ok(_) => stats.updated += 1,
                Err(error) => {
                    stats.skipped += 1;
                    let label = snapshot
                        .map(|snapshot| snapshot.path_text.clone())
                        .unwrap_or_else(|| path_text.clone());
                    let message = format!("{label}: {error}");
                    stats.errors.push(message.clone());
                    record_scan_error(
                        &connection,
                        folder,
                        snapshot.map(|item| item.path.as_path()),
                        &message,
                    );
                }
            }
        }
        *processed += 1;
        update_job(local_job.as_deref_mut(), registry_job_id, |job| {
            job.processed_files = *processed;
            job.inserted = stats.inserted;
            job.updated = stats.updated;
            job.skipped = stats.skipped;
            job.errors = stats.errors.clone();
        })?;
    }
    clear_library_query_cache(&connection);
    Ok(())
}

fn upsert_track(
    connection: &Connection,
    metadata: &serde_json::Map<String, JsonValue>,
) -> Result<&'static str, String> {
    let path = required_text(metadata, "path")?;
    let path_key = required_text(metadata, "path_key")?;
    let album_id = ensure_album(connection, metadata)?;
    let now = utc_now();
    let existing = connection
        .query_row(
            "SELECT id, rating FROM tracks WHERE path_key = ?",
            params![path_key],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<f64>>(1)?)),
        )
        .ok();
    if let Some((_, existing_rating)) = existing {
        let rating = existing_rating.or_else(|| json_f64(metadata, "rating"));
        connection
            .execute(
                "
                UPDATE tracks
                SET path = ?,
                    title = ?,
                    artist = ?,
                    album = ?,
                    album_artist = ?,
                    album_id = ?,
                    track_number = ?,
                    disc_number = ?,
                    genre = ?,
                    year = ?,
                    duration_seconds = ?,
                    bitrate = ?,
                    replaygain_track_gain_db = ?,
                    replaygain_album_gain_db = ?,
                    replaygain_track_peak = ?,
                    replaygain_album_peak = ?,
                    audio_fingerprint = ?,
                    rating = ?,
                    file_modified_at = ?,
                    updated_at = ?
                WHERE path_key = ?
                ",
                params![
                    path,
                    json_string(metadata, "title"),
                    json_string(metadata, "artist"),
                    json_string(metadata, "album"),
                    json_string(metadata, "album_artist"),
                    album_id,
                    json_i64(metadata, "track_number"),
                    json_i64(metadata, "disc_number"),
                    json_string(metadata, "genre"),
                    json_i64(metadata, "year"),
                    json_f64(metadata, "duration_seconds"),
                    json_i64(metadata, "bitrate"),
                    json_f64(metadata, "replaygain_track_gain_db"),
                    json_f64(metadata, "replaygain_album_gain_db"),
                    json_f64(metadata, "replaygain_track_peak"),
                    json_f64(metadata, "replaygain_album_peak"),
                    json_string(metadata, "audio_fingerprint"),
                    rating,
                    json_string(metadata, "file_modified_at"),
                    now,
                    path_key,
                ],
            )
            .map_err(|error| format!("Could not update track metadata: {error}"))?;
        Ok("updated")
    } else {
        connection
            .execute(
                "
                INSERT INTO tracks(
                  path, path_key, title, artist, album, album_artist, album_id,
                  track_number, disc_number, genre, year, duration_seconds, rating,
                  bitrate, replaygain_track_gain_db, replaygain_album_gain_db,
                  replaygain_track_peak, replaygain_album_peak, audio_fingerprint,
                  file_modified_at, date_added, updated_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ",
                params![
                    path,
                    path_key,
                    json_string(metadata, "title"),
                    json_string(metadata, "artist"),
                    json_string(metadata, "album"),
                    json_string(metadata, "album_artist"),
                    album_id,
                    json_i64(metadata, "track_number"),
                    json_i64(metadata, "disc_number"),
                    json_string(metadata, "genre"),
                    json_i64(metadata, "year"),
                    json_f64(metadata, "duration_seconds"),
                    json_f64(metadata, "rating"),
                    json_i64(metadata, "bitrate"),
                    json_f64(metadata, "replaygain_track_gain_db"),
                    json_f64(metadata, "replaygain_album_gain_db"),
                    json_f64(metadata, "replaygain_track_peak"),
                    json_f64(metadata, "replaygain_album_peak"),
                    json_string(metadata, "audio_fingerprint"),
                    json_string(metadata, "file_modified_at"),
                    now,
                    now,
                ],
            )
            .map_err(|error| format!("Could not insert track metadata: {error}"))?;
        mark_track_for_inbox(connection, connection.last_insert_rowid(), &now)?;
        Ok("inserted")
    }
}

fn ensure_album(
    connection: &Connection,
    metadata: &serde_json::Map<String, JsonValue>,
) -> Result<Option<i64>, String> {
    let album = json_string(metadata, "album").filter(|value| !value.trim().is_empty());
    let Some(album) = album else {
        return Ok(None);
    };
    let album_artist =
        json_string(metadata, "album_artist").or_else(|| json_string(metadata, "artist"));
    let year = json_i64(metadata, "year");
    connection
        .execute(
            "INSERT OR IGNORE INTO albums(album, album_artist, year) VALUES(?, ?, ?)",
            params![album, album_artist, year],
        )
        .map_err(|error| format!("Could not create album row: {error}"))?;
    let album_id = connection
        .query_row(
            "SELECT id FROM albums WHERE album IS ? AND album_artist IS ? AND year IS ?",
            params![album, album_artist, year],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not look up album row: {error}"))?;
    Ok(Some(album_id))
}

fn mark_track_for_inbox(connection: &Connection, track_id: i64, now: &str) -> Result<(), String> {
    connection
        .execute(
            "
            INSERT OR REPLACE INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
            VALUES(?, 'new', NULL, ?)
            ",
            params![track_id, now],
        )
        .map_err(|error| format!("Could not mark new track for Inbox review: {error}"))?;
    Ok(())
}

fn remove_missing_tracks(
    connection: &Connection,
    folder: &Path,
    current_path_keys: &HashSet<String>,
) -> Result<usize, String> {
    let mut statement = connection
        .prepare("SELECT id, path, path_key FROM tracks")
        .map_err(|error| format!("Could not inspect existing tracks: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| format!("Could not query existing tracks: {error}"))?;
    let mut missing_ids = Vec::new();
    for row in rows {
        let (track_id, path, path_key) =
            row.map_err(|error| format!("Could not read existing track row: {error}"))?;
        if path_is_under_folder(Path::new(&path), folder) && !current_path_keys.contains(&path_key)
        {
            missing_ids.push(track_id);
        }
    }
    for track_id in &missing_ids {
        connection
            .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
            .map_err(|error| format!("Could not remove missing track {track_id}: {error}"))?;
    }
    if !missing_ids.is_empty() {
        clear_library_query_cache(connection);
    }
    Ok(missing_ids.len())
}

fn cleanup_orphan_albums(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "
            DELETE FROM albums
            WHERE id NOT IN (
                SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL
            )
            ",
            [],
        )
        .map_err(|error| format!("Could not clean orphan albums: {error}"))?;
    Ok(())
}

fn save_library_paths(connection: &Connection, save_paths: &[PathBuf]) -> Result<(), String> {
    let paths = save_paths
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .filter(|path| !path.trim().is_empty())
        .collect::<Vec<_>>();
    set_setting(
        connection,
        "library_path",
        paths.first().map(String::as_str),
    )?;
    let paths_json = serde_json::to_string(&paths).unwrap_or_else(|_| "[]".to_string());
    set_setting(connection, "library_paths_json", Some(&paths_json))?;
    Ok(())
}

fn load_existing_track_states() -> Result<HashMap<String, Option<String>>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare("SELECT path_key, file_modified_at FROM tracks")
        .map_err(|error| format!("Could not prepare scan diff query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(|error| format!("Could not query scan diff state: {error}"))?;
    let mut states = HashMap::new();
    for row in rows {
        let (path_key, modified_at) =
            row.map_err(|error| format!("Could not read scan diff state: {error}"))?;
        states.insert(path_key, modified_at);
    }
    Ok(states)
}

fn metadata_needs_read(
    snapshot: &AudioSnapshot,
    existing_states: &HashMap<String, Option<String>>,
) -> bool {
    match existing_states.get(&snapshot.path_key) {
        None => true,
        Some(Some(existing_modified)) => snapshot
            .modified_at
            .as_deref()
            .map(|modified_at| modified_at != existing_modified)
            .unwrap_or(true),
        Some(None) => true,
    }
}

fn record_scan_error(connection: &Connection, folder: &Path, path: Option<&Path>, message: &str) {
    let path_text = path
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = path
        .and_then(Path::extension)
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value.to_ascii_lowercase()))
        .unwrap_or_default();
    let _ = connection.execute(
        "
        INSERT INTO scan_error_samples(path_hash, folder_hash, extension, message)
        VALUES(?, ?, ?, ?)
        ",
        params![
            anonymized_hash(&path_key_text(&path_text)),
            anonymized_hash(&path_key(folder)),
            extension,
            truncate_chars(message, 500),
        ],
    );
    let _ = connection.execute(
        "
        DELETE FROM scan_error_samples
        WHERE id NOT IN (
          SELECT id FROM scan_error_samples ORDER BY datetime(created_at) DESC, id DESC LIMIT 200
        )
        ",
        [],
    );
}

fn clear_library_query_cache(connection: &Connection) {
    let _ = connection.execute("DELETE FROM library_query_cache", []);
}

impl ScanRequest {
    fn from_body(body: &JsonValue) -> Result<Self, String> {
        let mut paths = body_string_vec(body, "folder_paths");
        if paths.is_empty() {
            if let Some(path) = body_string(body, "folder_path") {
                paths.push(path);
            }
        }
        let paths = paths
            .into_iter()
            .map(|path| normalize_folder_path(&path))
            .collect::<Result<Vec<_>, _>>()?;
        if paths.is_empty() {
            return Err("Choose at least one music folder".to_string());
        }
        let save_paths = {
            let values = body_string_vec(body, "save_library_paths");
            let values = if values.is_empty() {
                paths
                    .iter()
                    .map(|path| path.to_string_lossy().to_string())
                    .collect()
            } else {
                values
            };
            values
                .into_iter()
                .map(|path| normalize_folder_path(&path))
                .collect::<Result<Vec<_>, _>>()?
        };
        let (native_files, native_errors) = parse_native_snapshot(body);
        Ok(Self {
            paths,
            save_paths,
            native_files,
            native_errors,
        })
    }
}

impl AudioSnapshot {
    fn from_path(path: PathBuf) -> Result<Self, String> {
        let metadata = fs::metadata(&path)
            .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        let modified = metadata.modified().ok();
        let modified_ms = modified.and_then(system_time_millis);
        let modified_at = modified.and_then(system_time_to_iso);
        let path_text = normalize_path_text(&path);
        Ok(Self {
            path: PathBuf::from(&path_text),
            path_key: path_key_text(&path_text),
            path_text,
            modified_at,
            modified_ms,
            size_bytes: Some(metadata.len() as i64),
        })
    }

    fn from_native(value: &JsonValue) -> Option<Self> {
        let raw_path = value.get("path").and_then(JsonValue::as_str)?.trim();
        if raw_path.is_empty() {
            return None;
        }
        let path_text = normalize_path_text(Path::new(raw_path));
        let path = PathBuf::from(&path_text);
        if !is_supported_audio_path(&path) {
            return None;
        }
        let modified_ms = value.get("modified_ms").and_then(JsonValue::as_i64);
        let modified_at = modified_ms.and_then(epoch_millis_to_iso);
        let size_bytes = value.get("size_bytes").and_then(JsonValue::as_i64);
        Some(Self {
            path,
            path_key: path_key_text(&path_text),
            path_text,
            modified_at,
            modified_ms,
            size_bytes,
        })
    }
}

impl NativeScanJob {
    fn new(job_id: String, request: &ScanRequest) -> Self {
        let folder_paths = request
            .paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        Self {
            job_id,
            folder_path: folder_paths.join("; "),
            folder_paths,
            status: "pending".to_string(),
            total_files: 0,
            processed_files: 0,
            inserted: 0,
            updated: 0,
            removed: 0,
            skipped: 0,
            errors: request.native_errors.clone(),
            current_path: None,
            started_at: utc_now(),
            finished_at: None,
            error: None,
            started_instant: Instant::now(),
            cancel_requested: false,
        }
    }

    fn snapshot(&self) -> NativeScanProgress {
        let elapsed_seconds = if self.finished_at.is_some() {
            self.started_instant.elapsed().as_secs_f64()
        } else {
            self.started_instant.elapsed().as_secs_f64()
        };
        let percent = if self.total_files > 0 {
            ((self.processed_files as f64 / self.total_files as f64) * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };
        let eta_seconds = if self.status == "scanning" && self.processed_files > 0 {
            let seconds_per_file = elapsed_seconds / self.processed_files as f64;
            Some(
                (self.total_files.saturating_sub(self.processed_files) as f64 * seconds_per_file)
                    .max(0.0),
            )
        } else if self.status == "completed" {
            Some(0.0)
        } else {
            None
        };
        NativeScanProgress {
            job_id: self.job_id.clone(),
            folder_path: self.folder_path.clone(),
            folder_paths: self.folder_paths.clone(),
            status: self.status.clone(),
            total_files: self.total_files,
            processed_files: self.processed_files,
            inserted: self.inserted,
            updated: self.updated,
            removed: self.removed,
            skipped: self.skipped,
            errors: self
                .errors
                .iter()
                .rev()
                .take(25)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect(),
            current_path: self.current_path.clone(),
            started_at: self.started_at.clone(),
            finished_at: self.finished_at.clone(),
            elapsed_seconds,
            eta_seconds,
            percent,
            error: self.error.clone(),
        }
    }
}

fn update_job<F>(
    local_job: Option<&mut NativeScanJob>,
    registry_job_id: Option<&str>,
    updater: F,
) -> Result<(), String>
where
    F: Fn(&mut NativeScanJob),
{
    if let Some(job) = local_job {
        updater(job);
    }
    if let Some(job_id) = registry_job_id {
        let mut jobs = jobs()
            .lock()
            .map_err(|_| "Scan job registry is unavailable".to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            updater(job);
        }
    }
    Ok(())
}

fn check_cancelled(registry_job_id: Option<&str>) -> Result<(), String> {
    let Some(job_id) = registry_job_id else {
        return Ok(());
    };
    let jobs = jobs()
        .lock()
        .map_err(|_| "Scan job registry is unavailable".to_string())?;
    if jobs
        .get(job_id)
        .map(|job| job.cancel_requested)
        .unwrap_or(false)
    {
        Err("cancelled".to_string())
    } else {
        Ok(())
    }
}

fn jobs() -> &'static Mutex<HashMap<String, NativeScanJob>> {
    SCAN_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn parse_native_snapshot(body: &JsonValue) -> (Option<Vec<AudioSnapshot>>, Vec<String>) {
    let Some(snapshot) = body.get("native_snapshot").and_then(JsonValue::as_object) else {
        return (None, Vec::new());
    };
    let files = snapshot
        .get("files")
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(AudioSnapshot::from_native)
                .collect::<Vec<_>>()
        });
    let errors = snapshot
        .get("errors")
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(JsonValue::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    (files, errors)
}

fn normalize_folder_path(value: &str) -> Result<PathBuf, String> {
    let cleaned = value.trim();
    if cleaned.is_empty() {
        return Err("Choose at least one music folder".to_string());
    }
    Ok(PathBuf::from(normalize_path_text(Path::new(cleaned))))
}

fn normalize_path_text(path: &Path) -> String {
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    };
    let resolved = path.canonicalize().unwrap_or(path);
    clean_windows_verbatim(&resolved.to_string_lossy())
}

fn clean_windows_verbatim(value: &str) -> String {
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = value.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        value.to_string()
    }
}

fn path_key(path: &Path) -> String {
    path_key_text(&normalize_path_text(path))
}

fn path_key_text(value: &str) -> String {
    if cfg!(windows) {
        value.to_ascii_lowercase()
    } else {
        value.to_string()
    }
}

fn path_is_under_folder(path: &Path, folder: &Path) -> bool {
    let path_key_value = path_key(path);
    let mut folder_key = path_key(folder);
    if path_key_value == folder_key {
        return true;
    }
    if !folder_key.ends_with(std::path::MAIN_SEPARATOR) {
        folder_key.push(std::path::MAIN_SEPARATOR);
    }
    path_key_value.starts_with(&folder_key)
}

fn is_supported_audio_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| format!(".{}", extension.to_ascii_lowercase()))
        .map(|extension| SUPPORTED_EXTENSIONS.contains(&extension.as_str()))
        .unwrap_or(false)
}

fn system_time_millis(value: SystemTime) -> Option<i64> {
    value
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as i64)
}

fn system_time_to_iso(value: SystemTime) -> Option<String> {
    let datetime = OffsetDateTime::from(value).replace_microsecond(0).ok()?;
    Some(format_py_utc(datetime))
}

fn epoch_millis_to_iso(value: i64) -> Option<String> {
    OffsetDateTime::from_unix_timestamp(value.div_euclid(1000))
        .ok()
        .map(|datetime| format_py_utc(datetime.replace_microsecond(0).unwrap_or(datetime)))
}

fn utc_now() -> String {
    format_py_utc(
        OffsetDateTime::now_utc()
            .replace_microsecond(0)
            .unwrap_or_else(|_| OffsetDateTime::now_utc()),
    )
}

fn format_py_utc(value: OffsetDateTime) -> String {
    value
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
        .trim_end_matches('Z')
        .to_string()
        + "+00:00"
}

fn new_job_id() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("{now:x}{:x}", std::process::id())
}

fn body_string(body: &JsonValue, key: &str) -> Option<String> {
    body.get(key)
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn body_string_vec(body: &JsonValue, key: &str) -> Vec<String> {
    body.get(key)
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(JsonValue::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn json_string(metadata: &serde_json::Map<String, JsonValue>, key: &str) -> Option<String> {
    metadata
        .get(key)
        .and_then(JsonValue::as_str)
        .map(str::to_string)
        .or_else(|| {
            metadata
                .get(key)
                .filter(|value| value.is_number())
                .map(JsonValue::to_string)
        })
}

fn required_text(
    metadata: &serde_json::Map<String, JsonValue>,
    key: &str,
) -> Result<String, String> {
    json_string(metadata, key)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("Metadata field {key} is missing"))
}

fn json_i64(metadata: &serde_json::Map<String, JsonValue>, key: &str) -> Option<i64> {
    metadata.get(key).and_then(|value| {
        value
            .as_i64()
            .or_else(|| value.as_u64().and_then(|value| i64::try_from(value).ok()))
            .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()))
    })
}

fn json_f64(metadata: &serde_json::Map<String, JsonValue>, key: &str) -> Option<f64> {
    metadata.get(key).and_then(|value| {
        value
            .as_f64()
            .or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok()))
    })
}

fn anonymized_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    value.chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_python_style_utc_timestamp() {
        let text = epoch_millis_to_iso(1_700_000_000_123).unwrap();
        assert!(text.ends_with("+00:00"));
        assert!(!text.ends_with('Z'));
    }

    #[test]
    fn detects_supported_audio_extensions_case_insensitively() {
        assert!(is_supported_audio_path(Path::new("Song.FLAC")));
        assert!(is_supported_audio_path(Path::new("Song.mp3")));
        assert!(!is_supported_audio_path(Path::new("cover.jpg")));
    }
}
