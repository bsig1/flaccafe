mod clap_manager;
mod clap_worker;
mod genre_tags;

pub(crate) use clap_manager::{
    clap_status, clap_status_value, get_clap_install, start_clap_install, update_clap_config,
};
use clap_worker::ClapWorker;
use rusqlite::{params, params_from_iter, ToSql};
use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Instant;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::search::music_only_clause;
use super::storage::open_database;
use super::types::*;

pub(crate) use genre_tags::clap_genre_tags;

#[derive(Clone)]
struct AnalysisRequest {
    limit: Option<usize>,
    overwrite: bool,
    only_missing: bool,
    track_ids: Option<Vec<i64>>,
}

#[derive(Clone)]
pub(super) struct AnalysisCandidate {
    pub(super) id: i64,
    pub(super) path: String,
    title: Option<String>,
}

#[derive(Clone)]
struct AnalysisJob {
    job_id: String,
    request: AnalysisRequest,
    status: String,
    phase: Option<String>,
    message: Option<String>,
    total_tracks: i64,
    processed_tracks: i64,
    analyzed: i64,
    skipped: i64,
    errors: Vec<String>,
    failed_tracks: Vec<DesktopAudioAnalysisError>,
    current_track: Option<String>,
    model_cached_at_start: Option<bool>,
    started_at: String,
    finished_at: Option<String>,
    started_instant: Instant,
    error: Option<String>,
    pause_requested: bool,
    cancel_requested: bool,
}

static ANALYSIS_JOBS: OnceLock<Mutex<HashMap<String, AnalysisJob>>> = OnceLock::new();
static ANALYSIS_COUNTER: AtomicU64 = AtomicU64::new(1);

pub(crate) fn start_clap_analysis(body: JsonValue) -> Result<DesktopAudioAnalysisProgress, String> {
    let request = AnalysisRequest::from_body(&body);
    let status = clap_status_value(true)?;
    if !status
        .get("installed")
        .and_then(JsonValue::as_bool)
        .unwrap_or(false)
    {
        return Err(status
            .get("message")
            .and_then(JsonValue::as_str)
            .unwrap_or("CLAP dependencies are not installed.")
            .to_string());
    }
    let model_cached = status.get("model_cached").and_then(JsonValue::as_bool);
    let job_id = new_analysis_job_id();
    let job = AnalysisJob {
        job_id: job_id.clone(),
        request,
        status: "pending".to_string(),
        phase: Some("queued".to_string()),
        message: Some("Waiting to start".to_string()),
        total_tracks: 0,
        processed_tracks: 0,
        analyzed: 0,
        skipped: 0,
        errors: Vec::new(),
        failed_tracks: Vec::new(),
        current_track: None,
        model_cached_at_start: model_cached,
        started_at: utc_now(),
        finished_at: None,
        started_instant: Instant::now(),
        error: None,
        pause_requested: false,
        cancel_requested: false,
    };
    let response = job.snapshot();
    analysis_jobs()
        .lock()
        .map_err(|_| "Analysis job registry is unavailable".to_string())?
        .insert(job_id.clone(), job);
    thread::spawn(move || run_analysis_thread(job_id));
    Ok(response)
}

pub(crate) fn get_clap_analysis(job_id: String) -> Result<DesktopAudioAnalysisProgress, String> {
    let jobs = analysis_jobs()
        .lock()
        .map_err(|_| "Analysis job registry is unavailable".to_string())?;
    jobs.get(&job_id)
        .map(AnalysisJob::snapshot)
        .ok_or_else(|| "Analysis job not found".to_string())
}

pub(crate) fn pause_clap_analysis(job_id: String) -> Result<DesktopAudioAnalysisProgress, String> {
    update_analysis_job(&job_id, |job| {
        if !terminal(&job.status) {
            job.pause_requested = true;
            job.message = Some("Pause requested. Current track will finish first.".to_string());
        }
    })?;
    get_clap_analysis(job_id)
}

pub(crate) fn resume_clap_analysis(job_id: String) -> Result<DesktopAudioAnalysisProgress, String> {
    update_analysis_job(&job_id, |job| {
        if !terminal(&job.status) {
            job.pause_requested = false;
            job.status = "running".to_string();
            job.phase = Some("analyzing".to_string());
            job.message = Some("Resuming audio analysis.".to_string());
        }
    })?;
    get_clap_analysis(job_id)
}

pub(crate) fn cancel_clap_analysis(job_id: String) -> Result<DesktopAudioAnalysisProgress, String> {
    update_analysis_job(&job_id, |job| {
        if !terminal(&job.status) {
            job.cancel_requested = true;
            job.status = "canceling".to_string();
            job.phase = Some("canceling".to_string());
            job.message = Some(
                "Cancel requested. Current operation will stop at the next safe point.".to_string(),
            );
        }
    })?;
    get_clap_analysis(job_id)
}

fn run_analysis_thread(job_id: String) {
    let result = run_analysis(&job_id);
    let mut jobs = match analysis_jobs().lock() {
        Ok(jobs) => jobs,
        Err(_) => return,
    };
    if let Some(job) = jobs.get_mut(&job_id) {
        match result {
            Ok(()) if job.status != "canceled" => {
                job.status = "completed".to_string();
                job.phase = Some("completed".to_string());
                job.message = Some(format!("Analyzed {} tracks.", job.analyzed));
                job.current_track = None;
                job.finished_at = Some(utc_now());
                job.error = None;
            }
            Ok(()) => {}
            Err(error) => {
                job.status = "failed".to_string();
                job.phase = Some("failed".to_string());
                job.message = Some(error.clone());
                job.error = Some(error);
                job.current_track = None;
                job.finished_at = Some(utc_now());
            }
        }
    }
}

fn run_analysis(job_id: &str) -> Result<(), String> {
    let request = update_analysis_job(job_id, |job| job.request.clone())?;
    let candidates = candidate_tracks(&request)?;
    update_analysis_job(job_id, |job| {
        job.status = "running".to_string();
        job.phase = Some("preparing".to_string());
        job.total_tracks = candidates.len() as i64;
        job.message = if job.model_cached_at_start.unwrap_or(false) {
            Some("Loading cached CLAP model.".to_string())
        } else {
            Some("Downloading and loading CLAP model. First run can take a while.".to_string())
        };
    })?;

    if candidates.is_empty() {
        update_analysis_job(job_id, |job| {
            job.status = "completed".to_string();
            job.phase = Some("completed".to_string());
            job.message = Some("No tracks needed analysis.".to_string());
            job.finished_at = Some(utc_now());
        })?;
        return Ok(());
    }

    if is_cancel_requested(job_id)? {
        mark_canceled(job_id, "Analysis canceled before model load.")?;
        return Ok(());
    }

    let mut worker = ClapWorker::start()?;
    for (index, track) in candidates.iter().enumerate() {
        if !wait_if_not_paused(job_id)? {
            let _ = worker.shutdown();
            mark_canceled(job_id, "Analysis canceled.")?;
            return Ok(());
        }
        update_analysis_job(job_id, |job| {
            job.status = "running".to_string();
            job.phase = Some("analyzing".to_string());
            job.current_track = Some(track.title.clone().unwrap_or_else(|| track.path.clone()));
            job.processed_tracks = index as i64;
            job.message = Some(format!("Analyzing {} of {}", index + 1, candidates.len()));
        })?;

        let outcome = worker.analyze(track);
        match outcome {
            Ok(analysis) => {
                save_analysis(track.id, &analysis)?;
                update_analysis_job(job_id, |job| {
                    job.analyzed += 1;
                    job.processed_tracks = (index + 1) as i64;
                })?;
            }
            Err(error) => {
                save_analysis_failure(track.id, &error)?;
                update_analysis_job(job_id, |job| {
                    job.skipped += 1;
                    job.processed_tracks = (index + 1) as i64;
                    job.errors.push(format!("{}: {error}", track.path));
                    job.failed_tracks.push(DesktopAudioAnalysisError {
                        track_id: Some(track.id),
                        path: Some(track.path.clone()),
                        title: track.title.clone(),
                        message: error,
                    });
                    trim_tail(&mut job.errors, 25);
                    trim_tail(&mut job.failed_tracks, 50);
                })?;
            }
        }
    }
    let _ = worker.shutdown();
    Ok(())
}

fn candidate_tracks(request: &AnalysisRequest) -> Result<Vec<AnalysisCandidate>, String> {
    let connection = open_database()?;
    let mut clauses = vec![
        "path IS NOT NULL".to_string(),
        "trim(path) <> ''".to_string(),
        music_only_clause().to_string(),
    ];
    let mut params: Vec<Box<dyn ToSql>> = Vec::new();

    if let Some(track_ids) = request.track_ids.as_deref().filter(|ids| !ids.is_empty()) {
        let mut unique = Vec::new();
        for id in track_ids.iter().copied().filter(|id| *id > 0) {
            if !unique.contains(&id) {
                unique.push(id);
            }
        }
        if unique.is_empty() {
            return Ok(Vec::new());
        }
        clauses.push(format!("id IN ({})", vec!["?"; unique.len()].join(",")));
        params.extend(unique.into_iter().map(|id| Box::new(id) as Box<dyn ToSql>));
    }
    if request.only_missing {
        clauses.push(
            "(analysis_genre IS NULL OR trim(analysis_genre) = ''
              OR analysis_embedding IS NULL OR trim(analysis_embedding) = '')"
                .to_string(),
        );
    }
    if !request.overwrite {
        clauses.push(
            "(analysis_updated_at IS NULL OR analysis_provider IS NULL OR analysis_provider <> 'clap')"
                .to_string(),
        );
    }
    let limit_clause = if request.limit.is_some() {
        "LIMIT ?"
    } else {
        ""
    };
    if let Some(limit) = request.limit {
        params.push(Box::new(limit as i64));
    }
    let sql = format!(
        "SELECT id, path, title
         FROM tracks
         WHERE {}
         ORDER BY datetime(date_added) DESC, id ASC
         {limit_clause}",
        clauses.join(" AND ")
    );
    let param_refs = params
        .iter()
        .map(|value| value.as_ref())
        .collect::<Vec<&dyn ToSql>>();
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Could not prepare CLAP candidate query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(param_refs), |row| {
            Ok(AnalysisCandidate {
                id: row.get("id")?,
                path: row.get("path")?,
                title: row.get("title")?,
            })
        })
        .map_err(|error| format!("Could not read CLAP candidates: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode CLAP candidates: {error}"))
}

fn save_analysis(track_id: i64, analysis: &JsonValue) -> Result<(), String> {
    let provider = analysis
        .get("provider")
        .and_then(JsonValue::as_str)
        .unwrap_or("clap");
    let model = analysis.get("model").and_then(JsonValue::as_str);
    let genre = analysis.get("genre").and_then(JsonValue::as_str);
    let confidence = analysis.get("confidence").and_then(JsonValue::as_f64);
    let tags = serde_json::to_string(analysis.get("tags").unwrap_or(&json!({})))
        .map_err(|error| format!("Could not encode CLAP tags: {error}"))?;
    let embedding = serde_json::to_string(analysis.get("embedding").unwrap_or(&json!([])))
        .map_err(|error| format!("Could not encode CLAP embedding: {error}"))?;
    let updated_at = analysis
        .get("updated_at")
        .and_then(JsonValue::as_str)
        .map(str::to_string)
        .unwrap_or_else(utc_now);
    let connection = open_database()?;
    connection
        .execute(
            "UPDATE tracks
             SET analysis_provider = ?,
                 analysis_model = ?,
                 analysis_genre = ?,
                 analysis_genre_confidence = ?,
                 analysis_genre_tags = ?,
                 analysis_embedding = ?,
                 analysis_updated_at = ?,
                 updated_at = datetime('now')
             WHERE id = ?",
            params![provider, model, genre, confidence, tags, embedding, updated_at, track_id],
        )
        .map_err(|error| format!("Could not save CLAP analysis: {error}"))?;
    let _ = connection.execute("DELETE FROM library_query_cache", []);
    Ok(())
}

fn save_analysis_failure(track_id: i64, message: &str) -> Result<(), String> {
    let connection = open_database()?;
    let payload = json!({ "error": message }).to_string();
    connection
        .execute(
            "UPDATE tracks
             SET analysis_provider = 'clap_failed',
                 analysis_model = NULL,
                 analysis_genre = NULL,
                 analysis_genre_confidence = NULL,
                 analysis_genre_tags = ?,
                 analysis_embedding = NULL,
                 analysis_updated_at = datetime('now'),
                 updated_at = datetime('now')
             WHERE id = ?",
            params![payload, track_id],
        )
        .map_err(|error| format!("Could not save CLAP failure: {error}"))?;
    let _ = connection.execute("DELETE FROM library_query_cache", []);
    Ok(())
}

impl AnalysisRequest {
    fn from_body(body: &JsonValue) -> Self {
        Self {
            limit: body_i64(body, "limit")
                .filter(|value| *value > 0)
                .and_then(|value| usize::try_from(value).ok())
                .map(|value| value.min(100_000)),
            overwrite: body_bool(body, "overwrite").unwrap_or(false),
            only_missing: body_bool(body, "only_missing")
                .or_else(|| body_bool(body, "onlyMissing"))
                .unwrap_or(true),
            track_ids: body_i64_vec(body, "track_ids").or_else(|| body_i64_vec(body, "trackIds")),
        }
    }
}

impl AnalysisJob {
    fn snapshot(&self) -> DesktopAudioAnalysisProgress {
        let elapsed_seconds = self.started_instant.elapsed().as_secs_f64();
        let percent = if self.total_tracks > 0 {
            ((self.processed_tracks as f64 / self.total_tracks as f64) * 100.0).min(100.0)
        } else if self.status == "completed" {
            100.0
        } else {
            0.0
        };
        let eta_seconds = if self.status == "running" && self.processed_tracks > 0 {
            let seconds_per_track = elapsed_seconds / self.processed_tracks as f64;
            Some(((self.total_tracks - self.processed_tracks).max(0) as f64) * seconds_per_track)
        } else if self.status == "completed" {
            Some(0.0)
        } else {
            None
        };
        DesktopAudioAnalysisProgress {
            job_id: self.job_id.clone(),
            status: self.status.clone(),
            phase: self.phase.clone(),
            message: self.message.clone(),
            total_tracks: self.total_tracks,
            processed_tracks: self.processed_tracks,
            analyzed: self.analyzed,
            skipped: self.skipped,
            errors: self.errors.clone(),
            failed_tracks: self.failed_tracks.clone(),
            current_track: self.current_track.clone(),
            model_cached_at_start: self.model_cached_at_start,
            started_at: self.started_at.clone(),
            finished_at: self.finished_at.clone(),
            elapsed_seconds,
            eta_seconds,
            percent,
            error: self.error.clone(),
        }
    }
}

fn analysis_jobs() -> &'static Mutex<HashMap<String, AnalysisJob>> {
    ANALYSIS_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn update_analysis_job<T>(
    job_id: &str,
    update: impl FnOnce(&mut AnalysisJob) -> T,
) -> Result<T, String> {
    let mut jobs = analysis_jobs()
        .lock()
        .map_err(|_| "Analysis job registry is unavailable".to_string())?;
    let job = jobs
        .get_mut(job_id)
        .ok_or_else(|| "Analysis job not found".to_string())?;
    Ok(update(job))
}

fn is_cancel_requested(job_id: &str) -> Result<bool, String> {
    update_analysis_job(job_id, |job| job.cancel_requested)
}

fn wait_if_not_paused(job_id: &str) -> Result<bool, String> {
    loop {
        let state = update_analysis_job(job_id, |job| {
            if job.cancel_requested {
                return (false, false);
            }
            if job.pause_requested {
                job.status = "paused".to_string();
                job.phase = Some("paused".to_string());
                job.message = Some("Paused. Resume to continue analysis.".to_string());
                return (true, true);
            }
            if job.status == "paused" {
                job.status = "running".to_string();
                job.phase = Some("analyzing".to_string());
                job.message = Some("Resuming audio analysis.".to_string());
            }
            (true, false)
        })?;
        if !state.0 {
            return Ok(false);
        }
        if !state.1 {
            return Ok(true);
        }
        thread::sleep(std::time::Duration::from_millis(250));
    }
}

fn mark_canceled(job_id: &str, message: &str) -> Result<(), String> {
    update_analysis_job(job_id, |job| {
        job.status = "canceled".to_string();
        job.phase = Some("canceled".to_string());
        job.message = Some(message.to_string());
        job.current_track = None;
        job.finished_at = Some(utc_now());
    })
}

fn terminal(status: &str) -> bool {
    matches!(status, "completed" | "failed" | "canceled")
}

fn trim_tail<T>(values: &mut Vec<T>, max_len: usize) {
    if values.len() > max_len {
        let excess = values.len() - max_len;
        values.drain(0..excess);
    }
}

pub(super) fn body_bool(body: &JsonValue, key: &str) -> Option<bool> {
    match body.get(key) {
        Some(JsonValue::Bool(value)) => Some(*value),
        Some(JsonValue::String(value)) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

pub(super) fn body_i64(body: &JsonValue, key: &str) -> Option<i64> {
    match body.get(key) {
        Some(JsonValue::Number(value)) => value.as_i64(),
        Some(JsonValue::String(value)) => value.trim().parse().ok(),
        _ => None,
    }
}

pub(super) fn body_f64(body: &JsonValue, key: &str) -> Option<f64> {
    match body.get(key) {
        Some(JsonValue::Number(value)) => value.as_f64(),
        Some(JsonValue::String(value)) => value.trim().parse().ok(),
        _ => None,
    }
}

pub(super) fn body_i64_vec(body: &JsonValue, key: &str) -> Option<Vec<i64>> {
    body.get(key).and_then(JsonValue::as_array).map(|values| {
        values
            .iter()
            .filter_map(|value| match value {
                JsonValue::Number(number) => number.as_i64(),
                JsonValue::String(text) => text.trim().parse::<i64>().ok(),
                _ => None,
            })
            .filter(|value| *value > 0)
            .take(10_000)
            .collect()
    })
}

fn new_analysis_job_id() -> String {
    let counter = ANALYSIS_COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = OffsetDateTime::now_utc().unix_timestamp_nanos();
    format!("clap-{now:x}-{counter:x}")
}

fn utc_now() -> String {
    OffsetDateTime::now_utc()
        .replace_microsecond(0)
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}
