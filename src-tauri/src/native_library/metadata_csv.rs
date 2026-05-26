use rusqlite::types::Value;
use rusqlite::{params_from_iter, ToSql};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use time::OffsetDateTime;

use super::{app_storage_root, open_database, NativeCsvMetadataExportResponse};

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

pub fn native_export_metadata_csv(
    csv_path: Option<String>,
    track_ids: Option<Vec<i64>>,
    limit: Option<usize>,
) -> Result<NativeCsvMetadataExportResponse, String> {
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
            .map_err(|error| format!("Could not prepare native CSV export query: {error}"))?;
        let mapped = statement
            .query_map([limit as i64], |row| {
                let mut values = Vec::with_capacity(METADATA_CSV_COLUMNS.len());
                for column in METADATA_CSV_COLUMNS {
                    values.push(csv_value(row.get::<_, Value>(*column)?));
                }
                Ok(values)
            })
            .map_err(|error| format!("Could not read native CSV export rows: {error}"))?;
        mapped
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native CSV export rows: {error}"))?
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
            format!("Could not prepare native selected CSV export query: {error}")
        })?;
        let mapped = statement
            .query_map(params_from_iter(parameters), |row| {
                let mut values = Vec::with_capacity(METADATA_CSV_COLUMNS.len());
                for column in METADATA_CSV_COLUMNS {
                    values.push(csv_value(row.get::<_, Value>(*column)?));
                }
                Ok(values)
            })
            .map_err(|error| format!("Could not read native selected CSV export rows: {error}"))?;
        mapped
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native selected CSV export rows: {error}"))?
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

    Ok(NativeCsvMetadataExportResponse {
        csv_path: target.to_string_lossy().to_string(),
        track_count: rows.len() as i64,
        columns: METADATA_CSV_COLUMNS
            .iter()
            .map(|column| (*column).to_string())
            .collect(),
    })
}
