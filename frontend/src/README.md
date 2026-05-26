# Frontend Structure

The frontend is grouped by responsibility, not by file type.

```text
app/        React application shell, pages, player, and shared app helpers
config/     static configuration such as themes and font choices
lib/        API clients, Tauri bridges, and framework-agnostic UI helpers
test/       Vitest setup
types/      shared TypeScript data shapes returned by the backend
```

## Current Notes

- `app/App.tsx` owns orchestration: global state, loading flows, and page composition.
- `app/appHelpers.ts` holds startup cache, CD playback, source-folder, and lyric helper logic shared by the app shell.
- `app/pages/` contains page-sized surfaces such as Library, AutoDJ, Settings, and Now Playing.
- `app/pages/settings/`, `app/pages/file-management/`, and `app/pages/library/` contain section components and helpers extracted from larger pages.
- `app/player/` contains the bottom player and detached mini-player window.
- `app/components/` contains reusable app-specific pieces and modals.
- `app/shared.ts` contains app-level types, constants, formatting helpers, persisted UI preferences, and drag/skip helpers.
- `lib/api.ts` should stay as the frontend boundary for native commands and Rust-to-Python worker calls.
- `lib/tauriMedia.ts` should stay as the frontend boundary for native media-control calls.
- `config/themes/*.json` are editable palette files. Register new themes in `config/theme.ts`.
- `types/api.ts` mirrors backend response shapes used by the frontend.
