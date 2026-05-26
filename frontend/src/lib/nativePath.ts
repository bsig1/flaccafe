export interface NativePathInfo {
  input_path: string;
  exists: boolean;
  is_file: boolean;
  is_dir: boolean;
  canonical_path: string | null;
  parent_path: string | null;
  error: string | null;
}

export interface NativeAudioPath {
  path: string;
  modified_ms: number | null;
  size_bytes: number;
}

export interface NativeAudioScanResponse {
  folders: string[];
  total_files: number;
  total_bytes: number;
  elapsed_ms: number;
  files: NativeAudioPath[];
  errors: string[];
}

export interface NativeRecycleResponse {
  requested: number;
  recycled: number;
  missing: number;
  errors: string[];
}

export interface NativeFolderWatchEvent {
  paths: string[];
  event_count: number;
  emitted_at_ms: number;
}

export interface NativeFolderWatchStatus {
  running: boolean;
  watched_paths: string[];
  pending_events: number;
  last_event_ms: number | null;
  last_error: string | null;
}

export interface NativeToolRunResponse {
  executable: string;
  args: string[];
  exit_code: number | null;
  stdout: string;
  stderr: string;
  elapsed_ms: number;
  timed_out: boolean;
}

export interface NativeAudioConversionSupervisionResponse {
  executable: string;
  args: string[];
  exit_code: number | null;
  elapsed_ms: number;
  timed_out: boolean;
  succeeded: boolean;
  input_path: string | null;
  output_path: string | null;
  input_size_bytes: number | null;
  output_size_bytes: number | null;
  output_to_input_ratio: number | null;
  stdout: string;
  stderr_tail: string;
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function nativePathInfo(path: string): Promise<NativePathInfo> {
  return invokeNative<NativePathInfo>("native_path_info", { path });
}

export function nativeScanAudioPaths({
  paths,
  extensions,
  includeFiles = false,
  limit,
}: {
  paths: string[];
  extensions?: string[] | null;
  includeFiles?: boolean;
  limit?: number | null;
}): Promise<NativeAudioScanResponse> {
  return invokeNative<NativeAudioScanResponse>("native_scan_audio_paths", {
    paths,
    extensions: extensions ?? null,
    includeFiles,
    limit: limit ?? null,
  });
}

export function nativeRecyclePaths(paths: string[]): Promise<NativeRecycleResponse> {
  return invokeNative<NativeRecycleResponse>("native_recycle_paths", { paths });
}

export function nativeFolderWatchStart(paths: string[], debounceMs = 1200): Promise<NativeFolderWatchStatus> {
  return invokeNative<NativeFolderWatchStatus>("native_folder_watch_start", {
    paths,
    debounceMs,
  });
}

export function nativeFolderWatchStop(): Promise<NativeFolderWatchStatus> {
  return invokeNative<NativeFolderWatchStatus>("native_folder_watch_stop");
}

export function nativeFolderWatchMarkEvent(eventCount: number, error?: string | null): Promise<NativeFolderWatchStatus> {
  return invokeNative<NativeFolderWatchStatus>("native_folder_watch_mark_event", {
    eventCount,
    error: error ?? null,
  });
}

export function nativeRunTool(executable: string, args: string[] = [], timeoutMs = 15000): Promise<NativeToolRunResponse> {
  return invokeNative<NativeToolRunResponse>("native_run_tool", {
    executable,
    args,
    timeoutMs,
  });
}

export function nativeSuperviseAudioConversion({
  executable,
  args = [],
  inputPath,
  outputPath,
  timeoutMs = 10 * 60 * 1000,
}: {
  executable: string;
  args?: string[];
  inputPath?: string | null;
  outputPath?: string | null;
  timeoutMs?: number;
}): Promise<NativeAudioConversionSupervisionResponse> {
  return invokeNative<NativeAudioConversionSupervisionResponse>("native_supervise_audio_conversion", {
    executable,
    args,
    inputPath: inputPath ?? null,
    outputPath: outputPath ?? null,
    timeoutMs,
  });
}

export async function listenNativeFolderWatchEvents(
  callback: (event: NativeFolderWatchEvent) => void,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<NativeFolderWatchEvent>("flac-cafe://native-folder-watch", (event) => callback(event.payload));
}

export function isNativeUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) {
    return false;
  }
  return /__TAURI__|ipc|invoke|not implemented|is not a function|unknown command/i.test(message);
}
