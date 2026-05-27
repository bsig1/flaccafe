import type { PointerEvent as ReactPointerEvent } from "react";
import type { DragGhost } from "./types";

export function beginPointerReorderDrag({
  event,
  fromIndex,
  onHover,
  onCommit,
  onPosition,
}: {
  event: ReactPointerEvent<HTMLElement>;
  fromIndex: number;
  onHover: (index: number | null) => void;
  onCommit: (fromIndex: number, toIndex: number) => void;
  onPosition?: (position: { x: number; y: number } | null) => void;
}) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  let overIndex = fromIndex;
  onHover(fromIndex);
  onPosition?.({ x: event.clientX, y: event.clientY });
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is best-effort; document hit-testing below still handles the drag.
  }

  // Hit-test by data attribute instead of relying on drag events; WebView drag/drop is inconsistent in dense tables.
  function updateOverIndex(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const row = element?.closest<HTMLElement>("[data-reorder-index]");
    if (!row) {
      return;
    }
    const nextIndex = Number(row.dataset.reorderIndex);
    if (!Number.isInteger(nextIndex)) {
      return;
    }
    overIndex = nextIndex;
    onHover(nextIndex);
  }

  function cleanup() {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleCancel);
  }

  function handleMove(pointerEvent: PointerEvent) {
    onPosition?.({ x: pointerEvent.clientX, y: pointerEvent.clientY });
    updateOverIndex(pointerEvent.clientX, pointerEvent.clientY);
  }

  function handleUp(pointerEvent: PointerEvent) {
    onPosition?.({ x: pointerEvent.clientX, y: pointerEvent.clientY });
    updateOverIndex(pointerEvent.clientX, pointerEvent.clientY);
    cleanup();
    onHover(null);
    onPosition?.(null);
    if (overIndex !== fromIndex) {
      onCommit(fromIndex, overIndex);
    }
  }

  function handleCancel() {
    cleanup();
    onHover(null);
    onPosition?.(null);
  }

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleCancel);
}
