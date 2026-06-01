import type { Track } from "./core";

export interface desktopScanFile {
  path: string;
  modified_ms: number | null;
  size_bytes: number | null;
}

export interface desktopScanSnapshot {
  folders: string[];
  total_files: number;
  total_bytes: number;
  elapsed_ms: number;
  files: desktopScanFile[];
  errors: string[];
}

export interface AudioAnalysisCoverage {
  total_tracks: number;
  analyzed_tracks: number;
  unanalyzed_tracks: number;
  failed_tracks: number;
  coverage_percent: number;
  provider: string;
}

export interface ClapLabelStat {
  label: string;
  count: number;
  average_confidence: number;
  max_confidence: number;
}

export interface ClapLibraryStats {
  total_tracks: number;
  analyzed_tracks: number;
  failed_tracks: number;
  average_genre_confidence: number | null;
  average_mood_confidence: number | null;
  top_genres: ClapLabelStat[];
  top_moods: ClapLabelStat[];
}

export interface LyricsResponse {
  track_id: number;
  lyrics: string | null;
  source: string | null;
  is_synced: boolean;
  sidecar_path?: string | null;
}

export interface LyricsLookupRequest {
  track_id?: number | null;
  title: string;
  artist?: string | null;
  album?: string | null;
  album_artist?: string | null;
  duration_seconds?: number | null;
  path?: string | null;
}

export interface LyricsUpdateRequest {
  lyrics: string | null;
  is_synced?: boolean;
  target?: "database" | "file";
  source?: string | null;
}

export type BulkLyricsSaveLocation = "database" | "sidecar";

export interface BulkLyricsStartResponse {
  job_id: string;
  status: string;
  include_online: boolean;
  only_missing: boolean;
  save_location: BulkLyricsSaveLocation;
}

export interface BulkLyricsProgress {
  job_id: string;
  status: "pending" | "scanning" | "cancelling" | "cancelled" | "completed" | "failed";
  total_tracks: number;
  processed_tracks: number;
  already_cached: number;
  embedded_found: number;
  online_found: number;
  missing: number;
  failed: number;
  errors: string[];
  current_track_id: number | null;
  current_title: string | null;
  started_at: string;
  finished_at: string | null;
  elapsed_seconds: number;
  eta_seconds: number | null;
  percent: number;
  error: string | null;
  include_online: boolean;
  only_missing: boolean;
  save_location: BulkLyricsSaveLocation;
}

export interface ArtistInfoResponse {
  artist_name: string;
  query: string;
  summary: string | null;
  image_url: string | null;
  page_url: string | null;
  source: string | null;
  found: boolean;
  confidence?: number;
  from_cache: boolean;
  stale?: boolean;
  updated_at: string | null;
  error: string | null;
  local_tracks?: Track[];
  related_artists?: ArtistInfoResponse[];
}

export interface ScanResult {
  folder_path: string;
  folder_paths: string[];
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
  folder_paths: string[];
  status: string;
}

export interface ScanProgress {
  job_id: string;
  folder_path: string;
  folder_paths: string[];
  status: "pending" | "counting" | "scanning" | "cleaning" | "cancelling" | "cancelled" | "completed" | "failed";
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

export interface AudioConversionInstallRequest {
  source_url?: string | null;
}

export interface AudioConversionInstallStartResponse {
  job_id: string;
  status: string;
}

export interface AudioConversionInstallProgress {
  job_id: string;
  status: string;
  message: string;
  current_step: number;
  total_steps: number;
  bytes_downloaded: number;
  total_bytes: number | null;
  download_url: string | null;
  tool_directory: string;
  log: string[];
  started_at: string | null;
  finished_at: string | null;
  elapsed_seconds: number;
  percent: number;
  error: string | null;
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
  limit?: number | null;
}

export interface AudioConversionChange {
  track_id: number;
  title: string | null;
  artist: string | null;
  source_path: string;
  target_path: string;
  source_size_bytes: number | null;
  estimated_output_size_bytes: number | null;
  estimated_size_change_bytes: number | null;
  estimated_size_ratio: number | null;
  estimate_note: string | null;
  changed: boolean;
  collision: boolean;
  error: string | null;
}

export interface AudioConversionPreviewResponse {
  target_folder: string;
  total: number;
  changed_count: number;
  collisions: number;
  source_size_bytes: number | null;
  estimated_output_size_bytes: number | null;
  estimated_size_change_bytes: number | null;
  estimated_size_ratio: number | null;
  estimated_tracks: number;
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

export interface CdRipTrackMetadata {
  track_number: number;
  disc_number?: number | null;
  title?: string | null;
  artist?: string | null;
  duration_seconds?: number | null;
  source_label?: string | null;
}

export interface CdRipDrive {
  id: string;
  path: string | null;
  label: string;
  volume_name: string | null;
  media_loaded: boolean;
  track_count: number | null;
  tracks: CdRipTrackMetadata[];
}

export interface CdRipToolStatus {
  name: string;
  purpose: string;
  available: boolean;
  path: string | null;
  version: string | null;
  checked_paths: string[];
}

export interface CdRipSetupResponse {
  available: boolean;
  tool_directory: string;
  drives: CdRipDrive[];
  tools: CdRipToolStatus[];
  ffmpeg_available: boolean;
  ffmpeg_path: string | null;
  secure_ripping_available: boolean;
  cd_text_available: boolean;
  accuraterip_available: boolean;
  active_rip_drive_ids: string[];
  message: string;
  warnings: string[];
}

export interface CdRipMetadataRequest {
  drive_id?: string | null;
  album_title?: string | null;
  album_artist?: string | null;
  release_id?: string | null;
  limit?: number;
}

export interface CdRipReleaseCandidate {
  release_id: string;
  title: string | null;
  artist: string | null;
  date: string | null;
  year: number | null;
  country: string | null;
  track_count: number;
  confidence: number;
  artwork_thumbnail_url: string | null;
  tracks: CdRipTrackMetadata[];
}

export interface CdRipMetadataResponse {
  drive_id: string | null;
  source: string;
  query: Record<string, string | null>;
  candidates: CdRipReleaseCandidate[];
  cd_text_available: boolean;
  disc_id: string | null;
  message: string;
  warnings: string[];
}

export type CdRipOutputFormat = "flac" | "mp3" | "wav";

export interface CdRipStartRequest {
  drive_id: string;
  output_folder: string;
  output_format?: CdRipOutputFormat;
  track_numbers?: number[] | null;
  tracks?: CdRipTrackMetadata[];
  album_title?: string | null;
  album_artist?: string | null;
  year?: number | null;
  genre?: string | null;
  secure_mode?: boolean;
  verify?: boolean;
  overwrite?: boolean;
  bitrate_kbps?: number | null;
}

export interface CdRipStartResponse {
  job_id: string;
  status: string;
}

export interface CdRipVerificationEntry {
  track_number: number;
  path: string;
  sha256: string;
  bytes: number;
  accuraterip_checked: boolean;
  accuraterip_match: boolean | null;
  message: string;
}

export interface CdRipProgress {
  job_id: string;
  drive_id: string;
  output_folder: string;
  output_format: CdRipOutputFormat | string;
  status: "pending" | "running" | "canceling" | "canceled" | "completed" | "failed" | string;
  phase: string | null;
  message: string | null;
  total_tracks: number;
  processed_tracks: number;
  ripped_tracks: number;
  skipped_tracks: number;
  current_track: string | null;
  errors: string[];
  log: string[];
  verification: CdRipVerificationEntry[];
  started_at: string;
  finished_at: string | null;
  elapsed_seconds: number;
  eta_seconds: number | null;
  percent: number;
  error: string | null;
}

export interface CdPlaybackResponse {
  status: string;
  track_number: number | null;
  message: string;
  track: Track | null;
}

export interface AudiobookTrack {
  id: number;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  track_number: number | null;
  disc_number: number | null;
  genre: string | null;
  year: number | null;
  duration_seconds: number | null;
  rating: number | null;
  play_count: number;
  last_played_at: string | null;
  date_added: string;
  position_seconds: number;
  progress_percent: number;
  bookmark_count: number;
  chapter_count: number;
  progress_updated_at: string | null;
}

export interface AudiobookListResponse {
  total: number;
  tracks: AudiobookTrack[];
}

export interface AudiobookProgressRequest {
  position_seconds: number;
  duration_seconds?: number | null;
}

export interface AudiobookProgressResponse {
  track_id: number;
  position_seconds: number;
  duration_seconds: number | null;
  updated_at: string;
}

export interface AudiobookBookmarkRequest {
  position_seconds: number;
  label?: string;
  note?: string | null;
}

export interface AudiobookBookmark {
  id: number;
  track_id: number;
  position_seconds: number;
  label: string;
  note: string | null;
  created_at: string;
}

export interface AudiobookChapter {
  id?: number | null;
  track_id?: number | null;
  chapter_index: number;
  title: string;
  start_seconds: number;
  end_seconds?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AudiobookSyncExportResponse {
  export_path: string;
  track_count: number;
  generated_at: string;
}

export interface PodcastSubscriptionPayload {
  title?: string | null;
  feed_url: string;
  site_url?: string | null;
  description?: string | null;
  auto_download?: boolean;
  download_folder?: string | null;
}

export interface PodcastSubscription {
  id: number;
  title: string;
  feed_url: string;
  site_url: string | null;
  description: string | null;
  auto_download: boolean;
  download_folder: string | null;
  effective_download_folder: string | null;
  last_checked_at: string | null;
  episode_count: number;
  downloaded_count: number;
  created_at: string;
  updated_at: string;
}

export interface PodcastSubscriptionDeleteResponse {
  deleted: boolean;
  deleted_files: number;
  missing_files: number;
  removed_tracks: number;
}

export interface PodcastFolderResponse {
  path: string;
  created: boolean;
}

export interface PodcastEpisode {
  id: number;
  subscription_id: number;
  subscription_title: string | null;
  track_id?: number | null;
  guid: string;
  title: string;
  description: string | null;
  audio_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  local_path: string | null;
  download_status: string;
  downloaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PodcastRefreshResponse {
  subscription: PodcastSubscription;
  inserted: number;
  updated: number;
  total: number;
}

export interface PodcastDeleteDownloadResponse {
  episode: PodcastEpisode;
  deleted_file: boolean;
  missing_file: boolean;
  removed_track: boolean;
}

export interface RadioStationPayload {
  name: string;
  stream_url: string;
  homepage_url?: string | null;
  genre?: string | null;
  notes?: string | null;
}

export interface RadioStation extends RadioStationPayload {
  id: number;
  last_played_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ScrobbleService = "listenbrainz" | "lastfm";

export interface ScrobbleAccountRequest {
  enabled?: boolean;
  username?: string | null;
  token?: string | null;
  api_key?: string | null;
  api_secret?: string | null;
  session_key?: string | null;
}

export interface ScrobbleAccount extends ScrobbleAccountRequest {
  service: ScrobbleService;
  enabled: boolean;
  updated_at: string | null;
}

export interface LastFmLoginStartResponse {
  token: string;
  auth_url: string;
}

export interface LastFmLoginCompleteResponse {
  account: ScrobbleAccount;
}

export interface ScrobbleOutboxEntry {
  id: number;
  service: ScrobbleService;
  track_id: number | null;
  event_type: "played" | "loved";
  artist: string;
  title: string;
  album: string | null;
  album_artist: string | null;
  listened_at: number | null;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  submitted_at: string | null;
}

export interface ScrobbleQueueHistoryResponse {
  queued: number;
  considered: number;
}

export interface ScrobbleSubmitResponse {
  submitted: number;
  failed: number;
  errors: string[];
}

export interface TrackLoveResponse {
  track_id: number;
  loved: boolean;
  source: string;
  updated_at: string;
}

export interface LovedTrack {
  track_id: number;
  loved: boolean;
  source: string;
  updated_at: string;
  title: string | null;
  artist: string | null;
  album: string | null;
}

export interface ScrobbleHistoryImportResponse {
  total: number;
  updated: number;
  previews: Array<{
    row: number;
    matched: boolean;
    track_id: number | null;
    artist?: string | null;
    title?: string | null;
    changes: Record<string, unknown>;
    error?: string | null;
  }>;
}

