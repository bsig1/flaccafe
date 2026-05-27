import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useState } from "react";

import { placeFloatingMenu } from "../../../lib/uiInteractions";
import {
  ColumnContextMenu,
  LibraryColumnDefinition,
  LibraryColumnKey,
  MENU_VIEWPORT_MARGIN,
  MetadataColumnKey,
  SortKey,
  defaultLibraryColumnWidths,
  libraryColumnDefinitions,
  libraryColumnKeySet,
  librarySelectionColumnWidth,
  normalizeLibraryColumns,
} from "../../shared";
import {
  LIBRARY_ACTIONS_MENU_HEIGHT,
  LIBRARY_ACTIONS_MENU_WIDTH,
} from "./libraryViewUtils";

export function useLibraryColumnController(model: any) {
  const { libraryVisibleColumns, setLibraryVisibleColumns, setSort, setContextMenu } = model;
  const [columnWidths, setColumnWidths] = useState(defaultLibraryColumnWidths);
  const [columnMenu, setColumnMenu] = useState<ColumnContextMenu | null>(null);
  const [libraryActionsMenu, setLibraryActionsMenu] = useState<{ x: number; y: number } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<MetadataColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<MetadataColumnKey | null>(null);

  const visibleColumns = normalizeLibraryColumns(libraryVisibleColumns);
  const visibleColumnDefs = visibleColumns
    .map((key) => libraryColumnDefinitions.find((column) => column.key === key))
    .filter((column): column is LibraryColumnDefinition => Boolean(column));
  const tableWidth = librarySelectionColumnWidth + columnWidths.play + visibleColumnDefs.reduce((total, column) => total + columnWidths[column.key], 0);

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
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
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
    if (visibleColumns.includes(column) && visibleColumns.length <= 1) {
      return;
    }
    setLibraryVisibleColumns(visibleColumns.includes(column) ? visibleColumns.filter((visibleColumn) => visibleColumn !== column) : [...visibleColumns, column]);
  }

  function moveVisibleColumn(source: MetadataColumnKey, target: MetadataColumnKey, placement: "before" | "after") {
    if (source === target) {
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
    if (!libraryColumnKeySet.has(column as MetadataColumnKey)) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", column);
    setDraggedColumn(column as MetadataColumnKey);
    setDragOverColumn(null);
    setColumnMenu(null);
  }

  function handleColumnDragOver(event: any, column: string) {
    if (!draggedColumn || draggedColumn === column || !libraryColumnKeySet.has(column as MetadataColumnKey)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverColumn(column as MetadataColumnKey);
  }

  function handleColumnDrop(event: any, column: string) {
    event.preventDefault();
    const source = event.dataTransfer.getData("text/plain") || draggedColumn;
    if (source && libraryColumnKeySet.has(source as MetadataColumnKey) && libraryColumnKeySet.has(column as MetadataColumnKey)) {
      const bounds = event.currentTarget.getBoundingClientRect();
      moveVisibleColumn(source as MetadataColumnKey, column as MetadataColumnKey, event.clientX > bounds.left + bounds.width / 2 ? "after" : "before");
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function handleColumnDragEnd() {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function columnFromPoint(x: number, y: number): MetadataColumnKey | null {
    const target = document.elementFromPoint(x, y) as HTMLElement | null;
    const header = target?.closest<HTMLElement>("[data-library-column]");
    const column = header?.dataset.libraryColumn;
    return column && libraryColumnKeySet.has(column as MetadataColumnKey) ? (column as MetadataColumnKey) : null;
  }

  function handleColumnPointerDragStart(event: ReactMouseEvent<HTMLButtonElement>, column: string) {
    if (!libraryColumnKeySet.has(column as MetadataColumnKey)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sourceColumn = column as MetadataColumnKey;
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
    draggedColumn, setDraggedColumn, dragOverColumn, setDragOverColumn, visibleColumns, visibleColumnDefs, tableWidth,
    handleSort, handleResize, openColumnContextMenu, toggleLibraryActionsMenu, toggleVisibleColumn, moveVisibleColumn,
    handleColumnDragStart, handleColumnDragOver, handleColumnDrop, handleColumnDragEnd, columnFromPoint, handleColumnPointerDragStart,
  };
}
