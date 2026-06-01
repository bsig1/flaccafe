use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

mod controller_routes;
mod routes;

#[derive(Clone, Default)]
struct WorkerUsageEntry {
    count: u64,
    last_called_at: String,
}

#[derive(Serialize)]
struct WorkerUsageAction {
    action: String,
    count: u64,
    last_called_at: String,
}

#[derive(Serialize)]
pub(super) struct WorkerUsageSnapshot {
    total_calls: u64,
    actions: Vec<WorkerUsageAction>,
}

static PYTHON_WORKER_USAGE: OnceLock<Mutex<HashMap<String, WorkerUsageEntry>>> = OnceLock::new();

fn usage_now() -> String {
    OffsetDateTime::now_utc()
        .replace_microsecond(0)
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

pub(crate) fn record_python_worker_action(action: &str) {
    let lock = PYTHON_WORKER_USAGE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(mut usage) = lock.lock() {
        let entry = usage.entry(action.to_string()).or_default();
        entry.count += 1;
        entry.last_called_at = usage_now();
    }
}

pub(super) fn python_worker_usage_snapshot() -> WorkerUsageSnapshot {
    let lock = PYTHON_WORKER_USAGE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut actions = lock
        .lock()
        .map(|usage| {
            usage
                .iter()
                .map(|(action, entry)| WorkerUsageAction {
                    action: action.clone(),
                    count: entry.count,
                    last_called_at: entry.last_called_at.clone(),
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    actions.sort_by(|left, right| {
        right
            .count
            .cmp(&left.count)
            .then_with(|| left.action.cmp(&right.action))
    });
    let total_calls = actions.iter().map(|entry| entry.count).sum();
    WorkerUsageSnapshot {
        total_calls,
        actions,
    }
}

fn repo_root() -> Option<PathBuf> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
}

fn packaged_backend_exe() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("FLAC_CAFE_BACKEND_EXE") {
        let candidate = PathBuf::from(path);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    let exe = std::env::current_exe().ok()?;
    let app_dir = exe.parent()?;
    let backend_binary = if cfg!(windows) {
        "flaccafe-backend.exe"
    } else {
        "flaccafe-backend"
    };
    let candidate = app_dir.join("flaccafe-backend").join(backend_binary);
    candidate.exists().then_some(candidate)
}

fn dev_python_exe(root: &Path) -> PathBuf {
    let venv_python = if cfg!(windows) {
        root.join(".venv").join("Scripts").join("python.exe")
    } else {
        root.join(".venv").join("bin").join("python")
    };
    if venv_python.exists() {
        venv_python
    } else {
        PathBuf::from("python")
    }
}

pub(crate) fn python_module_command(module: &str, packaged_arg: &str) -> Result<Command, String> {
    if let Some(exe) = packaged_backend_exe() {
        let mut command = Command::new(exe);
        command.arg(packaged_arg);
        return Ok(command);
    }

    let root = repo_root()
        .ok_or_else(|| "Could not resolve project root for Python expert worker".to_string())?;
    let mut command = Command::new(dev_python_exe(&root));
    command.current_dir(root).args(["-m", module]);
    Ok(command)
}

#[tauri::command]
pub async fn backend_json(
    app: AppHandle,
    method: String,
    path: String,
    body: Option<Value>,
    base_url: Option<String>,
) -> Result<Value, String> {
    let _ = base_url;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<crate::library::DesktopLibraryState>();
        if let Some(response) =
            controller_routes::try_handle_json(state, &method, &path, body.clone())?
        {
            return Ok(response);
        }
        Err(format!(
            "No Rust route is registered for {} {}",
            method.to_uppercase(),
            path
        ))
    })
    .await
    .map_err(|error| format!("Rust route task failed: {error}"))?
}
