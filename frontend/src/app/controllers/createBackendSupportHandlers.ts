// @ts-nocheck
import {
  backupDatabase,
  createSupportBundle,
  fetchBackendHealth,
  fetchBackendLog,
  fetchStartupDiagnostics,
  fetchTracksBatch,
  resetLocalData,
  updateSettings,
} from "../../lib/api";
import { openExternalUrl } from "../../lib/externalLinks";
import {
  BACKEND_STARTUP_GRACE_MS,
  BACKEND_STARTUP_POLL_MS,
} from "../appHelpers";
import {
  legacyStorageKeys,
  normalizePlaybackResumePosition,
  storageKeys,
} from "../shared";

export function createBackendSupportHandlers(model: any) {
  const {
    autoWriteFetchedLyricsSidecars,
    cdAutoLookupMetadata,
    lastSessionRestoreAttemptedRef,
    lastSessionRestoreFinishedRef,
    loadPriorityLibraryTracks,
    setActivePage,
    setAutoWriteFetchedLyricsSidecars,
    setBackendCheckedAt,
    setBackendLog,
    setBackendMessage,
    setBackendStatus,
    setCdAutoLookupMetadata,
    setCurrentTrack,
    setMetadataEditInitialField,
    setMetadataEditTrack,
    setPlaybackQueue,
    setRestoredPlaybackPosition,
    setSettings,
    setSettingsFocusSection,
    setStartupDiagnostics,
    setStatus,
    setSupportBundlePath,
    setUiPreferences,
    setWriteRatingsToFiles,
    supportBundlePath,
    writeRatingsToFiles,
  } = model;

  async function loadStartupDiagnostics(showToast = false) {
    try {
      const response = await fetchStartupDiagnostics();
      setStartupDiagnostics(response);
      if (showToast) {
        setStatus(response.ok ? "Startup self-check passed" : "Startup self-check complete; review notes");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not run startup self-check");
    }
  }

  async function handleOpenBackendLog() {
    try {
      const response = await fetchBackendLog();
      setBackendLog(response);
      if (!response.exists) {
        setStatus("Backend log has not been created yet");
        return;
      }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("reveal_in_file_explorer", { path: response.path });
      } catch {
        // Browser mode cannot reveal files; the Settings panel still shows the tail.
      }
      setStatus(`Backend log loaded from ${response.path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open backend log");
    }
  }

  async function checkBackendStatus(showToast = false) {
    try {
      const response = await fetchBackendHealth();
      setBackendStatus("ok");
      setBackendMessage(response.status === "ok" ? "Backend is responding normally." : `Backend responded: ${response.status}`);
      setBackendCheckedAt(new Date().toLocaleTimeString());
      if (showToast) {
        setStatus("Backend is responding");
      }
    } catch (error) {
      setBackendStatus("down");
      setBackendMessage(error instanceof Error ? error.message : "Backend is not reachable");
      setBackendCheckedAt(new Date().toLocaleTimeString());
      if (showToast) {
        setStatus("Backend is not reachable");
      }
    }
  }

  async function restoreLastPlaybackSession() {
    if (lastSessionRestoreAttemptedRef.current) {
      return;
    }
    lastSessionRestoreAttemptedRef.current = true;
    try {
      const raw = window.localStorage.getItem(storageKeys.lastSession) ?? window.localStorage.getItem(legacyStorageKeys.lastSession);
      if (raw) {
        const session = JSON.parse(raw) as StoredPlaybackSession;
        const ids = Array.from(new Set([...(session.queueIds ?? []), session.currentTrackId].filter(Boolean) as number[]));
        if (ids.length) {
          try {
            const restored = await fetchTracksBatch(ids.slice(0, 200));
            const byId = new Map(restored.tracks.map((track) => [track.id, track]));
            const queueItems = (session.queueIds ?? []).map((id) => byId.get(id)).filter((track): track is Track => Boolean(track));
            const restoredCurrent = session.currentTrackId ? byId.get(session.currentTrackId) ?? null : null;
            if (queueItems.length) {
              setPlaybackQueue(queueItems);
            }
            if (restoredCurrent) {
              setCurrentTrack(restoredCurrent);
              setRestoredPlaybackPosition(
                normalizePlaybackResumePosition(session.positionSeconds, restoredCurrent.duration_seconds),
              );
            }
            return;
          } catch {
            window.localStorage.removeItem(storageKeys.lastSession);
            window.localStorage.removeItem(legacyStorageKeys.lastSession);
          }
        }
      }
    } catch {
      // Last-session restore is best effort only.
    } finally {
      lastSessionRestoreFinishedRef.current = true;
    }
  }

  async function waitForBackendStartup() {
    const deadline = Date.now() + BACKEND_STARTUP_GRACE_MS;
    let lastErrorMessage = "Backend is not reachable";
    setBackendStatus("starting");
    setBackendMessage("Starting the local Python backend.");

    while (Date.now() < deadline) {
      try {
        const response = await fetchBackendHealth();
        setBackendMessage("Loading your library.");
        void restoreLastPlaybackSession();
        await loadPriorityLibraryTracks();
        setBackendStatus("ok");
        setBackendMessage(response.status === "ok" ? "Backend is responding normally." : `Backend responded: ${response.status}`);
        setBackendCheckedAt(new Date().toLocaleTimeString());
        return;
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : "Backend is not reachable";
        setBackendMessage("Starting the local Python backend.");
        await new Promise((resolve) => window.setTimeout(resolve, BACKEND_STARTUP_POLL_MS));
      }
    }

    setBackendStatus("down");
    setBackendMessage(lastErrorMessage);
    setBackendCheckedAt(new Date().toLocaleTimeString());
  }

  async function handleRestartBackend() {
    setBackendStatus("restarting");
    setBackendMessage("Restarting the bundled backend service.");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const message = await invoke<string>("backend_restart");
      setStatus(message);
      window.setTimeout(() => {
        void checkBackendStatus(false);
      }, 900);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Backend restart is only available in the packaged desktop app";
      setBackendStatus("down");
      setBackendMessage(message);
      setBackendCheckedAt(new Date().toLocaleTimeString());
      setStatus(message);
    }
  }

  async function handleOpenDetachedMiniPlayer() {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const { Window } = await import("@tauri-apps/api/window");
      const mainWindow = await Window.getByLabel("main");
      const existing = await WebviewWindow.getByLabel("mini-player");
      if (existing) {
        await mainWindow?.setSkipTaskbar(true);
        await mainWindow?.hide();
        await existing.setFocus();
        return;
      }
      const miniWindow = new WebviewWindow("mini-player", {
        title: "FLAC Cafe Mini Player",
        url: "/index.html?miniPlayer=1",
        width: 640,
        height: 138,
        minWidth: 420,
        minHeight: 118,
        resizable: true,
        decorations: true,
      });
      miniWindow.once("tauri://created", () => {
        void mainWindow?.setSkipTaskbar(true);
        void mainWindow?.hide();
      });
      miniWindow.once("tauri://destroyed", () => {
        void mainWindow?.setSkipTaskbar(false);
        void mainWindow?.show();
        void mainWindow?.setFocus();
      });
      miniWindow.once("tauri://error", (event) => {
        void mainWindow?.setSkipTaskbar(false);
        void mainWindow?.show();
        setStatus(`Could not open mini player: ${String(event.payload)}`);
      });
      setStatus("Mini player is now the active window");
    } catch {
      setStatus("Detached mini player is available in the Tauri desktop app.");
    }
  }

  function handleOpenLyricsViewFromPlayer() {
    setUiPreferences((current) => ({
      ...current,
      nowPlayingLayout: "lyrics",
      nowPlayingShowLyrics: true,
      nowPlayingShowQueue: false,
      nowPlayingAutoScrollLyrics: true,
    }));
    setActivePage("nowPlaying");
  }

  function handleOpenQueueViewFromPlayer() {
    setUiPreferences((current) => ({
      ...current,
      nowPlayingLayout: "queue",
      nowPlayingShowQueue: true,
      nowPlayingShowLyrics: true,
    }));
    setActivePage("nowPlaying");
  }

  function openMetadataEditor(track: Track, field: EditableMetadataKey | null = null) {
    setMetadataEditTrack(track);
    setMetadataEditInitialField(field);
  }

  async function handleWriteRatingsToFiles(value: boolean) {
    const previous = writeRatingsToFiles;
    setWriteRatingsToFiles(value);
    try {
      const response = await updateSettings({ write_ratings_to_files: value });
      setSettings(response);
      setWriteRatingsToFiles(response.write_ratings_to_files);
      setStatus(value ? "Ratings and metadata will be written to audio files" : "Ratings and metadata will stay in the database");
    } catch (error) {
      setWriteRatingsToFiles(previous);
      setStatus(error instanceof Error ? error.message : "Could not update file-write setting");
    }
  }

  async function handleAutoWriteFetchedLyricsSidecars(value: boolean) {
    const previous = autoWriteFetchedLyricsSidecars;
    setAutoWriteFetchedLyricsSidecars(value);
    try {
      const response = await updateSettings({ auto_write_fetched_lyrics_sidecars: value });
      setSettings(response);
      setAutoWriteFetchedLyricsSidecars(response.auto_write_fetched_lyrics_sidecars);
      setStatus(value ? "Fetched lyrics will be cached as app lyric sidecars" : "Fetched lyrics sidecar cache is off");
    } catch (error) {
      setAutoWriteFetchedLyricsSidecars(previous);
      setStatus(error instanceof Error ? error.message : "Could not update lyrics cache setting");
    }
  }

  async function handleCdAutoLookupMetadata(value: boolean) {
    const previous = cdAutoLookupMetadata;
    setCdAutoLookupMetadata(value);
    try {
      const response = await updateSettings({ cd_auto_lookup_metadata: value });
      setSettings(response);
      setCdAutoLookupMetadata(response.cd_auto_lookup_metadata);
      setStatus(value ? "CD metadata auto-lookup is on" : "CD metadata auto-lookup is off");
    } catch (error) {
      setCdAutoLookupMetadata(previous);
      setStatus(error instanceof Error ? error.message : "Could not update CD metadata lookup setting");
    }
  }

  async function handleAcoustIdApiKeyChange(apiKey: string | null) {
    try {
      const response = await updateSettings(
        apiKey === null
          ? { clear_acoustid_api_key: true }
          : { acoustid_api_key: apiKey },
      );
      setSettings(response);
      setStatus(response.acoustid_api_key_configured ? "AcoustID lookup is enabled for Auto-Tag" : "AcoustID lookup is disabled");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update AcoustID API key");
    }
  }

  async function handleLastFmApiCredentialsChange(apiKey: string | null, apiSecret: string | null) {
    try {
      const response = await updateSettings(
        apiKey === null && apiSecret === null
          ? { clear_lastfm_api_credentials: true }
          : { lastfm_api_key: apiKey, lastfm_api_secret: apiSecret },
      );
      setSettings(response);
      setStatus(response.lastfm_api_credentials_configured ? "Last.fm API credentials saved" : "Last.fm API credentials cleared");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update Last.fm API credentials");
    }
  }

  function openApiKeysSettings() {
    setSettingsFocusSection("apiKeys");
    setActivePage("settings");
    setStatus("API keys live in Settings now.");
  }

  async function handleBackupDatabase() {
    try {
      const response = await backupDatabase();
      setStatus(`Database backed up to ${response.backup_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Database backup failed");
    }
  }

  function clearFrontendLocalData() {
    try {
      const explicitKeys = new Set([
        ...Object.values(storageKeys),
        ...Object.values(legacyStorageKeys),
        "flac-cafe-sidebar-order",
        "flacCafeFilenameTagPresets",
        "flacCafeCsvImportProfiles",
      ]);
      for (const key of Object.keys(window.localStorage)) {
        if (
          explicitKeys.has(key) ||
          key.startsWith("flac-cafe-") ||
          key.startsWith("local-autodj-") ||
          key.startsWith("flacCafe")
        ) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // Resetting SQLite is the important part; browser storage can be unavailable.
    }
  }

  async function handleResetLocalData() {
    const first = window.confirm(
      "Reset FLAC Cafe local data?\n\nThis backs up and clears the SQLite library database, cached lyrics, and generated cache files. Music files, exports, tools, models, and logs are not deleted.",
    );
    if (!first) {
      return;
    }
    const confirmation = window.prompt("Type RESET to confirm local data reset.");
    if (confirmation !== "RESET") {
      setStatus("Local data reset canceled");
      return;
    }
    try {
      const response = await resetLocalData(confirmation);
      clearFrontendLocalData();
      setStatus(response.backup_path ? `Local data reset. Backup: ${response.backup_path}` : response.message);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not reset local data");
    }
  }

  async function handleCreateSupportBundle() {
    try {
      const response = await createSupportBundle();
      setSupportBundlePath(response.bundle_path);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("reveal_in_file_explorer", { path: response.bundle_path });
      } catch {
        // Browser mode cannot reveal files; the path in the toast is enough.
      }
      setStatus(`Support bundle ready: ${response.bundle_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create support bundle");
    }
  }

  async function handleCopySupportBundlePath() {
    if (!supportBundlePath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(supportBundlePath);
      setStatus("Support bundle path copied");
    } catch {
      setStatus(supportBundlePath);
    }
  }

  async function handleOpenSourceFolder(kind: "source" | "themes" = "source") {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_source_folder", { kind });
      setStatus(kind === "themes" ? "Opened themes folder" : "Opened source folder");
    } catch {
      setStatus(kind === "themes" ? "Themes live in frontend/src/config/themes" : "Source folder is the current project directory.");
    }
  }

  async function handleOpenExternalUrl(url: string) {
    await openExternalUrl(url, setStatus);
  }

  return {
    loadStartupDiagnostics,
    handleOpenBackendLog,
    checkBackendStatus,
    restoreLastPlaybackSession,
    waitForBackendStartup,
    handleRestartBackend,
    handleOpenDetachedMiniPlayer,
    handleOpenLyricsViewFromPlayer,
    handleOpenQueueViewFromPlayer,
    openMetadataEditor,
    handleWriteRatingsToFiles,
    handleAutoWriteFetchedLyricsSidecars,
    handleCdAutoLookupMetadata,
    handleAcoustIdApiKeyChange,
    handleLastFmApiCredentialsChange,
    openApiKeysSettings,
    handleBackupDatabase,
    clearFrontendLocalData,
    handleResetLocalData,
    handleCreateSupportBundle,
    handleCopySupportBundlePath,
    handleOpenSourceFolder,
    handleOpenExternalUrl,
  };
}
