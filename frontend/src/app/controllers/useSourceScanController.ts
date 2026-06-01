import type { Dispatch,MutableRefObject,SetStateAction } from "react";
import { useRef,useState } from "react";

import {
acknowledgeFolderWatchNotifications,
applyFolderWatchChanges,
cancelScanLibrary,
fetchFolderWatchStatus,
fetchScanProgress,
refreshFolderWatch,
removeLibrarySource,
startFolderWatch,
startScanLibrary,
stopFolderWatch,
} from "../../lib/api";
import { desktopRemoveLibrarySource } from "../../lib/desktopLibrary";
import {
FolderWatchMarkEvent,
FolderWatchStart,
FolderWatchStop,
PathInfo,
desktopScanAudioPaths,
isDesktopBridgeUnavailable,
} from "../../lib/desktopPath";
import type {
FolderWatchApplyResponse,
FolderWatchStatus,
LibrarySourceRemoveResponse,
ScanProgress,
ScanResult,
SettingsResponse,
desktopScanSnapshot,
} from "../../types/api";
import {
sourceFolderKey,
uniqueFolderPaths,
} from "../appHelpers";
import { formatTime } from "../shared";

export interface SourceScanOptions {
  cleanupFolderPaths?: string[];
}

type SourceScanControllerDeps = {
  FolderWatchRefreshTimerRef: MutableRefObject<number | null>;
  lastFolderWatchNotificationIdRef: MutableRefObject<string | null>;
  loadAlbums: () => Promise<unknown>;
  loadArtists: () => Promise<unknown>;
  loadClapCoverage: () => Promise<unknown>;
  loadInbox: () => Promise<unknown>;
  loadLibraryStats: () => Promise<unknown>;
  loadPlaylists: () => Promise<unknown>;
  loadSettings: () => Promise<unknown>;
  refreshTracks: () => Promise<unknown>;
  settings: SettingsResponse | null;
  setSettings: Dispatch<SetStateAction<SettingsResponse | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useSourceScanController({
  FolderWatchRefreshTimerRef,
  lastFolderWatchNotificationIdRef,
  loadAlbums,
  loadArtists,
  loadClapCoverage,
  loadInbox,
  loadLibraryStats,
  loadPlaylists,
  loadSettings,
  refreshTracks,
  settings,
  setSettings,
  setStatus,
}: SourceScanControllerDeps) {
  const [folderPath, setFolderPath] = useState("");
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanStuck, setScanStuck] = useState(false);
  const [scanStuckMessage, setScanStuckMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [folderWatchStatus, setFolderWatchStatus] = useState<FolderWatchStatus | null>(null);
  const activeScanJobIdRef = useRef<string | null>(null);
  const lastScanRequestRef = useRef<{ paths: string[]; options: SourceScanOptions } | null>(null);
  const scanCancelRequestedRef = useRef(false);
  const scanStuckRef = useRef(false);
  async function validateMusicFoldersWithDesktop(paths: string[]) {
    try {
      const infos = await Promise.all(paths.map((path) => PathInfo(path)));
      const invalid = infos.find((info) => !info.exists || !info.is_dir);
      if (invalid) {
        throw new Error(`${invalid.input_path} is not an available folder`);
      }
    } catch (error) {
      if (isDesktopBridgeUnavailable(error)) {
        return;
      }
      throw error;
    }
  }

  async function buildDesktopScanSnapshot(paths: string[], statusLabel = "Finding audio files"): Promise<desktopScanSnapshot | null> {
    try {
      setStatus(statusLabel);
      const snapshot = await desktopScanAudioPaths({
        paths,
        includeFiles: true,
        limit: null,
      });
      const suffix = snapshot.errors.length
        ? ` (${snapshot.errors.length.toLocaleString()} folder error${snapshot.errors.length === 1 ? "" : "s"})`
        : "";
      setStatus(`Found ${snapshot.total_files.toLocaleString()} audio file${snapshot.total_files === 1 ? "" : "s"} with the Rust scanner${suffix}`);
      return snapshot;
    } catch (error) {
      if (isDesktopBridgeUnavailable(error)) {
        return null;
      }
      throw error;
    }
  }

  function applyFolderWatchStatus(statusResponse: FolderWatchStatus, notify = false) {
    setFolderWatchStatus(statusResponse);
    const latestNotification = [...(statusResponse.notifications ?? [])]
      .reverse()
      .find((notification) => !notification.acknowledged);
    if (!notify || !latestNotification || latestNotification.id === lastFolderWatchNotificationIdRef.current) {
      return;
    }
    lastFolderWatchNotificationIdRef.current = latestNotification.id;
    setStatus(`${latestNotification.title}: ${latestNotification.message}`);
  }

  async function loadFolderWatchStatus(showError = false) {
    try {
      const response = await fetchFolderWatchStatus();
      applyFolderWatchStatus(response, false);
      try {
        if (response.enabled && response.folder_path) {
          await FolderWatchStart([response.folder_path], 1200);
        } else {
          await FolderWatchStop();
        }
      } catch {
        // Rust events are an acceleration layer; Python's watcher remains authoritative.
      }
    } catch (error) {
      if (showError) {
        setStatus(error instanceof Error ? error.message : "Could not load folder watch status");
      }
    }
  }

  async function handleScan(pathOverride?: string | string[], options: SourceScanOptions = {}) {
    const targetPaths = uniqueFolderPaths(
      Array.isArray(pathOverride)
        ? pathOverride
        : pathOverride
          ? [pathOverride]
          : [...libraryFolders, folderPath],
    );
    const cleanupFolderPaths = uniqueFolderPaths(options.cleanupFolderPaths ?? targetPaths);
    if (targetPaths.length === 0) {
      setStatus("Add at least one music folder path");
      return;
    }
    lastScanRequestRef.current = { paths: targetPaths, options };
    scanCancelRequestedRef.current = false;
    scanStuckRef.current = false;
    setScanStuck(false);
    setScanStuckMessage(null);
    setStatus(targetPaths.length === 1 ? "Starting library scan" : `Starting scan of ${targetPaths.length} folders`);
    setIsScanning(true);
    setScanResult(null);
    setScanProgress(null);
    try {
      await validateMusicFoldersWithDesktop(targetPaths);
      const savePaths = pathOverride ? uniqueFolderPaths([...libraryFolders, ...targetPaths]) : targetPaths;
      const desktopSnapshot = await buildDesktopScanSnapshot(targetPaths);
      if (scanCancelRequestedRef.current) {
        setStatus("Scan cancelled");
        return;
      }
      const started = await startScanLibrary(targetPaths, savePaths, desktopSnapshot, { cleanupFolderPaths });
      activeScanJobIdRef.current = started.job_id;
      let latest: ScanProgress | null = null;
      let lastProgressSignature = "";
      let lastProgressChangedAt = Date.now();

      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        latest = await fetchScanProgress(started.job_id);
        setScanProgress(latest);
        const progressSignature = [
          latest.status,
          latest.processed_files,
          latest.inserted,
          latest.updated,
          latest.removed,
          latest.skipped,
          latest.current_path ?? "",
        ].join("|");
        if (progressSignature !== lastProgressSignature) {
          lastProgressSignature = progressSignature;
          lastProgressChangedAt = Date.now();
          if (scanStuckRef.current) {
            scanStuckRef.current = false;
            setScanStuck(false);
            setScanStuckMessage(null);
          }
        } else if (
          !scanStuckRef.current &&
          ["counting", "scanning", "cleaning"].includes(latest.status) &&
          Date.now() - lastProgressChangedAt > 20_000
        ) {
          scanStuckRef.current = true;
          setScanStuck(true);
          setScanStuckMessage("This scan has not reported new progress for about 20 seconds.");
        }

        if (latest.status === "cleaning") {
          setStatus(`Removing missing tracks (${latest.removed} found)`);
        } else if (latest.status === "cancelling") {
          setStatus("Cancelling library scan");
        } else if (latest.total_files > 0) {
          setStatus(
            `Scanning ${latest.processed_files}/${latest.total_files} files - ETA ${formatTime(
              latest.eta_seconds,
            )}`,
          );
        } else {
          setStatus("Finding audio files");
        }

        if (latest.status === "completed" || latest.status === "failed" || latest.status === "cancelled") {
          break;
        }
      }

      if (latest.status === "failed") {
        setStatus(latest.error ?? "Scan failed");
        return;
      }
      if (latest.status === "cancelled") {
        setStatus("Scan cancelled");
        return;
      }

      const result = {
        folder_path: latest.folder_path,
        folder_paths: latest.folder_paths?.length ? latest.folder_paths : targetPaths,
        scanned_files: latest.total_files,
        inserted: latest.inserted,
        updated: latest.updated,
        removed: latest.removed,
        skipped: latest.skipped,
        errors: latest.errors,
      };
      setScanResult(result);
      const nextFolders = savePaths;
      setLibraryFolders(nextFolders);
      setFolderPath(nextFolders[0] ?? "");
      setStatus(
        `Scan complete: ${result.inserted} inserted, ${result.updated} updated, ${result.removed} removed, ${result.skipped} skipped`,
      );
      await refreshTracks();
      await loadAlbums();
      await loadArtists();
      await loadPlaylists();
      await loadLibraryStats();
      await loadInbox();
      await loadClapCoverage();
      await loadSettings();
      try {
        applyFolderWatchStatus(
          await startFolderWatch(result.folder_paths[0] ?? result.folder_path, folderWatchStatus?.interval_seconds ?? 45, 300, desktopSnapshot),
          false,
        );
        await FolderWatchStart([result.folder_paths[0] ?? result.folder_path], 1200);
      } catch {
        await loadFolderWatchStatus();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scan failed");
    } finally {
      activeScanJobIdRef.current = null;
      scanCancelRequestedRef.current = false;
      scanStuckRef.current = false;
      setScanStuck(false);
      setIsScanning(false);
    }
  }

  async function handleCancelScan() {
    scanCancelRequestedRef.current = true;
    scanStuckRef.current = false;
    setScanStuck(false);
    setScanStuckMessage(null);
    const jobId = activeScanJobIdRef.current;
    if (!jobId) {
      setIsScanning(false);
      setStatus("Scan cancelled");
      return;
    }
    try {
      setStatus("Cancelling library scan");
      setScanProgress(await cancelScanLibrary(jobId));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not cancel scan");
    }
  }

  async function handleRetryScan() {
    const request = lastScanRequestRef.current;
    if (!request) {
      setStatus("No scan request to retry");
      return;
    }
    await handleCancelScan();
    window.setTimeout(() => {
      void handleScan(request.paths, request.options);
    }, 800);
  }

  async function handleRemoveLibrarySource(path: string) {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      return;
    }
    const confirmed = window.confirm(
      `Remove this source from FLAC Cafe?\n\n${trimmedPath}\n\nTracks under this folder will be removed from the library database. Audio files on disk will not be deleted.`,
    );
    if (!confirmed) {
      return;
    }

    setStatus("Removing source from library");
    try {
      let response: LibrarySourceRemoveResponse;
      try {
        response = await desktopRemoveLibrarySource(trimmedPath);
      } catch (error) {
        response = await removeLibrarySource(trimmedPath);
      }
      const removedKeys = new Set([sourceFolderKey(trimmedPath), sourceFolderKey(response.path)]);
      const savedKeys = new Set(response.library_paths.map(sourceFolderKey));
      const unsavedLocalFolders = libraryFolders.filter((item) => {
        const key = sourceFolderKey(item);
        return !removedKeys.has(key) && !savedKeys.has(key);
      });
      const nextFolders = uniqueFolderPaths([...response.library_paths, ...unsavedLocalFolders]);
      setLibraryFolders(nextFolders);
      setFolderPath((current) => (removedKeys.has(sourceFolderKey(current)) ? nextFolders[0] ?? "" : current));
      setSettings((current) =>
        current
          ? {
              ...current,
              library_path: nextFolders[0] ?? null,
              library_paths: nextFolders,
            }
          : current,
      );
      setScanResult(null);
      setScanProgress(null);
      await Promise.all([
        refreshTracks(),
        loadAlbums(),
        loadArtists(),
        loadPlaylists(),
        loadLibraryStats(),
        loadInbox(),
        loadClapCoverage(),
        loadFolderWatchStatus(),
      ]);
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove source");
    }
  }

  async function handleStartFolderWatch(intervalSeconds: number) {
    const targetPath = uniqueFolderPaths([...libraryFolders, folderPath])[0] || settings?.library_path || "";
    if (!targetPath) {
      setStatus("Choose a music folder before starting folder watch");
      return;
    }
    try {
      const desktopSnapshot = await buildDesktopScanSnapshot([targetPath], "Checking watched folder");
      const response = await startFolderWatch(targetPath, intervalSeconds, 300, desktopSnapshot);
      applyFolderWatchStatus(response, false);
      try {
        await FolderWatchStart([targetPath], 1200);
      } catch {
        // Python polling still covers folder watch when the desktop event watcher is unavailable.
      }
      setStatus("Folder watch is running. Pending changes will wait for your review.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start folder watch");
    }
  }

  async function handleStopFolderWatch() {
    try {
      const response = await stopFolderWatch();
      applyFolderWatchStatus(response, false);
      try {
        await FolderWatchStop();
      } catch {
        // Ignore desktop watcher cleanup failures; Python watch state is already stopped.
      }
      setStatus("Folder watch stopped");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not stop folder watch");
    }
  }

  async function handleRefreshFolderWatch() {
    try {
      const targetPath = uniqueFolderPaths([...libraryFolders, folderPath])[0] || settings?.library_path || null;
      const desktopSnapshot = targetPath ? await buildDesktopScanSnapshot([targetPath], "Checking watched folder") : null;
      const response = await refreshFolderWatch(targetPath, 300, desktopSnapshot);
      applyFolderWatchStatus(response, false);
      setStatus(
        response.pending_count
          ? `Found ${response.pending_count.toLocaleString()} pending library change${response.pending_count === 1 ? "" : "s"}`
          : "No pending library changes",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not check watched folder");
    }
  }

  function scheduleFolderWatchRefresh(eventCount: number, error?: string | null) {
    if (FolderWatchRefreshTimerRef.current !== null) {
      window.clearTimeout(FolderWatchRefreshTimerRef.current);
    }
    void FolderWatchMarkEvent(eventCount, error).catch(() => {
      // Best-effort diagnostics only.
    });
    FolderWatchRefreshTimerRef.current = window.setTimeout(() => {
      FolderWatchRefreshTimerRef.current = null;
      const targetPath = folderWatchStatus?.folder_path || uniqueFolderPaths([...libraryFolders, folderPath])[0] || settings?.library_path || null;
      if (!targetPath) {
        return;
      }
      void (async () => {
        try {
          const desktopSnapshot = await buildDesktopScanSnapshot([targetPath], "Updating watched folder changes");
          applyFolderWatchStatus(await refreshFolderWatch(targetPath, 300, desktopSnapshot), true);
        } catch {
          // The normal polling watcher will try again; don't interrupt playback/UI with a background failure.
        }
      })();
    }, 900);
  }

  async function applyFolderWatchResponse(response: FolderWatchApplyResponse) {
    applyFolderWatchStatus(response.status, false);
    await Promise.all([
      refreshTracks(),
      loadAlbums(),
      loadArtists(),
      loadPlaylists(),
      loadLibraryStats(),
      loadInbox(),
      loadClapCoverage(),
    ]);
    const pieces = [
      response.inserted ? `${response.inserted.toLocaleString()} added` : "",
      response.updated ? `${response.updated.toLocaleString()} updated` : "",
      response.moved ? `${response.moved.toLocaleString()} moved` : "",
      response.removed ? `${response.removed.toLocaleString()} removed` : "",
    ].filter(Boolean);
    const summary = pieces.length ? pieces.join(", ") : "No changes applied";
    const suffix = response.errors.length ? ` (${response.errors.length.toLocaleString()} error${response.errors.length === 1 ? "" : "s"})` : "";
    setStatus(`Folder watch applied: ${summary}${suffix}`);
  }

  async function handleApplyFolderWatch(changeIds: string[], applyAll = false) {
    const pendingCount = folderWatchStatus?.pending_count ?? 0;
    if (!applyAll && changeIds.length === 0) {
      setStatus("Select at least one pending change to apply");
      return;
    }
    if (pendingCount > 0 && !window.confirm("Apply the selected folder changes to the library database? Removed files will leave the library, but FLAC Cafe will not delete audio files.")) {
      return;
    }
    try {
      await applyFolderWatchResponse(await applyFolderWatchChanges(changeIds, applyAll));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not apply folder watch changes");
    }
  }

  async function handleAcknowledgeFolderWatchNotifications(notificationIds: string[], allNotifications = false) {
    try {
      applyFolderWatchStatus(await acknowledgeFolderWatchNotifications(notificationIds, allNotifications), false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not dismiss folder watch notification");
    }
  }

  async function handleBrowseFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select music folders",
      });

      const selectedPaths = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
      if (selectedPaths.length > 0) {
        const next = uniqueFolderPaths([...libraryFolders, ...selectedPaths]);
        setLibraryFolders(next);
        setFolderPath(next[0] ?? "");
        setStatus(`Selected ${selectedPaths.length.toLocaleString()} folder${selectedPaths.length === 1 ? "" : "s"}`);
      } else {
        setStatus("Folder selection canceled");
      }
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a folder path here in browser mode.");
    }
  }

  async function handleBrowseAudioConversionTarget(): Promise<string | null> {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select conversion target folder",
      });
      if (typeof selected === "string") {
        setStatus(`Selected conversion target: ${selected}`);
        return selected;
      }
      setStatus("Conversion target selection canceled");
      return null;
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a conversion target folder in browser mode.");
      return null;
    }
  }

  async function handleBrowseCdRipTarget(): Promise<string | null> {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select CD rip output folder",
      });
      if (typeof selected === "string") {
        setStatus(`Selected CD rip output folder: ${selected}`);
        return selected;
      }
      setStatus("CD rip output folder selection canceled");
      return null;
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a CD rip output folder in browser mode.");
      return null;
    }
  }

  async function handleChooseMusicFolderAndScan() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select music folder",
      });

      if (typeof selected !== "string") {
        setStatus("Folder selection canceled");
        return;
      }

      setFolderPath(selected);
      setLibraryFolders(uniqueFolderPaths([selected]));
      await handleScan(selected);
    } catch {
      setStatus("Browse is available in the Tauri desktop app. Paste a folder path in Settings in browser mode.");
    }
  }

  async function handleUseSuggestedFolder(path: string) {
    setFolderPath(path);
    setLibraryFolders(uniqueFolderPaths([path]));
    await handleScan(path);
  }


  return {
    folderPath,
    setFolderPath,
    libraryFolders,
    setLibraryFolders,
    scanResult,
    setScanResult,
    scanProgress,
    setScanProgress,
    scanStuck,
    scanStuckMessage,
    isScanning,
    setIsScanning,
    folderWatchStatus,
    setFolderWatchStatus,
    validateMusicFoldersWithDesktop,
    buildDesktopScanSnapshot,
    applyFolderWatchStatus,
    loadFolderWatchStatus,
    handleScan,
    handleCancelScan,
    handleRetryScan,
    handleRemoveLibrarySource,
    handleStartFolderWatch,
    handleStopFolderWatch,
    handleRefreshFolderWatch,
    scheduleFolderWatchRefresh,
    applyFolderWatchResponse,
    handleApplyFolderWatch,
    handleAcknowledgeFolderWatchNotifications,
    handleBrowseFolder,
    handleBrowseAudioConversionTarget,
    handleBrowseCdRipTarget,
    handleChooseMusicFolderAndScan,
    handleUseSuggestedFolder,
  };
}
