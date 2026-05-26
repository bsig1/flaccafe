import {
  useEffect,
  useState,
} from "react";

import {
  Disc3,
  EyeOff,
  ExternalLink,
  Fingerprint,
  FolderOpen,
  KeyRound,
  Podcast,
  Search,
  Star,
  X,
} from "lucide-react";

import type {
  FontChoice,
  ThemeAccent,
} from "../../config/theme";
import {
  fontChoiceLabels,
  themeAccentLabels,
  themeOrder,
} from "../../config/theme";
import {
  desktopClearDiagnostics,
  desktopDiagnostics,
  desktopListOutputDevices,
  desktopOutputBackends,
} from "../../lib/desktopPlayback";
import type {
  desktopAudioDevice,
  desktopOutputBackend,
  PlaybackDiagnosticsResponse,
} from "../../lib/desktopPlayback";
import type {
  LogTailResponse,
  SettingsResponse,
  StartupDiagnosticsResponse,
} from "../../types/api";
import {
  openExternalUrl,
} from "../../lib/externalLinks";
import {
  DisclosureAccordionProvider,
  DisclosureSection,
} from "../components/common";
import {
  BackendStatus,
  FontScale,
  Page,
  RememberedDeleteChoice,
  UiDensity,
  UiPreferences,
  clearRememberedDeleteChoice,
  readRememberedDeleteChoice,
  writeRememberedDeleteChoice,
} from "../shared";
import { KeyboardShortcutsSection } from "./settings/KeyboardShortcutsSection";
import { ExtensionsSection } from "./settings/ExtensionsSection";
import { MaintenanceSection } from "./settings/MaintenanceSection";
import {
  PlayerSettingsSection,
  detectCodecSupport,
} from "./settings/PlayerSettingsSection";

const LASTFM_API_URL = "https://www.last.fm/api";
const ACOUSTID_API_KEY_URL = "https://acoustid.org/api-key";

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
  onClearArtistCache: () => void;
}) {
  const [codecSupport, setCodecSupport] = useState(detectCodecSupport);
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
  const [rememberedDeleteChoice, setRememberedDeleteChoice] = useState<RememberedDeleteChoice | "ask">(
    () => readRememberedDeleteChoice() ?? "ask",
  );
  const settingsQuery = settingsSearch.trim().toLowerCase();
  const showSettingsSection = (...keywords: string[]) =>
    !settingsQuery || keywords.join(" ").toLowerCase().includes(settingsQuery);
  const visibleSettingsGroups = [
    showSettingsSection("library preferences display ratings metadata startup theme font density podcasts file paths delete recycle remember"),
    showSettingsSection("api keys online metadata lastfm last.fm scrobbling acoustid acoustic fingerprint musicbrainz lookup autotag"),
    showSettingsSection("keyboard shortcuts hotkeys local playback controls media keys"),
    showSettingsSection("player playback audio output lyrics autofetch lrc sidecar cache follow equalizer replaygain fade skip codec rust webview"),
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
          label: "CPAL / WASAPI shared",
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

          {showSettingsSection("library preferences display ratings metadata startup theme font density podcasts file paths delete recycle remember") && (
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
                <div className="font-medium text-white">Theme</div>
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Density</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.density}
                      onChange={(event) => {
                        const density = event.target.value as UiDensity;
                        setUiPreferences((current) => ({
                          ...current,
                          density,
                          compactLibraryRows: density === "compact",
                        }));
                      }}
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Font</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.fontChoice}
                      onChange={(event) =>
                        setUiPreferences((current) => ({ ...current, fontChoice: event.target.value as FontChoice }))
                      }
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
                        setUiPreferences((current) => ({ ...current, fontScale: event.target.value as FontScale }))
                      }
                    >
                      <option value="small">Small</option>
                      <option value="default">Default</option>
                      <option value="large">Large</option>
                    </select>
                  </label>
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

          {showSettingsSection("player playback audio output lyrics autofetch lrc sidecar cache follow equalizer replaygain fade skip codec rust webview") && (
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
            codecSupport={codecSupport}
            onRefreshCodecSupport={() => setCodecSupport(detectCodecSupport())}
            autoWriteFetchedLyricsSidecars={autoWriteFetchedLyricsSidecars}
            onAutoWriteFetchedLyricsSidecarsChange={onAutoWriteFetchedLyricsSidecarsChange}
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
