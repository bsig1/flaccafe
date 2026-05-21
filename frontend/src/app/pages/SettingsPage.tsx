import {
  useState,
} from "react";

import {
  CheckCircle2,
  Download,
  EyeOff,
  FileText,
  FolderOpen,
  Info,
  RefreshCw,
  ShieldCheck,
  Star,
  Upload,
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
import type {
  AudioAnalysisProgress,
  CacheClearTarget,
  ClapStatusResponse,
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  FileOrganizationResponse,
  FilenameTagInferenceResponse,
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
  Page,
  UiDensity,
  UiPreferences,
  fileName,
  formatTime,
} from "../shared";

const DEFAULT_FILENAME_TAG_PATTERNS = [
  "<Album Artist> - <Album> [<Year>]/<Track#> - <Artist> - <Title>",
  "<Album Artist>/<Album>/<Track#> - <Title>",
  "<Artist> - <Album>/<Disc#>-<Track#> - <Title>",
  "<Genre>/<Artist>/<Album> (<Year>)/<Track#> - <Title>",
];

const FILENAME_TAG_PRESETS_KEY = "flacCafeFilenameTagPresets";

function readFilenameTagPresets(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILENAME_TAG_PRESETS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function writeFilenameTagPresets(patterns: string[]) {
  window.localStorage.setItem(FILENAME_TAG_PRESETS_KEY, JSON.stringify(patterns));
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
  onClearLibraryCaches,
  filenameTagPreview,
  onPreviewFilenameTags,
  onApplyFilenameTags,
  fileOrganizationPreview,
  onPreviewFileOrganization,
  onApplyFileOrganization,
  metadataCsvExport,
  metadataCsvImportPreview,
  metadataCsvImportReport,
  onExportMetadataCsv,
  onPreviewMetadataCsv,
  onApplyMetadataCsv,
  onExportMetadataCsvReport,
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
  onClearLibraryCaches: (targets: CacheClearTarget[]) => void | Promise<void>;
  filenameTagPreview: FilenameTagInferenceResponse | null;
  onPreviewFilenameTags: (pattern: string, missingOnly: boolean) => void | Promise<void>;
  onApplyFilenameTags: (pattern: string, missingOnly: boolean) => void | Promise<void>;
  fileOrganizationPreview: FileOrganizationResponse | null;
  onPreviewFileOrganization: (
    template: string,
    baseFolder?: string | null,
    options?: { collisionStrategy?: "skip" | "auto_rename"; cleanupEmptyFolders?: boolean },
  ) => void | Promise<void>;
  onApplyFileOrganization: (
    template: string,
    baseFolder?: string | null,
    options?: { collisionStrategy?: "skip" | "auto_rename"; cleanupEmptyFolders?: boolean },
  ) => void | Promise<void>;
  metadataCsvExport: CsvMetadataExportResponse | null;
  metadataCsvImportPreview: CsvMetadataImportResponse | null;
  metadataCsvImportReport: CsvMetadataImportReportResponse | null;
  onExportMetadataCsv: () => void | Promise<void>;
  onPreviewMetadataCsv: (csvPath: string, missingOnly: boolean) => void | Promise<void>;
  onApplyMetadataCsv: (csvPath: string, missingOnly: boolean) => void | Promise<void>;
  onExportMetadataCsvReport: (csvPath: string, missingOnly: boolean) => void | Promise<void>;
}) {
  const [filenameTagPattern, setFilenameTagPattern] = useState("<Album Artist> - <Album> [<Year>]/<Track#> - <Artist> - <Title>");
  const [filenameTagMissingOnly, setFilenameTagMissingOnly] = useState(true);
  const [filenameTagPresets, setFilenameTagPresets] = useState(readFilenameTagPresets);
  const [organizeTemplate, setOrganizeTemplate] = useState("<Album Artist>/<Album> (<Year>)/<Track#> - <Title>");
  const [organizeBaseFolder, setOrganizeBaseFolder] = useState("");
  const [organizeCollisionStrategy, setOrganizeCollisionStrategy] = useState<"skip" | "auto_rename">("skip");
  const [organizeCleanupEmptyFolders, setOrganizeCleanupEmptyFolders] = useState(false);
  const [metadataCsvPath, setMetadataCsvPath] = useState("");
  const [metadataCsvMissingOnly, setMetadataCsvMissingOnly] = useState(true);
  const allFilenameTagPresets = Array.from(new Set([...DEFAULT_FILENAME_TAG_PATTERNS, ...filenameTagPresets]));
  const isCustomFilenameTagPreset = filenameTagPresets.includes(filenameTagPattern);
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

  function saveCurrentFilenameTagPreset() {
    const trimmed = filenameTagPattern.trim();
    if (!trimmed || allFilenameTagPresets.includes(trimmed)) {
      return;
    }
    const next = [...filenameTagPresets, trimmed];
    setFilenameTagPresets(next);
    writeFilenameTagPresets(next);
  }

  function deleteCurrentFilenameTagPreset() {
    if (!isCustomFilenameTagPreset) {
      return;
    }
    const next = filenameTagPresets.filter((pattern) => pattern !== filenameTagPattern);
    setFilenameTagPresets(next);
    writeFilenameTagPresets(next);
    setFilenameTagPattern(DEFAULT_FILENAME_TAG_PATTERNS[0]);
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
            </div>
          </DisclosureSection>

          <DisclosureSection title="Library Tools" description="Filename tags, file organization, and cache cleanup">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div>
                  <div className="font-medium text-white">Infer tags from filenames</div>
                  <div className="mt-1 text-xs text-muted">
                    Use MusicBee-style folder naming patterns to fill missing title, artist, album, year, disc, genre, and track fields.
                  </div>
                </div>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Pattern</span>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="h-9 min-w-0 flex-1 rounded border border-line bg-panel px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                      value={allFilenameTagPresets.includes(filenameTagPattern) ? filenameTagPattern : ""}
                      onChange={(event) => {
                        if (event.target.value) {
                          setFilenameTagPattern(event.target.value);
                        }
                      }}
                    >
                      <option value="" disabled>
                        Choose saved pattern
                      </option>
                      {allFilenameTagPresets.map((pattern) => (
                        <option key={pattern} value={pattern}>
                          {pattern}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary-button h-9"
                      type="button"
                      disabled={!filenameTagPattern.trim() || allFilenameTagPresets.includes(filenameTagPattern.trim())}
                      onClick={saveCurrentFilenameTagPreset}
                    >
                      Save Pattern
                    </button>
                    <button
                      className="secondary-button h-9"
                      type="button"
                      disabled={!isCustomFilenameTagPreset}
                      onClick={deleteCurrentFilenameTagPreset}
                    >
                      Delete
                    </button>
                  </div>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                    value={filenameTagPattern}
                    onChange={(event) => setFilenameTagPattern(event.target.value)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
                  <span className="text-muted">Only fill empty fields</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={filenameTagMissingOnly}
                    onChange={(event) => setFilenameTagMissingOnly(event.target.checked)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void onPreviewFilenameTags(filenameTagPattern, filenameTagMissingOnly)}
                  >
                    <Wand2 size={15} />
                    Preview Tags
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void onApplyFilenameTags(filenameTagPattern, filenameTagMissingOnly)}
                  >
                    <FileText size={15} />
                    Apply Tags
                  </button>
                </div>
                {filenameTagPreview && (
                  <div className="rounded border border-line bg-panel p-3 text-xs">
                    <div className="mb-2 text-neutral-200">
                      {filenameTagPreview.matches.toLocaleString()} matches, {filenameTagPreview.applied.toLocaleString()} applied
                    </div>
                    <div className="grid gap-1">
                      {filenameTagPreview.previews.slice(0, 5).map((preview) => (
                        <div key={preview.track_id} className="grid gap-1 rounded bg-ink px-2 py-1.5">
                          <div className="truncate text-muted">{preview.path}</div>
                          <div className="truncate text-neutral-200">
                            {preview.matched
                              ? preview.changed_fields.length
                                ? preview.changed_fields.join(", ")
                                : "Matched; no fields need changes"
                              : "No match"}
                            {preview.error ? ` - ${preview.error}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div>
                  <div className="font-medium text-white">Organize files from tags</div>
                  <div className="mt-1 text-xs text-muted">
                    Preview tag-based folder moves before applying. FLAC Cafe updates SQLite paths after each successful move.
                  </div>
                </div>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Template</span>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                    value={organizeTemplate}
                    onChange={(event) => setOrganizeTemplate(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Base Folder</span>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={organizeBaseFolder}
                    placeholder={folderPath || "Leave empty to use the music folder"}
                    onChange={(event) => setOrganizeBaseFolder(event.target.value)}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Name Collisions</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={organizeCollisionStrategy}
                      onChange={(event) => setOrganizeCollisionStrategy(event.target.value as "skip" | "auto_rename")}
                    >
                      <option value="skip">Skip existing files</option>
                      <option value="auto_rename">Auto-rename with (2)</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
                    <span className="text-muted">Remove empty source folders</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={organizeCleanupEmptyFolders}
                      onChange={(event) => setOrganizeCleanupEmptyFolders(event.target.checked)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      void onPreviewFileOrganization(organizeTemplate, organizeBaseFolder, {
                        collisionStrategy: organizeCollisionStrategy,
                        cleanupEmptyFolders: organizeCleanupEmptyFolders,
                      })
                    }
                  >
                    <FileText size={15} />
                    Preview Moves
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() =>
                      void onApplyFileOrganization(organizeTemplate, organizeBaseFolder, {
                        collisionStrategy: organizeCollisionStrategy,
                        cleanupEmptyFolders: organizeCleanupEmptyFolders,
                      })
                    }
                  >
                    <FolderOpen size={15} />
                    Move Files
                  </button>
                </div>
                {fileOrganizationPreview && (
                  <div className="rounded border border-line bg-panel p-3 text-xs">
                    <div className="mb-2 text-neutral-200">
                      {fileOrganizationPreview.changed_count.toLocaleString()} possible moves, {fileOrganizationPreview.applied.toLocaleString()} applied
                      {fileOrganizationPreview.removed_empty_folders
                        ? `, ${fileOrganizationPreview.removed_empty_folders.toLocaleString()} empty folders removed`
                        : ""}
                    </div>
                    <div className="grid gap-1">
                      {fileOrganizationPreview.changes.slice(0, 5).map((change) => (
                        <div key={change.track_id} className="grid gap-1 rounded bg-ink px-2 py-1.5">
                          <div className="truncate text-muted">{change.current_path}</div>
                          <div className={change.error || change.collision ? "truncate text-ember" : "truncate text-neutral-200"}>
                            {change.target_path}
                            {change.collision ? " - collision" : ""}
                            {change.error ? ` - ${change.error}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div>
                  <div className="font-medium text-white">CSV metadata cleanup</div>
                  <div className="mt-1 text-xs text-muted">
                    Export editable metadata for spreadsheet cleanup, then preview the CSV before importing changes.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" type="button" onClick={() => void onExportMetadataCsv()}>
                    <Download size={15} />
                    Export CSV
                  </button>
                  {metadataCsvExport && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setMetadataCsvPath(metadataCsvExport.csv_path)}
                    >
                      <FileText size={15} />
                      Use Last Export
                    </button>
                  )}
                </div>
                {metadataCsvExport && (
                  <div className="rounded border border-line bg-panel px-3 py-2 text-xs text-muted">
                    <div className="truncate">{metadataCsvExport.csv_path}</div>
                    <div>{metadataCsvExport.track_count.toLocaleString()} tracks exported</div>
                  </div>
                )}
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Import CSV Path</span>
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={metadataCsvPath}
                    placeholder="Paste the exported CSV path"
                    onChange={(event) => setMetadataCsvPath(event.target.value)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
                  <span className="text-muted">Only fill empty fields on import</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={metadataCsvMissingOnly}
                    onChange={(event) => setMetadataCsvMissingOnly(event.target.checked)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void onPreviewMetadataCsv(metadataCsvPath, metadataCsvMissingOnly)}
                  >
                    <EyeOff size={15} />
                    Preview Import
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void onExportMetadataCsvReport(metadataCsvPath, metadataCsvMissingOnly)}
                  >
                    <Download size={15} />
                    Export Dry Run
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void onApplyMetadataCsv(metadataCsvPath, metadataCsvMissingOnly)}
                  >
                    <Upload size={15} />
                    Import CSV
                  </button>
                </div>
                {metadataCsvImportPreview && (
                  <div className="rounded border border-line bg-panel p-3 text-xs">
                    <div className="mb-2 text-neutral-200">
                      {metadataCsvImportPreview.changed.toLocaleString()} changed rows,{" "}
                      {metadataCsvImportPreview.applied.toLocaleString()} applied
                    </div>
                    <div className="grid gap-1">
                      {metadataCsvImportPreview.previews.slice(0, 5).map((preview) => (
                        <div key={`${preview.row_number}-${preview.track_id ?? "missing"}`} className="grid gap-1 rounded bg-ink px-2 py-1.5">
                          <div className="truncate text-muted">
                            Row {preview.row_number}
                            {preview.path ? ` - ${preview.path}` : ""}
                          </div>
                          <div className={preview.error ? "truncate text-ember" : "truncate text-neutral-200"}>
                            {preview.error ??
                              (preview.changed_fields.length
                                ? preview.changed_fields.join(", ")
                                : preview.matched
                                  ? "Matched; no fields need changes"
                                  : "No match")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {metadataCsvImportReport && (
                  <div className="rounded border border-line bg-panel px-3 py-2 text-xs text-muted">
                    <div className="truncate">{metadataCsvImportReport.report_path}</div>
                    <div>
                      {metadataCsvImportReport.changed.toLocaleString()} changed rows,{" "}
                      {metadataCsvImportReport.errors.toLocaleString()} errors captured
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div>
                  <div className="font-medium text-white">Cache maintenance</div>
                  <div className="mt-1 text-xs text-muted">
                    Clear derived data without touching tracks, ratings, playlists, lyrics, or audio files.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" type="button" onClick={() => void onClearLibraryCaches(["artwork"])}>
                    <RefreshCw size={15} />
                    Artwork
                  </button>
                  <button className="secondary-button" type="button" onClick={() => void onClearLibraryCaches(["metadata"])}>
                    <RefreshCw size={15} />
                    Metadata
                  </button>
                  <button className="secondary-button" type="button" onClick={() => void onClearLibraryCaches(["recommendation_history"])}>
                    <RefreshCw size={15} />
                    AutoDJ History
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void onClearLibraryCaches(["artist", "artwork", "metadata", "recommendation_history", "scan_errors"])}
                  >
                    <RefreshCw size={15} />
                    All Caches
                  </button>
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
