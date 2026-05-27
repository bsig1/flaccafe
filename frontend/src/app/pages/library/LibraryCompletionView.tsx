export function LibraryCompletionView({ model }: { model: any }) {
  const { Album, ArrowDown, ArrowUp, BarChart3, BookOpen, CheckCircle2, Download, Fingerprint, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Play, Podcast, Plus, RefreshCw, Save, Search, ShieldCheck, Shuffle, SkipForward, SlidersHorizontal, Star, Tag, Trash2, Upload, UserRound, Volume2, Wand2, X, RatingStars, ResizableHeader, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, albumArtworkUrl, albumCoverUrl, defaultLibraryVisibleColumns, libraryColumnDefinitions, librarySelectionColumnWidth, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatRating, formatShortDate, formatTime, trackGenre, albumMetaLabel, artistMetaLabel, missingMetadataFields, missingMetadataFilters, ALBUM_GRID_ROW_HEIGHT, ALBUM_LIST_ROW_HEIGHT, ARTIST_ROW_HEIGHT, COMPLETION_COLLAPSED_ROW_HEIGHT, COMPLETION_EXPANDED_ROW_ESTIMATE, LIBRARY_ACTIONS_MENU_HEIGHT, LIBRARY_ACTIONS_MENU_WIDTH, MENU_VIEWPORT_MARGIN, PLAYLIST_ROW_HEIGHT, PLAYLIST_TOOLBAR_HEIGHT, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_AVOID_SUBMENU_WIDTH, TRACK_CONTEXT_DIVIDER_HEIGHT, TRACK_CONTEXT_HEADER_HEIGHT, TRACK_CONTEXT_MENU_HEIGHT, TRACK_CONTEXT_MENU_WIDTH, TRACK_CONTEXT_ROW_HEIGHT, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_PLAYLIST_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT, TRACK_RATING_SUBMENU_WIDTH, TRACK_SUBMENU_CLOSE_DELAY_MS, TRACK_TAGGING_SUBMENU_HEIGHT, TRACK_VIRTUALIZATION_OVERSCAN, TRACK_VIRTUALIZATION_THRESHOLD, tracks, trackIndexCache, totalTracks, albums, artists, playlists, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, libraryStats, libraryHealth, inbox, targetPlaylistId, newPlaylistName, importPlaylistPath, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, setAdvancedTrackSearch, refreshTracks, refreshAlbums, loadMoreTracks, loadTrackWindow, isLoading, hasMoreTracks, sort, setSort, scrollTop, setScrollTop, artistScrollTop, setArtistScrollTop, albumScrollTop, setAlbumScrollTop, completionScrollTop, setCompletionScrollTop, playlistScrollTop, setPlaylistScrollTop, onRating, onBulkRating, onPlayTrack, onPlayNext, onAddToQueue, onSelectAlbum, onSelectArtist, onPlayAlbum, onPlayArtist, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onAutoTagTracks, onSyncFileMetadata, onFingerprintTagTracks, onClapGenreTagTracks, onVolumeTagTracks, onOpenFileManagementTracks, onRequestDeleteTracks, onRemoveTrackFromPlaylist, onRemoveTracksFromPlaylist, onMovePlaylistTrack, onExportTracks, onExportPlaylist, onImportPlaylist, onReviewInboxTracks, onUpdateInboxNote, onSaveInboxAutoReviewRule, onDeleteInboxAutoReviewRule, onShuffleTracks, onQuickAutoDj, onAvoidAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, onIgnoreDuplicateGroup, onClearIgnoredDuplicateGroups, isAudioAnalyzing, currentTrackId, currentTrack, hideFilePaths, compactRows, albumGrid, writeRatingsToFiles, libraryVisibleColumns, setLibraryVisibleColumns, onAlbumGridChange, setTargetPlaylistId, setNewPlaylistName, setImportPlaylistPath, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, columnWidths, setColumnWidths, contextMenu, setContextMenu, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, activeContextSubmenu, setActiveContextSubmenu, selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, showAllDuplicateGroups, setShowAllDuplicateGroups, showAllMissingMetadata, setShowAllMissingMetadata, missingMetadataFilter, setMissingMetadataFilter, bulkMetadataOpen, setBulkMetadataOpen, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, albumArtworkCandidates, setAlbumArtworkCandidates, isAlbumArtworkOpen, setIsAlbumArtworkOpen, isSearchingAlbumArtwork, setIsSearchingAlbumArtwork, albumArtworkStatus, setAlbumArtworkStatus, inboxNoteDraft, setInboxNoteDraft, editingInboxRuleId, setEditingInboxRuleId, inboxRuleName, setInboxRuleName, inboxRuleEnabled, setInboxRuleEnabled, inboxRuleField, setInboxRuleField, inboxRuleMatchType, setInboxRuleMatchType, inboxRuleValue, setInboxRuleValue, inboxRuleNote, setInboxRuleNote, inboxRuleApplyExisting, setInboxRuleApplyExisting, albumMode, setAlbumMode, artistPaneHeight, setArtistPaneHeight, albumPaneHeight, setAlbumPaneHeight, playlistPaneHeight, setPlaylistPaneHeight, completionFilter, setCompletionFilter, completionHeightVersion, setCompletionHeightVersion, completionOpenAlbumId, setCompletionOpenAlbumId, completionLoadingAlbumId, setCompletionLoadingAlbumId, completionLookupAlbumId, setCompletionLookupAlbumId, completionLookupMessages, setCompletionLookupMessages, completionLookupAllActive, setCompletionLookupAllActive, completionLookupAllProgress, setCompletionLookupAllProgress, showAdvancedSearch, setShowAdvancedSearch, virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, playlistListRef, contextMenuRef, searchInputRef, selectionAnchorId, completionLookupCancelRef, visibleColumns, visibleColumnDefs, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, rowPadding, trackRowHeight, loadedTrackCount, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, advancedSearchInputClass, activeAlbum, activeArtist, activePlaylist, missingMetadataRows, filteredMissingMetadataRows, visibleMissingMetadataRows, visibleDuplicateGroups, completionQuery, completionSearchTerms, completionMatchesSearch, albumCompletionExpected, albumCompletionMissing, completionAlbums, visibleCompletionAlbums, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, completeAlbumCount, missingTrackEstimate, advancedSelectionKey, completionLookupEta, librarySummaryText, viewTracks, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, resetInboxRuleForm, editInboxRule, saveInboxRule, handleSort, handleResize, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, loadAlbumArtworkCandidates, openAlbumArtworkManager, albumArtworkActionStatus, chooseSidecarArtwork, embedSidecarArtwork, saveEmbeddedArtwork, embedEmbeddedArtwork, searchWebArtwork, saveWebArtwork, clearSelectedAlbumArtwork, handleScroll, openTrackContextMenu, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart, columnTextClass, renderMetadataCell, renderTableHeader, isInteractiveTrackCellTarget, handleLibrarySurfaceClick, renderTrackRow, renderTrackPlaceholderRow, renderVirtualTrackRows, renderTrackRows, toggleCompletionAlbum, handleCompletionLengthLookup, handleCompletionLookupAll, cancelCompletionLookupAll, updateAdvancedTrackSearch, clearAdvancedTrackSearch, contextSelectionTracks, contextSelectionIds, contextBulk, contextLabel, contextPlaylistSubmenuHeight, contextSubmenuStyle, openContextSubmenu, scheduleContextSubmenuClose, contextSubmenuClass } = model;
  return (
          <div className="min-h-full p-6">
            <div className="mx-auto grid max-w-6xl gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Collection Completion</div>
                  <div className="text-xs text-muted">Estimated locally, with optional MusicBrainz length lookups per album.</div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded border border-line bg-panel p-4">
                  <div className="text-xs uppercase text-muted">Complete Albums</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{completeAlbumCount.toLocaleString()}</div>
                </div>
                <div className="rounded border border-line bg-panel p-4">
                  <div className="text-xs uppercase text-muted">Incomplete Albums</div>
                  <div className="mt-2 text-2xl font-semibold text-ember">{completionAlbums.length.toLocaleString()}</div>
                </div>
                <div className="rounded border border-line bg-panel p-4">
                  <div className="text-xs uppercase text-muted">Estimated Missing Tracks</div>
                  <div className="mt-2 text-2xl font-semibold text-moss">{missingTrackEstimate.toLocaleString()}</div>
                </div>
              </div>
              <div className="rounded border border-line bg-panel">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-sm font-semibold text-white">Albums</div>
                      <div className="grid grid-cols-3 rounded border border-line bg-ink p-1 text-xs">
                        {(
                          [
                            ["all", "All"],
                            ["incomplete", "Missing"],
                            ["complete", "Completed"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            className={`h-8 rounded px-3 transition ${
                              completionFilter === id ? "bg-white/10 text-white" : "text-muted hover:text-white"
                            }`}
                            type="button"
                            onClick={() => setCompletionFilter(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Showing {visibleCompletionAlbums.length.toLocaleString()} matching albums
                      {completionQuery ? ` for "${search.trim()}"` : ""}.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted">
                    <button
                      className="secondary-button min-h-8 px-3 py-1.5 text-xs"
                      type="button"
                      disabled={completionLookupAllActive || visibleCompletionAlbums.length === 0}
                      title="Lookup MusicBrainz track counts for every album matching the current completion filter"
                      onClick={() => void handleCompletionLookupAll()}
                    >
                      <RefreshCw className={completionLookupAllActive ? "animate-spin" : ""} size={14} />
                      {completionLookupAllActive ? "Looking Up All" : "Lookup All"}
                    </button>
                    {completionLookupAllActive && (
                      <button
                        className="rounded border border-line px-3 py-1.5 text-xs text-muted transition hover:border-ember hover:text-ember"
                        type="button"
                        onClick={cancelCompletionLookupAll}
                      >
                        Stop
                      </button>
                    )}
                    <span>{albums.length.toLocaleString()} total albums</span>
                  </div>
                </div>
                {completionLookupAllProgress && (
                  <div className="border-b border-line/70 px-4 py-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span>
                        MusicBrainz lookup {completionLookupAllProgress.completed.toLocaleString()}/
                        {completionLookupAllProgress.total.toLocaleString()}
                      </span>
                      <span>
                        {completionLookupAllProgress.matched.toLocaleString()} matched,{" "}
                        {completionLookupAllProgress.failed.toLocaleString()} not found
                        {completionLookupEta ? ` - ${completionLookupEta}` : ""}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                      <div
                        className="h-full rounded-full bg-ember transition-all"
                        style={{
                          width: `${
                            completionLookupAllProgress.total > 0
                              ? Math.min(100, (completionLookupAllProgress.completed / completionLookupAllProgress.total) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                <div ref={completionListRef} className="grid divide-y divide-line/60">
                  {completionWindow.topSpacerHeight > 0 && (
                    <div aria-hidden="true" style={{ height: completionWindow.topSpacerHeight }} />
                  )}
                  {renderedCompletionAlbums.map((album: any) => {
                    const expected = albumCompletionExpected(album);
                    const missing = albumCompletionMissing(album);
                    const progress = expected > 0 ? Math.min(100, (album.track_count / expected) * 100) : 100;
                    const artwork = album.artwork_path || album.artwork_track_id ? albumCoverUrl(album.id) : null;
                    const expanded = completionOpenAlbumId === album.id;
                    const tracksReady = expanded && selectedAlbumId === album.id && completionLoadingAlbumId !== album.id;
                    const lookupMessage = completionLookupMessages[album.id];
                    const queriedTrackCount = album.completion_expected_track_count;
                    return (
                      <div
                        key={album.id}
                        ref={(element) => setCompletionRowElement(album.id, element)}
                        className={expanded ? "bg-white/[0.025]" : ""}
                      >
                        <button
                          className="grid w-full gap-3 px-4 py-3 text-left transition hover:bg-white/[0.035] sm:grid-cols-[44px_minmax(0,1fr)_120px]"
                          type="button"
                          onClick={() => toggleCompletionAlbum(album.id)}
                        >
                          <div className="h-11 w-11 overflow-hidden rounded border border-line bg-ink">
                            {artwork ? (
                              <img alt="" className="h-full w-full object-cover" src={artwork} />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-moss">
                                <Album size={18} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium text-white">{display(album.album, "Unknown album")}</span>
                            </div>
                            <div className="truncate text-xs text-muted">{albumMetaLabel(album)}</div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink">
                              <div className="h-full rounded-full bg-moss" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                          <div className="self-center text-right text-sm tabular-nums">
                            <div className="font-semibold text-white">
                              {album.track_count.toLocaleString()}/{expected.toLocaleString()}
                            </div>
                            <div className={missing ? "text-xs text-ember" : "text-xs text-moss"}>
                              {missing ? `${missing.toLocaleString()} missing` : "complete"}
                            </div>
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-line/60 bg-ink/55 px-4 py-3">
                            <div className="mb-3 ml-0 flex flex-wrap items-center justify-between gap-2 rounded border border-line/70 bg-panel px-3 py-2 text-xs sm:ml-14">
                              <div className="min-w-0">
                                <div className="font-medium text-neutral-100">
                                  Expected length: {expected.toLocaleString()} tracks
                                </div>
                                <div className="truncate text-muted">
                                  {queriedTrackCount
                                    ? `${album.completion_source ?? "Lookup"} ${queriedTrackCount.toLocaleString()} tracks${album.completion_release_title ? ` - ${album.completion_release_title}` : ""}${album.completion_checked_at ? ` (${formatShortDate(album.completion_checked_at)})` : ""}`
                                    : "Using local disc and track numbers."}
                                  {lookupMessage ? ` ${lookupMessage}` : ""}
                                </div>
                              </div>
                              <button
                                className="secondary-button min-h-8 px-3 py-1.5 text-xs"
                                type="button"
                                disabled={completionLookupAllActive || completionLookupAlbumId === album.id}
                                onClick={() => void handleCompletionLengthLookup(album)}
                              >
                                <RefreshCw className={completionLookupAlbumId === album.id ? "animate-spin" : ""} size={14} />
                                {completionLookupAlbumId === album.id ? "Looking up" : "Lookup Length"}
                              </button>
                            </div>
                            {tracksReady ? (
                              <div className="ml-0 grid gap-1 sm:ml-14">
                                {selectedAlbumTracks.map((track: any, index: number) => (
                                  <button
                                    key={`${album.id}-${track.id}-${index}`}
                                    className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded px-2 py-1.5 text-left text-xs hover:bg-white/[0.035] ${
                                      currentTrackId === track.id ? "bg-moss/10 text-moss" : ""
                                    }`}
                                    type="button"
                                    title={`Play ${display(track.title, "track")}`}
                                    onClick={() => onPlayTrack(track, selectedAlbumTracks)}
                                    onContextMenu={(event) => openTrackContextMenu(event, track, selectedAlbumTracks)}
                                  >
                                    <span className="text-right tabular-nums text-muted">{track.track_number ?? index + 1}</span>
                                    <div className="min-w-0">
                                      <div className="truncate font-medium text-neutral-100">{display(track.title, "Untitled")}</div>
                                      <div className="truncate text-muted">{display(track.artist)}</div>
                                    </div>
                                    <span className="tabular-nums text-muted">{formatDuration(track.duration_seconds)}</span>
                                  </button>
                                ))}
                                {selectedAlbumTracks.length === 0 && (
                                  <div className="rounded border border-line/70 bg-panel px-3 py-4 text-center text-xs text-muted">
                                    No tracks are attached to this album yet.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="ml-0 rounded border border-line/70 bg-panel px-3 py-4 text-center text-xs text-muted sm:ml-14">
                                Opening album...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {completionWindow.bottomSpacerHeight > 0 && (
                    <div aria-hidden="true" style={{ height: completionWindow.bottomSpacerHeight }} />
                  )}
                  {visibleCompletionAlbums.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-muted">
                      No albums match this completion filter.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
  );
}
