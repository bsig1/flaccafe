import type { ReactNode } from "react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Search,
  X,
} from "lucide-react";

import {
  buildStaticSidebarSearchTargets,
  searchLibrarySidebarTargets,
  searchSidebarTargets,
  type ScoredSidebarSearchTarget,
  type SidebarSearchTarget,
} from "./sidebarSearch";

function searchResultCategory(target: SidebarSearchTarget) {
  if (target.kind === "fileManagement") {
    return "File Tool";
  }
  if (target.kind === "settings") {
    return "Setting";
  }
  return target.kind.charAt(0).toUpperCase() + target.kind.slice(1);
}

export function SidebarMasterSearch({
  enabled,
  showCdPage,
  librarySearchEnabled,
  onOpenSearchTarget,
  children,
}: {
  enabled: boolean;
  showCdPage: boolean;
  librarySearchEnabled: boolean;
  onOpenSearchTarget: (target: SidebarSearchTarget, query: string) => void;
  children: ReactNode;
}) {
  const [masterSearch, setMasterSearch] = useState("");
  const [librarySearchResults, setLibrarySearchResults] = useState<ScoredSidebarSearchTarget[]>([]);
  const [librarySearchLoading, setLibrarySearchLoading] = useState(false);
  const masterSearchQuery = masterSearch.trim();
  const staticSearchTargets = useMemo(() => buildStaticSidebarSearchTargets(showCdPage), [showCdPage]);
  const staticSearchResults = useMemo(
    () => searchSidebarTargets(staticSearchTargets, masterSearchQuery, 12),
    [masterSearchQuery, staticSearchTargets],
  );
  const masterSearchResults = useMemo(
    () =>
      [...staticSearchResults, ...librarySearchResults]
        .sort((left, right) => right.score - left.score || left.target.label.localeCompare(right.target.label))
        .slice(0, 18),
    [librarySearchResults, staticSearchResults],
  );

  useEffect(() => {
    if (!enabled || !librarySearchEnabled || masterSearchQuery.length < 2) {
      setLibrarySearchResults([]);
      setLibrarySearchLoading(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLibrarySearchLoading(true);
      void searchLibrarySidebarTargets(masterSearchQuery)
        .then((results) => {
          if (!cancelled) {
            setLibrarySearchResults(results);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLibrarySearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLibrarySearchLoading(false);
          }
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [enabled, librarySearchEnabled, masterSearchQuery]);

  function openSearchTarget(target: SidebarSearchTarget) {
    onOpenSearchTarget(target, masterSearchQuery);
    setMasterSearch("");
  }

  function renderSearchResult(result: ScoredSidebarSearchTarget) {
    const { target } = result;
    const Icon = target.icon;
    return (
      <button
        key={target.key}
        type="button"
        className="flex min-h-11 items-center gap-3 rounded px-3 py-2 text-left text-sm text-muted transition hover:bg-white/5 hover:text-white"
        onClick={() => openSearchTarget(target)}
      >
        <Icon size={16} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-neutral-100">{target.label}</span>
          <span className="block truncate text-[11px] text-muted">
            {searchResultCategory(target)} - {target.description}
          </span>
        </span>
      </button>
    );
  }

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="border-b border-line/70 px-3 py-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
          <input
            className="h-9 w-full rounded border border-line bg-ink pl-9 pr-8 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
            value={masterSearch}
            placeholder="Master Search"
            onChange={(event) => setMasterSearch(event.target.value)}
          />
          {masterSearch && (
            <button
              className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-white/10 hover:text-white"
              type="button"
              title="Clear search"
              onClick={() => setMasterSearch("")}
            >
              <X size={13} />
            </button>
          )}
        </label>
      </div>
      {masterSearchQuery ? (
        <nav className="flex flex-1 flex-col gap-1 overflow-auto px-3 py-3">
          {masterSearchResults.map(renderSearchResult)}
          {librarySearchLoading && <div className="px-3 py-2 text-xs text-muted">Searching library...</div>}
          {!librarySearchLoading && masterSearchResults.length === 0 && (
            <div className="rounded border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
              No matches.
            </div>
          )}
        </nav>
      ) : (
        children
      )}
    </>
  );
}
