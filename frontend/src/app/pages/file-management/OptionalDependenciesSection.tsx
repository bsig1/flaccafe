import {
Bot,
CheckCircle2,
Download,
ExternalLink,
FolderOpen,
RefreshCw,
Wrench,
} from "lucide-react";
import type {
ReactNode,
} from "react";
import {
useState,
} from "react";

import type {
AudioConversionInstallProgress,
AudioConversionSetupResponse,
ClapInstallDevice,
ClapInstallProgress,
ClapStatusResponse,
} from "../../../types/api";
import {
DisclosureSection,
} from "../../components/common";

const CLAP_RUNTIME_SIZE_HINTS = {
  cpu: "CPU runtime: about 1-2 GB installed, plus roughly 600 MB for the model cache",
  cuda: "NVIDIA CUDA runtime: about 5-7 GB installed, plus roughly 600 MB for the model cache",
} satisfies Record<ClapInstallDevice, string>;

const OPTIONAL_DEPENDENCY_SIZE_HINTS = {
  ffmpeg: "Approx size: 105 MB download, about 300 MB installed",
};

const FFMPEG_SOURCE_URL = "https://www.gyan.dev/ffmpeg/builds/";

function formatBytes(value: number | null | undefined) {
  if (!value || value <= 0) {
    return "0 MB";
  }
  if (value >= 1_073_741_824) {
    return `${(value / 1_073_741_824).toFixed(1)} GB`;
  }
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function dependencyTone(ready: boolean) {
  return ready
    ? "border-moss/40 bg-moss/10 text-moss"
    : "border-ember/40 bg-ember/10 text-ember";
}

function DependencyCard({
  icon,
  title,
  status,
  ready,
  note = "Optional, installed only when you choose it.",
  children,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  ready: boolean;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded border border-line bg-ink p-4">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded border border-line bg-panel text-neutral-200">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
            <div className="mt-1 text-xs text-muted">{note}</div>
          </div>
        </div>
        <span className={`shrink-0 rounded border px-2 py-1 text-[11px] uppercase ${dependencyTone(ready)}`}>
          {status}
        </span>
      </div>
      {children}
    </section>
  );
}

async function openExternal(url: string, setStatus: (message: string) => void) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external_url", { url });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Open this link from the desktop app.");
  }
}

async function revealFolder(path: string | null | undefined, setStatus: (message: string) => void) {
  if (!path) {
    setStatus("No dependency folder is available yet.");
    return;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("reveal_in_file_explorer", { path });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Reveal in Explorer is available in the desktop app.");
  }
}

export function OptionalDependenciesSection({
  audioConversionSetup,
  audioConversionInstallProgress,
  clapStatus,
  clapInstallProgress,
  isClapInstalling,
  defaultOpen,
  openSignal,
  onRefreshAudioConversionSetup,
  onInstallAudioConversionFfmpeg,
  onRefreshClapStatus,
  onInstallClap,
  setStatus,
}: {
  audioConversionSetup: AudioConversionSetupResponse | null;
  audioConversionInstallProgress: AudioConversionInstallProgress | null;
  clapStatus: ClapStatusResponse | null;
  clapInstallProgress: ClapInstallProgress | null;
  isClapInstalling: boolean;
  defaultOpen?: boolean;
  openSignal?: string;
  onRefreshAudioConversionSetup: () => void | Promise<void>;
  onInstallAudioConversionFfmpeg: () => void | Promise<void>;
  onRefreshClapStatus: () => void | Promise<void>;
  onInstallClap: (device: ClapInstallDevice, force?: boolean) => void | Promise<void>;
  setStatus: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const clapReady = Boolean(clapStatus?.installed);
  const ffmpegReady = Boolean(audioConversionSetup?.available);
  const ffmpegInstalling = Boolean(audioConversionInstallProgress && !["completed", "failed"].includes(audioConversionInstallProgress.status));
  const ffmpegInstallPercent = Math.max(0, Math.min(100, audioConversionInstallProgress?.percent ?? 0));
  const installPercent = Math.max(0, Math.min(100, clapInstallProgress?.percent ?? 0));

  async function refreshAll() {
    setBusy(true);
    try {
      await Promise.all([
        onRefreshClapStatus(),
        onRefreshAudioConversionSetup(),
      ]);
      setStatus("Optional dependency status refreshed");
    } finally {
      setBusy(false);
    }
  }

  function installClapRuntime(device: ClapInstallDevice) {
    const label = device === "cuda" ? "NVIDIA CUDA" : "CPU";
    const sizeHint = CLAP_RUNTIME_SIZE_HINTS[device].toLowerCase();
    const action = clapReady ? "switch/reinstall" : "install";
    if (!window.confirm(`Download and ${action} the ${label} CLAP runtime? ${sizeHint}.`)) {
      return;
    }
    void onInstallClap(device, clapReady);
  }

  return (
    <DisclosureSection
      title="Optional Dependencies"
      description="Install and inspect large optional runtimes"
      defaultOpen={defaultOpen}
      openSignal={openSignal}
    >
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-ink px-3 py-2 text-xs">
          <div className="min-w-0">
            <div className="font-medium text-white">Dependency status</div>
            <div className="mt-1 text-muted">
              These are the pieces FLAC Cafe does not bundle because they are large or vary by machine.
            </div>
          </div>
          <button className="secondary-button h-8" type="button" disabled={busy} onClick={() => void refreshAll()}>
            <RefreshCw size={14} />
            Refresh All
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <DependencyCard icon={<Bot size={18} />} title="ML Runtime (CLAP)" status={clapReady ? "Ready" : "Not installed"} ready={clapReady}>
            <p className="text-xs leading-5 text-muted">
              Enables audio embeddings, similarity-aware AutoDJ, mood vectors, and CLAP genre previews. It is large, separate from the base app, and can be CPU or NVIDIA CUDA.
            </p>
            <div className="mt-3 rounded border border-line/70 bg-panel px-3 py-2 text-xs">
              <div className="truncate text-neutral-200">{clapStatus?.message ?? "CLAP status not loaded"}</div>
              <div className="mt-1 truncate text-muted">{clapStatus?.runtime_dir ?? "Managed runtime folder will be created on install"}</div>
              {clapStatus?.torch_version && <div className="mt-1 truncate text-muted">Torch {clapStatus.torch_version}</div>}
            </div>
            {clapInstallProgress && (
              <div className="mt-3 rounded border border-line/70 bg-panel p-3 text-xs">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="truncate text-neutral-200">{clapInstallProgress.message ?? "Installing CLAP runtime"}</span>
                  <span className="text-muted">{installPercent.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-ink">
                  <div className="h-full rounded bg-moss transition-all duration-300" style={{ width: `${installPercent}%` }} />
                </div>
              </div>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button className="secondary-button h-9" type="button" disabled={isClapInstalling || clapStatus?.install_supported === false} onClick={() => installClapRuntime("cpu")}>
                <Download size={14} />
                {clapReady ? "Use CPU" : "Install CPU"}
              </button>
              <button className="secondary-button h-9" type="button" disabled={isClapInstalling || clapStatus?.install_supported === false} onClick={() => installClapRuntime("cuda")}>
                <Download size={14} />
                {clapReady ? "Use CUDA" : "Install CUDA"}
              </button>
            </div>
            <div className="mt-2 grid gap-1 text-[11px] text-muted">
              <div>{CLAP_RUNTIME_SIZE_HINTS.cpu}</div>
              <div>{CLAP_RUNTIME_SIZE_HINTS.cuda}</div>
            </div>
          </DependencyCard>

          <DependencyCard icon={<Wrench size={18} />} title="FFmpeg" status={ffmpegInstalling ? "Installing" : ffmpegReady ? "Ready" : "Not installed"} ready={ffmpegReady}>
            <p className="text-xs leading-5 text-muted">
              Enables audio conversion, volume tag analysis, playback diagnostics, and FLAC/MP3 encoding for ripped CDs.
            </p>
            <div className="mt-3 rounded border border-line/70 bg-panel px-3 py-2 text-xs">
              <div className="truncate text-neutral-200">{audioConversionSetup?.message ?? "FFmpeg status not loaded"}</div>
              <div className="mt-1 truncate text-muted">{audioConversionSetup?.resolved_path ?? audioConversionSetup?.tool_directory ?? "No local FFmpeg path"}</div>
              {audioConversionSetup?.version && <div className="mt-1 truncate text-muted">{audioConversionSetup.version}</div>}
            </div>
            {audioConversionInstallProgress && (
              <div className="mt-3 rounded border border-line/70 bg-panel p-3 text-xs">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="truncate text-neutral-200">{audioConversionInstallProgress.message || "Installing FFmpeg"}</span>
                  <span className="text-muted">{ffmpegInstallPercent.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-ink">
                  <div className="h-full rounded bg-moss transition-all duration-300" style={{ width: `${ffmpegInstallPercent}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
                  <span>
                    Step {audioConversionInstallProgress.current_step.toLocaleString()} / {audioConversionInstallProgress.total_steps.toLocaleString()}
                  </span>
                  {audioConversionInstallProgress.total_bytes ? (
                    <span>
                      {formatBytes(audioConversionInstallProgress.bytes_downloaded)} / {formatBytes(audioConversionInstallProgress.total_bytes)}
                    </span>
                  ) : audioConversionInstallProgress.bytes_downloaded > 0 ? (
                    <span>{formatBytes(audioConversionInstallProgress.bytes_downloaded)} downloaded</span>
                  ) : null}
                </div>
                {audioConversionInstallProgress.error && (
                  <div className="mt-2 truncate text-ember" title={audioConversionInstallProgress.error}>
                    {audioConversionInstallProgress.error}
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="primary-button h-9" type="button" disabled={ffmpegInstalling} onClick={() => void onInstallAudioConversionFfmpeg()}>
                <Download size={14} />
                {ffmpegInstalling ? "Installing" : "Install FFmpeg"}
              </button>
              <button className="secondary-button h-9" type="button" disabled={ffmpegInstalling} onClick={() => void onRefreshAudioConversionSetup()}>
                <RefreshCw size={14} />
                Check
              </button>
              <button className="secondary-button h-9" type="button" onClick={() => void openExternal(FFMPEG_SOURCE_URL, setStatus)}>
                <ExternalLink size={14} />
                Source
              </button>
              <button className="secondary-button h-9" type="button" onClick={() => void revealFolder(audioConversionSetup?.tool_directory, setStatus)}>
                <FolderOpen size={14} />
                Folder
              </button>
            </div>
            <div className="mt-2 text-[11px] text-muted">{OPTIONAL_DEPENDENCY_SIZE_HINTS.ffmpeg}</div>
          </DependencyCard>

        </div>

        <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
          <div className="flex items-center gap-2 text-neutral-200">
            <CheckCircle2 size={14} />
            Safe default
          </div>
          <p className="mt-1 leading-5">
            The base app remains usable without these optional dependencies. Installers write into FLAC Cafe-managed folders and do not modify your music files.
          </p>
        </div>
      </div>
    </DisclosureSection>
  );
}
