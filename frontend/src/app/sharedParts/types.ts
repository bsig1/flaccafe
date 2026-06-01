import type {
FontChoice,
ThemeAccent,
ThemeColorKey,
ThemeColorOverrideValue,
ThemeColorOverrides,
ThemeCheckboxAccent,
ThemeCheckboxUnchecked,
ThemeDensity,
ThemeFontScale,
MiniPlayerLayoutPreset,
MiniPlayerWindowMode,
} from "../../config/theme";
import type {
AutoDjSettings,
Track
} from "../../types/api";

export type Page = "library" | "analysis" | "nowPlaying" | "artist" | "history" | "autodj" | "audiobooks" | "podcasts" | "radio" | "scrobbling" | "cd" | "sources" | "fileManagement" | "settings";
export type LibraryView = "tracks" | "artists" | "albums" | "playlists" | "completion" | "inbox" | "smart" | "health";
export type BackendStatus = "unknown" | "starting" | "ok" | "down" | "restarting";
export type PlaybackMode = "normal" | "repeatOne" | "repeatQueue" | "stopAfterCurrent";
export type PlaybackEngine = "rust";
export type desktopOutputBackendMode = "cpalShared" | "wasapiExclusive";
export type CrossfadeProfile = "off" | "quick" | "balanced" | "smooth" | "long" | "custom";
export type SortDirection = "asc" | "desc";
export type UiDensity = ThemeDensity;
export type UiDensityPreference = "theme" | UiDensity;
export type FontScale = ThemeFontScale;
export type FontScalePreference = "theme" | FontScale;
export type CheckboxAccent = ThemeCheckboxAccent;
export type CheckboxAccentPreference = "theme" | CheckboxAccent;
export type CheckboxUnchecked = ThemeCheckboxUnchecked;
export type CheckboxUncheckedPreference = "theme" | CheckboxUnchecked;
export type ThemeColorPreferenceKey = ThemeColorKey;
export type ThemeColorPreferenceValue = ThemeColorOverrideValue;
export type ThemeColorPreferences = ThemeColorOverrides;
export type SidebarWidthPreference = "theme" | number;
export type AutoDjExperience = "simple" | "advanced";
export type ReplayGainMode = "off" | "track" | "album";
export type EqualizerBandMode = "10" | "15";
export type NowPlayingLayout = "queue" | "lyrics" | "party";
export type NowPlayingVisualizerStyle = "bars" | "wave" | "radial" | "off";
export type NowPlayingLyricSize = "small" | "medium" | "large";
export type MiniPlayerLayout = MiniPlayerLayoutPreset;
export type MiniPlayerWindowChromeMode = MiniPlayerWindowMode;
export type KeyboardShortcutAction =
  | "page.library"
  | "page.analysis"
  | "page.nowPlaying"
  | "page.artist"
  | "page.history"
  | "page.autodj"
  | "page.audiobooks"
  | "page.podcasts"
  | "page.radio"
  | "page.scrobbling"
  | "page.cd"
  | "page.sources"
  | "page.fileManagement"
  | "page.settings"
  | "app.openMiniPlayer"
  | "app.openLyrics"
  | "app.openQueue"
  | "app.openCurrentTrack"
  | "app.openCurrentArtist"
  | "app.openCurrentAlbum"
  | "app.undoRecent"
  | "playback.playPause"
  | "playback.previous"
  | "playback.next"
  | "playback.seekBackward"
  | "playback.seekForward"
  | "playback.volumeDown"
  | "playback.volumeUp"
  | "playback.mute"
  | "playback.repeatCycle"
  | "playback.repeatQueue"
  | "playback.repeatOne"
  | "playback.stopAfterCurrent";
export type HttpShortcutMethod = "GET" | "POST" | "PATCH" | "DELETE" | "HEAD";
export type SortKey =
  | "title"
  | "artist"
  | "album"
  | "album_artist"
  | "track_number"
  | "disc_number"
  | "genre"
  | "analysis_genre"
  | "analysis_genre_confidence"
  | "analysis_mood"
  | "analysis_mood_confidence"
  | "analysis_provider"
  | "analysis_updated_at"
  | "year"
  | "bitrate"
  | "replaygain_track_gain_db"
  | "replaygain_album_gain_db"
  | "replaygain_track_peak"
  | "replaygain_album_peak"
  | "rating"
  | "duration_seconds"
  | "play_count"
  | "skip_count"
  | "last_played_at"
  | "last_skipped_at"
  | "date_added"
  | "file_modified_at"
  | "audio_fingerprint"
  | "path";
export type MetadataColumnKey =
  | "title"
  | "artist"
  | "album"
  | "album_artist"
  | "track_number"
  | "disc_number"
  | "genre"
  | "analysis_genre"
  | "analysis_genre_confidence"
  | "analysis_mood"
  | "analysis_mood_confidence"
  | "analysis_provider"
  | "analysis_updated_at"
  | "year"
  | "bitrate"
  | "replaygain_track_gain_db"
  | "replaygain_album_gain_db"
  | "replaygain_track_peak"
  | "replaygain_album_peak"
  | "rating"
  | "duration_seconds"
  | "play_count"
  | "skip_count"
  | "last_played_at"
  | "last_skipped_at"
  | "date_added"
  | "file_modified_at"
  | "file_name"
  | "audio_fingerprint"
  | "path";
export type LibraryColumnKey = "play" | MetadataColumnKey;
export type HistoryColumnKey = "event" | "track" | "context" | "when";

export interface LibraryColumnDefinition {
  key: MetadataColumnKey;
  label: string;
  category: "Default" | "Metadata" | "Listening" | "Analysis" | "File";
  defaultWidth: number;
  sortKey?: SortKey;
  align?: "left" | "right";
}

export interface LibrarySavedColumnLayout {
  id: string;
  name: string;
  columns: LibraryColumnKey[];
  view?: LibraryView;
  updatedAt: string;
}

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface TrackContextMenu {
  track: Track;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  flipY: boolean;
  submenuLeft: boolean;
  queue: Track[];
  removable?: boolean;
}

export interface ColumnContextMenu {
  x: number;
  y: number;
}

export interface AppContextMenu {
  x: number;
  y: number;
}

export interface DragGhost {
  x: number;
  y: number;
  title: string;
  subtitle: string;
}

export interface PlaybackQueueContextMenu {
  x: number;
  y: number;
  index: number;
  track: Track;
}

export interface MiniPlayerTrackSnapshot {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  rating: number | null;
  duration_seconds: number | null;
}

export interface MiniPlayerSnapshot {
  track: MiniPlayerTrackSnapshot | null;
  queue: MiniPlayerTrackSnapshot[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  hasPrevious: boolean;
  hasNext: boolean;
  updatedAt: string;
}

export type MiniPlayerCommand =
  | { type: "playPause" }
  | { type: "previous" }
  | { type: "next" }
  | { type: "seek"; seconds: number }
  | { type: "playQueueIndex"; index: number };

export interface DeleteTrackPrompt {
  trackIds: number[];
  title: string;
  allowFileDelete: boolean;
}

export type RememberedDeleteChoice = "library" | "file";
export type CdSidebarMode = "never" | "drive" | "always";
export type SidebarPlacement = "left" | "right";

export interface SourceScanRule {
  enabled: boolean;
  removeMissing: boolean;
}

export type SourceScanRules = Record<string, SourceScanRule>;

export interface UiPreferences {
  hideFilePaths: boolean;
  showPodcastFilePaths: boolean;
  cdSidebarMode: CdSidebarMode;
  compactLibraryRows: boolean;
  displayRatingsAsNumbers: boolean;
  defaultQueueLength: number;
  defaultTemperature: number;
  similarityWeight: number;
  crossfadeProfile: CrossfadeProfile;
  playerFadeMs: number;
  crossfadeManualProfile: CrossfadeProfile;
  crossfadeManualMs: number;
  crossfadeNaturalProfile: CrossfadeProfile;
  crossfadeNaturalMs: number;
  crossfadeAlbumProfile: CrossfadeProfile;
  crossfadeAlbumMs: number;
  crossfadeRadioProfile: CrossfadeProfile;
  crossfadeRadioMs: number;
  skipThresholdPercent: number;
  playbackEngine: PlaybackEngine;
  desktopOutputBackend: desktopOutputBackendMode;
  desktopOutputDeviceId: string;
  desktopBufferFrames: number;
  showOutputDiagnosticsButton: boolean;
  startupPage: Page;
  albumGrid: boolean;
  showToasts: boolean;
  miniPlayer: boolean;
  miniPlayerAlwaysOnTop: boolean;
  miniPlayerWidth: number;
  miniPlayerHeight: number;
  miniPlayerLayout: MiniPlayerLayout;
  miniPlayerShowArt: boolean;
  miniPlayerShowLibraryButton: boolean;
  miniPlayerShowAlwaysOnTopButton: boolean;
  miniPlayerShowMediaControls: boolean;
  miniPlayerShowPlaybar: boolean;
  miniPlayerShowPlaytimeNumbers: boolean;
  miniPlayerShowAlbumName: boolean;
  miniPlayerWindowMode: MiniPlayerWindowChromeMode;
  miniPlayerOpacity: number;
  miniPlayerShowQueue: boolean;
  replayGainMode: ReplayGainMode;
  replayGainTargetVolumePercent: number;
  replayGainPreampDb: number;
  replayGainPreventClipping: boolean;
  equalizerEnabled: boolean;
  equalizerBandMode: EqualizerBandMode;
  equalizerPreampDb: number;
  equalizerGains: number[];
  dspLimiterEnabled: boolean;
  nowPlayingLayout: NowPlayingLayout;
  nowPlayingVisualizerStyle: NowPlayingVisualizerStyle;
  nowPlayingShowLyrics: boolean;
  nowPlayingShowQueue: boolean;
  nowPlayingLyricSize: NowPlayingLyricSize;
  nowPlayingAutoScrollLyrics: boolean;
  nowPlayingShowLyricSource: boolean;
  autoFetchLyrics: boolean;
  autoFetchLrcWhenPlainPresent: boolean;
  themeAccent: ThemeAccent;
  themeColorOverrides: ThemeColorPreferences;
  checkboxAccent: CheckboxAccentPreference;
  checkboxUnchecked: CheckboxUncheckedPreference;
  density: UiDensityPreference;
  sidebarWidthPx: SidebarWidthPreference;
  sidebarPlacement: SidebarPlacement;
  fontScale: FontScalePreference;
  fontChoice: FontChoice;
  enableArtistLookup: boolean;
  libraryVisibleColumns: LibraryColumnKey[];
  libraryColumnLayouts: Partial<Record<LibraryView, LibraryColumnKey[]>>;
  librarySavedColumnLayouts: LibrarySavedColumnLayout[];
  sourceScanRules: SourceScanRules;
  keyboardShortcuts: Record<KeyboardShortcutAction, KeyboardShortcut>;
  advancedHttpShortcuts: AdvancedHttpShortcutBinding[];
}

export interface KeyboardShortcut {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export interface AdvancedHttpShortcutBinding {
  id: string;
  label: string;
  method: HttpShortcutMethod;
  path: string;
  description: string;
  bodyJson: string;
  shortcut: KeyboardShortcut;
}

export interface AutoDjTemplate {
  id: string;
  name: string;
  settings: AutoDjSettings;
}

export type UndoAction =
  | { type: "library-remove"; label: string; tracks: Track[] }
  | { type: "playlist-remove"; label: string; playlistId: number; trackIds: number[] };
