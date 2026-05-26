fn resolved_ffmpeg_path() -> Result<Option<PathBuf>, String> {
    let connection = open_database()?;
    let configured = get_setting(&connection, "ffmpeg_path");
    let executable = if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let mut candidates = Vec::new();
    if let Some(configured) = configured
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        let path = PathBuf::from(configured.trim());
        candidates.push(if path.is_dir() {
            path.join(executable)
        } else {
            path
        });
    }
    candidates.push(ffmpeg_tool_dir().join(executable));
    candidates.push(app_storage_root().join("tools").join(executable));
    if let Some(paths) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&paths).map(|path| path.join(executable)));
    }
    Ok(candidates
        .into_iter()
        .find(|path| path.is_file())
        .map(|path| path.canonicalize().unwrap_or(path)))
}

impl AudioConversionJob {
    fn snapshot(&self) -> DesktopAudioConversionProgress {
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
        DesktopAudioConversionProgress {
            job_id: self.job_id.clone(),
            target_folder: self.request.target_folder.to_string_lossy().to_string(),
            output_format: self.request.output_format.clone(),
            status: self.status.clone(),
            phase: Some(self.phase.clone()),
            message: self.message.clone(),
            total_tracks: self.total_tracks,
            processed_tracks: self.processed_tracks,
            converted: self.converted,
            skipped: self.skipped,
            errors: self
                .errors
                .iter()
                .rev()
                .take(50)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect(),
            current_track: self.current_track.clone(),
            started_at: self.started_at.clone(),
            finished_at: self.finished_at.clone(),
            elapsed_seconds,
            eta_seconds,
            percent,
            error: self.error.clone(),
        }
    }
}

pub(crate) fn start_ffmpeg_install(
    body: JsonValue,
) -> Result<DesktopAudioConversionInstallProgress, String> {
    let source_url = body_string(&body, "source_url")
        .or_else(|| body_string(&body, "sourceUrl"))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| FFMPEG_WINDOWS_URL.to_string());
    let job_id = new_install_job_id();
    let job = FfmpegInstallJob {
        job_id: job_id.clone(),
        source_url,
        status: "pending".to_string(),
        message: "Waiting to install FFmpeg.".to_string(),
        current_step: 0,
        total_steps: 3,
        bytes_downloaded: 0,
        total_bytes: None,
        tool_directory: ffmpeg_tool_dir().to_string_lossy().to_string(),
        log: Vec::new(),
        started_at: utc_now(),
        finished_at: None,
        started_instant: Instant::now(),
        error: None,
    };
    let response = job.snapshot();
    install_jobs()
        .lock()
        .map_err(|_| "FFmpeg install job registry is unavailable".to_string())?
        .insert(job_id.clone(), job);
    thread::spawn(move || run_ffmpeg_install_thread(job_id));
    Ok(response)
}

pub(crate) fn ffmpeg_install_progress(
    job_id: String,
) -> Result<DesktopAudioConversionInstallProgress, String> {
    let jobs = install_jobs()
        .lock()
        .map_err(|_| "FFmpeg install job registry is unavailable".to_string())?;
    jobs.get(&job_id)
        .map(FfmpegInstallJob::snapshot)
        .ok_or_else(|| "FFmpeg install job not found".to_string())
}

fn run_ffmpeg_install_thread(job_id: String) {
    let archive_path = ffmpeg_tool_dir().join("ffmpeg-release-essentials.zip");
    let result = run_ffmpeg_install(&job_id, &archive_path);
    let mut jobs = match install_jobs().lock() {
        Ok(jobs) => jobs,
        Err(_) => return,
    };
    if let Some(job) = jobs.get_mut(&job_id) {
        match result {
            Ok(()) => {
                job.status = "completed".to_string();
                job.message = "FFmpeg was installed for FLAC Cafe.".to_string();
                job.current_step = job.total_steps;
                job.finished_at = Some(utc_now());
                job.error = None;
            }
            Err(error) => {
                let _ = fs::remove_file(&archive_path);
                job.status = "failed".to_string();
                job.message = "Could not install FFmpeg automatically.".to_string();
                job.error = Some(format!("{error} Source: {}", job.source_url));
                job.finished_at = Some(utc_now());
            }
        }
    }
}

fn run_ffmpeg_install(job_id: &str, archive_path: &Path) -> Result<(), String> {
    if !cfg!(windows) {
        return Err(
            "Guided FFmpeg install is currently Windows-only. Save an ffmpeg path instead."
                .to_string(),
        );
    }
    let tool_dir = ffmpeg_tool_dir();
    fs::create_dir_all(&tool_dir)
        .map_err(|error| format!("Could not create FFmpeg tool folder: {error}"))?;
    let source_url = update_install_job(job_id, |job| {
        job.status = "running".to_string();
        job.message = "Preparing FFmpeg install...".to_string();
        job.source_url.clone()
    })?;
    download_ffmpeg_archive(job_id, &source_url, archive_path)?;
    extract_ffmpeg_tools(job_id, archive_path, &tool_dir)?;
    configure_ffmpeg_path(job_id, &tool_dir)?;
    let _ = fs::remove_file(archive_path);
    Ok(())
}

fn download_ffmpeg_archive(
    job_id: &str,
    source_url: &str,
    archive_path: &Path,
) -> Result<(), String> {
    update_install_job(job_id, |job| {
        job.current_step = 1;
        job.message = "Downloading FFmpeg essentials...".to_string();
    })?;
    let response = ureq::get(source_url)
        .set("User-Agent", "FLAC-Cafe")
        .timeout(std::time::Duration::from_secs(180))
        .call()
        .map_err(|error| format!("Could not download FFmpeg: {error}"))?;
    let total_bytes = response
        .header("Content-Length")
        .and_then(|value| value.parse::<i64>().ok());
    update_install_job(job_id, |job| {
        job.total_bytes = total_bytes;
    })?;
    let mut reader = response.into_reader();
    let mut target = fs::File::create(archive_path)
        .map_err(|error| format!("Could not create FFmpeg archive: {error}"))?;
    let mut buffer = vec![0u8; DOWNLOAD_CHUNK_SIZE];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|error| format!("Could not read FFmpeg download: {error}"))?;
        if read == 0 {
            break;
        }
        target
            .write_all(&buffer[..read])
            .map_err(|error| format!("Could not write FFmpeg archive: {error}"))?;
        update_install_job(job_id, |job| {
            job.bytes_downloaded += read as i64;
            let downloaded_mb = job.bytes_downloaded as f64 / 1_048_576.0;
            job.message = if let Some(total) = job.total_bytes {
                format!(
                    "Downloading FFmpeg essentials ({downloaded_mb:.1} / {:.1} MB)...",
                    total as f64 / 1_048_576.0
                )
            } else {
                format!("Downloading FFmpeg essentials ({downloaded_mb:.1} MB)...")
            };
        })?;
    }
    Ok(())
}

fn extract_ffmpeg_tools(job_id: &str, archive_path: &Path, tool_dir: &Path) -> Result<(), String> {
    update_install_job(job_id, |job| {
        job.current_step = 2;
        job.message = "Extracting FFmpeg tools...".to_string();
    })?;
    let file = fs::File::open(archive_path)
        .map_err(|error| format!("Could not open FFmpeg archive: {error}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("Downloaded FFmpeg archive was not readable: {error}"))?;
    let mut members = std::collections::HashMap::new();
    for index in 0..archive.len() {
        let name = archive
            .by_index(index)
            .map_err(|error| format!("Could not inspect FFmpeg archive: {error}"))?
            .name()
            .to_string();
        if let Some(file_name) = Path::new(&name)
            .file_name()
            .and_then(|value| value.to_str())
        {
            members.insert(file_name.to_ascii_lowercase(), index);
        }
    }
    if !members.contains_key("ffmpeg.exe") {
        return Err("Downloaded archive did not contain ffmpeg.exe".to_string());
    }
    for executable in ["ffmpeg.exe", "ffprobe.exe", "ffplay.exe"] {
        let Some(index) = members.get(executable).copied() else {
            continue;
        };
        update_install_job(job_id, |job| {
            job.log.push(format!("Extracting {executable}"));
            if job.log.len() > 200 {
                let excess = job.log.len() - 200;
                job.log.drain(0..excess);
            }
        })?;
        let mut source = archive
            .by_index(index)
            .map_err(|error| format!("Could not read {executable} from archive: {error}"))?;
        let mut target = fs::File::create(tool_dir.join(executable))
            .map_err(|error| format!("Could not create {executable}: {error}"))?;
        std::io::copy(&mut source, &mut target)
            .map_err(|error| format!("Could not extract {executable}: {error}"))?;
    }
    Ok(())
}

fn configure_ffmpeg_path(job_id: &str, tool_dir: &Path) -> Result<(), String> {
    let ffmpeg_path = tool_dir.join("ffmpeg.exe");
    if !ffmpeg_path.is_file() {
        return Err("FFmpeg was extracted, but ffmpeg.exe was missing.".to_string());
    }
    update_install_job(job_id, |job| {
        job.current_step = 3;
        job.message = "Saving FFmpeg path...".to_string();
    })?;
    let connection = open_database()?;
    set_setting(
        &connection,
        "ffmpeg_path",
        Some(ffmpeg_path.to_string_lossy().as_ref()),
    )?;
    Ok(())
}

fn install_jobs() -> &'static Mutex<std::collections::HashMap<String, FfmpegInstallJob>> {
    FFMPEG_INSTALL_JOBS.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

fn update_install_job<T>(
    job_id: &str,
    update: impl FnOnce(&mut FfmpegInstallJob) -> T,
) -> Result<T, String> {
    let mut jobs = install_jobs()
        .lock()
        .map_err(|_| "FFmpeg install job registry is unavailable".to_string())?;
    let job = jobs
        .get_mut(job_id)
        .ok_or_else(|| "FFmpeg install job not found".to_string())?;
    Ok(update(job))
}

fn new_install_job_id() -> String {
    let counter = FFMPEG_INSTALL_COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = OffsetDateTime::now_utc().unix_timestamp_nanos();
    format!("ffmpeg-{now:x}-{counter:x}")
}

fn ffmpeg_tool_dir() -> PathBuf {
    app_storage_root().join("tools").join("ffmpeg")
}

fn utc_now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

impl FfmpegInstallJob {
    fn snapshot(&self) -> DesktopAudioConversionInstallProgress {
        let elapsed_seconds = self.started_instant.elapsed().as_secs_f64();
        DesktopAudioConversionInstallProgress {
            job_id: self.job_id.clone(),
            status: self.status.clone(),
            message: self.message.clone(),
            current_step: self.current_step,
            total_steps: self.total_steps,
            bytes_downloaded: self.bytes_downloaded,
            total_bytes: self.total_bytes,
            download_url: Some(self.source_url.clone()),
            tool_directory: self.tool_directory.clone(),
            log: self
                .log
                .iter()
                .rev()
                .take(80)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect(),
            started_at: Some(self.started_at.clone()),
            finished_at: self.finished_at.clone(),
            elapsed_seconds,
            percent: self.percent(),
            error: self.error.clone(),
        }
    }

    fn percent(&self) -> f64 {
        if self.status == "completed" {
            return 100.0;
        }
        if self.current_step <= 0 {
            return 1.0;
        }
        match self.current_step {
            1 => {
                if let Some(total) = self.total_bytes.filter(|value| *value > 0) {
                    (5.0 + (self.bytes_downloaded as f64 / total as f64) * 77.0).min(82.0)
                } else {
                    (5.0 + (self.bytes_downloaded as f64 / DOWNLOAD_CHUNK_SIZE as f64) * 2.0)
                        .min(75.0)
                }
            }
            2 => 88.0,
            3 => 96.0,
            _ => ((self.current_step as f64 / self.total_steps.max(1) as f64) * 100.0).min(99.0),
        }
    }
}
