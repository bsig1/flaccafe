fn mark_track_for_inbox(connection: &Connection, track_id: i64, now: &str) -> Result<(), String> {
    connection
        .execute(
            "
            INSERT OR REPLACE INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
            VALUES(?, 'new', NULL, ?)
            ",
            params![track_id, now],
        )
        .map_err(|error| format!("Could not mark new track for Inbox review: {error}"))?;
    Ok(())
}

fn remove_missing_tracks(
    connection: &Connection,
    folder: &Path,
    current_path_keys: &HashSet<String>,
) -> Result<usize, String> {
    let mut statement = connection
        .prepare("SELECT id, path, path_key FROM tracks")
        .map_err(|error| format!("Could not inspect existing tracks: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| format!("Could not query existing tracks: {error}"))?;
    let mut missing_ids = Vec::new();
    for row in rows {
        let (track_id, path, path_key) =
            row.map_err(|error| format!("Could not read existing track row: {error}"))?;
        if path_is_under_folder(Path::new(&path), folder) && !current_path_keys.contains(&path_key)
        {
            missing_ids.push(track_id);
        }
    }
    for track_id in &missing_ids {
        connection
            .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
            .map_err(|error| format!("Could not remove missing track {track_id}: {error}"))?;
    }
    if !missing_ids.is_empty() {
        clear_library_query_cache(connection);
    }
    Ok(missing_ids.len())
}

pub(crate) fn cleanup_orphan_albums(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "
            DELETE FROM albums
            WHERE id NOT IN (
                SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL
            )
            ",
            [],
        )
        .map_err(|error| format!("Could not clean orphan albums: {error}"))?;
    Ok(())
}

fn save_library_paths(connection: &Connection, save_paths: &[PathBuf]) -> Result<(), String> {
    let paths = save_paths
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .filter(|path| !path.trim().is_empty())
        .collect::<Vec<_>>();
    set_setting(
        connection,
        "library_path",
        paths.first().map(String::as_str),
    )?;
    let paths_json = serde_json::to_string(&paths).unwrap_or_else(|_| "[]".to_string());
    set_setting(connection, "library_paths_json", Some(&paths_json))?;
    Ok(())
}

fn load_existing_track_states() -> Result<HashMap<String, Option<String>>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare("SELECT path_key, file_modified_at FROM tracks")
        .map_err(|error| format!("Could not prepare scan diff query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(|error| format!("Could not query scan diff state: {error}"))?;
    let mut states = HashMap::new();
    for row in rows {
        let (path_key, modified_at) =
            row.map_err(|error| format!("Could not read scan diff state: {error}"))?;
        states.insert(path_key, modified_at);
    }
    Ok(states)
}

fn metadata_needs_read(
    snapshot: &AudioSnapshot,
    existing_states: &HashMap<String, Option<String>>,
) -> bool {
    match existing_states.get(&snapshot.path_key) {
        None => true,
        Some(Some(existing_modified)) => snapshot
            .modified_at
            .as_deref()
            .map(|modified_at| modified_at != existing_modified)
            .unwrap_or(true),
        Some(None) => true,
    }
}

fn record_scan_error(connection: &Connection, folder: &Path, path: Option<&Path>, message: &str) {
    let path_text = path
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = path
        .and_then(Path::extension)
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value.to_ascii_lowercase()))
        .unwrap_or_default();
    let _ = connection.execute(
        "
        INSERT INTO scan_error_samples(path_hash, folder_hash, extension, message)
        VALUES(?, ?, ?, ?)
        ",
        params![
            anonymized_hash(&path_key_text(&path_text)),
            anonymized_hash(&path_key(folder)),
            extension,
            truncate_chars(message, 500),
        ],
    );
    let _ = connection.execute(
        "
        DELETE FROM scan_error_samples
        WHERE id NOT IN (
          SELECT id FROM scan_error_samples ORDER BY datetime(created_at) DESC, id DESC LIMIT 200
        )
        ",
        [],
    );
}

pub(crate) fn clear_library_query_cache(connection: &Connection) {
    let _ = connection.execute("DELETE FROM library_query_cache", []);
}

