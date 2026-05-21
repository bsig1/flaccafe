from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class Track(BaseModel):
    id: int
    path: str
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    album_artist: str | None = None
    track_number: int | None = None
    disc_number: int | None = None
    genre: str | None = None
    analysis_provider: str | None = None
    analysis_model: str | None = None
    analysis_genre: str | None = None
    analysis_genre_confidence: float | None = None
    analysis_genre_tags: str | None = None
    analysis_embedding: str | None = None
    analysis_updated_at: str | None = None
    year: int | None = None
    duration_seconds: float | None = None
    bitrate: int | None = None
    audio_fingerprint: str | None = None
    rating: float | None = None
    play_count: int = 0
    skip_count: int = 0
    last_played_at: str | None = None
    last_skipped_at: str | None = None
    date_added: str
    file_modified_at: str | None = None


class TrackPage(BaseModel):
    tracks: list[Track]
    total: int
    limit: int
    offset: int


class AlbumSummary(BaseModel):
    id: int
    album: str | None = None
    album_artist: str | None = None
    year: int | None = None
    track_count: int = 0
    duration_seconds: float | None = None
    average_rating: float | None = None
    artwork_track_id: int | None = None


class PlaylistSummary(BaseModel):
    id: int
    name: str
    track_count: int = 0
    duration_seconds: float | None = None
    created_at: str
    updated_at: str


class PlaylistCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class PlaylistTrackRequest(BaseModel):
    track_ids: list[int] = Field(min_length=1, max_length=500)


class PlaylistImportRequest(BaseModel):
    playlist_path: str
    name: str | None = Field(default=None, max_length=120)


class PlaylistMoveRequest(BaseModel):
    direction: str = Field(pattern="^(up|down)$")


class SmartPlaylistRule(BaseModel):
    preset: str | None = None
    search: str | None = None
    artist: str | None = None
    album: str | None = None
    genre: str | None = None
    min_rating: float | None = Field(default=None, ge=0.5, le=5)
    max_rating: float | None = Field(default=None, ge=0.5, le=5)
    unrated_only: bool = False
    not_played_days: int | None = Field(default=None, ge=0, le=3650)
    recently_added_days: int | None = Field(default=None, ge=0, le=3650)
    max_play_count: int | None = Field(default=None, ge=0, le=100000)
    min_year: int | None = Field(default=None, ge=1900, le=2100)
    max_year: int | None = Field(default=None, ge=1900, le=2100)
    missing_metadata: bool = False
    duplicate_only: bool = False
    limit: int = Field(default=200, ge=1, le=2000)


class SmartPlaylistSummary(BaseModel):
    id: int
    name: str
    rule: SmartPlaylistRule
    created_at: str
    updated_at: str


class SmartPlaylistCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rule: SmartPlaylistRule


class LyricsResponse(BaseModel):
    track_id: int
    lyrics: str | None = None
    source: str | None = None
    is_synced: bool = False


class LyricsUpdateRequest(BaseModel):
    lyrics: str | None = Field(default=None, max_length=500_000)
    is_synced: bool = False
    target: Literal["database", "file"] = "database"
    source: str | None = Field(default=None, max_length=120)


class ArtistInfoResponse(BaseModel):
    artist_name: str
    query: str
    summary: str | None = None
    image_url: str | None = None
    page_url: str | None = None
    source: str | None = None
    found: bool = False
    from_cache: bool = False
    updated_at: str | None = None
    error: str | None = None


class PlayEventEntry(BaseModel):
    id: int
    track_id: int
    event_type: str
    timestamp: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    track: Track | None = None


class DuplicateGroup(BaseModel):
    key: str
    tracks: list[Track]
    match_reason: str = "matching title and artist"
    recommended_keep_id: int | None = None
    recommendation_reason: str | None = None
    duration_spread_seconds: float | None = None
    bitrate_spread: int | None = None
    shared_fingerprint: bool = False
    average_audio_similarity: float | None = None
    path_roots: list[str] = Field(default_factory=list)
    analyzed_tracks: int = 0


class LibraryHealthResponse(BaseModel):
    missing_files: list[Track] = Field(default_factory=list)
    missing_metadata: list[Track] = Field(default_factory=list)
    duplicate_groups: list[DuplicateGroup] = Field(default_factory=list)
    unrated_tracks: list[Track] = Field(default_factory=list)


class LibraryStatsResponse(BaseModel):
    total_tracks: int = 0
    total_albums: int = 0
    total_artists: int = 0
    total_playlists: int = 0
    rated_tracks: int = 0
    unrated_tracks: int = 0
    total_duration_seconds: float | None = None
    played_events: int = 0
    skipped_events: int = 0


class ScanRequest(BaseModel):
    folder_path: str


class ScanResult(BaseModel):
    folder_path: str
    scanned_files: int
    inserted: int
    updated: int
    removed: int = 0
    skipped: int
    errors: list[str] = Field(default_factory=list)


class ScanStartResponse(BaseModel):
    job_id: str
    folder_path: str
    status: str


class ScanProgress(BaseModel):
    job_id: str
    folder_path: str
    status: str
    total_files: int
    processed_files: int
    inserted: int
    updated: int
    removed: int = 0
    skipped: int
    errors: list[str] = Field(default_factory=list)
    current_path: str | None = None
    started_at: str
    finished_at: str | None = None
    elapsed_seconds: float
    eta_seconds: float | None = None
    percent: float
    error: str | None = None


class ClapConfigRequest(BaseModel):
    model_id: str | None = Field(default=None, max_length=200)
    cache_dir: str | None = None
    max_duration_seconds: float | None = Field(default=None, ge=5, le=180)


class ClapStatusResponse(BaseModel):
    installed: bool
    dependencies: dict[str, bool] = Field(default_factory=dict)
    dependency_errors: dict[str, str] = Field(default_factory=dict)
    model_id: str
    cache_dir: str
    max_duration_seconds: float
    model_cached: bool = False
    torch_version: str | None = None
    torch_device: str | None = None
    cuda_available: bool = False
    cuda_device_name: str | None = None
    runtime_managed: bool = False
    runtime_exists: bool = False
    runtime_dir: str | None = None
    runtime_python: str | None = None
    runtime_python_version: str | None = None
    runtime_device: str | None = None
    install_supported: bool = True
    bootstrap_python: str | None = None
    required_python: str | None = None
    message: str | None = None


class ClapInstallRequest(BaseModel):
    device: Literal["cpu", "cuda"] = "cpu"
    force: bool = False


class ClapInstallStartResponse(BaseModel):
    job_id: str
    status: str


class ClapInstallProgress(BaseModel):
    job_id: str
    device: Literal["cpu", "cuda"]
    force: bool = False
    status: str
    message: str | None = None
    current_step: int = 0
    total_steps: int = 0
    current_command: str | None = None
    log: list[str] = Field(default_factory=list)
    started_at: str
    finished_at: str | None = None
    elapsed_seconds: float
    percent: float
    error: str | None = None


class TrackAnalysisResult(BaseModel):
    track_id: int
    genre: str | None = None
    confidence: float | None = None
    tags: dict[str, float] = Field(default_factory=dict)
    provider: str = "clap"
    model: str | None = None
    updated_at: str | None = None


class AudioAnalysisCoverage(BaseModel):
    total_tracks: int = 0
    analyzed_tracks: int = 0
    unanalyzed_tracks: int = 0
    failed_tracks: int = 0
    coverage_percent: float = 0.0
    provider: str = "clap"


class AudioAnalysisError(BaseModel):
    track_id: int | None = None
    path: str | None = None
    title: str | None = None
    message: str


class AudioAnalysisStartRequest(BaseModel):
    limit: int | None = Field(default=None, ge=1, le=100000)
    overwrite: bool = False
    only_missing: bool = True
    track_ids: list[int] | None = Field(default=None, max_length=10000)


class AudioAnalysisStartResponse(BaseModel):
    job_id: str
    status: str


class AudioAnalysisProgress(BaseModel):
    job_id: str
    status: str
    phase: str | None = None
    message: str | None = None
    total_tracks: int
    processed_tracks: int
    analyzed: int
    skipped: int
    errors: list[str] = Field(default_factory=list)
    failed_tracks: list[AudioAnalysisError] = Field(default_factory=list)
    current_track: str | None = None
    model_cached_at_start: bool | None = None
    started_at: str
    finished_at: str | None = None
    elapsed_seconds: float
    eta_seconds: float | None = None
    percent: float
    error: str | None = None


class RatingRequest(BaseModel):
    rating: float | None = None

    @field_validator("rating")
    @classmethod
    def rating_must_be_star_or_empty(cls, value: float | None) -> float | None:
        if value is not None and (not 0.5 <= value <= 5 or abs(round(value * 2) - value * 2) > 1e-9):
            raise ValueError("rating must be 0.5 to 5 in half-star steps, or null")
        return value


class TrackMetadataUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    artist: str | None = Field(default=None, max_length=300)
    album: str | None = Field(default=None, max_length=300)
    album_artist: str | None = Field(default=None, max_length=300)
    track_number: int | None = Field(default=None, ge=1, le=999)
    disc_number: int | None = Field(default=None, ge=1, le=99)
    genre: str | None = Field(default=None, max_length=300)
    year: int | None = Field(default=None, ge=1000, le=9999)

    @field_validator("title", "artist", "album", "album_artist", "genre", mode="before")
    @classmethod
    def empty_text_to_none(cls, value: object) -> object | None:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value


class TrackDeleteResponse(BaseModel):
    track_id: int
    removed_from_library: bool
    deleted_file: bool = False
    file_missing: bool = False


class TrackRestoreRequest(BaseModel):
    path: str
    rating: float | None = Field(default=None, ge=0.5, le=5)


class SettingsUpdateRequest(BaseModel):
    write_ratings_to_files: bool | None = None


class AutoDjRequest(BaseModel):
    queue_length: int = Field(default=25, ge=1, le=200)
    temperature: float = Field(default=0.8, ge=0.05, le=5.0)
    artist_cooldown: int = Field(default=6, ge=0, le=50)
    album_cooldown: int = Field(default=10, ge=0, le=100)
    unrated_exploration_percent: float = Field(default=12.0, ge=0.0, le=80.0)
    recently_played_cooldown_days: int = Field(default=14, ge=0, le=3650)
    seed_track_id: int | None = None
    similarity_weight: float = Field(default=0.0, ge=0.0, le=5.0)
    rating_weight: float = Field(default=1.0, ge=0.0, le=5.0)
    recency_weight: float = Field(default=1.0, ge=0.0, le=5.0)
    skip_weight: float = Field(default=1.0, ge=0.0, le=5.0)
    exploration_weight: float = Field(default=1.0, ge=0.0, le=5.0)
    play_history_weight: float = Field(default=0.7, ge=0.0, le=5.0)
    feedback_weight: float = Field(default=0.8, ge=0.0, le=5.0)
    audio_similarity_weight: float = Field(default=2.2, ge=0.0, le=5.0)
    artist_similarity_weight: float = Field(default=1.6, ge=0.0, le=5.0)
    album_similarity_weight: float = Field(default=0.9, ge=0.0, le=5.0)
    genre_similarity_weight: float = Field(default=0.85, ge=0.0, le=5.0)
    year_similarity_weight: float = Field(default=0.45, ge=0.0, le=5.0)
    rating_similarity_weight: float = Field(default=0.25, ge=0.0, le=5.0)
    seed: int | None = None


class QueueTrack(Track):
    score: float
    reason: str
    score_breakdown: dict[str, float] = Field(default_factory=dict)


class SimilarTrack(Track):
    similarity_score: float
    similarity_reason: str
    audio_similarity: float | None = None


class AutoDjAvoidRule(BaseModel):
    id: int
    scope: Literal["track", "artist", "album", "genre"]
    target_key: str
    label: str
    created_at: str
    updated_at: str


class AutoDjAvoidRequest(BaseModel):
    scope: Literal["track", "artist", "album", "genre"]
    track_id: int | None = None
    value: str | None = Field(default=None, max_length=500)


class RecommendationFeedbackRequest(BaseModel):
    track_id: int
    event_type: Literal["play_next", "add_to_queue", "manual_play"]
    weight: float = Field(default=1.0, ge=0.0, le=5.0)


class RecommendationDrift(BaseModel):
    total_tracks: int = 0
    familiar_percent: float = 0.0
    exploration_percent: float = 0.0
    repeat_artist_percent: float = 0.0
    unrated_percent: float = 0.0
    clap_percent: float = 0.0
    average_rating: float | None = None
    unique_artists: int = 0
    unique_albums: int = 0
    warnings: list[str] = Field(default_factory=list)


class AutoDjResponse(BaseModel):
    tracks: list[QueueTrack]
    settings: AutoDjRequest
    drift: RecommendationDrift


class RecommendationProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    settings: AutoDjRequest
    is_default: bool = False


class RecommendationProfile(BaseModel):
    id: int
    name: str
    settings: AutoDjRequest
    is_default: bool = False
    created_at: str
    updated_at: str


class RecommendationRun(BaseModel):
    id: int
    settings: AutoDjRequest
    drift: RecommendationDrift
    track_ids: list[int]
    created_at: str


class RecommendationProfileComparisonRequest(BaseModel):
    profile_ids: list[int] | None = None
    seed_track_id: int | None = None
    seed: int | None = None


class RecommendationProfileComparison(BaseModel):
    profile: RecommendationProfile
    drift: RecommendationDrift
    top_tracks: list[QueueTrack]


class ExportRequest(BaseModel):
    track_ids: list[int]
    playlist_path: str | None = None


class ExportResponse(BaseModel):
    playlist_path: str
    track_count: int


class BackupResponse(BaseModel):
    backup_path: str


class DiagnosticItem(BaseModel):
    key: str
    label: str
    ok: bool
    message: str
    path: str | None = None


class StartupDiagnosticsResponse(BaseModel):
    ok: bool
    generated_at: str
    items: list[DiagnosticItem]
    log_path: str
    app_data_path: str


class LogTailResponse(BaseModel):
    path: str
    exists: bool
    lines: list[str] = Field(default_factory=list)


class SupportBundleResponse(BaseModel):
    bundle_path: str
    file_count: int


class SettingsResponse(BaseModel):
    library_path: str | None = None
    database_path: str
    suggested_music_path: str | None = None
    write_ratings_to_files: bool = False
    extra: dict[str, Any] = Field(default_factory=dict)
