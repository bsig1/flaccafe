fn run_audio_conversion_thread(job_id: String, ffmpeg_path: PathBuf) {
    let result = run_audio_conversion(&job_id, &ffmpeg_path);
    let mut jobs = match audio_jobs().lock() {
        Ok(jobs) => jobs,
        Err(_) => return,
    };
    if let Some(job) = jobs.get_mut(&job_id) {
        match result {
            Ok(()) if job.status != "canceled" => {
                job.status = "completed".to_string();
                job.phase = "completed".to_string();
                job.message = Some(format!(
                    "Converted {} track{}.",
                    job.converted,
                    if job.converted == 1 { "" } else { "s" }
                ));
                job.current_track = None;
                job.finished_at = Some(utc_now());
                job.error = None;
            }
            Ok(()) => {}
            Err(error) => {
                job.status = "failed".to_string();
                job.phase = "failed".to_string();
                job.message = Some(error.clone());
                job.error = Some(error);
                job.current_track = None;
                job.finished_at = Some(utc_now());
            }
        }
    }
}

fn run_audio_conversion(job_id: &str, ffmpeg_path: &Path) -> Result<(), String> {
    let request = update_audio_job(job_id, |job| job.request.clone())?;
    let connection = open_database()?;
    let library_root = get_setting(&connection, "library_path").map(PathBuf::from);
    let tracks = selected_tracks(&connection, request.track_ids.as_deref(), request.limit)?;
    drop(connection);
    update_audio_job(job_id, |job| {
        job.status = "running".to_string();
        job.phase = "transcoding".to_string();
        job.total_tracks = tracks.len() as i64;
        job.message = Some(format!(
            "Converting {} track{}.",
            tracks.len(),
            if tracks.len() == 1 { "" } else { "s" }
        ));
    })?;

    for (index, track) in tracks.iter().enumerate() {
        if update_audio_job(job_id, |job| job.cancel_requested)? {
            update_audio_job(job_id, |job| {
                job.status = "canceled".to_string();
                job.phase = "canceled".to_string();
                job.message = Some("Conversion canceled.".to_string());
                job.current_track = None;
                job.finished_at = Some(utc_now());
            })?;
            return Ok(());
        }

        let source = PathBuf::from(&track.path);
        let target = conversion_target_path(
            track,
            &request.target_folder,
            &request.output_format,
            request.preserve_structure,
            library_root.as_deref(),
        );
        update_audio_job(job_id, |job| {
            job.current_track = Some(track.title.clone().unwrap_or_else(|| track.path.clone()));
            job.message = Some(format!("Converting {} of {}", index + 1, tracks.len()));
        })?;

        let outcome = match convert_one_track(job_id, ffmpeg_path, &request, &source, &target) {
            Ok(ConvertStatus::Converted) => {
                copy_converted_artwork_if_needed(&request, &source, &target)
            }
            Ok(ConvertStatus::Canceled) => {
                mark_audio_conversion_canceled(job_id, "Conversion canceled.")?;
                return Ok(());
            }
            Err(error) => Err(error),
        };
        update_audio_job(job_id, |job| {
            match outcome {
                Ok(artwork_warning) => {
                    job.converted += 1;
                    if let Some(warning) = artwork_warning {
                        job.errors.push(warning);
                    }
                }
                Err(error) => {
                    job.skipped += 1;
                    let name = source
                        .file_name()
                        .and_then(|value| value.to_str())
                        .map(str::to_string)
                        .unwrap_or_else(|| source.to_string_lossy().to_string());
                    job.errors.push(format!("{name}: {error}"));
                }
            }
            if job.errors.len() > 50 {
                let excess = job.errors.len() - 50;
                job.errors.drain(0..excess);
            }
            job.processed_tracks = (index + 1) as i64;
        })?;
    }
    Ok(())
}

fn convert_one_track(
    job_id: &str,
    ffmpeg_path: &Path,
    request: &ConversionRequest,
    source: &Path,
    target: &Path,
) -> Result<ConvertStatus, String> {
    if update_audio_job(job_id, |job| job.cancel_requested)? {
        return Ok(ConvertStatus::Canceled);
    }
    if !source.is_file() {
        return Err("Source file is missing".to_string());
    }
    if target.exists() && !request.overwrite {
        return Err("target exists".to_string());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create target folder: {error}"))?;
    }
    let args = ffmpeg_args(source, target, request);
    let mut command = std::process::Command::new(ffmpeg_path);
    command
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start FFmpeg: {error}"))?;
    let output = loop {
        if update_audio_job(job_id, |job| job.cancel_requested)? {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_file(target);
            return Ok(ConvertStatus::Canceled);
        }
        if child
            .try_wait()
            .map_err(|error| format!("Could not poll FFmpeg: {error}"))?
            .is_some()
        {
            break child
                .wait_with_output()
                .map_err(|error| format!("Could not collect FFmpeg output: {error}"))?;
        }
        thread::sleep(std::time::Duration::from_millis(100));
    };
    if output.status.success() {
        Ok(ConvertStatus::Converted)
    } else {
        let text = String::from_utf8_lossy(if output.stderr.is_empty() {
            &output.stdout
        } else {
            &output.stderr
        });
        let tail = text
            .chars()
            .rev()
            .take(1200)
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>();
        Err(if tail.trim().is_empty() {
            format!("FFmpeg exited with {:?}", output.status.code())
        } else {
            tail.trim().to_string()
        })
    }
}

fn ffmpeg_args(source: &Path, target: &Path, request: &ConversionRequest) -> Vec<String> {
    let mut args = vec![
        "-hide_banner".to_string(),
        if request.overwrite { "-y" } else { "-n" }.to_string(),
        "-i".to_string(),
        source.to_string_lossy().to_string(),
        "-map".to_string(),
        "0:a:0".to_string(),
        "-vn".to_string(),
        "-map_metadata".to_string(),
        if request.copy_tags { "0" } else { "-1" }.to_string(),
    ];
    if request.normalize_volume {
        args.extend([
            "-af".to_string(),
            "loudnorm=I=-16:TP=-1.5:LRA=11".to_string(),
        ]);
    }
    args.extend(audio_codec_args(
        &request.output_format,
        request.bitrate_kbps,
    ));
    if let Some(sample_rate) = request.sample_rate_hz {
        args.extend(["-ar".to_string(), sample_rate.to_string()]);
    }
    args.push(target.to_string_lossy().to_string());
    args
}

fn audio_codec_args(output_format: &str, bitrate_kbps: Option<i64>) -> Vec<String> {
    match output_format {
        "flac" => vec!["-c:a".to_string(), "flac".to_string()],
        "mp3" => vec![
            "-c:a".to_string(),
            "libmp3lame".to_string(),
            "-b:a".to_string(),
            format!("{}k", bitrate_kbps.unwrap_or(320)),
        ],
        "m4a" => vec![
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            format!("{}k", bitrate_kbps.unwrap_or(256)),
        ],
        "opus" => vec![
            "-c:a".to_string(),
            "libopus".to_string(),
            "-b:a".to_string(),
            format!("{}k", bitrate_kbps.unwrap_or(160)),
        ],
        "wav" => vec!["-c:a".to_string(), "pcm_s16le".to_string()],
        _ => Vec::new(),
    }
}

fn copy_converted_artwork_if_needed(
    request: &ConversionRequest,
    source: &Path,
    target: &Path,
) -> Result<Option<String>, String> {
    if !request.copy_artwork || request.output_format == "wav" {
        return Ok(None);
    }
    match super::metadata::read_embedded_artwork(source)? {
        Some((bytes, media_type)) => {
            match super::metadata::write_embedded_artwork(target, bytes, &media_type) {
                Ok(()) => Ok(None),
                Err(error) => Ok(Some(format!(
                    "{}: converted, but artwork copy failed: {error}",
                    source
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or("track")
                ))),
            }
        }
        None => Ok(None),
    }
}

pub(crate) fn install_ffmpeg_blocking(body: JsonValue) -> Result<DesktopToolSetupResponse, String> {
    let source_url = body_string(&body, "source_url")
        .or_else(|| body_string(&body, "sourceUrl"))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| FFMPEG_WINDOWS_URL.to_string());
    let job_id = new_install_job_id();
    let job = FfmpegInstallJob {
        job_id: job_id.clone(),
        source_url,
        status: "running".to_string(),
        message: "Installing FFmpeg...".to_string(),
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
    install_jobs()
        .lock()
        .map_err(|_| "FFmpeg install job registry is unavailable".to_string())?
        .insert(job_id.clone(), job);
    let archive_path = ffmpeg_tool_dir().join("ffmpeg-release-essentials.zip");
    let install_result = run_ffmpeg_install(&job_id, &archive_path);
    {
        let mut jobs = install_jobs()
            .lock()
            .map_err(|_| "FFmpeg install job registry is unavailable".to_string())?;
        if let Some(job) = jobs.get_mut(&job_id) {
            match &install_result {
                Ok(()) => {
                    job.status = "completed".to_string();
                    job.message = "FFmpeg was installed for FLAC Cafe.".to_string();
                    job.current_step = job.total_steps;
                    job.finished_at = Some(utc_now());
                }
                Err(error) => {
                    job.status = "failed".to_string();
                    job.message = "Could not install FFmpeg automatically.".to_string();
                    job.error = Some(error.clone());
                    job.finished_at = Some(utc_now());
                }
            }
        }
    }
    let mut status = super::tools::ffmpeg_setup_status()?;
    if let Err(error) = install_result {
        status.message = "Could not install FFmpeg automatically.".to_string();
        status.errors.push(error);
    } else {
        status.message = "FFmpeg was installed for FLAC Cafe.".to_string();
    }
    Ok(status)
}

fn audio_jobs() -> &'static Mutex<std::collections::HashMap<String, AudioConversionJob>> {
    AUDIO_CONVERSION_JOBS.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

fn update_audio_job<T>(
    job_id: &str,
    update: impl FnOnce(&mut AudioConversionJob) -> T,
) -> Result<T, String> {
    let mut jobs = audio_jobs()
        .lock()
        .map_err(|_| "Audio conversion job registry is unavailable".to_string())?;
    let job = jobs
        .get_mut(job_id)
        .ok_or_else(|| "Audio conversion job not found".to_string())?;
    Ok(update(job))
}

fn mark_audio_conversion_canceled(job_id: &str, message: &str) -> Result<(), String> {
    update_audio_job(job_id, |job| {
        job.status = "canceled".to_string();
        job.phase = "canceled".to_string();
        job.message = Some(message.to_string());
        job.current_track = None;
        job.finished_at = Some(utc_now());
    })
}

fn new_audio_conversion_job_id() -> String {
    let counter = AUDIO_CONVERSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = OffsetDateTime::now_utc().unix_timestamp_nanos();
    format!("convert-{now:x}-{counter:x}")
}

