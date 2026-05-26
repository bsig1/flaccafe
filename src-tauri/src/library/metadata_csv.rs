use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension, ToSql};
use serde_json::{json, Value as JsonValue};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use time::OffsetDateTime;

use super::{
    app_storage_root, normalized_path_key, open_database, DesktopCsvMetadataExportResponse,
    DesktopCsvMetadataImportPreview, DesktopCsvMetadataImportReportResponse,
    DesktopCsvMetadataImportResponse, TRACK_COLUMNS,
};

const METADATA_CSV_COLUMNS: &[&str] = &[
    "id",
    "path",
    "path_key",
    "title",
    "artist",
    "album",
    "album_artist",
    "track_number",
    "disc_number",
    "genre",
    "year",
    "duration_seconds",
    "bitrate",
    "analysis_genre",
    "analysis_genre_confidence",
    "rating",
    "play_count",
    "skip_count",
    "last_played_at",
    "last_skipped_at",
    "date_added",
    "file_modified_at",
];
const CSV_IMPORT_FIELDS: &[&str] = &[
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

fn export_dir() -> PathBuf {
    app_storage_root().join("exports")
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

fn resolve_csv_tool_path(csv_path: Option<String>, default_name: &str) -> PathBuf {
    let trimmed = csv_path.unwrap_or_default().trim().to_string();
    let mut target = if trimmed.is_empty() {
        export_dir().join(default_name)
    } else {
        let path = PathBuf::from(trimmed);
        if path.is_absolute() {
            path
        } else {
            export_dir().join(path)
        }
    };
    if target
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| !value.eq_ignore_ascii_case("csv"))
        .unwrap_or(true)
    {
        target.set_extension("csv");
    }
    target
}

fn csv_escape_cell(value: &str) -> String {
    if value.contains([',', '"', '\r', '\n']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn csv_value(value: Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::Integer(value) => value.to_string(),
        Value::Real(value) => value.to_string(),
        Value::Text(value) => value,
        Value::Blob(value) => String::from_utf8_lossy(&value).to_string(),
    }
}

fn csv_line(values: impl IntoIterator<Item = String>) -> String {
    values
        .into_iter()
        .map(|value| csv_escape_cell(&value))
        .collect::<Vec<_>>()
        .join(",")
}

pub fn export_metadata_csv(
    csv_path: Option<String>,
    track_ids: Option<Vec<i64>>,
    limit: Option<usize>,
) -> Result<DesktopCsvMetadataExportResponse, String> {
    let limit = limit.unwrap_or(100_000).clamp(1, 500_000);
    let target = resolve_csv_tool_path(
        csv_path,
        &format!("flac-cafe-metadata-{}.csv", timestamp_for_file()),
    );
    let mut ids = track_ids
        .unwrap_or_default()
        .into_iter()
        .filter(|id| *id > 0)
        .collect::<Vec<_>>();
    let mut seen = HashSet::new();
    ids.retain(|id| seen.insert(*id));

    let selected_columns = METADATA_CSV_COLUMNS.join(", ");
    let connection = open_database()?;
    let rows = if ids.is_empty() {
        let query = format!(
            "SELECT {selected_columns}
             FROM tracks
             ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                      coalesce(disc_number, 0), coalesce(track_number, 0),
                      lower(coalesce(title, ''))
             LIMIT ?"
        );
        let mut statement = connection
            .prepare(&query)
            .map_err(|error| format!("Could not prepare Rust CSV export query: {error}"))?;
        let mapped = statement
            .query_map([limit as i64], |row| {
                let mut values = Vec::with_capacity(METADATA_CSV_COLUMNS.len());
                for column in METADATA_CSV_COLUMNS {
                    values.push(csv_value(row.get::<_, Value>(*column)?));
                }
                Ok(values)
            })
            .map_err(|error| format!("Could not read Rust CSV export rows: {error}"))?;
        mapped
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode Rust CSV export rows: {error}"))?
    } else {
        let ids = ids.into_iter().take(limit).collect::<Vec<_>>();
        let placeholders = vec!["?"; ids.len()].join(",");
        let query = format!(
            "SELECT {selected_columns}
             FROM tracks
             WHERE id IN ({placeholders})
             ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                      coalesce(disc_number, 0), coalesce(track_number, 0),
                      lower(coalesce(title, ''))
             LIMIT ?"
        );
        let mut parameters = ids.iter().map(|id| id as &dyn ToSql).collect::<Vec<_>>();
        let limit_value = limit as i64;
        parameters.push(&limit_value);
        let mut statement = connection.prepare(&query).map_err(|error| {
            format!("Could not prepare Rust selected CSV export query: {error}")
        })?;
        let mapped = statement
            .query_map(params_from_iter(parameters), |row| {
                let mut values = Vec::with_capacity(METADATA_CSV_COLUMNS.len());
                for column in METADATA_CSV_COLUMNS {
                    values.push(csv_value(row.get::<_, Value>(*column)?));
                }
                Ok(values)
            })
            .map_err(|error| format!("Could not read Rust selected CSV export rows: {error}"))?;
        mapped
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode Rust selected CSV export rows: {error}"))?
    };

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create CSV export folder {}: {error}",
                parent.display()
            )
        })?;
    }
    let mut lines = Vec::with_capacity(rows.len() + 1);
    lines.push(csv_line(
        METADATA_CSV_COLUMNS
            .iter()
            .map(|column| (*column).to_string()),
    ));
    for row in &rows {
        lines.push(csv_line(row.clone()));
    }
    fs::write(&target, format!("{}\n", lines.join("\n")))
        .map_err(|error| format!("Could not write metadata CSV: {error}"))?;

    Ok(DesktopCsvMetadataExportResponse {
        csv_path: target.to_string_lossy().to_string(),
        track_count: rows.len() as i64,
        columns: METADATA_CSV_COLUMNS
            .iter()
            .map(|column| (*column).to_string())
            .collect(),
    })
}

fn resolve_required_csv_tool_path(csv_path: Option<String>) -> Result<PathBuf, String> {
    let text = csv_path.unwrap_or_default().trim().to_string();
    if text.is_empty() {
        return Err("CSV path is required".to_string());
    }
    Ok(resolve_csv_tool_path(Some(text), "metadata.csv"))
}

fn resolve_json_tool_path(json_path: Option<String>, default_name: &str) -> PathBuf {
    let trimmed = json_path.unwrap_or_default().trim().to_string();
    let mut target = if trimmed.is_empty() {
        export_dir().join(default_name)
    } else {
        let path = PathBuf::from(trimmed);
        if path.is_absolute() {
            path
        } else {
            export_dir().join(path)
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
    target
}

#[derive(Clone)]
struct CsvTrack {
    id: i64,
    path: String,
    path_key: Option<String>,
    fields: HashMap<String, JsonValue>,
}

fn json_string(value: Option<String>) -> JsonValue {
    value.map(JsonValue::String).unwrap_or(JsonValue::Null)
}

fn json_i64(value: Option<i64>) -> JsonValue {
    value
        .map(|value| JsonValue::Number(value.into()))
        .unwrap_or(JsonValue::Null)
}

fn json_f64(value: Option<f64>) -> JsonValue {
    value
        .and_then(serde_json::Number::from_f64)
        .map(JsonValue::Number)
        .unwrap_or(JsonValue::Null)
}

fn csv_track_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CsvTrack> {
    let mut fields = HashMap::new();
    fields.insert("title".to_string(), json_string(row.get("title")?));
    fields.insert("artist".to_string(), json_string(row.get("artist")?));
    fields.insert("album".to_string(), json_string(row.get("album")?));
    fields.insert(
        "album_artist".to_string(),
        json_string(row.get("album_artist")?),
    );
    fields.insert(
        "track_number".to_string(),
        json_i64(row.get("track_number")?),
    );
    fields.insert("disc_number".to_string(), json_i64(row.get("disc_number")?));
    fields.insert("genre".to_string(), json_string(row.get("genre")?));
    fields.insert("year".to_string(), json_i64(row.get("year")?));
    fields.insert("rating".to_string(), json_f64(row.get("rating")?));
    Ok(CsvTrack {
        id: row.get("id")?,
        path: row.get("path")?,
        path_key: row.get("path_key")?,
        fields,
    })
}

fn csv_text(value: Option<&String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn csv_int(value: Option<&String>, field: &str) -> Result<JsonValue, String> {
    let Some(text) = csv_text(value) else {
        return Ok(JsonValue::Null);
    };
    let parsed = text
        .parse::<f64>()
        .map_err(|_| format!("{field} must be a number"))?
        .round() as i64;
    Ok(json!(parsed))
}

fn csv_rating(value: Option<&String>) -> Result<JsonValue, String> {
    let Some(text) = csv_text(value) else {
        return Ok(JsonValue::Null);
    };
    let rating = text
        .parse::<f64>()
        .map_err(|_| "rating must be a number".to_string())?;
    if rating == 0.0 {
        return Ok(JsonValue::Null);
    }
    if !(0.5..=5.0).contains(&rating) || ((rating * 2.0).round() - rating * 2.0).abs() > 1e-9 {
        return Err("rating must be 0.5 to 5 in half-star steps".to_string());
    }
    Ok(json!(rating))
}

fn csv_value_missing(value: &JsonValue) -> bool {
    value.is_null() || value.as_str().is_some_and(|text| text.trim().is_empty())
}

fn csv_values_equal(current: &JsonValue, imported: &JsonValue) -> bool {
    if current.is_null() && imported.is_null() {
        return true;
    }
    if imported.is_f64() || imported.is_i64() || imported.is_u64() {
        if let (Some(left), Some(right)) = (
            current.as_f64().or_else(|| {
                current
                    .as_str()
                    .and_then(|text| text.trim().parse::<f64>().ok())
            }),
            imported.as_f64(),
        ) {
            return (left - right).abs() < 1e-9;
        }
        return false;
    }
    current == imported
}

fn parse_csv_import_values(
    row: &HashMap<String, String>,
    column_map: &HashMap<String, String>,
    clear_blank_fields: bool,
) -> Result<HashMap<String, JsonValue>, String> {
    let mut imported = HashMap::new();
    for field in CSV_IMPORT_FIELDS {
        let column = column_map.get(*field).map(String::as_str).unwrap_or(field);
        if !row.contains_key(column) {
            continue;
        }
        if csv_text(row.get(column)).is_none() && !clear_blank_fields {
            continue;
        }
        let value = match *field {
            "track_number" | "disc_number" | "year" => csv_int(row.get(column), field)?,
            "rating" => csv_rating(row.get(column))?,
            _ => json_string(csv_text(row.get(column))),
        };
        imported.insert((*field).to_string(), value);
    }
    Ok(imported)
}

fn csv_import_changes(
    track: &CsvTrack,
    imported: &HashMap<String, JsonValue>,
    missing_only: bool,
) -> HashMap<String, JsonValue> {
    let mut changes = HashMap::new();
    for (field, value) in imported {
        let current = track.fields.get(field).unwrap_or(&JsonValue::Null);
        if missing_only && !csv_value_missing(current) {
            continue;
        }
        if !csv_values_equal(current, value) {
            changes.insert(field.clone(), value.clone());
        }
    }
    changes
}

fn csv_conflict_fields(track: &CsvTrack, changes: &HashMap<String, JsonValue>) -> Vec<String> {
    let mut fields = changes
        .iter()
        .filter_map(|(field, value)| {
            let current = track.fields.get(field).unwrap_or(&JsonValue::Null);
            if !csv_value_missing(current) && !csv_values_equal(current, value) {
                Some(field.clone())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    fields.sort();
    fields
}

fn parse_csv_track_id(value: Option<&String>) -> Option<i64> {
    csv_text(value).and_then(|text| text.parse::<f64>().ok().map(|number| number as i64))
}

fn csv_import_track(
    connection: &Connection,
    row: &HashMap<String, String>,
    allowed_ids: Option<&HashSet<i64>>,
) -> Result<Option<CsvTrack>, String> {
    if let Some(track_id) = parse_csv_track_id(row.get("id")) {
        if allowed_ids.is_none_or(|ids| ids.contains(&track_id)) {
            let found = connection
                .query_row(
                    &format!("SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE id = ?"),
                    params![track_id],
                    csv_track_from_row,
                )
                .optional()
                .map_err(|error| format!("Could not read CSV import track by id: {error}"))?;
            if found.is_some() {
                return Ok(found);
            }
        }
    }
    let path_key = csv_text(row.get("path_key"))
        .or_else(|| csv_text(row.get("path")).map(|path| normalized_path_key(&path)));
    if let Some(path_key) = path_key {
        let found = connection
            .query_row(
                &format!("SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE path_key = ?"),
                params![path_key],
                csv_track_from_row,
            )
            .optional()
            .map_err(|error| format!("Could not read CSV import track by path key: {error}"))?;
        if let Some(track) = found {
            if allowed_ids.is_none_or(|ids| ids.contains(&track.id)) {
                return Ok(Some(track));
            }
        }
    }
    if let Some(path) = csv_text(row.get("path")) {
        let found = connection
            .query_row(
                &format!("SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE path = ?"),
                params![path],
                csv_track_from_row,
            )
            .optional()
            .map_err(|error| format!("Could not read CSV import track by path: {error}"))?;
        if let Some(track) = found {
            if allowed_ids.is_none_or(|ids| ids.contains(&track.id)) {
                return Ok(Some(track));
            }
        }
    }
    Ok(None)
}

fn json_object_from_map(values: &HashMap<String, JsonValue>) -> JsonValue {
    let mut object = serde_json::Map::new();
    for (key, value) in values {
        object.insert(key.clone(), value.clone());
    }
    JsonValue::Object(object)
}

fn update_track_csv_field(
    connection: &Connection,
    track_id: i64,
    field: &str,
    value: &JsonValue,
) -> Result<(), String> {
    let text_value = || {
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
    };
    match field {
        "title" | "artist" | "album" | "album_artist" | "genre" => {
            let value = text_value();
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
                .map_err(|error| format!("Could not update CSV metadata field {field}: {error}"))?;
        }
        "track_number" | "disc_number" | "year" => {
            let value = value
                .as_i64()
                .or_else(|| value.as_f64().map(|number| number.round() as i64))
                .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()));
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
                .map_err(|error| format!("Could not update CSV metadata field {field}: {error}"))?;
        }
        "rating" => {
            let value = value.as_f64();
            connection
                .execute(
                    "UPDATE tracks SET rating = ?, updated_at = datetime('now') WHERE id = ?",
                    params![value, track_id],
                )
                .map_err(|error| format!("Could not update CSV rating: {error}"))?;
        }
        _ => return Err(format!("Unsupported CSV metadata field {field}")),
    }
    Ok(())
}

fn write_csv_import_undo(
    connection: &Connection,
    batch_id: &str,
    track: &CsvTrack,
    changes: &HashMap<String, JsonValue>,
    csv_path: &str,
    row_number: i64,
) -> Result<(), String> {
    let mut track_object = serde_json::Map::new();
    track_object.insert("id".to_string(), json!(track.id));
    track_object.insert("path".to_string(), json!(track.path.as_str()));
    track_object.insert("path_key".to_string(), json_string(track.path_key.clone()));
    for (field, value) in &track.fields {
        track_object.insert(field.clone(), value.clone());
    }
    let payload = json!({
        "track": JsonValue::Object(track_object),
        "changes": json_object_from_map(changes),
        "csv_path": csv_path,
        "row_number": row_number,
    });
    connection
        .execute(
            "INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
             VALUES(?, 'csv_metadata_import', ?, ?)",
            params![
                batch_id,
                format!("CSV metadata import row {row_number}"),
                payload.to_string()
            ],
        )
        .map_err(|error| format!("Could not write CSV import undo entry: {error}"))?;
    Ok(())
}

fn read_csv_rows(source: &PathBuf, limit: usize) -> Result<Vec<HashMap<String, String>>, String> {
    if !source.is_file() {
        return Err("CSV file does not exist".to_string());
    }
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_path(source)
        .map_err(|error| format!("Could not read CSV: {error}"))?;
    let headers = reader
        .headers()
        .map_err(|error| format!("Could not read CSV headers: {error}"))?
        .clone();
    let mut rows = Vec::new();
    for record in reader.records().take(limit) {
        let record = record.map_err(|error| format!("Could not read CSV row: {error}"))?;
        let mut row = HashMap::new();
        for (header, value) in headers.iter().zip(record.iter()) {
            row.insert(header.to_string(), value.to_string());
        }
        rows.push(row);
    }
    Ok(rows)
}

#[allow(clippy::too_many_arguments)]
pub fn import_metadata_csv(
    csv_path: Option<String>,
    track_ids: Option<Vec<i64>>,
    column_map: Option<JsonValue>,
    missing_only: Option<bool>,
    clear_blank_fields: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopCsvMetadataImportResponse, String> {
    let source = resolve_required_csv_tool_path(csv_path)?;
    let rows = read_csv_rows(&source, limit.unwrap_or(10_000).clamp(1, 100_000))?;
    let allowed_ids =
        track_ids.map(|ids| ids.into_iter().filter(|id| *id > 0).collect::<HashSet<_>>());
    let column_map = column_map
        .and_then(|value| value.as_object().cloned())
        .map(|object| {
            object
                .into_iter()
                .filter_map(|(key, value)| value.as_str().map(|text| (key, text.to_string())))
                .collect::<HashMap<_, _>>()
        })
        .unwrap_or_default();
    let missing_only = missing_only.unwrap_or(true);
    let clear_blank_fields = clear_blank_fields.unwrap_or(false);
    let apply = apply.unwrap_or(false);
    let batch_id = format!("csv-import-{}", timestamp_for_file());
    let connection = open_database()?;
    let mut previews = Vec::new();
    let mut errors = Vec::new();
    let mut matched = 0i64;
    let mut changed = 0i64;
    let mut applied = 0i64;
    for (index, row) in rows.iter().enumerate() {
        let row_number = index as i64 + 2;
        let mut preview = DesktopCsvMetadataImportPreview {
            row_number,
            track_id: None,
            path: None,
            matched: false,
            current: json!({}),
            imported: json!({}),
            changed_fields: Vec::new(),
            conflict_fields: Vec::new(),
            applied: false,
            error: None,
        };
        match (|| -> Result<(), String> {
            let Some(track) = csv_import_track(&connection, row, allowed_ids.as_ref())? else {
                return Err("No library track matched this row".to_string());
            };
            preview.track_id = Some(track.id);
            preview.path = Some(track.path.clone());
            preview.matched = true;
            matched += 1;
            let imported = parse_csv_import_values(row, &column_map, clear_blank_fields)?;
            let changes = csv_import_changes(&track, &imported, missing_only);
            let mut changed_fields = changes.keys().cloned().collect::<Vec<_>>();
            changed_fields.sort();
            preview.current = json_object_from_map(&track.fields);
            preview.imported = json_object_from_map(&imported);
            preview.changed_fields = changed_fields.clone();
            preview.conflict_fields = csv_conflict_fields(&track, &changes);
            if !changes.is_empty() {
                changed += 1;
            }
            if apply && !changes.is_empty() {
                write_csv_import_undo(
                    &connection,
                    &batch_id,
                    &track,
                    &changes,
                    &source.to_string_lossy(),
                    row_number,
                )?;
                for field in &changed_fields {
                    if let Some(value) = changes.get(field) {
                        update_track_csv_field(&connection, track.id, field, value)?;
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
                errors.push(format!("Row {row_number}: {error}"));
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        connection
            .execute("DELETE FROM library_query_cache", [])
            .map_err(|error| format!("Could not clear library query cache: {error}"))?;
    }
    Ok(DesktopCsvMetadataImportResponse {
        csv_path: source.to_string_lossy().to_string(),
        total: rows.len() as i64,
        matched,
        changed,
        applied,
        errors: errors.into_iter().take(50).collect(),
        previews,
    })
}

#[allow(clippy::too_many_arguments)]
pub fn export_metadata_csv_import_report(
    csv_path: Option<String>,
    report_path: Option<String>,
    track_ids: Option<Vec<i64>>,
    column_map: Option<JsonValue>,
    missing_only: Option<bool>,
    clear_blank_fields: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopCsvMetadataImportReportResponse, String> {
    let response = import_metadata_csv(
        csv_path,
        track_ids,
        column_map,
        missing_only,
        clear_blank_fields,
        Some(false),
        limit,
    )?;
    let target = resolve_json_tool_path(
        report_path,
        &format!("flac-cafe-csv-import-report-{}.json", timestamp_for_file()),
    );
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create CSV import report folder {}: {error}",
                parent.display()
            )
        })?;
    }
    let payload = json!({
        "generated_by": "FLAC Cafe",
        "type": "csv_metadata_import",
        "csv_path": response.csv_path,
        "total": response.total,
        "matched": response.matched,
        "changed": response.changed,
        "errors": response.errors,
        "previews": response.previews,
    });
    let text = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Could not encode CSV import report: {error}"))?;
    fs::write(&target, text)
        .map_err(|error| format!("Could not write CSV import report: {error}"))?;
    Ok(DesktopCsvMetadataImportReportResponse {
        report_path: target.to_string_lossy().to_string(),
        csv_path: payload
            .get("csv_path")
            .and_then(JsonValue::as_str)
            .unwrap_or_default()
            .to_string(),
        total: payload
            .get("total")
            .and_then(JsonValue::as_i64)
            .unwrap_or(0),
        matched: payload
            .get("matched")
            .and_then(JsonValue::as_i64)
            .unwrap_or(0),
        changed: payload
            .get("changed")
            .and_then(JsonValue::as_i64)
            .unwrap_or(0),
        errors: payload
            .get("errors")
            .and_then(JsonValue::as_array)
            .map(|items| items.len() as i64)
            .unwrap_or(0),
    })
}
