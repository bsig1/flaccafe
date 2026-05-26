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

export function isNativeUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) {
    return false;
  }
  return /__TAURI__|ipc|invoke|not implemented|is not a function|unknown command/i.test(message);
}
