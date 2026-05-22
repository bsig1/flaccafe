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

mod native_playback;
mod smtc;

#[derive(Default)]
struct BackendState {
    child: Mutex<Option<Child>>,
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

    let backend_path = match app
        .path()
        .resolve("flaccafe-backend.exe", BaseDirectory::Resource)
    {
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
        Ok(child) => {
            let _ = wait_for_backend(Duration::from_secs(15));
            Some(child)
        }
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
        path
    } else if let Some(parent) = path.parent() {
        parent.to_path_buf()
    } else {
        return Err("Path does not exist".to_string());
    };

    #[cfg(windows)]
    {
        let selector = if target.is_file() {
            format!("/select,{}", target.display())
        } else {
            target.display().to_string()
        };
        Command::new("explorer.exe")
            .arg(selector)
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
fn open_file_with_default_app(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    if !path.exists() || !path.is_file() {
        return Err("Audio file does not exist".to_string());
    }

    #[cfg(windows)]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path.display().to_string()])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|error| format!("Could not open default app: {error}"))?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|error| format!("Could not open default app: {error}"))?;
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
        if backend_is_running() {
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
        .manage(BackendState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            backend_restart,
            open_source_folder,
            open_file_with_default_app,
            reveal_in_file_explorer,
            native_playback::native_play_file,
            native_playback::native_crossfade_to_file,
            native_playback::native_resume,
            native_playback::native_pause,
            native_playback::native_stop,
            native_playback::native_seek,
            native_playback::native_set_dsp,
            native_playback::native_set_volume,
            native_playback::native_status,
            native_playback::native_list_output_devices,
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
            stop_packaged_backend(app_handle);
        }
    });
}
