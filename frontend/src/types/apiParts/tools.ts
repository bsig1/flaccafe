import type { DuplicateGroup,Track } from "./core";

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
  music_subfolder?: string;
  playlist_subfolder?: string;
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

export interface DeviceSyncProfilePayload {
  name: string;
  target_folder?: string;
  device_kind?: "folder" | "usb" | "android_folder" | "android_mtp";
  music_subfolder?: string;
  playlist_subfolder?: string;
  playlist_ids?: number[];
  playlist_rules?: Record<string, unknown>;
  copy_files?: boolean;
  export_playlists?: boolean;
  preserve_structure?: boolean;
}

export interface DeviceSyncProfile extends Required<Omit<DeviceSyncProfilePayload, "target_folder" | "playlist_ids" | "playlist_rules">> {
  id: number;
  target_folder: string;
  playlist_ids: number[];
  playlist_rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DeviceSyncProfilesResponse {
  profiles: DeviceSyncProfile[];
  presets: DeviceSyncProfilePayload[];
}

export interface DeviceSyncDetectedDevice {
  id: string;
  label: string;
  root_path: string;
  device_kind: string;
  drive_type: number | null;
  size_bytes: number | null;
  free_bytes: number | null;
  writable: boolean;
  hint: string | null;
}

export interface DeviceSyncDevicesResponse {
  devices: DeviceSyncDetectedDevice[];
  mtp_supported: boolean;
  message: string;
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
  fingerprint_only?: boolean;
  write_to_file?: boolean | null;
  accepted_previews?: AutoTagPreview[] | null;
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

export interface ClapGenreTagRequest {
  track_ids?: number[] | null;
  missing_only?: boolean;
  min_confidence?: number;
  apply?: boolean;
  write_to_file?: boolean | null;
  limit?: number;
}

export interface ClapGenreTagPreview {
  track_id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  current_genre: string | null;
  proposed_genre: string | null;
  confidence: number | null;
  runner_up_genre: string | null;
  match_margin: number | null;
  copy_blocked_reason: string | null;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface ClapGenreTagResponse {
  total: number;
  matched: number;
  changed: number;
  blocked: number;
  applied: number;
  errors: string[];
  previews: ClapGenreTagPreview[];
}

export interface VolumeTagRequest {
  track_ids?: number[] | null;
  mode?: "analyze" | "manual";
  apply?: boolean;
  write_to_file?: boolean | null;
  limit?: number;
  manual_track_gain_db?: number | null;
  manual_track_peak?: number | null;
  manual_album_gain_db?: number | null;
  manual_album_peak?: number | null;
}

export interface VolumeTagPreview {
  track_id: number;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  current_track_gain_db: number | null;
  proposed_track_gain_db: number | null;
  current_track_peak: number | null;
  proposed_track_peak: number | null;
  current_album_gain_db: number | null;
  proposed_album_gain_db: number | null;
  current_album_peak: number | null;
  proposed_album_peak: number | null;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface VolumeTagResponse {
  total: number;
  changed: number;
  applied: number;
  errors: string[];
  previews: VolumeTagPreview[];
  ffmpeg_path: string | null;
  checked_paths: string[];
}

export interface DuplicateActionRequest {
  action: "keep_best" | "remove_selected" | "export_report" | "ignore" | "clear_ignored";
  track_ids?: number[];
  groups?: number[][];
  delete_files?: boolean;
  report_path?: string | null;
  ignore_key?: string | null;
  ignore_label?: string | null;
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
  skipped_reasons?: string[];
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


