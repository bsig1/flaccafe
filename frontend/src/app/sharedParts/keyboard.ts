import type { FontChoice, ThemeAccent } from "../../config/theme";
import type {
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AutoDjSettings,
  ClapInstallProgress,
  QueueTrack,
  RecommendationDrift,
  Track,
} from "../../types/api";
import type {
  KeyboardShortcut,
  KeyboardShortcutAction,
  MetadataColumnKey,
} from "./types";
import {
  defaultKeyboardShortcuts,
  defaultLibraryVisibleColumns,
  libraryColumnKeySet,
} from "./constants";

export function normalizeLibraryColumns(value: unknown): MetadataColumnKey[] {
  if (!Array.isArray(value)) {
    return defaultLibraryVisibleColumns;
  }

  const cleaned = value.filter((column): column is MetadataColumnKey => libraryColumnKeySet.has(column as MetadataColumnKey));
  const unique = Array.from(new Set(cleaned));
  return unique.length > 0 ? unique : defaultLibraryVisibleColumns;
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
