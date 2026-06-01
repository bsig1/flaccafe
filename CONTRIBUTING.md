# Contributing to FLAC Cafe

FLAC Cafe is split into a React/Tauri desktop UI, a Rust app-facing controller, and a Python expert worker. Keep deterministic library, playback, metadata, route, and desktop behavior in Rust. Python is reserved for expert-library work where the Python ecosystem is still the better tool, mainly optional CLAP/Torch setup and inference. Keep React focused on presentation, interaction state, and typed API calls.

## Local Checks

Run these before sending a pull request:

```powershell
npm.cmd run check
.\.venv\Scripts\python.exe -m unittest discover backend/tests
.\.venv\Scripts\python.exe -m compileall backend
cargo check --manifest-path src-tauri\Cargo.toml --all-targets
```

## Scanners

Scanner changes live in `src-tauri/src/library/scan/`. Prefer normalized path keys and absolute paths when matching files, because Windows path casing and duplicate files are common in real libraries. A scan should update changed files, add new files, and remove database rows for missing files only inside the scanned folder.

Use the existing Rust metadata parser and Lofty helpers for extraction/writes. Messy tags are expected: multi-artist strings, missing album artists, partial dates, and malformed track numbers should degrade gracefully instead of stopping a scan.

## Tag Writing

Audio-file writes live in Rust library metadata/tagging modules. Database writes are the source of truth unless the user enables file writing in Settings.

When adding supported tag writes:

- Update SQLite first only after a successful file write when file writing is enabled.
- Raise a clear `ValueError` for unsupported formats or impossible writes.
- Never rewrite unrelated tags.
- Add a test that patches the writer or uses a safe temporary file.

## Recommendation Scoring

Recommendation behavior lives under `src-tauri/src/library/recommendations/`. Keep the MVP explainable: each score component should have a name and a visible contribution in `score_breakdown`.

New scoring features should preserve these goals:

- Ratings matter, but queues should not become only five-star tracks.
- Recent plays, artist repeats, and album repeats should be cooled down.
- Unrated exploration should stay configurable.
- CLAP similarity should be optional and additive.

## UI Conventions

Frontend source lives in `frontend/src`. Use API helpers from `frontend/src/lib/api.ts`; do not put scanning, recommendation, or tag-writing logic in React components.

For UI changes:

- Keep library actions subtle unless they are part of the main listening workflow.
- Prefer right-click menus and selected-track toolbars for batch actions.
- Keep visible metadata customizable through the column header menu.
- Use existing button classes, theme variables, and lucide icons before adding new visual patterns.
