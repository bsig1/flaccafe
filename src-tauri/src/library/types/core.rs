use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Default)]
pub struct DesktopLibraryState;

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopTrack {
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

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopTrackPage {
    pub(crate) tracks: Vec<DesktopTrack>,
    pub(crate) total: i64,
    pub(crate) limit: usize,
    pub(crate) offset: usize,
    pub(crate) source: String,
}

#[derive(Serialize)]
pub struct DesktopAudioAnalysisCoverage {
    pub(crate) total_tracks: i64,
    pub(crate) analyzed_tracks: i64,
    pub(crate) unanalyzed_tracks: i64,
    pub(crate) failed_tracks: i64,
    pub(crate) coverage_percent: f64,
    pub(crate) provider: String,
}

#[derive(Clone, Serialize)]
pub struct DesktopAudioAnalysisError {
    pub(crate) track_id: Option<i64>,
    pub(crate) path: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) message: String,
}

#[derive(Clone, Serialize)]
pub struct DesktopAudioAnalysisProgress {
    pub(crate) job_id: String,
    pub(crate) status: String,
    pub(crate) phase: Option<String>,
    pub(crate) message: Option<String>,
    pub(crate) total_tracks: i64,
    pub(crate) processed_tracks: i64,
    pub(crate) analyzed: i64,
    pub(crate) skipped: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) failed_tracks: Vec<DesktopAudioAnalysisError>,
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
pub struct DesktopClapGenreTagPreview {
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
pub struct DesktopClapGenreTagResponse {
    pub(crate) total: i64,
    pub(crate) matched: i64,
    pub(crate) changed: i64,
    pub(crate) applied: i64,
    pub(crate) errors: Vec<String>,
    pub(crate) previews: Vec<DesktopClapGenreTagPreview>,
}

#[derive(Serialize)]
pub struct DesktopStatusResponse {
    pub(crate) status: String,
}

#[derive(Serialize)]
pub struct DesktopSettingsResponse {
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
pub struct DesktopTrackBatchResponse {
    pub(crate) tracks: Vec<DesktopTrack>,
    pub(crate) missing_ids: Vec<i64>,
}

#[derive(Clone, Serialize)]
pub struct DesktopSimilarTrack {
    #[serde(flatten)]
    pub(crate) track: DesktopTrack,
    pub(crate) similarity_score: f64,
    pub(crate) similarity_reason: String,
    pub(crate) audio_similarity: Option<f64>,
}

#[derive(Clone, Serialize)]
pub struct DesktopAudiobookTrack {
    #[serde(flatten)]
    pub(crate) track: DesktopTrack,
    pub(crate) position_seconds: f64,
    pub(crate) progress_percent: f64,
    pub(crate) bookmark_count: i64,
    pub(crate) chapter_count: i64,
    pub(crate) progress_updated_at: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopAudiobookListResponse {
    pub(crate) total: i64,
    pub(crate) tracks: Vec<DesktopAudiobookTrack>,
}

#[derive(Serialize)]
pub struct DesktopAudiobookProgressResponse {
    pub(crate) track_id: i64,
    pub(crate) position_seconds: f64,
    pub(crate) duration_seconds: Option<f64>,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct DesktopAudiobookBookmark {
    pub(crate) id: i64,
    pub(crate) track_id: i64,
    pub(crate) position_seconds: f64,
    pub(crate) label: String,
    pub(crate) note: Option<String>,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
pub struct DesktopAudiobookChapter {
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
pub struct DesktopAudiobookSyncExportResponse {
    pub(crate) export_path: String,
    pub(crate) track_count: i64,
    pub(crate) generated_at: String,
}

#[derive(Serialize)]
pub struct DesktopRadioStation {
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
pub struct DesktopDeletedResponse {
    pub(crate) deleted: bool,
}

#[derive(Serialize)]
pub struct DesktopTrackDeleteResponse {
    pub(crate) track_id: i64,
    pub(crate) removed_from_library: bool,
    pub(crate) deleted_file: bool,
    pub(crate) file_missing: bool,
}

#[derive(Serialize)]
pub struct DesktopTracksDeleteResponse {
    pub(crate) removed_track_ids: Vec<i64>,
    pub(crate) removed_count: i64,
    pub(crate) deleted_files: i64,
    pub(crate) missing_track_ids: Vec<i64>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopTrackMetadataSyncResponse {
    pub(crate) synced_track_ids: Vec<i64>,
    pub(crate) synced_count: i64,
    pub(crate) missing_track_ids: Vec<i64>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
pub struct DesktopLovedTrack {
    pub(crate) track_id: i64,
    pub(crate) loved: bool,
    pub(crate) source: String,
    pub(crate) updated_at: String,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
}

#[derive(Serialize)]
pub struct DesktopTrackLoveResponse {
    pub(crate) track_id: i64,
    pub(crate) loved: bool,
    pub(crate) source: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
pub struct DesktopLibrarySourceRemoveResponse {
    pub(crate) path: String,
    pub(crate) library_paths: Vec<String>,
    pub(crate) removed_tracks: i64,
    pub(crate) removed_metadata_cache: i64,
    pub(crate) removed_artwork_cache: i64,
    pub(crate) message: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopAlbumSummary {
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

#[derive(Clone, Serialize, Deserialize)]
pub struct DesktopArtistSummary {
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
pub struct DesktopArtistInfoResponse {
    pub(crate) artist_name: String,
    pub(crate) query: String,
    pub(crate) summary: Option<String>,
    pub(crate) image_url: Option<String>,
    pub(crate) page_url: Option<String>,
    pub(crate) source: Option<String>,
    pub(crate) found: bool,
    pub(crate) confidence: f64,
    pub(crate) from_cache: bool,
    pub(crate) updated_at: Option<String>,
    pub(crate) error: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct DesktopAlbumArtworkCandidate {
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
pub struct DesktopAlbumArtworkUpdateResponse {
    pub(crate) album_id: i64,
    pub(crate) artwork_path: Option<String>,
    pub(crate) candidates: Vec<DesktopAlbumArtworkCandidate>,
    pub(crate) embedded_updated: i64,
    pub(crate) errors: Vec<String>,
}

