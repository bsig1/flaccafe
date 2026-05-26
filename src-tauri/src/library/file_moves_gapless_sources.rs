fn artist_cache_key(value: &str) -> String {
    format!("v3:{}", primary_artist_name(value).to_lowercase())
}

#[tauri::command]
pub fn bulk_file_move_preview(
    moves: Vec<(String, String)>,
    apply: Option<bool>,
) -> Result<DesktopBulkFileMoveResponse, String> {
    let apply = apply.unwrap_or(false);
    let mut rows = Vec::new();
    let mut applied = 0i64;
    for (source, target) in moves {
        let source_path = PathBuf::from(source.trim());
        let target_path = PathBuf::from(target.trim());
        let changed = normalized_path_key(&source_path.to_string_lossy())
            != normalized_path_key(&target_path.to_string_lossy());
        let mut row = DesktopBulkFileMove {
            source_path: source_path.to_string_lossy().to_string(),
            target_path: target_path.to_string_lossy().to_string(),
            changed,
            applied: false,
            error: None,
        };
        if apply && changed {
            if let Some(parent) = target_path.parent() {
                if let Err(error) = std::fs::create_dir_all(parent) {
                    row.error = Some(format!("Could not create {}: {error}", parent.display()));
                }
            }
            if row.error.is_none() {
                match std::fs::rename(&source_path, &target_path) {
                    Ok(()) => {
                        row.applied = true;
                        applied += 1;
                    }
                    Err(error) => row.error = Some(format!("Could not move file: {error}")),
                }
            }
        }
        rows.push(row);
    }
    let changed = rows.iter().filter(|row| row.changed).count() as i64;
    Ok(DesktopBulkFileMoveResponse {
        total: rows.len() as i64,
        changed,
        applied,
        moves: rows,
    })
}

fn gapless_shape(track: &DesktopTrack) -> DesktopGaplessAudioShape {
    let codec = Path::new(&track.path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase());
    let sample_rate = None;
    let estimated_samples = None;
    DesktopGaplessAudioShape {
        codec,
        sample_rate,
        channels: None,
        bits_per_sample: None,
        duration_seconds: track.duration_seconds,
        estimated_samples,
        error: None,
    }
}

#[tauri::command]
pub fn gapless_validate(
    _state: State<'_, DesktopLibraryState>,
    track_ids: Option<Vec<i64>>,
    album_id: Option<i64>,
    limit: Option<usize>,
) -> Result<DesktopGaplessValidationResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(200).clamp(2, 1000);
    let tracks = if let Some(album_id) = album_id {
        album_tracks_by_id(&connection, album_id)?
    } else {
        select_tracks_by_ids_or_limit(&connection, track_ids, limit)?
    };
    let tracks: Vec<DesktopTrack> = tracks.into_iter().take(limit).collect();
    let mut pairs = Vec::new();
    for window in tracks.windows(2) {
        let left = &window[0];
        let right = &window[1];
        let left_shape = gapless_shape(left);
        let right_shape = gapless_shape(right);
        let metadata_compatible =
            left_shape.codec.is_some() && left_shape.codec == right_shape.codec;
        let lossless_like = matches!(
            left_shape.codec.as_deref(),
            Some("flac" | "wav" | "aiff" | "aif")
        );
        let sample_accurate_ready = metadata_compatible
            && lossless_like
            && left.duration_seconds.is_some()
            && right.duration_seconds.is_some();
        let warnings = if sample_accurate_ready {
            Vec::new()
        } else if !metadata_compatible {
            vec!["Adjacent files use different container/codec extensions.".to_string()]
        } else {
            vec!["Rust validation can schedule this pair, but exact sample metadata needs decoder inspection.".to_string()]
        };
        pairs.push(DesktopGaplessPairValidation {
            left_track_id: left.id,
            right_track_id: right.id,
            left_title: left.title.clone(),
            right_title: right.title.clone(),
            left_shape,
            right_shape,
            metadata_compatible,
            sample_accurate_ready,
            warnings,
        });
    }
    let sample_accurate_ready_count = pairs
        .iter()
        .filter(|pair| pair.sample_accurate_ready)
        .count() as i64;
    Ok(DesktopGaplessValidationResponse {
        track_count: tracks.len() as i64,
        pair_count: pairs.len() as i64,
        sample_accurate_ready_count,
        message: if pairs.is_empty() {
            "Need at least two tracks before validating gapless transitions.".to_string()
        } else if sample_accurate_ready_count == pairs.len() as i64 {
            "Rust scheduler sees these transitions as gapless-friendly.".to_string()
        } else {
            "Some adjacent tracks need decoder inspection before claiming sample-accurate gapless playback.".to_string()
        },
        pairs,
    })
}

fn write_setting(connection: &Connection, key: &str, value: Option<&str>) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, value],
    )?;
    Ok(())
}

#[tauri::command]
pub fn remove_library_source(
    _state: State<'_, DesktopLibraryState>,
    path: String,
) -> Result<DesktopLibrarySourceRemoveResponse, String> {
    let mut connection = open_database()?;
    let source = PathBuf::from(path.trim())
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(path.trim()));
    if path.trim().is_empty() {
        return Err("Choose a library source to remove".to_string());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start source removal: {error}"))?;
    let rows = {
        let mut statement = transaction
            .prepare("SELECT id, path, path_key FROM tracks")
            .map_err(|error| format!("Could not read tracks for source removal: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>("id")?,
                    row.get::<_, String>("path")?,
                    row.get::<_, String>("path_key")?,
                ))
            })
            .map_err(|error| format!("Could not query tracks for source removal: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode tracks for source removal: {error}"))?
    };

    let source_rows: Vec<(i64, String, String)> = rows
        .into_iter()
        .filter(|(_, track_path, _)| path_under_source(track_path, &source))
        .collect();
    let mut removed_metadata_cache = 0i64;
    let mut removed_artwork_cache = 0i64;
    for (track_id, _, path_key) in &source_rows {
        removed_metadata_cache += transaction
            .execute(
                "DELETE FROM track_metadata_cache WHERE path_key = ?",
                params![path_key],
            )
            .unwrap_or(0) as i64;
        removed_artwork_cache += transaction
            .execute(
                "DELETE FROM artwork_cache WHERE path_key = ?",
                params![path_key],
            )
            .unwrap_or(0) as i64;
        transaction
            .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
            .map_err(|error| format!("Could not remove source track {track_id}: {error}"))?;
    }
    if !source_rows.is_empty() {
        transaction
            .execute(
                "DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL)",
                [],
            )
            .ok();
        transaction
            .execute("DELETE FROM library_query_cache", [])
            .ok();
    }

    let removed_key = source.to_string_lossy().to_lowercase();
    let remaining_sources: Vec<String> = read_library_paths(&transaction)
        .into_iter()
        .filter(|candidate| normalized_path_key(candidate) != removed_key)
        .collect();
    let primary = remaining_sources.first().map(String::as_str);
    write_setting(&transaction, "library_path", primary)
        .map_err(|error| format!("Could not update library source settings: {error}"))?;
    let paths_json = serde_json::to_string(&remaining_sources).unwrap_or_else(|_| "[]".to_string());
    write_setting(&transaction, "library_paths_json", Some(&paths_json))
        .map_err(|error| format!("Could not update library source settings: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit source removal: {error}"))?;

    let removed_tracks = source_rows.len() as i64;
    Ok(DesktopLibrarySourceRemoveResponse {
        path: source.to_string_lossy().to_string(),
        library_paths: remaining_sources,
        removed_tracks,
        removed_metadata_cache,
        removed_artwork_cache,
        message: format!(
            "Removed {removed_tracks} track{} from FLAC Cafe. Audio files were not deleted from disk.",
            if removed_tracks == 1 { "" } else { "s" }
        ),
    })
}

