use super::*;

#[tauri::command]
pub fn playlists(
    _state: State<'_, DesktopLibraryState>,
) -> Result<Vec<DesktopPlaylistSummary>, String> {
    let connection = open_database()?;
    playlists_for_connection(&connection)
}

pub(super) fn playlists_for_connection(
    connection: &Connection,
) -> Result<Vec<DesktopPlaylistSummary>, String> {
    ensure_library_derived_data_current(connection)?;
    let cache_key = "ui:playlists:v2";
    if let Some(playlists) = read_cached_query::<Vec<DesktopPlaylistSummary>>(connection, cache_key)
    {
        return Ok(playlists);
    }
    let mut statement = connection
        .prepare(
            r#"
            SELECT
                id,
                name,
                track_count,
                duration_seconds,
                created_at,
                updated_at
            FROM playlist_summaries
            ORDER BY sort_name ASC, id ASC
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust playlists query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(DesktopPlaylistSummary {
                id: row.get("id")?,
                name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
                track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
                duration_seconds: row.get("duration_seconds")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Could not read Rust playlists: {error}"))?;
    let playlists = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust playlists: {error}"))?;
    write_cached_query(connection, cache_key, &playlists, Some(playlists.len() as i64));
    Ok(playlists)
}

fn playlist_summary_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DesktopPlaylistSummary> {
    Ok(DesktopPlaylistSummary {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
        duration_seconds: row.get("duration_seconds")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

pub(super) fn playlist_summary_by_id(
    connection: &Connection,
    playlist_id: i64,
) -> Result<DesktopPlaylistSummary, String> {
    ensure_library_derived_data_current(connection)?;
    connection
        .query_row(
            r#"
            SELECT
                id,
                name,
                track_count,
                duration_seconds,
                created_at,
                updated_at
            FROM playlist_summaries
            WHERE id = ?
            "#,
            params![playlist_id],
            playlist_summary_from_row,
        )
        .map_err(|error| format!("Could not read Rust playlist summary: {error}"))
}

#[tauri::command]
pub fn playlist_tracks(
    _state: State<'_, DesktopLibraryState>,
    playlist_id: i64,
) -> Result<Vec<DesktopTrack>, String> {
    let connection = open_database()?;
    playlist_tracks_for_connection(&connection, playlist_id)
}

pub(super) fn playlist_tracks_for_connection(
    connection: &Connection,
    playlist_id: i64,
) -> Result<Vec<DesktopTrack>, String> {
    let cache_key = query_cache_key("playlist_tracks", json!({ "playlist_id": playlist_id }));
    if let Some(tracks) = read_cached_query::<Vec<DesktopTrack>>(connection, &cache_key) {
        return Ok(tracks);
    }
    let track_columns = qualified_track_columns("tracks");
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns}
            FROM playlist_tracks
            JOIN tracks ON tracks.id = playlist_tracks.track_id
            WHERE playlist_tracks.playlist_id = ?
            ORDER BY playlist_tracks.position ASC, playlist_tracks.id ASC
            "#
        ))
        .map_err(|error| format!("Could not prepare Rust playlist tracks query: {error}"))?;
    let rows = statement
        .query_map(params![playlist_id], track_from_row)
        .map_err(|error| format!("Could not read Rust playlist tracks: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust playlist tracks: {error}"))?;
    write_cached_query(connection, &cache_key, &tracks, Some(tracks.len() as i64));
    Ok(tracks)
}

pub(super) fn compact_playlist_positions(
    connection: &Connection,
    playlist_id: i64,
) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, id ASC",
        )
        .map_err(|error| format!("Could not prepare Rust playlist compact query: {error}"))?;
    let ids = statement
        .query_map(params![playlist_id], |row| row.get::<_, i64>(0))
        .map_err(|error| format!("Could not read Rust playlist positions: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust playlist positions: {error}"))?;
    for (index, id) in ids.into_iter().enumerate() {
        connection
            .execute(
                "UPDATE playlist_tracks SET position = ? WHERE id = ?",
                params![(index + 1) as i64, id],
            )
            .map_err(|error| format!("Could not compact Rust playlist positions: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn create_playlist(
    _state: State<'_, DesktopLibraryState>,
    name: String,
) -> Result<DesktopPlaylistSummary, String> {
    let mut connection = open_database()?;
    let clean_name = name.trim().to_string();
    if clean_name.is_empty() {
        return Err("Playlist name is required".to_string());
    }
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust playlist create: {error}"))?;
    transaction
        .execute("INSERT INTO playlists(name) VALUES(?)", params![clean_name])
        .map_err(|error| format!("Could not create Rust playlist: {error}"))?;
    let playlist = transaction
        .query_row(
            "SELECT id, name, 0 AS track_count, NULL AS duration_seconds, created_at, updated_at
             FROM playlists
             WHERE name = ?",
            params![clean_name],
            playlist_summary_from_row,
        )
        .map_err(|error| format!("Could not read Rust playlist after create: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust playlist create: {error}"))?;
    Ok(playlist)
}

#[tauri::command]
pub fn delete_playlist(
    _state: State<'_, DesktopLibraryState>,
    playlist_id: i64,
) -> Result<Vec<DesktopPlaylistSummary>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust playlist delete: {error}"))?;
    let deleted = transaction
        .execute("DELETE FROM playlists WHERE id = ?", params![playlist_id])
        .map_err(|error| format!("Could not delete Rust playlist: {error}"))?;
    if deleted == 0 {
        return Err("Playlist not found".to_string());
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust playlist delete: {error}"))?;
    playlists_for_connection(&connection)
}

#[tauri::command]
pub fn add_playlist_tracks(
    _state: State<'_, DesktopLibraryState>,
    playlist_id: i64,
    track_ids: Vec<i64>,
) -> Result<Vec<DesktopTrack>, String> {
    let mut connection = open_database()?;
    let unique_ids: Vec<i64> =
        track_ids
            .into_iter()
            .filter(|id| *id > 0)
            .fold(Vec::new(), |mut ids, id| {
                if !ids.contains(&id) {
                    ids.push(id);
                }
                ids
            });
    if unique_ids.is_empty() {
        return playlist_tracks_for_connection(&connection, playlist_id);
    }
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust playlist add: {error}"))?;
    let playlist_exists: Option<i64> = transaction
        .query_row(
            "SELECT id FROM playlists WHERE id = ?",
            params![playlist_id],
            |row| row.get(0),
        )
        .ok();
    if playlist_exists.is_none() {
        return Err("Playlist not found".to_string());
    }
    let placeholders = vec!["?"; unique_ids.len()].join(",");
    let existing: HashSet<i64> = transaction
        .prepare(&format!(
            "SELECT id FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare Rust playlist track check: {error}"))?
        .query_map(
            params_from_iter(unique_ids.iter().copied().map(Value::Integer)),
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not read Rust playlist track check: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust playlist track check: {error}"))?
        .into_iter()
        .collect();
    if let Some(missing_id) = unique_ids.iter().find(|id| !existing.contains(id)) {
        return Err(format!("Track not found: {missing_id}"));
    }
    let mut position = transaction
        .query_row(
            "SELECT coalesce(max(position), 0) FROM playlist_tracks WHERE playlist_id = ?",
            params![playlist_id],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);
    for track_id in unique_ids {
        position += 1;
        transaction
            .execute(
                "INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position) VALUES(?, ?, ?)",
                params![playlist_id, track_id, position],
            )
            .map_err(|error| format!("Could not add Rust playlist track: {error}"))?;
    }
    compact_playlist_positions(&transaction, playlist_id)?;
    transaction
        .execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
            params![playlist_id],
        )
        .map_err(|error| format!("Could not touch Rust playlist: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust playlist tracks: {error}"))?;
    playlist_tracks_for_connection(&connection, playlist_id)
}

#[tauri::command]
pub fn remove_playlist_track(
    _state: State<'_, DesktopLibraryState>,
    playlist_id: i64,
    track_id: i64,
) -> Result<Vec<DesktopTrack>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust playlist remove: {error}"))?;
    let playlist_exists: Option<i64> = transaction
        .query_row(
            "SELECT id FROM playlists WHERE id = ?",
            params![playlist_id],
            |row| row.get(0),
        )
        .ok();
    if playlist_exists.is_none() {
        return Err("Playlist not found".to_string());
    }
    transaction
        .execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            params![playlist_id, track_id],
        )
        .map_err(|error| format!("Could not remove Rust playlist track: {error}"))?;
    compact_playlist_positions(&transaction, playlist_id)?;
    transaction
        .execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
            params![playlist_id],
        )
        .map_err(|error| format!("Could not touch Rust playlist: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust playlist remove: {error}"))?;
    playlist_tracks_for_connection(&connection, playlist_id)
}

#[tauri::command]
pub fn move_playlist_track(
    _state: State<'_, DesktopLibraryState>,
    playlist_id: i64,
    track_id: i64,
    direction: String,
) -> Result<Vec<DesktopTrack>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust playlist move: {error}"))?;
    let row = transaction
        .query_row(
            "SELECT id, position FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            params![playlist_id, track_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .map_err(|error| format!("Playlist track not found: {error}"))?;
    let moving_up = direction == "up";
    let (operator, ordering) = if moving_up {
        ("<", "DESC")
    } else {
        (">", "ASC")
    };
    let swap = transaction
        .query_row(
            &format!(
                "SELECT id, position
                 FROM playlist_tracks
                 WHERE playlist_id = ? AND position {operator} ?
                 ORDER BY position {ordering}
                 LIMIT 1"
            ),
            params![playlist_id, row.1],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .ok();
    if let Some(swap) = swap {
        transaction
            .execute(
                "UPDATE playlist_tracks SET position = ? WHERE id = ?",
                params![swap.1, row.0],
            )
            .map_err(|error| format!("Could not move Rust playlist track: {error}"))?;
        transaction
            .execute(
                "UPDATE playlist_tracks SET position = ? WHERE id = ?",
                params![row.1, swap.0],
            )
            .map_err(|error| format!("Could not move Rust playlist swap: {error}"))?;
        transaction
            .execute(
                "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
                params![playlist_id],
            )
            .map_err(|error| format!("Could not touch Rust playlist: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust playlist move: {error}"))?;
    playlist_tracks_for_connection(&connection, playlist_id)
}
