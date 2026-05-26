# Testing

FLAC Cafe currently has seven practical check layers: TypeScript checks, frontend interaction tests, browser smoke tests, backend tests, route docs checks, backend route hammering, and package smoke checks.

## Common Commands

```powershell
npm run check
npm run check:routes
npm run test:frontend
npm run test:browser
npm run test:backend
npm run test
npm run build
.\.venv\Scripts\python.exe scripts\hammer_backend_routes.py --quiet
powershell -ExecutionPolicy Bypass -File scripts\installer_smoke.ps1
```

Run the Tauri Rust check separately. Tauri validates bundled resources during `cargo check`, so build the Python sidecar folder first on a fresh clone or CI runner:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_backend_sidecar.ps1
Set-Location src-tauri
cargo check
```

For disposable Windows profiles or CI runners, run the full MSI round-trip after building an installer:

```powershell
npm run package:msi
powershell -ExecutionPolicy Bypass -File scripts\ci_installer_roundtrip.ps1 -AllowAppDataCleanup
```

## What The Tests Cover

- `npm run check` validates the React/TypeScript surface.
- `npm run check:routes` verifies that `docs/backend-routes.md` matches the Rust-owned Python worker route table in `src-tauri/src/python_worker/routes.rs`.
- `npm run test:frontend` runs Vitest tests for shared UI helpers.
- `npm run test:browser` builds the frontend, serves it on `127.0.0.1:1421`, mocks backend responses, and verifies that the app shell renders in Microsoft Edge through Playwright.
- `npm run test:backend` runs the Python backend tests through the Windows helper script.
- `scripts/hammer_backend_routes.py` starts a test-only localhost HTTP server, seeds disposable SQLite fixtures, and sends at least five valid-shaped and five invalid-shaped HTTP requests to every backend route. Network/install boundaries are stubbed so the run is deterministic and does not touch the real library.
- `npm run build` verifies the production Vite bundle.
- `cargo check` verifies the Tauri shell and native command bridge.
- `scripts/installer_smoke.ps1` checks installer config, resources, and WiX cleanup wiring without installing.
- `scripts/ci_installer_roundtrip.ps1` installs the MSI, checks packaged app health, uninstalls, and verifies app data cleanup. It is destructive to `%LOCALAPPDATA%\FLAC Cafe`, so keep it to CI or disposable profiles.
- `frontend/e2e/packaged-tauri.playwright.ts` can launch a packaged Tauri executable when `FLAC_CAFE_TAURI_EXE` points at one; otherwise it skips.

For desktop worker-path work, send a one-shot JSON payload to `backend\desktop_backend.py --worker-once`:

```powershell
'{"action":"health","params":{},"body":null}' | .\.venv\Scripts\python.exe backend\desktop_backend.py
```

The desktop runtime does not start a Python HTTP server. Startup timing breadcrumbs are written to `%LOCALAPPDATA%\FLAC Cafe\logs\backend.log` by the worker and packaged executable.

## Useful Manual Smoke Test

After UI or playback work:

1. Start `npm run desktop`.
2. Open the Tauri window.
3. Confirm Settings loads without backend errors.
4. Scan a small folder with at least one MP3 and one FLAC.
5. Play a track, skip a track, change a rating, and generate an AutoDJ queue.
6. If the change touched packaging or worker startup, also run the installer smoke checks.

## Current Gaps

- Packaged Tauri Playwright coverage is opt-in because WebView2 availability on CI images can still be noisy.
- Playback codec coverage is still mostly manual because it depends on WebView2 and machine-level codec behavior.
