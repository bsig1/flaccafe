use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection};
use serde_json::json;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::env;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

pub(crate) mod album_artwork;
pub(crate) mod analysis;
pub(crate) mod audio_conversion;
pub(crate) mod extensions;
pub(crate) mod folder_watch;
pub(crate) mod history;
pub(crate) mod inbox;
pub(crate) mod library_tools;
pub(crate) mod lyrics;
pub(crate) mod maintenance;
pub(crate) mod media_protocol;
pub(crate) mod metadata_csv;
pub(crate) mod podcasts;
pub(crate) mod recommendation_profiles;
pub(crate) mod recommendations;
pub(crate) mod reports;
pub(crate) mod scan;
mod schema;
pub(crate) mod scrobbling;
mod search;
mod storage;
pub(crate) mod tools;
mod types;

use self::recommendations::{
    cosine_similarity, native_autodj_settings, normalize_token, round4, similarity_adjustment,
};
use self::search::{
    csv_ints, fuzzy_sql_parts, music_only_clause, sort_expression, track_where_clause,
};
pub(super) use self::storage::{
    app_storage_root, database_path, get_setting, local_app_data, open_database, repo_root,
    set_setting, suggested_music_path, truthy_setting,
};
pub use self::types::*;

pub(crate) fn ensure_database_ready() -> Result<(), String> {
    let _connection = open_database()?;
    Ok(())
}

const TRACK_COLUMNS: &str = "
    id, path, title, artist, album, album_artist,
    track_number, disc_number, genre, analysis_provider, analysis_model,
    analysis_genre, analysis_genre_confidence, analysis_genre_tags,
    analysis_embedding, analysis_updated_at, year, duration_seconds, bitrate,
    replaygain_track_gain_db, replaygain_album_gain_db, replaygain_track_peak,
    replaygain_album_peak, audio_fingerprint, acoustic_fingerprint,
    acoustic_fingerprint_updated_at, rating, play_count, skip_count,
    last_played_at, last_skipped_at, date_added, file_modified_at
";

fn qualified_track_columns(alias: &str) -> String {
    TRACK_COLUMNS
        .split(',')
        .map(str::trim)
        .filter(|column| !column.is_empty())
        .map(|column| format!("{alias}.{column} AS {column}"))
        .collect::<Vec<_>>()
        .join(", ")
}

pub(super) fn track_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeTrack> {
    Ok(NativeTrack {
        id: row.get("id")?,
        path: row.get("path")?,
        title: row.get("title")?,
        artist: row.get("artist")?,
        album: row.get("album")?,
        album_artist: row.get("album_artist")?,
        track_number: row.get("track_number")?,
        disc_number: row.get("disc_number")?,
        genre: row.get("genre")?,
        analysis_provider: row.get("analysis_provider")?,
        analysis_model: row.get("analysis_model")?,
        analysis_genre: row.get("analysis_genre")?,
        analysis_genre_confidence: row.get("analysis_genre_confidence")?,
        analysis_genre_tags: row.get("analysis_genre_tags")?,
        analysis_embedding: row.get("analysis_embedding")?,
        analysis_updated_at: row.get("analysis_updated_at")?,
        year: row.get("year")?,
        duration_seconds: row.get("duration_seconds")?,
        bitrate: row.get("bitrate")?,
        replaygain_track_gain_db: row.get("replaygain_track_gain_db")?,
        replaygain_album_gain_db: row.get("replaygain_album_gain_db")?,
        replaygain_track_peak: row.get("replaygain_track_peak")?,
        replaygain_album_peak: row.get("replaygain_album_peak")?,
        audio_fingerprint: row.get("audio_fingerprint")?,
        acoustic_fingerprint: row.get("acoustic_fingerprint")?,
        acoustic_fingerprint_updated_at: row.get("acoustic_fingerprint_updated_at")?,
        rating: row.get("rating")?,
        play_count: row.get::<_, Option<i64>>("play_count")?.unwrap_or(0),
        skip_count: row.get::<_, Option<i64>>("skip_count")?.unwrap_or(0),
        last_played_at: row.get("last_played_at")?,
        last_skipped_at: row.get("last_skipped_at")?,
        date_added: row
            .get::<_, Option<String>>("date_added")?
            .unwrap_or_else(|| "".to_string()),
        file_modified_at: row.get("file_modified_at")?,
    })
}

fn radio_station_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeRadioStation> {
    Ok(NativeRadioStation {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        stream_url: row
            .get::<_, Option<String>>("stream_url")?
            .unwrap_or_default(),
        homepage_url: row.get("homepage_url")?,
        genre: row.get("genre")?,
        notes: row.get("notes")?,
        last_played_at: row.get("last_played_at")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn audiobook_bookmark_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<NativeAudiobookBookmark> {
    Ok(NativeAudiobookBookmark {
        id: row.get("id")?,
        track_id: row.get("track_id")?,
        position_seconds: row
            .get::<_, Option<f64>>("position_seconds")?
            .unwrap_or(0.0),
        label: row.get::<_, Option<String>>("label")?.unwrap_or_default(),
        note: row.get("note")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
    })
}

fn audiobook_chapter_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeAudiobookChapter> {
    Ok(NativeAudiobookChapter {
        id: row.get("id")?,
        track_id: row.get("track_id")?,
        chapter_index: row.get::<_, Option<i64>>("chapter_index")?.unwrap_or(1),
        title: row
            .get::<_, Option<String>>("title")?
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "Chapter".to_string()),
        start_seconds: row.get::<_, Option<f64>>("start_seconds")?.unwrap_or(0.0),
        end_seconds: row.get("end_seconds")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn progress_percent(position_seconds: f64, duration_seconds: Option<f64>) -> f64 {
    let Some(duration_seconds) = duration_seconds else {
        return 0.0;
    };
    if position_seconds <= 0.0 || duration_seconds <= 0.0 {
        0.0
    } else {
        ((position_seconds / duration_seconds) * 100.0).clamp(0.0, 100.0)
    }
}

fn audiobook_where_clause() -> &'static str {
    "
    (
      lower(coalesce(tracks.genre, '')) LIKE '%audiobook%'
      OR lower(coalesce(tracks.genre, '')) LIKE '%audio book%'
      OR lower(tracks.path) LIKE '%audiobook%'
      OR lower(tracks.path) LIKE '%audio book%'
      OR lower(tracks.path) LIKE '%\\books\\%'
      OR lower(tracks.path) LIKE '%/books/%'
    )
    "
}

fn clean_required_text(value: String, label: &str) -> Result<String, String> {
    let cleaned = value.trim().to_string();
    if cleaned.is_empty() {
        Err(format!("{label} is required"))
    } else {
        Ok(cleaned)
    }
}

fn clean_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

#[tauri::command]
pub fn native_tracks_page(
    _state: State<'_, NativeLibraryState>,
    search: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    sort_by: Option<String>,
    sort_direction: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    genre: Option<String>,
    path: Option<String>,
    extension: Option<String>,
    rating_state: Option<String>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    year_from: Option<i64>,
    year_to: Option<i64>,
    min_duration: Option<f64>,
    max_duration: Option<f64>,
    missing_metadata: Option<bool>,
) -> Result<NativeTrackPage, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(150).clamp(1, 100_000);
    let offset = offset.unwrap_or(0);
    let search = search.unwrap_or_default();
    let (where_clause, mut params) = track_where_clause(
        &search,
        artist.as_deref(),
        album.as_deref(),
        genre.as_deref(),
        path.as_deref(),
        extension.as_deref(),
        rating_state.as_deref(),
        min_rating,
        max_rating,
        year_from,
        year_to,
        min_duration,
        max_duration,
        missing_metadata,
    );
    let direction = if sort_direction
        .unwrap_or_default()
        .eq_ignore_ascii_case("desc")
    {
        "DESC"
    } else {
        "ASC"
    };
    let order_clause = format!(
        "ORDER BY {} {direction}, lower(coalesce(artist, '')) ASC, lower(coalesce(album, '')) ASC, disc_number ASC, track_number ASC, lower(coalesce(title, '')) ASC, id ASC",
        sort_expression(sort_by.as_deref().unwrap_or("artist"))
    );

    let total: i64 = connection
        .query_row(
            &format!("SELECT count(*) FROM tracks {where_clause}"),
            params_from_iter(params.clone()),
            |row| row.get(0),
        )
        .map_err(|error| format!("Could not count native tracks: {error}"))?;

    params.push(Value::Integer(limit as i64));
    params.push(Value::Integer(offset as i64));
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks {where_clause} {order_clause} LIMIT ? OFFSET ?"
        ))
        .map_err(|error| format!("Could not prepare native track query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(params), track_from_row)
        .map_err(|error| format!("Could not read native track page: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native track page: {error}"))?;
    Ok(NativeTrackPage {
        tracks,
        total,
        limit,
        offset,
        source: "rust-sqlite".to_string(),
    })
}

#[tauri::command]
pub fn native_clap_coverage(
    _state: State<'_, NativeLibraryState>,
) -> Result<NativeAudioAnalysisCoverage, String> {
    let connection = open_database()?;
    let row = connection
        .query_row(
            &format!(
                r#"
                SELECT
                    count(*) AS total_tracks,
                    sum(
                        CASE
                            WHEN analysis_provider = 'clap'
                             AND analysis_embedding IS NOT NULL
                             AND trim(analysis_embedding) <> ''
                            THEN 1 ELSE 0
                        END
                    ) AS analyzed_tracks,
                    sum(CASE WHEN analysis_provider = 'clap_failed' THEN 1 ELSE 0 END) AS failed_tracks
                FROM tracks
                WHERE {music_filter}
                "#,
                music_filter = music_only_clause()
            ),
            [],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>("total_tracks")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("analyzed_tracks")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("failed_tracks")?.unwrap_or(0),
                ))
            },
        )
        .map_err(|error| format!("Could not read native CLAP coverage: {error}"))?;
    let (total_tracks, analyzed_tracks, failed_tracks) = row;
    let coverage_percent = if total_tracks > 0 {
        ((analyzed_tracks as f64 / total_tracks as f64) * 10_000.0).round() / 100.0
    } else {
        0.0
    };
    Ok(NativeAudioAnalysisCoverage {
        total_tracks,
        analyzed_tracks,
        unanalyzed_tracks: (total_tracks - analyzed_tracks).max(0),
        failed_tracks,
        coverage_percent,
        provider: "clap".to_string(),
    })
}

#[tauri::command]
pub fn native_albums(
    _state: State<'_, NativeLibraryState>,
    search: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<NativeAlbumSummary>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(20_000).clamp(1, 20_000);
    let offset = offset.unwrap_or(0);
    let album_key = "lower(trim(coalesce(albums.album, '')))";
    let artist_key = "lower(trim(coalesce(albums.album_artist, '')))";
    let search_expression =
        "coalesce(albums.album, '') || ' ' || coalesce(albums.album_artist, '') || ' ' || coalesce(albums.year, '')";
    let (mut where_parts, mut query_params) =
        fuzzy_sql_parts(search_expression, search.as_deref().unwrap_or_default());
    where_parts.insert(0, music_only_clause().to_string());
    let where_clause = format!("WHERE {}", where_parts.join(" AND "));
    query_params.push(Value::Integer(limit as i64));
    query_params.push(Value::Integer(offset as i64));

    let mut statement = connection
        .prepare(&format!(
            r#"
            WITH album_completion AS (
                SELECT album_key, artist_key, sum(max_track_number) AS expected_track_count
                FROM (
                    SELECT
                        {album_key} AS album_key,
                        {artist_key} AS artist_key,
                        coalesce(tracks.disc_number, 1) AS disc_key,
                        max(tracks.track_number) AS max_track_number
                    FROM tracks
                    JOIN albums ON albums.id = tracks.album_id
                    WHERE tracks.track_number IS NOT NULL
                      AND tracks.track_number > 0
                      AND {music_filter}
                    GROUP BY album_key, artist_key, coalesce(tracks.disc_number, 1)
                ) AS disc_max
                GROUP BY album_key, artist_key
            ),
            raw_groups AS (
                SELECT
                    min(albums.id) AS id,
                    min(albums.album) AS album,
                    min(albums.album_artist) AS album_artist,
                    min(albums.year) AS year,
                    group_concat(DISTINCT albums.year) AS years_csv,
                    group_concat(DISTINCT albums.id) AS album_ids_csv,
                    count(DISTINCT albums.id) AS edition_count,
                    max(albums.artwork_path) AS artwork_path,
                    count(tracks.id) AS track_count,
                    sum(tracks.duration_seconds) AS duration_seconds,
                    avg(tracks.rating) AS average_rating,
                    min(tracks.id) AS artwork_track_id,
                    max(albums.completion_expected_track_count) AS completion_expected_track_count,
                    max(albums.completion_source) AS completion_source,
                    max(albums.completion_release_id) AS completion_release_id,
                    max(albums.completion_release_title) AS completion_release_title,
                    max(albums.completion_checked_at) AS completion_checked_at,
                    coalesce(album_completion.expected_track_count, 0) AS inferred_expected_track_count
                FROM albums
                JOIN tracks ON tracks.album_id = albums.id
                LEFT JOIN album_completion
                  ON album_completion.album_key = {album_key}
                 AND album_completion.artist_key = {artist_key}
                {where_clause}
                GROUP BY
                    {album_key},
                    {artist_key},
                    album_completion.expected_track_count
            )
            SELECT
                id,
                album,
                album_artist,
                year,
                years_csv,
                album_ids_csv,
                edition_count,
                artwork_path,
                track_count,
                CASE
                  WHEN completion_expected_track_count IS NOT NULL
                  THEN max(track_count, completion_expected_track_count)
                  ELSE max(track_count, coalesce(inferred_expected_track_count, 0))
                END AS expected_track_count,
                max(
                  0,
                  (
                    CASE
                      WHEN completion_expected_track_count IS NOT NULL
                      THEN max(track_count, completion_expected_track_count)
                      ELSE max(track_count, coalesce(inferred_expected_track_count, 0))
                    END
                  ) - track_count
                ) AS missing_track_count,
                duration_seconds,
                average_rating,
                artwork_track_id,
                completion_expected_track_count,
                completion_source,
                completion_release_id,
                completion_release_title,
                completion_checked_at
            FROM raw_groups
            ORDER BY lower(coalesce(album_artist, '')) ASC,
                     coalesce(year, 9999) ASC,
                     lower(coalesce(album, '')) ASC
            LIMIT ? OFFSET ?
            "#,
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare native albums query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(query_params), |row| {
            let years = csv_ints(row.get("years_csv")?);
            let album_ids = csv_ints(row.get("album_ids_csv")?);
            let year = years.first().copied().or(row.get("year")?);
            Ok(NativeAlbumSummary {
                id: row.get("id")?,
                album: row.get("album")?,
                album_artist: row.get("album_artist")?,
                year,
                years,
                edition_count: if album_ids.is_empty() {
                    row.get::<_, Option<i64>>("edition_count")?.unwrap_or(1)
                } else {
                    album_ids.len() as i64
                },
                album_ids,
                artwork_path: row.get("artwork_path")?,
                track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
                expected_track_count: row.get("expected_track_count")?,
                missing_track_count: row
                    .get::<_, Option<i64>>("missing_track_count")?
                    .unwrap_or(0),
                duration_seconds: row.get("duration_seconds")?,
                average_rating: row.get("average_rating")?,
                artwork_track_id: row.get("artwork_track_id")?,
                completion_expected_track_count: row.get("completion_expected_track_count")?,
                completion_source: row.get("completion_source")?,
                completion_release_id: row.get("completion_release_id")?,
                completion_release_title: row.get("completion_release_title")?,
                completion_checked_at: row.get("completion_checked_at")?,
            })
        })
        .map_err(|error| format!("Could not read native albums: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native albums: {error}"))
}

fn primary_artist_expression(alias: &str) -> String {
    let artist = format!("coalesce({alias}.artist, '')");
    format!(
        "trim(CASE WHEN instr({artist}, ';') > 0 THEN substr({artist}, 1, instr({artist}, ';') - 1) WHEN instr({artist}, '|') > 0 THEN substr({artist}, 1, instr({artist}, '|') - 1) ELSE {artist} END)"
    )
}

#[tauri::command]
pub fn native_artists(
    _state: State<'_, NativeLibraryState>,
    search: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<NativeArtistSummary>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(20_000).clamp(1, 20_000);
    let offset = offset.unwrap_or(0);
    let artist_expr = primary_artist_expression("tracks");
    let search_expression = "artist_name || ' ' || coalesce(first_album, '') || ' ' || coalesce(first_genre, '') || ' ' || coalesce(first_year, '') || ' ' || coalesce(last_year, '')";
    let (search_clauses, mut query_params) =
        fuzzy_sql_parts(search_expression, search.as_deref().unwrap_or_default());
    let mut where_parts = vec!["artist_name <> ''".to_string()];
    where_parts.extend(search_clauses);
    let where_clause = format!("WHERE {}", where_parts.join(" AND "));
    query_params.push(Value::Integer(limit as i64));
    query_params.push(Value::Integer(offset as i64));

    let mut statement = connection
        .prepare(&format!(
            r#"
            WITH artist_tracks AS (
                SELECT
                    {artist_expr} AS artist_name,
                    tracks.*
                FROM tracks
                WHERE {music_filter}
            ),
            grouped AS (
                SELECT
                    artist_name,
                    min(album) AS first_album,
                    min(coalesce(analysis_genre, genre)) AS first_genre,
                    count(id) AS track_count,
                    count(DISTINCT nullif(lower(trim(coalesce(album, ''))), '')) AS album_count,
                    sum(duration_seconds) AS duration_seconds,
                    avg(rating) AS average_rating,
                    sum(play_count) AS play_count,
                    sum(skip_count) AS skip_count,
                    min(year) AS first_year,
                    max(year) AS last_year,
                    min(id) AS artwork_track_id
                FROM artist_tracks
                GROUP BY lower(artist_name)
            )
            SELECT
                artist_name AS name,
                track_count,
                album_count,
                duration_seconds,
                average_rating,
                play_count,
                skip_count,
                first_year,
                last_year,
                artwork_track_id
            FROM grouped
            {where_clause}
            ORDER BY lower(artist_name) ASC
            LIMIT ? OFFSET ?
            "#,
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare native artists query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(query_params), |row| {
            Ok(NativeArtistSummary {
                name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
                track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
                album_count: row.get::<_, Option<i64>>("album_count")?.unwrap_or(0),
                duration_seconds: row.get("duration_seconds")?,
                average_rating: row.get("average_rating")?,
                play_count: row.get::<_, Option<i64>>("play_count")?.unwrap_or(0),
                skip_count: row.get::<_, Option<i64>>("skip_count")?.unwrap_or(0),
                first_year: row.get("first_year")?,
                last_year: row.get("last_year")?,
                artwork_track_id: row.get("artwork_track_id")?,
            })
        })
        .map_err(|error| format!("Could not read native artists: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native artists: {error}"))
}

#[tauri::command]
pub fn native_playlists(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativePlaylistSummary>, String> {
    let connection = open_database()?;
    native_playlists_for_connection(&connection)
}

fn native_playlists_for_connection(
    connection: &Connection,
) -> Result<Vec<NativePlaylistSummary>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT
                playlists.id,
                playlists.name,
                count(playlist_tracks.track_id) AS track_count,
                sum(tracks.duration_seconds) AS duration_seconds,
                playlists.created_at,
                playlists.updated_at
            FROM playlists
            LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
            LEFT JOIN tracks ON tracks.id = playlist_tracks.track_id
            GROUP BY playlists.id
            ORDER BY lower(playlists.name) ASC
            "#,
        )
        .map_err(|error| format!("Could not prepare native playlists query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(NativePlaylistSummary {
                id: row.get("id")?,
                name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
                track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
                duration_seconds: row.get("duration_seconds")?,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Could not read native playlists: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native playlists: {error}"))
}

fn playlist_summary_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativePlaylistSummary> {
    Ok(NativePlaylistSummary {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
        duration_seconds: row.get("duration_seconds")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn native_playlist_summary_by_id(
    connection: &Connection,
    playlist_id: i64,
) -> Result<NativePlaylistSummary, String> {
    connection
        .query_row(
            r#"
            SELECT
                playlists.id,
                playlists.name,
                count(playlist_tracks.track_id) AS track_count,
                sum(tracks.duration_seconds) AS duration_seconds,
                playlists.created_at,
                playlists.updated_at
            FROM playlists
            LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
            LEFT JOIN tracks ON tracks.id = playlist_tracks.track_id
            WHERE playlists.id = ?
            GROUP BY playlists.id
            "#,
            params![playlist_id],
            playlist_summary_from_row,
        )
        .map_err(|error| format!("Could not read native playlist summary: {error}"))
}

#[tauri::command]
pub fn native_album_tracks(
    _state: State<'_, NativeLibraryState>,
    album_id: i64,
) -> Result<Vec<NativeTrack>, String> {
    let connection = open_database()?;
    album_tracks_by_id(&connection, album_id)
}

#[tauri::command]
pub fn native_playlist_tracks(
    _state: State<'_, NativeLibraryState>,
    playlist_id: i64,
) -> Result<Vec<NativeTrack>, String> {
    let connection = open_database()?;
    native_playlist_tracks_for_connection(&connection, playlist_id)
}

fn native_playlist_tracks_for_connection(
    connection: &Connection,
    playlist_id: i64,
) -> Result<Vec<NativeTrack>, String> {
    let track_columns = qualified_track_columns("tracks");
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns}
            FROM playlist_tracks
            JOIN tracks ON tracks.id = playlist_tracks.track_id
            WHERE playlist_tracks.playlist_id = ?
            ORDER BY playlist_tracks.position ASC, playlist_tracks.id ASC
            "#
        ))
        .map_err(|error| format!("Could not prepare native playlist tracks query: {error}"))?;
    let rows = statement
        .query_map(params![playlist_id], track_from_row)
        .map_err(|error| format!("Could not read native playlist tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native playlist tracks: {error}"))
}

fn compact_native_playlist_positions(
    connection: &Connection,
    playlist_id: i64,
) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, id ASC",
        )
        .map_err(|error| format!("Could not prepare native playlist compact query: {error}"))?;
    let ids = statement
        .query_map(params![playlist_id], |row| row.get::<_, i64>(0))
        .map_err(|error| format!("Could not read native playlist positions: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native playlist positions: {error}"))?;
    for (index, id) in ids.into_iter().enumerate() {
        connection
            .execute(
                "UPDATE playlist_tracks SET position = ? WHERE id = ?",
                params![(index + 1) as i64, id],
            )
            .map_err(|error| format!("Could not compact native playlist positions: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn native_create_playlist(
    _state: State<'_, NativeLibraryState>,
    name: String,
) -> Result<NativePlaylistSummary, String> {
    let mut connection = open_database()?;
    let clean_name = name.trim().to_string();
    if clean_name.is_empty() {
        return Err("Playlist name is required".to_string());
    }
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native playlist create: {error}"))?;
    transaction
        .execute("INSERT INTO playlists(name) VALUES(?)", params![clean_name])
        .map_err(|error| format!("Could not create native playlist: {error}"))?;
    let playlist = transaction
        .query_row(
            "SELECT id, name, 0 AS track_count, NULL AS duration_seconds, created_at, updated_at
             FROM playlists
             WHERE name = ?",
            params![clean_name],
            playlist_summary_from_row,
        )
        .map_err(|error| format!("Could not read native playlist after create: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save native playlist create: {error}"))?;
    Ok(playlist)
}

#[tauri::command]
pub fn native_delete_playlist(
    _state: State<'_, NativeLibraryState>,
    playlist_id: i64,
) -> Result<Vec<NativePlaylistSummary>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native playlist delete: {error}"))?;
    let deleted = transaction
        .execute("DELETE FROM playlists WHERE id = ?", params![playlist_id])
        .map_err(|error| format!("Could not delete native playlist: {error}"))?;
    if deleted == 0 {
        return Err("Playlist not found".to_string());
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save native playlist delete: {error}"))?;
    native_playlists_for_connection(&connection)
}

#[tauri::command]
pub fn native_add_playlist_tracks(
    _state: State<'_, NativeLibraryState>,
    playlist_id: i64,
    track_ids: Vec<i64>,
) -> Result<Vec<NativeTrack>, String> {
    let mut connection = open_database()?;
    let unique_ids: Vec<i64> =
        track_ids
            .into_iter()
            .filter(|id| *id > 0)
            .fold(Vec::new(), |mut ids, id| {
                if !ids.contains(&id) {
                    ids.push(id);
                }
                ids
            });
    if unique_ids.is_empty() {
        return native_playlist_tracks_for_connection(&connection, playlist_id);
    }
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native playlist add: {error}"))?;
    let playlist_exists: Option<i64> = transaction
        .query_row(
            "SELECT id FROM playlists WHERE id = ?",
            params![playlist_id],
            |row| row.get(0),
        )
        .ok();
    if playlist_exists.is_none() {
        return Err("Playlist not found".to_string());
    }
    let placeholders = vec!["?"; unique_ids.len()].join(",");
    let existing: HashSet<i64> = transaction
        .prepare(&format!(
            "SELECT id FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare native playlist track check: {error}"))?
        .query_map(
            params_from_iter(unique_ids.iter().copied().map(Value::Integer)),
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not read native playlist track check: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native playlist track check: {error}"))?
        .into_iter()
        .collect();
    if let Some(missing_id) = unique_ids.iter().find(|id| !existing.contains(id)) {
        return Err(format!("Track not found: {missing_id}"));
    }
    let mut position = transaction
        .query_row(
            "SELECT coalesce(max(position), 0) FROM playlist_tracks WHERE playlist_id = ?",
            params![playlist_id],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);
    for track_id in unique_ids {
        position += 1;
        transaction
            .execute(
                "INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position) VALUES(?, ?, ?)",
                params![playlist_id, track_id, position],
            )
            .map_err(|error| format!("Could not add native playlist track: {error}"))?;
    }
    compact_native_playlist_positions(&transaction, playlist_id)?;
    transaction
        .execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
            params![playlist_id],
        )
        .map_err(|error| format!("Could not touch native playlist: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save native playlist tracks: {error}"))?;
    native_playlist_tracks_for_connection(&connection, playlist_id)
}

#[tauri::command]
pub fn native_remove_playlist_track(
    _state: State<'_, NativeLibraryState>,
    playlist_id: i64,
    track_id: i64,
) -> Result<Vec<NativeTrack>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native playlist remove: {error}"))?;
    let playlist_exists: Option<i64> = transaction
        .query_row(
            "SELECT id FROM playlists WHERE id = ?",
            params![playlist_id],
            |row| row.get(0),
        )
        .ok();
    if playlist_exists.is_none() {
        return Err("Playlist not found".to_string());
    }
    transaction
        .execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            params![playlist_id, track_id],
        )
        .map_err(|error| format!("Could not remove native playlist track: {error}"))?;
    compact_native_playlist_positions(&transaction, playlist_id)?;
    transaction
        .execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
            params![playlist_id],
        )
        .map_err(|error| format!("Could not touch native playlist: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save native playlist remove: {error}"))?;
    native_playlist_tracks_for_connection(&connection, playlist_id)
}

#[tauri::command]
pub fn native_move_playlist_track(
    _state: State<'_, NativeLibraryState>,
    playlist_id: i64,
    track_id: i64,
    direction: String,
) -> Result<Vec<NativeTrack>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native playlist move: {error}"))?;
    let row = transaction
        .query_row(
            "SELECT id, position FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            params![playlist_id, track_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .map_err(|error| format!("Playlist track not found: {error}"))?;
    let moving_up = direction == "up";
    let (operator, ordering) = if moving_up {
        ("<", "DESC")
    } else {
        (">", "ASC")
    };
    let swap = transaction
        .query_row(
            &format!(
                "SELECT id, position
                 FROM playlist_tracks
                 WHERE playlist_id = ? AND position {operator} ?
                 ORDER BY position {ordering}
                 LIMIT 1"
            ),
            params![playlist_id, row.1],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .ok();
    if let Some(swap) = swap {
        transaction
            .execute(
                "UPDATE playlist_tracks SET position = ? WHERE id = ?",
                params![swap.1, row.0],
            )
            .map_err(|error| format!("Could not move native playlist track: {error}"))?;
        transaction
            .execute(
                "UPDATE playlist_tracks SET position = ? WHERE id = ?",
                params![row.1, swap.0],
            )
            .map_err(|error| format!("Could not move native playlist swap: {error}"))?;
        transaction
            .execute(
                "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
                params![playlist_id],
            )
            .map_err(|error| format!("Could not touch native playlist: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save native playlist move: {error}"))?;
    native_playlist_tracks_for_connection(&connection, playlist_id)
}

#[tauri::command]
pub fn native_library_stats(
    _state: State<'_, NativeLibraryState>,
) -> Result<NativeLibraryStatsResponse, String> {
    let connection = open_database()?;
    let row = connection
        .query_row(
            r#"
            SELECT
                count(*) AS total_tracks,
                count(DISTINCT album_id) AS total_albums,
                count(DISTINCT lower(coalesce(artist, ''))) AS total_artists,
                sum(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) AS rated_tracks,
                sum(CASE WHEN rating IS NULL THEN 1 ELSE 0 END) AS unrated_tracks,
                sum(duration_seconds) AS total_duration_seconds
            FROM tracks
            "#,
            [],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>("total_tracks")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("total_albums")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("total_artists")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("rated_tracks")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("unrated_tracks")?.unwrap_or(0),
                    row.get::<_, Option<f64>>("total_duration_seconds")?,
                ))
            },
        )
        .map_err(|error| format!("Could not read native library stats: {error}"))?;
    let total_playlists = connection
        .query_row("SELECT count(*) AS count FROM playlists", [], |row| {
            row.get::<_, Option<i64>>("count")
        })
        .ok()
        .flatten()
        .unwrap_or(0);
    let played_events = connection
        .query_row(
            "SELECT count(*) AS count FROM play_events WHERE event_type = 'played'",
            [],
            |row| row.get::<_, Option<i64>>("count"),
        )
        .ok()
        .flatten()
        .unwrap_or(0);
    let skipped_events = connection
        .query_row(
            "SELECT count(*) AS count FROM play_events WHERE event_type = 'skipped'",
            [],
            |row| row.get::<_, Option<i64>>("count"),
        )
        .ok()
        .flatten()
        .unwrap_or(0);
    Ok(NativeLibraryStatsResponse {
        total_tracks: row.0,
        total_albums: row.1,
        total_artists: row.2,
        total_playlists,
        rated_tracks: row.3,
        unrated_tracks: row.4,
        total_duration_seconds: row.5,
        played_events,
        skipped_events,
    })
}

#[tauri::command]
pub fn native_clear_library_caches(
    _state: State<'_, NativeLibraryState>,
    targets: Vec<String>,
) -> Result<NativeCacheClearResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native cache clear: {error}"))?;
    let mut cleared = BTreeMap::new();
    for target in targets {
        let table = match target.as_str() {
            "artist" => "artist_info_cache",
            "artwork" => "artwork_cache",
            "metadata" => "track_metadata_cache",
            "recommendation_history" => "recommendation_runs",
            "scan_errors" => "scan_error_samples",
            _ => return Err(format!("Unsupported cache target: {target}")),
        };
        if cleared.contains_key(&target) {
            continue;
        }
        let count = transaction
            .execute(&format!("DELETE FROM {table}"), [])
            .map_err(|error| format!("Could not clear native cache target {target}: {error}"))?;
        cleared.insert(target, count as i64);
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save native cache clear: {error}"))?;
    Ok(NativeCacheClearResponse { cleared })
}

#[tauri::command]
pub fn native_bulk_undo_log(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<NativeBulkUndoLogEntry>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(30).clamp(1, 200);
    let mut statement = connection
        .prepare(
            "SELECT id, batch_id, action_type, summary, payload_json, created_at
             FROM bulk_action_undo_log
             ORDER BY datetime(created_at) DESC, id DESC
             LIMIT ?",
        )
        .map_err(|error| format!("Could not prepare native undo log query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], |row| {
            let payload_text = row
                .get::<_, Option<String>>("payload_json")?
                .unwrap_or_default();
            let payload = serde_json::from_str(&payload_text).unwrap_or_else(|_| json!({}));
            Ok(NativeBulkUndoLogEntry {
                id: row.get("id")?,
                batch_id: row.get("batch_id")?,
                action_type: row
                    .get::<_, Option<String>>("action_type")?
                    .unwrap_or_default(),
                summary: row.get::<_, Option<String>>("summary")?.unwrap_or_default(),
                payload,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Could not read native undo log: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native undo log: {error}"))
}

#[tauri::command]
pub fn native_bulk_undo_batches(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<NativeBulkUndoBatchEntry>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(30).clamp(1, 200);
    let mut statement = connection
        .prepare(
            "SELECT batch_id,
                    action_type,
                    count(*) AS entries,
                    min(created_at) AS first_created_at,
                    max(created_at) AS last_created_at,
                    min(summary) AS summary
             FROM bulk_action_undo_log
             WHERE batch_id IS NOT NULL AND trim(batch_id) <> ''
               AND action_type IN (
                 'csv_metadata_import', 'regex_metadata_replace', 'musicbrainz_auto_tag',
                 'file_organization', 'track_remove', 'advanced_tag_edit', 'tag_backup_restore',
                 'sqlite_file_tag_write'
               )
             GROUP BY batch_id, action_type
             ORDER BY datetime(max(created_at)) DESC, max(id) DESC
             LIMIT ?",
        )
        .map_err(|error| format!("Could not prepare native undo batch query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], |row| {
            Ok(NativeBulkUndoBatchEntry {
                batch_id: row
                    .get::<_, Option<String>>("batch_id")?
                    .unwrap_or_default(),
                action_type: row
                    .get::<_, Option<String>>("action_type")?
                    .unwrap_or_default(),
                entries: row.get::<_, Option<i64>>("entries")?.unwrap_or(0),
                summary: row.get::<_, Option<String>>("summary")?.unwrap_or_default(),
                first_created_at: row
                    .get::<_, Option<String>>("first_created_at")?
                    .unwrap_or_default(),
                last_created_at: row
                    .get::<_, Option<String>>("last_created_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Could not read native undo batches: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native undo batches: {error}"))
}

fn json_sql_value(value: Option<&serde_json::Value>) -> Value {
    match value {
        Some(serde_json::Value::Null) | None => Value::Null,
        Some(serde_json::Value::Bool(value)) => Value::Integer(if *value { 1 } else { 0 }),
        Some(serde_json::Value::Number(value)) => {
            if let Some(integer) = value.as_i64() {
                Value::Integer(integer)
            } else if let Some(float) = value.as_f64() {
                Value::Real(float)
            } else {
                Value::Null
            }
        }
        Some(serde_json::Value::String(value)) => {
            if value.trim().is_empty() {
                Value::Null
            } else {
                Value::Text(value.clone())
            }
        }
        Some(value) => Value::Text(value.to_string()),
    }
}

fn json_i64(value: Option<&serde_json::Value>) -> Option<i64> {
    value.and_then(|value| {
        value
            .as_i64()
            .or_else(|| value.as_f64().map(|number| number.round() as i64))
            .or_else(|| {
                value
                    .as_str()
                    .and_then(|text| text.trim().parse::<i64>().ok())
            })
    })
}

fn json_f64(value: Option<&serde_json::Value>) -> Option<f64> {
    value.and_then(|value| {
        value.as_f64().or_else(|| {
            value
                .as_str()
                .and_then(|text| text.trim().parse::<f64>().ok())
        })
    })
}

fn json_text(value: Option<&serde_json::Value>) -> Option<String> {
    value.and_then(|value| match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(text) => {
            Some(text.trim().to_string()).filter(|text| !text.is_empty())
        }
        _ => Some(value.to_string()),
    })
}

fn update_track_metadata_field(
    connection: &Connection,
    track_id: i64,
    field: &str,
    value: Option<&serde_json::Value>,
) -> Result<(), String> {
    match field {
        "title" | "artist" | "album" | "album_artist" | "genre" => {
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
                .execute(sql, params![json_text(value), track_id])
                .map_err(|error| format!("Could not restore metadata field {field}: {error}"))?;
        }
        "track_number" | "disc_number" | "year" => {
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
                .execute(sql, params![json_i64(value), track_id])
                .map_err(|error| format!("Could not restore metadata field {field}: {error}"))?;
        }
        "rating" => {
            let rating = json_f64(value).filter(|rating| (0.5..=5.0).contains(rating));
            connection
                .execute(
                    "UPDATE tracks SET rating = ?, updated_at = datetime('now') WHERE id = ?",
                    params![rating, track_id],
                )
                .map_err(|error| format!("Could not restore rating: {error}"))?;
        }
        _ => return Err(format!("Undo does not support metadata field {field}")),
    }
    Ok(())
}

fn update_track_custom_tag(
    connection: &Connection,
    track_id: i64,
    tag_key: &str,
    value: Option<&serde_json::Value>,
) -> Result<(), String> {
    let key = tag_key.trim();
    if key.is_empty() {
        return Err("Custom tag name is required".to_string());
    }
    connection
        .execute(
            "DELETE FROM track_custom_tags WHERE track_id = ? AND lower(tag_key) = lower(?)",
            params![track_id, key],
        )
        .map_err(|error| format!("Could not clear restored custom tag: {error}"))?;
    if let Some(value) = json_text(value) {
        connection
            .execute(
                "INSERT INTO track_custom_tags(track_id, tag_key, tag_value, updated_at) VALUES(?, ?, ?, datetime('now'))",
                params![track_id, key, value],
            )
            .map_err(|error| format!("Could not restore custom tag: {error}"))?;
    }
    Ok(())
}

fn restore_metadata_snapshot(
    connection: &Connection,
    track: &serde_json::Map<String, serde_json::Value>,
    fields: &[String],
) -> Result<Vec<i64>, Vec<String>> {
    let track_id = json_i64(track.get("id")).unwrap_or(0);
    if track_id <= 0 {
        return Err(vec!["Undo payload is missing track id".to_string()]);
    }
    let exists = connection
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .is_some();
    if !exists {
        return Err(vec![format!(
            "Track {track_id} is no longer in the library"
        )]);
    }
    let mut errors = Vec::new();
    for field in fields {
        if let Some(custom_key) = field.strip_prefix("custom:") {
            if let Some(custom_tags) = track
                .get("custom_tags")
                .and_then(serde_json::Value::as_object)
            {
                if let Err(error) = update_track_custom_tag(
                    connection,
                    track_id,
                    custom_key,
                    custom_tags.get(custom_key),
                ) {
                    errors.push(error);
                }
            }
            continue;
        }
        if let Err(error) =
            update_track_metadata_field(connection, track_id, field, track.get(field))
        {
            errors.push(error);
        }
    }
    if errors.is_empty() {
        clear_library_query_cache(connection);
        Ok(vec![track_id])
    } else {
        Err(errors)
    }
}

fn restore_advanced_snapshot(
    connection: &Connection,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<i64>, Vec<String>> {
    let Some(track) = payload.get("track").and_then(serde_json::Value::as_object) else {
        return Err(vec!["Undo payload is missing track metadata".to_string()]);
    };
    let custom_tags = payload
        .get("custom_tags")
        .and_then(serde_json::Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut merged = track.clone();
    merged.insert(
        "custom_tags".to_string(),
        serde_json::Value::Object(custom_tags),
    );
    let fields = payload
        .get("changed_fields")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|items| !items.is_empty())
        .unwrap_or_else(|| {
            vec![
                "title".to_string(),
                "artist".to_string(),
                "album".to_string(),
                "album_artist".to_string(),
                "track_number".to_string(),
                "disc_number".to_string(),
                "genre".to_string(),
                "year".to_string(),
                "rating".to_string(),
            ]
        });
    restore_metadata_snapshot(connection, &merged, &fields)
}

fn restore_changed_metadata(
    connection: &Connection,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<i64>, Vec<String>> {
    let Some(track) = payload.get("track").and_then(serde_json::Value::as_object) else {
        return Err(vec!["Undo payload is missing track metadata".to_string()]);
    };
    let Some(changes) = payload
        .get("changes")
        .and_then(serde_json::Value::as_object)
    else {
        return Err(vec!["Undo payload is missing changed fields".to_string()]);
    };
    let fields = changes.keys().cloned().collect::<Vec<_>>();
    restore_metadata_snapshot(connection, track, &fields)
}

fn restore_file_organization_native(
    connection: &Connection,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<i64>, Vec<String>> {
    let track_id = json_i64(payload.get("track_id")).unwrap_or(0);
    let source = json_text(payload.get("to")).unwrap_or_default();
    let target = json_text(payload.get("from")).unwrap_or_default();
    if track_id <= 0 || source.is_empty() || target.is_empty() {
        return Err(vec!["Undo payload is missing file move details".to_string()]);
    }
    let source_path = PathBuf::from(&source);
    let target_path = PathBuf::from(&target);
    if !source_path.exists() {
        return Err(vec![format!(
            "Moved file is missing: {}",
            source_path.display()
        )]);
    }
    if target_path.exists() {
        return Err(vec![format!(
            "Original path already exists: {}",
            target_path.display()
        )]);
    }
    if !connection
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .is_some()
    {
        return Err(vec![format!(
            "Track {track_id} is no longer in the library"
        )]);
    }
    if let Some(parent) = target_path.parent() {
        if let Err(error) = std::fs::create_dir_all(parent) {
            return Err(vec![format!("Could not create original folder: {error}")]);
        }
    }
    if let Err(error) = std::fs::rename(&source_path, &target_path) {
        return Err(vec![format!("Could not move file back: {error}")]);
    }
    let old_key =
        json_text(payload.get("new_path_key")).unwrap_or_else(|| normalized_path_key(&source));
    let restored_key =
        json_text(payload.get("previous_path_key")).unwrap_or_else(|| normalized_path_key(&target));
    connection
        .execute(
            "UPDATE tracks SET path = ?, path_key = ?, file_modified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
            params![target_path.to_string_lossy().to_string(), restored_key, track_id],
        )
        .map_err(|error| vec![format!("Could not restore organized track path: {error}")])?;
    let _ = connection.execute(
        "DELETE FROM track_metadata_cache WHERE path_key IN (?, ?)",
        params![old_key, normalized_path_key(&target_path.to_string_lossy())],
    );
    clear_library_query_cache(connection);
    Ok(vec![track_id])
}

fn restore_removed_track_native(
    connection: &Connection,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<i64>, Vec<String>> {
    let Some(track) = payload.get("track").and_then(serde_json::Value::as_object) else {
        return Err(vec![
            "Undo payload is missing removed track data".to_string()
        ]);
    };
    let track_id = json_i64(track.get("id")).unwrap_or(0);
    let path = json_text(track.get("path")).unwrap_or_default();
    if track_id <= 0 || path.is_empty() {
        return Err(vec![
            "Undo payload is missing removed track id or path".to_string()
        ]);
    }
    let track_path = PathBuf::from(&path);
    if !track_path.exists() {
        return Err(vec![format!(
            "Audio file no longer exists: {}",
            track_path.display()
        )]);
    }
    let restored_key =
        json_text(track.get("path_key")).unwrap_or_else(|| normalized_path_key(&path));
    if connection
        .query_row(
            "SELECT id FROM tracks WHERE id = ? OR path_key = ?",
            params![track_id, restored_key],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .is_some()
    {
        return Err(vec![format!(
            "Track id or path is already present in the library: {track_id}"
        )]);
    }
    const RESTORE_COLUMNS: &[&str] = &[
        "id",
        "path",
        "path_key",
        "title",
        "artist",
        "album",
        "album_artist",
        "album_id",
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
        "updated_at",
    ];
    let placeholders = vec!["?"; RESTORE_COLUMNS.len()].join(",");
    let values = RESTORE_COLUMNS
        .iter()
        .map(|column| {
            if *column == "path_key" {
                Value::Text(restored_key.clone())
            } else {
                json_sql_value(track.get(*column))
            }
        })
        .collect::<Vec<_>>();
    connection
        .execute(
            &format!(
                "INSERT INTO tracks({}) VALUES({})",
                RESTORE_COLUMNS.join(", "),
                placeholders
            ),
            params_from_iter(values),
        )
        .map_err(|error| vec![format!("Could not restore removed track: {error}")])?;
    clear_library_query_cache(connection);
    Ok(vec![track_id])
}

fn restore_bulk_undo_entry_native(
    connection: &Connection,
    action_type: &str,
    payload: &serde_json::Value,
) -> Result<Vec<i64>, Vec<String>> {
    let Some(payload) = payload.as_object() else {
        return Err(vec!["Undo payload is invalid".to_string()]);
    };
    match action_type {
        "csv_metadata_import" | "regex_metadata_replace" | "musicbrainz_auto_tag" => {
            restore_changed_metadata(connection, payload)
        }
        "advanced_tag_edit" | "tag_backup_restore" => {
            restore_advanced_snapshot(connection, payload)
        }
        "file_organization" => restore_file_organization_native(connection, payload),
        "track_remove" => restore_removed_track_native(connection, payload),
        "sqlite_file_tag_write" => Err(vec![
            "Restoring audio-file tag writes still requires the Python tag writer".to_string(),
        ]),
        _ => Err(vec![format!("Undo is not supported for {action_type}")]),
    }
}

#[tauri::command]
pub fn native_restore_bulk_undo_batch(
    _state: State<'_, NativeLibraryState>,
    batch_id: String,
) -> Result<NativeBulkUndoRestoreResponse, String> {
    let mut connection = open_database()?;
    let rows = {
        let mut statement = connection
            .prepare(
                "SELECT id, batch_id, action_type, summary, payload_json, created_at
                 FROM bulk_action_undo_log
                 WHERE batch_id = ?
                   AND action_type IN (
                     'csv_metadata_import', 'regex_metadata_replace', 'musicbrainz_auto_tag',
                     'file_organization', 'track_remove', 'advanced_tag_edit', 'tag_backup_restore'
                   )
                 ORDER BY id DESC",
            )
            .map_err(|error| format!("Could not prepare native undo batch restore: {error}"))?;
        let rows = statement
            .query_map(params![batch_id.trim()], |row| {
                Ok((
                    row.get::<_, i64>("id")?,
                    row.get::<_, Option<String>>("action_type")?
                        .unwrap_or_default(),
                    row.get::<_, Option<String>>("payload_json")?
                        .unwrap_or_default(),
                ))
            })
            .map_err(|error| format!("Could not read native undo batch: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native undo batch: {error}"))?
    };
    if rows.is_empty() {
        return Err("Undo batch was not found".to_string());
    }
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native undo batch restore: {error}"))?;
    let mut affected = Vec::<i64>::new();
    let mut errors = Vec::<String>::new();
    let action_type = rows
        .first()
        .map(|(_, action_type, _)| action_type.clone())
        .unwrap_or_default();
    for (entry_id, row_action, payload_text) in rows {
        let payload = match serde_json::from_str::<serde_json::Value>(&payload_text) {
            Ok(payload) => payload,
            Err(_) => {
                errors.push(format!("Entry {entry_id}: invalid payload"));
                continue;
            }
        };
        match restore_bulk_undo_entry_native(&transaction, &row_action, &payload) {
            Ok(track_ids) => affected.extend(track_ids),
            Err(entry_errors) => {
                errors.extend(
                    entry_errors
                        .into_iter()
                        .map(|error| format!("Entry {entry_id}: {error}")),
                );
            }
        }
    }
    let restored = errors.is_empty();
    if !affected.is_empty() {
        let unique = affected
            .iter()
            .copied()
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        let payload = json!({
            "restored_batch_id": batch_id,
            "restored_action_type": action_type,
            "affected_track_ids": unique,
            "errors": errors,
        });
        let _ = transaction.execute(
            "INSERT INTO bulk_action_undo_log(action_type, summary, payload_json)
             VALUES('undo_restore', ?, ?)",
            params![format!("Restored batch {batch_id}"), payload.to_string()],
        );
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit native undo batch restore: {error}"))?;
    let mut unique = Vec::new();
    for track_id in affected {
        if !unique.contains(&track_id) {
            unique.push(track_id);
        }
    }
    Ok(NativeBulkUndoRestoreResponse {
        entry_id: 0,
        batch_id: Some(batch_id),
        action_type,
        restored,
        affected_track_ids: unique,
        errors: errors.into_iter().take(100).collect(),
    })
}

#[tauri::command]
pub fn native_restore_bulk_undo_entry(
    _state: State<'_, NativeLibraryState>,
    entry_id: i64,
) -> Result<NativeBulkUndoRestoreResponse, String> {
    let mut connection = open_database()?;
    let (batch_id, action_type, summary, payload_text) = connection
        .query_row(
            "SELECT batch_id, action_type, summary, payload_json
             FROM bulk_action_undo_log
             WHERE id = ?",
            params![entry_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>("batch_id")?,
                    row.get::<_, Option<String>>("action_type")?
                        .unwrap_or_default(),
                    row.get::<_, Option<String>>("summary")?.unwrap_or_default(),
                    row.get::<_, Option<String>>("payload_json")?
                        .unwrap_or_default(),
                ))
            },
        )
        .map_err(|_| "Undo log entry was not found".to_string())?;
    let payload = serde_json::from_str::<serde_json::Value>(&payload_text)
        .map_err(|_| "Undo log entry payload is invalid".to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native undo restore: {error}"))?;
    let (affected, errors) =
        match restore_bulk_undo_entry_native(&transaction, &action_type, &payload) {
            Ok(track_ids) => (track_ids, Vec::new()),
            Err(errors) => (Vec::new(), errors),
        };
    let restored = errors.is_empty();
    if restored {
        let payload = json!({
            "restored_entry_id": entry_id,
            "restored_batch_id": batch_id,
            "restored_action_type": action_type,
            "affected_track_ids": affected,
        });
        let _ = transaction.execute(
            "INSERT INTO bulk_action_undo_log(action_type, summary, payload_json)
             VALUES('undo_restore', ?, ?)",
            params![format!("Restored {summary}"), payload.to_string()],
        );
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit native undo restore: {error}"))?;
    Ok(NativeBulkUndoRestoreResponse {
        entry_id,
        batch_id,
        action_type,
        restored,
        affected_track_ids: affected,
        errors,
    })
}

fn track_by_id(connection: &Connection, track_id: i64) -> Result<NativeTrack, String> {
    connection
        .query_row(
            &format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?"),
            params![track_id],
            track_from_row,
        )
        .map_err(|error| format!("Track not found: {error}"))
}

#[tauri::command]
pub fn native_health() -> Result<NativeStatusResponse, String> {
    Ok(NativeStatusResponse {
        status: "ok".to_string(),
    })
}

#[tauri::command]
pub fn native_settings(
    _state: State<'_, NativeLibraryState>,
) -> Result<NativeSettingsResponse, String> {
    let connection = open_database()?;
    let library_paths = read_library_paths(&connection);
    let library_path =
        get_setting(&connection, "library_path").or_else(|| library_paths.first().cloned());
    let acoustid_api_key_configured = get_setting(&connection, "acoustid_api_key")
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty());
    let lastfm_saved_configured = connection
        .query_row(
            "SELECT coalesce(api_key, ''), coalesce(api_secret, '') FROM scrobble_accounts WHERE service = 'lastfm'",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .ok()
        .is_some_and(|(key, secret)| !key.trim().is_empty() && !secret.trim().is_empty());
    let lastfm_env_configured = env::var("FLAC_CAFE_LASTFM_API_KEY")
        .or_else(|_| env::var("LASTFM_API_KEY"))
        .ok()
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
        && env::var("FLAC_CAFE_LASTFM_API_SECRET")
            .or_else(|_| env::var("LASTFM_API_SECRET"))
            .ok()
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty());
    let lastfm_api_credentials_source = match (lastfm_env_configured, lastfm_saved_configured) {
        (true, true) => Some("environment+saved".to_string()),
        (true, false) => Some("environment".to_string()),
        (false, true) => Some("saved".to_string()),
        (false, false) => None,
    };
    Ok(NativeSettingsResponse {
        library_path,
        library_paths,
        database_path: database_path().to_string_lossy().to_string(),
        suggested_music_path: suggested_music_path(),
        write_ratings_to_files: truthy_setting(&connection, "write_ratings_to_files", false),
        auto_write_fetched_lyrics_sidecars: truthy_setting(
            &connection,
            "auto_write_fetched_lyrics_sidecars",
            false,
        ),
        cd_auto_lookup_metadata: truthy_setting(&connection, "cd_auto_lookup_metadata", true),
        acoustid_api_key_configured,
        lastfm_api_credentials_configured: lastfm_api_credentials_source.is_some(),
        lastfm_api_credentials_source,
        extra: json!({ "clap": { "deferred": true }, "source": "rust-sqlite" }),
    })
}

#[tauri::command]
pub fn native_update_settings(
    state: State<'_, NativeLibraryState>,
    write_ratings_to_files: Option<bool>,
    auto_write_fetched_lyrics_sidecars: Option<bool>,
    cd_auto_lookup_metadata: Option<bool>,
    acoustid_api_key: Option<String>,
    clear_acoustid_api_key: Option<bool>,
    lastfm_api_key: Option<String>,
    lastfm_api_secret: Option<String>,
    clear_lastfm_api_credentials: Option<bool>,
) -> Result<NativeSettingsResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start settings update: {error}"))?;
    if let Some(value) = write_ratings_to_files {
        set_setting(
            &transaction,
            "write_ratings_to_files",
            Some(if value { "1" } else { "0" }),
        )?;
    }
    if let Some(value) = auto_write_fetched_lyrics_sidecars {
        set_setting(
            &transaction,
            "auto_write_fetched_lyrics_sidecars",
            Some(if value { "1" } else { "0" }),
        )?;
    }
    if let Some(value) = cd_auto_lookup_metadata {
        set_setting(
            &transaction,
            "cd_auto_lookup_metadata",
            Some(if value { "1" } else { "0" }),
        )?;
    }
    if clear_acoustid_api_key.unwrap_or(false) {
        set_setting(&transaction, "acoustid_api_key", None)?;
    } else if let Some(value) = acoustid_api_key {
        let cleaned = value.trim().to_string();
        set_setting(
            &transaction,
            "acoustid_api_key",
            if cleaned.is_empty() {
                None
            } else {
                Some(cleaned.as_str())
            },
        )?;
    }
    if clear_lastfm_api_credentials.unwrap_or(false) {
        transaction
            .execute(
                "INSERT INTO scrobble_accounts(service, enabled, api_key, api_secret, updated_at)
                 VALUES('lastfm', 0, NULL, NULL, datetime('now'))
                 ON CONFLICT(service) DO UPDATE SET api_key = NULL, api_secret = NULL, updated_at = excluded.updated_at",
                [],
            )
            .map_err(|error| format!("Could not clear Last.fm credentials: {error}"))?;
    } else if lastfm_api_key.is_some() || lastfm_api_secret.is_some() {
        let existing = transaction
            .query_row(
                "SELECT coalesce(api_key, ''), coalesce(api_secret, '') FROM scrobble_accounts WHERE service = 'lastfm'",
                [],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .unwrap_or_else(|_| ("".to_string(), "".to_string()));
        let key = lastfm_api_key.unwrap_or(existing.0).trim().to_string();
        let secret = lastfm_api_secret.unwrap_or(existing.1).trim().to_string();
        transaction
            .execute(
                "INSERT INTO scrobble_accounts(service, api_key, api_secret, updated_at)
                 VALUES('lastfm', ?, ?, datetime('now'))
                 ON CONFLICT(service) DO UPDATE SET api_key = excluded.api_key, api_secret = excluded.api_secret, updated_at = excluded.updated_at",
                params![
                    if key.is_empty() { None } else { Some(key.as_str()) },
                    if secret.is_empty() { None } else { Some(secret.as_str()) }
                ],
            )
            .map_err(|error| format!("Could not save Last.fm credentials: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save settings: {error}"))?;
    native_settings(state)
}

#[tauri::command]
pub fn native_track(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
) -> Result<NativeTrack, String> {
    let connection = open_database()?;
    track_by_id(&connection, track_id)
}

#[tauri::command]
pub fn native_tracks_batch(
    _state: State<'_, NativeLibraryState>,
    track_ids: Vec<i64>,
) -> Result<NativeTrackBatchResponse, String> {
    let connection = open_database()?;
    let unique_ids: Vec<i64> = track_ids
        .into_iter()
        .filter(|track_id| *track_id > 0)
        .collect::<Vec<_>>()
        .into_iter()
        .fold(Vec::new(), |mut ids, id| {
            if !ids.contains(&id) {
                ids.push(id);
            }
            ids
        });
    if unique_ids.is_empty() {
        return Ok(NativeTrackBatchResponse {
            tracks: Vec::new(),
            missing_ids: Vec::new(),
        });
    }
    let placeholders = vec!["?"; unique_ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare native batch track query: {error}"))?;
    let rows = statement
        .query_map(
            params_from_iter(unique_ids.iter().copied().map(Value::Integer)),
            track_from_row,
        )
        .map_err(|error| format!("Could not read native batch tracks: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native batch tracks: {error}"))?;
    let mut by_id: HashMap<i64, NativeTrack> =
        tracks.into_iter().map(|track| (track.id, track)).collect();
    let mut ordered = Vec::new();
    let mut missing_ids = Vec::new();
    for id in unique_ids {
        if let Some(track) = by_id.remove(&id) {
            ordered.push(track);
        } else {
            missing_ids.push(id);
        }
    }
    Ok(NativeTrackBatchResponse {
        tracks: ordered,
        missing_ids,
    })
}

#[tauri::command]
pub fn native_similar_tracks(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    limit: Option<usize>,
) -> Result<Vec<NativeSimilarTrack>, String> {
    let connection = open_database()?;
    let seed_track = track_by_id(&connection, track_id)?;
    let limit = limit.unwrap_or(12).clamp(1, 50);
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE id <> ? AND {music_filter}",
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare native similar-track query: {error}"))?;
    let rows = statement
        .query_map(params![track_id], track_from_row)
        .map_err(|error| format!("Could not read native similar tracks: {error}"))?;
    let mut candidates = Vec::new();
    let settings = native_autodj_settings(json!({ "similarity_weight": 1.0 }));
    for row in rows {
        let track =
            row.map_err(|error| format!("Could not decode native similar track: {error}"))?;
        let (mut score, reason) = similarity_adjustment(&track, Some(&seed_track), &settings);
        let audio_similarity = cosine_similarity(
            track.analysis_embedding.as_deref(),
            seed_track.analysis_embedding.as_deref(),
        );
        if let Some(value) = audio_similarity {
            if value > 0.0 {
                score += value;
            }
        }
        if score <= 0.0 {
            continue;
        }
        candidates.push(NativeSimilarTrack {
            track,
            similarity_score: round4(score),
            similarity_reason: if reason.is_empty() {
                "metadata similarity".to_string()
            } else {
                reason
            },
            audio_similarity: audio_similarity.map(round4),
        });
    }
    candidates.sort_by(|left, right| {
        right
            .similarity_score
            .partial_cmp(&left.similarity_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                right
                    .track
                    .rating
                    .partial_cmp(&left.track.rating)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| right.track.bitrate.cmp(&left.track.bitrate))
    });
    candidates.truncate(limit);
    Ok(candidates)
}

#[tauri::command]
pub fn native_audiobooks(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<NativeAudiobookListResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    let offset = offset.unwrap_or(0);
    let audiobook_filter = audiobook_where_clause();
    let track_columns = qualified_track_columns("tracks");
    let total = connection
        .query_row(
            &format!("SELECT COUNT(*) AS count FROM tracks WHERE {audiobook_filter}"),
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not count native audiobooks: {error}"))?;
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns},
                   audiobook_progress.position_seconds,
                   audiobook_progress.duration_seconds AS saved_duration_seconds,
                   audiobook_progress.updated_at AS progress_updated_at,
                   COUNT(DISTINCT audiobook_bookmarks.id) AS bookmark_count,
                   COUNT(DISTINCT audiobook_chapters.id) AS chapter_count
            FROM tracks
            LEFT JOIN audiobook_progress ON audiobook_progress.track_id = tracks.id
            LEFT JOIN audiobook_bookmarks ON audiobook_bookmarks.track_id = tracks.id
            LEFT JOIN audiobook_chapters ON audiobook_chapters.track_id = tracks.id
            WHERE {audiobook_filter}
            GROUP BY tracks.id
            ORDER BY lower(coalesce(tracks.album_artist, tracks.artist, '')),
                     lower(coalesce(tracks.album, '')),
                     coalesce(tracks.disc_number, 0),
                     coalesce(tracks.track_number, 0),
                     lower(coalesce(tracks.title, ''))
            LIMIT ? OFFSET ?
            "#
        ))
        .map_err(|error| format!("Could not prepare native audiobook query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64, offset as i64], |row| {
            let mut track = track_from_row(row)?;
            let position_seconds = row
                .get::<_, Option<f64>>("position_seconds")?
                .unwrap_or(0.0);
            let saved_duration_seconds: Option<f64> = row.get("saved_duration_seconds")?;
            let effective_duration = saved_duration_seconds.or(track.duration_seconds);
            track.duration_seconds = effective_duration;
            Ok(NativeAudiobookTrack {
                track,
                position_seconds,
                progress_percent: progress_percent(position_seconds, effective_duration),
                bookmark_count: row.get::<_, Option<i64>>("bookmark_count")?.unwrap_or(0),
                chapter_count: row.get::<_, Option<i64>>("chapter_count")?.unwrap_or(0),
                progress_updated_at: row.get("progress_updated_at")?,
            })
        })
        .map_err(|error| format!("Could not read native audiobooks: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native audiobooks: {error}"))?;
    Ok(NativeAudiobookListResponse { total, tracks })
}

#[tauri::command]
pub fn native_update_audiobook_progress(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    position_seconds: f64,
    duration_seconds: Option<f64>,
) -> Result<NativeAudiobookProgressResponse, String> {
    if position_seconds < 0.0 || duration_seconds.is_some_and(|value| value < 0.0) {
        return Err("Audiobook progress cannot be negative".to_string());
    }
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native audiobook progress update: {error}"))?;
    let track_duration: Option<f64> = transaction
        .query_row(
            "SELECT duration_seconds FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .map_err(|_| "Audiobook track not found".to_string())?;
    let duration = duration_seconds.or(track_duration);
    transaction
        .execute(
            r#"
            INSERT INTO audiobook_progress(track_id, position_seconds, duration_seconds, updated_at)
            VALUES(?, ?, ?, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET
              position_seconds = excluded.position_seconds,
              duration_seconds = excluded.duration_seconds,
              updated_at = datetime('now')
            "#,
            params![track_id, position_seconds.max(0.0), duration],
        )
        .map_err(|error| format!("Could not save native audiobook progress: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit native audiobook progress: {error}"))?;
    connection
        .query_row(
            "SELECT track_id, position_seconds, duration_seconds, updated_at FROM audiobook_progress WHERE track_id = ?",
            params![track_id],
            |row| {
                Ok(NativeAudiobookProgressResponse {
                    track_id: row.get("track_id")?,
                    position_seconds: row.get("position_seconds")?,
                    duration_seconds: row.get("duration_seconds")?,
                    updated_at: row.get("updated_at")?,
                })
            },
        )
        .map_err(|error| format!("Could not read native audiobook progress: {error}"))
}

#[tauri::command]
pub fn native_audiobook_bookmarks(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
) -> Result<Vec<NativeAudiobookBookmark>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            "SELECT id, track_id, position_seconds, label, note, created_at
             FROM audiobook_bookmarks
             WHERE track_id = ?
             ORDER BY position_seconds, id",
        )
        .map_err(|error| format!("Could not prepare native audiobook bookmark query: {error}"))?;
    let rows = statement
        .query_map(params![track_id], audiobook_bookmark_from_row)
        .map_err(|error| format!("Could not read native audiobook bookmarks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native audiobook bookmarks: {error}"))
}

#[tauri::command]
pub fn native_create_audiobook_bookmark(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    position_seconds: f64,
    label: Option<String>,
    note: Option<String>,
) -> Result<NativeAudiobookBookmark, String> {
    if position_seconds < 0.0 {
        return Err("Audiobook bookmark position cannot be negative".to_string());
    }
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native audiobook bookmark insert: {error}"))?;
    let present: Option<i64> = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .ok();
    if present.is_none() {
        return Err("Audiobook track not found".to_string());
    }
    let label = clean_optional_text(label).unwrap_or_else(|| "Bookmark".to_string());
    let cursor = transaction
        .execute(
            "INSERT INTO audiobook_bookmarks(track_id, position_seconds, label, note) VALUES(?, ?, ?, ?)",
            params![track_id, position_seconds.max(0.0), label, clean_optional_text(note)],
        )
        .map_err(|error| format!("Could not save native audiobook bookmark: {error}"))?;
    let bookmark_id = transaction.last_insert_rowid();
    if cursor == 0 {
        return Err("Could not save native audiobook bookmark".to_string());
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit native audiobook bookmark: {error}"))?;
    connection
        .query_row(
            "SELECT id, track_id, position_seconds, label, note, created_at FROM audiobook_bookmarks WHERE id = ?",
            params![bookmark_id],
            audiobook_bookmark_from_row,
        )
        .map_err(|error| format!("Could not read native audiobook bookmark: {error}"))
}

#[tauri::command]
pub fn native_delete_audiobook_bookmark(
    _state: State<'_, NativeLibraryState>,
    bookmark_id: i64,
) -> Result<NativeDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM audiobook_bookmarks WHERE id = ?",
            params![bookmark_id],
        )
        .map_err(|error| format!("Could not delete native audiobook bookmark: {error}"))?;
    if deleted == 0 {
        return Err("Audiobook bookmark not found".to_string());
    }
    Ok(NativeDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn native_audiobook_chapters(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
) -> Result<Vec<NativeAudiobookChapter>, String> {
    let connection = open_database()?;
    native_audiobook_chapters_for_connection(&connection, track_id)
}

fn native_audiobook_chapters_for_connection(
    connection: &Connection,
    track_id: i64,
) -> Result<Vec<NativeAudiobookChapter>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, track_id, chapter_index, title, start_seconds, end_seconds, created_at, updated_at
             FROM audiobook_chapters
             WHERE track_id = ?
             ORDER BY chapter_index",
        )
        .map_err(|error| format!("Could not prepare native audiobook chapter query: {error}"))?;
    let rows = statement
        .query_map(params![track_id], audiobook_chapter_from_row)
        .map_err(|error| format!("Could not read native audiobook chapters: {error}"))?;
    let chapters = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native audiobook chapters: {error}"))?;
    if !chapters.is_empty() {
        return Ok(chapters);
    }
    let fallback: Option<(Option<String>, Option<f64>)> = connection
        .query_row(
            "SELECT title, duration_seconds FROM tracks WHERE id = ?",
            params![track_id],
            |row| Ok((row.get("title")?, row.get("duration_seconds")?)),
        )
        .ok();
    let Some((title, duration_seconds)) = fallback else {
        return Ok(Vec::new());
    };
    Ok(vec![NativeAudiobookChapter {
        id: None,
        track_id: Some(track_id),
        chapter_index: 1,
        title: title
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "Chapter 1".to_string()),
        start_seconds: 0.0,
        end_seconds: duration_seconds,
        created_at: None,
        updated_at: None,
    }])
}

#[tauri::command]
pub fn native_save_audiobook_chapters(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    chapters: Vec<serde_json::Value>,
) -> Result<Vec<NativeAudiobookChapter>, String> {
    if chapters.len() > 500 {
        return Err("Audiobook chapters are limited to 500 entries".to_string());
    }
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native audiobook chapter update: {error}"))?;
    let present: Option<i64> = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .ok();
    if present.is_none() {
        return Err("Audiobook track not found".to_string());
    }
    transaction
        .execute(
            "DELETE FROM audiobook_chapters WHERE track_id = ?",
            params![track_id],
        )
        .map_err(|error| format!("Could not replace native audiobook chapters: {error}"))?;
    for (index, chapter) in chapters.iter().enumerate() {
        let chapter_index = chapter
            .get("chapter_index")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or((index + 1) as i64)
            .max(1);
        let title = chapter
            .get("title")
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format!("Chapter {}", index + 1));
        let start_seconds = chapter
            .get("start_seconds")
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(0.0)
            .max(0.0);
        let end_seconds = chapter
            .get("end_seconds")
            .and_then(serde_json::Value::as_f64)
            .filter(|value| *value >= 0.0);
        transaction
            .execute(
                "INSERT INTO audiobook_chapters(track_id, chapter_index, title, start_seconds, end_seconds) VALUES(?, ?, ?, ?, ?)",
                params![track_id, chapter_index, title, start_seconds, end_seconds],
            )
            .map_err(|error| format!("Could not save native audiobook chapter: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit native audiobook chapters: {error}"))?;
    native_audiobook_chapters(_state, track_id)
}

pub fn native_export_audiobook_sync_metadata(
    track_ids: Option<Vec<i64>>,
    limit: Option<usize>,
) -> Result<NativeAudiobookSyncExportResponse, String> {
    let limit = limit.unwrap_or(10_000).clamp(1, 100_000);
    let connection = open_database()?;
    let audiobook_filter = audiobook_where_clause();
    let mut query_params: Vec<Value> = Vec::new();
    let id_filter = if let Some(track_ids) = track_ids {
        let ids = track_ids
            .into_iter()
            .filter(|track_id| *track_id > 0)
            .collect::<Vec<_>>();
        if ids.is_empty() {
            String::new()
        } else {
            query_params.extend(ids.iter().copied().map(Value::Integer));
            format!(
                " AND tracks.id IN ({})",
                std::iter::repeat("?")
                    .take(ids.len())
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
    } else {
        String::new()
    };
    query_params.push(Value::Integer(limit as i64));
    let mut statement = connection
        .prepare(&format!(
            "
            SELECT
                tracks.id AS id,
                tracks.path AS path,
                tracks.title AS title,
                tracks.artist AS artist,
                tracks.album AS album,
                tracks.album_artist AS album_artist,
                tracks.track_number AS track_number,
                tracks.disc_number AS disc_number,
                tracks.genre AS genre,
                tracks.year AS year,
                tracks.duration_seconds AS duration_seconds,
                tracks.rating AS rating,
                tracks.play_count AS play_count,
                tracks.last_played_at AS last_played_at,
                tracks.date_added AS date_added,
                audiobook_progress.position_seconds AS position_seconds,
                audiobook_progress.updated_at AS progress_updated_at
            FROM tracks
            LEFT JOIN audiobook_progress ON audiobook_progress.track_id = tracks.id
            WHERE {audiobook_filter}
              {id_filter}
            ORDER BY lower(coalesce(tracks.album_artist, tracks.artist, '')),
                     lower(coalesce(tracks.album, '')),
                     coalesce(tracks.track_number, 0)
            LIMIT ?
            "
        ))
        .map_err(|error| format!("Could not prepare audiobook sync export: {error}"))?;
    let track_rows = statement
        .query_map(params_from_iter(query_params), |row| {
            row_to_json_object(
                row,
                &[
                    "id",
                    "path",
                    "title",
                    "artist",
                    "album",
                    "album_artist",
                    "track_number",
                    "disc_number",
                    "genre",
                    "year",
                    "duration_seconds",
                    "rating",
                    "play_count",
                    "last_played_at",
                    "date_added",
                    "position_seconds",
                    "progress_updated_at",
                ],
            )
        })
        .map_err(|error| format!("Could not read audiobook sync export rows: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode audiobook sync export rows: {error}"))?;

    let mut payload_tracks = Vec::new();
    for track in track_rows {
        let track_id = track
            .get("id")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or(0);
        payload_tracks.push(json!({
            "track": track,
            "bookmarks": audiobook_bookmarks_json(&connection, track_id)?,
            "chapters": audiobook_chapters_json(&connection, track_id)?,
        }));
    }
    let generated_at = scan::utc_now();
    let export_dir = app_storage_root().join("exports");
    std::fs::create_dir_all(&export_dir).map_err(|error| {
        format!(
            "Could not create audiobook sync export folder {}: {error}",
            export_dir.display()
        )
    })?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let target = export_dir.join(format!("flac-cafe-audiobook-sync-{stamp}.json"));
    let payload = json!({
        "generated_at": generated_at,
        "format": "flac-cafe-audiobook-sync-v1",
        "tracks": payload_tracks,
    });
    let text = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Could not encode audiobook sync export: {error}"))?;
    std::fs::write(&target, text).map_err(|error| {
        format!(
            "Could not write audiobook sync export {}: {error}",
            target.display()
        )
    })?;
    Ok(NativeAudiobookSyncExportResponse {
        export_path: target.to_string_lossy().to_string(),
        track_count: payload
            .get("tracks")
            .and_then(serde_json::Value::as_array)
            .map(|tracks| tracks.len() as i64)
            .unwrap_or(0),
        generated_at,
    })
}

fn audiobook_bookmarks_json(
    connection: &Connection,
    track_id: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, track_id, position_seconds, label, note, created_at
             FROM audiobook_bookmarks
             WHERE track_id = ?
             ORDER BY position_seconds ASC, id ASC",
        )
        .map_err(|error| format!("Could not prepare audiobook bookmark export: {error}"))?;
    let rows = statement
        .query_map(params![track_id], |row| {
            row_to_json_object(
                row,
                &[
                    "id",
                    "track_id",
                    "position_seconds",
                    "label",
                    "note",
                    "created_at",
                ],
            )
        })
        .map_err(|error| format!("Could not read audiobook bookmark export: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode audiobook bookmark export: {error}"))
}

fn audiobook_chapters_json(
    connection: &Connection,
    track_id: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let chapters = native_audiobook_chapters_for_connection(connection, track_id)?;
    serde_json::to_value(chapters)
        .map(|value| value.as_array().cloned().unwrap_or_default())
        .map_err(|error| format!("Could not encode audiobook chapters: {error}"))
}

fn row_to_json_object(
    row: &rusqlite::Row<'_>,
    columns: &[&str],
) -> rusqlite::Result<serde_json::Value> {
    let mut object = serde_json::Map::new();
    for column in columns {
        let value: Value = row.get(*column)?;
        object.insert((*column).to_string(), sqlite_value_to_json(value));
    }
    Ok(serde_json::Value::Object(object))
}

fn sqlite_value_to_json(value: Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Integer(value) => json!(value),
        Value::Real(value) => json!(value),
        Value::Text(value) => serde_json::Value::String(value),
        Value::Blob(_) => serde_json::Value::String("[blob]".to_string()),
    }
}

fn native_radio_station_by_id(
    connection: &Connection,
    station_id: i64,
) -> Result<NativeRadioStation, String> {
    connection
        .query_row(
            "SELECT id, name, stream_url, homepage_url, genre, notes, last_played_at, created_at, updated_at
             FROM radio_stations
             WHERE id = ?",
            params![station_id],
            radio_station_from_row,
        )
        .map_err(|_| "Radio station not found".to_string())
}

#[tauri::command]
pub fn native_radio_stations(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativeRadioStation>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, stream_url, homepage_url, genre, notes, last_played_at, created_at, updated_at
             FROM radio_stations
             ORDER BY coalesce(last_played_at, '') DESC, lower(name)",
        )
        .map_err(|error| format!("Could not prepare native radio station query: {error}"))?;
    let rows = statement
        .query_map([], radio_station_from_row)
        .map_err(|error| format!("Could not read native radio stations: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native radio stations: {error}"))
}

#[tauri::command]
pub fn native_save_radio_station(
    _state: State<'_, NativeLibraryState>,
    station_id: Option<i64>,
    name: String,
    stream_url: String,
    homepage_url: Option<String>,
    genre: Option<String>,
    notes: Option<String>,
) -> Result<NativeRadioStation, String> {
    let name = clean_required_text(name, "Radio station name")?;
    let stream_url = clean_required_text(stream_url, "Radio stream URL")?;
    let connection = open_database()?;
    let row_id = if let Some(station_id) = station_id {
        let updated = connection
            .execute(
                "UPDATE radio_stations
                 SET name = ?, stream_url = ?, homepage_url = ?, genre = ?, notes = ?, updated_at = datetime('now')
                 WHERE id = ?",
                params![
                    name,
                    stream_url,
                    clean_optional_text(homepage_url),
                    clean_optional_text(genre),
                    clean_optional_text(notes),
                    station_id
                ],
            )
            .map_err(|error| format!("Could not update native radio station: {error}"))?;
        if updated == 0 {
            return Err("Radio station not found".to_string());
        }
        station_id
    } else {
        connection
            .execute(
                "INSERT INTO radio_stations(name, stream_url, homepage_url, genre, notes)
                 VALUES(?, ?, ?, ?, ?)
                 ON CONFLICT(stream_url) DO UPDATE SET
                   name = excluded.name,
                   homepage_url = excluded.homepage_url,
                   genre = excluded.genre,
                   notes = excluded.notes,
                   updated_at = datetime('now')",
                params![
                    name,
                    stream_url,
                    clean_optional_text(homepage_url),
                    clean_optional_text(genre),
                    clean_optional_text(notes)
                ],
            )
            .map_err(|error| format!("Could not save native radio station: {error}"))?;
        connection.last_insert_rowid()
    };
    let resolved_id = if row_id > 0 {
        row_id
    } else {
        connection
            .query_row(
                "SELECT id FROM radio_stations WHERE stream_url = ?",
                params![stream_url],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("Could not find native radio station after save: {error}"))?
    };
    native_radio_station_by_id(&connection, resolved_id)
}

#[tauri::command]
pub fn native_delete_radio_station(
    _state: State<'_, NativeLibraryState>,
    station_id: i64,
) -> Result<NativeDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM radio_stations WHERE id = ?",
            params![station_id],
        )
        .map_err(|error| format!("Could not delete native radio station: {error}"))?;
    if deleted == 0 {
        return Err("Radio station not found".to_string());
    }
    Ok(NativeDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn native_mark_radio_station_played(
    _state: State<'_, NativeLibraryState>,
    station_id: i64,
) -> Result<NativeRadioStation, String> {
    let connection = open_database()?;
    let updated = connection
        .execute(
            "UPDATE radio_stations
             SET last_played_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?",
            params![station_id],
        )
        .map_err(|error| format!("Could not update native radio station playback: {error}"))?;
    if updated == 0 {
        return Err("Radio station not found".to_string());
    }
    native_radio_station_by_id(&connection, station_id)
}

#[tauri::command]
pub fn native_loved_tracks(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<NativeLovedTrack>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(100).clamp(1, 1000);
    let mut statement = connection
        .prepare(
            "SELECT track_loves.track_id, track_loves.loved, track_loves.source, track_loves.updated_at,
                    tracks.title, tracks.artist, tracks.album
             FROM track_loves
             JOIN tracks ON tracks.id = track_loves.track_id
             WHERE track_loves.loved = 1
             ORDER BY datetime(track_loves.updated_at) DESC
             LIMIT ?",
        )
        .map_err(|error| format!("Could not prepare native loved-track query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], |row| {
            Ok(NativeLovedTrack {
                track_id: row.get("track_id")?,
                loved: row.get::<_, Option<i64>>("loved")?.unwrap_or(0) != 0,
                source: row
                    .get::<_, Option<String>>("source")?
                    .unwrap_or_else(|| "local".to_string()),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
                title: row.get("title")?,
                artist: row.get("artist")?,
                album: row.get("album")?,
            })
        })
        .map_err(|error| format!("Could not read native loved tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native loved tracks: {error}"))
}

#[tauri::command]
pub fn native_update_track_love(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    loved: bool,
    source: Option<String>,
) -> Result<NativeTrackLoveResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native loved-track update: {error}"))?;
    let track: Option<(
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )> = transaction
        .query_row(
            "SELECT artist, title, album, album_artist FROM tracks WHERE id = ?",
            params![track_id],
            |row| {
                Ok((
                    row.get("artist")?,
                    row.get("title")?,
                    row.get("album")?,
                    row.get("album_artist")?,
                ))
            },
        )
        .ok();
    let Some((artist, title, album, album_artist)) = track else {
        return Err("Track not found".to_string());
    };
    let source = clean_optional_text(source).unwrap_or_else(|| "local".to_string());
    transaction
        .execute(
            "INSERT INTO track_loves(track_id, loved, source, updated_at)
             VALUES(?, ?, ?, datetime('now'))
             ON CONFLICT(track_id) DO UPDATE SET
               loved = excluded.loved,
               source = excluded.source,
               updated_at = datetime('now')",
            params![track_id, if loved { 1 } else { 0 }, source],
        )
        .map_err(|error| format!("Could not save native loved-track state: {error}"))?;
    if loved {
        if let (Some(artist), Some(title)) = (
            artist.filter(|v| !v.trim().is_empty()),
            title.filter(|v| !v.trim().is_empty()),
        ) {
            transaction
                .execute(
                    "INSERT INTO scrobble_outbox(service, track_id, event_type, artist, title, album, album_artist, listened_at)
                     VALUES('lastfm', ?, 'loved', ?, ?, ?, ?, strftime('%s', 'now'))",
                    params![track_id, artist, title, album, album_artist],
                )
                .map_err(|error| format!("Could not queue native loved-track scrobble: {error}"))?;
        }
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit native loved-track update: {error}"))?;
    connection
        .query_row(
            "SELECT track_id, loved, source, updated_at FROM track_loves WHERE track_id = ?",
            params![track_id],
            |row| {
                Ok(NativeTrackLoveResponse {
                    track_id: row.get("track_id")?,
                    loved: row.get::<_, Option<i64>>("loved")?.unwrap_or(0) != 0,
                    source: row
                        .get::<_, Option<String>>("source")?
                        .unwrap_or_else(|| "local".to_string()),
                    updated_at: row
                        .get::<_, Option<String>>("updated_at")?
                        .unwrap_or_default(),
                })
            },
        )
        .map_err(|error| format!("Could not read native loved-track state: {error}"))
}

#[tauri::command]
pub fn native_update_track_rating(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    rating: Option<f64>,
) -> Result<NativeTrack, String> {
    if let Some(value) = rating {
        let is_half_star = ((value * 2.0).round() - (value * 2.0)).abs() < f64::EPSILON;
        if !(0.5..=5.0).contains(&value) || !is_half_star {
            return Err("Rating must be a half-star value from 0.5 to 5.".to_string());
        }
    }
    let mut connection = open_database()?;
    if truthy_setting(&connection, "write_ratings_to_files", false) {
        return Err(
            "Native rating update is deferring because file rating writes are enabled.".to_string(),
        );
    }
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native rating update: {error}"))?;
    let present: Option<i64> = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .ok();
    if present.is_none() {
        return Err("Track not found".to_string());
    }
    transaction
        .execute(
            "UPDATE tracks SET rating = ?, updated_at = datetime('now') WHERE id = ?",
            params![rating, track_id],
        )
        .map_err(|error| format!("Could not update native rating: {error}"))?;
    transaction
        .execute(
            "INSERT INTO play_events(track_id, event_type, metadata_json) VALUES(?, 'rated', ?)",
            params![track_id, json!({ "rating": rating }).to_string()],
        )
        .map_err(|error| format!("Could not record native rating event: {error}"))?;
    clear_library_query_cache(&transaction);
    transaction
        .commit()
        .map_err(|error| format!("Could not save native rating update: {error}"))?;
    track_by_id(&connection, track_id)
}

fn native_mark_track_event(track_id: i64, event_type: &str) -> Result<NativeTrack, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native playback event: {error}"))?;
    let present: Option<i64> = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .ok();
    if present.is_none() {
        return Err("Track not found".to_string());
    }
    let (count_column, timestamp_column) = if event_type == "played" {
        ("play_count", "last_played_at")
    } else {
        ("skip_count", "last_skipped_at")
    };
    transaction
        .execute(
            &format!(
                "UPDATE tracks
                 SET {count_column} = coalesce({count_column}, 0) + 1,
                     {timestamp_column} = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
                     updated_at = datetime('now')
                 WHERE id = ?"
            ),
            params![track_id],
        )
        .map_err(|error| format!("Could not update native {event_type} event: {error}"))?;
    transaction
        .execute(
            "INSERT INTO play_events(track_id, event_type, metadata_json) VALUES(?, ?, ?)",
            params![
                track_id,
                event_type,
                json!({ "source": "player" }).to_string()
            ],
        )
        .map_err(|error| format!("Could not record native {event_type} event: {error}"))?;
    clear_library_query_cache(&transaction);
    transaction
        .commit()
        .map_err(|error| format!("Could not save native {event_type} event: {error}"))?;
    track_by_id(&connection, track_id)
}

#[tauri::command]
pub fn native_mark_track_played(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
) -> Result<NativeTrack, String> {
    native_mark_track_event(track_id, "played")
}

#[tauri::command]
pub fn native_mark_track_skipped(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
) -> Result<NativeTrack, String> {
    native_mark_track_event(track_id, "skipped")
}

fn is_supported_audio_path(path: &Path, extensions: &HashSet<String>) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extensions.contains(&format!(".{}", extension.to_lowercase())))
        .unwrap_or(false)
}

fn scan_reconcile_folder(
    folder: &Path,
    extensions: &HashSet<String>,
    files: &mut HashMap<String, (String, Option<i64>)>,
    errors: &mut Vec<String>,
) {
    let entries = match std::fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(error) => {
            errors.push(format!("{}: {error}", folder.display()));
            return;
        }
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_reconcile_folder(&path, extensions, files, errors);
        } else if path.is_file() && is_supported_audio_path(&path, extensions) {
            let modified_ms = entry
                .metadata()
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as i64);
            let text = path.to_string_lossy().to_string();
            files.insert(normalized_path_key(&text), (text, modified_ms));
        }
    }
}

fn default_audio_extensions() -> HashSet<String> {
    [
        ".flac", ".mp3", ".m4a", ".ogg", ".opus", ".wav", ".aiff", ".aif",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

#[tauri::command]
pub fn native_library_reconcile_preview(
    _state: State<'_, NativeLibraryState>,
    paths: Vec<String>,
    extensions: Option<Vec<String>>,
    sample_limit: Option<usize>,
) -> Result<NativeLibraryReconcilePreview, String> {
    let started = SystemTime::now();
    let sample_limit = sample_limit.unwrap_or(25).clamp(1, 200);
    let extensions: HashSet<String> = extensions
        .unwrap_or_default()
        .into_iter()
        .map(|extension| {
            let lower = extension.trim().to_lowercase();
            if lower.starts_with('.') {
                lower
            } else {
                format!(".{lower}")
            }
        })
        .filter(|extension| extension.len() > 1)
        .collect::<HashSet<_>>();
    let extensions = if extensions.is_empty() {
        default_audio_extensions()
    } else {
        extensions
    };
    let mut folders = Vec::new();
    let mut scanned = HashMap::<String, (String, Option<i64>)>::new();
    let mut errors = Vec::new();
    for path in paths {
        let folder = PathBuf::from(path.trim());
        if path.trim().is_empty() {
            continue;
        }
        let folder = folder.canonicalize().unwrap_or(folder);
        if !folder.is_dir() {
            errors.push(format!("{} is not a folder", folder.display()));
            continue;
        }
        folders.push(folder.to_string_lossy().to_string());
        scan_reconcile_folder(&folder, &extensions, &mut scanned, &mut errors);
    }
    if folders.is_empty() {
        return Err("Choose at least one source folder".to_string());
    }

    let connection = open_database()?;
    let rows = {
        let mut statement = connection
            .prepare("SELECT path, file_modified_at FROM tracks")
            .map_err(|error| format!("Could not prepare native reconcile query: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>("path")?,
                    row.get::<_, Option<String>>("file_modified_at")?,
                ))
            })
            .map_err(|error| format!("Could not read native reconcile tracks: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native reconcile tracks: {error}"))?
    };

    let folder_paths: Vec<PathBuf> = folders.iter().map(PathBuf::from).collect();
    let mut database_tracks = 0i64;
    let mut missing_tracks = 0i64;
    let mut modified_tracks = 0i64;
    let mut sample_missing_tracks = Vec::new();
    let mut sample_modified_tracks = Vec::new();
    let mut known_keys = HashSet::new();
    for (track_path, modified_text) in rows {
        let in_scope = folder_paths
            .iter()
            .any(|folder| path_under_source(&track_path, folder));
        if !in_scope {
            continue;
        }
        database_tracks += 1;
        let key = normalized_path_key(&track_path);
        known_keys.insert(key.clone());
        if let Some((_, scanned_modified_ms)) = scanned.get(&key) {
            if let (Some(stored), Some(scanned_ms)) =
                (modified_text.as_deref(), scanned_modified_ms)
            {
                if let Ok(stored_seconds) = stored.parse::<f64>() {
                    let stored_ms = (stored_seconds * 1000.0).round() as i64;
                    if (stored_ms - scanned_ms).abs() > 1500 {
                        modified_tracks += 1;
                        if sample_modified_tracks.len() < sample_limit {
                            sample_modified_tracks.push(track_path.clone());
                        }
                    }
                }
            }
        } else {
            missing_tracks += 1;
            if sample_missing_tracks.len() < sample_limit {
                sample_missing_tracks.push(track_path.clone());
            }
        }
    }
    let sample_new_files: Vec<String> = scanned
        .iter()
        .filter_map(|(key, (path, _))| {
            if known_keys.contains(key) {
                None
            } else {
                Some(path.clone())
            }
        })
        .take(sample_limit)
        .collect();
    let new_files = scanned
        .keys()
        .filter(|key| !known_keys.contains(*key))
        .count() as i64;
    let elapsed_ms = started
        .elapsed()
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    Ok(NativeLibraryReconcilePreview {
        folders,
        scanned_files: scanned.len() as i64,
        database_tracks,
        new_files,
        missing_tracks,
        modified_tracks,
        sample_new_files,
        sample_missing_tracks,
        sample_modified_tracks,
        elapsed_ms,
        errors,
    })
}

pub(super) fn normalized_path_key(path: &str) -> String {
    let candidate = PathBuf::from(path.trim());
    let resolved = candidate.canonicalize().unwrap_or(candidate);
    resolved.to_string_lossy().to_lowercase()
}

fn path_under_source(path: &str, source: &Path) -> bool {
    let source_key = source.to_string_lossy().to_lowercase();
    let path_key = normalized_path_key(path);
    path_key == source_key
        || path_key.starts_with(&format!("{source_key}\\"))
        || path_key.starts_with(&format!("{source_key}/"))
}

fn read_library_paths(connection: &Connection) -> Vec<String> {
    let raw: Option<String> = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'library_paths_json'",
            [],
            |row| row.get(0),
        )
        .ok();
    if let Some(raw) = raw {
        if let Ok(decoded) = serde_json::from_str::<Vec<String>>(&raw) {
            return decoded
                .into_iter()
                .filter(|path| !path.trim().is_empty())
                .collect();
        }
    }
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'library_path'",
            [],
            |row| row.get(0),
        )
        .ok()
        .into_iter()
        .collect()
}

fn select_tracks_by_ids_or_limit(
    connection: &Connection,
    track_ids: Option<Vec<i64>>,
    limit: usize,
) -> Result<Vec<NativeTrack>, String> {
    let bounded_limit = limit.clamp(1, 20_000);
    if let Some(ids) = track_ids.filter(|ids| !ids.is_empty()) {
        let placeholders = vec!["?"; ids.len()].join(",");
        let mut params: Vec<Value> = ids.into_iter().map(Value::Integer).collect();
        params.push(Value::Integer(bounded_limit as i64));
        let mut statement = connection
            .prepare(&format!(
                "SELECT {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders}) ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), coalesce(disc_number, 0), coalesce(track_number, 0), lower(coalesce(title, '')) LIMIT ?"
            ))
            .map_err(|error| format!("Could not prepare native selected track query: {error}"))?;
        let rows = statement
            .query_map(params_from_iter(params), track_from_row)
            .map_err(|error| format!("Could not read native selected tracks: {error}"))?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native selected tracks: {error}"));
    }
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE {music_filter} ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), coalesce(disc_number, 0), coalesce(track_number, 0), lower(coalesce(title, '')) LIMIT ?",
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare native track query: {error}"))?;
    let rows = statement
        .query_map(params![bounded_limit as i64], track_from_row)
        .map_err(|error| format!("Could not read native tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native tracks: {error}"))
}

fn file_path_root(path: &str) -> String {
    Path::new(path)
        .parent()
        .and_then(Path::parent)
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            Path::new(path)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default()
        })
}

fn file_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

fn file_extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string()
}

fn safe_component(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '_'
            } else {
                character
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "Unknown".to_string()
    } else {
        trimmed.to_string()
    }
}

fn padded_number(value: Option<i64>) -> String {
    value
        .map(|number| format!("{number:02}"))
        .unwrap_or_else(|| "00".to_string())
}

fn organization_target_path(template: &str, base_folder: &Path, track: &NativeTrack) -> PathBuf {
    let ext = file_extension(&track.path);
    let fallback_title = file_stem(&track.path);
    let mut relative = template.to_string();
    let replacements = [
        (
            "{artist}",
            safe_component(track.artist.as_deref().unwrap_or("Unknown Artist")),
        ),
        (
            "{album_artist}",
            safe_component(
                track
                    .album_artist
                    .as_deref()
                    .or(track.artist.as_deref())
                    .unwrap_or("Unknown Artist"),
            ),
        ),
        (
            "{album}",
            safe_component(track.album.as_deref().unwrap_or("Unknown Album")),
        ),
        (
            "{title}",
            safe_component(track.title.as_deref().unwrap_or(&fallback_title)),
        ),
        ("{track_number}", padded_number(track.track_number)),
        ("{disc_number}", padded_number(track.disc_number)),
        (
            "{genre}",
            safe_component(track.genre.as_deref().unwrap_or("Unknown Genre")),
        ),
        (
            "{year}",
            track
                .year
                .map(|year| year.to_string())
                .unwrap_or_else(|| "Unknown Year".to_string()),
        ),
        ("{ext}", safe_component(&ext)),
    ];
    for (token, value) in replacements {
        relative = relative.replace(token, &value);
    }
    let mut target = base_folder.join(relative.replace('\\', "/"));
    if target.extension().is_none() && !ext.is_empty() {
        target.set_extension(ext);
    }
    target
}

fn remove_empty_parent_folders(source_parent: &Path, stop_at: Option<&Path>) -> i64 {
    let stop_key = stop_at.map(|path| normalized_path_key(&path.to_string_lossy()));
    let mut removed = 0i64;
    let mut cursor = source_parent.to_path_buf();
    loop {
        if cursor.as_os_str().is_empty() {
            break;
        }
        let cursor_key = normalized_path_key(&cursor.to_string_lossy());
        if stop_key.as_ref().is_some_and(|key| &cursor_key == key) {
            break;
        }
        if std::fs::remove_dir(&cursor).is_ok() {
            removed += 1;
        } else {
            break;
        }
        if !cursor.pop() {
            break;
        }
    }
    removed
}

fn clear_library_query_cache(connection: &Connection) {
    let _ = connection.execute("DELETE FROM library_query_cache", []);
}

fn album_tracks_by_id(connection: &Connection, album_id: i64) -> Result<Vec<NativeTrack>, String> {
    let album = connection
        .query_row(
            "SELECT album, album_artist FROM albums WHERE id = ?",
            params![album_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .map_err(|error| format!("Could not find album: {error}"))?;
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {TRACK_COLUMNS}
            FROM tracks
            WHERE album_id IN (
                SELECT id
                FROM albums
                WHERE lower(trim(coalesce(album, ''))) = lower(trim(coalesce(?, '')))
                  AND lower(trim(coalesce(album_artist, ''))) = lower(trim(coalesce(?, '')))
            )
            ORDER BY coalesce(disc_number, 0) ASC,
                     coalesce(track_number, 0) ASC,
                     lower(coalesce(title, '')) ASC,
                     id ASC
            "#
        ))
        .map_err(|error| format!("Could not prepare native album tracks query: {error}"))?;
    let rows = statement
        .query_map(params![album.0, album.1], track_from_row)
        .map_err(|error| format!("Could not read native album tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native album tracks: {error}"))
}

#[tauri::command]
pub fn native_library_health(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<NativeLibraryHealthResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(300).clamp(1, 2000);
    let all_tracks = select_tracks_by_ids_or_limit(&connection, None, 100_000)?;
    let mut missing_files = Vec::new();
    for track in &all_tracks {
        if !Path::new(&track.path).exists() {
            missing_files.push(track.clone());
            if missing_files.len() >= limit {
                break;
            }
        }
    }

    let missing_metadata_query = format!(
        "SELECT {TRACK_COLUMNS} FROM tracks WHERE {music_filter} AND (title IS NULL OR trim(title) = '' OR artist IS NULL OR trim(artist) = '' OR album IS NULL OR trim(album) = '' OR ((genre IS NULL OR trim(genre) = '') AND (analysis_genre IS NULL OR trim(analysis_genre) = ''))) ORDER BY date_added DESC LIMIT ?",
        music_filter = music_only_clause()
    );
    let missing_metadata_total: i64 = connection
        .query_row(
            &format!(
                "SELECT count(*) FROM tracks WHERE {music_filter} AND (title IS NULL OR trim(title) = '' OR artist IS NULL OR trim(artist) = '' OR album IS NULL OR trim(album) = '' OR ((genre IS NULL OR trim(genre) = '') AND (analysis_genre IS NULL OR trim(analysis_genre) = '')))",
                music_filter = music_only_clause()
            ),
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let mut statement = connection
        .prepare(&missing_metadata_query)
        .map_err(|error| format!("Could not prepare native missing metadata query: {error}"))?;
    let missing_metadata = statement
        .query_map(params![limit as i64], track_from_row)
        .map_err(|error| format!("Could not read native missing metadata: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native missing metadata: {error}"))?;

    let unrated_query = format!(
        "SELECT {TRACK_COLUMNS} FROM tracks WHERE {music_filter} AND rating IS NULL ORDER BY date_added DESC LIMIT ?",
        music_filter = music_only_clause()
    );
    let mut unrated_statement = connection
        .prepare(&unrated_query)
        .map_err(|error| format!("Could not prepare native unrated query: {error}"))?;
    let unrated_tracks = unrated_statement
        .query_map(params![limit as i64], track_from_row)
        .map_err(|error| format!("Could not read native unrated tracks: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native unrated tracks: {error}"))?;

    let mut groups: HashMap<String, Vec<NativeTrack>> = HashMap::new();
    for track in all_tracks {
        let title = normalize_token(track.title.as_deref());
        let artist = normalize_token(track.artist.as_deref());
        if title.is_empty() || artist.is_empty() {
            continue;
        }
        groups
            .entry(format!("{artist} - {title}"))
            .or_default()
            .push(track);
    }
    let duplicate_group_total = groups.values().filter(|tracks| tracks.len() > 1).count() as i64;
    let mut duplicate_groups = Vec::new();
    for (key, mut tracks) in groups.into_iter().filter(|(_, tracks)| tracks.len() > 1) {
        tracks.sort_by(|left, right| {
            right
                .bitrate
                .unwrap_or(0)
                .cmp(&left.bitrate.unwrap_or(0))
                .then_with(|| {
                    right
                        .rating
                        .unwrap_or(0.0)
                        .total_cmp(&left.rating.unwrap_or(0.0))
                })
        });
        let recommended_keep_id = tracks.first().map(|track| track.id);
        let durations: Vec<f64> = tracks
            .iter()
            .filter_map(|track| track.duration_seconds)
            .collect();
        let duration_spread_seconds = if durations.len() >= 2 {
            Some(
                durations.iter().copied().fold(f64::NEG_INFINITY, f64::max)
                    - durations.iter().copied().fold(f64::INFINITY, f64::min),
            )
        } else {
            None
        };
        let bitrates: Vec<i64> = tracks.iter().filter_map(|track| track.bitrate).collect();
        let bitrate_spread = if bitrates.len() >= 2 {
            Some(bitrates.iter().max().unwrap_or(&0) - bitrates.iter().min().unwrap_or(&0))
        } else {
            None
        };
        let fingerprints: HashSet<String> = tracks
            .iter()
            .filter_map(|track| track.audio_fingerprint.clone())
            .filter(|value| !value.trim().is_empty())
            .collect();
        let acoustic_fingerprints: HashSet<String> = tracks
            .iter()
            .filter_map(|track| track.acoustic_fingerprint.clone())
            .filter(|value| !value.trim().is_empty())
            .collect();
        let path_roots: HashSet<String> = tracks
            .iter()
            .map(|track| file_path_root(&track.path))
            .collect();
        let analyzed_tracks = tracks
            .iter()
            .filter(|track| {
                track
                    .analysis_embedding
                    .as_deref()
                    .is_some_and(|value| !value.is_empty())
            })
            .count() as i64;
        duplicate_groups.push(NativeDuplicateGroup {
            ignore_key: format!("native:{key}"),
            key,
            tracks,
            match_reason: "same normalized artist and title".to_string(),
            recommended_keep_id,
            recommendation_reason: Some("highest bitrate/rating".to_string()),
            duration_spread_seconds,
            bitrate_spread,
            shared_fingerprint: fingerprints.len() == 1 && !fingerprints.is_empty(),
            shared_acoustic_fingerprint: acoustic_fingerprints.len() == 1
                && !acoustic_fingerprints.is_empty(),
            average_audio_similarity: None,
            path_roots: path_roots.into_iter().collect(),
            analyzed_tracks,
        });
        if duplicate_groups.len() >= limit {
            break;
        }
    }

    let ignored_duplicate_group_total = connection
        .query_row(
            "SELECT count(*) FROM library_health_ignores WHERE kind = 'duplicate'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);
    Ok(NativeLibraryHealthResponse {
        missing_files,
        missing_metadata,
        duplicate_groups,
        unrated_tracks,
        missing_metadata_total,
        duplicate_group_total,
        ignored_duplicate_group_total,
    })
}

fn duplicate_group_from_native_tracks(
    key: String,
    mut tracks: Vec<NativeTrack>,
) -> NativeDuplicateGroup {
    tracks.sort_by(|left, right| {
        right
            .bitrate
            .unwrap_or(0)
            .cmp(&left.bitrate.unwrap_or(0))
            .then_with(|| {
                right
                    .rating
                    .unwrap_or(0.0)
                    .total_cmp(&left.rating.unwrap_or(0.0))
            })
    });
    let recommended_keep_id = tracks.first().map(|track| track.id);
    let durations: Vec<f64> = tracks
        .iter()
        .filter_map(|track| track.duration_seconds)
        .collect();
    let duration_spread_seconds = if durations.len() >= 2 {
        Some(
            durations.iter().copied().fold(f64::NEG_INFINITY, f64::max)
                - durations.iter().copied().fold(f64::INFINITY, f64::min),
        )
    } else {
        None
    };
    let bitrates: Vec<i64> = tracks.iter().filter_map(|track| track.bitrate).collect();
    let bitrate_spread = if bitrates.len() >= 2 {
        Some(bitrates.iter().max().unwrap_or(&0) - bitrates.iter().min().unwrap_or(&0))
    } else {
        None
    };
    let fingerprints: HashSet<String> = tracks
        .iter()
        .filter_map(|track| track.audio_fingerprint.clone())
        .filter(|value| !value.trim().is_empty())
        .collect();
    let acoustic_fingerprints: HashSet<String> = tracks
        .iter()
        .filter_map(|track| track.acoustic_fingerprint.clone())
        .filter(|value| !value.trim().is_empty())
        .collect();
    let path_roots: HashSet<String> = tracks
        .iter()
        .map(|track| file_path_root(&track.path))
        .collect();
    let analyzed_tracks = tracks
        .iter()
        .filter(|track| {
            track
                .analysis_embedding
                .as_deref()
                .is_some_and(|value| !value.is_empty())
        })
        .count() as i64;
    let mut similarity_total = 0.0f64;
    let mut similarity_pairs = 0i64;
    for left_index in 0..tracks.len() {
        for right_index in (left_index + 1)..tracks.len() {
            if let Some(score) = cosine_similarity(
                tracks[left_index].analysis_embedding.as_deref(),
                tracks[right_index].analysis_embedding.as_deref(),
            ) {
                similarity_total += score;
                similarity_pairs += 1;
            }
        }
    }
    let average_audio_similarity = if similarity_pairs > 0 {
        Some((similarity_total / similarity_pairs as f64 * 10_000.0).round() / 10_000.0)
    } else {
        None
    };
    NativeDuplicateGroup {
        ignore_key: format!("native:{key}"),
        key,
        tracks,
        match_reason: "same normalized artist and title".to_string(),
        recommended_keep_id,
        recommendation_reason: Some("highest bitrate/rating".to_string()),
        duration_spread_seconds,
        bitrate_spread,
        shared_fingerprint: fingerprints.len() == 1 && !fingerprints.is_empty(),
        shared_acoustic_fingerprint: acoustic_fingerprints.len() == 1
            && !acoustic_fingerprints.is_empty(),
        average_audio_similarity,
        path_roots: path_roots.into_iter().collect(),
        analyzed_tracks,
    }
}

fn tracks_by_id_map(
    connection: &Connection,
    ids: &[i64],
) -> Result<(HashMap<i64, NativeTrack>, Vec<i64>), String> {
    if ids.is_empty() {
        return Ok((HashMap::new(), Vec::new()));
    }
    let placeholders = vec!["?"; ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| {
            format!("Could not prepare native duplicate review track query: {error}")
        })?;
    let rows = statement
        .query_map(params_from_iter(ids.iter()), track_from_row)
        .map_err(|error| format!("Could not read native duplicate review tracks: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native duplicate review tracks: {error}"))?;
    let map: HashMap<i64, NativeTrack> =
        tracks.into_iter().map(|track| (track.id, track)).collect();
    let missing = ids
        .iter()
        .copied()
        .filter(|id| !map.contains_key(id))
        .collect();
    Ok((map, missing))
}

#[tauri::command]
pub fn native_duplicate_review(
    _state: State<'_, NativeLibraryState>,
    track_ids: Option<Vec<i64>>,
    groups: Option<Vec<Vec<i64>>>,
    limit: Option<usize>,
) -> Result<NativeDuplicateReviewResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(300).clamp(1, 2_000);
    let requested_groups = groups.unwrap_or_default();
    let mut requested_ids: Vec<i64> = track_ids.unwrap_or_default();
    for group in &requested_groups {
        requested_ids.extend(group.iter().copied());
    }
    requested_ids.retain(|id| *id > 0);
    requested_ids.sort_unstable();
    requested_ids.dedup();

    let (track_map, missing_track_ids) = tracks_by_id_map(&connection, &requested_ids)?;
    let mut tracks: Vec<NativeTrack> = track_map.values().cloned().collect();
    tracks.sort_by(|left, right| left.id.cmp(&right.id));

    let mut duplicate_groups = Vec::new();
    if !requested_groups.is_empty() {
        for group in requested_groups {
            let group_tracks: Vec<NativeTrack> = group
                .into_iter()
                .filter_map(|id| track_map.get(&id).cloned())
                .collect();
            if group_tracks.len() >= 2 {
                let key = group_tracks
                    .first()
                    .and_then(|track| {
                        Some(format!(
                            "{} - {}",
                            track.artist.as_deref().unwrap_or("Unknown Artist"),
                            track.title.as_deref().unwrap_or("Untitled")
                        ))
                    })
                    .unwrap_or_else(|| "Selected duplicate group".to_string());
                duplicate_groups.push(duplicate_group_from_native_tracks(key, group_tracks));
            }
        }
    } else {
        let source_tracks = if tracks.is_empty() {
            let mut statement = connection
                .prepare(&format!(
                    "SELECT {TRACK_COLUMNS} FROM tracks WHERE {music_filter} ORDER BY lower(coalesce(artist, '')), lower(coalesce(title, '')) LIMIT ?",
                    music_filter = music_only_clause()
                ))
                .map_err(|error| format!("Could not prepare native duplicate candidate query: {error}"))?;
            let rows = statement
                .query_map(params![limit as i64], track_from_row)
                .map_err(|error| format!("Could not read native duplicate candidates: {error}"))?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|error| {
                    format!("Could not decode native duplicate candidates: {error}")
                })?;
            rows
        } else {
            tracks.clone()
        };
        let mut grouped: HashMap<String, Vec<NativeTrack>> = HashMap::new();
        for track in source_tracks {
            let title = normalize_token(track.title.as_deref());
            let artist = normalize_token(track.artist.as_deref());
            if title.is_empty() || artist.is_empty() {
                continue;
            }
            grouped
                .entry(format!("{artist} - {title}"))
                .or_default()
                .push(track);
        }
        for (key, group_tracks) in grouped.into_iter().filter(|(_, tracks)| tracks.len() >= 2) {
            duplicate_groups.push(duplicate_group_from_native_tracks(key, group_tracks));
            if duplicate_groups.len() >= limit {
                break;
            }
        }
    }

    Ok(NativeDuplicateReviewResponse {
        tracks,
        groups: duplicate_groups,
        missing_track_ids,
    })
}

fn duplicate_action_batch_id(prefix: &str) -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("{prefix}-{stamp}")
}

fn resolve_json_tool_output_path(path: Option<String>, default_name: String) -> PathBuf {
    let trimmed = path.as_deref().map(str::trim).unwrap_or_default();
    let mut target = if trimmed.is_empty() {
        app_storage_root().join("exports").join(default_name)
    } else {
        let candidate = PathBuf::from(trimmed);
        if candidate.is_absolute() {
            candidate
        } else {
            app_storage_root().join("exports").join(candidate)
        }
    };
    if target
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| !extension.eq_ignore_ascii_case("json"))
        .unwrap_or(true)
    {
        target.set_extension("json");
    }
    target
}

fn remove_duplicate_tracks_from_library(
    connection: &Connection,
    track_ids: Vec<i64>,
    batch_id: &str,
) -> Result<(Vec<i64>, Vec<String>), String> {
    let mut unique_ids = Vec::new();
    for track_id in track_ids.into_iter().filter(|track_id| *track_id > 0) {
        if !unique_ids.contains(&track_id) {
            unique_ids.push(track_id);
        }
    }
    if unique_ids.is_empty() {
        return Ok((Vec::new(), Vec::new()));
    }
    const REMOVE_COLUMNS: &[&str] = &[
        "path_key",
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
    let placeholders = vec!["?"; unique_ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare duplicate removal query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(unique_ids.iter()), |row| {
            row_to_json_object(row, REMOVE_COLUMNS)
        })
        .map_err(|error| format!("Could not read duplicate removal tracks: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode duplicate removal tracks: {error}"))?;
    let by_id = rows
        .into_iter()
        .filter_map(|track| {
            track
                .get("id")
                .and_then(serde_json::Value::as_i64)
                .map(|id| (id, track))
        })
        .collect::<HashMap<_, _>>();
    let mut removed = Vec::new();
    let mut errors = Vec::new();
    for track_id in unique_ids {
        let Some(track) = by_id.get(&track_id) else {
            errors.push(format!("Track {track_id} was not found"));
            continue;
        };
        let summary = track
            .get("title")
            .and_then(serde_json::Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .or_else(|| track.get("path").and_then(serde_json::Value::as_str))
            .unwrap_or("track");
        let payload = json!({"track": track, "delete_file": false});
        connection
            .execute(
                "INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
                 VALUES(?, 'track_remove', ?, ?)",
                params![batch_id, format!("Removed {summary}"), payload.to_string()],
            )
            .map_err(|error| format!("Could not write duplicate removal undo log: {error}"))?;
        if let Some(path_key) = track.get("path_key").and_then(serde_json::Value::as_str) {
            let _ = connection.execute(
                "DELETE FROM track_metadata_cache WHERE path_key = ?",
                params![path_key],
            );
            let _ = connection.execute(
                "DELETE FROM artwork_cache WHERE path_key = ?",
                params![path_key],
            );
        }
        connection
            .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
            .map_err(|error| format!("Could not remove duplicate track {track_id}: {error}"))?;
        removed.push(track_id);
    }
    if !removed.is_empty() {
        scan::cleanup_orphan_albums(connection)?;
        clear_library_query_cache(connection);
    }
    Ok((removed, errors))
}

pub fn native_duplicate_action(
    state: State<'_, NativeLibraryState>,
    action: String,
    track_ids: Option<Vec<i64>>,
    groups: Option<Vec<Vec<i64>>>,
    report_path: Option<String>,
    ignore_key: Option<String>,
    ignore_label: Option<String>,
) -> Result<NativeDuplicateActionResponse, String> {
    let action = action.trim().to_string();
    let track_ids = track_ids.unwrap_or_default();
    let groups = groups.unwrap_or_default();
    match action.as_str() {
        "clear_ignored" => {
            let connection = open_database()?;
            let affected = connection
                .execute(
                    "DELETE FROM library_health_ignores WHERE kind = 'duplicate'",
                    [],
                )
                .map_err(|error| format!("Could not clear duplicate ignores: {error}"))?
                as i64;
            Ok(NativeDuplicateActionResponse {
                action,
                affected,
                removed_track_ids: Vec::new(),
                deleted_files: 0,
                report_path: None,
                errors: Vec::new(),
            })
        }
        "ignore" => {
            let connection = open_database()?;
            let mut errors = Vec::new();
            let mut ignore_key = ignore_key
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
            if ignore_key.is_none() && !track_ids.is_empty() {
                let (track_map, missing) = tracks_by_id_map(&connection, &track_ids)?;
                errors.extend(
                    missing
                        .into_iter()
                        .map(|track_id| format!("Track {track_id} was not found")),
                );
                let tracks = track_map.into_values().collect::<Vec<_>>();
                if tracks.len() >= 2 {
                    let label = ignore_label
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .unwrap_or("Ignored duplicate group");
                    ignore_key = Some(
                        duplicate_group_from_native_tracks(label.to_string(), tracks).ignore_key,
                    );
                }
            }
            let Some(ignore_key) = ignore_key else {
                return Err("Choose a duplicate group to ignore".to_string());
            };
            let label = ignore_label
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("Ignored duplicate group");
            connection
                .execute(
                    "INSERT INTO library_health_ignores(kind, ignore_key, label)
                     VALUES('duplicate', ?, ?)
                     ON CONFLICT(kind, ignore_key) DO UPDATE SET
                       label = excluded.label,
                       created_at = datetime('now')",
                    params![ignore_key, label],
                )
                .map_err(|error| format!("Could not ignore duplicate group: {error}"))?;
            Ok(NativeDuplicateActionResponse {
                action,
                affected: 1,
                removed_track_ids: Vec::new(),
                deleted_files: 0,
                report_path: None,
                errors,
            })
        }
        "export_report" => {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_secs())
                .unwrap_or(0);
            let target = resolve_json_tool_output_path(
                report_path,
                format!("flac-cafe-duplicates-{stamp}.json"),
            );
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Could not create duplicate report folder {}: {error}",
                        parent.display()
                    )
                })?;
            }
            let selected = track_ids.into_iter().collect::<HashSet<_>>();
            let mut review = native_duplicate_review(state, None, None, Some(500))?;
            if !selected.is_empty() {
                review.groups.retain(|group| {
                    group
                        .tracks
                        .iter()
                        .any(|track| selected.contains(&track.id))
                });
            }
            let payload = json!({
                "generated_at": scan::utc_now(),
                "groups": review.groups,
            });
            let text = serde_json::to_string_pretty(&payload)
                .map_err(|error| format!("Could not encode duplicate report: {error}"))?;
            std::fs::write(&target, text)
                .map_err(|error| format!("Could not write duplicate report: {error}"))?;
            Ok(NativeDuplicateActionResponse {
                action,
                affected: payload
                    .get("groups")
                    .and_then(serde_json::Value::as_array)
                    .map(|groups| groups.len() as i64)
                    .unwrap_or(0),
                removed_track_ids: Vec::new(),
                deleted_files: 0,
                report_path: Some(target.to_string_lossy().to_string()),
                errors: Vec::new(),
            })
        }
        "keep_best" | "remove_selected" => {
            let mut connection = open_database()?;
            let transaction = connection
                .transaction()
                .map_err(|error| format!("Could not start duplicate action: {error}"))?;
            let ids_to_remove = if action == "keep_best" {
                let candidate_groups = if groups.is_empty() && !track_ids.is_empty() {
                    vec![track_ids.clone()]
                } else {
                    groups.clone()
                };
                let mut remove_ids = Vec::new();
                for group in candidate_groups {
                    let unique = group
                        .into_iter()
                        .filter(|track_id| *track_id > 0)
                        .collect::<HashSet<_>>()
                        .into_iter()
                        .collect::<Vec<_>>();
                    if unique.len() < 2 {
                        continue;
                    }
                    let (track_map, _) = tracks_by_id_map(&transaction, &unique)?;
                    let group_tracks = track_map.into_values().collect::<Vec<_>>();
                    let keep_id = duplicate_group_from_native_tracks(
                        "Selected duplicate group".to_string(),
                        group_tracks.clone(),
                    )
                    .recommended_keep_id;
                    remove_ids.extend(
                        group_tracks
                            .into_iter()
                            .filter(|track| Some(track.id) != keep_id)
                            .map(|track| track.id),
                    );
                }
                remove_ids
            } else {
                track_ids.clone()
            };
            let batch_id = duplicate_action_batch_id(if action == "keep_best" {
                "duplicate-keep"
            } else {
                "duplicate-remove"
            });
            let (removed_track_ids, errors) =
                remove_duplicate_tracks_from_library(&transaction, ids_to_remove, &batch_id)?;
            transaction
                .commit()
                .map_err(|error| format!("Could not commit duplicate action: {error}"))?;
            Ok(NativeDuplicateActionResponse {
                action,
                affected: removed_track_ids.len() as i64,
                removed_track_ids,
                deleted_files: 0,
                report_path: None,
                errors,
            })
        }
        _ => Err("Unsupported duplicate action".to_string()),
    }
}

fn metadata_write_field_names(include_metadata: bool, include_rating: bool) -> Vec<&'static str> {
    let mut fields = Vec::new();
    if include_metadata {
        fields.extend([
            "title",
            "artist",
            "album",
            "album_artist",
            "track_number",
            "disc_number",
            "genre",
            "year",
        ]);
    }
    if include_rating {
        fields.push("rating");
    }
    fields
}

fn track_database_file_tag_values(track: &NativeTrack, fields: &[&str]) -> serde_json::Value {
    let mut values = serde_json::Map::new();
    for field in fields {
        let value = match *field {
            "title" => json!(track.title.as_deref()),
            "artist" => json!(track.artist.as_deref()),
            "album" => json!(track.album.as_deref()),
            "album_artist" => json!(track.album_artist.as_deref()),
            "track_number" => json!(track.track_number),
            "disc_number" => json!(track.disc_number),
            "genre" => json!(track.genre.as_deref()),
            "year" => json!(track.year),
            "rating" => json!(track.rating),
            _ => serde_json::Value::Null,
        };
        values.insert((*field).to_string(), value);
    }
    serde_json::Value::Object(values)
}

fn metadata_file_tag_values(metadata: &serde_json::Value, fields: &[&str]) -> serde_json::Value {
    let mut values = serde_json::Map::new();
    for field in fields {
        values.insert(
            (*field).to_string(),
            metadata
                .get(*field)
                .cloned()
                .unwrap_or(serde_json::Value::Null),
        );
    }
    serde_json::Value::Object(values)
}

fn tag_value_is_empty(value: &serde_json::Value) -> bool {
    value.is_null() || value.as_str().is_some_and(|text| text.trim().is_empty())
}

fn tag_values_equal(left: Option<&serde_json::Value>, right: Option<&serde_json::Value>) -> bool {
    let left = left.unwrap_or(&serde_json::Value::Null);
    let right = right.unwrap_or(&serde_json::Value::Null);
    if tag_value_is_empty(left) {
        return tag_value_is_empty(right);
    }
    if tag_value_is_empty(right) {
        return false;
    }
    if left.is_number() || right.is_number() {
        return left
            .as_f64()
            .or_else(|| {
                left.as_str()
                    .and_then(|text| text.trim().parse::<f64>().ok())
            })
            .zip(right.as_f64().or_else(|| {
                right
                    .as_str()
                    .and_then(|text| text.trim().parse::<f64>().ok())
            }))
            .is_some_and(|(left, right)| (left - right).abs() < 0.01);
    }
    let left_text = left
        .as_str()
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| left.to_string());
    let right_text = right
        .as_str()
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| right.to_string());
    left_text.trim().eq_ignore_ascii_case(right_text.trim())
}

fn changed_metadata_write_fields(
    database: &serde_json::Value,
    file: &serde_json::Value,
    fields: &[&str],
) -> Vec<String> {
    fields
        .iter()
        .filter(|field| !tag_values_equal(database.get(**field), file.get(**field)))
        .map(|field| (*field).to_string())
        .collect()
}

pub fn native_track_file_metadata_write_preview(
    track_ids: Option<Vec<i64>>,
    include_metadata: Option<bool>,
    include_rating: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeTrackFileMetadataWriteResponse, String> {
    let include_metadata = include_metadata.unwrap_or(true);
    let include_rating = include_rating.unwrap_or(true);
    if !include_metadata && !include_rating {
        return Err("Choose metadata, ratings, or both to write".to_string());
    }
    let limit = limit.unwrap_or(500).clamp(1, 10_000);
    let connection = open_database()?;
    let (tracks, missing_track_ids) = if let Some(mut ids) = track_ids {
        ids.retain(|id| *id > 0);
        ids.truncate(limit);
        let (track_map, missing) = tracks_by_id_map(&connection, &ids)?;
        let tracks = ids
            .into_iter()
            .filter_map(|id| track_map.get(&id).cloned())
            .collect::<Vec<_>>();
        (tracks, missing)
    } else {
        let mut statement = connection
            .prepare(&format!(
                "SELECT {TRACK_COLUMNS}
                 FROM tracks
                 WHERE {music_filter}
                 ORDER BY datetime(file_modified_at) DESC, id DESC
                 LIMIT ?",
                music_filter = music_only_clause()
            ))
            .map_err(|error| format!("Could not prepare metadata write preview query: {error}"))?;
        let tracks = statement
            .query_map(params![limit as i64], track_from_row)
            .map_err(|error| format!("Could not read metadata write preview tracks: {error}"))?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode metadata write preview tracks: {error}"))?;
        (tracks, Vec::new())
    };
    let fields = metadata_write_field_names(include_metadata, include_rating);
    let files = tracks
        .iter()
        .map(|track| json!({ "path": track.path }))
        .collect::<Vec<_>>();
    let metadata_response = crate::python_worker::call_python_action_json(
        "read_scan_metadata_batch",
        json!({}),
        Some(json!({ "files": files })),
    )?;
    let metadata_by_path = metadata_response
        .get("results")
        .and_then(serde_json::Value::as_array)
        .map(|results| {
            results
                .iter()
                .filter_map(|result| {
                    result
                        .get("path")
                        .and_then(serde_json::Value::as_str)
                        .map(|path| (normalized_path_key(path), result.clone()))
                })
                .collect::<HashMap<_, _>>()
        })
        .unwrap_or_default();

    let mut previews = Vec::new();
    let mut errors = Vec::new();
    for track in tracks {
        let database = track_database_file_tag_values(&track, &fields);
        let mut preview = NativeTrackFileMetadataWritePreview {
            track_id: track.id,
            path: track.path.clone(),
            title: track.title.clone(),
            artist: track.artist.clone(),
            changed_fields: Vec::new(),
            database,
            file: json!({}),
            applied: false,
            error: None,
        };
        let path = PathBuf::from(&track.path);
        if !path.is_file() {
            preview.error = Some("Audio file is missing on disk".to_string());
            errors.push(format!(
                "{}: Audio file is missing on disk",
                track.title.as_deref().unwrap_or(&track.path)
            ));
            previews.push(preview);
            continue;
        }
        let key = normalized_path_key(&track.path);
        let Some(result) = metadata_by_path.get(&key) else {
            preview.error = Some("Metadata worker did not return this file".to_string());
            errors.push(format!(
                "{}: Metadata worker did not return this file",
                track.title.as_deref().unwrap_or(&track.path)
            ));
            previews.push(preview);
            continue;
        };
        if let Some(error) = result.get("error").and_then(serde_json::Value::as_str) {
            preview.error = Some(error.to_string());
            errors.push(format!(
                "{}: {error}",
                track.title.as_deref().unwrap_or(&track.path)
            ));
            previews.push(preview);
            continue;
        }
        let metadata = result.get("metadata").unwrap_or(&serde_json::Value::Null);
        let file = metadata_file_tag_values(metadata, &fields);
        preview.changed_fields = changed_metadata_write_fields(&preview.database, &file, &fields);
        preview.file = file;
        previews.push(preview);
    }
    Ok(NativeTrackFileMetadataWriteResponse {
        total: previews.len() as i64,
        changed: previews
            .iter()
            .filter(|preview| !preview.changed_fields.is_empty())
            .count() as i64,
        applied: 0,
        missing_track_ids,
        errors: errors.into_iter().take(100).collect(),
        previews,
    })
}

fn primary_artist_name(value: &str) -> String {
    let separators = [';', '|'];
    let mut artist = value
        .split(|character| separators.contains(&character))
        .next()
        .unwrap_or(value)
        .trim()
        .to_string();
    let lowered = artist.to_ascii_lowercase();
    for marker in [" feat.", " feat ", " featuring ", " with "] {
        if let Some(index) = lowered.find(marker) {
            artist = artist[..index].trim().to_string();
            break;
        }
    }
    if artist.is_empty() {
        value.trim().to_string()
    } else {
        artist
    }
}

fn artist_cache_key(value: &str) -> String {
    format!("v3:{}", primary_artist_name(value).to_lowercase())
}

#[tauri::command]
pub fn native_artist_info(
    _state: State<'_, NativeLibraryState>,
    name: String,
    refresh: Option<bool>,
) -> Result<NativeArtistInfoResponse, String> {
    let query = primary_artist_name(&name);
    if query.trim().is_empty() {
        return Err("Artist name is required".to_string());
    }
    let connection = open_database()?;
    let refresh = refresh.unwrap_or(false);
    let sql = if refresh {
        "SELECT artist_name, summary, image_url, page_url, source, updated_at
         FROM artist_info_cache
         WHERE artist_key = ?"
    } else {
        "SELECT artist_name, summary, image_url, page_url, source, updated_at
         FROM artist_info_cache
         WHERE artist_key = ? AND updated_at >= datetime('now', '-30 days')"
    };
    connection
        .query_row(sql, params![artist_cache_key(&query)], |row| {
            let summary: Option<String> = row.get("summary")?;
            Ok(NativeArtistInfoResponse {
                artist_name: row
                    .get::<_, Option<String>>("artist_name")?
                    .unwrap_or_else(|| query.clone()),
                query: query.clone(),
                summary: summary.clone(),
                image_url: row.get("image_url")?,
                page_url: row.get("page_url")?,
                source: row.get("source")?,
                found: summary
                    .as_deref()
                    .is_some_and(|value| !value.trim().is_empty()),
                from_cache: true,
                updated_at: row.get("updated_at")?,
                error: None,
            })
        })
        .map_err(|_| "Artist info cache miss".to_string())
}

#[tauri::command]
pub fn native_artist_local_tracks(
    _state: State<'_, NativeLibraryState>,
    name: String,
    limit: Option<usize>,
) -> Result<Vec<NativeTrack>, String> {
    let artist = primary_artist_name(&name);
    if artist.trim().is_empty() {
        return Err("Artist name is required".to_string());
    }
    let limit = limit.unwrap_or(100).clamp(1, 20_000);
    let connection = open_database()?;
    let artist_expr = "
        trim(
          CASE
            WHEN instr(coalesce(tracks.artist, ''), ';') > 0 THEN substr(coalesce(tracks.artist, ''), 1, instr(coalesce(tracks.artist, ''), ';') - 1)
            WHEN instr(coalesce(tracks.artist, ''), '|') > 0 THEN substr(coalesce(tracks.artist, ''), 1, instr(coalesce(tracks.artist, ''), '|') - 1)
            ELSE coalesce(tracks.artist, '')
          END
        )
    ";
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns}
            FROM tracks
            WHERE lower({artist_expr}) = lower(?)
              AND {music_filter}
            ORDER BY coalesce(year, 9999) ASC,
                     lower(coalesce(album, '')) ASC,
                     coalesce(disc_number, 0) ASC,
                     coalesce(track_number, 0) ASC,
                     lower(coalesce(title, '')) ASC
            LIMIT ?
            "#,
            track_columns = TRACK_COLUMNS,
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare native artist track query: {error}"))?;
    let rows = statement
        .query_map(params![artist, limit as i64], track_from_row)
        .map_err(|error| format!("Could not read native artist tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native artist tracks: {error}"))
}

#[tauri::command]
pub fn native_clear_artist_cache(
    _state: State<'_, NativeLibraryState>,
) -> Result<serde_json::Value, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute("DELETE FROM artist_info_cache", [])
        .map_err(|error| format!("Could not clear native artist cache: {error}"))?;
    Ok(json!({ "deleted": deleted as i64 }))
}

#[tauri::command]
pub fn native_file_organization_preview(
    _state: State<'_, NativeLibraryState>,
    template: String,
    base_folder: Option<String>,
    track_ids: Option<Vec<i64>>,
    collision_strategy: Option<String>,
    cleanup_empty_folders: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeFileOrganizationResponse, String> {
    let mut connection = open_database()?;
    let tracks = select_tracks_by_ids_or_limit(
        &connection,
        track_ids,
        limit.unwrap_or(200).clamp(1, 20_000),
    )?;
    let library_root = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'library_path'",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten()
        .map(PathBuf::from);
    let base_folder = base_folder
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            tracks
                .first()
                .and_then(|track| Path::new(&track.path).parent().map(Path::to_path_buf))
        })
        .unwrap_or_else(|| PathBuf::from("."));
    let collision_strategy = collision_strategy.unwrap_or_else(|| "skip".to_string());
    let cleanup_empty_folders = cleanup_empty_folders.unwrap_or(false);
    let apply = apply.unwrap_or(false);
    let mut reserved = HashSet::<String>::new();
    let mut changes = Vec::new();
    let mut applied = 0i64;
    let mut removed_empty_folders = 0i64;
    let batch_id = if apply {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        Some(format!("file-organize-{millis}"))
    } else {
        None
    };
    let transaction = if apply {
        Some(connection.transaction().map_err(|error| {
            format!("Could not start native file organizer transaction: {error}")
        })?)
    } else {
        None
    };
    for track in tracks {
        let mut target = organization_target_path(&template, &base_folder, &track);
        let current_key = normalized_path_key(&track.path);
        let mut target_key = normalized_path_key(&target.to_string_lossy());
        let mut collision = target.exists() && target_key != current_key;
        if collision || reserved.contains(&target_key) {
            collision = true;
            if collision_strategy == "auto_rename" {
                let stem = target
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .unwrap_or("track")
                    .to_string();
                let extension = target
                    .extension()
                    .and_then(|value| value.to_str())
                    .map(str::to_string);
                for index in 1..10_000 {
                    let mut candidate = target.clone();
                    let name = match &extension {
                        Some(extension) if !extension.is_empty() => {
                            format!("{stem} ({index}).{extension}")
                        }
                        _ => format!("{stem} ({index})"),
                    };
                    candidate.set_file_name(name);
                    let key = normalized_path_key(&candidate.to_string_lossy());
                    if !candidate.exists() && !reserved.contains(&key) {
                        target = candidate;
                        target_key = key;
                        break;
                    }
                }
            }
        }
        reserved.insert(target_key.clone());
        let changed = target_key != current_key;
        let source_path = PathBuf::from(&track.path);
        let source_parent = source_path.parent().map(Path::to_path_buf);
        let mut change = NativeFileOrganizationChange {
            track_id: track.id,
            title: track.title.clone(),
            artist: track.artist.clone(),
            current_path: track.path.clone(),
            target_path: target.to_string_lossy().to_string(),
            changed,
            collision,
            applied: false,
            error: None,
        };
        if apply && changed {
            if !source_path.exists() {
                change.error = Some("Source file is missing".to_string());
            } else if collision && collision_strategy == "skip" {
                change.error = Some("Target file already exists".to_string());
            } else {
                if let Some(parent) = target.parent() {
                    if let Err(error) = std::fs::create_dir_all(parent) {
                        change.error = Some(format!("Could not create target folder: {error}"));
                    }
                }
                if change.error.is_none() {
                    match std::fs::rename(&source_path, &target) {
                        Ok(()) => {
                            let modified_unix = target
                                .metadata()
                                .and_then(|metadata| metadata.modified())
                                .ok()
                                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                                .map(|duration| duration.as_secs() as i64);
                            if let Some(transaction) = transaction.as_ref() {
                                match transaction.execute(
                                    "UPDATE tracks
                                     SET path = ?, path_key = ?, file_modified_at = datetime(coalesce(?, strftime('%s','now')), 'unixepoch'), updated_at = datetime('now')
                                     WHERE id = ?",
                                    params![
                                        target.to_string_lossy().to_string(),
                                        normalized_path_key(&target.to_string_lossy()),
                                        modified_unix,
                                        track.id
                                    ],
                                ) {
                                    Ok(_) => {
                                        let _ = transaction.execute(
                                            "DELETE FROM track_metadata_cache WHERE path_key IN (?, ?)",
                                            params![current_key, normalized_path_key(&target.to_string_lossy())],
                                        );
                                        if let Some(batch_id) = &batch_id {
                                            let summary = format!(
                                                "Renamed/reorganized {}",
                                                track.title.as_deref().unwrap_or_else(|| {
                                                    source_path
                                                        .file_name()
                                                        .and_then(|name| name.to_str())
                                                        .unwrap_or("track")
                                                })
                                            );
                                            let payload = json!({
                                                "track_id": track.id,
                                                "from": source_path.to_string_lossy().to_string(),
                                                "to": target.to_string_lossy().to_string(),
                                                "previous_path_key": current_key,
                                                "new_path_key": normalized_path_key(&target.to_string_lossy()),
                                            });
                                            let _ = transaction.execute(
                                                "INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
                                                 VALUES(?, 'file_organization', ?, ?)",
                                                params![batch_id, summary, payload.to_string()],
                                            );
                                        }
                                        change.applied = true;
                                        applied += 1;
                                        if cleanup_empty_folders {
                                            if let Some(source_parent) = source_parent.as_deref() {
                                                removed_empty_folders += remove_empty_parent_folders(
                                                    source_parent,
                                                    library_root.as_deref(),
                                                );
                                            }
                                        }
                                    }
                                    Err(error) => {
                                        change.error =
                                            Some(format!("Could not update moved track in SQLite: {error}"));
                                    }
                                }
                            }
                        }
                        Err(error) => {
                            change.error =
                                Some(format!("Could not rename/reorganize file: {error}"));
                        }
                    }
                }
            }
        }
        changes.push(change);
    }
    if let Some(transaction) = transaction {
        if applied > 0 {
            clear_library_query_cache(&transaction);
        }
        transaction
            .commit()
            .map_err(|error| format!("Could not save native file organizer changes: {error}"))?;
    }
    let changed_count = changes.iter().filter(|change| change.changed).count() as i64;
    Ok(NativeFileOrganizationResponse {
        template,
        base_folder: base_folder.to_string_lossy().to_string(),
        total: changes.len() as i64,
        changes,
        changed_count,
        applied,
        removed_empty_folders,
    })
}

struct ParsedPlaylistEntries {
    entries: Vec<String>,
    local_paths: Vec<PathBuf>,
}

fn read_playlist_text(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path)
        .map_err(|error| format!("Could not read playlist {}: {error}", path.display()))?;
    match String::from_utf8(bytes.clone()) {
        Ok(text) => Ok(text.trim_start_matches('\u{feff}').to_string()),
        Err(_) => Ok(bytes.into_iter().map(char::from).collect()),
    }
}

fn percent_decode_text(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = &input[index + 1..index + 3];
            if let Ok(value) = u8::from_str_radix(hex, 16) {
                output.push(value);
                index += 3;
                continue;
            }
        }
        output.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&output).to_string()
}

fn xml_unescape_text(input: &str) -> String {
    input
        .trim()
        .trim_start_matches("<![CDATA[")
        .trim_end_matches("]]>")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn looks_like_windows_drive_path(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() >= 3 && bytes[1] == b':' && (bytes[2] == b'\\' || bytes[2] == b'/')
}

fn uri_scheme(text: &str) -> Option<String> {
    let colon_index = text.find(':')?;
    if colon_index == 1 && text.as_bytes().first().is_some_and(u8::is_ascii_alphabetic) {
        return None;
    }
    let scheme = &text[..colon_index];
    if scheme
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
    {
        Some(scheme.to_ascii_lowercase())
    } else {
        None
    }
}

fn playlist_entry_path(entry: &str, base_folder: &Path) -> Option<PathBuf> {
    let text = entry.trim().trim_matches('"').trim_matches('\'');
    if text.is_empty() {
        return None;
    }
    if looks_like_windows_drive_path(text) {
        return Some(PathBuf::from(percent_decode_text(text)));
    }
    if text.to_ascii_lowercase().starts_with("file://") {
        let without_scheme = &text[7..];
        let (host, path_part) = if let Some(separator) = without_scheme.find('/') {
            (&without_scheme[..separator], &without_scheme[separator..])
        } else {
            ("", without_scheme)
        };
        let mut decoded = percent_decode_text(path_part);
        if decoded.starts_with('/') && looks_like_windows_drive_path(&decoded[1..]) {
            decoded = decoded[1..].to_string();
        }
        if !host.is_empty() && !host.eq_ignore_ascii_case("localhost") {
            decoded = format!("//{host}{decoded}");
        }
        return Some(PathBuf::from(decoded));
    }
    if let Some(scheme) = uri_scheme(text) {
        if matches!(scheme.as_str(), "http" | "https" | "icy") {
            return None;
        }
        return None;
    }
    let candidate = PathBuf::from(percent_decode_text(text));
    if candidate.is_absolute() {
        Some(candidate)
    } else {
        Some(base_folder.join(candidate))
    }
}

fn playlist_values_from_regex(content: &str, pattern: &str) -> Result<Vec<String>, String> {
    let regex =
        regex::Regex::new(pattern).map_err(|error| format!("Invalid playlist parser: {error}"))?;
    Ok(regex
        .captures_iter(content)
        .filter_map(|capture| {
            capture
                .get(1)
                .map(|value| xml_unescape_text(value.as_str()))
        })
        .filter(|value| !value.trim().is_empty())
        .collect())
}

fn parse_playlist_entries(path: &Path, content: &str) -> Result<ParsedPlaylistEntries, String> {
    let base_folder = path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let suffix = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let entries = match suffix.as_str() {
        "m3u" | "m3u8" => content
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .map(str::to_string)
            .collect::<Vec<_>>(),
        "pls" => content
            .lines()
            .filter_map(|line| {
                let (key, value) = line.split_once('=')?;
                key.trim()
                    .to_ascii_lowercase()
                    .starts_with("file")
                    .then(|| value.trim().to_string())
            })
            .collect::<Vec<_>>(),
        "xspf" => playlist_values_from_regex(
            content,
            r"(?is)<(?:\w+:)?location[^>]*>(.*?)</(?:\w+:)?location>",
        )?,
        "wpl" => {
            let mut values = playlist_values_from_regex(
                content,
                r#"(?is)<(?:\w+:)?media\b[^>]*\bsrc\s*=\s*"([^"]+)""#,
            )?;
            values.extend(playlist_values_from_regex(
                content,
                r#"(?is)<(?:\w+:)?media\b[^>]*\bsrc\s*=\s*'([^']+)'"#,
            )?);
            values
        }
        "xml" => playlist_values_from_regex(
            content,
            r"(?is)<(?:\w+:)?key[^>]*>\s*Location\s*</(?:\w+:)?key>\s*<(?:\w+:)?string[^>]*>(.*?)</(?:\w+:)?string>",
        )?,
        _ => {
            return Err(
                "Supported playlist imports: .m3u, .m3u8, .pls, .xspf, .wpl, and iTunes .xml"
                    .to_string(),
            );
        }
    };
    let local_paths = entries
        .iter()
        .filter_map(|entry| playlist_entry_path(entry, &base_folder))
        .collect();
    Ok(ParsedPlaylistEntries {
        entries,
        local_paths,
    })
}

#[tauri::command]
pub fn native_parse_playlist(playlist_path: String) -> Result<NativePlaylistParseResponse, String> {
    let path = PathBuf::from(playlist_path.trim());
    if !path.is_file() {
        return Err(format!("Playlist file does not exist: {}", path.display()));
    }
    let content = read_playlist_text(&path)?;
    let parsed = parse_playlist_entries(&path, &content)?;
    let base_folder = path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut local_paths = Vec::new();
    let mut errors = Vec::new();
    for resolved in parsed.local_paths {
        if resolved.exists() {
            local_paths.push(resolved.to_string_lossy().to_string());
        } else {
            errors.push(format!("Missing playlist entry: {}", resolved.display()));
        }
    }
    Ok(NativePlaylistParseResponse {
        playlist_path: path.to_string_lossy().to_string(),
        base_folder: base_folder.to_string_lossy().to_string(),
        entries: parsed.entries,
        local_paths,
        errors,
    })
}

pub fn native_import_playlist(
    playlist_path: String,
    name: Option<String>,
) -> Result<NativePlaylistSummary, String> {
    let path = PathBuf::from(playlist_path.trim());
    if !path.is_file() {
        return Err(format!("Playlist file does not exist: {}", path.display()));
    }
    let content = read_playlist_text(&path)?;
    let parsed = parse_playlist_entries(&path, &content)?;
    let base_name = name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            path.file_stem()
                .and_then(|value| value.to_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "Imported Playlist".to_string());
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native playlist import: {error}"))?;
    let mut playlist_name = base_name.clone();
    let mut suffix = 2;
    while transaction
        .query_row(
            "SELECT id FROM playlists WHERE name = ?",
            params![playlist_name],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .is_some()
    {
        playlist_name = format!("{base_name} {suffix}");
        suffix += 1;
    }
    transaction
        .execute(
            "INSERT INTO playlists(name) VALUES(?)",
            params![playlist_name],
        )
        .map_err(|error| format!("Could not create imported playlist: {error}"))?;
    let playlist_id = transaction.last_insert_rowid();

    let keys = parsed
        .local_paths
        .iter()
        .map(|path| normalized_path_key(&path.to_string_lossy()))
        .collect::<Vec<_>>();
    let found_tracks = {
        let mut found = HashMap::new();
        let mut statement = transaction
            .prepare("SELECT id FROM tracks WHERE path_key = ?")
            .map_err(|error| {
                format!("Could not prepare imported playlist track lookup: {error}")
            })?;
        for key in &keys {
            if let Ok(track_id) = statement.query_row(params![key], |row| row.get::<_, i64>(0)) {
                found.insert(key.clone(), track_id);
            }
        }
        found
    };
    let mut position = 0i64;
    for key in keys {
        let Some(track_id) = found_tracks.get(&key).copied() else {
            continue;
        };
        position += 1;
        transaction
            .execute(
                "INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position) VALUES(?, ?, ?)",
                params![playlist_id, track_id, position],
            )
            .map_err(|error| format!("Could not add imported playlist track: {error}"))?;
    }
    compact_native_playlist_positions(&transaction, playlist_id)?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save imported playlist: {error}"))?;
    native_playlist_summary_by_id(&connection, playlist_id)
}

#[tauri::command]
pub fn native_export_m3u(
    playlist_path: String,
    track_paths: Vec<String>,
) -> Result<NativeExportResponse, String> {
    let path = PathBuf::from(playlist_path.trim());
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create playlist folder {}: {error}",
                parent.display()
            )
        })?;
    }
    let mut text = String::from("#EXTM3U\n");
    for track_path in &track_paths {
        text.push_str(track_path);
        text.push('\n');
    }
    std::fs::write(&path, text)
        .map_err(|error| format!("Could not write playlist {}: {error}", path.display()))?;
    Ok(NativeExportResponse {
        playlist_path: path.to_string_lossy().to_string(),
        track_count: track_paths.len() as i64,
    })
}

fn volume_changed(preview: &NativeVolumeTagPreview) -> bool {
    preview.current_track_gain_db != preview.proposed_track_gain_db
        || preview.current_track_peak != preview.proposed_track_peak
        || preview.current_album_gain_db != preview.proposed_album_gain_db
        || preview.current_album_peak != preview.proposed_album_peak
}

#[tauri::command]
pub fn native_volume_tags_preview(
    _state: State<'_, NativeLibraryState>,
    track_ids: Option<Vec<i64>>,
    manual_track_gain_db: Option<f64>,
    manual_track_peak: Option<f64>,
    manual_album_gain_db: Option<f64>,
    manual_album_peak: Option<f64>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<NativeVolumeTagResponse, String> {
    let connection = open_database()?;
    let tracks =
        select_tracks_by_ids_or_limit(&connection, track_ids, limit.unwrap_or(200).clamp(1, 2000))?;
    let mut previews = Vec::new();
    let apply = apply.unwrap_or(false);
    let mut applied = 0i64;
    let mut errors = Vec::new();
    for track in tracks {
        let mut preview = NativeVolumeTagPreview {
            track_id: track.id,
            path: track.path,
            title: track.title,
            artist: track.artist,
            album: track.album,
            current_track_gain_db: track.replaygain_track_gain_db,
            proposed_track_gain_db: manual_track_gain_db.or(track.replaygain_track_gain_db),
            current_track_peak: track.replaygain_track_peak,
            proposed_track_peak: manual_track_peak.or(track.replaygain_track_peak),
            current_album_gain_db: track.replaygain_album_gain_db,
            proposed_album_gain_db: manual_album_gain_db.or(track.replaygain_album_gain_db),
            current_album_peak: track.replaygain_album_peak,
            proposed_album_peak: manual_album_peak.or(track.replaygain_album_peak),
            changed: false,
            applied: false,
            error: None,
        };
        preview.changed = volume_changed(&preview);
        if apply && preview.changed {
            match connection.execute(
                r#"
                UPDATE tracks
                SET replaygain_track_gain_db = ?,
                    replaygain_track_peak = ?,
                    replaygain_album_gain_db = ?,
                    replaygain_album_peak = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                "#,
                params![
                    preview.proposed_track_gain_db,
                    preview.proposed_track_peak,
                    preview.proposed_album_gain_db,
                    preview.proposed_album_peak,
                    preview.track_id
                ],
            ) {
                Ok(_) => {
                    preview.applied = true;
                    applied += 1;
                }
                Err(error) => {
                    let message = format!("{}: {error}", preview.path);
                    preview.error = Some(message.clone());
                    errors.push(message);
                }
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_library_query_cache(&connection);
    }
    let changed = previews.iter().filter(|preview| preview.changed).count() as i64;
    Ok(NativeVolumeTagResponse {
        total: previews.len() as i64,
        changed,
        applied,
        errors,
        previews,
        ffmpeg_path: None,
        checked_paths: Vec::new(),
    })
}

#[tauri::command]
pub fn native_bulk_file_move_preview(
    moves: Vec<(String, String)>,
    apply: Option<bool>,
) -> Result<NativeBulkFileMoveResponse, String> {
    let apply = apply.unwrap_or(false);
    let mut rows = Vec::new();
    let mut applied = 0i64;
    for (source, target) in moves {
        let source_path = PathBuf::from(source.trim());
        let target_path = PathBuf::from(target.trim());
        let changed = normalized_path_key(&source_path.to_string_lossy())
            != normalized_path_key(&target_path.to_string_lossy());
        let mut row = NativeBulkFileMove {
            source_path: source_path.to_string_lossy().to_string(),
            target_path: target_path.to_string_lossy().to_string(),
            changed,
            applied: false,
            error: None,
        };
        if apply && changed {
            if let Some(parent) = target_path.parent() {
                if let Err(error) = std::fs::create_dir_all(parent) {
                    row.error = Some(format!("Could not create {}: {error}", parent.display()));
                }
            }
            if row.error.is_none() {
                match std::fs::rename(&source_path, &target_path) {
                    Ok(()) => {
                        row.applied = true;
                        applied += 1;
                    }
                    Err(error) => row.error = Some(format!("Could not move file: {error}")),
                }
            }
        }
        rows.push(row);
    }
    let changed = rows.iter().filter(|row| row.changed).count() as i64;
    Ok(NativeBulkFileMoveResponse {
        total: rows.len() as i64,
        changed,
        applied,
        moves: rows,
    })
}

fn gapless_shape(track: &NativeTrack) -> NativeGaplessAudioShape {
    let codec = Path::new(&track.path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase());
    let sample_rate = None;
    let estimated_samples = None;
    NativeGaplessAudioShape {
        codec,
        sample_rate,
        channels: None,
        bits_per_sample: None,
        duration_seconds: track.duration_seconds,
        estimated_samples,
        error: None,
    }
}

#[tauri::command]
pub fn native_gapless_validate(
    _state: State<'_, NativeLibraryState>,
    track_ids: Option<Vec<i64>>,
    album_id: Option<i64>,
    limit: Option<usize>,
) -> Result<NativeGaplessValidationResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(200).clamp(2, 1000);
    let tracks = if let Some(album_id) = album_id {
        album_tracks_by_id(&connection, album_id)?
    } else {
        select_tracks_by_ids_or_limit(&connection, track_ids, limit)?
    };
    let tracks: Vec<NativeTrack> = tracks.into_iter().take(limit).collect();
    let mut pairs = Vec::new();
    for window in tracks.windows(2) {
        let left = &window[0];
        let right = &window[1];
        let left_shape = gapless_shape(left);
        let right_shape = gapless_shape(right);
        let metadata_compatible =
            left_shape.codec.is_some() && left_shape.codec == right_shape.codec;
        let lossless_like = matches!(
            left_shape.codec.as_deref(),
            Some("flac" | "wav" | "aiff" | "aif")
        );
        let sample_accurate_ready = metadata_compatible
            && lossless_like
            && left.duration_seconds.is_some()
            && right.duration_seconds.is_some();
        let warnings = if sample_accurate_ready {
            Vec::new()
        } else if !metadata_compatible {
            vec!["Adjacent files use different container/codec extensions.".to_string()]
        } else {
            vec!["Native validation can schedule this pair, but exact sample metadata needs decoder inspection.".to_string()]
        };
        pairs.push(NativeGaplessPairValidation {
            left_track_id: left.id,
            right_track_id: right.id,
            left_title: left.title.clone(),
            right_title: right.title.clone(),
            left_shape,
            right_shape,
            metadata_compatible,
            sample_accurate_ready,
            warnings,
        });
    }
    let sample_accurate_ready_count = pairs
        .iter()
        .filter(|pair| pair.sample_accurate_ready)
        .count() as i64;
    Ok(NativeGaplessValidationResponse {
        track_count: tracks.len() as i64,
        pair_count: pairs.len() as i64,
        sample_accurate_ready_count,
        message: if pairs.is_empty() {
            "Need at least two tracks before validating gapless transitions.".to_string()
        } else if sample_accurate_ready_count == pairs.len() as i64 {
            "Native scheduler sees these transitions as gapless-friendly.".to_string()
        } else {
            "Some adjacent tracks need decoder inspection before claiming sample-accurate gapless playback.".to_string()
        },
        pairs,
    })
}

fn write_setting(connection: &Connection, key: &str, value: Option<&str>) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, value],
    )?;
    Ok(())
}

#[tauri::command]
pub fn native_remove_library_source(
    _state: State<'_, NativeLibraryState>,
    path: String,
) -> Result<NativeLibrarySourceRemoveResponse, String> {
    let mut connection = open_database()?;
    let source = PathBuf::from(path.trim())
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(path.trim()));
    if path.trim().is_empty() {
        return Err("Choose a library source to remove".to_string());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start source removal: {error}"))?;
    let rows = {
        let mut statement = transaction
            .prepare("SELECT id, path, path_key FROM tracks")
            .map_err(|error| format!("Could not read tracks for source removal: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>("id")?,
                    row.get::<_, String>("path")?,
                    row.get::<_, String>("path_key")?,
                ))
            })
            .map_err(|error| format!("Could not query tracks for source removal: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode tracks for source removal: {error}"))?
    };

    let source_rows: Vec<(i64, String, String)> = rows
        .into_iter()
        .filter(|(_, track_path, _)| path_under_source(track_path, &source))
        .collect();
    let mut removed_metadata_cache = 0i64;
    let mut removed_artwork_cache = 0i64;
    for (track_id, _, path_key) in &source_rows {
        removed_metadata_cache += transaction
            .execute(
                "DELETE FROM track_metadata_cache WHERE path_key = ?",
                params![path_key],
            )
            .unwrap_or(0) as i64;
        removed_artwork_cache += transaction
            .execute(
                "DELETE FROM artwork_cache WHERE path_key = ?",
                params![path_key],
            )
            .unwrap_or(0) as i64;
        transaction
            .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
            .map_err(|error| format!("Could not remove source track {track_id}: {error}"))?;
    }
    if !source_rows.is_empty() {
        transaction
            .execute(
                "DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL)",
                [],
            )
            .ok();
        transaction
            .execute("DELETE FROM library_query_cache", [])
            .ok();
    }

    let removed_key = source.to_string_lossy().to_lowercase();
    let remaining_sources: Vec<String> = read_library_paths(&transaction)
        .into_iter()
        .filter(|candidate| normalized_path_key(candidate) != removed_key)
        .collect();
    let primary = remaining_sources.first().map(String::as_str);
    write_setting(&transaction, "library_path", primary)
        .map_err(|error| format!("Could not update library source settings: {error}"))?;
    let paths_json = serde_json::to_string(&remaining_sources).unwrap_or_else(|_| "[]".to_string());
    write_setting(&transaction, "library_paths_json", Some(&paths_json))
        .map_err(|error| format!("Could not update library source settings: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit source removal: {error}"))?;

    let removed_tracks = source_rows.len() as i64;
    Ok(NativeLibrarySourceRemoveResponse {
        path: source.to_string_lossy().to_string(),
        library_paths: remaining_sources,
        removed_tracks,
        removed_metadata_cache,
        removed_artwork_cache,
        message: format!(
            "Removed {removed_tracks} track{} from FLAC Cafe. Audio files were not deleted from disk.",
            if removed_tracks == 1 { "" } else { "s" }
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        parse_playlist_entries, playlist_entry_path, search::search_terms, sort_expression,
    };
    use std::path::Path;

    #[test]
    fn native_search_terms_split_messy_text() {
        assert_eq!(
            search_terms("artist/album: track"),
            vec!["artist", "album", "track"]
        );
    }

    #[test]
    fn native_sort_expression_uses_safe_fallback() {
        assert_eq!(sort_expression("rating"), "coalesce(rating, -1)");
        assert_eq!(
            sort_expression("drop table tracks"),
            "lower(coalesce(artist, ''))"
        );
    }

    #[test]
    fn native_playlist_entry_paths_decode_file_urls() {
        let path = playlist_entry_path("file:///C:/Music/A%20Song.flac", Path::new("."))
            .expect("file url should resolve");
        assert!(path.to_string_lossy().contains("A Song.flac"));
    }

    #[test]
    fn native_playlist_parser_reads_common_formats() {
        let pls = parse_playlist_entries(
            Path::new("mix.pls"),
            "[playlist]\nFile1=one.mp3\nFile2=https://example.test/radio\n",
        )
        .expect("PLS should parse");
        assert_eq!(pls.entries.len(), 2);
        assert_eq!(pls.local_paths.len(), 1);

        let wpl = parse_playlist_entries(
            Path::new("mix.wpl"),
            r#"<smil><media src="two%20words.flac"/><media src='icy://station'/></smil>"#,
        )
        .expect("WPL should parse");
        assert_eq!(wpl.entries.len(), 2);
        assert_eq!(wpl.local_paths.len(), 1);

        let xspf = parse_playlist_entries(
            Path::new("mix.xspf"),
            r#"<playlist><trackList><track><location>file:///C:/Music/Three.flac</location></track></trackList></playlist>"#,
        )
        .expect("XSPF should parse");
        assert_eq!(xspf.local_paths.len(), 1);

        let itunes = parse_playlist_entries(
            Path::new("library.xml"),
            r#"<plist><dict><key>Location</key><string>file:///C:/Music/Four%20Ampersand.flac</string></dict></plist>"#,
        )
        .expect("iTunes XML should parse");
        assert_eq!(itunes.local_paths.len(), 1);
    }
}
