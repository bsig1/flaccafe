import type { Dispatch,SetStateAction } from "react";
import { useState } from "react";

import {
cancelAudioConversion,
fetchAudioConversionFfmpegInstall,
fetchAudioConversionProgress,
fetchAudioConversionSetup,
fetchCdRipSetup,
previewAudioConversion,
saveAudioConversionSetup,
startAudioConversion,
startAudioConversionFfmpegInstall,
} from "../../../lib/api";
import type {
AudioConversionFormat,
AudioConversionInstallProgress,
AudioConversionPreviewResponse,
AudioConversionProgress,
AudioConversionSetupResponse,
CdRipSetupResponse,
} from "../../../types/api";
import { formatTime } from "../../shared";

type AudioConversionControllerDeps = {
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useAudioConversionController({ setStatus }: AudioConversionControllerDeps) {
  const [audioConversionSetup, setAudioConversionSetup] = useState<AudioConversionSetupResponse | null>(null);
  const [audioConversionInstallProgress, setAudioConversionInstallProgress] = useState<AudioConversionInstallProgress | null>(null);
  const [audioConversionPreview, setAudioConversionPreview] = useState<AudioConversionPreviewResponse | null>(null);
  const [audioConversionProgress, setAudioConversionProgress] = useState<AudioConversionProgress | null>(null);
  const [audioConversionJobId, setAudioConversionJobId] = useState<string | null>(null);
  const [cdRipSetup, setCdRipSetup] = useState<CdRipSetupResponse | null>(null);
  async function loadAudioConversionSetup() {
    try {
      setAudioConversionSetup(await fetchAudioConversionSetup());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not check FFmpeg setup");
    }
  }

  async function loadCdRipSetup(showError = false) {
    try {
      setCdRipSetup(await fetchCdRipSetup());
    } catch (error) {
      if (showError) {
        setStatus(error instanceof Error ? error.message : "Could not check CD drive");
      }
    }
  }

  async function handleSaveAudioConversionSetup(ffmpegPath: string | null) {
    try {
      const response = await saveAudioConversionSetup({ ffmpeg_path: ffmpegPath });
      setAudioConversionSetup(response);
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save FFmpeg setup");
    }
  }

  async function handleInstallAudioConversionFfmpeg() {
    if (
      !window.confirm(
        "Download the FFmpeg essentials build from Gyan.dev and install it into FLAC Cafe's local tool folder?",
      )
    ) {
      return;
    }
    try {
      setAudioConversionInstallProgress(null);
      setStatus("Starting FFmpeg install...");
      const started = await startAudioConversionFfmpegInstall();
      let latest: AudioConversionInstallProgress | null = null;
      do {
        latest = await fetchAudioConversionFfmpegInstall(started.job_id);
        setAudioConversionInstallProgress(latest);
        if (["completed", "failed"].includes(latest.status)) {
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      } while (latest.status !== "completed" && latest.status !== "failed");

      await loadAudioConversionSetup();
      if (latest.status === "completed") {
        setStatus(latest.message || "FFmpeg was installed for FLAC Cafe.");
      } else {
        setStatus(latest.error || latest.message || "Could not install FFmpeg");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not install FFmpeg");
    }
  }

  function audioConversionRequest(
    targetFolder: string,
    options: {
      outputFormat: AudioConversionFormat;
      preserveStructure: boolean;
      copyTags: boolean;
      copyArtwork: boolean;
      normalizeVolume: boolean;
      sampleRateHz: number | null;
      bitrateKbps: number | null;
      overwrite: boolean;
      trackIds: number[] | null;
    },
    limit?: number | null,
  ) {
    return {
      target_folder: targetFolder.trim(),
      output_format: options.outputFormat,
      track_ids: options.trackIds?.length ? options.trackIds : null,
      preserve_structure: options.preserveStructure,
      copy_tags: options.copyTags,
      copy_artwork: options.copyArtwork,
      normalize_volume: options.normalizeVolume,
      sample_rate_hz: options.sampleRateHz,
      bitrate_kbps: options.bitrateKbps,
      overwrite: options.overwrite,
      limit,
    };
  }

  async function handlePreviewAudioConversion(
    targetFolder: string,
    options: {
      outputFormat: AudioConversionFormat;
      preserveStructure: boolean;
      copyTags: boolean;
      copyArtwork: boolean;
      normalizeVolume: boolean;
      sampleRateHz: number | null;
      bitrateKbps: number | null;
      overwrite: boolean;
      trackIds: number[] | null;
    },
  ) {
    if (!targetFolder.trim()) {
      setStatus("Choose a conversion target folder first");
      return;
    }
    try {
      const response = await previewAudioConversion(audioConversionRequest(targetFolder, options, 200));
      setAudioConversionPreview(response);
      setStatus(`${response.changed_count.toLocaleString()} of ${response.total.toLocaleString()} matching tracks would convert`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview audio conversion");
    }
  }

  async function handleStartAudioConversion(
    targetFolder: string,
    options: {
      outputFormat: AudioConversionFormat;
      preserveStructure: boolean;
      copyTags: boolean;
      copyArtwork: boolean;
      normalizeVolume: boolean;
      sampleRateHz: number | null;
      bitrateKbps: number | null;
      overwrite: boolean;
      trackIds: number[] | null;
    },
  ) {
    if (!targetFolder.trim()) {
      setStatus("Choose a conversion target folder first");
      return;
    }
    const scopeLabel = options.trackIds?.length
      ? `${options.trackIds.length.toLocaleString()} selected/scoped track${options.trackIds.length === 1 ? "" : "s"}`
      : "every matching track in the library";
    if (!window.confirm(`Start audio conversion for ${scopeLabel}? This writes new audio files into the target folder.`)) {
      return;
    }
    try {
      setAudioConversionProgress(null);
      const started = await startAudioConversion(audioConversionRequest(targetFolder, options));
      setAudioConversionJobId(started.job_id);
      let latest: AudioConversionProgress | null = null;
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        latest = await fetchAudioConversionProgress(started.job_id);
        setAudioConversionProgress(latest);
        setStatus(
          latest.message ??
            `Converting ${latest.processed_tracks}/${latest.total_tracks} tracks - ETA ${formatTime(latest.eta_seconds)}`,
        );
        if (["completed", "failed", "canceled"].includes(latest.status)) {
          break;
        }
      }
      if (latest.status === "failed") {
        setStatus(latest.error ?? "Audio conversion failed");
      } else if (latest.status === "canceled") {
        setStatus("Audio conversion canceled");
      } else {
        setStatus(`Converted ${latest.converted.toLocaleString()} track${latest.converted === 1 ? "" : "s"}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start audio conversion");
    }
  }

  async function handleCancelAudioConversion() {
    if (!audioConversionJobId) {
      return;
    }
    try {
      const latest = await cancelAudioConversion(audioConversionJobId);
      setAudioConversionProgress(latest);
      setStatus(latest.message ?? "Canceling audio conversion");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not cancel audio conversion");
    }
  }


  return {
    audioConversionSetup,
    setAudioConversionSetup,
    audioConversionInstallProgress,
    setAudioConversionInstallProgress,
    audioConversionPreview,
    setAudioConversionPreview,
    audioConversionProgress,
    setAudioConversionProgress,
    audioConversionJobId,
    setAudioConversionJobId,
    cdRipSetup,
    setCdRipSetup,
    loadAudioConversionSetup,
    loadCdRipSetup,
    handleSaveAudioConversionSetup,
    handleInstallAudioConversionFfmpeg,
    audioConversionRequest,
    handlePreviewAudioConversion,
    handleStartAudioConversion,
    handleCancelAudioConversion,
  };
}
