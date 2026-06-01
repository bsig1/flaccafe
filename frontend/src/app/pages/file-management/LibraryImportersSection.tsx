import {
Eye,
Upload,
} from "lucide-react";
import {
useState,
} from "react";

import {
importLibraryStats,
} from "../../../lib/api";
import type {
LibraryStatsImportResponse,
LibraryStatsImportSource,
} from "../../../types/api";
import {
DisclosureSection,
NumberField,
} from "../../components/common";
import {
formatRating,
} from "../../shared";

const sourceLabels: Record<LibraryStatsImportSource, string> = {
  musicbee: "MusicBee CSV",
  itunes: "iTunes XML",
  windows_media_player: "Windows Media Player WPL/XML",
};

export function LibraryImportersSection({
  setStatus,
}: {
  setStatus: (message: string) => void;
}) {
  const [source, setSource] = useState<LibraryStatsImportSource>("musicbee");
  const [importPath, setImportPath] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [limit, setLimit] = useState(10000);
  const [result, setResult] = useState<LibraryStatsImportResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function runImport(apply: boolean) {
    if (!importPath.trim()) {
      setStatus("Choose an import file first");
      return;
    }
    setBusy(true);
    try {
      const response = await importLibraryStats({
        source,
        import_path: importPath.trim(),
        apply,
        missing_only: missingOnly,
        limit,
      });
      setResult(response);
      setStatus(
        apply
          ? `Imported ${response.applied.toLocaleString()} library stat rows`
          : `Previewed ${response.matched.toLocaleString()} matched library stat rows`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import library stats");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DisclosureSection title="Library Importers" description="Bring ratings and play counts from other desktop libraries">
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Source</span>
            <select
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={source}
              onChange={(event) => setSource(event.target.value as LibraryStatsImportSource)}
            >
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Import File</span>
            <input
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={importPath}
              placeholder="Paste exported library file path"
              onChange={(event) => setImportPath(event.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Only fill missing local stats</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-moss"
              checked={missingOnly}
              onChange={(event) => setMissingOnly(event.target.checked)}
            />
          </label>
          <NumberField label="Row Limit" min={1} max={100000} value={limit} onChange={setLimit} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void runImport(false)}>
            <Eye size={15} />
            Preview
          </button>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void runImport(true)}>
            <Upload size={15} />
            Apply Import
          </button>
        </div>

        {result && (
          <div className="rounded border border-line bg-ink p-3 text-xs">
            <div className="mb-2 text-neutral-200">
              {result.matched.toLocaleString()} matched, {result.changed.toLocaleString()} changed,{" "}
              {result.applied.toLocaleString()} applied, {result.errors.toLocaleString()} errors
            </div>
            <div className="grid max-h-80 gap-1 overflow-auto pr-1">
              {result.previews.slice(0, 80).map((preview) => (
                <div key={`${preview.row_number}-${preview.track_id ?? preview.path ?? preview.title}`} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                  <div className="truncate text-neutral-200">
                    Row {preview.row_number}
                    {preview.title ? ` - ${preview.title}` : ""}
                    {preview.artist ? ` by ${preview.artist}` : ""}
                  </div>
                  <div className={preview.error ? "truncate text-ember" : "truncate text-muted"}>
                    {preview.error ??
                      `${preview.matched_by ?? "matched"}: ${preview.changed_fields.length ? preview.changed_fields.join(", ") : "no changes"}`}
                  </div>
                  {!preview.error && (
                    <div className="truncate text-muted">
                      Rating {formatRating(preview.current_rating)} {"->"} {formatRating(preview.imported_rating)}; plays{" "}
                      {preview.current_play_count ?? 0} {"->"} {preview.imported_play_count ?? "unchanged"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DisclosureSection>
  );
}
