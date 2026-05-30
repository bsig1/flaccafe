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
  RadioTower,
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
import { LibraryPageView } from "./library/LibraryPageView";
import { createLibraryTrackRenderers } from "./library/LibraryTrackRenderers";
import { useLibraryColumnController } from "./library/useLibraryColumnController";
import { useLibrarySelectionController } from "./library/useLibrarySelectionController";
import { useLibraryScrollController } from "./library/useLibraryScrollController";
import type { LibraryPageProps } from "./library/LibraryPageTypes";
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
}: LibraryPageProps) {
  const [contextMenu, setContextMenu] = useState<TrackContextMenu | null>(null);
  const [activeContextSubmenu, setActiveContextSubmenu] = useState<ContextSubmenuKey | null>(null);
  const columnController = useLibraryColumnController({ libraryVisibleColumns, setLibraryVisibleColumns, setSort, setContextMenu });
  const { columnWidths, setColumnWidths, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, visibleColumns, visibleColumnDefs, tableWidth, handleSort, handleResize, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart } = columnController;
  const [showAllDuplicateGroups, setShowAllDuplicateGroups] = useState(false);
  const [showAllMissingMetadata, setShowAllMissingMetadata] = useState(false);
  const [missingMetadataFilter, setMissingMetadataFilter] = useState<MissingMetadataFilter>("all");
  const [bulkMetadataOpen, setBulkMetadataOpen] = useState(false);
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
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextSubmenuCloseTimer = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const completionLookupCancelRef = useRef(false);

  const advancedSearchActiveCount = Object.entries(advancedTrackSearch).filter(([key, value]) => {
    if (key === "rating_state") {
      return value !== undefined && value !== "any";
    }
    return typeof value === "boolean" ? value : Boolean(String(value ?? "").trim());
  }).length;
  const trackSearchActive = Boolean(search.trim()) || advancedSearchActiveCount > 0;
  const libraryHasAnyTracks = (libraryStats?.total_tracks ?? (trackSearchActive ? Math.max(totalTracks, tracks.length, 1) : totalTracks)) > 0;
  const rowPadding = compactRows ? "px-3 py-2" : "px-3 py-3";
  const trackRowHeight = compactRows ? 49 : 57;
  const loadedTrackCount = trackIndexCache.size;
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
  const scrollController = useLibraryScrollController({ ArrowUp, albumGrid, albumMode, albumScrollTop, albums, artistScrollTop, artists, columnMenu, completionHeightVersion, completionOpenAlbumId, completionScrollTop, contextMenu, hasMoreTracks, isLoading, libraryActionsMenu, libraryView, loadMoreTracks, loadTrackWindow, playlistScrollTop, playlists, scrollTop, setAlbumScrollTop, setArtistScrollTop, setColumnMenu, setCompletionHeightVersion, setCompletionScrollTop, setContextMenu, setLibraryActionsMenu, setPlaylistScrollTop, setScrollTop, totalTracks, trackIndexCache, trackRowHeight, tracks, visibleCompletionAlbums });
  const { virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, completionRowHeightsRef, completionRowObserversRef, playlistListRef, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, handleScroll } = scrollController;
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
  const selectionController = useLibrarySelectionController({ advancedSelectionKey, advancedTrackSearch, detailTrack, inbox, libraryView, onEditTrack, onRequestDeleteTracks, search, searchInputRef, setBulkMetadataOpen, setDetailTrack, setShowAllDuplicateGroups, selectedAlbumId, selectedArtistName, selectedPlaylistId, sort, totalTracks, tracks, viewTracks });
  const { selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, selectionAnchorId, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, cancelPendingTrackDetailOpen, scheduleTrackDetailOpen } = selectionController;

  function scrollToTrackInCurrentView(track: Track) {
    const renderedRow = scrollRef.current?.querySelector<HTMLElement>(
      `[data-track-row][data-track-id="${track.id}"]`,
    );
    if (renderedRow) {
      renderedRow.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
      return;
    }

    if (libraryView !== "tracks" || !scrollRef.current) {
      return;
    }

    let targetIndex = -1;
    for (const [index, cachedTrack] of trackIndexCache.entries()) {
      if (cachedTrack.id === track.id) {
        targetIndex = index;
        break;
      }
    }
    if (targetIndex < 0) {
      targetIndex = tracks.findIndex((candidate) => candidate.id === track.id);
    }
    if (targetIndex < 0) {
      return;
    }

    const centerOffset = Math.max(0, (trackViewportHeight - trackRowHeight) / 2);
    const targetScrollTop = Math.min(
      maxVirtualScrollTop,
      Math.max(0, targetIndex * trackRowHeight - centerOffset),
    );
    scrollRef.current.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    scheduleScrollPositionSave(targetScrollTop);
  }

  function selectAndScrollToTrack(track: Track) {
    selectSingleTrack(track);
    window.requestAnimationFrame(() => scrollToTrackInCurrentView(track));
  }

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

  function openTrackContextMenu(event: ReactMouseEvent, track: Track, queue: Track[], removable = false) {
    event.preventDefault();
    setDetailTrack(track);
    if (!selectedTrackIds.has(track.id)) {
      selectSingleTrack(track);
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

  const libraryPageModelBase = { Album, ArrowDown, ArrowUp, BarChart3, BookOpen, CheckCircle2, Download, Fingerprint, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Play, Podcast, Plus, RadioTower, RefreshCw, Save, Search, ShieldCheck, Shuffle, SkipForward, SlidersHorizontal, Star, Tag, Trash2, Upload, UserRound, Volume2, Wand2, X, RatingStars, ResizableHeader, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, albumArtworkUrl, albumCoverUrl, defaultLibraryVisibleColumns, libraryColumnDefinitions, librarySelectionColumnWidth, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatRating, formatShortDate, formatTime, trackGenre, albumMetaLabel, artistMetaLabel, missingMetadataFields, missingMetadataFilters, ALBUM_GRID_ROW_HEIGHT, ALBUM_LIST_ROW_HEIGHT, ARTIST_ROW_HEIGHT, COMPLETION_COLLAPSED_ROW_HEIGHT, COMPLETION_EXPANDED_ROW_ESTIMATE, LIBRARY_ACTIONS_MENU_HEIGHT, LIBRARY_ACTIONS_MENU_WIDTH, MENU_VIEWPORT_MARGIN, PLAYLIST_ROW_HEIGHT, PLAYLIST_TOOLBAR_HEIGHT, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_AVOID_SUBMENU_WIDTH, TRACK_CONTEXT_DIVIDER_HEIGHT, TRACK_CONTEXT_HEADER_HEIGHT, TRACK_CONTEXT_MENU_HEIGHT, TRACK_CONTEXT_MENU_WIDTH, TRACK_CONTEXT_ROW_HEIGHT, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_PLAYLIST_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT, TRACK_RATING_SUBMENU_WIDTH, TRACK_SUBMENU_CLOSE_DELAY_MS, TRACK_TAGGING_SUBMENU_HEIGHT, TRACK_VIRTUALIZATION_OVERSCAN, TRACK_VIRTUALIZATION_THRESHOLD, tracks, trackIndexCache, totalTracks, albums, artists, playlists, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, libraryStats, libraryHealth, inbox, targetPlaylistId, newPlaylistName, importPlaylistPath, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, setAdvancedTrackSearch, refreshTracks, refreshAlbums, loadMoreTracks, loadTrackWindow, isLoading, hasMoreTracks, sort, setSort, scrollTop, setScrollTop, artistScrollTop, setArtistScrollTop, albumScrollTop, setAlbumScrollTop, completionScrollTop, setCompletionScrollTop, playlistScrollTop, setPlaylistScrollTop, onRating, onBulkRating, onPlayTrack, onPlayNext, onAddToQueue, onSelectAlbum, onSelectArtist, onPlayAlbum, onPlayArtist, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onAutoTagTracks, onSyncFileMetadata, onFingerprintTagTracks, onClapGenreTagTracks, onVolumeTagTracks, onOpenFileManagementTracks, onRequestDeleteTracks, onRemoveTrackFromPlaylist, onRemoveTracksFromPlaylist, onMovePlaylistTrack, onExportTracks, onExportPlaylist, onImportPlaylist, onReviewInboxTracks, onUpdateInboxNote, onSaveInboxAutoReviewRule, onDeleteInboxAutoReviewRule, onShuffleTracks, onQuickAutoDj, onAvoidAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, onIgnoreDuplicateGroup, onClearIgnoredDuplicateGroups, isAudioAnalyzing, currentTrackId, currentTrack, hideFilePaths, compactRows, albumGrid, writeRatingsToFiles, libraryVisibleColumns, setLibraryVisibleColumns, onAlbumGridChange, setTargetPlaylistId, setNewPlaylistName, setImportPlaylistPath, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, columnWidths, setColumnWidths, contextMenu, setContextMenu, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, activeContextSubmenu, setActiveContextSubmenu, selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, showAllDuplicateGroups, setShowAllDuplicateGroups, showAllMissingMetadata, setShowAllMissingMetadata, missingMetadataFilter, setMissingMetadataFilter, bulkMetadataOpen, setBulkMetadataOpen, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, albumArtworkCandidates, setAlbumArtworkCandidates, isAlbumArtworkOpen, setIsAlbumArtworkOpen, isSearchingAlbumArtwork, setIsSearchingAlbumArtwork, albumArtworkStatus, setAlbumArtworkStatus, inboxNoteDraft, setInboxNoteDraft, editingInboxRuleId, setEditingInboxRuleId, inboxRuleName, setInboxRuleName, inboxRuleEnabled, setInboxRuleEnabled, inboxRuleField, setInboxRuleField, inboxRuleMatchType, setInboxRuleMatchType, inboxRuleValue, setInboxRuleValue, inboxRuleNote, setInboxRuleNote, inboxRuleApplyExisting, setInboxRuleApplyExisting, albumMode, setAlbumMode, completionFilter, setCompletionFilter, completionHeightVersion, setCompletionHeightVersion, completionOpenAlbumId, setCompletionOpenAlbumId, completionLoadingAlbumId, setCompletionLoadingAlbumId, completionLookupAlbumId, setCompletionLookupAlbumId, completionLookupMessages, setCompletionLookupMessages, completionLookupAllActive, setCompletionLookupAllActive, completionLookupAllProgress, setCompletionLookupAllProgress, showAdvancedSearch, setShowAdvancedSearch, virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, playlistListRef, contextMenuRef, searchInputRef, selectionAnchorId, completionLookupCancelRef, visibleColumns, visibleColumnDefs, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, rowPadding, trackRowHeight, loadedTrackCount, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, advancedSearchInputClass, activeAlbum, activeArtist, activePlaylist, missingMetadataRows, filteredMissingMetadataRows, visibleMissingMetadataRows, visibleDuplicateGroups, completionQuery, completionSearchTerms, completionMatchesSearch, albumCompletionExpected, albumCompletionMissing, completionAlbums, visibleCompletionAlbums, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, completeAlbumCount, missingTrackEstimate, advancedSelectionKey, completionLookupEta, librarySummaryText, viewTracks, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, resetInboxRuleForm, editInboxRule, saveInboxRule, handleSort, handleResize, toggleTrackSelection, selectSingleTrack, selectAndScrollToTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, cancelPendingTrackDetailOpen, scheduleTrackDetailOpen, loadAlbumArtworkCandidates, openAlbumArtworkManager, albumArtworkActionStatus, chooseSidecarArtwork, embedSidecarArtwork, saveEmbeddedArtwork, embedEmbeddedArtwork, searchWebArtwork, saveWebArtwork, clearSelectedAlbumArtwork, handleScroll, openTrackContextMenu, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart, toggleCompletionAlbum, handleCompletionLengthLookup, handleCompletionLookupAll, cancelCompletionLookupAll, updateAdvancedTrackSearch, clearAdvancedTrackSearch, contextSelectionTracks, contextSelectionIds, contextBulk, contextLabel, contextPlaylistSubmenuHeight, contextSubmenuStyle, openContextSubmenu, scheduleContextSubmenuClose, contextSubmenuClass };
  const trackRenderers = createLibraryTrackRenderers(libraryPageModelBase);
  const libraryPageModel = { ...libraryPageModelBase, ...trackRenderers };
  return <LibraryPageView model={libraryPageModel} />;
}
