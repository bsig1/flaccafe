import type {
  AlbumSummary,
  ArtistSummary,
  AudiobookBookmark,
  AudiobookBookmarkRequest,
  AudiobookChapter,
  AudiobookListResponse,
  AudiobookProgressRequest,
  AudiobookProgressResponse,
  AutoDjAvoidRule,
  AutoDjResponse,
  AutoDjSettings,
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  CacheClearResponse,
  CacheClearTarget,
  ExportResponse,
  FileOrganizationRequest,
  FileOrganizationResponse,
  GaplessValidationRequest,
  GaplessValidationResponse,
  HistoryStatsResponse,
  LibraryHealthResponse,
  LibrarySourceRemoveResponse,
  LibraryStatsResponse,
  PlayEventEntry,
  PlaylistSummary,
  RadioStation,
  RadioStationPayload,
  SettingsResponse,
  SettingsUpdateRequest,
  SimilarTrack,
  Track,
  TrackBatchResponse,
  TrackLoveResponse,
  TrackPage,
  VolumeTagRequest,
  VolumeTagResponse,
  LovedTrack,
} from "../types/api";

async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export interface NativeTrackPage extends TrackPage {
  source: "rust-sqlite" | string;
}

export interface NativeLibraryReconcilePreview {
  folders: string[];
  scanned_files: number;
  database_tracks: number;
  new_files: number;
  missing_tracks: number;
  modified_tracks: number;
  sample_new_files: string[];
  sample_missing_tracks: string[];
  sample_modified_tracks: string[];
  elapsed_ms: number;
  errors: string[];
}

export interface NativePlaylistParseResponse {
  playlist_path: string;
  base_folder: string;
  entries: string[];
  local_paths: string[];
  errors: string[];
}

export interface NativeBulkFileMove {
  source_path: string;
  target_path: string;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface NativeBulkFileMoveResponse {
  total: number;
  changed: number;
  applied: number;
  moves: NativeBulkFileMove[];
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

export function nativeFetchBackendHealth(): Promise<{ status: string }> {
  return invokeNative<{ status: string }>("native_health");
}

export function nativeFetchSettings(): Promise<SettingsResponse> {
  return invokeNative<SettingsResponse>("native_settings");
}

export function nativeUpdateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return invokeNative<SettingsResponse>("native_update_settings", {
    writeRatingsToFiles: settings.write_ratings_to_files,
    autoWriteFetchedLyricsSidecars: settings.auto_write_fetched_lyrics_sidecars,
    cdAutoLookupMetadata: settings.cd_auto_lookup_metadata,
    acoustidApiKey: settings.acoustid_api_key,
    clearAcoustidApiKey: settings.clear_acoustid_api_key,
    lastfmApiKey: settings.lastfm_api_key,
    lastfmApiSecret: settings.lastfm_api_secret,
    clearLastfmApiCredentials: settings.clear_lastfm_api_credentials,
  });
}

export function nativeRemoveLibrarySource(path: string): Promise<LibrarySourceRemoveResponse> {
  return invokeNative<LibrarySourceRemoveResponse>("native_remove_library_source", { path });
}

export function nativeFetchTrack(trackId: number): Promise<Track> {
  return invokeNative<Track>("native_track", { trackId });
}

export function nativeFetchTracksBatch(trackIds: number[]): Promise<TrackBatchResponse> {
  return invokeNative<TrackBatchResponse>("native_tracks_batch", { trackIds });
}

export function nativeFetchSimilarTracks(trackId: number, limit = 12): Promise<SimilarTrack[]> {
  return invokeNative<SimilarTrack[]>("native_similar_tracks", { trackId, limit });
}

export function nativeFetchAudiobooks(limit = 200, offset = 0): Promise<AudiobookListResponse> {
  return invokeNative<AudiobookListResponse>("native_audiobooks", { limit, offset });
}

export function nativeUpdateAudiobookProgress(
  trackId: number,
  requestBody: AudiobookProgressRequest,
): Promise<AudiobookProgressResponse> {
  return invokeNative<AudiobookProgressResponse>("native_update_audiobook_progress", {
    trackId,
    positionSeconds: requestBody.position_seconds,
    durationSeconds: requestBody.duration_seconds ?? null,
  });
}

export function nativeFetchAudiobookBookmarks(trackId: number): Promise<AudiobookBookmark[]> {
  return invokeNative<AudiobookBookmark[]>("native_audiobook_bookmarks", { trackId });
}

export function nativeCreateAudiobookBookmark(
  trackId: number,
  requestBody: AudiobookBookmarkRequest,
): Promise<AudiobookBookmark> {
  return invokeNative<AudiobookBookmark>("native_create_audiobook_bookmark", {
    trackId,
    positionSeconds: requestBody.position_seconds,
    label: requestBody.label ?? null,
    note: requestBody.note ?? null,
  });
}

export function nativeDeleteAudiobookBookmark(bookmarkId: number): Promise<{ deleted: boolean }> {
  return invokeNative<{ deleted: boolean }>("native_delete_audiobook_bookmark", { bookmarkId });
}

export function nativeFetchAudiobookChapters(trackId: number): Promise<AudiobookChapter[]> {
  return invokeNative<AudiobookChapter[]>("native_audiobook_chapters", { trackId });
}

export function nativeSaveAudiobookChapters(trackId: number, chapters: AudiobookChapter[]): Promise<AudiobookChapter[]> {
  return invokeNative<AudiobookChapter[]>("native_save_audiobook_chapters", { trackId, chapters });
}

export function nativeFetchRadioStations(): Promise<RadioStation[]> {
  return invokeNative<RadioStation[]>("native_radio_stations");
}

export function nativeSaveRadioStation(
  requestBody: RadioStationPayload,
  stationId?: number | null,
): Promise<RadioStation> {
  return invokeNative<RadioStation>("native_save_radio_station", {
    stationId: stationId ?? null,
    name: requestBody.name,
    streamUrl: requestBody.stream_url,
    homepageUrl: requestBody.homepage_url ?? null,
    genre: requestBody.genre ?? null,
    notes: requestBody.notes ?? null,
  });
}

export function nativeDeleteRadioStation(stationId: number): Promise<{ deleted: boolean }> {
  return invokeNative<{ deleted: boolean }>("native_delete_radio_station", { stationId });
}

export function nativeMarkRadioStationPlayed(stationId: number): Promise<RadioStation> {
  return invokeNative<RadioStation>("native_mark_radio_station_played", { stationId });
}

export function nativeFetchLovedTracks(limit = 100): Promise<LovedTrack[]> {
  return invokeNative<LovedTrack[]>("native_loved_tracks", { limit });
}

export function nativeUpdateTrackLove(trackId: number, loved: boolean, source = "local"): Promise<TrackLoveResponse> {
  return invokeNative<TrackLoveResponse>("native_update_track_love", { trackId, loved, source });
}

export function nativeUpdateTrackRating(trackId: number, rating: number | null): Promise<Track> {
  return invokeNative<Track>("native_update_track_rating", { trackId, rating });
}

export function nativeMarkTrackPlayed(trackId: number): Promise<Track> {
  return invokeNative<Track>("native_mark_track_played", { trackId });
}

export function nativeMarkTrackSkipped(trackId: number): Promise<Track> {
  return invokeNative<Track>("native_mark_track_skipped", { trackId });
}

export function nativeFetchAlbums(search = "", limit = 20000, offset = 0): Promise<AlbumSummary[]> {
  return invokeNative<AlbumSummary[]>("native_albums", { search, limit, offset });
}

export function nativeFetchArtists(search = "", limit = 20000, offset = 0): Promise<ArtistSummary[]> {
  return invokeNative<ArtistSummary[]>("native_artists", { search, limit, offset });
}

export function nativeFetchPlaylists(): Promise<PlaylistSummary[]> {
  return invokeNative<PlaylistSummary[]>("native_playlists");
}

export function nativeCreatePlaylist(name: string): Promise<PlaylistSummary> {
  return invokeNative<PlaylistSummary>("native_create_playlist", { name });
}

export function nativeDeletePlaylist(playlistId: number): Promise<PlaylistSummary[]> {
  return invokeNative<PlaylistSummary[]>("native_delete_playlist", { playlistId });
}

export function nativeFetchAlbumTracks(albumId: number): Promise<Track[]> {
  return invokeNative<Track[]>("native_album_tracks", { albumId });
}

export function nativeFetchPlaylistTracks(playlistId: number): Promise<Track[]> {
  return invokeNative<Track[]>("native_playlist_tracks", { playlistId });
}

export function nativeAddTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<Track[]> {
  return invokeNative<Track[]>("native_add_playlist_tracks", { playlistId, trackIds });
}

export function nativeRemoveTrackFromPlaylist(playlistId: number, trackId: number): Promise<Track[]> {
  return invokeNative<Track[]>("native_remove_playlist_track", { playlistId, trackId });
}

export function nativeMoveTrackInPlaylist(
  playlistId: number,
  trackId: number,
  direction: "up" | "down",
): Promise<Track[]> {
  return invokeNative<Track[]>("native_move_playlist_track", { playlistId, trackId, direction });
}

export function nativeFetchHistory(limit = 200): Promise<PlayEventEntry[]> {
  return invokeNative<PlayEventEntry[]>("native_history", { limit });
}

export function nativeFetchHistoryStats(limit = 10): Promise<HistoryStatsResponse> {
  return invokeNative<HistoryStatsResponse>("native_history_stats", { limit });
}

export function nativeFetchLibraryStats(): Promise<LibraryStatsResponse> {
  return invokeNative<LibraryStatsResponse>("native_library_stats");
}

export function nativeClearLibraryCaches(targets: CacheClearTarget[]): Promise<CacheClearResponse> {
  return invokeNative<CacheClearResponse>("native_clear_library_caches", { targets });
}

export function nativeFetchBulkUndoLog(limit = 30): Promise<BulkUndoLogEntry[]> {
  return invokeNative<BulkUndoLogEntry[]>("native_bulk_undo_log", { limit });
}

export function nativeFetchBulkUndoBatches(limit = 30): Promise<BulkUndoBatchEntry[]> {
  return invokeNative<BulkUndoBatchEntry[]>("native_bulk_undo_batches", { limit });
}

export function nativeFetchLibraryHealth(limit = 300): Promise<LibraryHealthResponse> {
  return invokeNative<LibraryHealthResponse>("native_library_health", { limit });
}

export function nativeGenerateAutoDj(settings: AutoDjSettings): Promise<AutoDjResponse> {
  return invokeNative<AutoDjResponse>("native_generate_autodj", { settings });
}

export function nativeFetchAutoDjAvoidRules(): Promise<AutoDjAvoidRule[]> {
  return invokeNative<AutoDjAvoidRule[]>("native_autodj_avoid_rules");
}

export function nativeCreateAutoDjAvoidRule(requestBody: {
  scope: "track" | "artist" | "album" | "genre";
  track_id?: number | null;
  value?: string | null;
}): Promise<AutoDjAvoidRule> {
  return invokeNative<AutoDjAvoidRule>("native_create_autodj_avoid_rule", {
    scope: requestBody.scope,
    trackId: requestBody.track_id ?? null,
    value: requestBody.value ?? null,
  });
}

export function nativeDeleteAutoDjAvoidRule(ruleId: number): Promise<AutoDjAvoidRule[]> {
  return invokeNative<AutoDjAvoidRule[]>("native_delete_autodj_avoid_rule", { ruleId });
}

export function nativeLibraryReconcilePreview({
  paths,
  extensions,
  sampleLimit = 25,
}: {
  paths: string[];
  extensions?: string[] | null;
  sampleLimit?: number;
}): Promise<NativeLibraryReconcilePreview> {
  return invokeNative<NativeLibraryReconcilePreview>("native_library_reconcile_preview", {
    paths,
    extensions: extensions ?? null,
    sampleLimit,
  });
}

export function nativeFileOrganizationPreview(requestBody: FileOrganizationRequest): Promise<FileOrganizationResponse> {
  return invokeNative<FileOrganizationResponse>("native_file_organization_preview", {
    template: requestBody.template,
    baseFolder: requestBody.base_folder ?? null,
    trackIds: requestBody.track_ids ?? null,
    collisionStrategy: requestBody.collision_strategy ?? null,
    cleanupEmptyFolders: requestBody.cleanup_empty_folders ?? false,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function nativeParsePlaylist(playlistPath: string): Promise<NativePlaylistParseResponse> {
  return invokeNative<NativePlaylistParseResponse>("native_parse_playlist", { playlistPath });
}

export function nativeExportM3u(playlistPath: string, trackPaths: string[]): Promise<ExportResponse> {
  return invokeNative<ExportResponse>("native_export_m3u", { playlistPath, trackPaths });
}

export function nativeVolumeTagsPreview(requestBody: VolumeTagRequest): Promise<VolumeTagResponse> {
  return invokeNative<VolumeTagResponse>("native_volume_tags_preview", {
    trackIds: requestBody.track_ids ?? null,
    manualTrackGainDb: requestBody.manual_track_gain_db ?? null,
    manualTrackPeak: requestBody.manual_track_peak ?? null,
    manualAlbumGainDb: requestBody.manual_album_gain_db ?? null,
    manualAlbumPeak: requestBody.manual_album_peak ?? null,
    limit: requestBody.limit ?? null,
  });
}

export function nativeBulkFileMovePreview(
  moves: Array<[string, string]>,
  apply = false,
): Promise<NativeBulkFileMoveResponse> {
  return invokeNative<NativeBulkFileMoveResponse>("native_bulk_file_move_preview", { moves, apply });
}

export function nativeGaplessValidate(requestBody: GaplessValidationRequest): Promise<GaplessValidationResponse> {
  return invokeNative<GaplessValidationResponse>("native_gapless_validate", {
    trackIds: requestBody.track_ids ?? null,
    albumId: requestBody.album_id ?? null,
    limit: requestBody.limit ?? null,
  });
}
