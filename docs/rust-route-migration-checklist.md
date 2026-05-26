# Rust Route Migration Checklist

Use this checklist before removing a Python worker fallback for a route. The goal is to make route migrations boring, measurable, and reversible while Python remains the expert worker for CLAP/Torch inference, embedded artwork/lyrics writes, MusicBrainz/AcoustID matching, feeds/downloads, and other library-heavy tasks.

## Per-Route Checklist

- Rust implementation: add the route handler in `src-tauri/src/python_worker/native_routes.rs` or a focused `src-tauri/src/native_library/` module.
- Python parity test: keep or add a backend test that documents the existing behavior before the fallback is removed.
- Frontend path check: confirm the relevant `frontend/src/lib/api.ts` helper still calls the same app-facing route and receives the same response shape.
- Hammer cases: add at least five good and five bad direct-route cases when the route has meaningful validation behavior.
- Docs update: update `docs/backend-routes.md` and any feature guide touched by the route.
- Fallback removal: remove the Python action only after the Rust path has parity coverage and no known feature loss.

## Keep Python When

- The route reads or writes audio tags that Lofty does not cover safely yet.
- The route runs actual CLAP/Torch inference or another Python-first ML stack.
- The route depends on messy embedded artwork or embedded lyrics behavior that does not yet have golden fixtures.
- The Rust ecosystem path is less mature than the current Python library for that exact file format or service.

## Migration Notes

- Prefer small feature modules under `src-tauri/src/native_library/` over expanding `native_library.rs`.
- Keep orchestration in Rust when practical. For example, CLAP candidate selection, progress, pause/resume/cancel, and SQLite result writes belong in Rust, while the persistent Python CLAP worker only performs inference.
- Keep app-facing route names stable. React should not need to know whether Rust or Python handled the route.
- Use `/diagnostics/python-worker-usage` during dev sessions to see which Python actions still run often.
- Remove completed migration bullets from `TODO.md` in the same commit as the feature migration.
