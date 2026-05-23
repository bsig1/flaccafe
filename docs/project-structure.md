# Project Structure

FLAC Cafe is split by runtime boundary first, then by responsibility. The important rule is still: React owns presentation, Python owns library/recommendation behavior, and Tauri owns native desktop integration.

## Top-Level Tree

```text
.
├── backend/          Python FastAPI backend, scanner, SQLite, recommender, optional ML hooks
├── frontend/         React/TypeScript/Tailwind UI and browser-facing API clients
├── src-tauri/        Tauri v2 shell, Windows commands, app icons, and installer metadata
├── scripts/          Windows-oriented development, test, validation, and packaging helpers
├── docs/             Maintainer and user-facing project documentation
├── .github/          Issue templates and CI workflow
├── index.html        Vite HTML entry point
├── package.json      Node scripts and frontend/Tauri toolchain dependencies
├── tailwind.config.js
├── postcss.config.js
├── README.md
├── CONTRIBUTING.md
├── TODO.md
└── LICENSE
```

## Backend

```text
backend/
├── app/
│   ├── main.py              FastAPI route layer and app-level orchestration
│   ├── schemas.py           Pydantic request/response models
│   ├── database.py          SQLite schema setup and migration helpers
│   ├── scanner.py           recursive library scanning and mutagen metadata reads
│   ├── file_tags.py         opt-in metadata, rating, and lyric writes to audio files
│   ├── audiobooks.py        long-form resume positions, bookmarks, chapters, and sync exports
│   ├── inbox.py             Inbox notes and auto-review rule matching
│   ├── library_tools.py     filename-tag inference and file-organization helpers
│   ├── library_watcher.py   background folder-watch detection and pending-change apply logic
│   ├── musicbrainz_autotag.py MusicBrainz/Cover Art Archive auto-tag matching
│   ├── recommender.py       AutoDJ scoring, cooldowns, drift, and similarity helpers
│   ├── playlist.py          M3U export/import helpers
│   ├── podcasts.py          optional RSS subscription and episode download helpers
│   ├── scan_jobs.py         async scan job tracking
│   ├── analysis_jobs.py     async audio-analysis job tracking
│   ├── cd_ripping.py        CD drive detection, MusicBrainz lookup, ripping jobs, and playback commands
│   ├── clap_analysis.py     optional CLAP genre/embedding analysis
│   ├── clap_install_jobs.py optional ML runtime installation jobs
│   ├── ml_runtime.py        app-managed optional ML environment activation
│   └── config.py            storage paths and runtime configuration
├── tests/
│   ├── test_api.py
│   └── test_library_workflows.py
├── data/                    local dev database lives here; only `.gitkeep` is tracked
├── exports/                 generated playlists/reports/backups; only `.gitkeep` is tracked
├── models/
│   └── clap/.gitkeep        local model cache placeholder
├── desktop_backend.py       packaged backend executable entry point
├── requirements.txt         base Python dependencies
└── requirements-clap.txt    optional CLAP/Torch-side dependencies
```

Add backend features by starting with the narrowest module that owns the behavior. Use `main.py` for route wiring, but keep reusable scanner, recommender, metadata, and file-operation logic in focused modules. Tests belong in `backend/tests/`.

## Frontend

```text
frontend/
├── public/
│   └── icon.png
├── src/
│   ├── app/
│   │   ├── App.tsx          top-level orchestration and page composition
│   │   ├── shared.ts        app types, constants, formatting, shortcuts, persisted preferences
│   │   ├── shared.test.ts
│   │   ├── components/      reusable app-specific UI pieces and modals
│   │   ├── pages/           page-sized surfaces, with per-page section folders for larger tools
│   │   └── player/          bottom player and detached mini-player window
│   ├── config/
│   │   ├── theme.ts         theme/font registry
│   │   └── themes/          JSON palette files
│   ├── lib/
│   │   ├── api.ts           typed FastAPI client boundary
│   │   ├── nativePlayback.ts Tauri bridge for experimental Rust playback
│   │   ├── tauriMedia.ts    Windows media-control bridge
│   │   └── uiInteractions.ts framework-light UI helpers
│   ├── test/
│   │   └── setup.ts         Vitest setup
│   ├── types/
│   │   └── api.ts           frontend API data shapes
│   ├── main.tsx             React entry point
│   ├── styles.css           Tailwind layers and theme variables
│   └── vite-env.d.ts
├── tsconfig.json
└── vitest.config.ts
```

Add page-level UI in `frontend/src/app/pages/`. When a page grows into several independent panels, keep the page as the coordinator and move those panels into a same-named subfolder such as `pages/settings/` or `pages/file-management/`. Add reusable controls in `frontend/src/app/components/`. Keep backend calls in `frontend/src/lib/api.ts` instead of calling `fetch` from page components. Keep native Tauri calls behind small bridge modules in `frontend/src/lib/`.

## Tauri Shell

```text
src-tauri/
├── src/
│   ├── main.rs              app setup, backend launcher, folder/file commands
│   ├── native_playback.rs   rodio/cpal/Symphonia playback commands
│   └── smtc.rs              Windows System Media Transport Controls integration
├── capabilities/
│   └── default.json         allowed Tauri command surface
├── icons/                   source and generated application icons
├── gen/schemas/             generated Tauri schema files
├── tauri.conf.json          bundle/app metadata
├── Cargo.toml
├── Cargo.lock
└── build.rs
```

Tauri should stay thin outside native desktop concerns. Put native windowing, dialogs, process management, file reveal/open, Windows media-control work, and the optional Rust playback engine here. Do not duplicate scanner, recommender, playlist, or database rules in Rust.

## Scripts

```text
scripts/
├── dev.ps1                   starts backend and Vite preview for development
├── run_backend.ps1           backend-only development runner
├── stop_dev.ps1              stops known dev server/backend processes
├── test_backend.ps1          backend unittest helper using `.venv` when available
├── check_backend_routes.py   verifies route docs against FastAPI decorators
├── build_msi.ps1             MSI packaging helper
├── ci_installer_roundtrip.ps1 installs, health-checks, and uninstalls the MSI in CI/disposable profiles
├── installer_smoke.ps1       installer smoke-test helper
├── validate_clap_runtime.ps1 optional ML runtime validator
├── generate_icon.ps1         icon generation helper
└── changelog_preview.ps1     release-note preview helper
```

Scripts are Windows-first because the app is currently Windows-first. Prefer adding small, explicit scripts over hiding important release or runtime steps inside long package commands.

## Documentation

```text
docs/
├── index.md
├── architecture.md
├── project-structure.md
├── backend-routes.md
├── database-maintenance.md
├── library-tools.md
├── csv-metadata-cleanup.md
├── playback.md
├── themes.md
├── clap-analysis.md
├── keyboard-shortcuts.md
├── troubleshooting.md
├── testing.md
├── release-checklist.md
└── release-documentation-checklist.md
```

Use `docs/project-structure.md` for file ownership and placement questions. Use `docs/architecture.md` for runtime boundaries and higher-level design rationale.

## Ignored Local And Generated Paths

These directories are expected during development but should not be committed:

```text
.venv/
.tools/
node_modules/
frontend/dist/
src-tauri/target/
backend/data/*
backend/exports/*
backend/logs/
backend/models/*
build-backend*/
dist-backend*/
.tmp-*/
*.msi
```

The `.gitkeep` files under `backend/data/`, `backend/exports/`, and `backend/models/clap/` preserve useful empty directories in fresh clones while keeping databases, reports, playlists, backups, logs, models, and installer artifacts out of git.

## Where New Work Usually Goes

- New API route: `backend/app/main.py`, schema in `backend/app/schemas.py`, tests in `backend/tests/`, frontend call in `frontend/src/lib/api.ts`.
- New scanner or metadata behavior: `backend/app/scanner.py`, `backend/app/file_tags.py`, or `backend/app/library_tools.py`.
- New AutoDJ behavior: `backend/app/recommender.py`, plus route wiring if it needs UI controls.
- New page: `frontend/src/app/pages/`, wired through `frontend/src/app/App.tsx` and `frontend/src/app/components/Sidebar.tsx`.
- New reusable UI: `frontend/src/app/components/`.
- New native desktop command: `src-tauri/src/main.rs`, capability in `src-tauri/capabilities/default.json`, bridge in `frontend/src/lib/`.
- New documentation: add or update the narrowest doc under `docs/`, then link it from `README.md` if it is user-facing.
