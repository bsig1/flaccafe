# Example Metadata Extension

This is a safe, non-executable example extension. It demonstrates the package shape FLAC Cafe can discover today and the metadata a future integration might expose.

Files:

- `extension.json` is the manifest FLAC Cafe discovers.
- `provider.json` is the declared entry file referenced by the manifest.

Current behavior:

- The backend validates the manifest.
- Settings > Extensions And Skins lists the extension.
- Capabilities and permissions are shown as descriptive metadata.

Future behavior could use this shape for metadata lookup providers, artwork search providers, visualizers, importers, or richer skins once plugin loading has an explicit sandbox and consent model.
