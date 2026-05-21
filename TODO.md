# TODO

## Installer
- Add a real MSI uninstall-time checkbox for removing FLAC Cafe AppData, including database, model cache, logs, and ML runtime.
- Promote the CI installer smoke check into a full MSI build/install/uninstall test once GitHub Actions runtime is stable enough for WiX.
- Run `scripts/validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.

## Library Workflow
- Add an optional true acoustic fingerprint pass for duplicates that do not share exact file chunks.
- Add batch duplicate actions for very large duplicate sets: keep best, remove selected, reveal selected, and export review report.
- Add CSV metadata import/export for larger cleanup sessions.
- Extend the new filename-tag inference tool with saved pattern presets and per-track accept/reject controls.
- Extend the new tag-based file organizer with selected-track scope, collision auto-renaming options, and empty-folder cleanup after moves.

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
- Add a 10/15-band equalizer, basic DSP chain, and ReplayGain/loudness controls once the playback engine is mature enough.
- Investigate WASAPI/ASIO or native audio-output support for users who want lower-level Windows audio routing than WebView playback.
- Add visualizers, theater/party mode, and a more customizable Now Playing screen.
- Add a skin/plugin extension story for advanced users without making the core app harder to maintain.
- Add importers for MusicBee, iTunes, Windows Media Player, and common playlist/library export formats.

## Playback
- Add ReplayGain or loudness normalization support.
- Add a visible codec support diagnostic for the current WebView2 runtime.
- Persist detached mini-player preferences for always-on-top and preferred snap size.

## UI Polish
- Add browser-level smoke tests against a running Vite/Tauri preview, beyond the current frontend interaction unit tests.
- Add a keyboard shortcut editor instead of hard-coded shortcuts only.
- Continue splitting the largest page files, especially Library and AutoDJ, into smaller focused components.

## Recommendations
- Add profile comparison export so tuning sessions can be saved or shared.
- Add A/B feedback controls that compare two generated queues and learn from the chosen one.
- Add per-profile drift targets, for example "10% unrated" or "under 20% repeat artist".

## Documentation
- Add backend route reference docs generated or checked against `backend/app/main.py`.
- Add a maintainer guide for the database schema and migration policy.
- Add screenshots to the README once the FLAC Cafe theme settles.

## Project
- Add release artifacts to CI once MSI builds are reliable enough to publish from GitHub Actions.
