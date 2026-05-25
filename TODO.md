# TODO

## Manual Release Checks
- Smoke-test `FLAC Cafe_0.2.1_x64_en-US.msi` from the Start Menu on a clean Windows profile: startup self-check, support bundle, MP3/FLAC scan/playback, AutoDJ export, uninstall with app data retained, and uninstall with app data removed.
- Run `scripts\validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.
- Smoke-test CD ripping on a Windows machine with an optical drive and `cdparanoia` or `cdda2wav` installed in the app tool folder.

## Debug And Hardening
- Run a 60-minute playback soak with mixed MP3, FLAC, M4A, OGG/Opus, WAV, and malformed/unsupported files; log skips, fade/crossfade behavior, native/WebView differences, and any static or clipping.
- Stress-test library scanning with a copied large folder: first clean scan, second no-op rescan, deleted files, moved folders, renamed files, changed tags, duplicate files, and unreadable/corrupt audio.
- Verify file-writing safety with the setting on and off: ratings, manual metadata edits, lyrics, embedded artwork, MusicBrainz tags, CSV imports, and undo/restore behavior.
- Test destructive flows end to end: remove from library, delete from disk, remembered delete choice, bulk delete, playlist removal, duplicate cleanup, and restoring removed tracks.
- Exercise the File Management tools with real data exports: MusicBee CSV, iTunes XML, Windows Media Player WPL/XML, M3U/PLS/XSPF/WPL playlists, and JSON report viewer outputs.
- Profile large-library UI behavior around Library infinite scroll, sorting, column resizing/reordering, album view, history view, File Management search/categories, and right-click menus.
- Test startup and recovery states: backend missing, backend crash/restart, locked SQLite database, missing app data folders, bad settings values, stale CLAP runtime, and startup self-check warnings.
- Verify installer lifecycle on a clean Windows profile: fresh install, Start Menu shortcut, taskbar icon, backend startup, optional ML runtime install, repair/reinstall over existing data, uninstall keeping app data, and uninstall removing app data.
- Capture and review support bundles from successful and failing runs to ensure logs are useful and secrets/paths are not overexposed.
- Add regression tests for the highest-risk bugs found during manual debugging before adding more feature work.

## Code Health
- Continue extracting orchestration from `frontend/src/app/App.tsx` into focused hooks once the next round of UI behavior settles.
- Split `backend/app/main.py` into route modules by domain once the API shape is stable enough to avoid churn.

### Notes
- Some audible clipping when skipping tracks, polish needed
- last fm login flow does not work
- File management window needs work
- 