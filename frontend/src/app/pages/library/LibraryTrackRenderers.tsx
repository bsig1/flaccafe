export function createLibraryTrackRenderers(model: any) {
  const { Play, Volume2, RatingStars, ResizableHeader, display, fileName, formatBitrate, formatDuration, formatFingerprint, formatPercent, formatShortDate, trackGenre, tracks, trackIndexCache, libraryView, sort, onRating, onPlayTrack, detailTrack, currentTrackId, hideFilePaths, displayRatingsAsNumbers, columnWidths, selectedTrackIds, isSelectingAllTracks, draggedColumn, dragOverColumn, visibleColumns, visibleColumnDefs, fixedTrackColumns, rowPadding, trackRowHeight, virtualTrackStartIndex, virtualTrackEndIndex, selectableTrackCount, allViewSelected, handleSort, handleResize, selectTrackLikeWindows, handleHeaderSelectionChange, suppressCheckboxContextMenu, clearSelection, openTrackContextMenu, openColumnContextMenu, handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, handleColumnPointerDragStart } = model;
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
      case "analysis_mood":
        return display(track.analysis_mood, "-");
      case "analysis_mood_confidence":
        return track.analysis_mood_confidence !== null && track.analysis_mood_confidence !== undefined
          ? formatPercent(track.analysis_mood_confidence * 100)
          : "-";
      case "analysis_provider":
        return display(track.analysis_provider, "-");
      case "analysis_updated_at":
        return formatShortDate(track.analysis_updated_at);
      case "year":
        return display(track.year, "-");
      case "rating":
        return <RatingStars rating={track.rating} displayAsNumber={displayRatingsAsNumbers} onChange={(rating: any) => onRating(track.id, rating)} />;
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

  function metadataColumnForKey(columnKey: string) {
    return visibleColumnDefs.find((column: any) => column.key === columnKey) ?? null;
  }

  function renderPlayButtonCell(track: any, interactionList: any[]) {
    return (
      <td key="play" className={rowPadding}>
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
    );
  }

  function renderTrackDataCell(track: any, interactionList: any[], columnKey: string) {
    if (columnKey === "play") {
      return renderPlayButtonCell(track, interactionList);
    }
    const column = metadataColumnForKey(columnKey);
    if (!column) {
      return null;
    }
    return (
      <td key={column.key} className={`${rowPadding} ${columnTextClass(column)}`} title={column.key === "path" ? track.path : undefined}>
        {renderMetadataCell(track, column)}
      </td>
    );
  }

  function renderPlaceholderDataCell(columnKey: string, columnIndex: number) {
    if (columnKey === "play") {
      return (
        <td key="play" className={rowPadding}>
          <div className="mx-auto h-8 w-8 rounded border border-line/70 bg-white/[0.025]" />
        </td>
      );
    }
    const column = metadataColumnForKey(columnKey);
    if (!column) {
      return null;
    }
    return (
      <td key={column.key} className={rowPadding}>
        <div
          className="h-3 rounded bg-white/[0.045]"
          style={{ width: columnIndex === 0 ? "72%" : column.align === "right" ? "44%" : "56%" }}
        />
      </td>
    );
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
        {fixedTrackColumns.map((columnKey: any) => {
          if (columnKey === "play") {
            return (
              <ResizableHeader
                key="play"
                label=""
                column="play"
                width={columnWidths.play}
                sort={sort}
                onSort={handleSort}
                onResize={handleResize}
              />
            );
          }
          const column = metadataColumnForKey(columnKey);
          if (!column) {
            return null;
          }
          return (
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
          );
        })}
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
        data-track-id={track.id}
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
        {fixedTrackColumns.map((columnKey: any) => renderTrackDataCell(track, interactionList, columnKey))}
      </tr>
    );
  }

  function renderTrackPlaceholderRow(index: number) {
    return (
      <tr key={`track-placeholder-${index}`} aria-hidden="true" style={{ height: trackRowHeight }} className="border-b border-line/40">
        <td className={rowPadding}>
          <div className="h-4 w-4 rounded border border-line/70 bg-white/[0.025]" />
        </td>
        {fixedTrackColumns.map((columnKey: any, columnIndex: number) => renderPlaceholderDataCell(columnKey, columnIndex))}
      </tr>
    );
  }

  function renderVirtualTrackRows() {
    const rows = [];
    for (let index = virtualTrackStartIndex; index < virtualTrackEndIndex; index += 1) {
      const track = trackIndexCache.get(index);
      rows.push(track ? renderTrackRow(track, tracks, false) : renderTrackPlaceholderRow(index));
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
