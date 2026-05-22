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
- `POST /library/maintenance/clear` clears derived caches.
- `POST /library/tools/infer-tags` previews or applies filename-based tag inference.
- `POST /library/tools/organize-files` previews or applies tag-based file moves.
- `POST /library/tools/organize-files/report` writes a JSON file-organization preview report.
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
- `GET /playlists` lists manual playlists.
- `POST /playlists` creates a playlist.
- `DELETE /playlists/{playlist_id}` deletes a playlist.
- `GET /playlists/{playlist_id}/tracks` lists playlist tracks.
- `POST /playlists/{playlist_id}/tracks` adds tracks.
- `DELETE /playlists/{playlist_id}/tracks/{track_id}` removes a track.
- `PATCH /playlists/{playlist_id}/tracks/{track_id}/move` moves a track up or down.
- `POST /playlists/{playlist_id}/export` writes an M3U playlist.
- `POST /playlists/import` imports an M3U playlist.
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
- `GET /autodj/history` lists recent recommendation runs.
- `GET /autodj/avoid` lists avoid rules.
- `POST /autodj/avoid` creates an avoid rule.
- `DELETE /autodj/avoid/{rule_id}` deletes one.
- `POST /autodj/feedback` records recommendation feedback.
- `POST /autodj/export` writes the current AutoDJ queue to M3U.
