import blueTheme from "./themes/blue.json";
import cafeTheme from "./themes/cafe.json";
import comicTheme from "./themes/comic.json";
import mintTheme from "./themes/mint.json";
import roseTheme from "./themes/rose.json";

export type ThemeAccent = "cafe" | "mint" | "rose" | "blue" | "comic";
export type ThemeFontScale = "small" | "default" | "large";
export type ThemeCheckboxAccent = "ember" | "moss" | "paper" | "softAccent";
export type ThemeCheckboxUnchecked = "line" | "muted" | "moss" | "ember" | "paper" | "softAccent";
export type ThemeDensity = "comfortable" | "compact";
export type FontChoice = "theme" | "system" | "inter" | "serif" | "mono" | "rounded" | "comic";
export const sidebarWidthMinPx = 192;
export const sidebarWidthMaxPx = 320;
export const sidebarWidthStepPx = 8;
export const sidebarWidthDefaultPx = 224;

// Values are RGB triplets because styles.css consumes them as rgb(var(--color-name) / alpha).
export interface ThemePalette {
  ember: string;
  moss: string;
  ink: string;
  panel: string;
  line: string;
  muted: string;
  paper: string;
  hoverPanel: string;
  sidebar: string;
  strip: string;
  subtle: string;
  popover: string;
  quiet: string;
  mini: string;
  miniPanel: string;
  surfaceGlow: string;
  primaryHover: string;
  softAccent: string;
  scrollTrack: string;
  scrollThumb: string;
  scrollThumbHover: string;
  fontFamily: string;
  fontScale: ThemeFontScale;
  checkboxAccent: ThemeCheckboxAccent;
  checkboxUnchecked: ThemeCheckboxUnchecked;
  density: ThemeDensity;
  sidebarWidthPx: number;
}

// Add new themes here after creating frontend/src/config/themes/<theme>.json.
export const themeOrder: ThemeAccent[] = ["cafe", "mint", "rose", "blue", "comic"];

export const themeAccentLabels: Record<ThemeAccent, string> = {
  cafe: "FLAC Cafe",
  mint: "Mint",
  rose: "Rose",
  blue: "Blue Note",
  comic: "Comic Cafe",
};

export const fontChoiceLabels: Record<FontChoice, string> = {
  theme: "Theme Default",
  system: "Segoe UI",
  inter: "Inter",
  serif: "Serif",
  mono: "Mono",
  rounded: "Rounded",
  comic: "Comic Sans",
};

export const fontChoiceValues: Record<Exclude<FontChoice, "theme">, string> = {
  system: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  inter: 'Inter, "Segoe UI", system-ui, sans-serif',
  serif: '"Georgia", "Times New Roman", serif',
  mono: '"Cascadia Mono", "Consolas", "SFMono-Regular", monospace',
  rounded: '"Segoe UI Variable Display", "Segoe UI", Inter, system-ui, sans-serif',
  comic: '"Comic Sans MS", "Comic Sans", "Comic Neue", cursive',
};

type ThemePaletteJson = Omit<ThemePalette, "fontScale" | "checkboxAccent" | "checkboxUnchecked" | "density" | "sidebarWidthPx"> & {
  fontScale?: string;
  checkboxAccent?: string;
  checkboxUnchecked?: string;
  density?: string;
  sidebarWidthPx?: number;
};

function normalizeThemePalette(theme: ThemePaletteJson): ThemePalette {
  const fontScale: ThemeFontScale =
    theme.fontScale === "small" || theme.fontScale === "large" || theme.fontScale === "default"
      ? theme.fontScale
      : "default";
  const checkboxAccent: ThemeCheckboxAccent =
    theme.checkboxAccent === "moss" ||
    theme.checkboxAccent === "paper" ||
    theme.checkboxAccent === "softAccent" ||
    theme.checkboxAccent === "ember"
      ? theme.checkboxAccent
      : "ember";
  const checkboxUnchecked: ThemeCheckboxUnchecked =
    theme.checkboxUnchecked === "line" ||
    theme.checkboxUnchecked === "muted" ||
    theme.checkboxUnchecked === "moss" ||
    theme.checkboxUnchecked === "ember" ||
    theme.checkboxUnchecked === "paper" ||
    theme.checkboxUnchecked === "softAccent"
      ? theme.checkboxUnchecked
      : "line";
  const density: ThemeDensity =
    theme.density === "compact" || theme.density === "comfortable" ? theme.density : "comfortable";
  const sidebarWidthPx =
    typeof theme.sidebarWidthPx === "number" && Number.isFinite(theme.sidebarWidthPx)
      ? Math.min(sidebarWidthMaxPx, Math.max(sidebarWidthMinPx, Math.round(theme.sidebarWidthPx / sidebarWidthStepPx) * sidebarWidthStepPx))
      : sidebarWidthDefaultPx;
  return {
    ...theme,
    fontScale,
    checkboxAccent,
    checkboxUnchecked,
    density,
    sidebarWidthPx,
  };
}

export const themeAccentValues: Record<ThemeAccent, ThemePalette> = {
  cafe: normalizeThemePalette(cafeTheme),
  mint: normalizeThemePalette(mintTheme),
  rose: normalizeThemePalette(roseTheme),
  blue: normalizeThemePalette(blueTheme),
  comic: normalizeThemePalette(comicTheme),
};
