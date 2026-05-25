# Extensions And Skins

FLAC Cafe discovers extension manifests but does not execute plugin code yet. This keeps the core app stable while giving advanced users a clear package shape for skins, importers, visualizers, and future integrations.

## Search Paths

The backend scans:

- `%LOCALAPPDATA%\FLAC Cafe\extensions` in packaged builds.
- `backend/extensions` when the backend storage root is the repo during development.
- `extensions` at the repository root for bundled examples.

Settings > Extensions And Skins shows the personal/user folder, the bundled examples folder, and all discovered manifests.

In development, `backend/extensions` is the writable personal folder because the backend storage root is `backend/`. The repository-root `extensions/` folder is for examples/templates that ship with the project. In packaged builds, the writable personal folder moves to `%LOCALAPPDATA%\FLAC Cafe\extensions`.

The repository includes bundled examples in `extensions/example-skin` and `extensions/example-extension`. The `extensions/README.md` file is the quick-start guide for creating another local package.

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

## Bundled Examples

- `extensions/example-skin` demonstrates a skin-like package with a `theme.json` entry.
- `extensions/example-extension` demonstrates a metadata/integration-style package with a `provider.json` entry.

Both examples are intentionally non-executable. They exist so Settings > Extensions And Skins has real manifests to validate and so contributors can copy a known-good folder structure.

## API

- `GET /extensions` lists manifests and creates the user extension folder if needed.
- `POST /extensions/reload` rescans the same folders.

The response includes validation errors for missing entry files, unknown kinds, unreadable JSON, and entries that point outside their extension folder.
