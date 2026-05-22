import {
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import type {
  NativeAudioDevice,
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
  UiPreferences,
  equalizerFrequenciesForMode,
  equalizerPresets,
  formatEqFrequency,
  normalizeEqualizerGains,
  writeMiniPlayerAlwaysOnTop,
  writeMiniPlayerSize,
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

export function PlayerSettingsSection({
  uiPreferences,
  setUiPreferences,
  nativeDevices,
  nativeDeviceMessage,
  onRefreshNativeDevices,
  codecSupport,
  onRefreshCodecSupport,
}: {
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
  nativeDevices: NativeAudioDevice[];
  nativeDeviceMessage: string | null;
  onRefreshNativeDevices: () => void | Promise<void>;
  codecSupport: CodecSupportRow[];
  onRefreshCodecSupport: () => void;
}) {
  const equalizerFrequencies = equalizerFrequenciesForMode(uiPreferences.equalizerBandMode);
  const equalizerGains = normalizeEqualizerGains(uiPreferences.equalizerGains, uiPreferences.equalizerBandMode);

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
            <button className="secondary-button h-8" type="button" onClick={() => void onRefreshNativeDevices()}>
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
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-white">
                <SlidersHorizontal size={16} />
                Equalizer / DSP
              </div>
              <div className="text-xs text-muted">
                Applied in WebView playback. Native Rust playback currently bypasses this DSP chain.
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
          {uiPreferences.playbackEngine === "native" && uiPreferences.equalizerEnabled && (
            <div className="rounded border border-ember/40 bg-panel px-3 py-2 text-xs text-ember">
              Switch Playback Engine to WebView audio to hear EQ/DSP while the Rust output path remains clean.
            </div>
          )}
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
      </div>
    </DisclosureSection>
  );
}
