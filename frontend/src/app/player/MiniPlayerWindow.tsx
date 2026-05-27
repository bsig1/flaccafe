import {
  ArrowUp,
  Coffee,
  Library,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type {
  CSSProperties,
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
  display,
  formatPlaybackTime,
  miniPlayerChannelName,
  readMiniPlayerAlwaysOnTop,
  readMiniPlayerSnapshot,
  sendMiniPlayerCommand,
  storageKeys,
  useRangeWheelControls,
  writeMiniPlayerAlwaysOnTop,
  writeMiniPlayerSize,
} from "../shared";

const MINI_PLAYER_WIDTH = 420;
const MINI_PLAYER_HEIGHT = 118;

export function MiniPlayerWindow() {
  useRangeWheelControls();
  const [snapshot, setSnapshot] = useState<MiniPlayerSnapshot>(readMiniPlayerSnapshot);
  const [alwaysOnTop, setAlwaysOnTop] = useState(readMiniPlayerAlwaysOnTop);
  const track = snapshot.track;
  const duration = snapshot.duration || track?.duration_seconds || 0;
  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, snapshot.currentTime / duration)) : 0;
  const progressPercent = progressRatio * 100;
  const progressFill = progressRatio > 0 ? `calc(${progressPercent}% + ${7 - progressRatio * 14}px)` : "0px";
  const artworkSrc = track ? albumArtworkUrl(track.id) : null;
  const isPodcastTrack = Boolean(track?.genre?.toLowerCase().includes("podcast"));
  const trackArtistLabel = display(track?.artist, isPodcastTrack ? "Podcast" : "Unknown artist");
  const [artworkFailed, setArtworkFailed] = useState(false);

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
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKeys.miniPlayerSnapshot) {
        setSnapshot(readMiniPlayerSnapshot());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    setArtworkFailed(false);
  }, [track?.id]);

  useEffect(() => {
    writeMiniPlayerSize(MINI_PLAYER_WIDTH, MINI_PLAYER_HEIGHT);
    void applyMiniPlayerWindowStyle(alwaysOnTop, MINI_PLAYER_WIDTH, MINI_PLAYER_HEIGHT);
  }, []);

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
    try {
      const next = !alwaysOnTop;
      await applyMiniPlayerWindowStyle(next, MINI_PLAYER_WIDTH, MINI_PLAYER_HEIGHT);
      writeMiniPlayerAlwaysOnTop(next);
      setAlwaysOnTop(next);
    } catch {
      setAlwaysOnTop((current) => {
        writeMiniPlayerAlwaysOnTop(!current);
        return !current;
      });
    }
  }

  async function applyMiniPlayerWindowStyle(nextAlwaysOnTop: boolean, width: number, height: number) {
    try {
      const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const { LogicalSize } = await import("@tauri-apps/api/dpi");
      const currentWindow = getCurrentWebviewWindow();
      await currentWindow.setAlwaysOnTop(nextAlwaysOnTop);
      await currentWindow.setSize(new LogicalSize(width, height));
    } catch {
      // Browser preview cannot resize a Tauri window.
    }
  }

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-[rgb(var(--color-mini))] text-white">
      <div className="grid h-full grid-cols-[82px_minmax(0,1fr)_92px] items-center gap-3 border border-white/5 bg-[rgb(var(--color-quiet))] p-3 shadow-2xl">
        <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-lg border border-white/10 bg-[rgb(var(--color-mini-panel))] text-moss shadow-lg shadow-black/30">
          {artworkSrc && !artworkFailed ? (
            <img alt="" className="h-full w-full object-cover" src={artworkSrc} onError={() => setArtworkFailed(true)} />
          ) : (
            <Coffee size={26} />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-[15px] font-semibold tracking-normal">{track ? display(track.title, "Untitled") : "Nothing playing"}</div>
            {track?.rating !== null && track?.rating !== undefined && (
              <span className="shrink-0 rounded-full border border-moss/40 bg-moss/10 px-2 py-0.5 text-[10px] text-moss">
                {track.rating} star
              </span>
            )}
          </div>
          {track ? (
            <div className="min-w-0 truncate text-xs text-muted">
              {trackArtistLabel}
            </div>
          ) : (
            <div className="truncate text-xs text-muted">Use the main window to start a queue</div>
          )}
          <div className="mt-3 grid grid-cols-[minmax(40px,auto)_1fr_minmax(40px,auto)] items-center gap-2 text-[11px] tabular-nums text-muted">
            <span className="text-right">{formatPlaybackTime(snapshot.currentTime)}</span>
            <input
              aria-label="Mini player position"
              className="player-progress"
              disabled={!track || duration <= 0}
              max={Math.max(duration, 0)}
              min={0}
              step={1}
              style={{ "--progress": `${progressPercent}%`, "--progress-fill": progressFill } as CSSProperties}
              type="range"
              value={duration > 0 ? Math.min(snapshot.currentTime, duration) : 0}
              onChange={(event) => sendMiniPlayerCommand({ type: "seek", seconds: Number(event.target.value) })}
              onKeyDown={(event) => {
                if (event.key !== " " && event.code !== "Space") {
                  return;
                }
                event.preventDefault();
                if (track) {
                  sendMiniPlayerCommand({ type: "playPause" });
                }
              }}
            />
            <span>{formatPlaybackTime(duration)}</span>
          </div>
        </div>
        <div className="flex h-full flex-col items-end justify-between">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 p-0.5">
            <button
              className={`icon-button h-7 w-7 ${alwaysOnTop ? "border-moss text-moss" : ""}`}
              type="button"
              title="Always on top"
              onClick={() => void toggleAlwaysOnTop()}
            >
              <ArrowUp size={13} />
            </button>
            <button className="icon-button h-7 w-7" type="button" title="Open main app" onClick={() => void restoreMainAndCloseMiniPlayer()}>
              <Library size={13} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[rgb(var(--color-mini-panel))] p-1 shadow-inner">
            <button
              className="icon-button h-8 w-8"
              type="button"
              title="Previous or restart track"
              disabled={!snapshot.hasPrevious}
              onClick={() => sendMiniPlayerCommand({ type: "previous" })}
            >
              <SkipBack size={14} />
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-full bg-ember text-ink shadow-md shadow-black/30 transition hover:bg-[rgb(var(--color-primary-hover))] disabled:opacity-50"
              type="button"
              title={snapshot.isPlaying ? "Pause" : "Play"}
              disabled={!track}
              onClick={() => sendMiniPlayerCommand({ type: "playPause" })}
            >
              {snapshot.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <button
              className="icon-button h-8 w-8"
              type="button"
              title="Next"
              disabled={!snapshot.hasNext}
              onClick={() => sendMiniPlayerCommand({ type: "next" })}
            >
              <SkipForward size={14} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

