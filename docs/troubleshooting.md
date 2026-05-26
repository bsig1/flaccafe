# Troubleshooting

This page covers the checks most likely to help during alpha builds.

## Runtime Startup

1. Open Settings and run the startup self-check.
2. Create a support bundle from Settings if the self-check reports a failure.
3. Inspect `%LOCALAPPDATA%\FLAC Cafe\logs\backend.log` for recent Python expert-worker errors.
4. In development, run:

```powershell
npm run desktop
```

Common causes:

- A stale old dev backend is still holding a port. Run `.\scripts\stop_dev.ps1` if you previously used an older build.
- The packaged Python CLAP expert sidecar was built without a needed optional dependency. Rebuild with `npm run package:msi`.
- Optional ML packages were installed into the main app environment instead of the managed ML runtime.

## Codec Support

WebView playback depends on WebView2 codec support. MP3 is the safest baseline; FLAC works through the app's local serving path on current Windows/WebView2 builds, and the experimental Rust path uses Rust audio crates for broader local decoding tests.

If a track will not play:

- Confirm the file still exists from Library or File Management.
- Try the codec diagnostics in Settings.
- Try both WebView playback and experimental Rust playback if Rust playback is enabled.
- Check whether the file has unusual containers, broken headers, or DRM.

## Optional ML Runtime

The base app should work without Torch, Transformers, or CLAP.

Useful checks:

```powershell
.\scripts\validate_clap_runtime.ps1
.\scripts\validate_clap_runtime.ps1 -RequireInstalled
```

If CLAP analysis fails:

- Use the in-app installer instead of installing Torch into the base Python environment.
- Choose CPU unless you know the machine has a supported NVIDIA CUDA setup.
- Reinstall with force if the managed runtime was interrupted.
- Keep the backend log from `%LOCALAPPDATA%\FLAC Cafe\logs\backend.log`.

## Installer And Uninstall

Build the MSI with:

```powershell
npm run package:msi
```

For CI or disposable profiles, the installer round-trip script silently installs, checks the packaged app/runtime health, uninstalls, and verifies app data cleanup:

```powershell
.\scripts\ci_installer_roundtrip.ps1 -AllowAppDataCleanup
```

Do not run that script on a profile with data you want to keep.

Windows uses the MSI cached when the app was installed. If uninstall behavior changed, install the newer MSI first, then uninstall that version.

## Useful Local Commands

```powershell
npm run check
npm run test
npm run build
Set-Location src-tauri
cargo test
```

For release validation, follow [Release Checklist](release-checklist.md).
