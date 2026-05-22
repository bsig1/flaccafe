# TODO

## Manual Release Checks
- Smoke-test `FLAC Cafe_0.2.1_x64_en-US.msi` from the Start Menu on a clean Windows profile: startup self-check, support bundle, MP3/FLAC scan/playback, AutoDJ export, uninstall with app data retained, and uninstall with app data removed.
- Run `scripts\validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.

## MusicBee-Inspired Feature Gaps
- Add CD playback and secure CD ripping to FLAC/MP3 with metadata lookup, CD-Text support, and AccurateRip-style verification.
- Add saved device sync profiles, USB/MTP detection, Android-player presets, and per-playlist sync rules.
- Add audiobook handling with separate library views, resume position, bookmarks, chapter support, and sync-friendly metadata.
- Add podcast subscriptions and episode download management as an optional non-core module.
- Add web radio bookmarks and stream playback as an optional non-core module.
- Add Last.fm/ListenBrainz scrobbling, loved-track sync, and optional import of historical play counts/ratings.
- Add a dedicated WASAPI exclusive-mode or ASIO backend if cpal shared-mode output is not enough for advanced users.
- Add native queue preloading and sample-accurate gapless transition validation for adjacent album tracks.
- Add richer native playback diagnostics, including a compact Settings panel for recent rodio/cpal/Symphonia failures.
- Add visualizers, theater/party mode, and a more customizable Now Playing screen.
- Add a skin/plugin extension story for advanced users without making the core app harder to maintain.
- Add deeper library importers for MusicBee, iTunes, and Windows Media Player ratings/play counts.

## Code Health
- Continue extracting orchestration from `frontend/src/app/App.tsx` into focused hooks once the next round of UI behavior settles.
- Split `backend/app/main.py` into route modules by domain once the API shape is stable enough to avoid churn.
