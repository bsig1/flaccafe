import {
Download,
Eye,
FileText,
ListChecks,
Save,
Trash2,
Upload,
Wand2
} from "lucide-react";

import type {
AutoTagResponse,
ClapGenreTagResponse,
DuplicateReviewResponse,
FilenameTagInferenceResponse,
TagRegexReplaceResponse,
TrackFileMetadataWriteResponse
} from "../../../types/api";
import {
DisclosureSection,
} from "../../components/common";
import {
currentScope
} from "./fileManagementUtils";


export function FileManagementTagPreparationSections({ model }: { model: any }) {
  const filenameTagPreview = model.filenameTagPreview as FilenameTagInferenceResponse | null;
  const tagRegexPreview = model.tagRegexPreview as TagRegexReplaceResponse | null;
  const fileWritePreview = model.fileWritePreview as TrackFileMetadataWriteResponse | null;
  const autoTagPreview = model.autoTagPreview as AutoTagResponse | null;
  const clapGenrePreview = model.clapGenrePreview as ClapGenreTagResponse | null;
  const duplicateReview = model.duplicateReview as DuplicateReviewResponse | null;
  const duplicateGroups = model.duplicateGroups as number[][];
  const scopedTrackIds = model.scopedTrackIds as number[];
  const allFilenameTagPresets = model.allFilenameTagPresets as string[];
  const acceptedFilenameTrackIds = model.acceptedFilenameTrackIds as Set<number>;
  const acceptedChangedFilenameIds = model.acceptedChangedFilenameIds as number[];
  const acceptedAutoTagTrackIds = model.acceptedAutoTagTrackIds as Set<number>;
  const autoTagChangedIds = model.autoTagChangedIds as number[];
  const autoTagArtworkIds = model.autoTagArtworkIds as number[];
  const autoTagBusy = Boolean(model.autoTagBusy);
  const autoTagProgress = model.autoTagProgress as { label: string; completed: number; total: number } | null;
  const autoTagProgressPercent = autoTagProgress
    ? Math.max(6, Math.min(100, (autoTagProgress.completed / Math.max(1, autoTagProgress.total)) * 100))
    : 0;
  const {
    showTool, openSignalFor, initialFocusToolId, filenameTagPattern, setFilenameTagPattern, filenameTagMissingOnly, setFilenameTagMissingOnly, isCustomFilenameTagPreset, filenamePresetMessage, filenamePresetJson, setFilenamePresetJson, saveCurrentFilenameTagPreset, deleteCurrentFilenameTagPreset, exportFilenamePresets, importFilenamePresets, onPreviewFilenameTags, onApplyFilenameTags, toggleAcceptedFilenameTrack, onLoadDuplicateReview, duplicateScopeForAction,
    tagRegexField, setTagRegexField, tagRegexPattern, setTagRegexPattern, tagRegexReplacement, setTagRegexReplacement, tagRegexCaseSensitive, setTagRegexCaseSensitive, onPreviewTagRegex, onApplyTagRegex,
    fileWriteIncludeMetadata, setFileWriteIncludeMetadata, fileWriteIncludeRatings, setFileWriteIncludeRatings, fileWriteBusy, pendingFileWriteIds, previewDatabaseFileWrites,
    autoTagMode, setAutoTagMode, autoTagMissingOnly, setAutoTagMissingOnly, autoTagIncludeArtwork, setAutoTagIncludeArtwork, autoTagSaveArtwork, setAutoTagSaveArtwork, autoTagWriteToFiles, setAutoTagWriteToFiles, previewMusicBrainzAutoTags, applyMusicBrainzAutoTags, toggleAutoTagTrack, autoTagFieldSummary,
    
    clapGenreMissingOnly, setClapGenreMissingOnly, clapGenreMinConfidence, setClapGenreMinConfidence, clapGenreBusy, previewClapGenreTags,
  } = model;
  const fileWriteChangeDetails = model.fileWriteChangeDetails as (preview: TrackFileMetadataWriteResponse["previews"][number]) => string[];
  const autoTagChangeDetails = model.autoTagChangeDetails as (preview: AutoTagResponse["previews"][number]) => string[];
  const clapGenreChangeDetails = (preview: ClapGenreTagResponse["previews"][number]) => {
    const confidence = preview.confidence !== null && preview.confidence !== undefined
      ? ` (${(preview.confidence * 100).toFixed(0)}%)`
      : "";
    const runnerUp = preview.runner_up_genre ? `, next ${preview.runner_up_genre}` : "";
    const margin = preview.match_margin !== null && preview.match_margin !== undefined
      ? `, lead ${(preview.match_margin * 100).toFixed(0)} pts`
      : "";
    const status = preview.applied
      ? " - applied"
      : preview.copy_blocked_reason
        ? ` - ${preview.copy_blocked_reason}`
        : preview.changed
          ? ""
          : " - no change";
    return `${preview.current_genre || "(empty)"} -> ${preview.proposed_genre || "(none)"}${confidence}${runnerUp}${margin}${status}`;
  };

  return (
    <>
          {showTool("filenameTags") && (
          <DisclosureSection title="Filename Tag Inference" description="Infer metadata from folder and file naming patterns">
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
                      <div className="text-ember">
                        {duplicateReview.missing_track_ids.length.toLocaleString()} selected track{duplicateReview.missing_track_ids.length === 1 ? "" : "s"} could not be loaded.
                      </div>
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
          )}

          {showTool("regexTags") && (
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
          )}

          {showTool("writeMetadataFiles") && (
          <DisclosureSection title="Write Database Tags To Files" description="Preview SQLite values, then write them into supported local audio tags">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                This is the reverse of Sync File Metadata. It writes FLAC Cafe's current library values into files, so use Preview first.
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span>
                    <span className="block text-neutral-200">Write editable metadata</span>
                    <span className="text-xs text-muted">Title, artist, album, album artist, track/disc, genre, and year.</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={fileWriteIncludeMetadata}
                    onChange={(event) => setFileWriteIncludeMetadata(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span>
                    <span className="block text-neutral-200">Write ratings</span>
                    <span className="text-xs text-muted">Stores the SQLite star rating in supported file rating tags.</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-ember"
                    checked={fileWriteIncludeRatings}
                    onChange={(event) => setFileWriteIncludeRatings(event.target.checked)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  {scopedTrackIds.length
                    ? `${scopedTrackIds.length.toLocaleString()} scoped track${scopedTrackIds.length === 1 ? "" : "s"}`
                    : "Blank scope previews all music tracks"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={fileWriteBusy}
                    onClick={() => void previewDatabaseFileWrites(false)}
                  >
                    <Eye size={15} />
                    Preview File Writes
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={fileWriteBusy || !fileWritePreview || pendingFileWriteIds().length === 0}
                    onClick={() => void previewDatabaseFileWrites(true)}
                    title={
                      !fileWritePreview
                        ? "Preview file writes first"
                        : pendingFileWriteIds().length === 0
                          ? "No pending file tag changes"
                          : "Write pending SQLite values into file tags"
                    }
                  >
                    <Save size={15} />
                    Write Changed To Files
                  </button>
                </div>
              </div>
              {fileWritePreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-3 grid gap-2 sm:grid-cols-4">
                    <div>
                      <div className="font-semibold text-white">{fileWritePreview.total.toLocaleString()}</div>
                      <div className="text-muted">Checked</div>
                    </div>
                    <div>
                      <div className="font-semibold text-moss">{fileWritePreview.changed.toLocaleString()}</div>
                      <div className="text-muted">Different</div>
                    </div>
                    <div>
                      <div className="font-semibold text-ember">{fileWritePreview.applied.toLocaleString()}</div>
                      <div className="text-muted">Written</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{pendingFileWriteIds().length.toLocaleString()}</div>
                      <div className="text-muted">Pending</div>
                    </div>
                  </div>
                  {fileWritePreview.changed === 0 && fileWritePreview.errors.length === 0 && (
                    <div className="mb-3 rounded border border-moss/30 bg-moss/10 px-3 py-2 text-moss">
                      These files already match the SQLite metadata for the selected options.
                    </div>
                  )}
                  {fileWritePreview.previews.length > 80 && (
                    <div className="mb-3 rounded border border-line/70 bg-panel px-3 py-2 text-muted">
                      Showing the first 80 changed or errored tracks.
                    </div>
                  )}
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {fileWritePreview.previews.slice(0, 80).map((preview) => (
                      <div key={preview.track_id} className="grid gap-1 rounded bg-panel px-2 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 truncate font-medium text-neutral-200">
                            {preview.title || preview.path.split(/[\\/]/).pop()}
                          </div>
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                            preview.error
                              ? "border-ember/40 text-ember"
                              : preview.applied
                                ? "border-moss/40 text-moss"
                                : preview.changed_fields.length
                                  ? "border-line text-muted"
                                  : "border-line/60 text-muted"
                          }`}
                          >
                            {preview.error ? "error" : preview.applied ? "written" : preview.changed_fields.length ? "pending" : "matched"}
                          </span>
                        </div>
                        <div className="truncate text-muted">{preview.artist || preview.path}</div>
                        <div className={preview.error ? "truncate text-ember" : preview.changed_fields.length ? "text-muted" : "truncate text-moss"}>
                          {preview.error ??
                            (preview.changed_fields.length
                              ? fileWriteChangeDetails(preview).join("; ")
                              : "No file tag changes")}
                        </div>
                      </div>
                    ))}
                  </div>
                  {fileWritePreview.errors.length > 0 && (
                    <details className="mt-3 text-xs text-ember">
                      <summary>File write errors</summary>
                      <div className="mt-2 grid gap-1">
                        {fileWritePreview.errors.slice(0, 20).map((error) => (
                          <div key={error} className="truncate">{error}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("musicBrainz") && (
          <DisclosureSection
            title="MusicBrainz Auto-Tag"
            description="Preview album or track matches, missing-field fills, and Cover Art Archive artwork"
            defaultOpen={initialFocusToolId === "musicBrainz"}
            openSignal={openSignalFor("musicBrainz")}
          >
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
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
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Write Mode</span>
                    <select
                      className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={autoTagMissingOnly ? "missing" : "replace"}
                      onChange={(event) => setAutoTagMissingOnly(event.target.value === "missing")}
                    >
                      <option value="missing">Fill missing only</option>
                      <option value="replace">Replace metadata</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
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
                  <label className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${autoTagWriteToFiles ? "border-ember/40 bg-ember/10" : "border-line/70 bg-ink"}`}>
                    <span>
                      <span className="block text-neutral-200">Write tags to files</span>
                      <span className="block text-xs text-muted">SQLite is always updated.</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={autoTagWriteToFiles}
                      onChange={(event) => setAutoTagWriteToFiles(event.target.checked)}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  {scopedTrackIds.length
                    ? `${scopedTrackIds.length.toLocaleString()} scoped track${scopedTrackIds.length === 1 ? "" : "s"}`
                    : "Blank scope uses recently added tracks; fill-empty mode limits it to incomplete metadata"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={autoTagBusy}
                    onClick={() => void previewMusicBrainzAutoTags()}
                  >
                    <Eye size={15} />
                    Preview Matches
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={autoTagBusy || (Boolean(autoTagPreview) && autoTagChangedIds.length === 0 && (!autoTagSaveArtwork || autoTagArtworkIds.length === 0))}
                    onClick={() => void applyMusicBrainzAutoTags()}
                  >
                    <Wand2 size={15} />
                    {autoTagBusy ? "Working..." : autoTagPreview ? "Apply Accepted" : "Apply Auto-Tags"}
                  </button>
                </div>
              </div>

              {autoTagProgress && (
                <div className="rounded border border-line/70 bg-ink px-3 py-2 text-xs">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-neutral-200">{autoTagProgress.label}</span>
                    <span className="shrink-0 text-muted">
                      {Math.min(autoTagProgress.completed, autoTagProgress.total).toLocaleString()} / {autoTagProgress.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel">
                    <div
                      className="h-full rounded-full bg-moss transition-all duration-500"
                      style={{ width: `${autoTagProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

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
                  {autoTagPreview.matched === 0 && (
                    <div className="mb-3 rounded border border-ember/40 bg-ember/10 px-3 py-2 text-ember">
                      No MusicBrainz matches were found. For singles or tracks with a wrong album tag, try Individual tracks and Replace metadata.
                    </div>
                  )}
                  <div className="grid max-h-96 gap-1 overflow-auto pr-1">
                    {autoTagPreview.previews.slice(0, 80).map((preview) => (
                      <label key={preview.track_id} className="grid grid-cols-[auto_52px_1fr] gap-3 rounded bg-panel px-2 py-2">
                        <input
                          type="checkbox"
                          className="mt-4 h-4 w-4 accent-moss"
                          checked={acceptedAutoTagTrackIds.has(preview.track_id)}
                          disabled={Boolean(preview.error) || (preview.changed_fields.length === 0 && !preview.artwork_url && !preview.applied && !preview.artwork_saved)}
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
                            {(preview.applied || preview.artwork_saved) && (
                              <span className="rounded border border-moss/40 bg-moss/10 px-1.5 py-0.5 text-[10px] uppercase text-moss">
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
                          {preview.release_title && (
                            <div className="truncate text-muted">
                              Release: {preview.release_title}
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
          )}

          {showTool("clapGenreTags") && (
          <DisclosureSection
            title="CLAP Genre Tags"
            description="Preview CLAP genre predictions before copying them into editable metadata"
            defaultOpen={initialFocusToolId === "clapGenreTags"}
            openSignal={openSignalFor("clapGenreTags")}
          >
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span>
                    <span className="block text-neutral-200">Only fill empty genres</span>
                    <span className="text-xs text-muted">Leaves existing genre tags alone unless this is off.</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={clapGenreMissingOnly}
                    onChange={(event) => setClapGenreMissingOnly(event.target.checked)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Min Confidence {(clapGenreMinConfidence * 100).toFixed(0)}%</span>
                  <input
                    className="accent-moss"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={clapGenreMinConfidence}
                    onChange={(event) => setClapGenreMinConfidence(Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  Requires tracks already analyzed by CLAP. The preview is limited to 500 tracks per pass.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" type="button" disabled={clapGenreBusy} onClick={() => void previewClapGenreTags(false)}>
                    <Eye size={15} />
                    Preview Genres
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={clapGenreBusy || (clapGenrePreview?.changed ?? 1) === 0}
                    onClick={() => void previewClapGenreTags(true)}
                  >
                    <Wand2 size={15} />
                    Apply Preview
                  </button>
                </div>
              </div>
              {clapGenrePreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-3 grid gap-2 sm:grid-cols-5">
                    <div>
                      <div className="font-semibold text-white">{clapGenrePreview.total.toLocaleString()}</div>
                      <div className="text-muted">Analyzed</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{clapGenrePreview.matched.toLocaleString()}</div>
                      <div className="text-muted">Predicted</div>
                    </div>
                    <div>
                      <div className="font-semibold text-moss">{clapGenrePreview.changed.toLocaleString()}</div>
                      <div className="text-muted">Would change</div>
                    </div>
                    <div>
                      <div className="font-semibold text-ember">{clapGenrePreview.blocked.toLocaleString()}</div>
                      <div className="text-muted">Blocked</div>
                    </div>
                    <div>
                      <div className="font-semibold text-ember">{clapGenrePreview.applied.toLocaleString()}</div>
                      <div className="text-muted">Applied</div>
                    </div>
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {clapGenrePreview.previews.slice(0, 80).map((preview) => (
                      <div key={preview.track_id} className="grid gap-1 rounded bg-panel px-2 py-2">
                        <div className="truncate font-medium text-neutral-200">
                          {preview.title || "(untitled)"}
                          {preview.artist ? ` - ${preview.artist}` : ""}
                        </div>
                        <div className="truncate text-muted">
                          {preview.album || "Unknown album"}
                        </div>
                        <div className={preview.error ? "text-ember" : preview.changed ? "text-moss" : preview.copy_blocked_reason ? "text-ember" : "text-muted"}>
                          {preview.error ?? clapGenreChangeDetails(preview)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {clapGenrePreview.errors.length > 0 && (
                    <details className="mt-3 text-xs text-ember">
                      <summary>CLAP genre notes</summary>
                      <div className="mt-2 grid gap-1">
                        {clapGenrePreview.errors.slice(0, 20).map((error) => (
                          <div key={error} className="truncate">{error}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </DisclosureSection>
          )}


    </>
  );
}
