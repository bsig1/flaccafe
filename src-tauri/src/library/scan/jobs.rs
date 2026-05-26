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
        let (files, errors) = parse_scan_snapshot(body);
        Ok(Self {
            paths,
            save_paths,
            files,
            errors,
        })
    }
}

impl AudioSnapshot {
    pub(crate) fn from_path(path: PathBuf) -> Result<Self, String> {
        let metadata = fs::metadata(&path)
            .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        let modified = metadata.modified().ok();
        let modified_at = modified.and_then(system_time_to_iso);
        let path_text = normalize_path_text(&path);
        Ok(Self {
            path: PathBuf::from(&path_text),
            path_key: path_key_text(&path_text),
            path_text,
            modified_at,
            size_bytes: Some(metadata.len() as i64),
        })
    }

    pub(crate) fn from_worker_json(value: &JsonValue) -> Option<Self> {
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
            size_bytes,
        })
    }
}

impl DesktopScanJob {
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
            errors: request.errors.clone(),
            current_path: None,
            started_at: utc_now(),
            finished_at: None,
            error: None,
            started_instant: Instant::now(),
            cancel_requested: false,
        }
    }

    fn snapshot(&self) -> DesktopScanProgress {
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
        DesktopScanProgress {
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
    local_job: Option<&mut DesktopScanJob>,
    registry_job_id: Option<&str>,
    updater: F,
) -> Result<(), String>
where
    F: Fn(&mut DesktopScanJob),
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

fn jobs() -> &'static Mutex<HashMap<String, DesktopScanJob>> {
    SCAN_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}


