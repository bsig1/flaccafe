fn build_scan_plans(request: &ScanRequest) -> Result<Vec<FolderPlan>, String> {
    let mut plans = Vec::new();
    let files = request.files.clone();
    let existing_states = load_existing_track_states()?;
    for folder in &request.paths {
        if !folder.exists() || !folder.is_dir() {
            return Err(format!("Folder does not exist: {}", folder.display()));
        }
        let files = if let Some(files) = &files {
            files
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

pub(crate) fn discover_audio_files(folder: &Path) -> Result<Vec<AudioSnapshot>, String> {
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

pub(crate) fn read_metadata_batch(files: &[AudioSnapshot]) -> Result<Vec<JsonValue>, String> {
    Ok(super::metadata::read_scan_metadata_results(files))
}

