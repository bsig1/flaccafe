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

export function clearLibraryCaches(targets: CacheClearTarget[]): Promise<CacheClearResponse> {
  return desktopClearLibraryCaches(targets).catch(() =>
    request<CacheClearResponse>("/library/maintenance/clear", {
      method: "POST",
      body: JSON.stringify({ targets }),
    }),
  );
}

export function inferFilenameTags(requestBody: FilenameTagInferenceRequest): Promise<FilenameTagInferenceResponse> {
  return desktopInferFilenameTags(requestBody).catch(() =>
    request<FilenameTagInferenceResponse>("/library/tools/infer-tags", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function organizeFiles(requestBody: FileOrganizationRequest): Promise<FileOrganizationResponse> {
  return desktopFileOrganizationPreview(requestBody).catch(() =>
    request<FileOrganizationResponse>("/library/tools/organize-files", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function syncDeviceFolder(requestBody: DeviceSyncRequest): Promise<DeviceSyncResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify(requestBody),
  };
  return requestViaPythonWorker<DeviceSyncResponse>("/library/tools/device-sync", init).catch(() =>
    request<DeviceSyncResponse>("/library/tools/device-sync", init),
  );
}

export function fetchDeviceSyncDevices(): Promise<DeviceSyncDevicesResponse> {
  return requestViaPythonWorker<DeviceSyncDevicesResponse>("/library/tools/device-sync/devices").catch(() =>
    request<DeviceSyncDevicesResponse>("/library/tools/device-sync/devices"),
  );
}

export function fetchDeviceSyncProfiles(): Promise<DeviceSyncProfilesResponse> {
  return desktopFetchDeviceSyncProfiles().catch(() =>
    request<DeviceSyncProfilesResponse>("/library/tools/device-sync/profiles"),
  );
}

export function saveDeviceSyncProfile(requestBody: DeviceSyncProfilePayload, profileId?: number | null): Promise<DeviceSyncProfile> {
  return desktopSaveDeviceSyncProfile(requestBody, profileId).catch(() =>
    request<DeviceSyncProfile>(
      profileId ? `/library/tools/device-sync/profiles/${profileId}` : "/library/tools/device-sync/profiles",
      {
        method: profileId ? "PATCH" : "POST",
        body: JSON.stringify(requestBody),
      },
    ),
  );
}

export function deleteDeviceSyncProfile(profileId: number): Promise<{ deleted: boolean }> {
  return desktopDeleteDeviceSyncProfile(profileId).catch(() =>
    request<{ deleted: boolean }>(`/library/tools/device-sync/profiles/${profileId}`, { method: "DELETE" }),
  );
}

export function exportFileOrganizationReport(
  requestBody: FileOrganizationReportRequest,
): Promise<FileOrganizationReportResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify(requestBody),
  };
  return requestViaPythonWorker<FileOrganizationReportResponse>("/library/tools/organize-files/report", init).catch(() =>
    request<FileOrganizationReportResponse>("/library/tools/organize-files/report", init),
  );
}

export function exportMetadataCsv(requestBody: CsvMetadataExportRequest = {}): Promise<CsvMetadataExportResponse> {
  return request<CsvMetadataExportResponse>("/library/tools/export-metadata-csv", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function importMetadataCsv(requestBody: CsvMetadataImportRequest): Promise<CsvMetadataImportResponse> {
  return request<CsvMetadataImportResponse>("/library/tools/import-metadata-csv", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function replaceTagsWithRegex(requestBody: TagRegexReplaceRequest): Promise<TagRegexReplaceResponse> {
  return desktopRegexTags(requestBody).catch(() =>
    request<TagRegexReplaceResponse>("/library/tools/regex-tags", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function fetchRegexTagPresets(): Promise<RegexTagPreset[]> {
  return desktopFetchRegexTagPresets().catch(() => request<RegexTagPreset[]>("/library/tools/regex-presets"));
}

export function saveRegexTagPreset(requestBody: RegexTagPresetRequest): Promise<RegexTagPreset> {
  return desktopSaveRegexTagPreset(requestBody).catch(() =>
    request<RegexTagPreset>("/library/tools/regex-presets", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteRegexTagPreset(presetId: number): Promise<{ deleted: boolean }> {
  return desktopDeleteRegexTagPreset(presetId).catch(() =>
    request<{ deleted: boolean }>(`/library/tools/regex-presets/${presetId}`, { method: "DELETE" }),
  );
}

export function batchCustomTags(requestBody: CustomTagBatchRequest): Promise<CustomTagBatchResponse> {
  return desktopCustomTags(requestBody).catch(() =>
    request<CustomTagBatchResponse>("/library/tools/custom-tags", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function fetchVirtualTags(): Promise<VirtualTagDefinition[]> {
  return desktopFetchVirtualTags().catch(() => request<VirtualTagDefinition[]>("/library/tools/virtual-tags"));
}

export function saveVirtualTag(requestBody: VirtualTagDefinitionRequest): Promise<VirtualTagDefinition> {
  return desktopSaveVirtualTag(requestBody).catch(() =>
    request<VirtualTagDefinition>("/library/tools/virtual-tags", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteVirtualTag(definitionId: number): Promise<{ deleted: boolean }> {
  return desktopDeleteVirtualTag(definitionId).catch(() =>
    request<{ deleted: boolean }>(`/library/tools/virtual-tags/${definitionId}`, { method: "DELETE" }),
  );
}

export function previewVirtualTag(requestBody: VirtualTagPreviewRequest): Promise<VirtualTagPreviewResponse> {
  return desktopVirtualTagPreview(requestBody).catch(() =>
    request<VirtualTagPreviewResponse>("/library/tools/virtual-tags/preview", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function copyOrSwapTags(requestBody: TagFieldCopySwapRequest): Promise<TagFieldCopySwapResponse> {
  return desktopCopySwapTags(requestBody).catch(() =>
    request<TagFieldCopySwapResponse>("/library/tools/copy-swap-tags", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function createTagBackup(requestBody: TagBackupRequest = {}): Promise<TagBackupResponse> {
  return request<TagBackupResponse>("/library/tools/tag-backups", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchTagBackups(limit = 30): Promise<TagBackupSummary[]> {
  return request<TagBackupSummary[]>(`/library/tools/tag-backups?limit=${limit}`);
}

export function restoreTagBackup(requestBody: TagBackupRestoreRequest): Promise<TagBackupRestoreResponse> {
  return request<TagBackupRestoreResponse>("/library/tools/tag-backups/restore", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function autoTagMusicBrainz(requestBody: AutoTagRequest): Promise<AutoTagResponse> {
  return request<AutoTagResponse>("/library/tools/autotag", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function clapGenreTags(requestBody: ClapGenreTagRequest): Promise<ClapGenreTagResponse> {
  return request<ClapGenreTagResponse>("/library/tools/clap-genre-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function volumeTags(requestBody: VolumeTagRequest): Promise<VolumeTagResponse> {
  if ((requestBody.mode ?? "analyze") === "manual" && !requestBody.write_to_file) {
    return desktopVolumeTagsPreview(requestBody).catch(() =>
      request<VolumeTagResponse>("/library/tools/volume-tags", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }),
    );
  }
  return request<VolumeTagResponse>("/library/tools/volume-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function exportMetadataCsvImportReport(
  requestBody: CsvMetadataImportReportRequest,
): Promise<CsvMetadataImportReportResponse> {
  return request<CsvMetadataImportReportResponse>("/library/tools/import-metadata-csv/report", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function applyDuplicateAction(requestBody: DuplicateActionRequest): Promise<DuplicateActionResponse> {
  return request<DuplicateActionResponse>("/library/duplicates/action", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchDuplicateReview(requestBody: DuplicateReviewRequest): Promise<DuplicateReviewResponse> {
  return desktopFetchDuplicateReview(requestBody).catch(() =>
    request<DuplicateReviewResponse>("/library/duplicates/review", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function fetchChromaprintSetup(): Promise<ChromaprintStatusResponse> {
  return desktopFetchChromaprintSetup().catch(() =>
    request<ChromaprintStatusResponse>("/library/tools/acoustic-fingerprints/setup"),
  );
}

export function saveChromaprintSetup(requestBody: ChromaprintConfigRequest): Promise<ChromaprintStatusResponse> {
  return desktopSaveChromaprintSetup(requestBody).catch(() =>
    request<ChromaprintStatusResponse>("/library/tools/acoustic-fingerprints/setup", {
      method: "PATCH",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function runAcousticFingerprintPass(
  requestBody: AcousticFingerprintRequest,
): Promise<AcousticFingerprintResponse> {
  return request<AcousticFingerprintResponse>("/library/tools/acoustic-fingerprints", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchBulkUndoLog(limit = 30): Promise<BulkUndoLogEntry[]> {
  return desktopFetchBulkUndoLog(limit).catch(() => request<BulkUndoLogEntry[]>(`/library/tools/undo-log?limit=${limit}`));
}

export function fetchBulkUndoBatches(limit = 30): Promise<BulkUndoBatchEntry[]> {
  return desktopFetchBulkUndoBatches(limit).catch(() =>
    request<BulkUndoBatchEntry[]>(`/library/tools/undo-batches?limit=${limit}`),
  );
}

export function restoreBulkUndoEntry(entryId: number): Promise<BulkUndoRestoreResponse> {
  return desktopRestoreBulkUndoEntry(entryId).catch(() =>
    request<BulkUndoRestoreResponse>(`/library/tools/undo-log/${entryId}/restore`, { method: "POST" }),
  );
}

export function restoreBulkUndoBatch(batchId: string): Promise<BulkUndoRestoreResponse> {
  return desktopRestoreBulkUndoBatch(batchId).catch(() =>
    request<BulkUndoRestoreResponse>(`/library/tools/undo-batches/${encodeURIComponent(batchId)}/restore`, {
      method: "POST",
    }),
  );
}

export function readReportFile(requestBody: ReportFileRequest): Promise<ReportFileResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify(requestBody),
  };
  return requestViaPythonWorker<ReportFileResponse>("/library/tools/reports/read", init).catch(() =>
    request<ReportFileResponse>("/library/tools/reports/read", init),
  );
}
