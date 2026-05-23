# TODO

## Manual Release Checks
- Smoke-test `FLAC Cafe_0.2.1_x64_en-US.msi` from the Start Menu on a clean Windows profile: startup self-check, support bundle, MP3/FLAC scan/playback, AutoDJ export, uninstall with app data retained, and uninstall with app data removed.
- Run `scripts\validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.
- Smoke-test CD ripping on a Windows machine with an optical drive and `cdparanoia` or `cdda2wav` installed in the app tool folder.

## MusicBee-Inspired Feature Gaps
- Add web radio bookmarks and stream playback as an optional non-core module.
- Add Last.fm/ListenBrainz scrobbling, loved-track sync, and optional import of historical play counts/ratings.
- Add a dedicated WASAPI exclusive-mode or ASIO backend if cpal shared-mode output is not enough for advanced users.
- Add native queue preloading and sample-accurate gapless transition validation for adjacent album tracks.
- Add a skin/plugin extension story for advanced users without making the core app harder to maintain.
- Add deeper library importers for MusicBee, iTunes, and Windows Media Player ratings/play counts.

## Code Health
- Continue extracting orchestration from `frontend/src/app/App.tsx` into focused hooks once the next round of UI behavior settles.
- Split `backend/app/main.py` into route modules by domain once the API shape is stable enough to avoid churn.
