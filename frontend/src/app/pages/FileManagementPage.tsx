import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  FolderOpen,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AcousticFingerprintResponse,
  AutoTagResponse,
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  BulkUndoRestoreResponse,
  ChromaprintInstallResponse,
  CacheClearTarget,
  ChromaprintStatusResponse,
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  DeviceSyncResponse,
  DuplicateActionRequest,
  DuplicateActionResponse,
  DuplicateReviewResponse,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  FolderWatchChange,
  FolderWatchStatus,
  FilenameTagInferenceResponse,
  PlaylistSummary,
  ReportFileResponse,
  TagRegexReplaceResponse,
} from "../../types/api";
import {
  DisclosureSection,
  NumberField,
} from "../components/common";
import { CacheUndoLogSection } from "./file-management/CacheUndoLogSection";
import { ReportViewerSection } from "./file-management/ReportViewerSection";
import {
  CSV_IMPORT_FIELDS,
  DEFAULT_FILENAME_TAG_PATTERNS,
  currentScope,
  formatJson,
  parseDuplicateGroups,
  parseTrackIds,
  previewLabel,
  readCsvProfiles,
  readFilenameTagPresets,
  writeCsvProfiles,
  writeFilenameTagPresets,
} from "./file-management/fileManagementUtils";
import type {
  CsvImportOptions,
  CsvImportProfile,
  FileOrganizationOptions,
} from "./file-management/fileManagementUtils";

export function FileManagementPage({
  folderPath,
  playlists,
  onClearArtistCache,
  onClearLibraryCaches,
  filenameTagPreview,
  onPreviewFilenameTags,
  onApplyFilenameTags,
  tagRegexPreview,
  onPreviewTagRegex,
  onApplyTagRegex,
  autoTagPreview,
  onPreviewAutoTag,
  onApplyAutoTag,
  fileOrganizationPreview,
  fileOrganizationReport,
  folderWatchStatus,
  onPreviewFileOrganization,
  onApplyFileOrganization,
  onExportFileOrganizationReport,
  onStartFolderWatch,
  onStopFolderWatch,
  onRefreshFolderWatch,
  onApplyFolderWatch,
  deviceSyncPreview,
  onDeviceSync,
  metadataCsvExport,
  metadataCsvImportPreview,
  metadataCsvImportReport,
  onExportMetadataCsv,
  onPreviewMetadataCsv,
  onApplyMetadataCsv,
  onExportMetadataCsvReport,
  duplicateActionResult,
  duplicateReview,
  onDuplicateAction,
  onLoadDuplicateReview,
  onRevealTracksByIds,
  chromaprintSetup,
  onRefreshChromaprintSetup,
  onSaveChromaprintSetup,
  chromaprintInstallResult,
  onInstallChromaprintTool,
  acousticFingerprintResult,
  onRunAcousticFingerprintPass,
  bulkUndoLog,
  bulkUndoBatches,
  bulkUndoRestoreResult,
  onRefreshUndoLog,
  onRestoreUndoEntry,
  onRestoreUndoBatch,
  reportFile,
  onReadReportFile,
}: {
  folderPath: string;
  playlists: PlaylistSummary[];
  onClearArtistCache: () => void;
  onClearLibraryCaches: (targets: CacheClearTarget[]) => void | Promise<void>;
  filenameTagPreview: FilenameTagInferenceResponse | null;
  onPreviewFilenameTags: (pattern: string, missingOnly: boolean, trackIds?: number[] | null) => void | Promise<void>;
  onApplyFilenameTags: (pattern: string, missingOnly: boolean, trackIds?: number[] | null) => void | Promise<void>;
  tagRegexPreview: TagRegexReplaceResponse | null;
  onPreviewTagRegex: (
    field: "title" | "artist" | "album" | "album_artist" | "genre",
    pattern: string,
    replacement: string,
    caseSensitive: boolean,
    trackIds?: number[] | null,
  ) => void | Promise<void>;
  onApplyTagRegex: (
    field: "title" | "artist" | "album" | "album_artist" | "genre",
    pattern: string,
    replacement: string,
    caseSensitive: boolean,
    trackIds?: number[] | null,
  ) => void | Promise<void>;
  autoTagPreview: AutoTagResponse | null;
  onPreviewAutoTag: (
    mode: "album" | "track",
    missingOnly: boolean,
    includeArtwork: boolean,
    trackIds?: number[] | null,
  ) => void | Promise<void>;
  onApplyAutoTag: (
    mode: "album" | "track",
    missingOnly: boolean,
    includeArtwork: boolean,
    saveArtwork: boolean,
    trackIds?: number[] | null,
  ) => void | Promise<void>;
  fileOrganizationPreview: FileOrganizationResponse | null;
  fileOrganizationReport: FileOrganizationReportResponse | null;
  folderWatchStatus: FolderWatchStatus | null;
  onPreviewFileOrganization: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => void | Promise<void>;
  onApplyFileOrganization: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => void | Promise<void>;
  onExportFileOrganizationReport: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => void | Promise<void>;
  onStartFolderWatch: (intervalSeconds: number) => void | Promise<void>;
  onStopFolderWatch: () => void | Promise<void>;
  onRefreshFolderWatch: () => void | Promise<void>;
  onApplyFolderWatch: (changeIds: string[], applyAll?: boolean) => void | Promise<void>;
  deviceSyncPreview: DeviceSyncResponse | null;
  onDeviceSync: (
    targetFolder: string,
    options: {
      playlistIds?: number[];
      trackIds?: number[] | null;
      copyFiles?: boolean;
      exportPlaylists?: boolean;
      preserveStructure?: boolean;
      apply?: boolean;
    },
  ) => void | Promise<void>;
  metadataCsvExport: CsvMetadataExportResponse | null;
  metadataCsvImportPreview: CsvMetadataImportResponse | null;
  metadataCsvImportReport: CsvMetadataImportReportResponse | null;
  onExportMetadataCsv: (trackIds?: number[] | null) => void | Promise<void>;
  onPreviewMetadataCsv: (csvPath: string, missingOnly: boolean, options?: CsvImportOptions) => void | Promise<void>;
  onApplyMetadataCsv: (csvPath: string, missingOnly: boolean, options?: CsvImportOptions) => void | Promise<void>;
  onExportMetadataCsvReport: (csvPath: string, missingOnly: boolean, options?: CsvImportOptions) => void | Promise<void>;
  duplicateActionResult: DuplicateActionResponse | null;
  duplicateReview: DuplicateReviewResponse | null;
  onDuplicateAction: (request: DuplicateActionRequest) => void | Promise<void>;
  onLoadDuplicateReview: (trackIds: number[], groups: number[][]) => void | Promise<void>;
  onRevealTracksByIds: (trackIds: number[]) => void | Promise<void>;
  chromaprintSetup: ChromaprintStatusResponse | null;
  onRefreshChromaprintSetup: () => void | Promise<void>;
  onSaveChromaprintSetup: (fpcalcPath: string | null) => void | Promise<void>;
  chromaprintInstallResult: ChromaprintInstallResponse | null;
  onInstallChromaprintTool: () => void | Promise<void>;
  acousticFingerprintResult: AcousticFingerprintResponse | null;
  onRunAcousticFingerprintPass: (trackIds: number[] | null, overwrite: boolean, limit: number) => void | Promise<void>;
  bulkUndoLog: BulkUndoLogEntry[];
  bulkUndoBatches: BulkUndoBatchEntry[];
  bulkUndoRestoreResult: BulkUndoRestoreResponse | null;
  onRefreshUndoLog: () => void | Promise<void>;
  onRestoreUndoEntry: (entryId: number) => void | Promise<void>;
  onRestoreUndoBatch: (batchId: string) => void | Promise<void>;
  reportFile: ReportFileResponse | null;
  onReadReportFile: (reportPath: string) => void | Promise<void>;
}) {
  const [trackScopeText, setTrackScopeText] = useState("");
  const [filenameTagPattern, setFilenameTagPattern] = useState(DEFAULT_FILENAME_TAG_PATTERNS[0]);
  const [filenameTagMissingOnly, setFilenameTagMissingOnly] = useState(true);
  const [filenameTagPresets, setFilenameTagPresets] = useState(readFilenameTagPresets);
  const [filenamePresetMessage, setFilenamePresetMessage] = useState<string | null>(null);
  const [filenamePresetJson, setFilenamePresetJson] = useState("");
  const [acceptedFilenameTrackIds, setAcceptedFilenameTrackIds] = useState<Set<number>>(() => new Set());
  const [tagRegexField, setTagRegexField] = useState<"title" | "artist" | "album" | "album_artist" | "genre">("artist");
  const [tagRegexPattern, setTagRegexPattern] = useState("\\s+feat\\..*$");
  const [tagRegexReplacement, setTagRegexReplacement] = useState("");
  const [tagRegexCaseSensitive, setTagRegexCaseSensitive] = useState(false);
  const [autoTagMode, setAutoTagMode] = useState<"album" | "track">("album");
  const [autoTagMissingOnly, setAutoTagMissingOnly] = useState(true);
  const [autoTagIncludeArtwork, setAutoTagIncludeArtwork] = useState(true);
  const [autoTagSaveArtwork, setAutoTagSaveArtwork] = useState(false);
  const [acceptedAutoTagTrackIds, setAcceptedAutoTagTrackIds] = useState<Set<number>>(() => new Set());
  const [organizeTemplate, setOrganizeTemplate] = useState("<Album Artist>/<Album> (<Year>)/<Track#> - <Title>");
  const [organizeBaseFolder, setOrganizeBaseFolder] = useState("");
  const [organizeCollisionStrategy, setOrganizeCollisionStrategy] = useState<"skip" | "auto_rename">("skip");
  const [organizeCleanupEmptyFolders, setOrganizeCleanupEmptyFolders] = useState(false);
  const [watchIntervalSeconds, setWatchIntervalSeconds] = useState(folderWatchStatus?.interval_seconds ?? 45);
  const [acceptedFolderWatchIds, setAcceptedFolderWatchIds] = useState<Set<string>>(() => new Set());
  const [deviceSyncTarget, setDeviceSyncTarget] = useState("");
  const [deviceSyncPlaylistIds, setDeviceSyncPlaylistIds] = useState<Set<number>>(() => new Set());
  const [deviceSyncCopyFiles, setDeviceSyncCopyFiles] = useState(true);
  const [deviceSyncExportPlaylists, setDeviceSyncExportPlaylists] = useState(true);
  const [deviceSyncPreserveStructure, setDeviceSyncPreserveStructure] = useState(true);
  const [metadataCsvPath, setMetadataCsvPath] = useState("");
  const [metadataCsvMissingOnly, setMetadataCsvMissingOnly] = useState(true);
  const [metadataCsvClearBlankFields, setMetadataCsvClearBlankFields] = useState(false);
  const [csvColumnMapText, setCsvColumnMapText] = useState("{}");
  const [csvProfiles, setCsvProfiles] = useState(readCsvProfiles);
  const [csvProfileName, setCsvProfileName] = useState("");
  const [csvProfileMessage, setCsvProfileMessage] = useState<string | null>(null);
  const [duplicateTrackIdsText, setDuplicateTrackIdsText] = useState("");
  const [duplicateGroupsText, setDuplicateGroupsText] = useState("");
  const [duplicateDeleteFiles, setDuplicateDeleteFiles] = useState(false);
  const [fpcalcPath, setFpcalcPath] = useState("");
  const [acousticOverwrite, setAcousticOverwrite] = useState(false);
  const [acousticLimit, setAcousticLimit] = useState(200);
  const [reportPath, setReportPath] = useState("");

  const scopedTrackIds = useMemo(() => parseTrackIds(trackScopeText), [trackScopeText]);
  const duplicateTrackIds = useMemo(
    () => parseTrackIds(duplicateTrackIdsText.trim() ? duplicateTrackIdsText : trackScopeText),
    [duplicateTrackIdsText, trackScopeText],
  );
  const duplicateGroups = useMemo(() => parseDuplicateGroups(duplicateGroupsText), [duplicateGroupsText]);
  const allFilenameTagPresets = Array.from(new Set([...DEFAULT_FILENAME_TAG_PATTERNS, ...filenameTagPresets]));
  const isCustomFilenameTagPreset = filenameTagPresets.includes(filenameTagPattern);
  const folderWatchChanges = folderWatchStatus?.changes ?? [];
  const folderWatchChangeKey = folderWatchChanges.map((change) => change.id).join("|");
  const selectedWatchCount = folderWatchChanges.filter((change) => acceptedFolderWatchIds.has(change.id)).length;
  const autoTagChangedIds = useMemo(
    () =>
      autoTagPreview?.previews
        .filter((preview) => acceptedAutoTagTrackIds.has(preview.track_id) && !preview.error && preview.changed_fields.length > 0)
        .map((preview) => preview.track_id) ?? [],
    [acceptedAutoTagTrackIds, autoTagPreview],
  );
  const autoTagArtworkIds = useMemo(
    () =>
      autoTagPreview?.previews
        .filter((preview) => acceptedAutoTagTrackIds.has(preview.track_id) && !preview.error && Boolean(preview.artwork_url))
        .map((preview) => preview.track_id) ?? [],
    [acceptedAutoTagTrackIds, autoTagPreview],
  );
  const acceptedChangedFilenameIds = useMemo(
    () =>
      filenameTagPreview?.previews
        .filter((preview) => acceptedFilenameTrackIds.has(preview.track_id) && preview.matched && preview.changed_fields.length > 0)
        .map((preview) => preview.track_id) ?? [],
    [acceptedFilenameTrackIds, filenameTagPreview],
  );

  useEffect(() => {
    const next = new Set<number>();
    for (const preview of filenameTagPreview?.previews ?? []) {
      if (preview.matched && preview.changed_fields.length > 0) {
        next.add(preview.track_id);
      }
    }
    setAcceptedFilenameTrackIds(next);
  }, [filenameTagPreview]);

  useEffect(() => {
    setFpcalcPath(chromaprintSetup?.configured_path ?? chromaprintSetup?.resolved_path ?? "");
  }, [chromaprintSetup?.configured_path, chromaprintSetup?.resolved_path]);

  useEffect(() => {
    setWatchIntervalSeconds(folderWatchStatus?.interval_seconds ?? 45);
  }, [folderWatchStatus?.interval_seconds]);

  useEffect(() => {
    setAcceptedFolderWatchIds(new Set(folderWatchChanges.map((change) => change.id)));
  }, [folderWatchChangeKey]);

  useEffect(() => {
    const next = new Set<number>();
    for (const preview of autoTagPreview?.previews ?? []) {
      if (!preview.error && (preview.changed_fields.length > 0 || preview.artwork_url)) {
        next.add(preview.track_id);
      }
    }
    setAcceptedAutoTagTrackIds(next);
  }, [autoTagPreview]);

  function saveCurrentFilenameTagPreset() {
    const trimmed = filenameTagPattern.trim();
    if (!trimmed || allFilenameTagPresets.includes(trimmed)) {
      return;
    }
    const next = [...filenameTagPresets, trimmed];
    setFilenameTagPresets(next);
    writeFilenameTagPresets(next);
    setFilenamePresetMessage("Pattern saved");
  }

  function deleteCurrentFilenameTagPreset() {
    if (!isCustomFilenameTagPreset) {
      return;
    }
    const next = filenameTagPresets.filter((pattern) => pattern !== filenameTagPattern);
    setFilenameTagPresets(next);
    writeFilenameTagPresets(next);
    setFilenameTagPattern(DEFAULT_FILENAME_TAG_PATTERNS[0]);
    setFilenamePresetMessage("Pattern deleted");
  }

  function exportFilenamePresets() {
    setFilenamePresetJson(formatJson(filenameTagPresets));
    setFilenamePresetMessage("Custom presets exported below");
  }

  function importFilenamePresets() {
    try {
      const parsed = JSON.parse(filenamePresetJson);
      if (!Array.isArray(parsed)) {
        throw new Error("Preset export must be a JSON array");
      }
      const incoming = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      const next = Array.from(new Set([...filenameTagPresets, ...incoming.map((pattern) => pattern.trim())]));
      setFilenameTagPresets(next);
      writeFilenameTagPresets(next);
      setFilenamePresetMessage(`Imported ${incoming.length.toLocaleString()} pattern${incoming.length === 1 ? "" : "s"}`);
    } catch (error) {
      setFilenamePresetMessage(error instanceof Error ? error.message : "Could not import filename presets");
    }
  }

  function toggleAcceptedFilenameTrack(trackId: number) {
    setAcceptedFilenameTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function parseCsvColumnMap(): Record<string, string> | null {
    try {
      const parsed = JSON.parse(csvColumnMapText || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Column map must be a JSON object");
      }
      const normalized: Record<string, string> = {};
      for (const [field, column] of Object.entries(parsed)) {
        if (CSV_IMPORT_FIELDS.includes(field as (typeof CSV_IMPORT_FIELDS)[number]) && typeof column === "string" && column.trim()) {
          normalized[field] = column.trim();
        }
      }
      setCsvProfileMessage(null);
      return normalized;
    } catch (error) {
      setCsvProfileMessage(error instanceof Error ? error.message : "Could not parse column map");
      return null;
    }
  }

  function csvOptions(): CsvImportOptions | null {
    const columnMap = parseCsvColumnMap();
    if (columnMap === null) {
      return null;
    }
    return {
      trackIds: currentScope(scopedTrackIds),
      columnMap,
      clearBlankFields: metadataCsvClearBlankFields,
    };
  }

  function saveCsvProfile() {
    const name = csvProfileName.trim();
    const columnMap = parseCsvColumnMap();
    if (!name || columnMap === null) {
      setCsvProfileMessage(name ? "Could not save profile" : "Name the profile first");
      return;
    }
    const nextProfile: CsvImportProfile = {
      name,
      columnMap,
      missingOnly: metadataCsvMissingOnly,
      clearBlankFields: metadataCsvClearBlankFields,
    };
    const next = [...csvProfiles.filter((profile) => profile.name !== name), nextProfile].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    setCsvProfiles(next);
    writeCsvProfiles(next);
    setCsvProfileMessage("CSV profile saved");
  }

  function loadCsvProfile(name: string) {
    const profile = csvProfiles.find((item) => item.name === name);
    if (!profile) {
      return;
    }
    setCsvProfileName(profile.name);
    setCsvColumnMapText(formatJson(profile.columnMap));
    setMetadataCsvMissingOnly(profile.missingOnly);
    setMetadataCsvClearBlankFields(profile.clearBlankFields);
    setCsvProfileMessage(`Loaded ${profile.name}`);
  }

  function deleteCsvProfile() {
    const name = csvProfileName.trim();
    if (!name) {
      return;
    }
    const next = csvProfiles.filter((profile) => profile.name !== name);
    setCsvProfiles(next);
    writeCsvProfiles(next);
    setCsvProfileName("");
    setCsvProfileMessage("CSV profile deleted");
  }

  function withCsvOptions(action: (options: CsvImportOptions) => void | Promise<void>) {
    const options = csvOptions();
    if (options === null) {
      return;
    }
    void action(options);
  }

  function organizationOptions(): FileOrganizationOptions {
    return {
      collisionStrategy: organizeCollisionStrategy,
      cleanupEmptyFolders: organizeCleanupEmptyFolders,
      trackIds: currentScope(scopedTrackIds),
    };
  }

  function duplicateScopeForAction(): number[] {
    return duplicateTrackIds.length ? duplicateTrackIds : scopedTrackIds;
  }

  function deviceSyncOptions(apply = false) {
    return {
      playlistIds: Array.from(deviceSyncPlaylistIds),
      trackIds: currentScope(scopedTrackIds),
      copyFiles: deviceSyncCopyFiles,
      exportPlaylists: deviceSyncExportPlaylists,
      preserveStructure: deviceSyncPreserveStructure,
      apply,
    };
  }

  function toggleDeviceSyncPlaylist(playlistId: number) {
    setDeviceSyncPlaylistIds((current) => {
      const next = new Set(current);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  }

  function toggleFolderWatchChange(changeId: string) {
    setAcceptedFolderWatchIds((current) => {
      const next = new Set(current);
      if (next.has(changeId)) {
        next.delete(changeId);
      } else {
        next.add(changeId);
      }
      return next;
    });
  }

  function toggleAllFolderWatchChanges() {
    setAcceptedFolderWatchIds((current) =>
      current.size === folderWatchChanges.length ? new Set() : new Set(folderWatchChanges.map((change) => change.id)),
    );
  }

  function folderWatchTypeLabel(change: FolderWatchChange): string {
    if (change.change_type === "added") {
      return "Add";
    }
    if (change.change_type === "modified") {
      return "Update tags";
    }
    if (change.change_type === "removed") {
      return "Remove";
    }
    return "Move";
  }

  function folderWatchTrackLabel(change: FolderWatchChange): string {
    const title = change.title?.trim() || change.new_path?.split(/[\\/]/).pop() || change.old_path?.split(/[\\/]/).pop() || "Audio file";
    const artist = change.artist?.trim();
    return artist ? `${title} - ${artist}` : title;
  }

  function toggleAutoTagTrack(trackId: number) {
    setAcceptedAutoTagTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function autoTagFieldSummary(preview: NonNullable<typeof autoTagPreview>["previews"][number]): string {
    if (preview.error) {
      return preview.error;
    }
    if (!preview.changed_fields.length) {
      return preview.artwork_url ? "Artwork match only" : "Matched; no field changes";
    }
    return preview.changed_fields.join(", ");
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">File Management</h1>
          <p className="text-xs text-muted">Batch cleanup, duplicate review, metadata import, and safe file moves.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void onRefreshUndoLog()}>
          <RotateCcw size={15} />
          Refresh Log
        </button>
      </header>
      <section className="min-h-0 flex-1 overflow-auto p-6">
        <div className="grid max-w-4xl gap-5">
          <div className="rounded border border-line bg-panel p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="grid gap-2 text-sm text-neutral-200">
                <span className="text-xs uppercase text-muted">Track Scope IDs</span>
                <input
                  className="h-10 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={trackScopeText}
                  placeholder="Optional: paste track IDs, separated by commas or spaces. Blank means all previewed tracks."
                  onChange={(event) => setTrackScopeText(event.target.value)}
                />
              </label>
              <div className="rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                {scopedTrackIds.length ? `${scopedTrackIds.length.toLocaleString()} scoped` : "All tracks"}
              </div>
            </div>
          </div>

          <DisclosureSection title="Folder Watch" description="Background change detection with a review step before the database changes" defaultOpen>
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-2 py-1 text-xs uppercase ${
                        folderWatchStatus?.enabled
                          ? "border-moss/40 bg-moss/10 text-moss"
                          : "border-line bg-panel text-muted"
                      }`}
                    >
                      {folderWatchStatus?.enabled ? "watching" : "stopped"}
                    </span>
                    <span className="rounded border border-line bg-panel px-2 py-1 text-xs uppercase text-muted">
                      {folderWatchStatus?.status ?? "idle"}
                    </span>
                    <span className="rounded border border-line bg-panel px-2 py-1 text-xs uppercase text-muted">
                      {folderWatchStatus?.pending_count ?? 0} pending
                    </span>
                  </div>
                  <div className="mt-2 truncate text-xs text-muted" title={folderWatchStatus?.folder_path ?? folderPath}>
                    {(folderWatchStatus?.folder_path ?? folderPath) || "No watched folder yet"}
                  </div>
                  {folderWatchStatus?.error && <div className="mt-2 text-xs text-ember">{folderWatchStatus.error}</div>}
                </div>
                <div className="grid gap-2 sm:grid-cols-[130px_auto] sm:items-end">
                  <NumberField
                    label="Seconds"
                    min={10}
                    max={3600}
                    value={watchIntervalSeconds}
                    onChange={setWatchIntervalSeconds}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button className="secondary-button" type="button" onClick={() => void onRefreshFolderWatch()}>
                      <RefreshCw size={15} />
                      Check Now
                    </button>
                    <button className="secondary-button" type="button" onClick={() => void onStartFolderWatch(watchIntervalSeconds)}>
                      <Eye size={15} />
                      Watch
                    </button>
                    <button className="secondary-button" type="button" onClick={() => void onStopFolderWatch()}>
                      Stop
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                {(["added", "modified", "moved", "removed"] as const).map((kind) => (
                  <div key={kind} className="rounded border border-line/70 bg-ink px-3 py-2">
                    <div className="text-lg font-semibold text-white">{folderWatchStatus?.counts?.[kind] ?? 0}</div>
                    <div className="text-xs uppercase text-muted">
                      {kind === "modified" ? "updates" : kind}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={folderWatchChanges.length === 0}
                  onClick={toggleAllFolderWatchChanges}
                >
                  <ListChecks size={15} />
                  {acceptedFolderWatchIds.size === folderWatchChanges.length ? "Clear" : "Select All"}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">
                    {selectedWatchCount.toLocaleString()} selected
                    {folderWatchStatus && folderWatchStatus.pending_count > folderWatchChanges.length
                      ? `, showing ${folderWatchChanges.length.toLocaleString()} of ${folderWatchStatus.pending_count.toLocaleString()}`
                      : ""}
                  </span>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={selectedWatchCount === 0}
                    onClick={() => void onApplyFolderWatch(Array.from(acceptedFolderWatchIds), false)}
                  >
                    <CheckCircle2 size={15} />
                    Apply Selected
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={(folderWatchStatus?.pending_count ?? 0) === 0}
                    onClick={() => void onApplyFolderWatch([], true)}
                  >
                    Apply All
                  </button>
                </div>
              </div>

              {folderWatchChanges.length > 0 ? (
                <div className="max-h-96 overflow-auto rounded border border-line/70">
                  <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-panel text-[11px] uppercase text-muted">
                      <tr>
                        <th className="w-10 px-2 py-2">
                          <span className="sr-only">Apply</span>
                        </th>
                        <th className="px-2 py-2">Change</th>
                        <th className="px-2 py-2">Track</th>
                        <th className="px-2 py-2">Path</th>
                        <th className="px-2 py-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folderWatchChanges.map((change) => (
                        <tr key={change.id} className="border-t border-line/60 bg-ink/70">
                          <td className="px-2 py-2 align-top">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-moss"
                              checked={acceptedFolderWatchIds.has(change.id)}
                              onChange={() => toggleFolderWatchChange(change.id)}
                            />
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 align-top font-medium text-neutral-200">
                            {folderWatchTypeLabel(change)}
                          </td>
                          <td className="max-w-56 px-2 py-2 align-top">
                            <div className="truncate text-neutral-200" title={folderWatchTrackLabel(change)}>
                              {folderWatchTrackLabel(change)}
                            </div>
                            {change.album && <div className="truncate text-muted">{change.album}</div>}
                          </td>
                          <td className="max-w-80 px-2 py-2 align-top">
                            {change.change_type === "moved" ? (
                              <div className="grid gap-1">
                                <div className="truncate text-muted" title={change.old_path ?? undefined}>
                                  {change.old_path}
                                </div>
                                <div className="truncate text-neutral-200" title={change.new_path ?? undefined}>
                                  {change.new_path}
                                </div>
                              </div>
                            ) : (
                              <div className="truncate text-muted" title={change.new_path ?? change.old_path ?? undefined}>
                                {change.new_path ?? change.old_path}
                              </div>
                            )}
                          </td>
                          <td className="max-w-56 px-2 py-2 align-top">
                            <div className="truncate text-muted">{change.summary}</div>
                            {change.previous_modified_at && change.file_modified_at && (
                              <div className="truncate text-muted">
                                {change.previous_modified_at} {"->"} {change.file_modified_at}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded border border-line/70 bg-ink px-3 py-6 text-center text-xs text-muted">
                  No pending folder changes. The watcher will keep checking in the background while it is enabled.
                </div>
              )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="Filename Tag Inference" description="Infer metadata from folder and file naming patterns" defaultOpen>
            <div className="grid gap-4 text-sm text-neutral-200">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Pattern</span>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-9 min-w-0 flex-1 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                    value={allFilenameTagPresets.includes(filenameTagPattern) ? filenameTagPattern : ""}
                    onChange={(event) => {
                      if (event.target.value) {
                        setFilenameTagPattern(event.target.value);
                      }
                    }}
                  >
                    <option value="" disabled>
                      Choose saved pattern
                    </option>
                    {allFilenameTagPresets.map((pattern) => (
                      <option key={pattern} value={pattern}>
                        {pattern}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button h-9"
                    type="button"
                    disabled={!filenameTagPattern.trim() || allFilenameTagPresets.includes(filenameTagPattern.trim())}
                    onClick={saveCurrentFilenameTagPreset}
                  >
                    <Save size={15} />
                    Save
                  </button>
                  <button className="secondary-button h-9" type="button" disabled={!isCustomFilenameTagPreset} onClick={deleteCurrentFilenameTagPreset}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                  value={filenameTagPattern}
                  onChange={(event) => setFilenameTagPattern(event.target.value)}
                />
                {filenamePresetMessage && <span className="text-xs text-moss">{filenamePresetMessage}</span>}
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Only fill empty fields</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={filenameTagMissingOnly}
                    onChange={(event) => setFilenameTagMissingOnly(event.target.checked)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" type="button" onClick={exportFilenamePresets}>
                    <Download size={15} />
                    Export Presets
                  </button>
                  <button className="secondary-button" type="button" onClick={importFilenamePresets}>
                    <Upload size={15} />
                    Import Presets
                  </button>
                </div>
              </div>
              <textarea
                className="min-h-20 rounded border border-line bg-ink px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                value={filenamePresetJson}
                placeholder="Custom preset JSON appears here for export or paste an array here to import."
                onChange={(event) => setFilenamePresetJson(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void onLoadDuplicateReview(duplicateScopeForAction(), duplicateGroups)}
                >
                  <ListChecks size={15} />
                  Load Review
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void onPreviewFilenameTags(filenameTagPattern, filenameTagMissingOnly, currentScope(scopedTrackIds))}
                >
                  <Wand2 size={15} />
                  Preview Tags
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={Boolean(filenameTagPreview) && acceptedChangedFilenameIds.length === 0}
                  onClick={() =>
                    void onApplyFilenameTags(
                      filenameTagPattern,
                      filenameTagMissingOnly,
                      filenameTagPreview ? acceptedChangedFilenameIds : currentScope(scopedTrackIds),
                    )
                  }
                >
                  <FileText size={15} />
                  {filenameTagPreview ? "Apply Accepted" : "Apply Tags"}
                </button>
              </div>
              {filenameTagPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {filenameTagPreview.matches.toLocaleString()} matches, {filenameTagPreview.applied.toLocaleString()} applied,{" "}
                    {acceptedChangedFilenameIds.length.toLocaleString()} accepted changes
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {filenameTagPreview.previews.slice(0, 50).map((preview) => (
                      <label key={preview.track_id} className="grid grid-cols-[auto_1fr] gap-3 rounded bg-panel px-2 py-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-moss"
                          checked={acceptedFilenameTrackIds.has(preview.track_id)}
                          disabled={!preview.matched || preview.changed_fields.length === 0}
                          onChange={() => toggleAcceptedFilenameTrack(preview.track_id)}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-muted">{preview.path}</div>
                          <div className={preview.error ? "truncate text-ember" : "truncate text-neutral-200"}>
                            {preview.error ??
                              (preview.matched
                                ? preview.changed_fields.length
                                  ? preview.changed_fields.join(", ")
                                  : "Matched; no fields need changes"
                                : "No match")}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {duplicateReview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-neutral-200">
                      {duplicateReview.tracks.length.toLocaleString()} tracks loaded,{" "}
                      {duplicateReview.groups.length.toLocaleString()} review groups
                    </div>
                    {duplicateReview.missing_track_ids.length > 0 && (
                      <div className="text-ember">Missing IDs: {duplicateReview.missing_track_ids.join(", ")}</div>
                    )}
                  </div>
                  {duplicateReview.groups.length > 0 && (
                    <div className="mb-3 grid gap-1">
                      {duplicateReview.groups.slice(0, 10).map((group) => (
                        <div key={group.key} className="rounded bg-panel px-2 py-1.5">
                          <div className="truncate text-neutral-200">
                            {group.key} - keep #{group.recommended_keep_id ?? "?"}
                          </div>
                          <div className="truncate text-muted">{group.recommendation_reason ?? group.match_reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="max-h-80 overflow-auto rounded border border-line/70">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                      <thead className="sticky top-0 bg-panel text-[11px] uppercase text-muted">
                        <tr>
                          <th className="px-2 py-2">ID</th>
                          <th className="px-2 py-2">Title</th>
                          <th className="px-2 py-2">Artist</th>
                          <th className="px-2 py-2">Album</th>
                          <th className="px-2 py-2">Rating</th>
                          <th className="px-2 py-2">Bitrate</th>
                          <th className="px-2 py-2">Path</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicateReview.tracks.slice(0, 100).map((track) => (
                          <tr key={track.id} className="border-t border-line/60">
                            <td className="px-2 py-1.5 text-muted">{track.id}</td>
                            <td className="max-w-48 truncate px-2 py-1.5 text-neutral-200">{track.title ?? "(untitled)"}</td>
                            <td className="max-w-40 truncate px-2 py-1.5 text-muted">{track.artist ?? ""}</td>
                            <td className="max-w-40 truncate px-2 py-1.5 text-muted">{track.album ?? ""}</td>
                            <td className="px-2 py-1.5 text-muted">{track.rating ?? "-"}</td>
                            <td className="px-2 py-1.5 text-muted">{track.bitrate ? Math.round(track.bitrate / 1000) : "-"}</td>
                            <td className="max-w-72 truncate px-2 py-1.5 text-muted" title={track.path}>
                              {track.path}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="Regex Tag Cleanup" description="Preview and apply MusicBee-style search/replace for common text tags">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Field</span>
                  <select
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={tagRegexField}
                    onChange={(event) => setTagRegexField(event.target.value as typeof tagRegexField)}
                  >
                    <option value="title">Title</option>
                    <option value="artist">Artist</option>
                    <option value="album">Album</option>
                    <option value="album_artist">Album Artist</option>
                    <option value="genre">Genre</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Find Regex</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={tagRegexPattern}
                    placeholder="Example: \\s+feat\\..*$"
                    onChange={(event) => setTagRegexPattern(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Replace With</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={tagRegexReplacement}
                    placeholder="Leave blank to remove matches"
                    onChange={(event) => setTagRegexReplacement(event.target.value)}
                  />
                </label>
              </div>
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                <span className="text-muted">Case sensitive match</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={tagRegexCaseSensitive}
                  onChange={(event) => setTagRegexCaseSensitive(event.target.checked)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    void onPreviewTagRegex(
                      tagRegexField,
                      tagRegexPattern,
                      tagRegexReplacement,
                      tagRegexCaseSensitive,
                      currentScope(scopedTrackIds),
                    )
                  }
                >
                  <Eye size={15} />
                  Preview Replace
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={(tagRegexPreview?.changed ?? 1) === 0}
                  onClick={() =>
                    void onApplyTagRegex(
                      tagRegexField,
                      tagRegexPattern,
                      tagRegexReplacement,
                      tagRegexCaseSensitive,
                      currentScope(scopedTrackIds),
                    )
                  }
                >
                  <Wand2 size={15} />
                  Apply Replace
                </button>
              </div>
              {tagRegexPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {tagRegexPreview.changed.toLocaleString()} changed, {tagRegexPreview.applied.toLocaleString()} applied
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {tagRegexPreview.previews.slice(0, 60).map((preview) => (
                      <div key={preview.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-muted">{preview.path}</div>
                        <div className={preview.error ? "truncate text-ember" : preview.changed ? "truncate text-neutral-200" : "truncate text-muted"}>
                          {preview.error ??
                            (preview.changed
                              ? `${preview.current ?? ""} -> ${preview.replacement ?? ""}`
                              : "No change")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="MusicBrainz Auto-Tag" description="Preview album or track matches, missing-field fills, and Cover Art Archive artwork">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Match Mode</span>
                  <select
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={autoTagMode}
                    onChange={(event) => setAutoTagMode(event.target.value as "album" | "track")}
                  >
                    <option value="album">Album / release</option>
                    <option value="track">Individual tracks</option>
                  </select>
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                    <span className="text-muted">Missing only</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={autoTagMissingOnly}
                      onChange={(event) => setAutoTagMissingOnly(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                    <span className="text-muted">Find artwork</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={autoTagIncludeArtwork}
                      onChange={(event) => setAutoTagIncludeArtwork(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                    <span className="text-muted">Save cover</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={autoTagSaveArtwork}
                      onChange={(event) => setAutoTagSaveArtwork(event.target.checked)}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  {scopedTrackIds.length
                    ? `${scopedTrackIds.length.toLocaleString()} scoped track${scopedTrackIds.length === 1 ? "" : "s"}`
                    : "Blank scope uses recently added tracks with missing metadata"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void onPreviewAutoTag(autoTagMode, autoTagMissingOnly, autoTagIncludeArtwork, currentScope(scopedTrackIds))}
                  >
                    <Eye size={15} />
                    Preview Matches
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={Boolean(autoTagPreview) && autoTagChangedIds.length === 0 && (!autoTagSaveArtwork || autoTagArtworkIds.length === 0)}
                    onClick={() =>
                      void onApplyAutoTag(
                        autoTagMode,
                        autoTagMissingOnly,
                        autoTagIncludeArtwork,
                        autoTagSaveArtwork,
                        autoTagPreview
                          ? Array.from(new Set([...autoTagChangedIds, ...(autoTagSaveArtwork ? autoTagArtworkIds : [])]))
                          : currentScope(scopedTrackIds),
                      )
                    }
                  >
                    <Wand2 size={15} />
                    {autoTagPreview ? "Apply Accepted" : "Apply Auto-Tags"}
                  </button>
                </div>
              </div>

              {autoTagPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-3 grid gap-2 sm:grid-cols-4">
                    <div>
                      <div className="font-semibold text-white">{autoTagPreview.matched}</div>
                      <div className="text-muted">Matched</div>
                    </div>
                    <div>
                      <div className="font-semibold text-moss">{autoTagPreview.changed}</div>
                      <div className="text-muted">With changes</div>
                    </div>
                    <div>
                      <div className="font-semibold text-ember">{autoTagPreview.artwork_matches}</div>
                      <div className="text-muted">Artwork matches</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{acceptedAutoTagTrackIds.size}</div>
                      <div className="text-muted">Accepted</div>
                    </div>
                  </div>
                  <div className="grid max-h-96 gap-1 overflow-auto pr-1">
                    {autoTagPreview.previews.slice(0, 80).map((preview) => (
                      <label key={preview.track_id} className="grid grid-cols-[auto_52px_1fr] gap-3 rounded bg-panel px-2 py-2">
                        <input
                          type="checkbox"
                          className="mt-4 h-4 w-4 accent-moss"
                          checked={acceptedAutoTagTrackIds.has(preview.track_id)}
                          disabled={Boolean(preview.error) || (preview.changed_fields.length === 0 && !preview.artwork_url)}
                          onChange={() => toggleAutoTagTrack(preview.track_id)}
                        />
                        <div className="h-12 w-12 overflow-hidden rounded border border-line bg-ink">
                          {preview.artwork_thumbnail_url ? (
                            <img className="h-full w-full object-cover" src={preview.artwork_thumbnail_url} alt="" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-muted">No art</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-neutral-200">
                              {preview.proposed.title ? String(preview.proposed.title) : preview.path.split(/[\\/]/).pop()}
                            </span>
                            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">
                              {(preview.confidence * 100).toFixed(0)}%
                            </span>
                            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">
                              {preview.match_type}
                            </span>
                          </div>
                          <div className="truncate text-muted">
                            {[preview.proposed.artist, preview.proposed.album].filter(Boolean).map(String).join(" - ")}
                          </div>
                          <div className={preview.error ? "truncate text-ember" : "truncate text-moss"}>
                            {autoTagFieldSummary(preview)}
                          </div>
                          {preview.release_title && (
                            <div className="truncate text-muted">
                              Release: {preview.release_title}
                              {preview.release_id ? ` (${preview.release_id})` : ""}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  {autoTagPreview.errors.length > 0 && (
                    <details className="mt-3 text-xs text-ember">
                      <summary>Auto-tag errors</summary>
                      <div className="mt-2 grid gap-1">
                        {autoTagPreview.errors.slice(0, 20).map((error) => (
                          <div key={error} className="truncate">{error}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="File Organizer" description="Preview tag-based moves and export a review report">
            <div className="grid gap-4 text-sm text-neutral-200">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Template</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                  value={organizeTemplate}
                  onChange={(event) => setOrganizeTemplate(event.target.value)}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Base Folder</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={organizeBaseFolder}
                  placeholder={folderPath || "Leave empty to use the music folder"}
                  onChange={(event) => setOrganizeBaseFolder(event.target.value)}
                />
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Name Collisions</span>
                  <select
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={organizeCollisionStrategy}
                    onChange={(event) => setOrganizeCollisionStrategy(event.target.value as "skip" | "auto_rename")}
                  >
                    <option value="skip">Skip existing files</option>
                    <option value="auto_rename">Auto-rename with (2)</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Remove empty source folders</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={organizeCleanupEmptyFolders}
                    onChange={(event) => setOrganizeCleanupEmptyFolders(event.target.checked)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onPreviewFileOrganization(organizeTemplate, organizeBaseFolder, organizationOptions())}>
                  <Eye size={15} />
                  Preview Moves
                </button>
                <button className="secondary-button" type="button" onClick={() => void onExportFileOrganizationReport(organizeTemplate, organizeBaseFolder, organizationOptions())}>
                  <Download size={15} />
                  Export Report
                </button>
                <button className="primary-button" type="button" onClick={() => void onApplyFileOrganization(organizeTemplate, organizeBaseFolder, organizationOptions())}>
                  <FolderOpen size={15} />
                  Move Files
                </button>
              </div>
              {fileOrganizationPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {fileOrganizationPreview.changed_count.toLocaleString()} possible moves, {fileOrganizationPreview.applied.toLocaleString()} applied
                    {fileOrganizationPreview.removed_empty_folders
                      ? `, ${fileOrganizationPreview.removed_empty_folders.toLocaleString()} empty folders removed`
                      : ""}
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {fileOrganizationPreview.changes.slice(0, 50).map((change) => (
                      <div key={change.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-muted">{change.current_path}</div>
                        <div className={change.error || change.collision ? "truncate text-ember" : "truncate text-neutral-200"}>
                          {change.target_path}
                          {change.collision ? " - collision" : ""}
                          {change.error ? ` - ${change.error}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fileOrganizationReport && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div className="truncate">{fileOrganizationReport.report_path}</div>
                  <div>
                    {fileOrganizationReport.changed_count.toLocaleString()} changes, {fileOrganizationReport.collisions.toLocaleString()} collisions
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="Device Sync Folder" description="Preview copy jobs and playlist exports for a phone, USB drive, or portable player">
            <div className="grid gap-4 text-sm text-neutral-200">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Target Folder</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={deviceSyncTarget}
                  placeholder="Example: E:\\Music"
                  onChange={(event) => setDeviceSyncTarget(event.target.value)}
                />
              </label>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Copy audio files</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncCopyFiles}
                    onChange={(event) => setDeviceSyncCopyFiles(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Export playlists</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncExportPlaylists}
                    onChange={(event) => setDeviceSyncExportPlaylists(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Preserve folders</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncPreserveStructure}
                    onChange={(event) => setDeviceSyncPreserveStructure(event.target.checked)}
                  />
                </label>
              </div>
              <div className="rounded border border-line bg-ink p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs uppercase text-muted">Playlists</div>
                  <button
                    className="text-xs text-moss hover:text-white"
                    type="button"
                    onClick={() =>
                      setDeviceSyncPlaylistIds(
                        deviceSyncPlaylistIds.size === playlists.length
                          ? new Set()
                          : new Set(playlists.map((playlist) => playlist.id)),
                      )
                    }
                  >
                    {deviceSyncPlaylistIds.size === playlists.length ? "Clear" : "Select all"}
                  </button>
                </div>
                <div className="grid max-h-48 gap-1 overflow-auto pr-1">
                  {playlists.map((playlist) => (
                    <label key={playlist.id} className="flex items-center justify-between gap-3 rounded bg-panel px-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-neutral-200">{playlist.name}</span>
                        <span className="block truncate text-xs text-muted">{playlist.track_count.toLocaleString()} tracks</span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-moss"
                        checked={deviceSyncPlaylistIds.has(playlist.id)}
                        onChange={() => toggleDeviceSyncPlaylist(playlist.id)}
                      />
                    </label>
                  ))}
                  {playlists.length === 0 && <div className="py-4 text-center text-xs text-muted">No playlists yet.</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onDeviceSync(deviceSyncTarget, deviceSyncOptions(false))}>
                  <Eye size={15} />
                  Preview Sync
                </button>
                <button className="primary-button" type="button" onClick={() => void onDeviceSync(deviceSyncTarget, deviceSyncOptions(true))}>
                  <FolderOpen size={15} />
                  Sync Folder
                </button>
              </div>
              {deviceSyncPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {deviceSyncPreview.changed_files.toLocaleString()} files need copy,{" "}
                    {deviceSyncPreview.copied_files.toLocaleString()} copied,{" "}
                    {deviceSyncPreview.playlists_written.toLocaleString()} playlists written
                  </div>
                  {deviceSyncPreview.playlist_exports.length > 0 && (
                    <div className="mb-3 grid gap-1">
                      {deviceSyncPreview.playlist_exports.map((playlist) => (
                        <div key={playlist.playlist_id} className="rounded bg-panel px-2 py-1.5">
                          <div className={playlist.error ? "truncate text-ember" : "truncate text-neutral-200"}>
                            {playlist.name} - {playlist.track_count.toLocaleString()} tracks
                          </div>
                          <div className="truncate text-muted">{playlist.error ?? playlist.playlist_path}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {deviceSyncPreview.changes.slice(0, 60).map((change) => (
                      <div key={change.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-neutral-200">{change.title ?? change.source_path}</div>
                        <div className={change.error ? "truncate text-ember" : "truncate text-muted"}>
                          {change.error ?? change.target_path}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="CSV Metadata Import" description="Spreadsheet cleanup with saved mappings, conflict review, and blank-field control">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onExportMetadataCsv(currentScope(scopedTrackIds))}>
                  <Download size={15} />
                  Export CSV
                </button>
                {metadataCsvExport && (
                  <button className="secondary-button" type="button" onClick={() => setMetadataCsvPath(metadataCsvExport.csv_path)}>
                    <FileText size={15} />
                    Use Last Export
                  </button>
                )}
              </div>
              {metadataCsvExport && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div className="truncate">{metadataCsvExport.csv_path}</div>
                  <div>{metadataCsvExport.track_count.toLocaleString()} tracks exported</div>
                </div>
              )}
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Import CSV Path</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={metadataCsvPath}
                  placeholder="Paste the exported CSV path"
                  onChange={(event) => setMetadataCsvPath(event.target.value)}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Saved Mapping Profile</span>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="h-9 min-w-0 flex-1 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={csvProfileName}
                      onChange={(event) => loadCsvProfile(event.target.value)}
                    >
                      <option value="">Choose profile</option>
                      {csvProfiles.map((profile) => (
                        <option key={profile.name} value={profile.name}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-9 min-w-44 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={csvProfileName}
                      placeholder="Profile name"
                      onChange={(event) => setCsvProfileName(event.target.value)}
                    />
                  </div>
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <button className="secondary-button h-9" type="button" onClick={saveCsvProfile}>
                    <Save size={15} />
                    Save
                  </button>
                  <button className="secondary-button h-9" type="button" disabled={!csvProfileName.trim()} onClick={deleteCsvProfile}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Column Map JSON</span>
                <textarea
                  className="min-h-24 rounded border border-line bg-ink px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={csvColumnMapText}
                  placeholder='{"title":"Title","artist":"Artist","rating":"Stars"}'
                  onChange={(event) => setCsvColumnMapText(event.target.value)}
                />
              </label>
              {csvProfileMessage && <div className="text-xs text-moss">{csvProfileMessage}</div>}
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Only fill empty fields on import</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={metadataCsvMissingOnly}
                    onChange={(event) => setMetadataCsvMissingOnly(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Clear fields when CSV cells are blank</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={metadataCsvClearBlankFields}
                    onChange={(event) => setMetadataCsvClearBlankFields(event.target.checked)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => withCsvOptions((options) => onPreviewMetadataCsv(metadataCsvPath, metadataCsvMissingOnly, options))}>
                  <EyeOff size={15} />
                  Preview Import
                </button>
                <button className="secondary-button" type="button" onClick={() => withCsvOptions((options) => onExportMetadataCsvReport(metadataCsvPath, metadataCsvMissingOnly, options))}>
                  <Download size={15} />
                  Export Dry Run
                </button>
                <button className="primary-button" type="button" onClick={() => withCsvOptions((options) => onApplyMetadataCsv(metadataCsvPath, metadataCsvMissingOnly, options))}>
                  <Upload size={15} />
                  Import CSV
                </button>
              </div>
              {metadataCsvImportPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {metadataCsvImportPreview.changed.toLocaleString()} changed rows, {metadataCsvImportPreview.applied.toLocaleString()} applied
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {metadataCsvImportPreview.previews.slice(0, 50).map((preview) => (
                      <div key={`${preview.row_number}-${preview.track_id ?? "missing"}`} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-muted">
                          Row {preview.row_number}
                          {preview.path ? ` - ${preview.path}` : ""}
                        </div>
                        <div className={preview.error ? "truncate text-ember" : "truncate text-neutral-200"}>
                          {preview.error ??
                            (preview.changed_fields.length
                              ? preview.changed_fields.join(", ")
                              : preview.matched
                                ? "Matched; no fields need changes"
                                : "No match")}
                        </div>
                        {preview.conflict_fields.length > 0 && (
                          <div className="text-ember">
                            Conflicts:{" "}
                            {preview.conflict_fields
                              .map((field) => `${field} ${previewLabel(preview.current[field])} -> ${previewLabel(preview.imported[field])}`)
                              .join("; ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {metadataCsvImportReport && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div className="truncate">{metadataCsvImportReport.report_path}</div>
                  <div>
                    {metadataCsvImportReport.changed.toLocaleString()} changed rows, {metadataCsvImportReport.errors.toLocaleString()} errors captured
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="Duplicate Review" description="Keep the best copy, remove selected tracks, reveal files, or export a duplicate report">
            <div className="grid gap-4 text-sm text-neutral-200">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Duplicate Track IDs</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={duplicateTrackIdsText}
                  placeholder="Optional override. Blank uses the global scope IDs."
                  onChange={(event) => setDuplicateTrackIdsText(event.target.value)}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Keep-Best Groups</span>
                <textarea
                  className="min-h-20 rounded border border-line bg-ink px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={duplicateGroupsText}
                  placeholder="One duplicate group per line, for example: 12, 34, 56"
                  onChange={(event) => setDuplicateGroupsText(event.target.value)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                <span className="text-muted">Also delete files from disk</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={duplicateDeleteFiles}
                  onChange={(event) => setDuplicateDeleteFiles(event.target.checked)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    void onDuplicateAction({
                      action: "export_report",
                      track_ids: duplicateScopeForAction(),
                    })
                  }
                >
                  <Download size={15} />
                  Export Report
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!duplicateScopeForAction().length}
                  onClick={() => void onRevealTracksByIds(duplicateScopeForAction())}
                >
                  <FolderOpen size={15} />
                  Reveal Selected
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!duplicateScopeForAction().length && duplicateGroups.length === 0}
                  onClick={() =>
                    void onDuplicateAction({
                      action: "keep_best",
                      track_ids: duplicateScopeForAction(),
                      groups: duplicateGroups,
                      delete_files: duplicateDeleteFiles,
                    })
                  }
                >
                  <CheckCircle2 size={15} />
                  Keep Best
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!duplicateScopeForAction().length}
                  onClick={() =>
                    void onDuplicateAction({
                      action: "remove_selected",
                      track_ids: duplicateScopeForAction(),
                      delete_files: duplicateDeleteFiles,
                    })
                  }
                >
                  <Trash2 size={15} />
                  Remove Selected
                </button>
              </div>
              {duplicateActionResult && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div>
                    {duplicateActionResult.action}: {duplicateActionResult.affected.toLocaleString()} affected
                    {duplicateActionResult.deleted_files ? `, ${duplicateActionResult.deleted_files.toLocaleString()} files deleted` : ""}
                  </div>
                  {duplicateActionResult.report_path && <div className="truncate">{duplicateActionResult.report_path}</div>}
                  {duplicateActionResult.errors.map((error) => (
                    <div key={error} className="truncate text-ember">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DisclosureSection>

          <DisclosureSection title="Acoustic Fingerprints" description="Optional Chromaprint fpcalc pass for stronger duplicate matching">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="rounded border border-line bg-ink p-3 text-xs">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className={chromaprintSetup?.available ? "font-medium text-moss" : "font-medium text-ember"}>
                    {chromaprintSetup?.available ? "Chromaprint ready" : "Chromaprint setup needed"}
                  </div>
                  <button className="secondary-button h-8" type="button" onClick={() => void onRefreshChromaprintSetup()}>
                    <RefreshCw size={14} />
                    Check
                  </button>
                </div>
                <div className="text-muted">{chromaprintSetup?.message ?? "Checking fpcalc setup"}</div>
                {chromaprintSetup?.resolved_path && <div className="mt-1 truncate text-muted">Using {chromaprintSetup.resolved_path}</div>}
                {chromaprintSetup?.version && <div className="mt-1 truncate text-muted">{chromaprintSetup.version}</div>}
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={fpcalcPath}
                    placeholder={chromaprintSetup?.tool_directory ? `${chromaprintSetup.tool_directory}\\fpcalc.exe` : "Path to fpcalc.exe"}
                    onChange={(event) => setFpcalcPath(event.target.value)}
                  />
                  <button className="secondary-button h-9" type="button" onClick={() => void onSaveChromaprintSetup(fpcalcPath.trim() || null)}>
                    <Save size={15} />
                    Save Path
                  </button>
                  <button className="secondary-button h-9" type="button" onClick={() => void onSaveChromaprintSetup(null)}>
                    Clear
                  </button>
                  <button className="primary-button h-9" type="button" onClick={() => void onInstallChromaprintTool()}>
                    <Download size={15} />
                    Download
                  </button>
                </div>
                {chromaprintSetup?.tool_directory && (
                  <div className="mt-2 truncate text-muted">
                    Portable option: put fpcalc.exe in {chromaprintSetup.tool_directory}; PATH is optional.
                  </div>
                )}
                {chromaprintSetup?.errors.map((error) => (
                  <div key={error} className="mt-1 truncate text-ember">
                    {error}
                  </div>
                ))}
                {chromaprintInstallResult && (
                  <div className={chromaprintInstallResult.installed ? "mt-2 text-moss" : "mt-2 text-ember"}>
                    {chromaprintInstallResult.message}
                    {chromaprintInstallResult.fpcalc_path ? ` ${chromaprintInstallResult.fpcalc_path}` : ""}
                  </div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <NumberField label="Fingerprint Limit" value={acousticLimit} min={1} max={10000} onChange={setAcousticLimit} />
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Overwrite existing fingerprints</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={acousticOverwrite}
                    onChange={(event) => setAcousticOverwrite(event.target.checked)}
                  />
                </label>
              </div>
              <button
                className="secondary-button w-fit"
                type="button"
                onClick={() => void onRunAcousticFingerprintPass(currentScope(scopedTrackIds), acousticOverwrite, acousticLimit)}
              >
                <Fingerprint size={15} />
                Analyze Fingerprints
              </button>
              {acousticFingerprintResult && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div>
                    {acousticFingerprintResult.tool_available ? "fpcalc available" : "fpcalc missing"} -{" "}
                    {acousticFingerprintResult.updated.toLocaleString()} updated, {acousticFingerprintResult.skipped.toLocaleString()} skipped
                  </div>
                  {acousticFingerprintResult.errors.map((error) => (
                    <div key={error} className="truncate text-ember">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DisclosureSection>

          <ReportViewerSection
            reportPath={reportPath}
            setReportPath={setReportPath}
            fileOrganizationReport={fileOrganizationReport}
            metadataCsvImportReport={metadataCsvImportReport}
            duplicateActionResult={duplicateActionResult}
            reportFile={reportFile}
            onReadReportFile={onReadReportFile}
          />

          <CacheUndoLogSection
            bulkUndoLog={bulkUndoLog}
            bulkUndoBatches={bulkUndoBatches}
            bulkUndoRestoreResult={bulkUndoRestoreResult}
            onRefreshUndoLog={onRefreshUndoLog}
            onRestoreUndoEntry={onRestoreUndoEntry}
            onRestoreUndoBatch={onRestoreUndoBatch}
            onClearArtistCache={onClearArtistCache}
            onClearLibraryCaches={onClearLibraryCaches}
          />
        </div>
      </section>
    </main>
  );
}
