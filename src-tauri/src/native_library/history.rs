use super::{open_database, qualified_track_columns, track_from_row, NativeLibraryState};
use super::{NativeHistoryStatsResponse, NativeHistoryTrackStat, NativePlayEventEntry};
use rusqlite::{params, Connection};
use serde_json::json;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub fn native_history(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<NativePlayEventEntry>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    let track_columns = qualified_track_columns("tracks");
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT
                play_events.id AS event_id,
                play_events.track_id AS event_track_id,
                play_events.event_type,
                play_events.timestamp,
                play_events.metadata_json,
                {track_columns}
            FROM play_events
            LEFT JOIN tracks ON tracks.id = play_events.track_id
            ORDER BY datetime(play_events.timestamp) DESC, play_events.id DESC
            LIMIT ?
            "#
        ))
        .map_err(|error| format!("Could not prepare Rust history query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], |row| {
            let track_id: Option<i64> = row.get("id")?;
            let metadata_text = row
                .get::<_, Option<String>>("metadata_json")?
                .unwrap_or_else(|| "{}".to_string());
            let metadata = serde_json::from_str(&metadata_text).unwrap_or_else(|_| json!({}));
            Ok(NativePlayEventEntry {
                id: row.get("event_id")?,
                track_id: row.get("event_track_id")?,
                event_type: row
                    .get::<_, Option<String>>("event_type")?
                    .unwrap_or_default(),
                timestamp: row
                    .get::<_, Option<String>>("timestamp")?
                    .unwrap_or_default(),
                metadata,
                track: if track_id.is_some() {
                    Some(track_from_row(row)?)
                } else {
                    None
                },
            })
        })
        .map_err(|error| format!("Could not read Rust history: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust history: {error}"))
}

fn history_track_stat_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<NativeHistoryTrackStat> {
    Ok(NativeHistoryTrackStat {
        track: track_from_row(row)?,
        play_count: row.get::<_, Option<i64>>("play_count")?.unwrap_or(0),
        skip_count: row.get::<_, Option<i64>>("skip_count")?.unwrap_or(0),
        listened_seconds: row
            .get::<_, Option<f64>>("listened_seconds")?
            .unwrap_or(0.0),
    })
}

#[tauri::command]
pub fn native_history_stats(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<NativeHistoryStatsResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(10).clamp(1, 50);
    let totals = connection
        .query_row(
            r#"
            SELECT
                coalesce(sum(play_count), 0) AS total_play_count,
                coalesce(sum(skip_count), 0) AS total_skip_count,
                coalesce(sum(coalesce(duration_seconds, 0) * coalesce(play_count, 0)), 0) AS total_listened_seconds,
                sum(CASE WHEN play_count > 0 THEN 1 ELSE 0 END) AS unique_played_tracks,
                sum(CASE WHEN skip_count > 0 THEN 1 ELSE 0 END) AS unique_skipped_tracks
            FROM tracks
            "#,
            [],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>("total_play_count")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("total_skip_count")?.unwrap_or(0),
                    row.get::<_, Option<f64>>("total_listened_seconds")?
                        .unwrap_or(0.0),
                    row.get::<_, Option<i64>>("unique_played_tracks")?
                        .unwrap_or(0),
                    row.get::<_, Option<i64>>("unique_skipped_tracks")?
                        .unwrap_or(0),
                ))
            },
        )
        .map_err(|error| format!("Could not read Rust history totals: {error}"))?;
    let mut event_counts: HashMap<String, i64> = HashMap::new();
    let mut event_statement = connection
        .prepare("SELECT event_type, count(*) AS count FROM play_events GROUP BY event_type")
        .map_err(|error| format!("Could not prepare Rust history event totals: {error}"))?;
    let event_rows = event_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, Option<String>>("event_type")?
                    .unwrap_or_default(),
                row.get::<_, Option<i64>>("count")?.unwrap_or(0),
            ))
        })
        .map_err(|error| format!("Could not read Rust history event totals: {error}"))?;
    for row in event_rows {
        let (event_type, count) =
            row.map_err(|error| format!("Could not decode Rust history event totals: {error}"))?;
        event_counts.insert(event_type, count);
    }

    let top_played = read_history_track_stats(
        &connection,
        r#"
        WHERE play_count > 0
        ORDER BY play_count DESC,
                 listened_seconds DESC,
                 lower(coalesce(artist, '')) ASC,
                 lower(coalesce(title, '')) ASC
        LIMIT ?
        "#,
        limit,
    )?;
    let top_skipped = read_history_track_stats(
        &connection,
        r#"
        WHERE skip_count > 0
        ORDER BY skip_count DESC,
                 play_count DESC,
                 lower(coalesce(artist, '')) ASC,
                 lower(coalesce(title, '')) ASC
        LIMIT ?
        "#,
        limit,
    )?;

    Ok(NativeHistoryStatsResponse {
        total_play_count: totals.0,
        total_skip_count: totals.1,
        total_play_events: *event_counts.get("played").unwrap_or(&0),
        total_skip_events: *event_counts.get("skipped").unwrap_or(&0),
        total_rated_events: *event_counts.get("rated").unwrap_or(&0),
        unique_played_tracks: totals.3,
        unique_skipped_tracks: totals.4,
        total_listened_seconds: totals.2,
        top_played,
        top_skipped,
    })
}

fn read_history_track_stats(
    connection: &Connection,
    clause: &str,
    limit: usize,
) -> Result<Vec<NativeHistoryTrackStat>, String> {
    let track_columns = super::TRACK_COLUMNS;
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns},
                   coalesce(duration_seconds, 0) * coalesce(play_count, 0) AS listened_seconds
            FROM tracks
            {clause}
            "#
        ))
        .map_err(|error| format!("Could not prepare Rust history stats query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], history_track_stat_from_row)
        .map_err(|error| format!("Could not read Rust history stats: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust history stats: {error}"))
}
