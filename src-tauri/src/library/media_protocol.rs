use std::path::{Path, PathBuf};

use rusqlite::params;
use tauri::http::{header, Method, Request, Response, StatusCode};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::{metadata, normalized_path_key, open_database};

const ARTWORK_CACHE_KEY_VERSION: &str = "v2";

fn response_with_status(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(message.as_bytes().to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn preflight_response() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range, Content-Type")
        .header(header::ACCESS_CONTROL_MAX_AGE, "86400")
        .body(Vec::new())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn image_media_type(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

fn artwork_cache_key(path: &Path) -> String {
    format!(
        "{}:{}",
        ARTWORK_CACHE_KEY_VERSION,
        normalized_path_key(&path.to_string_lossy())
    )
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

fn track_path(track_id: i64) -> Result<PathBuf, String> {
    let connection = open_database()?;
    let path: String = connection
        .query_row(
            "SELECT path FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .map_err(|_| "Track not found".to_string())?;
    let path = PathBuf::from(path);
    if !path.exists() || !path.is_file() {
        return Err("Audio file not found on disk".to_string());
    }
    Ok(path)
}

fn artwork_response(
    request: &Request<Vec<u8>>,
    bytes: Vec<u8>,
    media_type: &str,
) -> Response<Vec<u8>> {
    let content_len = bytes.len();
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, media_type)
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CONTENT_LENGTH, content_len.to_string())
        .body(if request.method() == Method::HEAD {
            Vec::new()
        } else {
            bytes
        })
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn sidecar_artwork_is_album_scoped(connection: &rusqlite::Connection, path: &Path) -> bool {
    let Some(parent) = path.parent() else {
        return false;
    };
    let mut folder_prefix = normalized_path_key(&parent.to_string_lossy());
    if !folder_prefix.ends_with(std::path::MAIN_SEPARATOR) {
        folder_prefix.push(std::path::MAIN_SEPARATOR);
    }
    let pattern = format!("{}%", escape_sql_like(&folder_prefix));
    let album_count = connection
        .query_row(
            "
            SELECT count(DISTINCT coalesce(album_id, -id))
            FROM tracks
            WHERE path_key LIKE ? ESCAPE ?
            ",
            params![pattern, "\\"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);
    album_count <= 1
}

fn sidecar_artwork(
    connection: &rusqlite::Connection,
    path: &Path,
) -> Option<(Vec<u8>, &'static str)> {
    if !sidecar_artwork_is_album_scoped(connection, path) {
        return None;
    }
    let preferred_names = [
        "cover",
        "folder",
        "front",
        "album",
        "albumart",
        "albumartsmall",
    ];
    let parent = path.parent()?;
    let mut candidates = parent
        .read_dir()
        .ok()?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    candidates.sort_by_key(|entry| entry.file_name().to_string_lossy().to_ascii_lowercase());
    for entry in candidates {
        let candidate = entry.path();
        if !candidate.is_file() {
            continue;
        }
        let Some(media_type) = image_media_type(&candidate) else {
            continue;
        };
        let stem = candidate
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .replace(' ', "")
            .to_ascii_lowercase();
        if preferred_names.iter().any(|name| *name == stem) {
            if let Ok(bytes) = std::fs::read(&candidate) {
                return Some((bytes, media_type));
            }
        }
    }
    None
}

fn file_state(path: &Path) -> Option<(String, i64)> {
    let metadata = path.metadata().ok()?;
    let modified = metadata.modified().ok()?;
    let modified_at = OffsetDateTime::from(modified)
        .replace_microsecond(0)
        .ok()?
        .format(&Rfc3339)
        .ok()?;
    Some((modified_at, i64::try_from(metadata.len()).ok()?))
}

fn store_artwork_cache(
    connection: &rusqlite::Connection,
    path: &Path,
    path_key: &str,
    file_modified_at: &str,
    file_size: i64,
    media_type: &str,
    data: &[u8],
) {
    let _ = connection.execute(
        "INSERT INTO artwork_cache(path_key, path, file_modified_at, file_size, media_type, data, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(path_key) DO UPDATE SET
           path = excluded.path,
           file_modified_at = excluded.file_modified_at,
           file_size = excluded.file_size,
           media_type = excluded.media_type,
           data = excluded.data,
           updated_at = excluded.updated_at",
        params![
            path_key,
            path.to_string_lossy(),
            file_modified_at,
            file_size,
            media_type,
            data
        ],
    );
}

fn cached_artwork(track_id: i64) -> Option<(Vec<u8>, String)> {
    let path = track_path(track_id).ok()?;
    let connection = open_database().ok()?;
    let path_key = artwork_cache_key(&path);
    let (file_modified_at, file_size) = file_state(&path)?;
    let cached = connection
        .query_row(
            "SELECT data, media_type
             FROM artwork_cache
             WHERE path_key = ? AND file_modified_at = ? AND file_size = ?
             ORDER BY updated_at DESC LIMIT 1",
            params![path_key, file_modified_at, file_size],
            |row| Ok((row.get::<_, Vec<u8>>(0)?, row.get::<_, String>(1)?)),
        )
        .ok();
    cached
        .or_else(|| {
            metadata::read_embedded_artwork(&path)
                .ok()
                .flatten()
                .map(|(bytes, media_type)| {
                    store_artwork_cache(
                        &connection,
                        &path,
                        &path_key,
                        &file_modified_at,
                        file_size,
                        &media_type,
                        &bytes,
                    );
                    (bytes, media_type)
                })
        })
        .or_else(|| {
            sidecar_artwork(&connection, &path).map(|(bytes, media_type)| {
                store_artwork_cache(
                    &connection,
                    &path,
                    &path_key,
                    &file_modified_at,
                    file_size,
                    media_type,
                    &bytes,
                );
                (bytes, media_type.to_string())
            })
        })
}

fn selected_album_artwork_for_track(track_id: i64) -> Option<(Vec<u8>, &'static str)> {
    let connection = open_database().ok()?;
    let artwork_path: Option<String> = connection
        .query_row(
            "SELECT albums.artwork_path
             FROM tracks
             LEFT JOIN albums ON albums.id = tracks.album_id
             WHERE tracks.id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .ok()?;
    let path = PathBuf::from(artwork_path?);
    let media_type = image_media_type(&path)?;
    let bytes = std::fs::read(&path).ok()?;
    Some((bytes, media_type))
}

fn serve_track_artwork(request: &Request<Vec<u8>>, track_id: i64) -> Response<Vec<u8>> {
    if track_id > 0 {
        if let Some((bytes, media_type)) = selected_album_artwork_for_track(track_id) {
            return artwork_response(request, bytes, media_type);
        }
        if let Some((bytes, media_type)) = cached_artwork(track_id) {
            return artwork_response(request, bytes, &media_type);
        }
    }
    response_with_status(StatusCode::NOT_FOUND, "Track artwork not found")
}

fn album_track_ids(album_id: i64) -> Result<(Option<String>, Vec<i64>), String> {
    let connection = open_database()?;
    let (album, album_artist, artwork_path): (Option<String>, Option<String>, Option<String>) =
        connection
            .query_row(
                "SELECT album, album_artist, artwork_path FROM albums WHERE id = ?",
                params![album_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|_| "Album not found".to_string())?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT tracks.id
            FROM tracks
            JOIN albums AS track_albums ON track_albums.id = tracks.album_id
            WHERE lower(trim(coalesce(track_albums.album, ''))) = lower(trim(coalesce(?, '')))
              AND lower(trim(coalesce(track_albums.album_artist, ''))) = lower(trim(coalesce(?, '')))
            ORDER BY coalesce(tracks.disc_number, 0),
                     coalesce(tracks.track_number, 0),
                     lower(coalesce(tracks.title, '')),
                     tracks.id
            "#,
        )
        .map_err(|error| format!("Could not prepare album artwork tracks: {error}"))?;
    let rows = statement
        .query_map(params![album, album_artist], |row| row.get::<_, i64>(0))
        .map_err(|error| format!("Could not read album artwork tracks: {error}"))?;
    let track_ids = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode album artwork tracks: {error}"))?;
    Ok((artwork_path, track_ids))
}

fn serve_album_artwork(request: &Request<Vec<u8>>, album_id: i64) -> Response<Vec<u8>> {
    if album_id > 0 {
        if let Ok((artwork_path, track_ids)) = album_track_ids(album_id) {
            if let Some(artwork_path) = artwork_path {
                let path = PathBuf::from(artwork_path);
                if let Some(media_type) = image_media_type(&path) {
                    if let Ok(bytes) = std::fs::read(&path) {
                        return artwork_response(request, bytes, media_type);
                    }
                }
            }
            for track_id in track_ids {
                if let Some((bytes, media_type)) = cached_artwork(track_id) {
                    return artwork_response(request, bytes, &media_type);
                }
            }
        }
    }
    response_with_status(StatusCode::NOT_FOUND, "Album artwork not found")
}

pub fn handle_media_protocol<R: tauri::Runtime>(
    _ctx: tauri::UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    if request.method() == Method::OPTIONS {
        return preflight_response();
    }
    let path = request.uri().path().trim_matches('/');
    let parts = path.split('/').collect::<Vec<_>>();
    if parts.len() != 2 {
        return response_with_status(StatusCode::NOT_FOUND, "Unknown FLAC Cafe media path");
    }
    let track_id = match parts[1].parse::<i64>() {
        Ok(value) => value,
        Err(_) => return response_with_status(StatusCode::BAD_REQUEST, "Invalid track id"),
    };
    match parts[0] {
        "album-artwork" => serve_album_artwork(&request, track_id),
        "track-artwork" => serve_track_artwork(&request, track_id),
        _ => response_with_status(StatusCode::NOT_FOUND, "Unknown FLAC Cafe media path"),
    }
}
