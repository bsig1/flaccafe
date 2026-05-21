import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect } from "react";

import type { FontChoice,ThemeAccent } from "../config/theme";
import { fontChoiceLabels } from "../config/theme";
import {
  limitRecentItems,
  readBooleanFlag,
  writeBooleanFlag,
} from "../lib/uiInteractions";
import type {
  AudioAnalysisProgress,
  AutoDjSettings,
  ClapInstallProgress,
  QueueTrack,
  RecommendationDrift,
  Track,
} from "../types/api";

export type Page = "library" | "analysis" | "nowPlaying" | "artist" | "history" | "autodj" | "settings";
export type LibraryView = "tracks" | "albums" | "playlists" | "smart" | "health";
export type BackendStatus = "unknown" | "ok" | "down" | "restarting";
export type PlaybackMode = "normal" | "repeatOne" | "repeatQueue" | "stopAfterCurrent";
export type SortDirection = "asc" | "desc";
export type UiDensity = "comfortable" | "compact";
export type FontScale = "small" | "default" | "large";
export type AutoDjExperience = "simple" | "advanced";
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
export type LibraryColumnKey = "play" | MetadataColumnKey;
export type HistoryColumnKey = "event" | "track" | "artist" | "album" | "when";

export interface LibraryColumnDefinition {
  key: MetadataColumnKey;
  label: string;
  category: "Default" | "Metadata" | "Listening" | "Analysis" | "File";
  defaultWidth: number;
  sortKey?: SortKey;
  align?: "left" | "right";
}

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface TrackContextMenu {
  track: Track;
  x: number;
  y: number;
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
  | { type: "seek"; seconds: number };

export interface DeleteTrackPrompt {
  trackIds: number[];
  title: string;
  allowFileDelete: boolean;
}

export type RememberedDeleteChoice = "library" | "file";

export interface UiPreferences {
  hideFilePaths: boolean;
  compactLibraryRows: boolean;
  defaultQueueLength: number;
  defaultTemperature: number;
  similarityWeight: number;
  playerFadeMs: number;
  skipThresholdPercent: number;
  startupPage: Page;
  albumGrid: boolean;
  showToasts: boolean;
  miniPlayer: boolean;
  themeAccent: ThemeAccent;
  density: UiDensity;
  fontScale: FontScale;
  fontChoice: FontChoice;
  enableArtistLookup: boolean;
  libraryVisibleColumns: MetadataColumnKey[];
}

export interface AutoDjTemplate {
  id: string;
  name: string;
  settings: AutoDjSettings;
}

export type UndoAction =
  | { type: "library-remove"; label: string; tracks: Track[] }
  | { type: "playlist-remove"; label: string; playlistId: number; trackIds: number[] };

export const LIBRARY_PAGE_SIZE = 150;
export const DEFAULT_FADE_MS = 150;
export const END_FADE_SECONDS = 1;
export const QUEUE_HISTORY_LIMIT = 12;
export const TRACK_CONTEXT_MENU_WIDTH = 224;
export const TRACK_CONTEXT_MENU_HEIGHT = 560;
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

export const storageKeys = {
  uiPreferences: "flac-cafe-ui-preferences",
  hideFilePaths: "flac-cafe-hide-file-paths",
  lastSession: "flac-cafe-last-session",
  deleteChoice: "flac-cafe-delete-choice",
  quickStartDismissed: "flac-cafe-quick-start-dismissed",
  autoDjTemplates: "flac-cafe-autodj-templates",
  miniPlayerSnapshot: "flac-cafe-mini-player-snapshot",
  playerVolume: "flac-cafe-player-volume",
  playerMuted: "flac-cafe-player-muted",
} as const;
export const legacyStorageKeys = {
  uiPreferences: "local-autodj-ui-preferences",
  hideFilePaths: "local-autodj-hide-file-paths",
  lastSession: "local-autodj-last-session",
} as const;

export const defaultLibraryVisibleColumns: MetadataColumnKey[] = [
  "title",
  "artist",
  "album",
  "genre",
  "rating",
  "duration_seconds",
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

export const libraryColumnKeys = libraryColumnDefinitions.map((column) => column.key);
export const libraryColumnKeySet = new Set<MetadataColumnKey>(libraryColumnKeys);
export const librarySelectionColumnWidth = 44;
export const miniPlayerChannelName = "flac-cafe-mini-player";

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

export const defaultHistoryColumnWidths: Record<HistoryColumnKey, number> = {
  event: 128,
  track: 360,
  artist: 220,
  album: 260,
  when: 220,
};

export const defaultAutoDj: AutoDjSettings = {
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

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 0) {
    return "--:--";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function display(value: string | number | null | undefined, fallback = "Unknown"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

export function trackGenre(track: Track | null | undefined): string | null {
  return track?.analysis_genre ?? track?.genre ?? null;
}

export function miniPlayerTrackSnapshot(track: Track): MiniPlayerTrackSnapshot {
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

export function emptyMiniPlayerSnapshot(): MiniPlayerSnapshot {
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

export function readMiniPlayerSnapshot(): MiniPlayerSnapshot {
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

export function publishMiniPlayerSnapshot(channel: BroadcastChannel | null, snapshot: MiniPlayerSnapshot) {
  try {
    window.localStorage.setItem(storageKeys.miniPlayerSnapshot, JSON.stringify(snapshot));
  } catch {
    // The detached mini-player is best-effort; local storage can be disabled.
  }
  channel?.postMessage({ type: "snapshot", snapshot });
}

export function sendMiniPlayerCommand(command: MiniPlayerCommand) {
  if (!("BroadcastChannel" in window)) {
    return;
  }
  const channel = new BroadcastChannel(miniPlayerChannelName);
  channel.postMessage({ type: "command", command });
  channel.close();
}

export function analysisTags(track: Track | null | undefined): Array<[string, number]> {
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

export function analysisError(track: Track | null | undefined): string | null {
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

export function isClapAnalyzed(track: Track | null | undefined): boolean {
  return track?.analysis_provider === "clap" && Boolean(track.analysis_updated_at);
}

export function isAnalysisTerminal(status: AudioAnalysisProgress["status"] | null | undefined): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

export function isClapInstallTerminal(status: ClapInstallProgress["status"] | null | undefined): boolean {
  return status === "completed" || status === "failed";
}

export function reasonChips(reason: string): string[] {
  return reason
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function reasonChipClass(reason: string): string {
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

export function breakdownEntries(track: QueueTrack): Array<[string, number]> {
  return Object.entries(track.score_breakdown ?? {})
    .filter(([key]) => key !== "total")
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Math.abs(entry[1]) > 0.001)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "unrated";
  }
  const text = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${text} star${value === 1 ? "" : "s"}`;
}

export function formatTime(seconds: number | null | undefined): string {
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

export function formatBitrate(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) {
    return "-";
  }
  return `${Math.round(value / 1000).toLocaleString()} kbps`;
}

export function formatFingerprint(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return value.length > 14 ? value.slice(0, 14) : value;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function parseLyricTimestamp(line: string): number | null {
  const match = line.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?]/);
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ? Number(`0.${match[3].padEnd(3, "0").slice(0, 3)}`) : 0;
  return minutes * 60 + seconds + fraction;
}

export function stripLyricTimestamp(line: string): string {
  return line.replace(/^\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?]\s*/, "");
}

export function fileName(path: string | null): string {
  if (!path) {
    return "";
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function fileExtension(path: string | null): string {
  const name = fileName(path);
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export function supportsFileTagWriting(path: string | null): boolean {
  return new Set([".flac", ".mp3", ".m4a", ".mp4", ".ogg", ".opus"]).has(fileExtension(path));
}

export function primaryArtistName(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .split(/[;|]/)[0]
    .replace(/\s+\b(feat\.?|featuring|with)\b\s+.*$/i, "")
    .trim();
}

export function normalizeLibraryColumns(value: unknown): MetadataColumnKey[] {
  if (!Array.isArray(value)) {
    return defaultLibraryVisibleColumns;
  }

  const cleaned = value.filter((column): column is MetadataColumnKey => libraryColumnKeySet.has(column as MetadataColumnKey));
  const unique = Array.from(new Set(cleaned));
  return unique.length > 0 ? unique : defaultLibraryVisibleColumns;
}

export function readRememberedDeleteChoice(): RememberedDeleteChoice | null {
  try {
    const value = window.localStorage.getItem(storageKeys.deleteChoice);
    return value === "library" || value === "file" ? value : null;
  } catch {
    return null;
  }
}

export function writeRememberedDeleteChoice(choice: RememberedDeleteChoice) {
  try {
    window.localStorage.setItem(storageKeys.deleteChoice, choice);
  } catch {
    // Remembering delete preference is a convenience only.
  }
}

export function readQuickStartDismissed(): boolean {
  return readBooleanFlag(window.localStorage, storageKeys.quickStartDismissed, false);
}

export function writeQuickStartDismissed() {
  writeBooleanFlag(window.localStorage, storageKeys.quickStartDismissed, true);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getListenedPercent(listenedSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) {
    return 0;
  }
  return clampNumber((Math.max(0, listenedSeconds) / durationSeconds) * 100, 0, 100);
}

// Keep skip/play accounting in one place so manual track changes and player controls learn the same way.
export function shouldRecordTrackAsPlayed(
  listenedSeconds: number,
  durationSeconds: number,
  skipThresholdPercent: number,
): boolean {
  return getListenedPercent(listenedSeconds, durationSeconds) >= skipThresholdPercent;
}

export function readStoredVolume(): number {
  try {
    const raw = window.localStorage.getItem(storageKeys.playerVolume);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? clampNumber(parsed, 0, 1) : 1;
  } catch {
    return 1;
  }
}

export function readStoredMuted(): boolean {
  try {
    return window.localStorage.getItem(storageKeys.playerMuted) === "true";
  } catch {
    return false;
  }
}

export function writeStoredAudioControls(volume: number, muted: boolean) {
  try {
    window.localStorage.setItem(storageKeys.playerVolume, String(clampNumber(volume, 0, 1)));
    window.localStorage.setItem(storageKeys.playerMuted, String(muted));
  } catch {
    // Local audio controls are still useful for the current session.
  }
}

export function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
}

export function rangeStepPrecision(step: string): number {
  if (!step || step === "any") {
    return 2;
  }
  const [, decimal = ""] = step.split(".");
  return Math.min(6, decimal.length);
}

export function useRangeWheelControls() {
  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      if (!input || input.type !== "range" || input.disabled) {
        return;
      }

      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const step = input.step && input.step !== "any" ? Number(input.step) : 1;
      const current = Number(input.value);
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || !Number.isFinite(current)) {
        return;
      }

      event.preventDefault();
      const direction = event.deltaY < 0 || event.deltaX < 0 ? 1 : -1;
      const multiplier = event.shiftKey ? 10 : event.altKey ? 0.25 : 1;
      const precision = rangeStepPrecision(input.step);
      const next = clampNumber(current + direction * step * multiplier, min, max);
      setNativeInputValue(input, next.toFixed(precision));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);
}

export function beginPointerReorderDrag({
  event,
  fromIndex,
  onHover,
  onCommit,
  onPosition,
}: {
  event: ReactPointerEvent<HTMLElement>;
  fromIndex: number;
  onHover: (index: number | null) => void;
  onCommit: (fromIndex: number, toIndex: number) => void;
  onPosition?: (position: { x: number; y: number } | null) => void;
}) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  let overIndex = fromIndex;
  onHover(fromIndex);
  onPosition?.({ x: event.clientX, y: event.clientY });
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is best-effort; document hit-testing below still handles the drag.
  }

  // Hit-test by data attribute instead of relying on drag events; WebView drag/drop is inconsistent in dense tables.
  function updateOverIndex(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const row = element?.closest<HTMLElement>("[data-reorder-index]");
    if (!row) {
      return;
    }
    const nextIndex = Number(row.dataset.reorderIndex);
    if (!Number.isInteger(nextIndex)) {
      return;
    }
    overIndex = nextIndex;
    onHover(nextIndex);
  }

  function cleanup() {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleCancel);
  }

  function handleMove(pointerEvent: PointerEvent) {
    onPosition?.({ x: pointerEvent.clientX, y: pointerEvent.clientY });
    updateOverIndex(pointerEvent.clientX, pointerEvent.clientY);
  }

  function handleUp(pointerEvent: PointerEvent) {
    onPosition?.({ x: pointerEvent.clientX, y: pointerEvent.clientY });
    updateOverIndex(pointerEvent.clientX, pointerEvent.clientY);
    cleanup();
    onHover(null);
    onPosition?.(null);
    if (overIndex !== fromIndex) {
      onCommit(fromIndex, overIndex);
    }
  }

  function handleCancel() {
    cleanup();
    onHover(null);
    onPosition?.(null);
  }

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleCancel);
}

export function readUiPreferences(): UiPreferences {
  const defaults: UiPreferences = {
    hideFilePaths: true,
    compactLibraryRows: false,
    defaultQueueLength: 25,
    defaultTemperature: 0.8,
    similarityWeight: 1.4,
    playerFadeMs: DEFAULT_FADE_MS,
    skipThresholdPercent: 35,
    startupPage: "library",
    albumGrid: true,
    showToasts: true,
    miniPlayer: false,
    themeAccent: "cafe",
    density: "comfortable",
    fontScale: "default",
    fontChoice: "theme",
    enableArtistLookup: true,
    libraryVisibleColumns: defaultLibraryVisibleColumns,
  };
  try {
    const modern = window.localStorage.getItem(storageKeys.uiPreferences) ?? window.localStorage.getItem(legacyStorageKeys.uiPreferences);
    if (modern) {
      const parsed = JSON.parse(modern) as Partial<UiPreferences> & { playerLayout?: string };
      // Older builds stored compact mode as playerLayout; keep honoring it while using one setting now.
      const legacyMiniPlayer = parsed.playerLayout === "compact";
      const validPages: Page[] = ["library", "analysis", "nowPlaying", "artist", "history", "autodj", "settings"];
      return {
        ...defaults,
        ...parsed,
        miniPlayer: typeof parsed.miniPlayer === "boolean" ? parsed.miniPlayer : legacyMiniPlayer,
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
        fontChoice: Object.keys(fontChoiceLabels).includes(parsed.fontChoice as FontChoice)
          ? (parsed.fontChoice as FontChoice)
          : defaults.fontChoice,
        skipThresholdPercent:
          typeof parsed.skipThresholdPercent === "number"
            ? clampNumber(parsed.skipThresholdPercent, 0, 95)
            : defaults.skipThresholdPercent,
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

export function readAutoDjTemplates(): AutoDjTemplate[] {
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

export function writeAutoDjTemplates(templates: AutoDjTemplate[]) {
  try {
    window.localStorage.setItem(storageKeys.autoDjTemplates, JSON.stringify(limitRecentItems(templates, 24)));
  } catch {
    // Templates are a convenience; failing to persist them should not block AutoDJ.
  }
}

export function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
