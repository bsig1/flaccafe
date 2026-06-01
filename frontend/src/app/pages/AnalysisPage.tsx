import {
Copy,
Download,
Music2,
Pause,
Play,
RefreshCw,
ShieldCheck,
Wand2,
X,
} from "lucide-react";
import {
useState,
useEffect,
} from "react";

import {
fetchClapLibraryStats,
} from "../../lib/api";
import type {
AudioAnalysisCoverage,
AudioAnalysisProgress,
ClapInstallDevice,
ClapInstallProgress,
ClapLibraryStats,
ClapStatusResponse,
Track,
} from "../../types/api";
import {
DisclosureSection,
NumberField,
} from "../components/common";
import {
fileName,
formatPercent,
formatTime,
isAnalysisTerminal,
normalizeAudioAnalysisCoverage,
} from "../shared";

const CLAP_RUNTIME_SIZE_HINTS = {
  cpu: "Approx runtime size: 1-2 GB installed",
  cuda: "Approx runtime size: 5-7 GB installed",
} satisfies Record<ClapInstallDevice, string>;

const GPU_CAPABILITY_CACHE_KEY = "flaccafe.gpuCapabilityLabel";
const GPU_ESTIMATE_CACHE_KEY = "flaccafe.gpuEstimateLabel";

function readGpuLabelCache(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeGpuLabelCache(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage can be unavailable in hardened WebView environments.
  }
}

let lastGpuCapabilityLabel: string | null = readGpuLabelCache(GPU_CAPABILITY_CACHE_KEY);
let lastGpuEstimateLabel: string | null = readGpuLabelCache(GPU_ESTIMATE_CACHE_KEY);

export function AnalysisPage({
  clapStatus,
  coverage,
  eligibleTrackTotal,
  progress,
  audioAnalysisLimit,
  setAudioAnalysisLimit,
  audioAnalysisOverwrite,
  setAudioAnalysisOverwrite,
  audioAnalysisOnlyMissing,
  setAudioAnalysisOnlyMissing,
  isAudioAnalyzing,
  currentTrack,
  clapModelId,
  setClapModelId,
  clapCacheDir,
  setClapCacheDir,
  clapSamplesPerTrack,
  setClapSamplesPerTrack,
  clapBatchSize,
  setClapBatchSize,
  installProgress,
  isClapStatusLoading,
  clapStatusLoadPercent,
  clapStatusLoadMessage,
  isClapInstalling,
  onRefresh,
  onInstallClap,
  onSaveClapConfig,
  onAnalyzeLibrary,
  onAnalyzeCurrentTrack,
  onPause,
  onResume,
  onCancel,
}: {
  clapStatus: ClapStatusResponse | null;
  coverage: AudioAnalysisCoverage | null;
  eligibleTrackTotal: number | null;
  progress: AudioAnalysisProgress | null;
  audioAnalysisLimit: number;
  setAudioAnalysisLimit: (value: number) => void;
  audioAnalysisOverwrite: boolean;
  setAudioAnalysisOverwrite: (value: boolean) => void;
  audioAnalysisOnlyMissing: boolean;
  setAudioAnalysisOnlyMissing: (value: boolean) => void;
  isAudioAnalyzing: boolean;
  currentTrack: Track | null;
  clapModelId: string;
  setClapModelId: (value: string) => void;
  clapCacheDir: string;
  setClapCacheDir: (value: string) => void;
  clapSamplesPerTrack: number;
  setClapSamplesPerTrack: (value: number) => void;
  clapBatchSize: number;
  setClapBatchSize: (value: number) => void;
  installProgress: ClapInstallProgress | null;
  isClapStatusLoading: boolean;
  clapStatusLoadPercent: number;
  clapStatusLoadMessage: string;
  isClapInstalling: boolean;
  onRefresh: () => void;
  onInstallClap: (device: ClapInstallDevice, force?: boolean) => void;
  onSaveClapConfig: () => void;
  onAnalyzeLibrary: () => void;
  onAnalyzeCurrentTrack: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const [clapLogCopied, setClapLogCopied] = useState(false);
  const [clapLibraryStats, setClapLibraryStats] = useState<ClapLibraryStats | null>(null);
  const clapReady = Boolean(clapStatus?.installed);
  const clapStatusLoaded = Boolean(clapStatus);
  const clapDependencyErrorCount = Object.keys(clapStatus?.dependency_errors ?? {}).length;
  const clapNeedsOptionalInstall = Boolean(
    clapStatus && !clapReady && clapStatus.runtime_managed && !clapStatus.runtime_exists,
  );
  const clapSetupBlocked = Boolean(clapStatus && !clapReady && clapStatus.install_supported === false);
  const clapRuntimeProblem = Boolean(
    clapStatus && !clapReady && !clapNeedsOptionalInstall && !clapSetupBlocked && (clapStatus.runtime_exists || clapDependencyErrorCount > 0),
  );
  const clapStatusBadge = clapReady
    ? { className: "border-moss/40 bg-moss/10 text-moss", label: "analysis ok" }
    : clapSetupBlocked
      ? { className: "border-ember/50 bg-ember/10 text-ember", label: "setup blocked" }
      : clapRuntimeProblem
        ? { className: "border-ember/50 bg-ember/10 text-ember", label: "runtime issue" }
        : { className: "border-line bg-white/[0.04] text-muted", label: "optional setup" };
  const modelStateClass = !clapStatusLoaded
    ? "text-muted"
    : clapReady && clapStatus?.model_cached
      ? "text-moss"
      : clapRuntimeProblem || clapSetupBlocked
        ? "text-ember"
        : "text-muted";
  const modelStateLabel = !clapStatusLoaded
    ? "Checking"
    : !clapReady
      ? "Optional"
      : clapStatus?.model_cached
        ? "Cached"
        : "Downloads on first run";
  const showRuntimeInstall = clapStatusLoaded;
  const activeJob = Boolean(progress && !isAnalysisTerminal(progress.status));
  const activeProgress = activeJob ? progress : null;
  const displayCoverage = normalizeAudioAnalysisCoverage(coverage, eligibleTrackTotal);
  const coverageAdjustedForLibrary = Boolean(
    coverage && displayCoverage && coverage.total_tracks !== displayCoverage.total_tracks,
  );
  const progressPercent = Math.max(0, Math.min(100, activeProgress?.percent ?? displayCoverage?.coverage_percent ?? 0));
  const installPercent = Math.max(0, Math.min(100, installProgress?.percent ?? 0));
  const failures = progress?.failed_tracks ?? [];
  const clapLog = progress?.log ?? [];
  const clapLogText = clapLog.join("\n");
  const statusText = isClapStatusLoading
    ? clapStatusLoadMessage
    : installProgress?.message ?? activeProgress?.message ?? clapStatus?.message ?? "CLAP status loading";
  const canPause = isAudioAnalyzing && progress?.status === "running";
  const canResume = isAudioAnalyzing && progress?.status === "paused";
  const torchRuntime = clapStatus?.torch_device
    ? `${clapStatus.torch_device.toUpperCase()}${clapStatus.cuda_device_name ? ` - ${clapStatus.cuda_device_name}` : ""}`
    : "Not installed";
  const hasCudaSignal = Boolean(
    clapStatus?.cuda_available ||
    clapStatus?.cuda_device_name ||
    clapStatus?.torch_device?.toLowerCase() === "cuda",
  );
  const resolvedGpuCapability = hasCudaSignal
    ? `CUDA available${clapStatus?.cuda_device_name ? ` - ${clapStatus.cuda_device_name}` : ""}`
    : "No CUDA GPU detected";
  const resolvedGpuEstimate = hasCudaSignal
    ? "GPU analysis can be several times faster when disk reads keep up."
    : "CPU analysis is compatible but usually slower for large libraries.";
  if (clapStatusLoaded && (hasCudaSignal || !lastGpuCapabilityLabel)) {
    lastGpuCapabilityLabel = resolvedGpuCapability;
    lastGpuEstimateLabel = resolvedGpuEstimate;
    writeGpuLabelCache(GPU_CAPABILITY_CACHE_KEY, resolvedGpuCapability);
    writeGpuLabelCache(GPU_ESTIMATE_CACHE_KEY, resolvedGpuEstimate);
  }
  const gpuCapability = clapStatusLoaded && (hasCudaSignal || !lastGpuCapabilityLabel)
    ? resolvedGpuCapability
    : lastGpuCapabilityLabel ?? "Checking";
  const gpuEstimate = clapStatusLoaded && (hasCudaSignal || !lastGpuEstimateLabel)
    ? resolvedGpuEstimate
    : lastGpuEstimateLabel ?? "CPU/GPU capability will appear after CLAP status loads.";
  const runtimeActionLabel = clapReady ? "Change Runtime" : "Install CLAP";

  useEffect(() => {
    let cancelled = false;
    if (!clapStatusLoaded) {
      return () => {
        cancelled = true;
      };
    }
    void fetchClapLibraryStats()
      .then((stats) => {
        if (!cancelled) {
          setClapLibraryStats(stats);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClapLibraryStats(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clapStatusLoaded, displayCoverage?.analyzed_tracks, displayCoverage?.failed_tracks]);

  function renderLabelStats(title: string, rows: ClapLibraryStats["top_genres"]) {
    const maxCount = Math.max(1, ...rows.map((row) => row.count));
    return (
      <div className="rounded border border-line bg-panel p-4">
        <div className="mb-3 text-sm font-semibold text-white">{title}</div>
        <div className="grid gap-2">
          {rows.slice(0, 8).map((row) => (
            <div key={`${title}-${row.label}`} className="grid gap-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-neutral-200">{row.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {row.count.toLocaleString()} / {formatPercent(row.average_confidence * 100)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-ink">
                <div className="h-full rounded bg-moss" style={{ width: `${Math.max(4, (row.count / maxCount) * 100)}%` }} />
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="rounded border border-line/70 bg-ink p-3 text-xs text-muted">No labels yet.</div>}
        </div>
      </div>
    );
  }

  async function copyClapLog() {
    if (!clapLogText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(clapLogText);
      setClapLogCopied(true);
      window.setTimeout(() => setClapLogCopied(false), 1500);
    } catch {
      setClapLogCopied(false);
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Analysis</h1>
          <p className="text-xs text-muted">{statusText}</p>
        </div>
        <div className="flex items-center gap-2">
          {clapStatus && (
            <span
              className={`rounded border px-2 py-1 text-xs uppercase ${clapStatusBadge.className}`}
            >
              {clapStatusBadge.label}
            </span>
          )}
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={17} />
            Refresh
          </button>
          {showRuntimeInstall && (
            <button
              className="secondary-button"
              type="button"
              disabled={isClapInstalling || clapStatus?.install_supported === false}
              onClick={() => setInstallPromptOpen(true)}
            >
              <Download size={17} />
              {isClapInstalling ? "Installing CLAP" : runtimeActionLabel}
            </button>
          )}
        </div>
      </header>
      {isClapStatusLoading && (
        <div className="border-b border-line bg-panel/80 px-6 py-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-neutral-200">{clapStatusLoadMessage}</span>
            <span className="text-muted">{Math.round(clapStatusLoadPercent)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-ink">
            <div
              className="h-full rounded bg-moss transition-all duration-300"
              style={{ width: `${Math.max(6, Math.min(100, clapStatusLoadPercent))}%` }}
            />
          </div>
        </div>
      )}

      <section className="min-h-0 flex-1 overflow-auto p-6">
        <div className="grid max-w-6xl gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Coverage</div>
              <div className="mt-1 text-2xl font-semibold text-white">{formatPercent(displayCoverage?.coverage_percent)}</div>
              <div className="mt-1 text-xs text-muted">
                {(displayCoverage?.analyzed_tracks ?? 0).toLocaleString()} of {(displayCoverage?.total_tracks ?? 0).toLocaleString()}
              </div>
              {coverageAdjustedForLibrary && (
                <div className="mt-2 text-[11px] text-muted">Excludes podcasts and audiobooks</div>
              )}
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Unanalyzed</div>
              <div className="mt-1 text-2xl font-semibold text-ember">
                {(displayCoverage?.unanalyzed_tracks ?? 0).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted">Tracks without CLAP embeddings</div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Failures</div>
              <div className="mt-1 text-2xl font-semibold text-red-300">
                {(displayCoverage?.failed_tracks ?? 0).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted">Marked for retry</div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Model</div>
              <div className={`mt-1 text-sm font-semibold ${modelStateClass}`}>
                {modelStateLabel}
              </div>
              <div className="mt-1 truncate text-xs text-muted">{torchRuntime}</div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">GPU Capability</div>
              <div className="mt-1 text-sm font-semibold text-white">{gpuCapability}</div>
              <div className="mt-1 text-xs text-muted">{gpuEstimate}</div>
            </div>
            {renderLabelStats("Top CLAP Genres", clapLibraryStats?.top_genres ?? [])}
            {renderLabelStats("Top CLAP Moods", clapLibraryStats?.top_moods ?? [])}
          </div>

          {installProgress && (
              <section className="min-w-0 rounded border border-line bg-panel p-5">
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">CLAP Install</div>
                    <div className="mt-1 truncate text-xs text-muted">
                      {installProgress.device === "cuda" ? "NVIDIA CUDA" : "CPU"} -{" "}
                      {installProgress.status}
                    </div>
                  </div>

                  <div className="shrink-0 text-xs uppercase text-muted">
                    {installProgress.current_step} / {installProgress.total_steps}
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded bg-ink">
                  <div
                      className="h-full rounded bg-moss transition-all duration-300"
                      style={{ width: `${installPercent}%` }}
                  />
                </div>

                <div className="mt-2 truncate text-xs text-neutral-300">
                  {installProgress.current_command ?? installProgress.message}
                </div>

                {installProgress.log.length > 0 && (
                    <div className="mt-3 max-h-36 w-full max-w-full overflow-auto overflow-x-hidden rounded border border-line/70 bg-ink p-3 font-mono text-[11px] leading-5 text-muted">
                      {installProgress.log.slice(-10).map((line, index) => (
                          <div key={`${line}-${index}`} className="max-w-full truncate">
                            {line}
                          </div>
                      ))}
                    </div>
                )}
              </section>
          )}

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
            <section className="self-start rounded border border-line bg-panel p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Wand2 size={17} />
                Run Analysis
              </div>
              <div className="grid gap-4">
                <div className="rounded border border-line/70 bg-ink p-4">
                  <div className="text-sm font-medium text-white">
                    {clapReady ? "Audio similarity is ready" : "Install CLAP to enable audio similarity"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Analyze missing tracks in the background, then AutoDJ can blend metadata, ratings, song similarity, and mood.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="primary-button" type="button" disabled={!clapReady || isAudioAnalyzing || isClapInstalling} onClick={onAnalyzeLibrary}>
                      <Wand2 size={15} />
                      {isAudioAnalyzing ? "Analyzing" : "Analyze Library"}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!currentTrack || !clapReady || isAudioAnalyzing || isClapInstalling}
                      onClick={onAnalyzeCurrentTrack}
                    >
                      <Music2 size={15} />
                      Current Track
                    </button>
                    {activeJob && (
                      <>
                        <button className="secondary-button" type="button" disabled={!canPause} onClick={onPause}>
                          <Pause size={15} />
                          Pause
                        </button>
                        <button className="secondary-button" type="button" disabled={!canResume} onClick={onResume}>
                          <Play size={15} />
                          Resume
                        </button>
                        <button className="secondary-button" type="button" onClick={onCancel}>
                          <X size={15} />
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <DisclosureSection title="Advanced CLAP Settings" description="Model, cache, sampling, and overwrite behavior">
                  <div className="grid gap-4">
                    <label className="grid gap-2 text-sm text-neutral-200">
                      <span className="text-xs uppercase text-muted">Model ID</span>
                      <input
                        className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                        value={clapModelId}
                        onChange={(event) => setClapModelId(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-neutral-200">
                      <span className="text-xs uppercase text-muted">Model Cache Directory</span>
                      <input
                        className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                        value={clapCacheDir}
                        onChange={(event) => setClapCacheDir(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-neutral-200">
                      <span className="text-xs uppercase text-muted">
                        Song Samples {clapSamplesPerTrack} x {clapStatus?.sample_window_seconds ?? 10}s
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={clapStatus?.max_samples_per_track ?? 8}
                        step={1}
                        value={clapSamplesPerTrack}
                        onChange={(event) => setClapSamplesPerTrack(Number(event.target.value))}
                        className="accent-ember"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-neutral-200">
                      <span className="text-xs uppercase text-muted">Batch Size {clapBatchSize}</span>
                      <input
                        type="range"
                        min={1}
                        max={clapStatus?.max_batch_size ?? 16}
                        step={1}
                        value={clapBatchSize}
                        onChange={(event) => setClapBatchSize(Number(event.target.value))}
                        className="accent-moss"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <NumberField
                        label="Analysis Limit"
                        min={0}
                        max={100000}
                        value={audioAnalysisLimit}
                        onChange={setAudioAnalysisLimit}
                      />
                      <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2 text-sm">
                        <span className="text-muted">Only missing</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-moss"
                          checked={audioAnalysisOnlyMissing}
                          onChange={(event) => setAudioAnalysisOnlyMissing(event.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2 text-sm">
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
                    </div>
                    <div className="rounded border border-line/70 bg-ink p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-xs uppercase text-muted">CLAP Log</div>
                        <button
                          className="secondary-button h-8"
                          type="button"
                          disabled={!clapLogText}
                          onClick={() => void copyClapLog()}
                        >
                          <Copy size={14} />
                          {clapLogCopied ? "Copied" : "Copy Log"}
                        </button>
                      </div>
                      <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded border border-line/60 bg-panel p-3 font-mono text-[11px] leading-5 text-muted">
                        {clapLogText || "No CLAP log entries yet."}
                      </pre>
                    </div>
                  </div>
                </DisclosureSection>
              </div>
            </section>

            <section className="rounded border border-line bg-panel p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Progress</div>
                <div className="text-xs uppercase text-muted">{activeProgress?.phase ?? activeProgress?.status ?? "idle"}</div>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>
                  {(activeProgress?.processed_tracks ?? displayCoverage?.analyzed_tracks ?? 0).toLocaleString()} of{" "}
                  {(activeProgress?.total_tracks ?? displayCoverage?.total_tracks ?? 0).toLocaleString()}
                </span>
                <span>ETA {formatTime(activeProgress?.eta_seconds)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-ink">
                <div className="h-full rounded bg-ember transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <div className="font-semibold text-moss">{(activeProgress?.analyzed ?? displayCoverage?.analyzed_tracks ?? 0).toLocaleString()}</div>
                  <div className="text-muted">Analyzed</div>
                </div>
                <div>
                  <div className="font-semibold text-red-300">{(activeProgress?.skipped ?? displayCoverage?.failed_tracks ?? 0).toLocaleString()}</div>
                  <div className="text-muted">Skipped</div>
                </div>
                <div>
                  <div className="font-semibold text-white">{progressPercent.toFixed(0)}%</div>
                  <div className="text-muted">Progress</div>
                </div>
              </div>
              {activeProgress?.current_track && (
                <div className="mt-3 truncate text-xs text-neutral-300">{activeProgress.current_track}</div>
              )}
              {activeProgress?.model_cached_at_start === false && (
                <div className="mt-3 rounded border border-ember/30 bg-ember/10 px-3 py-2 text-xs text-ember">
                  First model load may take several minutes.
                </div>
              )}
              {failures.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs uppercase text-muted">Recent Failures</div>
                  <div className="grid max-h-52 gap-2 overflow-auto pr-1">
                    {failures.slice(-8).map((failure, index) => (
                      <div key={`${failure.track_id ?? failure.path}-${index}`} className="rounded border border-line/70 bg-ink p-2 text-xs">
                        <div className="truncate text-white">{failure.title ?? fileName(failure.path)}</div>
                        <div className="mt-1 line-clamp-2 text-red-200">{failure.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
      {installPromptOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded border border-line bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Install CLAP Analysis</h2>
                <p className="mt-1 text-sm text-muted">
                  Choose the Torch build for the app-managed ML runtime.
                </p>
              </div>
              <button className="icon-button" type="button" title="Close" onClick={() => setInstallPromptOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="rounded border border-line bg-ink p-4 text-left transition hover:border-moss/70"
                type="button"
                onClick={() => {
                  setInstallPromptOpen(false);
                  onInstallClap("cpu", clapReady);
                }}
              >
                <div className="font-semibold text-white">{clapReady ? "Use CPU Runtime" : "CPU"}</div>
                <div className="mt-1 text-xs text-muted">Smaller, most compatible, good for background analysis.</div>
                <div className="mt-2 text-xs text-muted">{CLAP_RUNTIME_SIZE_HINTS.cpu}</div>
                <div className="mt-1 text-[11px] text-muted">Model cache downloads separately on first analysis.</div>
              </button>
              <button
                className="rounded border border-line bg-ink p-4 text-left transition hover:border-moss/70"
                type="button"
                onClick={() => {
                  setInstallPromptOpen(false);
                  onInstallClap("cuda", clapReady);
                }}
              >
                <div className="font-semibold text-white">{clapReady ? "Use NVIDIA CUDA" : "NVIDIA CUDA"}</div>
                <div className="mt-1 text-xs text-muted">Larger download, faster analysis on supported NVIDIA GPUs.</div>
                <div className="mt-2 text-xs text-muted">{CLAP_RUNTIME_SIZE_HINTS.cuda}</div>
                <div className="mt-1 text-[11px] text-muted">Model cache downloads separately on first analysis.</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
