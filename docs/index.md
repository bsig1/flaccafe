# FLAC Cafe Docs

Start here when you need the maintainer or user docs without hunting through the tree.

## User Guides

- [Keyboard Shortcuts](keyboard-shortcuts.md): default page and playback shortcuts, plus where to customize them.
- [Troubleshooting](troubleshooting.md): backend startup, codec support, installer, and optional ML runtime checks.
- [Themes](themes.md): JSON theme files, fonts, and where local theme folders live.
- [Extensions And Skins](extensions.md): manifest package shape for skins and future plugins.
- [Playback](playback.md): WebView playback, experimental native playback, fades, queue behavior, and diagnostics.
- [CLAP Analysis](clap-analysis.md): optional audio analysis runtime, CPU/CUDA choices, and validation.
- [Library Tools](library-tools.md): duplicate review, filename-to-tag inference, file organization, and undo.
- [CSV Metadata Cleanup](csv-metadata-cleanup.md): spreadsheet export/import workflow for metadata fixes.

## Maintainer Guides

- [Architecture](architecture.md): runtime boundaries and the React -> API -> Python -> SQLite shape.
- [Project Structure](project-structure.md): where new files belong and which generated paths stay ignored.
- [Backend Routes](backend-routes.md): local FastAPI route reference.
- [Database Maintenance](database-maintenance.md): SQLite storage, backups, cleanup, and generated data.
- [Testing](testing.md): frontend, backend, browser, and package-oriented checks.
- [Release Checklist](release-checklist.md): MSI release validation.
- [Release Documentation Checklist](release-documentation-checklist.md): docs updates before publishing.

## Release Notes

Release notes live in [release-notes/](release-notes/).
