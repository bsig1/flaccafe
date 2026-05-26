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
- Keep shrinking `backend/app/main.py` to only the remaining Python expert-worker actions; remove dead legacy route helpers once Rust parity tests cover the replacement modules.
- Continue shrinking `frontend/src/app/pages/LibraryPage.tsx` by moving album, artist, completion, and playlist panes into `pages/library/` components.
- Continue splitting `src-tauri/src/native_library.rs` into feature modules as Rust SQLite paths grow.
- Split the remaining large Rust feature modules by domain: start with `library_tools.rs` into tags/device-sync/backup/import helpers, then split `audio_conversion.rs` into preview, FFmpeg install, and conversion job modules if it grows again.

## Rust/Python Runtime Follow-Up
- Desktop builds now route app-facing calls through Rust first. SQLite, media-byte, common Lofty tag-read/write, MusicBrainz/AcoustID matching, podcast RSS/downloads, scrobbling flows, external-library imports, file deletion/restoration, and route dispatch stay in Rust. Python is called only for expert work such as CLAP/Torch inference, CD/audio helpers that have not moved yet, specialized embedded artwork/lyrics writes, and audio-conversion artwork copy. Most Python actions are one-shot; CLAP analysis uses a Rust-managed persistent worker for the batch.
- Add parity tests for the Python worker bridge around CLAP status/jobs, metadata writes, audio conversion, CD setup/playback, lyrics lookup/update, and remaining specialist file writes.
- Consider persistent worker pooling only if one-shot worker startup becomes visible on long-running operations. Prefer correctness and simple process isolation until profiling proves it is too slow.

## Rust Controller Migration Backlog
- Move CD drive detection, CD sidebar availability, active play/rip mutual exclusion, Windows CD TOC reading, disc ID generation, live stream token management, live audio streaming, rip job state, ETA, cancellation, verification hashes, and target path generation into Rust.
- Keep actual audio metadata writes for ReplayGain tags in Python until Rust tag-writing support is validated.
- Add Rust route hammer coverage for controller-only routes as a sibling to `scripts/hammer_backend_routes.py`.
- Add benchmarks for worker-spawn overhead versus Rust controller paths for large-library query, AutoDJ, folder watch, scan diff, and file organizer workloads.
- Keep Python as the expert worker for CLAP/Torch inference, tricky embedded artwork/lyrics writes, CD/audio helpers that have not moved yet, specialized ReplayGain/artwork operations, and any library where the Python ecosystem is clearly safer than current Rust crates.
- Revisit the "keep Python" list only after each feature has golden test fixtures made from real messy files.

### Recently Completed Runtime Migration
- Removed the packaged long-running HTTP server from the desktop startup path.
- Added `backend/app/worker.py` for one-shot Python-owned named actions.
- Moved Python worker path mapping into Rust so Python receives `action + params + body`, not HTTP route requests.
- Removed the Python FastAPI decorator catalog and the browser-to-Python HTTP fallback.
- Routed remaining frontend app calls through Tauri `native_backend_json` in desktop builds.
- Added a Rust route adapter before the Python worker bridge for settings, library track pages/batches/details, album/artist/playlist browsing, history/stats, library health, inbox, local tool presets/previews, podcast/scrobble flows, recommendation profiles, AutoDJ, avoid rules, duplicate review, manual volume tags, file organizer preview/application, and gapless validation.
- Kept deliberate Python fallbacks for cache-miss artist info and specialized embedded file writes where Python is still safer.
- Added Rust half-star rating validation so Rust and Python agree on 0.5-star to 5-star bounds.
- Moved SQLite schema creation and compatibility migrations into Rust startup/open handling, backed by shared `backend/app/schema.sql`, so the desktop controller prepares the database before Python worker actions spawn.
- Moved database backup/reset, startup self-check aggregation, support-bundle collection, backend log tailing, and redaction into Rust maintenance routes.
- Moved scan job orchestration into Rust for recursive discovery, unchanged-file diffing, async job progress/ETA/cancel state, missing-file cleanup, error sampling, and settings persistence; common metadata reads now use Rust/Lofty.
- Moved folder-watch state, polling loop, pending change detection, notifications, acknowledgement, and apply actions into Rust while tag reads for added/modified/moved files now use the Rust/Lofty metadata path.
- Finished Rust missing-file cleanup and orphan-album cleanup for scan, folder-watch apply, and source-removal paths.
- Confirmed album completion display and MusicBrainz online lookup are Rust-owned for the app-facing route.
- Moved audiobook sync export into Rust so SQLite progress/bookmark/chapter snapshots are written without spawning Python.
- Expanded Rust playlist import parsing and import creation for M3U/M3U8, PLS, XSPF, WPL, and iTunes XML while ignoring remote stream entries.
- Moved extension discovery, manifest validation, and user extension folder creation into Rust; theme/source folder opening was already Rust-owned through Tauri commands.
- Moved JSON report file reading into Rust so File Management report viewing no longer spawns Python.
- Added a low-noise Rust counter for remaining Python worker action calls, exposed at `/diagnostics/python-worker-usage`.
- Added `docs/rust-route-migration-checklist.md` with the per-route Rust migration exit checklist.
- Moved duplicate ignore, clear-ignored, report export, keep-best, remove-selected SQLite actions, and delete-from-disk Recycle Bin handling into Rust.
- Moved podcast RSS/feed parsing, episode downloads, download deletion, subscription deletion, and episode-track linking into Rust.
- Moved metadata-write preview diffing plus common SQLite-to-file metadata/rating writes into Rust with Lofty.
- Moved metadata CSV export into Rust so File Management exports no longer spawn Python for read-only CSV generation.
- Moved tag backup creation/listing into Rust; restore remains separate because it writes editable/custom tags and undo entries.
- Moved tag backup restore into Rust, including preview, missing-only behavior, custom tags, apply, and undo entries.
- Moved CSV metadata import and import-report generation into Rust, including previews, column maps, blank clearing, apply, and undo entries.
- Moved lyric database reads/writes into Rust; embedded lyric reads/writes and online lyric fetches remain Python-owned.
- Moved fetched lyric sidecar cache writes into Rust while keeping LRCLIB matching in the Python expert worker.
- Moved duplicate embedding similarity math into Rust duplicate review groups.
- Moved device sync drive probing, preview, file copy, target path generation, and playlist export into Rust.
- Moved Chromaprint `fpcalc` process invocation, acoustic fingerprint pass state, AcoustID lookup, and MusicBrainz tag matching into Rust.
- Moved audio conversion preview, target path generation, and estimated output sizing into Rust.
- Moved ListenBrainz and Last.fm outbox submission into Rust, including Last.fm request signing and submitted/failed row updates.
- Moved Last.fm browser-auth start/complete flows and scrobble-history CSV import into Rust, with no Python worker fallback.
- Moved external library stats import for MusicBee CSV, iTunes XML/plist, and Windows Media Player XML into Rust, with no Python worker fallback.
- Moved track deletion, bulk deletion, recycle-bin sends, restore-from-file, sync-from-file metadata refresh, duplicate delete actions, and bulk-undo restore actions into Rust, with no Python worker fallback.
- Moved LRCLIB online lyric lookup into Rust for both track fetches and metadata/CD lookups while keeping embedded lyric reads/writes in Python.
- Moved album artwork local sidecar selection, simple web sidecar downloads, cache invalidation, and direct album-art media serving into Rust while keeping embedded artwork extraction/writes in Python.
- Moved FFmpeg installer job state, download progress, ZIP extraction, and saved tool-path configuration into Rust.
- Moved audio conversion job state, progress/ETA, cancellation requests, FFmpeg command construction/process orchestration, and stderr-tail error reporting into Rust while keeping embedded artwork copy as a Python specialist-worker action.
- Moved CLAP analysis job state, candidate selection, progress/ETA, pause/resume/cancel requests, failure marking, and analysis DB writes into Rust while keeping the CLAP/Torch model warm in a persistent Python expert worker.
- Moved CLAP genre-tag preview/application into Rust; explicit common metadata file writes now use the Rust/Lofty tag writer.
- Hardened Rust audio conversion cancellation so canceling terminates the active FFmpeg child process and removes the partial output file.
- Finished Rust sidecar artwork cache storage and stale-cache checks; embedded artwork extraction/writes still delegate to Python until Rust tag-writing safety is proven.
- Split the Rust CLAP analysis module into focused job orchestration, persistent-worker protocol, and genre-tag tool modules.
- Added `flaccafe-media://localhost/python-bytes/...` for Python-owned byte responses such as album art and CD live audio.
- Switched `npm run dev` to desktop dev so local development exercises the same Rust-to-Python worker path as packaged builds.

### Notes
- Keep watching for rare playback edge cases during long listening sessions, especially CD live playback and Rust/WebView transitions.
- File Management is functionally broad; keep UI polish focused on making one tool at a time feel calm in small windows.
