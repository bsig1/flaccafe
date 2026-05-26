use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use rusqlite::params;
use tauri::http::{header, Method, Request, Response, StatusCode};

use crate::python_worker;

use super::{normalized_path_key, open_database};

fn response_with_status(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(message.as_bytes().to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn percent_decode(value: &str) -> Result<String, String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0usize;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return Err("Malformed encoded media path".to_string());
            }
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3])
                .map_err(|_| "Malformed encoded media path".to_string())?;
            let byte = u8::from_str_radix(hex, 16)
                .map_err(|_| "Malformed encoded media path".to_string())?;
            decoded.push(byte);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).map_err(|_| "Encoded media path was not UTF-8".to_string())
}

fn media_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "flac" => "audio/flac",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "ogg" | "opus" => "audio/ogg",
        "wav" => "audio/wav",
        "aiff" | "aif" => "audio/aiff",
        _ => "application/octet-stream",
    }
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

fn parse_range_header(value: Option<&str>, file_len: u64) -> Option<(u64, u64)> {
    let raw = value?.trim();
    let range = raw.strip_prefix("bytes=")?;
    let (start_text, end_text) = range.split_once('-')?;
    if start_text.is_empty() {
        let suffix_len = end_text.parse::<u64>().ok()?;
        if suffix_len == 0 {
            return None;
        }
        let start = file_len.saturating_sub(suffix_len);
        return Some((start, file_len.saturating_sub(1)));
    }
    let start = start_text.parse::<u64>().ok()?;
    if start >= file_len {
        return None;
    }
    let end = if end_text.trim().is_empty() {
        file_len.saturating_sub(1)
    } else {
        end_text
            .parse::<u64>()
            .ok()?
            .min(file_len.saturating_sub(1))
    };
    if end < start {
        return None;
    }
    Some((start, end))
}

fn serve_audio_file(request: &Request<Vec<u8>>, track_id: i64) -> Response<Vec<u8>> {
    let path = match track_path(track_id) {
        Ok(path) => path,
        Err(error) => return response_with_status(StatusCode::NOT_FOUND, &error),
    };
    let metadata = match path.metadata() {
        Ok(metadata) => metadata,
        Err(error) => {
            return response_with_status(
                StatusCode::NOT_FOUND,
                &format!("Could not read audio file metadata: {error}"),
            )
        }
    };
    let file_len = metadata.len();
    let range_header = request
        .headers()
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok());
    let range = parse_range_header(range_header, file_len);
    if request.method() == Method::HEAD {
        let mut builder = Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, media_type_for_path(&path))
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(header::CONTENT_LENGTH, file_len.to_string());
        if let Some(headers) = builder.headers_mut() {
            headers.insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
        }
        return builder
            .body(Vec::new())
            .unwrap_or_else(|_| Response::new(Vec::new()));
    }

    let mut file = match File::open(&path) {
        Ok(file) => file,
        Err(error) => {
            return response_with_status(
                StatusCode::NOT_FOUND,
                &format!("Could not open audio file: {error}"),
            )
        }
    };
    let (start, end, status) = match range {
        Some((start, end)) => (start, end, StatusCode::PARTIAL_CONTENT),
        None => (0, file_len.saturating_sub(1), StatusCode::OK),
    };
    let read_len = if file_len == 0 {
        0
    } else {
        end.saturating_sub(start).saturating_add(1)
    };
    let mut body = vec![0u8; read_len as usize];
    if read_len > 0 {
        if let Err(error) = file.seek(SeekFrom::Start(start)) {
            return response_with_status(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Could not seek audio file: {error}"),
            );
        }
        if let Err(error) = file.read_exact(&mut body) {
            return response_with_status(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Could not read audio file: {error}"),
            );
        }
    }
    let mut builder = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, media_type_for_path(&path))
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CONTENT_LENGTH, body.len().to_string());
    if status == StatusCode::PARTIAL_CONTENT {
        builder = builder.header(
            header::CONTENT_RANGE,
            format!("bytes {start}-{end}/{file_len}"),
        );
    }
    builder
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn sidecar_artwork(path: &Path) -> Option<(Vec<u8>, &'static str)> {
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

fn cached_artwork(track_id: i64) -> Option<(Vec<u8>, String)> {
    let path = track_path(track_id).ok()?;
    let connection = open_database().ok()?;
    let path_key = normalized_path_key(&path.to_string_lossy());
    let cached = connection
        .query_row(
            "SELECT data, media_type FROM artwork_cache WHERE path_key = ? ORDER BY updated_at DESC LIMIT 1",
            params![path_key],
            |row| Ok((row.get::<_, Vec<u8>>(0)?, row.get::<_, String>(1)?)),
        )
        .ok();
    cached.or_else(|| {
        sidecar_artwork(&path).map(|(bytes, media_type)| (bytes, media_type.to_string()))
    })
}

fn serve_track_artwork(track_id: i64) -> Response<Vec<u8>> {
    if track_id > 0 {
        if let Some((bytes, media_type)) = cached_artwork(track_id) {
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, media_type)
                .header(header::CACHE_CONTROL, "no-store")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(bytes)
                .unwrap_or_else(|_| Response::new(Vec::new()));
        }
    }
    match python_worker::backend_request_bytes(
        "GET",
        &format!("/tracks/{track_id}/artwork"),
        None,
        None,
    ) {
        Ok(response) if (200..300).contains(&response.status) => {
            let content_type = response
                .headers
                .get("content-type")
                .cloned()
                .unwrap_or_else(|| "application/octet-stream".to_string());
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CACHE_CONTROL, "no-store")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(response.body)
                .unwrap_or_else(|_| Response::new(Vec::new()))
        }
        Ok(response) => response_with_status(
            StatusCode::from_u16(response.status).unwrap_or(StatusCode::NOT_FOUND),
            &response.reason,
        ),
        Err(error) => response_with_status(StatusCode::NOT_FOUND, &error),
    }
}

fn serve_python_worker_bytes(request: &Request<Vec<u8>>, encoded_path: &str) -> Response<Vec<u8>> {
    let path = match percent_decode(encoded_path) {
        Ok(path) => path,
        Err(error) => return response_with_status(StatusCode::BAD_REQUEST, &error),
    };
    match python_worker::backend_request_bytes(request.method().as_str(), &path, None, None) {
        Ok(response) if (200..300).contains(&response.status) => {
            let content_type = response
                .headers
                .get("content-type")
                .cloned()
                .unwrap_or_else(|| "application/octet-stream".to_string());
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CACHE_CONTROL, "no-store")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(if request.method() == Method::HEAD {
                    Vec::new()
                } else {
                    response.body
                })
                .unwrap_or_else(|_| Response::new(Vec::new()))
        }
        Ok(response) => response_with_status(
            StatusCode::from_u16(response.status).unwrap_or(StatusCode::NOT_FOUND),
            &response.reason,
        ),
        Err(error) => response_with_status(StatusCode::NOT_FOUND, &error),
    }
}

pub fn handle_media_protocol<R: tauri::Runtime>(
    _ctx: tauri::UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let path = request.uri().path().trim_matches('/');
    let parts = path.split('/').collect::<Vec<_>>();
    if parts.first() == Some(&"python-bytes") && parts.len() >= 2 {
        let encoded_path = path.strip_prefix("python-bytes/").unwrap_or("");
        return serve_python_worker_bytes(&request, encoded_path);
    }
    if parts.len() != 2 {
        return response_with_status(StatusCode::NOT_FOUND, "Unknown FLAC Cafe media path");
    }
    let track_id = match parts[1].parse::<i64>() {
        Ok(value) => value,
        Err(_) => return response_with_status(StatusCode::BAD_REQUEST, "Invalid track id"),
    };
    match parts[0] {
        "track-audio" => serve_audio_file(&request, track_id),
        "track-artwork" => serve_track_artwork(track_id),
        _ => response_with_status(StatusCode::NOT_FOUND, "Unknown FLAC Cafe media path"),
    }
}
