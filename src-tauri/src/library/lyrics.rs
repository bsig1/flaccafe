use rusqlite::{params, OptionalExtension};
use serde_json::Value as JsonValue;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

use super::{
    database_path, get_setting, open_database, track_from_row, DesktopLibraryState,
    DesktopLyricsResponse, DesktopTrack, TRACK_COLUMNS,
};

const LRCLIB_API_URL: &str = "https://lrclib.net/api/get";
const LRCLIB_SEARCH_URL: &str = "https://lrclib.net/api/search";
const FLAC_CAFE_USER_AGENT: &str = "FLAC Cafe/0.5";

async fn run_lyrics_blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("Lyrics task failed: {error}"))?
}

fn normalize_lyrics(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.replace("\r\n", "\n").replace('\r', "\n"))
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

pub(super) fn database_lyrics(track_id: i64) -> Result<Option<DesktopLyricsResponse>, String> {
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
    Ok(Some(DesktopLyricsResponse {
        track_id,
        lyrics: Some(lyrics),
        source: source.or_else(|| Some("database".to_string())),
        is_synced: is_synced.unwrap_or(0) != 0,
        sidecar_path,
    }))
}

pub(super) fn save_database_lyrics(
    track_id: i64,
    lyrics: String,
    source: String,
    is_synced: bool,
    sidecar_path: Option<String>,
) -> Result<DesktopLyricsResponse, String> {
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
    Ok(DesktopLyricsResponse {
        track_id,
        lyrics: Some(lyrics),
        source: Some(source),
        is_synced,
        sidecar_path,
    })
}

fn clear_database_lyrics(track_id: i64) -> Result<(), String> {
    let connection = open_database()?;
    connection
        .execute(
            "DELETE FROM track_lyrics WHERE track_id = ?",
            params![track_id],
        )
        .map_err(|error| format!("Could not clear database lyrics: {error}"))?;
    Ok(())
}

pub(super) fn save_cached_online_lyrics(
    track: &DesktopTrack,
    response: DesktopLyricsResponse,
    write_sidecar: bool,
) -> Result<DesktopLyricsResponse, String> {
    let Some(lyrics) = normalize_lyrics(response.lyrics.clone()) else {
        return Ok(response);
    };
    let mut sidecar_path = None;
    if write_sidecar {
        let sidecar = cached_lyrics_path(track, response.is_synced);
        if let Some(parent) = sidecar.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create lyric sidecar folder: {error}"))?;
        }
        fs::write(&sidecar, format!("{lyrics}\n"))
            .map_err(|error| format!("Could not write lyric sidecar: {error}"))?;
        sidecar_path = Some(sidecar.to_string_lossy().to_string());
    }
    save_database_lyrics(
        track.id,
        lyrics,
        format!(
            "{}:{}",
            if write_sidecar { "sidecar-cache" } else { "database-cache" },
            response.source.as_deref().unwrap_or("lrclib")
        ),
        response.is_synced,
        sidecar_path,
    )
}

pub(super) fn truthy_setting_value(value: Option<String>) -> bool {
    matches!(
        value.as_deref().map(str::trim),
        Some("1" | "true" | "True" | "yes" | "on")
    )
}

fn track_by_id(track_id: i64) -> Result<DesktopTrack, String> {
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

pub(super) fn display_title(track: &DesktopTrack) -> String {
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

fn cached_lyrics_path(track: &DesktopTrack, is_synced: bool) -> PathBuf {
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

fn lyrics_response_from_json(track_id: i64, payload: &JsonValue) -> Option<DesktopLyricsResponse> {
    let synced = normalize_lyrics(
        payload
            .get("syncedLyrics")
            .and_then(JsonValue::as_str)
            .map(str::to_string),
    );
    let plain = normalize_lyrics(
        payload
            .get("plainLyrics")
            .and_then(JsonValue::as_str)
            .map(str::to_string),
    );
    let text = synced.clone().or(plain);
    text.map(|lyrics| DesktopLyricsResponse {
        track_id,
        lyrics: Some(lyrics),
        source: Some(if synced.is_some() {
            "lrclib:synced".to_string()
        } else {
            "lrclib:plain".to_string()
        }),
        is_synced: synced.is_some(),
        sidecar_path: None,
    })
}

fn primary_artist_name(value: &str) -> String {
    let first = value
        .split([';', '|'])
        .next()
        .unwrap_or(value)
        .trim()
        .to_string();
    let lower = first.to_ascii_lowercase();
    for marker in [" feat.", " feat ", " featuring ", " with "] {
        if let Some(index) = lower.find(marker) {
            return first[..index].trim().to_string();
        }
    }
    if first.is_empty() {
        value.trim().to_string()
    } else {
        first
    }
}

fn lrclib_read_json(url: &str, params: &[(&str, String)]) -> Result<JsonValue, String> {
    let mut request = ureq::get(url).set("User-Agent", FLAC_CAFE_USER_AGENT);
    for (key, value) in params {
        request = request.query(key, value);
    }
    match request.call() {
        Ok(response) => response
            .into_json::<JsonValue>()
            .map_err(|error| format!("Lyric lookup returned invalid JSON: {error}")),
        Err(ureq::Error::Status(404, _)) => Err("not_found".to_string()),
        Err(ureq::Error::Status(status, response)) => {
            let message = response
                .into_string()
                .unwrap_or_default()
                .trim()
                .chars()
                .take(300)
                .collect::<String>();
            if message.is_empty() {
                Err(format!("HTTP {status}"))
            } else {
                Err(format!("HTTP {status}: {message}"))
            }
        }
        Err(error) => Err(error.to_string()),
    }
}

pub(super) fn lrclib_fetch(
    track_id: i64,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration_seconds: Option<f64>,
) -> Result<DesktopLyricsResponse, String> {
    let mut params = vec![
        ("track_name", title.trim().to_string()),
        ("artist_name", primary_artist_name(artist)),
    ];
    if let Some(album) = album.map(str::trim).filter(|value| !value.is_empty()) {
        params.push(("album_name", album.to_string()));
    }
    let mut last_error: Option<String> = None;
    if params.iter().any(|(key, _)| *key == "album_name") {
        if let Some(duration) = duration_seconds.filter(|value| *value > 0.0) {
            let mut exact_params = params.clone();
            exact_params.push(("duration", duration.round().to_string()));
            match lrclib_read_json(LRCLIB_API_URL, &exact_params) {
                Ok(payload) => {
                    if let Some(response) = lyrics_response_from_json(track_id, &payload) {
                        return Ok(response);
                    }
                }
                Err(error) if error == "not_found" => last_error = Some(error),
                Err(error) if error.starts_with("HTTP ") => {
                    return Err(format!("Lyric lookup failed: {error}"));
                }
                Err(error) => last_error = Some(error),
            }
        }
    }

    match lrclib_read_json(LRCLIB_SEARCH_URL, &params) {
        Ok(JsonValue::Array(candidates)) => {
            for candidate in candidates {
                if let Some(response) = lyrics_response_from_json(track_id, &candidate) {
                    return Ok(response);
                }
            }
        }
        Ok(payload) => {
            if let Some(response) = lyrics_response_from_json(track_id, &payload) {
                return Ok(response);
            }
        }
        Err(error) if error == "not_found" => return Err("No matching lyrics found".to_string()),
        Err(error) => {
            let detail = last_error.unwrap_or(error);
            return Err(format!("Lyric lookup failed: {detail}"));
        }
    }
    Err("No lyrics text found".to_string())
}

fn track_lyrics_core(track_id: i64) -> Result<DesktopLyricsResponse, String> {
    if let Some(response) = database_lyrics(track_id)? {
        return Ok(response);
    }
    let track = track_by_id(track_id)?;
    match super::metadata::read_embedded_lyrics(Path::new(&track.path))? {
        Some((lyrics, is_synced)) => Ok(DesktopLyricsResponse {
            track_id,
            lyrics: Some(lyrics),
            source: Some("embedded".to_string()),
            is_synced,
            sidecar_path: None,
        }),
        None => Ok(DesktopLyricsResponse {
            track_id,
            lyrics: None,
            source: None,
            is_synced: false,
            sidecar_path: None,
        }),
    }
}

pub fn track_lyrics(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
) -> Result<DesktopLyricsResponse, String> {
    track_lyrics_core(track_id)
}

#[tauri::command]
pub async fn track_lyrics_direct(track_id: i64) -> Result<DesktopLyricsResponse, String> {
    run_lyrics_blocking(move || track_lyrics_core(track_id)).await
}

fn update_database_lyrics_core(
    track_id: i64,
    lyrics: Option<String>,
    is_synced: Option<bool>,
    source: Option<String>,
) -> Result<DesktopLyricsResponse, String> {
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
        return Ok(DesktopLyricsResponse {
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

pub fn update_database_lyrics(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
    lyrics: Option<String>,
    is_synced: Option<bool>,
    source: Option<String>,
) -> Result<DesktopLyricsResponse, String> {
    update_database_lyrics_core(track_id, lyrics, is_synced, source)
}

fn update_file_lyrics_core(
    track_id: i64,
    lyrics: Option<String>,
    is_synced: Option<bool>,
) -> Result<DesktopLyricsResponse, String> {
    let track = track_by_id(track_id)?;
    let text = normalize_lyrics(lyrics);
    super::metadata::write_embedded_lyrics(
        Path::new(&track.path),
        text.as_deref(),
        is_synced.unwrap_or(false),
    )?;
    if let Some(lyrics) = text.clone() {
        save_database_lyrics(
            track_id,
            lyrics,
            "embedded".to_string(),
            is_synced.unwrap_or(false),
            None,
        )?;
    } else {
        clear_database_lyrics(track_id)?;
    }
    Ok(DesktopLyricsResponse {
        track_id,
        lyrics: text,
        source: Some("embedded".to_string()),
        is_synced: is_synced.unwrap_or(false),
        sidecar_path: None,
    })
}

pub fn update_file_lyrics(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
    lyrics: Option<String>,
    is_synced: Option<bool>,
) -> Result<DesktopLyricsResponse, String> {
    update_file_lyrics_core(track_id, lyrics, is_synced)
}

#[tauri::command]
pub async fn update_track_lyrics_direct(
    track_id: i64,
    lyrics: Option<String>,
    is_synced: Option<bool>,
    target: Option<String>,
    source: Option<String>,
) -> Result<DesktopLyricsResponse, String> {
    run_lyrics_blocking(move || {
        if target
            .as_deref()
            .is_some_and(|value| value.eq_ignore_ascii_case("file"))
        {
            update_file_lyrics_core(track_id, lyrics, is_synced)
        } else {
            update_database_lyrics_core(track_id, lyrics, is_synced, source)
        }
    })
    .await
}

fn lookup_lyrics_by_metadata_core(body: JsonValue) -> Result<DesktopLyricsResponse, String> {
    let title = json_string(&body, "title")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Track title and artist are required for lyric lookup".to_string())?;
    let artist = json_string(&body, "artist")
        .or_else(|| json_string(&body, "album_artist"))
        .or_else(|| json_string(&body, "albumArtist"))
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Track title and artist are required for lyric lookup".to_string())?;
    lrclib_fetch(
        json_i64(&body, "track_id")
            .or_else(|| json_i64(&body, "trackId"))
            .unwrap_or(0),
        title.trim(),
        artist.trim(),
        json_string(&body, "album").as_deref(),
        None,
    )
}

pub fn lookup_lyrics_by_metadata(
    _state: State<'_, DesktopLibraryState>,
    body: JsonValue,
) -> Result<DesktopLyricsResponse, String> {
    lookup_lyrics_by_metadata_core(body)
}

#[tauri::command]
pub async fn lookup_lyrics_by_metadata_direct(
    body: JsonValue,
) -> Result<DesktopLyricsResponse, String> {
    run_lyrics_blocking(move || lookup_lyrics_by_metadata_core(body)).await
}

fn fetch_track_lyrics_core(track_id: i64) -> Result<DesktopLyricsResponse, String> {
    let track = track_by_id(track_id)?;
    let connection = open_database()?;
    let auto_write_sidecar = get_setting(&connection, "auto_write_fetched_lyrics_sidecars")
        .map_or(true, |value| truthy_setting_value(Some(value)));
    let response = lrclib_fetch(
        track.id,
        &display_title(&track),
        track.artist.as_deref().unwrap_or_default(),
        track.album.as_deref(),
        track.duration_seconds,
    )?;
    if !auto_write_sidecar {
        return Ok(response);
    }
    save_cached_online_lyrics(&track, response, true)
}

pub fn fetch_track_lyrics(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
) -> Result<DesktopLyricsResponse, String> {
    fetch_track_lyrics_core(track_id)
}

#[tauri::command]
pub async fn fetch_track_lyrics_direct(track_id: i64) -> Result<DesktopLyricsResponse, String> {
    run_lyrics_blocking(move || fetch_track_lyrics_core(track_id)).await
}

fn json_string(value: &JsonValue, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(JsonValue::as_str)
        .map(str::to_string)
}

fn json_i64(value: &JsonValue, key: &str) -> Option<i64> {
    value.get(key).and_then(JsonValue::as_i64)
}
