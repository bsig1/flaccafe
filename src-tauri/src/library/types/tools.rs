#[derive(Serialize)]
pub struct DesktopAcousticFingerprintResponse {
    pub(crate) tool_available: bool,
    pub(crate) processed: i64,
    pub(crate) updated: i64,
    pub(crate) skipped: i64,
    pub(crate) skipped_reasons: Vec<String>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopAudioConversionChange {
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
pub struct DesktopAudioConversionPreviewResponse {
    pub(crate) target_folder: String,
    pub(crate) total: i64,
    pub(crate) changed_count: i64,
    pub(crate) collisions: i64,
    pub(crate) source_size_bytes: Option<i64>,
    pub(crate) estimated_output_size_bytes: Option<i64>,
    pub(crate) estimated_size_change_bytes: Option<i64>,
    pub(crate) estimated_size_ratio: Option<f64>,
    pub(crate) estimated_tracks: i64,
    pub(crate) changes: Vec<DesktopAudioConversionChange>,
}

#[derive(Clone, Serialize)]
pub struct DesktopAudioConversionProgress {
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
pub struct DesktopAudioConversionInstallProgress {
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
pub struct DesktopBulkUndoLogEntry {
    pub(crate) id: i64,
    pub(crate) batch_id: Option<String>,
    pub(crate) action_type: String,
    pub(crate) summary: String,
    pub(crate) payload: serde_json::Value,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
pub struct DesktopBulkUndoBatchEntry {
    pub(crate) batch_id: String,
    pub(crate) action_type: String,
    pub(crate) entries: i64,
    pub(crate) summary: String,
    pub(crate) first_created_at: String,
    pub(crate) last_created_at: String,
}

#[derive(Serialize)]
pub struct DesktopAutoDjAvoidRule {
    pub(crate) id: i64,
    pub(crate) scope: String,
    pub(crate) target_key: String,
    pub(crate) label: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

fn default_auto_dj_mood_seed_weight() -> f64 {
    1.4
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopAutoDjSettings {
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
    #[serde(default)]
    pub(crate) mood_seeds: Vec<String>,
    #[serde(default = "default_auto_dj_mood_seed_weight")]
    pub(crate) mood_seed_weight: f64,
    pub(crate) similarity_weight: f64,
    pub(crate) rating_weight: f64,
    pub(crate) recency_weight: f64,
    pub(crate) skip_weight: f64,
    pub(crate) exploration_weight: f64,
    pub(crate) play_history_weight: f64,
    pub(crate) feedback_weight: f64,
    pub(crate) audio_similarity_weight: f64,
    pub(crate) mood_similarity_weight: f64,
    pub(crate) artist_similarity_weight: f64,
    pub(crate) album_similarity_weight: f64,
    pub(crate) genre_similarity_weight: f64,
    pub(crate) year_similarity_weight: f64,
    pub(crate) rating_similarity_weight: f64,
    pub(crate) seed: Option<i64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopQueueTrack {
    #[serde(flatten)]
    pub(crate) track: DesktopTrack,
    pub(crate) score: f64,
    pub(crate) reason: String,
    pub(crate) score_breakdown: BTreeMap<String, f64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopRecommendationDrift {
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

impl Default for DesktopRecommendationDrift {
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
pub struct DesktopAutoDjResponse {
    pub(crate) tracks: Vec<DesktopQueueTrack>,
    pub(crate) settings: DesktopAutoDjSettings,
    pub(crate) drift: DesktopRecommendationDrift,
    pub(crate) source: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopRecommendationProfile {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) settings: DesktopAutoDjSettings,
    pub(crate) is_default: bool,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct DesktopRecommendationRun {
    pub(crate) id: i64,
    pub(crate) settings: DesktopAutoDjSettings,
    pub(crate) drift: DesktopRecommendationDrift,
    pub(crate) track_ids: Vec<i64>,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
pub struct DesktopRecommendationAbQueue {
    pub(crate) label: String,
    pub(crate) settings: DesktopAutoDjSettings,
    pub(crate) drift: DesktopRecommendationDrift,
    pub(crate) tracks: Vec<DesktopQueueTrack>,
}

#[derive(Serialize)]
pub struct DesktopRecommendationAbTestResponse {
    pub(crate) test_id: String,
    pub(crate) generated_at: String,
    pub(crate) queues: Vec<DesktopRecommendationAbQueue>,
}

#[derive(Serialize)]
pub struct DesktopRecommendationAbChoiceResponse {
    pub(crate) status: String,
    pub(crate) chosen_label: String,
    pub(crate) inserted_feedback: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopRecommendationProfileComparison {
    pub(crate) profile: DesktopRecommendationProfile,
    pub(crate) drift: DesktopRecommendationDrift,
    pub(crate) top_tracks: Vec<DesktopQueueTrack>,
}

#[derive(Serialize)]
pub struct DesktopRecommendationProfileComparisonExportResponse {
    pub(crate) export_path: String,
    pub(crate) profile_count: i64,
}

#[derive(Serialize)]
pub struct DesktopRecommendationProfileComparisonImportResponse {
    pub(crate) report_path: String,
    pub(crate) generated_at: Option<String>,
    pub(crate) seed: Option<i64>,
    pub(crate) seed_track_id: Option<i64>,
    pub(crate) comparisons: Vec<DesktopRecommendationProfileComparison>,
}

#[derive(Serialize)]
pub struct DesktopLibraryReconcilePreview {
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
pub struct DesktopDuplicateGroup {
    pub(crate) key: String,
    pub(crate) ignore_key: String,
    pub(crate) tracks: Vec<DesktopTrack>,
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
pub struct DesktopLibraryHealthResponse {
    pub(crate) missing_files: Vec<DesktopTrack>,
    pub(crate) missing_metadata: Vec<DesktopTrack>,
    pub(crate) duplicate_groups: Vec<DesktopDuplicateGroup>,
    pub(crate) unrated_tracks: Vec<DesktopTrack>,
    pub(crate) missing_metadata_total: i64,
    pub(crate) duplicate_group_total: i64,
    pub(crate) ignored_duplicate_group_total: i64,
}

#[derive(Serialize)]
pub struct DesktopFileOrganizationChange {
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
pub struct DesktopFileOrganizationResponse {
    pub(crate) template: String,
    pub(crate) base_folder: String,
    pub(crate) total: i64,
    pub(crate) changes: Vec<DesktopFileOrganizationChange>,
    pub(crate) changed_count: i64,
    pub(crate) applied: i64,
    pub(crate) removed_empty_folders: i64,
}

#[derive(Serialize)]
pub struct DesktopFileOrganizationReportResponse {
    pub(crate) report_path: String,
    pub(crate) total: i64,
    pub(crate) changed_count: i64,
    pub(crate) collisions: i64,
}

#[derive(Serialize)]
pub struct DesktopPlaylistParseResponse {
    pub(crate) playlist_path: String,
    pub(crate) base_folder: String,
    pub(crate) entries: Vec<String>,
    pub(crate) local_paths: Vec<String>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopExportResponse {
    pub(crate) playlist_path: String,
    pub(crate) track_count: i64,
}

#[derive(Serialize)]
pub struct DesktopExtensionManifest {
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
pub struct DesktopExtensionListResponse {
    pub(crate) user_extensions_dir: String,
    pub(crate) search_directories: Vec<String>,
    pub(crate) manifest_names: Vec<String>,
    pub(crate) extensions: Vec<DesktopExtensionManifest>,
}

#[derive(Serialize)]
pub struct DesktopReportFileResponse {
    pub(crate) report_path: String,
    pub(crate) exists: bool,
    pub(crate) size_bytes: i64,
    pub(crate) modified_at: Option<String>,
    pub(crate) parsed_json: Option<serde_json::Value>,
    pub(crate) raw_text: Option<String>,
    pub(crate) truncated: bool,
    pub(crate) error: Option<String>,
}

