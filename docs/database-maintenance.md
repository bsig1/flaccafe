# Database Maintenance Guide

FLAC Cafe stores user library data in SQLite. The app treats SQLite as the source of truth for ratings, playlists, lyrics, analysis results, and maintenance state. Audio-file writes are optional and only happen when the user enables file writing.

## Storage Location

The database path is shown in Settings. Rust and Python both honor `MUSIC_REC_DB` for tests and otherwise use the FLAC Cafe app data folder in packaged builds. In desktop dev, the default database stays under `backend/data/`.

## Schema Ownership

Rust owns schema creation and lightweight desktop migrations through `src-tauri/src/library/schema.rs`, backed by the shared SQL file at `backend/app/schema.sql`. Python test and worker helpers read the same SQL file so both runtimes agree on table shape. Keep new tables and columns in the shared schema, then add idempotent Rust compatibility migrations when upgrading existing user databases.

Core tables:

- `tracks` stores local-file identity, metadata, ratings, play counts, skip counts, file state, and audio-analysis fields.
- `albums` stores normalized album summaries connected from tracks.
- `play_events` records played, skipped, and rated events.
- `playlists` and `playlist_tracks` store manual playlists.
- `recommendation_profiles` and `recommendation_runs` store AutoDJ tuning and generated queue history.
- `autodj_avoid_rules` and `recommendation_feedback` store recommendation preferences.
- `lyrics`, `artist_info_cache`, `artwork_cache`, and `track_metadata_cache` store derived or optional enrichment data.
- `settings` stores simple key/value app flags.

## Migration Rules

- Use `CREATE TABLE IF NOT EXISTS` for new tables.
- Use `PRAGMA table_info` checks before `ALTER TABLE ADD COLUMN`.
- Never drop or rewrite user tables during startup.
- Preserve unknown settings and JSON fields so future versions can round-trip older data.
- When moving or deleting audio files, update `tracks.path`, `tracks.path_key`, and relevant cache rows in the same SQLite transaction.
- Keep generated data clearable through maintenance tools rather than mixing it with user-authored metadata.

## Backups And Risky Operations

The Settings backup button copies the current SQLite file to the export folder. Maintenance tools should be preview-first when they can change many rows or touch files. File organization, filename tag inference, and CSV metadata import all follow that pattern.

Recommended checklist for a risky database change:

1. Add or update `backend/app/schema.sql` and any Rust compatibility migration in `src-tauri/src/library/schema.rs`.
2. Add API tests that initialize a fresh database and exercise an upgraded database shape when practical.
3. Make the UI preview changes before applying bulk edits.
4. Run `python -m unittest backend.tests.test_api`.
5. Run `python -m compileall -q backend`.

## Cache And Derived Data

Cache tables are disposable. `POST /library/maintenance/clear` can remove artist lookup cache, artwork cache, metadata cache, recommendation history, and scan error samples without touching tracks, ratings, playlists, or audio files.

Hot library views also use derived read models:

- `tracks_fts` is a SQLite FTS5 index for non-empty track searches.
- `album_summaries`, `artist_summaries`, and `playlist_summaries` materialize browse rows.
- `library_stats_cache` stores expensive library counters.
- `library_query_cache` stores small UI page responses.

Triggers clear the small page cache and mark derived summaries dirty when metadata/search/summary fields change. Play/skip history only refreshes stats, so normal playback does not force an album/artist summary rebuild. Scans refresh derived data once at the end when inserted, updated, or removed counts are non-zero.

When adding a new derived-data table, decide whether it needs:

- a clear-cache target,
- support-bundle redaction,
- a Settings UI button,
- a migration note in this document.
