import {
  Search,
  X,
} from "lucide-react";

import type {
  BulkLyricsProgress,
  BulkLyricsSaveLocation,
} from "../../../types/api";

export function BulkLyricsLookupCard({
  bulkLyricsProgress,
  bulkLyricsOnlyMissing,
  bulkLyricsLimit,
  bulkLyricsSaveLocation,
  isStartingBulkLyrics,
  onBulkLyricsOnlyMissingChange,
  onBulkLyricsLimitChange,
  onBulkLyricsSaveLocationChange,
  onStartBulkLyrics,
  onCancelBulkLyrics,
}: {
  bulkLyricsProgress: BulkLyricsProgress | null;
  bulkLyricsOnlyMissing: boolean;
  bulkLyricsLimit: string;
  bulkLyricsSaveLocation: BulkLyricsSaveLocation;
  isStartingBulkLyrics: boolean;
  onBulkLyricsOnlyMissingChange: (value: boolean) => void;
  onBulkLyricsLimitChange: (value: string) => void;
  onBulkLyricsSaveLocationChange: (value: BulkLyricsSaveLocation) => void;
  onStartBulkLyrics: () => void;
  onCancelBulkLyrics: () => void;
}) {
  const bulkLyricsActive = Boolean(
    bulkLyricsProgress && ["pending", "scanning", "cancelling"].includes(bulkLyricsProgress.status),
  );
  const bulkLyricsReady =
    (bulkLyricsProgress?.already_cached ?? 0) +
    (bulkLyricsProgress?.embedded_found ?? 0) +
    (bulkLyricsProgress?.online_found ?? 0);

  return (
    <div className="rounded border border-line/70 bg-ink p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-white">Bulk lyric lookup</div>
          <div className="mt-1 text-xs text-muted">Preloads embedded lyrics and fills missing songs from LRCLIB.</div>
        </div>
        <span className="shrink-0 rounded border border-line bg-panel px-2 py-1 text-xs uppercase text-muted">
          {bulkLyricsProgress?.status ?? "idle"}
        </span>
      </div>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_minmax(8rem,10rem)]">
        <label className="flex min-w-0 items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2">
          <span className="text-xs text-muted">Only missing lyrics</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-moss"
            checked={bulkLyricsOnlyMissing}
            disabled={bulkLyricsActive}
            onChange={(event) => onBulkLyricsOnlyMissingChange(event.target.checked)}
          />
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-xs uppercase text-muted">Save Location</span>
          <select
            className="h-9 w-full min-w-0 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 focus:ring-2 disabled:opacity-60"
            value={bulkLyricsSaveLocation}
            disabled={bulkLyricsActive}
            onChange={(event) => onBulkLyricsSaveLocationChange(event.target.value as BulkLyricsSaveLocation)}
          >
            <option value="sidecar">Database + LRC files</option>
            <option value="database">Database only</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-xs uppercase text-muted">Limit</span>
          <input
            className="h-9 w-full min-w-0 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 focus:ring-2 disabled:opacity-60"
            value={bulkLyricsLimit}
            inputMode="numeric"
            disabled={bulkLyricsActive}
            onChange={(event) => onBulkLyricsLimitChange(event.target.value.replace(/[^\d]/g, ""))}
          />
        </label>
      </div>

      {bulkLyricsProgress && (
        <div className="mt-3 grid gap-2">
          <div className="h-2 overflow-hidden rounded bg-panel">
            <div
              className="h-full bg-moss transition-[width]"
              style={{ width: `${Math.round(bulkLyricsProgress.percent)}%` }}
            />
          </div>
          <div className="grid gap-1 text-xs text-muted sm:grid-cols-2">
            <div>
              {bulkLyricsProgress.processed_tracks.toLocaleString()} / {bulkLyricsProgress.total_tracks.toLocaleString()} tracks
              {bulkLyricsProgress.current_title ? ` - ${bulkLyricsProgress.current_title}` : ""}
            </div>
            <div className="sm:text-right">
              {bulkLyricsReady.toLocaleString()} ready, {bulkLyricsProgress.missing.toLocaleString()} missing, {bulkLyricsProgress.failed.toLocaleString()} failed
            </div>
          </div>
          {bulkLyricsProgress.errors.length > 0 && (
            <details className="rounded border border-line bg-panel p-2 text-xs text-muted">
              <summary className="cursor-pointer text-neutral-200">Recent lyric lookup errors</summary>
              <div className="mt-2 grid gap-1">
                {bulkLyricsProgress.errors.map((error) => (
                  <div key={error} className="truncate" title={error}>{error}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="secondary-button"
          type="button"
          disabled={bulkLyricsActive || isStartingBulkLyrics}
          onClick={onStartBulkLyrics}
        >
          <Search size={15} />
          {isStartingBulkLyrics ? "Starting" : "Start Lookup"}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!bulkLyricsActive}
          onClick={onCancelBulkLyrics}
        >
          <X size={15} />
          Cancel
        </button>
      </div>
    </div>
  );
}
