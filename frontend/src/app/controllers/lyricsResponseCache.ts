import type { LyricsLookupRequest, LyricsResponse } from "../../types/api";

const LYRICS_RESPONSE_CACHE_LIMIT = 300;
const EMPTY_LYRICS_TTL_MS = 10 * 60 * 1000;
const ONLINE_LYRICS_RETRY_MS = 20 * 60 * 1000;

type LyricsCacheEntry = {
  response: LyricsResponse;
  cachedAtMs: number;
  onlineCheckedAtMs: number | null;
};

const lyricsResponseCache = new Map<string, LyricsCacheEntry>();

function hasLyricsText(response: LyricsResponse) {
  return Boolean(response.lyrics?.trim());
}

function normalizeMetadataPart(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function touchLyricsCacheEntry(cacheKey: string, entry: LyricsCacheEntry) {
  lyricsResponseCache.delete(cacheKey);
  lyricsResponseCache.set(cacheKey, entry);
}

function trimLyricsCache() {
  while (lyricsResponseCache.size > LYRICS_RESPONSE_CACHE_LIMIT) {
    const oldestKey = lyricsResponseCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    lyricsResponseCache.delete(oldestKey);
  }
}

export function lyricsTrackCacheKey(trackId: number | null | undefined, path?: string | null) {
  if (!Number.isFinite(trackId) || Number(trackId) <= 0) {
    return null;
  }
  return `track:${trackId}:${path ?? ""}`;
}

export function lyricsLookupCacheKey(request: LyricsLookupRequest) {
  const keyParts = [
    request.track_id && request.track_id > 0 ? request.track_id : "",
    request.path,
    request.title,
    request.artist,
    request.album,
    request.album_artist,
    request.duration_seconds ? Math.round(request.duration_seconds) : "",
  ].map(normalizeMetadataPart);
  if (!keyParts.some(Boolean)) {
    return null;
  }
  return `lookup:${keyParts.join("\u001f")}`;
}

export function cachedLyricsResponse(cacheKey: string | null) {
  if (!cacheKey) {
    return null;
  }
  const entry = lyricsResponseCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (!hasLyricsText(entry.response) && Date.now() - entry.cachedAtMs > EMPTY_LYRICS_TTL_MS) {
    lyricsResponseCache.delete(cacheKey);
    return null;
  }
  touchLyricsCacheEntry(cacheKey, entry);
  return entry.response;
}

export function rememberLyricsResponse(
  cacheKey: string | null,
  response: LyricsResponse,
  options: { onlineChecked?: boolean } = {},
) {
  if (!cacheKey) {
    return;
  }
  const now = Date.now();
  const existing = lyricsResponseCache.get(cacheKey);
  touchLyricsCacheEntry(cacheKey, {
    response,
    cachedAtMs: now,
    onlineCheckedAtMs: options.onlineChecked ? now : existing?.onlineCheckedAtMs ?? null,
  });
  trimLyricsCache();
}

export function hasRecentLyricsOnlineCheck(cacheKey: string | null) {
  if (!cacheKey) {
    return false;
  }
  const checkedAt = lyricsResponseCache.get(cacheKey)?.onlineCheckedAtMs;
  return Boolean(checkedAt && Date.now() - checkedAt < ONLINE_LYRICS_RETRY_MS);
}
