# Library Tools

FLAC Cafe keeps risky library maintenance behind preview-first tools. These tools update the SQLite library first and only touch files when the user explicitly applies a move or has file tag writing enabled.

## Filename Tag Inference

Settings > Library Tools can infer metadata from folder and file names with token patterns such as:

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

## File Organization

The file organizer renders a tag-based path template, previews target paths, and can move files on disk after confirmation. For example:

```text
<Album Artist>/<Album> (<Year>)/<Track#> - <Title>
```

FLAC Cafe sanitizes Windows-invalid filename characters and skips moves when the target file already exists by default. The organizer can also auto-rename collisions with suffixes such as `(2)`. After a successful move, the track path and path key are updated in SQLite and stale metadata-cache rows are removed.

When empty-folder cleanup is enabled, FLAC Cafe removes empty source folders under the configured library root after successful moves. It does not remove folders outside the library root.

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

## Cache Cleanup

The cache cleanup buttons remove derived data only:

- artist lookup cache
- artwork cache
- file metadata scan cache
- recommendation run history
- scan error samples

They do not delete tracks, playlists, lyrics, ratings, or audio files.
