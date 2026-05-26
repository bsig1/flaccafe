use rusqlite::Connection;
use serde::Serialize;
use serde_json::{json, Value as JsonValue};
use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use zip::write::FileOptions;

use super::storage::{app_storage_root, database_path, open_database};

const MEDIA_TYPES: &[(&str, &str)] = &[
    (".flac", "audio/flac"),
    (".mp3", "audio/mpeg"),
    (".m4a", "audio/mp4"),
    (".ogg", "audio/ogg"),
    (".opus", "audio/ogg"),
    (".wav", "audio/wav"),
    (".aiff", "audio/aiff"),
    (".aif", "audio/aiff"),
];

#[derive(Serialize)]
pub(crate) struct DesktopDiagnosticItem {
    key: String,
    label: String,
    ok: bool,
    message: String,
    path: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct DesktopStartupDiagnosticsResponse {
    ok: bool,
    generated_at: String,
    items: Vec<DesktopDiagnosticItem>,
    log_path: String,
    app_data_path: String,
}

#[derive(Serialize)]
pub(crate) struct DesktopLogTailResponse {
    path: String,
    exists: bool,
    lines: Vec<String>,
}

#[derive(Serialize)]
pub(crate) struct DesktopSupportBundleResponse {
    bundle_path: String,
    file_count: usize,
}

#[derive(Serialize)]
pub(crate) struct DesktopBackupResponse {
    backup_path: String,
}

#[derive(Serialize)]
pub(crate) struct DesktopLocalDataResetResponse {
    reset: bool,
    backup_path: Option<String>,
    database_path: String,
    removed_paths: Vec<String>,
    message: String,
}

pub(crate) fn startup_diagnostics() -> Result<DesktopStartupDiagnosticsResponse, String> {
    let app_root = app_storage_root();
    let log_path = backend_log_path();
    let db_path = database_path();
    let models_path = app_root.join("models");

    let items = vec![
        diagnostic_item("app_data", "App data folder", Some(&app_root), || {
            check_writable_directory(&app_root)
        }),
        diagnostic_item("database", "Database", Some(&db_path), || {
            let connection = open_database()?;
            connection
                .query_row("SELECT 1", [], |_| Ok(()))
                .map_err(|error| format!("SQLite database is not reachable: {error}"))?;
            Ok("SQLite database is reachable".to_string())
        }),
        diagnostic_item("logs", "Backend log", Some(&log_path), || {
            if let Some(parent) = log_path.parent() {
                check_writable_directory(parent)
            } else {
                Err("Backend log path has no parent folder".to_string())
            }
        }),
        diagnostic_item("models", "Model cache", Some(&models_path), || {
            check_writable_directory(&models_path)
        }),
        diagnostic_item(
            "recent_errors",
            "Recent backend errors",
            Some(&log_path),
            || match recent_backend_error_summary(&log_path, 500)? {
                Some(summary) => Err(format!("Recent backend log entry needs review: {summary}")),
                None => Ok("No actionable backend errors in the current log".to_string()),
            },
        ),
        diagnostic_item("clap", "CLAP runtime", None, || {
            Ok("Optional CLAP runtime is checked from Analysis when used".to_string())
        }),
    ];

    Ok(DesktopStartupDiagnosticsResponse {
        ok: items.iter().all(|item| item.ok),
        generated_at: utc_now_rfc3339(),
        items,
        log_path: log_path.to_string_lossy().to_string(),
        app_data_path: app_root.to_string_lossy().to_string(),
    })
}

pub(crate) fn backend_log_tail(limit: usize) -> DesktopLogTailResponse {
    let limit = limit.clamp(1, 2_000);
    let path = backend_log_path();
    if !path.exists() {
        return DesktopLogTailResponse {
            path: path.to_string_lossy().to_string(),
            exists: false,
            lines: Vec::new(),
        };
    }

    let lines = match fs::read_to_string(&path) {
        Ok(text) => text
            .lines()
            .map(redact_log_line)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .take(limit)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect(),
        Err(error) => vec![format!("Could not read log: {error}")],
    };
    DesktopLogTailResponse {
        path: path.to_string_lossy().to_string(),
        exists: true,
        lines,
    }
}

pub(crate) fn backup_database() -> Result<DesktopBackupResponse, String> {
    let source = database_path();
    if !source.exists() {
        return Err("Database does not exist yet".to_string());
    }
    let export_dir = export_dir();
    fs::create_dir_all(&export_dir).map_err(|error| {
        format!(
            "Could not create export folder {}: {error}",
            export_dir.display()
        )
    })?;
    let target = export_dir.join(format!("flac-cafe-backup-{}.sqlite", timestamp_for_file()));
    fs::copy(&source, &target).map_err(|error| {
        format!(
            "Could not back up database from {} to {}: {error}",
            source.display(),
            target.display()
        )
    })?;
    Ok(DesktopBackupResponse {
        backup_path: target.to_string_lossy().to_string(),
    })
}

pub(crate) fn reset_local_data(
    confirmation: Option<String>,
) -> Result<DesktopLocalDataResetResponse, String> {
    if confirmation
        .as_deref()
        .unwrap_or_default()
        .trim()
        .to_uppercase()
        != "RESET"
    {
        return Err("Type RESET to confirm local data reset.".to_string());
    }

    let source = database_path();
    let mut backup_path = None;
    let mut removed_paths = Vec::new();
    if source.exists() {
        let export_dir = export_dir();
        fs::create_dir_all(&export_dir).map_err(|error| {
            format!(
                "Could not create export folder {}: {error}",
                export_dir.display()
            )
        })?;
        let target = export_dir.join(format!(
            "flac-cafe-reset-backup-{}.sqlite",
            timestamp_for_file()
        ));
        fs::copy(&source, &target)
            .map_err(|error| format!("Could not back up database before reset: {error}"))?;
        backup_path = Some(target.to_string_lossy().to_string());
    }

    let sidecars = [
        source.clone(),
        PathBuf::from(format!("{}-wal", source.to_string_lossy())),
        PathBuf::from(format!("{}-shm", source.to_string_lossy())),
    ];
    for path in sidecars {
        if !path.exists() {
            continue;
        }
        match fs::remove_file(&path) {
            Ok(()) => removed_paths.push(path.to_string_lossy().to_string()),
            Err(_) => {
                reset_database_in_place(&source)?;
                removed_paths.push(format!("{} (cleared in place)", source.display()));
                break;
            }
        }
    }

    let mut folders_to_remove = vec![source
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("lyrics")];
    let app_root = app_storage_root();
    if path_is_inside(&source, &app_root) {
        folders_to_remove.push(app_root.join("cache"));
    }
    for folder in folders_to_remove {
        if folder.exists() {
            if fs::remove_dir_all(&folder).is_ok() {
                removed_paths.push(folder.to_string_lossy().to_string());
            }
        }
    }

    let _ = open_database()?;
    Ok(DesktopLocalDataResetResponse {
        reset: true,
        backup_path,
        database_path: source.to_string_lossy().to_string(),
        removed_paths,
        message:
            "Local FLAC Cafe data was reset. Music files, exports, tools, models, and logs were left in place."
                .to_string(),
    })
}

pub(crate) fn create_support_bundle() -> Result<DesktopSupportBundleResponse, String> {
    let export_dir = export_dir();
    fs::create_dir_all(&export_dir).map_err(|error| {
        format!(
            "Could not create export folder {}: {error}",
            export_dir.display()
        )
    })?;
    let bundle_path = export_dir.join(format!("flac-cafe-support-{}.zip", timestamp_for_file()));
    let file = fs::File::create(&bundle_path).map_err(|error| {
        format!(
            "Could not create support bundle {}: {error}",
            bundle_path.display()
        )
    })?;
    let mut archive = zip::ZipWriter::new(file);
    let mut file_count = 0usize;

    add_json(
        &mut archive,
        "diagnostics.json",
        &serde_json::to_value(startup_diagnostics()?)
            .map_err(|error| format!("Could not encode diagnostics: {error}"))?,
        &mut file_count,
    )?;
    add_json(
        &mut archive,
        "settings.redacted.json",
        &redacted_settings()?,
        &mut file_count,
    )?;
    add_json(
        &mut archive,
        "database-summary.redacted.json",
        &database_summary()?,
        &mut file_count,
    )?;
    add_json(
        &mut archive,
        "scan-errors.sample.redacted.json",
        &scan_error_samples()?,
        &mut file_count,
    )?;
    add_json(&mut archive, "app-info.json", &app_info()?, &mut file_count)?;

    let log_dir = backend_log_path()
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| app_storage_root().join("logs"));
    if let Ok(entries) = fs::read_dir(log_dir) {
        let mut logs = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.is_file()
                    && path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .map(|name| name.starts_with("backend.log"))
                        .unwrap_or(false)
            })
            .collect::<Vec<_>>();
        logs.sort();
        for path in logs {
            if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
                add_redacted_text_file(
                    &mut archive,
                    &path,
                    &format!("logs/{name}"),
                    &mut file_count,
                )?;
            }
        }
    }

    archive
        .finish()
        .map_err(|error| format!("Could not finish support bundle: {error}"))?;
    Ok(DesktopSupportBundleResponse {
        bundle_path: bundle_path.to_string_lossy().to_string(),
        file_count,
    })
}

fn backend_log_path() -> PathBuf {
    app_storage_root().join("logs").join("backend.log")
}

fn export_dir() -> PathBuf {
    app_storage_root().join("exports")
}

fn utc_now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .replace_microsecond(0)
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
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

fn diagnostic_item<F>(
    key: &str,
    label: &str,
    path: Option<&Path>,
    check: F,
) -> DesktopDiagnosticItem
where
    F: FnOnce() -> Result<String, String>,
{
    match check() {
        Ok(message) => DesktopDiagnosticItem {
            key: key.to_string(),
            label: label.to_string(),
            ok: true,
            message,
            path: path.map(|path| path.to_string_lossy().to_string()),
        },
        Err(message) => DesktopDiagnosticItem {
            key: key.to_string(),
            label: label.to_string(),
            ok: false,
            message,
            path: path.map(|path| path.to_string_lossy().to_string()),
        },
    }
}

fn check_writable_directory(path: &Path) -> Result<String, String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
    let test_path = path.join(".flac-cafe-write-test.tmp");
    fs::write(&test_path, "ok")
        .map_err(|error| format!("Could not write {}: {error}", test_path.display()))?;
    let _ = fs::remove_file(&test_path);
    Ok("Writable".to_string())
}

fn recent_backend_error_summary(path: &Path, limit: usize) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let text =
        fs::read_to_string(path).map_err(|error| format!("Could not read backend log: {error}"))?;
    let lines = text.lines().map(str::to_string).collect::<Vec<_>>();
    let start = lines.len().saturating_sub(limit);
    let mut interesting = Vec::new();
    for record in log_records(&lines[start..]) {
        if benign_backend_log_record(&record) {
            continue;
        }
        if record.contains("Traceback")
            || record.contains(" CRITICAL ")
            || record.contains(" ERROR ")
            || record.contains("Exception")
        {
            interesting.push(backend_log_record_summary(&record));
        }
    }
    Ok(interesting
        .last()
        .map(|summary| truncate_chars(&redact_log_line(summary), 500)))
}

fn log_records(lines: &[String]) -> Vec<String> {
    let mut records: Vec<Vec<String>> = Vec::new();
    let mut current: Vec<String> = Vec::new();
    for line in lines {
        if looks_like_log_record_start(line) && !current.is_empty() {
            records.push(std::mem::take(&mut current));
        }
        current.push(line.clone());
    }
    if !current.is_empty() {
        records.push(current);
    }
    records
        .into_iter()
        .map(|record| record.join("\n"))
        .collect::<Vec<_>>()
}

fn looks_like_log_record_start(line: &str) -> bool {
    let bytes = line.as_bytes();
    if bytes.len() < 24 {
        return false;
    }
    matches!(
        (
            bytes.get(4),
            bytes.get(7),
            bytes.get(10),
            bytes.get(13),
            bytes.get(16),
            bytes.get(19)
        ),
        (
            Some(b'-'),
            Some(b'-'),
            Some(b' '),
            Some(b':'),
            Some(b':'),
            Some(b',')
        )
    ) && bytes[0..4].iter().all(u8::is_ascii_digit)
}

fn benign_backend_log_record(record: &str) -> bool {
    record.contains("_ProactorBasePipeTransport._call_connection_lost")
        && record.contains("ConnectionResetError: [WinError 10054]")
}

fn backend_log_record_summary(record: &str) -> String {
    let lines = record
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    if lines.is_empty() {
        return "Unknown backend log entry".to_string();
    }
    let headline = lines
        .iter()
        .find(|line| {
            line.contains(" CRITICAL ")
                || line.contains(" ERROR ")
                || line.contains("Traceback")
                || line.contains("Exception")
        })
        .copied()
        .unwrap_or(lines[0]);
    let tail = lines.last().copied().unwrap_or(headline);
    let summary = if tail == headline {
        headline.to_string()
    } else {
        format!("{headline} ({tail})")
    };
    truncate_chars(&summary, 500)
}

fn redact_log_line(line: &str) -> String {
    let mut output = line.to_string();
    for marker in [
        "api_key",
        "api secret",
        "api_secret",
        "session_key",
        "password",
        "secret",
        "token",
    ] {
        output = redact_marker_value(&output, marker);
    }
    let app_root = app_storage_root().to_string_lossy().to_string();
    if !app_root.is_empty() {
        output = output.replace(&app_root, "[app-data]");
    }
    output
}

fn redact_marker_value(input: &str, marker: &str) -> String {
    let lower = input.to_lowercase();
    let mut output = input.to_string();
    let mut search_start = 0usize;
    while let Some(relative) = lower[search_start..].find(marker) {
        let start = search_start + relative + marker.len();
        let Some(separator_offset) = input[start..].find(['=', ':']) else {
            search_start = start;
            continue;
        };
        let value_start = start + separator_offset + 1;
        let value_start = value_start
            + input[value_start..]
                .chars()
                .take_while(|ch| ch.is_whitespace() || *ch == '"' || *ch == '\'')
                .map(char::len_utf8)
                .sum::<usize>();
        let value_end = value_start
            + input[value_start..]
                .chars()
                .take_while(|ch| {
                    !ch.is_whitespace() && *ch != ',' && *ch != ';' && *ch != '"' && *ch != '\''
                })
                .map(char::len_utf8)
                .sum::<usize>();
        if value_end > value_start {
            output.replace_range(value_start..value_end, "[redacted]");
        }
        search_start = value_end;
    }
    output
}

fn reset_database_in_place(path: &Path) -> Result<(), String> {
    let connection = Connection::open(path)
        .map_err(|error| format!("Could not open database for in-place reset: {error}"))?;
    let table_names = {
        let mut statement = connection
            .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            )
            .map_err(|error| format!("Could not list database tables: {error}"))?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Could not read database tables: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Could not read database table name: {error}"))?
    };
    connection
        .execute("PRAGMA foreign_keys = OFF", [])
        .map_err(|error| format!("Could not disable foreign keys during reset: {error}"))?;
    for table_name in table_names {
        let escaped = table_name.replace('"', "\"\"");
        connection
            .execute(&format!("DELETE FROM \"{escaped}\""), [])
            .map_err(|error| format!("Could not clear table {table_name}: {error}"))?;
    }
    connection
        .execute("PRAGMA foreign_keys = ON", [])
        .map_err(|error| format!("Could not restore foreign keys after reset: {error}"))?;
    connection
        .execute("VACUUM", [])
        .map_err(|error| format!("Could not vacuum reset database: {error}"))?;
    Ok(())
}

fn redacted_settings() -> Result<JsonValue, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare("SELECT key, value FROM settings ORDER BY key")
        .map_err(|error| format!("Could not read settings: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            let key: String = row.get(0)?;
            let value: Option<String> = row.get(1)?;
            Ok(json!({
                "key": key,
                "value": redact_setting_value(&key, value),
            }))
        })
        .map_err(|error| format!("Could not query settings: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not collect settings: {error}"))?;
    Ok(JsonValue::Array(rows))
}

fn redact_setting_value(key: &str, value: Option<String>) -> JsonValue {
    let lower = key.to_lowercase();
    if lower.contains("key") || lower.contains("secret") || lower.contains("token") {
        json!("[redacted secret]")
    } else if lower.contains("path") || lower.contains("dir") {
        json!("[redacted path]")
    } else {
        value.map(JsonValue::String).unwrap_or(JsonValue::Null)
    }
}

fn database_summary() -> Result<JsonValue, String> {
    let connection = open_database()?;
    let library_counts = query_one_json(
        &connection,
        "
        SELECT
            count(*) AS tracks,
            count(DISTINCT album_id) AS albums,
            count(DISTINCT lower(coalesce(artist, ''))) AS artists
        FROM tracks
        ",
        &["tracks", "albums", "artists"],
    )?;
    let ratings = query_rows_json(
        &connection,
        "
        SELECT coalesce(CAST(rating AS TEXT), 'unrated') AS bucket, count(*) AS tracks
        FROM tracks
        GROUP BY bucket
        ORDER BY bucket
        ",
        &["bucket", "tracks"],
    )?;
    let analysis = query_rows_json(
        &connection,
        "
        SELECT coalesce(analysis_provider, 'none') AS provider,
               count(*) AS tracks
        FROM tracks
        GROUP BY provider
        ORDER BY tracks DESC
        ",
        &["provider", "tracks"],
    )?;
    let formats = extension_counts(&connection)?;
    Ok(json!({
        "counts": library_counts,
        "ratings": ratings,
        "formats": formats,
        "analysis": analysis,
    }))
}

fn scan_error_samples() -> Result<JsonValue, String> {
    let connection = open_database()?;
    Ok(JsonValue::Array(query_rows_json(
        &connection,
        "
        SELECT path_hash, folder_hash, extension, message, created_at
        FROM scan_error_samples
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 25
        ",
        &[
            "path_hash",
            "folder_hash",
            "extension",
            "message",
            "created_at",
        ],
    )?))
}

fn app_info() -> Result<JsonValue, String> {
    Ok(json!({
        "generated_at": utc_now_rfc3339(),
        "app_data_path": app_storage_root().to_string_lossy().to_string(),
        "database_path": database_path().to_string_lossy().to_string(),
        "library_counts": database_summary()?.get("counts").cloned().unwrap_or_else(|| json!({})),
        "media_types": MEDIA_TYPES.iter().copied().collect::<BTreeMap<_, _>>(),
    }))
}

fn query_one_json(
    connection: &Connection,
    sql: &str,
    columns: &[&str],
) -> Result<JsonValue, String> {
    let mut rows = query_rows_json(connection, sql, columns)?;
    Ok(rows.pop().unwrap_or_else(|| json!({})))
}

fn query_rows_json(
    connection: &Connection,
    sql: &str,
    columns: &[&str],
) -> Result<Vec<JsonValue>, String> {
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("Could not prepare support-bundle query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            let mut object = serde_json::Map::new();
            for column in columns {
                let value: rusqlite::types::Value = row.get(*column)?;
                object.insert((*column).to_string(), sqlite_value_to_json(value));
            }
            Ok(JsonValue::Object(object))
        })
        .map_err(|error| format!("Could not run support-bundle query: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not collect support-bundle rows: {error}"))?;
    Ok(rows)
}

fn sqlite_value_to_json(value: rusqlite::types::Value) -> JsonValue {
    match value {
        rusqlite::types::Value::Null => JsonValue::Null,
        rusqlite::types::Value::Integer(value) => json!(value),
        rusqlite::types::Value::Real(value) => json!(value),
        rusqlite::types::Value::Text(value) => JsonValue::String(value),
        rusqlite::types::Value::Blob(_) => JsonValue::String("[blob]".to_string()),
    }
}

fn extension_counts(connection: &Connection) -> Result<Vec<JsonValue>, String> {
    let mut statement = connection
        .prepare("SELECT path FROM tracks")
        .map_err(|error| format!("Could not read track formats: {error}"))?;
    let mut counts: BTreeMap<String, i64> = BTreeMap::new();
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("Could not query track formats: {error}"))?;
    for row in rows {
        let path = row.map_err(|error| format!("Could not read track path: {error}"))?;
        let extension = Path::new(&path)
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| format!(".{}", value.to_lowercase()))
            .unwrap_or_else(|| "(none)".to_string());
        *counts.entry(extension).or_insert(0) += 1;
    }
    let mut values = counts
        .into_iter()
        .map(|(extension, tracks)| json!({ "extension": extension, "tracks": tracks }))
        .collect::<Vec<_>>();
    values.sort_by(|left, right| {
        let left_tracks = left.get("tracks").and_then(JsonValue::as_i64).unwrap_or(0);
        let right_tracks = right.get("tracks").and_then(JsonValue::as_i64).unwrap_or(0);
        right_tracks.cmp(&left_tracks).then_with(|| {
            left.get("extension")
                .and_then(JsonValue::as_str)
                .unwrap_or("")
                .cmp(
                    right
                        .get("extension")
                        .and_then(JsonValue::as_str)
                        .unwrap_or(""),
                )
        })
    });
    Ok(values)
}

fn add_json(
    archive: &mut zip::ZipWriter<fs::File>,
    name: &str,
    value: &JsonValue,
    file_count: &mut usize,
) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Could not encode {name}: {error}"))?;
    archive
        .start_file(name, zip_options())
        .map_err(|error| format!("Could not add {name} to support bundle: {error}"))?;
    archive
        .write_all(text.as_bytes())
        .map_err(|error| format!("Could not write {name} to support bundle: {error}"))?;
    *file_count += 1;
    Ok(())
}

fn add_redacted_text_file(
    archive: &mut zip::ZipWriter<fs::File>,
    path: &Path,
    name: &str,
    file_count: &mut usize,
) -> Result<(), String> {
    let mut text = String::new();
    fs::File::open(path)
        .and_then(|mut file| file.read_to_string(&mut text))
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    let redacted = text
        .lines()
        .map(redact_log_line)
        .collect::<Vec<_>>()
        .join("\n");
    archive
        .start_file(name, zip_options())
        .map_err(|error| format!("Could not add {name} to support bundle: {error}"))?;
    archive
        .write_all(redacted.as_bytes())
        .map_err(|error| format!("Could not write {name} to support bundle: {error}"))?;
    *file_count += 1;
    Ok(())
}

fn zip_options() -> FileOptions {
    FileOptions::default().compression_method(zip::CompressionMethod::Deflated)
}

fn path_is_inside(path: &Path, parent: &Path) -> bool {
    let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let parent = parent
        .canonicalize()
        .unwrap_or_else(|_| parent.to_path_buf());
    path.starts_with(parent)
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    value.chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_secret_marker_values() {
        let line = "Sending api_key=abc123 token:xyz path C:\\Users\\blake\\AppData";
        let redacted = redact_log_line(line);
        assert!(!redacted.contains("abc123"));
        assert!(!redacted.contains("xyz"));
        assert!(redacted.contains("[redacted]"));
    }

    #[test]
    fn groups_multiline_log_records() {
        let lines = vec![
            "2026-01-01 00:00:00,000 INFO one".to_string(),
            "continued".to_string(),
            "2026-01-01 00:00:01,000 ERROR two".to_string(),
        ];
        let records = log_records(&lines);
        assert_eq!(records.len(), 2);
        assert!(records[0].contains("continued"));
    }
}
