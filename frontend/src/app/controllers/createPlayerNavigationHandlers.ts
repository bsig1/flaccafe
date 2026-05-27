// @ts-nocheck
import type { Track } from "../../types/api";

const AMBIGUOUS_ARTIST_SEPARATOR = /\s+(?:&|\+|\u00d7|x)\s+|,/i;
const EXPLICIT_ARTIST_SEPARATOR = /\s+(?:featuring|feat\.?|ft\.?|with)\s+|[;|]/i;
const MIN_COMBINED_ARTIST_CONFIDENCE = 0.72;
const MAX_ARTIST_LOOKUP_TABS = 6;
const ARTIST_INFO_LOADING_DELAY_MS = 180;
const ARTIST_INFO_MEMORY_CACHE_LIMIT = 80;

const artistInfoMemoryCache = new Map<string, { artistInfo: any; artistTracks: Track[] }>();
const artistInfoLookupPromises = new Map<string, Promise<any>>();
let artistInfoRequestSerial = 0;

function artistLookupIdentity(name: string | null | undefined) {
  return (
    name
      ?.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ") ?? ""
  );
}

function artistInfoMemoryCacheKey(rawArtistName: string, lookupEnabled: boolean) {
  const normalized = artistLookupIdentity(rawArtistName);
  return normalized ? `${lookupEnabled ? "lookup" : "local"}:${normalized}` : "";
}

function readArtistInfoMemoryCache(key: string) {
  const entry = artistInfoMemoryCache.get(key);
  if (!entry) {
    return null;
  }
  artistInfoMemoryCache.delete(key);
  artistInfoMemoryCache.set(key, entry);
  return entry;
}

function rememberArtistInfoMemoryCache(key: string, artistInfo: any, artistTracks: Track[]) {
  if (!key || !artistInfo) {
    return;
  }
  artistInfoMemoryCache.delete(key);
  artistInfoMemoryCache.set(key, { artistInfo, artistTracks });
  while (artistInfoMemoryCache.size > ARTIST_INFO_MEMORY_CACHE_LIMIT) {
    const oldestKey = artistInfoMemoryCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    artistInfoMemoryCache.delete(oldestKey);
  }
}

export function createPlayerNavigationHandlers(model: any) {
  const {
    albums,
    artistInfo,
    currentTrack,
    fetchAlbums,
    fetchArtistInfo,
    fetchArtistLocalTracks,
    findAlbumForTrack,
    handleSelectAlbum,
    primaryArtistName,
    saveArtistInfoOverride,
    setActivePage,
    setAlbums,
    setArtistInfo,
    setArtistTracks,
    setDebouncedSearch,
    setDetailTrack,
    setIsArtistLoading,
    setLibraryView,
    setSearch,
    setStatus,
    splitArtistNames,
    uiPreferences,
  } = model;

  function artistNamesForTrack(track: Track | null | undefined) {
    const names = splitArtistNames(track?.artist);
    if (names.length > 0) {
      return names;
    }
    const fallback = primaryArtistName(track?.artist);
    return fallback ? [fallback] : [];
  }

  function missingArtistInfo(artistName: string, error?: string) {
    return {
      artist_name: artistName,
      query: artistName,
      summary: null,
      image_url: null,
      page_url: null,
      source: "Wikipedia",
      found: false,
      from_cache: false,
      stale: false,
      updated_at: null,
      error: error ?? "Could not load artist info",
      confidence: 0,
    };
  }

  function rawArtistNameForTrack(track: Track | null | undefined) {
    return track?.artist?.trim() ?? "";
  }

  function normalizeArtistName(name: string | null | undefined) {
    return name?.trim().toLowerCase() ?? "";
  }

  function artistInfoMatchesName(info: any, name: string) {
    const normalizedName = normalizeArtistName(name);
    const comparableName = artistLookupIdentity(name);
    const query = normalizeArtistName(info?.query);
    const artist = normalizeArtistName(info?.artist_name);
    const comparableQuery = artistLookupIdentity(info?.query);
    const comparableArtist = artistLookupIdentity(info?.artist_name);
    return Boolean(
      normalizedName &&
        (query === normalizedName ||
          artist === normalizedName ||
          (comparableName && (comparableQuery === comparableName || comparableArtist === comparableName))),
    );
  }

  function artistInfoRootMatchesCurrentTrack(infoRoot: any, rawArtistName: string, artistNames: string[]) {
    const related = infoRoot?.related_artists?.length ? infoRoot.related_artists : infoRoot ? [infoRoot] : [];
    if (related.length === 0) {
      return false;
    }
    if (rawArtistName && related.some((info: any) => artistInfoMatchesName(info, rawArtistName))) {
      return true;
    }
    return artistNames.length > 0 && artistNames.every((name) => related.some((info: any) => artistInfoMatchesName(info, name)));
  }

  function loadedArtistInfoMatchesCurrentTrack(rawArtistName: string, artistNames: string[]) {
    return artistInfoRootMatchesCurrentTrack(artistInfo, rawArtistName, artistNames);
  }

  function startArtistInfoLoading(refresh: boolean, isCurrentRequest: () => boolean) {
    if (refresh) {
      setIsArtistLoading(true);
      return () => {
        if (isCurrentRequest()) {
          setIsArtistLoading(false);
        }
      };
    }
    const timer = window.setTimeout(() => {
      if (isCurrentRequest()) {
        setIsArtistLoading(true);
      }
    }, ARTIST_INFO_LOADING_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      if (isCurrentRequest()) {
        setIsArtistLoading(false);
      }
    };
  }

  function shouldTryCombinedArtistLookup(rawArtistName: string, artistNames: string[]) {
    return (
      rawArtistName.length > 0 &&
      artistNames.length > 1 &&
      AMBIGUOUS_ARTIST_SEPARATOR.test(rawArtistName) &&
      !EXPLICIT_ARTIST_SEPARATOR.test(rawArtistName)
    );
  }

  function artistInfoConfidence(info: any) {
    return typeof info?.confidence === "number" ? info.confidence : info?.found ? 0.5 : 0;
  }

  function shouldUseCombinedArtistInfo(info: any) {
    return Boolean(info?.found && artistInfoConfidence(info) >= MIN_COMBINED_ARTIST_CONFIDENCE);
  }

  function hasStaleArtistInfo(responses: any[]) {
    return responses.some((response) => response?.found && response?.from_cache && response?.stale);
  }

  async function fetchArtistInfoSafely(name: string, refresh: boolean) {
    try {
      return await fetchArtistInfo(name, refresh);
    } catch (error) {
      return missingArtistInfo(name, error instanceof Error ? error.message : "Could not load artist info");
    }
  }

  async function resolveArtistInfoResponses(rawArtistName: string, artistNames: string[], refresh: boolean) {
    const boundedNames = artistNames.slice(0, MAX_ARTIST_LOOKUP_TABS);
    if (shouldTryCombinedArtistLookup(rawArtistName, artistNames)) {
      const [combined, ...splitResponses] = await Promise.all([
        fetchArtistInfoSafely(rawArtistName, refresh),
        ...boundedNames.map((name) => fetchArtistInfoSafely(name, refresh)),
      ]);
      if (shouldUseCombinedArtistInfo(combined)) {
        return { artistNames: [rawArtistName], responses: [combined] };
      }
      return { artistNames: boundedNames, responses: splitResponses };
    }

    const responses = await Promise.all(boundedNames.map((name) => fetchArtistInfoSafely(name, refresh)));
    return { artistNames: boundedNames, responses };
  }

  async function fetchArtistLocalTracksSafely(name: string) {
    try {
      return await fetchArtistLocalTracks(name);
    } catch {
      return [];
    }
  }

  async function resolveArtistLocalTracks(artistNames: string[]) {
    return Promise.all(artistNames.map((name) => fetchArtistLocalTracksSafely(name)));
  }

  function enrichArtistInfoResponses(artistNames: string[], responses: any[], tracksByArtist: Track[][] = []) {
    if (artistNames.length === 0) {
      return responses.map((response, index) => ({
        ...response,
        local_tracks: tracksByArtist[index] ?? response?.local_tracks ?? [],
      }));
    }
    return artistNames.map((name, index) => {
      const response = responses[index] ?? missingArtistInfo(name);
      return {
        ...response,
        local_tracks: tracksByArtist[index] ?? response?.local_tracks ?? [],
      };
    });
  }

  function buildArtistInfoResult(artistNames: string[], responses: any[], tracksByArtist: Track[][] = []) {
    const enrichedResponses = enrichArtistInfoResponses(artistNames, responses, tracksByArtist);
    const primaryName = artistNames[0] ?? responses[0]?.query ?? "";
    const primary = enrichedResponses[0] ?? missingArtistInfo(primaryName);
    return {
      artistInfo: { ...primary, related_artists: enrichedResponses },
      artistTracks: primary.local_tracks ?? [],
      responses,
      artistNames,
    };
  }

  function applyArtistInfoResult(result: any) {
    setArtistInfo(result.artistInfo);
    setArtistTracks(result.artistTracks);
    const resultResponses = result.artistInfo?.related_artists?.length ? result.artistInfo.related_artists : result.responses ?? [];
    const firstError = resultResponses.find((response: any) => response.error)?.error;
    if (firstError) {
      setStatus(firstError);
    }
    return result;
  }

  async function resolveArtistInfoResult(rawArtistName: string, artistNames: string[], refresh: boolean, cacheKey: string) {
    if (!uiPreferences.enableArtistLookup) {
      const boundedNames = artistNames.slice(0, MAX_ARTIST_LOOKUP_TABS);
      const tracksByArtist = await resolveArtistLocalTracks(boundedNames);
      const responses = boundedNames.map((name) => missingArtistInfo(name, "Artist background lookup is disabled"));
      const result = buildArtistInfoResult(boundedNames, responses, tracksByArtist);
      rememberArtistInfoMemoryCache(cacheKey, result.artistInfo, result.artistTracks);
      return result;
    }

    const resolved = await resolveArtistInfoResponses(rawArtistName, artistNames, refresh);
    const tracksByArtist = await resolveArtistLocalTracks(resolved.artistNames);
    const result = buildArtistInfoResult(resolved.artistNames, resolved.responses, tracksByArtist);
    rememberArtistInfoMemoryCache(cacheKey, result.artistInfo, result.artistTracks);
    return result;
  }

  async function readOrStartArtistInfoLookup(rawArtistName: string, artistNames: string[], refresh: boolean, cacheKey: string) {
    const promiseKey = cacheKey ? `${refresh ? "refresh" : "lookup"}:${cacheKey}` : "";
    if (!promiseKey) {
      return resolveArtistInfoResult(rawArtistName, artistNames, refresh, cacheKey);
    }
    const existing = artistInfoLookupPromises.get(promiseKey);
    if (existing) {
      return existing;
    }
    const promise = resolveArtistInfoResult(rawArtistName, artistNames, refresh, cacheKey)
      .finally(() => {
        artistInfoLookupPromises.delete(promiseKey);
      });
    artistInfoLookupPromises.set(promiseKey, promise);
    return promise;
  }

  async function refreshStaleArtistInfo(rawArtistName: string, artistNames: string[], cacheKey: string, requestSerial: number) {
    try {
      const result = await readOrStartArtistInfoLookup(rawArtistName, artistNames, true, cacheKey);
      if (requestSerial !== artistInfoRequestSerial) {
        return;
      }
      applyArtistInfoResult(result);
    } catch (error) {
      if (requestSerial === artistInfoRequestSerial) {
        setStatus(error instanceof Error ? error.message : "Could not refresh artist info");
      }
    } finally {
      if (requestSerial === artistInfoRequestSerial) {
        setIsArtistLoading(false);
      }
    }
  }

  function handleOpenCurrentTrackFromPlayer(track: Track) {
    setDetailTrack(track);
    setLibraryView("tracks");
    setActivePage("library");
  }

  function handleOpenCurrentArtistFromPlayer(track: Track) {
    const artistName = primaryArtistName(track.artist);
    if (!artistName) {
      setStatus("This track does not have an artist tag yet");
      return;
    }
    setActivePage("artist");
  }

  async function handleOpenCurrentAlbumFromPlayer(track: Track) {
    if (!track.album?.trim()) {
      setStatus("This track does not have an album tag yet");
      return;
    }

    setSearch("");
    setDebouncedSearch("");
    setLibraryView("albums");
    setActivePage("library");

    try {
      let album = findAlbumForTrack(albums, track);
      if (!album) {
        const allAlbums = await fetchAlbums("");
        setAlbums(allAlbums);
        album = findAlbumForTrack(allAlbums, track);
      }
      if (!album) {
        setStatus("Could not find that album in the Library view");
        return;
      }
      await handleSelectAlbum(album.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open album");
    }
  }

  async function loadArtistInfo(refresh = false) {
    const initialArtistNames = artistNamesForTrack(currentTrack);
    const rawArtistName = rawArtistNameForTrack(currentTrack);
    let artistNames = initialArtistNames;
    let artistName = artistNames[0];
    if (!artistName) {
      artistInfoRequestSerial += 1;
      setArtistInfo(null);
      setArtistTracks([]);
      return;
    }
    const requestSerial = ++artistInfoRequestSerial;
    const isCurrentRequest = () => requestSerial === artistInfoRequestSerial;
    if (!refresh && loadedArtistInfoMatchesCurrentTrack(rawArtistName, artistNames)) {
      setIsArtistLoading(false);
      return;
    }
    const cacheKey = artistInfoMemoryCacheKey(rawArtistName || artistName, uiPreferences.enableArtistLookup);
    const cached = !refresh ? readArtistInfoMemoryCache(cacheKey) : null;
    if (cached && artistInfoRootMatchesCurrentTrack(cached.artistInfo, rawArtistName, artistNames)) {
      setArtistInfo(cached.artistInfo);
      setArtistTracks(cached.artistTracks);
      setIsArtistLoading(false);
      return;
    }
    const stopArtistInfoLoading = startArtistInfoLoading(refresh, isCurrentRequest);
    try {
      const result = await readOrStartArtistInfoLookup(rawArtistName, artistNames, refresh, cacheKey);
      artistNames = result.artistNames;
      artistName = artistNames[0] ?? artistName;
      if (!isCurrentRequest()) {
        return;
      }
      applyArtistInfoResult(result);
      if (uiPreferences.enableArtistLookup && !refresh && hasStaleArtistInfo(result.responses)) {
        void refreshStaleArtistInfo(rawArtistName, artistNames, cacheKey, requestSerial);
        return;
      }
    } catch (error) {
      if (isCurrentRequest()) {
        setArtistTracks([]);
        setArtistInfo(missingArtistInfo(artistName, error instanceof Error ? error.message : "Could not load artist info"));
      }
    } finally {
      stopArtistInfoLoading();
    }
  }

  async function handleSaveArtistInfoOverride(artistName: string, wikipediaTitleOrUrl: string) {
    const response = await saveArtistInfoOverride(artistName, wikipediaTitleOrUrl);
    setArtistInfo((current: any) => {
      const currentRelated = current?.related_artists?.length ? current.related_artists : current ? [current] : [];
      const lowerName = artistName.toLowerCase();
      const existingIndex = currentRelated.findIndex((item: any) =>
        item?.query?.toLowerCase() === lowerName || item?.artist_name?.toLowerCase() === lowerName,
      );
      const responseWithTracks = {
        ...response,
        local_tracks: existingIndex >= 0 ? currentRelated[existingIndex]?.local_tracks ?? [] : [],
      };
      const related = existingIndex >= 0
        ? currentRelated.map((item: any, index: number) => (index === existingIndex ? responseWithTracks : item))
        : [responseWithTracks, ...currentRelated];
      const nextArtistInfo = { ...(related[0] ?? responseWithTracks), related_artists: related };
      rememberArtistInfoMemoryCache(
        artistInfoMemoryCacheKey(rawArtistNameForTrack(currentTrack) || artistName, uiPreferences.enableArtistLookup),
        nextArtistInfo,
        nextArtistInfo.local_tracks ?? [],
      );
      return nextArtistInfo;
    });
    setStatus(`Updated wiki lookup for ${artistName}`);
    return response;
  }

  return {
    handleOpenCurrentTrackFromPlayer,
    handleOpenCurrentArtistFromPlayer,
    handleOpenCurrentAlbumFromPlayer,
    loadArtistInfo,
    handleSaveArtistInfoOverride,
  };
}
