import type { FontChoice, ThemeAccent } from "../../config/theme";
import { fontChoiceLabels } from "../../config/theme";
import type {
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AutoDjSettings,
  ClapInstallProgress,
  QueueTrack,
  RecommendationDrift,
  Track,
} from "../../types/api";
import type {
  AutoDjTemplate,
  CdSidebarMode,
  desktopOutputBackendMode,
  EqualizerBandMode,
  FontScale,
  NowPlayingLayout,
  NowPlayingLyricSize,
  NowPlayingVisualizerStyle,
  Page,
  PlaybackEngine,
  ReplayGainMode,
  UiDensity,
  UiPreferences,
} from "./types";
import {
  defaultAutoDj,
  defaultKeyboardShortcuts,
  defaultLibraryVisibleColumns,
  DEFAULT_FADE_MS,
  EQUALIZER_GAIN_MIN_DB,
  EQUALIZER_PREAMP_MAX_DB,
  EQUALIZER_PREAMP_MIN_DB,
  legacyStorageKeys,
  REPLAYGAIN_TARGET_DEFAULT_PERCENT,
  REPLAYGAIN_TARGET_MAX_PERCENT,
  REPLAYGAIN_TARGET_MIN_PERCENT,
  storageKeys,
} from "./constants";
import {
  clampNumber,
  normalizeEqualizerGains,
  replayGainTargetPercentFromLegacyLufs,
} from "./audioControls";
import {
  normalizeAdvancedHttpShortcuts,
  normalizeKeyboardShortcuts,
  normalizeLibraryColumns,
} from "./keyboard";
import {
  limitRecentItems,
} from "../../lib/uiInteractions";

const RUST_PLAYBACK_DEFAULT_MIGRATION_VALUE = "done";

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

export function readUiPreferences(): UiPreferences {
  const defaults: UiPreferences = {
    hideFilePaths: true,
    showPodcastFilePaths: false,
    cdSidebarMode: "drive",
    compactLibraryRows: false,
    defaultQueueLength: 25,
    defaultTemperature: 0.8,
    similarityWeight: 1.4,
    playerFadeMs: DEFAULT_FADE_MS,
    skipThresholdPercent: 35,
    playbackEngine: "rust",
    desktopOutputBackend: "cpalShared",
    desktopOutputDeviceId: "",
    desktopBufferFrames: 0,
    startupPage: "library",
    albumGrid: true,
    showToasts: true,
    miniPlayer: false,
    miniPlayerAlwaysOnTop: false,
    miniPlayerWidth: 420,
    miniPlayerHeight: 118,
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
    autoFetchLyrics: true,
    autoFetchLrcWhenPlainPresent: true,
    themeAccent: "cafe",
    density: "comfortable",
    fontScale: "default",
    fontChoice: "theme",
    enableArtistLookup: true,
    libraryVisibleColumns: defaultLibraryVisibleColumns,
    keyboardShortcuts: defaultKeyboardShortcuts,
    advancedHttpShortcuts: [],
  };
  try {
    const modern = window.localStorage.getItem(storageKeys.uiPreferences) ?? window.localStorage.getItem(legacyStorageKeys.uiPreferences);
    if (modern) {
      const parsed = JSON.parse(modern) as Partial<UiPreferences> & { playerLayout?: string };
      const rawPlaybackEngine = (parsed as { playbackEngine?: unknown }).playbackEngine;
      const parsedPlaybackEngine = rawPlaybackEngine === "desktop" ? "rust" : rawPlaybackEngine;
      const migrateWebviewDefaultToRust =
        parsedPlaybackEngine === "webview" &&
        window.localStorage.getItem(storageKeys.rustPlaybackDefaultMigration) !== RUST_PLAYBACK_DEFAULT_MIGRATION_VALUE;
      completeRustPlaybackDefaultMigration(
        migrateWebviewDefaultToRust ? { ...parsed, playbackEngine: defaults.playbackEngine } : undefined,
      );
      // Older builds stored a compact bottom-player mode; the main player now stays full-width.
      const validPages: Page[] = ["library", "analysis", "nowPlaying", "artist", "audiobooks", "podcasts", "radio", "scrobbling", "cd", "history", "autodj", "sources", "fileManagement", "settings"];
      return {
        ...defaults,
        ...parsed,
        miniPlayer: false,
        miniPlayerAlwaysOnTop:
          typeof parsed.miniPlayerAlwaysOnTop === "boolean" ? parsed.miniPlayerAlwaysOnTop : defaults.miniPlayerAlwaysOnTop,
        miniPlayerWidth: typeof parsed.miniPlayerWidth === "number" ? clampNumber(parsed.miniPlayerWidth, 360, 900) : defaults.miniPlayerWidth,
        miniPlayerHeight: typeof parsed.miniPlayerHeight === "number" ? clampNumber(parsed.miniPlayerHeight, 96, 220) : defaults.miniPlayerHeight,
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
        playbackEngine: migrateWebviewDefaultToRust
          ? defaults.playbackEngine
          : ["webview", "rust"].includes(parsedPlaybackEngine as PlaybackEngine)
            ? (parsedPlaybackEngine as PlaybackEngine)
            : defaults.playbackEngine,
        desktopOutputBackend: ["cpalShared", "wasapiExclusive", "asio"].includes(parsed.desktopOutputBackend as desktopOutputBackendMode)
          ? (parsed.desktopOutputBackend as desktopOutputBackendMode)
          : defaults.desktopOutputBackend,
        desktopOutputDeviceId:
          typeof parsed.desktopOutputDeviceId === "string" ? parsed.desktopOutputDeviceId : defaults.desktopOutputDeviceId,
        desktopBufferFrames:
          typeof parsed.desktopBufferFrames === "number"
            ? clampNumber(parsed.desktopBufferFrames, 0, 16_384)
            : defaults.desktopBufferFrames,
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
        density: ["comfortable", "compact"].includes(parsed.density as UiDensity)
          ? (parsed.density as UiDensity)
          : defaults.density,
        fontScale: ["small", "default", "large"].includes(parsed.fontScale as FontScale)
          ? (parsed.fontScale as FontScale)
          : defaults.fontScale,
        fontChoice: Object.keys(fontChoiceLabels).includes(parsed.fontChoice as FontChoice)
          ? (parsed.fontChoice as FontChoice)
          : defaults.fontChoice,
        playerFadeMs:
          typeof parsed.playerFadeMs === "number"
            ? clampNumber(parsed.playerFadeMs === 150 ? defaults.playerFadeMs : parsed.playerFadeMs, 0, 5000)
            : defaults.playerFadeMs,
        skipThresholdPercent:
          typeof parsed.skipThresholdPercent === "number"
            ? clampNumber(parsed.skipThresholdPercent, 0, 95)
            : defaults.skipThresholdPercent,
        libraryVisibleColumns: normalizeLibraryColumns(parsed.libraryVisibleColumns),
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
