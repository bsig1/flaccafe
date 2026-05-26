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
    mut local_job: Option<&mut DesktopScanJob>,
    registry_job_id: Option<&str>,
) -> Result<DesktopScanResult, String> {
    let mut stats = DesktopScanResult {
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
        errors: request.errors.clone(),
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
        super::refresh_library_derived_data(&connection)?;
    }
    update_job(local_job.as_deref_mut(), registry_job_id, |job| {
        job.status = "completed".to_string();
        job.processed_files = total_files;
        job.current_path = None;
        job.finished_at = Some(utc_now());
    })?;
    Ok(stats)
}

