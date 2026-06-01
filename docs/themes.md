# Themes

FLAC Cafe themes are small JSON palettes in `frontend/src/config/themes/`. The active theme is selected in Settings and applied as CSS custom properties at runtime.

## Theme Files

Each theme exports RGB triplets as strings, for example:

```json
{
  "ember": "217 154 78",
  "moss": "118 171 150",
  "ink": "19 15 13",
  "fontFamily": "Inter, \"Segoe UI\", system-ui, sans-serif",
  "fontScale": "default",
  "checkboxAccent": "ember",
  "checkboxUnchecked": "line",
  "density": "comfortable",
  "sidebarWidthPx": 224,
  "miniPlayer": {
    "layout": "classic",
    "showArt": true,
    "showLibraryButton": true,
    "showAlwaysOnTopButton": true,
    "showMediaControls": true,
    "showPlaybar": true,
    "showPlaytimeNumbers": true,
    "showAlbumName": true,
    "windowMode": "native",
    "opacity": 1,
    "showQueue": true
  }
}
```

The full required shape is defined by `ThemePalette` in `frontend/src/config/theme.ts`. Keep color values as plain RGB triplets because the CSS uses them in `rgb(var(--color-name) / alpha)` expressions.

## Adding A Theme

1. Add `frontend/src/config/themes/<name>.json`.
2. Import it in `frontend/src/config/theme.ts`.
3. Add the id to `ThemeAccent`, `themeOrder`, `themeAccentLabels`, and `themeAccentValues`.
4. Run `npm.cmd run check` to confirm the palette shape is complete.

## Fonts

Themes can define their own default font through `fontFamily` and their default font size through `fontScale`.

`fontScale` supports:

- `small`
- `default`
- `large`

The user can override the font family in Settings with:

- Theme default
- Segoe UI
- Inter
- Serif
- Mono
- Rounded
- Comic Sans

Add global font choices in `fontChoiceLabels` and `fontChoiceValues` in `frontend/src/config/theme.ts`.

## Checkbox Accent

Themes can define the default checked checkbox accent through `checkboxAccent` and the unchecked box color through `checkboxUnchecked`.

`checkboxAccent` supports:

- `ember`
- `moss`
- `paper`
- `softAccent`

The user can keep Settings on Theme Default or force one of those palette slots globally.

`checkboxUnchecked` supports:

- `line`
- `muted`
- `ember`
- `moss`
- `paper`
- `softAccent`

The user can keep Settings on Theme Default or force one of those palette slots globally.

## Density

Themes can define the default layout density through `density`.

`density` supports:

- `comfortable`
- `compact`

The user can keep Settings on Theme Default or choose Comfortable or Compact from the density dropdown.

## Sidebar Width

Themes can define the default sidebar width through `sidebarWidthPx`.

The value is clamped to the supported sidebar-width range, currently 192-320 pixels in 8-pixel steps. The user can keep Settings on Theme Default or move the Sidebar Width slider to an explicit width.

## Mini Player Preset

Themes can include a `miniPlayer` object. This is a preset, not a lock: the user can apply the active theme preset from Settings and then edit the mini player directly.

Supported `miniPlayer.layout` values:

- `classic`
- `wide`
- `artwork`
- `compact`

The mini player uses the native operating-system frame. The remaining mini-player preset fields are booleans for artwork, library button, always-on-top button, media controls, playbar, playtime numbers, album name, and queue accordion visibility. The artwork layout always keeps artwork enabled. `opacity` is clamped from `0.35` to `1`.

## Sidebar Customization

The sidebar has user-local customization that is separate from theme files. Right-click the sidebar to hide/show pages, enable auto-hide, enable the optional master search, add blank custom labels, rename labels by double-clicking, delete labels, and drag labels or entries between menu positions.

Auto-hide renders the sidebar as an overlay from the selected edge so the library layout does not reflow while it opens. Settings controls whether the sidebar is left- or right-aligned; theme files only define the default width.

## In-App Folder Buttons

Settings includes a button that opens the theme source folder. In dev builds this points to `frontend/src/config/themes`. In packaged builds it still reveals the source layout when running from a checkout, which is useful while the theme system is still developer-facing.
