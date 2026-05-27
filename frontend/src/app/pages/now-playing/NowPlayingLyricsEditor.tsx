import {
  Clock,
  GripVertical,
  ListMusic,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  useEffect,
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
    lyricsSaveDisabled,
    handleSaveLyrics,
  } = model;
  const [draggedLineIndex, setDraggedLineIndex] = useState<number | null>(null);
  const [dragOverLineIndex, setDragOverLineIndex] = useState<number | null>(null);
  const activeTimedLineIndex = lrcBuilderLines.reduce((activeIndex: number, line: LrcBuilderLine, index: number) => {
    return line.time !== null && line.time <= playbackTime + 0.05 ? index : activeIndex;
  }, -1);

  function handleLineEnter(index: number) {
    syncBuilderLine(index);
  }

  function clearLineDrag() {
    setDraggedLineIndex(null);
    setDragOverLineIndex(null);
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

  return (
      <div className={`${containerClass} grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3`}>
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
            <div className="min-h-0 overflow-auto rounded border border-line/70">
              {lrcBuilderLines.map((line: LrcBuilderLine, index: number) => {
                const selected = index === activeBuilderLineIndex;
                const playbackActive = line.time !== null && index === activeTimedLineIndex;
                const dragActive = draggedLineIndex === index;
                const dragOver = dragOverLineIndex === index && draggedLineIndex !== index;
                return (
                  <div
                    key={line.id}
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
  );
}
