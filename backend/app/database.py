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
  completion_expected_track_count INTEGER,
  completion_source TEXT,
  completion_release_id TEXT,
  completion_release_title TEXT,
  completion_checked_at TEXT,
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
  replaygain_track_gain_db REAL,
  replaygain_album_gain_db REAL,
  replaygain_track_peak REAL,
  replaygain_album_peak REAL,
  audio_fingerprint TEXT,
  acoustic_fingerprint TEXT,
  acoustic_fingerprint_updated_at TEXT,
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
  sidecar_path TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS track_custom_tags (
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag_key TEXT NOT NULL,
  tag_value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(track_id, tag_key)
);

CREATE TABLE IF NOT EXISTS virtual_tag_definitions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  expression TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS regex_tag_presets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  field TEXT NOT NULL,
  pattern TEXT NOT NULL,
  replacement TEXT NOT NULL DEFAULT '',
  case_sensitive INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS track_inbox_state (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed')),
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS track_inbox_notes (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inbox_auto_review_rules (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  field TEXT NOT NULL,
  match_type TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS device_sync_profiles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  target_folder TEXT NOT NULL DEFAULT '',
  device_kind TEXT NOT NULL DEFAULT 'folder',
  music_subfolder TEXT NOT NULL DEFAULT 'Music',
  playlist_subfolder TEXT NOT NULL DEFAULT 'Playlists',
  playlist_ids_json TEXT NOT NULL DEFAULT '[]',
  playlist_rules_json TEXT NOT NULL DEFAULT '{}',
  copy_files INTEGER NOT NULL DEFAULT 1,
  export_playlists INTEGER NOT NULL DEFAULT 1,
  preserve_structure INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audiobook_progress (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audiobook_bookmarks (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audiobook_chapters (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  start_seconds REAL NOT NULL DEFAULT 0,
  end_seconds REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(track_id, chapter_index)
);

CREATE TABLE IF NOT EXISTS podcast_subscriptions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  description TEXT,
  auto_download INTEGER NOT NULL DEFAULT 0,
  download_folder TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id INTEGER PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES podcast_subscriptions(id) ON DELETE CASCADE,
  track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT,
  published_at TEXT,
  duration_seconds REAL,
  local_path TEXT,
  download_status TEXT NOT NULL DEFAULT 'remote',
  downloaded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(subscription_id, guid)
);

CREATE TABLE IF NOT EXISTS radio_stations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  stream_url TEXT NOT NULL UNIQUE,
  homepage_url TEXT,
  genre TEXT,
  notes TEXT,
  last_played_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scrobble_accounts (
  service TEXT PRIMARY KEY CHECK (service IN ('listenbrainz', 'lastfm')),
  enabled INTEGER NOT NULL DEFAULT 0,
  username TEXT,
  token TEXT,
  api_key TEXT,
  api_secret TEXT,
  session_key TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scrobble_outbox (
  id INTEGER PRIMARY KEY,
  service TEXT NOT NULL CHECK (service IN ('listenbrainz', 'lastfm')),
  track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'played' CHECK (event_type IN ('played', 'loved')),
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  album TEXT,
  album_artist TEXT,
  listened_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS track_loves (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  loved INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'local',
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

CREATE TABLE IF NOT EXISTS bulk_action_undo_log (
  id INTEGER PRIMARY KEY,
  batch_id TEXT,
  action_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
CREATE INDEX IF NOT EXISTS idx_track_custom_tags_key ON track_custom_tags(tag_key);
CREATE INDEX IF NOT EXISTS idx_virtual_tag_definitions_name ON virtual_tag_definitions(name);
CREATE INDEX IF NOT EXISTS idx_regex_tag_presets_name ON regex_tag_presets(name);
CREATE INDEX IF NOT EXISTS idx_track_inbox_state_status ON track_inbox_state(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_track_inbox_notes_updated_at ON track_inbox_notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_inbox_auto_review_rules_enabled ON inbox_auto_review_rules(enabled, updated_at);
CREATE INDEX IF NOT EXISTS idx_device_sync_profiles_name ON device_sync_profiles(name);
CREATE INDEX IF NOT EXISTS idx_audiobook_bookmarks_track ON audiobook_bookmarks(track_id, position_seconds);
CREATE INDEX IF NOT EXISTS idx_audiobook_chapters_track ON audiobook_chapters(track_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_subscription ON podcast_episodes(subscription_id, published_at);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_status ON podcast_episodes(download_status);
CREATE INDEX IF NOT EXISTS idx_radio_stations_name ON radio_stations(lower(name));
CREATE INDEX IF NOT EXISTS idx_radio_stations_last_played ON radio_stations(last_played_at);
CREATE INDEX IF NOT EXISTS idx_scrobble_outbox_status ON scrobble_outbox(status, service, created_at);
CREATE INDEX IF NOT EXISTS idx_scrobble_outbox_track ON scrobble_outbox(track_id);
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
        ensure_track_lyrics_columns(active)
        ensure_podcast_episode_columns(active)
        ensure_album_completion_columns(active)
        active.executescript(SCHEMA)
        ensure_inbox_initialized(active)
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
        "replaygain_track_gain_db": "ALTER TABLE tracks ADD COLUMN replaygain_track_gain_db REAL",
        "replaygain_album_gain_db": "ALTER TABLE tracks ADD COLUMN replaygain_album_gain_db REAL",
        "replaygain_track_peak": "ALTER TABLE tracks ADD COLUMN replaygain_track_peak REAL",
        "replaygain_album_peak": "ALTER TABLE tracks ADD COLUMN replaygain_album_peak REAL",
        "audio_fingerprint": "ALTER TABLE tracks ADD COLUMN audio_fingerprint TEXT",
        "acoustic_fingerprint": "ALTER TABLE tracks ADD COLUMN acoustic_fingerprint TEXT",
        "acoustic_fingerprint_updated_at": "ALTER TABLE tracks ADD COLUMN acoustic_fingerprint_updated_at TEXT",
    }
    for column, sql in additions.items():
        if column not in columns:
            conn.execute(sql)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracks_acoustic_fingerprint ON tracks(acoustic_fingerprint)")
    undo_columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(bulk_action_undo_log)").fetchall()
    }
    if "batch_id" not in undo_columns:
        conn.execute("ALTER TABLE bulk_action_undo_log ADD COLUMN batch_id TEXT")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bulk_action_undo_log_batch ON bulk_action_undo_log(batch_id)")


def ensure_track_lyrics_columns(conn: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(track_lyrics)").fetchall()
    }
    if "sidecar_path" not in columns:
        conn.execute("ALTER TABLE track_lyrics ADD COLUMN sidecar_path TEXT")


def ensure_podcast_episode_columns(conn: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(podcast_episodes)").fetchall()
    }
    if "track_id" not in columns:
        conn.execute("ALTER TABLE podcast_episodes ADD COLUMN track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_podcast_episodes_track ON podcast_episodes(track_id)")


def ensure_album_completion_columns(conn: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(albums)").fetchall()
    }
    additions = {
        "completion_expected_track_count": "ALTER TABLE albums ADD COLUMN completion_expected_track_count INTEGER",
        "completion_source": "ALTER TABLE albums ADD COLUMN completion_source TEXT",
        "completion_release_id": "ALTER TABLE albums ADD COLUMN completion_release_id TEXT",
        "completion_release_title": "ALTER TABLE albums ADD COLUMN completion_release_title TEXT",
        "completion_checked_at": "ALTER TABLE albums ADD COLUMN completion_checked_at TEXT",
    }
    for column, sql in additions.items():
        if column not in columns:
            conn.execute(sql)


def ensure_inbox_initialized(conn: sqlite3.Connection) -> None:
    initialized = get_setting(conn, "inbox_initialized")
    if initialized:
        return

    conn.execute(
        """
        INSERT OR IGNORE INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
        SELECT id, 'reviewed', datetime('now'), datetime('now')
        FROM tracks
        """
    )
    set_setting(conn, "inbox_initialized", "1")


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
