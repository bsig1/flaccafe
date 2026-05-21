# TODO

## Installer
- Add a real MSI uninstall-time checkbox for removing FLAC Cafe AppData, including database, model cache, logs, and ML runtime.
- Add an installer smoke test to CI once MSI builds are stable on GitHub Actions.
- Validate the packaged CLAP runtime on a clean Windows install, especially `soxr`, `soundfile`, and Torch DLL loading.

## Reliability
- Add crash-safe recovery notes for the case where the backend cannot start and Settings is unreachable.
- Add a support-bundle option to include a tiny anonymized sample of failed scan errors.
- Add a frontend-facing recovery page when the backend stays unreachable after restart.

## Library Workflow
- Make repeat file loading faster with an artwork/audio metadata cache.
- Add preview-before-write for bulk metadata edits, not only single-track edits.
- Add a full duplicate review mode with batch select, inline playback, and file reveal for large duplicate sets.
- Add an optional true acoustic fingerprint pass for duplicates that do not share exact file chunks.

## UI Polish
- Add frontend interaction tests for library column menus, track context menus, quick-start dismissal, Settings diagnostics, AutoDJ templates, and undo banners.
- Add a true detached compact mini-player window mode.
- Add a compact diagnostics indicator inside the affected page headers, not just the sidebar.

## Recommendations
- Add saved recommendation profiles that can also become default Settings presets.
- Add seed-neighbor filters so the preview can be narrowed by artist, genre, rating, or analyzed-only status.
- Add recommendation drift charts that show whether queues are leaning familiar, exploratory, or too repetitive.

## Project
- Add generated changelog previews to pull requests once CI exists.
- Reduce the optional ML dependency footprint as much as possible.
