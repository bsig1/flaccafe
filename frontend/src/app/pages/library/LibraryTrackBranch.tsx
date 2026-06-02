export function LibraryTrackBranch({ model }: { model: any }) {
  const { FolderOpen, Search, SlidersHorizontal, X, librarySelectionColumnWidth, tracks, totalTracks, libraryView, setLibraryView, search, setSearch, loadMoreTracks, isLoading, hasMoreTracks, isScanning, suggestedMusicPath, onChooseMusicFolder, onUseSuggestedFolder, columnWidths, fixedTrackColumns, advancedSearchActiveCount, trackSearchActive, libraryHasAnyTracks, tableWidth, shouldVirtualizeTrackRows, renderedTrackList, virtualTopSpacerHeight, virtualBottomSpacerHeight, renderTableHeader, renderVirtualTrackRows, renderTrackRows, clearAdvancedTrackSearch } = model;
  const trackTableColumnCount = fixedTrackColumns.length + 1;
  return (
    <>
              {libraryView === "tracks" && (
                <>
                  <table className="library-track-table w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
                    <colgroup>
                      <col style={{ width: librarySelectionColumnWidth }} />
                      {fixedTrackColumns.map((columnKey: any) => (
                        <col key={columnKey} style={{ width: columnWidths[columnKey] }} />
                      ))}
                    </colgroup>
                    <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
                      {renderTableHeader(true)}
                    </thead>
                    <tbody>
                      {virtualTopSpacerHeight > 0 && (
                        <tr aria-hidden="true">
                          <td colSpan={trackTableColumnCount} style={{ height: virtualTopSpacerHeight, padding: 0, border: 0 }} />
                        </tr>
                      )}
                      {shouldVirtualizeTrackRows ? renderVirtualTrackRows() : renderTrackRows(renderedTrackList, { interactionList: tracks })}
                      {virtualBottomSpacerHeight > 0 && (
                        <tr aria-hidden="true">
                          <td colSpan={trackTableColumnCount} style={{ height: virtualBottomSpacerHeight, padding: 0, border: 0 }} />
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
