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
          <div className="mb-3">
            <div className="mb-2 font-medium text-neutral-200">Recent Batches</div>
            <div className="grid max-h-56 gap-1 overflow-auto pr-1">
              {bulkUndoBatches.length ? (
                bulkUndoBatches.map((batch) => (
                  <div key={batch.batch_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-neutral-200">{batch.batch_id}</span>
                      <button className="secondary-button h-7 px-2 text-[11px]" type="button" onClick={() => void onRestoreUndoBatch(batch.batch_id)}>
                        Restore Batch
                      </button>
                    </div>
                    <div className="truncate text-muted">
                      {batch.entries.toLocaleString()} {batch.action_type} entr{batch.entries === 1 ? "y" : "ies"} - {new Date(batch.last_created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded bg-panel px-2 py-2 text-muted">No grouped bulk actions recorded yet.</div>
              )}
            </div>
          </div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-medium text-neutral-200">Recent Bulk Actions</div>
            <button className="secondary-button h-8" type="button" onClick={() => void onRefreshUndoLog()}>
              <RotateCcw size={14} />
              Refresh
            </button>
          </div>
          <div className="grid max-h-80 gap-1 overflow-auto pr-1">
            {bulkUndoLog.length ? (
              bulkUndoLog.map((entry) => (
                <div key={entry.id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-neutral-200">{entry.summary}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-muted">{new Date(entry.created_at).toLocaleString()}</span>
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
                  <div className="truncate text-muted">{entry.action_type}</div>
                </div>
              ))
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
