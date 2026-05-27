import type {
  MouseEvent as ReactMouseEvent,
} from "react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ThemePalette,
} from "../config/theme";
import {
  fontChoiceValues,
  themeAccentLabels,
  themeAccentValues,
  themeOrder,
} from "../config/theme";
import {
  addTracksToPlaylist,
  applyFolderWatchChanges,
  acknowledgeFolderWatchNotifications,
  autoTagMusicBrainz,
  backupDatabase,
  cancelAudioConversion,
  cancelClapAudioAnalysis,
  clearArtistCache,
  clearLibraryCaches,
  createAutoDjAvoidRule,
  createInboxAutoReviewRule,
  createPlaylist,
  createSupportBundle,
  deleteAutoDjAvoidRule,
  deleteInboxAutoReviewRule,
  deletePlaylist,
  deleteRecommendationProfile,
  deleteTrack,
  deleteTracks,
  exportMetadataCsv,
  exportMetadataCsvImportReport,
  exportPlaylist,
  exportQueue,
  fetchAudioConversionProgress,
  fetchAudioConversionSetup,
  fetchAlbumTracks,
  fetchAlbums,
  fetchArtistInfo,
  fetchAudioConversionFfmpegInstall,
  fetchArtistLocalTracks,
  fetchArtists,
  fetchAutoDjAvoidRules,
  fetchBackendHealth,
  fetchBackendLog,
  fetchClapAudioAnalysis,
  fetchClapCoverage,
  fetchClapInstall,
  fetchClapStatus,
  fetchFolderWatchStatus,
  fetchHistory,
  fetchHistoryStats,
  fetchLibraryHealth,
  fetchLibraryInbox,
  fetchLibraryStats,
  fetchLyrics,
  fetchLyricsByMetadata,
  fetchLyricsOnline,
  fetchPlaylistTracks,
  fetchPlaylists,
  fetchRecommendationHistory,
  fetchRecommendationProfiles,
  fetchScanProgress,
  fetchSettings,
  fetchStartupDiagnostics,
  fetchTrack,
  fetchTracksBatch,
  fetchTracks,
  fetchTrackPage,
  generateAutoDj,
  importPlaylist,
  importMetadataCsv,
  inferFilenameTags,
  markRadioStationPlayed,
  markTrackPlayed,
  markTrackSkipped,
  moveTrackInPlaylist,
  organizeFiles,
  pauseClapAudioAnalysis,
  playCdTrack,
  recordRecommendationFeedback,
  refreshFolderWatch,
  removeLibrarySource,
  removeTrackFromPlaylist,
  replaceTagsWithRegex,
  reviewAllInboxTracks,
  reviewInboxTracks,
  restoreTrack,
  resumeClapAudioAnalysis,
  resetLocalData,
  saveAudioConversionSetup,
  saveRecommendationProfile,
  setDefaultRecommendationProfile,
  startAudioConversion,
  startAudioConversionFfmpegInstall,
  startClapAudioAnalysis,
  startClapInstall,
  startFolderWatch,
  startScanLibrary,
  stopFolderWatch,
  syncTrackMetadata,
  syncDeviceFolder,
  updateClapConfig,
  updateInboxAutoReviewRule,
  updateInboxNote,
  updateLyrics,
  updateSettings,
  updateTrackMetadata,
  updateTrackRating,
  applyDuplicateAction,
  exportFileOrganizationReport,
  fetchBulkUndoLog,
  fetchBulkUndoBatches,
  fetchChromaprintSetup,
  fetchCdRipSetup,
  fetchDuplicateReview,
  readReportFile,
  restoreBulkUndoBatch,
  restoreBulkUndoEntry,
  runAcousticFingerprintPass,
  saveChromaprintSetup,
  previewAudioConversion,
} from "../lib/api";
import {
  placeFloatingMenu,
} from "../lib/uiInteractions";
import {
  openExternalUrl,
} from "../lib/externalLinks";
import {
  desktopFetchTrackPage,
  desktopRemoveLibrarySource,
} from "../lib/desktopLibrary";
import {
  BACKEND_STARTUP_GRACE_MS,
  BACKEND_STARTUP_POLL_MS,
  CD_PLAYBACK_PREPARE_DEBOUNCE_MS,
  DEFAULT_LIBRARY_SORT,
  StaleCdPlaybackRequestError,
  StartupLibrarySnapshot,
  buildArtistSummariesFromTracks,
  cdDriveIdFromTrack,
  cdTrackLooksActive,
  cdTrackNumberFromTrack,
  defaultCdRipTarget,
  defaultLibraryTrackQueryKey,
  findAlbumForTrack,
  indexedStartupTracks,
  isStaleCdPlaybackRequest,
  libraryTrackQueryKey,
  lyricsHaveText,
  lyricsLookupRequestForTrack,
  readStartupLibrarySnapshot,
  shouldLookupLyricsByMetadata,
  sortedCachedTracks,
  sourceFolderKey,
  uniqueFolderPaths,
  waitFor,
  writeStartupLibrarySnapshot,
} from "./appHelpers";
import {
  isDesktopBridgeUnavailable,
  listenFolderWatchEvents,
  FolderWatchMarkEvent,
  FolderWatchStart,
  FolderWatchStop,
  PathInfo,
  RecyclePaths,
  desktopScanAudioPaths,
  type RecycleResponse,
} from "../lib/desktopPath";
import type {
  AlbumSummary,
  AcousticFingerprintResponse,
  AdvancedTrackSearchFilters,
  ArtistInfoResponse,
  ArtistSummary,
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AudioConversionInstallProgress,
  AudioConversionPreviewResponse,
  AudioConversionProgress,
  AudioConversionSetupResponse,
  AudioConversionFormat,
  AutoDjAvoidRule,
  AutoDjSettings,
  AutoTagResponse,
  BulkUndoLogEntry,
  BulkUndoBatchEntry,
  BulkUndoRestoreResponse,
  CacheClearTarget,
  ChromaprintStatusResponse,
  CdRipSetupResponse,
  ClapInstallDevice,
  ClapInstallProgress,
  ClapStatusResponse,
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  DuplicateActionRequest,
  DuplicateActionResponse,
  DeviceSyncResponse,
  DuplicateReviewResponse,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  FolderWatchApplyResponse,
  FolderWatchStatus,
  FilenameTagInferenceResponse,
  InboxAutoReviewRule,
  InboxAutoReviewRuleRequest,
  InboxResponse,
  HistoryStatsResponse,
  LibraryHealthResponse,
  LibrarySourceRemoveResponse,
  LibraryStatsResponse,
  LogTailResponse,
  LyricsResponse,
  LyricsUpdateRequest,
  desktopScanSnapshot,
  PlayEventEntry,
  PlaylistSummary,
  QueueTrack,
  RadioStation,
  RecommendationDrift,
  RecommendationProfile,
  RecommendationRun,
  ReportFileResponse,
  ScanProgress,
  ScanResult,
  SettingsResponse,
  StartupDiagnosticsResponse,
  TagRegexReplaceResponse,
  Track,
  TrackPage,
  TrackMetadataUpdate,
} from "../types/api";
import type {
  EditableMetadataKey,
} from "./components/modals";
import {
  APP_CONTEXT_MENU_HEIGHT,
  APP_CONTEXT_MENU_WIDTH,
  AppContextMenu,
  BackendStatus,
  DeleteTrackPrompt,
  LIBRARY_PAGE_SIZE,
  LibraryView,
  MENU_VIEWPORT_MARGIN,
  MetadataColumnKey,
  Page,
  PlaybackMode,
  QUEUE_HISTORY_LIMIT,
  SortState,
  StoredPlaybackSession,
  UiPreferences,
  UndoAction,
  defaultAutoDj,
  display,
  emptyRecommendationDrift,
  fontScaleValues,
  formatTime,
  isAnalysisTerminal,
  isClapInstallTerminal,
  legacyStorageKeys,
  normalizeLibraryColumns,
  normalizePlaybackResumePosition,
  primaryArtistName,
  readQuickStartDismissed,
  readRememberedDeleteChoice,
  readUiPreferences,
  shortcutMatchesEvent,
  shouldRecordTrackAsPlayed,
  shuffleItems,
  storageKeys,
  supportsFileTagWriting,
  trackGenre,
  useRangeWheelControls,
  writeQuickStartDismissed,
  writeRememberedDeleteChoice,
} from "./shared";
import { useFileManagementController } from "./controllers/useFileManagementController";
import { useSourceScanController } from "./controllers/useSourceScanController";
import { useAnalysisController } from "./controllers/useAnalysisController";
import { buildAppControllerReturn } from "./controllers/buildAppControllerReturn";
import { createLibraryActionHandlers } from "./controllers/createLibraryActionHandlers";
import { usePlaybackAutoDjController } from "./controllers/usePlaybackAutoDjController";
import { useAppControllerEffects } from "./controllers/useAppControllerEffects";
import { createBackendSupportHandlers } from "./controllers/createBackendSupportHandlers";
import { useAppControllerState } from "./controllers/useAppControllerState";
import { createPlayerNavigationHandlers } from "./controllers/createPlayerNavigationHandlers";
import { createUiActionHandlers } from "./controllers/createUiActionHandlers";

export function useAppController() {
  useRangeWheelControls();
  const { startupLibrarySnapshot, activePage, setActivePage, tracks, setTracks, trackIndexCache, setTrackIndexCache, queue, setQueue, autoDjAvoidRules, setAutoDjAvoidRules, recommendationProfiles, setRecommendationProfiles, recommendationDrift, setRecommendationDrift, recommendationHistory, setRecommendationHistory, settings, setSettings, settingsFocusSection, setSettingsFocusSection, writeRatingsToFiles, setWriteRatingsToFiles, autoWriteFetchedLyricsSidecars, setAutoWriteFetchedLyricsSidecars, cdAutoLookupMetadata, setCdAutoLookupMetadata, search, setSearch, status, setStatus, backendStatus, setBackendStatus, backendMessage, setBackendMessage, backendCheckedAt, setBackendCheckedAt, startupDiagnostics, setStartupDiagnostics, backendLog, setBackendLog, supportBundlePath, setSupportBundlePath, undoAction, setUndoAction, uiPreferences, setUiPreferences, continuousAutoDjEnabled, setContinuousAutoDjEnabled, continuousAutoDjBusy, setContinuousAutoDjBusy, continuousAutoDjSettings, setContinuousAutoDjSettings, quickStartDismissed, setQuickStartDismissed, coffeeAnimating, setCoffeeAnimating, detailTrack, setDetailTrack, metadataEditTrack, setMetadataEditTrack, metadataEditInitialField, setMetadataEditInitialField, deletePrompt, setDeletePrompt, appContextMenu, setAppContextMenu, fileManagementFocusToolId, setFileManagementFocusToolId, fileManagementScopeIds, setFileManagementScopeIds, currentTrack, setCurrentTrack, currentRadioStation, setCurrentRadioStation, radioPlaybackRequestId, setRadioPlaybackRequestId, autoPlayOnTrackChange, setAutoPlayOnTrackChange, externalTrackRequest, setExternalTrackRequest, externalTrackRequestIdRef, cdPlaybackPrepareRequestIdRef, cdPlaybackPrepareChainRef, playbackQueue, setPlaybackQueue, queueHistory, setQueueHistory, playbackMode, setPlaybackMode, continuousAutoDjInFlightRef, libraryTotal, setLibraryTotal, hasMoreTracks, setHasMoreTracks, isLibraryLoading, setIsLibraryLoading, hasLoadedInitialLibrary, setHasLoadedInitialLibrary, librarySort, setLibrarySort, libraryView, setLibraryView, albums, setAlbums, artists, setArtists, playlists, setPlaylists, libraryStats, setLibraryStats, libraryHealth, setLibraryHealth, inbox, setInbox, historyEvents, setHistoryEvents, historyStats, setHistoryStats, selectedAlbumId, setSelectedAlbumId, selectedAlbumTracks, setSelectedAlbumTracks, selectedArtistName, setSelectedArtistName, selectedArtistTracks, setSelectedArtistTracks, selectedPlaylistId, setSelectedPlaylistId, selectedPlaylistTracks, setSelectedPlaylistTracks, targetPlaylistId, setTargetPlaylistId, newPlaylistName, setNewPlaylistName, importPlaylistPath, setImportPlaylistPath, debouncedSearch, setDebouncedSearch, advancedTrackSearch, setAdvancedTrackSearch, debouncedAdvancedTrackSearch, setDebouncedAdvancedTrackSearch, lyrics, setLyrics, isLyricsLoading, setIsLyricsLoading, artistInfo, setArtistInfo, artistTracks, setArtistTracks, isArtistLoading, setIsArtistLoading, playbackTime, setPlaybackTime, restoredPlaybackPosition, setRestoredPlaybackPosition, libraryScrollTop, setLibraryScrollTop, libraryArtistScrollTop, setLibraryArtistScrollTop, libraryAlbumScrollTop, setLibraryAlbumScrollTop, libraryCompletionScrollTop, setLibraryCompletionScrollTop, libraryPlaylistScrollTop, setLibraryPlaylistScrollTop, trackIndexCacheRef, libraryRequestId, libraryLoadingCountRef, libraryPageRequestsInFlightRef, undoTimerRef, lastSessionWriteKeyRef, lastSessionRestoreFinishedRef, lastSessionRestoreAttemptedRef, startupBackgroundHydratedRef, priorityLibraryLoadStartedRef, priorityLibraryQueryKeyRef, libraryCacheQueryKeyRef, lastFolderWatchNotificationIdRef, FolderWatchRefreshTimerRef } = useAppControllerState();
  const {
    clapStatus,
    setClapStatus,
    clapModelId,
    setClapModelId,
    clapCacheDir,
    setClapCacheDir,
    clapMaxDuration,
    setClapMaxDuration,
    audioAnalysisProgress,
    setAudioAnalysisProgress,
    audioAnalysisCoverage,
    setAudioAnalysisCoverage,
    audioAnalysisEligibleTrackTotal,
    setAudioAnalysisEligibleTrackTotal,
    audioAnalysisJobId,
    setAudioAnalysisJobId,
    clapInstallProgress,
    setClapInstallProgress,
    isClapStatusLoading,
    setIsClapStatusLoading,
    clapStatusLoadPercent,
    setClapStatusLoadPercent,
    clapStatusLoadMessage,
    setClapStatusLoadMessage,
    isClapInstalling,
    setIsClapInstalling,
    audioAnalysisLimit,
    setAudioAnalysisLimit,
    audioAnalysisOverwrite,
    setAudioAnalysisOverwrite,
    audioAnalysisOnlyMissing,
    setAudioAnalysisOnlyMissing,
    isAudioAnalyzing,
    setIsAudioAnalyzing,
    applyClapStatus,
    loadClapStatus,
    loadAnalysisClapReadiness,
    loadClapCoverage,
    refreshAnalyzedState,
    handleSaveClapConfig,
    handleInstallClap,
    handleAnalyzeAudio,
    handleAnalyzeTracks,
    handlePauseAudioAnalysis,
    handleResumeAudioAnalysis,
    handleCancelAudioAnalysis,
  } = useAnalysisController({
    activePage,
    currentTrack,
    detailTrack,
    loadAlbums,
    loadArtists,
    loadLibraryStats,
    refreshTracks,
    replaceTrackEverywhere,
    setStatus,
  });
  const {
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
  } = useFileManagementController({
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
  });
  const {
    folderPath,
    setFolderPath,
    libraryFolders,
    setLibraryFolders,
    scanResult,
    setScanResult,
    scanProgress,
    setScanProgress,
    isScanning,
    setIsScanning,
    folderWatchStatus,
    setFolderWatchStatus,
    validateMusicFoldersWithDesktop,
    buildDesktopScanSnapshot,
    applyFolderWatchStatus,
    loadFolderWatchStatus,
    handleScan,
    handleRemoveLibrarySource,
    handleStartFolderWatch,
    handleStopFolderWatch,
    handleRefreshFolderWatch,
    scheduleFolderWatchRefresh,
    applyFolderWatchResponse,
    handleApplyFolderWatch,
    handleAcknowledgeFolderWatchNotifications,
    handleBrowseFolder,
    handleBrowseAudioConversionTarget,
    handleBrowseCdRipTarget,
    handleChooseMusicFolderAndScan,
    handleUseSuggestedFolder,
  } = useSourceScanController({
    FolderWatchRefreshTimerRef,
    lastFolderWatchNotificationIdRef,
    loadAlbums,
    loadArtists,
    loadClapCoverage,
    loadInbox,
    loadLibraryStats,
    loadPlaylists,
    loadSettings,
    refreshTracks,
    settings,
    setSettings,
    setStatus,
  });
  const hideFilePaths = uiPreferences.hideFilePaths;
  const libraryVisibleColumns = normalizeLibraryColumns(uiPreferences.libraryVisibleColumns);
  const setHideFilePaths = (value: boolean) =>
    setUiPreferences((current) => ({ ...current, hideFilePaths: value }));
  const setLibraryVisibleColumns = (columns: MetadataColumnKey[]) =>
    setUiPreferences((current) => ({ ...current, libraryVisibleColumns: normalizeLibraryColumns(columns) }));

  function patchCachedTrack(updated: Track) {
    let next: Map<number, Track> | null = null;
    for (const [index, track] of trackIndexCacheRef.current.entries()) {
      if (track.id !== updated.id) {
        continue;
      }
      next ??= new Map(trackIndexCacheRef.current);
      next.set(index, updated);
    }
    if (!next) {
      return;
    }
    trackIndexCacheRef.current = next;
    setTrackIndexCache(next);
    setTracks((current) => current.map((track) => (track.id === updated.id ? updated : track)));
  }

  function replaceTrackEverywhere(updated: Track, options?: { lightweightLibraryCache?: boolean }) {
    const replace = (track: Track) => (track.id === updated.id ? updated : track);
    if (options?.lightweightLibraryCache) {
      patchCachedTrack(updated);
    } else {
      updateCachedTracks(replace);
    }
    setSelectedAlbumTracks((current) => current.map(replace));
    setSelectedArtistTracks((current) => current.map(replace));
    setSelectedPlaylistTracks((current) => current.map(replace));
    setInbox((current) => current ? { ...current, tracks: current.tracks.map(replace) } : current);
    setPlaybackQueue((current) => current.map(replace));
    setQueue((current) => current.map((track) => (track.id === updated.id ? { ...track, ...updated } : track)));
    setCurrentTrack((current) => (current?.id === updated.id ? updated : current));
    setDetailTrack((current) => (current?.id === updated.id ? updated : current));
    setMetadataEditTrack((current) => (current?.id === updated.id ? updated : current));
  }

  function removeTrackEverywhere(trackId: number) {
    const remove = (track: Track) => track.id !== trackId;
    updateCachedTracks((track) => (remove(track) ? track : null));
    setSelectedAlbumTracks((current) => current.filter(remove));
    setSelectedArtistTracks((current) => current.filter(remove));
    setSelectedPlaylistTracks((current) => current.filter(remove));
    setInbox((current) => current ? { ...current, tracks: current.tracks.filter(remove) } : current);
    setPlaybackQueue((current) => current.filter(remove));
    setQueue((current) => current.filter((track) => track.id !== trackId));
    setLibraryTotal((current) => Math.max(0, current - 1));
    setCurrentTrack((current) => (current?.id === trackId ? null : current));
    setDetailTrack((current) => (current?.id === trackId ? null : current));
    setMetadataEditTrack((current) => (current?.id === trackId ? null : current));
    setMetadataEditInitialField((current) => (metadataEditTrack?.id === trackId ? null : current));
  }

  function showUndoAction(action: UndoAction) {
    setUndoAction(action);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setUndoAction(null);
      undoTimerRef.current = null;
    }, 9000);
  }

  function findTracksByIds(trackIds: number[]): Track[] {
    const wanted = new Set(trackIds);
    const found = new Map<number, Track>();
    for (const list of [
      tracks,
      selectedAlbumTracks,
      selectedArtistTracks,
      selectedPlaylistTracks,
      playbackQueue,
      queue,
      currentTrack ? [currentTrack] : [],
      detailTrack ? [detailTrack] : [],
    ]) {
      for (const track of list) {
        if (wanted.has(track.id) && !found.has(track.id)) {
          found.set(track.id, track);
        }
      }
    }
    return trackIds.map((trackId) => found.get(trackId)).filter((track): track is Track => Boolean(track));
  }

  async function resolveTracksForAction(trackIds: number[]): Promise<Track[]> {
    const uniqueIds = Array.from(new Set(trackIds));
    const cachedTracks = findTracksByIds(uniqueIds);
    if (cachedTracks.length === uniqueIds.length) {
      return cachedTracks;
    }

    const cachedById = new Map(cachedTracks.map((track) => [track.id, track]));
    const missingIds = uniqueIds.filter((trackId) => !cachedById.has(trackId));
    try {
      const response = await fetchTracksBatch(missingIds);
      for (const track of response.tracks) {
        cachedById.set(track.id, track);
      }
    } catch {
      // If the worker path is unavailable here, callers can still fall back to
      // deleting library rows without Rust recycle-bin support.
    }
    return uniqueIds.map((trackId) => cachedById.get(trackId)).filter((track): track is Track => Boolean(track));
  }

  async function recycleFilesWithDesktop(tracksToRecycle: Track[]): Promise<RecycleResponse | null> {
    const paths = Array.from(new Set(tracksToRecycle.map((track) => track.path).filter(Boolean)));
    if (paths.length === 0) {
      return {
        requested: 0,
        recycled: 0,
        missing: 0,
        errors: [],
      };
    }

    try {
      const response = await RecyclePaths(paths);
      if (response.errors.length > 0) {
        throw new Error(response.errors.slice(0, 3).join("; "));
      }
      return response;
    } catch (error) {
      if (isDesktopBridgeUnavailable(error)) {
        return null;
      }
      throw error;
    }
  }

  function commitTrackIndexCache(next: Map<number, Track>) {
    trackIndexCacheRef.current = next;
    setTrackIndexCache(next);
    setTracks(sortedCachedTracks(next));
  }

  function mergeTrackPage(offset: number, pageTracks: Track[], total: number, reset = false) {
    const next = reset ? new Map<number, Track>() : new Map(trackIndexCacheRef.current);
    pageTracks.forEach((track, index) => {
      next.set(offset + index, track);
    });
    commitTrackIndexCache(next);
    setLibraryTotal(total);
    setHasMoreTracks(next.size < total);
  }

  function updateCachedTracks(updater: (track: Track) => Track | null) {
    const next = new Map<number, Track>();
    for (const [index, track] of trackIndexCacheRef.current.entries()) {
      const updated = updater(track);
      if (updated) {
        next.set(index, updated);
      }
    }
    commitTrackIndexCache(next);
  }

  function beginLibraryLoad() {
    libraryLoadingCountRef.current += 1;
    setIsLibraryLoading(true);
  }

  function endLibraryLoad() {
    libraryLoadingCountRef.current = Math.max(0, libraryLoadingCountRef.current - 1);
    if (libraryLoadingCountRef.current === 0) {
      setIsLibraryLoading(false);
    }
  }

  async function handleUndoAction() {
    if (!undoAction) {
      return;
    }
    const action = undoAction;
    setUndoAction(null);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    try {
      if (action.type === "playlist-remove") {
        const restored = await addTracksToPlaylist(action.playlistId, action.trackIds);
        if (selectedPlaylistId === action.playlistId) {
          setSelectedPlaylistTracks(restored);
        }
        await loadPlaylists();
        setStatus(`Restored ${action.label}`);
        return;
      }

      for (const track of action.tracks) {
        await restoreTrack({ path: track.path, rating: track.rating });
      }
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadPlaylists(), loadLibraryStats(), loadClapCoverage()]);
      setStatus(`Restored ${action.label}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Undo failed");
    }
  }

  const uiActionHandlers = createUiActionHandlers({ playbackQueue, setAppContextMenu, setCoffeeAnimating, setQueueHistory, setQuickStartDismissed, setStatus, setUiPreferences });
  const { dismissQuickStart, handleCoffeeClick, handleCycleTheme, openAppContextMenu, rememberQueueSnapshot } = uiActionHandlers;

  function currentLibraryTrackQueryKey() {
    return libraryTrackQueryKey(debouncedSearch, debouncedAdvancedTrackSearch, librarySort);
  }

  function hasAdvancedLibraryFilters(filters: AdvancedTrackSearchFilters) {
    return Object.entries(filters).some(([, value]) => {
      if (typeof value === "boolean") {
        return value;
      }
      return value !== undefined && value !== null && String(value).trim() !== "" && value !== "any";
    });
  }

  async function loadTracksPage(reset: boolean, offset = 0, limit = LIBRARY_PAGE_SIZE): Promise<boolean> {
    const boundedOffset = Math.max(0, offset);
    const queryKey = currentLibraryTrackQueryKey();
    const requestKey = `${queryKey}:${boundedOffset}:${limit}`;
    if (!reset && libraryPageRequestsInFlightRef.current.has(requestKey)) {
      return false;
    }
    const requestId = reset ? ++libraryRequestId.current : libraryRequestId.current;
    if (reset) {
      setHasMoreTracks(true);
      libraryPageRequestsInFlightRef.current.clear();
    } else if (libraryCacheQueryKeyRef.current !== queryKey) {
      return false;
    }
    libraryPageRequestsInFlightRef.current.add(requestKey);
    beginLibraryLoad();
    try {
      let response: TrackPage | null = null;
      if (!hasAdvancedLibraryFilters(debouncedAdvancedTrackSearch)) {
        try {
          response = await desktopFetchTrackPage({
            search: debouncedSearch,
            limit,
            offset: boundedOffset,
            sortBy: librarySort.key,
            sortDirection: librarySort.direction,
          });
        } catch (error) {
          // Rust SQLite is the fast path. The typed API helper falls back to
          // the Rust-to-Python worker when a Python-owned feature is needed.
        }
      }
      response ??= await fetchTrackPage({
        search: debouncedSearch,
        limit,
        offset: boundedOffset,
        sortBy: librarySort.key,
        sortDirection: librarySort.direction,
        advancedFilters: debouncedAdvancedTrackSearch,
      });
      if (requestId !== libraryRequestId.current) {
        return false;
      }
      libraryCacheQueryKeyRef.current = queryKey;
      mergeTrackPage(response.offset, response.tracks, response.total, reset);
      if (reset && queryKey === defaultLibraryTrackQueryKey()) {
        writeStartupLibrarySnapshot(response.tracks, response.total);
      }
      return true;
    } catch (error) {
      if (requestId === libraryRequestId.current) {
        setStatus(error instanceof Error ? error.message : "Could not load tracks");
      }
      return false;
    } finally {
      libraryPageRequestsInFlightRef.current.delete(requestKey);
      if (requestId === libraryRequestId.current) {
        if (reset) {
          setHasLoadedInitialLibrary(true);
        }
      }
      endLibraryLoad();
    }
  }

  async function loadPriorityLibraryTracks() {
    if (priorityLibraryLoadStartedRef.current) {
      return;
    }
    priorityLibraryLoadStartedRef.current = true;
    const queryKey = currentLibraryTrackQueryKey();
    const loaded = await loadTracksPage(true);
    priorityLibraryQueryKeyRef.current = loaded ? queryKey : null;
  }

  async function refreshTracks() {
    await loadTracksPage(true);
  }

  async function loadMoreTracks() {
    if (!hasMoreTracks || libraryTotal <= 0) {
      return;
    }
    const cachedIndexes = Array.from(trackIndexCacheRef.current.keys());
    const nextOffset = cachedIndexes.length > 0 ? Math.min(libraryTotal, Math.max(...cachedIndexes) + 1) : 0;
    await loadTracksPage(false, nextOffset, LIBRARY_PAGE_SIZE);
  }

  async function loadTrackWindow(offset: number, limit = LIBRARY_PAGE_SIZE) {
    if (libraryTotal <= 0) {
      return;
    }
    const boundedOffset = Math.max(0, Math.min(offset, Math.max(0, libraryTotal - 1)));
    const boundedLimit = Math.max(1, Math.min(limit, libraryTotal - boundedOffset));
    const cache = trackIndexCacheRef.current;
    let missingTrack = false;
    for (let index = boundedOffset; index < boundedOffset + boundedLimit; index += 1) {
      if (!cache.has(index)) {
        missingTrack = true;
        break;
      }
    }
    if (!missingTrack) {
      return;
    }
    await loadTracksPage(false, boundedOffset, boundedLimit);
  }

  async function loadAlbums() {
    try {
      const response = await fetchAlbums(debouncedSearch);
      setAlbums(response);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load albums");
    }
  }

  async function loadArtists() {
    try {
      const response = await fetchArtists(debouncedSearch);
      setArtists(response);
    } catch (error) {
      try {
        const fallbackTracks = await fetchTracks(debouncedSearch);
        setArtists(buildArtistSummariesFromTracks(fallbackTracks, debouncedSearch));
      } catch {
        setStatus(error instanceof Error ? error.message : "Could not load artists");
      }
    }
  }

  async function loadPlaylists() {
    try {
      const response = await fetchPlaylists();
      setPlaylists(response);
      setTargetPlaylistId((current) => {
        if (current && response.some((playlist) => playlist.id === current)) {
          return current;
        }
        return response[0]?.id ?? null;
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load playlists");
    }
  }

  async function loadLibraryStats() {
    try {
      const [stats, health] = await Promise.all([fetchLibraryStats(), fetchLibraryHealth()]);
      setLibraryStats(stats);
      setLibraryHealth(health);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load library stats");
    }
  }

  async function loadInbox() {
    try {
      setInbox(await fetchLibraryInbox());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load Inbox");
    }
  }

  async function loadHistory() {
    const [eventsResult, statsResult, historyStatsResult] = await Promise.allSettled([
      fetchHistory(),
      fetchLibraryStats(),
      fetchHistoryStats(10),
    ]);
    if (eventsResult.status === "fulfilled") {
      setHistoryEvents(eventsResult.value);
    }
    if (statsResult.status === "fulfilled") {
      setLibraryStats(statsResult.value);
    }
    if (historyStatsResult.status === "fulfilled") {
      setHistoryStats(historyStatsResult.value);
    } else {
      setHistoryStats(null);
    }
    if (eventsResult.status === "rejected" || statsResult.status === "rejected") {
      const error = eventsResult.status === "rejected" ? eventsResult.reason : statsResult.status === "rejected" ? statsResult.reason : null;
      setStatus(error instanceof Error ? error.message : "Could not load history");
    }
  }

  async function loadAutoDjAvoidRules() {
    try {
      setAutoDjAvoidRules(await fetchAutoDjAvoidRules());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load AutoDJ avoid list");
    }
  }

  async function loadRecommendationProfiles() {
    try {
      setRecommendationProfiles(await fetchRecommendationProfiles());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load recommendation profiles");
    }
  }

  async function loadRecommendationHistory() {
    try {
      setRecommendationHistory(await fetchRecommendationHistory(30));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load recommendation history");
    }
  }

  async function loadSettings() {
    try {
      const response = await fetchSettings();
      setSettings(response);
      const paths = response.library_paths?.length ? response.library_paths : response.library_path ? [response.library_path] : [];
      setLibraryFolders(paths);
      setFolderPath(paths[0] ?? "");
      setWriteRatingsToFiles(response.write_ratings_to_files);
      setAutoWriteFetchedLyricsSidecars(response.auto_write_fetched_lyrics_sidecars);
      setCdAutoLookupMetadata(response.cd_auto_lookup_metadata);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load settings");
    }
  }

  const backendSupportHandlers = createBackendSupportHandlers({ autoWriteFetchedLyricsSidecars, cdAutoLookupMetadata, lastSessionRestoreAttemptedRef, lastSessionRestoreFinishedRef, loadPriorityLibraryTracks, setActivePage, setAutoWriteFetchedLyricsSidecars, setBackendCheckedAt, setBackendLog, setBackendMessage, setBackendStatus, setCdAutoLookupMetadata, setCurrentTrack, setMetadataEditInitialField, setMetadataEditTrack, setPlaybackQueue, setRestoredPlaybackPosition, setSettings, setSettingsFocusSection, setStartupDiagnostics, setStatus, setSupportBundlePath, setUiPreferences, setWriteRatingsToFiles, supportBundlePath, writeRatingsToFiles });
  const { loadStartupDiagnostics, handleOpenBackendLog, checkBackendStatus, restoreLastPlaybackSession, waitForBackendStartup, handleRestartBackend, handleOpenDetachedMiniPlayer, handleOpenLyricsViewFromPlayer, handleOpenQueueViewFromPlayer, openMetadataEditor, handleWriteRatingsToFiles, handleAutoWriteFetchedLyricsSidecars, handleCdAutoLookupMetadata, handleAcoustIdApiKeyChange, handleLastFmApiCredentialsChange, openApiKeysSettings, handleBackupDatabase, clearFrontendLocalData, handleResetLocalData, handleCreateSupportBundle, handleCopySupportBundlePath, handleOpenSourceFolder, handleOpenExternalUrl } = backendSupportHandlers;

  const playbackAutoDjController = usePlaybackAutoDjController({ shuffleItems, setStatus, tracks, generateAutoDj, defaultAutoDj, recommendationProfiles, settings, uiPreferences, setQueue, setRecommendationDrift, loadRecommendationHistory, setContinuousAutoDjEnabled, queue, currentTrack, setPlaybackQueue, setAutoPlayOnTrackChange, setCurrentTrack, continuousAutoDjInFlightRef, setContinuousAutoDjBusy, continuousAutoDjSettings, playbackQueue, useEffect, continuousAutoDjEnabled, continuousAutoDjBusy, createAutoDjAvoidRule, trackGenre, loadAutoDjAvoidRules, setAutoDjAvoidRules, deleteAutoDjAvoidRule, saveRecommendationProfile, loadRecommendationProfiles, setRecommendationProfiles, setDefaultRecommendationProfile, deleteRecommendationProfile, recordRecommendationFeedback, shouldRecordTrackAsPlayed, markTrackPlayed, markTrackSkipped, replaceTrackEverywhere, loadHistory, cdPlaybackPrepareRequestIdRef, StaleCdPlaybackRequestError, cdDriveIdFromTrack, cdTrackNumberFromTrack, playCdTrack, cdTrackLooksActive, playbackTime, setCurrentRadioStation, cdPlaybackPrepareChainRef, waitFor, CD_PLAYBACK_PREPARE_DEBOUNCE_MS, isStaleCdPlaybackRequest, currentRadioStation, externalTrackRequestIdRef, setExternalTrackRequest, setRestoredPlaybackPosition, setRadioPlaybackRequestId, markRadioStationPlayed, display, rememberQueueSnapshot, queueHistory, setQueueHistory, createPlaylist, addTracksToPlaylist, loadPlaylists, setSelectedPlaylistId, setTargetPlaylistId, shouldLookupLyricsByMetadata, fetchLyricsByMetadata, lyricsLookupRequestForTrack, fetchLyricsOnline, setLyrics, lyrics });
  const { handleShuffleTracks, handleQuickAutoDj, handleContinuousAutoDjChange, queueUpcomingPlaybackTracks, replaceUpcomingPlaybackQueue, extendContinuousAutoDj, handleAvoidAutoDj, handleRevealTrack, handleDeleteAutoDjAvoidRule, handleSaveRecommendationProfile, handleSetDefaultRecommendationProfile, handleDeleteRecommendationProfile, rememberRecommendationFeedback, recordTrackExitQuiet, ensureLatestCdPlaybackRequest, refreshCdPreviewTrack, commitPlayTrack, handlePlayTrack, handleCommitExternalTrackRequest, handlePlayCdPreviewTrack, handlePlayRadioStation, handleStopRadioStation, handlePlayNext, handleAddToQueue, handleMovePlaybackQueueTrack, handleReorderPlaybackQueueTrack, handleRemovePlaybackQueueTrack, handleClearPlaybackQueue, handleRestorePlaybackQueue, handleSavePlaybackQueue, handleTrackEnded, handleTrackSkipped, handleFetchLyrics, handleSaveLyrics } = playbackAutoDjController;
  const libraryActionHandlers = createLibraryActionHandlers({ tracks, trackIndexCacheRef, updateCachedTracks, updateTrackRating, setStatus, setTracks, commitTrackIndexCache, writeRatingsToFiles, findTracksByIds, supportsFileTagWriting, refreshTracks, setSelectedAlbumTracks, setSelectedArtistTracks, setSelectedPlaylistTracks, setInbox, setPlaybackQueue, setQueue, setCurrentTrack, setDetailTrack, setMetadataEditTrack, setLibraryTotal, setMetadataEditInitialField, metadataEditTrack, resolveTracksForAction, recycleFilesWithDesktop, deleteTrack, loadAlbums, loadArtists, loadPlaylists, loadLibraryStats, loadInbox, loadClapCoverage, showUndoAction, display, deleteTracks, readRememberedDeleteChoice, setDeletePrompt, deletePrompt, writeRememberedDeleteChoice, updateTrackMetadata, setSelectedAlbumId, fetchAlbumTracks, setSelectedArtistName, fetchArtistLocalTracks, fetchTracks, primaryArtistName, handlePlayTrack, replaceTrackEverywhere, removeTrackEverywhere, artistTracks, setSelectedPlaylistId, fetchPlaylistTracks, newPlaylistName, createPlaylist, setNewPlaylistName, setTargetPlaylistId, deletePlaylist, setPlaylists, targetPlaylistId, playlists, addTracksToPlaylist, selectedPlaylistId, removeTrackFromPlaylist, selectedPlaylistTracks, moveTrackInPlaylist, exportPlaylist, exportQueue, importPlaylistPath, importPlaylist, setImportPlaylistPath, setLibraryView, reviewAllInboxTracks, reviewInboxTracks, updateInboxNote, updateInboxAutoReviewRule, createInboxAutoReviewRule, deleteInboxAutoReviewRule, handleShuffleTracks, handleQuickAutoDj, handleContinuousAutoDjChange, queueUpcomingPlaybackTracks, replaceUpcomingPlaybackQueue, extendContinuousAutoDj, handleAvoidAutoDj, handleRevealTrack, handleDeleteAutoDjAvoidRule, handleSaveRecommendationProfile, handleSetDefaultRecommendationProfile, handleDeleteRecommendationProfile, rememberRecommendationFeedback, recordTrackExitQuiet, ensureLatestCdPlaybackRequest, refreshCdPreviewTrack, commitPlayTrack, handleCommitExternalTrackRequest, handlePlayCdPreviewTrack, handlePlayRadioStation, handleStopRadioStation, handlePlayNext, handleAddToQueue, handleMovePlaybackQueueTrack, handleReorderPlaybackQueueTrack, handleRemovePlaybackQueueTrack, handleClearPlaybackQueue, handleRestorePlaybackQueue, handleSavePlaybackQueue, handleTrackEnded, handleTrackSkipped, handleFetchLyrics, handleSaveLyrics });
  const { handleRating, handleBulkRating, handleDeleteTrack, handleDeleteTracks, requestDeleteTracks, confirmDeleteTracks, handleSaveTrackMetadata, handleBulkMetadata, handleSelectAlbum, handleSelectArtist, handlePlayAlbum, handlePlayArtist, handleSelectPlaylist, handleCreatePlaylist, handleDeletePlaylist, handleAddTracksToPlaylist, handleRemoveTrackFromPlaylist, handleRemoveTracksFromPlaylist, handleMovePlaylistTrack, handleExportPlaylist, handleExportTracks, handleImportPlaylist, handleReviewInboxTracks, handleUpdateInboxNote, handleSaveInboxAutoReviewRule, handleDeleteInboxAutoReviewRule } = libraryActionHandlers;
  const playerNavigationHandlers = createPlayerNavigationHandlers({ albums, currentTrack, fetchAlbums, fetchArtistInfo, fetchArtistLocalTracks, findAlbumForTrack, handleSelectAlbum, primaryArtistName, setActivePage, setAlbums, setArtistInfo, setArtistTracks, setDebouncedSearch, setDetailTrack, setIsArtistLoading, setLibraryView, setSearch, setStatus, uiPreferences });
  const { handleOpenCurrentTrackFromPlayer, handleOpenCurrentArtistFromPlayer, handleOpenCurrentAlbumFromPlayer, loadArtistInfo } = playerNavigationHandlers;

  const clapNeedsOptionalInstall = Boolean(
    clapStatus && !clapStatus.installed && clapStatus.runtime_managed && !clapStatus.runtime_exists,
  );
  const hasAnalysisIssue = Boolean(
    clapStatus &&
      !clapStatus.installed &&
      !clapNeedsOptionalInstall &&
      ((clapStatus.runtime_exists && !clapStatus.installed) ||
        clapStatus.install_supported === false ||
        Object.keys(clapStatus.dependency_errors ?? {}).length > 0),
  );
  const cdDriveDetected = Boolean(cdRipSetup?.drives.length);
  const currentCdPlaybackDriveId = cdDriveIdFromTrack(currentTrack) ?? cdDriveIdFromTrack(externalTrackRequest?.track);
  const isCdPlaybackActive = Boolean(
    currentCdPlaybackDriveId ||
      cdTrackLooksActive(currentTrack) ||
      cdTrackLooksActive(externalTrackRequest?.track),
  );
  const showCdPage =
    uiPreferences.cdSidebarMode === "always" ||
    (uiPreferences.cdSidebarMode === "drive" && (cdDriveDetected || isCdPlaybackActive));

  useEffect(() => {
    if (activePage === "cd" && !showCdPage) {
      setActivePage("library");
    }
  }, [activePage, showCdPage]);

  const appControllerReturnModel = { acousticFingerprintResult, activePage, advancedTrackSearch, albums, appContextMenu, applyClapStatus, applyFolderWatchResponse, applyFolderWatchStatus, artistInfo, artists, artistTracks, audioAnalysisCoverage, audioAnalysisEligibleTrackTotal, audioAnalysisJobId, audioAnalysisLimit, audioAnalysisOnlyMissing, audioAnalysisOverwrite, audioAnalysisProgress, audioConversionInstallProgress, audioConversionJobId, audioConversionPreview, audioConversionProgress, audioConversionRequest, audioConversionSetup, autoDjAvoidRules, autoPlayOnTrackChange, autoTagPreview, autoWriteFetchedLyricsSidecars, backendCheckedAt, backendLog, backendMessage, backendStatus, beginLibraryLoad, buildDesktopScanSnapshot, bulkUndoBatches, bulkUndoLog, bulkUndoRestoreResult, cdAutoLookupMetadata, cdDriveDetected, cdPlaybackPrepareChainRef, cdPlaybackPrepareRequestIdRef, cdRipSetup, checkBackendStatus, chromaprintSetup, clapCacheDir, clapInstallProgress, clapMaxDuration, clapModelId, clapNeedsOptionalInstall, clapStatus, clapStatusLoadMessage, clapStatusLoadPercent, clearFrontendLocalData, coffeeAnimating, commitPlayTrack, commitTrackIndexCache, confirmDeleteTracks, continuousAutoDjBusy, continuousAutoDjEnabled, continuousAutoDjInFlightRef, continuousAutoDjSettings, currentCdPlaybackDriveId, currentLibraryTrackQueryKey, currentRadioStation, currentTrack, debouncedAdvancedTrackSearch, debouncedSearch, deletePrompt, detailTrack, deviceSyncPreview, dismissQuickStart, duplicateActionResult, duplicateReview, endLibraryLoad, ensureLatestCdPlaybackRequest, extendContinuousAutoDj, externalTrackRequest, externalTrackRequestIdRef, fileManagementFocusToolId, fileManagementScopeIds, filenameTagPreview, fileOrganizationPreview, fileOrganizationReport, findTracksByIds, folderPath, FolderWatchRefreshTimerRef, folderWatchStatus, handleAcknowledgeFolderWatchNotifications, handleAcoustIdApiKeyChange, handleAddToQueue, handleAddTracksToPlaylist, handleAdvancedTagLibraryChanged, handleAnalyzeAudio, handleAnalyzeTracks, handleApplyAutoTag, handleApplyFilenameTags, handleApplyFileOrganization, handleApplyFolderWatch, handleApplyMetadataCsv, handleApplyTagRegex, handleAutoWriteFetchedLyricsSidecars, handleAvoidAutoDj, handleBackupDatabase, handleBrowseAudioConversionTarget, handleBrowseCdRipTarget, handleBrowseFolder, handleBulkMetadata, handleBulkRating, handleCancelAudioAnalysis, handleCancelAudioConversion, handleCdAutoLookupMetadata, handleChooseMusicFolderAndScan, handleClearArtistCache, handleClearIgnoredDuplicateGroups, handleClearLibraryCaches, handleClearPlaybackQueue, handleCoffeeClick, handleCommitExternalTrackRequest, handleContinuousAutoDjChange, handleCopySupportBundlePath, handleCreatePlaylist, handleCreateSupportBundle, handleCycleTheme, handleDeleteAutoDjAvoidRule, handleDeleteInboxAutoReviewRule, handleDeletePlaylist, handleDeleteRecommendationProfile, handleDeleteTrack, handleDeleteTracks, handleDeviceSync, handleDuplicateAction, handleExportFileOrganizationReport, handleExportMetadataCsv, handleExportMetadataCsvReport, handleExportPlaylist, handleExportTracks, handleFetchLyrics, handleIgnoreDuplicateGroup, handleImportPlaylist, handleInstallAudioConversionFfmpeg, handleInstallClap, handleLastFmApiCredentialsChange, handleLibraryAutoTagTracks, handleLibraryClapGenreTagTracks, handleLibraryFingerprintTagTracks, handleLibraryVolumeTagTracks, handleLoadDuplicateReview, handleMovePlaybackQueueTrack, handleMovePlaylistTrack, handleOpenBackendLog, handleOpenCurrentAlbumFromPlayer, handleOpenCurrentArtistFromPlayer, handleOpenCurrentTrackFromPlayer, handleOpenDetachedMiniPlayer, handleOpenExternalUrl, handleOpenFileManagementForTracks, handleOpenLyricsViewFromPlayer, handleOpenOptionalDependencies, handleOpenQueueViewFromPlayer, handleOpenSourceFolder, handlePauseAudioAnalysis, handlePlayAlbum, handlePlayArtist, handlePlayCdPreviewTrack, handlePlayNext, handlePlayRadioStation, handlePlayTrack, handlePreviewAudioConversion, handlePreviewAutoTag, handlePreviewFilenameTags, handlePreviewFileOrganization, handlePreviewMetadataCsv, handlePreviewTagRegex, handleQuickAutoDj, handleRating, handleReadReportFile, handleRefreshFolderWatch, handleRemoveLibrarySource, handleRemovePlaybackQueueTrack, handleRemoveTrackFromPlaylist, handleRemoveTracksFromPlaylist, handleReorderPlaybackQueueTrack, handleResetLocalData, handleRestartBackend, handleRestoreBulkUndoBatch, handleRestoreBulkUndoEntry, handleRestorePlaybackQueue, handleResumeAudioAnalysis, handleRevealTrack, handleRevealTracksByIds, handleReviewInboxTracks, handleRunAcousticFingerprintPass, handleSaveAudioConversionSetup, handleSaveChromaprintSetup, handleSaveClapConfig, handleSaveInboxAutoReviewRule, handleSaveLyrics, handleSavePlaybackQueue, handleSaveRecommendationProfile, handleSaveTrackMetadata, handleScan, handleSelectAlbum, handleSelectArtist, handleSelectPlaylist, handleSetDefaultRecommendationProfile, handleShuffleTracks, handleStartAudioConversion, handleStartFolderWatch, handleStopFolderWatch, handleStopRadioStation, handleSyncFileMetadata, handleTrackEnded, handleTrackSkipped, handleUndoAction, handleUndoRecentChange, handleUpdateInboxNote, handleUseSuggestedFolder, handleWriteRatingsToFiles, hasAdvancedLibraryFilters, hasAnalysisIssue, hasLoadedInitialLibrary, hasMoreTracks, hideFilePaths, historyEvents, historyStats, importPlaylistPath, inbox, isArtistLoading, isAudioAnalyzing, isCdPlaybackActive, isClapInstalling, isClapStatusLoading, isLibraryLoading, isLyricsLoading, isScanning, lastFolderWatchNotificationIdRef, lastSessionRestoreAttemptedRef, lastSessionRestoreFinishedRef, lastSessionWriteKeyRef, libraryAlbumScrollTop, libraryArtistScrollTop, libraryCacheQueryKeyRef, libraryCompletionScrollTop, libraryFolders, libraryHealth, libraryLoadingCountRef, libraryPageRequestsInFlightRef, libraryPlaylistScrollTop, libraryRequestId, libraryScrollTop, librarySort, libraryStats, libraryTotal, libraryView, libraryVisibleColumns, loadAlbums, loadAnalysisClapReadiness, loadArtistInfo, loadArtists, loadAudioConversionSetup, loadAutoDjAvoidRules, loadBulkUndoLog, loadCdRipSetup, loadChromaprintSetup, loadClapCoverage, loadClapStatus, loadFolderWatchStatus, loadHistory, loadInbox, loadLibraryStats, loadMoreTracks, loadPlaylists, loadPriorityLibraryTracks, loadRecommendationHistory, loadRecommendationProfiles, loadSettings, loadStartupDiagnostics, loadTracksPage, loadTrackWindow, lyrics, mergeTrackPage, metadataCsvExport, metadataCsvImportPreview, metadataCsvImportReport, metadataEditInitialField, metadataEditTrack, newPlaylistName, openApiKeysSettings, openAppContextMenu, openMetadataEditor, playbackMode, playbackQueue, playbackTime, playlists, priorityLibraryLoadStartedRef, priorityLibraryQueryKeyRef, queue, queueHistory, queueUpcomingPlaybackTracks, quickStartDismissed, radioPlaybackRequestId, recommendationDrift, recommendationHistory, recommendationProfiles, recordTrackExitQuiet, recycleFilesWithDesktop, refreshAnalyzedState, refreshCdPreviewTrack, refreshTracks, rememberQueueSnapshot, rememberRecommendationFeedback, removeTrackEverywhere, replaceTrackEverywhere, replaceUpcomingPlaybackQueue, reportFile, requestDeleteTracks, resolveTracksForAction, restoredPlaybackPosition, restoreLastPlaybackSession, scanProgress, scanResult, scheduleFolderWatchRefresh, search, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, setAcousticFingerprintResult, setActivePage, setAdvancedTrackSearch, setAlbums, setAppContextMenu, setArtistInfo, setArtists, setArtistTracks, setAudioAnalysisCoverage, setAudioAnalysisEligibleTrackTotal, setAudioAnalysisJobId, setAudioAnalysisLimit, setAudioAnalysisOnlyMissing, setAudioAnalysisOverwrite, setAudioAnalysisProgress, setAudioConversionInstallProgress, setAudioConversionJobId, setAudioConversionPreview, setAudioConversionProgress, setAudioConversionSetup, setAutoDjAvoidRules, setAutoPlayOnTrackChange, setAutoTagPreview, setAutoWriteFetchedLyricsSidecars, setBackendCheckedAt, setBackendLog, setBackendMessage, setBackendStatus, setBulkUndoBatches, setBulkUndoLog, setBulkUndoRestoreResult, setCdAutoLookupMetadata, setCdRipSetup, setChromaprintSetup, setClapCacheDir, setClapInstallProgress, setClapMaxDuration, setClapModelId, setClapStatus, setClapStatusLoadMessage, setClapStatusLoadPercent, setCoffeeAnimating, setContinuousAutoDjBusy, setContinuousAutoDjEnabled, setContinuousAutoDjSettings, setCurrentRadioStation, setCurrentTrack, setDebouncedAdvancedTrackSearch, setDebouncedSearch, setDeletePrompt, setDetailTrack, setDeviceSyncPreview, setDuplicateActionResult, setDuplicateReview, setExternalTrackRequest, setFileManagementFocusToolId, setFileManagementScopeIds, setFilenameTagPreview, setFileOrganizationPreview, setFileOrganizationReport, setFolderPath, setFolderWatchStatus, setHasLoadedInitialLibrary, setHasMoreTracks, setHideFilePaths, setHistoryEvents, setHistoryStats, setImportPlaylistPath, setInbox, setIsArtistLoading, setIsAudioAnalyzing, setIsClapInstalling, setIsClapStatusLoading, setIsLibraryLoading, setIsLyricsLoading, setIsScanning, setLibraryAlbumScrollTop, setLibraryArtistScrollTop, setLibraryCompletionScrollTop, setLibraryFolders, setLibraryHealth, setLibraryPlaylistScrollTop, setLibraryScrollTop, setLibrarySort, setLibraryStats, setLibraryTotal, setLibraryView, setLibraryVisibleColumns, setLyrics, setMetadataCsvExport, setMetadataCsvImportPreview, setMetadataCsvImportReport, setMetadataEditInitialField, setMetadataEditTrack, setNewPlaylistName, setPlaybackMode, setPlaybackQueue, setPlaybackTime, setPlaylists, setQueue, setQueueHistory, setQuickStartDismissed, setRadioPlaybackRequestId, setRecommendationDrift, setRecommendationHistory, setRecommendationProfiles, setReportFile, setRestoredPlaybackPosition, setScanProgress, setScanResult, setSearch, setSelectedAlbumId, setSelectedAlbumTracks, setSelectedArtistName, setSelectedArtistTracks, setSelectedPlaylistId, setSelectedPlaylistTracks, setSettings, setSettingsFocusSection, setStartupDiagnostics, setStatus, setSupportBundlePath, setTagRegexPreview, setTargetPlaylistId, settings, settingsFocusSection, setTrackIndexCache, setTracks, setUiPreferences, setUndoAction, setWriteRatingsToFiles, showCdPage, showUndoAction, startupBackgroundHydratedRef, startupDiagnostics, startupLibrarySnapshot, status, supportBundlePath, tagRegexPreview, targetPlaylistId, trackIndexCache, trackIndexCacheRef, tracks, uiPreferences, undoAction, undoTimerRef, updateCachedTracks, validateMusicFoldersWithDesktop, waitForBackendStartup, writeRatingsToFiles };
  useAppControllerEffects(appControllerReturnModel);
  return buildAppControllerReturn(appControllerReturnModel);
}

export type AppController = ReturnType<typeof useAppController>;
