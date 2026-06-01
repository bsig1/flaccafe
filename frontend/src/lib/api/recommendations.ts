import type {
AutoDjAvoidRule,
AutoDjResponse,
AutoDjSettings,
ExportResponse,
RecommendationAbChoiceResponse,
RecommendationAbTestResponse,
RecommendationProfile,
RecommendationProfileComparison,
RecommendationProfileComparisonExportResponse,
RecommendationProfileComparisonImportResponse,
RecommendationRun
} from "../../types/api";
import {
desktopBackendJson,
desktopChooseRecommendationAbTest,
desktopCompareRecommendationProfiles,
desktopCreateAutoDjAvoidRule,
desktopCreateRecommendationAbTest,
desktopDeleteAutoDjAvoidRule,
desktopDeleteRecommendationProfile,
desktopExportRecommendationProfileComparison,
desktopFetchAutoDjAvoidRules,
desktopFetchRecommendationHistory,
desktopFetchRecommendationProfiles,
desktopGenerateAutoDj,
desktopImportRecommendationProfileComparison,
desktopRecordRecommendationFeedback,
desktopSaveRecommendationProfile,
desktopSetDefaultRecommendationProfile
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

export function fetchAutoDjAvoidRules(): Promise<AutoDjAvoidRule[]> {
  return desktopFetchAutoDjAvoidRules().catch(() => request<AutoDjAvoidRule[]>("/autodj/avoid"));
}

export function createAutoDjAvoidRule(requestBody: {
  scope: "track" | "artist" | "album" | "genre";
  track_id?: number | null;
  value?: string | null;
}): Promise<AutoDjAvoidRule> {
  return desktopCreateAutoDjAvoidRule(requestBody).catch(() =>
    request<AutoDjAvoidRule>("/autodj/avoid", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function deleteAutoDjAvoidRule(ruleId: number): Promise<AutoDjAvoidRule[]> {
  return desktopDeleteAutoDjAvoidRule(ruleId).catch(() =>
    request<AutoDjAvoidRule[]>(`/autodj/avoid/${ruleId}`, { method: "DELETE" }),
  );
}

export function recordRecommendationFeedback(requestBody: {
  track_id: number;
  event_type: "play_next" | "add_to_queue" | "manual_play";
  weight?: number;
}): Promise<{ status: string }> {
  return desktopRecordRecommendationFeedback(requestBody).catch(() =>
    request<{ status: string }>("/autodj/feedback", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function fetchRecommendationProfiles(): Promise<RecommendationProfile[]> {
  return desktopFetchRecommendationProfiles().catch(() =>
    request<RecommendationProfile[]>("/autodj/profiles"),
  );
}

export function fetchRecommendationHistory(limit = 30): Promise<RecommendationRun[]> {
  return desktopFetchRecommendationHistory(limit).catch(() =>
    request<RecommendationRun[]>(`/autodj/history?limit=${limit}`),
  );
}

export function compareRecommendationProfiles(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparison[]> {
  return desktopCompareRecommendationProfiles(requestBody).catch(() =>
    request<RecommendationProfileComparison[]>("/autodj/profiles/compare", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function exportRecommendationProfileComparison(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparisonExportResponse> {
  return desktopExportRecommendationProfileComparison(requestBody).catch(() =>
    request<RecommendationProfileComparisonExportResponse>("/autodj/profiles/compare/export", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function importRecommendationProfileComparison(reportPath: string): Promise<RecommendationProfileComparisonImportResponse> {
  return desktopImportRecommendationProfileComparison(reportPath).catch(() =>
    request<RecommendationProfileComparisonImportResponse>("/autodj/profiles/compare/import", {
      method: "POST",
      body: JSON.stringify({ report_path: reportPath }),
    }),
  );
}

export function createRecommendationAbTest(requestBody: {
  base_settings: AutoDjSettings;
  challenger_settings?: AutoDjSettings | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationAbTestResponse> {
  return desktopCreateRecommendationAbTest(requestBody).catch(() =>
    request<RecommendationAbTestResponse>("/autodj/ab-test", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function chooseRecommendationAbTest(requestBody: {
  test_id?: string | null;
  chosen_label: "A" | "B";
  chosen_track_ids: number[];
  rejected_track_ids?: number[];
  feedback_weight?: number;
}): Promise<RecommendationAbChoiceResponse> {
  return desktopChooseRecommendationAbTest(requestBody).catch(() =>
    request<RecommendationAbChoiceResponse>("/autodj/ab-test/choose", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function saveRecommendationProfile(requestBody: {
  name: string;
  settings: AutoDjSettings;
  is_default?: boolean;
}): Promise<RecommendationProfile> {
  return desktopSaveRecommendationProfile(requestBody).catch(() =>
    request<RecommendationProfile>("/autodj/profiles", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),
  );
}

export function setDefaultRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return desktopSetDefaultRecommendationProfile(profileId).catch(() =>
    request<RecommendationProfile[]>(`/autodj/profiles/${profileId}/default`, { method: "POST" }),
  );
}

export function deleteRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return desktopDeleteRecommendationProfile(profileId).catch(() =>
    request<RecommendationProfile[]>(`/autodj/profiles/${profileId}`, { method: "DELETE" }),
  );
}

export function generateAutoDj(settings: AutoDjSettings): Promise<AutoDjResponse> {
  return desktopGenerateAutoDj(settings).catch(() =>
    request<AutoDjResponse>("/autodj/generate", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  );
}

export function exportQueue(trackIds: number[]): Promise<ExportResponse> {
  const init = {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  };
  return requestViaPythonWorker<ExportResponse>("/autodj/export", init).catch(() =>
    request<ExportResponse>("/autodj/export", init),
  );
}
