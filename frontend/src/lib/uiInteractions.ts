export interface FloatingMenuPlacement {
  x: number;
  y: number;
  flipY: boolean;
  submenuLeft: boolean;
}

export interface FloatingMenuPlacementInput {
  cursorX: number;
  cursorY: number;
  viewportWidth: number;
  viewportHeight: number;
  menuWidth: number;
  menuHeight: number;
  submenuWidth?: number;
  margin: number;
}

export function placeFloatingMenu(input: FloatingMenuPlacementInput): FloatingMenuPlacement {
  const submenuWidth = input.submenuWidth ?? 0;
  const fitsBelow = input.cursorY + input.menuHeight + input.margin <= input.viewportHeight;
  const fitsRight = input.cursorX + input.menuWidth + submenuWidth + input.margin <= input.viewportWidth;
  const maxX = Math.max(input.margin, input.viewportWidth - input.menuWidth - input.margin);
  const maxY = Math.max(input.margin, input.viewportHeight - input.menuHeight - input.margin);

  return {
    x: Math.min(Math.max(input.margin, input.cursorX), maxX),
    y: fitsBelow
      ? Math.min(Math.max(input.margin, input.cursorY), maxY)
      : Math.max(input.margin, input.cursorY - input.menuHeight),
    flipY: !fitsBelow,
    submenuLeft: !fitsRight,
  };
}

export function toggleOrderedValue<T>(current: readonly T[], value: T, order: readonly T[]): T[] {
  const selected = new Set(current);
  if (selected.has(value)) {
    selected.delete(value);
  } else {
    selected.add(value);
  }
  return order.filter((item) => selected.has(item));
}

export function readBooleanFlag(storage: Storage, key: string, defaultValue = false): boolean {
  try {
    const value = storage.getItem(key);
    return value === null ? defaultValue : value === "true";
  } catch {
    return defaultValue;
  }
}

export function writeBooleanFlag(storage: Storage, key: string, value: boolean): void {
  try {
    storage.setItem(key, String(value));
  } catch {
    // Local UI flags are convenience state only.
  }
}

export function limitRecentItems<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, Math.max(0, limit));
}

export function settingsDiagnosticLabel(backendStatus: string, startupOk: boolean | null): string {
  if (backendStatus === "down") {
    return "backend down";
  }
  if (startupOk === false) {
    return "self-check review";
  }
  if (backendStatus === "ok" && startupOk === true) {
    return "diagnostics ok";
  }
  return "diagnostics pending";
}

export function undoBannerText(label: string): string {
  return `Removed ${label}`;
}
