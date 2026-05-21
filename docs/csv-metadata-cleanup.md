# CSV Metadata Cleanup Guide

CSV cleanup is for large editing sessions where a spreadsheet is faster than opening one track at a time. FLAC Cafe keeps this preview-first so you can inspect changes before applying them.

## Recommended Flow

1. Open Settings > Library Tools.
2. Click Export CSV.
3. Open the exported file in a spreadsheet editor.
4. Edit only the metadata columns you mean to change.
5. Save as CSV.
6. Paste the CSV path into Import CSV Path.
7. Click Preview Import.
8. Click Export Dry Run if you want a JSON review report.
9. Click Import CSV when the preview looks right.

## Editable Columns

FLAC Cafe imports these columns:

- `title`
- `artist`
- `album`
- `album_artist`
- `track_number`
- `disc_number`
- `genre`
- `year`
- `rating`

Other columns are exported for context or matching. Do not edit `id`, `path`, or `path_key` unless you know exactly why; they help FLAC Cafe match CSV rows back to library tracks.

## Matching Rules

Rows match by `id` first. If the id is missing or no longer exists, FLAC Cafe falls back to `path_key`, then `path`.

This means exported CSVs are stable across ordinary metadata edits, but very old CSVs can miss tracks after files are moved outside FLAC Cafe.

## Safer Spreadsheet Editing

Keep "Only fill empty fields" enabled when you are repairing missing metadata. Turn it off only when you intentionally want the CSV to overwrite existing fields.

Ratings support half-star values from `0.5` through `5`. Blank or `0` clears the rating.

Before a large import, use Export Dry Run. The JSON report records:

- total rows read,
- matched rows,
- changed rows,
- row-level errors,
- current values,
- imported values,
- changed fields.

## File Writing

CSV import always updates SQLite when applied. If "write ratings/metadata to files" is enabled in Settings, imported metadata and ratings also write to supported audio files. Leave file writing off for the first pass if you are unsure.
