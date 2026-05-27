// @ts-nocheck
import type { MouseEvent as ReactMouseEvent } from "react";
import { placeFloatingMenu } from "../../lib/uiInteractions";
import {
  themeAccentLabels,
  themeOrder,
} from "../../config/theme";
import {
  APP_CONTEXT_MENU_HEIGHT,
  APP_CONTEXT_MENU_WIDTH,
  MENU_VIEWPORT_MARGIN,
  QUEUE_HISTORY_LIMIT,
  writeQuickStartDismissed,
} from "../shared";

export function createUiActionHandlers(model: any) {
  const {
    playbackQueue,
    setAppContextMenu,
    setCoffeeAnimating,
    setQueueHistory,
    setQuickStartDismissed,
    setStatus,
    setUiPreferences,
  } = model;

  function dismissQuickStart() {
    setQuickStartDismissed(true);
    writeQuickStartDismissed();
  }

  function handleCoffeeClick() {
    setCoffeeAnimating(false);
    window.requestAnimationFrame(() => setCoffeeAnimating(true));
    window.setTimeout(() => setCoffeeAnimating(false), 700);
  }

  function handleCycleTheme() {
    setUiPreferences((current) => {
      const currentIndex = Math.max(0, themeOrder.indexOf(current.themeAccent));
      const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
      setStatus(`Theme: ${themeAccentLabels[nextTheme]}`);
      return { ...current, themeAccent: nextTheme };
    });
  }

  function openAppContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (
      event.isDefaultPrevented() ||
      target?.closest("input, textarea, select, [contenteditable='true'], [data-allow-desktop-context='true']")
    ) {
      return;
    }
    event.preventDefault();
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: APP_CONTEXT_MENU_WIDTH,
      menuHeight: APP_CONTEXT_MENU_HEIGHT,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setAppContextMenu({ x: placement.x, y: placement.y });
  }

  function rememberQueueSnapshot(queueSnapshot = playbackQueue) {
    if (!queueSnapshot.length) {
      return;
    }
    setQueueHistory((current) => {
      const duplicateLatest =
        current[0]?.length === queueSnapshot.length &&
        current[0].every((track, index) => track.id === queueSnapshot[index]?.id);
      if (duplicateLatest) {
        return current;
      }
      return [queueSnapshot, ...current].slice(0, QUEUE_HISTORY_LIMIT);
    });
  }

  return {
    dismissQuickStart,
    handleCoffeeClick,
    handleCycleTheme,
    openAppContextMenu,
    rememberQueueSnapshot,
  };
}
