import type {
  AlbumCompletionLookupResponse,
  AlbumSummary,
  AlbumArtworkCandidatesResponse,
  AlbumArtworkCollisionResponse,
  AlbumArtworkSearchResponse,
  AlbumArtworkUpdateResponse,
  ArtistInfoResponse,
  ArtistSummary,
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AudioAnalysisStartRequest,
  AudioAnalysisStartResponse,
  AudioConversionInstallProgress,
  AudioConversionInstallRequest,
  AudioConversionInstallStartResponse,
  AudioConversionPreviewResponse,
  AudioConversionProgress,
  AudioConversionRequest,
  AudioConversionSetupRequest,
  AudioConversionSetupResponse,
  AudioConversionStartResponse,
  AudiobookBookmark,
  AudiobookBookmarkRequest,
  AudiobookChapter,
  AudiobookListResponse,
  AudiobookProgressRequest,
  AudiobookProgressResponse,
  AudiobookSyncExportResponse,
  AutoDjAvoidRule,
  AutoDjResponse,
  AutoDjSettings,
  AutoTagRequest,
  AutoTagResponse,
  AcousticFingerprintRequest,
  AcousticFingerprintResponse,
  AdvancedTrackSearchFilters,
  BackupResponse,
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  BulkUndoRestoreResponse,
  CacheClearResponse,
  CacheClearTarget,
  ChromaprintConfigRequest,
  ChromaprintStatusResponse,
  CdPlaybackResponse,
  CdRipMetadataRequest,
  CdRipMetadataResponse,
  CdRipProgress,
  CdRipSetupResponse,
  CdRipStartRequest,
  CdRipStartResponse,
  CdRipTrackMetadata,
  ClapConfigRequest,
  ClapGenreTagRequest,
  ClapGenreTagResponse,
  ClapInstallProgress,
  ClapInstallRequest,
  ClapInstallStartResponse,
  ClapStatusResponse,
  CsvMetadataExportRequest,
  CsvMetadataExportResponse,
  CsvMetadataImportReportRequest,
  CsvMetadataImportReportResponse,
  CsvMetadataImportRequest,
  CsvMetadataImportResponse,
  CustomTagBatchRequest,
  CustomTagBatchResponse,
  ExportResponse,
  ExtensionListResponse,
  DuplicateActionRequest,
  DuplicateActionResponse,
  DeviceSyncDevicesResponse,
  DeviceSyncProfile,
  DeviceSyncProfilePayload,
  DeviceSyncProfilesResponse,
  DeviceSyncRequest,
  DeviceSyncResponse,
  DuplicateReviewRequest,
  DuplicateReviewResponse,
  FileOrganizationRequest,
  FileOrganizationReportRequest,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  GaplessValidationRequest,
  GaplessValidationResponse,
  FolderWatchApplyResponse,
  FolderWatchStatus,
  FilenameTagInferenceRequest,
  FilenameTagInferenceResponse,
  LibraryHealthResponse,
  LibrarySourceRemoveResponse,
  LocalDataResetResponse,
  LibraryStatsImportRequest,
  LibraryStatsImportResponse,
  InboxAutoReviewRuleApplyResponse,
  InboxAutoReviewRuleDeleteResponse,
  InboxAutoReviewRuleRequest,
  InboxResponse,
  InboxReviewResponse,
  InboxTrackNote,
  HistoryStatsResponse,
  LastFmLoginCompleteResponse,
  LastFmLoginStartResponse,
  LibraryStatsResponse,
  LogTailResponse,
  LyricsLookupRequest,
  LyricsResponse,
  LyricsUpdateRequest,
  PlayEventEntry,
  PlaylistSummary,
  PodcastEpisode,
  PodcastDeleteDownloadResponse,
  PodcastFolderResponse,
  PodcastRefreshResponse,
  PodcastSubscription,
  PodcastSubscriptionDeleteResponse,
  PodcastSubscriptionPayload,
  RadioStation,
  RadioStationPayload,
  RecommendationProfile,
  LovedTrack,
  ScrobbleAccount,
  ScrobbleAccountRequest,
  ScrobbleHistoryImportResponse,
  ScrobbleOutboxEntry,
  ScrobbleQueueHistoryResponse,
  ScrobbleService,
  ScrobbleSubmitResponse,
  TrackLoveResponse,
  RecommendationAbChoiceResponse,
  RecommendationAbTestResponse,
  RecommendationProfileComparison,
  RecommendationProfileComparisonExportResponse,
  RecommendationProfileComparisonImportResponse,
  RecommendationRun,
  RegexTagPreset,
  RegexTagPresetRequest,
  ReportFileRequest,
  ReportFileResponse,
  desktopScanSnapshot,
  ScanProgress,
  ScanResult,
  ScanStartResponse,
  SettingsResponse,
  SettingsUpdateRequest,
  SimilarTrack,
  StartupDiagnosticsResponse,
  SupportBundleResponse,
  TagRegexReplaceRequest,
  TagRegexReplaceResponse,
  TagBackupRequest,
  TagBackupResponse,
  TagBackupRestoreRequest,
  TagBackupRestoreResponse,
  TagBackupSummary,
  TagFieldCopySwapRequest,
  TagFieldCopySwapResponse,
  Track,
  TrackBatchResponse,
  TrackDeleteResponse,
  TrackFileMetadataWriteRequest,
  TrackFileMetadataWriteResponse,
  TrackMetadataSyncResponse,
  TracksDeleteResponse,
  TrackMetadataUpdate,
  TrackPage,
  TrackRestoreRequest,
  VirtualTagDefinition,
  VirtualTagDefinitionRequest,
  VirtualTagPreviewRequest,
  VirtualTagPreviewResponse,
  VolumeTagRequest,
  VolumeTagResponse,
} from "../../types/api";
import {
  desktopFetchAlbumTracks,
  desktopFetchAlbums,
  desktopFetchArtists,
  desktopFetchAudiobookBookmarks,
  desktopFetchAudiobookChapters,
  desktopFetchAudiobooks,
  desktopFetchBackendHealth,
  desktopFetchClapCoverage,
  desktopFetchHistory,
  desktopFetchHistoryStats,
  desktopFetchLibraryInbox,
  desktopFetchLibraryHealth,
  desktopFetchLibraryStats,
  desktopFetchLovedTracks,
  desktopFetchPlaylistTracks,
  desktopFetchPlaylists,
  desktopFetchRecommendationHistory,
  desktopFetchRecommendationProfiles,
  desktopFetchRadioStations,
  desktopFetchSimilarTracks,
  desktopFetchSettings,
  desktopFetchTrack,
  desktopFetchTrackPage,
  desktopFetchTracksBatch,
  desktopFileOrganizationPreview,
  desktopGaplessValidate,
  desktopGenerateAutoDj,
  desktopAddTracksToPlaylist,
  desktopCreateAudiobookBookmark,
  desktopCreatePlaylist,
  desktopDeletePlaylist,
  desktopCreateAutoDjAvoidRule,
  desktopDeleteAutoDjAvoidRule,
  desktopDeleteAudiobookBookmark,
  desktopDeleteDeviceSyncProfile,
  desktopDeleteRadioStation,
  desktopDeleteRegexTagPreset,
  desktopDeleteVirtualTag,
  desktopFetchAutoDjAvoidRules,
  desktopClearLibraryCaches,
  desktopFetchBulkUndoBatches,
  desktopFetchBulkUndoLog,
  desktopFetchDeviceSyncProfiles,
  desktopMarkTrackPlayed,
  desktopMarkTrackSkipped,
  desktopMarkRadioStationPlayed,
  desktopMoveTrackInPlaylist,
  desktopRecordRecommendationFeedback,
  desktopRemoveTrackFromPlaylist,
  desktopRemoveLibrarySource,
  desktopReviewInbox,
  desktopSaveAudiobookChapters,
  desktopSaveDeviceSyncProfile,
  desktopSaveRadioStation,
  desktopSaveRegexTagPreset,
  desktopSaveRecommendationProfile,
  desktopSaveVirtualTag,
  desktopSetDefaultRecommendationProfile,
  desktopDeleteRecommendationProfile,
  desktopUpdateAudiobookProgress,
  desktopUpdateInboxNote,
  desktopUpdateSettings,
  desktopUpdateTrackLove,
  desktopUpdateTrackRating,
  desktopVolumeTagsPreview,
  desktopFetchRegexTagPresets,
  desktopFetchVirtualTags,
  desktopCreateInboxAutoReviewRule,
  desktopUpdateInboxAutoReviewRule,
  desktopDeleteInboxAutoReviewRule,
  desktopCustomTags,
  desktopVirtualTagPreview,
  desktopCopySwapTags,
  desktopRegexTags,
  desktopFetchPodcastSubscriptions,
  desktopSavePodcastSubscription,
  desktopDeletePodcastSubscription,
  desktopEnsurePodcastSubscriptionFolder,
  desktopFetchPodcastEpisodes,
  desktopFetchScrobbleAccounts,
  desktopSaveScrobbleAccount,
  desktopFetchScrobbleOutbox,
  desktopFetchDuplicateReview,
  desktopFetchArtistLocalTracks,
  desktopClearArtistCache,
  desktopChooseRecommendationAbTest,
  desktopCompareRecommendationProfiles,
  desktopCreateRecommendationAbTest,
  desktopExportRecommendationProfileComparison,
  desktopFetchArtistInfo,
  desktopFetchAudioConversionSetup,
  desktopFetchChromaprintSetup,
  desktopImportRecommendationProfileComparison,
  desktopInferFilenameTags,
  desktopQueueScrobbleHistory,
  desktopRestoreBulkUndoBatch,
  desktopRestoreBulkUndoEntry,
  desktopSaveAudioConversionSetup,
  desktopBackendJson,
  desktopSaveChromaprintSetup,
} from "../desktopLibrary";

const ARTWORK_URL_SESSION_VERSION = Date.now().toString(36);

function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestViaPythonWorker<T>(path, init);
}

function requestBodyJson(init?: RequestInit): unknown {
  if (!init?.body) {
    return null;
  }
  if (typeof init.body === "string") {
    return init.body.trim() ? JSON.parse(init.body) : null;
  }
  return null;
}

function requestViaPythonWorker<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isTauriDesktop()) {
    return Promise.reject(new Error("FLAC Cafe desktop APIs require the Tauri shell."));
  }
  return desktopBackendJson<T>(init?.method ?? "GET", path, requestBodyJson(init));
}

function desktopMediaUrl(path: string): string | null {
  if (!isTauriDesktop()) {
    return null;
  }
  return `flaccafe-media://localhost${path}`;
}


export function fetchClapStatus(deep = false): Promise<ClapStatusResponse> {
  return request<ClapStatusResponse>(`/analysis/clap/status${deep ? "?deep=true" : ""}`);
}

export function fetchClapCoverage(): Promise<AudioAnalysisCoverage> {
  return desktopFetchClapCoverage().catch(() => request<AudioAnalysisCoverage>("/analysis/clap/coverage"));
}

export function startClapInstall(requestBody: ClapInstallRequest): Promise<ClapInstallStartResponse> {
  return request<ClapInstallStartResponse>("/analysis/clap/install", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchClapInstall(jobId: string): Promise<ClapInstallProgress> {
  return request<ClapInstallProgress>(`/analysis/clap/install/${jobId}`);
}

export function updateClapConfig(config: ClapConfigRequest): Promise<ClapStatusResponse> {
  return request<ClapStatusResponse>("/analysis/clap/config", {
    method: "PATCH",
    body: JSON.stringify(config),
  });
}

export function startClapAudioAnalysis(
  requestBody: AudioAnalysisStartRequest,
): Promise<AudioAnalysisStartResponse> {
  return request<AudioAnalysisStartResponse>("/analysis/clap/start", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchClapAudioAnalysis(jobId: string): Promise<AudioAnalysisProgress> {
  return request<AudioAnalysisProgress>(`/analysis/clap/jobs/${jobId}`);
}

export function pauseClapAudioAnalysis(jobId: string): Promise<AudioAnalysisProgress> {
  return request<AudioAnalysisProgress>(`/analysis/clap/jobs/${jobId}/pause`, { method: "POST" });
}

export function resumeClapAudioAnalysis(jobId: string): Promise<AudioAnalysisProgress> {
  return request<AudioAnalysisProgress>(`/analysis/clap/jobs/${jobId}/resume`, { method: "POST" });
}

export function cancelClapAudioAnalysis(jobId: string): Promise<AudioAnalysisProgress> {
  return request<AudioAnalysisProgress>(`/analysis/clap/jobs/${jobId}/cancel`, { method: "POST" });
}

export function fetchTracks(
  search = "",
  options: {
    limit?: number | null;
    offset?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    advancedFilters?: AdvancedTrackSearchFilters;
  } = {},
): Promise<Track[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    params.set("offset", String(options.offset));
  }
  if (options.sortBy) {
    params.set("sort_by", options.sortBy);
  }
  if (options.sortDirection) {
    params.set("sort_direction", options.sortDirection);
  }
  appendAdvancedTrackSearchFilters(params, options.advancedFilters);
  const query = params.toString();
  return desktopFetchTrackPage({
    search,
    limit: options.limit ?? 100000,
    offset: options.offset ?? 0,
    sortBy: options.sortBy ?? "artist",
    sortDirection: options.sortDirection ?? "asc",
    advancedFilters: options.advancedFilters,
  })
    .then((page) => page.tracks)
    .catch(() => request<Track[]>(query ? `/tracks?${query}` : "/tracks"));
}

function appendAdvancedTrackSearchFilters(params: URLSearchParams, filters?: AdvancedTrackSearchFilters) {
  if (!filters) {
    return;
  }
  (["artist", "album", "genre", "path", "extension"] as const).forEach((key) => {
    const value = filters[key]?.trim();
    if (value) {
      params.set(key, value);
    }
  });
  if (filters.rating_state && filters.rating_state !== "any") {
    params.set("rating_state", filters.rating_state);
  }
  (["min_rating", "max_rating", "year_from", "year_to", "min_duration", "max_duration"] as const).forEach((key) => {
    const rawValue = filters[key]?.trim();
    if (!rawValue) {
      return;
    }
    const value = Number(rawValue);
    if (Number.isFinite(value)) {
      params.set(key, String(value));
    }
  });
  if (filters.missing_metadata) {
    params.set("missing_metadata", "true");
  }
}

export function fetchTrack(trackId: number): Promise<Track> {
  return desktopFetchTrack(trackId).catch(() => request<Track>(`/tracks/${trackId}`));
}

export function fetchTracksBatch(trackIds: number[]): Promise<TrackBatchResponse> {
  return desktopFetchTracksBatch(trackIds).catch(() =>
    request<TrackBatchResponse>("/tracks/batch", {
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),
  );
}

export function fetchSimilarTracks(trackId: number, limit = 12): Promise<SimilarTrack[]> {
  return desktopFetchSimilarTracks(trackId, limit);
}

export function deleteTrack(trackId: number, deleteFile = false): Promise<TrackDeleteResponse> {
  const params = new URLSearchParams({ delete_file: String(deleteFile) });
  return request<TrackDeleteResponse>(`/tracks/${trackId}?${params.toString()}`, { method: "DELETE" });
}

export function deleteTracks(trackIds: number[], deleteFile = false): Promise<TracksDeleteResponse> {
  return request<TracksDeleteResponse>("/tracks/delete", {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds, delete_file: deleteFile }),
  });
}

export function syncTrackMetadata(trackIds: number[]): Promise<TrackMetadataSyncResponse> {
  return request<TrackMetadataSyncResponse>("/tracks/sync-metadata", {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  });
}

export function writeTrackMetadataToFiles(requestBody: TrackFileMetadataWriteRequest): Promise<TrackFileMetadataWriteResponse> {
  return request<TrackFileMetadataWriteResponse>("/library/tools/write-metadata-to-files", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function updateTrackMetadata(trackId: number, metadata: TrackMetadataUpdate): Promise<Track> {
  return request<Track>(`/tracks/${trackId}/metadata`, {
    method: "PATCH",
    body: JSON.stringify(metadata),
  });
}

export function restoreTrack(requestBody: TrackRestoreRequest): Promise<Track> {
  return request<Track>("/tracks/restore", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchTrackPage({
  search = "",
  limit = 150,
  offset = 0,
  sortBy = "artist",
  sortDirection = "asc",
  advancedFilters,
}: {
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  advancedFilters?: AdvancedTrackSearchFilters;
}): Promise<TrackPage> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("sort_by", sortBy);
  params.set("sort_direction", sortDirection);
  appendAdvancedTrackSearchFilters(params, advancedFilters);
  return desktopFetchTrackPage({ search, limit, offset, sortBy, sortDirection, advancedFilters }).catch(() =>
    request<TrackPage>(`/tracks/page?${params.toString()}`),
  );
}

export function fetchAlbums(search = ""): Promise<AlbumSummary[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", "20000");
  return desktopFetchAlbums(search, 20000).catch(() => request<AlbumSummary[]>(`/albums?${params.toString()}`));
}

export function fetchArtists(search = ""): Promise<ArtistSummary[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", "20000");
  return desktopFetchArtists(search, 20000).catch(() => request<ArtistSummary[]>(`/artists?${params.toString()}`));
}

export function fetchAlbumTracks(albumId: number): Promise<Track[]> {
  return desktopFetchAlbumTracks(albumId).catch(() => request<Track[]>(`/albums/${albumId}/tracks`));
}

export function lookupAlbumCompletion(albumId: number): Promise<AlbumCompletionLookupResponse> {
  return request<AlbumCompletionLookupResponse>(`/albums/${albumId}/completion-lookup`, { method: "POST" });
}

export function fetchAlbumArtworkCandidates(albumId: number): Promise<AlbumArtworkCandidatesResponse> {
  return request<AlbumArtworkCandidatesResponse>(`/albums/${albumId}/artwork-candidates`);
}

export function searchAlbumArtworkWeb(albumId: number): Promise<AlbumArtworkSearchResponse> {
  return request<AlbumArtworkSearchResponse>(`/albums/${albumId}/artwork-search`);
}

export function chooseAlbumArtwork(albumId: number, artworkPath: string): Promise<AlbumArtworkUpdateResponse> {
  return request<AlbumArtworkUpdateResponse>(`/albums/${albumId}/artwork`, {
    method: "PATCH",
    body: JSON.stringify({ artwork_path: artworkPath }),
  });
}

export function embedAlbumArtworkFromPath(albumId: number, artworkPath: string): Promise<AlbumArtworkUpdateResponse> {
  return request<AlbumArtworkUpdateResponse>(`/albums/${albumId}/artwork`, {
    method: "PATCH",
    body: JSON.stringify({ artwork_path: artworkPath, embed_to_files: true }),
  });
}

export function saveEmbeddedAlbumArtwork(albumId: number, embeddedTrackId: number, sidecarFilename = "cover"): Promise<AlbumArtworkUpdateResponse> {
  return request<AlbumArtworkUpdateResponse>(`/albums/${albumId}/artwork`, {
    method: "PATCH",
    body: JSON.stringify({
      embedded_track_id: embeddedTrackId,
      save_embedded_as_sidecar: true,
      sidecar_filename: sidecarFilename,
    }),
  });
}

export function embedEmbeddedAlbumArtwork(albumId: number, embeddedTrackId: number): Promise<AlbumArtworkUpdateResponse> {
  return request<AlbumArtworkUpdateResponse>(`/albums/${albumId}/artwork`, {
    method: "PATCH",
    body: JSON.stringify({
      embedded_track_id: embeddedTrackId,
      embed_to_files: true,
    }),
  });
}

export function saveWebAlbumArtwork(albumId: number, artworkUrl: string, embedToFiles = false, sidecarFilename = "cover-web"): Promise<AlbumArtworkUpdateResponse> {
  return request<AlbumArtworkUpdateResponse>(`/albums/${albumId}/artwork`, {
    method: "PATCH",
    body: JSON.stringify({
      artwork_url: artworkUrl,
      save_web_as_sidecar: true,
      embed_to_files: embedToFiles,
      sidecar_filename: sidecarFilename,
    }),
  });
}

export function clearAlbumArtwork(albumId: number): Promise<AlbumArtworkUpdateResponse> {
  return request<AlbumArtworkUpdateResponse>(`/albums/${albumId}/artwork`, {
    method: "PATCH",
    body: JSON.stringify({ clear: true }),
  });
}

function artworkVersionQuery(version?: string | number | null): string {
  return `?v=${encodeURIComponent(String(version ?? ARTWORK_URL_SESSION_VERSION))}`;
}

export function albumCoverUrl(albumId: number, version?: string | number | null): string {
  const query = artworkVersionQuery(version);
  return desktopMediaUrl(`/album-artwork/${albumId}${query}`) ?? "";
}

export function previewArtworkCollisions(limit = 200): Promise<AlbumArtworkCollisionResponse> {
  return request<AlbumArtworkCollisionResponse>("/library/tools/artwork-collisions", {
    method: "POST",
    body: JSON.stringify({ apply: false, limit }),
  });
}

export function applyArtworkCollisionRepair(limit = 200): Promise<AlbumArtworkCollisionResponse> {
  return request<AlbumArtworkCollisionResponse>("/library/tools/artwork-collisions", {
    method: "POST",
    body: JSON.stringify({ apply: true, limit }),
  });
}

export function fetchPlaylists(): Promise<PlaylistSummary[]> {
  return desktopFetchPlaylists().catch(() => request<PlaylistSummary[]>("/playlists"));
}

export function createPlaylist(name: string): Promise<PlaylistSummary> {
  return desktopCreatePlaylist(name).catch(() =>
    request<PlaylistSummary>("/playlists", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  );
}

export function deletePlaylist(playlistId: number): Promise<PlaylistSummary[]> {
  return desktopDeletePlaylist(playlistId).catch(() =>
    request<PlaylistSummary[]>(`/playlists/${playlistId}`, {
      method: "DELETE",
    }),
  );
}

export function fetchPlaylistTracks(playlistId: number): Promise<Track[]> {
  return desktopFetchPlaylistTracks(playlistId).catch(() => request<Track[]>(`/playlists/${playlistId}/tracks`));
}

export function addTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<Track[]> {
  return desktopAddTracksToPlaylist(playlistId, trackIds).catch(() =>
    request<Track[]>(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),
  );
}

export function removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<Track[]> {
  return desktopRemoveTrackFromPlaylist(playlistId, trackId).catch(() =>
    request<Track[]>(`/playlists/${playlistId}/tracks/${trackId}`, {
      method: "DELETE",
    }),
  );
}

export function moveTrackInPlaylist(
  playlistId: number,
  trackId: number,
  direction: "up" | "down",
): Promise<Track[]> {
  return desktopMoveTrackInPlaylist(playlistId, trackId, direction).catch(() =>
    request<Track[]>(`/playlists/${playlistId}/tracks/${trackId}/move`, {
      method: "PATCH",
      body: JSON.stringify({ direction }),
    }),
  );
}

export function exportPlaylist(playlistId: number): Promise<ExportResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify({ track_ids: [] }),
  };
  return requestViaPythonWorker<ExportResponse>(`/playlists/${playlistId}/export`, init).catch(() =>
    request<ExportResponse>(`/playlists/${playlistId}/export`, init),
  );
}

export function importPlaylist(playlistPath: string, name?: string): Promise<PlaylistSummary> {
  const init = {
    method: "POST",
    body: JSON.stringify({ playlist_path: playlistPath, name: name || null }),
  };
  return requestViaPythonWorker<PlaylistSummary>("/playlists/import", init).catch(() =>
    request<PlaylistSummary>("/playlists/import", init),
  );
}

function scanRequestBody(folderPaths: string | string[], saveLibraryPaths?: string[], desktopSnapshot?: desktopScanSnapshot | null) {
  const paths = (Array.isArray(folderPaths) ? folderPaths : [folderPaths]).map((path) => path.trim()).filter(Boolean);
  const savedPaths = (saveLibraryPaths ?? paths).map((path) => path.trim()).filter(Boolean);
  return {
    folder_path: paths[0] ?? "",
    folder_paths: paths,
    save_library_paths: savedPaths,
    snapshot: desktopSnapshot ?? null,
  };
}

export function scanLibrary(folderPath: string | string[], saveLibraryPaths?: string[], desktopSnapshot?: desktopScanSnapshot | null): Promise<ScanResult> {
  return request<ScanResult>("/scan", {
    method: "POST",
    body: JSON.stringify(scanRequestBody(folderPath, saveLibraryPaths, desktopSnapshot)),
  });
}

export function startScanLibrary(folderPath: string | string[], saveLibraryPaths?: string[], desktopSnapshot?: desktopScanSnapshot | null): Promise<ScanStartResponse> {
  return request<ScanStartResponse>("/scan/start", {
    method: "POST",
    body: JSON.stringify(scanRequestBody(folderPath, saveLibraryPaths, desktopSnapshot)),
  });
}

export function fetchScanProgress(jobId: string): Promise<ScanProgress> {
  return request<ScanProgress>(`/scan/jobs/${jobId}`);
}

export function updateTrackRating(trackId: number, rating: number | null): Promise<Track> {
  return desktopUpdateTrackRating(trackId, rating).catch(() =>
    request<Track>(`/tracks/${trackId}/rating`, {
      method: "PATCH",
      body: JSON.stringify({ rating }),
    }),
  );
}

export function audioUrl(trackId: number): string {
  return desktopMediaUrl(`/track-audio/${trackId}`) ?? "";
}

export function albumArtworkUrl(trackId: number, version?: string | number | null): string {
  const query = artworkVersionQuery(version);
  return desktopMediaUrl(`/track-artwork/${trackId}${query}`) ?? "";
}

export function fetchLyrics(trackId: number): Promise<LyricsResponse> {
  return requestViaPythonWorker<LyricsResponse>(`/tracks/${trackId}/lyrics`).catch(() =>
    request<LyricsResponse>(`/tracks/${trackId}/lyrics`),
  );
}

export function fetchLyricsOnline(trackId: number): Promise<LyricsResponse> {
  return request<LyricsResponse>(`/tracks/${trackId}/lyrics/fetch`, { method: "POST" });
}

export function fetchLyricsByMetadata(requestBody: LyricsLookupRequest): Promise<LyricsResponse> {
  return request<LyricsResponse>("/lyrics/lookup", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function updateLyrics(trackId: number, requestBody: LyricsUpdateRequest): Promise<LyricsResponse> {
  const init = {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  };
  return requestViaPythonWorker<LyricsResponse>(`/tracks/${trackId}/lyrics`, init).catch(() =>
    request<LyricsResponse>(`/tracks/${trackId}/lyrics`, init),
  );
}

export function fetchArtistInfo(artistName: string, refresh = false): Promise<ArtistInfoResponse> {
  const params = new URLSearchParams({ name: artistName });
  if (refresh) {
    params.set("refresh", "true");
  }
  return desktopFetchArtistInfo(artistName, refresh).catch(() =>
    request<ArtistInfoResponse>(`/artists/info?${params.toString()}`),
  );
}

export function markTrackPlayed(trackId: number): Promise<Track> {
  return desktopMarkTrackPlayed(trackId).catch(() =>
    request<Track>(`/tracks/${trackId}/played`, {
      method: "POST",
    }),
  );
}

export function markTrackSkipped(trackId: number): Promise<Track> {
  return desktopMarkTrackSkipped(trackId).catch(() =>
    request<Track>(`/tracks/${trackId}/skipped`, {
      method: "POST",
    }),
  );
}

export function fetchArtistLocalTracks(artistName: string, limit = 100): Promise<Track[]> {
  const params = new URLSearchParams({ name: artistName, limit: String(limit) });
  return desktopFetchArtistLocalTracks(artistName, limit).catch(() =>
    request<Track[]>(`/artists/local-tracks?${params.toString()}`),
  );
}

export function clearArtistCache(): Promise<{ deleted: number }> {
  return desktopClearArtistCache().catch(() =>
    request<{ deleted: number }>("/artists/cache", {
      method: "DELETE",
    }),
  );
}
