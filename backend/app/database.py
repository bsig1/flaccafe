from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable

from .config import database_path


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY,
  album TEXT,
  album_artist TEXT,
  year INTEGER,
  artwork_path TEXT,
  UNIQUE(album, album_artist, year)
);

CREATE TABLE IF NOT EXISTS tracks (
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
  analysis_provider TEXT,
  analysis_model TEXT,
  analysis_genre TEXT,
  analysis_genre_confidence REAL,
  analysis_genre_tags TEXT,
  analysis_embedding TEXT,
  analysis_updated_at TEXT,
  year INTEGER,
  duration_seconds REAL,
  bitrate INTEGER,
  audio_fingerprint TEXT,
  rating REAL CHECK (rating IS NULL OR rating BETWEEN 0.5 AND 5),
  play_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  last_played_at TEXT,
  last_skipped_at TEXT,
  date_added TEXT NOT NULL DEFAULT (datetime('now')),
  file_modified_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS play_events (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('played', 'skipped', 'rated')),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id INTEGER PRIMARY KEY,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS smart_playlists (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rule_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artist_info_cache (
  artist_key TEXT PRIMARY KEY,
  artist_name TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  page_url TEXT,
  source TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS autodj_avoid_rules (
  id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('track', 'artist', 'album', 'genre')),
  target_key TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scope, target_key)
);

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('play_next', 'add_to_queue', 'manual_play')),
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS track_metadata_cache (
  path_key TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  file_modified_at TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scan_error_samples (
  id INTEGER PRIMARY KEY,
  path_hash TEXT NOT NULL,
  folder_hash TEXT NOT NULL,
  extension TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recommendation_profiles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  settings_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recommendation_runs (
  id INTEGER PRIMARY KEY,
  settings_json TEXT NOT NULL,
  drift_json TEXT NOT NULL,
  track_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS track_lyrics (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  lyrics TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'database:manual',
  is_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artwork_cache (
  path_key TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  file_modified_at TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  data BLOB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(rating);
CREATE INDEX IF NOT EXISTS idx_tracks_last_played ON tracks(last_played_at);
CREATE INDEX IF NOT EXISTS idx_play_events_track_id ON play_events(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_smart_playlists_name ON smart_playlists(name);
CREATE INDEX IF NOT EXISTS idx_artist_info_updated_at ON artist_info_cache(updated_at);
CREATE INDEX IF NOT EXISTS idx_autodj_avoid_rules_scope ON autodj_avoid_rules(scope, target_key);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_track_id ON recommendation_feedback(track_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scan_error_samples_created_at ON scan_error_samples(created_at);
CREATE INDEX IF NOT EXISTS idx_recommendation_profiles_default ON recommendation_profiles(is_default);
CREATE INDEX IF NOT EXISTS idx_recommendation_runs_created_at ON recommendation_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_track_lyrics_updated_at ON track_lyrics(updated_at);
"""


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        try:
            return bool(super().__exit__(exc_type, exc_value, traceback))
        finally:
            self.close()


def connect(path: Path | None = None) -> sqlite3.Connection:
    db_path = path or database_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, factory=ClosingConnection)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection | None = None) -> None:
    own_connection = conn is None
    active = conn or connect()
    try:
        active.executescript(SCHEMA)
        migrate_half_star_ratings(active)
        ensure_track_analysis_columns(active)
        active.executescript(SCHEMA)
        active.commit()
    finally:
        if own_connection:
            active.close()


def migrate_half_star_ratings(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tracks'"
    ).fetchone()
    if row is None or "rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)" not in (row["sql"] or ""):
        return

    conn.executescript(
        """
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
        """
    )


def ensure_track_analysis_columns(conn: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(tracks)").fetchall()
    }
    additions = {
        "analysis_provider": "ALTER TABLE tracks ADD COLUMN analysis_provider TEXT",
        "analysis_model": "ALTER TABLE tracks ADD COLUMN analysis_model TEXT",
        "analysis_genre": "ALTER TABLE tracks ADD COLUMN analysis_genre TEXT",
        "analysis_genre_confidence": "ALTER TABLE tracks ADD COLUMN analysis_genre_confidence REAL",
        "analysis_genre_tags": "ALTER TABLE tracks ADD COLUMN analysis_genre_tags TEXT",
        "analysis_embedding": "ALTER TABLE tracks ADD COLUMN analysis_embedding TEXT",
        "analysis_updated_at": "ALTER TABLE tracks ADD COLUMN analysis_updated_at TEXT",
        "bitrate": "ALTER TABLE tracks ADD COLUMN bitrate INTEGER",
        "audio_fingerprint": "ALTER TABLE tracks ADD COLUMN audio_fingerprint TEXT",
    }
    for column, sql in additions.items():
        if column not in columns:
            conn.execute(sql)


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def get_setting(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return None if row is None else row["value"]


def set_setting(conn: sqlite3.Connection, key: str, value: str | None) -> None:
    conn.execute(
        """
        INSERT INTO settings(key, value)
        VALUES(?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key, value),
    )
