use super::types::*;
use super::{app_storage_root, get_setting, open_database, track_from_row, TRACK_COLUMNS};
use regex::{Regex, RegexBuilder};
use rusqlite::types::Value as SqlValue;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use serde_json::{json, Value as JsonValue};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

const REGEX_PRESET_FIELDS: &[&str] = &["title", "artist", "album", "album_artist", "genre"];
const TAG_CORE_FIELDS: &[&str] = &[
    "title",
    "artist",
    "album",
    "album_artist",
    "track_number",
    "disc_number",
    "genre",
    "year",
    "rating",
];
const FILENAME_INFERENCE_FIELDS: &[&str] = &[
    "title",
    "artist",
    "album",
    "album_artist",
    "track_number",
    "disc_number",
    "genre",
    "year",
];
const DEVICE_KINDS: &[&str] = &["folder", "usb", "android_folder", "android_mtp"];
const TRACK_BACKUP_FIELDS: &[&str] = &[
    "id",
    "path",
    "title",
    "artist",
    "album",
    "album_artist",
    "track_number",
    "disc_number",
    "genre",
    "analysis_provider",
    "analysis_model",
    "analysis_genre",
    "analysis_genre_confidence",
    "analysis_genre_tags",
    "analysis_mood",
    "analysis_mood_confidence",
    "analysis_mood_tags",
    "analysis_embedding",
    "analysis_updated_at",
    "year",
    "duration_seconds",
    "bitrate",
    "replaygain_track_gain_db",
    "replaygain_album_gain_db",
    "replaygain_track_peak",
    "replaygain_album_peak",
    "audio_fingerprint",
    "acoustic_fingerprint",
    "acoustic_fingerprint_updated_at",
    "rating",
    "play_count",
    "skip_count",
    "last_played_at",
    "last_skipped_at",
    "date_added",
    "file_modified_at",
];

fn non_empty_trimmed(value: String, label: &str, max_len: usize) -> Result<String, String> {
    let cleaned = value.trim().to_string();
    if cleaned.is_empty() {
        return Err(format!("{label} is required"));
    }
    Ok(cleaned.chars().take(max_len).collect())
}

fn clean_custom_tag_key(tag_key: &str) -> Result<String, String> {
    let cleaned = tag_key.trim();
    let mut chars = cleaned.chars();
    let Some(first) = chars.next() else {
        return Err(
            "Custom tag names can use letters, numbers, spaces, underscore, dash, dot, and #."
                .to_string(),
        );
    };
    if !first.is_ascii_alphanumeric() || cleaned.chars().count() > 80 {
        return Err(
            "Custom tag names can use letters, numbers, spaces, underscore, dash, dot, and #."
                .to_string(),
        );
    }
    if !cleaned
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ' ' | '_' | '-' | '.' | '#'))
    {
        return Err(
            "Custom tag names can use letters, numbers, spaces, underscore, dash, dot, and #."
                .to_string(),
        );
    }
    Ok(cleaned.to_string())
}

fn tag_field_alias(field: &str) -> String {
    let normalized = field
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    match normalized.as_str() {
        "albumartist" | "album_artist" => "album_artist".to_string(),
        "track" | "track_no" | "track_number" | "track_" => "track_number".to_string(),
        "disc" | "disc_no" | "disc_number" => "disc_number".to_string(),
        "date" | "release_year" => "year".to_string(),
        "stars" => "rating".to_string(),
        _ => normalized,
    }
}

fn parse_tag_field_ref(field: &str) -> Result<(&'static str, String), String> {
    let text = field.trim();
    if text.to_ascii_lowercase().starts_with("custom:") {
        return clean_custom_tag_key(text.split_once(':').map(|(_, rest)| rest).unwrap_or(""))
            .map(|key| ("custom", key));
    }
    let core = tag_field_alias(text);
    if TAG_CORE_FIELDS.contains(&core.as_str()) {
        Ok(("core", core))
    } else {
        Err(format!(
            "Unsupported tag field '{field}'. Use a core field or custom:Name."
        ))
    }
}

fn select_tool_tracks(
    connection: &Connection,
    track_ids: Option<Vec<i64>>,
    limit: Option<usize>,
) -> Result<Vec<DesktopTrack>, String> {
    let limit = limit.unwrap_or(200).clamp(1, 20_000);
    if let Some(track_ids) = track_ids.filter(|ids| !ids.is_empty()) {
        let mut unique_ids = Vec::<i64>::new();
        for id in track_ids.into_iter().filter(|id| *id > 0) {
            if !unique_ids.contains(&id) {
                unique_ids.push(id);
            }
        }
        if unique_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = vec!["?"; unique_ids.len()].join(",");
        let mut params: Vec<SqlValue> = unique_ids.into_iter().map(SqlValue::Integer).collect();
        params.push(SqlValue::Integer(limit as i64));
        let mut statement = connection
            .prepare(&format!(
                "SELECT {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders}) ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), coalesce(disc_number, 0), coalesce(track_number, 0), lower(coalesce(title, '')) LIMIT ?"
            ))
            .map_err(|error| format!("Could not prepare Rust tag-tool selected tracks: {error}"))?;
        let rows = statement
            .query_map(params_from_iter(params), track_from_row)
            .map_err(|error| format!("Could not read Rust tag-tool selected tracks: {error}"))?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode Rust tag-tool selected tracks: {error}"));
    }
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks ORDER BY datetime(date_added) DESC, id DESC LIMIT ?"
        ))
        .map_err(|error| format!("Could not prepare Rust tag-tool tracks: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], track_from_row)
        .map_err(|error| format!("Could not read Rust tag-tool tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust tag-tool tracks: {error}"))
}

fn custom_tags_for_tracks(
    connection: &Connection,
    track_ids: &[i64],
) -> Result<
    std::collections::BTreeMap<i64, std::collections::BTreeMap<String, Option<String>>>,
    String,
> {
    let mut result: std::collections::BTreeMap<
        i64,
        std::collections::BTreeMap<String, Option<String>>,
    > = track_ids
        .iter()
        .map(|id| (*id, Default::default()))
        .collect();
    if track_ids.is_empty() {
        return Ok(result);
    }
    let placeholders = vec!["?"; track_ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT track_id, tag_key, tag_value FROM track_custom_tags WHERE track_id IN ({placeholders}) ORDER BY lower(tag_key)"
        ))
        .map_err(|error| format!("Could not prepare Rust custom tag query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(track_ids.iter()), |row| {
            Ok((
                row.get::<_, i64>("track_id")?,
                row.get::<_, String>("tag_key")?,
                row.get::<_, Option<String>>("tag_value")?,
            ))
        })
        .map_err(|error| format!("Could not read Rust custom tags: {error}"))?;
    for row in rows {
        let (track_id, tag_key, tag_value) =
            row.map_err(|error| format!("Could not decode Rust custom tags: {error}"))?;
        result
            .entry(track_id)
            .or_default()
            .insert(tag_key, tag_value);
    }
    Ok(result)
}

fn custom_tag_value(
    tags: &std::collections::BTreeMap<String, Option<String>>,
    tag_key: &str,
) -> Option<String> {
    tags.iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(tag_key))
        .and_then(|(_, value)| value.clone())
}

fn json_string(value: Option<String>) -> JsonValue {
    value.map(JsonValue::String).unwrap_or(JsonValue::Null)
}

fn json_number_i64(value: Option<i64>) -> JsonValue {
    value
        .map(|value| JsonValue::Number(value.into()))
        .unwrap_or(JsonValue::Null)
}

fn json_number_f64(value: Option<f64>) -> JsonValue {
    value
        .and_then(serde_json::Number::from_f64)
        .map(JsonValue::Number)
        .unwrap_or(JsonValue::Null)
}

fn track_field_json(track: &DesktopTrack, field: &str) -> JsonValue {
    match field {
        "title" => json_string(track.title.clone()),
        "artist" => json_string(track.artist.clone()),
        "album" => json_string(track.album.clone()),
        "album_artist" => json_string(track.album_artist.clone()),
        "track_number" => json_number_i64(track.track_number),
        "disc_number" => json_number_i64(track.disc_number),
        "genre" => json_string(track.genre.clone()),
        "year" => json_number_i64(track.year),
        "rating" => json_number_f64(track.rating),
        _ => JsonValue::Null,
    }
}

fn tag_field_value(
    track: &DesktopTrack,
    custom_tags: &std::collections::BTreeMap<String, Option<String>>,
    field_ref: &str,
) -> Result<JsonValue, String> {
    let (kind, name) = parse_tag_field_ref(field_ref)?;
    if kind == "custom" {
        Ok(json_string(custom_tag_value(custom_tags, &name)))
    } else {
        Ok(track_field_json(track, &name))
    }
}

fn value_missing(value: &JsonValue) -> bool {
    value.is_null() || value.as_str().is_some_and(|text| text.trim().is_empty())
}

fn coerce_i64(value: &JsonValue) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_f64().map(|number| number.round() as i64))
        .or_else(|| {
            value
                .as_str()
                .and_then(|text| text.trim().parse::<i64>().ok())
        })
}

fn coerce_f64(value: &JsonValue) -> Option<f64> {
    value.as_f64().or_else(|| {
        value
            .as_str()
            .and_then(|text| text.trim().parse::<f64>().ok())
    })
}

fn coerce_text(value: &JsonValue) -> Option<String> {
    if value.is_null() {
        None
    } else {
        value
            .as_str()
            .map(str::to_string)
            .or_else(|| Some(value.to_string()))
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty())
    }
}

fn update_core_field(
    connection: &Connection,
    track_id: i64,
    field: &str,
    value: &JsonValue,
) -> Result<(), String> {
    match field {
        "title" | "artist" | "album" | "album_artist" | "genre" => {
            let value = coerce_text(value);
            let sql = match field {
                "title" => "UPDATE tracks SET title = ?, updated_at = datetime('now') WHERE id = ?",
                "artist" => {
                    "UPDATE tracks SET artist = ?, updated_at = datetime('now') WHERE id = ?"
                }
                "album" => "UPDATE tracks SET album = ?, updated_at = datetime('now') WHERE id = ?",
                "album_artist" => {
                    "UPDATE tracks SET album_artist = ?, updated_at = datetime('now') WHERE id = ?"
                }
                _ => "UPDATE tracks SET genre = ?, updated_at = datetime('now') WHERE id = ?",
            };
            connection
                .execute(sql, params![value, track_id])
                .map_err(|error| {
                    format!("Could not update Rust metadata field {field}: {error}")
                })?;
        }
        "track_number" | "disc_number" | "year" => {
            let value = coerce_i64(value);
            let sql = match field {
                "track_number" => {
                    "UPDATE tracks SET track_number = ?, updated_at = datetime('now') WHERE id = ?"
                }
                "disc_number" => {
                    "UPDATE tracks SET disc_number = ?, updated_at = datetime('now') WHERE id = ?"
                }
                _ => "UPDATE tracks SET year = ?, updated_at = datetime('now') WHERE id = ?",
            };
            connection
                .execute(sql, params![value, track_id])
                .map_err(|error| {
                    format!("Could not update Rust metadata field {field}: {error}")
                })?;
        }
        "rating" => {
            let value = coerce_f64(value).filter(|rating| (0.5..=5.0).contains(rating));
            connection
                .execute(
                    "UPDATE tracks SET rating = ?, updated_at = datetime('now') WHERE id = ?",
                    params![value, track_id],
                )
                .map_err(|error| format!("Could not update Rust rating: {error}"))?;
        }
        _ => return Err(format!("Unsupported core field {field}")),
    }
    Ok(())
}

fn update_custom_tag(
    connection: &Connection,
    track_id: i64,
    tag_key: &str,
    value: Option<String>,
) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM track_custom_tags WHERE track_id = ? AND lower(tag_key) = lower(?)",
            params![track_id, tag_key],
        )
        .map_err(|error| format!("Could not clear Rust custom tag: {error}"))?;
    if let Some(value) = value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
    {
        connection
            .execute(
                "INSERT INTO track_custom_tags(track_id, tag_key, tag_value, updated_at) VALUES(?, ?, ?, datetime('now'))",
                params![track_id, tag_key, value],
            )
            .map_err(|error| format!("Could not save Rust custom tag: {error}"))?;
    }
    connection
        .execute(
            "UPDATE tracks SET updated_at = datetime('now') WHERE id = ?",
            params![track_id],
        )
        .ok();
    Ok(())
}

fn apply_tag_update(
    connection: &Connection,
    track_id: i64,
    field_ref: &str,
    value: &JsonValue,
) -> Result<(), String> {
    let (kind, name) = parse_tag_field_ref(field_ref)?;
    if kind == "custom" {
        update_custom_tag(connection, track_id, &name, coerce_text(value))
    } else {
        update_core_field(connection, track_id, &name, value)
    }
}

fn clear_query_cache(connection: &Connection) {
    let _ = connection.execute("DELETE FROM library_query_cache", []);
}

fn filename_token_field(token: &str) -> Option<&'static str> {
    let normalized = token
        .replace('_', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase();
    match normalized.as_str() {
        "title" => Some("title"),
        "artist" => Some("artist"),
        "album" => Some("album"),
        "album artist" | "albumartist" => Some("album_artist"),
        "track" | "track#" | "track number" => Some("track_number"),
        "disc" | "disc#" | "disc number" => Some("disc_number"),
        "genre" => Some("genre"),
        "year" | "date" => Some("year"),
        _ => None,
    }
}

fn filename_inference_literal(text: &str) -> String {
    regex::escape(text)
        .replace(r"\/", r"[\\/]")
        .replace(r"\\", r"[\\/]")
}

fn compile_filename_inference_pattern(
    pattern: &str,
) -> Result<(Regex, Vec<(String, String)>), String> {
    let mut parts = Vec::new();
    let mut groups = Vec::<(String, String)>::new();
    let mut used = BTreeMap::<String, usize>::new();
    let mut cursor = 0usize;
    let token_expression = Regex::new(r"<([^>]+)>").map_err(|error| error.to_string())?;
    for capture in token_expression.captures_iter(pattern) {
        let Some(full) = capture.get(0) else {
            continue;
        };
        parts.push(filename_inference_literal(&pattern[cursor..full.start()]));
        let token = capture
            .get(1)
            .map(|value| value.as_str())
            .unwrap_or_default();
        if let Some(field) = filename_token_field(token) {
            let counter = used.entry(field.to_string()).or_default();
            *counter += 1;
            let group_name = format!("{field}__{counter}");
            groups.push((group_name.clone(), field.to_string()));
            if matches!(field, "track_number" | "disc_number" | "year") {
                parts.push(format!(r"(?P<{group_name}>\d{{1,4}}(?:\s*/\s*\d{{1,4}})?)"));
            } else {
                parts.push(format!(r"(?P<{group_name}>.+?)"));
            }
        } else {
            parts.push(filename_inference_literal(full.as_str()));
        }
        cursor = full.end();
    }
    parts.push(filename_inference_literal(&pattern[cursor..]));
    RegexBuilder::new(&format!("^{}$", parts.join("")))
        .case_insensitive(true)
        .build()
        .map(|expression| (expression, groups))
        .map_err(|error| format!("Invalid filename tag pattern: {error}"))
}

fn path_without_extension_text(path: &Path) -> String {
    let mut clean = path.to_path_buf();
    clean.set_extension("");
    clean.to_string_lossy().replace('\\', "/")
}

fn candidate_filename_texts(path: &Path, library_root: Option<&Path>) -> Vec<String> {
    let full = path_without_extension_text(path);
    let mut candidates = Vec::new();
    if let Some(library_root) = library_root {
        let root = library_root.to_string_lossy().replace('\\', "/");
        let root = root.trim_end_matches('/');
        if let Some(relative) = full
            .strip_prefix(root)
            .map(|value| value.trim_start_matches('/').to_string())
            .filter(|value| !value.is_empty())
        {
            candidates.push(relative);
        }
    }
    candidates.push(full);
    if let Some(stem) = path.file_stem().and_then(|value| value.to_str()) {
        candidates.push(stem.to_string());
    }
    let mut seen = Vec::<String>::new();
    for candidate in candidates {
        let normalized = candidate.replace('\\', "/");
        if !seen.iter().any(|value| value == &normalized) {
            seen.push(normalized);
        }
    }
    seen
}

fn normalize_inferred_text(value: &str) -> Option<String> {
    let cleaned = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn normalize_inferred_number(value: &str) -> Option<i64> {
    Regex::new(r"\d{1,4}")
        .ok()
        .and_then(|expression| {
            expression
                .find(value)
                .map(|found| found.as_str().to_string())
        })
        .and_then(|text| text.parse::<i64>().ok())
}

fn infer_metadata_from_filename(
    path: &Path,
    pattern: &str,
    library_root: Option<&Path>,
) -> Result<Option<JsonValue>, String> {
    let (expression, groups) = compile_filename_inference_pattern(&pattern.replace('\\', "/"))?;
    for candidate in candidate_filename_texts(path, library_root) {
        let Some(captures) = expression.captures(&candidate) else {
            continue;
        };
        let mut inferred = serde_json::Map::new();
        for (group, field) in &groups {
            let Some(value) = captures.name(group).map(|match_| match_.as_str()) else {
                continue;
            };
            let parsed = if matches!(field.as_str(), "track_number" | "disc_number" | "year") {
                normalize_inferred_number(value).map(|number| JsonValue::Number(number.into()))
            } else {
                normalize_inferred_text(value).map(JsonValue::String)
            };
            if let Some(parsed) = parsed {
                inferred.insert(field.clone(), parsed);
            }
        }
        if !inferred.is_empty() {
            return Ok(Some(JsonValue::Object(inferred)));
        }
    }
    Ok(None)
}

fn filename_current_metadata(track: &DesktopTrack) -> JsonValue {
    let mut current = serde_json::Map::new();
    for field in FILENAME_INFERENCE_FIELDS {
        current.insert((*field).to_string(), track_field_json(track, field));
    }
    JsonValue::Object(current)
}

fn filename_changed_fields(
    current: &JsonValue,
    inferred: &JsonValue,
    missing_only: bool,
) -> Vec<String> {
    let mut fields = Vec::new();
    let Some(inferred) = inferred.as_object() else {
        return fields;
    };
    for (field, value) in inferred {
        if !FILENAME_INFERENCE_FIELDS.contains(&field.as_str()) {
            continue;
        }
        let current_value = current.get(field).unwrap_or(&JsonValue::Null);
        if missing_only && !value_missing(current_value) {
            continue;
        }
        if current_value != value {
            fields.push(field.clone());
        }
    }
    fields.sort();
    fields
}

