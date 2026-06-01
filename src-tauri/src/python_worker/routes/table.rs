static PYTHON_ROUTES: &[PythonRoute] = &[
    PythonRoute {
        method: "GET",
        template: "/health",
        action: "health",
    },
    PythonRoute {
        method: "GET",
        template: "/diagnostics/startup",
        action: "get_startup_diagnostics",
    },
    PythonRoute {
        method: "GET",
        template: "/diagnostics/logs/backend",
        action: "get_backend_log",
    },
    PythonRoute {
        method: "POST",
        template: "/diagnostics/support-bundle",
        action: "build_support_bundle",
    },
    PythonRoute {
        method: "GET",
        template: "/diagnostics/python-worker-usage",
        action: "get_python_worker_usage",
    },
    PythonRoute {
        method: "GET",
        template: "/settings",
        action: "get_settings",
    },
    PythonRoute {
        method: "PATCH",
        template: "/settings",
        action: "update_settings",
    },
    PythonRoute {
        method: "POST",
        template: "/settings/library-sources/remove",
        action: "remove_library_source",
    },
    PythonRoute {
        method: "GET",
        template: "/analysis/clap/status",
        action: "get_clap_status",
    },
    PythonRoute {
        method: "POST",
        template: "/analysis/clap/install",
        action: "install_clap_dependencies",
    },
    PythonRoute {
        method: "GET",
        template: "/analysis/clap/install/{job_id}",
        action: "get_clap_install",
    },
    PythonRoute {
        method: "GET",
        template: "/analysis/clap/coverage",
        action: "get_clap_coverage",
    },
    PythonRoute {
        method: "PATCH",
        template: "/analysis/clap/config",
        action: "update_clap_config",
    },
    PythonRoute {
        method: "POST",
        template: "/analysis/clap/start",
        action: "start_clap_audio_analysis",
    },
    PythonRoute {
        method: "GET",
        template: "/analysis/clap/jobs/{job_id}",
        action: "get_clap_audio_analysis",
    },
    PythonRoute {
        method: "POST",
        template: "/analysis/clap/jobs/{job_id}/pause",
        action: "pause_clap_audio_analysis",
    },
    PythonRoute {
        method: "POST",
        template: "/analysis/clap/jobs/{job_id}/resume",
        action: "resume_clap_audio_analysis",
    },
    PythonRoute {
        method: "POST",
        template: "/analysis/clap/jobs/{job_id}/cancel",
        action: "cancel_clap_audio_analysis",
    },
    PythonRoute {
        method: "POST",
        template: "/settings/backup",
        action: "backup_database",
    },
    PythonRoute {
        method: "POST",
        template: "/settings/reset-local-data",
        action: "reset_local_data",
    },
    PythonRoute {
        method: "GET",
        template: "/tracks",
        action: "list_tracks",
    },
    PythonRoute {
        method: "GET",
        template: "/tracks/page",
        action: "list_track_page",
    },
    PythonRoute {
        method: "POST",
        template: "/tracks/batch",
        action: "get_tracks_batch",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/write-metadata-to-files",
        action: "write_track_metadata_to_files",
    },
    PythonRoute {
        method: "POST",
        template: "/tracks/write-metadata-to-files",
        action: "write_track_metadata_to_files",
    },
    PythonRoute {
        method: "GET",
        template: "/tracks/{track_id}",
        action: "get_track",
    },
    PythonRoute {
        method: "PATCH",
        template: "/tracks/{track_id}/metadata",
        action: "update_track_metadata",
    },
    PythonRoute {
        method: "DELETE",
        template: "/tracks/{track_id}",
        action: "delete_track",
    },
    PythonRoute {
        method: "POST",
        template: "/tracks/delete",
        action: "delete_tracks",
    },
    PythonRoute {
        method: "POST",
        template: "/tracks/sync-metadata",
        action: "sync_track_metadata_from_files",
    },
    PythonRoute {
        method: "POST",
        template: "/tracks/restore",
        action: "restore_track",
    },
    PythonRoute {
        method: "GET",
        template: "/history",
        action: "play_history",
    },
    PythonRoute {
        method: "GET",
        template: "/history/stats",
        action: "play_history_stats",
    },
    PythonRoute {
        method: "GET",
        template: "/library/stats",
        action: "library_stats",
    },
    PythonRoute {
        method: "GET",
        template: "/library/inbox",
        action: "library_inbox",
    },
    PythonRoute {
        method: "POST",
        template: "/library/inbox/review",
        action: "review_inbox_tracks",
    },
    PythonRoute {
        method: "PATCH",
        template: "/library/inbox/notes/{track_id}",
        action: "update_inbox_note",
    },
    PythonRoute {
        method: "GET",
        template: "/library/inbox/auto-review-rules",
        action: "list_inbox_auto_review_rules",
    },
    PythonRoute {
        method: "POST",
        template: "/library/inbox/auto-review-rules",
        action: "create_inbox_auto_review_rule",
    },
    PythonRoute {
        method: "PATCH",
        template: "/library/inbox/auto-review-rules/{rule_id}",
        action: "update_inbox_auto_review_rule",
    },
    PythonRoute {
        method: "DELETE",
        template: "/library/inbox/auto-review-rules/{rule_id}",
        action: "delete_inbox_auto_review_rule",
    },
    PythonRoute {
        method: "GET",
        template: "/library/watch",
        action: "get_folder_watch",
    },
    PythonRoute {
        method: "POST",
        template: "/library/watch/start",
        action: "start_folder_watch",
    },
    PythonRoute {
        method: "POST",
        template: "/library/watch/stop",
        action: "stop_folder_watch",
    },
    PythonRoute {
        method: "POST",
        template: "/library/watch/refresh",
        action: "refresh_folder_watch",
    },
    PythonRoute {
        method: "POST",
        template: "/library/watch/apply",
        action: "apply_folder_watch",
    },
    PythonRoute {
        method: "POST",
        template: "/library/watch/notifications/ack",
        action: "acknowledge_folder_watch_notifications_route",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/audio-conversion/setup",
        action: "get_audio_conversion_setup",
    },
    PythonRoute {
        method: "PATCH",
        template: "/library/tools/audio-conversion/setup",
        action: "update_audio_conversion_setup",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/audio-conversion/install",
        action: "install_audio_conversion_ffmpeg",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/audio-conversion/install/jobs",
        action: "start_audio_conversion_ffmpeg_install",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/audio-conversion/install/jobs/{job_id}",
        action: "get_audio_conversion_ffmpeg_install",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/audio-conversion/preview",
        action: "preview_audio_conversion",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/audio-conversion/jobs",
        action: "start_audio_conversion",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/audio-conversion/jobs/{job_id}",
        action: "get_audio_conversion_progress",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/audio-conversion/jobs/{job_id}/cancel",
        action: "cancel_audio_conversion",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/cd-rip/setup",
        action: "get_cd_rip_setup",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/cd-rip/metadata",
        action: "get_cd_rip_metadata",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/cd-rip/jobs",
        action: "start_cd_rip",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/cd-rip/jobs/{job_id}",
        action: "get_cd_rip_progress",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/cd-rip/jobs/{job_id}/cancel",
        action: "cancel_cd_rip",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/cd-rip/playback/play",
        action: "play_cd_track_route",
    },
    PythonRoute {
        method: "POST",
        template: "/audiobooks/sync-export",
        action: "export_audiobook_sync_metadata",
    },
    PythonRoute {
        method: "GET",
        template: "/podcasts/subscriptions",
        action: "get_podcast_subscriptions",
    },
    PythonRoute {
        method: "POST",
        template: "/podcasts/subscriptions",
        action: "create_podcast_subscription",
    },
    PythonRoute {
        method: "PATCH",
        template: "/podcasts/subscriptions/{subscription_id}",
        action: "update_podcast_subscription",
    },
    PythonRoute {
        method: "DELETE",
        template: "/podcasts/subscriptions/{subscription_id}",
        action: "remove_podcast_subscription",
    },
    PythonRoute {
        method: "POST",
        template: "/podcasts/subscriptions/{subscription_id}/folder",
        action: "ensure_podcast_subscription_folder_route",
    },
    PythonRoute {
        method: "POST",
        template: "/podcasts/subscriptions/{subscription_id}/refresh",
        action: "refresh_podcast_subscription_route",
    },
    PythonRoute {
        method: "GET",
        template: "/podcasts/episodes",
        action: "get_podcast_episodes",
    },
    PythonRoute {
        method: "POST",
        template: "/podcasts/episodes/{episode_id}/download",
        action: "download_podcast_episode_route",
    },
    PythonRoute {
        method: "DELETE",
        template: "/podcasts/episodes/{episode_id}/download",
        action: "delete_podcast_episode_download_route",
    },
    PythonRoute {
        method: "POST",
        template: "/podcasts/episodes/{episode_id}/track",
        action: "ensure_podcast_episode_track_route",
    },
    PythonRoute {
        method: "GET",
        template: "/scrobbling/accounts",
        action: "get_scrobble_accounts",
    },
    PythonRoute {
        method: "PATCH",
        template: "/scrobbling/accounts/{service}",
        action: "update_scrobble_account",
    },
    PythonRoute {
        method: "POST",
        template: "/scrobbling/lastfm/login/start",
        action: "start_lastfm_login_route",
    },
    PythonRoute {
        method: "POST",
        template: "/scrobbling/lastfm/login/complete",
        action: "complete_lastfm_login_route",
    },
    PythonRoute {
        method: "GET",
        template: "/scrobbling/outbox",
        action: "get_scrobble_outbox",
    },
    PythonRoute {
        method: "POST",
        template: "/scrobbling/outbox/queue-history",
        action: "queue_scrobbling_history",
    },
    PythonRoute {
        method: "POST",
        template: "/scrobbling/outbox/submit",
        action: "submit_scrobbling_outbox",
    },
    PythonRoute {
        method: "POST",
        template: "/scrobbling/import-history",
        action: "import_scrobbling_history",
    },
    PythonRoute {
        method: "GET",
        template: "/extensions",
        action: "list_extensions",
    },
    PythonRoute {
        method: "POST",
        template: "/extensions/reload",
        action: "reload_extensions",
    },
    PythonRoute {
        method: "POST",
        template: "/library/importers/stats",
        action: "import_external_library_stats",
    },
    PythonRoute {
        method: "GET",
        template: "/library/health",
        action: "library_health",
    },
    PythonRoute {
        method: "POST",
        template: "/library/maintenance/clear",
        action: "clear_library_caches",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/regex-presets",
        action: "list_regex_tag_presets",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/regex-presets",
        action: "save_regex_tag_preset",
    },
    PythonRoute {
        method: "DELETE",
        template: "/library/tools/regex-presets/{preset_id}",
        action: "delete_regex_tag_preset",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/custom-tags",
        action: "batch_custom_tags",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/virtual-tags",
        action: "list_virtual_tag_definitions",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/virtual-tags",
        action: "save_virtual_tag_definition",
    },
    PythonRoute {
        method: "DELETE",
        template: "/library/tools/virtual-tags/{definition_id}",
        action: "delete_virtual_tag_definition",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/virtual-tags/preview",
        action: "preview_virtual_tag",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/copy-swap-tags",
        action: "copy_or_swap_tag_fields",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/tag-backups",
        action: "create_tag_backup",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/tag-backups",
        action: "list_tag_backups",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/tag-backups/restore",
        action: "restore_tag_backup",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/infer-tags",
        action: "infer_tags_from_filenames",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/regex-tags",
        action: "regex_replace_tags",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/autotag",
        action: "auto_tag_musicbrainz",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/clap-genre-tags",
        action: "clap_genre_tags",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/volume-tags",
        action: "volume_tags",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/organize-files",
        action: "organize_files_from_tags",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/organize-files/report",
        action: "export_file_organization_report",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/device-sync",
        action: "sync_device_folder",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/device-sync/devices",
        action: "get_device_sync_devices",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/device-sync/profiles",
        action: "get_device_sync_profiles",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/device-sync/profiles",
        action: "create_device_sync_profile",
    },
    PythonRoute {
        method: "PATCH",
        template: "/library/tools/device-sync/profiles/{profile_id}",
        action: "update_device_sync_profile",
    },
    PythonRoute {
        method: "DELETE",
        template: "/library/tools/device-sync/profiles/{profile_id}",
        action: "remove_device_sync_profile",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/export-metadata-csv",
        action: "export_metadata_csv",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/import-metadata-csv",
        action: "import_metadata_csv",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/import-metadata-csv/report",
        action: "export_metadata_csv_import_report",
    },
    PythonRoute {
        method: "POST",
        template: "/library/duplicates/action",
        action: "apply_duplicate_action",
    },
    PythonRoute {
        method: "POST",
        template: "/library/duplicates/review",
        action: "review_duplicates",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/acoustic-fingerprints/setup",
        action: "get_chromaprint_setup",
    },
    PythonRoute {
        method: "PATCH",
        template: "/library/tools/acoustic-fingerprints/setup",
        action: "update_chromaprint_setup",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/acoustic-fingerprints",
        action: "run_acoustic_fingerprint_pass",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/undo-log",
        action: "list_bulk_undo_log",
    },
    PythonRoute {
        method: "GET",
        template: "/library/tools/undo-batches",
        action: "list_bulk_undo_batches",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/undo-batches/{batch_id}/restore",
        action: "restore_bulk_undo_batch",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/undo-log/{entry_id}/restore",
        action: "restore_bulk_undo_log_entry",
    },
    PythonRoute {
        method: "POST",
        template: "/library/tools/reports/read",
        action: "read_report_file",
    },
    PythonRoute {
        method: "GET",
        template: "/albums",
        action: "list_albums",
    },
    PythonRoute {
        method: "POST",
        template: "/albums/{album_id}/completion-lookup",
        action: "lookup_album_completion",
    },
    PythonRoute {
        method: "GET",
        template: "/albums/{album_id}/tracks",
        action: "album_tracks",
    },
    PythonRoute {
        method: "GET",
        template: "/albums/{album_id}/artwork",
        action: "album_artwork",
    },
    PythonRoute {
        method: "GET",
        template: "/albums/{album_id}/artwork-candidates",
        action: "list_album_artwork_candidates",
    },
    PythonRoute {
        method: "GET",
        template: "/albums/{album_id}/artwork-search",
        action: "search_album_artwork",
    },
    PythonRoute {
        method: "PATCH",
        template: "/albums/{album_id}/artwork",
        action: "update_album_artwork",
    },
    PythonRoute {
        method: "GET",
        template: "/playlists",
        action: "list_playlists",
    },
    PythonRoute {
        method: "POST",
        template: "/playlists",
        action: "create_playlist",
    },
    PythonRoute {
        method: "DELETE",
        template: "/playlists/{playlist_id}",
        action: "delete_playlist",
    },
    PythonRoute {
        method: "GET",
        template: "/playlists/{playlist_id}/tracks",
        action: "get_playlist_tracks",
    },
    PythonRoute {
        method: "POST",
        template: "/playlists/{playlist_id}/tracks",
        action: "add_playlist_tracks",
    },
    PythonRoute {
        method: "DELETE",
        template: "/playlists/{playlist_id}/tracks/{track_id}",
        action: "remove_playlist_track",
    },
    PythonRoute {
        method: "PATCH",
        template: "/playlists/{playlist_id}/tracks/{track_id}/move",
        action: "move_playlist_track",
    },
    PythonRoute {
        method: "POST",
        template: "/playlists/{playlist_id}/export",
        action: "export_playlist",
    },
    PythonRoute {
        method: "POST",
        template: "/playlists/import",
        action: "import_playlist",
    },
    PythonRoute {
        method: "POST",
        template: "/scan",
        action: "scan_library",
    },
    PythonRoute {
        method: "POST",
        template: "/scan/start",
        action: "start_scan_library",
    },
    PythonRoute {
        method: "GET",
        template: "/scan/jobs/{job_id}",
        action: "get_scan_progress",
    },
    PythonRoute {
        method: "POST",
        template: "/scan/jobs/{job_id}/cancel",
        action: "cancel_scan_job",
    },
    PythonRoute {
        method: "PATCH",
        template: "/tracks/{track_id}/rating",
        action: "update_rating",
    },
    PythonRoute {
        method: "GET",
        template: "/tracks/{track_id}/artwork",
        action: "track_artwork",
    },
    PythonRoute {
        method: "GET",
        template: "/tracks/{track_id}/lyrics",
        action: "track_lyrics",
    },
    PythonRoute {
        method: "POST",
        template: "/tracks/{track_id}/lyrics/fetch",
        action: "fetch_track_lyrics",
    },
    PythonRoute {
        method: "POST",
        template: "/lyrics/lookup",
        action: "lookup_lyrics_by_metadata",
    },
    PythonRoute {
        method: "PATCH",
        template: "/tracks/{track_id}/lyrics",
        action: "update_track_lyrics",
    },
    PythonRoute {
        method: "GET",
        template: "/artists",
        action: "list_artists",
    },
    PythonRoute {
        method: "GET",
        template: "/artists/info",
        action: "artist_info",
    },
    PythonRoute {
        method: "DELETE",
        template: "/artists/cache",
        action: "clear_artist_cache",
    },
    PythonRoute {
        method: "GET",
        template: "/artists/local-tracks",
        action: "artist_local_tracks",
    },
    PythonRoute {
        method: "POST",
        template: "/tracks/{track_id}/played",
        action: "mark_track_played",
    },
    PythonRoute {
        method: "POST",
        template: "/tracks/{track_id}/skipped",
        action: "mark_track_skipped",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/generate",
        action: "generate_autodj",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/ab-test",
        action: "create_recommendation_ab_test",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/ab-test/choose",
        action: "choose_recommendation_ab_test",
    },
    PythonRoute {
        method: "GET",
        template: "/autodj/profiles",
        action: "list_recommendation_profiles",
    },
    PythonRoute {
        method: "GET",
        template: "/autodj/history",
        action: "recommendation_history",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/profiles/compare",
        action: "compare_recommendation_profiles",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/profiles/compare/export",
        action: "export_recommendation_profile_comparison",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/profiles/compare/import",
        action: "import_recommendation_profile_comparison",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/profiles",
        action: "create_recommendation_profile",
    },
    PythonRoute {
        method: "PATCH",
        template: "/autodj/profiles/{profile_id}",
        action: "update_recommendation_profile",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/profiles/{profile_id}/default",
        action: "set_default_recommendation_profile",
    },
    PythonRoute {
        method: "DELETE",
        template: "/autodj/profiles/{profile_id}",
        action: "delete_recommendation_profile",
    },
    PythonRoute {
        method: "GET",
        template: "/autodj/avoid",
        action: "list_autodj_avoid_rules",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/avoid",
        action: "create_autodj_avoid_rule",
    },
    PythonRoute {
        method: "DELETE",
        template: "/autodj/avoid/{rule_id}",
        action: "delete_autodj_avoid_rule",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/feedback",
        action: "record_recommendation_feedback",
    },
    PythonRoute {
        method: "POST",
        template: "/autodj/export",
        action: "export_autodj",
    },
];

