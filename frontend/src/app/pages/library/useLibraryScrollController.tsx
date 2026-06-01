import type {
MutableRefObject,
UIEvent as ReactUIEvent,
} from "react";
import {
useEffect,
useLayoutEffect,
useMemo,
useRef,
useState,
} from "react";

import { LIBRARY_PAGE_SIZE } from "../../shared";
import {
ALBUM_GRID_ROW_HEIGHT,
ALBUM_LIST_ROW_HEIGHT,
ARTIST_ROW_HEIGHT,
COMPLETION_COLLAPSED_ROW_HEIGHT,
COMPLETION_EXPANDED_ROW_ESTIMATE,
PLAYLIST_ROW_HEIGHT,
PLAYLIST_TOOLBAR_HEIGHT,
TRACK_VIRTUALIZATION_OVERSCAN,
TRACK_VIRTUALIZATION_THRESHOLD,
virtualCollectionWindow,
virtualVariableCollectionWindow,
} from "./libraryViewUtils";

export function useLibraryScrollController(model: any) {
  const {
    ArrowUp, albumGrid, albumMode, albumScrollTop, albums, artistScrollTop, artists, columnMenu, completionHeightVersion,
    completionOpenAlbumId, completionScrollTop, hasMoreTracks, isLoading, libraryActionsMenu, libraryView, loadMoreTracks,
    loadTrackWindow, playlistScrollTop, playlists, scrollTop, setColumnMenu,
    setCompletionHeightVersion, setCompletionScrollTop, setContextMenu, setLibraryActionsMenu, 
    setScrollTop, totalTracks, trackIndexCache,
    trackRowHeight, tracks, visibleCompletionAlbums,
  } = model;

  const [virtualScrollTop, setVirtualScrollTop] = useState(scrollTop);
  const [trackViewportHeight, setTrackViewportHeight] = useState(720);
  const [artistPaneHeight, setArtistPaneHeight] = useState(720);
  const [albumPaneHeight, setAlbumPaneHeight] = useState(720);
  const [playlistPaneHeight, setPlaylistPaneHeight] = useState(720);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRenderFrameRef = useRef<number | null>(null);
  const pendingRenderScrollTopRef = useRef(scrollTop);
  const scrollSaveTimerRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(scrollTop);
  const lastSavedScrollTopRef = useRef(scrollTop);
  const trackPageLoadInFlightRef = useRef(false);
  const restoringTrackScrollRef = useRef(false);
  const restoreScrollTargetRef = useRef(scrollTop);
  const restoreScrollFrameRef = useRef<number | null>(null);
  const suppressScrollSaveRef = useRef(false);
  const lastTrackCountRef = useRef(tracks.length);
  const artistListRef = useRef<HTMLElement | null>(null);
  const albumListRef = useRef<HTMLElement | null>(null);
  const completionListRef = useRef<HTMLDivElement | null>(null);
  const completionRowHeightsRef = useRef<Map<number, number>>(new Map());
  const completionRowObserversRef = useRef<Map<number, ResizeObserver>>(new Map());
  const playlistListRef = useRef<HTMLElement | null>(null);

  const shouldVirtualizeTrackRows = libraryView === "tracks" && totalTracks > TRACK_VIRTUALIZATION_THRESHOLD;
  const maxVirtualScrollTop = Math.max(0, totalTracks * trackRowHeight - trackViewportHeight);
  const effectiveVirtualScrollTop = Math.min(virtualScrollTop, maxVirtualScrollTop);
  const virtualTrackStartIndex = shouldVirtualizeTrackRows
    ? Math.max(0, Math.floor(effectiveVirtualScrollTop / trackRowHeight) - TRACK_VIRTUALIZATION_OVERSCAN)
    : 0;
  const virtualTrackVisibleCount = Math.ceil(trackViewportHeight / trackRowHeight) + TRACK_VIRTUALIZATION_OVERSCAN * 2;
  const virtualTrackEndIndex = shouldVirtualizeTrackRows
    ? Math.min(totalTracks, virtualTrackStartIndex + virtualTrackVisibleCount)
    : tracks.length;
  const renderedTrackList = shouldVirtualizeTrackRows ? tracks.slice(virtualTrackStartIndex, virtualTrackEndIndex) : tracks;
  const virtualTopSpacerHeight = shouldVirtualizeTrackRows ? virtualTrackStartIndex * trackRowHeight : 0;
  const virtualBottomSpacerHeight = shouldVirtualizeTrackRows ? Math.max(0, (totalTracks - virtualTrackEndIndex) * trackRowHeight) : 0;
  const completionListScrollTop = Math.max(0, completionScrollTop - (completionListRef.current?.offsetTop ?? 0));
  const completionWindow = useMemo(
    () =>
      virtualVariableCollectionWindow(
        visibleCompletionAlbums,
        completionListScrollTop,
        trackViewportHeight,
        (album: any) =>
          completionRowHeightsRef.current.get(album.id) ??
          (completionOpenAlbumId === album.id ? COMPLETION_EXPANDED_ROW_ESTIMATE : COMPLETION_COLLAPSED_ROW_HEIGHT),
      ),
    [completionHeightVersion, completionListScrollTop, completionOpenAlbumId, trackViewportHeight, visibleCompletionAlbums],
  );
  const renderedCompletionAlbums = visibleCompletionAlbums.slice(completionWindow.startIndex, completionWindow.endIndex);
  const artistWindow = virtualCollectionWindow(artists.length, artistScrollTop, artistPaneHeight, ARTIST_ROW_HEIGHT);
  const renderedArtists = artists.slice(artistWindow.startIndex, artistWindow.endIndex);
  const albumGridColumns = albumGrid ? 2 : 1;
  const albumBrowseRowHeight = albumGrid ? ALBUM_GRID_ROW_HEIGHT : ALBUM_LIST_ROW_HEIGHT;
  const albumWindow = virtualCollectionWindow(albums.length, albumScrollTop, albumPaneHeight, albumBrowseRowHeight, albumGridColumns);
  const renderedBrowseAlbums = albums.slice(albumWindow.startIndex, albumWindow.endIndex);
  const playlistWindow = virtualCollectionWindow(playlists.length, Math.max(0, playlistScrollTop - PLAYLIST_TOOLBAR_HEIGHT), playlistPaneHeight, PLAYLIST_ROW_HEIGHT);
  const renderedPlaylists = playlists.slice(playlistWindow.startIndex, playlistWindow.endIndex);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    if (libraryView !== "tracks") {
      restoringTrackScrollRef.current = false;
      suppressScrollSaveRef.current = true;
      const nextScrollTop = libraryView === "albums" && albumMode === "completion" ? completionScrollTop : 0;
      element.scrollTop = nextScrollTop;
      pendingRenderScrollTopRef.current = nextScrollTop;
      setVirtualScrollTop(nextScrollTop);
      if (restoreScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreScrollFrameRef.current);
      }
      restoreScrollFrameRef.current = window.requestAnimationFrame(() => {
        restoreScrollFrameRef.current = null;
        suppressScrollSaveRef.current = false;
      });
      return;
    }
    restoreScrollTargetRef.current = scrollTop;
    restoringTrackScrollRef.current = libraryView === "tracks" && scrollTop > 0;
    pendingScrollTopRef.current = scrollTop;
    lastSavedScrollTopRef.current = scrollTop;
    if (applyScrollRestore(element, scrollTop)) {
      restoringTrackScrollRef.current = false;
    }
  }, [albumMode, libraryView]);

  useLayoutEffect(() => {
    if (libraryView !== "tracks") {
      lastTrackCountRef.current = tracks.length;
      return;
    }
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const targetScrollTop = restoreScrollTargetRef.current;
    const reachableScrollTop = getReachableScrollTop(element);
    const trackCountShrank = tracks.length < lastTrackCountRef.current;
    lastTrackCountRef.current = tracks.length;
    if (trackCountShrank && targetScrollTop > reachableScrollTop + 4 && hasMoreTracks) {
      restoringTrackScrollRef.current = true;
    }
    if (!restoringTrackScrollRef.current) {
      return;
    }
    const reachedTarget = applyScrollRestore(element, targetScrollTop);
    if (reachedTarget || !hasMoreTracks) {
      restoringTrackScrollRef.current = false;
      pendingScrollTopRef.current = element.scrollTop;
      lastSavedScrollTopRef.current = element.scrollTop;
    }
  }, [hasMoreTracks, libraryView, totalTracks, tracks.length, trackViewportHeight]);

  useEffect(() => {
    if (!restoringTrackScrollRef.current || libraryView !== "tracks" || isLoading || !hasMoreTracks) {
      return;
    }
    const element = scrollRef.current;
    if (!element || trackPageLoadInFlightRef.current || restoreScrollTargetRef.current <= getReachableScrollTop(element) + 4) {
      return;
    }
    trackPageLoadInFlightRef.current = true;
    void Promise.resolve(loadMoreTracks()).finally(() => {
      trackPageLoadInFlightRef.current = false;
    });
  }, [hasMoreTracks, isLoading, libraryView, loadMoreTracks, totalTracks, tracks.length, trackViewportHeight]);

  useEffect(() => {
    if (libraryView !== "tracks" || !shouldVirtualizeTrackRows || totalTracks <= 0) {
      return;
    }
    const firstPrefetchIndex = Math.max(0, virtualTrackStartIndex - LIBRARY_PAGE_SIZE);
    const lastPrefetchIndex = Math.min(totalTracks - 1, virtualTrackEndIndex + LIBRARY_PAGE_SIZE);
    const firstPageOffset = Math.floor(firstPrefetchIndex / LIBRARY_PAGE_SIZE) * LIBRARY_PAGE_SIZE;
    const lastPageOffset = Math.floor(lastPrefetchIndex / LIBRARY_PAGE_SIZE) * LIBRARY_PAGE_SIZE;
    for (let offset = firstPageOffset; offset <= lastPageOffset; offset += LIBRARY_PAGE_SIZE) {
      const pageEnd = Math.min(totalTracks, offset + LIBRARY_PAGE_SIZE);
      let hasMissingRows = false;
      for (let index = offset; index < pageEnd; index += 1) {
        if (!trackIndexCache.has(index)) {
          hasMissingRows = true;
          break;
        }
      }
      if (hasMissingRows) {
        void loadTrackWindow(offset, pageEnd - offset);
      }
    }
  }, [libraryView, loadTrackWindow, shouldVirtualizeTrackRows, totalTracks, trackIndexCache, virtualTrackEndIndex, virtualTrackStartIndex]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return undefined;
    }
    const updateHeight = () => setTrackViewportHeight(Math.max(240, element.clientHeight || 720));
    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => window.removeEventListener("resize", updateHeight);
    }
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const paneConfigs: Array<[MutableRefObject<HTMLElement | null>, (height: number) => void]> = [
      [artistListRef, setArtistPaneHeight],
      [albumListRef, setAlbumPaneHeight],
      [playlistListRef, setPlaylistPaneHeight],
    ];
    const cleanups = paneConfigs.map(([ref, setHeight]) => {
      const element = ref.current;
      if (!element) {
        return () => undefined;
      }
      const updateHeight = () => setHeight(Math.max(240, element.clientHeight || 720));
      updateHeight();
      if (typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", updateHeight);
        return () => window.removeEventListener("resize", updateHeight);
      }
      const observer = new ResizeObserver(updateHeight);
      observer.observe(element);
      return () => observer.disconnect();
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [libraryView, albumMode]);

  useLayoutEffect(() => {
    if (libraryView === "artists" && artistListRef.current) {
      artistListRef.current.scrollTop = artistScrollTop;
    }
  }, [artists.length, artistScrollTop, libraryView]);

  useLayoutEffect(() => {
    if (libraryView === "albums" && albumMode === "browse" && albumListRef.current) {
      albumListRef.current.scrollTop = albumScrollTop;
    }
  }, [albumMode, albumScrollTop, albums.length, libraryView]);

  useLayoutEffect(() => {
    if (libraryView === "playlists" && playlistListRef.current) {
      playlistListRef.current.scrollTop = playlistScrollTop;
    }
  }, [libraryView, playlistScrollTop, playlists.length]);

  useEffect(() => {
    return () => {
      for (const observer of completionRowObserversRef.current.values()) {
        observer.disconnect();
      }
      completionRowObserversRef.current.clear();
      if (scrollRenderFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollRenderFrameRef.current);
      }
      if (scrollSaveTimerRef.current !== null) {
        window.clearTimeout(scrollSaveTimerRef.current);
      }
      if (restoreScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreScrollFrameRef.current);
      }
      flushScrollPositionSave();
    };
  }, []);

  function getReachableScrollTop(element: HTMLElement) {
    return Math.max(0, element.scrollHeight - element.clientHeight);
  }

  function applyScrollRestore(element: HTMLElement, targetScrollTop: number) {
    const reachableScrollTop = getReachableScrollTop(element);
    const nextScrollTop = Math.min(targetScrollTop, reachableScrollTop);
    suppressScrollSaveRef.current = true;
    element.scrollTop = nextScrollTop;
    pendingRenderScrollTopRef.current = nextScrollTop;
    setVirtualScrollTop((current: number) => (Math.abs(current - nextScrollTop) < 4 ? current : nextScrollTop));
    if (restoreScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreScrollFrameRef.current);
    }
    restoreScrollFrameRef.current = window.requestAnimationFrame(() => {
      restoreScrollFrameRef.current = null;
      suppressScrollSaveRef.current = false;
    });
    return targetScrollTop <= reachableScrollTop + 4;
  }

  function cancelScrollRestoreForUserInput() {
    if (!restoringTrackScrollRef.current) {
      return;
    }
    restoringTrackScrollRef.current = false;
    const element = scrollRef.current;
    if (element) {
      pendingScrollTopRef.current = element.scrollTop;
      scheduleScrollPositionSave(element.scrollTop);
    }
  }

  function scrollCollectionPaneToTop(ref: MutableRefObject<HTMLElement | null>, saveScrollTop: (value: number) => void) {
    saveScrollTop(0);
    ref.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveTrackPaneScrollTop(value: number) {
    pendingRenderScrollTopRef.current = value;
    setVirtualScrollTop(value);
    scheduleScrollPositionSave(value);
  }

  function renderPaneTopButton(visible: boolean, label: string, ref: MutableRefObject<HTMLElement | null>, saveScrollTop: (value: number) => void, placement: "fixed" | "pane" = "pane") {
    if (!visible) {
      return null;
    }
    const placementClass = placement === "fixed" ? "fixed bottom-32 right-5 z-[80]" : "absolute bottom-4 right-4 z-30";
    return (
      <button aria-label={label} className={`${placementClass} grid h-9 w-9 place-items-center rounded-full border border-line bg-panel/95 text-muted shadow-lg shadow-black/30 backdrop-blur transition hover:border-moss/60 hover:text-white`} type="button" title={label} onClick={() => scrollCollectionPaneToTop(ref, saveScrollTop)}>
        <ArrowUp size={15} />
      </button>
    );
  }

  function renderActiveTopButton() {
    if (libraryView === "tracks") {
      return renderPaneTopButton(Math.max(virtualScrollTop, scrollTop) > 160, "Back to top", scrollRef, saveTrackPaneScrollTop, "fixed");
    }
    if (libraryView === "albums" && albumMode === "completion") {
      return renderPaneTopButton(completionScrollTop > 160, "Back to top", scrollRef, setCompletionScrollTop, "fixed");
    }
    return null;
  }

  function updateCompletionRowHeight(albumId: number, height: number) {
    const previous = completionRowHeightsRef.current.get(albumId);
    if (previous !== undefined && Math.abs(previous - height) < 2) {
      return;
    }
    completionRowHeightsRef.current.set(albumId, height);
    setCompletionHeightVersion((current: number) => current + 1);
  }

  function setCompletionRowElement(albumId: number, element: HTMLDivElement | null) {
    const existingObserver = completionRowObserversRef.current.get(albumId);
    if (existingObserver) {
      existingObserver.disconnect();
      completionRowObserversRef.current.delete(albumId);
    }
    if (!element) {
      return;
    }
    const measure = () => updateCompletionRowHeight(albumId, element.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    completionRowObserversRef.current.set(albumId, observer);
  }

  function scheduleVirtualScrollUpdate(nextScrollTop: number) {
    pendingRenderScrollTopRef.current = nextScrollTop;
    if (scrollRenderFrameRef.current !== null) {
      return;
    }
    scrollRenderFrameRef.current = window.requestAnimationFrame(() => {
      scrollRenderFrameRef.current = null;
      const next = pendingRenderScrollTopRef.current;
      setVirtualScrollTop((current: number) => (Math.abs(current - next) < 4 ? current : next));
    });
  }

  function flushScrollPositionSave() {
    const nextScrollTop = pendingScrollTopRef.current;
    if (nextScrollTop !== lastSavedScrollTopRef.current) {
      lastSavedScrollTopRef.current = nextScrollTop;
      setScrollTop(nextScrollTop);
    }
  }

  function scheduleScrollPositionSave(nextScrollTop: number) {
    restoreScrollTargetRef.current = nextScrollTop;
    pendingScrollTopRef.current = nextScrollTop;
    if (scrollSaveTimerRef.current !== null) {
      window.clearTimeout(scrollSaveTimerRef.current);
    }
    scrollSaveTimerRef.current = window.setTimeout(() => {
      scrollSaveTimerRef.current = null;
      flushScrollPositionSave();
    }, 160);
  }

  function handleScroll(event: ReactUIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (model.contextMenu) {
      setContextMenu(null);
    }
    if (columnMenu) {
      setColumnMenu(null);
    }
    if (libraryActionsMenu) {
      setLibraryActionsMenu(null);
    }
    if (libraryView === "tracks") {
      scheduleVirtualScrollUpdate(element.scrollTop);
    }
    if (libraryView === "albums" && albumMode === "completion" && !suppressScrollSaveRef.current) {
      setCompletionScrollTop(element.scrollTop);
    }
    if (libraryView === "tracks" && !suppressScrollSaveRef.current && !restoringTrackScrollRef.current) {
      scheduleScrollPositionSave(element.scrollTop);
    }
    if (libraryView !== "tracks") {
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (!shouldVirtualizeTrackRows && distanceFromBottom < 520 && hasMoreTracks && !isLoading && !trackPageLoadInFlightRef.current && !restoringTrackScrollRef.current) {
      trackPageLoadInFlightRef.current = true;
      void Promise.resolve(loadMoreTracks()).finally(() => {
        trackPageLoadInFlightRef.current = false;
      });
    }
  }

  return {
    virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef,
    albumListRef, completionListRef, completionRowHeightsRef, completionRowObserversRef, playlistListRef,
    shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex,
    virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight,
    completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists,
    albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists,
    getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop,
    saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement,
    scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, handleScroll,
  };
}
