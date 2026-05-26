use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value as JsonValue};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

use super::{
    database_path, get_setting, open_database, track_from_row, NativeLibraryState,
    NativeLyricsResponse, NativeTrack, TRACK_COLUMNS,
};

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

fn save_database_lyrics(
    track_id: i64,
    lyrics: String,
    source: String,
    is_synced: bool,
    sidecar_path: Option<String>,
) -> Result<NativeLyricsResponse, String> {
    let connection = open_database()?;
    connection
        .execute(
            r#"
            INSERT INTO track_lyrics(track_id, lyrics, source, is_synced, sidecar_path, updated_at)
            VALUES(?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET
              lyrics = excluded.lyrics,
              source = excluded.source,
              is_synced = excluded.is_synced,
              sidecar_path = excluded.sidecar_path,
              updated_at = datetime('now')
            "#,
            params![
                track_id,
                &lyrics,
                &source,
                if is_synced { 1 } else { 0 },
                &sidecar_path
            ],
        )
        .map_err(|error| format!("Could not save database lyrics: {error}"))?;
    Ok(NativeLyricsResponse {
        track_id,
        lyrics: Some(lyrics),
        source: Some(source),
        is_synced,
        sidecar_path,
    })
}

fn truthy_setting_value(value: Option<String>) -> bool {
    matches!(
        value.as_deref().map(str::trim),
        Some("1" | "true" | "True" | "yes" | "on")
    )
}

fn track_by_id(track_id: i64) -> Result<NativeTrack, String> {
    let connection = open_database()?;
    connection
        .query_row(
            &format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?"),
            params![track_id],
            track_from_row,
        )
        .optional()
        .map_err(|error| format!("Could not read track for lyrics fetch: {error}"))?
        .ok_or_else(|| "Track not found".to_string())
}

fn sanitize_path_component(value: &str) -> String {
    value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string()
}

fn display_title(track: &NativeTrack) -> String {
    track
        .title
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| {
            Path::new(&track.path)
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("Untitled")
                .to_string()
        })
}

fn lyrics_cache_dir() -> PathBuf {
    database_path()
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("backend").join("data"))
        .join("lyrics")
}

fn cached_lyrics_path(track: &NativeTrack, is_synced: bool) -> PathBuf {
    let artist = sanitize_path_component(track.artist.as_deref().unwrap_or("Unknown Artist"))
        .chars()
        .take(60)
        .collect::<String>();
    let title = sanitize_path_component(&display_title(track))
        .chars()
        .take(80)
        .collect::<String>();
    let extension = if is_synced { "lrc" } else { "txt" };
    lyrics_cache_dir().join(format!(
        "{:08} - {} - {}.{}",
        track.id,
        if artist.is_empty() {
            "Unknown Artist"
        } else {
            &artist
        },
        if title.is_empty() { "Untitled" } else { &title },
        extension
    ))
}

fn lyrics_response_from_json(
    track_id: i64,
    value: JsonValue,
) -> Result<NativeLyricsResponse, String> {
    Ok(NativeLyricsResponse {
        track_id: value
            .get("track_id")
            .and_then(JsonValue::as_i64)
            .unwrap_or(track_id),
        lyrics: value
            .get("lyrics")
            .and_then(JsonValue::as_str)
            .map(str::to_string),
        source: value
            .get("source")
            .and_then(JsonValue::as_str)
            .map(str::to_string),
        is_synced: value
            .get("is_synced")
            .or_else(|| value.get("isSynced"))
            .and_then(JsonValue::as_bool)
            .unwrap_or(false),
        sidecar_path: value
            .get("sidecar_path")
            .or_else(|| value.get("sidecarPath"))
            .and_then(JsonValue::as_str)
            .map(str::to_string),
    })
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
    save_database_lyrics(track_id, text, source, synced, None)
}

pub fn native_fetch_track_lyrics(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
) -> Result<NativeLyricsResponse, String> {
    let track = track_by_id(track_id)?;
    let connection = open_database()?;
    let auto_write_sidecar = truthy_setting_value(get_setting(
        &connection,
        "auto_write_fetched_lyrics_sidecars",
    ));
    let response = crate::python_worker::call_python_action_json(
        "lookup_lyrics_by_metadata",
        json!({}),
        Some(json!({
            "track_id": track.id,
            "title": display_title(&track),
            "artist": track.artist.as_deref(),
            "album": track.album.as_deref(),
            "album_artist": track.album_artist.as_deref(),
            "duration_seconds": track.duration_seconds,
            "path": track.path.as_str(),
        })),
    )?;
    let response = lyrics_response_from_json(track_id, response)?;
    if !auto_write_sidecar {
        return Ok(response);
    }
    let Some(lyrics) = normalize_lyrics(response.lyrics.clone()) else {
        return Ok(response);
    };
    let sidecar = cached_lyrics_path(&track, response.is_synced);
    if let Some(parent) = sidecar.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create lyric sidecar folder: {error}"))?;
    }
    fs::write(&sidecar, format!("{lyrics}\n"))
        .map_err(|error| format!("Could not write lyric sidecar: {error}"))?;
    save_database_lyrics(
        track_id,
        lyrics,
        format!(
            "sidecar-cache:{}",
            response.source.as_deref().unwrap_or("lrclib")
        ),
        response.is_synced,
        Some(sidecar.to_string_lossy().to_string()),
    )
}
