# Themes

FLAC Cafe themes are small JSON palettes in `frontend/src/config/themes/`. The active theme is selected in Settings and applied as CSS custom properties at runtime.

## Theme Files

Each theme exports RGB triplets as strings, for example:

```json
{
  "ember": "217 154 78",
  "moss": "118 171 150",
  "ink": "19 15 13",
  "fontFamily": "Inter, \"Segoe UI\", system-ui, sans-serif"
}
```

The full required shape is defined by `ThemePalette` in `frontend/src/config/theme.ts`. Keep values as plain RGB triplets because the CSS uses them in `rgb(var(--color-name) / alpha)` expressions.

## Adding A Theme

1. Add `frontend/src/config/themes/<name>.json`.
2. Import it in `frontend/src/config/theme.ts`.
3. Add the id to `ThemeAccent`, `themeOrder`, `themeAccentLabels`, and `themeAccentValues`.
4. Run `npm run check` to confirm the palette shape is complete.

## Fonts

Themes can define their own default font through `fontFamily`. The user can override that in Settings with:

- Theme default
- Segoe UI
- Inter
- Serif
- Mono
- Rounded
- Comic Sans

Add global font choices in `fontChoiceLabels` and `fontChoiceValues` in `frontend/src/config/theme.ts`.

## In-App Folder Buttons

Settings includes a button that opens the theme source folder. In dev builds this points to `frontend/src/config/themes`. In packaged builds it still reveals the source layout when running from a checkout, which is useful while the theme system is still developer-facing.
