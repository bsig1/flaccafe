import type { CSSProperties } from "react";
import type { AdvancedTrackSearchFilters } from "../../../types/api";
import { LibraryCollectionBranches } from "./LibraryCollectionBranches";
import { LibraryFloatingMenus } from "./LibraryFloatingMenus";
import { LibraryHealthBranch } from "./LibraryHealthBranch";
import { LibraryTrackBranch } from "./LibraryTrackBranch";

function LibraryAlbumModeToggle({ model }: { model: any }) {
  const { albumMode, setAlbumMode } = model;
  return (
    <div className="grid min-w-0 grid-cols-2 rounded border border-line bg-ink p-1 text-xs">
      {([["browse", "Browse"], ["completion", "Completion"]] as const).map(([id, label]) => (
        <button key={id} className={`h-8 min-w-0 rounded px-2 transition ${albumMode === id ? "bg-white/10 text-white" : "text-muted hover:text-white"}`} type="button" onClick={() => setAlbumMode(id)}>
          <span className="block truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}

function LibraryAlbumLayoutToggle({ model }: { model: any }) {
  const { LayoutGrid, List, albumGrid, onAlbumGridChange } = model;
  return (
    <div className="grid min-w-0 grid-cols-2 rounded border border-line bg-ink p-1 text-xs" aria-label="Album view layout">
      <button className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded px-2 transition ${albumGrid ? "bg-white/10 text-white" : "text-muted hover:text-white"}`} type="button" title="Show albums as a cover grid" aria-pressed={albumGrid} onClick={() => onAlbumGridChange(true)}>
        <LayoutGrid size={14} />
        <span className="sr-only">Grid</span>
      </button>
      <button className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded px-2 transition ${!albumGrid ? "bg-white/10 text-white" : "text-muted hover:text-white"}`} type="button" title="Show albums as a compact list" aria-pressed={!albumGrid} onClick={() => onAlbumGridChange(false)}>
        <List size={14} />
        <span className="sr-only">List</span>
      </button>
    </div>
  );
}

export function LibraryPageView({ model }: { model: any }) {
  const { Album, ArrowDown, ArrowUp, BarChart3, BookOpen, CheckCircle2, Download, Fingerprint, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Play, Podcast, Plus, RefreshCw, Save, Search, ShieldCheck, Shuffle, SkipForward, SlidersHorizontal, Star, Tag, Trash2, Upload, UserRound, Volume2, Wand2, X, RatingStars, ResizableHeader, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, albumArtworkUrl, albumCoverUrl, defaultLibraryVisibleColumns, libraryColumnDefinitions, librarySelectionColumnWidth, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatRating, formatShortDate, formatTime, trackGenre, albumMetaLabel, artistMetaLabel, missingMetadataFields, missingMetadataFilters, ALBUM_GRID_ROW_HEIGHT, ALBUM_LIST_ROW_HEIGHT, ARTIST_ROW_HEIGHT, COMPLETION_COLLAPSED_ROW_HEIGHT, COMPLETION_EXPANDED_ROW_ESTIMATE, LIBRARY_ACTIONS_MENU_HEIGHT, LIBRARY_ACTIONS_MENU_WIDTH, MENU_VIEWPORT_MARGIN, PLAYLIST_ROW_HEIGHT, PLAYLIST_TOOLBAR_HEIGHT, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_AVOID_SUBMENU_WIDTH, TRACK_CONTEXT_DIVIDER_HEIGHT, TRACK_CONTEXT_HEADER_HEIGHT, TRACK_CONTEXT_MENU_HEIGHT, TRACK_CONTEXT_MENU_WIDTH, TRACK_CONTEXT_ROW_HEIGHT, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_PLAYLIST_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT, TRACK_RATING_SUBMENU_WIDTH, TRACK_SUBMENU_CLOSE_DELAY_MS, TRACK_TAGGING_SUBMENU_HEIGHT, TRACK_VIRTUALIZATION_OVERSCAN, TRACK_VIRTUALIZATION_THRESHOLD, tracks, trackIndexCache, totalTracks, albums, artists, playlists, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, libraryStats, libraryHealth, inbox, targetPlaylistId, newPlaylistName, importPlaylistPath, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, setAdvancedTrackSearch, refreshTracks, refreshAlbums, loadMoreTracks, loadTrackWindow, isLoading, hasMoreTracks, sort, setSort, scrollTop, setScrollTop, artistScrollTop, setArtistScrollTop, albumScrollTop, setAlbumScrollTop, completionScrollTop, setCompletionScrollTop, playlistScrollTop, setPlaylistScrollTop, onRating, onBulkRating, onPlayTrack, onPlayNext, onAddToQueue, onSelectAlbum, onSelectArtist, onPlayAlbum, onPlayArtist, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onAutoTagTracks, onSyncFileMetadata, onFingerprintTagTracks, onClapGenreTagTracks, onVolumeTagTracks, onOpenFileManagementTracks, onRequestDeleteTracks, onRemoveTrackFromPlaylist, onRemoveTracksFromPlaylist, onMovePlaylistTrack, onExportTracks, onExportPlaylist, onImportPlaylist, onReviewInboxTracks, onUpdateInboxNote, onSaveInboxAutoReviewRule, onDeleteInboxAutoReviewRule, onShuffleTracks, onQuickAutoDj, onAvoidAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, onIgnoreDuplicateGroup, onClearIgnoredDuplicateGroups, isAudioAnalyzing, currentTrackId, currentTrack, hideFilePaths, compactRows, albumGrid, writeRatingsToFiles, libraryVisibleColumns, setLibraryVisibleColumns, onAlbumGridChange, setTargetPlaylistId, setNewPlaylistName, setImportPlaylistPath, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, columnWidths, setColumnWidths, contextMenu, setContextMenu, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, activeContextSubmenu, setActiveContextSubmenu, selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, showAllDuplicateGroups, setShowAllDuplicateGroups, showAllMissingMetadata, setShowAllMissingMetadata, missingMetadataFilter, setMissingMetadataFilter, bulkMetadataOpen, setBulkMetadataOpen, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, albumArtworkCandidates, setAlbumArtworkCandidates, isAlbumArtworkOpen, setIsAlbumArtworkOpen, isSearchingAlbumArtwork, setIsSearchingAlbumArtwork, albumArtworkStatus, setAlbumArtworkStatus, inboxNoteDraft, setInboxNoteDraft, editingInboxRuleId, setEditingInboxRuleId, inboxRuleName, setInboxRuleName, inboxRuleEnabled, setInboxRuleEnabled, inboxRuleField, setInboxRuleField, inboxRuleMatchType, setInboxRuleMatchType, inboxRuleValue, setInboxRuleValue, inboxRuleNote, setInboxRuleNote, inboxRuleApplyExisting, setInboxRuleApplyExisting, albumMode, setAlbumMode, artistPaneHeight, setArtistPaneHeight, albumPaneHeight, setAlbumPaneHeight, playlistPaneHeight, setPlaylistPaneHeight, completionFilter, setCompletionFilter, completionHeightVersion, setCompletionHeightVersion, completionOpenAlbumId, setCompletionOpenAlbumId, completionLoadingAlbumId, setCompletionLoadingAlbumId, completionLookupAlbumId, setCompletionLookupAlbumId, completionLookupMessages, setCompletionLookupMessages, completionLookupAllActive, setCompletionLookupAllActive, completionLookupAllProgress, setCompletionLookupAllProgress, showAdvancedSearch, setShowAdvancedSearch, virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, playlistListRef, contextMenuRef, searchInputRef, selectionAnchorId, completionLookupCancelRef, visibleColumns, visibleColumnDefs, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, rowPadding, trackRowHeight, loadedTrackCount, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, advancedSearchInputClass, activeAlbum, activeArtist, activePlaylist, missingMetadataRows, filteredMissingMetadataRows, visibleMissingMetadataRows, visibleDuplicateGroups, completionQuery, completionSearchTerms, completionMatchesSearch, albumCompletionExpected, albumCompletionMissing, completionAlbums, visibleCompletionAlbums, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, completeAlbumCount, missingTrackEstimate, advancedSelectionKey, completionLookupEta, librarySummaryText, viewTracks, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, resetInboxRuleForm, editInboxRule, saveInboxRule, handleSort, handleResize, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, loadAlbumArtworkCandidates, openAlbumArtworkManager, albumArtworkActionStatus, chooseSidecarArtwork, embedSidecarArtwork, saveEmbeddedArtwork, embedEmbeddedArtwork, searchWebArtwork, saveWebArtwork, clearSelectedAlbumArtwork, handleScroll, openTrackContextMenu, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart, columnTextClass, renderMetadataCell, renderTableHeader, isInteractiveTrackCellTarget, handleLibrarySurfaceClick, renderTrackRow, renderTrackPlaceholderRow, renderVirtualTrackRows, renderTrackRows, toggleCompletionAlbum, handleCompletionLengthLookup, handleCompletionLookupAll, cancelCompletionLookupAll, updateAdvancedTrackSearch, clearAdvancedTrackSearch, contextSelectionTracks, contextSelectionIds, contextBulk, contextLabel, contextPlaylistSubmenuHeight, contextSubmenuStyle, openContextSubmenu, scheduleContextSubmenuClose, contextSubmenuClass } = model;

  if (showQuickStart) {
    return (
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line px-6">
          <div>
            <h1 className="text-lg font-semibold text-white">Library</h1>
            <p className="text-xs text-muted">Choose a source folder to start.</p>
          </div>
        </header>
        <QuickStartPanel isScanning={isScanning} suggestedMusicPath={suggestedMusicPath} onChooseMusicFolder={onChooseMusicFolder} onUseSuggestedFolder={onUseSuggestedFolder} onOpenSettings={onOpenSettings} onDismiss={onDismissQuickStart} />
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Library</h1>
          <p className="text-xs text-muted">{librarySummaryText}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <label className="relative block min-w-[12rem] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
            <input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 w-full rounded border border-line bg-panel pl-9 pr-10 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2 sm:w-[min(20rem,42vw)]" placeholder="Search tracks, artists, albums" />
            {search && (
              <button className="absolute right-1.5 top-1 h-7 w-7 rounded text-muted transition hover:bg-elevated hover:text-white" type="button" title="Clear library search" onClick={() => setSearch("")}>
                <X size={14} className="mx-auto" />
              </button>
            )}
          </label>
          <button className={`secondary-button h-9 ${showAdvancedSearch || advancedSearchActiveCount ? "border-moss/60 text-white" : ""}`} title="Advanced track search" type="button" onClick={() => setShowAdvancedSearch((current: boolean) => !current)}>
            <SlidersHorizontal size={16} />
            {advancedSearchActiveCount ? ` (${advancedSearchActiveCount})` : ""}
          </button>
          <button className="icon-button" title="Refresh" type="button" onClick={refreshTracks}>
            <RefreshCw size={17} />
          </button>
        </div>
      </header>
      {showAdvancedSearch && (
        <div className="border-b border-line bg-[rgb(var(--color-strip))] px-6 py-3">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="text-sm font-semibold text-white">Advanced Track Search</div></div>
              <button className="secondary-button h-8 text-xs" type="button" disabled={!advancedSearchActiveCount} onClick={clearAdvancedTrackSearch}>
                <X size={14} />
                Clear Filters
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1 text-xs uppercase text-muted">Artist<input className={advancedSearchInputClass} value={advancedTrackSearch.artist ?? ""} placeholder="Artist or album artist" onChange={(event) => updateAdvancedTrackSearch("artist", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Album<input className={advancedSearchInputClass} value={advancedTrackSearch.album ?? ""} placeholder="Album title" onChange={(event) => updateAdvancedTrackSearch("album", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Genre<input className={advancedSearchInputClass} value={advancedTrackSearch.genre ?? ""} placeholder="Tag or CLAP genre" onChange={(event) => updateAdvancedTrackSearch("genre", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">File Type<input className={advancedSearchInputClass} value={advancedTrackSearch.extension ?? ""} placeholder="flac, mp3, opus" onChange={(event) => updateAdvancedTrackSearch("extension", event.target.value)} /></label>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="grid gap-1 text-xs uppercase text-muted">Rating<select className={advancedSearchInputClass} value={advancedTrackSearch.rating_state ?? "any"} onChange={(event) => updateAdvancedTrackSearch("rating_state", event.target.value as AdvancedTrackSearchFilters["rating_state"])}><option value="any">Any</option><option value="rated">Rated only</option><option value="unrated">Unrated only</option></select></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Min Stars<input className={advancedSearchInputClass} inputMode="decimal" value={advancedTrackSearch.min_rating ?? ""} placeholder="0.5-5" onChange={(event) => updateAdvancedTrackSearch("min_rating", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Max Stars<input className={advancedSearchInputClass} inputMode="decimal" value={advancedTrackSearch.max_rating ?? ""} placeholder="0.5-5" onChange={(event) => updateAdvancedTrackSearch("max_rating", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">From Year<input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.year_from ?? ""} placeholder="1995" onChange={(event) => updateAdvancedTrackSearch("year_from", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">To Year<input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.year_to ?? ""} placeholder="2026" onChange={(event) => updateAdvancedTrackSearch("year_to", event.target.value)} /></label>
              <label className="flex items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2 text-xs uppercase text-muted">Missing Metadata<input type="checkbox" className="h-4 w-4 accent-moss" checked={Boolean(advancedTrackSearch.missing_metadata)} onChange={(event) => updateAdvancedTrackSearch("missing_metadata", event.target.checked)} /></label>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_repeat(2,minmax(8rem,12rem))]">
              <label className="grid gap-1 text-xs uppercase text-muted">File Path Contains<input className={advancedSearchInputClass} value={advancedTrackSearch.path ?? ""} placeholder="folder, drive, edition, etc." onChange={(event) => updateAdvancedTrackSearch("path", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Min Seconds<input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.min_duration ?? ""} placeholder="120" onChange={(event) => updateAdvancedTrackSearch("min_duration", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Max Seconds<input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.max_duration ?? ""} placeholder="480" onChange={(event) => updateAdvancedTrackSearch("max_duration", event.target.value)} /></label>
            </div>
          </div>
        </div>
      )}
      <div className="flex min-h-14 flex-col gap-2 border-b border-line bg-[rgb(var(--color-strip))] px-3 py-2 min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:justify-between min-[1280px]:px-6 min-[1280px]:py-3">
        <div className="flex min-w-0 flex-col gap-2 min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-3">
          <LibraryViewTabs libraryView={libraryView} setLibraryView={setLibraryView} />
          {libraryView === "albums" && (
            <div className="grid w-full min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-2 min-[1280px]:w-[20rem] min-[1280px]:shrink-0">
              {albumMode === "browse" && <div className="min-w-0"><LibraryAlbumLayoutToggle model={model} /></div>}
              <div className={`min-w-0 ${albumMode === "browse" ? "" : "col-span-2"}`}><LibraryAlbumModeToggle model={model} /></div>
            </div>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] min-[1280px]:justify-end [&::-webkit-scrollbar]:hidden">
          {selectedIds.length > 0 && (
            <button className="secondary-button shrink-0" type="button" title="Open selected tracks in File Management" onClick={() => void onOpenFileManagementTracks(selectedIds)}>
              <FolderOpen size={16} />
              File Management
              <span className="rounded border border-line bg-ink px-1.5 py-0.5 text-[11px] leading-none text-muted">{selectedIds.length.toLocaleString()}</span>
            </button>
          )}
          <button className="icon-button shrink-0" type="button" title="Shuffle current view" disabled={viewTracks.length === 0} onClick={() => onShuffleTracks(viewTracks)}><Shuffle size={16} /></button>
          <button className="primary-button shrink-0" type="button" onClick={() => onQuickAutoDj(currentTrack)}><Wand2 size={16} />AutoDJ</button>
          <button className={`icon-button shrink-0 ${libraryActionsMenu ? "border-moss text-white" : ""}`} type="button" title="Library actions" aria-haspopup="menu" aria-expanded={Boolean(libraryActionsMenu)} onClick={toggleLibraryActionsMenu}><MoreHorizontal size={17} /></button>
        </div>
      </div>
      <div className="relative min-h-0 min-w-0 flex flex-1">
        <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto" style={{ overflowAnchor: "none" } as CSSProperties} onScroll={handleScroll} onPointerDown={cancelScrollRestoreForUserInput} onWheel={cancelScrollRestoreForUserInput} onClick={handleLibrarySurfaceClick}>
          <LibraryTrackBranch model={model} />
          <LibraryCollectionBranches model={model} />
          <LibraryHealthBranch model={model} />
        </div>
        {renderActiveTopButton()}
        <TrackDetailsPanel track={detailTrack} queue={viewTracks} playlists={playlists} isAudioAnalyzing={isAudioAnalyzing} onClose={() => setDetailTrack(null)} onSelectTrack={selectSingleTrack} isTrackSelected={detailTrack ? selectedTrackIds.has(detailTrack.id) : false} onPlayTrack={onPlayTrack} onRating={onRating} onAnalyzeTracks={onAnalyzeTracks} onAddTracksToPlaylist={onAddTracksToPlaylist} onDeleteTrack={onDeleteTrack} onEditTrack={onEditTrack} onRevealTrack={onRevealTrack} />
        {bulkMetadataOpen && <BulkMetadataModal tracks={selectedTracks} writeToFiles={writeRatingsToFiles} onClose={() => setBulkMetadataOpen(false)} onSave={async (metadata: any) => { await onBulkMetadata(selectedIds, metadata); setBulkMetadataOpen(false); clearSelection(); }} />}
      </div>
      <LibraryFloatingMenus model={model} />
    </main>
  );
}
