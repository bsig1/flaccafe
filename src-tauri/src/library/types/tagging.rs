#[derive(Serialize)]
pub struct DesktopAlbumCompletionLookupResponse {
    pub(crate) album_id: i64,
    pub(crate) expected_track_count: Option<i64>,
    pub(crate) missing_track_count: i64,
    pub(crate) source: Option<String>,
    pub(crate) release_id: Option<String>,
    pub(crate) release_title: Option<String>,
    pub(crate) confidence: f64,
    pub(crate) checked_at: Option<String>,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopAutoTagPreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) current: serde_json::Value,
    pub(crate) proposed: serde_json::Value,
    pub(crate) changed_fields: Vec<String>,
    pub(crate) confidence: f64,
    pub(crate) match_type: String,
    pub(crate) source: String,
    pub(crate) release_id: Option<String>,
    pub(crate) release_title: Option<String>,
    pub(crate) recording_id: Option<String>,
    pub(crate) artwork_url: Option<String>,
    pub(crate) artwork_thumbnail_url: Option<String>,
    pub(crate) applied: bool,
    pub(crate) artwork_saved: bool,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopAutoTagResponse {
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) artwork_matches: i64,
    pub(crate) artwork_saved: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<DesktopAutoTagPreview>,
}

#[derive(Serialize)]
pub struct DesktopFilenameTagInferencePreview {
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
pub struct DesktopFilenameTagInferenceResponse {
    pub(crate) total: i64,
    pub(crate) matches: i64,
    pub(crate) applied: i64,
    pub(crate) previews: Vec<DesktopFilenameTagInferencePreview>,
}

#[derive(Serialize)]
pub struct DesktopBulkUndoRestoreResponse {
    pub(crate) entry_id: i64,
    pub(crate) batch_id: Option<String>,
    pub(crate) action_type: String,
    pub(crate) restored: bool,
    pub(crate) affected_track_ids: Vec<i64>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopCustomTagBatchPreview {
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
pub struct DesktopCustomTagBatchResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) previews: Vec<DesktopCustomTagBatchPreview>,
}

#[derive(Serialize)]
pub struct DesktopVirtualTagPreview {
    pub(crate) track_id: i64,
    pub(crate) path: String,
    pub(crate) title: Option<String>,
    pub(crate) value: Option<String>,
    pub(crate) error: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopVirtualTagPreviewResponse {
    pub(crate) expression: String,
    pub(crate) total: i64,
    pub(crate) previews: Vec<DesktopVirtualTagPreview>,
}

#[derive(Serialize)]
pub struct DesktopTagFieldCopySwapPreview {
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
pub struct DesktopTagFieldCopySwapResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) previews: Vec<DesktopTagFieldCopySwapPreview>,
}

#[derive(Serialize)]
pub struct DesktopTagRegexReplacePreview {
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
pub struct DesktopTagRegexReplaceResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) previews: Vec<DesktopTagRegexReplacePreview>,
}

#[derive(Serialize)]
pub struct DesktopDuplicateReviewResponse {
    pub(crate) tracks: Vec<DesktopTrack>,
    pub(crate) groups: Vec<DesktopDuplicateGroup>,
    pub(crate) missing_track_ids: Vec<i64>,
}

#[derive(Serialize)]
pub struct DesktopDuplicateActionResponse {
    pub(crate) action: String,
    pub(crate) affected: i64,
    pub(crate) removed_track_ids: Vec<i64>,
    pub(crate) deleted_files: i64,
    pub(crate) report_path: Option<String>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopTrackFileMetadataWritePreview {
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
pub struct DesktopTrackFileMetadataWriteResponse {
    pub(crate) total: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) missing_track_ids: Vec<i64>,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<DesktopTrackFileMetadataWritePreview>,
}

#[derive(Serialize)]
pub struct DesktopCsvMetadataExportResponse {
    pub(crate) csv_path: String,
    pub(crate) track_count: i64,
    pub(crate) columns: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopCsvMetadataImportPreview {
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
pub struct DesktopCsvMetadataImportResponse {
    pub(crate) csv_path: String,
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<DesktopCsvMetadataImportPreview>,
}

#[derive(Serialize)]
pub struct DesktopCsvMetadataImportReportResponse {
    pub(crate) report_path: String,
    pub(crate) csv_path: String,
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) errors: i64,
}

#[derive(Serialize)]
pub struct DesktopLyricsResponse {
    pub(crate) track_id: i64,
    pub(crate) lyrics: Option<String>,
    pub(crate) source: Option<String>,
    pub(crate) is_synced: bool,
    pub(crate) sidecar_path: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopTagBackupResponse {
    pub(crate) backup_path: String,
    pub(crate) track_count: i64,
    pub(crate) custom_tag_count: i64,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
pub struct DesktopTagBackupSummary {
    pub(crate) backup_path: String,
    pub(crate) file_name: String,
    pub(crate) track_count: i64,
    pub(crate) created_at: Option<String>,
    pub(crate) size_bytes: i64,
}

#[derive(Serialize)]
pub struct DesktopTagBackupRestorePreview {
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
pub struct DesktopTagBackupRestoreResponse {
    pub(crate) backup_path: String,
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<DesktopTagBackupRestorePreview>,
}
