// @ts-nocheck
import { useEffect } from "react";

import {
  type ThemePalette,
  fontChoiceValues,
  themeAccentValues,
} from "../../config/theme";
import {
  fetchLyrics,
  fetchLyricsByMetadata,
  fetchLyricsOnline,
} from "../../lib/api";
import { listenFolderWatchEvents } from "../../lib/desktopPath";
import { desktopBackendJson } from "../../lib/desktopLibrary";
import {
  defaultLibraryTrackQueryKey,
  lyricsHaveText,
  lyricsLookupRequestForTrack,
  shouldLookupLyricsByMetadata,
  writeStartupLibrarySnapshot,
} from "../appHelpers";
import {
  fontScaleValues,
  shortcutMatchesEvent,
  storageKeys,
  type Page,
  type UiPreferences,
} from "../shared";
import type { LyricsResponse } from "../../types/api";
import {
  cachedLyricsResponse,
  hasRecentLyricsOnlineCheck,
  lyricsLookupCacheKey,
  lyricsTrackCacheKey,
  rememberLyricsResponse,
} from "./lyricsResponseCache";

const BODYLESS_SHORTCUT_METHODS = new Set(["GET", "HEAD"]);

function advancedHttpShortcutBody(binding) {
  if (BODYLESS_SHORTCUT_METHODS.has(binding.method)) {
    return { body: null, error: null };
  }
  if (!binding.bodyJson.trim()) {
    return { body: null, error: null };
  }
  try {
    return { body: JSON.parse(binding.bodyJson), error: null };
  } catch {
    return { body: null, error: "Invalid JSON body" };
  }
}

function advancedHttpShortcutLabel(binding) {
  return binding.label?.trim() || `${binding.method} ${binding.path}`;
}

export function useAppControllerEffects(model: any) {
  const {
    activePage,
    advancedTrackSearch,
    albums,
    artists,
    backendStatus,
    currentLibraryTrackQueryKey,
    currentTrack,
    debouncedAdvancedTrackSearch,
    debouncedSearch,
    detailTrack,
    FolderWatchRefreshTimerRef,
    folderPath,
    folderWatchStatus,
    handleFetchLyrics,
    handleOpenCurrentAlbumFromPlayer,
    handleOpenCurrentArtistFromPlayer,
    handleOpenCurrentTrackFromPlayer,
    handleOpenDetachedMiniPlayer,
    handleOpenLyricsViewFromPlayer,
    handleOpenQueueViewFromPlayer,
    handleSelectAlbum,
    handleSelectArtist,
    handleSelectPlaylist,
    handleUndoRecentChange,
    hasLoadedInitialLibrary,
    lastSessionRestoreFinishedRef,
    lastSessionWriteKeyRef,
    libraryCacheQueryKeyRef,
    libraryFolders,
    librarySort,
    libraryTotal,
    libraryView,
    loadAlbums,
    loadArtistInfo,
    loadArtists,
    loadAudioConversionSetup,
    loadAutoDjAvoidRules,
    loadBulkUndoLog,
    loadCdRipSetup,
    loadChromaprintSetup,
    loadClapCoverage,
    loadClapStatus,
    loadFolderWatchStatus,
    loadHistory,
    loadInbox,
    loadLibraryStats,
    loadAnalysisClapReadiness,
    loadPlaylists,
    loadRecommendationHistory,
    loadRecommendationProfiles,
    loadSettings,
    loadStartupDiagnostics,
    loadTracksPage,
    playbackQueue,
    playbackTime,
    playlists,
    priorityLibraryQueryKeyRef,
    refreshAnalyzedState,
    refreshTracks,
    restoredPlaybackPosition,
    restoreLastPlaybackSession,
    scheduleFolderWatchRefresh,
    search,
    selectedAlbumId,
    selectedArtistName,
    selectedPlaylistId,
    setActivePage,
    setAppContextMenu,
    setDebouncedAdvancedTrackSearch,
    setDebouncedSearch,
    setDetailTrack,
    setIsLyricsLoading,
    setLyrics,
    setSelectedArtistName,
    setSelectedArtistTracks,
    setSearch,
    setStatus,
    settings,
    showCdPage,
    startupBackgroundHydratedRef,
    status,
    trackIndexCacheRef,
    tracks,
    uiPreferences,
    undoAction,
    undoTimerRef,
    waitForBackendStartup,
    checkBackendStatus,
  } = model;

  useEffect(() => {
    void waitForBackendStartup();
  }, []);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    void loadSettings();
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ok" || startupBackgroundHydratedRef.current) {
      return;
    }
    startupBackgroundHydratedRef.current = true;
    const timers = [
      window.setTimeout(() => void loadLibraryStats(), 1200),
      window.setTimeout(() => void loadPlaylists(), 1700),
      window.setTimeout(() => void loadRecommendationProfiles(), 2400),
      window.setTimeout(() => void loadRecommendationHistory(), 3000),
      window.setTimeout(() => void loadAutoDjAvoidRules(), 3600),
      window.setTimeout(() => void loadFolderWatchStatus(), 4400),
      window.setTimeout(() => void loadCdRipSetup(), 5200),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    void restoreLastPlaybackSession();
  }, [backendStatus]);

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
      if (FolderWatchRefreshTimerRef.current !== null) {
        window.clearTimeout(FolderWatchRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let disposed = false;
    void listenFolderWatchEvents((event) => {
      const error = event.paths.find((path) => path.startsWith("watch-error:") || path.startsWith("watcher-error:")) ?? null;
      scheduleFolderWatchRefresh(event.event_count, error);
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      })
      .catch(() => {
        // Browser preview and older desktop builds do not have the Rust watcher.
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [folderWatchStatus?.folder_path, libraryFolders, folderPath, settings?.library_path]);

  useEffect(() => {
    if (!lastSessionRestoreFinishedRef.current) {
      return;
    }
    if (
      restoredPlaybackPosition !== null &&
      currentTrack &&
      playbackTime < Math.max(1, restoredPlaybackPosition - 1)
    ) {
      return;
    }

    const queueIds = playbackQueue.map((track) => track.id).slice(0, 200);
    const currentTrackId = currentTrack?.id ?? null;
    const positionSeconds = currentTrack ? Math.max(0, Math.floor(playbackTime)) : 0;
    const writeKey = `${currentTrackId ?? "none"}|${queueIds.join(",")}|${Math.floor(positionSeconds / 5)}`;

    if (lastSessionWriteKeyRef.current === writeKey) {
      return;
    }
    lastSessionWriteKeyRef.current = writeKey;

    try {
      window.localStorage.setItem(
        storageKeys.lastSession,
        JSON.stringify({
          currentTrackId,
          queueIds,
          positionSeconds,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Ignore local storage failures.
    }
  }, [currentTrack, currentTrack?.id, playbackQueue, playbackTime, restoredPlaybackPosition]);

  useEffect(() => {
    const saveLastPlaybackMoment = () => {
      if (!lastSessionRestoreFinishedRef.current) {
        return;
      }
      if (
        restoredPlaybackPosition !== null &&
        currentTrack &&
        playbackTime < Math.max(1, restoredPlaybackPosition - 1)
      ) {
        return;
      }
      try {
        window.localStorage.setItem(
          storageKeys.lastSession,
          JSON.stringify({
            currentTrackId: currentTrack?.id ?? null,
            queueIds: playbackQueue.map((track) => track.id).slice(0, 200),
            positionSeconds: currentTrack ? Math.max(0, Math.floor(playbackTime)) : 0,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // Ignore local storage failures while the app is closing.
      }
    };

    window.addEventListener("beforeunload", saveLastPlaybackMoment);
    return () => window.removeEventListener("beforeunload", saveLastPlaybackMoment);
  }, [currentTrack, playbackQueue, playbackTime, restoredPlaybackPosition]);

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
    const cssVariables: Partial<Record<keyof ThemePalette, string>> = {
      ember: "--color-ember",
      moss: "--color-moss",
      ink: "--color-ink",
      panel: "--color-panel",
      line: "--color-line",
      muted: "--color-muted",
      paper: "--color-paper",
      hoverPanel: "--color-hover-panel",
      sidebar: "--color-sidebar",
      strip: "--color-strip",
      subtle: "--color-subtle",
      popover: "--color-popover",
      quiet: "--color-quiet",
      mini: "--color-mini",
      miniPanel: "--color-mini-panel",
      surfaceGlow: "--color-surface-glow",
      primaryHover: "--color-primary-hover",
      softAccent: "--color-soft-accent",
      scrollTrack: "--color-scroll-track",
      scrollThumb: "--color-scroll-thumb",
      scrollThumbHover: "--color-scroll-thumb-hover",
    };
    for (const [key, variable] of Object.entries(cssVariables) as [keyof ThemePalette, string][]) {
      document.documentElement.style.setProperty(variable, accent[key]);
    }
    const selectedCheckboxAccent =
      uiPreferences.checkboxAccent === "theme" ? accent.checkboxAccent : uiPreferences.checkboxAccent;
    const checkboxAccent = {
      ember: accent.ember,
      moss: accent.moss,
      paper: accent.paper,
      softAccent: accent.softAccent,
    }[selectedCheckboxAccent] ?? accent.ember;
    document.documentElement.style.setProperty("--checkbox-accent", checkboxAccent);
    const selectedCheckboxUnchecked =
      uiPreferences.checkboxUnchecked === "theme" ? accent.checkboxUnchecked : uiPreferences.checkboxUnchecked;
    const checkboxUnchecked = {
      line: accent.line,
      muted: accent.muted,
      ember: accent.ember,
      moss: accent.moss,
      paper: accent.paper,
      softAccent: accent.softAccent,
    }[selectedCheckboxUnchecked] ?? accent.line;
    document.documentElement.style.setProperty("--checkbox-unchecked", checkboxUnchecked);
    const selectedFont =
      uiPreferences.fontChoice === "theme"
        ? accent.fontFamily
        : fontChoiceValues[uiPreferences.fontChoice] ?? accent.fontFamily;
    const selectedFontScale = uiPreferences.fontScale === "theme" ? accent.fontScale : uiPreferences.fontScale;
    const selectedDensity = uiPreferences.density === "theme" ? accent.density : uiPreferences.density;
    document.documentElement.style.setProperty("--font-sans", selectedFont);
    document.documentElement.style.fontSize = fontScaleValues[selectedFontScale] ?? fontScaleValues.default;
    document.documentElement.dataset.density = selectedDensity;
  }, [
    uiPreferences.themeAccent,
    uiPreferences.checkboxAccent,
    uiPreferences.checkboxUnchecked,
    uiPreferences.fontChoice,
    uiPreferences.fontScale,
    uiPreferences.density,
  ]);

  useEffect(() => {
    if (!status) {
      return;
    }
    const handle = window.setTimeout(() => setStatus(""), 3200);
    return () => window.clearTimeout(handle);
  }, [status]);

  useEffect(() => {
    if (!hasLoadedInitialLibrary || currentLibraryTrackQueryKey() !== defaultLibraryTrackQueryKey()) {
      return;
    }
    writeStartupLibrarySnapshot(tracks, libraryTotal);
  }, [tracks, libraryTotal, hasLoadedInitialLibrary, debouncedSearch, debouncedAdvancedTrackSearch, librarySort]);

  useEffect(() => {
    function closeFloatingDetails(event: MouseEvent) {
      const target = event.target as Node | null;
      setAppContextMenu(null);
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
      setAppContextMenu(null);
    }

    window.addEventListener("click", closeFloatingDetails);
    window.addEventListener("keydown", closeFloatingDetailsOnEscape);
    return () => {
      window.removeEventListener("click", closeFloatingDetails);
      window.removeEventListener("keydown", closeFloatingDetailsOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!detailTrack) {
      return;
    }

    function closeTrackDetailsOnClickAway(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-track-details-panel]")) {
        return;
      }
      setDetailTrack(null);
    }

    function closeTrackDetailsOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailTrack(null);
      }
    }

    window.addEventListener("pointerdown", closeTrackDetailsOnClickAway, true);
    window.addEventListener("keydown", closeTrackDetailsOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeTrackDetailsOnClickAway, true);
      window.removeEventListener("keydown", closeTrackDetailsOnEscape);
    };
  }, [detailTrack]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (activePage !== "library" && search) {
      setSearch("");
      setDebouncedSearch("");
    }
  }, [activePage, search]);

  useEffect(() => {
    if (backendStatus !== "ok" || activePage !== "library" || libraryView !== "tracks") {
      return;
    }
    const currentQueryKey = currentLibraryTrackQueryKey();
    if (priorityLibraryQueryKeyRef.current === currentQueryKey) {
      priorityLibraryQueryKeyRef.current = null;
      return;
    }
    if (libraryCacheQueryKeyRef.current === currentQueryKey && trackIndexCacheRef.current.size > 0) {
      return;
    }
    void refreshTracks();
  }, [backendStatus, activePage, libraryView, debouncedSearch, debouncedAdvancedTrackSearch, librarySort]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedAdvancedTrackSearch(advancedTrackSearch);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [advancedTrackSearch]);

  useEffect(() => {
    if (backendStatus !== "ok" || activePage !== "library") {
      return;
    }
    if (libraryView === "albums" || libraryView === "completion") {
      void loadAlbums();
    }
    if (libraryView === "artists") {
      void loadArtists();
    }
  }, [backendStatus, activePage, libraryView, debouncedSearch]);

  useEffect(() => {
    if (backendStatus !== "ok" || activePage !== "library" || libraryView !== "playlists") {
      return;
    }
    void loadPlaylists();
  }, [backendStatus, activePage, libraryView]);

  useEffect(() => {
    if (backendStatus !== "ok" || activePage !== "library") {
      return;
    }
    if (libraryView === "health") {
      void loadLibraryStats();
    }
    if (libraryView === "inbox") {
      void loadInbox();
    }
  }, [backendStatus, activePage, libraryView]);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    if (activePage === "analysis") {
      void loadAnalysisClapReadiness(false);
    }
    if (activePage === "history") {
      void loadHistory();
    }
    if (activePage === "autodj") {
      void loadAutoDjAvoidRules();
      void loadRecommendationProfiles();
      void loadRecommendationHistory();
    }
    if (activePage === "sources") {
      void loadFolderWatchStatus();
    }
    if (activePage === "cd") {
      void loadCdRipSetup();
    }
    if (activePage === "fileManagement") {
      void loadBulkUndoLog();
      void loadChromaprintSetup();
      void loadAudioConversionSetup();
      void loadCdRipSetup();
      void loadFolderWatchStatus();
      void loadClapStatus();
    }
    if (activePage === "settings") {
      void loadStartupDiagnostics(false);
    }
  }, [backendStatus, activePage]);

  useEffect(() => {
    setAppContextMenu(null);
    if (activePage !== "library") {
      setDetailTrack(null);
    }
  }, [activePage]);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    const handle = window.setInterval(() => {
      void loadFolderWatchStatus();
    }, 7000);
    return () => window.clearInterval(handle);
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ok") {
      return;
    }
    const handle = window.setInterval(() => {
      void loadCdRipSetup();
    }, 30000);
    return () => window.clearInterval(handle);
  }, [backendStatus]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      const shortcuts: Array<[Page, keyof UiPreferences["keyboardShortcuts"]]> = [
        ["library", "page.library"],
        ["analysis", "page.analysis"],
        ["nowPlaying", "page.nowPlaying"],
        ["artist", "page.artist"],
        ["audiobooks", "page.audiobooks"],
        ["podcasts", "page.podcasts"],
        ["radio", "page.radio"],
        ["scrobbling", "page.scrobbling"],
        ["cd", "page.cd"],
        ["history", "page.history"],
        ["autodj", "page.autodj"],
        ["sources", "page.sources"],
        ["fileManagement", "page.fileManagement"],
        ["settings", "page.settings"],
      ];
      const match = shortcuts.find(([, action]) => shortcutMatchesEvent(uiPreferences.keyboardShortcuts[action], event));
      if (match) {
        event.preventDefault();
        setActivePage(match[0]);
        return;
      }

      const appActions: Array<[keyof UiPreferences["keyboardShortcuts"], () => void | Promise<void>]> = [
        ["app.openMiniPlayer", handleOpenDetachedMiniPlayer],
        ["app.openLyrics", handleOpenLyricsViewFromPlayer],
        ["app.openQueue", handleOpenQueueViewFromPlayer],
        ["app.openCurrentTrack", () => {
          if (currentTrack) {
            handleOpenCurrentTrackFromPlayer(currentTrack);
          }
        }],
        ["app.openCurrentArtist", () => {
          if (currentTrack) {
            handleOpenCurrentArtistFromPlayer(currentTrack);
          }
        }],
        ["app.openCurrentAlbum", () => {
          if (currentTrack) {
            void handleOpenCurrentAlbumFromPlayer(currentTrack);
          }
        }],
        ["app.undoRecent", handleUndoRecentChange],
      ];
      const appMatch = appActions.find(([action]) => shortcutMatchesEvent(uiPreferences.keyboardShortcuts[action], event));
      if (appMatch) {
        event.preventDefault();
        void appMatch[1]();
        return;
      }
      if (Object.values(uiPreferences.keyboardShortcuts).some((shortcut) => shortcutMatchesEvent(shortcut, event))) {
        return;
      }

      const advancedMatch = (uiPreferences.advancedHttpShortcuts ?? []).find((binding) => shortcutMatchesEvent(binding.shortcut, event));
      if (advancedMatch) {
        event.preventDefault();
        const label = advancedHttpShortcutLabel(advancedMatch);
        const path = advancedMatch.path.trim();
        if (!path.startsWith("/")) {
          setStatus(`${label} needs a route path that starts with /`);
          return;
        }
        if (/[{}]/.test(path)) {
          setStatus(`${label} still has route placeholders`);
          return;
        }
        const { body, error } = advancedHttpShortcutBody(advancedMatch);
        if (error) {
          setStatus(`${label}: ${error}`);
          return;
        }
        void desktopBackendJson<unknown>(advancedMatch.method, path, body).then(
          () => setStatus(`Ran ${label}`),
          (routeError) => setStatus(routeError instanceof Error ? routeError.message : `Could not run ${label}`),
        );
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uiPreferences.keyboardShortcuts, uiPreferences.advancedHttpShortcuts, currentTrack, albums, undoAction]);

  useEffect(() => {
    if (!selectedAlbumId && albums[0]) {
      void handleSelectAlbum(albums[0].id);
    }
  }, [albums, selectedAlbumId]);

  useEffect(() => {
    if (!artists.length) {
      setSelectedArtistName(null);
      setSelectedArtistTracks([]);
      return;
    }
    if (!selectedArtistName || !artists.some((artist) => artist.name === selectedArtistName)) {
      void handleSelectArtist(artists[0].name);
    }
  }, [artists, selectedArtistName]);

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

    if (shouldLookupLyricsByMetadata(currentTrack)) {
      const lookupRequest = lyricsLookupRequestForTrack(currentTrack);
      const lookupCacheKey = lyricsLookupCacheKey(lookupRequest);
      const emptyLyrics: LyricsResponse = {
        track_id: currentTrack.id,
        lyrics: null,
        source: null,
        is_synced: false,
      };
      const cached = cachedLyricsResponse(lookupCacheKey);
      if (cached) {
        setLyrics(cached);
        setIsLyricsLoading(false);
        return () => {
          cancelled = true;
        };
      }
      if (!uiPreferences.autoFetchLyrics) {
        setLyrics(emptyLyrics);
        setIsLyricsLoading(false);
        return () => {
          cancelled = true;
        };
      }

      setIsLyricsLoading(true);
      void fetchLyricsByMetadata(lookupRequest)
        .then((response) => {
          rememberLyricsResponse(lookupCacheKey, response, { onlineChecked: true });
          if (!cancelled) {
            setLyrics(response);
          }
        })
        .catch(() => {
          rememberLyricsResponse(lookupCacheKey, emptyLyrics, { onlineChecked: true });
          if (!cancelled) {
            setLyrics(emptyLyrics);
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
    }

    const trackLyricsCacheKey = lyricsTrackCacheKey(currentTrack.id, currentTrack.path);
    const cached = cachedLyricsResponse(trackLyricsCacheKey);
    if (cached) {
      setLyrics(cached);
      const shouldFetchOnlineLyrics =
        uiPreferences.autoFetchLyrics &&
        (!lyricsHaveText(cached) || (uiPreferences.autoFetchLrcWhenPlainPresent && !cached.is_synced)) &&
        !hasRecentLyricsOnlineCheck(trackLyricsCacheKey);
      if (!shouldFetchOnlineLyrics) {
        setIsLyricsLoading(false);
        return () => {
          cancelled = true;
        };
      }

      setIsLyricsLoading(!lyricsHaveText(cached));
      void fetchLyricsOnline(currentTrack.id)
        .then((fetched) => {
          rememberLyricsResponse(trackLyricsCacheKey, fetched, { onlineChecked: true });
          if (!cancelled) {
            setLyrics(fetched);
          }
        })
        .catch(() => {
          rememberLyricsResponse(trackLyricsCacheKey, cached, { onlineChecked: true });
        })
        .finally(() => {
          if (!cancelled) {
            setIsLyricsLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    setIsLyricsLoading(true);
    void fetchLyrics(currentTrack.id)
      .then(async (response) => {
        rememberLyricsResponse(trackLyricsCacheKey, response);
        if (!cancelled) {
          setLyrics(response);
          if (lyricsHaveText(response)) {
            setIsLyricsLoading(false);
          }
        }
        const shouldFetchOnlineLyrics =
          uiPreferences.autoFetchLyrics &&
          (!lyricsHaveText(response) || (uiPreferences.autoFetchLrcWhenPlainPresent && !response.is_synced)) &&
          !hasRecentLyricsOnlineCheck(trackLyricsCacheKey);
        if (!cancelled && shouldFetchOnlineLyrics) {
          try {
            const fetched = await fetchLyricsOnline(currentTrack.id);
            rememberLyricsResponse(trackLyricsCacheKey, fetched, { onlineChecked: true });
            if (!cancelled) {
              setLyrics(fetched);
            }
          } catch {
            rememberLyricsResponse(trackLyricsCacheKey, response, { onlineChecked: true });
            // Missing online lyrics should not interrupt normal local playback or page loading.
          }
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
  }, [
    currentTrack?.id,
    currentTrack?.path,
    currentTrack?.title,
    currentTrack?.artist,
    currentTrack?.album,
    currentTrack?.album_artist,
    currentTrack?.duration_seconds,
    currentTrack?.is_preview,
    uiPreferences.autoFetchLyrics,
    uiPreferences.autoFetchLrcWhenPlainPresent,
  ]);

  useEffect(() => {
    if (activePage !== "artist") {
      return;
    }
    void loadArtistInfo(false);
  }, [activePage, currentTrack?.artist, uiPreferences.enableArtistLookup]);
}
