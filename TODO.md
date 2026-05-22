# TODO

## Installer
- Smoke-test `FLAC Cafe_0.2.0_x64_en-US.msi` from the Start Menu on a clean Windows profile: startup self-check, support bundle, MP3/FLAC scan/playback, AutoDJ export, and uninstall.
- Add a real MSI uninstall-time checkbox for removing FLAC Cafe AppData, including database, model cache, logs, and ML runtime.
- Promote the CI installer smoke check into a full MSI build/install/uninstall test once GitHub Actions runtime is stable enough for WiX.
- Run `scripts/validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.

## MusicBee-Inspired Feature Gaps
- Add folder watching with background incremental rescans, including a clear pending-changes view before applying moves, deletes, or tag updates.
- Add Auto-Tag by Album/Track using MusicBrainz or similar sources, with preview, missing-fields-only mode, and artwork matching.
- Add a true Inbox workflow for newly scanned tracks; the current Inbox smart preset is only a lightweight review surface.
- Add richer tag editing tools: custom tags, virtual/computed tags, regex search/replace presets, multi-field copy/swap, and tag backup/restore.
- Add album artwork management: search web, choose among candidates, embed artwork, save sidecar artwork, and repair folder-level artwork collisions.
- Add CD playback and secure CD ripping to FLAC/MP3 with metadata lookup, CD-Text support, and AccurateRip-style verification.
- Add audio conversion/transcoding jobs, including copy tags/artwork, preserve folder structure, optional resampling, and volume normalization.
- Add device sync profiles for folders, USB/MTP devices, Android players, and playlist export/sync rules.
- Add audiobook handling with separate library views, resume position, bookmarks, chapter support, and sync-friendly metadata.
- Add podcast subscriptions and episode download management as an optional non-core module.
- Add web radio bookmarks and stream playback as an optional non-core module.
- Add Last.fm/ListenBrainz scrobbling, loved-track sync, and optional import of historical play counts/ratings.
- Add a 10/15-band equalizer and basic DSP chain once the playback engine is mature enough.
- Add a dedicated WASAPI exclusive-mode or ASIO backend if cpal shared-mode output is not enough for advanced users.
- Add native queue preloading and sample-accurate gapless transition validation for adjacent album tracks.
- Add richer native playback diagnostics, including a compact Settings panel for recent rodio/cpal/Symphonia failures.
- Add visualizers, theater/party mode, and a more customizable Now Playing screen.
- Add a skin/plugin extension story for advanced users without making the core app harder to maintain.
- Add importers for MusicBee, iTunes, Windows Media Player, and common playlist/library export formats.

## Recommendations
- Add A/B feedback controls that compare two generated queues and learn from the chosen one.
- Add per-profile drift targets, for example "10% unrated" or "under 20% repeat artist".
- Add import/share support for exported recommendation profile comparison reports.

## Documentation
- Add a short keyboard-shortcuts user guide once the shortcut list settles.
- Add a troubleshooting page for codec support, backend startup, and optional ML runtime issues.
- Add a lightweight docs index page if the docs folder grows beyond the current single-screen list.

## Project
- Add release artifacts to CI once MSI builds are reliable enough to publish from GitHub Actions.
- Extend the Playwright smoke suite to launch a packaged Tauri build when CI has reliable WebView2 support.
- Keep decomposing the largest feature pages as new UI work lands, especially File Management and Settings.
