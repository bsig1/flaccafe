import type { LibraryColumnDefinition } from "../../shared";

export function LibraryFloatingMenus({ model }: { model: any }) {
  const { Album, ArrowDown, ArrowUp, BarChart3, BookOpen, CheckCircle2, Download, Fingerprint, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Play, Podcast, Plus, RefreshCw, Save, Search, ShieldCheck, Shuffle, SkipForward, SlidersHorizontal, Star, Tag, Trash2, Upload, UserRound, Volume2, Wand2, X, RatingStars, ResizableHeader, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, albumArtworkUrl, albumCoverUrl, defaultLibraryVisibleColumns, libraryColumnDefinitions, librarySelectionColumnWidth, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatRating, formatShortDate, formatTime, trackGenre, albumMetaLabel, artistMetaLabel, missingMetadataFields, missingMetadataFilters, ALBUM_GRID_ROW_HEIGHT, ALBUM_LIST_ROW_HEIGHT, ARTIST_ROW_HEIGHT, COMPLETION_COLLAPSED_ROW_HEIGHT, COMPLETION_EXPANDED_ROW_ESTIMATE, LIBRARY_ACTIONS_MENU_HEIGHT, LIBRARY_ACTIONS_MENU_WIDTH, MENU_VIEWPORT_MARGIN, PLAYLIST_ROW_HEIGHT, PLAYLIST_TOOLBAR_HEIGHT, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_AVOID_SUBMENU_WIDTH, TRACK_CONTEXT_DIVIDER_HEIGHT, TRACK_CONTEXT_HEADER_HEIGHT, TRACK_CONTEXT_MENU_HEIGHT, TRACK_CONTEXT_MENU_WIDTH, TRACK_CONTEXT_ROW_HEIGHT, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_PLAYLIST_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT, TRACK_RATING_SUBMENU_WIDTH, TRACK_SUBMENU_CLOSE_DELAY_MS, TRACK_TAGGING_SUBMENU_HEIGHT, TRACK_VIRTUALIZATION_OVERSCAN, TRACK_VIRTUALIZATION_THRESHOLD, tracks, trackIndexCache, totalTracks, albums, artists, playlists, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, libraryStats, libraryHealth, inbox, targetPlaylistId, newPlaylistName, importPlaylistPath, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, setAdvancedTrackSearch, refreshTracks, refreshAlbums, loadMoreTracks, loadTrackWindow, isLoading, hasMoreTracks, sort, setSort, scrollTop, setScrollTop, artistScrollTop, setArtistScrollTop, albumScrollTop, setAlbumScrollTop, completionScrollTop, setCompletionScrollTop, playlistScrollTop, setPlaylistScrollTop, onRating, onBulkRating, onPlayTrack, onPlayNext, onAddToQueue, onSelectAlbum, onSelectArtist, onPlayAlbum, onPlayArtist, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onAutoTagTracks, onSyncFileMetadata, onFingerprintTagTracks, onClapGenreTagTracks, onVolumeTagTracks, onOpenFileManagementTracks, onRequestDeleteTracks, onRemoveTrackFromPlaylist, onRemoveTracksFromPlaylist, onMovePlaylistTrack, onExportTracks, onExportPlaylist, onImportPlaylist, onReviewInboxTracks, onUpdateInboxNote, onSaveInboxAutoReviewRule, onDeleteInboxAutoReviewRule, onShuffleTracks, onQuickAutoDj, onAvoidAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, onIgnoreDuplicateGroup, onClearIgnoredDuplicateGroups, isAudioAnalyzing, currentTrackId, currentTrack, hideFilePaths, compactRows, albumGrid, writeRatingsToFiles, libraryVisibleColumns, setLibraryVisibleColumns, onAlbumGridChange, setTargetPlaylistId, setNewPlaylistName, setImportPlaylistPath, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, columnWidths, setColumnWidths, contextMenu, setContextMenu, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, activeContextSubmenu, setActiveContextSubmenu, selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, showAllDuplicateGroups, setShowAllDuplicateGroups, showAllMissingMetadata, setShowAllMissingMetadata, missingMetadataFilter, setMissingMetadataFilter, bulkMetadataOpen, setBulkMetadataOpen, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, albumArtworkCandidates, setAlbumArtworkCandidates, isAlbumArtworkOpen, setIsAlbumArtworkOpen, isSearchingAlbumArtwork, setIsSearchingAlbumArtwork, albumArtworkStatus, setAlbumArtworkStatus, inboxNoteDraft, setInboxNoteDraft, editingInboxRuleId, setEditingInboxRuleId, inboxRuleName, setInboxRuleName, inboxRuleEnabled, setInboxRuleEnabled, inboxRuleField, setInboxRuleField, inboxRuleMatchType, setInboxRuleMatchType, inboxRuleValue, setInboxRuleValue, inboxRuleNote, setInboxRuleNote, inboxRuleApplyExisting, setInboxRuleApplyExisting, albumMode, setAlbumMode, artistPaneHeight, setArtistPaneHeight, albumPaneHeight, setAlbumPaneHeight, playlistPaneHeight, setPlaylistPaneHeight, completionFilter, setCompletionFilter, completionHeightVersion, setCompletionHeightVersion, completionOpenAlbumId, setCompletionOpenAlbumId, completionLoadingAlbumId, setCompletionLoadingAlbumId, completionLookupAlbumId, setCompletionLookupAlbumId, completionLookupMessages, setCompletionLookupMessages, completionLookupAllActive, setCompletionLookupAllActive, completionLookupAllProgress, setCompletionLookupAllProgress, showAdvancedSearch, setShowAdvancedSearch, virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, playlistListRef, contextMenuRef, searchInputRef, selectionAnchorId, completionLookupCancelRef, visibleColumns, visibleColumnDefs, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, rowPadding, trackRowHeight, loadedTrackCount, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, advancedSearchInputClass, activeAlbum, activeArtist, activePlaylist, missingMetadataRows, filteredMissingMetadataRows, visibleMissingMetadataRows, visibleDuplicateGroups, completionQuery, completionSearchTerms, completionMatchesSearch, albumCompletionExpected, albumCompletionMissing, completionAlbums, visibleCompletionAlbums, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, completeAlbumCount, missingTrackEstimate, advancedSelectionKey, completionLookupEta, librarySummaryText, viewTracks, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, resetInboxRuleForm, editInboxRule, saveInboxRule, handleSort, handleResize, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, loadAlbumArtworkCandidates, openAlbumArtworkManager, albumArtworkActionStatus, chooseSidecarArtwork, embedSidecarArtwork, saveEmbeddedArtwork, embedEmbeddedArtwork, searchWebArtwork, saveWebArtwork, clearSelectedAlbumArtwork, handleScroll, openTrackContextMenu, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart, columnTextClass, renderMetadataCell, renderTableHeader, isInteractiveTrackCellTarget, handleLibrarySurfaceClick, renderTrackRow, renderTrackPlaceholderRow, renderVirtualTrackRows, renderTrackRows, toggleCompletionAlbum, handleCompletionLengthLookup, handleCompletionLookupAll, cancelCompletionLookupAll, updateAdvancedTrackSearch, clearAdvancedTrackSearch, contextSelectionTracks, contextSelectionIds, contextBulk, contextLabel, contextPlaylistSubmenuHeight, contextSubmenuStyle, openContextSubmenu, scheduleContextSubmenuClose, contextSubmenuClass } = model;
  return (
    <>
            {libraryActionsMenu && (
              <div
                role="menu"
                className="fixed z-50 w-72 rounded border border-line bg-[rgb(var(--color-popover))] p-3 text-sm shadow-2xl"
                style={{ left: libraryActionsMenu.x, top: libraryActionsMenu.y }}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
              >
                <label className="grid gap-2 text-xs uppercase text-muted">
                  Playlist target
                  <select
                    className="h-9 rounded border border-line bg-panel px-2 text-sm normal-case text-white outline-none ring-moss/40 focus:ring-2"
                    value={targetPlaylistId ?? ""}
                    onChange={(event) => setTargetPlaylistId(event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">Choose playlist...</option>
                    {playlists.map((playlist: any) => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 grid gap-1 border-t border-line pt-2">
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-neutral-200 hover:bg-white/10 disabled:text-muted"
                    type="button"
                    disabled={!targetPlaylistId || viewTracks.length === 0}
                    onClick={() => {
                      void onAddTracksToPlaylist(viewTracks.map((track: any) => track.id));
                      setLibraryActionsMenu(null);
                    }}
                  >
                    <Plus size={15} />
                    Add current view to target
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-neutral-200 hover:bg-white/10"
                    type="button"
                    onClick={() => {
                      void refreshTracks();
                      setLibraryActionsMenu(null);
                    }}
                  >
                    <RefreshCw size={15} />
                    Refresh view
                  </button>
                  {libraryView === "albums" && activeAlbum && (
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-neutral-200 hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        void openAlbumArtworkManager(activeAlbum.id);
                        setLibraryActionsMenu(null);
                      }}
                    >
                      <Album size={15} />
                      Album artwork
                    </button>
                  )}
                </div>
              </div>
            )}
            {columnMenu && (
              <div
                className="fixed z-50 max-h-[70vh] w-80 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] p-3 text-sm text-neutral-100 shadow-2xl"
                style={{ left: columnMenu.x, top: columnMenu.y }}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">Visible Columns</div>
                    <div className="text-xs text-muted">Drag headers to reorder. Right-click here to show or hide fields.</div>
                  </div>
                  <button
                    className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-white"
                    type="button"
                    onClick={() => setLibraryVisibleColumns(defaultLibraryVisibleColumns)}
                  >
                    Reset
                  </button>
                </div>
                {(["Default", "Metadata", "Listening", "Analysis", "File"] as LibraryColumnDefinition["category"][]).map((category) => (
                  <div key={category} className="border-t border-line py-2 first:border-t-0">
                    <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted/80">{category}</div>
                    <div className="grid gap-1">
                      {libraryColumnDefinitions
                        .filter((column: any) => column.category === category)
                        .map((column: any) => {
                          const checked = visibleColumns.includes(column.key);
                          return (
                            <label
                              key={column.key}
                              className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-white/10"
                            >
                              <span className={checked ? "text-white" : "text-muted"}>{column.label}</span>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-moss"
                                checked={checked}
                                disabled={checked && visibleColumns.length <= 1}
                                onChange={() => toggleVisibleColumn(column.key)}
                              />
                            </label>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {contextMenu && (
              <div
                ref={contextMenuRef}
                className="fixed z-50 max-h-[calc(100vh-24px)] w-64 overflow-y-auto rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                {contextBulk && (
                  <div className="border-b border-line px-3 py-2 text-xs text-muted">
                    {contextSelectionIds.length.toLocaleString()} selected
                  </div>
                )}
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    onPlayTrack(contextMenu.track, contextMenu.queue);
                    setContextMenu(null);
                  }}
                >
                  <Play size={15} />
                  Play
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    onPlayNext(contextMenu.track);
                    setContextMenu(null);
                  }}
                >
                  <SkipForward size={15} />
                  Play Next
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    onAddToQueue(contextMenu.track);
                    setContextMenu(null);
                  }}
                >
                  <Plus size={15} />
                  Add To Queue
                </button>
                <button
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    if (contextBulk) {
                      setBulkMetadataOpen(true);
                    } else {
                      onEditTrack(contextMenu.track);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Pencil size={15} />
                    <span className="truncate">{contextBulk ? "Edit Selected Metadata" : "Edit Metadata"}</span>
                  </span>
                  <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">F2</span>
                </button>
                <div className="relative" onMouseEnter={() => openContextSubmenu("tagging")} onMouseLeave={scheduleContextSubmenuClose}>
                  <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
                    <span className="inline-flex items-center gap-2">
                      <Tag size={15} />
                      Tagging
                    </span>
                    <span className="text-muted">{">"}</span>
                  </button>
                  <div
                    className={contextSubmenuClass(
                      "tagging",
                      "fixed z-[60] w-56 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] py-1 shadow-2xl transition",
                    )}
                    style={contextSubmenuStyle(4, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_TAGGING_SUBMENU_HEIGHT)}
                    onMouseEnter={() => openContextSubmenu("tagging")}
                    onMouseLeave={scheduleContextSubmenuClose}
                  >
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        void onAutoTagTracks(contextSelectionIds, false);
                        setContextMenu(null);
                      }}
                    >
                      <Wand2 size={15} />
                      Preview Auto-Tag
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        void onSyncFileMetadata(contextSelectionIds);
                        setContextMenu(null);
                      }}
                    >
                      <RefreshCw size={15} />
                      Sync Metadata From Files
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        void onFingerprintTagTracks(contextSelectionIds);
                        setContextMenu(null);
                      }}
                    >
                      <Fingerprint size={15} />
                      Fingerprint Tag Preview
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        void onClapGenreTagTracks(contextSelectionIds);
                        setContextMenu(null);
                      }}
                    >
                      <Tag size={15} />
                      Preview CLAP Genres
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        void onVolumeTagTracks(contextSelectionIds);
                        setContextMenu(null);
                      }}
                    >
                      <Volume2 size={15} />
                      Mark Volume Tags
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        const ids = [...contextSelectionIds];
                        void (async () => {
                          await onBulkMetadata(ids, { genre: "Audiobook", write_to_file: writeRatingsToFiles });
                          if (contextBulk) {
                            clearSelection();
                          }
                          await refreshTracks();
                        })();
                        setContextMenu(null);
                      }}
                    >
                      <BookOpen size={15} />
                      Mark as Audiobook
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        const ids = [...contextSelectionIds];
                        void (async () => {
                          await onBulkMetadata(ids, { genre: "Podcast", write_to_file: writeRatingsToFiles });
                          if (contextBulk) {
                            clearSelection();
                          }
                          await refreshTracks();
                        })();
                        setContextMenu(null);
                      }}
                    >
                      <Podcast size={15} />
                      Mark as Podcast
                    </button>
                  </div>
                </div>
                <div className="relative" onMouseEnter={() => openContextSubmenu("rating")} onMouseLeave={scheduleContextSubmenuClose}>
                  <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
                    <span className="inline-flex items-center gap-2">
                      <Star size={15} />
                      Rating
                    </span>
                    <span className="text-muted">{">"}</span>
                  </button>
                  <div
                    className={contextSubmenuClass(
                      "rating",
                      "fixed z-[60] grid w-48 grid-cols-2 gap-1 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] p-2 shadow-2xl transition",
                    )}
                    style={contextSubmenuStyle(5, TRACK_RATING_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT)}
                    onMouseEnter={() => openContextSubmenu("rating")}
                    onMouseLeave={scheduleContextSubmenuClose}
                  >
                    {[null, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating: any) => (
                      <button
                        key={rating ?? "none"}
                        className="rounded px-2 py-1.5 text-left text-xs hover:bg-white/10"
                        type="button"
                        onClick={() => {
                          void onBulkRating(contextSelectionIds, rating);
                          if (contextBulk) {
                            clearSelection();
                          }
                          setContextMenu(null);
                        }}
                      >
                        {rating === null ? "Unrated" : formatRating(rating)}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    onQuickAutoDj(contextMenu.track);
                    setContextMenu(null);
                  }}
                >
                  <Wand2 size={15} />
                  AutoDJ From Track
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    onRevealTrack(contextMenu.track);
                    setContextMenu(null);
                  }}
                >
                  <FolderOpen size={15} />
                  Reveal in Explorer
                </button>
                <div className="my-1 border-t border-line" />
                <div className="relative" onMouseEnter={() => openContextSubmenu("avoid")} onMouseLeave={scheduleContextSubmenuClose}>
                  <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
                    <span className="inline-flex items-center gap-2">
                      <X size={15} />
                      Avoid in AutoDJ
                    </span>
                    <span className="text-muted">{">"}</span>
                  </button>
                  <div
                    className={contextSubmenuClass(
                      "avoid",
                      "fixed z-[60] w-44 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] py-1 shadow-2xl transition",
                    )}
                    style={contextSubmenuStyle(8, TRACK_AVOID_SUBMENU_WIDTH, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_CONTEXT_DIVIDER_HEIGHT)}
                    onMouseEnter={() => openContextSubmenu("avoid")}
                    onMouseLeave={scheduleContextSubmenuClose}
                  >
                    {(
                      [
                        ["track", "Track", X],
                        ["artist", "Artist", UserRound],
                        ["album", "Album", Album],
                        ["genre", "Genre", SlidersHorizontal],
                      ] as const
                    ).map(([scope, label, Icon]) => (
                      <button
                        key={scope}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                        type="button"
                        onClick={() => {
                          void onAvoidAutoDj(scope, contextMenu.track);
                          setContextMenu(null);
                        }}
                      >
                        <Icon size={15} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative" onMouseEnter={() => openContextSubmenu("playlist")} onMouseLeave={scheduleContextSubmenuClose}>
                  <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10" type="button">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Plus size={15} />
                      <span className="truncate">{contextBulk ? "Add Selected To Playlist" : "Add To Playlist"}</span>
                    </span>
                    <span className="text-muted">{">"}</span>
                  </button>
                  <div
                    className={contextSubmenuClass(
                      "playlist",
                      "fixed z-[60] w-60 overflow-auto rounded border border-line bg-[rgb(var(--color-popover))] py-1 shadow-2xl transition",
                    )}
                    style={contextSubmenuStyle(9, TRACK_PLAYLIST_SUBMENU_WIDTH, contextPlaylistSubmenuHeight, TRACK_CONTEXT_DIVIDER_HEIGHT)}
                    onMouseEnter={() => openContextSubmenu("playlist")}
                    onMouseLeave={scheduleContextSubmenuClose}
                  >
                    {playlists.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted">No playlists yet</div>
                    ) : (
                      playlists.map((playlist: any) => (
                        <button
                          key={playlist.id}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/10"
                          type="button"
                          title={playlist.name}
                          onClick={() => {
                            void onAddTracksToPlaylist(contextSelectionIds, playlist.id);
                            setContextMenu(null);
                          }}
                        >
                          <span className="min-w-0 truncate">{playlist.name}</span>
                          <span className="shrink-0 text-xs text-muted">{playlist.track_count.toLocaleString()}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                {contextBulk && (
                  <>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        void onExportTracks(contextSelectionIds);
                        clearSelection();
                        setContextMenu(null);
                      }}
                    >
                      <Download size={15} />
                      Export Selected
                    </button>
                    {libraryView === "playlists" && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                        type="button"
                        onClick={() => {
                          void onRemoveTracksFromPlaylist(contextSelectionIds);
                          clearSelection();
                          setContextMenu(null);
                        }}
                      >
                        <Trash2 size={15} />
                        Remove Selected
                      </button>
                    )}
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        clearSelection();
                        setContextMenu(null);
                      }}
                    >
                      <X size={15} />
                      Clear Selection
                    </button>
                  </>
                )}
                {contextMenu.removable && (
                  <>
                    <div className="my-1 border-t border-line" />
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        onMovePlaylistTrack(contextMenu.track.id, "up");
                        setContextMenu(null);
                      }}
                    >
                      <ArrowUp size={15} />
                      Move Up
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        onMovePlaylistTrack(contextMenu.track.id, "down");
                        setContextMenu(null);
                      }}
                    >
                      <ArrowDown size={15} />
                      Move Down
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        onRemoveTrackFromPlaylist(contextMenu.track.id);
                        setContextMenu(null);
                      }}
                    >
                      <Trash2 size={15} />
                      Remove From Playlist
                    </button>
                  </>
                )}
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  disabled={isAudioAnalyzing}
                  onClick={() => {
                    onAnalyzeTracks(contextSelectionIds);
                    if (contextBulk) {
                      clearSelection();
                    }
                    setContextMenu(null);
                  }}
                >
                  <BarChart3 size={15} />
                  {contextBulk ? "Analyze Selected" : "Analyze Track"}
                </button>
                <div className="my-1 border-t border-line" />
                <button
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-ember hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    onRequestDeleteTracks(contextSelectionIds, contextLabel);
                    setContextMenu(null);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Trash2 size={15} />
                    Delete...
                  </span>
                  <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">Del</span>
                </button>
              </div>
            )}
    </>
  );
}
