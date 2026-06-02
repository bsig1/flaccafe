// @ts-nocheck
import { useRef,useState } from "react";

import type {
AdvancedTrackSearchFilters,
AlbumSummary,
ArtistInfoResponse,
ArtistSummary,
AutoDjAvoidRule,
AutoDjSettings,
HistoryStatsResponse,
InboxResponse,
LibraryHealthResponse,
LibraryStatsResponse,
LogTailResponse,
LyricsResponse,
PlayEventEntry,
PlaylistSummary,
QueueTrack,
RadioStation,
RecommendationDrift,
RecommendationProfile,
RecommendationRun,
SettingsResponse,
StartupDiagnosticsResponse,
Track,
} from "../../types/api";
import {
DEFAULT_LIBRARY_SORT,
defaultLibraryTrackQueryKey,
indexedStartupTracks,
readStartupLibrarySnapshot,
type StartupLibrarySnapshot,
} from "../appHelpers";
import type { EditableMetadataKey } from "../components/modals";
import {
defaultAutoDj,
emptyRecommendationDrift,
readQuickStartDismissed,
readUiPreferences,
type AppContextMenu,
type BackendStatus,
type DeleteTrackPrompt,
type LibraryView,
type Page,
type PlaybackMode,
type SortState,
type UiPreferences,
type UndoAction,
} from "../shared";

export function useAppControllerState() {
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
  const [autoWriteFetchedLyricsSidecars, setAutoWriteFetchedLyricsSidecars] = useState(true);
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
  const selectedAlbumTracksCacheRef = useRef<Map<number, Track[]>>(new Map());
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null);
  const [selectedArtistTracks, setSelectedArtistTracks] = useState<Track[]>([]);
  const selectedArtistTracksCacheRef = useRef<Map<string, Track[]>>(new Map());
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
  const lastFolderWatchNotificationIdRef = useRef<string | null>(null);
  const FolderWatchRefreshTimerRef = useRef<number | null>(null);

  return { startupLibrarySnapshot, activePage, setActivePage, tracks, setTracks, trackIndexCache, setTrackIndexCache, queue, setQueue, autoDjAvoidRules, setAutoDjAvoidRules, recommendationProfiles, setRecommendationProfiles, recommendationDrift, setRecommendationDrift, recommendationHistory, setRecommendationHistory, settings, setSettings, settingsFocusSection, setSettingsFocusSection, writeRatingsToFiles, setWriteRatingsToFiles, autoWriteFetchedLyricsSidecars, setAutoWriteFetchedLyricsSidecars, cdAutoLookupMetadata, setCdAutoLookupMetadata, search, setSearch, status, setStatus, backendStatus, setBackendStatus, backendMessage, setBackendMessage, backendCheckedAt, setBackendCheckedAt, startupDiagnostics, setStartupDiagnostics, backendLog, setBackendLog, supportBundlePath, setSupportBundlePath, undoAction, setUndoAction, uiPreferences, setUiPreferences, continuousAutoDjEnabled, setContinuousAutoDjEnabled, continuousAutoDjBusy, setContinuousAutoDjBusy, continuousAutoDjSettings, setContinuousAutoDjSettings, quickStartDismissed, setQuickStartDismissed, coffeeAnimating, setCoffeeAnimating, detailTrack, setDetailTrack, metadataEditTrack, setMetadataEditTrack, metadataEditInitialField, setMetadataEditInitialField, deletePrompt, setDeletePrompt, appContextMenu, setAppContextMenu, fileManagementFocusToolId, setFileManagementFocusToolId, fileManagementScopeIds, setFileManagementScopeIds, currentTrack, setCurrentTrack, currentRadioStation, setCurrentRadioStation, radioPlaybackRequestId, setRadioPlaybackRequestId, autoPlayOnTrackChange, setAutoPlayOnTrackChange, externalTrackRequest, setExternalTrackRequest, externalTrackRequestIdRef, cdPlaybackPrepareRequestIdRef, cdPlaybackPrepareChainRef, playbackQueue, setPlaybackQueue, queueHistory, setQueueHistory, playbackMode, setPlaybackMode, continuousAutoDjInFlightRef, libraryTotal, setLibraryTotal, hasMoreTracks, setHasMoreTracks, isLibraryLoading, setIsLibraryLoading, hasLoadedInitialLibrary, setHasLoadedInitialLibrary, librarySort, setLibrarySort, libraryView, setLibraryView, albums, setAlbums, artists, setArtists, playlists, setPlaylists, libraryStats, setLibraryStats, libraryHealth, setLibraryHealth, inbox, setInbox, historyEvents, setHistoryEvents, historyStats, setHistoryStats, selectedAlbumId, setSelectedAlbumId, selectedAlbumTracks, setSelectedAlbumTracks, selectedAlbumTracksCacheRef, selectedArtistName, setSelectedArtistName, selectedArtistTracks, setSelectedArtistTracks, selectedArtistTracksCacheRef, selectedPlaylistId, setSelectedPlaylistId, selectedPlaylistTracks, setSelectedPlaylistTracks, targetPlaylistId, setTargetPlaylistId, newPlaylistName, setNewPlaylistName, importPlaylistPath, setImportPlaylistPath, debouncedSearch, setDebouncedSearch, advancedTrackSearch, setAdvancedTrackSearch, debouncedAdvancedTrackSearch, setDebouncedAdvancedTrackSearch, lyrics, setLyrics, isLyricsLoading, setIsLyricsLoading, artistInfo, setArtistInfo, artistTracks, setArtistTracks, isArtistLoading, setIsArtistLoading, playbackTime, setPlaybackTime, restoredPlaybackPosition, setRestoredPlaybackPosition, libraryScrollTop, setLibraryScrollTop, libraryArtistScrollTop, setLibraryArtistScrollTop, libraryAlbumScrollTop, setLibraryAlbumScrollTop, libraryCompletionScrollTop, setLibraryCompletionScrollTop, libraryPlaylistScrollTop, setLibraryPlaylistScrollTop, trackIndexCacheRef, libraryRequestId, libraryLoadingCountRef, libraryPageRequestsInFlightRef, undoTimerRef, lastSessionWriteKeyRef, lastSessionRestoreFinishedRef, lastSessionRestoreAttemptedRef, startupBackgroundHydratedRef, priorityLibraryLoadStartedRef, priorityLibraryQueryKeyRef, libraryCacheQueryKeyRef, lastFolderWatchNotificationIdRef, FolderWatchRefreshTimerRef };
}
