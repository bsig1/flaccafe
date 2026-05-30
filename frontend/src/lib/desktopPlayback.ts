export interface PlaybackStatus {
  available: boolean;
  current_path: string | null;
  device_id: string | null;
  device_name: string | null;
  is_playing: boolean;
  is_paused: boolean;
  ended: boolean;
  position_seconds: number;
  duration_seconds: number | null;
  volume: number;
  buffer_frames: number | null;
  sample_rate: number | null;
  channel_count: number | null;
  sample_format: string | null;
  stream_errors: string[];
  message: string | null;
}

export interface desktopVisualizerFrame {
  is_live: boolean;
  level: number;
  peak: number;
  frequency_bins: number[];
  waveform: number[];
  timestamp_ms: number;
}

export interface PlaybackDiagnostic {
  id: number;
  timestamp_ms: number;
  severity: "error" | "warning" | string;
  category: "rodio" | "cpal" | "symphonia" | "file" | string;
  operation: string;
  message: string;
  path: string | null;
  device_id: string | null;
  device_name: string | null;
  buffer_frames: number | null;
  sample_rate: number | null;
  channel_count: number | null;
  sample_format: string | null;
}

export interface PlaybackDiagnosticsResponse {
  entries: PlaybackDiagnostic[];
  stream_errors: string[];
  current_path: string | null;
  prepared_next_path: string | null;
  prepared_next_duration_seconds: number | null;
  prepared_next_at_ms: number | null;
  device_id: string | null;
  device_name: string | null;
  buffer_frames: number | null;
  sample_rate: number | null;
  channel_count: number | null;
  sample_format: string | null;
}

export interface desktopAudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  default_sample_rate: number | null;
  default_channels: number | null;
  default_sample_format: string | null;
  supported_configs: number;
}

export interface desktopDspSettings {
  normalizationGain: number;
  equalizerEnabled: boolean;
  equalizerBandMode: "10" | "15";
  equalizerPreampDb: number;
  equalizerGains: number[];
  limiterEnabled: boolean;
}

export interface desktopPreparedTrack {
  path: string;
  duration_seconds: number | null;
  prepared_at_ms: number;
  message: string;
}

export type DesktopPlaybackSource =
  | { kind: "file"; path: string }
  | { kind: "url"; url: string; cache_key?: string | null; title?: string | null; live?: boolean }
  | { kind: "cd_track"; drive_id: string; track_number: number; title?: string | null };

export interface desktopOutputBackend {
  id: "cpalShared" | "wasapiExclusive" | "asio" | string;
  label: string;
  available: boolean;
  exclusive: boolean;
  message: string;
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function desktopPlayFile({
  path,
  volume,
  startSeconds,
  deviceId,
  bufferFrames,
  dspSettings,
}: {
  path: string;
  volume: number;
  startSeconds?: number | null;
  deviceId?: string | null;
  bufferFrames?: number | null;
  dspSettings?: desktopDspSettings | null;
}): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("play_file", {
    path,
    volume,
    startSeconds: startSeconds ?? null,
    deviceId: deviceId ?? null,
    bufferFrames: bufferFrames || null,
    dspSettings: dspSettings ?? null,
  });
}

export function desktopPlaySource({
  source,
  volume,
  startSeconds,
  deviceId,
  bufferFrames,
  dspSettings,
}: {
  source: DesktopPlaybackSource;
  volume: number;
  startSeconds?: number | null;
  deviceId?: string | null;
  bufferFrames?: number | null;
  dspSettings?: desktopDspSettings | null;
}): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("play_source", {
    source,
    volume,
    startSeconds: startSeconds ?? null,
    deviceId: deviceId ?? null,
    bufferFrames: bufferFrames || null,
    dspSettings: dspSettings ?? null,
  });
}

export function desktopCrossfadeToFile({
  path,
  volume,
  durationMs,
  startSeconds,
  deviceId,
  bufferFrames,
  dspSettings,
}: {
  path: string;
  volume: number;
  durationMs: number;
  startSeconds?: number | null;
  deviceId?: string | null;
  bufferFrames?: number | null;
  dspSettings?: desktopDspSettings | null;
}): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("crossfade_to_file", {
    path,
    volume,
    durationMs,
    startSeconds: startSeconds ?? null,
    deviceId: deviceId ?? null,
    bufferFrames: bufferFrames || null,
    dspSettings: dspSettings ?? null,
  });
}

export function desktopCrossfadeToSource({
  source,
  volume,
  durationMs,
  startSeconds,
  deviceId,
  bufferFrames,
  dspSettings,
}: {
  source: DesktopPlaybackSource;
  volume: number;
  durationMs: number;
  startSeconds?: number | null;
  deviceId?: string | null;
  bufferFrames?: number | null;
  dspSettings?: desktopDspSettings | null;
}): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("crossfade_to_source", {
    source,
    volume,
    durationMs,
    startSeconds: startSeconds ?? null,
    deviceId: deviceId ?? null,
    bufferFrames: bufferFrames || null,
    dspSettings: dspSettings ?? null,
  });
}

export function desktopResume(): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("resume");
}

export function desktopPause(): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("pause");
}

export function desktopStop(): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("stop");
}

export function desktopSeek(seconds: number): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("seek", { seconds });
}

export function desktopSetVolume(volume: number): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("set_volume", { volume });
}

export function desktopFadeVolume(volume: number, durationMs: number): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("fade_volume", { volume, durationMs });
}

export function desktopSetDsp(dspSettings: desktopDspSettings): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("set_dsp", { dspSettings });
}

export function desktopStatus(): Promise<PlaybackStatus> {
  return invokeDesktop<PlaybackStatus>("status");
}

export function desktopVisualizerFrame(): Promise<desktopVisualizerFrame> {
  return invokeDesktop<desktopVisualizerFrame>("visualizer_frame");
}

export function desktopDiagnostics(): Promise<PlaybackDiagnosticsResponse> {
  return invokeDesktop<PlaybackDiagnosticsResponse>("diagnostics");
}

export function desktopClearDiagnostics(): Promise<PlaybackDiagnosticsResponse> {
  return invokeDesktop<PlaybackDiagnosticsResponse>("clear_diagnostics");
}

export function desktopPrepareNextFile(path: string): Promise<desktopPreparedTrack> {
  return invokeDesktop<desktopPreparedTrack>("prepare_next_file", { path });
}

export function desktopPrepareNextSource(source: DesktopPlaybackSource): Promise<desktopPreparedTrack> {
  return invokeDesktop<desktopPreparedTrack>("prepare_next_source", { source });
}

export function desktopOutputBackends(): Promise<desktopOutputBackend[]> {
  return invokeDesktop<desktopOutputBackend[]>("output_backends");
}

export function desktopListOutputDevices(): Promise<desktopAudioDevice[]> {
  return invokeDesktop<desktopAudioDevice[]>("list_output_devices");
}

export function summarizePlaybackDiagnostics(diagnostics: PlaybackDiagnosticsResponse | null): string {
  if (!diagnostics) {
    return "Diagnostics not loaded";
  }
  const total = diagnostics.entries.length;
  const errors = diagnostics.entries.filter((entry) => entry.severity === "error").length;
  const warnings = diagnostics.entries.filter((entry) => entry.severity === "warning").length;
  if (total === 0 && diagnostics.stream_errors.length === 0) {
    return "No recent Rust playback failures";
  }
  const categories = Array.from(new Set(diagnostics.entries.slice(-8).map((entry) => entry.category))).join(", ");
  const parts = [
    `${errors} error${errors === 1 ? "" : "s"}`,
    `${warnings} warning${warnings === 1 ? "" : "s"}`,
  ];
  if (diagnostics.stream_errors.length) {
    parts.push(`${diagnostics.stream_errors.length} stream callback${diagnostics.stream_errors.length === 1 ? "" : "s"}`);
  }
  return `${parts.join(", ")}${categories ? ` across ${categories}` : ""}`;
}
