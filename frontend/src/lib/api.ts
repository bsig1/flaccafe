import type {
  AlbumSummary,
  ArtistInfoResponse,
  AudioAnalysisCoverage,
  AudioAnalysisProgress,
  AudioAnalysisStartRequest,
  AudioAnalysisStartResponse,
  AutoDjAvoidRule,
  AutoDjResponse,
  AutoDjSettings,
  BackupResponse,
  CacheClearResponse,
  CacheClearTarget,
  ClapConfigRequest,
  ClapInstallProgress,
  ClapInstallRequest,
  ClapInstallStartResponse,
  ClapStatusResponse,
  ExportResponse,
  FileOrganizationRequest,
  FileOrganizationResponse,
  FilenameTagInferenceRequest,
  FilenameTagInferenceResponse,
  LibraryHealthResponse,
  LibraryStatsResponse,
  LogTailResponse,
  LyricsResponse,
  LyricsUpdateRequest,
  PlayEventEntry,
  PlaylistSummary,
  RecommendationProfile,
  RecommendationProfileComparison,
  RecommendationRun,
  ScanProgress,
  ScanResult,
  ScanStartResponse,
  SettingsResponse,
  SettingsUpdateRequest,
  SimilarTrack,
  SmartPlaylistRule,
  SmartPlaylistSummary,
  StartupDiagnosticsResponse,
  SupportBundleResponse,
  Track,
  TrackDeleteResponse,
  TrackMetadataUpdate,
  TrackPage,
  TrackRestoreRequest,
} from "../types/api";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8765";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      // Keep the HTTP status message when the backend does not return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function fetchSettings(): Promise<SettingsResponse> {
  return request<SettingsResponse>("/settings");
}

export function fetchBackendHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
}

export function fetchStartupDiagnostics(): Promise<StartupDiagnosticsResponse> {
  return request<StartupDiagnosticsResponse>("/diagnostics/startup");
}

export function fetchBackendLog(limit = 200): Promise<LogTailResponse> {
  return request<LogTailResponse>(`/diagnostics/logs/backend?limit=${limit}`);
}

export function createSupportBundle(): Promise<SupportBundleResponse> {
  return request<SupportBundleResponse>("/diagnostics/support-bundle", { method: "POST" });
}

export function backupDatabase(): Promise<BackupResponse> {
  return request<BackupResponse>("/settings/backup", { method: "POST" });
}

export function updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return request<SettingsResponse>("/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export function fetchHistory(limit = 200): Promise<PlayEventEntry[]> {
  return request<PlayEventEntry[]>(`/history?limit=${limit}`);
}

export function fetchLibraryStats(): Promise<LibraryStatsResponse> {
  return request<LibraryStatsResponse>("/library/stats");
}

export function fetchLibraryHealth(limit = 80): Promise<LibraryHealthResponse> {
  return request<LibraryHealthResponse>(`/library/health?limit=${limit}`);
}

export function clearLibraryCaches(targets: CacheClearTarget[]): Promise<CacheClearResponse> {
  return request<CacheClearResponse>("/library/maintenance/clear", {
    method: "POST",
    body: JSON.stringify({ targets }),
  });
}

export function inferFilenameTags(requestBody: FilenameTagInferenceRequest): Promise<FilenameTagInferenceResponse> {
  return request<FilenameTagInferenceResponse>("/library/tools/infer-tags", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function organizeFiles(requestBody: FileOrganizationRequest): Promise<FileOrganizationResponse> {
  return request<FileOrganizationResponse>("/library/tools/organize-files", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchClapStatus(): Promise<ClapStatusResponse> {
  return request<ClapStatusResponse>("/analysis/clap/status");
}

export function fetchClapCoverage(): Promise<AudioAnalysisCoverage> {
  return request<AudioAnalysisCoverage>("/analysis/clap/coverage");
}

export function startClapInstall(requestBody: ClapInstallRequest): Promise<ClapInstallStartResponse> {
  return request<ClapInstallStartResponse>("/analysis/clap/install", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchClapInstall(jobId: string): Promise<ClapInstallProgress> {
  return request<ClapInstallProgress>(`/analysis/clap/install/${jobId}`);
}

export function updateClapConfig(config: ClapConfigRequest): Promise<ClapStatusResponse> {
  return request<ClapStatusResponse>("/analysis/clap/config", {
    method: "PATCH",
    body: JSON.stringify(config),
  });
}

export function startClapAudioAnalysis(
  requestBody: AudioAnalysisStartRequest,
): Promise<AudioAnalysisStartResponse> {
  return request<AudioAnalysisStartResponse>("/analysis/clap/start", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchClapAudioAnalysis(jobId: string): Promise<AudioAnalysisProgress> {
  return request<AudioAnalysisProgress>(`/analysis/clap/jobs/${jobId}`);
}

export function pauseClapAudioAnalysis(jobId: string): Promise<AudioAnalysisProgress> {
  return request<AudioAnalysisProgress>(`/analysis/clap/jobs/${jobId}/pause`, { method: "POST" });
}

export function resumeClapAudioAnalysis(jobId: string): Promise<AudioAnalysisProgress> {
  return request<AudioAnalysisProgress>(`/analysis/clap/jobs/${jobId}/resume`, { method: "POST" });
}

export function cancelClapAudioAnalysis(jobId: string): Promise<AudioAnalysisProgress> {
  return request<AudioAnalysisProgress>(`/analysis/clap/jobs/${jobId}/cancel`, { method: "POST" });
}

export function fetchTracks(search = ""): Promise<Track[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  const query = params.toString();
  return request<Track[]>(query ? `/tracks?${query}` : "/tracks");
}

export function fetchTrack(trackId: number): Promise<Track> {
  return request<Track>(`/tracks/${trackId}`);
}

export function fetchSimilarTracks(trackId: number, limit = 12): Promise<SimilarTrack[]> {
  return request<SimilarTrack[]>(`/tracks/${trackId}/similar?limit=${limit}`);
}

export function deleteTrack(trackId: number, deleteFile = false): Promise<TrackDeleteResponse> {
  const params = new URLSearchParams({ delete_file: String(deleteFile) });
  return request<TrackDeleteResponse>(`/tracks/${trackId}?${params.toString()}`, { method: "DELETE" });
}

export function updateTrackMetadata(trackId: number, metadata: TrackMetadataUpdate): Promise<Track> {
  return request<Track>(`/tracks/${trackId}/metadata`, {
    method: "PATCH",
    body: JSON.stringify(metadata),
  });
}

export function restoreTrack(requestBody: TrackRestoreRequest): Promise<Track> {
  return request<Track>("/tracks/restore", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchTrackPage({
  search = "",
  limit = 150,
  offset = 0,
  sortBy = "artist",
  sortDirection = "asc",
}: {
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}): Promise<TrackPage> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("sort_by", sortBy);
  params.set("sort_direction", sortDirection);
  return request<TrackPage>(`/tracks/page?${params.toString()}`);
}

export function fetchAlbums(search = ""): Promise<AlbumSummary[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  params.set("limit", "20000");
  return request<AlbumSummary[]>(`/albums?${params.toString()}`);
}

export function fetchAlbumTracks(albumId: number): Promise<Track[]> {
  return request<Track[]>(`/albums/${albumId}/tracks`);
}

export function fetchSmartPlaylistPresets(): Promise<Record<string, SmartPlaylistRule>> {
  return request<Record<string, SmartPlaylistRule>>("/smart-playlists/presets");
}

export function fetchSmartPlaylists(): Promise<SmartPlaylistSummary[]> {
  return request<SmartPlaylistSummary[]>("/smart-playlists");
}

export function createSmartPlaylist(name: string, rule: SmartPlaylistRule): Promise<SmartPlaylistSummary> {
  return request<SmartPlaylistSummary>("/smart-playlists", {
    method: "POST",
    body: JSON.stringify({ name, rule }),
  });
}

export function deleteSmartPlaylist(smartPlaylistId: number): Promise<SmartPlaylistSummary[]> {
  return request<SmartPlaylistSummary[]>(`/smart-playlists/${smartPlaylistId}`, {
    method: "DELETE",
  });
}

export function previewSmartPlaylist(rule: SmartPlaylistRule): Promise<Track[]> {
  return request<Track[]>("/smart-playlists/preview", {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

export function fetchSmartPlaylistTracks(smartPlaylistId: number): Promise<Track[]> {
  return request<Track[]>(`/smart-playlists/${smartPlaylistId}/tracks`);
}

export function fetchPlaylists(): Promise<PlaylistSummary[]> {
  return request<PlaylistSummary[]>("/playlists");
}

export function createPlaylist(name: string): Promise<PlaylistSummary> {
  return request<PlaylistSummary>("/playlists", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deletePlaylist(playlistId: number): Promise<PlaylistSummary[]> {
  return request<PlaylistSummary[]>(`/playlists/${playlistId}`, {
    method: "DELETE",
  });
}

export function fetchPlaylistTracks(playlistId: number): Promise<Track[]> {
  return request<Track[]>(`/playlists/${playlistId}/tracks`);
}

export function addTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<Track[]> {
  return request<Track[]>(`/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  });
}

export function removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<Track[]> {
  return request<Track[]>(`/playlists/${playlistId}/tracks/${trackId}`, {
    method: "DELETE",
  });
}

export function moveTrackInPlaylist(
  playlistId: number,
  trackId: number,
  direction: "up" | "down",
): Promise<Track[]> {
  return request<Track[]>(`/playlists/${playlistId}/tracks/${trackId}/move`, {
    method: "PATCH",
    body: JSON.stringify({ direction }),
  });
}

export function exportPlaylist(playlistId: number): Promise<ExportResponse> {
  return request<ExportResponse>(`/playlists/${playlistId}/export`, {
    method: "POST",
    body: JSON.stringify({ track_ids: [] }),
  });
}

export function importPlaylist(playlistPath: string, name?: string): Promise<PlaylistSummary> {
  return request<PlaylistSummary>("/playlists/import", {
    method: "POST",
    body: JSON.stringify({ playlist_path: playlistPath, name: name || null }),
  });
}

export function scanLibrary(folderPath: string): Promise<ScanResult> {
  return request<ScanResult>("/scan", {
    method: "POST",
    body: JSON.stringify({ folder_path: folderPath }),
  });
}

export function startScanLibrary(folderPath: string): Promise<ScanStartResponse> {
  return request<ScanStartResponse>("/scan/start", {
    method: "POST",
    body: JSON.stringify({ folder_path: folderPath }),
  });
}

export function fetchScanProgress(jobId: string): Promise<ScanProgress> {
  return request<ScanProgress>(`/scan/jobs/${jobId}`);
}

export function updateTrackRating(trackId: number, rating: number | null): Promise<Track> {
  return request<Track>(`/tracks/${trackId}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export function audioUrl(trackId: number): string {
  return `${API_BASE}/tracks/${trackId}/audio`;
}

export function albumArtworkUrl(trackId: number): string {
  return `${API_BASE}/tracks/${trackId}/artwork`;
}

export function fetchLyrics(trackId: number): Promise<LyricsResponse> {
  return request<LyricsResponse>(`/tracks/${trackId}/lyrics`);
}

export function fetchLyricsOnline(trackId: number): Promise<LyricsResponse> {
  return request<LyricsResponse>(`/tracks/${trackId}/lyrics/fetch`, { method: "POST" });
}

export function updateLyrics(trackId: number, requestBody: LyricsUpdateRequest): Promise<LyricsResponse> {
  return request<LyricsResponse>(`/tracks/${trackId}/lyrics`, {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  });
}

export function fetchArtistInfo(artistName: string, refresh = false): Promise<ArtistInfoResponse> {
  const params = new URLSearchParams({ name: artistName });
  if (refresh) {
    params.set("refresh", "true");
  }
  return request<ArtistInfoResponse>(`/artists/info?${params.toString()}`);
}

export function markTrackPlayed(trackId: number): Promise<Track> {
  return request<Track>(`/tracks/${trackId}/played`, {
    method: "POST",
  });
}

export function markTrackSkipped(trackId: number): Promise<Track> {
  return request<Track>(`/tracks/${trackId}/skipped`, {
    method: "POST",
  });
}

export function fetchArtistLocalTracks(artistName: string): Promise<Track[]> {
  const params = new URLSearchParams({ name: artistName });
  return request<Track[]>(`/artists/local-tracks?${params.toString()}`);
}

export function clearArtistCache(): Promise<{ deleted: number }> {
  return request<{ deleted: number }>("/artists/cache", {
    method: "DELETE",
  });
}

export function fetchAutoDjAvoidRules(): Promise<AutoDjAvoidRule[]> {
  return request<AutoDjAvoidRule[]>("/autodj/avoid");
}

export function createAutoDjAvoidRule(requestBody: {
  scope: "track" | "artist" | "album" | "genre";
  track_id?: number | null;
  value?: string | null;
}): Promise<AutoDjAvoidRule> {
  return request<AutoDjAvoidRule>("/autodj/avoid", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function deleteAutoDjAvoidRule(ruleId: number): Promise<AutoDjAvoidRule[]> {
  return request<AutoDjAvoidRule[]>(`/autodj/avoid/${ruleId}`, { method: "DELETE" });
}

export function recordRecommendationFeedback(requestBody: {
  track_id: number;
  event_type: "play_next" | "add_to_queue" | "manual_play";
  weight?: number;
}): Promise<{ status: string }> {
  return request<{ status: string }>("/autodj/feedback", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function fetchRecommendationProfiles(): Promise<RecommendationProfile[]> {
  return request<RecommendationProfile[]>("/autodj/profiles");
}

export function fetchRecommendationHistory(limit = 30): Promise<RecommendationRun[]> {
  return request<RecommendationRun[]>(`/autodj/history?limit=${limit}`);
}

export function compareRecommendationProfiles(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparison[]> {
  return request<RecommendationProfileComparison[]>("/autodj/profiles/compare", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function saveRecommendationProfile(requestBody: {
  name: string;
  settings: AutoDjSettings;
  is_default?: boolean;
}): Promise<RecommendationProfile> {
  return request<RecommendationProfile>("/autodj/profiles", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export function updateRecommendationProfile(
  profileId: number,
  requestBody: {
    name: string;
    settings: AutoDjSettings;
    is_default?: boolean;
  },
): Promise<RecommendationProfile> {
  return request<RecommendationProfile>(`/autodj/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(requestBody),
  });
}

export function setDefaultRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return request<RecommendationProfile[]>(`/autodj/profiles/${profileId}/default`, { method: "POST" });
}

export function deleteRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return request<RecommendationProfile[]>(`/autodj/profiles/${profileId}`, { method: "DELETE" });
}

export function generateAutoDj(settings: AutoDjSettings): Promise<AutoDjResponse> {
  return request<AutoDjResponse>("/autodj/generate", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export function exportQueue(trackIds: number[]): Promise<ExportResponse> {
  return request<ExportResponse>("/autodj/export", {
    method: "POST",
    body: JSON.stringify({ track_ids: trackIds }),
  });
}
