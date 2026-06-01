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
  const { FolderOpen, MoreHorizontal, RadioTower, RefreshCw, Search, Shuffle, SlidersHorizontal, X, BulkMetadataModal, QuickStartPanel, TrackDetailsPanel, LibraryViewTabs, playlists, libraryView, setLibraryView, search, setSearch, advancedTrackSearch, refreshTracks, onRating, onPlayTrack, onAddTracksToPlaylist, onDeleteTrack, onEditTrack, onBulkMetadata, onOpenFileManagementTracks, onShuffleTracks, onQuickAutoDj, onRevealTrack, detailTrack, setDetailTrack, onAnalyzeTracks, isAudioAnalyzing, currentTrack, writeRatingsToFiles, displayRatingsAsNumbers, showQuickStart, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, onDismissQuickStart, onOpenSettings, libraryActionsMenu, selectedTrackIds, bulkMetadataOpen, setBulkMetadataOpen, albumMode, showAdvancedSearch, setShowAdvancedSearch, scrollRef, searchInputRef, advancedSearchActiveCount, advancedSearchInputClass, librarySummaryText, viewTracks, selectedIds, selectedTracks, cancelScrollRestoreForUserInput, renderActiveTopButton, selectSingleTrack, clearSelection, handleScroll, toggleLibraryActionsMenu, handleLibrarySurfaceClick, updateAdvancedTrackSearch, clearAdvancedTrackSearch, searchByAnalysisTag } = model;
  const advancedSearchChips = [
    advancedTrackSearch.artist?.trim() ? { key: "artist", label: `Artist: ${advancedTrackSearch.artist.trim()}` } : null,
    advancedTrackSearch.album?.trim() ? { key: "album", label: `Album: ${advancedTrackSearch.album.trim()}` } : null,
    advancedTrackSearch.genre?.trim() ? { key: "genre", label: `Genre: ${advancedTrackSearch.genre.trim()}` } : null,
    advancedTrackSearch.mood?.trim() ? { key: "mood", label: `Mood: ${advancedTrackSearch.mood.trim()}` } : null,
    advancedTrackSearch.extension?.trim() ? { key: "extension", label: `Type: ${advancedTrackSearch.extension.trim()}` } : null,
    advancedTrackSearch.path?.trim() ? { key: "path", label: `Path: ${advancedTrackSearch.path.trim()}` } : null,
    advancedTrackSearch.rating_state && advancedTrackSearch.rating_state !== "any" ? { key: "rating_state", label: advancedTrackSearch.rating_state === "rated" ? "Rated" : "Unrated" } : null,
    advancedTrackSearch.min_rating?.trim() ? { key: "min_rating", label: `Min ${advancedTrackSearch.min_rating.trim()} stars` } : null,
    advancedTrackSearch.max_rating?.trim() ? { key: "max_rating", label: `Max ${advancedTrackSearch.max_rating.trim()} stars` } : null,
    advancedTrackSearch.year_from?.trim() ? { key: "year_from", label: `From ${advancedTrackSearch.year_from.trim()}` } : null,
    advancedTrackSearch.year_to?.trim() ? { key: "year_to", label: `To ${advancedTrackSearch.year_to.trim()}` } : null,
    advancedTrackSearch.min_duration?.trim() ? { key: "min_duration", label: `Min ${advancedTrackSearch.min_duration.trim()}s` } : null,
    advancedTrackSearch.max_duration?.trim() ? { key: "max_duration", label: `Max ${advancedTrackSearch.max_duration.trim()}s` } : null,
    advancedTrackSearch.missing_metadata ? { key: "missing_metadata", label: "Missing metadata" } : null,
  ].filter(Boolean) as Array<{ key: keyof AdvancedTrackSearchFilters; label: string }>;
  function clearAdvancedSearchChip(key: keyof AdvancedTrackSearchFilters) {
    if (key === "rating_state") {
      updateAdvancedTrackSearch(key, "any");
    } else if (key === "missing_metadata") {
      updateAdvancedTrackSearch(key, false);
    } else {
      updateAdvancedTrackSearch(key, "");
    }
  }

  function previewTrackInDetails(track: any) {
    setDetailTrack(track);
    (model.selectAndScrollToTrack ?? selectSingleTrack)(track);
  }

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
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
              <label className="grid gap-1 text-xs uppercase text-muted">Artist<input className={advancedSearchInputClass} value={advancedTrackSearch.artist ?? ""} placeholder="Artist or album artist" onChange={(event) => updateAdvancedTrackSearch("artist", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Album<input className={advancedSearchInputClass} value={advancedTrackSearch.album ?? ""} placeholder="Album title" onChange={(event) => updateAdvancedTrackSearch("album", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Genre<input className={advancedSearchInputClass} value={advancedTrackSearch.genre ?? ""} placeholder="Tag or CLAP genre" onChange={(event) => updateAdvancedTrackSearch("genre", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Mood<input className={advancedSearchInputClass} value={advancedTrackSearch.mood ?? ""} placeholder="happy, sad, energetic" onChange={(event) => updateAdvancedTrackSearch("mood", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">File Type<input className={advancedSearchInputClass} value={advancedTrackSearch.extension ?? ""} placeholder="flac, mp3, opus" onChange={(event) => updateAdvancedTrackSearch("extension", event.target.value)} /></label>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
              <label className="grid gap-1 text-xs uppercase text-muted">Rating<select className={advancedSearchInputClass} value={advancedTrackSearch.rating_state ?? "any"} onChange={(event) => updateAdvancedTrackSearch("rating_state", event.target.value as AdvancedTrackSearchFilters["rating_state"])}><option value="any">Any</option><option value="rated">Rated only</option><option value="unrated">Unrated only</option></select></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Min Stars<input className={advancedSearchInputClass} inputMode="decimal" value={advancedTrackSearch.min_rating ?? ""} placeholder="0.5-5" onChange={(event) => updateAdvancedTrackSearch("min_rating", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Max Stars<input className={advancedSearchInputClass} inputMode="decimal" value={advancedTrackSearch.max_rating ?? ""} placeholder="0.5-5" onChange={(event) => updateAdvancedTrackSearch("max_rating", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">From Year<input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.year_from ?? ""} placeholder="1995" onChange={(event) => updateAdvancedTrackSearch("year_from", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">To Year<input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.year_to ?? ""} placeholder="2026" onChange={(event) => updateAdvancedTrackSearch("year_to", event.target.value)} /></label>
              <label className="flex h-9 items-center justify-between gap-3 self-end rounded border border-line bg-panel px-3 text-xs uppercase text-muted">Missing Metadata<input type="checkbox" className="h-4 w-4 accent-moss" checked={Boolean(advancedTrackSearch.missing_metadata)} onChange={(event) => updateAdvancedTrackSearch("missing_metadata", event.target.checked)} /></label>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_repeat(2,minmax(8rem,12rem))]">
              <label className="grid gap-1 text-xs uppercase text-muted">File Path Contains<input className={advancedSearchInputClass} value={advancedTrackSearch.path ?? ""} placeholder="folder, drive, edition, etc." onChange={(event) => updateAdvancedTrackSearch("path", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Min Seconds<input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.min_duration ?? ""} placeholder="120" onChange={(event) => updateAdvancedTrackSearch("min_duration", event.target.value)} /></label>
              <label className="grid gap-1 text-xs uppercase text-muted">Max Seconds<input className={advancedSearchInputClass} inputMode="numeric" value={advancedTrackSearch.max_duration ?? ""} placeholder="480" onChange={(event) => updateAdvancedTrackSearch("max_duration", event.target.value)} /></label>
            </div>
            {advancedSearchChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {advancedSearchChips.map((chip) => (
                  <button
                    key={chip.key}
                    className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-moss/40 bg-moss/10 px-2.5 text-xs text-neutral-100 hover:bg-moss/20"
                    type="button"
                    title={`Remove ${chip.label}`}
                    onClick={() => clearAdvancedSearchChip(chip.key)}
                  >
                    <span className="truncate">{chip.label}</span>
                    <X size={12} />
                  </button>
                ))}
              </div>
            )}
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
          <button className="primary-button h-9 w-9 shrink-0 justify-center px-0" type="button" title="AutoDJ from current track" aria-label="AutoDJ from current track" onClick={() => onQuickAutoDj(currentTrack)}><RadioTower size={17} /></button>
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
        <TrackDetailsPanel track={detailTrack} queue={viewTracks} playlists={playlists} isAudioAnalyzing={isAudioAnalyzing} onClose={() => setDetailTrack(null)} onSelectTrack={model.selectAndScrollToTrack ?? selectSingleTrack} onPreviewTrack={previewTrackInDetails} isTrackSelected={detailTrack ? selectedTrackIds.has(detailTrack.id) : false} onPlayTrack={onPlayTrack} onRating={onRating} displayRatingsAsNumbers={displayRatingsAsNumbers} onAnalyzeTracks={onAnalyzeTracks} onAddTracksToPlaylist={onAddTracksToPlaylist} onDeleteTrack={onDeleteTrack} onEditTrack={onEditTrack} onRevealTrack={onRevealTrack} onSearchAnalysisTag={searchByAnalysisTag} />
        {bulkMetadataOpen && <BulkMetadataModal tracks={selectedTracks} writeToFiles={writeRatingsToFiles} onClose={() => setBulkMetadataOpen(false)} onSave={async (metadata: any) => { await onBulkMetadata(selectedIds, metadata); setBulkMetadataOpen(false); clearSelection(); }} />}
      </div>
      <LibraryFloatingMenus model={model} />
    </main>
  );
}
