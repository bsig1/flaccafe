import type { FontChoice,ThemeAccent,ThemeColorOverrideValue } from "../../config/theme";
import {
defaultMiniPlayerPreset,
fontChoiceLabels,
normalizeMiniPlayerPreset,
sidebarWidthMaxPx,
sidebarWidthMinPx,
sidebarWidthStepPx,
themeColorKeys,
} from "../../config/theme";
import {
limitRecentItems,
} from "../../lib/uiInteractions";
import {
clampNumber,
normalizeEqualizerGains,
replayGainTargetPercentFromLegacyLufs,
} from "./audioControls";
import {
DEFAULT_FADE_MS,
crossfadeProfileDurations,
defaultKeyboardShortcuts,
defaultLibraryVisibleColumns,
EQUALIZER_PREAMP_MAX_DB,
EQUALIZER_PREAMP_MIN_DB,
legacyStorageKeys,
REPLAYGAIN_TARGET_DEFAULT_PERCENT,
REPLAYGAIN_TARGET_MAX_PERCENT,
REPLAYGAIN_TARGET_MIN_PERCENT,
storageKeys,
uiPreferencesChannelName,
} from "./constants";
import {
normalizeAdvancedHttpShortcuts,
normalizeKeyboardShortcuts,
normalizeLibraryColumns,
} from "./keyboard";
import type {
AutoDjTemplate,
CdSidebarMode,
CheckboxAccentPreference,
CheckboxUncheckedPreference,
CrossfadeProfile,
desktopOutputBackendMode,
EqualizerBandMode,
FontScalePreference,
LibraryColumnKey,
LibraryView,
LibrarySavedColumnLayout,
NowPlayingLayout,
NowPlayingLyricSize,
NowPlayingVisualizerStyle,
Page,
ReplayGainMode,
SidebarPlacement,
SourceScanRules,
UiDensityPreference,
UiPreferences
} from "./types";

const RUST_PLAYBACK_DEFAULT_MIGRATION_VALUE = "done";

function normalizeThemeColorOverrides(value: unknown): UiPreferences["themeColorOverrides"] {
  if (!value || typeof value !== "object") {
    return {};
  }
  const source = value as Record<string, unknown>;
  const validValues = new Set<string>(["theme", ...themeColorKeys]);
  const normalized: UiPreferences["themeColorOverrides"] = {};
  for (const key of themeColorKeys) {
    const override = source[key];
    if (typeof override === "string" && override !== "theme" && validValues.has(override)) {
      normalized[key] = override as ThemeColorOverrideValue;
    }
  }
  return normalized;
}

const libraryViews: LibraryView[] = ["tracks", "artists", "albums", "playlists", "completion", "inbox", "smart", "health"];

function normalizeLibraryColumnLayouts(value: unknown): UiPreferences["libraryColumnLayouts"] {
  if (!value || typeof value !== "object") {
    return {};
  }
  const source = value as Partial<Record<LibraryView, unknown>>;
  const normalized: Partial<Record<LibraryView, LibraryColumnKey[]>> = {};
  for (const view of libraryViews) {
    if (Array.isArray(source[view])) {
      const columns = normalizeLibraryColumns(source[view]);
      normalized[view] = columns;
    }
  }
  return normalized;
}

function crossfadeProfileForFadeMs(fadeMs: number): CrossfadeProfile {
  for (const [profile, duration] of Object.entries(crossfadeProfileDurations) as Array<[Exclude<CrossfadeProfile, "custom">, number]>) {
    if (duration === fadeMs) {
      return profile;
    }
  }
  return "custom";
}

function normalizeCrossfadeProfile(value: unknown, fallback: CrossfadeProfile): CrossfadeProfile {
  return ["off", "quick", "balanced", "smooth", "long", "custom"].includes(value as CrossfadeProfile)
    ? (value as CrossfadeProfile)
    : fallback;
}

function normalizeCrossfadeMs(value: unknown, fallback: number): number {
  return typeof value === "number" ? clampNumber(value, 0, 5000) : fallback;
}

function normalizeLibrarySavedColumnLayouts(value: unknown): LibrarySavedColumnLayout[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((layout): LibrarySavedColumnLayout | null => {
      if (!layout || typeof layout !== "object") {
        return null;
      }
      const source = layout as Partial<LibrarySavedColumnLayout>;
      const name = typeof source.name === "string" ? source.name.trim() : "";
      const columns = normalizeLibraryColumns(source.columns);
      if (!name || columns.length === 0) {
        return null;
      }
      const view = source.view && libraryViews.includes(source.view) ? source.view : undefined;
      return {
        id: typeof source.id === "string" && source.id.trim() ? source.id : `layout-${name.toLowerCase().replace(/\s+/g, "-")}`,
        name,
        columns,
        view,
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
      };
    })
    .filter((layout): layout is LibrarySavedColumnLayout => Boolean(layout))
    .slice(0, 24);
}

function normalizeSourceScanRules(value: unknown): SourceScanRules {
  if (!value || typeof value !== "object") {
    return {};
  }
  const normalized: SourceScanRules = {};
  for (const [rawKey, rawRule] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim().toLowerCase();
    if (!key || !rawRule || typeof rawRule !== "object") {
      continue;
    }
    const rule = rawRule as Partial<SourceScanRules[string]>;
    normalized[key] = {
      enabled: typeof rule.enabled === "boolean" ? rule.enabled : true,
      removeMissing: typeof rule.removeMissing === "boolean" ? rule.removeMissing : true,
    };
  }
  return normalized;
}

function completeRustPlaybackDefaultMigration(parsedPreferences?: Record<string, unknown>) {
  try {
    if (window.localStorage.getItem(storageKeys.rustPlaybackDefaultMigration) === RUST_PLAYBACK_DEFAULT_MIGRATION_VALUE) {
      return;
    }
    window.localStorage.setItem(storageKeys.rustPlaybackDefaultMigration, RUST_PLAYBACK_DEFAULT_MIGRATION_VALUE);
    if (parsedPreferences) {
      window.localStorage.setItem(storageKeys.uiPreferences, JSON.stringify(parsedPreferences));
    }
  } catch {
    // Preference migration should never block the app from starting.
  }
}

export function publishUiPreferences(preferences: UiPreferences) {
  if (!("BroadcastChannel" in window)) {
    return;
  }
  try {
    const channel = new BroadcastChannel(uiPreferencesChannelName);
    channel.postMessage({ type: "uiPreferences", preferences });
    channel.close();
  } catch {
    // Cross-window sync is a convenience; storage still holds the latest value.
  }
}

export function writeUiPreferences(preferences: UiPreferences) {
  try {
    window.localStorage.setItem(storageKeys.uiPreferences, JSON.stringify(preferences));
    window.localStorage.setItem(storageKeys.hideFilePaths, String(preferences.hideFilePaths));
  } catch {
    // Ignore private/local storage failures; the setting still works for the session.
  }
  publishUiPreferences(preferences);
}

export function readUiPreferences(): UiPreferences {
  const defaults: UiPreferences = {
    hideFilePaths: true,
    showPodcastFilePaths: false,
    cdSidebarMode: "drive",
    compactLibraryRows: false,
    displayRatingsAsNumbers: false,
    defaultQueueLength: 25,
    defaultTemperature: 0.8,
    similarityWeight: 1.4,
    crossfadeProfile: "balanced",
    playerFadeMs: DEFAULT_FADE_MS,
    crossfadeManualProfile: "balanced",
    crossfadeManualMs: DEFAULT_FADE_MS,
    crossfadeNaturalProfile: "smooth",
    crossfadeNaturalMs: crossfadeProfileDurations.smooth,
    crossfadeAlbumProfile: "off",
    crossfadeAlbumMs: crossfadeProfileDurations.off,
    crossfadeRadioProfile: "quick",
    crossfadeRadioMs: crossfadeProfileDurations.quick,
    skipThresholdPercent: 35,
    playbackEngine: "rust",
    desktopOutputBackend: "cpalShared",
    desktopOutputDeviceId: "",
    desktopBufferFrames: 0,
    showOutputDiagnosticsButton: false,
    startupPage: "library",
    albumGrid: true,
    showToasts: true,
    miniPlayer: false,
    miniPlayerAlwaysOnTop: false,
    miniPlayerWidth: 420,
    miniPlayerHeight: 118,
    miniPlayerLayout: defaultMiniPlayerPreset.layout,
    miniPlayerShowArt: defaultMiniPlayerPreset.showArt,
    miniPlayerShowLibraryButton: defaultMiniPlayerPreset.showLibraryButton,
    miniPlayerShowAlwaysOnTopButton: defaultMiniPlayerPreset.showAlwaysOnTopButton,
    miniPlayerShowMediaControls: defaultMiniPlayerPreset.showMediaControls,
    miniPlayerShowPlaybar: defaultMiniPlayerPreset.showPlaybar,
    miniPlayerShowPlaytimeNumbers: defaultMiniPlayerPreset.showPlaytimeNumbers,
    miniPlayerShowAlbumName: defaultMiniPlayerPreset.showAlbumName,
    miniPlayerWindowMode: defaultMiniPlayerPreset.windowMode,
    miniPlayerOpacity: defaultMiniPlayerPreset.opacity,
    miniPlayerShowQueue: defaultMiniPlayerPreset.showQueue,
    replayGainMode: "off",
    replayGainTargetVolumePercent: REPLAYGAIN_TARGET_DEFAULT_PERCENT,
    replayGainPreampDb: 0,
    replayGainPreventClipping: true,
    equalizerEnabled: false,
    equalizerBandMode: "10",
    equalizerPreampDb: 0,
    equalizerGains: normalizeEqualizerGains([], "10"),
    dspLimiterEnabled: true,
    nowPlayingLayout: "queue",
    nowPlayingVisualizerStyle: "radial",
    nowPlayingShowLyrics: true,
    nowPlayingShowQueue: true,
    nowPlayingLyricSize: "medium",
    nowPlayingAutoScrollLyrics: true,
    nowPlayingShowLyricSource: false,
    autoFetchLyrics: true,
    autoFetchLrcWhenPlainPresent: true,
    themeAccent: "cafe",
    themeColorOverrides: {},
    checkboxAccent: "theme",
    checkboxUnchecked: "theme",
    density: "theme",
    sidebarWidthPx: "theme",
    sidebarPlacement: "left",
    fontScale: "theme",
    fontChoice: "theme",
    enableArtistLookup: true,
    libraryVisibleColumns: defaultLibraryVisibleColumns,
    libraryColumnLayouts: {},
    librarySavedColumnLayouts: [],
    sourceScanRules: {},
    keyboardShortcuts: defaultKeyboardShortcuts,
    advancedHttpShortcuts: [],
  };
  try {
    const modern = window.localStorage.getItem(storageKeys.uiPreferences) ?? window.localStorage.getItem(legacyStorageKeys.uiPreferences);
    if (modern) {
      const parsed = JSON.parse(modern) as Partial<UiPreferences> & { playerLayout?: string };
      const rawPlaybackEngine = (parsed as { playbackEngine?: unknown }).playbackEngine;
      const migrateWebviewDefaultToRust =
        (rawPlaybackEngine === "webview" || rawPlaybackEngine === "desktop") &&
        window.localStorage.getItem(storageKeys.rustPlaybackDefaultMigration) !== RUST_PLAYBACK_DEFAULT_MIGRATION_VALUE;
      completeRustPlaybackDefaultMigration(
        migrateWebviewDefaultToRust ? { ...parsed, playbackEngine: defaults.playbackEngine } : undefined,
      );
      // Older builds stored a compact bottom-player mode; the main player now stays full-width.
      const validPages: Page[] = ["library", "analysis", "nowPlaying", "artist", "audiobooks", "podcasts", "radio", "scrobbling", "cd", "history", "autodj", "sources", "fileManagement", "settings"];
      const miniPlayerPreset = normalizeMiniPlayerPreset({
        layout: parsed.miniPlayerLayout,
        showArt: parsed.miniPlayerShowArt,
        showLibraryButton: parsed.miniPlayerShowLibraryButton,
        showAlwaysOnTopButton: parsed.miniPlayerShowAlwaysOnTopButton,
        showMediaControls: parsed.miniPlayerShowMediaControls,
        showPlaybar: parsed.miniPlayerShowPlaybar,
        showPlaytimeNumbers: parsed.miniPlayerShowPlaytimeNumbers,
        showAlbumName: parsed.miniPlayerShowAlbumName,
        windowMode: parsed.miniPlayerWindowMode,
        opacity: parsed.miniPlayerOpacity,
        showQueue: parsed.miniPlayerShowQueue,
      });
      return {
        ...defaults,
        ...parsed,
        miniPlayer: false,
        miniPlayerAlwaysOnTop:
          typeof parsed.miniPlayerAlwaysOnTop === "boolean" ? parsed.miniPlayerAlwaysOnTop : defaults.miniPlayerAlwaysOnTop,
        miniPlayerWidth: typeof parsed.miniPlayerWidth === "number" ? clampNumber(parsed.miniPlayerWidth, 360, 900) : defaults.miniPlayerWidth,
        miniPlayerHeight: typeof parsed.miniPlayerHeight === "number" ? clampNumber(parsed.miniPlayerHeight, 92, 420) : defaults.miniPlayerHeight,
        miniPlayerLayout: miniPlayerPreset.layout,
        miniPlayerShowArt: miniPlayerPreset.showArt,
        miniPlayerShowLibraryButton: miniPlayerPreset.showLibraryButton,
        miniPlayerShowAlwaysOnTopButton: miniPlayerPreset.showAlwaysOnTopButton,
        miniPlayerShowMediaControls: miniPlayerPreset.showMediaControls,
        miniPlayerShowPlaybar: miniPlayerPreset.showPlaybar,
        miniPlayerShowPlaytimeNumbers: miniPlayerPreset.showPlaytimeNumbers,
        miniPlayerShowAlbumName: miniPlayerPreset.showAlbumName,
        miniPlayerWindowMode: miniPlayerPreset.windowMode,
        miniPlayerOpacity: miniPlayerPreset.opacity,
        miniPlayerShowQueue: miniPlayerPreset.showQueue,
        replayGainMode: ["off", "track", "album"].includes(parsed.replayGainMode as ReplayGainMode)
          ? (parsed.replayGainMode as ReplayGainMode)
          : defaults.replayGainMode,
        replayGainPreampDb:
          typeof parsed.replayGainPreampDb === "number"
            ? clampNumber(parsed.replayGainPreampDb, -12, 12)
            : defaults.replayGainPreampDb,
        replayGainTargetVolumePercent:
          typeof parsed.replayGainTargetVolumePercent === "number"
            ? clampNumber(parsed.replayGainTargetVolumePercent, REPLAYGAIN_TARGET_MIN_PERCENT, REPLAYGAIN_TARGET_MAX_PERCENT)
            : typeof (parsed as { replayGainTargetLufs?: unknown }).replayGainTargetLufs === "number"
              ? replayGainTargetPercentFromLegacyLufs((parsed as { replayGainTargetLufs: number }).replayGainTargetLufs)
              : defaults.replayGainTargetVolumePercent,
        playbackEngine: defaults.playbackEngine,
        desktopOutputBackend: ["cpalShared", "wasapiExclusive"].includes(parsed.desktopOutputBackend as desktopOutputBackendMode)
          ? (parsed.desktopOutputBackend as desktopOutputBackendMode)
          : defaults.desktopOutputBackend,
        desktopOutputDeviceId:
          typeof parsed.desktopOutputDeviceId === "string" ? parsed.desktopOutputDeviceId : defaults.desktopOutputDeviceId,
        desktopBufferFrames:
          typeof parsed.desktopBufferFrames === "number"
            ? clampNumber(parsed.desktopBufferFrames, 0, 16_384)
            : defaults.desktopBufferFrames,
        showOutputDiagnosticsButton:
          typeof parsed.showOutputDiagnosticsButton === "boolean"
            ? parsed.showOutputDiagnosticsButton
            : defaults.showOutputDiagnosticsButton,
        replayGainPreventClipping:
          typeof parsed.replayGainPreventClipping === "boolean"
            ? parsed.replayGainPreventClipping
            : defaults.replayGainPreventClipping,
        equalizerEnabled:
          typeof parsed.equalizerEnabled === "boolean" ? parsed.equalizerEnabled : defaults.equalizerEnabled,
        equalizerBandMode: ["10", "15"].includes(parsed.equalizerBandMode as EqualizerBandMode)
          ? (parsed.equalizerBandMode as EqualizerBandMode)
          : defaults.equalizerBandMode,
        equalizerPreampDb:
          typeof parsed.equalizerPreampDb === "number"
            ? clampNumber(parsed.equalizerPreampDb, EQUALIZER_PREAMP_MIN_DB, EQUALIZER_PREAMP_MAX_DB)
            : defaults.equalizerPreampDb,
        equalizerGains: normalizeEqualizerGains(
          parsed.equalizerGains,
          ["10", "15"].includes(parsed.equalizerBandMode as EqualizerBandMode)
            ? (parsed.equalizerBandMode as EqualizerBandMode)
            : defaults.equalizerBandMode,
        ),
        dspLimiterEnabled:
          typeof parsed.dspLimiterEnabled === "boolean" ? parsed.dspLimiterEnabled : defaults.dspLimiterEnabled,
        nowPlayingLayout:
          ["studio", "theater"].includes(parsed.nowPlayingLayout as string)
            ? "queue"
            : ["queue", "lyrics", "party"].includes(parsed.nowPlayingLayout as NowPlayingLayout)
              ? (parsed.nowPlayingLayout as NowPlayingLayout)
              : defaults.nowPlayingLayout,
        nowPlayingVisualizerStyle: ["bars", "wave", "radial", "off"].includes(
          parsed.nowPlayingVisualizerStyle as NowPlayingVisualizerStyle,
        )
          ? (parsed.nowPlayingVisualizerStyle as NowPlayingVisualizerStyle)
          : defaults.nowPlayingVisualizerStyle,
        nowPlayingShowLyrics:
          typeof parsed.nowPlayingShowLyrics === "boolean" ? parsed.nowPlayingShowLyrics : defaults.nowPlayingShowLyrics,
        nowPlayingShowQueue:
          typeof parsed.nowPlayingShowQueue === "boolean" ? parsed.nowPlayingShowQueue : defaults.nowPlayingShowQueue,
        nowPlayingLyricSize: ["small", "medium", "large"].includes(parsed.nowPlayingLyricSize as NowPlayingLyricSize)
          ? (parsed.nowPlayingLyricSize as NowPlayingLyricSize)
          : defaults.nowPlayingLyricSize,
        nowPlayingAutoScrollLyrics:
          typeof parsed.nowPlayingAutoScrollLyrics === "boolean"
            ? parsed.nowPlayingAutoScrollLyrics
            : defaults.nowPlayingAutoScrollLyrics,
        nowPlayingShowLyricSource:
          typeof parsed.nowPlayingShowLyricSource === "boolean"
            ? parsed.nowPlayingShowLyricSource
            : defaults.nowPlayingShowLyricSource,
        autoFetchLyrics:
          typeof parsed.autoFetchLyrics === "boolean" ? parsed.autoFetchLyrics : defaults.autoFetchLyrics,
        autoFetchLrcWhenPlainPresent:
          typeof parsed.autoFetchLrcWhenPlainPresent === "boolean"
            ? parsed.autoFetchLrcWhenPlainPresent
            : defaults.autoFetchLrcWhenPlainPresent,
        showPodcastFilePaths:
          typeof parsed.showPodcastFilePaths === "boolean"
            ? parsed.showPodcastFilePaths
            : defaults.showPodcastFilePaths,
        displayRatingsAsNumbers:
          typeof parsed.displayRatingsAsNumbers === "boolean"
            ? parsed.displayRatingsAsNumbers
            : defaults.displayRatingsAsNumbers,
        cdSidebarMode:
          ["never", "drive", "always"].includes(parsed.cdSidebarMode as CdSidebarMode)
            ? (parsed.cdSidebarMode as CdSidebarMode)
            : typeof (parsed as { showCdSidebarTab?: unknown }).showCdSidebarTab === "boolean"
              ? (parsed as { showCdSidebarTab: boolean }).showCdSidebarTab
                ? "drive"
                : "never"
              : defaults.cdSidebarMode,
        startupPage: validPages.includes(parsed.startupPage as Page) ? (parsed.startupPage as Page) : defaults.startupPage,
        themeAccent: ["cafe", "mint", "rose", "blue", "comic"].includes(parsed.themeAccent as ThemeAccent)
          ? (parsed.themeAccent as ThemeAccent)
          : defaults.themeAccent,
        themeColorOverrides: normalizeThemeColorOverrides(parsed.themeColorOverrides),
        checkboxAccent: ["theme", "ember", "moss", "paper", "softAccent"].includes(parsed.checkboxAccent as CheckboxAccentPreference)
          ? (parsed.checkboxAccent as CheckboxAccentPreference)
          : defaults.checkboxAccent,
        checkboxUnchecked: ["theme", "line", "muted", "moss", "ember", "paper", "softAccent"].includes(parsed.checkboxUnchecked as CheckboxUncheckedPreference)
          ? (parsed.checkboxUnchecked as CheckboxUncheckedPreference)
          : defaults.checkboxUnchecked,
        density: ["theme", "comfortable", "compact"].includes(parsed.density as UiDensityPreference)
          ? (parsed.density as UiDensityPreference)
          : typeof parsed.compactLibraryRows === "boolean" && parsed.compactLibraryRows
            ? "compact"
            : defaults.density,
        sidebarWidthPx:
          parsed.sidebarWidthPx === "theme"
            ? "theme"
            : typeof parsed.sidebarWidthPx === "number"
              ? clampNumber(
                  Math.round(parsed.sidebarWidthPx / sidebarWidthStepPx) * sidebarWidthStepPx,
                  sidebarWidthMinPx,
                  sidebarWidthMaxPx,
                )
              : defaults.sidebarWidthPx,
        sidebarPlacement: ["left", "right"].includes(parsed.sidebarPlacement as SidebarPlacement)
          ? (parsed.sidebarPlacement as SidebarPlacement)
          : defaults.sidebarPlacement,
        fontScale: ["theme", "small", "default", "large"].includes(parsed.fontScale as FontScalePreference)
          ? (parsed.fontScale as FontScalePreference)
          : defaults.fontScale,
        fontChoice: Object.keys(fontChoiceLabels).includes(parsed.fontChoice as FontChoice)
          ? (parsed.fontChoice as FontChoice)
          : defaults.fontChoice,
        playerFadeMs:
          typeof parsed.playerFadeMs === "number"
            ? clampNumber(parsed.playerFadeMs === 150 ? defaults.playerFadeMs : parsed.playerFadeMs, 0, 5000)
            : defaults.playerFadeMs,
        crossfadeProfile:
          normalizeCrossfadeProfile(parsed.crossfadeProfile, crossfadeProfileForFadeMs(
            typeof parsed.playerFadeMs === "number"
              ? clampNumber(parsed.playerFadeMs === 150 ? defaults.playerFadeMs : parsed.playerFadeMs, 0, 5000)
              : defaults.playerFadeMs,
          )),
        crossfadeManualProfile:
          normalizeCrossfadeProfile(parsed.crossfadeManualProfile, normalizeCrossfadeProfile(parsed.crossfadeProfile, defaults.crossfadeManualProfile)),
        crossfadeManualMs:
          normalizeCrossfadeMs(
            parsed.crossfadeManualMs,
            typeof parsed.playerFadeMs === "number"
              ? clampNumber(parsed.playerFadeMs === 150 ? defaults.playerFadeMs : parsed.playerFadeMs, 0, 5000)
              : defaults.crossfadeManualMs,
          ),
        crossfadeNaturalProfile:
          normalizeCrossfadeProfile(parsed.crossfadeNaturalProfile, defaults.crossfadeNaturalProfile),
        crossfadeNaturalMs:
          normalizeCrossfadeMs(parsed.crossfadeNaturalMs, defaults.crossfadeNaturalMs),
        crossfadeAlbumProfile:
          normalizeCrossfadeProfile(parsed.crossfadeAlbumProfile, defaults.crossfadeAlbumProfile),
        crossfadeAlbumMs:
          normalizeCrossfadeMs(parsed.crossfadeAlbumMs, defaults.crossfadeAlbumMs),
        crossfadeRadioProfile:
          normalizeCrossfadeProfile(parsed.crossfadeRadioProfile, defaults.crossfadeRadioProfile),
        crossfadeRadioMs:
          normalizeCrossfadeMs(parsed.crossfadeRadioMs, defaults.crossfadeRadioMs),
        skipThresholdPercent:
          typeof parsed.skipThresholdPercent === "number"
            ? clampNumber(parsed.skipThresholdPercent, 0, 95)
            : defaults.skipThresholdPercent,
        libraryVisibleColumns: normalizeLibraryColumns(parsed.libraryVisibleColumns),
        libraryColumnLayouts: normalizeLibraryColumnLayouts(parsed.libraryColumnLayouts),
        librarySavedColumnLayouts: normalizeLibrarySavedColumnLayouts(parsed.librarySavedColumnLayouts),
        sourceScanRules: normalizeSourceScanRules(parsed.sourceScanRules),
        keyboardShortcuts: normalizeKeyboardShortcuts(parsed.keyboardShortcuts),
        advancedHttpShortcuts: normalizeAdvancedHttpShortcuts(parsed.advancedHttpShortcuts),
      };
    }
    completeRustPlaybackDefaultMigration();
    return {
      ...defaults,
      hideFilePaths:
        (window.localStorage.getItem(storageKeys.hideFilePaths) ?? window.localStorage.getItem(legacyStorageKeys.hideFilePaths)) !== "false",
    };
  } catch {
    completeRustPlaybackDefaultMigration();
    return defaults;
  }
}

export function readAutoDjTemplates(): AutoDjTemplate[] {
  try {
    const raw = window.localStorage.getItem(storageKeys.autoDjTemplates);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as AutoDjTemplate[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return limitRecentItems(
      parsed.filter((template) => template?.id && template?.name && template?.settings),
      24,
    );
  } catch {
    return [];
  }
}

export function writeAutoDjTemplates(templates: AutoDjTemplate[]) {
  try {
    window.localStorage.setItem(storageKeys.autoDjTemplates, JSON.stringify(limitRecentItems(templates, 24)));
  } catch {
    // Templates are a convenience; failing to persist them should not block AutoDJ.
  }
}

export function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
