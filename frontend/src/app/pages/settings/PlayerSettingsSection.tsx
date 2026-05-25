import {
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import type {
  NativeAudioDevice,
  NativeOutputBackend,
  NativePlaybackDiagnostic,
  NativePlaybackDiagnosticsResponse,
} from "../../../lib/nativePlayback";
import {
  summarizeNativeDiagnostics,
} from "../../../lib/nativePlayback";
import {
  DisclosureSection,
  NumberField,
} from "../../components/common";
import {
  EQUALIZER_GAIN_MAX_DB,
  EQUALIZER_GAIN_MIN_DB,
  EQUALIZER_PREAMP_MAX_DB,
  EQUALIZER_PREAMP_MIN_DB,
  EqualizerBandMode,
  REPLAYGAIN_TARGET_MAX_PERCENT,
  REPLAYGAIN_TARGET_MIN_PERCENT,
  UiPreferences,
  equalizerFrequenciesForMode,
  equalizerPresets,
  formatEqFrequency,
  normalizeEqualizerGains,
  replayGainTargetDescription,
} from "../../shared";

export interface CodecSupportRow {
  label: string;
  type: string;
  support: CanPlayTypeResult | "no";
}

export const CODEC_TESTS = [
  { label: "MP3", type: "audio/mpeg" },
  { label: "FLAC", type: "audio/flac" },
  { label: "M4A / AAC", type: "audio/mp4; codecs=\"mp4a.40.2\"" },
  { label: "Ogg Vorbis", type: "audio/ogg; codecs=\"vorbis\"" },
  { label: "Opus", type: "audio/ogg; codecs=\"opus\"" },
  { label: "WAV", type: "audio/wav" },
  { label: "AIFF", type: "audio/aiff" },
];

export const NATIVE_BUFFER_OPTIONS = [
  { value: 0, label: "Device default" },
  { value: 512, label: "Low latency 512" },
  { value: 1024, label: "Balanced 1024" },
  { value: 2048, label: "Stable 2048" },
  { value: 4096, label: "Very stable 4096" },
];

const NATIVE_CODEC_SUPPORT = [
  { label: "MP3", support: "supported", detail: "Symphonia MP3 decoder" },
  { label: "FLAC", support: "supported", detail: "Symphonia FLAC decoder" },
  { label: "WAV", support: "supported", detail: "PCM / WAV container" },
  { label: "AIFF", support: "supported", detail: "AIFF container" },
  { label: "Ogg Vorbis", support: "supported", detail: "Vorbis in Ogg" },
  { label: "Opus", support: "supported", detail: "Opus in Ogg" },
  { label: "M4A / AAC", support: "supported", detail: "AAC / MP4 via Symphonia" },
];

export function detectCodecSupport(): CodecSupportRow[] {
  if (typeof document === "undefined") {
    return [];
  }
  const audio = document.createElement("audio");
  return CODEC_TESTS.map((codec) => ({
    ...codec,
    support: audio.canPlayType(codec.type) || "no",
  }));
}

function formatNativeDiagnosticTime(timestampMs: number): string {
  if (!timestampMs) {
    return "unknown time";
  }
  return new Date(timestampMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function nativeDiagnosticContext(entry: NativePlaybackDiagnostic): string {
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
  nativeDevices,
  nativeBackends,
  nativeDeviceMessage,
  onRefreshNativeDevices,
  nativeDiagnostics,
  nativeDiagnosticsMessage,
  onRefreshNativeDiagnostics,
  onClearNativeDiagnostics,
  codecSupport,
  onRefreshCodecSupport,
  autoWriteFetchedLyricsSidecars,
  onAutoWriteFetchedLyricsSidecarsChange,
}: {
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
  nativeDevices: NativeAudioDevice[];
  nativeBackends: NativeOutputBackend[];
  nativeDeviceMessage: string | null;
  onRefreshNativeDevices: () => void | Promise<void>;
  nativeDiagnostics: NativePlaybackDiagnosticsResponse | null;
  nativeDiagnosticsMessage: string | null;
  onRefreshNativeDiagnostics: () => void | Promise<void>;
  onClearNativeDiagnostics: () => void | Promise<void>;
  codecSupport: CodecSupportRow[];
  onRefreshCodecSupport: () => void;
  autoWriteFetchedLyricsSidecars: boolean;
  onAutoWriteFetchedLyricsSidecarsChange: (value: boolean) => void;
}) {
  const equalizerFrequencies = equalizerFrequenciesForMode(uiPreferences.equalizerBandMode);
  const equalizerGains = normalizeEqualizerGains(uiPreferences.equalizerGains, uiPreferences.equalizerBandMode);
  const recentNativeDiagnostics = nativeDiagnostics?.entries.slice(-5).reverse() ?? [];

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

  const showNativeSettings = uiPreferences.playbackEngine === "native";

  return (
    <>
    <DisclosureSection title="Playback Engine" description="Output engine, native devices, diagnostics, and codec checks">
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
        {showNativeSettings && (
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-white">Native output</div>
              <div className="text-xs text-muted">Used when Playback Engine is set to Native Rust audio.</div>
            </div>
            <button className="secondary-button h-8" type="button" onClick={() => void onRefreshNativeDevices()}>
              <RefreshCw size={14} />
              Recheck
            </button>
          </div>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Native Backend</span>
            <select
              className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={uiPreferences.nativeOutputBackend}
              onChange={(event) =>
                setUiPreferences((current) => ({
                  ...current,
                  nativeOutputBackend: event.target.value as UiPreferences["nativeOutputBackend"],
                }))
              }
            >
              {nativeBackends.map((backend) => (
                <option key={backend.id} value={backend.id} disabled={!backend.available}>
                  {backend.label}{backend.exclusive ? " (exclusive)" : ""}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              {nativeBackends.find((backend) => backend.id === uiPreferences.nativeOutputBackend)?.message
                ?? "Backend capability information is loaded from the desktop shell."}
            </span>
          </label>
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
            The selector reports exclusive backends separately from the current shared-mode engine so future WASAPI/ASIO work can be enabled without changing the settings model.
          </div>
        </div>
        )}
        {showNativeSettings && (
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-white">Native diagnostics</div>
              <div className="text-xs text-muted">{summarizeNativeDiagnostics(nativeDiagnostics)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="secondary-button h-8" type="button" onClick={() => void onRefreshNativeDiagnostics()}>
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                className="secondary-button h-8"
                type="button"
                disabled={!nativeDiagnostics || (nativeDiagnostics.entries.length === 0 && nativeDiagnostics.stream_errors.length === 0)}
                onClick={() => void onClearNativeDiagnostics()}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid gap-2 text-xs">
            <div className="grid gap-1 rounded border border-line/70 bg-panel px-3 py-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                <span>Device: {nativeDiagnostics?.device_name ?? "not opened"}</span>
                <span>Config: {nativeDiagnostics?.sample_rate ? `${nativeDiagnostics.sample_rate} Hz` : "unknown"}</span>
                <span>{nativeDiagnostics?.channel_count ? `${nativeDiagnostics.channel_count} channels` : "channels unknown"}</span>
                <span>{nativeDiagnostics?.sample_format ?? "format unknown"}</span>
              </div>
              {nativeDiagnostics?.current_path && (
                <div className="truncate text-muted" title={nativeDiagnostics.current_path}>
                  Current: {nativeDiagnostics.current_path}
                </div>
              )}
            </div>
            {nativeDiagnosticsMessage && <div className="text-muted">{nativeDiagnosticsMessage}</div>}
            {recentNativeDiagnostics.length > 0 ? (
              <div className="grid max-h-56 gap-1 overflow-auto pr-1">
                {recentNativeDiagnostics.map((entry) => (
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
                      <span className="text-muted">{formatNativeDiagnosticTime(entry.timestamp_ms)}</span>
                      <span className="font-medium text-neutral-200">{entry.operation}</span>
                    </div>
                    <div className="text-neutral-200">{entry.message}</div>
                    {nativeDiagnosticContext(entry) && (
                      <div className="truncate text-muted" title={nativeDiagnosticContext(entry)}>
                        {nativeDiagnosticContext(entry)}
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
        )}
      </div>
    </DisclosureSection>

    <DisclosureSection title="Lyrics" description="Fetching, synced lyric cache, and follow behavior">
      <div className="grid gap-3 text-sm text-neutral-200">
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div>
            <div className="font-medium text-white">Lyric behavior</div>
            <div className="text-xs text-muted">Automatic lookup, synced line following, and sidecar LRC caching.</div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
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
          </div>
        </div>
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
              <div className="text-xs text-muted">
                Applied in WebView and Native Rust playback; exact filter shape can differ slightly by engine.
              </div>
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

    <DisclosureSection title="Playback Behavior & Codecs" description="Fade, skip threshold, and codec support for the selected engine">
      <div className="grid gap-3 text-sm text-neutral-200">
        <label className="grid gap-2">
          <span className="text-xs uppercase text-muted">Fade Length {uiPreferences.playerFadeMs}ms</span>
          <input
            type="range"
            min={0}
            max={5000}
            step={50}
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
        {uiPreferences.playbackEngine === "webview" ? (
          <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-white">WebView codec support</div>
                <div className="text-xs text-muted">
                  Reported by WebView2 for the currently selected WebView audio engine.
                </div>
              </div>
              <button className="secondary-button h-8" type="button" onClick={onRefreshCodecSupport}>
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
        ) : (
          <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
            <div>
              <div className="font-medium text-white">Native Rust codec support</div>
              <div className="text-xs text-muted">
                Reported from the bundled rodio + Symphonia decoder set. Playback failures are recorded in native diagnostics.
              </div>
            </div>
            <div className="grid gap-1 text-xs">
              {NATIVE_CODEC_SUPPORT.map((codec) => (
                <div key={codec.label} className="grid grid-cols-[110px_88px_1fr] gap-3 rounded bg-panel px-2 py-1.5">
                  <span className="text-neutral-200">{codec.label}</span>
                  <span className="text-moss">{codec.support}</span>
                  <span className="truncate text-muted">{codec.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DisclosureSection>
    </>
  );
}
