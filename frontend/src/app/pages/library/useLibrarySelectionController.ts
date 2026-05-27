import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchTracks } from "../../../lib/api";
import type { Track } from "../../../types/api";
import { display } from "../../shared";

export function useLibrarySelectionController(model: any) {
  const {
    advancedSelectionKey, advancedTrackSearch, detailTrack, inbox, libraryView, onEditTrack, onRequestDeleteTracks,
    search, searchInputRef, setBulkMetadataOpen, setDetailTrack, setShowAllDuplicateGroups, selectedAlbumId, selectedArtistName,
    selectedPlaylistId, sort, totalTracks, tracks, viewTracks,
  } = model;
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(() => new Set());
  const [selectedTrackCache, setSelectedTrackCache] = useState<Map<number, Track>>(() => new Map());
  const [isSelectingAllTracks, setIsSelectingAllTracks] = useState(false);
  const selectionAnchorId = useRef<number | null>(null);

  const viewTrackLookup = useMemo(() => new Map(viewTracks.map((track: Track) => [track.id, track] as const)), [viewTracks]);
  const selectedIds = useMemo(() => Array.from(selectedTrackIds), [selectedTrackIds]);
  const selectedTracks = selectedIds
    .map((trackId) => selectedTrackCache.get(trackId) ?? viewTrackLookup.get(trackId))
    .filter((track): track is Track => Boolean(track));
  const selectableTrackCount = libraryView === "tracks" ? totalTracks : viewTracks.length;
  const allViewSelected = selectableTrackCount > 0 && (libraryView === "tracks" ? selectedTrackIds.size >= selectableTrackCount : viewTracks.every((track: Track) => selectedTrackIds.has(track.id)));
  const inboxNotesByTrackId = new Map<number, any>((inbox?.notes ?? []).map((note: any) => [note.track_id, note]));
  const selectedInboxTrack = libraryView === "inbox" && selectedTracks.length === 1 ? selectedTracks[0] : null;
  const selectedInboxNote = selectedInboxTrack ? inboxNotesByTrackId.get(selectedInboxTrack.id) ?? null : null;

  useEffect(() => {
    setSelectedTrackCache((current) => {
      let changed = false;
      const next = new Map(current);
      for (const track of viewTracks) {
        if (next.get(track.id) !== track) {
          next.set(track.id, track);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [viewTracks]);

  useEffect(() => {
    clearSelection();
  }, [libraryView, search, advancedSelectionKey, selectedAlbumId, selectedArtistName, selectedPlaylistId]);

  useEffect(() => {
    if (libraryView === "tracks") {
      return;
    }
    const visibleIds = new Set(viewTracks.map((track: Track) => track.id));
    setSelectedTrackIds((current) => {
      const next = new Set(Array.from(current).filter((trackId) => visibleIds.has(trackId)));
      return next.size === current.size ? current : next;
    });
  }, [libraryView, viewTracks]);

  useEffect(() => {
    function handleLibraryShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        void selectAllCurrentScope();
        return;
      }
      if (target?.closest("input, textarea, select, button, a, [contenteditable='true']")) {
        return;
      }
      if (event.key === "F2") {
        const editableTrack = selectedTracks[0] ?? detailTrack;
        if (!editableTrack) {
          return;
        }
        event.preventDefault();
        selectedIds.length > 1 ? setBulkMetadataOpen(true) : onEditTrack(editableTrack);
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "e" && selectedIds.length > 0) {
        event.preventDefault();
        setBulkMetadataOpen(true);
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "d" && libraryView === "health") {
        event.preventDefault();
        setShowAllDuplicateGroups((current: boolean) => !current);
        return;
      }
      if (event.key !== "Delete" || (selectedIds.length === 0 && !detailTrack)) {
        return;
      }
      event.preventDefault();
      if (selectedIds.length > 0) {
        onRequestDeleteTracks(selectedIds, selectedIds.length === 1 ? display(selectedTracks[0]?.title, "Selected track") : `${selectedIds.length.toLocaleString()} selected tracks`);
      } else if (detailTrack) {
        onRequestDeleteTracks([detailTrack.id], display(detailTrack.title, "Selected track"));
      }
    }
    window.addEventListener("keydown", handleLibraryShortcut);
    return () => window.removeEventListener("keydown", handleLibraryShortcut);
  }, [selectedIds, selectedTracks, detailTrack, libraryView, search, sort, advancedTrackSearch, tracks.length, totalTracks, viewTracks, onEditTrack, onRequestDeleteTracks]);

  function toggleTrackSelection(trackId: number) {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      next.has(trackId) ? next.delete(trackId) : next.add(trackId);
      return next;
    });
  }

  function selectSingleTrack(track: Track) {
    selectionAnchorId.current = track.id;
    setSelectedTrackIds(new Set([track.id]));
    setSelectedTrackCache((current) => {
      if (current.get(track.id) === track) {
        return current;
      }
      const next = new Map(current);
      next.set(track.id, track);
      return next;
    });
  }

  function selectTrackLikeWindows(event: ReactMouseEvent, track: Track, list: Track[]) {
    setDetailTrack(track);
    const extendRange = event.shiftKey && selectionAnchorId.current !== null;
    const keepExisting = event.ctrlKey || event.metaKey;
    if (extendRange) {
      const anchorIndex = list.findIndex((item) => item.id === selectionAnchorId.current);
      const targetIndex = list.findIndex((item) => item.id === track.id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        const rangeIds = list.slice(start, end + 1).map((item) => item.id);
        setSelectedTrackIds((current) => {
          const next = keepExisting ? new Set(current) : new Set<number>();
          for (const trackId of rangeIds) {
            next.add(trackId);
          }
          return next;
        });
        return;
      }
    }
    selectionAnchorId.current = track.id;
    keepExisting ? toggleTrackSelection(track.id) : selectSingleTrack(track);
  }

  function setSelectionForList(list: Track[], selected: boolean) {
    selectionAnchorId.current = selected ? list[0]?.id ?? null : null;
    if (selected) {
      setSelectedTrackCache((current) => {
        let changed = false;
        const next = new Map(current);
        for (const track of list) {
          if (next.get(track.id) !== track) {
            next.set(track.id, track);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      for (const track of list) {
        selected ? next.add(track.id) : next.delete(track.id);
      }
      return next;
    });
  }

  async function selectAllCurrentScope() {
    if (libraryView !== "tracks" || tracks.length >= totalTracks) {
      setSelectionForList(viewTracks, true);
      return;
    }
    setIsSelectingAllTracks(true);
    try {
      const allTracks = await fetchTracks(search, { sortBy: sort.key, sortDirection: sort.direction, advancedFilters: advancedTrackSearch });
      setSelectedTrackCache((current) => {
        const next = new Map(current);
        for (const track of allTracks) {
          next.set(track.id, track);
        }
        return next;
      });
      setSelectedTrackIds(new Set(allTracks.map((track) => track.id)));
      selectionAnchorId.current = allTracks[0]?.id ?? null;
    } catch {
      setSelectionForList(viewTracks, true);
    } finally {
      setIsSelectingAllTracks(false);
    }
  }

  function handleHeaderSelectionChange(checked: boolean) {
    checked ? void selectAllCurrentScope() : clearSelection();
  }

  function suppressCheckboxContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function clearSelection() {
    setSelectedTrackIds(new Set());
    selectionAnchorId.current = null;
  }

  return {
    selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks,
    selectionAnchorId, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId,
    selectedInboxTrack, selectedInboxNote, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList,
    selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection,
  };
}
