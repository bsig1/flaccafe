import {
Search,
X,
} from "lucide-react";
import {
useEffect,
useMemo,
useRef,
useState,
} from "react";

import type { SidebarSearchTarget } from "./sidebarSearch";
import {
buildStaticSidebarSearchTargets,
searchLibrarySidebarTargets,
searchSidebarTargets,
} from "./sidebarSearch";

export function CommandPalette({
  open,
  showCdPage,
  onClose,
  onOpenTarget,
}: {
  open: boolean;
  showCdPage: boolean;
  onClose: () => void;
  onOpenTarget: (target: SidebarSearchTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [libraryResults, setLibraryResults] = useState<SidebarSearchTarget[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const staticTargets = useMemo(() => buildStaticSidebarSearchTargets(showCdPage), [showCdPage]);
  const staticResults = useMemo(
    () => query.trim()
      ? searchSidebarTargets(staticTargets, query, 8).map((result) => result.target)
      : staticTargets.slice(0, 12),
    [query, staticTargets],
  );
  const results = useMemo(() => {
    const seen = new Set<string>();
    return [...libraryResults, ...staticResults].filter((target) => {
      if (seen.has(target.key)) {
        return false;
      }
      seen.add(target.key);
      return true;
    }).slice(0, 14);
  }, [libraryResults, staticResults]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLibraryResults([]);
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      setLibraryResults([]);
      return;
    }
    void searchLibrarySidebarTargets(trimmed).then((matches) => {
      if (!cancelled) {
        setLibraryResults(matches.map((match) => match.target));
      }
    }).catch(() => {
      if (!cancelled) {
        setLibraryResults([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  if (!open) {
    return null;
  }

  function choose(target: SidebarSearchTarget) {
    onOpenTarget(target);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 px-4 py-20" onMouseDown={onClose}>
      <div
        className="mx-auto grid w-full max-w-2xl overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3">
          <Search size={17} className="text-muted" />
          <input
            ref={inputRef}
            className="h-9 min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-muted"
            value={query}
            placeholder="Command palette"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              } else if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                choose(results[0]);
              }
            }}
          />
          <button className="icon-button h-8 w-8" type="button" title="Close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto py-2">
          {results.map((target) => {
            const Icon = target.icon;
            return (
              <button
                key={target.key}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-2 text-left transition hover:bg-white/10"
                type="button"
                onClick={() => choose(target)}
              >
                <Icon size={16} className="text-moss" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{target.label}</span>
                  <span className="block truncate text-xs text-muted">{target.description}</span>
                </span>
              </button>
            );
          })}
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted">No matching command.</div>
          )}
        </div>
      </div>
    </div>
  );
}
