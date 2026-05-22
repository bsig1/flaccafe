import type {
  AlbumSummary,
  AlbumArtworkCandidatesResponse,
  AlbumArtworkCollisionResponse,
  AlbumArtworkSearchResponse,
  AlbumArtworkUpdateResponse,
  ArtistInfoResponse,
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AudioAnalysisStartRequest,
  AudioAnalysisStartResponse,
  AudioConversionPreviewResponse,
  AudioConversionProgress,
  AudioConversionRequest,
  AudioConversionSetupRequest,
  AudioConversionSetupResponse,
  AudioConversionStartResponse,
  AutoDjAvoidRule,
  AutoDjResponse,
  AutoDjSettings,
  AutoTagRequest,
  AutoTagResponse,
  AcousticFingerprintRequest,
  AcousticFingerprintResponse,
  BackupResponse,
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  BulkUndoRestoreResponse,
  CacheClearResponse,
  CacheClearTarget,
  ChromaprintConfigRequest,
  ChromaprintInstallRequest,
  ChromaprintInstallResponse,
  ChromaprintStatusResponse,
  CdPlaybackResponse,
  CdRipMetadataRequest,
  CdRipMetadataResponse,
  CdRipProgress,
  CdRipSetupResponse,
  CdRipStartRequest,
  CdRipStartResponse,
  ClapConfigRequest,
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
  DuplicateActionRequest,
  DuplicateActionResponse,
  DeviceSyncRequest,
  DeviceSyncResponse,
  DuplicateReviewRequest,
  DuplicateReviewResponse,
  FileOrganizationRequest,
  FileOrganizationReportRequest,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  FolderWatchApplyResponse,
  FolderWatchStatus,
  FilenameTagInferenceRequest,
  FilenameTagInferenceResponse,
  LibraryHealthResponse,
  InboxAutoReviewRuleApplyResponse,
  InboxAutoReviewRuleDeleteResponse,
  InboxAutoReviewRuleRequest,
  InboxResponse,
  InboxReviewResponse,
  InboxTrackNote,
  LibraryStatsResponse,
  LogTailResponse,
  LyricsResponse,
  LyricsUpdateRequest,
  PlayEventEntry,
  PlaylistSummary,
  RecommendationProfile,
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
  ScanProgress,
  ScanResult,
  ScanStartResponse,
  SettingsResponse,
  SettingsUpdateRequest,
  SimilarTrack,
  SmartPlaylistRule,
  SmartPlaylistSummary,
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
  TrackDeleteResponse,
  TrackMetadataUpdate,
  TrackPage,
  TrackRestoreRequest,
  VirtualTagDefinition,
  VirtualTagDefinitionRequest,
  VirtualTagPreviewRequest,
  VirtualTagPreviewResponse,
} from "../types/api";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8765";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
      message = body.detail ?? message;
    } catch {
      // Keep the HTTP status message when the backend does not return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function fetchSettings(): Promise<SettingsResponse> {
  return request<SettingsResponse>("/settings");
}

export function fetchBackendHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
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

export function updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return request<SettingsResponse>("/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export function fetchHistory(limit = 200): Promise<PlayEventEntry[]> {
  return request<PlayEventEntry[]>(`/history?limit=${limit}`);
}

export function fetchLibraryStats(): Promise<LibraryStatsResponse> {
  return request<LibraryStatsResponse>("/library/stats");
}

export function fetchLibraryHealth(limit = 80): Promise<LibraryHealthResponse> {
  return request<LibraryHealthResponse>(`/library/health?limit=${limit}`);
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
  return request<CacheClearResponse>("/library/maintenance/clear", {
    method: "POST",
    body: JSON.stringify({ targets }),
  });
}

export function inferFilenameTags(requestBody: FilenameTagInferenceRequest): Promise<FilenameTagInferenceResponse> {
  return request<FilenameTagInferenceResponse>("/library/tools/infer-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function organizeFiles(requestBody: FileOrganizationRequest): Promise<FileOrganizationResponse> {
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

export function installChromaprintTool(requestBody: ChromaprintInstallRequest = {}): Promise<ChromaprintInstallResponse> {
  return request<ChromaprintInstallResponse>("/library/tools/acoustic-fingerprints/install", {
    method: "POST",
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
  return request<BulkUndoLogEntry[]>(`/library/tools/undo-log?limit=${limit}`);
}

export function fetchBulkUndoBatches(limit = 30): Promise<BulkUndoBatchEntry[]> {
  return request<BulkUndoBatchEntry[]>(`/library/tools/undo-batches?limit=${limit}`);
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

export function startFolderWatch(folderPath?: string | null, intervalSeconds = 45, limit = 300): Promise<FolderWatchStatus> {
  return request<FolderWatchStatus>("/library/watch/start", {
    method: "POST",
    body: JSON.stringify({
      folder_path: folderPath || null,
      interval_seconds: intervalSeconds,
      limit,
    }),
  });
}

export function stopFolderWatch(limit = 300): Promise<FolderWatchStatus> {
  return request<FolderWatchStatus>(`/library/watch/stop?limit=${limit}`, { method: "POST" });
}

export function refreshFolderWatch(folderPath?: string | null, limit = 300): Promise<FolderWatchStatus> {
  return request<FolderWatchStatus>("/library/watch/refresh", {
    method: "POST",
    body: JSON.stringify({
      folder_path: folderPath || null,
      limit,
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

export function playCdTrack(trackNumber: number, driveId?: string | null): Promise<CdPlaybackResponse> {
  return request<CdPlaybackResponse>("/library/tools/cd-rip/playback/play", {
    method: "POST",
    body: JSON.stringify({ drive_id: driveId ?? null, track_number: trackNumber }),
  });
}

export function stopCdPlayback(): Promise<CdPlaybackResponse> {
  return request<CdPlaybackResponse>("/library/tools/cd-rip/playback/stop", { method: "POST" });
}

export function fetchClapStatus(): Promise<ClapStatusResponse> {
  return request<ClapStatusResponse>("/analysis/clap/status");
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

export function fetchTracks(search = ""): Promise<Track[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  const query = params.toString();
  return request<Track[]>(query ? `/tracks?${query}` : "/tracks");
}

export function fetchTrack(trackId: number): Promise<Track> {
  return request<Track>(`/tracks/${trackId}`);
}

export function fetchSimilarTracks(trackId: number, limit = 12): Promise<SimilarTrack[]> {
  return request<SimilarTrack[]>(`/tracks/${trackId}/similar?limit=${limit}`);
}

export function deleteTrack(trackId: number, deleteFile = false): Promise<TrackDeleteResponse> {
  const params = new URLSearchParams({ delete_file: String(deleteFile) });
  return request<TrackDeleteResponse>(`/tracks/${trackId}?${params.toString()}`, { method: "DELETE" });
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
}: {
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}): Promise<TrackPage> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("sort_by", sortBy);
  params.set("sort_direction", sortDirection);
  return request<TrackPage>(`/tracks/page?${params.toString()}`);
}

export function fetchAlbums(search = ""): Promise<AlbumSummary[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", "20000");
  return request<AlbumSummary[]>(`/albums?${params.toString()}`);
}

export function fetchAlbumTracks(albumId: number): Promise<Track[]> {
  return request<Track[]>(`/albums/${albumId}/tracks`);
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

export function albumCoverUrl(albumId: number): string {
  return `${API_BASE}/albums/${albumId}/artwork`;
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

export function fetchSmartPlaylistPresets(): Promise<Record<string, SmartPlaylistRule>> {
  return request<Record<string, SmartPlaylistRule>>("/smart-playlists/presets");
}

export function fetchSmartPlaylists(): Promise<SmartPlaylistSummary[]> {
  return request<SmartPlaylistSummary[]>("/smart-playlists");
}

export function createSmartPlaylist(name: string, rule: SmartPlaylistRule): Promise<SmartPlaylistSummary> {
  return request<SmartPlaylistSummary>("/smart-playlists", {
    method: "POST",
    body: JSON.stringify({ name, rule }),
  });
}

export function deleteSmartPlaylist(smartPlaylistId: number): Promise<SmartPlaylistSummary[]> {
  return request<SmartPlaylistSummary[]>(`/smart-playlists/${smartPlaylistId}`, {
    method: "DELETE",
  });
}

export function previewSmartPlaylist(rule: SmartPlaylistRule): Promise<Track[]> {
  return request<Track[]>("/smart-playlists/preview", {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

export function fetchSmartPlaylistTracks(smartPlaylistId: number): Promise<Track[]> {
  return request<Track[]>(`/smart-playlists/${smartPlaylistId}/tracks`);
}

export function fetchPlaylists(): Promise<PlaylistSummary[]> {
  return request<PlaylistSummary[]>("/playlists");
}

export function createPlaylist(name: string): Promise<PlaylistSummary> {
  return request<PlaylistSummary>("/playlists", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deletePlaylist(playlistId: number): Promise<PlaylistSummary[]> {
  return request<PlaylistSummary[]>(`/playlists/${playlistId}`, {
    method: "DELETE",
  });
}

export function fetchPlaylistTracks(playlistId: number): Promise<Track[]> {
  return request<Track[]>(`/playlists/${playlistId}/tracks`);
}

export function addTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<Track[]> {
  return request<Track[]>(`/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  });
}

export function removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<Track[]> {
  return request<Track[]>(`/playlists/${playlistId}/tracks/${trackId}`, {
    method: "DELETE",
  });
}

export function moveTrackInPlaylist(
  playlistId: number,
  trackId: number,
  direction: "up" | "down",
): Promise<Track[]> {
  return request<Track[]>(`/playlists/${playlistId}/tracks/${trackId}/move`, {
    method: "PATCH",
    body: JSON.stringify({ direction }),
  });
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

export function scanLibrary(folderPath: string): Promise<ScanResult> {
  return request<ScanResult>("/scan", {
    method: "POST",
    body: JSON.stringify({ folder_path: folderPath }),
  });
}

export function startScanLibrary(folderPath: string): Promise<ScanStartResponse> {
  return request<ScanStartResponse>("/scan/start", {
    method: "POST",
    body: JSON.stringify({ folder_path: folderPath }),
  });
}

export function fetchScanProgress(jobId: string): Promise<ScanProgress> {
  return request<ScanProgress>(`/scan/jobs/${jobId}`);
}

export function updateTrackRating(trackId: number, rating: number | null): Promise<Track> {
  return request<Track>(`/tracks/${trackId}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export function audioUrl(trackId: number): string {
  return `${API_BASE}/tracks/${trackId}/audio`;
}

export function albumArtworkUrl(trackId: number): string {
  return `${API_BASE}/tracks/${trackId}/artwork`;
}

export function fetchLyrics(trackId: number): Promise<LyricsResponse> {
  return request<LyricsResponse>(`/tracks/${trackId}/lyrics`);
}

export function fetchLyricsOnline(trackId: number): Promise<LyricsResponse> {
  return request<LyricsResponse>(`/tracks/${trackId}/lyrics/fetch`, { method: "POST" });
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
  return request<Track>(`/tracks/${trackId}/played`, {
    method: "POST",
  });
}

export function markTrackSkipped(trackId: number): Promise<Track> {
  return request<Track>(`/tracks/${trackId}/skipped`, {
    method: "POST",
  });
}

export function fetchArtistLocalTracks(artistName: string): Promise<Track[]> {
  const params = new URLSearchParams({ name: artistName });
  return request<Track[]>(`/artists/local-tracks?${params.toString()}`);
}

export function clearArtistCache(): Promise<{ deleted: number }> {
  return request<{ deleted: number }>("/artists/cache", {
    method: "DELETE",
  });
}

export function fetchAutoDjAvoidRules(): Promise<AutoDjAvoidRule[]> {
  return request<AutoDjAvoidRule[]>("/autodj/avoid");
}

export function createAutoDjAvoidRule(requestBody: {
  scope: "track" | "artist" | "album" | "genre";
  track_id?: number | null;
  value?: string | null;
}): Promise<AutoDjAvoidRule> {
  return request<AutoDjAvoidRule>("/autodj/avoid", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function deleteAutoDjAvoidRule(ruleId: number): Promise<AutoDjAvoidRule[]> {
  return request<AutoDjAvoidRule[]>(`/autodj/avoid/${ruleId}`, { method: "DELETE" });
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
  return request<AutoDjResponse>("/autodj/generate", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export function exportQueue(trackIds: number[]): Promise<ExportResponse> {
  return request<ExportResponse>("/autodj/export", {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  });
}
