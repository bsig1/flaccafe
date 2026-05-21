# TODO

## Installer
- Add a real MSI uninstall-time checkbox for removing FLAC Cafe AppData, including database, model cache, logs, and ML runtime.
- Promote the CI installer smoke check into a full MSI build/install/uninstall test once GitHub Actions runtime is stable enough for WiX.
- Run `scripts/validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.

## Library Workflow
- Add an optional true acoustic fingerprint pass for duplicates that do not share exact file chunks.
- Add a persistent artwork thumbnail cache so album grids and the detached mini-player do less tag parsing.
- Add batch duplicate actions for very large duplicate sets: keep best, remove selected, reveal selected, and export review report.

## UI Polish
- Add browser-level smoke tests against a running Vite/Tauri preview, beyond the current frontend interaction unit tests.
- Add an always-on-top toggle and snap sizes for the detached mini-player window.
- Add keyboard shortcuts for the new duplicate review and bulk metadata flows.

## Recommendations
- Add queue health warnings when a generated queue is too repetitive or too exploratory.
- Add profile comparison so saved recommendation profiles can be A/B tested against the same seed track.
- Add longer-term drift history so recommendation balance can be tracked across multiple generated queues.

## Project
- Add release artifacts to CI once MSI builds are reliable enough to publish from GitHub Actions.
- Add contributor docs for the Python backend architecture, optional ML runtime, and frontend testing approach.
