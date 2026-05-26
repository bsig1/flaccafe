# Project Structure

FLAC Cafe is split by runtime boundary first, then by responsibility. The important rule is still: React owns presentation, Rust owns the app-facing controller and desktop integration work, and Python remains the expert worker only where a Python library is still materially safer or more useful.

## Top-Level Tree

```text
.
├── backend/          Python worker modules, scanner, SQLite, recommender, optional ML hooks
├── frontend/         React/TypeScript/Tailwind UI and browser-facing API clients
├── src-tauri/        Tauri v2 shell, Windows commands, app icons, and installer metadata
├── extensions/       bundled extension/skin manifest examples
├── scripts/          Windows-oriented development, test, validation, and packaging helpers
├── docs/             Maintainer and user-facing project documentation
├── .github/          Issue templates and CI workflow
├── index.html        Vite HTML entry point
├── vite.config.ts    Vite config shared by dev/build/test entry points
├── package.json      Node scripts and frontend/Tauri toolchain dependencies
├── tailwind.config.js
├── postcss.config.js
├── README.md
├── CONTRIBUTING.md
├── THIRD_PARTY_NOTICES.md
├── TODO.md
└── LICENSE
```

## Backend

```text
backend/
├── app/
│   ├── main.py              Python worker action functions and thin domain orchestration
│   ├── worker.py            one-shot named-action worker entry point used by Rust/Tauri
│   ├── clap_worker.py       persistent JSON-lines worker used during CLAP analysis batches
│   ├── schemas.py           Pydantic request/response models
│   ├── database.py          Python test/worker DB helpers sharing the Rust-owned schema
â”‚   â”œâ”€â”€ duplicates.py        duplicate scoring and grouping helpers
│   ├── scanner.py           legacy/test scanner helpers and worker batch compatibility
│   ├── file_tags.py         opt-in metadata, rating, and lyric writes to audio files
│   ├── volume_tags.py       ReplayGain-style volume tag preview/write helpers
│   ├── extensions.py        skin/plugin manifest discovery and validation
│   ├── audiobooks.py        long-form resume positions, bookmarks, chapters, and sync exports
│   ├── inbox.py             Inbox notes and auto-review rule matching
│   ├── library_importers.py MusicBee/iTunes/WMP rating and play-count imports
│   ├── library_tools.py     filename-tag inference and file-organization helpers
│   ├── library_watcher.py   background folder-watch detection and pending-change apply logic
│   ├── musicbrainz_autotag.py MusicBrainz/Cover Art Archive auto-tag matching
│   ├── recommender.py       AutoDJ scoring, cooldowns, drift, and similarity helpers
│   ├── gapless.py           adjacent-track metadata checks for Rust gapless validation
│   ├── playlist.py          M3U export/import helpers
│   ├── podcasts.py          optional RSS subscription and episode download helpers
│   ├── radio.py             web radio bookmark storage and last-played tracking
│   ├── scan_jobs.py         async scan job tracking
│   ├── scrobbling.py        ListenBrainz/Last.fm outbox, loved tracks, and history import
│   ├── analysis_jobs.py     legacy/helper audio-analysis job shapes used by Python-owned flows
│   ├── cd_ripping.py        CD drive detection, MusicBrainz lookup, ripping jobs, and playback commands
│   ├── clap_analysis.py     optional CLAP genre/embedding analysis
│   ├── clap_install_jobs.py optional ML runtime installation jobs
│   ├── ml_runtime.py        app-managed optional ML environment activation
│   └── config.py            storage paths and runtime configuration
├── tests/
│   ├── test_api.py
│   ├── test_library_workflows.py
│   └── test_volume_tags.py
├── cache/                   local derived preview/cache files; ignored by git
├── data/                    local dev database lives here; only `.gitkeep` is tracked
├── exports/                 generated playlists/reports/backups; only `.gitkeep` is tracked
├── models/
│   └── clap/.gitkeep        local model cache placeholder
├── tools/                   bundled small helper tools plus runtime-managed optional tools
│   ├── chromaprint/         bundled `fpcalc` docs/status placeholder
│   └── cd-rip/              bundled Windows CD helper tools and license notes
├── desktop_backend.py       packaged Python executable entry point for worker calls
├── requirements.txt         base Python dependencies
└── requirements-clap.txt    optional CLAP/Torch-side dependencies
```

Add backend features by starting with the narrowest module that owns the behavior. Rust maps frontend paths to Rust handlers first, then to named worker actions only when Python expertise is needed. The Python worker is no longer the owner for MusicBrainz/AcoustID matching, podcasts, scrobbling flows, external-library imports, or file deletion/restoration. Startup-sensitive optional systems should stay behind lazy imports, action-local helpers, or persistent workers that Rust starts explicitly for a batch; `backend/app/startup_profile.py` records lightweight timing breadcrumbs for backend launch checks. Tests belong in `backend/tests/`.

## Frontend

```text
frontend/
├── public/
│   └── icon.png
├── src/
│   ├── app/
│   │   ├── App.tsx          top-level orchestration and page composition
â”‚   â”‚   â”œâ”€â”€ appHelpers.ts    startup cache, CD playback, source-folder, and lyric helper logic
│   │   ├── shared.ts        app types, constants, formatting, shortcuts, persisted preferences
│   │   ├── shared.test.ts
│   │   ├── components/      reusable app-specific UI pieces and modals
│   │   ├── pages/           page-sized surfaces, with per-page section folders for larger tools
│   │   │   ├── file-management/ File Management sections and navigator
â”‚   â”‚   â”‚   â”œâ”€â”€ library/         Library view helpers and tab controls
│   │   │   ├── settings/        Settings sections
│   │   │   └── sources/         Source-folder and folder-watch sections
│   │   └── player/          bottom player and detached mini-player window
│   ├── config/
│   │   ├── theme.ts         theme/font registry
│   │   └── themes/          JSON palette files
│   ├── lib/
│   │   ├── api.ts           typed API boundary with Rust-first calls and Python-worker routing
│   │   ├── nativeLibrary.ts  compatibility Tauri bridge for Rust SQLite fast paths and worker calls
│   │   ├── nativePlayback.ts Tauri bridge for experimental Rust playback
│   │   ├── tauriMedia.ts    Windows media-control bridge
│   │   ├── externalLinks.ts Tauri/browser external-link opener
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

Add page-level UI in `frontend/src/app/pages/`. When a page grows into several independent panels, keep the page as the coordinator and move those panels into a same-named subfolder such as `pages/settings/` or `pages/file-management/`. File Management uses that pattern for self-contained tools plus its search/category navigator, so new maintenance tools should usually land there instead of expanding `FileManagementPage.tsx`. Add reusable controls in `frontend/src/app/components/`. Keep backend calls in `frontend/src/lib/api.ts` instead of calling `fetch` from page components. Keep Tauri calls behind small bridge modules in `frontend/src/lib/`.

## Tauri Shell

```text
src-tauri/
├── src/
│   ├── main.rs              app setup, folder/file commands, desktop command registration
│   ├── native_library.rs    Rust app-controller command glue and shared DB helpers
│   ├── native_library/      Rust app-controller feature modules
│   │   ├── analysis/          CLAP job orchestration, persistent worker protocol, and genre-tag tools
│   │   ├── audio_conversion.rs FFmpeg install/conversion preview and job orchestration
│   │   ├── inbox.rs           Inbox notes/review state fast paths
│   │   ├── library_tools.rs   saved local tool state such as presets and sync profiles
│   │   ├── media_protocol.rs  WebView local audio/artwork protocol
│   │   ├── recommendation_profiles.rs AutoDJ profiles, history, and feedback fast paths
│   │   ├── recommendations.rs AutoDJ, avoid rules, and similarity scoring
│   │   └── types.rs          serialized Rust API response types
│   ├── native_playback.rs   rodio/cpal/Symphonia playback session commands
│   ├── native_playback/     playback engine helper modules
│   │   └── dsp.rs            EQ, normalization, limiter, and source wrapper
│   ├── python_worker.rs     local Rust-to-Python JSON worker bridge
│   ├── python_worker/       Rust-owned path-to-action mapping for Python calls
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

Tauri should stay thin outside desktop integration concerns and selected SQLite paths. Put windowing, dialogs, process management, file reveal/open, Windows media-control work, the optional Rust playback engine, local media serving, Rust-first database routes, common Lofty tag reads/writes, online matching, podcast/scrobbling/import flows, and Python worker dispatch here. Python remains the owner for CLAP/Torch inference, CD/audio helper work that has not moved yet, and specialized embedded artwork/lyrics writes; Rust should call the Python worker bridge only for expert paths that still depend on stronger Python libraries.

## Scripts

```text
scripts/
├── dev.ps1                   starts Tauri desktop development
├── run_backend.ps1           Python worker health-check helper
├── stop_dev.ps1              stops known dev server/backend processes
├── test_backend.ps1          backend unittest helper using `.venv` when available
├── check_backend_routes.py   verifies route docs against the Rust-owned route table
├── build_backend_sidecar.ps1 builds the packaged Python backend folder used by Tauri
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
backend/cache/*
backend/logs/
backend/models/*
build-backend*/
dist-backend*/
.tmp-*/
*.msi
```

The `.gitkeep` files under `backend/data/`, `backend/exports/`, and `backend/models/clap/` preserve useful empty directories in fresh clones while keeping databases, reports, playlists, backups, generated CD previews, logs, models, and installer artifacts out of git.

## Where New Work Usually Goes

- New app endpoint: domain function in `backend/app/main.py`, schema in `backend/app/schemas.py`, Rust worker mapping in `src-tauri/src/python_worker/routes.rs` if Python-owned, tests in `backend/tests/`, frontend call in `frontend/src/lib/api.ts`.
- New scanner or metadata behavior: `backend/app/scanner.py`, `backend/app/file_tags.py`, or `backend/app/library_tools.py`.
- New AutoDJ behavior: `backend/app/recommender.py`, plus route wiring if it needs UI controls.
- New page: `frontend/src/app/pages/`, wired through `frontend/src/app/App.tsx` and `frontend/src/app/components/Sidebar.tsx`.
- New reusable UI: `frontend/src/app/components/`.
- New desktop command: `src-tauri/src/main.rs`, capability in `src-tauri/capabilities/default.json` if needed, feature module under `src-tauri/src/native_library/` for SQLite paths, bridge in `frontend/src/lib/`.
- New documentation: add or update the narrowest doc under `docs/`, then link it from `README.md` if it is user-facing.
