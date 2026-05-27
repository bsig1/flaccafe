import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InboxAutoReviewField, InboxAutoReviewMatchType } from "../../../types/api";
import { LibraryCompletionView } from "./LibraryCompletionView";

type ArtworkPane = "artists" | "albums";

const ARTWORK_SCROLL_IDLE_MS = 180;
const MAX_ACTIVE_COLLECTION_ARTWORK = 96;

export function LibraryCollectionBranches({ model }: { model: any }) {
  const { Album, ArrowDown, ArrowUp, BarChart3, BookOpen, CheckCircle2, Download, Fingerprint, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Play, Podcast, Plus, RefreshCw, Save, Search, ShieldCheck, Shuffle, SkipForward, SlidersHorizontal, Star, Tag, Trash2, Upload, UserRound, Volume2, Wand2, X, RatingStars, ResizableHeader, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, albumArtworkUrl, albumCoverUrl, defaultLibraryVisibleColumns, libraryColumnDefinitions, librarySelectionColumnWidth, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatRating, formatShortDate, formatTime, trackGenre, albumMetaLabel, artistMetaLabel, missingMetadataFields, missingMetadataFilters, ALBUM_GRID_ROW_HEIGHT, ALBUM_LIST_ROW_HEIGHT, ARTIST_ROW_HEIGHT, COMPLETION_COLLAPSED_ROW_HEIGHT, COMPLETION_EXPANDED_ROW_ESTIMATE, LIBRARY_ACTIONS_MENU_HEIGHT, LIBRARY_ACTIONS_MENU_WIDTH, MENU_VIEWPORT_MARGIN, PLAYLIST_ROW_HEIGHT, PLAYLIST_TOOLBAR_HEIGHT, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_AVOID_SUBMENU_WIDTH, TRACK_CONTEXT_DIVIDER_HEIGHT, TRACK_CONTEXT_HEADER_HEIGHT, TRACK_CONTEXT_MENU_HEIGHT, TRACK_CONTEXT_MENU_WIDTH, TRACK_CONTEXT_ROW_HEIGHT, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_PLAYLIST_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT, TRACK_RATING_SUBMENU_WIDTH, TRACK_SUBMENU_CLOSE_DELAY_MS, TRACK_TAGGING_SUBMENU_HEIGHT, TRACK_VIRTUALIZATION_OVERSCAN, TRACK_VIRTUALIZATION_THRESHOLD, tracks, trackIndexCache, totalTracks, albums, artists, playlists, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, libraryStats, libraryHealth, inbox, targetPlaylistId, newPlaylistName, importPlaylistPath, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, setAdvancedTrackSearch, refreshTracks, refreshAlbums, loadMoreTracks, loadTrackWindow, isLoading, hasMoreTracks, sort, setSort, scrollTop, setScrollTop, artistScrollTop, setArtistScrollTop, albumScrollTop, setAlbumScrollTop, completionScrollTop, setCompletionScrollTop, playlistScrollTop, setPlaylistScrollTop, onRating, onBulkRating, onPlayTrack, onPlayNext, onAddToQueue, onSelectAlbum, onSelectArtist, onPlayAlbum, onPlayArtist, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onAutoTagTracks, onSyncFileMetadata, onFingerprintTagTracks, onClapGenreTagTracks, onVolumeTagTracks, onOpenFileManagementTracks, onRequestDeleteTracks, onRemoveTrackFromPlaylist, onRemoveTracksFromPlaylist, onMovePlaylistTrack, onExportTracks, onExportPlaylist, onImportPlaylist, onReviewInboxTracks, onUpdateInboxNote, onSaveInboxAutoReviewRule, onDeleteInboxAutoReviewRule, onShuffleTracks, onQuickAutoDj, onAvoidAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, onIgnoreDuplicateGroup, onClearIgnoredDuplicateGroups, isAudioAnalyzing, currentTrackId, currentTrack, hideFilePaths, compactRows, albumGrid, writeRatingsToFiles, libraryVisibleColumns, setLibraryVisibleColumns, onAlbumGridChange, setTargetPlaylistId, setNewPlaylistName, setImportPlaylistPath, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, columnWidths, setColumnWidths, contextMenu, setContextMenu, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, activeContextSubmenu, setActiveContextSubmenu, selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, showAllDuplicateGroups, setShowAllDuplicateGroups, showAllMissingMetadata, setShowAllMissingMetadata, missingMetadataFilter, setMissingMetadataFilter, bulkMetadataOpen, setBulkMetadataOpen, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, albumArtworkCandidates, setAlbumArtworkCandidates, isAlbumArtworkOpen, setIsAlbumArtworkOpen, isSearchingAlbumArtwork, setIsSearchingAlbumArtwork, albumArtworkStatus, setAlbumArtworkStatus, inboxNoteDraft, setInboxNoteDraft, editingInboxRuleId, setEditingInboxRuleId, inboxRuleName, setInboxRuleName, inboxRuleEnabled, setInboxRuleEnabled, inboxRuleField, setInboxRuleField, inboxRuleMatchType, setInboxRuleMatchType, inboxRuleValue, setInboxRuleValue, inboxRuleNote, setInboxRuleNote, inboxRuleApplyExisting, setInboxRuleApplyExisting, albumMode, setAlbumMode, artistPaneHeight, setArtistPaneHeight, albumPaneHeight, setAlbumPaneHeight, playlistPaneHeight, setPlaylistPaneHeight, completionFilter, setCompletionFilter, completionHeightVersion, setCompletionHeightVersion, completionOpenAlbumId, setCompletionOpenAlbumId, completionLoadingAlbumId, setCompletionLoadingAlbumId, completionLookupAlbumId, setCompletionLookupAlbumId, completionLookupMessages, setCompletionLookupMessages, completionLookupAllActive, setCompletionLookupAllActive, completionLookupAllProgress, setCompletionLookupAllProgress, showAdvancedSearch, setShowAdvancedSearch, virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, playlistListRef, contextMenuRef, searchInputRef, selectionAnchorId, completionLookupCancelRef, visibleColumns, visibleColumnDefs, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, rowPadding, trackRowHeight, loadedTrackCount, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, advancedSearchInputClass, activeAlbum, activeArtist, activePlaylist, missingMetadataRows, filteredMissingMetadataRows, visibleMissingMetadataRows, visibleDuplicateGroups, completionQuery, completionSearchTerms, completionMatchesSearch, albumCompletionExpected, albumCompletionMissing, completionAlbums, visibleCompletionAlbums, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, completeAlbumCount, missingTrackEstimate, advancedSelectionKey, completionLookupEta, librarySummaryText, viewTracks, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, resetInboxRuleForm, editInboxRule, saveInboxRule, handleSort, handleResize, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, loadAlbumArtworkCandidates, openAlbumArtworkManager, albumArtworkActionStatus, chooseSidecarArtwork, embedSidecarArtwork, saveEmbeddedArtwork, embedEmbeddedArtwork, searchWebArtwork, saveWebArtwork, clearSelectedAlbumArtwork, handleScroll, openTrackContextMenu, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart, columnTextClass, renderMetadataCell, renderTableHeader, isInteractiveTrackCellTarget, handleLibrarySurfaceClick, renderTrackRow, renderTrackPlaceholderRow, renderVirtualTrackRows, renderTrackRows, toggleCompletionAlbum, handleCompletionLengthLookup, handleCompletionLookupAll, cancelCompletionLookupAll, updateAdvancedTrackSearch, clearAdvancedTrackSearch, contextSelectionTracks, contextSelectionIds, contextBulk, contextLabel, contextPlaylistSubmenuHeight, contextSubmenuStyle, openContextSubmenu, scheduleContextSubmenuClose, contextSubmenuClass } = model;
  const [artworkPaused, setArtworkPaused] = useState<Record<ArtworkPane, boolean>>({
    artists: false,
    albums: false,
  });
  const artworkPausedRef = useRef(artworkPaused);
  const artworkTimersRef = useRef<Record<ArtworkPane, number | null>>({
    artists: null,
    albums: null,
  });
  const artworkQueueRef = useRef<string[]>([]);
  const [activeArtworkUrls, setActiveArtworkUrls] = useState<Set<string>>(() => new Set());

  const setArtworkPanePaused = useCallback((pane: ArtworkPane, paused: boolean) => {
    artworkPausedRef.current = { ...artworkPausedRef.current, [pane]: paused };
    setArtworkPaused((current) => (current[pane] === paused ? current : { ...current, [pane]: paused }));
  }, []);

  const pauseArtworkForScroll = useCallback(
    (pane: ArtworkPane) => {
      if (!artworkPausedRef.current[pane]) {
        setArtworkPanePaused(pane, true);
      }
      const activeTimer = artworkTimersRef.current[pane];
      if (activeTimer !== null) {
        window.clearTimeout(activeTimer);
      }
      artworkTimersRef.current[pane] = window.setTimeout(() => {
        artworkTimersRef.current[pane] = null;
        setArtworkPanePaused(pane, false);
      }, ARTWORK_SCROLL_IDLE_MS);
    },
    [setArtworkPanePaused],
  );

  useEffect(() => {
    return () => {
      (Object.keys(artworkTimersRef.current) as ArtworkPane[]).forEach((pane) => {
        const activeTimer = artworkTimersRef.current[pane];
        if (activeTimer !== null) {
          window.clearTimeout(activeTimer);
        }
      });
    };
  }, []);

  const activateArtworkUrls = useCallback((urls: Array<string | null>) => {
    const requestedUrls = [...new Set(urls.filter((url): url is string => Boolean(url)))];
    if (requestedUrls.length === 0) {
      return;
    }

    const protectedUrls = new Set(requestedUrls);
    const nextQueue = [
      ...artworkQueueRef.current.filter((url) => !protectedUrls.has(url)),
      ...requestedUrls,
    ];

    while (nextQueue.length > MAX_ACTIVE_COLLECTION_ARTWORK) {
      const evictableIndex = nextQueue.findIndex((url) => !protectedUrls.has(url));
      if (evictableIndex === -1) {
        break;
      }
      nextQueue.splice(evictableIndex, 1);
    }

    const nextUrls = new Set(nextQueue);
    artworkQueueRef.current = nextQueue;
    setActiveArtworkUrls((current) => {
      if (current.size === nextUrls.size && [...nextUrls].every((url) => current.has(url))) {
        return current;
      }
      return nextUrls;
    });
  }, []);

  const visibleCollectionArtworkUrls = useMemo(() => {
    if (libraryView === "artists") {
      return renderedArtists.map((artist: any) =>
        artist.artwork_track_id ? albumArtworkUrl(artist.artwork_track_id) : null,
      );
    }
    if (libraryView === "albums" && albumMode !== "completion") {
      return renderedBrowseAlbums.map((album: any) =>
        album.artwork_path || album.artwork_track_id ? albumCoverUrl(album.id) : null,
      );
    }
    return [];
  }, [albumArtworkUrl, albumCoverUrl, albumMode, libraryView, renderedArtists, renderedBrowseAlbums]);

  useEffect(() => {
    if (libraryView === "artists") {
      if (!artworkPaused.artists) {
        activateArtworkUrls(visibleCollectionArtworkUrls);
      }
      return;
    }
    if (libraryView === "albums" && albumMode !== "completion" && !artworkPaused.albums) {
      activateArtworkUrls(visibleCollectionArtworkUrls);
    }
  }, [
    activateArtworkUrls,
    albumMode,
    artworkPaused.albums,
    artworkPaused.artists,
    libraryView,
    visibleCollectionArtworkUrls,
  ]);

  const shouldRenderArtwork = useCallback(
    (url: string | null) => Boolean(url && activeArtworkUrls.has(url)),
    [activeArtworkUrls],
  );

  return (
    <>
              {libraryView === "artists" && (
                <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(220px,290px)_minmax(0,1fr)] min-[1280px]:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
                  <div className="relative min-h-0 border-r border-line">
                    <section
                      ref={artistListRef}
                      className="h-full min-h-0 overflow-auto"
                      onScroll={(event) => {
                        setArtistScrollTop(event.currentTarget.scrollTop);
                        pauseArtworkForScroll("artists");
                      }}
                    >
                      <div className="grid">
                        {artistWindow.topSpacerHeight > 0 && <div aria-hidden="true" style={{ height: artistWindow.topSpacerHeight }} />}
                        {renderedArtists.map((artist: any) => {
                          const active = artist.name === selectedArtistName;
                          const artwork = artist.artwork_track_id ? albumArtworkUrl(artist.artwork_track_id) : null;
                          const showArtwork = shouldRenderArtwork(artwork);
                          return (
                            <button
                              key={artist.name}
                              className={`grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition ${
                                active ? "bg-white/10" : "hover:bg-white/[0.035]"
                              }`}
                              style={{ height: ARTIST_ROW_HEIGHT }}
                              type="button"
                              onClick={() => onSelectArtist(artist.name)}
                              onDoubleClick={() => void onPlayArtist(artist.name)}
                            >
                              <div className="h-11 w-11 overflow-hidden rounded border border-line bg-panel">
                                {showArtwork && artwork ? (
                                  <img
                                    alt=""
                                    className="h-full w-full object-cover"
                                    decoding="async"
                                    draggable={false}
                                    loading="lazy"
                                    src={artwork}
                                  />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-moss">
                                    <UserRound size={20} />
                                  </div>
                                )}
                              </div>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-white">{display(artist.name, "Unknown artist")}</span>
                                <span className="block truncate text-xs text-muted">{artistMetaLabel(artist)}</span>
                              </span>
                            </button>
                          );
                        })}
                        {artistWindow.bottomSpacerHeight > 0 && <div aria-hidden="true" style={{ height: artistWindow.bottomSpacerHeight }} />}
                        {artists.length === 0 && (
                          <div className="px-4 py-10 text-center text-sm text-muted">
                            {search.trim() ? "No artists match the current search." : "No artists found in the current library."}
                          </div>
                        )}
                      </div>
                    </section>
                    {renderPaneTopButton(artistScrollTop > 120, "Back to top", artistListRef, setArtistScrollTop)}
                  </div>
                  <section className="min-h-0 min-w-0 overflow-auto">
                    <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                      <colgroup>
                        <col style={{ width: librarySelectionColumnWidth }} />
                        <col style={{ width: columnWidths.play }} />
                        {visibleColumnDefs.map((column: any) => (
                          <col key={column.key} style={{ width: columnWidths[column.key] }} />
                        ))}
                      </colgroup>
                      <thead className="border-b border-line bg-[rgb(var(--color-strip))] text-xs uppercase text-muted">
                        {renderTableHeader(false)}
                      </thead>
                      <tbody>{renderTrackRows(selectedArtistTracks)}</tbody>
                    </table>
                    {activeArtist && selectedArtistTracks.length === 0 && (
                      <div className="px-4 py-10 text-center text-sm text-muted">
                        No local tracks found for this artist.
                      </div>
                    )}
                  </section>
                </div>
              )}
      
              {libraryView === "albums" && (
                albumMode === "completion" ? (
                  <LibraryCompletionView model={model} />
                ) : (
                <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
                  <div className="relative min-h-0 border-r border-line">
                    <section
                      ref={albumListRef}
                      className="h-full min-h-0 overflow-auto"
                      onScroll={(event) => {
                        setAlbumScrollTop(event.currentTarget.scrollTop);
                        pauseArtworkForScroll("albums");
                      }}
                    >
                      <div className={albumGrid ? "grid grid-cols-2 gap-3 p-3" : "grid"}>
                        {albumWindow.topSpacerHeight > 0 && (
                          <div
                            aria-hidden="true"
                            className={albumGrid ? "col-span-full" : undefined}
                            style={{ height: albumWindow.topSpacerHeight }}
                          />
                        )}
                        {renderedBrowseAlbums.map((album: any) => {
                          const active = album.id === selectedAlbumId;
                          const artwork = album.artwork_path || album.artwork_track_id ? albumCoverUrl(album.id) : null;
                          const showArtwork = shouldRenderArtwork(artwork);
                          return (
                            <button
                              key={album.id}
                              className={
                                albumGrid
                                  ? `min-w-0 rounded border border-line bg-panel p-2 text-left transition ${
                                      active ? "border-moss bg-white/10" : "hover:border-moss/50"
                                    }`
                                  : `grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition ${
                                      active ? "bg-white/10" : "hover:bg-white/[0.035]"
                                    }`
                              }
                              style={albumGrid ? { minHeight: ALBUM_GRID_ROW_HEIGHT - 24 } : { height: ALBUM_LIST_ROW_HEIGHT }}
                              type="button"
                              onClick={() => onSelectAlbum(album.id)}
                              onDoubleClick={() => void onPlayAlbum(album.id)}
                            >
                              {albumGrid && (
                                <div className="mb-2 aspect-square overflow-hidden rounded border border-line bg-ink">
                                  {showArtwork && artwork ? (
                                    <img
                                      alt=""
                                      className="h-full w-full object-cover"
                                      decoding="async"
                                      draggable={false}
                                      loading="lazy"
                                      src={artwork}
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center text-moss">
                                      <Album size={28} />
                                    </div>
                                  )}
                                </div>
                              )}
                              {!albumGrid && (
                                <div className="h-11 w-11 overflow-hidden rounded border border-line bg-panel">
                                  {showArtwork && artwork ? (
                                    <img
                                      alt=""
                                      className="h-full w-full object-cover"
                                      decoding="async"
                                      draggable={false}
                                      loading="lazy"
                                      src={artwork}
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center text-moss">
                                      <Album size={20} />
                                    </div>
                                  )}
                                </div>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-white">{display(album.album, "Unknown album")}</span>
                                <span className="block truncate text-xs text-muted">{albumMetaLabel(album)}</span>
                              </span>
                            </button>
                          );
                        })}
                        {albumWindow.bottomSpacerHeight > 0 && (
                          <div
                            aria-hidden="true"
                            className={albumGrid ? "col-span-full" : undefined}
                            style={{ height: albumWindow.bottomSpacerHeight }}
                          />
                        )}
                        {albums.length === 0 && (
                          <div className="col-span-full px-3 py-10 text-center text-sm text-muted">
                            Albums will appear here after the first library scan.
                          </div>
                        )}
                      </div>
                    </section>
                    {renderPaneTopButton(albumScrollTop > 120, "Back to top", albumListRef, setAlbumScrollTop)}
                  </div>
                  <section className="min-h-0 min-w-0 overflow-auto">
                    {activeAlbum && isAlbumArtworkOpen && (
                      <div className="border-b border-line bg-panel px-4 py-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Album Artwork</div>
                            <div className="text-xs text-muted">{albumArtworkStatus || "Choose a sidecar image or save embedded artwork as cover art."}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className="secondary-button h-8" type="button" onClick={() => void loadAlbumArtworkCandidates(activeAlbum.id)}>
                              <RefreshCw size={14} />
                              Rescan
                            </button>
                            <button className="secondary-button h-8" type="button" disabled={isSearchingAlbumArtwork} onClick={() => void searchWebArtwork(activeAlbum.id)}>
                              <Search size={14} />
                              {isSearchingAlbumArtwork ? "Searching" : "Search Web"}
                            </button>
                            <button className="secondary-button h-8" type="button" onClick={() => void clearSelectedAlbumArtwork(activeAlbum.id)}>
                              <X size={14} />
                              Clear
                            </button>
                            <button className="icon-button h-8 w-8" type="button" title="Close artwork manager" onClick={() => setIsAlbumArtworkOpen(false)}>
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="grid max-h-56 gap-2 overflow-auto pr-1 md:grid-cols-2">
                          {albumArtworkCandidates.map((candidate: any, index: number) => (
                            <div key={candidate.path ?? candidate.artwork_url ?? `${candidate.source}-${candidate.track_id}-${index}`} className="grid gap-2 rounded border border-line/70 bg-ink p-2">
                              <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-3">
                                <div className="h-12 w-12 overflow-hidden rounded border border-line bg-panel">
                                  {candidate.thumbnail_url ? (
                                    <img className="h-full w-full object-cover" src={candidate.thumbnail_url} alt="" />
                                  ) : candidate.source === "embedded" && candidate.track_id ? (
                                    <img className="h-full w-full object-cover" src={albumArtworkUrl(candidate.track_id)} alt="" />
                                  ) : candidate.source === "selected" && activeAlbum ? (
                                    <img className="h-full w-full object-cover" src={albumCoverUrl(activeAlbum.id)} alt="" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase text-muted">Art</div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm text-neutral-200">
                                    {candidate.selected ? "Selected - " : ""}{candidate.label}
                                  </div>
                                  <div className="truncate text-xs text-muted">
                                    {candidate.source}
                                    {candidate.size_bytes ? ` - ${Math.round(candidate.size_bytes / 1024).toLocaleString()} KB` : ""}
                                    {candidate.release_id ? ` - ${candidate.release_id}` : ""}
                                  </div>
                                </div>
                                {candidate.selected && <CheckCircle2 className="shrink-0 text-moss" size={16} />}
                              </div>
                              {(candidate.path || candidate.artwork_url) && (
                                <div className="truncate text-xs text-muted">{candidate.path ?? candidate.artwork_url}</div>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {candidate.path && (
                                  <button className="secondary-button h-8" type="button" onClick={() => void chooseSidecarArtwork(activeAlbum.id, candidate.path ?? "")}>
                                    Use
                                  </button>
                                )}
                                {candidate.path && candidate.source !== "embedded" && (
                                  <button className="secondary-button h-8" type="button" onClick={() => void embedSidecarArtwork(activeAlbum.id, candidate.path ?? "")}>
                                    Embed Files
                                  </button>
                                )}
                                {candidate.source === "embedded" && candidate.track_id && (
                                  <button className="secondary-button h-8" type="button" onClick={() => void saveEmbeddedArtwork(activeAlbum.id, candidate.track_id ?? 0)}>
                                    Save Sidecar
                                  </button>
                                )}
                                {candidate.source === "embedded" && candidate.track_id && (
                                  <button className="secondary-button h-8" type="button" onClick={() => void embedEmbeddedArtwork(activeAlbum.id, candidate.track_id ?? 0)}>
                                    Embed Files
                                  </button>
                                )}
                                {candidate.source === "web" && candidate.artwork_url && (
                                  <button className="secondary-button h-8" type="button" onClick={() => void saveWebArtwork(activeAlbum.id, candidate.artwork_url ?? "", false)}>
                                    Save Sidecar
                                  </button>
                                )}
                                {candidate.source === "web" && candidate.artwork_url && (
                                  <button className="primary-button h-8" type="button" onClick={() => void saveWebArtwork(activeAlbum.id, candidate.artwork_url ?? "", true)}>
                                    Save + Embed
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {albumArtworkCandidates.length === 0 && (
                            <div className="col-span-full rounded border border-line/70 bg-ink px-3 py-4 text-center text-xs text-muted">
                              No artwork candidates found beside this album's files.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                    <colgroup>
                        <col style={{ width: librarySelectionColumnWidth }} />
                        <col style={{ width: columnWidths.play }} />
                        {visibleColumnDefs.map((column: any) => (
                          <col key={column.key} style={{ width: columnWidths[column.key] }} />
                        ))}
                      </colgroup>
                      <thead className="border-b border-line bg-[rgb(var(--color-strip))] text-xs uppercase text-muted">
                        {renderTableHeader(false)}
                      </thead>
                      <tbody>{renderTrackRows(selectedAlbumTracks)}</tbody>
                    </table>
                  </section>
                </div>
                )
              )}
      
              {libraryView === "completion" && <LibraryCompletionView model={model} />}
      
              {libraryView === "playlists" && (
                <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
                  <div className="relative min-h-0 border-r border-line">
                    <section
                      ref={playlistListRef}
                      className="h-full min-h-0 overflow-auto"
                      onScroll={(event) => setPlaylistScrollTop(event.currentTarget.scrollTop)}
                    >
                      <div className="sticky top-0 z-10 border-b border-line bg-ink p-3">
                        <div className="flex gap-2">
                          <input
                            className="h-9 min-w-0 flex-1 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                            value={newPlaylistName}
                            placeholder="New playlist"
                            onChange={(event) => setNewPlaylistName(event.target.value)}
                          />
                          <button className="icon-button" type="button" title="Create playlist" onClick={onCreatePlaylist}>
                            <Plus size={16} />
                          </button>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <input
                            className="h-9 min-w-0 flex-1 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                            value={importPlaylistPath}
                            placeholder="Import playlist path"
                            onChange={(event) => setImportPlaylistPath(event.target.value)}
                          />
                          <button className="icon-button" type="button" title="Import playlist" onClick={onImportPlaylist}>
                            <Upload size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="grid">
                        {playlistWindow.topSpacerHeight > 0 && <div aria-hidden="true" style={{ height: playlistWindow.topSpacerHeight }} />}
                        {renderedPlaylists.map((playlist: any) => {
                          const active = playlist.id === selectedPlaylistId;
                          return (
                            <button
                              key={playlist.id}
                              className={`grid gap-1 border-b border-line/60 px-4 py-3 text-left transition ${
                                active ? "bg-white/10" : "hover:bg-white/[0.035]"
                              }`}
                              style={{ height: PLAYLIST_ROW_HEIGHT }}
                              type="button"
                              onClick={() => onSelectPlaylist(playlist.id)}
                            >
                              <span className="truncate text-sm font-medium text-white">{playlist.name}</span>
                              <span className="truncate text-xs text-muted">
                                {playlist.track_count} tracks - {formatDuration(playlist.duration_seconds)}
                              </span>
                            </button>
                          );
                        })}
                        {playlistWindow.bottomSpacerHeight > 0 && <div aria-hidden="true" style={{ height: playlistWindow.bottomSpacerHeight }} />}
                        {playlists.length === 0 && (
                          <div className="px-4 py-10 text-center text-sm text-muted">
                            Create a playlist or import M3U, PLS, XSPF, WPL, or iTunes XML.
                          </div>
                        )}
                      </div>
                    </section>
                    {renderPaneTopButton(playlistScrollTop > PLAYLIST_TOOLBAR_HEIGHT + 80, "Back to top", playlistListRef, setPlaylistScrollTop)}
                  </div>
                  <section className="min-h-0 min-w-0 overflow-auto">
                    <div className="sticky top-0 z-10 grid min-h-12 min-w-0 gap-2 border-b border-line bg-ink px-4 py-2 min-[1180px]:grid-cols-[minmax(0,1fr)_auto] min-[1180px]:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {activePlaylist ? activePlaylist.name : "Select a playlist"}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {`${selectedPlaylistTracks.length.toLocaleString()} track${selectedPlaylistTracks.length === 1 ? "" : "s"}`}
                        </div>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] min-[1180px]:justify-end [&::-webkit-scrollbar]:hidden">
                        <button
                          className="secondary-button h-8 shrink-0"
                          type="button"
                          disabled={selectedPlaylistTracks.length === 0}
                          onClick={() => onShuffleTracks(selectedPlaylistTracks)}
                        >
                          <Shuffle size={15} />
                          Shuffle
                        </button>
                        <button className="secondary-button h-8 shrink-0" type="button" disabled={!activePlaylist || selectedPlaylistTracks.length === 0} onClick={() => activePlaylist && onExportPlaylist(activePlaylist.id)}>
                          <Download size={15} />
                          Export
                        </button>
                        <button className="secondary-button h-8 shrink-0" type="button" disabled={!activePlaylist} onClick={() => activePlaylist && onDeletePlaylist(activePlaylist.id)}>
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    </div>
                    <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                      <colgroup>
                        <col style={{ width: librarySelectionColumnWidth }} />
                        <col style={{ width: columnWidths.play }} />
                        {visibleColumnDefs.map((column: any) => (
                          <col key={column.key} style={{ width: columnWidths[column.key] }} />
                        ))}
                      </colgroup>
                      <thead className="border-b border-line bg-[rgb(var(--color-strip))] text-xs uppercase text-muted">
                        {renderTableHeader(false)}
                      </thead>
                      <tbody>{renderTrackRows(selectedPlaylistTracks, { removable: true })}</tbody>
                    </table>
                  </section>
                </div>
              )}
      
              {libraryView === "inbox" && (
                <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
                  <section className="min-w-0 overflow-auto border-r border-line p-4">
                    <div className="grid gap-3 text-sm">
                      <div className="rounded border border-line bg-panel p-3">
                        <div className="text-xs uppercase text-muted">New Tracks</div>
                        <div className="mt-1 text-2xl font-semibold text-white">{inbox?.total_new.toLocaleString() ?? "-"}</div>
                      </div>
                      <div className="rounded border border-line bg-panel p-3">
                        <div className="text-xs uppercase text-muted">Reviewed</div>
                        <div className="mt-1 text-2xl font-semibold text-moss">{inbox?.total_reviewed.toLocaleString() ?? "-"}</div>
                      </div>
                      <button
                        className="primary-button justify-center"
                        type="button"
                        disabled={selectedIds.length === 0}
                        onClick={() => void onReviewInboxTracks(selectedIds)}
                      >
                        <CheckCircle2 size={15} />
                        Review Selected
                      </button>
                      <button
                        className="secondary-button justify-center"
                        type="button"
                        disabled={(inbox?.total_new ?? 0) === 0}
                        onClick={() => void onReviewInboxTracks([], true)}
                      >
                        <ShieldCheck size={15} />
                        Review All
                      </button>
                      <button
                        className="secondary-button justify-center"
                        type="button"
                        disabled={(inbox?.tracks.length ?? 0) === 0}
                        onClick={() => onAddTracksToPlaylist((inbox?.tracks ?? []).map((track: any) => track.id))}
                      >
                        <Plus size={15} />
                        Add Visible
                      </button>
                      <div className="min-w-0 overflow-hidden rounded border border-line bg-panel p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="text-xs uppercase text-muted">Track Note</div>
                            <div
                              className="mt-0.5 max-w-full truncate text-sm text-neutral-200"
                              title={selectedInboxTrack ? display(selectedInboxTrack.title, "track") : undefined}
                            >
                              {selectedInboxTrack ? display(selectedInboxTrack.title, "track") : "Select one Inbox track"}
                            </div>
                          </div>
                          <Pencil size={15} className="shrink-0 text-muted" />
                        </div>
                        <textarea
                          className="mt-3 min-h-24 w-full resize-y rounded border border-line bg-ink px-3 py-2 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2 disabled:opacity-60"
                          disabled={!selectedInboxTrack}
                          value={inboxNoteDraft}
                          placeholder="Why is this here? Needs tag cleanup, duplicate check, low-quality source..."
                          onChange={(event) => setInboxNoteDraft(event.target.value)}
                        />
                        <button
                          className="secondary-button mt-2 w-full justify-center"
                          type="button"
                          disabled={!selectedInboxTrack}
                          onClick={() => selectedInboxTrack && void onUpdateInboxNote(selectedInboxTrack.id, inboxNoteDraft)}
                        >
                          <Save size={15} />
                          Save Note
                        </button>
                      </div>
                      <div className="rounded border border-line bg-panel p-3">
                        <div className="text-xs uppercase text-muted">Auto-Review Rules</div>
                        <div className="mt-1 text-xs text-muted">
                          Matching new tracks are marked reviewed automatically; notes are only filled when the track has no note.
                        </div>
                        <div className="mt-3 grid gap-2">
                          <input
                            className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                            value={inboxRuleName}
                            placeholder="Rule name"
                            onChange={(event) => setInboxRuleName(event.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              className="h-9 rounded border border-line bg-ink px-2 text-white outline-none ring-moss/40 focus:ring-2"
                              value={inboxRuleField}
                              onChange={(event) => setInboxRuleField(event.target.value as InboxAutoReviewField)}
                            >
                              {(["genre", "artist", "album", "album_artist", "title", "path", "year", "rating", "duration_seconds"] as const).map((field: any) => (
                                <option key={field} value={field}>
                                  {field.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                            <select
                              className="h-9 rounded border border-line bg-ink px-2 text-white outline-none ring-moss/40 focus:ring-2"
                              value={inboxRuleMatchType}
                              onChange={(event) => setInboxRuleMatchType(event.target.value as InboxAutoReviewMatchType)}
                            >
                              <option value="contains">contains</option>
                              <option value="equals">equals</option>
                              <option value="starts_with">starts with</option>
                              <option value="ends_with">ends with</option>
                              <option value="regex">regex</option>
                              <option value="is_empty">is empty</option>
                              <option value="is_not_empty">is not empty</option>
                            </select>
                          </div>
                          <input
                            className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2 disabled:opacity-60"
                            value={inboxRuleValue}
                            disabled={inboxRuleMatchType === "is_empty" || inboxRuleMatchType === "is_not_empty"}
                            placeholder="Match value"
                            onChange={(event) => setInboxRuleValue(event.target.value)}
                          />
                          <textarea
                            className="min-h-16 resize-y rounded border border-line bg-ink px-3 py-2 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                            value={inboxRuleNote}
                            placeholder="Optional note for matched tracks"
                            onChange={(event) => setInboxRuleNote(event.target.value)}
                          />
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-moss"
                                checked={inboxRuleEnabled}
                                onChange={(event) => setInboxRuleEnabled(event.target.checked)}
                              />
                              Enabled
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-moss"
                                checked={inboxRuleApplyExisting}
                                onChange={(event) => setInboxRuleApplyExisting(event.target.checked)}
                              />
                              Apply now
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button className="primary-button min-w-0 flex-1 justify-center" type="button" onClick={() => void saveInboxRule()}>
                              <ShieldCheck size={15} />
                              {editingInboxRuleId ? "Update" : "Save"}
                            </button>
                            <button className="secondary-button" type="button" onClick={resetInboxRuleForm}>
                              Clear
                            </button>
                          </div>
                        </div>
                        {(inbox?.auto_review_rules.length ?? 0) > 0 && (
                          <div className="mt-3 grid gap-2">
                            {inbox?.auto_review_rules.map((rule: any) => (
                              <div key={rule.id} className="rounded border border-line/70 bg-ink px-2 py-2 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    className="min-w-0 text-left font-semibold text-neutral-200 hover:text-white"
                                    type="button"
                                    onClick={() => editInboxRule(rule)}
                                  >
                                    <span className="block truncate">{rule.name}</span>
                                    <span className="block truncate text-muted">
                                      {rule.field.replace("_", " ")} {rule.match_type.replace("_", " ")}
                                      {rule.value ? ` "${rule.value}"` : ""}
                                    </span>
                                  </button>
                                  <button className="text-muted hover:text-ember" type="button" onClick={() => void onDeleteInboxAutoReviewRule(rule)}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                  <section className="min-w-0 overflow-auto">
                    <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-line bg-ink px-4 py-3">
                      <div className="min-w-[180px]">
                        <div className="text-sm font-semibold text-white">Inbox Review</div>
                        <div className="text-xs text-muted">
                          {(inbox?.tracks.length ?? 0).toLocaleString()} visible newly scanned tracks
                        </div>
                      </div>
                      <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button className="secondary-button shrink-0" type="button" disabled={viewTracks.length === 0} onClick={() => onShuffleTracks(viewTracks)}>
                          <Shuffle size={15} />
                          Shuffle
                        </button>
                        <button className="secondary-button shrink-0" type="button" disabled={viewTracks.length === 0} onClick={() => onExportTracks(viewTracks.map((track: any) => track.id))}>
                          <Download size={15} />
                          Export
                        </button>
                      </div>
                    </div>
                    <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                      <colgroup>
                        <col style={{ width: librarySelectionColumnWidth }} />
                        <col style={{ width: columnWidths.play }} />
                        {visibleColumnDefs.map((column: any) => (
                          <col key={column.key} style={{ width: columnWidths[column.key] }} />
                        ))}
                      </colgroup>
                      <thead className="border-b border-line bg-[rgb(var(--color-strip))] text-xs uppercase text-muted">
                        {renderTableHeader(false)}
                      </thead>
                      <tbody>{renderTrackRows(inbox?.tracks ?? [])}</tbody>
                    </table>
                    {(inbox?.tracks.length ?? 0) === 0 && (
                      <div className="grid h-72 place-items-center px-6 text-center text-sm text-muted">
                        Newly scanned tracks will appear here until you mark them reviewed.
                      </div>
                    )}
                  </section>
                </div>
              )}
    </>
  );
}
