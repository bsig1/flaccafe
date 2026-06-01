import {
Copy,
DatabaseBackup,
Eye,
RotateCcw,
Save,
Sparkles,
Tags,
Trash2,
} from "lucide-react";
import {
useEffect,
useMemo,
useState,
} from "react";

import {
batchCustomTags,
copyOrSwapTags,
createTagBackup,
deleteRegexTagPreset,
deleteVirtualTag,
fetchRegexTagPresets,
fetchTagBackups,
fetchVirtualTags,
previewVirtualTag,
replaceTagsWithRegex,
restoreTagBackup,
saveRegexTagPreset,
saveVirtualTag,
} from "../../../lib/api";
import type {
CustomTagBatchResponse,
RegexTagPreset,
TagBackupResponse,
TagBackupRestoreResponse,
TagBackupSummary,
TagFieldCopySwapResponse,
TagRegexReplaceResponse,
VirtualTagDefinition,
VirtualTagPreviewResponse,
} from "../../../types/api";
import { DisclosureSection } from "../../components/common";
import { currentScope,previewLabel } from "./fileManagementUtils";

const CORE_TAG_FIELDS = ["title", "artist", "album", "album_artist", "track_number", "disc_number", "genre", "year", "rating"];
const REGEX_FIELDS = ["title", "artist", "album", "album_artist", "genre"] as const;

type RegexField = (typeof REGEX_FIELDS)[number];

function PreviewRows({
  rows,
  render,
}: {
  rows: unknown[];
  render: (item: unknown, index: number) => JSX.Element;
}) {
  if (!rows.length) {
    return null;
  }
  return <div className="grid max-h-72 gap-1 overflow-auto pr-1">{rows.slice(0, 40).map(render)}</div>;
}

export function AdvancedTagToolsSection({
  scopedTrackIds,
  onLibraryChanged,
  setStatus,
}: {
  scopedTrackIds: number[];
  onLibraryChanged: () => void | Promise<void>;
  setStatus: (message: string) => void;
}) {
  const [regexPresets, setRegexPresets] = useState<RegexTagPreset[]>([]);
  const [regexPresetId, setRegexPresetId] = useState("");
  const [regexPresetName, setRegexPresetName] = useState("");
  const [regexField, setRegexField] = useState<RegexField>("artist");
  const [regexPattern, setRegexPattern] = useState("\\s+feat\\..*$");
  const [regexReplacement, setRegexReplacement] = useState("");
  const [regexCaseSensitive, setRegexCaseSensitive] = useState(false);
  const [regexPreview, setRegexPreview] = useState<TagRegexReplaceResponse | null>(null);

  const [customAction, setCustomAction] = useState<"set" | "delete">("set");
  const [customKey, setCustomKey] = useState("Mood");
  const [customValue, setCustomValue] = useState("");
  const [customPreview, setCustomPreview] = useState<CustomTagBatchResponse | null>(null);

  const [virtualTags, setVirtualTags] = useState<VirtualTagDefinition[]>([]);
  const [virtualId, setVirtualId] = useState("");
  const [virtualName, setVirtualName] = useState("Artist Album");
  const [virtualExpression, setVirtualExpression] = useState("<Album Artist> - <Album> (<Year>)");
  const [virtualPreview, setVirtualPreview] = useState<VirtualTagPreviewResponse | null>(null);

  const [copyAction, setCopyAction] = useState<"copy" | "swap">("copy");
  const [sourceField, setSourceField] = useState("album_artist");
  const [targetField, setTargetField] = useState("artist");
  const [copyMissingOnly, setCopyMissingOnly] = useState(true);
  const [copyPreview, setCopyPreview] = useState<TagFieldCopySwapResponse | null>(null);

  const [tagBackups, setTagBackups] = useState<TagBackupSummary[]>([]);
  const [backupPath, setBackupPath] = useState("");
  const [backupIncludeCustom, setBackupIncludeCustom] = useState(true);
  const [backupResult, setBackupResult] = useState<TagBackupResponse | null>(null);
  const [restorePath, setRestorePath] = useState("");
  const [restoreMissingOnly, setRestoreMissingOnly] = useState(false);
  const [restoreCustomTags, setRestoreCustomTags] = useState(true);
  const [restorePreview, setRestorePreview] = useState<TagBackupRestoreResponse | null>(null);

  const scope = useMemo(() => currentScope(scopedTrackIds), [scopedTrackIds]);
  const scopeLabel = scopedTrackIds.length ? `${scopedTrackIds.length.toLocaleString()} scoped track${scopedTrackIds.length === 1 ? "" : "s"}` : "latest library batch";

  async function loadTagToolLists() {
    try {
      const [presets, virtuals, backups] = await Promise.all([
        fetchRegexTagPresets(),
        fetchVirtualTags(),
        fetchTagBackups(),
      ]);
      setRegexPresets(presets);
      setVirtualTags(virtuals);
      setTagBackups(backups);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load advanced tag tools");
    }
  }

  useEffect(() => {
    void loadTagToolLists();
  }, []);

  function loadRegexPreset(id: string) {
    setRegexPresetId(id);
    const preset = regexPresets.find((item) => String(item.id) === id);
    if (!preset) {
      return;
    }
    setRegexPresetName(preset.name);
    setRegexField(preset.field as RegexField);
    setRegexPattern(preset.pattern);
    setRegexReplacement(preset.replacement);
    setRegexCaseSensitive(preset.case_sensitive);
  }

  async function handleSaveRegexPreset() {
    try {
      const preset = await saveRegexTagPreset({
        name: regexPresetName.trim() || `${regexField} cleanup`,
        field: regexField,
        pattern: regexPattern,
        replacement: regexReplacement,
        case_sensitive: regexCaseSensitive,
      });
      await loadTagToolLists();
      setRegexPresetId(String(preset.id));
      setStatus(`Saved regex preset ${preset.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save regex preset");
    }
  }

  async function handleDeleteRegexPreset() {
    const id = Number(regexPresetId);
    if (!Number.isInteger(id)) {
      return;
    }
    try {
      await deleteRegexTagPreset(id);
      setRegexPresetId("");
      await loadTagToolLists();
      setStatus("Deleted regex preset");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete regex preset");
    }
  }

  async function handleRegex(apply: boolean) {
    if (!regexPattern.trim()) {
      setStatus("Enter a regex pattern first");
      return;
    }
    if (apply && !window.confirm("Apply this regex replacement to tags? Undo will be available in the rollback section.")) {
      return;
    }
    try {
      const response = await replaceTagsWithRegex({
        field: regexField,
        pattern: regexPattern,
        replacement: regexReplacement,
        case_sensitive: regexCaseSensitive,
        track_ids: scope,
        apply,
        limit: apply ? 10000 : 200,
      });
      setRegexPreview(response);
      if (apply) {
        await onLibraryChanged();
      }
      setStatus(
        apply
          ? `Applied regex preset to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`
          : `${response.changed.toLocaleString()} of ${response.total.toLocaleString()} tags would change`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not run regex preset");
    }
  }

  async function handleCustomTags(apply: boolean) {
    if (!customKey.trim()) {
      setStatus("Name the custom tag first");
      return;
    }
    if (apply && !window.confirm("Apply this custom tag batch? File writing follows the current write-tags setting.")) {
      return;
    }
    try {
      const response = await batchCustomTags({
        action: customAction,
        tag_key: customKey,
        value: customAction === "delete" ? null : customValue,
        track_ids: scope,
        apply,
        limit: apply ? 10000 : 200,
      });
      setCustomPreview(response);
      if (apply) {
        await onLibraryChanged();
      }
      setStatus(
        apply
          ? `Applied custom tag changes to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`
          : `${response.changed.toLocaleString()} of ${response.total.toLocaleString()} custom tags would change`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update custom tags");
    }
  }

  function loadVirtualTag(id: string) {
    setVirtualId(id);
    const tag = virtualTags.find((item) => String(item.id) === id);
    if (!tag) {
      return;
    }
    setVirtualName(tag.name);
    setVirtualExpression(tag.expression);
  }

  async function handleSaveVirtualTag() {
    try {
      const tag = await saveVirtualTag({ name: virtualName.trim() || "Virtual Tag", expression: virtualExpression });
      await loadTagToolLists();
      setVirtualId(String(tag.id));
      setStatus(`Saved virtual tag ${tag.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save virtual tag");
    }
  }

  async function handleDeleteVirtualTag() {
    const id = Number(virtualId);
    if (!Number.isInteger(id)) {
      return;
    }
    try {
      await deleteVirtualTag(id);
      setVirtualId("");
      await loadTagToolLists();
      setStatus("Deleted virtual tag");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete virtual tag");
    }
  }

  async function handlePreviewVirtualTag() {
    try {
      const response = await previewVirtualTag({ expression: virtualExpression, track_ids: scope, limit: 200 });
      setVirtualPreview(response);
      setStatus(`Rendered virtual tags for ${response.total.toLocaleString()} track${response.total === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview virtual tag");
    }
  }

  async function handleCopySwap(apply: boolean) {
    if (apply && !window.confirm("Apply this copy/swap operation? Undo will be available in the rollback section.")) {
      return;
    }
    try {
      const response = await copyOrSwapTags({
        action: copyAction,
        source_field: sourceField,
        target_field: targetField,
        track_ids: scope,
        missing_only: copyMissingOnly,
        apply,
        limit: apply ? 10000 : 200,
      });
      setCopyPreview(response);
      if (apply) {
        await onLibraryChanged();
      }
      setStatus(
        apply
          ? `Applied ${copyAction} to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`
          : `${response.changed.toLocaleString()} of ${response.total.toLocaleString()} rows would change`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not copy or swap tags");
    }
  }

  async function handleCreateBackup() {
    try {
      const response = await createTagBackup({
        backup_path: backupPath.trim() || null,
        track_ids: scope,
        include_custom_tags: backupIncludeCustom,
        limit: 200000,
      });
      setBackupResult(response);
      setRestorePath(response.backup_path);
      await loadTagToolLists();
      setStatus(`Backed up tags for ${response.track_count.toLocaleString()} track${response.track_count === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create tag backup");
    }
  }

  async function handleRestoreBackup(apply: boolean) {
    const path = restorePath.trim();
    if (!path) {
      setStatus("Choose a tag backup first");
      return;
    }
    if (apply && !window.confirm("Restore tags from this backup? Preview first if you are unsure.")) {
      return;
    }
    try {
      const response = await restoreTagBackup({
        backup_path: path,
        track_ids: scope,
        missing_only: restoreMissingOnly,
        restore_custom_tags: restoreCustomTags,
        apply,
        limit: apply ? 10000 : 200,
      });
      setRestorePreview(response);
      if (apply) {
        await onLibraryChanged();
      }
      setStatus(
        apply
          ? `Restored tags on ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`
          : `${response.changed.toLocaleString()} of ${response.matched.toLocaleString()} matched tracks would change`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not restore tag backup");
    }
  }

  return (
    <DisclosureSection title="Advanced Tag Tools" description={`Custom tags, computed tags, presets, copy/swap, and backup/restore for ${scopeLabel}`}>
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center gap-2 font-medium text-neutral-100">
            <Tags size={16} />
            Custom Tags
          </div>
          <div className="grid gap-2 md:grid-cols-[auto_1fr_1fr]">
            <select className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 focus:ring-2" value={customAction} onChange={(event) => setCustomAction(event.target.value as "set" | "delete")}>
              <option value="set">Set</option>
              <option value="delete">Delete</option>
            </select>
            <input className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={customKey} placeholder="Tag name, e.g. Mood" onChange={(event) => setCustomKey(event.target.value)} />
            <input className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 placeholder:text-muted focus:ring-2 disabled:opacity-50" value={customValue} placeholder="Value" disabled={customAction === "delete"} onChange={(event) => setCustomValue(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={() => void handleCustomTags(false)}>
              <Eye size={15} />
              Preview
            </button>
            <button className="primary-button" type="button" onClick={() => void handleCustomTags(true)}>
              <Save size={15} />
              Apply
            </button>
          </div>
          {customPreview && (
            <PreviewRows
              rows={customPreview.previews}
              render={(item) => {
                const preview = item as CustomTagBatchResponse["previews"][number];
                return (
                  <div key={`${preview.track_id}-${preview.tag_key}`} className="rounded bg-panel px-2 py-1.5 text-xs">
                    <div className="truncate text-muted">{preview.path}</div>
                    <div className={preview.error ? "text-ember" : "text-neutral-200"}>
                      {preview.error ?? `${previewLabel(preview.current)} -> ${previewLabel(preview.value)}`}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>

        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center gap-2 font-medium text-neutral-100">
            <Sparkles size={16} />
            Virtual Tags
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
            <select className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 focus:ring-2" value={virtualId} onChange={(event) => loadVirtualTag(event.target.value)}>
              <option value="">Saved virtual tag</option>
              {virtualTags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
            <input className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={virtualName} placeholder="Name" onChange={(event) => setVirtualName(event.target.value)} />
            <button className="secondary-button h-9" type="button" onClick={() => void handleSaveVirtualTag()}>
              <Save size={15} />
              Save
            </button>
            <button className="secondary-button h-9" type="button" disabled={!virtualId} onClick={() => void handleDeleteVirtualTag()}>
              <Trash2 size={15} />
              Delete
            </button>
          </div>
          <input className="h-9 rounded border border-line bg-panel px-3 font-mono text-xs outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={virtualExpression} placeholder="<Album Artist> - <Album> (<Year>)" onChange={(event) => setVirtualExpression(event.target.value)} />
          <div className="text-xs text-muted">Tokens include {CORE_TAG_FIELDS.map((field) => `<${field}>`).join(", ")}, {"<Filename>"}, {"<Decade>"}, {"<RatingBucket>"}, and {"<Custom:Mood>"}.</div>
          <button className="secondary-button w-fit" type="button" onClick={() => void handlePreviewVirtualTag()}>
            <Eye size={15} />
            Preview
          </button>
          {virtualPreview && (
            <PreviewRows
              rows={virtualPreview.previews}
              render={(item) => {
                const preview = item as VirtualTagPreviewResponse["previews"][number];
                return (
                  <div key={preview.track_id} className="grid gap-0.5 rounded bg-panel px-2 py-1.5 text-xs">
                    <div className="truncate text-muted">{preview.title ?? preview.path}</div>
                    <div className={preview.error ? "text-ember" : "text-neutral-200"}>{preview.error ?? preview.value}</div>
                  </div>
                );
              }}
            />
          )}
        </div>

        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center gap-2 font-medium text-neutral-100">
            <Copy size={16} />
            Multi-Field Copy / Swap
          </div>
          <div className="grid gap-2 md:grid-cols-[auto_1fr_1fr]">
            <select className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 focus:ring-2" value={copyAction} onChange={(event) => setCopyAction(event.target.value as "copy" | "swap")}>
              <option value="copy">Copy</option>
              <option value="swap">Swap</option>
            </select>
            <input list="tag-tool-fields" className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={sourceField} placeholder="Source field" onChange={(event) => setSourceField(event.target.value)} />
            <input list="tag-tool-fields" className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={targetField} placeholder="Target field or custom:Name" onChange={(event) => setTargetField(event.target.value)} />
          </div>
          <datalist id="tag-tool-fields">
            {CORE_TAG_FIELDS.map((field) => <option key={field} value={field} />)}
            <option value="custom:Mood" />
            <option value="custom:Energy" />
            <option value="custom:Occasion" />
          </datalist>
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
            <span className="text-muted">Only copy into blank targets</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={copyMissingOnly} disabled={copyAction === "swap"} onChange={(event) => setCopyMissingOnly(event.target.checked)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={() => void handleCopySwap(false)}>
              <Eye size={15} />
              Preview
            </button>
            <button className="primary-button" type="button" onClick={() => void handleCopySwap(true)}>
              <Save size={15} />
              Apply
            </button>
          </div>
          {copyPreview && (
            <PreviewRows
              rows={copyPreview.previews}
              render={(item) => {
                const preview = item as TagFieldCopySwapResponse["previews"][number];
                return (
                  <div key={preview.track_id} className="rounded bg-panel px-2 py-1.5 text-xs">
                    <div className="truncate text-muted">{preview.path}</div>
                    <div className={preview.error ? "text-ember" : "text-neutral-200"}>
                      {preview.error ?? `${previewLabel(preview.current_target)} -> ${previewLabel(preview.new_target)}`}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>

        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center gap-2 font-medium text-neutral-100">
            <DatabaseBackup size={16} />
            Tag Backup / Restore
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={backupPath} placeholder="Optional backup file name or path" onChange={(event) => setBackupPath(event.target.value)} />
            <button className="secondary-button h-9" type="button" onClick={() => void handleCreateBackup()}>
              <DatabaseBackup size={15} />
              Create Backup
            </button>
          </div>
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
            <span className="text-muted">Include custom tags</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={backupIncludeCustom} onChange={(event) => setBackupIncludeCustom(event.target.checked)} />
          </label>
          {backupResult && (
            <div className="rounded bg-panel px-2 py-1.5 text-xs text-muted">
              <div className="truncate">{backupResult.backup_path}</div>
              <div>{backupResult.track_count.toLocaleString()} tracks, {backupResult.custom_tag_count.toLocaleString()} custom tags</div>
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <select className="h-9 min-w-0 rounded border border-line bg-panel px-3 outline-none ring-moss/40 focus:ring-2" value={restorePath} onChange={(event) => setRestorePath(event.target.value)}>
              <option value="">Choose backup to restore</option>
              {tagBackups.map((backup) => (
                <option key={backup.backup_path} value={backup.backup_path}>
                  {backup.file_name} ({backup.track_count.toLocaleString()})
                </option>
              ))}
            </select>
            <button className="secondary-button h-9" type="button" onClick={() => void handleRestoreBackup(false)}>
              <Eye size={15} />
              Preview
            </button>
            <button className="primary-button h-9" type="button" onClick={() => void handleRestoreBackup(true)}>
              <RotateCcw size={15} />
              Restore
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
              <span className="text-muted">Only restore into blank fields</span>
              <input type="checkbox" className="h-4 w-4 accent-moss" checked={restoreMissingOnly} onChange={(event) => setRestoreMissingOnly(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
              <span className="text-muted">Restore custom tags</span>
              <input type="checkbox" className="h-4 w-4 accent-moss" checked={restoreCustomTags} onChange={(event) => setRestoreCustomTags(event.target.checked)} />
            </label>
          </div>
          {restorePreview && (
            <PreviewRows
              rows={restorePreview.previews}
              render={(item, index) => {
                const preview = item as TagBackupRestoreResponse["previews"][number];
                return (
                  <div key={`${preview.track_id ?? "missing"}-${index}`} className="rounded bg-panel px-2 py-1.5 text-xs">
                    <div className="truncate text-muted">{preview.path ?? "No matching track"}</div>
                    <div className={preview.error ? "text-ember" : "text-neutral-200"}>
                      {preview.error ?? (preview.changed_fields.length ? preview.changed_fields.join(", ") : "No changes")}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>

        <div className="grid gap-3 rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center gap-2 font-medium text-neutral-100">
            <Save size={16} />
            Saved Regex Presets
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
            <select className="h-9 min-w-0 rounded border border-line bg-panel px-3 outline-none ring-moss/40 focus:ring-2" value={regexPresetId} onChange={(event) => loadRegexPreset(event.target.value)}>
              <option value="">Choose preset</option>
              {regexPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
            <input className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={regexPresetName} placeholder="Preset name" onChange={(event) => setRegexPresetName(event.target.value)} />
            <button className="secondary-button h-9" type="button" onClick={() => void handleSaveRegexPreset()}>
              <Save size={15} />
              Save
            </button>
            <button className="secondary-button h-9" type="button" disabled={!regexPresetId} onClick={() => void handleDeleteRegexPreset()}>
              <Trash2 size={15} />
              Delete
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-[auto_1fr_1fr]">
            <select className="h-9 rounded border border-line bg-panel px-3 outline-none ring-moss/40 focus:ring-2" value={regexField} onChange={(event) => setRegexField(event.target.value as RegexField)}>
              {REGEX_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
            </select>
            <input className="h-9 rounded border border-line bg-panel px-3 font-mono text-xs outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={regexPattern} placeholder="Pattern" onChange={(event) => setRegexPattern(event.target.value)} />
            <input className="h-9 rounded border border-line bg-panel px-3 font-mono text-xs outline-none ring-moss/40 placeholder:text-muted focus:ring-2" value={regexReplacement} placeholder="Replacement" onChange={(event) => setRegexReplacement(event.target.value)} />
          </div>
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-panel px-3 py-2">
            <span className="text-muted">Case sensitive</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={regexCaseSensitive} onChange={(event) => setRegexCaseSensitive(event.target.checked)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={() => void handleRegex(false)}>
              <Eye size={15} />
              Preview
            </button>
            <button className="primary-button" type="button" onClick={() => void handleRegex(true)}>
              <Save size={15} />
              Apply
            </button>
          </div>
          {regexPreview && (
            <PreviewRows
              rows={regexPreview.previews}
              render={(item) => {
                const preview = item as TagRegexReplaceResponse["previews"][number];
                return (
                  <div key={preview.track_id} className="rounded bg-panel px-2 py-1.5 text-xs">
                    <div className="truncate text-muted">{preview.path}</div>
                    <div className={preview.error ? "text-ember" : "text-neutral-200"}>
                      {preview.error ?? `${previewLabel(preview.current)} -> ${previewLabel(preview.replacement)}`}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>
    </DisclosureSection>
  );
}
