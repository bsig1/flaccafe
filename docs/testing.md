# Testing

FLAC Cafe currently has six practical check layers: TypeScript checks, frontend interaction tests, browser smoke tests, backend tests, route docs checks, and package smoke checks.

## Common Commands

```powershell
npm run check
npm run check:routes
npm run test:frontend
npm run test:browser
npm run test:backend
npm run test
npm run build
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
- `npm run check:routes` verifies that `docs/backend-routes.md` matches FastAPI routes in `backend/app/main.py`.
- `npm run test:frontend` runs Vitest tests for shared UI helpers.
- `npm run test:browser` builds the frontend, serves it on `127.0.0.1:1421`, mocks the local backend, and verifies that the app shell renders in Microsoft Edge through Playwright.
- `npm run test:backend` runs the Python backend tests through the Windows helper script.
- `npm run build` verifies the production Vite bundle.
- `cargo check` verifies the Tauri shell and native command bridge.
- `scripts/installer_smoke.ps1` checks installer config, resources, and WiX cleanup wiring without installing.
- `scripts/ci_installer_roundtrip.ps1` installs the MSI, checks the packaged backend `/health` route, uninstalls, and verifies app data cleanup. It is destructive to `%LOCALAPPDATA%\FLAC Cafe`, so keep it to CI or disposable profiles.
- `frontend/e2e/packaged-tauri.playwright.ts` can launch a packaged Tauri executable when `FLAC_CAFE_TAURI_EXE` points at one; otherwise it skips.

For backend startup work, run `backend\desktop_backend.py` on a throwaway port and check `/health`; startup timing breadcrumbs are written to `%LOCALAPPDATA%\FLAC Cafe\logs\backend.log`.

## Useful Manual Smoke Test

After UI or playback work:

1. Start `npm run dev`.
2. Open `http://127.0.0.1:1420`.
3. Confirm Settings loads without backend errors.
4. Scan a small folder with at least one MP3 and one FLAC.
5. Play a track, skip a track, change a rating, and generate an AutoDJ queue.
6. If the change touched packaging or Tauri commands, also run `npm run desktop`.

## Current Gaps

- Packaged Tauri Playwright coverage is opt-in because WebView2 availability on CI images can still be noisy.
- Playback codec coverage is still mostly manual because it depends on WebView2 and machine-level codec behavior.
