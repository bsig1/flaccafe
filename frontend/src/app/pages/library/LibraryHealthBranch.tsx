import { useState } from "react";
import type { ReactNode } from "react";

import type { DuplicateGroup } from "../../../types/api";

type HealthSectionId = "missingFiles" | "missingMetadata" | "duplicates" | "unrated";

export function LibraryHealthBranch({ model }: { model: any }) {
  const { Album, ArrowDown, ArrowUp, BarChart3, BookOpen, CheckCircle2, Download, Fingerprint, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Play, Podcast, Plus, RefreshCw, Save, Search, ShieldCheck, Shuffle, SkipForward, SlidersHorizontal, Star, Tag, Trash2, Upload, UserRound, Volume2, Wand2, X, RatingStars, ResizableHeader, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, albumArtworkUrl, albumCoverUrl, defaultLibraryVisibleColumns, libraryColumnDefinitions, librarySelectionColumnWidth, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatRating, formatShortDate, formatTime, trackGenre, albumMetaLabel, artistMetaLabel, missingMetadataFields, missingMetadataFilters, ALBUM_GRID_ROW_HEIGHT, ALBUM_LIST_ROW_HEIGHT, ARTIST_ROW_HEIGHT, COMPLETION_COLLAPSED_ROW_HEIGHT, COMPLETION_EXPANDED_ROW_ESTIMATE, LIBRARY_ACTIONS_MENU_HEIGHT, LIBRARY_ACTIONS_MENU_WIDTH, MENU_VIEWPORT_MARGIN, PLAYLIST_ROW_HEIGHT, PLAYLIST_TOOLBAR_HEIGHT, TRACK_AVOID_SUBMENU_HEIGHT, TRACK_AVOID_SUBMENU_WIDTH, TRACK_CONTEXT_DIVIDER_HEIGHT, TRACK_CONTEXT_HEADER_HEIGHT, TRACK_CONTEXT_MENU_HEIGHT, TRACK_CONTEXT_MENU_WIDTH, TRACK_CONTEXT_ROW_HEIGHT, TRACK_CONTEXT_SUBMENU_WIDTH, TRACK_PLAYLIST_SUBMENU_WIDTH, TRACK_RATING_SUBMENU_HEIGHT, TRACK_RATING_SUBMENU_WIDTH, TRACK_SUBMENU_CLOSE_DELAY_MS, TRACK_TAGGING_SUBMENU_HEIGHT, TRACK_VIRTUALIZATION_OVERSCAN, TRACK_VIRTUALIZATION_THRESHOLD, tracks, trackIndexCache, totalTracks, albums, artists, playlists, selectedAlbumId, selectedAlbumTracks, selectedArtistName, selectedArtistTracks, selectedPlaylistId, selectedPlaylistTracks, libraryStats, libraryHealth, inbox, targetPlaylistId, newPlaylistName, importPlaylistPath, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, setAdvancedTrackSearch, refreshTracks, refreshAlbums, loadMoreTracks, loadTrackWindow, isLoading, hasMoreTracks, sort, setSort, scrollTop, setScrollTop, artistScrollTop, setArtistScrollTop, albumScrollTop, setAlbumScrollTop, completionScrollTop, setCompletionScrollTop, playlistScrollTop, setPlaylistScrollTop, onRating, onBulkRating, onPlayTrack, onPlayNext, onAddToQueue, onSelectAlbum, onSelectArtist, onPlayAlbum, onPlayArtist, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onAutoTagTracks, onSyncFileMetadata, onFingerprintTagTracks, onClapGenreTagTracks, onVolumeTagTracks, onOpenFileManagementTracks, onRequestDeleteTracks, onRemoveTrackFromPlaylist, onRemoveTracksFromPlaylist, onMovePlaylistTrack, onExportTracks, onExportPlaylist, onImportPlaylist, onReviewInboxTracks, onUpdateInboxNote, onSaveInboxAutoReviewRule, onDeleteInboxAutoReviewRule, onShuffleTracks, onQuickAutoDj, onAvoidAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, onIgnoreDuplicateGroup, onClearIgnoredDuplicateGroups, isAudioAnalyzing, currentTrackId, currentTrack, hideFilePaths, compactRows, albumGrid, writeRatingsToFiles, libraryVisibleColumns, setLibraryVisibleColumns, onAlbumGridChange, setTargetPlaylistId, setNewPlaylistName, setImportPlaylistPath, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, columnWidths, setColumnWidths, contextMenu, setContextMenu, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu, activeContextSubmenu, setActiveContextSubmenu, selectedTrackIds, setSelectedTrackIds, selectedTrackCache, setSelectedTrackCache, isSelectingAllTracks, setIsSelectingAllTracks, showAllDuplicateGroups, setShowAllDuplicateGroups, showAllMissingMetadata, setShowAllMissingMetadata, missingMetadataFilter, setMissingMetadataFilter, bulkMetadataOpen, setBulkMetadataOpen, draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, albumArtworkCandidates, setAlbumArtworkCandidates, isAlbumArtworkOpen, setIsAlbumArtworkOpen, isSearchingAlbumArtwork, setIsSearchingAlbumArtwork, albumArtworkStatus, setAlbumArtworkStatus, inboxNoteDraft, setInboxNoteDraft, editingInboxRuleId, setEditingInboxRuleId, inboxRuleName, setInboxRuleName, inboxRuleEnabled, setInboxRuleEnabled, inboxRuleField, setInboxRuleField, inboxRuleMatchType, setInboxRuleMatchType, inboxRuleValue, setInboxRuleValue, inboxRuleNote, setInboxRuleNote, inboxRuleApplyExisting, setInboxRuleApplyExisting, albumMode, setAlbumMode, artistPaneHeight, setArtistPaneHeight, albumPaneHeight, setAlbumPaneHeight, playlistPaneHeight, setPlaylistPaneHeight, completionFilter, setCompletionFilter, completionHeightVersion, setCompletionHeightVersion, completionOpenAlbumId, setCompletionOpenAlbumId, completionLoadingAlbumId, setCompletionLoadingAlbumId, completionLookupAlbumId, setCompletionLookupAlbumId, completionLookupMessages, setCompletionLookupMessages, completionLookupAllActive, setCompletionLookupAllActive, completionLookupAllProgress, setCompletionLookupAllProgress, showAdvancedSearch, setShowAdvancedSearch, virtualScrollTop, setVirtualScrollTop, trackViewportHeight, setTrackViewportHeight, scrollRef, artistListRef, albumListRef, completionListRef, playlistListRef, contextMenuRef, searchInputRef, selectionAnchorId, completionLookupCancelRef, visibleColumns, visibleColumnDefs, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, rowPadding, trackRowHeight, loadedTrackCount, shouldVirtualizeTrackRows, maxVirtualScrollTop, effectiveVirtualScrollTop, virtualTrackStartIndex, virtualTrackVisibleCount, virtualTrackEndIndex, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, advancedSearchInputClass, activeAlbum, activeArtist, activePlaylist, missingMetadataRows, filteredMissingMetadataRows, visibleMissingMetadataRows, visibleDuplicateGroups, completionQuery, completionSearchTerms, completionMatchesSearch, albumCompletionExpected, albumCompletionMissing, completionAlbums, visibleCompletionAlbums, completionListScrollTop, completionWindow, renderedCompletionAlbums, artistWindow, renderedArtists, albumGridColumns, albumBrowseRowHeight, albumWindow, renderedBrowseAlbums, playlistWindow, renderedPlaylists, completeAlbumCount, missingTrackEstimate, advancedSelectionKey, completionLookupEta, librarySummaryText, viewTracks, viewTrackLookup, selectedIds, selectedTracks, selectableTrackCount, allViewSelected, inboxNotesByTrackId, selectedInboxTrack, selectedInboxNote, getReachableScrollTop, applyScrollRestore, cancelScrollRestoreForUserInput, scrollCollectionPaneToTop, saveTrackPaneScrollTop, renderPaneTopButton, renderActiveTopButton, updateCompletionRowHeight, setCompletionRowElement, scheduleVirtualScrollUpdate, flushScrollPositionSave, scheduleScrollPositionSave, resetInboxRuleForm, editInboxRule, saveInboxRule, handleSort, handleResize, toggleTrackSelection, selectSingleTrack, selectTrackLikeWindows, setSelectionForList, selectAllCurrentScope, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, loadAlbumArtworkCandidates, openAlbumArtworkManager, albumArtworkActionStatus, chooseSidecarArtwork, embedSidecarArtwork, saveEmbeddedArtwork, embedEmbeddedArtwork, searchWebArtwork, saveWebArtwork, clearSelectedAlbumArtwork, handleScroll, openTrackContextMenu, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart, columnTextClass, renderMetadataCell, renderTableHeader, isInteractiveTrackCellTarget, handleLibrarySurfaceClick, renderTrackRow, renderTrackPlaceholderRow, renderVirtualTrackRows, renderTrackRows, toggleCompletionAlbum, handleCompletionLengthLookup, handleCompletionLookupAll, cancelCompletionLookupAll, updateAdvancedTrackSearch, clearAdvancedTrackSearch, contextSelectionTracks, contextSelectionIds, contextBulk, contextLabel, contextPlaylistSubmenuHeight, contextSubmenuStyle, openContextSubmenu, scheduleContextSubmenuClose, contextSubmenuClass } = model;
  const [collapsedSections, setCollapsedSections] = useState<Record<HealthSectionId, boolean>>({
    missingFiles: false,
    missingMetadata: false,
    duplicates: false,
    unrated: false,
  });

  const missingFiles = libraryHealth?.missing_files ?? [];
  const unratedTracks = libraryHealth?.unrated_tracks ?? [];
  const duplicateTotal = libraryHealth?.duplicate_group_total ?? libraryHealth?.duplicate_groups?.length ?? 0;
  const missingMetadataTotal = libraryHealth?.missing_metadata_total ?? missingMetadataRows.length;

  function toggleSection(section: HealthSectionId) {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function section(
    id: HealthSectionId,
    title: string,
    meta: string,
    children: ReactNode,
    actions?: ReactNode,
  ) {
    const collapsed = collapsedSections[id];
    return (
      <section className="min-w-0 border-b border-line/70 last:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-panel/60 px-3 py-2">
          <button
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            type="button"
            onClick={() => toggleSection(id)}
          >
            {collapsed ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            <span className="truncate text-sm font-semibold text-white">{title}</span>
            <span className="shrink-0 rounded border border-line bg-ink px-2 py-0.5 text-xs text-muted">{meta}</span>
          </button>
          {!collapsed && actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
        </div>
        {!collapsed && <div className="p-3">{children}</div>}
      </section>
    );
  }

  return (
    <>
              {libraryView === "health" && (
                <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] min-[1180px]:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] min-[1180px]:grid-rows-1">
                  <section className="min-h-0 overflow-auto border-b border-line p-3 min-[1180px]:border-b-0 min-[1180px]:border-r">
                    <div className="grid grid-cols-2 gap-2 min-[1180px]:grid-cols-1">
                      <div className="rounded border border-line bg-panel p-3">
                        <div className="text-xs uppercase text-muted">Tracks</div>
                        <div className="mt-1 text-xl font-semibold text-white">{libraryStats?.total_tracks.toLocaleString() ?? "-"}</div>
                      </div>
                      <div className="rounded border border-line bg-panel p-3">
                        <div className="text-xs uppercase text-muted">Albums</div>
                        <div className="mt-1 text-xl font-semibold text-white">{libraryStats?.total_albums.toLocaleString() ?? "-"}</div>
                      </div>
                      <div className="rounded border border-line bg-panel p-3">
                        <div className="text-xs uppercase text-muted">Unrated</div>
                        <div className="mt-1 text-xl font-semibold text-ember">{libraryStats?.unrated_tracks.toLocaleString() ?? "-"}</div>
                      </div>
                      <div className="rounded border border-line bg-panel p-3">
                        <div className="text-xs uppercase text-muted">Play / Skip Events</div>
                        <div className="mt-1 text-base font-semibold text-white">
                          {libraryStats ? `${libraryStats.played_events} / ${libraryStats.skipped_events}` : "-"}
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="min-h-0 min-w-0 overflow-auto p-3 min-[900px]:p-4">
                    <div className="overflow-hidden rounded border border-line bg-ink/30">
                      {section(
                        "missingFiles",
                        "Missing Files",
                        `${missingFiles.length.toLocaleString()} shown`,
                        <>
                          <div className="rounded border border-line">
                            {missingFiles.slice(0, 12).map((track: any) => (
                              <div key={track.id} className="grid gap-2 border-b border-line/60 px-3 py-2 last:border-b-0 min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:items-center">
                                <button
                                  className="min-w-0 text-left"
                                  type="button"
                                  onClick={() => setDetailTrack(track)}
                                >
                                  <div className="truncate text-sm text-white">{display(track.title, "Untitled")}</div>
                                  <div className="truncate text-xs text-muted">{track.path}</div>
                                </button>
                                <button
                                  className="secondary-button h-8 justify-self-start min-[760px]:justify-self-end"
                                  type="button"
                                  onClick={() => onDeleteTrack(track.id, false)}
                                >
                                  <Trash2 size={14} />
                                  Remove
                                </button>
                              </div>
                            ))}
                            {missingFiles.length === 0 && (
                              <div className="px-3 py-3 text-sm text-muted">No missing files found.</div>
                            )}
                          </div>
                        </>,
                      )}
                      {section(
                        "missingMetadata",
                        "Missing Metadata",
                        `${missingMetadataTotal.toLocaleString()} incomplete`,
                        <>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {missingMetadataFilters.map((filter: any) => {
                              const active = missingMetadataFilter === filter.id;
                              return (
                                <button
                                  key={filter.id}
                                  className={`rounded border px-2 py-1 text-xs transition ${
                                    active ? "border-moss bg-moss/10 text-moss" : "border-line bg-panel text-muted hover:text-white"
                                  }`}
                                  type="button"
                                  onClick={() => setMissingMetadataFilter(filter.id)}
                                >
                                  {filter.label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="rounded border border-line">
                            {visibleMissingMetadataRows.map((track: any) => {
                              const fields = missingMetadataFields(track);
                              return (
                                <div key={track.id} className="grid gap-2 border-b border-line/60 px-3 py-2 text-sm last:border-b-0 hover:bg-white/[0.035] min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:items-center">
                                  <button className="min-w-0 text-left" type="button" onClick={() => setDetailTrack(track)} onDoubleClick={() => onPlayTrack(track, [track])}>
                                    <div className="truncate text-white">{display(track.title, fileName(track.path) || "Untitled")}</div>
                                    <div className="truncate text-xs text-muted">{display(track.artist)} - {display(track.album)}</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {fields.map((field: any) => (
                                        <span key={field.id} className="rounded border border-ember/40 bg-ember/10 px-1.5 py-0.5 text-[11px] text-ember">
                                          {field.label}
                                        </span>
                                      ))}
                                    </div>
                                  </button>
                                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                                    <button className="icon-button h-8 w-8" type="button" title="Play track" onClick={() => onPlayTrack(track, [track])}>
                                      <Play size={14} />
                                    </button>
                                    <button className="secondary-button h-8" type="button" onClick={() => onEditTrack(track)}>
                                      <Pencil size={14} />
                                      Edit
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {visibleMissingMetadataRows.length === 0 && (
                              <div className="px-3 py-3 text-sm text-muted">
                                {missingMetadataFilter === "all" ? "No missing metadata found." : "No tracks match this missing-field filter."}
                              </div>
                            )}
                          </div>
                        </>,
                        filteredMissingMetadataRows.length > 30 && (
                          <button
                            className="text-xs text-muted hover:text-white"
                            type="button"
                            onClick={() => setShowAllMissingMetadata((current: any) => !current)}
                          >
                            {showAllMissingMetadata ? "Show fewer" : `Show all ${filteredMissingMetadataRows.length.toLocaleString()}`}
                          </button>
                        ),
                      )}
                      {section(
                        "duplicates",
                        "Potential Duplicates",
                        `${duplicateTotal.toLocaleString()} groups`,
                        <div className="grid gap-3">
                          {visibleDuplicateGroups.map((group: DuplicateGroup) => {
                            const keepId = group.recommended_keep_id ?? group.tracks[0]?.id ?? null;
                            const removableIds = group.tracks.filter((track: any) => track.id !== keepId).map((track: any) => track.id);
                            const deleteLabel = `Delete ${removableIds.length.toLocaleString()} other ${removableIds.length === 1 ? "copy" : "copies"}`;
                            return (
                              <div key={group.key} className="rounded border border-line bg-panel p-3">
                                <div className="grid gap-3 min-[900px]:grid-cols-[minmax(0,1fr)_auto]">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-white">{group.key}</div>
                                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                                      <span className="rounded border border-line bg-ink px-2 py-1 text-muted">{group.match_reason}</span>
                                      {group.duration_spread_seconds !== null && (
                                        <span className="rounded border border-line bg-ink px-2 py-1 text-muted">
                                          spread {formatTime(group.duration_spread_seconds)}
                                        </span>
                                      )}
                                      {group.bitrate_spread !== null && (
                                        <span className="rounded border border-line bg-ink px-2 py-1 text-muted">
                                          bitrate spread {formatBitrate(group.bitrate_spread)}
                                        </span>
                                      )}
                                      {group.shared_fingerprint && (
                                        <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-moss">same fingerprint</span>
                                      )}
                                      {group.average_audio_similarity !== null && (
                                        <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-moss">
                                          CLAP {group.average_audio_similarity.toFixed(2)}
                                        </span>
                                      )}
                                      {group.analyzed_tracks > 0 && (
                                        <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-moss">
                                          {group.analyzed_tracks} analyzed
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-wrap items-center gap-2 min-[900px]:justify-end">
                                    <div className="text-xs text-muted">{group.tracks.length} tracks</div>
                                    <button
                                      className="secondary-button h-8"
                                      type="button"
                                      title="Hide this duplicate group from Library Health"
                                      onClick={() => void onIgnoreDuplicateGroup(group.ignore_key, group.key)}
                                    >
                                      <CheckCircle2 size={14} />
                                      Ignore
                                    </button>
                                    <button
                                      className="secondary-button h-8"
                                      type="button"
                                      disabled={removableIds.length === 0}
                                      title="Delete or remove every copy in this group except the suggested keep copy"
                                      onClick={() => onRequestDeleteTracks(removableIds, `other duplicate copies for ${group.key}`, true)}
                                    >
                                      <Trash2 size={14} />
                                      {deleteLabel}
                                    </button>
                                    <button
                                      className="secondary-button h-8"
                                      type="button"
                                      onClick={() => onAnalyzeTracks(group.tracks.map((track: any) => track.id))}
                                      disabled={isAudioAnalyzing}
                                    >
                                      <Wand2 size={14} />
                                      Analyze Set
                                    </button>
                                  </div>
                                </div>
                                {group.recommendation_reason && (
                                  <div className="mt-2 rounded border border-moss/30 bg-moss/10 px-2 py-1.5 text-xs text-moss">
                                    Keep suggestion: {group.recommendation_reason}
                                  </div>
                                )}
                                <div className="mt-2 grid gap-1">
                                  {group.tracks.map((track: any) => {
                                    const recommended = track.id === keepId;
                                    return (
                                      <div
                                        key={track.id}
                                        className={`grid gap-2 rounded px-2 py-1.5 text-xs hover:bg-white/[0.04] min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-center ${
                                          recommended ? "bg-moss/10 text-moss" : "text-muted"
                                        }`}
                                      >
                                        <button className="grid min-w-0 gap-1 text-left min-[760px]:grid-cols-[52px_76px_minmax(0,1fr)_92px] min-[760px]:items-center" type="button" onClick={() => setDetailTrack(track)} onDoubleClick={() => onPlayTrack(track, group.tracks)}>
                                          <span className="tabular-nums">{formatDuration(track.duration_seconds)}</span>
                                          <span className="tabular-nums">{formatBitrate(track.bitrate)}</span>
                                          <span className="min-w-0 truncate">{track.path}</span>
                                          <span className="truncate min-[760px]:text-right">{formatFingerprint(track.audio_fingerprint)}</span>
                                        </button>
                                        <div className="flex flex-wrap items-center gap-1 min-[900px]:justify-end">
                                          {recommended && <span className="shrink-0 rounded border border-moss/40 px-2 py-0.5">keep</span>}
                                          <button className="icon-button h-7 w-7 shrink-0" type="button" title="Play this copy" onClick={() => onPlayTrack(track, group.tracks)}>
                                            <Play size={13} />
                                          </button>
                                          <button
                                            className="secondary-button h-7 shrink-0 px-2"
                                            type="button"
                                            title="Remove this track from the library or send the file to the Recycle Bin"
                                            onClick={() => onRequestDeleteTracks([track.id], display(track.title, fileName(track.path) || "duplicate track"), true)}
                                          >
                                            <Trash2 size={13} />
                                            Delete
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {group.path_roots.length > 0 && (
                                  <details className="mt-2 text-xs text-muted">
                                    <summary className="cursor-pointer text-neutral-300">Folders</summary>
                                    <div className="mt-1 grid gap-1">
                                      {group.path_roots.map((path) => (
                                        <div key={path} className="truncate">{path}</div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            );
                          })}
                          {visibleDuplicateGroups.length === 0 && (
                            <div className="rounded border border-line bg-panel px-3 py-3 text-sm text-muted">No duplicate groups found.</div>
                          )}
                        </div>,
                        <div className="flex flex-wrap items-center gap-2">
                          {(libraryHealth?.ignored_duplicate_group_total ?? 0) > 0 && (
                            <button
                              className="text-xs text-muted hover:text-white"
                              type="button"
                              onClick={() => void onClearIgnoredDuplicateGroups()}
                            >
                              Show ignored
                            </button>
                          )}
                          {duplicateTotal > visibleDuplicateGroups.length && (
                            <button
                              className="text-xs text-muted hover:text-white"
                              type="button"
                              onClick={() => setShowAllDuplicateGroups((current: any) => !current)}
                            >
                              {showAllDuplicateGroups ? "Show fewer" : `Review all ${duplicateTotal.toLocaleString()}`}
                            </button>
                          )}
                        </div>,
                      )}
                      {section(
                        "unrated",
                        "Unrated Triage",
                        `${unratedTracks.length.toLocaleString()} tracks`,
                        <div className="rounded border border-line">
                          {unratedTracks.slice(0, 12).map((track: any) => (
                            <div key={track.id} className="grid gap-2 border-b border-line/60 px-3 py-2 last:border-b-0 min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:items-center">
                              <button className="min-w-0 truncate text-left text-sm text-white" type="button" onClick={() => onPlayTrack(track, unratedTracks)}>
                                {display(track.title, "Untitled")} - {display(track.artist)}
                              </button>
                              <RatingStars rating={track.rating} onChange={(rating: any) => onRating(track.id, rating)} />
                            </div>
                          ))}
                          {unratedTracks.length === 0 && (
                            <div className="px-3 py-3 text-sm text-muted">No unrated music tracks found.</div>
                          )}
                        </div>,
                      )}
                    </div>
                  </section>
                </div>
              )}
    </>
  );
}
