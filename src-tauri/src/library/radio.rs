use super::*;

fn radio_station_by_id(
    connection: &Connection,
    station_id: i64,
) -> Result<DesktopRadioStation, String> {
    connection
        .query_row(
            "SELECT id, name, stream_url, homepage_url, genre, notes, last_played_at, created_at, updated_at
             FROM radio_stations
             WHERE id = ?",
            params![station_id],
            radio_station_from_row,
        )
        .map_err(|_| "Radio station not found".to_string())
}

#[tauri::command]
pub fn radio_stations(
    _state: State<'_, DesktopLibraryState>,
) -> Result<Vec<DesktopRadioStation>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, stream_url, homepage_url, genre, notes, last_played_at, created_at, updated_at
             FROM radio_stations
             ORDER BY coalesce(last_played_at, '') DESC, lower(name)",
        )
        .map_err(|error| format!("Could not prepare Rust radio station query: {error}"))?;
    let rows = statement
        .query_map([], radio_station_from_row)
        .map_err(|error| format!("Could not read Rust radio stations: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust radio stations: {error}"))
}

#[tauri::command]
pub fn save_radio_station(
    _state: State<'_, DesktopLibraryState>,
    station_id: Option<i64>,
    name: String,
    stream_url: String,
    homepage_url: Option<String>,
    genre: Option<String>,
    notes: Option<String>,
) -> Result<DesktopRadioStation, String> {
    let name = clean_required_text(name, "Radio station name")?;
    let stream_url = clean_required_text(stream_url, "Radio stream URL")?;
    let connection = open_database()?;
    let row_id = if let Some(station_id) = station_id {
        let updated = connection
            .execute(
                "UPDATE radio_stations
                 SET name = ?, stream_url = ?, homepage_url = ?, genre = ?, notes = ?, updated_at = datetime('now')
                 WHERE id = ?",
                params![
                    name,
                    stream_url,
                    clean_optional_text(homepage_url),
                    clean_optional_text(genre),
                    clean_optional_text(notes),
                    station_id
                ],
            )
            .map_err(|error| format!("Could not update Rust radio station: {error}"))?;
        if updated == 0 {
            return Err("Radio station not found".to_string());
        }
        station_id
    } else {
        connection
            .execute(
                "INSERT INTO radio_stations(name, stream_url, homepage_url, genre, notes)
                 VALUES(?, ?, ?, ?, ?)
                 ON CONFLICT(stream_url) DO UPDATE SET
                   name = excluded.name,
                   homepage_url = excluded.homepage_url,
                   genre = excluded.genre,
                   notes = excluded.notes,
                   updated_at = datetime('now')",
                params![
                    name,
                    stream_url,
                    clean_optional_text(homepage_url),
                    clean_optional_text(genre),
                    clean_optional_text(notes)
                ],
            )
            .map_err(|error| format!("Could not save Rust radio station: {error}"))?;
        connection.last_insert_rowid()
    };
    let resolved_id = if row_id > 0 {
        row_id
    } else {
        connection
            .query_row(
                "SELECT id FROM radio_stations WHERE stream_url = ?",
                params![stream_url],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("Could not find Rust radio station after save: {error}"))?
    };
    radio_station_by_id(&connection, resolved_id)
}

#[tauri::command]
pub fn delete_radio_station(
    _state: State<'_, DesktopLibraryState>,
    station_id: i64,
) -> Result<DesktopDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM radio_stations WHERE id = ?",
            params![station_id],
        )
        .map_err(|error| format!("Could not delete Rust radio station: {error}"))?;
    if deleted == 0 {
        return Err("Radio station not found".to_string());
    }
    Ok(DesktopDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn mark_radio_station_played(
    _state: State<'_, DesktopLibraryState>,
    station_id: i64,
) -> Result<DesktopRadioStation, String> {
    let connection = open_database()?;
    let updated = connection
        .execute(
            "UPDATE radio_stations
             SET last_played_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?",
            params![station_id],
        )
        .map_err(|error| format!("Could not update Rust radio station playback: {error}"))?;
    if updated == 0 {
        return Err("Radio station not found".to_string());
    }
    radio_station_by_id(&connection, station_id)
}
