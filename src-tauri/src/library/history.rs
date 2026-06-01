use super::{
    music_only_clause, open_database, qualified_track_columns, track_from_row, DesktopLibraryState,
};
use super::{
    DesktopHistoryAlbumCompletionStat, DesktopHistoryDensityStat, DesktopHistoryPeriodStat,
    DesktopHistoryRatingStat, DesktopHistoryStatsResponse, DesktopHistoryTrackStat,
    DesktopLibraryTimelineStat,
    DesktopPlayEventEntry,
};
use rusqlite::{params, Connection};
use serde_json::json;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub fn history(
    _state: State<'_, DesktopLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<DesktopPlayEventEntry>, String> {
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
            Ok(DesktopPlayEventEntry {
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
) -> rusqlite::Result<DesktopHistoryTrackStat> {
    Ok(DesktopHistoryTrackStat {
        track: track_from_row(row)?,
        play_count: row.get::<_, Option<i64>>("play_count")?.unwrap_or(0),
        skip_count: row.get::<_, Option<i64>>("skip_count")?.unwrap_or(0),
        listened_seconds: row
            .get::<_, Option<f64>>("listened_seconds")?
            .unwrap_or(0.0),
    })
}

#[tauri::command]
pub fn history_stats(
    _state: State<'_, DesktopLibraryState>,
    limit: Option<usize>,
) -> Result<DesktopHistoryStatsResponse, String> {
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
    let album_completion = read_album_completion_stats(&connection)?;

    Ok(DesktopHistoryStatsResponse {
        total_play_count: totals.0,
        total_skip_count: totals.1,
        total_play_events: *event_counts.get("played").unwrap_or(&0),
        total_skip_events: *event_counts.get("skipped").unwrap_or(&0),
        total_rated_events: *event_counts.get("rated").unwrap_or(&0),
        unique_played_tracks: totals.3,
        unique_skipped_tracks: totals.4,
        total_listened_seconds: totals.2,
        albums_completed: album_completion.0,
        albums_tracked: album_completion.1,
        album_completion_percent: album_completion.2,
        completed_albums: read_album_completion_rows(&connection, true, limit.max(12))?,
        next_albums: read_album_completion_rows(&connection, false, limit.max(12))?,
        top_played,
        top_skipped,
        rating_distribution: read_rating_distribution(&connection)?,
        events_by_day: read_history_period_stats(&connection, "%Y-%m-%d", 60)?,
        events_by_week: read_history_period_stats(&connection, "%Y-W%W", 52)?,
        events_by_month: read_history_period_stats(&connection, "%Y-%m", 36)?,
        listening_density: read_listening_density(&connection)?,
        library_added_by_day: read_library_timeline_stats(&connection, "%Y-%m-%d", 60)?,
        library_added_by_week: read_library_timeline_stats(&connection, "%Y-W%W", 52)?,
        library_added_by_month: read_library_timeline_stats(&connection, "%Y-%m", 36)?,
    })
}

fn read_album_completion_stats(connection: &Connection) -> Result<(i64, i64, f64), String> {
    let (completed, tracked) = connection
        .query_row(
            &format!(
                r#"
                WITH album_groups AS (
                    SELECT
                        lower(trim(coalesce(album, ''))) AS album_key,
                        lower(trim(coalesce(album_artist, artist, ''))) AS artist_key,
                        count(*) AS track_count,
                        sum(CASE WHEN coalesce(play_count, 0) > 0 THEN 1 ELSE 0 END) AS played_track_count
                    FROM tracks
                    WHERE trim(coalesce(album, '')) <> ''
                      AND {music_filter}
                    GROUP BY album_key, artist_key
                )
                SELECT
                    sum(CASE WHEN played_track_count >= track_count AND track_count > 0 THEN 1 ELSE 0 END) AS completed,
                    count(*) AS tracked
                FROM album_groups
                "#,
                music_filter = music_only_clause()
            ),
            [],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>("completed")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("tracked")?.unwrap_or(0),
                ))
            },
        )
        .map_err(|error| format!("Could not read Rust album completion stats: {error}"))?;
    let percent = if tracked > 0 {
        completed as f64 / tracked as f64 * 100.0
    } else {
        0.0
    };
    Ok((completed, tracked, percent))
}

fn history_album_completion_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<DesktopHistoryAlbumCompletionStat> {
    let next_track_id: Option<i64> = row.get("id")?;
    Ok(DesktopHistoryAlbumCompletionStat {
        album: row
            .get::<_, Option<String>>("completion_album")?
            .unwrap_or_else(|| "Unknown album".to_string()),
        album_artist: row.get("completion_album_artist")?,
        track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
        played_track_count: row
            .get::<_, Option<i64>>("played_track_count")?
            .unwrap_or(0),
        unplayed_track_count: row
            .get::<_, Option<i64>>("unplayed_track_count")?
            .unwrap_or(0),
        completion_percent: row
            .get::<_, Option<f64>>("completion_percent")?
            .unwrap_or(0.0),
        duration_seconds: row
            .get::<_, Option<f64>>("duration_seconds")?
            .unwrap_or(0.0),
        last_played_at: row.get("completion_last_played_at")?,
        next_track: if next_track_id.is_some() {
            Some(track_from_row(row)?)
        } else {
            None
        },
    })
}

fn read_album_completion_rows(
    connection: &Connection,
    completed: bool,
    limit: usize,
) -> Result<Vec<DesktopHistoryAlbumCompletionStat>, String> {
    let track_columns = qualified_track_columns("next_track");
    let state_filter = if completed {
        "played_track_count >= track_count"
    } else {
        "played_track_count < track_count"
    };
    let order_clause = if completed {
        "datetime(completion_last_played_at) DESC, lower(coalesce(completion_album_artist, '')) ASC, lower(completion_album) ASC"
    } else {
        "unplayed_track_count ASC, completion_percent DESC, played_track_count DESC, track_count DESC, lower(coalesce(completion_album_artist, '')) ASC, lower(completion_album) ASC"
    };
    let mut statement = connection
        .prepare(&format!(
            r#"
            WITH album_groups AS (
                SELECT
                    lower(trim(coalesce(album, ''))) AS album_key,
                    lower(trim(coalesce(nullif(album_artist, ''), nullif(artist, ''), ''))) AS artist_key,
                    min(nullif(trim(album), '')) AS completion_album,
                    min(nullif(trim(coalesce(album_artist, artist)), '')) AS completion_album_artist,
                    count(*) AS track_count,
                    sum(CASE WHEN coalesce(play_count, 0) > 0 THEN 1 ELSE 0 END) AS played_track_count,
                    count(*) - sum(CASE WHEN coalesce(play_count, 0) > 0 THEN 1 ELSE 0 END) AS unplayed_track_count,
                    (sum(CASE WHEN coalesce(play_count, 0) > 0 THEN 1 ELSE 0 END) * 100.0) / count(*) AS completion_percent,
                    coalesce(sum(duration_seconds), 0) AS duration_seconds,
                    max(last_played_at) AS completion_last_played_at
                FROM tracks
                WHERE trim(coalesce(album, '')) <> ''
                  AND {music_filter}
                GROUP BY album_key, artist_key
            )
            SELECT
                album_groups.completion_album,
                album_groups.completion_album_artist,
                album_groups.track_count,
                album_groups.played_track_count,
                album_groups.unplayed_track_count,
                album_groups.completion_percent,
                album_groups.duration_seconds,
                album_groups.completion_last_played_at,
                {track_columns}
            FROM album_groups
            LEFT JOIN tracks AS next_track ON next_track.id = (
                SELECT id
                FROM tracks
                WHERE lower(trim(coalesce(tracks.album, ''))) = album_groups.album_key
                  AND lower(trim(coalesce(nullif(tracks.album_artist, ''), nullif(tracks.artist, ''), ''))) = album_groups.artist_key
                  AND coalesce(tracks.play_count, 0) = 0
                  AND {music_filter}
                ORDER BY coalesce(disc_number, 0) ASC,
                         coalesce(track_number, 0) ASC,
                         lower(coalesce(title, '')) ASC,
                         id ASC
                LIMIT 1
            )
            WHERE {state_filter}
            ORDER BY {order_clause}
            LIMIT ?
            "#,
            music_filter = music_only_clause(),
        ))
        .map_err(|error| format!("Could not prepare Rust album completion rows: {error}"))?;
    let rows = statement
        .query_map(params![limit.min(50) as i64], history_album_completion_from_row)
        .map_err(|error| format!("Could not read Rust album completion rows: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust album completion rows: {error}"))
}

fn read_rating_distribution(
    connection: &Connection,
) -> Result<Vec<DesktopHistoryRatingStat>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT rating, count(*) AS count
            FROM tracks
            WHERE rating IS NOT NULL
            GROUP BY rating
            ORDER BY rating DESC
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust rating stats query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(DesktopHistoryRatingStat {
                rating: row.get::<_, Option<f64>>("rating")?.unwrap_or(0.0),
                count: row.get::<_, Option<i64>>("count")?.unwrap_or(0),
            })
        })
        .map_err(|error| format!("Could not read Rust rating stats: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust rating stats: {error}"))
}

fn read_history_period_stats(
    connection: &Connection,
    period_format: &str,
    limit: usize,
) -> Result<Vec<DesktopHistoryPeriodStat>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT strftime(?1, play_events.timestamp) AS period,
                   sum(CASE WHEN play_events.event_type = 'played' THEN 1 ELSE 0 END) AS plays,
                   sum(CASE WHEN play_events.event_type = 'skipped' THEN 1 ELSE 0 END) AS skips,
                   sum(CASE WHEN play_events.event_type = 'rated' THEN 1 ELSE 0 END) AS ratings,
                   sum(CASE
                         WHEN play_events.event_type = 'played'
                         THEN coalesce(tracks.duration_seconds, 0)
                         ELSE 0
                       END) AS listened_seconds
            FROM play_events
            LEFT JOIN tracks ON tracks.id = play_events.track_id
            GROUP BY period
            ORDER BY period DESC
            LIMIT ?2
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust history period query: {error}"))?;
    let rows = statement
        .query_map(params![period_format, limit as i64], |row| {
            Ok(DesktopHistoryPeriodStat {
                period: row
                    .get::<_, Option<String>>("period")?
                    .unwrap_or_else(|| "unknown".to_string()),
                plays: row.get::<_, Option<i64>>("plays")?.unwrap_or(0),
                skips: row.get::<_, Option<i64>>("skips")?.unwrap_or(0),
                ratings: row.get::<_, Option<i64>>("ratings")?.unwrap_or(0),
                listened_seconds: row
                    .get::<_, Option<f64>>("listened_seconds")?
                    .unwrap_or(0.0),
            })
        })
        .map_err(|error| format!("Could not read Rust history period stats: {error}"))?;
    let mut rows = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust history period stats: {error}"))?;
    rows.reverse();
    Ok(rows)
}

fn read_listening_density(
    connection: &Connection,
) -> Result<Vec<DesktopHistoryDensityStat>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT CAST(strftime('%w', timestamp) AS INTEGER) AS weekday,
                   CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
                   count(*) AS plays
            FROM play_events
            WHERE event_type = 'played'
            GROUP BY weekday, hour
            ORDER BY weekday ASC, hour ASC
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust listening density query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(DesktopHistoryDensityStat {
                weekday: row.get::<_, Option<i64>>("weekday")?.unwrap_or(0),
                hour: row.get::<_, Option<i64>>("hour")?.unwrap_or(0),
                plays: row.get::<_, Option<i64>>("plays")?.unwrap_or(0),
            })
        })
        .map_err(|error| format!("Could not read Rust listening density: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust listening density: {error}"))
}

fn read_library_timeline_stats(
    connection: &Connection,
    period_format: &str,
    limit: usize,
) -> Result<Vec<DesktopLibraryTimelineStat>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT strftime(?1, date_added) AS period,
                   count(*) AS tracks,
                   coalesce(sum(duration_seconds), 0) AS duration_seconds
            FROM tracks
            GROUP BY period
            ORDER BY period DESC
            LIMIT ?2
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust library timeline query: {error}"))?;
    let rows = statement
        .query_map(params![period_format, limit as i64], |row| {
            Ok(DesktopLibraryTimelineStat {
                period: row
                    .get::<_, Option<String>>("period")?
                    .unwrap_or_else(|| "unknown".to_string()),
                tracks: row.get::<_, Option<i64>>("tracks")?.unwrap_or(0),
                duration_seconds: row
                    .get::<_, Option<f64>>("duration_seconds")?
                    .unwrap_or(0.0),
            })
        })
        .map_err(|error| format!("Could not read Rust library timeline: {error}"))?;
    let mut rows = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust library timeline: {error}"))?;
    rows.reverse();
    Ok(rows)
}

fn read_history_track_stats(
    connection: &Connection,
    clause: &str,
    limit: usize,
) -> Result<Vec<DesktopHistoryTrackStat>, String> {
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
