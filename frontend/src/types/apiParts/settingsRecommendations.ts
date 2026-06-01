import type { QueueTrack } from "./core";

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  kind: string;
  description: string | null;
  author: string | null;
  homepage: string | null;
  entry: string | null;
  entry_path: string | null;
  directory: string;
  manifest_path: string;
  capabilities: string[];
  permissions: string[];
  enabled: boolean;
  valid: boolean;
  errors: string[];
}

export interface ExtensionListResponse {
  user_extensions_dir: string;
  search_directories: string[];
  manifest_names: string[];
  extensions: ExtensionManifest[];
}

export type LibraryStatsImportSource = "musicbee" | "itunes" | "windows_media_player";

export interface LibraryStatsImportRequest {
  source: LibraryStatsImportSource;
  import_path: string;
  apply?: boolean;
  missing_only?: boolean;
  limit?: number;
}

export interface LibraryStatsImportPreview {
  row_number: number;
  source: LibraryStatsImportSource;
  path: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  track_id: number | null;
  matched_by: string | null;
  imported_rating: number | null;
  imported_play_count: number | null;
  imported_last_played_at: string | null;
  current_rating: number | null;
  current_play_count: number | null;
  current_last_played_at: string | null;
  changed_fields: string[];
  error: string | null;
}

export interface LibraryStatsImportResponse {
  source: LibraryStatsImportSource;
  import_path: string;
  total_rows: number;
  matched: number;
  changed: number;
  applied: number;
  errors: number;
  previews: LibraryStatsImportPreview[];
}

export interface ClapStatusResponse {
  installed: boolean;
  dependencies: Record<string, boolean>;
  dependency_errors?: Record<string, string>;
  model_id: string;
  cache_dir: string;
  max_duration_seconds?: number;
  samples_per_track: number;
  max_samples_per_track?: number;
  sample_window_seconds?: number;
  batch_size?: number;
  max_batch_size?: number;
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
  samples_per_track?: number | null;
  batch_size?: number | null;
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
  log: string[];
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
  library_paths: string[];
  database_path: string;
  suggested_music_path?: string | null;
  write_ratings_to_files: boolean;
  auto_write_fetched_lyrics_sidecars: boolean;
  cd_auto_lookup_metadata: boolean;
  acoustid_api_key_configured: boolean;
  lastfm_api_credentials_configured: boolean;
  lastfm_api_credentials_source?: string | null;
  extra: Record<string, unknown>;
}

export interface SettingsUpdateRequest {
  write_ratings_to_files?: boolean;
  auto_write_fetched_lyrics_sidecars?: boolean;
  cd_auto_lookup_metadata?: boolean;
  acoustid_api_key?: string | null;
  clear_acoustid_api_key?: boolean;
  lastfm_api_key?: string | null;
  lastfm_api_secret?: string | null;
  clear_lastfm_api_credentials?: boolean;
}

export interface LibrarySourceRemoveResponse {
  path: string;
  library_paths: string[];
  removed_tracks: number;
  removed_metadata_cache: number;
  removed_artwork_cache: number;
  message: string;
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

export interface TracksDeleteResponse {
  removed_track_ids: number[];
  removed_count: number;
  deleted_files: number;
  missing_track_ids: number[];
  errors: string[];
}

export interface TrackMetadataSyncResponse {
  synced_track_ids: number[];
  synced_count: number;
  missing_track_ids: number[];
  errors: string[];
}

export interface TrackFileMetadataWriteRequest {
  track_ids?: number[] | null;
  include_metadata?: boolean;
  include_rating?: boolean;
  apply?: boolean;
  limit?: number;
}

export interface TrackFileMetadataWritePreview {
  track_id: number;
  path: string;
  title: string | null;
  artist: string | null;
  changed_fields: string[];
  database: Record<string, unknown>;
  file: Record<string, unknown>;
  applied: boolean;
  error: string | null;
}

export interface TrackFileMetadataWriteResponse {
  total: number;
  changed: number;
  applied: number;
  missing_track_ids: number[];
  errors: string[];
  previews: TrackFileMetadataWritePreview[];
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
  target_unrated_percent?: number | null;
  target_exploration_percent?: number | null;
  max_repeat_artist_percent?: number | null;
  minimum_rating?: number | null;
  recently_played_cooldown_days: number;
  seed_track_id?: number | null;
  mood_seeds?: string[];
  mood_seed_weight?: number;
  mood_avoid_seeds?: string[];
  mood_avoid_weight?: number;
  similarity_weight?: number;
  rating_weight?: number;
  recency_weight?: number;
  skip_weight?: number;
  exploration_weight?: number;
  play_history_weight?: number;
  feedback_weight?: number;
  audio_similarity_weight?: number;
  mood_similarity_weight?: number;
  artist_similarity_weight?: number;
  album_similarity_weight?: number;
  genre_similarity_weight?: number;
  year_similarity_weight?: number;
  rating_similarity_weight?: number;
  seed?: number | null;
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

export interface RecommendationProfileComparisonExportResponse {
  export_path: string;
  profile_count: number;
}

export interface RecommendationProfileComparisonImportResponse {
  report_path: string;
  generated_at: string | null;
  seed: number | null;
  seed_track_id: number | null;
  comparisons: RecommendationProfileComparison[];
}

export interface RecommendationAbQueue {
  label: "A" | "B";
  settings: AutoDjSettings;
  drift: RecommendationDrift;
  tracks: QueueTrack[];
}

export interface RecommendationAbTestResponse {
  test_id: string;
  generated_at: string;
  queues: RecommendationAbQueue[];
}

export interface RecommendationAbChoiceResponse {
  status: string;
  chosen_label: "A" | "B";
  inserted_feedback: number;
}

export interface ExportResponse {
  playlist_path: string;
  track_count: number;
}

export interface BackupResponse {
  backup_path: string;
}

export interface LocalDataResetResponse {
  reset: boolean;
  backup_path: string | null;
  database_path: string;
  removed_paths: string[];
  message: string;
}
