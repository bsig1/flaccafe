export interface Track {
  id: number;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  track_number: number | null;
  disc_number: number | null;
  genre: string | null;
  analysis_provider: string | null;
  analysis_model: string | null;
  analysis_genre: string | null;
  analysis_genre_confidence: number | null;
  analysis_genre_tags: string | null;
  analysis_embedding?: string | null;
  analysis_updated_at: string | null;
  year: number | null;
  duration_seconds: number | null;
  bitrate: number | null;
  audio_fingerprint: string | null;
  rating: number | null;
  play_count: number;
  skip_count: number;
  last_played_at: string | null;
  last_skipped_at: string | null;
  date_added: string;
  file_modified_at: string | null;
}

export interface QueueTrack extends Track {
  score: number;
  reason: string;
  score_breakdown: Record<string, number>;
}

export interface TrackPage {
  tracks: Track[];
  total: number;
  limit: number;
  offset: number;
}

export interface TrackMetadataUpdate {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  album_artist?: string | null;
  track_number?: number | null;
  disc_number?: number | null;
  genre?: string | null;
  year?: number | null;
}

export interface AlbumSummary {
  id: number;
  album: string | null;
  album_artist: string | null;
  year: number | null;
  track_count: number;
  duration_seconds: number | null;
  average_rating: number | null;
  artwork_track_id: number | null;
}

export interface PlaylistSummary {
  id: number;
  name: string;
  track_count: number;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface SmartPlaylistRule {
  preset?: string | null;
  search?: string | null;
  artist?: string | null;
  album?: string | null;
  genre?: string | null;
  min_rating?: number | null;
  max_rating?: number | null;
  unrated_only?: boolean;
  not_played_days?: number | null;
  recently_added_days?: number | null;
  max_play_count?: number | null;
  min_year?: number | null;
  max_year?: number | null;
  missing_metadata?: boolean;
  duplicate_only?: boolean;
  limit?: number;
}

export interface SmartPlaylistSummary {
  id: number;
  name: string;
  rule: SmartPlaylistRule;
  created_at: string;
  updated_at: string;
}

export interface PlayEventEntry {
  id: number;
  track_id: number;
  event_type: "played" | "skipped" | "rated";
  timestamp: string;
  metadata: Record<string, unknown>;
  track: Track | null;
}

export interface DuplicateGroup {
  key: string;
  tracks: Track[];
  match_reason: string;
  recommended_keep_id: number | null;
  recommendation_reason: string | null;
  duration_spread_seconds: number | null;
  bitrate_spread: number | null;
  shared_fingerprint: boolean;
  average_audio_similarity: number | null;
  path_roots: string[];
  analyzed_tracks: number;
}

export interface SimilarTrack extends Track {
  similarity_score: number;
  similarity_reason: string;
  audio_similarity: number | null;
}

export interface LibraryHealthResponse {
  missing_files: Track[];
  missing_metadata: Track[];
  duplicate_groups: DuplicateGroup[];
  unrated_tracks: Track[];
}

export interface LibraryStatsResponse {
  total_tracks: number;
  total_albums: number;
  total_artists: number;
  total_playlists: number;
  rated_tracks: number;
  unrated_tracks: number;
  total_duration_seconds: number | null;
  played_events: number;
  skipped_events: number;
}

export type CacheClearTarget = "artist" | "artwork" | "metadata" | "recommendation_history" | "scan_errors";

export interface CacheClearResponse {
  cleared: Partial<Record<CacheClearTarget, number>>;
}

export interface FilenameTagInferenceRequest {
  pattern: string;
  track_ids?: number[] | null;
  missing_only?: boolean;
  apply?: boolean;
  limit?: number;
}

export interface FilenameTagInferencePreview {
  track_id: number;
  path: string;
  matched: boolean;
  current: Record<string, unknown>;
  inferred: Record<string, unknown>;
  changed_fields: string[];
  applied: boolean;
  error: string | null;
}

export interface FilenameTagInferenceResponse {
  total: number;
  matches: number;
  applied: number;
  previews: FilenameTagInferencePreview[];
}

export interface FileOrganizationRequest {
  template: string;
  base_folder?: string | null;
  track_ids?: number[] | null;
  apply?: boolean;
  limit?: number;
}

export interface FileOrganizationChange {
  track_id: number;
  title: string | null;
  artist: string | null;
  current_path: string;
  target_path: string;
  changed: boolean;
  collision: boolean;
  applied: boolean;
  error: string | null;
}

export interface FileOrganizationResponse {
  template: string;
  base_folder: string;
  total: number;
  changes: FileOrganizationChange[];
  changed_count: number;
  applied: number;
}

export interface AudioAnalysisCoverage {
  total_tracks: number;
  analyzed_tracks: number;
  unanalyzed_tracks: number;
  failed_tracks: number;
  coverage_percent: number;
  provider: string;
}

export interface LyricsResponse {
  track_id: number;
  lyrics: string | null;
  source: string | null;
  is_synced: boolean;
}

export interface LyricsUpdateRequest {
  lyrics: string | null;
  is_synced?: boolean;
  target?: "database" | "file";
  source?: string | null;
}

export interface ArtistInfoResponse {
  artist_name: string;
  query: string;
  summary: string | null;
  image_url: string | null;
  page_url: string | null;
  source: string | null;
  found: boolean;
  from_cache: boolean;
  updated_at: string | null;
  error: string | null;
}

export interface ScanResult {
  folder_path: string;
  scanned_files: number;
  inserted: number;
  updated: number;
  removed: number;
  skipped: number;
  errors: string[];
}

export interface ScanStartResponse {
  job_id: string;
  folder_path: string;
  status: string;
}

export interface ScanProgress {
  job_id: string;
  folder_path: string;
  status: "pending" | "counting" | "scanning" | "cleaning" | "completed" | "failed";
  total_files: number;
  processed_files: number;
  inserted: number;
  updated: number;
  removed: number;
  skipped: number;
  errors: string[];
  current_path: string | null;
  started_at: string;
  finished_at: string | null;
  elapsed_seconds: number;
  eta_seconds: number | null;
  percent: number;
  error: string | null;
}

export interface ClapStatusResponse {
  installed: boolean;
  dependencies: Record<string, boolean>;
  dependency_errors?: Record<string, string>;
  model_id: string;
  cache_dir: string;
  max_duration_seconds: number;
  model_cached: boolean;
  torch_version?: string | null;
  torch_device?: string | null;
  cuda_available?: boolean;
  cuda_device_name?: string | null;
  runtime_managed?: boolean;
  runtime_exists?: boolean;
  runtime_dir?: string | null;
  runtime_python?: string | null;
  runtime_python_version?: string | null;
  runtime_device?: string | null;
  install_supported?: boolean;
  bootstrap_python?: string | null;
  required_python?: string | null;
  message: string | null;
}

export type ClapInstallDevice = "cpu" | "cuda";

export interface ClapInstallRequest {
  device: ClapInstallDevice;
  force?: boolean;
}

export interface ClapInstallStartResponse {
  job_id: string;
  status: string;
}

export interface ClapInstallProgress {
  job_id: string;
  device: ClapInstallDevice;
  force: boolean;
  status: "pending" | "running" | "completed" | "failed";
  message: string | null;
  current_step: number;
  total_steps: number;
  current_command: string | null;
  log: string[];
  started_at: string;
  finished_at: string | null;
  elapsed_seconds: number;
  percent: number;
  error: string | null;
}

export interface ClapConfigRequest {
  model_id?: string | null;
  cache_dir?: string | null;
  max_duration_seconds?: number | null;
}

export interface AudioAnalysisStartRequest {
  limit?: number | null;
  overwrite: boolean;
  only_missing: boolean;
  track_ids?: number[] | null;
}

export interface AudioAnalysisStartResponse {
  job_id: string;
  status: string;
}

export interface AudioAnalysisProgress {
  job_id: string;
  status: "pending" | "loading_model" | "running" | "paused" | "canceling" | "canceled" | "completed" | "failed";
  phase: string | null;
  message: string | null;
  total_tracks: number;
  processed_tracks: number;
  analyzed: number;
  skipped: number;
  errors: string[];
  failed_tracks: Array<{
    track_id: number | null;
    path: string | null;
    title: string | null;
    message: string;
  }>;
  current_track: string | null;
  model_cached_at_start: boolean | null;
  started_at: string;
  finished_at: string | null;
  elapsed_seconds: number;
  eta_seconds: number | null;
  percent: number;
  error: string | null;
}

export interface SettingsResponse {
  library_path: string | null;
  database_path: string;
  suggested_music_path?: string | null;
  write_ratings_to_files: boolean;
  extra: Record<string, unknown>;
}

export interface SettingsUpdateRequest {
  write_ratings_to_files?: boolean;
}

export interface DiagnosticItem {
  key: string;
  label: string;
  ok: boolean;
  message: string;
  path: string | null;
}

export interface StartupDiagnosticsResponse {
  ok: boolean;
  generated_at: string;
  items: DiagnosticItem[];
  log_path: string;
  app_data_path: string;
}

export interface LogTailResponse {
  path: string;
  exists: boolean;
  lines: string[];
}

export interface SupportBundleResponse {
  bundle_path: string;
  file_count: number;
}

export interface TrackDeleteResponse {
  track_id: number;
  removed_from_library: boolean;
  deleted_file: boolean;
  file_missing: boolean;
}

export interface TrackRestoreRequest {
  path: string;
  rating?: number | null;
}

export interface AutoDjSettings {
  queue_length: number;
  temperature: number;
  artist_cooldown: number;
  album_cooldown: number;
  unrated_exploration_percent: number;
  recently_played_cooldown_days: number;
  seed_track_id?: number | null;
  similarity_weight?: number;
  rating_weight?: number;
  recency_weight?: number;
  skip_weight?: number;
  exploration_weight?: number;
  play_history_weight?: number;
  feedback_weight?: number;
  audio_similarity_weight?: number;
  artist_similarity_weight?: number;
  album_similarity_weight?: number;
  genre_similarity_weight?: number;
  year_similarity_weight?: number;
  rating_similarity_weight?: number;
}

export interface AutoDjAvoidRule {
  id: number;
  scope: "track" | "artist" | "album" | "genre";
  target_key: string;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface AutoDjResponse {
  tracks: QueueTrack[];
  settings: AutoDjSettings;
  drift: RecommendationDrift;
}

export interface RecommendationDrift {
  total_tracks: number;
  familiar_percent: number;
  exploration_percent: number;
  repeat_artist_percent: number;
  unrated_percent: number;
  clap_percent: number;
  average_rating: number | null;
  unique_artists: number;
  unique_albums: number;
  warnings: string[];
}

export interface RecommendationProfile {
  id: number;
  name: string;
  settings: AutoDjSettings;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecommendationRun {
  id: number;
  settings: AutoDjSettings;
  drift: RecommendationDrift;
  track_ids: number[];
  created_at: string;
}

export interface RecommendationProfileComparison {
  profile: RecommendationProfile;
  drift: RecommendationDrift;
  top_tracks: QueueTrack[];
}

export interface ExportResponse {
  playlist_path: string;
  track_count: number;
}

export interface BackupResponse {
  backup_path: string;
}
