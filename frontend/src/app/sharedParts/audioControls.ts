import { useEffect } from "react";
import type { FontChoice, ThemeAccent } from "../../config/theme";
import type {
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AutoDjSettings,
  ClapInstallProgress,
  QueueTrack,
  RecommendationDrift,
  Track,
} from "../../types/api";
import type {
  EqualizerBandMode,
  RememberedDeleteChoice,
  ReplayGainMode,
} from "./types";
import {
  END_FADE_SECONDS,
  EQ_FREQUENCIES_10,
  EQ_FREQUENCIES_15,
  EQUALIZER_GAIN_MAX_DB,
  EQUALIZER_GAIN_MIN_DB,
  REPLAYGAIN_TARGET_DEFAULT_PERCENT,
  REPLAYGAIN_TARGET_LOUD_OFFSET_DB,
  REPLAYGAIN_TARGET_MAX_PERCENT,
  REPLAYGAIN_TARGET_MIN_PERCENT,
  REPLAYGAIN_TARGET_QUIET_OFFSET_DB,
  storageKeys,
} from "./constants";
import {
  readBooleanFlag,
  writeBooleanFlag,
} from "../../lib/uiInteractions";

export function replayGainMultiplier(
  track: Track | null,
  mode: ReplayGainMode,
  preampDb: number,
  preventClipping = true,
  targetVolumePercent = REPLAYGAIN_TARGET_DEFAULT_PERCENT,
): number {
  if (!track || mode === "off") {
    return 1;
  }
  const gain =
    mode === "album"
      ? track.replaygain_album_gain_db ?? track.replaygain_track_gain_db
      : track.replaygain_track_gain_db ?? track.replaygain_album_gain_db;
  const peak =
    mode === "album"
      ? track.replaygain_album_peak ?? track.replaygain_track_peak
      : track.replaygain_track_peak ?? track.replaygain_album_peak;
  if (typeof gain !== "number" || !Number.isFinite(gain)) {
    return 1;
  }
  const targetOffsetDb = replayGainTargetOffsetDb(targetVolumePercent);
  const db = clampNumber(gain + targetOffsetDb + preampDb, -24, 12);
  const desired = clampNumber(Math.pow(10, db / 20), 0.05, 1.5);
  if (!preventClipping || typeof peak !== "number" || !Number.isFinite(peak) || peak <= 0) {
    return desired;
  }
  return clampNumber(Math.min(desired, 1 / peak), 0.05, 1.5);
}

export function readMiniPlayerAlwaysOnTop(): boolean {
  const stored = window.localStorage.getItem(storageKeys.miniPlayerAlwaysOnTop);
  if (stored !== null) {
    return readBooleanFlag(window.localStorage, storageKeys.miniPlayerAlwaysOnTop, false);
  }
  try {
    const prefs = JSON.parse(window.localStorage.getItem(storageKeys.uiPreferences) ?? "{}");
    return Boolean(prefs.miniPlayerAlwaysOnTop);
  } catch {
    return false;
  }
}

export function writeMiniPlayerAlwaysOnTop(value: boolean) {
  writeBooleanFlag(window.localStorage, storageKeys.miniPlayerAlwaysOnTop, value);
}

export function readMiniPlayerSize(): { width: number; height: number } {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKeys.miniPlayerSize) ?? "{}");
    const prefs = JSON.parse(window.localStorage.getItem(storageKeys.uiPreferences) ?? "{}");
    const width =
      typeof parsed.width === "number"
        ? clampNumber(parsed.width, 360, 900)
        : typeof prefs.miniPlayerWidth === "number"
          ? clampNumber(prefs.miniPlayerWidth, 360, 900)
          : 420;
    const height =
      typeof parsed.height === "number"
        ? clampNumber(parsed.height, 96, 220)
        : typeof prefs.miniPlayerHeight === "number"
          ? clampNumber(prefs.miniPlayerHeight, 96, 220)
          : 118;
    return { width, height };
  } catch {
    return { width: 420, height: 118 };
  }
}

export function writeMiniPlayerSize(width: number, height: number) {
  try {
    window.localStorage.setItem(
      storageKeys.miniPlayerSize,
      JSON.stringify({ width: clampNumber(width, 360, 900), height: clampNumber(height, 96, 220) }),
    );
  } catch {
    // Mini-player size is a convenience preference.
  }
}

export function readRememberedDeleteChoice(): RememberedDeleteChoice | null {
  try {
    const value = window.localStorage.getItem(storageKeys.deleteChoice);
    return value === "library" || value === "file" ? value : null;
  } catch {
    return null;
  }
}

export function writeRememberedDeleteChoice(choice: RememberedDeleteChoice) {
  try {
    window.localStorage.setItem(storageKeys.deleteChoice, choice);
  } catch {
    // Remembering delete preference is a convenience only.
  }
}

export function clearRememberedDeleteChoice() {
  try {
    window.localStorage.removeItem(storageKeys.deleteChoice);
  } catch {
    // Remembering delete preference is a convenience only.
  }
}

export function readQuickStartDismissed(): boolean {
  return readBooleanFlag(window.localStorage, storageKeys.quickStartDismissed, false);
}

export function writeQuickStartDismissed() {
  writeBooleanFlag(window.localStorage, storageKeys.quickStartDismissed, true);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function equalizerFrequenciesForMode(mode: EqualizerBandMode): number[] {
  return mode === "15" ? EQ_FREQUENCIES_15 : EQ_FREQUENCIES_10;
}

export function normalizeEqualizerGains(value: unknown, mode: EqualizerBandMode): number[] {
  const frequencies = equalizerFrequenciesForMode(mode);
  const source = Array.isArray(value) ? value : [];
  return frequencies.map((_, index) => {
    const gain = Number(source[index] ?? 0);
    return Number.isFinite(gain) ? clampNumber(gain, EQUALIZER_GAIN_MIN_DB, EQUALIZER_GAIN_MAX_DB) : 0;
  });
}

export function formatEqFrequency(frequency: number): string {
  return frequency >= 1000 ? `${Number(frequency / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : String(frequency);
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

export function replayGainTargetOffsetDb(targetVolumePercent: number): number {
  const percent = clampNumber(targetVolumePercent, REPLAYGAIN_TARGET_MIN_PERCENT, REPLAYGAIN_TARGET_MAX_PERCENT);
  if (percent <= REPLAYGAIN_TARGET_DEFAULT_PERCENT) {
    const quietRange = REPLAYGAIN_TARGET_DEFAULT_PERCENT - REPLAYGAIN_TARGET_MIN_PERCENT;
    return REPLAYGAIN_TARGET_QUIET_OFFSET_DB * (1 - percent / quietRange);
  }
  const loudRange = REPLAYGAIN_TARGET_MAX_PERCENT - REPLAYGAIN_TARGET_DEFAULT_PERCENT;
  return REPLAYGAIN_TARGET_LOUD_OFFSET_DB * ((percent - REPLAYGAIN_TARGET_DEFAULT_PERCENT) / loudRange);
}

export function replayGainTargetPercentFromLegacyLufs(targetLufs: number): number {
  const legacyReferenceLufs = -18;
  const offsetDb = clampNumber(targetLufs, -24, -10) - legacyReferenceLufs;
  if (offsetDb <= 0) {
    return Math.round(REPLAYGAIN_TARGET_DEFAULT_PERCENT * (1 - offsetDb / REPLAYGAIN_TARGET_QUIET_OFFSET_DB));
  }
  const loudRange = REPLAYGAIN_TARGET_MAX_PERCENT - REPLAYGAIN_TARGET_DEFAULT_PERCENT;
  return Math.round(REPLAYGAIN_TARGET_DEFAULT_PERCENT + (offsetDb / REPLAYGAIN_TARGET_LOUD_OFFSET_DB) * loudRange);
}

export function replayGainTargetDescription(targetVolumePercent: number): string {
  const percent = clampNumber(targetVolumePercent, REPLAYGAIN_TARGET_MIN_PERCENT, REPLAYGAIN_TARGET_MAX_PERCENT);
  if (percent < 35) {
    return "Quiet";
  }
  if (percent < 50) {
    return "Softer";
  }
  if (percent === 50) {
    return "Neutral";
  }
  if (percent <= 70) {
    return "Louder";
  }
  return "Very loud";
}

export function getListenedPercent(listenedSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) {
    return 0;
  }
  return clampNumber((Math.max(0, listenedSeconds) / durationSeconds) * 100, 0, 100);
}

// Keep skip/play accounting in one place so manual track changes and player controls learn the same way.
export function shouldRecordTrackAsPlayed(
  listenedSeconds: number,
  durationSeconds: number,
  skipThresholdPercent: number,
): boolean {
  return getListenedPercent(listenedSeconds, durationSeconds) >= skipThresholdPercent;
}

export function readStoredVolume(): number {
  try {
    const raw = window.localStorage.getItem(storageKeys.playerVolume);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? clampNumber(parsed, 0, 1) : 0.5;
  } catch {
    return 0.5;
  }
}

export function readStoredMuted(): boolean {
  try {
    return window.localStorage.getItem(storageKeys.playerMuted) === "true";
  } catch {
    return false;
  }
}

export function writeStoredAudioControls(volume: number, muted: boolean) {
  try {
    window.localStorage.setItem(storageKeys.playerVolume, String(clampNumber(volume, 0, 1)));
    window.localStorage.setItem(storageKeys.playerMuted, String(muted));
  } catch {
    // Local audio controls are still useful for the current session.
  }
}

export function setDomInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
}

export function rangeStepPrecision(step: string): number {
  if (!step || step === "any") {
    return 2;
  }
  const [, decimal = ""] = step.split(".");
  return Math.min(6, decimal.length);
}

export function useRangeWheelControls() {
  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      if (!input || input.type !== "range" || input.disabled) {
        return;
      }

      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const wheelStep = input.dataset.wheelStep ? Number(input.dataset.wheelStep) : Number.NaN;
      const step =
        Number.isFinite(wheelStep) && wheelStep > 0
          ? wheelStep
          : input.step && input.step !== "any"
            ? Number(input.step)
            : 1;
      const current = Number(input.value);
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || !Number.isFinite(current)) {
        return;
      }

      event.preventDefault();
      const direction = event.deltaY < 0 || event.deltaX < 0 ? 1 : -1;
      const multiplier = event.shiftKey ? 10 : event.altKey ? 0.25 : 1;
      const precision = rangeStepPrecision(input.step);
      const next = clampNumber(current + direction * step * multiplier, min, max);
      setDomInputValue(input, next.toFixed(precision));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);
}
