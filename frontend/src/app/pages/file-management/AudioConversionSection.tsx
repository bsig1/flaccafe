import {
  Ban,
  CheckCircle2,
  Eye,
  FolderOpen,
  SlidersHorizontal,
  Wand2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AudioConversionFormat,
  AudioConversionPreviewResponse,
  AudioConversionProgress,
  AudioConversionSetupResponse,
} from "../../../types/api";
import {
  DisclosureSection,
  NumberField,
} from "../../components/common";
import { currentScope } from "./fileManagementUtils";

type Mp3QualityPreset = "320" | "256" | "192" | "160" | "128" | "custom";

const MP3_QUALITY_PRESETS: Array<{ id: Mp3QualityPreset; label: string; bitrate: number | null }> = [
  { id: "320", label: "Maximum - 320 kbps", bitrate: 320 },
  { id: "256", label: "High - 256 kbps", bitrate: 256 },
  { id: "192", label: "Standard - 192 kbps", bitrate: 192 },
  { id: "160", label: "Compact - 160 kbps", bitrate: 160 },
  { id: "128", label: "Small - 128 kbps", bitrate: 128 },
  { id: "custom", label: "Custom bitrate", bitrate: null },
];

function formatEta(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return null;
  }
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) {
    return `${rounded}s`;
  }
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (minutes < 60) {
    return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return "Unknown";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function formatSizeChange(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return "Unknown";
  }
  if (bytes === 0) {
    return "No change";
  }
  return `${bytes > 0 ? "+" : "-"}${formatBytes(Math.abs(bytes))}`;
}

function formatRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return "Unknown";
  }
  return `${(ratio * 100).toFixed(ratio >= 10 ? 0 : 1)}%`;
}

export type AudioConversionOptions = {
  outputFormat: AudioConversionFormat;
  preserveStructure: boolean;
  copyTags: boolean;
  copyArtwork: boolean;
  normalizeVolume: boolean;
  sampleRateHz: number | null;
  bitrateKbps: number | null;
  overwrite: boolean;
  trackIds: number[] | null;
};

export function AudioConversionSection({
  scopedTrackIds,
  setup,
  preview,
  progress,
  defaultTargetFolder,
  onBrowseTarget,
  onOpenOptionalDependencies,
  onPreview,
  onStart,
  onCancel,
}: {
  scopedTrackIds: number[];
  setup: AudioConversionSetupResponse | null;
  preview: AudioConversionPreviewResponse | null;
  progress: AudioConversionProgress | null;
  defaultTargetFolder: string;
  onBrowseTarget: () => Promise<string | null>;
  onOpenOptionalDependencies: () => void;
  onPreview: (targetFolder: string, options: AudioConversionOptions) => void | Promise<void>;
  onStart: (targetFolder: string, options: AudioConversionOptions) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const [targetFolder, setTargetFolder] = useState("");
  const [outputFormat, setOutputFormat] = useState<AudioConversionFormat>("flac");
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [copyTags, setCopyTags] = useState(true);
  const [copyArtwork, setCopyArtwork] = useState(true);
  const [normalizeVolume, setNormalizeVolume] = useState(false);
  const [sampleRateHz, setSampleRateHz] = useState(0);
  const [bitrateKbps, setBitrateKbps] = useState(0);
  const [mp3QualityPreset, setMp3QualityPreset] = useState<Mp3QualityPreset>("320");
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => {
    if (!defaultTargetFolder) {
      return;
    }
    setTargetFolder((current) => current || defaultTargetFolder);
  }, [defaultTargetFolder]);

  const conversionOptions = useMemo<AudioConversionOptions>(
    () => ({
      outputFormat,
      preserveStructure,
      copyTags,
      copyArtwork,
      normalizeVolume,
      sampleRateHz: sampleRateHz > 0 ? sampleRateHz : null,
      bitrateKbps: bitrateKbps > 0 ? bitrateKbps : null,
      overwrite,
      trackIds: currentScope(scopedTrackIds),
    }),
    [bitrateKbps, copyArtwork, copyTags, normalizeVolume, outputFormat, overwrite, preserveStructure, sampleRateHz, scopedTrackIds],
  );

  const progressPercent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const activeJob = Boolean(progress && !["completed", "failed", "canceled"].includes(progress.status));
  const scopeLabel = scopedTrackIds.length ? `${scopedTrackIds.length.toLocaleString()} selected/scoped` : "latest library batch";
  const startScopeLabel = scopedTrackIds.length ? `${scopedTrackIds.length.toLocaleString()} selected/scoped tracks` : "all matching library tracks";
  const setupReady = Boolean(setup?.available);
  const etaLabel = activeJob && progress && progress.total_tracks > 1 ? formatEta(progress.eta_seconds) : null;

  async function browseTargetFolder() {
    const selected = await onBrowseTarget();
    if (selected) {
      setTargetFolder(selected);
    }
  }

  function changeOutputFormat(nextFormat: AudioConversionFormat) {
    setOutputFormat(nextFormat);
    if (nextFormat === "mp3" && bitrateKbps <= 0) {
      setMp3QualityPreset("320");
      setBitrateKbps(320);
    }
  }

  function changeMp3QualityPreset(nextPreset: Mp3QualityPreset) {
    setMp3QualityPreset(nextPreset);
    const preset = MP3_QUALITY_PRESETS.find((item) => item.id === nextPreset);
    if (preset?.bitrate) {
      setBitrateKbps(preset.bitrate);
    }
  }

  function changeBitrate(value: number) {
    setBitrateKbps(value);
    const matchingPreset = MP3_QUALITY_PRESETS.find((preset) => preset.bitrate === value);
    setMp3QualityPreset(matchingPreset?.id ?? "custom");
  }

  return (
    <DisclosureSection title="Audio Conversion" description={`Transcode local files with FFmpeg, metadata/artwork copy, resampling, and loudness normalization for ${scopeLabel}`}>
      <div className="grid min-w-0 gap-4 text-sm text-neutral-200">
        <div className="min-w-0 rounded border border-line bg-ink px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={setupReady ? "min-w-0 truncate font-medium text-moss" : "min-w-0 truncate font-medium text-ember"}>
              {setupReady ? "FFmpeg ready" : "FFmpeg required for conversion"}
            </div>
            <button className="secondary-button h-8" type="button" onClick={onOpenOptionalDependencies}>
              <SlidersHorizontal size={14} />
              Optional Dependencies
            </button>
          </div>
        </div>

        <label className="grid min-w-0 gap-2">
          <span className="text-xs uppercase text-muted">Target Folder</span>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              className="h-9 min-w-0 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={targetFolder}
              placeholder={defaultTargetFolder || "Example: D:\\Converted Music"}
              onChange={(event) => setTargetFolder(event.target.value)}
            />
            <button
              className="secondary-button h-9 justify-center"
              type="button"
              disabled={!defaultTargetFolder}
              onClick={() => setTargetFolder(defaultTargetFolder)}
            >
              Default
            </button>
            <button className="secondary-button h-9 justify-center" type="button" onClick={() => void browseTargetFolder()}>
              <FolderOpen size={15} />
              Browse
            </button>
          </div>
        </label>

        <div className="grid min-w-0 gap-2 md:grid-cols-4">
          <label className="grid min-w-0 gap-2">
            <span className="text-xs uppercase text-muted">Format</span>
            <select
              className="h-9 min-w-0 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={outputFormat}
              onChange={(event) => changeOutputFormat(event.target.value as AudioConversionFormat)}
            >
              <option value="flac">FLAC</option>
              <option value="mp3">MP3</option>
              <option value="m4a">M4A / AAC</option>
              <option value="opus">Opus</option>
              <option value="wav">WAV</option>
            </select>
          </label>
          {outputFormat === "mp3" && (
            <label className="grid min-w-0 gap-2">
              <span className="text-xs uppercase text-muted">MP3 Quality</span>
              <select
                className="h-9 min-w-0 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                value={mp3QualityPreset}
                onChange={(event) => changeMp3QualityPreset(event.target.value as Mp3QualityPreset)}
              >
                {MP3_QUALITY_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <NumberField label="Bitrate Kbps" value={bitrateKbps} min={0} max={1411} onChange={changeBitrate} />
          <NumberField label="Sample Rate Hz" value={sampleRateHz} min={0} max={384000} onChange={setSampleRateHz} />
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Overwrite</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
          </label>
        </div>

        <div className="grid min-w-0 gap-2 md:grid-cols-4">
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Preserve folders</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={preserveStructure} onChange={(event) => setPreserveStructure(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Copy tags</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={copyTags} onChange={(event) => setCopyTags(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Copy artwork</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={copyArtwork} disabled={outputFormat === "wav"} onChange={(event) => setCopyArtwork(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Normalize volume</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={normalizeVolume} onChange={(event) => setNormalizeVolume(event.target.checked)} />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" type="button" onClick={() => void onPreview(targetFolder, conversionOptions)}>
            <Eye size={15} />
            Preview
          </button>
          <button className="primary-button" type="button" disabled={activeJob} onClick={() => void onStart(targetFolder, conversionOptions)}>
            <Wand2 size={15} />
            Start Conversion
          </button>
          <button className="secondary-button" type="button" disabled={!activeJob} onClick={() => void onCancel()}>
            <Ban size={15} />
            Cancel
          </button>
        </div>

        <div className="rounded border border-ember/35 bg-ember/10 px-3 py-2 text-xs text-neutral-200">
          Preview lists the first 200 matching tracks, while totals and size estimates cover the full conversion set. Start Conversion will process {startScopeLabel}; use selected tracks or a scoped tool view to narrow the job.
        </div>

        {progress && (
          <div className="min-w-0 rounded border border-line bg-ink p-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-neutral-200">
                <SlidersHorizontal size={15} />
                <span className="min-w-0 truncate">{progress.message ?? progress.status}</span>
              </div>
              <div className="shrink-0 text-right text-muted">
                <div>{progressPercent.toFixed(0)}%</div>
                {etaLabel && <div className="text-[11px]">ETA {etaLabel}</div>}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full bg-moss transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap gap-3 text-muted">
              <span>{progress.processed_tracks.toLocaleString()} / {progress.total_tracks.toLocaleString()}</span>
              <span>{progress.converted.toLocaleString()} converted</span>
              <span>{progress.skipped.toLocaleString()} skipped</span>
              {etaLabel && <span>ETA {etaLabel}</span>}
              {progress.current_track && (
                <span className="block min-w-0 max-w-full flex-[1_1_18rem] truncate" title={progress.current_track}>
                  {progress.current_track}
                </span>
              )}
            </div>
            {progress.errors.slice(0, 5).map((error) => (
              <div key={error} className="mt-1 min-w-0 truncate text-ember" title={error}>{error}</div>
            ))}
          </div>
        )}

        {preview && (
          <div className="min-w-0 rounded border border-line bg-ink p-3 text-xs">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-neutral-200">
              <CheckCircle2 size={15} />
              Previewing {preview.total.toLocaleString()} matching track{preview.total === 1 ? "" : "s"}: {preview.changed_count.toLocaleString()} conversion target{preview.changed_count === 1 ? "" : "s"}, {preview.collisions.toLocaleString()} collision{preview.collisions === 1 ? "" : "s"}
            </div>
            <div className="mb-3 grid gap-2 sm:grid-cols-4">
              <div className="rounded border border-line/70 bg-panel px-2 py-1.5">
                <div className="text-[10px] uppercase text-muted">Input</div>
                <div className="font-medium text-neutral-100">{formatBytes(preview.source_size_bytes)}</div>
              </div>
              <div className="rounded border border-line/70 bg-panel px-2 py-1.5">
                <div className="text-[10px] uppercase text-muted">Estimated Output</div>
                <div className="font-medium text-neutral-100">{formatBytes(preview.estimated_output_size_bytes)}</div>
              </div>
              <div className="rounded border border-line/70 bg-panel px-2 py-1.5">
                <div className="text-[10px] uppercase text-muted">Size Change</div>
                <div className={(preview.estimated_size_change_bytes ?? 0) > 0 ? "font-medium text-ember" : "font-medium text-moss"}>
                  {formatSizeChange(preview.estimated_size_change_bytes)}
                </div>
              </div>
              <div className="rounded border border-line/70 bg-panel px-2 py-1.5">
                <div className="text-[10px] uppercase text-muted">Output / Input</div>
                <div className="font-medium text-neutral-100">{formatRatio(preview.estimated_size_ratio)}</div>
              </div>
            </div>
            <div className="mb-2 text-[11px] text-muted">
              Estimates cover {preview.estimated_tracks.toLocaleString()} of {preview.total.toLocaleString()} matching tracks. Showing {preview.changes.length.toLocaleString()} preview row{preview.changes.length === 1 ? "" : "s"}.
            </div>
            <div className="grid min-w-0 max-h-80 gap-1 overflow-auto pr-1">
              {preview.changes.map((change) => (
                <div key={change.track_id} className="grid min-w-0 gap-1 rounded bg-panel px-2 py-1.5">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-neutral-200" title={change.title ?? change.source_path}>
                      {change.title ?? change.source_path}
                    </div>
                    <div className="shrink-0 text-right text-muted" title={change.estimate_note ?? undefined}>
                      {formatBytes(change.source_size_bytes)} {"->"} {formatBytes(change.estimated_output_size_bytes)}
                    </div>
                  </div>
                  <div
                    className={change.error || change.collision ? "min-w-0 truncate text-ember" : "min-w-0 truncate text-muted"}
                    title={`${change.error ?? change.target_path}${change.collision ? " - target exists" : ""}${change.estimate_note ? ` - ${change.estimate_note}` : ""}`}
                  >
                    {change.error ?? change.target_path}
                    {change.collision ? " - target exists" : ""}
                    {change.estimated_size_change_bytes !== null ? ` - ${formatSizeChange(change.estimated_size_change_bytes)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DisclosureSection>
  );
}
