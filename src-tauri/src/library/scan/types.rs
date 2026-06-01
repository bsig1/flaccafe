use rusqlite::{params, Connection, OptionalExtension, Statement};
use serde::Serialize;
use serde_json::Value as JsonValue;
use std::collections::{hash_map::DefaultHasher, HashMap, HashSet};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::storage::{open_database, set_setting};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    ".flac", ".mp3", ".m4a", ".ogg", ".opus", ".wav", ".aiff", ".aif",
];
const METADATA_BATCH_SIZE: usize = 100;

static SCAN_JOBS: OnceLock<Mutex<HashMap<String, DesktopScanJob>>> = OnceLock::new();

#[derive(Clone)]
struct ScanRequest {
    paths: Vec<PathBuf>,
    save_paths: Vec<PathBuf>,
    cleanup_paths: Vec<PathBuf>,
    files: Option<Vec<AudioSnapshot>>,
    errors: Vec<String>,
}

#[derive(Clone)]
pub(crate) struct AudioSnapshot {
    pub(crate) path: PathBuf,
    pub(crate) path_text: String,
    pub(crate) path_key: String,
    pub(crate) modified_at: Option<String>,
    pub(crate) size_bytes: Option<i64>,
}

struct FolderPlan {
    folder: PathBuf,
    files: Vec<AudioSnapshot>,
    files_to_read: Vec<AudioSnapshot>,
    current_path_keys: HashSet<String>,
}

#[derive(Clone)]
struct DesktopScanJob {
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
pub(crate) struct DesktopScanStartResponse {
    job_id: String,
    folder_path: String,
    folder_paths: Vec<String>,
    status: String,
}

#[derive(Serialize)]
pub(crate) struct DesktopScanResult {
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
pub(crate) struct DesktopScanProgress {
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

pub(crate) fn scan_library(body: JsonValue) -> Result<DesktopScanResult, String> {
    let request = ScanRequest::from_body(&body)?;
    let mut job = DesktopScanJob::new("sync".to_string(), &request);
    let result = run_scan(request, Some(&mut job), None)?;
    Ok(result)
}

pub(crate) fn start_scan_library(body: JsonValue) -> Result<DesktopScanStartResponse, String> {
    let request = ScanRequest::from_body(&body)?;
    let job_id = new_job_id();
    let job = DesktopScanJob::new(job_id.clone(), &request);
    let response = DesktopScanStartResponse {
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

pub(crate) fn scan_progress(job_id: String) -> Result<DesktopScanProgress, String> {
    let jobs = jobs()
        .lock()
        .map_err(|_| "Scan job registry is unavailable".to_string())?;
    let job = jobs
        .get(&job_id)
        .ok_or_else(|| "Scan job not found".to_string())?;
    Ok(job.snapshot())
}

pub(crate) fn cancel_scan(job_id: String) -> Result<DesktopScanProgress, String> {
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
    scan_progress(job_id)
}

