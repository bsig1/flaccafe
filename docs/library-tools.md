# Library Tools

FLAC Cafe keeps risky library maintenance behind preview-first tools. These tools update the SQLite library first and only touch files when the user explicitly applies a move or has file tag writing enabled.

## File Management Navigation

The File Management page groups tools into Setup, Tags, Files, Devices, Import, and Maintenance categories. Use the search box to narrow the page by tool name, description, or common task keywords such as `duplicates`, `MusicBee`, `artwork`, or `ffmpeg`.

Most tools remain preview-first. Filtering the page only changes what is visible; it does not reset staged previews or selected track scopes.

## Right-Click Tagging

The Library track context menu includes a Tagging submenu for actions that affect metadata or classification. It links to the full metadata editor, MusicBrainz auto-tagging, acoustic fingerprint tagging, database-to-file tag sync, volume-tag tools, and the Mark as Audiobook/Podcast actions. Basic field edits live in the editor instead of separate one-field menu items, which keeps the right-click menu smaller.

When multiple tracks are selected, tagging actions use the current selection. SQLite is always updated first; audio files are only changed by tools that explicitly write files or by metadata edits when the file-writing setting is enabled.

## Filename Tag Inference

File Management can infer metadata from folder and file names with token patterns such as:

```text
<Album Artist> - <Album> [<Year>]/<Track#> - <Artist> - <Title>
```

Supported tokens are:

- `<Title>`
- `<Artist>`
- `<Album>`
- `<Album Artist>`
- `<Track#>` or `<Track Number>`
- `<Disc#>` or `<Disc Number>`
- `<Genre>`
- `<Year>` or `<Date>`

The preview shows which tracks match and which fields would change. When "Only fill empty fields" is enabled, existing non-empty library metadata is left alone.

Custom filename patterns can be saved in Settings for repeated cleanup sessions. Saved presets are local UI preferences, so they are easy to revise without changing backend behavior.

## Inbox Review

The Library > Tools > Inbox view tracks newly scanned files until they are marked reviewed. This gives large imports a real staging area before they disappear into the normal library views.

Scans mark inserted files as new. Existing libraries are treated as already reviewed when the Inbox table is first initialized, so the Inbox starts useful instead of filling with the entire old collection.

Inbox notes let you leave a small per-track reminder while triaging new files, such as "needs cover art" or "check duplicate import." Auto-review rules can mark predictable matches reviewed on insert, for example a podcast genre, a known folder path, or an empty-field cleanup bucket. Rules are optional, saved in SQLite, and can be applied to the current Inbox when created or edited.

## Folder Watch

The Sources page can watch the configured music folder in the background. It does not change the library automatically; it builds a pending-changes list for newly added files, modified files, missing files, and likely moves or renames.

Move detection uses FLAC Cafe's fast file fingerprint to match a new path with a missing tracked path. Applying that change updates the path while preserving ratings, play history, playlist membership, and analysis data.

Use Check Now for an immediate pass, then apply selected changes after reviewing the table. Added and modified files are rescanned through the normal metadata parser. Removed files are removed from SQLite only after you apply them; the watcher never deletes audio files from disk.

When the watcher detects a new pending-change set, it records a notification summary and the app can surface it as a toast or Sources banner. Dismissing the notification does not apply changes; it only marks the notice reviewed.

## Audiobooks

The Audiobooks page shows long-form tracks separately from the main music table and groups them by book. A track appears there when its genre or path looks audiobook/book-oriented, such as `Audiobook`, `Audio Book`, or an audiobook folder. From the Library context menu, use `Tagging > Mark as Audiobook` to set the `Audiobook` genre and move selected tracks out of the main music views.

Audiobook resume positions are stored in SQLite, not written back to audio files. The page also supports playback through the normal player, per-track bookmarks, and editable chapter rows. Chapter text uses `index|start|end|title`, with times like `1:23:45` or `12:34`; the end time can be blank.

The sync export writes a JSON file with track metadata, resume position, bookmarks, and chapters. This gives phone/device workflows a stable handoff format without forcing FLAC Cafe to invent a device-specific audiobook database.

## Podcasts

The Podcasts page is an optional RSS feed manager. Subscriptions and episode rows are stored in SQLite, and refreshing a subscription fetches the feed and upserts remote episodes. Use the download-folder Browse button to choose a subscription folder, or leave the field blank to use FLAC Cafe's default podcast cache.

Episode downloads are explicit. FLAC Cafe writes downloaded media into the subscription download folder, or `backend/exports/podcasts` when no folder is set. Episodes downloaded to the default folder are automatically added to SQLite as `Podcast` tracks so the Podcasts tab can play them through the normal player. Podcast-marked tracks are excluded from the primary Library and album views.

## Web Radio

The Web Radio page stores stream bookmarks in SQLite and plays them through the WebView audio element. Save the direct stream URL, not just the station homepage. When playback starts, FLAC Cafe records `last_played_at` so favorite streams bubble up naturally.

## Scrobbling

The Scrobbling page keeps ListenBrainz and Last.fm integration behind a local outbox. Queueing history reads local `played` events, stores pending service-specific submissions, and lets you submit or retry when credentials are configured.

ListenBrainz uses a user token and the `/1/submit-listens` API. Last.fm uses browser approval by default: click Connect, approve FLAC Cafe in the browser, and the app polls Last.fm until it can save the session. Under the hood, Last.fm still requires app credentials, so packaged/dev builds can provide `FLAC_CAFE_LASTFM_API_KEY` and `FLAC_CAFE_LASTFM_API_SECRET`; user-provided credentials live in Settings -> API Keys. Loved tracks are stored locally and can queue Last.fm `track.love` events. Historical CSV import accepts columns such as `artist`, `title`, `play_count`, `rating`, and `loved`, then previews or applies matching updates to the local library.

## Regex Tag Cleanup

The File Management page includes a preview-first regex search/replace tool for common text tags: title, artist, album, album artist, and genre. It is useful for cleanup patterns such as removing trailing `feat.` text, normalizing separators, or replacing repeated label suffixes.

Applied regex changes are written through the same metadata path as manual edits. If file tag writing is enabled, supported audio files are updated too. Each applied row writes an undo entry so a batch can be restored from the undo log.

## MusicBrainz Auto-Tag

The MusicBrainz Auto-Tag tool searches MusicBrainz in either album/release mode or individual track mode. Preview rows show the proposed metadata, confidence, changed fields, release title, and any matched Cover Art Archive image.

"Missing only" keeps existing non-empty fields intact. Turning it off allows MusicBrainz data to replace current SQLite metadata. Applying uses the same metadata writer as manual edits, so the Settings file-writing toggle controls whether supported audio files are updated too.

Artwork matching uses the Cover Art Archive front image for the matched MusicBrainz release. When "Save cover" is enabled during apply, FLAC Cafe downloads the image as a local sidecar file in the album folder and selects it for the album. Album artwork can also be embedded into supported audio files from the Albums view after review.

## CLAP Genre Tags

The CLAP Genre Tags tool uses existing CLAP analysis results to preview predicted genre labels before copying them into the editable `genre` field. It is preview-first, supports a confidence threshold, and can be limited to tracks with empty genre tags.

Rust builds and applies the preview for SQLite-only changes. If file tag writing is enabled in Settings, common metadata writes go through the Rust/Lofty tag writer; otherwise the genre changes stay in SQLite.

## Volume Tags

The Volume Tags tool scans selected tracks with FFmpeg and previews ReplayGain-style track gain, album gain, and peak values before writing anything. The Library right-click Tagging menu can send the current selection straight to this tool.

Manual mode lets you mark selected tracks with known gain/peak values directly, without running an FFmpeg analysis. Applying stores the values in SQLite for playback normalization. When "Write tags to audio files" is enabled, FLAC Cafe also writes compatible metadata tags for FLAC, MP3, M4A, Ogg, and Opus files. The audio samples are not altered.

## Audio Conversion

Audio conversion preview, target path generation, estimated output sizing, FFmpeg installer jobs, conversion progress, ETA, cancellation, partial-output cleanup, and embedded artwork copy are Rust-owned. FFmpeg does the actual transcoding, and Rust/Lofty handles the post-conversion artwork copy when supported by the target container.

## File Organization

The file organizer renders a tag-based path template, previews target paths, and can move files on disk after confirmation. For example:

```text
<Album Artist>/<Album> (<Year>)/<Track#> - <Title>
```

FLAC Cafe sanitizes Windows-invalid filename characters and skips moves when the target file already exists by default. The organizer can also auto-rename collisions with suffixes such as `(2)`. After a successful move, the track path and path key are updated in SQLite and stale metadata-cache rows are removed.

When empty-folder cleanup is enabled, FLAC Cafe removes empty source folders under the configured library root after successful moves. It does not remove folders outside the library root.

## Device Sync Folder

The device sync tool is a preview-first copy/export job for USB drives, phone folders, or portable players that mount as normal folders. It can copy selected track scopes, copy playlist contents, preserve the source folder structure under the library root, and write portable `.m3u8` playlists into a `Playlists` folder.

Preview before applying. Apply creates the target folder when needed, copies only missing or older files, and writes playlists that point at the copied files with relative paths when file copying is enabled.

Saved sync profiles store the target folder, device type, music and playlist subfolders, copy/export flags, and the playlist selection for a device. Android presets default to a `Music` folder plus portable `.m3u8` playlists, while the USB preset keeps source folder structure under a `Music` folder. Windows removable-drive detection can fill the target folder for mounted USB devices; Android MTP devices still need a folder-mounted target because they do not appear as normal filesystem paths to the Python backend.

## CD Ripper

The CD Ripper panel on the File Management page detects local CD drives, looks up album metadata through MusicBrainz, and starts background rip jobs to FLAC, MP3, or WAV.

Windows builds use Rust-owned Windows CDDA reads for live playback and ripping. Custom `cdparanoia.exe`, `cdda2wav.exe`, or `icedax.exe` paths on `PATH` are still detected for diagnostics/CD-Text capability, but app-facing setup, playback, MusicBrainz disc lookup, rip jobs, progress, cancellation, and local SHA-256 verification hashes are Rust-owned. FLAC and MP3 encoding use the same optional FFmpeg setup as Audio Conversion. If an AccurateRip-capable tool is installed, FLAC Cafe reports that capability; current rip jobs always write local SHA-256 verification hashes so a rip has an audit trail even when official AccurateRip database matching is unavailable.

The Optional Dependencies page focuses on installable extras such as FFmpeg and ML runtimes. Chromaprint and the small Windows CD helper tools are bundled with the app and documented in `THIRD_PARTY_NOTICES.md` instead of being presented as user-installed dependencies. AccurateRip-capable helpers are still detected when present, but are not bundled by FLAC Cafe.

CD playback prepares selected CD tracks as live WAV streams and sends them through the normal player bar. It does not add ripped tracks to the library until the output folder is scanned.

## CSV Metadata Cleanup

The CSV metadata tool exports the library to a UTF-8 CSV with stable identifiers, paths, common tags, ratings, play counts, and analysis columns. The import path is preview-first and matches rows by track id first, then by path key.

Editable import fields are:

- title
- artist
- album
- album artist
- track number
- disc number
- genre
- year
- rating

"Only fill empty fields" is enabled by default so a spreadsheet import can repair gaps without overwriting good tags. When file writing is enabled in Settings, imported metadata and ratings also use the same audio-file writers as the manual edit and star-rating controls.

The dry-run report button writes a JSON report with every previewed row, skipped rows, errors, matched tracks, imported values, and changed fields. Use this before large imports when you want a durable review artifact.

## Playlist Import

Manual playlist import accepts M3U/M3U8, PLS, XSPF, WPL, and iTunes XML files. Local relative paths are resolved against the playlist file location, `file://` URLs are decoded, and stream URLs are ignored because this app currently focuses on local files.

## Desktop Library Importers

Library > File Management > Library Importers can preview or apply ratings, play counts, and last-played timestamps from other desktop music libraries.

Supported sources:

- MusicBee CSV exports with path/title/artist plus rating/play-count columns.
- iTunes XML library exports, including `Location`, `Rating`, `Play Count`, and play-date fields.
- Windows Media Player WPL/XML files when media entries include path plus rating/play-count attributes.

Imports match by normalized path first, then by artist/title. Ratings are normalized to FLAC Cafe's 0.5-5 star scale, including MusicBee/iTunes/WMP 0-100 style ratings. The preview shows matched rows, changed fields, and unmatched rows before anything is applied.

## Album Artwork

The Albums view can open an artwork manager for the selected album. FLAC Cafe lists sidecar images found near album files, embedded artwork found in album tracks, and optional web results from MusicBrainz/Cover Art Archive. A sidecar image can be selected as the album cover, embedded artwork can be saved as a `cover.jpg`/`cover.png` sidecar, and web artwork can be saved beside the album after review.

The artwork manager can embed reviewed JPEG/PNG artwork into supported audio tags for FLAC, MP3, M4A/MP4, Ogg Vorbis, and Opus. WebP covers are allowed as sidecar images, but embedded writes require JPEG or PNG because most audio tag formats do not support WebP artwork reliably.

## Cache Cleanup

The cache cleanup buttons remove derived data only:

- artist lookup cache
- artwork cache
- file metadata scan cache
- recommendation run history
- scan error samples

They do not delete tracks, playlists, lyrics, ratings, or audio files.
