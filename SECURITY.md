# Security Policy

FLAC Cafe is a local-first desktop app that scans user-selected folders, stores metadata in SQLite, can write tags back to audio files when enabled, and calls a bundled local Python worker from the Tauri/Rust shell.

## Supported Versions

Security fixes are handled on the active beta line. Older beta installers should be upgraded to the latest GitHub release before reporting an issue unless the report is specifically about upgrade or uninstall behavior.

## Reporting A Vulnerability

Please do not post exploit details, private library paths, API keys, database files, or support bundles in a public issue.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting or security advisory flow if it is enabled for the repository.
2. If private reporting is unavailable, open a minimal public issue saying you have a security report and ask for a private contact path.

Useful details to include privately:

- FLAC Cafe version and whether it was installed from MSI or run from source.
- Windows version.
- The affected workflow, such as scanning, metadata writes, plugin/extension loading, optional dependency installation, or worker/native command access.
- Redacted logs or support bundles when relevant.

## Scope

Security-sensitive areas include local file deletion/moves, metadata writing, bundled native tools, optional dependency installers, extension loading, and any native command or worker action that can touch local files or app data.
