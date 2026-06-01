import {
defaultKeyboardShortcuts,
defaultLibraryVisibleColumns,
libraryColumnKeySet,
libraryTrackColumnKeySet,
} from "./constants";
import type {
AdvancedHttpShortcutBinding,
HttpShortcutMethod,
KeyboardShortcut,
KeyboardShortcutAction,
LibraryColumnKey,
MetadataColumnKey,
} from "./types";

export function normalizeLibraryColumns(value: unknown): LibraryColumnKey[] {
  const source = Array.isArray(value) ? value : defaultLibraryVisibleColumns;
  const cleaned = source.filter((column): column is LibraryColumnKey => libraryTrackColumnKeySet.has(column as LibraryColumnKey));
  const unique = Array.from(new Set(cleaned));
  const metadataColumns = unique.filter((column): column is MetadataColumnKey => libraryColumnKeySet.has(column as MetadataColumnKey));
  if (metadataColumns.length === 0) {
    return defaultLibraryVisibleColumns;
  }
  return unique.includes("play") ? unique : ["play", ...unique];
}

export function normalizeKeyboardShortcuts(value: unknown): Record<KeyboardShortcutAction, KeyboardShortcut> {
  const parsed = typeof value === "object" && value !== null ? (value as Partial<Record<KeyboardShortcutAction, Partial<KeyboardShortcut>>>) : {};
  const normalized = { ...defaultKeyboardShortcuts };
  for (const action of Object.keys(defaultKeyboardShortcuts) as KeyboardShortcutAction[]) {
    const shortcut = parsed[action];
    if (!shortcut || typeof shortcut.key !== "string") {
      continue;
    }
    normalized[action] = {
      key: shortcut.key.trim(),
      ctrl: Boolean(shortcut.ctrl),
      alt: Boolean(shortcut.alt),
      shift: Boolean(shortcut.shift),
    };
  }
  return normalized;
}

const httpShortcutMethods = new Set<HttpShortcutMethod>(["GET", "POST", "PATCH", "DELETE", "HEAD"]);

export function normalizeAdvancedHttpShortcuts(value: unknown): AdvancedHttpShortcutBinding[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item, index): AdvancedHttpShortcutBinding | null => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const parsed = item as Partial<AdvancedHttpShortcutBinding>;
      const method = typeof parsed.method === "string" ? parsed.method.toUpperCase() : "";
      const path = typeof parsed.path === "string" ? parsed.path.trim() : "";
      const shortcut = parsed.shortcut;
      if (!httpShortcutMethods.has(method as HttpShortcutMethod) || !path.startsWith("/") || !shortcut || typeof shortcut.key !== "string") {
        return null;
      }
      return {
        id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id.trim() : `http-${index}`,
        label: typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim().slice(0, 80) : `${method} ${path}`,
        method: method as HttpShortcutMethod,
        path,
        description: typeof parsed.description === "string" ? parsed.description.trim().slice(0, 240) : "",
        bodyJson: typeof parsed.bodyJson === "string" ? parsed.bodyJson : "",
        shortcut: {
          key: shortcut.key.trim(),
          ctrl: Boolean(shortcut.ctrl),
          alt: Boolean(shortcut.alt),
          shift: Boolean(shortcut.shift),
        },
      };
    })
    .filter((shortcut): shortcut is AdvancedHttpShortcutBinding => Boolean(shortcut))
    .slice(0, 24);
}

export function keyboardEventKey(event: Pick<KeyboardEvent, "key" | "code">): string {
  if (event.code === "Space" || event.key === " ") {
    return "Space";
  }
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

export function shortcutMatchesEvent(shortcut: KeyboardShortcut, event: KeyboardEvent): boolean {
  if (!shortcut.key.trim()) {
    return false;
  }
  return (
    keyboardEventKey(event) === (shortcut.key.length === 1 ? shortcut.key.toLowerCase() : shortcut.key) &&
    event.ctrlKey === shortcut.ctrl &&
    event.altKey === shortcut.alt &&
    event.shiftKey === shortcut.shift &&
    !event.metaKey
  );
}

export function shortcutFromEvent(event: KeyboardEvent): KeyboardShortcut | null {
  const key = keyboardEventKey(event);
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) {
    return null;
  }
  return {
    key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  };
}

export function formatShortcut(shortcut: KeyboardShortcut): string {
  if (!shortcut.key.trim()) {
    return "Unassigned";
  }
  return [
    shortcut.ctrl ? "Ctrl" : null,
    shortcut.alt ? "Alt" : null,
    shortcut.shift ? "Shift" : null,
    shortcut.key === " " ? "Space" : shortcut.key,
  ]
    .filter(Boolean)
    .join(" + ");
}

export function keyboardShortcutSignature(shortcut: KeyboardShortcut): string {
  if (!shortcut.key.trim()) {
    return "";
  }
  return `${shortcut.ctrl ? "1" : "0"}${shortcut.alt ? "1" : "0"}${shortcut.shift ? "1" : "0"}:${shortcut.key.toLowerCase()}`;
}

export function shortcutConflictGroups(shortcuts: Record<KeyboardShortcutAction, KeyboardShortcut>): KeyboardShortcutAction[][] {
  const bySignature = new Map<string, KeyboardShortcutAction[]>();
  for (const action of Object.keys(shortcuts) as KeyboardShortcutAction[]) {
    const signature = keyboardShortcutSignature(shortcuts[action]);
    if (!signature) {
      continue;
    }
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), action]);
  }
  return Array.from(bySignature.values()).filter((actions) => actions.length > 1);
}
