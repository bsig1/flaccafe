# Architecture

FLAC Cafe keeps presentation, controller logic, desktop integration, and expert
library work in separate lanes.

```text
React UI
  -> typed API helpers and Tauri commands
  -> Rust app controller, SQLite paths, media protocol, and desktop commands
  -> SQLite, Lofty metadata I/O, recommender, playback, and optional CLAP worker calls
```

The app started with Python/FastAPI because early scanning and metadata work were
Python-first. The desktop runtime no longer starts Python as an HTTP backend.
Rust owns the app-facing route surface and all frontend calls go through Tauri
commands. Python is now a narrow expert-worker layer for CLAP/Torch dependency
checks, optional runtime package installation, and model inference.

## Runtime Shape

- `npm run dev` and `npm run desktop` run the Tauri shell.
- Rust creates and migrates the SQLite database before any Python expert process is spawned.
- Packaged builds include a small Python sidecar executable, but it only accepts named expert entry points such as `--clap-expert` and `--clap-worker`.
- CLAP setup/status/install job state is Rust-owned. Python performs the pip/Torch/runtime work that depends on Python tooling.
- CLAP batch analysis is Rust-orchestrated and uses a persistent Python worker so the Torch model stays warm for a batch.
- Optional CLAP/Torch dependencies live outside the bundled app in `%LOCALAPPDATA%\FLAC Cafe\ml-runtime`.

## Data Boundaries

- SQLite is the source of truth for ratings, play history, generated queues, playlists, lyrics, analysis results, sources, podcasts, radio stations, and cached lookups.
- Audio files are read-only by default.
- File writes for ratings, metadata edits, lyrics, and artwork happen only when the matching setting or explicit action is enabled.
- CLAP embeddings are stored in SQLite for recommendation similarity; no ML data is written into audio tags.

## Frontend Boundaries

React components request work, display progress, and keep local UI state. They
should not parse audio files, walk folders, score recommendations, or mutate
SQLite directly. Backend calls belong behind the `frontend/src/lib/api.ts`
barrel and its domain modules in `frontend/src/lib/api/`, with Tauri bridges
kept behind small modules in `frontend/src/lib/`.

`frontend/src/app/App.tsx` should stay focused on orchestration. Page-sized UI
belongs in `frontend/src/app/pages/`, playback surfaces belong in
`frontend/src/app/player/`, and app-specific reusable pieces belong in
`frontend/src/app/components/`.

## Rust Controller Boundaries

Rust can and should own deterministic app work:

- SQLite schema/migrations, reads, writes, cache invalidation, and maintenance.
- Library scans, folder watching, missing-file cleanup, and source removal.
- Common metadata reads/writes through Lofty.
- Local media/artwork serving through the `flaccafe-media://` protocol.
- AutoDJ generation, recommendation profiles, avoid rules, and queue history.
- MusicBrainz/AcoustID matching, LRCLIB lookups, podcasts, scrobbling, imports, file organization, audio conversion orchestration, CD workflows, and diagnostics.
- Desktop integration such as dialogs, reveal-in-folder, media keys, playback, and installer resources.

Feature modules under `src-tauri/src/library/` should own complete domains when
possible. `mod.rs` is the small module root; playlist CRUD lives in
`playlists.rs`, playlist file parsing/import/export lives in
`playlist_files.rs`, audiobook state lives in `audiobooks.rs`, and shared
SQLite row decoding lives in `rows.rs`. Keep adding modules there instead of
growing the module root when a domain has a clear boundary.

Python calls should stay rare and explicit. Today they are reserved for CLAP/Torch
operations where the Python ecosystem is still the safer and more useful tool.
