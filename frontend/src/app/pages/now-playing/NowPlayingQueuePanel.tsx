import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import type {
  Track,
} from "../../../types/api";
import {
  display,
} from "../../shared";

export function NowPlayingQueuePanel({ model }: { model: any }) {
  const {
    isQueueLayout,
    showLyrics,
    queue,
    queueScrollRef,
    handleQueueScroll,
    queueTopSpacerHeight,
    renderedQueue,
    queueStartIndex,
    currentTrack,
    dragIndex,
    dragOverIndex,
    queueRowHeight,
    beginNowPlayingQueueDrag,
    onPlayTrack,
    onMoveQueueTrack,
    onRemoveQueueTrack,
    queueBottomSpacerHeight,
    queueContextMenu,
    setQueueContextMenu,
    onSaveQueue,
    canRestoreQueue,
    onRestoreQueue,
    onClearQueue,
    openQueueContextMenu,
  } = model;

  return (
<section className={`${isQueueLayout ? "min-h-[420px] md:min-h-[min(48vh,560px)]" : "min-h-[320px]"} min-w-0 rounded border border-line bg-panel xl:min-h-0 ${
          isQueueLayout && showLyrics ? "md:col-start-2 xl:col-start-auto" : ""
        }`}>
          <div className="flex h-12 items-center justify-between border-b border-line px-4">
            <div>
              <div className="text-sm font-semibold text-white">Queue</div>
              <div className="text-xs text-muted">{queue.length} tracks</div>
            </div>
            <div className="flex items-center gap-1">
              <button className="icon-button h-8 w-8" type="button" title="Save queue as playlist" disabled={queue.length === 0} onClick={onSaveQueue}>
                <Plus size={14} />
              </button>
              <button className="icon-button h-8 w-8" type="button" title="Restore previous queue" disabled={!canRestoreQueue} onClick={onRestoreQueue}>
                <RefreshCw size={14} />
              </button>
              <button className="icon-button h-8 w-8" type="button" title="Clear queue" disabled={queue.length === 0} onClick={onClearQueue}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div ref={queueScrollRef} className="h-[calc(100%-3rem)] overflow-auto" onScroll={handleQueueScroll}>
            {queueTopSpacerHeight > 0 && <div aria-hidden="true" style={{ height: queueTopSpacerHeight }} />}
            {renderedQueue.map((track: Track, renderedIndex: number) => {
              const index = queueStartIndex + renderedIndex;
              const active = currentTrack?.id === track.id;
              return (
                <div
                  key={`${track.id}-${index}`}
                  data-reorder-index={index}
                  onContextMenu={(event) => openQueueContextMenu(event, index, track)}
                  className={`box-border flex w-full items-center gap-3 border-b border-line/60 text-left transition ${
                    isQueueLayout ? "px-4 py-3 text-sm" : "px-3 py-2 text-sm"
                  } ${
                    active
                      ? "bg-white/10"
                      : dragIndex === index
                        ? "bg-moss/10"
                        : dragOverIndex === index
                          ? "bg-ember/10"
                          : "hover:bg-white/[0.035]"
                  }`}
                  style={{ height: queueRowHeight }}
                >
                  <button
                    className="grid h-7 w-7 shrink-0 cursor-grab place-items-center rounded text-muted hover:bg-white/10 hover:text-white active:cursor-grabbing"
                    type="button"
                    title="Drag to reorder"
                    onPointerDown={(event) => beginNowPlayingQueueDrag(event, index, track)}
                  >
                    <GripVertical size={14} />
                  </button>
                  <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted">{index + 1}</span>
                  <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onPlayTrack(track, queue)}>
                    <span className="block truncate text-white">{display(track.title, "Untitled")}</span>
                    <span className="block truncate text-xs text-muted">{display(track.artist)}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 opacity-80">
                    <button
                      className="icon-button h-7 w-7"
                      type="button"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => onMoveQueueTrack(index, "up")}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      className="icon-button h-7 w-7"
                      type="button"
                      title="Move down"
                      disabled={index === queue.length - 1}
                      onClick={() => onMoveQueueTrack(index, "down")}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      className="icon-button h-7 w-7 text-ember"
                      type="button"
                      title="Remove from queue"
                      onClick={() => onRemoveQueueTrack(index)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
            {queueBottomSpacerHeight > 0 && <div aria-hidden="true" style={{ height: queueBottomSpacerHeight }} />}
            {queue.length === 0 && (
              <div className="grid h-full place-items-center px-4 text-center text-sm text-muted">
                Queue is empty.
              </div>
            )}
            {queueContextMenu && (
              <div
                className="fixed z-50 w-56 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
                style={{ left: queueContextMenu.x, top: queueContextMenu.y }}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
              >
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    onPlayTrack(queueContextMenu.track, queue);
                    setQueueContextMenu(null);
                  }}
                >
                  <Play size={15} />
                  Play
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted"
                  type="button"
                  disabled={queueContextMenu.index === 0}
                  onClick={() => {
                    onMoveQueueTrack(queueContextMenu.index, "up");
                    setQueueContextMenu(null);
                  }}
                >
                  <ArrowUp size={15} />
                  Move Up
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted"
                  type="button"
                  disabled={queueContextMenu.index === queue.length - 1}
                  onClick={() => {
                    onMoveQueueTrack(queueContextMenu.index, "down");
                    setQueueContextMenu(null);
                  }}
                >
                  <ArrowDown size={15} />
                  Move Down
                </button>
                <div className="my-1 border-t border-line" />
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10"
                  type="button"
                  onClick={() => {
                    onRemoveQueueTrack(queueContextMenu.index);
                    setQueueContextMenu(null);
                  }}
                >
                  <Trash2 size={15} />
                  Remove From Queue
                </button>
              </div>
            )}
          </div>
        </section>
  );
}
