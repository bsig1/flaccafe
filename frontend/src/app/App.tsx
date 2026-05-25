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
  LibraryStatsResponse,
  LogTailResponse,
  LyricsResponse,
  LyricsUpdateRequest,
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
  TrackMetadataUpdate,
} from "../types/api";
import { Sidebar } from "./components/Sidebar";
import {
  DeleteTrackDialog,
  MetadataEditorModal,
} from "./components/modals";
import type {
  EditableMetadataKey,
} from "./components/modals";
import { AnalysisPage } from "./pages/AnalysisPage";
import { ArtistPage } from "./pages/ArtistPage";
import { AudiobooksPage } from "./pages/AudiobooksPage";
import { AutoDjPage } from "./pages/AutoDjPage";
import { BackendRecoveryPage } from "./pages/BackendRecoveryPage";
import { CdPage } from "./pages/CdPage";
import { FileManagementPage } from "./pages/FileManagementPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LibraryPage } from "./pages/LibraryPage";
import { NowPlayingPage } from "./pages/NowPlayingPage";
import { PodcastsPage } from "./pages/PodcastsPage";
import { RadioPage } from "./pages/RadioPage";
import { ScrobblingPage } from "./pages/ScrobblingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SourcesPage } from "./pages/SourcesPage";
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

const BACKEND_STARTUP_GRACE_MS = 18_000;
const BACKEND_STARTUP_POLL_MS = 650;
const DEFAULT_LIBRARY_SORT: SortState = { key: "artist", direction: "asc" };

interface StartupLibrarySnapshot {
  queryKey: string;
  total: number;
  tracks: Track[];
  savedAt: string;
}

function normalizeLinkMatchValue(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function findAlbumForTrack(albumList: AlbumSummary[], track: Track) {
  const trackAlbum = normalizeLinkMatchValue(track.album);
  if (!trackAlbum) {
    return null;
  }

  const artistCandidates = new Set(
    [track.album_artist, track.artist].map(normalizeLinkMatchValue).filter(Boolean),
  );
  const sameAlbum = albumList.filter((album) => normalizeLinkMatchValue(album.album) === trackAlbum);
  return (
    sameAlbum.find((album) => artistCandidates.has(normalizeLinkMatchValue(album.album_artist))) ??
    sameAlbum[0] ??
    null
  );
}

function lyricsHaveText(response: LyricsResponse | null) {
  return Boolean(response?.lyrics?.trim());
}

function uniqueFolderPaths(paths: string[]) {
  const seen = new Set<string>();
  return paths
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => {
      const key = path.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function sourceFolderKey(path: string) {
  return path.trim().replace(/[\\/]+$/, "").toLowerCase();
}

function libraryTrackQueryKey(
  searchValue: string,
  advancedFilters: AdvancedTrackSearchFilters,
  sort: SortState,
) {
  const normalizedFilters = Object.entries(advancedFilters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify({
    search: searchValue.trim(),
    advancedFilters: normalizedFilters,
    sortBy: sort.key,
    sortDirection: sort.direction,
  });
}

function defaultLibraryTrackQueryKey() {
  return libraryTrackQueryKey("", {}, DEFAULT_LIBRARY_SORT);
}

function compactStartupTrack(track: Track): Track {
  return {
    ...track,
    analysis_embedding: null,
  };
}

function readStartupLibrarySnapshot(): StartupLibrarySnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKeys.startupLibrarySnapshot);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StartupLibrarySnapshot>;
    if (
      parsed.queryKey !== defaultLibraryTrackQueryKey() ||
      !Array.isArray(parsed.tracks) ||
      typeof parsed.total !== "number"
    ) {
      return null;
    }
    return {
      queryKey: parsed.queryKey,
      total: Math.max(0, parsed.total),
      tracks: parsed.tracks.map((track) => compactStartupTrack(track as Track)).slice(0, LIBRARY_PAGE_SIZE),
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function writeStartupLibrarySnapshot(tracks: Track[], total: number) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const snapshot: StartupLibrarySnapshot = {
      queryKey: defaultLibraryTrackQueryKey(),
      total: Math.max(0, total),
      tracks: tracks.slice(0, LIBRARY_PAGE_SIZE).map(compactStartupTrack),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKeys.startupLibrarySnapshot, JSON.stringify(snapshot));
  } catch {
    try {
      window.localStorage.removeItem(storageKeys.startupLibrarySnapshot);
    } catch {
      // Ignore private/local storage failures; startup simply falls back to backend loading.
    }
  }
}

function indexedStartupTracks(snapshot: StartupLibrarySnapshot | null) {
  const cache = new Map<number, Track>();
  snapshot?.tracks.forEach((track, index) => {
    cache.set(index, track);
  });
  return cache;
}

function sortedCachedTracks(cache: Map<number, Track>) {
  return Array.from(cache.entries())
    .sort(([left], [right]) => left - right)
    .map(([, track]) => track);
}

function defaultToolTarget(folderPath: string, folderName: string): string {
  const trimmed = folderPath.trim().replace(/[\\/]+$/, "");
  if (!trimmed) {
    return "";
  }
  const separator = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${separator}${folderName}`;
}

function defaultCdRipTarget(folderPath: string): string {
  return defaultToolTarget(folderPath, "FLAC Cafe CD Rips");
}

function buildArtistSummariesFromTracks(trackList: Track[], searchTerm = ""): ArtistSummary[] {
  const searchTerms = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const artistsByName = new Map<
    string,
    ArtistSummary & {
      albumKeys: Set<string>;
      ratingTotal: number;
      ratingCount: number;
      searchText: string;
    }
  >();

  for (const track of trackList) {
    const name = primaryArtistName(track.artist) || display(track.artist, "").trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    const current =
      artistsByName.get(key) ??
      {
        name,
        track_count: 0,
        album_count: 0,
        duration_seconds: 0,
        average_rating: null,
        play_count: 0,
        skip_count: 0,
        first_year: null,
        last_year: null,
        artwork_track_id: track.id,
        albumKeys: new Set<string>(),
        ratingTotal: 0,
        ratingCount: 0,
        searchText: "",
      };
    current.track_count += 1;
    current.duration_seconds = (current.duration_seconds ?? 0) + (track.duration_seconds ?? 0);
    current.play_count += track.play_count ?? 0;
    current.skip_count += track.skip_count ?? 0;
    if (track.album?.trim()) {
      current.albumKeys.add(track.album.trim().toLowerCase());
    }
    if (typeof track.rating === "number") {
      current.ratingTotal += track.rating;
      current.ratingCount += 1;
    }
    if (typeof track.year === "number") {
      current.first_year = current.first_year === null ? track.year : Math.min(current.first_year, track.year);
      current.last_year = current.last_year === null ? track.year : Math.max(current.last_year, track.year);
    }
    current.searchText += ` ${track.title ?? ""} ${track.artist ?? ""} ${track.album ?? ""} ${track.genre ?? ""} ${track.analysis_genre ?? ""}`;
    artistsByName.set(key, current);
  }

  return Array.from(artistsByName.values())
    .filter((artist) => searchTerms.every((term) => artist.searchText.toLowerCase().includes(term)))
    .map(({ albumKeys, ratingTotal, ratingCount, searchText, ...artist }) => ({
      ...artist,
      album_count: albumKeys.size,
      average_rating: ratingCount > 0 ? ratingTotal / ratingCount : null,
      duration_seconds: artist.duration_seconds || null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}


export default function App() {
  if (new URLSearchParams(window.location.search).get("miniPlayer") === "1") {
    return <MiniPlayerWindow />;
  }

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
  const [folderPath, setFolderPath] = useState("");
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("starting");
  const [backendMessage, setBackendMessage] = useState("Starting the local Python backend.");
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
  const [audioAnalysisEligibleTrackTotal, setAudioAnalysisEligibleTrackTotal] = useState<number | null>(null);
  const [audioAnalysisJobId, setAudioAnalysisJobId] = useState<string | null>(null);
  const [clapInstallProgress, setClapInstallProgress] = useState<ClapInstallProgress | null>(null);
  const [isClapStatusLoading, setIsClapStatusLoading] = useState(false);
  const [clapStatusLoadPercent, setClapStatusLoadPercent] = useState(0);
  const [clapStatusLoadMessage, setClapStatusLoadMessage] = useState("Checking CLAP runtime");
  const [isClapInstalling, setIsClapInstalling] = useState(false);
  const [audioAnalysisLimit, setAudioAnalysisLimit] = useState(0);
  const [audioAnalysisOverwrite, setAudioAnalysisOverwrite] = useState(false);
  const [audioAnalysisOnlyMissing, setAudioAnalysisOnlyMissing] = useState(true);
  const [isAudioAnalyzing, setIsAudioAnalyzing] = useState(false);
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
  const [filenameTagPreview, setFilenameTagPreview] = useState<FilenameTagInferenceResponse | null>(null);
  const [tagRegexPreview, setTagRegexPreview] = useState<TagRegexReplaceResponse | null>(null);
  const [autoTagPreview, setAutoTagPreview] = useState<AutoTagResponse | null>(null);
  const [fileOrganizationPreview, setFileOrganizationPreview] = useState<FileOrganizationResponse | null>(null);
  const [fileOrganizationReport, setFileOrganizationReport] = useState<FileOrganizationReportResponse | null>(null);
  const [folderWatchStatus, setFolderWatchStatus] = useState<FolderWatchStatus | null>(null);
  const [metadataCsvExport, setMetadataCsvExport] = useState<CsvMetadataExportResponse | null>(null);
  const [metadataCsvImportPreview, setMetadataCsvImportPreview] = useState<CsvMetadataImportResponse | null>(null);
  const [metadataCsvImportReport, setMetadataCsvImportReport] = useState<CsvMetadataImportReportResponse | null>(null);
  const [deviceSyncPreview, setDeviceSyncPreview] = useState<DeviceSyncResponse | null>(null);
  const [audioConversionSetup, setAudioConversionSetup] = useState<AudioConversionSetupResponse | null>(null);
  const [audioConversionInstallProgress, setAudioConversionInstallProgress] = useState<AudioConversionInstallProgress | null>(null);
  const [audioConversionPreview, setAudioConversionPreview] = useState<AudioConversionPreviewResponse | null>(null);
  const [audioConversionProgress, setAudioConversionProgress] = useState<AudioConversionProgress | null>(null);
  const [audioConversionJobId, setAudioConversionJobId] = useState<string | null>(null);
  const [cdRipSetup, setCdRipSetup] = useState<CdRipSetupResponse | null>(null);
  const [duplicateActionResult, setDuplicateActionResult] = useState<DuplicateActionResponse | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<DuplicateReviewResponse | null>(null);
  const [chromaprintSetup, setChromaprintSetup] = useState<ChromaprintStatusResponse | null>(null);
  const [acousticFingerprintResult, setAcousticFingerprintResult] = useState<AcousticFingerprintResponse | null>(null);
  const [bulkUndoLog, setBulkUndoLog] = useState<BulkUndoLogEntry[]>([]);
  const [bulkUndoBatches, setBulkUndoBatches] = useState<BulkUndoBatchEntry[]>([]);
  const [bulkUndoRestoreResult, setBulkUndoRestoreResult] = useState<BulkUndoRestoreResponse | null>(null);
  const [reportFile, setReportFile] = useState<ReportFileResponse | null>(null);
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
  const clapStatusRequestIdRef = useRef(0);
  const lastFolderWatchNotificationIdRef = useRef<string | null>(null);
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

  function currentLibraryTrackQueryKey() {
    return libraryTrackQueryKey(debouncedSearch, debouncedAdvancedTrackSearch, librarySort);
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
      const response = await fetchTrackPage({
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

  function applyFolderWatchStatus(statusResponse: FolderWatchStatus, notify = false) {
    setFolderWatchStatus(statusResponse);
    const latestNotification = [...(statusResponse.notifications ?? [])]
      .reverse()
      .find((notification) => !notification.acknowledged);
    if (!notify || !latestNotification || latestNotification.id === lastFolderWatchNotificationIdRef.current) {
      return;
    }
    lastFolderWatchNotificationIdRef.current = latestNotification.id;
    setStatus(`${latestNotification.title}: ${latestNotification.message}`);
  }

  async function loadFolderWatchStatus(showError = false) {
    try {
      applyFolderWatchStatus(await fetchFolderWatchStatus(), false);
    } catch (error) {
      if (showError) {
        setStatus(error instanceof Error ? error.message : "Could not load folder watch status");
      }
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

  function applyClapStatus(response: ClapStatusResponse) {
    setClapStatus(response);
    setClapModelId(response.model_id);
    setClapCacheDir(response.cache_dir);
    setClapMaxDuration(response.max_duration_seconds);
  }

  async function loadClapStatus(
    options: {
      deep?: boolean;
      showProgress?: boolean;
      message?: string;
    } = {},
  ): Promise<ClapStatusResponse | null> {
    const requestId = ++clapStatusRequestIdRef.current;
    let progressTimer: number | null = null;
    if (options.showProgress) {
      setIsClapStatusLoading(true);
      setClapStatusLoadPercent(options.deep ? 45 : 8);
      setClapStatusLoadMessage(options.message ?? (options.deep ? "Verifying CLAP runtime" : "Reading CLAP setup"));
      progressTimer = window.setInterval(() => {
        setClapStatusLoadPercent((current) => Math.min(options.deep ? 92 : 45, current + (options.deep ? 4 : 10)));
      }, 450);
    }
    try {
      const response = await fetchClapStatus(Boolean(options.deep));
      if (requestId === clapStatusRequestIdRef.current) {
        applyClapStatus(response);
        if (options.showProgress) {
          setClapStatusLoadPercent(100);
          setClapStatusLoadMessage(options.deep ? "CLAP verification complete" : "CLAP setup loaded");
        }
      }
      return response;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load CLAP status");
      return null;
    } finally {
      if (progressTimer !== null) {
        window.clearInterval(progressTimer);
      }
      if (requestId === clapStatusRequestIdRef.current && options.showProgress) {
        window.setTimeout(() => {
          if (requestId === clapStatusRequestIdRef.current) {
            setIsClapStatusLoading(false);
          }
        }, 450);
      }
    }
  }

  async function loadAnalysisClapReadiness(forceDeep = false) {
    const quickStatus = await loadClapStatus({
      deep: false,
      showProgress: true,
      message: "Reading CLAP setup",
    });
    void loadClapCoverage();
    const quickDeps = Object.values(quickStatus?.dependencies ?? {});
    const shouldVerifyDeep = Boolean(
      quickStatus &&
        (forceDeep ||
          quickStatus.installed ||
          quickStatus.runtime_exists ||
          !quickStatus.runtime_managed ||
          quickDeps.some(Boolean)),
    );
    if (shouldVerifyDeep) {
      void loadClapStatus({
        deep: true,
        showProgress: true,
        message: "Verifying CLAP runtime",
      });
    }
  }

  async function loadClapCoverage() {
    try {
      const [coverage, eligibleTrackPage] = await Promise.all([
        fetchClapCoverage(),
        fetchTrackPage({ limit: 1, offset: 0, sortBy: "artist", sortDirection: "asc" }).catch(() => null),
      ]);
      setAudioAnalysisCoverage(coverage);
      if (eligibleTrackPage) {
        setAudioAnalysisEligibleTrackTotal(eligibleTrackPage.total);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load CLAP coverage");
    }
  }

  async function refreshAnalyzedState(trackIds?: number[]) {
    await refreshTracks();
    await loadAlbums();
    await loadArtists();
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
      await loadClapStatus({
        deep: true,
        showProgress: activePage === "analysis",
        message: "Verifying installed CLAP runtime",
      });
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

  async function handleScan(pathOverride?: string | string[]) {
    const targetPaths = uniqueFolderPaths(
      Array.isArray(pathOverride)
        ? pathOverride
        : pathOverride
          ? [pathOverride]
          : [...libraryFolders, folderPath],
    );
    if (targetPaths.length === 0) {
      setStatus("Add at least one music folder path");
      return;
    }
    setStatus(targetPaths.length === 1 ? "Starting library scan" : `Starting scan of ${targetPaths.length} folders`);
    setIsScanning(true);
    setScanResult(null);
    setScanProgress(null);
    try {
      const savePaths = pathOverride ? uniqueFolderPaths([...libraryFolders, ...targetPaths]) : targetPaths;
      const started = await startScanLibrary(targetPaths, savePaths);
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
        folder_paths: latest.folder_paths?.length ? latest.folder_paths : targetPaths,
        scanned_files: latest.total_files,
        inserted: latest.inserted,
        updated: latest.updated,
        removed: latest.removed,
        skipped: latest.skipped,
        errors: latest.errors,
      };
      setScanResult(result);
      const nextFolders = savePaths;
      setLibraryFolders(nextFolders);
      setFolderPath(nextFolders[0] ?? "");
      setStatus(
        `Scan complete: ${result.inserted} inserted, ${result.updated} updated, ${result.removed} removed, ${result.skipped} skipped`,
      );
      await refreshTracks();
      await loadAlbums();
      await loadArtists();
      await loadPlaylists();
      await loadLibraryStats();
      await loadInbox();
      await loadClapCoverage();
      await loadSettings();
      try {
        applyFolderWatchStatus(await startFolderWatch(result.folder_paths[0] ?? result.folder_path, folderWatchStatus?.interval_seconds ?? 45), false);
      } catch {
        await loadFolderWatchStatus();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleRemoveLibrarySource(path: string) {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      return;
    }
    const confirmed = window.confirm(
      `Remove this source from FLAC Cafe?\n\n${trimmedPath}\n\nTracks under this folder will be removed from the library database. Audio files on disk will not be deleted.`,
    );
    if (!confirmed) {
      return;
    }

    setStatus("Removing source from library");
    try {
      const response = await removeLibrarySource(trimmedPath);
      const removedKeys = new Set([sourceFolderKey(trimmedPath), sourceFolderKey(response.path)]);
      const savedKeys = new Set(response.library_paths.map(sourceFolderKey));
      const unsavedLocalFolders = libraryFolders.filter((item) => {
        const key = sourceFolderKey(item);
        return !removedKeys.has(key) && !savedKeys.has(key);
      });
      const nextFolders = uniqueFolderPaths([...response.library_paths, ...unsavedLocalFolders]);
      setLibraryFolders(nextFolders);
      setFolderPath((current) => (removedKeys.has(sourceFolderKey(current)) ? nextFolders[0] ?? "" : current));
      setSettings((current) =>
        current
          ? {
              ...current,
              library_path: nextFolders[0] ?? null,
              library_paths: nextFolders,
            }
          : current,
      );
      setScanResult(null);
      setScanProgress(null);
      await Promise.all([
        refreshTracks(),
        loadAlbums(),
        loadArtists(),
        loadPlaylists(),
        loadLibraryStats(),
        loadInbox(),
        loadClapCoverage(),
        loadFolderWatchStatus(),
      ]);
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove source");
    }
  }

  async function handleStartFolderWatch(intervalSeconds: number) {
    const targetPath = uniqueFolderPaths([...libraryFolders, folderPath])[0] || settings?.library_path || "";
    if (!targetPath) {
      setStatus("Choose a music folder before starting folder watch");
      return;
    }
    try {
      const response = await startFolderWatch(targetPath, intervalSeconds);
      applyFolderWatchStatus(response, false);
      setStatus("Folder watch is running. Pending changes will wait for your review.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start folder watch");
    }
  }

  async function handleStopFolderWatch() {
    try {
      const response = await stopFolderWatch();
      applyFolderWatchStatus(response, false);
      setStatus("Folder watch stopped");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not stop folder watch");
    }
  }

  async function handleRefreshFolderWatch() {
    try {
      const response = await refreshFolderWatch(uniqueFolderPaths([...libraryFolders, folderPath])[0] || settings?.library_path || null);
      applyFolderWatchStatus(response, false);
      setStatus(
        response.pending_count
          ? `Found ${response.pending_count.toLocaleString()} pending library change${response.pending_count === 1 ? "" : "s"}`
          : "No pending library changes",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not check watched folder");
    }
  }

  async function applyFolderWatchResponse(response: FolderWatchApplyResponse) {
    applyFolderWatchStatus(response.status, false);
    await Promise.all([
      refreshTracks(),
      loadAlbums(),
      loadArtists(),
      loadPlaylists(),
      loadLibraryStats(),
      loadInbox(),
      loadClapCoverage(),
    ]);
    const pieces = [
      response.inserted ? `${response.inserted.toLocaleString()} added` : "",
      response.updated ? `${response.updated.toLocaleString()} updated` : "",
      response.moved ? `${response.moved.toLocaleString()} moved` : "",
      response.removed ? `${response.removed.toLocaleString()} removed` : "",
    ].filter(Boolean);
    const summary = pieces.length ? pieces.join(", ") : "No changes applied";
    const suffix = response.errors.length ? ` (${response.errors.length.toLocaleString()} error${response.errors.length === 1 ? "" : "s"})` : "";
    setStatus(`Folder watch applied: ${summary}${suffix}`);
  }

  async function handleApplyFolderWatch(changeIds: string[], applyAll = false) {
    const pendingCount = folderWatchStatus?.pending_count ?? 0;
    if (!applyAll && changeIds.length === 0) {
      setStatus("Select at least one pending change to apply");
      return;
    }
    if (pendingCount > 0 && !window.confirm("Apply the selected folder changes to the library database? Removed files will leave the library, but FLAC Cafe will not delete audio files.")) {
      return;
    }
    try {
      await applyFolderWatchResponse(await applyFolderWatchChanges(changeIds, applyAll));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not apply folder watch changes");
    }
  }

  async function handleAcknowledgeFolderWatchNotifications(notificationIds: string[], allNotifications = false) {
    try {
      applyFolderWatchStatus(await acknowledgeFolderWatchNotifications(notificationIds, allNotifications), false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not dismiss folder watch notification");
    }
  }

  async function handleBrowseFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select music folders",
      });

      const selectedPaths = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
      if (selectedPaths.length > 0) {
        const next = uniqueFolderPaths([...libraryFolders, ...selectedPaths]);
        setLibraryFolders(next);
        setFolderPath(next[0] ?? "");
        setStatus(`Selected ${selectedPaths.length.toLocaleString()} folder${selectedPaths.length === 1 ? "" : "s"}`);
      } else {
        setStatus("Folder selection canceled");
      }
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a folder path here in browser mode.");
    }
  }

  async function handleBrowseAudioConversionTarget(): Promise<string | null> {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select conversion target folder",
      });
      if (typeof selected === "string") {
        setStatus(`Selected conversion target: ${selected}`);
        return selected;
      }
      setStatus("Conversion target selection canceled");
      return null;
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a conversion target folder in browser mode.");
      return null;
    }
  }

  async function handleBrowseCdRipTarget(): Promise<string | null> {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select CD rip output folder",
      });
      if (typeof selected === "string") {
        setStatus(`Selected CD rip output folder: ${selected}`);
        return selected;
      }
      setStatus("CD rip output folder selection canceled");
      return null;
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a CD rip output folder in browser mode.");
      return null;
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
      setLibraryFolders(uniqueFolderPaths([selected]));
      await handleScan(selected);
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a folder path in Settings in browser mode.");
    }
  }

  async function handleUseSuggestedFolder(path: string) {
    setFolderPath(path);
    setLibraryFolders(uniqueFolderPaths([path]));
    await handleScan(path);
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
    const snapshot = findTracksByIds([trackId]);
    try {
      const response = await deleteTrack(trackId, deleteFile);
      removeTrackEverywhere(trackId);
      await Promise.all([loadAlbums(), loadArtists(), loadPlaylists(), loadLibraryStats(), loadInbox(), loadClapCoverage()]);
      if (response.deleted_file) {
        setStatus("Deleted file to Recycle Bin and removed track from library");
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
      const response = await deleteTracks(uniqueIds, deleteFile);
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
      const skipped = response.missing_track_ids.length + response.errors.length;
      const warning = skipped ? ` (${skipped.toLocaleString()} skipped)` : "";
      setStatus(
        response.deleted_files > 0
          ? `Deleted ${response.deleted_files.toLocaleString()} files to Recycle Bin and removed ${response.removed_count.toLocaleString()} tracks${warning}`
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

  function commitPlayTrack(track: Track, queueItems: Track[], options?: { suppressExitRecord?: boolean }) {
    if (!options?.suppressExitRecord && currentTrack && currentTrack.id !== track.id) {
      void recordTrackExitQuiet(currentTrack, playbackTime);
    }
    setCurrentRadioStation(null);
    setPlaybackQueue(queueItems);
    setAutoPlayOnTrackChange(true);
    setCurrentTrack(track);
    rememberRecommendationFeedback(track, "manual_play", 0.7);
  }

  function handlePlayTrack(track: Track, queueItems: Track[], options?: { suppressExitRecord?: boolean }) {
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
    handlePlayTrack(track, queueItems.length ? queueItems : [track]);
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

  async function loadAudioConversionSetup() {
    try {
      setAudioConversionSetup(await fetchAudioConversionSetup());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not check FFmpeg setup");
    }
  }

  async function loadCdRipSetup(showError = false) {
    try {
      setCdRipSetup(await fetchCdRipSetup());
    } catch (error) {
      if (showError) {
        setStatus(error instanceof Error ? error.message : "Could not check CD drive");
      }
    }
  }

  async function handleSaveAudioConversionSetup(ffmpegPath: string | null) {
    try {
      const response = await saveAudioConversionSetup({ ffmpeg_path: ffmpegPath });
      setAudioConversionSetup(response);
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save FFmpeg setup");
    }
  }

  async function handleInstallAudioConversionFfmpeg() {
    if (
      !window.confirm(
        "Download the FFmpeg essentials build from Gyan.dev and install it into FLAC Cafe's local tool folder?",
      )
    ) {
      return;
    }
    try {
      setAudioConversionInstallProgress(null);
      setStatus("Starting FFmpeg install...");
      const started = await startAudioConversionFfmpegInstall();
      let latest: AudioConversionInstallProgress | null = null;
      do {
        latest = await fetchAudioConversionFfmpegInstall(started.job_id);
        setAudioConversionInstallProgress(latest);
        if (["completed", "failed"].includes(latest.status)) {
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      } while (latest.status !== "completed" && latest.status !== "failed");

      await loadAudioConversionSetup();
      if (latest.status === "completed") {
        setStatus(latest.message || "FFmpeg was installed for FLAC Cafe.");
      } else {
        setStatus(latest.error || latest.message || "Could not install FFmpeg");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not install FFmpeg");
    }
  }

  function audioConversionRequest(
    targetFolder: string,
    options: {
      outputFormat: AudioConversionFormat;
      preserveStructure: boolean;
      copyTags: boolean;
      copyArtwork: boolean;
      normalizeVolume: boolean;
      sampleRateHz: number | null;
      bitrateKbps: number | null;
      overwrite: boolean;
      trackIds: number[] | null;
    },
    limit: number,
  ) {
    return {
      target_folder: targetFolder.trim(),
      output_format: options.outputFormat,
      track_ids: options.trackIds?.length ? options.trackIds : null,
      preserve_structure: options.preserveStructure,
      copy_tags: options.copyTags,
      copy_artwork: options.copyArtwork,
      normalize_volume: options.normalizeVolume,
      sample_rate_hz: options.sampleRateHz,
      bitrate_kbps: options.bitrateKbps,
      overwrite: options.overwrite,
      limit,
    };
  }

  async function handlePreviewAudioConversion(
    targetFolder: string,
    options: {
      outputFormat: AudioConversionFormat;
      preserveStructure: boolean;
      copyTags: boolean;
      copyArtwork: boolean;
      normalizeVolume: boolean;
      sampleRateHz: number | null;
      bitrateKbps: number | null;
      overwrite: boolean;
      trackIds: number[] | null;
    },
  ) {
    if (!targetFolder.trim()) {
      setStatus("Choose a conversion target folder first");
      return;
    }
    try {
      const response = await previewAudioConversion(audioConversionRequest(targetFolder, options, 200));
      setAudioConversionPreview(response);
      setStatus(`${response.changed_count.toLocaleString()} of ${response.total.toLocaleString()} tracks would convert`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview audio conversion");
    }
  }

  async function handleStartAudioConversion(
    targetFolder: string,
    options: {
      outputFormat: AudioConversionFormat;
      preserveStructure: boolean;
      copyTags: boolean;
      copyArtwork: boolean;
      normalizeVolume: boolean;
      sampleRateHz: number | null;
      bitrateKbps: number | null;
      overwrite: boolean;
      trackIds: number[] | null;
    },
  ) {
    if (!targetFolder.trim()) {
      setStatus("Choose a conversion target folder first");
      return;
    }
    if (!window.confirm("Start audio conversion? This writes new audio files into the target folder.")) {
      return;
    }
    try {
      setAudioConversionProgress(null);
      const started = await startAudioConversion(audioConversionRequest(targetFolder, options, 10000));
      setAudioConversionJobId(started.job_id);
      let latest: AudioConversionProgress | null = null;
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        latest = await fetchAudioConversionProgress(started.job_id);
        setAudioConversionProgress(latest);
        setStatus(
          latest.message ??
            `Converting ${latest.processed_tracks}/${latest.total_tracks} tracks - ETA ${formatTime(latest.eta_seconds)}`,
        );
        if (["completed", "failed", "canceled"].includes(latest.status)) {
          break;
        }
      }
      if (latest.status === "failed") {
        setStatus(latest.error ?? "Audio conversion failed");
      } else if (latest.status === "canceled") {
        setStatus("Audio conversion canceled");
      } else {
        setStatus(`Converted ${latest.converted.toLocaleString()} track${latest.converted === 1 ? "" : "s"}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start audio conversion");
    }
  }

  async function handleCancelAudioConversion() {
    if (!audioConversionJobId) {
      return;
    }
    try {
      const latest = await cancelAudioConversion(audioConversionJobId);
      setAudioConversionProgress(latest);
      setStatus(latest.message ?? "Canceling audio conversion");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not cancel audio conversion");
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
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats()]);
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
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
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
    const uniqueIds = Array.from(new Set(trackIds));
    const targetId = uniqueIds[uniqueIds.length - 1];
    if (!targetId) {
      setStatus("No selected track to reveal.");
      return;
    }
    let foundTracks = findTracksByIds([targetId]);
    if (foundTracks.length === 0) {
      try {
        const response = await fetchDuplicateReview({ track_ids: [targetId], limit: 1 });
        foundTracks = response.tracks;
        setDuplicateReview(response);
      } catch {
        // Fall back to the tracks already loaded in the UI.
      }
    }
    if (!foundTracks.length) {
      setStatus("That selected track was not found in the library.");
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reveal_in_file_explorer", { path: foundTracks[0].path });
      setStatus(`Opened location for ${display(foundTracks[0].title, "selected track")}`);
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
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
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
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(
        response.restored
          ? `Restored batch ${batchId}`
          : response.errors[0] ?? `Could not restore batch ${batchId}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not restore undo batch");
    }
  }

  async function handleUndoRecentChange() {
    if (undoAction) {
      await handleUndoAction();
      return;
    }

    const batchRestoreActions = new Set([
      "csv_metadata_import",
      "regex_metadata_replace",
      "musicbrainz_auto_tag",
      "file_organization",
      "track_remove",
      "sqlite_file_tag_write",
    ]);
    const entryRestoreActions = new Set([
      ...batchRestoreActions,
      "advanced_tag_edit",
      "tag_backup_restore",
    ]);

    try {
      setStatus("Looking for a recent change to undo...");
      const batches = await fetchBulkUndoBatches(10);
      const batch = batches.find((item) => batchRestoreActions.has(item.action_type));
      if (batch) {
        const response = await restoreBulkUndoBatch(batch.batch_id);
        setBulkUndoRestoreResult(response);
        await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
        setStatus(
          response.restored
            ? `Undid ${batch.summary || batch.action_type}`
            : response.errors[0] ?? "Could not undo recent change",
        );
        return;
      }

      const entries = await fetchBulkUndoLog(20);
      const entry = entries.find((item) => entryRestoreActions.has(item.action_type));
      if (!entry) {
        await loadBulkUndoLog();
        setStatus("Nothing recent can be undone yet.");
        return;
      }
      const response = await restoreBulkUndoEntry(entry.id);
      setBulkUndoRestoreResult(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(
        response.restored
          ? `Undid ${entry.summary}`
          : response.errors[0] ?? "Could not undo recent change",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not undo recent change");
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
    };
  }, []);

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
    if (!currentTrack || currentTrack.id <= 0 || currentTrack.is_preview) {
      setLyrics(null);
      setIsLyricsLoading(false);
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
  }, [currentTrack?.id, uiPreferences.autoFetchLyrics, uiPreferences.autoFetchLrcWhenPlainPresent]);

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
  const cdDriveIdFromTrack = (track: Track | null | undefined) => {
    if (!track) {
      return null;
    }
    const pathMatch = track.path?.match(/^cdda:\/\/([^/]+)/);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
    if (!track.audio_url?.includes("/library/tools/cd-rip/playback/")) {
      return null;
    }
    try {
      const parsed = new URL(track.audio_url);
      return parsed.searchParams.get("drive_id");
    } catch {
      return null;
    }
  };
  const cdTrackLooksActive = (track: Track | null | undefined) =>
    Boolean(track?.path?.startsWith("cdda://") || track?.audio_url?.includes("/library/tools/cd-rip/playback/"));
  const currentCdPlaybackDriveId = cdDriveIdFromTrack(currentTrack) ?? cdDriveIdFromTrack(externalTrackRequest?.track);
  const isCdPlaybackActive = Boolean(
    currentCdPlaybackDriveId ||
      cdTrackLooksActive(currentTrack) ||
      cdTrackLooksActive(externalTrackRequest?.track),
  );
  const showCdPage =
    uiPreferences.cdSidebarMode === "always" ||
    (uiPreferences.cdSidebarMode === "drive" && cdDriveDetected);

  useEffect(() => {
    if (activePage === "cd" && !showCdPage) {
      setActivePage("library");
    }
  }, [activePage, showCdPage]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink text-neutral-100" onContextMenu={openAppContextMenu}>
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
          initialField={metadataEditInitialField}
          writeToFiles={writeRatingsToFiles}
          onWriteToFilesChange={(value) => void handleWriteRatingsToFiles(value)}
          onClose={() => {
            setMetadataEditTrack(null);
            setMetadataEditInitialField(null);
          }}
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
      <div className="flex min-h-0 flex-1">
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          hasDiagnosticsIssue={backendStatus === "down"}
          hasAnalysisIssue={hasAnalysisIssue}
          showCdPage={showCdPage}
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
              trackIndexCache={trackIndexCache}
              totalTracks={libraryTotal}
              albums={albums}
              artists={artists}
              playlists={playlists}
              selectedAlbumId={selectedAlbumId}
              selectedAlbumTracks={selectedAlbumTracks}
              selectedArtistName={selectedArtistName}
              selectedArtistTracks={selectedArtistTracks}
              selectedPlaylistId={selectedPlaylistId}
              selectedPlaylistTracks={selectedPlaylistTracks}
              libraryStats={libraryStats}
              libraryHealth={libraryHealth}
              inbox={inbox}
              targetPlaylistId={targetPlaylistId}
              newPlaylistName={newPlaylistName}
              importPlaylistPath={importPlaylistPath}
              libraryView={libraryView}
              setLibraryView={setLibraryView}
              search={search}
              setSearch={setSearch}
              advancedTrackSearch={advancedTrackSearch}
              setAdvancedTrackSearch={setAdvancedTrackSearch}
              refreshTracks={refreshTracks}
              refreshAlbums={loadAlbums}
              loadMoreTracks={loadMoreTracks}
              loadTrackWindow={loadTrackWindow}
              isLoading={isLibraryLoading}
              hasMoreTracks={hasMoreTracks}
              sort={librarySort}
              setSort={setLibrarySort}
              scrollTop={libraryScrollTop}
              setScrollTop={setLibraryScrollTop}
              artistScrollTop={libraryArtistScrollTop}
              setArtistScrollTop={setLibraryArtistScrollTop}
              albumScrollTop={libraryAlbumScrollTop}
              setAlbumScrollTop={setLibraryAlbumScrollTop}
              completionScrollTop={libraryCompletionScrollTop}
              setCompletionScrollTop={setLibraryCompletionScrollTop}
              playlistScrollTop={libraryPlaylistScrollTop}
              setPlaylistScrollTop={setLibraryPlaylistScrollTop}
              onRating={handleRating}
              onBulkRating={handleBulkRating}
              onPlayTrack={handlePlayTrack}
              onPlayNext={handlePlayNext}
              onAddToQueue={handleAddToQueue}
              onSelectAlbum={handleSelectAlbum}
              onSelectArtist={handleSelectArtist}
              onPlayAlbum={handlePlayAlbum}
              onPlayArtist={handlePlayArtist}
              onSelectPlaylist={handleSelectPlaylist}
              onCreatePlaylist={handleCreatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onAddTracksToPlaylist={handleAddTracksToPlaylist}
              onDeleteTrack={handleDeleteTrack}
              onEditTrack={openMetadataEditor}
              onBulkMetadata={handleBulkMetadata}
              onAutoTagTracks={handleLibraryAutoTagTracks}
              onSyncFileMetadata={handleSyncFileMetadata}
              onFingerprintTagTracks={handleLibraryFingerprintTagTracks}
              onClapGenreTagTracks={handleLibraryClapGenreTagTracks}
              onVolumeTagTracks={handleLibraryVolumeTagTracks}
              onOpenFileManagementTracks={handleOpenFileManagementForTracks}
              onRequestDeleteTracks={requestDeleteTracks}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onRemoveTracksFromPlaylist={handleRemoveTracksFromPlaylist}
              onMovePlaylistTrack={handleMovePlaylistTrack}
              onExportTracks={handleExportTracks}
              onExportPlaylist={handleExportPlaylist}
              onImportPlaylist={handleImportPlaylist}
              onReviewInboxTracks={handleReviewInboxTracks}
              onUpdateInboxNote={handleUpdateInboxNote}
              onSaveInboxAutoReviewRule={handleSaveInboxAutoReviewRule}
              onDeleteInboxAutoReviewRule={handleDeleteInboxAutoReviewRule}
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
              onAlbumGridChange={(enabled) => setUiPreferences((current) => ({ ...current, albumGrid: enabled }))}
              setTargetPlaylistId={setTargetPlaylistId}
              setNewPlaylistName={setNewPlaylistName}
              setImportPlaylistPath={setImportPlaylistPath}
              showQuickStart={
                hasLoadedInitialLibrary &&
                !quickStartDismissed &&
                currentLibraryTrackQueryKey() === defaultLibraryTrackQueryKey() &&
                (libraryStats?.total_tracks ?? libraryTotal) === 0
              }
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
              eligibleTrackTotal={audioAnalysisEligibleTrackTotal}
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
              isClapStatusLoading={isClapStatusLoading}
              clapStatusLoadPercent={clapStatusLoadPercent}
              clapStatusLoadMessage={clapStatusLoadMessage}
              isClapInstalling={isClapInstalling}
              onRefresh={() => {
                void loadAnalysisClapReadiness(true);
              }}
              onInstallClap={(device, force) => void handleInstallClap(device, force)}
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
              uiPreferences={uiPreferences}
              setUiPreferences={setUiPreferences}
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
              onOpenCurrentTrack={handleOpenCurrentTrackFromPlayer}
              onOpenCurrentArtist={handleOpenCurrentArtistFromPlayer}
              onOpenCurrentAlbum={(track) => void handleOpenCurrentAlbumFromPlayer(track)}
            />
          ) : activePage === "artist" ? (
            <ArtistPage
              currentTrack={currentTrack}
              artistInfo={artistInfo}
              artistTracks={artistTracks}
              isArtistLoading={isArtistLoading}
              onRefresh={() => void loadArtistInfo(true)}
              onPlayTrack={handlePlayTrack}
              onOpenExternalUrl={(url) => void handleOpenExternalUrl(url)}
            />
          ) : activePage === "audiobooks" ? (
            <AudiobooksPage
              setStatus={setStatus}
              onPlayTrack={handlePlayTrack}
              onAddToQueue={handleAddToQueue}
            />
          ) : activePage === "podcasts" ? (
            <PodcastsPage
              setStatus={setStatus}
              onPlayTrack={handlePlayTrack}
              onAddToQueue={handleAddToQueue}
              showFilePaths={uiPreferences.showPodcastFilePaths}
            />
          ) : activePage === "radio" ? (
            <RadioPage
              setStatus={setStatus}
              playingStationId={currentRadioStation?.id ?? null}
              onPlayStation={handlePlayRadioStation}
              onStopStation={handleStopRadioStation}
            />
          ) : activePage === "scrobbling" ? (
            <ScrobblingPage setStatus={setStatus} onOpenApiKeysSettings={openApiKeysSettings} />
          ) : activePage === "cd" ? (
            <CdPage
              currentCdPlaybackDriveId={currentCdPlaybackDriveId}
              defaultTargetFolder={defaultCdRipTarget(folderPath)}
              isCdPlaybackActive={isCdPlaybackActive}
              onBrowseTarget={handleBrowseCdRipTarget}
              onOpenOptionalDependencies={handleOpenOptionalDependencies}
              onPlayPreviewTrack={handlePlayCdPreviewTrack}
              setStatus={setStatus}
            />
          ) : activePage === "history" ? (
            <HistoryPage
              events={historyEvents}
              stats={libraryStats}
              historyStats={historyStats}
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
              onPlayNext={handlePlayNext}
              onAddToQueue={handleAddToQueue}
              onUseGeneratedQueue={queueUpcomingPlaybackTracks}
              onQuickAutoDj={(track) => void handleQuickAutoDj(track)}
              onRevealTrack={(track) => void handleRevealTrack(track)}
              onAddTracksToPlaylist={handleAddTracksToPlaylist}
              currentTrackId={currentTrack?.id ?? null}
              currentTrack={currentTrack}
              uiPreferences={uiPreferences}
              continuousAutoDjEnabled={continuousAutoDjEnabled}
              continuousAutoDjBusy={continuousAutoDjBusy}
              onContinuousAutoDjChange={handleContinuousAutoDjChange}
              onContinuousSettingsChange={setContinuousAutoDjSettings}
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
          ) : activePage === "sources" ? (
            <SourcesPage
              folderPath={folderPath}
              setFolderPath={setFolderPath}
              libraryFolders={libraryFolders}
              setLibraryFolders={setLibraryFolders}
              suggestedMusicPath={settings?.suggested_music_path ?? null}
              onBrowse={handleBrowseFolder}
              onScan={handleScan}
              onRemoveSource={handleRemoveLibrarySource}
              scanResult={scanResult}
              scanProgress={scanProgress}
              isScanning={isScanning}
              folderWatchStatus={folderWatchStatus}
              onStartFolderWatch={handleStartFolderWatch}
              onStopFolderWatch={handleStopFolderWatch}
              onRefreshFolderWatch={handleRefreshFolderWatch}
              onApplyFolderWatch={handleApplyFolderWatch}
              onAcknowledgeFolderWatchNotifications={handleAcknowledgeFolderWatchNotifications}
            />
          ) : activePage === "fileManagement" ? (
            <FileManagementPage
              initialFocusToolId={fileManagementFocusToolId}
              initialTrackScopeIds={fileManagementScopeIds}
              folderPath={folderPath}
              playlists={playlists}
              onClearArtistCache={handleClearArtistCache}
              onClearLibraryCaches={handleClearLibraryCaches}
              filenameTagPreview={filenameTagPreview}
              onPreviewFilenameTags={handlePreviewFilenameTags}
              onApplyFilenameTags={handleApplyFilenameTags}
              tagRegexPreview={tagRegexPreview}
              onPreviewTagRegex={handlePreviewTagRegex}
              onApplyTagRegex={handleApplyTagRegex}
              autoTagPreview={autoTagPreview}
              onPreviewAutoTag={handlePreviewAutoTag}
              onApplyAutoTag={handleApplyAutoTag}
              fileOrganizationPreview={fileOrganizationPreview}
              fileOrganizationReport={fileOrganizationReport}
              onPreviewFileOrganization={handlePreviewFileOrganization}
              onApplyFileOrganization={handleApplyFileOrganization}
              onExportFileOrganizationReport={handleExportFileOrganizationReport}
              deviceSyncPreview={deviceSyncPreview}
              onDeviceSync={handleDeviceSync}
              audioConversionSetup={audioConversionSetup}
              audioConversionInstallProgress={audioConversionInstallProgress}
              audioConversionPreview={audioConversionPreview}
              audioConversionProgress={audioConversionProgress}
              onRefreshAudioConversionSetup={loadAudioConversionSetup}
              onSaveAudioConversionSetup={handleSaveAudioConversionSetup}
              onInstallAudioConversionFfmpeg={handleInstallAudioConversionFfmpeg}
              onBrowseAudioConversionTarget={handleBrowseAudioConversionTarget}
              onBrowseCdRipTarget={handleBrowseCdRipTarget}
              currentCdPlaybackDriveId={currentCdPlaybackDriveId}
              isCdPlaybackActive={isCdPlaybackActive}
              onPlayCdPreviewTrack={handlePlayCdPreviewTrack}
              onPreviewAudioConversion={handlePreviewAudioConversion}
              onStartAudioConversion={handleStartAudioConversion}
              onCancelAudioConversion={handleCancelAudioConversion}
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
              clapStatus={clapStatus}
              clapInstallProgress={clapInstallProgress}
              isClapInstalling={isClapInstalling}
              onRefreshClapStatus={() => void loadClapStatus()}
              onInstallClap={handleInstallClap}
              chromaprintSetup={chromaprintSetup}
              onRefreshChromaprintSetup={loadChromaprintSetup}
              onSaveChromaprintSetup={handleSaveChromaprintSetup}
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
              onAdvancedTagLibraryChanged={handleAdvancedTagLibraryChanged}
              onClearTrackScope={() => setFileManagementScopeIds(null)}
              onOpenApiKeysSettings={openApiKeysSettings}
              onSelectLibraryTarget={(view) => {
                setLibraryView(view);
                setActivePage("library");
                setStatus(
                  view === "albums"
                    ? "Choose an album, then select or right-click tracks to send them to tagging tools."
                    : "Select tracks, then use the File Management button or track menu tools.",
                );
              }}
              setStatus={setStatus}
            />
          ) : activePage === "settings" ? (
            <SettingsPage
              settings={settings}
              focusSectionId={settingsFocusSection}
              onFocusSectionConsumed={() => setSettingsFocusSection(null)}
              backendStatus={backendStatus}
              backendMessage={backendMessage}
              backendCheckedAt={backendCheckedAt}
              startupDiagnostics={startupDiagnostics}
              backendLog={backendLog}
              onCheckBackend={() => void checkBackendStatus(true)}
              onRunStartupDiagnostics={() => void loadStartupDiagnostics(true)}
              onOpenBackendLog={() => void handleOpenBackendLog()}
              onRestartBackend={() => void handleRestartBackend()}
              hideFilePaths={hideFilePaths}
              setHideFilePaths={setHideFilePaths}
              uiPreferences={uiPreferences}
              setUiPreferences={setUiPreferences}
              writeRatingsToFiles={writeRatingsToFiles}
              onWriteRatingsToFilesChange={(value) => void handleWriteRatingsToFiles(value)}
              autoWriteFetchedLyricsSidecars={autoWriteFetchedLyricsSidecars}
              onAutoWriteFetchedLyricsSidecarsChange={(value) => void handleAutoWriteFetchedLyricsSidecars(value)}
              onAcoustIdApiKeyChange={(apiKey) => void handleAcoustIdApiKeyChange(apiKey)}
              onLastFmApiCredentialsChange={(apiKey, apiSecret) => void handleLastFmApiCredentialsChange(apiKey, apiSecret)}
              setStatus={setStatus}
              onBackupDatabase={handleBackupDatabase}
              onResetLocalData={handleResetLocalData}
              onCreateSupportBundle={handleCreateSupportBundle}
              supportBundlePath={supportBundlePath}
              onCopySupportBundlePath={handleCopySupportBundlePath}
              onOpenSourceFolder={() => void handleOpenSourceFolder("source")}
              onOpenThemeFolder={() => void handleOpenSourceFolder("themes")}
              onClearArtistCache={handleClearArtistCache}
            />
          ) : null}
        </div>
        </div>
      </div>
      <PlayerBar
        currentTrack={currentTrack}
        currentRadioStation={currentRadioStation}
        radioPlaybackRequestId={radioPlaybackRequestId}
        queue={playbackQueue}
        externalTrackRequest={externalTrackRequest}
        onSelectTrack={handlePlayTrack}
        onCommitExternalTrackRequest={handleCommitExternalTrackRequest}
        onTrackEnded={handleTrackEnded}
        onTrackSkipped={handleTrackSkipped}
        onPlaybackTime={setPlaybackTime}
        resumePositionSeconds={restoredPlaybackPosition}
        onResumePositionApplied={() => setRestoredPlaybackPosition(null)}
        onRating={handleRating}
        autoPlay={autoPlayOnTrackChange}
        fadeMs={uiPreferences.playerFadeMs}
        skipThresholdPercent={uiPreferences.skipThresholdPercent}
        playbackEngine={uiPreferences.playbackEngine}
        nativeOutputDeviceId={uiPreferences.nativeOutputDeviceId}
        nativeBufferFrames={uiPreferences.nativeBufferFrames}
        miniPlayer={false}
        replayGainMode={uiPreferences.replayGainMode}
        replayGainTargetVolumePercent={uiPreferences.replayGainTargetVolumePercent}
        replayGainPreampDb={uiPreferences.replayGainPreampDb}
        replayGainPreventClipping={uiPreferences.replayGainPreventClipping}
        equalizerEnabled={uiPreferences.equalizerEnabled}
        equalizerBandMode={uiPreferences.equalizerBandMode}
        equalizerPreampDb={uiPreferences.equalizerPreampDb}
        equalizerGains={uiPreferences.equalizerGains}
        dspLimiterEnabled={uiPreferences.dspLimiterEnabled}
        keyboardShortcuts={uiPreferences.keyboardShortcuts}
        playbackMode={playbackMode}
        setPlaybackMode={setPlaybackMode}
        onOpenMiniPlayer={handleOpenDetachedMiniPlayer}
        onOpenLyricsView={handleOpenLyricsViewFromPlayer}
        onOpenQueueView={handleOpenQueueViewFromPlayer}
        onOpenCurrentTrack={handleOpenCurrentTrackFromPlayer}
        onOpenCurrentArtist={handleOpenCurrentArtistFromPlayer}
        onOpenCurrentAlbum={(track) => void handleOpenCurrentAlbumFromPlayer(track)}
        setStatus={setStatus}
      />
    </div>
  );
}
