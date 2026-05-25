# FLAC Cafe Extensions

FLAC Cafe currently discovers extension manifests but does not execute plugin code. This folder is for bundled examples and future first-party extensions. User-installed extensions live in the folder shown by Settings > Extensions And Skins.

## Folder Shape

Each extension gets its own folder:

```text
extensions/
  my-extension/
    extension.json
    README.md
    entry-file.json
```

The manifest can be named `extension.json`, `flac-cafe-extension.json`, or `manifest.json`.

## Minimal Manifest

```json
{
  "id": "flac-cafe.my-extension",
  "name": "My Extension",
  "version": "0.1.0",
  "kind": "integration",
  "description": "A short human-readable summary.",
  "author": "Your name",
  "entry": "integration.json",
  "capabilities": ["metadata-provider"],
  "permissions": []
}
```

Supported `kind` values are:

- `skin`
- `plugin`
- `importer`
- `visualizer`
- `integration`

The `entry` path must point to a file inside the extension folder. Capabilities and permissions are descriptive until executable plugin loading exists.

## Testing An Extension

1. Create a folder under the user extension folder shown in Settings.
2. Add a manifest and any entry files.
3. Click Reload in Settings > Extensions And Skins.
4. Fix any validation errors shown on the extension card.

See `example-skin` for a theme-style manifest and `example-extension` for a data/integration-style manifest.
