# TODO

## Installer
- Add a real MSI uninstall-time checkbox for removing FLAC Cafe AppData, including database, model cache, logs, and ML runtime.
- Promote the CI installer smoke check into a full MSI build/install/uninstall test once GitHub Actions runtime is stable enough for WiX.
- Run `scripts/validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.

## Library Workflow
- Add an optional true acoustic fingerprint pass for duplicates that do not share exact file chunks.
- Add batch duplicate actions for very large duplicate sets: keep best, remove selected, reveal selected, and export review report.
- Add a cache maintenance panel for clearing artwork cache, metadata cache, and old recommendation history.
- Add bulk metadata import/export from CSV for larger cleanup sessions.

## UI Polish
- Add browser-level smoke tests against a running Vite/Tauri preview, beyond the current frontend interaction unit tests.
- Add persisted mini-player preferences for always-on-top and preferred snap size.
- Add a keyboard shortcut editor instead of hard-coded shortcuts only.

## Recommendations
- Add profile comparison export so tuning sessions can be saved or shared.
- Add A/B feedback controls that compare two generated queues and learn from the chosen one.
- Add per-profile drift targets, for example "10% unrated" or "under 20% repeat artist".

## Project
- Add release artifacts to CI once MSI builds are reliable enough to publish from GitHub Actions.
- Add contributor docs for the Python backend architecture, optional ML runtime, and frontend testing approach.
