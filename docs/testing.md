# Testing

FLAC Cafe has six practical check layers: TypeScript checks, frontend
interaction tests, browser smoke tests, Python expert-boundary tests, route docs
checks, and package smoke checks.

## Common Commands

```powershell
npm.cmd run check
npm.cmd run check:routes
npm.cmd run test:frontend
npm.cmd run test:browser
npm.cmd run test:backend
npm.cmd run test
npm.cmd run build
powershell -ExecutionPolicy Bypass -File scripts\installer_smoke.ps1
```

Run the Tauri Rust checks separately. Tauri validates bundled resources during
`cargo check`, so build the Python sidecar folder first on a fresh clone or CI
runner:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_backend_sidecar.ps1
cargo check --manifest-path src-tauri\Cargo.toml --all-targets
cargo test --manifest-path src-tauri\Cargo.toml
```

The Rust route table also has a generated hammer test. It sends five valid and
five invalid request shapes through every mapped route and is part of
`cargo test`; run it directly when route mapping changes:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml python_worker::routes::tests::hammers_every_route_with_good_and_bad_request_shapes -- --nocapture
```

There is an ignored fake-library performance benchmark for the common Rust
library paths. Use release mode when comparing versions, because debug-mode
Rust timings are intentionally much slower:

```powershell
cargo test --release --manifest-path src-tauri\Cargo.toml library::tests::benchmark_fake_database_common_paths -- --ignored --nocapture
```

For disposable Windows profiles or CI runners, run the full MSI round-trip after
building an installer:

```powershell
npm.cmd run package:msi
powershell -ExecutionPolicy Bypass -File scripts\ci_installer_roundtrip.ps1 -AllowAppDataCleanup
```

## What The Tests Cover

- `npm.cmd run check` validates the React/TypeScript surface.
- `npm.cmd run check:routes` verifies that `docs/backend-routes.md` matches the Rust route table in `src-tauri/src/python_worker/routes/table.rs`.
- `npm.cmd run test:frontend` runs Vitest tests for shared UI helpers.
- `npm.cmd run test:browser` builds the frontend, serves it on `127.0.0.1:1421`, mocks backend responses, and verifies that the app shell renders in Microsoft Edge through Playwright.
- `npm.cmd run test:backend` runs Python tests for the CLAP expert boundary and verifies that removed Python HTTP-controller modules stay gone.
- `npm.cmd run build` verifies the production Vite bundle.
- `cargo check --manifest-path src-tauri\Cargo.toml --all-targets` and `cargo test --manifest-path src-tauri\Cargo.toml` verify the Tauri shell, Rust controller, route handlers, playback support, and desktop command bridge.
- `python_worker::routes::tests::hammers_every_route_with_good_and_bad_request_shapes` validates every Rust route shape without touching a real library database.
- `library::tests::benchmark_fake_database_common_paths` seeds a disposable 12,000-track SQLite library and prints median/p95 timings for the high-traffic library and AutoDJ paths.
- `scripts/installer_smoke.ps1` checks installer config, resources, and WiX cleanup wiring without installing.
- `scripts/ci_installer_roundtrip.ps1` installs the MSI, checks packaged app health, uninstalls, and verifies app data cleanup. It is destructive to `%LOCALAPPDATA%\FLAC Cafe`, so keep it to CI or disposable profiles.
- `frontend/e2e/packaged-tauri.playwright.ts` can launch a packaged Tauri executable when `FLAC_CAFE_TAURI_EXE` points at one; otherwise it skips.

## Python Expert Smoke Tests

The desktop runtime does not start a Python HTTP server. For CLAP expert work,
send a one-shot JSON payload to the sidecar entry point:

```powershell
'{"command":"status"}' | .\.venv\Scripts\python.exe backend\desktop_backend.py --clap-expert
```

CLAP batch inference uses `backend\desktop_backend.py --clap-worker`, which is
normally started by Rust during an analysis job.

## Useful Manual Smoke Test

After UI or playback work:

1. Start `npm.cmd run desktop`.
2. Open the Tauri window.
3. Confirm Settings loads without backend errors.
4. Scan a small folder with at least one MP3 and one FLAC.
5. Play a track, skip a track, change a rating, and generate an AutoDJ queue.
6. If the change touched packaging or expert-worker startup, also run the installer smoke checks.

## Current Gaps

- Packaged Tauri Playwright coverage is opt-in because WebView2 availability on CI images can still be noisy.
- Playback codec coverage is still mostly manual because it depends on machine-level audio devices, output modes, and codec edge cases.
- Handler-level fuzzing still needs deeper valid-body generators for every mutating route; the current hammer focuses on route resolution, normalization, query parsing, and malformed route rejection.
