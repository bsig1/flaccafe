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
mod library;
mod path_ops;
mod playback;
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
fn open_url_in_default_browser(url: &str) -> Result<(), String> {
    Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", url])
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|error| format!("Could not open link in the default browser: {error}"))?;
    Ok(())
}

#[cfg(not(windows))]
fn open_url_in_default_browser(url: &str) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map_err(|error| format!("Could not open link in the default browser: {error}"))?;
    Ok(())
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
        open_url_in_default_browser(trimmed)
    }

    #[cfg(not(windows))]
    {
        open_url_in_default_browser(trimmed)
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
    Ok("Legacy backend state cleared. Python expert workers start only when an expert task needs one.".to_string())
}

fn main() {
    let app = tauri::Builder::default()
        .manage(smtc::SmtcState::default())
        .manage(playback::PlaybackState::default())
        .manage(folder_watch::FolderWatchState::default())
        .manage(library::DesktopLibraryState::default())
        .register_uri_scheme_protocol(
            "flaccafe-media",
            library::media_protocol::handle_media_protocol,
        )
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            backend_restart,
            open_source_folder,
            open_external_url,
            reveal_in_file_explorer,
            python_worker::backend_json,
            playback::play_file,
            playback::crossfade_to_file,
            playback::resume,
            playback::pause,
            playback::stop,
            playback::seek,
            playback::set_dsp,
            playback::set_volume,
            playback::fade_volume,
            playback::status,
            playback::visualizer_frame,
            playback::diagnostics,
            playback::clear_diagnostics,
            playback::prepare_next_file,
            playback::output_backends,
            playback::list_output_devices,
            folder_watch::folder_watch_start,
            folder_watch::folder_watch_stop,
            folder_watch::folder_watch_status,
            folder_watch::folder_watch_mark_event,
            library::health,
            library::settings,
            library::update_settings,
            library::clap_coverage,
            library::tracks_page,
            library::track,
            library::tracks_batch,
            library::similar_tracks,
            library::audiobooks::audiobooks,
            library::audiobooks::update_audiobook_progress,
            library::audiobooks::audiobook_bookmarks,
            library::audiobooks::create_audiobook_bookmark,
            library::audiobooks::delete_audiobook_bookmark,
            library::audiobooks::audiobook_chapters,
            library::audiobooks::save_audiobook_chapters,
            library::radio::radio_stations,
            library::radio::save_radio_station,
            library::radio::delete_radio_station,
            library::radio::mark_radio_station_played,
            library::loved_tracks,
            library::update_track_love,
            library::update_track_rating,
            library::mark_track_played,
            library::mark_track_skipped,
            library::recommendations::autodj_avoid_rules,
            library::recommendations::create_autodj_avoid_rule,
            library::recommendations::delete_autodj_avoid_rule,
            library::albums,
            library::artists,
            library::playlists::playlists,
            library::playlists::create_playlist,
            library::playlists::delete_playlist,
            library::playlists::add_playlist_tracks,
            library::playlists::remove_playlist_track,
            library::playlists::move_playlist_track,
            library::album_tracks,
            library::playlists::playlist_tracks,
            library::history::history,
            library::history::history_stats,
            library::library_stats,
            library::inbox::inbox,
            library::inbox::update_inbox_note,
            library::inbox::review_inbox,
            library::inbox::inbox_auto_review_rules,
            library::inbox::create_inbox_auto_review_rule,
            library::inbox::update_inbox_auto_review_rule,
            library::inbox::delete_inbox_auto_review_rule,
            library::library_tools::regex_tag_presets,
            library::library_tools::save_regex_tag_preset,
            library::library_tools::delete_regex_tag_preset,
            library::library_tools::virtual_tags,
            library::library_tools::save_virtual_tag,
            library::library_tools::delete_virtual_tag,
            library::library_tools::infer_filename_tags,
            library::library_tools::custom_tags,
            library::library_tools::virtual_tag_preview,
            library::library_tools::copy_swap_tags,
            library::library_tools::regex_tags,
            library::library_tools::device_sync_profiles,
            library::library_tools::save_device_sync_profile,
            library::library_tools::delete_device_sync_profile,
            library::podcasts::podcast_subscriptions,
            library::podcasts::save_podcast_subscription,
            library::podcasts::delete_podcast_subscription,
            library::podcasts::podcast_subscription_folder,
            library::podcasts::podcast_episodes,
            library::scrobbling::scrobble_accounts,
            library::scrobbling::save_scrobble_account,
            library::scrobbling::scrobble_outbox,
            library::scrobbling::queue_scrobble_history,
            library::tools::audio_conversion_setup,
            library::tools::save_audio_conversion_setup,
            library::tools::chromaprint_setup,
            library::tools::save_chromaprint_setup,
            library::clear_library_caches,
            library::bulk_undo_log,
            library::bulk_undo_batches,
            library::restore_bulk_undo_batch,
            library::restore_bulk_undo_entry,
            library::health::library_health,
            library::health::duplicate_review,
            library::artist_info::artist_info,
            library::artist_info::artist_local_tracks,
            library::artist_info::clear_artist_cache,
            library::recommendations::generate_autodj,
            library::recommendation_profiles::recommendation_profiles,
            library::recommendation_profiles::recommendation_history,
            library::recommendation_profiles::save_recommendation_profile,
            library::recommendation_profiles::set_default_recommendation_profile,
            library::recommendation_profiles::delete_recommendation_profile,
            library::recommendation_profiles::record_recommendation_feedback,
            library::recommendation_profiles::create_recommendation_ab_test,
            library::recommendation_profiles::choose_recommendation_ab_test,
            library::recommendation_profiles::compare_recommendation_profiles,
            library::recommendation_profiles::export_recommendation_profile_comparison,
            library::recommendation_profiles::import_recommendation_profile_comparison,
            library::library_reconcile_preview,
            library::file_organization::file_organization_preview,
            library::playlist_files::parse_playlist,
            library::playlist_files::export_m3u,
            library::volume_tags::volume_tags_preview,
            library::bulk_file_move_preview,
            library::gapless_validate,
            library::remove_library_source,
            path_ops::path_info,
            path_ops::scan_audio_paths,
            path_ops::recycle_paths,
            process_runner::run_tool,
            process_runner::supervise_audio_conversion,
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
            folder_watch::stop_folder_watch(app_handle);
        }
    });
}
