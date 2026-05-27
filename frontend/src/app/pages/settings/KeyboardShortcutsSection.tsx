import type {
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  useMemo,
  useState,
} from "react";
import {
  Download,
  FileText,
  Keyboard,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import {
  DisclosureSection,
} from "../../components/common";
import { AdvancedHttpShortcutsSection } from "./AdvancedHttpShortcutsSection";
import {
  KeyboardShortcutAction,
  UiPreferences,
  defaultKeyboardShortcuts,
  formatShortcut,
  keyboardShortcutGroups,
  keyboardShortcutLabels,
  normalizeKeyboardShortcuts,
  shortcutConflictGroups,
  shortcutFromEvent,
} from "../../shared";

export function KeyboardShortcutsSection({
  uiPreferences,
  setUiPreferences,
}: {
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
}) {
  const [shortcutCaptureAction, setShortcutCaptureAction] = useState<KeyboardShortcutAction | null>(null);
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null);
  const [shortcutPresetJson, setShortcutPresetJson] = useState("");
  const [shortcutSearch, setShortcutSearch] = useState("");
  const shortcutConflicts = shortcutConflictGroups(uiPreferences.keyboardShortcuts);
  const shortcutQuery = shortcutSearch.trim().toLowerCase();
  const visibleShortcutGroups = useMemo(
    () =>
      keyboardShortcutGroups
        .map((group) => ({
          ...group,
          actions: group.actions.filter((action) => {
            if (!shortcutQuery) {
              return true;
            }
            const shortcut = uiPreferences.keyboardShortcuts[action];
            return [
              group.title,
              keyboardShortcutLabels[action],
              formatShortcut(shortcut),
              shortcut.key,
            ]
              .join(" ")
              .toLowerCase()
              .includes(shortcutQuery);
          }),
        }))
        .filter((group) => group.actions.length > 0),
    [shortcutQuery, uiPreferences.keyboardShortcuts],
  );

  function updateShortcut(action: KeyboardShortcutAction, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (shortcutCaptureAction !== action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setShortcutCaptureAction(null);
      setShortcutMessage("Shortcut edit canceled");
      return;
    }
    const shortcut = shortcutFromEvent(event.nativeEvent);
    if (!shortcut) {
      return;
    }
    setUiPreferences((current) => ({
      ...current,
      keyboardShortcuts: {
        ...current.keyboardShortcuts,
        [action]: shortcut,
      },
    }));
    setShortcutCaptureAction(null);
    setShortcutMessage(`${keyboardShortcutLabels[action]} set to ${formatShortcut(shortcut)}`);
  }

  function resetShortcut(action: KeyboardShortcutAction) {
    setUiPreferences((current) => ({
      ...current,
      keyboardShortcuts: {
        ...current.keyboardShortcuts,
        [action]: defaultKeyboardShortcuts[action],
      },
    }));
    setShortcutCaptureAction(null);
    setShortcutMessage(`${keyboardShortcutLabels[action]} reset`);
  }

  function clearShortcut(action: KeyboardShortcutAction) {
    setUiPreferences((current) => ({
      ...current,
      keyboardShortcuts: {
        ...current.keyboardShortcuts,
        [action]: { key: "", ctrl: false, alt: false, shift: false },
      },
    }));
    setShortcutCaptureAction(null);
    setShortcutMessage(`${keyboardShortcutLabels[action]} cleared`);
  }

  function resetAllShortcuts() {
    setUiPreferences((current) => ({ ...current, keyboardShortcuts: defaultKeyboardShortcuts }));
    setShortcutCaptureAction(null);
    setShortcutMessage("Keyboard shortcuts reset");
  }

  function exportShortcutPreset() {
    setShortcutPresetJson(JSON.stringify(uiPreferences.keyboardShortcuts, null, 2));
    setShortcutMessage("Shortcut preset exported below");
  }

  function importShortcutPreset() {
    try {
      const parsed = JSON.parse(shortcutPresetJson);
      setUiPreferences((current) => ({
        ...current,
        keyboardShortcuts: normalizeKeyboardShortcuts(parsed),
      }));
      setShortcutMessage("Shortcut preset imported");
    } catch (error) {
      setShortcutMessage(error instanceof Error ? error.message : "Could not import shortcut preset");
    }
  }

  return (
    <DisclosureSection title="Keyboard Shortcuts" description="Page navigation and local playback controls">
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Keyboard className="shrink-0 text-muted" size={18} />
            <div className="min-w-0">
              <div className="font-medium text-white">Shortcut editor</div>
              <div className="text-xs text-muted">Click a shortcut, then press the replacement keys. Escape cancels.</div>
            </div>
          </div>
          <button className="secondary-button shrink-0" type="button" onClick={resetAllShortcuts}>
            <RotateCcw size={15} />
            Reset All
          </button>
        </div>
        <label className="grid gap-2">
          <span className="text-xs uppercase text-muted">Search Shortcuts</span>
          <div className="flex h-9 items-center gap-2 rounded border border-line bg-ink px-3 ring-moss/40 focus-within:ring-2">
            <Search size={15} className="shrink-0 text-muted" />
            <input
              className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-muted"
              value={shortcutSearch}
              placeholder="Find pages, playback, lyrics, queue, unassigned..."
              onChange={(event) => setShortcutSearch(event.target.value)}
            />
            {shortcutSearch && (
              <button
                className="icon-button h-7 w-7 shrink-0"
                type="button"
                title="Clear shortcut search"
                onClick={() => setShortcutSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </label>
        {shortcutMessage && <div className="rounded border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-moss">{shortcutMessage}</div>}
        {shortcutConflicts.length > 0 && (
          <div className="rounded border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-ember">
            Conflicts:{" "}
            {shortcutConflicts
              .map((actions) => actions.map((action) => keyboardShortcutLabels[action]).join(" / "))
              .join("; ")}
          </div>
        )}
        <div className="grid gap-2 rounded border border-line/70 bg-ink p-3">
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button h-8" type="button" onClick={exportShortcutPreset}>
              <Download size={14} />
              Export Preset
            </button>
            <button className="secondary-button h-8" type="button" onClick={importShortcutPreset}>
              <FileText size={14} />
              Import Preset
            </button>
          </div>
          <textarea
            className="min-h-20 rounded border border-line bg-panel px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
            value={shortcutPresetJson}
            placeholder="Shortcut preset JSON"
            onChange={(event) => setShortcutPresetJson(event.target.value)}
          />
        </div>
        <AdvancedHttpShortcutsSection uiPreferences={uiPreferences} setUiPreferences={setUiPreferences} />
        <div className="max-h-[34rem] overflow-auto rounded border border-line/70 bg-ink p-3 pr-2">
          <div className="grid gap-3">
            {visibleShortcutGroups.map((group) => (
              <div key={group.title} className="grid gap-2">
                <div className="border-b border-line/60 py-2 text-xs font-medium uppercase text-muted">{group.title}</div>
                <div className="grid gap-2">
                  {group.actions.map((action) => (
                    <div key={action} className="grid gap-2 rounded border border-line/60 bg-panel px-3 py-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                      <span className="min-w-0 truncate text-neutral-200">{keyboardShortcutLabels[action]}</span>
                      <button
                        className={`secondary-button h-8 min-w-32 justify-center font-mono text-xs ${shortcutCaptureAction === action ? "border-ember text-ember" : ""}`}
                        type="button"
                        onClick={() => {
                          setShortcutCaptureAction(action);
                          setShortcutMessage(null);
                        }}
                        onKeyDown={(event) => updateShortcut(action, event)}
                      >
                        {shortcutCaptureAction === action ? "Press keys..." : formatShortcut(uiPreferences.keyboardShortcuts[action])}
                      </button>
                      <button className="icon-button h-8 w-8" type="button" title="Clear shortcut" onClick={() => clearShortcut(action)}>
                        <X size={14} />
                      </button>
                      <button className="icon-button h-8 w-8" type="button" title="Reset shortcut" onClick={() => resetShortcut(action)}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {visibleShortcutGroups.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted">
                No shortcuts match that search.
              </div>
            )}
          </div>
        </div>
      </div>
    </DisclosureSection>
  );
}
