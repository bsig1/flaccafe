import type {
AdvancedTrackSearchFilters,
AlbumSummary,
ArtistSummary,
InboxAutoReviewRule,
InboxAutoReviewRuleRequest,
InboxResponse,
LibraryHealthResponse,
LibraryStatsResponse,
PlaylistSummary,
Track,
TrackMetadataUpdate,
} from "../../../types/api";
import type { EditableMetadataKey } from "../../components/modals";
import type { LibraryColumnKey,LibrarySavedColumnLayout,LibraryView,SortState } from "../../shared";

export type LibraryPageProps = {
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
  displayRatingsAsNumbers: boolean;
  albumGrid: boolean;
  writeRatingsToFiles: boolean;
  libraryVisibleColumns: LibraryColumnKey[];
  setLibraryVisibleColumns: (columns: LibraryColumnKey[]) => void;
  librarySavedColumnLayouts: LibrarySavedColumnLayout[];
  onLibrarySavedColumnLayoutsChange: (layouts: LibrarySavedColumnLayout[]) => void;
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
};
