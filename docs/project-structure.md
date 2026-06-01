# Project Structure

FLAC Cafe is split by runtime boundary first, then by feature ownership. React
owns presentation, Rust owns the app-facing controller and desktop integration,
and Python is an expert worker for optional CLAP/Torch work.

## Top-Level Tree

```text
.
|-- backend/          Python CLAP expert-worker modules and shared schema
|-- frontend/         React/TypeScript/Tailwind UI and typed API clients
|-- src-tauri/        Tauri v2 shell, Rust controller, playback, and installer metadata
|-- extensions/       bundled extension/skin manifest examples
|-- scripts/          Windows-oriented development, test, validation, and packaging helpers
|-- docs/             maintainer and user-facing documentation
|-- .github/          issue templates and CI workflow
|-- package.json      Node scripts and frontend/Tauri toolchain dependencies
|-- README.md
|-- CONTRIBUTING.md
|-- THIRD_PARTY_NOTICES.md
|-- TODO.md
`-- LICENSE
```

## Backend

```text
backend/
|-- app/
|   |-- __init__.py
|   |-- clap_analysis.py    optional CLAP genre/embedding analysis helpers
|   |-- clap_expert.py      one-shot JSON expert for CLAP runtime/package operations
|   |-- clap_worker.py      persistent JSON-lines worker for CLAP analysis batches
|   |-- config.py           storage paths and runtime configuration
|   |-- database.py         small SQLite helper used by CLAP expert settings
|   |-- ml_runtime.py       app-managed optional ML environment activation
|   |-- schema.sql          shared SQLite schema used by Rust and Python helpers
|   `-- startup_profile.py  lightweight startup timing breadcrumbs
|-- tests/
|   |-- test_clap_expert.py
|   `-- test_python_boundary.py
|-- cache/                 local derived preview/cache files; ignored by git
|-- data/                  local dev database; only placeholders should be tracked
|-- exports/               generated playlists/reports/backups
|-- models/                local model cache placeholder
|-- tools/                 bundled small helper tools and docs
|-- desktop_backend.py     packaged Python executable entry point for expert calls
|-- requirements.txt       build-time sidecar requirements; runtime is stdlib-only
`-- requirements-clap.txt  optional CLAP-side dependencies installed by the app
```

Do not add app-facing route controllers under `backend/app/`. New deterministic
features should go into Rust. Python belongs here only when a Python library is
materially better for the job, such as CLAP/Torch inference.

## Frontend

```text
frontend/
|-- public/
|-- src/
|   |-- app/
|   |   |-- App.tsx
|   |   |-- components/
|   |   |-- pages/
|   |   |-- player/
|   |   `-- shared.ts
|   |-- config/
|   |-- lib/
|   |   |-- api.ts              public API-helper barrel
|   |   |-- api/                domain API helper modules
|   |   |-- desktopLibrary.ts
|   |   |-- desktopPath.ts
|   |   |-- desktopPlayback.ts
|   |   |-- tauriMedia.ts
|   |   `-- uiInteractions.ts
|   |-- types/
|   |   |-- api.ts              public API type barrel
|   |   `-- apiParts/           split API response/request type groups
|   |-- main.tsx
|   `-- styles.css
|-- tsconfig.json
`-- vitest.config.ts
```

Add page-level UI in `frontend/src/app/pages/`. When a page grows into several
independent panels, keep the page as the coordinator and move panels into a
same-named subfolder such as `pages/settings/` or `pages/file-management/`.
Keep backend calls in `frontend/src/lib/api.ts`.

## Tauri Shell And Rust Controller

```text
src-tauri/
|-- src/
|   |-- main.rs
|   |-- library/       Rust app-controller feature modules
|   |   |-- mod.rs             app-controller module root and exports
|   |   |-- audiobooks.rs      audiobook progress, bookmarks, chapters, and sync export
|   |   |-- playlist_files.rs  M3U/PLS/XSPF/WPL/iTunes parse/import/export helpers
|   |   |-- playlists.rs       playlist CRUD and track ordering
|   |   |-- rows.rs            shared SQLite row decoders and common clauses
|   |-- playback/      playback DSP, EQ, limiter, and source wrappers
|   |   |-- mod.rs             playback module root
|   |   |-- io.rs              source resolution, decoders, shared output, URL/radio/CD handoff
|   |   |-- wasapi_exclusive.rs Windows-only exclusive output backend
|   |-- python_worker.rs      Rust-to-Python expert process helpers
|   |-- python_worker/        route table and command dispatch helpers
|   `-- smtc.rs
|-- capabilities/
|-- icons/
|-- tauri.conf.json
|-- Cargo.toml
`-- build.rs
```

Rust owns app routes, database compatibility, library operations, metadata I/O,
media serving, playback source resolution, output backends, online matching,
podcasts, scrobbling, imports, CD page workflows, audio conversion orchestration,
and optional CLAP job management. Python subprocesses are launched only by
explicit Rust handlers.

## Scripts

```text
scripts/
|-- dev.ps1
|-- stop_dev.ps1
|-- test_backend.ps1
|-- check_backend_routes.py
|-- build_backend_sidecar.ps1
|-- build_msi.ps1
|-- ci_installer_roundtrip.ps1
|-- installer_smoke.ps1
|-- validate_clap_runtime.ps1
|-- generate_icon.ps1
`-- changelog_preview.ps1
```

Scripts are Windows-first because the app is currently Windows-first. Prefer
small explicit scripts over hiding release or runtime behavior inside long
package commands.

## Ignored Local And Generated Paths

These directories are expected during development but should not be committed:

```text
.venv/
.tools/
node_modules/
frontend/dist/
src-tauri/target/
dist-backend/
build-backend/
backend/cache/
backend/data/*.sqlite*
backend/exports/*
backend/models/clap/*
backend/ml-runtime/
```
