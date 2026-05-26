use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value as JsonValue;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::storage::open_database;
use super::types::*;

const PREFERRED_SIDECAR_NAMES: &[&str] = &[
    "cover",
    "folder",
    "front",
    "album",
    "albumart",
    "albumartsmall",
];

struct AlbumRecord {
    album: Option<String>,
    album_artist: Option<String>,
    artwork_path: Option<String>,
}

struct AlbumTrack {
    path: String,
}

pub(crate) fn update_album_artwork(
    album_id: i64,
    body: JsonValue,
) -> Result<Option<DesktopAlbumArtworkUpdateResponse>, String> {
    let embed_to_files = json_bool(&body, "embed_to_files")
        .or_else(|| json_bool(&body, "embedToFiles"))
        .unwrap_or(false);
    let embedded_track_id =
        json_i64(&body, "embedded_track_id").or_else(|| json_i64(&body, "embeddedTrackId"));
    if embed_to_files || embedded_track_id.is_some() {
        return Ok(None);
    }

    let connection = open_database()?;
    album_record(&connection, album_id)?;
    let artwork_path: Option<String>;

    if json_bool(&body, "clear").unwrap_or(false) {
        artwork_path = None;
        connection
            .execute(
                "UPDATE albums SET artwork_path = NULL WHERE id = ?",
                params![album_id],
            )
            .map_err(|error| format!("Could not clear album artwork: {error}"))?;
    } else if let Some(path) = json_string(&body, "artwork_path")
        .or_else(|| json_string(&body, "artworkPath"))
        .filter(|value| !value.trim().is_empty())
    {
        let candidate = absolute_path(Path::new(path.trim()));
        let media_type = image_media_type(&candidate)
            .ok_or_else(|| "Artwork path must be a local jpg, png, or webp file".to_string())?;
        if !candidate.is_file() {
            return Err("Artwork path must be a local jpg, png, or webp file".to_string());
        }
        if media_type == "image/webp" && embed_to_files {
            return Ok(None);
        }
        artwork_path = Some(candidate.to_string_lossy().to_string());
        connection
            .execute(
                "UPDATE albums SET artwork_path = ? WHERE id = ?",
                params![artwork_path, album_id],
            )
            .map_err(|error| format!("Could not save album artwork path: {error}"))?;
    } else if let Some(url) = json_string(&body, "artwork_url")
        .or_else(|| json_string(&body, "artworkUrl"))
        .filter(|value| !value.trim().is_empty())
    {
        let save_sidecar = json_bool(&body, "save_web_as_sidecar")
            .or_else(|| json_bool(&body, "saveWebAsSidecar"))
            .unwrap_or(false);
        if !save_sidecar {
            return Ok(None);
        }
        let (bytes, media_type) = download_cover_art(url.trim())?;
        let (folder, _tracks) = album_primary_folder_and_tracks(&connection, album_id)?;
        let filename = json_string(&body, "sidecar_filename")
            .or_else(|| json_string(&body, "sidecarFilename"))
            .unwrap_or_else(|| "cover-web".to_string());
        let target = unique_sidecar_artwork_path(&folder, &filename, &media_type)?;
        fs::write(&target, bytes)
            .map_err(|error| format!("Could not save web artwork: {error}"))?;
        artwork_path = Some(absolute_path(&target).to_string_lossy().to_string());
        connection
            .execute(
                "UPDATE albums SET artwork_path = ? WHERE id = ?",
                params![artwork_path, album_id],
            )
            .map_err(|error| format!("Could not save web album artwork path: {error}"))?;
    } else {
        return Ok(None);
    }

    let _ = connection.execute("DELETE FROM artwork_cache", []);
    Ok(Some(DesktopAlbumArtworkUpdateResponse {
        album_id,
        artwork_path,
        candidates: album_artwork_candidates(&connection, album_id)?,
        embedded_updated: 0,
        errors: Vec::new(),
    }))
}

pub(crate) fn album_artwork_candidates(
    connection: &Connection,
    album_id: i64,
) -> Result<Vec<DesktopAlbumArtworkCandidate>, String> {
    let album = album_record(connection, album_id)?;
    let selected_path = album.artwork_path.as_deref().map(PathBuf::from);
    let tracks = album_tracks(connection, &album)?;
    let mut candidates = Vec::new();
    let mut seen = Vec::<String>::new();

    if let Some(selected_path) = selected_path.as_deref() {
        push_candidate(
            &mut candidates,
            &mut seen,
            image_candidate(selected_path, "selected", Some(selected_path)),
        );
    }

    let mut folders = Vec::<PathBuf>::new();
    for track in &tracks {
        let folder = PathBuf::from(&track.path)
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_default();
        let folder = absolute_path(&folder);
        if !folders.iter().any(|existing| existing == &folder) {
            folders.push(folder);
        }
    }

    for folder in folders {
        let mut images = match fs::read_dir(&folder) {
            Ok(read_dir) => read_dir
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.is_file() && image_media_type(path).is_some())
                .collect::<Vec<_>>(),
            Err(_) => continue,
        };
        images.sort_by_key(|path| {
            let stem = path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .replace(' ', "")
                .to_ascii_lowercase();
            (
                if PREFERRED_SIDECAR_NAMES.contains(&stem.as_str()) {
                    0
                } else {
                    1
                },
                path.file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase(),
            )
        });
        for image in images.into_iter().take(20) {
            push_candidate(
                &mut candidates,
                &mut seen,
                image_candidate(&image, "sidecar", selected_path.as_deref()),
            );
        }
    }

    Ok(candidates)
}

fn push_candidate(
    candidates: &mut Vec<DesktopAlbumArtworkCandidate>,
    seen: &mut Vec<String>,
    candidate: Option<DesktopAlbumArtworkCandidate>,
) {
    let Some(candidate) = candidate else {
        return;
    };
    let identity = candidate
        .path
        .clone()
        .unwrap_or_else(|| format!("embedded:{}", candidate.track_id.unwrap_or_default()));
    if seen.iter().any(|value| value == &identity) {
        return;
    }
    seen.push(identity);
    candidates.push(candidate);
}

fn album_record(connection: &Connection, album_id: i64) -> Result<AlbumRecord, String> {
    connection
        .query_row(
            "SELECT album, album_artist, artwork_path FROM albums WHERE id = ?",
            params![album_id],
            |row| {
                Ok(AlbumRecord {
                    album: row.get(0)?,
                    album_artist: row.get(1)?,
                    artwork_path: row.get(2)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("Could not read album: {error}"))?
        .ok_or_else(|| "Album not found".to_string())
}

fn album_tracks(connection: &Connection, album: &AlbumRecord) -> Result<Vec<AlbumTrack>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT tracks.path
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
        .query_map(params![album.album, album.album_artist], |row| {
            Ok(AlbumTrack {
                path: row.get("path")?,
            })
        })
        .map_err(|error| format!("Could not read album artwork tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode album artwork tracks: {error}"))
}

fn album_primary_folder_and_tracks(
    connection: &Connection,
    album_id: i64,
) -> Result<(PathBuf, Vec<AlbumTrack>), String> {
    let album = album_record(connection, album_id)?;
    let tracks = album_tracks(connection, &album)?;
    let first = tracks
        .first()
        .ok_or_else(|| "Album has no tracks".to_string())?;
    let folder = PathBuf::from(&first.path)
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Album track has no parent folder".to_string())?;
    Ok((absolute_path(&folder), tracks))
}

fn image_candidate(
    path: &Path,
    source: &str,
    selected_path: Option<&Path>,
) -> Option<DesktopAlbumArtworkCandidate> {
    let media_type = image_media_type(path)?;
    let metadata = path.metadata().ok()?;
    if !metadata.is_file() {
        return None;
    }
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|time| OffsetDateTime::from(time).format(&Rfc3339).ok());
    let path = absolute_path(path);
    Some(DesktopAlbumArtworkCandidate {
        source: source.to_string(),
        label: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Artwork")
            .to_string(),
        path: Some(path.to_string_lossy().to_string()),
        track_id: None,
        artwork_url: None,
        thumbnail_url: None,
        release_id: None,
        media_type: Some(media_type.to_string()),
        size_bytes: i64::try_from(metadata.len()).ok(),
        modified_at,
        selected: selected_path
            .map(|selected| same_path_key(selected, &path))
            .unwrap_or(false),
    })
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

fn unique_sidecar_artwork_path(
    folder: &Path,
    filename: &str,
    media_type: &str,
) -> Result<PathBuf, String> {
    let suffix = match media_type {
        "image/png" => ".png",
        "image/webp" => ".webp",
        _ => ".jpg",
    };
    let base_name = sanitize_path_component(
        Path::new(filename)
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("cover"),
    );
    let base_name = if base_name.is_empty() {
        "cover".to_string()
    } else {
        base_name
    };
    let first = folder.join(format!("{base_name}{suffix}"));
    if !first.exists() {
        return Ok(first);
    }
    for index in 2..1000 {
        let candidate = folder.join(format!("{base_name} ({index}){suffix}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("Could not find an available sidecar artwork filename".to_string())
}

fn download_cover_art(url: &str) -> Result<(Vec<u8>, String), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Artwork URL must start with http:// or https://".to_string());
    }
    let response = ureq::get(url)
        .set("User-Agent", "FLAC Cafe/0.5 (local library artwork)")
        .call()
        .map_err(|error| format!("Could not download artwork: {error}"))?;
    let media_type = response
        .header("Content-Type")
        .and_then(|value| value.split(';').next())
        .map(str::trim)
        .unwrap_or("image/jpeg")
        .to_ascii_lowercase();
    if !matches!(
        media_type.as_str(),
        "image/jpeg" | "image/png" | "image/webp"
    ) {
        return Err(format!("Unsupported artwork type: {media_type}"));
    }
    let mut reader = response.into_reader().take(12 * 1024 * 1024);
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(&mut reader, &mut bytes)
        .map_err(|error| format!("Could not read artwork download: {error}"))?;
    if bytes.is_empty() {
        return Err("Downloaded artwork was empty".to_string());
    }
    Ok((bytes, media_type))
}

fn sanitize_path_component(value: &str) -> String {
    let mut text = value.trim().to_string();
    for bad in ['<', '>', ':', '"', '/', '\\', '|', '?', '*'] {
        text = text.replace(bad, "_");
    }
    text.chars()
        .map(|ch| if ch.is_control() { '_' } else { ch })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .chars()
        .take(120)
        .collect()
}

fn absolute_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| {
        if path.is_absolute() {
            path.to_path_buf()
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(path)
        }
    })
}

fn same_path_key(left: &Path, right: &Path) -> bool {
    absolute_path(left)
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase()
        == absolute_path(right)
            .to_string_lossy()
            .replace('\\', "/")
            .to_ascii_lowercase()
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

fn json_bool(value: &JsonValue, key: &str) -> Option<bool> {
    match value.get(key)? {
        JsonValue::Bool(value) => Some(*value),
        JsonValue::String(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}
