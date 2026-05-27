// @ts-nocheck
import type { Track } from "../../types/api";

const AMBIGUOUS_ARTIST_SEPARATOR = /\s+(?:&|\+|\u00d7|x)\s+|,/i;
const EXPLICIT_ARTIST_SEPARATOR = /\s+(?:featuring|feat\.?|ft\.?|with)\s+|[;|]/i;
const MIN_COMBINED_ARTIST_CONFIDENCE = 0.72;
const MAX_ARTIST_LOOKUP_TABS = 6;

export function createPlayerNavigationHandlers(model: any) {
  const {
    albums,
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
      updated_at: null,
      error: error ?? "Could not load artist info",
      confidence: 0,
    };
  }

  function rawArtistNameForTrack(track: Track | null | undefined) {
    return track?.artist?.trim() ?? "";
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

  async function fetchArtistInfoSafely(name: string, refresh: boolean) {
    try {
      return await fetchArtistInfo(name, refresh);
    } catch (error) {
      return missingArtistInfo(name, error instanceof Error ? error.message : "Could not load artist info");
    }
  }

  async function resolveArtistInfoResponses(rawArtistName: string, artistNames: string[], refresh: boolean) {
    if (shouldTryCombinedArtistLookup(rawArtistName, artistNames)) {
      const combined = await fetchArtistInfoSafely(rawArtistName, refresh);
      if (shouldUseCombinedArtistInfo(combined)) {
        return { artistNames: [rawArtistName], responses: [combined] };
      }
    }

    const boundedNames = artistNames.slice(0, MAX_ARTIST_LOOKUP_TABS);
    const responses = [];
    for (const name of boundedNames) {
      responses.push(await fetchArtistInfoSafely(name, refresh));
    }
    return { artistNames: boundedNames, responses };
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
      setArtistInfo(null);
      setArtistTracks([]);
      return;
    }
    setIsArtistLoading(true);
    if (!uiPreferences.enableArtistLookup) {
      try {
        setArtistTracks(await fetchArtistLocalTracks(artistName));
      } catch {
        setArtistTracks([]);
      }
      setArtistInfo(null);
      setIsArtistLoading(false);
      return;
    }
    try {
      const resolved = await resolveArtistInfoResponses(rawArtistName, artistNames, refresh);
      artistNames = resolved.artistNames;
      artistName = artistNames[0] ?? artistName;
      try {
        setArtistTracks(await fetchArtistLocalTracks(artistName));
      } catch {
        setArtistTracks([]);
      }
      const responses = resolved.responses;
      const primary = responses[0] ?? missingArtistInfo(artistName);
      setArtistInfo({ ...primary, related_artists: responses });
      const firstError = responses.find((response) => response.error)?.error;
      if (firstError) {
        setStatus(firstError);
      }
    } catch (error) {
      setArtistInfo(missingArtistInfo(artistName, error instanceof Error ? error.message : "Could not load artist info"));
    } finally {
      setIsArtistLoading(false);
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
      const related = existingIndex >= 0
        ? currentRelated.map((item: any, index: number) => (index === existingIndex ? response : item))
        : [response, ...currentRelated];
      return { ...(related[0] ?? response), related_artists: related };
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
