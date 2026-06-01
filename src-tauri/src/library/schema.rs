use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;

const SCHEMA_SQL: &str = include_str!("../../../backend/app/schema.sql");

pub(crate) fn ensure_database_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(SCHEMA_SQL)
        .map_err(|error| format!("Could not initialize Rust database schema: {error}"))?;
    migrate_half_star_ratings(connection)?;
    ensure_track_analysis_columns(connection)?;
    ensure_track_lyrics_columns(connection)?;
    ensure_podcast_episode_columns(connection)?;
    ensure_album_completion_columns(connection)?;
    ensure_settings_columns(connection)?;
    connection
        .execute_batch(SCHEMA_SQL)
        .map_err(|error| format!("Could not finalize Rust database schema: {error}"))?;
    super::ensure_performance_schema(connection)?;
    ensure_inbox_initialized(connection)?;
    Ok(())
}

fn table_sql(connection: &Connection, table: &str) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
            params![table],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map(|row| row.flatten())
        .map_err(|error| format!("Could not inspect table {table}: {error}"))
}

fn table_columns(connection: &Connection, table: &str) -> Result<HashSet<String>, String> {
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| format!("Could not inspect columns for {table}: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>("name"))
        .map_err(|error| format!("Could not read columns for {table}: {error}"))?;
    rows.collect::<rusqlite::Result<HashSet<_>>>()
        .map_err(|error| format!("Could not decode columns for {table}: {error}"))
}

fn migrate_half_star_ratings(connection: &Connection) -> Result<(), String> {
    let Some(sql) = table_sql(connection, "tracks")? else {
        return Ok(());
    };
    if !sql.contains("rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)") {
        return Ok(());
    }

    connection
        .execute_batch(
            r#"
            PRAGMA foreign_keys = OFF;
            PRAGMA legacy_alter_table = ON;

            ALTER TABLE tracks RENAME TO tracks_old;

            CREATE TABLE tracks (
              id INTEGER PRIMARY KEY,
              path TEXT NOT NULL,
              path_key TEXT NOT NULL UNIQUE,
              title TEXT,
              artist TEXT,
              album TEXT,
              album_artist TEXT,
              album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
              track_number INTEGER,
              disc_number INTEGER,
              genre TEXT,
              year INTEGER,
              duration_seconds REAL,
              rating REAL CHECK (rating IS NULL OR rating BETWEEN 0.5 AND 5),
              play_count INTEGER NOT NULL DEFAULT 0,
              skip_count INTEGER NOT NULL DEFAULT 0,
              last_played_at TEXT,
              last_skipped_at TEXT,
              date_added TEXT NOT NULL DEFAULT (datetime('now')),
              file_modified_at TEXT,
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            INSERT INTO tracks(
              id, path, path_key, title, artist, album, album_artist, album_id,
              track_number, disc_number, genre, year, duration_seconds, rating,
              play_count, skip_count, last_played_at, last_skipped_at, date_added,
              file_modified_at, updated_at
            )
            SELECT
              id, path, path_key, title, artist, album, album_artist, album_id,
              track_number, disc_number, genre, year, duration_seconds, rating,
              play_count, skip_count, last_played_at, last_skipped_at, date_added,
              file_modified_at, updated_at
            FROM tracks_old;

            DROP TABLE tracks_old;

            PRAGMA legacy_alter_table = OFF;
            PRAGMA foreign_keys = ON;
            "#,
        )
        .map_err(|error| format!("Could not migrate Rust half-star ratings: {error}"))
}

fn add_missing_columns(
    connection: &Connection,
    table: &str,
    additions: &[(&str, &str)],
) -> Result<(), String> {
    let columns = table_columns(connection, table)?;
    for (column, sql) in additions {
        if !columns.contains(*column) {
            connection
                .execute(sql, [])
                .map_err(|error| format!("Could not add column {table}.{column}: {error}"))?;
        }
    }
    Ok(())
}

fn ensure_track_analysis_columns(connection: &Connection) -> Result<(), String> {
    add_missing_columns(
        connection,
        "tracks",
        &[
            (
                "analysis_provider",
                "ALTER TABLE tracks ADD COLUMN analysis_provider TEXT",
            ),
            (
                "analysis_model",
                "ALTER TABLE tracks ADD COLUMN analysis_model TEXT",
            ),
            (
                "analysis_genre",
                "ALTER TABLE tracks ADD COLUMN analysis_genre TEXT",
            ),
            (
                "analysis_genre_confidence",
                "ALTER TABLE tracks ADD COLUMN analysis_genre_confidence REAL",
            ),
            (
                "analysis_genre_tags",
                "ALTER TABLE tracks ADD COLUMN analysis_genre_tags TEXT",
            ),
            (
                "analysis_mood",
                "ALTER TABLE tracks ADD COLUMN analysis_mood TEXT",
            ),
            (
                "analysis_mood_confidence",
                "ALTER TABLE tracks ADD COLUMN analysis_mood_confidence REAL",
            ),
            (
                "analysis_mood_tags",
                "ALTER TABLE tracks ADD COLUMN analysis_mood_tags TEXT",
            ),
            (
                "analysis_embedding",
                "ALTER TABLE tracks ADD COLUMN analysis_embedding TEXT",
            ),
            (
                "analysis_updated_at",
                "ALTER TABLE tracks ADD COLUMN analysis_updated_at TEXT",
            ),
            ("bitrate", "ALTER TABLE tracks ADD COLUMN bitrate INTEGER"),
            (
                "replaygain_track_gain_db",
                "ALTER TABLE tracks ADD COLUMN replaygain_track_gain_db REAL",
            ),
            (
                "replaygain_album_gain_db",
                "ALTER TABLE tracks ADD COLUMN replaygain_album_gain_db REAL",
            ),
            (
                "replaygain_track_peak",
                "ALTER TABLE tracks ADD COLUMN replaygain_track_peak REAL",
            ),
            (
                "replaygain_album_peak",
                "ALTER TABLE tracks ADD COLUMN replaygain_album_peak REAL",
            ),
            (
                "audio_fingerprint",
                "ALTER TABLE tracks ADD COLUMN audio_fingerprint TEXT",
            ),
            (
                "acoustic_fingerprint",
                "ALTER TABLE tracks ADD COLUMN acoustic_fingerprint TEXT",
            ),
            (
                "acoustic_fingerprint_updated_at",
                "ALTER TABLE tracks ADD COLUMN acoustic_fingerprint_updated_at TEXT",
            ),
        ],
    )?;
    connection
        .execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_acoustic_fingerprint ON tracks(acoustic_fingerprint)",
            [],
        )
        .map_err(|error| format!("Could not create acoustic fingerprint index: {error}"))?;

    add_missing_columns(
        connection,
        "bulk_action_undo_log",
        &[(
            "batch_id",
            "ALTER TABLE bulk_action_undo_log ADD COLUMN batch_id TEXT",
        )],
    )?;
    connection
        .execute(
            "CREATE INDEX IF NOT EXISTS idx_bulk_action_undo_log_batch ON bulk_action_undo_log(batch_id)",
            [],
        )
        .map_err(|error| format!("Could not create undo batch index: {error}"))?;
    Ok(())
}

fn ensure_track_lyrics_columns(connection: &Connection) -> Result<(), String> {
    add_missing_columns(
        connection,
        "track_lyrics",
        &[(
            "sidecar_path",
            "ALTER TABLE track_lyrics ADD COLUMN sidecar_path TEXT",
        )],
    )
}

fn ensure_podcast_episode_columns(connection: &Connection) -> Result<(), String> {
    add_missing_columns(
        connection,
        "podcast_episodes",
        &[(
            "track_id",
            "ALTER TABLE podcast_episodes ADD COLUMN track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL",
        )],
    )?;
    connection
        .execute(
            "CREATE INDEX IF NOT EXISTS idx_podcast_episodes_track ON podcast_episodes(track_id)",
            [],
        )
        .map_err(|error| format!("Could not create podcast episode track index: {error}"))?;
    Ok(())
}

fn ensure_album_completion_columns(connection: &Connection) -> Result<(), String> {
    add_missing_columns(
        connection,
        "albums",
        &[
            (
                "artwork_locked",
                "ALTER TABLE albums ADD COLUMN artwork_locked INTEGER NOT NULL DEFAULT 0",
            ),
            (
                "completion_expected_track_count",
                "ALTER TABLE albums ADD COLUMN completion_expected_track_count INTEGER",
            ),
            (
                "completion_source",
                "ALTER TABLE albums ADD COLUMN completion_source TEXT",
            ),
            (
                "completion_release_id",
                "ALTER TABLE albums ADD COLUMN completion_release_id TEXT",
            ),
            (
                "completion_release_title",
                "ALTER TABLE albums ADD COLUMN completion_release_title TEXT",
            ),
            (
                "completion_checked_at",
                "ALTER TABLE albums ADD COLUMN completion_checked_at TEXT",
            ),
        ],
    )
}

fn ensure_settings_columns(connection: &Connection) -> Result<(), String> {
    add_missing_columns(
        connection,
        "settings",
        &[(
            "updated_at",
            "ALTER TABLE settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
        )],
    )?;
    connection
        .execute(
            "UPDATE settings SET updated_at = datetime('now') WHERE updated_at = ''",
            [],
        )
        .map_err(|error| format!("Could not backfill settings updated_at: {error}"))?;
    Ok(())
}

fn ensure_inbox_initialized(connection: &Connection) -> Result<(), String> {
    let initialized = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'inbox_initialized'",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|error| format!("Could not read inbox initialization setting: {error}"))?
        .flatten();
    if initialized.is_some() {
        return Ok(());
    }

    connection
        .execute(
            r#"
            INSERT OR IGNORE INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
            SELECT id, 'reviewed', datetime('now'), datetime('now')
            FROM tracks
            "#,
            [],
        )
        .map_err(|error| format!("Could not initialize Rust inbox state: {error}"))?;
    connection
        .execute(
            r#"
            INSERT INTO settings(key, value, updated_at)
            VALUES('inbox_initialized', '1', datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            "#,
            [],
        )
        .map_err(|error| format!("Could not save inbox initialization setting: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ensure_database_schema;
    use rusqlite::Connection;

    #[test]
    fn creates_schema_in_empty_database() {
        let connection = Connection::open_in_memory().unwrap();

        ensure_database_schema(&connection).unwrap();

        let track_count: i64 = connection
            .query_row("SELECT count(*) FROM tracks", [], |row| row.get(0))
            .unwrap();
        let settings_count: i64 = connection
            .query_row(
                "SELECT count(*) FROM settings WHERE key = 'inbox_initialized'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(track_count, 0);
        assert_eq!(settings_count, 1);
    }

    #[test]
    fn migrates_old_integer_rating_table() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                r#"
                CREATE TABLE albums (
                  id INTEGER PRIMARY KEY,
                  album TEXT,
                  album_artist TEXT,
                  year INTEGER,
                  artwork_path TEXT
                );
                CREATE TABLE tracks (
                  id INTEGER PRIMARY KEY,
                  path TEXT NOT NULL,
                  path_key TEXT NOT NULL UNIQUE,
                  title TEXT,
                  artist TEXT,
                  album TEXT,
                  album_artist TEXT,
                  album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
                  track_number INTEGER,
                  disc_number INTEGER,
                  genre TEXT,
                  year INTEGER,
                  duration_seconds REAL,
                  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
                  play_count INTEGER NOT NULL DEFAULT 0,
                  skip_count INTEGER NOT NULL DEFAULT 0,
                  last_played_at TEXT,
                  last_skipped_at TEXT,
                  date_added TEXT NOT NULL DEFAULT (datetime('now')),
                  file_modified_at TEXT,
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                INSERT INTO tracks(id, path, path_key, title, rating)
                VALUES(1, 'C:\Music\one.flac', 'c:\music\one.flac', 'One', 5);
                "#,
            )
            .unwrap();

        ensure_database_schema(&connection).unwrap();

        let sql: String = connection
            .query_row(
                "SELECT sql FROM sqlite_master WHERE name = 'tracks'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let rating: f64 = connection
            .query_row("SELECT rating FROM tracks WHERE id = 1", [], |row| {
                row.get(0)
            })
            .unwrap();
        let has_embedding: i64 = connection
            .query_row(
                "SELECT count(*) FROM pragma_table_info('tracks') WHERE name = 'analysis_embedding'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(sql.contains("rating REAL CHECK"));
        assert_eq!(rating, 5.0);
        assert_eq!(has_embedding, 1);
    }
}
