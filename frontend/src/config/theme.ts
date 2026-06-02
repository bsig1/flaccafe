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
export type MiniPlayerLayoutPreset = "classic" | "wide" | "artwork" | "compact";
export type MiniPlayerWindowMode = "native";
export const sidebarWidthMinPx = 192;
export const sidebarWidthMaxPx = 320;
export const sidebarWidthStepPx = 8;
export const sidebarWidthDefaultPx = 224;

export const themeColorKeys = [
  "ember",
  "moss",
  "ink",
  "panel",
  "line",
  "muted",
  "paper",
  "hoverPanel",
  "sidebar",
  "strip",
  "subtle",
  "popover",
  "quiet",
  "mini",
  "miniPanel",
  "surfaceGlow",
  "primaryHover",
  "softAccent",
  "scrollTrack",
  "scrollThumb",
  "scrollThumbHover",
] as const;
export type ThemeColorKey = (typeof themeColorKeys)[number];
export const themeColorSwatchKeys = [
  "swatchRed",
  "swatchOrange",
  "swatchAmber",
  "swatchYellow",
  "swatchGreen",
  "swatchMoss",
  "swatchTeal",
  "swatchCyan",
  "swatchBlue",
  "swatchPurple",
  "swatchPink",
  "swatchRose",
  "swatchBrown",
  "swatchGray",
  "swatchSlate",
  "swatchBlack",
  "swatchWhite",
] as const;
export type ThemeColorSwatchKey = (typeof themeColorSwatchKeys)[number];
export type ThemeColorOverrideValue = "theme" | ThemeColorKey | ThemeColorSwatchKey;
export type ThemeColorOverrides = Partial<Record<ThemeColorKey, ThemeColorOverrideValue>>;

export const themeColorLabels: Record<ThemeColorKey, string> = {
  ember: "Primary",
  moss: "Secondary",
  ink: "App Background",
  panel: "Panel",
  line: "Border",
  muted: "Muted Text",
  paper: "Bright Text",
  hoverPanel: "Hover Panel",
  sidebar: "Sidebar",
  strip: "Header Strip",
  subtle: "Row Surface",
  popover: "Popover",
  quiet: "Page Surface",
  mini: "Mini Player",
  miniPanel: "Mini Panel",
  surfaceGlow: "Surface Glow",
  primaryHover: "Primary Hover",
  softAccent: "Soft Accent",
  scrollTrack: "Scroll Track",
  scrollThumb: "Scroll Thumb",
  scrollThumbHover: "Scroll Thumb Hover",
};

export const themeColorCssVariables: Record<ThemeColorKey, string> = {
  ember: "--color-ember",
  moss: "--color-moss",
  ink: "--color-ink",
  panel: "--color-panel",
  line: "--color-line",
  muted: "--color-muted",
  paper: "--color-paper",
  hoverPanel: "--color-hover-panel",
  sidebar: "--color-sidebar",
  strip: "--color-strip",
  subtle: "--color-subtle",
  popover: "--color-popover",
  quiet: "--color-quiet",
  mini: "--color-mini",
  miniPanel: "--color-mini-panel",
  surfaceGlow: "--color-surface-glow",
  primaryHover: "--color-primary-hover",
  softAccent: "--color-soft-accent",
  scrollTrack: "--color-scroll-track",
  scrollThumb: "--color-scroll-thumb",
  scrollThumbHover: "--color-scroll-thumb-hover",
};

export const themeColorSwatchLabels: Record<ThemeColorSwatchKey, string> = {
  swatchRed: "Red",
  swatchOrange: "Orange",
  swatchAmber: "Amber",
  swatchYellow: "Yellow",
  swatchGreen: "Green",
  swatchMoss: "Moss",
  swatchTeal: "Teal",
  swatchCyan: "Cyan",
  swatchBlue: "Blue",
  swatchPurple: "Purple",
  swatchPink: "Pink",
  swatchRose: "Rose",
  swatchBrown: "Brown",
  swatchGray: "Gray",
  swatchSlate: "Slate",
  swatchBlack: "Black",
  swatchWhite: "White",
};

export const themeColorSwatchValues: Record<ThemeColorSwatchKey, string> = {
  swatchRed: "239 68 68",
  swatchOrange: "249 115 22",
  swatchAmber: "245 158 11",
  swatchYellow: "234 179 8",
  swatchGreen: "34 197 94",
  swatchMoss: "118 171 150",
  swatchTeal: "20 184 166",
  swatchCyan: "6 182 212",
  swatchBlue: "59 130 246",
  swatchPurple: "168 85 247",
  swatchPink: "236 72 153",
  swatchRose: "244 63 94",
  swatchBrown: "146 104 73",
  swatchGray: "156 163 175",
  swatchSlate: "100 116 139",
  swatchBlack: "15 23 42",
  swatchWhite: "245 245 244",
};

export interface ThemeMiniPlayerPreset {
  layout: MiniPlayerLayoutPreset;
  showArt: boolean;
  showLibraryButton: boolean;
  showAlwaysOnTopButton: boolean;
  showMediaControls: boolean;
  showPlaybar: boolean;
  showPlaytimeNumbers: boolean;
  showAlbumName: boolean;
  windowMode: MiniPlayerWindowMode;
  opacity: number;
  showQueue: boolean;
}

export const defaultMiniPlayerPreset: ThemeMiniPlayerPreset = {
  layout: "classic",
  showArt: true,
  showLibraryButton: true,
  showAlwaysOnTopButton: true,
  showMediaControls: true,
  showPlaybar: true,
  showPlaytimeNumbers: true,
  showAlbumName: true,
  windowMode: "native",
  opacity: 1,
  showQueue: true,
};

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
  miniPlayer: ThemeMiniPlayerPreset;
}

export function resolveThemeColor(
  palette: ThemePalette,
  overrides: ThemeColorOverrides | undefined,
  key: ThemeColorKey,
): string {
  const override = overrides?.[key];
  if (override && override !== "theme" && override in themeColorSwatchValues) {
    return themeColorSwatchValues[override as ThemeColorSwatchKey];
  }
  const sourceKey = override && override !== "theme" ? override : key;
  return palette[sourceKey as ThemeColorKey] ?? palette[key];
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

type ThemeMiniPlayerPresetJson = Partial<Omit<ThemeMiniPlayerPreset, "layout" | "windowMode">> & {
  layout?: string;
  windowMode?: string;
};

type ThemePaletteJson = Omit<ThemePalette, "fontScale" | "checkboxAccent" | "checkboxUnchecked" | "density" | "sidebarWidthPx" | "miniPlayer"> & {
  fontScale?: string;
  checkboxAccent?: string;
  checkboxUnchecked?: string;
  density?: string;
  sidebarWidthPx?: number;
  miniPlayer?: ThemeMiniPlayerPresetJson;
};

export function normalizeMiniPlayerPreset(value?: Partial<ThemeMiniPlayerPreset> | ThemeMiniPlayerPresetJson): ThemeMiniPlayerPreset {
  const layout =
    value?.layout === "wide" || value?.layout === "artwork" || value?.layout === "compact" || value?.layout === "classic"
      ? value.layout
      : defaultMiniPlayerPreset.layout;
  return {
    layout,
    showArt: layout === "artwork" ? true : typeof value?.showArt === "boolean" ? value.showArt : defaultMiniPlayerPreset.showArt,
    showLibraryButton:
      typeof value?.showLibraryButton === "boolean" ? value.showLibraryButton : defaultMiniPlayerPreset.showLibraryButton,
    showAlwaysOnTopButton:
      typeof value?.showAlwaysOnTopButton === "boolean" ? value.showAlwaysOnTopButton : defaultMiniPlayerPreset.showAlwaysOnTopButton,
    showMediaControls:
      typeof value?.showMediaControls === "boolean" ? value.showMediaControls : defaultMiniPlayerPreset.showMediaControls,
    showPlaybar:
      typeof value?.showPlaybar === "boolean" ? value.showPlaybar : defaultMiniPlayerPreset.showPlaybar,
    showPlaytimeNumbers:
      typeof value?.showPlaytimeNumbers === "boolean" ? value.showPlaytimeNumbers : defaultMiniPlayerPreset.showPlaytimeNumbers,
    showAlbumName: typeof value?.showAlbumName === "boolean" ? value.showAlbumName : defaultMiniPlayerPreset.showAlbumName,
    windowMode: "native",
    opacity:
      typeof value?.opacity === "number" && Number.isFinite(value.opacity)
        ? Math.min(1, Math.max(0.35, value.opacity))
        : defaultMiniPlayerPreset.opacity,
    showQueue: typeof value?.showQueue === "boolean" ? value.showQueue : defaultMiniPlayerPreset.showQueue,
  };
}

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
    miniPlayer: normalizeMiniPlayerPreset(theme.miniPlayer),
  };
}

export const themeAccentValues: Record<ThemeAccent, ThemePalette> = {
  cafe: normalizeThemePalette(cafeTheme),
  mint: normalizeThemePalette(mintTheme),
  rose: normalizeThemePalette(roseTheme),
  blue: normalizeThemePalette(blueTheme),
  comic: normalizeThemePalette(comicTheme),
};
