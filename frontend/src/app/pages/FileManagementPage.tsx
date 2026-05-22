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
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  BulkUndoRestoreResponse,
  ChromaprintInstallResponse,
  CacheClearTarget,
  ChromaprintStatusResponse,
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  DuplicateActionRequest,
  DuplicateActionResponse,
  DuplicateReviewResponse,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  FilenameTagInferenceResponse,
  ReportFileResponse,
} from "../../types/api";
import {
  DisclosureSection,
  NumberField,
} from "../components/common";

const DEFAULT_FILENAME_TAG_PATTERNS = [
  "<Album Artist> - <Album> [<Year>]/<Track#> - <Artist> - <Title>",
  "<Album Artist>/<Album>/<Track#> - <Title>",
  "<Artist> - <Album>/<Disc#>-<Track#> - <Title>",
  "<Genre>/<Artist>/<Album> (<Year>)/<Track#> - <Title>",
];

const FILENAME_TAG_PRESETS_KEY = "flacCafeFilenameTagPresets";
const CSV_IMPORT_PROFILES_KEY = "flacCafeCsvImportProfiles";

const CSV_IMPORT_FIELDS = [
  "title",
  "artist",
  "album",
  "album_artist",
  "track_number",
  "disc_number",
  "genre",
  "year",
  "rating",
] as const;

type FileOrganizationOptions = {
  collisionStrategy?: "skip" | "auto_rename";
  cleanupEmptyFolders?: boolean;
  trackIds?: number[] | null;
};

type CsvImportOptions = {
  trackIds?: number[] | null;
  columnMap?: Record<string, string>;
  clearBlankFields?: boolean;
};

interface CsvImportProfile {
  name: string;
  columnMap: Record<string, string>;
  missingOnly: boolean;
  clearBlankFields: boolean;
}

function readFilenameTagPresets(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILENAME_TAG_PRESETS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function writeFilenameTagPresets(patterns: string[]) {
  window.localStorage.setItem(FILENAME_TAG_PRESETS_KEY, JSON.stringify(patterns));
}

function readCsvProfiles(): CsvImportProfile[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CSV_IMPORT_PROFILES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((profile): profile is CsvImportProfile => {
        return Boolean(
          profile &&
            typeof profile.name === "string" &&
            profile.name.trim() &&
            typeof profile.columnMap === "object" &&
            !Array.isArray(profile.columnMap),
        );
      })
      .map((profile) => ({
        name: profile.name.trim(),
        columnMap: profile.columnMap,
        missingOnly: profile.missingOnly !== false,
        clearBlankFields: Boolean(profile.clearBlankFields),
      }));
  } catch {
    return [];
  }
}

function writeCsvProfiles(profiles: CsvImportProfile[]) {
  window.localStorage.setItem(CSV_IMPORT_PROFILES_KEY, JSON.stringify(profiles));
}

function parseTrackIds(text: string): number[] {
  return Array.from(
    new Set(
      text
        .split(/[,\s]+/)
        .map((chunk) => Number(chunk.trim()))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
}

function parseDuplicateGroups(text: string): number[][] {
  return text
    .split(/\r?\n/)
    .map((line) => parseTrackIds(line))
    .filter((group) => group.length > 1);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function previewLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "(blank)";
  }
  return String(value);
}

function currentScope(trackIds: number[]): number[] | null {
  return trackIds.length ? trackIds : null;
}

function reportSummary(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "JSON report";
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["total", "matched", "changed", "changed_count", "errors", "profile_count"]) {
    const item = record[key];
    if (typeof item === "number") {
      parts.push(`${key.replace("_", " ")}: ${item.toLocaleString()}`);
    }
  }
  if (Array.isArray(record.groups)) {
    parts.push(`groups: ${record.groups.length.toLocaleString()}`);
  }
  if (Array.isArray(record.previews)) {
    parts.push(`previews: ${record.previews.length.toLocaleString()}`);
  }
  if (Array.isArray(record.comparisons)) {
    parts.push(`comparisons: ${record.comparisons.length.toLocaleString()}`);
  }
  return parts.length ? parts.join(" / ") : "JSON report";
}

function canRestoreUndo(actionType: string): boolean {
  return ["csv_metadata_import", "file_organization", "track_remove"].includes(actionType);
}

export function FileManagementPage({
  folderPath,
  onClearArtistCache,
  onClearLibraryCaches,
  filenameTagPreview,
  onPreviewFilenameTags,
  onApplyFilenameTags,
  fileOrganizationPreview,
  fileOrganizationReport,
  onPreviewFileOrganization,
  onApplyFileOrganization,
  onExportFileOrganizationReport,
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
  onClearArtistCache: () => void;
  onClearLibraryCaches: (targets: CacheClearTarget[]) => void | Promise<void>;
  filenameTagPreview: FilenameTagInferenceResponse | null;
  onPreviewFilenameTags: (pattern: string, missingOnly: boolean, trackIds?: number[] | null) => void | Promise<void>;
  onApplyFilenameTags: (pattern: string, missingOnly: boolean, trackIds?: number[] | null) => void | Promise<void>;
  fileOrganizationPreview: FileOrganizationResponse | null;
  fileOrganizationReport: FileOrganizationReportResponse | null;
  onPreviewFileOrganization: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => void | Promise<void>;
  onApplyFileOrganization: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => void | Promise<void>;
  onExportFileOrganizationReport: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => void | Promise<void>;
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
  const [organizeTemplate, setOrganizeTemplate] = useState("<Album Artist>/<Album> (<Year>)/<Track#> - <Title>");
  const [organizeBaseFolder, setOrganizeBaseFolder] = useState("");
  const [organizeCollisionStrategy, setOrganizeCollisionStrategy] = useState<"skip" | "auto_rename">("skip");
  const [organizeCleanupEmptyFolders, setOrganizeCleanupEmptyFolders] = useState(false);
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

          <DisclosureSection title="Report Viewer" description="Open JSON reports from CSV imports, file organization, duplicate review, or AutoDJ profile comparison">
            <div className="grid gap-4 text-sm text-neutral-200">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Report Path</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={reportPath}
                  placeholder="Paste a FLAC Cafe JSON report path"
                  onChange={(event) => setReportPath(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onReadReportFile(reportPath)}>
                  <Eye size={15} />
                  View Report
                </button>
                {fileOrganizationReport?.report_path && (
                  <button className="secondary-button" type="button" onClick={() => {
                    setReportPath(fileOrganizationReport.report_path);
                    void onReadReportFile(fileOrganizationReport.report_path);
                  }}>
                    File Moves
                  </button>
                )}
                {metadataCsvImportReport?.report_path && (
                  <button className="secondary-button" type="button" onClick={() => {
                    setReportPath(metadataCsvImportReport.report_path);
                    void onReadReportFile(metadataCsvImportReport.report_path);
                  }}>
                    CSV Dry Run
                  </button>
                )}
                {duplicateActionResult?.report_path && (
                  <button className="secondary-button" type="button" onClick={() => {
                    setReportPath(duplicateActionResult.report_path ?? "");
                    if (duplicateActionResult.report_path) {
                      void onReadReportFile(duplicateActionResult.report_path);
                    }
                  }}>
                    Duplicates
                  </button>
                )}
              </div>
              {reportFile && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-neutral-200">{reportFile.report_path}</div>
                      <div className="text-muted">
                        {reportFile.exists
                          ? `${reportFile.size_bytes.toLocaleString()} bytes${reportFile.modified_at ? `, ${new Date(reportFile.modified_at).toLocaleString()}` : ""}`
                          : reportFile.error ?? "Report not found"}
                      </div>
                    </div>
                    {reportFile.truncated && <span className="rounded border border-ember/40 px-2 py-1 text-ember">truncated</span>}
                  </div>
                  {reportFile.parsed_json !== null && (
                    <div className="mb-2 rounded bg-panel px-2 py-1.5 text-muted">{reportSummary(reportFile.parsed_json)}</div>
                  )}
                  {reportFile.error && <div className="mb-2 text-ember">{reportFile.error}</div>}
                  <pre className="max-h-96 overflow-auto rounded bg-panel p-3 font-mono text-[11px] leading-5 text-muted">
                    {reportFile.parsed_json !== null ? formatJson(reportFile.parsed_json) : reportFile.raw_text ?? ""}
                  </pre>
                </div>
              )}
            </div>
          </DisclosureSection>

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
        </div>
      </section>
    </main>
  );
}
