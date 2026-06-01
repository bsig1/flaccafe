import type { Dispatch,SetStateAction } from "react";
import { useRef,useState } from "react";

import {
cancelClapAudioAnalysis,
fetchClapAudioAnalysis,
fetchClapCoverage,
fetchClapInstall,
fetchClapStatus,
fetchTrack,
fetchTrackPage,
pauseClapAudioAnalysis,
resumeClapAudioAnalysis,
startClapAudioAnalysis,
startClapInstall,
updateClapConfig,
} from "../../lib/api";
import type {
AudioAnalysisCoverage,
AudioAnalysisProgress,
ClapInstallDevice,
ClapInstallProgress,
ClapStatusResponse,
Track,
} from "../../types/api";
import type { Page } from "../shared";
import {
isAnalysisTerminal,
isClapInstallTerminal,
} from "../shared";

const CLAP_QUICK_STATUS_TTL_MS = 60_000;
const CLAP_DEEP_STATUS_TTL_MS = 15 * 60_000;

type AnalysisControllerDeps = {
  activePage: Page;
  currentTrack: Track | null;
  detailTrack: Track | null;
  loadAlbums: () => Promise<unknown>;
  loadArtists: () => Promise<unknown>;
  loadLibraryStats: () => Promise<unknown>;
  refreshTracks: () => Promise<unknown>;
  replaceTrackEverywhere: (track: Track) => void;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useAnalysisController({
  activePage,
  currentTrack,
  detailTrack,
  loadAlbums,
  loadArtists,
  loadLibraryStats,
  refreshTracks,
  replaceTrackEverywhere,
  setStatus,
}: AnalysisControllerDeps) {
  const clapStatusRequestIdRef = useRef(0);
  const clapQuickStatusLoadedAtRef = useRef(0);
  const clapDeepStatusLoadedAtRef = useRef(0);
  const [clapStatus, setClapStatus] = useState<ClapStatusResponse | null>(null);
  const [clapModelId, setClapModelId] = useState("");
  const [clapCacheDir, setClapCacheDir] = useState("");
  const [clapSamplesPerTrack, setClapSamplesPerTrack] = useState(3);
  const [clapBatchSize, setClapBatchSize] = useState(4);
  const [audioAnalysisProgress, setAudioAnalysisProgress] = useState<AudioAnalysisProgress | null>(null);
  const [audioAnalysisCoverage, setAudioAnalysisCoverage] = useState<AudioAnalysisCoverage | null>(null);
  const [audioAnalysisEligibleTrackTotal, setAudioAnalysisEligibleTrackTotal] = useState<number | null>(null);
  const [audioAnalysisJobId, setAudioAnalysisJobId] = useState<string | null>(null);
  const [clapInstallProgress, setClapInstallProgress] = useState<ClapInstallProgress | null>(null);
  const [isClapStatusLoading, setIsClapStatusLoading] = useState(false);
  const [clapStatusLoadPercent, setClapStatusLoadPercent] = useState(0);
  const [clapStatusLoadMessage, setClapStatusLoadMessage] = useState("Checking CLAP runtime");
  const [isClapInstalling, setIsClapInstalling] = useState(false);
  const [audioAnalysisLimit, setAudioAnalysisLimit] = useState(0);
  const [audioAnalysisOverwrite, setAudioAnalysisOverwrite] = useState(false);
  const [audioAnalysisOnlyMissing, setAudioAnalysisOnlyMissing] = useState(true);
  const [isAudioAnalyzing, setIsAudioAnalyzing] = useState(false);
  function applyClapStatus(response: ClapStatusResponse) {
    setClapStatus(response);
    setClapModelId(response.model_id);
    setClapCacheDir(response.cache_dir);
    setClapSamplesPerTrack(response.samples_per_track ?? 3);
    setClapBatchSize(response.batch_size ?? 4);
  }

  async function loadClapStatus(
    options: {
      deep?: boolean;
      showProgress?: boolean;
      message?: string;
    } = {},
  ): Promise<ClapStatusResponse | null> {
    const requestId = ++clapStatusRequestIdRef.current;
    let progressTimer: number | null = null;
    if (options.showProgress) {
      setIsClapStatusLoading(true);
      setClapStatusLoadPercent(options.deep ? 45 : 8);
      setClapStatusLoadMessage(options.message ?? (options.deep ? "Verifying CLAP runtime" : "Reading CLAP setup"));
      progressTimer = window.setInterval(() => {
        setClapStatusLoadPercent((current) => Math.min(options.deep ? 92 : 45, current + (options.deep ? 4 : 10)));
      }, 450);
    }
    try {
      const response = await fetchClapStatus(Boolean(options.deep));
      if (requestId === clapStatusRequestIdRef.current) {
        applyClapStatus(response);
        const loadedAt = Date.now();
        clapQuickStatusLoadedAtRef.current = loadedAt;
        if (options.deep) {
          clapDeepStatusLoadedAtRef.current = loadedAt;
        }
        if (options.showProgress) {
          setClapStatusLoadPercent(100);
          setClapStatusLoadMessage(options.deep ? "CLAP verification complete" : "CLAP setup loaded");
        }
      }
      return response;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load CLAP status");
      return null;
    } finally {
      if (progressTimer !== null) {
        window.clearInterval(progressTimer);
      }
      if (requestId === clapStatusRequestIdRef.current && options.showProgress) {
        window.setTimeout(() => {
          if (requestId === clapStatusRequestIdRef.current) {
            setIsClapStatusLoading(false);
          }
        }, 450);
      }
    }
  }

  async function loadAnalysisClapReadiness(forceDeep = false) {
    void loadClapCoverage();
    const now = Date.now();
    const hasCachedStatus = clapStatus !== null;
    const quickStatusFresh = hasCachedStatus && now - clapQuickStatusLoadedAtRef.current < CLAP_QUICK_STATUS_TTL_MS;
    const deepStatusFresh = hasCachedStatus && now - clapDeepStatusLoadedAtRef.current < CLAP_DEEP_STATUS_TTL_MS;
    const quickStatus = !forceDeep && quickStatusFresh
      ? clapStatus
      : await loadClapStatus({
          deep: false,
          showProgress: forceDeep || !hasCachedStatus,
          message: "Reading CLAP setup",
        });
    const quickDeps = Object.values(quickStatus?.dependencies ?? {});
    const runtimeLooksPresent = Boolean(
      quickStatus &&
        (quickStatus.installed ||
          quickStatus.runtime_exists ||
          !quickStatus.runtime_managed ||
          quickDeps.some(Boolean)),
    );
    const shouldVerifyDeep = Boolean(
      runtimeLooksPresent && (forceDeep || !deepStatusFresh),
    );
    if (shouldVerifyDeep) {
      void loadClapStatus({
        deep: true,
        showProgress: forceDeep || !deepStatusFresh,
        message: "Verifying CLAP runtime",
      });
    }
  }

  async function loadClapCoverage() {
    try {
      const [coverage, eligibleTrackPage] = await Promise.all([
        fetchClapCoverage(),
        fetchTrackPage({ limit: 1, offset: 0, sortBy: "artist", sortDirection: "asc" }).catch(() => null),
      ]);
      setAudioAnalysisCoverage(coverage);
      if (eligibleTrackPage) {
        setAudioAnalysisEligibleTrackTotal(eligibleTrackPage.total);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load CLAP coverage");
    }
  }

  async function refreshAnalyzedState(trackIds?: number[]) {
    await refreshTracks();
    await loadAlbums();
    await loadArtists();
    await loadLibraryStats();
    await loadClapCoverage();

    const detailId = detailTrack?.id;
    const currentId = currentTrack?.id;
    const idsToRefresh = Array.from(
      new Set(
        [detailId, currentId, ...(trackIds ?? [])].filter(
          (trackId): trackId is number => typeof trackId === "number",
        ),
      ),
    );
    await Promise.all(
      idsToRefresh.map(async (trackId) => {
        try {
          replaceTrackEverywhere(await fetchTrack(trackId));
        } catch {
          // Track may have been removed during a rescan.
        }
      }),
    );
  }

  async function handleSaveClapConfig() {
    try {
      const response = await updateClapConfig({
        model_id: clapModelId.trim() || null,
        cache_dir: clapCacheDir.trim() || null,
        samples_per_track: clapSamplesPerTrack,
        batch_size: clapBatchSize,
      });
      applyClapStatus(response);
      clapQuickStatusLoadedAtRef.current = Date.now();
      clapDeepStatusLoadedAtRef.current = 0;
      setStatus(response.message ?? "CLAP configuration saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save CLAP configuration");
    }
  }

  async function handleInstallClap(device: ClapInstallDevice, force = false) {
    if (isClapInstalling) {
      return;
    }
    setIsClapInstalling(true);
    setClapInstallProgress(null);
    setStatus(device === "cuda" ? "Installing NVIDIA CUDA ML runtime" : "Installing CPU ML runtime");
    try {
      const started = await startClapInstall({ device, force });
      let latest: ClapInstallProgress | null = null;
      let lastInstallMessage = "";
      const setInstallStatus = (message: string) => {
        if (message !== lastInstallMessage) {
          lastInstallMessage = message;
          setStatus(message);
        }
      };
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        latest = await fetchClapInstall(started.job_id);
        setClapInstallProgress(latest);
        setInstallStatus(latest.message ?? "Installing CLAP ML runtime");
        if (isClapInstallTerminal(latest.status)) {
          break;
        }
      }
      if (latest.status === "failed") {
        setStatus(latest.error ?? "CLAP install failed");
        return;
      }
      setStatus("CLAP ML runtime installed");
      await loadClapStatus({
        deep: true,
        showProgress: activePage === "analysis",
        message: "Verifying installed CLAP runtime",
      });
      await loadClapCoverage();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CLAP install failed");
    } finally {
      setIsClapInstalling(false);
    }
  }

  async function handleAnalyzeAudio(trackIds?: number[]) {
    if (isAudioAnalyzing) {
      return;
    }
    const targetedTrackIds = trackIds?.length ? Array.from(new Set(trackIds)) : null;
    setIsAudioAnalyzing(true);
    setAudioAnalysisProgress(null);
    setAudioAnalysisJobId(null);
    setStatus(targetedTrackIds ? "CLAP analysis started for selected tracks" : "CLAP library analysis started");
    try {
      const started = await startClapAudioAnalysis({
        limit: targetedTrackIds ? targetedTrackIds.length : audioAnalysisLimit > 0 ? audioAnalysisLimit : null,
        overwrite: targetedTrackIds ? true : audioAnalysisOverwrite,
        only_missing: targetedTrackIds ? false : audioAnalysisOnlyMissing,
        track_ids: targetedTrackIds,
      });
      setAudioAnalysisJobId(started.job_id);
      let latest: AudioAnalysisProgress | null = null;
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        latest = await fetchClapAudioAnalysis(started.job_id);
        setAudioAnalysisProgress(latest);
        if (isAnalysisTerminal(latest.status)) {
          break;
        }
      }
      if (latest.status === "failed") {
        setStatus(latest.message ?? "CLAP audio analysis failed");
        return;
      }
      if (latest.status === "canceled") {
        setStatus("CLAP audio analysis canceled");
        await loadClapCoverage();
        return;
      }
      setStatus(`Analyzed ${latest.analyzed} tracks with CLAP`);
      await refreshAnalyzedState(targetedTrackIds ?? undefined);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CLAP audio analysis failed");
    } finally {
      setIsAudioAnalyzing(false);
      setAudioAnalysisJobId(null);
    }
  }

  function handleAnalyzeTracks(trackIds: number[]) {
    if (trackIds.length > 0) {
      void handleAnalyzeAudio(trackIds);
    }
  }

  async function handlePauseAudioAnalysis() {
    if (!audioAnalysisJobId) {
      return;
    }
    try {
      const latest = await pauseClapAudioAnalysis(audioAnalysisJobId);
      setAudioAnalysisProgress(latest);
      setStatus(latest.message ?? "CLAP analysis paused");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not pause CLAP analysis");
    }
  }

  async function handleResumeAudioAnalysis() {
    if (!audioAnalysisJobId) {
      return;
    }
    try {
      const latest = await resumeClapAudioAnalysis(audioAnalysisJobId);
      setAudioAnalysisProgress(latest);
      setStatus(latest.message ?? "CLAP analysis resumed");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not resume CLAP analysis");
    }
  }

  async function handleCancelAudioAnalysis() {
    if (!audioAnalysisJobId) {
      return;
    }
    try {
      const latest = await cancelClapAudioAnalysis(audioAnalysisJobId);
      setAudioAnalysisProgress(latest);
      setStatus(latest.message ?? "Canceling CLAP analysis");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not cancel CLAP analysis");
    }
  }


  return {
    clapStatus,
    setClapStatus,
    clapModelId,
    setClapModelId,
    clapCacheDir,
    setClapCacheDir,
    clapSamplesPerTrack,
    setClapSamplesPerTrack,
    clapBatchSize,
    setClapBatchSize,
    audioAnalysisProgress,
    setAudioAnalysisProgress,
    audioAnalysisCoverage,
    setAudioAnalysisCoverage,
    audioAnalysisEligibleTrackTotal,
    setAudioAnalysisEligibleTrackTotal,
    audioAnalysisJobId,
    setAudioAnalysisJobId,
    clapInstallProgress,
    setClapInstallProgress,
    isClapStatusLoading,
    setIsClapStatusLoading,
    clapStatusLoadPercent,
    setClapStatusLoadPercent,
    clapStatusLoadMessage,
    setClapStatusLoadMessage,
    isClapInstalling,
    setIsClapInstalling,
    audioAnalysisLimit,
    setAudioAnalysisLimit,
    audioAnalysisOverwrite,
    setAudioAnalysisOverwrite,
    audioAnalysisOnlyMissing,
    setAudioAnalysisOnlyMissing,
    isAudioAnalyzing,
    setIsAudioAnalyzing,
    applyClapStatus,
    loadClapStatus,
    loadAnalysisClapReadiness,
    loadClapCoverage,
    refreshAnalyzedState,
    handleSaveClapConfig,
    handleInstallClap,
    handleAnalyzeAudio,
    handleAnalyzeTracks,
    handlePauseAudioAnalysis,
    handleResumeAudioAnalysis,
    handleCancelAudioAnalysis,
  };
}
