import {
  Download,
  Eye,
  RefreshCw,
  Volume2,
} from "lucide-react";
import { useState } from "react";

import { volumeTags } from "../../../lib/api";
import type {
  AudioConversionSetupResponse,
  VolumeTagResponse,
} from "../../../types/api";
import { DisclosureSection } from "../../components/common";
import { currentScope } from "./fileManagementUtils";

type VolumeTagMode = "analyze" | "manual";

function formatGain(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} dB`;
}

function formatPeak(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(3);
}

export function VolumeTagsSection({
  scopedTrackIds,
  ffmpegSetup,
  defaultOpen,
  openSignal,
  onRefreshFfmpeg,
  onInstallFfmpeg,
  onLibraryChanged,
  setStatus,
}: {
  scopedTrackIds: number[];
  ffmpegSetup: AudioConversionSetupResponse | null;
  defaultOpen?: boolean;
  openSignal?: string;
  onRefreshFfmpeg: () => void | Promise<void>;
  onInstallFfmpeg: () => void | Promise<void>;
  onLibraryChanged: () => void | Promise<void>;
  setStatus: (message: string) => void;
}) {
  const [preview, setPreview] = useState<VolumeTagResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<VolumeTagMode>("analyze");
  const [writeToFile, setWriteToFile] = useState(true);
  const [limit, setLimit] = useState(50);
  const [manualTrackGain, setManualTrackGain] = useState("0");
  const [manualTrackPeak, setManualTrackPeak] = useState("1");
  const [manualAlbumGain, setManualAlbumGain] = useState("");
  const [manualAlbumPeak, setManualAlbumPeak] = useState("");

  function optionalNumber(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const manualValues = {
    trackGain: optionalNumber(manualTrackGain),
    trackPeak: optionalNumber(manualTrackPeak),
    albumGain: optionalNumber(manualAlbumGain),
    albumPeak: optionalNumber(manualAlbumPeak),
  };
  const manualHasValue = Object.values(manualValues).some((value) => value !== null);
  const ffmpegMissing = mode === "analyze" && ffmpegSetup?.available === false;

  async function previewVolumeTags(apply = false) {
    const scope = currentScope(scopedTrackIds);
    const targetLabel = writeToFile ? "the library and selected audio files" : "FLAC Cafe's database only";
    if (apply && !window.confirm(`Write these volume tags to ${targetLabel}?`)) {
      return;
    }
    setBusy(true);
    setStatus(
      apply
        ? "Writing volume tags..."
        : mode === "manual"
          ? "Building manual volume tag preview..."
          : "Analyzing volume tags...",
    );
    try {
      const response = await volumeTags({
        track_ids: scope,
        mode,
        apply,
        write_to_file: writeToFile,
        limit,
        manual_track_gain_db: mode === "manual" ? manualValues.trackGain : null,
        manual_track_peak: mode === "manual" ? manualValues.trackPeak : null,
        manual_album_gain_db: mode === "manual" ? manualValues.albumGain : null,
        manual_album_peak: mode === "manual" ? manualValues.albumPeak : null,
      });
      setPreview(response);
      if (apply && response.applied > 0) {
        await onLibraryChanged();
      }
      if (response.errors.length > 0 && response.total === 0) {
        setStatus(response.errors[0]);
      } else {
        setStatus(
          apply
            ? `Wrote volume tags for ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`
            : `Volume tag preview found ${response.changed.toLocaleString()} track${response.changed === 1 ? "" : "s"} to update`,
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not analyze volume tags");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DisclosureSection
      title="Volume Tags"
      description="Analyze loudness and write ReplayGain-style volume tags"
      defaultOpen={defaultOpen}
      openSignal={openSignal}
    >
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
          Analyze mode scans audio with FFmpeg. Manual mode marks selected tracks with the gain and peak values you enter. Neither mode changes the audio samples.
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["analyze", "manual"] as const).map((nextMode) => (
            <button
              key={nextMode}
              className={`rounded border px-3 py-2 text-left transition ${
                mode === nextMode
                  ? "border-moss/40 bg-moss/15 text-white"
                  : "border-line bg-ink text-muted hover:bg-white/5 hover:text-white"
              }`}
              type="button"
              onClick={() => setMode(nextMode)}
            >
              <span className="block text-sm font-medium">
                {nextMode === "analyze" ? "Analyze with FFmpeg" : "Manual mark"}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {nextMode === "analyze" ? "Measure loudness and peak values." : "Set known volume tags directly."}
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span>
              <span className="block text-neutral-200">Write tags to audio files</span>
              <span className="text-xs text-muted">Turn this off to update only FLAC Cafe's database.</span>
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-moss"
              checked={writeToFile}
              onChange={(event) => setWriteToFile(event.target.checked)}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Track Limit</span>
            <input
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
              type="number"
              min={1}
              max={1000}
              value={limit}
              onChange={(event) => setLimit(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
            />
          </label>
        </div>
        {mode === "analyze" && (
          <div className="rounded border border-line/70 bg-ink p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className={ffmpegSetup?.available ? "font-medium text-moss" : "font-medium text-ember"}>
                  {ffmpegSetup?.available ? "FFmpeg ready" : "FFmpeg needed for analysis"}
                </div>
                <div className="mt-1 truncate text-muted">
                  {ffmpegSetup?.message ?? "Install FFmpeg to analyze volume tags, or switch to Manual mark."}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button h-8" type="button" onClick={() => void onRefreshFfmpeg()}>
                  <RefreshCw size={14} />
                  Check
                </button>
                {!ffmpegSetup?.available && (
                  <button className="primary-button h-8" type="button" onClick={() => void onInstallFfmpeg()}>
                    <Download size={14} />
                    Install FFmpeg
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {mode === "manual" && (
          <div className="grid gap-3 rounded border border-line/70 bg-ink p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Track Gain dB</span>
              <input
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                inputMode="decimal"
                value={manualTrackGain}
                placeholder="0"
                onChange={(event) => setManualTrackGain(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Track Peak</span>
              <input
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                inputMode="decimal"
                value={manualTrackPeak}
                placeholder="1"
                onChange={(event) => setManualTrackPeak(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Album Gain dB</span>
              <input
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                inputMode="decimal"
                value={manualAlbumGain}
                placeholder="leave unchanged"
                onChange={(event) => setManualAlbumGain(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase text-muted">Album Peak</span>
              <input
                className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                inputMode="decimal"
                value={manualAlbumPeak}
                placeholder="leave unchanged"
                onChange={(event) => setManualAlbumPeak(event.target.value)}
              />
            </label>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted">
            Use selected track IDs when present; otherwise the tool starts with the newest music tracks.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="secondary-button"
              type="button"
              disabled={busy || ffmpegMissing || (mode === "manual" && !manualHasValue)}
              onClick={() => void previewVolumeTags(false)}
            >
              <Eye size={15} />
              {mode === "manual" ? "Preview Manual Tags" : "Preview Volume Tags"}
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={busy || ffmpegMissing || (mode === "manual" && !manualHasValue) || (preview?.changed ?? 1) === 0}
              onClick={() => void previewVolumeTags(true)}
            >
              <Volume2 size={15} />
              {mode === "manual" ? "Write Manual Tags" : "Write Volume Tags"}
            </button>
          </div>
        </div>
        {preview && (
          <div className="rounded border border-line bg-ink p-3 text-xs">
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <div>
                <div className="font-semibold text-white">{preview.total.toLocaleString()}</div>
                <div className="text-muted">Scanned</div>
              </div>
              <div>
                <div className="font-semibold text-moss">{preview.changed.toLocaleString()}</div>
                <div className="text-muted">Would update</div>
              </div>
              <div>
                <div className="font-semibold text-ember">{preview.applied.toLocaleString()}</div>
                <div className="text-muted">Written</div>
              </div>
            </div>
            <div className="grid max-h-80 gap-1 overflow-auto pr-1">
              {preview.previews.slice(0, 80).map((trackPreview) => (
                <div key={trackPreview.track_id} className="grid gap-2 rounded bg-panel px-2 py-2">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-neutral-200">
                        {trackPreview.title || "(untitled)"}
                        {trackPreview.artist ? ` - ${trackPreview.artist}` : ""}
                      </div>
                      <div className="truncate text-muted">{trackPreview.album || "Unknown album"}</div>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${
                      trackPreview.error
                        ? "border-ember/40 text-ember"
                        : trackPreview.changed
                          ? "border-moss/40 text-moss"
                          : "border-line text-muted"
                    }`}>
                      {trackPreview.error ? "Error" : trackPreview.applied ? "Written" : trackPreview.changed ? "Update" : "Current"}
                    </span>
                  </div>
                  {trackPreview.error ? (
                    <div className="text-ember">{trackPreview.error}</div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded border border-line/60 bg-ink px-2 py-1">
                        <span className="text-muted">Track gain </span>
                        <span className="text-neutral-200">{formatGain(trackPreview.current_track_gain_db)}</span>
                        <span className="mx-1 text-muted">to</span>
                        <span className="text-white">{formatGain(trackPreview.proposed_track_gain_db)}</span>
                        <span className="ml-2 text-muted">Peak {formatPeak(trackPreview.proposed_track_peak)}</span>
                      </div>
                      <div className="rounded border border-line/60 bg-ink px-2 py-1">
                        <span className="text-muted">Album gain </span>
                        <span className="text-neutral-200">{formatGain(trackPreview.current_album_gain_db)}</span>
                        <span className="mx-1 text-muted">to</span>
                        <span className="text-white">{formatGain(trackPreview.proposed_album_gain_db)}</span>
                        <span className="ml-2 text-muted">Peak {formatPeak(trackPreview.proposed_album_peak)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {preview.errors.length > 0 && (
              <details className="mt-3 text-xs text-ember">
                <summary>Volume tag notes</summary>
                <div className="mt-2 grid gap-1">
                  {preview.errors.slice(0, 20).map((error) => (
                    <div key={error} className="truncate">{error}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </DisclosureSection>
  );
}
