from __future__ import annotations

from .ml_runtime import activate_ml_runtime

activate_ml_runtime()

import base64
import csv
import json
import logging
from logging.handlers import RotatingFileHandler
import os
import re
import shutil
import sqlite3
import subprocess
import uuid
import zipfile
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib import error as urlerror
from urllib import parse, request as urlrequest

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from mutagen import File as MutagenFile
from mutagen.flac import Picture
from mutagen.mp4 import MP4Cover

from .config import APP_STORAGE_ROOT, EXPORT_DIR, MODEL_DIR, database_path
from .database import connect, get_setting, init_db, rows_to_dicts, set_setting
from .file_tags import write_custom_tags, write_track_artwork, write_track_lyrics, write_track_metadata, write_track_rating
from . import inbox as inbox_service
from .library_tools import (
    changed_metadata,
    infer_metadata_from_filename,
    organization_target_path,
    sanitize_path_component,
)
from .library_watcher import (
    acknowledge_folder_watch_notifications,
    apply_folder_watch_changes,
    get_folder_watch_status,
    refresh_folder_watch_now,
    start_folder_watcher,
    start_folder_watcher_from_settings,
    stop_folder_watcher,
)
from .musicbrainz_autotag import cover_art_for_release, metadata_changes, parse_year, preview_auto_tags, search_releases, text_similarity
from .analysis_jobs import (
    cancel_audio_analysis_job,
    get_audio_analysis_job,
    pause_audio_analysis_job,
    resume_audio_analysis_job,
    start_audio_analysis_job,
)
from .audio_conversion_jobs import (
    cancel_audio_conversion_job,
    conversion_preview,
    ffmpeg_status,
    get_audio_conversion_job,
    resolve_ffmpeg_path,
    start_audio_conversion_job,
)
from .audiobooks import (
    add_bookmark as add_audiobook_bookmark,
    audiobook_sync_export,
    delete_bookmark as delete_audiobook_bookmark,
    list_audiobooks,
    list_bookmarks as list_audiobook_bookmarks,
    list_chapters as list_audiobook_chapters,
    replace_chapters as replace_audiobook_chapters,
    upsert_audiobook_progress,
)
from .cd_ripping import (
    cancel_cd_rip_job,
    cd_rip_setup,
    get_cd_rip_job,
    lookup_cd_metadata,
    play_cd_track,
    start_cd_rip_job,
    stop_cd_playback,
)
from .device_sync_profiles import (
    delete_device_sync_profile,
    detected_device_sync_devices,
    list_device_sync_profiles,
    save_device_sync_profile,
)
from .clap_analysis import save_config as save_clap_config
from .clap_analysis import status as clap_status
from .clap_install_jobs import get_clap_install_job, start_clap_install_job
from .playlist import export_m3u
from .podcasts import (
    delete_subscription as delete_podcast_subscription,
    download_episode,
    list_episodes as list_podcast_episodes,
    list_subscriptions as list_podcast_subscriptions,
    refresh_subscription as refresh_podcast_subscription,
    upsert_subscription as upsert_podcast_subscription,
)
from .radio import (
    delete_radio_station,
    list_radio_stations,
    mark_radio_station_played,
    save_radio_station,
)
from .recommender import (
    album_token,
    artist_tokens,
    cosine_similarity,
    event_metadata,
    generate_queue,
    normalize_token,
    parse_embedding,
    similarity_adjustment,
    text_tokens,
)
from .scanner import file_state, path_key, read_metadata, scan_folder, upsert_track
from .scan_jobs import get_scan_job, start_scan_job
from .scrobbling import (
    import_history_csv as import_scrobble_history_csv,
    list_accounts as list_scrobble_accounts,
    loved_tracks as list_loved_tracks,
    outbox as list_scrobble_outbox,
    queue_history as queue_scrobble_history,
    save_account as save_scrobble_account,
    set_loved as set_track_loved,
    submit_outbox as submit_scrobble_outbox,
)
from .schemas import (
    AlbumSummary,
    ArtistInfoResponse,
    AudioAnalysisCoverage,
    AudioAnalysisProgress,
    AudioAnalysisStartRequest,
    AudioAnalysisStartResponse,
    AudioConversionPreviewResponse,
    AudioConversionProgress,
    AudioConversionRequest,
    AudioConversionSetupRequest,
    AudioConversionSetupResponse,
    AudioConversionStartResponse,
    AudiobookBookmark,
    AudiobookBookmarkRequest,
    AudiobookChapter,
    AudiobookChapterUpdateRequest,
    AudiobookListResponse,
    AudiobookProgressRequest,
    AudiobookProgressResponse,
    AudiobookSyncExportRequest,
    AudiobookSyncExportResponse,
    CdPlaybackRequest,
    CdPlaybackResponse,
    CdRipMetadataRequest,
    CdRipMetadataResponse,
    CdRipProgress,
    CdRipSetupResponse,
    CdRipStartRequest,
    CdRipStartResponse,
    AutoDjRequest,
    AutoDjAvoidRequest,
    AutoDjAvoidRule,
    AutoDjResponse,
    AutoTagPreview,
    AutoTagRequest,
    AutoTagResponse,
    BackupResponse,
    CacheClearRequest,
    CacheClearResponse,
    AcousticFingerprintRequest,
    AcousticFingerprintResponse,
    AlbumArtworkCandidate,
    AlbumArtworkCandidatesResponse,
    AlbumArtworkCollisionIssue,
    AlbumArtworkCollisionRequest,
    AlbumArtworkCollisionResponse,
    AlbumArtworkSearchResponse,
    AlbumArtworkUpdateRequest,
    AlbumArtworkUpdateResponse,
    BulkUndoBatchEntry,
    BulkUndoLogEntry,
    BulkUndoRestoreResponse,
    ChromaprintConfigRequest,
    ChromaprintInstallRequest,
    ChromaprintInstallResponse,
    ChromaprintStatusResponse,
    ClapInstallProgress,
    ClapInstallRequest,
    ClapInstallStartResponse,
    CsvMetadataExportRequest,
    CsvMetadataExportResponse,
    CsvMetadataImportPreview,
    CsvMetadataImportReportRequest,
    CsvMetadataImportReportResponse,
    CsvMetadataImportRequest,
    CsvMetadataImportResponse,
    CustomTagBatchPreview,
    CustomTagBatchRequest,
    CustomTagBatchResponse,
    DuplicateGroup,
    DuplicateActionRequest,
    DuplicateActionResponse,
    DuplicateReviewRequest,
    DuplicateReviewResponse,
    DiagnosticItem,
    DeviceSyncChange,
    DeviceSyncDevicesResponse,
    DeviceSyncPlaylistExport,
    DeviceSyncProfile,
    DeviceSyncProfilePayload,
    DeviceSyncProfilesResponse,
    DeviceSyncRequest,
    DeviceSyncResponse,
    ExportRequest,
    ExportResponse,
    FileOrganizationChange,
    FileOrganizationReportRequest,
    FileOrganizationReportResponse,
    FileOrganizationRequest,
    FileOrganizationResponse,
    FolderWatchApplyRequest,
    FolderWatchApplyResponse,
    FolderWatchNotificationAckRequest,
    FolderWatchRefreshRequest,
    FolderWatchStartRequest,
    FolderWatchStatus,
    FilenameTagInferencePreview,
    FilenameTagInferenceRequest,
    FilenameTagInferenceResponse,
    LogTailResponse,
    ClapConfigRequest,
    ClapStatusResponse,
    LibraryHealthResponse,
    InboxResponse,
    InboxAutoReviewRule,
    InboxAutoReviewRuleApplyResponse,
    InboxAutoReviewRuleDeleteResponse,
    InboxAutoReviewRuleRequest,
    InboxNoteUpdateRequest,
    InboxTrackNote,
    InboxReviewRequest,
    InboxReviewResponse,
    LibraryStatsResponse,
    LyricsResponse,
    LyricsUpdateRequest,
    PlaylistCreateRequest,
    PlaylistImportRequest,
    PlaylistMoveRequest,
    PlaylistSummary,
    PlaylistTrackRequest,
    PlayEventEntry,
    PodcastDownloadRequest,
    PodcastEpisode,
    PodcastRefreshResponse,
    PodcastSubscription,
    PodcastSubscriptionPayload,
    RatingRequest,
    RadioStation,
    RadioStationPayload,
    ReportFileRequest,
    ReportFileResponse,
    RecommendationFeedbackRequest,
    RecommendationAbChoiceRequest,
    RecommendationAbChoiceResponse,
    RecommendationAbQueue,
    RecommendationAbTestRequest,
    RecommendationAbTestResponse,
    RecommendationDrift,
    RecommendationProfile,
    RecommendationProfileComparison,
    RecommendationProfileComparisonExportResponse,
    RecommendationProfileComparisonImportRequest,
    RecommendationProfileComparisonImportResponse,
    RecommendationProfileComparisonRequest,
    RecommendationProfileRequest,
    RecommendationRun,
    ScanRequest,
    ScanProgress,
    ScanResult,
    ScanStartResponse,
    ScrobbleAccount,
    ScrobbleAccountRequest,
    ScrobbleHistoryImportRequest,
    ScrobbleHistoryImportResponse,
    ScrobbleOutboxEntry,
    ScrobbleQueueHistoryRequest,
    ScrobbleQueueHistoryResponse,
    ScrobbleSubmitRequest,
    ScrobbleSubmitResponse,
    SettingsUpdateRequest,
    SettingsResponse,
    SmartPlaylistCreateRequest,
    SmartPlaylistRule,
    SmartPlaylistSummary,
    SimilarTrack,
    StartupDiagnosticsResponse,
    SupportBundleResponse,
    RegexTagPreset,
    RegexTagPresetRequest,
    TagRegexReplacePreview,
    TagRegexReplaceRequest,
    TagRegexReplaceResponse,
    TagBackupRequest,
    TagBackupResponse,
    TagBackupRestorePreview,
    TagBackupRestoreRequest,
    TagBackupRestoreResponse,
    TagBackupSummary,
    TagFieldCopySwapPreview,
    TagFieldCopySwapRequest,
    TagFieldCopySwapResponse,
    LovedTrack,
    TrackLoveRequest,
    TrackLoveResponse,
    Track,
    TrackDeleteResponse,
    TrackRestoreRequest,
    TrackMetadataUpdateRequest,
    TrackPage,
    VirtualTagDefinition,
    VirtualTagDefinitionRequest,
    VirtualTagPreview,
    VirtualTagPreviewRequest,
    VirtualTagPreviewResponse,
)

MEDIA_TYPES = {
    ".flac": "audio/flac",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".wav": "audio/wav",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
}

IMAGE_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

TRUE_SETTING_VALUES = {"1", "true", "yes", "on"}
EDITABLE_METADATA_FIELD_ORDER = (
    "title",
    "artist",
    "album",
    "album_artist",
    "track_number",
    "disc_number",
    "genre",
    "year",
)
EDITABLE_METADATA_FIELDS = set(EDITABLE_METADATA_FIELD_ORDER)
CSV_IMPORT_FIELDS = (*EDITABLE_METADATA_FIELD_ORDER, "rating")
TAG_TOOL_CORE_FIELDS = (*EDITABLE_METADATA_FIELD_ORDER, "rating")
TAG_BACKUP_DIR = EXPORT_DIR / "tag-backups"
METADATA_CSV_COLUMNS = [
    "id",
    "path",
    "path_key",
    "title",
    "artist",
    "album",
    "album_artist",
    "track_number",
    "disc_number",
    "genre",
    "year",
    "duration_seconds",
    "bitrate",
    "analysis_genre",
    "analysis_genre_confidence",
    "rating",
    "play_count",
    "skip_count",
    "last_played_at",
    "last_skipped_at",
    "date_added",
    "file_modified_at",
]

TRACK_COLUMNS = """
    id, path, title, artist, album, album_artist, track_number,
    disc_number, genre, analysis_provider, analysis_model, analysis_genre,
    analysis_genre_confidence, analysis_genre_tags, analysis_updated_at,
    analysis_embedding, year, duration_seconds, bitrate,
    replaygain_track_gain_db, replaygain_album_gain_db,
    replaygain_track_peak, replaygain_album_peak, audio_fingerprint,
    acoustic_fingerprint, acoustic_fingerprint_updated_at,
    rating, play_count, skip_count, last_played_at, last_skipped_at,
    date_added, file_modified_at
"""

TRACK_FIELD_NAMES = [field.strip() for field in TRACK_COLUMNS.replace("\n", " ").split(",") if field.strip()]

CHROMAPRINT_WINDOWS_URL = (
    "https://github.com/acoustid/chromaprint/releases/download/v1.6.0/"
    "chromaprint-fpcalc-1.6.0-windows-x86_64.zip"
)

TRACK_JOIN_COLUMNS = """
    tracks.id AS id, tracks.path AS path, tracks.title AS title,
    tracks.artist AS artist, tracks.album AS album, tracks.album_artist AS album_artist,
    tracks.track_number AS track_number, tracks.disc_number AS disc_number,
    tracks.genre AS genre, tracks.analysis_provider AS analysis_provider,
    tracks.analysis_model AS analysis_model, tracks.analysis_genre AS analysis_genre,
    tracks.analysis_genre_confidence AS analysis_genre_confidence,
    tracks.analysis_genre_tags AS analysis_genre_tags,
    tracks.analysis_embedding AS analysis_embedding,
    tracks.analysis_updated_at AS analysis_updated_at,
    tracks.year AS year, tracks.duration_seconds AS duration_seconds,
    tracks.bitrate AS bitrate,
    tracks.replaygain_track_gain_db AS replaygain_track_gain_db,
    tracks.replaygain_album_gain_db AS replaygain_album_gain_db,
    tracks.replaygain_track_peak AS replaygain_track_peak,
    tracks.replaygain_album_peak AS replaygain_album_peak,
    tracks.audio_fingerprint AS audio_fingerprint,
    tracks.acoustic_fingerprint AS acoustic_fingerprint,
    tracks.acoustic_fingerprint_updated_at AS acoustic_fingerprint_updated_at,
    tracks.rating AS rating, tracks.play_count AS play_count, tracks.skip_count AS skip_count,
    tracks.last_played_at AS last_played_at, tracks.last_skipped_at AS last_skipped_at,
    tracks.date_added AS date_added, tracks.file_modified_at AS file_modified_at
"""

TRACK_SORTS = {
    "path": "lower(coalesce(path, ''))",
    "title": "lower(coalesce(title, ''))",
    "artist": "lower(coalesce(artist, ''))",
    "album": "lower(coalesce(album, ''))",
    "album_artist": "lower(coalesce(album_artist, ''))",
    "track_number": "coalesce(track_number, -1)",
    "disc_number": "coalesce(disc_number, -1)",
    "genre": "lower(coalesce(analysis_genre, genre, ''))",
    "analysis_genre": "lower(coalesce(analysis_genre, ''))",
    "analysis_genre_confidence": "coalesce(analysis_genre_confidence, -1)",
    "analysis_provider": "lower(coalesce(analysis_provider, ''))",
    "analysis_updated_at": "coalesce(analysis_updated_at, '')",
    "year": "coalesce(year, -1)",
    "bitrate": "coalesce(bitrate, -1)",
    "rating": "coalesce(rating, -1)",
    "duration_seconds": "coalesce(duration_seconds, -1)",
    "play_count": "coalesce(play_count, 0)",
    "skip_count": "coalesce(skip_count, 0)",
    "last_played_at": "coalesce(last_played_at, '')",
    "last_skipped_at": "coalesce(last_skipped_at, '')",
    "date_added": "coalesce(date_added, '')",
    "file_modified_at": "coalesce(file_modified_at, '')",
}

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
LRCLIB_API_URL = "https://lrclib.net/api/get"
LRCLIB_SEARCH_URL = "https://lrclib.net/api/search"
WIKIPEDIA_USER_AGENT = "FLACCafe/0.1 (local desktop music app)"
LOGGER = logging.getLogger("flac_cafe.backend")


def backend_log_path() -> Path:
    return APP_STORAGE_ROOT / "logs" / "backend.log"


def configure_backend_file_logging() -> Path:
    log_path = backend_log_path()
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        root = logging.getLogger()
        resolved = str(log_path.resolve())
        if not any(isinstance(handler, RotatingFileHandler) and handler.baseFilename == resolved for handler in root.handlers):
            handler = RotatingFileHandler(log_path, maxBytes=1_500_000, backupCount=3, encoding="utf-8")
            handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
            root.addHandler(handler)
        if root.level == logging.NOTSET:
            root.setLevel(logging.INFO)
        LOGGER.info("Backend logging ready at %s", log_path)
    except OSError:
        LOGGER.exception("Could not initialize backend file logging")
    return log_path


def suggested_music_path() -> str | None:
    music_dir = Path.home() / "Music"
    return str(music_dir) if music_dir.exists() and music_dir.is_dir() else None


def diagnostic_item(key: str, label: str, path: Path | str | None, check) -> DiagnosticItem:
    try:
        message = check()
        return DiagnosticItem(key=key, label=label, ok=True, message=message, path=str(path) if path else None)
    except Exception as exc:
        return DiagnosticItem(key=key, label=label, ok=False, message=str(exc), path=str(path) if path else None)


def _check_writable_directory(path: Path) -> str:
    path.mkdir(parents=True, exist_ok=True)
    test_path = path / ".flac-cafe-write-test.tmp"
    test_path.write_text("ok", encoding="utf-8")
    test_path.unlink(missing_ok=True)
    return "Writable"


def recent_backend_error_summary(limit: int = 500) -> str | None:
    log_path = backend_log_path()
    if not log_path.exists():
        return None
    try:
        lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-limit:]
    except OSError as exc:
        return f"Could not read backend log: {exc}"

    interesting = [
        line
        for line in lines
        if "Traceback" in line or " CRITICAL " in line or " ERROR " in line or "Exception" in line
    ]
    if not interesting:
        return None
    return interesting[-1].strip()[:500]


def _check_recent_backend_errors() -> str:
    summary = recent_backend_error_summary()
    if summary:
        raise RuntimeError(f"Recent backend error: {summary}")
    return "No recent backend errors in the current log"


def startup_diagnostics() -> StartupDiagnosticsResponse:
    log_path = configure_backend_file_logging()
    db_path = database_path()

    def check_database() -> str:
        init_db()
        with connect() as conn:
            conn.execute("SELECT 1").fetchone()
        return "SQLite database is reachable"

    def check_clap_runtime() -> str:
        status = clap_status()
        if status.get("installed"):
            device = status.get("runtime_device") or status.get("torch_device") or "available"
            return f"CLAP runtime ready ({device})"
        return status.get("message") or "Optional CLAP runtime is not installed"

    items = [
        diagnostic_item("app_data", "App data folder", APP_STORAGE_ROOT, lambda: _check_writable_directory(APP_STORAGE_ROOT)),
        diagnostic_item("database", "Database", db_path, check_database),
        diagnostic_item("logs", "Backend log", log_path, lambda: _check_writable_directory(log_path.parent)),
        diagnostic_item("models", "Model cache", MODEL_DIR, lambda: _check_writable_directory(MODEL_DIR)),
        diagnostic_item("recent_errors", "Recent backend errors", log_path, _check_recent_backend_errors),
        diagnostic_item("clap", "CLAP runtime", None, check_clap_runtime),
    ]
    return StartupDiagnosticsResponse(
        ok=all(item.ok for item in items),
        generated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        items=items,
        log_path=str(log_path),
        app_data_path=str(APP_STORAGE_ROOT),
    )


def read_log_tail(path: Path, limit: int) -> LogTailResponse:
    if not path.exists():
        return LogTailResponse(path=str(path), exists=False, lines=[])
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError as exc:
        return LogTailResponse(path=str(path), exists=True, lines=[f"Could not read log: {exc}"])
    return LogTailResponse(path=str(path), exists=True, lines=lines[-limit:])


def duplicate_keep_recommendation(tracks: list[dict]) -> tuple[int | None, str | None]:
    if not tracks:
        return None, None

    def score(track: dict) -> float:
        value = 0.0
        if track.get("rating") is not None:
            value += float(track["rating"]) * 100
        if track.get("bitrate"):
            value += min(80, int(track["bitrate"]) / 4000)
        if track.get("audio_fingerprint"):
            value += 20
        if track.get("acoustic_fingerprint"):
            value += 25
        if track.get("analysis_embedding"):
            value += 15
        if track.get("duration_seconds"):
            value += 8
        if Path(track["path"]).exists():
            value += 10
        value -= len(str(track.get("path") or "")) / 1000
        return value

    selected = max(tracks, key=score)
    reasons: list[str] = []
    if selected.get("rating") is not None:
        reasons.append(f"{selected['rating']} star rating")
    if selected.get("bitrate"):
        reasons.append(f"{round(int(selected['bitrate']) / 1000)} kbps")
    if selected.get("analysis_embedding"):
        reasons.append("has CLAP analysis")
    if selected.get("audio_fingerprint"):
        reasons.append("has file fingerprint")
    if selected.get("acoustic_fingerprint"):
        reasons.append("has acoustic fingerprint")
    return int(selected["id"]), ", ".join(reasons) if reasons else "best available metadata"


def average_embedding_similarity(tracks: list[dict]) -> float | None:
    embeddings = [parse_embedding(track.get("analysis_embedding")) for track in tracks]
    embeddings = [embedding for embedding in embeddings if embedding]
    if len(embeddings) < 2:
        return None
    values: list[float] = []
    for index, left in enumerate(embeddings):
        for right in embeddings[index + 1 :]:
            similarity = cosine_similarity(left, right)
            if similarity is not None:
                values.append(similarity)
    return round(sum(values) / len(values), 4) if values else None


def duplicate_group_from_tracks(key: str, tracks: list[dict], base_reason: str) -> DuplicateGroup:
    durations = [
        float(track["duration_seconds"])
        for track in tracks
        if isinstance(track.get("duration_seconds"), (int, float))
    ]
    bitrates = [int(track["bitrate"]) for track in tracks if isinstance(track.get("bitrate"), int)]
    fingerprints = [track.get("audio_fingerprint") for track in tracks if track.get("audio_fingerprint")]
    acoustic_fingerprints = [track.get("acoustic_fingerprint") for track in tracks if track.get("acoustic_fingerprint")]
    duration_spread = round(max(durations) - min(durations), 3) if len(durations) >= 2 else None
    bitrate_spread = max(bitrates) - min(bitrates) if len(bitrates) >= 2 else None
    shared_fingerprint = bool(fingerprints and len(set(fingerprints)) < len(fingerprints))
    shared_acoustic_fingerprint = bool(acoustic_fingerprints and len(set(acoustic_fingerprints)) < len(acoustic_fingerprints))
    path_roots = sorted({str(Path(track["path"]).parent) for track in tracks if track.get("path")})[:6]
    analyzed_tracks = sum(1 for track in tracks if track.get("analysis_embedding"))
    keep_id, keep_reason = duplicate_keep_recommendation(tracks)
    reasons = [base_reason]
    if shared_fingerprint:
        reasons.append("matching fingerprint")
    if shared_acoustic_fingerprint:
        reasons.append("matching acoustic fingerprint")
    if duration_spread is not None:
        reasons.append("same duration" if duration_spread <= 2 else f"duration spread {duration_spread:.1f}s")
    if bitrate_spread is not None:
        reasons.append("same bitrate" if bitrate_spread == 0 else f"bitrate spread {round(bitrate_spread / 1000)} kbps")
    if analyzed_tracks:
        reasons.append(f"{analyzed_tracks}/{len(tracks)} analyzed")
    return DuplicateGroup(
        key=key,
        tracks=tracks,
        match_reason=", ".join(reasons),
        recommended_keep_id=keep_id,
        recommendation_reason=keep_reason,
        duration_spread_seconds=duration_spread,
        bitrate_spread=bitrate_spread,
        shared_fingerprint=shared_fingerprint,
        shared_acoustic_fingerprint=shared_acoustic_fingerprint,
        average_audio_similarity=average_embedding_similarity(tracks),
        path_roots=path_roots,
        analyzed_tracks=analyzed_tracks,
    )


def create_support_bundle() -> SupportBundleResponse:
    configure_backend_file_logging()
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    bundle_path = EXPORT_DIR / f"flac-cafe-support-{stamp}.zip"
    files_written: list[str] = []

    with connect() as conn:
        settings_rows = rows_to_dicts(conn.execute("SELECT key, value FROM settings ORDER BY key"))
        redacted_settings = [
            {
                **row,
                "value": "[redacted path]" if "path" in row["key"] or "dir" in row["key"] else row["value"],
            }
            for row in settings_rows
        ]
        library_counts = rows_to_dicts(
            conn.execute(
                """
                SELECT
                    count(*) AS tracks,
                    count(DISTINCT album_id) AS albums,
                    count(DISTINCT lower(coalesce(artist, ''))) AS artists
                FROM tracks
                """
            )
        )[0]
        extension_counts: dict[str, int] = {}
        for row in conn.execute("SELECT path FROM tracks"):
            extension = Path(row["path"]).suffix.lower() or "(none)"
            extension_counts[extension] = extension_counts.get(extension, 0) + 1

        redacted_summary = {
            "counts": library_counts,
            "ratings": rows_to_dicts(
                conn.execute(
                    """
                    SELECT coalesce(CAST(rating AS TEXT), 'unrated') AS bucket, count(*) AS tracks
                    FROM tracks
                    GROUP BY bucket
                    ORDER BY bucket
                    """
                )
            ),
            "formats": [
                {"extension": extension, "tracks": count}
                for extension, count in sorted(extension_counts.items(), key=lambda item: (-item[1], item[0]))
            ],
            "analysis": rows_to_dicts(
                conn.execute(
                    """
                    SELECT coalesce(analysis_provider, 'none') AS provider,
                           count(*) AS tracks
                    FROM tracks
                    GROUP BY provider
                    ORDER BY tracks DESC
                    """
                )
            ),
        }
        scan_error_samples = rows_to_dicts(
            conn.execute(
                """
                SELECT path_hash, folder_hash, extension, message, created_at
                FROM scan_error_samples
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT 25
                """
            )
        )

    diagnostics = startup_diagnostics().model_dump()
    app_info = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "app_data_path": str(APP_STORAGE_ROOT),
        "database_path": str(database_path()),
        "library_counts": library_counts,
        "media_types": MEDIA_TYPES,
    }

    def add_json(archive: zipfile.ZipFile, name: str, value: object) -> None:
        archive.writestr(name, json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True))
        files_written.append(name)

    with zipfile.ZipFile(bundle_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        add_json(archive, "diagnostics.json", diagnostics)
        add_json(archive, "settings.redacted.json", redacted_settings)
        add_json(archive, "database-summary.redacted.json", redacted_summary)
        add_json(archive, "scan-errors.sample.redacted.json", scan_error_samples)
        add_json(archive, "app-info.json", app_info)

        log_dir = backend_log_path().parent
        if log_dir.exists():
            for log_file in sorted(log_dir.glob("backend.log*")):
                if log_file.is_file():
                    archive.write(log_file, f"logs/{log_file.name}")
                    files_written.append(f"logs/{log_file.name}")

    return SupportBundleResponse(bundle_path=str(bundle_path), file_count=len(files_written))


def get_track_path(track_id: int) -> Path:
    with connect() as conn:
        row = conn.execute(
            "SELECT path FROM tracks WHERE id = ?",
            (track_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")

    path = Path(row["path"])
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    return path


def setting_enabled(value: str | None) -> bool:
    return (value or "").strip().lower() in TRUE_SETTING_VALUES


def get_write_ratings_to_files(conn) -> bool:
    return setting_enabled(get_setting(conn, "write_ratings_to_files"))


def delete_orphan_albums(conn) -> None:
    conn.execute(
        """
        DELETE FROM albums
        WHERE id NOT IN (
            SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL
        )
        """
    )


def ensure_album_for_track(conn, values: dict) -> int | None:
    album = values.get("album")
    if not album:
        return None
    album_artist = values.get("album_artist") or values.get("artist")
    year = values.get("year")
    conn.execute(
        """
        INSERT OR IGNORE INTO albums(album, album_artist, year)
        VALUES(?, ?, ?)
        """,
        (album, album_artist, year),
    )
    row = conn.execute(
        """
        SELECT id FROM albums
        WHERE album IS ? AND album_artist IS ? AND year IS ?
        """,
        (album, album_artist, year),
    ).fetchone()
    return None if row is None else int(row["id"])


def track_where_clause(search: str) -> tuple[str, list[object]]:
    if not search.strip():
        return "", []
    return (
        """
        WHERE lower(coalesce(title, '') || ' ' || coalesce(artist, '') || ' ' ||
                    coalesce(album, '') || ' ' || coalesce(genre, '') || ' ' ||
                    coalesce(analysis_genre, '')) LIKE ?
        """,
        [f"%{search.strip().lower()}%"],
    )


def track_order_clause(sort_by: str, sort_direction: str) -> str:
    sort_expression = TRACK_SORTS.get(sort_by, TRACK_SORTS["artist"])
    direction = "DESC" if sort_direction.lower() == "desc" else "ASC"
    return (
        f"ORDER BY {sort_expression} {direction}, "
        "lower(coalesce(artist, '')) ASC, lower(coalesce(album, '')) ASC, "
        "disc_number ASC, track_number ASC, lower(coalesce(title, '')) ASC, id ASC"
    )


def query_tracks(
    search: str,
    limit: int | None,
    offset: int,
    sort_by: str,
    sort_direction: str,
) -> tuple[list[dict], int]:
    where_clause, params = track_where_clause(search)
    order_clause = track_order_clause(sort_by, sort_direction)
    query = f"SELECT {TRACK_COLUMNS} FROM tracks {where_clause} {order_clause}"
    query_params = list(params)
    if limit is not None:
        query += " LIMIT ? OFFSET ?"
        query_params.extend([limit, offset])
    elif offset:
        query += " LIMIT -1 OFFSET ?"
        query_params.append(offset)

    with connect() as conn:
        total = conn.execute(f"SELECT count(*) AS count FROM tracks {where_clause}", params).fetchone()["count"]
        rows = rows_to_dicts(conn.execute(query, query_params))
    return rows, total


def playlist_tracks(playlist_id: int) -> list[dict]:
    with connect() as conn:
        row = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Playlist not found")
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_JOIN_COLUMNS}
                FROM playlist_tracks
                JOIN tracks ON tracks.id = playlist_tracks.track_id
                WHERE playlist_tracks.playlist_id = ?
                ORDER BY playlist_tracks.position ASC, playlist_tracks.id ASC
                """,
                (playlist_id,),
            )
        )


def compact_playlist_positions(conn, playlist_id: int) -> None:
    rows = conn.execute(
        """
        SELECT id
        FROM playlist_tracks
        WHERE playlist_id = ?
        ORDER BY position ASC, id ASC
        """,
        (playlist_id,),
    ).fetchall()
    for position, row in enumerate(rows, start=1):
        conn.execute(
            "UPDATE playlist_tracks SET position = ? WHERE id = ?",
            (position, row["id"]),
        )


SMART_PRESETS: dict[str, SmartPlaylistRule] = {
    "favorites": SmartPlaylistRule(min_rating=4, not_played_days=7, limit=200),
    "discovery": SmartPlaylistRule(unrated_only=True, limit=200),
    "deep_cuts": SmartPlaylistRule(min_rating=3, max_play_count=1, not_played_days=14, limit=200),
    "recently_added": SmartPlaylistRule(recently_added_days=45, limit=200),
    "inbox": SmartPlaylistRule(recently_added_days=30, max_play_count=0, limit=300),
    "unrated": SmartPlaylistRule(unrated_only=True, limit=200),
    "missing_metadata": SmartPlaylistRule(missing_metadata=True, limit=200),
    "duplicates": SmartPlaylistRule(duplicate_only=True, limit=300),
}


def preset_rule(name: str | None) -> SmartPlaylistRule | None:
    if not name:
        return None
    preset = SMART_PRESETS.get(name.strip().casefold())
    return preset.model_copy(update={"preset": name}) if preset else None


def smart_rule_sql(rule: SmartPlaylistRule) -> tuple[str, list[object]]:
    preset = preset_rule(rule.preset)
    if preset:
        rule = preset.model_copy(
            update={key: value for key, value in rule.model_dump().items() if value not in (None, False, "")}
        )

    clauses: list[str] = []
    params: list[object] = []

    def contains(column: str, value: str | None) -> None:
        if value and value.strip():
            clauses.append(f"lower(coalesce({column}, '')) LIKE ?")
            params.append(f"%{value.strip().lower()}%")

    contains(
        "coalesce(title, '') || ' ' || coalesce(artist, '') || ' ' || coalesce(album, '') || ' ' || coalesce(genre, '') || ' ' || coalesce(analysis_genre, '')",
        rule.search,
    )
    contains("artist", rule.artist)
    contains("album", rule.album)
    contains("coalesce(genre, '') || ' ' || coalesce(analysis_genre, '')", rule.genre)

    if rule.unrated_only:
        clauses.append("rating IS NULL")
    if rule.min_rating is not None:
        clauses.append("rating >= ?")
        params.append(rule.min_rating)
    if rule.max_rating is not None:
        clauses.append("rating <= ?")
        params.append(rule.max_rating)
    if rule.not_played_days is not None:
        clauses.append("(last_played_at IS NULL OR datetime(last_played_at) <= datetime('now', ?))")
        params.append(f"-{rule.not_played_days} days")
    if rule.recently_added_days is not None:
        clauses.append("datetime(date_added) >= datetime('now', ?)")
        params.append(f"-{rule.recently_added_days} days")
    if rule.max_play_count is not None:
        clauses.append("play_count <= ?")
        params.append(rule.max_play_count)
    if rule.min_year is not None:
        clauses.append("year >= ?")
        params.append(rule.min_year)
    if rule.max_year is not None:
        clauses.append("year <= ?")
        params.append(rule.max_year)
    if rule.missing_metadata:
        clauses.append(
            """
            (title IS NULL OR trim(title) = '' OR artist IS NULL OR trim(artist) = ''
             OR album IS NULL OR trim(album) = ''
             OR (genre IS NULL OR trim(genre) = '')
                AND (analysis_genre IS NULL OR trim(analysis_genre) = ''))
            """
        )
    if rule.duplicate_only:
        clauses.append(
            """
            id IN (
                SELECT duplicate_tracks.id
                FROM tracks AS duplicate_tracks
                JOIN (
                    SELECT lower(coalesce(title, '')) AS duplicate_title,
                           lower(coalesce(artist, '')) AS duplicate_artist
                    FROM tracks
                    GROUP BY duplicate_title, duplicate_artist
                    HAVING count(*) > 1 AND duplicate_title <> ''
                ) duplicate_keys
                ON lower(coalesce(duplicate_tracks.title, '')) = duplicate_keys.duplicate_title
                AND lower(coalesce(duplicate_tracks.artist, '')) = duplicate_keys.duplicate_artist
            )
            """
        )

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


def smart_tracks(rule: SmartPlaylistRule) -> list[dict]:
    where, params = smart_rule_sql(rule)
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                {where}
                ORDER BY coalesce(rating, 0) DESC,
                         datetime(coalesce(last_played_at, '1970-01-01')) ASC,
                         datetime(date_added) DESC,
                         lower(coalesce(artist, '')) ASC,
                         lower(coalesce(album, '')) ASC,
                         coalesce(disc_number, 0) ASC,
                         coalesce(track_number, 0) ASC
                LIMIT ?
                """,
                [*params, rule.limit],
            )
        )


def playlist_entry_path(entry: str, base_folder: Path) -> Path | None:
    text = entry.strip().strip('"').strip("'")
    if not text:
        return None
    if re.match(r"^[a-zA-Z]:[\\/]", text):
        return Path(text).expanduser().resolve()

    parsed = parse.urlparse(text)
    if parsed.scheme in {"http", "https", "icy"}:
        return None
    if parsed.scheme == "file":
        raw_path = parse.unquote(parsed.path)
        if os.name == "nt" and re.match(r"^/[a-zA-Z]:", raw_path):
            raw_path = raw_path[1:]
        if parsed.netloc and parsed.netloc.lower() != "localhost":
            raw_path = f"//{parsed.netloc}{raw_path}"
        return Path(raw_path).expanduser().resolve()
    if parsed.scheme:
        return None

    candidate = Path(parse.unquote(text))
    if not candidate.is_absolute():
        candidate = (base_folder / candidate).resolve()
    return candidate


def read_playlist_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1", errors="ignore")


def parse_m3u_paths(path: Path) -> list[Path]:
    paths: list[Path] = []
    for line in read_playlist_text(path).splitlines():
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        candidate = playlist_entry_path(text, path.parent)
        if candidate is not None:
            paths.append(candidate)
    return paths


def parse_pls_paths(path: Path) -> list[Path]:
    paths: list[Path] = []
    for line in read_playlist_text(path).splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip().lower().startswith("file"):
            candidate = playlist_entry_path(value, path.parent)
            if candidate is not None:
                paths.append(candidate)
    return paths


def xml_local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_xspf_paths(path: Path) -> list[Path]:
    try:
        root = ET.fromstring(read_playlist_text(path))
    except ET.ParseError as exc:
        raise ValueError(f"Could not parse XSPF playlist: {exc}") from exc
    paths: list[Path] = []
    for element in root.iter():
        if xml_local_name(element.tag) == "location" and element.text:
            candidate = playlist_entry_path(element.text, path.parent)
            if candidate is not None:
                paths.append(candidate)
    return paths


def parse_wpl_paths(path: Path) -> list[Path]:
    try:
        root = ET.fromstring(read_playlist_text(path))
    except ET.ParseError as exc:
        raise ValueError(f"Could not parse WPL playlist: {exc}") from exc
    paths: list[Path] = []
    for element in root.iter():
        if xml_local_name(element.tag) != "media":
            continue
        src = element.attrib.get("src")
        if src:
            candidate = playlist_entry_path(src, path.parent)
            if candidate is not None:
                paths.append(candidate)
    return paths


def parse_itunes_xml_paths(path: Path) -> list[Path]:
    try:
        root = ET.fromstring(read_playlist_text(path))
    except ET.ParseError as exc:
        raise ValueError(f"Could not parse iTunes XML: {exc}") from exc
    paths: list[Path] = []
    for parent in root.iter():
        children = list(parent)
        for index, child in enumerate(children[:-1]):
            if xml_local_name(child.tag) == "key" and (child.text or "").strip() == "Location":
                value = children[index + 1]
                if xml_local_name(value.tag) == "string" and value.text:
                    candidate = playlist_entry_path(value.text, path.parent)
                    if candidate is not None:
                        paths.append(candidate)
    return paths


def parse_playlist_paths(playlist_path: str) -> list[Path]:
    path = Path(playlist_path).expanduser().resolve()
    if not path.exists() or not path.is_file():
        raise ValueError(f"Playlist file does not exist: {path}")

    suffix = path.suffix.lower()
    if suffix in {".m3u", ".m3u8"}:
        return parse_m3u_paths(path)
    if suffix == ".pls":
        return parse_pls_paths(path)
    if suffix == ".xspf":
        return parse_xspf_paths(path)
    if suffix == ".wpl":
        return parse_wpl_paths(path)
    if suffix == ".xml":
        return parse_itunes_xml_paths(path)
    raise ValueError("Supported playlist imports: .m3u, .m3u8, .pls, .xspf, .wpl, and iTunes .xml")


def track_response(conn, track_id: int) -> dict:
    row = conn.execute(
        f"""
        SELECT {TRACK_COLUMNS}
        FROM tracks
        WHERE id = ?
        """,
        (track_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return dict(row)


def current_metadata(track: dict) -> dict[str, object | None]:
    return {field: track.get(field) for field in EDITABLE_METADATA_FIELD_ORDER}


def apply_track_metadata_update(conn, track_id: int, updates: dict[str, object]) -> dict:
    clean_updates = {key: value for key, value in updates.items() if key in EDITABLE_METADATA_FIELDS}
    row = conn.execute(f"SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")
    if not clean_updates:
        return dict(row)

    current = dict(row)
    merged = {**current, **clean_updates}
    file_modified_at = None
    if get_write_ratings_to_files(conn):
        try:
            path = Path(current["path"])
            write_track_metadata(path, {field: merged.get(field) for field in EDITABLE_METADATA_FIELDS})
            if path.exists():
                file_modified_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Could not write metadata to file: {exc}") from exc

    merged["album_id"] = ensure_album_for_track(conn, merged)
    conn.execute(
        """
        UPDATE tracks
        SET title = :title,
            artist = :artist,
            album = :album,
            album_artist = :album_artist,
            album_id = :album_id,
            track_number = :track_number,
            disc_number = :disc_number,
            genre = :genre,
            year = :year,
            file_modified_at = coalesce(:file_modified_at, file_modified_at),
            updated_at = datetime('now')
        WHERE id = :id
        """,
        {
            **merged,
            "file_modified_at": file_modified_at,
            "id": track_id,
        },
    )
    delete_orphan_albums(conn)
    return track_response(conn, track_id)


def apply_track_rating_update(conn, track_id: int, rating: float | None, record_event: bool = True) -> dict:
    row = conn.execute("SELECT id, path FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")

    file_modified_at = None
    if get_write_ratings_to_files(conn):
        try:
            path = Path(row["path"])
            write_track_rating(path, rating)
            if path.exists():
                file_modified_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Could not write rating to file: {exc}") from exc

    conn.execute(
        """
        UPDATE tracks
        SET rating = ?,
            file_modified_at = coalesce(?, file_modified_at),
            updated_at = datetime('now')
        WHERE id = ?
        """,
        (rating, file_modified_at, track_id),
    )
    if record_event:
        conn.execute(
            """
            INSERT INTO play_events(track_id, event_type, metadata_json)
            VALUES(?, 'rated', ?)
            """,
            (track_id, event_metadata(rating=rating)),
        )
    return track_response(conn, track_id)


def first_tag_value(value: object) -> object | None:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def tag_get(tags: object, key: str, default: object | None = None) -> object | None:
    if not hasattr(tags, "get"):
        return default
    try:
        return tags.get(key, default)
    except (KeyError, ValueError):
        return default


def embedded_artwork(path: Path) -> tuple[bytes, str] | None:
    try:
        audio = MutagenFile(path)
    except Exception:
        return None

    if audio is None:
        return None

    # FLAC stores pictures as parsed Picture objects on the file object.
    for picture in getattr(audio, "pictures", []) or []:
        data = getattr(picture, "data", None)
        if data:
            return data, getattr(picture, "mime", None) or "image/jpeg"

    tags = getattr(audio, "tags", None)
    if not tags:
        return None

    # MP3/ID3 stores embedded artwork in APIC frames.
    getall = getattr(tags, "getall", None)
    if callable(getall):
        for picture in getall("APIC"):
            data = getattr(picture, "data", None)
            if data:
                return data, getattr(picture, "mime", None) or "image/jpeg"

    # MP4/M4A uses the covr atom. Mutagen exposes each cover as bytes with a format marker.
    covers = first_tag_value(tag_get(tags, "covr"))
    if covers:
        media_type = "image/png" if getattr(covers, "imageformat", None) == MP4Cover.FORMAT_PNG else "image/jpeg"
        return bytes(covers), media_type

    # Ogg/Vorbis often stores a base64-encoded FLAC Picture block.
    encoded_pictures = tag_get(tags, "metadata_block_picture", []) or []
    for encoded_picture in encoded_pictures:
        try:
            picture = Picture(base64.b64decode(encoded_picture))
        except Exception:
            continue
        if picture.data:
            return picture.data, picture.mime or "image/jpeg"

    # Some older taggers use coverart/coverartmime fields instead.
    coverart = first_tag_value(tag_get(tags, "coverart"))
    if isinstance(coverart, str):
        try:
            data = base64.b64decode(coverart)
        except Exception:
            return None
        covermime = first_tag_value(tag_get(tags, "coverartmime"))
        return data, str(covermime or "image/jpeg")

    return None


def sidecar_artwork(path: Path) -> tuple[bytes, str] | None:
    preferred_names = {"cover", "folder", "front", "album", "albumart", "albumartsmall"}
    try:
        candidates = sorted(path.parent.iterdir(), key=lambda candidate: candidate.name.lower())
    except OSError:
        return None

    for candidate in candidates:
        suffix = candidate.suffix.lower()
        if suffix not in IMAGE_MEDIA_TYPES or not candidate.is_file():
            continue
        if candidate.stem.replace(" ", "").lower() in preferred_names:
            try:
                return candidate.read_bytes(), IMAGE_MEDIA_TYPES[suffix]
            except OSError:
                return None
    return None


def cached_artwork(path: Path) -> tuple[bytes, str] | None:
    modified_at, file_size = file_state(path)
    key = path_key(path)
    with connect() as conn:
        row = conn.execute(
            """
            SELECT data, media_type
            FROM artwork_cache
            WHERE path_key = ? AND file_modified_at = ? AND file_size = ?
            """,
            (key, modified_at, file_size),
        ).fetchone()
        if row is not None:
            return bytes(row["data"]), row["media_type"]

    artwork = embedded_artwork(path) or sidecar_artwork(path)
    if artwork is None:
        return None

    data, media_type = artwork
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO artwork_cache(path_key, path, file_modified_at, file_size, media_type, data, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(path_key) DO UPDATE SET
              path = excluded.path,
              file_modified_at = excluded.file_modified_at,
              file_size = excluded.file_size,
              media_type = excluded.media_type,
              data = excluded.data,
              updated_at = excluded.updated_at
            """,
            (key, str(path.resolve()), modified_at, file_size, media_type, data),
        )
        conn.commit()
    return data, media_type


def image_media_type(path: Path) -> str | None:
    return IMAGE_MEDIA_TYPES.get(path.suffix.lower())


def image_candidate(path: Path, source: str, selected_path: Path | None = None) -> AlbumArtworkCandidate | None:
    media_type = image_media_type(path)
    if media_type is None or not path.exists() or not path.is_file():
        return None
    try:
        stat = path.stat()
    except OSError:
        return None
    return AlbumArtworkCandidate(
        source=source,  # type: ignore[arg-type]
        label=path.name,
        path=str(path.resolve()),
        media_type=media_type,
        size_bytes=int(stat.st_size),
        modified_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc).replace(microsecond=0).isoformat(),
        selected=selected_path is not None and path_key(path) == path_key(selected_path),
    )


def album_record(conn, album_id: int):
    row = conn.execute("SELECT id, album, album_artist, year, artwork_path FROM albums WHERE id = ?", (album_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Album not found")
    return row


def album_track_rows(conn, album_id: int) -> list[dict]:
    album_record(conn, album_id)
    return rows_to_dicts(
        conn.execute(
            f"""
            SELECT {TRACK_COLUMNS}
            FROM tracks
            WHERE album_id = ?
            ORDER BY coalesce(disc_number, 0) ASC,
                     coalesce(track_number, 0) ASC,
                     lower(coalesce(title, '')) ASC,
                     id ASC
            """,
            (album_id,),
        )
    )


def album_artwork_candidates(conn, album_id: int) -> list[AlbumArtworkCandidate]:
    album = album_record(conn, album_id)
    selected_path = Path(album["artwork_path"]).expanduser() if album["artwork_path"] else None
    tracks = album_track_rows(conn, album_id)
    candidates: list[AlbumArtworkCandidate] = []
    seen: set[str] = set()

    def add(candidate: AlbumArtworkCandidate | None) -> None:
        if candidate is None:
            return
        identity = candidate.path or f"embedded:{candidate.track_id}"
        if identity in seen:
            return
        seen.add(identity)
        candidates.append(candidate)

    if selected_path is not None:
        add(image_candidate(selected_path, "selected", selected_path))

    folders = []
    for track in tracks:
        try:
            folder = Path(track["path"]).expanduser().parent.resolve()
        except OSError:
            continue
        if folder not in folders:
            folders.append(folder)
    preferred = {"cover", "folder", "front", "album", "albumart", "albumartsmall"}
    for folder in folders:
        try:
            images = [path for path in folder.iterdir() if path.is_file() and image_media_type(path)]
        except OSError:
            continue
        images.sort(
            key=lambda path: (
                0 if path.stem.replace(" ", "").casefold() in preferred else 1,
                path.name.casefold(),
            )
        )
        for image in images[:20]:
            add(image_candidate(image, "sidecar", selected_path))

    for track in tracks[:30]:
        path = Path(track["path"])
        if embedded_artwork(path) is None:
            continue
        candidates.append(
            AlbumArtworkCandidate(
                source="embedded",
                label=f"Embedded: {track.get('title') or path.name}",
                track_id=int(track["id"]),
                selected=selected_path is None and len(candidates) == 0,
            )
        )
    return candidates


def album_primary_folder_and_tracks(conn, album_id: int) -> tuple[Path, list[dict]]:
    tracks = album_track_rows(conn, album_id)
    if not tracks:
        raise HTTPException(status_code=404, detail="Album has no tracks")
    folders: list[Path] = []
    for track in tracks:
        folder = Path(track["path"]).expanduser().parent
        if folder not in folders:
            folders.append(folder)
    return folders[0], tracks


def album_artwork_web_candidates(conn, album_id: int, limit: int = 8) -> tuple[list[AlbumArtworkCandidate], list[str]]:
    album = album_record(conn, album_id)
    album_title = str(album["album"] or "").strip()
    artist = str(album["album_artist"] or "").strip() or None
    if not album_title:
        return [], ["Album title is missing"]

    errors: list[str] = []
    candidates: list[AlbumArtworkCandidate] = []
    seen_urls: set[str] = set()
    releases = search_releases(album_title, artist, limit)
    if not releases:
        return [], ["No MusicBrainz releases found for this album"]

    for release in releases:
        release_id = str(release.get("id") or "").strip()
        if not release_id:
            continue
        artwork = cover_art_for_release(release_id)
        if not artwork or not artwork.get("image_url"):
            continue
        image_url = str(artwork["image_url"])
        if image_url in seen_urls:
            continue
        seen_urls.add(image_url)
        release_title = str(release.get("title") or album_title)
        release_artist = release.get("artist-credit-phrase") or artist or ""
        score = text_similarity(album_title, release_title)
        if artist:
            score = (score + text_similarity(artist, release_artist)) / 2
        year = parse_year(release.get("date"))
        label_parts = [release_title]
        if release_artist:
            label_parts.append(str(release_artist))
        if year:
            label_parts.append(str(year))
        label_parts.append(f"{round(score * 100)}%")
        candidates.append(
            AlbumArtworkCandidate(
                source="web",
                label=" - ".join(label_parts),
                artwork_url=image_url,
                thumbnail_url=artwork.get("thumbnail_url") or image_url,
                release_id=release_id,
                media_type=None,
            )
        )
    if not candidates and not errors:
        errors.append("MusicBrainz matches had no Cover Art Archive front images")
    return candidates, errors


def unique_sidecar_artwork_path(folder: Path, filename: str, media_type: str) -> Path:
    suffix = ".png" if media_type == "image/png" else ".webp" if media_type == "image/webp" else ".jpg"
    base_name = sanitize_path_component(Path(filename).stem or "cover")
    candidate = folder / f"{base_name}{suffix}"
    if not candidate.exists():
        return candidate
    for index in range(2, 1000):
        candidate = folder / f"{base_name} ({index}){suffix}"
        if not candidate.exists():
            return candidate
    raise OSError("Could not find an available sidecar artwork filename")


def sidecar_filename_for_album(album: sqlite3.Row | dict, media_type: str) -> str:
    artist = sanitize_path_component(str(album["album_artist"] or "album artist"))
    title = sanitize_path_component(str(album["album"] or "album"))
    return f"cover-{artist}-{title}"


def read_local_artwork(path: Path) -> tuple[bytes, str]:
    media_type = image_media_type(path)
    if media_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise ValueError("Artwork path must be a local jpg, png, or webp file")
    return path.read_bytes(), media_type


def normalize_embeddable_artwork(data: bytes, media_type: str) -> tuple[bytes, str]:
    if media_type == "image/webp":
        raise ValueError("WebP can be saved as a sidecar, but embedded writes require JPEG or PNG")
    if media_type not in {"image/jpeg", "image/png"}:
        raise ValueError("Embedded artwork writes require JPEG or PNG")
    return data, media_type


def embed_artwork_for_album(
    conn,
    album_id: int,
    data: bytes,
    media_type: str,
    target_track_ids: list[int] | None = None,
) -> tuple[int, list[str]]:
    data, media_type = normalize_embeddable_artwork(data, media_type)
    tracks = album_track_rows(conn, album_id)
    allowed_ids = {int(track["id"]) for track in tracks}
    wanted_ids = allowed_ids if target_track_ids is None else {int(track_id) for track_id in target_track_ids} & allowed_ids
    updated = 0
    errors: list[str] = []
    for track in tracks:
        track_id = int(track["id"])
        if track_id not in wanted_ids:
            continue
        path = Path(track["path"]).expanduser()
        try:
            write_track_artwork(path, data, media_type)
            modified_at, _file_size = file_state(path)
            conn.execute(
                "UPDATE tracks SET file_modified_at = ?, updated_at = datetime('now') WHERE id = ?",
                (modified_at, track_id),
            )
            updated += 1
        except Exception as exc:
            errors.append(f"{path.name}: {exc}")
    if updated:
        conn.execute("DELETE FROM artwork_cache")
    return updated, errors


def common_sidecar_image(folder: Path) -> Path | None:
    preferred = {"cover", "folder", "front", "album", "albumart", "albumartsmall"}
    try:
        images = [path for path in folder.iterdir() if path.is_file() and image_media_type(path)]
    except OSError:
        return None
    images.sort(
        key=lambda path: (
            0 if path.stem.replace(" ", "").casefold() in preferred else 1,
            path.name.casefold(),
        )
    )
    return images[0] if images else None


def album_folder_collision_issues(conn, limit: int = 200) -> list[AlbumArtworkCollisionIssue]:
    rows = rows_to_dicts(
        conn.execute(
            """
            SELECT albums.id AS album_id,
                   albums.album,
                   albums.album_artist,
                   albums.artwork_path,
                   tracks.id AS track_id,
                   tracks.path
            FROM albums
            JOIN tracks ON tracks.album_id = albums.id
            ORDER BY lower(coalesce(albums.album_artist, '')),
                     lower(coalesce(albums.album, '')),
                     albums.id,
                     tracks.id
            """
        )
    )
    albums: dict[int, dict[str, object]] = {}
    for row in rows:
        album_id = int(row["album_id"])
        album = albums.setdefault(
            album_id,
            {
                "album_id": album_id,
                "album": row["album"],
                "album_artist": row["album_artist"],
                "artwork_path": row["artwork_path"],
                "tracks": [],
                "folders": set(),
            },
        )
        album["tracks"].append(row)  # type: ignore[index, union-attr]
        album["folders"].add(str(Path(row["path"]).expanduser().parent.resolve()))  # type: ignore[union-attr]

    by_folder: dict[str, list[dict[str, object]]] = {}
    for album in albums.values():
        folders = sorted(album["folders"])  # type: ignore[arg-type]
        if len(folders) != 1:
            continue
        by_folder.setdefault(folders[0], []).append(album)

    issues: list[AlbumArtworkCollisionIssue] = []
    for folder_text, folder_albums in sorted(by_folder.items()):
        if len(folder_albums) < 2:
            continue
        folder = Path(folder_text)
        shared_image = common_sidecar_image(folder)
        if shared_image is None:
            continue
        shared_key = path_key(shared_image)
        for album in folder_albums:
            album_id = int(album["album_id"])
            artwork_path = str(album.get("artwork_path") or "")
            if artwork_path and path_key(Path(artwork_path)) != shared_key:
                continue
            tracks = album["tracks"]  # type: ignore[assignment]
            first_embedded = next(
                (track for track in tracks if embedded_artwork(Path(track["path"])) is not None),  # type: ignore[index]
                None,
            )
            source = "embedded" if first_embedded else "sidecar"
            media_type = image_media_type(shared_image) or "image/jpeg"
            proposed = unique_sidecar_artwork_path(folder, sidecar_filename_for_album(album, media_type), media_type)
            issues.append(
                AlbumArtworkCollisionIssue(
                    album_id=album_id,
                    album=album.get("album"),  # type: ignore[arg-type]
                    album_artist=album.get("album_artist"),  # type: ignore[arg-type]
                    folder=str(folder),
                    shared_artwork_path=str(shared_image.resolve()),
                    proposed_path=str(proposed.resolve()),
                    source=source,  # type: ignore[arg-type]
                    track_count=len(tracks),  # type: ignore[arg-type]
                    reason="Multiple albums share one folder-level artwork file",
                )
            )
            if len(issues) >= limit:
                return issues
    return issues


def repair_album_artwork_collision(conn, issue: AlbumArtworkCollisionIssue) -> AlbumArtworkCollisionIssue:
    tracks = album_track_rows(conn, issue.album_id)
    data: bytes | None = None
    media_type: str | None = None
    if issue.source == "embedded":
        for track in tracks:
            artwork = embedded_artwork(Path(track["path"]))
            if artwork is not None:
                data, media_type = artwork
                break
    if data is None and issue.shared_artwork_path:
        data, media_type = read_local_artwork(Path(issue.shared_artwork_path))
    if data is None or media_type is None:
        issue.error = "No readable source artwork"
        return issue
    target = Path(issue.proposed_path)
    if target.exists():
        target = unique_sidecar_artwork_path(target.parent, target.stem, media_type)
    try:
        target.write_bytes(data)
        conn.execute("UPDATE albums SET artwork_path = ? WHERE id = ?", (str(target.resolve()), issue.album_id))
        issue.proposed_path = str(target.resolve())
        issue.repaired = True
    except Exception as exc:
        issue.error = str(exc)
    return issue


def download_cover_art(url: str) -> tuple[bytes, str]:
    request = urlrequest.Request(
        url,
        headers={
            "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
            "User-Agent": "FLAC Cafe/0.2.1 (local library auto-tag artwork; https://github.com/)",
        },
    )
    try:
        with urlrequest.urlopen(request, timeout=20) as response:
            media_type = response.headers.get_content_type()
            if media_type not in {"image/jpeg", "image/png", "image/webp"}:
                path_media_type = image_media_type(Path(parse.urlparse(response.url).path))
                media_type = path_media_type or media_type
            if media_type not in {"image/jpeg", "image/png", "image/webp"}:
                raise ValueError(f"Unsupported artwork type: {media_type}")
            data = response.read(12_000_000 + 1)
    except ValueError:
        raise
    except Exception as exc:
        raise OSError(f"Could not download artwork: {exc}") from exc
    if len(data) > 12_000_000:
        raise OSError("Artwork is larger than 12 MB")
    return data, media_type


def save_auto_tag_artwork(conn, track_id: int, release_id: str, artwork_url: str) -> str | None:
    row = conn.execute("SELECT id, path, album_id FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if row is None or row["album_id"] is None:
        return None
    path = Path(row["path"]).expanduser()
    if not path.exists() or not path.is_file():
        raise OSError("Track file is missing; artwork sidecar needs an album folder")
    data, media_type = download_cover_art(artwork_url)
    target = unique_sidecar_artwork_path(path.parent, f"cover-musicbrainz-{release_id[:8]}", media_type)
    target.write_bytes(data)
    artwork_path = str(target.resolve())
    conn.execute("UPDATE albums SET artwork_path = ? WHERE id = ?", (artwork_path, int(row["album_id"])))
    conn.execute("DELETE FROM artwork_cache")
    return artwork_path


def normalize_lyrics(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        try:
            value = value.decode("utf-8")
        except UnicodeDecodeError:
            value = value.decode("latin-1", errors="ignore")
    if isinstance(value, (list, tuple)):
        parts = [normalize_lyrics(item) for item in value]
        text = "\n".join(part for part in parts if part)
    else:
        text = str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "").strip()
    return text or None


def looks_synced(text: str | None) -> bool:
    if not text:
        return False
    return "[" in text and "]" in text and any(char.isdigit() for char in text[:40])


def embedded_lyrics(path: Path) -> tuple[str, str, bool] | None:
    try:
        audio = MutagenFile(path)
    except Exception:
        return None

    tags = getattr(audio, "tags", None) if audio is not None else None
    if not tags:
        return None

    getall = getattr(tags, "getall", None)
    if callable(getall):
        # MusicBee writes unsynced MP3 lyrics into standard ID3 USLT frames.
        for frame in getall("USLT"):
            text = normalize_lyrics(getattr(frame, "text", None))
            if text:
                return text, "embedded:USLT", False

        for frame in getall("SYLT"):
            entries = getattr(frame, "text", None)
            if entries:
                lines = []
                for entry in entries:
                    if isinstance(entry, tuple) and len(entry) >= 2:
                        lines.append(f"[{entry[1] / 1000:.2f}] {entry[0]}")
                    else:
                        normalized = normalize_lyrics(entry)
                        if normalized:
                            lines.append(normalized)
                text = normalize_lyrics(lines)
                if text:
                    return text, "embedded:SYLT", True

        # Some taggers store custom lyrics in TXXX frames.
        for frame in getall("TXXX"):
            description = str(getattr(frame, "desc", "")).lower()
            if "lyric" not in description:
                continue
            text = normalize_lyrics(getattr(frame, "text", None))
            if text:
                return text, f"embedded:TXXX:{getattr(frame, 'desc', 'lyrics')}", looks_synced(text)

    if hasattr(tags, "get"):
        exact_keys = [
            "\xa9lyr",
            "lyrics",
            "unsyncedlyrics",
            "unsynced lyrics",
            "syncedlyrics",
            "synced lyrics",
            "lyric",
        ]
        for key in exact_keys:
            text = normalize_lyrics(tag_get(tags, key))
            if text:
                return text, f"embedded:{key}", looks_synced(text)

        for key in tags.keys():
            key_text = str(key)
            if "lyric" not in key_text.lower():
                continue
            text = normalize_lyrics(tag_get(tags, key_text))
            if text:
                return text, f"embedded:{key_text}", looks_synced(text)

    return None


def sidecar_lyrics(path: Path) -> tuple[str, str, bool] | None:
    candidates = [
        path.with_suffix(".lrc"),
        path.with_suffix(".txt"),
        path.with_name(f"{path.stem}.lyrics.lrc"),
        path.with_name(f"{path.stem}.lyrics.txt"),
    ]
    for candidate in candidates:
        if not candidate.exists() or not candidate.is_file():
            continue
        try:
            text = candidate.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            text = candidate.read_text(encoding="latin-1", errors="ignore")
        except OSError:
            continue
        normalized = normalize_lyrics(text)
        if normalized:
            return normalized, f"sidecar:{candidate.name}", candidate.suffix.lower() == ".lrc" or looks_synced(normalized)
    return None


def database_lyrics(track_id: int) -> tuple[str, str, bool] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT lyrics, source, is_synced
            FROM track_lyrics
            WHERE track_id = ?
            """,
            (track_id,),
        ).fetchone()
    if row is None:
        return None
    text = normalize_lyrics(row["lyrics"])
    if not text:
        return None
    return text, row["source"] or "database:manual", bool(row["is_synced"])


def save_database_lyrics(track_id: int, lyrics: str, source: str, is_synced: bool) -> LyricsResponse:
    text = normalize_lyrics(lyrics)
    if not text:
        with connect() as conn:
            conn.execute("DELETE FROM track_lyrics WHERE track_id = ?", (track_id,))
            conn.commit()
        return LyricsResponse(track_id=track_id)

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO track_lyrics(track_id, lyrics, source, is_synced, updated_at)
            VALUES(?, ?, ?, ?, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET
              lyrics = excluded.lyrics,
              source = excluded.source,
              is_synced = excluded.is_synced,
              updated_at = excluded.updated_at
            """,
            (track_id, text, source, 1 if is_synced else 0),
        )
        conn.commit()
    return LyricsResponse(track_id=track_id, lyrics=text, source=source, is_synced=is_synced)


def lrclib_payload_response(track_id: int, payload: dict) -> LyricsResponse | None:
    synced = normalize_lyrics(payload.get("syncedLyrics"))
    plain = normalize_lyrics(payload.get("plainLyrics"))
    text = synced or plain
    if not text:
        return None
    return LyricsResponse(
        track_id=track_id,
        lyrics=text,
        source="lrclib:synced" if synced else "lrclib:plain",
        is_synced=bool(synced),
    )


def lrclib_read_json(url: str, params: dict[str, object]) -> object:
    api_request = urlrequest.Request(
        f"{url}?{parse.urlencode(params)}",
        headers={"User-Agent": WIKIPEDIA_USER_AGENT},
    )
    with urlrequest.urlopen(api_request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def lrclib_fetch(track: dict) -> LyricsResponse:
    params: dict[str, object] = {
        "track_name": display_track_title(track),
        "artist_name": primary_artist_name(track.get("artist") or ""),
    }
    if track.get("album"):
        params["album_name"] = track["album"]
    if track.get("duration_seconds"):
        params["duration"] = round(float(track["duration_seconds"]))

    last_error: Exception | None = None
    if params.get("album_name") and params.get("duration"):
        try:
            payload = lrclib_read_json(LRCLIB_API_URL, params)
            response = lrclib_payload_response(int(track["id"]), payload if isinstance(payload, dict) else {})
            if response:
                return response
        except urlerror.HTTPError as exc:
            if exc.code != 404:
                raise HTTPException(status_code=502, detail=f"Lyric lookup failed: HTTP {exc.code}") from exc
            last_error = exc
        except Exception as exc:
            last_error = exc

    search_params = {key: value for key, value in params.items() if key != "duration"}
    try:
        payload = lrclib_read_json(LRCLIB_SEARCH_URL, search_params)
    except urlerror.HTTPError as exc:
        if exc.code == 404:
            raise HTTPException(status_code=404, detail="No matching lyrics found")
        raise HTTPException(status_code=502, detail=f"Lyric lookup failed: HTTP {exc.code}") from exc
    except Exception as exc:
        detail = exc if last_error is None else last_error
        raise HTTPException(status_code=502, detail=f"Lyric lookup failed: {detail}") from exc

    candidates = payload if isinstance(payload, list) else [payload]
    for candidate in candidates:
        if isinstance(candidate, dict):
            response = lrclib_payload_response(int(track["id"]), candidate)
            if response:
                return response
    raise HTTPException(status_code=404, detail="No lyrics text found")


def display_track_title(track: dict) -> str:
    title = str(track.get("title") or Path(str(track.get("path") or "")).stem).strip()
    return title or "Untitled"


def primary_artist_name(value: str) -> str:
    artist = re.split(r"\s*[;|]\s*", value, maxsplit=1)[0].strip()
    artist = re.split(r"\s+\b(feat\.?|featuring|with)\b\s+", artist, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    return artist or value.strip()


def artist_cache_key(artist_name: str) -> str:
    return f"v2:{primary_artist_name(artist_name).casefold()}"


def wikipedia_request(params: dict[str, object]) -> dict:
    url = f"{WIKIPEDIA_API_URL}?{parse.urlencode(params)}"
    api_request = urlrequest.Request(
        url,
        headers={
            "Accept": "application/json",
            "Api-User-Agent": WIKIPEDIA_USER_AGENT,
            "User-Agent": WIKIPEDIA_USER_AGENT,
        },
    )
    with urlrequest.urlopen(api_request, timeout=6) as response:
        return json.loads(response.read().decode("utf-8"))


def is_music_summary(summary: str) -> bool:
    music_terms = [
        "band",
        "singer",
        "songwriter",
        "musician",
        "rapper",
        "record producer",
        "musical group",
        "rock",
        "pop",
        "hip hop",
        "country music",
        "electronic music",
        "jazz",
        "album",
        "grammy",
    ]
    text = summary.casefold()
    return any(term in text for term in music_terms)


def page_to_artist_info(page: dict, fallback_name: str) -> dict[str, str | None] | None:
    summary = str(page.get("extract") or "").strip()
    if not summary or not is_music_summary(summary):
        return None
    thumbnail = page.get("thumbnail") or {}
    return {
        "artist_name": str(page.get("title") or fallback_name),
        "summary": summary,
        "image_url": thumbnail.get("source"),
        "page_url": page.get("fullurl"),
        "source": "Wikipedia",
    }


def fetch_wikipedia_page_by_title(artist_name: str) -> dict[str, str | None] | None:
    payload = wikipedia_request(
        {
            "action": "query",
            "titles": artist_name,
            "prop": "extracts|pageimages|info",
            "exintro": 1,
            "explaintext": 1,
            "exchars": 1600,
            "piprop": "thumbnail",
            "pithumbsize": 900,
            "inprop": "url",
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
        },
    )
    for page in payload.get("query", {}).get("pages", []):
        if page.get("missing"):
            continue
        info = page_to_artist_info(page, artist_name)
        if info:
            return info
    return None


def fetch_artist_info_from_wikipedia(artist_name: str) -> dict[str, str | None]:
    exact_match = fetch_wikipedia_page_by_title(artist_name)
    if exact_match:
        return exact_match

    search_terms = [
        f'"{artist_name}" band',
        f'"{artist_name}" musical group',
        f'"{artist_name}" musician',
        f'"{artist_name}" singer songwriter',
        artist_name,
    ]

    for search_term in search_terms:
        payload = wikipedia_request(
            {
                "action": "query",
                "generator": "search",
                "gsrsearch": search_term,
                "gsrlimit": 1,
                "prop": "extracts|pageimages|info",
                "exintro": 1,
                "explaintext": 1,
                "exchars": 1400,
                "piprop": "thumbnail",
                "pithumbsize": 900,
                "inprop": "url",
                "redirects": 1,
                "format": "json",
                "formatversion": 2,
            },
        )
        pages = payload.get("query", {}).get("pages", [])
        if not pages:
            continue
        info = page_to_artist_info(pages[0], artist_name)
        if info:
            return info

    return {
        "artist_name": artist_name,
        "summary": None,
        "image_url": None,
        "page_url": None,
        "source": "Wikipedia",
    }


def cached_artist_info(artist_name: str, refresh: bool) -> ArtistInfoResponse | None:
    query_name = primary_artist_name(artist_name)
    key = artist_cache_key(query_name)
    cache_age_clause = "" if refresh else "AND updated_at >= datetime('now', '-30 days')"
    with connect() as conn:
        row = conn.execute(
            f"""
            SELECT artist_name, summary, image_url, page_url, source, updated_at
            FROM artist_info_cache
            WHERE artist_key = ? {cache_age_clause}
            """,
            (key,),
        ).fetchone()

    if row is None:
        return None

    return ArtistInfoResponse(
        artist_name=row["artist_name"],
        query=query_name,
        summary=row["summary"],
        image_url=row["image_url"],
        page_url=row["page_url"],
        source=row["source"],
        found=bool(row["summary"]),
        from_cache=True,
        updated_at=row["updated_at"],
    )


def stale_artist_info(artist_name: str, error: str) -> ArtistInfoResponse | None:
    query_name = primary_artist_name(artist_name)
    key = artist_cache_key(query_name)
    with connect() as conn:
        row = conn.execute(
            """
            SELECT artist_name, summary, image_url, page_url, source, updated_at
            FROM artist_info_cache
            WHERE artist_key = ?
            """,
            (key,),
        ).fetchone()

    if row is None:
        return None

    return ArtistInfoResponse(
        artist_name=row["artist_name"],
        query=query_name,
        summary=row["summary"],
        image_url=row["image_url"],
        page_url=row["page_url"],
        source=row["source"],
        found=bool(row["summary"]),
        from_cache=True,
        updated_at=row["updated_at"],
        error=error,
    )


def save_artist_info(query_name: str, info: dict[str, str | None]) -> ArtistInfoResponse:
    key = artist_cache_key(query_name)
    updated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO artist_info_cache(
                artist_key, artist_name, summary, image_url, page_url, source, updated_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(artist_key) DO UPDATE SET
                artist_name = excluded.artist_name,
                summary = excluded.summary,
                image_url = excluded.image_url,
                page_url = excluded.page_url,
                source = excluded.source,
                updated_at = excluded.updated_at
            """,
            (
                key,
                info.get("artist_name") or query_name,
                info.get("summary"),
                info.get("image_url"),
                info.get("page_url"),
                info.get("source"),
                updated_at,
            ),
        )
        conn.commit()

    return ArtistInfoResponse(
        artist_name=info.get("artist_name") or query_name,
        query=query_name,
        summary=info.get("summary"),
        image_url=info.get("image_url"),
        page_url=info.get("page_url"),
        source=info.get("source"),
        found=bool(info.get("summary")),
        from_cache=False,
        updated_at=updated_at,
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_backend_file_logging()
    init_db()
    start_folder_watcher_from_settings()
    try:
        yield
    finally:
        stop_folder_watcher(update_setting=False)


app = FastAPI(title="FLAC Cafe", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/diagnostics/startup", response_model=StartupDiagnosticsResponse)
def get_startup_diagnostics() -> StartupDiagnosticsResponse:
    return startup_diagnostics()


@app.get("/diagnostics/logs/backend", response_model=LogTailResponse)
def get_backend_log(limit: int = Query(default=200, ge=1, le=2000)) -> LogTailResponse:
    return read_log_tail(backend_log_path(), limit)


@app.post("/diagnostics/support-bundle", response_model=SupportBundleResponse)
def build_support_bundle() -> SupportBundleResponse:
    return create_support_bundle()


@app.get("/settings", response_model=SettingsResponse)
def get_settings() -> SettingsResponse:
    with connect() as conn:
        library_path = get_setting(conn, "library_path")
        write_ratings_to_files = get_write_ratings_to_files(conn)
    return SettingsResponse(
        library_path=library_path,
        database_path=str(database_path()),
        suggested_music_path=suggested_music_path(),
        write_ratings_to_files=write_ratings_to_files,
        extra={"clap": clap_status()},
    )


@app.patch("/settings", response_model=SettingsResponse)
def update_settings(request: SettingsUpdateRequest) -> SettingsResponse:
    with connect() as conn:
        if request.write_ratings_to_files is not None:
            set_setting(conn, "write_ratings_to_files", "1" if request.write_ratings_to_files else "0")
        conn.commit()
    return get_settings()


@app.get("/analysis/clap/status", response_model=ClapStatusResponse)
def get_clap_status() -> dict:
    return clap_status()


@app.post("/analysis/clap/install", response_model=ClapInstallStartResponse)
def install_clap_dependencies(request: ClapInstallRequest) -> dict:
    return start_clap_install_job(device=request.device, force=request.force)


@app.get("/analysis/clap/install/{job_id}", response_model=ClapInstallProgress)
def get_clap_install(job_id: str) -> dict:
    job = get_clap_install_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="CLAP install job not found")
    return job


@app.get("/analysis/clap/coverage", response_model=AudioAnalysisCoverage)
def get_clap_coverage() -> AudioAnalysisCoverage:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT
                count(*) AS total_tracks,
                sum(
                    CASE
                        WHEN analysis_provider = 'clap'
                         AND analysis_embedding IS NOT NULL
                         AND trim(analysis_embedding) <> ''
                        THEN 1 ELSE 0
                    END
                ) AS analyzed_tracks,
                sum(CASE WHEN analysis_provider = 'clap_failed' THEN 1 ELSE 0 END) AS failed_tracks
            FROM tracks
            """
        ).fetchone()
    total = int(row["total_tracks"] or 0)
    analyzed = int(row["analyzed_tracks"] or 0)
    failed = int(row["failed_tracks"] or 0)
    return AudioAnalysisCoverage(
        total_tracks=total,
        analyzed_tracks=analyzed,
        unanalyzed_tracks=max(0, total - analyzed),
        failed_tracks=failed,
        coverage_percent=round((analyzed / total) * 100, 2) if total else 0.0,
    )


@app.patch("/analysis/clap/config", response_model=ClapStatusResponse)
def update_clap_config(request: ClapConfigRequest) -> dict:
    save_clap_config(
        model_id=request.model_id,
        cache_dir=request.cache_dir,
        max_duration_seconds=request.max_duration_seconds,
    )
    return clap_status()


@app.post("/analysis/clap/start", response_model=AudioAnalysisStartResponse)
def start_clap_audio_analysis(request: AudioAnalysisStartRequest) -> dict:
    status = clap_status()
    if not status["installed"]:
        raise HTTPException(status_code=400, detail=status["message"] or "CLAP is not ready")
    return start_audio_analysis_job(
        limit=request.limit,
        overwrite=request.overwrite,
        only_missing=request.only_missing,
        track_ids=request.track_ids,
    )


@app.get("/analysis/clap/jobs/{job_id}", response_model=AudioAnalysisProgress)
def get_clap_audio_analysis(job_id: str) -> dict:
    job = get_audio_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/analysis/clap/jobs/{job_id}/pause", response_model=AudioAnalysisProgress)
def pause_clap_audio_analysis(job_id: str) -> dict:
    job = pause_audio_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/analysis/clap/jobs/{job_id}/resume", response_model=AudioAnalysisProgress)
def resume_clap_audio_analysis(job_id: str) -> dict:
    job = resume_audio_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/analysis/clap/jobs/{job_id}/cancel", response_model=AudioAnalysisProgress)
def cancel_clap_audio_analysis(job_id: str) -> dict:
    job = cancel_audio_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/settings/backup", response_model=BackupResponse)
def backup_database() -> BackupResponse:
    source = database_path()
    if not source.exists():
        raise HTTPException(status_code=404, detail="Database does not exist yet")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = EXPORT_DIR / f"flac-cafe-backup-{stamp}.sqlite"
    shutil.copy2(source, target)
    return BackupResponse(backup_path=str(target))


@app.get("/tracks", response_model=list[Track])
def list_tracks(
    search: str = "",
    limit: int | None = Query(default=None, ge=1, le=100000),
    offset: int = Query(default=0, ge=0),
    sort_by: str = "artist",
    sort_direction: str = "asc",
) -> list[dict]:
    tracks, _total = query_tracks(search, limit, offset, sort_by, sort_direction)
    return tracks


@app.get("/tracks/page", response_model=TrackPage)
def list_track_page(
    search: str = "",
    limit: int = Query(default=150, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    sort_by: str = "artist",
    sort_direction: str = "asc",
) -> TrackPage:
    tracks, total = query_tracks(search, limit, offset, sort_by, sort_direction)
    return TrackPage(tracks=tracks, total=total, limit=limit, offset=offset)


@app.get("/tracks/{track_id}", response_model=Track)
def get_track(track_id: int) -> dict:
    with connect() as conn:
        return track_response(conn, track_id)


@app.get("/tracks/{track_id}/similar", response_model=list[SimilarTrack])
def similar_tracks(track_id: int, limit: int = Query(default=12, ge=1, le=50)) -> list[dict]:
    with connect() as conn:
        seed = conn.execute(f"SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if seed is None:
            raise HTTPException(status_code=404, detail="Track not found")
        seed_track = dict(seed)
        rows = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE id <> ?
                """,
                (track_id,),
            )
        )

    candidates: list[dict] = []
    seed_embedding = parse_embedding(seed_track.get("analysis_embedding"))
    for track in rows:
        score, reason = similarity_adjustment(track, seed_track)
        audio_similarity = cosine_similarity(parse_embedding(track.get("analysis_embedding")), seed_embedding)
        if audio_similarity is not None and audio_similarity > 0:
            score += audio_similarity
        if score <= 0:
            continue
        candidates.append(
            {
                **track,
                "similarity_score": round(score, 4),
                "similarity_reason": reason or "metadata similarity",
                "audio_similarity": round(audio_similarity, 4) if audio_similarity is not None else None,
            }
        )

    candidates.sort(
        key=lambda track: (
            track["similarity_score"],
            track.get("rating") or 0,
            track.get("bitrate") or 0,
        ),
        reverse=True,
    )
    return candidates[:limit]


@app.patch("/tracks/{track_id}/metadata", response_model=Track)
def update_track_metadata(track_id: int, request: TrackMetadataUpdateRequest) -> dict:
    requested = request.model_dump(exclude_unset=True)
    updates = {key: value for key, value in requested.items() if key in EDITABLE_METADATA_FIELDS}
    if not updates:
        with connect() as conn:
            return track_response(conn, track_id)

    with connect() as conn:
        updated = apply_track_metadata_update(conn, track_id, updates)
        conn.commit()
        return updated


@app.delete("/tracks/{track_id}", response_model=TrackDeleteResponse)
def delete_track(track_id: int, delete_file: bool = False) -> TrackDeleteResponse:
    with connect() as conn:
        row = conn.execute("SELECT id, path FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Track not found")

        path = Path(row["path"])
        file_missing = not path.exists()
        deleted_file = False
        if delete_file and not file_missing:
            if not path.is_file():
                raise HTTPException(status_code=400, detail="Track path is not a file")
            try:
                path.unlink()
                deleted_file = True
            except OSError as exc:
                raise HTTPException(status_code=400, detail=f"Could not delete audio file: {exc}") from exc

        conn.execute("DELETE FROM tracks WHERE id = ?", (track_id,))
        delete_orphan_albums(conn)
        conn.commit()

    return TrackDeleteResponse(
        track_id=track_id,
        removed_from_library=True,
        deleted_file=deleted_file,
        file_missing=file_missing,
    )


@app.post("/tracks/restore", response_model=Track)
def restore_track(request: TrackRestoreRequest) -> dict:
    path = Path(request.path).expanduser()
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file is missing on disk")
    try:
        metadata = read_metadata(path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read track metadata: {exc}") from exc

    with connect() as conn:
        upsert_track(conn, metadata)
        row = conn.execute("SELECT id FROM tracks WHERE path_key = ?", (metadata["path_key"],)).fetchone()
        if row is None:
            raise HTTPException(status_code=400, detail="Track could not be restored")
        track_id = int(row["id"])
        if request.rating is not None:
            conn.execute(
                "UPDATE tracks SET rating = ?, updated_at = datetime('now') WHERE id = ?",
                (request.rating, track_id),
            )
        conn.commit()
        return track_response(conn, track_id)


@app.get("/history", response_model=list[PlayEventEntry])
def play_history(limit: int = Query(default=200, ge=1, le=1000)) -> list[PlayEventEntry]:
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT
                play_events.id AS event_id,
                play_events.track_id,
                play_events.event_type,
                play_events.timestamp,
                play_events.metadata_json,
                {TRACK_JOIN_COLUMNS}
            FROM play_events
            LEFT JOIN tracks ON tracks.id = play_events.track_id
            ORDER BY datetime(play_events.timestamp) DESC, play_events.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    events: list[PlayEventEntry] = []
    for row in rows:
        track = None
        if row["id"] is not None:
            track = {column: row[column] for column in Track.model_fields}
        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except json.JSONDecodeError:
            metadata = {}
        events.append(
            PlayEventEntry(
                id=row["event_id"],
                track_id=row["track_id"],
                event_type=row["event_type"],
                timestamp=row["timestamp"],
                metadata=metadata,
                track=track,
            )
        )
    return events


@app.get("/library/stats", response_model=LibraryStatsResponse)
def library_stats() -> LibraryStatsResponse:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT
                count(*) AS total_tracks,
                count(DISTINCT album_id) AS total_albums,
                count(DISTINCT lower(coalesce(artist, ''))) AS total_artists,
                sum(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) AS rated_tracks,
                sum(CASE WHEN rating IS NULL THEN 1 ELSE 0 END) AS unrated_tracks,
                sum(duration_seconds) AS total_duration_seconds
            FROM tracks
            """
        ).fetchone()
        total_playlists = conn.execute("SELECT count(*) AS count FROM playlists").fetchone()["count"]
        played_events = conn.execute(
            "SELECT count(*) AS count FROM play_events WHERE event_type = 'played'"
        ).fetchone()["count"]
        skipped_events = conn.execute(
            "SELECT count(*) AS count FROM play_events WHERE event_type = 'skipped'"
        ).fetchone()["count"]
    return LibraryStatsResponse(
        total_tracks=row["total_tracks"] or 0,
        total_albums=row["total_albums"] or 0,
        total_artists=row["total_artists"] or 0,
        total_playlists=total_playlists or 0,
        rated_tracks=row["rated_tracks"] or 0,
        unrated_tracks=row["unrated_tracks"] or 0,
        total_duration_seconds=row["total_duration_seconds"],
        played_events=played_events or 0,
        skipped_events=skipped_events or 0,
    )


def inbox_counts(conn) -> tuple[int, int]:
    return inbox_service.inbox_counts(conn)


@app.get("/library/inbox", response_model=InboxResponse)
def library_inbox(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> InboxResponse:
    with connect() as conn:
        total_new, total_reviewed = inbox_counts(conn)
        tracks = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_JOIN_COLUMNS}
                FROM tracks
                LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
                WHERE coalesce(track_inbox_state.status, 'new') = 'new'
                ORDER BY datetime(tracks.date_added) DESC,
                         tracks.id DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            )
        )
        track_ids = [int(track["id"]) for track in tracks]
        notes = inbox_service.list_inbox_notes(conn, track_ids)
        auto_review_rules = inbox_service.list_auto_review_rules(conn)
    return InboxResponse(
        tracks=tracks,
        notes=notes,
        auto_review_rules=auto_review_rules,
        total_new=total_new,
        total_reviewed=total_reviewed,
        limit=limit,
        offset=offset,
    )


@app.post("/library/inbox/review", response_model=InboxReviewResponse)
def review_inbox_tracks(request: InboxReviewRequest) -> InboxReviewResponse:
    with connect() as conn:
        if request.all_new:
            before_new, _before_reviewed = inbox_counts(conn)
            conn.execute(
                """
                INSERT INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
                SELECT tracks.id, 'reviewed', datetime('now'), datetime('now')
                FROM tracks
                LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
                WHERE track_inbox_state.track_id IS NULL
                """
            )
            conn.execute(
                """
                UPDATE track_inbox_state
                SET status = 'reviewed',
                    reviewed_at = datetime('now'),
                    updated_at = datetime('now')
                WHERE status <> 'reviewed'
                """
            )
            updated = before_new
        else:
            unique_ids = list(dict.fromkeys(request.track_ids))
            if not unique_ids:
                total_new, total_reviewed = inbox_counts(conn)
                return InboxReviewResponse(total_new=total_new, total_reviewed=total_reviewed)
            placeholders = ",".join("?" for _ in unique_ids)
            existing_ids = [
                int(row["id"])
                for row in conn.execute(
                    f"SELECT id FROM tracks WHERE id IN ({placeholders})",
                    unique_ids,
                )
            ]
            updated = 0
            for track_id in existing_ids:
                cursor = conn.execute(
                    """
                    INSERT INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
                    VALUES(?, 'reviewed', datetime('now'), datetime('now'))
                    ON CONFLICT(track_id) DO UPDATE SET
                      status = 'reviewed',
                      reviewed_at = excluded.reviewed_at,
                      updated_at = excluded.updated_at
                    WHERE track_inbox_state.status <> 'reviewed'
                    """,
                    (track_id,),
                )
                updated += int(cursor.rowcount if cursor.rowcount is not None else 0)
        conn.commit()
        total_new, total_reviewed = inbox_counts(conn)
    return InboxReviewResponse(updated=updated, total_new=total_new, total_reviewed=total_reviewed)


@app.patch("/library/inbox/notes/{track_id}", response_model=InboxTrackNote | None)
def update_inbox_note(track_id: int, request: InboxNoteUpdateRequest) -> dict | None:
    with connect() as conn:
        try:
            note = inbox_service.save_inbox_note(conn, track_id, request.note)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        conn.commit()
        return note


@app.get("/library/inbox/auto-review-rules", response_model=list[InboxAutoReviewRule])
def list_inbox_auto_review_rules() -> list[dict]:
    with connect() as conn:
        return inbox_service.list_auto_review_rules(conn)


@app.post("/library/inbox/auto-review-rules", response_model=InboxAutoReviewRuleApplyResponse)
def create_inbox_auto_review_rule(request: InboxAutoReviewRuleRequest) -> InboxAutoReviewRuleApplyResponse:
    with connect() as conn:
        try:
            rule = inbox_service.create_auto_review_rule(conn, request)
            applied = inbox_service.apply_auto_review_rules_to_new_tracks(conn, rule["id"]) if request.apply_existing else 0
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        conn.commit()
        total_new, total_reviewed = inbox_counts(conn)
    return InboxAutoReviewRuleApplyResponse(rule=rule, applied=applied, total_new=total_new, total_reviewed=total_reviewed)


@app.patch("/library/inbox/auto-review-rules/{rule_id}", response_model=InboxAutoReviewRuleApplyResponse)
def update_inbox_auto_review_rule(rule_id: int, request: InboxAutoReviewRuleRequest) -> InboxAutoReviewRuleApplyResponse:
    with connect() as conn:
        try:
            rule = inbox_service.update_auto_review_rule(conn, rule_id, request)
            applied = inbox_service.apply_auto_review_rules_to_new_tracks(conn, rule["id"]) if request.apply_existing else 0
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        conn.commit()
        total_new, total_reviewed = inbox_counts(conn)
    return InboxAutoReviewRuleApplyResponse(rule=rule, applied=applied, total_new=total_new, total_reviewed=total_reviewed)


@app.delete("/library/inbox/auto-review-rules/{rule_id}", response_model=InboxAutoReviewRuleDeleteResponse)
def delete_inbox_auto_review_rule(rule_id: int) -> InboxAutoReviewRuleDeleteResponse:
    with connect() as conn:
        deleted = inbox_service.delete_auto_review_rule(conn, rule_id)
        conn.commit()
        total_new, total_reviewed = inbox_counts(conn)
    return InboxAutoReviewRuleDeleteResponse(deleted=deleted, total_new=total_new, total_reviewed=total_reviewed)


@app.get("/library/watch", response_model=FolderWatchStatus)
def get_folder_watch(limit: int = Query(default=300, ge=1, le=5000)) -> dict:
    return get_folder_watch_status(limit)


@app.post("/library/watch/start", response_model=FolderWatchStatus)
def start_folder_watch(request: FolderWatchStartRequest) -> dict:
    folder_path = request.folder_path
    with connect() as conn:
        if not folder_path:
            folder_path = get_setting(conn, "library_path")
        if not folder_path:
            raise HTTPException(status_code=400, detail="Choose a music folder before starting folder watch")
        set_setting(conn, "folder_watch_enabled", "1")
        set_setting(conn, "folder_watch_interval_seconds", str(request.interval_seconds))
        conn.commit()

    try:
        return start_folder_watcher(folder_path, request.interval_seconds, request.limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/library/watch/stop", response_model=FolderWatchStatus)
def stop_folder_watch(limit: int = Query(default=300, ge=1, le=5000)) -> dict:
    return stop_folder_watcher(update_setting=True, limit=limit)


@app.post("/library/watch/refresh", response_model=FolderWatchStatus)
def refresh_folder_watch(request: FolderWatchRefreshRequest) -> dict:
    folder_path = request.folder_path
    if not folder_path:
        with connect() as conn:
            folder_path = get_setting(conn, "library_path")
    try:
        return refresh_folder_watch_now(folder_path, request.limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/library/watch/apply", response_model=FolderWatchApplyResponse)
def apply_folder_watch(request: FolderWatchApplyRequest) -> dict:
    try:
        return apply_folder_watch_changes(
            change_ids=request.change_ids,
            apply_all=request.apply_all,
            limit=request.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/library/watch/notifications/ack", response_model=FolderWatchStatus)
def acknowledge_folder_watch_notifications_route(request: FolderWatchNotificationAckRequest) -> dict:
    return acknowledge_folder_watch_notifications(
        notification_ids=request.notification_ids,
        all_notifications=request.all_notifications,
    )


@app.get("/library/tools/audio-conversion/setup", response_model=AudioConversionSetupResponse)
def get_audio_conversion_setup() -> AudioConversionSetupResponse:
    with connect() as conn:
        return AudioConversionSetupResponse(**ffmpeg_status(conn))


@app.patch("/library/tools/audio-conversion/setup", response_model=AudioConversionSetupResponse)
def update_audio_conversion_setup(request: AudioConversionSetupRequest) -> AudioConversionSetupResponse:
    with connect() as conn:
        text = request.ffmpeg_path.strip() if request.ffmpeg_path else ""
        if not text:
            set_setting(conn, "ffmpeg_path", None)
            conn.commit()
            return AudioConversionSetupResponse(**ffmpeg_status(conn))
        candidate = Path(text).expanduser()
        executable = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
        if candidate.is_dir():
            candidate = candidate / executable
        if not candidate.exists() or not candidate.is_file():
            status = ffmpeg_status(conn)
            status["configured_path"] = text
            status["errors"].append(f"ffmpeg was not found at {candidate}")
            status["message"] = "The saved path was not valid. Choose ffmpeg.exe or put it in the FLAC Cafe tool folder."
            return AudioConversionSetupResponse(**status)
        set_setting(conn, "ffmpeg_path", str(candidate.resolve()))
        conn.commit()
        return AudioConversionSetupResponse(**ffmpeg_status(conn))


@app.post("/library/tools/audio-conversion/preview", response_model=AudioConversionPreviewResponse)
def preview_audio_conversion(request: AudioConversionRequest) -> AudioConversionPreviewResponse:
    return AudioConversionPreviewResponse(**conversion_preview(request))


@app.post("/library/tools/audio-conversion/jobs", response_model=AudioConversionStartResponse)
def start_audio_conversion(request: AudioConversionRequest) -> AudioConversionStartResponse:
    with connect() as conn:
        ffmpeg_path, _configured, _candidates = resolve_ffmpeg_path(conn)
    if ffmpeg_path is None:
        raise HTTPException(status_code=400, detail="FFmpeg was not found. Save an ffmpeg.exe path before starting conversion.")
    job = start_audio_conversion_job(request)
    return AudioConversionStartResponse(job_id=job["job_id"], status=job["status"])


@app.get("/library/tools/audio-conversion/jobs/{job_id}", response_model=AudioConversionProgress)
def get_audio_conversion_progress(job_id: str) -> dict:
    job = get_audio_conversion_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Audio conversion job not found")
    return job


@app.post("/library/tools/audio-conversion/jobs/{job_id}/cancel", response_model=AudioConversionProgress)
def cancel_audio_conversion(job_id: str) -> dict:
    job = cancel_audio_conversion_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Audio conversion job not found")
    return job


@app.get("/library/tools/cd-rip/setup", response_model=CdRipSetupResponse)
def get_cd_rip_setup() -> CdRipSetupResponse:
    return CdRipSetupResponse(**cd_rip_setup())


@app.post("/library/tools/cd-rip/metadata", response_model=CdRipMetadataResponse)
def get_cd_rip_metadata(request: CdRipMetadataRequest) -> CdRipMetadataResponse:
    return CdRipMetadataResponse(**lookup_cd_metadata(request))


@app.post("/library/tools/cd-rip/jobs", response_model=CdRipStartResponse)
def start_cd_rip(request: CdRipStartRequest) -> CdRipStartResponse:
    setup = cd_rip_setup()
    if request.output_format != "wav" and not setup["ffmpeg_available"]:
        raise HTTPException(status_code=400, detail="FFmpeg is required to encode ripped CD audio to FLAC or MP3.")
    if request.secure_mode and not setup["secure_ripping_available"]:
        raise HTTPException(status_code=400, detail="Secure CD ripping requires cdparanoia, cdda2wav, or icedax.")
    if not request.secure_mode and not (setup["secure_ripping_available"] or setup["ffmpeg_available"]):
        raise HTTPException(status_code=400, detail="No compatible CD ripping tool was found.")
    job = start_cd_rip_job(request)
    return CdRipStartResponse(job_id=job["job_id"], status=job["status"])


@app.get("/library/tools/cd-rip/jobs/{job_id}", response_model=CdRipProgress)
def get_cd_rip_progress(job_id: str) -> dict:
    job = get_cd_rip_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="CD rip job not found")
    return job


@app.post("/library/tools/cd-rip/jobs/{job_id}/cancel", response_model=CdRipProgress)
def cancel_cd_rip(job_id: str) -> dict:
    job = cancel_cd_rip_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="CD rip job not found")
    return job


@app.post("/library/tools/cd-rip/playback/play", response_model=CdPlaybackResponse)
def play_cd_track_route(request: CdPlaybackRequest) -> CdPlaybackResponse:
    try:
        return CdPlaybackResponse(**play_cd_track(request.track_number))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/library/tools/cd-rip/playback/stop", response_model=CdPlaybackResponse)
def stop_cd_playback_route() -> CdPlaybackResponse:
    try:
        return CdPlaybackResponse(**stop_cd_playback())
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/audiobooks", response_model=AudiobookListResponse)
def get_audiobooks(limit: int = Query(default=200, ge=1, le=1000), offset: int = Query(default=0, ge=0)) -> AudiobookListResponse:
    return AudiobookListResponse(**list_audiobooks(limit, offset))


@app.patch("/audiobooks/{track_id}/progress", response_model=AudiobookProgressResponse)
def update_audiobook_progress(track_id: int, request: AudiobookProgressRequest) -> AudiobookProgressResponse:
    progress = upsert_audiobook_progress(track_id, request.position_seconds, request.duration_seconds)
    if progress is None:
        raise HTTPException(status_code=404, detail="Audiobook track not found")
    return AudiobookProgressResponse(**progress)


@app.get("/audiobooks/{track_id}/bookmarks", response_model=list[AudiobookBookmark])
def get_audiobook_bookmarks(track_id: int) -> list[AudiobookBookmark]:
    return [AudiobookBookmark(**bookmark) for bookmark in list_audiobook_bookmarks(track_id)]


@app.post("/audiobooks/{track_id}/bookmarks", response_model=AudiobookBookmark)
def create_audiobook_bookmark(track_id: int, request: AudiobookBookmarkRequest) -> AudiobookBookmark:
    bookmark = add_audiobook_bookmark(track_id, request.position_seconds, request.label, request.note)
    if bookmark is None:
        raise HTTPException(status_code=404, detail="Audiobook track not found")
    return AudiobookBookmark(**bookmark)


@app.delete("/audiobooks/bookmarks/{bookmark_id}")
def remove_audiobook_bookmark(bookmark_id: int) -> dict:
    if not delete_audiobook_bookmark(bookmark_id):
        raise HTTPException(status_code=404, detail="Audiobook bookmark not found")
    return {"deleted": True}


@app.get("/audiobooks/{track_id}/chapters", response_model=list[AudiobookChapter])
def get_audiobook_chapters(track_id: int) -> list[AudiobookChapter]:
    return [AudiobookChapter(**chapter) for chapter in list_audiobook_chapters(track_id)]


@app.put("/audiobooks/{track_id}/chapters", response_model=list[AudiobookChapter])
def update_audiobook_chapters(track_id: int, request: AudiobookChapterUpdateRequest) -> list[AudiobookChapter]:
    chapters = replace_audiobook_chapters(track_id, [chapter.model_dump(mode="json") for chapter in request.chapters])
    if chapters is None:
        raise HTTPException(status_code=404, detail="Audiobook track not found")
    return [AudiobookChapter(**chapter) for chapter in chapters]


@app.post("/audiobooks/sync-export", response_model=AudiobookSyncExportResponse)
def export_audiobook_sync_metadata(request: AudiobookSyncExportRequest) -> AudiobookSyncExportResponse:
    try:
        return AudiobookSyncExportResponse(**audiobook_sync_export(request.track_ids, request.limit))
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not export audiobook sync metadata: {exc}") from exc


@app.get("/podcasts/subscriptions", response_model=list[PodcastSubscription])
def get_podcast_subscriptions() -> list[PodcastSubscription]:
    return [PodcastSubscription(**subscription) for subscription in list_podcast_subscriptions()]


@app.post("/podcasts/subscriptions", response_model=PodcastSubscription)
def create_podcast_subscription(request: PodcastSubscriptionPayload) -> PodcastSubscription:
    subscription = upsert_podcast_subscription(request)
    if subscription is None:
        raise HTTPException(status_code=400, detail="Could not save podcast subscription")
    return PodcastSubscription(**subscription)


@app.patch("/podcasts/subscriptions/{subscription_id}", response_model=PodcastSubscription)
def update_podcast_subscription(subscription_id: int, request: PodcastSubscriptionPayload) -> PodcastSubscription:
    subscription = upsert_podcast_subscription(request, subscription_id)
    if subscription is None:
        raise HTTPException(status_code=404, detail="Podcast subscription not found")
    return PodcastSubscription(**subscription)


@app.delete("/podcasts/subscriptions/{subscription_id}")
def remove_podcast_subscription(subscription_id: int) -> dict:
    if not delete_podcast_subscription(subscription_id):
        raise HTTPException(status_code=404, detail="Podcast subscription not found")
    return {"deleted": True}


@app.post("/podcasts/subscriptions/{subscription_id}/refresh", response_model=PodcastRefreshResponse)
def refresh_podcast_subscription_route(subscription_id: int) -> PodcastRefreshResponse:
    try:
        response = refresh_podcast_subscription(subscription_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not refresh podcast feed: {exc}") from exc
    if response is None:
        raise HTTPException(status_code=404, detail="Podcast subscription not found")
    return PodcastRefreshResponse(**response)


@app.get("/podcasts/episodes", response_model=list[PodcastEpisode])
def get_podcast_episodes(subscription_id: int | None = None, limit: int = Query(default=200, ge=1, le=1000)) -> list[PodcastEpisode]:
    return [PodcastEpisode(**episode) for episode in list_podcast_episodes(subscription_id, limit)]


@app.post("/podcasts/episodes/{episode_id}/download", response_model=PodcastEpisode)
def download_podcast_episode_route(episode_id: int, request: PodcastDownloadRequest) -> PodcastEpisode:
    try:
        episode = download_episode(episode_id, request.download_folder)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not download episode: {exc}") from exc
    if episode is None:
        raise HTTPException(status_code=404, detail="Podcast episode not found")
    return PodcastEpisode(**episode)


@app.get("/radio/stations", response_model=list[RadioStation])
def get_radio_stations() -> list[RadioStation]:
    return [RadioStation(**station) for station in list_radio_stations()]


@app.post("/radio/stations", response_model=RadioStation)
def create_radio_station(request: RadioStationPayload) -> RadioStation:
    station = save_radio_station(request)
    if station is None:
        raise HTTPException(status_code=400, detail="Could not save radio station")
    return RadioStation(**station)


@app.patch("/radio/stations/{station_id}", response_model=RadioStation)
def update_radio_station(station_id: int, request: RadioStationPayload) -> RadioStation:
    station = save_radio_station(request, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Radio station not found")
    return RadioStation(**station)


@app.delete("/radio/stations/{station_id}")
def remove_radio_station(station_id: int) -> dict:
    if not delete_radio_station(station_id):
        raise HTTPException(status_code=404, detail="Radio station not found")
    return {"deleted": True}


@app.post("/radio/stations/{station_id}/played", response_model=RadioStation)
def mark_radio_played(station_id: int) -> RadioStation:
    station = mark_radio_station_played(station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Radio station not found")
    return RadioStation(**station)


@app.get("/scrobbling/accounts", response_model=list[ScrobbleAccount])
def get_scrobble_accounts() -> list[ScrobbleAccount]:
    return [ScrobbleAccount(**account) for account in list_scrobble_accounts()]


@app.patch("/scrobbling/accounts/{service}", response_model=ScrobbleAccount)
def update_scrobble_account(service: str, request: ScrobbleAccountRequest) -> ScrobbleAccount:
    if service not in {"listenbrainz", "lastfm"}:
        raise HTTPException(status_code=404, detail="Scrobble service not found")
    return ScrobbleAccount(**save_scrobble_account(service, request))


@app.get("/scrobbling/outbox", response_model=list[ScrobbleOutboxEntry])
def get_scrobble_outbox(limit: int = Query(default=100, ge=1, le=1000)) -> list[ScrobbleOutboxEntry]:
    return [ScrobbleOutboxEntry(**entry) for entry in list_scrobble_outbox(limit)]


@app.post("/scrobbling/outbox/queue-history", response_model=ScrobbleQueueHistoryResponse)
def queue_scrobbling_history(request: ScrobbleQueueHistoryRequest) -> ScrobbleQueueHistoryResponse:
    return ScrobbleQueueHistoryResponse(**queue_scrobble_history(request.service, request.limit))


@app.post("/scrobbling/outbox/submit", response_model=ScrobbleSubmitResponse)
def submit_scrobbling_outbox(request: ScrobbleSubmitRequest) -> ScrobbleSubmitResponse:
    try:
        return ScrobbleSubmitResponse(**submit_scrobble_outbox(request.service, request.limit))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/scrobbling/loved", response_model=list[LovedTrack])
def get_loved_tracks(limit: int = Query(default=100, ge=1, le=1000)) -> list[LovedTrack]:
    return [LovedTrack(**track) for track in list_loved_tracks(limit)]


@app.patch("/scrobbling/tracks/{track_id}/love", response_model=TrackLoveResponse)
def update_track_love(track_id: int, request: TrackLoveRequest) -> TrackLoveResponse:
    love = set_track_loved(track_id, request.loved, request.source)
    if love is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return TrackLoveResponse(**love)


@app.post("/scrobbling/import-history", response_model=ScrobbleHistoryImportResponse)
def import_scrobbling_history(request: ScrobbleHistoryImportRequest) -> ScrobbleHistoryImportResponse:
    try:
        return ScrobbleHistoryImportResponse(**import_scrobble_history_csv(request.csv_path, request.apply, request.limit))
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/library/health", response_model=LibraryHealthResponse)
def library_health(limit: int = Query(default=80, ge=1, le=500)) -> LibraryHealthResponse:
    with connect() as conn:
        missing_files = [
            track
            for track in rows_to_dicts(
                conn.execute(
                    f"""
                    SELECT {TRACK_COLUMNS}
                    FROM tracks
                    ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), lower(coalesce(title, ''))
                    """
                )
            )
            if not Path(track["path"]).exists()
        ][:limit]
        missing = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE title IS NULL OR trim(title) = '' OR artist IS NULL OR trim(artist) = ''
                   OR album IS NULL OR trim(album) = ''
                   OR ((genre IS NULL OR trim(genre) = '')
                       AND (analysis_genre IS NULL OR trim(analysis_genre) = ''))
                ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), lower(coalesce(title, ''))
                LIMIT ?
                """,
                (limit,),
            )
        )
        unrated = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE rating IS NULL
                ORDER BY datetime(date_added) DESC, lower(coalesce(artist, '')), lower(coalesce(title, ''))
                LIMIT ?
                """,
                (limit,),
            )
        )
        duplicate_keys = conn.execute(
            """
            SELECT lower(coalesce(title, '')) AS title_key,
                   lower(coalesce(artist, '')) AS artist_key,
                   coalesce(title, 'Untitled') || ' - ' || coalesce(artist, 'Unknown Artist') AS display_key
            FROM tracks
            GROUP BY title_key, artist_key
            HAVING count(*) > 1 AND title_key <> ''
            ORDER BY count(*) DESC, display_key ASC
            LIMIT 20
            """
        ).fetchall()
        duplicates: list[DuplicateGroup] = []
        seen_duplicate_sets: set[tuple[int, ...]] = set()

        def append_duplicate_group(key: str, tracks: list[dict], reason: str) -> None:
            if len(tracks) < 2:
                return
            identity = tuple(sorted(int(track["id"]) for track in tracks))
            if identity in seen_duplicate_sets:
                return
            seen_duplicate_sets.add(identity)
            duplicates.append(duplicate_group_from_tracks(key, tracks, reason))

        for key in duplicate_keys:
            tracks = rows_to_dicts(
                conn.execute(
                    f"""
                    SELECT {TRACK_COLUMNS}
                    FROM tracks
                    WHERE lower(coalesce(title, '')) = ? AND lower(coalesce(artist, '')) = ?
                    ORDER BY path ASC
                    LIMIT ?
                    """,
                    (key["title_key"], key["artist_key"], limit),
                )
            )
            append_duplicate_group(key["display_key"], tracks, "matching title/artist")

        fingerprint_keys = conn.execute(
            """
            SELECT audio_fingerprint, count(*) AS tracks
            FROM tracks
            WHERE audio_fingerprint IS NOT NULL AND trim(audio_fingerprint) <> ''
            GROUP BY audio_fingerprint
            HAVING count(*) > 1
            ORDER BY tracks DESC
            LIMIT 20
            """
        ).fetchall()
        for key in fingerprint_keys:
            tracks = rows_to_dicts(
                conn.execute(
                    f"""
                    SELECT {TRACK_COLUMNS}
                    FROM tracks
                    WHERE audio_fingerprint = ?
                    ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), path ASC
                    LIMIT ?
                    """,
                    (key["audio_fingerprint"], limit),
                )
            )
            label = f"File fingerprint {str(key['audio_fingerprint'])[:10]}"
            append_duplicate_group(label, tracks, "matching file fingerprint")
        acoustic_keys = conn.execute(
            """
            SELECT acoustic_fingerprint, count(*) AS tracks
            FROM tracks
            WHERE acoustic_fingerprint IS NOT NULL AND trim(acoustic_fingerprint) <> ''
            GROUP BY acoustic_fingerprint
            HAVING count(*) > 1
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        for key in acoustic_keys:
            tracks = rows_to_dicts(
                conn.execute(
                    f"""
                    SELECT {TRACK_COLUMNS}
                    FROM tracks
                    WHERE acoustic_fingerprint = ?
                    ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), path ASC
                    LIMIT ?
                    """,
                    (key["acoustic_fingerprint"], limit),
                )
            )
            label = f"Acoustic fingerprint {str(key['acoustic_fingerprint'])[:10]}"
            append_duplicate_group(label, tracks, "matching acoustic fingerprint")
    return LibraryHealthResponse(
        missing_files=missing_files,
        missing_metadata=missing,
        duplicate_groups=duplicates,
        unrated_tracks=unrated,
    )


def tool_track_rows(conn, track_ids: list[int] | None, limit: int) -> list[dict]:
    if track_ids:
        unique_ids = list(dict.fromkeys(track_ids))
        placeholders = ",".join("?" for _ in unique_ids)
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE id IN ({placeholders})
                ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                         coalesce(disc_number, 0), coalesce(track_number, 0),
                         lower(coalesce(title, ''))
                LIMIT ?
                """,
                [*unique_ids, limit],
            )
        )
    return rows_to_dicts(
        conn.execute(
            f"""
            SELECT {TRACK_COLUMNS}
            FROM tracks
            ORDER BY datetime(date_added) DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
    )


def metadata_csv_rows(conn, track_ids: list[int] | None, limit: int) -> list[dict]:
    selected_columns = ", ".join(METADATA_CSV_COLUMNS)
    if track_ids:
        unique_ids = list(dict.fromkeys(track_ids))
        placeholders = ",".join("?" for _ in unique_ids)
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {selected_columns}
                FROM tracks
                WHERE id IN ({placeholders})
                ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                         coalesce(disc_number, 0), coalesce(track_number, 0),
                         lower(coalesce(title, ''))
                LIMIT ?
                """,
                [*unique_ids, limit],
            )
        )
    return rows_to_dicts(
        conn.execute(
            f"""
            SELECT {selected_columns}
            FROM tracks
            ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                     coalesce(disc_number, 0), coalesce(track_number, 0),
                     lower(coalesce(title, ''))
            LIMIT ?
            """,
            (limit,),
        )
    )


def resolve_csv_tool_path(csv_path: str | None, default_name: str | None = None) -> Path:
    text = csv_path.strip() if csv_path else ""
    if text:
        target = Path(text).expanduser()
        if not target.is_absolute():
            target = (EXPORT_DIR / target).resolve()
    elif default_name:
        target = EXPORT_DIR / default_name
    else:
        raise HTTPException(status_code=400, detail="CSV path is required")
    if target.suffix.lower() != ".csv":
        target = target.with_suffix(".csv")
    return target


def resolve_json_tool_path(json_path: str | None, default_name: str) -> Path:
    text = json_path.strip() if json_path else ""
    if text:
        target = Path(text).expanduser()
        if not target.is_absolute():
            target = (EXPORT_DIR / target).resolve()
    else:
        target = EXPORT_DIR / default_name
    if target.suffix.lower() != ".json":
        target = target.with_suffix(".json")
    return target


def resolve_existing_json_report_path(json_path: str) -> Path:
    text = json_path.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Report path is required")
    target = Path(text).expanduser()
    if not target.is_absolute():
        target = (EXPORT_DIR / target).resolve()
    return target


def csv_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def csv_int(value: object, field: str) -> int | None:
    text = csv_text(value)
    if text is None:
        return None
    try:
        return int(float(text))
    except ValueError as exc:
        raise ValueError(f"{field} must be a number") from exc


def csv_rating(value: object) -> float | None:
    text = csv_text(value)
    if text is None:
        return None
    try:
        rating = float(text)
    except ValueError as exc:
        raise ValueError("rating must be a number") from exc
    if rating == 0:
        return None
    if not 0.5 <= rating <= 5 or abs(round(rating * 2) - rating * 2) > 1e-9:
        raise ValueError("rating must be 0.5 to 5 in half-star steps")
    return rating


def parse_csv_import_values(
    row: dict[str, str | None],
    column_map: dict[str, str] | None = None,
    clear_blank_fields: bool = False,
) -> dict[str, object | None]:
    imported: dict[str, object | None] = {}
    for field in CSV_IMPORT_FIELDS:
        column_name = (column_map or {}).get(field, field)
        if column_name not in row:
            continue
        if csv_text(row[column_name]) is None and not clear_blank_fields:
            continue
        if field in {"track_number", "disc_number", "year"}:
            imported[field] = csv_int(row[column_name], field)
        elif field == "rating":
            imported[field] = csv_rating(row[column_name])
        else:
            imported[field] = csv_text(row[column_name])
    return imported


def csv_value_missing(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def csv_values_equal(current: object, imported: object) -> bool:
    if current is None and imported is None:
        return True
    if isinstance(imported, float) and current is not None:
        try:
            return abs(float(current) - imported) < 1e-9
        except (TypeError, ValueError):
            return False
    return current == imported


def csv_import_changes(track: dict, imported: dict[str, object | None], missing_only: bool) -> dict[str, object | None]:
    changes: dict[str, object | None] = {}
    for field, value in imported.items():
        if missing_only and not csv_value_missing(track.get(field)):
            continue
        if not csv_values_equal(track.get(field), value):
            changes[field] = value
    return changes


def csv_conflict_fields(track: dict, changes: dict[str, object | None]) -> list[str]:
    return sorted(
        field
        for field, value in changes.items()
        if not csv_value_missing(track.get(field)) and not csv_values_equal(track.get(field), value)
    )


def csv_import_track(conn, row: dict[str, str | None], allowed_ids: set[int] | None) -> dict | None:
    select_columns = f"path_key, {TRACK_COLUMNS}"
    id_text = csv_text(row.get("id"))
    if id_text:
        try:
            track_id = int(float(id_text))
        except ValueError:
            track_id = None
        if track_id is not None and (allowed_ids is None or track_id in allowed_ids):
            found = conn.execute(
                f"SELECT {select_columns} FROM tracks WHERE id = ?",
                (track_id,),
            ).fetchone()
            if found is not None:
                return dict(found)

    key = csv_text(row.get("path_key"))
    path_text = csv_text(row.get("path"))
    if key is None and path_text:
        try:
            key = path_key(Path(path_text))
        except OSError:
            key = None
    if key is None:
        return None
    found = conn.execute(
        f"SELECT {select_columns} FROM tracks WHERE path_key = ?",
        (key,),
    ).fetchone()
    if found is None:
        return None
    track = dict(found)
    if allowed_ids is not None and int(track["id"]) not in allowed_ids:
        return None
    return track


def unique_collision_path(target_path: Path) -> Path:
    if not target_path.exists():
        return target_path
    parent = target_path.parent
    stem = target_path.stem
    suffix = target_path.suffix
    for index in range(2, 10000):
        candidate = parent / f"{stem} ({index}){suffix}"
        if not candidate.exists():
            return candidate.resolve()
    raise OSError("Could not find an available target filename")


def safe_subfolder(value: str | None, fallback: str) -> Path:
    text = (value or fallback).strip().strip("/\\")
    if not text:
        text = fallback
    parts = [sanitize_path_component(part) for part in re.split(r"[\\/]+", text) if part.strip()]
    return Path(*parts) if parts else Path(fallback)


def track_device_sync_target(
    track: dict,
    target_root: Path,
    library_root: Path | None,
    preserve_structure: bool,
    music_subfolder: str = "Music",
) -> Path:
    source = Path(track["path"]).expanduser()
    if preserve_structure and library_root is not None:
        try:
            return (target_root / safe_subfolder(music_subfolder, "Music") / source.resolve().relative_to(library_root)).resolve()
        except (OSError, ValueError):
            pass
    album_artist = sanitize_path_component(str(track.get("album_artist") or track.get("artist") or "Unknown Artist"))
    album = sanitize_path_component(str(track.get("album") or "Unknown Album"))
    filename = sanitize_path_component(source.name)
    return (target_root / safe_subfolder(music_subfolder, "Music") / album_artist / album / filename).resolve()


def device_sync_track_rows(conn, request: DeviceSyncRequest) -> tuple[list[dict], dict[int, list[dict]]]:
    tracks_by_id: dict[int, dict] = {}
    playlist_map: dict[int, list[dict]] = {}
    if request.playlist_ids:
        for playlist_id in dict.fromkeys(request.playlist_ids):
            playlist = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
            if playlist is None:
                playlist_map[playlist_id] = []
                continue
            rows = rows_to_dicts(
                conn.execute(
                    f"""
                    SELECT {TRACK_JOIN_COLUMNS}
                    FROM playlist_tracks
                    JOIN tracks ON tracks.id = playlist_tracks.track_id
                    WHERE playlist_tracks.playlist_id = ?
                    ORDER BY playlist_tracks.position ASC, playlist_tracks.id ASC
                    LIMIT ?
                    """,
                    (playlist_id, request.limit),
                )
            )
            playlist_map[playlist_id] = rows
            for track in rows:
                tracks_by_id.setdefault(int(track["id"]), track)
    for track in tool_track_rows(conn, request.track_ids, request.limit):
        tracks_by_id.setdefault(int(track["id"]), track)
    return list(tracks_by_id.values())[: request.limit], playlist_map


def path_needs_copy(source: Path, target: Path) -> bool:
    if not target.exists():
        return True
    try:
        source_stat = source.stat()
        target_stat = target.stat()
    except OSError:
        return True
    return int(source_stat.st_size) != int(target_stat.st_size) or int(source_stat.st_mtime) > int(target_stat.st_mtime) + 1


def write_device_playlist(
    playlist_path: Path,
    tracks: list[dict],
    target_paths: dict[int, Path],
    copy_files: bool,
) -> int:
    lines = ["#EXTM3U"]
    for track in tracks:
        track_id = int(track["id"])
        path = target_paths.get(track_id) if copy_files else Path(track["path"]).expanduser()
        if path is None:
            continue
        duration = int(float(track.get("duration_seconds") or -1))
        title = track.get("title") or Path(track["path"]).stem
        artist = track.get("artist") or "Unknown Artist"
        lines.append(f"#EXTINF:{duration},{artist} - {title}")
        try:
            text_path = os.path.relpath(path, playlist_path.parent) if copy_files else str(path)
        except ValueError:
            text_path = str(path)
        lines.append(text_path.replace("\\", "/"))
    playlist_path.parent.mkdir(parents=True, exist_ok=True)
    playlist_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(tracks)


def remove_empty_source_folders(source_parent: Path, cleanup_root: Path | None) -> int:
    if cleanup_root is None:
        return 0
    removed = 0
    try:
        current = source_parent.resolve()
        root = cleanup_root.resolve()
        current.relative_to(root)
    except (OSError, ValueError):
        return 0

    while current != root:
        try:
            current.rmdir()
        except OSError:
            break
        removed += 1
        current = current.parent
    return removed


def build_metadata_csv_import_response(request: CsvMetadataImportRequest) -> CsvMetadataImportResponse:
    source = resolve_csv_tool_path(request.csv_path)
    if not source.exists():
        raise HTTPException(status_code=400, detail="CSV file does not exist")

    try:
        with source.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
    except UnicodeDecodeError:
        with source.open("r", encoding="latin-1", errors="ignore", newline="") as handle:
            rows = list(csv.DictReader(handle))
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {exc}") from exc

    rows = rows[: request.limit]
    allowed_ids = set(request.track_ids) if request.track_ids else None
    previews: list[CsvMetadataImportPreview] = []
    matched = 0
    changed = 0
    applied = 0
    errors: list[str] = []
    batch_id = new_undo_batch_id("csv-import") if request.apply else None

    with connect() as conn:
        for index, row in enumerate(rows, start=2):
            preview = CsvMetadataImportPreview(row_number=index)
            try:
                track = csv_import_track(conn, row, allowed_ids)
                if track is None:
                    preview.error = "No library track matched this row"
                    errors.append(f"Row {index}: {preview.error}")
                    previews.append(preview)
                    continue

                preview.track_id = int(track["id"])
                preview.path = track["path"]
                preview.matched = True
                preview.current = {field: track.get(field) for field in CSV_IMPORT_FIELDS}
                imported = parse_csv_import_values(row, request.column_map, request.clear_blank_fields)
                preview.imported = imported
                changes = csv_import_changes(track, imported, request.missing_only)
                preview.changed_fields = sorted(changes.keys())
                preview.conflict_fields = csv_conflict_fields(track, changes)
                matched += 1
                if changes:
                    changed += 1

                if request.apply and changes:
                    write_bulk_undo_log(
                        conn,
                        "csv_metadata_import",
                        f"CSV metadata import row {index}",
                        {"track": track, "changes": changes, "csv_path": str(source), "row_number": index},
                        batch_id,
                    )
                    metadata_changes = {field: value for field, value in changes.items() if field in EDITABLE_METADATA_FIELDS}
                    if metadata_changes:
                        apply_track_metadata_update(conn, int(track["id"]), metadata_changes)
                    if "rating" in changes:
                        apply_track_rating_update(conn, int(track["id"]), changes["rating"])
                    preview.applied = True
                    applied += 1
            except (HTTPException, ValueError) as exc:
                message = str(exc.detail) if isinstance(exc, HTTPException) else str(exc)
                preview.error = message
                errors.append(f"Row {index}: {message}")
            previews.append(preview)
        if request.apply:
            conn.commit()

    return CsvMetadataImportResponse(
        csv_path=str(source),
        total=len(rows),
        matched=matched,
        changed=changed,
        applied=applied,
        errors=errors[:50],
        previews=previews,
    )


def new_undo_batch_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def write_bulk_undo_log(
    conn,
    action_type: str,
    summary: str,
    payload: dict[str, object],
    batch_id: str | None = None,
) -> int:
    cursor = conn.execute(
        """
        INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
        VALUES(?, ?, ?, ?)
        """,
        (batch_id, action_type, summary, json.dumps(payload, ensure_ascii=True, default=str)),
    )
    return int(cursor.lastrowid)


def chromaprint_tool_dir() -> Path:
    return APP_STORAGE_ROOT / "tools" / "chromaprint"


def fpcalc_candidate_paths(configured_path: str | None = None) -> list[Path]:
    executable = "fpcalc.exe" if os.name == "nt" else "fpcalc"
    repo_root = Path(__file__).resolve().parents[2]
    candidates: list[Path] = []
    if configured_path:
        configured = Path(configured_path).expanduser()
        candidates.append(configured / executable if configured.is_dir() else configured)
    candidates.extend(
        [
            chromaprint_tool_dir() / executable,
            APP_STORAGE_ROOT / "tools" / executable,
            repo_root / "tools" / "chromaprint" / executable,
            repo_root / "tools" / executable,
        ]
    )
    which_path = shutil.which("fpcalc")
    if which_path:
        candidates.append(Path(which_path))

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        try:
            key = str(candidate.expanduser().resolve()).lower()
        except OSError:
            key = str(candidate.expanduser()).lower()
        if key not in seen:
            seen.add(key)
            unique.append(candidate.expanduser())
    return unique


def resolve_fpcalc_path(conn: sqlite3.Connection | None = None) -> tuple[Path | None, str | None, list[Path]]:
    configured = get_setting(conn, "chromaprint_fpcalc_path") if conn is not None else None
    candidates = fpcalc_candidate_paths(configured)
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate.resolve(), configured, candidates
    return None, configured, candidates


def fpcalc_version(fpcalc_path: Path) -> str | None:
    try:
        completed = subprocess.run(
            [str(fpcalc_path), "-version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    output = (completed.stdout or completed.stderr).strip()
    return output.splitlines()[0] if output else None


def chromaprint_status(conn: sqlite3.Connection) -> ChromaprintStatusResponse:
    fpcalc_path, configured, candidates = resolve_fpcalc_path(conn)
    tool_dir = chromaprint_tool_dir()
    checked_paths = [str(candidate) for candidate in candidates]
    if fpcalc_path is None:
        return ChromaprintStatusResponse(
            available=False,
            configured_path=configured,
            tool_directory=str(tool_dir),
            checked_paths=checked_paths,
            message=(
                f"fpcalc was not found. Save a path below, or place fpcalc.exe in {tool_dir} "
                "so FLAC Cafe can use it without editing PATH."
            ),
        )
    return ChromaprintStatusResponse(
        available=True,
        configured_path=configured,
        resolved_path=str(fpcalc_path),
        version=fpcalc_version(fpcalc_path),
        tool_directory=str(tool_dir),
        checked_paths=checked_paths,
        message="Chromaprint fpcalc is ready for acoustic fingerprint analysis.",
    )


def remove_tracks_for_action(
    conn,
    track_ids: list[int],
    delete_files: bool,
    batch_id: str | None = None,
) -> tuple[list[int], int, list[str]]:
    removed: list[int] = []
    deleted_files = 0
    errors: list[str] = []
    if not track_ids:
        return removed, deleted_files, errors
    unique_ids = list(dict.fromkeys(track_ids))
    placeholders = ",".join("?" for _ in unique_ids)
    rows = rows_to_dicts(
        conn.execute(
            f"SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})",
            unique_ids,
        )
    )
    for track in rows:
        track_id = int(track["id"])
        write_bulk_undo_log(
            conn,
            "track_remove",
            f"Removed {track.get('title') or Path(track['path']).name}",
            {"track": track, "delete_file": delete_files},
            batch_id,
        )
        path = Path(track["path"])
        if delete_files and path.exists():
            try:
                path.unlink()
                deleted_files += 1
            except OSError as exc:
                errors.append(f"{path}: {exc}")
                continue
        conn.execute("DELETE FROM tracks WHERE id = ?", (track_id,))
        conn.execute("DELETE FROM track_metadata_cache WHERE path_key = ?", (track.get("path_key"),))
        removed.append(track_id)
    delete_orphan_albums(conn)
    return removed, deleted_files, errors


def duplicate_groups_for_report(limit: int = 500) -> list[dict]:
    health = library_health(limit=limit)
    return [group.model_dump(mode="json") for group in health.duplicate_groups]


def tracks_by_ids(conn, track_ids: list[int]) -> tuple[list[dict], list[int]]:
    unique_ids = list(dict.fromkeys(track_ids))
    if not unique_ids:
        return [], []
    placeholders = ",".join("?" for _ in unique_ids)
    rows = rows_to_dicts(
        conn.execute(
            f"SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})",
            unique_ids,
        )
    )
    by_id = {int(row["id"]): row for row in rows}
    return [by_id[track_id] for track_id in unique_ids if track_id in by_id], [
        track_id for track_id in unique_ids if track_id not in by_id
    ]


def acoustic_fingerprint_for_path(path: Path, fpcalc_path: str) -> str:
    completed = subprocess.run(
        [fpcalc_path, "-json", str(path)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip() or "fpcalc failed"
        raise OSError(message)
    payload = json.loads(completed.stdout)
    fingerprint = str(payload.get("fingerprint") or "").strip()
    if not fingerprint:
        raise OSError("fpcalc did not return a fingerprint")
    return fingerprint


def restore_csv_metadata_import(conn, payload: dict[str, object]) -> tuple[list[int], list[str]]:
    track = payload.get("track")
    changes = payload.get("changes")
    if not isinstance(track, dict) or not isinstance(changes, dict):
        return [], ["Undo payload is missing CSV metadata details"]
    track_id = int(track.get("id") or 0)
    if track_id <= 0:
        return [], ["Undo payload is missing track id"]
    existing = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if existing is None:
        return [], [f"Track {track_id} is no longer in the library"]
    metadata_changes = {
        field: track.get(field)
        for field in changes
        if field in EDITABLE_METADATA_FIELDS
    }
    if metadata_changes:
        apply_track_metadata_update(conn, track_id, metadata_changes)
    if "rating" in changes:
        apply_track_rating_update(conn, track_id, track.get("rating"))
    return [track_id], []


def restore_file_organization(conn, payload: dict[str, object]) -> tuple[list[int], list[str]]:
    track_id = int(payload.get("track_id") or 0)
    source_text = str(payload.get("to") or "").strip()
    target_text = str(payload.get("from") or "").strip()
    if track_id <= 0 or not source_text or not target_text:
        return [], ["Undo payload is missing file move details"]
    source = Path(source_text).expanduser()
    target = Path(target_text).expanduser()
    if not source.exists():
        return [], [f"Moved file is missing: {source}"]
    if target.exists():
        return [], [f"Original path already exists: {target}"]
    row = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if row is None:
        return [], [f"Track {track_id} is no longer in the library"]
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(target))
    modified_at = datetime.fromtimestamp(target.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat()
    old_key = str(payload.get("new_path_key") or path_key(source))
    restored_key = str(payload.get("previous_path_key") or path_key(target))
    conn.execute(
        """
        UPDATE tracks
        SET path = ?, path_key = ?, file_modified_at = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        (str(target), restored_key, modified_at, track_id),
    )
    conn.execute("DELETE FROM track_metadata_cache WHERE path_key IN (?, ?)", (old_key, restored_key))
    return [track_id], []


def restore_removed_track(conn, payload: dict[str, object]) -> tuple[list[int], list[str]]:
    track = payload.get("track")
    if not isinstance(track, dict):
        return [], ["Undo payload is missing removed track data"]
    track_id = int(track.get("id") or 0)
    track_path_text = str(track.get("path") or "").strip()
    if track_id <= 0 or not track_path_text:
        return [], ["Undo payload is missing removed track id or path"]
    track_path = Path(track_path_text).expanduser()
    if not track_path.exists():
        return [], [f"Audio file no longer exists: {track_path}"]
    restored_key = str(track.get("path_key") or path_key(track_path))
    conflict = conn.execute(
        "SELECT id FROM tracks WHERE id = ? OR path_key = ?",
        (track_id, restored_key),
    ).fetchone()
    if conflict is not None:
        return [], [f"Track id or path is already present in the library: {track_id}"]
    columns = ["id", "path_key", *[field for field in TRACK_FIELD_NAMES if field != "id"]]
    values = []
    for column in columns:
        if column == "path_key":
            values.append(restored_key)
        else:
            values.append(track.get(column))
    placeholders = ",".join("?" for _ in columns)
    conn.execute(
        f"INSERT INTO tracks({', '.join(columns)}) VALUES({placeholders})",
        values,
    )
    return [track_id], []


def restore_bulk_undo_entry(conn, action_type: str, payload: dict[str, object]) -> tuple[list[int], list[str]]:
    if action_type in {"csv_metadata_import", "regex_metadata_replace", "musicbrainz_auto_tag"}:
        return restore_csv_metadata_import(conn, payload)
    if action_type in {"advanced_tag_edit", "tag_backup_restore"}:
        return restore_advanced_tag_edit(conn, payload)
    if action_type == "file_organization":
        return restore_file_organization(conn, payload)
    if action_type == "track_remove":
        return restore_removed_track(conn, payload)
    return [], [f"Undo is not supported for {action_type}"]


@app.post("/library/maintenance/clear", response_model=CacheClearResponse)
def clear_library_caches(request: CacheClearRequest) -> CacheClearResponse:
    table_by_target = {
        "artist": "artist_info_cache",
        "artwork": "artwork_cache",
        "metadata": "track_metadata_cache",
        "recommendation_history": "recommendation_runs",
        "scan_errors": "scan_error_samples",
    }
    cleared: dict[str, int] = {}
    with connect() as conn:
        for target in dict.fromkeys(request.targets):
            table = table_by_target[target]
            cursor = conn.execute(f"DELETE FROM {table}")
            cleared[target] = int(cursor.rowcount if cursor.rowcount is not None else 0)
        conn.commit()
    return CacheClearResponse(cleared=cleared)


CUSTOM_TAG_KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.\-#]{0,79}$")
VIRTUAL_TOKEN_RE = re.compile(r"<([^<>]+)>|\{([^{}]+)\}")


def clean_custom_tag_key(tag_key: str) -> str:
    cleaned = tag_key.strip()
    if not CUSTOM_TAG_KEY_RE.fullmatch(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Custom tag names can use letters, numbers, spaces, underscore, dash, dot, and #.",
        )
    return cleaned


def tag_field_alias(field: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", field.strip().lower()).strip("_")
    aliases = {
        "albumartist": "album_artist",
        "album_artist": "album_artist",
        "track": "track_number",
        "track_no": "track_number",
        "track_number": "track_number",
        "track_": "track_number",
        "disc": "disc_number",
        "disc_no": "disc_number",
        "disc_number": "disc_number",
        "date": "year",
        "release_year": "year",
        "stars": "rating",
    }
    return aliases.get(normalized, normalized)


def parse_tag_field_ref(field: str) -> tuple[str, str]:
    text = field.strip()
    if text.lower().startswith("custom:"):
        return "custom", clean_custom_tag_key(text.split(":", 1)[1])
    core = tag_field_alias(text)
    if core in TAG_TOOL_CORE_FIELDS:
        return "core", core
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported tag field '{field}'. Use a core field or custom:Name.",
    )


def tag_value_missing(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def coerce_tag_tool_value(field: str, value: object) -> object | None:
    if value is None:
        return None
    if field in {"track_number", "disc_number", "year"}:
        return csv_int(value, field)
    if field == "rating":
        return csv_rating(value)
    text = str(value).strip()
    return text or None


def custom_tags_for_tracks(conn, track_ids: list[int]) -> dict[int, dict[str, str | None]]:
    if not track_ids:
        return {}
    placeholders = ",".join("?" for _ in track_ids)
    rows = conn.execute(
        f"""
        SELECT track_id, tag_key, tag_value
        FROM track_custom_tags
        WHERE track_id IN ({placeholders})
        ORDER BY lower(tag_key)
        """,
        track_ids,
    ).fetchall()
    tags: dict[int, dict[str, str | None]] = {int(track_id): {} for track_id in track_ids}
    for row in rows:
        tags.setdefault(int(row["track_id"]), {})[row["tag_key"]] = row["tag_value"]
    return tags


def custom_tag_value(custom_tags: dict[str, str | None], tag_key: str) -> str | None:
    for key, value in custom_tags.items():
        if key.lower() == tag_key.lower():
            return value
    return None


def tag_field_value(track: dict, custom_tags: dict[str, str | None], field_ref: str) -> object | None:
    kind, name = parse_tag_field_ref(field_ref)
    if kind == "custom":
        return custom_tag_value(custom_tags, name)
    return track.get(name)


def apply_custom_tags_update(conn, track_id: int, updates: dict[str, object | None]) -> None:
    cleaned_updates = {clean_custom_tag_key(key): value for key, value in updates.items()}
    if not cleaned_updates:
        return
    row = conn.execute("SELECT id, path FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")

    file_modified_at = None
    if get_write_ratings_to_files(conn):
        try:
            path = Path(row["path"])
            write_custom_tags(path, cleaned_updates)
            if path.exists():
                file_modified_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Could not write custom tags to file: {exc}") from exc

    for tag_key, value in cleaned_updates.items():
        conn.execute(
            """
            DELETE FROM track_custom_tags
            WHERE track_id = ? AND lower(tag_key) = lower(?)
            """,
            (track_id, tag_key),
        )
        text = None if value is None else str(value).strip()
        if text:
            conn.execute(
                """
                INSERT INTO track_custom_tags(track_id, tag_key, tag_value, updated_at)
                VALUES(?, ?, ?, datetime('now'))
                """,
                (track_id, tag_key, text),
            )
    conn.execute(
        """
        UPDATE tracks
        SET file_modified_at = coalesce(?, file_modified_at),
            updated_at = datetime('now')
        WHERE id = ?
        """,
        (file_modified_at, track_id),
    )


def apply_tag_field_updates(
    conn,
    track_id: int,
    updates: dict[str, object | None],
) -> None:
    core_updates: dict[str, object | None] = {}
    custom_updates: dict[str, object | None] = {}
    rating_marker = object()
    rating_value: object | None = rating_marker
    for field_ref, value in updates.items():
        kind, name = parse_tag_field_ref(field_ref)
        if kind == "custom":
            custom_updates[name] = None if tag_value_missing(value) else str(value).strip()
        elif name == "rating":
            rating_value = coerce_tag_tool_value(name, value)
        else:
            core_updates[name] = coerce_tag_tool_value(name, value)
    if core_updates:
        apply_track_metadata_update(conn, track_id, core_updates)
    if rating_value is not rating_marker:
        apply_track_rating_update(conn, track_id, rating_value)  # type: ignore[arg-type]
    if custom_updates:
        apply_custom_tags_update(conn, track_id, custom_updates)


def advanced_tag_restore_payload(
    track: dict,
    custom_tags: dict[str, str | None],
    changed_fields: list[str],
    source: str,
) -> dict[str, object]:
    return {
        "track": track,
        "custom_tags": custom_tags,
        "changed_fields": changed_fields,
        "source": source,
    }


def restore_advanced_tag_edit(conn, payload: dict[str, object]) -> tuple[list[int], list[str]]:
    track = payload.get("track")
    if not isinstance(track, dict):
        return [], ["Undo payload is missing track metadata"]
    track_id = int(track.get("id") or 0)
    if track_id <= 0:
        return [], ["Undo payload is missing track id"]
    if conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone() is None:
        return [], [f"Track {track_id} is no longer in the library"]

    changed_fields = payload.get("changed_fields")
    if not isinstance(changed_fields, list):
        changed_fields = list(TAG_TOOL_CORE_FIELDS)
    core_restore: dict[str, object | None] = {}
    custom_restore: dict[str, object | None] = {}
    saved_custom_tags = payload.get("custom_tags")
    custom_tags = saved_custom_tags if isinstance(saved_custom_tags, dict) else {}
    rating_marker = object()
    rating_value: object | None = rating_marker
    errors: list[str] = []
    for raw_field in changed_fields:
        if not isinstance(raw_field, str):
            continue
        try:
            kind, name = parse_tag_field_ref(raw_field)
        except HTTPException as exc:
            errors.append(str(exc.detail))
            continue
        if kind == "custom":
            custom_restore[name] = custom_tag_value({str(key): None if value is None else str(value) for key, value in custom_tags.items()}, name)
        elif name == "rating":
            rating_value = track.get("rating")
        else:
            core_restore[name] = track.get(name)

    if core_restore:
        apply_track_metadata_update(conn, track_id, core_restore)
    if rating_value is not rating_marker:
        apply_track_rating_update(conn, track_id, rating_value)  # type: ignore[arg-type]
    if custom_restore:
        apply_custom_tags_update(conn, track_id, custom_restore)
    return ([track_id] if not errors else []), errors


def tool_track_rows_with_path_key(conn, track_ids: list[int] | None, limit: int) -> list[dict]:
    if track_ids:
        unique_ids = list(dict.fromkeys(track_ids))
        placeholders = ",".join("?" for _ in unique_ids)
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT path_key, {TRACK_COLUMNS}
                FROM tracks
                WHERE id IN ({placeholders})
                ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                         coalesce(disc_number, 0), coalesce(track_number, 0),
                         lower(coalesce(title, ''))
                LIMIT ?
                """,
                [*unique_ids, limit],
            )
        )
    return rows_to_dicts(
        conn.execute(
            f"""
            SELECT path_key, {TRACK_COLUMNS}
            FROM tracks
            ORDER BY datetime(date_added) DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
    )


@app.get("/library/tools/regex-presets", response_model=list[RegexTagPreset])
def list_regex_tag_presets() -> list[RegexTagPreset]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, field, pattern, replacement, case_sensitive, created_at, updated_at
            FROM regex_tag_presets
            ORDER BY lower(name)
            """
        ).fetchall()
    return [
        RegexTagPreset(
            id=int(row["id"]),
            name=row["name"],
            field=row["field"],
            pattern=row["pattern"],
            replacement=row["replacement"],
            case_sensitive=bool(row["case_sensitive"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]


@app.post("/library/tools/regex-presets", response_model=RegexTagPreset)
def save_regex_tag_preset(request: RegexTagPresetRequest) -> RegexTagPreset:
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO regex_tag_presets(name, field, pattern, replacement, case_sensitive, updated_at)
            VALUES(?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(name) DO UPDATE SET
              field = excluded.field,
              pattern = excluded.pattern,
              replacement = excluded.replacement,
              case_sensitive = excluded.case_sensitive,
              updated_at = datetime('now')
            RETURNING id, name, field, pattern, replacement, case_sensitive, created_at, updated_at
            """,
            (request.name, request.field, request.pattern, request.replacement, 1 if request.case_sensitive else 0),
        )
        row = cursor.fetchone()
        conn.commit()
    if row is None:
        raise HTTPException(status_code=400, detail="Could not save regex preset")
    return RegexTagPreset(
        id=int(row["id"]),
        name=row["name"],
        field=row["field"],
        pattern=row["pattern"],
        replacement=row["replacement"],
        case_sensitive=bool(row["case_sensitive"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.delete("/library/tools/regex-presets/{preset_id}")
def delete_regex_tag_preset(preset_id: int) -> dict[str, bool]:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM regex_tag_presets WHERE id = ?", (preset_id,))
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Regex preset was not found")
    return {"deleted": True}


@app.post("/library/tools/custom-tags", response_model=CustomTagBatchResponse)
def batch_custom_tags(request: CustomTagBatchRequest) -> CustomTagBatchResponse:
    tag_key = clean_custom_tag_key(request.tag_key)
    requested_value = None if request.action == "delete" or request.value is None else request.value.strip()
    previews: list[CustomTagBatchPreview] = []
    changed = 0
    applied = 0
    batch_id = new_undo_batch_id("custom-tags") if request.apply else None
    with connect() as conn:
        rows = tool_track_rows_with_path_key(conn, request.track_ids, request.limit)
        custom_by_track = custom_tags_for_tracks(conn, [int(row["id"]) for row in rows])
        for track in rows:
            track_id = int(track["id"])
            current = custom_tag_value(custom_by_track.get(track_id, {}), tag_key)
            new_value = requested_value or None
            changed_here = current != new_value
            preview = CustomTagBatchPreview(
                track_id=track_id,
                path=track["path"],
                tag_key=tag_key,
                current=current,
                value=new_value,
                changed=changed_here,
            )
            if changed_here:
                changed += 1
            if request.apply and changed_here:
                try:
                    write_bulk_undo_log(
                        conn,
                        "advanced_tag_edit",
                        f"Custom tag {request.action}: {tag_key}",
                        advanced_tag_restore_payload(track, custom_by_track.get(track_id, {}), [f"custom:{tag_key}"], "custom_tags"),
                        batch_id,
                    )
                    apply_custom_tags_update(conn, track_id, {tag_key: new_value})
                    preview.applied = True
                    applied += 1
                except HTTPException as exc:
                    preview.error = str(exc.detail)
            previews.append(preview)
        if request.apply:
            conn.commit()
    return CustomTagBatchResponse(total=len(previews), changed=changed, applied=applied, previews=previews)


def virtual_tag_value(token: str, track: dict, custom_tags: dict[str, str | None]) -> str:
    key = token.strip()
    lowered = tag_field_alias(key)
    if key.lower().startswith("custom:"):
        return str(custom_tag_value(custom_tags, key.split(":", 1)[1].strip()) or "")
    if lowered in EDITABLE_METADATA_FIELDS or lowered == "rating":
        value = track.get(lowered)
        return "" if value is None else str(value)
    if lowered in {"album_artist_or_artist", "albumartistorartist"}:
        return str(track.get("album_artist") or track.get("artist") or "")
    if lowered == "filename":
        return Path(track["path"]).stem
    if lowered == "folder":
        return Path(track["path"]).parent.name
    if lowered == "extension":
        return Path(track["path"]).suffix.lstrip(".").lower()
    if lowered == "decade":
        year = track.get("year")
        try:
            return f"{int(year) // 10 * 10}s" if year is not None else ""
        except (TypeError, ValueError):
            return ""
    if lowered == "rating_bucket":
        rating = track.get("rating")
        if rating is None:
            return "Unrated"
        try:
            stars = float(rating)
        except (TypeError, ValueError):
            return ""
        if stars >= 4.5:
            return "Favorite"
        if stars >= 3.5:
            return "Liked"
        if stars >= 2.5:
            return "Neutral"
        return "Low priority"
    raise ValueError(f"Unknown token: {token}")


def render_virtual_tag_expression(expression: str, track: dict, custom_tags: dict[str, str | None]) -> str:
    # Virtual tags are deliberately template-based for now: they are inspectable,
    # reversible, and do not allow arbitrary code execution from saved formulas.
    def replace(match: re.Match[str]) -> str:
        token = match.group(1) or match.group(2) or ""
        return virtual_tag_value(token, track, custom_tags)

    return VIRTUAL_TOKEN_RE.sub(replace, expression)


@app.get("/library/tools/virtual-tags", response_model=list[VirtualTagDefinition])
def list_virtual_tag_definitions() -> list[VirtualTagDefinition]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, expression, created_at, updated_at
            FROM virtual_tag_definitions
            ORDER BY lower(name)
            """
        ).fetchall()
    return [VirtualTagDefinition(**dict(row)) for row in rows]


@app.post("/library/tools/virtual-tags", response_model=VirtualTagDefinition)
def save_virtual_tag_definition(request: VirtualTagDefinitionRequest) -> VirtualTagDefinition:
    with connect() as conn:
        row = conn.execute(
            """
            INSERT INTO virtual_tag_definitions(name, expression, updated_at)
            VALUES(?, ?, datetime('now'))
            ON CONFLICT(name) DO UPDATE SET
              expression = excluded.expression,
              updated_at = datetime('now')
            RETURNING id, name, expression, created_at, updated_at
            """,
            (request.name, request.expression),
        ).fetchone()
        conn.commit()
    if row is None:
        raise HTTPException(status_code=400, detail="Could not save virtual tag")
    return VirtualTagDefinition(**dict(row))


@app.delete("/library/tools/virtual-tags/{definition_id}")
def delete_virtual_tag_definition(definition_id: int) -> dict[str, bool]:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM virtual_tag_definitions WHERE id = ?", (definition_id,))
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Virtual tag was not found")
    return {"deleted": True}


@app.post("/library/tools/virtual-tags/preview", response_model=VirtualTagPreviewResponse)
def preview_virtual_tag(request: VirtualTagPreviewRequest) -> VirtualTagPreviewResponse:
    previews: list[VirtualTagPreview] = []
    with connect() as conn:
        rows = tool_track_rows_with_path_key(conn, request.track_ids, request.limit)
        custom_by_track = custom_tags_for_tracks(conn, [int(row["id"]) for row in rows])
        for track in rows:
            try:
                value = render_virtual_tag_expression(request.expression, track, custom_by_track.get(int(track["id"]), {}))
                previews.append(VirtualTagPreview(track_id=int(track["id"]), path=track["path"], title=track.get("title"), value=value))
            except ValueError as exc:
                previews.append(
                    VirtualTagPreview(
                        track_id=int(track["id"]),
                        path=track["path"],
                        title=track.get("title"),
                        error=str(exc),
                    )
                )
    return VirtualTagPreviewResponse(expression=request.expression, total=len(previews), previews=previews)


@app.post("/library/tools/copy-swap-tags", response_model=TagFieldCopySwapResponse)
def copy_or_swap_tag_fields(request: TagFieldCopySwapRequest) -> TagFieldCopySwapResponse:
    parse_tag_field_ref(request.source_field)
    parse_tag_field_ref(request.target_field)
    if request.source_field.strip().lower() == request.target_field.strip().lower():
        raise HTTPException(status_code=400, detail="Choose two different fields")

    previews: list[TagFieldCopySwapPreview] = []
    changed = 0
    applied = 0
    batch_id = new_undo_batch_id("copy-swap-tags") if request.apply else None
    with connect() as conn:
        rows = tool_track_rows_with_path_key(conn, request.track_ids, request.limit)
        custom_by_track = custom_tags_for_tracks(conn, [int(row["id"]) for row in rows])
        for track in rows:
            track_id = int(track["id"])
            custom_tags = custom_by_track.get(track_id, {})
            source_value = tag_field_value(track, custom_tags, request.source_field)
            target_value = tag_field_value(track, custom_tags, request.target_field)
            new_source = target_value if request.action == "swap" else source_value
            new_target = source_value
            if request.action == "copy" and request.missing_only and not tag_value_missing(target_value):
                new_target = target_value
            changed_here = new_source != source_value or new_target != target_value
            preview = TagFieldCopySwapPreview(
                track_id=track_id,
                path=track["path"],
                source_field=request.source_field,
                target_field=request.target_field,
                current_source=source_value,
                current_target=target_value,
                new_source=new_source,
                new_target=new_target,
                changed=changed_here,
            )
            if changed_here:
                changed += 1
            if request.apply and changed_here:
                try:
                    changed_fields = [request.target_field]
                    updates = {request.target_field: new_target}
                    if request.action == "swap":
                        changed_fields.append(request.source_field)
                        updates[request.source_field] = new_source
                    write_bulk_undo_log(
                        conn,
                        "advanced_tag_edit",
                        f"{request.action.title()} {request.source_field} and {request.target_field}",
                        advanced_tag_restore_payload(track, custom_tags, changed_fields, "copy_swap_tags"),
                        batch_id,
                    )
                    apply_tag_field_updates(conn, track_id, updates)
                    preview.applied = True
                    applied += 1
                except HTTPException as exc:
                    preview.error = str(exc.detail)
            previews.append(preview)
        if request.apply:
            conn.commit()
    return TagFieldCopySwapResponse(total=len(previews), changed=changed, applied=applied, previews=previews)


def resolve_tag_backup_path(backup_path: str | None, default_name: str | None = None) -> Path:
    text = backup_path.strip() if backup_path else ""
    if text:
        target = Path(text).expanduser()
        if not target.is_absolute():
            target = (TAG_BACKUP_DIR / target).resolve()
    elif default_name:
        target = TAG_BACKUP_DIR / default_name
    else:
        raise HTTPException(status_code=400, detail="Tag backup path is required")
    if target.suffix.lower() != ".json":
        target = target.with_suffix(".json")
    return target


def tag_backup_payload(conn, request: TagBackupRequest, created_at: str) -> tuple[dict[str, object], int]:
    tracks = tool_track_rows_with_path_key(conn, request.track_ids, request.limit)
    custom_by_track = custom_tags_for_tracks(conn, [int(track["id"]) for track in tracks]) if request.include_custom_tags else {}
    entries = []
    custom_count = 0
    for track in tracks:
        tags = custom_by_track.get(int(track["id"]), {})
        custom_count += len(tags)
        entries.append(
            {
                "track": {field: track.get(field) for field in ["path_key", *TRACK_FIELD_NAMES]},
                "metadata": {field: track.get(field) for field in TAG_TOOL_CORE_FIELDS},
                "custom_tags": tags,
            }
        )
    return (
        {
            "format": "flac-cafe-tag-backup-v1",
            "created_at": created_at,
            "track_count": len(entries),
            "include_custom_tags": request.include_custom_tags,
            "tracks": entries,
        },
        custom_count,
    )


@app.post("/library/tools/tag-backups", response_model=TagBackupResponse)
def create_tag_backup(request: TagBackupRequest) -> TagBackupResponse:
    created_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = resolve_tag_backup_path(request.backup_path, f"flac-cafe-tags-{stamp}.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        payload, custom_count = tag_backup_payload(conn, request, created_at)
    try:
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not write tag backup: {exc}") from exc
    return TagBackupResponse(
        backup_path=str(target),
        track_count=int(payload["track_count"]),
        custom_tag_count=custom_count,
        created_at=created_at,
    )


@app.get("/library/tools/tag-backups", response_model=list[TagBackupSummary])
def list_tag_backups(limit: int = Query(default=30, ge=1, le=200)) -> list[TagBackupSummary]:
    if not TAG_BACKUP_DIR.exists():
        return []
    summaries: list[TagBackupSummary] = []
    for path in sorted(TAG_BACKUP_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)[:limit]:
        created_at = None
        track_count = 0
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            created_at = payload.get("created_at") if isinstance(payload, dict) else None
            if isinstance(payload, dict):
                track_count = int(payload.get("track_count") or 0)
        except (OSError, json.JSONDecodeError, ValueError):
            pass
        try:
            size_bytes = path.stat().st_size
        except OSError:
            size_bytes = 0
        summaries.append(
            TagBackupSummary(
                backup_path=str(path),
                file_name=path.name,
                track_count=track_count,
                created_at=created_at,
                size_bytes=size_bytes,
            )
        )
    return summaries


def load_tag_backup(path: Path) -> dict[str, object]:
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=400, detail="Tag backup file does not exist")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not read tag backup: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("format") != "flac-cafe-tag-backup-v1":
        raise HTTPException(status_code=400, detail="Unsupported tag backup format")
    return payload


def backup_entry_track(conn, entry: dict[str, object], allowed_ids: set[int] | None) -> dict | None:
    track = entry.get("track")
    if not isinstance(track, dict):
        return None
    track_id = track.get("id")
    path_key_value = track.get("path_key")
    path_text = track.get("path")
    select_columns = f"path_key, {TRACK_COLUMNS}"
    if isinstance(track_id, int) and (allowed_ids is None or track_id in allowed_ids):
        row = conn.execute(f"SELECT {select_columns} FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if row is not None:
            return dict(row)
    if isinstance(path_key_value, str):
        row = conn.execute(f"SELECT {select_columns} FROM tracks WHERE path_key = ?", (path_key_value,)).fetchone()
        if row is not None and (allowed_ids is None or int(row["id"]) in allowed_ids):
            return dict(row)
    if isinstance(path_text, str):
        try:
            key = path_key(Path(path_text))
        except OSError:
            key = None
        if key:
            row = conn.execute(f"SELECT {select_columns} FROM tracks WHERE path_key = ?", (key,)).fetchone()
            if row is not None and (allowed_ids is None or int(row["id"]) in allowed_ids):
                return dict(row)
    return None


@app.post("/library/tools/tag-backups/restore", response_model=TagBackupRestoreResponse)
def restore_tag_backup(request: TagBackupRestoreRequest) -> TagBackupRestoreResponse:
    source = resolve_tag_backup_path(request.backup_path)
    payload = load_tag_backup(source)
    entries = payload.get("tracks")
    if not isinstance(entries, list):
        raise HTTPException(status_code=400, detail="Tag backup has no tracks")
    entries = entries[: request.limit]
    allowed_ids = set(request.track_ids) if request.track_ids else None
    previews: list[TagBackupRestorePreview] = []
    errors: list[str] = []
    matched = 0
    changed = 0
    applied = 0
    batch_id = new_undo_batch_id("tag-backup-restore") if request.apply else None
    with connect() as conn:
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            preview = TagBackupRestorePreview()
            try:
                track = backup_entry_track(conn, entry, allowed_ids)
                if track is None:
                    preview.error = "No library track matched this backup entry"
                    errors.append(preview.error)
                    previews.append(preview)
                    continue
                track_id = int(track["id"])
                preview.track_id = track_id
                preview.path = track["path"]
                preview.matched = True
                matched += 1
                current_custom = custom_tags_for_tracks(conn, [track_id]).get(track_id, {})
                current_values = {field: track.get(field) for field in TAG_TOOL_CORE_FIELDS}
                if request.restore_custom_tags:
                    current_values.update({f"custom:{key}": value for key, value in current_custom.items()})
                preview.current = current_values

                restored_values: dict[str, object | None] = {}
                metadata = entry.get("metadata")
                if isinstance(metadata, dict):
                    for field in TAG_TOOL_CORE_FIELDS:
                        if field in metadata:
                            restored_values[field] = metadata.get(field)
                custom_tags = entry.get("custom_tags")
                if request.restore_custom_tags and isinstance(custom_tags, dict):
                    for key, value in custom_tags.items():
                        restored_values[f"custom:{clean_custom_tag_key(str(key))}"] = None if value is None else str(value)
                preview.restored = restored_values

                changes: dict[str, object | None] = {}
                for field, value in restored_values.items():
                    current = tag_field_value(track, current_custom, field)
                    if request.missing_only and not tag_value_missing(current):
                        continue
                    if not csv_values_equal(current, value):
                        changes[field] = value
                preview.changed_fields = sorted(changes.keys())
                if changes:
                    changed += 1

                if request.apply and changes:
                    write_bulk_undo_log(
                        conn,
                        "tag_backup_restore",
                        f"Restored tag backup for {track.get('title') or Path(track['path']).name}",
                        advanced_tag_restore_payload(track, current_custom, list(changes.keys()), "tag_backup_restore"),
                        batch_id,
                    )
                    apply_tag_field_updates(conn, track_id, changes)
                    preview.applied = True
                    applied += 1
            except (HTTPException, ValueError) as exc:
                message = str(exc.detail) if isinstance(exc, HTTPException) else str(exc)
                preview.error = message
                errors.append(message)
            previews.append(preview)
        if request.apply:
            conn.commit()
    return TagBackupRestoreResponse(
        backup_path=str(source),
        total=len(entries),
        matched=matched,
        changed=changed,
        applied=applied,
        errors=errors[:100],
        previews=previews,
    )


@app.post("/library/tools/infer-tags", response_model=FilenameTagInferenceResponse)
def infer_tags_from_filenames(request: FilenameTagInferenceRequest) -> FilenameTagInferenceResponse:
    previews: list[FilenameTagInferencePreview] = []
    matches = 0
    applied = 0
    with connect() as conn:
        library_path = get_setting(conn, "library_path")
        library_root = Path(library_path).expanduser().resolve() if library_path else None
        rows = tool_track_rows(conn, request.track_ids, request.limit)
        for track in rows:
            inferred = infer_metadata_from_filename(Path(track["path"]), request.pattern, library_root) or {}
            changes = changed_metadata(track, inferred, request.missing_only) if inferred else {}
            preview = FilenameTagInferencePreview(
                track_id=int(track["id"]),
                path=track["path"],
                matched=bool(inferred),
                current=current_metadata(track),
                inferred=inferred,
                changed_fields=sorted(changes.keys()),
            )
            if inferred:
                matches += 1
            if request.apply and changes:
                try:
                    apply_track_metadata_update(conn, int(track["id"]), changes)
                    preview.applied = True
                    applied += 1
                except HTTPException as exc:
                    preview.error = str(exc.detail)
            previews.append(preview)
        if request.apply:
            conn.commit()
    return FilenameTagInferenceResponse(total=len(previews), matches=matches, applied=applied, previews=previews)


@app.post("/library/tools/regex-tags", response_model=TagRegexReplaceResponse)
def regex_replace_tags(request: TagRegexReplaceRequest) -> TagRegexReplaceResponse:
    try:
        expression = re.compile(request.pattern, 0 if request.case_sensitive else re.IGNORECASE)
    except re.error as exc:
        raise HTTPException(status_code=400, detail=f"Invalid regular expression: {exc}") from exc

    previews: list[TagRegexReplacePreview] = []
    changed = 0
    applied = 0
    batch_id = new_undo_batch_id("regex-tags") if request.apply else None
    with connect() as conn:
        rows = tool_track_rows(conn, request.track_ids, request.limit)
        for track in rows:
            current_value = track.get(request.field)
            current_text = None if current_value is None else str(current_value)
            replacement = expression.sub(request.replacement, current_text) if current_text is not None else None
            changed_here = current_text is not None and replacement != current_text
            preview = TagRegexReplacePreview(
                track_id=int(track["id"]),
                path=track["path"],
                field=request.field,
                current=current_text,
                replacement=replacement,
                changed=changed_here,
            )
            if changed_here:
                changed += 1
            if request.apply and changed_here:
                try:
                    changes = {request.field: replacement}
                    write_bulk_undo_log(
                        conn,
                        "regex_metadata_replace",
                        f"Regex tag replace on {track.get('title') or Path(track['path']).name}",
                        {
                            "track": track,
                            "changes": changes,
                            "field": request.field,
                            "pattern": request.pattern,
                            "replacement": request.replacement,
                        },
                        batch_id,
                    )
                    apply_track_metadata_update(conn, int(track["id"]), changes)
                    preview.applied = True
                    applied += 1
                except HTTPException as exc:
                    preview.error = str(exc.detail)
            previews.append(preview)
        if request.apply:
            conn.commit()
    return TagRegexReplaceResponse(total=len(previews), changed=changed, applied=applied, previews=previews)


def auto_tag_candidate_tracks(conn, request: AutoTagRequest) -> tuple[list[dict], list[int]]:
    if request.album_id is not None:
        return album_track_rows(conn, request.album_id)[: request.limit], []
    if request.track_ids:
        return tracks_by_ids(conn, request.track_ids[: request.limit])

    where_clause = ""
    if request.missing_only:
        where_clause = """
        WHERE title IS NULL OR trim(title) = ''
           OR artist IS NULL OR trim(artist) = ''
           OR album IS NULL OR trim(album) = ''
           OR genre IS NULL OR trim(genre) = ''
           OR year IS NULL
        """
    return rows_to_dicts(
        conn.execute(
            f"""
            SELECT path_key, {TRACK_COLUMNS}
            FROM tracks
            {where_clause}
            ORDER BY datetime(date_added) DESC, id DESC
            LIMIT ?
            """,
            (request.limit,),
        )
    ), []


@app.post("/library/tools/autotag", response_model=AutoTagResponse)
def auto_tag_musicbrainz(request: AutoTagRequest) -> AutoTagResponse:
    with connect() as conn:
        tracks, missing_ids = auto_tag_candidate_tracks(conn, request)
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Track not found: {missing_ids[0]}")

    previews = preview_auto_tags(
        tracks,
        mode=request.mode,
        missing_only=request.missing_only,
        candidate_limit=request.candidate_limit,
        include_artwork=request.include_artwork,
    )

    applied = 0
    artwork_saved = 0
    errors: list[str] = []
    if request.apply:
        batch_id = new_undo_batch_id("autotag")
        saved_release_ids: set[str] = set()
        with connect() as conn:
            for preview in previews:
                track_id = int(preview["track_id"])
                if preview.get("error"):
                    errors.append(f"Track {track_id}: {preview['error']}")
                    continue
                changes = metadata_changes(preview.get("current") or {}, preview.get("proposed") or {}, request.missing_only)
                try:
                    if changes:
                        row = conn.execute(
                            f"SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE id = ?",
                            (track_id,),
                        ).fetchone()
                        if row is None:
                            raise HTTPException(status_code=404, detail="Track not found")
                        write_bulk_undo_log(
                            conn,
                            "musicbrainz_auto_tag",
                            f"MusicBrainz auto-tag: {row['title'] or Path(row['path']).name}",
                            {
                                "track": dict(row),
                                "changes": changes,
                                "source": "musicbrainz",
                                "release_id": preview.get("release_id"),
                                "recording_id": preview.get("recording_id"),
                            },
                            batch_id,
                        )
                        apply_track_metadata_update(conn, track_id, changes)
                        preview["applied"] = True
                        applied += 1

                    release_id = str(preview.get("release_id") or "")
                    artwork_url = str(preview.get("artwork_url") or "")
                    if request.save_artwork and artwork_url and release_id and release_id not in saved_release_ids:
                        saved_path = save_auto_tag_artwork(conn, track_id, release_id, artwork_url)
                        if saved_path:
                            saved_release_ids.add(release_id)
                            preview["artwork_saved"] = True
                            artwork_saved += 1
                except HTTPException as exc:
                    message = str(exc.detail)
                    preview["error"] = message
                    errors.append(f"Track {track_id}: {message}")
                except Exception as exc:
                    message = str(exc)
                    preview["error"] = message
                    errors.append(f"Track {track_id}: {message}")
            conn.commit()

    matched = sum(1 for preview in previews if not preview.get("error"))
    changed = sum(1 for preview in previews if preview.get("changed_fields"))
    artwork_matches = sum(1 for preview in previews if preview.get("artwork_url"))
    return AutoTagResponse(
        total=len(previews),
        matched=matched,
        changed=changed,
        applied=applied,
        artwork_matches=artwork_matches,
        artwork_saved=artwork_saved,
        errors=errors[:100],
        previews=[AutoTagPreview(**preview) for preview in previews],
    )


@app.post("/library/tools/organize-files", response_model=FileOrganizationResponse)
def organize_files_from_tags(request: FileOrganizationRequest) -> FileOrganizationResponse:
    with connect() as conn:
        library_path = get_setting(conn, "library_path")
        library_root = Path(library_path).expanduser().resolve() if library_path else None
        base_folder = Path(request.base_folder or library_path or APP_STORAGE_ROOT / "organized-library").expanduser().resolve()
        rows = tool_track_rows(conn, request.track_ids, request.limit)
        changes: list[FileOrganizationChange] = []
        applied = 0
        removed_empty_folders = 0
        batch_id = new_undo_batch_id("file-organize") if request.apply else None
        for track in rows:
            current_path = Path(track["path"])
            target_path = organization_target_path(track, base_folder, request.template)
            initial_target_path = target_path
            changed = path_key(current_path) != path_key(initial_target_path)
            collision = initial_target_path.exists() and path_key(current_path) != path_key(initial_target_path)
            if changed and collision and request.collision_strategy == "auto_rename":
                try:
                    target_path = unique_collision_path(initial_target_path)
                except OSError:
                    target_path = initial_target_path
            change = FileOrganizationChange(
                track_id=int(track["id"]),
                title=track.get("title"),
                artist=track.get("artist"),
                current_path=str(current_path),
                target_path=str(target_path),
                changed=changed,
                collision=collision,
            )
            if request.apply and changed:
                if not current_path.exists():
                    change.error = "Source file is missing"
                elif collision and request.collision_strategy == "skip":
                    change.error = "Target file already exists"
                else:
                    try:
                        source_parent = current_path.parent
                        target_path.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(current_path), str(target_path))
                        modified_at = datetime.fromtimestamp(target_path.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat()
                        old_key = track["path_key"] if "path_key" in track else path_key(current_path)
                        new_key = path_key(target_path)
                        conn.execute(
                            """
                            UPDATE tracks
                            SET path = ?, path_key = ?, file_modified_at = ?, updated_at = datetime('now')
                            WHERE id = ?
                            """,
                            (str(target_path), new_key, modified_at, int(track["id"])),
                        )
                        conn.execute("DELETE FROM track_metadata_cache WHERE path_key IN (?, ?)", (old_key, new_key))
                        write_bulk_undo_log(
                            conn,
                            "file_organization",
                            f"Moved {track.get('title') or current_path.name}",
                            {
                                "track_id": int(track["id"]),
                                "from": str(current_path),
                                "to": str(target_path),
                                "previous_path_key": old_key,
                                "new_path_key": new_key,
                            },
                            batch_id,
                        )
                        change.applied = True
                        applied += 1
                        if request.cleanup_empty_folders:
                            removed_empty_folders += remove_empty_source_folders(source_parent, library_root)
                    except OSError as exc:
                        change.error = f"Could not move file: {exc}"
            changes.append(change)
        if request.apply:
            conn.commit()
    return FileOrganizationResponse(
        template=request.template,
        base_folder=str(base_folder),
        total=len(changes),
        changes=changes,
        changed_count=sum(1 for change in changes if change.changed),
        applied=applied,
        removed_empty_folders=removed_empty_folders,
    )


@app.post("/library/tools/organize-files/report", response_model=FileOrganizationReportResponse)
def export_file_organization_report(request: FileOrganizationReportRequest) -> FileOrganizationReportResponse:
    preview_request = FileOrganizationRequest(
        template=request.template,
        base_folder=request.base_folder,
        track_ids=request.track_ids,
        collision_strategy=request.collision_strategy,
        cleanup_empty_folders=request.cleanup_empty_folders,
        apply=False,
        limit=request.limit,
    )
    response = organize_files_from_tags(preview_request)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = resolve_json_tool_path(request.report_path, f"flac-cafe-file-organization-{stamp}.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "template": response.template,
        "base_folder": response.base_folder,
        "total": response.total,
        "changed_count": response.changed_count,
        "changes": [change.model_dump(mode="json") for change in response.changes],
    }
    try:
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not write file organization report: {exc}") from exc
    return FileOrganizationReportResponse(
        report_path=str(target),
        total=response.total,
        changed_count=response.changed_count,
        collisions=sum(1 for change in response.changes if change.collision),
    )


@app.post("/library/tools/device-sync", response_model=DeviceSyncResponse)
def sync_device_folder(request: DeviceSyncRequest) -> DeviceSyncResponse:
    target_root = Path(request.target_folder).expanduser().resolve()
    if request.apply:
        try:
            target_root.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Could not create target folder: {exc}") from exc

    with connect() as conn:
        library_path = get_setting(conn, "library_path")
        library_root = Path(library_path).expanduser().resolve() if library_path else None
        tracks, playlist_map = device_sync_track_rows(conn, request)
        playlists = {
            int(row["id"]): row["name"]
            for row in conn.execute(
                "SELECT id, name FROM playlists ORDER BY lower(name)"
            ).fetchall()
        }

    changes: list[DeviceSyncChange] = []
    target_paths: dict[int, Path] = {}
    copied_files = 0
    skipped_files = 0
    for track in tracks:
        source = Path(track["path"]).expanduser()
        target = track_device_sync_target(track, target_root, library_root, request.preserve_structure, request.music_subfolder)
        target_paths[int(track["id"])] = target
        change = DeviceSyncChange(
            track_id=int(track["id"]),
            title=track.get("title"),
            artist=track.get("artist"),
            source_path=str(source),
            target_path=str(target),
        )
        if not source.exists() or not source.is_file():
            change.error = "Source file is missing"
            skipped_files += 1
        else:
            change.changed = path_needs_copy(source, target)
            if request.copy_files and request.apply and change.changed:
                try:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, target)
                    change.applied = True
                    copied_files += 1
                except OSError as exc:
                    change.error = f"Could not copy file: {exc}"
                    skipped_files += 1
            elif not change.changed:
                skipped_files += 1
        changes.append(change)

    playlist_exports: list[DeviceSyncPlaylistExport] = []
    playlists_written = 0
    if request.export_playlists:
        for playlist_id in dict.fromkeys(request.playlist_ids):
            name = playlists.get(playlist_id)
            playlist_path = target_root / safe_subfolder(request.playlist_subfolder, "Playlists") / f"{sanitize_path_component(name or f'Playlist {playlist_id}')}.m3u8"
            export = DeviceSyncPlaylistExport(
                playlist_id=playlist_id,
                name=name or f"Playlist {playlist_id}",
                playlist_path=str(playlist_path),
                track_count=len(playlist_map.get(playlist_id, [])),
            )
            if name is None:
                export.error = "Playlist not found"
            elif request.apply:
                try:
                    write_device_playlist(
                        playlist_path,
                        playlist_map.get(playlist_id, []),
                        target_paths,
                        request.copy_files,
                    )
                    export.applied = True
                    playlists_written += 1
                except OSError as exc:
                    export.error = f"Could not write playlist: {exc}"
            playlist_exports.append(export)

    return DeviceSyncResponse(
        target_folder=str(target_root),
        total_tracks=len(tracks),
        changed_files=sum(1 for change in changes if change.changed),
        copied_files=copied_files,
        skipped_files=skipped_files,
        playlists_written=playlists_written,
        changes=changes,
        playlist_exports=playlist_exports,
    )


@app.get("/library/tools/device-sync/devices", response_model=DeviceSyncDevicesResponse)
def get_device_sync_devices() -> DeviceSyncDevicesResponse:
    return DeviceSyncDevicesResponse(**detected_device_sync_devices())


@app.get("/library/tools/device-sync/profiles", response_model=DeviceSyncProfilesResponse)
def get_device_sync_profiles() -> DeviceSyncProfilesResponse:
    return DeviceSyncProfilesResponse(**list_device_sync_profiles())


@app.post("/library/tools/device-sync/profiles", response_model=DeviceSyncProfile)
def create_device_sync_profile(request: DeviceSyncProfilePayload) -> DeviceSyncProfile:
    profile = save_device_sync_profile(request)
    if profile is None:
        raise HTTPException(status_code=400, detail="Could not save device sync profile")
    return DeviceSyncProfile(**profile)


@app.patch("/library/tools/device-sync/profiles/{profile_id}", response_model=DeviceSyncProfile)
def update_device_sync_profile(profile_id: int, request: DeviceSyncProfilePayload) -> DeviceSyncProfile:
    profile = save_device_sync_profile(request, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Device sync profile not found")
    return DeviceSyncProfile(**profile)


@app.delete("/library/tools/device-sync/profiles/{profile_id}")
def remove_device_sync_profile(profile_id: int) -> dict:
    if not delete_device_sync_profile(profile_id):
        raise HTTPException(status_code=404, detail="Device sync profile not found")
    return {"deleted": True}


@app.post("/library/tools/export-metadata-csv", response_model=CsvMetadataExportResponse)
def export_metadata_csv(request: CsvMetadataExportRequest) -> CsvMetadataExportResponse:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = resolve_csv_tool_path(request.csv_path, f"flac-cafe-metadata-{stamp}.csv")
    target.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        rows = metadata_csv_rows(conn, request.track_ids, request.limit)
    try:
        with target.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=METADATA_CSV_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                writer.writerow({column: row.get(column) for column in METADATA_CSV_COLUMNS})
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not write CSV: {exc}") from exc
    return CsvMetadataExportResponse(csv_path=str(target), track_count=len(rows), columns=METADATA_CSV_COLUMNS)


@app.post("/library/tools/import-metadata-csv", response_model=CsvMetadataImportResponse)
def import_metadata_csv(request: CsvMetadataImportRequest) -> CsvMetadataImportResponse:
    return build_metadata_csv_import_response(request)


@app.post("/library/tools/import-metadata-csv/report", response_model=CsvMetadataImportReportResponse)
def export_metadata_csv_import_report(request: CsvMetadataImportReportRequest) -> CsvMetadataImportReportResponse:
    preview_request = CsvMetadataImportRequest(
        csv_path=request.csv_path,
        track_ids=request.track_ids,
        column_map=request.column_map,
        missing_only=request.missing_only,
        clear_blank_fields=request.clear_blank_fields,
        apply=False,
        limit=request.limit,
    )
    response = build_metadata_csv_import_response(preview_request)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = resolve_json_tool_path(request.report_path, f"flac-cafe-csv-import-report-{stamp}.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "csv_path": response.csv_path,
        "missing_only": request.missing_only,
        "total": response.total,
        "matched": response.matched,
        "changed": response.changed,
        "errors": response.errors,
        "previews": [preview.model_dump(mode="json") for preview in response.previews],
    }
    try:
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not write CSV import report: {exc}") from exc
    return CsvMetadataImportReportResponse(
        report_path=str(target),
        csv_path=response.csv_path,
        total=response.total,
        matched=response.matched,
        changed=response.changed,
        errors=len(response.errors),
    )


@app.post("/library/duplicates/action", response_model=DuplicateActionResponse)
def apply_duplicate_action(request: DuplicateActionRequest) -> DuplicateActionResponse:
    errors: list[str] = []
    removed_track_ids: list[int] = []
    deleted_files = 0
    if request.action == "export_report":
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        target = resolve_json_tool_path(request.report_path, f"flac-cafe-duplicates-{stamp}.json")
        target.parent.mkdir(parents=True, exist_ok=True)
        selected_ids = set(request.track_ids)
        groups = duplicate_groups_for_report()
        if selected_ids:
            groups = [
                group
                for group in groups
                if any(track.get("id") in selected_ids for track in group.get("tracks", []))
            ]
        payload = {
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "groups": groups,
        }
        try:
            target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Could not write duplicate report: {exc}") from exc
        return DuplicateActionResponse(action=request.action, affected=len(groups), report_path=str(target))

    if request.action == "keep_best":
        groups = request.groups or ([request.track_ids] if request.track_ids else [])
        ids_to_remove: list[int] = []
        batch_id = new_undo_batch_id("duplicate-keep")
        with connect() as conn:
            for group in groups:
                unique_ids = list(dict.fromkeys(group))
                if len(unique_ids) < 2:
                    continue
                placeholders = ",".join("?" for _ in unique_ids)
                tracks = rows_to_dicts(conn.execute(f"SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})", unique_ids))
                keep_id, _reason = duplicate_keep_recommendation(tracks)
                ids_to_remove.extend(int(track["id"]) for track in tracks if int(track["id"]) != keep_id)
            removed_track_ids, deleted_files, errors = remove_tracks_for_action(conn, ids_to_remove, request.delete_files, batch_id)
            conn.commit()
        return DuplicateActionResponse(
            action=request.action,
            affected=len(removed_track_ids),
            removed_track_ids=removed_track_ids,
            deleted_files=deleted_files,
            errors=errors,
        )

    batch_id = new_undo_batch_id("duplicate-remove")
    with connect() as conn:
        removed_track_ids, deleted_files, errors = remove_tracks_for_action(conn, request.track_ids, request.delete_files, batch_id)
        conn.commit()
    return DuplicateActionResponse(
        action=request.action,
        affected=len(removed_track_ids),
        removed_track_ids=removed_track_ids,
        deleted_files=deleted_files,
        errors=errors,
    )


@app.post("/library/duplicates/review", response_model=DuplicateReviewResponse)
def review_duplicates(request: DuplicateReviewRequest) -> DuplicateReviewResponse:
    groups: list[DuplicateGroup] = []
    missing: list[int] = []
    with connect() as conn:
        selected_tracks, missing_ids = tracks_by_ids(conn, request.track_ids[: request.limit])
        missing.extend(missing_ids)
        if request.groups:
            for index, group_ids in enumerate(request.groups[: request.limit], start=1):
                group_tracks, group_missing = tracks_by_ids(conn, group_ids)
                missing.extend(group_missing)
                if len(group_tracks) > 1:
                    groups.append(duplicate_group_from_tracks(f"Review group {index}", group_tracks, "selected review group"))
        elif len(selected_tracks) > 1:
            groups.append(duplicate_group_from_tracks("Selected tracks", selected_tracks, "selected review set"))
        if not selected_tracks and not request.groups:
            health = library_health(limit=request.limit)
            groups = health.duplicate_groups
            seen: dict[int, dict] = {}
            for group in groups:
                for track in group.tracks:
                    seen[track.id] = track.model_dump(mode="json")
            selected_tracks = list(seen.values())
    return DuplicateReviewResponse(
        tracks=[Track(**track) for track in selected_tracks],
        groups=groups,
        missing_track_ids=list(dict.fromkeys(missing)),
    )


@app.get("/library/tools/acoustic-fingerprints/setup", response_model=ChromaprintStatusResponse)
def get_chromaprint_setup() -> ChromaprintStatusResponse:
    with connect() as conn:
        return chromaprint_status(conn)


@app.patch("/library/tools/acoustic-fingerprints/setup", response_model=ChromaprintStatusResponse)
def update_chromaprint_setup(request: ChromaprintConfigRequest) -> ChromaprintStatusResponse:
    with connect() as conn:
        text = request.fpcalc_path.strip() if request.fpcalc_path else ""
        if not text:
            set_setting(conn, "chromaprint_fpcalc_path", None)
            conn.commit()
            return chromaprint_status(conn)
        candidate = Path(text).expanduser()
        executable = "fpcalc.exe" if os.name == "nt" else "fpcalc"
        if candidate.is_dir():
            candidate = candidate / executable
        if not candidate.exists() or not candidate.is_file():
            status = chromaprint_status(conn)
            status.configured_path = text
            status.errors.append(f"fpcalc was not found at {candidate}")
            status.message = "The saved path was not valid. Choose fpcalc.exe or put it in the FLAC Cafe tool folder."
            return status
        set_setting(conn, "chromaprint_fpcalc_path", str(candidate.resolve()))
        conn.commit()
        return chromaprint_status(conn)


@app.post("/library/tools/acoustic-fingerprints/install", response_model=ChromaprintInstallResponse)
def install_chromaprint_tool(request: ChromaprintInstallRequest) -> ChromaprintInstallResponse:
    if os.name != "nt":
        return ChromaprintInstallResponse(
            installed=False,
            source_url=request.source_url or CHROMAPRINT_WINDOWS_URL,
            message="Guided Chromaprint install is currently Windows-only. Save an fpcalc path instead.",
            errors=["Unsupported platform for the bundled Windows fpcalc package."],
        )

    source_url = request.source_url or CHROMAPRINT_WINDOWS_URL
    tool_dir = chromaprint_tool_dir()
    archive_path = tool_dir / "chromaprint-fpcalc.zip"
    tool_dir.mkdir(parents=True, exist_ok=True)
    try:
        api_request = urlrequest.Request(source_url, headers={"User-Agent": "FLAC-Cafe"})
        with urlrequest.urlopen(api_request, timeout=60) as response:
            archive_path.write_bytes(response.read())
        with zipfile.ZipFile(archive_path) as archive:
            fpcalc_members = [name for name in archive.namelist() if Path(name).name.lower() == "fpcalc.exe"]
            if not fpcalc_members:
                raise OSError("Downloaded archive did not contain fpcalc.exe")
            member = fpcalc_members[0]
            with archive.open(member) as source, (tool_dir / "fpcalc.exe").open("wb") as target:
                shutil.copyfileobj(source, target)
        archive_path.unlink(missing_ok=True)
        fpcalc_path = tool_dir / "fpcalc.exe"
        with connect() as conn:
            set_setting(conn, "chromaprint_fpcalc_path", str(fpcalc_path.resolve()))
            conn.commit()
        return ChromaprintInstallResponse(
            installed=True,
            fpcalc_path=str(fpcalc_path.resolve()),
            source_url=source_url,
            message="Chromaprint fpcalc was installed for FLAC Cafe.",
        )
    except (OSError, zipfile.BadZipFile, TimeoutError, urlerror.URLError) as exc:
        return ChromaprintInstallResponse(
            installed=False,
            source_url=source_url,
            message="Could not install Chromaprint fpcalc automatically.",
            errors=[str(exc)],
        )


@app.post("/library/tools/acoustic-fingerprints", response_model=AcousticFingerprintResponse)
def run_acoustic_fingerprint_pass(request: AcousticFingerprintRequest) -> AcousticFingerprintResponse:
    processed = 0
    updated = 0
    skipped = 0
    errors: list[str] = []
    with connect() as conn:
        fpcalc_path, _configured, candidates = resolve_fpcalc_path(conn)
        if fpcalc_path is None:
            return AcousticFingerprintResponse(
                tool_available=False,
                errors=[
                    "Chromaprint fpcalc was not found. Save a path in File Management or place fpcalc.exe in "
                    f"{chromaprint_tool_dir()}.",
                    *[f"Checked: {candidate}" for candidate in candidates[:6]],
                ],
            )
        rows = tool_track_rows(conn, request.track_ids, request.limit)
        for track in rows:
            if track.get("acoustic_fingerprint") and not request.overwrite:
                skipped += 1
                continue
            processed += 1
            path = Path(track["path"])
            if not path.exists():
                errors.append(f"{track['path']}: missing file")
                continue
            try:
                fingerprint = acoustic_fingerprint_for_path(path, str(fpcalc_path))
            except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
                errors.append(f"{path.name}: {exc}")
                continue
            conn.execute(
                """
                UPDATE tracks
                SET acoustic_fingerprint = ?,
                    acoustic_fingerprint_updated_at = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (
                    fingerprint,
                    datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                    int(track["id"]),
                ),
            )
            updated += 1
        conn.commit()
    return AcousticFingerprintResponse(
        tool_available=True,
        processed=processed,
        updated=updated,
        skipped=skipped,
        errors=errors[:100],
    )


@app.get("/library/tools/undo-log", response_model=list[BulkUndoLogEntry])
def list_bulk_undo_log(limit: int = Query(default=30, ge=1, le=200)) -> list[BulkUndoLogEntry]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, batch_id, action_type, summary, payload_json, created_at
            FROM bulk_action_undo_log
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    entries: list[BulkUndoLogEntry] = []
    for row in rows:
        try:
            payload = json.loads(row["payload_json"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        entries.append(
            BulkUndoLogEntry(
                id=int(row["id"]),
                batch_id=row["batch_id"],
                action_type=row["action_type"],
                summary=row["summary"],
                payload=payload,
                created_at=row["created_at"],
            )
        )
    return entries


@app.get("/library/tools/undo-batches", response_model=list[BulkUndoBatchEntry])
def list_bulk_undo_batches(limit: int = Query(default=30, ge=1, le=200)) -> list[BulkUndoBatchEntry]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT batch_id,
                   action_type,
                   count(*) AS entries,
                   min(created_at) AS first_created_at,
                   max(created_at) AS last_created_at,
                   min(summary) AS summary
            FROM bulk_action_undo_log
            WHERE batch_id IS NOT NULL AND trim(batch_id) <> ''
              AND action_type IN (
                'csv_metadata_import', 'regex_metadata_replace', 'musicbrainz_auto_tag',
                'file_organization', 'track_remove', 'advanced_tag_edit', 'tag_backup_restore'
              )
            GROUP BY batch_id, action_type
            ORDER BY datetime(max(created_at)) DESC, max(id) DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        BulkUndoBatchEntry(
            batch_id=row["batch_id"],
            action_type=row["action_type"],
            entries=int(row["entries"]),
            summary=row["summary"],
            first_created_at=row["first_created_at"],
            last_created_at=row["last_created_at"],
        )
        for row in rows
    ]


@app.post("/library/tools/undo-batches/{batch_id}/restore", response_model=BulkUndoRestoreResponse)
def restore_bulk_undo_batch(batch_id: str) -> BulkUndoRestoreResponse:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, batch_id, action_type, summary, payload_json, created_at
            FROM bulk_action_undo_log
            WHERE batch_id = ?
              AND action_type IN ('csv_metadata_import', 'regex_metadata_replace', 'musicbrainz_auto_tag', 'file_organization', 'track_remove')
            ORDER BY id DESC
            """,
            (batch_id,),
        ).fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail="Undo batch was not found")
        affected: list[int] = []
        errors: list[str] = []
        action_type = rows[0]["action_type"]
        for row in rows:
            try:
                payload = json.loads(row["payload_json"] or "{}")
            except json.JSONDecodeError:
                errors.append(f"Entry {row['id']}: invalid payload")
                continue
            entry_affected, entry_errors = restore_bulk_undo_entry(conn, row["action_type"], payload)
            affected.extend(entry_affected)
            errors.extend(f"Entry {row['id']}: {error}" for error in entry_errors)
        restored = not errors
        if affected:
            write_bulk_undo_log(
                conn,
                "undo_restore",
                f"Restored batch {batch_id}",
                {
                    "restored_batch_id": batch_id,
                    "restored_action_type": action_type,
                    "affected_track_ids": affected,
                    "errors": errors,
                },
            )
        conn.commit()
    return BulkUndoRestoreResponse(
        entry_id=0,
        batch_id=batch_id,
        action_type=action_type,
        restored=restored,
        affected_track_ids=list(dict.fromkeys(affected)),
        errors=errors[:100],
    )


@app.post("/library/tools/undo-log/{entry_id}/restore", response_model=BulkUndoRestoreResponse)
def restore_bulk_undo_log_entry(entry_id: int) -> BulkUndoRestoreResponse:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, batch_id, action_type, summary, payload_json, created_at
            FROM bulk_action_undo_log
            WHERE id = ?
            """,
            (entry_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Undo log entry was not found")
        try:
            payload = json.loads(row["payload_json"] or "{}")
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Undo log entry payload is invalid") from exc
        affected, errors = restore_bulk_undo_entry(conn, row["action_type"], payload)
        restored = not errors
        if restored:
            write_bulk_undo_log(
                conn,
                "undo_restore",
                f"Restored {row['summary']}",
                {
                    "restored_entry_id": entry_id,
                    "restored_batch_id": row["batch_id"],
                    "restored_action_type": row["action_type"],
                    "affected_track_ids": affected,
                },
            )
        conn.commit()
    return BulkUndoRestoreResponse(
        entry_id=entry_id,
        batch_id=row["batch_id"],
        action_type=row["action_type"],
        restored=restored,
        affected_track_ids=affected,
        errors=errors,
    )


@app.post("/library/tools/reports/read", response_model=ReportFileResponse)
def read_report_file(request: ReportFileRequest) -> ReportFileResponse:
    target = resolve_existing_json_report_path(request.report_path)
    if not target.exists() or not target.is_file():
        return ReportFileResponse(report_path=str(target), exists=False, error="Report file does not exist")
    try:
        stat = target.stat()
        truncated = stat.st_size > request.max_bytes
        raw_bytes = target.read_bytes()[: request.max_bytes]
        raw_text = raw_bytes.decode("utf-8-sig", errors="replace")
        parsed_json = None
        error_message = None
        if not truncated:
            try:
                parsed_json = json.loads(raw_text)
            except json.JSONDecodeError as exc:
                error_message = f"Could not parse JSON: {exc}"
        return ReportFileResponse(
            report_path=str(target),
            exists=True,
            size_bytes=stat.st_size,
            modified_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc).replace(microsecond=0).isoformat(),
            parsed_json=parsed_json,
            raw_text=raw_text,
            truncated=truncated,
            error=error_message,
        )
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not read report: {exc}") from exc


@app.get("/smart-playlists/presets", response_model=dict[str, SmartPlaylistRule])
def smart_playlist_presets() -> dict[str, SmartPlaylistRule]:
    return SMART_PRESETS


@app.get("/smart-playlists", response_model=list[SmartPlaylistSummary])
def list_smart_playlists() -> list[SmartPlaylistSummary]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, rule_json, created_at, updated_at
            FROM smart_playlists
            ORDER BY lower(name) ASC
            """
        ).fetchall()
    return [
        SmartPlaylistSummary(
            id=row["id"],
            name=row["name"],
            rule=SmartPlaylistRule(**json.loads(row["rule_json"])),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]


@app.post("/smart-playlists", response_model=SmartPlaylistSummary)
def create_smart_playlist(request: SmartPlaylistCreateRequest) -> SmartPlaylistSummary:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Smart playlist name is required")
    rule_json = json.dumps(request.rule.model_dump(), ensure_ascii=True, sort_keys=True)
    with connect() as conn:
        try:
            conn.execute(
                "INSERT INTO smart_playlists(name, rule_json) VALUES(?, ?)",
                (name, rule_json),
            )
            conn.commit()
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="A smart playlist with that name already exists") from exc
        row = conn.execute(
            "SELECT id, name, rule_json, created_at, updated_at FROM smart_playlists WHERE name = ?",
            (name,),
        ).fetchone()
    return SmartPlaylistSummary(
        id=row["id"],
        name=row["name"],
        rule=SmartPlaylistRule(**json.loads(row["rule_json"])),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.delete("/smart-playlists/{smart_playlist_id}", response_model=list[SmartPlaylistSummary])
def delete_smart_playlist(smart_playlist_id: int) -> list[SmartPlaylistSummary]:
    with connect() as conn:
        row = conn.execute("SELECT id FROM smart_playlists WHERE id = ?", (smart_playlist_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Smart playlist not found")
        conn.execute("DELETE FROM smart_playlists WHERE id = ?", (smart_playlist_id,))
        conn.commit()
    return list_smart_playlists()


@app.post("/smart-playlists/preview", response_model=list[Track])
def preview_smart_playlist(rule: SmartPlaylistRule) -> list[dict]:
    return smart_tracks(rule)


@app.get("/smart-playlists/{smart_playlist_id}/tracks", response_model=list[Track])
def get_smart_playlist_tracks(smart_playlist_id: int) -> list[dict]:
    with connect() as conn:
        row = conn.execute("SELECT rule_json FROM smart_playlists WHERE id = ?", (smart_playlist_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    return smart_tracks(SmartPlaylistRule(**json.loads(row["rule_json"])))


@app.get("/albums", response_model=list[AlbumSummary])
def list_albums(
    search: str = "",
    limit: int = Query(default=5000, ge=1, le=20000),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    where_clause = ""
    params: list[object] = []
    if search.strip():
        where_clause = """
        WHERE lower(coalesce(albums.album, '') || ' ' || coalesce(albums.album_artist, '')) LIKE ?
        """
        params.append(f"%{search.strip().lower()}%")

    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT
                    albums.id,
                    albums.album,
                    albums.album_artist,
                    albums.year,
                    albums.artwork_path,
                    count(tracks.id) AS track_count,
                    sum(tracks.duration_seconds) AS duration_seconds,
                    avg(tracks.rating) AS average_rating,
                    min(tracks.id) AS artwork_track_id
                FROM albums
                JOIN tracks ON tracks.album_id = albums.id
                {where_clause}
                GROUP BY albums.id
                ORDER BY lower(coalesce(albums.album_artist, '')) ASC,
                         coalesce(albums.year, 9999) ASC,
                         lower(coalesce(albums.album, '')) ASC
                LIMIT ? OFFSET ?
                """,
                [*params, limit, offset],
            )
        )


@app.get("/albums/{album_id}/tracks", response_model=list[Track])
def album_tracks(album_id: int) -> list[dict]:
    with connect() as conn:
        return album_track_rows(conn, album_id)


@app.get("/albums/{album_id}/artwork")
def album_artwork(album_id: int) -> Response:
    with connect() as conn:
        album = album_record(conn, album_id)
        tracks = album_track_rows(conn, album_id)
    if album["artwork_path"]:
        selected = Path(album["artwork_path"]).expanduser()
        media_type = image_media_type(selected)
        if selected.exists() and selected.is_file() and media_type:
            try:
                return Response(
                    content=selected.read_bytes(),
                    media_type=media_type,
                    headers={"Cache-Control": "private, max-age=3600"},
                )
            except OSError as exc:
                raise HTTPException(status_code=404, detail=f"Could not read selected album artwork: {exc}") from exc

    for track in tracks:
        artwork = cached_artwork(Path(track["path"]))
        if artwork is not None:
            data, media_type = artwork
            return Response(
                content=data,
                media_type=media_type,
                headers={"Cache-Control": "private, max-age=3600"},
            )
    raise HTTPException(status_code=404, detail="No album artwork found")


@app.get("/albums/{album_id}/artwork-candidates", response_model=AlbumArtworkCandidatesResponse)
def list_album_artwork_candidates(album_id: int) -> AlbumArtworkCandidatesResponse:
    with connect() as conn:
        candidates = album_artwork_candidates(conn, album_id)
    return AlbumArtworkCandidatesResponse(album_id=album_id, candidates=candidates)


@app.get("/albums/{album_id}/artwork-search", response_model=AlbumArtworkSearchResponse)
def search_album_artwork(album_id: int, limit: int = Query(default=8, ge=1, le=20)) -> AlbumArtworkSearchResponse:
    with connect() as conn:
        candidates, errors = album_artwork_web_candidates(conn, album_id, limit)
    return AlbumArtworkSearchResponse(album_id=album_id, candidates=candidates, errors=errors)


@app.patch("/albums/{album_id}/artwork", response_model=AlbumArtworkUpdateResponse)
def update_album_artwork(album_id: int, request: AlbumArtworkUpdateRequest) -> AlbumArtworkUpdateResponse:
    with connect() as conn:
        album_record(conn, album_id)
        artwork_path: str | None = None
        artwork_data: bytes | None = None
        artwork_media_type: str | None = None
        embedded_updated = 0
        errors: list[str] = []
        if request.clear:
            conn.execute("UPDATE albums SET artwork_path = NULL WHERE id = ?", (album_id,))
        elif request.artwork_path:
            candidate = Path(request.artwork_path).expanduser().resolve()
            if not candidate.exists() or not candidate.is_file():
                raise HTTPException(status_code=400, detail="Artwork path must be a local jpg, png, or webp file")
            try:
                artwork_data, artwork_media_type = read_local_artwork(candidate)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            artwork_path = str(candidate)
            conn.execute("UPDATE albums SET artwork_path = ? WHERE id = ?", (artwork_path, album_id))
        elif request.embedded_track_id:
            tracks = album_track_rows(conn, album_id)
            track = next((item for item in tracks if int(item["id"]) == request.embedded_track_id), None)
            if track is None:
                raise HTTPException(status_code=404, detail="Embedded artwork track is not part of this album")
            artwork = cached_artwork(Path(track["path"]))
            if artwork is None:
                raise HTTPException(status_code=404, detail="Selected track has no readable embedded artwork")
            artwork_data, artwork_media_type = artwork
            if request.save_embedded_as_sidecar:
                folder = Path(track["path"]).expanduser().parent
                target = unique_sidecar_artwork_path(folder, request.sidecar_filename, artwork_media_type)
                try:
                    target.write_bytes(artwork_data)
                except OSError as exc:
                    raise HTTPException(status_code=400, detail=f"Could not save sidecar artwork: {exc}") from exc
                artwork_path = str(target.resolve())
                conn.execute("UPDATE albums SET artwork_path = ? WHERE id = ?", (artwork_path, album_id))
            elif not request.embed_to_files:
                raise HTTPException(status_code=400, detail="Embedded artwork must be saved as a sidecar or embedded into album files")
        elif request.artwork_url:
            try:
                artwork_data, artwork_media_type = download_cover_art(request.artwork_url)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            if request.save_web_as_sidecar:
                folder, _tracks = album_primary_folder_and_tracks(conn, album_id)
                target = unique_sidecar_artwork_path(folder, request.sidecar_filename, artwork_media_type)
                try:
                    target.write_bytes(artwork_data)
                except OSError as exc:
                    raise HTTPException(status_code=400, detail=f"Could not save web artwork: {exc}") from exc
                artwork_path = str(target.resolve())
                conn.execute("UPDATE albums SET artwork_path = ? WHERE id = ?", (artwork_path, album_id))
            elif not request.embed_to_files:
                raise HTTPException(status_code=400, detail="Web artwork must be saved as a sidecar or embedded into album files")
        else:
            raise HTTPException(status_code=400, detail="Choose artwork, save artwork as a sidecar, embed artwork, or clear the selection")

        if request.embed_to_files:
            if artwork_data is None or artwork_media_type is None:
                raise HTTPException(status_code=400, detail="No readable artwork was selected for embedding")
            try:
                embedded_updated, errors = embed_artwork_for_album(
                    conn,
                    album_id,
                    artwork_data,
                    artwork_media_type,
                    request.target_track_ids,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

        conn.execute("DELETE FROM artwork_cache")
        conn.commit()
        row = album_record(conn, album_id)
        candidates = album_artwork_candidates(conn, album_id)
    return AlbumArtworkUpdateResponse(
        album_id=album_id,
        artwork_path=row["artwork_path"],
        candidates=candidates,
        embedded_updated=embedded_updated,
        errors=errors,
    )


@app.post("/library/tools/artwork-collisions", response_model=AlbumArtworkCollisionResponse)
def artwork_collision_repair(request: AlbumArtworkCollisionRequest) -> AlbumArtworkCollisionResponse:
    errors: list[str] = []
    with connect() as conn:
        issues = album_folder_collision_issues(conn, request.limit)
        if not request.apply:
            return AlbumArtworkCollisionResponse(total=len(issues), issues=issues)

        repaired: list[AlbumArtworkCollisionIssue] = []
        for issue in issues:
            try:
                repaired.append(repair_album_artwork_collision(conn, issue))
            except Exception as exc:
                issue.error = str(exc)
                repaired.append(issue)
                errors.append(f"{issue.album or issue.album_id}: {exc}")
        conn.execute("DELETE FROM artwork_cache")
        conn.commit()

    repaired_count = sum(1 for issue in repaired if issue.repaired)
    return AlbumArtworkCollisionResponse(total=len(repaired), repaired=repaired_count, issues=repaired, errors=errors)


@app.get("/playlists", response_model=list[PlaylistSummary])
def list_playlists() -> list[dict]:
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                """
                SELECT
                    playlists.id,
                    playlists.name,
                    count(playlist_tracks.track_id) AS track_count,
                    sum(tracks.duration_seconds) AS duration_seconds,
                    playlists.created_at,
                    playlists.updated_at
                FROM playlists
                LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
                LEFT JOIN tracks ON tracks.id = playlist_tracks.track_id
                GROUP BY playlists.id
                ORDER BY lower(playlists.name) ASC
                """
            )
        )


@app.post("/playlists", response_model=PlaylistSummary)
def create_playlist(request: PlaylistCreateRequest) -> dict:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Playlist name is required")
    with connect() as conn:
        try:
            conn.execute("INSERT INTO playlists(name) VALUES(?)", (name,))
            conn.commit()
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="A playlist with that name already exists") from exc
        row = conn.execute(
            """
            SELECT id, name, 0 AS track_count, NULL AS duration_seconds, created_at, updated_at
            FROM playlists
            WHERE name = ?
            """,
            (name,),
        ).fetchone()
    return dict(row)


@app.delete("/playlists/{playlist_id}", response_model=list[PlaylistSummary])
def delete_playlist(playlist_id: int) -> list[dict]:
    with connect() as conn:
        row = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Playlist not found")
        conn.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
        conn.commit()
    return list_playlists()


@app.get("/playlists/{playlist_id}/tracks", response_model=list[Track])
def get_playlist_tracks(playlist_id: int) -> list[dict]:
    return playlist_tracks(playlist_id)


@app.post("/playlists/{playlist_id}/tracks", response_model=list[Track])
def add_playlist_tracks(playlist_id: int, request: PlaylistTrackRequest) -> list[dict]:
    seen: set[int] = set()
    track_ids = [track_id for track_id in request.track_ids if not (track_id in seen or seen.add(track_id))]
    with connect() as conn:
        playlist = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        if playlist is None:
            raise HTTPException(status_code=404, detail="Playlist not found")
        existing_tracks = {
            row["id"]
            for row in conn.execute(
                f"SELECT id FROM tracks WHERE id IN ({','.join('?' for _ in track_ids)})",
                track_ids,
            )
        }
        missing = [track_id for track_id in track_ids if track_id not in existing_tracks]
        if missing:
            raise HTTPException(status_code=404, detail=f"Track not found: {missing[0]}")

        max_position = conn.execute(
            "SELECT coalesce(max(position), 0) AS position FROM playlist_tracks WHERE playlist_id = ?",
            (playlist_id,),
        ).fetchone()["position"]
        position = int(max_position)
        for track_id in track_ids:
            position += 1
            conn.execute(
                """
                INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position)
                VALUES(?, ?, ?)
                """,
                (playlist_id, track_id, position),
            )
        compact_playlist_positions(conn, playlist_id)
        conn.execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
            (playlist_id,),
        )
        conn.commit()
    return playlist_tracks(playlist_id)


@app.delete("/playlists/{playlist_id}/tracks/{track_id}", response_model=list[Track])
def remove_playlist_track(playlist_id: int, track_id: int) -> list[dict]:
    with connect() as conn:
        playlist = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        if playlist is None:
            raise HTTPException(status_code=404, detail="Playlist not found")
        conn.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            (playlist_id, track_id),
        )
        compact_playlist_positions(conn, playlist_id)
        conn.execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
            (playlist_id,),
        )
        conn.commit()
    return playlist_tracks(playlist_id)


@app.patch("/playlists/{playlist_id}/tracks/{track_id}/move", response_model=list[Track])
def move_playlist_track(playlist_id: int, track_id: int, request: PlaylistMoveRequest) -> list[dict]:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, position
            FROM playlist_tracks
            WHERE playlist_id = ? AND track_id = ?
            """,
            (playlist_id, track_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Playlist track not found")
        operator = "<" if request.direction == "up" else ">"
        ordering = "DESC" if request.direction == "up" else "ASC"
        swap = conn.execute(
            f"""
            SELECT id, position
            FROM playlist_tracks
            WHERE playlist_id = ? AND position {operator} ?
            ORDER BY position {ordering}
            LIMIT 1
            """,
            (playlist_id, row["position"]),
        ).fetchone()
        if swap is not None:
            conn.execute("UPDATE playlist_tracks SET position = ? WHERE id = ?", (swap["position"], row["id"]))
            conn.execute("UPDATE playlist_tracks SET position = ? WHERE id = ?", (row["position"], swap["id"]))
            conn.execute("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?", (playlist_id,))
            conn.commit()
    return playlist_tracks(playlist_id)


@app.post("/playlists/{playlist_id}/export", response_model=ExportResponse)
def export_playlist(playlist_id: int, request: ExportRequest | None = None) -> ExportResponse:
    tracks = playlist_tracks(playlist_id)
    try:
        path, count = export_m3u(
            [track["id"] for track in tracks],
            request.playlist_path if request else None,
        )
        return ExportResponse(playlist_path=str(path), track_count=count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/playlists/import", response_model=PlaylistSummary)
def import_playlist(request: PlaylistImportRequest) -> dict:
    try:
        imported_paths = parse_playlist_paths(request.playlist_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    source = Path(request.playlist_path).expanduser()
    base_name = (request.name or source.stem or "Imported Playlist").strip()
    if not base_name:
        base_name = "Imported Playlist"

    keys = [path_key(path) for path in imported_paths]
    with connect() as conn:
        name = base_name
        suffix = 2
        while conn.execute("SELECT id FROM playlists WHERE name = ?", (name,)).fetchone() is not None:
            name = f"{base_name} {suffix}"
            suffix += 1

        conn.execute("INSERT INTO playlists(name) VALUES(?)", (name,))
        playlist_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        if keys:
            placeholders = ",".join("?" for _ in keys)
            found = {
                row["path_key"]: row["id"]
                for row in conn.execute(
                    f"SELECT id, path_key FROM tracks WHERE path_key IN ({placeholders})",
                    keys,
                )
            }
        else:
            found = {}

        position = 0
        for key in keys:
            track_id = found.get(key)
            if track_id is None:
                continue
            position += 1
            conn.execute(
                """
                INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position)
                VALUES(?, ?, ?)
                """,
                (playlist_id, track_id, position),
            )
        compact_playlist_positions(conn, playlist_id)
        conn.commit()
        row = conn.execute(
            """
            SELECT
                playlists.id,
                playlists.name,
                count(playlist_tracks.track_id) AS track_count,
                sum(tracks.duration_seconds) AS duration_seconds,
                playlists.created_at,
                playlists.updated_at
            FROM playlists
            LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
            LEFT JOIN tracks ON tracks.id = playlist_tracks.track_id
            WHERE playlists.id = ?
            GROUP BY playlists.id
            """,
            (playlist_id,),
        ).fetchone()
    return dict(row)


@app.post("/scan", response_model=ScanResult)
def scan_library(request: ScanRequest) -> ScanResult:
    try:
        return ScanResult(**scan_folder(request.folder_path).__dict__)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/scan/start", response_model=ScanStartResponse)
def start_scan_library(request: ScanRequest) -> dict:
    try:
        job = start_scan_job(request.folder_path)
        return {
            "job_id": job["job_id"],
            "folder_path": job["folder_path"],
            "status": job["status"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/scan/jobs/{job_id}", response_model=ScanProgress)
def get_scan_progress(job_id: str) -> dict:
    job = get_scan_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return job


@app.patch("/tracks/{track_id}/rating", response_model=Track)
def update_rating(track_id: int, request: RatingRequest) -> dict:
    with connect() as conn:
        updated = apply_track_rating_update(conn, track_id, request.rating)
        conn.commit()
    return updated


@app.head("/tracks/{track_id}/audio")
@app.get("/tracks/{track_id}/audio")
def stream_track_audio(track_id: int) -> FileResponse:
    path = get_track_path(track_id)
    return FileResponse(
        path,
        media_type=MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream"),
    )


@app.get("/tracks/{track_id}/artwork")
def track_artwork(track_id: int) -> Response:
    path = get_track_path(track_id)
    artwork = cached_artwork(path)
    if artwork is None:
        raise HTTPException(status_code=404, detail="No embedded artwork found")

    data, media_type = artwork
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@app.get("/tracks/{track_id}/lyrics", response_model=LyricsResponse)
def track_lyrics(track_id: int) -> LyricsResponse:
    path = get_track_path(track_id)
    found = database_lyrics(track_id) or embedded_lyrics(path) or sidecar_lyrics(path)
    if found is None:
        return LyricsResponse(track_id=track_id)

    lyrics, source, is_synced = found
    return LyricsResponse(track_id=track_id, lyrics=lyrics, source=source, is_synced=is_synced)


@app.post("/tracks/{track_id}/lyrics/fetch", response_model=LyricsResponse)
def fetch_track_lyrics(track_id: int) -> LyricsResponse:
    with connect() as conn:
        row = conn.execute(f"SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return lrclib_fetch(dict(row))


@app.patch("/tracks/{track_id}/lyrics", response_model=LyricsResponse)
def update_track_lyrics(track_id: int, request_body: LyricsUpdateRequest) -> LyricsResponse:
    path = get_track_path(track_id)
    text = normalize_lyrics(request_body.lyrics)
    if not text:
        with connect() as conn:
            conn.execute("DELETE FROM track_lyrics WHERE track_id = ?", (track_id,))
            conn.commit()
        return LyricsResponse(track_id=track_id)

    source = request_body.source or ("database:synced" if request_body.is_synced else "database:manual")
    if request_body.target == "file":
        try:
            write_track_lyrics(path, text, request_body.is_synced)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        source = f"embedded:{path.suffix.lower() or 'audio'}"

    return save_database_lyrics(track_id, text, source, request_body.is_synced)


@app.get("/artists/info", response_model=ArtistInfoResponse)
def artist_info(name: str, refresh: bool = False) -> ArtistInfoResponse:
    query_name = primary_artist_name(name)
    if not query_name:
        raise HTTPException(status_code=400, detail="Artist name is required")

    cached = cached_artist_info(query_name, refresh)
    if cached is not None:
        return cached

    try:
        info = fetch_artist_info_from_wikipedia(query_name)
    except (OSError, TimeoutError, urlerror.URLError, json.JSONDecodeError) as exc:
        stale = stale_artist_info(query_name, str(exc))
        if stale is not None:
            return stale
        return ArtistInfoResponse(
            artist_name=query_name,
            query=query_name,
            source="Wikipedia",
            found=False,
            error="Artist lookup is unavailable right now.",
        )

    return save_artist_info(query_name, info)


@app.delete("/artists/cache")
def clear_artist_cache() -> dict[str, int]:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM artist_info_cache")
        conn.commit()
    return {"deleted": cursor.rowcount if cursor.rowcount is not None else 0}


@app.get("/artists/local-tracks", response_model=list[Track])
def artist_local_tracks(
    name: str,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict]:
    artist = primary_artist_name(name)
    if not artist:
        raise HTTPException(status_code=400, detail="Artist name is required")
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE lower(coalesce(artist, '')) LIKE ?
                ORDER BY coalesce(rating, 0) DESC,
                         play_count DESC,
                         skip_count ASC,
                         lower(coalesce(album, '')) ASC,
                         coalesce(disc_number, 0) ASC,
                         coalesce(track_number, 0) ASC
                LIMIT ?
                """,
                (f"%{artist.lower()}%", limit),
            )
        )


@app.post("/tracks/{track_id}/played", response_model=Track)
def mark_track_played(track_id: int) -> dict:
    played_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    with connect() as conn:
        row = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Track not found")

        conn.execute(
            """
            UPDATE tracks
            SET play_count = play_count + 1,
                last_played_at = ?,
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (played_at, track_id),
        )
        conn.execute(
            """
            INSERT INTO play_events(track_id, event_type, metadata_json)
            VALUES(?, 'played', ?)
            """,
            (track_id, event_metadata(source="player")),
        )
        conn.commit()
        updated = conn.execute(
            f"""
            SELECT {TRACK_COLUMNS}
            FROM tracks
            WHERE id = ?
            """,
            (track_id,),
        ).fetchone()
    return dict(updated)


@app.post("/tracks/{track_id}/skipped", response_model=Track)
def mark_track_skipped(track_id: int) -> dict:
    skipped_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    with connect() as conn:
        row = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Track not found")

        conn.execute(
            """
            UPDATE tracks
            SET skip_count = skip_count + 1,
                last_skipped_at = ?,
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (skipped_at, track_id),
        )
        conn.execute(
            """
            INSERT INTO play_events(track_id, event_type, metadata_json)
            VALUES(?, 'skipped', ?)
            """,
            (track_id, event_metadata(source="player")),
        )
        conn.commit()
        updated = conn.execute(
            f"""
            SELECT {TRACK_COLUMNS}
            FROM tracks
            WHERE id = ?
            """,
            (track_id,),
        ).fetchone()
    return dict(updated)


@app.post("/autodj/generate", response_model=AutoDjResponse)
def generate_autodj(request: AutoDjRequest) -> AutoDjResponse:
    tracks = generate_queue(request)
    drift = recommendation_drift(tracks)
    record_recommendation_run(request, drift, tracks)
    return AutoDjResponse(tracks=tracks, settings=request, drift=drift)


def recommendation_warnings(drift: RecommendationDrift) -> list[str]:
    warnings: list[str] = []
    if drift.total_tracks == 0:
        return warnings
    if drift.repeat_artist_percent >= 35:
        warnings.append("This queue leans repetitive by artist. Increase artist cooldown or temperature.")
    if drift.exploration_percent >= 85:
        warnings.append("This queue is highly exploratory. Lower temperature or unrated exploration for a safer mix.")
    if drift.familiar_percent >= 90 and drift.unrated_percent <= 5:
        warnings.append("This queue is very familiar. Add a little unrated exploration for discovery.")
    if drift.clap_percent <= 10 and drift.total_tracks >= 10:
        warnings.append("Few tracks use CLAP similarity. Analyze more music to improve sound-based recommendations.")
    return warnings


def record_recommendation_run(request: AutoDjRequest, drift: RecommendationDrift, tracks: list[dict]) -> None:
    track_ids = [int(track["id"]) for track in tracks if track.get("id") is not None]
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO recommendation_runs(settings_json, drift_json, track_ids_json)
            VALUES(?, ?, ?)
            """,
            (
                json.dumps(request.model_dump(), ensure_ascii=True, sort_keys=True),
                json.dumps(drift.model_dump(), ensure_ascii=True, sort_keys=True),
                json.dumps(track_ids, ensure_ascii=True),
            ),
        )
        conn.execute(
            """
            DELETE FROM recommendation_runs
            WHERE id NOT IN (
              SELECT id FROM recommendation_runs ORDER BY datetime(created_at) DESC, id DESC LIMIT 100
            )
            """
        )
        conn.commit()


def recommendation_drift(tracks: list[dict]) -> RecommendationDrift:
    total = len(tracks)
    if total == 0:
        return RecommendationDrift()

    ratings = [float(track["rating"]) for track in tracks if track.get("rating") is not None]
    familiar = [
        track
        for track in tracks
        if (track.get("rating") is not None and float(track["rating"]) >= 4.0) or int(track.get("play_count") or 0) > 0
    ]
    exploratory = [track for track in tracks if track.get("rating") is None or int(track.get("play_count") or 0) == 0]
    unique_artists = {
        token
        for track in tracks
        for token in (artist_tokens(track.get("artist")) or {normalize_token(track.get("artist"))})
        if token
    }
    unique_albums = {album_token(track.get("album")) for track in tracks if album_token(track.get("album"))}
    clap_tracks = [
        track
        for track in tracks
        if track.get("analysis_provider") == "clap" and track.get("analysis_embedding")
    ]
    repeat_artist_percent = max(0.0, ((total - len(unique_artists)) / total) * 100) if unique_artists else 0.0
    drift = RecommendationDrift(
        total_tracks=total,
        familiar_percent=round((len(familiar) / total) * 100, 2),
        exploration_percent=round((len(exploratory) / total) * 100, 2),
        repeat_artist_percent=round(repeat_artist_percent, 2),
        unrated_percent=round((sum(1 for track in tracks if track.get("rating") is None) / total) * 100, 2),
        clap_percent=round((len(clap_tracks) / total) * 100, 2),
        average_rating=round(sum(ratings) / len(ratings), 2) if ratings else None,
        unique_artists=len(unique_artists),
        unique_albums=len(unique_albums),
    )
    drift.warnings = recommendation_warnings(drift)
    return drift


def challenger_autodj_settings(base: AutoDjRequest) -> AutoDjRequest:
    target_exploration = base.target_exploration_percent
    if target_exploration is None:
        target_exploration = min(100.0, max(base.unrated_exploration_percent + 12.0, 25.0))
    target_unrated = base.target_unrated_percent
    if target_unrated is None:
        target_unrated = min(80.0, base.unrated_exploration_percent + 8.0)
    return base.model_copy(
        update={
            "temperature": min(5.0, base.temperature + 0.35),
            "unrated_exploration_percent": min(80.0, base.unrated_exploration_percent + 8.0),
            "target_unrated_percent": target_unrated,
            "target_exploration_percent": target_exploration,
            "max_repeat_artist_percent": base.max_repeat_artist_percent
            if base.max_repeat_artist_percent is not None
            else 25.0,
        }
    )


def build_ab_queue(label: str, settings: AutoDjRequest) -> RecommendationAbQueue:
    tracks = generate_queue(settings)
    drift = recommendation_drift(tracks)
    record_recommendation_run(settings, drift, tracks)
    return RecommendationAbQueue(label=label, settings=settings, drift=drift, tracks=tracks)


@app.post("/autodj/ab-test", response_model=RecommendationAbTestResponse)
def create_recommendation_ab_test(request: RecommendationAbTestRequest) -> RecommendationAbTestResponse:
    seed = request.seed if request.seed is not None else int(datetime.now().timestamp()) % 1_000_000
    base = request.base_settings.model_copy(
        update={
            "seed": seed,
            "seed_track_id": request.seed_track_id
            if request.seed_track_id is not None
            else request.base_settings.seed_track_id,
        }
    )
    challenger_source = request.challenger_settings or challenger_autodj_settings(base)
    challenger = challenger_source.model_copy(
        update={
            "seed": seed + 1,
            "seed_track_id": request.seed_track_id
            if request.seed_track_id is not None
            else challenger_source.seed_track_id,
        }
    )
    return RecommendationAbTestResponse(
        test_id=str(uuid.uuid4()),
        generated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        queues=[
            build_ab_queue("A", base),
            build_ab_queue("B", challenger),
        ],
    )


@app.post("/autodj/ab-test/choose", response_model=RecommendationAbChoiceResponse)
def choose_recommendation_ab_test(request: RecommendationAbChoiceRequest) -> RecommendationAbChoiceResponse:
    track_ids = list(dict.fromkeys(int(track_id) for track_id in request.chosen_track_ids))
    if not track_ids:
        return RecommendationAbChoiceResponse(status="ok", chosen_label=request.chosen_label, inserted_feedback=0)
    placeholders = ",".join("?" for _ in track_ids)
    with connect() as conn:
        existing = {
            int(row["id"])
            for row in conn.execute(
                f"SELECT id FROM tracks WHERE id IN ({placeholders})",
                tuple(track_ids),
            ).fetchall()
        }
        inserted = 0
        for track_id in track_ids:
            if track_id not in existing:
                continue
            conn.execute(
                """
                INSERT INTO recommendation_feedback(track_id, event_type, weight)
                VALUES(?, 'add_to_queue', ?)
                """,
                (track_id, request.feedback_weight),
            )
            inserted += 1
        conn.commit()
    return RecommendationAbChoiceResponse(
        status="ok",
        chosen_label=request.chosen_label,
        inserted_feedback=inserted,
    )


def profile_from_row(row) -> RecommendationProfile:
    try:
        settings = AutoDjRequest.model_validate(json.loads(row["settings_json"]))
    except Exception:
        settings = AutoDjRequest()
    return RecommendationProfile(
        id=int(row["id"]),
        name=row["name"],
        settings=settings,
        is_default=bool(row["is_default"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def recommendation_run_from_row(row) -> RecommendationRun:
    try:
        settings = AutoDjRequest.model_validate(json.loads(row["settings_json"]))
    except Exception:
        settings = AutoDjRequest()
    try:
        drift = RecommendationDrift.model_validate(json.loads(row["drift_json"]))
    except Exception:
        drift = RecommendationDrift()
    try:
        track_ids = [int(value) for value in json.loads(row["track_ids_json"] or "[]")]
    except Exception:
        track_ids = []
    return RecommendationRun(
        id=int(row["id"]),
        settings=settings,
        drift=drift,
        track_ids=track_ids,
        created_at=row["created_at"],
    )


@app.get("/autodj/profiles", response_model=list[RecommendationProfile])
def list_recommendation_profiles() -> list[RecommendationProfile]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, settings_json, is_default, created_at, updated_at
            FROM recommendation_profiles
            ORDER BY is_default DESC, lower(name) ASC
            """
        ).fetchall()
    return [profile_from_row(row) for row in rows]


@app.get("/autodj/history", response_model=list[RecommendationRun])
def recommendation_history(limit: int = Query(default=30, ge=1, le=100)) -> list[RecommendationRun]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, settings_json, drift_json, track_ids_json, created_at
            FROM recommendation_runs
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [recommendation_run_from_row(row) for row in rows]


def build_recommendation_profile_comparisons(
    request: RecommendationProfileComparisonRequest,
) -> list[RecommendationProfileComparison]:
    with connect() as conn:
        if request.profile_ids:
            placeholders = ",".join("?" for _ in request.profile_ids)
            rows = conn.execute(
                f"""
                SELECT id, name, settings_json, is_default, created_at, updated_at
                FROM recommendation_profiles
                WHERE id IN ({placeholders})
                ORDER BY is_default DESC, lower(name) ASC
                """,
                tuple(request.profile_ids),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, name, settings_json, is_default, created_at, updated_at
                FROM recommendation_profiles
                ORDER BY is_default DESC, lower(name) ASC
                LIMIT 8
                """
            ).fetchall()

    comparisons: list[RecommendationProfileComparison] = []
    for row in rows[:8]:
        profile = profile_from_row(row)
        settings = profile.settings.model_copy(update={
            "seed_track_id": request.seed_track_id,
            "seed": request.seed,
        })
        tracks = generate_queue(settings)
        comparisons.append(
            RecommendationProfileComparison(
                profile=profile,
                drift=recommendation_drift(tracks),
                top_tracks=tracks[:5],
            )
        )
    return comparisons


@app.post("/autodj/profiles/compare", response_model=list[RecommendationProfileComparison])
def compare_recommendation_profiles(
    request: RecommendationProfileComparisonRequest,
) -> list[RecommendationProfileComparison]:
    return build_recommendation_profile_comparisons(request)


@app.post("/autodj/profiles/compare/export", response_model=RecommendationProfileComparisonExportResponse)
def export_recommendation_profile_comparison(
    request: RecommendationProfileComparisonRequest,
) -> RecommendationProfileComparisonExportResponse:
    comparisons = build_recommendation_profile_comparisons(request)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    target = EXPORT_DIR / f"flac-cafe-profile-comparison-{stamp}.json"
    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "seed": request.seed,
        "seed_track_id": request.seed_track_id,
        "comparisons": [comparison.model_dump(mode="json") for comparison in comparisons],
    }
    try:
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Could not write profile comparison: {exc}") from exc
    return RecommendationProfileComparisonExportResponse(export_path=str(target), profile_count=len(comparisons))


@app.post("/autodj/profiles/compare/import", response_model=RecommendationProfileComparisonImportResponse)
def import_recommendation_profile_comparison(
    request: RecommendationProfileComparisonImportRequest,
) -> RecommendationProfileComparisonImportResponse:
    path = Path(request.report_path)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Recommendation comparison report not found")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not read comparison report: {exc}") from exc
    raw_comparisons = payload.get("comparisons") if isinstance(payload, dict) else None
    if not isinstance(raw_comparisons, list):
        raise HTTPException(status_code=400, detail="Comparison report is missing a comparisons list")
    comparisons: list[RecommendationProfileComparison] = []
    for raw in raw_comparisons:
        try:
            comparisons.append(RecommendationProfileComparison.model_validate(raw))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid comparison entry: {exc}") from exc
    return RecommendationProfileComparisonImportResponse(
        report_path=str(path),
        generated_at=payload.get("generated_at"),
        seed=payload.get("seed"),
        seed_track_id=payload.get("seed_track_id"),
        comparisons=comparisons,
    )


@app.post("/autodj/profiles", response_model=RecommendationProfile)
def create_recommendation_profile(request: RecommendationProfileRequest) -> RecommendationProfile:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Profile name is required")
    settings_json = json.dumps(request.settings.model_dump(), ensure_ascii=True, sort_keys=True)
    with connect() as conn:
        if request.is_default:
            conn.execute("UPDATE recommendation_profiles SET is_default = 0")
        conn.execute(
            """
            INSERT INTO recommendation_profiles(name, settings_json, is_default)
            VALUES(?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
              settings_json = excluded.settings_json,
              is_default = excluded.is_default,
              updated_at = datetime('now')
            """,
            (name, settings_json, 1 if request.is_default else 0),
        )
        if request.is_default:
            conn.execute("UPDATE recommendation_profiles SET is_default = CASE WHEN lower(name) = lower(?) THEN 1 ELSE 0 END", (name,))
        conn.commit()
        row = conn.execute(
            """
            SELECT id, name, settings_json, is_default, created_at, updated_at
            FROM recommendation_profiles
            WHERE lower(name) = lower(?)
            """,
            (name,),
        ).fetchone()
    return profile_from_row(row)


@app.patch("/autodj/profiles/{profile_id}", response_model=RecommendationProfile)
def update_recommendation_profile(profile_id: int, request: RecommendationProfileRequest) -> RecommendationProfile:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Profile name is required")
    settings_json = json.dumps(request.settings.model_dump(), ensure_ascii=True, sort_keys=True)
    with connect() as conn:
        row = conn.execute("SELECT id FROM recommendation_profiles WHERE id = ?", (profile_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Recommendation profile not found")
        if request.is_default:
            conn.execute("UPDATE recommendation_profiles SET is_default = 0")
        conn.execute(
            """
            UPDATE recommendation_profiles
            SET name = ?, settings_json = ?, is_default = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (name, settings_json, 1 if request.is_default else 0, profile_id),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, name, settings_json, is_default, created_at, updated_at
            FROM recommendation_profiles
            WHERE id = ?
            """,
            (profile_id,),
        ).fetchone()
    return profile_from_row(row)


@app.post("/autodj/profiles/{profile_id}/default", response_model=list[RecommendationProfile])
def set_default_recommendation_profile(profile_id: int) -> list[RecommendationProfile]:
    with connect() as conn:
        row = conn.execute("SELECT id FROM recommendation_profiles WHERE id = ?", (profile_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Recommendation profile not found")
        conn.execute("UPDATE recommendation_profiles SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END", (profile_id,))
        conn.commit()
    return list_recommendation_profiles()


@app.delete("/autodj/profiles/{profile_id}", response_model=list[RecommendationProfile])
def delete_recommendation_profile(profile_id: int) -> list[RecommendationProfile]:
    with connect() as conn:
        conn.execute("DELETE FROM recommendation_profiles WHERE id = ?", (profile_id,))
        conn.commit()
    return list_recommendation_profiles()


def _avoid_key_and_label(request: AutoDjAvoidRequest) -> tuple[str, str]:
    track = None
    if request.track_id is not None:
        with connect() as conn:
            track = conn.execute(f"SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?", (request.track_id,)).fetchone()
        if track is None:
            raise HTTPException(status_code=404, detail="Track not found")
        track = dict(track)

    value = (request.value or "").strip()
    if request.scope == "track":
        if track is None:
            raise HTTPException(status_code=400, detail="Track avoid rules require track_id")
        return str(track["id"]), display_track_label(track)

    if request.scope == "artist":
        label = value or (track or {}).get("artist") or ""
        tokens = sorted(artist_tokens(label))
        key = tokens[0] if tokens else normalize_token(label)
    elif request.scope == "album":
        label = value or (track or {}).get("album") or ""
        key = album_token(label)
    else:
        label = value or (track or {}).get("analysis_genre") or (track or {}).get("genre") or ""
        tokens = sorted(text_tokens(label))
        key = tokens[0] if tokens else normalize_token(label)

    if not key:
        raise HTTPException(status_code=400, detail=f"No {request.scope} value available")
    return key, label or key


def display_track_label(track: dict) -> str:
    title = track.get("title") or "Untitled"
    artist = track.get("artist") or "Unknown artist"
    return f"{title} - {artist}"


@app.get("/autodj/avoid", response_model=list[AutoDjAvoidRule])
def list_autodj_avoid_rules() -> list[dict]:
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                """
                SELECT id, scope, target_key, label, created_at, updated_at
                FROM autodj_avoid_rules
                ORDER BY scope, lower(label)
                """
            )
        )


@app.post("/autodj/avoid", response_model=AutoDjAvoidRule)
def create_autodj_avoid_rule(request: AutoDjAvoidRequest) -> dict:
    key, label = _avoid_key_and_label(request)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO autodj_avoid_rules(scope, target_key, label)
            VALUES(?, ?, ?)
            ON CONFLICT(scope, target_key) DO UPDATE SET
              label = excluded.label,
              updated_at = datetime('now')
            """,
            (request.scope, key, label),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, scope, target_key, label, created_at, updated_at
            FROM autodj_avoid_rules
            WHERE scope = ? AND target_key = ?
            """,
            (request.scope, key),
        ).fetchone()
    return dict(row)


@app.delete("/autodj/avoid/{rule_id}", response_model=list[AutoDjAvoidRule])
def delete_autodj_avoid_rule(rule_id: int) -> list[dict]:
    with connect() as conn:
        conn.execute("DELETE FROM autodj_avoid_rules WHERE id = ?", (rule_id,))
        conn.commit()
    return list_autodj_avoid_rules()


@app.post("/autodj/feedback")
def record_recommendation_feedback(request: RecommendationFeedbackRequest) -> dict[str, str]:
    with connect() as conn:
        track = conn.execute("SELECT id FROM tracks WHERE id = ?", (request.track_id,)).fetchone()
        if track is None:
            raise HTTPException(status_code=404, detail="Track not found")
        conn.execute(
            """
            INSERT INTO recommendation_feedback(track_id, event_type, weight)
            VALUES(?, ?, ?)
            """,
            (request.track_id, request.event_type, request.weight),
        )
        conn.commit()
    return {"status": "ok"}


@app.post("/autodj/export", response_model=ExportResponse)
def export_autodj(request: ExportRequest) -> ExportResponse:
    try:
        path, count = export_m3u(request.track_ids, request.playlist_path)
        return ExportResponse(playlist_path=str(path), track_count=count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
