import {
ArrowDown,
ArrowUp,
Clock,
GripVertical,
ListMusic,
Pencil,
Play,
Plus,
X,
} from "lucide-react";
import {
type PointerEvent as ReactPointerEvent,
useEffect,
useRef,
useState,
} from "react";
import {
sendMiniPlayerCommand,
} from "../../shared";
import {
type LrcBuilderLine,
formatLrcTimestamp,
} from "./lyricsBuilder";

const LRC_BUILDER_SEEK_SECONDS = 5;

export function NowPlayingLyricsEditor({
  model,
  containerClass,
}: {
  model: any;
  containerClass: string;
}) {
  const {
    lyricsSynced,
    setLyricsSynced,
    lyricsTarget,
    setLyricsTarget,
    lyricsEditMode,
    setLyricsEditMode,
    openLrcBuilder,
    followLyrics,
    playbackTime,
    lyricsDraft,
    setLyricsDraft,
    lrcBuilderLines,
    activeBuilderLineIndex,
    setActiveBuilderLineIndex,
    syncBuilderLine,
    addBuilderLine,
    updateBuilderLine,
    removeBuilderLine,
    reorderBuilderLine,
    lyricsBusy,
    lyricsSaveDisabled,
    handleCancelLyrics,
    handleSaveLyrics,
  } = model;
  const [draggedLineIndex, setDraggedLineIndex] = useState<number | null>(null);
  const [dragOverLineIndex, setDragOverLineIndex] = useState<number | null>(null);
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const builderListRef = useRef<HTMLDivElement | null>(null);
  const dragSourceLineIndexRef = useRef<number | null>(null);
  const dragTargetLineIndexRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const activeTimedLineIndex = lrcBuilderLines.reduce((activeIndex: number, line: LrcBuilderLine, index: number) => {
    return line.time !== null && line.time <= playbackTime + 0.05 ? index : activeIndex;
  }, -1);
  const hasTimedLines = lrcBuilderLines.some((line: LrcBuilderLine) => line.time !== null);
  const activeTimedLine = activeTimedLineIndex >= 0 ? lrcBuilderLines[activeTimedLineIndex] : null;
  const currentLyricText =
    activeTimedLine && !activeTimedLine.gap && activeTimedLine.text.trim()
      ? activeTimedLine.text.trim()
      : activeTimedLine
        ? "Blank line"
        : "Before first timestamp";
  const editorRowsClass =
    lyricsEditMode === "sync" && hasTimedLines
      ? "grid-rows-[auto_auto_auto_minmax(0,1fr)_auto]"
      : "grid-rows-[auto_auto_minmax(0,1fr)_auto]";

  function handleLineEnter(index: number) {
    syncBuilderLine(index);
  }

  function clearLineDrag() {
    setDraggedLineIndex(null);
    setDragOverLineIndex(null);
    dragSourceLineIndexRef.current = null;
    dragTargetLineIndexRef.current = null;
  }

  function selectRelativeBuilderLine(direction: -1 | 1) {
    if (lrcBuilderLines.length === 0) {
      return;
    }
    setActiveBuilderLineIndex((current: number) => Math.max(0, Math.min(current + direction, lrcBuilderLines.length - 1)));
  }

  function scrollBuilderLineIntoView(index: number) {
    const list = builderListRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-lrc-line-index="${index}"]`);
    if (!list || !item) {
      return;
    }
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const visibleTop = list.scrollTop;
    const visibleBottom = visibleTop + list.clientHeight;
    if (itemTop < visibleTop) {
      list.scrollTop = itemTop;
    } else if (itemBottom > visibleBottom) {
      list.scrollTop = itemBottom - list.clientHeight;
    }
  }

  function lineIndexFromPointer(clientY: number) {
    const list = builderListRef.current;
    if (!list) {
      return null;
    }
    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-lrc-line-index]"));
    if (rows.length === 0) {
      return null;
    }
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return Number(row.dataset.lrcLineIndex);
      }
    }
    const firstRow = rows[0];
    const lastRow = rows[rows.length - 1];
    if (clientY < firstRow.getBoundingClientRect().top) {
      return Number(firstRow.dataset.lrcLineIndex);
    }
    if (clientY > lastRow.getBoundingClientRect().bottom) {
      return Number(lastRow.dataset.lrcLineIndex);
    }
    return null;
  }

  function autoScrollBuilderList(clientY: number) {
    const list = builderListRef.current;
    if (!list) {
      return;
    }
    const rect = list.getBoundingClientRect();
    const edgeSize = 36;
    if (clientY < rect.top + edgeSize) {
      list.scrollTop -= 14;
    } else if (clientY > rect.bottom - edgeSize) {
      list.scrollTop += 14;
    }
  }

  function clearPointerDragListeners() {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
  }

  function beginLineDrag(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    clearPointerDragListeners();
    dragSourceLineIndexRef.current = index;
    dragTargetLineIndexRef.current = index;
    setDraggedLineIndex(index);
    setDragOverLineIndex(index);
    setActiveBuilderLineIndex(index);

    function handlePointerMove(moveEvent: PointerEvent) {
      moveEvent.preventDefault();
      autoScrollBuilderList(moveEvent.clientY);
      const targetIndex = lineIndexFromPointer(moveEvent.clientY);
      if (targetIndex === null || !Number.isFinite(targetIndex)) {
        return;
      }
      dragTargetLineIndexRef.current = targetIndex;
      setDragOverLineIndex(targetIndex);
    }

    function finishPointerDrag() {
      const sourceIndex = dragSourceLineIndexRef.current;
      const targetIndex = dragTargetLineIndexRef.current;
      clearPointerDragListeners();
      clearLineDrag();
      if (
        sourceIndex !== null &&
        targetIndex !== null &&
        Number.isFinite(sourceIndex) &&
        Number.isFinite(targetIndex)
      ) {
        reorderBuilderLine(sourceIndex, targetIndex);
      }
    }

    function cancelPointerDrag() {
      clearPointerDragListeners();
      clearLineDrag();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishPointerDrag, { once: true });
    window.addEventListener("pointercancel", cancelPointerDrag, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointerDrag);
      window.removeEventListener("pointercancel", cancelPointerDrag);
    };
  }

  function stopBuilderKeyboardEvent(event: KeyboardEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function isBuilderKeyboardKey(event: KeyboardEvent) {
    const plainKey = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    const ctrlN = event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === "n";
    return (
      ctrlN ||
      (
        plainKey &&
        (
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "Enter" ||
          event.key === " " ||
          event.code === "Space"
        )
      )
    );
  }

  useEffect(() => {
    if (lyricsEditMode !== "sync") {
      return;
    }
    const activeElement = document.activeElement;
    if (!activeElement || !editorRootRef.current?.contains(activeElement)) {
      editorRootRef.current?.focus({ preventScroll: true });
    }
  }, [lyricsEditMode]);

  useEffect(() => {
    return clearPointerDragListeners;
  }, []);

  useEffect(() => {
    if (lyricsEditMode !== "sync") {
      return;
    }
    function handleBuilderKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === "n") {
        stopBuilderKeyboardEvent(event);
        if (event.repeat) {
          return;
        }
        addBuilderLine();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectRelativeBuilderLine(-1);
      } else if (event.key === "ArrowDown") {
        stopBuilderKeyboardEvent(event);
        selectRelativeBuilderLine(1);
      } else if (event.key === "Enter") {
        stopBuilderKeyboardEvent(event);
        if (event.repeat) {
          return;
        }
        syncBuilderLine();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        stopBuilderKeyboardEvent(event);
        sendMiniPlayerCommand({
          type: "seek",
          seconds: Math.max(
            0,
            playbackTime + (event.key === "ArrowRight" ? LRC_BUILDER_SEEK_SECONDS : -LRC_BUILDER_SEEK_SECONDS),
          ),
        });
      } else if (event.key === " " || event.code === "Space") {
        stopBuilderKeyboardEvent(event);
        if (event.repeat) {
          return;
        }
        sendMiniPlayerCommand({ type: "playPause" });
      }
    }
    function handleBuilderKeyUp(event: KeyboardEvent) {
      if (isBuilderKeyboardKey(event)) {
        stopBuilderKeyboardEvent(event);
      }
    }

    window.addEventListener("keydown", handleBuilderKeyDown, true);
    window.addEventListener("keyup", handleBuilderKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleBuilderKeyDown, true);
      window.removeEventListener("keyup", handleBuilderKeyUp, true);
    };
  }, [addBuilderLine, lrcBuilderLines.length, lyricsEditMode, playbackTime, syncBuilderLine]);

  useEffect(() => {
    if (lyricsEditMode !== "sync" || draggedLineIndex !== null) {
      return;
    }
    scrollBuilderLineIntoView(activeBuilderLineIndex);
  }, [activeBuilderLineIndex, draggedLineIndex, lyricsEditMode]);

  useEffect(() => {
    if (
      lyricsEditMode !== "sync" ||
      !followLyrics ||
      !hasTimedLines ||
      activeTimedLineIndex < 0 ||
      draggedLineIndex !== null
    ) {
      return;
    }
    scrollBuilderLineIntoView(activeTimedLineIndex);
  }, [activeTimedLineIndex, draggedLineIndex, followLyrics, hasTimedLines, lyricsEditMode]);

  return (
      <div
        ref={editorRootRef}
        className={`${containerClass} grid h-full min-h-[24rem] w-full ${editorRowsClass} gap-3 outline-none`}
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={lyricsSynced}
                onChange={(event) => setLyricsSynced(event.target.checked)}
              />
              Synced LRC
            </label>
            <label className="flex items-center gap-2 text-muted">
              Save to
              <select
                className="h-8 rounded border border-line bg-panel px-2 text-white outline-none"
                value={lyricsTarget}
                onChange={(event) => setLyricsTarget(event.target.value as "database" | "file")}
              >
                <option value="database">Database</option>
                <option value="file">Audio file + database</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex rounded border border-line/70 bg-ink p-1">
            <button
              className={`secondary-button h-8 border-0 px-3 ${lyricsEditMode === "text" ? "bg-panel text-white" : "bg-transparent text-muted"}`}
              type="button"
              onClick={() => setLyricsEditMode("text")}
            >
              <Pencil size={14} />
              Text
            </button>
            <button
              className={`secondary-button h-8 border-0 px-3 ${lyricsEditMode === "sync" ? "bg-panel text-white" : "bg-transparent text-muted"}`}
              type="button"
              onClick={openLrcBuilder}
            >
              <ListMusic size={14} />
              LRC Builder
            </button>
          </div>
          {lyricsEditMode === "sync" && (
            <div className="rounded border border-line/70 bg-ink px-3 py-2 font-mono text-muted">
              [{formatLrcTimestamp(playbackTime)}]
            </div>
          )}
        </div>

        {lyricsEditMode === "sync" && hasTimedLines && (
          <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded border border-moss/40 bg-moss/10 px-3 py-2 text-sm">
            <span className="text-xs uppercase text-muted">Current</span>
            <span className="font-mono text-xs tabular-nums text-moss">
              {activeTimedLine?.time !== null && activeTimedLine?.time !== undefined
                ? `[${formatLrcTimestamp(activeTimedLine.time)}]`
                : `[${formatLrcTimestamp(playbackTime)}]`}
            </span>
            <span className="min-w-0 truncate text-neutral-100">{currentLyricText}</span>
          </div>
        )}

        {lyricsEditMode === "text" ? (
          <textarea
            className="min-h-[18rem] w-full resize-none rounded border border-line bg-ink p-4 font-mono text-sm leading-6 text-neutral-100 outline-none ring-moss/40 focus:ring-2"
            value={lyricsDraft}
            placeholder="Paste lyrics here, or fetch them first."
            onChange={(event) => setLyricsDraft(event.target.value)}
          />
        ) : (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded border border-line bg-ink p-3">
            <div className="sticky -top-6 z-20 -mx-3 -mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-line/70 bg-ink/95 px-3 py-3 text-xs backdrop-blur">
              <div className="min-w-0 text-muted">
                {lrcBuilderLines.length.toLocaleString()} lines
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded border border-line/70 bg-panel/60 p-0.5">
                  <button
                    className="icon-button h-7 w-7"
                    type="button"
                    title="Previous lyric line"
                    disabled={activeBuilderLineIndex <= 0}
                    onClick={() => selectRelativeBuilderLine(-1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="icon-button h-7 w-7"
                    type="button"
                    title="Next lyric line"
                    disabled={activeBuilderLineIndex >= lrcBuilderLines.length - 1}
                    onClick={() => selectRelativeBuilderLine(1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                <button className="secondary-button h-8" type="button" onClick={() => syncBuilderLine()}>
                  <Clock size={14} />
                  Sync
                </button>
                <button className="secondary-button h-8" type="button" title="Add lyric line (Ctrl+N)" onClick={addBuilderLine}>
                  <Plus size={14} />
                  Line
                </button>
              </div>
            </div>
            <div ref={builderListRef} className="min-h-0 overflow-auto rounded border border-line/70">
              {lrcBuilderLines.map((line: LrcBuilderLine, index: number) => {
                const selected = index === activeBuilderLineIndex;
                const playbackActive = line.time !== null && index === activeTimedLineIndex;
                const dragActive = draggedLineIndex === index;
                const dragOver = dragOverLineIndex === index && draggedLineIndex !== index;
                return (
                  <div
                    key={line.id}
                    data-lrc-line-index={index}
                    className={`grid grid-cols-[1.75rem_6.25rem_2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 border-b border-line/60 px-2 py-2 text-sm last:border-b-0 ${
                      playbackActive
                        ? "bg-moss/15"
                        : selected
                          ? "bg-moss/10"
                          : dragOver
                            ? "bg-ember/10"
                            : "bg-panel/40"
                    } ${dragActive ? "opacity-60" : ""} ${selected ? "ring-1 ring-inset ring-moss/35" : ""}`}
                    onClick={() => setActiveBuilderLineIndex(index)}
                  >
                    <div className="relative grid h-8 w-7 place-items-center">
                      {playbackActive && (
                        <span
                          aria-label="Current timestamped line"
                          className="absolute -left-1 h-2 w-2 rounded-full bg-moss shadow-[0_0_10px_rgb(var(--color-moss)/0.8)]"
                          title="Current timestamped line"
                        />
                      )}
                      <button
                        className="grid h-7 w-7 cursor-grab touch-none select-none place-items-center rounded text-muted hover:bg-white/10 hover:text-white active:cursor-grabbing"
                        type="button"
                        title="Drag to reorder"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => beginLineDrag(index, event)}
                      >
                        <GripVertical size={14} />
                      </button>
                    </div>
                    <button
                      className={`h-8 rounded border px-2 font-mono text-xs tabular-nums ${
                        line.time === null ? "border-line text-muted" : "border-moss/50 text-moss"
                      }`}
                      type="button"
                      title="Stamp this line with the current playback time"
                      onClick={(event) => {
                        event.stopPropagation();
                        syncBuilderLine(index);
                      }}
                    >
                      {line.time === null ? "--:--.--" : `[${formatLrcTimestamp(line.time)}]`}
                    </button>
                    <button
                      className="icon-button h-8 w-8"
                      type="button"
                      disabled={line.time === null}
                      title={line.time === null ? "Add a timestamp before seeking to this line" : "Move playback to this line"}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (line.time === null) {
                          return;
                        }
                        setActiveBuilderLineIndex(index);
                        sendMiniPlayerCommand({ type: "seek", seconds: line.time });
                      }}
                    >
                      <Play size={14} />
                    </button>
                    <input
                      className="min-w-0 rounded border border-line bg-ink px-3 py-1.5 text-neutral-100 outline-none ring-moss/40 focus:ring-2"
                      value={line.gap ? "" : line.text}
                      placeholder="Lyric line"
                      onFocus={() => setActiveBuilderLineIndex(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                          event.preventDefault();
                          event.stopPropagation();
                          handleLineEnter(index);
                        }
                      }}
                      onKeyUp={(event) => {
                        if (event.key === "Enter" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                      onChange={(event) => updateBuilderLine(index, { text: event.target.value, gap: false })}
                    />
                    <button
                      className="icon-button h-8 w-8"
                      type="button"
                      title="Remove line"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeBuilderLine(index);
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted">
            {lyricsTarget === "file"
              ? "Saving will update the file tags and keep a database copy."
              : "Saving will keep lyrics in the FLAC Cafe database only."}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              className="secondary-button"
              type="button"
              disabled={lyricsBusy}
              onClick={handleCancelLyrics}
            >
              <X size={15} />
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={lyricsSaveDisabled}
              title="Save lyrics (Ctrl+S)"
              onClick={() => void handleSaveLyrics()}
            >
              <Pencil size={15} />
              Save Lyrics
            </button>
          </div>
        </div>
      </div>
  );
}
