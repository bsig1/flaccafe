// @ts-nocheck
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
    setActivePage,
    setAlbums,
    setArtistInfo,
    setArtistTracks,
    setDebouncedSearch,
    setIsArtistLoading,
    setLibraryView,
    setSearch,
    setStatus,
    uiPreferences,
  } = model;

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

  return {
    handleOpenCurrentTrackFromPlayer,
    handleOpenCurrentArtistFromPlayer,
    handleOpenCurrentAlbumFromPlayer,
    loadArtistInfo,
  };
}
