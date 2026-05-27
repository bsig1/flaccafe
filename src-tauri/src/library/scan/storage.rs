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
    connection
        .execute(
            "CREATE TEMP TABLE IF NOT EXISTS scan_current_path_keys(path_key TEXT PRIMARY KEY) WITHOUT ROWID",
            [],
        )
        .map_err(|error| format!("Could not prepare scan cleanup table: {error}"))?;
    connection
        .execute("DELETE FROM scan_current_path_keys", [])
        .map_err(|error| format!("Could not reset scan cleanup table: {error}"))?;
    {
        let mut insert = connection
            .prepare("INSERT OR IGNORE INTO scan_current_path_keys(path_key) VALUES(?)")
            .map_err(|error| format!("Could not prepare scan cleanup insert: {error}"))?;
        for path_key in current_path_keys {
            insert
                .execute(params![path_key])
                .map_err(|error| format!("Could not stage scan path key: {error}"))?;
        }
    }
    let folder_key = path_key(folder);
    let mut folder_prefix = folder_key.clone();
    if !folder_prefix.ends_with(std::path::MAIN_SEPARATOR) {
        folder_prefix.push(std::path::MAIN_SEPARATOR);
    }
    let pattern = format!("{}%", escape_sql_like(&folder_prefix));
    let removed = connection
        .execute(
            "
            DELETE FROM tracks
            WHERE (path_key = ? OR path_key LIKE ? ESCAPE ?)
              AND NOT EXISTS (
                SELECT 1
                FROM scan_current_path_keys current
                WHERE current.path_key = tracks.path_key
              )
            ",
            params![folder_key, pattern, "\\"],
        )
        .map_err(|error| format!("Could not remove missing tracks: {error}"))?;
    connection
        .execute("DELETE FROM scan_current_path_keys", [])
        .ok();
    Ok(removed)
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

fn escape_sql_like(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        if matches!(character, '%' | '_' | '\\') {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
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

