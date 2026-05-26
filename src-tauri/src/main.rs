#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[cfg(not(debug_assertions))]
use tauri::path::BaseDirectory;

use std::path::PathBuf;
use std::process::Command;
#[cfg(not(debug_assertions))]
use std::process::Stdio;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

mod folder_watch;
mod native_library;
mod native_playback;
mod path_ops;
mod process_runner;
mod python_worker;
mod smtc;

#[cfg(windows)]
fn explorer_compatible_path(path: &std::path::Path) -> String {
    let raw = path.to_string_lossy().to_string();
    if let Some(rest) = raw.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{}", rest)
    } else if let Some(rest) = raw.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        raw
    }
}

#[cfg(windows)]
fn explorer_args_for_target(target: &std::path::Path, select_file: bool) -> Vec<String> {
    let explorer_path = explorer_compatible_path(target);
    if select_file {
        // Explorer is picky about /select quoting; split the selector and path so
        // paths with spaces do not fall back to the default Documents folder.
        vec!["/select,".to_string(), explorer_path]
    } else {
        vec![explorer_path]
    }
}

#[cfg(windows)]
fn chrome_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(path) = std::env::var("CHROME") {
        candidates.push(PathBuf::from(path));
    }
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        candidates.push(PathBuf::from(program_files).join(r"Google\Chrome\Application\chrome.exe"));
    }
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        candidates
            .push(PathBuf::from(program_files_x86).join(r"Google\Chrome\Application\chrome.exe"));
    }
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        candidates
            .push(PathBuf::from(local_app_data).join(r"Google\Chrome\Application\chrome.exe"));
    }

    candidates
}

#[cfg(windows)]
fn open_url_in_chrome(url: &str) -> bool {
    for chrome in chrome_candidates() {
        if !chrome.exists() {
            continue;
        }
        if Command::new(chrome)
            .arg(url)
            .creation_flags(0x08000000)
            .spawn()
            .is_ok()
        {
            return true;
        }
    }

    if Command::new("chrome.exe")
        .arg(url)
        .creation_flags(0x08000000)
        .spawn()
        .is_ok()
    {
        return true;
    }

    false
}

#[cfg(any(test, all(windows, not(debug_assertions))))]
fn parse_backend_listener_pids(netstat_output: &str, current_pid: &str) -> Vec<String> {
    let mut pids: Vec<String> = Vec::new();
    for line in netstat_output.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 5 {
            continue;
        }
        let local_address = parts[1];
        let state = parts[3];
        let pid = parts[4];
        if (local_address.ends_with(":8765") || local_address.ends_with(".8765"))
            && state.eq_ignore_ascii_case("LISTENING")
            && pid != current_pid
            && !pids.iter().any(|known| known == pid)
        {
            pids.push(pid.to_string());
        }
    }
    pids
}

#[cfg(all(windows, not(debug_assertions)))]
fn stop_backend_processes_on_port() {
    let output = match Command::new("netstat")
        .args(["-ano", "-p", "tcp"])
        .creation_flags(0x08000000)
        .output()
    {
        Ok(output) => output,
        Err(error) => {
            eprintln!("Could not inspect backend port: {error}");
            return;
        }
    };

    let text = String::from_utf8_lossy(&output.stdout);
    let current_pid = std::process::id().to_string();
    let pids = parse_backend_listener_pids(&text, &current_pid);

    for pid in pids {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid, "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(0x08000000)
            .status();
    }
}

#[cfg(test)]
mod tests {
    use super::parse_backend_listener_pids;

    #[cfg(windows)]
    use super::{explorer_args_for_target, explorer_compatible_path};

    #[cfg(windows)]
    use std::path::Path;

    #[test]
    fn parses_backend_listener_pids_once() {
        let output = r#"
  TCP    127.0.0.1:8765         0.0.0.0:0              LISTENING       1111
  TCP    127.0.0.1:8765         0.0.0.0:0              LISTENING       1111
  TCP    127.0.0.1:8766         0.0.0.0:0              LISTENING       2222
  TCP    127.0.0.1:8765         127.0.0.1:50000        ESTABLISHED     3333
"#;

        assert_eq!(parse_backend_listener_pids(output, "9999"), vec!["1111"]);
    }

    #[test]
    fn skips_current_process_pid() {
        let output = "TCP 127.0.0.1:8765 0.0.0.0:0 LISTENING 1111";

        assert!(parse_backend_listener_pids(output, "1111").is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn strips_extended_windows_path_prefixes_for_explorer() {
        assert_eq!(
            explorer_compatible_path(Path::new(r"\\?\C:\Music\Album\track.flac")),
            r"C:\Music\Album\track.flac"
        );
        assert_eq!(
            explorer_compatible_path(Path::new(r"\\?\UNC\server\share\track.flac")),
            r"\\server\share\track.flac"
        );
    }

    #[cfg(windows)]
    #[test]
    fn builds_explorer_select_args_without_embedded_quotes() {
        assert_eq!(
            explorer_args_for_target(Path::new(r"C:\Music Folder\track one.flac"), true),
            vec![
                "/select,".to_string(),
                r"C:\Music Folder\track one.flac".to_string()
            ]
        );
        assert_eq!(
            explorer_args_for_target(Path::new(r"C:\Music Folder"), false),
            vec![r"C:\Music Folder".to_string()]
        );
    }
}

#[cfg(all(not(windows), not(debug_assertions)))]
fn stop_backend_processes_on_port() {}

fn stop_legacy_backend_server() {
    #[cfg(not(debug_assertions))]
    {
        stop_backend_processes_on_port();
    }
}

#[tauri::command]
fn reveal_in_file_explorer(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    let target = if path.exists() {
        path.canonicalize()
            .map_err(|error| format!("Could not resolve path: {error}"))?
    } else if let Some(parent) = path.parent() {
        parent
            .canonicalize()
            .map_err(|error| format!("Could not resolve parent folder: {error}"))?
    } else {
        return Err("Path does not exist".to_string());
    };

    #[cfg(windows)]
    {
        let mut command = Command::new("explorer.exe");
        for arg in explorer_args_for_target(&target, target.is_file()) {
            command.arg(arg);
        }
        command
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|error| format!("Could not open File Explorer: {error}"))?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|error| format!("Could not reveal file: {error}"))?;
        Ok(())
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("Only http and https links can be opened".to_string());
    }

    #[cfg(windows)]
    {
        if open_url_in_chrome(trimmed) {
            return Ok(());
        }

        Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", trimmed])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|error| format!("Could not open link: {error}"))?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        Command::new("xdg-open")
            .arg(trimmed)
            .spawn()
            .map_err(|error| format!("Could not open link: {error}"))?;
        Ok(())
    }
}

#[tauri::command]
fn open_source_folder(kind: Option<String>) -> Result<(), String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let source_root = manifest_dir
        .parent()
        .ok_or_else(|| "Could not resolve source folder".to_string())?;
    // Developer-facing convenience: Settings can reveal either the repo root or editable theme files.
    let target = match kind.as_deref() {
        Some("themes") => source_root
            .join("frontend")
            .join("src")
            .join("config")
            .join("themes"),
        _ => source_root.to_path_buf(),
    };

    reveal_in_file_explorer(target.display().to_string())
}

#[tauri::command]
fn backend_restart(_app: tauri::AppHandle) -> Result<String, String> {
    stop_legacy_backend_server();
    Ok("Python worker state cleared; it will start on the next Python-owned request.".to_string())
}

fn main() {
    let app = tauri::Builder::default()
        .manage(smtc::SmtcState::default())
        .manage(native_playback::NativePlaybackState::default())
        .manage(folder_watch::NativeFolderWatchState::default())
        .manage(native_library::NativeLibraryState::default())
        .register_uri_scheme_protocol("flaccafe-media", native_library::media_protocol::handle_media_protocol)
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            backend_restart,
            open_source_folder,
            open_external_url,
            reveal_in_file_explorer,
            python_worker::native_backend_json,
            native_playback::native_play_file,
            native_playback::native_crossfade_to_file,
            native_playback::native_resume,
            native_playback::native_pause,
            native_playback::native_stop,
            native_playback::native_seek,
            native_playback::native_set_dsp,
            native_playback::native_set_volume,
            native_playback::native_fade_volume,
            native_playback::native_status,
            native_playback::native_visualizer_frame,
            native_playback::native_diagnostics,
            native_playback::native_clear_diagnostics,
            native_playback::native_prepare_next_file,
            native_playback::native_output_backends,
            native_playback::native_list_output_devices,
            folder_watch::native_folder_watch_start,
            folder_watch::native_folder_watch_stop,
            folder_watch::native_folder_watch_status,
            folder_watch::native_folder_watch_mark_event,
            native_library::native_health,
            native_library::native_settings,
            native_library::native_update_settings,
            native_library::native_clap_coverage,
            native_library::native_tracks_page,
            native_library::native_track,
            native_library::native_tracks_batch,
            native_library::native_similar_tracks,
            native_library::native_audiobooks,
            native_library::native_update_audiobook_progress,
            native_library::native_audiobook_bookmarks,
            native_library::native_create_audiobook_bookmark,
            native_library::native_delete_audiobook_bookmark,
            native_library::native_audiobook_chapters,
            native_library::native_save_audiobook_chapters,
            native_library::native_radio_stations,
            native_library::native_save_radio_station,
            native_library::native_delete_radio_station,
            native_library::native_mark_radio_station_played,
            native_library::native_loved_tracks,
            native_library::native_update_track_love,
            native_library::native_update_track_rating,
            native_library::native_mark_track_played,
            native_library::native_mark_track_skipped,
            native_library::recommendations::native_autodj_avoid_rules,
            native_library::recommendations::native_create_autodj_avoid_rule,
            native_library::recommendations::native_delete_autodj_avoid_rule,
            native_library::native_albums,
            native_library::native_artists,
            native_library::native_playlists,
            native_library::native_create_playlist,
            native_library::native_delete_playlist,
            native_library::native_add_playlist_tracks,
            native_library::native_remove_playlist_track,
            native_library::native_move_playlist_track,
            native_library::native_album_tracks,
            native_library::native_playlist_tracks,
            native_library::history::native_history,
            native_library::history::native_history_stats,
            native_library::native_library_stats,
            native_library::inbox::native_inbox,
            native_library::inbox::native_update_inbox_note,
            native_library::inbox::native_review_inbox,
            native_library::inbox::native_inbox_auto_review_rules,
            native_library::inbox::native_create_inbox_auto_review_rule,
            native_library::inbox::native_update_inbox_auto_review_rule,
            native_library::inbox::native_delete_inbox_auto_review_rule,
            native_library::library_tools::native_regex_tag_presets,
            native_library::library_tools::native_save_regex_tag_preset,
            native_library::library_tools::native_delete_regex_tag_preset,
            native_library::library_tools::native_virtual_tags,
            native_library::library_tools::native_save_virtual_tag,
            native_library::library_tools::native_delete_virtual_tag,
            native_library::library_tools::native_infer_filename_tags,
            native_library::library_tools::native_custom_tags,
            native_library::library_tools::native_virtual_tag_preview,
            native_library::library_tools::native_copy_swap_tags,
            native_library::library_tools::native_regex_tags,
            native_library::library_tools::native_device_sync_profiles,
            native_library::library_tools::native_save_device_sync_profile,
            native_library::library_tools::native_delete_device_sync_profile,
            native_library::podcasts::native_podcast_subscriptions,
            native_library::podcasts::native_save_podcast_subscription,
            native_library::podcasts::native_delete_podcast_subscription,
            native_library::podcasts::native_podcast_subscription_folder,
            native_library::podcasts::native_podcast_episodes,
            native_library::scrobbling::native_scrobble_accounts,
            native_library::scrobbling::native_save_scrobble_account,
            native_library::scrobbling::native_scrobble_outbox,
            native_library::scrobbling::native_queue_scrobble_history,
            native_library::tools::native_audio_conversion_setup,
            native_library::tools::native_save_audio_conversion_setup,
            native_library::tools::native_chromaprint_setup,
            native_library::tools::native_save_chromaprint_setup,
            native_library::native_clear_library_caches,
            native_library::native_bulk_undo_log,
            native_library::native_bulk_undo_batches,
            native_library::native_restore_bulk_undo_batch,
            native_library::native_restore_bulk_undo_entry,
            native_library::native_library_health,
            native_library::native_duplicate_review,
            native_library::native_artist_info,
            native_library::native_artist_local_tracks,
            native_library::native_clear_artist_cache,
            native_library::recommendations::native_generate_autodj,
            native_library::recommendation_profiles::native_recommendation_profiles,
            native_library::recommendation_profiles::native_recommendation_history,
            native_library::recommendation_profiles::native_save_recommendation_profile,
            native_library::recommendation_profiles::native_set_default_recommendation_profile,
            native_library::recommendation_profiles::native_delete_recommendation_profile,
            native_library::recommendation_profiles::native_record_recommendation_feedback,
            native_library::recommendation_profiles::native_create_recommendation_ab_test,
            native_library::recommendation_profiles::native_choose_recommendation_ab_test,
            native_library::recommendation_profiles::native_compare_recommendation_profiles,
            native_library::recommendation_profiles::native_export_recommendation_profile_comparison,
            native_library::recommendation_profiles::native_import_recommendation_profile_comparison,
            native_library::native_library_reconcile_preview,
            native_library::native_file_organization_preview,
            native_library::native_parse_playlist,
            native_library::native_export_m3u,
            native_library::native_volume_tags_preview,
            native_library::native_bulk_file_move_preview,
            native_library::native_gapless_validate,
            native_library::native_remove_library_source,
            path_ops::native_path_info,
            path_ops::native_scan_audio_paths,
            path_ops::native_recycle_paths,
            process_runner::native_run_tool,
            process_runner::native_supervise_audio_conversion,
            smtc::smtc_update_state,
            smtc::smtc_clear
        ])
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            if let Ok(path) = app.path().resolve(
                r"flaccafe-backend\flaccafe-backend.exe",
                BaseDirectory::Resource,
            ) {
                std::env::set_var("FLAC_CAFE_BACKEND_EXE", path);
            }

            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(icon)?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Tauri application");

    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
        ) {
            folder_watch::stop_native_folder_watch(app_handle);
        }
    });
}
