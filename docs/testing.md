# Testing

FLAC Cafe currently has three practical check layers: TypeScript checks, frontend interaction tests, and backend tests.

## Common Commands

```powershell
npm run check
npm run check:routes
npm run test:frontend
npm run test:backend
npm run test
npm run build
```

Run the Tauri Rust check separately:

```powershell
Set-Location src-tauri
cargo check
```

## What The Tests Cover

- `npm run check` validates the React/TypeScript surface.
- `npm run check:routes` verifies that `docs/backend-routes.md` matches FastAPI routes in `backend/app/main.py`.
- `npm run test:frontend` runs Vitest tests for shared UI helpers.
- `npm run test:backend` runs the Python backend tests through the Windows helper script.
- `npm run build` verifies the production Vite bundle.
- `cargo check` verifies the Tauri shell and native command bridge.

## Useful Manual Smoke Test

After UI or playback work:

1. Start `npm run dev`.
2. Open `http://127.0.0.1:1420`.
3. Confirm Settings loads without backend errors.
4. Scan a small folder with at least one MP3 and one FLAC.
5. Play a track, skip a track, change a rating, and generate an AutoDJ queue.
6. If the change touched packaging or Tauri commands, also run `npm run desktop`.

## Current Gaps

- No full browser smoke suite runs against a live Vite preview yet.
- No automated MSI install/uninstall test yet.
- Playback codec coverage is still mostly manual because it depends on WebView2 support.
