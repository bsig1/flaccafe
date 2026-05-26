# TODO

## Manual Release Checks
- Smoke-test `FLAC Cafe_0.5.0-beta_x64_en-US.msi` from the Start Menu on a clean Windows profile: startup self-check, support bundle, MP3/FLAC scan/playback, AutoDJ export, uninstall with app data retained, and uninstall with app data removed.
- Run `scripts\validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.
- Smoke-test CD detection, selected-track live CD playback through the main player, skip/next behavior, MusicBrainz disc lookup, and FLAC/MP3/WAV ripping on a Windows machine with an optical drive.
- Verify the bundled Chromaprint and CD helper tools appear in app diagnostics/third-party notices without being presented as optional installs.

## Debug And Hardening
- Run a 60-minute playback soak with mixed MP3, FLAC, M4A, OGG/Opus, WAV, and malformed/unsupported files; log skips, fade/crossfade behavior, Rust/WebView differences, and any static or clipping.
- Stress-test library scanning with a copied large folder: first clean scan, second no-op rescan, deleted files, moved folders, renamed files, changed tags, duplicate files, and unreadable/corrupt audio.
- Verify file-writing safety with the setting on and off: ratings, manual metadata edits, lyrics, embedded artwork, MusicBrainz tags, CSV imports, and undo/restore behavior.
- Test destructive flows end to end: remove from library, delete from disk, remembered delete choice, bulk delete, playlist removal, duplicate cleanup, and restoring removed tracks.
- Exercise the File Management tools with real data exports and media: MusicBee CSV, iTunes XML, Windows Media Player WPL/XML, M3U/PLS/XSPF/WPL playlists, MusicBrainz/AcoustID matches, CLAP genre previews, FFmpeg volume tags, audio conversion, and JSON report viewer outputs.
- Profile large-library UI behavior around Library infinite scroll, sorting, column resizing/reordering, album view, history view, File Management search/categories, and right-click menus.
- Test startup and recovery states: backend missing, backend crash/restart, locked SQLite database, missing app data folders, bad settings values, stale CLAP runtime, and startup self-check warnings.
- Verify installer lifecycle on a clean Windows profile: fresh install, Start Menu shortcut, taskbar icon, Python expert-worker startup only on Python-owned tasks, optional ML runtime install, repair/reinstall over existing data, uninstall keeping app data, and uninstall removing app data.
- Verify user-supplied API key flows for AcoustID and Last.fm, including external browser links from Settings > API Keys.
- Confirm podcast, audiobook, web radio, and CD pages stay excluded from main music coverage/analysis counts unless explicitly intended.
- Capture and review support bundles from successful and failing runs to ensure logs are useful and secrets/paths are not overexposed.
- Add regression tests for the highest-risk bugs found during manual debugging before adding more feature work.

## Code Health
- Continue extracting orchestration from `frontend/src/app/App.tsx` into focused hooks once the next round of UI behavior settles.
- Continue shrinking `frontend/src/app/pages/LibraryPage.tsx` by moving album, artist, completion, and playlist panes into `pages/library/` components.
- Keep `src-tauri/src/library/mod.rs` as a small module root; new Rust library work should land in domain files under `src-tauri/src/library/`.
- Continue splitting frontend-heavy coordinators next: `App.tsx`, `LibraryPage.tsx`, `FileManagementPage.tsx`, `PlayerBar.tsx`, and `AutoDjPage.tsx` should move behavior into hooks and same-named page/player subfolders.
- Keep the Python sidecar limited to CLAP/Torch expert work; do not reintroduce app-facing route controllers under `backend/app/`.


### Notes
- Keep watching for rare playback edge cases during long listening sessions, especially CD live playback and Rust/WebView transitions.
- File Management is functionally broad; keep UI polish focused on making one tool at a time feel calm in small windows.
