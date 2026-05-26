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
  NativeScanSnapshot,
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
} from "../types/api";
import {
  nativeFetchAlbumTracks,
  nativeFetchAlbums,
  nativeFetchArtists,
  nativeFetchAudiobookBookmarks,
  nativeFetchAudiobookChapters,
  nativeFetchAudiobooks,
  nativeFetchBackendHealth,
  nativeFetchHistory,
  nativeFetchHistoryStats,
  nativeFetchLibraryHealth,
  nativeFetchLibraryStats,
  nativeFetchLovedTracks,
  nativeFetchPlaylistTracks,
  nativeFetchPlaylists,
  nativeFetchRadioStations,
  nativeFetchSimilarTracks,
  nativeFetchSettings,
  nativeFetchTrack,
  nativeFetchTracksBatch,
  nativeFileOrganizationPreview,
  nativeGaplessValidate,
  nativeGenerateAutoDj,
  nativeAddTracksToPlaylist,
  nativeCreateAudiobookBookmark,
  nativeCreatePlaylist,
  nativeDeletePlaylist,
  nativeCreateAutoDjAvoidRule,
  nativeDeleteAutoDjAvoidRule,
  nativeDeleteAudiobookBookmark,
  nativeDeleteRadioStation,
  nativeFetchAutoDjAvoidRules,
  nativeClearLibraryCaches,
  nativeFetchBulkUndoBatches,
  nativeFetchBulkUndoLog,
  nativeMarkTrackPlayed,
  nativeMarkTrackSkipped,
  nativeMarkRadioStationPlayed,
  nativeMoveTrackInPlaylist,
  nativeRemoveTrackFromPlaylist,
  nativeRemoveLibrarySource,
  nativeSaveAudiobookChapters,
  nativeSaveRadioStation,
  nativeUpdateAudiobookProgress,
  nativeUpdateSettings,
  nativeUpdateTrackLove,
  nativeUpdateTrackRating,
  nativeVolumeTagsPreview,
} from "./nativeLibrary";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8765";
const ARTWORK_URL_SESSION_VERSION = Date.now().toString(36);
let fastApiCallCount = 0;

function notifyFastApiCall(path: string, init?: RequestInit) {
  if (typeof window === "undefined") {
    return;
  }
  fastApiCallCount += 1;
  window.dispatchEvent(
    new CustomEvent("flac-cafe:fast-api-call", {
      detail: {
        count: fastApiCallCount,
        method: init?.method ?? "GET",
        path,
      },
    }),
  );
}

function formatApiErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (!entry || typeof entry !== "object") {
          return "";
        }
        const value = entry as { loc?: unknown; msg?: unknown; message?: unknown };
        const message = typeof value.msg === "string" ? value.msg : typeof value.message === "string" ? value.message : "";
        const location = Array.isArray(value.loc)
          ? value.loc.filter((part) => typeof part === "string" || typeof part === "number").join(".")
          : "";
        return message ? (location ? `${location}: ${message}` : message) : "";
      })
      .filter(Boolean);
    return messages.length ? messages.join("; ") : fallback;
  }
  if (detail && typeof detail === "object") {
    const value = detail as { msg?: unknown; message?: unknown; error?: unknown };
    if (typeof value.message === "string") {
      return value.message;
    }
    if (typeof value.msg === "string") {
      return value.msg;
    }
    if (typeof value.error === "string") {
      return value.error;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  notifyFastApiCall(path, init);
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = formatApiErrorDetail(body.detail ?? body.message ?? body.error, message);
    } catch {
      // Keep the HTTP status message when the backend does not return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function fetchSettings(): Promise<SettingsResponse> {
  return nativeFetchSettings().catch(() => request<SettingsResponse>("/settings"));
}

export function fetchBackendHealth(): Promise<{ status: string }> {
  return nativeFetchBackendHealth().catch(() => request<{ status: string }>("/health"));
}

export function fetchStartupDiagnostics(): Promise<StartupDiagnosticsResponse> {
  return request<StartupDiagnosticsResponse>("/diagnostics/startup");
}

export function fetchBackendLog(limit = 200): Promise<LogTailResponse> {
  return request<LogTailResponse>(`/diagnostics/logs/backend?limit=${limit}`);
}

export function createSupportBundle(): Promise<SupportBundleResponse> {
  return request<SupportBundleResponse>("/diagnostics/support-bundle", { method: "POST" });
}

export function backupDatabase(): Promise<BackupResponse> {
  return request<BackupResponse>("/settings/backup", { method: "POST" });
}

export function resetLocalData(confirmation: string): Promise<LocalDataResetResponse> {
  return request<LocalDataResetResponse>("/settings/reset-local-data", {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  });
}

export function updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return nativeUpdateSettings(settings).catch(() =>
    request<SettingsResponse>("/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),
  );
}

export function removeLibrarySource(path: string): Promise<LibrarySourceRemoveResponse> {
  return nativeRemoveLibrarySource(path).catch(() =>
    request<LibrarySourceRemoveResponse>("/settings/library-sources/remove", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  );
}

export function fetchHistory(limit = 200): Promise<PlayEventEntry[]> {
  return nativeFetchHistory(limit).catch(() => request<PlayEventEntry[]>(`/history?limit=${limit}`));
}

export function fetchHistoryStats(limit = 10): Promise<HistoryStatsResponse> {
  return nativeFetchHistoryStats(limit).catch(() => request<HistoryStatsResponse>(`/history/stats?limit=${limit}`));
}

export function fetchLibraryStats(): Promise<LibraryStatsResponse> {
  return nativeFetchLibraryStats().catch(() => request<LibraryStatsResponse>("/library/stats"));
}

export function fetchLibraryHealth(limit = 300): Promise<LibraryHealthResponse> {
  return nativeFetchLibraryHealth(limit).catch(() => request<LibraryHealthResponse>(`/library/health?limit=${limit}`));
}

export function fetchLibraryInbox(limit = 200, offset = 0): Promise<InboxResponse> {
  return request<InboxResponse>(`/library/inbox?limit=${limit}&offset=${offset}`);
}

export function updateInboxNote(trackId: number, note: string | null): Promise<InboxTrackNote | null> {
  return request<InboxTrackNote | null>(`/library/inbox/notes/${trackId}`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

export function reviewInboxTracks(trackIds: number[]): Promise<InboxReviewResponse> {
  return request<InboxReviewResponse>("/library/inbox/review", {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  });
}

export function reviewAllInboxTracks(): Promise<InboxReviewResponse> {
  return request<InboxReviewResponse>("/library/inbox/review", {
    method: "POST",
    body: JSON.stringify({ all_new: true }),
  });
}

export function createInboxAutoReviewRule(requestBody: InboxAutoReviewRuleRequest): Promise<InboxAutoReviewRuleApplyResponse> {
  return request<InboxAutoReviewRuleApplyResponse>("/library/inbox/auto-review-rules", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function updateInboxAutoReviewRule(
  ruleId: number,
  requestBody: InboxAutoReviewRuleRequest,
): Promise<InboxAutoReviewRuleApplyResponse> {
  return request<InboxAutoReviewRuleApplyResponse>(`/library/inbox/auto-review-rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  });
}

export function deleteInboxAutoReviewRule(ruleId: number): Promise<InboxAutoReviewRuleDeleteResponse> {
  return request<InboxAutoReviewRuleDeleteResponse>(`/library/inbox/auto-review-rules/${ruleId}`, { method: "DELETE" });
}

export function clearLibraryCaches(targets: CacheClearTarget[]): Promise<CacheClearResponse> {
  return nativeClearLibraryCaches(targets).catch(() =>
    request<CacheClearResponse>("/library/maintenance/clear", {
      method: "POST",
      body: JSON.stringify({ targets }),
    }),
  );
}

export function inferFilenameTags(requestBody: FilenameTagInferenceRequest): Promise<FilenameTagInferenceResponse> {
  return request<FilenameTagInferenceResponse>("/library/tools/infer-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function organizeFiles(requestBody: FileOrganizationRequest): Promise<FileOrganizationResponse> {
  if (!requestBody.apply) {
    return nativeFileOrganizationPreview(requestBody).catch(() =>
      request<FileOrganizationResponse>("/library/tools/organize-files", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }),
    );
  }
  return request<FileOrganizationResponse>("/library/tools/organize-files", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function syncDeviceFolder(requestBody: DeviceSyncRequest): Promise<DeviceSyncResponse> {
  return request<DeviceSyncResponse>("/library/tools/device-sync", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchDeviceSyncDevices(): Promise<DeviceSyncDevicesResponse> {
  return request<DeviceSyncDevicesResponse>("/library/tools/device-sync/devices");
}

export function fetchDeviceSyncProfiles(): Promise<DeviceSyncProfilesResponse> {
  return request<DeviceSyncProfilesResponse>("/library/tools/device-sync/profiles");
}

export function saveDeviceSyncProfile(requestBody: DeviceSyncProfilePayload, profileId?: number | null): Promise<DeviceSyncProfile> {
  return request<DeviceSyncProfile>(
    profileId ? `/library/tools/device-sync/profiles/${profileId}` : "/library/tools/device-sync/profiles",
    {
      method: profileId ? "PATCH" : "POST",
      body: JSON.stringify(requestBody),
    },
  );
}

export function deleteDeviceSyncProfile(profileId: number): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/library/tools/device-sync/profiles/${profileId}`, { method: "DELETE" });
}

export function exportFileOrganizationReport(
  requestBody: FileOrganizationReportRequest,
): Promise<FileOrganizationReportResponse> {
  return request<FileOrganizationReportResponse>("/library/tools/organize-files/report", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
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
  return request<TagRegexReplaceResponse>("/library/tools/regex-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchRegexTagPresets(): Promise<RegexTagPreset[]> {
  return request<RegexTagPreset[]>("/library/tools/regex-presets");
}

export function saveRegexTagPreset(requestBody: RegexTagPresetRequest): Promise<RegexTagPreset> {
  return request<RegexTagPreset>("/library/tools/regex-presets", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function deleteRegexTagPreset(presetId: number): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/library/tools/regex-presets/${presetId}`, { method: "DELETE" });
}

export function batchCustomTags(requestBody: CustomTagBatchRequest): Promise<CustomTagBatchResponse> {
  return request<CustomTagBatchResponse>("/library/tools/custom-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchVirtualTags(): Promise<VirtualTagDefinition[]> {
  return request<VirtualTagDefinition[]>("/library/tools/virtual-tags");
}

export function saveVirtualTag(requestBody: VirtualTagDefinitionRequest): Promise<VirtualTagDefinition> {
  return request<VirtualTagDefinition>("/library/tools/virtual-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function deleteVirtualTag(definitionId: number): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/library/tools/virtual-tags/${definitionId}`, { method: "DELETE" });
}

export function previewVirtualTag(requestBody: VirtualTagPreviewRequest): Promise<VirtualTagPreviewResponse> {
  return request<VirtualTagPreviewResponse>("/library/tools/virtual-tags/preview", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function copyOrSwapTags(requestBody: TagFieldCopySwapRequest): Promise<TagFieldCopySwapResponse> {
  return request<TagFieldCopySwapResponse>("/library/tools/copy-swap-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
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
  if ((requestBody.mode ?? "analyze") === "manual" && !requestBody.apply && !requestBody.write_to_file) {
    return nativeVolumeTagsPreview(requestBody).catch(() =>
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
  return request<DuplicateReviewResponse>("/library/duplicates/review", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchChromaprintSetup(): Promise<ChromaprintStatusResponse> {
  return request<ChromaprintStatusResponse>("/library/tools/acoustic-fingerprints/setup");
}

export function saveChromaprintSetup(requestBody: ChromaprintConfigRequest): Promise<ChromaprintStatusResponse> {
  return request<ChromaprintStatusResponse>("/library/tools/acoustic-fingerprints/setup", {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  });
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
  return nativeFetchBulkUndoLog(limit).catch(() => request<BulkUndoLogEntry[]>(`/library/tools/undo-log?limit=${limit}`));
}

export function fetchBulkUndoBatches(limit = 30): Promise<BulkUndoBatchEntry[]> {
  return nativeFetchBulkUndoBatches(limit).catch(() =>
    request<BulkUndoBatchEntry[]>(`/library/tools/undo-batches?limit=${limit}`),
  );
}

export function restoreBulkUndoEntry(entryId: number): Promise<BulkUndoRestoreResponse> {
  return request<BulkUndoRestoreResponse>(`/library/tools/undo-log/${entryId}/restore`, { method: "POST" });
}

export function restoreBulkUndoBatch(batchId: string): Promise<BulkUndoRestoreResponse> {
  return request<BulkUndoRestoreResponse>(`/library/tools/undo-batches/${encodeURIComponent(batchId)}/restore`, { method: "POST" });
}

export function readReportFile(requestBody: ReportFileRequest): Promise<ReportFileResponse> {
  return request<ReportFileResponse>("/library/tools/reports/read", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchFolderWatchStatus(limit = 300): Promise<FolderWatchStatus> {
  return request<FolderWatchStatus>(`/library/watch?limit=${limit}`);
}

export function startFolderWatch(folderPath?: string | null, intervalSeconds = 45, limit = 300, nativeSnapshot?: NativeScanSnapshot | null): Promise<FolderWatchStatus> {
  return request<FolderWatchStatus>("/library/watch/start", {
    method: "POST",
    body: JSON.stringify({
      folder_path: folderPath || null,
      interval_seconds: intervalSeconds,
      limit,
      native_snapshot: nativeSnapshot ?? null,
    }),
  });
}

export function stopFolderWatch(limit = 300): Promise<FolderWatchStatus> {
  return request<FolderWatchStatus>(`/library/watch/stop?limit=${limit}`, { method: "POST" });
}

export function refreshFolderWatch(folderPath?: string | null, limit = 300, nativeSnapshot?: NativeScanSnapshot | null): Promise<FolderWatchStatus> {
  return request<FolderWatchStatus>("/library/watch/refresh", {
    method: "POST",
    body: JSON.stringify({
      folder_path: folderPath || null,
      limit,
      native_snapshot: nativeSnapshot ?? null,
    }),
  });
}

export function applyFolderWatchChanges(changeIds: string[], applyAll = false, limit = 300): Promise<FolderWatchApplyResponse> {
  return request<FolderWatchApplyResponse>("/library/watch/apply", {
    method: "POST",
    body: JSON.stringify({
      change_ids: changeIds,
      apply_all: applyAll,
      limit,
    }),
  });
}

export function acknowledgeFolderWatchNotifications(notificationIds: string[] = [], allNotifications = false): Promise<FolderWatchStatus> {
  return request<FolderWatchStatus>("/library/watch/notifications/ack", {
    method: "POST",
    body: JSON.stringify({
      notification_ids: notificationIds,
      all_notifications: allNotifications,
    }),
  });
}

export function fetchAudioConversionSetup(): Promise<AudioConversionSetupResponse> {
  return request<AudioConversionSetupResponse>("/library/tools/audio-conversion/setup");
}

export function saveAudioConversionSetup(requestBody: AudioConversionSetupRequest): Promise<AudioConversionSetupResponse> {
  return request<AudioConversionSetupResponse>("/library/tools/audio-conversion/setup", {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  });
}

export function installAudioConversionFfmpeg(
  requestBody: AudioConversionInstallRequest = {},
): Promise<AudioConversionSetupResponse> {
  return request<AudioConversionSetupResponse>("/library/tools/audio-conversion/install", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function startAudioConversionFfmpegInstall(
  requestBody: AudioConversionInstallRequest = {},
): Promise<AudioConversionInstallStartResponse> {
  return request<AudioConversionInstallStartResponse>("/library/tools/audio-conversion/install/jobs", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchAudioConversionFfmpegInstall(jobId: string): Promise<AudioConversionInstallProgress> {
  return request<AudioConversionInstallProgress>(`/library/tools/audio-conversion/install/jobs/${jobId}`);
}

export function previewAudioConversion(requestBody: AudioConversionRequest): Promise<AudioConversionPreviewResponse> {
  return request<AudioConversionPreviewResponse>("/library/tools/audio-conversion/preview", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function startAudioConversion(requestBody: AudioConversionRequest): Promise<AudioConversionStartResponse> {
  return request<AudioConversionStartResponse>("/library/tools/audio-conversion/jobs", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchAudioConversionProgress(jobId: string): Promise<AudioConversionProgress> {
  return request<AudioConversionProgress>(`/library/tools/audio-conversion/jobs/${jobId}`);
}

export function cancelAudioConversion(jobId: string): Promise<AudioConversionProgress> {
  return request<AudioConversionProgress>(`/library/tools/audio-conversion/jobs/${jobId}/cancel`, { method: "POST" });
}

export function fetchCdRipSetup(): Promise<CdRipSetupResponse> {
  return request<CdRipSetupResponse>("/library/tools/cd-rip/setup");
}

export function lookupCdRipMetadata(requestBody: CdRipMetadataRequest): Promise<CdRipMetadataResponse> {
  return request<CdRipMetadataResponse>("/library/tools/cd-rip/metadata", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function startCdRip(requestBody: CdRipStartRequest): Promise<CdRipStartResponse> {
  return request<CdRipStartResponse>("/library/tools/cd-rip/jobs", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchCdRipProgress(jobId: string): Promise<CdRipProgress> {
  return request<CdRipProgress>(`/library/tools/cd-rip/jobs/${jobId}`);
}

export function cancelCdRip(jobId: string): Promise<CdRipProgress> {
  return request<CdRipProgress>(`/library/tools/cd-rip/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function playCdTrack(
  trackNumber: number,
  driveId?: string | null,
  context?: {
    albumTitle?: string | null;
    albumArtist?: string | null;
    year?: number | null;
    genre?: string | null;
    tracks?: CdRipTrackMetadata[];
  },
): Promise<CdPlaybackResponse> {
  const response = await request<CdPlaybackResponse>("/library/tools/cd-rip/playback/play", {
    method: "POST",
    body: JSON.stringify({
      drive_id: driveId ?? null,
      track_number: trackNumber,
      album_title: context?.albumTitle ?? null,
      album_artist: context?.albumArtist ?? null,
      year: context?.year ?? null,
      genre: context?.genre ?? null,
      tracks: context?.tracks ?? [],
    }),
  });
  if (response.track?.audio_url?.startsWith("/")) {
    response.track.audio_url = `${API_BASE}${response.track.audio_url}`;
  }
  return response;
}

export function stopCdPlayback(): Promise<CdPlaybackResponse> {
  return request<CdPlaybackResponse>("/library/tools/cd-rip/playback/stop", { method: "POST" });
}

export function fetchAudiobooks(limit = 200, offset = 0): Promise<AudiobookListResponse> {
  return nativeFetchAudiobooks(limit, offset).catch(() =>
    request<AudiobookListResponse>(`/audiobooks?limit=${limit}&offset=${offset}`),
  );
}

export function updateAudiobookProgress(trackId: number, requestBody: AudiobookProgressRequest): Promise<AudiobookProgressResponse> {
  return nativeUpdateAudiobookProgress(trackId, requestBody).catch(() =>
    request<AudiobookProgressResponse>(`/audiobooks/${trackId}/progress`, {
      method: "PATCH",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function fetchAudiobookBookmarks(trackId: number): Promise<AudiobookBookmark[]> {
  return nativeFetchAudiobookBookmarks(trackId).catch(() =>
    request<AudiobookBookmark[]>(`/audiobooks/${trackId}/bookmarks`),
  );
}

export function createAudiobookBookmark(trackId: number, requestBody: AudiobookBookmarkRequest): Promise<AudiobookBookmark> {
  return nativeCreateAudiobookBookmark(trackId, requestBody).catch(() =>
    request<AudiobookBookmark>(`/audiobooks/${trackId}/bookmarks`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteAudiobookBookmark(bookmarkId: number): Promise<{ deleted: boolean }> {
  return nativeDeleteAudiobookBookmark(bookmarkId).catch(() =>
    request<{ deleted: boolean }>(`/audiobooks/bookmarks/${bookmarkId}`, { method: "DELETE" }),
  );
}

export function fetchAudiobookChapters(trackId: number): Promise<AudiobookChapter[]> {
  return nativeFetchAudiobookChapters(trackId).catch(() =>
    request<AudiobookChapter[]>(`/audiobooks/${trackId}/chapters`),
  );
}

export function saveAudiobookChapters(trackId: number, chapters: AudiobookChapter[]): Promise<AudiobookChapter[]> {
  return nativeSaveAudiobookChapters(trackId, chapters).catch(() =>
    request<AudiobookChapter[]>(`/audiobooks/${trackId}/chapters`, {
      method: "PUT",
      body: JSON.stringify({ chapters }),
    }),
  );
}

export function exportAudiobookSyncMetadata(trackIds?: number[] | null): Promise<AudiobookSyncExportResponse> {
  return request<AudiobookSyncExportResponse>("/audiobooks/sync-export", {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds?.length ? trackIds : null }),
  });
}

export function fetchPodcastSubscriptions(): Promise<PodcastSubscription[]> {
  return request<PodcastSubscription[]>("/podcasts/subscriptions");
}

export function savePodcastSubscription(
  requestBody: PodcastSubscriptionPayload,
  subscriptionId?: number | null,
): Promise<PodcastSubscription> {
  return request<PodcastSubscription>(
    subscriptionId ? `/podcasts/subscriptions/${subscriptionId}` : "/podcasts/subscriptions",
    {
      method: subscriptionId ? "PATCH" : "POST",
      body: JSON.stringify(requestBody),
    },
  );
}

export function deletePodcastSubscription(subscriptionId: number, deleteFiles = false): Promise<PodcastSubscriptionDeleteResponse> {
  const query = deleteFiles ? "?delete_files=true" : "";
  return request<PodcastSubscriptionDeleteResponse>(`/podcasts/subscriptions/${subscriptionId}${query}`, { method: "DELETE" });
}

export function refreshPodcastSubscription(subscriptionId: number): Promise<PodcastRefreshResponse> {
  return request<PodcastRefreshResponse>(`/podcasts/subscriptions/${subscriptionId}/refresh`, { method: "POST" });
}

export function ensurePodcastSubscriptionFolder(subscriptionId: number): Promise<PodcastFolderResponse> {
  return request<PodcastFolderResponse>(`/podcasts/subscriptions/${subscriptionId}/folder`, { method: "POST" });
}

export function fetchPodcastEpisodes(subscriptionId?: number | null, limit = 200): Promise<PodcastEpisode[]> {
  const query = subscriptionId ? `?subscription_id=${subscriptionId}&limit=${limit}` : `?limit=${limit}`;
  return request<PodcastEpisode[]>(`/podcasts/episodes${query}`);
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
  return nativeFetchRadioStations().catch(() => request<RadioStation[]>("/radio/stations"));
}

export function saveRadioStation(requestBody: RadioStationPayload, stationId?: number | null): Promise<RadioStation> {
  return nativeSaveRadioStation(requestBody, stationId).catch(() =>
    request<RadioStation>(stationId ? `/radio/stations/${stationId}` : "/radio/stations", {
      method: stationId ? "PATCH" : "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteRadioStation(stationId: number): Promise<{ deleted: boolean }> {
  return nativeDeleteRadioStation(stationId).catch(() =>
    request<{ deleted: boolean }>(`/radio/stations/${stationId}`, { method: "DELETE" }),
  );
}

export function markRadioStationPlayed(stationId: number): Promise<RadioStation> {
  return nativeMarkRadioStationPlayed(stationId).catch(() =>
    request<RadioStation>(`/radio/stations/${stationId}/played`, { method: "POST" }),
  );
}

export function fetchScrobbleAccounts(): Promise<ScrobbleAccount[]> {
  return request<ScrobbleAccount[]>("/scrobbling/accounts");
}

export function saveScrobbleAccount(service: ScrobbleService, requestBody: ScrobbleAccountRequest): Promise<ScrobbleAccount> {
  return request<ScrobbleAccount>(`/scrobbling/accounts/${service}`, {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  });
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
  return request<ScrobbleOutboxEntry[]>(`/scrobbling/outbox?limit=${limit}`);
}

export function queueScrobbleHistory(service: ScrobbleService, limit = 100): Promise<ScrobbleQueueHistoryResponse> {
  return request<ScrobbleQueueHistoryResponse>("/scrobbling/outbox/queue-history", {
    method: "POST",
    body: JSON.stringify({ service, limit }),
  });
}

export function submitScrobbleOutbox(service: ScrobbleService, limit = 50): Promise<ScrobbleSubmitResponse> {
  return request<ScrobbleSubmitResponse>("/scrobbling/outbox/submit", {
    method: "POST",
    body: JSON.stringify({ service, limit }),
  });
}

export function fetchLovedTracks(limit = 100): Promise<LovedTrack[]> {
  return nativeFetchLovedTracks(limit).catch(() => request<LovedTrack[]>(`/scrobbling/loved?limit=${limit}`));
}

export function updateTrackLove(trackId: number, loved: boolean, source = "local"): Promise<TrackLoveResponse> {
  return nativeUpdateTrackLove(trackId, loved, source).catch(() =>
    request<TrackLoveResponse>(`/scrobbling/tracks/${trackId}/love`, {
      method: "PATCH",
      body: JSON.stringify({ loved, source }),
    }),
  );
}

export function importScrobbleHistory(csvPath: string, apply = false, limit = 10000): Promise<ScrobbleHistoryImportResponse> {
  return request<ScrobbleHistoryImportResponse>("/scrobbling/import-history", {
    method: "POST",
    body: JSON.stringify({ csv_path: csvPath, apply, limit }),
  });
}

export function validateGaplessPlayback(requestBody: GaplessValidationRequest): Promise<GaplessValidationResponse> {
  return nativeGaplessValidate(requestBody).catch(() =>
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
  return request<ExtensionListResponse>("/extensions");
}

export function reloadExtensions(): Promise<ExtensionListResponse> {
  return request<ExtensionListResponse>("/extensions/reload", { method: "POST" });
}

export function importLibraryStats(requestBody: LibraryStatsImportRequest): Promise<LibraryStatsImportResponse> {
  return request<LibraryStatsImportResponse>("/library/importers/stats", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchClapStatus(deep = false): Promise<ClapStatusResponse> {
  return request<ClapStatusResponse>(`/analysis/clap/status${deep ? "?deep=true" : ""}`);
}

export function fetchClapCoverage(): Promise<AudioAnalysisCoverage> {
  return request<AudioAnalysisCoverage>("/analysis/clap/coverage");
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
  return request<Track[]>(query ? `/tracks?${query}` : "/tracks");
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
  return nativeFetchTrack(trackId).catch(() => request<Track>(`/tracks/${trackId}`));
}

export function fetchTracksBatch(trackIds: number[]): Promise<TrackBatchResponse> {
  return nativeFetchTracksBatch(trackIds).catch(() =>
    request<TrackBatchResponse>("/tracks/batch", {
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),
  );
}

export function fetchSimilarTracks(trackId: number, limit = 12): Promise<SimilarTrack[]> {
  return nativeFetchSimilarTracks(trackId, limit).catch(() =>
    request<SimilarTrack[]>(`/tracks/${trackId}/similar?limit=${limit}`),
  );
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
  return request<TrackPage>(`/tracks/page?${params.toString()}`);
}

export function fetchAlbums(search = ""): Promise<AlbumSummary[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", "20000");
  return nativeFetchAlbums(search, 20000).catch(() => request<AlbumSummary[]>(`/albums?${params.toString()}`));
}

export function fetchArtists(search = ""): Promise<ArtistSummary[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", "20000");
  return nativeFetchArtists(search, 20000).catch(() => request<ArtistSummary[]>(`/artists?${params.toString()}`));
}

export function fetchAlbumTracks(albumId: number): Promise<Track[]> {
  return nativeFetchAlbumTracks(albumId).catch(() => request<Track[]>(`/albums/${albumId}/tracks`));
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
  return `${API_BASE}/albums/${albumId}/artwork${artworkVersionQuery(version)}`;
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
  return nativeFetchPlaylists().catch(() => request<PlaylistSummary[]>("/playlists"));
}

export function createPlaylist(name: string): Promise<PlaylistSummary> {
  return nativeCreatePlaylist(name).catch(() =>
    request<PlaylistSummary>("/playlists", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  );
}

export function deletePlaylist(playlistId: number): Promise<PlaylistSummary[]> {
  return nativeDeletePlaylist(playlistId).catch(() =>
    request<PlaylistSummary[]>(`/playlists/${playlistId}`, {
      method: "DELETE",
    }),
  );
}

export function fetchPlaylistTracks(playlistId: number): Promise<Track[]> {
  return nativeFetchPlaylistTracks(playlistId).catch(() => request<Track[]>(`/playlists/${playlistId}/tracks`));
}

export function addTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<Track[]> {
  return nativeAddTracksToPlaylist(playlistId, trackIds).catch(() =>
    request<Track[]>(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),
  );
}

export function removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<Track[]> {
  return nativeRemoveTrackFromPlaylist(playlistId, trackId).catch(() =>
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
  return nativeMoveTrackInPlaylist(playlistId, trackId, direction).catch(() =>
    request<Track[]>(`/playlists/${playlistId}/tracks/${trackId}/move`, {
      method: "PATCH",
      body: JSON.stringify({ direction }),
    }),
  );
}

export function exportPlaylist(playlistId: number): Promise<ExportResponse> {
  return request<ExportResponse>(`/playlists/${playlistId}/export`, {
    method: "POST",
    body: JSON.stringify({ track_ids: [] }),
  });
}

export function importPlaylist(playlistPath: string, name?: string): Promise<PlaylistSummary> {
  return request<PlaylistSummary>("/playlists/import", {
    method: "POST",
    body: JSON.stringify({ playlist_path: playlistPath, name: name || null }),
  });
}

function scanRequestBody(folderPaths: string | string[], saveLibraryPaths?: string[], nativeSnapshot?: NativeScanSnapshot | null) {
  const paths = (Array.isArray(folderPaths) ? folderPaths : [folderPaths]).map((path) => path.trim()).filter(Boolean);
  const savedPaths = (saveLibraryPaths ?? paths).map((path) => path.trim()).filter(Boolean);
  return {
    folder_path: paths[0] ?? "",
    folder_paths: paths,
    save_library_paths: savedPaths,
    native_snapshot: nativeSnapshot ?? null,
  };
}

export function scanLibrary(folderPath: string | string[], saveLibraryPaths?: string[], nativeSnapshot?: NativeScanSnapshot | null): Promise<ScanResult> {
  return request<ScanResult>("/scan", {
    method: "POST",
    body: JSON.stringify(scanRequestBody(folderPath, saveLibraryPaths, nativeSnapshot)),
  });
}

export function startScanLibrary(folderPath: string | string[], saveLibraryPaths?: string[], nativeSnapshot?: NativeScanSnapshot | null): Promise<ScanStartResponse> {
  return request<ScanStartResponse>("/scan/start", {
    method: "POST",
    body: JSON.stringify(scanRequestBody(folderPath, saveLibraryPaths, nativeSnapshot)),
  });
}

export function fetchScanProgress(jobId: string): Promise<ScanProgress> {
  return request<ScanProgress>(`/scan/jobs/${jobId}`);
}

export function updateTrackRating(trackId: number, rating: number | null): Promise<Track> {
  return nativeUpdateTrackRating(trackId, rating).catch(() =>
    request<Track>(`/tracks/${trackId}/rating`, {
      method: "PATCH",
      body: JSON.stringify({ rating }),
    }),
  );
}

export function audioUrl(trackId: number): string {
  return `${API_BASE}/tracks/${trackId}/audio`;
}

export function albumArtworkUrl(trackId: number, version?: string | number | null): string {
  return `${API_BASE}/tracks/${trackId}/artwork${artworkVersionQuery(version)}`;
}

export function fetchLyrics(trackId: number): Promise<LyricsResponse> {
  return request<LyricsResponse>(`/tracks/${trackId}/lyrics`);
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
  return request<LyricsResponse>(`/tracks/${trackId}/lyrics`, {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  });
}

export function fetchArtistInfo(artistName: string, refresh = false): Promise<ArtistInfoResponse> {
  const params = new URLSearchParams({ name: artistName });
  if (refresh) {
    params.set("refresh", "true");
  }
  return request<ArtistInfoResponse>(`/artists/info?${params.toString()}`);
}

export function markTrackPlayed(trackId: number): Promise<Track> {
  return nativeMarkTrackPlayed(trackId).catch(() =>
    request<Track>(`/tracks/${trackId}/played`, {
      method: "POST",
    }),
  );
}

export function markTrackSkipped(trackId: number): Promise<Track> {
  return nativeMarkTrackSkipped(trackId).catch(() =>
    request<Track>(`/tracks/${trackId}/skipped`, {
      method: "POST",
    }),
  );
}

export function fetchArtistLocalTracks(artistName: string, limit = 100): Promise<Track[]> {
  const params = new URLSearchParams({ name: artistName, limit: String(limit) });
  return request<Track[]>(`/artists/local-tracks?${params.toString()}`);
}

export function clearArtistCache(): Promise<{ deleted: number }> {
  return request<{ deleted: number }>("/artists/cache", {
    method: "DELETE",
  });
}

export function fetchAutoDjAvoidRules(): Promise<AutoDjAvoidRule[]> {
  return nativeFetchAutoDjAvoidRules().catch(() => request<AutoDjAvoidRule[]>("/autodj/avoid"));
}

export function createAutoDjAvoidRule(requestBody: {
  scope: "track" | "artist" | "album" | "genre";
  track_id?: number | null;
  value?: string | null;
}): Promise<AutoDjAvoidRule> {
  return nativeCreateAutoDjAvoidRule(requestBody).catch(() =>
    request<AutoDjAvoidRule>("/autodj/avoid", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteAutoDjAvoidRule(ruleId: number): Promise<AutoDjAvoidRule[]> {
  return nativeDeleteAutoDjAvoidRule(ruleId).catch(() =>
    request<AutoDjAvoidRule[]>(`/autodj/avoid/${ruleId}`, { method: "DELETE" }),
  );
}

export function recordRecommendationFeedback(requestBody: {
  track_id: number;
  event_type: "play_next" | "add_to_queue" | "manual_play";
  weight?: number;
}): Promise<{ status: string }> {
  return request<{ status: string }>("/autodj/feedback", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchRecommendationProfiles(): Promise<RecommendationProfile[]> {
  return request<RecommendationProfile[]>("/autodj/profiles");
}

export function fetchRecommendationHistory(limit = 30): Promise<RecommendationRun[]> {
  return request<RecommendationRun[]>(`/autodj/history?limit=${limit}`);
}

export function compareRecommendationProfiles(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparison[]> {
  return request<RecommendationProfileComparison[]>("/autodj/profiles/compare", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function exportRecommendationProfileComparison(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparisonExportResponse> {
  return request<RecommendationProfileComparisonExportResponse>("/autodj/profiles/compare/export", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function importRecommendationProfileComparison(reportPath: string): Promise<RecommendationProfileComparisonImportResponse> {
  return request<RecommendationProfileComparisonImportResponse>("/autodj/profiles/compare/import", {
    method: "POST",
    body: JSON.stringify({ report_path: reportPath }),
  });
}

export function createRecommendationAbTest(requestBody: {
  base_settings: AutoDjSettings;
  challenger_settings?: AutoDjSettings | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationAbTestResponse> {
  return request<RecommendationAbTestResponse>("/autodj/ab-test", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function chooseRecommendationAbTest(requestBody: {
  test_id?: string | null;
  chosen_label: "A" | "B";
  chosen_track_ids: number[];
  rejected_track_ids?: number[];
  feedback_weight?: number;
}): Promise<RecommendationAbChoiceResponse> {
  return request<RecommendationAbChoiceResponse>("/autodj/ab-test/choose", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function saveRecommendationProfile(requestBody: {
  name: string;
  settings: AutoDjSettings;
  is_default?: boolean;
}): Promise<RecommendationProfile> {
  return request<RecommendationProfile>("/autodj/profiles", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function updateRecommendationProfile(
  profileId: number,
  requestBody: {
    name: string;
    settings: AutoDjSettings;
    is_default?: boolean;
  },
): Promise<RecommendationProfile> {
  return request<RecommendationProfile>(`/autodj/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  });
}

export function setDefaultRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return request<RecommendationProfile[]>(`/autodj/profiles/${profileId}/default`, { method: "POST" });
}

export function deleteRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return request<RecommendationProfile[]>(`/autodj/profiles/${profileId}`, { method: "DELETE" });
}

export function generateAutoDj(settings: AutoDjSettings): Promise<AutoDjResponse> {
  return nativeGenerateAutoDj(settings).catch(() =>
    request<AutoDjResponse>("/autodj/generate", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  );
}

export function exportQueue(trackIds: number[]): Promise<ExportResponse> {
  return request<ExportResponse>("/autodj/export", {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  });
}
