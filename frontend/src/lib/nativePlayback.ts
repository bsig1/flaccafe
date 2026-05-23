export interface NativePlaybackStatus {
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

export interface NativePlaybackDiagnostic {
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

export interface NativePlaybackDiagnosticsResponse {
  entries: NativePlaybackDiagnostic[];
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

export interface NativeAudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  default_sample_rate: number | null;
  default_channels: number | null;
  default_sample_format: string | null;
  supported_configs: number;
}

export interface NativeDspSettings {
  equalizerEnabled: boolean;
  equalizerBandMode: "10" | "15";
  equalizerPreampDb: number;
  equalizerGains: number[];
  limiterEnabled: boolean;
}

export interface NativePreparedTrack {
  path: string;
  duration_seconds: number | null;
  prepared_at_ms: number;
  message: string;
}

export interface NativeOutputBackend {
  id: "cpalShared" | "wasapiExclusive" | "asio" | string;
  label: string;
  available: boolean;
  exclusive: boolean;
  message: string;
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function nativePlayFile({
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
  dspSettings?: NativeDspSettings | null;
}): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_play_file", {
    path,
    volume,
    startSeconds: startSeconds ?? null,
    deviceId: deviceId ?? null,
    bufferFrames: bufferFrames || null,
    dspSettings: dspSettings ?? null,
  });
}

export function nativeCrossfadeToFile({
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
  dspSettings?: NativeDspSettings | null;
}): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_crossfade_to_file", {
    path,
    volume,
    durationMs,
    startSeconds: startSeconds ?? null,
    deviceId: deviceId ?? null,
    bufferFrames: bufferFrames || null,
    dspSettings: dspSettings ?? null,
  });
}

export function nativeResume(): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_resume");
}

export function nativePause(): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_pause");
}

export function nativeStop(): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_stop");
}

export function nativeSeek(seconds: number): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_seek", { seconds });
}

export function nativeSetVolume(volume: number): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_set_volume", { volume });
}

export function nativeSetDsp(dspSettings: NativeDspSettings): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_set_dsp", { dspSettings });
}

export function nativeStatus(): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_status");
}

export function nativeDiagnostics(): Promise<NativePlaybackDiagnosticsResponse> {
  return invokeNative<NativePlaybackDiagnosticsResponse>("native_diagnostics");
}

export function nativeClearDiagnostics(): Promise<NativePlaybackDiagnosticsResponse> {
  return invokeNative<NativePlaybackDiagnosticsResponse>("native_clear_diagnostics");
}

export function nativePrepareNextFile(path: string): Promise<NativePreparedTrack> {
  return invokeNative<NativePreparedTrack>("native_prepare_next_file", { path });
}

export function nativeOutputBackends(): Promise<NativeOutputBackend[]> {
  return invokeNative<NativeOutputBackend[]>("native_output_backends");
}

export function nativeListOutputDevices(): Promise<NativeAudioDevice[]> {
  return invokeNative<NativeAudioDevice[]>("native_list_output_devices");
}

export function summarizeNativeDiagnostics(diagnostics: NativePlaybackDiagnosticsResponse | null): string {
  if (!diagnostics) {
    return "Diagnostics not loaded";
  }
  const total = diagnostics.entries.length;
  const errors = diagnostics.entries.filter((entry) => entry.severity === "error").length;
  const warnings = diagnostics.entries.filter((entry) => entry.severity === "warning").length;
  if (total === 0 && diagnostics.stream_errors.length === 0) {
    return "No recent native playback failures";
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
