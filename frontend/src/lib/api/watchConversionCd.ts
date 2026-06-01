import type {
AudioConversionInstallProgress,
AudioConversionInstallRequest,
AudioConversionInstallStartResponse,
AudioConversionPreviewResponse,
AudioConversionProgress,
AudioConversionRequest,
AudioConversionSetupRequest,
AudioConversionSetupResponse,
AudioConversionStartResponse,
CdPlaybackResponse,
CdRipMetadataRequest,
CdRipMetadataResponse,
CdRipProgress,
CdRipSetupResponse,
CdRipStartRequest,
CdRipStartResponse,
CdRipTrackMetadata,
FolderWatchApplyResponse,
FolderWatchStatus,
desktopScanSnapshot
} from "../../types/api";
import {
desktopBackendJson,
desktopFetchAudioConversionSetup,
desktopSaveAudioConversionSetup
} from "../desktopLibrary";


function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestViaPythonWorker<T>(path, init);
}

function requestBodyJson(init?: RequestInit): unknown {
  if (!init?.body) {
    return null;
  }
  if (typeof init.body === "string") {
    return init.body.trim() ? JSON.parse(init.body) : null;
  }
  return null;
}

function requestViaPythonWorker<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isTauriDesktop()) {
    return Promise.reject(new Error("FLAC Cafe desktop APIs require the Tauri shell."));
  }
  return desktopBackendJson<T>(init?.method ?? "GET", path, requestBodyJson(init));
}

export function fetchFolderWatchStatus(limit = 300): Promise<FolderWatchStatus> {
  return requestViaPythonWorker<FolderWatchStatus>(`/library/watch?limit=${limit}`).catch(() =>
    request<FolderWatchStatus>(`/library/watch?limit=${limit}`),
  );
}

export function startFolderWatch(folderPath?: string | null, intervalSeconds = 45, limit = 300, desktopSnapshot?: desktopScanSnapshot | null): Promise<FolderWatchStatus> {
  const init = {
    method: "POST",
    body: JSON.stringify({
      folder_path: folderPath || null,
      interval_seconds: intervalSeconds,
      limit,
      snapshot: desktopSnapshot ?? null,
    }),
  };
  return requestViaPythonWorker<FolderWatchStatus>("/library/watch/start", init).catch(() =>
    request<FolderWatchStatus>("/library/watch/start", init),
  );
}

export function stopFolderWatch(limit = 300): Promise<FolderWatchStatus> {
  const init = { method: "POST" };
  return requestViaPythonWorker<FolderWatchStatus>(`/library/watch/stop?limit=${limit}`, init).catch(() =>
    request<FolderWatchStatus>(`/library/watch/stop?limit=${limit}`, init),
  );
}

export function refreshFolderWatch(folderPath?: string | null, limit = 300, desktopSnapshot?: desktopScanSnapshot | null): Promise<FolderWatchStatus> {
  const init = {
    method: "POST",
    body: JSON.stringify({
      folder_path: folderPath || null,
      limit,
      snapshot: desktopSnapshot ?? null,
    }),
  };
  return requestViaPythonWorker<FolderWatchStatus>("/library/watch/refresh", init).catch(() =>
    request<FolderWatchStatus>("/library/watch/refresh", init),
  );
}

export function applyFolderWatchChanges(changeIds: string[], applyAll = false, limit = 300): Promise<FolderWatchApplyResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify({
      change_ids: changeIds,
      apply_all: applyAll,
      limit,
    }),
  };
  return requestViaPythonWorker<FolderWatchApplyResponse>("/library/watch/apply", init).catch(() =>
    request<FolderWatchApplyResponse>("/library/watch/apply", init),
  );
}

export function acknowledgeFolderWatchNotifications(notificationIds: string[] = [], allNotifications = false): Promise<FolderWatchStatus> {
  const init = {
    method: "POST",
    body: JSON.stringify({
      notification_ids: notificationIds,
      all_notifications: allNotifications,
    }),
  };
  return requestViaPythonWorker<FolderWatchStatus>("/library/watch/notifications/ack", init).catch(() =>
    request<FolderWatchStatus>("/library/watch/notifications/ack", init),
  );
}

export function fetchAudioConversionSetup(): Promise<AudioConversionSetupResponse> {
  return desktopFetchAudioConversionSetup().catch(() =>
    request<AudioConversionSetupResponse>("/library/tools/audio-conversion/setup"),
  );
}

export function saveAudioConversionSetup(requestBody: AudioConversionSetupRequest): Promise<AudioConversionSetupResponse> {
  return desktopSaveAudioConversionSetup(requestBody).catch(() =>
    request<AudioConversionSetupResponse>("/library/tools/audio-conversion/setup", {
      method: "PATCH",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function startAudioConversionFfmpegInstall(
  requestBody: AudioConversionInstallRequest = {},
): Promise<AudioConversionInstallStartResponse> {
  return request<AudioConversionInstallStartResponse>("/library/tools/audio-conversion/install/jobs", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchAudioConversionFfmpegInstall(jobId: string): Promise<AudioConversionInstallProgress> {
  return request<AudioConversionInstallProgress>(`/library/tools/audio-conversion/install/jobs/${jobId}`);
}

export function previewAudioConversion(requestBody: AudioConversionRequest): Promise<AudioConversionPreviewResponse> {
  return request<AudioConversionPreviewResponse>("/library/tools/audio-conversion/preview", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function startAudioConversion(requestBody: AudioConversionRequest): Promise<AudioConversionStartResponse> {
  return request<AudioConversionStartResponse>("/library/tools/audio-conversion/jobs", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchAudioConversionProgress(jobId: string): Promise<AudioConversionProgress> {
  return request<AudioConversionProgress>(`/library/tools/audio-conversion/jobs/${jobId}`);
}

export function cancelAudioConversion(jobId: string): Promise<AudioConversionProgress> {
  return request<AudioConversionProgress>(`/library/tools/audio-conversion/jobs/${jobId}/cancel`, { method: "POST" });
}

export function fetchCdRipSetup(): Promise<CdRipSetupResponse> {
  return request<CdRipSetupResponse>("/library/tools/cd-rip/setup");
}

export function lookupCdRipMetadata(requestBody: CdRipMetadataRequest): Promise<CdRipMetadataResponse> {
  return request<CdRipMetadataResponse>("/library/tools/cd-rip/metadata", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function startCdRip(requestBody: CdRipStartRequest): Promise<CdRipStartResponse> {
  return request<CdRipStartResponse>("/library/tools/cd-rip/jobs", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchCdRipProgress(jobId: string): Promise<CdRipProgress> {
  return request<CdRipProgress>(`/library/tools/cd-rip/jobs/${jobId}`);
}

export function cancelCdRip(jobId: string): Promise<CdRipProgress> {
  return request<CdRipProgress>(`/library/tools/cd-rip/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function playCdTrack(
  trackNumber: number,
  driveId?: string | null,
  context?: {
    albumTitle?: string | null;
    albumArtist?: string | null;
    year?: number | null;
    genre?: string | null;
    tracks?: CdRipTrackMetadata[];
  },
): Promise<CdPlaybackResponse> {
  return request<CdPlaybackResponse>("/library/tools/cd-rip/playback/play", {
    method: "POST",
    body: JSON.stringify({
      drive_id: driveId ?? null,
      track_number: trackNumber,
      album_title: context?.albumTitle ?? null,
      album_artist: context?.albumArtist ?? null,
      year: context?.year ?? null,
      genre: context?.genre ?? null,
      tracks: context?.tracks ?? [],
    }),
  });
}
