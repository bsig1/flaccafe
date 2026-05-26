# Rust Route Migration Checklist

Use this checklist when moving deterministic work out of Python expert modules
and into Rust. The old Python route fallback is gone; Python should stay limited
to CLAP/Torch operations or future libraries where Python is clearly safer.

## Per-Route Checklist

- Rust implementation: add or update the handler in `src-tauri/src/python_worker/controller_routes/` and a focused `src-tauri/src/library/` module.
- Behavior fixture: add a Rust test or a small Python expert-boundary test that captures the expected behavior before changing user-visible output.
- Frontend path check: confirm the relevant `frontend/src/lib/api.ts` helper still calls the same app-facing route and receives the same response shape.
- Good and bad cases: add representative validation cases for successful requests, missing records, malformed bodies, and filesystem edge cases.
- Docs update: update `docs/backend-routes.md` and any feature guide touched by the route.
- Python cleanup: remove unused Python helper code in the same change once Rust owns the path.

## Keep Python When

- The code runs actual CLAP/Torch inference.
- The code installs or inspects Python packages in the managed ML runtime.
- A future feature depends on a Python library that is materially safer than the available Rust crate for that exact task.

## Migration Notes

- Prefer small feature modules under `src-tauri/src/library/` over expanding `src-tauri/src/library/mod.rs`.
- Keep orchestration in Rust when practical. CLAP status/config/install job state, candidate selection, progress, pause/resume/cancel, and SQLite result writes belong in Rust; Python subprocesses perform only dependency/runtime/package work and inference.
- Keep app-facing route names stable. React should not need to know which internal module handled a route.
- Use `/diagnostics/python-worker-usage` during dev sessions to see which Python expert actions still run.
