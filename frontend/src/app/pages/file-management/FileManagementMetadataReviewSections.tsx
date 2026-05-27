import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Fingerprint,
  FolderOpen,
  ListChecks,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";

import type {
  AcousticFingerprintResponse,
  AutoTagResponse,
  ChromaprintStatusResponse,
  ClapGenreTagResponse,
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  DeviceSyncDetectedDevice,
  DeviceSyncProfile,
  DeviceSyncProfilePayload,
  DeviceSyncResponse,
  DuplicateActionResponse,
  DuplicateReviewResponse,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  FilenameTagInferenceResponse,
  PlaylistSummary,
  TagRegexReplaceResponse,
  TrackFileMetadataWriteResponse,
} from "../../../types/api";
import {
  DisclosureSection,
  NumberField,
} from "../../components/common";
import { AdvancedTagToolsSection } from "./AdvancedTagToolsSection";
import {
  CSV_IMPORT_FIELDS,
  currentScope,
  formatJson,
  previewLabel,
} from "./fileManagementUtils";
import type {
  CsvImportOptions,
  CsvImportProfile,
} from "./fileManagementUtils";
import {
  openExternalUrl,
} from "../../../lib/externalLinks";

const ACOUSTID_API_KEY_URL = "https://acoustid.org/api-key";

export function FileManagementMetadataReviewSections({ model }: { model: any }) {
  const metadataCsvExport = model.metadataCsvExport as CsvMetadataExportResponse | null;
  const metadataCsvImportPreview = model.metadataCsvImportPreview as CsvMetadataImportResponse | null;
  const metadataCsvImportReport = model.metadataCsvImportReport as CsvMetadataImportReportResponse | null;
  const duplicateActionResult = model.duplicateActionResult as DuplicateActionResponse | null;
  const duplicateReview = model.duplicateReview as DuplicateReviewResponse | null;
  const chromaprintSetup = model.chromaprintSetup as ChromaprintStatusResponse | null;
  const acousticFingerprintResult = model.acousticFingerprintResult as AcousticFingerprintResponse | null;
  const duplicateTrackIds = model.duplicateTrackIds as number[];
  const duplicateGroups = model.duplicateGroups as number[][];
  const scopedTrackIds = model.scopedTrackIds as number[];
  const csvProfiles = model.csvProfiles as CsvImportProfile[];
  const autoTagPreview = model.autoTagPreview as AutoTagResponse | null;
  const acceptedAutoTagTrackIds = model.acceptedAutoTagTrackIds as Set<number>;
  const fingerprintAutoTagIds = model.fingerprintAutoTagIds as number[];
  const withCsvOptions = model.withCsvOptions as (action: (options: CsvImportOptions) => void | Promise<void>) => void;
  const {
    showTool, openSignalFor, initialFocusToolId, metadataCsvPath, setMetadataCsvPath, metadataCsvMissingOnly, setMetadataCsvMissingOnly, metadataCsvClearBlankFields, setMetadataCsvClearBlankFields, csvColumnMapText, setCsvColumnMapText, csvProfileName, setCsvProfileName, csvProfileMessage, saveCsvProfile, loadCsvProfile, deleteCsvProfile, onExportMetadataCsv, onPreviewMetadataCsv, onApplyMetadataCsv, onExportMetadataCsvReport, onAdvancedTagLibraryChanged,
    duplicateTrackIdsText, setDuplicateTrackIdsText, duplicateGroupsText, setDuplicateGroupsText, duplicateDeleteFiles, setDuplicateDeleteFiles, duplicateScopeForAction, onDuplicateAction, onLoadDuplicateReview, onRevealTracksByIds,
    fpcalcPath, setFpcalcPath, onRefreshChromaprintSetup, onSaveChromaprintSetup, acousticOverwrite, setAcousticOverwrite, acousticLimit, setAcousticLimit, analyzeAcousticFingerprints, setStatus, onOpenApiKeysSettings,
    fingerprintTagMissingOnly, setFingerprintTagMissingOnly, fingerprintTagSaveArtwork, setFingerprintTagSaveArtwork, fingerprintTagWriteToFiles, setFingerprintTagWriteToFiles, previewAcousticFingerprintTags, applyAcousticFingerprintTags,
    autoTagPreviewSource, toggleAutoTagTrack,
  } = model;
  const autoTagFieldSummary = model.autoTagFieldSummary as (preview: AutoTagResponse["previews"][number]) => string;
  const autoTagChangeDetails = model.autoTagChangeDetails as (preview: AutoTagResponse["previews"][number]) => string[];

  return (
    <>
          {showTool("csvMetadata") && (
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
          )}

          {showTool("advancedTags") && (
          <AdvancedTagToolsSection
            scopedTrackIds={scopedTrackIds}
            onLibraryChanged={onAdvancedTagLibraryChanged}
            setStatus={setStatus}
          />
          )}

          {showTool("duplicates") && (
          <DisclosureSection title="Duplicate Review" description="Keep the best copy, remove selected tracks, reveal files, or export a duplicate report">
            <div className="grid gap-4 text-sm text-neutral-200">
              <details className="rounded border border-line/70 bg-ink px-3 py-2">
                <summary className="cursor-pointer text-xs uppercase text-muted">Advanced duplicate target overrides</summary>
                <div className="mt-3 grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Specific Tracks</span>
                    <input
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={duplicateTrackIdsText}
                      placeholder="Optional advanced override. Blank uses the current target."
                      onChange={(event) => setDuplicateTrackIdsText(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Keep-Best Groups</span>
                    <textarea
                      className="min-h-20 rounded border border-line bg-panel px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={duplicateGroupsText}
                      placeholder="One duplicate group per line, for example: 12, 34, 56"
                      onChange={(event) => setDuplicateGroupsText(event.target.value)}
                    />
                  </label>
                </div>
              </details>
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
                  Reveal One
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
          )}

          {showTool("acousticFingerprints") && (
          <DisclosureSection
            title="Acoustic Fingerprints"
            description="Chromaprint fpcalc pass for duplicate matching and optional AcoustID-assisted tagging"
            defaultOpen={initialFocusToolId === "acousticFingerprints"}
            openSignal={openSignalFor("acousticFingerprints")}
          >
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 rounded border border-line bg-ink p-3 md:grid-cols-[1fr_220px] md:items-end">
                <div>
                  <div className="text-xs uppercase text-muted">Fingerprint Target</div>
                  <div className="mt-1 text-neutral-200">
                    {scopedTrackIds.length
                      ? `${scopedTrackIds.length.toLocaleString()} selected track${scopedTrackIds.length === 1 ? "" : "s"}`
                      : "Tool default target"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Run fingerprints first. With an AcoustID key in Settings, Auto-Tag can identify tracks from audio.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      className="inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                      type="button"
                      onClick={onOpenApiKeysSettings}
                    >
                      Manage API Keys
                    </button>
                    <button
                      className="inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                      type="button"
                      onClick={() => void openExternalUrl(ACOUSTID_API_KEY_URL, setStatus)}
                    >
                      Get AcoustID key
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
                <NumberField label="Fingerprint Limit" value={acousticLimit} min={1} max={10000} onChange={setAcousticLimit} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={acousticOverwrite}
                    onChange={(event) => setAcousticOverwrite(event.target.checked)}
                  />
                  <span className="text-muted">Overwrite existing fingerprints</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={!fingerprintTagMissingOnly}
                      onChange={(event) => setFingerprintTagMissingOnly(!event.target.checked)}
                    />
                    Replace metadata
                  </label>
                  <label className="flex items-center gap-2 rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={fingerprintTagSaveArtwork}
                      onChange={(event) => setFingerprintTagSaveArtwork(event.target.checked)}
                    />
                    Save cover
                  </label>
                  <label className="flex items-center gap-2 rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={fingerprintTagWriteToFiles}
                      onChange={(event) => setFingerprintTagWriteToFiles(event.target.checked)}
                    />
                    Write files
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void analyzeAcousticFingerprints()}
                  >
                    <Fingerprint size={15} />
                    Analyze Fingerprints
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void previewAcousticFingerprintTags()}
                  >
                    <Wand2 size={15} />
                    Preview Fingerprint Tags
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={fingerprintAutoTagIds.length === 0}
                    onClick={() => void applyAcousticFingerprintTags()}
                  >
                    <Save size={15} />
                    Apply Accepted Fingerprint Tags
                  </button>
                </div>
              </div>
              <div className="rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                Fingerprint tag preview is AcoustID-only. It will not fall back to title, artist, or album text search.
              </div>
              {autoTagPreviewSource === "fingerprint" && autoTagPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">Fingerprint tag preview</div>
                      <div className="mt-1 text-muted">
                        {autoTagPreview.matched.toLocaleString()} matched, {autoTagPreview.changed.toLocaleString()} with metadata changes,{" "}
                        {acceptedAutoTagTrackIds.size.toLocaleString()} accepted
                      </div>
                    </div>
                    <button
                      className="primary-button h-8"
                      type="button"
                      disabled={fingerprintAutoTagIds.length === 0}
                      onClick={() => void applyAcousticFingerprintTags()}
                    >
                      <Save size={14} />
                      Apply Accepted
                    </button>
                  </div>
                  {autoTagPreview.matched === 0 && (
                    <div className="mb-3 rounded border border-ember/40 bg-ember/10 px-3 py-2 text-ember">
                      No AcoustID fingerprint matches were found. Confirm the API key is saved, then run Analyze Fingerprints.
                    </div>
                  )}
                  <div className="grid max-h-64 gap-1 overflow-auto pr-1">
                    {autoTagPreview.previews.slice(0, 50).map((preview) => (
                      <label key={preview.track_id} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded bg-panel px-2 py-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-moss"
                          checked={acceptedAutoTagTrackIds.has(preview.track_id)}
                          disabled={Boolean(preview.error) || (preview.changed_fields.length === 0 && !preview.artwork_url && !preview.applied && !preview.artwork_saved)}
                          onChange={() => toggleAutoTagTrack(preview.track_id)}
                        />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium text-neutral-200">
                              {preview.proposed.title ? String(preview.proposed.title) : preview.path.split(/[\\/]/).pop()}
                            </span>
                            {(preview.applied || preview.artwork_saved) && (
                              <span className="shrink-0 rounded border border-moss/40 bg-moss/10 px-1.5 py-0.5 text-[10px] uppercase text-moss">
                                Applied
                              </span>
                            )}
                          </div>
                          <div className="truncate text-muted">
                            {[preview.proposed.artist, preview.proposed.album].filter(Boolean).map(String).join(" - ")}
                          </div>
                          <div className={preview.error ? "truncate text-ember" : "truncate text-moss"}>
                            {autoTagFieldSummary(preview)}
                          </div>
                          {preview.changed_fields.length > 0 && (
                            <div className="mt-1 grid gap-0.5 text-[11px] text-muted">
                              {autoTagChangeDetails(preview).map((detail) => (
                                <div key={detail} className="truncate">{detail}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="w-24 text-right text-[10px] uppercase text-muted">
                          <div>{(preview.confidence * 100).toFixed(0)}%</div>
                          <div className="truncate">{preview.source.includes("AcoustID") ? "AcoustID" : preview.source}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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
                  {acousticFingerprintResult.skipped_reasons?.map((reason) => (
                    <div key={reason} className="truncate text-muted">
                      {reason}
                    </div>
                  ))}
                </div>
              )}
              <details className="rounded border border-line bg-ink p-3 text-xs text-muted">
                <summary className="cursor-pointer select-none text-xs uppercase text-neutral-200">
                  Chromaprint Setup
                  <span className={chromaprintSetup?.available ? "ml-2 text-moss" : "ml-2 text-ember"}>
                    {chromaprintSetup?.available ? "Ready" : "Needs setup"}
                  </span>
                </summary>
                <div className="mt-3 grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>{chromaprintSetup?.message ?? "Checking fpcalc setup"}</div>
                    <button className="secondary-button h-8" type="button" onClick={() => void onRefreshChromaprintSetup()}>
                      <RefreshCw size={14} />
                      Check
                    </button>
                  </div>
                  {chromaprintSetup?.resolved_path && <div className="truncate">Using {chromaprintSetup.resolved_path}</div>}
                  {chromaprintSetup?.version && <div className="truncate">{chromaprintSetup.version}</div>}
                  <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
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
                </div>
                {chromaprintSetup?.tool_directory && (
                  <div className="truncate">
                    Bundled by default. Custom option: put fpcalc.exe in {chromaprintSetup.tool_directory}; PATH is optional.
                  </div>
                )}
                {chromaprintSetup?.errors.map((error) => (
                  <div key={error} className="truncate text-ember">
                    {error}
                  </div>
                ))}
                </div>
              </details>
            </div>
          </DisclosureSection>
          )}


    </>
  );
}
