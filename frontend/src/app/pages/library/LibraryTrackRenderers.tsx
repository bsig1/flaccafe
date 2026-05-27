export function createLibraryTrackRenderers(model: any) {
  const { Album, ArrowDown, ArrowUp, BarChart3, BookOpen, CheckCircle2, Download, Fingerprint, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Play, Podcast, Plus, RefreshCw, Save, Search, ShieldCheck, Shuffle, SkipForward, SlidersHorizontal, Star, Tag, Trash2, Upload, UserRound, Volume2, Wand2, X, RatingStars, ResizableHeader, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, albumArtworkUrl, albumCoverUrl, defaultLibraryVisibleColumns, libraryColumnDefinitions, librarySelectionColumnWidth, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatRating, formatShortDate, formatTime, trackGenre, albumMetaLabel, artistMetaLabel, missingMetadataFields, missingMetadataFilters, ALBUM_GRID_ROW_HEIGHT, ALBUM_LIST_ROW_HEIGHT, ARTIST_ROW_HEIGHT, COMPLETION_COLLAPSED_ROW_HEIGHT, COMPLETION_EXPANDED_ROW_ESTIMATE, LIBRARY_ACTIONS_MENU_HEIGHT, LIBRARY_ACTIONS_MENU_WIDTH, MENU_VIEWPORT_MARGIN, PLAYLIST_ROW_HEIGHT, PLAYLIST_TOOLBAR_HEIGHT, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_AVOID_SUBMENU_WIDTH, TRACK_CONTEXT_DIVIDER_HEIGHT, TRACK_CONTEXT_HEADER_HEIGHT, TRACK_CONTEXT_MENU_HEIGHT, TRACK_CONTEXT_MENU_WIDTH, TRACK_CONTEXT_ROW_HEIGHT, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_PLAYLIST_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT, TRACK_RATING_SUBMENU_WIDTH, TRACK_SUBMENU_CLOSE_DELAY_MS, TRACK_TAGGING_SUBMENU_HEIGHT, TRACK_VIRTUALIZATION_OVERSCAN, TRACK_VIRTUALIZATION_THRESHOLD, tracks, trackIndexCache, totalTracks, albums, artists, playlists, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, libraryStats, libraryHealth, inbox, targetPlaylistId, newPlaylistName, importPlaylistPath, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, setAdvancedTrackSearch, refreshTracks, refreshAlbums, loadMoreTracks, loadTrackWindow, isLoading, hasMoreTracks, sort, setSort, scrollTop, setScrollTop, artistScrollTop, setArtistScrollTop, albumScrollTop, setAlbumScrollTop, completionScrollTop, setCompletionScrollTop, playlistScrollTop, setPlaylistScrollTop, onRating, onBulkRating, onPlayTrack, onPlayNext, onAddToQueue, onSelectAlbum, onSelectArtist, onPlayAlbum, onPlayArtist, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onAutoTagTracks, onSyncFileMetadata, onFingerprintTagTracks, onClapGenreTagTracks, onVolumeTagTracks, onOpenFileManagementTracks, onRequestDeleteTracks, onRemoveTrackFromPlaylist, onRemoveTracksFromPlaylist, onMovePlaylistTrack, onExportTracks, onExportPlaylist, onImportPlaylist, onReviewInboxTracks, onUpdateInboxNote, onSaveInboxAutoReviewRule, onDeleteInboxAutoReviewRule, onShuffleTracks, onQuickAutoDj, onAvoidAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, onIgnoreDuplicateGroup, onClearIgnoredDuplicateGroups, isAudioAnalyzing, currentTrackId, currentTrack, hideFilePaths, compactRows, albumGrid, writeRatingsToFiles, libraryVisibleColumns, setLibraryVisibleColumns, onAlbumGridChange, setTargetPlaylistId, setNewPlaylistName, setImportPlaylistPath, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, columnWidths, setColumnWidths, contextMenu, setContextMenu, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, activeContextSubmenu, setActiveContextSubmenu, selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, showAllDuplicateGroups, setShowAllDuplicateGroups, showAllMissingMetadata, setShowAllMissingMetadata, missingMetadataFilter, setMissingMetadataFilter, bulkMetadataOpen, setBulkMetadataOpen, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, albumArtworkCandidates, setAlbumArtworkCandidates, isAlbumArtworkOpen, setIsAlbumArtworkOpen, isSearchingAlbumArtwork, setIsSearchingAlbumArtwork, albumArtworkStatus, setAlbumArtworkStatus, inboxNoteDraft, setInboxNoteDraft, editingInboxRuleId, setEditingInboxRuleId, inboxRuleName, setInboxRuleName, inboxRuleEnabled, setInboxRuleEnabled, inboxRuleField, setInboxRuleField, inboxRuleMatchType, setInboxRuleMatchType, inboxRuleValue, setInboxRuleValue, inboxRuleNote, setInboxRuleNote, inboxRuleApplyExisting, setInboxRuleApplyExisting, albumMode, setAlbumMode, artistPaneHeight, setArtistPaneHeight, albumPaneHeight, setAlbumPaneHeight, playlistPaneHeight, setPlaylistPaneHeight, completionFilter, setCompletionFilter, completionHeightVersion, setCompletionHeightVersion, completionOpenAlbumId, setCompletionOpenAlbumId, completionLoadingAlbumId, setCompletionLoadingAlbumId, completionLookupAlbumId, setCompletionLookupAlbumId, completionLookupMessages, setCompletionLookupMessages, completionLookupAllActive, setCompletionLookupAllActive, completionLookupAllProgress, setCompletionLookupAllProgress, showAdvancedSearch, setShowAdvancedSearch, virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, playlistListRef, contextMenuRef, searchInputRef, selectionAnchorId, completionLookupCancelRef, visibleColumns, visibleColumnDefs, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, rowPadding, trackRowHeight, loadedTrackCount, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, advancedSearchInputClass, activeAlbum, activeArtist, activePlaylist, missingMetadataRows, filteredMissingMetadataRows, visibleMissingMetadataRows, visibleDuplicateGroups, completionQuery, completionSearchTerms, completionMatchesSearch, albumCompletionExpected, albumCompletionMissing, completionAlbums, visibleCompletionAlbums, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, completeAlbumCount, missingTrackEstimate, advancedSelectionKey, completionLookupEta, librarySummaryText, viewTracks, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, resetInboxRuleForm, editInboxRule, saveInboxRule, handleSort, handleResize, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, loadAlbumArtworkCandidates, openAlbumArtworkManager, albumArtworkActionStatus, chooseSidecarArtwork, embedSidecarArtwork, saveEmbeddedArtwork, embedEmbeddedArtwork, searchWebArtwork, saveWebArtwork, clearSelectedAlbumArtwork, handleScroll, openTrackContextMenu, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart, toggleCompletionAlbum, handleCompletionLengthLookup, handleCompletionLookupAll, cancelCompletionLookupAll, updateAdvancedTrackSearch, clearAdvancedTrackSearch, contextSelectionTracks, contextSelectionIds, contextBulk, contextLabel, contextPlaylistSubmenuHeight, contextSubmenuStyle, openContextSubmenu, scheduleContextSubmenuClose, contextSubmenuClass } = model;
  function columnTextClass(column: any) {
    return `${column.align === "right" ? "text-right tabular-nums" : "truncate"} ${
      column.key === "artist" ? "text-neutral-200" : column.key === "album" ? "text-neutral-300" : "text-muted"
    }`;
  }

  function renderMetadataCell(track: any, column: any) {
    switch (column.key) {
      case "title":
        return (
          <>
            <div className="truncate font-medium text-white">{display(track.title, "Untitled")}</div>
            {!hideFilePaths && !visibleColumns.includes("path") && <div className="truncate text-xs text-muted">{track.path}</div>}
          </>
        );
      case "artist":
        return display(track.artist);
      case "album":
        return display(track.album);
      case "album_artist":
        return display(track.album_artist);
      case "track_number":
        return display(track.track_number, "-");
      case "disc_number":
        return display(track.disc_number, "-");
      case "genre":
        return display(trackGenre(track), "-");
      case "bitrate":
        return formatBitrate(track.bitrate);
      case "replaygain_track_gain_db":
        return track.replaygain_track_gain_db === null || track.replaygain_track_gain_db === undefined
          ? "-"
          : `${track.replaygain_track_gain_db.toFixed(2)} dB`;
      case "replaygain_album_gain_db":
        return track.replaygain_album_gain_db === null || track.replaygain_album_gain_db === undefined
          ? "-"
          : `${track.replaygain_album_gain_db.toFixed(2)} dB`;
      case "replaygain_track_peak":
        return track.replaygain_track_peak === null || track.replaygain_track_peak === undefined
          ? "-"
          : track.replaygain_track_peak.toFixed(3);
      case "replaygain_album_peak":
        return track.replaygain_album_peak === null || track.replaygain_album_peak === undefined
          ? "-"
          : track.replaygain_album_peak.toFixed(3);
      case "analysis_genre":
        return display(track.analysis_genre, "-");
      case "analysis_genre_confidence":
        return track.analysis_genre_confidence !== null && track.analysis_genre_confidence !== undefined
          ? formatPercent(track.analysis_genre_confidence * 100)
          : "-";
      case "analysis_provider":
        return display(track.analysis_provider, "-");
      case "analysis_updated_at":
        return formatShortDate(track.analysis_updated_at);
      case "year":
        return display(track.year, "-");
      case "rating":
        return <RatingStars rating={track.rating} onChange={(rating: any) => onRating(track.id, rating)} />;
      case "duration_seconds":
        return formatDuration(track.duration_seconds);
      case "play_count":
        return track.play_count.toLocaleString();
      case "skip_count":
        return track.skip_count.toLocaleString();
      case "last_played_at":
        return formatShortDate(track.last_played_at);
      case "last_skipped_at":
        return formatShortDate(track.last_skipped_at);
      case "date_added":
        return formatShortDate(track.date_added);
      case "file_modified_at":
        return formatShortDate(track.file_modified_at);
      case "file_name":
        return fileName(track.path);
      case "audio_fingerprint":
        return formatFingerprint(track.audio_fingerprint);
      case "path":
        return track.path;
      default:
        return "-";
    }
  }

  function renderTableHeader(sortable: boolean) {
    return (
      <tr onContextMenu={openColumnContextMenu}>
        <th className="px-3 py-3">
          <input
            aria-label={libraryView === "tracks" ? "Select all matching tracks" : "Select current view"}
            type="checkbox"
            className="h-4 w-4 accent-moss"
            checked={allViewSelected}
            disabled={selectableTrackCount === 0 || isSelectingAllTracks}
            onChange={(event) => handleHeaderSelectionChange(event.target.checked)}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={suppressCheckboxContextMenu}
          />
        </th>
        <ResizableHeader label="" column="play" width={columnWidths.play} sort={sort} onSort={handleSort} onResize={handleResize} />
        {visibleColumnDefs.map((column: any) => (
          <ResizableHeader
            key={column.key}
            label={column.label}
            column={column.key}
            width={columnWidths[column.key]}
            sortKey={sortable ? column.sortKey : undefined}
            sort={sort}
            onSort={handleSort}
            onResize={handleResize}
            align={column.align}
            draggableColumn={column.key}
            isDragging={draggedColumn === column.key}
            isDragOver={dragOverColumn === column.key}
            onColumnDragStart={handleColumnDragStart}
            onColumnDragOver={handleColumnDragOver}
            onColumnDrop={handleColumnDrop}
            onColumnDragEnd={handleColumnDragEnd}
            onColumnPointerDragStart={handleColumnPointerDragStart}
          />
        ))}
      </tr>
    );
  }

  function isInteractiveTrackCellTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && Boolean(target.closest("button, a, input, textarea, select, summary, details"));
  }

  function handleLibrarySurfaceClick(event: any) {
    const target = event.target as HTMLElement | null;
    if (!target || target.closest("[data-track-row], button, a, input, textarea, select, summary, details, [role='menu']")) {
      return;
    }
    if (selectedTrackIds.size > 0) {
      clearSelection();
    }
  }

  function renderTrackRow(track: any, interactionList: any[], removable = false) {
    return (
      <tr
        key={track.id}
        data-track-row
        style={{ height: trackRowHeight }}
        className={`cursor-pointer border-b border-line/60 hover:bg-white/[0.035] ${
          detailTrack?.id === track.id ? "bg-white/[0.06]" : selectedTrackIds.has(track.id) ? "bg-white/[0.035]" : ""
        } select-none`}
        onClick={(event) => {
          if (isInteractiveTrackCellTarget(event.target)) {
            return;
          }
          selectTrackLikeWindows(event, track, interactionList, { openDetails: false });
          model.scheduleTrackDetailOpen?.(track);
        }}
        onDoubleClick={(event) => {
          if (isInteractiveTrackCellTarget(event.target)) {
            return;
          }
          event.preventDefault();
          model.cancelPendingTrackDetailOpen?.();
          onPlayTrack(track, interactionList);
        }}
        onContextMenu={(event) => openTrackContextMenu(event, track, interactionList, removable)}
      >
        <td className={rowPadding}>
          <input
            aria-label={`Select ${display(track.title, "track")}`}
            type="checkbox"
            className="pointer-events-none h-4 w-4 accent-moss"
            checked={selectedTrackIds.has(track.id)}
            readOnly
            tabIndex={-1}
          />
        </td>
        <td className={rowPadding}>
          <div className="flex items-center justify-center">
            <button
              className={`icon-button h-8 w-8 ${currentTrackId === track.id ? "border-moss text-moss" : ""}`}
              title={`Play ${display(track.title, "track")}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                model.cancelPendingTrackDetailOpen?.();
                onPlayTrack(track, interactionList);
              }}
            >
              {currentTrackId === track.id ? <Volume2 size={15} /> : <Play size={15} />}
            </button>
          </div>
        </td>
        {visibleColumnDefs.map((column: any) => (
          <td key={column.key} className={`${rowPadding} ${columnTextClass(column)}`} title={column.key === "path" ? track.path : undefined}>
            {renderMetadataCell(track, column)}
          </td>
        ))}
      </tr>
    );
  }

  function renderTrackPlaceholderRow(index: number) {
    return (
      <tr key={`track-placeholder-${index}`} aria-hidden="true" style={{ height: trackRowHeight }} className="border-b border-line/40">
        <td className={rowPadding}>
          <div className="h-4 w-4 rounded border border-line/70 bg-white/[0.025]" />
        </td>
        <td className={rowPadding}>
          <div className="mx-auto h-8 w-8 rounded border border-line/70 bg-white/[0.025]" />
        </td>
        {visibleColumnDefs.map((column: any, columnIndex: number) => (
          <td key={column.key} className={rowPadding}>
            <div
              className="h-3 rounded bg-white/[0.045]"
              style={{ width: columnIndex === 0 ? "72%" : column.align === "right" ? "44%" : "56%" }}
            />
          </td>
        ))}
      </tr>
    );
  }

  function renderVirtualTrackRows() {
    const rows = [];
    for (let index = virtualTrackStartIndex; index < virtualTrackEndIndex; index += 1) {
      const track = trackIndexCache.get(index);
      rows.push(track ? renderTrackRow(track, tracks) : renderTrackPlaceholderRow(index));
    }
    return rows;
  }

  function renderTrackRows(list: any[], options: { removable?: boolean; interactionList?: any[] } = {}) {
    const interactionList = options.interactionList ?? list;
    return list.map((track) => renderTrackRow(track, interactionList, Boolean(options.removable)));
  }

  return {
    columnTextClass, renderMetadataCell, renderTableHeader, isInteractiveTrackCellTarget, handleLibrarySurfaceClick,
    renderTrackRow, renderTrackPlaceholderRow, renderVirtualTrackRows, renderTrackRows,
  };
}
