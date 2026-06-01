# FLAC Cafe Release Checklist

Use this before publishing packaged builds.

## Build

- Run `npm.cmd run test`.
- Run `npm.cmd run build`.
- Run `cargo test` from `src-tauri`.
- Build the MSI with `npm.cmd run package:msi`.
- Run `powershell -ExecutionPolicy Bypass -File scripts\installer_smoke.ps1`.
- On a disposable profile, run `powershell -ExecutionPolicy Bypass -File scripts\ci_installer_roundtrip.ps1 -AllowAppDataCleanup`.
- Confirm release notes were generated in `docs/release-notes/`.
- Confirm GitHub Actions uploaded the MSI artifact for the release commit.

## Linux Packages

- Build Linux packages on a Linux host or CI runner, not from native Windows.
- Run `npm run package:deb` for a Debian package.
- Run `npm run package:appimage` for an AppImage.
- Run `npm run package:linux` to build both package formats.
- The Linux package script generates a clean Tauri overlay and audits built package contents so Windows-only MSI/WiX resources, `.exe` tools, `.dll` files, `.ico` icons, and Windows third-party notices do not leak into the Linux artifacts.
- On Windows, run `npm.cmd run package:deb -- --dry-run` or `npm.cmd run package:appimage -- --dry-run` to verify the generated Linux package config without building.

## GitHub Release

- Use a versioned tag such as `v0.5.0-beta`; do not use platform names such as `Windows` as release tags.
- Mark beta builds as GitHub prereleases.
- Attach the MSI built by CI for the same commit as the release tag.
- Confirm the GitHub repository description is spelled correctly: "A local music app with good recommendations."
- Link to `README.md`, `SECURITY.md`, and `THIRD_PARTY_NOTICES.md` from the release body when a release includes bundled command-line tools.
- Avoid publishing generated release notes that contain local absolute paths.

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

- Install the current MSI version before uninstall testing; Windows uses the cached MSI from the installed version.
- Uninstall from Windows Apps.
- Confirm the app process and backend process are gone.
- Run one uninstall and answer No to the app data cleanup prompt; confirm `%LOCALAPPDATA%\FLAC Cafe` is retained.
- Run one uninstall and answer Yes to the app data cleanup prompt; confirm `%LOCALAPPDATA%\FLAC Cafe` is removed.
- For silent cleanup testing, run `msiexec /x "<msi path>" /qn FLACCAFE_REMOVE_APPDATA=1` and confirm app data is removed.
