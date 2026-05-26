import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import {
  applyDuplicateAction,
  autoTagMusicBrainz,
  cancelAudioConversion,
  clearArtistCache,
  clearLibraryCaches,
  exportFileOrganizationReport,
  exportMetadataCsv,
  exportMetadataCsvImportReport,
  fetchAudioConversionFfmpegInstall,
  fetchAudioConversionProgress,
  fetchAudioConversionSetup,
  fetchBulkUndoBatches,
  fetchBulkUndoLog,
  fetchCdRipSetup,
  fetchChromaprintSetup,
  fetchDuplicateReview,
  importMetadataCsv,
  inferFilenameTags,
  organizeFiles,
  previewAudioConversion,
  readReportFile,
  replaceTagsWithRegex,
  restoreBulkUndoBatch,
  restoreBulkUndoEntry,
  runAcousticFingerprintPass,
  saveAudioConversionSetup,
  saveChromaprintSetup,
  startAudioConversion,
  startAudioConversionFfmpegInstall,
  syncDeviceFolder,
  syncTrackMetadata,
} from "../../lib/api";
import type {
  AcousticFingerprintResponse,
  ArtistInfoResponse,
  AudioConversionFormat,
  AudioConversionInstallProgress,
  AudioConversionPreviewResponse,
  AudioConversionProgress,
  AudioConversionSetupResponse,
  AutoTagResponse,
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  BulkUndoRestoreResponse,
  CacheClearTarget,
  CdRipSetupResponse,
  ChromaprintStatusResponse,
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  DuplicateActionRequest,
  DuplicateActionResponse,
  DuplicateReviewResponse,
  DeviceSyncResponse,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  FilenameTagInferenceResponse,
  ReportFileResponse,
  TagRegexReplaceResponse,
  Track,
} from "../../types/api";
import {
  display,
  formatTime,
} from "../shared";
import { useAudioConversionController } from "./fileManagement/useAudioConversionController";
import { useBulkUndoController } from "./fileManagement/useBulkUndoController";
import { useMetadataImportController } from "./fileManagement/useMetadataImportController";
import type {
  LibraryView,
  Page,
  UndoAction,
} from "../shared";

type FileManagementControllerDeps = {
  findTracksByIds: (trackIds: number[]) => Track[];
  handleUndoAction: () => Promise<void>;
  loadAlbums: () => Promise<unknown>;
  loadArtists: () => Promise<unknown>;
  loadInbox: () => Promise<unknown>;
  loadLibraryStats: () => Promise<unknown>;
  loadRecommendationHistory: () => Promise<unknown>;
  refreshTracks: () => Promise<unknown>;
  setActivePage: Dispatch<SetStateAction<Page>>;
  setArtistInfo: Dispatch<SetStateAction<ArtistInfoResponse | null>>;
  setFileManagementFocusToolId: Dispatch<SetStateAction<string | null>>;
  setFileManagementScopeIds: Dispatch<SetStateAction<number[] | null>>;
  setLibraryView: Dispatch<SetStateAction<LibraryView>>;
  setStatus: Dispatch<SetStateAction<string>>;
  undoAction: UndoAction | null;
};

export function useFileManagementController({
  findTracksByIds,
  handleUndoAction,
  loadAlbums,
  loadArtists,
  loadInbox,
  loadLibraryStats,
  loadRecommendationHistory,
  refreshTracks,
  setActivePage,
  setArtistInfo,
  setFileManagementFocusToolId,
  setFileManagementScopeIds,
  setLibraryView,
  setStatus,
  undoAction,
}: FileManagementControllerDeps) {
  const [filenameTagPreview, setFilenameTagPreview] = useState<FilenameTagInferenceResponse | null>(null);
  const [tagRegexPreview, setTagRegexPreview] = useState<TagRegexReplaceResponse | null>(null);
  const [autoTagPreview, setAutoTagPreview] = useState<AutoTagResponse | null>(null);
  const [fileOrganizationPreview, setFileOrganizationPreview] = useState<FileOrganizationResponse | null>(null);
  const [fileOrganizationReport, setFileOrganizationReport] = useState<FileOrganizationReportResponse | null>(null);
  const [deviceSyncPreview, setDeviceSyncPreview] = useState<DeviceSyncResponse | null>(null);
  const {
    bulkUndoLog,
    setBulkUndoLog,
    bulkUndoBatches,
    setBulkUndoBatches,
    bulkUndoRestoreResult,
    setBulkUndoRestoreResult,
    loadBulkUndoLog,
    handleRestoreBulkUndoEntry,
    handleRestoreBulkUndoBatch,
    handleUndoRecentChange,
  } = useBulkUndoController({
    handleUndoAction,
    loadAlbums,
    loadArtists,
    loadLibraryStats,
    refreshTracks,
    setStatus,
    undoAction,
  });
  const {
    metadataCsvExport,
    setMetadataCsvExport,
    metadataCsvImportPreview,
    setMetadataCsvImportPreview,
    metadataCsvImportReport,
    setMetadataCsvImportReport,
    duplicateActionResult,
    setDuplicateActionResult,
    duplicateReview,
    setDuplicateReview,
    handleExportMetadataCsv,
    handlePreviewMetadataCsv,
    handleApplyMetadataCsv,
    handleExportMetadataCsvReport,
    handleDuplicateAction,
    handleIgnoreDuplicateGroup,
    handleClearIgnoredDuplicateGroups,
    handleLoadDuplicateReview,
    handleRevealTracksByIds,
  } = useMetadataImportController({
    findTracksByIds,
    loadAlbums,
    loadArtists,
    loadBulkUndoLog,
    loadLibraryStats,
    refreshTracks,
    setStatus,
  });
  const {
    audioConversionSetup,
    setAudioConversionSetup,
    audioConversionInstallProgress,
    setAudioConversionInstallProgress,
    audioConversionPreview,
    setAudioConversionPreview,
    audioConversionProgress,
    setAudioConversionProgress,
    audioConversionJobId,
    setAudioConversionJobId,
    cdRipSetup,
    setCdRipSetup,
    loadAudioConversionSetup,
    loadCdRipSetup,
    handleSaveAudioConversionSetup,
    handleInstallAudioConversionFfmpeg,
    audioConversionRequest,
    handlePreviewAudioConversion,
    handleStartAudioConversion,
    handleCancelAudioConversion,
  } = useAudioConversionController({
    setStatus,
  });
  const [chromaprintSetup, setChromaprintSetup] = useState<ChromaprintStatusResponse | null>(null);
  const [acousticFingerprintResult, setAcousticFingerprintResult] = useState<AcousticFingerprintResponse | null>(null);
  const [reportFile, setReportFile] = useState<ReportFileResponse | null>(null);
  async function handleClearArtistCache() {
    try {
      const response = await clearArtistCache();
      setArtistInfo(null);
      setStatus(`Cleared ${response.deleted} cached artist records`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not clear artist cache");
    }
  }

  async function handleClearLibraryCaches(targets: CacheClearTarget[]) {
    try {
      const response = await clearLibraryCaches(targets);
      const total = Object.values(response.cleared).reduce((sum, count) => sum + (count ?? 0), 0);
      if (targets.includes("artist")) {
        setArtistInfo(null);
      }
      await Promise.all([loadLibraryStats(), loadRecommendationHistory()]);
      setStatus(`Cleared ${total.toLocaleString()} cached record${total === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not clear caches");
    }
  }

  async function handlePreviewFilenameTags(pattern: string, missingOnly: boolean, trackIds?: number[] | null) {
    try {
      const response = await inferFilenameTags({
        pattern,
        track_ids: trackIds?.length ? trackIds : null,
        missing_only: missingOnly,
        apply: false,
        limit: 200,
      });
      setFilenameTagPreview(response);
      setStatus(`Matched ${response.matches.toLocaleString()} of ${response.total.toLocaleString()} previewed tracks`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not infer tags from filenames");
    }
  }

  async function handleApplyFilenameTags(pattern: string, missingOnly: boolean, trackIds?: number[] | null) {
    if (!window.confirm("Apply inferred filename tags to the library? This uses the current file-write setting for audio tags.")) {
      return;
    }
    try {
      const response = await inferFilenameTags({
        pattern,
        track_ids: trackIds?.length ? trackIds : null,
        missing_only: missingOnly,
        apply: true,
        limit: 10000,
      });
      setFilenameTagPreview(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats()]);
      setStatus(`Applied inferred tags to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not apply inferred tags");
    }
  }

  async function handlePreviewTagRegex(
    field: "title" | "artist" | "album" | "album_artist" | "genre",
    pattern: string,
    replacement: string,
    caseSensitive: boolean,
    trackIds?: number[] | null,
  ) {
    if (!pattern.trim()) {
      setStatus("Enter a regular expression first");
      return;
    }
    try {
      const response = await replaceTagsWithRegex({
        field,
        pattern,
        replacement,
        case_sensitive: caseSensitive,
        track_ids: trackIds?.length ? trackIds : null,
        apply: false,
        limit: 10000,
      });
      setTagRegexPreview(response);
      setStatus(`${response.changed.toLocaleString()} of ${response.total.toLocaleString()} previewed tags would change`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview regex tag replacement");
    }
  }

  async function handleApplyTagRegex(
    field: "title" | "artist" | "album" | "album_artist" | "genre",
    pattern: string,
    replacement: string,
    caseSensitive: boolean,
    trackIds?: number[] | null,
  ) {
    if (!pattern.trim()) {
      setStatus("Enter a regular expression first");
      return;
    }
    if (!window.confirm("Apply this regular expression replacement to tags? File writing follows the current write-tags setting.")) {
      return;
    }
    try {
      const response = await replaceTagsWithRegex({
        field,
        pattern,
        replacement,
        case_sensitive: caseSensitive,
        track_ids: trackIds?.length ? trackIds : null,
        apply: true,
        limit: 10000,
      });
      setTagRegexPreview(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(`Applied regex tag replacement to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not apply regex tag replacement");
    }
  }

  async function handlePreviewAutoTag(
    mode: "album" | "track",
    missingOnly: boolean,
    includeArtwork: boolean,
    trackIds?: number[] | null,
    options?: { fingerprintOnly?: boolean },
  ) {
    const sourceLabel = options?.fingerprintOnly ? "AcoustID fingerprint" : "MusicBrainz";
    try {
      setStatus(`Previewing ${sourceLabel} auto-tags...`);
      const response = await autoTagMusicBrainz({
        mode,
        track_ids: trackIds?.length ? trackIds : null,
        missing_only: missingOnly,
        include_artwork: includeArtwork,
        fingerprint_only: options?.fingerprintOnly ?? false,
        apply: false,
        limit: 50,
        candidate_limit: 3,
      });
      setAutoTagPreview(response);
      setStatus(
        options?.fingerprintOnly
          ? `Fingerprint matched ${response.matched.toLocaleString()} of ${response.total.toLocaleString()} previewed tracks. Apply accepted fingerprint tags to update metadata.`
          : `MusicBrainz matched ${response.matched.toLocaleString()} of ${response.total.toLocaleString()} previewed tracks`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Could not preview ${sourceLabel} auto-tags`);
    }
  }

  async function handleApplyAutoTag(
    mode: "album" | "track",
    missingOnly: boolean,
    includeArtwork: boolean,
    saveArtwork: boolean,
    writeToFile: boolean,
    trackIds?: number[] | null,
    options?: { fingerprintOnly?: boolean },
  ) {
    const sourceLabel = options?.fingerprintOnly ? "AcoustID fingerprint" : "MusicBrainz";
    const action = missingOnly ? `fill missing metadata from ${sourceLabel} matches` : `replace existing metadata with ${sourceLabel} matches`;
    const fileWriteMessage = writeToFile ? "Supported audio file tags will also be updated." : "Only the SQLite library will be updated.";
    if (!window.confirm(`Apply auto-tags to ${action}? ${fileWriteMessage}`)) {
      return;
    }
    try {
      setStatus(`Applying ${sourceLabel} auto-tags...`);
      const response = await autoTagMusicBrainz({
        mode,
        track_ids: trackIds?.length ? trackIds : null,
        missing_only: missingOnly,
        include_artwork: includeArtwork,
        save_artwork: saveArtwork,
        fingerprint_only: options?.fingerprintOnly ?? false,
        write_to_file: writeToFile,
        apply: true,
        limit: 200,
        candidate_limit: 3,
      });
      setAutoTagPreview(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(
        `Applied ${sourceLabel} tags to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"} and refreshed the library metadata${
          response.artwork_saved ? ` and saved ${response.artwork_saved.toLocaleString()} cover${response.artwork_saved === 1 ? "" : "s"}` : ""
        }`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Could not apply ${sourceLabel} auto-tags`);
    }
  }

  async function handleLibraryAutoTagTracks(trackIds: number[], apply: boolean) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    setFileManagementScopeIds(uniqueIds);
    setFileManagementFocusToolId("musicBrainz");
    setActivePage("fileManagement");
    if (apply) {
      await handleApplyAutoTag("track", true, true, false, false, uniqueIds);
    } else {
      setStatus(`Previewing MusicBrainz tags for ${uniqueIds.length.toLocaleString()} selected track${uniqueIds.length === 1 ? "" : "s"}...`);
      await handlePreviewAutoTag("track", false, true, uniqueIds);
    }
  }

  async function handleSyncFileMetadata(trackIds: number[]) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    try {
      setStatus(`Syncing file metadata for ${uniqueIds.length.toLocaleString()} track${uniqueIds.length === 1 ? "" : "s"}...`);
      const response = await syncTrackMetadata(uniqueIds);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadInbox()]);
      const skipped = response.missing_track_ids.length + response.errors.length;
      setStatus(
        `Synced metadata from ${response.synced_count.toLocaleString()} file${response.synced_count === 1 ? "" : "s"}${
          skipped ? ` (${skipped.toLocaleString()} skipped)` : ""
        }`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sync file metadata");
    }
  }

  async function handleLibraryFingerprintTagTracks(trackIds: number[]) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    setFileManagementScopeIds(uniqueIds);
    setFileManagementFocusToolId("acousticFingerprints");
    setActivePage("fileManagement");
    setStatus(`Fingerprinting ${uniqueIds.length.toLocaleString()} selected track${uniqueIds.length === 1 ? "" : "s"}...`);
    await handleRunAcousticFingerprintPass(uniqueIds, false, Math.max(uniqueIds.length, 1));
    setStatus("Building MusicBrainz tag preview from fingerprints...");
    await handlePreviewAutoTag("track", true, true, uniqueIds);
  }

  function handleLibraryClapGenreTagTracks(trackIds: number[]) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    setFileManagementScopeIds(uniqueIds);
    setFileManagementFocusToolId("clapGenreTags");
    setActivePage("fileManagement");
    setStatus(`Ready to preview CLAP genres for ${uniqueIds.length.toLocaleString()} selected track${uniqueIds.length === 1 ? "" : "s"}.`);
  }

  function handleLibraryVolumeTagTracks(trackIds: number[]) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    setFileManagementScopeIds(uniqueIds);
    setFileManagementFocusToolId("volumeTags");
    setActivePage("fileManagement");
    setStatus(`Ready to analyze volume tags for ${uniqueIds.length.toLocaleString()} selected track${uniqueIds.length === 1 ? "" : "s"}.`);
  }

  function handleOpenFileManagementForTracks(trackIds: number[]) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    setFileManagementScopeIds(uniqueIds);
    setFileManagementFocusToolId(null);
    setActivePage("fileManagement");
    setStatus(`File Management target set to ${uniqueIds.length.toLocaleString()} selected track${uniqueIds.length === 1 ? "" : "s"}.`);
  }

  function handleOpenOptionalDependencies() {
    setFileManagementScopeIds(null);
    setFileManagementFocusToolId("optionalDependencies");
    setActivePage("fileManagement");
    setStatus("Open Optional Dependencies to install or check FFmpeg.");
  }

  async function handlePreviewFileOrganization(
    template: string,
    baseFolder?: string | null,
    options?: { collisionStrategy?: "skip" | "auto_rename"; cleanupEmptyFolders?: boolean; trackIds?: number[] | null },
  ) {
    try {
      const response = await organizeFiles({
        template,
        base_folder: baseFolder || null,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        collision_strategy: options?.collisionStrategy ?? "skip",
        cleanup_empty_folders: options?.cleanupEmptyFolders ?? false,
        apply: false,
        limit: 200,
      });
      setFileOrganizationPreview(response);
      setStatus(
        `${response.changed_count.toLocaleString()} of ${response.total.toLocaleString()} previewed tracks would be renamed/reorganized`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview file organization");
    }
  }

  async function handleApplyFileOrganization(
    template: string,
    baseFolder?: string | null,
    options?: { collisionStrategy?: "skip" | "auto_rename"; cleanupEmptyFolders?: boolean; trackIds?: number[] | null },
  ): Promise<boolean> {
    if (!window.confirm("Rename/reorganize audio files on disk and update FLAC Cafe paths? Preview first and make sure the target folder is right.")) {
      return false;
    }
    try {
      const response = await organizeFiles({
        template,
        base_folder: baseFolder || null,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        collision_strategy: options?.collisionStrategy ?? "skip",
        cleanup_empty_folders: options?.cleanupEmptyFolders ?? false,
        apply: true,
        limit: 10000,
      });
      setFileOrganizationPreview(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats()]);
      const cleanup = response.removed_empty_folders
        ? ` and removed ${response.removed_empty_folders.toLocaleString()} empty folder${response.removed_empty_folders === 1 ? "" : "s"}`
        : "";
      setStatus(`Renamed/reorganized ${response.applied.toLocaleString()} file${response.applied === 1 ? "" : "s"}${cleanup}`);
      return response.applied > 0;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not organize files");
      return false;
    }
  }

  async function handleExportFileOrganizationReport(
    template: string,
    baseFolder?: string | null,
    options?: { collisionStrategy?: "skip" | "auto_rename"; cleanupEmptyFolders?: boolean; trackIds?: number[] | null },
  ) {
    try {
      const response = await exportFileOrganizationReport({
        template,
        base_folder: baseFolder || null,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        collision_strategy: options?.collisionStrategy ?? "skip",
        cleanup_empty_folders: options?.cleanupEmptyFolders ?? false,
        apply: false,
        limit: 10000,
      });
      setFileOrganizationReport(response);
      setStatus(`Exported file organization report to ${response.report_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export file organization report");
    }
  }

  async function handleDeviceSync(
    targetFolder: string,
    options: {
      playlistIds?: number[];
      trackIds?: number[] | null;
      musicSubfolder?: string;
      playlistSubfolder?: string;
      copyFiles?: boolean;
      exportPlaylists?: boolean;
      preserveStructure?: boolean;
      apply?: boolean;
    },
  ) {
    const trimmedTarget = targetFolder.trim();
    if (!trimmedTarget) {
      setStatus("Choose a device sync folder first");
      return;
    }
    if (options.apply && !window.confirm("Copy files and write playlists into the target folder? Existing older files may be replaced.")) {
      return;
    }
    try {
      const response = await syncDeviceFolder({
        target_folder: trimmedTarget,
        playlist_ids: options.playlistIds ?? [],
        track_ids: options.trackIds?.length ? options.trackIds : null,
        music_subfolder: options.musicSubfolder ?? "Music",
        playlist_subfolder: options.playlistSubfolder ?? "Playlists",
        copy_files: options.copyFiles ?? true,
        export_playlists: options.exportPlaylists ?? true,
        preserve_structure: options.preserveStructure ?? true,
        apply: options.apply ?? false,
        limit: 10000,
      });
      setDeviceSyncPreview(response);
      setStatus(
        options.apply
          ? `Synced ${response.copied_files.toLocaleString()} file${response.copied_files === 1 ? "" : "s"} and wrote ${response.playlists_written.toLocaleString()} playlist${response.playlists_written === 1 ? "" : "s"}`
          : `${response.changed_files.toLocaleString()} of ${response.total_tracks.toLocaleString()} files would copy`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not run device sync");
    }
  }

  async function loadChromaprintSetup() {
    try {
      setChromaprintSetup(await fetchChromaprintSetup());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not check Chromaprint setup");
    }
  }

  async function handleSaveChromaprintSetup(fpcalcPath: string | null) {
    try {
      const response = await saveChromaprintSetup({ fpcalc_path: fpcalcPath });
      setChromaprintSetup(response);
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save Chromaprint setup");
    }
  }

  async function handleRunAcousticFingerprintPass(trackIds: number[] | null, overwrite: boolean, limit: number) {
    try {
      setStatus(
        trackIds?.length
          ? `Analyzing fingerprints for ${trackIds.length.toLocaleString()} track${trackIds.length === 1 ? "" : "s"}...`
          : "Analyzing acoustic fingerprints...",
      );
      const response = await runAcousticFingerprintPass({
        track_ids: trackIds?.length ? trackIds : null,
        overwrite,
        limit,
      });
      setAcousticFingerprintResult(response);
      await loadChromaprintSetup();
      await Promise.all([refreshTracks(), loadLibraryStats()]);
      const firstSkipReason = response.skipped_reasons?.[0];
      setStatus(
        response.tool_available
          ? response.updated
            ? `Updated ${response.updated.toLocaleString()} acoustic fingerprint${response.updated === 1 ? "" : "s"}`
            : firstSkipReason ?? response.errors[0] ?? "No acoustic fingerprints were updated"
          : response.errors[0] ?? "Acoustic fingerprint tool is not available",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not run acoustic fingerprint pass");
    }
  }

  async function handleReadReportFile(reportPath: string) {
    const trimmedPath = reportPath.trim();
    if (!trimmedPath) {
      setStatus("Choose a report path first");
      return;
    }
    try {
      const response = await readReportFile({ report_path: trimmedPath });
      setReportFile(response);
      setStatus(response.exists ? `Loaded report ${response.report_path}` : response.error ?? "Report file was not found");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load report");
    }
  }

  async function handleAdvancedTagLibraryChanged() {
    await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
  }


  return {
    filenameTagPreview,
    setFilenameTagPreview,
    tagRegexPreview,
    setTagRegexPreview,
    autoTagPreview,
    setAutoTagPreview,
    fileOrganizationPreview,
    setFileOrganizationPreview,
    fileOrganizationReport,
    setFileOrganizationReport,
    metadataCsvExport,
    setMetadataCsvExport,
    metadataCsvImportPreview,
    setMetadataCsvImportPreview,
    metadataCsvImportReport,
    setMetadataCsvImportReport,
    deviceSyncPreview,
    setDeviceSyncPreview,
    audioConversionSetup,
    setAudioConversionSetup,
    audioConversionInstallProgress,
    setAudioConversionInstallProgress,
    audioConversionPreview,
    setAudioConversionPreview,
    audioConversionProgress,
    setAudioConversionProgress,
    audioConversionJobId,
    setAudioConversionJobId,
    cdRipSetup,
    setCdRipSetup,
    duplicateActionResult,
    setDuplicateActionResult,
    duplicateReview,
    setDuplicateReview,
    chromaprintSetup,
    setChromaprintSetup,
    acousticFingerprintResult,
    setAcousticFingerprintResult,
    bulkUndoLog,
    setBulkUndoLog,
    bulkUndoBatches,
    setBulkUndoBatches,
    bulkUndoRestoreResult,
    setBulkUndoRestoreResult,
    reportFile,
    setReportFile,
    handleClearArtistCache,
    handleClearLibraryCaches,
    handlePreviewFilenameTags,
    handleApplyFilenameTags,
    handlePreviewTagRegex,
    handleApplyTagRegex,
    handlePreviewAutoTag,
    handleApplyAutoTag,
    handleLibraryAutoTagTracks,
    handleSyncFileMetadata,
    handleLibraryFingerprintTagTracks,
    handleLibraryClapGenreTagTracks,
    handleLibraryVolumeTagTracks,
    handleOpenFileManagementForTracks,
    handleOpenOptionalDependencies,
    handlePreviewFileOrganization,
    handleApplyFileOrganization,
    handleExportFileOrganizationReport,
    handleDeviceSync,
    loadAudioConversionSetup,
    loadCdRipSetup,
    handleSaveAudioConversionSetup,
    handleInstallAudioConversionFfmpeg,
    audioConversionRequest,
    handlePreviewAudioConversion,
    handleStartAudioConversion,
    handleCancelAudioConversion,
    handleExportMetadataCsv,
    handlePreviewMetadataCsv,
    handleApplyMetadataCsv,
    handleExportMetadataCsvReport,
    handleDuplicateAction,
    handleIgnoreDuplicateGroup,
    handleClearIgnoredDuplicateGroups,
    handleLoadDuplicateReview,
    handleRevealTracksByIds,
    loadChromaprintSetup,
    handleSaveChromaprintSetup,
    handleRunAcousticFingerprintPass,
    loadBulkUndoLog,
    handleRestoreBulkUndoEntry,
    handleRestoreBulkUndoBatch,
    handleUndoRecentChange,
    handleReadReportFile,
    handleAdvancedTagLibraryChanged,
  };
}
