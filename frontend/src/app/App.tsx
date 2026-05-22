import {
  Clock3,
  Coffee,
  ExternalLink,
  FileText,
  Library,
  Settings,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
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
  backupDatabase,
  cancelClapAudioAnalysis,
  clearArtistCache,
  clearLibraryCaches,
  createAutoDjAvoidRule,
  createPlaylist,
  createSmartPlaylist,
  createSupportBundle,
  deleteAutoDjAvoidRule,
  deletePlaylist,
  deleteRecommendationProfile,
  deleteSmartPlaylist,
  deleteTrack,
  exportMetadataCsv,
  exportMetadataCsvImportReport,
  exportPlaylist,
  exportQueue,
  fetchAlbumTracks,
  fetchAlbums,
  fetchArtistInfo,
  fetchArtistLocalTracks,
  fetchAutoDjAvoidRules,
  fetchBackendHealth,
  fetchBackendLog,
  fetchClapAudioAnalysis,
  fetchClapCoverage,
  fetchClapInstall,
  fetchClapStatus,
  fetchHistory,
  fetchLibraryHealth,
  fetchLibraryStats,
  fetchLyrics,
  fetchLyricsOnline,
  fetchPlaylistTracks,
  fetchPlaylists,
  fetchRecommendationHistory,
  fetchRecommendationProfiles,
  fetchScanProgress,
  fetchSettings,
  fetchSmartPlaylistPresets,
  fetchSmartPlaylistTracks,
  fetchSmartPlaylists,
  fetchStartupDiagnostics,
  fetchTrack,
  fetchTrackPage,
  generateAutoDj,
  importPlaylist,
  importMetadataCsv,
  inferFilenameTags,
  markTrackPlayed,
  markTrackSkipped,
  moveTrackInPlaylist,
  organizeFiles,
  pauseClapAudioAnalysis,
  previewSmartPlaylist,
  recordRecommendationFeedback,
  removeTrackFromPlaylist,
  restoreTrack,
  resumeClapAudioAnalysis,
  saveRecommendationProfile,
  setDefaultRecommendationProfile,
  startClapAudioAnalysis,
  startClapInstall,
  startScanLibrary,
  updateClapConfig,
  updateLyrics,
  updateSettings,
  updateTrackMetadata,
  updateTrackRating,
  applyDuplicateAction,
  exportFileOrganizationReport,
  fetchBulkUndoLog,
  fetchBulkUndoBatches,
  fetchChromaprintSetup,
  fetchDuplicateReview,
  readReportFile,
  restoreBulkUndoBatch,
  restoreBulkUndoEntry,
  runAcousticFingerprintPass,
  saveChromaprintSetup,
  installChromaprintTool,
} from "../lib/api";
import {
  placeFloatingMenu,
} from "../lib/uiInteractions";
import type {
  AlbumSummary,
  AcousticFingerprintResponse,
  ArtistInfoResponse,
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AutoDjAvoidRule,
  AutoDjSettings,
  BulkUndoLogEntry,
  BulkUndoBatchEntry,
  BulkUndoRestoreResponse,
  ChromaprintInstallResponse,
  CacheClearTarget,
  ChromaprintStatusResponse,
  ClapInstallDevice,
  ClapInstallProgress,
  ClapStatusResponse,
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  DuplicateActionRequest,
  DuplicateActionResponse,
  DuplicateReviewResponse,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  FilenameTagInferenceResponse,
  LibraryHealthResponse,
  LibraryStatsResponse,
  LogTailResponse,
  LyricsResponse,
  LyricsUpdateRequest,
  PlayEventEntry,
  PlaylistSummary,
  QueueTrack,
  RecommendationDrift,
  RecommendationProfile,
  RecommendationRun,
  ReportFileResponse,
  ScanProgress,
  ScanResult,
  SettingsResponse,
  SmartPlaylistRule,
  SmartPlaylistSummary,
  StartupDiagnosticsResponse,
  Track,
  TrackMetadataUpdate,
} from "../types/api";
import { Sidebar } from "./components/Sidebar";
import {
  DeleteTrackDialog,
  MetadataEditorModal,
} from "./components/modals";
import { AnalysisPage } from "./pages/AnalysisPage";
import { ArtistPage } from "./pages/ArtistPage";
import { AutoDjPage } from "./pages/AutoDjPage";
import { BackendRecoveryPage } from "./pages/BackendRecoveryPage";
import { FileManagementPage } from "./pages/FileManagementPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LibraryPage } from "./pages/LibraryPage";
import { NowPlayingPage } from "./pages/NowPlayingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { MiniPlayerWindow } from "./player/MiniPlayerWindow";
import { PlayerBar } from "./player/PlayerBar";
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


export default function App() {
  if (new URLSearchParams(window.location.search).get("miniPlayer") === "1") {
    return <MiniPlayerWindow />;
  }

  useRangeWheelControls();
  const [activePage, setActivePage] = useState<Page>(() => readUiPreferences().startupPage);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [autoDjAvoidRules, setAutoDjAvoidRules] = useState<AutoDjAvoidRule[]>([]);
  const [recommendationProfiles, setRecommendationProfiles] = useState<RecommendationProfile[]>([]);
  const [recommendationDrift, setRecommendationDrift] = useState<RecommendationDrift>(emptyRecommendationDrift);
  const [recommendationHistory, setRecommendationHistory] = useState<RecommendationRun[]>([]);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [writeRatingsToFiles, setWriteRatingsToFiles] = useState(false);
  const [folderPath, setFolderPath] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("unknown");
  const [backendMessage, setBackendMessage] = useState("Backend status has not been checked yet.");
  const [backendCheckedAt, setBackendCheckedAt] = useState<string | null>(null);
  const [startupDiagnostics, setStartupDiagnostics] = useState<StartupDiagnosticsResponse | null>(null);
  const [backendLog, setBackendLog] = useState<LogTailResponse | null>(null);
  const [supportBundlePath, setSupportBundlePath] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [clapStatus, setClapStatus] = useState<ClapStatusResponse | null>(null);
  const [clapModelId, setClapModelId] = useState("");
  const [clapCacheDir, setClapCacheDir] = useState("");
  const [clapMaxDuration, setClapMaxDuration] = useState(45);
  const [audioAnalysisProgress, setAudioAnalysisProgress] = useState<AudioAnalysisProgress | null>(null);
  const [audioAnalysisCoverage, setAudioAnalysisCoverage] = useState<AudioAnalysisCoverage | null>(null);
  const [audioAnalysisJobId, setAudioAnalysisJobId] = useState<string | null>(null);
  const [clapInstallProgress, setClapInstallProgress] = useState<ClapInstallProgress | null>(null);
  const [isClapInstalling, setIsClapInstalling] = useState(false);
  const [audioAnalysisLimit, setAudioAnalysisLimit] = useState(0);
  const [audioAnalysisOverwrite, setAudioAnalysisOverwrite] = useState(false);
  const [audioAnalysisOnlyMissing, setAudioAnalysisOnlyMissing] = useState(true);
  const [isAudioAnalyzing, setIsAudioAnalyzing] = useState(false);
  const [uiPreferences, setUiPreferences] = useState<UiPreferences>(readUiPreferences);
  const [quickStartDismissed, setQuickStartDismissed] = useState(readQuickStartDismissed);
  const [coffeeAnimating, setCoffeeAnimating] = useState(false);
  const [detailTrack, setDetailTrack] = useState<Track | null>(null);
  const [metadataEditTrack, setMetadataEditTrack] = useState<Track | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<DeleteTrackPrompt | null>(null);
  const [appContextMenu, setAppContextMenu] = useState<AppContextMenu | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [autoPlayOnTrackChange, setAutoPlayOnTrackChange] = useState(false);
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [queueHistory, setQueueHistory] = useState<Track[][]>([]);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("normal");
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [hasMoreTracks, setHasMoreTracks] = useState(true);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [hasLoadedInitialLibrary, setHasLoadedInitialLibrary] = useState(false);
  const [librarySort, setLibrarySort] = useState<SortState>({ key: "artist", direction: "asc" });
  const [libraryView, setLibraryView] = useState<LibraryView>("tracks");
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [smartPresets, setSmartPresets] = useState<Record<string, SmartPlaylistRule>>({});
  const [smartPlaylists, setSmartPlaylists] = useState<SmartPlaylistSummary[]>([]);
  const [selectedSmartRule, setSelectedSmartRule] = useState<SmartPlaylistRule>({ preset: "favorites", limit: 200 });
  const [smartTracks, setSmartTracks] = useState<Track[]>([]);
  const [smartPlaylistName, setSmartPlaylistName] = useState("");
  const [libraryStats, setLibraryStats] = useState<LibraryStatsResponse | null>(null);
  const [libraryHealth, setLibraryHealth] = useState<LibraryHealthResponse | null>(null);
  const [filenameTagPreview, setFilenameTagPreview] = useState<FilenameTagInferenceResponse | null>(null);
  const [fileOrganizationPreview, setFileOrganizationPreview] = useState<FileOrganizationResponse | null>(null);
  const [fileOrganizationReport, setFileOrganizationReport] = useState<FileOrganizationReportResponse | null>(null);
  const [metadataCsvExport, setMetadataCsvExport] = useState<CsvMetadataExportResponse | null>(null);
  const [metadataCsvImportPreview, setMetadataCsvImportPreview] = useState<CsvMetadataImportResponse | null>(null);
  const [metadataCsvImportReport, setMetadataCsvImportReport] = useState<CsvMetadataImportReportResponse | null>(null);
  const [duplicateActionResult, setDuplicateActionResult] = useState<DuplicateActionResponse | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<DuplicateReviewResponse | null>(null);
  const [chromaprintSetup, setChromaprintSetup] = useState<ChromaprintStatusResponse | null>(null);
  const [chromaprintInstallResult, setChromaprintInstallResult] = useState<ChromaprintInstallResponse | null>(null);
  const [acousticFingerprintResult, setAcousticFingerprintResult] = useState<AcousticFingerprintResponse | null>(null);
  const [bulkUndoLog, setBulkUndoLog] = useState<BulkUndoLogEntry[]>([]);
  const [bulkUndoBatches, setBulkUndoBatches] = useState<BulkUndoBatchEntry[]>([]);
  const [bulkUndoRestoreResult, setBulkUndoRestoreResult] = useState<BulkUndoRestoreResponse | null>(null);
  const [reportFile, setReportFile] = useState<ReportFileResponse | null>(null);
  const [historyEvents, setHistoryEvents] = useState<PlayEventEntry[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [selectedAlbumTracks, setSelectedAlbumTracks] = useState<Track[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<Track[]>([]);
  const [targetPlaylistId, setTargetPlaylistId] = useState<number | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [importPlaylistPath, setImportPlaylistPath] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [lyrics, setLyrics] = useState<LyricsResponse | null>(null);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [artistInfo, setArtistInfo] = useState<ArtistInfoResponse | null>(null);
  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [isArtistLoading, setIsArtistLoading] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [libraryScrollTop, setLibraryScrollTop] = useState(0);
  const libraryRequestId = useRef(0);
  const undoTimerRef = useRef<number | null>(null);
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
    for (const list of [tracks, selectedAlbumTracks, selectedPlaylistTracks, smartTracks, playbackQueue, queue, currentTrack ? [currentTrack] : [], detailTrack ? [detailTrack] : []]) {
      for (const track of list) {
        if (wanted.has(track.id) && !found.has(track.id)) {
          found.set(track.id, track);
        }
      }
    }
    return trackIds.map((trackId) => found.get(trackId)).filter((track): track is Track => Boolean(track));
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
      await Promise.all([refreshTracks(), loadAlbums(), loadPlaylists(), loadLibraryStats(), loadClapCoverage()]);
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
      target?.closest("input, textarea, select, [contenteditable='true'], [data-allow-native-context='true']")
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

  async function loadTracksPage(reset: boolean) {
    if (isLibraryLoading && !reset) {
      return;
    }
    const requestId = ++libraryRequestId.current;
    const offset = reset ? 0 : tracks.length;
    if (reset) {
      setTracks([]);
      setHasMoreTracks(true);
    }
    setIsLibraryLoading(true);
    try {
      const response = await fetchTrackPage({
        search: debouncedSearch,
        limit: LIBRARY_PAGE_SIZE,
        offset,
        sortBy: librarySort.key,
        sortDirection: librarySort.direction,
      });
      if (requestId !== libraryRequestId.current) {
        return;
      }
      setTracks((current) => (reset ? response.tracks : [...current, ...response.tracks]));
      setLibraryTotal(response.total);
      setHasMoreTracks(response.offset + response.tracks.length < response.total);
      const loadedCount = reset ? response.tracks.length : offset + response.tracks.length;
      setStatus(`Loaded ${loadedCount.toLocaleString()} of ${response.total.toLocaleString()} tracks`);
    } catch (error) {
      if (requestId === libraryRequestId.current) {
        setStatus(error instanceof Error ? error.message : "Could not load tracks");
      }
    } finally {
      if (requestId === libraryRequestId.current) {
        setIsLibraryLoading(false);
        if (reset) {
          setHasLoadedInitialLibrary(true);
        }
      }
    }
  }

  async function refreshTracks() {
    await loadTracksPage(true);
  }

  async function loadMoreTracks() {
    if (hasMoreTracks) {
      await loadTracksPage(false);
    }
  }

  async function loadAlbums() {
    try {
      const response = await fetchAlbums(debouncedSearch);
      setAlbums(response);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load albums");
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

  async function loadSmartPlaylists() {
    try {
      const [presets, saved] = await Promise.all([fetchSmartPlaylistPresets(), fetchSmartPlaylists()]);
      setSmartPresets(presets);
      setSmartPlaylists(saved);
      if (Object.keys(presets).length && smartTracks.length === 0) {
        await handlePreviewSmartRule(selectedSmartRule);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load smart playlists");
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

  async function loadHistory() {
    try {
      const [events, stats] = await Promise.all([fetchHistory(), fetchLibraryStats()]);
      setHistoryEvents(events);
      setLibraryStats(stats);
    } catch (error) {
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
      setFolderPath(response.library_path ?? "");
      setWriteRatingsToFiles(response.write_ratings_to_files);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load settings");
    }
  }

  async function loadStartupDiagnostics(showToast = false) {
    try {
      const response = await fetchStartupDiagnostics();
      setStartupDiagnostics(response);
      if (showToast) {
        setStatus(response.ok ? "Startup self-check passed" : "Startup self-check found issues");
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

  async function handleWriteRatingsToFiles(value: boolean) {
    const previous = writeRatingsToFiles;
    setWriteRatingsToFiles(value);
    try {
      const response = await updateSettings({ write_ratings_to_files: value });
      setSettings(response);
      setWriteRatingsToFiles(response.write_ratings_to_files);
      setStatus(value ? "Star ratings will be written to audio files" : "Star ratings will stay in the database");
    } catch (error) {
      setWriteRatingsToFiles(previous);
      setStatus(error instanceof Error ? error.message : "Could not update rating write setting");
    }
  }

  function applyClapStatus(response: ClapStatusResponse) {
    setClapStatus(response);
    setClapModelId(response.model_id);
    setClapCacheDir(response.cache_dir);
    setClapMaxDuration(response.max_duration_seconds);
  }

  async function loadClapStatus() {
    try {
      applyClapStatus(await fetchClapStatus());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load CLAP status");
    }
  }

  async function loadClapCoverage() {
    try {
      setAudioAnalysisCoverage(await fetchClapCoverage());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load CLAP coverage");
    }
  }

  async function refreshAnalyzedState(trackIds?: number[]) {
    await refreshTracks();
    await loadAlbums();
    await loadLibraryStats();
    await loadClapCoverage();

    const detailId = detailTrack?.id;
    const currentId = currentTrack?.id;
    const idsToRefresh = Array.from(
      new Set(
        [detailId, currentId, ...(trackIds ?? [])].filter(
          (trackId): trackId is number => typeof trackId === "number",
        ),
      ),
    );
    await Promise.all(
      idsToRefresh.map(async (trackId) => {
        try {
          replaceTrackEverywhere(await fetchTrack(trackId));
        } catch {
          // Track may have been removed during a rescan.
        }
      }),
    );
  }

  async function handleSaveClapConfig() {
    try {
      const response = await updateClapConfig({
        model_id: clapModelId.trim() || null,
        cache_dir: clapCacheDir.trim() || null,
        max_duration_seconds: clapMaxDuration,
      });
      applyClapStatus(response);
      setStatus(response.message ?? "CLAP configuration saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save CLAP configuration");
    }
  }

  async function handleInstallClap(device: ClapInstallDevice, force = false) {
    if (isClapInstalling) {
      return;
    }
    setIsClapInstalling(true);
    setClapInstallProgress(null);
    setStatus(device === "cuda" ? "Installing NVIDIA CUDA ML runtime" : "Installing CPU ML runtime");
    try {
      const started = await startClapInstall({ device, force });
      let latest: ClapInstallProgress | null = null;
      let lastInstallMessage = "";
      const setInstallStatus = (message: string) => {
        if (message !== lastInstallMessage) {
          lastInstallMessage = message;
          setStatus(message);
        }
      };
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        latest = await fetchClapInstall(started.job_id);
        setClapInstallProgress(latest);
        setInstallStatus(latest.message ?? "Installing CLAP ML runtime");
        if (isClapInstallTerminal(latest.status)) {
          break;
        }
      }
      if (latest.status === "failed") {
        setStatus(latest.error ?? "CLAP install failed");
        return;
      }
      setStatus("CLAP ML runtime installed");
      await loadClapStatus();
      await loadClapCoverage();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CLAP install failed");
    } finally {
      setIsClapInstalling(false);
    }
  }

  async function handleAnalyzeAudio(trackIds?: number[]) {
    if (isAudioAnalyzing) {
      return;
    }
    const targetedTrackIds = trackIds?.length ? Array.from(new Set(trackIds)) : null;
    setIsAudioAnalyzing(true);
    setAudioAnalysisProgress(null);
    setAudioAnalysisJobId(null);
    try {
      const started = await startClapAudioAnalysis({
        limit: targetedTrackIds ? targetedTrackIds.length : audioAnalysisLimit > 0 ? audioAnalysisLimit : null,
        overwrite: targetedTrackIds ? true : audioAnalysisOverwrite,
        only_missing: targetedTrackIds ? false : audioAnalysisOnlyMissing,
        track_ids: targetedTrackIds,
      });
      setAudioAnalysisJobId(started.job_id);
      let latest: AudioAnalysisProgress | null = null;
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        latest = await fetchClapAudioAnalysis(started.job_id);
        setAudioAnalysisProgress(latest);
        if (latest.message) {
          setStatus(latest.message);
        } else if (latest.total_tracks > 0) {
          setStatus(
            `Analyzing ${latest.processed_tracks}/${latest.total_tracks} tracks - ETA ${formatTime(
              latest.eta_seconds,
            )}`,
          );
        } else {
          setStatus("Preparing CLAP audio analysis");
        }
        if (isAnalysisTerminal(latest.status)) {
          break;
        }
      }
      if (latest.status === "failed") {
        setStatus(latest.error ?? "CLAP audio analysis failed");
        return;
      }
      if (latest.status === "canceled") {
        setStatus("CLAP audio analysis canceled");
        await loadClapCoverage();
        return;
      }
      setStatus(`Analyzed ${latest.analyzed} tracks with CLAP`);
      await refreshAnalyzedState(targetedTrackIds ?? undefined);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CLAP audio analysis failed");
    } finally {
      setIsAudioAnalyzing(false);
      setAudioAnalysisJobId(null);
    }
  }

  function handleAnalyzeTracks(trackIds: number[]) {
    if (trackIds.length > 0) {
      void handleAnalyzeAudio(trackIds);
    }
  }

  async function handlePauseAudioAnalysis() {
    if (!audioAnalysisJobId) {
      return;
    }
    try {
      const latest = await pauseClapAudioAnalysis(audioAnalysisJobId);
      setAudioAnalysisProgress(latest);
      setStatus(latest.message ?? "CLAP analysis paused");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not pause CLAP analysis");
    }
  }

  async function handleResumeAudioAnalysis() {
    if (!audioAnalysisJobId) {
      return;
    }
    try {
      const latest = await resumeClapAudioAnalysis(audioAnalysisJobId);
      setAudioAnalysisProgress(latest);
      setStatus(latest.message ?? "CLAP analysis resumed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not resume CLAP analysis");
    }
  }

  async function handleCancelAudioAnalysis() {
    if (!audioAnalysisJobId) {
      return;
    }
    try {
      const latest = await cancelClapAudioAnalysis(audioAnalysisJobId);
      setAudioAnalysisProgress(latest);
      setStatus(latest.message ?? "Canceling CLAP analysis");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not cancel CLAP analysis");
    }
  }

  async function handleScan(pathOverride?: string) {
    const targetPath = (pathOverride ?? folderPath).trim();
    if (!targetPath) {
      setStatus("Enter a music folder path");
      return;
    }
    setStatus("Starting library scan");
    setIsScanning(true);
    setScanResult(null);
    setScanProgress(null);
    try {
      const started = await startScanLibrary(targetPath);
      let latest: ScanProgress | null = null;

      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        latest = await fetchScanProgress(started.job_id);
        setScanProgress(latest);

        if (latest.status === "cleaning") {
          setStatus(`Removing missing tracks (${latest.removed} found)`);
        } else if (latest.total_files > 0) {
          setStatus(
            `Scanning ${latest.processed_files}/${latest.total_files} files - ETA ${formatTime(
              latest.eta_seconds,
            )}`,
          );
        } else {
          setStatus("Finding audio files");
        }

        if (latest.status === "completed" || latest.status === "failed") {
          break;
        }
      }

      if (latest.status === "failed") {
        setStatus(latest.error ?? "Scan failed");
        return;
      }

      const result = {
        folder_path: latest.folder_path,
        scanned_files: latest.total_files,
        inserted: latest.inserted,
        updated: latest.updated,
        removed: latest.removed,
        skipped: latest.skipped,
        errors: latest.errors,
      };
      setScanResult(result);
      setFolderPath(result.folder_path);
      setStatus(
        `Scan complete: ${result.inserted} inserted, ${result.updated} updated, ${result.removed} removed, ${result.skipped} skipped`,
      );
      await refreshTracks();
      await loadAlbums();
      await loadPlaylists();
      await loadSmartPlaylists();
      await loadLibraryStats();
      await loadClapCoverage();
      await loadSettings();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleBrowseFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select music folder",
      });

      if (typeof selected === "string") {
        setFolderPath(selected);
        setStatus(`Selected ${selected}`);
      } else {
        setStatus("Folder selection canceled");
      }
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a folder path here in browser mode.");
    }
  }

  async function handleChooseMusicFolderAndScan() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select music folder",
      });

      if (typeof selected !== "string") {
        setStatus("Folder selection canceled");
        return;
      }

      setFolderPath(selected);
      await handleScan(selected);
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a folder path in Settings in browser mode.");
    }
  }

  async function handleUseSuggestedFolder(path: string) {
    setFolderPath(path);
    await handleScan(path);
  }

  async function handleRating(trackId: number, rating: number | null) {
    const previous = tracks;
    setTracks((current) =>
      current.map((track) => (track.id === trackId ? { ...track, rating } : track)),
    );
    try {
      const updated = await updateTrackRating(trackId, rating);
      replaceTrackEverywhere(updated);
      setStatus("Rating saved");
    } catch (error) {
      setTracks(previous);
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
    setTracks((current) => current.map(replace));
    setSelectedAlbumTracks((current) => current.map(replace));
    setSelectedPlaylistTracks((current) => current.map(replace));
    setPlaybackQueue((current) => current.map(replace));
    setQueue((current) => current.map((track) => (track.id === updated.id ? { ...track, ...updated } : track)));
    setCurrentTrack((current) => (current?.id === updated.id ? updated : current));
    setDetailTrack((current) => (current?.id === updated.id ? updated : current));
    setMetadataEditTrack((current) => (current?.id === updated.id ? updated : current));
  }

  function removeTrackEverywhere(trackId: number) {
    const remove = (track: Track) => track.id !== trackId;
    setTracks((current) => current.filter(remove));
    setSelectedAlbumTracks((current) => current.filter(remove));
    setSelectedPlaylistTracks((current) => current.filter(remove));
    setSmartTracks((current) => current.filter(remove));
    setPlaybackQueue((current) => current.filter(remove));
    setQueue((current) => current.filter((track) => track.id !== trackId));
    setLibraryTotal((current) => Math.max(0, current - 1));
    setCurrentTrack((current) => (current?.id === trackId ? null : current));
    setDetailTrack((current) => (current?.id === trackId ? null : current));
    setMetadataEditTrack((current) => (current?.id === trackId ? null : current));
  }

  async function handleDeleteTrack(trackId: number, deleteFile: boolean) {
    const snapshot = findTracksByIds([trackId]);
    try {
      const response = await deleteTrack(trackId, deleteFile);
      removeTrackEverywhere(trackId);
      await Promise.all([loadAlbums(), loadPlaylists(), loadLibraryStats(), loadClapCoverage()]);
      if (response.deleted_file) {
        setStatus("Deleted file and removed track from library");
      } else if (response.file_missing) {
        setStatus("Removed missing track from library");
      } else {
        if (snapshot.length > 0) {
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
    const snapshot = findTracksByIds(uniqueIds);
    try {
      let deletedFiles = 0;
      let missingFiles = 0;
      for (const trackId of uniqueIds) {
        const response = await deleteTrack(trackId, deleteFile);
        if (response.deleted_file) {
          deletedFiles += 1;
        }
        if (response.file_missing) {
          missingFiles += 1;
        }
        removeTrackEverywhere(trackId);
      }
      await Promise.all([loadAlbums(), loadPlaylists(), loadLibraryStats(), loadClapCoverage()]);
      if (!deleteFile && snapshot.length > 0 && missingFiles === 0) {
        showUndoAction({
          type: "library-remove",
          label: `${snapshot.length} track${snapshot.length === 1 ? "" : "s"}`,
          tracks: snapshot,
        });
      }
      setStatus(
        deletedFiles > 0
          ? `Deleted ${deletedFiles} files and removed ${uniqueIds.length} tracks`
          : `Removed ${uniqueIds.length} tracks from library`,
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
      await Promise.all([loadAlbums(), loadLibraryStats()]);
      setMetadataEditTrack(null);
      setStatus(writeRatingsToFiles ? "Metadata saved to library and file" : "Metadata saved to library");
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
      await Promise.all([loadAlbums(), loadLibraryStats()]);
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

  async function handleAddTracksToPlaylist(trackIds: number[]) {
    if (!targetPlaylistId) {
      setStatus("Choose a target playlist first");
      return;
    }
    try {
      const updatedTracks = await addTracksToPlaylist(targetPlaylistId, trackIds);
      if (selectedPlaylistId === targetPlaylistId) {
        setSelectedPlaylistTracks(updatedTracks);
      }
      await loadPlaylists();
      setStatus(`Added ${trackIds.length} track${trackIds.length === 1 ? "" : "s"} to playlist`);
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
      setStatus("Enter an .m3u playlist path");
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

  async function handlePreviewSmartRule(rule: SmartPlaylistRule) {
    try {
      setSelectedSmartRule(rule);
      setSmartTracks(await previewSmartPlaylist(rule));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview smart playlist");
    }
  }

  async function handleCreateSmartPlaylist() {
    const name = smartPlaylistName.trim();
    if (!name) {
      setStatus("Enter a smart playlist name");
      return;
    }
    try {
      const created = await createSmartPlaylist(name, selectedSmartRule);
      setSmartPlaylistName("");
      await loadSmartPlaylists();
      await handleSelectSmartPlaylist(created.id);
      setStatus(`Saved smart playlist ${created.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save smart playlist");
    }
  }

  async function handleDeleteSmartPlaylist(smartPlaylistId: number) {
    try {
      setSmartPlaylists(await deleteSmartPlaylist(smartPlaylistId));
      setStatus("Smart playlist deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete smart playlist");
    }
  }

  async function handleSelectSmartPlaylist(smartPlaylistId: number) {
    try {
      const selected = smartPlaylists.find((playlist) => playlist.id === smartPlaylistId);
      if (selected) {
        setSelectedSmartRule(selected.rule);
      }
      setSmartTracks(await fetchSmartPlaylistTracks(smartPlaylistId));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load smart playlist");
    }
  }

  function handleShuffleTracks(sourceTracks: Track[]) {
    const shuffled = shuffleItems(sourceTracks);
    if (!shuffled.length) {
      setStatus("No tracks to shuffle");
      return;
    }
    setPlaybackQueue(shuffled);
    setAutoPlayOnTrackChange(true);
    setCurrentTrack(shuffled[0]);
    setStatus(`Shuffled ${shuffled.length} tracks`);
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
      if (response.tracks[0]) {
        setPlaybackQueue(response.tracks);
        setAutoPlayOnTrackChange(true);
        setCurrentTrack(response.tracks[0]);
      }
      setStatus(`Generated ${response.tracks.length} AutoDJ tracks`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not generate AutoDJ");
    }
  }

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
    void recordRecommendationFeedback({ track_id: track.id, event_type: eventType, weight }).catch(() => {
      // Recommendation feedback is a soft learning signal; playback should never wait on it.
    });
  }

  async function recordTrackExitQuiet(track: Track, listenedSeconds: number) {
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

  function handlePlayTrack(track: Track, queueItems: Track[], options?: { suppressExitRecord?: boolean }) {
    if (!options?.suppressExitRecord && currentTrack && currentTrack.id !== track.id) {
      void recordTrackExitQuiet(currentTrack, playbackTime);
    }
    setPlaybackQueue(queueItems);
    setAutoPlayOnTrackChange(true);
    setCurrentTrack(track);
    rememberRecommendationFeedback(track, "manual_play", 0.7);
    setStatus(`Playing ${display(track.title, "track")}`);
  }

  function handlePlayNext(track: Track) {
    setPlaybackQueue((current) => {
      const baseQueue = current.length ? current : currentTrack ? [currentTrack] : [];
      const withoutTrack = baseQueue.filter((item) => item.id !== track.id);
      const activeIndex = currentTrack ? withoutTrack.findIndex((item) => item.id === currentTrack.id) : -1;
      const insertAt = activeIndex >= 0 ? activeIndex + 1 : 0;
      return [...withoutTrack.slice(0, insertAt), track, ...withoutTrack.slice(insertAt)];
    });
    if (!currentTrack) {
      setAutoPlayOnTrackChange(false);
      setCurrentTrack(track);
    }
    rememberRecommendationFeedback(track, "play_next", 1.4);
    setStatus(`Queued ${display(track.title, "track")} next`);
  }

  function handleAddToQueue(track: Track) {
    setPlaybackQueue((current) => (current.some((item) => item.id === track.id) ? current : [...current, track]));
    if (!currentTrack) {
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
    try {
      const updated = await markTrackPlayed(trackId);
      replaceTrackEverywhere(updated);
      void loadHistory();
    } catch {
      setStatus("Playback finished, but play history could not be saved.");
    }
  }

  async function handleTrackSkipped(trackId: number) {
    try {
      const updated = await markTrackSkipped(trackId);
      replaceTrackEverywhere(updated);
      void loadHistory();
      setStatus("Skip saved");
    } catch {
      setStatus("Skip could not be saved.");
    }
  }

  async function handleFetchLyrics(trackId: number): Promise<LyricsResponse> {
    try {
      const response = await fetchLyricsOnline(trackId);
      setLyrics(response);
      setStatus(response.is_synced ? "Fetched synced lyrics" : "Fetched lyrics");
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not fetch lyrics";
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
      await Promise.all([refreshTracks(), loadAlbums(), loadLibraryStats()]);
      setStatus(`Applied inferred tags to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not apply inferred tags");
    }
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
      setStatus(`${response.changed_count.toLocaleString()} of ${response.total.toLocaleString()} previewed tracks would move`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview file organization");
    }
  }

  async function handleApplyFileOrganization(
    template: string,
    baseFolder?: string | null,
    options?: { collisionStrategy?: "skip" | "auto_rename"; cleanupEmptyFolders?: boolean; trackIds?: number[] | null },
  ) {
    if (!window.confirm("Move audio files on disk and update FLAC Cafe paths? Preview first and make sure the target folder is right.")) {
      return;
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
      await Promise.all([refreshTracks(), loadAlbums(), loadLibraryStats()]);
      const cleanup = response.removed_empty_folders
        ? ` and removed ${response.removed_empty_folders.toLocaleString()} empty folder${response.removed_empty_folders === 1 ? "" : "s"}`
        : "";
      setStatus(`Moved ${response.applied.toLocaleString()} file${response.applied === 1 ? "" : "s"}${cleanup}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not organize files");
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

  async function handleExportMetadataCsv(trackIds?: number[] | null) {
    try {
      const response = await exportMetadataCsv({ track_ids: trackIds?.length ? trackIds : null, limit: 200000 });
      setMetadataCsvExport(response);
      setStatus(`Exported ${response.track_count.toLocaleString()} tracks to ${response.csv_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export metadata CSV");
    }
  }

  async function handlePreviewMetadataCsv(
    csvPath: string,
    missingOnly: boolean,
    options?: { trackIds?: number[] | null; columnMap?: Record<string, string>; clearBlankFields?: boolean },
  ) {
    const trimmedPath = csvPath.trim();
    if (!trimmedPath) {
      setStatus("Choose a CSV path first");
      return;
    }
    try {
      const response = await importMetadataCsv({
        csv_path: trimmedPath,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        column_map: options?.columnMap ?? {},
        missing_only: missingOnly,
        clear_blank_fields: options?.clearBlankFields ?? false,
        apply: false,
        limit: 10000,
      });
      setMetadataCsvImportPreview(response);
      setStatus(`${response.changed.toLocaleString()} of ${response.matched.toLocaleString()} matched rows would change`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview metadata CSV");
    }
  }

  async function handleApplyMetadataCsv(
    csvPath: string,
    missingOnly: boolean,
    options?: { trackIds?: number[] | null; columnMap?: Record<string, string>; clearBlankFields?: boolean },
  ) {
    const trimmedPath = csvPath.trim();
    if (!trimmedPath) {
      setStatus("Choose a CSV path first");
      return;
    }
    if (!window.confirm("Import CSV metadata into the library? File writing follows the current write-tags setting.")) {
      return;
    }
    try {
      const response = await importMetadataCsv({
        csv_path: trimmedPath,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        column_map: options?.columnMap ?? {},
        missing_only: missingOnly,
        clear_blank_fields: options?.clearBlankFields ?? false,
        apply: true,
        limit: 10000,
      });
      setMetadataCsvImportPreview(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadLibraryStats()]);
      setStatus(`Applied CSV metadata to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import metadata CSV");
    }
  }

  async function handleExportMetadataCsvReport(
    csvPath: string,
    missingOnly: boolean,
    options?: { trackIds?: number[] | null; columnMap?: Record<string, string>; clearBlankFields?: boolean },
  ) {
    const trimmedPath = csvPath.trim();
    if (!trimmedPath) {
      setStatus("Choose a CSV path first");
      return;
    }
    try {
      const response = await exportMetadataCsvImportReport({
        csv_path: trimmedPath,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        column_map: options?.columnMap ?? {},
        missing_only: missingOnly,
        clear_blank_fields: options?.clearBlankFields ?? false,
        apply: false,
        limit: 10000,
      });
      setMetadataCsvImportReport(response);
      setStatus(`Exported CSV dry-run report to ${response.report_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export CSV report");
    }
  }

  async function handleDuplicateAction(request: DuplicateActionRequest) {
    if (request.action !== "export_report") {
      const count = request.groups?.length
        ? request.groups.reduce((total, group) => total + group.length, 0)
        : request.track_ids?.length ?? 0;
      const deleteWarning = request.delete_files ? " This will also delete selected audio files from disk." : "";
      if (!window.confirm(`Apply duplicate action to ${count.toLocaleString()} track references?${deleteWarning}`)) {
        return;
      }
    }
    try {
      const response = await applyDuplicateAction(request);
      setDuplicateActionResult(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadLibraryStats(), loadBulkUndoLog()]);
      if (response.report_path) {
        setStatus(`Exported duplicate report to ${response.report_path}`);
      } else {
        setStatus(`Duplicate action affected ${response.affected.toLocaleString()} track${response.affected === 1 ? "" : "s"}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not apply duplicate action");
    }
  }

  async function handleLoadDuplicateReview(trackIds: number[], groups: number[][]) {
    try {
      const response = await fetchDuplicateReview({
        track_ids: trackIds,
        groups,
        limit: 1000,
      });
      setDuplicateReview(response);
      setStatus(
        `Loaded ${response.tracks.length.toLocaleString()} review track${response.tracks.length === 1 ? "" : "s"}`
          + (response.missing_track_ids.length ? `; ${response.missing_track_ids.length.toLocaleString()} missing IDs` : ""),
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load duplicate review");
    }
  }

  async function handleRevealTracksByIds(trackIds: number[]) {
    const uniqueIds = Array.from(new Set(trackIds)).slice(0, 30);
    let foundTracks = findTracksByIds(uniqueIds);
    if (foundTracks.length < uniqueIds.length) {
      try {
        const response = await fetchDuplicateReview({ track_ids: uniqueIds, limit: uniqueIds.length });
        const byId = new Map(foundTracks.map((track) => [track.id, track]));
        for (const track of response.tracks) {
          byId.set(track.id, track);
        }
        foundTracks = uniqueIds.map((trackId) => byId.get(trackId)).filter((track): track is Track => Boolean(track));
        setDuplicateReview(response);
      } catch {
        // Fall back to the tracks already loaded in the UI.
      }
    }
    if (!foundTracks.length) {
      setStatus("Those track IDs were not found in the library.");
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      for (const track of foundTracks) {
        await invoke("reveal_in_file_explorer", { path: track.path });
      }
      setStatus(`Opened ${foundTracks.length.toLocaleString()} track location${foundTracks.length === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reveal in Explorer is available in the desktop app.");
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

  async function handleInstallChromaprintTool() {
    if (!window.confirm("Download Chromaprint fpcalc from the official AcoustID GitHub release and install it into FLAC Cafe's local tool folder?")) {
      return;
    }
    try {
      setStatus("Downloading Chromaprint fpcalc...");
      const response = await installChromaprintTool();
      setChromaprintInstallResult(response);
      await loadChromaprintSetup();
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not install Chromaprint");
    }
  }

  async function handleRunAcousticFingerprintPass(trackIds: number[] | null, overwrite: boolean, limit: number) {
    try {
      const response = await runAcousticFingerprintPass({
        track_ids: trackIds?.length ? trackIds : null,
        overwrite,
        limit,
      });
      setAcousticFingerprintResult(response);
      await loadChromaprintSetup();
      await Promise.all([refreshTracks(), loadLibraryStats()]);
      setStatus(
        response.tool_available
          ? `Updated ${response.updated.toLocaleString()} acoustic fingerprint${response.updated === 1 ? "" : "s"}`
          : response.errors[0] ?? "Acoustic fingerprint tool is not available",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not run acoustic fingerprint pass");
    }
  }

  async function loadBulkUndoLog() {
    try {
      setBulkUndoLog(await fetchBulkUndoLog(50));
      setBulkUndoBatches(await fetchBulkUndoBatches(30));
    } catch {
      setBulkUndoLog([]);
      setBulkUndoBatches([]);
    }
  }

  async function handleRestoreBulkUndoEntry(entryId: number) {
    if (!window.confirm("Restore this bulk action? This may move files or rewrite metadata back to the previous values.")) {
      return;
    }
    try {
      const response = await restoreBulkUndoEntry(entryId);
      setBulkUndoRestoreResult(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(
        response.restored
          ? `Restored undo entry ${entryId}`
          : response.errors[0] ?? `Could not restore undo entry ${entryId}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not restore undo entry");
    }
  }

  async function handleRestoreBulkUndoBatch(batchId: string) {
    if (!window.confirm("Restore this entire bulk-action batch? This can move files or rewrite metadata back to the previous values.")) {
      return;
    }
    try {
      const response = await restoreBulkUndoBatch(batchId);
      setBulkUndoRestoreResult(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(
        response.restored
          ? `Restored batch ${batchId}`
          : response.errors[0] ?? `Could not restore batch ${batchId}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not restore undo batch");
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
    void loadSettings();
    void checkBackendStatus(false);
    void loadStartupDiagnostics(false);
    void loadClapStatus();
    void loadClapCoverage();
    try {
      const raw = window.localStorage.getItem(storageKeys.lastSession) ?? window.localStorage.getItem(legacyStorageKeys.lastSession);
      if (raw) {
        const session = JSON.parse(raw) as { currentTrackId?: number; queueIds?: number[] };
        const ids = Array.from(new Set([...(session.queueIds ?? []), session.currentTrackId].filter(Boolean) as number[]));
        if (ids.length) {
          void Promise.all(ids.slice(0, 200).map((id) => fetchTrack(id)))
            .then((restored) => {
              const byId = new Map(restored.map((track) => [track.id, track]));
              const queueItems = (session.queueIds ?? []).map((id) => byId.get(id)).filter((track): track is Track => Boolean(track));
              const restoredCurrent = session.currentTrackId ? byId.get(session.currentTrackId) ?? null : null;
              if (queueItems.length) {
                setPlaybackQueue(queueItems);
              }
              if (restoredCurrent) {
                setCurrentTrack(restoredCurrent);
              }
            })
            .catch(() => {
              window.localStorage.removeItem(storageKeys.lastSession);
              window.localStorage.removeItem(legacyStorageKeys.lastSession);
            });
        }
      }
    } catch {
      // Last-session restore is best effort only.
    }
  }, []);

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
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKeys.lastSession,
        JSON.stringify({
          currentTrackId: currentTrack?.id ?? null,
          queueIds: playbackQueue.map((track) => track.id).slice(0, 200),
        }),
      );
    } catch {
      // Ignore local storage failures.
    }
  }, [currentTrack?.id, playbackQueue]);

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
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    void refreshTracks();
  }, [debouncedSearch, librarySort]);

  useEffect(() => {
    void loadAlbums();
  }, [debouncedSearch]);

  useEffect(() => {
    void loadPlaylists();
  }, []);

  useEffect(() => {
    void loadSmartPlaylists();
    void loadLibraryStats();
    void loadHistory();
    void loadAutoDjAvoidRules();
    void loadRecommendationProfiles();
    void loadRecommendationHistory();
    void loadBulkUndoLog();
    void loadChromaprintSetup();
  }, []);

  useEffect(() => {
    if (libraryView === "health") {
      void loadLibraryStats();
    }
  }, [libraryView]);

  useEffect(() => {
    if (activePage === "history") {
      void loadHistory();
    }
    if (activePage === "fileManagement") {
      void loadBulkUndoLog();
      void loadChromaprintSetup();
    }
  }, [activePage]);

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
        ["history", "page.history"],
        ["autodj", "page.autodj"],
        ["fileManagement", "page.fileManagement"],
        ["settings", "page.settings"],
      ];
      const match = shortcuts.find(([, action]) => shortcutMatchesEvent(uiPreferences.keyboardShortcuts[action], event));
      if (match) {
        event.preventDefault();
        setActivePage(match[0]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uiPreferences.keyboardShortcuts]);

  useEffect(() => {
    if (!selectedAlbumId && albums[0]) {
      void handleSelectAlbum(albums[0].id);
    }
  }, [albums, selectedAlbumId]);

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

    setIsLyricsLoading(true);
    void fetchLyrics(currentTrack.id)
      .then((response) => {
        if (!cancelled) {
          setLyrics(response);
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
  }, [currentTrack?.id]);

  useEffect(() => {
    if (activePage !== "artist") {
      return;
    }
    void loadArtistInfo(false);
  }, [activePage, currentTrack?.artist, uiPreferences.enableArtistLookup]);

  return (
    <div className="flex h-screen overflow-hidden bg-ink text-neutral-100" onContextMenu={openAppContextMenu}>
      {uiPreferences.showToasts && status && (
        <div className="fixed right-5 top-5 z-50 max-w-md rounded border border-line bg-panel px-4 py-3 text-sm text-white shadow-xl">
          {status}
        </div>
      )}
      {undoAction && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded border border-line bg-[rgb(var(--color-popover))] px-4 py-3 text-sm text-white shadow-2xl">
          <span className="text-muted">Removed {undoAction.label}</span>
          <button className="text-moss hover:text-white" type="button" onClick={() => void handleUndoAction()}>
            Undo
          </button>
          <button className="text-muted hover:text-white" type="button" onClick={() => setUndoAction(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {metadataEditTrack && (
        <MetadataEditorModal
          track={metadataEditTrack}
          writeToFiles={writeRatingsToFiles}
          onWriteToFilesChange={(value) => void handleWriteRatingsToFiles(value)}
          onClose={() => setMetadataEditTrack(null)}
          onSave={handleSaveTrackMetadata}
        />
      )}
      {deletePrompt && (
        <DeleteTrackDialog
          prompt={deletePrompt}
          onCancel={() => setDeletePrompt(null)}
          onConfirm={confirmDeleteTracks}
        />
      )}
      {appContextMenu && (
        <div
          className="fixed z-[80] w-56 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
          style={{ left: appContextMenu.x, top: appContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {(
            [
              ["library", "Library", Library],
              ["nowPlaying", "Now Playing", FileText],
              ["autodj", "AutoDJ", Wand2],
              ["artist", "Artist", UserRound],
              ["history", "History", Clock3],
              ["settings", "Settings", Settings],
            ] as const
          ).map(([page, label, Icon]) => (
            <button
              key={page}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-neutral-200 hover:bg-white/10 hover:text-white"
              type="button"
              onClick={() => {
                setActivePage(page);
                setAppContextMenu(null);
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-neutral-200 hover:bg-white/10 hover:text-white"
            type="button"
            onClick={() => {
              setAppContextMenu(null);
              void handleOpenDetachedMiniPlayer();
            }}
          >
            <ExternalLink size={15} />
            Mini Player
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-neutral-200 hover:bg-white/10 hover:text-white"
            type="button"
            onClick={() => {
              setAppContextMenu(null);
              handleCycleTheme();
            }}
          >
            <Coffee size={15} />
            Cycle Theme
          </button>
        </div>
      )}
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        hasDiagnosticsIssue={backendStatus === "down"}
        hasAnalysisIssue={Boolean(
          clapStatus &&
            ((clapStatus.runtime_exists && !clapStatus.installed) ||
              Object.keys(clapStatus.dependency_errors ?? {}).length > 0),
        )}
        coffeeAnimating={coffeeAnimating}
        onCoffeeClick={handleCoffeeClick}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex flex-1">
          {backendStatus === "down" ? (
            <BackendRecoveryPage
              backendMessage={backendMessage}
              backendCheckedAt={backendCheckedAt}
              onCheckBackend={() => void checkBackendStatus(true)}
              onRestartBackend={() => void handleRestartBackend()}
              onOpenBackendLog={() => void handleOpenBackendLog()}
            />
          ) : activePage === "library" ? (
            <LibraryPage
              tracks={tracks}
              totalTracks={libraryTotal}
              albums={albums}
              playlists={playlists}
              selectedAlbumId={selectedAlbumId}
              selectedAlbumTracks={selectedAlbumTracks}
              selectedPlaylistId={selectedPlaylistId}
              selectedPlaylistTracks={selectedPlaylistTracks}
              smartPresets={smartPresets}
              smartPlaylists={smartPlaylists}
              selectedSmartRule={selectedSmartRule}
              smartTracks={smartTracks}
              smartPlaylistName={smartPlaylistName}
              libraryStats={libraryStats}
              libraryHealth={libraryHealth}
              targetPlaylistId={targetPlaylistId}
              newPlaylistName={newPlaylistName}
              importPlaylistPath={importPlaylistPath}
              libraryView={libraryView}
              setLibraryView={setLibraryView}
              search={search}
              setSearch={setSearch}
              refreshTracks={refreshTracks}
              loadMoreTracks={loadMoreTracks}
              isLoading={isLibraryLoading}
              hasMoreTracks={hasMoreTracks}
              sort={librarySort}
              setSort={setLibrarySort}
              scrollTop={libraryScrollTop}
              setScrollTop={setLibraryScrollTop}
              onRating={handleRating}
              onBulkRating={handleBulkRating}
              onPlayTrack={handlePlayTrack}
              onPlayNext={handlePlayNext}
              onAddToQueue={handleAddToQueue}
              onSelectAlbum={handleSelectAlbum}
              onSelectPlaylist={handleSelectPlaylist}
              onCreatePlaylist={handleCreatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onAddTracksToPlaylist={handleAddTracksToPlaylist}
              onDeleteTrack={handleDeleteTrack}
              onEditTrack={setMetadataEditTrack}
              onBulkMetadata={handleBulkMetadata}
              onRequestDeleteTracks={requestDeleteTracks}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onRemoveTracksFromPlaylist={handleRemoveTracksFromPlaylist}
              onMovePlaylistTrack={handleMovePlaylistTrack}
              onExportTracks={handleExportTracks}
              onExportPlaylist={handleExportPlaylist}
              onImportPlaylist={handleImportPlaylist}
              onPreviewSmartRule={handlePreviewSmartRule}
              onCreateSmartPlaylist={handleCreateSmartPlaylist}
              onDeleteSmartPlaylist={handleDeleteSmartPlaylist}
              onSelectSmartPlaylist={handleSelectSmartPlaylist}
              onShuffleTracks={handleShuffleTracks}
              onQuickAutoDj={handleQuickAutoDj}
              onAvoidAutoDj={handleAvoidAutoDj}
              onRevealTrack={handleRevealTrack}
              detailTrack={detailTrack}
              setDetailTrack={setDetailTrack}
              onAnalyzeTracks={handleAnalyzeTracks}
              isAudioAnalyzing={isAudioAnalyzing}
              currentTrackId={currentTrack?.id ?? null}
              currentTrack={currentTrack}
              hideFilePaths={hideFilePaths}
              compactRows={uiPreferences.compactLibraryRows}
              albumGrid={uiPreferences.albumGrid}
              writeRatingsToFiles={writeRatingsToFiles}
              libraryVisibleColumns={libraryVisibleColumns}
              setLibraryVisibleColumns={setLibraryVisibleColumns}
              setTargetPlaylistId={setTargetPlaylistId}
              setNewPlaylistName={setNewPlaylistName}
              setImportPlaylistPath={setImportPlaylistPath}
              setSmartPlaylistName={setSmartPlaylistName}
              showQuickStart={hasLoadedInitialLibrary && libraryTotal === 0 && !quickStartDismissed}
              isScanning={isScanning}
              suggestedMusicPath={settings?.suggested_music_path}
              onChooseMusicFolder={() => void handleChooseMusicFolderAndScan()}
              onUseSuggestedFolder={(path) => void handleUseSuggestedFolder(path)}
              onDismissQuickStart={dismissQuickStart}
              onOpenSettings={() => setActivePage("settings")}
            />
          ) : activePage === "analysis" ? (
            <AnalysisPage
              clapStatus={clapStatus}
              coverage={audioAnalysisCoverage}
              progress={audioAnalysisProgress}
              audioAnalysisLimit={audioAnalysisLimit}
              setAudioAnalysisLimit={setAudioAnalysisLimit}
              audioAnalysisOverwrite={audioAnalysisOverwrite}
              setAudioAnalysisOverwrite={setAudioAnalysisOverwrite}
              audioAnalysisOnlyMissing={audioAnalysisOnlyMissing}
              setAudioAnalysisOnlyMissing={setAudioAnalysisOnlyMissing}
              isAudioAnalyzing={isAudioAnalyzing}
              currentTrack={currentTrack}
              clapModelId={clapModelId}
              setClapModelId={setClapModelId}
              clapCacheDir={clapCacheDir}
              setClapCacheDir={setClapCacheDir}
              clapMaxDuration={clapMaxDuration}
              setClapMaxDuration={setClapMaxDuration}
              installProgress={clapInstallProgress}
              isClapInstalling={isClapInstalling}
              onRefresh={() => {
                void loadClapStatus();
                void loadClapCoverage();
              }}
              onInstallClap={(device) => void handleInstallClap(device)}
              onSaveClapConfig={handleSaveClapConfig}
              onAnalyzeLibrary={() => void handleAnalyzeAudio()}
              onAnalyzeCurrentTrack={() => currentTrack && handleAnalyzeTracks([currentTrack.id])}
              onPause={() => void handlePauseAudioAnalysis()}
              onResume={() => void handleResumeAudioAnalysis()}
              onCancel={() => void handleCancelAudioAnalysis()}
            />
          ) : activePage === "nowPlaying" ? (
            <NowPlayingPage
              currentTrack={currentTrack}
              lyrics={lyrics}
              isLyricsLoading={isLyricsLoading}
              playbackTime={playbackTime}
              queue={playbackQueue}
              writeRatingsToFiles={writeRatingsToFiles}
              onWriteRatingsToFilesChange={(value) => void handleWriteRatingsToFiles(value)}
              onFetchLyrics={handleFetchLyrics}
              onSaveLyrics={handleSaveLyrics}
              onPlayTrack={handlePlayTrack}
              onMoveQueueTrack={handleMovePlaybackQueueTrack}
              onReorderQueueTrack={handleReorderPlaybackQueueTrack}
              onRemoveQueueTrack={handleRemovePlaybackQueueTrack}
              onClearQueue={handleClearPlaybackQueue}
              onSaveQueue={handleSavePlaybackQueue}
              onRestoreQueue={handleRestorePlaybackQueue}
              canRestoreQueue={queueHistory.length > 0}
            />
          ) : activePage === "artist" ? (
            <ArtistPage
              currentTrack={currentTrack}
              artistInfo={artistInfo}
              artistTracks={artistTracks}
              isArtistLoading={isArtistLoading}
              onRefresh={() => void loadArtistInfo(true)}
              onPlayTrack={handlePlayTrack}
            />
          ) : activePage === "history" ? (
            <HistoryPage
              events={historyEvents}
              stats={libraryStats}
              onPlayTrack={handlePlayTrack}
              onRefresh={() => void loadHistory()}
            />
          ) : activePage === "autodj" ? (
            <AutoDjPage
              queue={queue}
              setQueue={setQueue}
              setRecommendationDrift={setRecommendationDrift}
              setStatus={setStatus}
              onPlayTrack={handlePlayTrack}
              onAddTracksToPlaylist={handleAddTracksToPlaylist}
              currentTrackId={currentTrack?.id ?? null}
              currentTrack={currentTrack}
              uiPreferences={uiPreferences}
              avoidRules={autoDjAvoidRules}
              onDeleteAvoidRule={(ruleId) => void handleDeleteAutoDjAvoidRule(ruleId)}
              recommendationProfiles={recommendationProfiles}
              recommendationDrift={recommendationDrift}
              recommendationHistory={recommendationHistory}
              onRefreshProfiles={loadRecommendationProfiles}
              onRefreshHistory={loadRecommendationHistory}
              onSaveRecommendationProfile={handleSaveRecommendationProfile}
              onDeleteRecommendationProfile={handleDeleteRecommendationProfile}
              onSetDefaultRecommendationProfile={handleSetDefaultRecommendationProfile}
            />
          ) : activePage === "fileManagement" ? (
            <FileManagementPage
              folderPath={folderPath}
              onClearArtistCache={handleClearArtistCache}
              onClearLibraryCaches={handleClearLibraryCaches}
              filenameTagPreview={filenameTagPreview}
              onPreviewFilenameTags={handlePreviewFilenameTags}
              onApplyFilenameTags={handleApplyFilenameTags}
              fileOrganizationPreview={fileOrganizationPreview}
              fileOrganizationReport={fileOrganizationReport}
              onPreviewFileOrganization={handlePreviewFileOrganization}
              onApplyFileOrganization={handleApplyFileOrganization}
              onExportFileOrganizationReport={handleExportFileOrganizationReport}
              metadataCsvExport={metadataCsvExport}
              metadataCsvImportPreview={metadataCsvImportPreview}
              metadataCsvImportReport={metadataCsvImportReport}
              onExportMetadataCsv={handleExportMetadataCsv}
              onPreviewMetadataCsv={handlePreviewMetadataCsv}
              onApplyMetadataCsv={handleApplyMetadataCsv}
              onExportMetadataCsvReport={handleExportMetadataCsvReport}
              duplicateActionResult={duplicateActionResult}
              duplicateReview={duplicateReview}
              onDuplicateAction={handleDuplicateAction}
              onLoadDuplicateReview={handleLoadDuplicateReview}
              onRevealTracksByIds={handleRevealTracksByIds}
              chromaprintSetup={chromaprintSetup}
              onRefreshChromaprintSetup={loadChromaprintSetup}
              onSaveChromaprintSetup={handleSaveChromaprintSetup}
              chromaprintInstallResult={chromaprintInstallResult}
              onInstallChromaprintTool={handleInstallChromaprintTool}
              acousticFingerprintResult={acousticFingerprintResult}
              onRunAcousticFingerprintPass={handleRunAcousticFingerprintPass}
              bulkUndoLog={bulkUndoLog}
              bulkUndoBatches={bulkUndoBatches}
              bulkUndoRestoreResult={bulkUndoRestoreResult}
              onRefreshUndoLog={loadBulkUndoLog}
              onRestoreUndoEntry={handleRestoreBulkUndoEntry}
              onRestoreUndoBatch={handleRestoreBulkUndoBatch}
              reportFile={reportFile}
              onReadReportFile={handleReadReportFile}
            />
          ) : activePage === "settings" ? (
            <SettingsPage
              settings={settings}
              folderPath={folderPath}
              setFolderPath={setFolderPath}
              onBrowse={handleBrowseFolder}
              onScan={handleScan}
              scanResult={scanResult}
              scanProgress={scanProgress}
              isScanning={isScanning}
              backendStatus={backendStatus}
              backendMessage={backendMessage}
              backendCheckedAt={backendCheckedAt}
              startupDiagnostics={startupDiagnostics}
              backendLog={backendLog}
              onCheckBackend={() => void checkBackendStatus(true)}
              onRunStartupDiagnostics={() => void loadStartupDiagnostics(true)}
              onOpenBackendLog={() => void handleOpenBackendLog()}
              onRestartBackend={() => void handleRestartBackend()}
              clapStatus={clapStatus}
              clapModelId={clapModelId}
              setClapModelId={setClapModelId}
              clapCacheDir={clapCacheDir}
              setClapCacheDir={setClapCacheDir}
              clapMaxDuration={clapMaxDuration}
              setClapMaxDuration={setClapMaxDuration}
              audioAnalysisProgress={audioAnalysisProgress}
              audioAnalysisLimit={audioAnalysisLimit}
              setAudioAnalysisLimit={setAudioAnalysisLimit}
              audioAnalysisOverwrite={audioAnalysisOverwrite}
              setAudioAnalysisOverwrite={setAudioAnalysisOverwrite}
              audioAnalysisOnlyMissing={audioAnalysisOnlyMissing}
              setAudioAnalysisOnlyMissing={setAudioAnalysisOnlyMissing}
              isAudioAnalyzing={isAudioAnalyzing}
              onSaveClapConfig={handleSaveClapConfig}
              onRefreshClapStatus={loadClapStatus}
              onAnalyzeAudio={handleAnalyzeAudio}
              hideFilePaths={hideFilePaths}
              setHideFilePaths={setHideFilePaths}
              uiPreferences={uiPreferences}
              setUiPreferences={setUiPreferences}
              writeRatingsToFiles={writeRatingsToFiles}
              onWriteRatingsToFilesChange={(value) => void handleWriteRatingsToFiles(value)}
              onBackupDatabase={handleBackupDatabase}
              onCreateSupportBundle={handleCreateSupportBundle}
              supportBundlePath={supportBundlePath}
              onCopySupportBundlePath={handleCopySupportBundlePath}
              onOpenSourceFolder={() => void handleOpenSourceFolder("source")}
              onOpenThemeFolder={() => void handleOpenSourceFolder("themes")}
              onClearArtistCache={handleClearArtistCache}
            />
          ) : null}
        </div>
        <PlayerBar
          currentTrack={currentTrack}
          queue={playbackQueue}
          onSelectTrack={handlePlayTrack}
          onTrackEnded={handleTrackEnded}
          onTrackSkipped={handleTrackSkipped}
          onPlaybackTime={setPlaybackTime}
          onRating={handleRating}
          autoPlay={autoPlayOnTrackChange}
          fadeMs={uiPreferences.playerFadeMs}
          skipThresholdPercent={uiPreferences.skipThresholdPercent}
          playbackEngine={uiPreferences.playbackEngine}
          nativeOutputDeviceId={uiPreferences.nativeOutputDeviceId}
          nativeBufferFrames={uiPreferences.nativeBufferFrames}
          miniPlayer={uiPreferences.miniPlayer}
          replayGainMode={uiPreferences.replayGainMode}
          replayGainPreampDb={uiPreferences.replayGainPreampDb}
          replayGainPreventClipping={uiPreferences.replayGainPreventClipping}
          keyboardShortcuts={uiPreferences.keyboardShortcuts}
          playbackMode={playbackMode}
          setPlaybackMode={setPlaybackMode}
          onOpenMiniPlayer={handleOpenDetachedMiniPlayer}
          setStatus={setStatus}
        />
      </div>
    </div>
  );
}
