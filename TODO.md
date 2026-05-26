# TODO

## Manual Release Checks
- Smoke-test `FLAC Cafe_0.5.0-beta_x64_en-US.msi` from the Start Menu on a clean Windows profile: startup self-check, support bundle, MP3/FLAC scan/playback, AutoDJ export, uninstall with app data retained, and uninstall with app data removed.
- Run `scripts\validate_clap_runtime.ps1 -RequireInstalled` on a clean Windows VM after installing the optional ML runtime.
- Smoke-test CD detection, selected-track live CD playback through the main player, skip/next behavior, MusicBrainz disc lookup, and FLAC/MP3/WAV ripping on a Windows machine with an optical drive.
- Verify the bundled Chromaprint and CD helper tools appear in app diagnostics/third-party notices without being presented as optional installs.

## Debug And Hardening
- Run a 60-minute playback soak with mixed MP3, FLAC, M4A, OGG/Opus, WAV, and malformed/unsupported files; log skips, fade/crossfade behavior, native/WebView differences, and any static or clipping.
- Stress-test library scanning with a copied large folder: first clean scan, second no-op rescan, deleted files, moved folders, renamed files, changed tags, duplicate files, and unreadable/corrupt audio.
- Verify file-writing safety with the setting on and off: ratings, manual metadata edits, lyrics, embedded artwork, MusicBrainz tags, CSV imports, and undo/restore behavior.
- Test destructive flows end to end: remove from library, delete from disk, remembered delete choice, bulk delete, playlist removal, duplicate cleanup, and restoring removed tracks.
- Exercise the File Management tools with real data exports and media: MusicBee CSV, iTunes XML, Windows Media Player WPL/XML, M3U/PLS/XSPF/WPL playlists, MusicBrainz/AcoustID matches, CLAP genre previews, FFmpeg volume tags, audio conversion, and JSON report viewer outputs.
- Profile large-library UI behavior around Library infinite scroll, sorting, column resizing/reordering, album view, history view, File Management search/categories, and right-click menus.
- Test startup and recovery states: backend missing, backend crash/restart, locked SQLite database, missing app data folders, bad settings values, stale CLAP runtime, and startup self-check warnings.
- Verify installer lifecycle on a clean Windows profile: fresh install, Start Menu shortcut, taskbar icon, Python worker startup, optional ML runtime install, repair/reinstall over existing data, uninstall keeping app data, and uninstall removing app data.
- Verify user-supplied API key flows for AcoustID and Last.fm, including external browser links from Settings > API Keys.
- Confirm podcast, audiobook, web radio, and CD pages stay excluded from main music coverage/analysis counts unless explicitly intended.
- Capture and review support bundles from successful and failing runs to ensure logs are useful and secrets/paths are not overexposed.
- Add regression tests for the highest-risk bugs found during manual debugging before adding more feature work.

## Code Health
- Continue extracting orchestration from `frontend/src/app/App.tsx` into focused hooks once the next round of UI behavior settles.
- Split `backend/app/main.py` into domain worker modules now that Rust owns route dispatch.
- Continue shrinking `frontend/src/app/pages/LibraryPage.tsx` by moving album, artist, completion, and playlist panes into `pages/library/` components.
- Continue splitting `src-tauri/src/native_library.rs` into feature modules as native SQLite paths grow.

## Rust/Python Runtime Follow-Up
- Desktop builds now route app-facing calls through Rust first. SQLite-only and media-byte paths stay native; scanner, mutagen, CLAP, CD, podcast/network, lyrics, and tagging paths run through named one-shot Python worker actions.
- Add parity tests for the Python worker bridge around CLAP status/jobs, metadata writes, audio conversion, CD setup/playback, podcast downloads, lyrics lookup/update, and MusicBrainz/AcoustID tagging.
- Consider persistent worker pooling only if one-shot worker startup becomes visible on long-running operations. Prefer correctness and simple process isolation until profiling proves it is too slow.

## Rust Native Migration Backlog
- Keep RSS/feed parsing and episode downloading in Python for now only if current Python libraries remain more convenient; otherwise evaluate Rust `rss` plus `reqwest`.
- Consider moving ListenBrainz and Last.fm HTTP submission to Rust because signing and JSON/form posts are not Python-specialist work.
- Keep CLAP inference in Python, but move analysis job state, candidate selection, pause/resume/cancel, progress, DB writes, and genre-tag application into Rust.
- Move duplicate ignore/delete actions and duplicate embedding similarity math into Rust.
- Move tag backup/restore JSON handling and CSV metadata export/import/report generation into Rust.
- Move device sync detected-drive probing, preview, copy jobs, and playlist export into Rust where Windows APIs or filesystem operations are involved.
- Move metadata write preview diffing into Rust, but keep actual audio tag writes in Python until Rust tag-writing crates are proven safe for MP3, FLAC, M4A, OGG/Opus, WAV, and AIFF.
- Move lyric database reads/writes and cached sidecar file management into Rust. Consider moving LRCLIB HTTP lookup to Rust; keep embedded lyrics reads/writes in Python until Rust tag-writing safety is proven.
- Move album artwork sidecar discovery, cache lookup, cache storage, local image serving, and simple cover-art downloads into Rust; keep embedded artwork extraction/writes in Python until Rust tag-writing safety is proven.
- Move AcoustID/fpcalc process invocation and fingerprint job state into Rust. Keep MusicBrainz matching heuristics in Python until the matching code is decomposed and covered by golden tests.
- Move CD drive detection, CD sidebar availability, active play/rip mutual exclusion, Windows CD TOC reading, disc ID generation, live stream token management, live audio streaming, rip job state, ETA, cancellation, verification hashes, and target path generation into Rust.
- Move FFmpeg install job state, installer progress, audio conversion preview, target path generation, estimated output sizing, job progress, cancellation, FFmpeg process orchestration, and FFmpeg output parsing into Rust.
- Keep actual audio metadata writes for ReplayGain tags in Python until Rust tag-writing support is validated.
- Add Rust route hammer coverage for native-only routes as a sibling to `scripts/hammer_backend_routes.py`.
- Add benchmarks for worker-spawn overhead versus native Rust for large-library query, AutoDJ, folder watch, scan diff, and file organizer workloads.
- Keep Python as the expert worker for CLAP/Torch inference, mutagen reads/writes, tricky embedded artwork/lyrics writes, and any library where the Python ecosystem is clearly safer than current Rust crates.
- Revisit the "keep Python" list only after each feature has golden test fixtures made from real messy files.

### Recently Completed Runtime Migration
- Removed the packaged long-running HTTP server from the desktop startup path.
- Added `backend/app/worker.py` for one-shot Python-owned named actions.
- Moved Python worker path mapping into Rust so Python receives `action + params + body`, not HTTP route requests.
- Removed the Python FastAPI decorator catalog and the browser-to-Python HTTP fallback.
- Routed remaining frontend app calls through Tauri `native_backend_json` in desktop builds.
- Added a Rust native-route adapter before the Python worker bridge for settings, library track pages/batches/details, album/artist/playlist browsing, history/stats, library health, inbox, local tool presets/previews, podcast/scrobble local state, recommendation profiles, AutoDJ, avoid rules, duplicate review, manual volume tags, file organizer preview/application, and gapless validation.
- Kept deliberate Python fallbacks for cache-miss artist info and file-rating writes, where Python still does network fetches or mutagen writes.
- Added native half-star rating validation so Rust and Python agree on 0.5-star to 5-star bounds.
- Moved SQLite schema creation and compatibility migrations into Rust startup/open handling, backed by shared `backend/app/schema.sql`, so the desktop controller prepares the database before Python worker actions spawn.
- Moved database backup/reset, startup self-check aggregation, support-bundle collection, backend log tailing, and redaction into Rust maintenance routes.
- Moved scan job orchestration into Rust for recursive discovery, unchanged-file diffing, async job progress/ETA/cancel state, missing-file cleanup, error sampling, and settings persistence while keeping mutagen metadata reads in a Python batch worker.
- Moved folder-watch state, polling loop, pending change detection, notifications, acknowledgement, and apply actions into Rust while keeping tag reads for added/modified/moved files in the Python mutagen batch worker.
- Finished native missing-file cleanup and orphan-album cleanup for scan, folder-watch apply, and source-removal paths.
- Confirmed album completion display is native for local inferred/stored counts while MusicBrainz online lookup remains Python-owned until golden fixtures exist.
- Moved audiobook sync export into Rust so SQLite progress/bookmark/chapter snapshots are written without spawning Python.
- Expanded native playlist import parsing and import creation for M3U/M3U8, PLS, XSPF, WPL, and iTunes XML while ignoring remote stream entries.
- Moved extension discovery, manifest validation, and user extension folder creation into Rust; theme/source folder opening was already Rust-owned through Tauri commands.
- Moved JSON report file reading into Rust so File Management report viewing no longer spawns Python.
- Added a low-noise Rust counter for remaining Python worker action calls, exposed at `/diagnostics/python-worker-usage`.
- Added `docs/rust-route-migration-checklist.md` with the per-route Rust migration exit checklist.
- Added `flaccafe-media://localhost/python-bytes/...` for Python-owned byte responses such as album art and CD live audio.
- Switched `npm run dev` to desktop dev so local development exercises the same Rust-to-Python worker path as packaged builds.

### Notes
- Keep watching for rare playback edge cases during long listening sessions, especially CD live playback and native/WebView transitions.
- File Management is functionally broad; keep UI polish focused on making one tool at a time feel calm in small windows.
