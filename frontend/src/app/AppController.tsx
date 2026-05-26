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

export function useAppController() {
  useRangeWheelControls();
  const [startupLibrarySnapshot] = useState<StartupLibrarySnapshot | null>(readStartupLibrarySnapshot);
  const [activePage, setActivePage] = useState<Page>(() => readUiPreferences().startupPage);
  const [tracks, setTracks] = useState<Track[]>(() => startupLibrarySnapshot?.tracks ?? []);
  const [trackIndexCache, setTrackIndexCache] = useState<Map<number, Track>>(() => indexedStartupTracks(startupLibrarySnapshot));
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [autoDjAvoidRules, setAutoDjAvoidRules] = useState<AutoDjAvoidRule[]>([]);
  const [recommendationProfiles, setRecommendationProfiles] = useState<RecommendationProfile[]>([]);
  const [recommendationDrift, setRecommendationDrift] = useState<RecommendationDrift>(emptyRecommendationDrift);
  const [recommendationHistory, setRecommendationHistory] = useState<RecommendationRun[]>([]);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [settingsFocusSection, setSettingsFocusSection] = useState<string | null>(null);
  const [writeRatingsToFiles, setWriteRatingsToFiles] = useState(false);
  const [autoWriteFetchedLyricsSidecars, setAutoWriteFetchedLyricsSidecars] = useState(false);
  const [cdAutoLookupMetadata, setCdAutoLookupMetadata] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("starting");
  const [backendMessage, setBackendMessage] = useState("Starting the local Python backend.");
  const [backendCheckedAt, setBackendCheckedAt] = useState<string | null>(null);
  const [startupDiagnostics, setStartupDiagnostics] = useState<StartupDiagnosticsResponse | null>(null);
  const [backendLog, setBackendLog] = useState<LogTailResponse | null>(null);
  const [supportBundlePath, setSupportBundlePath] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [uiPreferences, setUiPreferences] = useState<UiPreferences>(readUiPreferences);
  const [continuousAutoDjEnabled, setContinuousAutoDjEnabled] = useState(false);
  const [continuousAutoDjBusy, setContinuousAutoDjBusy] = useState(false);
  const [continuousAutoDjSettings, setContinuousAutoDjSettings] = useState<AutoDjSettings>(defaultAutoDj);
  const [quickStartDismissed, setQuickStartDismissed] = useState(readQuickStartDismissed);
  const [coffeeAnimating, setCoffeeAnimating] = useState(false);
  const [detailTrack, setDetailTrack] = useState<Track | null>(null);
  const [metadataEditTrack, setMetadataEditTrack] = useState<Track | null>(null);
  const [metadataEditInitialField, setMetadataEditInitialField] = useState<EditableMetadataKey | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<DeleteTrackPrompt | null>(null);
  const [appContextMenu, setAppContextMenu] = useState<AppContextMenu | null>(null);
  const [fileManagementFocusToolId, setFileManagementFocusToolId] = useState<string | null>(null);
  const [fileManagementScopeIds, setFileManagementScopeIds] = useState<number[] | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentRadioStation, setCurrentRadioStation] = useState<RadioStation | null>(null);
  const [radioPlaybackRequestId, setRadioPlaybackRequestId] = useState(0);
  const [autoPlayOnTrackChange, setAutoPlayOnTrackChange] = useState(false);
  const [externalTrackRequest, setExternalTrackRequest] = useState<{
    id: number;
    track: Track;
    queue: Track[];
  } | null>(null);
  const externalTrackRequestIdRef = useRef(0);
  const cdPlaybackPrepareRequestIdRef = useRef(0);
  const cdPlaybackPrepareChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [queueHistory, setQueueHistory] = useState<Track[][]>([]);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("normal");
  const continuousAutoDjInFlightRef = useRef(false);
  const [libraryTotal, setLibraryTotal] = useState(() => startupLibrarySnapshot?.total ?? 0);
  const [hasMoreTracks, setHasMoreTracks] = useState(() =>
    startupLibrarySnapshot ? startupLibrarySnapshot.tracks.length < startupLibrarySnapshot.total : true,
  );
  const [isLibraryLoading, setIsLibraryLoading] = useState(() => !startupLibrarySnapshot);
  const [hasLoadedInitialLibrary, setHasLoadedInitialLibrary] = useState(() => Boolean(startupLibrarySnapshot));
  const [librarySort, setLibrarySort] = useState<SortState>(DEFAULT_LIBRARY_SORT);
  const [libraryView, setLibraryView] = useState<LibraryView>("tracks");
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [libraryStats, setLibraryStats] = useState<LibraryStatsResponse | null>(null);
  const [libraryHealth, setLibraryHealth] = useState<LibraryHealthResponse | null>(null);
  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [historyEvents, setHistoryEvents] = useState<PlayEventEntry[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStatsResponse | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [selectedAlbumTracks, setSelectedAlbumTracks] = useState<Track[]>([]);
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null);
  const [selectedArtistTracks, setSelectedArtistTracks] = useState<Track[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<Track[]>([]);
  const [targetPlaylistId, setTargetPlaylistId] = useState<number | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [importPlaylistPath, setImportPlaylistPath] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [advancedTrackSearch, setAdvancedTrackSearch] = useState<AdvancedTrackSearchFilters>({});
  const [debouncedAdvancedTrackSearch, setDebouncedAdvancedTrackSearch] = useState<AdvancedTrackSearchFilters>({});
  const [lyrics, setLyrics] = useState<LyricsResponse | null>(null);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [artistInfo, setArtistInfo] = useState<ArtistInfoResponse | null>(null);
  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [isArtistLoading, setIsArtistLoading] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [restoredPlaybackPosition, setRestoredPlaybackPosition] = useState<number | null>(null);
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
  const [libraryScrollTop, setLibraryScrollTop] = useState(0);
  const [libraryArtistScrollTop, setLibraryArtistScrollTop] = useState(0);
  const [libraryAlbumScrollTop, setLibraryAlbumScrollTop] = useState(0);
  const [libraryCompletionScrollTop, setLibraryCompletionScrollTop] = useState(0);
  const [libraryPlaylistScrollTop, setLibraryPlaylistScrollTop] = useState(0);
  const trackIndexCacheRef = useRef(trackIndexCache);
  const libraryRequestId = useRef(0);
  const libraryLoadingCountRef = useRef(0);
  const libraryPageRequestsInFlightRef = useRef<Set<string>>(new Set());
  const undoTimerRef = useRef<number | null>(null);
  const lastSessionWriteKeyRef = useRef<string | null>(null);
  const lastSessionRestoreFinishedRef = useRef(false);
  const lastSessionRestoreAttemptedRef = useRef(false);
  const startupBackgroundHydratedRef = useRef(false);
  const priorityLibraryLoadStartedRef = useRef(false);
  const priorityLibraryQueryKeyRef = useRef<string | null>(null);
  const libraryCacheQueryKeyRef = useRef<string | null>(startupLibrarySnapshot ? defaultLibraryTrackQueryKey() : null);
  const lastFolderWatchNotificationIdRef = useRef<string | null>(null);
  const FolderWatchRefreshTimerRef = useRef<number | null>(null);
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

  function dismissQuickStart() {
    setQuickStartDismissed(true);
    writeQuickStartDismissed();
  }

  function handleCoffeeClick() {
    setCoffeeAnimating(false);
    window.requestAnimationFrame(() => setCoffeeAnimating(true));
    window.setTimeout(() => setCoffeeAnimating(false), 700);
  }

  function handleCycleTheme() {
    setUiPreferences((current) => {
      const currentIndex = Math.max(0, themeOrder.indexOf(current.themeAccent));
      const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
      setStatus(`Theme: ${themeAccentLabels[nextTheme]}`);
      return { ...current, themeAccent: nextTheme };
    });
  }

  function openAppContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (
      event.isDefaultPrevented() ||
      target?.closest("input, textarea, select, [contenteditable='true'], [data-allow-desktop-context='true']")
    ) {
      return;
    }
    event.preventDefault();
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: APP_CONTEXT_MENU_WIDTH,
      menuHeight: APP_CONTEXT_MENU_HEIGHT,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setAppContextMenu({ x: placement.x, y: placement.y });
  }

  function rememberQueueSnapshot(queueSnapshot = playbackQueue) {
    if (!queueSnapshot.length) {
      return;
    }
    setQueueHistory((current) => {
      const duplicateLatest =
        current[0]?.length === queueSnapshot.length &&
        current[0].every((track, index) => track.id === queueSnapshot[index]?.id);
      if (duplicateLatest) {
        return current;
      }
      return [queueSnapshot, ...current].slice(0, QUEUE_HISTORY_LIMIT);
    });
  }

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

  async function loadStartupDiagnostics(showToast = false) {
    try {
      const response = await fetchStartupDiagnostics();
      setStartupDiagnostics(response);
      if (showToast) {
        setStatus(response.ok ? "Startup self-check passed" : "Startup self-check complete; review notes");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not run startup self-check");
    }
  }

  async function handleOpenBackendLog() {
    try {
      const response = await fetchBackendLog();
      setBackendLog(response);
      if (!response.exists) {
        setStatus("Backend log has not been created yet");
        return;
      }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("reveal_in_file_explorer", { path: response.path });
      } catch {
        // Browser mode cannot reveal files; the Settings panel still shows the tail.
      }
      setStatus(`Backend log loaded from ${response.path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open backend log");
    }
  }

  async function checkBackendStatus(showToast = false) {
    try {
      const response = await fetchBackendHealth();
      setBackendStatus("ok");
      setBackendMessage(response.status === "ok" ? "Backend is responding normally." : `Backend responded: ${response.status}`);
      setBackendCheckedAt(new Date().toLocaleTimeString());
      if (showToast) {
        setStatus("Backend is responding");
      }
    } catch (error) {
      setBackendStatus("down");
      setBackendMessage(error instanceof Error ? error.message : "Backend is not reachable");
      setBackendCheckedAt(new Date().toLocaleTimeString());
      if (showToast) {
        setStatus("Backend is not reachable");
      }
    }
  }

  async function restoreLastPlaybackSession() {
    if (lastSessionRestoreAttemptedRef.current) {
      return;
    }
    lastSessionRestoreAttemptedRef.current = true;
    try {
      const raw = window.localStorage.getItem(storageKeys.lastSession) ?? window.localStorage.getItem(legacyStorageKeys.lastSession);
      if (raw) {
        const session = JSON.parse(raw) as StoredPlaybackSession;
        const ids = Array.from(new Set([...(session.queueIds ?? []), session.currentTrackId].filter(Boolean) as number[]));
        if (ids.length) {
          try {
            const restored = await fetchTracksBatch(ids.slice(0, 200));
            const byId = new Map(restored.tracks.map((track) => [track.id, track]));
            const queueItems = (session.queueIds ?? []).map((id) => byId.get(id)).filter((track): track is Track => Boolean(track));
            const restoredCurrent = session.currentTrackId ? byId.get(session.currentTrackId) ?? null : null;
            if (queueItems.length) {
              setPlaybackQueue(queueItems);
            }
            if (restoredCurrent) {
              setCurrentTrack(restoredCurrent);
              setRestoredPlaybackPosition(
                normalizePlaybackResumePosition(session.positionSeconds, restoredCurrent.duration_seconds),
              );
            }
            return;
          } catch {
            window.localStorage.removeItem(storageKeys.lastSession);
            window.localStorage.removeItem(legacyStorageKeys.lastSession);
          }
        }
      }
    } catch {
      // Last-session restore is best effort only.
    } finally {
      lastSessionRestoreFinishedRef.current = true;
    }
  }

  async function waitForBackendStartup() {
    const deadline = Date.now() + BACKEND_STARTUP_GRACE_MS;
    let lastErrorMessage = "Backend is not reachable";
    setBackendStatus("starting");
    setBackendMessage("Starting the local Python backend.");

    while (Date.now() < deadline) {
      try {
        const response = await fetchBackendHealth();
        setBackendMessage("Loading your library.");
        void restoreLastPlaybackSession();
        await loadPriorityLibraryTracks();
        setBackendStatus("ok");
        setBackendMessage(response.status === "ok" ? "Backend is responding normally." : `Backend responded: ${response.status}`);
        setBackendCheckedAt(new Date().toLocaleTimeString());
        return;
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : "Backend is not reachable";
        setBackendMessage("Starting the local Python backend.");
        await new Promise((resolve) => window.setTimeout(resolve, BACKEND_STARTUP_POLL_MS));
      }
    }

    setBackendStatus("down");
    setBackendMessage(lastErrorMessage);
    setBackendCheckedAt(new Date().toLocaleTimeString());
  }

  async function handleRestartBackend() {
    setBackendStatus("restarting");
    setBackendMessage("Restarting the bundled backend service.");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const message = await invoke<string>("backend_restart");
      setStatus(message);
      window.setTimeout(() => {
        void checkBackendStatus(false);
      }, 900);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Backend restart is only available in the packaged desktop app";
      setBackendStatus("down");
      setBackendMessage(message);
      setBackendCheckedAt(new Date().toLocaleTimeString());
      setStatus(message);
    }
  }

  async function handleOpenDetachedMiniPlayer() {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const { Window } = await import("@tauri-apps/api/window");
      const mainWindow = await Window.getByLabel("main");
      const existing = await WebviewWindow.getByLabel("mini-player");
      if (existing) {
        await mainWindow?.setSkipTaskbar(true);
        await mainWindow?.hide();
        await existing.setFocus();
        return;
      }
      const miniWindow = new WebviewWindow("mini-player", {
        title: "FLAC Cafe Mini Player",
        url: "/index.html?miniPlayer=1",
        width: 640,
        height: 138,
        minWidth: 420,
        minHeight: 118,
        resizable: true,
        decorations: true,
      });
      miniWindow.once("tauri://created", () => {
        void mainWindow?.setSkipTaskbar(true);
        void mainWindow?.hide();
      });
      miniWindow.once("tauri://destroyed", () => {
        void mainWindow?.setSkipTaskbar(false);
        void mainWindow?.show();
        void mainWindow?.setFocus();
      });
      miniWindow.once("tauri://error", (event) => {
        void mainWindow?.setSkipTaskbar(false);
        void mainWindow?.show();
        setStatus(`Could not open mini player: ${String(event.payload)}`);
      });
      setStatus("Mini player is now the active window");
    } catch {
      setStatus("Detached mini player is available in the Tauri desktop app.");
    }
  }

  function handleOpenLyricsViewFromPlayer() {
    setUiPreferences((current) => ({
      ...current,
      nowPlayingLayout: "lyrics",
      nowPlayingShowLyrics: true,
      nowPlayingShowQueue: false,
      nowPlayingAutoScrollLyrics: true,
    }));
    setActivePage("nowPlaying");
  }

  function handleOpenQueueViewFromPlayer() {
    setUiPreferences((current) => ({
      ...current,
      nowPlayingLayout: "queue",
      nowPlayingShowQueue: true,
      nowPlayingShowLyrics: true,
    }));
    setActivePage("nowPlaying");
  }

  function openMetadataEditor(track: Track, field: EditableMetadataKey | null = null) {
    setMetadataEditTrack(track);
    setMetadataEditInitialField(field);
  }

  async function handleWriteRatingsToFiles(value: boolean) {
    const previous = writeRatingsToFiles;
    setWriteRatingsToFiles(value);
    try {
      const response = await updateSettings({ write_ratings_to_files: value });
      setSettings(response);
      setWriteRatingsToFiles(response.write_ratings_to_files);
      setStatus(value ? "Ratings and metadata will be written to audio files" : "Ratings and metadata will stay in the database");
    } catch (error) {
      setWriteRatingsToFiles(previous);
      setStatus(error instanceof Error ? error.message : "Could not update file-write setting");
    }
  }

  async function handleAutoWriteFetchedLyricsSidecars(value: boolean) {
    const previous = autoWriteFetchedLyricsSidecars;
    setAutoWriteFetchedLyricsSidecars(value);
    try {
      const response = await updateSettings({ auto_write_fetched_lyrics_sidecars: value });
      setSettings(response);
      setAutoWriteFetchedLyricsSidecars(response.auto_write_fetched_lyrics_sidecars);
      setStatus(value ? "Fetched lyrics will be cached as app lyric sidecars" : "Fetched lyrics sidecar cache is off");
    } catch (error) {
      setAutoWriteFetchedLyricsSidecars(previous);
      setStatus(error instanceof Error ? error.message : "Could not update lyrics cache setting");
    }
  }

  async function handleCdAutoLookupMetadata(value: boolean) {
    const previous = cdAutoLookupMetadata;
    setCdAutoLookupMetadata(value);
    try {
      const response = await updateSettings({ cd_auto_lookup_metadata: value });
      setSettings(response);
      setCdAutoLookupMetadata(response.cd_auto_lookup_metadata);
      setStatus(value ? "CD metadata auto-lookup is on" : "CD metadata auto-lookup is off");
    } catch (error) {
      setCdAutoLookupMetadata(previous);
      setStatus(error instanceof Error ? error.message : "Could not update CD metadata lookup setting");
    }
  }

  async function handleAcoustIdApiKeyChange(apiKey: string | null) {
    try {
      const response = await updateSettings(
        apiKey === null
          ? { clear_acoustid_api_key: true }
          : { acoustid_api_key: apiKey },
      );
      setSettings(response);
      setStatus(response.acoustid_api_key_configured ? "AcoustID lookup is enabled for Auto-Tag" : "AcoustID lookup is disabled");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update AcoustID API key");
    }
  }

  async function handleLastFmApiCredentialsChange(apiKey: string | null, apiSecret: string | null) {
    try {
      const response = await updateSettings(
        apiKey === null && apiSecret === null
          ? { clear_lastfm_api_credentials: true }
          : { lastfm_api_key: apiKey, lastfm_api_secret: apiSecret },
      );
      setSettings(response);
      setStatus(response.lastfm_api_credentials_configured ? "Last.fm API credentials saved" : "Last.fm API credentials cleared");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update Last.fm API credentials");
    }
  }

  function openApiKeysSettings() {
    setSettingsFocusSection("apiKeys");
    setActivePage("settings");
    setStatus("API keys live in Settings now.");
  }

  async function handleRating(trackId: number, rating: number | null) {
    const previous = tracks;
    const previousCache = new Map(trackIndexCacheRef.current);
    updateCachedTracks((track) => (track.id === trackId ? { ...track, rating } : track));
    try {
      const updated = await updateTrackRating(trackId, rating);
      replaceTrackEverywhere(updated);
      setStatus("Rating saved");
    } catch (error) {
      setTracks(previous);
      commitTrackIndexCache(previousCache);
      setStatus(error instanceof Error ? error.message : "Rating failed");
    }
  }

  async function handleBulkRating(trackIds: number[], rating: number | null) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    if (writeRatingsToFiles) {
      const unsupported = findTracksByIds(uniqueIds).filter((track) => !supportsFileTagWriting(track.path));
      if (unsupported.length > 0) {
        const proceed = window.confirm(
          `${unsupported.length} selected track${unsupported.length === 1 ? "" : "s"} use a format FLAC Cafe may not write safely yet. Continue? Unsupported file writes will fail before SQLite is changed for those tracks.`,
        );
        if (!proceed) {
          return;
        }
      }
    }
    try {
      const updatedTracks = await Promise.all(uniqueIds.map((trackId) => updateTrackRating(trackId, rating)));
      for (const updated of updatedTracks) {
        replaceTrackEverywhere(updated);
      }
      setStatus(`Updated ${updatedTracks.length} rating${updatedTracks.length === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bulk rating failed");
      await refreshTracks();
    }
  }

  function replaceTrackEverywhere(updated: Track) {
    const replace = (track: Track) => (track.id === updated.id ? updated : track);
    updateCachedTracks(replace);
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

  async function handleDeleteTrack(trackId: number, deleteFile: boolean) {
    const snapshot = await resolveTracksForAction([trackId]);
    try {
      const Recycle = deleteFile && snapshot.length === 1 ? await recycleFilesWithDesktop(snapshot) : null;
      const response = await deleteTrack(trackId, deleteFile && Recycle === null);
      removeTrackEverywhere(trackId);
      await Promise.all([loadAlbums(), loadArtists(), loadPlaylists(), loadLibraryStats(), loadInbox(), loadClapCoverage()]);
      if (Recycle?.recycled) {
        setStatus("Deleted file to Recycle Bin and removed track from library");
      } else if (response.deleted_file) {
        setStatus("Deleted file to Recycle Bin and removed track from library");
      } else if (response.file_missing || Recycle?.missing) {
        setStatus("Removed missing track from library");
      } else {
        if (!deleteFile && snapshot.length > 0) {
          showUndoAction({
            type: "library-remove",
            label: display(snapshot[0].title, "track"),
            tracks: snapshot,
          });
        }
        setStatus("Removed track from library");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove track");
    }
  }

  async function handleDeleteTracks(trackIds: number[], deleteFile: boolean) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    const snapshot = await resolveTracksForAction(uniqueIds);
    try {
      const Recycle = deleteFile && snapshot.length === uniqueIds.length ? await recycleFilesWithDesktop(snapshot) : null;
      const response = await deleteTracks(uniqueIds, deleteFile && Recycle === null);
      for (const trackId of response.removed_track_ids) {
        removeTrackEverywhere(trackId);
      }
      await Promise.all([loadAlbums(), loadArtists(), loadPlaylists(), loadLibraryStats(), loadInbox(), loadClapCoverage()]);
      if (!deleteFile && snapshot.length > 0) {
        showUndoAction({
          type: "library-remove",
          label: `${response.removed_count} track${response.removed_count === 1 ? "" : "s"}`,
          tracks: snapshot,
        });
      }
      const deletedFileCount = response.deleted_files + (Recycle?.recycled ?? 0);
      const skipped = response.missing_track_ids.length + response.errors.length + (Recycle?.missing ?? 0);
      const warning = skipped ? ` (${skipped.toLocaleString()} skipped)` : "";
      setStatus(
        deletedFileCount > 0
          ? `Deleted ${deletedFileCount.toLocaleString()} files to Recycle Bin and removed ${response.removed_count.toLocaleString()} tracks${warning}`
          : `Removed ${response.removed_count.toLocaleString()} tracks from library${warning}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove selected tracks");
      await refreshTracks();
    }
  }

  function requestDeleteTracks(trackIds: number[], title: string, allowFileDelete = true) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    const remembered = readRememberedDeleteChoice();
    if (remembered) {
      const deleteFile = allowFileDelete && remembered === "file";
      if (uniqueIds.length === 1) {
        void handleDeleteTrack(uniqueIds[0], deleteFile);
      } else {
        void handleDeleteTracks(uniqueIds, deleteFile);
      }
      return;
    }
    setDeletePrompt({ trackIds: uniqueIds, title, allowFileDelete });
  }

  async function confirmDeleteTracks(deleteFile: boolean, remember: boolean) {
    if (!deletePrompt) {
      return;
    }
    const prompt = deletePrompt;
    setDeletePrompt(null);
    if (remember) {
      writeRememberedDeleteChoice(deleteFile ? "file" : "library");
    }
    if (prompt.trackIds.length === 1) {
      await handleDeleteTrack(prompt.trackIds[0], deleteFile);
    } else {
      await handleDeleteTracks(prompt.trackIds, deleteFile);
    }
  }

  async function handleSaveTrackMetadata(trackId: number, metadata: TrackMetadataUpdate) {
    try {
      const updated = await updateTrackMetadata(trackId, metadata);
      replaceTrackEverywhere(updated);
      await Promise.all([loadAlbums(), loadArtists(), loadLibraryStats()]);
      setMetadataEditTrack(null);
      setMetadataEditInitialField(null);
      setStatus((metadata.write_to_file ?? writeRatingsToFiles) ? "Metadata saved to library and file" : "Metadata saved to library");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save metadata");
    }
  }

  async function handleBulkMetadata(trackIds: number[], metadata: TrackMetadataUpdate) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length || Object.keys(metadata).length === 0) {
      return;
    }
    try {
      const updatedTracks = await Promise.all(uniqueIds.map((trackId) => updateTrackMetadata(trackId, metadata)));
      for (const updated of updatedTracks) {
        replaceTrackEverywhere(updated);
      }
      await Promise.all([loadAlbums(), loadArtists(), loadLibraryStats()]);
      setStatus(`Updated metadata for ${updatedTracks.length} track${updatedTracks.length === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bulk metadata update failed");
      await refreshTracks();
    }
  }

  async function handleSelectAlbum(albumId: number) {
    setSelectedAlbumId(albumId);
    try {
      setSelectedAlbumTracks(await fetchAlbumTracks(albumId));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load album");
    }
  }

  async function handleSelectArtist(artistName: string) {
    setSelectedArtistName(artistName);
    try {
      setSelectedArtistTracks(await fetchArtistLocalTracks(artistName, 20000));
    } catch (error) {
      try {
        const fallbackTracks = await fetchTracks("");
        const artistKey = artistName.toLowerCase();
        setSelectedArtistTracks(
          fallbackTracks
            .filter((track) => (primaryArtistName(track.artist) || display(track.artist, "")).toLowerCase() === artistKey)
            .sort((left, right) => {
              const albumDelta = display(left.album).localeCompare(display(right.album));
              if (albumDelta !== 0) {
                return albumDelta;
              }
              return (left.disc_number ?? 0) - (right.disc_number ?? 0) || (left.track_number ?? 0) - (right.track_number ?? 0);
            }),
        );
      } catch {
        setStatus(error instanceof Error ? error.message : "Could not load artist");
      }
    }
  }

  async function handlePlayAlbum(albumId: number) {
    setSelectedAlbumId(albumId);
    try {
      const albumTracks = await fetchAlbumTracks(albumId);
      setSelectedAlbumTracks(albumTracks);
      if (albumTracks.length === 0) {
        setStatus("No local tracks found for this album");
        return;
      }
      handlePlayTrack(albumTracks[0], albumTracks);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not play album");
    }
  }

  async function handlePlayArtist(artistName: string) {
    setSelectedArtistName(artistName);
    try {
      const artistTracks = await fetchArtistLocalTracks(artistName, 20000);
      setSelectedArtistTracks(artistTracks);
      if (artistTracks.length === 0) {
        setStatus("No local tracks found for this artist");
        return;
      }
      handlePlayTrack(artistTracks[0], artistTracks);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not play artist");
    }
  }

  async function handleSelectPlaylist(playlistId: number) {
    setSelectedPlaylistId(playlistId);
    try {
      setSelectedPlaylistTracks(await fetchPlaylistTracks(playlistId));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load playlist");
    }
  }

  async function handleCreatePlaylist() {
    const name = newPlaylistName.trim();
    if (!name) {
      setStatus("Enter a playlist name");
      return;
    }
    try {
      const created = await createPlaylist(name);
      setNewPlaylistName("");
      await loadPlaylists();
      setSelectedPlaylistId(created.id);
      setTargetPlaylistId(created.id);
      setSelectedPlaylistTracks([]);
      setStatus(`Created playlist ${created.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create playlist");
    }
  }

  async function handleDeletePlaylist(playlistId: number) {
    try {
      const response = await deletePlaylist(playlistId);
      setPlaylists(response);
      const next = response[0]?.id ?? null;
      setSelectedPlaylistId(next);
      setTargetPlaylistId((current) => (current === playlistId ? next : current));
      setSelectedPlaylistTracks([]);
      if (next) {
        await handleSelectPlaylist(next);
      }
      setStatus("Playlist deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete playlist");
    }
  }

  async function handleAddTracksToPlaylist(trackIds: number[], playlistId = targetPlaylistId) {
    if (!playlistId) {
      setStatus("Choose a target playlist first");
      return;
    }
    const playlistName = playlists.find((playlist) => playlist.id === playlistId)?.name ?? "playlist";
    try {
      const updatedTracks = await addTracksToPlaylist(playlistId, trackIds);
      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistTracks(updatedTracks);
      }
      setTargetPlaylistId(playlistId);
      await loadPlaylists();
      setStatus(`Added ${trackIds.length} track${trackIds.length === 1 ? "" : "s"} to ${playlistName}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add to playlist");
    }
  }

  async function handleRemoveTrackFromPlaylist(trackId: number) {
    if (!selectedPlaylistId) {
      return;
    }
    try {
      setSelectedPlaylistTracks(await removeTrackFromPlaylist(selectedPlaylistId, trackId));
      await loadPlaylists();
      const track = findTracksByIds([trackId])[0];
      showUndoAction({
        type: "playlist-remove",
        label: display(track?.title, "track"),
        playlistId: selectedPlaylistId,
        trackIds: [trackId],
      });
      setStatus("Removed track from playlist");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove track");
    }
  }

  async function handleRemoveTracksFromPlaylist(trackIds: number[]) {
    if (!selectedPlaylistId) {
      return;
    }
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    try {
      const playlistId = selectedPlaylistId;
      let updatedTracks = selectedPlaylistTracks;
      for (const trackId of uniqueIds) {
        updatedTracks = await removeTrackFromPlaylist(playlistId, trackId);
      }
      setSelectedPlaylistTracks(updatedTracks);
      await loadPlaylists();
      showUndoAction({
        type: "playlist-remove",
        label: `${uniqueIds.length} track${uniqueIds.length === 1 ? "" : "s"}`,
        playlistId,
        trackIds: uniqueIds,
      });
      setStatus(`Removed ${uniqueIds.length} track${uniqueIds.length === 1 ? "" : "s"} from playlist`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove selected tracks from playlist");
    }
  }

  async function handleMovePlaylistTrack(trackId: number, direction: "up" | "down") {
    if (!selectedPlaylistId) {
      return;
    }
    try {
      setSelectedPlaylistTracks(await moveTrackInPlaylist(selectedPlaylistId, trackId, direction));
      await loadPlaylists();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not move track");
    }
  }

  async function handleExportPlaylist(playlistId: number) {
    try {
      const response = await exportPlaylist(playlistId);
      setStatus(`Exported ${response.track_count} tracks to ${response.playlist_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export playlist");
    }
  }

  async function handleExportTracks(trackIds: number[]) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!uniqueIds.length) {
      return;
    }
    try {
      const response = await exportQueue(uniqueIds);
      setStatus(`Exported ${response.track_count} tracks to ${response.playlist_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export selected tracks");
    }
  }

  async function handleImportPlaylist() {
    if (!importPlaylistPath.trim()) {
      setStatus("Enter a playlist path");
      return;
    }
    try {
      const imported = await importPlaylist(importPlaylistPath.trim());
      setImportPlaylistPath("");
      await loadPlaylists();
      await handleSelectPlaylist(imported.id);
      setLibraryView("playlists");
      setStatus(`Imported playlist ${imported.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import playlist");
    }
  }

  async function handleReviewInboxTracks(trackIds: number[], allNew = false) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!allNew && uniqueIds.length === 0) {
      return;
    }
    try {
      const response = allNew ? await reviewAllInboxTracks() : await reviewInboxTracks(uniqueIds);
      await loadInbox();
      setStatus(`Reviewed ${response.updated.toLocaleString()} Inbox track${response.updated === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update Inbox");
    }
  }

  async function handleUpdateInboxNote(trackId: number, note: string) {
    try {
      await updateInboxNote(trackId, note);
      await loadInbox();
      setStatus(note.trim() ? "Inbox note saved" : "Inbox note cleared");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save Inbox note");
    }
  }

  async function handleSaveInboxAutoReviewRule(rule: InboxAutoReviewRuleRequest, ruleId?: number) {
    try {
      const response = ruleId
        ? await updateInboxAutoReviewRule(ruleId, rule)
        : await createInboxAutoReviewRule(rule);
      await loadInbox();
      setStatus(
        response.applied
          ? `Auto-review rule saved; reviewed ${response.applied.toLocaleString()} matching track${response.applied === 1 ? "" : "s"}`
          : `Auto-review rule saved: ${response.rule.name}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save auto-review rule");
    }
  }

  async function handleDeleteInboxAutoReviewRule(rule: InboxAutoReviewRule) {
    if (!window.confirm(`Delete auto-review rule "${rule.name}"?`)) {
      return;
    }
    try {
      await deleteInboxAutoReviewRule(rule.id);
      await loadInbox();
      setStatus("Auto-review rule deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete auto-review rule");
    }
  }

  function handleShuffleTracks(sourceTracks: Track[]) {
    const shuffled = shuffleItems(sourceTracks);
    if (!shuffled.length) {
      setStatus("No tracks to shuffle");
      return;
    }
    replaceUpcomingPlaybackQueue(shuffled, "Shuffle");
  }

  async function handleQuickAutoDj(seedTrack?: Track | null) {
    try {
      const response = await generateAutoDj({
        ...defaultAutoDj,
        ...(recommendationProfiles.find((profile) => profile.is_default)?.settings ?? {}),
        queue_length: uiPreferences.defaultQueueLength,
        temperature: uiPreferences.defaultTemperature,
        seed_track_id: seedTrack?.id ?? null,
        similarity_weight: seedTrack ? uiPreferences.similarityWeight : 0,
      });
      setQueue(response.tracks);
      setRecommendationDrift(response.drift);
      void loadRecommendationHistory();
      replaceUpcomingPlaybackQueue(response.tracks, seedTrack ? "AutoDJ from track" : "AutoDJ");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not generate AutoDJ");
    }
  }

  function handleContinuousAutoDjChange(enabled: boolean) {
    setContinuousAutoDjEnabled(enabled);
    setStatus(enabled ? "Continuous AutoDJ will keep the upcoming queue filled" : "Continuous AutoDJ off");
  }

  function queueUpcomingPlaybackTracks(nextTracks: Track[]) {
    if (!nextTracks.length) {
      return;
    }

    if (currentTrack) {
      const upcoming = nextTracks.filter((track) => track.id !== currentTrack.id);
      setPlaybackQueue([currentTrack, ...upcoming]);
      return;
    }

    setPlaybackQueue(nextTracks);
    setAutoPlayOnTrackChange(false);
    setCurrentTrack(nextTracks[0]);
  }

  function replaceUpcomingPlaybackQueue(nextTracks: Track[], label: string) {
    if (!nextTracks.length) {
      setStatus(`${label} did not find any tracks`);
      return;
    }

    if (currentTrack) {
      const upcoming = nextTracks.filter((track) => track.id !== currentTrack.id);
      queueUpcomingPlaybackTracks(nextTracks);
      setStatus(`${label} updated what plays next with ${upcoming.length.toLocaleString()} track${upcoming.length === 1 ? "" : "s"}`);
      return;
    }

    queueUpcomingPlaybackTracks(nextTracks);
    setStatus(`${label} queued ${nextTracks.length.toLocaleString()} track${nextTracks.length === 1 ? "" : "s"}`);
  }

  async function extendContinuousAutoDj() {
    if (continuousAutoDjInFlightRef.current) {
      return;
    }
    continuousAutoDjInFlightRef.current = true;
    setContinuousAutoDjBusy(true);
    try {
      const appendLength = Math.max(10, Math.min(25, continuousAutoDjSettings.queue_length || uiPreferences.defaultQueueLength));
      const response = await generateAutoDj({
        ...continuousAutoDjSettings,
        queue_length: appendLength,
        seed_track_id: currentTrack?.id ?? continuousAutoDjSettings.seed_track_id ?? null,
        similarity_weight: currentTrack
          ? Math.max(Number(continuousAutoDjSettings.similarity_weight ?? 0), uiPreferences.similarityWeight * 0.5)
          : continuousAutoDjSettings.similarity_weight,
      });
      setQueue(response.tracks);
      setRecommendationDrift(response.drift);
      void loadRecommendationHistory();

      const snapshotIds = new Set(playbackQueue.map((track) => track.id));
      const snapshotAdditions = response.tracks.filter((track) => !snapshotIds.has(track.id));
      setPlaybackQueue((current) => {
        const existingIds = new Set(current.map((track) => track.id));
        const additions = response.tracks.filter((track) => !existingIds.has(track.id));
        return additions.length ? [...current, ...additions] : current;
      });
      if (snapshotAdditions.length > 0) {
        setStatus(
          `Continuous AutoDJ added ${snapshotAdditions.length.toLocaleString()} upcoming track${snapshotAdditions.length === 1 ? "" : "s"}`,
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Continuous AutoDJ could not add tracks");
    } finally {
      continuousAutoDjInFlightRef.current = false;
      setContinuousAutoDjBusy(false);
    }
  }

  useEffect(() => {
    if (!continuousAutoDjEnabled || continuousAutoDjBusy || !currentTrack) {
      return;
    }
    const activeIndex = playbackQueue.findIndex((track) => track.id === currentTrack.id);
    const remaining = activeIndex >= 0 ? playbackQueue.length - activeIndex - 1 : playbackQueue.length;
    if (remaining <= 3) {
      void extendContinuousAutoDj();
    }
  }, [continuousAutoDjEnabled, continuousAutoDjBusy, currentTrack?.id, playbackQueue.length]);

  async function handleAvoidAutoDj(scope: "track" | "artist" | "album" | "genre", track?: Track | null) {
    try {
      const rule = await createAutoDjAvoidRule({
        scope,
        track_id: track?.id ?? null,
        value:
          scope === "artist"
            ? track?.artist ?? null
            : scope === "album"
              ? track?.album ?? null
              : scope === "genre"
                ? trackGenre(track) ?? null
                : null,
      });
      await loadAutoDjAvoidRules();
      setStatus(`AutoDJ will avoid ${rule.label}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update AutoDJ avoid list");
    }
  }

  async function handleRevealTrack(track: Track) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reveal_in_file_explorer", { path: track.path });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reveal in Explorer is available in the desktop app.");
    }
  }

  async function handleDeleteAutoDjAvoidRule(ruleId: number) {
    try {
      setAutoDjAvoidRules(await deleteAutoDjAvoidRule(ruleId));
      setStatus("Removed AutoDJ avoid rule");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove AutoDJ avoid rule");
    }
  }

  async function handleSaveRecommendationProfile(name: string, profileSettings: AutoDjSettings, isDefault: boolean) {
    try {
      const saved = await saveRecommendationProfile({ name, settings: profileSettings, is_default: isDefault });
      await loadRecommendationProfiles();
      setStatus(`${saved.name} recommendation profile saved${saved.is_default ? " as default" : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save recommendation profile");
    }
  }

  async function handleSetDefaultRecommendationProfile(profileId: number) {
    try {
      setRecommendationProfiles(await setDefaultRecommendationProfile(profileId));
      setStatus("Default recommendation profile updated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update default profile");
    }
  }

  async function handleDeleteRecommendationProfile(profileId: number) {
    try {
      setRecommendationProfiles(await deleteRecommendationProfile(profileId));
      setStatus("Recommendation profile deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete recommendation profile");
    }
  }

  function rememberRecommendationFeedback(track: Track, eventType: "play_next" | "add_to_queue" | "manual_play", weight = 1) {
    if (track.id <= 0 || track.is_preview) {
      return;
    }
    void recordRecommendationFeedback({ track_id: track.id, event_type: eventType, weight }).catch(() => {
      // Recommendation feedback is a soft learning signal; playback should never wait on it.
    });
  }

  async function recordTrackExitQuiet(track: Track, listenedSeconds: number) {
    if (track.id <= 0 || track.is_preview) {
      return;
    }
    const durationSeconds = track.duration_seconds ?? 0;
    try {
      const updated =
        shouldRecordTrackAsPlayed(listenedSeconds, durationSeconds, uiPreferences.skipThresholdPercent)
          ? await markTrackPlayed(track.id)
          : await markTrackSkipped(track.id);
      replaceTrackEverywhere(updated);
      void loadHistory();
    } catch {
      // Playback should not be interrupted by history bookkeeping.
    }
  }

  type PlayTrackOptions = { suppressExitRecord?: boolean; cdPreviewPrepared?: boolean };

  function ensureLatestCdPlaybackRequest(requestId: number) {
    if (cdPlaybackPrepareRequestIdRef.current !== requestId) {
      throw new StaleCdPlaybackRequestError();
    }
  }

  async function refreshCdPreviewTrack(track: Track, queueItems: Track[], requestId: number) {
    const driveId = cdDriveIdFromTrack(track);
    const trackNumber = cdTrackNumberFromTrack(track);
    if (!driveId || !trackNumber) {
      throw new Error("Could not refresh this CD track. Refresh the CD page and try again.");
    }
    ensureLatestCdPlaybackRequest(requestId);

    const requestBody = {
      albumTitle: track.album ?? null,
      albumArtist: track.album_artist ?? track.artist ?? null,
      year: track.year ?? null,
      genre: track.genre ?? null,
      tracks: [
        {
          track_number: trackNumber,
          disc_number: track.disc_number,
          title: track.title,
          artist: track.artist,
          duration_seconds: track.duration_seconds,
        },
      ],
    };
    const response = await playCdTrack(trackNumber, driveId, requestBody);
    ensureLatestCdPlaybackRequest(requestId);
    if (!response.track) {
      throw new Error("Could not prepare this CD track for playback.");
    }

    const refreshedTrack = response.track;
    const refreshedQueue = queueItems.map((item) => {
      const sameVirtualTrack =
        cdTrackLooksActive(item) &&
        cdTrackNumberFromTrack(item) === trackNumber &&
        cdDriveIdFromTrack(item) === driveId;
      return item.id === track.id || sameVirtualTrack ? refreshedTrack : item;
    });
    return { track: refreshedTrack, queue: refreshedQueue };
  }

  function commitPlayTrack(track: Track, queueItems: Track[], options?: PlayTrackOptions) {
    if (!options?.suppressExitRecord && currentTrack && currentTrack.id !== track.id) {
      void recordTrackExitQuiet(currentTrack, playbackTime);
    }
    setCurrentRadioStation(null);
    setPlaybackQueue(queueItems);
    setAutoPlayOnTrackChange(true);
    setCurrentTrack(track);
    rememberRecommendationFeedback(track, "manual_play", 0.7);
  }

  function handlePlayTrack(track: Track, queueItems: Track[], options?: PlayTrackOptions) {
    if (cdTrackLooksActive(track) && !options?.cdPreviewPrepared) {
      const requestId = ++cdPlaybackPrepareRequestIdRef.current;
      const prepareTask = cdPlaybackPrepareChainRef.current
        .catch(() => {
          // A previous CD request may have failed or gone stale. The chain keeps
          // ordering intact so only the newest request can touch the CD drive.
        })
        .then(async () => {
          await waitFor(CD_PLAYBACK_PREPARE_DEBOUNCE_MS);
          ensureLatestCdPlaybackRequest(requestId);
          return refreshCdPreviewTrack(track, queueItems, requestId);
        });
      cdPlaybackPrepareChainRef.current = prepareTask.catch(() => {
        // Keep the chain alive for future CD selections.
      });
      void prepareTask
        .then((prepared) => {
          if (cdPlaybackPrepareRequestIdRef.current !== requestId) {
            return;
          }
          handlePlayTrack(prepared.track, prepared.queue, { ...options, cdPreviewPrepared: true });
        })
        .catch((error) => {
          if (isStaleCdPlaybackRequest(error)) {
            return;
          }
          if (cdPlaybackPrepareRequestIdRef.current === requestId) {
            setStatus(error instanceof Error ? error.message : "Could not prepare CD playback");
          }
        });
      return;
    }

    if (!cdTrackLooksActive(track)) {
      cdPlaybackPrepareRequestIdRef.current += 1;
    }

    const shouldFadeExistingSource =
      !options?.suppressExitRecord &&
      uiPreferences.playerFadeMs > 0 &&
      Boolean(currentRadioStation || (currentTrack && currentTrack.id !== track.id));

    if (shouldFadeExistingSource) {
      externalTrackRequestIdRef.current += 1;
      setExternalTrackRequest({
        id: externalTrackRequestIdRef.current,
        track,
        queue: queueItems,
      });
      return;
    }

    commitPlayTrack(track, queueItems, options);
  }

  function handleCommitExternalTrackRequest(
    request: { id: number; track: Track; queue: Track[] },
    options?: { suppressExitRecord?: boolean },
  ) {
    setExternalTrackRequest((current) => (current?.id === request.id ? null : current));
    commitPlayTrack(request.track, request.queue, options);
  }

  function handlePlayCdPreviewTrack(track: Track, queueItems: Track[] = [track]) {
    setRestoredPlaybackPosition(null);
    handlePlayTrack(track, queueItems.length ? queueItems : [track], { cdPreviewPrepared: true });
  }

  async function handlePlayRadioStation(station: RadioStation) {
    if (currentTrack) {
      void recordTrackExitQuiet(currentTrack, playbackTime);
    }
    setCurrentTrack(null);
    setPlaybackQueue([]);
    setRestoredPlaybackPosition(null);
    setCurrentRadioStation(station);
    setAutoPlayOnTrackChange(true);
    setRadioPlaybackRequestId((current) => current + 1);
    try {
      await markRadioStationPlayed(station.id);
    } catch {
      // Radio playback should still start even if last-played bookkeeping fails.
    }
    setStatus(`Playing ${display(station.name, "radio station")}`);
  }

  function handleStopRadioStation(stationId: number) {
    if (currentRadioStation?.id === stationId) {
      setCurrentRadioStation(null);
      setAutoPlayOnTrackChange(false);
    }
  }

  function handlePlayNext(track: Track) {
    setPlaybackQueue((current) => {
      const baseQueue = current.length ? current : currentTrack ? [currentTrack] : [];
      const withoutTrack = baseQueue.filter((item) => item.id !== track.id);
      const activeIndex = currentTrack ? withoutTrack.findIndex((item) => item.id === currentTrack.id) : -1;
      const insertAt = activeIndex >= 0 ? activeIndex + 1 : 0;
      return [...withoutTrack.slice(0, insertAt), track, ...withoutTrack.slice(insertAt)];
    });
    if (!currentTrack && !currentRadioStation) {
      setAutoPlayOnTrackChange(false);
      setCurrentTrack(track);
    }
    rememberRecommendationFeedback(track, "play_next", 1.4);
    setStatus(`Queued ${display(track.title, "track")} next`);
  }

  function handleAddToQueue(track: Track) {
    setPlaybackQueue((current) => (current.some((item) => item.id === track.id) ? current : [...current, track]));
    if (!currentTrack && !currentRadioStation) {
      setAutoPlayOnTrackChange(false);
      setCurrentTrack(track);
    }
    rememberRecommendationFeedback(track, "add_to_queue", 1.0);
    setStatus(`Added ${display(track.title, "track")} to queue`);
  }

  function handleMovePlaybackQueueTrack(index: number, direction: "up" | "down") {
    setPlaybackQueue((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || index >= current.length || targetIndex >= current.length) {
        return current;
      }
      rememberQueueSnapshot(current);
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function handleReorderPlaybackQueueTrack(fromIndex: number, toIndex: number) {
    setPlaybackQueue((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current;
      }
      rememberQueueSnapshot(current);
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleRemovePlaybackQueueTrack(index: number) {
    setPlaybackQueue((current) => {
      if (index < 0 || index >= current.length) {
        return current;
      }
      rememberQueueSnapshot(current);
      const removed = current[index];
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      if (removed.id === currentTrack?.id) {
        setAutoPlayOnTrackChange(Boolean(next.length));
        setCurrentTrack(next[index] ?? next[index - 1] ?? null);
      }
      return next;
    });
  }

  function handleClearPlaybackQueue() {
    rememberQueueSnapshot();
    setPlaybackQueue(currentTrack ? [currentTrack] : []);
    setStatus("Cleared upcoming queue");
  }

  function handleRestorePlaybackQueue() {
    const [previous, ...rest] = queueHistory;
    if (!previous) {
      setStatus("No previous queue to restore");
      return;
    }
    setPlaybackQueue(previous);
    setQueueHistory(rest);
    if (currentTrack && !previous.some((track) => track.id === currentTrack.id)) {
      setCurrentTrack(previous[0] ?? null);
      setAutoPlayOnTrackChange(false);
    }
    setStatus("Restored previous queue");
  }

  async function handleSavePlaybackQueue() {
    if (!playbackQueue.length) {
      setStatus("Queue is empty");
      return;
    }
    const name = window.prompt("Playlist name", `Queue ${new Date().toLocaleDateString()}`);
    if (!name?.trim()) {
      return;
    }
    try {
      const created = await createPlaylist(name.trim());
      await addTracksToPlaylist(created.id, playbackQueue.map((track) => track.id));
      await loadPlaylists();
      setSelectedPlaylistId(created.id);
      setTargetPlaylistId(created.id);
      setStatus(`Saved queue as ${created.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save queue");
    }
  }

  async function handleTrackEnded(trackId: number) {
    if (trackId <= 0) {
      return;
    }
    try {
      const updated = await markTrackPlayed(trackId);
      replaceTrackEverywhere(updated);
      void loadHistory();
    } catch {
      setStatus("Playback finished, but play history could not be saved.");
    }
  }

  async function handleTrackSkipped(trackId: number) {
    if (trackId <= 0) {
      return;
    }
    try {
      const updated = await markTrackSkipped(trackId);
      replaceTrackEverywhere(updated);
      void loadHistory();
    } catch {
      setStatus("Skip could not be saved.");
    }
  }

  async function handleFetchLyrics(trackOrId: Track | number): Promise<LyricsResponse> {
    const trackId = typeof trackOrId === "number" ? trackOrId : trackOrId.id;
    const sourceTrack = typeof trackOrId === "number" ? (currentTrack?.id === trackOrId ? currentTrack : null) : trackOrId;
    const useMetadataLookup = Boolean(sourceTrack && shouldLookupLyricsByMetadata(sourceTrack));
    try {
      const response = useMetadataLookup && sourceTrack
        ? await fetchLyricsByMetadata(lyricsLookupRequestForTrack(sourceTrack))
        : await fetchLyricsOnline(trackId);
      setLyrics(response);
      setStatus(response.is_synced ? "Fetched synced lyrics" : "Fetched lyrics");
      return response;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Could not fetch lyrics";
      const message =
        useMetadataLookup && /not found|no lyrics/i.test(rawMessage)
          ? "No matching lyrics found for this CD track"
          : rawMessage;
      setStatus(message);
      throw error;
    }
  }

  async function handleSaveLyrics(trackId: number, requestBody: LyricsUpdateRequest): Promise<LyricsResponse> {
    try {
      const response = await updateLyrics(trackId, requestBody);
      setLyrics(response);
      setStatus(requestBody.target === "file" ? "Lyrics saved to file and database" : "Lyrics saved to database");
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save lyrics";
      setStatus(message);
      throw error;
    }
  }

  async function handleBackupDatabase() {
    try {
      const response = await backupDatabase();
      setStatus(`Database backed up to ${response.backup_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Database backup failed");
    }
  }

  function clearFrontendLocalData() {
    try {
      const explicitKeys = new Set([
        ...Object.values(storageKeys),
        ...Object.values(legacyStorageKeys),
        "flac-cafe-sidebar-order",
        "flacCafeFilenameTagPresets",
        "flacCafeCsvImportProfiles",
      ]);
      for (const key of Object.keys(window.localStorage)) {
        if (
          explicitKeys.has(key) ||
          key.startsWith("flac-cafe-") ||
          key.startsWith("local-autodj-") ||
          key.startsWith("flacCafe")
        ) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // Resetting SQLite is the important part; browser storage can be unavailable.
    }
  }

  async function handleResetLocalData() {
    const first = window.confirm(
      "Reset FLAC Cafe local data?\n\nThis backs up and clears the SQLite library database, cached lyrics, and generated cache files. Music files, exports, tools, models, and logs are not deleted.",
    );
    if (!first) {
      return;
    }
    const confirmation = window.prompt("Type RESET to confirm local data reset.");
    if (confirmation !== "RESET") {
      setStatus("Local data reset canceled");
      return;
    }
    try {
      const response = await resetLocalData(confirmation);
      clearFrontendLocalData();
      setStatus(response.backup_path ? `Local data reset. Backup: ${response.backup_path}` : response.message);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not reset local data");
    }
  }

  async function handleCreateSupportBundle() {
    try {
      const response = await createSupportBundle();
      setSupportBundlePath(response.bundle_path);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("reveal_in_file_explorer", { path: response.bundle_path });
      } catch {
        // Browser mode cannot reveal files; the path in the toast is enough.
      }
      setStatus(`Support bundle ready: ${response.bundle_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create support bundle");
    }
  }

  async function handleCopySupportBundlePath() {
    if (!supportBundlePath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(supportBundlePath);
      setStatus("Support bundle path copied");
    } catch {
      setStatus(supportBundlePath);
    }
  }

  async function handleOpenSourceFolder(kind: "source" | "themes" = "source") {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_source_folder", { kind });
      setStatus(kind === "themes" ? "Opened themes folder" : "Opened source folder");
    } catch {
      setStatus(kind === "themes" ? "Themes live in frontend/src/config/themes" : "Source folder is the current project directory.");
    }
  }

  async function handleOpenExternalUrl(url: string) {
    await openExternalUrl(url, setStatus);
  }

  function handleOpenCurrentTrackFromPlayer(track: Track) {
    setDetailTrack(track);
    setLibraryView("tracks");
    setActivePage("library");
  }

  function handleOpenCurrentArtistFromPlayer(track: Track) {
    const artistName = primaryArtistName(track.artist);
    if (!artistName) {
      setStatus("This track does not have an artist tag yet");
      return;
    }
    setActivePage("artist");
  }

  async function handleOpenCurrentAlbumFromPlayer(track: Track) {
    if (!track.album?.trim()) {
      setStatus("This track does not have an album tag yet");
      return;
    }

    setSearch("");
    setDebouncedSearch("");
    setLibraryView("albums");
    setActivePage("library");

    try {
      let album = findAlbumForTrack(albums, track);
      if (!album) {
        const allAlbums = await fetchAlbums("");
        setAlbums(allAlbums);
        album = findAlbumForTrack(allAlbums, track);
      }
      if (!album) {
        setStatus("Could not find that album in the Library view");
        return;
      }
      await handleSelectAlbum(album.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open album");
    }
  }

  async function loadArtistInfo(refresh = false) {
    const artistName = primaryArtistName(currentTrack?.artist);
    if (!artistName) {
      setArtistInfo(null);
      setArtistTracks([]);
      return;
    }
    try {
      setArtistTracks(await fetchArtistLocalTracks(artistName));
    } catch {
      setArtistTracks([]);
    }
    if (!uiPreferences.enableArtistLookup) {
      setArtistInfo(null);
      return;
    }
    setIsArtistLoading(true);
    try {
      const response = await fetchArtistInfo(artistName, refresh);
      setArtistInfo(response);
      if (response.error) {
        setStatus(response.error);
      }
    } catch (error) {
      setArtistInfo({
        artist_name: artistName,
        query: artistName,
        summary: null,
        image_url: null,
        page_url: null,
        source: "Wikipedia",
        found: false,
        from_cache: false,
        updated_at: null,
        error: error instanceof Error ? error.message : "Could not load artist info",
      });
    } finally {
      setIsArtistLoading(false);
    }
  }

  useEffect(() => {
    void waitForBackendStartup();
  }, []);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    void loadSettings();
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ok" || startupBackgroundHydratedRef.current) {
      return;
    }
    startupBackgroundHydratedRef.current = true;
    const timers = [
      window.setTimeout(() => void loadLibraryStats(), 1200),
      window.setTimeout(() => void loadPlaylists(), 1700),
      window.setTimeout(() => void loadRecommendationProfiles(), 2400),
      window.setTimeout(() => void loadRecommendationHistory(), 3000),
      window.setTimeout(() => void loadAutoDjAvoidRules(), 3600),
      window.setTimeout(() => void loadFolderWatchStatus(), 4400),
      window.setTimeout(() => void loadCdRipSetup(), 5200),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    void restoreLastPlaybackSession();
  }, [backendStatus]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      void checkBackendStatus(false);
    }, 30000);
    return () => window.clearInterval(handle);
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
      if (FolderWatchRefreshTimerRef.current !== null) {
        window.clearTimeout(FolderWatchRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let disposed = false;
    void listenFolderWatchEvents((event) => {
      const error = event.paths.find((path) => path.startsWith("watch-error:") || path.startsWith("watcher-error:")) ?? null;
      scheduleFolderWatchRefresh(event.event_count, error);
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      })
      .catch(() => {
        // Browser preview and older desktop builds do not have the Rust watcher.
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [folderWatchStatus?.folder_path, libraryFolders, folderPath, settings?.library_path]);

  useEffect(() => {
    if (!lastSessionRestoreFinishedRef.current) {
      return;
    }
    if (
      restoredPlaybackPosition !== null &&
      currentTrack &&
      playbackTime < Math.max(1, restoredPlaybackPosition - 1)
    ) {
      return;
    }

    const queueIds = playbackQueue.map((track) => track.id).slice(0, 200);
    const currentTrackId = currentTrack?.id ?? null;
    const positionSeconds = currentTrack ? Math.max(0, Math.floor(playbackTime)) : 0;
    const writeKey = `${currentTrackId ?? "none"}|${queueIds.join(",")}|${Math.floor(positionSeconds / 5)}`;

    if (lastSessionWriteKeyRef.current === writeKey) {
      return;
    }
    lastSessionWriteKeyRef.current = writeKey;

    try {
      window.localStorage.setItem(
        storageKeys.lastSession,
        JSON.stringify({
          currentTrackId,
          queueIds,
          positionSeconds,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Ignore local storage failures.
    }
  }, [currentTrack, currentTrack?.id, playbackQueue, playbackTime, restoredPlaybackPosition]);

  useEffect(() => {
    const saveLastPlaybackMoment = () => {
      if (!lastSessionRestoreFinishedRef.current) {
        return;
      }
      if (
        restoredPlaybackPosition !== null &&
        currentTrack &&
        playbackTime < Math.max(1, restoredPlaybackPosition - 1)
      ) {
        return;
      }
      try {
        window.localStorage.setItem(
          storageKeys.lastSession,
          JSON.stringify({
            currentTrackId: currentTrack?.id ?? null,
            queueIds: playbackQueue.map((track) => track.id).slice(0, 200),
            positionSeconds: currentTrack ? Math.max(0, Math.floor(playbackTime)) : 0,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // Ignore local storage failures while the app is closing.
      }
    };

    window.addEventListener("beforeunload", saveLastPlaybackMoment);
    return () => window.removeEventListener("beforeunload", saveLastPlaybackMoment);
  }, [currentTrack, playbackQueue, playbackTime, restoredPlaybackPosition]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKeys.uiPreferences, JSON.stringify(uiPreferences));
      window.localStorage.setItem(storageKeys.hideFilePaths, String(uiPreferences.hideFilePaths));
    } catch {
      // Ignore private/local storage failures; the setting still works for the session.
    }
  }, [uiPreferences]);

  useEffect(() => {
    const accent = themeAccentValues[uiPreferences.themeAccent] ?? themeAccentValues.cafe;
    const cssVariables: Partial<Record<keyof ThemePalette, string>> = {
      ember: "--color-ember",
      moss: "--color-moss",
      ink: "--color-ink",
      panel: "--color-panel",
      line: "--color-line",
      muted: "--color-muted",
      paper: "--color-paper",
      hoverPanel: "--color-hover-panel",
      sidebar: "--color-sidebar",
      strip: "--color-strip",
      subtle: "--color-subtle",
      popover: "--color-popover",
      quiet: "--color-quiet",
      mini: "--color-mini",
      miniPanel: "--color-mini-panel",
      surfaceGlow: "--color-surface-glow",
      primaryHover: "--color-primary-hover",
      softAccent: "--color-soft-accent",
      scrollTrack: "--color-scroll-track",
      scrollThumb: "--color-scroll-thumb",
      scrollThumbHover: "--color-scroll-thumb-hover",
    };
    for (const [key, variable] of Object.entries(cssVariables) as [keyof ThemePalette, string][]) {
      document.documentElement.style.setProperty(variable, accent[key]);
    }
    const selectedFont =
      uiPreferences.fontChoice === "theme"
        ? accent.fontFamily
        : fontChoiceValues[uiPreferences.fontChoice] ?? accent.fontFamily;
    document.documentElement.style.setProperty("--font-sans", selectedFont);
    document.documentElement.style.fontSize = fontScaleValues[uiPreferences.fontScale] ?? fontScaleValues.default;
    document.documentElement.dataset.density = uiPreferences.density;
  }, [uiPreferences.themeAccent, uiPreferences.fontChoice, uiPreferences.fontScale, uiPreferences.density]);

  useEffect(() => {
    if (!status) {
      return;
    }
    const handle = window.setTimeout(() => setStatus(""), 3200);
    return () => window.clearTimeout(handle);
  }, [status]);

  useEffect(() => {
    if (!hasLoadedInitialLibrary || currentLibraryTrackQueryKey() !== defaultLibraryTrackQueryKey()) {
      return;
    }
    writeStartupLibrarySnapshot(tracks, libraryTotal);
  }, [tracks, libraryTotal, hasLoadedInitialLibrary, debouncedSearch, debouncedAdvancedTrackSearch, librarySort]);

  useEffect(() => {
    function closeFloatingDetails(event: MouseEvent) {
      const target = event.target as Node | null;
      setAppContextMenu(null);
      document.querySelectorAll<HTMLDetailsElement>("details[data-auto-close][open]").forEach((details) => {
        if (!target || !details.contains(target)) {
          details.open = false;
        }
      });
    }

    function closeFloatingDetailsOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      document.querySelectorAll<HTMLDetailsElement>("details[data-auto-close][open]").forEach((details) => {
        details.open = false;
      });
      setAppContextMenu(null);
    }

    window.addEventListener("click", closeFloatingDetails);
    window.addEventListener("keydown", closeFloatingDetailsOnEscape);
    return () => {
      window.removeEventListener("click", closeFloatingDetails);
      window.removeEventListener("keydown", closeFloatingDetailsOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!detailTrack) {
      return;
    }

    function closeTrackDetailsOnClickAway(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-track-details-panel]")) {
        return;
      }
      setDetailTrack(null);
    }

    function closeTrackDetailsOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailTrack(null);
      }
    }

    window.addEventListener("pointerdown", closeTrackDetailsOnClickAway, true);
    window.addEventListener("keydown", closeTrackDetailsOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeTrackDetailsOnClickAway, true);
      window.removeEventListener("keydown", closeTrackDetailsOnEscape);
    };
  }, [detailTrack]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (activePage !== "library" && search) {
      setSearch("");
      setDebouncedSearch("");
    }
  }, [activePage, search]);

  useEffect(() => {
    if (backendStatus !== "ok" || activePage !== "library" || libraryView !== "tracks") {
      return;
    }
    const currentQueryKey = currentLibraryTrackQueryKey();
    if (priorityLibraryQueryKeyRef.current === currentQueryKey) {
      priorityLibraryQueryKeyRef.current = null;
      return;
    }
    if (libraryCacheQueryKeyRef.current === currentQueryKey && trackIndexCacheRef.current.size > 0) {
      return;
    }
    void refreshTracks();
  }, [backendStatus, activePage, libraryView, debouncedSearch, debouncedAdvancedTrackSearch, librarySort]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedAdvancedTrackSearch(advancedTrackSearch);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [advancedTrackSearch]);

  useEffect(() => {
    if (backendStatus !== "ok" || activePage !== "library") {
      return;
    }
    if (libraryView === "albums" || libraryView === "completion") {
      void loadAlbums();
    }
    if (libraryView === "artists") {
      void loadArtists();
    }
  }, [backendStatus, activePage, libraryView, debouncedSearch]);

  useEffect(() => {
    if (backendStatus !== "ok" || activePage !== "library" || libraryView !== "playlists") {
      return;
    }
    void loadPlaylists();
  }, [backendStatus, activePage, libraryView]);

  useEffect(() => {
    if (backendStatus !== "ok" || activePage !== "library") {
      return;
    }
    if (libraryView === "health") {
      void loadLibraryStats();
    }
    if (libraryView === "inbox") {
      void loadInbox();
    }
  }, [backendStatus, activePage, libraryView]);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    if (activePage === "analysis") {
      void loadAnalysisClapReadiness(false);
    }
    if (activePage === "history") {
      void loadHistory();
    }
    if (activePage === "autodj") {
      void loadAutoDjAvoidRules();
      void loadRecommendationProfiles();
      void loadRecommendationHistory();
    }
    if (activePage === "sources") {
      void loadFolderWatchStatus();
    }
    if (activePage === "cd") {
      void loadCdRipSetup();
    }
    if (activePage === "fileManagement") {
      void loadBulkUndoLog();
      void loadChromaprintSetup();
      void loadAudioConversionSetup();
      void loadCdRipSetup();
      void loadFolderWatchStatus();
      void loadClapStatus();
    }
    if (activePage === "settings") {
      void loadStartupDiagnostics(false);
    }
  }, [backendStatus, activePage]);

  useEffect(() => {
    setAppContextMenu(null);
    if (activePage !== "library") {
      setDetailTrack(null);
    }
  }, [activePage]);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    const handle = window.setInterval(() => {
      void loadFolderWatchStatus();
    }, 7000);
    return () => window.clearInterval(handle);
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    const handle = window.setInterval(() => {
      void loadCdRipSetup();
    }, 30000);
    return () => window.clearInterval(handle);
  }, [backendStatus]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      const shortcuts: Array<[Page, keyof UiPreferences["keyboardShortcuts"]]> = [
        ["library", "page.library"],
        ["analysis", "page.analysis"],
        ["nowPlaying", "page.nowPlaying"],
        ["artist", "page.artist"],
        ["audiobooks", "page.audiobooks"],
        ["podcasts", "page.podcasts"],
        ["radio", "page.radio"],
        ["scrobbling", "page.scrobbling"],
        ["cd", "page.cd"],
        ["history", "page.history"],
        ["autodj", "page.autodj"],
        ["sources", "page.sources"],
        ["fileManagement", "page.fileManagement"],
        ["settings", "page.settings"],
      ];
      const match = shortcuts.find(([, action]) => shortcutMatchesEvent(uiPreferences.keyboardShortcuts[action], event));
      if (match) {
        event.preventDefault();
        setActivePage(match[0]);
        return;
      }

      const appActions: Array<[keyof UiPreferences["keyboardShortcuts"], () => void | Promise<void>]> = [
        ["app.openMiniPlayer", handleOpenDetachedMiniPlayer],
        ["app.openLyrics", handleOpenLyricsViewFromPlayer],
        ["app.openQueue", handleOpenQueueViewFromPlayer],
        ["app.openCurrentTrack", () => {
          if (currentTrack) {
            handleOpenCurrentTrackFromPlayer(currentTrack);
          }
        }],
        ["app.openCurrentArtist", () => {
          if (currentTrack) {
            handleOpenCurrentArtistFromPlayer(currentTrack);
          }
        }],
        ["app.openCurrentAlbum", () => {
          if (currentTrack) {
            void handleOpenCurrentAlbumFromPlayer(currentTrack);
          }
        }],
        ["app.undoRecent", handleUndoRecentChange],
      ];
      const appMatch = appActions.find(([action]) => shortcutMatchesEvent(uiPreferences.keyboardShortcuts[action], event));
      if (appMatch) {
        event.preventDefault();
        void appMatch[1]();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uiPreferences.keyboardShortcuts, currentTrack, albums, undoAction]);

  useEffect(() => {
    if (!selectedAlbumId && albums[0]) {
      void handleSelectAlbum(albums[0].id);
    }
  }, [albums, selectedAlbumId]);

  useEffect(() => {
    if (!artists.length) {
      setSelectedArtistName(null);
      setSelectedArtistTracks([]);
      return;
    }
    if (!selectedArtistName || !artists.some((artist) => artist.name === selectedArtistName)) {
      void handleSelectArtist(artists[0].name);
    }
  }, [artists, selectedArtistName]);

  useEffect(() => {
    if (!selectedPlaylistId && playlists[0]) {
      void handleSelectPlaylist(playlists[0].id);
    }
  }, [playlists, selectedPlaylistId]);

  useEffect(() => {
    let cancelled = false;
    if (!currentTrack) {
      setLyrics(null);
      setIsLyricsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (shouldLookupLyricsByMetadata(currentTrack)) {
      const emptyLyrics: LyricsResponse = {
        track_id: currentTrack.id,
        lyrics: null,
        source: null,
        is_synced: false,
      };
      if (!uiPreferences.autoFetchLyrics) {
        setLyrics(emptyLyrics);
        setIsLyricsLoading(false);
        return () => {
          cancelled = true;
        };
      }

      setIsLyricsLoading(true);
      void fetchLyricsByMetadata(lyricsLookupRequestForTrack(currentTrack))
        .then((response) => {
          if (!cancelled) {
            setLyrics(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLyrics(emptyLyrics);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLyricsLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    setIsLyricsLoading(true);
    void fetchLyrics(currentTrack.id)
      .then(async (response) => {
        if (!cancelled) {
          setLyrics(response);
        }
        const shouldFetchOnlineLyrics =
          uiPreferences.autoFetchLyrics &&
          (!lyricsHaveText(response) || (uiPreferences.autoFetchLrcWhenPlainPresent && !response.is_synced));
        if (!cancelled && shouldFetchOnlineLyrics) {
          try {
            const fetched = await fetchLyricsOnline(currentTrack.id);
            if (!cancelled) {
              setLyrics(fetched);
            }
          } catch {
            // Missing online lyrics should not interrupt normal local playback or page loading.
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLyrics({ track_id: currentTrack.id, lyrics: null, source: null, is_synced: false });
          setStatus(error instanceof Error ? error.message : "Could not load lyrics");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLyricsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentTrack?.id,
    currentTrack?.path,
    currentTrack?.title,
    currentTrack?.artist,
    currentTrack?.album,
    currentTrack?.album_artist,
    currentTrack?.duration_seconds,
    currentTrack?.is_preview,
    uiPreferences.autoFetchLyrics,
    uiPreferences.autoFetchLrcWhenPlainPresent,
  ]);

  useEffect(() => {
    if (activePage !== "artist") {
      return;
    }
    void loadArtistInfo(false);
  }, [activePage, currentTrack?.artist, uiPreferences.enableArtistLookup]);

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

  return {
    acousticFingerprintResult,
    activePage,
    advancedTrackSearch,
    albums,
    appContextMenu,
    applyClapStatus,
    applyFolderWatchResponse,
    applyFolderWatchStatus,
    artistInfo,
    artists,
    artistTracks,
    audioAnalysisCoverage,
    audioAnalysisEligibleTrackTotal,
    audioAnalysisJobId,
    audioAnalysisLimit,
    audioAnalysisOnlyMissing,
    audioAnalysisOverwrite,
    audioAnalysisProgress,
    audioConversionInstallProgress,
    audioConversionJobId,
    audioConversionPreview,
    audioConversionProgress,
    audioConversionRequest,
    audioConversionSetup,
    autoDjAvoidRules,
    autoPlayOnTrackChange,
    autoTagPreview,
    autoWriteFetchedLyricsSidecars,
    backendCheckedAt,
    backendLog,
    backendMessage,
    backendStatus,
    beginLibraryLoad,
    buildDesktopScanSnapshot,
    bulkUndoBatches,
    bulkUndoLog,
    bulkUndoRestoreResult,
    cdAutoLookupMetadata,
    cdDriveDetected,
    cdPlaybackPrepareChainRef,
    cdPlaybackPrepareRequestIdRef,
    cdRipSetup,
    checkBackendStatus,
    chromaprintSetup,
    clapCacheDir,
    clapInstallProgress,
    clapMaxDuration,
    clapModelId,
    clapNeedsOptionalInstall,
    clapStatus,
    clapStatusLoadMessage,
    clapStatusLoadPercent,
    clearFrontendLocalData,
    coffeeAnimating,
    commitPlayTrack,
    commitTrackIndexCache,
    confirmDeleteTracks,
    continuousAutoDjBusy,
    continuousAutoDjEnabled,
    continuousAutoDjInFlightRef,
    continuousAutoDjSettings,
    currentCdPlaybackDriveId,
    currentLibraryTrackQueryKey,
    currentRadioStation,
    currentTrack,
    debouncedAdvancedTrackSearch,
    debouncedSearch,
    deletePrompt,
    detailTrack,
    deviceSyncPreview,
    dismissQuickStart,
    duplicateActionResult,
    duplicateReview,
    endLibraryLoad,
    ensureLatestCdPlaybackRequest,
    extendContinuousAutoDj,
    externalTrackRequest,
    externalTrackRequestIdRef,
    fileManagementFocusToolId,
    fileManagementScopeIds,
    filenameTagPreview,
    fileOrganizationPreview,
    fileOrganizationReport,
    findTracksByIds,
    folderPath,
    FolderWatchRefreshTimerRef,
    folderWatchStatus,
    handleAcknowledgeFolderWatchNotifications,
    handleAcoustIdApiKeyChange,
    handleAddToQueue,
    handleAddTracksToPlaylist,
    handleAdvancedTagLibraryChanged,
    handleAnalyzeAudio,
    handleAnalyzeTracks,
    handleApplyAutoTag,
    handleApplyFilenameTags,
    handleApplyFileOrganization,
    handleApplyFolderWatch,
    handleApplyMetadataCsv,
    handleApplyTagRegex,
    handleAutoWriteFetchedLyricsSidecars,
    handleAvoidAutoDj,
    handleBackupDatabase,
    handleBrowseAudioConversionTarget,
    handleBrowseCdRipTarget,
    handleBrowseFolder,
    handleBulkMetadata,
    handleBulkRating,
    handleCancelAudioAnalysis,
    handleCancelAudioConversion,
    handleCdAutoLookupMetadata,
    handleChooseMusicFolderAndScan,
    handleClearArtistCache,
    handleClearIgnoredDuplicateGroups,
    handleClearLibraryCaches,
    handleClearPlaybackQueue,
    handleCoffeeClick,
    handleCommitExternalTrackRequest,
    handleContinuousAutoDjChange,
    handleCopySupportBundlePath,
    handleCreatePlaylist,
    handleCreateSupportBundle,
    handleCycleTheme,
    handleDeleteAutoDjAvoidRule,
    handleDeleteInboxAutoReviewRule,
    handleDeletePlaylist,
    handleDeleteRecommendationProfile,
    handleDeleteTrack,
    handleDeleteTracks,
    handleDeviceSync,
    handleDuplicateAction,
    handleExportFileOrganizationReport,
    handleExportMetadataCsv,
    handleExportMetadataCsvReport,
    handleExportPlaylist,
    handleExportTracks,
    handleFetchLyrics,
    handleIgnoreDuplicateGroup,
    handleImportPlaylist,
    handleInstallAudioConversionFfmpeg,
    handleInstallClap,
    handleLastFmApiCredentialsChange,
    handleLibraryAutoTagTracks,
    handleLibraryClapGenreTagTracks,
    handleLibraryFingerprintTagTracks,
    handleLibraryVolumeTagTracks,
    handleLoadDuplicateReview,
    handleMovePlaybackQueueTrack,
    handleMovePlaylistTrack,
    handleOpenBackendLog,
    handleOpenCurrentAlbumFromPlayer,
    handleOpenCurrentArtistFromPlayer,
    handleOpenCurrentTrackFromPlayer,
    handleOpenDetachedMiniPlayer,
    handleOpenExternalUrl,
    handleOpenFileManagementForTracks,
    handleOpenLyricsViewFromPlayer,
    handleOpenOptionalDependencies,
    handleOpenQueueViewFromPlayer,
    handleOpenSourceFolder,
    handlePauseAudioAnalysis,
    handlePlayAlbum,
    handlePlayArtist,
    handlePlayCdPreviewTrack,
    handlePlayNext,
    handlePlayRadioStation,
    handlePlayTrack,
    handlePreviewAudioConversion,
    handlePreviewAutoTag,
    handlePreviewFilenameTags,
    handlePreviewFileOrganization,
    handlePreviewMetadataCsv,
    handlePreviewTagRegex,
    handleQuickAutoDj,
    handleRating,
    handleReadReportFile,
    handleRefreshFolderWatch,
    handleRemoveLibrarySource,
    handleRemovePlaybackQueueTrack,
    handleRemoveTrackFromPlaylist,
    handleRemoveTracksFromPlaylist,
    handleReorderPlaybackQueueTrack,
    handleResetLocalData,
    handleRestartBackend,
    handleRestoreBulkUndoBatch,
    handleRestoreBulkUndoEntry,
    handleRestorePlaybackQueue,
    handleResumeAudioAnalysis,
    handleRevealTrack,
    handleRevealTracksByIds,
    handleReviewInboxTracks,
    handleRunAcousticFingerprintPass,
    handleSaveAudioConversionSetup,
    handleSaveChromaprintSetup,
    handleSaveClapConfig,
    handleSaveInboxAutoReviewRule,
    handleSaveLyrics,
    handleSavePlaybackQueue,
    handleSaveRecommendationProfile,
    handleSaveTrackMetadata,
    handleScan,
    handleSelectAlbum,
    handleSelectArtist,
    handleSelectPlaylist,
    handleSetDefaultRecommendationProfile,
    handleShuffleTracks,
    handleStartAudioConversion,
    handleStartFolderWatch,
    handleStopFolderWatch,
    handleStopRadioStation,
    handleSyncFileMetadata,
    handleTrackEnded,
    handleTrackSkipped,
    handleUndoAction,
    handleUndoRecentChange,
    handleUpdateInboxNote,
    handleUseSuggestedFolder,
    handleWriteRatingsToFiles,
    hasAdvancedLibraryFilters,
    hasAnalysisIssue,
    hasLoadedInitialLibrary,
    hasMoreTracks,
    hideFilePaths,
    historyEvents,
    historyStats,
    importPlaylistPath,
    inbox,
    isArtistLoading,
    isAudioAnalyzing,
    isCdPlaybackActive,
    isClapInstalling,
    isClapStatusLoading,
    isLibraryLoading,
    isLyricsLoading,
    isScanning,
    lastFolderWatchNotificationIdRef,
    lastSessionRestoreAttemptedRef,
    lastSessionRestoreFinishedRef,
    lastSessionWriteKeyRef,
    libraryAlbumScrollTop,
    libraryArtistScrollTop,
    libraryCacheQueryKeyRef,
    libraryCompletionScrollTop,
    libraryFolders,
    libraryHealth,
    libraryLoadingCountRef,
    libraryPageRequestsInFlightRef,
    libraryPlaylistScrollTop,
    libraryRequestId,
    libraryScrollTop,
    librarySort,
    libraryStats,
    libraryTotal,
    libraryView,
    libraryVisibleColumns,
    loadAlbums,
    loadAnalysisClapReadiness,
    loadArtistInfo,
    loadArtists,
    loadAudioConversionSetup,
    loadAutoDjAvoidRules,
    loadBulkUndoLog,
    loadCdRipSetup,
    loadChromaprintSetup,
    loadClapCoverage,
    loadClapStatus,
    loadFolderWatchStatus,
    loadHistory,
    loadInbox,
    loadLibraryStats,
    loadMoreTracks,
    loadPlaylists,
    loadPriorityLibraryTracks,
    loadRecommendationHistory,
    loadRecommendationProfiles,
    loadSettings,
    loadStartupDiagnostics,
    loadTracksPage,
    loadTrackWindow,
    lyrics,
    mergeTrackPage,
    metadataCsvExport,
    metadataCsvImportPreview,
    metadataCsvImportReport,
    metadataEditInitialField,
    metadataEditTrack,
    newPlaylistName,
    openApiKeysSettings,
    openAppContextMenu,
    openMetadataEditor,
    playbackMode,
    playbackQueue,
    playbackTime,
    playlists,
    priorityLibraryLoadStartedRef,
    priorityLibraryQueryKeyRef,
    queue,
    queueHistory,
    queueUpcomingPlaybackTracks,
    quickStartDismissed,
    radioPlaybackRequestId,
    recommendationDrift,
    recommendationHistory,
    recommendationProfiles,
    recordTrackExitQuiet,
    recycleFilesWithDesktop,
    refreshAnalyzedState,
    refreshCdPreviewTrack,
    refreshTracks,
    rememberQueueSnapshot,
    rememberRecommendationFeedback,
    removeTrackEverywhere,
    replaceTrackEverywhere,
    replaceUpcomingPlaybackQueue,
    reportFile,
    requestDeleteTracks,
    resolveTracksForAction,
    restoredPlaybackPosition,
    restoreLastPlaybackSession,
    scanProgress,
    scanResult,
    scheduleFolderWatchRefresh,
    search,
    selectedAlbumId,
    selectedAlbumTracks,
    selectedArtistName,
    selectedArtistTracks,
    selectedPlaylistId,
    selectedPlaylistTracks,
    setAcousticFingerprintResult,
    setActivePage,
    setAdvancedTrackSearch,
    setAlbums,
    setAppContextMenu,
    setArtistInfo,
    setArtists,
    setArtistTracks,
    setAudioAnalysisCoverage,
    setAudioAnalysisEligibleTrackTotal,
    setAudioAnalysisJobId,
    setAudioAnalysisLimit,
    setAudioAnalysisOnlyMissing,
    setAudioAnalysisOverwrite,
    setAudioAnalysisProgress,
    setAudioConversionInstallProgress,
    setAudioConversionJobId,
    setAudioConversionPreview,
    setAudioConversionProgress,
    setAudioConversionSetup,
    setAutoDjAvoidRules,
    setAutoPlayOnTrackChange,
    setAutoTagPreview,
    setAutoWriteFetchedLyricsSidecars,
    setBackendCheckedAt,
    setBackendLog,
    setBackendMessage,
    setBackendStatus,
    setBulkUndoBatches,
    setBulkUndoLog,
    setBulkUndoRestoreResult,
    setCdAutoLookupMetadata,
    setCdRipSetup,
    setChromaprintSetup,
    setClapCacheDir,
    setClapInstallProgress,
    setClapMaxDuration,
    setClapModelId,
    setClapStatus,
    setClapStatusLoadMessage,
    setClapStatusLoadPercent,
    setCoffeeAnimating,
    setContinuousAutoDjBusy,
    setContinuousAutoDjEnabled,
    setContinuousAutoDjSettings,
    setCurrentRadioStation,
    setCurrentTrack,
    setDebouncedAdvancedTrackSearch,
    setDebouncedSearch,
    setDeletePrompt,
    setDetailTrack,
    setDeviceSyncPreview,
    setDuplicateActionResult,
    setDuplicateReview,
    setExternalTrackRequest,
    setFileManagementFocusToolId,
    setFileManagementScopeIds,
    setFilenameTagPreview,
    setFileOrganizationPreview,
    setFileOrganizationReport,
    setFolderPath,
    setFolderWatchStatus,
    setHasLoadedInitialLibrary,
    setHasMoreTracks,
    setHideFilePaths,
    setHistoryEvents,
    setHistoryStats,
    setImportPlaylistPath,
    setInbox,
    setIsArtistLoading,
    setIsAudioAnalyzing,
    setIsClapInstalling,
    setIsClapStatusLoading,
    setIsLibraryLoading,
    setIsLyricsLoading,
    setIsScanning,
    setLibraryAlbumScrollTop,
    setLibraryArtistScrollTop,
    setLibraryCompletionScrollTop,
    setLibraryFolders,
    setLibraryHealth,
    setLibraryPlaylistScrollTop,
    setLibraryScrollTop,
    setLibrarySort,
    setLibraryStats,
    setLibraryTotal,
    setLibraryView,
    setLibraryVisibleColumns,
    setLyrics,
    setMetadataCsvExport,
    setMetadataCsvImportPreview,
    setMetadataCsvImportReport,
    setMetadataEditInitialField,
    setMetadataEditTrack,
    setNewPlaylistName,
    setPlaybackMode,
    setPlaybackQueue,
    setPlaybackTime,
    setPlaylists,
    setQueue,
    setQueueHistory,
    setQuickStartDismissed,
    setRadioPlaybackRequestId,
    setRecommendationDrift,
    setRecommendationHistory,
    setRecommendationProfiles,
    setReportFile,
    setRestoredPlaybackPosition,
    setScanProgress,
    setScanResult,
    setSearch,
    setSelectedAlbumId,
    setSelectedAlbumTracks,
    setSelectedArtistName,
    setSelectedArtistTracks,
    setSelectedPlaylistId,
    setSelectedPlaylistTracks,
    setSettings,
    setSettingsFocusSection,
    setStartupDiagnostics,
    setStatus,
    setSupportBundlePath,
    setTagRegexPreview,
    setTargetPlaylistId,
    settings,
    settingsFocusSection,
    setTrackIndexCache,
    setTracks,
    setUiPreferences,
    setUndoAction,
    setWriteRatingsToFiles,
    showCdPage,
    showUndoAction,
    startupBackgroundHydratedRef,
    startupDiagnostics,
    startupLibrarySnapshot,
    status,
    supportBundlePath,
    tagRegexPreview,
    targetPlaylistId,
    trackIndexCache,
    trackIndexCacheRef,
    tracks,
    uiPreferences,
    undoAction,
    undoTimerRef,
    updateCachedTracks,
    validateMusicFoldersWithDesktop,
    waitForBackendStartup,
    writeRatingsToFiles,
  };
}

export type AppController = ReturnType<typeof useAppController>;
