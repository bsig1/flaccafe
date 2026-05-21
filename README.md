# FLAC Cafe

Open-source local music recommendation prototype for downloaded music collections.

This a very alpha prototype, expect bugs.

## Demo

A very early Windows demo build is available here:

...

This is an alpha prototype. Expect bugs. Linux support is not available yet.

## Architecture Overview

This first slice uses:

- Tauri v2 for the desktop shell
- React, TypeScript, and Vite for the UI
- Python, FastAPI, mutagen, and SQLite for library scanning and recommendations

It scans local files, stores metadata and ratings, generates an AutoDJ queue, and exports that queue as an `.m3u` playlist.
It also has an optional CLAP analysis path for audio embeddings, zero-shot genre tags, and seed-track similarity.

## Why FastAPI First

FastAPI is the simplest bridge for this MVP because the music logic stays in Python, the frontend stays clean, and each side can be run independently while the app shape is still changing. A Tauri sidecar is a good later packaging step.

## Structure

```text
backend/       Python API, SQLite schema, scanner, recommender, playlist export
frontend/      React/TypeScript UI
src-tauri/     Tauri v2 shell
scripts/       Windows helper scripts
docs/          architecture notes
```

## Development

Create the Python environment:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

Optional CLAP audio analysis:

```powershell
.\.venv\Scripts\python -m pip install -r backend\requirements-clap.txt
```

Install frontend dependencies:

```powershell
npm install
```

Run the app in browser-dev mode:

```powershell
npm run dev
```

This starts FastAPI and serves a freshly built Vite preview at `http://127.0.0.1:1420`.

If the preview port is already in use from an earlier run, the script will report the existing URL. To stop the dev servers:

```powershell
.\scripts\stop_dev.ps1
```

Or run each side separately when debugging backend logs:

```powershell
npm run backend:dev
npm run frontend:dev
```

Run the Tauri shell:

```powershell
npm run desktop
```

The backend listens on `http://127.0.0.1:8765`. The frontend dev server listens on `http://127.0.0.1:1420`.

## Supported Audio Extensions

`.flac`, `.mp3`, `.m4a`, `.ogg`, `.opus`, `.wav`, `.aiff`, and `.aif`.

## Recommendation MVP

The recommender scores each track from rating, recency, skip count, unrated exploration, cooldowns, optional CLAP similarity, and a small random component. It samples with:

```text
P(track) proportional to exp(score / temperature)
```

Lower temperature leans safer. Higher temperature explores more.
