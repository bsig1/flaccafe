import type {
CSSProperties,
} from "react";
import {
useEffect,
useState,
} from "react";

import {
Disc3,
ExternalLink,
EyeOff,
Fingerprint,
FolderOpen,
KeyRound,
Podcast,
RotateCcw,
Search,
Star,
X,
} from "lucide-react";

import type {
FontChoice,
ThemeAccent,
ThemeColorKey,
ThemeColorOverrideValue,
ThemeColorSwatchKey,
ThemePalette,
} from "../../config/theme";
import {
fontChoiceLabels,
resolveThemeColor,
sidebarWidthDefaultPx,
sidebarWidthMaxPx,
sidebarWidthMinPx,
sidebarWidthStepPx,
themeAccentLabels,
themeAccentValues,
themeColorCssVariables,
themeColorKeys,
themeColorLabels,
themeColorSwatchKeys,
themeColorSwatchLabels,
themeColorSwatchValues,
themeOrder,
} from "../../config/theme";
import {
cancelBulkLyricsLookup,
fetchBulkLyricsLookupProgress,
startBulkLyricsLookup,
} from "../../lib/api";
import type {
PlaybackDiagnosticsResponse,
desktopAudioDevice,
desktopOutputBackend,
} from "../../lib/desktopPlayback";
import {
desktopClearDiagnostics,
desktopDiagnostics,
desktopListOutputDevices,
desktopOutputBackends,
} from "../../lib/desktopPlayback";
import {
openExternalUrl,
} from "../../lib/externalLinks";
import type {
BulkLyricsProgress,
BulkLyricsSaveLocation,
LogTailResponse,
SettingsResponse,
StartupDiagnosticsResponse,
Track,
} from "../../types/api";
import {
DisclosureAccordionProvider,
DisclosureSection,
} from "../components/common";
import {
BackendStatus,
CheckboxAccentPreference,
CheckboxUncheckedPreference,
FontScalePreference,
Page,
RememberedDeleteChoice,
SidebarPlacement,
SidebarWidthPreference,
UiDensityPreference,
UiPreferences,
clearRememberedDeleteChoice,
readRememberedDeleteChoice,
writeRememberedDeleteChoice,
} from "../shared";
import { ExtensionsSection } from "./settings/ExtensionsSection";
import { KeyboardShortcutsSection } from "./settings/KeyboardShortcutsSection";
import { MaintenanceSection } from "./settings/MaintenanceSection";
import { PlayerSettingsSection } from "./settings/PlayerSettingsSection";

const LASTFM_API_URL = "https://www.last.fm/api";
const ACOUSTID_API_KEY_URL = "https://acoustid.org/api-key";
const checkboxAccentLabels: Record<CheckboxAccentPreference, string> = {
  theme: "Theme Default",
  ember: "Ember",
  moss: "Moss",
  paper: "Paper",
  softAccent: "Soft Accent",
};
const checkboxUncheckedLabels: Record<CheckboxUncheckedPreference, string> = {
  theme: "Theme Default",
  line: "Line",
  muted: "Muted",
  ember: "Ember",
  moss: "Moss",
  paper: "Paper",
  softAccent: "Soft Accent",
};
const fontScaleLabels: Record<FontScalePreference, string> = {
  theme: "Theme Default",
  small: "Small",
  default: "Default",
  large: "Large",
};
const densityLabels: Record<UiDensityPreference, string> = {
  theme: "Theme Default",
  comfortable: "Comfortable",
  compact: "Compact",
};
const sidebarWidthSliderValues: SidebarWidthPreference[] = [
  "theme",
  ...Array.from(
    { length: Math.floor((sidebarWidthMaxPx - sidebarWidthMinPx) / sidebarWidthStepPx) + 1 },
    (_, index) => sidebarWidthMinPx + index * sidebarWidthStepPx,
  ),
];
const libraryPreviewRows = [
  { title: "Midnight Roast", artist: "The Cups", album: "Night Shift", checked: true },
  { title: "Window Seat", artist: "Cafe Sketch", album: "Soft Light", checked: false },
];

function themeColorSelectValue(preferences: UiPreferences, key: ThemeColorKey): ThemeColorOverrideValue {
  const value = preferences.themeColorOverrides[key];
  return value && themeColorSwatchKeys.includes(value as ThemeColorSwatchKey) ? value : "theme";
}

function setThemeColorOverride(
  preferences: UiPreferences,
  key: ThemeColorKey,
  value: ThemeColorOverrideValue,
): UiPreferences {
  const nextOverrides = { ...preferences.themeColorOverrides };
  if (value === "theme") {
    delete nextOverrides[key];
  } else {
    nextOverrides[key] = value;
  }
  return { ...preferences, themeColorOverrides: nextOverrides };
}

function rgbTripletToHex(value: string): string {
  const channels = value
    .split(/\s+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((channel) => Number.isFinite(channel))
    .slice(0, 3);
  if (channels.length !== 3) {
    return `rgb(${value})`;
  }
  return `#${channels.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function themeColorSwatchOptionLabel(key: ThemeColorSwatchKey): string {
  return `${themeColorSwatchLabels[key]} (${rgbTripletToHex(themeColorSwatchValues[key])})`;
}

function libraryPreviewStyle(
  preferences: UiPreferences,
  themeDefaults: ThemePalette,
): CSSProperties {
  const style: Record<string, string> = {};
  for (const key of themeColorKeys) {
    style[themeColorCssVariables[key]] = resolveThemeColor(themeDefaults, preferences.themeColorOverrides, key);
  }
  const selectedCheckboxAccent =
    preferences.checkboxAccent === "theme" ? themeDefaults.checkboxAccent : preferences.checkboxAccent;
  const selectedCheckboxUnchecked =
    preferences.checkboxUnchecked === "theme" ? themeDefaults.checkboxUnchecked : preferences.checkboxUnchecked;
  style["--checkbox-accent"] = resolveThemeColor(themeDefaults, preferences.themeColorOverrides, selectedCheckboxAccent);
  style["--checkbox-unchecked"] = resolveThemeColor(themeDefaults, preferences.themeColorOverrides, selectedCheckboxUnchecked);
  return style as CSSProperties;
}

function LibraryCustomizationPreview({
  uiPreferences,
  themeDefaults,
}: {
  uiPreferences: UiPreferences;
  themeDefaults: ThemePalette;
}) {
  const density = uiPreferences.density === "theme" ? themeDefaults.density : uiPreferences.density;
  const compact = density === "compact";
  return (
    <div className="grid gap-2 rounded border border-line/70 bg-[rgb(var(--color-quiet))] p-3" style={libraryPreviewStyle(uiPreferences, themeDefaults)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase text-muted">Library Preview</div>
        <div className="rounded border border-line bg-[rgb(var(--color-panel))] px-2 py-1 text-[11px] text-muted">
          {compact ? "Compact" : "Comfortable"}
        </div>
      </div>
      <div className="overflow-hidden rounded border border-line bg-[rgb(var(--color-panel))]">
        <div className="grid grid-cols-[2rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem] border-b border-line bg-[rgb(var(--color-strip))] px-2 py-2 text-[11px] uppercase text-muted">
          <span />
          <span>Title</span>
          <span>Artist</span>
          <span>Album</span>
          <span className="text-right">Rating</span>
        </div>
        {libraryPreviewRows.map((row, index) => (
          <div
            key={row.title}
            className={`grid grid-cols-[2rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem] items-center gap-0 border-b border-line/60 px-2 text-sm last:border-b-0 ${
              index === 0 ? "bg-[rgb(var(--color-hover-panel))]" : "bg-[rgb(var(--color-subtle))]"
            } ${compact ? "h-9" : "h-12"}`}
          >
            <input aria-label={`Select ${row.title}`} checked={row.checked} readOnly tabIndex={-1} type="checkbox" />
            <span className="truncate font-medium text-white">{row.title}</span>
            <span className="truncate text-muted">{row.artist}</span>
            <span className="truncate text-muted">{row.album}</span>
            <span className="text-right text-ember">{index === 0 ? "4.5" : "3.0"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function bulkLyricsStatusText(progress: BulkLyricsProgress) {
  if (progress.status === "completed") {
    const found = progress.embedded_found + progress.online_found + progress.already_cached;
    return `Lyric lookup finished: ${found.toLocaleString()} ready, ${progress.missing.toLocaleString()} missing`;
  }
  if (progress.status === "cancelled") {
    return "Bulk lyric lookup cancelled";
  }
  if (progress.status === "failed") {
    return progress.error ?? "Bulk lyric lookup failed";
  }
  return `Bulk lyric lookup ${Math.round(progress.percent)}%`;
}

export function SettingsPage({
  settings,
  focusSectionId,
  onFocusSectionConsumed,
  backendStatus,
  backendMessage,
  backendCheckedAt,
  startupDiagnostics,
  backendLog,
  onCheckBackend,
  onRunStartupDiagnostics,
  onOpenBackendLog,
  onRestartBackend,
  hideFilePaths,
  setHideFilePaths,
  uiPreferences,
  setUiPreferences,
  currentTrack,
  playbackQueue,
  writeRatingsToFiles,
  onWriteRatingsToFilesChange,
  autoWriteFetchedLyricsSidecars,
  onAutoWriteFetchedLyricsSidecarsChange,
  cdAutoLookupMetadata,
  onCdAutoLookupMetadataChange,
  onAcoustIdApiKeyChange,
  onLastFmApiCredentialsChange,
  setStatus,
  onBackupDatabase,
  onResetLocalData,
  onCreateSupportBundle,
  supportBundlePath,
  onCopySupportBundlePath,
  onOpenSourceFolder,
  onOpenThemeFolder,
  onOpenLyricsFolder,
  onClearArtistCache,
}: {
  settings: SettingsResponse | null;
  focusSectionId?: string | null;
  onFocusSectionConsumed?: () => void;
  backendStatus: BackendStatus;
  backendMessage: string;
  backendCheckedAt: string | null;
  startupDiagnostics: StartupDiagnosticsResponse | null;
  backendLog: LogTailResponse | null;
  onCheckBackend: () => void;
  onRunStartupDiagnostics: () => void;
  onOpenBackendLog: () => void;
  onRestartBackend: () => void;
  hideFilePaths: boolean;
  setHideFilePaths: (value: boolean) => void;
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
  currentTrack: Track | null;
  playbackQueue: Track[];
  writeRatingsToFiles: boolean;
  onWriteRatingsToFilesChange: (value: boolean) => void;
  autoWriteFetchedLyricsSidecars: boolean;
  onAutoWriteFetchedLyricsSidecarsChange: (value: boolean) => void;
  cdAutoLookupMetadata: boolean;
  onCdAutoLookupMetadataChange: (value: boolean) => void;
  onAcoustIdApiKeyChange: (apiKey: string | null) => void | Promise<void>;
  onLastFmApiCredentialsChange: (apiKey: string | null, apiSecret: string | null) => void | Promise<void>;
  setStatus: (message: string) => void;
  onBackupDatabase: () => void;
  onResetLocalData: () => void;
  onCreateSupportBundle: () => void;
  supportBundlePath: string | null;
  onCopySupportBundlePath: () => void;
  onOpenSourceFolder: () => void;
  onOpenThemeFolder: () => void;
  onOpenLyricsFolder: () => void;
  onClearArtistCache: () => void;
}) {
  const [desktopDevices, setDesktopDevices] = useState<desktopAudioDevice[]>([]);
  const [desktopBackends, setDesktopBackends] = useState<desktopOutputBackend[]>([]);
  const [desktopDeviceMessage, setDesktopDeviceMessage] = useState<string | null>(null);
  const [PlaybackDiagnostics, setPlaybackDiagnostics] = useState<PlaybackDiagnosticsResponse | null>(null);
  const [desktopDiagnosticsMessage, setDesktopDiagnosticsMessage] = useState<string | null>(null);
  const [settingsSearch, setSettingsSearch] = useState("");
  const [openSettingsSection, setOpenSettingsSection] = useState<string | null>(null);
  const [acoustIdApiKeyDraft, setAcoustIdApiKeyDraft] = useState("");
  const [isSavingAcoustIdKey, setIsSavingAcoustIdKey] = useState(false);
  const [lastFmApiKeyDraft, setLastFmApiKeyDraft] = useState("");
  const [lastFmApiSecretDraft, setLastFmApiSecretDraft] = useState("");
  const [isSavingLastFmCredentials, setIsSavingLastFmCredentials] = useState(false);
  const [bulkLyricsOnlyMissing, setBulkLyricsOnlyMissing] = useState(true);
  const [bulkLyricsLimit, setBulkLyricsLimit] = useState("5000");
  const [bulkLyricsSaveLocation, setBulkLyricsSaveLocation] = useState<BulkLyricsSaveLocation>("sidecar");
  const [bulkLyricsProgress, setBulkLyricsProgress] = useState<BulkLyricsProgress | null>(null);
  const [isStartingBulkLyrics, setIsStartingBulkLyrics] = useState(false);
  const [rememberedDeleteChoice, setRememberedDeleteChoice] = useState<RememberedDeleteChoice | "ask">(
    () => readRememberedDeleteChoice() ?? "ask",
  );
  const settingsQuery = settingsSearch.trim().toLowerCase();
  const themeDefaults = themeAccentValues[uiPreferences.themeAccent] ?? themeAccentValues.cafe;
  const explicitSidebarWidth =
    uiPreferences.sidebarWidthPx === "theme"
      ? sidebarWidthDefaultPx
      : Math.min(sidebarWidthMaxPx, Math.max(sidebarWidthMinPx, uiPreferences.sidebarWidthPx));
  const sidebarWidthSliderValue =
    uiPreferences.sidebarWidthPx === "theme"
      ? 0
      : Math.max(1, sidebarWidthSliderValues.indexOf(explicitSidebarWidth));
  const sidebarWidthLabel =
    uiPreferences.sidebarWidthPx === "theme"
      ? `Theme Default (${themeDefaults.sidebarWidthPx}px)`
      : `${uiPreferences.sidebarWidthPx}px`;
  const showSettingsSection = (...keywords: string[]) =>
    !settingsQuery || keywords.join(" ").toLowerCase().includes(settingsQuery);
  const visibleSettingsGroups = [
    showSettingsSection("library preferences display ratings stars numbers metadata startup theme font density sidebar width position alignment checkbox color colors roles preview checked unchecked accent podcasts file paths delete recycle remember"),
    showSettingsSection("api keys online metadata lastfm last.fm scrobbling acoustid acoustic fingerprint musicbrainz lookup autotag"),
    showSettingsSection("keyboard shortcuts hotkeys local playback controls media keys"),
    showSettingsSection("player playback audio output mini player mini-player detached opacity layout window queue lyrics lyric bulk lookup preload autofetch lrc sidecar cache follow equalizer replaygain fade skip codec rust"),
    showSettingsSection("maintenance backend diagnostics database support bundle source folder logs cache reset local data"),
    showSettingsSection("extensions skins plugins themes manifest customization"),
  ].filter(Boolean).length;
  const backendStatusClass =
    backendStatus === "ok"
      ? "border-moss/40 bg-moss/10 text-moss"
      : backendStatus === "down"
        ? "border-red-400/40 bg-red-500/10 text-red-300"
        : "border-line bg-ink text-muted";

  function updateRememberedDeleteChoice(choice: RememberedDeleteChoice | "ask") {
    setRememberedDeleteChoice(choice);
    if (choice === "ask") {
      clearRememberedDeleteChoice();
      setStatus("Delete actions will ask each time.");
      return;
    }
    writeRememberedDeleteChoice(choice);
    setStatus(
      choice === "file"
        ? "Delete actions will remember file deletion."
        : "Delete actions will remember library-only removal.",
    );
  }

  useEffect(() => {
    void refreshDesktopDevices();
    void refreshDesktopBackends();
    void refreshPlaybackDiagnostics();
  }, []);

  useEffect(() => {
    if (!bulkLyricsProgress || !["pending", "scanning", "cancelling"].includes(bulkLyricsProgress.status)) {
      return;
    }
    const handle = window.setTimeout(() => {
      void refreshBulkLyricsProgress(bulkLyricsProgress.job_id, true);
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [bulkLyricsProgress]);

  useEffect(() => {
    if (!focusSectionId) {
      return;
    }
    setSettingsSearch("");
    setOpenSettingsSection(focusSectionId);
    onFocusSectionConsumed?.();
  }, [focusSectionId, onFocusSectionConsumed]);

  async function refreshDesktopBackends() {
    try {
      setDesktopBackends(await desktopOutputBackends());
    } catch {
      setDesktopBackends([
        {
          id: "cpalShared",
          label: "CPAL shared",
          available: false,
          exclusive: false,
          message: "Rust audio backend information is only available in the desktop app.",
        },
      ]);
    }
  }

  async function refreshDesktopDevices() {
    try {
      const devices = await desktopListOutputDevices();
      setDesktopDevices(devices);
      setDesktopDeviceMessage(devices.length ? null : "No Rust output devices reported.");
    } catch {
      setDesktopDevices([]);
      setDesktopDeviceMessage("Rust output devices are only available in the desktop app.");
    }
  }

  async function refreshPlaybackDiagnostics() {
    try {
      const response = await desktopDiagnostics();
      setPlaybackDiagnostics(response);
      setDesktopDiagnosticsMessage(null);
    } catch {
      setPlaybackDiagnostics(null);
      setDesktopDiagnosticsMessage("Rust playback diagnostics are only available in the desktop app.");
    }
  }

  async function clearPlaybackDiagnostics() {
    try {
      const response = await desktopClearDiagnostics();
      setPlaybackDiagnostics(response);
      setDesktopDiagnosticsMessage("Rust playback diagnostics cleared.");
    } catch {
      setDesktopDiagnosticsMessage("Could not clear Rust playback diagnostics in this environment.");
    }
  }

  function bulkLyricsLimitValue() {
    const parsed = Number.parseInt(bulkLyricsLimit, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  async function refreshBulkLyricsProgress(jobId: string, announce = false) {
    try {
      const progress = await fetchBulkLyricsLookupProgress(jobId);
      setBulkLyricsProgress(progress);
      if (announce && ["completed", "cancelled", "failed"].includes(progress.status)) {
        setStatus(bulkLyricsStatusText(progress));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh lyric lookup progress");
    }
  }

  async function startBulkLyrics() {
    setIsStartingBulkLyrics(true);
    try {
      const response = await startBulkLyricsLookup(
        true,
        bulkLyricsOnlyMissing,
        bulkLyricsLimitValue(),
        bulkLyricsSaveLocation,
      );
      const progress = await fetchBulkLyricsLookupProgress(response.job_id);
      setBulkLyricsProgress(progress);
      setStatus("Bulk lyric lookup started");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start bulk lyric lookup");
    } finally {
      setIsStartingBulkLyrics(false);
    }
  }

  async function cancelBulkLyrics() {
    if (!bulkLyricsProgress) {
      return;
    }
    try {
      const progress = await cancelBulkLyricsLookup(bulkLyricsProgress.job_id);
      setBulkLyricsProgress(progress);
      setStatus("Canceling bulk lyric lookup");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not cancel bulk lyric lookup");
    }
  }

  async function saveAcoustIdApiKey() {
    const key = acoustIdApiKeyDraft.trim();
    if (!key) {
      return;
    }
    setIsSavingAcoustIdKey(true);
    try {
      await onAcoustIdApiKeyChange(key);
      setAcoustIdApiKeyDraft("");
    } finally {
      setIsSavingAcoustIdKey(false);
    }
  }

  async function clearAcoustIdApiKey() {
    setIsSavingAcoustIdKey(true);
    try {
      await onAcoustIdApiKeyChange(null);
      setAcoustIdApiKeyDraft("");
    } finally {
      setIsSavingAcoustIdKey(false);
    }
  }

  async function saveLastFmCredentials() {
    const apiKey = lastFmApiKeyDraft.trim();
    const apiSecret = lastFmApiSecretDraft.trim();
    if (!apiKey || !apiSecret) {
      return;
    }
    setIsSavingLastFmCredentials(true);
    try {
      await onLastFmApiCredentialsChange(apiKey, apiSecret);
      setLastFmApiKeyDraft("");
      setLastFmApiSecretDraft("");
    } finally {
      setIsSavingLastFmCredentials(false);
    }
  }

  async function clearLastFmCredentials() {
    setIsSavingLastFmCredentials(true);
    try {
      await onLastFmApiCredentialsChange(null, null);
      setLastFmApiKeyDraft("");
      setLastFmApiSecretDraft("");
    } finally {
      setIsSavingLastFmCredentials(false);
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Settings</h1>
          <p className="text-xs text-muted">{settings?.database_path ?? "Database path loading"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded border px-2 py-1 text-xs uppercase ${backendStatusClass}`}>
            backend {backendStatus}
          </span>
          {startupDiagnostics && (
            <span
              className={`rounded border px-2 py-1 text-xs uppercase ${
                startupDiagnostics.ok ? "border-moss/40 bg-moss/10 text-moss" : "border-yellow-400/40 bg-yellow-400/10 text-yellow-100"
              }`}
            >
              self-check {startupDiagnostics.ok ? "ok" : "review"}
            </span>
          )}
        </div>
      </header>
      <section className="min-h-0 flex-1 overflow-auto p-6">
        <DisclosureAccordionProvider
          openSectionId={openSettingsSection}
          onOpenSectionChange={setOpenSettingsSection}
        >
        <div className="grid max-w-3xl gap-5">
          <label className="grid gap-2 text-sm text-neutral-200">
            <span className="text-xs uppercase text-muted">Search Settings</span>
            <div className="flex h-10 items-center gap-2 rounded border border-line bg-panel px-3 ring-moss/40 focus-within:ring-2">
              <Search size={16} className="shrink-0 text-muted" />
              <input
                className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-muted"
                value={settingsSearch}
                placeholder="Find playback, lyrics, themes, shortcuts, maintenance..."
                onChange={(event) => setSettingsSearch(event.target.value)}
              />
              {settingsSearch && (
                <button
                  className="icon-button h-7 w-7 shrink-0"
                  type="button"
                  title="Clear settings search"
                  onClick={() => setSettingsSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </label>

          {visibleSettingsGroups === 0 && (
            <div className="rounded border border-dashed border-line bg-panel px-4 py-8 text-center text-sm text-muted">
              No settings match that search.
            </div>
          )}

          {showSettingsSection("library preferences display ratings metadata startup theme font density sidebar width position alignment checkbox color colors roles preview checked unchecked accent podcasts file paths delete recycle remember") && (
          <DisclosureSection title="Library Preferences" description="Display, rating storage, and startup behavior">
            <div className="grid gap-3 text-sm text-neutral-200">
              <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <EyeOff className="shrink-0 text-muted" size={18} />
                  <div className="min-w-0">
                    <div className="font-medium text-white">Hide file paths in track lists</div>
                    <div className="text-xs text-muted">Keeps the library view focused on music metadata.</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-moss"
                  checked={hideFilePaths}
                  onChange={(event) => setHideFilePaths(event.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Podcast className="shrink-0 text-muted" size={18} />
                  <div className="min-w-0">
                    <div className="font-medium text-white">Hide podcast file paths</div>
                    <div className="text-xs text-muted">Keeps downloaded episode paths out of the Podcasts page.</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-moss"
                  checked={!uiPreferences.showPodcastFilePaths}
                  onChange={(event) =>
                    setUiPreferences((current) => ({ ...current, showPodcastFilePaths: !event.target.checked }))
                  }
                />
              </label>

              <div className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Disc3 className="shrink-0 text-muted" size={18} />
                  <div className="min-w-0">
                    <div className="font-medium text-white">CD sidebar tab</div>
                    <div className="text-xs text-muted">Controls when CD playback and ripping appears in the sidebar.</div>
                  </div>
                </div>
                <select
                  className="h-9 shrink-0 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 focus:ring-2"
                  value={uiPreferences.cdSidebarMode}
                  onChange={(event) =>
                    setUiPreferences((current) => ({
                      ...current,
                      cdSidebarMode: event.target.value as UiPreferences["cdSidebarMode"],
                    }))
                  }
                >
                  <option value="never">Never</option>
                  <option value="drive">When CD drive is detected</option>
                  <option value="always">Always</option>
                </select>
              </div>

              <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Search className="shrink-0 text-muted" size={18} />
                  <div className="min-w-0">
                    <div className="font-medium text-white">Auto-look up CD metadata</div>
                    <div className="text-xs text-muted">Automatically queries MusicBrainz when a CD drive with media is detected.</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-moss"
                  checked={cdAutoLookupMetadata}
                  onChange={(event) => onCdAutoLookupMetadataChange(event.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Star className="shrink-0 text-ember" size={18} />
                  <div className="min-w-0">
                    <div className="font-medium text-white">Write ratings and metadata to audio files</div>
                    <div className="text-xs text-muted">
                      When enabled, FLAC Cafe writes tags for files it can safely update. Otherwise edits stay in SQLite.
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-ember"
                  checked={writeRatingsToFiles}
                  onChange={(event) => onWriteRatingsToFilesChange(event.target.checked)}
                />
              </label>

              <div className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">Remembered delete action</div>
                  <div className="text-xs text-muted">
                    File deletes are sent to the Windows Recycle Bin when possible.
                  </div>
                </div>
                <select
                  className="h-9 shrink-0 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 focus:ring-2"
                  value={rememberedDeleteChoice}
                  onChange={(event) =>
                    updateRememberedDeleteChoice(event.target.value as RememberedDeleteChoice | "ask")
                  }
                >
                  <option value="ask">Ask each time</option>
                  <option value="library">Remove from library only</option>
                  <option value="file">Delete file too</option>
                </select>
              </div>

              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div className="font-medium text-white">Library layout</div>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-muted">Album cover grid</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={uiPreferences.albumGrid}
                    onChange={(event) =>
                      setUiPreferences((current) => ({ ...current, albumGrid: event.target.checked }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Startup Page</span>
                  <select
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={uiPreferences.startupPage}
                    onChange={(event) =>
                      setUiPreferences((current) => ({ ...current, startupPage: event.target.value as Page }))
                    }
                  >
                    <option value="library">Library</option>
                    <option value="analysis">Analysis</option>
                    <option value="nowPlaying">Now Playing</option>
                    <option value="artist">Artist</option>
                    <option value="cd">CD</option>
                    <option value="history">History</option>
                    <option value="autodj">AutoDJ</option>
                    <option value="settings">Settings</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div className="font-medium text-white">Library Customization</div>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Accent</span>
                  <select
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={uiPreferences.themeAccent}
                    onChange={(event) =>
                      setUiPreferences((current) => ({ ...current, themeAccent: event.target.value as ThemeAccent }))
                    }
                  >
                    {themeOrder.map((theme) => (
                      <option key={theme} value={theme}>
                        {themeAccentLabels[theme]}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="secondary-button w-fit" type="button" onClick={onOpenThemeFolder}>
                  <FolderOpen size={15} />
                  Show Theme Folder
                </button>
                <LibraryCustomizationPreview uiPreferences={uiPreferences} themeDefaults={themeDefaults} />
                <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Star className="shrink-0 text-ember" size={18} />
                    <div className="min-w-0">
                      <div className="font-medium text-white">Display ratings as numbers</div>
                      <div className="text-xs text-muted">Shows ratings as 4.5 instead of star icons in the library and player.</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-ember"
                    checked={uiPreferences.displayRatingsAsNumbers}
                    onChange={(event) =>
                      setUiPreferences((current) => ({ ...current, displayRatingsAsNumbers: event.target.checked }))
                    }
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Checkbox Color</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.checkboxAccent}
                      onChange={(event) =>
                        setUiPreferences((current) => ({ ...current, checkboxAccent: event.target.value as CheckboxAccentPreference }))
                      }
                    >
                      {Object.entries(checkboxAccentLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Unchecked Checkbox</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.checkboxUnchecked}
                      onChange={(event) =>
                        setUiPreferences((current) => ({ ...current, checkboxUnchecked: event.target.value as CheckboxUncheckedPreference }))
                      }
                    >
                      {Object.entries(checkboxUncheckedLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Density</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.density}
                      onChange={(event) => {
                        const density = event.target.value as UiDensityPreference;
                        setUiPreferences((current) => ({
                          ...current,
                          density,
                          compactLibraryRows:
                            density === "theme" ? themeDefaults.density === "compact" : density === "compact",
                        }));
                      }}
                    >
                      <option value="theme">Theme Default ({densityLabels[themeDefaults.density]})</option>
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Sidebar Width</span>
                    <div className="rounded border border-line bg-panel px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted">Width</span>
                        <span className="font-medium text-white">{sidebarWidthLabel}</span>
                      </div>
                      <input
                        className="theme-slider"
                        type="range"
                        min={0}
                        max={sidebarWidthSliderValues.length - 1}
                        step={1}
                        value={sidebarWidthSliderValue}
                        aria-label="Sidebar width"
                        style={{
                          "--theme-slider-fill": `${(sidebarWidthSliderValue / (sidebarWidthSliderValues.length - 1)) * 100}%`,
                        } as CSSProperties}
                        onChange={(event) => {
                          const sidebarWidthPx = sidebarWidthSliderValues[Number(event.target.value)] ?? "theme";
                          setUiPreferences((current) => ({ ...current, sidebarWidthPx }));
                        }}
                      />
                      <div className="mt-1 flex justify-between text-[11px] text-muted">
                        <span>Theme</span>
                        <span>{sidebarWidthMinPx}px</span>
                        <span>{sidebarWidthMaxPx}px</span>
                      </div>
                    </div>
                  </label>
                  <label className="grid content-start gap-2 self-start">
                    <span className="text-xs uppercase text-muted">Sidebar Position</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.sidebarPlacement}
                      onChange={(event) =>
                        setUiPreferences((current) => ({ ...current, sidebarPlacement: event.target.value as SidebarPlacement }))
                      }
                    >
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Font</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.fontChoice}
                      onChange={(event) => {
                        setUiPreferences((current) => ({ ...current, fontChoice: event.target.value as FontChoice }))
                      }}
                    >
                      {Object.entries(fontChoiceLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Font Size</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.fontScale}
                      onChange={(event) =>
                        setUiPreferences((current) => ({ ...current, fontScale: event.target.value as FontScalePreference }))
                      }
                    >
                      {Object.entries(fontScaleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 rounded border border-line/70 bg-panel p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium text-white">Color Roles</div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setUiPreferences((current) => ({ ...current, themeColorOverrides: {} }))}
                    >
                      <RotateCcw size={14} />
                      Reset Colors
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
                    {themeColorKeys.map((colorKey) => {
                      const currentValue = themeColorSelectValue(uiPreferences, colorKey);
                      const previewColor = resolveThemeColor(themeDefaults, uiPreferences.themeColorOverrides, colorKey);
                      return (
                        <label key={colorKey} className="grid min-w-0 gap-2">
                          <span className="flex items-center justify-between gap-3 text-xs uppercase text-muted">
                            <span>{themeColorLabels[colorKey]}</span>
                            <span
                              className="h-4 w-4 rounded border border-white/20"
                              style={{ backgroundColor: `rgb(${previewColor})` }}
                            />
                          </span>
                          <select
                            className="h-9 w-full min-w-0 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                            value={currentValue}
                            onChange={(event) =>
                              setUiPreferences((current) =>
                                setThemeColorOverride(
                                  current,
                                  colorKey,
                                  event.target.value as ThemeColorOverrideValue,
                                ),
                              )
                            }
                          >
                            <option value="theme">Theme Default ({rgbTripletToHex(themeDefaults[colorKey])})</option>
                            {themeColorSwatchKeys.map((optionKey) => (
                              <option key={optionKey} value={optionKey}>
                                {themeColorSwatchOptionLabel(optionKey)}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </DisclosureSection>
          )}

          {showSettingsSection("api keys online metadata lastfm last.fm scrobbling acoustid acoustic fingerprint musicbrainz lookup autotag") && (
          <DisclosureSection accordionId="apiKeys" title="API Keys" description="Bring-your-own keys for online metadata and scrobbling">
            <div className="grid gap-3 text-sm text-neutral-200">
              <div className="rounded border border-line/70 bg-ink p-3">
                <div className="flex items-start gap-3">
                  <Fingerprint className="mt-0.5 shrink-0 text-muted" size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white">AcoustID client API key</div>
                    <div className="text-xs text-muted">
                      Optional. When configured, Individual Track Auto-Tag can identify songs from Chromaprint fingerprints before using text search.
                    </div>
                    <button
                      className="mt-2 inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                      type="button"
                      onClick={() => void openExternalUrl(ACOUSTID_API_KEY_URL, setStatus)}
                    >
                      Get an AcoustID key
                      <ExternalLink size={12} />
                    </button>
                    <div className={`mt-2 text-xs ${settings?.acoustid_api_key_configured ? "text-moss" : "text-muted"}`}>
                      {settings?.acoustid_api_key_configured ? "AcoustID lookup is configured." : "No AcoustID key saved."}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    type="password"
                    value={acoustIdApiKeyDraft}
                    placeholder={settings?.acoustid_api_key_configured ? "Paste a new key to replace the saved one" : "Paste AcoustID client API key"}
                    onChange={(event) => setAcoustIdApiKeyDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void saveAcoustIdApiKey();
                      }
                    }}
                  />
                  <button
                    className="secondary-button h-9"
                    type="button"
                    disabled={!acoustIdApiKeyDraft.trim() || isSavingAcoustIdKey}
                    onClick={() => void saveAcoustIdApiKey()}
                  >
                    Save Key
                  </button>
                  <button
                    className="secondary-button h-9"
                    type="button"
                    disabled={!settings?.acoustid_api_key_configured || isSavingAcoustIdKey}
                    onClick={() => void clearAcoustIdApiKey()}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="rounded border border-line/70 bg-ink p-3">
                <div className="flex items-start gap-3">
                  <KeyRound className="mt-0.5 shrink-0 text-muted" size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white">Last.fm API key and shared secret</div>
                    <div className="text-xs text-muted">
                      Optional. Last.fm browser login and scrobbling need your own API account credentials.
                    </div>
                    <button
                      className="mt-2 inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                      type="button"
                      onClick={() => void openExternalUrl(LASTFM_API_URL, setStatus)}
                    >
                      Open Last.fm API page
                      <ExternalLink size={12} />
                    </button>
                    <div className={`mt-2 text-xs ${settings?.lastfm_api_credentials_configured ? "text-moss" : "text-muted"}`}>
                      {settings?.lastfm_api_credentials_configured
                        ? `Last.fm credentials configured${settings.lastfm_api_credentials_source ? ` (${settings.lastfm_api_credentials_source})` : ""}.`
                        : "No Last.fm API credentials saved."}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={lastFmApiKeyDraft}
                    placeholder={settings?.lastfm_api_credentials_configured ? "Paste a new Last.fm API key" : "Last.fm API key"}
                    onChange={(event) => setLastFmApiKeyDraft(event.target.value)}
                  />
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    type="password"
                    value={lastFmApiSecretDraft}
                    placeholder={settings?.lastfm_api_credentials_configured ? "Paste a new shared secret" : "Last.fm shared secret"}
                    onChange={(event) => setLastFmApiSecretDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void saveLastFmCredentials();
                      }
                    }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="secondary-button h-9"
                    type="button"
                    disabled={!lastFmApiKeyDraft.trim() || !lastFmApiSecretDraft.trim() || isSavingLastFmCredentials}
                    onClick={() => void saveLastFmCredentials()}
                  >
                    Save Last.fm Keys
                  </button>
                  <button
                    className="secondary-button h-9"
                    type="button"
                    disabled={!settings?.lastfm_api_credentials_configured || isSavingLastFmCredentials}
                    onClick={() => void clearLastFmCredentials()}
                  >
                    Clear Saved
                  </button>
                </div>
              </div>
            </div>
          </DisclosureSection>
          )}

          {showSettingsSection("keyboard shortcuts hotkeys local playback controls media keys") && (
          <KeyboardShortcutsSection
            uiPreferences={uiPreferences}
            setUiPreferences={setUiPreferences}
          />
          )}

          {showSettingsSection("player playback audio output mini player mini-player detached opacity layout window queue lyrics lyric bulk lookup preload autofetch lrc sidecar cache follow equalizer replaygain fade skip codec rust") && (
          <PlayerSettingsSection
            uiPreferences={uiPreferences}
            setUiPreferences={setUiPreferences}
            desktopBackends={desktopBackends}
            desktopDevices={desktopDevices}
            desktopDeviceMessage={desktopDeviceMessage}
            onRefreshDesktopDevices={refreshDesktopDevices}
            desktopDiagnostics={PlaybackDiagnostics}
            desktopDiagnosticsMessage={desktopDiagnosticsMessage}
            onRefreshDesktopDiagnostics={refreshPlaybackDiagnostics}
            onClearDesktopDiagnostics={clearPlaybackDiagnostics}
            currentTrack={currentTrack}
            playbackQueue={playbackQueue}
            autoWriteFetchedLyricsSidecars={autoWriteFetchedLyricsSidecars}
            onAutoWriteFetchedLyricsSidecarsChange={onAutoWriteFetchedLyricsSidecarsChange}
            bulkLyricsProgress={bulkLyricsProgress}
            bulkLyricsOnlyMissing={bulkLyricsOnlyMissing}
            bulkLyricsLimit={bulkLyricsLimit}
            bulkLyricsSaveLocation={bulkLyricsSaveLocation}
            isStartingBulkLyrics={isStartingBulkLyrics}
            onOpenLyricsFolder={onOpenLyricsFolder}
            onBulkLyricsOnlyMissingChange={setBulkLyricsOnlyMissing}
            onBulkLyricsLimitChange={setBulkLyricsLimit}
            onBulkLyricsSaveLocationChange={setBulkLyricsSaveLocation}
            onStartBulkLyrics={() => void startBulkLyrics()}
            onCancelBulkLyrics={() => void cancelBulkLyrics()}
          />
          )}

          {showSettingsSection("maintenance backend diagnostics database support bundle source folder logs cache reset local data") && (
          <MaintenanceSection
            backendStatus={backendStatus}
            backendStatusClass={backendStatusClass}
            backendMessage={backendMessage}
            backendCheckedAt={backendCheckedAt}
            startupDiagnostics={startupDiagnostics}
            backendLog={backendLog}
            uiPreferences={uiPreferences}
            setUiPreferences={setUiPreferences}
            onCheckBackend={onCheckBackend}
            onRunStartupDiagnostics={onRunStartupDiagnostics}
            onOpenBackendLog={onOpenBackendLog}
            onRestartBackend={onRestartBackend}
            onOpenSourceFolder={onOpenSourceFolder}
            onBackupDatabase={onBackupDatabase}
            onResetLocalData={onResetLocalData}
            onCreateSupportBundle={onCreateSupportBundle}
            supportBundlePath={supportBundlePath}
            onCopySupportBundlePath={onCopySupportBundlePath}
            onClearArtistCache={onClearArtistCache}
          />
          )}

          {showSettingsSection("extensions skins plugins themes manifest customization") && <ExtensionsSection />}
        </div>
        </DisclosureAccordionProvider>
      </section>
    </main>
  );
}
