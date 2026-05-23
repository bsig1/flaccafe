# Extensions And Skins

FLAC Cafe discovers extension manifests but does not execute plugin code yet. This keeps the core app stable while giving advanced users a clear package shape for skins, importers, visualizers, and future integrations.

## Search Paths

The backend scans:

- `%LOCALAPPDATA%\FLAC Cafe\extensions` in packaged builds.
- `backend/extensions` when the backend storage root is the repo during development.
- `extensions` at the repository root for bundled examples.

Settings > Extensions And Skins shows the active user folder and all discovered manifests.

## Manifest

Each extension lives in its own folder with one of these manifest names:

- `flac-cafe-extension.json`
- `extension.json`
- `manifest.json`

Minimal example:

```json
{
  "id": "flac-cafe.example-skin",
  "name": "Example Skin Package",
  "version": "0.1.0",
  "kind": "skin",
  "entry": "theme.json",
  "capabilities": ["theme-palette", "font-preset"],
  "permissions": []
}
```

Supported manifest kinds are `skin`, `plugin`, `importer`, `visualizer`, and `integration`. The `entry` path must stay inside the extension folder. Current permissions are descriptive only; executable plugin loading should add a sandbox and explicit consent before any code runs.

## API

- `GET /extensions` lists manifests and creates the user extension folder if needed.
- `POST /extensions/reload` rescans the same folders.

The response includes validation errors for missing entry files, unknown kinds, unreadable JSON, and entries that point outside their extension folder.
