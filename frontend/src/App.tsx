import {
  Album,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Clock3,
  Coffee,
  Download,
  EyeOff,
  ExternalLink,
  FileText,
  FolderOpen,
  GripVertical,
  Info,
  Library,
  ListMusic,
  ChevronDown,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  CircleStop,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Search,
  Settings,
  Shuffle,
  SkipBack,
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
import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, MouseEvent as ReactMouseEvent, ReactNode, UIEvent as ReactUIEvent } from "react";

import {
  addTracksToPlaylist,
  albumArtworkUrl,
  audioUrl,
  backupDatabase,
  clearArtistCache,
  createSupportBundle,
  createAutoDjAvoidRule,
  createPlaylist,
  createSmartPlaylist,
  deleteAutoDjAvoidRule,
  deleteTrack,
  deletePlaylist,
  deleteSmartPlaylist,
  exportQueue,
  exportPlaylist,
  fetchBackendHealth,
  fetchBackendLog,
  fetchClapAudioAnalysis,
  fetchClapCoverage,
  fetchClapInstall,
  fetchClapStatus,
  fetchAlbumTracks,
  fetchAlbums,
  fetchArtistInfo,
  fetchArtistLocalTracks,
  fetchAutoDjAvoidRules,
  fetchHistory,
  fetchLibraryHealth,
  fetchLibraryStats,
  fetchLyrics,
  fetchPlaylists,
  fetchPlaylistTracks,
  fetchRecommendationProfiles,
  fetchSettings,
  fetchSimilarTracks,
  fetchScanProgress,
  fetchSmartPlaylistPresets,
  fetchSmartPlaylistTracks,
  fetchSmartPlaylists,
  fetchStartupDiagnostics,
  fetchTrack,
  fetchTrackPage,
  generateAutoDj,
  importPlaylist,
  markTrackPlayed,
  markTrackSkipped,
  moveTrackInPlaylist,
  cancelClapAudioAnalysis,
  pauseClapAudioAnalysis,
  previewSmartPlaylist,
  removeTrackFromPlaylist,
  restoreTrack,
  resumeClapAudioAnalysis,
  startClapAudioAnalysis,
  startClapInstall,
  startScanLibrary,
  recordRecommendationFeedback,
  saveRecommendationProfile,
  setDefaultRecommendationProfile,
  updateClapConfig,
  deleteRecommendationProfile,
  updateTrackMetadata,
  updateSettings,
  updateTrackRating,
} from "./api";
import { clearSmtcState, listenForSmtcButtons, updateSmtcState } from "./tauriMedia";
import type { SmtcButtonPayload } from "./tauriMedia";
import { limitRecentItems, placeFloatingMenu, readBooleanFlag, toggleOrderedValue, writeBooleanFlag } from "./uiInteractions";
import type {
  AlbumSummary,
  AutoDjAvoidRule,
  ArtistInfoResponse,
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AutoDjSettings,
  ClapInstallDevice,
  ClapInstallProgress,
  ClapStatusResponse,
  LibraryHealthResponse,
  LibraryStatsResponse,
  LogTailResponse,
  LyricsResponse,
  PlayEventEntry,
  PlaylistSummary,
  QueueTrack,
  RecommendationDrift,
  RecommendationProfile,
  ScanProgress,
  ScanResult,
  SettingsResponse,
  SmartPlaylistRule,
  SmartPlaylistSummary,
  SimilarTrack,
  StartupDiagnosticsResponse,
  Track,
  TrackMetadataUpdate,
} from "./types";

type Page = "library" | "analysis" | "nowPlaying" | "artist" | "history" | "autodj" | "settings";
type LibraryView = "tracks" | "albums" | "playlists" | "smart" | "health";
type BackendStatus = "unknown" | "ok" | "down" | "restarting";
type PlaybackMode = "normal" | "repeatOne" | "repeatQueue" | "stopAfterCurrent";
type SortDirection = "asc" | "desc";
type ThemeAccent = "cafe" | "mint" | "rose" | "blue";
type UiDensity = "comfortable" | "compact";
type FontScale = "small" | "default" | "large";
type PlayerLayout = "full" | "compact";
type SortKey =
  | "title"
  | "artist"
  | "album"
  | "album_artist"
  | "track_number"
  | "disc_number"
  | "genre"
  | "analysis_genre"
  | "analysis_genre_confidence"
  | "analysis_provider"
  | "analysis_updated_at"
  | "year"
  | "bitrate"
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
type MetadataColumnKey =
  | "title"
  | "artist"
  | "album"
  | "album_artist"
  | "track_number"
  | "disc_number"
  | "genre"
  | "analysis_genre"
  | "analysis_genre_confidence"
  | "analysis_provider"
  | "analysis_updated_at"
  | "year"
  | "bitrate"
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
type LibraryColumnKey = "play" | MetadataColumnKey;

interface LibraryColumnDefinition {
  key: MetadataColumnKey;
  label: string;
  category: "Default" | "Metadata" | "Listening" | "Analysis" | "File";
  defaultWidth: number;
  sortKey?: SortKey;
  align?: "left" | "right";
}

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

interface TrackContextMenu {
  track: Track;
  x: number;
  y: number;
  flipY: boolean;
  submenuLeft: boolean;
  queue: Track[];
  removable?: boolean;
}

interface ColumnContextMenu {
  x: number;
  y: number;
}

interface MiniPlayerTrackSnapshot {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  rating: number | null;
  duration_seconds: number | null;
}

interface MiniPlayerSnapshot {
  track: MiniPlayerTrackSnapshot | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  hasPrevious: boolean;
  hasNext: boolean;
  updatedAt: string;
}

type MiniPlayerCommand =
  | { type: "playPause" }
  | { type: "previous" }
  | { type: "next" }
  | { type: "seek"; seconds: number };

interface DeleteTrackPrompt {
  trackIds: number[];
  title: string;
  allowFileDelete: boolean;
}

type RememberedDeleteChoice = "library" | "file";

interface UiPreferences {
  hideFilePaths: boolean;
  compactLibraryRows: boolean;
  defaultQueueLength: number;
  defaultTemperature: number;
  similarityWeight: number;
  playerFadeMs: number;
  startupPage: Page;
  albumGrid: boolean;
  showToasts: boolean;
  miniPlayer: boolean;
  themeAccent: ThemeAccent;
  density: UiDensity;
  fontScale: FontScale;
  playerLayout: PlayerLayout;
  enableArtistLookup: boolean;
  libraryVisibleColumns: MetadataColumnKey[];
}

interface AutoDjTemplate {
  id: string;
  name: string;
  settings: AutoDjSettings;
}

type UndoAction =
  | { type: "library-remove"; label: string; tracks: Track[] }
  | { type: "playlist-remove"; label: string; playlistId: number; trackIds: number[] };

const LIBRARY_PAGE_SIZE = 150;
const DEFAULT_FADE_MS = 150;
const END_FADE_SECONDS = 1;
const QUEUE_HISTORY_LIMIT = 12;
const TRACK_CONTEXT_MENU_WIDTH = 224;
const TRACK_CONTEXT_MENU_HEIGHT = 430;
const TRACK_AVOID_SUBMENU_WIDTH = 176;
const TRACK_AVOID_SUBMENU_HEIGHT = 138;
const MENU_VIEWPORT_MARGIN = 12;

const themeAccentValues: Record<ThemeAccent, { ember: string; moss: string }> = {
  cafe: { ember: "217 154 78", moss: "143 215 189" },
  mint: { ember: "122 208 183", moss: "173 220 140" },
  rose: { ember: "226 120 120", moss: "233 181 107" },
  blue: { ember: "123 168 232", moss: "133 215 198" },
};

const fontScaleValues: Record<FontScale, string> = {
  small: "15px",
  default: "16px",
  large: "17px",
};

const codecSupportChecks = [
  { label: "MP3", mime: "audio/mpeg" },
  { label: "FLAC", mime: "audio/flac" },
  { label: "M4A / AAC", mime: "audio/mp4; codecs=\"mp4a.40.2\"" },
  { label: "Ogg Vorbis", mime: "audio/ogg; codecs=\"vorbis\"" },
  { label: "Opus", mime: "audio/ogg; codecs=\"opus\"" },
  { label: "WAV", mime: "audio/wav; codecs=\"1\"" },
  { label: "AIFF", mime: "audio/aiff" },
];
const storageKeys = {
  uiPreferences: "flac-cafe-ui-preferences",
  hideFilePaths: "flac-cafe-hide-file-paths",
  lastSession: "flac-cafe-last-session",
  deleteChoice: "flac-cafe-delete-choice",
  quickStartDismissed: "flac-cafe-quick-start-dismissed",
  autoDjTemplates: "flac-cafe-autodj-templates",
  miniPlayerSnapshot: "flac-cafe-mini-player-snapshot",
} as const;
const legacyStorageKeys = {
  uiPreferences: "local-autodj-ui-preferences",
  hideFilePaths: "local-autodj-hide-file-paths",
  lastSession: "local-autodj-last-session",
} as const;

const defaultLibraryVisibleColumns: MetadataColumnKey[] = [
  "title",
  "artist",
  "album",
  "genre",
  "rating",
  "duration_seconds",
];

const libraryColumnDefinitions: LibraryColumnDefinition[] = [
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
  { key: "analysis_provider", label: "Analysis", category: "Analysis", defaultWidth: 120, sortKey: "analysis_provider" },
  { key: "analysis_updated_at", label: "Analyzed", category: "Analysis", defaultWidth: 145, sortKey: "analysis_updated_at" },
  { key: "file_name", label: "File Name", category: "File", defaultWidth: 240, sortKey: "path" },
  { key: "path", label: "File Path", category: "File", defaultWidth: 420, sortKey: "path" },
  { key: "audio_fingerprint", label: "Fingerprint", category: "File", defaultWidth: 180 },
  { key: "file_modified_at", label: "Modified", category: "File", defaultWidth: 145, sortKey: "file_modified_at" },
];

const libraryColumnKeys = libraryColumnDefinitions.map((column) => column.key);
const libraryColumnKeySet = new Set<MetadataColumnKey>(libraryColumnKeys);
const librarySelectionColumnWidth = 44;
const miniPlayerChannelName = "flac-cafe-mini-player";

const defaultLibraryColumnWidths: Record<LibraryColumnKey, number> = {
  play: 64,
  title: 420,
  artist: 220,
  album: 240,
  album_artist: 220,
  track_number: 90,
  disc_number: 80,
  genre: 150,
  bitrate: 110,
  analysis_genre: 160,
  analysis_genre_confidence: 110,
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

const defaultAutoDj: AutoDjSettings = {
  queue_length: 25,
  temperature: 0.8,
  artist_cooldown: 6,
  album_cooldown: 10,
  unrated_exploration_percent: 12,
  recently_played_cooldown_days: 14,
  seed_track_id: null,
  similarity_weight: 0,
  rating_weight: 1,
  recency_weight: 1,
  skip_weight: 1,
  exploration_weight: 1,
  play_history_weight: 0.7,
  feedback_weight: 0.8,
  audio_similarity_weight: 2.2,
  artist_similarity_weight: 1.6,
  album_similarity_weight: 0.9,
  genre_similarity_weight: 0.85,
  year_similarity_weight: 0.45,
  rating_similarity_weight: 0.25,
};

const emptyRecommendationDrift: RecommendationDrift = {
  total_tracks: 0,
  familiar_percent: 0,
  exploration_percent: 0,
  repeat_artist_percent: 0,
  unrated_percent: 0,
  clap_percent: 0,
  average_rating: null,
  unique_artists: 0,
  unique_albums: 0,
};

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 0) {
    return "--:--";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function display(value: string | number | null | undefined, fallback = "Unknown"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

function trackGenre(track: Track | null | undefined): string | null {
  return track?.analysis_genre ?? track?.genre ?? null;
}

function miniPlayerTrackSnapshot(track: Track): MiniPlayerTrackSnapshot {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    genre: trackGenre(track),
    year: track.year,
    rating: track.rating,
    duration_seconds: track.duration_seconds,
  };
}

function emptyMiniPlayerSnapshot(): MiniPlayerSnapshot {
  return {
    track: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    hasPrevious: false,
    hasNext: false,
    updatedAt: new Date(0).toISOString(),
  };
}

function readMiniPlayerSnapshot(): MiniPlayerSnapshot {
  try {
    const raw = window.localStorage.getItem(storageKeys.miniPlayerSnapshot);
    if (!raw) {
      return emptyMiniPlayerSnapshot();
    }
    return { ...emptyMiniPlayerSnapshot(), ...JSON.parse(raw) } as MiniPlayerSnapshot;
  } catch {
    return emptyMiniPlayerSnapshot();
  }
}

function publishMiniPlayerSnapshot(channel: BroadcastChannel | null, snapshot: MiniPlayerSnapshot) {
  try {
    window.localStorage.setItem(storageKeys.miniPlayerSnapshot, JSON.stringify(snapshot));
  } catch {
    // The detached mini-player is best-effort; local storage can be disabled.
  }
  channel?.postMessage({ type: "snapshot", snapshot });
}

function sendMiniPlayerCommand(command: MiniPlayerCommand) {
  if (!("BroadcastChannel" in window)) {
    return;
  }
  const channel = new BroadcastChannel(miniPlayerChannelName);
  channel.postMessage({ type: "command", command });
  channel.close();
}

function analysisTags(track: Track | null | undefined): Array<[string, number]> {
  if (!track?.analysis_genre_tags) {
    return [];
  }
  try {
    const parsed = JSON.parse(track.analysis_genre_tags) as Record<string, unknown>;
    return Object.entries(parsed)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number")
      .sort((left, right) => right[1] - left[1]);
  } catch {
    return [];
  }
}

function analysisError(track: Track | null | undefined): string | null {
  if (!track?.analysis_genre_tags || track.analysis_provider !== "clap_failed") {
    return null;
  }
  try {
    const parsed = JSON.parse(track.analysis_genre_tags) as { error?: unknown };
    return typeof parsed.error === "string" ? parsed.error : null;
  } catch {
    return null;
  }
}

function isClapAnalyzed(track: Track | null | undefined): boolean {
  return track?.analysis_provider === "clap" && Boolean(track.analysis_updated_at);
}

function isAnalysisTerminal(status: AudioAnalysisProgress["status"] | null | undefined): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

function isClapInstallTerminal(status: ClapInstallProgress["status"] | null | undefined): boolean {
  return status === "completed" || status === "failed";
}

function reasonChips(reason: string): string[] {
  return reason
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function reasonChipClass(reason: string): string {
  const normalized = reason.toLowerCase();
  if (normalized.includes("penalty") || normalized.includes("skip")) {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  if (normalized.includes("similar") || normalized.includes("seed") || normalized.includes("audio")) {
    return "border-moss/40 bg-moss/10 text-moss";
  }
  if (normalized.includes("exploration") || normalized.includes("unrated")) {
    return "border-ember/40 bg-ember/10 text-ember";
  }
  return "border-line bg-panel text-neutral-200";
}

function breakdownEntries(track: QueueTrack): Array<[string, number]> {
  return Object.entries(track.score_breakdown ?? {})
    .filter(([key]) => key !== "total")
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Math.abs(entry[1]) > 0.001)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "unrated";
  }
  const text = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${text} star${value === 1 ? "" : "s"}`;
}

function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--";
  }
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (minutes < 1) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function formatBitrate(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) {
    return "-";
  }
  return `${Math.round(value / 1000).toLocaleString()} kbps`;
}

function formatFingerprint(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return value.length > 14 ? value.slice(0, 14) : value;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function codecSupportRows() {
  if (typeof document === "undefined") {
    return codecSupportChecks.map((codec) => ({ ...codec, support: "" }));
  }
  const audio = document.createElement("audio");
  return codecSupportChecks.map((codec) => ({ ...codec, support: audio.canPlayType(codec.mime) }));
}

function formatCodecSupport(support: string): string {
  if (support === "probably") {
    return "Likely";
  }
  if (support === "maybe") {
    return "Maybe";
  }
  return "No direct support";
}

function codecSupportClass(support: string): string {
  if (support === "probably") {
    return "border-moss/40 bg-moss/10 text-moss";
  }
  if (support === "maybe") {
    return "border-ember/40 bg-ember/10 text-ember";
  }
  return "border-red-400/40 bg-red-500/10 text-red-300";
}

function parseLyricTimestamp(line: string): number | null {
  const match = line.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?]/);
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ? Number(`0.${match[3].padEnd(3, "0").slice(0, 3)}`) : 0;
  return minutes * 60 + seconds + fraction;
}

function stripLyricTimestamp(line: string): string {
  return line.replace(/^\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?]\s*/, "");
}

function fileName(path: string | null): string {
  if (!path) {
    return "";
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function fileExtension(path: string | null): string {
  const name = fileName(path);
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function supportsFileTagWriting(path: string | null): boolean {
  return new Set([".flac", ".mp3", ".m4a", ".mp4", ".ogg", ".opus"]).has(fileExtension(path));
}

function primaryArtistName(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .split(/[;|]/)[0]
    .replace(/\s+\b(feat\.?|featuring|with)\b\s+.*$/i, "")
    .trim();
}

function normalizeLibraryColumns(value: unknown): MetadataColumnKey[] {
  if (!Array.isArray(value)) {
    return defaultLibraryVisibleColumns;
  }

  const cleaned = value.filter((column): column is MetadataColumnKey => libraryColumnKeySet.has(column as MetadataColumnKey));
  const unique = Array.from(new Set(cleaned));
  return unique.length > 0 ? unique : defaultLibraryVisibleColumns;
}

function readRememberedDeleteChoice(): RememberedDeleteChoice | null {
  try {
    const value = window.localStorage.getItem(storageKeys.deleteChoice);
    return value === "library" || value === "file" ? value : null;
  } catch {
    return null;
  }
}

function writeRememberedDeleteChoice(choice: RememberedDeleteChoice) {
  try {
    window.localStorage.setItem(storageKeys.deleteChoice, choice);
  } catch {
    // Remembering delete preference is a convenience only.
  }
}

function readQuickStartDismissed(): boolean {
  return readBooleanFlag(window.localStorage, storageKeys.quickStartDismissed, false);
}

function writeQuickStartDismissed() {
  writeBooleanFlag(window.localStorage, storageKeys.quickStartDismissed, true);
}

function readUiPreferences(): UiPreferences {
  const defaults: UiPreferences = {
    hideFilePaths: true,
    compactLibraryRows: false,
    defaultQueueLength: 25,
    defaultTemperature: 0.8,
    similarityWeight: 1.4,
    playerFadeMs: DEFAULT_FADE_MS,
    startupPage: "library",
    albumGrid: true,
    showToasts: true,
    miniPlayer: false,
    themeAccent: "cafe",
    density: "comfortable",
    fontScale: "default",
    playerLayout: "full",
    enableArtistLookup: true,
    libraryVisibleColumns: defaultLibraryVisibleColumns,
  };
  try {
    const modern = window.localStorage.getItem(storageKeys.uiPreferences) ?? window.localStorage.getItem(legacyStorageKeys.uiPreferences);
    if (modern) {
      const parsed = JSON.parse(modern) as Partial<UiPreferences>;
      const validPages: Page[] = ["library", "analysis", "nowPlaying", "artist", "history", "autodj", "settings"];
      return {
        ...defaults,
        ...parsed,
        startupPage: validPages.includes(parsed.startupPage as Page) ? (parsed.startupPage as Page) : defaults.startupPage,
        themeAccent: ["cafe", "mint", "rose", "blue"].includes(parsed.themeAccent as ThemeAccent)
          ? (parsed.themeAccent as ThemeAccent)
          : defaults.themeAccent,
        density: ["comfortable", "compact"].includes(parsed.density as UiDensity)
          ? (parsed.density as UiDensity)
          : defaults.density,
        fontScale: ["small", "default", "large"].includes(parsed.fontScale as FontScale)
          ? (parsed.fontScale as FontScale)
          : defaults.fontScale,
        playerLayout: ["full", "compact"].includes(parsed.playerLayout as PlayerLayout)
          ? (parsed.playerLayout as PlayerLayout)
          : defaults.playerLayout,
        libraryVisibleColumns: normalizeLibraryColumns(parsed.libraryVisibleColumns),
      };
    }
    return {
      ...defaults,
      hideFilePaths:
        (window.localStorage.getItem(storageKeys.hideFilePaths) ?? window.localStorage.getItem(legacyStorageKeys.hideFilePaths)) !== "false",
    };
  } catch {
    return defaults;
  }
}

function readAutoDjTemplates(): AutoDjTemplate[] {
  try {
    const raw = window.localStorage.getItem(storageKeys.autoDjTemplates);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as AutoDjTemplate[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return limitRecentItems(
      parsed.filter((template) => template?.id && template?.name && template?.settings),
      24,
    );
  } catch {
    return [];
  }
}

function writeAutoDjTemplates(templates: AutoDjTemplate[]) {
  try {
    window.localStorage.setItem(storageKeys.autoDjTemplates, JSON.stringify(limitRecentItems(templates, 24)));
  } catch {
    // Templates are a convenience; failing to persist them should not block AutoDJ.
  }
}

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function sortIndicator(sort: SortState, key?: SortKey) {
  if (!key || sort.key !== key) {
    return null;
  }
  return sort.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
}

function ResizableHeader({
  label,
  column,
  width,
  sortKey,
  sort,
  onSort,
  onResize,
  align = "left",
}: {
  label: string;
  column: LibraryColumnKey;
  width: number;
  sortKey?: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  onResize: (column: LibraryColumnKey, width: number) => void;
  align?: "left" | "right";
}) {
  function handleResizeStart(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;

    function handleMove(moveEvent: MouseEvent) {
      onResize(column, Math.max(48, startWidth + moveEvent.clientX - startX));
    }

    function handleUp() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return (
    <th className="relative border-r border-line/50 px-3 py-0 font-medium" style={{ width }}>
      {sortKey ? (
        <button
          type="button"
          className={`flex h-10 w-full items-center gap-1.5 uppercase hover:text-white ${
            align === "right" ? "justify-end" : "justify-start"
          }`}
          onClick={() => onSort(sortKey)}
        >
          {label}
          {sortIndicator(sort, sortKey)}
        </button>
      ) : (
        <div className="flex h-10 items-center uppercase">{label}</div>
      )}
      <button
        type="button"
        className="absolute right-0 top-0 grid h-full w-3 cursor-col-resize place-items-center text-line hover:text-moss"
        title={`Resize ${label} column`}
        onMouseDown={handleResizeStart}
      >
        <GripVertical size={12} />
      </button>
    </th>
  );
}

function RatingStars({
  rating,
  onChange,
}: {
  rating: number | null;
  onChange: (rating: number | null) => void;
}) {
  const currentRating = rating ?? 0;

  return (
    <div className="flex w-36 items-center gap-1" aria-label={`Rating ${formatRating(rating)}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = Math.max(0, Math.min(1, currentRating - (star - 1))) * 100;
        return (
          <div key={star} className="relative h-7 w-7 rounded transition hover:bg-white/10">
            <Star
              size={18}
              strokeWidth={1.8}
              className="absolute left-1 top-1 text-muted"
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fillPercent}%` }}
            >
              <Star
                size={18}
                strokeWidth={1.8}
                className="absolute left-1 top-1 fill-ember text-ember"
              />
            </div>
            {[0.5, 1].map((step) => {
              const nextRating = star - 1 + step;
              return (
                <button
                  key={step}
                  type="button"
                  className={`absolute top-0 h-full cursor-pointer ${
                    step === 0.5 ? "left-0 w-1/2" : "right-0 w-1/2"
                  }`}
                  title={formatRating(nextRating)}
                  aria-label={`Set rating to ${formatRating(nextRating)}`}
                  onClick={() => onChange(rating === nextRating ? null : nextRating)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function DisclosureSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details className="group rounded border border-line bg-panel" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="font-medium text-white">{title}</div>
          {description && <div className="mt-1 truncate text-xs text-muted">{description}</div>}
        </div>
        <ChevronDown className="shrink-0 text-muted transition group-open:rotate-180" size={17} />
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}

function TrackDetailsPanel({
  track,
  queue,
  isAudioAnalyzing,
  onClose,
  onPlayTrack,
  onRating,
  onAnalyzeTracks,
  onAddTracksToPlaylist,
  onDeleteTrack,
  onEditTrack,
  onRevealTrack,
}: {
  track: Track | null;
  queue: Track[];
  isAudioAnalyzing: boolean;
  onClose: () => void;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onRating: (trackId: number, rating: number | null) => void;
  onAnalyzeTracks: (trackIds: number[]) => void;
  onAddTracksToPlaylist: (trackIds: number[]) => void;
  onDeleteTrack: (trackId: number, deleteFile: boolean) => void;
  onEditTrack: (track: Track) => void;
  onRevealTrack: (track: Track) => void;
}) {
  const [artworkFailed, setArtworkFailed] = useState(false);

  useEffect(() => {
    setArtworkFailed(false);
  }, [track?.id]);

  if (!track) {
    return null;
  }

  const tags = analysisTags(track);
  const error = analysisError(track);
  const artworkSrc = !artworkFailed ? albumArtworkUrl(track.id) : null;

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-line bg-[#18130f]">
      <div className="flex h-14 items-center justify-between border-b border-line px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">Track Details</div>
          <div className="truncate text-xs text-muted">{isClapAnalyzed(track) ? "CLAP analyzed" : "Not analyzed"}</div>
        </div>
        <button className="icon-button" type="button" title="Close details" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mb-4 flex gap-3">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded border border-line bg-ink text-moss">
            {artworkSrc ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                src={artworkSrc}
                onError={() => setArtworkFailed(true)}
              />
            ) : (
              <Album size={30} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-white">{display(track.title, "Untitled")}</div>
            <div className="truncate text-sm text-neutral-300">{display(track.artist)}</div>
            <div className="truncate text-xs text-muted">{display(track.album, "Unknown album")}</div>
            <div className="mt-3 flex gap-2">
              <button className="primary-button h-8" type="button" onClick={() => onPlayTrack(track, queue.length ? queue : [track])}>
                <Play size={14} />
                Play
              </button>
              <details className="relative" data-auto-close>
                <summary className="icon-button h-8 w-8 cursor-pointer list-none [&::-webkit-details-marker]:hidden" title="More track actions">
                  <MoreHorizontal size={15} />
                </summary>
                <div className="absolute left-0 top-9 z-30 w-48 overflow-hidden rounded border border-line bg-[#211a15] py-1 text-sm shadow-2xl">
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10" type="button" onClick={() => onAddTracksToPlaylist([track.id])}>
                    <Plus size={14} />
                    Add to playlist
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted" type="button" disabled={isAudioAnalyzing} onClick={() => onAnalyzeTracks([track.id])}>
                    <BarChart3 size={14} />
                    Analyze track
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10" type="button" onClick={() => onEditTrack(track)}>
                    <Pencil size={14} />
                    Edit metadata
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10" type="button" onClick={() => onRevealTrack(track)}>
                    <FolderOpen size={14} />
                    Reveal in Explorer
                  </button>
                  <div className="my-1 border-t border-line" />
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10" type="button" onClick={() => onDeleteTrack(track.id, false)}>
                    <Trash2 size={14} />
                    Remove from library
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs uppercase text-muted">Rating</div>
          <RatingStars rating={track.rating} onChange={(rating) => onRating(track.id, rating)} />
        </div>

        <div className="grid gap-3 text-sm">
          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">Metadata</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted">Album artist</div>
                <div className="truncate text-white">{display(track.album_artist)}</div>
              </div>
              <div>
                <div className="text-muted">Year</div>
                <div className="truncate text-white">{display(track.year, "-")}</div>
              </div>
              <div>
                <div className="text-muted">Track</div>
                <div className="truncate text-white">{display(track.track_number, "-")}</div>
              </div>
              <div>
                <div className="text-muted">Disc</div>
                <div className="truncate text-white">{display(track.disc_number, "-")}</div>
              </div>
              <div>
                <div className="text-muted">Duration</div>
                <div className="truncate text-white">{formatDuration(track.duration_seconds)}</div>
              </div>
              <div>
                <div className="text-muted">File genre</div>
                <div className="truncate text-white">{display(track.genre, "-")}</div>
              </div>
            </div>
          </div>

          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">CLAP Analysis</div>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Provider</span>
                <span className="truncate text-white">{display(track.analysis_provider, "none")}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Genre</span>
                <span className="truncate text-white">{display(track.analysis_genre, "-")}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Confidence</span>
                <span className="text-white">
                  {track.analysis_genre_confidence !== null && track.analysis_genre_confidence !== undefined
                    ? formatPercent(track.analysis_genre_confidence * 100)
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Updated</span>
                <span className="truncate text-white">{formatDate(track.analysis_updated_at)}</span>
              </div>
            </div>
            {error && <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.slice(0, 10).map(([tag, score]) => (
                  <span key={tag} className="rounded border border-line bg-ink px-2 py-1 text-xs text-neutral-200">
                    {tag} {formatPercent(score * 100)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">History</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted">Plays</div>
                <div className="text-white">{track.play_count.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted">Skips</div>
                <div className="text-white">{track.skip_count.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted">Last played</div>
                <div className="truncate text-white">{formatDate(track.last_played_at)}</div>
              </div>
              <div>
                <div className="text-muted">Last skipped</div>
                <div className="truncate text-white">{formatDate(track.last_skipped_at)}</div>
              </div>
            </div>
          </div>

          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">File</div>
            <div className="break-all text-xs text-neutral-300">{track.path}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Sidebar({
  activePage,
  setActivePage,
  hasDiagnosticsIssue,
  hasAnalysisIssue,
}: {
  activePage: Page;
  setActivePage: (page: Page) => void;
  hasDiagnosticsIssue: boolean;
  hasAnalysisIssue: boolean;
}) {
  const mainItems = [
    { id: "library" as const, label: "Library", icon: Library },
    { id: "nowPlaying" as const, label: "Now Playing", icon: FileText },
    { id: "autodj" as const, label: "AutoDJ", icon: Wand2 },
  ];
  const toolItems = [
    { id: "artist" as const, label: "Artist", icon: UserRound },
    { id: "history" as const, label: "History", icon: Clock3 },
    { id: "analysis" as const, label: "Analysis", icon: BarChart3 },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-line bg-[#19130f]">
      <div className="flex h-16 items-center gap-3 border-b border-line px-5">
        <div className="grid h-9 w-9 place-items-center rounded bg-ember text-ink shadow-sm shadow-black/20">
          <Coffee size={19} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">FLAC Cafe</div>
          <div className="text-xs text-muted">Prototype</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {mainItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`flex h-10 items-center gap-3 rounded px-3 text-sm transition ${
                active ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
        <div className="mt-4 px-3 text-[11px] font-medium uppercase tracking-wide text-muted/70">Tools</div>
        {toolItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`flex h-9 items-center gap-3 rounded px-3 text-sm transition ${
                active ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={17} />
              <span className="min-w-0 flex-1 text-left">{item.label}</span>
              {item.id === "analysis" && hasAnalysisIssue && (
                <span className="h-2 w-2 rounded-full bg-ember" title="Audio analysis needs attention" />
              )}
              {item.id === "settings" && hasDiagnosticsIssue && (
                <span className="h-2 w-2 rounded-full bg-ember" title="Startup self-check found issues" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function QuickStartPanel({
  onOpenSettings,
  onOpenAnalysis,
  onDismiss,
}: {
  onOpenSettings: () => void;
  onOpenAnalysis: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="border-b border-line bg-[#17110e] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-5 rounded border border-ember/25 bg-panel/80 p-4 shadow-sm shadow-black/20">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Library size={16} />
            Start your FLAC Cafe library
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Pick a local music folder in Settings, scan it into SQLite, then optionally install CLAP analysis later
            for genre hints and stronger AutoDJ similarity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="primary-button" type="button" onClick={onOpenSettings}>
            <Settings size={16} />
            Settings
          </button>
          <button className="secondary-button" type="button" onClick={onOpenAnalysis}>
            <BarChart3 size={16} />
            Analysis
          </button>
          <button className="icon-button" type="button" title="Dismiss quick start" onClick={onDismiss}>
            <X size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function LibraryPage({
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
  onDeleteTracks,
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
  onDismissQuickStart,
  onOpenSettings,
  onOpenAnalysis,
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
  onDeleteTracks: (trackIds: number[], deleteFile: boolean) => void | Promise<void>;
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
  onDismissQuickStart: () => void;
  onOpenSettings: () => void;
  onOpenAnalysis: () => void;
}) {
  const [columnWidths, setColumnWidths] = useState(defaultLibraryColumnWidths);
  const [contextMenu, setContextMenu] = useState<TrackContextMenu | null>(null);
  const [columnMenu, setColumnMenu] = useState<ColumnContextMenu | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(() => new Set());
  const [showAllDuplicateGroups, setShowAllDuplicateGroups] = useState(false);
  const [bulkMetadataOpen, setBulkMetadataOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const visibleColumns = normalizeLibraryColumns(libraryVisibleColumns);
  const visibleColumnDefs = libraryColumnDefinitions.filter((column) => visibleColumns.includes(column.key));
  const tableWidth = librarySelectionColumnWidth + columnWidths.play + visibleColumnDefs.reduce((total, column) => total + columnWidths[column.key], 0);
  const rowPadding = compactRows ? "px-3 py-2" : "px-3 py-3";
  const activeAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null;
  const activePlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null;
  const viewTracks =
    libraryView === "albums"
      ? selectedAlbumTracks
      : libraryView === "playlists"
        ? selectedPlaylistTracks
        : libraryView === "smart"
          ? smartTracks
          : tracks;
  const selectedTracks = viewTracks.filter((track) => selectedTrackIds.has(track.id));
  const selectedIds = selectedTracks.map((track) => track.id);
  const allViewSelected = viewTracks.length > 0 && viewTracks.every((track) => selectedTrackIds.has(track.id));

  useEffect(() => {
    const visibleIds = new Set(viewTracks.map((track) => track.id));
    setSelectedTrackIds((current) => {
      const next = new Set(Array.from(current).filter((trackId) => visibleIds.has(trackId)));
      return next.size === current.size ? current : next;
    });
  }, [libraryView, viewTracks]);

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
    function handleDeleteKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "Delete" ||
        target?.closest("input, textarea, select, [contenteditable='true']") ||
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

    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [selectedIds, selectedTracks, detailTrack, onRequestDeleteTracks]);

  function handleSort(key: SortKey) {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }

  function handleResize(column: LibraryColumnKey, width: number) {
    setColumnWidths((current) => ({ ...current, [column]: width }));
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

  function setSelectionForList(list: Track[], selected: boolean) {
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
    setLibraryVisibleColumns(toggleOrderedValue(visibleColumns, column, libraryColumnDefinitions.map((definition) => definition.key)));
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
          />
        ))}
      </tr>
    );
  }

  function renderTrackRows(list: Track[], options: { removable?: boolean } = {}) {
    return list.map((track) => (
      <tr
        key={track.id}
        className={`cursor-pointer border-b border-line/60 hover:bg-white/[0.035] ${
          detailTrack?.id === track.id ? "bg-white/[0.06]" : selectedTrackIds.has(track.id) ? "bg-white/[0.035]" : ""
        }`}
        onClick={() => setDetailTrack(track)}
        onContextMenu={(event) => openTrackContextMenu(event, track, list, Boolean(options.removable))}
      >
        <td className={rowPadding}>
          <input
            aria-label={`Select ${display(track.title, "track")}`}
            type="checkbox"
            className="h-4 w-4 accent-moss"
            checked={selectedTrackIds.has(track.id)}
            onChange={() => toggleTrackSelection(track.id)}
            onClick={(event) => event.stopPropagation()}
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

  const primaryLibraryViews = [
    { id: "tracks" as const, label: "Tracks", icon: ListMusic },
    { id: "albums" as const, label: "Albums", icon: Album },
    { id: "playlists" as const, label: "Playlists", icon: ListMusic },
  ];
  const utilityLibraryViews = [
    { id: "smart" as const, label: "Smart Playlists", icon: Wand2 },
    { id: "health" as const, label: "Library Health", icon: ShieldCheck },
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Library</h1>
          <p className="text-xs text-muted">
            {tracks.length.toLocaleString()} of {totalTracks.toLocaleString()} tracks loaded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-80 rounded border border-line bg-panel pl-9 pr-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              placeholder="Search tracks, artists, albums"
            />
          </label>
          <button className="icon-button" title="Refresh" type="button" onClick={refreshTracks}>
            <RefreshCw size={17} />
          </button>
        </div>
      </header>
      <div className="flex items-center justify-between gap-4 border-b border-line bg-[#18130f] px-6 py-3">
        <div className="flex items-center gap-1 rounded border border-line bg-panel p-1">
          {primaryLibraryViews.map((item) => {
            const Icon = item.icon;
            const active = libraryView === item.id;
            return (
              <button
                key={item.id}
                className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm transition ${
                  active ? "bg-white/10 text-white" : "text-muted hover:text-white"
                }`}
                type="button"
                onClick={() => setLibraryView(item.id)}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
          <details className="relative" data-auto-close>
            <summary
              className={`inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded px-3 text-sm transition [&::-webkit-details-marker]:hidden ${
                libraryView === "smart" || libraryView === "health"
                  ? "bg-white/10 text-white"
                  : "text-muted hover:text-white"
              }`}
              title="Library tools"
            >
              <MoreHorizontal size={15} />
              Tools
            </summary>
            <div className="absolute left-0 top-10 z-40 w-52 overflow-hidden rounded border border-line bg-[#211a15] py-1 text-sm shadow-2xl">
              {utilityLibraryViews.map((item) => {
                const Icon = item.icon;
                const active = libraryView === item.id;
                return (
                  <button
                    key={item.id}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 ${
                      active ? "text-white" : "text-muted"
                    }`}
                    type="button"
                    onClick={(event) => {
                      setLibraryView(item.id);
                      event.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </details>
        </div>

        <div className="flex min-w-0 items-center gap-2">
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
            <div className="absolute right-0 top-11 z-40 w-72 rounded border border-line bg-[#211a15] p-3 text-sm shadow-2xl">
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
      {showQuickStart && (
        <QuickStartPanel
          onOpenSettings={onOpenSettings}
          onOpenAnalysis={onOpenAnalysis}
          onDismiss={onDismissQuickStart}
        />
      )}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#15100d] px-6 py-2 text-sm">
          <div className="text-muted">
            <span className="font-medium text-white">{selectedIds.length.toLocaleString()}</span> selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="secondary-button h-8" type="button" onClick={() => setSelectionForList(viewTracks, true)}>
              Select View
            </button>
            <button className="secondary-button h-8" type="button" onClick={clearSelection}>
              Clear
            </button>
            <div className="mx-1 h-6 w-px bg-line" />
            <RatingStars rating={null} onChange={(rating) => void onBulkRating(selectedIds, rating)} />
            <button
              className="secondary-button h-8"
              type="button"
              disabled={!targetPlaylistId}
              onClick={() => void onAddTracksToPlaylist(selectedIds)}
            >
              <Plus size={14} />
              Add
            </button>
            <button
              className="secondary-button h-8"
              type="button"
              onClick={() => {
                void onExportTracks(selectedIds);
                clearSelection();
              }}
            >
              <Download size={14} />
              Export
            </button>
            {libraryView === "playlists" && activePlaylist && (
              <button
                className="secondary-button h-8"
                type="button"
                onClick={() => {
                  void onRemoveTracksFromPlaylist(selectedIds);
                  clearSelection();
                }}
              >
                <Trash2 size={14} />
                Remove
              </button>
            )}
            <button
              className="secondary-button h-8"
              type="button"
              onClick={() => setBulkMetadataOpen(true)}
            >
              <Pencil size={14} />
              Metadata
            </button>
            <button
              className="secondary-button h-8"
              type="button"
              disabled={isAudioAnalyzing}
              onClick={() => {
                onAnalyzeTracks(selectedIds);
                clearSelection();
              }}
            >
              <BarChart3 size={14} />
              Analyze
            </button>
            <button
              className="secondary-button h-8 text-ember"
              type="button"
              onClick={() => {
                onRequestDeleteTracks(
                  selectedIds,
                  selectedIds.length === 1
                    ? display(selectedTracks[0]?.title, "Selected track")
                    : `${selectedIds.length.toLocaleString()} selected tracks`,
                );
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}
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
          <div className="grid min-h-full grid-cols-[360px_minmax(0,1fr)]">
            <section className="border-r border-line">
              <div className="sticky top-0 z-10 border-b border-line bg-ink px-4 py-3 text-xs uppercase text-muted">
                {albums.length.toLocaleString()} albums
              </div>
              <div className={albumGrid ? "grid grid-cols-2 gap-3 p-3" : "grid"}>
                {albums.map((album) => {
                  const active = album.id === selectedAlbumId;
                  const artwork = album.artwork_track_id ? albumArtworkUrl(album.artwork_track_id) : null;
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
            <section className="min-w-0">
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
                <thead className="border-b border-line bg-[#18130f] text-xs uppercase text-muted">
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
                    placeholder="Import .m3u path"
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
                    Create a playlist or import an .m3u to start grouping tracks.
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
                <thead className="border-b border-line bg-[#18130f] text-xs uppercase text-muted">
                  {renderTableHeader(false)}
                </thead>
                <tbody>{renderTrackRows(selectedPlaylistTracks, { removable: true })}</tbody>
              </table>
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
              <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-line bg-ink px-4">
                <div>
                  <div className="text-sm font-semibold text-white">Smart Preview</div>
                  <div className="text-xs text-muted">{smartTracks.length} matching tracks</div>
                </div>
                <div className="flex items-center gap-2">
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
                <thead className="border-b border-line bg-[#18130f] text-xs uppercase text-muted">
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
          className="fixed z-50 max-h-[70vh] w-80 overflow-auto rounded border border-line bg-[#211a15] p-3 text-sm text-neutral-100 shadow-2xl"
          style={{ left: columnMenu.x, top: columnMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white">Visible Columns</div>
              <div className="text-xs text-muted">Right-click the table header to edit this list.</div>
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
          className="fixed z-50 w-56 overflow-visible rounded border border-line bg-[#211a15] py-1 text-sm text-neutral-100 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
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
              setDetailTrack(contextMenu.track);
              setContextMenu(null);
            }}
          >
            <Info size={15} />
            Details
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
            type="button"
            onClick={() => {
              onEditTrack(contextMenu.track);
              setContextMenu(null);
            }}
          >
            <Pencil size={15} />
            Edit Metadata
          </button>
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
              className={`invisible absolute z-50 w-44 overflow-hidden rounded border border-line bg-[#211a15] py-1 opacity-0 shadow-2xl transition group-hover/avoid:visible group-hover/avoid:opacity-100 ${
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
              onAddTracksToPlaylist([contextMenu.track.id]);
              setContextMenu(null);
            }}
          >
            <Plus size={15} />
            Add To Playlist
          </button>
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
              onAnalyzeTracks([contextMenu.track.id]);
              setContextMenu(null);
            }}
          >
            <BarChart3 size={15} />
            Analyze Track
          </button>
          <div className="my-1 border-t border-line" />
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10"
            type="button"
            onClick={() => {
              onRequestDeleteTracks([contextMenu.track.id], display(contextMenu.track.title, "Selected track"));
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

function MetadataEditorModal({
  track,
  writeToFiles,
  onClose,
  onSave,
}: {
  track: Track;
  writeToFiles: boolean;
  onClose: () => void;
  onSave: (trackId: number, metadata: TrackMetadataUpdate) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    title: track.title ?? "",
    artist: track.artist ?? "",
    album: track.album ?? "",
    album_artist: track.album_artist ?? "",
    track_number: track.track_number?.toString() ?? "",
    disc_number: track.disc_number?.toString() ?? "",
    genre: track.genre ?? "",
    year: track.year?.toString() ?? "",
  });

  function textValue(value: string): string | null {
    const cleaned = value.trim();
    return cleaned || null;
  }

  function numberValue(value: string): number | null {
    const cleaned = value.trim();
    return cleaned ? Number(cleaned) : null;
  }

  const previewValues = {
    title: textValue(form.title),
    artist: textValue(form.artist),
    album: textValue(form.album),
    album_artist: textValue(form.album_artist),
    track_number: numberValue(form.track_number),
    disc_number: numberValue(form.disc_number),
    genre: textValue(form.genre),
    year: numberValue(form.year),
  };
  const metadataChanges = (
    [
      ["Title", track.title, previewValues.title],
      ["Artist", track.artist, previewValues.artist],
      ["Album", track.album, previewValues.album],
      ["Album Artist", track.album_artist, previewValues.album_artist],
      ["Genre", track.genre, previewValues.genre],
      ["Year", track.year, previewValues.year],
      ["Track", track.track_number, previewValues.track_number],
      ["Disc", track.disc_number, previewValues.disc_number],
    ] as const
  ).filter(([, before, after]) => (before ?? null) !== (after ?? null));
  const tagWritable = supportsFileTagWriting(track.path);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    await onSave(track.id, previewValues);
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded border border-line bg-[#211a15] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">Edit Metadata</div>
            <div className="mt-1 truncate text-xs text-muted">{fileName(track.path)}</div>
          </div>
          <button className="icon-button" type="button" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["title", "Title"],
                ["artist", "Artist"],
                ["album", "Album"],
                ["album_artist", "Album Artist"],
                ["genre", "Genre"],
                ["year", "Year"],
                ["track_number", "Track Number"],
                ["disc_number", "Disc Number"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="grid gap-2 text-sm text-neutral-200">
                <span className="text-xs uppercase text-muted">{label}</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                  inputMode={field === "year" || field === "track_number" || field === "disc_number" ? "numeric" : undefined}
                  value={form[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className={`rounded border px-3 py-2 text-xs ${writeToFiles ? "border-ember/40 bg-ember/10 text-ember" : "border-line bg-ink text-muted"}`}>
            {writeToFiles && tagWritable
              ? "File tag writing is enabled. Saving will update SQLite and supported audio file tags."
              : writeToFiles
                ? `${fileExtension(track.path).toUpperCase() || "This format"} may not support safe tag writing yet. Saving will try the file write and stop if mutagen rejects it.`
                : "File tag writing is off. Saving will update SQLite only."}
          </div>

          <div className="rounded border border-line/70 bg-ink p-3 text-xs">
            <div className="mb-2 font-medium text-neutral-200">Changes to save</div>
            {metadataChanges.length === 0 ? (
              <div className="text-muted">No changes yet.</div>
            ) : (
              <div className="grid gap-2">
                {metadataChanges.map(([label, before, after]) => (
                  <div key={label} className="grid grid-cols-[90px_1fr] gap-2">
                    <div className="text-muted">{label}</div>
                    <div className="min-w-0 truncate text-neutral-200">
                      <span className="text-muted">{display(before, "Empty")}</span>
                      <span className="px-2 text-ember">to</span>
                      <span>{display(after, "Empty")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={() => void submit()}>
            <Pencil size={15} />
            Save Metadata
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkMetadataModal({
  tracks,
  writeToFiles,
  onClose,
  onSave,
}: {
  tracks: Track[];
  writeToFiles: boolean;
  onClose: () => void;
  onSave: (metadata: TrackMetadataUpdate) => void | Promise<void>;
}) {
  const [enabledFields, setEnabledFields] = useState<Record<keyof TrackMetadataUpdate, boolean>>({
    title: false,
    artist: false,
    album: false,
    album_artist: false,
    track_number: false,
    disc_number: false,
    genre: false,
    year: false,
  });
  const [values, setValues] = useState<Record<keyof TrackMetadataUpdate, string>>({
    title: "",
    artist: "",
    album: "",
    album_artist: "",
    track_number: "",
    disc_number: "",
    genre: "",
    year: "",
  });

  const fields: Array<[keyof TrackMetadataUpdate, string, "text" | "number"]> = [
    ["artist", "Artist", "text"],
    ["album", "Album", "text"],
    ["album_artist", "Album Artist", "text"],
    ["genre", "Genre", "text"],
    ["year", "Year", "number"],
    ["disc_number", "Disc", "number"],
  ];
  const enabledCount = Object.values(enabledFields).filter(Boolean).length;
  const unsupported = tracks.filter((track) => !supportsFileTagWriting(track.path));

  function submit() {
    const metadata: TrackMetadataUpdate = {};
    for (const [key] of fields) {
      if (!enabledFields[key]) {
        continue;
      }
      const raw = values[key].trim();
      switch (key) {
        case "year":
        case "disc_number":
        case "track_number":
          metadata[key] = raw ? Number(raw) : null;
          break;
        default:
          metadata[key] = raw || null;
      }
    }
    void onSave(metadata);
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded border border-line bg-[#211a15] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">Bulk Metadata Preview</div>
            <div className="mt-1 text-sm text-muted">{tracks.length.toLocaleString()} selected tracks</div>
          </div>
          <button className="icon-button" type="button" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-5">
          <div className="grid gap-3">
            {fields.map(([key, label, type]) => (
              <div key={key} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 rounded border border-line/70 bg-ink p-3 text-sm">
                <label className="flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={enabledFields[key]}
                    onChange={(event) => setEnabledFields((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  {label}
                </label>
                <input
                  type={type}
                  disabled={!enabledFields[key]}
                  className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 disabled:opacity-40 focus:ring-2"
                  value={values[key]}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded border border-line/70 bg-ink p-3">
            <div className="mb-2 text-xs font-medium uppercase text-muted">Preview</div>
            <div className="grid gap-1 text-xs">
              {tracks.slice(0, 8).map((track) => (
                <div key={track.id} className="grid grid-cols-[1fr_1fr] gap-3 rounded bg-panel px-2 py-1.5">
                  <div className="truncate text-muted">{display(track.title, "Untitled")} - {display(track.artist)}</div>
                  <div className="truncate text-neutral-200">
                    {fields
                      .filter(([key]) => enabledFields[key])
                      .map(([key, label]) => `${label}: ${values[key].trim() || "(blank)"}`)
                      .join(" / ") || "No fields selected"}
                  </div>
                </div>
              ))}
              {tracks.length > 8 && <div className="text-muted">...and {(tracks.length - 8).toLocaleString()} more tracks</div>}
            </div>
          </div>
          {writeToFiles && unsupported.length > 0 && (
            <div className="mt-3 rounded border border-ember/40 bg-ember/10 p-3 text-xs text-ember">
              {unsupported.length} selected file{unsupported.length === 1 ? "" : "s"} may not support direct metadata writes. SQLite updates will still be attempted track by track.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" disabled={enabledCount === 0} onClick={submit}>
            <Pencil size={15} />
            Apply Previewed Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteTrackDialog({
  prompt,
  onCancel,
  onConfirm,
}: {
  prompt: DeleteTrackPrompt;
  onCancel: () => void;
  onConfirm: (deleteFile: boolean, remember: boolean) => void | Promise<void>;
}) {
  const [rememberChoice, setRememberChoice] = useState(false);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded border border-line bg-[#211a15] shadow-2xl">
        <div className="border-b border-line px-5 py-4">
          <div className="text-base font-semibold text-white">Delete Track</div>
          <div className="mt-1 text-sm text-muted">{prompt.title}</div>
        </div>
        <div className="grid gap-3 p-5 text-sm text-neutral-200">
          <button className="secondary-button justify-start" type="button" onClick={() => void onConfirm(false, rememberChoice)}>
            <Trash2 size={15} />
            Remove from library only
          </button>
          <button
            className="secondary-button justify-start text-red-300"
            type="button"
            disabled={!prompt.allowFileDelete}
            onClick={() => void onConfirm(true, rememberChoice)}
          >
            <Trash2 size={15} />
            Remove from library and delete file
          </button>
          <label className="mt-1 flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
            <span>Remember this choice</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-moss"
              checked={rememberChoice}
              onChange={(event) => setRememberChoice(event.target.checked)}
            />
          </label>
          <div className="text-xs text-muted">Deleting the file cannot be undone.</div>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-neutral-200">
      <span className="text-xs uppercase text-muted">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
      />
    </label>
  );
}

function AutoDjPage({
  queue,
  setQueue,
  setRecommendationDrift,
  setStatus,
  onPlayTrack,
  onAddTracksToPlaylist,
  currentTrackId,
  currentTrack,
  uiPreferences,
  avoidRules,
  onDeleteAvoidRule,
  recommendationProfiles,
  recommendationDrift,
  onRefreshProfiles,
  onSaveRecommendationProfile,
  onDeleteRecommendationProfile,
  onSetDefaultRecommendationProfile,
}: {
  queue: QueueTrack[];
  setQueue: (tracks: QueueTrack[]) => void;
  setRecommendationDrift: (drift: RecommendationDrift) => void;
  setStatus: (message: string) => void;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onAddTracksToPlaylist: (trackIds: number[]) => void;
  currentTrackId: number | null;
  currentTrack: Track | null;
  uiPreferences: UiPreferences;
  avoidRules: AutoDjAvoidRule[];
  onDeleteAvoidRule: (ruleId: number) => void;
  recommendationProfiles: RecommendationProfile[];
  recommendationDrift: RecommendationDrift;
  onRefreshProfiles: () => void | Promise<void>;
  onSaveRecommendationProfile: (name: string, settings: AutoDjSettings, isDefault: boolean) => void | Promise<void>;
  onDeleteRecommendationProfile: (profileId: number) => void | Promise<void>;
  onSetDefaultRecommendationProfile: (profileId: number) => void | Promise<void>;
}) {
  const [settings, setSettings] = useState<AutoDjSettings>({
    ...defaultAutoDj,
    queue_length: uiPreferences.defaultQueueLength,
    temperature: uiPreferences.defaultTemperature,
    similarity_weight: uiPreferences.similarityWeight,
  });
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<AutoDjTemplate[]>(readAutoDjTemplates);
  const [explainTrackKey, setExplainTrackKey] = useState<string | null>(null);
  const [selectedQueueKeys, setSelectedQueueKeys] = useState<Set<string>>(() => new Set());
  const [dragQueueIndex, setDragQueueIndex] = useState<number | null>(null);
  const [similarPreview, setSimilarPreview] = useState<SimilarTrack[]>([]);
  const [isSimilarityLoading, setIsSimilarityLoading] = useState(false);
  const [neighborAnalyzedOnly, setNeighborAnalyzedOnly] = useState(false);
  const [neighborMinRating, setNeighborMinRating] = useState(0);
  const [neighborGenre, setNeighborGenre] = useState("");
  const appliedDefaultProfileId = useRef<number | null>(null);
  const defaultProfile = recommendationProfiles.find((profile) => profile.is_default) ?? null;
  const presets: { label: string; settings: Partial<AutoDjSettings> }[] = [
    { label: "Favorites", settings: { temperature: 0.45, unrated_exploration_percent: 3, recently_played_cooldown_days: 21 } },
    { label: "Discovery", settings: { temperature: 1.25, unrated_exploration_percent: 35, recently_played_cooldown_days: 7 } },
    { label: "Deep Cuts", settings: { temperature: 1.05, unrated_exploration_percent: 18, recently_played_cooldown_days: 45 } },
    { label: "Similar", settings: { seed_track_id: currentTrack?.id ?? null, similarity_weight: uiPreferences.similarityWeight, temperature: 0.7 } },
  ];
  const queueDuration = queue.reduce((total, track) => total + (track.duration_seconds ?? 0), 0);
  const queueArtists = new Set(queue.map((track) => display(track.artist)).filter(Boolean)).size;
  const clapTracks = queue.filter((track) => isClapAnalyzed(track)).length;
  const queueKeys = queue.map((track, index) => `${track.id}-${index}`);
  const allQueueSelected = queue.length > 0 && queueKeys.every((key) => selectedQueueKeys.has(key));
  const filteredSimilarPreview = similarPreview.filter((track) => {
    if (neighborAnalyzedOnly && !isClapAnalyzed(track)) {
      return false;
    }
    if (neighborMinRating > 0 && (track.rating ?? 0) < neighborMinRating) {
      return false;
    }
    if (neighborGenre.trim() && !display(trackGenre(track), "").toLowerCase().includes(neighborGenre.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!defaultProfile || appliedDefaultProfileId.current === defaultProfile.id) {
      return;
    }
    appliedDefaultProfileId.current = defaultProfile.id;
    setSettings({ ...defaultAutoDj, ...defaultProfile.settings });
  }, [defaultProfile?.id]);

  useEffect(() => {
    const seedTrackId = settings.seed_track_id ?? null;
    if (!seedTrackId) {
      setSimilarPreview([]);
      return;
    }
    let canceled = false;
    setIsSimilarityLoading(true);
    fetchSimilarTracks(seedTrackId, 10)
      .then((tracks) => {
        if (!canceled) {
          setSimilarPreview(tracks);
        }
      })
      .catch((error) => {
        if (!canceled) {
          setSimilarPreview([]);
          setStatus(error instanceof Error ? error.message : "Could not load similar tracks");
        }
      })
      .finally(() => {
        if (!canceled) {
          setIsSimilarityLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [settings.seed_track_id, setStatus]);

  function toggleQueueSelection(key: string) {
    setSelectedQueueKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function setQueueSelection(selected: boolean) {
    setSelectedQueueKeys(selected ? new Set(queueKeys) : new Set());
  }

  function removeSelectedQueueItems() {
    if (selectedQueueKeys.size === 0) {
      return;
    }
    setQueue(queue.filter((track, index) => !selectedQueueKeys.has(`${track.id}-${index}`)));
    setSelectedQueueKeys(new Set());
    setExplainTrackKey(null);
  }

  function moveQueueItem(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= queue.length) {
      return;
    }
    const next = [...queue];
    [next[index], next[target]] = [next[target], next[index]];
    setQueue(next);
    setSelectedQueueKeys(new Set());
  }

  function reorderQueueItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length) {
      return;
    }
    const next = [...queue];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setQueue(next);
    setSelectedQueueKeys(new Set());
    setExplainTrackKey(null);
  }

  function saveCurrentTemplate() {
    const name = window.prompt("Template name", "AutoDJ Template");
    if (!name?.trim()) {
      return;
    }
    const template: AutoDjTemplate = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
      name: name.trim(),
      settings,
    };
    const next = [template, ...templates.filter((item) => item.name.toLowerCase() !== template.name.toLowerCase())].slice(0, 24);
    setTemplates(next);
    writeAutoDjTemplates(next);
    setStatus(`Saved AutoDJ template ${template.name}`);
  }

  function deleteTemplate(templateId: string) {
    const next = templates.filter((template) => template.id !== templateId);
    setTemplates(next);
    writeAutoDjTemplates(next);
  }

  function saveCurrentProfile(isDefault = false) {
    const name = window.prompt("Recommendation profile name", defaultProfile?.name ?? "Cafe Profile");
    if (!name?.trim()) {
      return;
    }
    void onSaveRecommendationProfile(name.trim(), settings, isDefault);
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const response = await generateAutoDj(settings);
      setQueue(response.tracks);
      setRecommendationDrift(response.drift);
      setStatus(`Generated ${response.tracks.length} tracks`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Queue generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (queue.length === 0) {
      setStatus("Generate a queue first");
      return;
    }
    try {
      const response = await exportQueue(queue.map((track) => track.id));
      setStatus(`Exported ${response.track_count} tracks to ${response.playlist_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">AutoDJ</h1>
          <p className="text-xs text-muted">{queue.length} tracks in queue</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="primary-button" type="button" onClick={handleGenerate} disabled={busy}>
            <Wand2 size={17} />
            {busy ? "Generating" : "Generate Queue"}
          </button>
          <button className="secondary-button" type="button" onClick={handleExport}>
            <Download size={17} />
            Export .m3u
          </button>
          <button className="secondary-button" type="button" disabled={queue.length === 0} onClick={() => onAddTracksToPlaylist(queue.map((track) => track.id))}>
            <Plus size={17} />
            Add Queue
          </button>
          <button className="secondary-button" type="button" disabled={queue.length === 0} onClick={() => setQueue([])}>
            <X size={17} />
            Clear
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)]">
        <section className="min-h-0 overflow-auto border-r border-line p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <SlidersHorizontal size={17} />
            Settings
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                className="secondary-button justify-center"
                type="button"
                onClick={() => setSettings({ ...settings, ...preset.settings })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mb-4 rounded border border-line/70 bg-ink p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-medium uppercase text-muted">Saved Templates</div>
              <button className="text-xs text-moss hover:text-white" type="button" onClick={saveCurrentTemplate}>
                Save
              </button>
            </div>
            <div className="grid max-h-40 gap-1 overflow-auto">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between gap-2 rounded bg-panel px-2 py-1.5 text-xs">
                  <button
                    className="min-w-0 flex-1 truncate text-left text-neutral-200 hover:text-white"
                    type="button"
                    onClick={() => setSettings({ ...settings, ...template.settings })}
                    title={template.name}
                  >
                    {template.name}
                  </button>
                  <button className="text-muted hover:text-white" type="button" title="Delete template" onClick={() => deleteTemplate(template.id)}>
                    <X size={13} />
                  </button>
                </div>
              ))}
              {templates.length === 0 && <div className="text-xs text-muted">Save tuned settings here for later queues.</div>}
            </div>
          </div>
          <div className="mb-4 rounded border border-line/70 bg-ink p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase text-muted">Recommendation Profiles</div>
                {defaultProfile && <div className="mt-0.5 truncate text-[11px] text-moss">Default: {defaultProfile.name}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-muted hover:text-white" type="button" onClick={() => void onRefreshProfiles()}>
                  Refresh
                </button>
                <button className="text-xs text-moss hover:text-white" type="button" onClick={() => saveCurrentProfile(false)}>
                  Save
                </button>
              </div>
            </div>
            <div className="grid max-h-48 gap-1 overflow-auto">
              {recommendationProfiles.map((profile) => (
                <div key={profile.id} className="grid gap-1 rounded bg-panel px-2 py-1.5 text-xs">
                  <button
                    className="min-w-0 truncate text-left text-neutral-100 hover:text-white"
                    type="button"
                    onClick={() => setSettings({ ...defaultAutoDj, ...profile.settings })}
                    title={profile.name}
                  >
                    {profile.name}
                  </button>
                  <div className="flex items-center justify-between gap-2">
                    <span className={profile.is_default ? "text-moss" : "text-muted"}>
                      {profile.is_default ? "default profile" : `${formatShortDate(profile.updated_at)}`}
                    </span>
                    <span className="flex items-center gap-2">
                      {!profile.is_default && (
                        <button className="text-muted hover:text-moss" type="button" onClick={() => void onSetDefaultRecommendationProfile(profile.id)}>
                          Default
                        </button>
                      )}
                      <button className="text-muted hover:text-red-300" type="button" onClick={() => void onDeleteRecommendationProfile(profile.id)}>
                        Delete
                      </button>
                    </span>
                  </div>
                </div>
              ))}
              {recommendationProfiles.length === 0 && (
                <div className="text-xs text-muted">Profiles persist tuned AutoDJ settings and can become the Settings default.</div>
              )}
            </div>
            <button className="mt-2 w-full text-left text-xs text-muted hover:text-white" type="button" onClick={() => saveCurrentProfile(true)}>
              Save current settings as default profile
            </button>
          </div>
          <div className="grid gap-4">
            <NumberField
              label="Queue Length"
              min={1}
              max={200}
              value={settings.queue_length}
              onChange={(value) => setSettings({ ...settings, queue_length: value })}
            />
            <NumberField
              label="Artist Cooldown"
              min={0}
              max={50}
              value={settings.artist_cooldown}
              onChange={(value) => setSettings({ ...settings, artist_cooldown: value })}
            />
            <NumberField
              label="Album Cooldown"
              min={0}
              max={100}
              value={settings.album_cooldown}
              onChange={(value) => setSettings({ ...settings, album_cooldown: value })}
            />
            <NumberField
              label="Recent Days"
              min={0}
              max={3650}
              value={settings.recently_played_cooldown_days}
              onChange={(value) => setSettings({ ...settings, recently_played_cooldown_days: value })}
            />
            <label className="grid gap-2 text-sm text-neutral-200">
              <span className="text-xs uppercase text-muted">
                Similarity {Number(settings.similarity_weight ?? 0).toFixed(1)}
              </span>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={settings.similarity_weight ?? 0}
                onChange={(event) =>
                  setSettings({ ...settings, similarity_weight: Number(event.target.value) })
                }
                className="accent-moss"
              />
              <button
                className="secondary-button justify-center"
                type="button"
                disabled={!currentTrack}
                onClick={() =>
                  setSettings({
                    ...settings,
                    seed_track_id: currentTrack?.id ?? null,
                    similarity_weight: settings.similarity_weight || uiPreferences.similarityWeight,
                  })
                }
              >
                <Wand2 size={15} />
                {settings.seed_track_id ? "Seeded from current track" : "Use current track as seed"}
              </button>
              {settings.seed_track_id && (
                <button
                  className="text-xs text-muted hover:text-white"
                  type="button"
                  onClick={() => setSettings({ ...settings, seed_track_id: null })}
                >
                  Clear seed
                </button>
              )}
            </label>
            {settings.seed_track_id && (
              <div className="rounded border border-line/70 bg-ink p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-medium uppercase text-muted">Seed Neighbors</div>
                  <div className="text-xs text-muted">{isSimilarityLoading ? "Loading" : `${filteredSimilarPreview.length}/${similarPreview.length} shown`}</div>
                </div>
                <div className="mb-2 grid gap-2 text-xs">
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-2 py-1.5 text-muted">
                    <span>Analyzed only</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={neighborAnalyzedOnly}
                      onChange={(event) => setNeighborAnalyzedOnly(event.target.checked)}
                    />
                  </label>
                  <div className="grid grid-cols-[1fr_84px] gap-2">
                    <input
                      className="h-8 rounded border border-line bg-panel px-2 text-neutral-100 outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      placeholder="Filter genre"
                      value={neighborGenre}
                      onChange={(event) => setNeighborGenre(event.target.value)}
                    />
                    <select
                      className="h-8 rounded border border-line bg-panel px-2 text-neutral-100 outline-none ring-moss/40 focus:ring-2"
                      value={neighborMinRating}
                      onChange={(event) => setNeighborMinRating(Number(event.target.value))}
                    >
                      <option value={0}>Any</option>
                      <option value={3}>3+</option>
                      <option value={4}>4+</option>
                      <option value={4.5}>4.5+</option>
                    </select>
                  </div>
                </div>
                <div className="grid max-h-56 gap-1 overflow-auto">
                  {filteredSimilarPreview.map((track) => (
                    <div key={track.id} className="flex items-center gap-2 rounded bg-panel px-2 py-1.5 text-xs">
                      <button
                        className="icon-button h-7 w-7 shrink-0"
                        type="button"
                        title={`Play ${display(track.title, "track")}`}
                        onClick={() => onPlayTrack(track, similarPreview)}
                      >
                        <Play size={13} />
                      </button>
                      <button
                        className="min-w-0 flex-1 text-left"
                        type="button"
                        title={track.similarity_reason}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            seed_track_id: track.id,
                            similarity_weight: settings.similarity_weight || uiPreferences.similarityWeight,
                          })
                        }
                      >
                        <div className="truncate text-neutral-100">{display(track.title, "Untitled")}</div>
                        <div className="truncate text-muted">{display(track.artist)} - {track.similarity_reason}</div>
                      </button>
                      <div className="shrink-0 text-right tabular-nums text-moss">
                        {track.similarity_score.toFixed(2)}
                        <div className="text-[10px] text-muted">{track.audio_similarity !== null ? track.audio_similarity.toFixed(2) : "--"}</div>
                      </div>
                    </div>
                  ))}
                  {!isSimilarityLoading && filteredSimilarPreview.length === 0 && (
                    <div className="text-xs text-muted">Analyze tracks with CLAP or use richer metadata for better neighbors.</div>
                  )}
                </div>
              </div>
            )}
            <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
              <div className="text-xs font-medium uppercase text-muted">Scoring Weights</div>
              {(
                [
                  ["rating_weight", "Rating"],
                  ["recency_weight", "Recency"],
                  ["skip_weight", "Skips"],
                  ["exploration_weight", "Exploration"],
                  ["play_history_weight", "Play history"],
                  ["feedback_weight", "Manual queue"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="grid gap-1">
                  <span className="text-xs text-muted">
                    {label} {Number(settings[key] ?? 0).toFixed(1)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={Number(settings[key] ?? 0)}
                    onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                    className="accent-moss"
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
              <div className="text-xs font-medium uppercase text-muted">Seed Match Bias</div>
              {(
                [
                  ["audio_similarity_weight", "Audio"],
                  ["artist_similarity_weight", "Artist"],
                  ["album_similarity_weight", "Album"],
                  ["genre_similarity_weight", "Genre"],
                  ["year_similarity_weight", "Era"],
                  ["rating_similarity_weight", "Rating"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="grid gap-1">
                  <span className="text-xs text-muted">
                    {label} {Number(settings[key] ?? defaultAutoDj[key]).toFixed(2)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.05}
                    value={Number(settings[key] ?? defaultAutoDj[key])}
                    onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                    className="accent-moss"
                  />
                </label>
              ))}
            </div>
            <div className="rounded border border-line/70 bg-ink p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-medium uppercase text-muted">Avoid List</div>
                <div className="text-xs text-muted">{avoidRules.length} rules</div>
              </div>
              <div className="grid max-h-44 gap-1 overflow-auto">
                {avoidRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-2 rounded bg-panel px-2 py-1.5 text-xs">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 uppercase text-muted">{rule.scope}</span>
                      <span className="text-neutral-200">{rule.label}</span>
                    </span>
                    <button className="text-muted hover:text-white" type="button" onClick={() => onDeleteAvoidRule(rule.id)}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {avoidRules.length === 0 && <div className="text-xs text-muted">Right-click tracks in Library to avoid them in AutoDJ.</div>}
              </div>
            </div>
            <label className="grid gap-2 text-sm text-neutral-200">
              <span className="text-xs uppercase text-muted">Temperature {settings.temperature.toFixed(2)}</span>
              <input
                type="range"
                min={0.1}
                max={2.5}
                step={0.05}
                value={settings.temperature}
                onChange={(event) =>
                  setSettings({ ...settings, temperature: Number(event.target.value) })
                }
                className="accent-moss"
              />
            </label>
            <label className="grid gap-2 text-sm text-neutral-200">
              <span className="text-xs uppercase text-muted">
                Unrated {settings.unrated_exploration_percent.toFixed(0)}%
              </span>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={settings.unrated_exploration_percent}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    unrated_exploration_percent: Number(event.target.value),
                  })
                }
                className="accent-ember"
              />
            </label>
          </div>
        </section>

        <section className="min-w-0 overflow-auto">
          {selectedQueueKeys.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-line bg-[#15100d] px-4 py-2 text-sm">
              <div className="text-muted">
                <span className="font-medium text-white">{selectedQueueKeys.size}</span> selected
              </div>
              <div className="flex items-center gap-2">
                <button className="secondary-button h-8" type="button" onClick={() => setQueueSelection(false)}>
                  Clear
                </button>
                <button className="secondary-button h-8 text-ember" type="button" onClick={removeSelectedQueueItems}>
                  <Trash2 size={14} />
                  Remove Selected
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-3 border-b border-line bg-[#18130f] p-4 md:grid-cols-4">
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Tracks</div>
              <div className="mt-1 text-xl font-semibold text-white">{queue.length}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Duration</div>
              <div className="mt-1 text-xl font-semibold text-white">{formatDuration(queueDuration)}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Artists</div>
              <div className="mt-1 text-xl font-semibold text-white">{queueArtists}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">CLAP</div>
              <div className="mt-1 text-xl font-semibold text-moss">{queue.length ? formatPercent((clapTracks / queue.length) * 100) : "--"}</div>
            </div>
          </div>
          {recommendationDrift.total_tracks > 0 && (
            <div className="border-b border-line bg-[#15100d] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Recommendation Drift</div>
                  <div className="text-xs text-muted">
                    {recommendationDrift.unique_artists} artists, {recommendationDrift.unique_albums} albums, average rating{" "}
                    {recommendationDrift.average_rating?.toFixed(2) ?? "unrated"}
                  </div>
                </div>
                <div className="text-xs text-muted">{recommendationDrift.total_tracks} tracks</div>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  ["Familiar", recommendationDrift.familiar_percent, "bg-moss"],
                  ["Exploration", recommendationDrift.exploration_percent, "bg-ember"],
                  ["Unrated", recommendationDrift.unrated_percent, "bg-[#d8b077]"],
                  ["Artist repeats", recommendationDrift.repeat_artist_percent, "bg-red-300"],
                  ["CLAP", recommendationDrift.clap_percent, "bg-neutral-300"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded border border-line/70 bg-panel p-2 text-xs">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-muted">{label}</span>
                      <span className="tabular-nums text-neutral-100">{Number(value).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-ink">
                      <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <table className="w-full table-fixed text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
              <tr>
                <th className="w-11 px-3 py-3 font-medium">
                  <input
                    aria-label="Select AutoDJ queue"
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={allQueueSelected}
                    disabled={queue.length === 0}
                    onChange={(event) => setQueueSelection(event.target.checked)}
                  />
                </th>
                <th className="w-14 px-3 py-3 font-medium"></th>
                <th className="w-16 px-6 py-3 font-medium">#</th>
                <th className="w-[32%] px-3 py-3 font-medium">Title</th>
                <th className="w-[18%] px-3 py-3 font-medium">Artist</th>
                <th className="w-[18%] px-3 py-3 font-medium">Album</th>
                <th className="w-24 px-3 py-3 font-medium">Score</th>
                <th className="px-3 py-3 font-medium">Reason</th>
                <th className="w-28 px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((track, index) => {
                const rowKey = `${track.id}-${index}`;
                const explained = explainTrackKey === rowKey;
                return (
                <Fragment key={rowKey}>
                <tr
                  draggable
                  className={`border-b border-line/60 hover:bg-white/[0.035] ${
                    selectedQueueKeys.has(rowKey) ? "bg-white/[0.035]" : dragQueueIndex === index ? "bg-moss/10" : ""
                  }`}
                  onDragStart={(event) => {
                    setDragQueueIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragQueueIndex !== null) {
                      reorderQueueItem(dragQueueIndex, index);
                    }
                    setDragQueueIndex(null);
                  }}
                  onDragEnd={() => setDragQueueIndex(null)}
                >
                  <td className="px-3 py-3">
                    <input
                      aria-label={`Select ${display(track.title, "track")}`}
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={selectedQueueKeys.has(rowKey)}
                      onChange={() => toggleQueueSelection(rowKey)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      className={`icon-button h-8 w-8 ${
                        currentTrackId === track.id ? "border-moss text-moss" : ""
                      }`}
                      title={`Play ${display(track.title, "track")}`}
                      type="button"
                      onClick={() => onPlayTrack(track, queue)}
                    >
                      {currentTrackId === track.id ? <Volume2 size={15} /> : <Play size={15} />}
                    </button>
                  </td>
                  <td className="px-6 py-3 tabular-nums text-muted">{index + 1}</td>
                  <td className="truncate px-3 py-3 font-medium text-white">
                    {display(track.title, "Untitled")}
                  </td>
                  <td className="truncate px-3 py-3 text-neutral-200">{display(track.artist)}</td>
                  <td className="truncate px-3 py-3 text-neutral-300">{display(track.album)}</td>
                  <td className="px-3 py-3 tabular-nums text-moss">{track.score.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {breakdownEntries(track).slice(0, 5).map(([key, value]) => (
                        <span
                          key={key}
                          className={`rounded border px-2 py-1 text-xs ${
                            value >= 0
                              ? "border-moss/30 bg-moss/10 text-moss"
                              : "border-red-500/30 bg-red-500/10 text-red-200"
                          }`}
                          title={`${key}: ${value.toFixed(3)}`}
                        >
                          {key.replace("_", " ")} {value >= 0 ? "+" : ""}
                          {value.toFixed(2)}
                        </span>
                      ))}
                      {reasonChips(track.reason).map((reason) => (
                        <span
                          key={reason}
                          className={`rounded border px-2 py-1 text-xs ${reasonChipClass(reason)}`}
                        >
                          {reason}
                        </span>
                      ))}
                      {isClapAnalyzed(track) && (
                        <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-xs text-moss">
                          CLAP {display(track.analysis_genre, "audio")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="icon-button h-8 w-8" type="button" title="Move up" disabled={index === 0} onClick={() => moveQueueItem(index, "up")}>
                        <ArrowUp size={14} />
                      </button>
                      <button className="icon-button h-8 w-8" type="button" title="Move down" disabled={index === queue.length - 1} onClick={() => moveQueueItem(index, "down")}>
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className={`icon-button h-8 w-8 ${explained ? "border-moss text-moss" : ""}`}
                        type="button"
                        title="Why this track?"
                        onClick={() => setExplainTrackKey(explained ? null : rowKey)}
                      >
                        <Info size={14} />
                      </button>
                      <button
                        className="icon-button h-8 w-8"
                        type="button"
                        title="Remove from queue"
                        onClick={() => {
                          setQueue(queue.filter((_, itemIndex) => itemIndex !== index));
                          setSelectedQueueKeys(new Set());
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {explained && (
                  <tr className="border-b border-line/60 bg-[#15100d]">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid gap-4 text-sm md:grid-cols-[1fr_280px]">
                        <div>
                          <div className="mb-2 text-xs font-medium uppercase text-muted">Why this track</div>
                          <div className="flex flex-wrap gap-2">
                            {breakdownEntries(track).map(([key, value]) => (
                              <span
                                key={key}
                                className={`rounded border px-2 py-1 text-xs ${
                                  value >= 0
                                    ? "border-moss/30 bg-moss/10 text-moss"
                                    : "border-red-500/30 bg-red-500/10 text-red-200"
                                }`}
                              >
                                {key.replace("_", " ")} {value >= 0 ? "+" : ""}
                                {value.toFixed(3)}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 text-xs text-muted">{track.reason}</div>
                        </div>
                        <div className="rounded border border-line/70 bg-panel p-3 text-xs">
                          <div className="mb-2 font-medium uppercase text-muted">Audio analysis</div>
                          <div className="grid gap-1">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Provider</span>
                              <span className="truncate text-neutral-200">{display(track.analysis_provider, "None")}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Genre</span>
                              <span className="truncate text-neutral-200">{display(track.analysis_genre, "-")}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Confidence</span>
                              <span className="text-neutral-200">
                                {track.analysis_genre_confidence !== null && track.analysis_genre_confidence !== undefined
                                  ? formatPercent(track.analysis_genre_confidence * 100)
                                  : "--"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Seed similarity</span>
                              <span className="text-neutral-200">
                                {track.score_breakdown?.similarity ? `+${track.score_breakdown.similarity.toFixed(3)}` : "--"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
              })}
            </tbody>
          </table>
          {queue.length === 0 && (
            <div className="grid h-full place-items-center text-sm text-muted">
              Generate a queue after scanning your library.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AnalysisPage({
  clapStatus,
  coverage,
  progress,
  audioAnalysisLimit,
  setAudioAnalysisLimit,
  audioAnalysisOverwrite,
  setAudioAnalysisOverwrite,
  audioAnalysisOnlyMissing,
  setAudioAnalysisOnlyMissing,
  isAudioAnalyzing,
  currentTrack,
  clapModelId,
  setClapModelId,
  clapCacheDir,
  setClapCacheDir,
  clapMaxDuration,
  setClapMaxDuration,
  installProgress,
  isClapInstalling,
  onRefresh,
  onInstallClap,
  onSaveClapConfig,
  onAnalyzeLibrary,
  onAnalyzeCurrentTrack,
  onPause,
  onResume,
  onCancel,
}: {
  clapStatus: ClapStatusResponse | null;
  coverage: AudioAnalysisCoverage | null;
  progress: AudioAnalysisProgress | null;
  audioAnalysisLimit: number;
  setAudioAnalysisLimit: (value: number) => void;
  audioAnalysisOverwrite: boolean;
  setAudioAnalysisOverwrite: (value: boolean) => void;
  audioAnalysisOnlyMissing: boolean;
  setAudioAnalysisOnlyMissing: (value: boolean) => void;
  isAudioAnalyzing: boolean;
  currentTrack: Track | null;
  clapModelId: string;
  setClapModelId: (value: string) => void;
  clapCacheDir: string;
  setClapCacheDir: (value: string) => void;
  clapMaxDuration: number;
  setClapMaxDuration: (value: number) => void;
  installProgress: ClapInstallProgress | null;
  isClapInstalling: boolean;
  onRefresh: () => void;
  onInstallClap: (device: ClapInstallDevice, force?: boolean) => void;
  onSaveClapConfig: () => void;
  onAnalyzeLibrary: () => void;
  onAnalyzeCurrentTrack: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const clapReady = Boolean(clapStatus?.installed);
  const clapStatusLoaded = Boolean(clapStatus);
  const showRuntimeInstall = clapStatusLoaded;
  const progressPercent = Math.max(0, Math.min(100, progress?.percent ?? coverage?.coverage_percent ?? 0));
  const installPercent = Math.max(0, Math.min(100, installProgress?.percent ?? 0));
  const failures = progress?.failed_tracks ?? [];
  const statusText = installProgress?.message ?? progress?.message ?? clapStatus?.message ?? "CLAP status loading";
  const activeJob = Boolean(progress && !isAnalysisTerminal(progress.status));
  const canPause = isAudioAnalyzing && progress?.status === "running";
  const canResume = isAudioAnalyzing && progress?.status === "paused";
  const torchRuntime = clapStatus?.torch_device
    ? `${clapStatus.torch_device.toUpperCase()}${clapStatus.cuda_device_name ? ` - ${clapStatus.cuda_device_name}` : ""}`
    : "Not installed";
  const runtimeActionLabel = clapReady ? "Change Runtime" : "Install CLAP";
  const runtimePath = clapStatus?.runtime_managed ? clapStatus.runtime_dir : "Project Python environment";

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Analysis</h1>
          <p className="text-xs text-muted">{statusText}</p>
        </div>
        <div className="flex items-center gap-2">
          {clapStatus && (
            <span
              className={`rounded border px-2 py-1 text-xs uppercase ${
                clapReady && Object.keys(clapStatus.dependency_errors ?? {}).length === 0
                  ? "border-moss/40 bg-moss/10 text-moss"
                  : "border-ember/50 bg-ember/10 text-ember"
              }`}
            >
              {clapReady ? "analysis ok" : "runtime issue"}
            </span>
          )}
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={17} />
            Refresh
          </button>
          {showRuntimeInstall && (
            <button
              className="secondary-button"
              type="button"
              disabled={isClapInstalling || clapStatus?.install_supported === false}
              onClick={() => setInstallPromptOpen(true)}
            >
              <Download size={17} />
              {isClapInstalling ? "Installing CLAP" : runtimeActionLabel}
            </button>
          )}
          <button className="primary-button" type="button" disabled={!clapReady || isAudioAnalyzing || isClapInstalling} onClick={onAnalyzeLibrary}>
            <Wand2 size={17} />
            {isAudioAnalyzing ? "Analyzing" : "Analyze Library"}
          </button>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-auto p-6">
        <div className="grid max-w-6xl gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Coverage</div>
              <div className="mt-1 text-2xl font-semibold text-white">{formatPercent(coverage?.coverage_percent)}</div>
              <div className="mt-1 text-xs text-muted">
                {(coverage?.analyzed_tracks ?? 0).toLocaleString()} of {(coverage?.total_tracks ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Unanalyzed</div>
              <div className="mt-1 text-2xl font-semibold text-ember">
                {(coverage?.unanalyzed_tracks ?? 0).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted">Tracks without CLAP embeddings</div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Failures</div>
              <div className="mt-1 text-2xl font-semibold text-red-300">
                {(coverage?.failed_tracks ?? 0).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted">Marked for retry</div>
            </div>
            <div className="rounded border border-line bg-panel p-4">
              <div className="text-xs uppercase text-muted">Model</div>
              <div className={`mt-1 text-sm font-semibold ${clapReady && clapStatus?.model_cached ? "text-moss" : "text-ember"}`}>
                {!clapStatusLoaded ? "Checking" : !clapReady ? "Optional" : clapStatus?.model_cached ? "Cached" : "Needs download"}
              </div>
              <div className="mt-1 truncate text-xs text-muted">{clapStatus?.model_id ?? "Checking"}</div>
              <div className="mt-1 truncate text-xs text-muted">{torchRuntime}</div>
              <div className="mt-1 truncate text-xs text-muted" title={runtimePath ?? undefined}>{runtimePath}</div>
            </div>
          </div>

          {installProgress && (
              <section className="min-w-0 rounded border border-line bg-panel p-5">
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">CLAP Install</div>
                    <div className="mt-1 truncate text-xs text-muted">
                      {installProgress.device === "cuda" ? "NVIDIA CUDA" : "CPU"} -{" "}
                      {installProgress.status}
                    </div>
                  </div>

                  <div className="shrink-0 text-xs uppercase text-muted">
                    {installProgress.current_step} / {installProgress.total_steps}
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded bg-ink">
                  <div
                      className="h-full rounded bg-moss transition-all duration-300"
                      style={{ width: `${installPercent}%` }}
                  />
                </div>

                <div className="mt-2 truncate text-xs text-neutral-300">
                  {installProgress.current_command ?? installProgress.message}
                </div>

                {installProgress.log.length > 0 && (
                    <div className="mt-3 max-h-36 w-full max-w-full overflow-auto overflow-x-hidden rounded border border-line/70 bg-ink p-3 font-mono text-[11px] leading-5 text-muted">
                      {installProgress.log.slice(-10).map((line, index) => (
                          <div key={`${line}-${index}`} className="max-w-full truncate">
                            {line}
                          </div>
                      ))}
                    </div>
                )}
              </section>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
            <section className="rounded border border-line bg-panel p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <SlidersHorizontal size={17} />
                CLAP Controls
              </div>
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm text-neutral-200">
                  <span className="text-xs uppercase text-muted">Model ID</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={clapModelId}
                    onChange={(event) => setClapModelId(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm text-neutral-200">
                  <span className="text-xs uppercase text-muted">Model Cache Directory</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={clapCacheDir}
                    onChange={(event) => setClapCacheDir(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm text-neutral-200">
                  <span className="text-xs uppercase text-muted">Seconds Per Track {clapMaxDuration.toFixed(0)}</span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={5}
                    value={clapMaxDuration}
                    onChange={(event) => setClapMaxDuration(Number(event.target.value))}
                    className="accent-ember"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField
                    label="Analysis Limit"
                    min={0}
                    max={100000}
                    value={audioAnalysisLimit}
                    onChange={setAudioAnalysisLimit}
                  />
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2 text-sm">
                    <span className="text-muted">Only missing</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={audioAnalysisOnlyMissing}
                      onChange={(event) => setAudioAnalysisOnlyMissing(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2 text-sm">
                    <span className="text-muted">Overwrite</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={audioAnalysisOverwrite}
                      onChange={(event) => setAudioAnalysisOverwrite(event.target.checked)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" type="button" onClick={onSaveClapConfig}>
                    <ShieldCheck size={15} />
                    Save CLAP
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!currentTrack || !clapReady || isAudioAnalyzing || isClapInstalling}
                    onClick={onAnalyzeCurrentTrack}
                  >
                    <Wand2 size={15} />
                    Analyze Current
                  </button>
                  {activeJob && (
                    <>
                      <button className="secondary-button" type="button" disabled={!canPause} onClick={onPause}>
                        <Pause size={15} />
                        Pause
                      </button>
                      <button className="secondary-button" type="button" disabled={!canResume} onClick={onResume}>
                        <Play size={15} />
                        Resume
                      </button>
                      <button className="secondary-button" type="button" onClick={onCancel}>
                        <X size={15} />
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded border border-line bg-panel p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Progress</div>
                <div className="text-xs uppercase text-muted">{progress?.phase ?? progress?.status ?? "idle"}</div>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>
                  {(progress?.processed_tracks ?? coverage?.analyzed_tracks ?? 0).toLocaleString()} of{" "}
                  {(progress?.total_tracks ?? coverage?.total_tracks ?? 0).toLocaleString()}
                </span>
                <span>ETA {formatTime(progress?.eta_seconds)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-ink">
                <div className="h-full rounded bg-ember transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <div className="font-semibold text-moss">{(progress?.analyzed ?? coverage?.analyzed_tracks ?? 0).toLocaleString()}</div>
                  <div className="text-muted">Analyzed</div>
                </div>
                <div>
                  <div className="font-semibold text-red-300">{(progress?.skipped ?? coverage?.failed_tracks ?? 0).toLocaleString()}</div>
                  <div className="text-muted">Skipped</div>
                </div>
                <div>
                  <div className="font-semibold text-white">{progressPercent.toFixed(0)}%</div>
                  <div className="text-muted">Progress</div>
                </div>
              </div>
              {progress?.current_track && (
                <div className="mt-3 truncate text-xs text-neutral-300">{progress.current_track}</div>
              )}
              {progress?.model_cached_at_start === false && (
                <div className="mt-3 rounded border border-ember/30 bg-ember/10 px-3 py-2 text-xs text-ember">
                  First model load may take several minutes.
                </div>
              )}
              {failures.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs uppercase text-muted">Recent Failures</div>
                  <div className="grid max-h-52 gap-2 overflow-auto pr-1">
                    {failures.slice(-8).map((failure, index) => (
                      <div key={`${failure.track_id ?? failure.path}-${index}`} className="rounded border border-line/70 bg-ink p-2 text-xs">
                        <div className="truncate text-white">{failure.title ?? fileName(failure.path)}</div>
                        <div className="mt-1 line-clamp-2 text-red-200">{failure.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
      {installPromptOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded border border-line bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Install CLAP Analysis</h2>
                <p className="mt-1 text-sm text-muted">
                  Choose the Torch build for the app-managed ML runtime.
                </p>
              </div>
              <button className="icon-button" type="button" title="Close" onClick={() => setInstallPromptOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="rounded border border-line bg-ink p-4 text-left transition hover:border-moss/70"
                type="button"
                onClick={() => {
                  setInstallPromptOpen(false);
                  onInstallClap("cpu", clapReady);
                }}
              >
                <div className="font-semibold text-white">{clapReady ? "Use CPU Runtime" : "CPU"}</div>
                <div className="mt-1 text-xs text-muted">Smaller, most compatible, good for background analysis.</div>
              </button>
              <button
                className="rounded border border-line bg-ink p-4 text-left transition hover:border-moss/70"
                type="button"
                onClick={() => {
                  setInstallPromptOpen(false);
                  onInstallClap("cuda", clapReady);
                }}
              >
                <div className="font-semibold text-white">{clapReady ? "Use NVIDIA CUDA" : "NVIDIA CUDA"}</div>
                <div className="mt-1 text-xs text-muted">Larger download, faster analysis on supported NVIDIA GPUs.</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SettingsPage({
  settings,
  folderPath,
  setFolderPath,
  onBrowse,
  onScan,
  scanResult,
  scanProgress,
  isScanning,
  backendStatus,
  backendMessage,
  backendCheckedAt,
  startupDiagnostics,
  backendLog,
  onCheckBackend,
  onRunStartupDiagnostics,
  onOpenBackendLog,
  onRestartBackend,
  clapStatus,
  clapModelId,
  setClapModelId,
  clapCacheDir,
  setClapCacheDir,
  clapMaxDuration,
  setClapMaxDuration,
  audioAnalysisProgress,
  audioAnalysisLimit,
  setAudioAnalysisLimit,
  audioAnalysisOverwrite,
  setAudioAnalysisOverwrite,
  audioAnalysisOnlyMissing,
  setAudioAnalysisOnlyMissing,
  isAudioAnalyzing,
  onSaveClapConfig,
  onRefreshClapStatus,
  onAnalyzeAudio,
  hideFilePaths,
  setHideFilePaths,
  uiPreferences,
  setUiPreferences,
  writeRatingsToFiles,
  onWriteRatingsToFilesChange,
  onBackupDatabase,
  onCreateSupportBundle,
  supportBundlePath,
  onCopySupportBundlePath,
  onClearArtistCache,
}: {
  settings: SettingsResponse | null;
  folderPath: string;
  setFolderPath: (value: string) => void;
  onBrowse: () => void;
  onScan: () => void;
  scanResult: ScanResult | null;
  scanProgress: ScanProgress | null;
  isScanning: boolean;
  backendStatus: BackendStatus;
  backendMessage: string;
  backendCheckedAt: string | null;
  startupDiagnostics: StartupDiagnosticsResponse | null;
  backendLog: LogTailResponse | null;
  onCheckBackend: () => void;
  onRunStartupDiagnostics: () => void;
  onOpenBackendLog: () => void;
  onRestartBackend: () => void;
  clapStatus: ClapStatusResponse | null;
  clapModelId: string;
  setClapModelId: (value: string) => void;
  clapCacheDir: string;
  setClapCacheDir: (value: string) => void;
  clapMaxDuration: number;
  setClapMaxDuration: (value: number) => void;
  audioAnalysisProgress: AudioAnalysisProgress | null;
  audioAnalysisLimit: number;
  setAudioAnalysisLimit: (value: number) => void;
  audioAnalysisOverwrite: boolean;
  setAudioAnalysisOverwrite: (value: boolean) => void;
  audioAnalysisOnlyMissing: boolean;
  setAudioAnalysisOnlyMissing: (value: boolean) => void;
  isAudioAnalyzing: boolean;
  onSaveClapConfig: () => void;
  onRefreshClapStatus: () => void;
  onAnalyzeAudio: () => void;
  hideFilePaths: boolean;
  setHideFilePaths: (value: boolean) => void;
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
  writeRatingsToFiles: boolean;
  onWriteRatingsToFilesChange: (value: boolean) => void;
  onBackupDatabase: () => void;
  onCreateSupportBundle: () => void;
  supportBundlePath: string | null;
  onCopySupportBundlePath: () => void;
  onClearArtistCache: () => void;
}) {
  const progressPercent = Math.max(0, Math.min(100, scanProgress?.percent ?? 0));
  const hasCount = Boolean(scanProgress && scanProgress.total_files > 0);
  const audioProgressPercent = Math.max(0, Math.min(100, audioAnalysisProgress?.percent ?? 0));
  const clapReady = Boolean(clapStatus?.installed);
  const backendStatusClass =
    backendStatus === "ok"
      ? "border-moss/40 bg-moss/10 text-moss"
      : backendStatus === "down"
        ? "border-red-400/40 bg-red-500/10 text-red-300"
        : "border-line bg-ink text-muted";

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Settings</h1>
          <p className="text-xs text-muted">{settings?.database_path ?? "Database path loading"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded border px-2 py-1 text-xs uppercase ${backendStatusClass}`}>
            backend {backendStatus}
          </span>
          {startupDiagnostics && (
            <span
              className={`rounded border px-2 py-1 text-xs uppercase ${
                startupDiagnostics.ok ? "border-moss/40 bg-moss/10 text-moss" : "border-ember/50 bg-ember/10 text-ember"
              }`}
            >
              self-check {startupDiagnostics.ok ? "ok" : "review"}
            </span>
          )}
        </div>
      </header>
      <section className="min-h-0 flex-1 overflow-auto p-6">
        <div className="grid max-w-3xl gap-5">
          <label className="grid gap-2 text-sm text-neutral-200">
            <span className="text-xs uppercase text-muted">Music Folder Path</span>
            <div className="flex gap-2">
              <input
                value={folderPath}
                onChange={(event) => setFolderPath(event.target.value)}
                className="h-10 flex-1 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                placeholder="C:\\Users\\you\\Music"
              />
              <button className="secondary-button h-10" type="button" onClick={onBrowse} disabled={isScanning}>
                <FolderOpen size={17} />
                Browse
              </button>
              <button className="primary-button h-10" type="button" onClick={onScan} disabled={isScanning}>
                <RefreshCw size={17} />
                {isScanning ? "Scanning" : "Rescan"}
              </button>
            </div>
          </label>

          {!settings?.library_path && settings?.suggested_music_path && (
            <div className="flex items-center justify-between gap-3 rounded border border-ember/30 bg-ember/10 p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-white">Use your Windows Music folder?</div>
                <div className="truncate text-xs text-muted">{settings.suggested_music_path}</div>
              </div>
              <button
                className="secondary-button shrink-0"
                type="button"
                onClick={() => setFolderPath(settings.suggested_music_path ?? "")}
              >
                <FolderOpen size={15} />
                Use Folder
              </button>
            </div>
          )}

          <DisclosureSection title="Library Preferences" description="Display, rating storage, and startup behavior" defaultOpen>
            <div className="grid gap-3 text-sm text-neutral-200">
              <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <EyeOff className="shrink-0 text-muted" size={18} />
                  <div className="min-w-0">
                    <div className="font-medium text-white">Hide file paths in track lists</div>
                    <div className="text-xs text-muted">Keeps the library view focused on music metadata.</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-moss"
                  checked={hideFilePaths}
                  onChange={(event) => setHideFilePaths(event.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-4 rounded border border-line/70 bg-ink p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Star className="shrink-0 text-ember" size={18} />
                  <div className="min-w-0">
                    <div className="font-medium text-white">Write ratings and metadata to audio files</div>
                    <div className="text-xs text-muted">
                      Supported now: FLAC, MP3, M4A, Ogg, and Opus. WAV/AIFF edits stay safest in SQLite.
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-ember"
                  checked={writeRatingsToFiles}
                  onChange={(event) => onWriteRatingsToFilesChange(event.target.checked)}
                />
              </label>

              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div className="font-medium text-white">Library layout</div>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-muted">Compact rows</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={uiPreferences.compactLibraryRows}
                    onChange={(event) =>
                      setUiPreferences((current) => ({
                        ...current,
                        compactLibraryRows: event.target.checked,
                        density: event.target.checked ? "compact" : "comfortable",
                      }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-muted">Album cover grid</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={uiPreferences.albumGrid}
                    onChange={(event) =>
                      setUiPreferences((current) => ({ ...current, albumGrid: event.target.checked }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Startup Page</span>
                  <select
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={uiPreferences.startupPage}
                    onChange={(event) =>
                      setUiPreferences((current) => ({ ...current, startupPage: event.target.value as Page }))
                    }
                  >
                    <option value="library">Library</option>
                    <option value="analysis">Analysis</option>
                    <option value="nowPlaying">Now Playing</option>
                    <option value="artist">Artist</option>
                    <option value="history">History</option>
                    <option value="autodj">AutoDJ</option>
                    <option value="settings">Settings</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
                <div className="font-medium text-white">Theme</div>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Accent</span>
                  <select
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={uiPreferences.themeAccent}
                    onChange={(event) =>
                      setUiPreferences((current) => ({ ...current, themeAccent: event.target.value as ThemeAccent }))
                    }
                  >
                    <option value="cafe">FLAC Cafe</option>
                    <option value="mint">Mint</option>
                    <option value="rose">Rose</option>
                    <option value="blue">Blue Note</option>
                  </select>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Density</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.density}
                      onChange={(event) => {
                        const density = event.target.value as UiDensity;
                        setUiPreferences((current) => ({
                          ...current,
                          density,
                          compactLibraryRows: density === "compact",
                        }));
                      }}
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Font Size</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.fontScale}
                      onChange={(event) =>
                        setUiPreferences((current) => ({ ...current, fontScale: event.target.value as FontScale }))
                      }
                    >
                      <option value="small">Small</option>
                      <option value="default">Default</option>
                      <option value="large">Large</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Player Layout</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={uiPreferences.playerLayout}
                      onChange={(event) => {
                        const playerLayout = event.target.value as PlayerLayout;
                        setUiPreferences((current) => ({
                          ...current,
                          playerLayout,
                          miniPlayer: playerLayout === "compact",
                        }));
                      }}
                    >
                      <option value="full">Full</option>
                      <option value="compact">Compact</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </DisclosureSection>

          <DisclosureSection title="AutoDJ Defaults" description="Queue size, temperature, and similarity bias">
            <div className="grid gap-4 text-sm text-neutral-200">
            <NumberField
              label="Default Queue Length"
              min={1}
              max={200}
              value={uiPreferences.defaultQueueLength}
              onChange={(value) =>
                setUiPreferences((current) => ({ ...current, defaultQueueLength: value }))
              }
            />
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">
                Default Temperature {uiPreferences.defaultTemperature.toFixed(2)}
              </span>
              <input
                type="range"
                min={0.1}
                max={2.5}
                step={0.05}
                value={uiPreferences.defaultTemperature}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, defaultTemperature: Number(event.target.value) }))
                }
                className="accent-moss"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">
                Similarity Bias {uiPreferences.similarityWeight.toFixed(1)}
              </span>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={uiPreferences.similarityWeight}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, similarityWeight: Number(event.target.value) }))
                }
                className="accent-ember"
              />
            </label>
            </div>
          </DisclosureSection>

          <DisclosureSection title="CLAP Audio Analysis" description={clapStatus?.message ?? "Optional genre and similarity analysis"}>
            <div className="grid gap-4 text-sm text-neutral-200">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className={`mt-1 truncate text-xs ${clapReady ? "text-moss" : "text-muted"}`}>
                  {clapStatus?.message ?? "Checking CLAP"}
                </div>
                {clapStatus?.runtime_managed && (
                  <div className="mt-1 truncate text-xs text-muted" title={clapStatus.runtime_dir ?? undefined}>
                    Runtime {clapStatus.runtime_device ?? "not installed"} - {clapStatus.runtime_dir}
                  </div>
                )}
              </div>
              <button className="icon-button" type="button" title="Refresh CLAP status" onClick={onRefreshClapStatus}>
                <RefreshCw size={16} />
              </button>
            </div>

            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Model ID</span>
              <input
                className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={clapModelId}
                onChange={(event) => setClapModelId(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Model Cache Directory</span>
              <input
                className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={clapCacheDir}
                onChange={(event) => setClapCacheDir(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Seconds Analyzed Per Track</span>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={clapMaxDuration}
                onChange={(event) => setClapMaxDuration(Number(event.target.value))}
                className="accent-ember"
              />
              <span className="text-xs text-muted">{clapMaxDuration.toFixed(0)} seconds from the start of each file</span>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberField
                label="Analysis Limit"
                min={0}
                max={100000}
                value={audioAnalysisLimit}
                onChange={setAudioAnalysisLimit}
              />
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                <span className="text-muted">Only missing</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={audioAnalysisOnlyMissing}
                  onChange={(event) => setAudioAnalysisOnlyMissing(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                <span className="text-muted">Overwrite</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-ember"
                  checked={audioAnalysisOverwrite}
                  onChange={(event) => setAudioAnalysisOverwrite(event.target.checked)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="secondary-button" type="button" onClick={onSaveClapConfig}>
                <ShieldCheck size={15} />
                Save CLAP
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!clapReady || isAudioAnalyzing}
                onClick={onAnalyzeAudio}
              >
                <Wand2 size={15} />
                {isAudioAnalyzing ? "Analyzing" : "Analyze Audio"}
              </button>
            </div>

            {audioAnalysisProgress && (
              <div className="rounded border border-line/70 bg-ink p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>
                    {audioAnalysisProgress.processed_tracks.toLocaleString()} of{" "}
                    {audioAnalysisProgress.total_tracks.toLocaleString()} tracks
                  </span>
                  <span>ETA {formatTime(audioAnalysisProgress.eta_seconds)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-panel">
                  <div className="h-full rounded bg-ember transition-all duration-300" style={{ width: `${audioProgressPercent}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
                  <div>
                    <div className="font-semibold text-moss">{audioAnalysisProgress.analyzed}</div>
                    <div className="text-muted">Analyzed</div>
                  </div>
                  <div>
                    <div className="font-semibold text-red-300">{audioAnalysisProgress.skipped}</div>
                    <div className="text-muted">Skipped</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{audioProgressPercent.toFixed(0)}%</div>
                    <div className="text-muted">Progress</div>
                  </div>
                </div>
                {audioAnalysisProgress.current_track && (
                  <div className="mt-2 truncate text-xs text-muted">{audioAnalysisProgress.current_track}</div>
                )}
              </div>
            )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="Player" description="Fade and playback presentation">
            <div className="grid gap-3 text-sm text-neutral-200">
            <label className="flex items-center justify-between gap-4">
              <span className="text-muted">Mini player height</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={uiPreferences.miniPlayer}
                onChange={(event) =>
                  setUiPreferences((current) => ({
                    ...current,
                    miniPlayer: event.target.checked,
                    playerLayout: event.target.checked ? "compact" : "full",
                  }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Fade Length {uiPreferences.playerFadeMs}ms</span>
              <input
                type="range"
                min={0}
                max={500}
                step={25}
                value={uiPreferences.playerFadeMs}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, playerFadeMs: Number(event.target.value) }))
                }
                className="accent-moss"
              />
            </label>
            <div className="rounded border border-line/70 bg-ink p-3">
              <div className="mb-2 font-medium text-white">WebView codec support</div>
              <div className="grid gap-2">
                {codecSupportRows().map((codec) => (
                  <div key={codec.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted">{codec.label}</span>
                    <span className={`rounded border px-2 py-1 ${codecSupportClass(codec.support)}`}>
                      {formatCodecSupport(codec.support)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </DisclosureSection>

          <DisclosureSection title="Maintenance" description="Background services and database helpers">
            <div className="grid gap-3 text-sm text-neutral-200">
            <div className="rounded border border-line/70 bg-ink p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">Backend service</div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {backendCheckedAt ? `Last checked ${backendCheckedAt}` : "Not checked yet"}
                  </div>
                </div>
                <span className={`shrink-0 rounded border px-2 py-1 text-xs uppercase ${backendStatusClass}`}>
                  {backendStatus}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted">{backendMessage}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={onCheckBackend}>
                  <RefreshCw size={15} />
                  Check Backend
                </button>
                <button className="secondary-button" type="button" onClick={onRestartBackend} disabled={backendStatus === "restarting"}>
                  <RefreshCw size={15} />
                  {backendStatus === "restarting" ? "Restarting" : "Restart Backend"}
                </button>
              </div>
            </div>

            <div className="rounded border border-line/70 bg-ink p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">Startup self-check</div>
                  <div className="mt-1 truncate text-xs text-muted">
                    {startupDiagnostics
                      ? `Last run ${new Date(startupDiagnostics.generated_at).toLocaleString()}`
                      : "Not run yet"}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-1 text-xs uppercase ${
                    startupDiagnostics?.ok
                      ? "border-moss/40 bg-moss/10 text-moss"
                      : startupDiagnostics
                        ? "border-ember/50 bg-ember/10 text-ember"
                        : "border-line bg-panel text-muted"
                  }`}
                >
                  {startupDiagnostics ? (startupDiagnostics.ok ? "ok" : "review") : "unknown"}
                </span>
              </div>
              {startupDiagnostics && (
                <div className="mt-3 grid gap-2">
                  {startupDiagnostics.items.map((item) => (
                    <div key={item.key} className="flex items-start gap-2 text-xs">
                      {item.ok ? (
                        <CheckCircle2 className="mt-0.5 shrink-0 text-moss" size={14} />
                      ) : (
                        <Info className="mt-0.5 shrink-0 text-ember" size={14} />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-200">{item.label}</div>
                        <div className="truncate text-muted" title={item.path ?? item.message}>
                          {item.message}
                          {item.path ? ` - ${item.path}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 border-t border-line pt-2">
                    <div className="mb-2 text-xs font-medium uppercase text-muted">WebView codecs</div>
                    <div className="grid grid-cols-2 gap-2">
                      {codecSupportRows().map((codec) => (
                        <div key={codec.label} className="flex items-center justify-between gap-2 rounded border border-line/70 bg-panel px-2 py-1">
                          <span className="truncate text-muted">{codec.label}</span>
                          <span className={`shrink-0 rounded border px-2 py-0.5 ${codecSupportClass(codec.support)}`}>
                            {formatCodecSupport(codec.support)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={onRunStartupDiagnostics}>
                  <ShieldCheck size={15} />
                  Run Self-Check
                </button>
                <button className="secondary-button" type="button" onClick={onOpenBackendLog}>
                  <FileText size={15} />
                  Open Log
                </button>
              </div>
              {backendLog && (
                <details className="mt-3 rounded border border-line bg-panel p-2 text-xs text-muted">
                  <summary className="cursor-pointer text-neutral-200">
                    {backendLog.exists ? `Log tail (${backendLog.lines.length} lines)` : "No backend log yet"}
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5">
                    {backendLog.lines.join("\n") || backendLog.path}
                  </pre>
                </details>
              )}
            </div>

            <label className="flex items-center justify-between gap-4">
              <span className="text-muted">Artist lookup</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={uiPreferences.enableArtistLookup}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, enableArtistLookup: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-muted">Toast notifications</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={uiPreferences.showToasts}
                onChange={(event) =>
                  setUiPreferences((current) => ({ ...current, showToasts: event.target.checked }))
                }
              />
            </label>
            <div className="flex gap-2">
              <button className="secondary-button" type="button" onClick={onBackupDatabase}>
                <Download size={15} />
                Backup DB
              </button>
              <button className="secondary-button" type="button" onClick={onCreateSupportBundle}>
                <FileText size={15} />
                Support Bundle
              </button>
              <button className="secondary-button" type="button" disabled={!supportBundlePath} onClick={onCopySupportBundlePath}>
                <FileText size={15} />
                Copy Path
              </button>
              <button className="secondary-button" type="button" onClick={onClearArtistCache}>
                <RefreshCw size={15} />
                Clear Artist Cache
              </button>
            </div>
            {supportBundlePath && (
              <div className="truncate rounded border border-line/70 bg-panel px-3 py-2 text-xs text-muted" title={supportBundlePath}>
                {supportBundlePath}
              </div>
            )}
            </div>
          </DisclosureSection>

          {scanProgress && scanProgress.status !== "completed" && scanProgress.status !== "failed" && (
            <div className="rounded border border-line bg-panel p-4 text-sm text-neutral-200">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-white">
                    {scanProgress.status === "cleaning" ? "Removing missing files" : hasCount ? "Scanning library" : "Finding audio files"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {hasCount
                      ? `${scanProgress.processed_files.toLocaleString()} of ${scanProgress.total_files.toLocaleString()} files`
                      : "Counting supported audio files"}
                  </div>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>Elapsed {formatTime(scanProgress.elapsed_seconds)}</div>
                  <div>ETA {formatTime(scanProgress.eta_seconds)}</div>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded bg-ink">
                <div
                  className={`h-full rounded bg-moss transition-all duration-300 ${
                    hasCount ? "" : "w-1/3 animate-pulse"
                  }`}
                  style={hasCount ? { width: `${progressPercent}%` } : undefined}
                />
              </div>

              <div className="mt-3 grid grid-cols-5 gap-3 text-center">
                <div>
                  <div className="font-semibold text-white">{scanProgress.inserted}</div>
                  <div className="text-xs text-muted">Inserted</div>
                </div>
                <div>
                  <div className="font-semibold text-ember">{scanProgress.updated}</div>
                  <div className="text-xs text-muted">Updated</div>
                </div>
                <div>
                  <div className="font-semibold text-red-200">{scanProgress.removed}</div>
                  <div className="text-xs text-muted">Removed</div>
                </div>
                <div>
                  <div className="font-semibold text-red-300">{scanProgress.skipped}</div>
                  <div className="text-xs text-muted">Skipped</div>
                </div>
                <div>
                  <div className="font-semibold text-moss">{progressPercent.toFixed(0)}%</div>
                  <div className="text-xs text-muted">Progress</div>
                </div>
              </div>

              {scanProgress.current_path && (
                <div className="mt-3 truncate text-xs text-muted" title={scanProgress.current_path}>
                  {fileName(scanProgress.current_path)}
                </div>
              )}
            </div>
          )}

          {scanProgress?.status === "failed" && (
            <div className="rounded border border-red-400/40 bg-red-950/20 p-4 text-sm text-red-200">
              {scanProgress.error ?? "Scan failed"}
            </div>
          )}

          {scanResult && (
            <div className="rounded border border-line bg-panel p-4 text-sm text-neutral-200">
              <div className="mb-2 font-medium text-white">{scanResult.folder_path}</div>
              <div className="grid grid-cols-5 gap-3 text-center">
                <div>
                  <div className="text-lg font-semibold text-white">{scanResult.scanned_files}</div>
                  <div className="text-xs text-muted">Scanned</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-moss">{scanResult.inserted}</div>
                  <div className="text-xs text-muted">Inserted</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-ember">{scanResult.updated}</div>
                  <div className="text-xs text-muted">Updated</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-200">{scanResult.removed}</div>
                  <div className="text-xs text-muted">Removed</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-300">{scanResult.skipped}</div>
                  <div className="text-xs text-muted">Skipped</div>
                </div>
              </div>
              {scanResult.errors.length > 0 && (
                <details className="mt-3 text-xs text-muted">
                  <summary>Scan errors</summary>
                  <ul className="mt-2 grid gap-1">
                    {scanResult.errors.slice(0, 20).map((error) => (
                      <li key={error} className="truncate">
                        {error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function NowPlayingPage({
  currentTrack,
  lyrics,
  isLyricsLoading,
  playbackTime,
  queue,
  onPlayTrack,
  onMoveQueueTrack,
  onReorderQueueTrack,
  onRemoveQueueTrack,
  onClearQueue,
  onSaveQueue,
  onRestoreQueue,
  canRestoreQueue,
}: {
  currentTrack: Track | null;
  lyrics: LyricsResponse | null;
  isLyricsLoading: boolean;
  playbackTime: number;
  queue: Track[];
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onMoveQueueTrack: (index: number, direction: "up" | "down") => void;
  onReorderQueueTrack: (fromIndex: number, toIndex: number) => void;
  onRemoveQueueTrack: (index: number) => void;
  onClearQueue: () => void;
  onSaveQueue: () => void;
  onRestoreQueue: () => void;
  canRestoreQueue: boolean;
}) {
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setArtworkFailed(false);
  }, [currentTrack?.id]);

  const artworkSrc = currentTrack && !artworkFailed ? albumArtworkUrl(currentTrack.id) : null;
  const lyricLines = lyrics?.lyrics?.split("\n") ?? [];
  const hasLyrics = lyricLines.some((line) => line.trim().length > 0);
  const timedLines = lyricLines.map((line, index) => ({ line, index, time: parseLyricTimestamp(line) }));
  const activeLyricIndex = timedLines.reduce((active, item) => {
    if (item.time !== null && item.time <= playbackTime) {
      return item.index;
    }
    return active;
  }, -1);

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Now Playing</h1>
          <p className="text-xs text-muted">
            {currentTrack ? `${display(currentTrack.artist)} - ${display(currentTrack.album, "Unknown album")}` : "Idle"}
          </p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr_300px] gap-6 overflow-hidden p-6">
        <section className="min-w-0">
          <div className="aspect-square overflow-hidden rounded border border-line bg-panel shadow-xl">
            {artworkSrc ? (
              <img
                key={artworkSrc}
                alt=""
                className="h-full w-full object-cover"
                src={artworkSrc}
                onError={() => setArtworkFailed(true)}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-moss">
                <Volume2 size={54} />
              </div>
            )}
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="truncate text-2xl font-semibold text-white">
              {currentTrack ? display(currentTrack.title, "Untitled") : "Nothing playing"}
            </h2>
            <div className="mt-2 truncate text-sm text-neutral-300">
              {currentTrack ? display(currentTrack.artist) : "Choose a track from Library or AutoDJ"}
            </div>
            <div className="mt-1 truncate text-sm text-muted">
              {currentTrack ? display(currentTrack.album, "Unknown album") : ""}
            </div>
          </div>

          {currentTrack && (
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-line bg-panel p-3">
                <div className="text-xs uppercase text-muted">Year</div>
                <div className="mt-1 text-white">{display(currentTrack.year, "-")}</div>
              </div>
              <div className="rounded border border-line bg-panel p-3">
                <div className="text-xs uppercase text-muted">Genre</div>
                <div className="mt-1 truncate text-white">{display(trackGenre(currentTrack), "-")}</div>
              </div>
            </div>
          )}
        </section>

        <section className="min-h-0 min-w-0 rounded border border-line bg-panel">
          <div className="flex h-12 items-center justify-between border-b border-line px-4">
            <div className="text-sm font-semibold text-white">Lyrics</div>
            {lyrics?.source && <div className="truncate text-xs text-muted">{lyrics.source}</div>}
          </div>

          <div className="h-[calc(100%-3rem)] overflow-auto px-7 py-6">
            {isLyricsLoading && <div className="text-sm text-muted">Loading lyrics...</div>}
            {!isLyricsLoading && !currentTrack && (
              <div className="grid h-full place-items-center text-sm text-muted">No track selected.</div>
            )}
            {!isLyricsLoading && currentTrack && !hasLyrics && (
              <div className="grid h-full place-items-center text-center text-sm text-muted">
                No embedded or sidecar lyrics found for this track.
              </div>
            )}
            {!isLyricsLoading && hasLyrics && (
              <div className="mx-auto max-w-3xl space-y-3 text-lg leading-8 text-neutral-100">
                {lyricLines.map((line, index) => (
                  line.trim().length > 0 ? (
                    <p
                      key={`${index}-${line}`}
                      className={`whitespace-pre-wrap transition ${
                        activeLyricIndex === index ? "text-moss" : "text-neutral-100"
                      }`}
                    >
                      {stripLyricTimestamp(line)}
                    </p>
                  ) : (
                    <div key={`space-${index}`} className="h-3" />
                  )
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 min-w-0 rounded border border-line bg-panel">
          <div className="flex h-12 items-center justify-between border-b border-line px-4">
            <div>
              <div className="text-sm font-semibold text-white">Queue</div>
              <div className="text-xs text-muted">{queue.length} tracks</div>
            </div>
            <div className="flex items-center gap-1">
              <button className="icon-button h-8 w-8" type="button" title="Save queue as playlist" disabled={queue.length === 0} onClick={onSaveQueue}>
                <Plus size={14} />
              </button>
              <button className="icon-button h-8 w-8" type="button" title="Restore previous queue" disabled={!canRestoreQueue} onClick={onRestoreQueue}>
                <RefreshCw size={14} />
              </button>
              <button className="icon-button h-8 w-8" type="button" title="Clear queue" disabled={queue.length === 0} onClick={onClearQueue}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="h-[calc(100%-3rem)] overflow-auto">
            {queue.map((track, index) => {
              const active = currentTrack?.id === track.id;
              return (
                <div
                  key={`${track.id}-${index}`}
                  draggable
                  className={`flex w-full items-center gap-3 border-b border-line/60 px-3 py-2 text-left text-sm transition ${
                    active ? "bg-white/10" : dragIndex === index ? "bg-moss/10" : "hover:bg-white/[0.035]"
                  }`}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                    setDragIndex(index);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                    if (Number.isInteger(fromIndex)) {
                      onReorderQueueTrack(fromIndex, index);
                    }
                    setDragIndex(null);
                  }}
                >
                  <GripVertical className="shrink-0 text-muted" size={14} />
                  <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted">{index + 1}</span>
                  <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onPlayTrack(track, queue)}>
                    <span className="block truncate text-white">{display(track.title, "Untitled")}</span>
                    <span className="block truncate text-xs text-muted">{display(track.artist)}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 opacity-80">
                    <button
                      className="icon-button h-7 w-7"
                      type="button"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => onMoveQueueTrack(index, "up")}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      className="icon-button h-7 w-7"
                      type="button"
                      title="Move down"
                      disabled={index === queue.length - 1}
                      onClick={() => onMoveQueueTrack(index, "down")}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      className="icon-button h-7 w-7 text-ember"
                      type="button"
                      title="Remove from queue"
                      onClick={() => onRemoveQueueTrack(index)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
            {queue.length === 0 && (
              <div className="grid h-full place-items-center px-4 text-center text-sm text-muted">
                Queue is empty.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ArtistPage({
  currentTrack,
  artistInfo,
  artistTracks,
  isArtistLoading,
  onRefresh,
  onPlayTrack,
}: {
  currentTrack: Track | null;
  artistInfo: ArtistInfoResponse | null;
  artistTracks: Track[];
  isArtistLoading: boolean;
  onRefresh: () => void;
  onPlayTrack: (track: Track, queue: Track[]) => void;
}) {
  const artistName = primaryArtistName(currentTrack?.artist) || display(currentTrack?.artist, "");
  const hasImage = Boolean(artistInfo?.image_url);

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Artist</h1>
          <p className="text-xs text-muted">
            {artistName ? `About ${artistName}` : "Select a track to see artist details"}
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={!artistName || isArtistLoading}
          onClick={onRefresh}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-6 overflow-hidden p-6">
        <section className="min-w-0">
          <div className="aspect-[4/5] overflow-hidden rounded border border-line bg-panel shadow-xl">
            {hasImage ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                src={artistInfo?.image_url ?? ""}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-moss">
                <UserRound size={64} />
              </div>
            )}
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="truncate text-2xl font-semibold text-white">
              {artistInfo?.artist_name ?? (artistName || "No artist selected")}
            </h2>
            <div className="mt-2 truncate text-sm text-muted">
              {currentTrack ? `${display(currentTrack.title, "Current track")} - ${display(currentTrack.album, "Unknown album")}` : ""}
            </div>
          </div>

          {artistTracks.length > 0 && (
            <div className="mt-5 rounded border border-line bg-panel">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-white">Top Local Tracks</div>
              {artistTracks.slice(0, 8).map((track) => (
                <button
                  key={track.id}
                  className="flex w-full items-center justify-between gap-3 border-b border-line/60 px-3 py-2 text-left text-sm hover:bg-white/[0.035]"
                  type="button"
                  onClick={() => onPlayTrack(track, artistTracks)}
                >
                  <span className="min-w-0 flex-1 truncate text-white">{display(track.title, "Untitled")}</span>
                  <span className="shrink-0 text-xs text-muted">{formatRating(track.rating)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="min-h-0 min-w-0 rounded border border-line bg-panel">
          <div className="flex h-12 items-center justify-between border-b border-line px-4">
            <div className="text-sm font-semibold text-white">Background</div>
            <div className="flex min-w-0 items-center gap-3">
              {artistInfo?.source && <span className="truncate text-xs text-muted">{artistInfo.source}</span>}
              {artistInfo?.page_url && (
                <a
                  className="inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                  href={artistInfo.page_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>

          <div className="h-[calc(100%-3rem)] overflow-auto px-7 py-6">
            {isArtistLoading && <div className="text-sm text-muted">Loading artist info...</div>}
            {!isArtistLoading && !artistName && (
              <div className="grid h-full place-items-center text-sm text-muted">No artist selected.</div>
            )}
            {!isArtistLoading && artistName && !artistInfo?.found && (
              <div className="grid h-full place-items-center text-center text-sm text-muted">
                {artistInfo?.error ?? "No artist background found yet."}
              </div>
            )}
            {!isArtistLoading && artistInfo?.found && (
              <div className="mx-auto max-w-3xl">
                <p className="whitespace-pre-wrap text-xl leading-9 text-neutral-100">
                  {artistInfo.summary}
                </p>
                {artistInfo.from_cache && (
                  <div className="mt-5 text-xs text-muted">
                    Cached locally{artistInfo.updated_at ? ` on ${new Date(artistInfo.updated_at).toLocaleString()}` : ""}.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function HistoryPage({
  events,
  stats,
  onPlayTrack,
  onRefresh,
}: {
  events: PlayEventEntry[];
  stats: LibraryStatsResponse | null;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onRefresh: () => void;
}) {
  const playable = events.map((event) => event.track).filter((track): track is Track => Boolean(track));

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">History</h1>
          <p className="text-xs text-muted">Recent plays, skips, ratings, and library stats</p>
        </div>
        <button className="secondary-button" type="button" onClick={onRefresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
        <section className="border-r border-line p-4">
          <div className="grid gap-3 text-sm">
            <div className="rounded border border-line bg-panel p-3">
              <div className="text-xs uppercase text-muted">Tracks</div>
              <div className="mt-1 text-2xl font-semibold text-white">{stats?.total_tracks.toLocaleString() ?? "-"}</div>
            </div>
            <div className="rounded border border-line bg-panel p-3">
              <div className="text-xs uppercase text-muted">Artists</div>
              <div className="mt-1 text-2xl font-semibold text-white">{stats?.total_artists.toLocaleString() ?? "-"}</div>
            </div>
            <div className="rounded border border-line bg-panel p-3">
              <div className="text-xs uppercase text-muted">Rated</div>
              <div className="mt-1 text-2xl font-semibold text-moss">{stats?.rated_tracks.toLocaleString() ?? "-"}</div>
            </div>
            <div className="rounded border border-line bg-panel p-3">
              <div className="text-xs uppercase text-muted">Plays / Skips</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {stats ? `${stats.played_events} / ${stats.skipped_events}` : "-"}
              </div>
            </div>
          </div>
        </section>
        <section className="min-w-0 overflow-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
              <tr>
                <th className="w-32 px-4 py-3 font-medium">Event</th>
                <th className="px-3 py-3 font-medium">Track</th>
                <th className="w-48 px-3 py-3 font-medium">Artist</th>
                <th className="w-52 px-3 py-3 font-medium">Album</th>
                <th className="w-48 px-3 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-line/60 hover:bg-white/[0.035]">
                  <td className="px-4 py-3 text-muted">{event.event_type}</td>
                  <td className="truncate px-3 py-3">
                    {event.track ? (
                      <button className="truncate text-left font-medium text-white" type="button" onClick={() => onPlayTrack(event.track!, playable)}>
                        {display(event.track.title, "Untitled")}
                      </button>
                    ) : (
                      <span className="text-muted">Missing track</span>
                    )}
                  </td>
                  <td className="truncate px-3 py-3 text-neutral-200">{display(event.track?.artist)}</td>
                  <td className="truncate px-3 py-3 text-neutral-300">{display(event.track?.album)}</td>
                  <td className="truncate px-3 py-3 text-muted">{formatDate(event.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function BackendRecoveryPage({
  backendMessage,
  backendCheckedAt,
  onCheckBackend,
  onRestartBackend,
  onOpenBackendLog,
}: {
  backendMessage: string;
  backendCheckedAt: string | null;
  onCheckBackend: () => void;
  onRestartBackend: () => void;
  onOpenBackendLog: () => void;
}) {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Recovery</h1>
          <p className="text-xs text-muted">
            {backendCheckedAt ? `Backend last checked ${backendCheckedAt}` : "Backend status unavailable"}
          </p>
        </div>
      </header>
      <section className="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
        <div className="w-full max-w-2xl rounded border border-ember/40 bg-[#211a15] p-6 shadow-2xl">
          <div className="mb-4 flex items-start gap-3">
            <Info className="mt-1 shrink-0 text-ember" size={22} />
            <div>
              <h2 className="text-lg font-semibold text-white">FLAC Cafe cannot reach its local backend</h2>
              <p className="mt-2 text-sm text-muted">{backendMessage}</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-neutral-200">
            <div className="rounded border border-line/70 bg-ink p-3">
              The UI is still running, but library scans, ratings, playback URLs, and AutoDJ need the Python service on
              `127.0.0.1:8765`.
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="primary-button" type="button" onClick={onCheckBackend}>
                <RefreshCw size={15} />
                Check Again
              </button>
              <button className="secondary-button" type="button" onClick={onRestartBackend}>
                <RefreshCw size={15} />
                Restart Backend
              </button>
              <button className="secondary-button" type="button" onClick={onOpenBackendLog}>
                <FileText size={15} />
                Open Log
              </button>
            </div>
            <div className="text-xs text-muted">
              In development, start the backend with `npm run backend:dev`. In the installed app, Restart Backend should relaunch the bundled service.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniPlayerWindow() {
  const [snapshot, setSnapshot] = useState<MiniPlayerSnapshot>(readMiniPlayerSnapshot);
  const track = snapshot.track;
  const duration = snapshot.duration || track?.duration_seconds || 0;
  const progressPercent = duration > 0 ? Math.min(100, (snapshot.currentTime / duration) * 100) : 0;
  const artworkSrc = track ? albumArtworkUrl(track.id) : null;
  const [artworkFailed, setArtworkFailed] = useState(false);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return;
    }
    const channel = new BroadcastChannel(miniPlayerChannelName);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "snapshot") {
        setSnapshot(event.data.snapshot as MiniPlayerSnapshot);
      }
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKeys.miniPlayerSnapshot) {
        setSnapshot(readMiniPlayerSnapshot());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    setArtworkFailed(false);
  }, [track?.id]);

  async function closeMiniPlayer() {
    try {
      const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      await getCurrentWebviewWindow().close();
    } catch {
      window.close();
    }
  }

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#19130f] text-white">
      <div className="grid h-full grid-cols-[84px_minmax(0,1fr)_92px] items-center gap-3 p-3">
        <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded border border-line bg-panel text-moss shadow-inner">
          {artworkSrc && !artworkFailed ? (
            <img alt="" className="h-full w-full object-cover" src={artworkSrc} onError={() => setArtworkFailed(true)} />
          ) : (
            <Coffee size={26} />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold">{track ? display(track.title, "Untitled") : "Nothing playing"}</div>
            {track?.rating !== null && track?.rating !== undefined && (
              <span className="shrink-0 rounded border border-moss/40 px-1.5 py-0.5 text-[10px] text-moss">
                {track.rating} star
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted">
            {track ? `${display(track.artist)} - ${display(track.album, "Unknown album")}` : "Use the main window to start a queue"}
          </div>
          <div className="mt-3 grid grid-cols-[38px_1fr_38px] items-center gap-2 text-[11px] tabular-nums text-muted">
            <span className="text-right">{formatPlaybackTime(snapshot.currentTime)}</span>
            <input
              aria-label="Mini player position"
              className="player-progress"
              disabled={!track || duration <= 0}
              max={Math.max(duration, 0)}
              min={0}
              step={1}
              style={{ "--progress": `${progressPercent}%` } as CSSProperties}
              type="range"
              value={duration > 0 ? Math.min(snapshot.currentTime, duration) : 0}
              onChange={(event) => sendMiniPlayerCommand({ type: "seek", seconds: Number(event.target.value) })}
            />
            <span>{formatPlaybackTime(duration)}</span>
          </div>
        </div>
        <div className="flex h-full flex-col items-end justify-between">
          <button className="icon-button h-7 w-7" type="button" title="Close mini player" onClick={() => void closeMiniPlayer()}>
            <X size={13} />
          </button>
          <div className="flex items-center gap-1.5">
            <button
              className="icon-button h-8 w-8"
              type="button"
              title="Previous"
              disabled={!snapshot.hasPrevious}
              onClick={() => sendMiniPlayerCommand({ type: "previous" })}
            >
              <SkipBack size={14} />
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-full bg-ember text-ink shadow-sm shadow-black/25 disabled:opacity-50"
              type="button"
              title={snapshot.isPlaying ? "Pause" : "Play"}
              disabled={!track}
              onClick={() => sendMiniPlayerCommand({ type: "playPause" })}
            >
              {snapshot.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <button
              className="icon-button h-8 w-8"
              type="button"
              title="Next"
              disabled={!snapshot.hasNext}
              onClick={() => sendMiniPlayerCommand({ type: "next" })}
            >
              <SkipForward size={14} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function PlayerBar({
  currentTrack,
  queue,
  onSelectTrack,
  onTrackEnded,
  onTrackSkipped,
  onPlaybackTime,
  onRating,
  autoPlay,
  fadeMs,
  miniPlayer,
  playbackMode,
  setPlaybackMode,
  onOpenMiniPlayer,
  setStatus,
}: {
  currentTrack: Track | null;
  queue: Track[];
  onSelectTrack: (track: Track, queue: Track[]) => void;
  onTrackEnded: (trackId: number) => Promise<void>;
  onTrackSkipped: (trackId: number) => Promise<void>;
  onPlaybackTime: (seconds: number) => void;
  onRating: (trackId: number, rating: number | null) => void;
  autoPlay: boolean;
  fadeMs: number;
  miniPlayer: boolean;
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;
  onOpenMiniPlayer: () => void | Promise<void>;
  setStatus: (message: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const crossfadeTimerRef = useRef<number | null>(null);
  const endFadeTrackRef = useRef<number | null>(null);
  const crossfadeTrackRef = useRef<number | null>(null);
  const handoffRef = useRef<{ trackId: number; currentTime: number } | null>(null);
  const smtcActionRef = useRef<(payload: SmtcButtonPayload) => void>(() => {});
  const miniPlayerChannelRef = useRef<BroadcastChannel | null>(null);
  const miniPlayerCommandRef = useRef<(command: MiniPlayerCommand) => void>(() => {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const currentIndex = currentTrack ? queue.findIndex((track) => track.id === currentTrack.id) : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < queue.length - 1;
  const preloadedNextTrack =
    hasNext ? queue[currentIndex + 1] : playbackMode === "repeatQueue" && queue.length > 0 ? queue[0] : null;
  const effectiveDuration = duration || currentTrack?.duration_seconds || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;
  const smtcPositionSecond = Math.floor(currentTime);
  const trackSwitchFadeMs = Math.min(fadeMs, 160);

  useEffect(() => {
    return () => {
      cancelFade();
      cancelCrossfade();
      miniPlayerChannelRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return;
    }
    const channel = new BroadcastChannel(miniPlayerChannelName);
    miniPlayerChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type !== "command") {
        return;
      }
      miniPlayerCommandRef.current(event.data.command as MiniPlayerCommand);
    };
    return () => {
      if (miniPlayerChannelRef.current === channel) {
        miniPlayerChannelRef.current = null;
      }
      channel.close();
    };
  }, []);

  useEffect(() => {
    const audio = nextAudioRef.current;
    if (audio) {
      audio.load();
    }
  }, [preloadedNextTrack?.id]);

  function cancelFade() {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }

  function cancelCrossfade() {
    if (crossfadeTimerRef.current !== null) {
      window.clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
  }

  function fadeVolume(targetVolume: number, durationMs: number, afterFade?: () => void) {
    const audio = audioRef.current;
    if (!audio) {
      afterFade?.();
      return;
    }
    cancelFade();
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));
    const startVolume = audio.volume;
    if (durationMs <= 0) {
      audio.volume = clampedTarget;
      afterFade?.();
      return;
    }
    const startedAt = window.performance.now();
    fadeTimerRef.current = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      audio.volume = startVolume + (clampedTarget - startVolume) * progress;
      if (progress >= 1) {
        cancelFade();
        afterFade?.();
      }
    }, 16);
  }

  async function startCrossfade(nextTrack: Track) {
    const currentAudio = audioRef.current;
    const nextAudio = nextAudioRef.current;
    if (!currentTrack || !currentAudio || !nextAudio || currentAudio.paused || crossfadeTrackRef.current === currentTrack.id) {
      return;
    }

    crossfadeTrackRef.current = currentTrack.id;
    cancelFade();
    cancelCrossfade();

    try {
      nextAudio.currentTime = 0;
      nextAudio.volume = 0;
      await nextAudio.play();
    } catch {
      crossfadeTrackRef.current = null;
      return;
    }

    const durationMs = Math.max(120, fadeMs);
    const startedAt = window.performance.now();
    crossfadeTimerRef.current = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      currentAudio.volume = Math.max(0, 1 - progress);
      nextAudio.volume = Math.min(1, progress);

      if (progress >= 1) {
        cancelCrossfade();
        handoffRef.current = { trackId: nextTrack.id, currentTime: nextAudio.currentTime };
        currentAudio.pause();
        currentAudio.volume = 1;
        void onTrackEnded(currentTrack.id);
        onSelectTrack(nextTrack, queue);
      }
    }, 16);
  }

  async function playWithFade() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    cancelFade();
    audio.volume = 0;
    try {
      await audio.play();
      setIsPlaying(true);
      fadeVolume(1, fadeMs);
    } catch (error: unknown) {
      audio.volume = 1;
      if (audio.error) {
        setStatus("Audio source failed to load. Restart the app if the backend was updated recently.");
        return;
      }
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setStatus("Press play to start playback.");
        return;
      }
      setStatus("Playback could not start for this file.");
    }
  }

  function pauseWithFade() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    fadeVolume(0, fadeMs, () => {
      audio.pause();
      audio.volume = 1;
      setIsPlaying(false);
    });
  }

  useEffect(() => {
    cancelFade();
    setCurrentTime(0);
    onPlaybackTime(0);
    setDuration(currentTrack?.duration_seconds ?? 0);
    setArtworkFailed(false);
    setIsPlaying(false);
    endFadeTrackRef.current = null;
    crossfadeTrackRef.current = null;

    if (!currentTrack) {
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const handoff = handoffRef.current;
    if (handoff?.trackId === currentTrack.id) {
      handoffRef.current = null;
      audio.currentTime = handoff.currentTime;
      audio.volume = 1;
      void audio.play().then(() => setIsPlaying(true)).catch(() => {
        setStatus("Playback could not continue after crossfade.");
      });
      return;
    }
    if (autoPlay) {
      void playWithFade();
    }
  }, [currentTrack?.id, autoPlay]);

  function syncDuration() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    setDuration(Number.isFinite(audio.duration) ? audio.duration : currentTrack?.duration_seconds ?? 0);
  }

  function handleSeek(event: ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    seekTo(nextTime);
  }

  function seekTo(nextTime: number) {
    const audio = audioRef.current;
    const boundedTime =
      effectiveDuration > 0 ? Math.min(Math.max(0, nextTime), effectiveDuration) : Math.max(0, nextTime);
    setCurrentTime(boundedTime);
    onPlaybackTime(boundedTime);
    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = boundedTime;
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }
    if (audio.paused) {
      await playWithFade();
    } else {
      pauseWithFade();
    }
  }

  function playRelative(offset: number) {
    const nextTrack = queue[currentIndex + offset];
    if (nextTrack) {
      const audio = audioRef.current;
      cancelCrossfade();
      crossfadeTrackRef.current = null;
      nextAudioRef.current?.pause();
      if (audio && !audio.paused) {
        fadeVolume(0, trackSwitchFadeMs, () => {
          audio.pause();
          try {
            audio.currentTime = 0;
          } catch {
            // Some codecs do not permit seeking during teardown.
          }
          onSelectTrack(nextTrack, queue);
        });
      } else {
        cancelFade();
        onSelectTrack(nextTrack, queue);
      }
    }
  }

  async function skipCurrent() {
    if (!currentTrack) {
      return;
    }
    await onTrackSkipped(currentTrack.id);
    if (hasNext) {
      playRelative(1);
    } else {
      const audio = audioRef.current;
      audio?.pause();
      setIsPlaying(false);
    }
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const nextTime = audio.currentTime;
    setCurrentTime(nextTime);
    onPlaybackTime(nextTime);
    const audioDuration = Number.isFinite(audio.duration) ? audio.duration : effectiveDuration;
    const crossfadeLeadSeconds = Math.max(0.12, fadeMs / 1000);
    if (
      currentTrack &&
      preloadedNextTrack &&
      playbackMode !== "stopAfterCurrent" &&
      playbackMode !== "repeatOne" &&
      fadeMs > 0 &&
      audioDuration > crossfadeLeadSeconds * 2 &&
      audioDuration - nextTime <= crossfadeLeadSeconds &&
      crossfadeTrackRef.current !== currentTrack.id
    ) {
      void startCrossfade(preloadedNextTrack);
      return;
    }
    if (
      currentTrack &&
      (!preloadedNextTrack || playbackMode === "stopAfterCurrent") &&
      audioDuration > END_FADE_SECONDS * 2 &&
      audioDuration - nextTime <= END_FADE_SECONDS &&
      endFadeTrackRef.current !== currentTrack.id
    ) {
      endFadeTrackRef.current = currentTrack.id;
      const fadeGuardMs = 100;

      const remainingMs = Math.max(0, (audioDuration - nextTime) * 1000);
      const fadeDuration = Math.min(fadeMs, Math.max(0, remainingMs - fadeGuardMs));

      fadeVolume(0, fadeDuration);
    }
  }

  async function handleEnded() {
    if (!currentTrack) {
      return;
    }
    if (crossfadeTrackRef.current === currentTrack.id) {
      return;
    }
    await onTrackEnded(currentTrack.id);
    if (playbackMode === "stopAfterCurrent") {
      setIsPlaying(false);
      setStatus("Stopped after current track");
      return;
    }
    if (playbackMode === "repeatOne") {
      seekTo(0);
      void playWithFade();
      return;
    }
    if (hasNext) {
      onSelectTrack(queue[currentIndex + 1], queue);
    } else if (playbackMode === "repeatQueue" && queue.length > 0) {
      onSelectTrack(queue[0], queue);
    } else {
      setStatus("Queue finished");
    }
  }

  const artworkSrc = currentTrack && !artworkFailed ? albumArtworkUrl(currentTrack.id) : null;

  miniPlayerCommandRef.current = (command: MiniPlayerCommand) => {
    if (command.type === "playPause") {
      void togglePlayback();
    } else if (command.type === "previous") {
      playRelative(-1);
    } else if (command.type === "next") {
      playRelative(1);
    } else if (command.type === "seek") {
      seekTo(command.seconds);
    }
  };

  smtcActionRef.current = (payload: SmtcButtonPayload) => {
    if (payload.command === "play") {
      if (currentTrack && audioRef.current?.paused) {
        void playWithFade();
      }
      return;
    }
    if (payload.command === "pause") {
      if (currentTrack && !audioRef.current?.paused) {
        pauseWithFade();
      }
      return;
    }
    if (payload.command === "stop") {
      pauseWithFade();
      seekTo(0);
      return;
    }
    if (payload.command === "next") {
      if (hasNext) {
        playRelative(1);
      }
      return;
    }
    if (payload.command === "previous") {
      if (currentTime > 4) {
        seekTo(0);
      } else if (hasPrevious) {
        playRelative(-1);
      }
      return;
    }
    if (payload.command === "seek" && typeof payload.position_seconds === "number") {
      seekTo(payload.position_seconds);
    }
  };

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listenForSmtcButtons((payload) => smtcActionRef.current(payload)).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    void updateSmtcState({
      track: currentTrack,
      isPlaying,
      positionSeconds: smtcPositionSecond,
      durationSeconds: effectiveDuration,
      canPrevious: hasPrevious,
      canNext: hasNext,
    }).catch(() => {
      // SMTC is best-effort; playback should never depend on Windows media UI.
    });
  }, [currentTrack, isPlaying, smtcPositionSecond, effectiveDuration, hasPrevious, hasNext]);

  useEffect(() => {
    publishMiniPlayerSnapshot(miniPlayerChannelRef.current, {
      track: currentTrack ? miniPlayerTrackSnapshot(currentTrack) : null,
      isPlaying,
      currentTime,
      duration: effectiveDuration,
      hasPrevious,
      hasNext,
      updatedAt: new Date().toISOString(),
    });
  }, [currentTrack, isPlaying, smtcPositionSecond, effectiveDuration, hasPrevious, hasNext]);

  useEffect(() => {
    return () => {
      void clearSmtcState();
    };
  }, []);

  return (
    <section className={`grid shrink-0 grid-cols-[minmax(240px,360px)_1fr_minmax(150px,210px)] items-center gap-5 border-t border-line bg-[#19130f] px-4 ${miniPlayer ? "h-20" : "h-28"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded border border-line bg-panel text-moss shadow-inner">
          {artworkSrc ? (
            <img
              key={artworkSrc}
              alt=""
              className="h-full w-full object-cover"
              src={artworkSrc}
              onError={() => setArtworkFailed(true)}
            />
          ) : (
            <Volume2 size={22} />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {currentTrack ? display(currentTrack.title, "Untitled") : "Nothing playing"}
          </div>
          <div className="truncate text-xs text-muted">
            {currentTrack
              ? `${display(currentTrack.artist)} - ${display(currentTrack.album, "Unknown album")}`
              : "Select a track from Library or AutoDJ"}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-center gap-3">
          <button
            className="icon-button"
            type="button"
            title="Previous track"
            disabled={!hasPrevious}
            onClick={() => playRelative(-1)}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-full bg-ember text-ink shadow-sm shadow-black/25 transition hover:bg-[#efb66f] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            title={isPlaying ? "Pause" : "Play"}
            disabled={!currentTrack}
            onClick={togglePlayback}
          >
            {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
          </button>
          <button
            className="icon-button"
            type="button"
            title="Next track"
            disabled={!hasNext}
            onClick={() => playRelative(1)}
          >
            <SkipForward size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Skip and learn"
            disabled={!currentTrack}
            onClick={() => void skipCurrent()}
          >
            <CheckCircle2 size={17} />
          </button>
        </div>

        {currentTrack ? (
          <audio
            key={currentTrack.id}
            ref={audioRef}
            className="hidden"
            preload="auto"
            src={audioUrl(currentTrack.id)}
            onLoadedMetadata={syncDuration}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onCanPlay={() => {
              syncDuration();
            }}
            onEnded={handleEnded}
            onError={() => {
              const code = audioRef.current?.error?.code;
              const message =
                code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                  ? "This file or stream could not be played by the current WebView codec stack."
                  : "Audio source failed to load. The backend may need a restart, or the file may be missing.";
              setStatus(message);
            }}
          />
        ) : (
          <audio ref={audioRef} className="hidden" />
        )}
        {preloadedNextTrack && (
          <audio
            key={`next-${preloadedNextTrack.id}`}
            ref={nextAudioRef}
            className="hidden"
            preload="auto"
            src={audioUrl(preloadedNextTrack.id)}
          />
        )}

        <div className="grid grid-cols-[42px_1fr_42px] items-center gap-3 text-xs tabular-nums text-muted">
          <span className="text-right">{formatPlaybackTime(currentTime)}</span>
          <input
            aria-label="Playback position"
            className="player-progress"
            disabled={!currentTrack || effectiveDuration <= 0}
            max={Math.max(effectiveDuration, 0)}
            min={0}
            step={1}
            style={{ "--progress": `${progressPercent}%` } as CSSProperties}
            type="range"
            value={effectiveDuration > 0 ? Math.min(currentTime, effectiveDuration) : 0}
            onChange={handleSeek}
          />
          <span>{formatPlaybackTime(effectiveDuration)}</span>
        </div>
      </div>

      <div className="min-w-0 text-right text-xs text-muted">
        {currentTrack && (
          <>
            <div className="truncate">{display(trackGenre(currentTrack), "")}</div>
            <div className="mt-1 truncate text-neutral-400">{display(currentTrack.year, "")}</div>
          </>
        )}
        {currentTrack && (
          <div className="mt-2 flex justify-end">
            <RatingStars rating={currentTrack.rating} onChange={(rating) => onRating(currentTrack.id, rating)} />
          </div>
        )}
        <div className="mt-2 flex justify-end gap-1">
          <button
            className="icon-button h-7 w-7"
            type="button"
            title="Open detached mini player"
            onClick={() => void onOpenMiniPlayer()}
          >
            <ExternalLink size={13} />
          </button>
          <button
            className={`icon-button h-7 w-7 ${
              playbackMode === "repeatQueue" || playbackMode === "repeatOne" ? "border-moss text-moss" : ""
            }`}
            type="button"
            title={playbackMode === "repeatOne" ? "Repeat one" : "Repeat queue"}
            onClick={() =>
              setPlaybackMode(
                playbackMode === "normal"
                  ? "repeatQueue"
                  : playbackMode === "repeatQueue"
                    ? "repeatOne"
                    : "normal",
              )
            }
          >
            <Repeat size={13} />
          </button>
          <button
            className={`icon-button h-7 w-7 ${playbackMode === "stopAfterCurrent" ? "border-ember text-ember" : ""}`}
            type="button"
            title="Stop after current"
            onClick={() => setPlaybackMode(playbackMode === "stopAfterCurrent" ? "normal" : "stopAfterCurrent")}
          >
            <CircleStop size={13} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  if (new URLSearchParams(window.location.search).get("miniPlayer") === "1") {
    return <MiniPlayerWindow />;
  }

  const [activePage, setActivePage] = useState<Page>(() => readUiPreferences().startupPage);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [autoDjAvoidRules, setAutoDjAvoidRules] = useState<AutoDjAvoidRule[]>([]);
  const [recommendationProfiles, setRecommendationProfiles] = useState<RecommendationProfile[]>([]);
  const [recommendationDrift, setRecommendationDrift] = useState<RecommendationDrift>(emptyRecommendationDrift);
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
  const [detailTrack, setDetailTrack] = useState<Track | null>(null);
  const [metadataEditTrack, setMetadataEditTrack] = useState<Track | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<DeleteTrackPrompt | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [autoPlayOnTrackChange, setAutoPlayOnTrackChange] = useState(false);
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [queueHistory, setQueueHistory] = useState<Track[][]>([]);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("normal");
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [hasMoreTracks, setHasMoreTracks] = useState(true);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
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
      const existing = await WebviewWindow.getByLabel("mini-player");
      if (existing) {
        await existing.setFocus();
        return;
      }
      const miniWindow = new WebviewWindow("mini-player", {
        title: "FLAC Cafe Mini Player",
        url: "/index.html?miniPlayer=1",
        width: 560,
        height: 128,
        minWidth: 420,
        minHeight: 118,
        resizable: true,
        decorations: true,
      });
      miniWindow.once("tauri://error", (event) => {
        setStatus(`Could not open mini player: ${String(event.payload)}`);
      });
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

  async function handleScan() {
    if (!folderPath.trim()) {
      setStatus("Enter a music folder path");
      return;
    }
    setStatus("Starting library scan");
    setIsScanning(true);
    setScanResult(null);
    setScanProgress(null);
    try {
      const started = await startScanLibrary(folderPath.trim());
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

  function handlePlayTrack(track: Track, queueItems: Track[]) {
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

  async function handleClearArtistCache() {
    try {
      const response = await clearArtistCache();
      setArtistInfo(null);
      setStatus(`Cleared ${response.deleted} cached artist records`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not clear artist cache");
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
    document.documentElement.style.setProperty("--color-ember", accent.ember);
    document.documentElement.style.setProperty("--color-moss", accent.moss);
    document.documentElement.style.fontSize = fontScaleValues[uiPreferences.fontScale] ?? fontScaleValues.default;
    document.documentElement.dataset.density = uiPreferences.density;
  }, [uiPreferences.themeAccent, uiPreferences.fontScale, uiPreferences.density]);

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
  }, [activePage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }
      const shortcuts: Record<string, Page> = {
        "1": "library",
        "2": "analysis",
        "3": "nowPlaying",
        "4": "artist",
        "5": "history",
        "6": "autodj",
        "7": "settings",
      };
      const page = shortcuts[event.key];
      if (page) {
        event.preventDefault();
        setActivePage(page);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    <div className="flex h-screen overflow-hidden bg-ink text-neutral-100">
      {uiPreferences.showToasts && status && (
        <div className="fixed right-5 top-5 z-50 max-w-md rounded border border-line bg-panel px-4 py-3 text-sm text-white shadow-xl">
          {status}
        </div>
      )}
      {undoAction && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded border border-line bg-[#211a15] px-4 py-3 text-sm text-white shadow-2xl">
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
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        hasDiagnosticsIssue={Boolean(startupDiagnostics && !startupDiagnostics.ok)}
        hasAnalysisIssue={Boolean(
          clapStatus &&
            ((clapStatus.runtime_exists && !clapStatus.installed) ||
              Object.keys(clapStatus.dependency_errors ?? {}).length > 0),
        )}
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
              onDeleteTracks={handleDeleteTracks}
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
              showQuickStart={libraryTotal === 0 && !quickStartDismissed}
              onDismissQuickStart={dismissQuickStart}
              onOpenSettings={() => setActivePage("settings")}
              onOpenAnalysis={() => setActivePage("analysis")}
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
              onRefreshProfiles={loadRecommendationProfiles}
              onSaveRecommendationProfile={handleSaveRecommendationProfile}
              onDeleteRecommendationProfile={handleDeleteRecommendationProfile}
              onSetDefaultRecommendationProfile={handleSetDefaultRecommendationProfile}
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
          miniPlayer={uiPreferences.playerLayout === "compact" || uiPreferences.miniPlayer}
          playbackMode={playbackMode}
          setPlaybackMode={setPlaybackMode}
          onOpenMiniPlayer={handleOpenDetachedMiniPlayer}
          setStatus={setStatus}
        />
      </div>
    </div>
  );
}
