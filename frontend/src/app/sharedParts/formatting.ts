import type {
AudioAnalysisCoverage,
AudioAnalysisProgress,
ClapInstallProgress,
QueueTrack,
Track
} from "../../types/api";
import {
miniPlayerChannelName,
storageKeys,
} from "./constants";
import type {
MiniPlayerCommand,
MiniPlayerSnapshot,
MiniPlayerTrackSnapshot,
} from "./types";

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 0) {
    return "--:--";
  }
  const total = Math.round(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (days > 0) {
    return `${days}d ${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  }
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.round(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (days > 0) {
    return `${days}d ${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  }
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export interface StoredPlaybackSession {
  currentTrackId?: number | null;
  queueIds?: number[];
  positionSeconds?: number | null;
  savedAt?: string;
}

export function normalizePlaybackResumePosition(
  positionSeconds: unknown,
  durationSeconds: number | null | undefined,
): number | null {
  const position = typeof positionSeconds === "number" ? positionSeconds : Number(positionSeconds);
  if (!Number.isFinite(position) || position < 3) {
    return null;
  }

  const duration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) ? durationSeconds : 0;
  if (duration <= 0) {
    return Math.max(0, position);
  }

  const endGuardSeconds = Math.min(10, Math.max(3, duration * 0.04));
  if (position >= duration - endGuardSeconds) {
    return null;
  }
  return Math.min(Math.max(0, position), Math.max(0, duration - endGuardSeconds));
}

export function normalizeAudioAnalysisCoverage(
  coverage: AudioAnalysisCoverage | null,
  eligibleTrackTotal: number | null | undefined,
): AudioAnalysisCoverage | null {
  if (!coverage) {
    return null;
  }

  const eligibleTotal =
    typeof eligibleTrackTotal === "number" && Number.isFinite(eligibleTrackTotal) && eligibleTrackTotal >= 0
      ? Math.floor(eligibleTrackTotal)
      : null;
  if (eligibleTotal === null || coverage.total_tracks <= eligibleTotal) {
    return coverage;
  }

  // Older hot-reloaded backends may still report podcasts/audiobooks in CLAP totals.
  // The main library total is already filtered, so trim the stale excess from the
  // unanalyzed side before displaying coverage.
  const staleExtraTracks = coverage.total_tracks - eligibleTotal;
  const adjustedUnanalyzed = Math.max(
    0,
    Math.min(eligibleTotal, coverage.unanalyzed_tracks - staleExtraTracks),
  );
  const adjustedAnalyzed = Math.max(0, Math.min(eligibleTotal, eligibleTotal - adjustedUnanalyzed));
  const coveragePercent = eligibleTotal > 0 ? Math.round((adjustedAnalyzed / eligibleTotal) * 10000) / 100 : 0;

  return {
    ...coverage,
    total_tracks: eligibleTotal,
    analyzed_tracks: adjustedAnalyzed,
    unanalyzed_tracks: adjustedUnanalyzed,
    coverage_percent: coveragePercent,
  };
}

export function display(value: string | number | null | undefined, fallback = "Unknown"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

export const noAlbumToken = "__FLAC_CAFE_NO_ALBUM__";

export interface TrackAlbumDisplayLike {
  album?: string | null;
  artist?: string | null;
  genre?: string | null;
  analysis_genre?: string | null;
}

export function isNoAlbumValue(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return ["", noAlbumToken.toLowerCase(), "no album", "(no album)", "[no album]"].includes(normalized);
}

export function isPodcastLikeTrack(track: TrackAlbumDisplayLike | null | undefined): boolean {
  const genre = (track?.analysis_genre ?? track?.genre ?? "").toLowerCase();
  return genre.includes("podcast");
}

export function displayAlbumForTrack(track: TrackAlbumDisplayLike | null | undefined): string | null {
  const album = (track?.album ?? "").trim();
  if (isNoAlbumValue(album)) {
    return null;
  }
  if (isPodcastLikeTrack(track)) {
    const artist = (track?.artist ?? "").trim().toLowerCase();
    const normalizedAlbum = album.toLowerCase();
    if (normalizedAlbum === "podcast" || (artist && normalizedAlbum === artist)) {
      return null;
    }
  }
  return album;
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
    queue: [],
    currentIndex: -1,
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

export function analysisMoodTags(track: Track | null | undefined): Array<[string, number]> {
  if (!track?.analysis_mood_tags) {
    return [];
  }
  try {
    const parsed = JSON.parse(track.analysis_mood_tags) as Record<string, unknown>;
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
  return track?.analysis_provider === "clap" && Boolean(track.analysis_updated_at && track.analysis_embedding && track.analysis_mood_tags);
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

export function parseAppDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const sqliteUtcMatch = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed);
  const isoWithoutZoneMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed);
  const normalized = sqliteUtcMatch
    ? `${trimmed.replace(" ", "T")}Z`
    : isoWithoutZoneMatch
      ? `${trimmed}Z`
      : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = parseAppDate(value);
  return date === null ? value : date.toLocaleString();
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = parseAppDate(value);
  return date === null ? value : date.toLocaleDateString();
}

export function parseLyricTimestamp(line: string): number | null {
  const match = line.match(/^\[(\d+):(\d{2})(?:[.:](\d{1,3}))?]/);
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ? Number(`0.${match[3].padEnd(3, "0").slice(0, 3)}`) : 0;
  return minutes * 60 + seconds + fraction;
}

export function stripLyricTimestamp(line: string): string {
  return line
    .replace(/^\[\d+:\d{2}(?:[.:]\d{1,3})?]\s*/, "")
    .replace(/<\d+:\d{2}(?:[.:]\d{1,3})?>\s*/g, "");
}

export function isTimestampOnlyLyricLine(line: string): boolean {
  return parseLyricTimestamp(line) !== null && stripLyricTimestamp(line).trim().length === 0;
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
  return splitArtistNames(value)[0] ?? "";
}

const HARD_ARTIST_SEPARATOR = /\s+(?:featuring|feat\.?|ft\.?|with)\s+/gi;
const AMBIGUOUS_ARTIST_CONNECTOR = /\s+(?:&|\+|\u00d7|x)\s+/i;
const ARTIST_ARTICLE_PREFIX = /^(?:the|a|an)\s+/i;

function splitAmbiguousArtistConnectors(value: string): string[] {
  let remaining = value.trim();
  const names: string[] = [];

  while (remaining) {
    const match = remaining.match(AMBIGUOUS_ARTIST_CONNECTOR);
    if (!match || match.index === undefined) {
      names.push(remaining);
      break;
    }

    const left = remaining.slice(0, match.index).trim();
    const right = remaining.slice(match.index + match[0].length).trim();
    if (!left || !right || ARTIST_ARTICLE_PREFIX.test(right)) {
      names.push(remaining);
      break;
    }

    names.push(left);
    remaining = right;
  }

  return names.filter(Boolean);
}

export function splitArtistNames(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  const cleaned = value
    .replace(HARD_ARTIST_SEPARATOR, ";")
    .replace(/,/g, ";");
  const names = cleaned
    .split(/[;|]/)
    .flatMap(splitAmbiguousArtistConnectors)
    .filter(Boolean);
  return [...new Map(names.map((name) => [name.toLowerCase(), name])).values()];
}
