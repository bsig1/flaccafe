use super::open_database;
use super::types::*;
use rusqlite::{params, Connection, OptionalExtension};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const SERVICES: &[&str] = &["listenbrainz", "lastfm"];

fn account_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeScrobbleAccount> {
    Ok(NativeScrobbleAccount {
        service: row.get::<_, Option<String>>("service")?.unwrap_or_default(),
        enabled: row.get::<_, Option<i64>>("enabled")?.unwrap_or(0) != 0,
        username: row.get("username")?,
        token: row.get("token")?,
        api_key: row.get("api_key")?,
        api_secret: row.get("api_secret")?,
        session_key: row.get("session_key")?,
        updated_at: row.get("updated_at")?,
    })
}

fn outbox_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeScrobbleOutboxEntry> {
    Ok(NativeScrobbleOutboxEntry {
        id: row.get("id")?,
        service: row.get::<_, Option<String>>("service")?.unwrap_or_default(),
        track_id: row.get("track_id")?,
        event_type: row
            .get::<_, Option<String>>("event_type")?
            .unwrap_or_else(|| "played".to_string()),
        artist: row.get::<_, Option<String>>("artist")?.unwrap_or_default(),
        title: row.get::<_, Option<String>>("title")?.unwrap_or_default(),
        album: row.get("album")?,
        album_artist: row.get("album_artist")?,
        listened_at: row.get("listened_at")?,
        status: row
            .get::<_, Option<String>>("status")?
            .unwrap_or_else(|| "pending".to_string()),
        attempts: row.get::<_, Option<i64>>("attempts")?.unwrap_or(0),
        last_error: row.get("last_error")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        submitted_at: row.get("submitted_at")?,
    })
}

fn fallback_account(service: &str) -> NativeScrobbleAccount {
    NativeScrobbleAccount {
        service: service.to_string(),
        enabled: false,
        username: None,
        token: None,
        api_key: None,
        api_secret: None,
        session_key: None,
        updated_at: None,
    }
}

fn account_by_service(
    connection: &Connection,
    service: &str,
) -> Result<NativeScrobbleAccount, String> {
    connection
        .query_row(
            "SELECT * FROM scrobble_accounts WHERE service = ?",
            params![service],
            account_from_row,
        )
        .optional()
        .map_err(|error| format!("Could not read native scrobble account: {error}"))
        .map(|account| account.unwrap_or_else(|| fallback_account(service)))
}

#[tauri::command]
pub fn native_scrobble_accounts(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativeScrobbleAccount>, String> {
    let connection = open_database()?;
    SERVICES
        .iter()
        .map(|service| account_by_service(&connection, service))
        .collect()
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn native_save_scrobble_account(
    _state: State<'_, NativeLibraryState>,
    service: String,
    enabled: Option<bool>,
    username: Option<String>,
    username_set: Option<bool>,
    token: Option<String>,
    token_set: Option<bool>,
    api_key: Option<String>,
    api_key_set: Option<bool>,
    api_secret: Option<String>,
    api_secret_set: Option<bool>,
    session_key: Option<String>,
    session_key_set: Option<bool>,
) -> Result<NativeScrobbleAccount, String> {
    let service = service.trim().to_ascii_lowercase();
    if !SERVICES.contains(&service.as_str()) {
        return Err("Scrobble service not found".to_string());
    }
    let connection = open_database()?;
    let existing = account_by_service(&connection, &service)?;
    connection
        .execute(
            r#"
            INSERT INTO scrobble_accounts(service, enabled, username, token, api_key, api_secret, session_key, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(service) DO UPDATE SET
              enabled = excluded.enabled,
              username = excluded.username,
              token = excluded.token,
              api_key = excluded.api_key,
              api_secret = excluded.api_secret,
              session_key = excluded.session_key,
              updated_at = datetime('now')
            "#,
            params![
                service,
                if enabled.unwrap_or(existing.enabled) { 1 } else { 0 },
                if username_set.unwrap_or(false) { username } else { existing.username },
                if token_set.unwrap_or(false) { token } else { existing.token },
                if api_key_set.unwrap_or(false) { api_key } else { existing.api_key },
                if api_secret_set.unwrap_or(false) { api_secret } else { existing.api_secret },
                if session_key_set.unwrap_or(false) { session_key } else { existing.session_key },
            ],
        )
        .map_err(|error| format!("Could not save native scrobble account: {error}"))?;
    account_by_service(&connection, &service)
}

#[tauri::command]
pub fn native_scrobble_outbox(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<NativeScrobbleOutboxEntry>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(100).clamp(1, 1000);
    let mut statement = connection
        .prepare(
            r#"
            SELECT *
            FROM scrobble_outbox
            ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END,
                     created_at DESC
            LIMIT ?
            "#,
        )
        .map_err(|error| format!("Could not prepare native scrobble outbox query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], outbox_from_row)
        .map_err(|error| format!("Could not read native scrobble outbox: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native scrobble outbox: {error}"))
}

fn fallback_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn native_queue_scrobble_history(
    _state: State<'_, NativeLibraryState>,
    service: String,
    limit: Option<usize>,
) -> Result<NativeScrobbleQueueHistoryResponse, String> {
    let service = service.trim().to_ascii_lowercase();
    if !SERVICES.contains(&service.as_str()) {
        return Err("Scrobble service not found".to_string());
    }
    let limit = limit.unwrap_or(100).clamp(1, 10_000);
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native scrobble queue update: {error}"))?;
    let rows = {
        let mut statement = transaction
            .prepare(
                r#"
                SELECT play_events.id AS event_id,
                       CAST(strftime('%s', play_events.timestamp) AS INTEGER) AS listened_at,
                       tracks.id AS track_id,
                       tracks.title,
                       tracks.artist,
                       tracks.album,
                       tracks.album_artist
                FROM play_events
                JOIN tracks ON tracks.id = play_events.track_id
                WHERE play_events.event_type = 'played'
                  AND coalesce(tracks.artist, '') != ''
                  AND coalesce(tracks.title, '') != ''
                ORDER BY play_events.timestamp DESC
                LIMIT ?
                "#,
            )
            .map_err(|error| format!("Could not prepare native scrobble history query: {error}"))?;
        let rows = statement
            .query_map(params![limit as i64], |row| {
                Ok((
                    row.get::<_, i64>("track_id")?,
                    row.get::<_, Option<String>>("artist")?.unwrap_or_default(),
                    row.get::<_, Option<String>>("title")?.unwrap_or_default(),
                    row.get::<_, Option<String>>("album")?,
                    row.get::<_, Option<String>>("album_artist")?,
                    row.get::<_, Option<i64>>("listened_at")?,
                ))
            })
            .map_err(|error| format!("Could not read native scrobble history: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native scrobble history: {error}"))?
    };
    let mut queued = 0i64;
    for (track_id, artist, title, album, album_artist, listened_at) in &rows {
        let listened_at = listened_at.unwrap_or_else(fallback_unix_timestamp);
        let inserted = transaction
            .execute(
                r#"
                INSERT INTO scrobble_outbox(
                  service, track_id, event_type, artist, title, album, album_artist, listened_at
                )
                SELECT ?, ?, 'played', ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM scrobble_outbox
                  WHERE service = ? AND track_id = ? AND event_type = 'played' AND listened_at = ?
                )
                "#,
                params![
                    service,
                    track_id,
                    artist,
                    title,
                    album,
                    album_artist,
                    listened_at,
                    service,
                    track_id,
                    listened_at
                ],
            )
            .map_err(|error| format!("Could not queue native scrobble history: {error}"))?;
        queued += inserted as i64;
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save native scrobble history queue: {error}"))?;
    Ok(NativeScrobbleQueueHistoryResponse {
        queued,
        considered: rows.len() as i64,
    })
}
