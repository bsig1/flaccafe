#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[cfg(not(debug_assertions))]
use tauri::path::BaseDirectory;

#[cfg(not(debug_assertions))]
use std::net::{SocketAddr, TcpStream};
use std::process::Child;
#[cfg(not(debug_assertions))]
use std::process::{Command, Stdio};
use std::sync::Mutex;
#[cfg(not(debug_assertions))]
use std::thread;
#[cfg(not(debug_assertions))]
use std::time::{Duration, Instant};

#[cfg(all(windows, not(debug_assertions)))]
use std::os::windows::process::CommandExt;

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

#[cfg(debug_assertions)]
fn start_packaged_backend(_app: &tauri::App) -> Option<Child> {
    None
}

#[cfg(not(debug_assertions))]
fn start_packaged_backend(app: &tauri::App) -> Option<Child> {
    if backend_is_running() {
        return None;
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
        .env("LOCAL_AUTODJ_PACKAGED", "1")
        .env("LOCAL_AUTODJ_PORT", "8765")
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
}

fn main() {
    let app = tauri::Builder::default()
        .manage(smtc::SmtcState::default())
        .manage(BackendState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            smtc::smtc_update_state,
            smtc::smtc_clear
        ])
        .setup(|app| {
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(icon)?;
            }
            let backend_child = start_packaged_backend(app);
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
        if let tauri::RunEvent::Exit = event {
            stop_packaged_backend(app_handle);
        }
    });
}
