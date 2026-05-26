#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[cfg(not(debug_assertions))]
use tauri::path::BaseDirectory;

#[cfg(not(debug_assertions))]
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::Child;
use std::process::Command;
#[cfg(not(debug_assertions))]
use std::process::Stdio;
use std::sync::Mutex;
#[cfg(not(debug_assertions))]
use std::thread;
#[cfg(not(debug_assertions))]
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

mod folder_watch;
mod native_library;
mod native_playback;
mod path_ops;
mod process_runner;
mod smtc;

#[derive(Default)]
struct BackendState {
    child: Mutex<Option<Child>>,
}

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

#[cfg(not(debug_assertions))]
fn backend_addr() -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], 8765))
}

#[cfg(not(debug_assertions))]
fn backend_is_running() -> bool {
    TcpStream::connect_timeout(&backend_addr(), Duration::from_millis(250)).is_ok()
}

#[cfg(not(debug_assertions))]
fn wait_for_backend(timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if backend_is_running() {
            return true;
        }
        thread::sleep(Duration::from_millis(200));
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

#[cfg(debug_assertions)]
fn start_packaged_backend(_app: &tauri::AppHandle) -> Option<Child> {
    None
}

#[cfg(not(debug_assertions))]
fn start_packaged_backend(app: &tauri::AppHandle) -> Option<Child> {
    if backend_is_running() {
        stop_backend_processes_on_port();
        let started = Instant::now();
        while backend_is_running() && started.elapsed() < Duration::from_secs(3) {
            thread::sleep(Duration::from_millis(100));
        }
        if backend_is_running() {
            return None;
        }
    }

    let backend_path = match app.path().resolve(
        r"flaccafe-backend\flaccafe-backend.exe",
        BaseDirectory::Resource,
    ) {
        Ok(path) => path,
        Err(error) => {
            eprintln!("Could not resolve bundled backend path: {error}");
            return None;
        }
    };

    let mut command = Command::new(backend_path);
    command
        .env("FLAC_CAFE_PACKAGED", "1")
        .env("FLAC_CAFE_PORT", "8765")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    command.creation_flags(0x08000000);

    match command.spawn() {
        Ok(child) => Some(child),
        Err(error) => {
            eprintln!("Could not start bundled backend: {error}");
            None
        }
    }
}

fn stop_packaged_backend(app: &tauri::AppHandle) {
    let backend_state = app.state::<BackendState>();
    let mut child_guard = backend_state
        .child
        .lock()
        .expect("backend child lock poisoned");
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

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
fn backend_restart(app: tauri::AppHandle) -> Result<String, String> {
    stop_packaged_backend(&app);
    #[cfg(not(debug_assertions))]
    {
        let child = start_packaged_backend(&app);
        let backend_state = app.state::<BackendState>();
        *backend_state
            .child
            .lock()
            .map_err(|_| "Backend child lock poisoned".to_string())? = child;
        if wait_for_backend(Duration::from_secs(15)) {
            Ok("Backend restarted".to_string())
        } else {
            Err("Backend did not start".to_string())
        }
    }
    #[cfg(debug_assertions)]
    {
        Err("Backend restart is only available in the packaged desktop app".to_string())
    }
}

fn main() {
    let app = tauri::Builder::default()
        .manage(smtc::SmtcState::default())
        .manage(native_playback::NativePlaybackState::default())
        .manage(folder_watch::NativeFolderWatchState::default())
        .manage(native_library::NativeLibraryState::default())
        .manage(BackendState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            backend_restart,
            open_source_folder,
            open_external_url,
            reveal_in_file_explorer,
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
            native_library::native_autodj_avoid_rules,
            native_library::native_create_autodj_avoid_rule,
            native_library::native_delete_autodj_avoid_rule,
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
            native_library::native_history,
            native_library::native_history_stats,
            native_library::native_library_stats,
            native_library::native_clear_library_caches,
            native_library::native_bulk_undo_log,
            native_library::native_bulk_undo_batches,
            native_library::native_library_health,
            native_library::native_generate_autodj,
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
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(icon)?;
            }
            let backend_child = start_packaged_backend(app.handle());
            let backend_state = app.state::<BackendState>();
            *backend_state
                .child
                .lock()
                .expect("backend child lock poisoned") = backend_child;
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
            stop_packaged_backend(app_handle);
        }
    });
}
