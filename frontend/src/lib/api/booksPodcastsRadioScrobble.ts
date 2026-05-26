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


export function fetchAudiobooks(limit = 200, offset = 0): Promise<AudiobookListResponse> {
  return desktopFetchAudiobooks(limit, offset);
}

export function updateAudiobookProgress(trackId: number, requestBody: AudiobookProgressRequest): Promise<AudiobookProgressResponse> {
  return desktopUpdateAudiobookProgress(trackId, requestBody);
}

export function fetchAudiobookBookmarks(trackId: number): Promise<AudiobookBookmark[]> {
  return desktopFetchAudiobookBookmarks(trackId);
}

export function createAudiobookBookmark(trackId: number, requestBody: AudiobookBookmarkRequest): Promise<AudiobookBookmark> {
  return desktopCreateAudiobookBookmark(trackId, requestBody);
}

export function deleteAudiobookBookmark(bookmarkId: number): Promise<{ deleted: boolean }> {
  return desktopDeleteAudiobookBookmark(bookmarkId);
}

export function fetchAudiobookChapters(trackId: number): Promise<AudiobookChapter[]> {
  return desktopFetchAudiobookChapters(trackId);
}

export function saveAudiobookChapters(trackId: number, chapters: AudiobookChapter[]): Promise<AudiobookChapter[]> {
  return desktopSaveAudiobookChapters(trackId, chapters);
}

export function exportAudiobookSyncMetadata(trackIds?: number[] | null): Promise<AudiobookSyncExportResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds?.length ? trackIds : null }),
  };
  return requestViaPythonWorker<AudiobookSyncExportResponse>("/audiobooks/sync-export", init).catch(() =>
    request<AudiobookSyncExportResponse>("/audiobooks/sync-export", init),
  );
}

export function fetchPodcastSubscriptions(): Promise<PodcastSubscription[]> {
  return desktopFetchPodcastSubscriptions().catch(() => request<PodcastSubscription[]>("/podcasts/subscriptions"));
}

export function savePodcastSubscription(
  requestBody: PodcastSubscriptionPayload,
  subscriptionId?: number | null,
): Promise<PodcastSubscription> {
  return desktopSavePodcastSubscription(requestBody, subscriptionId).catch(() =>
    request<PodcastSubscription>(
      subscriptionId ? `/podcasts/subscriptions/${subscriptionId}` : "/podcasts/subscriptions",
      {
        method: subscriptionId ? "PATCH" : "POST",
        body: JSON.stringify(requestBody),
      },
    ),
  );
}

export function deletePodcastSubscription(subscriptionId: number, deleteFiles = false): Promise<PodcastSubscriptionDeleteResponse> {
  const query = deleteFiles ? "?delete_files=true" : "";
  return desktopDeletePodcastSubscription(subscriptionId, deleteFiles).catch(() =>
    request<PodcastSubscriptionDeleteResponse>(`/podcasts/subscriptions/${subscriptionId}${query}`, { method: "DELETE" }),
  );
}

export function refreshPodcastSubscription(subscriptionId: number): Promise<PodcastRefreshResponse> {
  const init = { method: "POST" };
  return requestViaPythonWorker<PodcastRefreshResponse>(`/podcasts/subscriptions/${subscriptionId}/refresh`, init).catch(() =>
    request<PodcastRefreshResponse>(`/podcasts/subscriptions/${subscriptionId}/refresh`, init),
  );
}

export function ensurePodcastSubscriptionFolder(subscriptionId: number): Promise<PodcastFolderResponse> {
  return desktopEnsurePodcastSubscriptionFolder(subscriptionId).catch(() =>
    request<PodcastFolderResponse>(`/podcasts/subscriptions/${subscriptionId}/folder`, { method: "POST" }),
  );
}

export function fetchPodcastEpisodes(subscriptionId?: number | null, limit = 200): Promise<PodcastEpisode[]> {
  const query = subscriptionId ? `?subscription_id=${subscriptionId}&limit=${limit}` : `?limit=${limit}`;
  return desktopFetchPodcastEpisodes(subscriptionId, limit).catch(() => request<PodcastEpisode[]>(`/podcasts/episodes${query}`));
}

export function downloadPodcastEpisode(episodeId: number, downloadFolder?: string | null): Promise<PodcastEpisode> {
  return request<PodcastEpisode>(`/podcasts/episodes/${episodeId}/download`, {
    method: "POST",
    body: JSON.stringify({ download_folder: downloadFolder || null }),
  });
}

export function deletePodcastEpisodeDownload(episodeId: number): Promise<PodcastDeleteDownloadResponse> {
  return request<PodcastDeleteDownloadResponse>(`/podcasts/episodes/${episodeId}/download`, { method: "DELETE" });
}

export function ensurePodcastEpisodeTrack(episodeId: number): Promise<Track> {
  return request<Track>(`/podcasts/episodes/${episodeId}/track`, { method: "POST" });
}

export function fetchRadioStations(): Promise<RadioStation[]> {
  return desktopFetchRadioStations();
}

export function saveRadioStation(requestBody: RadioStationPayload, stationId?: number | null): Promise<RadioStation> {
  return desktopSaveRadioStation(requestBody, stationId);
}

export function deleteRadioStation(stationId: number): Promise<{ deleted: boolean }> {
  return desktopDeleteRadioStation(stationId);
}

export function markRadioStationPlayed(stationId: number): Promise<RadioStation> {
  return desktopMarkRadioStationPlayed(stationId);
}

export function fetchScrobbleAccounts(): Promise<ScrobbleAccount[]> {
  return desktopFetchScrobbleAccounts().catch(() => request<ScrobbleAccount[]>("/scrobbling/accounts"));
}

export function saveScrobbleAccount(service: ScrobbleService, requestBody: ScrobbleAccountRequest): Promise<ScrobbleAccount> {
  return desktopSaveScrobbleAccount(service, requestBody).catch(() =>
    request<ScrobbleAccount>(`/scrobbling/accounts/${service}`, {
      method: "PATCH",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function startLastFmLogin(apiKey?: string | null, apiSecret?: string | null): Promise<LastFmLoginStartResponse> {
  return request<LastFmLoginStartResponse>("/scrobbling/lastfm/login/start", {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey ?? "", api_secret: apiSecret ?? "" }),
  });
}

export function completeLastFmLogin(
  token: string,
  enabled = true,
  apiKey?: string | null,
  apiSecret?: string | null,
): Promise<LastFmLoginCompleteResponse> {
  return request<LastFmLoginCompleteResponse>("/scrobbling/lastfm/login/complete", {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey ?? "", api_secret: apiSecret ?? "", token, enabled }),
  });
}

export function fetchScrobbleOutbox(limit = 100): Promise<ScrobbleOutboxEntry[]> {
  return desktopFetchScrobbleOutbox(limit).catch(() => request<ScrobbleOutboxEntry[]>(`/scrobbling/outbox?limit=${limit}`));
}

export function queueScrobbleHistory(service: ScrobbleService, limit = 100): Promise<ScrobbleQueueHistoryResponse> {
  return desktopQueueScrobbleHistory(service, limit).catch(() =>
    request<ScrobbleQueueHistoryResponse>("/scrobbling/outbox/queue-history", {
      method: "POST",
      body: JSON.stringify({ service, limit }),
    }),
  );
}

export function submitScrobbleOutbox(service: ScrobbleService, limit = 50): Promise<ScrobbleSubmitResponse> {
  return request<ScrobbleSubmitResponse>("/scrobbling/outbox/submit", {
    method: "POST",
    body: JSON.stringify({ service, limit }),
  });
}

export function fetchLovedTracks(limit = 100): Promise<LovedTrack[]> {
  return desktopFetchLovedTracks(limit);
}

export function updateTrackLove(trackId: number, loved: boolean, source = "local"): Promise<TrackLoveResponse> {
  return desktopUpdateTrackLove(trackId, loved, source);
}

export function importScrobbleHistory(csvPath: string, apply = false, limit = 10000): Promise<ScrobbleHistoryImportResponse> {
  return request<ScrobbleHistoryImportResponse>("/scrobbling/import-history", {
    method: "POST",
    body: JSON.stringify({ csv_path: csvPath, apply, limit }),
  });
}

export function validateGaplessPlayback(requestBody: GaplessValidationRequest): Promise<GaplessValidationResponse> {
  return desktopGaplessValidate(requestBody).catch(() =>
    request<GaplessValidationResponse>("/playback/gapless/validate", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function validateGaplessPlaybackViaBackend(requestBody: GaplessValidationRequest): Promise<GaplessValidationResponse> {
  return request<GaplessValidationResponse>("/playback/gapless/validate", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchExtensions(): Promise<ExtensionListResponse> {
  return requestViaPythonWorker<ExtensionListResponse>("/extensions").catch(() =>
    request<ExtensionListResponse>("/extensions"),
  );
}

export function reloadExtensions(): Promise<ExtensionListResponse> {
  const init = { method: "POST" };
  return requestViaPythonWorker<ExtensionListResponse>("/extensions/reload", init).catch(() =>
    request<ExtensionListResponse>("/extensions/reload", init),
  );
}

export function importLibraryStats(requestBody: LibraryStatsImportRequest): Promise<LibraryStatsImportResponse> {
  return request<LibraryStatsImportResponse>("/library/importers/stats", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}
