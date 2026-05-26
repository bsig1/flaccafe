export interface PathInfo {
  input_path: string;
  exists: boolean;
  is_file: boolean;
  is_dir: boolean;
  canonical_path: string | null;
  parent_path: string | null;
  error: string | null;
}

export interface desktopAudioPath {
  path: string;
  modified_ms: number | null;
  size_bytes: number;
}

export interface desktopAudioScanResponse {
  folders: string[];
  total_files: number;
  total_bytes: number;
  elapsed_ms: number;
  files: desktopAudioPath[];
  errors: string[];
}

export interface RecycleResponse {
  requested: number;
  recycled: number;
  missing: number;
  errors: string[];
}

export interface FolderWatchEvent {
  paths: string[];
  event_count: number;
  emitted_at_ms: number;
}

export interface FolderWatchStatus {
  running: boolean;
  watched_paths: string[];
  pending_events: number;
  last_event_ms: number | null;
  last_error: string | null;
}

export interface desktopToolRunResponse {
  executable: string;
  args: string[];
  exit_code: number | null;
  stdout: string;
  stderr: string;
  elapsed_ms: number;
  timed_out: boolean;
}

export interface desktopAudioConversionSupervisionResponse {
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

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function PathInfo(path: string): Promise<PathInfo> {
  return invokeDesktop<PathInfo>("path_info", { path });
}

export function desktopScanAudioPaths({
  paths,
  extensions,
  includeFiles = false,
  limit,
}: {
  paths: string[];
  extensions?: string[] | null;
  includeFiles?: boolean;
  limit?: number | null;
}): Promise<desktopAudioScanResponse> {
  return invokeDesktop<desktopAudioScanResponse>("scan_audio_paths", {
    paths,
    extensions: extensions ?? null,
    includeFiles,
    limit: limit ?? null,
  });
}

export function RecyclePaths(paths: string[]): Promise<RecycleResponse> {
  return invokeDesktop<RecycleResponse>("recycle_paths", { paths });
}

export function FolderWatchStart(paths: string[], debounceMs = 1200): Promise<FolderWatchStatus> {
  return invokeDesktop<FolderWatchStatus>("folder_watch_start", {
    paths,
    debounceMs,
  });
}

export function FolderWatchStop(): Promise<FolderWatchStatus> {
  return invokeDesktop<FolderWatchStatus>("folder_watch_stop");
}

export function FolderWatchMarkEvent(eventCount: number, error?: string | null): Promise<FolderWatchStatus> {
  return invokeDesktop<FolderWatchStatus>("folder_watch_mark_event", {
    eventCount,
    error: error ?? null,
  });
}

export function desktopRunTool(executable: string, args: string[] = [], timeoutMs = 15000): Promise<desktopToolRunResponse> {
  return invokeDesktop<desktopToolRunResponse>("run_tool", {
    executable,
    args,
    timeoutMs,
  });
}

export function desktopSuperviseAudioConversion({
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
}): Promise<desktopAudioConversionSupervisionResponse> {
  return invokeDesktop<desktopAudioConversionSupervisionResponse>("supervise_audio_conversion", {
    executable,
    args,
    inputPath: inputPath ?? null,
    outputPath: outputPath ?? null,
    timeoutMs,
  });
}

export async function listenFolderWatchEvents(
  callback: (event: FolderWatchEvent) => void,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<FolderWatchEvent>("flac-cafe://desktop-folder-watch", (event) => callback(event.payload));
}

export function isDesktopBridgeUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) {
    return false;
  }
  return /__TAURI__|ipc|invoke|not implemented|is not a function|unknown command/i.test(message);
}
