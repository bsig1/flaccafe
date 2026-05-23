import {
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
} from "react";

import type {
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  ClapInstallDevice,
  ClapInstallProgress,
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
} from "../shared";

export function AnalysisPage({
  clapStatus,
  coverage,
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
  clapMaxDuration,
  setClapMaxDuration,
  installProgress,
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
  clapMaxDuration: number;
  setClapMaxDuration: (value: number) => void;
  installProgress: ClapInstallProgress | null;
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
  const clapReady = Boolean(clapStatus?.installed);
  const clapStatusLoaded = Boolean(clapStatus);
  const showRuntimeInstall = clapStatusLoaded;
  const progressPercent = Math.max(0, Math.min(100, progress?.percent ?? coverage?.coverage_percent ?? 0));
  const installPercent = Math.max(0, Math.min(100, installProgress?.percent ?? 0));
  const failures = progress?.failed_tracks ?? [];
  const statusText = installProgress?.message ?? progress?.message ?? clapStatus?.message ?? "CLAP status loading";
  const activeJob = Boolean(progress && !isAnalysisTerminal(progress.status));
  const canPause = isAudioAnalyzing && progress?.status === "running";
  const canResume = isAudioAnalyzing && progress?.status === "paused";
  const torchRuntime = clapStatus?.torch_device
    ? `${clapStatus.torch_device.toUpperCase()}${clapStatus.cuda_device_name ? ` - ${clapStatus.cuda_device_name}` : ""}`
    : "Not installed";
  const runtimeActionLabel = clapReady ? "Change Runtime" : "Install CLAP";

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
              className={`rounded border px-2 py-1 text-xs uppercase ${
                clapReady && Object.keys(clapStatus.dependency_errors ?? {}).length === 0
                  ? "border-moss/40 bg-moss/10 text-moss"
                  : "border-ember/50 bg-ember/10 text-ember"
              }`}
            >
              {clapReady ? "analysis ok" : "runtime issue"}
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

      <section className="min-h-0 flex-1 overflow-auto p-6">
        <div className="grid max-w-6xl gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Coverage</div>
              <div className="mt-1 text-2xl font-semibold text-white">{formatPercent(coverage?.coverage_percent)}</div>
              <div className="mt-1 text-xs text-muted">
                {(coverage?.analyzed_tracks ?? 0).toLocaleString()} of {(coverage?.total_tracks ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Unanalyzed</div>
              <div className="mt-1 text-2xl font-semibold text-ember">
                {(coverage?.unanalyzed_tracks ?? 0).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted">Tracks without CLAP embeddings</div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Failures</div>
              <div className="mt-1 text-2xl font-semibold text-red-300">
                {(coverage?.failed_tracks ?? 0).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted">Marked for retry</div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Model</div>
              <div className={`mt-1 text-sm font-semibold ${clapReady && clapStatus?.model_cached ? "text-moss" : "text-ember"}`}>
                {!clapStatusLoaded ? "Checking" : !clapReady ? "Optional" : clapStatus?.model_cached ? "Cached" : "Needs download"}
              </div>
              <div className="mt-1 truncate text-xs text-muted">{torchRuntime}</div>
            </div>
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
                    Analyze missing tracks in the background, then AutoDJ can blend metadata, ratings, and song similarity.
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
                <DisclosureSection title="Advanced CLAP Settings" description="Model, cache, per-track duration, and overwrite behavior">
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
                      <span className="text-xs uppercase text-muted">Seconds Per Track {clapMaxDuration.toFixed(0)}</span>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={5}
                        value={clapMaxDuration}
                        onChange={(event) => setClapMaxDuration(Number(event.target.value))}
                        className="accent-ember"
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
                  </div>
                </DisclosureSection>
              </div>
            </section>

            <section className="rounded border border-line bg-panel p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Progress</div>
                <div className="text-xs uppercase text-muted">{progress?.phase ?? progress?.status ?? "idle"}</div>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>
                  {(progress?.processed_tracks ?? coverage?.analyzed_tracks ?? 0).toLocaleString()} of{" "}
                  {(progress?.total_tracks ?? coverage?.total_tracks ?? 0).toLocaleString()}
                </span>
                <span>ETA {formatTime(progress?.eta_seconds)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-ink">
                <div className="h-full rounded bg-ember transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <div className="font-semibold text-moss">{(progress?.analyzed ?? coverage?.analyzed_tracks ?? 0).toLocaleString()}</div>
                  <div className="text-muted">Analyzed</div>
                </div>
                <div>
                  <div className="font-semibold text-red-300">{(progress?.skipped ?? coverage?.failed_tracks ?? 0).toLocaleString()}</div>
                  <div className="text-muted">Skipped</div>
                </div>
                <div>
                  <div className="font-semibold text-white">{progressPercent.toFixed(0)}%</div>
                  <div className="text-muted">Progress</div>
                </div>
              </div>
              {progress?.current_track && (
                <div className="mt-3 truncate text-xs text-neutral-300">{progress.current_track}</div>
              )}
              {progress?.model_cached_at_start === false && (
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
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
