import type {
AutoDjSettings,
RecommendationDrift
} from "../../types/api";
import type {
CrossfadeProfile,
FontScale,
HistoryColumnKey,
KeyboardShortcut,
KeyboardShortcutAction,
LibraryColumnDefinition,
LibraryColumnKey,
MetadataColumnKey
} from "./types";

export const LIBRARY_PAGE_SIZE = 150;
export const DEFAULT_FADE_MS = 500;
export const crossfadeProfileDurations: Record<Exclude<CrossfadeProfile, "custom">, number> = {
  off: 0,
  quick: 250,
  balanced: DEFAULT_FADE_MS,
  smooth: 1500,
  long: 3000,
};
export const crossfadeProfileLabels: Record<CrossfadeProfile, string> = {
  off: "Off",
  quick: "Quick",
  balanced: "Balanced",
  smooth: "Smooth",
  long: "Long Blend",
  custom: "Custom",
};
export const END_FADE_SECONDS = 1;
export const QUEUE_HISTORY_LIMIT = 12;
export const TRACK_CONTEXT_MENU_WIDTH = 256;
export const TRACK_CONTEXT_MENU_HEIGHT = 584;
export const TRACK_CONTEXT_SUBMENU_WIDTH = 224;
export const TRACK_AVOID_SUBMENU_WIDTH = 176;
export const TRACK_AVOID_SUBMENU_HEIGHT = 138;
export const APP_CONTEXT_MENU_WIDTH = 220;
export const APP_CONTEXT_MENU_HEIGHT = 332;
export const MENU_VIEWPORT_MARGIN = 12;

export const fontScaleValues: Record<FontScale, string> = {
  small: "15px",
  default: "16px",
  large: "17px",
};

export const EQ_FREQUENCIES_10 = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_FREQUENCIES_15 = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];
export const EQUALIZER_GAIN_MIN_DB = -12;
export const EQUALIZER_GAIN_MAX_DB = 12;
export const EQUALIZER_PREAMP_MIN_DB = -12;
export const EQUALIZER_PREAMP_MAX_DB = 6;
export const REPLAYGAIN_TARGET_DEFAULT_PERCENT = 50;
export const REPLAYGAIN_TARGET_MIN_PERCENT = 0;
export const REPLAYGAIN_TARGET_MAX_PERCENT = 100;
export const REPLAYGAIN_TARGET_QUIET_OFFSET_DB = -6;
export const REPLAYGAIN_TARGET_LOUD_OFFSET_DB = 8;
export const VISUALIZER_FRAME_EVENT = "flac-cafe-visualizer-frame";

export interface VisualizerFrame {
  trackId: number | null;
  isPlaying: boolean;
  isLive: boolean;
  level: number;
  frequencyBins: number[];
  waveform: number[];
  timestamp: number;
}

export const equalizerPresets: Record<string, { label: string; gains10: number[]; gains15?: number[]; preampDb?: number }> = {
  flat: {
    label: "Flat",
    gains10: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  bass: {
    label: "Bass lift",
    gains10: [5, 4, 3, 1.5, 0, 0, 0, 0, 0.5, 1],
    gains15: [5, 5, 4.5, 3.5, 2.5, 1, 0, 0, 0, 0, 0, 0.5, 1, 1, 1],
    preampDb: -3,
  },
  vocal: {
    label: "Vocal",
    gains10: [-1, -1, 0, 1, 2, 3, 2.5, 1.5, 0, -1],
    gains15: [-1, -1, -1, -0.5, 0, 1, 1.5, 2, 3, 3, 2, 1, 0, -0.5, -1],
    preampDb: -2,
  },
  sparkle: {
    label: "Sparkle",
    gains10: [-1, -1, -0.5, 0, 0, 0.5, 1.5, 3, 4, 4],
    gains15: [-1, -1, -1, -0.5, -0.5, 0, 0, 0.5, 0.5, 1, 2, 3, 4, 4, 4],
    preampDb: -3,
  },
  vShape: {
    label: "V shape",
    gains10: [4, 3.5, 2, 0, -2, -1.5, 0, 2, 3.5, 4],
    gains15: [4, 4, 3.5, 3, 1.5, 0, -1, -2, -2, -1, 0, 1.5, 3, 4, 4],
    preampDb: -4,
  },
};

export const storageKeys = {
  uiPreferences: "flac-cafe-ui-preferences",
  rustPlaybackDefaultMigration: "flac-cafe-rust-playback-default-migration",
  hideFilePaths: "flac-cafe-hide-file-paths",
  lastSession: "flac-cafe-last-session",
  deleteChoice: "flac-cafe-delete-choice",
  quickStartDismissed: "flac-cafe-quick-start-dismissed",
  startupLibrarySnapshot: "flac-cafe-startup-library-snapshot",
  autoDjTemplates: "flac-cafe-autodj-templates",
  miniPlayerSnapshot: "flac-cafe-mini-player-snapshot",
  miniPlayerAlwaysOnTop: "flac-cafe-mini-player-always-on-top",
  miniPlayerSize: "flac-cafe-mini-player-size",
  playerVolume: "flac-cafe-player-volume",
  playerMuted: "flac-cafe-player-muted",
} as const;
export const legacyStorageKeys = {
  uiPreferences: "local-autodj-ui-preferences",
  hideFilePaths: "local-autodj-hide-file-paths",
  lastSession: "local-autodj-last-session",
} as const;

export const defaultLibraryVisibleColumns: LibraryColumnKey[] = [
  "play",
  "title",
  "artist",
  "album",
  "genre",
  "rating",
  "duration_seconds",
];

export const defaultKeyboardShortcuts: Record<KeyboardShortcutAction, KeyboardShortcut> = {
  "page.library": { key: "1", ctrl: true, alt: false, shift: false },
  "page.analysis": { key: "2", ctrl: true, alt: false, shift: false },
  "page.nowPlaying": { key: "3", ctrl: true, alt: false, shift: false },
  "page.artist": { key: "4", ctrl: true, alt: false, shift: false },
  "page.audiobooks": { key: "5", ctrl: true, alt: false, shift: false },
  "page.podcasts": { key: "6", ctrl: true, alt: false, shift: false },
  "page.radio": { key: "7", ctrl: true, alt: false, shift: false },
  "page.scrobbling": { key: "8", ctrl: true, alt: false, shift: false },
  "page.cd": { key: "", ctrl: false, alt: false, shift: false },
  "page.history": { key: "9", ctrl: true, alt: false, shift: false },
  "page.autodj": { key: "0", ctrl: true, alt: false, shift: false },
  "page.sources": { key: "O", ctrl: true, alt: true, shift: false },
  "page.fileManagement": { key: "F", ctrl: true, alt: true, shift: false },
  "page.settings": { key: "S", ctrl: true, alt: true, shift: false },
  "app.openMiniPlayer": { key: "", ctrl: false, alt: false, shift: false },
  "app.openLyrics": { key: "", ctrl: false, alt: false, shift: false },
  "app.openQueue": { key: "", ctrl: false, alt: false, shift: false },
  "app.openCurrentTrack": { key: "", ctrl: false, alt: false, shift: false },
  "app.openCurrentArtist": { key: "", ctrl: false, alt: false, shift: false },
  "app.openCurrentAlbum": { key: "", ctrl: false, alt: false, shift: false },
  "app.undoRecent": { key: "z", ctrl: true, alt: false, shift: false },
  "playback.playPause": { key: "Space", ctrl: false, alt: false, shift: false },
  "playback.previous": { key: ",", ctrl: false, alt: true, shift: false },
  "playback.next": { key: ".", ctrl: false, alt: true, shift: false },
  "playback.seekBackward": { key: "ArrowLeft", ctrl: false, alt: false, shift: false },
  "playback.seekForward": { key: "ArrowRight", ctrl: false, alt: false, shift: false },
  "playback.volumeDown": { key: "ArrowDown", ctrl: false, alt: true, shift: false },
  "playback.volumeUp": { key: "ArrowUp", ctrl: false, alt: true, shift: false },
  "playback.mute": { key: "m", ctrl: false, alt: true, shift: false },
  "playback.repeatCycle": { key: "", ctrl: false, alt: false, shift: false },
  "playback.repeatQueue": { key: "", ctrl: false, alt: false, shift: false },
  "playback.repeatOne": { key: "", ctrl: false, alt: false, shift: false },
  "playback.stopAfterCurrent": { key: "", ctrl: false, alt: false, shift: false },
};

export const keyboardShortcutLabels: Record<KeyboardShortcutAction, string> = {
  "page.library": "Library page",
  "page.analysis": "Analysis page",
  "page.nowPlaying": "Now Playing page",
  "page.artist": "Artist page",
  "page.audiobooks": "Audiobooks page",
  "page.podcasts": "Podcasts page",
  "page.radio": "Web Radio page",
  "page.scrobbling": "Scrobbling page",
  "page.cd": "CD page",
  "page.history": "History page",
  "page.autodj": "AutoDJ page",
  "page.sources": "Sources page",
  "page.fileManagement": "File Management page",
  "page.settings": "Settings page",
  "app.openMiniPlayer": "Open mini player",
  "app.openLyrics": "Open lyrics view",
  "app.openQueue": "Open queue view",
  "app.openCurrentTrack": "Show current track",
  "app.openCurrentArtist": "Show current artist",
  "app.openCurrentAlbum": "Show current album",
  "app.undoRecent": "Undo recent change",
  "playback.playPause": "Play / pause",
  "playback.previous": "Previous track",
  "playback.next": "Next track",
  "playback.seekBackward": "Seek backward",
  "playback.seekForward": "Seek forward",
  "playback.volumeDown": "Volume down",
  "playback.volumeUp": "Volume up",
  "playback.mute": "Mute",
  "playback.repeatCycle": "Cycle repeat mode",
  "playback.repeatQueue": "Repeat queue",
  "playback.repeatOne": "Repeat one",
  "playback.stopAfterCurrent": "Stop after current",
};

export const keyboardShortcutGroups: Array<{ title: string; actions: KeyboardShortcutAction[] }> = [
  {
    title: "Pages",
    actions: [
      "page.library",
      "page.analysis",
      "page.nowPlaying",
      "page.artist",
      "page.audiobooks",
      "page.podcasts",
      "page.radio",
      "page.scrobbling",
      "page.cd",
      "page.history",
      "page.autodj",
      "page.sources",
      "page.fileManagement",
      "page.settings",
    ],
  },
  {
    title: "App",
    actions: [
      "app.openMiniPlayer",
      "app.openLyrics",
      "app.openQueue",
      "app.openCurrentTrack",
      "app.openCurrentArtist",
      "app.openCurrentAlbum",
      "app.undoRecent",
    ],
  },
  {
    title: "Playback",
    actions: [
      "playback.playPause",
      "playback.previous",
      "playback.next",
      "playback.seekBackward",
      "playback.seekForward",
      "playback.volumeDown",
      "playback.volumeUp",
      "playback.mute",
      "playback.repeatCycle",
      "playback.repeatQueue",
      "playback.repeatOne",
      "playback.stopAfterCurrent",
    ],
  },
];

export const libraryColumnDefinitions: LibraryColumnDefinition[] = [
  { key: "title", label: "Title", category: "Default", defaultWidth: 420, sortKey: "title" },
  { key: "artist", label: "Artist", category: "Default", defaultWidth: 220, sortKey: "artist" },
  { key: "album", label: "Album", category: "Default", defaultWidth: 240, sortKey: "album" },
  { key: "genre", label: "Genre", category: "Default", defaultWidth: 150, sortKey: "genre" },
  { key: "rating", label: "Rating", category: "Default", defaultWidth: 150, sortKey: "rating" },
  {
    key: "duration_seconds",
    label: "Time",
    category: "Default",
    defaultWidth: 90,
    sortKey: "duration_seconds",
    align: "right",
  },
  { key: "album_artist", label: "Album Artist", category: "Metadata", defaultWidth: 220, sortKey: "album_artist" },
  { key: "year", label: "Year", category: "Metadata", defaultWidth: 90, sortKey: "year", align: "right" },
  { key: "track_number", label: "Track", category: "Metadata", defaultWidth: 90, sortKey: "track_number", align: "right" },
  { key: "disc_number", label: "Disc", category: "Metadata", defaultWidth: 80, sortKey: "disc_number", align: "right" },
  { key: "bitrate", label: "Bitrate", category: "Metadata", defaultWidth: 110, sortKey: "bitrate", align: "right" },
  { key: "replaygain_track_gain_db", label: "Track Gain", category: "Metadata", defaultWidth: 110, align: "right" },
  { key: "replaygain_album_gain_db", label: "Album Gain", category: "Metadata", defaultWidth: 110, align: "right" },
  { key: "replaygain_track_peak", label: "Track Peak", category: "Metadata", defaultWidth: 110, align: "right" },
  { key: "replaygain_album_peak", label: "Album Peak", category: "Metadata", defaultWidth: 110, align: "right" },
  { key: "play_count", label: "Plays", category: "Listening", defaultWidth: 90, sortKey: "play_count", align: "right" },
  { key: "skip_count", label: "Skips", category: "Listening", defaultWidth: 90, sortKey: "skip_count", align: "right" },
  { key: "last_played_at", label: "Last Played", category: "Listening", defaultWidth: 150, sortKey: "last_played_at" },
  { key: "last_skipped_at", label: "Last Skipped", category: "Listening", defaultWidth: 150, sortKey: "last_skipped_at" },
  { key: "date_added", label: "Date Added", category: "Listening", defaultWidth: 145, sortKey: "date_added" },
  { key: "analysis_genre", label: "CLAP Genre", category: "Analysis", defaultWidth: 160, sortKey: "analysis_genre" },
  {
    key: "analysis_genre_confidence",
    label: "CLAP %",
    category: "Analysis",
    defaultWidth: 110,
    sortKey: "analysis_genre_confidence",
    align: "right",
  },
  { key: "analysis_mood", label: "CLAP Mood", category: "Analysis", defaultWidth: 150, sortKey: "analysis_mood" },
  {
    key: "analysis_mood_confidence",
    label: "Mood %",
    category: "Analysis",
    defaultWidth: 100,
    sortKey: "analysis_mood_confidence",
    align: "right",
  },
  { key: "analysis_provider", label: "Analysis", category: "Analysis", defaultWidth: 120, sortKey: "analysis_provider" },
  { key: "analysis_updated_at", label: "Analyzed", category: "Analysis", defaultWidth: 145, sortKey: "analysis_updated_at" },
  { key: "file_name", label: "File Name", category: "File", defaultWidth: 240, sortKey: "path" },
  { key: "path", label: "File Path", category: "File", defaultWidth: 420, sortKey: "path" },
  { key: "audio_fingerprint", label: "Fingerprint", category: "File", defaultWidth: 180 },
  { key: "file_modified_at", label: "Modified", category: "File", defaultWidth: 145, sortKey: "file_modified_at" },
];

export const libraryColumnKeys = libraryColumnDefinitions.map((column) => column.key);
export const libraryColumnKeySet = new Set<MetadataColumnKey>(libraryColumnKeys);
export const libraryTrackColumnKeySet = new Set<LibraryColumnKey>(["play", ...libraryColumnKeys]);
export const librarySelectionColumnWidth = 44;
export const miniPlayerChannelName = "flac-cafe-mini-player";
export const uiPreferencesChannelName = "flac-cafe-ui-preferences-channel";
export const autoDjMoodSeedOptions = [
  "energetic",
  "calm",
  "happy",
  "sad",
  "melancholic",
  "dark",
  "bright",
  "aggressive",
  "mellow",
  "romantic",
  "angry",
  "dreamy",
  "tense",
  "playful",
  "dramatic",
  "danceable",
  "acoustic",
  "same decade",
] as const;

export const defaultLibraryColumnWidths: Record<LibraryColumnKey, number> = {
  play: 64,
  title: 420,
  artist: 220,
  album: 240,
  album_artist: 220,
  track_number: 90,
  disc_number: 80,
  genre: 150,
  bitrate: 110,
  replaygain_track_gain_db: 110,
  replaygain_album_gain_db: 110,
  replaygain_track_peak: 110,
  replaygain_album_peak: 110,
  analysis_genre: 160,
  analysis_genre_confidence: 110,
  analysis_mood: 150,
  analysis_mood_confidence: 100,
  analysis_provider: 120,
  analysis_updated_at: 145,
  year: 90,
  rating: 150,
  duration_seconds: 90,
  play_count: 90,
  skip_count: 90,
  last_played_at: 150,
  last_skipped_at: 150,
  date_added: 145,
  file_modified_at: 145,
  file_name: 240,
  audio_fingerprint: 180,
  path: 420,
};

export const defaultHistoryColumnWidths: Record<HistoryColumnKey, number> = {
  event: 86,
  track: 280,
  context: 240,
  when: 170,
};

export const defaultAutoDj: AutoDjSettings = {
  queue_length: 25,
  temperature: 0.8,
  artist_cooldown: 6,
  album_cooldown: 10,
  unrated_exploration_percent: 12,
  target_unrated_percent: null,
  target_exploration_percent: null,
  max_repeat_artist_percent: null,
  minimum_rating: null,
  recently_played_cooldown_days: 14,
  seed_track_id: null,
  mood_seeds: [],
  mood_seed_weight: 1.4,
  mood_avoid_seeds: [],
  mood_avoid_weight: 1.4,
  similarity_weight: 0,
  rating_weight: 1,
  recency_weight: 1,
  skip_weight: 1,
  exploration_weight: 1,
  play_history_weight: 0.7,
  feedback_weight: 0.8,
  audio_similarity_weight: 2.2,
  mood_similarity_weight: 0.9,
  artist_similarity_weight: 1.6,
  album_similarity_weight: 0.9,
  genre_similarity_weight: 0.85,
  year_similarity_weight: 0.45,
  rating_similarity_weight: 0.25,
};

export const emptyRecommendationDrift: RecommendationDrift = {
  total_tracks: 0,
  familiar_percent: 0,
  exploration_percent: 0,
  repeat_artist_percent: 0,
  unrated_percent: 0,
  clap_percent: 0,
  average_rating: null,
  unique_artists: 0,
  unique_albums: 0,
  warnings: [],
};
