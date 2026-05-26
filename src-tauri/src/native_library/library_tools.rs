use super::types::*;
use super::{app_storage_root, open_database, track_from_row, TRACK_COLUMNS};
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
) -> Result<Vec<NativeTrack>, String> {
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
            .map_err(|error| format!("Could not prepare native tag-tool selected tracks: {error}"))?;
        let rows = statement
            .query_map(params_from_iter(params), track_from_row)
            .map_err(|error| format!("Could not read native tag-tool selected tracks: {error}"))?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native tag-tool selected tracks: {error}"));
    }
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks ORDER BY datetime(date_added) DESC, id DESC LIMIT ?"
        ))
        .map_err(|error| format!("Could not prepare native tag-tool tracks: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], track_from_row)
        .map_err(|error| format!("Could not read native tag-tool tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native tag-tool tracks: {error}"))
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
        .map_err(|error| format!("Could not prepare native custom tag query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(track_ids.iter()), |row| {
            Ok((
                row.get::<_, i64>("track_id")?,
                row.get::<_, String>("tag_key")?,
                row.get::<_, Option<String>>("tag_value")?,
            ))
        })
        .map_err(|error| format!("Could not read native custom tags: {error}"))?;
    for row in rows {
        let (track_id, tag_key, tag_value) =
            row.map_err(|error| format!("Could not decode native custom tags: {error}"))?;
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

fn track_field_json(track: &NativeTrack, field: &str) -> JsonValue {
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
    track: &NativeTrack,
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
                    format!("Could not update native metadata field {field}: {error}")
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
                    format!("Could not update native metadata field {field}: {error}")
                })?;
        }
        "rating" => {
            let value = coerce_f64(value).filter(|rating| (0.5..=5.0).contains(rating));
            connection
                .execute(
                    "UPDATE tracks SET rating = ?, updated_at = datetime('now') WHERE id = ?",
                    params![value, track_id],
                )
                .map_err(|error| format!("Could not update native rating: {error}"))?;
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
        .map_err(|error| format!("Could not clear native custom tag: {error}"))?;
    if let Some(value) = value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
    {
        connection
            .execute(
                "INSERT INTO track_custom_tags(track_id, tag_key, tag_value, updated_at) VALUES(?, ?, ?, datetime('now'))",
                params![track_id, tag_key, value],
            )
            .map_err(|error| format!("Could not save native custom tag: {error}"))?;
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

fn filename_current_metadata(track: &NativeTrack) -> JsonValue {
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

fn regex_tag_preset_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeRegexTagPreset> {
    Ok(NativeRegexTagPreset {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        field: row.get::<_, Option<String>>("field")?.unwrap_or_default(),
        pattern: row.get::<_, Option<String>>("pattern")?.unwrap_or_default(),
        replacement: row
            .get::<_, Option<String>>("replacement")?
            .unwrap_or_default(),
        case_sensitive: row.get::<_, Option<i64>>("case_sensitive")?.unwrap_or(0) != 0,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn virtual_tag_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeVirtualTagDefinition> {
    Ok(NativeVirtualTagDefinition {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        expression: row
            .get::<_, Option<String>>("expression")?
            .unwrap_or_default(),
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn parse_playlist_ids(raw: Option<String>) -> Vec<i64> {
    let Some(raw) = raw else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<serde_json::Value>>(&raw)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| {
            value.as_i64().or_else(|| {
                value
                    .as_str()
                    .and_then(|text| text.trim().parse::<i64>().ok())
            })
        })
        .filter(|value| *value > 0)
        .collect()
}

fn parse_playlist_rules(raw: Option<String>) -> serde_json::Value {
    raw.and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| json!({}))
}

fn device_sync_profile_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<NativeDeviceSyncProfile> {
    Ok(NativeDeviceSyncProfile {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        target_folder: row
            .get::<_, Option<String>>("target_folder")?
            .unwrap_or_default(),
        device_kind: row
            .get::<_, Option<String>>("device_kind")?
            .unwrap_or_else(|| "folder".to_string()),
        music_subfolder: row
            .get::<_, Option<String>>("music_subfolder")?
            .unwrap_or_else(|| "Music".to_string()),
        playlist_subfolder: row
            .get::<_, Option<String>>("playlist_subfolder")?
            .unwrap_or_else(|| "Playlists".to_string()),
        playlist_ids: parse_playlist_ids(row.get("playlist_ids_json")?),
        playlist_rules: parse_playlist_rules(row.get("playlist_rules_json")?),
        copy_files: row.get::<_, Option<i64>>("copy_files")?.unwrap_or(1) != 0,
        export_playlists: row.get::<_, Option<i64>>("export_playlists")?.unwrap_or(1) != 0,
        preserve_structure: row
            .get::<_, Option<i64>>("preserve_structure")?
            .unwrap_or(1)
            != 0,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn android_presets() -> Vec<NativeDeviceSyncProfilePayload> {
    vec![
        NativeDeviceSyncProfilePayload {
            name: "Generic Android Music Folder".to_string(),
            target_folder: String::new(),
            device_kind: "android_folder".to_string(),
            music_subfolder: "Music".to_string(),
            playlist_subfolder: "Playlists".to_string(),
            playlist_ids: Vec::new(),
            playlist_rules: json!({"relative_paths": true, "playlist_format": "m3u8"}),
            copy_files: true,
            export_playlists: true,
            preserve_structure: false,
        },
        NativeDeviceSyncProfilePayload {
            name: "Poweramp Android".to_string(),
            target_folder: String::new(),
            device_kind: "android_folder".to_string(),
            music_subfolder: "Music".to_string(),
            playlist_subfolder: "Playlists".to_string(),
            playlist_ids: Vec::new(),
            playlist_rules: json!({"relative_paths": true, "playlist_format": "m3u8", "path_style": "android"}),
            copy_files: true,
            export_playlists: true,
            preserve_structure: false,
        },
        NativeDeviceSyncProfilePayload {
            name: "USB Drive Mirror".to_string(),
            target_folder: String::new(),
            device_kind: "usb".to_string(),
            music_subfolder: "Music".to_string(),
            playlist_subfolder: "Playlists".to_string(),
            playlist_ids: Vec::new(),
            playlist_rules: json!({"relative_paths": true, "playlist_format": "m3u8"}),
            copy_files: true,
            export_playlists: true,
            preserve_structure: true,
        },
    ]
}

fn list_device_sync_profiles_for_connection(
    connection: &Connection,
) -> Result<Vec<NativeDeviceSyncProfile>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                   playlist_ids_json, playlist_rules_json, copy_files, export_playlists,
                   preserve_structure, created_at, updated_at
            FROM device_sync_profiles
            ORDER BY lower(name)
            "#,
        )
        .map_err(|error| format!("Could not prepare native device sync profile query: {error}"))?;
    let rows = statement
        .query_map([], device_sync_profile_from_row)
        .map_err(|error| format!("Could not read native device sync profiles: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native device sync profiles: {error}"))
}

fn device_sync_profile_by_id(
    connection: &Connection,
    profile_id: i64,
) -> Result<NativeDeviceSyncProfile, String> {
    connection
        .query_row(
            r#"
            SELECT id, name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                   playlist_ids_json, playlist_rules_json, copy_files, export_playlists,
                   preserve_structure, created_at, updated_at
            FROM device_sync_profiles
            WHERE id = ?
            "#,
            params![profile_id],
            device_sync_profile_from_row,
        )
        .map_err(|error| format!("Device sync profile not found: {error}"))
}

fn device_sync_profile_by_name(
    connection: &Connection,
    name: &str,
) -> Result<NativeDeviceSyncProfile, String> {
    connection
        .query_row(
            r#"
            SELECT id, name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                   playlist_ids_json, playlist_rules_json, copy_files, export_playlists,
                   preserve_structure, created_at, updated_at
            FROM device_sync_profiles
            WHERE lower(name) = lower(?)
            ORDER BY id DESC
            LIMIT 1
            "#,
            params![name],
            device_sync_profile_from_row,
        )
        .map_err(|error| format!("Device sync profile not found: {error}"))
}

#[tauri::command]
pub fn native_regex_tag_presets(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativeRegexTagPreset>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, field, pattern, replacement, case_sensitive, created_at, updated_at
            FROM regex_tag_presets
            ORDER BY lower(name)
            "#,
        )
        .map_err(|error| format!("Could not prepare native regex preset query: {error}"))?;
    let rows = statement
        .query_map([], regex_tag_preset_from_row)
        .map_err(|error| format!("Could not read native regex presets: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native regex presets: {error}"))
}

#[tauri::command]
pub fn native_save_regex_tag_preset(
    _state: State<'_, NativeLibraryState>,
    name: String,
    field: String,
    pattern: String,
    replacement: Option<String>,
    case_sensitive: Option<bool>,
) -> Result<NativeRegexTagPreset, String> {
    let name = non_empty_trimmed(name, "Regex preset name", 80)?;
    let field = field.trim().to_string();
    if !REGEX_PRESET_FIELDS.contains(&field.as_str()) {
        return Err("Unsupported regex preset field".to_string());
    }
    let pattern = non_empty_trimmed(pattern, "Regex pattern", 500)?;
    let replacement = replacement
        .unwrap_or_default()
        .chars()
        .take(500)
        .collect::<String>();
    let connection = open_database()?;
    connection
        .execute(
            r#"
            INSERT INTO regex_tag_presets(name, field, pattern, replacement, case_sensitive, updated_at)
            VALUES(?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(name) DO UPDATE SET
              field = excluded.field,
              pattern = excluded.pattern,
              replacement = excluded.replacement,
              case_sensitive = excluded.case_sensitive,
              updated_at = datetime('now')
            "#,
            params![
                name,
                field,
                pattern,
                replacement,
                if case_sensitive.unwrap_or(false) { 1 } else { 0 }
            ],
        )
        .map_err(|error| format!("Could not save native regex preset: {error}"))?;
    connection
        .query_row(
            r#"
            SELECT id, name, field, pattern, replacement, case_sensitive, created_at, updated_at
            FROM regex_tag_presets
            WHERE lower(name) = lower(?)
            "#,
            params![name],
            regex_tag_preset_from_row,
        )
        .map_err(|error| format!("Could not read saved native regex preset: {error}"))
}

#[tauri::command]
pub fn native_delete_regex_tag_preset(
    _state: State<'_, NativeLibraryState>,
    preset_id: i64,
) -> Result<NativeDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM regex_tag_presets WHERE id = ?",
            params![preset_id],
        )
        .map_err(|error| format!("Could not delete native regex preset: {error}"))?;
    if deleted == 0 {
        return Err("Regex preset was not found".to_string());
    }
    Ok(NativeDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn native_virtual_tags(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativeVirtualTagDefinition>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, expression, created_at, updated_at
            FROM virtual_tag_definitions
            ORDER BY lower(name)
            "#,
        )
        .map_err(|error| format!("Could not prepare native virtual tag query: {error}"))?;
    let rows = statement
        .query_map([], virtual_tag_from_row)
        .map_err(|error| format!("Could not read native virtual tags: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native virtual tags: {error}"))
}

#[tauri::command]
pub fn native_save_virtual_tag(
    _state: State<'_, NativeLibraryState>,
    name: String,
    expression: String,
) -> Result<NativeVirtualTagDefinition, String> {
    let name = non_empty_trimmed(name, "Virtual tag name", 80)?;
    let expression = non_empty_trimmed(expression, "Virtual tag expression", 500)?;
    let connection = open_database()?;
    connection
        .execute(
            r#"
            INSERT INTO virtual_tag_definitions(name, expression, updated_at)
            VALUES(?, ?, datetime('now'))
            ON CONFLICT(name) DO UPDATE SET
              expression = excluded.expression,
              updated_at = datetime('now')
            "#,
            params![name, expression],
        )
        .map_err(|error| format!("Could not save native virtual tag: {error}"))?;
    connection
        .query_row(
            r#"
            SELECT id, name, expression, created_at, updated_at
            FROM virtual_tag_definitions
            WHERE lower(name) = lower(?)
            "#,
            params![name],
            virtual_tag_from_row,
        )
        .map_err(|error| format!("Could not read saved native virtual tag: {error}"))
}

#[tauri::command]
pub fn native_delete_virtual_tag(
    _state: State<'_, NativeLibraryState>,
    definition_id: i64,
) -> Result<NativeDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM virtual_tag_definitions WHERE id = ?",
            params![definition_id],
        )
        .map_err(|error| format!("Could not delete native virtual tag: {error}"))?;
    if deleted == 0 {
        return Err("Virtual tag was not found".to_string());
    }
    Ok(NativeDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn native_infer_filename_tags(
    _state: State<'_, NativeLibraryState>,
    pattern: String,
    track_ids: Option<Vec<i64>>,
    missing_only: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeFilenameTagInferenceResponse, String> {
    let connection = open_database()?;
    let missing_only = missing_only.unwrap_or(true);
    let apply = apply.unwrap_or(false);
    let limit = limit.unwrap_or(200).clamp(1, 10_000);
    let library_root = super::get_setting(&connection, "library_path")
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from);
    let tracks = select_tool_tracks(&connection, track_ids, Some(limit))?;
    let mut previews = Vec::new();
    let mut matches = 0i64;
    let mut applied = 0i64;
    for track in tracks {
        let current = filename_current_metadata(&track);
        let inferred = infer_metadata_from_filename(
            Path::new(&track.path),
            &pattern,
            library_root.as_deref(),
        )?
        .unwrap_or_else(|| json!({}));
        let matched = inferred
            .as_object()
            .is_some_and(|object| !object.is_empty());
        if matched {
            matches += 1;
        }
        let changed_fields = if matched {
            filename_changed_fields(&current, &inferred, missing_only)
        } else {
            Vec::new()
        };
        let mut preview = NativeFilenameTagInferencePreview {
            track_id: track.id,
            path: track.path.clone(),
            matched,
            current,
            inferred: inferred.clone(),
            changed_fields: changed_fields.clone(),
            accepted: true,
            applied: false,
            error: None,
        };
        if apply && !changed_fields.is_empty() {
            for field in &changed_fields {
                if let Some(value) = inferred.get(field) {
                    if let Err(error) = update_core_field(&connection, track.id, field, value) {
                        preview.error = Some(error);
                        break;
                    }
                }
            }
            if preview.error.is_none() {
                preview.applied = true;
                applied += 1;
            }
        }
        previews.push(preview);
    }
    if apply && applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(NativeFilenameTagInferenceResponse {
        total: previews.len() as i64,
        matches,
        applied,
        previews,
    })
}

#[tauri::command]
pub fn native_device_sync_profiles(
    _state: State<'_, NativeLibraryState>,
) -> Result<NativeDeviceSyncProfilesResponse, String> {
    let connection = open_database()?;
    Ok(NativeDeviceSyncProfilesResponse {
        profiles: list_device_sync_profiles_for_connection(&connection)?,
        presets: android_presets(),
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn native_save_device_sync_profile(
    _state: State<'_, NativeLibraryState>,
    profile_id: Option<i64>,
    name: String,
    target_folder: Option<String>,
    device_kind: Option<String>,
    music_subfolder: Option<String>,
    playlist_subfolder: Option<String>,
    playlist_ids: Option<Vec<i64>>,
    playlist_rules: Option<serde_json::Value>,
    copy_files: Option<bool>,
    export_playlists: Option<bool>,
    preserve_structure: Option<bool>,
) -> Result<NativeDeviceSyncProfile, String> {
    let name = non_empty_trimmed(name, "Device sync profile name", 120)?;
    let device_kind = device_kind.unwrap_or_else(|| "folder".to_string());
    if !DEVICE_KINDS.contains(&device_kind.as_str()) {
        return Err("Unsupported device sync profile kind".to_string());
    }
    let target_folder = target_folder.unwrap_or_default();
    let music_subfolder = music_subfolder
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Music".to_string());
    let playlist_subfolder = playlist_subfolder
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Playlists".to_string());
    let playlist_ids: Vec<i64> = playlist_ids
        .unwrap_or_default()
        .into_iter()
        .filter(|value| *value > 0)
        .take(200)
        .collect();
    let playlist_rules = playlist_rules
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| json!({}));
    let playlist_ids_json = serde_json::to_string(&playlist_ids)
        .map_err(|error| format!("Could not serialize device sync playlist ids: {error}"))?;
    let playlist_rules_json = serde_json::to_string(&playlist_rules)
        .map_err(|error| format!("Could not serialize device sync playlist rules: {error}"))?;
    let connection = open_database()?;

    match profile_id {
        Some(profile_id) => {
            let updated = connection
                .execute(
                    r#"
                    UPDATE device_sync_profiles
                    SET name = ?,
                        target_folder = ?,
                        device_kind = ?,
                        music_subfolder = ?,
                        playlist_subfolder = ?,
                        playlist_ids_json = ?,
                        playlist_rules_json = ?,
                        copy_files = ?,
                        export_playlists = ?,
                        preserve_structure = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                    "#,
                    params![
                        name,
                        target_folder,
                        device_kind,
                        music_subfolder,
                        playlist_subfolder,
                        playlist_ids_json,
                        playlist_rules_json,
                        if copy_files.unwrap_or(true) { 1 } else { 0 },
                        if export_playlists.unwrap_or(true) {
                            1
                        } else {
                            0
                        },
                        if preserve_structure.unwrap_or(true) {
                            1
                        } else {
                            0
                        },
                        profile_id
                    ],
                )
                .map_err(|error| format!("Could not update native device sync profile: {error}"))?;
            if updated == 0 {
                return Err("Device sync profile not found".to_string());
            }
            device_sync_profile_by_id(&connection, profile_id)
        }
        None => {
            connection
                .execute(
                    r#"
                    INSERT INTO device_sync_profiles(
                      name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                      playlist_ids_json, playlist_rules_json, copy_files, export_playlists, preserve_structure
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(name) DO UPDATE SET
                      target_folder = excluded.target_folder,
                      device_kind = excluded.device_kind,
                      music_subfolder = excluded.music_subfolder,
                      playlist_subfolder = excluded.playlist_subfolder,
                      playlist_ids_json = excluded.playlist_ids_json,
                      playlist_rules_json = excluded.playlist_rules_json,
                      copy_files = excluded.copy_files,
                      export_playlists = excluded.export_playlists,
                      preserve_structure = excluded.preserve_structure,
                      updated_at = datetime('now')
                    "#,
                    params![
                        name,
                        target_folder,
                        device_kind,
                        music_subfolder,
                        playlist_subfolder,
                        playlist_ids_json,
                        playlist_rules_json,
                        if copy_files.unwrap_or(true) { 1 } else { 0 },
                        if export_playlists.unwrap_or(true) { 1 } else { 0 },
                        if preserve_structure.unwrap_or(true) { 1 } else { 0 }
                    ],
                )
                .map_err(|error| format!("Could not save native device sync profile: {error}"))?;
            device_sync_profile_by_name(&connection, &name)
        }
    }
}

#[tauri::command]
pub fn native_delete_device_sync_profile(
    _state: State<'_, NativeLibraryState>,
    profile_id: i64,
) -> Result<NativeDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM device_sync_profiles WHERE id = ?",
            params![profile_id],
        )
        .map_err(|error| format!("Could not delete native device sync profile: {error}"))?;
    if deleted == 0 {
        return Err("Device sync profile not found".to_string());
    }
    Ok(NativeDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn native_custom_tags(
    _state: State<'_, NativeLibraryState>,
    action: Option<String>,
    tag_key: String,
    value: Option<String>,
    track_ids: Option<Vec<i64>>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeCustomTagBatchResponse, String> {
    let action = action.unwrap_or_else(|| "set".to_string());
    let tag_key = clean_custom_tag_key(&tag_key)?;
    let requested_value = if action == "delete" {
        None
    } else {
        value
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty())
    };
    let apply = apply.unwrap_or(false);
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, limit)?;
    let ids: Vec<i64> = tracks.iter().map(|track| track.id).collect();
    let custom_by_track = custom_tags_for_tracks(&connection, &ids)?;
    let mut previews = Vec::new();
    let mut changed = 0i64;
    let mut applied = 0i64;
    for track in tracks {
        let current = custom_tag_value(
            custom_by_track
                .get(&track.id)
                .unwrap_or(&Default::default()),
            &tag_key,
        );
        let changed_here = current != requested_value;
        let mut preview = NativeCustomTagBatchPreview {
            track_id: track.id,
            path: track.path,
            tag_key: tag_key.clone(),
            current,
            value: requested_value.clone(),
            changed: changed_here,
            applied: false,
            error: None,
        };
        if changed_here {
            changed += 1;
            if apply {
                match update_custom_tag(&connection, track.id, &tag_key, requested_value.clone()) {
                    Ok(()) => {
                        preview.applied = true;
                        applied += 1;
                    }
                    Err(error) => preview.error = Some(error),
                }
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(NativeCustomTagBatchResponse {
        total: previews.len() as i64,
        changed,
        applied,
        previews,
    })
}

fn virtual_tag_value(
    token: &str,
    track: &NativeTrack,
    custom_tags: &std::collections::BTreeMap<String, Option<String>>,
) -> Result<String, String> {
    let key = token.trim();
    if key.to_ascii_lowercase().starts_with("custom:") {
        let custom_key =
            clean_custom_tag_key(key.split_once(':').map(|(_, rest)| rest).unwrap_or(""))?;
        return Ok(custom_tag_value(custom_tags, &custom_key).unwrap_or_default());
    }
    match tag_field_alias(key).as_str() {
        "title" => Ok(track.title.clone().unwrap_or_default()),
        "artist" => Ok(track.artist.clone().unwrap_or_default()),
        "album" => Ok(track.album.clone().unwrap_or_default()),
        "album_artist" => Ok(track.album_artist.clone().unwrap_or_default()),
        "track_number" => Ok(track
            .track_number
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "disc_number" => Ok(track
            .disc_number
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "genre" => Ok(track.genre.clone().unwrap_or_default()),
        "year" => Ok(track
            .year
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "rating" => Ok(track
            .rating
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "album_artist_or_artist" | "albumartistorartist" => Ok(track
            .album_artist
            .clone()
            .or_else(|| track.artist.clone())
            .unwrap_or_default()),
        "filename" => Ok(std::path::Path::new(&track.path)
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string()),
        "folder" => Ok(std::path::Path::new(&track.path)
            .parent()
            .and_then(|path| path.file_name())
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string()),
        "extension" => Ok(std::path::Path::new(&track.path)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()),
        "decade" => Ok(track
            .year
            .map(|year| format!("{}s", (year / 10) * 10))
            .unwrap_or_default()),
        "rating_bucket" => Ok(match track.rating {
            Some(value) if value >= 4.5 => "Favorite",
            Some(value) if value >= 3.5 => "Liked",
            Some(value) if value >= 2.5 => "Neutral",
            Some(_) => "Low priority",
            None => "Unrated",
        }
        .to_string()),
        _ => Err(format!("Unknown token: {token}")),
    }
}

#[tauri::command]
pub fn native_virtual_tag_preview(
    _state: State<'_, NativeLibraryState>,
    expression: String,
    track_ids: Option<Vec<i64>>,
    limit: Option<usize>,
) -> Result<NativeVirtualTagPreviewResponse, String> {
    let token_re = Regex::new(r"<([^<>]+)>|\{([^{}]+)\}")
        .map_err(|error| format!("Could not compile virtual tag parser: {error}"))?;
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, limit)?;
    let ids: Vec<i64> = tracks.iter().map(|track| track.id).collect();
    let custom_by_track = custom_tags_for_tracks(&connection, &ids)?;
    let mut previews = Vec::new();
    for track in tracks {
        let custom_tags = custom_by_track.get(&track.id).cloned().unwrap_or_default();
        let mut error = None;
        let mut rendered = String::new();
        let mut last = 0usize;
        for captures in token_re.captures_iter(&expression) {
            let Some(full) = captures.get(0) else {
                continue;
            };
            rendered.push_str(&expression[last..full.start()]);
            let token = captures
                .get(1)
                .or_else(|| captures.get(2))
                .map(|value| value.as_str())
                .unwrap_or_default();
            match virtual_tag_value(token, &track, &custom_tags) {
                Ok(value) => rendered.push_str(&value),
                Err(message) => {
                    error = Some(message);
                    rendered.clear();
                    break;
                }
            }
            last = full.end();
        }
        if error.is_none() {
            rendered.push_str(&expression[last..]);
        }
        previews.push(NativeVirtualTagPreview {
            track_id: track.id,
            path: track.path,
            title: track.title,
            value: if error.is_none() {
                Some(rendered)
            } else {
                None
            },
            error,
        });
    }
    Ok(NativeVirtualTagPreviewResponse {
        expression,
        total: previews.len() as i64,
        previews,
    })
}

#[tauri::command]
pub fn native_copy_swap_tags(
    _state: State<'_, NativeLibraryState>,
    action: Option<String>,
    source_field: String,
    target_field: String,
    track_ids: Option<Vec<i64>>,
    missing_only: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeTagFieldCopySwapResponse, String> {
    parse_tag_field_ref(&source_field)?;
    parse_tag_field_ref(&target_field)?;
    if source_field
        .trim()
        .eq_ignore_ascii_case(target_field.trim())
    {
        return Err("Choose two different fields".to_string());
    }
    let action = action.unwrap_or_else(|| "copy".to_string());
    let apply = apply.unwrap_or(false);
    let missing_only = missing_only.unwrap_or(false);
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, limit)?;
    let ids: Vec<i64> = tracks.iter().map(|track| track.id).collect();
    let custom_by_track = custom_tags_for_tracks(&connection, &ids)?;
    let mut previews = Vec::new();
    let mut changed = 0i64;
    let mut applied = 0i64;
    for track in tracks {
        let custom_tags = custom_by_track.get(&track.id).cloned().unwrap_or_default();
        let current_source = tag_field_value(&track, &custom_tags, &source_field)?;
        let current_target = tag_field_value(&track, &custom_tags, &target_field)?;
        let mut new_source = if action == "swap" {
            current_target.clone()
        } else {
            current_source.clone()
        };
        let mut new_target = current_source.clone();
        if action != "swap" && missing_only && !value_missing(&current_target) {
            new_target = current_target.clone();
        }
        if action != "swap" {
            new_source = current_source.clone();
        }
        let changed_here = new_source != current_source || new_target != current_target;
        let mut preview = NativeTagFieldCopySwapPreview {
            track_id: track.id,
            path: track.path,
            source_field: source_field.clone(),
            target_field: target_field.clone(),
            current_source,
            current_target,
            new_source: new_source.clone(),
            new_target: new_target.clone(),
            changed: changed_here,
            applied: false,
            error: None,
        };
        if changed_here {
            changed += 1;
            if apply {
                let result = (|| {
                    apply_tag_update(&connection, track.id, &target_field, &new_target)?;
                    if action == "swap" {
                        apply_tag_update(&connection, track.id, &source_field, &new_source)?;
                    }
                    Ok::<(), String>(())
                })();
                match result {
                    Ok(()) => {
                        preview.applied = true;
                        applied += 1;
                    }
                    Err(error) => preview.error = Some(error),
                }
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(NativeTagFieldCopySwapResponse {
        total: previews.len() as i64,
        changed,
        applied,
        previews,
    })
}

#[tauri::command]
pub fn native_regex_tags(
    _state: State<'_, NativeLibraryState>,
    field: String,
    pattern: String,
    replacement: String,
    case_sensitive: Option<bool>,
    track_ids: Option<Vec<i64>>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeTagRegexReplaceResponse, String> {
    let (_, field_name) = parse_tag_field_ref(&field)?;
    if !REGEX_PRESET_FIELDS.contains(&field_name.as_str()) {
        return Err("Regex tag replacement only supports text metadata fields".to_string());
    }
    let expression = RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive.unwrap_or(false))
        .build()
        .map_err(|error| format!("Invalid regular expression: {error}"))?;
    let apply = apply.unwrap_or(false);
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, limit)?;
    let mut previews = Vec::new();
    let mut changed = 0i64;
    let mut applied = 0i64;
    for track in tracks {
        let current = match field_name.as_str() {
            "title" => track.title.clone(),
            "artist" => track.artist.clone(),
            "album" => track.album.clone(),
            "album_artist" => track.album_artist.clone(),
            "genre" => track.genre.clone(),
            _ => None,
        };
        let replacement_value = current.as_ref().map(|text| {
            expression
                .replace_all(text, replacement.as_str())
                .to_string()
        });
        let changed_here = current.is_some() && replacement_value != current;
        let mut preview = NativeTagRegexReplacePreview {
            track_id: track.id,
            path: track.path,
            field: field_name.clone(),
            current,
            replacement: replacement_value.clone(),
            changed: changed_here,
            applied: false,
            error: None,
        };
        if changed_here {
            changed += 1;
            if apply {
                match apply_tag_update(
                    &connection,
                    track.id,
                    &field_name,
                    &json_string(replacement_value),
                ) {
                    Ok(()) => {
                        preview.applied = true;
                        applied += 1;
                    }
                    Err(error) => preview.error = Some(error),
                }
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(NativeTagRegexReplaceResponse {
        total: previews.len() as i64,
        changed,
        applied,
        previews,
    })
}

fn tag_backup_dir() -> PathBuf {
    app_storage_root().join("exports").join("tag-backups")
}

fn timestamp_for_file() -> String {
    let now = OffsetDateTime::now_utc();
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        now.year(),
        u8::from(now.month()),
        now.day(),
        now.hour(),
        now.minute(),
        now.second()
    )
}

fn utc_now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .replace_microsecond(0)
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn resolve_tag_backup_path(
    backup_path: Option<String>,
    default_name: Option<String>,
) -> Result<PathBuf, String> {
    let trimmed = backup_path.unwrap_or_default().trim().to_string();
    let mut target = if trimmed.is_empty() {
        tag_backup_dir()
            .join(default_name.ok_or_else(|| "Tag backup path is required".to_string())?)
    } else {
        let path = PathBuf::from(trimmed);
        if path.is_absolute() {
            path
        } else {
            tag_backup_dir().join(path)
        }
    };
    if target
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| !value.eq_ignore_ascii_case("json"))
        .unwrap_or(true)
    {
        target.set_extension("json");
    }
    Ok(target)
}

fn json_string_map(values: &BTreeMap<String, Option<String>>) -> JsonValue {
    let mut object = serde_json::Map::new();
    for (key, value) in values {
        object.insert(key.clone(), json_string(value.clone()));
    }
    JsonValue::Object(object)
}

fn track_backup_json(track: &NativeTrack, path_key: Option<String>) -> JsonValue {
    let mut object = serde_json::Map::new();
    for field in TRACK_BACKUP_FIELDS {
        let value = match *field {
            "id" => json!(track.id),
            "path" => json!(track.path.as_str()),
            "title" => json!(track.title.as_deref()),
            "artist" => json!(track.artist.as_deref()),
            "album" => json!(track.album.as_deref()),
            "album_artist" => json!(track.album_artist.as_deref()),
            "track_number" => json!(track.track_number),
            "disc_number" => json!(track.disc_number),
            "genre" => json!(track.genre.as_deref()),
            "analysis_provider" => json!(track.analysis_provider.as_deref()),
            "analysis_model" => json!(track.analysis_model.as_deref()),
            "analysis_genre" => json!(track.analysis_genre.as_deref()),
            "analysis_genre_confidence" => json!(track.analysis_genre_confidence),
            "analysis_genre_tags" => json!(track.analysis_genre_tags.as_deref()),
            "analysis_embedding" => json!(track.analysis_embedding.as_deref()),
            "analysis_updated_at" => json!(track.analysis_updated_at.as_deref()),
            "year" => json!(track.year),
            "duration_seconds" => json!(track.duration_seconds),
            "bitrate" => json!(track.bitrate),
            "replaygain_track_gain_db" => json!(track.replaygain_track_gain_db),
            "replaygain_album_gain_db" => json!(track.replaygain_album_gain_db),
            "replaygain_track_peak" => json!(track.replaygain_track_peak),
            "replaygain_album_peak" => json!(track.replaygain_album_peak),
            "audio_fingerprint" => json!(track.audio_fingerprint.as_deref()),
            "acoustic_fingerprint" => json!(track.acoustic_fingerprint.as_deref()),
            "acoustic_fingerprint_updated_at" => {
                json!(track.acoustic_fingerprint_updated_at.as_deref())
            }
            "rating" => json!(track.rating),
            "play_count" => json!(track.play_count),
            "skip_count" => json!(track.skip_count),
            "last_played_at" => json!(track.last_played_at.as_deref()),
            "last_skipped_at" => json!(track.last_skipped_at.as_deref()),
            "date_added" => json!(track.date_added.as_str()),
            "file_modified_at" => json!(track.file_modified_at.as_deref()),
            _ => JsonValue::Null,
        };
        object.insert((*field).to_string(), value);
    }
    object.insert("path_key".to_string(), json_string(path_key));
    JsonValue::Object(object)
}

fn core_metadata_json(track: &NativeTrack) -> JsonValue {
    json!({
        "title": track.title.as_deref(),
        "artist": track.artist.as_deref(),
        "album": track.album.as_deref(),
        "album_artist": track.album_artist.as_deref(),
        "track_number": track.track_number,
        "disc_number": track.disc_number,
        "genre": track.genre.as_deref(),
        "year": track.year,
        "rating": track.rating,
    })
}

fn path_keys_for_tracks(
    connection: &Connection,
    track_ids: &[i64],
) -> Result<BTreeMap<i64, Option<String>>, String> {
    let mut result = track_ids
        .iter()
        .map(|id| (*id, None))
        .collect::<BTreeMap<_, _>>();
    if track_ids.is_empty() {
        return Ok(result);
    }
    let placeholders = vec!["?"; track_ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT id, path_key FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare native tag-backup path-key query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(track_ids.iter()), |row| {
            Ok((
                row.get::<_, i64>("id")?,
                row.get::<_, Option<String>>("path_key")?,
            ))
        })
        .map_err(|error| format!("Could not read native tag-backup path keys: {error}"))?;
    for row in rows {
        let (id, path_key) =
            row.map_err(|error| format!("Could not decode native tag-backup path key: {error}"))?;
        result.insert(id, path_key);
    }
    Ok(result)
}

fn load_tag_backup(path: &Path) -> Result<JsonValue, String> {
    if !path.is_file() {
        return Err("Tag backup file does not exist".to_string());
    }
    let text =
        fs::read_to_string(path).map_err(|error| format!("Could not read tag backup: {error}"))?;
    let payload = serde_json::from_str::<JsonValue>(&text)
        .map_err(|error| format!("Could not read tag backup: {error}"))?;
    if !payload
        .get("format")
        .and_then(JsonValue::as_str)
        .is_some_and(|format| format == "flac-cafe-tag-backup-v1")
    {
        return Err("Unsupported tag backup format".to_string());
    }
    Ok(payload)
}

fn backup_entry_track(
    connection: &Connection,
    entry: &serde_json::Map<String, JsonValue>,
    allowed_ids: Option<&HashSet<i64>>,
) -> Result<Option<NativeTrack>, String> {
    let Some(track) = entry.get("track").and_then(JsonValue::as_object) else {
        return Ok(None);
    };
    if let Some(track_id) = track.get("id").and_then(JsonValue::as_i64) {
        if allowed_ids.is_none_or(|ids| ids.contains(&track_id)) {
            let found = connection
                .query_row(
                    &format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?"),
                    params![track_id],
                    track_from_row,
                )
                .optional()
                .map_err(|error| format!("Could not read tag backup track by id: {error}"))?;
            if found.is_some() {
                return Ok(found);
            }
        }
    }
    if let Some(path_key) = track
        .get("path_key")
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let found = connection
            .query_row(
                &format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE path_key = ?"),
                params![path_key],
                track_from_row,
            )
            .optional()
            .map_err(|error| format!("Could not read tag backup track by path key: {error}"))?;
        if let Some(track) = found {
            if allowed_ids.is_none_or(|ids| ids.contains(&track.id)) {
                return Ok(Some(track));
            }
        }
    }
    Ok(None)
}

fn tag_json_values_equal(current: &JsonValue, restored: &JsonValue) -> bool {
    if current.is_null() && restored.is_null() {
        return true;
    }
    if restored.is_number() && !current.is_null() {
        if let (Some(left), Some(right)) = (coerce_f64(current), coerce_f64(restored)) {
            return (left - right).abs() < 1e-9;
        }
        return false;
    }
    current == restored
}

fn backup_current_values(
    track: &NativeTrack,
    custom_tags: &BTreeMap<String, Option<String>>,
    include_custom_tags: bool,
) -> JsonValue {
    let mut object = serde_json::Map::new();
    if let JsonValue::Object(core) = core_metadata_json(track) {
        object.extend(core);
    }
    if include_custom_tags {
        for (key, value) in custom_tags {
            object.insert(format!("custom:{key}"), json_string(value.clone()));
        }
    }
    JsonValue::Object(object)
}

fn restored_backup_values(
    entry: &serde_json::Map<String, JsonValue>,
    restore_custom_tags: bool,
) -> Result<JsonValue, String> {
    let mut object = serde_json::Map::new();
    if let Some(metadata) = entry.get("metadata").and_then(JsonValue::as_object) {
        for field in TAG_CORE_FIELDS {
            if let Some(value) = metadata.get(*field) {
                object.insert((*field).to_string(), value.clone());
            }
        }
    }
    if restore_custom_tags {
        if let Some(custom_tags) = entry.get("custom_tags").and_then(JsonValue::as_object) {
            for (key, value) in custom_tags {
                let clean = clean_custom_tag_key(key)?;
                object.insert(format!("custom:{clean}"), value.clone());
            }
        }
    }
    Ok(JsonValue::Object(object))
}

fn tag_backup_undo_payload(
    track: &NativeTrack,
    custom_tags: &BTreeMap<String, Option<String>>,
    changed_fields: &[String],
) -> JsonValue {
    let mut track_object = serde_json::Map::new();
    if let JsonValue::Object(core) = core_metadata_json(track) {
        track_object.extend(core);
    }
    track_object.insert("id".to_string(), json!(track.id));
    track_object.insert("path".to_string(), json!(track.path.as_str()));
    json!({
        "source": "tag_backup_restore",
        "track": JsonValue::Object(track_object),
        "custom_tags": json_string_map(custom_tags),
        "changed_fields": changed_fields,
    })
}

fn write_tag_backup_restore_undo(
    connection: &Connection,
    batch_id: &str,
    track: &NativeTrack,
    custom_tags: &BTreeMap<String, Option<String>>,
    changed_fields: &[String],
) -> Result<(), String> {
    let title = track
        .title
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            Path::new(&track.path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("track")
        });
    let payload = tag_backup_undo_payload(track, custom_tags, changed_fields);
    connection
        .execute(
            "INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
             VALUES(?, 'tag_backup_restore', ?, ?)",
            params![
                batch_id,
                format!("Restored tag backup for {title}"),
                payload.to_string()
            ],
        )
        .map_err(|error| format!("Could not write tag backup undo entry: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn native_create_tag_backup(
    _state: State<'_, NativeLibraryState>,
    backup_path: Option<String>,
    track_ids: Option<Vec<i64>>,
    include_custom_tags: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeTagBackupResponse, String> {
    let limit = limit.unwrap_or(100_000).clamp(1, 500_000);
    let include_custom_tags = include_custom_tags.unwrap_or(true);
    let created_at = utc_now_rfc3339();
    let target = resolve_tag_backup_path(
        backup_path,
        Some(format!("flac-cafe-tags-{}.json", timestamp_for_file())),
    )?;
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, Some(limit))?;
    let ids = tracks.iter().map(|track| track.id).collect::<Vec<_>>();
    let path_keys = path_keys_for_tracks(&connection, &ids)?;
    let custom_by_track = if include_custom_tags {
        custom_tags_for_tracks(&connection, &ids)?
    } else {
        BTreeMap::new()
    };
    let mut custom_tag_count = 0i64;
    let tracks_json = tracks
        .iter()
        .map(|track| {
            let custom_tags = custom_by_track.get(&track.id).cloned().unwrap_or_default();
            custom_tag_count += custom_tags.len() as i64;
            json!({
                "track": track_backup_json(track, path_keys.get(&track.id).cloned().flatten()),
                "metadata": core_metadata_json(track),
                "custom_tags": json_string_map(&custom_tags),
            })
        })
        .collect::<Vec<_>>();
    let payload = json!({
        "format": "flac-cafe-tag-backup-v1",
        "created_at": created_at,
        "track_count": tracks_json.len(),
        "include_custom_tags": include_custom_tags,
        "tracks": tracks_json,
    });
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create tag backup folder {}: {error}",
                parent.display()
            )
        })?;
    }
    let text = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Could not encode tag backup: {error}"))?;
    fs::write(&target, text).map_err(|error| format!("Could not write tag backup: {error}"))?;
    Ok(NativeTagBackupResponse {
        backup_path: target.to_string_lossy().to_string(),
        track_count: tracks_json.len() as i64,
        custom_tag_count,
        created_at,
    })
}

#[tauri::command]
pub fn native_list_tag_backups(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<NativeTagBackupSummary>, String> {
    let limit = limit.unwrap_or(30).clamp(1, 200);
    let folder = tag_backup_dir();
    if !folder.is_dir() {
        return Ok(Vec::new());
    }
    let mut entries = fs::read_dir(&folder)
        .map_err(|error| {
            format!(
                "Could not read tag backup folder {}: {error}",
                folder.display()
            )
        })?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("json"))
            {
                let modified = entry
                    .metadata()
                    .and_then(|metadata| metadata.modified())
                    .ok();
                Some((path, modified))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| right.1.cmp(&left.1));

    let mut summaries = Vec::new();
    for (path, _) in entries.into_iter().take(limit) {
        let metadata = fs::metadata(&path).ok();
        let payload = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<JsonValue>(&text).ok());
        let created_at = payload
            .as_ref()
            .and_then(|value| value.get("created_at"))
            .and_then(JsonValue::as_str)
            .map(ToOwned::to_owned);
        let track_count = payload
            .as_ref()
            .and_then(|value| value.get("track_count"))
            .and_then(JsonValue::as_i64)
            .unwrap_or(0);
        summaries.push(NativeTagBackupSummary {
            backup_path: path.to_string_lossy().to_string(),
            file_name: path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string(),
            track_count,
            created_at,
            size_bytes: metadata.map(|value| value.len() as i64).unwrap_or(0),
        });
    }
    Ok(summaries)
}

#[tauri::command]
pub fn native_restore_tag_backup(
    _state: State<'_, NativeLibraryState>,
    backup_path: String,
    track_ids: Option<Vec<i64>>,
    missing_only: Option<bool>,
    restore_custom_tags: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeTagBackupRestoreResponse, String> {
    let limit = limit.unwrap_or(10_000).clamp(1, 100_000);
    let source = resolve_tag_backup_path(Some(backup_path), None)?;
    let payload = load_tag_backup(&source)?;
    let entries = payload
        .get("tracks")
        .and_then(JsonValue::as_array)
        .ok_or_else(|| "Tag backup has no tracks".to_string())?;
    let entries = entries.iter().take(limit).collect::<Vec<_>>();
    let allowed_ids =
        track_ids.map(|ids| ids.into_iter().filter(|id| *id > 0).collect::<HashSet<_>>());
    let missing_only = missing_only.unwrap_or(false);
    let restore_custom_tags = restore_custom_tags.unwrap_or(true);
    let apply = apply.unwrap_or(false);
    let batch_id = format!("tag-backup-restore-{}", timestamp_for_file());
    let connection = open_database()?;

    let mut previews = Vec::new();
    let mut errors = Vec::new();
    let mut matched = 0i64;
    let mut changed = 0i64;
    let mut applied = 0i64;
    for entry in &entries {
        let mut preview = NativeTagBackupRestorePreview {
            track_id: None,
            path: None,
            matched: false,
            changed_fields: Vec::new(),
            current: json!({}),
            restored: json!({}),
            applied: false,
            error: None,
        };
        let Some(entry_object) = entry.as_object() else {
            continue;
        };
        match (|| -> Result<(), String> {
            let Some(track) = backup_entry_track(&connection, entry_object, allowed_ids.as_ref())?
            else {
                return Err("No library track matched this backup entry".to_string());
            };
            preview.track_id = Some(track.id);
            preview.path = Some(track.path.clone());
            preview.matched = true;
            matched += 1;
            let current_custom = custom_tags_for_tracks(&connection, &[track.id])?
                .remove(&track.id)
                .unwrap_or_default();
            let current = backup_current_values(&track, &current_custom, restore_custom_tags);
            let restored = restored_backup_values(entry_object, restore_custom_tags)?;
            let mut changed_fields = Vec::new();
            if let Some(restored_object) = restored.as_object() {
                for (field, restored_value) in restored_object {
                    let current_value = tag_field_value(&track, &current_custom, field)?;
                    if missing_only && !value_missing(&current_value) {
                        continue;
                    }
                    if !tag_json_values_equal(&current_value, restored_value) {
                        changed_fields.push(field.clone());
                    }
                }
            }
            changed_fields.sort();
            preview.current = current;
            preview.restored = restored.clone();
            preview.changed_fields = changed_fields.clone();
            if !changed_fields.is_empty() {
                changed += 1;
            }
            if apply && !changed_fields.is_empty() {
                write_tag_backup_restore_undo(
                    &connection,
                    &batch_id,
                    &track,
                    &current_custom,
                    &changed_fields,
                )?;
                let restored_object = restored
                    .as_object()
                    .ok_or_else(|| "Tag backup restored values are invalid".to_string())?;
                for field in &changed_fields {
                    if let Some(value) = restored_object.get(field) {
                        apply_tag_update(&connection, track.id, field, value)?;
                    }
                }
                preview.applied = true;
                applied += 1;
            }
            Ok(())
        })() {
            Ok(()) => {}
            Err(error) => {
                preview.error = Some(error.clone());
                errors.push(error);
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(NativeTagBackupRestoreResponse {
        backup_path: source.to_string_lossy().to_string(),
        total: entries.len() as i64,
        matched,
        changed,
        applied,
        errors: errors.into_iter().take(100).collect(),
        previews,
    })
}
