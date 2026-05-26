use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection};
use serde::Serialize;
use serde_json::json;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::env;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Default)]
pub struct NativeLibraryState;

#[derive(Clone, Serialize)]
pub struct NativeTrack {
    id: i64,
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    track_number: Option<i64>,
    disc_number: Option<i64>,
    genre: Option<String>,
    analysis_provider: Option<String>,
    analysis_model: Option<String>,
    analysis_genre: Option<String>,
    analysis_genre_confidence: Option<f64>,
    analysis_genre_tags: Option<String>,
    analysis_embedding: Option<String>,
    analysis_updated_at: Option<String>,
    year: Option<i64>,
    duration_seconds: Option<f64>,
    bitrate: Option<i64>,
    replaygain_track_gain_db: Option<f64>,
    replaygain_album_gain_db: Option<f64>,
    replaygain_track_peak: Option<f64>,
    replaygain_album_peak: Option<f64>,
    audio_fingerprint: Option<String>,
    acoustic_fingerprint: Option<String>,
    acoustic_fingerprint_updated_at: Option<String>,
    rating: Option<f64>,
    play_count: i64,
    skip_count: i64,
    last_played_at: Option<String>,
    last_skipped_at: Option<String>,
    date_added: String,
    file_modified_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTrackPage {
    tracks: Vec<NativeTrack>,
    total: i64,
    limit: usize,
    offset: usize,
    source: String,
}

#[derive(Serialize)]
pub struct NativeStatusResponse {
    status: String,
}

#[derive(Serialize)]
pub struct NativeSettingsResponse {
    library_path: Option<String>,
    library_paths: Vec<String>,
    database_path: String,
    suggested_music_path: Option<String>,
    write_ratings_to_files: bool,
    auto_write_fetched_lyrics_sidecars: bool,
    cd_auto_lookup_metadata: bool,
    acoustid_api_key_configured: bool,
    lastfm_api_credentials_configured: bool,
    lastfm_api_credentials_source: Option<String>,
    extra: serde_json::Value,
}

#[derive(Serialize)]
pub struct NativeTrackBatchResponse {
    tracks: Vec<NativeTrack>,
    missing_ids: Vec<i64>,
}

#[derive(Clone, Serialize)]
pub struct NativeSimilarTrack {
    #[serde(flatten)]
    track: NativeTrack,
    similarity_score: f64,
    similarity_reason: String,
    audio_similarity: Option<f64>,
}

#[derive(Clone, Serialize)]
pub struct NativeAudiobookTrack {
    #[serde(flatten)]
    track: NativeTrack,
    position_seconds: f64,
    progress_percent: f64,
    bookmark_count: i64,
    chapter_count: i64,
    progress_updated_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeAudiobookListResponse {
    total: i64,
    tracks: Vec<NativeAudiobookTrack>,
}

#[derive(Serialize)]
pub struct NativeAudiobookProgressResponse {
    track_id: i64,
    position_seconds: f64,
    duration_seconds: Option<f64>,
    updated_at: String,
}

#[derive(Serialize)]
pub struct NativeAudiobookBookmark {
    id: i64,
    track_id: i64,
    position_seconds: f64,
    label: String,
    note: Option<String>,
    created_at: String,
}

#[derive(Serialize)]
pub struct NativeAudiobookChapter {
    id: Option<i64>,
    track_id: Option<i64>,
    chapter_index: i64,
    title: String,
    start_seconds: f64,
    end_seconds: Option<f64>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeRadioStation {
    id: i64,
    name: String,
    stream_url: String,
    homepage_url: Option<String>,
    genre: Option<String>,
    notes: Option<String>,
    last_played_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
pub struct NativeDeletedResponse {
    deleted: bool,
}

#[derive(Serialize)]
pub struct NativeLovedTrack {
    track_id: i64,
    loved: bool,
    source: String,
    updated_at: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTrackLoveResponse {
    track_id: i64,
    loved: bool,
    source: String,
    updated_at: String,
}

#[derive(Serialize)]
pub struct NativeLibrarySourceRemoveResponse {
    path: String,
    library_paths: Vec<String>,
    removed_tracks: i64,
    removed_metadata_cache: i64,
    removed_artwork_cache: i64,
    message: String,
}

#[derive(Serialize)]
pub struct NativeAlbumSummary {
    id: i64,
    album: Option<String>,
    album_artist: Option<String>,
    year: Option<i64>,
    years: Vec<i64>,
    album_ids: Vec<i64>,
    edition_count: i64,
    artwork_path: Option<String>,
    track_count: i64,
    expected_track_count: Option<i64>,
    missing_track_count: i64,
    duration_seconds: Option<f64>,
    average_rating: Option<f64>,
    artwork_track_id: Option<i64>,
    completion_expected_track_count: Option<i64>,
    completion_source: Option<String>,
    completion_release_id: Option<String>,
    completion_release_title: Option<String>,
    completion_checked_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeArtistSummary {
    name: String,
    track_count: i64,
    album_count: i64,
    duration_seconds: Option<f64>,
    average_rating: Option<f64>,
    play_count: i64,
    skip_count: i64,
    first_year: Option<i64>,
    last_year: Option<i64>,
    artwork_track_id: Option<i64>,
}

#[derive(Serialize)]
pub struct NativePlaylistSummary {
    id: i64,
    name: String,
    track_count: i64,
    duration_seconds: Option<f64>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
pub struct NativePlayEventEntry {
    id: i64,
    track_id: Option<i64>,
    event_type: String,
    timestamp: String,
    metadata: serde_json::Value,
    track: Option<NativeTrack>,
}

#[derive(Serialize)]
pub struct NativeHistoryTrackStat {
    track: NativeTrack,
    play_count: i64,
    skip_count: i64,
    listened_seconds: f64,
}

#[derive(Serialize)]
pub struct NativeHistoryStatsResponse {
    total_play_count: i64,
    total_skip_count: i64,
    total_play_events: i64,
    total_skip_events: i64,
    total_rated_events: i64,
    unique_played_tracks: i64,
    unique_skipped_tracks: i64,
    total_listened_seconds: f64,
    top_played: Vec<NativeHistoryTrackStat>,
    top_skipped: Vec<NativeHistoryTrackStat>,
}

#[derive(Serialize)]
pub struct NativeLibraryStatsResponse {
    total_tracks: i64,
    total_albums: i64,
    total_artists: i64,
    total_playlists: i64,
    rated_tracks: i64,
    unrated_tracks: i64,
    total_duration_seconds: Option<f64>,
    played_events: i64,
    skipped_events: i64,
}

#[derive(Serialize)]
pub struct NativeCacheClearResponse {
    cleared: BTreeMap<String, i64>,
}

#[derive(Serialize)]
pub struct NativeBulkUndoLogEntry {
    id: i64,
    batch_id: Option<String>,
    action_type: String,
    summary: String,
    payload: serde_json::Value,
    created_at: String,
}

#[derive(Serialize)]
pub struct NativeBulkUndoBatchEntry {
    batch_id: String,
    action_type: String,
    entries: i64,
    summary: String,
    first_created_at: String,
    last_created_at: String,
}

#[derive(Serialize)]
pub struct NativeAutoDjAvoidRule {
    id: i64,
    scope: String,
    target_key: String,
    label: String,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Serialize)]
pub struct NativeAutoDjSettings {
    queue_length: usize,
    temperature: f64,
    artist_cooldown: usize,
    album_cooldown: usize,
    unrated_exploration_percent: f64,
    target_unrated_percent: Option<f64>,
    target_exploration_percent: Option<f64>,
    max_repeat_artist_percent: Option<f64>,
    minimum_rating: Option<f64>,
    recently_played_cooldown_days: i64,
    seed_track_id: Option<i64>,
    similarity_weight: f64,
    rating_weight: f64,
    recency_weight: f64,
    skip_weight: f64,
    exploration_weight: f64,
    play_history_weight: f64,
    feedback_weight: f64,
    audio_similarity_weight: f64,
    artist_similarity_weight: f64,
    album_similarity_weight: f64,
    genre_similarity_weight: f64,
    year_similarity_weight: f64,
    rating_similarity_weight: f64,
    seed: Option<i64>,
}

#[derive(Clone, Serialize)]
pub struct NativeQueueTrack {
    #[serde(flatten)]
    track: NativeTrack,
    score: f64,
    reason: String,
    score_breakdown: BTreeMap<String, f64>,
}

#[derive(Clone, Serialize)]
pub struct NativeRecommendationDrift {
    total_tracks: i64,
    familiar_percent: f64,
    exploration_percent: f64,
    repeat_artist_percent: f64,
    unrated_percent: f64,
    clap_percent: f64,
    average_rating: Option<f64>,
    unique_artists: i64,
    unique_albums: i64,
    warnings: Vec<String>,
}

impl Default for NativeRecommendationDrift {
    fn default() -> Self {
        Self {
            total_tracks: 0,
            familiar_percent: 0.0,
            exploration_percent: 0.0,
            repeat_artist_percent: 0.0,
            unrated_percent: 0.0,
            clap_percent: 0.0,
            average_rating: None,
            unique_artists: 0,
            unique_albums: 0,
            warnings: Vec::new(),
        }
    }
}

#[derive(Serialize)]
pub struct NativeAutoDjResponse {
    tracks: Vec<NativeQueueTrack>,
    settings: NativeAutoDjSettings,
    drift: NativeRecommendationDrift,
    source: String,
}

#[derive(Serialize)]
pub struct NativeLibraryReconcilePreview {
    folders: Vec<String>,
    scanned_files: i64,
    database_tracks: i64,
    new_files: i64,
    missing_tracks: i64,
    modified_tracks: i64,
    sample_new_files: Vec<String>,
    sample_missing_tracks: Vec<String>,
    sample_modified_tracks: Vec<String>,
    elapsed_ms: u128,
    errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeDuplicateGroup {
    key: String,
    ignore_key: String,
    tracks: Vec<NativeTrack>,
    match_reason: String,
    recommended_keep_id: Option<i64>,
    recommendation_reason: Option<String>,
    duration_spread_seconds: Option<f64>,
    bitrate_spread: Option<i64>,
    shared_fingerprint: bool,
    shared_acoustic_fingerprint: bool,
    average_audio_similarity: Option<f64>,
    path_roots: Vec<String>,
    analyzed_tracks: i64,
}

#[derive(Serialize)]
pub struct NativeLibraryHealthResponse {
    missing_files: Vec<NativeTrack>,
    missing_metadata: Vec<NativeTrack>,
    duplicate_groups: Vec<NativeDuplicateGroup>,
    unrated_tracks: Vec<NativeTrack>,
    missing_metadata_total: i64,
    duplicate_group_total: i64,
    ignored_duplicate_group_total: i64,
}

#[derive(Serialize)]
pub struct NativeFileOrganizationChange {
    track_id: i64,
    title: Option<String>,
    artist: Option<String>,
    current_path: String,
    target_path: String,
    changed: bool,
    collision: bool,
    applied: bool,
    error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeFileOrganizationResponse {
    template: String,
    base_folder: String,
    total: i64,
    changes: Vec<NativeFileOrganizationChange>,
    changed_count: i64,
    applied: i64,
    removed_empty_folders: i64,
}

#[derive(Serialize)]
pub struct NativePlaylistParseResponse {
    playlist_path: String,
    base_folder: String,
    entries: Vec<String>,
    local_paths: Vec<String>,
    errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeExportResponse {
    playlist_path: String,
    track_count: i64,
}

#[derive(Serialize)]
pub struct NativeVolumeTagPreview {
    track_id: i64,
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    current_track_gain_db: Option<f64>,
    proposed_track_gain_db: Option<f64>,
    current_track_peak: Option<f64>,
    proposed_track_peak: Option<f64>,
    current_album_gain_db: Option<f64>,
    proposed_album_gain_db: Option<f64>,
    current_album_peak: Option<f64>,
    proposed_album_peak: Option<f64>,
    changed: bool,
    applied: bool,
    error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeVolumeTagResponse {
    total: i64,
    changed: i64,
    applied: i64,
    errors: Vec<String>,
    previews: Vec<NativeVolumeTagPreview>,
    ffmpeg_path: Option<String>,
    checked_paths: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeBulkFileMove {
    source_path: String,
    target_path: String,
    changed: bool,
    applied: bool,
    error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeBulkFileMoveResponse {
    total: i64,
    changed: i64,
    applied: i64,
    moves: Vec<NativeBulkFileMove>,
}

#[derive(Serialize)]
pub struct NativeGaplessAudioShape {
    codec: Option<String>,
    sample_rate: Option<i64>,
    channels: Option<i64>,
    bits_per_sample: Option<i64>,
    duration_seconds: Option<f64>,
    estimated_samples: Option<i64>,
    error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeGaplessPairValidation {
    left_track_id: i64,
    right_track_id: i64,
    left_title: Option<String>,
    right_title: Option<String>,
    left_shape: NativeGaplessAudioShape,
    right_shape: NativeGaplessAudioShape,
    metadata_compatible: bool,
    sample_accurate_ready: bool,
    warnings: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeGaplessValidationResponse {
    track_count: i64,
    pair_count: i64,
    sample_accurate_ready_count: i64,
    pairs: Vec<NativeGaplessPairValidation>,
    message: String,
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

fn repo_root() -> Option<PathBuf> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
}

fn local_app_data(app_name: &str) -> Option<PathBuf> {
    env::var_os("LOCALAPPDATA").map(|root| PathBuf::from(root).join(app_name))
}

fn database_path() -> PathBuf {
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

fn open_database() -> Result<Connection, String> {
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

fn get_setting(connection: &Connection, key: &str) -> Option<String> {
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?",
            params![key],
            |row| row.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten()
}

fn set_setting(connection: &Connection, key: &str, value: Option<&str>) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value],
        )
        .map_err(|error| format!("Could not save setting {key}: {error}"))?;
    Ok(())
}

fn truthy_setting(connection: &Connection, key: &str, default_value: bool) -> bool {
    match get_setting(connection, key).as_deref().map(str::trim) {
        Some("1") | Some("true") | Some("True") | Some("yes") | Some("on") => true,
        Some("0") | Some("false") | Some("False") | Some("no") | Some("off") => false,
        _ => default_value,
    }
}

fn suggested_music_path() -> Option<String> {
    env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|path| path.join("Music").to_string_lossy().to_string())
}

fn track_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeTrack> {
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

fn compact_sql_expression(expression: &str) -> String {
    let mut compact = format!("lower({expression})");
    for character in [
        " ", "-", "_", ".", "'", "\"", "/", "\\", "(", ")", "[", "]", "{", "}", ":", ";", ",", "&",
        "+",
    ] {
        let escaped = character.replace('\'', "''");
        compact = format!("replace({compact}, '{escaped}', '')");
    }
    compact
}

fn search_terms(search: &str) -> Vec<String> {
    search
        .split(|character: char| character.is_whitespace() || "/\\,;:_()[]{}|".contains(character))
        .map(|term| term.trim().to_lowercase())
        .filter(|term| !term.is_empty())
        .take(8)
        .collect()
}

fn fuzzy_sql_parts(expression: &str, search: &str) -> (Vec<String>, Vec<Value>) {
    let compact_expression = compact_sql_expression(expression);
    let mut clauses = Vec::new();
    let mut params = Vec::new();
    for term in search_terms(search) {
        let compact_term: String = term
            .chars()
            .filter(|character| character.is_ascii_alphanumeric())
            .collect();
        clauses.push(format!(
            "(lower({expression}) LIKE ? OR {compact_expression} LIKE ?)"
        ));
        params.push(Value::Text(format!("%{term}%")));
        params.push(Value::Text(format!(
            "%{}%",
            if compact_term.is_empty() {
                &term
            } else {
                &compact_term
            }
        )));
    }
    (clauses, params)
}

fn csv_ints(value: Option<String>) -> Vec<i64> {
    let mut values: Vec<i64> = value
        .unwrap_or_default()
        .split(',')
        .filter_map(|item| item.trim().parse::<i64>().ok())
        .collect();
    values.sort_unstable();
    values.dedup();
    values
}

fn number_setting(
    settings: &serde_json::Value,
    key: &str,
    default: f64,
    min: f64,
    max: f64,
) -> f64 {
    settings
        .get(key)
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(default)
        .clamp(min, max)
}

fn int_setting(settings: &serde_json::Value, key: &str, default: i64, min: i64, max: i64) -> i64 {
    settings
        .get(key)
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(default)
        .clamp(min, max)
}

fn optional_number_setting(
    settings: &serde_json::Value,
    key: &str,
    min: f64,
    max: f64,
) -> Option<f64> {
    settings
        .get(key)
        .and_then(serde_json::Value::as_f64)
        .map(|value| value.clamp(min, max))
}

fn optional_int_setting(settings: &serde_json::Value, key: &str) -> Option<i64> {
    settings.get(key).and_then(serde_json::Value::as_i64)
}

fn native_autodj_settings(settings: serde_json::Value) -> NativeAutoDjSettings {
    NativeAutoDjSettings {
        queue_length: int_setting(&settings, "queue_length", 25, 1, 200) as usize,
        temperature: number_setting(&settings, "temperature", 0.8, 0.05, 5.0),
        artist_cooldown: int_setting(&settings, "artist_cooldown", 6, 0, 50) as usize,
        album_cooldown: int_setting(&settings, "album_cooldown", 10, 0, 100) as usize,
        unrated_exploration_percent: number_setting(
            &settings,
            "unrated_exploration_percent",
            12.0,
            0.0,
            80.0,
        ),
        target_unrated_percent: optional_number_setting(
            &settings,
            "target_unrated_percent",
            0.0,
            80.0,
        ),
        target_exploration_percent: optional_number_setting(
            &settings,
            "target_exploration_percent",
            0.0,
            100.0,
        ),
        max_repeat_artist_percent: optional_number_setting(
            &settings,
            "max_repeat_artist_percent",
            0.0,
            95.0,
        ),
        minimum_rating: optional_number_setting(&settings, "minimum_rating", 0.5, 5.0),
        recently_played_cooldown_days: int_setting(
            &settings,
            "recently_played_cooldown_days",
            14,
            0,
            3650,
        ),
        seed_track_id: optional_int_setting(&settings, "seed_track_id"),
        similarity_weight: number_setting(&settings, "similarity_weight", 0.0, 0.0, 5.0),
        rating_weight: number_setting(&settings, "rating_weight", 1.0, 0.0, 5.0),
        recency_weight: number_setting(&settings, "recency_weight", 1.0, 0.0, 5.0),
        skip_weight: number_setting(&settings, "skip_weight", 1.0, 0.0, 5.0),
        exploration_weight: number_setting(&settings, "exploration_weight", 1.0, 0.0, 5.0),
        play_history_weight: number_setting(&settings, "play_history_weight", 0.7, 0.0, 5.0),
        feedback_weight: number_setting(&settings, "feedback_weight", 0.8, 0.0, 5.0),
        audio_similarity_weight: number_setting(
            &settings,
            "audio_similarity_weight",
            2.2,
            0.0,
            5.0,
        ),
        artist_similarity_weight: number_setting(
            &settings,
            "artist_similarity_weight",
            1.6,
            0.0,
            5.0,
        ),
        album_similarity_weight: number_setting(
            &settings,
            "album_similarity_weight",
            0.9,
            0.0,
            5.0,
        ),
        genre_similarity_weight: number_setting(
            &settings,
            "genre_similarity_weight",
            0.85,
            0.0,
            5.0,
        ),
        year_similarity_weight: number_setting(&settings, "year_similarity_weight", 0.45, 0.0, 5.0),
        rating_similarity_weight: number_setting(
            &settings,
            "rating_similarity_weight",
            0.25,
            0.0,
            5.0,
        ),
        seed: optional_int_setting(&settings, "seed"),
    }
}

fn music_only_clause() -> &'static str {
    "
    NOT (
      lower(coalesce(genre, '')) LIKE '%audiobook%'
      OR lower(coalesce(genre, '')) LIKE '%audio book%'
      OR lower(path) LIKE '%audiobook%'
      OR lower(path) LIKE '%audio book%'
      OR lower(path) LIKE '%\\books\\%'
      OR lower(path) LIKE '%/books/%'
    )
    AND NOT (
      lower(coalesce(genre, '')) LIKE '%podcast%'
      OR lower(path) LIKE '%podcast%'
      OR lower(path) LIKE '%\\podcasts\\%'
      OR lower(path) LIKE '%/podcasts/%'
      OR EXISTS (
        SELECT 1
        FROM podcast_episodes
        WHERE podcast_episodes.track_id = tracks.id
           OR (
             podcast_episodes.local_path IS NOT NULL
             AND lower(podcast_episodes.local_path) = lower(tracks.path)
           )
      )
    )
    "
}

fn track_where_clause(search: &str) -> (String, Vec<Value>) {
    let expression = "coalesce(title, '') || ' ' || coalesce(artist, '') || ' ' ||
                    coalesce(album, '') || ' ' || coalesce(album_artist, '') || ' ' ||
                    coalesce(genre, '') || ' ' || coalesce(analysis_genre, '') || ' ' ||
                    coalesce(path, '')";
    let compact_expression = compact_sql_expression(expression);
    let mut clauses = vec![music_only_clause().to_string()];
    let mut params = Vec::new();
    for term in search_terms(search) {
        let compact_term: String = term
            .chars()
            .filter(|character| character.is_ascii_alphanumeric())
            .collect();
        clauses.push(format!(
            "(lower({expression}) LIKE ? OR {compact_expression} LIKE ?)"
        ));
        params.push(Value::Text(format!("%{term}%")));
        params.push(Value::Text(format!(
            "%{}%",
            if compact_term.is_empty() {
                &term
            } else {
                &compact_term
            }
        )));
    }
    (format!("WHERE {}", clauses.join(" AND ")), params)
}

fn sort_expression(sort_by: &str) -> &'static str {
    match sort_by {
        "path" => "lower(coalesce(path, ''))",
        "title" => "lower(coalesce(title, ''))",
        "album" => "lower(coalesce(album, ''))",
        "album_artist" => "lower(coalesce(album_artist, ''))",
        "track_number" => "coalesce(track_number, -1)",
        "disc_number" => "coalesce(disc_number, -1)",
        "genre" => "lower(coalesce(analysis_genre, genre, ''))",
        "analysis_genre" => "lower(coalesce(analysis_genre, ''))",
        "analysis_genre_confidence" => "coalesce(analysis_genre_confidence, -1)",
        "analysis_provider" => "lower(coalesce(analysis_provider, ''))",
        "analysis_updated_at" => "coalesce(analysis_updated_at, '')",
        "year" => "coalesce(year, -1)",
        "bitrate" => "coalesce(bitrate, -1)",
        "rating" => "coalesce(rating, -1)",
        "duration_seconds" => "coalesce(duration_seconds, -1)",
        "play_count" => "coalesce(play_count, 0)",
        "skip_count" => "coalesce(skip_count, 0)",
        "last_played_at" => "coalesce(last_played_at, '')",
        "last_skipped_at" => "coalesce(last_skipped_at, '')",
        "date_added" => "coalesce(date_added, '')",
        "file_modified_at" => "coalesce(file_modified_at, '')",
        _ => "lower(coalesce(artist, ''))",
    }
}

#[tauri::command]
pub fn native_tracks_page(
    _state: State<'_, NativeLibraryState>,
    search: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    sort_by: Option<String>,
    sort_direction: Option<String>,
) -> Result<NativeTrackPage, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(150).clamp(1, 1000);
    let offset = offset.unwrap_or(0);
    let search = search.unwrap_or_default();
    let (where_clause, mut params) = track_where_clause(&search);
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
            |row| {
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
            },
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
        .map_err(|error| format!("Could not prepare native history query: {error}"))?;
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
        .map_err(|error| format!("Could not read native history: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native history: {error}"))
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
        .map_err(|error| format!("Could not read native history totals: {error}"))?;
    let mut event_counts: HashMap<String, i64> = HashMap::new();
    let mut event_statement = connection
        .prepare("SELECT event_type, count(*) AS count FROM play_events GROUP BY event_type")
        .map_err(|error| format!("Could not prepare native history event totals: {error}"))?;
    let event_rows = event_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, Option<String>>("event_type")?
                    .unwrap_or_default(),
                row.get::<_, Option<i64>>("count")?.unwrap_or(0),
            ))
        })
        .map_err(|error| format!("Could not read native history event totals: {error}"))?;
    for row in event_rows {
        let (event_type, count) =
            row.map_err(|error| format!("Could not decode native history event totals: {error}"))?;
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
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {TRACK_COLUMNS},
                   coalesce(duration_seconds, 0) * coalesce(play_count, 0) AS listened_seconds
            FROM tracks
            {clause}
            "#
        ))
        .map_err(|error| format!("Could not prepare native history stats query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], history_track_stat_from_row)
        .map_err(|error| format!("Could not read native history stats: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native history stats: {error}"))
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

fn native_autodj_avoid_rules_for_connection(
    connection: &Connection,
) -> Result<Vec<NativeAutoDjAvoidRule>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, scope, target_key, label, created_at, updated_at
             FROM autodj_avoid_rules
             ORDER BY scope, lower(label)",
        )
        .map_err(|error| format!("Could not prepare native AutoDJ avoid query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(NativeAutoDjAvoidRule {
                id: row.get("id")?,
                scope: row.get::<_, Option<String>>("scope")?.unwrap_or_default(),
                target_key: row
                    .get::<_, Option<String>>("target_key")?
                    .unwrap_or_default(),
                label: row.get::<_, Option<String>>("label")?.unwrap_or_default(),
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Could not read native AutoDJ avoid rules: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native AutoDJ avoid rules: {error}"))
}

fn avoid_key_and_label(
    connection: &Connection,
    scope: &str,
    track_id: Option<i64>,
    value: Option<String>,
) -> Result<(String, String), String> {
    let track = match track_id {
        Some(track_id) => Some(track_by_id(connection, track_id)?),
        None => None,
    };
    let value = value.unwrap_or_default().trim().to_string();
    match scope {
        "track" => {
            let track = track.ok_or_else(|| "Track avoid rules require track_id".to_string())?;
            let label = format!(
                "{} - {}",
                track.title.as_deref().unwrap_or("Untitled"),
                track.artist.as_deref().unwrap_or("Unknown artist")
            );
            Ok((track.id.to_string(), label))
        }
        "artist" => {
            let label = if value.is_empty() {
                track
                    .as_ref()
                    .and_then(|track| track.artist.clone())
                    .unwrap_or_default()
            } else {
                value
            };
            let key = split_artist_tokens(Some(&label))
                .into_iter()
                .min()
                .unwrap_or_else(|| normalize_token(Some(&label)));
            if key.is_empty() {
                return Err("No artist value available".to_string());
            }
            Ok((key, label))
        }
        "album" => {
            let label = if value.is_empty() {
                track
                    .as_ref()
                    .and_then(|track| track.album.clone())
                    .unwrap_or_default()
            } else {
                value
            };
            let key = album_key(Some(&label));
            if key.is_empty() {
                return Err("No album value available".to_string());
            }
            Ok((key, label))
        }
        "genre" => {
            let label = if value.is_empty() {
                track
                    .as_ref()
                    .and_then(|track| track.analysis_genre.clone().or(track.genre.clone()))
                    .unwrap_or_default()
            } else {
                value
            };
            let key = split_text_tokens(Some(&label))
                .into_iter()
                .min()
                .unwrap_or_else(|| normalize_token(Some(&label)));
            if key.is_empty() {
                return Err("No genre value available".to_string());
            }
            Ok((key, label))
        }
        _ => Err("Unsupported AutoDJ avoid scope".to_string()),
    }
}

#[tauri::command]
pub fn native_autodj_avoid_rules(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativeAutoDjAvoidRule>, String> {
    let connection = open_database()?;
    native_autodj_avoid_rules_for_connection(&connection)
}

#[tauri::command]
pub fn native_create_autodj_avoid_rule(
    _state: State<'_, NativeLibraryState>,
    scope: String,
    track_id: Option<i64>,
    value: Option<String>,
) -> Result<NativeAutoDjAvoidRule, String> {
    let mut connection = open_database()?;
    let (key, label) = avoid_key_and_label(&connection, &scope, track_id, value)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native AutoDJ avoid update: {error}"))?;
    transaction
        .execute(
            "INSERT INTO autodj_avoid_rules(scope, target_key, label)
             VALUES(?, ?, ?)
             ON CONFLICT(scope, target_key) DO UPDATE SET label = excluded.label, updated_at = datetime('now')",
            params![scope, key, label],
        )
        .map_err(|error| format!("Could not save native AutoDJ avoid rule: {error}"))?;
    let row = transaction
        .query_row(
            "SELECT id, scope, target_key, label, created_at, updated_at
             FROM autodj_avoid_rules
             WHERE scope = ? AND target_key = ?",
            params![scope, key],
            |row| {
                Ok(NativeAutoDjAvoidRule {
                    id: row.get("id")?,
                    scope: row.get::<_, Option<String>>("scope")?.unwrap_or_default(),
                    target_key: row
                        .get::<_, Option<String>>("target_key")?
                        .unwrap_or_default(),
                    label: row.get::<_, Option<String>>("label")?.unwrap_or_default(),
                    created_at: row
                        .get::<_, Option<String>>("created_at")?
                        .unwrap_or_default(),
                    updated_at: row
                        .get::<_, Option<String>>("updated_at")?
                        .unwrap_or_default(),
                })
            },
        )
        .map_err(|error| format!("Could not read native AutoDJ avoid rule: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save native AutoDJ avoid transaction: {error}"))?;
    Ok(row)
}

#[tauri::command]
pub fn native_delete_autodj_avoid_rule(
    _state: State<'_, NativeLibraryState>,
    rule_id: i64,
) -> Result<Vec<NativeAutoDjAvoidRule>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native AutoDJ avoid delete: {error}"))?;
    transaction
        .execute(
            "DELETE FROM autodj_avoid_rules WHERE id = ?",
            params![rule_id],
        )
        .map_err(|error| format!("Could not delete native AutoDJ avoid rule: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save native AutoDJ avoid delete: {error}"))?;
    native_autodj_avoid_rules_for_connection(&connection)
}

#[derive(Clone)]
struct NativeCandidateTrack {
    track: NativeTrack,
    feedback_score: f64,
    days_since_played: Option<f64>,
    days_since_skipped: Option<f64>,
}

#[derive(Clone)]
struct NativeCandidate {
    item: NativeCandidateTrack,
    score: f64,
    reason: String,
    breakdown: BTreeMap<String, f64>,
    artist_keys: HashSet<String>,
    album_key: String,
    is_unrated: bool,
    is_exploratory: bool,
}

struct NativeRng {
    state: u64,
}

impl NativeRng {
    fn new(seed: Option<i64>) -> Self {
        let fallback = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos() as u64)
            .unwrap_or(0x9e37_79b9_7f4a_7c15);
        Self {
            state: (seed.map(|value| value as u64).unwrap_or(fallback) ^ 0x9e37_79b9_7f4a_7c15)
                .max(1),
        }
    }

    fn next_u64(&mut self) -> u64 {
        let mut value = self.state;
        value ^= value >> 12;
        value ^= value << 25;
        value ^= value >> 27;
        self.state = value;
        value.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / ((1u64 << 53) as f64)
    }

    fn uniform(&mut self, min: f64, max: f64) -> f64 {
        min + (max - min) * self.next_f64()
    }
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

fn round4(value: f64) -> f64 {
    (value * 10000.0).round() / 10000.0
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn normalize_token(value: Option<&str>) -> String {
    value
        .unwrap_or_default()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn split_artist_tokens(value: Option<&str>) -> HashSet<String> {
    let mut cleaned = value.unwrap_or_default().replace('|', ";");
    for marker in [" feat. ", " feat ", " featuring ", " with "] {
        cleaned = cleaned.replace(marker, ";");
    }
    cleaned
        .split(|character| matches!(character, ';' | '/' | ',' | '+' | '&'))
        .map(|part| normalize_token(Some(part)))
        .filter(|part| !part.is_empty())
        .collect()
}

fn split_text_tokens(value: Option<&str>) -> HashSet<String> {
    value
        .unwrap_or_default()
        .split(|character| matches!(character, ';' | '/' | ',' | '|'))
        .map(|part| normalize_token(Some(part)))
        .filter(|part| !part.is_empty())
        .collect()
}

fn album_key(value: Option<&str>) -> String {
    normalize_token(value)
}

fn combined_genre(track: &NativeTrack) -> Option<String> {
    let mut values = Vec::new();
    for value in [&track.genre, &track.analysis_genre] {
        if let Some(value) = value {
            let trimmed = value.trim();
            if !trimmed.is_empty() && !values.iter().any(|existing: &String| existing == trimmed) {
                values.push(trimmed.to_string());
            }
        }
    }
    if values.is_empty() {
        None
    } else {
        Some(values.join("; "))
    }
}

fn base_rating_score(rating: Option<f64>) -> f64 {
    let Some(value) = rating else {
        return 0.2;
    };
    let anchors = [
        (0.5, -4.8),
        (1.0, -4.0),
        (2.0, -1.4),
        (3.0, 0.35),
        (4.0, 1.3),
        (5.0, 2.15),
    ];
    for window in anchors.windows(2) {
        let (left_rating, left_score) = window[0];
        let (right_rating, right_score) = window[1];
        if value >= left_rating && value <= right_rating {
            let progress = (value - left_rating) / (right_rating - left_rating);
            return left_score + (right_score - left_score) * progress;
        }
    }
    if value > anchors[anchors.len() - 1].0 {
        anchors[anchors.len() - 1].1
    } else {
        anchors[0].1
    }
}

fn track_is_longform(track: &NativeTrack) -> bool {
    let genre = track.genre.as_deref().unwrap_or_default().to_lowercase();
    let path = track.path.replace('\\', "/").to_lowercase();
    genre.contains("podcast")
        || path.contains("podcast")
        || genre.contains("audiobook")
        || genre.contains("audio book")
        || path.contains("audiobook")
        || path.contains("audio book")
        || path.contains("/books/")
}

fn track_is_familiar(track: &NativeTrack) -> bool {
    track.rating.is_some() || track.play_count > 0
}

fn track_is_exploratory(track: &NativeTrack) -> bool {
    !track_is_familiar(track) && (track.rating.is_none() || track.play_count == 0)
}

fn track_matches_avoid(
    track: &NativeTrack,
    avoid_rules: &HashMap<String, HashSet<String>>,
) -> bool {
    if avoid_rules
        .get("track")
        .is_some_and(|rules| rules.contains(&track.id.to_string()))
    {
        return true;
    }
    if avoid_rules
        .get("artist")
        .is_some_and(|rules| !rules.is_disjoint(&split_artist_tokens(track.artist.as_deref())))
    {
        return true;
    }
    if avoid_rules
        .get("album")
        .is_some_and(|rules| rules.contains(&album_key(track.album.as_deref())))
    {
        return true;
    }
    if avoid_rules.get("genre").is_some_and(|rules| {
        !rules.is_disjoint(&split_text_tokens(combined_genre(track).as_deref()))
    }) {
        return true;
    }
    false
}

fn parse_embedding(value: Option<&str>) -> Option<Vec<f64>> {
    let raw = value?;
    let parsed = serde_json::from_str::<Vec<f64>>(raw).ok()?;
    if parsed.is_empty() {
        None
    } else {
        Some(parsed)
    }
}

fn cosine_similarity(left: Option<&str>, right: Option<&str>) -> Option<f64> {
    let left = parse_embedding(left)?;
    let right = parse_embedding(right)?;
    if left.len() != right.len() {
        return None;
    }
    let dot: f64 = left.iter().zip(&right).map(|(a, b)| a * b).sum();
    let left_norm = left.iter().map(|value| value * value).sum::<f64>().sqrt();
    let right_norm = right.iter().map(|value| value * value).sum::<f64>().sqrt();
    if left_norm <= 0.0 || right_norm <= 0.0 {
        None
    } else {
        Some(dot / (left_norm * right_norm))
    }
}

fn similarity_adjustment(
    track: &NativeTrack,
    seed_track: Option<&NativeTrack>,
    settings: &NativeAutoDjSettings,
) -> (f64, String) {
    let Some(seed_track) = seed_track else {
        return (0.0, String::new());
    };
    if track.id == seed_track.id || settings.similarity_weight <= 0.0 {
        return (0.0, String::new());
    }
    let mut score = 0.0;
    let mut reasons = Vec::new();
    if let Some(similarity) = cosine_similarity(
        track.analysis_embedding.as_deref(),
        seed_track.analysis_embedding.as_deref(),
    ) {
        if similarity > 0.0 {
            score += similarity * settings.audio_similarity_weight;
            reasons.push(format!("audio similarity {similarity:.2}"));
        }
    }
    if !split_artist_tokens(track.artist.as_deref())
        .is_disjoint(&split_artist_tokens(seed_track.artist.as_deref()))
    {
        score += settings.artist_similarity_weight;
        reasons.push("similar artist".to_string());
    }
    let album = album_key(track.album.as_deref());
    if !album.is_empty() && album == album_key(seed_track.album.as_deref()) {
        score += settings.album_similarity_weight;
        reasons.push("same album".to_string());
    }
    if !split_text_tokens(combined_genre(track).as_deref())
        .is_disjoint(&split_text_tokens(combined_genre(seed_track).as_deref()))
    {
        score += settings.genre_similarity_weight;
        reasons.push("similar genre".to_string());
    }
    if let (Some(year), Some(seed_year)) = (track.year, seed_track.year) {
        let distance = (year - seed_year).abs();
        if distance <= 2 {
            score += settings.year_similarity_weight;
            reasons.push("same era".to_string());
        } else if distance <= 6 {
            score += settings.year_similarity_weight * (0.2 / 0.45);
            reasons.push("nearby era".to_string());
        }
    }
    if let (Some(rating), Some(seed_rating)) = (track.rating, seed_track.rating) {
        if (rating - seed_rating).abs() <= 1.0 {
            score += settings.rating_similarity_weight;
            reasons.push("rating match".to_string());
        }
    }
    if reasons.is_empty() {
        (score, String::new())
    } else {
        (score, format!("seed {}", reasons.join("/")))
    }
}

fn score_candidate(
    item: NativeCandidateTrack,
    settings: &NativeAutoDjSettings,
    rng: &mut NativeRng,
    seed_track: Option<&NativeTrack>,
) -> NativeCandidate {
    let track = &item.track;
    let mut breakdown = BTreeMap::new();
    let mut score = base_rating_score(track.rating) * settings.rating_weight;
    breakdown.insert("rating".to_string(), round3(score));
    let mut reasons = vec![format!(
        "rating {}",
        track
            .rating
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unrated".to_string())
    )];

    let recency_score = if settings.recently_played_cooldown_days <= 0 {
        0.55
    } else if let Some(days) = item.days_since_played {
        if days < settings.recently_played_cooldown_days as f64 {
            -3.0 * (1.0 - (days / settings.recently_played_cooldown_days as f64))
        } else {
            0.55
        }
    } else {
        0.55
    };
    let recency_delta = recency_score * settings.recency_weight;
    score += recency_delta;
    breakdown.insert("recency".to_string(), round3(recency_delta));
    reasons.push(if recency_delta < 0.0 {
        "recently played penalty".to_string()
    } else {
        "not recently played".to_string()
    });

    if track.skip_count > 0 {
        let skip_delta = -((track.skip_count as f64) * 0.25).min(1.75) * settings.skip_weight;
        score += skip_delta;
        breakdown.insert("skips".to_string(), round3(skip_delta));
        reasons.push("skip penalty".to_string());
    }
    if let Some(days) = item.days_since_skipped {
        if days < 14.0 {
            let delta = -1.2 * (1.0 - days / 14.0) * settings.skip_weight;
            score += delta;
            breakdown.insert("recent_skip".to_string(), round3(delta));
            reasons.push("recent skip".to_string());
        }
    }
    if track.play_count > 0 {
        let delta = (track.play_count as f64)
            .ln_1p()
            .mul_add(0.18, 0.0)
            .min(0.9)
            * settings.play_history_weight;
        score += delta;
        breakdown.insert("plays".to_string(), round3(delta));
        reasons.push("play history".to_string());
    }
    if item.feedback_score > 0.0 {
        let delta = item
            .feedback_score
            .max(0.0)
            .ln_1p()
            .mul_add(0.45, 0.0)
            .min(1.4)
            * settings.feedback_weight;
        score += delta;
        breakdown.insert("manual_queue".to_string(), round3(delta));
        reasons.push("manual queue memory".to_string());
    }
    if track.rating.is_none() {
        let delta = 0.65 * settings.exploration_weight;
        score += delta;
        breakdown.insert("exploration".to_string(), round3(delta));
        reasons.push("exploration".to_string());
    }
    let (similarity, similarity_reason) = similarity_adjustment(track, seed_track, settings);
    if similarity != 0.0 {
        let delta = similarity * settings.similarity_weight;
        score += delta;
        breakdown.insert("similarity".to_string(), round3(delta));
        if !similarity_reason.is_empty() {
            reasons.push(similarity_reason);
        }
    }
    let random_delta = rng.uniform(-0.35, 0.35);
    score += random_delta;
    breakdown.insert("random".to_string(), round3(random_delta));
    breakdown.insert("total".to_string(), round3(score));

    NativeCandidate {
        artist_keys: split_artist_tokens(track.artist.as_deref()),
        album_key: album_key(track.album.as_deref()),
        is_unrated: track.rating.is_none(),
        is_exploratory: track_is_exploratory(track),
        item,
        score,
        reason: reasons.join(", "),
        breakdown,
    }
}

fn candidate_conflicts(
    candidate: &NativeCandidate,
    recent_artists: &[HashSet<String>],
    recent_albums: &[String],
) -> bool {
    let artist_conflict = !candidate.artist_keys.is_empty()
        && recent_artists
            .iter()
            .any(|recent| !recent.is_disjoint(&candidate.artist_keys));
    let album_conflict = !candidate.album_key.is_empty()
        && recent_albums
            .iter()
            .any(|recent| recent == &candidate.album_key);
    artist_conflict || album_conflict
}

fn repeat_artist_percent_for_tracks(tracks: &[NativeQueueTrack]) -> f64 {
    if tracks.is_empty() {
        return 0.0;
    }
    let unique_artists: HashSet<String> = tracks
        .iter()
        .flat_map(|track| {
            let tokens = split_artist_tokens(track.track.artist.as_deref());
            if tokens.is_empty() {
                HashSet::from([normalize_token(track.track.artist.as_deref())])
            } else {
                tokens
            }
        })
        .filter(|token| !token.is_empty())
        .collect();
    if unique_artists.is_empty() {
        0.0
    } else {
        ((tracks.len().saturating_sub(unique_artists.len())) as f64 / tracks.len() as f64) * 100.0
    }
}

fn target_drift_adjustment(
    selected: &[NativeQueueTrack],
    track: &NativeTrack,
    settings: &NativeAutoDjSettings,
) -> (f64, String) {
    let mut score = 0.0;
    let mut reasons = Vec::new();
    if let Some(target) = settings.target_unrated_percent {
        let target_fraction = target / 100.0;
        let current_unrated = selected
            .iter()
            .filter(|item| item.track.rating.is_none())
            .count();
        let current_fraction = if selected.is_empty() {
            0.0
        } else {
            current_unrated as f64 / selected.len() as f64
        };
        if track.rating.is_none() && current_fraction < target_fraction {
            score += 0.75;
            reasons.push("unrated target");
        } else if track.rating.is_some() && current_fraction < target_fraction {
            score -= 0.45;
            reasons.push("unrated target");
        }
    }
    if let Some(target) = settings.target_exploration_percent {
        let target_fraction = target / 100.0;
        let current = selected
            .iter()
            .filter(|item| track_is_exploratory(&item.track))
            .count();
        let current_fraction = if selected.is_empty() {
            0.0
        } else {
            current as f64 / selected.len() as f64
        };
        if track_is_exploratory(track) && current_fraction < target_fraction {
            score += 0.6;
            reasons.push("exploration target");
        } else if !track_is_exploratory(track) && current_fraction < target_fraction {
            score -= 0.35;
            reasons.push("exploration target");
        }
    }
    if let Some(max_repeat) = settings.max_repeat_artist_percent {
        let mut projected = selected.to_vec();
        projected.push(NativeQueueTrack {
            track: track.clone(),
            score: 0.0,
            reason: String::new(),
            score_breakdown: BTreeMap::new(),
        });
        let overage = repeat_artist_percent_for_tracks(&projected) - max_repeat;
        if overage > 0.0 {
            score -= (0.16 * overage).min(4.0);
            reasons.push("repeat artist target");
        }
    }
    (score, reasons.join(", "))
}

fn adjusted_candidate_for_queue(
    base: &NativeCandidate,
    queue: &[NativeQueueTrack],
    settings: &NativeAutoDjSettings,
    recent_artists: &[HashSet<String>],
    recent_albums: &[String],
    cooldown_penalty: bool,
) -> NativeCandidate {
    let mut adjusted = base.clone();
    let (drift_delta, drift_reason) =
        target_drift_adjustment(queue, &adjusted.item.track, settings);
    if drift_delta != 0.0 {
        adjusted.score += drift_delta;
        adjusted
            .breakdown
            .insert("targets".to_string(), round3(drift_delta));
        if !drift_reason.is_empty() {
            adjusted.reason.push_str(&format!(", {drift_reason}"));
        }
    }
    if cooldown_penalty && candidate_conflicts(base, recent_artists, recent_albums) {
        adjusted.score -= 2.0;
        adjusted.reason.push_str(", cooldown penalty");
    }
    adjusted
        .breakdown
        .insert("total".to_string(), round3(adjusted.score));
    adjusted
}

fn weighted_choice(candidates: &[NativeCandidate], temperature: f64, rng: &mut NativeRng) -> usize {
    let max_score = candidates
        .iter()
        .map(|candidate| candidate.score)
        .fold(f64::NEG_INFINITY, f64::max);
    let weights: Vec<f64> = candidates
        .iter()
        .map(|candidate| ((candidate.score - max_score) / temperature.max(0.05)).exp())
        .collect();
    let total: f64 = weights.iter().sum();
    let mut pick = rng.next_f64() * total;
    for (index, weight) in weights.iter().enumerate() {
        pick -= weight;
        if pick <= 0.0 {
            return index;
        }
    }
    candidates.len().saturating_sub(1)
}

fn candidate_to_queue_track(candidate: NativeCandidate) -> NativeQueueTrack {
    NativeQueueTrack {
        track: candidate.item.track,
        score: round3(candidate.score),
        reason: candidate.reason,
        score_breakdown: candidate.breakdown,
    }
}

fn read_autodj_candidates(connection: &Connection) -> Result<Vec<NativeCandidateTrack>, String> {
    let track_columns = qualified_track_columns("tracks");
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns},
                   COALESCE(SUM(recommendation_feedback.weight), 0) AS feedback_score,
                   julianday('now') - julianday(tracks.last_played_at) AS days_since_played,
                   julianday('now') - julianday(tracks.last_skipped_at) AS days_since_skipped
            FROM tracks
            LEFT JOIN recommendation_feedback ON recommendation_feedback.track_id = tracks.id
            GROUP BY tracks.id
            ORDER BY tracks.artist, tracks.album, tracks.disc_number, tracks.track_number, tracks.title
            "#
        ))
        .map_err(|error| format!("Could not prepare native AutoDJ candidates: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(NativeCandidateTrack {
                track: track_from_row(row)?,
                feedback_score: row.get::<_, Option<f64>>("feedback_score")?.unwrap_or(0.0),
                days_since_played: row.get("days_since_played")?,
                days_since_skipped: row.get("days_since_skipped")?,
            })
        })
        .map_err(|error| format!("Could not read native AutoDJ candidates: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native AutoDJ candidates: {error}"))
}

fn read_autodj_avoid_rules(
    connection: &Connection,
) -> Result<HashMap<String, HashSet<String>>, String> {
    let mut avoid_rules: HashMap<String, HashSet<String>> = HashMap::from([
        ("track".to_string(), HashSet::new()),
        ("artist".to_string(), HashSet::new()),
        ("album".to_string(), HashSet::new()),
        ("genre".to_string(), HashSet::new()),
    ]);
    let mut statement = connection
        .prepare("SELECT scope, target_key FROM autodj_avoid_rules")
        .map_err(|error| format!("Could not prepare native AutoDJ avoid rules: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, Option<String>>("scope")?.unwrap_or_default(),
                row.get::<_, Option<String>>("target_key")?
                    .unwrap_or_default(),
            ))
        })
        .map_err(|error| format!("Could not read native AutoDJ avoid rules: {error}"))?;
    for row in rows {
        let (scope, target_key) =
            row.map_err(|error| format!("Could not decode native AutoDJ avoid rules: {error}"))?;
        avoid_rules.entry(scope).or_default().insert(target_key);
    }
    Ok(avoid_rules)
}

fn native_recommendation_drift(tracks: &[NativeQueueTrack]) -> NativeRecommendationDrift {
    let total = tracks.len();
    if total == 0 {
        return NativeRecommendationDrift::default();
    }
    let ratings: Vec<f64> = tracks
        .iter()
        .filter_map(|track| track.track.rating)
        .collect();
    let familiar = tracks
        .iter()
        .filter(|track| track_is_familiar(&track.track))
        .count();
    let exploratory = tracks
        .iter()
        .filter(|track| track_is_exploratory(&track.track))
        .count();
    let unique_artists: HashSet<String> = tracks
        .iter()
        .flat_map(|track| {
            let tokens = split_artist_tokens(track.track.artist.as_deref());
            if tokens.is_empty() {
                HashSet::from([normalize_token(track.track.artist.as_deref())])
            } else {
                tokens
            }
        })
        .filter(|token| !token.is_empty())
        .collect();
    let unique_albums: HashSet<String> = tracks
        .iter()
        .map(|track| album_key(track.track.album.as_deref()))
        .filter(|album| !album.is_empty())
        .collect();
    let clap_count = tracks
        .iter()
        .filter(|track| {
            track.track.analysis_provider.as_deref() == Some("clap")
                && track
                    .track
                    .analysis_embedding
                    .as_deref()
                    .is_some_and(|value| !value.is_empty())
        })
        .count();
    let repeat_artist_percent = if unique_artists.is_empty() {
        0.0
    } else {
        ((total.saturating_sub(unique_artists.len())) as f64 / total as f64) * 100.0
    };
    let mut drift = NativeRecommendationDrift {
        total_tracks: total as i64,
        familiar_percent: round2((familiar as f64 / total as f64) * 100.0),
        exploration_percent: round2((exploratory as f64 / total as f64) * 100.0),
        repeat_artist_percent: round2(repeat_artist_percent),
        unrated_percent: round2(
            (tracks
                .iter()
                .filter(|track| track.track.rating.is_none())
                .count() as f64
                / total as f64)
                * 100.0,
        ),
        clap_percent: round2((clap_count as f64 / total as f64) * 100.0),
        average_rating: if ratings.is_empty() {
            None
        } else {
            Some(round2(ratings.iter().sum::<f64>() / ratings.len() as f64))
        },
        unique_artists: unique_artists.len() as i64,
        unique_albums: unique_albums.len() as i64,
        warnings: Vec::new(),
    };
    if drift.repeat_artist_percent >= 35.0 {
        drift.warnings.push(
            "This queue leans repetitive by artist. Increase artist cooldown or temperature."
                .to_string(),
        );
    }
    if drift.exploration_percent >= 85.0 {
        drift
            .warnings
            .push("This queue is highly exploratory. Lower temperature or unrated exploration for a safer mix.".to_string());
    }
    if drift.familiar_percent >= 90.0 && drift.unrated_percent <= 5.0 {
        drift.warnings.push(
            "This queue is very familiar. Add a little unrated exploration for discovery."
                .to_string(),
        );
    }
    if drift.clap_percent <= 10.0 && drift.total_tracks >= 10 {
        drift
            .warnings
            .push("Few tracks use CLAP similarity. Analyze more music to improve sound-based recommendations.".to_string());
    }
    drift
}

fn record_native_recommendation_run(
    connection: &Connection,
    settings: &NativeAutoDjSettings,
    drift: &NativeRecommendationDrift,
    tracks: &[NativeQueueTrack],
) {
    let track_ids: Vec<i64> = tracks.iter().map(|track| track.track.id).collect();
    let _ = connection.execute(
        r#"
        INSERT INTO recommendation_runs(settings_json, drift_json, track_ids_json)
        VALUES(?, ?, ?)
        "#,
        params![
            serde_json::to_string(settings).unwrap_or_else(|_| "{}".to_string()),
            serde_json::to_string(drift).unwrap_or_else(|_| "{}".to_string()),
            serde_json::to_string(&track_ids).unwrap_or_else(|_| "[]".to_string())
        ],
    );
    let _ = connection.execute(
        r#"
        DELETE FROM recommendation_runs
        WHERE id NOT IN (
          SELECT id FROM recommendation_runs ORDER BY datetime(created_at) DESC, id DESC LIMIT 100
        )
        "#,
        [],
    );
}

#[tauri::command]
pub fn native_generate_autodj(
    _state: State<'_, NativeLibraryState>,
    settings: serde_json::Value,
) -> Result<NativeAutoDjResponse, String> {
    const MAX_DYNAMIC_CANDIDATES: usize = 8_000;
    let settings = native_autodj_settings(settings);
    let connection = open_database()?;
    let mut rng = NativeRng::new(settings.seed);
    let avoid_rules = read_autodj_avoid_rules(&connection)?;
    let candidates = read_autodj_candidates(&connection)?;
    let seed_track = settings.seed_track_id.and_then(|seed_id| {
        candidates
            .iter()
            .find(|candidate| candidate.track.id == seed_id)
            .map(|candidate| candidate.track.clone())
    });
    let mut remaining: Vec<NativeCandidate> = candidates
        .into_iter()
        .filter(|candidate| !track_is_longform(&candidate.track))
        .filter(|candidate| !track_matches_avoid(&candidate.track, &avoid_rules))
        .filter(|candidate| match settings.minimum_rating {
            Some(minimum) => candidate
                .track
                .rating
                .is_some_and(|rating| rating >= minimum),
            None => true,
        })
        .map(|candidate| score_candidate(candidate, &settings, &mut rng, seed_track.as_ref()))
        .collect();
    if remaining.is_empty() && settings.minimum_rating.is_some() {
        remaining = read_autodj_candidates(&connection)?
            .into_iter()
            .filter(|candidate| !track_is_longform(&candidate.track))
            .filter(|candidate| !track_matches_avoid(&candidate.track, &avoid_rules))
            .map(|candidate| score_candidate(candidate, &settings, &mut rng, seed_track.as_ref()))
            .collect();
    }
    remaining.sort_by(|left, right| right.score.total_cmp(&left.score));

    let target_unrated_percent = settings
        .target_unrated_percent
        .unwrap_or(settings.unrated_exploration_percent);
    let target_unrated =
        ((settings.queue_length as f64 * target_unrated_percent / 100.0).round()) as usize;
    let target_exploratory = settings
        .target_exploration_percent
        .map(|value| ((settings.queue_length as f64 * value / 100.0).round()) as usize);
    let mut chosen_unrated = 0usize;
    let mut chosen_exploratory = 0usize;
    let mut queue = Vec::<NativeQueueTrack>::new();
    let mut recent_artists = Vec::<HashSet<String>>::new();
    let mut recent_albums = Vec::<String>::new();

    if let Some(seed_track) = seed_track {
        if settings.queue_length > 0 {
            let seed_item = NativeCandidateTrack {
                track: seed_track.clone(),
                feedback_score: 0.0,
                days_since_played: None,
                days_since_skipped: None,
            };
            let mut seed_candidate =
                score_candidate(seed_item, &settings, &mut rng, Some(&seed_track));
            seed_candidate.breakdown.insert("seed".to_string(), 1.0);
            seed_candidate
                .breakdown
                .insert("total".to_string(), round3(seed_candidate.score));
            seed_candidate.reason = format!("seed track, {}", seed_candidate.reason);
            if seed_track.rating.is_none() {
                chosen_unrated += 1;
            }
            if track_is_exploratory(&seed_track) {
                chosen_exploratory += 1;
            }
            recent_artists.insert(0, split_artist_tokens(seed_track.artist.as_deref()));
            recent_albums.insert(0, album_key(seed_track.album.as_deref()));
            queue.push(candidate_to_queue_track(seed_candidate));
            remaining.retain(|candidate| candidate.item.track.id != seed_track.id);
        }
    }

    while !remaining.is_empty() && queue.len() < settings.queue_length {
        let slots_left = settings.queue_length - queue.len();
        let must_pick_unrated = target_unrated.saturating_sub(chosen_unrated) >= slots_left;
        let must_pick_exploratory = target_exploratory
            .map(|target| target.saturating_sub(chosen_exploratory) >= slots_left)
            .unwrap_or(false);
        let mut pool: Vec<usize> = remaining
            .iter()
            .enumerate()
            .filter_map(|(index, candidate)| {
                if (!must_pick_unrated || candidate.is_unrated)
                    && (!must_pick_exploratory || candidate.is_exploratory)
                {
                    Some(index)
                } else {
                    None
                }
            })
            .collect();
        if pool.is_empty() {
            pool = (0..remaining.len()).collect();
        }
        let strict_pool: Vec<usize> = pool
            .iter()
            .copied()
            .filter(|index| {
                !candidate_conflicts(
                    &remaining[*index],
                    &recent_artists[..recent_artists.len().min(settings.artist_cooldown)],
                    &recent_albums[..recent_albums.len().min(settings.album_cooldown)],
                )
            })
            .collect();
        let apply_cooldown_penalty = strict_pool.is_empty();
        if !strict_pool.is_empty() {
            pool = strict_pool;
        }
        let shortlist: Vec<usize> = pool.into_iter().take(MAX_DYNAMIC_CANDIDATES).collect();
        let adjusted: Vec<NativeCandidate> = shortlist
            .iter()
            .map(|index| {
                adjusted_candidate_for_queue(
                    &remaining[*index],
                    &queue,
                    &settings,
                    &recent_artists[..recent_artists.len().min(settings.artist_cooldown)],
                    &recent_albums[..recent_albums.len().min(settings.album_cooldown)],
                    apply_cooldown_penalty,
                )
            })
            .collect();
        if adjusted.is_empty() {
            break;
        }
        let picked_adjusted_index =
            weighted_choice(&adjusted, settings.temperature, &mut rng).min(shortlist.len() - 1);
        let picked_remaining_index = shortlist[picked_adjusted_index];
        let picked = adjusted[picked_adjusted_index].clone();
        if picked.is_unrated {
            chosen_unrated += 1;
        }
        if picked.is_exploratory {
            chosen_exploratory += 1;
        }
        recent_artists.insert(0, picked.artist_keys.clone());
        recent_albums.insert(0, picked.album_key.clone());
        recent_artists.truncate(settings.artist_cooldown.max(1));
        recent_albums.truncate(settings.album_cooldown.max(1));
        queue.push(candidate_to_queue_track(picked));
        remaining.remove(picked_remaining_index);
    }

    let drift = native_recommendation_drift(&queue);
    record_native_recommendation_run(&connection, &settings, &drift, &queue);
    Ok(NativeAutoDjResponse {
        tracks: queue,
        settings,
        drift,
        source: "rust-sqlite".to_string(),
    })
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

fn normalized_path_key(path: &str) -> String {
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

#[tauri::command]
pub fn native_parse_playlist(playlist_path: String) -> Result<NativePlaylistParseResponse, String> {
    let path = PathBuf::from(playlist_path.trim());
    let content = std::fs::read_to_string(&path)
        .map_err(|error| format!("Could not read playlist {}: {error}", path.display()))?;
    let base_folder = path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut entries = Vec::new();
    let mut local_paths = Vec::new();
    let mut errors = Vec::new();
    for line in content.lines() {
        let text = line.trim().trim_matches('"').trim_matches('\'');
        if text.is_empty() || text.starts_with('#') {
            continue;
        }
        entries.push(text.to_string());
        if text.starts_with("http://") || text.starts_with("https://") || text.starts_with("icy://")
        {
            continue;
        }
        let candidate = PathBuf::from(text);
        let resolved = if candidate.is_absolute() {
            candidate
        } else {
            base_folder.join(candidate)
        };
        if resolved.exists() {
            local_paths.push(resolved.to_string_lossy().to_string());
        } else {
            errors.push(format!("Missing playlist entry: {}", resolved.display()));
        }
    }
    Ok(NativePlaylistParseResponse {
        playlist_path: path.to_string_lossy().to_string(),
        base_folder: base_folder.to_string_lossy().to_string(),
        entries,
        local_paths,
        errors,
    })
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
    limit: Option<usize>,
) -> Result<NativeVolumeTagResponse, String> {
    let connection = open_database()?;
    let tracks =
        select_tracks_by_ids_or_limit(&connection, track_ids, limit.unwrap_or(200).clamp(1, 2000))?;
    let mut previews = Vec::new();
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
        previews.push(preview);
    }
    let changed = previews.iter().filter(|preview| preview.changed).count() as i64;
    Ok(NativeVolumeTagResponse {
        total: previews.len() as i64,
        changed,
        applied: 0,
        errors: Vec::new(),
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
    use super::{search_terms, sort_expression};

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
}
