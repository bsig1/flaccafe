export function LibraryTrackBranch({ model }: { model: any }) {
  const { Album, ArrowDown, ArrowUp, BarChart3, BookOpen, CheckCircle2, Download, Fingerprint, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Play, Podcast, Plus, RefreshCw, Save, Search, ShieldCheck, Shuffle, SkipForward, SlidersHorizontal, Star, Tag, Trash2, Upload, UserRound, Volume2, Wand2, X, RatingStars, ResizableHeader, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, albumArtworkUrl, albumCoverUrl, defaultLibraryVisibleColumns, libraryColumnDefinitions, librarySelectionColumnWidth, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatRating, formatShortDate, formatTime, trackGenre, albumMetaLabel, artistMetaLabel, missingMetadataFields, missingMetadataFilters, ALBUM_GRID_ROW_HEIGHT, ALBUM_LIST_ROW_HEIGHT, ARTIST_ROW_HEIGHT, COMPLETION_COLLAPSED_ROW_HEIGHT, COMPLETION_EXPANDED_ROW_ESTIMATE, LIBRARY_ACTIONS_MENU_HEIGHT, LIBRARY_ACTIONS_MENU_WIDTH, MENU_VIEWPORT_MARGIN, PLAYLIST_ROW_HEIGHT, PLAYLIST_TOOLBAR_HEIGHT, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_AVOID_SUBMENU_WIDTH, TRACK_CONTEXT_DIVIDER_HEIGHT, TRACK_CONTEXT_HEADER_HEIGHT, TRACK_CONTEXT_MENU_HEIGHT, TRACK_CONTEXT_MENU_WIDTH, TRACK_CONTEXT_ROW_HEIGHT, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_PLAYLIST_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT, TRACK_RATING_SUBMENU_WIDTH, TRACK_SUBMENU_CLOSE_DELAY_MS, TRACK_TAGGING_SUBMENU_HEIGHT, TRACK_VIRTUALIZATION_OVERSCAN, TRACK_VIRTUALIZATION_THRESHOLD, tracks, trackIndexCache, totalTracks, albums, artists, playlists, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, libraryStats, libraryHealth, inbox, targetPlaylistId, newPlaylistName, importPlaylistPath, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, setAdvancedTrackSearch, refreshTracks, refreshAlbums, loadMoreTracks, loadTrackWindow, isLoading, hasMoreTracks, sort, setSort, scrollTop, setScrollTop, artistScrollTop, setArtistScrollTop, albumScrollTop, setAlbumScrollTop, completionScrollTop, setCompletionScrollTop, playlistScrollTop, setPlaylistScrollTop, onRating, onBulkRating, onPlayTrack, onPlayNext, onAddToQueue, onSelectAlbum, onSelectArtist, onPlayAlbum, onPlayArtist, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onAutoTagTracks, onSyncFileMetadata, onFingerprintTagTracks, onClapGenreTagTracks, onVolumeTagTracks, onOpenFileManagementTracks, onRequestDeleteTracks, onRemoveTrackFromPlaylist, onRemoveTracksFromPlaylist, onMovePlaylistTrack, onExportTracks, onExportPlaylist, onImportPlaylist, onReviewInboxTracks, onUpdateInboxNote, onSaveInboxAutoReviewRule, onDeleteInboxAutoReviewRule, onShuffleTracks, onQuickAutoDj, onAvoidAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, onIgnoreDuplicateGroup, onClearIgnoredDuplicateGroups, isAudioAnalyzing, currentTrackId, currentTrack, hideFilePaths, compactRows, albumGrid, writeRatingsToFiles, libraryVisibleColumns, setLibraryVisibleColumns, onAlbumGridChange, setTargetPlaylistId, setNewPlaylistName, setImportPlaylistPath, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, columnWidths, setColumnWidths, contextMenu, setContextMenu, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, activeContextSubmenu, setActiveContextSubmenu, selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, showAllDuplicateGroups, setShowAllDuplicateGroups, showAllMissingMetadata, setShowAllMissingMetadata, missingMetadataFilter, setMissingMetadataFilter, bulkMetadataOpen, setBulkMetadataOpen, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, albumArtworkCandidates, setAlbumArtworkCandidates, isAlbumArtworkOpen, setIsAlbumArtworkOpen, isSearchingAlbumArtwork, setIsSearchingAlbumArtwork, albumArtworkStatus, setAlbumArtworkStatus, inboxNoteDraft, setInboxNoteDraft, editingInboxRuleId, setEditingInboxRuleId, inboxRuleName, setInboxRuleName, inboxRuleEnabled, setInboxRuleEnabled, inboxRuleField, setInboxRuleField, inboxRuleMatchType, setInboxRuleMatchType, inboxRuleValue, setInboxRuleValue, inboxRuleNote, setInboxRuleNote, inboxRuleApplyExisting, setInboxRuleApplyExisting, albumMode, setAlbumMode, artistPaneHeight, setArtistPaneHeight, albumPaneHeight, setAlbumPaneHeight, playlistPaneHeight, setPlaylistPaneHeight, completionFilter, setCompletionFilter, completionHeightVersion, setCompletionHeightVersion, completionOpenAlbumId, setCompletionOpenAlbumId, completionLoadingAlbumId, setCompletionLoadingAlbumId, completionLookupAlbumId, setCompletionLookupAlbumId, completionLookupMessages, setCompletionLookupMessages, completionLookupAllActive, setCompletionLookupAllActive, completionLookupAllProgress, setCompletionLookupAllProgress, showAdvancedSearch, setShowAdvancedSearch, virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, playlistListRef, contextMenuRef, searchInputRef, selectionAnchorId, completionLookupCancelRef, visibleColumns, visibleColumnDefs, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, rowPadding, trackRowHeight, loadedTrackCount, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, advancedSearchInputClass, activeAlbum, activeArtist, activePlaylist, missingMetadataRows, filteredMissingMetadataRows, visibleMissingMetadataRows, visibleDuplicateGroups, completionQuery, completionSearchTerms, completionMatchesSearch, albumCompletionExpected, albumCompletionMissing, completionAlbums, visibleCompletionAlbums, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, completeAlbumCount, missingTrackEstimate, advancedSelectionKey, completionLookupEta, librarySummaryText, viewTracks, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, resetInboxRuleForm, editInboxRule, saveInboxRule, handleSort, handleResize, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, loadAlbumArtworkCandidates, openAlbumArtworkManager, albumArtworkActionStatus, chooseSidecarArtwork, embedSidecarArtwork, saveEmbeddedArtwork, embedEmbeddedArtwork, searchWebArtwork, saveWebArtwork, clearSelectedAlbumArtwork, handleScroll, openTrackContextMenu, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart, columnTextClass, renderMetadataCell, renderTableHeader, isInteractiveTrackCellTarget, handleLibrarySurfaceClick, renderTrackRow, renderTrackPlaceholderRow, renderVirtualTrackRows, renderTrackRows, toggleCompletionAlbum, handleCompletionLengthLookup, handleCompletionLookupAll, cancelCompletionLookupAll, updateAdvancedTrackSearch, clearAdvancedTrackSearch, contextSelectionTracks, contextSelectionIds, contextBulk, contextLabel, contextPlaylistSubmenuHeight, contextSubmenuStyle, openContextSubmenu, scheduleContextSubmenuClose, contextSubmenuClass } = model;
  return (
    <>
              {libraryView === "tracks" && (
                <>
                  <table className="library-track-table w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                    <colgroup>
                      <col style={{ width: librarySelectionColumnWidth }} />
                      <col style={{ width: columnWidths.play }} />
                      {visibleColumnDefs.map((column: any) => (
                        <col key={column.key} style={{ width: columnWidths[column.key] }} />
                      ))}
                    </colgroup>
                    <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
                      {renderTableHeader(true)}
                    </thead>
                    <tbody>
                      {virtualTopSpacerHeight > 0 && (
                        <tr aria-hidden="true">
                          <td colSpan={visibleColumnDefs.length + 2} style={{ height: virtualTopSpacerHeight, padding: 0, border: 0 }} />
                        </tr>
                      )}
                      {shouldVirtualizeTrackRows ? renderVirtualTrackRows() : renderTrackRows(renderedTrackList, { interactionList: tracks })}
                      {virtualBottomSpacerHeight > 0 && (
                        <tr aria-hidden="true">
                          <td colSpan={visibleColumnDefs.length + 2} style={{ height: virtualBottomSpacerHeight, padding: 0, border: 0 }} />
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {isLoading && (
                    <div className="border-t border-line/60 px-6 py-4 text-center text-sm text-muted">
                      Loading tracks...
                    </div>
                  )}
                  {!shouldVirtualizeTrackRows && !isLoading && hasMoreTracks && tracks.length > 0 && (
                    <div className="border-t border-line/60 px-6 py-4 text-center">
                      <button className="secondary-button" type="button" onClick={loadMoreTracks}>
                        Load more
                      </button>
                    </div>
                  )}
                  {totalTracks === 0 && tracks.length === 0 && !isLoading && trackSearchActive && (
                    <div className="grid h-full place-items-center px-6 text-center">
                      <div className="max-w-md">
                        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded border border-line bg-panel text-moss">
                          <Search size={24} />
                        </div>
                        <div className="text-base font-semibold text-white">No matching tracks</div>
                        <div className="mt-2 text-sm text-muted">
                          Try a different search term, clear advanced filters, or broaden the current view.
                        </div>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          {search && (
                            <button className="secondary-button h-10" type="button" onClick={() => setSearch("")}>
                              <X size={16} />
                              Clear Search
                            </button>
                          )}
                          {advancedSearchActiveCount > 0 && (
                            <button className="secondary-button h-10" type="button" onClick={clearAdvancedTrackSearch}>
                              <SlidersHorizontal size={16} />
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {totalTracks === 0 && tracks.length === 0 && !isLoading && !trackSearchActive && !libraryHasAnyTracks && (
                    <div className="grid h-full place-items-center px-6 text-center">
                      <div className="max-w-md">
                        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded border border-line bg-panel text-moss">
                          <FolderOpen size={24} />
                        </div>
                        <div className="text-base font-semibold text-white">No tracks in the library yet</div>
                        <div className="mt-2 text-sm text-muted">
                          Choose the folder that holds your downloaded music and FLAC Cafe will scan it into your local catalog.
                        </div>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          <button className="primary-button h-10" type="button" disabled={isScanning} onClick={onChooseMusicFolder}>
                            <FolderOpen size={16} />
                            {isScanning ? "Scanning" : "Choose Music Folder"}
                          </button>
                          {suggestedMusicPath && (
                            <button
                              className="secondary-button h-10"
                              type="button"
                              disabled={isScanning}
                              title={suggestedMusicPath}
                              onClick={() => onUseSuggestedFolder(suggestedMusicPath)}
                            >
                              <FolderOpen size={16} />
                              Use Music Folder
                            </button>
                          )}
                        </div>
                        <button className="mt-3 text-xs text-muted hover:text-white" type="button" onClick={() => setLibraryView("health")}>
                          View library tools
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
    </>
  );
}
