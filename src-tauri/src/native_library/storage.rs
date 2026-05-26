use rusqlite::{params, Connection};
use std::env;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub(crate) fn repo_root() -> Option<PathBuf> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
}

pub(crate) fn local_app_data(app_name: &str) -> Option<PathBuf> {
    env::var_os("LOCALAPPDATA").map(|root| PathBuf::from(root).join(app_name))
}

pub(crate) fn app_storage_root() -> PathBuf {
    if let Ok(configured) =
        env::var("FLAC_CAFE_DATA_DIR").or_else(|_| env::var("LOCAL_AUTODJ_DATA_DIR"))
    {
        return PathBuf::from(configured);
    }
    #[cfg(debug_assertions)]
    {
        if let Some(root) = repo_root() {
            return root.join("backend");
        }
    }
    match (local_app_data("FLAC Cafe"), local_app_data("Local AutoDJ")) {
        (Some(current), Some(legacy)) if legacy.exists() && !current.exists() => legacy,
        (Some(current), _) => current,
        _ => PathBuf::from("backend"),
    }
}

pub(crate) fn database_path() -> PathBuf {
    if let Ok(configured) = env::var("MUSIC_REC_DB") {
        return PathBuf::from(configured);
    }

    #[cfg(debug_assertions)]
    {
        if let Some(root) = repo_root() {
            return root.join("backend").join("data").join("music.sqlite3");
        }
    }

    let current = local_app_data("FLAC Cafe");
    let legacy = local_app_data("Local AutoDJ");
    match (current, legacy) {
        (Some(current), Some(legacy)) if legacy.exists() && !current.exists() => {
            legacy.join("data").join("music.sqlite3")
        }
        (Some(current), _) => current.join("data").join("music.sqlite3"),
        _ => PathBuf::from("backend").join("data").join("music.sqlite3"),
    }
}

pub(crate) fn open_database() -> Result<Connection, String> {
    let path = database_path();
    let connection = Connection::open(&path).map_err(|error| {
        format!(
            "Could not open library database at {}: {error}",
            path.display()
        )
    })?;
    connection
        .busy_timeout(Duration::from_secs(3))
        .map_err(|error| format!("Could not configure SQLite busy timeout: {error}"))?;
    Ok(connection)
}

pub(crate) fn get_setting(connection: &Connection, key: &str) -> Option<String> {
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?",
            params![key],
            |row| row.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten()
}

pub(crate) fn set_setting(
    connection: &Connection,
    key: &str,
    value: Option<&str>,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value],
        )
        .map_err(|error| format!("Could not save setting {key}: {error}"))?;
    Ok(())
}

pub(crate) fn truthy_setting(connection: &Connection, key: &str, default_value: bool) -> bool {
    match get_setting(connection, key).as_deref().map(str::trim) {
        Some("1") | Some("true") | Some("True") | Some("yes") | Some("on") => true,
        Some("0") | Some("false") | Some("False") | Some("no") | Some("off") => false,
        _ => default_value,
    }
}

pub(crate) fn suggested_music_path() -> Option<String> {
    env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|path| path.join("Music").to_string_lossy().to_string())
}
