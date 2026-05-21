import {
  ArrowDown,
  ArrowUp,
  Download,
  GripVertical,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useEffect,
  useState,
} from "react";

import {
  albumArtworkUrl,
} from "../../lib/api";
import {
  placeFloatingMenu,
} from "../../lib/uiInteractions";
import type {
  LyricsResponse,
  LyricsUpdateRequest,
  Track,
} from "../../types/api";
import {
  DragGhostPreview,
} from "../components/common";
import {
  DragGhost,
  MENU_VIEWPORT_MARGIN,
  PlaybackQueueContextMenu,
  beginPointerReorderDrag,
  display,
  parseLyricTimestamp,
  stripLyricTimestamp,
  trackGenre,
} from "../shared";

export function NowPlayingPage({
  currentTrack,
  lyrics,
  isLyricsLoading,
  playbackTime,
  queue,
  writeRatingsToFiles,
  onWriteRatingsToFilesChange,
  onFetchLyrics,
  onSaveLyrics,
  onPlayTrack,
  onMoveQueueTrack,
  onReorderQueueTrack,
  onRemoveQueueTrack,
  onClearQueue,
  onSaveQueue,
  onRestoreQueue,
  canRestoreQueue,
}: {
  currentTrack: Track | null;
  lyrics: LyricsResponse | null;
  isLyricsLoading: boolean;
  playbackTime: number;
  queue: Track[];
  writeRatingsToFiles: boolean;
  onWriteRatingsToFilesChange: (value: boolean) => void;
  onFetchLyrics: (trackId: number) => Promise<LyricsResponse>;
  onSaveLyrics: (trackId: number, requestBody: LyricsUpdateRequest) => Promise<LyricsResponse>;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onMoveQueueTrack: (index: number, direction: "up" | "down") => void;
  onReorderQueueTrack: (fromIndex: number, toIndex: number) => void;
  onRemoveQueueTrack: (index: number) => void;
  onClearQueue: () => void;
  onSaveQueue: () => void;
  onRestoreQueue: () => void;
  canRestoreQueue: boolean;
}) {
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [queueDragGhost, setQueueDragGhost] = useState<DragGhost | null>(null);
  const [queueContextMenu, setQueueContextMenu] = useState<PlaybackQueueContextMenu | null>(null);
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState("");
  const [lyricsTarget, setLyricsTarget] = useState<"database" | "file">("database");
  const [lyricsSynced, setLyricsSynced] = useState(false);
  const [lyricsBusy, setLyricsBusy] = useState(false);

  useEffect(() => {
    setArtworkFailed(false);
  }, [currentTrack?.id]);

  useEffect(() => {
    setLyricsDraft(lyrics?.lyrics ?? "");
    setLyricsSynced(Boolean(lyrics?.is_synced));
    setIsEditingLyrics(false);
    setLyricsTarget("database");
  }, [currentTrack?.id, lyrics?.lyrics, lyrics?.is_synced]);

  const artworkSrc = currentTrack && !artworkFailed ? albumArtworkUrl(currentTrack.id) : null;
  const lyricLines = lyrics?.lyrics?.split("\n") ?? [];
  const hasLyrics = lyricLines.some((line) => line.trim().length > 0);
  const timedLines = lyricLines.map((line, index) => ({ line, index, time: parseLyricTimestamp(line) }));
  const activeLyricIndex = timedLines.reduce((active, item) => {
    if (item.time !== null && item.time <= playbackTime) {
      return item.index;
    }
    return active;
  }, -1);

  useEffect(() => {
    function closeQueueContextMenu() {
      setQueueContextMenu(null);
    }

    window.addEventListener("click", closeQueueContextMenu);
    window.addEventListener("keydown", closeQueueContextMenu);
    return () => {
      window.removeEventListener("click", closeQueueContextMenu);
      window.removeEventListener("keydown", closeQueueContextMenu);
    };
  }, []);

  function openQueueContextMenu(event: ReactMouseEvent, index: number, track: Track) {
    event.preventDefault();
    event.stopPropagation();
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: 224,
      menuHeight: 180,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setQueueContextMenu({ x: placement.x, y: placement.y, index, track });
  }

  async function handleFetchLyrics() {
    if (!currentTrack) {
      return;
    }
    setLyricsBusy(true);
    try {
      const fetched = await onFetchLyrics(currentTrack.id);
      setLyricsDraft(fetched.lyrics ?? "");
      setLyricsSynced(fetched.is_synced);
      setIsEditingLyrics(true);
    } finally {
      setLyricsBusy(false);
    }
  }

  function beginNowPlayingQueueDrag(event: ReactPointerEvent<HTMLElement>, index: number, track: Track) {
    setDragIndex(index);
    setDragOverIndex(index);
    setQueueDragGhost({
      x: event.clientX,
      y: event.clientY,
      title: display(track.title, "Untitled"),
      subtitle: display(track.artist),
    });
    beginPointerReorderDrag({
      event,
      fromIndex: index,
      onHover: (nextIndex) => {
        setDragOverIndex(nextIndex);
        if (nextIndex === null) {
          setDragIndex(null);
        }
      },
      onPosition: (position) =>
        setQueueDragGhost((current) => (position && current ? { ...current, ...position } : null)),
      onCommit: onReorderQueueTrack,
    });
  }

  async function handleSaveLyrics() {
    if (!currentTrack) {
      return;
    }
    setLyricsBusy(true);
    try {
      await onSaveLyrics(currentTrack.id, {
        lyrics: lyricsDraft,
        is_synced: lyricsSynced,
        target: lyricsTarget,
        source: lyricsTarget === "database" ? "database:manual" : null,
      });
      setIsEditingLyrics(false);
    } finally {
      setLyricsBusy(false);
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <DragGhostPreview ghost={queueDragGhost} />
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Now Playing</h1>
          <p className="text-xs text-muted">
            {currentTrack ? `${display(currentTrack.artist)} - ${display(currentTrack.album, "Unknown album")}` : "Idle"}
          </p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr_300px] gap-6 overflow-hidden p-6">
        <section className="min-w-0">
          <div className="aspect-square overflow-hidden rounded border border-line bg-panel shadow-xl">
            {artworkSrc ? (
              <img
                key={artworkSrc}
                alt=""
                className="h-full w-full object-cover"
                src={artworkSrc}
                onError={() => setArtworkFailed(true)}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-moss">
                <Volume2 size={54} />
              </div>
            )}
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="truncate text-2xl font-semibold text-white">
              {currentTrack ? display(currentTrack.title, "Untitled") : "Nothing playing"}
            </h2>
            <div className="mt-2 truncate text-sm text-neutral-300">
              {currentTrack ? display(currentTrack.artist) : "Choose a track from Library or AutoDJ"}
            </div>
            <div className="mt-1 truncate text-sm text-muted">
              {currentTrack ? display(currentTrack.album, "Unknown album") : ""}
            </div>
          </div>

          {currentTrack && (
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-line bg-panel p-3">
                <div className="text-xs uppercase text-muted">Year</div>
                <div className="mt-1 text-white">{display(currentTrack.year, "-")}</div>
              </div>
              <div className="rounded border border-line bg-panel p-3">
                <div className="text-xs uppercase text-muted">Genre</div>
                <div className="mt-1 truncate text-white">{display(trackGenre(currentTrack), "-")}</div>
              </div>
            </div>
          )}
        </section>

        <section className="min-h-0 min-w-0 rounded border border-line bg-panel">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
            <div>
              <div className="text-sm font-semibold text-white">Lyrics</div>
              {lyrics?.source && <div className="truncate text-xs text-muted">{lyrics.source}</div>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <button className="secondary-button h-8" type="button" disabled={!currentTrack || lyricsBusy} onClick={() => void handleFetchLyrics()}>
                <Download size={14} />
                Fetch
              </button>
              <button className="secondary-button h-8" type="button" disabled={!currentTrack} onClick={() => setIsEditingLyrics((current) => !current)}>
                <Pencil size={14} />
                {isEditingLyrics ? "Preview" : "Edit"}
              </button>
            </div>
          </div>

          <div className="h-[calc(100%-3rem)] overflow-auto px-7 py-6">
            {isLyricsLoading && <div className="text-sm text-muted">Loading lyrics...</div>}
            {!isLyricsLoading && !currentTrack && (
              <div className="grid h-full place-items-center text-sm text-muted">No track selected.</div>
            )}
            {!isLyricsLoading && currentTrack && isEditingLyrics && (
              <div className="mx-auto grid h-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
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
                  <label className="flex items-center gap-2 text-muted">
                    File writes
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={writeRatingsToFiles}
                      onChange={(event) => onWriteRatingsToFilesChange(event.target.checked)}
                    />
                  </label>
                </div>
                <textarea
                  className="min-h-0 resize-none rounded border border-line bg-ink p-4 font-mono text-sm leading-6 text-neutral-100 outline-none ring-moss/40 focus:ring-2"
                  value={lyricsDraft}
                  placeholder="Paste lyrics here, or fetch them first."
                  onChange={(event) => setLyricsDraft(event.target.value)}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted">
                    {lyricsTarget === "file" && !writeRatingsToFiles
                      ? "File writing is off; enable it here before saving to the audio file."
                      : lyricsTarget === "file"
                        ? "Saving will update the file tags and keep a database copy."
                        : "Saving will keep lyrics in the FLAC Cafe database only."}
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!currentTrack || lyricsBusy || (lyricsTarget === "file" && !writeRatingsToFiles)}
                    onClick={() => void handleSaveLyrics()}
                  >
                    <Pencil size={15} />
                    Save Lyrics
                  </button>
                </div>
              </div>
            )}
            {!isLyricsLoading && currentTrack && !isEditingLyrics && !hasLyrics && (
              <div className="grid h-full place-items-center text-center text-sm text-muted">
                <div>
                  <div>No embedded, database, or sidecar lyrics found for this track.</div>
                  <button className="primary-button mx-auto mt-4" type="button" disabled={lyricsBusy} onClick={() => void handleFetchLyrics()}>
                    <Download size={15} />
                    Fetch Lyrics
                  </button>
                </div>
              </div>
            )}
            {!isLyricsLoading && !isEditingLyrics && hasLyrics && (
              <div className="mx-auto max-w-3xl space-y-3 text-lg leading-8 text-neutral-100">
                {lyricLines.map((line, index) => (
                  line.trim().length > 0 ? (
                    <p
                      key={`${index}-${line}`}
                      className={`whitespace-pre-wrap transition ${
                        activeLyricIndex === index ? "text-moss" : "text-neutral-100"
                      }`}
                    >
                      {stripLyricTimestamp(line)}
                    </p>
                  ) : (
                    <div key={`space-${index}`} className="h-3" />
                  )
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 min-w-0 rounded border border-line bg-panel">
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
          <div className="h-[calc(100%-3rem)] overflow-auto">
            {queue.map((track, index) => {
              const active = currentTrack?.id === track.id;
              return (
                <div
                  key={`${track.id}-${index}`}
                  data-reorder-index={index}
                  onContextMenu={(event) => openQueueContextMenu(event, index, track)}
                  className={`flex w-full items-center gap-3 border-b border-line/60 px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-white/10"
                      : dragIndex === index
                        ? "bg-moss/10"
                        : dragOverIndex === index
                          ? "bg-ember/10"
                          : "hover:bg-white/[0.035]"
                  }`}
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
      </div>
    </main>
  );
}
