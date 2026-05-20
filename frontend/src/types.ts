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
}

export interface TrackPage {
  tracks: Track[];
  total: number;
  limit: number;
  offset: number;
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
  write_ratings_to_files: boolean;
  extra: Record<string, unknown>;
}

export interface SettingsUpdateRequest {
  write_ratings_to_files?: boolean;
}

export interface TrackDeleteResponse {
  track_id: number;
  removed_from_library: boolean;
  deleted_file: boolean;
  file_missing: boolean;
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
  artist_similarity_weight?: number;
  album_similarity_weight?: number;
  genre_similarity_weight?: number;
  year_similarity_weight?: number;
  rating_similarity_weight?: number;
}

export interface AutoDjResponse {
  tracks: QueueTrack[];
  settings: AutoDjSettings;
}

export interface ExportResponse {
  playlist_path: string;
  track_count: number;
}

export interface BackupResponse {
  backup_path: string;
}
