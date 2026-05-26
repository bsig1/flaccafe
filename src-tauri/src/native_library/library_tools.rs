use super::types::*;
use super::{open_database, track_from_row, TRACK_COLUMNS};
use regex::{Regex, RegexBuilder};
use rusqlite::types::Value as SqlValue;
use rusqlite::{params, params_from_iter, Connection};
use serde_json::{json, Value as JsonValue};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::State;

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
