# Release Documentation Checklist

Run this before packaging or tagging a FLAC Cafe release.

## Required Checks

- Run `npm run test` so TypeScript, route docs, frontend tests, and backend tests all pass.
- Run `npm run build`.
- Run `cargo check` from `src-tauri`.
- Confirm `docs/backend-routes.md` is current. `npm run check:routes` is included in `npm run test`.
- Read `README.md` and confirm the What Works, Development, Optional CLAP Runtime, Checks, and Packaging sections match the release.
- Read `docs/playback.md` after playback changes, especially codec support, shortcuts, SMTC, and skip tracking.
- Read `docs/library-tools.md` after scanner, metadata, CSV, or file organization changes.
- Read `docs/csv-metadata-cleanup.md` after CSV import/export behavior changes.
- Read `docs/release-checklist.md` for packaging and installer steps.

## Screenshot Pass

The README should get fresh screenshots once the FLAC Cafe theme stabilizes. For now, before a public release, capture at least:

- Library tracks view.
- Album view.
- AutoDJ simple mode.
- Now Playing with lyrics.
- Settings with Library Tools.

## Release Notes Prompts

When writing release notes, call out:

- database migrations or backup recommendations,
- file-writing behavior changes,
- installer/runtime changes,
- optional ML/runtime changes,
- playback compatibility changes,
- any feature still marked experimental.
