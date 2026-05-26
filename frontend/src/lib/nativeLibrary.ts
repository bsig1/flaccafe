import type {
  LibrarySourceRemoveResponse,
  TrackPage,
} from "../types/api";

async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export interface NativeTrackPage extends TrackPage {
  source: "rust-sqlite" | string;
}

export function nativeFetchTrackPage({
  search = "",
  limit = 150,
  offset = 0,
  sortBy = "artist",
  sortDirection = "asc",
}: {
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}): Promise<NativeTrackPage> {
  return invokeNative<NativeTrackPage>("native_tracks_page", {
    search,
    limit,
    offset,
    sortBy,
    sortDirection,
  });
}

export function nativeRemoveLibrarySource(path: string): Promise<LibrarySourceRemoveResponse> {
  return invokeNative<LibrarySourceRemoveResponse>("native_remove_library_source", { path });
}
