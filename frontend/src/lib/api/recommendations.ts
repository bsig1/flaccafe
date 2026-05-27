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

export function fetchAutoDjAvoidRules(): Promise<AutoDjAvoidRule[]> {
  return desktopFetchAutoDjAvoidRules().catch(() => request<AutoDjAvoidRule[]>("/autodj/avoid"));
}

export function createAutoDjAvoidRule(requestBody: {
  scope: "track" | "artist" | "album" | "genre";
  track_id?: number | null;
  value?: string | null;
}): Promise<AutoDjAvoidRule> {
  return desktopCreateAutoDjAvoidRule(requestBody).catch(() =>
    request<AutoDjAvoidRule>("/autodj/avoid", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteAutoDjAvoidRule(ruleId: number): Promise<AutoDjAvoidRule[]> {
  return desktopDeleteAutoDjAvoidRule(ruleId).catch(() =>
    request<AutoDjAvoidRule[]>(`/autodj/avoid/${ruleId}`, { method: "DELETE" }),
  );
}

export function recordRecommendationFeedback(requestBody: {
  track_id: number;
  event_type: "play_next" | "add_to_queue" | "manual_play";
  weight?: number;
}): Promise<{ status: string }> {
  return desktopRecordRecommendationFeedback(requestBody).catch(() =>
    request<{ status: string }>("/autodj/feedback", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function fetchRecommendationProfiles(): Promise<RecommendationProfile[]> {
  return desktopFetchRecommendationProfiles().catch(() =>
    request<RecommendationProfile[]>("/autodj/profiles"),
  );
}

export function fetchRecommendationHistory(limit = 30): Promise<RecommendationRun[]> {
  return desktopFetchRecommendationHistory(limit).catch(() =>
    request<RecommendationRun[]>(`/autodj/history?limit=${limit}`),
  );
}

export function compareRecommendationProfiles(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparison[]> {
  return desktopCompareRecommendationProfiles(requestBody).catch(() =>
    request<RecommendationProfileComparison[]>("/autodj/profiles/compare", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function exportRecommendationProfileComparison(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparisonExportResponse> {
  return desktopExportRecommendationProfileComparison(requestBody).catch(() =>
    request<RecommendationProfileComparisonExportResponse>("/autodj/profiles/compare/export", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function importRecommendationProfileComparison(reportPath: string): Promise<RecommendationProfileComparisonImportResponse> {
  return desktopImportRecommendationProfileComparison(reportPath).catch(() =>
    request<RecommendationProfileComparisonImportResponse>("/autodj/profiles/compare/import", {
      method: "POST",
      body: JSON.stringify({ report_path: reportPath }),
    }),
  );
}

export function createRecommendationAbTest(requestBody: {
  base_settings: AutoDjSettings;
  challenger_settings?: AutoDjSettings | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationAbTestResponse> {
  return desktopCreateRecommendationAbTest(requestBody).catch(() =>
    request<RecommendationAbTestResponse>("/autodj/ab-test", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function chooseRecommendationAbTest(requestBody: {
  test_id?: string | null;
  chosen_label: "A" | "B";
  chosen_track_ids: number[];
  rejected_track_ids?: number[];
  feedback_weight?: number;
}): Promise<RecommendationAbChoiceResponse> {
  return desktopChooseRecommendationAbTest(requestBody).catch(() =>
    request<RecommendationAbChoiceResponse>("/autodj/ab-test/choose", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function saveRecommendationProfile(requestBody: {
  name: string;
  settings: AutoDjSettings;
  is_default?: boolean;
}): Promise<RecommendationProfile> {
  return desktopSaveRecommendationProfile(requestBody).catch(() =>
    request<RecommendationProfile>("/autodj/profiles", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function updateRecommendationProfile(
  profileId: number,
  requestBody: {
    name: string;
    settings: AutoDjSettings;
    is_default?: boolean;
  },
): Promise<RecommendationProfile> {
  return desktopSaveRecommendationProfile(requestBody, profileId).catch(() =>
    request<RecommendationProfile>(`/autodj/profiles/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function setDefaultRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return desktopSetDefaultRecommendationProfile(profileId).catch(() =>
    request<RecommendationProfile[]>(`/autodj/profiles/${profileId}/default`, { method: "POST" }),
  );
}

export function deleteRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return desktopDeleteRecommendationProfile(profileId).catch(() =>
    request<RecommendationProfile[]>(`/autodj/profiles/${profileId}`, { method: "DELETE" }),
  );
}

export function generateAutoDj(settings: AutoDjSettings): Promise<AutoDjResponse> {
  return desktopGenerateAutoDj(settings).catch(() =>
    request<AutoDjResponse>("/autodj/generate", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  );
}

export function exportQueue(trackIds: number[]): Promise<ExportResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  };
  return requestViaPythonWorker<ExportResponse>("/autodj/export", init).catch(() =>
    request<ExportResponse>("/autodj/export", init),
  );
}
