import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect,useState } from "react";

import { placeFloatingMenu } from "../../../lib/uiInteractions";
import { closeFloatingMenus,listenForCloseFloatingMenus } from "../../menuEvents";
import {
ColumnContextMenu,
LibraryColumnDefinition,
LibraryColumnKey,
LibrarySavedColumnLayout,
MENU_VIEWPORT_MARGIN,
MetadataColumnKey,
SortKey,
defaultLibraryColumnWidths,
libraryColumnDefinitions,
libraryColumnKeySet,
librarySelectionColumnWidth,
libraryTrackColumnKeySet,
normalizeLibraryColumns,
} from "../../shared";
import {
LIBRARY_ACTIONS_MENU_HEIGHT,
LIBRARY_ACTIONS_MENU_WIDTH,
} from "./libraryViewUtils";

export function useLibraryColumnController(model: any) {
  const {
    libraryView,
    libraryVisibleColumns,
    setLibraryVisibleColumns,
    librarySavedColumnLayouts = [],
    onLibrarySavedColumnLayoutsChange,
    setSort,
    setContextMenu,
  } = model;
  const [columnWidths, setColumnWidths] = useState(defaultLibraryColumnWidths);
  const [columnMenu, setColumnMenu] = useState<ColumnContextMenu | null>(null);
  const [libraryActionsMenu, setLibraryActionsMenu] = useState<{ x: number; y: number } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<LibraryColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LibraryColumnKey | null>(null);
  const [columnLayoutName, setColumnLayoutName] = useState("");

  const visibleColumns = normalizeLibraryColumns(libraryVisibleColumns);
  const visibleMetadataColumnKeys = visibleColumns.filter((column): column is MetadataColumnKey =>
    libraryColumnKeySet.has(column as MetadataColumnKey),
  );
  const visibleColumnDefs = visibleMetadataColumnKeys
    .map((key) => libraryColumnDefinitions.find((column) => column.key === key))
    .filter((column): column is LibraryColumnDefinition => Boolean(column));
  const fixedTrackColumns: LibraryColumnKey[] = ["play", ...visibleMetadataColumnKeys];
  const orderedTrackColumns = visibleColumns;
  const tableWidth = librarySelectionColumnWidth + fixedTrackColumns.reduce((total, column) => total + columnWidths[column], 0);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
      setColumnMenu(null);
      setLibraryActionsMenu(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    const stopListeningForFloatingMenus = listenForCloseFloatingMenus(closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      stopListeningForFloatingMenus();
    };
  }, [setContextMenu]);

  function handleSort(key: SortKey) {
    setSort((current: any) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }

  function handleResize(column: string, width: number) {
    if (!(column in columnWidths)) {
      return;
    }
    setColumnWidths((current) => ({ ...current, [column as LibraryColumnKey]: width }));
  }

  function openColumnContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    closeFloatingMenus();
    setContextMenu(null);
    setLibraryActionsMenu(null);
    const placement = placeFloatingMenu({
      cursorX: event.clientX,
      cursorY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      menuWidth: 340,
      menuHeight: 520,
      margin: MENU_VIEWPORT_MARGIN,
    });
    setColumnMenu({ x: placement.x, y: placement.y });
  }

  function toggleLibraryActionsMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    closeFloatingMenus();
    setContextMenu(null);
    setColumnMenu(null);
    setLibraryActionsMenu((current) => {
      if (current) {
        return null;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const placement = placeFloatingMenu({
        cursorX: rect.right - LIBRARY_ACTIONS_MENU_WIDTH,
        cursorY: rect.bottom + 8,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        menuWidth: LIBRARY_ACTIONS_MENU_WIDTH,
        menuHeight: LIBRARY_ACTIONS_MENU_HEIGHT,
        margin: MENU_VIEWPORT_MARGIN,
      });
      return { x: placement.x, y: placement.y };
    });
  }

  function toggleVisibleColumn(column: MetadataColumnKey) {
    if (visibleColumns.includes(column) && visibleMetadataColumnKeys.length <= 1) {
      return;
    }
    setLibraryVisibleColumns(visibleColumns.includes(column) ? visibleColumns.filter((visibleColumn) => visibleColumn !== column) : [...visibleColumns, column]);
  }

  function saveColumnLayout() {
    const name = columnLayoutName.trim() || `${String(libraryView ?? "Library")} columns`;
    const normalizedName = name.toLowerCase();
    const existing = librarySavedColumnLayouts.find((layout: LibrarySavedColumnLayout) => layout.name.trim().toLowerCase() === normalizedName);
    const nextLayout: LibrarySavedColumnLayout = {
      id: existing?.id ?? `columns-${Date.now().toString(36)}`,
      name,
      columns: visibleColumns,
      view: libraryView,
      updatedAt: new Date().toISOString(),
    };
    const nextLayouts = [
      nextLayout,
      ...librarySavedColumnLayouts.filter((layout: LibrarySavedColumnLayout) => layout.id !== nextLayout.id),
    ].slice(0, 24);
    onLibrarySavedColumnLayoutsChange?.(nextLayouts);
    setColumnLayoutName("");
  }

  function applyColumnLayout(layout: LibrarySavedColumnLayout) {
    setLibraryVisibleColumns(layout.columns);
    setColumnMenu(null);
  }

  function deleteColumnLayout(layoutId: string) {
    onLibrarySavedColumnLayoutsChange?.(
      librarySavedColumnLayouts.filter((layout: LibrarySavedColumnLayout) => layout.id !== layoutId),
    );
  }

  function moveVisibleColumn(source: LibraryColumnKey, target: LibraryColumnKey, placement: "before" | "after") {
    if (source === target || source === "play" || target === "play") {
      return;
    }
    const nextColumns = [...visibleColumns];
    const sourceIndex = nextColumns.indexOf(source);
    const targetIndex = nextColumns.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    const [moved] = nextColumns.splice(sourceIndex, 1);
    const currentTargetIndex = nextColumns.indexOf(target);
    nextColumns.splice(placement === "after" ? currentTargetIndex + 1 : currentTargetIndex, 0, moved);
    setLibraryVisibleColumns(nextColumns);
  }

  function handleColumnDragStart(event: any, column: string) {
    if (column === "play" || !libraryTrackColumnKeySet.has(column as LibraryColumnKey)) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", column);
    setDraggedColumn(column as LibraryColumnKey);
    setDragOverColumn(null);
    setColumnMenu(null);
  }

  function handleColumnDragOver(event: any, column: string) {
    if (!draggedColumn || draggedColumn === column || column === "play" || !libraryTrackColumnKeySet.has(column as LibraryColumnKey)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverColumn(column as LibraryColumnKey);
  }

  function handleColumnDrop(event: any, column: string) {
    event.preventDefault();
    const source = event.dataTransfer.getData("text/plain") || draggedColumn;
    if (source && source !== "play" && column !== "play" && libraryTrackColumnKeySet.has(source as LibraryColumnKey) && libraryTrackColumnKeySet.has(column as LibraryColumnKey)) {
      const bounds = event.currentTarget.getBoundingClientRect();
      moveVisibleColumn(source as LibraryColumnKey, column as LibraryColumnKey, event.clientX > bounds.left + bounds.width / 2 ? "after" : "before");
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function handleColumnDragEnd() {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function columnFromPoint(x: number, y: number): LibraryColumnKey | null {
    const target = document.elementFromPoint(x, y) as HTMLElement | null;
    const header = target?.closest<HTMLElement>("[data-library-column]");
    const column = header?.dataset.libraryColumn;
    return column && column !== "play" && libraryTrackColumnKeySet.has(column as LibraryColumnKey) ? (column as LibraryColumnKey) : null;
  }

  function handleColumnPointerDragStart(event: ReactMouseEvent<HTMLButtonElement>, column: string) {
    if (column === "play" || !libraryTrackColumnKeySet.has(column as LibraryColumnKey)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sourceColumn = column as LibraryColumnKey;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    setDraggedColumn(sourceColumn);
    setDragOverColumn(null);
    function handleMove(moveEvent: MouseEvent) {
      const targetColumn = columnFromPoint(moveEvent.clientX, moveEvent.clientY);
      setDragOverColumn(targetColumn && targetColumn !== sourceColumn ? targetColumn : null);
    }
    function handleUp(upEvent: MouseEvent) {
      const targetColumn = columnFromPoint(upEvent.clientX, upEvent.clientY);
      if (targetColumn && targetColumn !== sourceColumn) {
        const header = document.querySelector<HTMLElement>(`[data-library-column="${targetColumn}"]`);
        const bounds = header?.getBoundingClientRect();
        moveVisibleColumn(sourceColumn, targetColumn, bounds && upEvent.clientX > bounds.left + bounds.width / 2 ? "after" : "before");
      }
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      setDraggedColumn(null);
      setDragOverColumn(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return {
    columnWidths, setColumnWidths, columnMenu, setColumnMenu, libraryActionsMenu, setLibraryActionsMenu,
    draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, visibleColumns, visibleMetadataColumnKeys, visibleColumnDefs, fixedTrackColumns, orderedTrackColumns, tableWidth,
    columnLayoutName, setColumnLayoutName, saveColumnLayout, applyColumnLayout, deleteColumnLayout,
    handleSort, handleResize, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn,
    handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart,
  };
}
