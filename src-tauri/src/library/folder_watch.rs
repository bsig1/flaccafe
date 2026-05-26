use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value as JsonValue;
use sha1::{Digest, Sha1};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use super::scan::{
    cleanup_orphan_albums, clear_library_query_cache, discover_audio_files, normalize_path_text,
    path_is_under_folder, read_metadata_batch, update_track_from_metadata, upsert_track, utc_now,
    AudioSnapshot,
};
use super::storage::{get_setting, open_database, set_setting};

const DEFAULT_INTERVAL_SECONDS: u64 = 45;
const MIN_INTERVAL_SECONDS: u64 = 10;
const MAX_INTERVAL_SECONDS: u64 = 3600;
const DEFAULT_LIMIT: usize = 300;
const FINGERPRINT_CHUNK_SIZE: u64 = 64 * 1024;

static WATCH_STATE: OnceLock<Mutex<FolderWatchState>> = OnceLock::new();
static WATCH_GENERATION: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Serialize)]
pub(crate) struct FolderWatchChange {
    id: String,
    change_type: String,
    track_id: Option<i64>,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    old_path: Option<String>,
    new_path: Option<String>,
    previous_modified_at: Option<String>,
    file_modified_at: Option<String>,
    file_size: Option<i64>,
    detected_at: String,
    summary: String,
}

#[derive(Clone, Serialize)]
struct FolderWatchNotification {
    id: String,
    created_at: String,
    title: String,
    message: String,
    pending_count: usize,
    counts: HashMap<String, usize>,
    acknowledged: bool,
}

#[derive(Clone)]
struct FolderWatchState {
    enabled: bool,
    folder_path: Option<String>,
    status: String,
    interval_seconds: u64,
    last_checked_at: Option<String>,
    next_check_at: Option<String>,
    pending: Vec<FolderWatchChange>,
    notifications: Vec<FolderWatchNotification>,
    last_notification_signature: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct FolderWatchStatus {
    enabled: bool,
    folder_path: Option<String>,
    status: String,
    interval_seconds: u64,
    last_checked_at: Option<String>,
    next_check_at: Option<String>,
    pending_count: usize,
    counts: HashMap<String, usize>,
    changes: Vec<FolderWatchChange>,
    notifications: Vec<FolderWatchNotification>,
    error: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct FolderWatchApplyResponse {
    applied: usize,
    inserted: usize,
    updated: usize,
    removed: usize,
    moved: usize,
    skipped: usize,
    errors: Vec<String>,
    status: FolderWatchStatus,
}

#[derive(Clone)]
struct TrackRow {
    id: i64,
    path: String,
    path_key: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    file_modified_at: Option<String>,
    audio_fingerprint: Option<String>,
}

pub(crate) fn folder_watch_status(limit: usize) -> Result<FolderWatchStatus, String> {
    Ok(state()
        .lock()
        .map_err(|_| "Folder watch state is unavailable".to_string())?
        .snapshot(limit))
}

pub(crate) fn start_folder_watch(body: JsonValue) -> Result<FolderWatchStatus, String> {
    let folder = request_folder_path(&body)?.or_else(saved_library_path);
    let folder =
        folder.ok_or_else(|| "Choose a music folder before starting folder watch".to_string())?;
    let folder = normalize_path_text(Path::new(&folder));
    let interval = body
        .get("interval_seconds")
        .and_then(JsonValue::as_u64)
        .unwrap_or(DEFAULT_INTERVAL_SECONDS)
        .clamp(MIN_INTERVAL_SECONDS, MAX_INTERVAL_SECONDS);
    let limit = body
        .get("limit")
        .and_then(JsonValue::as_u64)
        .map(|value| value.clamp(1, 5_000) as usize)
        .unwrap_or(DEFAULT_LIMIT);
    {
        let connection = open_database()?;
        set_setting(&connection, "folder_watch_enabled", Some("1"))?;
        set_setting(
            &connection,
            "folder_watch_interval_seconds",
            Some(&interval.to_string()),
        )?;
    }
    stop_watch_thread();
    let generation = WATCH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    {
        let mut state = state()
            .lock()
            .map_err(|_| "Folder watch state is unavailable".to_string())?;
        state.enabled = true;
        state.folder_path = Some(folder.clone());
        state.interval_seconds = interval;
        state.status = "idle".to_string();
        state.next_check_at = Some(seconds_from_now(interval));
        state.error = None;
    }
    spawn_watch_thread(generation, folder.clone(), interval);
    refresh_folder_watch_with_files(Some(folder), limit, parse_snapshot_files(&body))
}

pub(crate) fn stop_folder_watch(limit: usize) -> Result<FolderWatchStatus, String> {
    stop_watch_thread();
    {
        let connection = open_database()?;
        set_setting(&connection, "folder_watch_enabled", Some("0"))?;
    }
    let mut state = state()
        .lock()
        .map_err(|_| "Folder watch state is unavailable".to_string())?;
    state.enabled = false;
    state.status = "stopped".to_string();
    state.next_check_at = None;
    Ok(state.snapshot(limit))
}

pub(crate) fn refresh_folder_watch(body: JsonValue) -> Result<FolderWatchStatus, String> {
    let limit = body
        .get("limit")
        .and_then(JsonValue::as_u64)
        .map(|value| value.clamp(1, 5_000) as usize)
        .unwrap_or(DEFAULT_LIMIT);
    refresh_folder_watch_with_files(
        request_folder_path(&body)?,
        limit,
        parse_snapshot_files(&body),
    )
}

pub(crate) fn apply_folder_watch(body: JsonValue) -> Result<FolderWatchApplyResponse, String> {
    let limit = body
        .get("limit")
        .and_then(JsonValue::as_u64)
        .map(|value| value.clamp(1, 5_000) as usize)
        .unwrap_or(DEFAULT_LIMIT);
    let apply_all = body
        .get("apply_all")
        .and_then(JsonValue::as_bool)
        .unwrap_or(false);
    let wanted_ids = body
        .get("change_ids")
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(JsonValue::as_str)
                .map(str::to_string)
                .collect::<HashSet<_>>()
        })
        .unwrap_or_default();
    let (folder, pending) = {
        let state = state()
            .lock()
            .map_err(|_| "Folder watch state is unavailable".to_string())?;
        (
            state.folder_path.clone(),
            state
                .pending
                .iter()
                .filter(|change| apply_all || wanted_ids.contains(&change.id))
                .cloned()
                .collect::<Vec<_>>(),
        )
    };
    let folder = folder.ok_or_else(|| "No watched library folder is configured".to_string())?;
    if pending.is_empty() {
        return Ok(FolderWatchApplyResponse {
            applied: 0,
            inserted: 0,
            updated: 0,
            removed: 0,
            moved: 0,
            skipped: 0,
            errors: Vec::new(),
            status: folder_watch_status(limit)?,
        });
    }
    let connection = open_database()?;
    let mut inserted = 0usize;
    let mut updated = 0usize;
    let mut removed = 0usize;
    let mut moved = 0usize;
    let mut skipped = 0usize;
    let mut errors = Vec::new();
    for change in &pending {
        match apply_one_change(&connection, change) {
            Ok("inserted") => inserted += 1,
            Ok("updated") => updated += 1,
            Ok("removed") => removed += 1,
            Ok("moved") => moved += 1,
            Ok(_) => skipped += 1,
            Err(error) => errors.push(format!("{}: {error}", change.summary)),
        }
    }
    if inserted + updated + removed + moved > 0 {
        clear_library_query_cache(&connection);
    }
    cleanup_orphan_albums(&connection)?;
    set_setting(&connection, "library_path", Some(&folder))?;
    let status = refresh_folder_watch_with_files(Some(folder), limit, None)?;
    Ok(FolderWatchApplyResponse {
        applied: inserted + updated + removed + moved,
        inserted,
        updated,
        removed,
        moved,
        skipped,
        errors,
        status,
    })
}

pub(crate) fn ack_folder_watch_notifications(body: JsonValue) -> Result<FolderWatchStatus, String> {
    let all = body
        .get("all_notifications")
        .and_then(JsonValue::as_bool)
        .unwrap_or(false);
    let wanted = body
        .get("notification_ids")
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(JsonValue::as_str)
                .map(str::to_string)
                .collect::<HashSet<_>>()
        })
        .unwrap_or_default();
    let mut state = state()
        .lock()
        .map_err(|_| "Folder watch state is unavailable".to_string())?;
    for notification in &mut state.notifications {
        if all || wanted.contains(&notification.id) {
            notification.acknowledged = true;
        }
    }
    Ok(state.snapshot(DEFAULT_LIMIT))
}

fn refresh_folder_watch_with_files(
    folder_path: Option<String>,
    limit: usize,
    files: Option<Vec<AudioSnapshot>>,
) -> Result<FolderWatchStatus, String> {
    let folder = folder_path
        .or_else(|| {
            state()
                .lock()
                .ok()
                .and_then(|state| state.folder_path.clone())
        })
        .or_else(saved_library_path);
    let Some(folder) = folder else {
        let mut state = state()
            .lock()
            .map_err(|_| "Folder watch state is unavailable".to_string())?;
        state.enabled = false;
        state.status = "stopped".to_string();
        state.folder_path = None;
        state.pending.clear();
        state.last_checked_at = Some(utc_now());
        state.next_check_at = None;
        return Ok(state.snapshot(limit));
    };
    let folder = normalize_path_text(Path::new(&folder));
    {
        let mut state = state()
            .lock()
            .map_err(|_| "Folder watch state is unavailable".to_string())?;
        state.status = "scanning".to_string();
        state.error = None;
    }
    match detect_folder_changes(&folder, files) {
        Ok(changes) => {
            let mut state = state()
                .lock()
                .map_err(|_| "Folder watch state is unavailable".to_string())?;
            state.folder_path = Some(folder);
            state.pending = changes;
            maybe_add_notification(&mut state);
            state.status = if state.enabled { "idle" } else { "stopped" }.to_string();
            state.last_checked_at = Some(utc_now());
            state.next_check_at = if state.enabled {
                Some(seconds_from_now(state.interval_seconds))
            } else {
                None
            };
            state.error = None;
            Ok(state.snapshot(limit))
        }
        Err(error) => {
            let mut state = state()
                .lock()
                .map_err(|_| "Folder watch state is unavailable".to_string())?;
            state.status = "error".to_string();
            state.error = Some(error);
            state.last_checked_at = Some(utc_now());
            state.next_check_at = None;
            Ok(state.snapshot(limit))
        }
    }
}

fn detect_folder_changes(
    folder_path: &str,
    files: Option<Vec<AudioSnapshot>>,
) -> Result<Vec<FolderWatchChange>, String> {
    let folder = PathBuf::from(folder_path);
    if !folder.exists() || !folder.is_dir() {
        return Err(format!("Folder does not exist: {}", folder.display()));
    }
    let detected_at = utc_now();
    let file_states = file_states_for_folder(&folder, files)?;
    let connection = open_database()?;
    let rows = library_tracks_under_folder(&connection, &folder)?;
    let rows_by_key = rows
        .iter()
        .map(|row| (row.path_key.clone(), row.clone()))
        .collect::<HashMap<_, _>>();
    let missing_rows = rows
        .iter()
        .filter(|row| !file_states.contains_key(&row.path_key) || !Path::new(&row.path).exists())
        .cloned()
        .collect::<Vec<_>>();
    let added_keys = file_states
        .keys()
        .filter(|key| !rows_by_key.contains_key(*key))
        .cloned()
        .collect::<HashSet<_>>();
    let mut changes = Vec::new();
    let mut consumed_added = HashSet::new();
    let mut consumed_missing = HashSet::new();
    let mut missing_by_fingerprint: HashMap<String, Vec<TrackRow>> = HashMap::new();
    for row in &missing_rows {
        if let Some(fingerprint) = &row.audio_fingerprint {
            missing_by_fingerprint
                .entry(fingerprint.clone())
                .or_default()
                .push(row.clone());
        }
    }
    for key in sorted_strings(&added_keys) {
        let snapshot = &file_states[&key];
        let Ok(fingerprint) = file_fingerprint(&snapshot.path) else {
            continue;
        };
        let Some(candidates) = missing_by_fingerprint.get_mut(&fingerprint) else {
            continue;
        };
        while let Some(row) = candidates.pop() {
            if consumed_missing.contains(&row.id) {
                continue;
            }
            consumed_added.insert(key.clone());
            consumed_missing.insert(row.id);
            changes.push(new_change(
                "moved",
                Some(&row),
                Some(row.path.clone()),
                Some(snapshot.path_text.clone()),
                row.file_modified_at.clone(),
                snapshot.modified_at.clone(),
                snapshot.size_bytes,
                &detected_at,
            ));
            break;
        }
    }
    for row in &missing_rows {
        if consumed_missing.contains(&row.id) {
            continue;
        }
        changes.push(new_change(
            "removed",
            Some(row),
            Some(row.path.clone()),
            None,
            row.file_modified_at.clone(),
            None,
            None,
            &detected_at,
        ));
    }
    for (key, row) in &rows_by_key {
        let Some(snapshot) = file_states.get(key) else {
            continue;
        };
        if row.file_modified_at.as_deref() == snapshot.modified_at.as_deref() {
            continue;
        }
        changes.push(new_change(
            "modified",
            Some(row),
            Some(row.path.clone()),
            Some(snapshot.path_text.clone()),
            row.file_modified_at.clone(),
            snapshot.modified_at.clone(),
            snapshot.size_bytes,
            &detected_at,
        ));
    }
    for key in sorted_strings(&added_keys.difference(&consumed_added).cloned().collect()) {
        let snapshot = &file_states[&key];
        changes.push(new_change(
            "added",
            None,
            None,
            Some(snapshot.path_text.clone()),
            None,
            snapshot.modified_at.clone(),
            snapshot.size_bytes,
            &detected_at,
        ));
    }
    changes.sort_by_key(|change| {
        let priority = match change.change_type.as_str() {
            "moved" => 0,
            "removed" => 1,
            "modified" => 2,
            _ => 3,
        };
        (
            priority,
            change
                .old_path
                .clone()
                .or_else(|| change.new_path.clone())
                .unwrap_or_default(),
        )
    });
    Ok(changes)
}

fn apply_one_change(
    connection: &Connection,
    change: &FolderWatchChange,
) -> Result<&'static str, String> {
    match change.change_type.as_str() {
        "removed" => {
            let track_id = change
                .track_id
                .ok_or_else(|| "Remove change is missing a track id".to_string())?;
            let path: String = connection
                .query_row(
                    "SELECT path FROM tracks WHERE id = ?",
                    params![track_id],
                    |row| row.get(0),
                )
                .unwrap_or_default();
            if path.is_empty() {
                return Ok("skipped");
            }
            if Path::new(&path).exists() {
                return Err("File exists again; refresh pending changes".to_string());
            }
            connection
                .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
                .map_err(|error| format!("Could not remove missing track: {error}"))?;
            Ok("removed")
        }
        "moved" => {
            let track_id = change
                .track_id
                .ok_or_else(|| "Move change is missing a track id".to_string())?;
            let path = change
                .new_path
                .as_deref()
                .ok_or_else(|| "Move change is missing a target path".to_string())?;
            let snapshot = AudioSnapshot::from_path(PathBuf::from(path))?;
            let results = read_metadata_batch(&[snapshot])?;
            let metadata = first_metadata_result(&results)?;
            let path_key = metadata
                .get("path_key")
                .and_then(JsonValue::as_str)
                .unwrap_or_default();
            let conflict = connection
                .query_row(
                    "SELECT id FROM tracks WHERE path_key = ? AND id <> ?",
                    params![path_key, track_id],
                    |row| row.get::<_, i64>(0),
                )
                .ok();
            if let Some(conflict_id) = conflict {
                return Err(format!("Target path is already tracked by #{conflict_id}"));
            }
            update_track_from_metadata(connection, track_id, metadata)?;
            Ok("moved")
        }
        "added" | "modified" => {
            let path = change
                .new_path
                .as_deref()
                .or(change.old_path.as_deref())
                .ok_or_else(|| "Change is missing a file path".to_string())?;
            let snapshot = AudioSnapshot::from_path(PathBuf::from(path))?;
            let results = read_metadata_batch(&[snapshot])?;
            let metadata = first_metadata_result(&results)?;
            upsert_track(connection, metadata)
        }
        _ => Ok("skipped"),
    }
}

fn first_metadata_result(
    results: &[JsonValue],
) -> Result<&serde_json::Map<String, JsonValue>, String> {
    let result = results
        .first()
        .ok_or_else(|| "Metadata worker returned no result".to_string())?;
    if let Some(error) = result.get("error").and_then(JsonValue::as_str) {
        return Err(error.to_string());
    }
    result
        .get("metadata")
        .and_then(JsonValue::as_object)
        .ok_or_else(|| "Metadata worker returned no metadata".to_string())
}

fn file_states_for_folder(
    folder: &Path,
    files: Option<Vec<AudioSnapshot>>,
) -> Result<HashMap<String, AudioSnapshot>, String> {
    let files = if let Some(files) = files {
        files
            .into_iter()
            .filter(|snapshot| path_is_under_folder(&snapshot.path, folder))
            .collect::<Vec<_>>()
    } else {
        discover_audio_files(folder)?
    };
    Ok(files
        .into_iter()
        .map(|snapshot| (snapshot.path_key.clone(), snapshot))
        .collect())
}

fn library_tracks_under_folder(
    connection: &Connection,
    folder: &Path,
) -> Result<Vec<TrackRow>, String> {
    let mut statement = connection
        .prepare("SELECT id, path, path_key, title, artist, album, file_modified_at, audio_fingerprint FROM tracks")
        .map_err(|error| format!("Could not inspect library tracks: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(TrackRow {
                id: row.get(0)?,
                path: row.get(1)?,
                path_key: row.get(2)?,
                title: row.get(3)?,
                artist: row.get(4)?,
                album: row.get(5)?,
                file_modified_at: row.get(6)?,
                audio_fingerprint: row.get(7)?,
            })
        })
        .map_err(|error| format!("Could not query library tracks: {error}"))?;
    let mut tracks = Vec::new();
    for row in rows {
        let row = row.map_err(|error| format!("Could not read library track: {error}"))?;
        if path_is_under_folder(Path::new(&row.path), folder) {
            tracks.push(row);
        }
    }
    Ok(tracks)
}

fn new_change(
    change_type: &str,
    row: Option<&TrackRow>,
    old_path: Option<String>,
    new_path: Option<String>,
    previous_modified_at: Option<String>,
    file_modified_at: Option<String>,
    file_size: Option<i64>,
    detected_at: &str,
) -> FolderWatchChange {
    let summary = match change_type {
        "added" => format!(
            "New file: {}",
            new_path
                .as_deref()
                .and_then(|path| Path::new(path).file_name())
                .and_then(|name| name.to_str())
                .unwrap_or("audio file")
        ),
        "modified" => "Metadata or file timestamp changed".to_string(),
        "removed" => "Tracked file is missing from disk".to_string(),
        "moved" => "Likely rename or move, matched by fast audio fingerprint".to_string(),
        _ => row
            .and_then(|row| row.title.clone())
            .unwrap_or_else(|| "Pending library change".to_string()),
    };
    let id = stable_change_id(
        change_type,
        row.map(|row| row.id),
        old_path.as_deref(),
        new_path.as_deref(),
        file_modified_at.as_deref(),
    );
    FolderWatchChange {
        id,
        change_type: change_type.to_string(),
        track_id: row.map(|row| row.id),
        title: row.and_then(|row| row.title.clone()),
        artist: row.and_then(|row| row.artist.clone()),
        album: row.and_then(|row| row.album.clone()),
        old_path,
        new_path,
        previous_modified_at,
        file_modified_at,
        file_size,
        detected_at: detected_at.to_string(),
        summary,
    }
}

fn maybe_add_notification(state: &mut FolderWatchState) {
    if state.pending.is_empty() {
        state.last_notification_signature = None;
        return;
    }
    let mut ids = state
        .pending
        .iter()
        .map(|change| change.id.clone())
        .collect::<Vec<_>>();
    ids.sort();
    let signature = digest_text(&ids.join("|"));
    if state.last_notification_signature.as_deref() == Some(&signature) {
        return;
    }
    let counts = folder_watch_counts(&state.pending);
    let pending_count = state.pending.len();
    state.notifications.push(FolderWatchNotification {
        id: format!("watch-{signature}"),
        created_at: utc_now(),
        title: format!(
            "{pending_count} pending folder change{}",
            if pending_count == 1 { "" } else { "s" }
        ),
        message: notification_message(&counts),
        pending_count,
        counts,
        acknowledged: false,
    });
    if state.notifications.len() > 50 {
        let overflow = state.notifications.len() - 50;
        state.notifications.drain(0..overflow);
    }
    state.last_notification_signature = Some(signature);
}

fn folder_watch_counts(changes: &[FolderWatchChange]) -> HashMap<String, usize> {
    let mut counts = HashMap::from([
        ("added".to_string(), 0),
        ("modified".to_string(), 0),
        ("removed".to_string(), 0),
        ("moved".to_string(), 0),
    ]);
    for change in changes {
        *counts.entry(change.change_type.clone()).or_insert(0) += 1;
    }
    counts
}

fn notification_message(counts: &HashMap<String, usize>) -> String {
    ["added", "modified", "moved", "removed"]
        .iter()
        .filter_map(|key| {
            let count = *counts.get(*key).unwrap_or(&0);
            (count > 0).then(|| format!("{count} {key}"))
        })
        .collect::<Vec<_>>()
        .join(", ")
}

impl Default for FolderWatchState {
    fn default() -> Self {
        Self {
            enabled: false,
            folder_path: None,
            status: "stopped".to_string(),
            interval_seconds: DEFAULT_INTERVAL_SECONDS,
            last_checked_at: None,
            next_check_at: None,
            pending: Vec::new(),
            notifications: Vec::new(),
            last_notification_signature: None,
            error: None,
        }
    }
}

impl FolderWatchState {
    fn snapshot(&self, limit: usize) -> FolderWatchStatus {
        FolderWatchStatus {
            enabled: self.enabled,
            folder_path: self.folder_path.clone(),
            status: self.status.clone(),
            interval_seconds: self.interval_seconds,
            last_checked_at: self.last_checked_at.clone(),
            next_check_at: self.next_check_at.clone(),
            pending_count: self.pending.len(),
            counts: folder_watch_counts(&self.pending),
            changes: self.pending.iter().take(limit).cloned().collect(),
            notifications: self
                .notifications
                .iter()
                .rev()
                .take(20)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect(),
            error: self.error.clone(),
        }
    }
}

fn spawn_watch_thread(generation: u64, folder: String, interval_seconds: u64) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(interval_seconds));
        if WATCH_GENERATION.load(Ordering::SeqCst) != generation {
            break;
        }
        let _ = refresh_folder_watch_with_files(Some(folder.clone()), DEFAULT_LIMIT, None);
    });
}

fn stop_watch_thread() {
    WATCH_GENERATION.fetch_add(1, Ordering::SeqCst);
}

fn state() -> &'static Mutex<FolderWatchState> {
    WATCH_STATE.get_or_init(|| Mutex::new(FolderWatchState::default()))
}

fn request_folder_path(body: &JsonValue) -> Result<Option<String>, String> {
    Ok(body
        .get("folder_path")
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string))
}

fn saved_library_path() -> Option<String> {
    let connection = open_database().ok()?;
    get_setting(&connection, "library_path")
}

fn parse_snapshot_files(body: &JsonValue) -> Option<Vec<AudioSnapshot>> {
    body.get("snapshot")
        .and_then(JsonValue::as_object)
        .and_then(|snapshot| snapshot.get("files"))
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(AudioSnapshot::from_worker_json)
                .collect::<Vec<_>>()
        })
}

fn seconds_from_now(seconds: u64) -> String {
    let now = time::OffsetDateTime::now_utc() + time::Duration::seconds(seconds as i64);
    now.replace_microsecond(0)
        .ok()
        .map(|value| {
            value
                .format(&time::format_description::well_known::Rfc3339)
                .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
                .trim_end_matches('Z')
                .to_string()
                + "+00:00"
        })
        .unwrap_or_else(utc_now)
}

fn file_fingerprint(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not fingerprint {}: {error}", path.display()))?;
    let size = file
        .metadata()
        .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?
        .len();
    let mut hasher = Sha1::new();
    hasher.update(size.to_string().as_bytes());
    let mut offsets = vec![0u64];
    if size > FINGERPRINT_CHUNK_SIZE * 2 {
        offsets.push(size / 2 - FINGERPRINT_CHUNK_SIZE / 2);
    }
    if size > FINGERPRINT_CHUNK_SIZE {
        offsets.push(size - FINGERPRINT_CHUNK_SIZE);
    }
    offsets.sort_unstable();
    offsets.dedup();
    let mut buffer = vec![0u8; FINGERPRINT_CHUNK_SIZE as usize];
    for offset in offsets {
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| format!("Could not seek {}: {error}", path.display()))?;
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn stable_change_id(
    change_type: &str,
    track_id: Option<i64>,
    old_path: Option<&str>,
    new_path: Option<&str>,
    file_modified_at: Option<&str>,
) -> String {
    digest_text(&format!(
        "{}|{}|{}|{}|{}",
        change_type,
        track_id.unwrap_or_default(),
        old_path.unwrap_or_default(),
        new_path.unwrap_or_default(),
        file_modified_at.unwrap_or_default()
    ))
}

fn digest_text(text: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())[..16].to_string()
}

fn sorted_strings(values: &HashSet<String>) -> Vec<String> {
    let mut values = values.iter().cloned().collect::<Vec<_>>();
    values.sort();
    values
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_folder_watch_change_types() {
        let now = utc_now();
        let changes = vec![
            new_change(
                "added",
                None,
                None,
                Some("a.mp3".to_string()),
                None,
                None,
                None,
                &now,
            ),
            new_change(
                "removed",
                None,
                Some("b.mp3".to_string()),
                None,
                None,
                None,
                None,
                &now,
            ),
        ];
        let counts = folder_watch_counts(&changes);
        assert_eq!(counts["added"], 1);
        assert_eq!(counts["removed"], 1);
    }

    #[test]
    fn stable_change_ids_are_deterministic() {
        let left = stable_change_id("added", None, None, Some("song.flac"), Some("now"));
        let right = stable_change_id("added", None, None, Some("song.flac"), Some("now"));
        assert_eq!(left, right);
    }
}

