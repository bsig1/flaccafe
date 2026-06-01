use serde::Serialize;
use serde_json::{json, Map, Value};
use tauri::State;

use crate::library::{self, DesktopLibraryState};

use super::routes;

pub(super) fn try_handle_json(
    state: State<'_, DesktopLibraryState>,
    method: &str,
    path: &str,
    body: Option<Value>,
) -> Result<Option<Value>, String> {
    let action = match routes::action_for_request(method, path) {
        Ok(action) => action,
        Err(_) => return Ok(None),
    };
    let params = &action.params;
    let body = body.unwrap_or(Value::Null);
    if let Some(response) = try_handle_track_json(state.clone(), action.action, params, &body)? {
        return Ok(Some(response));
    }

    // This adapter preserves the frontend's HTTP-shaped route names while Rust
    // owns dispatch and response shaping. Python is started only by specific
    // Rust handlers that need CLAP/Torch expert work.
    let response = match action.action {
        "health" => Some(to_json(library::health()?)?),
        "get_startup_diagnostics" => Some(to_json(library::maintenance::startup_diagnostics()?)?),
        "get_backend_log" => Some(to_json(library::maintenance::backend_log_tail(
            param_usize(params, "limit").unwrap_or(200),
        ))?),
        "build_support_bundle" => Some(to_json(library::maintenance::create_support_bundle()?)?),
        "get_python_worker_usage" => Some(to_json(super::python_worker_usage_snapshot())?),
        "list_extensions" => Some(to_json(library::extensions::extensions()?)?),
        "reload_extensions" => Some(to_json(library::extensions::reload_extensions()?)?),
        "backup_database" => Some(to_json(library::maintenance::backup_database()?)?),
        "reset_local_data" => Some(to_json(library::maintenance::reset_local_data(
            body_string(&body, "confirmation"),
        )?)?),
        "get_settings" => Some(to_json(library::settings(state)?)?),
        "update_settings" => Some(to_json(library::update_settings(
            state,
            body_bool(&body, "write_ratings_to_files"),
            body_bool(&body, "auto_write_fetched_lyrics_sidecars"),
            body_bool(&body, "cd_auto_lookup_metadata"),
            body_string(&body, "acoustid_api_key"),
            body_bool(&body, "clear_acoustid_api_key"),
            body_string(&body, "lastfm_api_key"),
            body_string(&body, "lastfm_api_secret"),
            body_bool(&body, "clear_lastfm_api_credentials"),
        )?)?),
        "remove_library_source" => Some(to_json(library::remove_library_source(
            state,
            required_body_string(&body, "path")?,
        )?)?),
        "get_clap_coverage" => Some(to_json(library::clap_coverage(state)?)?),
        "get_clap_status" => Some(to_json(library::analysis::clap_status(
            param_bool(params, "deep").unwrap_or(false),
        )?)?),
        "install_clap_dependencies" => Some(to_json(library::analysis::start_clap_install(
            body.clone(),
        )?)?),
        "get_clap_install" => Some(to_json(library::analysis::get_clap_install(
            required_param_string(params, "job_id")?,
        )?)?),
        "update_clap_config" => Some(to_json(library::analysis::update_clap_config(
            body.clone(),
        )?)?),
        "start_clap_audio_analysis" => Some(to_json(library::analysis::start_clap_analysis(
            body.clone(),
        )?)?),
        "get_clap_audio_analysis" => Some(to_json(library::analysis::get_clap_analysis(
            required_param_string(params, "job_id")?,
        )?)?),
        "pause_clap_audio_analysis" => Some(to_json(library::analysis::pause_clap_analysis(
            required_param_string(params, "job_id")?,
        )?)?),
        "resume_clap_audio_analysis" => Some(to_json(library::analysis::resume_clap_analysis(
            required_param_string(params, "job_id")?,
        )?)?),
        "cancel_clap_audio_analysis" => Some(to_json(library::analysis::cancel_clap_analysis(
            required_param_string(params, "job_id")?,
        )?)?),
        "clap_genre_tags" => Some(to_json(library::analysis::clap_genre_tags(body.clone())?)?),
        "track_lyrics" => Some(to_json(library::lyrics::track_lyrics(
            state,
            required_param_i64(params, "track_id")?,
        )?)?),
        "fetch_track_lyrics" => Some(to_json(library::lyrics::fetch_track_lyrics(
            state,
            required_param_i64(params, "track_id")?,
        )?)?),
        "lookup_lyrics_by_metadata" => Some(to_json(library::lyrics::lookup_lyrics_by_metadata(
            state,
            body.clone(),
        )?)?),
        "update_track_lyrics" => {
            let target = body_string(&body, "target").unwrap_or_else(|| "database".to_string());
            if target.eq_ignore_ascii_case("file") {
                Some(to_json(library::lyrics::update_file_lyrics(
                    state,
                    required_param_i64(params, "track_id")?,
                    body_string(&body, "lyrics"),
                    body_bool(&body, "is_synced").or_else(|| body_bool(&body, "isSynced")),
                )?)?)
            } else {
                Some(to_json(library::lyrics::update_database_lyrics(
                    state,
                    required_param_i64(params, "track_id")?,
                    body_string(&body, "lyrics"),
                    body_bool(&body, "is_synced").or_else(|| body_bool(&body, "isSynced")),
                    body_string(&body, "source"),
                )?)?)
            }
        }
        "update_rating" => {
            let track_id = required_param_i64(params, "track_id")?;
            let rating = body_f64(&body, "rating");
            match library::update_track_rating(state, track_id, rating) {
                Ok(track) => Some(to_json(track)?),
                Err(message) if message.contains("deferring") => None,
                Err(message) => return Err(message),
            }
        }
        "update_track_metadata" => {
            let track_id = required_param_i64(params, "track_id")?;
            let updates = body.as_object().cloned().unwrap_or_default();
            Some(to_json(library::update_track_metadata(
                state,
                track_id,
                updates,
                body_bool(&body, "write_to_file").or_else(|| body_bool(&body, "writeToFile")),
            )?)?)
        }
        "delete_track" => Some(to_json(library::track_management::delete_track(
            state,
            required_param_i64(params, "track_id")?,
            param_bool(params, "delete_file")
                .or_else(|| param_bool(params, "deleteFile"))
                .or_else(|| body_bool(&body, "delete_file"))
                .or_else(|| body_bool(&body, "deleteFile"))
                .unwrap_or(false),
        )?)?),
        "delete_tracks" => Some(to_json(library::track_management::delete_tracks(
            state,
            body_i64_vec(&body, "track_ids")
                .or_else(|| body_i64_vec(&body, "trackIds"))
                .unwrap_or_default(),
            body_bool(&body, "delete_file")
                .or_else(|| body_bool(&body, "deleteFile"))
                .unwrap_or(false),
        )?)?),
        "sync_track_metadata_from_files" => Some(to_json(
            library::track_management::sync_track_metadata_from_files(
                state,
                body_i64_vec(&body, "track_ids")
                    .or_else(|| body_i64_vec(&body, "trackIds"))
                    .unwrap_or_default(),
            )?,
        )?),
        "restore_track" => Some(to_json(library::track_management::restore_track(
            state,
            required_body_string(&body, "path")?,
            body_f64(&body, "rating"),
        )?)?),
        "mark_track_played" => Some(to_json(library::mark_track_played(
            state,
            required_param_i64(params, "track_id")?,
        )?)?),
        "mark_track_skipped" => Some(to_json(library::mark_track_skipped(
            state,
            required_param_i64(params, "track_id")?,
        )?)?),
        "library_stats" => Some(to_json(library::library_stats(state)?)?),
        "library_health" => Some(to_json(library::library_health(
            state,
            param_usize(params, "limit"),
        )?)?),
        "clear_library_caches" => Some(to_json(library::clear_library_caches(
            state,
            body_string_vec(&body, "targets").unwrap_or_default(),
        )?)?),
        "list_bulk_undo_log" => Some(to_json(library::bulk_undo_log(
            state,
            param_usize(params, "limit"),
        )?)?),
        "list_bulk_undo_batches" => Some(to_json(library::bulk_undo_batches(
            state,
            param_usize(params, "limit"),
        )?)?),
        "restore_bulk_undo_batch" => Some(to_json(library::restore_bulk_undo_batch(
            state,
            required_param_string(params, "batch_id")?,
        )?)?),
        "restore_bulk_undo_log_entry" => Some(to_json(library::restore_bulk_undo_entry(
            state,
            required_param_i64(params, "entry_id")?,
        )?)?),
        "read_report_file" => Some(to_json(library::reports::read_report_file(
            required_body_string(&body, "report_path")?,
            body_usize(&body, "max_bytes").or_else(|| body_usize(&body, "maxBytes")),
        )?)?),
        "scan_library" => Some(to_json(library::scan::scan_library(body)?)?),
        "start_scan_library" => Some(to_json(library::scan::start_scan_library(body)?)?),
        "get_scan_progress" => Some(to_json(library::scan::scan_progress(
            required_param_string(params, "job_id")?,
        )?)?),
        "cancel_scan_job" => Some(to_json(library::scan::cancel_scan(
            required_param_string(params, "job_id")?,
        )?)?),
        "export_audiobook_sync_metadata" => Some(to_json(
            library::audiobooks::export_audiobook_sync_metadata(
                body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
                body_usize(&body, "limit"),
            )?,
        )?),
        "play_history" => Some(to_json(library::history::history(
            state,
            param_usize(params, "limit"),
        )?)?),
        "play_history_stats" => Some(to_json(library::history::history_stats(
            state,
            param_usize(params, "limit"),
        )?)?),
        "library_inbox" => Some(to_json(library::inbox::inbox(
            state,
            param_usize(params, "limit"),
            param_usize(params, "offset"),
        )?)?),
        "update_inbox_note" => Some(to_json(library::inbox::update_inbox_note(
            state,
            required_param_i64(params, "track_id")?,
            body_string(&body, "note"),
        )?)?),
        "review_inbox_tracks" => Some(to_json(library::inbox::review_inbox(
            state,
            body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
            body_bool(&body, "all_new").or_else(|| body_bool(&body, "allNew")),
        )?)?),
        "list_inbox_auto_review_rules" => {
            Some(to_json(library::inbox::inbox_auto_review_rules(state)?)?)
        }
        "create_inbox_auto_review_rule" => {
            Some(to_json(library::inbox::create_inbox_auto_review_rule(
                state,
                required_body_string(&body, "name")?,
                body_bool(&body, "enabled"),
                required_body_string(&body, "field")?,
                required_body_string(&body, "match_type")?,
                body_string(&body, "value"),
                body_string(&body, "note"),
                body_bool(&body, "apply_existing"),
            )?)?)
        }
        "update_inbox_auto_review_rule" => {
            Some(to_json(library::inbox::update_inbox_auto_review_rule(
                state,
                required_param_i64(params, "rule_id")?,
                required_body_string(&body, "name")?,
                body_bool(&body, "enabled"),
                required_body_string(&body, "field")?,
                required_body_string(&body, "match_type")?,
                body_string(&body, "value"),
                body_string(&body, "note"),
                body_bool(&body, "apply_existing"),
            )?)?)
        }
        "delete_inbox_auto_review_rule" => {
            Some(to_json(library::inbox::delete_inbox_auto_review_rule(
                state,
                required_param_i64(params, "rule_id")?,
            )?)?)
        }
        "get_folder_watch" => Some(to_json(library::folder_watch::folder_watch_status(
            param_usize(params, "limit").unwrap_or(300),
        )?)?),
        "start_folder_watch" => Some(to_json(library::folder_watch::start_folder_watch(body)?)?),
        "stop_folder_watch" => Some(to_json(library::folder_watch::stop_folder_watch(
            param_usize(params, "limit").unwrap_or(300),
        )?)?),
        "refresh_folder_watch" => {
            Some(to_json(library::folder_watch::refresh_folder_watch(body)?)?)
        }
        "apply_folder_watch" => Some(to_json(library::folder_watch::apply_folder_watch(body)?)?),
        "acknowledge_folder_watch_notifications_route" => Some(to_json(
            library::folder_watch::ack_folder_watch_notifications(body)?,
        )?),
        "get_audio_conversion_setup" => {
            Some(to_json(library::tools::audio_conversion_setup(state)?)?)
        }
        "update_audio_conversion_setup" => Some(to_json(
            library::tools::save_audio_conversion_setup(state, body_string(&body, "ffmpeg_path"))?,
        )?),
        "preview_audio_conversion" => Some(to_json(
            library::audio_conversion::audio_conversion_preview(body.clone())?,
        )?),
        "start_audio_conversion" => Some(to_json(
            library::audio_conversion::start_audio_conversion(body.clone())?,
        )?),
        "get_audio_conversion_progress" => Some(to_json(
            library::audio_conversion::audio_conversion_progress(required_param_string(
                params, "job_id",
            )?)?,
        )?),
        "cancel_audio_conversion" => Some(to_json(
            library::audio_conversion::cancel_audio_conversion(required_param_string(
                params, "job_id",
            )?)?,
        )?),
        "install_audio_conversion_ffmpeg" => Some(to_json(
            library::audio_conversion::install_ffmpeg_blocking(body.clone())?,
        )?),
        "get_cd_rip_setup" => Some(to_json(library::cd::cd_setup()?)?),
        "get_cd_rip_metadata" => Some(to_json(library::cd::cd_metadata(body.clone())?)?),
        "start_cd_rip" => Some(to_json(library::cd::start_cd_rip(body.clone())?)?),
        "get_cd_rip_progress" => Some(to_json(library::cd::cd_rip_progress(
            required_param_string(params, "job_id")?,
        )?)?),
        "cancel_cd_rip" => Some(to_json(library::cd::cancel_cd_rip(
            required_param_string(params, "job_id")?,
        )?)?),
        "play_cd_track_route" => Some(to_json(library::cd::prepare_cd_playback_track(body.clone())?)?),
        "start_audio_conversion_ffmpeg_install" => Some(to_json(
            library::audio_conversion::start_ffmpeg_install(body.clone())?,
        )?),
        "get_audio_conversion_ffmpeg_install" => Some(to_json(
            library::audio_conversion::ffmpeg_install_progress(required_param_string(
                params, "job_id",
            )?)?,
        )?),
        "get_chromaprint_setup" => Some(to_json(library::tools::chromaprint_setup(state)?)?),
        "update_chromaprint_setup" => Some(to_json(library::tools::save_chromaprint_setup(
            state,
            body_string(&body, "fpcalc_path"),
        )?)?),
        "run_acoustic_fingerprint_pass" => {
            Some(to_json(library::tools::acoustic_fingerprint_pass(
                state,
                body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
                body_bool(&body, "overwrite"),
                body_usize(&body, "limit"),
            )?)?)
        }
        "list_regex_tag_presets" => {
            Some(to_json(library::library_tools::regex_tag_presets(state)?)?)
        }
        "save_regex_tag_preset" => Some(to_json(library::library_tools::save_regex_tag_preset(
            state,
            required_body_string(&body, "name")?,
            required_body_string(&body, "field")?,
            required_body_string(&body, "pattern")?,
            body_string(&body, "replacement"),
            body_bool(&body, "case_sensitive"),
        )?)?),
        "delete_regex_tag_preset" => {
            Some(to_json(library::library_tools::delete_regex_tag_preset(
                state,
                required_param_i64(params, "preset_id")?,
            )?)?)
        }
        "batch_custom_tags" => Some(to_json(library::library_tools::custom_tags(
            state,
            body_string(&body, "action"),
            required_body_string(&body, "tag_key")?,
            body_string(&body, "value"),
            body_i64_vec(&body, "track_ids"),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "list_virtual_tag_definitions" => {
            Some(to_json(library::library_tools::virtual_tags(state)?)?)
        }
        "save_virtual_tag_definition" => Some(to_json(library::library_tools::save_virtual_tag(
            state,
            required_body_string(&body, "name")?,
            required_body_string(&body, "expression")?,
        )?)?),
        "delete_virtual_tag_definition" => {
            Some(to_json(library::library_tools::delete_virtual_tag(
                state,
                required_param_i64(params, "definition_id")?,
            )?)?)
        }
        "preview_virtual_tag" => Some(to_json(library::library_tools::virtual_tag_preview(
            state,
            required_body_string(&body, "expression")?,
            body_i64_vec(&body, "track_ids"),
            body_usize(&body, "limit"),
        )?)?),
        "copy_or_swap_tag_fields" => Some(to_json(library::library_tools::copy_swap_tags(
            state,
            body_string(&body, "action"),
            required_body_string(&body, "source_field")?,
            required_body_string(&body, "target_field")?,
            body_i64_vec(&body, "track_ids"),
            body_bool(&body, "missing_only"),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "create_tag_backup" => Some(to_json(library::library_tools::create_tag_backup(
            state,
            body_string(&body, "backup_path").or_else(|| body_string(&body, "backupPath")),
            body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
            body_bool(&body, "include_custom_tags")
                .or_else(|| body_bool(&body, "includeCustomTags")),
            body_usize(&body, "limit"),
        )?)?),
        "list_tag_backups" => Some(to_json(library::library_tools::list_tag_backups(
            state,
            param_usize(params, "limit"),
        )?)?),
        "restore_tag_backup" => Some(to_json(library::library_tools::restore_tag_backup(
            state,
            required_body_string(&body, "backup_path")
                .or_else(|_| required_body_string(&body, "backupPath"))?,
            body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
            body_bool(&body, "missing_only").or_else(|| body_bool(&body, "missingOnly")),
            body_bool(&body, "restore_custom_tags")
                .or_else(|| body_bool(&body, "restoreCustomTags")),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "infer_tags_from_filenames" => Some(to_json(library::library_tools::infer_filename_tags(
            state,
            required_body_string(&body, "pattern")?,
            body_i64_vec(&body, "track_ids"),
            body_bool(&body, "missing_only"),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "regex_replace_tags" => Some(to_json(library::library_tools::regex_tags(
            state,
            required_body_string(&body, "field")?,
            required_body_string(&body, "pattern")?,
            required_body_string(&body, "replacement")?,
            body_bool(&body, "case_sensitive"),
            body_i64_vec(&body, "track_ids"),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "get_device_sync_profiles" => Some(to_json(library::library_tools::device_sync_profiles(
            state,
        )?)?),
        "get_device_sync_devices" => Some(to_json(library::library_tools::device_sync_devices())?),
        "sync_device_folder" => Some(to_json(library::library_tools::sync_device_folder(
            required_body_string(&body, "target_folder")
                .or_else(|_| required_body_string(&body, "targetFolder"))?,
            body_i64_vec(&body, "playlist_ids").or_else(|| body_i64_vec(&body, "playlistIds")),
            body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
            body_string(&body, "music_subfolder").or_else(|| body_string(&body, "musicSubfolder")),
            body_string(&body, "playlist_subfolder")
                .or_else(|| body_string(&body, "playlistSubfolder")),
            body_bool(&body, "copy_files").or_else(|| body_bool(&body, "copyFiles")),
            body_bool(&body, "export_playlists").or_else(|| body_bool(&body, "exportPlaylists")),
            body_bool(&body, "preserve_structure")
                .or_else(|| body_bool(&body, "preserveStructure")),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "create_device_sync_profile" => {
            Some(to_json(library::library_tools::save_device_sync_profile(
                state,
                None,
                required_body_string(&body, "name")?,
                body_string(&body, "target_folder"),
                body_string(&body, "device_kind"),
                body_string(&body, "music_subfolder"),
                body_string(&body, "playlist_subfolder"),
                body_i64_vec(&body, "playlist_ids"),
                body.get("playlist_rules").cloned(),
                body_bool(&body, "copy_files"),
                body_bool(&body, "export_playlists"),
                body_bool(&body, "preserve_structure"),
            )?)?)
        }
        "update_device_sync_profile" => {
            Some(to_json(library::library_tools::save_device_sync_profile(
                state,
                Some(required_param_i64(params, "profile_id")?),
                required_body_string(&body, "name")?,
                body_string(&body, "target_folder"),
                body_string(&body, "device_kind"),
                body_string(&body, "music_subfolder"),
                body_string(&body, "playlist_subfolder"),
                body_i64_vec(&body, "playlist_ids"),
                body.get("playlist_rules").cloned(),
                body_bool(&body, "copy_files"),
                body_bool(&body, "export_playlists"),
                body_bool(&body, "preserve_structure"),
            )?)?)
        }
        "remove_device_sync_profile" => Some(to_json(
            library::library_tools::delete_device_sync_profile(
                state,
                required_param_i64(params, "profile_id")?,
            )?,
        )?),
        "volume_tags" => Some(to_json(library::volume_tags_preview(
            state,
            body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
            body_string(&body, "mode"),
            body_bool(&body, "write_to_file").or_else(|| body_bool(&body, "writeToFile")),
            body_f64(&body, "manual_track_gain_db").or_else(|| body_f64(&body, "target_gain_db")),
            body_f64(&body, "manual_track_peak"),
            body_f64(&body, "manual_album_gain_db"),
            body_f64(&body, "manual_album_peak"),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "organize_files_from_tags" => Some(to_json(library::file_organization_preview(
            state,
            required_body_string(&body, "template")?,
            body_string(&body, "base_folder"),
            body_i64_vec(&body, "track_ids"),
            body_string(&body, "collision_strategy"),
            body_bool(&body, "cleanup_empty_folders"),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "export_file_organization_report" => {
            let preview = library::file_organization_preview(
                state,
                required_body_string(&body, "template")?,
                body_string(&body, "base_folder"),
                body_i64_vec(&body, "track_ids"),
                body_string(&body, "collision_strategy"),
                body_bool(&body, "cleanup_empty_folders"),
                Some(false),
                body_usize(&body, "limit"),
            )?;
            Some(to_json(library::reports::export_file_organization_report(
                body_string(&body, "report_path").or_else(|| body_string(&body, "reportPath")),
                &preview,
            )?)?)
        }
        "review_duplicates" => Some(to_json(library::duplicate_review(
            state,
            body_i64_vec(&body, "track_ids"),
            body_i64_groups(&body, "groups"),
            body_usize(&body, "limit"),
        )?)?),
        "apply_duplicate_action" => {
            let action = required_body_string(&body, "action")?;
            Some(to_json(library::duplicate_action(
                state,
                action,
                body_i64_vec(&body, "track_ids"),
                body_i64_groups(&body, "groups"),
                body_string(&body, "report_path"),
                body_string(&body, "ignore_key"),
                body_string(&body, "ignore_label"),
                body_bool(&body, "delete_files").or_else(|| body_bool(&body, "deleteFiles")),
            )?)?)
        }
        "list_albums" => Some(to_json(library::albums(
            state,
            param_string(params, "search"),
            param_usize(params, "limit"),
            param_usize(params, "offset"),
        )?)?),
        "lookup_album_completion" => {
            Some(to_json(library::online_matching::lookup_album_completion(
                state,
                required_param_i64(params, "album_id")?,
            )?)?)
        }
        "album_tracks" => Some(to_json(library::album_tracks(
            state,
            required_param_i64(params, "album_id")?,
        )?)?),
        "update_album_artwork" => match library::album_artwork::update_album_artwork(
            required_param_i64(params, "album_id")?,
            body.clone(),
        )? {
            Some(response) => Some(to_json(response)?),
            None => return Err("Embedded artwork writes are not available in Rust yet".to_string()),
        },
        "list_album_artwork_candidates" => Some(to_json(
            library::online_matching::album_artwork_candidates(required_param_i64(
                params, "album_id",
            )?)?,
        )?),
        "search_album_artwork" => Some(to_json(library::online_matching::search_album_artwork(
            required_param_i64(params, "album_id")?,
        )?)?),
        "list_artists" => Some(to_json(library::artists(
            state,
            param_string(params, "search"),
            param_usize(params, "limit"),
            param_usize(params, "offset"),
        )?)?),
        "artist_info" => {
            let artist = required_param_string(params, "artist_name")
                .or_else(|_| required_param_string(params, "artist"))?;
            Some(to_json(library::artist_info(
                state,
                artist,
                param_bool(params, "refresh"),
            )?)?)
        }
        "artist_local_tracks" => Some(to_json(library::artist_local_tracks(
            state,
            required_param_string(params, "artist_name")
                .or_else(|_| required_param_string(params, "artist"))?,
            param_usize(params, "limit"),
        )?)?),
        "clear_artist_cache" => Some(to_json(library::clear_artist_cache(state)?)?),
        "list_playlists" => Some(to_json(library::playlists(state)?)?),
        "create_playlist" => Some(to_json(library::create_playlist(
            state,
            required_body_string(&body, "name")?,
        )?)?),
        "delete_playlist" => Some(to_json(library::delete_playlist(
            state,
            required_param_i64(params, "playlist_id")?,
        )?)?),
        "get_playlist_tracks" => Some(to_json(library::playlist_tracks(
            state,
            required_param_i64(params, "playlist_id")?,
        )?)?),
        "add_playlist_tracks" => Some(to_json(library::add_playlist_tracks(
            state,
            required_param_i64(params, "playlist_id")?,
            body_i64_vec(&body, "track_ids").unwrap_or_default(),
        )?)?),
        "remove_playlist_track" => Some(to_json(library::remove_playlist_track(
            state,
            required_param_i64(params, "playlist_id")?,
            required_param_i64(params, "track_id")?,
        )?)?),
        "move_playlist_track" => Some(to_json(library::move_playlist_track(
            state,
            required_param_i64(params, "playlist_id")?,
            required_param_i64(params, "track_id")?,
            required_body_string(&body, "direction")?,
        )?)?),
        "parse_playlist" => Some(to_json(library::parse_playlist(required_body_string(
            &body,
            "playlist_path",
        )?)?)?),
        "import_playlist" => Some(to_json(library::import_playlist(
            required_body_string(&body, "playlist_path")?,
            body_string(&body, "name"),
        )?)?),
        "export_autodj" | "export_playlist" => Some(to_json(library::export_m3u(
            required_body_string(&body, "playlist_path")?,
            required_body_string_vec(&body, "track_paths")?,
        )?)?),
        "export_metadata_csv" => Some(to_json(library::metadata_csv::export_metadata_csv(
            body_string(&body, "csv_path").or_else(|| body_string(&body, "csvPath")),
            body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
            body_usize(&body, "limit"),
        )?)?),
        "import_metadata_csv" => Some(to_json(library::metadata_csv::import_metadata_csv(
            body_string(&body, "csv_path").or_else(|| body_string(&body, "csvPath")),
            body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
            body.get("column_map")
                .cloned()
                .or_else(|| body.get("columnMap").cloned()),
            body_bool(&body, "missing_only").or_else(|| body_bool(&body, "missingOnly")),
            body_bool(&body, "clear_blank_fields").or_else(|| body_bool(&body, "clearBlankFields")),
            body_bool(&body, "apply"),
            body_usize(&body, "limit"),
        )?)?),
        "export_metadata_csv_import_report" => Some(to_json(
            library::metadata_csv::export_metadata_csv_import_report(
                body_string(&body, "csv_path").or_else(|| body_string(&body, "csvPath")),
                body_string(&body, "report_path").or_else(|| body_string(&body, "reportPath")),
                body_i64_vec(&body, "track_ids").or_else(|| body_i64_vec(&body, "trackIds")),
                body.get("column_map")
                    .cloned()
                    .or_else(|| body.get("columnMap").cloned()),
                body_bool(&body, "missing_only").or_else(|| body_bool(&body, "missingOnly")),
                body_bool(&body, "clear_blank_fields")
                    .or_else(|| body_bool(&body, "clearBlankFields")),
                body_usize(&body, "limit"),
            )?,
        )?),
        "get_podcast_subscriptions" => {
            Some(to_json(library::podcasts::podcast_subscriptions(state)?)?)
        }
        "create_podcast_subscription" => {
            Some(to_json(library::podcasts::save_podcast_subscription(
                state,
                None,
                body_string(&body, "title"),
                required_body_string(&body, "feed_url")?,
                body_string(&body, "site_url"),
                body_string(&body, "description"),
                body_bool(&body, "auto_download"),
                body_string(&body, "download_folder"),
            )?)?)
        }
        "update_podcast_subscription" => {
            Some(to_json(library::podcasts::save_podcast_subscription(
                state,
                Some(required_param_i64(params, "subscription_id")?),
                body_string(&body, "title"),
                required_body_string(&body, "feed_url")?,
                body_string(&body, "site_url"),
                body_string(&body, "description"),
                body_bool(&body, "auto_download"),
                body_string(&body, "download_folder"),
            )?)?)
        }
        "remove_podcast_subscription" => {
            Some(to_json(library::podcasts::delete_podcast_subscription(
                state,
                required_param_i64(params, "subscription_id")?,
                body_bool(&body, "delete_files"),
            )?)?)
        }
        "ensure_podcast_subscription_folder_route" => {
            Some(to_json(library::podcasts::podcast_subscription_folder(
                state,
                required_param_i64(params, "subscription_id")?,
            )?)?)
        }
        "get_podcast_episodes" => Some(to_json(library::podcasts::podcast_episodes(
            state,
            param_i64(params, "subscription_id").or_else(|| param_i64(params, "subscriptionId")),
            param_usize(params, "limit"),
        )?)?),
        "refresh_podcast_subscription_route" => {
            Some(to_json(library::podcasts::refresh_podcast_subscription(
                state,
                required_param_i64(params, "subscription_id")?,
            )?)?)
        }
        "download_podcast_episode_route" => {
            Some(to_json(library::podcasts::download_podcast_episode(
                state,
                required_param_i64(params, "episode_id")?,
                body_string(&body, "download_folder")
                    .or_else(|| body_string(&body, "downloadFolder")),
            )?)?)
        }
        "delete_podcast_episode_download_route" => Some(to_json(
            library::podcasts::delete_podcast_episode_download(
                state,
                required_param_i64(params, "episode_id")?,
            )?,
        )?),
        "ensure_podcast_episode_track_route" => {
            Some(to_json(library::podcasts::ensure_podcast_episode_track(
                state,
                required_param_i64(params, "episode_id")?,
            )?)?)
        }
        "get_scrobble_accounts" => Some(to_json(library::scrobbling::scrobble_accounts(state)?)?),
        "update_scrobble_account" => Some(to_json(library::scrobbling::save_scrobble_account(
            state,
            required_param_string(params, "service")?,
            body_bool(&body, "enabled"),
            body_string(&body, "username"),
            Some(body_has_field(&body, "username")),
            body_string(&body, "token"),
            Some(
                body_has_field(&body, "token")
                    || body_bool(&body, "clear_credentials").unwrap_or(false),
            ),
            body_string(&body, "api_key"),
            Some(
                body_has_field(&body, "api_key")
                    || body_bool(&body, "clear_credentials").unwrap_or(false),
            ),
            body_string(&body, "api_secret"),
            Some(
                body_has_field(&body, "api_secret")
                    || body_bool(&body, "clear_credentials").unwrap_or(false),
            ),
            body_string(&body, "session_key"),
            Some(
                body_has_field(&body, "session_key")
                    || body_bool(&body, "clear_credentials").unwrap_or(false),
            ),
        )?)?),
        "get_scrobble_outbox" => Some(to_json(library::scrobbling::scrobble_outbox(
            state,
            param_usize(params, "limit"),
        )?)?),
        "queue_scrobbling_history" => Some(to_json(library::scrobbling::queue_scrobble_history(
            state,
            required_body_string(&body, "service")?,
            body_usize(&body, "limit"),
        )?)?),
        "submit_scrobbling_outbox" => Some(to_json(library::scrobbling::submit_scrobble_outbox(
            state,
            required_body_string(&body, "service")?,
            body_usize(&body, "limit"),
        )?)?),
        "start_lastfm_login_route" => Some(to_json(library::scrobbling::start_lastfm_login(
            state,
            body_string(&body, "api_key").or_else(|| body_string(&body, "apiKey")),
            body_string(&body, "api_secret").or_else(|| body_string(&body, "apiSecret")),
        )?)?),
        "complete_lastfm_login_route" => {
            Some(to_json(library::scrobbling::complete_lastfm_login(
                state,
                body_string(&body, "api_key").or_else(|| body_string(&body, "apiKey")),
                body_string(&body, "api_secret").or_else(|| body_string(&body, "apiSecret")),
                required_body_string(&body, "token")?,
                body_bool(&body, "enabled"),
            )?)?)
        }
        "import_scrobbling_history" => {
            Some(to_json(library::scrobbling::import_scrobbling_history(
                state,
                required_body_string(&body, "path")
                    .or_else(|_| required_body_string(&body, "import_path"))?,
                body_bool(&body, "apply"),
                body_usize(&body, "limit"),
            )?)?)
        }
        "import_external_library_stats" => Some(to_json(
            library::library_importers::import_external_library_stats(
                required_body_string(&body, "source")?,
                required_body_string(&body, "import_path")
                    .or_else(|_| required_body_string(&body, "importPath"))?,
                body_bool(&body, "apply"),
                body_bool(&body, "missing_only").or_else(|| body_bool(&body, "missingOnly")),
                body_usize(&body, "limit"),
            )?,
        )?),
        "auto_tag_musicbrainz" => Some(to_json(library::online_matching::auto_tag_musicbrainz(
            state,
            body.clone(),
        )?)?),
        "generate_autodj" => Some(to_json(library::recommendations::generate_autodj(
            state,
            body.clone(),
        )?)?),
        "list_autodj_avoid_rules" => Some(to_json(library::recommendations::autodj_avoid_rules(
            state,
        )?)?),
        "create_autodj_avoid_rule" => Some(to_json(
            library::recommendations::create_autodj_avoid_rule(
                state,
                required_body_string(&body, "scope")?,
                body_i64(&body, "track_id"),
                body_string(&body, "value"),
            )?,
        )?),
        "delete_autodj_avoid_rule" => Some(to_json(
            library::recommendations::delete_autodj_avoid_rule(
                state,
                required_param_i64(params, "rule_id")?,
            )?,
        )?),
        "list_recommendation_profiles" => Some(to_json(
            library::recommendation_profiles::recommendation_profiles(state)?,
        )?),
        "recommendation_history" => Some(to_json(
            library::recommendation_profiles::recommendation_history(
                state,
                param_usize(params, "limit"),
            )?,
        )?),
        "create_recommendation_profile" => Some(to_json(
            library::recommendation_profiles::save_recommendation_profile(
                state,
                None,
                required_body_string(&body, "name")?,
                body.get("settings").cloned().unwrap_or_else(|| json!({})),
                body_bool(&body, "is_default"),
            )?,
        )?),
        "update_recommendation_profile" => Some(to_json(
            library::recommendation_profiles::save_recommendation_profile(
                state,
                Some(required_param_i64(params, "profile_id")?),
                required_body_string(&body, "name")?,
                body.get("settings").cloned().unwrap_or_else(|| json!({})),
                body_bool(&body, "is_default"),
            )?,
        )?),
        "set_default_recommendation_profile" => Some(to_json(
            library::recommendation_profiles::set_default_recommendation_profile(
                state,
                required_param_i64(params, "profile_id")?,
            )?,
        )?),
        "delete_recommendation_profile" => Some(to_json(
            library::recommendation_profiles::delete_recommendation_profile(
                state,
                required_param_i64(params, "profile_id")?,
            )?,
        )?),
        "record_recommendation_feedback" => Some(to_json(
            library::recommendation_profiles::record_recommendation_feedback(
                state,
                required_body_i64(&body, "track_id")?,
                required_body_string(&body, "event_type")?,
                body_f64(&body, "weight"),
            )?,
        )?),
        "create_recommendation_ab_test" => Some(to_json(
            library::recommendation_profiles::create_recommendation_ab_test(
                state,
                body.get("base_settings")
                    .cloned()
                    .unwrap_or_else(|| json!({})),
                body.get("challenger_settings").cloned(),
                body_i64(&body, "seed_track_id"),
                body_i64(&body, "seed"),
            )?,
        )?),
        "choose_recommendation_ab_test" => Some(to_json(
            library::recommendation_profiles::choose_recommendation_ab_test(
                state,
                required_body_string(&body, "chosen_label")?,
                required_body_i64_vec(&body, "chosen_track_ids")?,
                body_f64(&body, "feedback_weight"),
            )?,
        )?),
        "compare_recommendation_profiles" => Some(to_json(
            library::recommendation_profiles::compare_recommendation_profiles(
                state,
                body_i64_vec(&body, "profile_ids"),
                body_i64(&body, "seed_track_id"),
                body_i64(&body, "seed"),
            )?,
        )?),
        "export_recommendation_profile_comparison" => Some(to_json(
            library::recommendation_profiles::export_recommendation_profile_comparison(
                state,
                body_i64_vec(&body, "profile_ids"),
                body_i64(&body, "seed_track_id"),
                body_i64(&body, "seed"),
            )?,
        )?),
        "import_recommendation_profile_comparison" => Some(to_json(
            library::recommendation_profiles::import_recommendation_profile_comparison(
                state,
                required_body_string(&body, "report_path")?,
            )?,
        )?),
        _ => None,
    };
    Ok(response)
}

