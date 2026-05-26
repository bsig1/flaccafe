use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Default)]
pub struct NativeLibraryState;

#[derive(Clone, Serialize, Deserialize)]
pub struct NativeTrack {
    pub(crate) id: i64,
    pub(crate) path: String,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) album_artist: Option<String>,
    pub(crate) track_number: Option<i64>,
    pub(crate) disc_number: Option<i64>,
    pub(crate) genre: Option<String>,
    pub(crate) analysis_provider: Option<String>,
    pub(crate) analysis_model: Option<String>,
    pub(crate) analysis_genre: Option<String>,
    pub(crate) analysis_genre_confidence: Option<f64>,
    pub(crate) analysis_genre_tags: Option<String>,
    pub(crate) analysis_embedding: Option<String>,
    pub(crate) analysis_updated_at: Option<String>,
    pub(crate) year: Option<i64>,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) bitrate: Option<i64>,
    pub(crate) replaygain_track_gain_db: Option<f64>,
    pub(crate) replaygain_album_gain_db: Option<f64>,
    pub(crate) replaygain_track_peak: Option<f64>,
    pub(crate) replaygain_album_peak: Option<f64>,
    pub(crate) audio_fingerprint: Option<String>,
    pub(crate) acoustic_fingerprint: Option<String>,
    pub(crate) acoustic_fingerprint_updated_at: Option<String>,
    pub(crate) rating: Option<f64>,
    pub(crate) play_count: i64,
    pub(crate) skip_count: i64,
    pub(crate) last_played_at: Option<String>,
    pub(crate) last_skipped_at: Option<String>,
    pub(crate) date_added: String,
    pub(crate) file_modified_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTrackPage {
    pub(crate) tracks: Vec<NativeTrack>,
    pub(crate) total: i64,
    pub(crate) limit: usize,
    pub(crate) offset: usize,
    pub(crate) source: String,
}

#[derive(Serialize)]
pub struct NativeAudioAnalysisCoverage {
    pub(crate) total_tracks: i64,
    pub(crate) analyzed_tracks: i64,
    pub(crate) unanalyzed_tracks: i64,
    pub(crate) failed_tracks: i64,
    pub(crate) coverage_percent: f64,
    pub(crate) provider: String,
}

#[derive(Clone, Serialize)]
pub struct NativeAudioAnalysisError {
    pub(crate) track_id: Option<i64>,
    pub(crate) path: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) message: String,
}

#[derive(Clone, Serialize)]
pub struct NativeAudioAnalysisProgress {
    pub(crate) job_id: String,
    pub(crate) status: String,
    pub(crate) phase: Option<String>,
    pub(crate) message: Option<String>,
    pub(crate) total_tracks: i64,
    pub(crate) processed_tracks: i64,
    pub(crate) analyzed: i64,
    pub(crate) skipped: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) failed_tracks: Vec<NativeAudioAnalysisError>,
    pub(crate) current_track: Option<String>,
    pub(crate) model_cached_at_start: Option<bool>,
    pub(crate) started_at: String,
    pub(crate) finished_at: Option<String>,
    pub(crate) elapsed_seconds: f64,
    pub(crate) eta_seconds: Option<f64>,
    pub(crate) percent: f64,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeClapGenreTagPreview {
    pub(crate) track_id: i64,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) current_genre: Option<String>,
    pub(crate) proposed_genre: Option<String>,
    pub(crate) confidence: Option<f64>,
    pub(crate) changed: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeClapGenreTagResponse {
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<NativeClapGenreTagPreview>,
}

#[derive(Serialize)]
pub struct NativeStatusResponse {
    pub(crate) status: String,
}

#[derive(Serialize)]
pub struct NativeSettingsResponse {
    pub(crate) library_path: Option<String>,
    pub(crate) library_paths: Vec<String>,
    pub(crate) database_path: String,
    pub(crate) suggested_music_path: Option<String>,
    pub(crate) write_ratings_to_files: bool,
    pub(crate) auto_write_fetched_lyrics_sidecars: bool,
    pub(crate) cd_auto_lookup_metadata: bool,
    pub(crate) acoustid_api_key_configured: bool,
    pub(crate) lastfm_api_credentials_configured: bool,
    pub(crate) lastfm_api_credentials_source: Option<String>,
    pub(crate) extra: serde_json::Value,
}

#[derive(Serialize)]
pub struct NativeTrackBatchResponse {
    pub(crate) tracks: Vec<NativeTrack>,
    pub(crate) missing_ids: Vec<i64>,
}

#[derive(Clone, Serialize)]
pub struct NativeSimilarTrack {
    #[serde(flatten)]
    pub(crate) track: NativeTrack,
    pub(crate) similarity_score: f64,
    pub(crate) similarity_reason: String,
    pub(crate) audio_similarity: Option<f64>,
}

#[derive(Clone, Serialize)]
pub struct NativeAudiobookTrack {
    #[serde(flatten)]
    pub(crate) track: NativeTrack,
    pub(crate) position_seconds: f64,
    pub(crate) progress_percent: f64,
    pub(crate) bookmark_count: i64,
    pub(crate) chapter_count: i64,
    pub(crate) progress_updated_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeAudiobookListResponse {
    pub(crate) total: i64,
    pub(crate) tracks: Vec<NativeAudiobookTrack>,
}

#[derive(Serialize)]
pub struct NativeAudiobookProgressResponse {
    pub(crate) track_id: i64,
    pub(crate) position_seconds: f64,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeAudiobookBookmark {
    pub(crate) id: i64,
    pub(crate) track_id: i64,
    pub(crate) position_seconds: f64,
    pub(crate) label: String,
    pub(crate) note: Option<String>,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
pub struct NativeAudiobookChapter {
    pub(crate) id: Option<i64>,
    pub(crate) track_id: Option<i64>,
    pub(crate) chapter_index: i64,
    pub(crate) title: String,
    pub(crate) start_seconds: f64,
    pub(crate) end_seconds: Option<f64>,
    pub(crate) created_at: Option<String>,
    pub(crate) updated_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeAudiobookSyncExportResponse {
    pub(crate) export_path: String,
    pub(crate) track_count: i64,
    pub(crate) generated_at: String,
}

#[derive(Serialize)]
pub struct NativeRadioStation {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) stream_url: String,
    pub(crate) homepage_url: Option<String>,
    pub(crate) genre: Option<String>,
    pub(crate) notes: Option<String>,
    pub(crate) last_played_at: Option<String>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeDeletedResponse {
    pub(crate) deleted: bool,
}

#[derive(Serialize)]
pub struct NativeLovedTrack {
    pub(crate) track_id: i64,
    pub(crate) loved: bool,
    pub(crate) source: String,
    pub(crate) updated_at: String,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTrackLoveResponse {
    pub(crate) track_id: i64,
    pub(crate) loved: bool,
    pub(crate) source: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeLibrarySourceRemoveResponse {
    pub(crate) path: String,
    pub(crate) library_paths: Vec<String>,
    pub(crate) removed_tracks: i64,
    pub(crate) removed_metadata_cache: i64,
    pub(crate) removed_artwork_cache: i64,
    pub(crate) message: String,
}

#[derive(Serialize)]
pub struct NativeAlbumSummary {
    pub(crate) id: i64,
    pub(crate) album: Option<String>,
    pub(crate) album_artist: Option<String>,
    pub(crate) year: Option<i64>,
    pub(crate) years: Vec<i64>,
    pub(crate) album_ids: Vec<i64>,
    pub(crate) edition_count: i64,
    pub(crate) artwork_path: Option<String>,
    pub(crate) track_count: i64,
    pub(crate) expected_track_count: Option<i64>,
    pub(crate) missing_track_count: i64,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) average_rating: Option<f64>,
    pub(crate) artwork_track_id: Option<i64>,
    pub(crate) completion_expected_track_count: Option<i64>,
    pub(crate) completion_source: Option<String>,
    pub(crate) completion_release_id: Option<String>,
    pub(crate) completion_release_title: Option<String>,
    pub(crate) completion_checked_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeArtistSummary {
    pub(crate) name: String,
    pub(crate) track_count: i64,
    pub(crate) album_count: i64,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) average_rating: Option<f64>,
    pub(crate) play_count: i64,
    pub(crate) skip_count: i64,
    pub(crate) first_year: Option<i64>,
    pub(crate) last_year: Option<i64>,
    pub(crate) artwork_track_id: Option<i64>,
}

#[derive(Serialize)]
pub struct NativeArtistInfoResponse {
    pub(crate) artist_name: String,
    pub(crate) query: String,
    pub(crate) summary: Option<String>,
    pub(crate) image_url: Option<String>,
    pub(crate) page_url: Option<String>,
    pub(crate) source: Option<String>,
    pub(crate) found: bool,
    pub(crate) from_cache: bool,
    pub(crate) updated_at: Option<String>,
    pub(crate) error: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct NativeAlbumArtworkCandidate {
    pub(crate) source: String,
    pub(crate) label: String,
    pub(crate) path: Option<String>,
    pub(crate) track_id: Option<i64>,
    pub(crate) artwork_url: Option<String>,
    pub(crate) thumbnail_url: Option<String>,
    pub(crate) release_id: Option<String>,
    pub(crate) media_type: Option<String>,
    pub(crate) size_bytes: Option<i64>,
    pub(crate) modified_at: Option<String>,
    pub(crate) selected: bool,
}

#[derive(Serialize)]
pub struct NativeAlbumArtworkUpdateResponse {
    pub(crate) album_id: i64,
    pub(crate) artwork_path: Option<String>,
    pub(crate) candidates: Vec<NativeAlbumArtworkCandidate>,
    pub(crate) embedded_updated: i64,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativePlaylistSummary {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) track_count: i64,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativePlayEventEntry {
    pub(crate) id: i64,
    pub(crate) track_id: Option<i64>,
    pub(crate) event_type: String,
    pub(crate) timestamp: String,
    pub(crate) metadata: serde_json::Value,
    pub(crate) track: Option<NativeTrack>,
}

#[derive(Serialize)]
pub struct NativeHistoryTrackStat {
    pub(crate) track: NativeTrack,
    pub(crate) play_count: i64,
    pub(crate) skip_count: i64,
    pub(crate) listened_seconds: f64,
}

#[derive(Serialize)]
pub struct NativeHistoryStatsResponse {
    pub(crate) total_play_count: i64,
    pub(crate) total_skip_count: i64,
    pub(crate) total_play_events: i64,
    pub(crate) total_skip_events: i64,
    pub(crate) total_rated_events: i64,
    pub(crate) unique_played_tracks: i64,
    pub(crate) unique_skipped_tracks: i64,
    pub(crate) total_listened_seconds: f64,
    pub(crate) top_played: Vec<NativeHistoryTrackStat>,
    pub(crate) top_skipped: Vec<NativeHistoryTrackStat>,
}

#[derive(Serialize)]
pub struct NativeLibraryStatsResponse {
    pub(crate) total_tracks: i64,
    pub(crate) total_albums: i64,
    pub(crate) total_artists: i64,
    pub(crate) total_playlists: i64,
    pub(crate) rated_tracks: i64,
    pub(crate) unrated_tracks: i64,
    pub(crate) total_duration_seconds: Option<f64>,
    pub(crate) played_events: i64,
    pub(crate) skipped_events: i64,
}

#[derive(Serialize)]
pub struct NativeInboxTrackNote {
    pub(crate) track_id: i64,
    pub(crate) note: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeInboxAutoReviewRule {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) enabled: bool,
    pub(crate) field: String,
    pub(crate) match_type: String,
    pub(crate) value: String,
    pub(crate) note: Option<String>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeInboxResponse {
    pub(crate) tracks: Vec<NativeTrack>,
    pub(crate) notes: Vec<NativeInboxTrackNote>,
    pub(crate) auto_review_rules: Vec<NativeInboxAutoReviewRule>,
    pub(crate) total_new: i64,
    pub(crate) total_reviewed: i64,
    pub(crate) limit: usize,
    pub(crate) offset: usize,
}

#[derive(Serialize)]
pub struct NativeInboxReviewResponse {
    pub(crate) updated: i64,
    pub(crate) total_new: i64,
    pub(crate) total_reviewed: i64,
}

#[derive(Serialize)]
pub struct NativeInboxAutoReviewRuleApplyResponse {
    pub(crate) rule: NativeInboxAutoReviewRule,
    pub(crate) applied: i64,
    pub(crate) total_new: i64,
    pub(crate) total_reviewed: i64,
}

#[derive(Serialize)]
pub struct NativeInboxAutoReviewRuleDeleteResponse {
    pub(crate) deleted: bool,
    pub(crate) total_new: i64,
    pub(crate) total_reviewed: i64,
}

#[derive(Serialize)]
pub struct NativeCacheClearResponse {
    pub(crate) cleared: BTreeMap<String, i64>,
}

#[derive(Serialize)]
pub struct NativeToolSetupResponse {
    pub(crate) available: bool,
    pub(crate) configured_path: Option<String>,
    pub(crate) resolved_path: Option<String>,
    pub(crate) version: Option<String>,
    pub(crate) tool_directory: String,
    pub(crate) checked_paths: Vec<String>,
    pub(crate) message: String,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeRegexTagPreset {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) field: String,
    pub(crate) pattern: String,
    pub(crate) replacement: String,
    pub(crate) case_sensitive: bool,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeVirtualTagDefinition {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) expression: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeDeviceSyncProfilePayload {
    pub(crate) name: String,
    pub(crate) target_folder: String,
    pub(crate) device_kind: String,
    pub(crate) music_subfolder: String,
    pub(crate) playlist_subfolder: String,
    pub(crate) playlist_ids: Vec<i64>,
    pub(crate) playlist_rules: serde_json::Value,
    pub(crate) copy_files: bool,
    pub(crate) export_playlists: bool,
    pub(crate) preserve_structure: bool,
}

#[derive(Serialize)]
pub struct NativeDeviceSyncProfile {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) target_folder: String,
    pub(crate) device_kind: String,
    pub(crate) music_subfolder: String,
    pub(crate) playlist_subfolder: String,
    pub(crate) playlist_ids: Vec<i64>,
    pub(crate) playlist_rules: serde_json::Value,
    pub(crate) copy_files: bool,
    pub(crate) export_playlists: bool,
    pub(crate) preserve_structure: bool,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeDeviceSyncProfilesResponse {
    pub(crate) profiles: Vec<NativeDeviceSyncProfile>,
    pub(crate) presets: Vec<NativeDeviceSyncProfilePayload>,
}

#[derive(Serialize)]
pub struct NativeDeviceSyncChange {
    pub(crate) track_id: i64,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) source_path: String,
    pub(crate) target_path: String,
    pub(crate) changed: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeDeviceSyncPlaylistExport {
    pub(crate) playlist_id: i64,
    pub(crate) name: String,
    pub(crate) playlist_path: String,
    pub(crate) track_count: i64,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeDeviceSyncResponse {
    pub(crate) target_folder: String,
    pub(crate) total_tracks: i64,
    pub(crate) changed_files: i64,
    pub(crate) copied_files: i64,
    pub(crate) skipped_files: i64,
    pub(crate) playlists_written: i64,
    pub(crate) changes: Vec<NativeDeviceSyncChange>,
    pub(crate) playlist_exports: Vec<NativeDeviceSyncPlaylistExport>,
}

#[derive(Serialize)]
pub struct NativeDeviceSyncDetectedDevice {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) root_path: String,
    pub(crate) device_kind: String,
    pub(crate) drive_type: Option<i64>,
    pub(crate) size_bytes: Option<i64>,
    pub(crate) free_bytes: Option<i64>,
    pub(crate) writable: bool,
    pub(crate) hint: Option<String>,
}

#[derive(Serialize)]
pub struct NativeDeviceSyncDevicesResponse {
    pub(crate) devices: Vec<NativeDeviceSyncDetectedDevice>,
    pub(crate) mtp_supported: bool,
    pub(crate) message: String,
}

#[derive(Serialize)]
pub struct NativeAcousticFingerprintResponse {
    pub(crate) tool_available: bool,
    pub(crate) processed: i64,
    pub(crate) updated: i64,
    pub(crate) skipped: i64,
    pub(crate) skipped_reasons: Vec<String>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeAudioConversionChange {
    pub(crate) track_id: i64,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) source_path: String,
    pub(crate) target_path: String,
    pub(crate) source_size_bytes: Option<i64>,
    pub(crate) estimated_output_size_bytes: Option<i64>,
    pub(crate) estimated_size_change_bytes: Option<i64>,
    pub(crate) estimated_size_ratio: Option<f64>,
    pub(crate) estimate_note: Option<String>,
    pub(crate) changed: bool,
    pub(crate) collision: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeAudioConversionPreviewResponse {
    pub(crate) target_folder: String,
    pub(crate) total: i64,
    pub(crate) changed_count: i64,
    pub(crate) collisions: i64,
    pub(crate) source_size_bytes: Option<i64>,
    pub(crate) estimated_output_size_bytes: Option<i64>,
    pub(crate) estimated_size_change_bytes: Option<i64>,
    pub(crate) estimated_size_ratio: Option<f64>,
    pub(crate) estimated_tracks: i64,
    pub(crate) changes: Vec<NativeAudioConversionChange>,
}

#[derive(Clone, Serialize)]
pub struct NativeAudioConversionProgress {
    pub(crate) job_id: String,
    pub(crate) target_folder: String,
    pub(crate) output_format: String,
    pub(crate) status: String,
    pub(crate) phase: Option<String>,
    pub(crate) message: Option<String>,
    pub(crate) total_tracks: i64,
    pub(crate) processed_tracks: i64,
    pub(crate) converted: i64,
    pub(crate) skipped: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) current_track: Option<String>,
    pub(crate) started_at: String,
    pub(crate) finished_at: Option<String>,
    pub(crate) elapsed_seconds: f64,
    pub(crate) eta_seconds: Option<f64>,
    pub(crate) percent: f64,
    pub(crate) error: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct NativeAudioConversionInstallProgress {
    pub(crate) job_id: String,
    pub(crate) status: String,
    pub(crate) message: String,
    pub(crate) current_step: i64,
    pub(crate) total_steps: i64,
    pub(crate) bytes_downloaded: i64,
    pub(crate) total_bytes: Option<i64>,
    pub(crate) download_url: Option<String>,
    pub(crate) tool_directory: String,
    pub(crate) log: Vec<String>,
    pub(crate) started_at: Option<String>,
    pub(crate) finished_at: Option<String>,
    pub(crate) elapsed_seconds: f64,
    pub(crate) percent: f64,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeBulkUndoLogEntry {
    pub(crate) id: i64,
    pub(crate) batch_id: Option<String>,
    pub(crate) action_type: String,
    pub(crate) summary: String,
    pub(crate) payload: serde_json::Value,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
pub struct NativeBulkUndoBatchEntry {
    pub(crate) batch_id: String,
    pub(crate) action_type: String,
    pub(crate) entries: i64,
    pub(crate) summary: String,
    pub(crate) first_created_at: String,
    pub(crate) last_created_at: String,
}

#[derive(Serialize)]
pub struct NativeAutoDjAvoidRule {
    pub(crate) id: i64,
    pub(crate) scope: String,
    pub(crate) target_key: String,
    pub(crate) label: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct NativeAutoDjSettings {
    pub(crate) queue_length: usize,
    pub(crate) temperature: f64,
    pub(crate) artist_cooldown: usize,
    pub(crate) album_cooldown: usize,
    pub(crate) unrated_exploration_percent: f64,
    pub(crate) target_unrated_percent: Option<f64>,
    pub(crate) target_exploration_percent: Option<f64>,
    pub(crate) max_repeat_artist_percent: Option<f64>,
    pub(crate) minimum_rating: Option<f64>,
    pub(crate) recently_played_cooldown_days: i64,
    pub(crate) seed_track_id: Option<i64>,
    pub(crate) similarity_weight: f64,
    pub(crate) rating_weight: f64,
    pub(crate) recency_weight: f64,
    pub(crate) skip_weight: f64,
    pub(crate) exploration_weight: f64,
    pub(crate) play_history_weight: f64,
    pub(crate) feedback_weight: f64,
    pub(crate) audio_similarity_weight: f64,
    pub(crate) artist_similarity_weight: f64,
    pub(crate) album_similarity_weight: f64,
    pub(crate) genre_similarity_weight: f64,
    pub(crate) year_similarity_weight: f64,
    pub(crate) rating_similarity_weight: f64,
    pub(crate) seed: Option<i64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct NativeQueueTrack {
    #[serde(flatten)]
    pub(crate) track: NativeTrack,
    pub(crate) score: f64,
    pub(crate) reason: String,
    pub(crate) score_breakdown: BTreeMap<String, f64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct NativeRecommendationDrift {
    pub(crate) total_tracks: i64,
    pub(crate) familiar_percent: f64,
    pub(crate) exploration_percent: f64,
    pub(crate) repeat_artist_percent: f64,
    pub(crate) unrated_percent: f64,
    pub(crate) clap_percent: f64,
    pub(crate) average_rating: Option<f64>,
    pub(crate) unique_artists: i64,
    pub(crate) unique_albums: i64,
    pub(crate) warnings: Vec<String>,
}

impl Default for NativeRecommendationDrift {
    fn default() -> Self {
        Self {
            total_tracks: 0,
            familiar_percent: 0.0,
            exploration_percent: 0.0,
            repeat_artist_percent: 0.0,
            unrated_percent: 0.0,
            clap_percent: 0.0,
            average_rating: None,
            unique_artists: 0,
            unique_albums: 0,
            warnings: Vec::new(),
        }
    }
}

#[derive(Serialize)]
pub struct NativeAutoDjResponse {
    pub(crate) tracks: Vec<NativeQueueTrack>,
    pub(crate) settings: NativeAutoDjSettings,
    pub(crate) drift: NativeRecommendationDrift,
    pub(crate) source: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct NativeRecommendationProfile {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) settings: NativeAutoDjSettings,
    pub(crate) is_default: bool,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeRecommendationRun {
    pub(crate) id: i64,
    pub(crate) settings: NativeAutoDjSettings,
    pub(crate) drift: NativeRecommendationDrift,
    pub(crate) track_ids: Vec<i64>,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
pub struct NativeRecommendationAbQueue {
    pub(crate) label: String,
    pub(crate) settings: NativeAutoDjSettings,
    pub(crate) drift: NativeRecommendationDrift,
    pub(crate) tracks: Vec<NativeQueueTrack>,
}

#[derive(Serialize)]
pub struct NativeRecommendationAbTestResponse {
    pub(crate) test_id: String,
    pub(crate) generated_at: String,
    pub(crate) queues: Vec<NativeRecommendationAbQueue>,
}

#[derive(Serialize)]
pub struct NativeRecommendationAbChoiceResponse {
    pub(crate) status: String,
    pub(crate) chosen_label: String,
    pub(crate) inserted_feedback: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct NativeRecommendationProfileComparison {
    pub(crate) profile: NativeRecommendationProfile,
    pub(crate) drift: NativeRecommendationDrift,
    pub(crate) top_tracks: Vec<NativeQueueTrack>,
}

#[derive(Serialize)]
pub struct NativeRecommendationProfileComparisonExportResponse {
    pub(crate) export_path: String,
    pub(crate) profile_count: i64,
}

#[derive(Serialize)]
pub struct NativeRecommendationProfileComparisonImportResponse {
    pub(crate) report_path: String,
    pub(crate) generated_at: Option<String>,
    pub(crate) seed: Option<i64>,
    pub(crate) seed_track_id: Option<i64>,
    pub(crate) comparisons: Vec<NativeRecommendationProfileComparison>,
}

#[derive(Serialize)]
pub struct NativeLibraryReconcilePreview {
    pub(crate) folders: Vec<String>,
    pub(crate) scanned_files: i64,
    pub(crate) database_tracks: i64,
    pub(crate) new_files: i64,
    pub(crate) missing_tracks: i64,
    pub(crate) modified_tracks: i64,
    pub(crate) sample_new_files: Vec<String>,
    pub(crate) sample_missing_tracks: Vec<String>,
    pub(crate) sample_modified_tracks: Vec<String>,
    pub(crate) elapsed_ms: u128,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeDuplicateGroup {
    pub(crate) key: String,
    pub(crate) ignore_key: String,
    pub(crate) tracks: Vec<NativeTrack>,
    pub(crate) match_reason: String,
    pub(crate) recommended_keep_id: Option<i64>,
    pub(crate) recommendation_reason: Option<String>,
    pub(crate) duration_spread_seconds: Option<f64>,
    pub(crate) bitrate_spread: Option<i64>,
    pub(crate) shared_fingerprint: bool,
    pub(crate) shared_acoustic_fingerprint: bool,
    pub(crate) average_audio_similarity: Option<f64>,
    pub(crate) path_roots: Vec<String>,
    pub(crate) analyzed_tracks: i64,
}

#[derive(Serialize)]
pub struct NativeLibraryHealthResponse {
    pub(crate) missing_files: Vec<NativeTrack>,
    pub(crate) missing_metadata: Vec<NativeTrack>,
    pub(crate) duplicate_groups: Vec<NativeDuplicateGroup>,
    pub(crate) unrated_tracks: Vec<NativeTrack>,
    pub(crate) missing_metadata_total: i64,
    pub(crate) duplicate_group_total: i64,
    pub(crate) ignored_duplicate_group_total: i64,
}

#[derive(Serialize)]
pub struct NativeFileOrganizationChange {
    pub(crate) track_id: i64,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) current_path: String,
    pub(crate) target_path: String,
    pub(crate) changed: bool,
    pub(crate) collision: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeFileOrganizationResponse {
    pub(crate) template: String,
    pub(crate) base_folder: String,
    pub(crate) total: i64,
    pub(crate) changes: Vec<NativeFileOrganizationChange>,
    pub(crate) changed_count: i64,
    pub(crate) applied: i64,
    pub(crate) removed_empty_folders: i64,
}

#[derive(Serialize)]
pub struct NativePlaylistParseResponse {
    pub(crate) playlist_path: String,
    pub(crate) base_folder: String,
    pub(crate) entries: Vec<String>,
    pub(crate) local_paths: Vec<String>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeExportResponse {
    pub(crate) playlist_path: String,
    pub(crate) track_count: i64,
}

#[derive(Serialize)]
pub struct NativeExtensionManifest {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) version: String,
    pub(crate) kind: String,
    pub(crate) description: Option<String>,
    pub(crate) author: Option<String>,
    pub(crate) homepage: Option<String>,
    pub(crate) entry: Option<String>,
    pub(crate) entry_path: Option<String>,
    pub(crate) directory: String,
    pub(crate) manifest_path: String,
    pub(crate) capabilities: Vec<String>,
    pub(crate) permissions: Vec<String>,
    pub(crate) enabled: bool,
    pub(crate) valid: bool,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeExtensionListResponse {
    pub(crate) user_extensions_dir: String,
    pub(crate) search_directories: Vec<String>,
    pub(crate) manifest_names: Vec<String>,
    pub(crate) extensions: Vec<NativeExtensionManifest>,
}

#[derive(Serialize)]
pub struct NativeReportFileResponse {
    pub(crate) report_path: String,
    pub(crate) exists: bool,
    pub(crate) size_bytes: i64,
    pub(crate) modified_at: Option<String>,
    pub(crate) parsed_json: Option<serde_json::Value>,
    pub(crate) raw_text: Option<String>,
    pub(crate) truncated: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeVolumeTagPreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) current_track_gain_db: Option<f64>,
    pub(crate) proposed_track_gain_db: Option<f64>,
    pub(crate) current_track_peak: Option<f64>,
    pub(crate) proposed_track_peak: Option<f64>,
    pub(crate) current_album_gain_db: Option<f64>,
    pub(crate) proposed_album_gain_db: Option<f64>,
    pub(crate) current_album_peak: Option<f64>,
    pub(crate) proposed_album_peak: Option<f64>,
    pub(crate) changed: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeVolumeTagResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<NativeVolumeTagPreview>,
    pub(crate) ffmpeg_path: Option<String>,
    pub(crate) checked_paths: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeBulkFileMove {
    pub(crate) source_path: String,
    pub(crate) target_path: String,
    pub(crate) changed: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeBulkFileMoveResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) moves: Vec<NativeBulkFileMove>,
}

#[derive(Serialize)]
pub struct NativeGaplessAudioShape {
    pub(crate) codec: Option<String>,
    pub(crate) sample_rate: Option<i64>,
    pub(crate) channels: Option<i64>,
    pub(crate) bits_per_sample: Option<i64>,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) estimated_samples: Option<i64>,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeGaplessPairValidation {
    pub(crate) left_track_id: i64,
    pub(crate) right_track_id: i64,
    pub(crate) left_title: Option<String>,
    pub(crate) right_title: Option<String>,
    pub(crate) left_shape: NativeGaplessAudioShape,
    pub(crate) right_shape: NativeGaplessAudioShape,
    pub(crate) metadata_compatible: bool,
    pub(crate) sample_accurate_ready: bool,
    pub(crate) warnings: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeGaplessValidationResponse {
    pub(crate) track_count: i64,
    pub(crate) pair_count: i64,
    pub(crate) sample_accurate_ready_count: i64,
    pub(crate) pairs: Vec<NativeGaplessPairValidation>,
    pub(crate) message: String,
}

#[derive(Serialize)]
pub struct NativePodcastSubscription {
    pub(crate) id: i64,
    pub(crate) title: String,
    pub(crate) feed_url: String,
    pub(crate) site_url: Option<String>,
    pub(crate) description: Option<String>,
    pub(crate) auto_download: bool,
    pub(crate) download_folder: Option<String>,
    pub(crate) effective_download_folder: Option<String>,
    pub(crate) last_checked_at: Option<String>,
    pub(crate) episode_count: i64,
    pub(crate) downloaded_count: i64,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativePodcastSubscriptionDeleteResponse {
    pub(crate) deleted: bool,
    pub(crate) deleted_files: i64,
    pub(crate) missing_files: i64,
    pub(crate) removed_tracks: i64,
}

#[derive(Serialize)]
pub struct NativePodcastFolderResponse {
    pub(crate) path: String,
    pub(crate) created: bool,
}

#[derive(Serialize)]
pub struct NativePodcastEpisode {
    pub(crate) id: i64,
    pub(crate) subscription_id: i64,
    pub(crate) subscription_title: Option<String>,
    pub(crate) track_id: Option<i64>,
    pub(crate) guid: String,
    pub(crate) title: String,
    pub(crate) description: Option<String>,
    pub(crate) audio_url: Option<String>,
    pub(crate) published_at: Option<String>,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) local_path: Option<String>,
    pub(crate) download_status: String,
    pub(crate) downloaded_at: Option<String>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct NativeScrobbleAccount {
    pub(crate) service: String,
    pub(crate) enabled: bool,
    pub(crate) username: Option<String>,
    pub(crate) token: Option<String>,
    pub(crate) api_key: Option<String>,
    pub(crate) api_secret: Option<String>,
    pub(crate) session_key: Option<String>,
    pub(crate) updated_at: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct NativeScrobbleOutboxEntry {
    pub(crate) id: i64,
    pub(crate) service: String,
    pub(crate) track_id: Option<i64>,
    pub(crate) event_type: String,
    pub(crate) artist: String,
    pub(crate) title: String,
    pub(crate) album: Option<String>,
    pub(crate) album_artist: Option<String>,
    pub(crate) listened_at: Option<i64>,
    pub(crate) status: String,
    pub(crate) attempts: i64,
    pub(crate) last_error: Option<String>,
    pub(crate) created_at: String,
    pub(crate) submitted_at: Option<String>,
}

#[derive(Serialize)]
pub struct NativeScrobbleQueueHistoryResponse {
    pub(crate) queued: i64,
    pub(crate) considered: i64,
}

#[derive(Serialize)]
pub struct NativeScrobbleSubmitResponse {
    pub(crate) submitted: i64,
    pub(crate) failed: i64,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeFilenameTagInferencePreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) matched: bool,
    pub(crate) current: serde_json::Value,
    pub(crate) inferred: serde_json::Value,
    pub(crate) changed_fields: Vec<String>,
    pub(crate) accepted: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeFilenameTagInferenceResponse {
    pub(crate) total: i64,
    pub(crate) matches: i64,
    pub(crate) applied: i64,
    pub(crate) previews: Vec<NativeFilenameTagInferencePreview>,
}

#[derive(Serialize)]
pub struct NativeBulkUndoRestoreResponse {
    pub(crate) entry_id: i64,
    pub(crate) batch_id: Option<String>,
    pub(crate) action_type: String,
    pub(crate) restored: bool,
    pub(crate) affected_track_ids: Vec<i64>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeCustomTagBatchPreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) tag_key: String,
    pub(crate) current: Option<String>,
    pub(crate) value: Option<String>,
    pub(crate) changed: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeCustomTagBatchResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) previews: Vec<NativeCustomTagBatchPreview>,
}

#[derive(Serialize)]
pub struct NativeVirtualTagPreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) title: Option<String>,
    pub(crate) value: Option<String>,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeVirtualTagPreviewResponse {
    pub(crate) expression: String,
    pub(crate) total: i64,
    pub(crate) previews: Vec<NativeVirtualTagPreview>,
}

#[derive(Serialize)]
pub struct NativeTagFieldCopySwapPreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) source_field: String,
    pub(crate) target_field: String,
    pub(crate) current_source: serde_json::Value,
    pub(crate) current_target: serde_json::Value,
    pub(crate) new_source: serde_json::Value,
    pub(crate) new_target: serde_json::Value,
    pub(crate) changed: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTagFieldCopySwapResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) previews: Vec<NativeTagFieldCopySwapPreview>,
}

#[derive(Serialize)]
pub struct NativeTagRegexReplacePreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) field: String,
    pub(crate) current: Option<String>,
    pub(crate) replacement: Option<String>,
    pub(crate) changed: bool,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTagRegexReplaceResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) previews: Vec<NativeTagRegexReplacePreview>,
}

#[derive(Serialize)]
pub struct NativeDuplicateReviewResponse {
    pub(crate) tracks: Vec<NativeTrack>,
    pub(crate) groups: Vec<NativeDuplicateGroup>,
    pub(crate) missing_track_ids: Vec<i64>,
}

#[derive(Serialize)]
pub struct NativeDuplicateActionResponse {
    pub(crate) action: String,
    pub(crate) affected: i64,
    pub(crate) removed_track_ids: Vec<i64>,
    pub(crate) deleted_files: i64,
    pub(crate) report_path: Option<String>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeTrackFileMetadataWritePreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) changed_fields: Vec<String>,
    pub(crate) database: serde_json::Value,
    pub(crate) file: serde_json::Value,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTrackFileMetadataWriteResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) missing_track_ids: Vec<i64>,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<NativeTrackFileMetadataWritePreview>,
}

#[derive(Serialize)]
pub struct NativeCsvMetadataExportResponse {
    pub(crate) csv_path: String,
    pub(crate) track_count: i64,
    pub(crate) columns: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeCsvMetadataImportPreview {
    pub(crate) row_number: i64,
    pub(crate) track_id: Option<i64>,
    pub(crate) path: Option<String>,
    pub(crate) matched: bool,
    pub(crate) current: serde_json::Value,
    pub(crate) imported: serde_json::Value,
    pub(crate) changed_fields: Vec<String>,
    pub(crate) conflict_fields: Vec<String>,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeCsvMetadataImportResponse {
    pub(crate) csv_path: String,
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<NativeCsvMetadataImportPreview>,
}

#[derive(Serialize)]
pub struct NativeCsvMetadataImportReportResponse {
    pub(crate) report_path: String,
    pub(crate) csv_path: String,
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) errors: i64,
}

#[derive(Serialize)]
pub struct NativeLyricsResponse {
    pub(crate) track_id: i64,
    pub(crate) lyrics: Option<String>,
    pub(crate) source: Option<String>,
    pub(crate) is_synced: bool,
    pub(crate) sidecar_path: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTagBackupResponse {
    pub(crate) backup_path: String,
    pub(crate) track_count: i64,
    pub(crate) custom_tag_count: i64,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
pub struct NativeTagBackupSummary {
    pub(crate) backup_path: String,
    pub(crate) file_name: String,
    pub(crate) track_count: i64,
    pub(crate) created_at: Option<String>,
    pub(crate) size_bytes: i64,
}

#[derive(Serialize)]
pub struct NativeTagBackupRestorePreview {
    pub(crate) track_id: Option<i64>,
    pub(crate) path: Option<String>,
    pub(crate) matched: bool,
    pub(crate) changed_fields: Vec<String>,
    pub(crate) current: serde_json::Value,
    pub(crate) restored: serde_json::Value,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeTagBackupRestoreResponse {
    pub(crate) backup_path: String,
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<NativeTagBackupRestorePreview>,
}
