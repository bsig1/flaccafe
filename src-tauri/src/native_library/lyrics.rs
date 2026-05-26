use rusqlite::{params, OptionalExtension};
use tauri::State;

use super::{open_database, NativeLibraryState, NativeLyricsResponse};

fn normalize_lyrics(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.replace("\r\n", "\n").replace('\r', "\n"))
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn database_lyrics(track_id: i64) -> Result<Option<NativeLyricsResponse>, String> {
    let connection = open_database()?;
    let row = connection
        .query_row(
            r#"
            SELECT lyrics, source, is_synced, sidecar_path
            FROM track_lyrics
            WHERE track_id = ?
            "#,
            params![track_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>("lyrics")?,
                    row.get::<_, Option<String>>("source")?,
                    row.get::<_, Option<i64>>("is_synced")?,
                    row.get::<_, Option<String>>("sidecar_path")?,
                ))
            },
        )
        .optional()
        .map_err(|error| format!("Could not read lyrics from SQLite: {error}"))?;
    let Some((lyrics, source, is_synced, sidecar_path)) = row else {
        return Ok(None);
    };
    let Some(lyrics) = normalize_lyrics(lyrics) else {
        return Ok(None);
    };
    Ok(Some(NativeLyricsResponse {
        track_id,
        lyrics: Some(lyrics),
        source: source.or_else(|| Some("database".to_string())),
        is_synced: is_synced.unwrap_or(0) != 0,
        sidecar_path,
    }))
}

pub fn native_track_database_lyrics(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
) -> Result<Option<NativeLyricsResponse>, String> {
    database_lyrics(track_id)
}

pub fn native_update_database_lyrics(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    lyrics: Option<String>,
    is_synced: Option<bool>,
    source: Option<String>,
) -> Result<NativeLyricsResponse, String> {
    let text = normalize_lyrics(lyrics);
    let connection = open_database()?;
    let exists = connection
        .query_row(
            "SELECT 1 FROM tracks WHERE id = ?",
            params![track_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(|error| format!("Could not check track before lyrics update: {error}"))?
        .is_some();
    if !exists {
        return Err("Track not found".to_string());
    }
    let Some(text) = text else {
        connection
            .execute(
                "DELETE FROM track_lyrics WHERE track_id = ?",
                params![track_id],
            )
            .map_err(|error| format!("Could not clear database lyrics: {error}"))?;
        return Ok(NativeLyricsResponse {
            track_id,
            lyrics: None,
            source: None,
            is_synced: false,
            sidecar_path: None,
        });
    };
    let source = source
        .map(|value| value.trim().chars().take(120).collect::<String>())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "database:manual".to_string());
    let synced = is_synced.unwrap_or(false);
    connection
        .execute(
            r#"
            INSERT INTO track_lyrics(track_id, lyrics, source, is_synced, sidecar_path, updated_at)
            VALUES(?, ?, ?, ?, NULL, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET
              lyrics = excluded.lyrics,
              source = excluded.source,
              is_synced = excluded.is_synced,
              sidecar_path = excluded.sidecar_path,
              updated_at = datetime('now')
            "#,
            params![track_id, text, source, if synced { 1 } else { 0 }],
        )
        .map_err(|error| format!("Could not save database lyrics: {error}"))?;
    Ok(NativeLyricsResponse {
        track_id,
        lyrics: Some(text),
        source: Some(source),
        is_synced: synced,
        sidecar_path: None,
    })
}
