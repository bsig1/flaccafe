import {
  Album,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Download,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Shuffle,
  SkipForward,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  UIEvent as ReactUIEvent,
} from "react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  albumArtworkUrl,
  albumCoverUrl,
  chooseAlbumArtwork,
  clearAlbumArtwork,
  fetchAlbumArtworkCandidates,
  saveEmbeddedAlbumArtwork,
} from "../../lib/api";
import {
  placeFloatingMenu,
} from "../../lib/uiInteractions";
import type {
  AlbumSummary,
  AlbumArtworkCandidate,
  InboxAutoReviewField,
  InboxAutoReviewMatchType,
  InboxAutoReviewRule,
  InboxAutoReviewRuleRequest,
  LibraryHealthResponse,
  LibraryStatsResponse,
  InboxResponse,
  PlaylistSummary,
  SmartPlaylistRule,
  SmartPlaylistSummary,
  Track,
  TrackMetadataUpdate,
} from "../../types/api";
import {
  RatingStars,
  ResizableHeader,
} from "../components/common";
import { BulkMetadataModal } from "../components/modals";
import { QuickStartPanel } from "../components/QuickStartPanel";
import { TrackDetailsPanel } from "../components/TrackDetailsPanel";
import { LibraryViewTabs } from "./library/LibraryViewTabs";
import {
  ColumnContextMenu,
  LibraryColumnDefinition,
  LibraryColumnKey,
  LibraryView,
  MENU_VIEWPORT_MARGIN,
  MetadataColumnKey,
  SortKey,
  SortState,
  TRACK_AVOID_SUBMENU_WIDTH,
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

export function LibraryPage({
  tracks,
  totalTracks,
  albums,
  playlists,
  selectedAlbumId,
  selectedAlbumTracks,
  selectedPlaylistId,
  selectedPlaylistTracks,
  smartPresets,
  smartPlaylists,
  selectedSmartRule,
  smartTracks,
  smartPlaylistName,
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
  refreshTracks,
  loadMoreTracks,
  isLoading,
  hasMoreTracks,
  sort,
  setSort,
  scrollTop,
  setScrollTop,
  onRating,
  onBulkRating,
  onPlayTrack,
  onPlayNext,
  onAddToQueue,
  onSelectAlbum,
  onSelectPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddTracksToPlaylist,
  onDeleteTrack,
  onEditTrack,
  onBulkMetadata,
  onRequestDeleteTracks,
  onRemoveTrackFromPlaylist,
  onRemoveTracksFromPlaylist,
  onMovePlaylistTrack,
  onExportTracks,
  onExportPlaylist,
  onImportPlaylist,
  onPreviewSmartRule,
  onCreateSmartPlaylist,
  onDeleteSmartPlaylist,
  onSelectSmartPlaylist,
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
  isAudioAnalyzing,
  currentTrackId,
  currentTrack,
  hideFilePaths,
  compactRows,
  albumGrid,
  writeRatingsToFiles,
  libraryVisibleColumns,
  setLibraryVisibleColumns,
  setTargetPlaylistId,
  setNewPlaylistName,
  setImportPlaylistPath,
  setSmartPlaylistName,
  showQuickStart,
  isScanning,
  suggestedMusicPath,
  onChooseMusicFolder,
  onUseSuggestedFolder,
  onDismissQuickStart,
  onOpenSettings,
}: {
  tracks: Track[];
  totalTracks: number;
  albums: AlbumSummary[];
  playlists: PlaylistSummary[];
  selectedAlbumId: number | null;
  selectedAlbumTracks: Track[];
  selectedPlaylistId: number | null;
  selectedPlaylistTracks: Track[];
  smartPresets: Record<string, SmartPlaylistRule>;
  smartPlaylists: SmartPlaylistSummary[];
  selectedSmartRule: SmartPlaylistRule;
  smartTracks: Track[];
  smartPlaylistName: string;
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
  refreshTracks: () => void | Promise<void>;
  loadMoreTracks: () => void | Promise<void>;
  isLoading: boolean;
  hasMoreTracks: boolean;
  sort: SortState;
  setSort: (updater: (current: SortState) => SortState) => void;
  scrollTop: number;
  setScrollTop: (value: number) => void;
  onRating: (trackId: number, rating: number | null) => void;
  onBulkRating: (trackIds: number[], rating: number | null) => void | Promise<void>;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onSelectAlbum: (albumId: number) => void;
  onSelectPlaylist: (playlistId: number) => void;
  onCreatePlaylist: () => void;
  onDeletePlaylist: (playlistId: number) => void;
  onAddTracksToPlaylist: (trackIds: number[]) => void;
  onDeleteTrack: (trackId: number, deleteFile: boolean) => void;
  onEditTrack: (track: Track) => void;
  onBulkMetadata: (trackIds: number[], metadata: TrackMetadataUpdate) => void | Promise<void>;
  onRequestDeleteTracks: (trackIds: number[], title: string, allowFileDelete?: boolean) => void;
  onRemoveTrackFromPlaylist: (trackId: number) => void;
  onRemoveTracksFromPlaylist: (trackIds: number[]) => void | Promise<void>;
  onMovePlaylistTrack: (trackId: number, direction: "up" | "down") => void;
  onExportTracks: (trackIds: number[]) => void | Promise<void>;
  onExportPlaylist: (playlistId: number) => void;
  onImportPlaylist: () => void;
  onPreviewSmartRule: (rule: SmartPlaylistRule) => void;
  onCreateSmartPlaylist: () => void;
  onDeleteSmartPlaylist: (smartPlaylistId: number) => void;
  onSelectSmartPlaylist: (smartPlaylistId: number) => void;
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
  isAudioAnalyzing: boolean;
  currentTrackId: number | null;
  currentTrack: Track | null;
  hideFilePaths: boolean;
  compactRows: boolean;
  albumGrid: boolean;
  writeRatingsToFiles: boolean;
  libraryVisibleColumns: MetadataColumnKey[];
  setLibraryVisibleColumns: (columns: MetadataColumnKey[]) => void;
  setTargetPlaylistId: (playlistId: number | null) => void;
  setNewPlaylistName: (value: string) => void;
  setImportPlaylistPath: (value: string) => void;
  setSmartPlaylistName: (value: string) => void;
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
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(() => new Set());
  const [showAllDuplicateGroups, setShowAllDuplicateGroups] = useState(false);
  const [bulkMetadataOpen, setBulkMetadataOpen] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<MetadataColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<MetadataColumnKey | null>(null);
  const [albumArtworkCandidates, setAlbumArtworkCandidates] = useState<AlbumArtworkCandidate[]>([]);
  const [isAlbumArtworkOpen, setIsAlbumArtworkOpen] = useState(false);
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectionAnchorId = useRef<number | null>(null);

  const visibleColumns = normalizeLibraryColumns(libraryVisibleColumns);
  const visibleColumnDefs = visibleColumns
    .map((key) => libraryColumnDefinitions.find((column) => column.key === key))
    .filter((column): column is LibraryColumnDefinition => Boolean(column));
  const tableWidth = librarySelectionColumnWidth + columnWidths.play + visibleColumnDefs.reduce((total, column) => total + columnWidths[column.key], 0);
  const rowPadding = compactRows ? "px-3 py-2" : "px-3 py-3";
  const activeAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null;
  const activePlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null;
  const viewTracks =
    libraryView === "albums"
      ? selectedAlbumTracks
      : libraryView === "playlists"
        ? selectedPlaylistTracks
        : libraryView === "inbox"
          ? inbox?.tracks ?? []
        : libraryView === "smart"
          ? smartTracks
          : tracks;
  const selectedTracks = viewTracks.filter((track) => selectedTrackIds.has(track.id));
  const selectedIds = selectedTracks.map((track) => track.id);
  const allViewSelected = viewTracks.length > 0 && viewTracks.every((track) => selectedTrackIds.has(track.id));
  const inboxNotesByTrackId = new Map((inbox?.notes ?? []).map((note) => [note.track_id, note]));
  const selectedInboxTrack = libraryView === "inbox" && selectedTracks.length === 1 ? selectedTracks[0] : null;
  const selectedInboxNote = selectedInboxTrack ? inboxNotesByTrackId.get(selectedInboxTrack.id) ?? null : null;

  useEffect(() => {
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
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = scrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
      setColumnMenu(null);
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
      if (target?.closest("input, textarea, select, button, a, [contenteditable='true']")) {
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
  }, [selectedIds, selectedTracks, detailTrack, libraryView, onRequestDeleteTracks]);

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
      setSelectedTrackIds(new Set([track.id]));
    }
  }

  function setSelectionForList(list: Track[], selected: boolean) {
    selectionAnchorId.current = selected ? list[0]?.id ?? null : null;
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
    setContextMenu(null);
    setColumnMenu(null);
    setScrollTop(element.scrollTop);
    if (libraryView !== "tracks") {
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 520 && hasMoreTracks && !isLoading) {
      void loadMoreTracks();
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
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: TRACK_CONTEXT_MENU_WIDTH,
      menuHeight: TRACK_CONTEXT_MENU_HEIGHT,
      submenuWidth: TRACK_AVOID_SUBMENU_WIDTH,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setContextMenu({
      track,
      queue,
      removable,
      x: placement.x,
      y: placement.y,
      flipY: placement.flipY,
      submenuLeft: placement.submenuLeft,
    });
  }

  function openColumnContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    setContextMenu(null);
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
            aria-label="Select current view"
            type="checkbox"
            className="h-4 w-4 accent-moss"
            checked={allViewSelected}
            disabled={viewTracks.length === 0}
            onChange={(event) => setSelectionForList(viewTracks, event.target.checked)}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
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

  function renderTrackRows(list: Track[], options: { removable?: boolean } = {}) {
    return list.map((track) => (
      <tr
        key={track.id}
        className={`cursor-pointer border-b border-line/60 hover:bg-white/[0.035] ${
          detailTrack?.id === track.id ? "bg-white/[0.06]" : selectedTrackIds.has(track.id) ? "bg-white/[0.035]" : ""
        }`}
        onClick={(event) => {
          if (isInteractiveTrackCellTarget(event.target)) {
            return;
          }
          selectTrackLikeWindows(event, track, list);
        }}
        onContextMenu={(event) => openTrackContextMenu(event, track, list, Boolean(options.removable))}
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
                onPlayTrack(track, list);
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
    ));
  }

  const contextSelectionTracks =
    contextMenu && selectedTrackIds.has(contextMenu.track.id) ? selectedTracks : contextMenu ? [contextMenu.track] : [];
  const contextSelectionIds = contextSelectionTracks.map((track) => track.id);
  const contextBulk = contextSelectionIds.length > 1;
  const contextLabel = contextBulk
    ? `${contextSelectionIds.length.toLocaleString()} selected tracks`
    : display(contextMenu?.track.title, "Selected track");

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
          <p className="text-xs text-muted">
            {tracks.length.toLocaleString()} of {totalTracks.toLocaleString()} tracks loaded
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <label className="relative block min-w-[12rem] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full rounded border border-line bg-panel pl-9 pr-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2 sm:w-[min(20rem,42vw)]"
              placeholder="Search tracks, artists, albums"
            />
          </label>
          <button className="icon-button" title="Refresh" type="button" onClick={refreshTracks}>
            <RefreshCw size={17} />
          </button>
        </div>
      </header>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line bg-[rgb(var(--color-strip))] px-6 py-3">
        <LibraryViewTabs libraryView={libraryView} setLibraryView={setLibraryView} />

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <button
            className="icon-button"
            type="button"
            title="Shuffle current view"
            disabled={viewTracks.length === 0}
            onClick={() => onShuffleTracks(viewTracks)}
          >
            <Shuffle size={16} />
          </button>
          <button className="primary-button" type="button" onClick={() => onQuickAutoDj(currentTrack)}>
            <Wand2 size={16} />
            AutoDJ
          </button>
          <details className="relative" data-auto-close>
            <summary className="icon-button cursor-pointer list-none [&::-webkit-details-marker]:hidden" title="Library actions">
              <MoreHorizontal size={17} />
            </summary>
            <div className="absolute right-0 top-11 z-40 w-72 rounded border border-line bg-[rgb(var(--color-popover))] p-3 text-sm shadow-2xl">
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
                  onClick={() => onAddTracksToPlaylist(viewTracks.map((track) => track.id))}
                >
                  <Plus size={15} />
                  Add current view to target
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-neutral-200 hover:bg-white/10"
                  type="button"
                  onClick={refreshTracks}
                >
                  <RefreshCw size={15} />
                  Refresh view
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
      <div className="min-h-0 flex flex-1">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={handleScroll}>
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
              <tbody>{renderTrackRows(tracks)}</tbody>
            </table>
            {isLoading && (
              <div className="border-t border-line/60 px-6 py-4 text-center text-sm text-muted">
                Loading tracks...
              </div>
            )}
            {!isLoading && hasMoreTracks && tracks.length > 0 && (
              <div className="border-t border-line/60 px-6 py-4 text-center">
                <button className="secondary-button" type="button" onClick={loadMoreTracks}>
                  Load more
                </button>
              </div>
            )}
            {tracks.length === 0 && !isLoading && (
              <div className="grid h-full place-items-center px-6 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded border border-line bg-panel text-moss">
                    <FolderOpen size={24} />
                  </div>
                  <div className="text-base font-semibold text-white">No tracks in the library yet</div>
                  <div className="mt-2 text-sm text-muted">
                    Choose a music folder in Settings, then scan it to build your local catalog.
                  </div>
                  <button className="primary-button mx-auto mt-4" type="button" onClick={() => setLibraryView("health")}>
                    <ShieldCheck size={15} />
                    View library tools
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {libraryView === "albums" && (
          <div className="grid h-full min-h-0 grid-cols-[360px_minmax(0,1fr)]">
            <section className="min-h-0 overflow-auto border-r border-line">
              <div className="sticky top-0 z-10 border-b border-line bg-ink px-4 py-3 text-xs uppercase text-muted">
                {albums.length.toLocaleString()} albums
              </div>
              <div className={albumGrid ? "grid grid-cols-2 gap-3 p-3" : "grid"}>
                {albums.map((album) => {
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
                          : `grid gap-1 border-b border-line/60 px-4 py-3 text-left transition ${
                              active ? "bg-white/10" : "hover:bg-white/[0.035]"
                            }`
                      }
                      type="button"
                      onClick={() => onSelectAlbum(album.id)}
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
                      <span className="block truncate text-sm font-medium text-white">{display(album.album, "Unknown album")}</span>
                      <span className="block truncate text-xs text-muted">
                        {display(album.album_artist)} - {album.track_count} tracks - {formatDuration(album.duration_seconds)}
                      </span>
                    </button>
                  );
                })}
                {albums.length === 0 && (
                  <div className="col-span-full px-3 py-10 text-center text-sm text-muted">
                    Albums will appear here after the first library scan.
                  </div>
                )}
              </div>
            </section>
            <section className="min-h-0 min-w-0 overflow-auto">
              <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-line bg-ink px-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {activeAlbum ? display(activeAlbum.album, "Unknown album") : "Select an album"}
                  </div>
                  <div className="truncate text-xs text-muted">{activeAlbum ? display(activeAlbum.album_artist) : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="secondary-button" type="button" disabled={selectedAlbumTracks.length === 0} onClick={() => onAddTracksToPlaylist(selectedAlbumTracks.map((track) => track.id))}>
                    <Plus size={15} />
                    Add Album
                  </button>
                  <button className="secondary-button" type="button" disabled={selectedAlbumTracks.length === 0} onClick={() => onShuffleTracks(selectedAlbumTracks)}>
                    <Shuffle size={15} />
                    Shuffle
                  </button>
                  <button className="secondary-button" type="button" disabled={!activeAlbum} onClick={() => activeAlbum && void openAlbumArtworkManager(activeAlbum.id)}>
                    <Album size={15} />
                    Artwork
                  </button>
                </div>
              </div>
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
                      <div key={candidate.path ?? `${candidate.source}-${candidate.track_id}-${index}`} className="grid gap-2 rounded border border-line/70 bg-ink p-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm text-neutral-200">
                              {candidate.selected ? "Selected - " : ""}{candidate.label}
                            </div>
                            <div className="truncate text-xs text-muted">
                              {candidate.source}
                              {candidate.size_bytes ? ` - ${Math.round(candidate.size_bytes / 1024).toLocaleString()} KB` : ""}
                            </div>
                          </div>
                          {candidate.selected && <CheckCircle2 className="shrink-0 text-moss" size={16} />}
                        </div>
                        {candidate.path && <div className="truncate text-xs text-muted">{candidate.path}</div>}
                        <div className="flex flex-wrap gap-2">
                          {candidate.path && (
                            <button className="secondary-button h-8" type="button" onClick={() => void chooseSidecarArtwork(activeAlbum.id, candidate.path ?? "")}>
                              Use
                            </button>
                          )}
                          {candidate.source === "embedded" && candidate.track_id && (
                            <button className="secondary-button h-8" type="button" onClick={() => void saveEmbeddedArtwork(activeAlbum.id, candidate.track_id ?? 0)}>
                              Save Sidecar
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
        )}

        {libraryView === "playlists" && (
          <div className="grid min-h-full grid-cols-[360px_minmax(0,1fr)]">
            <section className="border-r border-line">
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
                {playlists.map((playlist) => {
                  const active = playlist.id === selectedPlaylistId;
                  return (
                    <button
                      key={playlist.id}
                      className={`grid gap-1 border-b border-line/60 px-4 py-3 text-left transition ${
                        active ? "bg-white/10" : "hover:bg-white/[0.035]"
                      }`}
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
                {playlists.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-muted">
                    Create a playlist or import M3U, PLS, XSPF, WPL, or iTunes XML.
                  </div>
                )}
              </div>
            </section>
            <section className="min-w-0">
              <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-line bg-ink px-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {activePlaylist ? activePlaylist.name : "Select a playlist"}
                  </div>
                  <div className="truncate text-xs text-muted">{selectedPlaylistTracks.length} tracks</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="secondary-button" type="button" disabled={selectedPlaylistTracks.length === 0} onClick={() => onShuffleTracks(selectedPlaylistTracks)}>
                    <Shuffle size={15} />
                    Shuffle
                  </button>
                  <button className="secondary-button" type="button" disabled={!activePlaylist || selectedPlaylistTracks.length === 0} onClick={() => activePlaylist && onExportPlaylist(activePlaylist.id)}>
                    <Download size={15} />
                    Export
                  </button>
                  <button className="secondary-button" type="button" disabled={!activePlaylist} onClick={() => activePlaylist && onDeletePlaylist(activePlaylist.id)}>
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
          <div className="grid min-h-full grid-cols-[320px_minmax(0,1fr)]">
            <section className="border-r border-line p-4">
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
                <div className="rounded border border-line bg-panel p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase text-muted">Track Note</div>
                      <div className="mt-0.5 truncate text-sm text-neutral-200">
                        {selectedInboxTrack ? display(selectedInboxTrack.title, "track") : "Select one Inbox track"}
                      </div>
                    </div>
                    <Pencil size={15} className="text-muted" />
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
            <section className="min-w-0">
              <div className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line bg-ink px-4 py-3">
                <div className="min-w-[180px]">
                  <div className="text-sm font-semibold text-white">Inbox Review</div>
                  <div className="text-xs text-muted">
                    {(inbox?.tracks.length ?? 0).toLocaleString()} visible newly scanned tracks
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button className="secondary-button" type="button" disabled={viewTracks.length === 0} onClick={() => onShuffleTracks(viewTracks)}>
                    <Shuffle size={15} />
                    Shuffle
                  </button>
                  <button className="secondary-button" type="button" disabled={viewTracks.length === 0} onClick={() => onExportTracks(viewTracks.map((track) => track.id))}>
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

        {libraryView === "smart" && (
          <div className="grid min-h-full grid-cols-[360px_minmax(0,1fr)]">
            <section className="border-r border-line">
              <div className="sticky top-0 z-10 border-b border-line bg-ink p-3">
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(smartPresets).map((preset) => (
                    <button
                      key={preset}
                      className={`secondary-button justify-center ${selectedSmartRule.preset === preset ? "border-moss text-moss" : ""}`}
                      type="button"
                      onClick={() => onPreviewSmartRule({ preset, limit: 200 })}
                    >
                      {preset.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2">
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={smartPlaylistName}
                    placeholder="Save smart playlist name"
                    onChange={(event) => setSmartPlaylistName(event.target.value)}
                  />
                  <button className="primary-button justify-center" type="button" onClick={onCreateSmartPlaylist}>
                    <Plus size={15} />
                    Save Current Rule
                  </button>
                </div>
              </div>
              <div className="grid">
                {smartPlaylists.map((playlist) => (
                  <div key={playlist.id} className="flex items-center gap-2 border-b border-line/60 px-4 py-3">
                    <button
                      className="min-w-0 flex-1 text-left"
                      type="button"
                      onClick={() => onSelectSmartPlaylist(playlist.id)}
                    >
                      <div className="truncate text-sm font-medium text-white">{playlist.name}</div>
                      <div className="truncate text-xs text-muted">{playlist.rule.preset ?? "custom rule"}</div>
                    </button>
                    <button className="icon-button h-8 w-8" type="button" title="Delete smart playlist" onClick={() => onDeleteSmartPlaylist(playlist.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <section className="min-w-0">
              <div className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line bg-ink px-4 py-3">
                <div className="min-w-[180px]">
                  <div className="text-sm font-semibold text-white">Smart Preview</div>
                  <div className="text-xs text-muted">{smartTracks.length} matching tracks</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button className="secondary-button" type="button" disabled={smartTracks.length === 0} onClick={() => onAddTracksToPlaylist(smartTracks.map((track) => track.id))}>
                    <Plus size={15} />
                    Add All
                  </button>
                  <button className="secondary-button" type="button" disabled={smartTracks.length === 0} onClick={() => onShuffleTracks(smartTracks)}>
                    <Shuffle size={15} />
                    Shuffle
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
                <tbody>{renderTrackRows(smartTracks)}</tbody>
              </table>
            </section>
          </div>
        )}

        {libraryView === "health" && (
          <div className="grid min-h-full grid-cols-[320px_minmax(0,1fr)]">
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
                  <h2 className="mb-2 text-sm font-semibold text-white">Missing Metadata</h2>
                  <div className="rounded border border-line">
                    {(libraryHealth?.missing_metadata ?? []).slice(0, 12).map((track) => (
                      <button key={track.id} className="flex w-full items-center justify-between border-b border-line/60 px-3 py-2 text-left text-sm hover:bg-white/[0.035]" type="button" onClick={() => onPlayTrack(track, [track])}>
                        <span className="truncate text-white">{display(track.title, "Untitled")}</span>
                        <span className="ml-3 truncate text-xs text-muted">{display(track.artist)} - {display(track.album)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-white">Potential Duplicates</h2>
                    <button
                      className="text-xs text-muted hover:text-white"
                      type="button"
                      onClick={() => setShowAllDuplicateGroups((current) => !current)}
                    >
                      {showAllDuplicateGroups ? "Show fewer" : `Review all ${(libraryHealth?.duplicate_groups ?? []).length}`}
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {(showAllDuplicateGroups ? libraryHealth?.duplicate_groups ?? [] : (libraryHealth?.duplicate_groups ?? []).slice(0, 8)).map((group) => {
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
                                <button
                                  key={track.id}
                                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/[0.04] ${
                                    recommended ? "bg-moss/10 text-moss" : "text-muted"
                                  }`}
                                  type="button"
                                  onClick={() => setDetailTrack(track)}
                                  onDoubleClick={() => onPlayTrack(track, group.tracks)}
                                >
                                  <span className="w-12 shrink-0 tabular-nums">{formatDuration(track.duration_seconds)}</span>
                                  <span className="w-20 shrink-0 tabular-nums">{formatBitrate(track.bitrate)}</span>
                                  <span className="min-w-0 flex-1 truncate">{track.path}</span>
                                  <span className="w-24 shrink-0 truncate text-right">{formatFingerprint(track.audio_fingerprint)}</span>
                                  {recommended && <span className="shrink-0 rounded border border-moss/40 px-2 py-0.5">keep</span>}
                                </button>
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
      <TrackDetailsPanel
        track={detailTrack}
        queue={viewTracks}
        isAudioAnalyzing={isAudioAnalyzing}
        onClose={() => setDetailTrack(null)}
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
          className="fixed z-50 w-56 overflow-visible rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
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
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
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
            <Pencil size={15} />
            {contextBulk ? "Edit Selected Metadata" : "Edit Metadata"}
          </button>
          <div className="group/rating relative">
            <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
              <span className="inline-flex items-center gap-2">
                <Star size={15} />
                Rating
              </span>
              <span className="text-muted">{">"}</span>
            </button>
            <div
              className={`invisible absolute z-50 grid w-48 grid-cols-2 gap-1 rounded border border-line bg-[rgb(var(--color-popover))] p-2 opacity-0 shadow-2xl transition group-hover/rating:visible group-hover/rating:opacity-100 ${
                contextMenu.submenuLeft ? "right-full" : "left-full"
              } ${contextMenu.flipY ? "bottom-0" : "top-0"}`}
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
          <div className="group/avoid relative">
            <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
              <span className="inline-flex items-center gap-2">
                <X size={15} />
                Avoid in AutoDJ
              </span>
              <span className="text-muted">{">"}</span>
            </button>
            <div
              className={`invisible absolute z-50 w-44 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 opacity-0 shadow-2xl transition group-hover/avoid:visible group-hover/avoid:opacity-100 ${
                contextMenu.submenuLeft ? "right-full" : "left-full"
              } ${contextMenu.flipY ? "bottom-0" : "top-0"}`}
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
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted"
            type="button"
            disabled={!targetPlaylistId}
            onClick={() => {
              onAddTracksToPlaylist(contextSelectionIds);
              setContextMenu(null);
            }}
          >
            <Plus size={15} />
            {contextBulk ? "Add Selected To Playlist" : "Add To Playlist"}
          </button>
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
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10"
            type="button"
            onClick={() => {
              onRequestDeleteTracks(contextSelectionIds, contextLabel);
              setContextMenu(null);
            }}
          >
            <Trash2 size={15} />
            Delete...
          </button>
        </div>
      )}
    </main>
  );
}
