# Architecture

FLAC Cafe keeps UI concerns separate from library and recommendation logic.

```text
React UI
  -> typed API helpers and Tauri commands
  -> Python FastAPI backend
  -> SQLite, mutagen scanner, file tag writer, recommender, CLAP analysis
```

The app started with a local FastAPI backend because the scanner, metadata handling, and recommender are Python-first. React talks to ordinary HTTP endpoints, which keeps the frontend easy to run in a browser preview and keeps backend behavior testable without the desktop shell. Tauri owns native concerns: windowing, folder dialogs, file reveal/open actions, process management, app icons, Windows media controls, and the optional Rust playback engine.

## Runtime Shape

- `npm run dev` starts the Python backend and a Vite preview for fast browser iteration.
- `npm run desktop` runs the Tauri shell against the dev backend/frontend flow.
- Packaged builds launch a bundled backend executable and hide the console window.
- Optional CLAP/Torch dependencies live outside the bundled backend in an app-managed ML runtime.

## Repo Layout

For the maintained file-tree guide, see [Project Structure](project-structure.md). The sketch below is the architecture-oriented view of the same boundaries.

```text
backend/
  app/
    main.py               FastAPI routes
    database.py           SQLite schema and migration helpers
    scanner.py            recursive audio scan and mutagen metadata parsing
    file_tags.py          opt-in metadata/rating/lyrics writes to audio files
    recommender.py        scoring, cooldowns, similarity, and temperature sampling
    clap_analysis.py      optional CLAP genre and embedding analysis
    ml_runtime.py         app-managed optional ML environment
    playlist.py           .m3u export and playlist import helpers
    schemas.py            API request and response models
  data/                   local dev SQLite database
  exports/                generated playlists

frontend/
  src/
    app/
      App.tsx             orchestration, global state, page composition
      shared.ts           app-level types, constants, formatting, persisted UI helpers
      components/         app-specific reusable UI and modals
      pages/              Library, AutoDJ, Analysis, Settings, Now Playing, Artist, History
      player/             bottom player and detached mini-player window
    lib/
      api.ts              typed HTTP API helpers
      nativePlayback.ts   Tauri bridge for experimental Rust playback
      tauriMedia.ts       Windows media-control bridge
      uiInteractions.ts   menu positioning and small UI helpers
    config/
      theme.ts            theme and font registry
      themes/             JSON theme palettes
    types/
      api.ts              shared frontend API data types
    styles.css            global Tailwind and theme variables

src-tauri/
  tauri.conf.json         Tauri v2 config and bundle metadata
  capabilities/           allowed Tauri commands
  src/main.rs             backend launcher, folder reveal, media-control commands
  src/native_playback.rs  rodio/cpal/Symphonia playback commands

scripts/
  dev.ps1                 Windows-friendly dev server runner
  run_backend.ps1         backend-only runner
  build_msi.ps1           MSI packaging helper
  test_backend.ps1        backend test helper
```

## Data Boundaries

- SQLite is the source of truth for ratings, play history, generated queues, playlists, lyrics, analysis results, and cached artist lookups.
- Audio files are read-only by default.
- File writes for ratings, metadata edits, and lyrics happen only when the matching setting or explicit target is enabled.
- CLAP embeddings are stored in SQLite as vectors for recommendation similarity; no ML data is written into audio tags.

## Frontend Boundaries

React components can request work, display progress, and keep local UI state. They should not parse audio files, walk folders, score recommendations, or mutate SQLite directly. When a feature needs music knowledge, add a backend API or Tauri command bridge instead.

`frontend/src/app/App.tsx` should stay focused on app orchestration. Page-sized UI belongs in `frontend/src/app/pages/`, playback surfaces belong in `frontend/src/app/player/`, and app-specific reusable pieces belong in `frontend/src/app/components/`.

## Native Boundaries

Tauri should stay thin. It can:

- Start, stop, and restart the backend process.
- Open folders, reveal files, and show native dialogs.
- Play local audio through the optional Rust playback engine.
- Publish Windows System Media Transport Controls state.
- Package the app and declare capabilities.

It should not duplicate the scanner, recommender, playlist engine, or database rules.
