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
    replaygain_track_gain_db: float | None = None
    replaygain_album_gain_db: float | None = None
    replaygain_track_peak: float | None = None
    replaygain_album_peak: float | None = None
    audio_fingerprint: str | None = None
    acoustic_fingerprint: str | None = None
    acoustic_fingerprint_updated_at: str | None = None
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
    artwork_path: str | None = None
    track_count: int = 0
    expected_track_count: int | None = None
    missing_track_count: int = 0
    duration_seconds: float | None = None
    average_rating: float | None = None
    artwork_track_id: int | None = None


class AlbumArtworkCandidate(BaseModel):
    source: Literal["selected", "sidecar", "embedded", "web"]
    label: str
    path: str | None = None
    track_id: int | None = None
    artwork_url: str | None = None
    thumbnail_url: str | None = None
    release_id: str | None = None
    media_type: str | None = None
    size_bytes: int | None = None
    modified_at: str | None = None
    selected: bool = False


class AlbumArtworkCandidatesResponse(BaseModel):
    album_id: int
    candidates: list[AlbumArtworkCandidate] = Field(default_factory=list)


class AlbumArtworkSearchResponse(BaseModel):
    album_id: int
    candidates: list[AlbumArtworkCandidate] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class AlbumArtworkUpdateRequest(BaseModel):
    artwork_path: str | None = None
    embedded_track_id: int | None = None
    artwork_url: str | None = None
    save_embedded_as_sidecar: bool = False
    save_web_as_sidecar: bool = False
    embed_to_files: bool = False
    target_track_ids: list[int] | None = Field(default=None, max_length=1000)
    sidecar_filename: str = Field(default="cover", max_length=80)
    clear: bool = False


class AlbumArtworkUpdateResponse(BaseModel):
    album_id: int
    artwork_path: str | None = None
    candidates: list[AlbumArtworkCandidate] = Field(default_factory=list)
    embedded_updated: int = 0
    errors: list[str] = Field(default_factory=list)


class AlbumArtworkCollisionIssue(BaseModel):
    album_id: int
    album: str | None = None
    album_artist: str | None = None
    folder: str
    shared_artwork_path: str | None = None
    proposed_path: str
    source: Literal["embedded", "selected", "sidecar"]
    track_count: int = 0
    reason: str
    repaired: bool = False
    error: str | None = None


class AlbumArtworkCollisionRequest(BaseModel):
    apply: bool = False
    limit: int = Field(default=200, ge=1, le=2000)


class AlbumArtworkCollisionResponse(BaseModel):
    total: int = 0
    repaired: int = 0
    issues: list[AlbumArtworkCollisionIssue] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


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
    sidecar_path: str | None = None


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
    shared_acoustic_fingerprint: bool = False
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


class InboxResponse(BaseModel):
    tracks: list[Track] = Field(default_factory=list)
    notes: list["InboxTrackNote"] = Field(default_factory=list)
    auto_review_rules: list["InboxAutoReviewRule"] = Field(default_factory=list)
    total_new: int = 0
    total_reviewed: int = 0
    limit: int = 200
    offset: int = 0


class InboxTrackNote(BaseModel):
    track_id: int
    note: str
    updated_at: str


class InboxNoteUpdateRequest(BaseModel):
    note: str | None = Field(default=None, max_length=4000)


class InboxReviewRequest(BaseModel):
    track_ids: list[int] = Field(default_factory=list, max_length=10000)
    all_new: bool = False


class InboxReviewResponse(BaseModel):
    updated: int = 0
    total_new: int = 0
    total_reviewed: int = 0


class InboxAutoReviewRuleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    enabled: bool = True
    field: Literal[
        "title",
        "artist",
        "album",
        "album_artist",
        "genre",
        "path",
        "year",
        "rating",
        "duration_seconds",
    ] = "genre"
    match_type: Literal[
        "contains",
        "equals",
        "starts_with",
        "ends_with",
        "regex",
        "is_empty",
        "is_not_empty",
    ] = "contains"
    value: str = Field(default="", max_length=500)
    note: str | None = Field(default=None, max_length=1000)
    apply_existing: bool = False

    @field_validator("name", "value", "note")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class InboxAutoReviewRule(BaseModel):
    id: int
    name: str
    enabled: bool
    field: str
    match_type: str
    value: str
    note: str | None = None
    created_at: str
    updated_at: str


class InboxAutoReviewRuleApplyResponse(BaseModel):
    rule: InboxAutoReviewRule
    applied: int = 0
    total_new: int = 0
    total_reviewed: int = 0


class InboxAutoReviewRuleDeleteResponse(BaseModel):
    deleted: bool = False
    total_new: int = 0
    total_reviewed: int = 0


class CacheClearRequest(BaseModel):
    targets: list[Literal["artist", "artwork", "metadata", "recommendation_history", "scan_errors"]] = Field(
        default_factory=lambda: ["artist", "artwork", "metadata", "recommendation_history", "scan_errors"],
        min_length=1,
        max_length=5,
    )


class CacheClearResponse(BaseModel):
    cleared: dict[str, int] = Field(default_factory=dict)


class FilenameTagInferenceRequest(BaseModel):
    pattern: str = Field(default="<Album Artist> - <Album> [<Year>]/<Track#> - <Artist> - <Title>", max_length=500)
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    missing_only: bool = True
    apply: bool = False
    limit: int = Field(default=200, ge=1, le=10000)


class FilenameTagInferencePreview(BaseModel):
    track_id: int
    path: str
    matched: bool = False
    current: dict[str, Any] = Field(default_factory=dict)
    inferred: dict[str, Any] = Field(default_factory=dict)
    changed_fields: list[str] = Field(default_factory=list)
    accepted: bool = True
    applied: bool = False
    error: str | None = None


class FilenameTagInferenceResponse(BaseModel):
    total: int = 0
    matches: int = 0
    applied: int = 0
    previews: list[FilenameTagInferencePreview] = Field(default_factory=list)


class FileOrganizationRequest(BaseModel):
    template: str = Field(default="<Album Artist>/<Album> (<Year>)/<Track#> - <Title>", max_length=500)
    base_folder: str | None = None
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    collision_strategy: Literal["skip", "auto_rename"] = "skip"
    cleanup_empty_folders: bool = False
    apply: bool = False
    limit: int = Field(default=200, ge=1, le=10000)


class FileOrganizationChange(BaseModel):
    track_id: int
    title: str | None = None
    artist: str | None = None
    current_path: str
    target_path: str
    changed: bool = False
    collision: bool = False
    applied: bool = False
    error: str | None = None


class FileOrganizationResponse(BaseModel):
    template: str
    base_folder: str
    total: int = 0
    changes: list[FileOrganizationChange] = Field(default_factory=list)
    changed_count: int = 0
    applied: int = 0
    removed_empty_folders: int = 0


class FileOrganizationReportRequest(FileOrganizationRequest):
    report_path: str | None = None


class FileOrganizationReportResponse(BaseModel):
    report_path: str
    total: int = 0
    changed_count: int = 0
    collisions: int = 0


class DeviceSyncRequest(BaseModel):
    target_folder: str
    playlist_ids: list[int] = Field(default_factory=list, max_length=200)
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    music_subfolder: str = "Music"
    playlist_subfolder: str = "Playlists"
    copy_files: bool = True
    export_playlists: bool = True
    preserve_structure: bool = True
    apply: bool = False
    limit: int = Field(default=10000, ge=1, le=200000)


class DeviceSyncChange(BaseModel):
    track_id: int
    title: str | None = None
    artist: str | None = None
    source_path: str
    target_path: str
    changed: bool = False
    applied: bool = False
    error: str | None = None


class DeviceSyncPlaylistExport(BaseModel):
    playlist_id: int
    name: str
    playlist_path: str
    track_count: int = 0
    applied: bool = False
    error: str | None = None


class DeviceSyncResponse(BaseModel):
    target_folder: str
    total_tracks: int = 0
    changed_files: int = 0
    copied_files: int = 0
    skipped_files: int = 0
    playlists_written: int = 0
    changes: list[DeviceSyncChange] = Field(default_factory=list)
    playlist_exports: list[DeviceSyncPlaylistExport] = Field(default_factory=list)


class DeviceSyncProfilePayload(BaseModel):
    name: str
    target_folder: str = ""
    device_kind: Literal["folder", "usb", "android_folder", "android_mtp"] = "folder"
    music_subfolder: str = "Music"
    playlist_subfolder: str = "Playlists"
    playlist_ids: list[int] = Field(default_factory=list, max_length=200)
    playlist_rules: dict[str, Any] = Field(default_factory=dict)
    copy_files: bool = True
    export_playlists: bool = True
    preserve_structure: bool = True

    @field_validator("name")
    @classmethod
    def sync_profile_name_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name is required")
        return cleaned[:120]


class DeviceSyncProfile(DeviceSyncProfilePayload):
    id: int
    created_at: str
    updated_at: str


class DeviceSyncProfilesResponse(BaseModel):
    profiles: list[DeviceSyncProfile] = Field(default_factory=list)
    presets: list[DeviceSyncProfilePayload] = Field(default_factory=list)


class DeviceSyncDetectedDevice(BaseModel):
    id: str
    label: str
    root_path: str
    device_kind: str
    drive_type: int | None = None
    size_bytes: int | None = None
    free_bytes: int | None = None
    writable: bool = False
    hint: str | None = None


class DeviceSyncDevicesResponse(BaseModel):
    devices: list[DeviceSyncDetectedDevice] = Field(default_factory=list)
    mtp_supported: bool = False
    message: str


class CsvMetadataExportRequest(BaseModel):
    csv_path: str | None = None
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    limit: int = Field(default=100000, ge=1, le=500000)


class CsvMetadataExportResponse(BaseModel):
    csv_path: str
    track_count: int
    columns: list[str] = Field(default_factory=list)


class CsvMetadataImportRequest(BaseModel):
    csv_path: str
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    column_map: dict[str, str] = Field(default_factory=dict)
    missing_only: bool = True
    clear_blank_fields: bool = False
    apply: bool = False
    limit: int = Field(default=10000, ge=1, le=100000)


class CsvMetadataImportPreview(BaseModel):
    row_number: int
    track_id: int | None = None
    path: str | None = None
    matched: bool = False
    current: dict[str, Any] = Field(default_factory=dict)
    imported: dict[str, Any] = Field(default_factory=dict)
    changed_fields: list[str] = Field(default_factory=list)
    conflict_fields: list[str] = Field(default_factory=list)
    applied: bool = False
    error: str | None = None


class CsvMetadataImportResponse(BaseModel):
    csv_path: str
    total: int = 0
    matched: int = 0
    changed: int = 0
    applied: int = 0
    errors: list[str] = Field(default_factory=list)
    previews: list[CsvMetadataImportPreview] = Field(default_factory=list)


class CsvMetadataImportReportRequest(CsvMetadataImportRequest):
    report_path: str | None = None


class CsvMetadataImportReportResponse(BaseModel):
    report_path: str
    csv_path: str
    total: int = 0
    matched: int = 0
    changed: int = 0
    errors: int = 0


class TagRegexReplaceRequest(BaseModel):
    field: Literal["title", "artist", "album", "album_artist", "genre"]
    pattern: str = Field(min_length=1, max_length=500)
    replacement: str = Field(default="", max_length=500)
    case_sensitive: bool = False
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    apply: bool = False
    limit: int = Field(default=10000, ge=1, le=100000)


class TagRegexReplacePreview(BaseModel):
    track_id: int
    path: str
    field: str
    current: str | None = None
    replacement: str | None = None
    changed: bool = False
    applied: bool = False
    error: str | None = None


class TagRegexReplaceResponse(BaseModel):
    total: int = 0
    changed: int = 0
    applied: int = 0
    previews: list[TagRegexReplacePreview] = Field(default_factory=list)


class RegexTagPresetRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    field: Literal["title", "artist", "album", "album_artist", "genre"]
    pattern: str = Field(min_length=1, max_length=500)
    replacement: str = Field(default="", max_length=500)
    case_sensitive: bool = False

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return value.strip()


class RegexTagPreset(BaseModel):
    id: int
    name: str
    field: str
    pattern: str
    replacement: str
    case_sensitive: bool = False
    created_at: str
    updated_at: str


class CustomTagBatchRequest(BaseModel):
    action: Literal["set", "delete"] = "set"
    tag_key: str = Field(min_length=1, max_length=80)
    value: str | None = Field(default=None, max_length=2000)
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    apply: bool = False
    limit: int = Field(default=10000, ge=1, le=100000)

    @field_validator("tag_key")
    @classmethod
    def clean_tag_key(cls, value: str) -> str:
        return value.strip()


class CustomTagBatchPreview(BaseModel):
    track_id: int
    path: str
    tag_key: str
    current: str | None = None
    value: str | None = None
    changed: bool = False
    applied: bool = False
    error: str | None = None


class CustomTagBatchResponse(BaseModel):
    total: int = 0
    changed: int = 0
    applied: int = 0
    previews: list[CustomTagBatchPreview] = Field(default_factory=list)


class VirtualTagDefinitionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    expression: str = Field(min_length=1, max_length=500)

    @field_validator("name", "expression")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class VirtualTagDefinition(BaseModel):
    id: int
    name: str
    expression: str
    created_at: str
    updated_at: str


class VirtualTagPreviewRequest(BaseModel):
    expression: str = Field(min_length=1, max_length=500)
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    limit: int = Field(default=200, ge=1, le=10000)

    @field_validator("expression")
    @classmethod
    def clean_expression(cls, value: str) -> str:
        return value.strip()


class VirtualTagPreview(BaseModel):
    track_id: int
    path: str
    title: str | None = None
    value: str | None = None
    error: str | None = None


class VirtualTagPreviewResponse(BaseModel):
    expression: str
    total: int = 0
    previews: list[VirtualTagPreview] = Field(default_factory=list)


class TagFieldCopySwapRequest(BaseModel):
    action: Literal["copy", "swap"] = "copy"
    source_field: str = Field(min_length=1, max_length=120)
    target_field: str = Field(min_length=1, max_length=120)
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    missing_only: bool = False
    apply: bool = False
    limit: int = Field(default=10000, ge=1, le=100000)

    @field_validator("source_field", "target_field")
    @classmethod
    def clean_field(cls, value: str) -> str:
        return value.strip()


class TagFieldCopySwapPreview(BaseModel):
    track_id: int
    path: str
    source_field: str
    target_field: str
    current_source: Any | None = None
    current_target: Any | None = None
    new_source: Any | None = None
    new_target: Any | None = None
    changed: bool = False
    applied: bool = False
    error: str | None = None


class TagFieldCopySwapResponse(BaseModel):
    total: int = 0
    changed: int = 0
    applied: int = 0
    previews: list[TagFieldCopySwapPreview] = Field(default_factory=list)


class TagBackupRequest(BaseModel):
    backup_path: str | None = None
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    include_custom_tags: bool = True
    limit: int = Field(default=100000, ge=1, le=500000)


class TagBackupResponse(BaseModel):
    backup_path: str
    track_count: int = 0
    custom_tag_count: int = 0
    created_at: str


class TagBackupSummary(BaseModel):
    backup_path: str
    file_name: str
    track_count: int = 0
    created_at: str | None = None
    size_bytes: int = 0


class TagBackupRestoreRequest(BaseModel):
    backup_path: str
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    missing_only: bool = False
    restore_custom_tags: bool = True
    apply: bool = False
    limit: int = Field(default=10000, ge=1, le=100000)


class TagBackupRestorePreview(BaseModel):
    track_id: int | None = None
    path: str | None = None
    matched: bool = False
    changed_fields: list[str] = Field(default_factory=list)
    current: dict[str, Any] = Field(default_factory=dict)
    restored: dict[str, Any] = Field(default_factory=dict)
    applied: bool = False
    error: str | None = None


class TagBackupRestoreResponse(BaseModel):
    backup_path: str
    total: int = 0
    matched: int = 0
    changed: int = 0
    applied: int = 0
    errors: list[str] = Field(default_factory=list)
    previews: list[TagBackupRestorePreview] = Field(default_factory=list)


class AutoTagRequest(BaseModel):
    mode: Literal["album", "track"] = "album"
    album_id: int | None = None
    track_ids: list[int] | None = Field(default=None, max_length=1000)
    missing_only: bool = True
    include_artwork: bool = True
    save_artwork: bool = False
    apply: bool = False
    limit: int = Field(default=50, ge=1, le=1000)
    candidate_limit: int = Field(default=3, ge=1, le=10)


class AutoTagPreview(BaseModel):
    track_id: int
    path: str
    current: dict[str, Any] = Field(default_factory=dict)
    proposed: dict[str, Any] = Field(default_factory=dict)
    changed_fields: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    match_type: Literal["album", "track"] = "track"
    source: str = "MusicBrainz"
    release_id: str | None = None
    release_title: str | None = None
    recording_id: str | None = None
    artwork_url: str | None = None
    artwork_thumbnail_url: str | None = None
    applied: bool = False
    artwork_saved: bool = False
    error: str | None = None


class AutoTagResponse(BaseModel):
    total: int = 0
    matched: int = 0
    changed: int = 0
    applied: int = 0
    artwork_matches: int = 0
    artwork_saved: int = 0
    errors: list[str] = Field(default_factory=list)
    previews: list[AutoTagPreview] = Field(default_factory=list)


class ClapGenreTagRequest(BaseModel):
    track_ids: list[int] | None = None
    missing_only: bool = True
    min_confidence: float = Field(default=0.35, ge=0.0, le=1.0)
    apply: bool = False
    write_to_file: bool | None = None
    limit: int = Field(default=200, ge=1, le=10000)


class ClapGenreTagPreview(BaseModel):
    track_id: int
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    current_genre: str | None = None
    proposed_genre: str | None = None
    confidence: float | None = None
    changed: bool = False
    applied: bool = False
    error: str | None = None


class ClapGenreTagResponse(BaseModel):
    total: int = 0
    matched: int = 0
    changed: int = 0
    applied: int = 0
    errors: list[str] = Field(default_factory=list)
    previews: list[ClapGenreTagPreview] = Field(default_factory=list)


class DuplicateActionRequest(BaseModel):
    action: Literal["keep_best", "remove_selected", "export_report"]
    track_ids: list[int] = Field(default_factory=list, max_length=10000)
    groups: list[list[int]] = Field(default_factory=list, max_length=1000)
    delete_files: bool = False
    report_path: str | None = None


class DuplicateActionResponse(BaseModel):
    action: str
    affected: int = 0
    removed_track_ids: list[int] = Field(default_factory=list)
    deleted_files: int = 0
    report_path: str | None = None
    errors: list[str] = Field(default_factory=list)


class DuplicateReviewRequest(BaseModel):
    track_ids: list[int] = Field(default_factory=list, max_length=10000)
    groups: list[list[int]] = Field(default_factory=list, max_length=1000)
    limit: int = Field(default=500, ge=1, le=5000)


class DuplicateReviewResponse(BaseModel):
    tracks: list[Track] = Field(default_factory=list)
    groups: list[DuplicateGroup] = Field(default_factory=list)
    missing_track_ids: list[int] = Field(default_factory=list)


class ChromaprintConfigRequest(BaseModel):
    fpcalc_path: str | None = None


class ChromaprintStatusResponse(BaseModel):
    available: bool = False
    configured_path: str | None = None
    resolved_path: str | None = None
    version: str | None = None
    tool_directory: str
    checked_paths: list[str] = Field(default_factory=list)
    message: str
    errors: list[str] = Field(default_factory=list)


class ChromaprintInstallRequest(BaseModel):
    source_url: str | None = None


class ChromaprintInstallResponse(BaseModel):
    installed: bool = False
    fpcalc_path: str | None = None
    source_url: str
    message: str
    errors: list[str] = Field(default_factory=list)


class AcousticFingerprintRequest(BaseModel):
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    overwrite: bool = False
    limit: int = Field(default=200, ge=1, le=10000)


class AcousticFingerprintResponse(BaseModel):
    tool_available: bool
    processed: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)


class BulkUndoLogEntry(BaseModel):
    id: int
    batch_id: str | None = None
    action_type: str
    summary: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class BulkUndoBatchEntry(BaseModel):
    batch_id: str
    action_type: str
    entries: int = 0
    summary: str
    first_created_at: str
    last_created_at: str


class BulkUndoRestoreResponse(BaseModel):
    entry_id: int
    batch_id: str | None = None
    action_type: str
    restored: bool = False
    affected_track_ids: list[int] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class ReportFileRequest(BaseModel):
    report_path: str
    max_bytes: int = Field(default=750_000, ge=1024, le=5_000_000)


class ReportFileResponse(BaseModel):
    report_path: str
    exists: bool = False
    size_bytes: int = 0
    modified_at: str | None = None
    parsed_json: Any | None = None
    raw_text: str | None = None
    truncated: bool = False
    error: str | None = None


class ScanRequest(BaseModel):
    folder_path: str | None = None
    folder_paths: list[str] = Field(default_factory=list)
    save_library_paths: list[str] = Field(default_factory=list)


class ScanResult(BaseModel):
    folder_path: str
    folder_paths: list[str] = Field(default_factory=list)
    scanned_files: int
    inserted: int
    updated: int
    removed: int = 0
    skipped: int
    errors: list[str] = Field(default_factory=list)


class ScanStartResponse(BaseModel):
    job_id: str
    folder_path: str
    folder_paths: list[str] = Field(default_factory=list)
    status: str


class ScanProgress(BaseModel):
    job_id: str
    folder_path: str
    folder_paths: list[str] = Field(default_factory=list)
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


class FolderWatchChange(BaseModel):
    id: str
    change_type: Literal["added", "modified", "removed", "moved"]
    track_id: int | None = None
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    old_path: str | None = None
    new_path: str | None = None
    previous_modified_at: str | None = None
    file_modified_at: str | None = None
    file_size: int | None = None
    detected_at: str
    summary: str


class FolderWatchNotification(BaseModel):
    id: str
    created_at: str
    title: str
    message: str
    pending_count: int = 0
    counts: dict[str, int] = Field(default_factory=dict)
    acknowledged: bool = False


class FolderWatchStatus(BaseModel):
    enabled: bool = False
    folder_path: str | None = None
    status: Literal["stopped", "idle", "scanning", "error"] = "stopped"
    interval_seconds: int = 45
    last_checked_at: str | None = None
    next_check_at: str | None = None
    pending_count: int = 0
    counts: dict[str, int] = Field(default_factory=dict)
    changes: list[FolderWatchChange] = Field(default_factory=list)
    notifications: list[FolderWatchNotification] = Field(default_factory=list)
    error: str | None = None


class FolderWatchStartRequest(BaseModel):
    folder_path: str | None = None
    interval_seconds: int = Field(default=45, ge=10, le=3600)
    limit: int = Field(default=300, ge=1, le=5000)


class FolderWatchRefreshRequest(BaseModel):
    folder_path: str | None = None
    limit: int = Field(default=300, ge=1, le=5000)


class FolderWatchApplyRequest(BaseModel):
    change_ids: list[str] = Field(default_factory=list, max_length=5000)
    apply_all: bool = False
    limit: int = Field(default=300, ge=1, le=5000)


class FolderWatchApplyResponse(BaseModel):
    applied: int = 0
    inserted: int = 0
    updated: int = 0
    removed: int = 0
    moved: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)
    status: FolderWatchStatus


class FolderWatchNotificationAckRequest(BaseModel):
    notification_ids: list[str] = Field(default_factory=list, max_length=100)
    all_notifications: bool = False


class AudioConversionSetupRequest(BaseModel):
    ffmpeg_path: str | None = None


class AudioConversionSetupResponse(BaseModel):
    available: bool = False
    configured_path: str | None = None
    resolved_path: str | None = None
    version: str | None = None
    tool_directory: str
    checked_paths: list[str] = Field(default_factory=list)
    message: str
    errors: list[str] = Field(default_factory=list)


class AudioConversionRequest(BaseModel):
    target_folder: str
    output_format: Literal["flac", "mp3", "m4a", "opus", "wav"] = "flac"
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    preserve_structure: bool = True
    copy_tags: bool = True
    copy_artwork: bool = True
    normalize_volume: bool = False
    sample_rate_hz: int | None = Field(default=None, ge=8000, le=384000)
    bitrate_kbps: int | None = Field(default=None, ge=32, le=1411)
    overwrite: bool = False
    limit: int = Field(default=200, ge=1, le=100000)

    @field_validator("target_folder")
    @classmethod
    def target_folder_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("target_folder is required")
        return cleaned


class AudioConversionChange(BaseModel):
    track_id: int
    title: str | None = None
    artist: str | None = None
    source_path: str
    target_path: str
    changed: bool = False
    collision: bool = False
    error: str | None = None


class AudioConversionPreviewResponse(BaseModel):
    target_folder: str
    total: int = 0
    changed_count: int = 0
    collisions: int = 0
    changes: list[AudioConversionChange] = Field(default_factory=list)


class AudioConversionStartResponse(BaseModel):
    job_id: str
    status: str


class AudioConversionProgress(BaseModel):
    job_id: str
    target_folder: str
    output_format: str
    status: str
    phase: str | None = None
    message: str | None = None
    total_tracks: int = 0
    processed_tracks: int = 0
    converted: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)
    current_track: str | None = None
    started_at: str
    finished_at: str | None = None
    elapsed_seconds: float
    eta_seconds: float | None = None
    percent: float
    error: str | None = None


class CdRipTrackMetadata(BaseModel):
    track_number: int = Field(ge=1, le=999)
    disc_number: int | None = Field(default=1, ge=1, le=99)
    title: str | None = None
    artist: str | None = None
    duration_seconds: float | None = None
    source_label: str | None = None


class CdRipDrive(BaseModel):
    id: str
    path: str | None = None
    label: str
    volume_name: str | None = None
    media_loaded: bool = False
    track_count: int | None = None
    tracks: list[CdRipTrackMetadata] = Field(default_factory=list)


class CdRipToolStatus(BaseModel):
    name: str
    purpose: str
    available: bool = False
    path: str | None = None
    version: str | None = None
    checked_paths: list[str] = Field(default_factory=list)


class CdRipSetupResponse(BaseModel):
    available: bool = False
    tool_directory: str
    drives: list[CdRipDrive] = Field(default_factory=list)
    tools: list[CdRipToolStatus] = Field(default_factory=list)
    ffmpeg_available: bool = False
    ffmpeg_path: str | None = None
    secure_ripping_available: bool = False
    cd_text_available: bool = False
    accuraterip_available: bool = False
    message: str
    warnings: list[str] = Field(default_factory=list)


class CdRipMetadataRequest(BaseModel):
    drive_id: str | None = None
    album_title: str | None = None
    album_artist: str | None = None
    release_id: str | None = None
    limit: int = Field(default=5, ge=1, le=10)


class CdRipReleaseCandidate(BaseModel):
    release_id: str
    title: str | None = None
    artist: str | None = None
    date: str | None = None
    year: int | None = None
    country: str | None = None
    track_count: int = 0
    confidence: float = 0.0
    artwork_thumbnail_url: str | None = None
    tracks: list[CdRipTrackMetadata] = Field(default_factory=list)


class CdRipMetadataResponse(BaseModel):
    drive_id: str | None = None
    source: str
    query: dict[str, str | None] = Field(default_factory=dict)
    candidates: list[CdRipReleaseCandidate] = Field(default_factory=list)
    cd_text_available: bool = False
    disc_id: str | None = None
    message: str
    warnings: list[str] = Field(default_factory=list)


class CdRipStartRequest(BaseModel):
    drive_id: str
    output_folder: str
    output_format: Literal["flac", "mp3", "wav"] = "flac"
    track_numbers: list[int] | None = Field(default=None, max_length=120)
    tracks: list[CdRipTrackMetadata] = Field(default_factory=list, max_length=120)
    album_title: str | None = None
    album_artist: str | None = None
    year: int | None = Field(default=None, ge=1800, le=3000)
    genre: str | None = None
    secure_mode: bool = True
    verify: bool = True
    overwrite: bool = False
    bitrate_kbps: int | None = Field(default=None, ge=32, le=1411)

    @field_validator("drive_id", "output_folder")
    @classmethod
    def cd_rip_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value is required")
        return cleaned


class CdRipStartResponse(BaseModel):
    job_id: str
    status: str


class CdRipVerificationEntry(BaseModel):
    track_number: int
    path: str
    sha256: str
    bytes: int
    accuraterip_checked: bool = False
    accuraterip_match: bool | None = None
    message: str


class CdRipProgress(BaseModel):
    job_id: str
    drive_id: str
    output_folder: str
    output_format: str
    status: str
    phase: str | None = None
    message: str | None = None
    total_tracks: int = 0
    processed_tracks: int = 0
    ripped_tracks: int = 0
    skipped_tracks: int = 0
    current_track: str | None = None
    errors: list[str] = Field(default_factory=list)
    log: list[str] = Field(default_factory=list)
    verification: list[CdRipVerificationEntry] = Field(default_factory=list)
    started_at: str
    finished_at: str | None = None
    elapsed_seconds: float
    eta_seconds: float | None = None
    percent: float
    error: str | None = None


class CdPlaybackRequest(BaseModel):
    drive_id: str | None = None
    track_number: int = Field(default=1, ge=1, le=999)


class CdPlaybackResponse(BaseModel):
    status: str
    track_number: int | None = None
    message: str


class AudiobookTrack(BaseModel):
    id: int
    path: str
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    album_artist: str | None = None
    track_number: int | None = None
    disc_number: int | None = None
    genre: str | None = None
    year: int | None = None
    duration_seconds: float | None = None
    rating: float | None = None
    play_count: int = 0
    last_played_at: str | None = None
    date_added: str
    position_seconds: float = 0
    progress_percent: float = 0
    bookmark_count: int = 0
    chapter_count: int = 0
    progress_updated_at: str | None = None


class AudiobookListResponse(BaseModel):
    total: int = 0
    tracks: list[AudiobookTrack] = Field(default_factory=list)


class AudiobookProgressRequest(BaseModel):
    position_seconds: float = Field(ge=0)
    duration_seconds: float | None = Field(default=None, ge=0)


class AudiobookProgressResponse(BaseModel):
    track_id: int
    position_seconds: float
    duration_seconds: float | None = None
    updated_at: str


class AudiobookBookmarkRequest(BaseModel):
    position_seconds: float = Field(ge=0)
    label: str = "Bookmark"
    note: str | None = None


class AudiobookBookmark(BaseModel):
    id: int
    track_id: int
    position_seconds: float
    label: str
    note: str | None = None
    created_at: str


class AudiobookChapter(BaseModel):
    id: int | None = None
    track_id: int | None = None
    chapter_index: int = Field(ge=1)
    title: str
    start_seconds: float = Field(ge=0)
    end_seconds: float | None = Field(default=None, ge=0)
    created_at: str | None = None
    updated_at: str | None = None


class AudiobookChapterUpdateRequest(BaseModel):
    chapters: list[AudiobookChapter] = Field(default_factory=list, max_length=500)


class AudiobookSyncExportRequest(BaseModel):
    track_ids: list[int] | None = Field(default=None, max_length=10000)
    limit: int = Field(default=10000, ge=1, le=100000)


class AudiobookSyncExportResponse(BaseModel):
    export_path: str
    track_count: int
    generated_at: str


class PodcastSubscriptionPayload(BaseModel):
    title: str | None = None
    feed_url: str
    site_url: str | None = None
    description: str | None = None
    auto_download: bool = False
    download_folder: str | None = None

    @field_validator("feed_url")
    @classmethod
    def podcast_feed_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("feed_url is required")
        return cleaned


class PodcastSubscription(BaseModel):
    id: int
    title: str
    feed_url: str
    site_url: str | None = None
    description: str | None = None
    auto_download: bool = False
    download_folder: str | None = None
    last_checked_at: str | None = None
    episode_count: int = 0
    downloaded_count: int = 0
    created_at: str
    updated_at: str


class PodcastEpisode(BaseModel):
    id: int
    subscription_id: int
    subscription_title: str | None = None
    track_id: int | None = None
    guid: str
    title: str
    description: str | None = None
    audio_url: str | None = None
    published_at: str | None = None
    duration_seconds: float | None = None
    local_path: str | None = None
    download_status: str = "remote"
    downloaded_at: str | None = None
    created_at: str
    updated_at: str


class PodcastRefreshResponse(BaseModel):
    subscription: PodcastSubscription
    inserted: int = 0
    updated: int = 0
    total: int = 0


class PodcastDownloadRequest(BaseModel):
    download_folder: str | None = None


class RadioStationPayload(BaseModel):
    name: str
    stream_url: str
    homepage_url: str | None = None
    genre: str | None = None
    notes: str | None = None

    @field_validator("name", "stream_url")
    @classmethod
    def radio_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value is required")
        return cleaned


class RadioStation(RadioStationPayload):
    id: int
    last_played_at: str | None = None
    created_at: str
    updated_at: str


class ScrobbleAccountRequest(BaseModel):
    enabled: bool = False
    username: str | None = None
    token: str | None = None
    api_key: str | None = None
    api_secret: str | None = None
    session_key: str | None = None


class ScrobbleAccount(BaseModel):
    service: Literal["listenbrainz", "lastfm"]
    enabled: bool = False
    username: str | None = None
    token: str | None = None
    api_key: str | None = None
    api_secret: str | None = None
    session_key: str | None = None
    updated_at: str | None = None


class ScrobbleOutboxEntry(BaseModel):
    id: int
    service: Literal["listenbrainz", "lastfm"]
    track_id: int | None = None
    event_type: Literal["played", "loved"] = "played"
    artist: str
    title: str
    album: str | None = None
    album_artist: str | None = None
    listened_at: int | None = None
    status: str
    attempts: int = 0
    last_error: str | None = None
    created_at: str
    submitted_at: str | None = None


class ScrobbleQueueHistoryRequest(BaseModel):
    service: Literal["listenbrainz", "lastfm"]
    limit: int = Field(default=100, ge=1, le=10000)


class ScrobbleQueueHistoryResponse(BaseModel):
    queued: int = 0
    considered: int = 0


class ScrobbleSubmitRequest(BaseModel):
    service: Literal["listenbrainz", "lastfm"]
    limit: int = Field(default=50, ge=1, le=500)


class ScrobbleSubmitResponse(BaseModel):
    submitted: int = 0
    failed: int = 0
    errors: list[str] = Field(default_factory=list)


class TrackLoveRequest(BaseModel):
    loved: bool = True
    source: str = "local"


class TrackLoveResponse(BaseModel):
    track_id: int
    loved: bool
    source: str
    updated_at: str


class LovedTrack(BaseModel):
    track_id: int
    loved: bool
    source: str
    updated_at: str
    title: str | None = None
    artist: str | None = None
    album: str | None = None


class ScrobbleHistoryImportRequest(BaseModel):
    csv_path: str
    apply: bool = False
    limit: int = Field(default=10000, ge=1, le=100000)


class ScrobbleHistoryImportPreview(BaseModel):
    row: int
    matched: bool = False
    track_id: int | None = None
    artist: str | None = None
    title: str | None = None
    changes: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class ScrobbleHistoryImportResponse(BaseModel):
    total: int = 0
    updated: int = 0
    previews: list[ScrobbleHistoryImportPreview] = Field(default_factory=list)


class GaplessValidationRequest(BaseModel):
    track_ids: list[int] | None = Field(default=None, max_length=500)
    album_id: int | None = None
    limit: int = Field(default=200, ge=2, le=1000)


class GaplessAudioShape(BaseModel):
    codec: str | None = None
    sample_rate: int | None = None
    channels: int | None = None
    bits_per_sample: int | None = None
    duration_seconds: float | None = None
    estimated_samples: int | None = None
    error: str | None = None


class GaplessPairValidation(BaseModel):
    left_track_id: int
    right_track_id: int
    left_title: str | None = None
    right_title: str | None = None
    left_shape: GaplessAudioShape
    right_shape: GaplessAudioShape
    metadata_compatible: bool = False
    sample_accurate_ready: bool = False
    warnings: list[str] = Field(default_factory=list)


class GaplessValidationResponse(BaseModel):
    track_count: int = 0
    pair_count: int = 0
    sample_accurate_ready_count: int = 0
    pairs: list[GaplessPairValidation] = Field(default_factory=list)
    message: str


class ExtensionManifest(BaseModel):
    id: str
    name: str
    version: str
    kind: str
    description: str | None = None
    author: str | None = None
    homepage: str | None = None
    entry: str | None = None
    entry_path: str | None = None
    directory: str
    manifest_path: str
    capabilities: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    enabled: bool = True
    valid: bool = True
    errors: list[str] = Field(default_factory=list)


class ExtensionListResponse(BaseModel):
    user_extensions_dir: str
    search_directories: list[str] = Field(default_factory=list)
    manifest_names: list[str] = Field(default_factory=list)
    extensions: list[ExtensionManifest] = Field(default_factory=list)


class LibraryStatsImportRequest(BaseModel):
    source: str = Field(pattern="^(musicbee|itunes|windows_media_player)$")
    import_path: str
    apply: bool = False
    missing_only: bool = False
    limit: int = Field(default=10000, ge=1, le=100000)


class LibraryStatsImportPreview(BaseModel):
    row_number: int
    source: str
    path: str | None = None
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    track_id: int | None = None
    matched_by: str | None = None
    imported_rating: float | None = None
    imported_play_count: int | None = None
    imported_last_played_at: str | None = None
    current_rating: float | None = None
    current_play_count: int | None = None
    current_last_played_at: str | None = None
    changed_fields: list[str] = Field(default_factory=list)
    error: str | None = None


class LibraryStatsImportResponse(BaseModel):
    source: str
    import_path: str
    total_rows: int = 0
    matched: int = 0
    changed: int = 0
    applied: int = 0
    errors: int = 0
    previews: list[LibraryStatsImportPreview] = Field(default_factory=list)


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
    write_to_file: bool | None = None

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
    auto_write_fetched_lyrics_sidecars: bool | None = None


class AutoDjRequest(BaseModel):
    queue_length: int = Field(default=25, ge=1, le=200)
    temperature: float = Field(default=0.8, ge=0.05, le=5.0)
    artist_cooldown: int = Field(default=6, ge=0, le=50)
    album_cooldown: int = Field(default=10, ge=0, le=100)
    unrated_exploration_percent: float = Field(default=12.0, ge=0.0, le=80.0)
    target_unrated_percent: float | None = Field(default=None, ge=0.0, le=80.0)
    target_exploration_percent: float | None = Field(default=None, ge=0.0, le=100.0)
    max_repeat_artist_percent: float | None = Field(default=None, ge=0.0, le=95.0)
    minimum_rating: float | None = Field(default=None, ge=0.5, le=5.0)
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


class RecommendationProfileComparisonExportResponse(BaseModel):
    export_path: str
    profile_count: int


class RecommendationProfileComparisonImportRequest(BaseModel):
    report_path: str


class RecommendationProfileComparisonImportResponse(BaseModel):
    report_path: str
    generated_at: str | None = None
    seed: int | None = None
    seed_track_id: int | None = None
    comparisons: list[RecommendationProfileComparison] = Field(default_factory=list)


class RecommendationAbQueue(BaseModel):
    label: Literal["A", "B"]
    settings: AutoDjRequest
    drift: RecommendationDrift
    tracks: list[QueueTrack]


class RecommendationAbTestRequest(BaseModel):
    base_settings: AutoDjRequest = Field(default_factory=AutoDjRequest)
    challenger_settings: AutoDjRequest | None = None
    seed_track_id: int | None = None
    seed: int | None = None


class RecommendationAbTestResponse(BaseModel):
    test_id: str
    generated_at: str
    queues: list[RecommendationAbQueue]


class RecommendationAbChoiceRequest(BaseModel):
    test_id: str | None = None
    chosen_label: Literal["A", "B"]
    chosen_track_ids: list[int] = Field(default_factory=list, max_length=500)
    rejected_track_ids: list[int] = Field(default_factory=list, max_length=500)
    feedback_weight: float = Field(default=0.35, ge=0.0, le=5.0)


class RecommendationAbChoiceResponse(BaseModel):
    status: str
    chosen_label: Literal["A", "B"]
    inserted_feedback: int = 0


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
    library_paths: list[str] = Field(default_factory=list)
    database_path: str
    suggested_music_path: str | None = None
    write_ratings_to_files: bool = False
    auto_write_fetched_lyrics_sidecars: bool = False
    extra: dict[str, Any] = Field(default_factory=dict)
