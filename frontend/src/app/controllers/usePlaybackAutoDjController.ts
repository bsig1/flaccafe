// @ts-nocheck
import { useEffect } from "react";
import { updateLyrics } from "../../lib/api";
import type {
  AutoDjSettings,
  LyricsResponse,
  LyricsUpdateRequest,
  RadioStation,
  Track,
} from "../../types/api";

export function usePlaybackAutoDjController(model: any) {
  const { shuffleItems, setStatus, tracks, generateAutoDj, defaultAutoDj, recommendationProfiles, settings, uiPreferences, setQueue, setRecommendationDrift, loadRecommendationHistory, setContinuousAutoDjEnabled, queue, currentTrack, setPlaybackQueue, setAutoPlayOnTrackChange, setCurrentTrack, continuousAutoDjInFlightRef, setContinuousAutoDjBusy, continuousAutoDjSettings, playbackQueue, useEffect, continuousAutoDjEnabled, continuousAutoDjBusy, createAutoDjAvoidRule, trackGenre, loadAutoDjAvoidRules, setAutoDjAvoidRules, deleteAutoDjAvoidRule, saveRecommendationProfile, loadRecommendationProfiles, setRecommendationProfiles, setDefaultRecommendationProfile, deleteRecommendationProfile, recordRecommendationFeedback, shouldRecordTrackAsPlayed, markTrackPlayed, markTrackSkipped, replaceTrackEverywhere, loadHistory, cdPlaybackPrepareRequestIdRef, StaleCdPlaybackRequestError, cdDriveIdFromTrack, cdTrackNumberFromTrack, playCdTrack, cdTrackLooksActive, playbackTime, setCurrentRadioStation, cdPlaybackPrepareChainRef, waitFor, CD_PLAYBACK_PREPARE_DEBOUNCE_MS, isStaleCdPlaybackRequest, currentRadioStation, externalTrackRequestIdRef, setExternalTrackRequest, setRestoredPlaybackPosition, setRadioPlaybackRequestId, markRadioStationPlayed, display, rememberQueueSnapshot, queueHistory, setQueueHistory, createPlaylist, addTracksToPlaylist, loadPlaylists, setSelectedPlaylistId, setTargetPlaylistId, shouldLookupLyricsByMetadata, fetchLyricsByMetadata, lyricsLookupRequestForTrack, fetchLyricsOnline, setLyrics, lyrics } = model;
  function handleShuffleTracks(sourceTracks: Track[]) {
    const shuffled = shuffleItems(sourceTracks);
    if (!shuffled.length) {
      setStatus("No tracks to shuffle");
      return;
    }
    replaceUpcomingPlaybackQueue(shuffled, "Shuffle");
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
      void loadRecommendationHistory();
      replaceUpcomingPlaybackQueue(response.tracks, seedTrack ? "AutoDJ from track" : "AutoDJ");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not generate AutoDJ");
    }
  }

  function handleContinuousAutoDjChange(enabled: boolean) {
    setContinuousAutoDjEnabled(enabled);
    setStatus(enabled ? "Continuous AutoDJ will keep the upcoming queue filled" : "Continuous AutoDJ off");
  }

  function queueUpcomingPlaybackTracks(nextTracks: Track[]) {
    if (!nextTracks.length) {
      return;
    }

    if (currentTrack) {
      const upcoming = nextTracks.filter((track) => track.id !== currentTrack.id);
      setPlaybackQueue([currentTrack, ...upcoming]);
      return;
    }

    setPlaybackQueue(nextTracks);
    setAutoPlayOnTrackChange(false);
    setCurrentTrack(nextTracks[0]);
  }

  function replaceUpcomingPlaybackQueue(nextTracks: Track[], label: string) {
    if (!nextTracks.length) {
      setStatus(`${label} did not find any tracks`);
      return;
    }

    if (currentTrack) {
      const upcoming = nextTracks.filter((track) => track.id !== currentTrack.id);
      queueUpcomingPlaybackTracks(nextTracks);
      setStatus(`${label} updated what plays next with ${upcoming.length.toLocaleString()} track${upcoming.length === 1 ? "" : "s"}`);
      return;
    }

    queueUpcomingPlaybackTracks(nextTracks);
    setStatus(`${label} queued ${nextTracks.length.toLocaleString()} track${nextTracks.length === 1 ? "" : "s"}`);
  }

  async function extendContinuousAutoDj() {
    if (continuousAutoDjInFlightRef.current) {
      return;
    }
    continuousAutoDjInFlightRef.current = true;
    setContinuousAutoDjBusy(true);
    try {
      const appendLength = Math.max(10, Math.min(25, continuousAutoDjSettings.queue_length || uiPreferences.defaultQueueLength));
      const response = await generateAutoDj({
        ...continuousAutoDjSettings,
        queue_length: appendLength,
        seed_track_id: currentTrack?.id ?? continuousAutoDjSettings.seed_track_id ?? null,
        similarity_weight: currentTrack
          ? Math.max(Number(continuousAutoDjSettings.similarity_weight ?? 0), uiPreferences.similarityWeight * 0.5)
          : continuousAutoDjSettings.similarity_weight,
      });
      setQueue(response.tracks);
      setRecommendationDrift(response.drift);
      void loadRecommendationHistory();

      const snapshotIds = new Set(playbackQueue.map((track) => track.id));
      const snapshotAdditions = response.tracks.filter((track) => !snapshotIds.has(track.id));
      setPlaybackQueue((current) => {
        const existingIds = new Set(current.map((track) => track.id));
        const additions = response.tracks.filter((track) => !existingIds.has(track.id));
        return additions.length ? [...current, ...additions] : current;
      });
      if (snapshotAdditions.length > 0) {
        setStatus(
          `Continuous AutoDJ added ${snapshotAdditions.length.toLocaleString()} upcoming track${snapshotAdditions.length === 1 ? "" : "s"}`,
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Continuous AutoDJ could not add tracks");
    } finally {
      continuousAutoDjInFlightRef.current = false;
      setContinuousAutoDjBusy(false);
    }
  }

  useEffect(() => {
    if (!continuousAutoDjEnabled || continuousAutoDjBusy || !currentTrack) {
      return;
    }
    const activeIndex = playbackQueue.findIndex((track) => track.id === currentTrack.id);
    const remaining = activeIndex >= 0 ? playbackQueue.length - activeIndex - 1 : playbackQueue.length;
    if (remaining <= 3) {
      void extendContinuousAutoDj();
    }
  }, [continuousAutoDjEnabled, continuousAutoDjBusy, currentTrack?.id, playbackQueue.length]);

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
    if (track.id <= 0 || track.is_preview) {
      return;
    }
    void recordRecommendationFeedback({ track_id: track.id, event_type: eventType, weight }).catch(() => {
      // Recommendation feedback is a soft learning signal; playback should never wait on it.
    });
  }

  async function recordTrackExitQuiet(track: Track, listenedSeconds: number) {
    if (track.id <= 0 || track.is_preview) {
      return;
    }
    const durationSeconds = track.duration_seconds ?? 0;
    try {
      const updated =
        shouldRecordTrackAsPlayed(listenedSeconds, durationSeconds, uiPreferences.skipThresholdPercent)
          ? await markTrackPlayed(track.id)
          : await markTrackSkipped(track.id);
      replaceTrackEverywhere(updated, { lightweightLibraryCache: true });
      void loadHistory();
    } catch {
      // Playback should not be interrupted by history bookkeeping.
    }
  }

  type PlayTrackOptions = { suppressExitRecord?: boolean; cdPreviewPrepared?: boolean };

  function ensureLatestCdPlaybackRequest(requestId: number) {
    if (cdPlaybackPrepareRequestIdRef.current !== requestId) {
      throw new StaleCdPlaybackRequestError();
    }
  }

  async function refreshCdPreviewTrack(track: Track, queueItems: Track[], requestId: number) {
    const driveId = cdDriveIdFromTrack(track);
    const trackNumber = cdTrackNumberFromTrack(track);
    if (!driveId || !trackNumber) {
      throw new Error("Could not refresh this CD track. Refresh the CD page and try again.");
    }
    ensureLatestCdPlaybackRequest(requestId);

    const requestBody = {
      albumTitle: track.album ?? null,
      albumArtist: track.album_artist ?? track.artist ?? null,
      year: track.year ?? null,
      genre: track.genre ?? null,
      tracks: [
        {
          track_number: trackNumber,
          disc_number: track.disc_number,
          title: track.title,
          artist: track.artist,
          duration_seconds: track.duration_seconds,
        },
      ],
    };
    const response = await playCdTrack(trackNumber, driveId, requestBody);
    ensureLatestCdPlaybackRequest(requestId);
    if (!response.track) {
      throw new Error("Could not prepare this CD track for playback.");
    }

    const refreshedTrack = response.track;
    const refreshedQueue = queueItems.map((item) => {
      const sameVirtualTrack =
        cdTrackLooksActive(item) &&
        cdTrackNumberFromTrack(item) === trackNumber &&
        cdDriveIdFromTrack(item) === driveId;
      return item.id === track.id || sameVirtualTrack ? refreshedTrack : item;
    });
    return { track: refreshedTrack, queue: refreshedQueue };
  }

  function commitPlayTrack(track: Track, queueItems: Track[], options?: PlayTrackOptions) {
    if (!options?.suppressExitRecord && currentTrack && currentTrack.id !== track.id) {
      void recordTrackExitQuiet(currentTrack, playbackTime);
    }
    setCurrentRadioStation(null);
    setPlaybackQueue(queueItems);
    setAutoPlayOnTrackChange(true);
    setCurrentTrack(track);
    rememberRecommendationFeedback(track, "manual_play", 0.7);
  }

  function handlePlayTrack(track: Track, queueItems: Track[], options?: PlayTrackOptions) {
    if (cdTrackLooksActive(track) && !options?.cdPreviewPrepared) {
      const requestId = ++cdPlaybackPrepareRequestIdRef.current;
      const prepareTask = cdPlaybackPrepareChainRef.current
        .catch(() => {
          // A previous CD request may have failed or gone stale. The chain keeps
          // ordering intact so only the newest request can touch the CD drive.
        })
        .then(async () => {
          await waitFor(CD_PLAYBACK_PREPARE_DEBOUNCE_MS);
          ensureLatestCdPlaybackRequest(requestId);
          return refreshCdPreviewTrack(track, queueItems, requestId);
        });
      cdPlaybackPrepareChainRef.current = prepareTask.catch(() => {
        // Keep the chain alive for future CD selections.
      });
      void prepareTask
        .then((prepared) => {
          if (cdPlaybackPrepareRequestIdRef.current !== requestId) {
            return;
          }
          handlePlayTrack(prepared.track, prepared.queue, { ...options, cdPreviewPrepared: true });
        })
        .catch((error) => {
          if (isStaleCdPlaybackRequest(error)) {
            return;
          }
          if (cdPlaybackPrepareRequestIdRef.current === requestId) {
            setStatus(error instanceof Error ? error.message : "Could not prepare CD playback");
          }
        });
      return;
    }

    if (!cdTrackLooksActive(track)) {
      cdPlaybackPrepareRequestIdRef.current += 1;
    }

    const shouldFadeExistingSource =
      !options?.suppressExitRecord &&
      uiPreferences.playerFadeMs > 0 &&
      Boolean(currentRadioStation || (currentTrack && currentTrack.id !== track.id));

    if (shouldFadeExistingSource) {
      externalTrackRequestIdRef.current += 1;
      setExternalTrackRequest({
        id: externalTrackRequestIdRef.current,
        track,
        queue: queueItems,
      });
      return;
    }

    commitPlayTrack(track, queueItems, options);
  }

  function handleCommitExternalTrackRequest(
    request: { id: number; track: Track; queue: Track[] },
    options?: { suppressExitRecord?: boolean },
  ) {
    setExternalTrackRequest((current) => (current?.id === request.id ? null : current));
    commitPlayTrack(request.track, request.queue, options);
  }

  function handlePlayCdPreviewTrack(track: Track, queueItems: Track[] = [track]) {
    setRestoredPlaybackPosition(null);
    handlePlayTrack(track, queueItems.length ? queueItems : [track], { cdPreviewPrepared: true });
  }

  async function handlePlayRadioStation(station: RadioStation) {
    if (currentTrack) {
      void recordTrackExitQuiet(currentTrack, playbackTime);
    }
    setCurrentTrack(null);
    setPlaybackQueue([]);
    setRestoredPlaybackPosition(null);
    setCurrentRadioStation(station);
    setAutoPlayOnTrackChange(true);
    setRadioPlaybackRequestId((current) => current + 1);
    try {
      await markRadioStationPlayed(station.id);
    } catch {
      // Radio playback should still start even if last-played bookkeeping fails.
    }
    setStatus(`Playing ${display(station.name, "radio station")}`);
  }

  function handleStopRadioStation(stationId: number) {
    if (currentRadioStation?.id === stationId) {
      setCurrentRadioStation(null);
      setAutoPlayOnTrackChange(false);
    }
  }

  function handlePlayNext(track: Track) {
    setPlaybackQueue((current) => {
      const baseQueue = current.length ? current : currentTrack ? [currentTrack] : [];
      const withoutTrack = baseQueue.filter((item) => item.id !== track.id);
      const activeIndex = currentTrack ? withoutTrack.findIndex((item) => item.id === currentTrack.id) : -1;
      const insertAt = activeIndex >= 0 ? activeIndex + 1 : 0;
      return [...withoutTrack.slice(0, insertAt), track, ...withoutTrack.slice(insertAt)];
    });
    if (!currentTrack && !currentRadioStation) {
      setAutoPlayOnTrackChange(false);
      setCurrentTrack(track);
    }
    rememberRecommendationFeedback(track, "play_next", 1.4);
    setStatus(`Queued ${display(track.title, "track")} next`);
  }

  function handleAddToQueue(track: Track) {
    setPlaybackQueue((current) => (current.some((item) => item.id === track.id) ? current : [...current, track]));
    if (!currentTrack && !currentRadioStation) {
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
    if (trackId <= 0) {
      return;
    }
    try {
      const updated = await markTrackPlayed(trackId);
      replaceTrackEverywhere(updated, { lightweightLibraryCache: true });
      void loadHistory();
    } catch {
      setStatus("Playback finished, but play history could not be saved.");
    }
  }

  async function handleTrackSkipped(trackId: number) {
    if (trackId <= 0) {
      return;
    }
    try {
      const updated = await markTrackSkipped(trackId);
      replaceTrackEverywhere(updated, { lightweightLibraryCache: true });
      void loadHistory();
    } catch {
      setStatus("Skip could not be saved.");
    }
  }

  async function handleFetchLyrics(trackOrId: Track | number): Promise<LyricsResponse> {
    const trackId = typeof trackOrId === "number" ? trackOrId : trackOrId.id;
    const sourceTrack = typeof trackOrId === "number" ? (currentTrack?.id === trackOrId ? currentTrack : null) : trackOrId;
    const useMetadataLookup = Boolean(sourceTrack && shouldLookupLyricsByMetadata(sourceTrack));
    try {
      const response = useMetadataLookup && sourceTrack
        ? await fetchLyricsByMetadata(lyricsLookupRequestForTrack(sourceTrack))
        : await fetchLyricsOnline(trackId);
      setLyrics(response);
      setStatus(response.is_synced ? "Fetched synced lyrics" : "Fetched lyrics");
      return response;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Could not fetch lyrics";
      const message =
        useMetadataLookup && /not found|no lyrics/i.test(rawMessage)
          ? "No matching lyrics found for this CD track"
          : rawMessage;
      setStatus(message);
      throw error;
    }
  }

  async function handleSaveLyrics(trackId: number, requestBody: LyricsUpdateRequest): Promise<LyricsResponse> {
    try {
      const response = await updateLyrics(trackId, requestBody);
      setLyrics(response);
      setStatus(requestBody.target === "file" ? "Lyrics saved to file and database" : "Lyrics saved to database");
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save lyrics";
      setStatus(message);
      throw error;
    }
  }

  return { handleShuffleTracks, handleQuickAutoDj, handleContinuousAutoDjChange, queueUpcomingPlaybackTracks, replaceUpcomingPlaybackQueue, extendContinuousAutoDj, handleAvoidAutoDj, handleRevealTrack, handleDeleteAutoDjAvoidRule, handleSaveRecommendationProfile, handleSetDefaultRecommendationProfile, handleDeleteRecommendationProfile, rememberRecommendationFeedback, recordTrackExitQuiet, ensureLatestCdPlaybackRequest, refreshCdPreviewTrack, commitPlayTrack, handlePlayTrack, handleCommitExternalTrackRequest, handlePlayCdPreviewTrack, handlePlayRadioStation, handleStopRadioStation, handlePlayNext, handleAddToQueue, handleMovePlaybackQueueTrack, handleReorderPlaybackQueueTrack, handleRemovePlaybackQueueTrack, handleClearPlaybackQueue, handleRestorePlaybackQueue, handleSavePlaybackQueue, handleTrackEnded, handleTrackSkipped, handleFetchLyrics, handleSaveLyrics };
}
