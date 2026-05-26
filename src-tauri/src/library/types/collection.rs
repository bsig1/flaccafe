#[derive(Serialize)]
#[derive(Clone, Deserialize)]
pub struct DesktopPlaylistSummary {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) track_count: i64,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct DesktopPlayEventEntry {
    pub(crate) id: i64,
    pub(crate) track_id: Option<i64>,
    pub(crate) event_type: String,
    pub(crate) timestamp: String,
    pub(crate) metadata: serde_json::Value,
    pub(crate) track: Option<DesktopTrack>,
}

#[derive(Serialize)]
pub struct DesktopHistoryTrackStat {
    pub(crate) track: DesktopTrack,
    pub(crate) play_count: i64,
    pub(crate) skip_count: i64,
    pub(crate) listened_seconds: f64,
}

#[derive(Serialize)]
pub struct DesktopHistoryStatsResponse {
    pub(crate) total_play_count: i64,
    pub(crate) total_skip_count: i64,
    pub(crate) total_play_events: i64,
    pub(crate) total_skip_events: i64,
    pub(crate) total_rated_events: i64,
    pub(crate) unique_played_tracks: i64,
    pub(crate) unique_skipped_tracks: i64,
    pub(crate) total_listened_seconds: f64,
    pub(crate) top_played: Vec<DesktopHistoryTrackStat>,
    pub(crate) top_skipped: Vec<DesktopHistoryTrackStat>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopLibraryStatsResponse {
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
pub struct DesktopInboxTrackNote {
    pub(crate) track_id: i64,
    pub(crate) note: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct DesktopInboxAutoReviewRule {
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
pub struct DesktopInboxResponse {
    pub(crate) tracks: Vec<DesktopTrack>,
    pub(crate) notes: Vec<DesktopInboxTrackNote>,
    pub(crate) auto_review_rules: Vec<DesktopInboxAutoReviewRule>,
    pub(crate) total_new: i64,
    pub(crate) total_reviewed: i64,
    pub(crate) limit: usize,
    pub(crate) offset: usize,
}

#[derive(Serialize)]
pub struct DesktopInboxReviewResponse {
    pub(crate) updated: i64,
    pub(crate) total_new: i64,
    pub(crate) total_reviewed: i64,
}

#[derive(Serialize)]
pub struct DesktopInboxAutoReviewRuleApplyResponse {
    pub(crate) rule: DesktopInboxAutoReviewRule,
    pub(crate) applied: i64,
    pub(crate) total_new: i64,
    pub(crate) total_reviewed: i64,
}

#[derive(Serialize)]
pub struct DesktopInboxAutoReviewRuleDeleteResponse {
    pub(crate) deleted: bool,
    pub(crate) total_new: i64,
    pub(crate) total_reviewed: i64,
}

#[derive(Serialize)]
pub struct DesktopCacheClearResponse {
    pub(crate) cleared: BTreeMap<String, i64>,
}

#[derive(Serialize)]
pub struct DesktopToolSetupResponse {
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
pub struct DesktopRegexTagPreset {
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
pub struct DesktopVirtualTagDefinition {
    pub(crate) id: i64,
    pub(crate) name: String,
    pub(crate) expression: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct DesktopDeviceSyncProfilePayload {
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
pub struct DesktopDeviceSyncProfile {
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
pub struct DesktopDeviceSyncProfilesResponse {
    pub(crate) profiles: Vec<DesktopDeviceSyncProfile>,
    pub(crate) presets: Vec<DesktopDeviceSyncProfilePayload>,
}

#[derive(Serialize)]
pub struct DesktopDeviceSyncChange {
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
pub struct DesktopDeviceSyncPlaylistExport {
    pub(crate) playlist_id: i64,
    pub(crate) name: String,
    pub(crate) playlist_path: String,
    pub(crate) track_count: i64,
    pub(crate) applied: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopDeviceSyncResponse {
    pub(crate) target_folder: String,
    pub(crate) total_tracks: i64,
    pub(crate) changed_files: i64,
    pub(crate) copied_files: i64,
    pub(crate) skipped_files: i64,
    pub(crate) playlists_written: i64,
    pub(crate) changes: Vec<DesktopDeviceSyncChange>,
    pub(crate) playlist_exports: Vec<DesktopDeviceSyncPlaylistExport>,
}

#[derive(Serialize)]
pub struct DesktopDeviceSyncDetectedDevice {
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
pub struct DesktopDeviceSyncDevicesResponse {
    pub(crate) devices: Vec<DesktopDeviceSyncDetectedDevice>,
    pub(crate) mtp_supported: bool,
    pub(crate) message: String,
}

