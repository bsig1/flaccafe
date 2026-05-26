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


export function fetchSettings(): Promise<SettingsResponse> {
  return desktopFetchSettings().catch(() => request<SettingsResponse>("/settings"));
}

export function fetchBackendHealth(): Promise<{ status: string }> {
  return desktopFetchBackendHealth().catch(() => request<{ status: string }>("/health"));
}

export function fetchStartupDiagnostics(): Promise<StartupDiagnosticsResponse> {
  return requestViaPythonWorker<StartupDiagnosticsResponse>("/diagnostics/startup").catch(() =>
    request<StartupDiagnosticsResponse>("/diagnostics/startup"),
  );
}

export function fetchBackendLog(limit = 200): Promise<LogTailResponse> {
  return requestViaPythonWorker<LogTailResponse>(`/diagnostics/logs/backend?limit=${limit}`).catch(() =>
    request<LogTailResponse>(`/diagnostics/logs/backend?limit=${limit}`),
  );
}

export function createSupportBundle(): Promise<SupportBundleResponse> {
  const init = { method: "POST" };
  return requestViaPythonWorker<SupportBundleResponse>("/diagnostics/support-bundle", init).catch(() =>
    request<SupportBundleResponse>("/diagnostics/support-bundle", init),
  );
}

export function backupDatabase(): Promise<BackupResponse> {
  const init = { method: "POST" };
  return requestViaPythonWorker<BackupResponse>("/settings/backup", init).catch(() =>
    request<BackupResponse>("/settings/backup", init),
  );
}

export function resetLocalData(confirmation: string): Promise<LocalDataResetResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  };
  return requestViaPythonWorker<LocalDataResetResponse>("/settings/reset-local-data", init).catch(() =>
    request<LocalDataResetResponse>("/settings/reset-local-data", init),
  );
}

export function updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return desktopUpdateSettings(settings).catch(() =>
    request<SettingsResponse>("/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),
  );
}

export function removeLibrarySource(path: string): Promise<LibrarySourceRemoveResponse> {
  return desktopRemoveLibrarySource(path).catch(() =>
    request<LibrarySourceRemoveResponse>("/settings/library-sources/remove", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  );
}

export function fetchHistory(limit = 200): Promise<PlayEventEntry[]> {
  return desktopFetchHistory(limit).catch(() => request<PlayEventEntry[]>(`/history?limit=${limit}`));
}

export function fetchHistoryStats(limit = 10): Promise<HistoryStatsResponse> {
  return desktopFetchHistoryStats(limit).catch(() => request<HistoryStatsResponse>(`/history/stats?limit=${limit}`));
}

export function fetchLibraryStats(): Promise<LibraryStatsResponse> {
  return desktopFetchLibraryStats().catch(() => request<LibraryStatsResponse>("/library/stats"));
}

export function fetchLibraryHealth(limit = 300): Promise<LibraryHealthResponse> {
  return desktopFetchLibraryHealth(limit).catch(() => request<LibraryHealthResponse>(`/library/health?limit=${limit}`));
}

export function fetchLibraryInbox(limit = 200, offset = 0): Promise<InboxResponse> {
  return desktopFetchLibraryInbox(limit, offset).catch(() =>
    request<InboxResponse>(`/library/inbox?limit=${limit}&offset=${offset}`),
  );
}

export function updateInboxNote(trackId: number, note: string | null): Promise<InboxTrackNote | null> {
  return desktopUpdateInboxNote(trackId, note).catch(() =>
    request<InboxTrackNote | null>(`/library/inbox/notes/${trackId}`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    }),
  );
}

export function reviewInboxTracks(trackIds: number[]): Promise<InboxReviewResponse> {
  return desktopReviewInbox(trackIds, false).catch(() =>
    request<InboxReviewResponse>("/library/inbox/review", {
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),
  );
}

export function reviewAllInboxTracks(): Promise<InboxReviewResponse> {
  return desktopReviewInbox(null, true).catch(() =>
    request<InboxReviewResponse>("/library/inbox/review", {
      method: "POST",
      body: JSON.stringify({ all_new: true }),
    }),
  );
}

export function createInboxAutoReviewRule(requestBody: InboxAutoReviewRuleRequest): Promise<InboxAutoReviewRuleApplyResponse> {
  return desktopCreateInboxAutoReviewRule(requestBody).catch(() =>
    request<InboxAutoReviewRuleApplyResponse>("/library/inbox/auto-review-rules", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function updateInboxAutoReviewRule(
  ruleId: number,
  requestBody: InboxAutoReviewRuleRequest,
): Promise<InboxAutoReviewRuleApplyResponse> {
  return desktopUpdateInboxAutoReviewRule(ruleId, requestBody).catch(() =>
    request<InboxAutoReviewRuleApplyResponse>(`/library/inbox/auto-review-rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteInboxAutoReviewRule(ruleId: number): Promise<InboxAutoReviewRuleDeleteResponse> {
  return desktopDeleteInboxAutoReviewRule(ruleId).catch(() =>
    request<InboxAutoReviewRuleDeleteResponse>(`/library/inbox/auto-review-rules/${ruleId}`, { method: "DELETE" }),
  );
}

