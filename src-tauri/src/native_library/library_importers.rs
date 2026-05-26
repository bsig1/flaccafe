use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};

use super::scan;
use super::types::*;
use super::open_database;

#[derive(Clone)]
struct ImportedStat {
    row_number: i64,
    source: String,
    path: Option<String>,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    rating: Option<f64>,
    play_count: Option<i64>,
    last_played_at: Option<String>,
    error: Option<String>,
}

#[derive(Clone)]
struct TrackMatch {
    id: i64,
    rating: Option<f64>,
    play_count: i64,
    last_played_at: Option<String>,
}

pub fn native_import_external_library_stats(
    source: String,
    import_path: String,
    apply: Option<bool>,
    missing_only: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeLibraryStatsImportResponse, String> {
    let source = source.trim().to_ascii_lowercase();
    if !matches!(
        source.as_str(),
        "musicbee" | "itunes" | "windows_media_player"
    ) {
        return Err("Unsupported importer source".to_string());
    }
    let limit = limit.unwrap_or(500).clamp(1, 100_000);
    let records = parse_import_file(&source, &import_path, limit)?;
    let connection = open_database()?;
    let mut matched = 0i64;
    let mut changed = 0i64;
    let mut applied = 0i64;
    let mut errors = 0i64;
    let mut previews = Vec::new();
    for record in &records {
        let (track, matched_by) = match_record(&connection, record)?;
        let mut changed_fields = Vec::new();
        let mut error = record.error.clone();
        if let Some(track) = track.as_ref() {
            matched += 1;
            let only_missing = missing_only.unwrap_or(false);
            if record.rating.is_some()
                && (!only_missing || track.rating.is_none())
                && record.rating != track.rating
            {
                changed_fields.push("rating".to_string());
            }
            if record.play_count.is_some()
                && (!only_missing || track.play_count == 0)
                && record.play_count != Some(track.play_count)
            {
                changed_fields.push("play_count".to_string());
            }
            if record.last_played_at.is_some()
                && (!only_missing || track.last_played_at.is_none())
                && record.last_played_at != track.last_played_at
            {
                changed_fields.push("last_played_at".to_string());
            }
            if !changed_fields.is_empty() {
                changed += 1;
                if apply.unwrap_or(false) {
                    connection
                        .execute(
                            "UPDATE tracks
                             SET rating = coalesce(?, rating),
                                 play_count = coalesce(?, play_count),
                                 last_played_at = coalesce(?, last_played_at),
                                 updated_at = datetime('now')
                             WHERE id = ?",
                            params![
                                if changed_fields.iter().any(|field| field == "rating") {
                                    record.rating
                                } else {
                                    None
                                },
                                if changed_fields.iter().any(|field| field == "play_count") {
                                    record.play_count
                                } else {
                                    None
                                },
                                if changed_fields.iter().any(|field| field == "last_played_at") {
                                    record.last_played_at.clone()
                                } else {
                                    None
                                },
                                track.id
                            ],
                        )
                        .map_err(|error| format!("Could not apply imported library stats: {error}"))?;
                    scan::clear_library_query_cache(&connection);
                    applied += 1;
                }
            }
        } else {
            error = error.or_else(|| Some("No matching local track".to_string()));
            errors += 1;
        }
        previews.push(NativeLibraryStatsImportPreview {
            row_number: record.row_number,
            source: record.source.clone(),
            path: record.path.clone(),
            title: record.title.clone(),
            artist: record.artist.clone(),
            album: record.album.clone(),
            track_id: track.as_ref().map(|track| track.id),
            matched_by,
            imported_rating: record.rating,
            imported_play_count: record.play_count,
            imported_last_played_at: record.last_played_at.clone(),
            current_rating: track.as_ref().and_then(|track| track.rating),
            current_play_count: track.as_ref().map(|track| track.play_count),
            current_last_played_at: track.as_ref().and_then(|track| track.last_played_at.clone()),
            changed_fields,
            error,
        });
    }
    Ok(NativeLibraryStatsImportResponse {
        source,
        import_path,
        total_rows: records.len() as i64,
        matched,
        changed,
        applied,
        errors,
        previews,
    })
}

fn parse_import_file(
    source: &str,
    import_path: &str,
    limit: usize,
) -> Result<Vec<ImportedStat>, String> {
    let path = PathBuf::from(import_path.trim());
    if !path.exists() || !path.is_file() {
        return Err("Import file does not exist".to_string());
    }
    match source {
        "musicbee" => parse_musicbee_csv(&path, limit),
        "itunes" => parse_itunes_xml(&path, limit),
        _ => parse_windows_media_player_xml(&path, limit),
    }
}

fn parse_musicbee_csv(path: &Path, limit: usize) -> Result<Vec<ImportedStat>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_path(path)
        .map_err(|error| format!("Could not open MusicBee CSV: {error}"))?;
    let headers = reader
        .headers()
        .map_err(|error| format!("Could not read MusicBee CSV headers: {error}"))?
        .clone();
    let mut records = Vec::new();
    for (index, row) in reader.records().enumerate() {
        if records.len() >= limit {
            break;
        }
        let row = row.map_err(|error| format!("Could not read MusicBee CSV row: {error}"))?;
        records.push(ImportedStat {
            row_number: index as i64 + 2,
            source: "musicbee".to_string(),
            path: csv_value(
                &headers,
                &row,
                &["path", "file path", "filename", "file", "location", "url"],
            )
            .and_then(|value| file_location(&value)),
            title: csv_value(&headers, &row, &["title", "track", "name"]),
            artist: csv_value(&headers, &row, &["artist", "album artist", "artists"]),
            album: csv_value(&headers, &row, &["album"]),
            rating: csv_value(&headers, &row, &["rating", "stars", "score"])
                .and_then(|value| parse_rating(&value)),
            play_count: csv_value(&headers, &row, &["play count", "plays", "played", "playcount"])
                .and_then(|value| parse_int(&value)),
            last_played_at: csv_value(&headers, &row, &["last played", "last played at", "lastplayed"]),
            error: None,
        });
    }
    Ok(records)
}

fn parse_itunes_xml(path: &Path, limit: usize) -> Result<Vec<ImportedStat>, String> {
    let value = plist::Value::from_file(path)
        .map_err(|error| format!("Could not read iTunes library XML: {error}"))?;
    let tracks = value
        .as_dictionary()
        .and_then(|dict| dict.get("Tracks"))
        .and_then(plist::Value::as_dictionary)
        .ok_or_else(|| "iTunes XML does not contain a Tracks dictionary".to_string())?;
    let mut records = Vec::new();
    for (index, track) in tracks.values().enumerate() {
        if records.len() >= limit {
            break;
        }
        let Some(dict) = track.as_dictionary() else {
            continue;
        };
        records.push(ImportedStat {
            row_number: index as i64 + 1,
            source: "itunes".to_string(),
            path: plist_string(dict.get("Location")).and_then(|value| file_location(&value)),
            title: plist_string(dict.get("Name")),
            artist: plist_string(dict.get("Artist")).or_else(|| plist_string(dict.get("Album Artist"))),
            album: plist_string(dict.get("Album")),
            rating: plist_string(dict.get("Rating")).and_then(|value| parse_rating(&value)),
            play_count: plist_string(dict.get("Play Count")).and_then(|value| parse_int(&value)),
            last_played_at: plist_string(dict.get("Play Date UTC"))
                .or_else(|| plist_string(dict.get("Play Date"))),
            error: None,
        });
    }
    Ok(records)
}

fn parse_windows_media_player_xml(path: &Path, limit: usize) -> Result<Vec<ImportedStat>, String> {
    let payload =
        std::fs::read_to_string(path).map_err(|error| format!("Could not read WMP XML: {error}"))?;
    let document =
        roxmltree::Document::parse(&payload).map_err(|error| format!("Invalid WMP XML: {error}"))?;
    let mut records = Vec::new();
    for (index, node) in document
        .descendants()
        .filter(|node| node.is_element() && node.tag_name().name().eq_ignore_ascii_case("media"))
        .enumerate()
    {
        if records.len() >= limit {
            break;
        }
        records.push(ImportedStat {
            row_number: index as i64 + 1,
            source: "windows_media_player".to_string(),
            path: attr_any(node, &["src", "path", "href"]).and_then(|value| file_location(&value)),
            title: attr_any(node, &["title", "name"]),
            artist: attr_any(node, &["artist", "author"]),
            album: attr_any(node, &["album"]),
            rating: attr_any(node, &["userrating", "rating"]).and_then(|value| parse_rating(&value)),
            play_count: attr_any(node, &["playcount", "plays"]).and_then(|value| parse_int(&value)),
            last_played_at: attr_any(node, &["lastplayed", "lastplayedat"]),
            error: None,
        });
    }
    Ok(records)
}

fn match_record(
    connection: &Connection,
    record: &ImportedStat,
) -> Result<(Option<TrackMatch>, Option<String>), String> {
    if let Some(path) = record.path.as_deref() {
        let key = scan::path_key(Path::new(path));
        if let Some(track) = track_by_path_key(connection, &key)? {
            return Ok((Some(track), Some("path".to_string())));
        }
    }
    if let (Some(artist), Some(title)) = (record.artist.as_deref(), record.title.as_deref()) {
        let track = connection
            .query_row(
                "SELECT id, rating, play_count, last_played_at
                 FROM tracks
                 WHERE lower(coalesce(artist, '')) = lower(?)
                   AND lower(coalesce(title, '')) = lower(?)
                 ORDER BY id LIMIT 1",
                params![artist, title],
                track_match_from_row,
            )
            .optional()
            .map_err(|error| format!("Could not match imported stats: {error}"))?;
        if track.is_some() {
            return Ok((track, Some("artist_title".to_string())));
        }
    }
    Ok((None, None))
}

fn track_by_path_key(connection: &Connection, path_key: &str) -> Result<Option<TrackMatch>, String> {
    connection
        .query_row(
            "SELECT id, rating, play_count, last_played_at FROM tracks WHERE path_key = ?",
            params![path_key],
            track_match_from_row,
        )
        .optional()
        .map_err(|error| format!("Could not match imported stats by path: {error}"))
}

fn track_match_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TrackMatch> {
    Ok(TrackMatch {
        id: row.get("id")?,
        rating: row.get("rating")?,
        play_count: row.get::<_, Option<i64>>("play_count")?.unwrap_or(0),
        last_played_at: row.get("last_played_at")?,
    })
}

fn csv_value(
    headers: &csv::StringRecord,
    record: &csv::StringRecord,
    aliases: &[&str],
) -> Option<String> {
    for alias in aliases {
        if let Some(index) = headers
            .iter()
            .position(|header| header_key(header) == header_key(alias))
        {
            if let Some(value) = record.get(index).map(str::trim).filter(|value| !value.is_empty()) {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn header_key(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn file_location(value: &str) -> Option<String> {
    let text = value.trim();
    if text.is_empty() {
        return None;
    }
    if text.to_ascii_lowercase().starts_with("file:") {
        let stripped = text
            .trim_start_matches("file:///")
            .trim_start_matches("file://");
        let decoded = urlencoding::decode(stripped)
            .map(|value| value.to_string())
            .unwrap_or_else(|_| stripped.to_string());
        let decoded = if decoded.len() > 2 && decoded.as_bytes().get(0) == Some(&b'/') && decoded.as_bytes().get(2) == Some(&b':') {
            decoded[1..].to_string()
        } else {
            decoded
        };
        return Some(decoded.replace('/', "\\"));
    }
    Some(text.to_string())
}

fn parse_rating(value: &str) -> Option<f64> {
    let text = value
        .replace('%', "")
        .replace("stars", "")
        .replace("star", "")
        .trim()
        .to_string();
    let number = if let Some((left, right)) = text.split_once('/') {
        left.trim().parse::<f64>().ok()? / right.trim().parse::<f64>().ok()?.max(1.0) * 5.0
    } else {
        text.parse::<f64>().ok()?
    };
    if number <= 0.0 {
        return None;
    }
    let normalized = if number > 5.0 { number / 20.0 } else { number };
    Some(((normalized.clamp(0.5, 5.0) * 2.0).round()) / 2.0)
}

fn parse_int(value: &str) -> Option<i64> {
    value.trim().parse::<f64>().ok().map(|value| value.max(0.0) as i64)
}

fn plist_string(value: Option<&plist::Value>) -> Option<String> {
    let value = value?;
    match value {
        plist::Value::String(text) => Some(text.clone()).filter(|text| !text.trim().is_empty()),
        plist::Value::Integer(integer) => Some(integer.to_string()),
        plist::Value::Real(number) => Some(number.to_string()),
        plist::Value::Date(date) => Some(format!("{date:?}")),
        _ => None,
    }
}

fn attr_any(node: roxmltree::Node<'_, '_>, aliases: &[&str]) -> Option<String> {
    for alias in aliases {
        if let Some((_, value)) = node
            .attributes()
            .find(|attr| header_key(attr.name()) == header_key(alias))
            .map(|attr| (attr.name(), attr.value()))
        {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}
