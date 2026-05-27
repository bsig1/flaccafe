import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  useMemo,
  useState,
} from "react";
import {
  ChevronDown,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  backendRouteCatalog,
  findBackendRouteCatalogEntry,
} from "../../../lib/backendRouteCatalog";
import type {
  AdvancedHttpShortcutBinding,
  HttpShortcutMethod,
  KeyboardShortcutAction,
  UiPreferences,
} from "../../shared";
import {
  formatShortcut,
  keyboardShortcutLabels,
  keyboardShortcutSignature,
  shortcutFromEvent,
} from "../../shared";

const httpMethods: HttpShortcutMethod[] = ["GET", "POST", "PATCH", "DELETE", "HEAD"];

function emptyShortcut() {
  return { key: "", ctrl: false, alt: false, shift: false };
}

function fallbackRoute() {
  return (
    backendRouteCatalog.find((entry) => entry.method === "GET" && entry.path === "/health") ??
    backendRouteCatalog[0] ?? {
      id: "GET /health",
      method: "GET" as const,
      path: "/health",
      description: "Checks that the backend is reachable.",
    }
  );
}

function newShortcutId(): string {
  return `http-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function bodyJsonError(binding: AdvancedHttpShortcutBinding): string | null {
  if (binding.method === "GET" || binding.method === "HEAD" || !binding.bodyJson.trim()) {
    return null;
  }
  try {
    JSON.parse(binding.bodyJson);
    return null;
  } catch {
    return "Body JSON is invalid";
  }
}

export function AdvancedHttpShortcutsSection({
  uiPreferences,
  setUiPreferences,
}: {
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const advancedShortcuts = uiPreferences.advancedHttpShortcuts ?? [];
  const builtInShortcutBySignature = useMemo(() => {
    const labels = new Map<string, string>();
    for (const action of Object.keys(uiPreferences.keyboardShortcuts) as KeyboardShortcutAction[]) {
      const signature = keyboardShortcutSignature(uiPreferences.keyboardShortcuts[action]);
      if (signature) {
        labels.set(signature, keyboardShortcutLabels[action]);
      }
    }
    return labels;
  }, [uiPreferences.keyboardShortcuts]);

  function updateBinding(
    id: string,
    updater: (binding: AdvancedHttpShortcutBinding) => AdvancedHttpShortcutBinding,
  ) {
    setUiPreferences((current) => ({
      ...current,
      advancedHttpShortcuts: (current.advancedHttpShortcuts ?? []).map((binding) =>
        binding.id === id ? updater(binding) : binding,
      ),
    }));
  }

  function addShortcut() {
    const route = fallbackRoute();
    setUiPreferences((current) => ({
      ...current,
      advancedHttpShortcuts: [
        ...(current.advancedHttpShortcuts ?? []),
        {
          id: newShortcutId(),
          label: route.id,
          method: route.method,
          path: route.path,
          description: route.description,
          bodyJson: "",
          shortcut: emptyShortcut(),
        },
      ],
    }));
    setIsOpen(true);
    setMessage("HTTP shortcut added");
  }

  function deleteShortcut(id: string) {
    setUiPreferences((current) => ({
      ...current,
      advancedHttpShortcuts: (current.advancedHttpShortcuts ?? []).filter((binding) => binding.id !== id),
    }));
    setCaptureId(null);
    setMessage("HTTP shortcut removed");
  }

  function applyCatalogRoute(id: string, routeId: string) {
    const route = backendRouteCatalog.find((entry) => entry.id === routeId);
    if (!route) {
      return;
    }
    updateBinding(id, (binding) => ({
      ...binding,
      label: binding.label === `${binding.method} ${binding.path}` ? route.id : binding.label,
      method: route.method,
      path: route.path,
      description: route.description,
    }));
  }

  function updateMethod(id: string, method: HttpShortcutMethod) {
    updateBinding(id, (binding) => {
      const catalog = findBackendRouteCatalogEntry(method, binding.path);
      return {
        ...binding,
        method,
        description: catalog?.description ?? binding.description,
      };
    });
  }

  function updatePath(id: string, path: string) {
    updateBinding(id, (binding) => {
      const catalog = findBackendRouteCatalogEntry(binding.method, path.trim());
      return {
        ...binding,
        path,
        description: catalog?.description ?? binding.description,
      };
    });
  }

  function captureShortcut(id: string, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (captureId !== id) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setCaptureId(null);
      setMessage("HTTP shortcut edit canceled");
      return;
    }
    const shortcut = shortcutFromEvent(event.nativeEvent);
    if (!shortcut) {
      return;
    }
    updateBinding(id, (binding) => ({ ...binding, shortcut }));
    setCaptureId(null);
    setMessage(`HTTP shortcut set to ${formatShortcut(shortcut)}`);
  }

  function shortcutWarning(binding: AdvancedHttpShortcutBinding): string | null {
    const signature = keyboardShortcutSignature(binding.shortcut);
    if (!signature) {
      return null;
    }
    const builtInLabel = builtInShortcutBySignature.get(signature);
    if (builtInLabel) {
      return `Conflicts with ${builtInLabel}`;
    }
    const duplicate = advancedShortcuts.find((other) => other.id !== binding.id && keyboardShortcutSignature(other.shortcut) === signature);
    return duplicate ? `Conflicts with ${duplicate.label || `${duplicate.method} ${duplicate.path}`}` : null;
  }

  return (
    <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          className="secondary-button h-8"
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          <ChevronDown size={14} className={isOpen ? "rotate-180" : ""} />
          Advanced HTTP
        </button>
        {isOpen && (
          <button className="secondary-button h-8" type="button" onClick={addShortcut}>
            <Plus size={14} />
            Add
          </button>
        )}
      </div>
      {message && isOpen && <div className="rounded border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-moss">{message}</div>}
      {isOpen && (
        <div className="grid gap-3">
          {advancedShortcuts.length === 0 && (
            <div className="rounded border border-line/60 bg-panel px-3 py-6 text-center text-sm text-muted">
              No advanced HTTP shortcuts.
            </div>
          )}
          {advancedShortcuts.map((binding) => {
            const routeSelectValue = findBackendRouteCatalogEntry(binding.method, binding.path)?.id ?? "";
            const warning = shortcutWarning(binding);
            const jsonError = bodyJsonError(binding);
            return (
              <div key={binding.id} className="grid gap-3 rounded border border-line/60 bg-panel p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-end">
                  <label className="grid gap-1">
                    <span className="text-xs uppercase text-muted">Name</span>
                    <input
                      className="h-9 min-w-0 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={binding.label}
                      onChange={(event) => updateBinding(binding.id, (current) => ({ ...current, label: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs uppercase text-muted">Catalog</span>
                    <select
                      className="h-9 min-w-0 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={routeSelectValue}
                      onChange={(event) => applyCatalogRoute(binding.id, event.target.value)}
                    >
                      <option value="">Custom route</option>
                      {backendRouteCatalog.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={`secondary-button h-9 justify-center font-mono text-xs ${captureId === binding.id ? "border-ember text-ember" : ""}`}
                    type="button"
                    onClick={() => {
                      setCaptureId(binding.id);
                      setMessage(null);
                    }}
                    onKeyDown={(event) => captureShortcut(binding.id, event)}
                  >
                    {captureId === binding.id ? "Press keys..." : formatShortcut(binding.shortcut)}
                  </button>
                  <button
                    className="icon-button h-9 w-9"
                    type="button"
                    title="Clear shortcut"
                    onClick={() => updateBinding(binding.id, (current) => ({ ...current, shortcut: emptyShortcut() }))}
                  >
                    <X size={14} />
                  </button>
                  <button className="icon-button h-9 w-9" type="button" title="Remove shortcut" onClick={() => deleteShortcut(binding.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-[8rem_1fr]">
                  <label className="grid gap-1">
                    <span className="text-xs uppercase text-muted">Method</span>
                    <select
                      className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={binding.method}
                      onChange={(event) => updateMethod(binding.id, event.target.value as HttpShortcutMethod)}
                    >
                      {httpMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs uppercase text-muted">Path</span>
                    <input
                      className="h-9 min-w-0 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                      value={binding.path}
                      onChange={(event) => updatePath(binding.id, event.target.value)}
                    />
                  </label>
                </div>
                {binding.description && <div className="text-xs text-muted">{binding.description}</div>}
                {binding.method !== "GET" && binding.method !== "HEAD" && (
                  <label className="grid gap-1">
                    <span className="text-xs uppercase text-muted">Body JSON</span>
                    <textarea
                      className="min-h-20 rounded border border-line bg-ink px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={binding.bodyJson}
                      placeholder='{"key":"value"}'
                      onChange={(event) => updateBinding(binding.id, (current) => ({ ...current, bodyJson: event.target.value }))}
                    />
                  </label>
                )}
                {(warning || jsonError) && (
                  <div className="rounded border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-ember">
                    {warning ?? jsonError}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
