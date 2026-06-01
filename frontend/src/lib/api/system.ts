import type {
BackupResponse,
HistoryStatsResponse,
InboxAutoReviewRuleApplyResponse,
InboxAutoReviewRuleDeleteResponse,
InboxAutoReviewRuleRequest,
InboxResponse,
InboxReviewResponse,
InboxTrackNote,
LibraryHealthResponse,
LibrarySourceRemoveResponse,
LibraryStatsResponse,
LocalDataResetResponse,
LogTailResponse,
PlayEventEntry,
SettingsResponse,
SettingsUpdateRequest,
StartupDiagnosticsResponse,
SupportBundleResponse
} from "../../types/api";
import {
desktopBackendJson,
desktopCreateInboxAutoReviewRule,
desktopDeleteInboxAutoReviewRule,
desktopFetchBackendHealth,
desktopFetchHistory,
desktopFetchHistoryStats,
desktopFetchLibraryHealth,
desktopFetchLibraryInbox,
desktopFetchLibraryStats,
desktopFetchSettings,
desktopRemoveLibrarySource,
desktopReviewInbox,
desktopUpdateInboxAutoReviewRule,
desktopUpdateInboxNote,
desktopUpdateSettings
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

export function fetchSettings(): Promise<SettingsResponse> {
  return desktopFetchSettings().catch(() => request<SettingsResponse>("/settings"));
}

export function fetchBackendHealth(): Promise<{ status: string }> {
  return desktopFetchBackendHealth().catch(() => request<{ status: string }>("/health"));
}

export function fetchStartupDiagnostics(): Promise<StartupDiagnosticsResponse> {
  return requestViaPythonWorker<StartupDiagnosticsResponse>("/diagnostics/startup").catch(() =>
    request<StartupDiagnosticsResponse>("/diagnostics/startup"),
  );
}

export function fetchBackendLog(limit = 200): Promise<LogTailResponse> {
  return requestViaPythonWorker<LogTailResponse>(`/diagnostics/logs/backend?limit=${limit}`).catch(() =>
    request<LogTailResponse>(`/diagnostics/logs/backend?limit=${limit}`),
  );
}

export function createSupportBundle(): Promise<SupportBundleResponse> {
  const init = { method: "POST" };
  return requestViaPythonWorker<SupportBundleResponse>("/diagnostics/support-bundle", init).catch(() =>
    request<SupportBundleResponse>("/diagnostics/support-bundle", init),
  );
}

export function backupDatabase(): Promise<BackupResponse> {
  const init = { method: "POST" };
  return requestViaPythonWorker<BackupResponse>("/settings/backup", init).catch(() =>
    request<BackupResponse>("/settings/backup", init),
  );
}

export function resetLocalData(confirmation: string): Promise<LocalDataResetResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  };
  return requestViaPythonWorker<LocalDataResetResponse>("/settings/reset-local-data", init).catch(() =>
    request<LocalDataResetResponse>("/settings/reset-local-data", init),
  );
}

export function updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return desktopUpdateSettings(settings).catch(() =>
    request<SettingsResponse>("/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),
  );
}

export function removeLibrarySource(path: string): Promise<LibrarySourceRemoveResponse> {
  return desktopRemoveLibrarySource(path).catch(() =>
    request<LibrarySourceRemoveResponse>("/settings/library-sources/remove", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  );
}

export function fetchHistory(limit = 200): Promise<PlayEventEntry[]> {
  return desktopFetchHistory(limit).catch(() => request<PlayEventEntry[]>(`/history?limit=${limit}`));
}

export function fetchHistoryStats(limit = 10): Promise<HistoryStatsResponse> {
  return desktopFetchHistoryStats(limit).catch(() => request<HistoryStatsResponse>(`/history/stats?limit=${limit}`));
}

export function fetchLibraryStats(): Promise<LibraryStatsResponse> {
  return desktopFetchLibraryStats().catch(() => request<LibraryStatsResponse>("/library/stats"));
}

export function fetchLibraryHealth(limit = 300): Promise<LibraryHealthResponse> {
  return desktopFetchLibraryHealth(limit).catch(() => request<LibraryHealthResponse>(`/library/health?limit=${limit}`));
}

export function fetchLibraryInbox(limit = 200, offset = 0): Promise<InboxResponse> {
  return desktopFetchLibraryInbox(limit, offset).catch(() =>
    request<InboxResponse>(`/library/inbox?limit=${limit}&offset=${offset}`),
  );
}

export function updateInboxNote(trackId: number, note: string | null): Promise<InboxTrackNote | null> {
  return desktopUpdateInboxNote(trackId, note).catch(() =>
    request<InboxTrackNote | null>(`/library/inbox/notes/${trackId}`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    }),
  );
}

export function reviewInboxTracks(trackIds: number[]): Promise<InboxReviewResponse> {
  return desktopReviewInbox(trackIds, false).catch(() =>
    request<InboxReviewResponse>("/library/inbox/review", {
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),
  );
}

export function reviewAllInboxTracks(): Promise<InboxReviewResponse> {
  return desktopReviewInbox(null, true).catch(() =>
    request<InboxReviewResponse>("/library/inbox/review", {
      method: "POST",
      body: JSON.stringify({ all_new: true }),
    }),
  );
}

export function createInboxAutoReviewRule(requestBody: InboxAutoReviewRuleRequest): Promise<InboxAutoReviewRuleApplyResponse> {
  return desktopCreateInboxAutoReviewRule(requestBody).catch(() =>
    request<InboxAutoReviewRuleApplyResponse>("/library/inbox/auto-review-rules", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function updateInboxAutoReviewRule(
  ruleId: number,
  requestBody: InboxAutoReviewRuleRequest,
): Promise<InboxAutoReviewRuleApplyResponse> {
  return desktopUpdateInboxAutoReviewRule(ruleId, requestBody).catch(() =>
    request<InboxAutoReviewRuleApplyResponse>(`/library/inbox/auto-review-rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteInboxAutoReviewRule(ruleId: number): Promise<InboxAutoReviewRuleDeleteResponse> {
  return desktopDeleteInboxAutoReviewRule(ruleId).catch(() =>
    request<InboxAutoReviewRuleDeleteResponse>(`/library/inbox/auto-review-rules/${ruleId}`, { method: "DELETE" }),
  );
}

