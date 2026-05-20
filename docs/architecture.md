# Architecture

The first prototype uses a local FastAPI backend instead of a Tauri command sidecar.

That is the simpler MVP path because the recommendation code is Python-first, the API can be tested independently, and the React app only needs ordinary HTTP calls. Tauri stays responsible for the desktop shell. When packaging becomes important, the FastAPI service can be launched as a managed sidecar or replaced by a small command bridge without moving scanner or recommender logic into the UI.

```text
React UI
  -> typed API helper functions
  -> FastAPI backend
  -> SQLite, mutagen scanner, recommender, M3U export
```

## Repo Layout

```text
backend/
  app/
    main.py          FastAPI routes
    database.py      SQLite schema and connection helpers
    scanner.py       recursive audio scan and mutagen metadata parsing
    recommender.py   scoring, cooldowns, and temperature sampling
    playlist.py      .m3u export
    schemas.py       API request and response models
  data/              local dev SQLite database
  exports/           generated playlists

frontend/
  src/
    App.tsx          desktop-style UI
    api.ts           HTTP API layer
    types.ts         shared frontend data types

src-tauri/
  tauri.conf.json    Tauri v2 desktop shell config
  src/main.rs        minimal shell entrypoint

scripts/
  run_backend.ps1    Windows-friendly backend runner
```

## MVP Boundaries

- Ratings are stored in SQLite only.
- Audio files are never modified.
- Playback is intentionally out of scope.
- Folder selection is a path input for the first slice; a Tauri dialog can be added once the shell toolchain is installed.

