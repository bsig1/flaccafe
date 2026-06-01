import type { Dispatch,SetStateAction } from "react";
import { useState } from "react";

import {
fetchBulkUndoBatches,
fetchBulkUndoLog,
restoreBulkUndoBatch,
restoreBulkUndoEntry,
} from "../../../lib/api";
import type {
BulkUndoBatchEntry,
BulkUndoLogEntry,
BulkUndoRestoreResponse,
} from "../../../types/api";
import type { UndoAction } from "../../shared";

type BulkUndoControllerDeps = {
  handleUndoAction: () => Promise<void>;
  loadAlbums: () => Promise<unknown>;
  loadArtists: () => Promise<unknown>;
  loadLibraryStats: () => Promise<unknown>;
  refreshTracks: () => Promise<unknown>;
  setStatus: Dispatch<SetStateAction<string>>;
  undoAction: UndoAction | null;
};

export function useBulkUndoController({
  handleUndoAction,
  loadAlbums,
  loadArtists,
  loadLibraryStats,
  refreshTracks,
  setStatus,
  undoAction,
}: BulkUndoControllerDeps) {
  const [bulkUndoLog, setBulkUndoLog] = useState<BulkUndoLogEntry[]>([]);
  const [bulkUndoBatches, setBulkUndoBatches] = useState<BulkUndoBatchEntry[]>([]);
  const [bulkUndoRestoreResult, setBulkUndoRestoreResult] = useState<BulkUndoRestoreResponse | null>(null);
  async function loadBulkUndoLog() {
    try {
      setBulkUndoLog(await fetchBulkUndoLog(50));
      setBulkUndoBatches(await fetchBulkUndoBatches(30));
    } catch {
      setBulkUndoLog([]);
      setBulkUndoBatches([]);
    }
  }

  async function handleRestoreBulkUndoEntry(entryId: number) {
    if (!window.confirm("Restore this bulk action? This may move files or rewrite metadata back to the previous values.")) {
      return;
    }
    try {
      const response = await restoreBulkUndoEntry(entryId);
      setBulkUndoRestoreResult(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(
        response.restored
          ? `Restored undo entry ${entryId}`
          : response.errors[0] ?? `Could not restore undo entry ${entryId}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not restore undo entry");
    }
  }

  async function handleRestoreBulkUndoBatch(batchId: string) {
    if (!window.confirm("Restore this entire bulk-action batch? This can move files or rewrite metadata back to the previous values.")) {
      return;
    }
    try {
      const response = await restoreBulkUndoBatch(batchId);
      setBulkUndoRestoreResult(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(
        response.restored
          ? `Restored batch ${batchId}`
          : response.errors[0] ?? `Could not restore batch ${batchId}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not restore undo batch");
    }
  }

  async function handleUndoRecentChange() {
    if (undoAction) {
      await handleUndoAction();
      return;
    }

    const batchRestoreActions = new Set([
      "csv_metadata_import",
      "regex_metadata_replace",
      "musicbrainz_auto_tag",
      "file_organization",
      "track_remove",
      "sqlite_file_tag_write",
    ]);
    const entryRestoreActions = new Set([
      ...batchRestoreActions,
      "advanced_tag_edit",
      "tag_backup_restore",
    ]);

    try {
      setStatus("Looking for a recent change to undo...");
      const batches = await fetchBulkUndoBatches(10);
      const batch = batches.find((item) => batchRestoreActions.has(item.action_type));
      if (batch) {
        const response = await restoreBulkUndoBatch(batch.batch_id);
        setBulkUndoRestoreResult(response);
        await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
        setStatus(
          response.restored
            ? `Undid ${batch.summary || batch.action_type}`
            : response.errors[0] ?? "Could not undo recent change",
        );
        return;
      }

      const entries = await fetchBulkUndoLog(20);
      const entry = entries.find((item) => entryRestoreActions.has(item.action_type));
      if (!entry) {
        await loadBulkUndoLog();
        setStatus("Nothing recent can be undone yet.");
        return;
      }
      const response = await restoreBulkUndoEntry(entry.id);
      setBulkUndoRestoreResult(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
      setStatus(
        response.restored
          ? `Undid ${entry.summary}`
          : response.errors[0] ?? "Could not undo recent change",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not undo recent change");
    }
  }


  return {
    bulkUndoLog,
    setBulkUndoLog,
    bulkUndoBatches,
    setBulkUndoBatches,
    bulkUndoRestoreResult,
    setBulkUndoRestoreResult,
    loadBulkUndoLog,
    handleRestoreBulkUndoEntry,
    handleRestoreBulkUndoBatch,
    handleUndoRecentChange,
  };
}
