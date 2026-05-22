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

export interface NativeAudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  default_sample_rate: number | null;
  default_channels: number | null;
  default_sample_format: string | null;
  supported_configs: number;
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
}: {
  path: string;
  volume: number;
  startSeconds?: number | null;
  deviceId?: string | null;
  bufferFrames?: number | null;
}): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_play_file", {
    path,
    volume,
    startSeconds: startSeconds ?? null,
    deviceId: deviceId ?? null,
    bufferFrames: bufferFrames || null,
  });
}

export function nativeCrossfadeToFile({
  path,
  volume,
  durationMs,
  startSeconds,
  deviceId,
  bufferFrames,
}: {
  path: string;
  volume: number;
  durationMs: number;
  startSeconds?: number | null;
  deviceId?: string | null;
  bufferFrames?: number | null;
}): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_crossfade_to_file", {
    path,
    volume,
    durationMs,
    startSeconds: startSeconds ?? null,
    deviceId: deviceId ?? null,
    bufferFrames: bufferFrames || null,
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

export function nativeStatus(): Promise<NativePlaybackStatus> {
  return invokeNative<NativePlaybackStatus>("native_status");
}

export function nativeListOutputDevices(): Promise<NativeAudioDevice[]> {
  return invokeNative<NativeAudioDevice[]>("native_list_output_devices");
}
