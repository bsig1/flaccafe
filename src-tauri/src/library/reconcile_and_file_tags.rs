fn is_supported_audio_path(path: &Path, extensions: &HashSet<String>) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extensions.contains(&format!(".{}", extension.to_lowercase())))
        .unwrap_or(false)
}

fn scan_reconcile_folder(
    folder: &Path,
    extensions: &HashSet<String>,
    files: &mut HashMap<String, (String, Option<i64>)>,
    errors: &mut Vec<String>,
) {
    let entries = match std::fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(error) => {
            errors.push(format!("{}: {error}", folder.display()));
            return;
        }
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_reconcile_folder(&path, extensions, files, errors);
        } else if path.is_file() && is_supported_audio_path(&path, extensions) {
            let modified_ms = entry
                .metadata()
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as i64);
            let text = path.to_string_lossy().to_string();
            files.insert(normalized_path_key(&text), (text, modified_ms));
        }
    }
}

fn default_audio_extensions() -> HashSet<String> {
    [
        ".flac", ".mp3", ".m4a", ".ogg", ".opus", ".wav", ".aiff", ".aif",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

#[tauri::command]
pub fn library_reconcile_preview(
    _state: State<'_, DesktopLibraryState>,
    paths: Vec<String>,
    extensions: Option<Vec<String>>,
    sample_limit: Option<usize>,
) -> Result<DesktopLibraryReconcilePreview, String> {
    let started = SystemTime::now();
    let sample_limit = sample_limit.unwrap_or(25).clamp(1, 200);
    let extensions: HashSet<String> = extensions
        .unwrap_or_default()
        .into_iter()
        .map(|extension| {
            let lower = extension.trim().to_lowercase();
            if lower.starts_with('.') {
                lower
            } else {
                format!(".{lower}")
            }
        })
        .filter(|extension| extension.len() > 1)
        .collect::<HashSet<_>>();
    let extensions = if extensions.is_empty() {
        default_audio_extensions()
    } else {
        extensions
    };
    let mut folders = Vec::new();
    let mut scanned = HashMap::<String, (String, Option<i64>)>::new();
    let mut errors = Vec::new();
    for path in paths {
        let folder = PathBuf::from(path.trim());
        if path.trim().is_empty() {
            continue;
        }
        let folder = folder.canonicalize().unwrap_or(folder);
        if !folder.is_dir() {
            errors.push(format!("{} is not a folder", folder.display()));
            continue;
        }
        folders.push(folder.to_string_lossy().to_string());
        scan_reconcile_folder(&folder, &extensions, &mut scanned, &mut errors);
    }
    if folders.is_empty() {
        return Err("Choose at least one source folder".to_string());
    }

    let connection = open_database()?;
    let rows = {
        let mut statement = connection
            .prepare("SELECT path, file_modified_at FROM tracks")
            .map_err(|error| format!("Could not prepare Rust reconcile query: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>("path")?,
                    row.get::<_, Option<String>>("file_modified_at")?,
                ))
            })
            .map_err(|error| format!("Could not read Rust reconcile tracks: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode Rust reconcile tracks: {error}"))?
    };

    let folder_paths: Vec<PathBuf> = folders.iter().map(PathBuf::from).collect();
    let mut database_tracks = 0i64;
    let mut missing_tracks = 0i64;
    let mut modified_tracks = 0i64;
    let mut sample_missing_tracks = Vec::new();
    let mut sample_modified_tracks = Vec::new();
    let mut known_keys = HashSet::new();
    for (track_path, modified_text) in rows {
        let in_scope = folder_paths
            .iter()
            .any(|folder| path_under_source(&track_path, folder));
        if !in_scope {
            continue;
        }
        database_tracks += 1;
        let key = normalized_path_key(&track_path);
        known_keys.insert(key.clone());
        if let Some((_, scanned_modified_ms)) = scanned.get(&key) {
            if let (Some(stored), Some(scanned_ms)) =
                (modified_text.as_deref(), scanned_modified_ms)
            {
                if let Ok(stored_seconds) = stored.parse::<f64>() {
                    let stored_ms = (stored_seconds * 1000.0).round() as i64;
                    if (stored_ms - scanned_ms).abs() > 1500 {
                        modified_tracks += 1;
                        if sample_modified_tracks.len() < sample_limit {
                            sample_modified_tracks.push(track_path.clone());
                        }
                    }
                }
            }
        } else {
            missing_tracks += 1;
            if sample_missing_tracks.len() < sample_limit {
                sample_missing_tracks.push(track_path.clone());
            }
        }
    }
    let sample_new_files: Vec<String> = scanned
        .iter()
        .filter_map(|(key, (path, _))| {
            if known_keys.contains(key) {
                None
            } else {
                Some(path.clone())
            }
        })
        .take(sample_limit)
        .collect();
    let new_files = scanned
        .keys()
        .filter(|key| !known_keys.contains(*key))
        .count() as i64;
    let elapsed_ms = started
        .elapsed()
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    Ok(DesktopLibraryReconcilePreview {
        folders,
        scanned_files: scanned.len() as i64,
        database_tracks,
        new_files,
        missing_tracks,
        modified_tracks,
        sample_new_files,
        sample_missing_tracks,
        sample_modified_tracks,
        elapsed_ms,
        errors,
    })
}

pub(super) fn normalized_path_key(path: &str) -> String {
    let candidate = PathBuf::from(path.trim());
    let resolved = candidate.canonicalize().unwrap_or(candidate);
    resolved.to_string_lossy().to_lowercase()
}

fn path_under_source(path: &str, source: &Path) -> bool {
    let source_key = source.to_string_lossy().to_lowercase();
    let path_key = normalized_path_key(path);
    path_key == source_key
        || path_key.starts_with(&format!("{source_key}\\"))
        || path_key.starts_with(&format!("{source_key}/"))
}

fn read_library_paths(connection: &Connection) -> Vec<String> {
    let raw: Option<String> = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'library_paths_json'",
            [],
            |row| row.get(0),
        )
        .ok();
    if let Some(raw) = raw {
        if let Ok(decoded) = serde_json::from_str::<Vec<String>>(&raw) {
            return decoded
                .into_iter()
                .filter(|path| !path.trim().is_empty())
                .collect();
        }
    }
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'library_path'",
            [],
            |row| row.get(0),
        )
        .ok()
        .into_iter()
        .collect()
}

fn select_tracks_by_ids_or_limit(
    connection: &Connection,
    track_ids: Option<Vec<i64>>,
    limit: usize,
) -> Result<Vec<DesktopTrack>, String> {
    let bounded_limit = limit.clamp(1, 20_000);
    if let Some(ids) = track_ids.filter(|ids| !ids.is_empty()) {
        let placeholders = vec!["?"; ids.len()].join(",");
        let mut params: Vec<Value> = ids.into_iter().map(Value::Integer).collect();
        params.push(Value::Integer(bounded_limit as i64));
        let mut statement = connection
            .prepare(&format!(
                "SELECT {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders}) ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), coalesce(disc_number, 0), coalesce(track_number, 0), lower(coalesce(title, '')) LIMIT ?"
            ))
            .map_err(|error| format!("Could not prepare Rust selected track query: {error}"))?;
        let rows = statement
            .query_map(params_from_iter(params), track_from_row)
            .map_err(|error| format!("Could not read Rust selected tracks: {error}"))?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode Rust selected tracks: {error}"));
    }
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE {music_filter} ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), coalesce(disc_number, 0), coalesce(track_number, 0), lower(coalesce(title, '')) LIMIT ?",
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare Rust track query: {error}"))?;
    let rows = statement
        .query_map(params![bounded_limit as i64], track_from_row)
        .map_err(|error| format!("Could not read Rust tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust tracks: {error}"))
}

fn file_path_root(path: &str) -> String {
    Path::new(path)
        .parent()
        .and_then(Path::parent)
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            Path::new(path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default()
        })
}

fn file_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

fn file_extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string()
}

fn safe_component(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '_'
            } else {
                character
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "Unknown".to_string()
    } else {
        trimmed.to_string()
    }
}

fn padded_number(value: Option<i64>) -> String {
    value
        .map(|number| format!("{number:02}"))
        .unwrap_or_else(|| "00".to_string())
}

fn metadata_write_field_names(include_metadata: bool, include_rating: bool) -> Vec<&'static str> {
    let mut fields = Vec::new();
    if include_metadata {
        fields.extend([
            "title",
            "artist",
            "album",
            "album_artist",
            "track_number",
            "disc_number",
            "genre",
            "year",
        ]);
    }
    if include_rating {
        fields.push("rating");
    }
    fields
}

fn track_database_file_tag_values(track: &DesktopTrack, fields: &[&str]) -> serde_json::Value {
    let mut values = serde_json::Map::new();
    for field in fields {
        let value = match *field {
            "title" => json!(track.title.as_deref()),
            "artist" => json!(track.artist.as_deref()),
            "album" => json!(track.album.as_deref()),
            "album_artist" => json!(track.album_artist.as_deref()),
            "track_number" => json!(track.track_number),
            "disc_number" => json!(track.disc_number),
            "genre" => json!(track.genre.as_deref()),
            "year" => json!(track.year),
            "rating" => json!(track.rating),
            _ => serde_json::Value::Null,
        };
        values.insert((*field).to_string(), value);
    }
    serde_json::Value::Object(values)
}

fn metadata_file_tag_values(metadata: &serde_json::Value, fields: &[&str]) -> serde_json::Value {
    let mut values = serde_json::Map::new();
    for field in fields {
        values.insert(
            (*field).to_string(),
            metadata
                .get(*field)
                .cloned()
                .unwrap_or(serde_json::Value::Null),
        );
    }
    serde_json::Value::Object(values)
}

fn tag_value_is_empty(value: &serde_json::Value) -> bool {
    value.is_null() || value.as_str().is_some_and(|text| text.trim().is_empty())
}

fn tag_values_equal(left: Option<&serde_json::Value>, right: Option<&serde_json::Value>) -> bool {
    let left = left.unwrap_or(&serde_json::Value::Null);
    let right = right.unwrap_or(&serde_json::Value::Null);
    if tag_value_is_empty(left) {
        return tag_value_is_empty(right);
    }
    if tag_value_is_empty(right) {
        return false;
    }
    if left.is_number() || right.is_number() {
        return left
            .as_f64()
            .or_else(|| {
                left.as_str()
                    .and_then(|text| text.trim().parse::<f64>().ok())
            })
            .zip(right.as_f64().or_else(|| {
                right
                    .as_str()
                    .and_then(|text| text.trim().parse::<f64>().ok())
            }))
            .is_some_and(|(left, right)| (left - right).abs() < 0.01);
    }
    let left_text = left
        .as_str()
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| left.to_string());
    let right_text = right
        .as_str()
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| right.to_string());
    left_text.trim().eq_ignore_ascii_case(right_text.trim())
}

fn changed_metadata_write_fields(
    database: &serde_json::Value,
    file: &serde_json::Value,
    fields: &[&str],
) -> Vec<String> {
    fields
        .iter()
        .filter(|field| !tag_values_equal(database.get(**field), file.get(**field)))
        .map(|field| (*field).to_string())
        .collect()
}

pub fn track_file_metadata_write_preview(
    track_ids: Option<Vec<i64>>,
    include_metadata: Option<bool>,
    include_rating: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopTrackFileMetadataWriteResponse, String> {
    let include_metadata = include_metadata.unwrap_or(true);
    let include_rating = include_rating.unwrap_or(true);
    let apply = apply.unwrap_or(false);
    if !include_metadata && !include_rating {
        return Err("Choose metadata, ratings, or both to write".to_string());
    }
    let limit = limit.unwrap_or(500).clamp(1, 10_000);
    let connection = open_database()?;
    let (tracks, missing_track_ids) = if let Some(mut ids) = track_ids {
        ids.retain(|id| *id > 0);
        ids.truncate(limit);
        let (track_map, missing) = tracks_by_id_map(&connection, &ids)?;
        let tracks = ids
            .into_iter()
            .filter_map(|id| track_map.get(&id).cloned())
            .collect::<Vec<_>>();
        (tracks, missing)
    } else {
        let mut statement = connection
            .prepare(&format!(
                "SELECT {TRACK_COLUMNS}
                 FROM tracks
                 WHERE {music_filter}
                 ORDER BY datetime(file_modified_at) DESC, id DESC
                 LIMIT ?",
                music_filter = music_only_clause()
            ))
            .map_err(|error| format!("Could not prepare metadata write preview query: {error}"))?;
        let tracks = statement
            .query_map(params![limit as i64], track_from_row)
            .map_err(|error| format!("Could not read metadata write preview tracks: {error}"))?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode metadata write preview tracks: {error}"))?;
        (tracks, Vec::new())
    };
    let fields = metadata_write_field_names(include_metadata, include_rating);
    let metadata_by_path = tracks
        .iter()
        .map(|track| {
            let result = metadata::read_file_metadata_result(Path::new(&track.path));
            (normalized_path_key(&track.path), result)
        })
        .collect::<HashMap<_, _>>();

    let mut previews = Vec::new();
    let mut errors = Vec::new();
    let mut applied = 0;
    for track in tracks {
        let database = track_database_file_tag_values(&track, &fields);
        let mut preview = DesktopTrackFileMetadataWritePreview {
            track_id: track.id,
            path: track.path.clone(),
            title: track.title.clone(),
            artist: track.artist.clone(),
            changed_fields: Vec::new(),
            database,
            file: json!({}),
            applied: false,
            error: None,
        };
        let path = PathBuf::from(&track.path);
        if !path.is_file() {
            preview.error = Some("Audio file is missing on disk".to_string());
            errors.push(format!(
                "{}: Audio file is missing on disk",
                track.title.as_deref().unwrap_or(&track.path)
            ));
            previews.push(preview);
            continue;
        }
        let key = normalized_path_key(&track.path);
        let Some(result) = metadata_by_path.get(&key) else {
            preview.error = Some("Metadata worker did not return this file".to_string());
            errors.push(format!(
                "{}: Metadata worker did not return this file",
                track.title.as_deref().unwrap_or(&track.path)
            ));
            previews.push(preview);
            continue;
        };
        if let Some(error) = result.get("error").and_then(serde_json::Value::as_str) {
            preview.error = Some(error.to_string());
            errors.push(format!(
                "{}: {error}",
                track.title.as_deref().unwrap_or(&track.path)
            ));
            previews.push(preview);
            continue;
        }
        let metadata = result.get("metadata").unwrap_or(&serde_json::Value::Null);
        let file = metadata_file_tag_values(metadata, &fields);
        preview.changed_fields = changed_metadata_write_fields(&preview.database, &file, &fields);
        preview.file = file;
        if apply && !preview.changed_fields.is_empty() {
            let changed_metadata = include_metadata
                && preview
                    .changed_fields
                    .iter()
                    .any(|field| field.as_str() != "rating");
            let changed_rating = include_rating
                && preview
                    .changed_fields
                    .iter()
                    .any(|field| field.as_str() == "rating");
            let write_result = (|| {
                if changed_metadata {
                    let database = preview
                        .database
                        .as_object()
                        .ok_or_else(|| "Metadata preview is missing database values".to_string())?;
                    metadata::write_common_metadata(&path, database)?;
                }
                if changed_rating {
                    metadata::write_common_rating(&path, track.rating)?;
                }
                Ok::<(), String>(())
            })();
            match write_result {
                Ok(()) => {
                    preview.applied = true;
                    applied += 1;
                    connection
                        .execute(
                            "UPDATE tracks
                             SET file_modified_at = coalesce(?, file_modified_at),
                                 updated_at = datetime('now')
                             WHERE id = ?",
                            params![metadata::modified_time_iso(&path), track.id],
                        )
                        .map_err(|error| {
                            format!("Could not update track after writing file tags: {error}")
                        })?;
                    connection
                        .execute(
                            "DELETE FROM track_metadata_cache WHERE path_key = ?",
                            params![normalized_path_key(&track.path)],
                        )
                        .map_err(|error| {
                            format!(
                                "Could not clear metadata cache after writing file tags: {error}"
                            )
                        })?;
                }
                Err(error) => {
                    preview.error = Some(error.clone());
                    errors.push(format!(
                        "{}: {error}",
                        track.title.as_deref().unwrap_or(&track.path)
                    ));
                }
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_library_query_cache(&connection);
    }
    Ok(DesktopTrackFileMetadataWriteResponse {
        total: previews.len() as i64,
        changed: previews
            .iter()
            .filter(|preview| !preview.changed_fields.is_empty())
            .count() as i64,
        applied,
        missing_track_ids,
        errors: errors.into_iter().take(100).collect(),
        previews,
    })
}

fn primary_artist_name(value: &str) -> String {
    let separators = [';', '|'];
    let mut artist = value
        .split(|character| separators.contains(&character))
        .next()
        .unwrap_or(value)
        .trim()
        .to_string();
    let lowered = artist.to_ascii_lowercase();
    for marker in [" feat.", " feat ", " featuring ", " with "] {
        if let Some(index) = lowered.find(marker) {
            artist = artist[..index].trim().to_string();
            break;
        }
    }
    if artist.is_empty() {
        value.trim().to_string()
    } else {
        artist
    }
}

