# Architecture

FLAC Cafe keeps UI concerns separate from library and recommendation logic.

```text
React UI
  -> typed API helpers and Tauri commands
  -> Rust app controller, media protocol, SQLite paths, or Python expert-worker bridge
  -> SQLite, Lofty metadata reader/writer, recommender, CLAP analysis
```

The app started with a local HTTP backend because the scanner, metadata handling, and recommender were Python-first. React still talks through typed helpers, but desktop builds now use Rust as the app-facing controller. High-traffic SQLite paths, local media bytes, MusicBrainz/AcoustID matching, podcast RSS/download work, scrobbling flows, external-library imports, and common tag reads/writes run in Rust. Features that still need Python expertise are called as named Python worker actions. Rust owns the app-facing path mapping; Python does not receive or dispatch HTTP requests in the desktop runtime.

## Runtime Shape

- `npm run dev` and `npm run desktop` run the Tauri shell against the Vite preview and Python worker bridge.
- Packaged builds invoke the bundled Python executable per worker request and hide the console window.
- CLAP batch analysis is Rust-orchestrated, but uses a persistent Python worker during the batch so the Torch model is loaded once.
- Optional CLAP/Torch dependencies live outside the bundled backend in an app-managed ML runtime.
- Startup stays intentionally light: Rust health is available immediately in desktop builds, and optional CLAP/tool probes remain lazy.

## Repo Layout

For the maintained file-tree guide, see [Project Structure](project-structure.md). The sketch below is the architecture-oriented view of the same boundaries.

```text
backend/
  app/
    main.py               Python expert-worker action functions and thin domain orchestration
    duplicates.py         duplicate scoring and grouping helpers
    worker.py             one-shot named-action worker entry point used by Rust
    clap_worker.py        persistent JSON-lines worker for CLAP batch inference
    database.py           Python test/worker DB helpers that share the Rust-owned schema file
    schema.sql            shared SQLite schema used by Rust before Python worker startup
    scanner.py            test scanner helpers and Python worker batch compatibility
    file_tags.py          specialized embedded artwork/lyrics and volume-tag writes
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
      appHelpers.ts       startup cache, CD playback, source-folder, and lyric helper logic
      shared.ts           app-level types, constants, formatting, persisted UI helpers
      components/         app-specific reusable UI and modals
      pages/              Library, AutoDJ, Analysis, Settings, Now Playing, Artist, History
      player/             bottom player and detached mini-player window
    lib/
      api.ts              typed API helpers with Rust-first calls and Rust-to-Python worker routing
      nativeLibrary.ts    compatibility Tauri bridge for Rust SQLite fast paths and worker calls
      nativePlayback.ts   compatibility Tauri bridge for experimental Rust playback
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
  src/main.rs             app setup, folder reveal, media-control commands
  src/native_playback.rs  rodio/cpal/Symphonia playback session commands
  src/native_playback/    playback DSP, EQ, limiter, and source wrappers
  src/native_library.rs   Rust app-controller command glue and shared DB helpers
  src/native_library/     Rust app-controller feature modules, media protocol, CLAP/audio jobs, online matching, podcasts, recommendations, history, inbox, and profiles

  scripts/
  dev.ps1                 Windows-friendly desktop dev runner
  run_backend.ps1         worker health-check helper
  build_backend_sidecar.ps1 packaged Python backend folder builder
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

## Rust Controller Boundaries

Tauri owns desktop integration work and selected SQLite fast paths. It can:

- Clear worker state and stop any legacy backend process left on the old dev port.
- Open folders, reveal files, and show desktop dialogs.
- Play local audio through the optional Rust playback engine.
- Serve WebView local track audio and artwork through the `flaccafe-media://` protocol.
- Publish Windows System Media Transport Controls state.
- Create and migrate the SQLite database before Python worker actions are spawned, run maintenance paths such as backup/reset/support bundles/startup self-checks/log tails, own scan and folder-watch orchestration plus filesystem diffing, read/write common audio tags with Lofty, then serve high-traffic SQLite reads and simple DB mutations when they mirror tested route behavior, including library browsing, albums/artists/playlists, history/stats, inbox review state, podcasts, scrobbling, external library imports, MusicBrainz/AcoustID matching, saved recommendation profiles, local tool presets, device sync profiles, AutoDJ generation, FFmpeg install/conversion job orchestration, CLAP job orchestration, CLAP genre-tag previews, and local artwork cache serving.
- Resolve app paths through `src-tauri/src/python_worker/native_routes.rs` first, then forward only Python-owned work to named worker actions without exposing Python as an HTTP controller.
- Package the app and declare capabilities.

Python remains the owner for CLAP/Torch inference, CD ripping/playback helpers that have not moved yet, audio-conversion artwork copy helpers, and specialized embedded artwork/lyrics writes that still need safer fixtures before Rust writes them directly. Rust paths should stay deterministic and grouped by feature area as they grow; Python worker calls are reserved for expert tasks where the Python ecosystem is still materially safer than the Rust equivalent.
