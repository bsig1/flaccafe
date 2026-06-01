import {
getCurrentWindow,
} from "@tauri-apps/api/window";
import {
ArrowUp,
ChevronDown,
Coffee,
Library,
ListMusic,
Pause,
Play,
SkipBack,
SkipForward,
} from "lucide-react";
import type {
CSSProperties,
MouseEvent,
PointerEvent,
} from "react";
import {
useEffect,
useState,
} from "react";

import {
albumArtworkUrl,
} from "../../lib/api";
import {
MiniPlayerSnapshot,
UiPreferences,
clampNumber,
display,
formatPlaybackTime,
miniPlayerChannelName,
miniPlayerLayoutLabels,
miniPlayerPreferencePatch,
miniPlayerPresetFromPreferences,
miniPlayerSizeForPreset,
readMiniPlayerAlwaysOnTop,
readMiniPlayerSnapshot,
readUiPreferences,
sendMiniPlayerCommand,
storageKeys,
uiPreferencesChannelName,
useRangeWheelControls,
writeMiniPlayerAlwaysOnTop,
writeMiniPlayerSize,
writeUiPreferences,
} from "../shared";

const PLAYBACK_SCRUB_STEP_SECONDS = 0.01;
const PLAYBACK_KEYBOARD_SEEK_STEP_SECONDS = 5;

export function MiniPlayerWindow() {
  useRangeWheelControls();
  const [snapshot, setSnapshot] = useState<MiniPlayerSnapshot>(readMiniPlayerSnapshot);
  const [preferences, setPreferences] = useState(readUiPreferences);
  const [alwaysOnTop, setAlwaysOnTop] = useState(readMiniPlayerAlwaysOnTop);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const preset = miniPlayerPresetFromPreferences(preferences);
  const size = miniPlayerSizeForPreset(preset, queueOpen);
  const track = snapshot.track;
  const duration = snapshot.duration || track?.duration_seconds || 0;
  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, snapshot.currentTime / duration)) : 0;
  const progressPercent = progressRatio * 100;
  const progressFill = progressRatio > 0 ? `calc(${progressPercent}% + ${7 - progressRatio * 14}px)` : "0px";
  const artworkSrc = track && preset.showArt ? albumArtworkUrl(track.id) : null;
  const isPodcastTrack = Boolean(track?.genre?.toLowerCase().includes("podcast"));
  const trackArtistLabel = display(track?.artist, isPodcastTrack ? "Podcast" : "Unknown artist");
  const currentQueueIndex = snapshot.currentIndex >= 0 ? snapshot.currentIndex : snapshot.queue.findIndex((item) => item.id === track?.id);
  const queueStartIndex = Math.max(0, currentQueueIndex - 1);
  const visibleQueue = snapshot.queue.slice(queueStartIndex, queueStartIndex + 7);

  function clampSeekTime(seconds: number) {
    const finiteSeconds = Number.isFinite(seconds) ? seconds : 0;
    if (duration <= 0) {
      return Math.max(0, finiteSeconds);
    }
    return Math.min(Math.max(0, finiteSeconds), duration);
  }

  function seekFromMiniPlayer(seconds: number) {
    sendMiniPlayerCommand({ type: "seek", seconds: clampSeekTime(seconds) });
  }

  function updateMiniPlayerPreferences(patch: Partial<UiPreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      writeUiPreferences(next);
      return next;
    });
  }

  function updateMiniPlayerPreset(patch: Parameters<typeof miniPlayerPreferencePatch>[0]) {
    const preferencePatch = miniPlayerPreferencePatch({ ...preset, ...patch });
    const nextPreferences = { ...preferences, ...preferencePatch };
    const nextPreset = miniPlayerPresetFromPreferences(nextPreferences);
    const nextSize = miniPlayerSizeForPreset(nextPreset, queueOpen);
    updateMiniPlayerPreferences(preferencePatch);
    void applyMiniPlayerWindowStyle(alwaysOnTop, nextSize.width, nextSize.height);
  }

  function stopDragFromControls(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return;
    }
    const channel = new BroadcastChannel(miniPlayerChannelName);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "snapshot") {
        setSnapshot(event.data.snapshot as MiniPlayerSnapshot);
      }
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return;
    }
    const channel = new BroadcastChannel(uiPreferencesChannelName);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type !== "uiPreferences") {
        return;
      }
      const nextPreferences = readUiPreferences();
      setPreferences((current) =>
        JSON.stringify(current) === JSON.stringify(nextPreferences) ? current : nextPreferences,
      );
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKeys.miniPlayerSnapshot) {
        setSnapshot(readMiniPlayerSnapshot());
      }
      if (event.key === storageKeys.uiPreferences) {
        setPreferences(readUiPreferences());
      }
      if (event.key === storageKeys.miniPlayerAlwaysOnTop) {
        setAlwaysOnTop(readMiniPlayerAlwaysOnTop());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    setArtworkFailed(false);
  }, [track?.id, preset.showArt]);

  useEffect(() => {
    void applyMiniPlayerWindowStyle(alwaysOnTop, size.width, size.height);
  }, [alwaysOnTop, size.width, size.height]);

  useEffect(() => {
    writeMiniPlayerSize(size.width, size.height);
  }, [size.width, size.height]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().onCloseRequested(() => restoreMainWindow()))
      .then((handler) => {
        unlisten = handler;
      })
      .catch(() => {});
    return () => {
      unlisten?.();
      void restoreMainWindow();
    };
  }, []);

  async function restoreMainWindow() {
    try {
      const { Window } = await import("@tauri-apps/api/window");
      const mainWindow = await Window.getByLabel("main");
      await mainWindow?.setSkipTaskbar(false);
      await mainWindow?.unminimize();
      await mainWindow?.show();
      await mainWindow?.setFocus();
    } catch {
      // Browser preview has no Tauri window to restore.
    }
  }

  async function restoreMainAndCloseMiniPlayer() {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await restoreMainWindow();
      await getCurrentWindow().destroy();
    } catch {
      window.close();
    }
  }

  async function toggleAlwaysOnTop() {
    const next = !alwaysOnTop;
    try {
      await applyMiniPlayerWindowStyle(next, size.width, size.height);
      writeMiniPlayerAlwaysOnTop(next);
      setAlwaysOnTop(next);
    } catch {
      setAlwaysOnTop((current) => {
        writeMiniPlayerAlwaysOnTop(!current);
        return !current;
      });
    }
  }

  async function openNativeContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      const [{ Menu }, { LogicalPosition }] = await Promise.all([
        import("@tauri-apps/api/menu"),
        import("@tauri-apps/api/dpi"),
      ]);
      const menu = await Menu.new({
        items: [
          {
            text: snapshot.isPlaying ? "Pause" : "Play",
            enabled: Boolean(track),
            action: () => sendMiniPlayerCommand({ type: "playPause" }),
          },
          {
            text: "Previous / Restart",
            enabled: Boolean(track) || snapshot.hasPrevious,
            action: () => sendMiniPlayerCommand({ type: "previous" }),
          },
          {
            text: "Next",
            enabled: snapshot.hasNext,
            action: () => sendMiniPlayerCommand({ type: "next" }),
          },
          { item: "Separator" },
          {
            text: "Open Main App",
            action: () => void restoreMainAndCloseMiniPlayer(),
          },
          {
            text: "Always On Top",
            checked: alwaysOnTop,
            action: () => void toggleAlwaysOnTop(),
          },
          { item: "Separator" },
          {
            text: "Layout",
            items: Object.entries(miniPlayerLayoutLabels).map(([layout, label]) => ({
              text: label,
              checked: preset.layout === layout,
              action: () => updateMiniPlayerPreset({ layout: layout as UiPreferences["miniPlayerLayout"] }),
            })),
          },
          {
            text: "Visible Parts",
            items: [
              {
                text: "Artwork",
                checked: preset.showArt,
                enabled: preset.layout !== "artwork",
                action: () => updateMiniPlayerPreset({ showArt: !preset.showArt }),
              },
              {
                text: "Media Controls",
                checked: preset.showMediaControls,
                action: () => updateMiniPlayerPreset({ showMediaControls: !preset.showMediaControls }),
              },
              {
                text: "Playbar",
                checked: preset.showPlaybar,
                action: () => updateMiniPlayerPreset({ showPlaybar: !preset.showPlaybar }),
              },
              {
                text: "Playtime Numbers",
                checked: preset.showPlaytimeNumbers,
                enabled: preset.showPlaybar,
                action: () => updateMiniPlayerPreset({ showPlaytimeNumbers: !preset.showPlaytimeNumbers }),
              },
              {
                text: "Album Name",
                checked: preset.showAlbumName,
                action: () => updateMiniPlayerPreset({ showAlbumName: !preset.showAlbumName }),
              },
              {
                text: "Queue Accordion",
                checked: preset.showQueue,
                action: () => updateMiniPlayerPreset({ showQueue: !preset.showQueue }),
              },
              {
                text: "Library Button",
                checked: preset.showLibraryButton,
                action: () => updateMiniPlayerPreset({ showLibraryButton: !preset.showLibraryButton }),
              },
              {
                text: "Always-On-Top Button",
                checked: preset.showAlwaysOnTopButton,
                action: () => updateMiniPlayerPreset({ showAlwaysOnTopButton: !preset.showAlwaysOnTopButton }),
              },
            ],
          },
        ],
      });
      try {
        await menu.popup(new LogicalPosition(Math.max(0, event.clientX), Math.max(0, event.clientY)), getCurrentWindow());
      } finally {
        try {
          await menu.close();
        } catch {
          // The window may already be closing from a menu action.
        }
      }
    } catch {
      // Browser preview cannot open native Tauri menus.
    }
  }

  async function applyMiniPlayerWindowStyle(nextAlwaysOnTop: boolean, width: number, height: number) {
    try {
      const { LogicalSize } = await import("@tauri-apps/api/dpi");
      const currentWindow = getCurrentWindow();
      await currentWindow.setAlwaysOnTop(nextAlwaysOnTop);
      await currentWindow.setDecorations(true);
      await currentWindow.setMaximizable(false);
      await currentWindow.setResizable(false);
      await currentWindow.setSize(new LogicalSize(width, height));
    } catch {
      // Browser preview cannot resize a Tauri window.
    }
  }

  const compactLayout = preset.layout === "compact";
  const progressControl = preset.showPlaybar && (
    <div
      className={`grid items-center tabular-nums text-muted ${
        compactLayout ? "gap-1.5 text-[10px]" : "gap-2 text-[11px]"
      } ${
        preset.showPlaytimeNumbers
          ? compactLayout
            ? "grid-cols-[minmax(32px,auto)_1fr_minmax(32px,auto)]"
            : "grid-cols-[minmax(40px,auto)_1fr_minmax(40px,auto)]"
          : "grid-cols-1"
      }`}
      onPointerDown={stopDragFromControls}
      onMouseDown={stopDragFromControls}
    >
      {preset.showPlaytimeNumbers && <span className="text-right">{formatPlaybackTime(snapshot.currentTime)}</span>}
      <input
        aria-label="Mini player position"
        className="player-progress"
        data-wheel-step={PLAYBACK_KEYBOARD_SEEK_STEP_SECONDS}
        disabled={!track || duration <= 0}
        max={Math.max(duration, 0)}
        min={0}
        step={PLAYBACK_SCRUB_STEP_SECONDS}
        style={{ "--progress": `${progressPercent}%`, "--progress-fill": progressFill } as CSSProperties}
        type="range"
        value={duration > 0 ? Math.min(snapshot.currentTime, duration) : 0}
        onChange={(event) => seekFromMiniPlayer(Number(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            seekFromMiniPlayer(snapshot.currentTime + (event.key === "ArrowRight" ? PLAYBACK_KEYBOARD_SEEK_STEP_SECONDS : -PLAYBACK_KEYBOARD_SEEK_STEP_SECONDS));
            return;
          }
          if (event.key !== " " && event.code !== "Space") {
            return;
          }
          event.preventDefault();
          if (track) {
            sendMiniPlayerCommand({ type: "playPause" });
          }
        }}
      />
      {preset.showPlaytimeNumbers && <span>{formatPlaybackTime(duration)}</span>}
    </div>
  );

  const artwork = preset.showArt && (
    <div className={`grid shrink-0 place-items-center overflow-hidden border border-white/10 bg-[rgb(var(--color-mini-panel))] text-moss shadow-lg shadow-black/30 ${
      compactLayout ? "h-12 w-12 rounded-md" : "h-[72px] w-[72px] rounded-lg"
    }`}>
      {artworkSrc && !artworkFailed ? (
        <img alt="" className="h-full w-full object-cover" src={artworkSrc} onError={() => setArtworkFailed(true)} />
      ) : (
        <Coffee size={compactLayout ? 20 : 26} />
      )}
    </div>
  );

  const titleBlock = (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <div className={`truncate font-semibold tracking-normal ${compactLayout ? "text-[13px]" : "text-[15px]"}`}>{track ? display(track.title, "Untitled") : "Nothing playing"}</div>
        {track?.rating !== null && track?.rating !== undefined && (
          <span className="shrink-0 rounded-full border border-moss/40 bg-moss/10 px-2 py-0.5 text-[10px] text-moss">
            {track.rating} star
          </span>
        )}
      </div>
      {track ? (
        <div className="min-w-0 truncate text-xs text-muted">
          {preset.showAlbumName && track.album ? `${trackArtistLabel} - ${track.album}` : trackArtistLabel}
        </div>
      ) : (
        <div className="truncate text-xs text-muted">Use the main window to start a queue</div>
      )}
    </div>
  );

  const utilityButtons = (preset.showAlwaysOnTopButton || preset.showLibraryButton) && (
    <div className="flex items-center gap-1" onPointerDown={stopDragFromControls} onMouseDown={stopDragFromControls}>
      {preset.showAlwaysOnTopButton && (
        <button
          className={`grid h-7 w-7 place-items-center rounded text-muted transition hover:bg-white/10 hover:text-white ${alwaysOnTop ? "text-moss" : ""}`}
          type="button"
          title="Always on top"
          onClick={() => void toggleAlwaysOnTop()}
        >
          <ArrowUp size={13} />
        </button>
      )}
      {preset.showLibraryButton && (
        <button className="grid h-7 w-7 place-items-center rounded text-muted transition hover:bg-white/10 hover:text-white" type="button" title="Open main app" onClick={() => void restoreMainAndCloseMiniPlayer()}>
          <Library size={13} />
        </button>
      )}
    </div>
  );

  const controls = preset.showMediaControls && (
    <div className="flex items-center justify-center gap-1.5" onPointerDown={stopDragFromControls} onMouseDown={stopDragFromControls}>
      <button
        className={`grid place-items-center rounded text-muted transition hover:bg-white/10 hover:text-white disabled:opacity-35 ${compactLayout ? "h-7 w-7" : "h-8 w-8"}`}
        type="button"
        title="Previous or restart track"
        disabled={!snapshot.hasPrevious}
        onClick={() => sendMiniPlayerCommand({ type: "previous" })}
      >
        <SkipBack size={compactLayout ? 13 : 14} />
      </button>
      <button
        className={`grid place-items-center rounded-full bg-ember text-ink shadow-md shadow-black/30 transition hover:bg-[rgb(var(--color-primary-hover))] disabled:opacity-50 ${compactLayout ? "h-8 w-8" : "h-9 w-9"}`}
        type="button"
        title={snapshot.isPlaying ? "Pause" : "Play"}
        disabled={!track}
        onClick={() => sendMiniPlayerCommand({ type: "playPause" })}
      >
        {snapshot.isPlaying ? <Pause size={compactLayout ? 15 : 16} fill="currentColor" /> : <Play size={compactLayout ? 15 : 16} fill="currentColor" />}
      </button>
      <button
        className={`grid place-items-center rounded text-muted transition hover:bg-white/10 hover:text-white disabled:opacity-35 ${compactLayout ? "h-7 w-7" : "h-8 w-8"}`}
        type="button"
        title="Next"
        disabled={!snapshot.hasNext}
        onClick={() => sendMiniPlayerCommand({ type: "next" })}
      >
        <SkipForward size={compactLayout ? 13 : 14} />
      </button>
    </div>
  );

  const queueAccordion = preset.showQueue && (
    <div className="border-t border-white/10" onPointerDown={stopDragFromControls} onMouseDown={stopDragFromControls}>
      <button
        className="flex h-8 w-full items-center justify-between gap-2 px-3 text-xs text-muted transition hover:bg-white/5 hover:text-white"
        type="button"
        onClick={() => setQueueOpen((current) => !current)}
      >
        <span className="inline-flex items-center gap-2">
          <ListMusic size={13} />
          Queue
        </span>
        <span className="inline-flex items-center gap-1">
          {snapshot.queue.length}
          <ChevronDown className={`transition ${queueOpen ? "rotate-180" : ""}`} size={13} />
        </span>
      </button>
      {queueOpen && (
        <div className="scrollbar-hidden max-h-[104px] overflow-y-auto px-2 pb-2">
          {visibleQueue.length ? visibleQueue.map((item, itemOffset) => {
            const queueIndex = queueStartIndex + itemOffset;
            const active = queueIndex === currentQueueIndex;
            return (
              <button
                key={`${item.id}-${queueIndex}`}
                className={`grid w-full grid-cols-[1fr_auto] gap-2 rounded px-2 py-1 text-left text-[11px] transition hover:bg-white/10 ${active ? "bg-moss/15 text-white" : "text-muted"}`}
                type="button"
                onClick={() => sendMiniPlayerCommand({ type: "playQueueIndex", index: queueIndex })}
              >
                <span className="truncate">{display(item.title, "Untitled")}</span>
                <span className="truncate text-[10px] opacity-75">{display(item.artist, "")}</span>
              </button>
            );
          }) : (
            <div className="px-2 py-3 text-center text-[11px] text-muted">Queue is empty</div>
          )}
        </div>
      )}
    </div>
  );

  const containerClass =
    preset.layout === "artwork"
      ? "grid h-full grid-rows-[1fr_auto] overflow-hidden"
      : preset.layout === "wide"
        ? "grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3"
        : preset.layout === "compact"
          ? preset.showArt
            ? "grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-2"
            : "grid h-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2"
          : "grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3";

  return (
    <main
      className="flex h-screen min-h-0 flex-col overflow-hidden bg-[rgb(var(--color-mini))] text-white"
      style={{ opacity: clampNumber(preset.opacity, 0.35, 1) }}
      title={`${miniPlayerLayoutLabels[preset.layout]} mini player`}
      onContextMenu={(event) => void openNativeContextMenu(event)}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-white/5 bg-[rgb(var(--color-quiet))] shadow-2xl">
        <div className={containerClass}>
          {preset.layout === "artwork" ? (
            <>
              <div className="relative min-h-0 overflow-hidden">
                {artworkSrc && !artworkFailed ? (
                  <img alt="" className="h-full w-full object-cover" src={artworkSrc} onError={() => setArtworkFailed(true)} />
                ) : (
                  <div className="grid h-full place-items-center bg-[rgb(var(--color-mini-panel))] text-moss"><Coffee size={44} /></div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-3">
                  {titleBlock}
                  {progressControl && <div className="mt-2">{progressControl}</div>}
                </div>
                <div className="absolute right-2 top-2">{utilityButtons}</div>
              </div>
              {controls && <div className="flex items-center justify-center px-3 py-2">{controls}</div>}
            </>
          ) : (
            <>
              {artwork}
              <div className="min-w-0">
                {titleBlock}
                {progressControl && <div className={compactLayout ? "mt-1.5" : "mt-3"}>{progressControl}</div>}
              </div>
              <div className={`flex h-full flex-col items-end ${compactLayout ? "justify-center gap-1" : "justify-between gap-2"}`}>
                {utilityButtons}
                {controls}
              </div>
            </>
          )}
        </div>
        {queueAccordion}
      </div>
    </main>
  );
}
