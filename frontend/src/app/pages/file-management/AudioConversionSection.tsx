import {
  Ban,
  CheckCircle2,
  Eye,
  RefreshCw,
  Save,
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
  onRefreshSetup,
  onSaveSetup,
  onPreview,
  onStart,
  onCancel,
}: {
  scopedTrackIds: number[];
  setup: AudioConversionSetupResponse | null;
  preview: AudioConversionPreviewResponse | null;
  progress: AudioConversionProgress | null;
  onRefreshSetup: () => void | Promise<void>;
  onSaveSetup: (ffmpegPath: string | null) => void | Promise<void>;
  onPreview: (targetFolder: string, options: AudioConversionOptions) => void | Promise<void>;
  onStart: (targetFolder: string, options: AudioConversionOptions) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const [targetFolder, setTargetFolder] = useState("");
  const [ffmpegPath, setFfmpegPath] = useState("");
  const [outputFormat, setOutputFormat] = useState<AudioConversionFormat>("flac");
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [copyTags, setCopyTags] = useState(true);
  const [copyArtwork, setCopyArtwork] = useState(true);
  const [normalizeVolume, setNormalizeVolume] = useState(false);
  const [sampleRateHz, setSampleRateHz] = useState(0);
  const [bitrateKbps, setBitrateKbps] = useState(0);
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => {
    setFfmpegPath(setup?.configured_path ?? setup?.resolved_path ?? "");
  }, [setup?.configured_path, setup?.resolved_path]);

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

  return (
    <DisclosureSection title="Audio Conversion" description={`Transcode local files with FFmpeg, metadata/artwork copy, resampling, and loudness normalization for ${scopeLabel}`}>
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="rounded border border-line bg-ink p-3 text-xs">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className={setup?.available ? "font-medium text-moss" : "font-medium text-ember"}>
              {setup?.available ? "FFmpeg ready" : "FFmpeg setup needed"}
            </div>
            <button className="secondary-button h-8" type="button" onClick={() => void onRefreshSetup()}>
              <RefreshCw size={14} />
              Check
            </button>
          </div>
          <div className="text-muted">{setup?.message ?? "Checking FFmpeg setup"}</div>
          {setup?.version && <div className="mt-1 truncate text-muted">{setup.version}</div>}
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <input
              className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={ffmpegPath}
              placeholder={setup?.tool_directory ? `${setup.tool_directory}\\ffmpeg.exe` : "Path to ffmpeg.exe"}
              onChange={(event) => setFfmpegPath(event.target.value)}
            />
            <button className="secondary-button h-9" type="button" onClick={() => void onSaveSetup(ffmpegPath.trim() || null)}>
              <Save size={15} />
              Save Path
            </button>
            <button className="secondary-button h-9" type="button" onClick={() => void onSaveSetup(null)}>
              Clear
            </button>
          </div>
          {setup?.tool_directory && (
            <div className="mt-2 truncate text-muted">
              Portable option: put ffmpeg.exe in {setup.tool_directory}; PATH also works.
            </div>
          )}
          {setup?.errors.map((error) => (
            <div key={error} className="mt-1 truncate text-ember">
              {error}
            </div>
          ))}
        </div>

        <label className="grid gap-2">
          <span className="text-xs uppercase text-muted">Target Folder</span>
          <input
            className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
            value={targetFolder}
            placeholder="Example: D:\\Converted Music"
            onChange={(event) => setTargetFolder(event.target.value)}
          />
        </label>

        <div className="grid gap-2 md:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Format</span>
            <select
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={outputFormat}
              onChange={(event) => setOutputFormat(event.target.value as AudioConversionFormat)}
            >
              <option value="flac">FLAC</option>
              <option value="mp3">MP3</option>
              <option value="m4a">M4A / AAC</option>
              <option value="opus">Opus</option>
              <option value="wav">WAV</option>
            </select>
          </label>
          <NumberField label="Bitrate Kbps" value={bitrateKbps} min={0} max={1411} onChange={setBitrateKbps} />
          <NumberField label="Sample Rate Hz" value={sampleRateHz} min={0} max={384000} onChange={setSampleRateHz} />
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Overwrite</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
          </label>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
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

        {progress && (
          <div className="rounded border border-line bg-ink p-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-neutral-200">
                <SlidersHorizontal size={15} />
                {progress.message ?? progress.status}
              </div>
              <div className="text-muted">{progressPercent.toFixed(0)}%</div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full bg-moss transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-muted">
              <span>{progress.processed_tracks.toLocaleString()} / {progress.total_tracks.toLocaleString()}</span>
              <span>{progress.converted.toLocaleString()} converted</span>
              <span>{progress.skipped.toLocaleString()} skipped</span>
              {progress.current_track && <span className="min-w-0 truncate">{progress.current_track}</span>}
            </div>
            {progress.errors.slice(0, 5).map((error) => (
              <div key={error} className="mt-1 truncate text-ember">{error}</div>
            ))}
          </div>
        )}

        {preview && (
          <div className="rounded border border-line bg-ink p-3 text-xs">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-neutral-200">
              <CheckCircle2 size={15} />
              {preview.changed_count.toLocaleString()} conversion target{preview.changed_count === 1 ? "" : "s"}, {preview.collisions.toLocaleString()} collision{preview.collisions === 1 ? "" : "s"}
            </div>
            <div className="grid max-h-80 gap-1 overflow-auto pr-1">
              {preview.changes.slice(0, 60).map((change) => (
                <div key={change.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                  <div className="truncate text-neutral-200">{change.title ?? change.source_path}</div>
                  <div className={change.error || change.collision ? "truncate text-ember" : "truncate text-muted"}>
                    {change.error ?? change.target_path}
                    {change.collision ? " - target exists" : ""}
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
