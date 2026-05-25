import blueTheme from "./themes/blue.json";
import cafeTheme from "./themes/cafe.json";
import comicTheme from "./themes/comic.json";
import mintTheme from "./themes/mint.json";
import roseTheme from "./themes/rose.json";

export type ThemeAccent = "cafe" | "mint" | "rose" | "blue" | "comic";
export type FontChoice = "theme" | "system" | "inter" | "serif" | "mono" | "rounded" | "comic";

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

export const themeAccentValues: Record<ThemeAccent, ThemePalette> = {
  cafe: cafeTheme,
  mint: mintTheme,
  rose: roseTheme,
  blue: blueTheme,
  comic: comicTheme,
};
