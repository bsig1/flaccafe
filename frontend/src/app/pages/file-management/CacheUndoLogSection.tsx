import {
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import type {
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  BulkUndoRestoreResponse,
  CacheClearTarget,
} from "../../../types/api";
import {
  DisclosureSection,
} from "../../components/common";
import {
  canRestoreUndo,
} from "./fileManagementUtils";

type UndoTimelineItem =
  | {
      kind: "batch";
      batch: BulkUndoBatchEntry;
      entries: BulkUndoLogEntry[];
      sortDate: string;
    }
  | {
      kind: "entry";
      entry: BulkUndoLogEntry;
      sortDate: string;
    };

function formatUndoDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value || "Unknown time" : new Date(timestamp).toLocaleString();
}

function undoSortValue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function actionLabel(actionType: string) {
  return actionType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildUndoTimeline(bulkUndoLog: BulkUndoLogEntry[], bulkUndoBatches: BulkUndoBatchEntry[]) {
  const batchesById = new Map(bulkUndoBatches.map((batch) => [batch.batch_id, batch]));
  const entriesByBatch = new Map<string, BulkUndoLogEntry[]>();
  const timeline: UndoTimelineItem[] = bulkUndoBatches.map((batch) => ({
    kind: "batch",
    batch,
    entries: [],
    sortDate: batch.last_created_at,
  }));

  for (const entry of bulkUndoLog) {
    if (entry.batch_id && batchesById.has(entry.batch_id)) {
      const batchEntries = entriesByBatch.get(entry.batch_id) ?? [];
      batchEntries.push(entry);
      entriesByBatch.set(entry.batch_id, batchEntries);
    } else {
      timeline.push({ kind: "entry", entry, sortDate: entry.created_at });
    }
  }

  for (const item of timeline) {
    if (item.kind === "batch") {
      item.entries = entriesByBatch.get(item.batch.batch_id) ?? [];
    }
  }

  return timeline.sort((left, right) => undoSortValue(right.sortDate) - undoSortValue(left.sortDate));
}

export function CacheUndoLogSection({
  bulkUndoLog,
  bulkUndoBatches,
  bulkUndoRestoreResult,
  onRefreshUndoLog,
  onRestoreUndoEntry,
  onRestoreUndoBatch,
  onClearArtistCache,
  onClearLibraryCaches,
}: {
  bulkUndoLog: BulkUndoLogEntry[];
  bulkUndoBatches: BulkUndoBatchEntry[];
  bulkUndoRestoreResult: BulkUndoRestoreResponse | null;
  onRefreshUndoLog: () => void | Promise<void>;
  onRestoreUndoEntry: (entryId: number) => void | Promise<void>;
  onRestoreUndoBatch: (batchId: string) => void | Promise<void>;
  onClearArtistCache: () => void;
  onClearLibraryCaches: (targets: CacheClearTarget[]) => void | Promise<void>;
}) {
  const undoTimeline = buildUndoTimeline(bulkUndoLog, bulkUndoBatches);

  return (
    <DisclosureSection title="Cache And Undo Log" description="Clear derived cache data and inspect recent bulk actions">
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" type="button" onClick={() => void onClearLibraryCaches(["artwork"])}>
            <RefreshCw size={15} />
            Artwork
          </button>
          <button className="secondary-button" type="button" onClick={() => void onClearLibraryCaches(["metadata"])}>
            <RefreshCw size={15} />
            Metadata
          </button>
          <button className="secondary-button" type="button" onClick={() => void onClearLibraryCaches(["recommendation_history"])}>
            <RefreshCw size={15} />
            AutoDJ History
          </button>
          <button className="secondary-button" type="button" onClick={() => void onClearArtistCache()}>
            <RefreshCw size={15} />
            Artist Info
          </button>
          <button className="secondary-button" type="button" onClick={() => void onClearLibraryCaches(["artist", "artwork", "metadata", "recommendation_history", "scan_errors"])}>
            <RefreshCw size={15} />
            All Caches
          </button>
        </div>
        <div className="rounded border border-line bg-ink p-3 text-xs">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-medium text-neutral-200">Recent Undo Activity</div>
            <button className="secondary-button h-8" type="button" onClick={() => void onRefreshUndoLog()}>
              <RotateCcw size={14} />
              Refresh
            </button>
          </div>
          <div className="grid max-h-80 gap-1 overflow-auto pr-1">
            {undoTimeline.length ? (
              undoTimeline.map((item) => {
                if (item.kind === "batch") {
                  const { batch, entries } = item;
                  const visibleEntries = entries.slice(0, 8);
                  return (
                    <div key={`batch-${batch.batch_id}`} className="grid gap-2 rounded bg-panel px-2 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-neutral-200">{batch.summary || actionLabel(batch.action_type)}</div>
                          <div className="truncate text-muted">
                            {batch.entries.toLocaleString()} {actionLabel(batch.action_type)} entr{batch.entries === 1 ? "y" : "ies"} - {formatUndoDate(batch.last_created_at)}
                          </div>
                        </div>
                        <button
                          className="secondary-button h-7 shrink-0 px-2 text-[11px]"
                          type="button"
                          disabled={!canRestoreUndo(batch.action_type)}
                          onClick={() => void onRestoreUndoBatch(batch.batch_id)}
                        >
                          Restore
                        </button>
                      </div>
                      {visibleEntries.length > 0 && (
                        <details className="rounded border border-line/70 bg-ink/50 px-2 py-1 text-muted">
                          <summary className="cursor-pointer text-neutral-300">Show entries</summary>
                          <div className="mt-1 grid gap-1">
                            {visibleEntries.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between gap-2 rounded bg-panel/70 px-2 py-1">
                                <span className="min-w-0 truncate">{entry.summary}</span>
                                <span className="shrink-0">{formatUndoDate(entry.created_at)}</span>
                              </div>
                            ))}
                            {batch.entries > visibleEntries.length && (
                              <div className="px-2 py-1 text-muted">
                                {batch.entries - visibleEntries.length} more entr{batch.entries - visibleEntries.length === 1 ? "y" : "ies"} in this batch.
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                }

                const { entry } = item;
                return (
                  <div key={`entry-${entry.id}`} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-neutral-200">{entry.summary}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-muted">{formatUndoDate(entry.created_at)}</span>
                        <button
                          className="secondary-button h-7 px-2 text-[11px]"
                          type="button"
                          disabled={!canRestoreUndo(entry.action_type)}
                          onClick={() => void onRestoreUndoEntry(entry.id)}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                    <div className="truncate text-muted">{actionLabel(entry.action_type)}</div>
                  </div>
                );
              })
            ) : (
              <div className="rounded bg-panel px-2 py-2 text-muted">No bulk actions recorded yet.</div>
            )}
          </div>
          {bulkUndoRestoreResult && (
            <div className={bulkUndoRestoreResult.restored ? "mt-2 text-moss" : "mt-2 text-ember"}>
              {bulkUndoRestoreResult.restored
                ? `Restored ${bulkUndoRestoreResult.affected_track_ids.length.toLocaleString()} track${bulkUndoRestoreResult.affected_track_ids.length === 1 ? "" : "s"}`
                : bulkUndoRestoreResult.errors.join("; ")}
            </div>
          )}
        </div>
      </div>
    </DisclosureSection>
  );
}
