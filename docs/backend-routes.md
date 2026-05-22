# Backend Route Reference

The Python backend is a local FastAPI service. The React UI calls these routes through `frontend/src/lib/api.ts`; Tauri is responsible for starting the bundled backend in desktop builds.

## Diagnostics And Settings

- `GET /health` checks that the backend is reachable.
- `GET /diagnostics/startup` returns startup checks for database, storage, runtime, and optional ML paths.
- `GET /diagnostics/logs/backend` tails the backend log.
- `POST /diagnostics/support-bundle` creates a redacted zip for troubleshooting.
- `GET /settings` returns library path, database path, and user flags.
- `PATCH /settings` updates user flags such as file tag writing.
- `POST /settings/backup` copies the SQLite database to the export folder.

## Library And Maintenance

- `GET /tracks` returns the legacy full track list.
- `GET /tracks/page` returns paged, sorted tracks for infinite scrolling.
- `GET /tracks/{track_id}` returns one track.
- `PATCH /tracks/{track_id}/metadata` updates editable tags in SQLite, and optionally audio files.
- `PATCH /tracks/{track_id}/rating` updates a half-star rating in SQLite, and optionally audio files.
- `DELETE /tracks/{track_id}` removes a track from the library and can optionally delete the file.
- `POST /tracks/restore` rescans a previously removed file back into the library.
- `GET /library/stats` returns dashboard counts.
- `GET /library/health` returns missing files, duplicate groups, missing metadata, and unrated tracks.
- `GET /library/inbox` returns newly scanned tracks waiting for review.
- `PATCH /library/inbox/notes/{track_id}` saves or clears a per-track Inbox note.
- `POST /library/inbox/review` marks selected or all Inbox tracks as reviewed.
- `GET /library/inbox/auto-review-rules` lists saved Inbox auto-review rules.
- `POST /library/inbox/auto-review-rules` creates an optional auto-review rule and can apply it to existing Inbox tracks.
- `PATCH /library/inbox/auto-review-rules/{rule_id}` updates a saved auto-review rule.
- `DELETE /library/inbox/auto-review-rules/{rule_id}` removes a saved auto-review rule.
- `GET /library/watch` returns background folder-watch status and pending changes.
- `POST /library/watch/start` starts polling the library folder for add, move, remove, and tag/file timestamp changes.
- `POST /library/watch/stop` stops the background folder watcher.
- `POST /library/watch/refresh` immediately checks the watched folder without applying changes.
- `POST /library/watch/apply` applies selected or all pending folder-watch changes to SQLite.
- `POST /library/watch/notifications/ack` dismisses folder-watcher notifications after review.
- `POST /library/maintenance/clear` clears derived caches.
- `POST /library/tools/infer-tags` previews or applies filename-based tag inference.
- `POST /library/tools/regex-tags` previews or applies regex search/replace for common text tags.
- `GET /library/tools/regex-presets` lists saved regex tag cleanup presets.
- `POST /library/tools/regex-presets` creates a saved regex tag cleanup preset.
- `DELETE /library/tools/regex-presets/{preset_id}` deletes a saved regex tag cleanup preset.
- `POST /library/tools/custom-tags` previews or applies custom tag edits.
- `GET /library/tools/virtual-tags` lists saved virtual/computed tag definitions.
- `POST /library/tools/virtual-tags` creates a virtual/computed tag definition.
- `DELETE /library/tools/virtual-tags/{definition_id}` deletes a virtual/computed tag definition.
- `POST /library/tools/virtual-tags/preview` previews virtual/computed tag values.
- `POST /library/tools/copy-swap-tags` previews or applies multi-field copy/swap operations.
- `POST /library/tools/tag-backups` creates a tag backup export.
- `GET /library/tools/tag-backups` lists tag backup exports.
- `POST /library/tools/tag-backups/restore` restores tags from a backup export.
- `POST /library/tools/autotag` previews or applies MusicBrainz album/track metadata and optional Cover Art Archive sidecar artwork.
- `POST /library/tools/artwork-collisions` previews or repairs folders where multiple albums share one folder-level cover.
- `POST /library/tools/organize-files` previews or applies tag-based file moves.
- `POST /library/tools/organize-files/report` writes a JSON file-organization preview report.
- `POST /library/tools/device-sync` previews or applies folder/device copy jobs and playlist exports.
- `GET /library/tools/audio-conversion/setup` checks configured, bundled, and PATH-based FFmpeg locations.
- `PATCH /library/tools/audio-conversion/setup` saves or clears a custom FFmpeg path.
- `POST /library/tools/audio-conversion/preview` previews audio conversion targets.
- `POST /library/tools/audio-conversion/jobs` starts an audio conversion job.
- `GET /library/tools/audio-conversion/jobs/{job_id}` returns audio conversion job progress.
- `POST /library/tools/audio-conversion/jobs/{job_id}/cancel` cancels an audio conversion job.
- `GET /library/tools/cd-rip/setup` reports CD drives, extraction tools, encoder availability, CD-Text support, and verification capability.
- `POST /library/tools/cd-rip/metadata` searches MusicBrainz release metadata for a disc before ripping.
- `POST /library/tools/cd-rip/jobs` starts a background CD ripping job to FLAC, MP3, or WAV.
- `GET /library/tools/cd-rip/jobs/{job_id}` returns CD ripping progress and verification hashes.
- `POST /library/tools/cd-rip/jobs/{job_id}/cancel` cancels a CD ripping job after the current track finishes.
- `POST /library/tools/cd-rip/playback/play` starts Windows CD audio playback for a selected track.
- `POST /library/tools/cd-rip/playback/stop` stops Windows CD audio playback.
- `POST /library/tools/export-metadata-csv` exports track metadata for spreadsheet cleanup.
- `POST /library/tools/import-metadata-csv` previews or applies spreadsheet metadata changes.
- `POST /library/tools/import-metadata-csv/report` writes a JSON dry-run import report.
- `POST /library/duplicates/action` exports duplicate reports or applies batch duplicate cleanup actions.
- `POST /library/duplicates/review` fetches arbitrary duplicate-review tracks and recommendation groups.
- `GET /library/tools/acoustic-fingerprints/setup` checks configured, bundled, and PATH-based `fpcalc` locations.
- `PATCH /library/tools/acoustic-fingerprints/setup` saves or clears a custom `fpcalc` path.
- `POST /library/tools/acoustic-fingerprints/install` downloads the official Windows Chromaprint `fpcalc` tool into the app tool folder.
- `POST /library/tools/acoustic-fingerprints` runs an optional Chromaprint fingerprint pass when `fpcalc` is available.
- `GET /library/tools/undo-log` lists recent bulk metadata, duplicate, and file organization actions.
- `POST /library/tools/undo-log/{entry_id}/restore` restores a supported bulk action.
- `GET /library/tools/undo-batches` lists grouped undo transactions for bulk library actions.
- `POST /library/tools/undo-batches/{batch_id}/restore` restores a grouped undo transaction.
- `POST /library/tools/reports/read` loads a generated JSON report for in-app viewing.
- `POST /scan` runs a synchronous library scan.
- `POST /scan/start` starts an asynchronous scan job.
- `GET /scan/jobs/{job_id}` returns scan progress.

## Playback Assets And Context

- `HEAD /tracks/{track_id}/audio` and `GET /tracks/{track_id}/audio` stream local audio through WebView2.
- `GET /tracks/{track_id}/artwork` returns embedded or cached artwork.
- `GET /tracks/{track_id}/lyrics` returns embedded/database lyrics.
- `POST /tracks/{track_id}/lyrics/fetch` attempts online lyric lookup.
- `PATCH /tracks/{track_id}/lyrics` updates database lyrics or writes embedded lyrics when requested.
- `GET /artists/info` fetches cached artist biography data.
- `DELETE /artists/cache` clears artist biography cache.
- `GET /artists/local-tracks` returns local tracks for an artist.
- `POST /tracks/{track_id}/played` records a play.
- `POST /tracks/{track_id}/skipped` records a skip.
- `GET /history` returns recent play, skip, and rating events.

## Albums, Playlists, And Smart Playlists

- `GET /albums` lists album summaries.
- `GET /albums/{album_id}/tracks` lists an album's tracks.
- `GET /albums/{album_id}/artwork` serves selected, sidecar, or embedded album artwork.
- `GET /albums/{album_id}/artwork-candidates` lists local sidecar and embedded artwork candidates.
- `GET /albums/{album_id}/artwork-search` searches MusicBrainz/Cover Art Archive for web artwork candidates.
- `PATCH /albums/{album_id}/artwork` chooses sidecar artwork, saves web or embedded artwork as a sidecar, embeds JPEG/PNG artwork into album files, or clears a selection.
- `GET /playlists` lists manual playlists.
- `POST /playlists` creates a playlist.
- `DELETE /playlists/{playlist_id}` deletes a playlist.
- `GET /playlists/{playlist_id}/tracks` lists playlist tracks.
- `POST /playlists/{playlist_id}/tracks` adds tracks.
- `DELETE /playlists/{playlist_id}/tracks/{track_id}` removes a track.
- `PATCH /playlists/{playlist_id}/tracks/{track_id}/move` moves a track up or down.
- `POST /playlists/{playlist_id}/export` writes an M3U playlist.
- `POST /playlists/import` imports M3U/M3U8, PLS, XSPF, WPL, and iTunes XML playlists.
- `GET /smart-playlists/presets` lists built-in rules.
- `GET /smart-playlists` lists saved smart playlists.
- `POST /smart-playlists` saves a smart playlist.
- `DELETE /smart-playlists/{smart_playlist_id}` deletes one.
- `POST /smart-playlists/preview` previews a rule.
- `GET /smart-playlists/{smart_playlist_id}/tracks` materializes a saved rule.

## Analysis And Recommendations

- `GET /analysis/clap/status` reports optional CLAP runtime status.
- `POST /analysis/clap/install` starts optional ML runtime installation.
- `GET /analysis/clap/install/{job_id}` returns install progress.
- `GET /analysis/clap/coverage` reports analysis coverage.
- `PATCH /analysis/clap/config` updates model settings.
- `POST /analysis/clap/start` starts analysis.
- `GET /analysis/clap/jobs/{job_id}` returns analysis progress.
- `POST /analysis/clap/jobs/{job_id}/pause` pauses analysis.
- `POST /analysis/clap/jobs/{job_id}/resume` resumes analysis.
- `POST /analysis/clap/jobs/{job_id}/cancel` cancels analysis.
- `GET /tracks/{track_id}/similar` returns similar local tracks.
- `POST /autodj/generate` generates a recommendation queue.
- `GET /autodj/profiles` lists saved recommendation profiles.
- `POST /autodj/profiles` saves a profile.
- `PATCH /autodj/profiles/{profile_id}` updates a profile.
- `POST /autodj/profiles/{profile_id}/default` marks the default profile.
- `DELETE /autodj/profiles/{profile_id}` deletes a profile.
- `POST /autodj/profiles/compare` compares generated queues across profiles.
- `POST /autodj/profiles/compare/export` writes a JSON profile comparison report.
- `POST /autodj/profiles/compare/import` loads a shared JSON profile comparison report.
- `POST /autodj/ab-test` generates two queue candidates for side-by-side feedback.
- `POST /autodj/ab-test/choose` records which generated candidate was preferred.
- `GET /autodj/history` lists recent recommendation runs.
- `GET /autodj/avoid` lists avoid rules.
- `POST /autodj/avoid` creates an avoid rule.
- `DELETE /autodj/avoid/{rule_id}` deletes one.
- `POST /autodj/feedback` records recommendation feedback.
- `POST /autodj/export` writes the current AutoDJ queue to M3U.
