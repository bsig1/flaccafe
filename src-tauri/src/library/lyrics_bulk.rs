use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::{
    get_setting, music_only_clause, open_database, track_from_row, DesktopTrack, TRACK_COLUMNS,
};
use super::lyrics::{
    database_lyrics, display_title, lrclib_fetch, save_cached_online_lyrics, save_database_lyrics,
    truthy_setting_value,
};

const BULK_LYRICS_ONLINE_DELAY_MS: u64 = 125;
const BULK_LYRICS_ERROR_LIMIT: usize = 25;
const BULK_LYRICS_DEFAULT_LIMIT: i64 = 50_000;

static BULK_LYRICS_JOBS: OnceLock<Mutex<HashMap<String, BulkLyricsJob>>> = OnceLock::new();

#[derive(Clone)]
struct BulkLyricsJob {
    job_id: String,
    status: String,
    total_tracks: usize,
    processed_tracks: usize,
    already_cached: usize,
    embedded_found: usize,
    online_found: usize,
    missing: usize,
    failed: usize,
    errors: Vec<String>,
    current_track_id: Option<i64>,
    current_title: Option<String>,
    started_at: String,
    finished_at: Option<String>,
    error: Option<String>,
    started_instant: Instant,
    cancel_requested: bool,
    include_online: bool,
    only_missing: bool,
}

#[derive(Serialize)]
pub struct BulkLyricsStartResponse {
    job_id: String,
    status: String,
    include_online: bool,
    only_missing: bool,
}

#[derive(Serialize)]
pub struct BulkLyricsProgress {
    job_id: String,
    status: String,
    total_tracks: usize,
    processed_tracks: usize,
    already_cached: usize,
    embedded_found: usize,
    online_found: usize,
    missing: usize,
    failed: usize,
    errors: Vec<String>,
    current_track_id: Option<i64>,
    current_title: Option<String>,
    started_at: String,
    finished_at: Option<String>,
    elapsed_seconds: f64,
    eta_seconds: Option<f64>,
    percent: f64,
    error: Option<String>,
    include_online: bool,
    only_missing: bool,
}

enum BulkLyricsOutcome {
    AlreadyCached,
    Embedded,
    Online,
    Missing,
}

impl BulkLyricsJob {
    fn new(job_id: String, include_online: bool, only_missing: bool) -> Self {
        Self {
            job_id,
            status: "pending".to_string(),
            total_tracks: 0,
            processed_tracks: 0,
            already_cached: 0,
            embedded_found: 0,
            online_found: 0,
            missing: 0,
            failed: 0,
            errors: Vec::new(),
            current_track_id: None,
            current_title: None,
            started_at: utc_now(),
            finished_at: None,
            error: None,
            started_instant: Instant::now(),
            cancel_requested: false,
            include_online,
            only_missing,
        }
    }

    fn snapshot(&self) -> BulkLyricsProgress {
        let elapsed_seconds = self.started_instant.elapsed().as_secs_f64();
        let percent = if self.total_tracks > 0 {
            ((self.processed_tracks as f64 / self.total_tracks as f64) * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };
        let eta_seconds = if self.status == "scanning" && self.processed_tracks > 0 {
            let seconds_per_track = elapsed_seconds / self.processed_tracks as f64;
            Some(
                (self.total_tracks.saturating_sub(self.processed_tracks) as f64 * seconds_per_track)
                    .max(0.0),
            )
        } else if matches!(self.status.as_str(), "completed" | "cancelled") {
            Some(0.0)
        } else {
            None
        };
        BulkLyricsProgress {
            job_id: self.job_id.clone(),
            status: self.status.clone(),
            total_tracks: self.total_tracks,
            processed_tracks: self.processed_tracks,
            already_cached: self.already_cached,
            embedded_found: self.embedded_found,
            online_found: self.online_found,
            missing: self.missing,
            failed: self.failed,
            errors: self
                .errors
                .iter()
                .rev()
                .take(BULK_LYRICS_ERROR_LIMIT)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect(),
            current_track_id: self.current_track_id,
            current_title: self.current_title.clone(),
            started_at: self.started_at.clone(),
            finished_at: self.finished_at.clone(),
            elapsed_seconds,
            eta_seconds,
            percent,
            error: self.error.clone(),
            include_online: self.include_online,
            only_missing: self.only_missing,
        }
    }
}

fn bulk_lyrics_jobs() -> &'static Mutex<HashMap<String, BulkLyricsJob>> {
    BULK_LYRICS_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn utc_now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "".to_string())
}

fn new_bulk_lyrics_job_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("lyrics-{millis}")
}

fn update_bulk_lyrics_job<F>(job_id: &str, updater: F) -> Result<(), String>
where
    F: FnOnce(&mut BulkLyricsJob),
{
    let mut jobs = bulk_lyrics_jobs()
        .lock()
        .map_err(|_| "Lyrics lookup job registry is unavailable".to_string())?;
    let job = jobs
        .get_mut(job_id)
        .ok_or_else(|| "Lyrics lookup job not found".to_string())?;
    updater(job);
    Ok(())
}

fn check_bulk_lyrics_cancelled(job_id: &str) -> Result<(), String> {
    let jobs = bulk_lyrics_jobs()
        .lock()
        .map_err(|_| "Lyrics lookup job registry is unavailable".to_string())?;
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

fn bulk_lyrics_tracks(only_missing: bool, limit: Option<i64>) -> Result<Vec<DesktopTrack>, String> {
    let max_tracks = limit
        .unwrap_or(BULK_LYRICS_DEFAULT_LIMIT)
        .clamp(1, BULK_LYRICS_DEFAULT_LIMIT);
    let mut sql = format!(
        r#"
        SELECT {TRACK_COLUMNS}
        FROM tracks
        WHERE {music_filter}
        "#,
        music_filter = music_only_clause()
    );
    if only_missing {
        sql.push_str(
            r#"
            AND NOT EXISTS (
              SELECT 1
              FROM track_lyrics
              WHERE track_lyrics.track_id = tracks.id
                AND length(trim(coalesce(track_lyrics.lyrics, ''))) > 0
            )
            "#,
        );
    }
    sql.push_str(
        r#"
        ORDER BY
          lower(coalesce(artist, '')),
          lower(coalesce(album, '')),
          coalesce(disc_number, 0),
          coalesce(track_number, 0),
          lower(coalesce(title, path))
        "#,
    );
    sql.push_str(&format!(" LIMIT {max_tracks}"));

    let connection = open_database()?;
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Could not prepare bulk lyrics lookup: {error}"))?;
    let rows = statement
        .query_map([], track_from_row)
        .map_err(|error| format!("Could not read bulk lyrics tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode bulk lyrics tracks: {error}"))
}

fn should_write_lyrics_sidecars() -> Result<bool, String> {
    let connection = open_database()?;
    Ok(get_setting(&connection, "auto_write_fetched_lyrics_sidecars")
        .map_or(true, |value| truthy_setting_value(Some(value))))
}

fn is_missing_lyrics_error(error: &str) -> bool {
    error.contains("No matching lyrics found")
        || error.contains("No lyrics text found")
        || error == "not_found"
}

fn bulk_lookup_track(
    track: &DesktopTrack,
    include_online: bool,
    write_sidecar: bool,
) -> Result<BulkLyricsOutcome, String> {
    if database_lyrics(track.id)?.is_some() {
        return Ok(BulkLyricsOutcome::AlreadyCached);
    }

    if let Some((lyrics, is_synced)) = super::metadata::read_embedded_lyrics(Path::new(&track.path))? {
        save_database_lyrics(
            track.id,
            lyrics,
            "embedded-cache".to_string(),
            is_synced,
            None,
        )?;
        return Ok(BulkLyricsOutcome::Embedded);
    }

    if !include_online {
        return Ok(BulkLyricsOutcome::Missing);
    }

    let artist = track.artist.as_deref().unwrap_or_default().trim();
    if artist.is_empty() {
        return Ok(BulkLyricsOutcome::Missing);
    }

    match lrclib_fetch(
        track.id,
        &display_title(track),
        artist,
        track.album.as_deref(),
        track.duration_seconds,
    ) {
        Ok(response) => {
            save_cached_online_lyrics(track, response, write_sidecar)?;
            Ok(BulkLyricsOutcome::Online)
        }
        Err(error) if is_missing_lyrics_error(&error) => Ok(BulkLyricsOutcome::Missing),
        Err(error) => Err(error),
    }
}

fn run_bulk_lyrics_lookup(
    job_id: String,
    include_online: bool,
    only_missing: bool,
    limit: Option<i64>,
) -> Result<(), String> {
    let tracks = bulk_lyrics_tracks(only_missing, limit)?;
    let write_sidecar = should_write_lyrics_sidecars()?;
    update_bulk_lyrics_job(&job_id, |job| {
        job.status = "scanning".to_string();
        job.total_tracks = tracks.len();
    })?;

    for track in tracks {
        check_bulk_lyrics_cancelled(&job_id)?;
        update_bulk_lyrics_job(&job_id, |job| {
            job.current_track_id = Some(track.id);
            job.current_title = Some(display_title(&track));
        })?;

        let outcome = bulk_lookup_track(&track, include_online, write_sidecar);
        let pause_for_online = include_online
            && track
                .artist
                .as_deref()
                .is_some_and(|artist| !artist.trim().is_empty())
            && matches!(
                &outcome,
                Ok(BulkLyricsOutcome::Online) | Ok(BulkLyricsOutcome::Missing) | Err(_)
            );
        update_bulk_lyrics_job(&job_id, |job| {
            job.processed_tracks += 1;
            match &outcome {
                Ok(BulkLyricsOutcome::AlreadyCached) => job.already_cached += 1,
                Ok(BulkLyricsOutcome::Embedded) => job.embedded_found += 1,
                Ok(BulkLyricsOutcome::Online) => job.online_found += 1,
                Ok(BulkLyricsOutcome::Missing) => job.missing += 1,
                Err(error) => {
                    job.failed += 1;
                    job.errors.push(format!(
                        "{}: {}",
                        display_title(&track),
                        error.chars().take(240).collect::<String>()
                    ));
                }
            }
        })?;

        if pause_for_online {
            thread::sleep(Duration::from_millis(BULK_LYRICS_ONLINE_DELAY_MS));
        }
    }

    update_bulk_lyrics_job(&job_id, |job| {
        job.status = "completed".to_string();
        job.finished_at = Some(utc_now());
        job.current_track_id = None;
        job.current_title = None;
    })?;
    Ok(())
}

fn run_bulk_lyrics_lookup_thread(
    job_id: String,
    include_online: bool,
    only_missing: bool,
    limit: Option<i64>,
) {
    let result = run_bulk_lyrics_lookup(job_id.clone(), include_online, only_missing, limit);
    if let Err(error) = result {
        let _ = update_bulk_lyrics_job(&job_id, |job| {
            if error == "cancelled" {
                job.status = "cancelled".to_string();
            } else {
                job.status = "failed".to_string();
                job.error = Some(error);
            }
            job.finished_at = Some(utc_now());
            job.current_track_id = None;
            job.current_title = None;
        });
    }
}

fn bulk_lyrics_job_is_active(status: &str) -> bool {
    matches!(status, "pending" | "scanning" | "cancelling")
}

#[tauri::command]
pub fn start_bulk_lyrics_lookup_direct(
    include_online: Option<bool>,
    only_missing: Option<bool>,
    limit: Option<i64>,
) -> Result<BulkLyricsStartResponse, String> {
    let include_online = include_online.unwrap_or(true);
    let only_missing = only_missing.unwrap_or(true);
    let job_id = new_bulk_lyrics_job_id();
    let job = BulkLyricsJob::new(job_id.clone(), include_online, only_missing);
    {
        let mut jobs = bulk_lyrics_jobs()
            .lock()
            .map_err(|_| "Lyrics lookup job registry is unavailable".to_string())?;
        if jobs
            .values()
            .any(|job| bulk_lyrics_job_is_active(&job.status))
        {
            return Err("A bulk lyrics lookup is already running".to_string());
        }
        jobs.insert(job_id.clone(), job);
    }

    thread::spawn({
        let job_id = job_id.clone();
        move || run_bulk_lyrics_lookup_thread(job_id, include_online, only_missing, limit)
    });

    Ok(BulkLyricsStartResponse {
        job_id,
        status: "pending".to_string(),
        include_online,
        only_missing,
    })
}

#[tauri::command]
pub fn bulk_lyrics_lookup_progress_direct(job_id: String) -> Result<BulkLyricsProgress, String> {
    let jobs = bulk_lyrics_jobs()
        .lock()
        .map_err(|_| "Lyrics lookup job registry is unavailable".to_string())?;
    let job = jobs
        .get(&job_id)
        .ok_or_else(|| "Lyrics lookup job not found".to_string())?;
    Ok(job.snapshot())
}

#[tauri::command]
pub fn cancel_bulk_lyrics_lookup_direct(job_id: String) -> Result<BulkLyricsProgress, String> {
    {
        let mut jobs = bulk_lyrics_jobs()
            .lock()
            .map_err(|_| "Lyrics lookup job registry is unavailable".to_string())?;
        let job = jobs
            .get_mut(&job_id)
            .ok_or_else(|| "Lyrics lookup job not found".to_string())?;
        job.cancel_requested = true;
        if bulk_lyrics_job_is_active(&job.status) {
            job.status = "cancelling".to_string();
        }
    }
    bulk_lyrics_lookup_progress_direct(job_id)
}
