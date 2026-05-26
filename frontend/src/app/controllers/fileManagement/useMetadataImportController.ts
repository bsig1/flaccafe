import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import {
  applyDuplicateAction,
  exportMetadataCsv,
  exportMetadataCsvImportReport,
  fetchDuplicateReview,
  importMetadataCsv,
} from "../../../lib/api";
import type {
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  DuplicateActionRequest,
  DuplicateActionResponse,
  DuplicateReviewResponse,
  Track,
} from "../../../types/api";
import { display } from "../../shared";

type MetadataImportControllerDeps = {
  findTracksByIds: (trackIds: number[]) => Track[];
  loadAlbums: () => Promise<unknown>;
  loadArtists: () => Promise<unknown>;
  loadBulkUndoLog: () => Promise<unknown>;
  loadLibraryStats: () => Promise<unknown>;
  refreshTracks: () => Promise<unknown>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useMetadataImportController({
  findTracksByIds,
  loadAlbums,
  loadArtists,
  loadBulkUndoLog,
  loadLibraryStats,
  refreshTracks,
  setStatus,
}: MetadataImportControllerDeps) {
  const [metadataCsvExport, setMetadataCsvExport] = useState<CsvMetadataExportResponse | null>(null);
  const [metadataCsvImportPreview, setMetadataCsvImportPreview] = useState<CsvMetadataImportResponse | null>(null);
  const [metadataCsvImportReport, setMetadataCsvImportReport] = useState<CsvMetadataImportReportResponse | null>(null);
  const [duplicateActionResult, setDuplicateActionResult] = useState<DuplicateActionResponse | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<DuplicateReviewResponse | null>(null);
  async function handleExportMetadataCsv(trackIds?: number[] | null) {
    try {
      const response = await exportMetadataCsv({ track_ids: trackIds?.length ? trackIds : null, limit: 200000 });
      setMetadataCsvExport(response);
      setStatus(`Exported ${response.track_count.toLocaleString()} tracks to ${response.csv_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export metadata CSV");
    }
  }

  async function handlePreviewMetadataCsv(
    csvPath: string,
    missingOnly: boolean,
    options?: { trackIds?: number[] | null; columnMap?: Record<string, string>; clearBlankFields?: boolean },
  ) {
    const trimmedPath = csvPath.trim();
    if (!trimmedPath) {
      setStatus("Choose a CSV path first");
      return;
    }
    try {
      const response = await importMetadataCsv({
        csv_path: trimmedPath,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        column_map: options?.columnMap ?? {},
        missing_only: missingOnly,
        clear_blank_fields: options?.clearBlankFields ?? false,
        apply: false,
        limit: 10000,
      });
      setMetadataCsvImportPreview(response);
      setStatus(`${response.changed.toLocaleString()} of ${response.matched.toLocaleString()} matched rows would change`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview metadata CSV");
    }
  }

  async function handleApplyMetadataCsv(
    csvPath: string,
    missingOnly: boolean,
    options?: { trackIds?: number[] | null; columnMap?: Record<string, string>; clearBlankFields?: boolean },
  ) {
    const trimmedPath = csvPath.trim();
    if (!trimmedPath) {
      setStatus("Choose a CSV path first");
      return;
    }
    if (!window.confirm("Import CSV metadata into the library? File writing follows the current write-tags setting.")) {
      return;
    }
    try {
      const response = await importMetadataCsv({
        csv_path: trimmedPath,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        column_map: options?.columnMap ?? {},
        missing_only: missingOnly,
        clear_blank_fields: options?.clearBlankFields ?? false,
        apply: true,
        limit: 10000,
      });
      setMetadataCsvImportPreview(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats()]);
      setStatus(`Applied CSV metadata to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import metadata CSV");
    }
  }

  async function handleExportMetadataCsvReport(
    csvPath: string,
    missingOnly: boolean,
    options?: { trackIds?: number[] | null; columnMap?: Record<string, string>; clearBlankFields?: boolean },
  ) {
    const trimmedPath = csvPath.trim();
    if (!trimmedPath) {
      setStatus("Choose a CSV path first");
      return;
    }
    try {
      const response = await exportMetadataCsvImportReport({
        csv_path: trimmedPath,
        track_ids: options?.trackIds?.length ? options.trackIds : null,
        column_map: options?.columnMap ?? {},
        missing_only: missingOnly,
        clear_blank_fields: options?.clearBlankFields ?? false,
        apply: false,
        limit: 10000,
      });
      setMetadataCsvImportReport(response);
      setStatus(`Exported CSV dry-run report to ${response.report_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export CSV report");
    }
  }

  async function handleDuplicateAction(request: DuplicateActionRequest) {
    if (!["export_report", "ignore", "clear_ignored"].includes(request.action)) {
      const count = request.groups?.length
        ? request.groups.reduce((total, group) => total + group.length, 0)
        : request.track_ids?.length ?? 0;
      const deleteWarning = request.delete_files ? " This will also delete selected audio files from disk." : "";
      if (!window.confirm(`Apply duplicate action to ${count.toLocaleString()} track references?${deleteWarning}`)) {
        return;
      }
    }
    try {
      const response = await applyDuplicateAction(request);
      setDuplicateActionResult(response);
      await Promise.all([refreshTracks(), loadAlbums(), loadArtists(), loadLibraryStats(), loadBulkUndoLog()]);
      if (response.report_path) {
        setStatus(`Exported duplicate report to ${response.report_path}`);
      } else {
        setStatus(`Duplicate action affected ${response.affected.toLocaleString()} track${response.affected === 1 ? "" : "s"}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not apply duplicate action");
    }
  }

  async function handleIgnoreDuplicateGroup(ignoreKey: string, label: string) {
    try {
      const response = await applyDuplicateAction({
        action: "ignore",
        ignore_key: ignoreKey,
        ignore_label: label,
      });
      setDuplicateActionResult(response);
      await loadLibraryStats();
      setStatus("Ignored duplicate group");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not ignore duplicate group");
    }
  }

  async function handleClearIgnoredDuplicateGroups() {
    try {
      const response = await applyDuplicateAction({ action: "clear_ignored" });
      setDuplicateActionResult(response);
      await loadLibraryStats();
      setStatus(`Restored ${response.affected.toLocaleString()} ignored duplicate group${response.affected === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not restore ignored duplicate groups");
    }
  }

  async function handleLoadDuplicateReview(trackIds: number[], groups: number[][]) {
    try {
      const response = await fetchDuplicateReview({
        track_ids: trackIds,
        groups,
        limit: 1000,
      });
      setDuplicateReview(response);
      setStatus(
        `Loaded ${response.tracks.length.toLocaleString()} review track${response.tracks.length === 1 ? "" : "s"}`
          + (response.missing_track_ids.length ? `; ${response.missing_track_ids.length.toLocaleString()} missing IDs` : ""),
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load duplicate review");
    }
  }

  async function handleRevealTracksByIds(trackIds: number[]) {
    const uniqueIds = Array.from(new Set(trackIds));
    const targetId = uniqueIds[uniqueIds.length - 1];
    if (!targetId) {
      setStatus("No selected track to reveal.");
      return;
    }
    let foundTracks = findTracksByIds([targetId]);
    if (foundTracks.length === 0) {
      try {
        const response = await fetchDuplicateReview({ track_ids: [targetId], limit: 1 });
        foundTracks = response.tracks;
        setDuplicateReview(response);
      } catch {
        // Fall back to the tracks already loaded in the UI.
      }
    }
    if (!foundTracks.length) {
      setStatus("That selected track was not found in the library.");
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reveal_in_file_explorer", { path: foundTracks[0].path });
      setStatus(`Opened location for ${display(foundTracks[0].title, "selected track")}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reveal in Explorer is available in the desktop app.");
    }
  }


  return {
    metadataCsvExport,
    setMetadataCsvExport,
    metadataCsvImportPreview,
    setMetadataCsvImportPreview,
    metadataCsvImportReport,
    setMetadataCsvImportReport,
    duplicateActionResult,
    setDuplicateActionResult,
    duplicateReview,
    setDuplicateReview,
    handleExportMetadataCsv,
    handlePreviewMetadataCsv,
    handleApplyMetadataCsv,
    handleExportMetadataCsvReport,
    handleDuplicateAction,
    handleIgnoreDuplicateGroup,
    handleClearIgnoredDuplicateGroups,
    handleLoadDuplicateReview,
    handleRevealTracksByIds,
  };
}
