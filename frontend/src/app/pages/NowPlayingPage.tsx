import {
  ArrowDown,
  ArrowUp,
  Clock,
  Download,
  GripVertical,
  ListMusic,
  Maximize2,
  Minimize2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  SlidersHorizontal,
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
  useRef,
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
  AudioVisualizer,
} from "../components/AudioVisualizer";
import {
  DragGhostPreview,
} from "../components/common";
import {
  NowPlayingLyricsEditor,
} from "./now-playing/NowPlayingLyricsEditor";
import {
  NowPlayingQueuePanel,
} from "./now-playing/NowPlayingQueuePanel";
import {
  LyricsEditMode,
  LrcBuilderLine,
  builderLinesFromLyricsText,
  formatLrcTimestamp,
  lrcDraftFromBuilderLines,
} from "./now-playing/lyricsBuilder";
import {
  DragGhost,
  MENU_VIEWPORT_MARGIN,
  type MiniPlayerSnapshot,
  PlaybackQueueContextMenu,
  beginPointerReorderDrag,
  display,
  displayAlbumForTrack,
  formatPlaybackTime,
  isTimestampOnlyLyricLine,
  miniPlayerChannelName,
  parseLyricTimestamp,
  readMiniPlayerSnapshot,
  stripLyricTimestamp,
  trackGenre,
  UiPreferences,
  VISUALIZER_FRAME_EVENT,
  VisualizerFrame,
} from "../shared";

const QUEUE_VIRTUALIZATION_THRESHOLD = 160;
const QUEUE_VIRTUALIZATION_OVERSCAN = 10;

export function NowPlayingPage({
  currentTrack,
  lyrics,
  isLyricsLoading,
  playbackTime,
  queue,
  uiPreferences,
  setUiPreferences,
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
  onOpenCurrentTrack,
  onOpenCurrentArtist,
  onOpenCurrentAlbum,
}: {
  currentTrack: Track | null;
  lyrics: LyricsResponse | null;
  isLyricsLoading: boolean;
  playbackTime: number;
  queue: Track[];
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
  writeRatingsToFiles: boolean;
  onWriteRatingsToFilesChange: (value: boolean) => void;
  onFetchLyrics: (track: Track) => Promise<LyricsResponse>;
  onSaveLyrics: (trackId: number, requestBody: LyricsUpdateRequest) => Promise<LyricsResponse>;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onMoveQueueTrack: (index: number, direction: "up" | "down") => void;
  onReorderQueueTrack: (fromIndex: number, toIndex: number) => void;
  onRemoveQueueTrack: (index: number) => void;
  onClearQueue: () => void;
  onSaveQueue: () => void;
  onRestoreQueue: () => void;
  canRestoreQueue: boolean;
  onOpenCurrentTrack: (track: Track) => void;
  onOpenCurrentArtist: (track: Track) => void;
  onOpenCurrentAlbum: (track: Track) => void;
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
  const [lyricsEditMode, setLyricsEditMode] = useState<LyricsEditMode>("text");
  const [lrcBuilderLines, setLrcBuilderLines] = useState<LrcBuilderLine[]>([]);
  const [activeBuilderLineIndex, setActiveBuilderLineIndex] = useState(0);
  const [visualizerFrame, setVisualizerFrame] = useState<VisualizerFrame | null>(null);
  const [playbackSnapshot, setPlaybackSnapshot] = useState<MiniPlayerSnapshot>(readMiniPlayerSnapshot);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLElement | null>(null);
  const builderLineIdRef = useRef(0);
  const queueScrollRef = useRef<HTMLDivElement | null>(null);
  const queueScrollFrameRef = useRef<number | null>(null);
  const pendingQueueScrollTopRef = useRef(0);
  const [queueScrollTop, setQueueScrollTop] = useState(0);
  const [queueViewportHeight, setQueueViewportHeight] = useState(420);

  useEffect(() => {
    setArtworkFailed(false);
  }, [currentTrack?.id]);

  useEffect(() => {
    setLyricsDraft(lyrics?.lyrics ?? "");
    setLyricsSynced(Boolean(lyrics?.is_synced));
    setIsEditingLyrics(false);
    setLyricsEditMode("text");
    setLrcBuilderLines(builderLinesFromText(lyrics?.lyrics ?? ""));
    setActiveBuilderLineIndex(0);
    setLyricsTarget("database");
  }, [currentTrack?.id, lyrics?.lyrics, lyrics?.is_synced]);

  useEffect(() => {
    function handleVisualizerFrame(event: Event) {
      const frame = (event as CustomEvent<VisualizerFrame>).detail;
      if (!frame || (currentTrack && frame.trackId !== null && frame.trackId !== currentTrack.id)) {
        return;
      }
      setVisualizerFrame(frame);
    }

    window.addEventListener(VISUALIZER_FRAME_EVENT, handleVisualizerFrame);
  return () => window.removeEventListener(VISUALIZER_FRAME_EVENT, handleVisualizerFrame);
  }, [currentTrack?.id]);

  useEffect(() => {
    setPlaybackSnapshot(readMiniPlayerSnapshot());
    if (!("BroadcastChannel" in window)) {
      return;
    }
    const channel = new BroadcastChannel(miniPlayerChannelName);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "snapshot" && event.data.snapshot) {
        setPlaybackSnapshot(event.data.snapshot as MiniPlayerSnapshot);
      }
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const artworkSrc = currentTrack && !artworkFailed ? albumArtworkUrl(currentTrack.id, currentTrack.file_modified_at) : null;
  const currentAlbumLabel = displayAlbumForTrack(currentTrack);
  const currentArtistAlbumLabel = currentTrack
    ? currentAlbumLabel
      ? `${display(currentTrack.artist)} - ${currentAlbumLabel}`
      : display(currentTrack.artist)
    : "Idle";
  const lyricLines = lyrics?.lyrics?.split("\n") ?? [];
  const hasLyrics = lyricLines.some((line) => line.trim().length > 0);
  const timedLines = lyricLines.map((line, index) => ({ line, index, time: parseLyricTimestamp(line) }));
  const activeLyricIndex = timedLines.reduce((active, item) => {
    if (item.time !== null && item.time <= playbackTime) {
      return item.index;
    }
    return active;
  }, -1);
  const layout = uiPreferences.nowPlayingLayout;
  const isQueueLayout = layout === "queue";
  const isLyricsView = layout === "lyrics";
  const showLyrics = isLyricsView || uiPreferences.nowPlayingShowLyrics;
  const showQueue = uiPreferences.nowPlayingShowQueue && layout !== "party" && !isLyricsView;
  const visualizerStyle = uiPreferences.nowPlayingVisualizerStyle;
  const pageTrackIsPlaying = Boolean(currentTrack && playbackSnapshot.track?.id === currentTrack.id && playbackSnapshot.isPlaying);
  const visualizerActive = Boolean(currentTrack && (visualizerFrame?.isPlaying || pageTrackIsPlaying));
  const activeLyricIsGap = activeLyricIndex >= 0 && isTimestampOnlyLyricLine(lyricLines[activeLyricIndex] ?? "");
  const activeLyricLine =
    activeLyricIndex >= 0
      ? stripLyricTimestamp(lyricLines[activeLyricIndex] ?? "")
      : stripLyricTimestamp(lyricLines.find((line) => line.trim()) ?? "");
  const lyricSizeClass =
    uiPreferences.nowPlayingLyricSize === "large"
      ? "text-2xl leading-10"
      : uiPreferences.nowPlayingLyricSize === "small"
        ? "text-base leading-7"
        : "text-lg leading-8";
  const titleSizeClass = layout === "party" ? "text-2xl md:text-3xl" : isQueueLayout ? "text-lg 2xl:text-2xl" : "text-xl";
  const metadataLinkClass = "max-w-full truncate rounded text-left transition hover:text-moss focus:outline-none focus:ring-2 focus:ring-moss/40";
  const lyricsSaveDisabled = !currentTrack || lyricsBusy || (lyricsTarget === "file" && !writeRatingsToFiles);
  const queueRowHeight = isQueueLayout ? 62 : 52;
  const shouldVirtualizeQueue = showQueue && queue.length > QUEUE_VIRTUALIZATION_THRESHOLD;
  const queueStartIndex = shouldVirtualizeQueue
    ? Math.max(0, Math.floor(queueScrollTop / queueRowHeight) - QUEUE_VIRTUALIZATION_OVERSCAN)
    : 0;
  const queueVisibleCount = Math.ceil(queueViewportHeight / queueRowHeight) + QUEUE_VIRTUALIZATION_OVERSCAN * 2;
  const queueEndIndex = shouldVirtualizeQueue ? Math.min(queue.length, queueStartIndex + queueVisibleCount) : queue.length;
  const renderedQueue = shouldVirtualizeQueue ? queue.slice(queueStartIndex, queueEndIndex) : queue;
  const queueTopSpacerHeight = shouldVirtualizeQueue ? queueStartIndex * queueRowHeight : 0;
  const queueBottomSpacerHeight = shouldVirtualizeQueue ? Math.max(0, (queue.length - queueEndIndex) * queueRowHeight) : 0;

  function openTrackLink(action: (track: Track) => void) {
    if (currentTrack) {
      action(currentTrack);
    }
  }

  function createBuilderLine(text = "", time: number | null = null, gap = false): LrcBuilderLine {
    const id = `lrc-line-${builderLineIdRef.current}`;
    builderLineIdRef.current += 1;
    return { id, text, time, gap };
  }

  function builderLinesFromText(text: string): LrcBuilderLine[] {
    return builderLinesFromLyricsText(text, createBuilderLine);
  }

  function commitBuilderLines(lines: LrcBuilderLine[], activeIndex = activeBuilderLineIndex) {
    const nextLines = lines.length > 0 ? lines : [createBuilderLine()];
    const nextActive = Math.max(0, Math.min(activeIndex, nextLines.length - 1));
    setLrcBuilderLines(nextLines);
    setActiveBuilderLineIndex(nextActive);
    setLyricsSynced(true);
    setLyricsDraft(lrcDraftFromBuilderLines(nextLines));
  }

  function openLrcBuilder() {
    const nextLines = builderLinesFromText(lyricsDraft);
    const firstUnsynced = nextLines.findIndex((line) => line.time === null && !line.gap);
    commitBuilderLines(nextLines, firstUnsynced >= 0 ? firstUnsynced : 0);
    setLyricsEditMode("sync");
  }

  function updateBuilderLine(index: number, update: Partial<LrcBuilderLine>) {
    const nextLines = lrcBuilderLines.map((line, lineIndex) =>
      lineIndex === index ? { ...line, ...update } : line,
    );
    commitBuilderLines(nextLines, index);
  }

  function syncBuilderLine(index = activeBuilderLineIndex) {
    if (lrcBuilderLines.length === 0) {
      commitBuilderLines([createBuilderLine("", playbackTime, true)], 0);
      return;
    }
    const boundedIndex = Math.max(0, Math.min(index, lrcBuilderLines.length - 1));
    const nextLines = lrcBuilderLines.map((line, lineIndex) =>
      lineIndex === boundedIndex ? { ...line, time: playbackTime } : line,
    );
    const nextActive = Math.min(nextLines.length - 1, boundedIndex + 1);
    commitBuilderLines(nextLines, nextActive);
  }

  function insertNoLyricSection() {
    const boundedIndex = Math.max(0, Math.min(activeBuilderLineIndex, Math.max(0, lrcBuilderLines.length - 1)));
    const selected = lrcBuilderLines[boundedIndex];
    if (selected && selected.time === null && selected.text.trim().length === 0) {
      const nextLines = lrcBuilderLines.map((line, index) =>
        index === boundedIndex ? { ...line, time: playbackTime, text: "", gap: true } : line,
      );
      commitBuilderLines(nextLines, Math.min(nextLines.length - 1, boundedIndex + 1));
      return;
    }

    const nextLines = [...lrcBuilderLines];
    const insertAt = selected ? boundedIndex + 1 : nextLines.length;
    nextLines.splice(insertAt, 0, createBuilderLine("", playbackTime, true));
    commitBuilderLines(nextLines, Math.min(nextLines.length - 1, insertAt + 1));
  }

  function addBuilderLine() {
    const insertAt = Math.max(0, Math.min(activeBuilderLineIndex + 1, lrcBuilderLines.length));
    const nextLines = [...lrcBuilderLines];
    nextLines.splice(insertAt, 0, createBuilderLine());
    commitBuilderLines(nextLines, insertAt);
  }

  function removeBuilderLine(index: number) {
    const nextLines = lrcBuilderLines.filter((_, lineIndex) => lineIndex !== index);
    commitBuilderLines(nextLines, Math.max(0, index - 1));
  }

  function renderLyricLine(line: string, index: number, spacious = false) {
    const active = activeLyricIndex === index;
    const setActiveNode = active ? (node: HTMLElement | null) => { activeLyricRef.current = node; } : undefined;
    if (line.trim().length === 0) {
      return <div key={`space-${index}`} className={spacious ? "h-4" : "h-3"} />;
    }
    if (isTimestampOnlyLyricLine(line)) {
      return (
        <div
          key={`${index}-${line}`}
          ref={setActiveNode}
          className={`mx-auto my-2 h-px rounded-full transition ${
            active ? "w-28 bg-moss/70" : "w-16 bg-line"
          }`}
          title="No lyrics in this section"
        />
      );
    }
    return (
      <p
        key={`${index}-${line}`}
        ref={setActiveNode}
        className={`whitespace-pre-wrap transition ${
          active ? `${spacious ? "scale-[1.02] " : ""}text-moss` : spacious ? "text-neutral-300" : "text-neutral-100"
        }`}
      >
        {stripLyricTimestamp(line)}
      </p>
    );
  }

  useEffect(() => {
    if (!uiPreferences.nowPlayingAutoScrollLyrics || !showLyrics || isEditingLyrics || activeLyricIndex < 0) {
      return;
    }
    activeLyricRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLyricIndex, isEditingLyrics, showLyrics, uiPreferences.nowPlayingAutoScrollLyrics]);

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

  useEffect(() => {
    const element = queueScrollRef.current;
    if (!element) {
      return undefined;
    }
    const updateHeight = () => setQueueViewportHeight(Math.max(180, element.clientHeight || 420));
    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => window.removeEventListener("resize", updateHeight);
    }
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [showQueue, isQueueLayout]);

  useEffect(() => {
    return () => {
      if (queueScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(queueScrollFrameRef.current);
      }
    };
  }, []);

  function handleQueueScroll() {
    const element = queueScrollRef.current;
    if (!element) {
      return;
    }
    pendingQueueScrollTopRef.current = element.scrollTop;
    if (queueScrollFrameRef.current !== null) {
      return;
    }
    queueScrollFrameRef.current = window.requestAnimationFrame(() => {
      queueScrollFrameRef.current = null;
      const next = pendingQueueScrollTopRef.current;
      setQueueScrollTop((current) => (Math.abs(current - next) < 4 ? current : next));
    });
  }

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
      const fetched = await onFetchLyrics(currentTrack);
      setLyricsDraft(fetched.lyrics ?? "");
      setLyricsSynced(fetched.is_synced);
      setLrcBuilderLines(builderLinesFromText(fetched.lyrics ?? ""));
      setActiveBuilderLineIndex(0);
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
        source: lyricsTarget === "database" ? (lyricsSynced ? "database:synced" : "database:manual") : null,
      });
      setIsEditingLyrics(false);
    } finally {
      setLyricsBusy(false);
    }
  }

  useEffect(() => {
    function handleLyricsSaveShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s" || !isEditingLyrics) {
        return;
      }
      event.preventDefault();
      if (!lyricsSaveDisabled) {
        void handleSaveLyrics();
      }
    }

    window.addEventListener("keydown", handleLyricsSaveShortcut);
    return () => window.removeEventListener("keydown", handleLyricsSaveShortcut);
  }, [currentTrack?.id, isEditingLyrics, lyricsDraft, lyricsSynced, lyricsTarget, lyricsSaveDisabled]);

  function updateNowPlayingPreference<K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) {
    setUiPreferences((current) => ({ ...current, [key]: value }));
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can be blocked in browser preview; the layout controls still work.
    }
  }

  const nowPlayingQueueModel = {
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
  };

  const lyricsEditorModel = {
  lyricsSynced,
  setLyricsSynced,
  lyricsTarget,
  setLyricsTarget,
  writeRatingsToFiles,
  onWriteRatingsToFilesChange,
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
  insertNoLyricSection,
  addBuilderLine,
  updateBuilderLine,
  removeBuilderLine,
  lyricsSaveDisabled,
  handleSaveLyrics,
  };

  return (
    <main className={`relative flex min-w-0 flex-1 flex-col overflow-hidden ${layout === "party" ? "bg-black" : ""}`}>
      <DragGhostPreview ghost={queueDragGhost} />
      {layout !== "party" && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgb(var(--color-primary)/0.16),transparent_36%),radial-gradient(circle_at_80%_60%,rgb(var(--color-moss)/0.14),transparent_34%)]" />
      )}
      <header className="relative z-10 flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-2 lg:px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Now Playing</h1>
          <p className="text-xs text-muted">
            {currentArtistAlbumLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <label className="flex items-center gap-2 rounded border border-line/70 bg-ink px-2 py-1.5">
            <span className="text-muted">Layout</span>
            <select
              className="rounded bg-ink px-1.5 py-0.5 text-white outline-none"
              value={layout}
              onChange={(event) => updateNowPlayingPreference("nowPlayingLayout", event.target.value as UiPreferences["nowPlayingLayout"])}
            >
              <option value="queue">Queue</option>
              <option value="lyrics">Lyrics</option>
              <option value="party">Party</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded border border-line/70 bg-ink px-2 py-1.5">
            <span className="text-muted">Visualizer</span>
            <select
              className="rounded bg-ink px-1.5 py-0.5 text-white outline-none"
              value={visualizerStyle}
              onChange={(event) =>
                updateNowPlayingPreference("nowPlayingVisualizerStyle", event.target.value as UiPreferences["nowPlayingVisualizerStyle"])
              }
            >
              <option value="bars">Bars</option>
              <option value="wave">Ribbon</option>
              <option value="radial">Radial</option>
              <option value="off">Off</option>
            </select>
          </label>
          <button
            className={`icon-button h-8 w-8 ${showLyrics ? "border-moss text-moss" : ""}`}
            type="button"
            title={showLyrics ? "Hide lyrics" : "Show lyrics"}
            onClick={() => updateNowPlayingPreference("nowPlayingShowLyrics", !showLyrics)}
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            className={`icon-button h-8 w-8 ${showQueue ? "border-moss text-moss" : ""}`}
            type="button"
            title={showQueue ? "Hide queue" : "Show queue"}
            onClick={() => updateNowPlayingPreference("nowPlayingShowQueue", !uiPreferences.nowPlayingShowQueue)}
          >
            <GripVertical size={14} />
          </button>
          <button className="icon-button h-8 w-8" type="button" title="Toggle fullscreen" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </header>

      {isLyricsView ? (
        <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden px-5 py-4 lg:px-8">
          <section className="mx-auto flex w-full max-w-5xl items-center gap-4 border-b border-line/70 pb-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-line bg-panel">
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
                  <Volume2 size={24} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-white">
                {currentTrack ? display(currentTrack.title, "Untitled") : "Nothing playing"}
              </div>
              <div className="mt-1 truncate text-sm text-muted">
                {currentTrack
                  ? currentArtistAlbumLabel
                  : "Choose a track from Library or AutoDJ"}
              </div>
              {lyrics?.source && <div className="mt-1 truncate text-xs text-muted">{lyrics.source}</div>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs">
              <button
                className={`secondary-button h-8 ${uiPreferences.nowPlayingAutoScrollLyrics ? "border-moss text-moss" : ""}`}
                type="button"
                title="Scroll with current lyric"
                onClick={() => updateNowPlayingPreference("nowPlayingAutoScrollLyrics", !uiPreferences.nowPlayingAutoScrollLyrics)}
              >
                Follow
              </button>
              <button className="secondary-button h-8" type="button" disabled={!currentTrack || lyricsBusy} onClick={() => void handleFetchLyrics()}>
                <Download size={14} />
                Fetch
              </button>
              <button className="secondary-button h-8" type="button" disabled={!currentTrack} onClick={() => setIsEditingLyrics((current) => !current)}>
                <Pencil size={14} />
                {isEditingLyrics ? "Preview" : "Edit"}
              </button>
            </div>
          </section>
          <section ref={lyricsScrollRef} className="scrollbar-hidden mx-auto min-h-0 w-full max-w-5xl overflow-auto px-2 py-4 lg:px-10">
            {isLyricsLoading && <div className="text-sm text-muted">Loading lyrics...</div>}
            {!isLyricsLoading && !currentTrack && (
              <div className="grid h-full place-items-center text-sm text-muted">No track selected.</div>
            )}
            {!isLyricsLoading && currentTrack && isEditingLyrics && (
              <NowPlayingLyricsEditor model={lyricsEditorModel} containerClass="" />
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
              <div className="mx-auto max-w-4xl space-y-5 pb-[45vh] pt-[16vh] text-center text-2xl leading-10 text-neutral-100 md:text-3xl md:leading-[3.25rem]">
                {lyricLines.map((line, index) => renderLyricLine(line, index, true))}
              </div>
            )}
          </section>
        </div>
      ) : layout === "party" ? (
        <div className="relative z-10 grid min-h-0 flex-1 overflow-hidden px-5 py-4 text-center lg:px-8">
          <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] items-center gap-4 md:grid-cols-[minmax(170px,34vh)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] md:gap-x-8 md:gap-y-4">
            <div className={`mx-auto aspect-square w-[min(24vh,220px)] overflow-hidden rounded-full md:w-[min(34vh,360px)] ${
              artworkSrc ? "border border-white/20 bg-panel shadow-2xl shadow-black/50" : ""
            }`}>
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
                  <Volume2 size={72} />
                </div>
              )}
            </div>
            <div className="grid min-h-0 min-w-0 content-center gap-4 md:h-full">
              <div className="min-w-0">
                <h2 className={`truncate font-semibold tracking-normal text-white ${titleSizeClass}`}>
                  {currentTrack ? (
                    <button className={metadataLinkClass} type="button" onClick={() => openTrackLink(onOpenCurrentTrack)}>
                      {display(currentTrack.title, "Untitled")}
                    </button>
                  ) : (
                    "Nothing playing"
                  )}
                </h2>
                <div className="mt-2 truncate text-base text-neutral-200 md:text-lg">
                  {currentTrack ? (
                    <button className={metadataLinkClass} type="button" onClick={() => openTrackLink(onOpenCurrentArtist)}>
                      {display(currentTrack.artist)}
                    </button>
                  ) : (
                    "Choose a track from Library or AutoDJ"
                  )}
                </div>
                {currentTrack && currentAlbumLabel && (
                <div className="mt-1 truncate text-sm text-muted md:text-base">
                    <button className={metadataLinkClass} type="button" onClick={() => openTrackLink(onOpenCurrentAlbum)}>
                      {currentAlbumLabel}
                    </button>
                </div>
                )}
              </div>
              <div className="h-[clamp(72px,18vh,150px)] min-h-0">
                <AudioVisualizer
                  active={visualizerActive}
                  frame={visualizerFrame}
                  frameless
                  seed={currentTrack?.id ?? 0}
                  style={visualizerStyle}
                />
              </div>
            </div>
            {showLyrics && (
              <div className="mx-auto min-h-0 max-w-5xl overflow-hidden text-balance text-xl font-medium leading-tight text-moss md:col-span-2 md:text-2xl">
                {hasLyrics
                  ? activeLyricIsGap
                    ? ""
                    : activeLyricLine || stripLyricTimestamp(lyricLines.find((line) => line.trim()) ?? "")
                  : "No lyrics loaded"}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div
        className={`relative z-10 grid min-h-0 flex-1 gap-4 overflow-auto p-4 xl:p-6 ${
          isQueueLayout
            ? showQueue
              ? showLyrics
                ? "grid-cols-1 md:grid-cols-[minmax(170px,240px)_minmax(0,1fr)] xl:grid-cols-[minmax(170px,250px)_minmax(0,1fr)_minmax(320px,420px)] xl:overflow-hidden"
                : "grid-cols-1 md:grid-cols-[minmax(190px,280px)_minmax(320px,440px)] xl:grid-cols-[minmax(220px,340px)_minmax(380px,520px)] xl:overflow-hidden"
              : "grid-cols-1 md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,380px)_minmax(0,1fr)] xl:overflow-hidden"
            : showQueue
              ? "grid-cols-1 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)_minmax(260px,300px)] xl:overflow-hidden"
              : "grid-cols-1 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] xl:overflow-hidden"
        }`}
      >
        <section
          className={`min-h-0 min-w-0 overflow-auto pr-1 ${
            isQueueLayout ? "grid content-start text-center xl:content-center" : ""
          } ${isQueueLayout && showQueue && showLyrics ? "md:row-span-2 xl:row-span-1" : ""}`}
        >
          <div className={`mx-auto aspect-square w-full overflow-hidden rounded border border-line bg-panel shadow-xl ${
            isQueueLayout ? "max-w-[min(42vh,18rem)] 2xl:max-w-[48vh]" : "max-w-[38vh]"
          }`}>
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
            <h2 className={`truncate font-semibold text-white ${titleSizeClass}`}>
              {currentTrack ? (
                <button className={metadataLinkClass} type="button" onClick={() => openTrackLink(onOpenCurrentTrack)}>
                  {display(currentTrack.title, "Untitled")}
                </button>
              ) : (
                "Nothing playing"
              )}
            </h2>
            <div className="mt-2 truncate text-xs text-neutral-300 2xl:text-sm">
              {currentTrack ? (
                <button className={metadataLinkClass} type="button" onClick={() => openTrackLink(onOpenCurrentArtist)}>
                  {display(currentTrack.artist)}
                </button>
              ) : (
                "Choose a track from Library or AutoDJ"
              )}
            </div>
            {currentTrack && currentAlbumLabel && (
            <div className="mt-1 truncate text-sm text-muted">
                <button className={metadataLinkClass} type="button" onClick={() => openTrackLink(onOpenCurrentAlbum)}>
                  {currentAlbumLabel}
                </button>
            </div>
            )}
          </div>

          {currentTrack && !isQueueLayout && (
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
          <div className={isQueueLayout ? "mt-4 h-24 xl:h-36 2xl:h-56" : "mt-5 h-24 2xl:h-28"}>
            <AudioVisualizer
              active={visualizerActive}
              frame={visualizerFrame}
              frameless={isQueueLayout}
              seed={currentTrack?.id ?? 0}
              style={visualizerStyle}
            />
          </div>
        </section>

        {showLyrics ? (
        <section className={`grid min-h-[360px] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden ${
          isQueueLayout ? "rounded border border-line/40 bg-panel/45 xl:min-h-0" : "rounded border border-line bg-panel xl:min-h-0"
        }`}>
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
            <div>
              <div className="text-sm font-semibold text-white">Lyrics</div>
              {lyrics?.source && <div className="truncate text-xs text-muted">{lyrics.source}</div>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <button
                className={`secondary-button h-8 ${uiPreferences.nowPlayingAutoScrollLyrics ? "border-moss text-moss" : ""}`}
                type="button"
                title="Scroll with current lyric"
                onClick={() => updateNowPlayingPreference("nowPlayingAutoScrollLyrics", !uiPreferences.nowPlayingAutoScrollLyrics)}
              >
                Follow
              </button>
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

          <div ref={lyricsScrollRef} className="scrollbar-hidden min-h-0 overflow-auto px-4 py-4 lg:px-7 lg:py-6">
            {isLyricsLoading && <div className="text-sm text-muted">Loading lyrics...</div>}
            {!isLyricsLoading && !currentTrack && (
              <div className="grid h-full place-items-center text-sm text-muted">No track selected.</div>
            )}
            {!isLyricsLoading && currentTrack && isEditingLyrics && (
              <NowPlayingLyricsEditor model={lyricsEditorModel} containerClass="mx-auto max-w-3xl" />
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
              <div className={`mx-auto max-w-3xl space-y-3 text-neutral-100 ${lyricSizeClass}`}>
                {lyricLines.map((line, index) => renderLyricLine(line, index))}
              </div>
            )}
          </div>
        </section>
        ) : isQueueLayout && showQueue ? null : (
          <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] rounded border border-line bg-panel">
            <div className="border-b border-line px-4 py-3">
              <div className="text-sm font-semibold text-white">Visualizer</div>
              <div className="text-xs text-muted">
                {visualizerFrame?.isLive ? "Live Web Audio analysis" : "Playback-reactive ambient motion"}
              </div>
            </div>
            <div className="min-h-0 p-4">
              <AudioVisualizer
                active={visualizerActive}
                frame={visualizerFrame}
                seed={currentTrack?.id ?? 0}
                style={visualizerStyle}
                className="min-h-full"
              />
            </div>
          </section>
        )}

        {showQueue && <NowPlayingQueuePanel model={nowPlayingQueueModel} />}
      </div>
      )}
    </main>
  );
}
