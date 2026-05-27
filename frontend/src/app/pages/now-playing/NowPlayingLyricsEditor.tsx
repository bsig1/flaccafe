import {
  ArrowDown,
  ArrowUp,
  Clock,
  GripVertical,
  ListMusic,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type LrcBuilderLine,
  formatLrcTimestamp,
} from "./lyricsBuilder";

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
  const activeTimedLineRef = useRef<HTMLDivElement | null>(null);
  const builderListRef = useRef<HTMLDivElement | null>(null);
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
  }

  function selectRelativeBuilderLine(direction: -1 | 1) {
    if (lrcBuilderLines.length === 0) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(activeBuilderLineIndex + direction, lrcBuilderLines.length - 1));
    setActiveBuilderLineIndex(nextIndex);
  }

  useEffect(() => {
    if (lyricsEditMode !== "sync") {
      return;
    }
    function handleBuilderKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, button, [contenteditable='true']") ||
        event.key !== "Enter" ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      event.preventDefault();
      syncBuilderLine();
    }

    window.addEventListener("keydown", handleBuilderKeyDown);
    return () => window.removeEventListener("keydown", handleBuilderKeyDown);
  }, [lyricsEditMode, syncBuilderLine]);

  useEffect(() => {
    if (lyricsEditMode !== "sync" || !hasTimedLines || activeTimedLineIndex < 0 || draggedLineIndex !== null) {
      return;
    }
    activeTimedLineRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeTimedLineIndex, draggedLineIndex, hasTimedLines, lyricsEditMode]);

  useEffect(() => {
    if (lyricsEditMode !== "sync" || draggedLineIndex !== null) {
      return;
    }
    builderListRef.current
      ?.querySelector(`[data-lrc-line-index="${activeBuilderLineIndex}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeBuilderLineIndex, draggedLineIndex, lyricsEditMode]);

  return (
      <div className={`${containerClass} grid h-full ${editorRowsClass} gap-3`}>
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
            className="min-h-0 resize-none rounded border border-line bg-ink p-4 font-mono text-sm leading-6 text-neutral-100 outline-none ring-moss/40 focus:ring-2"
            value={lyricsDraft}
            placeholder="Paste lyrics here, or fetch them first."
            onChange={(event) => setLyricsDraft(event.target.value)}
          />
        ) : (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded border border-line bg-ink p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
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
                <button className="secondary-button h-8" type="button" onClick={addBuilderLine}>
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
                    ref={playbackActive ? activeTimedLineRef : undefined}
                    className={`grid grid-cols-[1.75rem_6.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 border-b border-line/60 px-2 py-2 text-sm last:border-b-0 ${
                      playbackActive
                        ? "bg-moss/15"
                        : selected
                          ? "bg-moss/10"
                          : dragOver
                            ? "bg-ember/10"
                            : "bg-panel/40"
                    } ${dragActive ? "opacity-60" : ""} ${selected ? "ring-1 ring-inset ring-moss/35" : ""}`}
                    onClick={() => setActiveBuilderLineIndex(index)}
                    onDragOver={(event) => {
                      if (draggedLineIndex === null) {
                        return;
                      }
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOverLineIndex(index);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceIndex = draggedLineIndex ?? Number(event.dataTransfer.getData("text/plain"));
                      clearLineDrag();
                      if (Number.isFinite(sourceIndex)) {
                        reorderBuilderLine(sourceIndex, index);
                      }
                    }}
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
                        className="grid h-7 w-7 cursor-grab place-items-center rounded text-muted hover:bg-white/10 hover:text-white active:cursor-grabbing"
                        draggable
                        type="button"
                        title="Drag to reorder"
                        onDragStart={(event) => {
                          setDraggedLineIndex(index);
                          setDragOverLineIndex(index);
                          setActiveBuilderLineIndex(index);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", String(index));
                        }}
                        onDragEnd={clearLineDrag}
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
                    <input
                      className="min-w-0 rounded border border-line bg-ink px-3 py-1.5 text-neutral-100 outline-none ring-moss/40 focus:ring-2"
                      value={line.gap ? "" : line.text}
                      placeholder="Lyric line"
                      onFocus={() => setActiveBuilderLineIndex(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                          event.preventDefault();
                          handleLineEnter(index);
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
