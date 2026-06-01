import {
ArrowUp,
ChevronDown,
FolderOpen,
Library,
ListMusic,
Play,
RefreshCw,
RotateCcw,
SlidersHorizontal,
SkipBack,
SkipForward,
} from "lucide-react";
import type {
CSSProperties,
} from "react";
import {
useState,
} from "react";

import type {
desktopAudioDevice,
desktopOutputBackend,
PlaybackDiagnostic,
PlaybackDiagnosticsResponse,
} from "../../../lib/desktopPlayback";
import {
summarizePlaybackDiagnostics,
} from "../../../lib/desktopPlayback";
import type {
BulkLyricsProgress,
BulkLyricsSaveLocation,
Track,
} from "../../../types/api";
import {
DisclosureSection
} from "../../components/common";
import {
EQUALIZER_GAIN_MAX_DB,
EQUALIZER_GAIN_MIN_DB,
EQUALIZER_PREAMP_MAX_DB,
EQUALIZER_PREAMP_MIN_DB,
EqualizerBandMode,
crossfadeProfileDurations,
crossfadeProfileLabels,
equalizerFrequenciesForMode,
equalizerPresets,
formatEqFrequency,
miniPlayerLayoutLabels,
miniPlayerPreferencePatch,
miniPlayerPresetFromPreferences,
miniPlayerSizeForPreset,
normalizeEqualizerGains,
REPLAYGAIN_TARGET_MAX_PERCENT,
REPLAYGAIN_TARGET_MIN_PERCENT,
replayGainTargetDescription,
themeMiniPlayerPreset,
UiPreferences,
} from "../../shared";
import { BulkLyricsLookupCard } from "./BulkLyricsLookupCard";

export const BUFFER_OPTIONS = [
  { value: 0, label: "Device default" },
  { value: 512, label: "Low latency 512" },
  { value: 1024, label: "Balanced 1024" },
  { value: 2048, label: "Stable 2048" },
  { value: 4096, label: "Very stable 4096" },
];

const CODEC_SUPPORT = [
  { label: "MP3", support: "supported", detail: "Symphonia MP3 decoder" },
  { label: "FLAC", support: "supported", detail: "Symphonia FLAC decoder" },
  { label: "WAV", support: "supported", detail: "PCM / WAV container" },
  { label: "AIFF", support: "supported", detail: "AIFF container" },
  { label: "Ogg Vorbis", support: "supported", detail: "Vorbis in Ogg" },
  { label: "Opus", support: "supported", detail: "Opus in Ogg" },
  { label: "M4A / AAC", support: "supported", detail: "AAC / MP4 via Symphonia" },
];

function MiniPlayerSettingsPreview({
  preset,
  currentTrack,
  queue,
}: {
  preset: ReturnType<typeof miniPlayerPresetFromPreferences>;
  currentTrack: Track | null;
  queue: Track[];
}) {
  const [queuePreviewOpen, setQueuePreviewOpen] = useState(false);
  const compactLayout = preset.layout === "compact";
  const title = currentTrack?.title?.trim() || "Nothing playing";
  const artist = currentTrack?.artist?.trim() || "Unknown artist";
  const album = currentTrack?.album?.trim() || "Unknown album";
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "FC";
  const queueRows = (queue.length ? queue : currentTrack ? [currentTrack] : []).slice(0, 5);
  const art = preset.showArt && (
    <div className={`grid shrink-0 place-items-center border border-white/10 bg-[rgb(var(--color-mini-panel))] text-moss ${
      compactLayout ? "h-10 w-10 rounded-md" : "h-14 w-14 rounded-lg"
    }`}>
      <span className={compactLayout ? "text-sm" : "text-lg"}>{initials}</span>
    </div>
  );
  const controls = preset.showMediaControls ? (
    <div className="flex items-center gap-1">
      <div className={`grid place-items-center rounded text-muted ${compactLayout ? "h-6 w-6" : "h-7 w-7"}`}><SkipBack size={compactLayout ? 12 : 13} /></div>
      <div className={`grid place-items-center rounded-full bg-ember text-ink ${compactLayout ? "h-7 w-7" : "h-8 w-8"}`}><Play size={compactLayout ? 13 : 14} fill="currentColor" /></div>
      <div className={`grid place-items-center rounded text-muted ${compactLayout ? "h-6 w-6" : "h-7 w-7"}`}><SkipForward size={compactLayout ? 12 : 13} /></div>
    </div>
  ) : null;
  const utilityIcons = (preset.showLibraryButton || preset.showAlwaysOnTopButton) && (
    <div className="flex items-center gap-1 text-muted">
      {preset.showAlwaysOnTopButton && <ArrowUp size={13} />}
      {preset.showLibraryButton && <Library size={13} />}
    </div>
  );
  const queueRowsVisible = preset.showQueue && queuePreviewOpen;
  const previewSize = miniPlayerSizeForPreset(preset, queueRowsVisible);
  const previewWidth = Math.min(360, Math.max(216, Math.round(previewSize.width * 0.68)));
  const previewBodyHeight = Math.max(
    compactLayout ? 68 : 86,
    Math.round((previewSize.height - (preset.showQueue ? 32 : 0)) * 0.74),
  );
  const progressPreview = preset.showPlaybar ? (
    <div
      className={`${compactLayout ? "mt-1.5 gap-1.5 text-[9px]" : "mt-2 gap-2 text-[10px]"} grid w-full min-w-0 items-center text-muted ${
        preset.showPlaytimeNumbers ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)]"
      }`}
    >
      {preset.showPlaytimeNumbers && <span>1:12</span>}
      <div className="h-1 min-w-0 rounded-full bg-white/15"><div className="h-full w-1/2 rounded-full bg-moss" /></div>
      {preset.showPlaytimeNumbers && <span>3:44</span>}
    </div>
  ) : null;
  const queuePreview = preset.showQueue && (
    <div className="border-t border-white/10">
      <button
        className="flex h-8 w-full items-center justify-between px-3 text-[11px] text-muted transition hover:bg-white/5 hover:text-white"
        type="button"
        onClick={() => setQueuePreviewOpen((current) => !current)}
      >
        <span className="inline-flex items-center gap-1.5">
          <ListMusic size={12} />
          Queue
        </span>
        <span className="inline-flex items-center gap-1">
          {Math.max(queueRows.length, queue.length || 0)}
          <ChevronDown className={`transition ${queuePreviewOpen ? "rotate-180" : ""}`} size={12} />
        </span>
      </button>
      {queueRowsVisible && (
        <div className="scrollbar-hidden grid max-h-[92px] gap-1 overflow-y-auto px-2 pb-2">
          {queueRows.map((track, index) => (
            <div
              key={`${track.id}-${index}`}
              className={`grid grid-cols-[1fr_auto] gap-2 rounded px-2 py-1 text-[10px] ${
                index === 0 ? "bg-moss/15 text-white" : "text-muted"
              }`}
            >
              <span className="truncate">{track.title || "Untitled"}</span>
              <span className="truncate opacity-75">{track.artist || "Unknown"}</span>
            </div>
          ))}
          {queueRows.length === 0 && <div className="rounded px-2 py-3 text-center text-[10px] text-muted">Queue empty</div>}
        </div>
      )}
    </div>
  );
  const previewContentClass =
    preset.layout === "artwork"
      ? "grid grid-rows-[1fr_auto]"
      : compactLayout
        ? preset.showArt
          ? "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-2"
          : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2"
        : "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3";
  return (
    <div className="grid gap-2">
      <div
        className="overflow-hidden rounded border border-white/10 bg-[rgb(var(--color-quiet))] text-white shadow-lg"
        style={{ opacity: preset.opacity, width: previewWidth } as CSSProperties}
      >
        <div className={previewContentClass} style={{ minHeight: previewBodyHeight } as CSSProperties}>
          {preset.layout === "artwork" ? (
            <>
              <div className="grid min-h-[118px] place-items-end bg-[rgb(var(--color-mini-panel))] p-3">
                <div className="w-full min-w-0 rounded bg-black/45 p-2">
                  <div className="truncate text-sm font-semibold">{title}</div>
                  <div className="truncate text-xs text-muted">{preset.showAlbumName ? `${artist} - ${album}` : artist}</div>
                  {progressPreview}
                </div>
              </div>
              <div className={`flex items-center px-3 py-2 ${controls ? "justify-between" : "justify-end"}`}>
                {controls}
                {utilityIcons}
              </div>
            </>
          ) : (
            <>
              {art}
              <div className="min-w-0">
                <div className={`truncate font-semibold ${compactLayout ? "text-xs" : "text-sm"}`}>{title}</div>
                <div className="truncate text-xs text-muted">{preset.showAlbumName ? `${artist} - ${album}` : artist}</div>
                {progressPreview}
              </div>
              <div className={`grid justify-items-end ${compactLayout ? "gap-1" : "gap-2"}`}>
                {utilityIcons}
                {controls}
              </div>
            </>
          )}
        </div>
        {queuePreview}
      </div>
      <div className="text-xs text-muted">
        {miniPlayerLayoutLabels[preset.layout]} - Native frame - {(preset.opacity * 100).toFixed(0)}% opacity
      </div>
    </div>
  );
}

function formatDesktopDiagnosticTime(timestampMs: number): string {
  if (!timestampMs) {
    return "unknown time";
  }
  return new Date(timestampMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function desktopDiagnosticContext(entry: PlaybackDiagnostic): string {
  return [
    entry.device_name,
    entry.sample_rate ? `${entry.sample_rate} Hz` : null,
    entry.channel_count ? `${entry.channel_count} ch` : null,
    entry.sample_format,
    entry.buffer_frames ? `${entry.buffer_frames} frames` : null,
    entry.path,
  ]
    .filter(Boolean)
    .join(" - ");
}

export function PlayerSettingsSection({
  uiPreferences,
  setUiPreferences,
  desktopDevices,
  desktopBackends,
  desktopDeviceMessage,
  onRefreshDesktopDevices,
  desktopDiagnostics,
  desktopDiagnosticsMessage,
  onRefreshDesktopDiagnostics,
  onClearDesktopDiagnostics,
  currentTrack,
  playbackQueue,
  autoWriteFetchedLyricsSidecars,
  onAutoWriteFetchedLyricsSidecarsChange,
  bulkLyricsProgress,
  bulkLyricsOnlyMissing,
  bulkLyricsLimit,
  bulkLyricsSaveLocation,
  isStartingBulkLyrics,
  onOpenLyricsFolder,
  onBulkLyricsOnlyMissingChange,
  onBulkLyricsLimitChange,
  onBulkLyricsSaveLocationChange,
  onStartBulkLyrics,
  onCancelBulkLyrics,
}: {
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
  desktopDevices: desktopAudioDevice[];
  desktopBackends: desktopOutputBackend[];
  desktopDeviceMessage: string | null;
  onRefreshDesktopDevices: () => void | Promise<void>;
  desktopDiagnostics: PlaybackDiagnosticsResponse | null;
  desktopDiagnosticsMessage: string | null;
  onRefreshDesktopDiagnostics: () => void | Promise<void>;
  onClearDesktopDiagnostics: () => void | Promise<void>;
  currentTrack: Track | null;
  playbackQueue: Track[];
  autoWriteFetchedLyricsSidecars: boolean;
  onAutoWriteFetchedLyricsSidecarsChange: (value: boolean) => void;
  bulkLyricsProgress: BulkLyricsProgress | null;
  bulkLyricsOnlyMissing: boolean;
  bulkLyricsLimit: string;
  bulkLyricsSaveLocation: BulkLyricsSaveLocation;
  isStartingBulkLyrics: boolean;
  onOpenLyricsFolder: () => void;
  onBulkLyricsOnlyMissingChange: (value: boolean) => void;
  onBulkLyricsLimitChange: (value: string) => void;
  onBulkLyricsSaveLocationChange: (value: BulkLyricsSaveLocation) => void;
  onStartBulkLyrics: () => void;
  onCancelBulkLyrics: () => void;
}) {
  const equalizerFrequencies = equalizerFrequenciesForMode(uiPreferences.equalizerBandMode);
  const equalizerGains = normalizeEqualizerGains(uiPreferences.equalizerGains, uiPreferences.equalizerBandMode);
  const recentDesktopDiagnostics = desktopDiagnostics?.entries.slice(-5).reverse() ?? [];
  const selectedDesktopBackend =
    desktopBackends.find((backend) => backend.id === uiPreferences.desktopOutputBackend)
    ?? desktopBackends.find((backend) => backend.id === "cpalShared")
    ?? desktopBackends[0]
    ?? null;
  const hasExclusiveDesktopBackend = desktopBackends.some((backend) => backend.exclusive);
  const selectedDesktopBackendId = selectedDesktopBackend?.id ?? uiPreferences.desktopOutputBackend;
  const miniPlayerPreset = miniPlayerPresetFromPreferences(uiPreferences);
  const currentThemeMiniPlayerPreset = themeMiniPlayerPreset(uiPreferences.themeAccent);
  const miniPlayerOpacityPercent = Math.round(miniPlayerPreset.opacity * 100);
  const crossfadeContextControls = [
    { label: "Manual skip", profileKey: "crossfadeManualProfile", msKey: "crossfadeManualMs", hint: "Next, previous, queue clicks, and external track requests." },
    { label: "Natural end", profileKey: "crossfadeNaturalProfile", msKey: "crossfadeNaturalMs", hint: "Automatic transition when a normal queue track reaches the end." },
    { label: "Album playback", profileKey: "crossfadeAlbumProfile", msKey: "crossfadeAlbumMs", hint: "Overrides natural/manual fades when adjacent tracks are from the same album." },
    { label: "Radio", profileKey: "crossfadeRadioProfile", msKey: "crossfadeRadioMs", hint: "Fade-in and fade-out for live streams." },
  ] as const;

  function updateEqualizerGain(index: number, value: number) {
    setUiPreferences((current) => {
      const gains = normalizeEqualizerGains(current.equalizerGains, current.equalizerBandMode);
      gains[index] = value;
      return { ...current, equalizerGains: gains };
    });
  }

  function setEqualizerBandMode(mode: EqualizerBandMode) {
    setUiPreferences((current) => ({
      ...current,
      equalizerBandMode: mode,
      equalizerGains: normalizeEqualizerGains(current.equalizerGains, mode),
    }));
  }

  function applyEqualizerPreset(presetKey: string) {
    const preset = equalizerPresets[presetKey];
    if (!preset) {
      return;
    }
    setUiPreferences((current) => ({
      ...current,
      equalizerEnabled: true,
      equalizerGains: normalizeEqualizerGains(
        current.equalizerBandMode === "15" ? preset.gains15 ?? preset.gains10 : preset.gains10,
        current.equalizerBandMode,
      ),
      equalizerPreampDb: preset.preampDb ?? 0,
    }));
  }

  function resetEqualizer() {
    setUiPreferences((current) => ({
      ...current,
      equalizerGains: normalizeEqualizerGains([], current.equalizerBandMode),
      equalizerPreampDb: 0,
    }));
  }

  return (
    <>
    <DisclosureSection title="Playback Engine" description="Output engine, Rust devices, diagnostics, and codec checks">
      <div className="grid gap-3 text-sm text-neutral-200">
        <div className="grid gap-2 rounded border border-line/70 bg-ink p-3">
          <div className="font-medium text-white">Rust audio</div>
          <div className="text-xs text-muted">
            FLAC Cafe routes playback through the Rust engine. The WebView renders the interface only.
          </div>
        </div>
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-white">Rust output</div>
              <div className="text-xs text-muted">Used for local files, URL-backed tracks, radio streams, and CD playback.</div>
            </div>
            <button className="secondary-button h-8" type="button" onClick={() => void onRefreshDesktopDevices()}>
              <RefreshCw size={14} />
              Recheck
            </button>
          </div>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Output Backend</span>
            <select
              className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={selectedDesktopBackendId}
              onChange={(event) =>
                setUiPreferences((current) => ({
                  ...current,
                  desktopOutputBackend: event.target.value as UiPreferences["desktopOutputBackend"],
                }))
              }
            >
              {desktopBackends.map((backend) => (
                <option key={backend.id} value={backend.id}>
                  {backend.label}{backend.exclusive ? " (exclusive)" : ""}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              {selectedDesktopBackend?.message
                ?? "Backend capability information is loaded from the desktop shell."}
            </span>
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Output Device</span>
            <select
              className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={uiPreferences.desktopOutputDeviceId}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, desktopOutputDeviceId: event.target.value }))
              }
            >
              <option value="">System default</option>
              {desktopDevices.map((device) => (
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
              value={uiPreferences.desktopBufferFrames}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, desktopBufferFrames: Number(event.target.value) }))
              }
            >
              {BUFFER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              If Rust playback skips, try Stable 2048 or Very stable 4096. Larger buffers add a little latency but are safer for decoding, fading, and DSP.
            </span>
          </label>
          {desktopDeviceMessage && <div className="text-xs text-muted">{desktopDeviceMessage}</div>}
          <div className="rounded border border-line/70 bg-panel px-3 py-2 text-xs text-muted">
            {hasExclusiveDesktopBackend
              ? "Shared mode is the stable default for everyday listening. Exclusive output takes over the selected device; if it cannot open cleanly, playback falls back to shared Rust output."
              : "Shared mode is the stable default for everyday listening and lets other apps play at the same time."}
          </div>
        </div>
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-white">Rust audio diagnostics</div>
              <div className="text-xs text-muted">{summarizePlaybackDiagnostics(desktopDiagnostics)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-8 items-center gap-2 rounded border border-line bg-panel px-3 text-xs text-muted">
                <input
                  className="h-4 w-4 accent-moss"
                  type="checkbox"
                  checked={uiPreferences.showOutputDiagnosticsButton}
                  onChange={(event) =>
                    setUiPreferences((current) => ({
                      ...current,
                      showOutputDiagnosticsButton: event.target.checked,
                    }))
                  }
                />
                Player button
              </label>
              <button className="secondary-button h-8" type="button" onClick={() => void onRefreshDesktopDiagnostics()}>
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                className="secondary-button h-8"
                type="button"
                disabled={!desktopDiagnostics || (desktopDiagnostics.entries.length === 0 && desktopDiagnostics.stream_errors.length === 0)}
                onClick={() => void onClearDesktopDiagnostics()}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid gap-2 text-xs">
            <div className="grid gap-1 rounded border border-line/70 bg-panel px-3 py-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                <span>Device: {desktopDiagnostics?.device_name ?? "not opened"}</span>
                <span>Backend: {desktopDiagnostics?.output_backend ?? "not opened"}</span>
                <span>Config: {desktopDiagnostics?.sample_rate ? `${desktopDiagnostics.sample_rate} Hz` : "unknown"}</span>
                <span>{desktopDiagnostics?.channel_count ? `${desktopDiagnostics.channel_count} channels` : "channels unknown"}</span>
                <span>{desktopDiagnostics?.sample_format ?? "format unknown"}</span>
              </div>
              {desktopDiagnostics?.current_path && (
                <div className="truncate text-muted" title={desktopDiagnostics.current_path}>
                  Current: {desktopDiagnostics.current_path}
                </div>
              )}
            </div>
            {desktopDiagnosticsMessage && <div className="text-muted">{desktopDiagnosticsMessage}</div>}
            {recentDesktopDiagnostics.length > 0 ? (
              <div className="grid max-h-56 gap-1 overflow-auto pr-1">
                {recentDesktopDiagnostics.map((entry) => (
                  <div key={entry.id} className="grid gap-1 rounded border border-line/60 bg-panel px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                          entry.severity === "error"
                            ? "border-ember/50 bg-ember/10 text-ember"
                            : "border-moss/40 bg-moss/10 text-moss"
                        }`}
                      >
                        {entry.severity}
                      </span>
                      <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">
                        {entry.category}
                      </span>
                      <span className="text-muted">{formatDesktopDiagnosticTime(entry.timestamp_ms)}</span>
                      <span className="font-medium text-neutral-200">{entry.operation}</span>
                    </div>
                    <div className="text-neutral-200">{entry.message}</div>
                    {desktopDiagnosticContext(entry) && (
                      <div className="truncate text-muted" title={desktopDiagnosticContext(entry)}>
                        {desktopDiagnosticContext(entry)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded border border-line/70 bg-panel px-3 py-2 text-muted">
                No recent rodio/cpal/Symphonia failures have been recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </DisclosureSection>

    <DisclosureSection title="Mini Player" description="Detached window layout, controls, opacity, and queue preview">
      <div className="grid gap-3 text-sm text-neutral-200 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-white">Mini player appearance</div>
              <div className="text-xs text-muted">Theme entries act as presets; every setting here can be edited directly.</div>
            </div>
            <button
              className="secondary-button h-8"
              type="button"
              onClick={() =>
                setUiPreferences((current) => ({
                  ...current,
                  ...miniPlayerPreferencePatch(currentThemeMiniPlayerPreset),
                }))
              }
            >
              Apply Theme Preset
            </button>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Layout Preset</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.miniPlayerLayout}
                onChange={(event) =>
                  setUiPreferences((current) => ({
                    ...current,
                    miniPlayerLayout: event.target.value as UiPreferences["miniPlayerLayout"],
                    miniPlayerShowArt: event.target.value === "artwork" ? true : current.miniPlayerShowArt,
                  }))
                }
              >
                {Object.entries(miniPlayerLayoutLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Opacity {miniPlayerOpacityPercent}%</span>
            <input
              className="theme-slider"
              type="range"
              min={35}
              max={100}
              step={1}
              value={miniPlayerOpacityPercent}
              style={{ "--theme-slider-fill": `${((miniPlayerOpacityPercent - 35) / 65) * 100}%` } as CSSProperties}
              onChange={(event) =>
                setUiPreferences((current) => ({
                  ...current,
                  miniPlayerOpacity: Number(event.target.value) / 100,
                }))
              }
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["miniPlayerShowArt", "Artwork"],
              ["miniPlayerShowLibraryButton", "Library button"],
              ["miniPlayerShowAlwaysOnTopButton", "Always-on-top button"],
              ["miniPlayerShowMediaControls", "Media controls"],
              ["miniPlayerShowPlaybar", "Playbar"],
              ["miniPlayerShowPlaytimeNumbers", "Playtime numbers"],
              ["miniPlayerShowAlbumName", "Album name"],
              ["miniPlayerShowQueue", "Queue accordion"],
            ].map(([key, label]) => {
              const artworkLocked = key === "miniPlayerShowArt" && uiPreferences.miniPlayerLayout === "artwork";
              const playtimeLocked = key === "miniPlayerShowPlaytimeNumbers" && !uiPreferences.miniPlayerShowPlaybar;
              const disabled = artworkLocked || playtimeLocked;
              return (
                <label key={key} className={`flex items-center justify-between gap-4 rounded border border-line/70 bg-panel px-3 py-2 ${disabled ? "opacity-70" : ""}`}>
                  <span className="text-muted">{label}</span>
                  <input
                    type="checkbox"
                    checked={artworkLocked || Boolean(uiPreferences[key as keyof UiPreferences])}
                    disabled={disabled}
                    onChange={(event) =>
                      setUiPreferences((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                </label>
              );
            })}
          </div>
        </div>
        <div className="grid content-start gap-3 rounded border border-line/70 bg-ink p-3">
          <div>
            <div className="font-medium text-white">Live preview</div>
            <div className="text-xs text-muted">The detached window updates from these same preferences.</div>
          </div>
          <MiniPlayerSettingsPreview preset={miniPlayerPreset} currentTrack={currentTrack} queue={playbackQueue} />
        </div>
      </div>
    </DisclosureSection>

    <DisclosureSection title="Lyrics" description="Fetching, synced lyric cache, and follow behavior">
      <div className="grid gap-3 text-sm text-neutral-200">
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div>
            <div className="font-medium text-white">Lyric behavior</div>
            <div className="text-xs text-muted">Automatic lookup, synced line following, and sidecar LRC caching.</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
            <div>
              <div className="text-sm font-medium text-white">Cached LRC folder</div>
              <div className="text-xs text-muted">Opens the app-managed lyric sidecar cache folder.</div>
            </div>
            <button className="secondary-button h-8" type="button" onClick={onOpenLyricsFolder}>
              <FolderOpen size={14} />
              Open Folder
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-panel px-3 py-2">
              <span className="text-muted">Auto-fetch missing lyrics</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-ember"
                checked={uiPreferences.autoFetchLyrics}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, autoFetchLyrics: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-panel px-3 py-2">
              <span className="text-muted">Fetch synced LRC over plain lyrics</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-ember"
                checked={uiPreferences.autoFetchLrcWhenPlainPresent}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, autoFetchLrcWhenPlainPresent: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-panel px-3 py-2">
              <span className="text-muted">Cache fetched LRC files</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-ember"
                checked={autoWriteFetchedLyricsSidecars}
                onChange={(event) => onAutoWriteFetchedLyricsSidecarsChange(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-panel px-3 py-2">
              <span className="text-muted">Show lyric source</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-ember"
                checked={uiPreferences.nowPlayingShowLyricSource}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, nowPlayingShowLyricSource: event.target.checked }))
                }
              />
            </label>
          </div>
        </div>
        <BulkLyricsLookupCard
          bulkLyricsProgress={bulkLyricsProgress}
          bulkLyricsOnlyMissing={bulkLyricsOnlyMissing}
          bulkLyricsLimit={bulkLyricsLimit}
          bulkLyricsSaveLocation={bulkLyricsSaveLocation}
          isStartingBulkLyrics={isStartingBulkLyrics}
          onBulkLyricsOnlyMissingChange={onBulkLyricsOnlyMissingChange}
          onBulkLyricsLimitChange={onBulkLyricsLimitChange}
          onBulkLyricsSaveLocationChange={onBulkLyricsSaveLocationChange}
          onStartBulkLyrics={onStartBulkLyrics}
          onCancelBulkLyrics={onCancelBulkLyrics}
        />
      </div>
    </DisclosureSection>

    <DisclosureSection title="ReplayGain" description="Loudness normalization and clipping protection">
      <div className="grid gap-3 text-sm text-neutral-200">
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Loudness Normalization</span>
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
              <option value="track">Normalize each track</option>
              <option value="album">Normalize by album</option>
            </select>
          </label>
          <label className="grid gap-2 rounded border border-line/70 bg-panel px-3 py-2">
            <span className="text-xs uppercase text-muted">
              Target Volume {uiPreferences.replayGainTargetVolumePercent.toFixed(0)}% - {replayGainTargetDescription(uiPreferences.replayGainTargetVolumePercent)}
            </span>
            <input
              type="range"
              min={REPLAYGAIN_TARGET_MIN_PERCENT}
              max={REPLAYGAIN_TARGET_MAX_PERCENT}
              step={1}
              value={uiPreferences.replayGainTargetVolumePercent}
              disabled={uiPreferences.replayGainMode === "off"}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, replayGainTargetVolumePercent: Number(event.target.value) }))
              }
              className="accent-moss disabled:opacity-50"
            />
            <span className="text-xs text-muted">
              50% is neutral ReplayGain playback. Lower values leave more headroom; higher values make normalized tracks louder.
            </span>
          </label>
          <label className="grid gap-2 rounded border border-line/70 bg-panel px-3 py-2">
            <span className="text-xs uppercase text-muted">Fine Tune Preamp {uiPreferences.replayGainPreampDb.toFixed(1)} dB</span>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={uiPreferences.replayGainPreampDb}
              disabled={uiPreferences.replayGainMode === "off"}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, replayGainPreampDb: Number(event.target.value) }))
              }
              className="accent-moss disabled:opacity-50"
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
            Playback normalization is applied live from embedded ReplayGain tags. FLAC Cafe converts the selected target loudness into a gain offset, applies track or album gain, and leaves files without tags unchanged. Track mode evens out individual songs; album mode preserves loud and quiet moments inside an album.
          </div>
        </div>
      </div>
    </DisclosureSection>

    <DisclosureSection title="Equalizer / DSP" description="10/15-band EQ, presets, preamp, and limiter">
      <div className="grid gap-3 text-sm text-neutral-200">
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-white">
                <SlidersHorizontal size={16} />
                Equalizer / DSP
              </div>
              <div className="text-xs text-muted">Applied in the Rust playback pipeline before output.</div>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-200">
              <span>Enabled</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={uiPreferences.equalizerEnabled}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, equalizerEnabled: event.target.checked }))
                }
              />
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Bands</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={uiPreferences.equalizerBandMode}
                onChange={(event) => setEqualizerBandMode(event.target.value as EqualizerBandMode)}
              >
                <option value="10">10-band classic</option>
                <option value="15">15-band fine</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Preset</span>
              <select
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value=""
                onChange={(event) => {
                  applyEqualizerPreset(event.target.value);
                }}
              >
                <option value="">Choose preset</option>
                {Object.entries(equalizerPresets).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-button mt-6 h-9" type="button" onClick={resetEqualizer}>
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Preamp {uiPreferences.equalizerPreampDb.toFixed(1)} dB</span>
            <input
              type="range"
              min={EQUALIZER_PREAMP_MIN_DB}
              max={EQUALIZER_PREAMP_MAX_DB}
              step={0.5}
              value={uiPreferences.equalizerPreampDb}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, equalizerPreampDb: Number(event.target.value) }))
              }
              className="accent-moss"
            />
          </label>
          <div className="grid gap-2">
            {equalizerFrequencies.map((frequency, index) => (
              <label key={frequency} className="grid grid-cols-[52px_1fr_52px] items-center gap-3 text-xs">
                <span className="text-right text-muted">{formatEqFrequency(frequency)}</span>
                <input
                  type="range"
                  min={EQUALIZER_GAIN_MIN_DB}
                  max={EQUALIZER_GAIN_MAX_DB}
                  step={0.5}
                  value={equalizerGains[index] ?? 0}
                  onChange={(event) => updateEqualizerGain(index, Number(event.target.value))}
                  className="accent-moss"
                />
                <span className="tabular-nums text-neutral-200">{(equalizerGains[index] ?? 0).toFixed(1)}</span>
              </label>
            ))}
          </div>
          <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-panel px-3 py-2">
            <span className="text-muted">Limiter after EQ</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-moss"
              checked={uiPreferences.dspLimiterEnabled}
              onChange={(event) =>
                setUiPreferences((current) => ({ ...current, dspLimiterEnabled: event.target.checked }))
              }
            />
          </label>
        </div>
      </div>
    </DisclosureSection>

    <DisclosureSection title="Playback Behavior & Codecs" description="Fade, skip threshold, and Rust codec support">
      <div className="grid gap-3 text-sm text-neutral-200">
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div>
            <div className="font-medium text-white">Crossfade profiles</div>
            <div className="text-xs text-muted">Tune fades separately for skips, natural queue endings, album playback, and radio.</div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {crossfadeContextControls.map((control) => {
              const profile = uiPreferences[control.profileKey] as UiPreferences["crossfadeProfile"];
              const ms = uiPreferences[control.msKey] as number;
              return (
                <div key={control.profileKey} className="grid gap-2 rounded border border-line/70 bg-panel p-3">
                  <label className="grid gap-1">
                    <span className="text-xs uppercase text-muted">{control.label}</span>
                    <select
                      className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={profile}
                      onChange={(event) => {
                        const nextProfile = event.target.value as UiPreferences["crossfadeProfile"];
                        setUiPreferences((current) => ({
                          ...current,
                          [control.profileKey]: nextProfile,
                          [control.msKey]: nextProfile === "custom" ? current[control.msKey] : crossfadeProfileDurations[nextProfile],
                          crossfadeProfile: control.profileKey === "crossfadeManualProfile" ? nextProfile : current.crossfadeProfile,
                          playerFadeMs: control.profileKey === "crossfadeManualProfile"
                            ? nextProfile === "custom" ? current.playerFadeMs : crossfadeProfileDurations[nextProfile]
                            : current.playerFadeMs,
                        }));
                      }}
                    >
                      {Object.entries(crossfadeProfileLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Length {ms}ms</span>
                    <input
                      type="range"
                      min={0}
                      max={5000}
                      step={50}
                      value={ms}
                      onChange={(event) =>
                        setUiPreferences((current) => ({
                          ...current,
                          [control.profileKey]: "custom",
                          [control.msKey]: Number(event.target.value),
                          crossfadeProfile: control.profileKey === "crossfadeManualProfile" ? "custom" : current.crossfadeProfile,
                          playerFadeMs: control.profileKey === "crossfadeManualProfile" ? Number(event.target.value) : current.playerFadeMs,
                        }))
                      }
                      className="accent-moss"
                    />
                  </label>
                  <div className="text-xs text-muted">{control.hint}</div>
                </div>
              );
            })}
          </div>
        </div>
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
          <div>
            <div className="font-medium text-white">Rust codec support</div>
            <div className="text-xs text-muted">
              Reported from the bundled rodio + Symphonia decoder set. Playback failures are recorded in Rust audio diagnostics.
            </div>
          </div>
          <div className="grid gap-1 text-xs">
            {CODEC_SUPPORT.map((codec) => (
              <div key={codec.label} className="grid grid-cols-[110px_88px_1fr] gap-3 rounded bg-panel px-2 py-1.5">
                <span className="text-neutral-200">{codec.label}</span>
                <span className="text-moss">{codec.support}</span>
                <span className="truncate text-muted">{codec.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DisclosureSection>
    </>
  );
}
