import {
defaultMiniPlayerPreset,
normalizeMiniPlayerPreset,
themeAccentValues,
type MiniPlayerLayoutPreset,
type ThemeAccent,
type ThemeMiniPlayerPreset,
} from "../../config/theme";
import type {
UiPreferences,
} from "./types";

const MINI_PLAYER_QUEUE_HEADER_HEIGHT_PX = 32;
const MINI_PLAYER_QUEUE_OPEN_CONTENT_HEIGHT_PX = 128;
const MINI_PLAYER_PLAYBAR_HEIGHT_PX = 18;

export const miniPlayerLayoutLabels: Record<MiniPlayerLayoutPreset, string> = {
  classic: "Classic",
  wide: "Wide",
  artwork: "Artwork",
  compact: "Compact",
};

export function themeMiniPlayerPreset(themeAccent: ThemeAccent): ThemeMiniPlayerPreset {
  return themeAccentValues[themeAccent]?.miniPlayer ?? themeAccentValues.cafe.miniPlayer;
}

export function miniPlayerPresetFromPreferences(preferences: UiPreferences): ThemeMiniPlayerPreset {
  return normalizeMiniPlayerPreset({
    layout: preferences.miniPlayerLayout,
    showArt: preferences.miniPlayerShowArt,
    showLibraryButton: preferences.miniPlayerShowLibraryButton,
    showAlwaysOnTopButton: preferences.miniPlayerShowAlwaysOnTopButton,
    showMediaControls: preferences.miniPlayerShowMediaControls,
    showPlaybar: preferences.miniPlayerShowPlaybar,
    showPlaytimeNumbers: preferences.miniPlayerShowPlaytimeNumbers,
    showAlbumName: preferences.miniPlayerShowAlbumName,
    windowMode: preferences.miniPlayerWindowMode,
    opacity: preferences.miniPlayerOpacity,
    showQueue: preferences.miniPlayerShowQueue,
  });
}

export function miniPlayerPreferencePatch(preset: Partial<ThemeMiniPlayerPreset>): Partial<UiPreferences> {
  const normalized = normalizeMiniPlayerPreset({ ...defaultMiniPlayerPreset, ...preset });
  return {
    miniPlayerLayout: normalized.layout,
    miniPlayerShowArt: normalized.showArt,
    miniPlayerShowLibraryButton: normalized.showLibraryButton,
    miniPlayerShowAlwaysOnTopButton: normalized.showAlwaysOnTopButton,
    miniPlayerShowMediaControls: normalized.showMediaControls,
    miniPlayerShowPlaybar: normalized.showPlaybar,
    miniPlayerShowPlaytimeNumbers: normalized.showPlaytimeNumbers,
    miniPlayerShowAlbumName: normalized.showAlbumName,
    miniPlayerWindowMode: normalized.windowMode,
    miniPlayerOpacity: normalized.opacity,
    miniPlayerShowQueue: normalized.showQueue,
  };
}

export function miniPlayerSizeForPreset(preset: ThemeMiniPlayerPreset, queueOpen = false): { width: number; height: number } {
  const base =
    preset.layout === "wide"
      ? { width: 560, height: 136 }
      : preset.layout === "artwork"
        ? { width: 380, height: 222 }
        : preset.layout === "compact"
          ? { width: 340, height: 92 }
          : { width: 420, height: 118 };
  const width = preset.showArt
    ? base.width
    : preset.layout === "compact"
      ? Math.max(300, base.width - 40)
      : Math.max(360, base.width - 72);
  const playbarAdjustment = preset.showPlaybar
    ? 0
    : preset.layout === "compact"
      ? -10
      : -MINI_PLAYER_PLAYBAR_HEIGHT_PX;
  const queueHeight = preset.showQueue
    ? MINI_PLAYER_QUEUE_HEADER_HEIGHT_PX + (queueOpen ? MINI_PLAYER_QUEUE_OPEN_CONTENT_HEIGHT_PX : 0)
    : 0;
  const height = Math.max(92, base.height + playbarAdjustment + queueHeight);
  return { width, height };
}
