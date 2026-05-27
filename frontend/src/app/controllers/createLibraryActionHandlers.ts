// @ts-nocheck
import type {
  InboxAutoReviewRule,
  InboxAutoReviewRuleRequest,
  TrackMetadataUpdate,
} from "../../types/api";

export function createLibraryActionHandlers(model: any) {
  const { tracks, trackIndexCacheRef, updateCachedTracks, updateTrackRating, setStatus, setTracks, commitTrackIndexCache, writeRatingsToFiles, findTracksByIds, supportsFileTagWriting, refreshTracks, setSelectedAlbumTracks, setSelectedArtistTracks, setSelectedPlaylistTracks, setInbox, setPlaybackQueue, setQueue, setCurrentTrack, setDetailTrack, setMetadataEditTrack, setLibraryTotal, setMetadataEditInitialField, metadataEditTrack, resolveTracksForAction, recycleFilesWithDesktop, deleteTrack, loadAlbums, loadArtists, loadPlaylists, loadLibraryStats, loadInbox, loadClapCoverage, showUndoAction, display, deleteTracks, readRememberedDeleteChoice, setDeletePrompt, deletePrompt, writeRememberedDeleteChoice, updateTrackMetadata, setSelectedAlbumId, fetchAlbumTracks, setSelectedArtistName, fetchArtistLocalTracks, fetchTracks, primaryArtistName, handlePlayTrack, replaceTrackEverywhere, removeTrackEverywhere, artistTracks, setSelectedPlaylistId, fetchPlaylistTracks, newPlaylistName, createPlaylist, setNewPlaylistName, setTargetPlaylistId, deletePlaylist, setPlaylists, targetPlaylistId, playlists, addTracksToPlaylist, selectedPlaylistId, removeTrackFromPlaylist, selectedPlaylistTracks, moveTrackInPlaylist, exportPlaylist, exportQueue, importPlaylistPath, importPlaylist, setImportPlaylistPath, setLibraryView, reviewAllInboxTracks, reviewInboxTracks, updateInboxNote, updateInboxAutoReviewRule, createInboxAutoReviewRule, deleteInboxAutoReviewRule } = model;
  async function handleRating(trackId: number, rating: number | null) {
    const previous = tracks;
    const previousCache = new Map(trackIndexCacheRef.current);
    updateCachedTracks((track) => (track.id === trackId ? { ...track, rating } : track));
    try {
      const updated = await updateTrackRating(trackId, rating);
      replaceTrackEverywhere(updated);
      setStatus("Rating saved");
    } catch (error) {
      setTracks(previous);
      commitTrackIndexCache(previousCache);
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

  async function handleDeleteTrack(trackId: number, deleteFile: boolean) {
    const snapshot = await resolveTracksForAction([trackId]);
    try {
      const Recycle = deleteFile && snapshot.length === 1 ? await recycleFilesWithDesktop(snapshot) : null;
      const response = await deleteTrack(trackId, deleteFile && Recycle === null);
      removeTrackEverywhere(trackId);
      await Promise.all([loadAlbums(), loadArtists(), loadPlaylists(), loadLibraryStats(), loadInbox(), loadClapCoverage()]);
      if (Recycle?.recycled) {
        setStatus("Deleted file to Recycle Bin and removed track from library");
      } else if (response.deleted_file) {
        setStatus("Deleted file to Recycle Bin and removed track from library");
      } else if (response.file_missing || Recycle?.missing) {
        setStatus("Removed missing track from library");
      } else {
        if (!deleteFile && snapshot.length > 0) {
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
    const snapshot = await resolveTracksForAction(uniqueIds);
    try {
      const Recycle = deleteFile && snapshot.length === uniqueIds.length ? await recycleFilesWithDesktop(snapshot) : null;
      const response = await deleteTracks(uniqueIds, deleteFile && Recycle === null);
      for (const trackId of response.removed_track_ids) {
        removeTrackEverywhere(trackId);
      }
      await Promise.all([loadAlbums(), loadArtists(), loadPlaylists(), loadLibraryStats(), loadInbox(), loadClapCoverage()]);
      if (!deleteFile && snapshot.length > 0) {
        showUndoAction({
          type: "library-remove",
          label: `${response.removed_count} track${response.removed_count === 1 ? "" : "s"}`,
          tracks: snapshot,
        });
      }
      const deletedFileCount = response.deleted_files + (Recycle?.recycled ?? 0);
      const skipped = response.missing_track_ids.length + response.errors.length + (Recycle?.missing ?? 0);
      const warning = skipped ? ` (${skipped.toLocaleString()} skipped)` : "";
      setStatus(
        deletedFileCount > 0
          ? `Deleted ${deletedFileCount.toLocaleString()} files to Recycle Bin and removed ${response.removed_count.toLocaleString()} tracks${warning}`
          : `Removed ${response.removed_count.toLocaleString()} tracks from library${warning}`,
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
      await Promise.all([loadAlbums(), loadArtists(), loadLibraryStats()]);
      setMetadataEditTrack(null);
      setMetadataEditInitialField(null);
      setStatus((metadata.write_to_file ?? writeRatingsToFiles) ? "Metadata saved to library and file" : "Metadata saved to library");
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
      await Promise.all([loadAlbums(), loadArtists(), loadLibraryStats()]);
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

  async function handleSelectArtist(artistName: string) {
    setSelectedArtistName(artistName);
    try {
      setSelectedArtistTracks(await fetchArtistLocalTracks(artistName, 20000));
    } catch (error) {
      try {
        const fallbackTracks = await fetchTracks("");
        const artistKey = artistName.toLowerCase();
        setSelectedArtistTracks(
          fallbackTracks
            .filter((track) => (primaryArtistName(track.artist) || display(track.artist, "")).toLowerCase() === artistKey)
            .sort((left, right) => {
              const albumDelta = display(left.album).localeCompare(display(right.album));
              if (albumDelta !== 0) {
                return albumDelta;
              }
              return (left.disc_number ?? 0) - (right.disc_number ?? 0) || (left.track_number ?? 0) - (right.track_number ?? 0);
            }),
        );
      } catch {
        setStatus(error instanceof Error ? error.message : "Could not load artist");
      }
    }
  }

  async function handlePlayAlbum(albumId: number) {
    setSelectedAlbumId(albumId);
    try {
      const albumTracks = await fetchAlbumTracks(albumId);
      setSelectedAlbumTracks(albumTracks);
      if (albumTracks.length === 0) {
        setStatus("No local tracks found for this album");
        return;
      }
      handlePlayTrack(albumTracks[0], albumTracks);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not play album");
    }
  }

  async function handlePlayArtist(artistName: string) {
    setSelectedArtistName(artistName);
    try {
      const artistTracks = await fetchArtistLocalTracks(artistName, 20000);
      setSelectedArtistTracks(artistTracks);
      if (artistTracks.length === 0) {
        setStatus("No local tracks found for this artist");
        return;
      }
      handlePlayTrack(artistTracks[0], artistTracks);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not play artist");
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

  async function handleAddTracksToPlaylist(trackIds: number[], playlistId = targetPlaylistId) {
    if (!playlistId) {
      setStatus("Choose a target playlist first");
      return;
    }
    const playlistName = playlists.find((playlist) => playlist.id === playlistId)?.name ?? "playlist";
    try {
      const updatedTracks = await addTracksToPlaylist(playlistId, trackIds);
      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistTracks(updatedTracks);
      }
      setTargetPlaylistId(playlistId);
      await loadPlaylists();
      setStatus(`Added ${trackIds.length} track${trackIds.length === 1 ? "" : "s"} to ${playlistName}`);
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
      setStatus("Enter a playlist path");
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

  async function handleReviewInboxTracks(trackIds: number[], allNew = false) {
    const uniqueIds = Array.from(new Set(trackIds));
    if (!allNew && uniqueIds.length === 0) {
      return;
    }
    try {
      const response = allNew ? await reviewAllInboxTracks() : await reviewInboxTracks(uniqueIds);
      await loadInbox();
      setStatus(`Reviewed ${response.updated.toLocaleString()} Inbox track${response.updated === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update Inbox");
    }
  }

  async function handleUpdateInboxNote(trackId: number, note: string) {
    try {
      await updateInboxNote(trackId, note);
      await loadInbox();
      setStatus(note.trim() ? "Inbox note saved" : "Inbox note cleared");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save Inbox note");
    }
  }

  async function handleSaveInboxAutoReviewRule(rule: InboxAutoReviewRuleRequest, ruleId?: number) {
    try {
      const response = ruleId
        ? await updateInboxAutoReviewRule(ruleId, rule)
        : await createInboxAutoReviewRule(rule);
      await loadInbox();
      setStatus(
        response.applied
          ? `Auto-review rule saved; reviewed ${response.applied.toLocaleString()} matching track${response.applied === 1 ? "" : "s"}`
          : `Auto-review rule saved: ${response.rule.name}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save auto-review rule");
    }
  }

  async function handleDeleteInboxAutoReviewRule(rule: InboxAutoReviewRule) {
    if (!window.confirm(`Delete auto-review rule "${rule.name}"?`)) {
      return;
    }
    try {
      await deleteInboxAutoReviewRule(rule.id);
      await loadInbox();
      setStatus("Auto-review rule deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete auto-review rule");
    }
  }

  return { handleRating, handleBulkRating, handleDeleteTrack, handleDeleteTracks, requestDeleteTracks, confirmDeleteTracks, handleSaveTrackMetadata, handleBulkMetadata, handleSelectAlbum, handleSelectArtist, handlePlayAlbum, handlePlayArtist, handleSelectPlaylist, handleCreatePlaylist, handleDeletePlaylist, handleAddTracksToPlaylist, handleRemoveTrackFromPlaylist, handleRemoveTracksFromPlaylist, handleMovePlaylistTrack, handleExportPlaylist, handleExportTracks, handleImportPlaylist, handleReviewInboxTracks, handleUpdateInboxNote, handleSaveInboxAutoReviewRule, handleDeleteInboxAutoReviewRule };
}
