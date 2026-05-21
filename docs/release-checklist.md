# FLAC Cafe Release Checklist

Use this before publishing an MSI.

## Build

- Run `npm.cmd run test`.
- Run `npm.cmd run build`.
- Run `cargo test` from `src-tauri`.
- Build the MSI with `npm.cmd run package:msi`.
- Confirm release notes were generated in `docs/release-notes/`.

## Clean Windows Smoke Test

- Install the MSI on a clean or freshly reset Windows profile.
- Launch FLAC Cafe from the Start Menu shortcut.
- Confirm no console window opens.
- Open Settings and run the startup self-check.
- Create a support bundle and confirm it contains diagnostics, redacted settings, redacted database summary, app info, and logs.
- Scan a small folder containing at least MP3 and FLAC files.
- Play one MP3 and one FLAC file.
- Change a rating with file tag writing off.
- Enable file tag writing and verify unsupported formats warn before bulk rating writes.
- Generate an AutoDJ queue, expand "Why this track?", save a template, and export an `.m3u`.

## Optional ML Runtime

- Install the CPU CLAP runtime from the app.
- Run analysis on a small set of files.
- Restart the installed app and confirm CLAP status remains ready.
- If CUDA was tested, record GPU model, driver version, Torch build, and install size.

## Uninstall

- Uninstall from Windows Apps.
- Confirm the app process and backend process are gone.
- Manually check whether `%LOCALAPPDATA%\FLAC Cafe` is intentionally retained until the MSI cleanup option exists.
