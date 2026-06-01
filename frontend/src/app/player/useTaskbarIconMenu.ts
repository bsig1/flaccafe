import type { Menu } from "@tauri-apps/api/menu";
import type { TrayIcon } from "@tauri-apps/api/tray";
import { useEffect, useRef } from "react";

import type { Track } from "../../types/api";
import {
display,
formatPlaybackTime,
miniPlayerPresetFromPreferences,
miniPlayerSizeForPreset,
readUiPreferences,
} from "../shared";

const FLAC_CAFE_TRAY_ID = "flac-cafe-tray-icon";
const TASKBAR_QUEUE_LIMIT = 6;

interface TaskbarIconContext {
  currentTrack: Track | null;
  currentRadioStation: { name?: string | null } | null;
  isPlaying: boolean;
  hasPlayableSource: boolean;
  canPreviousAction: boolean;
  hasNext: boolean;
  currentTime: number;
  effectiveDuration: number;
  queue: Track[];
  currentIndex: number;
  togglePlayback: () => void | Promise<void>;
  handlePreviousTrack: () => void;
  playRelative: (delta: number) => void;
  onSelectTrack: (track: Track, queue: Track[], options?: { suppressExitRecord?: boolean }) => void;
}

function trackLabel(track: Track | null | undefined): string {
  if (!track) {
    return "Nothing playing";
  }
  const title = display(track.title, "Untitled");
  const artist = display(track.artist, "Unknown artist");
  return `${title} - ${artist}`;
}

function nowPlayingLabel(ctx: TaskbarIconContext): string {
  if (ctx.currentRadioStation) {
    return `${ctx.isPlaying ? "Live" : "Paused"}: ${display(ctx.currentRadioStation.name, "Radio stream")}`;
  }
  if (!ctx.currentTrack) {
    return "FLAC Cafe";
  }
  return `${ctx.isPlaying ? "Playing" : "Paused"}: ${trackLabel(ctx.currentTrack)}`;
}

function taskbarTitle(ctx: TaskbarIconContext): string {
  if (!ctx.currentTrack && !ctx.currentRadioStation) {
    return "FLAC Cafe";
  }
  return `FLAC Cafe - ${nowPlayingLabel(ctx)}`;
}

function taskbarTooltip(ctx: TaskbarIconContext): string {
  const lines = ["FLAC Cafe", nowPlayingLabel(ctx)];
  if (ctx.currentTrack?.album) {
    lines.push(display(ctx.currentTrack.album, ""));
  }
  if (ctx.effectiveDuration > 0) {
    lines.push(`${formatPlaybackTime(ctx.currentTime)} / ${formatPlaybackTime(ctx.effectiveDuration)}`);
  }
  return lines.filter(Boolean).join("\n");
}

async function restoreMainWindow() {
  const { Window } = await import("@tauri-apps/api/window");
  const mainWindow = await Window.getByLabel("main");
  await mainWindow?.setSkipTaskbar(false);
  await mainWindow?.unminimize();
  await mainWindow?.show();
  await mainWindow?.setFocus();
}

async function openMiniPlayerWindow() {
  const [{ WebviewWindow }, { Window }] = await Promise.all([
    import("@tauri-apps/api/webviewWindow"),
    import("@tauri-apps/api/window"),
  ]);
  const mainWindow = await Window.getByLabel("main");
  const existing = await WebviewWindow.getByLabel("mini-player");
  if (existing) {
    await mainWindow?.setSkipTaskbar(true);
    await mainWindow?.hide();
    await existing.setFocus();
    return;
  }
  const miniPrefs = readUiPreferences();
  const miniPreset = miniPlayerPresetFromPreferences(miniPrefs);
  const miniSize = miniPlayerSizeForPreset(miniPreset, false);
  const miniWindow = new WebviewWindow("mini-player", {
    title: "FLAC Cafe Mini Player",
    url: "/index.html?miniPlayer=1",
    width: miniSize.width,
    height: miniSize.height,
    minWidth: 300,
    minHeight: 92,
    resizable: false,
    maximizable: false,
    decorations: true,
  });
  miniWindow.once("tauri://created", () => {
    void mainWindow?.setSkipTaskbar(true);
    void mainWindow?.hide();
  });
  miniWindow.once("tauri://destroyed", () => {
    void mainWindow?.setSkipTaskbar(false);
    void mainWindow?.show();
    void mainWindow?.setFocus();
  });
}

async function loadTrayIcon() {
  try {
    const { Image } = await import("@tauri-apps/api/image");
    const response = await fetch("/icon.png");
    const bytes = await response.arrayBuffer();
    return await Image.fromBytes(bytes);
  } catch {
    return null;
  }
}

export function useTaskbarIconMenu(ctx: TaskbarIconContext) {
  const trayRef = useRef<TrayIcon | null>(null);
  const trayPromiseRef = useRef<Promise<TrayIcon | null> | null>(null);
  const menuRef = useRef<Menu | null>(null);

  async function ensureTrayIcon() {
    if (trayRef.current) {
      return trayRef.current;
    }
    if (trayPromiseRef.current) {
      return trayPromiseRef.current;
    }
    trayPromiseRef.current = (async () => {
      try {
        const { TrayIcon } = await import("@tauri-apps/api/tray");
        const existing = await TrayIcon.getById(FLAC_CAFE_TRAY_ID);
        const icon = await loadTrayIcon();
        const tray =
          existing ??
          await TrayIcon.new({
            id: FLAC_CAFE_TRAY_ID,
            icon: icon ?? undefined,
            tooltip: "FLAC Cafe",
            showMenuOnLeftClick: false,
            action: (event) => {
              if (event.type === "DoubleClick" || (event.type === "Click" && event.button === "Left" && event.buttonState === "Up")) {
                void restoreMainWindow().catch(() => {});
              }
            },
          });
        if (existing && icon) {
          await tray.setIcon(icon);
        }
        await tray.setVisible(true);
        trayRef.current = tray;
        return tray;
      } catch (error) {
        console.warn("FLAC Cafe tray icon is unavailable.", error);
        return null;
      }
    })();
    return trayPromiseRef.current;
  }

  useEffect(() => {
    void ensureTrayIcon();
    return () => {
      const tray = trayRef.current;
      trayRef.current = null;
      trayPromiseRef.current = null;
      menuRef.current?.close().catch(() => {});
      menuRef.current = null;
      void tray;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ Window }, tray] = await Promise.all([import("@tauri-apps/api/window"), ensureTrayIcon()]);
      const title = taskbarTitle(ctx);
      await Window.getByLabel("main").then((window) => window?.setTitle(title)).catch(() => {});
      await Window.getByLabel("mini-player").then((window) => window?.setTitle(title)).catch(() => {});
      if (cancelled || !tray) {
        return;
      }
      await tray.setTooltip(taskbarTooltip(ctx)).catch(() => {});
      await tray.setTitle(ctx.isPlaying ? "Playing" : null).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.currentTrack, ctx.currentRadioStation, ctx.isPlaying, ctx.currentTime, ctx.effectiveDuration]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tray = await ensureTrayIcon();
      if (!tray || cancelled) {
        return;
      }
      const { Menu } = await import("@tauri-apps/api/menu");
      const queueStart = Math.max(0, ctx.currentIndex);
      const visibleQueue = ctx.queue.slice(queueStart, queueStart + TASKBAR_QUEUE_LIMIT);
      const menu = await Menu.new({
        items: [
          { text: nowPlayingLabel(ctx), enabled: false },
          ctx.currentTrack?.album ? { text: display(ctx.currentTrack.album, ""), enabled: false } : null,
          { item: "Separator" },
          {
            text: ctx.isPlaying ? "Pause" : "Play",
            enabled: ctx.hasPlayableSource,
            action: () => void ctx.togglePlayback(),
          },
          {
            text: "Previous / Restart",
            enabled: ctx.canPreviousAction,
            action: () => ctx.handlePreviousTrack(),
          },
          {
            text: "Next",
            enabled: ctx.hasNext,
            action: () => ctx.playRelative(1),
          },
          { item: "Separator" },
          visibleQueue.length
            ? {
                text: "Queue",
                items: visibleQueue.map((track, offset) => {
                  const index = queueStart + offset;
                  return {
                    text: `${index === ctx.currentIndex ? "Now: " : ""}${trackLabel(track)}`,
                    enabled: index !== ctx.currentIndex,
                    action: () => ctx.onSelectTrack(track, ctx.queue, { suppressExitRecord: true }),
                  };
                }),
              }
            : null,
          visibleQueue.length ? { item: "Separator" } : null,
          {
            text: "Open FLAC Cafe",
            action: () => void restoreMainWindow().catch(() => {}),
          },
          {
            text: "Open Mini Player",
            action: () => void openMiniPlayerWindow().catch(() => {}),
          },
          { item: "Separator" },
          {
            text: "Quit FLAC Cafe",
            action: () => {
              void import("@tauri-apps/api/core")
                .then(({ invoke }) => invoke("quit_app"))
                .catch(() => {});
            },
          },
        ].filter(Boolean) as NonNullable<Parameters<typeof Menu.new>[0]>["items"],
      });
      if (cancelled) {
        await menu.close().catch(() => {});
        return;
      }
      const previousMenu = menuRef.current;
      await tray.setMenu(menu);
      menuRef.current = menu;
      await previousMenu?.close().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ctx.currentTrack,
    ctx.currentRadioStation,
    ctx.isPlaying,
    ctx.hasPlayableSource,
    ctx.canPreviousAction,
    ctx.hasNext,
    ctx.queue,
    ctx.currentIndex,
    ctx.togglePlayback,
    ctx.handlePreviousTrack,
    ctx.playRelative,
    ctx.onSelectTrack,
  ]);
}
