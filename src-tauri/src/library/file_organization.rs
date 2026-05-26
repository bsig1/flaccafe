use super::*;

fn organization_target_path(template: &str, base_folder: &Path, track: &DesktopTrack) -> PathBuf {
    let ext = file_extension(&track.path);
    let fallback_title = file_stem(&track.path);
    let mut relative = template.to_string();
    let replacements = [
        (
            "{artist}",
            safe_component(track.artist.as_deref().unwrap_or("Unknown Artist")),
        ),
        (
            "{album_artist}",
            safe_component(
                track
                    .album_artist
                    .as_deref()
                    .or(track.artist.as_deref())
                    .unwrap_or("Unknown Artist"),
            ),
        ),
        (
            "{album}",
            safe_component(track.album.as_deref().unwrap_or("Unknown Album")),
        ),
        (
            "{title}",
            safe_component(track.title.as_deref().unwrap_or(&fallback_title)),
        ),
        ("{track_number}", padded_number(track.track_number)),
        ("{disc_number}", padded_number(track.disc_number)),
        (
            "{genre}",
            safe_component(track.genre.as_deref().unwrap_or("Unknown Genre")),
        ),
        (
            "{year}",
            track
                .year
                .map(|year| year.to_string())
                .unwrap_or_else(|| "Unknown Year".to_string()),
        ),
        ("{ext}", safe_component(&ext)),
    ];
    for (token, value) in replacements {
        relative = relative.replace(token, &value);
    }
    let mut target = base_folder.join(relative.replace('\\', "/"));
    if target.extension().is_none() && !ext.is_empty() {
        target.set_extension(ext);
    }
    target
}

fn remove_empty_parent_folders(source_parent: &Path, stop_at: Option<&Path>) -> i64 {
    let stop_key = stop_at.map(|path| normalized_path_key(&path.to_string_lossy()));
    let mut removed = 0i64;
    let mut cursor = source_parent.to_path_buf();
    loop {
        if cursor.as_os_str().is_empty() {
            break;
        }
        let cursor_key = normalized_path_key(&cursor.to_string_lossy());
        if stop_key.as_ref().is_some_and(|key| &cursor_key == key) {
            break;
        }
        if std::fs::remove_dir(&cursor).is_ok() {
            removed += 1;
        } else {
            break;
        }
        if !cursor.pop() {
            break;
        }
    }
    removed
}

pub(super) fn clear_library_query_cache(connection: &Connection) {
    let _ = connection.execute("DELETE FROM library_query_cache", []);
}

pub(super) fn album_tracks_by_id(
    connection: &Connection,
    album_id: i64,
) -> Result<Vec<DesktopTrack>, String> {
    let album = connection
        .query_row(
            "SELECT album, album_artist FROM albums WHERE id = ?",
            params![album_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .map_err(|error| format!("Could not find album: {error}"))?;
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {TRACK_COLUMNS}
            FROM tracks
            WHERE album_id IN (
                SELECT id
                FROM albums
                WHERE lower(trim(coalesce(album, ''))) = lower(trim(coalesce(?, '')))
                  AND lower(trim(coalesce(album_artist, ''))) = lower(trim(coalesce(?, '')))
            )
            ORDER BY coalesce(disc_number, 0) ASC,
                     coalesce(track_number, 0) ASC,
                     lower(coalesce(title, '')) ASC,
                     id ASC
            "#
        ))
        .map_err(|error| format!("Could not prepare Rust album tracks query: {error}"))?;
    let rows = statement
        .query_map(params![album.0, album.1], track_from_row)
        .map_err(|error| format!("Could not read Rust album tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust album tracks: {error}"))
}

#[tauri::command]
pub fn file_organization_preview(
    _state: State<'_, DesktopLibraryState>,
    template: String,
    base_folder: Option<String>,
    track_ids: Option<Vec<i64>>,
    collision_strategy: Option<String>,
    cleanup_empty_folders: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopFileOrganizationResponse, String> {
    let mut connection = open_database()?;
    let tracks = select_tracks_by_ids_or_limit(
        &connection,
        track_ids,
        limit.unwrap_or(200).clamp(1, 20_000),
    )?;
    let library_root = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'library_path'",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten()
        .map(PathBuf::from);
    let base_folder = base_folder
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            tracks
                .first()
                .and_then(|track| Path::new(&track.path).parent().map(Path::to_path_buf))
        })
        .unwrap_or_else(|| PathBuf::from("."));
    let collision_strategy = collision_strategy.unwrap_or_else(|| "skip".to_string());
    let cleanup_empty_folders = cleanup_empty_folders.unwrap_or(false);
    let apply = apply.unwrap_or(false);
    let mut reserved = HashSet::<String>::new();
    let mut changes = Vec::new();
    let mut applied = 0i64;
    let mut removed_empty_folders = 0i64;
    let batch_id = if apply {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        Some(format!("file-organize-{millis}"))
    } else {
        None
    };
    let transaction =
        if apply {
            Some(connection.transaction().map_err(|error| {
                format!("Could not start Rust file organizer transaction: {error}")
            })?)
        } else {
            None
        };
    for track in tracks {
        let mut target = organization_target_path(&template, &base_folder, &track);
        let current_key = normalized_path_key(&track.path);
        let mut target_key = normalized_path_key(&target.to_string_lossy());
        let mut collision = target.exists() && target_key != current_key;
        if collision || reserved.contains(&target_key) {
            collision = true;
            if collision_strategy == "auto_rename" {
                let stem = target
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .unwrap_or("track")
                    .to_string();
                let extension = target
                    .extension()
                    .and_then(|value| value.to_str())
                    .map(str::to_string);
                for index in 1..10_000 {
                    let mut candidate = target.clone();
                    let name = match &extension {
                        Some(extension) if !extension.is_empty() => {
                            format!("{stem} ({index}).{extension}")
                        }
                        _ => format!("{stem} ({index})"),
                    };
                    candidate.set_file_name(name);
                    let key = normalized_path_key(&candidate.to_string_lossy());
                    if !candidate.exists() && !reserved.contains(&key) {
                        target = candidate;
                        target_key = key;
                        break;
                    }
                }
            }
        }
        reserved.insert(target_key.clone());
        let changed = target_key != current_key;
        let source_path = PathBuf::from(&track.path);
        let source_parent = source_path.parent().map(Path::to_path_buf);
        let mut change = DesktopFileOrganizationChange {
            track_id: track.id,
            title: track.title.clone(),
            artist: track.artist.clone(),
            current_path: track.path.clone(),
            target_path: target.to_string_lossy().to_string(),
            changed,
            collision,
            applied: false,
            error: None,
        };
        if apply && changed {
            if !source_path.exists() {
                change.error = Some("Source file is missing".to_string());
            } else if collision && collision_strategy == "skip" {
                change.error = Some("Target file already exists".to_string());
            } else {
                if let Some(parent) = target.parent() {
                    if let Err(error) = std::fs::create_dir_all(parent) {
                        change.error = Some(format!("Could not create target folder: {error}"));
                    }
                }
                if change.error.is_none() {
                    match std::fs::rename(&source_path, &target) {
                        Ok(()) => {
                            let modified_unix = target
                                .metadata()
                                .and_then(|metadata| metadata.modified())
                                .ok()
                                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                                .map(|duration| duration.as_secs() as i64);
                            if let Some(transaction) = transaction.as_ref() {
                                match transaction.execute(
                                    "UPDATE tracks
                                     SET path = ?, path_key = ?, file_modified_at = datetime(coalesce(?, strftime('%s','now')), 'unixepoch'), updated_at = datetime('now')
                                     WHERE id = ?",
                                    params![
                                        target.to_string_lossy().to_string(),
                                        normalized_path_key(&target.to_string_lossy()),
                                        modified_unix,
                                        track.id
                                    ],
                                ) {
                                    Ok(_) => {
                                        let _ = transaction.execute(
                                            "DELETE FROM track_metadata_cache WHERE path_key IN (?, ?)",
                                            params![current_key, normalized_path_key(&target.to_string_lossy())],
                                        );
                                        if let Some(batch_id) = &batch_id {
                                            let summary = format!(
                                                "Renamed/reorganized {}",
                                                track.title.as_deref().unwrap_or_else(|| {
                                                    source_path
                                                        .file_name()
                                                        .and_then(|name| name.to_str())
                                                        .unwrap_or("track")
                                                })
                                            );
                                            let payload = json!({
                                                "track_id": track.id,
                                                "from": source_path.to_string_lossy().to_string(),
                                                "to": target.to_string_lossy().to_string(),
                                                "previous_path_key": current_key,
                                                "new_path_key": normalized_path_key(&target.to_string_lossy()),
                                            });
                                            let _ = transaction.execute(
                                                "INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
                                                 VALUES(?, 'file_organization', ?, ?)",
                                                params![batch_id, summary, payload.to_string()],
                                            );
                                        }
                                        change.applied = true;
                                        applied += 1;
                                        if cleanup_empty_folders {
                                            if let Some(source_parent) = source_parent.as_deref() {
                                                removed_empty_folders += remove_empty_parent_folders(
                                                    source_parent,
                                                    library_root.as_deref(),
                                                );
                                            }
                                        }
                                    }
                                    Err(error) => {
                                        change.error =
                                            Some(format!("Could not update moved track in SQLite: {error}"));
                                    }
                                }
                            }
                        }
                        Err(error) => {
                            change.error =
                                Some(format!("Could not rename/reorganize file: {error}"));
                        }
                    }
                }
            }
        }
        changes.push(change);
    }
    if let Some(transaction) = transaction {
        if applied > 0 {
            clear_library_query_cache(&transaction);
        }
        transaction
            .commit()
            .map_err(|error| format!("Could not save Rust file organizer changes: {error}"))?;
    }
    let changed_count = changes.iter().filter(|change| change.changed).count() as i64;
    Ok(DesktopFileOrganizationResponse {
        template,
        base_folder: base_folder.to_string_lossy().to_string(),
        total: changes.len() as i64,
        changes,
        changed_count,
        applied,
        removed_empty_folders,
    })
}
