#[derive(Serialize)]
pub struct DesktopVolumeTagPreview {
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
pub struct DesktopVolumeTagResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<DesktopVolumeTagPreview>,
    pub(crate) ffmpeg_path: Option<String>,
    pub(crate) checked_paths: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopPodcastSubscription {
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
pub struct DesktopPodcastSubscriptionDeleteResponse {
    pub(crate) deleted: bool,
    pub(crate) deleted_files: i64,
    pub(crate) missing_files: i64,
    pub(crate) removed_tracks: i64,
}

#[derive(Serialize)]
pub struct DesktopPodcastFolderResponse {
    pub(crate) path: String,
    pub(crate) created: bool,
}

#[derive(Serialize)]
pub struct DesktopPodcastEpisode {
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
pub struct DesktopPodcastRefreshResponse {
    pub(crate) subscription: DesktopPodcastSubscription,
    pub(crate) inserted: i64,
    pub(crate) updated: i64,
    pub(crate) total: i64,
}

#[derive(Serialize)]
pub struct DesktopPodcastDeleteDownloadResponse {
    pub(crate) episode: DesktopPodcastEpisode,
    pub(crate) deleted_file: bool,
    pub(crate) missing_file: bool,
    pub(crate) removed_track: bool,
}

#[derive(Serialize)]
pub struct DesktopScrobbleAccount {
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
pub struct DesktopScrobbleOutboxEntry {
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
pub struct DesktopScrobbleQueueHistoryResponse {
    pub(crate) queued: i64,
    pub(crate) considered: i64,
}

#[derive(Serialize)]
pub struct DesktopScrobbleSubmitResponse {
    pub(crate) submitted: i64,
    pub(crate) failed: i64,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopLastFmLoginStartResponse {
    pub(crate) token: String,
    pub(crate) auth_url: String,
}

#[derive(Serialize)]
pub struct DesktopLastFmLoginCompleteResponse {
    pub(crate) account: DesktopScrobbleAccount,
}

#[derive(Serialize)]
pub struct DesktopScrobbleHistoryImportPreview {
    pub(crate) row: i64,
    pub(crate) matched: bool,
    pub(crate) track_id: Option<i64>,
    pub(crate) artist: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) changes: serde_json::Value,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopScrobbleHistoryImportResponse {
    pub(crate) total: i64,
    pub(crate) updated: i64,
    pub(crate) previews: Vec<DesktopScrobbleHistoryImportPreview>,
}

#[derive(Serialize)]
pub struct DesktopLibraryStatsImportPreview {
    pub(crate) row_number: i64,
    pub(crate) source: String,
    pub(crate) path: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) track_id: Option<i64>,
    pub(crate) matched_by: Option<String>,
    pub(crate) imported_rating: Option<f64>,
    pub(crate) imported_play_count: Option<i64>,
    pub(crate) imported_last_played_at: Option<String>,
    pub(crate) current_rating: Option<f64>,
    pub(crate) current_play_count: Option<i64>,
    pub(crate) current_last_played_at: Option<String>,
    pub(crate) changed_fields: Vec<String>,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopLibraryStatsImportResponse {
    pub(crate) source: String,
    pub(crate) import_path: String,
    pub(crate) total_rows: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: i64,
    pub(crate) previews: Vec<DesktopLibraryStatsImportPreview>,
}

