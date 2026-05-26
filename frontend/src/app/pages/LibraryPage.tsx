import {
  Album,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Download,
  Fingerprint,
  FolderOpen,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Play,
  Podcast,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Shuffle,
  SkipForward,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  UIEvent as ReactUIEvent,
} from "react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  albumArtworkUrl,
  albumCoverUrl,
  chooseAlbumArtwork,
  clearAlbumArtwork,
  embedAlbumArtworkFromPath,
  embedEmbeddedAlbumArtwork,
  fetchAlbumArtworkCandidates,
  fetchTracks,
  saveEmbeddedAlbumArtwork,
  saveWebAlbumArtwork,
  searchAlbumArtworkWeb,
  lookupAlbumCompletion,
} from "../../lib/api";
import {
  placeFloatingMenu,
} from "../../lib/uiInteractions";
import type {
  AlbumSummary,
  AlbumArtworkCandidate,
  AdvancedTrackSearchFilters,
  ArtistSummary,
  DuplicateGroup,
  InboxAutoReviewField,
  InboxAutoReviewMatchType,
  InboxAutoReviewRule,
  InboxAutoReviewRuleRequest,
  LibraryHealthResponse,
  LibraryStatsResponse,
  InboxResponse,
  PlaylistSummary,
  Track,
  TrackMetadataUpdate,
} from "../../types/api";
import {
  RatingStars,
  ResizableHeader,
} from "../components/common";
import { BulkMetadataModal } from "../components/modals";
import type {
  EditableMetadataKey,
} from "../components/modals";
import { QuickStartPanel } from "../components/QuickStartPanel";
import { TrackDetailsPanel } from "../components/TrackDetailsPanel";
import { LibraryViewTabs } from "./library/LibraryViewTabs";
import {
  ColumnContextMenu,
  LibraryColumnDefinition,
  LibraryColumnKey,
  LibraryView,
  LIBRARY_PAGE_SIZE,
  MENU_VIEWPORT_MARGIN,
  MetadataColumnKey,
  SortKey,
  SortState,
  TRACK_AVOID_SUBMENU_HEIGHT,
  TRACK_AVOID_SUBMENU_WIDTH,
  TRACK_CONTEXT_SUBMENU_WIDTH,
  TRACK_CONTEXT_MENU_HEIGHT,
  TRACK_CONTEXT_MENU_WIDTH,
  TrackContextMenu,
  defaultLibraryColumnWidths,
  defaultLibraryVisibleColumns,
  display,
  fileName,
  formatBitrate,
  formatDuration,
  formatFingerprint,
  formatPercent,
  formatRating,
  formatShortDate,
  formatTime,
  libraryColumnDefinitions,
  libraryColumnKeySet,
  librarySelectionColumnWidth,
  normalizeLibraryColumns,
  trackGenre,
} from "../shared";
import {
  ALBUM_GRID_ROW_HEIGHT,
  ALBUM_LIST_ROW_HEIGHT,
  ARTIST_ROW_HEIGHT,
  COMPLETION_COLLAPSED_ROW_HEIGHT,
  COMPLETION_EXPANDED_ROW_ESTIMATE,
  ContextSubmenuKey,
  LIBRARY_ACTIONS_MENU_HEIGHT,
  LIBRARY_ACTIONS_MENU_WIDTH,
  MissingMetadataFilter,
  PLAYLIST_ROW_HEIGHT,
  PLAYLIST_TOOLBAR_HEIGHT,
  TRACK_CONTEXT_DIVIDER_HEIGHT,
  TRACK_CONTEXT_HEADER_HEIGHT,
  TRACK_CONTEXT_ROW_HEIGHT,
  TRACK_PLAYLIST_SUBMENU_WIDTH,
  TRACK_RATING_SUBMENU_HEIGHT,
  TRACK_RATING_SUBMENU_WIDTH,
  TRACK_SUBMENU_CLOSE_DELAY_MS,
  TRACK_TAGGING_SUBMENU_HEIGHT,
  TRACK_VIRTUALIZATION_OVERSCAN,
  TRACK_VIRTUALIZATION_THRESHOLD,
  albumMetaLabel,
  artistMetaLabel,
  missingMetadataFields,
  missingMetadataFilters,
  virtualCollectionWindow,
  virtualVariableCollectionWindow,
} from "./library/libraryViewUtils";

export function LibraryPage({
  tracks,
  trackIndexCache,
  totalTracks,
  albums,
  artists,
  playlists,
  selectedAlbumId,
  selectedAlbumTracks,
  selectedArtistName,
  selectedArtistTracks,
  selectedPlaylistId,
  selectedPlaylistTracks,
  libraryStats,
  libraryHealth,
  inbox,
  targetPlaylistId,
  newPlaylistName,
  importPlaylistPath,
  libraryView,
  setLibraryView,
  search,
  setSearch,
  advancedTrackSearch,
  setAdvancedTrackSearch,
  refreshTracks,
  refreshAlbums,
  loadMoreTracks,
  loadTrackWindow,
  isLoading,
  hasMoreTracks,
  sort,
  setSort,
  scrollTop,
  setScrollTop,
  artistScrollTop,
  setArtistScrollTop,
  albumScrollTop,
  setAlbumScrollTop,
  completionScrollTop,
  setCompletionScrollTop,
  playlistScrollTop,
  setPlaylistScrollTop,
  onRating,
  onBulkRating,
  onPlayTrack,
  onPlayNext,
  onAddToQueue,
  onSelectAlbum,
  onSelectArtist,
  onPlayAlbum,
  onPlayArtist,
  onSelectPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddTracksToPlaylist,
  onDeleteTrack,
  onEditTrack,
  onBulkMetadata,
  onAutoTagTracks,
  onSyncFileMetadata,
  onFingerprintTagTracks,
  onClapGenreTagTracks,
  onVolumeTagTracks,
  onOpenFileManagementTracks,
  onRequestDeleteTracks,
  onRemoveTrackFromPlaylist,
  onRemoveTracksFromPlaylist,
  onMovePlaylistTrack,
  onExportTracks,
  onExportPlaylist,
  onImportPlaylist,
  onReviewInboxTracks,
  onUpdateInboxNote,
  onSaveInboxAutoReviewRule,
  onDeleteInboxAutoReviewRule,
  onShuffleTracks,
  onQuickAutoDj,
  onAvoidAutoDj,
  onRevealTrack,
  detailTrack,
  setDetailTrack,
  onAnalyzeTracks,
  onIgnoreDuplicateGroup,
  onClearIgnoredDuplicateGroups,
  isAudioAnalyzing,
  currentTrackId,
  currentTrack,
  hideFilePaths,
  compactRows,
  albumGrid,
  writeRatingsToFiles,
  libraryVisibleColumns,
  setLibraryVisibleColumns,
  onAlbumGridChange,
  setTargetPlaylistId,
  setNewPlaylistName,
  setImportPlaylistPath,
  showQuickStart,
  isScanning,
  suggestedMusicPath,
  onChooseMusicFolder,
  onUseSuggestedFolder,
  onDismissQuickStart,
  onOpenSettings,
}: {
  tracks: Track[];
  trackIndexCache: Map<number, Track>;
  totalTracks: number;
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: PlaylistSummary[];
  selectedAlbumId: number | null;
  selectedAlbumTracks: Track[];
  selectedArtistName: string | null;
  selectedArtistTracks: Track[];
  selectedPlaylistId: number | null;
  selectedPlaylistTracks: Track[];
  libraryStats: LibraryStatsResponse | null;
  libraryHealth: LibraryHealthResponse | null;
  inbox: InboxResponse | null;
  targetPlaylistId: number | null;
  newPlaylistName: string;
  importPlaylistPath: string;
  libraryView: LibraryView;
  setLibraryView: (view: LibraryView) => void;
  search: string;
  setSearch: (value: string) => void;
  advancedTrackSearch: AdvancedTrackSearchFilters;
  setAdvancedTrackSearch: (updater: (current: AdvancedTrackSearchFilters) => AdvancedTrackSearchFilters) => void;
  refreshTracks: () => void | Promise<void>;
  refreshAlbums: () => void | Promise<void>;
  loadMoreTracks: () => void | Promise<void>;
  loadTrackWindow: (offset: number, limit?: number) => void | Promise<void>;
  isLoading: boolean;
  hasMoreTracks: boolean;
  sort: SortState;
  setSort: (updater: (current: SortState) => SortState) => void;
  scrollTop: number;
  setScrollTop: (value: number) => void;
  artistScrollTop: number;
  setArtistScrollTop: (value: number) => void;
  albumScrollTop: number;
  setAlbumScrollTop: (value: number) => void;
  completionScrollTop: number;
  setCompletionScrollTop: (value: number) => void;
  playlistScrollTop: number;
  setPlaylistScrollTop: (value: number) => void;
  onRating: (trackId: number, rating: number | null) => void;
  onBulkRating: (trackIds: number[], rating: number | null) => void | Promise<void>;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onSelectAlbum: (albumId: number) => void;
  onSelectArtist: (artistName: string) => void;
  onPlayAlbum: (albumId: number) => void | Promise<void>;
  onPlayArtist: (artistName: string) => void | Promise<void>;
  onSelectPlaylist: (playlistId: number) => void;
  onCreatePlaylist: () => void;
  onDeletePlaylist: (playlistId: number) => void;
  onAddTracksToPlaylist: (trackIds: number[], playlistId?: number) => void | Promise<void>;
  onDeleteTrack: (trackId: number, deleteFile: boolean) => void;
  onEditTrack: (track: Track, field?: EditableMetadataKey | null) => void;
  onBulkMetadata: (trackIds: number[], metadata: TrackMetadataUpdate) => void | Promise<void>;
  onAutoTagTracks: (trackIds: number[], apply: boolean) => void | Promise<void>;
  onSyncFileMetadata: (trackIds: number[]) => void | Promise<void>;
  onFingerprintTagTracks: (trackIds: number[]) => void | Promise<void>;
  onClapGenreTagTracks: (trackIds: number[]) => void | Promise<void>;
  onVolumeTagTracks: (trackIds: number[]) => void | Promise<void>;
  onOpenFileManagementTracks: (trackIds: number[]) => void | Promise<void>;
  onRequestDeleteTracks: (trackIds: number[], title: string, allowFileDelete?: boolean) => void;
  onRemoveTrackFromPlaylist: (trackId: number) => void;
  onRemoveTracksFromPlaylist: (trackIds: number[]) => void | Promise<void>;
  onMovePlaylistTrack: (trackId: number, direction: "up" | "down") => void;
  onExportTracks: (trackIds: number[]) => void | Promise<void>;
  onExportPlaylist: (playlistId: number) => void;
  onImportPlaylist: () => void;
  onReviewInboxTracks: (trackIds: number[], allNew?: boolean) => void | Promise<void>;
  onUpdateInboxNote: (trackId: number, note: string) => void | Promise<void>;
  onSaveInboxAutoReviewRule: (rule: InboxAutoReviewRuleRequest, ruleId?: number) => void | Promise<void>;
  onDeleteInboxAutoReviewRule: (rule: InboxAutoReviewRule) => void | Promise<void>;
  onShuffleTracks: (tracks: Track[]) => void;
  onQuickAutoDj: (seedTrack?: Track | null) => void;
  onAvoidAutoDj: (scope: "track" | "artist" | "album" | "genre", track?: Track | null) => void | Promise<void>;
  onRevealTrack: (track: Track) => void;
  detailTrack: Track | null;
  setDetailTrack: (track: Track | null) => void;
  onAnalyzeTracks: (trackIds: number[]) => void;
  onIgnoreDuplicateGroup: (ignoreKey: string, label: string) => void | Promise<void>;
  onClearIgnoredDuplicateGroups: () => void | Promise<void>;
  isAudioAnalyzing: boolean;
  currentTrackId: number | null;
  currentTrack: Track | null;
  hideFilePaths: boolean;
  compactRows: boolean;
  albumGrid: boolean;
  writeRatingsToFiles: boolean;
  libraryVisibleColumns: MetadataColumnKey[];
  setLibraryVisibleColumns: (columns: MetadataColumnKey[]) => void;
  onAlbumGridChange: (enabled: boolean) => void;
  setTargetPlaylistId: (playlistId: number | null) => void;
  setNewPlaylistName: (value: string) => void;
  setImportPlaylistPath: (value: string) => void;
  showQuickStart: boolean;
  isScanning: boolean;
  suggestedMusicPath?: string | null;
  onChooseMusicFolder: () => void;
  onUseSuggestedFolder: (path: string) => void;
  onDismissQuickStart: () => void;
  onOpenSettings: () => void;
}) {
  const [columnWidths, setColumnWidths] = useState(defaultLibraryColumnWidths);
  const [contextMenu, setContextMenu] = useState<TrackContextMenu | null>(null);
  const [columnMenu, setColumnMenu] = useState<ColumnContextMenu | null>(null);
  const [libraryActionsMenu, setLibraryActionsMenu] = useState<{ x: number; y: number } | null>(null);
  const [activeContextSubmenu, setActiveContextSubmenu] = useState<ContextSubmenuKey | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(() => new Set());
  const [selectedTrackCache, setSelectedTrackCache] = useState<Map<number, Track>>(() => new Map());
  const [isSelectingAllTracks, setIsSelectingAllTracks] = useState(false);
  const [showAllDuplicateGroups, setShowAllDuplicateGroups] = useState(false);
  const [showAllMissingMetadata, setShowAllMissingMetadata] = useState(false);
  const [missingMetadataFilter, setMissingMetadataFilter] = useState<MissingMetadataFilter>("all");
  const [bulkMetadataOpen, setBulkMetadataOpen] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<MetadataColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<MetadataColumnKey | null>(null);
  const [albumArtworkCandidates, setAlbumArtworkCandidates] = useState<AlbumArtworkCandidate[]>([]);
  const [isAlbumArtworkOpen, setIsAlbumArtworkOpen] = useState(false);
  const [isSearchingAlbumArtwork, setIsSearchingAlbumArtwork] = useState(false);
  const [albumArtworkStatus, setAlbumArtworkStatus] = useState("");
  const [inboxNoteDraft, setInboxNoteDraft] = useState("");
  const [editingInboxRuleId, setEditingInboxRuleId] = useState<number | null>(null);
  const [inboxRuleName, setInboxRuleName] = useState("");
  const [inboxRuleEnabled, setInboxRuleEnabled] = useState(true);
  const [inboxRuleField, setInboxRuleField] = useState<InboxAutoReviewField>("genre");
  const [inboxRuleMatchType, setInboxRuleMatchType] = useState<InboxAutoReviewMatchType>("contains");
  const [inboxRuleValue, setInboxRuleValue] = useState("");
  const [inboxRuleNote, setInboxRuleNote] = useState("");
  const [inboxRuleApplyExisting, setInboxRuleApplyExisting] = useState(false);
  const [albumMode, setAlbumMode] = useState<"browse" | "completion">("browse");
  const [artistPaneHeight, setArtistPaneHeight] = useState(720);
  const [albumPaneHeight, setAlbumPaneHeight] = useState(720);
  const [playlistPaneHeight, setPlaylistPaneHeight] = useState(720);
  const [completionFilter, setCompletionFilter] = useState<"all" | "incomplete" | "complete">("all");
  const [completionHeightVersion, setCompletionHeightVersion] = useState(0);
  const [completionOpenAlbumId, setCompletionOpenAlbumId] = useState<number | null>(null);
  const [completionLoadingAlbumId, setCompletionLoadingAlbumId] = useState<number | null>(null);
  const [completionLookupAlbumId, setCompletionLookupAlbumId] = useState<number | null>(null);
  const [completionLookupMessages, setCompletionLookupMessages] = useState<Record<number, string>>({});
  const [completionLookupAllActive, setCompletionLookupAllActive] = useState(false);
  const [completionLookupAllProgress, setCompletionLookupAllProgress] = useState<{
    completed: number;
    total: number;
    matched: number;
    failed: number;
    etaSeconds: number | null;
  } | null>(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [virtualScrollTop, setVirtualScrollTop] = useState(scrollTop);
  const [trackViewportHeight, setTrackViewportHeight] = useState(720);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRenderFrameRef = useRef<number | null>(null);
  const pendingRenderScrollTopRef = useRef(scrollTop);
  const scrollSaveTimerRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(scrollTop);
  const lastSavedScrollTopRef = useRef(scrollTop);
  const trackPageLoadInFlightRef = useRef(false);
  const restoringTrackScrollRef = useRef(false);
  const restoreScrollTargetRef = useRef(scrollTop);
  const restoreScrollFrameRef = useRef<number | null>(null);
  const suppressScrollSaveRef = useRef(false);
  const lastTrackCountRef = useRef(tracks.length);
  const artistListRef = useRef<HTMLElement | null>(null);
  const albumListRef = useRef<HTMLElement | null>(null);
  const completionListRef = useRef<HTMLDivElement | null>(null);
  const completionRowHeightsRef = useRef<Map<number, number>>(new Map());
  const completionRowObserversRef = useRef<Map<number, ResizeObserver>>(new Map());
  const playlistListRef = useRef<HTMLElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextSubmenuCloseTimer = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectionAnchorId = useRef<number | null>(null);
  const completionLookupCancelRef = useRef(false);

  const visibleColumns = normalizeLibraryColumns(libraryVisibleColumns);
  const visibleColumnDefs = visibleColumns
    .map((key) => libraryColumnDefinitions.find((column) => column.key === key))
    .filter((column): column is LibraryColumnDefinition => Boolean(column));
  const advancedSearchActiveCount = Object.entries(advancedTrackSearch).filter(([key, value]) => {
    if (key === "rating_state") {
      return value !== undefined && value !== "any";
    }
    return typeof value === "boolean" ? value : Boolean(String(value ?? "").trim());
  }).length;
  const trackSearchActive = Boolean(search.trim()) || advancedSearchActiveCount > 0;
  const libraryHasAnyTracks = (libraryStats?.total_tracks ?? (trackSearchActive ? Math.max(totalTracks, tracks.length, 1) : totalTracks)) > 0;
  const tableWidth = librarySelectionColumnWidth + columnWidths.play + visibleColumnDefs.reduce((total, column) => total + columnWidths[column.key], 0);
  const rowPadding = compactRows ? "px-3 py-2" : "px-3 py-3";
  const trackRowHeight = compactRows ? 49 : 57;
  const loadedTrackCount = trackIndexCache.size;
  const shouldVirtualizeTrackRows = libraryView === "tracks" && totalTracks > TRACK_VIRTUALIZATION_THRESHOLD;
  const maxVirtualScrollTop = Math.max(0, totalTracks * trackRowHeight - trackViewportHeight);
  const effectiveVirtualScrollTop = Math.min(virtualScrollTop, maxVirtualScrollTop);
  const virtualTrackStartIndex = shouldVirtualizeTrackRows
    ? Math.max(0, Math.floor(effectiveVirtualScrollTop / trackRowHeight) - TRACK_VIRTUALIZATION_OVERSCAN)
    : 0;
  const virtualTrackVisibleCount = Math.ceil(trackViewportHeight / trackRowHeight) + TRACK_VIRTUALIZATION_OVERSCAN * 2;
  const virtualTrackEndIndex = shouldVirtualizeTrackRows
    ? Math.min(totalTracks, virtualTrackStartIndex + virtualTrackVisibleCount)
    : tracks.length;
  const renderedTrackList = shouldVirtualizeTrackRows ? tracks.slice(virtualTrackStartIndex, virtualTrackEndIndex) : tracks;
  const virtualTopSpacerHeight = shouldVirtualizeTrackRows ? virtualTrackStartIndex * trackRowHeight : 0;
  const virtualBottomSpacerHeight = shouldVirtualizeTrackRows ? Math.max(0, (totalTracks - virtualTrackEndIndex) * trackRowHeight) : 0;
  const advancedSearchInputClass = "h-9 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2";
  const activeAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null;
  const activeArtist = artists.find((artist) => artist.name === selectedArtistName) ?? null;
  const activePlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null;
  const missingMetadataRows = libraryHealth?.missing_metadata ?? [];
  const filteredMissingMetadataRows = missingMetadataRows.filter((track) => {
    if (missingMetadataFilter === "all") {
      return true;
    }
    return missingMetadataFields(track).some((field) => field.id === missingMetadataFilter);
  });
  const visibleMissingMetadataRows = showAllMissingMetadata
    ? filteredMissingMetadataRows
    : filteredMissingMetadataRows.slice(0, 30);
  const visibleDuplicateGroups = showAllDuplicateGroups
    ? libraryHealth?.duplicate_groups ?? []
    : (libraryHealth?.duplicate_groups ?? []).slice(0, 8);
  const completionQuery = search.trim().toLowerCase();
  const completionSearchTerms = completionQuery.split(/\s+/).filter(Boolean);
  const completionMatchesSearch = (...values: Array<string | number | null | undefined>) => {
    if (completionSearchTerms.length === 0) {
      return true;
    }
    const haystack = values
      .filter((value) => value !== null && value !== undefined)
      .map(String)
      .join(" ")
      .toLowerCase();
    const compactHaystack = haystack.replace(/[^a-z0-9]+/g, "");
    return completionSearchTerms.every((term) => {
      const compactTerm = term.replace(/[^a-z0-9]+/g, "");
      return haystack.includes(term) || Boolean(compactTerm && compactHaystack.includes(compactTerm));
    });
  };
  const albumCompletionExpected = (album: AlbumSummary) => Math.max(album.expected_track_count ?? album.track_count, album.track_count);
  const albumCompletionMissing = (album: AlbumSummary) => Math.max(0, albumCompletionExpected(album) - album.track_count);
  const completionAlbums = useMemo(
    () =>
      albums
        .filter((album) => albumCompletionMissing(album) > 0)
        .sort((left, right) => (right.missing_track_count ?? 0) - (left.missing_track_count ?? 0)),
    [albums],
  );
  const visibleCompletionAlbums = useMemo(
    () =>
      albums
        .filter((album) => {
          const missing = albumCompletionMissing(album);
          if (completionFilter === "incomplete" && missing === 0) {
            return false;
          }
          if (completionFilter === "complete" && missing > 0) {
            return false;
          }
          return completionMatchesSearch(album.album, album.album_artist, album.year);
        })
        .sort((left, right) => {
          const missingDelta = albumCompletionMissing(right) - albumCompletionMissing(left);
          if (completionFilter === "all" && missingDelta !== 0) {
            return missingDelta;
          }
          return display(left.album, "Unknown album").localeCompare(display(right.album, "Unknown album"));
        }),
    [albums, completionFilter, completionQuery],
  );
  const completionListScrollTop = Math.max(0, completionScrollTop - (completionListRef.current?.offsetTop ?? 0));
  const completionWindow = useMemo(
    () =>
      virtualVariableCollectionWindow(
        visibleCompletionAlbums,
        completionListScrollTop,
        trackViewportHeight,
        (album) =>
          completionRowHeightsRef.current.get(album.id) ??
          (completionOpenAlbumId === album.id ? COMPLETION_EXPANDED_ROW_ESTIMATE : COMPLETION_COLLAPSED_ROW_HEIGHT),
      ),
    [completionHeightVersion, completionListScrollTop, completionOpenAlbumId, trackViewportHeight, visibleCompletionAlbums],
  );
  const renderedCompletionAlbums = visibleCompletionAlbums.slice(completionWindow.startIndex, completionWindow.endIndex);
  const artistWindow = virtualCollectionWindow(artists.length, artistScrollTop, artistPaneHeight, ARTIST_ROW_HEIGHT);
  const renderedArtists = artists.slice(artistWindow.startIndex, artistWindow.endIndex);
  const albumGridColumns = albumGrid ? 2 : 1;
  const albumBrowseRowHeight = albumGrid ? ALBUM_GRID_ROW_HEIGHT : ALBUM_LIST_ROW_HEIGHT;
  const albumWindow = virtualCollectionWindow(albums.length, albumScrollTop, albumPaneHeight, albumBrowseRowHeight, albumGridColumns);
  const renderedBrowseAlbums = albums.slice(albumWindow.startIndex, albumWindow.endIndex);
  const playlistWindow = virtualCollectionWindow(
    playlists.length,
    Math.max(0, playlistScrollTop - PLAYLIST_TOOLBAR_HEIGHT),
    playlistPaneHeight,
    PLAYLIST_ROW_HEIGHT,
  );
  const renderedPlaylists = playlists.slice(playlistWindow.startIndex, playlistWindow.endIndex);
  const completeAlbumCount = albums.length - completionAlbums.length;
  const missingTrackEstimate = completionAlbums.reduce((total, album) => total + (album.missing_track_count ?? 0), 0);
  const advancedSelectionKey = useMemo(() => JSON.stringify(advancedTrackSearch), [advancedTrackSearch]);
  const completionLookupEta =
    completionLookupAllActive && completionLookupAllProgress
      ? completionLookupAllProgress.etaSeconds === null
        ? "estimating ETA..."
        : completionLookupAllProgress.etaSeconds < 1
          ? "ETA under 1 sec"
          : `ETA ${formatDuration(completionLookupAllProgress.etaSeconds)}`
      : null;
  const librarySummaryText =
    libraryView === "albums" && albumMode === "completion"
      ? `${visibleCompletionAlbums.length.toLocaleString()} matching album${visibleCompletionAlbums.length === 1 ? "" : "s"}`
      : libraryView === "albums"
        ? `${albums.length.toLocaleString()} album${albums.length === 1 ? "" : "s"}`
        : libraryView === "artists"
          ? `${artists.length.toLocaleString()} artist${artists.length === 1 ? "" : "s"}`
          : libraryView === "playlists"
            ? `${playlists.length.toLocaleString()} playlist${playlists.length === 1 ? "" : "s"}`
            : libraryView === "inbox"
              ? `${(inbox?.total_new ?? 0).toLocaleString()} new inbox track${inbox?.total_new === 1 ? "" : "s"}`
              : libraryView === "health"
                ? "Library health tools"
                : `${loadedTrackCount.toLocaleString()} of ${totalTracks.toLocaleString()} tracks cached`;
  const viewTracks =
    libraryView === "albums"
      ? selectedAlbumTracks
      : libraryView === "artists"
        ? selectedArtistTracks
        : libraryView === "playlists"
          ? selectedPlaylistTracks
          : libraryView === "inbox"
            ? inbox?.tracks ?? []
            : tracks;
  const viewTrackLookup = useMemo(() => new Map(viewTracks.map((track) => [track.id, track] as const)), [viewTracks]);
  const selectedIds = useMemo(() => Array.from(selectedTrackIds), [selectedTrackIds]);
  const selectedTracks = selectedIds
    .map((trackId) => selectedTrackCache.get(trackId) ?? viewTrackLookup.get(trackId))
    .filter((track): track is Track => Boolean(track));
  const selectableTrackCount = libraryView === "tracks" ? totalTracks : viewTracks.length;
  const allViewSelected =
    selectableTrackCount > 0 &&
    (libraryView === "tracks"
      ? selectedTrackIds.size >= selectableTrackCount
      : viewTracks.every((track) => selectedTrackIds.has(track.id)));
  const inboxNotesByTrackId = new Map((inbox?.notes ?? []).map((note) => [note.track_id, note]));
  const selectedInboxTrack = libraryView === "inbox" && selectedTracks.length === 1 ? selectedTracks[0] : null;
  const selectedInboxNote = selectedInboxTrack ? inboxNotesByTrackId.get(selectedInboxTrack.id) ?? null : null;

  useEffect(() => {
    setSelectedTrackCache((current) => {
      let changed = false;
      const next = new Map(current);
      for (const track of viewTracks) {
        if (next.get(track.id) !== track) {
          next.set(track.id, track);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [viewTracks]);

  useEffect(() => {
    clearSelection();
  }, [libraryView, search, advancedSelectionKey, selectedAlbumId, selectedArtistName, selectedPlaylistId]);

  useEffect(() => {
    if (libraryView === "tracks") {
      return;
    }
    const visibleIds = new Set(viewTracks.map((track) => track.id));
    setSelectedTrackIds((current) => {
      const next = new Set(Array.from(current).filter((trackId) => visibleIds.has(trackId)));
      return next.size === current.size ? current : next;
    });
  }, [libraryView, viewTracks]);

  useEffect(() => {
    setInboxNoteDraft(selectedInboxNote?.note ?? "");
  }, [selectedInboxTrack?.id, selectedInboxNote?.updated_at]);

  useEffect(() => {
    setCompletionOpenAlbumId(null);
  }, [completionFilter, completionQuery, albums.length, albumMode]);

  useEffect(() => {
    if (libraryView === "completion") {
      setAlbumMode("completion");
      setLibraryView("albums");
    }
  }, [libraryView, setLibraryView]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    if (libraryView !== "tracks") {
      restoringTrackScrollRef.current = false;
      suppressScrollSaveRef.current = true;
      const nextScrollTop = libraryView === "albums" && albumMode === "completion" ? completionScrollTop : 0;
      element.scrollTop = nextScrollTop;
      pendingRenderScrollTopRef.current = nextScrollTop;
      setVirtualScrollTop(nextScrollTop);
      if (restoreScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreScrollFrameRef.current);
      }
      restoreScrollFrameRef.current = window.requestAnimationFrame(() => {
        restoreScrollFrameRef.current = null;
        suppressScrollSaveRef.current = false;
      });
      return;
    }
    restoreScrollTargetRef.current = scrollTop;
    restoringTrackScrollRef.current = libraryView === "tracks" && scrollTop > 0;
    pendingScrollTopRef.current = scrollTop;
    lastSavedScrollTopRef.current = scrollTop;
    const reachedTarget = applyScrollRestore(element, scrollTop);
    if (reachedTarget) {
      restoringTrackScrollRef.current = false;
    }
  }, [albumMode, libraryView]);

  useLayoutEffect(() => {
    if (libraryView !== "tracks") {
      lastTrackCountRef.current = tracks.length;
      return;
    }
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const targetScrollTop = restoreScrollTargetRef.current;
    const reachableScrollTop = getReachableScrollTop(element);
    const trackCountShrank = tracks.length < lastTrackCountRef.current;
    lastTrackCountRef.current = tracks.length;
    if (trackCountShrank && targetScrollTop > reachableScrollTop + 4 && hasMoreTracks) {
      restoringTrackScrollRef.current = true;
    }
    if (!restoringTrackScrollRef.current) {
      return;
    }
    const reachedTarget = applyScrollRestore(element, targetScrollTop);
    if (reachedTarget || !hasMoreTracks) {
      restoringTrackScrollRef.current = false;
      pendingScrollTopRef.current = element.scrollTop;
      lastSavedScrollTopRef.current = element.scrollTop;
    }
  }, [hasMoreTracks, libraryView, totalTracks, tracks.length, trackViewportHeight]);

  useEffect(() => {
    if (!restoringTrackScrollRef.current || libraryView !== "tracks" || isLoading || !hasMoreTracks) {
      return;
    }
    const element = scrollRef.current;
    if (!element || trackPageLoadInFlightRef.current) {
      return;
    }
    const reachableScrollTop = getReachableScrollTop(element);
    if (restoreScrollTargetRef.current <= reachableScrollTop + 4) {
      return;
    }
    trackPageLoadInFlightRef.current = true;
    void Promise.resolve(loadMoreTracks()).finally(() => {
      trackPageLoadInFlightRef.current = false;
    });
  }, [hasMoreTracks, isLoading, libraryView, loadMoreTracks, totalTracks, tracks.length, trackViewportHeight]);

  useEffect(() => {
    if (libraryView !== "tracks" || !shouldVirtualizeTrackRows || totalTracks <= 0) {
      return;
    }
    const firstPrefetchIndex = Math.max(0, virtualTrackStartIndex - LIBRARY_PAGE_SIZE);
    const lastPrefetchIndex = Math.min(totalTracks - 1, virtualTrackEndIndex + LIBRARY_PAGE_SIZE);
    const firstPageOffset = Math.floor(firstPrefetchIndex / LIBRARY_PAGE_SIZE) * LIBRARY_PAGE_SIZE;
    const lastPageOffset = Math.floor(lastPrefetchIndex / LIBRARY_PAGE_SIZE) * LIBRARY_PAGE_SIZE;
    for (let offset = firstPageOffset; offset <= lastPageOffset; offset += LIBRARY_PAGE_SIZE) {
      const pageEnd = Math.min(totalTracks, offset + LIBRARY_PAGE_SIZE);
      let hasMissingRows = false;
      for (let index = offset; index < pageEnd; index += 1) {
        if (!trackIndexCache.has(index)) {
          hasMissingRows = true;
          break;
        }
      }
      if (hasMissingRows) {
        void loadTrackWindow(offset, pageEnd - offset);
      }
    }
  }, [
    libraryView,
    loadTrackWindow,
    shouldVirtualizeTrackRows,
    totalTracks,
    trackIndexCache,
    virtualTrackEndIndex,
    virtualTrackStartIndex,
  ]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return undefined;
    }
    const updateHeight = () => setTrackViewportHeight(Math.max(240, element.clientHeight || 720));
    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => window.removeEventListener("resize", updateHeight);
    }
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const paneConfigs: Array<[MutableRefObject<HTMLElement | null>, (height: number) => void]> = [
      [artistListRef, setArtistPaneHeight],
      [albumListRef, setAlbumPaneHeight],
      [playlistListRef, setPlaylistPaneHeight],
    ];
    const cleanups = paneConfigs.map(([ref, setHeight]) => {
      const element = ref.current;
      if (!element) {
        return () => undefined;
      }
      const updateHeight = () => setHeight(Math.max(240, element.clientHeight || 720));
      updateHeight();
      if (typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
      }
      const observer = new ResizeObserver(updateHeight);
      observer.observe(element);
      return () => observer.disconnect();
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [libraryView, albumMode]);

  useLayoutEffect(() => {
    if (libraryView !== "artists" || !artistListRef.current) {
      return;
    }
    artistListRef.current.scrollTop = artistScrollTop;
  }, [artists.length, artistScrollTop, libraryView]);

  useLayoutEffect(() => {
    if (libraryView !== "albums" || albumMode !== "browse" || !albumListRef.current) {
      return;
    }
    albumListRef.current.scrollTop = albumScrollTop;
  }, [albumMode, albumScrollTop, albums.length, libraryView]);

  useLayoutEffect(() => {
    if (libraryView !== "playlists" || !playlistListRef.current) {
      return;
    }
    playlistListRef.current.scrollTop = playlistScrollTop;
  }, [libraryView, playlistScrollTop, playlists.length]);

  useEffect(() => {
    return () => {
      for (const observer of completionRowObserversRef.current.values()) {
        observer.disconnect();
      }
      completionRowObserversRef.current.clear();
    };
  }, []);

  function getReachableScrollTop(element: HTMLElement) {
    return Math.max(0, element.scrollHeight - element.clientHeight);
  }

  function applyScrollRestore(element: HTMLElement, targetScrollTop: number) {
    const reachableScrollTop = getReachableScrollTop(element);
    const nextScrollTop = Math.min(targetScrollTop, reachableScrollTop);
    suppressScrollSaveRef.current = true;
    element.scrollTop = nextScrollTop;
    pendingRenderScrollTopRef.current = nextScrollTop;
    setVirtualScrollTop((current) => (Math.abs(current - nextScrollTop) < 4 ? current : nextScrollTop));
    if (restoreScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreScrollFrameRef.current);
    }
    restoreScrollFrameRef.current = window.requestAnimationFrame(() => {
      restoreScrollFrameRef.current = null;
      suppressScrollSaveRef.current = false;
    });
    return targetScrollTop <= reachableScrollTop + 4;
  }

  function cancelScrollRestoreForUserInput() {
    if (!restoringTrackScrollRef.current) {
      return;
    }
    restoringTrackScrollRef.current = false;
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    pendingScrollTopRef.current = element.scrollTop;
    scheduleScrollPositionSave(element.scrollTop);
  }

  function scrollCollectionPaneToTop(ref: MutableRefObject<HTMLElement | null>, saveScrollTop: (value: number) => void) {
    saveScrollTop(0);
    ref.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveTrackPaneScrollTop(value: number) {
    pendingRenderScrollTopRef.current = value;
    setVirtualScrollTop(value);
    scheduleScrollPositionSave(value);
  }

  function renderPaneTopButton(
    visible: boolean,
    label: string,
    ref: MutableRefObject<HTMLElement | null>,
    saveScrollTop: (value: number) => void,
    placement: "fixed" | "pane" = "pane",
  ) {
    if (!visible) {
      return null;
    }
    const placementClass =
      placement === "fixed"
        ? "fixed bottom-32 right-5 z-[80]"
        : "absolute bottom-4 right-4 z-30";
    return (
      <button
        aria-label={label}
        className={`${placementClass} grid h-9 w-9 place-items-center rounded-full border border-line bg-panel/95 text-muted shadow-lg shadow-black/30 backdrop-blur transition hover:border-moss/60 hover:text-white`}
        type="button"
        title={label}
        onClick={() => scrollCollectionPaneToTop(ref, saveScrollTop)}
      >
        <ArrowUp size={15} />
      </button>
    );
  }

  function renderActiveTopButton() {
    if (libraryView === "tracks") {
      return renderPaneTopButton(Math.max(virtualScrollTop, scrollTop) > 160, "Back to top", scrollRef, saveTrackPaneScrollTop, "fixed");
    }
    if (libraryView === "albums" && albumMode === "completion") {
      return renderPaneTopButton(completionScrollTop > 160, "Back to top", scrollRef, setCompletionScrollTop, "fixed");
    }
    return null;
  }

  function updateCompletionRowHeight(albumId: number, height: number) {
    const previous = completionRowHeightsRef.current.get(albumId);
    if (previous !== undefined && Math.abs(previous - height) < 2) {
      return;
    }
    completionRowHeightsRef.current.set(albumId, height);
    setCompletionHeightVersion((current) => current + 1);
  }

  function setCompletionRowElement(albumId: number, element: HTMLDivElement | null) {
    const existingObserver = completionRowObserversRef.current.get(albumId);
    if (existingObserver) {
      existingObserver.disconnect();
      completionRowObserversRef.current.delete(albumId);
    }
    if (!element) {
      return;
    }

    const measure = () => updateCompletionRowHeight(albumId, element.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    completionRowObserversRef.current.set(albumId, observer);
  }

  function scheduleVirtualScrollUpdate(nextScrollTop: number) {
    pendingRenderScrollTopRef.current = nextScrollTop;
    if (scrollRenderFrameRef.current !== null) {
      return;
    }
    scrollRenderFrameRef.current = window.requestAnimationFrame(() => {
      scrollRenderFrameRef.current = null;
      const next = pendingRenderScrollTopRef.current;
      setVirtualScrollTop((current) => (Math.abs(current - next) < 4 ? current : next));
    });
  }

  function flushScrollPositionSave() {
    const nextScrollTop = pendingScrollTopRef.current;
    if (nextScrollTop === lastSavedScrollTopRef.current) {
      return;
    }
    lastSavedScrollTopRef.current = nextScrollTop;
    setScrollTop(nextScrollTop);
  }

  function scheduleScrollPositionSave(nextScrollTop: number) {
    restoreScrollTargetRef.current = nextScrollTop;
    pendingScrollTopRef.current = nextScrollTop;
    if (scrollSaveTimerRef.current !== null) {
      window.clearTimeout(scrollSaveTimerRef.current);
    }
    // Persist the restore point after scrolling settles so wheel/touchpad movement stays on the compositor path.
    scrollSaveTimerRef.current = window.setTimeout(() => {
      scrollSaveTimerRef.current = null;
      flushScrollPositionSave();
    }, 160);
  }

  useEffect(() => {
    return () => {
      if (scrollRenderFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollRenderFrameRef.current);
        scrollRenderFrameRef.current = null;
      }
      if (scrollSaveTimerRef.current !== null) {
        window.clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = null;
      }
      if (restoreScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreScrollFrameRef.current);
        restoreScrollFrameRef.current = null;
      }
      flushScrollPositionSave();
    };
  }, []);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
      setColumnMenu(null);
      setLibraryActionsMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  useEffect(() => {
    if (isAlbumArtworkOpen && activeAlbum) {
      void loadAlbumArtworkCandidates(activeAlbum.id);
    }
  }, [activeAlbum?.id, isAlbumArtworkOpen]);

  function resetInboxRuleForm() {
    setEditingInboxRuleId(null);
    setInboxRuleName("");
    setInboxRuleEnabled(true);
    setInboxRuleField("genre");
    setInboxRuleMatchType("contains");
    setInboxRuleValue("");
    setInboxRuleNote("");
    setInboxRuleApplyExisting(false);
  }

  function editInboxRule(rule: InboxAutoReviewRule) {
    setEditingInboxRuleId(rule.id);
    setInboxRuleName(rule.name);
    setInboxRuleEnabled(rule.enabled);
    setInboxRuleField(rule.field);
    setInboxRuleMatchType(rule.match_type);
    setInboxRuleValue(rule.value);
    setInboxRuleNote(rule.note ?? "");
    setInboxRuleApplyExisting(false);
  }

  async function saveInboxRule() {
    const request: InboxAutoReviewRuleRequest = {
      name: inboxRuleName,
      enabled: inboxRuleEnabled,
      field: inboxRuleField,
      match_type: inboxRuleMatchType,
      value: inboxRuleMatchType === "is_empty" || inboxRuleMatchType === "is_not_empty" ? "" : inboxRuleValue,
      note: inboxRuleNote.trim() || null,
      apply_existing: inboxRuleApplyExisting,
    };
    await onSaveInboxAutoReviewRule(request, editingInboxRuleId ?? undefined);
    resetInboxRuleForm();
  }

  useEffect(() => {
    function handleLibraryShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (target?.closest("input, textarea, select, button, a, [contenteditable='true']")) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        void selectAllCurrentScope();
        return;
      }
      if (event.key === "F2") {
        const editableTrack = selectedTracks[0] ?? detailTrack;
        if (!editableTrack) {
          return;
        }
        event.preventDefault();
        if (selectedIds.length > 1) {
          setBulkMetadataOpen(true);
        } else {
          onEditTrack(editableTrack);
        }
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "e" && selectedIds.length > 0) {
        event.preventDefault();
        setBulkMetadataOpen(true);
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "d" && libraryView === "health") {
        event.preventDefault();
        setShowAllDuplicateGroups((current) => !current);
        return;
      }
      if (
        event.key !== "Delete" ||
        selectedIds.length === 0 && !detailTrack
      ) {
        return;
      }
      event.preventDefault();
      if (selectedIds.length > 0) {
        onRequestDeleteTracks(
          selectedIds,
          selectedIds.length === 1
            ? display(selectedTracks[0]?.title, "Selected track")
            : `${selectedIds.length.toLocaleString()} selected tracks`,
        );
      } else if (detailTrack) {
        onRequestDeleteTracks([detailTrack.id], display(detailTrack.title, "Selected track"));
      }
    }

    window.addEventListener("keydown", handleLibraryShortcut);
    return () => window.removeEventListener("keydown", handleLibraryShortcut);
  }, [selectedIds, selectedTracks, detailTrack, libraryView, search, sort, advancedTrackSearch, tracks.length, totalTracks, viewTracks, onEditTrack, onRequestDeleteTracks]);

  function handleSort(key: SortKey) {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }

  function handleResize(column: string, width: number) {
    if (!(column in columnWidths)) {
      return;
    }
    setColumnWidths((current) => ({ ...current, [column as LibraryColumnKey]: width }));
  }

  function toggleTrackSelection(trackId: number) {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function selectSingleTrack(track: Track) {
    selectionAnchorId.current = track.id;
    setSelectedTrackIds(new Set([track.id]));
    setSelectedTrackCache((current) => {
      if (current.get(track.id) === track) {
        return current;
      }
      const next = new Map(current);
      next.set(track.id, track);
      return next;
    });
  }

  function selectTrackLikeWindows(event: ReactMouseEvent, track: Track, list: Track[]) {
    setDetailTrack(track);
    const extendRange = event.shiftKey && selectionAnchorId.current !== null;
    const keepExisting = event.ctrlKey || event.metaKey;

    if (extendRange) {
      const anchorIndex = list.findIndex((item) => item.id === selectionAnchorId.current);
      const targetIndex = list.findIndex((item) => item.id === track.id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        const rangeIds = list.slice(start, end + 1).map((item) => item.id);
        setSelectedTrackIds((current) => {
          const next = keepExisting ? new Set(current) : new Set<number>();
          for (const trackId of rangeIds) {
            next.add(trackId);
          }
          return next;
        });
        return;
      }
    }

    selectionAnchorId.current = track.id;
    if (keepExisting) {
      toggleTrackSelection(track.id);
    } else {
      selectSingleTrack(track);
    }
  }

  function setSelectionForList(list: Track[], selected: boolean) {
    selectionAnchorId.current = selected ? list[0]?.id ?? null : null;
    if (selected) {
      setSelectedTrackCache((current) => {
        let changed = false;
        const next = new Map(current);
        for (const track of list) {
          if (next.get(track.id) !== track) {
            next.set(track.id, track);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      for (const track of list) {
        if (selected) {
          next.add(track.id);
        } else {
          next.delete(track.id);
        }
      }
      return next;
    });
  }

  async function selectAllCurrentScope() {
    if (libraryView !== "tracks" || tracks.length >= totalTracks) {
      setSelectionForList(viewTracks, true);
      return;
    }

    setIsSelectingAllTracks(true);
    try {
      const allTracks = await fetchTracks(search, {
        sortBy: sort.key,
        sortDirection: sort.direction,
        advancedFilters: advancedTrackSearch,
      });
      setSelectedTrackCache((current) => {
        const next = new Map(current);
        for (const track of allTracks) {
          next.set(track.id, track);
        }
        return next;
      });
      setSelectedTrackIds(new Set(allTracks.map((track) => track.id)));
      selectionAnchorId.current = allTracks[0]?.id ?? null;
    } catch {
      setSelectionForList(viewTracks, true);
    } finally {
      setIsSelectingAllTracks(false);
    }
  }

  function handleHeaderSelectionChange(checked: boolean) {
    if (!checked) {
      clearSelection();
      return;
    }
    void selectAllCurrentScope();
  }

  function suppressCheckboxContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function clearSelection() {
    setSelectedTrackIds(new Set());
    selectionAnchorId.current = null;
  }

  async function loadAlbumArtworkCandidates(albumId: number) {
    try {
      const response = await fetchAlbumArtworkCandidates(albumId);
      setAlbumArtworkCandidates(response.candidates);
      setAlbumArtworkStatus(
        response.candidates.length
          ? `${response.candidates.length.toLocaleString()} artwork candidate${response.candidates.length === 1 ? "" : "s"}`
          : "No sidecar or embedded artwork candidates found",
      );
    } catch (error) {
      setAlbumArtworkStatus(error instanceof Error ? error.message : "Could not load album artwork");
    }
  }

  async function openAlbumArtworkManager(albumId: number) {
    setIsAlbumArtworkOpen(true);
    await loadAlbumArtworkCandidates(albumId);
  }

  function albumArtworkActionStatus(prefix: string, response: { embedded_updated?: number; errors?: string[] }) {
    const embedded = response.embedded_updated ?? 0;
    const errors = response.errors ?? [];
    const parts = [prefix];
    if (embedded) {
      parts.push(`embedded into ${embedded.toLocaleString()} file${embedded === 1 ? "" : "s"}`);
    }
    if (errors.length) {
      parts.push(`${errors.length.toLocaleString()} warning${errors.length === 1 ? "" : "s"}`);
    }
    return parts.join(" - ");
  }

  async function chooseSidecarArtwork(albumId: number, path: string) {
    try {
      const response = await chooseAlbumArtwork(albumId, path);
      setAlbumArtworkCandidates(response.candidates);
      setAlbumArtworkStatus("Album artwork selected");
      void refreshTracks();
    } catch (error) {
      setAlbumArtworkStatus(error instanceof Error ? error.message : "Could not choose album artwork");
    }
  }

  async function embedSidecarArtwork(albumId: number, path: string) {
    try {
      const response = await embedAlbumArtworkFromPath(albumId, path);
      setAlbumArtworkCandidates(response.candidates);
      setAlbumArtworkStatus(albumArtworkActionStatus("Album artwork embedded", response));
      void refreshTracks();
    } catch (error) {
      setAlbumArtworkStatus(error instanceof Error ? error.message : "Could not embed album artwork");
    }
  }

  async function saveEmbeddedArtwork(albumId: number, trackId: number) {
    try {
      const response = await saveEmbeddedAlbumArtwork(albumId, trackId);
      setAlbumArtworkCandidates(response.candidates);
      setAlbumArtworkStatus("Embedded artwork saved as sidecar");
      void refreshTracks();
    } catch (error) {
      setAlbumArtworkStatus(error instanceof Error ? error.message : "Could not save embedded artwork");
    }
  }

  async function embedEmbeddedArtwork(albumId: number, trackId: number) {
    try {
      const response = await embedEmbeddedAlbumArtwork(albumId, trackId);
      setAlbumArtworkCandidates(response.candidates);
      setAlbumArtworkStatus(albumArtworkActionStatus("Embedded artwork copied", response));
      void refreshTracks();
    } catch (error) {
      setAlbumArtworkStatus(error instanceof Error ? error.message : "Could not embed artwork into files");
    }
  }

  async function searchWebArtwork(albumId: number) {
    setIsSearchingAlbumArtwork(true);
    setAlbumArtworkStatus("Searching MusicBrainz and Cover Art Archive...");
    try {
      const response = await searchAlbumArtworkWeb(albumId);
      setAlbumArtworkCandidates((current) => [
        ...current.filter((candidate) => candidate.source !== "web"),
        ...response.candidates,
      ]);
      setAlbumArtworkStatus(
        response.candidates.length
          ? `${response.candidates.length.toLocaleString()} web artwork candidate${response.candidates.length === 1 ? "" : "s"}`
          : response.errors[0] ?? "No web artwork found",
      );
    } catch (error) {
      setAlbumArtworkStatus(error instanceof Error ? error.message : "Could not search for artwork");
    } finally {
      setIsSearchingAlbumArtwork(false);
    }
  }

  async function saveWebArtwork(albumId: number, artworkUrl: string, embedToFiles = false) {
    try {
      const response = await saveWebAlbumArtwork(albumId, artworkUrl, embedToFiles);
      setAlbumArtworkCandidates(response.candidates);
      setAlbumArtworkStatus(albumArtworkActionStatus(embedToFiles ? "Web artwork saved and embedded" : "Web artwork saved", response));
      void refreshTracks();
    } catch (error) {
      setAlbumArtworkStatus(error instanceof Error ? error.message : "Could not save web artwork");
    }
  }

  async function clearSelectedAlbumArtwork(albumId: number) {
    try {
      const response = await clearAlbumArtwork(albumId);
      setAlbumArtworkCandidates(response.candidates);
      setAlbumArtworkStatus("Album artwork selection cleared");
      void refreshTracks();
    } catch (error) {
      setAlbumArtworkStatus(error instanceof Error ? error.message : "Could not clear album artwork");
    }
  }

  function handleScroll(event: ReactUIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (contextMenu) {
      setContextMenu(null);
    }
    if (columnMenu) {
      setColumnMenu(null);
    }
    if (libraryActionsMenu) {
      setLibraryActionsMenu(null);
    }
    if (libraryView === "tracks") {
      scheduleVirtualScrollUpdate(element.scrollTop);
    }
    if (libraryView === "albums" && albumMode === "completion" && !suppressScrollSaveRef.current) {
      setCompletionScrollTop(element.scrollTop);
    }
    if (libraryView === "tracks" && !suppressScrollSaveRef.current && !restoringTrackScrollRef.current) {
      scheduleScrollPositionSave(element.scrollTop);
    }
    if (libraryView !== "tracks") {
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (
      !shouldVirtualizeTrackRows &&
      distanceFromBottom < 520 &&
      hasMoreTracks &&
      !isLoading &&
      !trackPageLoadInFlightRef.current &&
      !restoringTrackScrollRef.current
    ) {
      trackPageLoadInFlightRef.current = true;
      void Promise.resolve(loadMoreTracks()).finally(() => {
        trackPageLoadInFlightRef.current = false;
      });
    }
  }

  function openTrackContextMenu(event: ReactMouseEvent, track: Track, queue: Track[], removable = false) {
    event.preventDefault();
    setDetailTrack(track);
    if (!selectedTrackIds.has(track.id)) {
      selectionAnchorId.current = track.id;
      setSelectedTrackIds(new Set([track.id]));
    }
    setColumnMenu(null);
    setLibraryActionsMenu(null);
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: TRACK_CONTEXT_MENU_WIDTH,
      menuHeight: TRACK_CONTEXT_MENU_HEIGHT,
      submenuWidth: TRACK_CONTEXT_SUBMENU_WIDTH,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setContextMenu({
      track,
      queue,
      removable,
      x: placement.x,
      y: placement.y,
      anchorX: event.clientX,
      anchorY: event.clientY,
      flipY: placement.flipY,
      submenuLeft: placement.submenuLeft,
    });
  }

  function openColumnContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    setContextMenu(null);
    setLibraryActionsMenu(null);
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: 340,
      menuHeight: 520,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setColumnMenu({
      x: placement.x,
      y: placement.y,
    });
  }

  function toggleLibraryActionsMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    setColumnMenu(null);
    setLibraryActionsMenu((current) => {
      if (current) {
        return null;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const placement = placeFloatingMenu({
        cursorX: rect.right - LIBRARY_ACTIONS_MENU_WIDTH,
        cursorY: rect.bottom + 8,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        menuWidth: LIBRARY_ACTIONS_MENU_WIDTH,
        menuHeight: LIBRARY_ACTIONS_MENU_HEIGHT,
        margin: MENU_VIEWPORT_MARGIN,
      });
      return { x: placement.x, y: placement.y };
    });
  }

  function toggleVisibleColumn(column: MetadataColumnKey) {
    if (visibleColumns.includes(column) && visibleColumns.length <= 1) {
      return;
    }
    setLibraryVisibleColumns(
      visibleColumns.includes(column)
        ? visibleColumns.filter((visibleColumn) => visibleColumn !== column)
        : [...visibleColumns, column],
    );
  }

  function moveVisibleColumn(source: MetadataColumnKey, target: MetadataColumnKey, placement: "before" | "after") {
    if (source === target) {
      return;
    }
    const nextColumns = [...visibleColumns];
    const sourceIndex = nextColumns.indexOf(source);
    const targetIndex = nextColumns.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    const [moved] = nextColumns.splice(sourceIndex, 1);
    const currentTargetIndex = nextColumns.indexOf(target);
    nextColumns.splice(placement === "after" ? currentTargetIndex + 1 : currentTargetIndex, 0, moved);
    setLibraryVisibleColumns(nextColumns);
  }

  function handleColumnDragStart(event: ReactDragEvent<HTMLTableCellElement>, column: string) {
    if (!libraryColumnKeySet.has(column as MetadataColumnKey)) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", column);
    setDraggedColumn(column as MetadataColumnKey);
    setDragOverColumn(null);
    setColumnMenu(null);
  }

  function handleColumnDragOver(event: ReactDragEvent<HTMLTableCellElement>, column: string) {
    if (!draggedColumn || draggedColumn === column || !libraryColumnKeySet.has(column as MetadataColumnKey)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverColumn(column as MetadataColumnKey);
  }

  function handleColumnDrop(event: ReactDragEvent<HTMLTableCellElement>, column: string) {
    event.preventDefault();
    const source = event.dataTransfer.getData("text/plain") || draggedColumn;
    if (source && libraryColumnKeySet.has(source as MetadataColumnKey) && libraryColumnKeySet.has(column as MetadataColumnKey)) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const placement = event.clientX > bounds.left + bounds.width / 2 ? "after" : "before";
      moveVisibleColumn(source as MetadataColumnKey, column as MetadataColumnKey, placement);
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function handleColumnDragEnd() {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function columnFromPoint(x: number, y: number): MetadataColumnKey | null {
    const target = document.elementFromPoint(x, y) as HTMLElement | null;
    const header = target?.closest<HTMLElement>("[data-library-column]");
    const column = header?.dataset.libraryColumn;
    return column && libraryColumnKeySet.has(column as MetadataColumnKey) ? (column as MetadataColumnKey) : null;
  }

  function handleColumnPointerDragStart(event: ReactMouseEvent<HTMLButtonElement>, column: string) {
    if (!libraryColumnKeySet.has(column as MetadataColumnKey)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const sourceColumn = column as MetadataColumnKey;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    setDraggedColumn(sourceColumn);
    setDragOverColumn(null);

    function handleMove(moveEvent: MouseEvent) {
      const targetColumn = columnFromPoint(moveEvent.clientX, moveEvent.clientY);
      setDragOverColumn(targetColumn && targetColumn !== sourceColumn ? targetColumn : null);
    }

    function handleUp(upEvent: MouseEvent) {
      const targetColumn = columnFromPoint(upEvent.clientX, upEvent.clientY);
      if (targetColumn && targetColumn !== sourceColumn) {
        const header = document.querySelector<HTMLElement>(`[data-library-column="${targetColumn}"]`);
        const bounds = header?.getBoundingClientRect();
        const placement = bounds && upEvent.clientX > bounds.left + bounds.width / 2 ? "after" : "before";
        moveVisibleColumn(sourceColumn, targetColumn, placement);
      }
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      setDraggedColumn(null);
      setDragOverColumn(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  function columnTextClass(column: LibraryColumnDefinition) {
    return `${column.align === "right" ? "text-right tabular-nums" : "truncate"} ${
      column.key === "artist" ? "text-neutral-200" : column.key === "album" ? "text-neutral-300" : "text-muted"
    }`;
  }

  function renderMetadataCell(track: Track, column: LibraryColumnDefinition) {
    switch (column.key) {
      case "title":
        return (
          <>
            <div className="truncate font-medium text-white">{display(track.title, "Untitled")}</div>
            {!hideFilePaths && !visibleColumns.includes("path") && <div className="truncate text-xs text-muted">{track.path}</div>}
          </>
        );
      case "artist":
        return display(track.artist);
      case "album":
        return display(track.album);
      case "album_artist":
        return display(track.album_artist);
      case "track_number":
        return display(track.track_number, "-");
      case "disc_number":
        return display(track.disc_number, "-");
      case "genre":
        return display(trackGenre(track), "-");
      case "bitrate":
        return formatBitrate(track.bitrate);
      case "replaygain_track_gain_db":
        return track.replaygain_track_gain_db === null || track.replaygain_track_gain_db === undefined
          ? "-"
          : `${track.replaygain_track_gain_db.toFixed(2)} dB`;
      case "replaygain_album_gain_db":
        return track.replaygain_album_gain_db === null || track.replaygain_album_gain_db === undefined
          ? "-"
          : `${track.replaygain_album_gain_db.toFixed(2)} dB`;
      case "replaygain_track_peak":
        return track.replaygain_track_peak === null || track.replaygain_track_peak === undefined
          ? "-"
          : track.replaygain_track_peak.toFixed(3);
      case "replaygain_album_peak":
        return track.replaygain_album_peak === null || track.replaygain_album_peak === undefined
          ? "-"
          : track.replaygain_album_peak.toFixed(3);
      case "analysis_genre":
        return display(track.analysis_genre, "-");
      case "analysis_genre_confidence":
        return track.analysis_genre_confidence !== null && track.analysis_genre_confidence !== undefined
          ? formatPercent(track.analysis_genre_confidence * 100)
          : "-";
      case "analysis_provider":
        return display(track.analysis_provider, "-");
      case "analysis_updated_at":
        return formatShortDate(track.analysis_updated_at);
      case "year":
        return display(track.year, "-");
      case "rating":
        return <RatingStars rating={track.rating} onChange={(rating) => onRating(track.id, rating)} />;
      case "duration_seconds":
        return formatDuration(track.duration_seconds);
      case "play_count":
        return track.play_count.toLocaleString();
      case "skip_count":
        return track.skip_count.toLocaleString();
      case "last_played_at":
        return formatShortDate(track.last_played_at);
      case "last_skipped_at":
        return formatShortDate(track.last_skipped_at);
      case "date_added":
        return formatShortDate(track.date_added);
      case "file_modified_at":
        return formatShortDate(track.file_modified_at);
      case "file_name":
        return fileName(track.path);
      case "audio_fingerprint":
        return formatFingerprint(track.audio_fingerprint);
      case "path":
        return track.path;
      default:
        return "-";
    }
  }

  function renderTableHeader(sortable: boolean) {
    return (
      <tr onContextMenu={openColumnContextMenu}>
        <th className="px-3 py-3">
          <input
            aria-label={libraryView === "tracks" ? "Select all matching tracks" : "Select current view"}
            type="checkbox"
            className="h-4 w-4 accent-moss"
            checked={allViewSelected}
            disabled={selectableTrackCount === 0 || isSelectingAllTracks}
            onChange={(event) => handleHeaderSelectionChange(event.target.checked)}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={suppressCheckboxContextMenu}
          />
        </th>
        <ResizableHeader label="" column="play" width={columnWidths.play} sort={sort} onSort={handleSort} onResize={handleResize} />
        {visibleColumnDefs.map((column) => (
          <ResizableHeader
            key={column.key}
            label={column.label}
            column={column.key}
            width={columnWidths[column.key]}
            sortKey={sortable ? column.sortKey : undefined}
            sort={sort}
            onSort={handleSort}
            onResize={handleResize}
            align={column.align}
            draggableColumn={column.key}
            isDragging={draggedColumn === column.key}
            isDragOver={dragOverColumn === column.key}
            onColumnDragStart={handleColumnDragStart}
            onColumnDragOver={handleColumnDragOver}
            onColumnDrop={handleColumnDrop}
            onColumnDragEnd={handleColumnDragEnd}
            onColumnPointerDragStart={handleColumnPointerDragStart}
          />
        ))}
      </tr>
    );
  }

  function isInteractiveTrackCellTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && Boolean(target.closest("button, a, input, textarea, select, summary, details"));
  }

  function handleLibrarySurfaceClick(event: ReactMouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest("[data-track-row], button, a, input, textarea, select, summary, details, [role='menu']")) {
      return;
    }
    if (selectedTrackIds.size > 0) {
      clearSelection();
    }
  }

  function renderTrackRow(track: Track, interactionList: Track[], removable = false) {
    return (
      <tr
        key={track.id}
        data-track-row
        style={{ height: trackRowHeight }}
        className={`cursor-pointer border-b border-line/60 hover:bg-white/[0.035] ${
          detailTrack?.id === track.id ? "bg-white/[0.06]" : selectedTrackIds.has(track.id) ? "bg-white/[0.035]" : ""
        } select-none`}
        onClick={(event) => {
          if (isInteractiveTrackCellTarget(event.target)) {
            return;
          }
          selectTrackLikeWindows(event, track, interactionList);
        }}
        onDoubleClick={(event) => {
          if (isInteractiveTrackCellTarget(event.target)) {
            return;
          }
          event.preventDefault();
          onPlayTrack(track, interactionList);
        }}
        onContextMenu={(event) => openTrackContextMenu(event, track, interactionList, removable)}
      >
        <td className={rowPadding}>
          <input
            aria-label={`Select ${display(track.title, "track")}`}
            type="checkbox"
            className="pointer-events-none h-4 w-4 accent-moss"
            checked={selectedTrackIds.has(track.id)}
            readOnly
            tabIndex={-1}
          />
        </td>
        <td className={rowPadding}>
          <div className="flex items-center justify-center">
            <button
              className={`icon-button h-8 w-8 ${currentTrackId === track.id ? "border-moss text-moss" : ""}`}
              title={`Play ${display(track.title, "track")}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPlayTrack(track, interactionList);
              }}
            >
              {currentTrackId === track.id ? <Volume2 size={15} /> : <Play size={15} />}
            </button>
          </div>
        </td>
        {visibleColumnDefs.map((column) => (
          <td key={column.key} className={`${rowPadding} ${columnTextClass(column)}`} title={column.key === "path" ? track.path : undefined}>
            {renderMetadataCell(track, column)}
          </td>
        ))}
      </tr>
    );
  }

  function renderTrackPlaceholderRow(index: number) {
    return (
      <tr key={`track-placeholder-${index}`} aria-hidden="true" style={{ height: trackRowHeight }} className="border-b border-line/40">
        <td className={rowPadding}>
          <div className="h-4 w-4 rounded border border-line/70 bg-white/[0.025]" />
        </td>
        <td className={rowPadding}>
          <div className="mx-auto h-8 w-8 rounded border border-line/70 bg-white/[0.025]" />
        </td>
        {visibleColumnDefs.map((column, columnIndex) => (
          <td key={column.key} className={rowPadding}>
            <div
              className="h-3 rounded bg-white/[0.045]"
              style={{ width: columnIndex === 0 ? "72%" : column.align === "right" ? "44%" : "56%" }}
            />
          </td>
        ))}
      </tr>
    );
  }

  function renderVirtualTrackRows() {
    const rows = [];
    for (let index = virtualTrackStartIndex; index < virtualTrackEndIndex; index += 1) {
      const track = trackIndexCache.get(index);
      rows.push(track ? renderTrackRow(track, tracks) : renderTrackPlaceholderRow(index));
    }
    return rows;
  }

  function renderTrackRows(list: Track[], options: { removable?: boolean; interactionList?: Track[] } = {}) {
    const interactionList = options.interactionList ?? list;
    return list.map((track) => renderTrackRow(track, interactionList, Boolean(options.removable)));
  }

  function renderAlbumModeToggle() {
    return (
      <div className="grid min-w-0 grid-cols-2 rounded border border-line bg-ink p-1 text-xs">
        {(
          [
            ["browse", "Browse"],
            ["completion", "Completion"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`h-8 min-w-0 rounded px-2 transition ${
              albumMode === id ? "bg-white/10 text-white" : "text-muted hover:text-white"
            }`}
            type="button"
            onClick={() => setAlbumMode(id)}
          >
            <span className="block truncate">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderAlbumLayoutToggle() {
    return (
      <div className="grid min-w-0 grid-cols-2 rounded border border-line bg-ink p-1 text-xs" aria-label="Album view layout">
        <button
          className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded px-2 transition ${
            albumGrid ? "bg-white/10 text-white" : "text-muted hover:text-white"
          }`}
          type="button"
          title="Show albums as a cover grid"
          aria-pressed={albumGrid}
          onClick={() => onAlbumGridChange(true)}
        >
          <LayoutGrid size={14} />
          <span className="sr-only">Grid</span>
        </button>
        <button
          className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded px-2 transition ${
            !albumGrid ? "bg-white/10 text-white" : "text-muted hover:text-white"
          }`}
          type="button"
          title="Show albums as a compact list"
          aria-pressed={!albumGrid}
          onClick={() => onAlbumGridChange(false)}
        >
          <List size={14} />
          <span className="sr-only">List</span>
        </button>
      </div>
    );
  }

  function toggleCompletionAlbum(albumId: number) {
    if (completionOpenAlbumId === albumId) {
      setCompletionOpenAlbumId(null);
      return;
    }
    setCompletionOpenAlbumId(albumId);
    setCompletionLoadingAlbumId(albumId);
    void Promise.resolve(onSelectAlbum(albumId)).finally(() => {
      setCompletionLoadingAlbumId((current) => (current === albumId ? null : current));
    });
  }

  async function handleCompletionLengthLookup(album: AlbumSummary) {
    setCompletionLookupAlbumId(album.id);
    setCompletionLookupMessages((current) => ({
      ...current,
      [album.id]: "Querying MusicBrainz...",
    }));
    try {
      const result = await lookupAlbumCompletion(album.id);
      setCompletionLookupMessages((current) => ({
        ...current,
        [album.id]: result.expected_track_count
          ? `MusicBrainz reports ${result.expected_track_count.toLocaleString()} tracks${result.release_title ? ` for ${result.release_title}` : ""}.`
          : result.error ?? "MusicBrainz did not find a confident album length.",
      }));
      await refreshAlbums();
    } catch (error) {
      setCompletionLookupMessages((current) => ({
        ...current,
        [album.id]: error instanceof Error ? error.message : "Could not query album length",
      }));
    } finally {
      setCompletionLookupAlbumId((current) => (current === album.id ? null : current));
    }
  }

  async function handleCompletionLookupAll() {
    const targets = visibleCompletionAlbums;
    if (targets.length === 0 || completionLookupAllActive) {
      return;
    }
    if (
      targets.length > 20 &&
      !window.confirm(
        `Lookup album lengths for ${targets.length.toLocaleString()} matching albums? MusicBrainz is rate-limited, so this can take a while.`,
      )
    ) {
      return;
    }

    completionLookupCancelRef.current = false;
    setCompletionLookupAllActive(true);
    setCompletionLookupAllProgress({ completed: 0, total: targets.length, matched: 0, failed: 0, etaSeconds: null });

    let matched = 0;
    let failed = 0;
    let completed = 0;
    const startedAt = Date.now();
    try {
      for (const album of targets) {
        if (completionLookupCancelRef.current) {
          break;
        }
        setCompletionLookupAlbumId(album.id);
        setCompletionLookupMessages((current) => ({
          ...current,
          [album.id]: `Lookup ${completed + 1}/${targets.length}: querying MusicBrainz...`,
        }));
        try {
          const result = await lookupAlbumCompletion(album.id);
          if (result.expected_track_count) {
            matched += 1;
          } else {
            failed += 1;
          }
          setCompletionLookupMessages((current) => ({
            ...current,
            [album.id]: result.expected_track_count
              ? `MusicBrainz reports ${result.expected_track_count.toLocaleString()} tracks${result.release_title ? ` for ${result.release_title}` : ""}.`
              : result.error ?? "MusicBrainz did not find a confident album length.",
          }));
        } catch (error) {
          failed += 1;
          setCompletionLookupMessages((current) => ({
            ...current,
            [album.id]: error instanceof Error ? error.message : "Could not query album length",
          }));
        }
        completed += 1;
        const elapsedSeconds = Math.max(0.001, (Date.now() - startedAt) / 1000);
        const averageSeconds = elapsedSeconds / completed;
        const etaSeconds = Math.max(0, averageSeconds * (targets.length - completed));
        setCompletionLookupAllProgress({ completed, total: targets.length, matched, failed, etaSeconds });
        if (completed % 5 === 0) {
          await refreshAlbums();
        }
      }
      await refreshAlbums();
    } finally {
      setCompletionLookupAlbumId(null);
      setCompletionLookupAllActive(false);
    }
  }

  function cancelCompletionLookupAll() {
    completionLookupCancelRef.current = true;
  }

  function updateAdvancedTrackSearch<K extends keyof AdvancedTrackSearchFilters>(
    key: K,
    value: AdvancedTrackSearchFilters[K],
  ) {
    setAdvancedTrackSearch((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function clearAdvancedTrackSearch() {
    setAdvancedTrackSearch(() => ({}));
  }

  function renderCompletionView() {
    return (
      <div className="min-h-full p-6">
        <div className="mx-auto grid max-w-6xl gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Collection Completion</div>
              <div className="text-xs text-muted">Estimated locally, with optional MusicBrainz length lookups per album.</div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Complete Albums</div>
              <div className="mt-2 text-2xl font-semibold text-white">{completeAlbumCount.toLocaleString()}</div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Incomplete Albums</div>
              <div className="mt-2 text-2xl font-semibold text-ember">{completionAlbums.length.toLocaleString()}</div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Estimated Missing Tracks</div>
              <div className="mt-2 text-2xl font-semibold text-moss">{missingTrackEstimate.toLocaleString()}</div>
            </div>
          </div>
          <div className="rounded border border-line bg-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm font-semibold text-white">Albums</div>
                  <div className="grid grid-cols-3 rounded border border-line bg-ink p-1 text-xs">
                    {(
                      [
                        ["all", "All"],
                        ["incomplete", "Missing"],
                        ["complete", "Completed"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        className={`h-8 rounded px-3 transition ${
                          completionFilter === id ? "bg-white/10 text-white" : "text-muted hover:text-white"
                        }`}
                        type="button"
                        onClick={() => setCompletionFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted">
                  Showing {visibleCompletionAlbums.length.toLocaleString()} matching albums
                  {completionQuery ? ` for "${search.trim()}"` : ""}.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted">
                <button
                  className="secondary-button min-h-8 px-3 py-1.5 text-xs"
                  type="button"
                  disabled={completionLookupAllActive || visibleCompletionAlbums.length === 0}
                  title="Lookup MusicBrainz track counts for every album matching the current completion filter"
                  onClick={() => void handleCompletionLookupAll()}
                >
                  <RefreshCw className={completionLookupAllActive ? "animate-spin" : ""} size={14} />
                  {completionLookupAllActive ? "Looking Up All" : "Lookup All"}
                </button>
                {completionLookupAllActive && (
                  <button
                    className="rounded border border-line px-3 py-1.5 text-xs text-muted transition hover:border-ember hover:text-ember"
                    type="button"
                    onClick={cancelCompletionLookupAll}
                  >
                    Stop
                  </button>
                )}
                <span>{albums.length.toLocaleString()} total albums</span>
              </div>
            </div>
            {completionLookupAllProgress && (
              <div className="border-b border-line/70 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    MusicBrainz lookup {completionLookupAllProgress.completed.toLocaleString()}/
                    {completionLookupAllProgress.total.toLocaleString()}
                  </span>
                  <span>
                    {completionLookupAllProgress.matched.toLocaleString()} matched,{" "}
                    {completionLookupAllProgress.failed.toLocaleString()} not found
                    {completionLookupEta ? ` - ${completionLookupEta}` : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                  <div
                    className="h-full rounded-full bg-ember transition-all"
                    style={{
                      width: `${
                        completionLookupAllProgress.total > 0
                          ? Math.min(100, (completionLookupAllProgress.completed / completionLookupAllProgress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
            <div ref={completionListRef} className="grid divide-y divide-line/60">
              {completionWindow.topSpacerHeight > 0 && (
                <div aria-hidden="true" style={{ height: completionWindow.topSpacerHeight }} />
              )}
              {renderedCompletionAlbums.map((album) => {
                const expected = albumCompletionExpected(album);
                const missing = albumCompletionMissing(album);
                const progress = expected > 0 ? Math.min(100, (album.track_count / expected) * 100) : 100;
                const artwork = album.artwork_path || album.artwork_track_id ? albumCoverUrl(album.id) : null;
                const expanded = completionOpenAlbumId === album.id;
                const tracksReady = expanded && selectedAlbumId === album.id && completionLoadingAlbumId !== album.id;
                const lookupMessage = completionLookupMessages[album.id];
                const queriedTrackCount = album.completion_expected_track_count;
                return (
                  <div
                    key={album.id}
                    ref={(element) => setCompletionRowElement(album.id, element)}
                    className={expanded ? "bg-white/[0.025]" : ""}
                  >
                    <button
                      className="grid w-full gap-3 px-4 py-3 text-left transition hover:bg-white/[0.035] sm:grid-cols-[44px_minmax(0,1fr)_120px]"
                      type="button"
                      onClick={() => toggleCompletionAlbum(album.id)}
                    >
                      <div className="h-11 w-11 overflow-hidden rounded border border-line bg-ink">
                        {artwork ? (
                          <img alt="" className="h-full w-full object-cover" src={artwork} />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-moss">
                            <Album size={18} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium text-white">{display(album.album, "Unknown album")}</span>
                        </div>
                        <div className="truncate text-xs text-muted">{albumMetaLabel(album)}</div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink">
                          <div className="h-full rounded-full bg-moss" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="self-center text-right text-sm tabular-nums">
                        <div className="font-semibold text-white">
                          {album.track_count.toLocaleString()}/{expected.toLocaleString()}
                        </div>
                        <div className={missing ? "text-xs text-ember" : "text-xs text-moss"}>
                          {missing ? `${missing.toLocaleString()} missing` : "complete"}
                        </div>
                      </div>
                    </button>
                    {expanded && (
                      <div className="border-t border-line/60 bg-ink/55 px-4 py-3">
                        <div className="mb-3 ml-0 flex flex-wrap items-center justify-between gap-2 rounded border border-line/70 bg-panel px-3 py-2 text-xs sm:ml-14">
                          <div className="min-w-0">
                            <div className="font-medium text-neutral-100">
                              Expected length: {expected.toLocaleString()} tracks
                            </div>
                            <div className="truncate text-muted">
                              {queriedTrackCount
                                ? `${album.completion_source ?? "Lookup"} ${queriedTrackCount.toLocaleString()} tracks${album.completion_release_title ? ` - ${album.completion_release_title}` : ""}${album.completion_checked_at ? ` (${formatShortDate(album.completion_checked_at)})` : ""}`
                                : "Using local disc and track numbers."}
                              {lookupMessage ? ` ${lookupMessage}` : ""}
                            </div>
                          </div>
                          <button
                            className="secondary-button min-h-8 px-3 py-1.5 text-xs"
                            type="button"
                            disabled={completionLookupAllActive || completionLookupAlbumId === album.id}
                            onClick={() => void handleCompletionLengthLookup(album)}
                          >
                            <RefreshCw className={completionLookupAlbumId === album.id ? "animate-spin" : ""} size={14} />
                            {completionLookupAlbumId === album.id ? "Looking up" : "Lookup Length"}
                          </button>
                        </div>
                        {tracksReady ? (
                          <div className="ml-0 grid gap-1 sm:ml-14">
                            {selectedAlbumTracks.map((track, index) => (
                              <button
                                key={`${album.id}-${track.id}-${index}`}
                                className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded px-2 py-1.5 text-left text-xs hover:bg-white/[0.035] ${
                                  currentTrackId === track.id ? "bg-moss/10 text-moss" : ""
                                }`}
                                type="button"
                                title={`Play ${display(track.title, "track")}`}
                                onClick={() => onPlayTrack(track, selectedAlbumTracks)}
                                onContextMenu={(event) => openTrackContextMenu(event, track, selectedAlbumTracks)}
                              >
                                <span className="text-right tabular-nums text-muted">{track.track_number ?? index + 1}</span>
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-neutral-100">{display(track.title, "Untitled")}</div>
                                  <div className="truncate text-muted">{display(track.artist)}</div>
                                </div>
                                <span className="tabular-nums text-muted">{formatDuration(track.duration_seconds)}</span>
                              </button>
                            ))}
                            {selectedAlbumTracks.length === 0 && (
                              <div className="rounded border border-line/70 bg-panel px-3 py-4 text-center text-xs text-muted">
                                No tracks are attached to this album yet.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="ml-0 rounded border border-line/70 bg-panel px-3 py-4 text-center text-xs text-muted sm:ml-14">
                            Opening album...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {completionWindow.bottomSpacerHeight > 0 && (
                <div aria-hidden="true" style={{ height: completionWindow.bottomSpacerHeight }} />
              )}
              {visibleCompletionAlbums.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted">
                  No albums match this completion filter.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const contextSelectionTracks =
    contextMenu && selectedTrackIds.has(contextMenu.track.id) ? selectedTracks : contextMenu ? [contextMenu.track] : [];
  const contextSelectionIds = contextSelectionTracks.map((track) => track.id);
  const contextBulk = contextSelectionIds.length > 1;
  const contextLabel = contextBulk
    ? `${contextSelectionIds.length.toLocaleString()} selected tracks`
    : display(contextMenu?.track.title, "Selected track");
  const contextPlaylistSubmenuHeight = Math.min(Math.max(playlists.length, 1), 8) * TRACK_CONTEXT_ROW_HEIGHT + 10;

  function contextSubmenuStyle(
    rowIndex: number,
    width: number,
    estimatedHeight: number,
    extraTopOffset = 0,
  ): CSSProperties {
    if (!contextMenu) {
      return {};
    }
    const headerOffset = contextBulk ? TRACK_CONTEXT_HEADER_HEIGHT : 0;
    const desiredTop = contextMenu.y + headerOffset + rowIndex * TRACK_CONTEXT_ROW_HEIGHT + extraTopOffset;
    const maxTop = Math.max(MENU_VIEWPORT_MARGIN, window.innerHeight - estimatedHeight - MENU_VIEWPORT_MARGIN);
    const desiredLeft = contextMenu.submenuLeft
      ? contextMenu.x - width
      : contextMenu.x + TRACK_CONTEXT_MENU_WIDTH;
    const maxLeft = Math.max(MENU_VIEWPORT_MARGIN, window.innerWidth - width - MENU_VIEWPORT_MARGIN);
    return {
      left: Math.min(Math.max(MENU_VIEWPORT_MARGIN, desiredLeft), maxLeft),
      top: Math.min(Math.max(MENU_VIEWPORT_MARGIN, desiredTop), maxTop),
      maxHeight: `calc(100vh - ${MENU_VIEWPORT_MARGIN * 2}px)`,
    };
  }

  function openContextSubmenu(submenu: ContextSubmenuKey) {
    if (contextSubmenuCloseTimer.current !== null) {
      window.clearTimeout(contextSubmenuCloseTimer.current);
      contextSubmenuCloseTimer.current = null;
    }
    setActiveContextSubmenu(submenu);
  }

  function scheduleContextSubmenuClose() {
    if (contextSubmenuCloseTimer.current !== null) {
      window.clearTimeout(contextSubmenuCloseTimer.current);
    }
    contextSubmenuCloseTimer.current = window.setTimeout(() => {
      setActiveContextSubmenu(null);
      contextSubmenuCloseTimer.current = null;
    }, TRACK_SUBMENU_CLOSE_DELAY_MS);
  }

  function contextSubmenuClass(submenu: ContextSubmenuKey, base: string) {
    const visible = activeContextSubmenu === submenu;
    return `${base} ${visible ? "visible opacity-100 pointer-events-auto" : "invisible opacity-0 pointer-events-none"}`;
  }

  useEffect(() => {
    if (contextMenu) {
      return;
    }
    setActiveContextSubmenu(null);
    if (contextSubmenuCloseTimer.current !== null) {
      window.clearTimeout(contextSubmenuCloseTimer.current);
      contextSubmenuCloseTimer.current = null;
    }
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) {
      return;
    }
    const rect = contextMenuRef.current.getBoundingClientRect();
    const anchorX = contextMenu.anchorX ?? contextMenu.x;
    const anchorY = contextMenu.anchorY ?? contextMenu.y;
    const maxX = Math.max(MENU_VIEWPORT_MARGIN, window.innerWidth - rect.width - MENU_VIEWPORT_MARGIN);
    const maxY = Math.max(MENU_VIEWPORT_MARGIN, window.innerHeight - rect.height - MENU_VIEWPORT_MARGIN);
    const nextX = Math.min(Math.max(MENU_VIEWPORT_MARGIN, anchorX), maxX);
    const desiredY = contextMenu.flipY ? anchorY - rect.height : anchorY;
    const nextY = Math.min(Math.max(MENU_VIEWPORT_MARGIN, desiredY), maxY);
    if (Math.round(nextX) !== Math.round(contextMenu.x) || Math.round(nextY) !== Math.round(contextMenu.y)) {
      setContextMenu((current) => (current ? { ...current, x: nextX, y: nextY } : current));
    }
  }, [
    contextMenu?.x,
    contextMenu?.y,
    contextMenu?.anchorX,
    contextMenu?.anchorY,
    contextMenu?.track.id,
    contextMenu?.removable,
    contextSelectionIds.length,
  ]);

  if (showQuickStart) {
    return (
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line px-6">
          <div>
            <h1 className="text-lg font-semibold text-white">Library</h1>
            <p className="text-xs text-muted">Choose a source folder to start.</p>
          </div>
        </header>
        <QuickStartPanel
          isScanning={isScanning}
          suggestedMusicPath={suggestedMusicPath}
          onChooseMusicFolder={onChooseMusicFolder}
          onUseSuggestedFolder={onUseSuggestedFolder}
          onOpenSettings={onOpenSettings}
          onDismiss={onDismissQuickStart}
        />
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Library</h1>
          <p className="text-xs text-muted">{librarySummaryText}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <label className="relative block min-w-[12rem] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full rounded border border-line bg-panel pl-9 pr-10 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2 sm:w-[min(20rem,42vw)]"
              placeholder="Search tracks, artists, albums"
            />
            {search && (
              <button
                className="absolute right-1.5 top-1 h-7 w-7 rounded text-muted transition hover:bg-elevated hover:text-white"
                type="button"
                title="Clear library search"
                onClick={() => setSearch("")}
              >
                <X size={14} className="mx-auto" />
              </button>
            )}
          </label>
          <button
            className={`secondary-button h-9 ${showAdvancedSearch || advancedSearchActiveCount ? "border-moss/60 text-white" : ""}`}
            title="Advanced track search"
            type="button"
            onClick={() => setShowAdvancedSearch((current) => !current)}
          >
            <SlidersHorizontal size={16} />
            {advancedSearchActiveCount ? ` (${advancedSearchActiveCount})` : ""}
          </button>
          <button className="icon-button" title="Refresh" type="button" onClick={refreshTracks}>
            <RefreshCw size={17} />
          </button>
        </div>
      </header>
      {showAdvancedSearch && (
        <div className="border-b border-line bg-[rgb(var(--color-strip))] px-6 py-3">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-white">Advanced Track Search</div>
              </div>
              <button className="secondary-button h-8 text-xs" type="button" disabled={!advancedSearchActiveCount} onClick={clearAdvancedTrackSearch}>
                <X size={14} />
                Clear Filters
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1 text-xs uppercase text-muted">
                Artist
                <input className={advancedSearchInputClass} value={advancedTrackSearch.artist ?? ""} placeholder="Artist or album artist" onChange={(event) => updateAdvancedTrackSearch("artist", event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                Album
                <input className={advancedSearchInputClass} value={advancedTrackSearch.album ?? ""} placeholder="Album title" onChange={(event) => updateAdvancedTrackSearch("album", event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                Genre
                <input className={advancedSearchInputClass} value={advancedTrackSearch.genre ?? ""} placeholder="Tag or CLAP genre" onChange={(event) => updateAdvancedTrackSearch("genre", event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                File Type
                <input className={advancedSearchInputClass} value={advancedTrackSearch.extension ?? ""} placeholder="flac, mp3, opus" onChange={(event) => updateAdvancedTrackSearch("extension", event.target.value)} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="grid gap-1 text-xs uppercase text-muted">
                Rating
                <select className={advancedSearchInputClass} value={advancedTrackSearch.rating_state ?? "any"} onChange={(event) => updateAdvancedTrackSearch("rating_state", event.target.value as AdvancedTrackSearchFilters["rating_state"])}>
                  <option value="any">Any</option>
                  <option value="rated">Rated only</option>
                  <option value="unrated">Unrated only</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                Min Stars
                <input className={advancedSearchInputClass} inputMode="decimal" value={advancedTrackSearch.min_rating ?? ""} placeholder="0.5-5" onChange={(event) => updateAdvancedTrackSearch("min_rating", event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                Max Stars
                <input className={advancedSearchInputClass} inputMode="decimal" value={advancedTrackSearch.max_rating ?? ""} placeholder="0.5-5" onChange={(event) => updateAdvancedTrackSearch("max_rating", event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                From Year
                <input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.year_from ?? ""} placeholder="1995" onChange={(event) => updateAdvancedTrackSearch("year_from", event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                To Year
                <input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.year_to ?? ""} placeholder="2026" onChange={(event) => updateAdvancedTrackSearch("year_to", event.target.value)} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2 text-xs uppercase text-muted">
                Missing Metadata
                <input type="checkbox" className="h-4 w-4 accent-moss" checked={Boolean(advancedTrackSearch.missing_metadata)} onChange={(event) => updateAdvancedTrackSearch("missing_metadata", event.target.checked)} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_repeat(2,minmax(8rem,12rem))]">
              <label className="grid gap-1 text-xs uppercase text-muted">
                File Path Contains
                <input className={advancedSearchInputClass} value={advancedTrackSearch.path ?? ""} placeholder="folder, drive, edition, etc." onChange={(event) => updateAdvancedTrackSearch("path", event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                Min Seconds
                <input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.min_duration ?? ""} placeholder="120" onChange={(event) => updateAdvancedTrackSearch("min_duration", event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs uppercase text-muted">
                Max Seconds
                <input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.max_duration ?? ""} placeholder="480" onChange={(event) => updateAdvancedTrackSearch("max_duration", event.target.value)} />
              </label>
            </div>
          </div>
        </div>
      )}
      <div className="flex min-h-14 flex-col gap-2 border-b border-line bg-[rgb(var(--color-strip))] px-3 py-2 min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:justify-between min-[1280px]:px-6 min-[1280px]:py-3">
        <div className="flex min-w-0 flex-col gap-2 min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-3">
          <LibraryViewTabs libraryView={libraryView} setLibraryView={setLibraryView} />
          {libraryView === "albums" && (
            <div className="grid w-full min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-2 min-[1280px]:w-[20rem] min-[1280px]:shrink-0">
              {albumMode === "browse" && <div className="min-w-0">{renderAlbumLayoutToggle()}</div>}
              <div className={`min-w-0 ${albumMode === "browse" ? "" : "col-span-2"}`}>{renderAlbumModeToggle()}</div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] min-[1280px]:justify-end [&::-webkit-scrollbar]:hidden">
          {selectedIds.length > 0 && (
            <button
              className="secondary-button shrink-0"
              type="button"
              title="Open selected tracks in File Management"
              onClick={() => void onOpenFileManagementTracks(selectedIds)}
            >
              <FolderOpen size={16} />
              File Management
              <span className="rounded border border-line bg-ink px-1.5 py-0.5 text-[11px] leading-none text-muted">
                {selectedIds.length.toLocaleString()}
              </span>
            </button>
          )}
          <button
            className="icon-button shrink-0"
            type="button"
            title="Shuffle current view"
            disabled={viewTracks.length === 0}
            onClick={() => onShuffleTracks(viewTracks)}
          >
            <Shuffle size={16} />
          </button>
          <button className="primary-button shrink-0" type="button" onClick={() => onQuickAutoDj(currentTrack)}>
            <Wand2 size={16} />
            AutoDJ
          </button>
          <button
            className={`icon-button shrink-0 ${libraryActionsMenu ? "border-moss text-white" : ""}`}
            type="button"
            title="Library actions"
            aria-haspopup="menu"
            aria-expanded={Boolean(libraryActionsMenu)}
            onClick={toggleLibraryActionsMenu}
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      </div>
      <div className="relative min-h-0 min-w-0 flex flex-1">
      <div
        ref={scrollRef}
        className="min-h-0 min-w-0 flex-1 overflow-auto"
        style={{ overflowAnchor: "none" } as CSSProperties}
        onScroll={handleScroll}
        onPointerDown={cancelScrollRestoreForUserInput}
        onWheel={cancelScrollRestoreForUserInput}
        onClick={handleLibrarySurfaceClick}
      >
        {libraryView === "tracks" && (
          <>
            <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
              <colgroup>
                <col style={{ width: librarySelectionColumnWidth }} />
                <col style={{ width: columnWidths.play }} />
                {visibleColumnDefs.map((column) => (
                  <col key={column.key} style={{ width: columnWidths[column.key] }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
                {renderTableHeader(true)}
              </thead>
              <tbody>
                {virtualTopSpacerHeight > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={visibleColumnDefs.length + 2} style={{ height: virtualTopSpacerHeight, padding: 0, border: 0 }} />
                  </tr>
                )}
                {shouldVirtualizeTrackRows ? renderVirtualTrackRows() : renderTrackRows(renderedTrackList, { interactionList: tracks })}
                {virtualBottomSpacerHeight > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={visibleColumnDefs.length + 2} style={{ height: virtualBottomSpacerHeight, padding: 0, border: 0 }} />
                  </tr>
                )}
              </tbody>
            </table>
            {isLoading && (
              <div className="border-t border-line/60 px-6 py-4 text-center text-sm text-muted">
                Loading tracks...
              </div>
            )}
            {!shouldVirtualizeTrackRows && !isLoading && hasMoreTracks && tracks.length > 0 && (
              <div className="border-t border-line/60 px-6 py-4 text-center">
                <button className="secondary-button" type="button" onClick={loadMoreTracks}>
                  Load more
                </button>
              </div>
            )}
            {totalTracks === 0 && tracks.length === 0 && !isLoading && trackSearchActive && (
              <div className="grid h-full place-items-center px-6 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded border border-line bg-panel text-moss">
                    <Search size={24} />
                  </div>
                  <div className="text-base font-semibold text-white">No matching tracks</div>
                  <div className="mt-2 text-sm text-muted">
                    Try a different search term, clear advanced filters, or broaden the current view.
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {search && (
                      <button className="secondary-button h-10" type="button" onClick={() => setSearch("")}>
                        <X size={16} />
                        Clear Search
                      </button>
                    )}
                    {advancedSearchActiveCount > 0 && (
                      <button className="secondary-button h-10" type="button" onClick={clearAdvancedTrackSearch}>
                        <SlidersHorizontal size={16} />
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {totalTracks === 0 && tracks.length === 0 && !isLoading && !trackSearchActive && !libraryHasAnyTracks && (
              <div className="grid h-full place-items-center px-6 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded border border-line bg-panel text-moss">
                    <FolderOpen size={24} />
                  </div>
                  <div className="text-base font-semibold text-white">No tracks in the library yet</div>
                  <div className="mt-2 text-sm text-muted">
                    Choose the folder that holds your downloaded music and FLAC Cafe will scan it into your local catalog.
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button className="primary-button h-10" type="button" disabled={isScanning} onClick={onChooseMusicFolder}>
                      <FolderOpen size={16} />
                      {isScanning ? "Scanning" : "Choose Music Folder"}
                    </button>
                    {suggestedMusicPath && (
                      <button
                        className="secondary-button h-10"
                        type="button"
                        disabled={isScanning}
                        title={suggestedMusicPath}
                        onClick={() => onUseSuggestedFolder(suggestedMusicPath)}
                      >
                        <FolderOpen size={16} />
                        Use Music Folder
                      </button>
                    )}
                  </div>
                  <button className="mt-3 text-xs text-muted hover:text-white" type="button" onClick={() => setLibraryView("health")}>
                    View library tools
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {libraryView === "artists" && (
          <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(220px,290px)_minmax(0,1fr)] min-[1280px]:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
            <div className="relative min-h-0 border-r border-line">
              <section
                ref={artistListRef}
                className="h-full min-h-0 overflow-auto"
                onScroll={(event) => setArtistScrollTop(event.currentTarget.scrollTop)}
              >
                <div className="grid">
                  {artistWindow.topSpacerHeight > 0 && <div aria-hidden="true" style={{ height: artistWindow.topSpacerHeight }} />}
                  {renderedArtists.map((artist) => {
                    const active = artist.name === selectedArtistName;
                    const artwork = artist.artwork_track_id ? albumArtworkUrl(artist.artwork_track_id) : null;
                    return (
                      <button
                        key={artist.name}
                        className={`grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition ${
                          active ? "bg-white/10" : "hover:bg-white/[0.035]"
                        }`}
                        style={{ height: ARTIST_ROW_HEIGHT }}
                        type="button"
                        onClick={() => onSelectArtist(artist.name)}
                        onDoubleClick={() => void onPlayArtist(artist.name)}
                      >
                        <div className="h-11 w-11 overflow-hidden rounded border border-line bg-panel">
                          {artwork ? (
                            <img alt="" className="h-full w-full object-cover" src={artwork} />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-moss">
                              <UserRound size={20} />
                            </div>
                          )}
                        </div>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">{display(artist.name, "Unknown artist")}</span>
                          <span className="block truncate text-xs text-muted">{artistMetaLabel(artist)}</span>
                        </span>
                      </button>
                    );
                  })}
                  {artistWindow.bottomSpacerHeight > 0 && <div aria-hidden="true" style={{ height: artistWindow.bottomSpacerHeight }} />}
                  {artists.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-muted">
                      {search.trim() ? "No artists match the current search." : "No artists found in the current library."}
                    </div>
                  )}
                </div>
              </section>
              {renderPaneTopButton(artistScrollTop > 120, "Back to top", artistListRef, setArtistScrollTop)}
            </div>
            <section className="min-h-0 min-w-0 overflow-auto">
              <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                <colgroup>
                  <col style={{ width: librarySelectionColumnWidth }} />
                  <col style={{ width: columnWidths.play }} />
                  {visibleColumnDefs.map((column) => (
                    <col key={column.key} style={{ width: columnWidths[column.key] }} />
                  ))}
                </colgroup>
                <thead className="border-b border-line bg-[rgb(var(--color-strip))] text-xs uppercase text-muted">
                  {renderTableHeader(false)}
                </thead>
                <tbody>{renderTrackRows(selectedArtistTracks)}</tbody>
              </table>
              {activeArtist && selectedArtistTracks.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted">
                  No local tracks found for this artist.
                </div>
              )}
            </section>
          </div>
        )}

        {libraryView === "albums" && (
          albumMode === "completion" ? (
            renderCompletionView()
          ) : (
          <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
            <div className="relative min-h-0 border-r border-line">
              <section
                ref={albumListRef}
                className="h-full min-h-0 overflow-auto"
                onScroll={(event) => setAlbumScrollTop(event.currentTarget.scrollTop)}
              >
                <div className={albumGrid ? "grid grid-cols-2 gap-3 p-3" : "grid"}>
                  {albumWindow.topSpacerHeight > 0 && (
                    <div
                      aria-hidden="true"
                      className={albumGrid ? "col-span-full" : undefined}
                      style={{ height: albumWindow.topSpacerHeight }}
                    />
                  )}
                  {renderedBrowseAlbums.map((album) => {
                    const active = album.id === selectedAlbumId;
                    const artwork = album.artwork_path || album.artwork_track_id ? albumCoverUrl(album.id) : null;
                    return (
                      <button
                        key={album.id}
                        className={
                          albumGrid
                            ? `min-w-0 rounded border border-line bg-panel p-2 text-left transition ${
                                active ? "border-moss bg-white/10" : "hover:border-moss/50"
                              }`
                            : `grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition ${
                                active ? "bg-white/10" : "hover:bg-white/[0.035]"
                              }`
                        }
                        style={albumGrid ? { minHeight: ALBUM_GRID_ROW_HEIGHT - 24 } : { height: ALBUM_LIST_ROW_HEIGHT }}
                        type="button"
                        onClick={() => onSelectAlbum(album.id)}
                        onDoubleClick={() => void onPlayAlbum(album.id)}
                      >
                        {albumGrid && (
                          <div className="mb-2 aspect-square overflow-hidden rounded border border-line bg-ink">
                            {artwork ? (
                              <img alt="" className="h-full w-full object-cover" src={artwork} />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-moss">
                                <Album size={28} />
                              </div>
                            )}
                          </div>
                        )}
                        {!albumGrid && (
                          <div className="h-11 w-11 overflow-hidden rounded border border-line bg-panel">
                            {artwork ? (
                              <img alt="" className="h-full w-full object-cover" src={artwork} />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-moss">
                                <Album size={20} />
                              </div>
                            )}
                          </div>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">{display(album.album, "Unknown album")}</span>
                          <span className="block truncate text-xs text-muted">{albumMetaLabel(album)}</span>
                        </span>
                      </button>
                    );
                  })}
                  {albumWindow.bottomSpacerHeight > 0 && (
                    <div
                      aria-hidden="true"
                      className={albumGrid ? "col-span-full" : undefined}
                      style={{ height: albumWindow.bottomSpacerHeight }}
                    />
                  )}
                  {albums.length === 0 && (
                    <div className="col-span-full px-3 py-10 text-center text-sm text-muted">
                      Albums will appear here after the first library scan.
                    </div>
                  )}
                </div>
              </section>
              {renderPaneTopButton(albumScrollTop > 120, "Back to top", albumListRef, setAlbumScrollTop)}
            </div>
            <section className="min-h-0 min-w-0 overflow-auto">
              {activeAlbum && isAlbumArtworkOpen && (
                <div className="border-b border-line bg-panel px-4 py-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Album Artwork</div>
                      <div className="text-xs text-muted">{albumArtworkStatus || "Choose a sidecar image or save embedded artwork as cover art."}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="secondary-button h-8" type="button" onClick={() => void loadAlbumArtworkCandidates(activeAlbum.id)}>
                        <RefreshCw size={14} />
                        Rescan
                      </button>
                      <button className="secondary-button h-8" type="button" disabled={isSearchingAlbumArtwork} onClick={() => void searchWebArtwork(activeAlbum.id)}>
                        <Search size={14} />
                        {isSearchingAlbumArtwork ? "Searching" : "Search Web"}
                      </button>
                      <button className="secondary-button h-8" type="button" onClick={() => void clearSelectedAlbumArtwork(activeAlbum.id)}>
                        <X size={14} />
                        Clear
                      </button>
                      <button className="icon-button h-8 w-8" type="button" title="Close artwork manager" onClick={() => setIsAlbumArtworkOpen(false)}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="grid max-h-56 gap-2 overflow-auto pr-1 md:grid-cols-2">
                    {albumArtworkCandidates.map((candidate, index) => (
                      <div key={candidate.path ?? candidate.artwork_url ?? `${candidate.source}-${candidate.track_id}-${index}`} className="grid gap-2 rounded border border-line/70 bg-ink p-2">
                        <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded border border-line bg-panel">
                            {candidate.thumbnail_url ? (
                              <img className="h-full w-full object-cover" src={candidate.thumbnail_url} alt="" />
                            ) : candidate.source === "embedded" && candidate.track_id ? (
                              <img className="h-full w-full object-cover" src={albumArtworkUrl(candidate.track_id)} alt="" />
                            ) : candidate.source === "selected" && activeAlbum ? (
                              <img className="h-full w-full object-cover" src={albumCoverUrl(activeAlbum.id)} alt="" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase text-muted">Art</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm text-neutral-200">
                              {candidate.selected ? "Selected - " : ""}{candidate.label}
                            </div>
                            <div className="truncate text-xs text-muted">
                              {candidate.source}
                              {candidate.size_bytes ? ` - ${Math.round(candidate.size_bytes / 1024).toLocaleString()} KB` : ""}
                              {candidate.release_id ? ` - ${candidate.release_id}` : ""}
                            </div>
                          </div>
                          {candidate.selected && <CheckCircle2 className="shrink-0 text-moss" size={16} />}
                        </div>
                        {(candidate.path || candidate.artwork_url) && (
                          <div className="truncate text-xs text-muted">{candidate.path ?? candidate.artwork_url}</div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {candidate.path && (
                            <button className="secondary-button h-8" type="button" onClick={() => void chooseSidecarArtwork(activeAlbum.id, candidate.path ?? "")}>
                              Use
                            </button>
                          )}
                          {candidate.path && candidate.source !== "embedded" && (
                            <button className="secondary-button h-8" type="button" onClick={() => void embedSidecarArtwork(activeAlbum.id, candidate.path ?? "")}>
                              Embed Files
                            </button>
                          )}
                          {candidate.source === "embedded" && candidate.track_id && (
                            <button className="secondary-button h-8" type="button" onClick={() => void saveEmbeddedArtwork(activeAlbum.id, candidate.track_id ?? 0)}>
                              Save Sidecar
                            </button>
                          )}
                          {candidate.source === "embedded" && candidate.track_id && (
                            <button className="secondary-button h-8" type="button" onClick={() => void embedEmbeddedArtwork(activeAlbum.id, candidate.track_id ?? 0)}>
                              Embed Files
                            </button>
                          )}
                          {candidate.source === "web" && candidate.artwork_url && (
                            <button className="secondary-button h-8" type="button" onClick={() => void saveWebArtwork(activeAlbum.id, candidate.artwork_url ?? "", false)}>
                              Save Sidecar
                            </button>
                          )}
                          {candidate.source === "web" && candidate.artwork_url && (
                            <button className="primary-button h-8" type="button" onClick={() => void saveWebArtwork(activeAlbum.id, candidate.artwork_url ?? "", true)}>
                              Save + Embed
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {albumArtworkCandidates.length === 0 && (
                      <div className="col-span-full rounded border border-line/70 bg-ink px-3 py-4 text-center text-xs text-muted">
                        No artwork candidates found beside this album's files.
                      </div>
                    )}
                  </div>
                </div>
              )}
              <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
              <colgroup>
                  <col style={{ width: librarySelectionColumnWidth }} />
                  <col style={{ width: columnWidths.play }} />
                  {visibleColumnDefs.map((column) => (
                    <col key={column.key} style={{ width: columnWidths[column.key] }} />
                  ))}
                </colgroup>
                <thead className="border-b border-line bg-[rgb(var(--color-strip))] text-xs uppercase text-muted">
                  {renderTableHeader(false)}
                </thead>
                <tbody>{renderTrackRows(selectedAlbumTracks)}</tbody>
              </table>
            </section>
          </div>
          )
        )}

        {libraryView === "completion" && renderCompletionView()}

        {libraryView === "playlists" && (
          <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
            <div className="relative min-h-0 border-r border-line">
              <section
                ref={playlistListRef}
                className="h-full min-h-0 overflow-auto"
                onScroll={(event) => setPlaylistScrollTop(event.currentTarget.scrollTop)}
              >
                <div className="sticky top-0 z-10 border-b border-line bg-ink p-3">
                  <div className="flex gap-2">
                    <input
                      className="h-9 min-w-0 flex-1 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={newPlaylistName}
                      placeholder="New playlist"
                      onChange={(event) => setNewPlaylistName(event.target.value)}
                    />
                    <button className="icon-button" type="button" title="Create playlist" onClick={onCreatePlaylist}>
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="h-9 min-w-0 flex-1 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={importPlaylistPath}
                      placeholder="Import playlist path"
                      onChange={(event) => setImportPlaylistPath(event.target.value)}
                    />
                    <button className="icon-button" type="button" title="Import playlist" onClick={onImportPlaylist}>
                      <Upload size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid">
                  {playlistWindow.topSpacerHeight > 0 && <div aria-hidden="true" style={{ height: playlistWindow.topSpacerHeight }} />}
                  {renderedPlaylists.map((playlist) => {
                    const active = playlist.id === selectedPlaylistId;
                    return (
                      <button
                        key={playlist.id}
                        className={`grid gap-1 border-b border-line/60 px-4 py-3 text-left transition ${
                          active ? "bg-white/10" : "hover:bg-white/[0.035]"
                        }`}
                        style={{ height: PLAYLIST_ROW_HEIGHT }}
                        type="button"
                        onClick={() => onSelectPlaylist(playlist.id)}
                      >
                        <span className="truncate text-sm font-medium text-white">{playlist.name}</span>
                        <span className="truncate text-xs text-muted">
                          {playlist.track_count} tracks - {formatDuration(playlist.duration_seconds)}
                        </span>
                      </button>
                    );
                  })}
                  {playlistWindow.bottomSpacerHeight > 0 && <div aria-hidden="true" style={{ height: playlistWindow.bottomSpacerHeight }} />}
                  {playlists.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-muted">
                      Create a playlist or import M3U, PLS, XSPF, WPL, or iTunes XML.
                    </div>
                  )}
                </div>
              </section>
              {renderPaneTopButton(playlistScrollTop > PLAYLIST_TOOLBAR_HEIGHT + 80, "Back to top", playlistListRef, setPlaylistScrollTop)}
            </div>
            <section className="min-h-0 min-w-0 overflow-auto">
              <div className="sticky top-0 z-10 grid min-h-12 min-w-0 gap-2 border-b border-line bg-ink px-4 py-2 min-[1180px]:grid-cols-[minmax(0,1fr)_auto] min-[1180px]:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {activePlaylist ? activePlaylist.name : "Select a playlist"}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {`${selectedPlaylistTracks.length.toLocaleString()} track${selectedPlaylistTracks.length === 1 ? "" : "s"}`}
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] min-[1180px]:justify-end [&::-webkit-scrollbar]:hidden">
                  <button
                    className="secondary-button h-8 shrink-0"
                    type="button"
                    disabled={selectedPlaylistTracks.length === 0}
                    onClick={() => onShuffleTracks(selectedPlaylistTracks)}
                  >
                    <Shuffle size={15} />
                    Shuffle
                  </button>
                  <button className="secondary-button h-8 shrink-0" type="button" disabled={!activePlaylist || selectedPlaylistTracks.length === 0} onClick={() => activePlaylist && onExportPlaylist(activePlaylist.id)}>
                    <Download size={15} />
                    Export
                  </button>
                  <button className="secondary-button h-8 shrink-0" type="button" disabled={!activePlaylist} onClick={() => activePlaylist && onDeletePlaylist(activePlaylist.id)}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>
              <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                <colgroup>
                  <col style={{ width: librarySelectionColumnWidth }} />
                  <col style={{ width: columnWidths.play }} />
                  {visibleColumnDefs.map((column) => (
                    <col key={column.key} style={{ width: columnWidths[column.key] }} />
                  ))}
                </colgroup>
                <thead className="border-b border-line bg-[rgb(var(--color-strip))] text-xs uppercase text-muted">
                  {renderTableHeader(false)}
                </thead>
                <tbody>{renderTrackRows(selectedPlaylistTracks, { removable: true })}</tbody>
              </table>
            </section>
          </div>
        )}

        {libraryView === "inbox" && (
          <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
            <section className="min-w-0 overflow-auto border-r border-line p-4">
              <div className="grid gap-3 text-sm">
                <div className="rounded border border-line bg-panel p-3">
                  <div className="text-xs uppercase text-muted">New Tracks</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{inbox?.total_new.toLocaleString() ?? "-"}</div>
                </div>
                <div className="rounded border border-line bg-panel p-3">
                  <div className="text-xs uppercase text-muted">Reviewed</div>
                  <div className="mt-1 text-2xl font-semibold text-moss">{inbox?.total_reviewed.toLocaleString() ?? "-"}</div>
                </div>
                <button
                  className="primary-button justify-center"
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={() => void onReviewInboxTracks(selectedIds)}
                >
                  <CheckCircle2 size={15} />
                  Review Selected
                </button>
                <button
                  className="secondary-button justify-center"
                  type="button"
                  disabled={(inbox?.total_new ?? 0) === 0}
                  onClick={() => void onReviewInboxTracks([], true)}
                >
                  <ShieldCheck size={15} />
                  Review All
                </button>
                <button
                  className="secondary-button justify-center"
                  type="button"
                  disabled={(inbox?.tracks.length ?? 0) === 0}
                  onClick={() => onAddTracksToPlaylist((inbox?.tracks ?? []).map((track) => track.id))}
                >
                  <Plus size={15} />
                  Add Visible
                </button>
                <div className="min-w-0 overflow-hidden rounded border border-line bg-panel p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="text-xs uppercase text-muted">Track Note</div>
                      <div
                        className="mt-0.5 max-w-full truncate text-sm text-neutral-200"
                        title={selectedInboxTrack ? display(selectedInboxTrack.title, "track") : undefined}
                      >
                        {selectedInboxTrack ? display(selectedInboxTrack.title, "track") : "Select one Inbox track"}
                      </div>
                    </div>
                    <Pencil size={15} className="shrink-0 text-muted" />
                  </div>
                  <textarea
                    className="mt-3 min-h-24 w-full resize-y rounded border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2 disabled:opacity-60"
                    disabled={!selectedInboxTrack}
                    value={inboxNoteDraft}
                    placeholder="Why is this here? Needs tag cleanup, duplicate check, low-quality source..."
                    onChange={(event) => setInboxNoteDraft(event.target.value)}
                  />
                  <button
                    className="secondary-button mt-2 w-full justify-center"
                    type="button"
                    disabled={!selectedInboxTrack}
                    onClick={() => selectedInboxTrack && void onUpdateInboxNote(selectedInboxTrack.id, inboxNoteDraft)}
                  >
                    <Save size={15} />
                    Save Note
                  </button>
                </div>
                <div className="rounded border border-line bg-panel p-3">
                  <div className="text-xs uppercase text-muted">Auto-Review Rules</div>
                  <div className="mt-1 text-xs text-muted">
                    Matching new tracks are marked reviewed automatically; notes are only filled when the track has no note.
                  </div>
                  <div className="mt-3 grid gap-2">
                    <input
                      className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={inboxRuleName}
                      placeholder="Rule name"
                      onChange={(event) => setInboxRuleName(event.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="h-9 rounded border border-line bg-ink px-2 text-white outline-none ring-moss/40 focus:ring-2"
                        value={inboxRuleField}
                        onChange={(event) => setInboxRuleField(event.target.value as InboxAutoReviewField)}
                      >
                        {(["genre", "artist", "album", "album_artist", "title", "path", "year", "rating", "duration_seconds"] as const).map((field) => (
                          <option key={field} value={field}>
                            {field.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 rounded border border-line bg-ink px-2 text-white outline-none ring-moss/40 focus:ring-2"
                        value={inboxRuleMatchType}
                        onChange={(event) => setInboxRuleMatchType(event.target.value as InboxAutoReviewMatchType)}
                      >
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                        <option value="starts_with">starts with</option>
                        <option value="ends_with">ends with</option>
                        <option value="regex">regex</option>
                        <option value="is_empty">is empty</option>
                        <option value="is_not_empty">is not empty</option>
                      </select>
                    </div>
                    <input
                      className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2 disabled:opacity-60"
                      value={inboxRuleValue}
                      disabled={inboxRuleMatchType === "is_empty" || inboxRuleMatchType === "is_not_empty"}
                      placeholder="Match value"
                      onChange={(event) => setInboxRuleValue(event.target.value)}
                    />
                    <textarea
                      className="min-h-16 resize-y rounded border border-line bg-ink px-3 py-2 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={inboxRuleNote}
                      placeholder="Optional note for matched tracks"
                      onChange={(event) => setInboxRuleNote(event.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-moss"
                          checked={inboxRuleEnabled}
                          onChange={(event) => setInboxRuleEnabled(event.target.checked)}
                        />
                        Enabled
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-moss"
                          checked={inboxRuleApplyExisting}
                          onChange={(event) => setInboxRuleApplyExisting(event.target.checked)}
                        />
                        Apply now
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button className="primary-button min-w-0 flex-1 justify-center" type="button" onClick={() => void saveInboxRule()}>
                        <ShieldCheck size={15} />
                        {editingInboxRuleId ? "Update" : "Save"}
                      </button>
                      <button className="secondary-button" type="button" onClick={resetInboxRuleForm}>
                        Clear
                      </button>
                    </div>
                  </div>
                  {(inbox?.auto_review_rules.length ?? 0) > 0 && (
                    <div className="mt-3 grid gap-2">
                      {inbox?.auto_review_rules.map((rule) => (
                        <div key={rule.id} className="rounded border border-line/70 bg-ink px-2 py-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              className="min-w-0 text-left font-semibold text-neutral-200 hover:text-white"
                              type="button"
                              onClick={() => editInboxRule(rule)}
                            >
                              <span className="block truncate">{rule.name}</span>
                              <span className="block truncate text-muted">
                                {rule.field.replace("_", " ")} {rule.match_type.replace("_", " ")}
                                {rule.value ? ` "${rule.value}"` : ""}
                              </span>
                            </button>
                            <button className="text-muted hover:text-ember" type="button" onClick={() => void onDeleteInboxAutoReviewRule(rule)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section className="min-w-0 overflow-auto">
              <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-line bg-ink px-4 py-3">
                <div className="min-w-[180px]">
                  <div className="text-sm font-semibold text-white">Inbox Review</div>
                  <div className="text-xs text-muted">
                    {(inbox?.tracks.length ?? 0).toLocaleString()} visible newly scanned tracks
                  </div>
                </div>
                <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button className="secondary-button shrink-0" type="button" disabled={viewTracks.length === 0} onClick={() => onShuffleTracks(viewTracks)}>
                    <Shuffle size={15} />
                    Shuffle
                  </button>
                  <button className="secondary-button shrink-0" type="button" disabled={viewTracks.length === 0} onClick={() => onExportTracks(viewTracks.map((track) => track.id))}>
                    <Download size={15} />
                    Export
                  </button>
                </div>
              </div>
              <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                <colgroup>
                  <col style={{ width: librarySelectionColumnWidth }} />
                  <col style={{ width: columnWidths.play }} />
                  {visibleColumnDefs.map((column) => (
                    <col key={column.key} style={{ width: columnWidths[column.key] }} />
                  ))}
                </colgroup>
                <thead className="border-b border-line bg-[rgb(var(--color-strip))] text-xs uppercase text-muted">
                  {renderTableHeader(false)}
                </thead>
                <tbody>{renderTrackRows(inbox?.tracks ?? [])}</tbody>
              </table>
              {(inbox?.tracks.length ?? 0) === 0 && (
                <div className="grid h-72 place-items-center px-6 text-center text-sm text-muted">
                  Newly scanned tracks will appear here until you mark them reviewed.
                </div>
              )}
            </section>
          </div>
        )}

        {libraryView === "health" && (
          <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
            <section className="border-r border-line p-4">
              <div className="grid gap-3 text-sm">
                <div className="rounded border border-line bg-panel p-3">
                  <div className="text-xs uppercase text-muted">Tracks</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{libraryStats?.total_tracks.toLocaleString() ?? "-"}</div>
                </div>
                <div className="rounded border border-line bg-panel p-3">
                  <div className="text-xs uppercase text-muted">Albums</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{libraryStats?.total_albums.toLocaleString() ?? "-"}</div>
                </div>
                <div className="rounded border border-line bg-panel p-3">
                  <div className="text-xs uppercase text-muted">Unrated</div>
                  <div className="mt-1 text-2xl font-semibold text-ember">{libraryStats?.unrated_tracks.toLocaleString() ?? "-"}</div>
                </div>
                <div className="rounded border border-line bg-panel p-3">
                  <div className="text-xs uppercase text-muted">Play / Skip Events</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {libraryStats ? `${libraryStats.played_events} / ${libraryStats.skipped_events}` : "-"}
                  </div>
                </div>
              </div>
            </section>
            <section className="min-w-0 overflow-auto p-5">
              <div className="grid gap-5">
                <div>
                  <h2 className="mb-2 text-sm font-semibold text-white">Missing Files</h2>
                  <div className="rounded border border-line">
                    {(libraryHealth?.missing_files ?? []).slice(0, 12).map((track) => (
                      <div key={track.id} className="flex items-center justify-between gap-3 border-b border-line/60 px-3 py-2">
                        <button
                          className="min-w-0 flex-1 text-left"
                          type="button"
                          onClick={() => setDetailTrack(track)}
                        >
                          <div className="truncate text-sm text-white">{display(track.title, "Untitled")}</div>
                          <div className="truncate text-xs text-muted">{track.path}</div>
                        </button>
                        <button
                          className="secondary-button h-8"
                          type="button"
                          onClick={() => onDeleteTrack(track.id, false)}
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    ))}
                    {(libraryHealth?.missing_files ?? []).length === 0 && (
                      <div className="px-3 py-3 text-sm text-muted">No missing files found.</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-white">Missing Metadata</h2>
                      <div className="text-xs text-muted">
                        Showing {visibleMissingMetadataRows.length.toLocaleString()} of{" "}
                        {(libraryHealth?.missing_metadata_total ?? missingMetadataRows.length).toLocaleString()} incomplete music tracks
                      </div>
                    </div>
                    {filteredMissingMetadataRows.length > 30 && (
                      <button
                        className="text-xs text-muted hover:text-white"
                        type="button"
                        onClick={() => setShowAllMissingMetadata((current) => !current)}
                      >
                        {showAllMissingMetadata ? "Show fewer" : `Show all ${filteredMissingMetadataRows.length.toLocaleString()}`}
                      </button>
                    )}
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {missingMetadataFilters.map((filter) => {
                      const active = missingMetadataFilter === filter.id;
                      return (
                        <button
                          key={filter.id}
                          className={`rounded border px-2 py-1 text-xs transition ${
                            active ? "border-moss bg-moss/10 text-moss" : "border-line bg-panel text-muted hover:text-white"
                          }`}
                          type="button"
                          onClick={() => setMissingMetadataFilter(filter.id)}
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded border border-line">
                    {visibleMissingMetadataRows.map((track) => {
                      const fields = missingMetadataFields(track);
                      return (
                        <div key={track.id} className="flex items-center gap-3 border-b border-line/60 px-3 py-2 text-sm last:border-b-0 hover:bg-white/[0.035]">
                          <button className="min-w-0 flex-1 text-left" type="button" onClick={() => setDetailTrack(track)} onDoubleClick={() => onPlayTrack(track, [track])}>
                            <div className="truncate text-white">{display(track.title, fileName(track.path) || "Untitled")}</div>
                            <div className="truncate text-xs text-muted">{display(track.artist)} - {display(track.album)}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {fields.map((field) => (
                                <span key={field.id} className="rounded border border-ember/40 bg-ember/10 px-1.5 py-0.5 text-[11px] text-ember">
                                  {field.label}
                                </span>
                              ))}
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <button className="icon-button h-8 w-8" type="button" title="Play track" onClick={() => onPlayTrack(track, [track])}>
                              <Play size={14} />
                            </button>
                            <button className="secondary-button h-8" type="button" onClick={() => onEditTrack(track)}>
                              <Pencil size={14} />
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {visibleMissingMetadataRows.length === 0 && (
                      <div className="px-3 py-3 text-sm text-muted">
                        {missingMetadataFilter === "all" ? "No missing metadata found." : "No tracks match this missing-field filter."}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-white">Potential Duplicates</h2>
                      {(libraryHealth?.ignored_duplicate_group_total ?? 0) > 0 && (
                        <div className="text-xs text-muted">
                          {libraryHealth?.ignored_duplicate_group_total.toLocaleString()} ignored
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {(libraryHealth?.ignored_duplicate_group_total ?? 0) > 0 && (
                        <button
                          className="text-xs text-muted hover:text-white"
                          type="button"
                          onClick={() => void onClearIgnoredDuplicateGroups()}
                        >
                          Show ignored
                        </button>
                      )}
                      <button
                        className="text-xs text-muted hover:text-white"
                        type="button"
                        onClick={() => setShowAllDuplicateGroups((current) => !current)}
                      >
                        {showAllDuplicateGroups ? "Show fewer" : `Review all ${(libraryHealth?.duplicate_group_total ?? libraryHealth?.duplicate_groups.length ?? 0).toLocaleString()}`}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {visibleDuplicateGroups.map((group: DuplicateGroup) => {
                      const keepId = group.recommended_keep_id ?? group.tracks[0]?.id ?? null;
                      const removableIds = group.tracks.filter((track) => track.id !== keepId).map((track) => track.id);
                      return (
                        <div key={group.key} className="rounded border border-line bg-panel p-3">
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{group.key}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                                <span className="rounded border border-line bg-ink px-2 py-1 text-muted">{group.match_reason}</span>
                                {group.duration_spread_seconds !== null && (
                                  <span className="rounded border border-line bg-ink px-2 py-1 text-muted">
                                    spread {formatTime(group.duration_spread_seconds)}
                                  </span>
                                )}
                                {group.bitrate_spread !== null && (
                                  <span className="rounded border border-line bg-ink px-2 py-1 text-muted">
                                    bitrate spread {formatBitrate(group.bitrate_spread)}
                                  </span>
                                )}
                                {group.shared_fingerprint && (
                                  <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-moss">same fingerprint</span>
                                )}
                                {group.average_audio_similarity !== null && (
                                  <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-moss">
                                    CLAP {group.average_audio_similarity.toFixed(2)}
                                  </span>
                                )}
                                {group.analyzed_tracks > 0 && (
                                  <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-moss">
                                    {group.analyzed_tracks} analyzed
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <div className="text-xs text-muted">{group.tracks.length} tracks</div>
                              <button
                                className="secondary-button h-8"
                                type="button"
                                title="Hide this duplicate group from Library Health"
                                onClick={() => void onIgnoreDuplicateGroup(group.ignore_key, group.key)}
                              >
                                <CheckCircle2 size={14} />
                                Ignore
                              </button>
                              <button
                                className="secondary-button h-8"
                                type="button"
                                disabled={removableIds.length === 0}
                                onClick={() => onRequestDeleteTracks(removableIds, `duplicates for ${group.key}`, true)}
                              >
                                <Trash2 size={14} />
                                Remove Others
                              </button>
                              <button
                                className="secondary-button h-8"
                                type="button"
                                onClick={() => onAnalyzeTracks(group.tracks.map((track) => track.id))}
                                disabled={isAudioAnalyzing}
                              >
                                <Wand2 size={14} />
                                Analyze Set
                              </button>
                            </div>
                          </div>
                          {group.recommendation_reason && (
                            <div className="mb-2 rounded border border-moss/30 bg-moss/10 px-2 py-1.5 text-xs text-moss">
                              Keep suggestion: {group.recommendation_reason}
                            </div>
                          )}
                          <div className="grid gap-1">
                            {group.tracks.map((track) => {
                              const recommended = track.id === keepId;
                              return (
                                <div
                                  key={track.id}
                                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/[0.04] ${
                                    recommended ? "bg-moss/10 text-moss" : "text-muted"
                                  }`}
                                >
                                  <button className="flex min-w-0 flex-1 items-center gap-2 text-left" type="button" onClick={() => setDetailTrack(track)} onDoubleClick={() => onPlayTrack(track, group.tracks)}>
                                    <span className="w-12 shrink-0 tabular-nums">{formatDuration(track.duration_seconds)}</span>
                                    <span className="w-20 shrink-0 tabular-nums">{formatBitrate(track.bitrate)}</span>
                                    <span className="min-w-0 flex-1 truncate">{track.path}</span>
                                    <span className="w-24 shrink-0 truncate text-right">{formatFingerprint(track.audio_fingerprint)}</span>
                                  </button>
                                  {recommended && <span className="shrink-0 rounded border border-moss/40 px-2 py-0.5">keep</span>}
                                  <button className="icon-button h-7 w-7 shrink-0" type="button" title="Play this copy" onClick={() => onPlayTrack(track, group.tracks)}>
                                    <Play size={13} />
                                  </button>
                                  <button
                                    className="secondary-button h-7 shrink-0 px-2"
                                    type="button"
                                    title="Remove this track from the library or send the file to the Recycle Bin"
                                    onClick={() => onRequestDeleteTracks([track.id], display(track.title, fileName(track.path) || "duplicate track"), true)}
                                  >
                                    <Trash2 size={13} />
                                    Delete
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          {group.path_roots.length > 0 && (
                            <details className="mt-2 text-xs text-muted">
                              <summary className="cursor-pointer text-neutral-300">Folders</summary>
                              <div className="mt-1 grid gap-1">
                                {group.path_roots.map((path) => (
                                  <div key={path} className="truncate">{path}</div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                    {visibleDuplicateGroups.length === 0 && (
                      <div className="rounded border border-line bg-panel px-3 py-3 text-sm text-muted">No duplicate groups found.</div>
                    )}
                  </div>
                </div>
                <div>
                  <h2 className="mb-2 text-sm font-semibold text-white">Unrated Triage</h2>
                  <div className="rounded border border-line">
                    {(libraryHealth?.unrated_tracks ?? []).slice(0, 12).map((track) => (
                      <div key={track.id} className="flex items-center justify-between gap-3 border-b border-line/60 px-3 py-2">
                        <button className="min-w-0 flex-1 truncate text-left text-sm text-white" type="button" onClick={() => onPlayTrack(track, libraryHealth?.unrated_tracks ?? [])}>
                          {display(track.title, "Untitled")} - {display(track.artist)}
                        </button>
                        <RatingStars rating={track.rating} onChange={(rating) => onRating(track.id, rating)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
      {renderActiveTopButton()}
      <TrackDetailsPanel
        track={detailTrack}
        queue={viewTracks}
        playlists={playlists}
        isAudioAnalyzing={isAudioAnalyzing}
        onClose={() => setDetailTrack(null)}
        onSelectTrack={selectSingleTrack}
        isTrackSelected={detailTrack ? selectedTrackIds.has(detailTrack.id) : false}
        onPlayTrack={onPlayTrack}
        onRating={onRating}
        onAnalyzeTracks={onAnalyzeTracks}
        onAddTracksToPlaylist={onAddTracksToPlaylist}
        onDeleteTrack={onDeleteTrack}
        onEditTrack={onEditTrack}
        onRevealTrack={onRevealTrack}
      />
      {bulkMetadataOpen && (
        <BulkMetadataModal
          tracks={selectedTracks}
          writeToFiles={writeRatingsToFiles}
          onClose={() => setBulkMetadataOpen(false)}
          onSave={async (metadata) => {
            await onBulkMetadata(selectedIds, metadata);
            setBulkMetadataOpen(false);
            clearSelection();
          }}
        />
      )}
      </div>
      {libraryActionsMenu && (
        <div
          role="menu"
          className="fixed z-50 w-72 rounded border border-line bg-[rgb(var(--color-popover))] p-3 text-sm shadow-2xl"
          style={{ left: libraryActionsMenu.x, top: libraryActionsMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <label className="grid gap-2 text-xs uppercase text-muted">
            Playlist target
            <select
              className="h-9 rounded border border-line bg-panel px-2 text-sm normal-case text-white outline-none ring-moss/40 focus:ring-2"
              value={targetPlaylistId ?? ""}
              onChange={(event) => setTargetPlaylistId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Choose playlist...</option>
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid gap-1 border-t border-line pt-2">
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-neutral-200 hover:bg-white/10 disabled:text-muted"
              type="button"
              disabled={!targetPlaylistId || viewTracks.length === 0}
              onClick={() => {
                void onAddTracksToPlaylist(viewTracks.map((track) => track.id));
                setLibraryActionsMenu(null);
              }}
            >
              <Plus size={15} />
              Add current view to target
            </button>
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-neutral-200 hover:bg-white/10"
              type="button"
              onClick={() => {
                void refreshTracks();
                setLibraryActionsMenu(null);
              }}
            >
              <RefreshCw size={15} />
              Refresh view
            </button>
            {libraryView === "albums" && activeAlbum && (
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-neutral-200 hover:bg-white/10"
                type="button"
                onClick={() => {
                  void openAlbumArtworkManager(activeAlbum.id);
                  setLibraryActionsMenu(null);
                }}
              >
                <Album size={15} />
                Album artwork
              </button>
            )}
          </div>
        </div>
      )}
      {columnMenu && (
        <div
          className="fixed z-50 max-h-[70vh] w-80 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] p-3 text-sm text-neutral-100 shadow-2xl"
          style={{ left: columnMenu.x, top: columnMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white">Visible Columns</div>
              <div className="text-xs text-muted">Drag headers to reorder. Right-click here to show or hide fields.</div>
            </div>
            <button
              className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-white"
              type="button"
              onClick={() => setLibraryVisibleColumns(defaultLibraryVisibleColumns)}
            >
              Reset
            </button>
          </div>
          {(["Default", "Metadata", "Listening", "Analysis", "File"] as LibraryColumnDefinition["category"][]).map((category) => (
            <div key={category} className="border-t border-line py-2 first:border-t-0">
              <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted/80">{category}</div>
              <div className="grid gap-1">
                {libraryColumnDefinitions
                  .filter((column) => column.category === category)
                  .map((column) => {
                    const checked = visibleColumns.includes(column.key);
                    return (
                      <label
                        key={column.key}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-white/10"
                      >
                        <span className={checked ? "text-white" : "text-muted"}>{column.label}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-moss"
                          checked={checked}
                          disabled={checked && visibleColumns.length <= 1}
                          onChange={() => toggleVisibleColumn(column.key)}
                        />
                      </label>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 max-h-[calc(100vh-24px)] w-64 overflow-y-auto rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {contextBulk && (
            <div className="border-b border-line px-3 py-2 text-xs text-muted">
              {contextSelectionIds.length.toLocaleString()} selected
            </div>
          )}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              onPlayTrack(contextMenu.track, contextMenu.queue);
              setContextMenu(null);
            }}
          >
            <Play size={15} />
            Play
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              onPlayNext(contextMenu.track);
              setContextMenu(null);
            }}
          >
            <SkipForward size={15} />
            Play Next
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              onAddToQueue(contextMenu.track);
              setContextMenu(null);
            }}
          >
            <Plus size={15} />
            Add To Queue
          </button>
          <button
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              if (contextBulk) {
                setBulkMetadataOpen(true);
              } else {
                onEditTrack(contextMenu.track);
              }
              setContextMenu(null);
            }}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Pencil size={15} />
              <span className="truncate">{contextBulk ? "Edit Selected Metadata" : "Edit Metadata"}</span>
            </span>
            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">F2</span>
          </button>
          <div className="relative" onMouseEnter={() => openContextSubmenu("tagging")} onMouseLeave={scheduleContextSubmenuClose}>
            <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
              <span className="inline-flex items-center gap-2">
                <Tag size={15} />
                Tagging
              </span>
              <span className="text-muted">{">"}</span>
            </button>
            <div
              className={contextSubmenuClass(
                "tagging",
                "fixed z-[60] w-56 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] py-1 shadow-2xl transition",
              )}
              style={contextSubmenuStyle(4, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_TAGGING_SUBMENU_HEIGHT)}
              onMouseEnter={() => openContextSubmenu("tagging")}
              onMouseLeave={scheduleContextSubmenuClose}
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onAutoTagTracks(contextSelectionIds, false);
                  setContextMenu(null);
                }}
              >
                <Wand2 size={15} />
                Preview Auto-Tag
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onSyncFileMetadata(contextSelectionIds);
                  setContextMenu(null);
                }}
              >
                <RefreshCw size={15} />
                Sync Metadata From Files
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onFingerprintTagTracks(contextSelectionIds);
                  setContextMenu(null);
                }}
              >
                <Fingerprint size={15} />
                Fingerprint Tag Preview
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onClapGenreTagTracks(contextSelectionIds);
                  setContextMenu(null);
                }}
              >
                <Tag size={15} />
                Preview CLAP Genres
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onVolumeTagTracks(contextSelectionIds);
                  setContextMenu(null);
                }}
              >
                <Volume2 size={15} />
                Mark Volume Tags
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  const ids = [...contextSelectionIds];
                  void (async () => {
                    await onBulkMetadata(ids, { genre: "Audiobook", write_to_file: writeRatingsToFiles });
                    if (contextBulk) {
                      clearSelection();
                    }
                    await refreshTracks();
                  })();
                  setContextMenu(null);
                }}
              >
                <BookOpen size={15} />
                Mark as Audiobook
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  const ids = [...contextSelectionIds];
                  void (async () => {
                    await onBulkMetadata(ids, { genre: "Podcast", write_to_file: writeRatingsToFiles });
                    if (contextBulk) {
                      clearSelection();
                    }
                    await refreshTracks();
                  })();
                  setContextMenu(null);
                }}
              >
                <Podcast size={15} />
                Mark as Podcast
              </button>
            </div>
          </div>
          <div className="relative" onMouseEnter={() => openContextSubmenu("rating")} onMouseLeave={scheduleContextSubmenuClose}>
            <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
              <span className="inline-flex items-center gap-2">
                <Star size={15} />
                Rating
              </span>
              <span className="text-muted">{">"}</span>
            </button>
            <div
              className={contextSubmenuClass(
                "rating",
                "fixed z-[60] grid w-48 grid-cols-2 gap-1 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] p-2 shadow-2xl transition",
              )}
              style={contextSubmenuStyle(5, TRACK_RATING_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT)}
              onMouseEnter={() => openContextSubmenu("rating")}
              onMouseLeave={scheduleContextSubmenuClose}
            >
              {[null, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating) => (
                <button
                  key={rating ?? "none"}
                  className="rounded px-2 py-1.5 text-left text-xs hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    void onBulkRating(contextSelectionIds, rating);
                    if (contextBulk) {
                      clearSelection();
                    }
                    setContextMenu(null);
                  }}
                >
                  {rating === null ? "Unrated" : formatRating(rating)}
                </button>
              ))}
            </div>
          </div>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              onQuickAutoDj(contextMenu.track);
              setContextMenu(null);
            }}
          >
            <Wand2 size={15} />
            AutoDJ From Track
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              onRevealTrack(contextMenu.track);
              setContextMenu(null);
            }}
          >
            <FolderOpen size={15} />
            Reveal in Explorer
          </button>
          <div className="my-1 border-t border-line" />
          <div className="relative" onMouseEnter={() => openContextSubmenu("avoid")} onMouseLeave={scheduleContextSubmenuClose}>
            <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
              <span className="inline-flex items-center gap-2">
                <X size={15} />
                Avoid in AutoDJ
              </span>
              <span className="text-muted">{">"}</span>
            </button>
            <div
              className={contextSubmenuClass(
                "avoid",
                "fixed z-[60] w-44 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] py-1 shadow-2xl transition",
              )}
              style={contextSubmenuStyle(8, TRACK_AVOID_SUBMENU_WIDTH, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_CONTEXT_DIVIDER_HEIGHT)}
              onMouseEnter={() => openContextSubmenu("avoid")}
              onMouseLeave={scheduleContextSubmenuClose}
            >
              {(
                [
                  ["track", "Track", X],
                  ["artist", "Artist", UserRound],
                  ["album", "Album", Album],
                  ["genre", "Genre", SlidersHorizontal],
                ] as const
              ).map(([scope, label, Icon]) => (
                <button
                  key={scope}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    void onAvoidAutoDj(scope, contextMenu.track);
                    setContextMenu(null);
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative" onMouseEnter={() => openContextSubmenu("playlist")} onMouseLeave={scheduleContextSubmenuClose}>
            <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
              <span className="inline-flex min-w-0 items-center gap-2">
                <Plus size={15} />
                <span className="truncate">{contextBulk ? "Add Selected To Playlist" : "Add To Playlist"}</span>
              </span>
              <span className="text-muted">{">"}</span>
            </button>
            <div
              className={contextSubmenuClass(
                "playlist",
                "fixed z-[60] w-60 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] py-1 shadow-2xl transition",
              )}
              style={contextSubmenuStyle(9, TRACK_PLAYLIST_SUBMENU_WIDTH, contextPlaylistSubmenuHeight, TRACK_CONTEXT_DIVIDER_HEIGHT)}
              onMouseEnter={() => openContextSubmenu("playlist")}
              onMouseLeave={scheduleContextSubmenuClose}
            >
              {playlists.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted">No playlists yet</div>
              ) : (
                playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/10"
                    type="button"
                    title={playlist.name}
                    onClick={() => {
                      void onAddTracksToPlaylist(contextSelectionIds, playlist.id);
                      setContextMenu(null);
                    }}
                  >
                    <span className="min-w-0 truncate">{playlist.name}</span>
                    <span className="shrink-0 text-xs text-muted">{playlist.track_count.toLocaleString()}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          {contextBulk && (
            <>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onExportTracks(contextSelectionIds);
                  clearSelection();
                  setContextMenu(null);
                }}
              >
                <Download size={15} />
                Export Selected
              </button>
              {libraryView === "playlists" && (
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    void onRemoveTracksFromPlaylist(contextSelectionIds);
                    clearSelection();
                    setContextMenu(null);
                  }}
                >
                  <Trash2 size={15} />
                  Remove Selected
                </button>
              )}
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  clearSelection();
                  setContextMenu(null);
                }}
              >
                <X size={15} />
                Clear Selection
              </button>
            </>
          )}
          {contextMenu.removable && (
            <>
              <div className="my-1 border-t border-line" />
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onMovePlaylistTrack(contextMenu.track.id, "up");
                  setContextMenu(null);
                }}
              >
                <ArrowUp size={15} />
                Move Up
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onMovePlaylistTrack(contextMenu.track.id, "down");
                  setContextMenu(null);
                }}
              >
                <ArrowDown size={15} />
                Move Down
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onRemoveTrackFromPlaylist(contextMenu.track.id);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={15} />
                Remove From Playlist
              </button>
            </>
          )}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            disabled={isAudioAnalyzing}
            onClick={() => {
              onAnalyzeTracks(contextSelectionIds);
              if (contextBulk) {
                clearSelection();
              }
              setContextMenu(null);
            }}
          >
            <BarChart3 size={15} />
            {contextBulk ? "Analyze Selected" : "Analyze Track"}
          </button>
          <div className="my-1 border-t border-line" />
          <button
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-ember hover:bg-white/10"
            type="button"
            onClick={() => {
              onRequestDeleteTracks(contextSelectionIds, contextLabel);
              setContextMenu(null);
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 size={15} />
              Delete...
            </span>
            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">Del</span>
          </button>
        </div>
      )}
    </main>
  );
}
