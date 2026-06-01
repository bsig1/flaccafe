import type {
AdvancedTrackSearchFilters,
AlbumSummary,
ArtistSummary,
LyricsLookupRequest,
LyricsResponse,
Track,
} from "../types/api";
import {
LIBRARY_PAGE_SIZE,
SortState,
display,
primaryArtistName,
storageKeys,
} from "./shared";

export const BACKEND_STARTUP_GRACE_MS = 18_000;
export const BACKEND_STARTUP_POLL_MS = 650;
export const DEFAULT_LIBRARY_SORT: SortState = { key: "artist", direction: "asc" };
export const CD_PLAYBACK_PREPARE_DEBOUNCE_MS = 180;

export interface StartupLibrarySnapshot {
  queryKey: string;
  total: number;
  tracks: Track[];
  savedAt: string;
}

function normalizeLinkMatchValue(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function findAlbumForTrack(albumList: AlbumSummary[], track: Track) {
  const trackAlbum = normalizeLinkMatchValue(track.album);
  if (!trackAlbum) {
    return null;
  }

  const artistCandidates = new Set(
    [track.album_artist, track.artist].map(normalizeLinkMatchValue).filter(Boolean),
  );
  const sameAlbum = albumList.filter((album) => normalizeLinkMatchValue(album.album) === trackAlbum);
  return (
    sameAlbum.find((album) => artistCandidates.has(normalizeLinkMatchValue(album.album_artist))) ??
    sameAlbum[0] ??
    null
  );
}

export function lyricsHaveText(response: LyricsResponse | null) {
  return Boolean(response?.lyrics?.trim());
}

export function shouldLookupLyricsByMetadata(track: Track | null) {
  return Boolean(track && (track.id <= 0 || track.is_preview || track.path.startsWith("cdda://")));
}

export function lyricsLookupRequestForTrack(track: Track): LyricsLookupRequest {
  const fileName = track.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "Untitled";
  return {
    track_id: track.id,
    title: track.title?.trim() || fileName,
    artist: track.artist?.trim() || track.album_artist?.trim() || null,
    album: track.album?.trim() || null,
    album_artist: track.album_artist?.trim() || null,
    duration_seconds: track.duration_seconds,
    path: track.path,
  };
}

export function cdDriveIdFromTrack(track: Track | null | undefined) {
  if (!track) {
    return null;
  }
  const pathMatch = track.path?.match(/^cdda:\/\/([^/]+)/);
  return pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : null;
}

export function cdTrackLooksActive(track: Track | null | undefined) {
  return Boolean(track?.path?.startsWith("cdda://"));
}

export function cdTrackNumberFromTrack(track: Track) {
  if (track.track_number && track.track_number > 0) {
    return track.track_number;
  }
  const pathMatch = track.path.match(/\/track\/(\d+)/i);
  return pathMatch?.[1] ? Number(pathMatch[1]) : null;
}

export class StaleCdPlaybackRequestError extends Error {
  constructor() {
    super("Stale CD playback request");
    this.name = "StaleCdPlaybackRequestError";
  }
}

export function isStaleCdPlaybackRequest(error: unknown) {
  return error instanceof StaleCdPlaybackRequestError;
}

export function waitFor(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function uniqueFolderPaths(paths: string[]) {
  const seen = new Set<string>();
  return paths
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => {
      const key = path.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export function sourceFolderKey(path: string) {
  return path.trim().replace(/[\\/]+$/, "").toLowerCase();
}

export function libraryTrackQueryKey(
  searchValue: string,
  advancedFilters: AdvancedTrackSearchFilters,
  sort: SortState,
) {
  const normalizedFilters = Object.entries(advancedFilters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify({
    search: searchValue.trim(),
    advancedFilters: normalizedFilters,
    sortBy: sort.key,
    sortDirection: sort.direction,
  });
}

export function defaultLibraryTrackQueryKey() {
  return libraryTrackQueryKey("", {}, DEFAULT_LIBRARY_SORT);
}

function compactStartupTrack(track: Track): Track {
  return {
    ...track,
    analysis_mood_tags: null,
    analysis_embedding: null,
  };
}

export function readStartupLibrarySnapshot(): StartupLibrarySnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKeys.startupLibrarySnapshot);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StartupLibrarySnapshot>;
    if (
      parsed.queryKey !== defaultLibraryTrackQueryKey() ||
      !Array.isArray(parsed.tracks) ||
      typeof parsed.total !== "number"
    ) {
      return null;
    }
    return {
      queryKey: parsed.queryKey,
      total: Math.max(0, parsed.total),
      tracks: parsed.tracks.map((track) => compactStartupTrack(track as Track)).slice(0, LIBRARY_PAGE_SIZE),
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeStartupLibrarySnapshot(tracks: Track[], total: number) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const snapshot: StartupLibrarySnapshot = {
      queryKey: defaultLibraryTrackQueryKey(),
      total: Math.max(0, total),
      tracks: tracks.slice(0, LIBRARY_PAGE_SIZE).map(compactStartupTrack),
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKeys.startupLibrarySnapshot, JSON.stringify(snapshot));
  } catch {
    try {
      window.localStorage.removeItem(storageKeys.startupLibrarySnapshot);
    } catch {
      // Private browsing or locked storage is fine; startup will ask Rust/Python for the library.
    }
  }
}

export function indexedStartupTracks(snapshot: StartupLibrarySnapshot | null) {
  const cache = new Map<number, Track>();
  snapshot?.tracks.forEach((track, index) => {
    cache.set(index, track);
  });
  return cache;
}

export function sortedCachedTracks(cache: Map<number, Track>) {
  return Array.from(cache.entries())
    .sort(([left], [right]) => left - right)
    .map(([, track]) => track);
}

export function defaultToolTarget(folderPath: string, folderName: string): string {
  const trimmed = folderPath.trim().replace(/[\\/]+$/, "");
  if (!trimmed) {
    return "";
  }
  const separator = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${separator}${folderName}`;
}

export function defaultCdRipTarget(folderPath: string): string {
  return defaultToolTarget(folderPath, "FLAC Cafe CD Rips");
}

export function buildArtistSummariesFromTracks(trackList: Track[], searchTerm = ""): ArtistSummary[] {
  const searchTerms = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const artistsByName = new Map<
    string,
    ArtistSummary & {
      albumKeys: Set<string>;
      ratingTotal: number;
      ratingCount: number;
      searchText: string;
    }
  >();

  for (const track of trackList) {
    const name = primaryArtistName(track.artist) || display(track.artist, "").trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    const current =
      artistsByName.get(key) ??
      {
        name,
        track_count: 0,
        album_count: 0,
        duration_seconds: 0,
        average_rating: null,
        play_count: 0,
        skip_count: 0,
        first_year: null,
        last_year: null,
        artwork_track_id: track.id,
        albumKeys: new Set<string>(),
        ratingTotal: 0,
        ratingCount: 0,
        searchText: "",
      };
    current.track_count += 1;
    current.duration_seconds = (current.duration_seconds ?? 0) + (track.duration_seconds ?? 0);
    current.play_count += track.play_count ?? 0;
    current.skip_count += track.skip_count ?? 0;
    if (track.album?.trim()) {
      current.albumKeys.add(track.album.trim().toLowerCase());
    }
    if (typeof track.rating === "number") {
      current.ratingTotal += track.rating;
      current.ratingCount += 1;
    }
    if (typeof track.year === "number") {
      current.first_year = current.first_year === null ? track.year : Math.min(current.first_year, track.year);
      current.last_year = current.last_year === null ? track.year : Math.max(current.last_year, track.year);
    }
    current.searchText += ` ${track.title ?? ""} ${track.artist ?? ""} ${track.album ?? ""} ${track.genre ?? ""} ${track.analysis_genre ?? ""} ${track.analysis_mood ?? ""}`;
    artistsByName.set(key, current);
  }

  return Array.from(artistsByName.values())
    .filter((artist) => searchTerms.every((term) => artist.searchText.toLowerCase().includes(term)))
    .map(({ albumKeys, ratingTotal, ratingCount, searchText, ...artist }) => ({
      ...artist,
      album_count: albumKeys.size,
      average_rating: ratingCount > 0 ? ratingTotal / ratingCount : null,
      duration_seconds: artist.duration_seconds || null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
