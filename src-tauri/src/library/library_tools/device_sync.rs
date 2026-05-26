#[tauri::command]
pub fn device_sync_profiles(
    _state: State<'_, DesktopLibraryState>,
) -> Result<DesktopDeviceSyncProfilesResponse, String> {
    let connection = open_database()?;
    Ok(DesktopDeviceSyncProfilesResponse {
        profiles: list_device_sync_profiles_for_connection(&connection)?,
        presets: android_presets(),
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn save_device_sync_profile(
    _state: State<'_, DesktopLibraryState>,
    profile_id: Option<i64>,
    name: String,
    target_folder: Option<String>,
    device_kind: Option<String>,
    music_subfolder: Option<String>,
    playlist_subfolder: Option<String>,
    playlist_ids: Option<Vec<i64>>,
    playlist_rules: Option<serde_json::Value>,
    copy_files: Option<bool>,
    export_playlists: Option<bool>,
    preserve_structure: Option<bool>,
) -> Result<DesktopDeviceSyncProfile, String> {
    let name = non_empty_trimmed(name, "Device sync profile name", 120)?;
    let device_kind = device_kind.unwrap_or_else(|| "folder".to_string());
    if !DEVICE_KINDS.contains(&device_kind.as_str()) {
        return Err("Unsupported device sync profile kind".to_string());
    }
    let target_folder = target_folder.unwrap_or_default();
    let music_subfolder = music_subfolder
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Music".to_string());
    let playlist_subfolder = playlist_subfolder
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Playlists".to_string());
    let playlist_ids: Vec<i64> = playlist_ids
        .unwrap_or_default()
        .into_iter()
        .filter(|value| *value > 0)
        .take(200)
        .collect();
    let playlist_rules = playlist_rules
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| json!({}));
    let playlist_ids_json = serde_json::to_string(&playlist_ids)
        .map_err(|error| format!("Could not serialize device sync playlist ids: {error}"))?;
    let playlist_rules_json = serde_json::to_string(&playlist_rules)
        .map_err(|error| format!("Could not serialize device sync playlist rules: {error}"))?;
    let connection = open_database()?;

    match profile_id {
        Some(profile_id) => {
            let updated = connection
                .execute(
                    r#"
                    UPDATE device_sync_profiles
                    SET name = ?,
                        target_folder = ?,
                        device_kind = ?,
                        music_subfolder = ?,
                        playlist_subfolder = ?,
                        playlist_ids_json = ?,
                        playlist_rules_json = ?,
                        copy_files = ?,
                        export_playlists = ?,
                        preserve_structure = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                    "#,
                    params![
                        name,
                        target_folder,
                        device_kind,
                        music_subfolder,
                        playlist_subfolder,
                        playlist_ids_json,
                        playlist_rules_json,
                        if copy_files.unwrap_or(true) { 1 } else { 0 },
                        if export_playlists.unwrap_or(true) {
                            1
                        } else {
                            0
                        },
                        if preserve_structure.unwrap_or(true) {
                            1
                        } else {
                            0
                        },
                        profile_id
                    ],
                )
                .map_err(|error| format!("Could not update Rust device sync profile: {error}"))?;
            if updated == 0 {
                return Err("Device sync profile not found".to_string());
            }
            device_sync_profile_by_id(&connection, profile_id)
        }
        None => {
            connection
                .execute(
                    r#"
                    INSERT INTO device_sync_profiles(
                      name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                      playlist_ids_json, playlist_rules_json, copy_files, export_playlists, preserve_structure
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(name) DO UPDATE SET
                      target_folder = excluded.target_folder,
                      device_kind = excluded.device_kind,
                      music_subfolder = excluded.music_subfolder,
                      playlist_subfolder = excluded.playlist_subfolder,
                      playlist_ids_json = excluded.playlist_ids_json,
                      playlist_rules_json = excluded.playlist_rules_json,
                      copy_files = excluded.copy_files,
                      export_playlists = excluded.export_playlists,
                      preserve_structure = excluded.preserve_structure,
                      updated_at = datetime('now')
                    "#,
                    params![
                        name,
                        target_folder,
                        device_kind,
                        music_subfolder,
                        playlist_subfolder,
                        playlist_ids_json,
                        playlist_rules_json,
                        if copy_files.unwrap_or(true) { 1 } else { 0 },
                        if export_playlists.unwrap_or(true) { 1 } else { 0 },
                        if preserve_structure.unwrap_or(true) { 1 } else { 0 }
                    ],
                )
                .map_err(|error| format!("Could not save Rust device sync profile: {error}"))?;
            device_sync_profile_by_name(&connection, &name)
        }
    }
}

#[tauri::command]
pub fn delete_device_sync_profile(
    _state: State<'_, DesktopLibraryState>,
    profile_id: i64,
) -> Result<DesktopDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM device_sync_profiles WHERE id = ?",
            params![profile_id],
        )
        .map_err(|error| format!("Could not delete Rust device sync profile: {error}"))?;
    if deleted == 0 {
        return Err("Device sync profile not found".to_string());
    }
    Ok(DesktopDeletedResponse { deleted: true })
}

fn sanitize_path_component(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();
    if cleaned.is_empty() {
        "_".to_string()
    } else {
        cleaned
    }
}

fn safe_subfolder(value: Option<String>, fallback: &str) -> PathBuf {
    let text = value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .trim_matches(['/', '\\']);
    let parts = text
        .split(['/', '\\'])
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(sanitize_path_component)
        .collect::<Vec<_>>();
    if parts.is_empty() {
        PathBuf::from(fallback)
    } else {
        parts
            .into_iter()
            .fold(PathBuf::new(), |path, part| path.join(part))
    }
}

fn device_sync_target(
    track: &DesktopTrack,
    target_root: &Path,
    library_root: Option<&Path>,
    preserve_structure: bool,
    music_subfolder: Option<String>,
) -> PathBuf {
    let source = PathBuf::from(&track.path);
    let music_folder = safe_subfolder(music_subfolder, "Music");
    if preserve_structure {
        if let Some(library_root) = library_root {
            let source_resolved = source.canonicalize().unwrap_or_else(|_| source.clone());
            if let Ok(relative) = source_resolved.strip_prefix(library_root) {
                return target_root.join(music_folder).join(relative);
            }
        }
    }
    let artist = sanitize_path_component(
        track
            .album_artist
            .as_deref()
            .or(track.artist.as_deref())
            .unwrap_or("Unknown Artist"),
    );
    let album = sanitize_path_component(track.album.as_deref().unwrap_or("Unknown Album"));
    let filename = source
        .file_name()
        .and_then(|value| value.to_str())
        .map(sanitize_path_component)
        .unwrap_or_else(|| format!("track-{}", track.id));
    target_root
        .join(music_folder)
        .join(artist)
        .join(album)
        .join(filename)
}

fn path_needs_copy(source: &Path, target: &Path) -> bool {
    if !target.exists() {
        return true;
    }
    let Ok(source_metadata) = fs::metadata(source) else {
        return true;
    };
    let Ok(target_metadata) = fs::metadata(target) else {
        return true;
    };
    if source_metadata.len() != target_metadata.len() {
        return true;
    }
    match (source_metadata.modified(), target_metadata.modified()) {
        (Ok(source_modified), Ok(target_modified)) => source_modified > target_modified,
        _ => true,
    }
}

fn playlist_tracks(
    connection: &Connection,
    playlist_id: i64,
    limit: usize,
) -> Result<Vec<DesktopTrack>, String> {
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS}
             FROM playlist_tracks
             JOIN tracks ON tracks.id = playlist_tracks.track_id
             WHERE playlist_tracks.playlist_id = ?
             ORDER BY playlist_tracks.position ASC, playlist_tracks.id ASC
             LIMIT ?"
        ))
        .map_err(|error| format!("Could not prepare Rust device playlist tracks: {error}"))?;
    let rows = statement
        .query_map(params![playlist_id, limit as i64], track_from_row)
        .map_err(|error| format!("Could not read Rust device playlist tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust device playlist tracks: {error}"))
}

fn device_sync_tracks(
    connection: &Connection,
    playlist_ids: &[i64],
    track_ids: Option<Vec<i64>>,
    limit: usize,
) -> Result<(Vec<DesktopTrack>, BTreeMap<i64, Vec<DesktopTrack>>), String> {
    let mut by_id = BTreeMap::<i64, DesktopTrack>::new();
    let mut playlist_map = BTreeMap::new();
    for playlist_id in playlist_ids {
        let rows = playlist_tracks(connection, *playlist_id, limit)?;
        for track in &rows {
            by_id.entry(track.id).or_insert_with(|| track.clone());
        }
        playlist_map.insert(*playlist_id, rows);
    }
    for track in select_tool_tracks(connection, track_ids, Some(limit))? {
        by_id.entry(track.id).or_insert(track);
    }
    Ok((by_id.into_values().take(limit).collect(), playlist_map))
}

fn playlist_names(connection: &Connection) -> Result<BTreeMap<i64, String>, String> {
    let mut statement = connection
        .prepare("SELECT id, name FROM playlists ORDER BY lower(name)")
        .map_err(|error| format!("Could not prepare Rust playlist name query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>("id")?,
                row.get::<_, Option<String>>("name")?
                    .unwrap_or_else(|| "Untitled Playlist".to_string()),
            ))
        })
        .map_err(|error| format!("Could not read Rust playlist names: {error}"))?;
    rows.collect::<rusqlite::Result<BTreeMap<_, _>>>()
        .map_err(|error| format!("Could not decode Rust playlist names: {error}"))
}

fn write_device_playlist(
    playlist_path: &Path,
    tracks: &[DesktopTrack],
    target_paths: &BTreeMap<i64, PathBuf>,
    copy_files: bool,
) -> Result<i64, String> {
    let mut lines = vec!["#EXTM3U".to_string()];
    for track in tracks {
        let path = if copy_files {
            target_paths
                .get(&track.id)
                .cloned()
                .unwrap_or_else(|| PathBuf::from(&track.path))
        } else {
            PathBuf::from(&track.path)
        };
        let duration = track.duration_seconds.unwrap_or(-1.0).round() as i64;
        let title = track.title.as_deref().unwrap_or_else(|| {
            Path::new(&track.path)
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("Untitled")
        });
        let artist = track.artist.as_deref().unwrap_or("Unknown Artist");
        lines.push(format!("#EXTINF:{duration},{artist} - {title}"));
        let text_path = if copy_files {
            playlist_path
                .parent()
                .and_then(|parent| path.strip_prefix(parent).ok())
                .map(Path::to_path_buf)
                .unwrap_or_else(|| path.clone())
        } else {
            path
        };
        lines.push(text_path.to_string_lossy().replace('\\', "/"));
    }
    if let Some(parent) = playlist_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create device playlist folder: {error}"))?;
    }
    fs::write(playlist_path, format!("{}\n", lines.join("\n")))
        .map_err(|error| format!("Could not write device playlist: {error}"))?;
    Ok(tracks.len() as i64)
}

#[allow(clippy::too_many_arguments)]
pub fn sync_device_folder(
    target_folder: String,
    playlist_ids: Option<Vec<i64>>,
    track_ids: Option<Vec<i64>>,
    music_subfolder: Option<String>,
    playlist_subfolder: Option<String>,
    copy_files: Option<bool>,
    export_playlists: Option<bool>,
    preserve_structure: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopDeviceSyncResponse, String> {
    let target_root = PathBuf::from(target_folder.trim());
    if target_root.as_os_str().is_empty() {
        return Err("Target folder is required".to_string());
    }
    let target_root = match target_root.canonicalize() {
        Ok(path) => path,
        Err(_) => target_root,
    };
    let apply = apply.unwrap_or(false);
    if apply {
        fs::create_dir_all(&target_root)
            .map_err(|error| format!("Could not create target folder: {error}"))?;
    }
    let playlist_ids = playlist_ids
        .unwrap_or_default()
        .into_iter()
        .filter(|id| *id > 0)
        .take(200)
        .collect::<Vec<_>>();
    let limit = limit.unwrap_or(10_000).clamp(1, 200_000);
    let copy_files = copy_files.unwrap_or(true);
    let export_playlists = export_playlists.unwrap_or(true);
    let preserve_structure = preserve_structure.unwrap_or(true);
    let connection = open_database()?;
    let library_root = get_setting(&connection, "library_path")
        .map(PathBuf::from)
        .and_then(|path| path.canonicalize().ok());
    let (tracks, playlist_map) = device_sync_tracks(&connection, &playlist_ids, track_ids, limit)?;
    let playlist_names = playlist_names(&connection)?;
    let mut target_paths = BTreeMap::new();
    let mut changes = Vec::new();
    let mut copied_files = 0i64;
    let mut skipped_files = 0i64;
    for track in &tracks {
        let source = PathBuf::from(&track.path);
        let target = device_sync_target(
            track,
            &target_root,
            library_root.as_deref(),
            preserve_structure,
            music_subfolder.clone(),
        );
        target_paths.insert(track.id, target.clone());
        let mut change = DesktopDeviceSyncChange {
            track_id: track.id,
            title: track.title.clone(),
            artist: track.artist.clone(),
            source_path: source.to_string_lossy().to_string(),
            target_path: target.to_string_lossy().to_string(),
            changed: false,
            applied: false,
            error: None,
        };
        if !source.is_file() {
            change.error = Some("Source file is missing".to_string());
            skipped_files += 1;
        } else {
            change.changed = path_needs_copy(&source, &target);
            if copy_files && apply && change.changed {
                match (|| -> Result<(), String> {
                    if let Some(parent) = target.parent() {
                        fs::create_dir_all(parent)
                            .map_err(|error| format!("Could not create target folder: {error}"))?;
                    }
                    fs::copy(&source, &target)
                        .map_err(|error| format!("Could not copy file: {error}"))?;
                    Ok(())
                })() {
                    Ok(()) => {
                        change.applied = true;
                        copied_files += 1;
                    }
                    Err(error) => {
                        change.error = Some(error);
                        skipped_files += 1;
                    }
                }
            } else if !change.changed {
                skipped_files += 1;
            }
        }
        changes.push(change);
    }

    let mut playlist_exports = Vec::new();
    let mut playlists_written = 0i64;
    if export_playlists {
        for playlist_id in playlist_ids {
            let name = playlist_names
                .get(&playlist_id)
                .cloned()
                .unwrap_or_else(|| format!("Playlist {playlist_id}"));
            let playlist_path = target_root
                .join(safe_subfolder(playlist_subfolder.clone(), "Playlists"))
                .join(format!("{}.m3u8", sanitize_path_component(&name)));
            let tracks = playlist_map.get(&playlist_id).cloned().unwrap_or_default();
            let mut export = DesktopDeviceSyncPlaylistExport {
                playlist_id,
                name,
                playlist_path: playlist_path.to_string_lossy().to_string(),
                track_count: tracks.len() as i64,
                applied: false,
                error: None,
            };
            if !playlist_names.contains_key(&playlist_id) {
                export.error = Some("Playlist not found".to_string());
            } else if apply {
                match write_device_playlist(&playlist_path, &tracks, &target_paths, copy_files) {
                    Ok(_) => {
                        export.applied = true;
                        playlists_written += 1;
                    }
                    Err(error) => export.error = Some(error),
                }
            }
            playlist_exports.push(export);
        }
    }
    Ok(DesktopDeviceSyncResponse {
        target_folder: target_root.to_string_lossy().to_string(),
        total_tracks: tracks.len() as i64,
        changed_files: changes.iter().filter(|change| change.changed).count() as i64,
        copied_files,
        skipped_files,
        playlists_written,
        changes,
        playlist_exports,
    })
}

pub fn device_sync_devices() -> DesktopDeviceSyncDevicesResponse {
    let mut devices = Vec::new();
    #[cfg(windows)]
    {
        for letter in b'A'..=b'Z' {
            let root = format!("{}:\\", letter as char);
            let path = PathBuf::from(&root);
            if path.exists() {
                devices.push(DesktopDeviceSyncDetectedDevice {
                    id: root.trim_end_matches('\\').to_string(),
                    label: root.clone(),
                    root_path: root,
                    device_kind: "folder".to_string(),
                    drive_type: None,
                    size_bytes: None,
                    free_bytes: None,
                    writable: false,
                    hint: Some("Detected Windows drive".to_string()),
                });
            }
        }
    }
    DesktopDeviceSyncDevicesResponse {
        devices,
        mtp_supported: false,
        message: "Folder and visible drive sync are available. MTP devices still need Windows Explorer or a mounted folder.".to_string(),
    }
}

