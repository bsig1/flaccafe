use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection};
use serde::Serialize;
use std::env;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::State;

#[derive(Default)]
pub struct NativeLibraryState;

#[derive(Serialize)]
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
pub struct NativeLibrarySourceRemoveResponse {
    path: String,
    library_paths: Vec<String>,
    removed_tracks: i64,
    removed_metadata_cache: i64,
    removed_artwork_cache: i64,
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
