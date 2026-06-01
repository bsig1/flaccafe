fn read_cached_query<T: serde::de::DeserializeOwned>(
    connection: &Connection,
    cache_key: &str,
) -> Option<T> {
    connection
        .query_row(
            "SELECT payload_json FROM library_query_cache WHERE cache_key = ?",
            params![cache_key],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|payload| serde_json::from_str(&payload).ok())
}

fn write_cached_query<T: serde::Serialize>(
    connection: &Connection,
    cache_key: &str,
    payload: &T,
    total: Option<i64>,
) {
    let Ok(payload_json) = serde_json::to_string(payload) else {
        return;
    };
    let _ = connection.execute(
        r#"
        INSERT INTO library_query_cache(cache_key, payload_json, total, updated_at)
        VALUES(?, ?, ?, datetime('now'))
        ON CONFLICT(cache_key) DO UPDATE SET
          payload_json = excluded.payload_json,
          total = excluded.total,
          updated_at = excluded.updated_at
        "#,
        params![cache_key, payload_json, total],
    );
    let _ = connection.execute(
        r#"
        DELETE FROM library_query_cache
        WHERE cache_key LIKE 'ui:%'
          AND cache_key NOT IN (
            SELECT cache_key
            FROM library_query_cache
            WHERE cache_key LIKE 'ui:%'
            ORDER BY datetime(updated_at) DESC
            LIMIT 300
          )
        "#,
        [],
    );
}

fn query_cache_key(scope: &str, payload: serde_json::Value) -> String {
    format!(
        "ui:{scope}:v4:{}",
        serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string())
    )
}

fn table_has_column(connection: &Connection, table: &str, column: &str) -> bool {
    let Ok(mut statement) = connection.prepare(&format!("PRAGMA table_info({table})")) else {
        return false;
    };
    let Ok(rows) = statement.query_map([], |row| row.get::<_, String>("name")) else {
        return false;
    };
    let has_column = rows.filter_map(Result::ok).any(|name| name == column);
    has_column
}

fn table_row_count(connection: &Connection, table: &str) -> Option<i64> {
    connection
        .query_row(&format!("SELECT count(*) FROM {table}"), [], |row| row.get(0))
        .ok()
}

fn should_cache_page(limit: usize) -> bool {
    limit <= 500
}

fn primary_artist_sql(alias: &str) -> String {
    let artist = format!("coalesce({alias}.artist, '')");
    format!(
        "trim(CASE WHEN instr({artist}, ';') > 0 THEN substr({artist}, 1, instr({artist}, ';') - 1) WHEN instr({artist}, '|') > 0 THEN substr({artist}, 1, instr({artist}, '|') - 1) ELSE {artist} END)"
    )
}

pub(crate) fn ensure_performance_schema(connection: &Connection) -> Result<(), String> {
    // These tables are materialized read models for the hot library views. The
    // triggers below mark them dirty, and browse/search calls refresh lazily.
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS album_summaries (
              id INTEGER PRIMARY KEY,
              album TEXT,
              album_artist TEXT,
              year INTEGER,
              years_csv TEXT,
              album_ids_csv TEXT,
              edition_count INTEGER NOT NULL DEFAULT 1,
              artwork_path TEXT,
              artwork_locked INTEGER NOT NULL DEFAULT 0,
              track_count INTEGER NOT NULL DEFAULT 0,
              expected_track_count INTEGER,
              missing_track_count INTEGER NOT NULL DEFAULT 0,
              duration_seconds REAL,
              average_rating REAL,
              artwork_track_id INTEGER,
              completion_expected_track_count INTEGER,
              completion_source TEXT,
              completion_release_id TEXT,
              completion_release_title TEXT,
              completion_checked_at TEXT,
              sort_album_artist TEXT NOT NULL DEFAULT '',
              sort_album TEXT NOT NULL DEFAULT '',
              sort_year INTEGER NOT NULL DEFAULT 9999,
              search_text TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS artist_summaries (
              name TEXT PRIMARY KEY,
              track_count INTEGER NOT NULL DEFAULT 0,
              album_count INTEGER NOT NULL DEFAULT 0,
              duration_seconds REAL,
              average_rating REAL,
              play_count INTEGER NOT NULL DEFAULT 0,
              skip_count INTEGER NOT NULL DEFAULT 0,
              first_year INTEGER,
              last_year INTEGER,
              artwork_track_id INTEGER,
              sort_name TEXT NOT NULL DEFAULT '',
              search_text TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS playlist_summaries (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              track_count INTEGER NOT NULL DEFAULT 0,
              duration_seconds REAL,
              created_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL DEFAULT '',
              sort_name TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS library_stats_cache (
              id INTEGER PRIMARY KEY CHECK(id = 1),
              total_tracks INTEGER NOT NULL DEFAULT 0,
              total_albums INTEGER NOT NULL DEFAULT 0,
              total_artists INTEGER NOT NULL DEFAULT 0,
              total_playlists INTEGER NOT NULL DEFAULT 0,
              rated_tracks INTEGER NOT NULL DEFAULT 0,
              unrated_tracks INTEGER NOT NULL DEFAULT 0,
              total_duration_seconds REAL,
              played_events INTEGER NOT NULL DEFAULT 0,
              skipped_events INTEGER NOT NULL DEFAULT 0,
              music_track_count INTEGER NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_album_summaries_sort
              ON album_summaries(sort_album_artist, sort_year, sort_album, id);
            CREATE INDEX IF NOT EXISTS idx_artist_summaries_sort
              ON artist_summaries(sort_name, name);
            CREATE INDEX IF NOT EXISTS idx_playlist_summaries_sort
              ON playlist_summaries(sort_name, id);

            CREATE INDEX IF NOT EXISTS idx_tracks_sort_artist
              ON tracks(lower(coalesce(artist, '')), lower(coalesce(album, '')), coalesce(disc_number, 0), coalesce(track_number, 0), lower(coalesce(title, '')), id);
            CREATE INDEX IF NOT EXISTS idx_tracks_sort_title
              ON tracks(lower(coalesce(title, '')), lower(coalesce(artist, '')), lower(coalesce(album, '')), id);
            CREATE INDEX IF NOT EXISTS idx_tracks_sort_album
              ON tracks(lower(coalesce(album, '')), lower(coalesce(artist, '')), coalesce(disc_number, 0), coalesce(track_number, 0), lower(coalesce(title, '')), id);
            CREATE INDEX IF NOT EXISTS idx_tracks_sort_date_added
              ON tracks(coalesce(date_added, ''), id);
            CREATE INDEX IF NOT EXISTS idx_tracks_sort_rating
              ON tracks(coalesce(rating, -1), lower(coalesce(artist, '')), lower(coalesce(album, '')), id);
            CREATE INDEX IF NOT EXISTS idx_tracks_album_position
              ON tracks(album_id, coalesce(disc_number, 0), coalesce(track_number, 0), id);
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_position
              ON playlist_tracks(playlist_id, position, id);

            DROP TRIGGER IF EXISTS perf_tracks_dirty_au;
            CREATE TRIGGER IF NOT EXISTS perf_tracks_dirty_ai AFTER INSERT ON tracks BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_tracks_dirty_au AFTER UPDATE ON tracks
            WHEN old.path IS NOT new.path
              OR old.title IS NOT new.title
              OR old.artist IS NOT new.artist
              OR old.album IS NOT new.album
              OR old.album_artist IS NOT new.album_artist
              OR old.album_id IS NOT new.album_id
              OR old.track_number IS NOT new.track_number
              OR old.disc_number IS NOT new.disc_number
              OR old.genre IS NOT new.genre
              OR old.analysis_genre IS NOT new.analysis_genre
              OR old.year IS NOT new.year
              OR old.duration_seconds IS NOT new.duration_seconds
              OR old.rating IS NOT new.rating
            BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_tracks_dirty_ad AFTER DELETE ON tracks BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_playlists_dirty_ai AFTER INSERT ON playlists BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_playlists_dirty_au AFTER UPDATE ON playlists BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_playlists_dirty_ad AFTER DELETE ON playlists BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_playlist_tracks_dirty_ai AFTER INSERT ON playlist_tracks BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_playlist_tracks_dirty_au AFTER UPDATE ON playlist_tracks BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_playlist_tracks_dirty_ad AFTER DELETE ON playlist_tracks BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%';
              INSERT INTO settings(key, value, updated_at)
              VALUES('library_derived_dirty', '1', datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            END;
            CREATE TRIGGER IF NOT EXISTS perf_play_events_dirty_ai AFTER INSERT ON play_events BEGIN
              DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:library_stats:%';
              DELETE FROM library_stats_cache;
            END;
            "#,
        )
        .map_err(|error| format!("Could not create library performance schema: {error}"))?;

    ensure_tracks_fts(connection)?;
    if !table_has_column(connection, "album_summaries", "artwork_locked") {
        connection
            .execute(
                "ALTER TABLE album_summaries ADD COLUMN artwork_locked INTEGER NOT NULL DEFAULT 0",
                [],
            )
            .map_err(|error| format!("Could not add album artwork lock summary column: {error}"))?;
    }
    if get_setting(connection, "library_article_sort_normalized").as_deref() != Some("1") {
        let _ = set_setting(connection, "library_article_sort_normalized", Some("1"));
        let _ = set_setting(connection, "library_derived_dirty", Some("1"));
        let _ = connection.execute("DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%'", []);
    }
    let dirty_exists = get_setting(connection, "library_derived_dirty").is_some();
    if !dirty_exists {
        let _ = set_setting(connection, "library_derived_dirty", Some("1"));
    }
    Ok(())
}

fn ensure_tracks_fts(connection: &Connection) -> Result<(), String> {
    if tracks_fts_available(connection) && !table_has_column(connection, "tracks_fts", "analysis_mood")
    {
        connection
            .execute_batch(
                r#"
                DROP TRIGGER IF EXISTS tracks_fts_ai;
                DROP TRIGGER IF EXISTS tracks_fts_ad;
                DROP TRIGGER IF EXISTS tracks_fts_au;
                DROP TABLE IF EXISTS tracks_fts;
                "#,
            )
            .ok();
    }
    let fts_created = connection
        .execute(
            r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts
            USING fts5(
              title,
              artist,
              album,
              album_artist,
              genre,
              analysis_genre,
              analysis_mood,
              path,
              content='tracks',
              content_rowid='id',
              tokenize='unicode61 remove_diacritics 2'
            )
            "#,
            [],
        )
        .is_ok();
    if !fts_created {
        let _ = set_setting(connection, "library_fts_available", Some("0"));
        return Ok(());
    }
    set_setting(connection, "library_fts_available", Some("1"))?;
    connection
        .execute_batch(
            r#"
            DROP TRIGGER IF EXISTS tracks_fts_au;
            CREATE TRIGGER IF NOT EXISTS tracks_fts_ai AFTER INSERT ON tracks BEGIN
              INSERT INTO tracks_fts(rowid, title, artist, album, album_artist, genre, analysis_genre, analysis_mood, path)
              VALUES(new.id, new.title, new.artist, new.album, new.album_artist, new.genre, new.analysis_genre, new.analysis_mood, new.path);
            END;
            CREATE TRIGGER IF NOT EXISTS tracks_fts_ad AFTER DELETE ON tracks BEGIN
              INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, album_artist, genre, analysis_genre, analysis_mood, path)
              VALUES('delete', old.id, old.title, old.artist, old.album, old.album_artist, old.genre, old.analysis_genre, old.analysis_mood, old.path);
            END;
            CREATE TRIGGER IF NOT EXISTS tracks_fts_au AFTER UPDATE ON tracks
            WHEN old.path IS NOT new.path
              OR old.title IS NOT new.title
              OR old.artist IS NOT new.artist
              OR old.album IS NOT new.album
              OR old.album_artist IS NOT new.album_artist
              OR old.genre IS NOT new.genre
              OR old.analysis_genre IS NOT new.analysis_genre
              OR old.analysis_mood IS NOT new.analysis_mood
            BEGIN
              INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, album_artist, genre, analysis_genre, analysis_mood, path)
              VALUES('delete', old.id, old.title, old.artist, old.album, old.album_artist, old.genre, old.analysis_genre, old.analysis_mood, old.path);
              INSERT INTO tracks_fts(rowid, title, artist, album, album_artist, genre, analysis_genre, analysis_mood, path)
              VALUES(new.id, new.title, new.artist, new.album, new.album_artist, new.genre, new.analysis_genre, new.analysis_mood, new.path);
            END;
            "#,
        )
        .map_err(|error| format!("Could not create track search triggers: {error}"))?;

    rebuild_tracks_fts_if_stale(connection)?;
    Ok(())
}

pub(crate) fn rebuild_tracks_fts(connection: &Connection) -> Result<(), String> {
    connection
        .execute("INSERT INTO tracks_fts(tracks_fts) VALUES('rebuild')", [])
        .map_err(|error| format!("Could not rebuild track search index: {error}"))?;
    Ok(())
}

fn tracks_fts_available(connection: &Connection) -> bool {
    get_setting(connection, "library_fts_available").as_deref() == Some("1")
        && connection
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tracks_fts'",
                [],
                |_| Ok(()),
            )
            .is_ok()
}

fn ensure_tracks_fts_current(connection: &Connection) -> Result<(), String> {
    if !tracks_fts_available(connection) {
        return Ok(());
    }
    rebuild_tracks_fts_if_stale(connection)?;
    Ok(())
}

fn rebuild_tracks_fts_if_stale(connection: &Connection) -> Result<(), String> {
    let track_count = table_row_count(connection, "tracks").unwrap_or(0);
    if track_count <= 0 {
        return Ok(());
    }
    let docsize_count = table_row_count(connection, "tracks_fts_docsize").unwrap_or(-1);
    if docsize_count != track_count {
        rebuild_tracks_fts(connection)?;
    }
    Ok(())
}

fn fts_search_query(search: &str) -> Option<String> {
    let terms: Vec<String> = search::search_terms(search)
        .into_iter()
        .filter_map(|term| {
            let cleaned: String = term
                .chars()
                .filter(|character| character.is_alphanumeric())
                .collect();
            if cleaned.is_empty() {
                None
            } else {
                Some(format!("{cleaned}*"))
            }
        })
        .take(8)
        .collect();
    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

fn ensure_library_derived_data_current(connection: &Connection) -> Result<(), String> {
    let dirty = get_setting(connection, "library_derived_dirty").unwrap_or_else(|| "1".to_string());
    let album_summary_count: i64 = connection
        .query_row("SELECT count(*) FROM album_summaries", [], |row| row.get(0))
        .unwrap_or(0);
    let track_count: i64 = connection
        .query_row("SELECT count(*) FROM tracks", [], |row| row.get(0))
        .unwrap_or(0);
    if dirty == "1" || (track_count > 0 && album_summary_count == 0) {
        refresh_library_derived_data(connection)?;
    }
    Ok(())
}

fn refresh_library_derived_data(connection: &Connection) -> Result<(), String> {
    // Rebuild the read models in one transaction so the UI either sees the old
    // summaries or the complete refreshed set, never a half-populated mix.
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| format!("Could not start derived library refresh: {error}"))?;
    transaction
        .execute("DELETE FROM album_summaries", [])
        .map_err(|error| format!("Could not clear album summaries: {error}"))?;
    transaction
        .execute("DELETE FROM artist_summaries", [])
        .map_err(|error| format!("Could not clear artist summaries: {error}"))?;
    transaction
        .execute("DELETE FROM playlist_summaries", [])
        .map_err(|error| format!("Could not clear playlist summaries: {error}"))?;
    transaction
        .execute("DELETE FROM library_stats_cache", [])
        .map_err(|error| format!("Could not clear library stats cache: {error}"))?;

    let album_key = "lower(trim(coalesce(albums.album, '')))";
    let artist_key = "lower(trim(coalesce(albums.album_artist, '')))";
    let sort_album_artist = article_sort_expression("album_artist");
    let sort_album = article_sort_expression("album");
    transaction
        .execute(
            &format!(
                r#"
                INSERT INTO album_summaries(
                    id, album, album_artist, year, years_csv, album_ids_csv, edition_count,
                    artwork_path, artwork_locked, track_count, expected_track_count, missing_track_count,
                    duration_seconds, average_rating, artwork_track_id,
                    completion_expected_track_count, completion_source, completion_release_id,
                    completion_release_title, completion_checked_at, sort_album_artist,
                    sort_album, sort_year, search_text
                )
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
                        max(coalesce(albums.artwork_locked, 0)) AS artwork_locked,
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
                    WHERE {music_filter}
                    GROUP BY {album_key}, {artist_key}, album_completion.expected_track_count
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
                    artwork_locked,
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
                    completion_checked_at,
                    {sort_album_artist} AS sort_album_artist,
                    {sort_album} AS sort_album,
                    coalesce(year, 9999) AS sort_year,
                    coalesce(album, '') || ' ' || coalesce(album_artist, '') || ' ' || coalesce(year, '') AS search_text
                FROM raw_groups
                "#,
                music_filter = music_only_clause(),
                sort_album_artist = sort_album_artist,
                sort_album = sort_album
            ),
            [],
        )
        .map_err(|error| format!("Could not refresh album summaries: {error}"))?;

    let artist_expr = primary_artist_sql("tracks");
    let sort_artist_name = article_sort_expression("artist_name");
    transaction
        .execute(
            &format!(
                r#"
                INSERT INTO artist_summaries(
                    name, track_count, album_count, duration_seconds, average_rating,
                    play_count, skip_count, first_year, last_year, artwork_track_id,
                    sort_name, search_text
                )
                WITH artist_tracks AS (
                    SELECT {artist_expr} AS artist_name, tracks.*
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
                    WHERE artist_name <> ''
                    GROUP BY lower(artist_name)
                )
                SELECT
                    artist_name,
                    track_count,
                    album_count,
                    duration_seconds,
                    average_rating,
                    play_count,
                    skip_count,
                    first_year,
                    last_year,
                    artwork_track_id,
                    {sort_artist_name} AS sort_name,
                    artist_name || ' ' || coalesce(first_album, '') || ' ' || coalesce(first_genre, '') || ' ' || coalesce(first_year, '') || ' ' || coalesce(last_year, '') AS search_text
                FROM grouped
                "#,
                music_filter = music_only_clause(),
                sort_artist_name = sort_artist_name
            ),
            [],
        )
        .map_err(|error| format!("Could not refresh artist summaries: {error}"))?;

    transaction
        .execute(
            &format!(
                r#"
            INSERT INTO playlist_summaries(
                id, name, track_count, duration_seconds, created_at, updated_at, sort_name
            )
            SELECT
                playlists.id,
                playlists.name,
                count(playlist_tracks.track_id) AS track_count,
                sum(tracks.duration_seconds) AS duration_seconds,
                playlists.created_at,
                playlists.updated_at,
                {sort_playlist_name} AS sort_name
            FROM playlists
            LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
            LEFT JOIN tracks ON tracks.id = playlist_tracks.track_id
            GROUP BY playlists.id
            "#,
                sort_playlist_name = article_sort_expression("playlists.name")
            ),
            [],
        )
        .map_err(|error| format!("Could not refresh playlist summaries: {error}"))?;

    transaction
        .execute(
            &format!(
                r#"
                INSERT INTO library_stats_cache(
                    id, total_tracks, total_albums, total_artists, total_playlists,
                    rated_tracks, unrated_tracks, total_duration_seconds,
                    played_events, skipped_events, music_track_count, updated_at
                )
                SELECT
                    1,
                    (SELECT count(*) FROM tracks),
                    (SELECT count(DISTINCT album_id) FROM tracks),
                    (SELECT count(DISTINCT lower(coalesce(artist, ''))) FROM tracks),
                    (SELECT count(*) FROM playlists),
                    (SELECT sum(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) FROM tracks),
                    (SELECT sum(CASE WHEN rating IS NULL THEN 1 ELSE 0 END) FROM tracks),
                    (SELECT sum(duration_seconds) FROM tracks),
                    (SELECT count(*) FROM play_events WHERE event_type = 'played'),
                    (SELECT count(*) FROM play_events WHERE event_type = 'skipped'),
                    (SELECT count(*) FROM tracks WHERE {music_filter}),
                    datetime('now')
                "#,
                music_filter = music_only_clause()
            ),
            [],
        )
        .map_err(|error| format!("Could not refresh library stats cache: {error}"))?;

    transaction
        .execute(
            "INSERT INTO settings(key, value, updated_at) VALUES('library_derived_dirty', '0', datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            [],
        )
        .map_err(|error| format!("Could not mark derived library data clean: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save derived library refresh: {error}"))?;
    Ok(())
}

fn refresh_library_stats_cache(connection: &Connection) -> Result<(), String> {
    connection
        .execute("DELETE FROM library_stats_cache", [])
        .map_err(|error| format!("Could not clear library stats cache: {error}"))?;
    connection
        .execute(
            &format!(
                r#"
                INSERT INTO library_stats_cache(
                    id, total_tracks, total_albums, total_artists, total_playlists,
                    rated_tracks, unrated_tracks, total_duration_seconds,
                    played_events, skipped_events, music_track_count, updated_at
                )
                SELECT
                    1,
                    (SELECT count(*) FROM tracks),
                    (SELECT count(DISTINCT album_id) FROM tracks),
                    (SELECT count(DISTINCT lower(coalesce(artist, ''))) FROM tracks),
                    (SELECT count(*) FROM playlists),
                    (SELECT sum(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) FROM tracks),
                    (SELECT sum(CASE WHEN rating IS NULL THEN 1 ELSE 0 END) FROM tracks),
                    (SELECT sum(duration_seconds) FROM tracks),
                    (SELECT count(*) FROM play_events WHERE event_type = 'played'),
                    (SELECT count(*) FROM play_events WHERE event_type = 'skipped'),
                    (SELECT count(*) FROM tracks WHERE {music_filter}),
                    datetime('now')
                "#,
                music_filter = music_only_clause()
            ),
            [],
        )
        .map_err(|error| format!("Could not refresh library stats cache: {error}"))?;
    Ok(())
}

fn cached_music_track_count(connection: &Connection) -> Option<i64> {
    connection
        .query_row(
            "SELECT music_track_count FROM library_stats_cache WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .ok()
}
