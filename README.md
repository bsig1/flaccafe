# FLAC Cafe

FLAC Cafe is an open-source, Windows-first desktop app for local music collections. It is built to prove a better local AutoDJ: scan downloaded files, keep ratings and play history in SQLite, analyze similarity when optional ML is installed, and generate useful queues without becoming a full MusicBee replacement overnight.

This is still an alpha prototype. Expect sharp edges.

## What Works

- Local library scanning with progress, missing-file cleanup, duplicate review, and messy metadata tolerance.
- SQLite-backed ratings, play history, playlists, smart playlists, lyrics, and recommendation history.
- Optional metadata and rating writes back to files when the setting is enabled.
- MusicBee-inspired library tools for filename-to-tag inference, tag-based file organization previews, and cache cleanup.
- Local playback through the Tauri WebView with queue controls, fade/crossfade, sleep timer, lyrics, artist info, and media-key integration.
- AutoDJ with beginner and advanced controls, temperature sampling, cooldowns, unrated exploration, seed-track similarity, and optional CLAP audio embeddings.
- Theme and font customization through JSON theme files plus in-app settings.
- MSI packaging helpers for Windows.

## Stack

- Desktop shell: Tauri v2
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Python, FastAPI, mutagen, SQLite
- Optional analysis: CLAP through Transformers and Torch

The MVP uses FastAPI because it keeps the music logic in Python, keeps React focused on UI state, and allows the backend to be tested independently. Tauri launches the packaged backend for desktop builds.

## Repo Layout

```text
backend/       Python API, SQLite, scanner, recommender, library tools
frontend/      React/TypeScript UI, typed API clients, themes, player surfaces
src-tauri/     Tauri v2 shell, backend launcher, native commands, Windows media controls
scripts/       Windows dev, test, validation, packaging, and runtime helpers
docs/          maintainer guides, feature docs, release docs, and project structure
```

For the detailed tree, ownership notes, and ignored/generated directories, see [Project Structure](docs/project-structure.md).

## Development

Create the Python environment:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

Install frontend dependencies:

```powershell
npm install
```

Run the browser preview:

```powershell
npm run dev
```

Run the desktop shell:

```powershell
npm run desktop
```

The backend listens on `http://127.0.0.1:8765`. The Vite preview uses `http://127.0.0.1:1420`. If an old dev server is still running:

```powershell
.\scripts\stop_dev.ps1
```

## Optional CLAP Runtime

The base app does not need Torch or CLAP. From the Analysis page, use **Install CLAP** and choose CPU or NVIDIA CUDA. Packaged builds create an app-managed runtime under `%LOCALAPPDATA%\FLAC Cafe\ml-runtime`.

Manual dev install:

```powershell
# CPU Torch
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-clap.txt

# NVIDIA CUDA Torch
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu128
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-clap.txt
```

## Checks

```powershell
npm run check
npm run test
npm run build
Set-Location src-tauri
cargo check
```

## Packaging

```powershell
npm run package:msi
```

Before publishing, follow [docs/release-checklist.md](docs/release-checklist.md).

## More Docs

- [Docs Index](docs/index.md)
- [Architecture](docs/architecture.md)
- [Project Structure](docs/project-structure.md)
- [Playback](docs/playback.md)
- [Themes](docs/themes.md)
- [CLAP Analysis](docs/clap-analysis.md)
- [Keyboard Shortcuts](docs/keyboard-shortcuts.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Testing](docs/testing.md)
- [Release Documentation Checklist](docs/release-documentation-checklist.md)
