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
  replaygain_track_gain_db?: number | null;
  replaygain_album_gain_db?: number | null;
  replaygain_track_peak?: number | null;
  replaygain_album_peak?: number | null;
  audio_fingerprint: string | null;
  acoustic_fingerprint?: string | null;
  acoustic_fingerprint_updated_at?: string | null;
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
  artwork_path?: string | null;
  track_count: number;
  duration_seconds: number | null;
  average_rating: number | null;
  artwork_track_id: number | null;
}

export interface AlbumArtworkCandidate {
  source: "selected" | "sidecar" | "embedded";
  label: string;
  path: string | null;
  track_id: number | null;
  media_type: string | null;
  size_bytes: number | null;
  modified_at: string | null;
  selected: boolean;
}

export interface AlbumArtworkCandidatesResponse {
  album_id: number;
  candidates: AlbumArtworkCandidate[];
}

export interface AlbumArtworkUpdateResponse {
  album_id: number;
  artwork_path: string | null;
  candidates: AlbumArtworkCandidate[];
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
  shared_acoustic_fingerprint?: boolean;
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

export interface InboxResponse {
  tracks: Track[];
  notes: InboxTrackNote[];
  auto_review_rules: InboxAutoReviewRule[];
  total_new: number;
  total_reviewed: number;
  limit: number;
  offset: number;
}

export interface InboxTrackNote {
  track_id: number;
  note: string;
  updated_at: string;
}

export interface InboxReviewResponse {
  updated: number;
  total_new: number;
  total_reviewed: number;
}

export type InboxAutoReviewField =
  | "title"
  | "artist"
  | "album"
  | "album_artist"
  | "genre"
  | "path"
  | "year"
  | "rating"
  | "duration_seconds";

export type InboxAutoReviewMatchType =
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "is_empty"
  | "is_not_empty";

export interface InboxAutoReviewRule {
  id: number;
  name: string;
  enabled: boolean;
  field: InboxAutoReviewField;
  match_type: InboxAutoReviewMatchType;
  value: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboxAutoReviewRuleRequest {
  name: string;
  enabled: boolean;
  field: InboxAutoReviewField;
  match_type: InboxAutoReviewMatchType;
  value: string;
  note?: string | null;
  apply_existing?: boolean;
}

export interface InboxAutoReviewRuleApplyResponse {
  rule: InboxAutoReviewRule;
  applied: number;
  total_new: number;
  total_reviewed: number;
}

export interface InboxAutoReviewRuleDeleteResponse {
  deleted: boolean;
  total_new: number;
  total_reviewed: number;
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
  accepted?: boolean;
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
  collision_strategy?: "skip" | "auto_rename";
  cleanup_empty_folders?: boolean;
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
  removed_empty_folders: number;
}

export interface FileOrganizationReportRequest extends FileOrganizationRequest {
  report_path?: string | null;
}

export interface FileOrganizationReportResponse {
  report_path: string;
  total: number;
  changed_count: number;
  collisions: number;
}

export interface DeviceSyncRequest {
  target_folder: string;
  playlist_ids?: number[];
  track_ids?: number[] | null;
  copy_files?: boolean;
  export_playlists?: boolean;
  preserve_structure?: boolean;
  apply?: boolean;
  limit?: number;
}

export interface DeviceSyncChange {
  track_id: number;
  title: string | null;
  artist: string | null;
  source_path: string;
  target_path: string;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface DeviceSyncPlaylistExport {
  playlist_id: number;
  name: string;
  playlist_path: string;
  track_count: number;
  applied: boolean;
  error: string | null;
}

export interface DeviceSyncResponse {
  target_folder: string;
  total_tracks: number;
  changed_files: number;
  copied_files: number;
  skipped_files: number;
  playlists_written: number;
  changes: DeviceSyncChange[];
  playlist_exports: DeviceSyncPlaylistExport[];
}

export interface CsvMetadataExportRequest {
  csv_path?: string | null;
  track_ids?: number[] | null;
  limit?: number;
}

export interface CsvMetadataExportResponse {
  csv_path: string;
  track_count: number;
  columns: string[];
}

export interface CsvMetadataImportRequest {
  csv_path: string;
  track_ids?: number[] | null;
  column_map?: Record<string, string>;
  missing_only?: boolean;
  clear_blank_fields?: boolean;
  apply?: boolean;
  limit?: number;
}

export interface CsvMetadataImportPreview {
  row_number: number;
  track_id: number | null;
  path: string | null;
  matched: boolean;
  current: Record<string, unknown>;
  imported: Record<string, unknown>;
  changed_fields: string[];
  conflict_fields: string[];
  applied: boolean;
  error: string | null;
}

export interface CsvMetadataImportResponse {
  csv_path: string;
  total: number;
  matched: number;
  changed: number;
  applied: number;
  errors: string[];
  previews: CsvMetadataImportPreview[];
}

export interface CsvMetadataImportReportRequest extends CsvMetadataImportRequest {
  report_path?: string | null;
}

export interface CsvMetadataImportReportResponse {
  report_path: string;
  csv_path: string;
  total: number;
  matched: number;
  changed: number;
  errors: number;
}

export interface TagRegexReplaceRequest {
  field: "title" | "artist" | "album" | "album_artist" | "genre";
  pattern: string;
  replacement: string;
  case_sensitive?: boolean;
  track_ids?: number[] | null;
  apply?: boolean;
  limit?: number;
}

export interface TagRegexReplacePreview {
  track_id: number;
  path: string;
  field: string;
  current: string | null;
  replacement: string | null;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface TagRegexReplaceResponse {
  total: number;
  changed: number;
  applied: number;
  previews: TagRegexReplacePreview[];
}

export interface RegexTagPreset {
  id: number;
  name: string;
  field: "title" | "artist" | "album" | "album_artist" | "genre" | string;
  pattern: string;
  replacement: string;
  case_sensitive: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegexTagPresetRequest {
  name: string;
  field: "title" | "artist" | "album" | "album_artist" | "genre";
  pattern: string;
  replacement: string;
  case_sensitive?: boolean;
}

export interface CustomTagBatchRequest {
  action?: "set" | "delete";
  tag_key: string;
  value?: string | null;
  track_ids?: number[] | null;
  apply?: boolean;
  limit?: number;
}

export interface CustomTagBatchPreview {
  track_id: number;
  path: string;
  tag_key: string;
  current: string | null;
  value: string | null;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface CustomTagBatchResponse {
  total: number;
  changed: number;
  applied: number;
  previews: CustomTagBatchPreview[];
}

export interface VirtualTagDefinition {
  id: number;
  name: string;
  expression: string;
  created_at: string;
  updated_at: string;
}

export interface VirtualTagDefinitionRequest {
  name: string;
  expression: string;
}

export interface VirtualTagPreviewRequest {
  expression: string;
  track_ids?: number[] | null;
  limit?: number;
}

export interface VirtualTagPreview {
  track_id: number;
  path: string;
  title: string | null;
  value: string | null;
  error: string | null;
}

export interface VirtualTagPreviewResponse {
  expression: string;
  total: number;
  previews: VirtualTagPreview[];
}

export interface TagFieldCopySwapRequest {
  action?: "copy" | "swap";
  source_field: string;
  target_field: string;
  track_ids?: number[] | null;
  missing_only?: boolean;
  apply?: boolean;
  limit?: number;
}

export interface TagFieldCopySwapPreview {
  track_id: number;
  path: string;
  source_field: string;
  target_field: string;
  current_source: unknown | null;
  current_target: unknown | null;
  new_source: unknown | null;
  new_target: unknown | null;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface TagFieldCopySwapResponse {
  total: number;
  changed: number;
  applied: number;
  previews: TagFieldCopySwapPreview[];
}

export interface TagBackupRequest {
  backup_path?: string | null;
  track_ids?: number[] | null;
  include_custom_tags?: boolean;
  limit?: number;
}

export interface TagBackupResponse {
  backup_path: string;
  track_count: number;
  custom_tag_count: number;
  created_at: string;
}

export interface TagBackupSummary {
  backup_path: string;
  file_name: string;
  track_count: number;
  created_at: string | null;
  size_bytes: number;
}

export interface TagBackupRestoreRequest {
  backup_path: string;
  track_ids?: number[] | null;
  missing_only?: boolean;
  restore_custom_tags?: boolean;
  apply?: boolean;
  limit?: number;
}

export interface TagBackupRestorePreview {
  track_id: number | null;
  path: string | null;
  matched: boolean;
  changed_fields: string[];
  current: Record<string, unknown>;
  restored: Record<string, unknown>;
  applied: boolean;
  error: string | null;
}

export interface TagBackupRestoreResponse {
  backup_path: string;
  total: number;
  matched: number;
  changed: number;
  applied: number;
  errors: string[];
  previews: TagBackupRestorePreview[];
}

export interface AutoTagRequest {
  mode?: "album" | "track";
  album_id?: number | null;
  track_ids?: number[] | null;
  missing_only?: boolean;
  include_artwork?: boolean;
  save_artwork?: boolean;
  apply?: boolean;
  limit?: number;
  candidate_limit?: number;
}

export interface AutoTagPreview {
  track_id: number;
  path: string;
  current: Record<string, unknown>;
  proposed: Record<string, unknown>;
  changed_fields: string[];
  confidence: number;
  match_type: "album" | "track";
  source: string;
  release_id: string | null;
  release_title: string | null;
  recording_id: string | null;
  artwork_url: string | null;
  artwork_thumbnail_url: string | null;
  applied: boolean;
  artwork_saved: boolean;
  error: string | null;
}

export interface AutoTagResponse {
  total: number;
  matched: number;
  changed: number;
  applied: number;
  artwork_matches: number;
  artwork_saved: number;
  errors: string[];
  previews: AutoTagPreview[];
}

export interface DuplicateActionRequest {
  action: "keep_best" | "remove_selected" | "export_report";
  track_ids?: number[];
  groups?: number[][];
  delete_files?: boolean;
  report_path?: string | null;
}

export interface DuplicateActionResponse {
  action: string;
  affected: number;
  removed_track_ids: number[];
  deleted_files: number;
  report_path: string | null;
  errors: string[];
}

export interface DuplicateReviewRequest {
  track_ids?: number[];
  groups?: number[][];
  limit?: number;
}

export interface DuplicateReviewResponse {
  tracks: Track[];
  groups: DuplicateGroup[];
  missing_track_ids: number[];
}

export interface ChromaprintConfigRequest {
  fpcalc_path?: string | null;
}

export interface ChromaprintStatusResponse {
  available: boolean;
  configured_path: string | null;
  resolved_path: string | null;
  version: string | null;
  tool_directory: string;
  checked_paths: string[];
  message: string;
  errors: string[];
}

export interface ChromaprintInstallRequest {
  source_url?: string | null;
}

export interface ChromaprintInstallResponse {
  installed: boolean;
  fpcalc_path: string | null;
  source_url: string;
  message: string;
  errors: string[];
}

export interface AcousticFingerprintRequest {
  track_ids?: number[] | null;
  overwrite?: boolean;
  limit?: number;
}

export interface AcousticFingerprintResponse {
  tool_available: boolean;
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface BulkUndoLogEntry {
  id: number;
  batch_id: string | null;
  action_type: string;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface BulkUndoBatchEntry {
  batch_id: string;
  action_type: string;
  entries: number;
  summary: string;
  first_created_at: string;
  last_created_at: string;
}

export interface BulkUndoRestoreResponse {
  entry_id: number;
  batch_id: string | null;
  action_type: string;
  restored: boolean;
  affected_track_ids: number[];
  errors: string[];
}

export interface ReportFileRequest {
  report_path: string;
  max_bytes?: number;
}

export interface ReportFileResponse {
  report_path: string;
  exists: boolean;
  size_bytes: number;
  modified_at: string | null;
  parsed_json: unknown | null;
  raw_text: string | null;
  truncated: boolean;
  error: string | null;
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

export type FolderWatchChangeType = "added" | "modified" | "removed" | "moved";

export interface FolderWatchChange {
  id: string;
  change_type: FolderWatchChangeType;
  track_id: number | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  old_path: string | null;
  new_path: string | null;
  previous_modified_at: string | null;
  file_modified_at: string | null;
  file_size: number | null;
  detected_at: string;
  summary: string;
}

export interface FolderWatchNotification {
  id: string;
  created_at: string;
  title: string;
  message: string;
  pending_count: number;
  counts: Record<FolderWatchChangeType, number>;
  acknowledged: boolean;
}

export interface FolderWatchStatus {
  enabled: boolean;
  folder_path: string | null;
  status: "stopped" | "idle" | "scanning" | "error";
  interval_seconds: number;
  last_checked_at: string | null;
  next_check_at: string | null;
  pending_count: number;
  counts: Record<FolderWatchChangeType, number>;
  changes: FolderWatchChange[];
  notifications: FolderWatchNotification[];
  error: string | null;
}

export interface FolderWatchApplyResponse {
  applied: number;
  inserted: number;
  updated: number;
  removed: number;
  moved: number;
  skipped: number;
  errors: string[];
  status: FolderWatchStatus;
}

export interface AudioConversionSetupResponse {
  available: boolean;
  configured_path: string | null;
  resolved_path: string | null;
  version: string | null;
  tool_directory: string;
  checked_paths: string[];
  message: string;
  errors: string[];
}

export interface AudioConversionSetupRequest {
  ffmpeg_path?: string | null;
}

export type AudioConversionFormat = "flac" | "mp3" | "m4a" | "opus" | "wav";

export interface AudioConversionRequest {
  target_folder: string;
  output_format?: AudioConversionFormat;
  track_ids?: number[] | null;
  preserve_structure?: boolean;
  copy_tags?: boolean;
  copy_artwork?: boolean;
  normalize_volume?: boolean;
  sample_rate_hz?: number | null;
  bitrate_kbps?: number | null;
  overwrite?: boolean;
  limit?: number;
}

export interface AudioConversionChange {
  track_id: number;
  title: string | null;
  artist: string | null;
  source_path: string;
  target_path: string;
  changed: boolean;
  collision: boolean;
  error: string | null;
}

export interface AudioConversionPreviewResponse {
  target_folder: string;
  total: number;
  changed_count: number;
  collisions: number;
  changes: AudioConversionChange[];
}

export interface AudioConversionStartResponse {
  job_id: string;
  status: string;
}

export interface AudioConversionProgress {
  job_id: string;
  target_folder: string;
  output_format: AudioConversionFormat | string;
  status: "pending" | "running" | "canceling" | "canceled" | "completed" | "failed" | string;
  phase: string | null;
  message: string | null;
  total_tracks: number;
  processed_tracks: number;
  converted: number;
  skipped: number;
  errors: string[];
  current_track: string | null;
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
  target_unrated_percent?: number | null;
  target_exploration_percent?: number | null;
  max_repeat_artist_percent?: number | null;
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
