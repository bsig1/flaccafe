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

## File Organization

The file organizer renders a tag-based path template, previews target paths, and can move files on disk after confirmation. For example:

```text
<Album Artist>/<Album> (<Year>)/<Track#> - <Title>
```

FLAC Cafe sanitizes Windows-invalid filename characters and skips moves when the target file already exists. After a successful move, the track path and path key are updated in SQLite and stale metadata-cache rows are removed.

## Cache Cleanup

The cache cleanup buttons remove derived data only:

- artist lookup cache
- artwork cache
- file metadata scan cache
- recommendation run history
- scan error samples

They do not delete tracks, playlists, lyrics, ratings, or audio files.
