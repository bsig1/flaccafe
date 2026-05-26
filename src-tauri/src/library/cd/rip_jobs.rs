pub fn start_cd_rip(body: JsonValue) -> Result<JsonValue, String> {
    let drive_id = json_string(&body, "drive_id")
        .or_else(|| json_string(&body, "driveId"))
        .and_then(|value| normalize_drive_id(&value))
        .ok_or_else(|| "Choose a CD drive first.".to_string())?;
    if !active_playback_drive_ids().is_empty() {
        return Err("Stop CD playback before ripping from this drive.".to_string());
    }
    let output_folder = json_string(&body, "output_folder")
        .or_else(|| json_string(&body, "outputFolder"))
        .ok_or_else(|| "Output folder is required".to_string())?;
    let output_format = json_string(&body, "output_format")
        .or_else(|| json_string(&body, "outputFormat"))
        .unwrap_or_else(|| "flac".to_string());
    let job_id = format!(
        "cd-rip-{}",
        OffsetDateTime::now_utc().unix_timestamp_nanos()
    );
    let job = CdRipJob {
        job_id: job_id.clone(),
        drive_id: drive_id.clone(),
        output_folder: output_folder.clone(),
        output_format: output_format.clone(),
        status: "pending".to_string(),
        phase: "queued".to_string(),
        message: Some("Waiting to start".to_string()),
        total_tracks: 0,
        processed_tracks: 0,
        ripped_tracks: 0,
        skipped_tracks: 0,
        current_track: None,
        errors: Vec::new(),
        log: Vec::new(),
        verification: Vec::new(),
        started_at: utc_now(),
        finished_at: None,
        started_instant: Instant::now(),
        cancel_requested: false,
        error: None,
    };
    let response = job.snapshot();
    rip_jobs()
        .lock()
        .map_err(|_| "CD rip job registry is unavailable".to_string())?
        .insert(job_id.clone(), job);
    thread::spawn(move || run_cd_rip_job(job_id, body));
    Ok(json!({
        "job_id": response.get("job_id").cloned().unwrap_or_else(|| json!("")),
        "status": response.get("status").cloned().unwrap_or_else(|| json!("pending")),
    }))
}

fn update_job(job_id: &str, update: impl FnOnce(&mut CdRipJob)) {
    if let Ok(mut jobs) = rip_jobs().lock() {
        if let Some(job) = jobs.get_mut(job_id) {
            update(job);
        }
    }
}

fn run_cd_rip_job(job_id: String, body: JsonValue) {
    let result = run_cd_rip_job_inner(&job_id, &body);
    update_job(&job_id, |job| {
        if let Err(error) = result {
            job.status = "failed".to_string();
            job.phase = "failed".to_string();
            job.message = Some(error.clone());
            job.error = Some(error);
            job.current_track = None;
            job.finished_at = Some(utc_now());
        } else if job.status != "canceled" {
            job.status = "completed".to_string();
            job.phase = "completed".to_string();
            job.message = Some(format!(
                "Ripped {} track{}.",
                job.ripped_tracks,
                if job.ripped_tracks == 1 { "" } else { "s" }
            ));
            job.current_track = None;
            job.finished_at = Some(utc_now());
        }
    });
}

fn run_cd_rip_job_inner(job_id: &str, body: &JsonValue) -> Result<(), String> {
    let drive_id = json_string(body, "drive_id")
        .or_else(|| json_string(body, "driveId"))
        .and_then(|value| normalize_drive_id(&value))
        .ok_or_else(|| "Choose a CD drive first.".to_string())?;
    let output_format = json_string(body, "output_format")
        .or_else(|| json_string(body, "outputFormat"))
        .unwrap_or_else(|| "flac".to_string());
    let overwrite = json_bool(body, "overwrite").unwrap_or(false);
    let verify = json_bool(body, "verify").unwrap_or(true);
    let track_numbers = selected_track_numbers(body, &drive_id)?;
    let ffmpeg_path = if output_format == "wav" {
        None
    } else {
        tools::resolved_ffmpeg_tool_path()?.0
    };
    if output_format != "wav" && ffmpeg_path.is_none() {
        return Err("FFmpeg is required to encode ripped CD audio to FLAC or MP3.".to_string());
    }
    update_job(job_id, |job| {
        job.status = "running".to_string();
        job.phase = "ripping".to_string();
        job.total_tracks = track_numbers.len() as i64;
        job.message = Some(format!(
            "Ripping {} CD track{}.",
            track_numbers.len(),
            if track_numbers.len() == 1 { "" } else { "s" }
        ));
        job.log
            .push("Using Windows CDDA raw reads for extraction.".to_string());
    });
    let work_dir = PathBuf::from(
        json_string(body, "output_folder")
            .or_else(|| json_string(body, "outputFolder"))
            .unwrap_or_else(|| ".".to_string()),
    )
    .join(".flac-cafe-rip-work");
    fs::create_dir_all(&work_dir)
        .map_err(|error| format!("Could not create rip work folder: {error}"))?;
    for (index, track_number) in track_numbers.iter().enumerate() {
        let canceled = rip_jobs()
            .lock()
            .ok()
            .and_then(|jobs| jobs.get(job_id).map(|job| job.cancel_requested))
            .unwrap_or(false);
        if canceled {
            update_job(job_id, |job| {
                job.status = "canceled".to_string();
                job.phase = "canceled".to_string();
                job.message = Some("CD rip canceled.".to_string());
                job.finished_at = Some(utc_now());
                job.current_track = None;
            });
            return Ok(());
        }
        update_job(job_id, |job| {
            job.current_track = Some(format!("Track {track_number:02}"));
            job.message = Some(format!(
                "Ripping track {} of {}",
                index + 1,
                track_numbers.len()
            ));
        });
        let track = track_metadata(body, *track_number);
        let target = cd_target_path(body, &track)?;
        let wav_path = work_dir.join(format!("{job_id}-track-{track_number:02}.wav"));
        let mut skipped = false;
        let track_result = (|| {
            if target.exists() && !overwrite {
                skipped = true;
                return Err(format!("{}: target exists", target.display()));
            }
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not create target folder: {error}"))?;
            }
            let log = rip_track_to_wav(&drive_id, *track_number, &wav_path)?;
            update_job(job_id, |job| job.log.push(log));
            if output_format == "wav" {
                if target.exists() && overwrite {
                    let _ = fs::remove_file(&target);
                }
                fs::rename(&wav_path, &target)
                    .map_err(|error| format!("Could not move WAV target: {error}"))?;
            } else if let Some(ffmpeg) = ffmpeg_path.as_deref() {
                encode_track(ffmpeg, &wav_path, &target, body, &track)?;
                let _ = fs::remove_file(&wav_path);
            }
            if verify {
                let hash = sha256_file(&target)?;
                let bytes = fs::metadata(&target)
                    .map(|metadata| metadata.len())
                    .unwrap_or(0);
                update_job(job_id, |job| {
                    job.verification.push(json!({
                        "track_number": track_number,
                        "path": target.to_string_lossy().to_string(),
                        "sha256": hash,
                        "bytes": bytes,
                        "accuraterip_checked": false,
                        "accuraterip_match": JsonValue::Null,
                        "message": "Local SHA-256 verification written.",
                    }));
                });
            }
            Ok(())
        })();
        update_job(job_id, |job| {
            job.processed_tracks = index as i64 + 1;
            match track_result {
                Ok(()) => job.ripped_tracks += 1,
                Err(error) => {
                    job.skipped_tracks += 1;
                    if skipped {
                        job.errors.push(error);
                    } else {
                        job.errors.push(format!("Track {track_number:02}: {error}"));
                    }
                }
            }
        });
    }
    let _ = fs::remove_dir(&work_dir);
    Ok(())
}

pub fn cd_rip_progress(job_id: String) -> Result<JsonValue, String> {
    rip_jobs()
        .lock()
        .map_err(|_| "CD rip job registry is unavailable".to_string())?
        .get(&job_id)
        .map(CdRipJob::snapshot)
        .ok_or_else(|| "CD rip job not found".to_string())
}

pub fn cancel_cd_rip(job_id: String) -> Result<JsonValue, String> {
    let mut jobs = rip_jobs()
        .lock()
        .map_err(|_| "CD rip job registry is unavailable".to_string())?;
    let job = jobs
        .get_mut(&job_id)
        .ok_or_else(|| "CD rip job not found".to_string())?;
    if !matches!(job.status.as_str(), "completed" | "failed" | "canceled") {
        job.cancel_requested = true;
        job.status = "canceling".to_string();
        job.phase = "canceling".to_string();
        job.message = Some("Cancel requested. The current track will finish first.".to_string());
    }
    Ok(job.snapshot())
}

