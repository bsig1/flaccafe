import {
  useEffect,
  useState,
} from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  CheckCircle2,
  Download,
  EyeOff,
  FileText,
  FolderOpen,
  Info,
  Keyboard,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Star,
  Wand2,
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
  nativeListOutputDevices,
} from "../../lib/nativePlayback";
import type {
  NativeAudioDevice,
} from "../../lib/nativePlayback";
import type {
  AudioAnalysisProgress,
  ClapStatusResponse,
  LogTailResponse,
  ScanProgress,
  ScanResult,
  SettingsResponse,
  StartupDiagnosticsResponse,
} from "../../types/api";
import {
  DisclosureSection,
  NumberField,
} from "../components/common";
import {
  BackendStatus,
  FontScale,
  KeyboardShortcutAction,
  Page,
  UiDensity,
  UiPreferences,
  defaultKeyboardShortcuts,
  fileName,
  formatShortcut,
  formatTime,
  keyboardShortcutGroups,
  keyboardShortcutLabels,
  normalizeKeyboardShortcuts,
  shortcutConflictGroups,
  shortcutFromEvent,
  writeMiniPlayerAlwaysOnTop,
  writeMiniPlayerSize,
} from "../shared";

const CODEC_TESTS = [
  { label: "MP3", type: "audio/mpeg" },
  { label: "FLAC", type: "audio/flac" },
  { label: "M4A / AAC", type: "audio/mp4; codecs=\"mp4a.40.2\"" },
  { label: "Ogg Vorbis", type: "audio/ogg; codecs=\"vorbis\"" },
  { label: "Opus", type: "audio/ogg; codecs=\"opus\"" },
  { label: "WAV", type: "audio/wav" },
  { label: "AIFF", type: "audio/aiff" },
];

const NATIVE_BUFFER_OPTIONS = [
  { value: 0, label: "Device default" },
  { value: 512, label: "Low latency 512" },
  { value: 1024, label: "Balanced 1024" },
  { value: 2048, label: "Stable 2048" },
  { value: 4096, label: "Very stable 4096" },
];

interface CodecSupportRow {
  label: string;
  type: string;
  support: CanPlayTypeResult | "no";
}

function detectCodecSupport(): CodecSupportRow[] {
  if (typeof document === "undefined") {
    return [];
  }
  const audio = document.createElement("audio");
  return CODEC_TESTS.map((codec) => ({
    ...codec,
    support: audio.canPlayType(codec.type) || "no",
  }));
}

export function SettingsPage({
  settings,
  folderPath,
  setFolderPath,
  onBrowse,
  onScan,
  scanResult,
  scanProgress,
  isScanning,
  backendStatus,
  backendMessage,
  backendCheckedAt,
  startupDiagnostics,
  backendLog,
  onCheckBackend,
  onRunStartupDiagnostics,
  onOpenBackendLog,
  onRestartBackend,
  clapStatus,
  clapModelId,
  setClapModelId,
  clapCacheDir,
  setClapCacheDir,
  clapMaxDuration,
  setClapMaxDuration,
  audioAnalysisProgress,
  audioAnalysisLimit,
  setAudioAnalysisLimit,
  audioAnalysisOverwrite,
  setAudioAnalysisOverwrite,
  audioAnalysisOnlyMissing,
  setAudioAnalysisOnlyMissing,
  isAudioAnalyzing,
  onSaveClapConfig,
  onRefreshClapStatus,
  onAnalyzeAudio,
  hideFilePaths,
  setHideFilePaths,
  uiPreferences,
  setUiPreferences,
  writeRatingsToFiles,
  onWriteRatingsToFilesChange,
  onBackupDatabase,
  onCreateSupportBundle,
  supportBundlePath,
  onCopySupportBundlePath,
  onOpenSourceFolder,
  onOpenThemeFolder,
  onClearArtistCache,
}: {
  settings: SettingsResponse | null;
  folderPath: string;
  setFolderPath: (value: string) => void;
  onBrowse: () => void;
  onScan: () => void;
  scanResult: ScanResult | null;
  scanProgress: ScanProgress | null;
  isScanning: boolean;
  backendStatus: BackendStatus;
  backendMessage: string;
  backendCheckedAt: string | null;
  startupDiagnostics: StartupDiagnosticsResponse | null;
  backendLog: LogTailResponse | null;
  onCheckBackend: () => void;
  onRunStartupDiagnostics: () => void;
  onOpenBackendLog: () => void;
  onRestartBackend: () => void;
  clapStatus: ClapStatusResponse | null;
  clapModelId: string;
  setClapModelId: (value: string) => void;
  clapCacheDir: string;
  setClapCacheDir: (value: string) => void;
  clapMaxDuration: number;
  setClapMaxDuration: (value: number) => void;
  audioAnalysisProgress: AudioAnalysisProgress | null;
  audioAnalysisLimit: number;
  setAudioAnalysisLimit: (value: number) => void;
  audioAnalysisOverwrite: boolean;
  setAudioAnalysisOverwrite: (value: boolean) => void;
  audioAnalysisOnlyMissing: boolean;
  setAudioAnalysisOnlyMissing: (value: boolean) => void;
  isAudioAnalyzing: boolean;
  onSaveClapConfig: () => void;
  onRefreshClapStatus: () => void;
  onAnalyzeAudio: () => void;
  hideFilePaths: boolean;
  setHideFilePaths: (value: boolean) => void;
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
  writeRatingsToFiles: boolean;
  onWriteRatingsToFilesChange: (value: boolean) => void;
  onBackupDatabase: () => void;
  onCreateSupportBundle: () => void;
  supportBundlePath: string | null;
  onCopySupportBundlePath: () => void;
  onOpenSourceFolder: () => void;
  onOpenThemeFolder: () => void;
  onClearArtistCache: () => void;
}) {
  const [shortcutCaptureAction, setShortcutCaptureAction] = useState<KeyboardShortcutAction | null>(null);
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null);
  const [shortcutPresetJson, setShortcutPresetJson] = useState("");
  const [codecSupport, setCodecSupport] = useState(detectCodecSupport);
  const [nativeDevices, setNativeDevices] = useState<NativeAudioDevice[]>([]);
  const [nativeDeviceMessage, setNativeDeviceMessage] = useState<string | null>(null);
  const shortcutConflicts = shortcutConflictGroups(uiPreferences.keyboardShortcuts);
  const progressPercent = Math.max(0, Math.min(100, scanProgress?.percent ?? 0));
  const hasCount = Boolean(scanProgress && scanProgress.total_files > 0);
  const audioProgressPercent = Math.max(0, Math.min(100, audioAnalysisProgress?.percent ?? 0));
  const clapReady = Boolean(clapStatus?.installed);
  const backendStatusClass =
    backendStatus === "ok"
      ? "border-moss/40 bg-moss/10 text-moss"
      : backendStatus === "down"
        ? "border-red-400/40 bg-red-500/10 text-red-300"
        : "border-line bg-ink text-muted";

  useEffect(() => {
    void refreshNativeDevices();
  }, []);

  async function refreshNativeDevices() {
    try {
      const devices = await nativeListOutputDevices();
      setNativeDevices(devices);
      setNativeDeviceMessage(devices.length ? null : "No native output devices reported.");
    } catch {
      setNativeDevices([]);
      setNativeDeviceMessage("Native output devices are only available in the desktop app.");
    }
  }

  function updateShortcut(action: KeyboardShortcutAction, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (shortcutCaptureAction !== action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setShortcutCaptureAction(null);
      setShortcutMessage("Shortcut edit canceled");
      return;
    }
    const shortcut = shortcutFromEvent(event.nativeEvent);
    if (!shortcut) {
      return;
    }
    setUiPreferences((current) => ({
      ...current,
      keyboardShortcuts: {
        ...current.keyboardShortcuts,
        [action]: shortcut,
      },
    }));
    setShortcutCaptureAction(null);
    setShortcutMessage(`${keyboardShortcutLabels[action]} set to ${formatShortcut(shortcut)}`);
  }

  function resetShortcut(action: KeyboardShortcutAction) {
    setUiPreferences((current) => ({
      ...current,
      keyboardShortcuts: {
        ...current.keyboardShortcuts,
        [action]: defaultKeyboardShortcuts[action],
      },
    }));
    setShortcutCaptureAction(null);
    setShortcutMessage(`${keyboardShortcutLabels[action]} reset`);
  }

  function resetAllShortcuts() {
    setUiPreferences((current) => ({ ...current, keyboardShortcuts: defaultKeyboardShortcuts }));
    setShortcutCaptureAction(null);
    setShortcutMessage("Keyboard shortcuts reset");
  }

  function exportShortcutPreset() {
    setShortcutPresetJson(JSON.stringify(uiPreferences.keyboardShortcuts, null, 2));
    setShortcutMessage("Shortcut preset exported below");
  }

  function importShortcutPreset() {
    try {
      const parsed = JSON.parse(shortcutPresetJson);
      setUiPreferences((current) => ({
        ...current,
        keyboardShortcuts: normalizeKeyboardShortcuts(parsed),
      }));
      setShortcutMessage("Shortcut preset imported");
    } catch (error) {
      setShortcutMessage(error instanceof Error ? error.message : "Could not import shortcut preset");
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
                startupDiagnostics.ok ? "border-moss/40 bg-moss/10 text-moss" : "border-ember/50 bg-ember/10 text-ember"
              }`}
            >
              self-check {startupDiagnostics.ok ? "ok" : "review"}
            </span>
          )}
        </div>
      </header>
      <section className="min-h-0 flex-1 overflow-auto p-6">
        <div className="grid max-w-3xl gap-5">
          <label className="grid gap-2 text-sm text-neutral-200">
            <span className="text-xs uppercase text-muted">Music Folder Path</span>
            <div className="flex gap-2">
              <input
                value={folderPath}
                onChange={(event) => setFolderPath(event.target.value)}
                className="h-10 flex-1 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                placeholder="C:\\Users\\you\\Music"
              />
              <button className="secondary-button h-10" type="button" onClick={onBrowse} disabled={isScanning}>
                <FolderOpen size={17} />
                Browse
              </button>
              <button className="primary-button h-10" type="button" onClick={onScan} disabled={isScanning}>
                <RefreshCw size={17} />
                {isScanning ? "Scanning" : "Rescan"}
              </button>
            </div>
          </label>

          {!settings?.library_path && settings?.suggested_music_path && (
            <div className="flex items-center justify-between gap-3 rounded border border-ember/30 bg-ember/10 p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-white">Use your Windows Music folder?</div>
                <div className="truncate text-xs text-muted">{settings.suggested_music_path}</div>
              </div>
              <button
                className="secondary-button shrink-0"
                type="button"
                onClick={() => setFolderPath(settings.suggested_music_path ?? "")}
              >
                <FolderOpen size={15} />
                Use Folder
              </button>
            </div>
          )}

          <DisclosureSection title="Library Preferences" description="Display, rating storage, and startup behavior" defaultOpen>
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

              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div className="font-medium text-white">Library layout</div>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-muted">Compact rows</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={uiPreferences.compactLibraryRows}
                    onChange={(event) =>
                      setUiPreferences((current) => ({
                        ...current,
                        compactLibraryRows: event.target.checked,
                        density: event.target.checked ? "compact" : "comfortable",
                      }))
                    }
                  />
                </label>
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

          <DisclosureSection title="Keyboard Shortcuts" description="Page navigation and local playback controls">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Keyboard className="shrink-0 text-muted" size={18} />
                  <div className="min-w-0">
                    <div className="font-medium text-white">Shortcut editor</div>
                    <div className="text-xs text-muted">Click a shortcut, then press the replacement keys. Escape cancels.</div>
                  </div>
                </div>
                <button className="secondary-button shrink-0" type="button" onClick={resetAllShortcuts}>
                  <RotateCcw size={15} />
                  Reset All
                </button>
              </div>
              {shortcutMessage && <div className="rounded border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-moss">{shortcutMessage}</div>}
              {shortcutConflicts.length > 0 && (
                <div className="rounded border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-ember">
                  Conflicts:{" "}
                  {shortcutConflicts
                    .map((actions) => actions.map((action) => keyboardShortcutLabels[action]).join(" / "))
                    .join("; ")}
                </div>
              )}
              <div className="grid gap-2 rounded border border-line/70 bg-ink p-3">
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button h-8" type="button" onClick={exportShortcutPreset}>
                    <Download size={14} />
                    Export Preset
                  </button>
                  <button className="secondary-button h-8" type="button" onClick={importShortcutPreset}>
                    <FileText size={14} />
                    Import Preset
                  </button>
                </div>
                <textarea
                  className="min-h-20 rounded border border-line bg-panel px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={shortcutPresetJson}
                  placeholder="Shortcut preset JSON"
                  onChange={(event) => setShortcutPresetJson(event.target.value)}
                />
              </div>
              {keyboardShortcutGroups.map((group) => (
                <div key={group.title} className="grid gap-2 rounded border border-line/70 bg-ink p-3">
                  <div className="text-xs font-medium uppercase text-muted">{group.title}</div>
                  <div className="grid gap-2">
                    {group.actions.map((action) => (
                      <div key={action} className="grid gap-2 rounded border border-line/60 bg-panel px-3 py-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                        <span className="min-w-0 truncate text-neutral-200">{keyboardShortcutLabels[action]}</span>
                        <button
                          className={`secondary-button h-8 justify-center font-mono text-xs ${shortcutCaptureAction === action ? "border-ember text-ember" : ""}`}
                          type="button"
                          onClick={() => {
                            setShortcutCaptureAction(action);
                            setShortcutMessage(null);
                          }}
                          onKeyDown={(event) => updateShortcut(action, event)}
                        >
                          {shortcutCaptureAction === action ? "Press keys..." : formatShortcut(uiPreferences.keyboardShortcuts[action])}
                        </button>
                        <button className="icon-button h-8 w-8" type="button" title="Reset shortcut" onClick={() => resetShortcut(action)}>
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DisclosureSection>

          <DisclosureSection title="AutoDJ Defaults" description="Queue size, temperature, and similarity bias">
            <div className="grid gap-4 text-sm text-neutral-200">
            <NumberField
              label="Default Queue Length"
              min={1}
              max={200}
              value={uiPreferences.defaultQueueLength}
              onChange={(value) =>
                setUiPreferences((current) => ({ ...current, defaultQueueLength: value }))
              }
            />
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">
                Default Temperature {uiPreferences.defaultTemperature.toFixed(2)}
              </span>
              <input
                type="range"
                min={0.1}
                max={2.5}
                step={0.05}
                value={uiPreferences.defaultTemperature}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, defaultTemperature: Number(event.target.value) }))
                }
                className="accent-moss"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">
                Similarity Bias {uiPreferences.similarityWeight.toFixed(1)}
              </span>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={uiPreferences.similarityWeight}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, similarityWeight: Number(event.target.value) }))
                }
                className="accent-ember"
              />
            </label>
            </div>
          </DisclosureSection>

          <DisclosureSection title="CLAP Audio Analysis" description={clapStatus?.message ?? "Optional genre and similarity analysis"}>
            <div className="grid gap-4 text-sm text-neutral-200">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className={`mt-1 truncate text-xs ${clapReady ? "text-moss" : "text-muted"}`}>
                  {clapStatus?.message ?? "Checking CLAP"}
                </div>
                {clapStatus?.runtime_managed && (
                  <div className="mt-1 truncate text-xs text-muted" title={clapStatus.runtime_dir ?? undefined}>
                    Runtime {clapStatus.runtime_device ?? "not installed"} - {clapStatus.runtime_dir}
                  </div>
                )}
              </div>
              <button className="icon-button" type="button" title="Refresh CLAP status" onClick={onRefreshClapStatus}>
                <RefreshCw size={16} />
              </button>
            </div>

            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Model ID</span>
              <input
                className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={clapModelId}
                onChange={(event) => setClapModelId(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Model Cache Directory</span>
              <input
                className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={clapCacheDir}
                onChange={(event) => setClapCacheDir(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Seconds Analyzed Per Track</span>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={clapMaxDuration}
                onChange={(event) => setClapMaxDuration(Number(event.target.value))}
                className="accent-ember"
              />
              <span className="text-xs text-muted">{clapMaxDuration.toFixed(0)} seconds from the start of each file</span>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberField
                label="Analysis Limit"
                min={0}
                max={100000}
                value={audioAnalysisLimit}
                onChange={setAudioAnalysisLimit}
              />
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                <span className="text-muted">Only missing</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={audioAnalysisOnlyMissing}
                  onChange={(event) => setAudioAnalysisOnlyMissing(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                <span className="text-muted">Overwrite</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-ember"
                  checked={audioAnalysisOverwrite}
                  onChange={(event) => setAudioAnalysisOverwrite(event.target.checked)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="secondary-button" type="button" onClick={onSaveClapConfig}>
                <ShieldCheck size={15} />
                Save CLAP
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!clapReady || isAudioAnalyzing}
                onClick={onAnalyzeAudio}
              >
                <Wand2 size={15} />
                {isAudioAnalyzing ? "Analyzing" : "Analyze Audio"}
              </button>
            </div>

            {audioAnalysisProgress && (
              <div className="rounded border border-line/70 bg-ink p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>
                    {audioAnalysisProgress.processed_tracks.toLocaleString()} of{" "}
                    {audioAnalysisProgress.total_tracks.toLocaleString()} tracks
                  </span>
                  <span>ETA {formatTime(audioAnalysisProgress.eta_seconds)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-panel">
                  <div className="h-full rounded bg-ember transition-all duration-300" style={{ width: `${audioProgressPercent}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
                  <div>
                    <div className="font-semibold text-moss">{audioAnalysisProgress.analyzed}</div>
                    <div className="text-muted">Analyzed</div>
                  </div>
                  <div>
                    <div className="font-semibold text-red-300">{audioAnalysisProgress.skipped}</div>
                    <div className="text-muted">Skipped</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{audioProgressPercent.toFixed(0)}%</div>
                    <div className="text-muted">Progress</div>
                  </div>
                </div>
                {audioAnalysisProgress.current_track && (
                  <div className="mt-2 truncate text-xs text-muted">{audioAnalysisProgress.current_track}</div>
                )}
              </div>
            )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="Player" description="Fade, skip tracking, and playback presentation">
            <div className="grid gap-3 text-sm text-neutral-200">
            <label className="grid gap-2 rounded border border-line/70 bg-ink p-3">
              <span className="text-xs uppercase text-muted">Playback Engine</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.playbackEngine}
                onChange={(event) =>
                  setUiPreferences((current) => ({
                    ...current,
                    playbackEngine: event.target.value as UiPreferences["playbackEngine"],
                  }))
                }
              >
                <option value="webview">WebView audio</option>
                <option value="native">Native Rust audio</option>
              </select>
              <span className="text-xs text-muted">
                Native playback uses Rust with rodio/cpal/Symphonia for broader local codec support. WebView remains the safest default while the native engine matures.
              </span>
            </label>
            <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-white">Native output</div>
                  <div className="text-xs text-muted">Used when Playback Engine is set to Native Rust audio.</div>
                </div>
                <button className="secondary-button h-8" type="button" onClick={() => void refreshNativeDevices()}>
                  <RefreshCw size={14} />
                  Recheck
                </button>
              </div>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Output Device</span>
                <select
                  className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                  value={uiPreferences.nativeOutputDeviceId}
                  onChange={(event) =>
                    setUiPreferences((current) => ({ ...current, nativeOutputDeviceId: event.target.value }))
                  }
                >
                  <option value="">System default</option>
                  {nativeDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}{device.is_default ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Output Buffer</span>
                <select
                  className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                  value={uiPreferences.nativeBufferFrames}
                  onChange={(event) =>
                    setUiPreferences((current) => ({ ...current, nativeBufferFrames: Number(event.target.value) }))
                  }
                >
                  {NATIVE_BUFFER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {nativeDeviceMessage && <div className="text-xs text-muted">{nativeDeviceMessage}</div>}
              <div className="rounded border border-line/70 bg-panel px-3 py-2 text-xs text-muted">
                WASAPI shared output is handled by cpal on Windows. Exclusive mode needs a dedicated WASAPI backend, so it stays out of the current rodio bridge.
              </div>
            </div>
            <label className="flex items-center justify-between gap-4">
              <span className="text-muted">Compact bottom player</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={uiPreferences.miniPlayer}
                onChange={(event) =>
                  setUiPreferences((current) => ({
                    ...current,
                    miniPlayer: event.target.checked,
                  }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-muted">Detached mini-player always on top</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={uiPreferences.miniPlayerAlwaysOnTop}
                onChange={(event) => {
                  const value = event.target.checked;
                  writeMiniPlayerAlwaysOnTop(value);
                  setUiPreferences((current) => ({ ...current, miniPlayerAlwaysOnTop: value }));
                }}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Mini Player Width"
                min={360}
                max={900}
                value={uiPreferences.miniPlayerWidth}
                onChange={(value) => {
                  writeMiniPlayerSize(value, uiPreferences.miniPlayerHeight);
                  setUiPreferences((current) => ({ ...current, miniPlayerWidth: value }));
                }}
              />
              <NumberField
                label="Mini Player Height"
                min={96}
                max={220}
                value={uiPreferences.miniPlayerHeight}
                onChange={(value) => {
                  writeMiniPlayerSize(uiPreferences.miniPlayerWidth, value);
                  setUiPreferences((current) => ({ ...current, miniPlayerHeight: value }));
                }}
              />
            </div>
            <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">ReplayGain / Loudness</span>
                <select
                  className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                  value={uiPreferences.replayGainMode}
                  onChange={(event) =>
                    setUiPreferences((current) => ({
                      ...current,
                      replayGainMode: event.target.value as UiPreferences["replayGainMode"],
                    }))
                  }
                >
                  <option value="off">Off</option>
                  <option value="track">Track gain</option>
                  <option value="album">Album gain</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">ReplayGain Preamp {uiPreferences.replayGainPreampDb.toFixed(1)} dB</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={uiPreferences.replayGainPreampDb}
                  onChange={(event) =>
                    setUiPreferences((current) => ({ ...current, replayGainPreampDb: Number(event.target.value) }))
                  }
                  className="accent-moss"
                />
              </label>
              <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-panel px-3 py-2">
                <span className="text-muted">Prevent clipping with ReplayGain peak tags</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={uiPreferences.replayGainPreventClipping}
                  onChange={(event) =>
                    setUiPreferences((current) => ({ ...current, replayGainPreventClipping: event.target.checked }))
                  }
                />
              </label>
              <div className="text-xs text-muted">
                FLAC Cafe reads embedded ReplayGain gain and peak tags during scans and applies gain during playback. Tracks without tags play at normal volume.
              </div>
            </div>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Fade Length {uiPreferences.playerFadeMs}ms</span>
              <input
                type="range"
                min={0}
                max={500}
                step={25}
                value={uiPreferences.playerFadeMs}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, playerFadeMs: Number(event.target.value) }))
                }
                className="accent-moss"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">
                Skip Threshold {uiPreferences.skipThresholdPercent.toFixed(0)}%
              </span>
              <input
                type="range"
                min={0}
                max={95}
                step={5}
                value={uiPreferences.skipThresholdPercent}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, skipThresholdPercent: Number(event.target.value) }))
                }
                className="accent-ember"
              />
              <span className="text-xs text-muted">
                Leaving a track before this much has played counts as a skip; after that it counts as a play.
              </span>
            </label>
            <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-white">WebView codec support</div>
                  <div className="text-xs text-muted">
                    Reported by WebView2. Unsupported files can still be opened in your default Windows audio app from the player bar.
                  </div>
                </div>
                <button className="secondary-button h-8" type="button" onClick={() => setCodecSupport(detectCodecSupport())}>
                  <RefreshCw size={14} />
                  Recheck
                </button>
              </div>
              <div className="grid gap-1 text-xs">
                {codecSupport.map((codec) => (
                  <div key={codec.label} className="grid grid-cols-[110px_1fr] gap-3 rounded bg-panel px-2 py-1.5">
                    <span className="text-neutral-200">{codec.label}</span>
                    <span
                      className={
                        codec.support === "probably"
                          ? "text-moss"
                          : codec.support === "maybe"
                            ? "text-ember"
                            : "text-muted"
                      }
                    >
                      {codec.support === "no" ? "not reported" : codec.support}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </DisclosureSection>

          <DisclosureSection title="Maintenance" description="Background services and database helpers">
            <div className="grid gap-3 text-sm text-neutral-200">
            <div className="rounded border border-line/70 bg-ink p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">Backend service</div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {backendCheckedAt ? `Last checked ${backendCheckedAt}` : "Not checked yet"}
                  </div>
                </div>
                <span className={`shrink-0 rounded border px-2 py-1 text-xs uppercase ${backendStatusClass}`}>
                  {backendStatus}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted">{backendMessage}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={onCheckBackend}>
                  <RefreshCw size={15} />
                  Check Backend
                </button>
                <button className="secondary-button" type="button" onClick={onRestartBackend} disabled={backendStatus === "restarting"}>
                  <RefreshCw size={15} />
                  {backendStatus === "restarting" ? "Restarting" : "Restart Backend"}
                </button>
                <button className="secondary-button" type="button" onClick={onOpenSourceFolder}>
                  <FolderOpen size={15} />
                  Open Source Folder
                </button>
              </div>
            </div>

            <div className="rounded border border-line/70 bg-ink p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">Startup self-check</div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {startupDiagnostics
                      ? `Last run ${new Date(startupDiagnostics.generated_at).toLocaleString()}`
                      : "Not run yet"}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-1 text-xs uppercase ${
                    startupDiagnostics?.ok
                      ? "border-moss/40 bg-moss/10 text-moss"
                      : startupDiagnostics
                        ? "border-ember/50 bg-ember/10 text-ember"
                        : "border-line bg-panel text-muted"
                  }`}
                >
                  {startupDiagnostics ? (startupDiagnostics.ok ? "ok" : "review") : "unknown"}
                </span>
              </div>
              {startupDiagnostics && (
                <div className="mt-3 grid gap-2">
                  {startupDiagnostics.items.map((item) => (
                    <div key={item.key} className="flex items-start gap-2 text-xs">
                      {item.ok ? (
                        <CheckCircle2 className="mt-0.5 shrink-0 text-moss" size={14} />
                      ) : (
                        <Info className="mt-0.5 shrink-0 text-ember" size={14} />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-200">{item.label}</div>
                        <div className="truncate text-muted" title={item.path ?? item.message}>
                          {item.message}
                          {item.path ? ` - ${item.path}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={onRunStartupDiagnostics}>
                  <ShieldCheck size={15} />
                  Run Self-Check
                </button>
                <button className="secondary-button" type="button" onClick={onOpenBackendLog}>
                  <FileText size={15} />
                  Open Log
                </button>
              </div>
              {backendLog && (
                <details className="mt-3 rounded border border-line bg-panel p-2 text-xs text-muted">
                  <summary className="cursor-pointer text-neutral-200">
                    {backendLog.exists ? `Log tail (${backendLog.lines.length} lines)` : "No backend log yet"}
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5">
                    {backendLog.lines.join("\n") || backendLog.path}
                  </pre>
                </details>
              )}
            </div>

            <label className="flex items-center justify-between gap-4">
              <span className="text-muted">Artist lookup</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={uiPreferences.enableArtistLookup}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, enableArtistLookup: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-muted">Toast notifications</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={uiPreferences.showToasts}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, showToasts: event.target.checked }))
                }
              />
            </label>
            <div className="flex gap-2">
              <button className="secondary-button" type="button" onClick={onBackupDatabase}>
                <Download size={15} />
                Backup DB
              </button>
              <button className="secondary-button" type="button" onClick={onCreateSupportBundle}>
                <FileText size={15} />
                Support Bundle
              </button>
              <button className="secondary-button" type="button" disabled={!supportBundlePath} onClick={onCopySupportBundlePath}>
                <FileText size={15} />
                Copy Path
              </button>
              <button className="secondary-button" type="button" onClick={onClearArtistCache}>
                <RefreshCw size={15} />
                Clear Artist Cache
              </button>
            </div>
            {supportBundlePath && (
              <div className="truncate rounded border border-line/70 bg-panel px-3 py-2 text-xs text-muted" title={supportBundlePath}>
                {supportBundlePath}
              </div>
            )}
            </div>
          </DisclosureSection>

          {scanProgress && scanProgress.status !== "completed" && scanProgress.status !== "failed" && (
            <div className="rounded border border-line bg-panel p-4 text-sm text-neutral-200">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-white">
                    {scanProgress.status === "cleaning" ? "Removing missing files" : hasCount ? "Scanning library" : "Finding audio files"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {hasCount
                      ? `${scanProgress.processed_files.toLocaleString()} of ${scanProgress.total_files.toLocaleString()} files`
                      : "Counting supported audio files"}
                  </div>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>Elapsed {formatTime(scanProgress.elapsed_seconds)}</div>
                  <div>ETA {formatTime(scanProgress.eta_seconds)}</div>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded bg-ink">
                <div
                  className={`h-full rounded bg-moss transition-all duration-300 ${
                    hasCount ? "" : "w-1/3 animate-pulse"
                  }`}
                  style={hasCount ? { width: `${progressPercent}%` } : undefined}
                />
              </div>

              <div className="mt-3 grid grid-cols-5 gap-3 text-center">
                <div>
                  <div className="font-semibold text-white">{scanProgress.inserted}</div>
                  <div className="text-xs text-muted">Inserted</div>
                </div>
                <div>
                  <div className="font-semibold text-ember">{scanProgress.updated}</div>
                  <div className="text-xs text-muted">Updated</div>
                </div>
                <div>
                  <div className="font-semibold text-red-200">{scanProgress.removed}</div>
                  <div className="text-xs text-muted">Removed</div>
                </div>
                <div>
                  <div className="font-semibold text-red-300">{scanProgress.skipped}</div>
                  <div className="text-xs text-muted">Skipped</div>
                </div>
                <div>
                  <div className="font-semibold text-moss">{progressPercent.toFixed(0)}%</div>
                  <div className="text-xs text-muted">Progress</div>
                </div>
              </div>

              {scanProgress.current_path && (
                <div className="mt-3 truncate text-xs text-muted" title={scanProgress.current_path}>
                  {fileName(scanProgress.current_path)}
                </div>
              )}
            </div>
          )}

          {scanProgress?.status === "failed" && (
            <div className="rounded border border-red-400/40 bg-red-950/20 p-4 text-sm text-red-200">
              {scanProgress.error ?? "Scan failed"}
            </div>
          )}

          {scanResult && (
            <div className="rounded border border-line bg-panel p-4 text-sm text-neutral-200">
              <div className="mb-2 font-medium text-white">{scanResult.folder_path}</div>
              <div className="grid grid-cols-5 gap-3 text-center">
                <div>
                  <div className="text-lg font-semibold text-white">{scanResult.scanned_files}</div>
                  <div className="text-xs text-muted">Scanned</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-moss">{scanResult.inserted}</div>
                  <div className="text-xs text-muted">Inserted</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-ember">{scanResult.updated}</div>
                  <div className="text-xs text-muted">Updated</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-200">{scanResult.removed}</div>
                  <div className="text-xs text-muted">Removed</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-300">{scanResult.skipped}</div>
                  <div className="text-xs text-muted">Skipped</div>
                </div>
              </div>
              {scanResult.errors.length > 0 && (
                <details className="mt-3 text-xs text-muted">
                  <summary>Scan errors</summary>
                  <ul className="mt-2 grid gap-1">
                    {scanResult.errors.slice(0, 20).map((error) => (
                      <li key={error} className="truncate">
                        {error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
