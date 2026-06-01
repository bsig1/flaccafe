# FLAC Cafe

[![CI](https://github.com/bsig1/flaccafe/actions/workflows/ci.yml/badge.svg)](https://github.com/bsig1/flaccafe/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/bsig1/flaccafe?include_prereleases&label=latest)](https://github.com/bsig1/flaccafe/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D4.svg)](https://github.com/bsig1/flaccafe/releases)

FLAC Cafe is an open-source, Windows-first desktop app for local music collections. It is built around a better local AutoDJ: scan downloaded files, keep ratings and play history in SQLite, analyze similarity when optional ML is installed, and generate useful queues without depending on a streaming service.

This is beta software. The core app is usable, but release builds still need broad real-library testing.

## Screenshots

These screenshots use a small demo library so the public docs do not expose a real local collection.

| Library | Albums |
| --- | --- |
| ![FLAC Cafe library track table](docs/screenshots/library-tracks.png) | ![FLAC Cafe album browse view](docs/screenshots/albums.png) |

| AutoDJ | Now Playing |
| --- | --- |
| ![FLAC Cafe AutoDJ queue generation](docs/screenshots/autodj.png) | ![FLAC Cafe Now Playing lyrics view](docs/screenshots/now-playing-lyrics.png) |

| File Management |
| --- |
| ![FLAC Cafe file management tools](docs/screenshots/file-management.png) |

## Download

Windows beta installers are published on the [GitHub Releases page](https://github.com/bsig1/flaccafe/releases). The app is designed for local files first; no streaming account is required.

## What Works

- Local library scanning with progress, missing-file cleanup, duplicate review, and messy metadata tolerance.
- SQLite-backed ratings, play history, playlists, lyrics, recommendation history, podcasts, audiobooks, and web radio bookmarks.
- Optional metadata and rating writes back to files when the setting is enabled.
- MusicBee-inspired library tools for filename-to-tag inference, MusicBrainz auto-tagging, acoustic fingerprints, volume tags, tag backups, CSV cleanup, file organization previews, desktop-library stats import, and cache cleanup.
- Rust-owned local playback, URL/radio playback, CD track preparation, queue controls, fade/crossfade, sleep timer, lyrics, visualizers, artist info, and media-key integration.
- AutoDJ with beginner and advanced controls, temperature sampling, cooldowns, unrated exploration, seed-track similarity, and optional CLAP audio embeddings.
- Album, artist, playlist, audiobook, podcast, radio, source-folder, history, and file-management views.
- Optional CD detection, live CD preview/playback, MusicBrainz disc lookup, and FLAC/MP3/WAV ripping workflows.
- Theme and font customization through JSON theme files plus in-app settings.
- Manifest-based extension and skin discovery for advanced customization experiments.
- MSI packaging helpers for Windows, including bundled Chromaprint and CD helper tools.

## Stack

- Desktop shell: Tauri v2
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Rust app-facing controller plus Python expert workers for optional ML library work
- Optional analysis: CLAP through Transformers and Torch

The MVP started with FastAPI because it kept music logic in Python and made early testing simple. The desktop build now uses Rust as the app-facing controller for SQLite reads, lightweight mutations, local media URLs, Lofty-based tag reads/writes, MusicBrainz/AcoustID matching, podcast feed/download work, scrobbling flows, external-library imports, CD workflows, audio conversion orchestration, CLAP runtime setup/status jobs, and all frontend-facing dispatch. Python remains an expert subprocess for the places where the Python ecosystem is still clearly useful: CLAP/Torch dependency checks, runtime package installation, and model inference. CLAP analysis uses a persistent Python model worker so Torch stays warm during a batch. The packaged app no longer bundles, starts, or routes through a Python HTTP server.

## Repo Layout

```text
backend/       Python expert-worker modules and shared schema/data helpers
frontend/      React/TypeScript UI, typed API clients, themes, player surfaces
src-tauri/     Tauri v2 shell, Rust commands, Python expert bridge, Windows media controls, Rust playback
scripts/       Windows dev, test, validation, packaging, and runtime helpers
docs/          maintainer guides, feature docs, release docs, and project structure
extensions/    sample extension/skin manifests
```

For the detailed tree, ownership notes, and ignored/generated directories, see [Project Structure](docs/project-structure.md).

## Development

Create the Python environment for packaging and optional CLAP development. The
base sidecar runtime is currently standard-library only, but packaging needs
PyInstaller:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

Install frontend dependencies:

```powershell
npm.cmd install
```

Run the desktop shell:

```powershell
npm.cmd run desktop
```

`npm.cmd run dev` is now a Windows-friendly alias for the desktop shell. The Python side runs as named worker calls instead of a long-running HTTP backend. If an old dev server is still running:

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
npm.cmd run check
npm.cmd run test
npm.cmd run build
cargo check --manifest-path src-tauri\Cargo.toml --all-targets
```

## Packaging

```powershell
npm.cmd run package:msi
```

The Windows MSI product version must be numeric, so beta builds use a numeric Windows product version such as `0.5.0` and a release/installer label such as `0.5.0-beta`.

Before publishing, follow [docs/release-checklist.md](docs/release-checklist.md). Public beta releases should use a versioned tag such as `v0.5.0-beta` and be marked as a prerelease on GitHub.

## More Docs

- [Docs Index](docs/index.md)
- [Architecture](docs/architecture.md)
- [Project Structure](docs/project-structure.md)
- [Playback](docs/playback.md)
- [Themes](docs/themes.md)
- [Extensions And Skins](docs/extensions.md)
- [CLAP Analysis](docs/clap-analysis.md)
- [Keyboard Shortcuts](docs/keyboard-shortcuts.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Testing](docs/testing.md)
- [Release Documentation Checklist](docs/release-documentation-checklist.md)
