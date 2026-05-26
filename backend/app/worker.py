from __future__ import annotations

import base64
import inspect
import json
import sys
import traceback
from typing import Any, get_args, get_origin, get_type_hints

from pydantic import BaseModel, TypeAdapter, ValidationError


PYTHON_ACTIONS: frozenset[str] = frozenset(
    {
        "health",
        "get_startup_diagnostics",
        "get_backend_log",
        "build_support_bundle",
        "get_settings",
        "update_settings",
        "remove_library_source",
        "get_clap_status",
        "install_clap_dependencies",
        "get_clap_install",
        "get_clap_coverage",
        "update_clap_config",
        "start_clap_audio_analysis",
        "get_clap_audio_analysis",
        "pause_clap_audio_analysis",
        "resume_clap_audio_analysis",
        "cancel_clap_audio_analysis",
        "backup_database",
        "reset_local_data",
        "list_tracks",
        "list_track_page",
        "get_tracks_batch",
        "write_track_metadata_to_files",
        "get_track",
        "update_track_metadata",
        "delete_track",
        "delete_tracks",
        "sync_track_metadata_from_files",
        "restore_track",
        "play_history",
        "play_history_stats",
        "library_stats",
        "library_inbox",
        "review_inbox_tracks",
        "update_inbox_note",
        "list_inbox_auto_review_rules",
        "create_inbox_auto_review_rule",
        "update_inbox_auto_review_rule",
        "delete_inbox_auto_review_rule",
        "get_folder_watch",
        "start_folder_watch",
        "stop_folder_watch",
        "refresh_folder_watch",
        "apply_folder_watch",
        "acknowledge_folder_watch_notifications_route",
        "get_audio_conversion_setup",
        "update_audio_conversion_setup",
        "install_audio_conversion_ffmpeg",
        "start_audio_conversion_ffmpeg_install",
        "get_audio_conversion_ffmpeg_install",
        "preview_audio_conversion",
        "start_audio_conversion",
        "get_audio_conversion_progress",
        "cancel_audio_conversion",
        "get_cd_rip_setup",
        "get_cd_rip_metadata",
        "start_cd_rip",
        "get_cd_rip_progress",
        "cancel_cd_rip",
        "play_cd_track_route",
        "stream_cd_live_audio",
        "stop_cd_playback_route",
        "export_audiobook_sync_metadata",
        "get_podcast_subscriptions",
        "create_podcast_subscription",
        "update_podcast_subscription",
        "remove_podcast_subscription",
        "ensure_podcast_subscription_folder_route",
        "refresh_podcast_subscription_route",
        "get_podcast_episodes",
        "download_podcast_episode_route",
        "delete_podcast_episode_download_route",
        "ensure_podcast_episode_track_route",
        "get_scrobble_accounts",
        "update_scrobble_account",
        "start_lastfm_login_route",
        "complete_lastfm_login_route",
        "get_scrobble_outbox",
        "queue_scrobbling_history",
        "submit_scrobbling_outbox",
        "import_scrobbling_history",
        "validate_gapless_playback",
        "list_extensions",
        "reload_extensions",
        "import_external_library_stats",
        "library_health",
        "clear_library_caches",
        "list_regex_tag_presets",
        "save_regex_tag_preset",
        "delete_regex_tag_preset",
        "batch_custom_tags",
        "list_virtual_tag_definitions",
        "save_virtual_tag_definition",
        "delete_virtual_tag_definition",
        "preview_virtual_tag",
        "copy_or_swap_tag_fields",
        "create_tag_backup",
        "list_tag_backups",
        "restore_tag_backup",
        "infer_tags_from_filenames",
        "regex_replace_tags",
        "auto_tag_musicbrainz",
        "clap_genre_tags",
        "volume_tags",
        "organize_files_from_tags",
        "export_file_organization_report",
        "sync_device_folder",
        "get_device_sync_devices",
        "get_device_sync_profiles",
        "create_device_sync_profile",
        "update_device_sync_profile",
        "remove_device_sync_profile",
        "export_metadata_csv",
        "import_metadata_csv",
        "export_metadata_csv_import_report",
        "apply_duplicate_action",
        "review_duplicates",
        "get_chromaprint_setup",
        "update_chromaprint_setup",
        "run_acoustic_fingerprint_pass",
        "list_bulk_undo_log",
        "list_bulk_undo_batches",
        "restore_bulk_undo_batch",
        "restore_bulk_undo_log_entry",
        "read_report_file",
        "list_albums",
        "lookup_album_completion",
        "album_tracks",
        "album_artwork",
        "list_album_artwork_candidates",
        "search_album_artwork",
        "update_album_artwork",
        "artwork_collision_repair",
        "list_playlists",
        "create_playlist",
        "delete_playlist",
        "get_playlist_tracks",
        "add_playlist_tracks",
        "remove_playlist_track",
        "move_playlist_track",
        "export_playlist",
        "import_playlist",
        "scan_library",
        "start_scan_library",
        "get_scan_progress",
        "update_rating",
        "stream_track_audio",
        "track_artwork",
        "track_lyrics",
        "fetch_track_lyrics",
        "lookup_lyrics_by_metadata",
        "update_track_lyrics",
        "list_artists",
        "artist_info",
        "clear_artist_cache",
        "artist_local_tracks",
        "mark_track_played",
        "mark_track_skipped",
        "generate_autodj",
        "create_recommendation_ab_test",
        "choose_recommendation_ab_test",
        "list_recommendation_profiles",
        "recommendation_history",
        "compare_recommendation_profiles",
        "export_recommendation_profile_comparison",
        "import_recommendation_profile_comparison",
        "create_recommendation_profile",
        "update_recommendation_profile",
        "set_default_recommendation_profile",
        "delete_recommendation_profile",
        "list_autodj_avoid_rules",
        "create_autodj_avoid_rule",
        "delete_autodj_avoid_rule",
        "record_recommendation_feedback",
        "export_autodj",
    }
)


_APP_MODULE: Any | None = None


def _load_actions_module() -> Any:
    global _APP_MODULE
    if _APP_MODULE is not None:
        return _APP_MODULE

    from .database import init_db

    from . import main as app_module

    app_module.configure_backend_file_logging()
    init_db()
    _APP_MODULE = app_module
    return app_module


def _is_list_annotation(annotation: Any) -> bool:
    origin = get_origin(annotation)
    return origin in (list, tuple, set)


def _is_model_annotation(annotation: Any) -> bool:
    try:
        return inspect.isclass(annotation) and issubclass(annotation, BaseModel)
    except TypeError:
        return False


def _can_use_body(annotation: Any) -> bool:
    if annotation is inspect.Parameter.empty:
        return True
    if _is_model_annotation(annotation):
        return True
    origin = get_origin(annotation)
    return any(_is_model_annotation(arg) for arg in get_args(annotation)) if origin else False


def _validate_value(annotation: Any, value: Any) -> Any:
    if annotation is inspect.Parameter.empty:
        return value
    return TypeAdapter(annotation).validate_python(value)


def _validate_query_constraints(value: Any, query: Any) -> None:
    if query.ge is not None and value < query.ge:
        raise ValueError(f"Value must be greater than or equal to {query.ge}")
    if query.le is not None and value > query.le:
        raise ValueError(f"Value must be less than or equal to {query.le}")
    if query.min_length is not None and len(value) < query.min_length:
        raise ValueError(f"Value must have at least {query.min_length} characters")
    if query.max_length is not None and len(value) > query.max_length:
        raise ValueError(f"Value must have at most {query.max_length} characters")


def _param_value(annotation: Any, raw: Any) -> Any:
    if isinstance(raw, list) and not _is_list_annotation(annotation):
        return raw[-1] if raw else None
    return raw


def _bind_action_arguments(
    function: Any,
    params: dict[str, Any],
    body: Any,
    metadata_only: bool = False,
) -> dict[str, Any]:
    from .worker_types import ActionParam, WorkerContext

    signature = inspect.signature(function)
    hints = get_type_hints(function)
    remaining_params = dict(params)
    kwargs: dict[str, Any] = {}
    body_used = False
    for name, param in signature.parameters.items():
        annotation = hints.get(name, param.annotation)
        default = param.default
        if annotation is WorkerContext:
            kwargs[name] = WorkerContext(metadata_only=metadata_only)
        elif name in remaining_params:
            value = _validate_value(annotation, _param_value(annotation, remaining_params.pop(name)))
            if isinstance(default, ActionParam):
                _validate_query_constraints(value, default)
            kwargs[name] = value
        elif isinstance(default, ActionParam):
            if default.required:
                raise ValueError(f"Missing required action parameter: {name}")
            kwargs[name] = default.default
        elif body is not None and not body_used and _can_use_body(annotation):
            kwargs[name] = _validate_value(annotation, body)
            body_used = True
        elif default is not inspect.Parameter.empty:
            kwargs[name] = default
        elif body is not None and not body_used:
            kwargs[name] = _validate_value(annotation, body)
            body_used = True
        else:
            raise ValueError(f"Missing required action parameter: {name}")
    return kwargs


def _jsonable(value: Any) -> Any:
    from .worker_types import to_jsonable

    return to_jsonable(value)


def _result_envelope(result: Any, metadata_only: bool = False) -> dict[str, Any]:
    from .worker_types import Response

    if isinstance(result, Response):
        headers = {str(key).lower(): str(value) for key, value in result.headers.items()}
        body = b"" if metadata_only else result.body
        return {
            "ok": True,
            "code": result.status_code,
            "headers": headers,
            "is_json": False,
            "omit_content_length": result.omit_content_length,
            "body_base64": base64.b64encode(body).decode("ascii"),
        }
    return {
        "ok": True,
        "code": 200,
        "headers": {"content-type": "application/json"},
        "is_json": True,
        "body": _jsonable(result),
    }


def dispatch(payload: dict[str, Any]) -> dict[str, Any]:
    from .worker_types import ActionError

    action = str(payload.get("action") or "").strip()
    if action not in PYTHON_ACTIONS:
        raise ValueError(f"Unknown Python worker action: {action or '<empty>'}")
    params = payload.get("params") if isinstance(payload.get("params"), dict) else {}
    body = payload.get("body")
    metadata_only = bool(payload.get("metadata_only"))

    app_module = _load_actions_module()
    function = getattr(app_module, action, None)
    if function is None or not callable(function):
        raise ValueError(f"Python worker action is not callable: {action}")

    try:
        kwargs = _bind_action_arguments(function, params, body, metadata_only=metadata_only)
        return _result_envelope(function(**kwargs), metadata_only=metadata_only)
    except ActionError as exc:
        return {
            "ok": False,
            "code": exc.status_code,
            "headers": {"content-type": "application/json"},
            "is_json": True,
            "body": {"detail": _jsonable(exc.detail)},
        }
    except ValidationError as exc:
        return {
            "ok": False,
            "code": 422,
            "headers": {"content-type": "application/json"},
            "is_json": True,
            "body": {"detail": exc.errors()},
        }
    except ValueError as exc:
        return {
            "ok": False,
            "code": 422,
            "headers": {"content-type": "application/json"},
            "is_json": True,
            "body": {"detail": str(exc)},
        }


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw or "{}")
        result = dispatch(payload)
    except Exception as exc:
        result = {
            "ok": False,
            "code": 500,
            "headers": {"content-type": "application/json"},
            "is_json": True,
            "body": {
                "detail": f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc(limit=12),
            },
        }
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
