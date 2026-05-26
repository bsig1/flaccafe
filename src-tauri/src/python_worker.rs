use base64::{engine::general_purpose, Engine as _};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::State;

mod native_routes;
mod routes;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub struct BackendBytesResponse {
    pub status: u16,
    pub reason: String,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
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
    let candidate = app_dir
        .join("flaccafe-backend")
        .join("flaccafe-backend.exe");
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

fn worker_command() -> Result<Command, String> {
    if let Some(exe) = packaged_backend_exe() {
        let mut command = Command::new(exe);
        command.arg("--worker-once");
        return Ok(command);
    }

    let root = repo_root()
        .ok_or_else(|| "Could not resolve project root for Python worker".to_string())?;
    let mut command = Command::new(dev_python_exe(&root));
    command.current_dir(root).args(["-m", "backend.app.worker"]);
    Ok(command)
}

fn backend_worker_request_bytes(
    method: &str,
    path: &str,
    body: Option<Value>,
) -> Result<BackendBytesResponse, String> {
    crate::native_library::ensure_database_ready()?;
    let body = body.filter(|value| !value.is_null());
    let action = routes::action_for_request(method, path)?;
    let payload = json!({
        "action": action.action,
        "params": action.params,
        "metadata_only": action.metadata_only,
        "body": body,
    });
    let payload_text = serde_json::to_string(&payload)
        .map_err(|error| format!("Could not encode Python worker request: {error}"))?;

    let mut command = worker_command()?;
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(0x08000000);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start Python worker: {error}"))?;
    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(payload_text.as_bytes())
            .map_err(|error| format!("Could not write Python worker request: {error}"))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|error| format!("Could not wait for Python worker: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Python worker exited with {}: {}",
            output.status,
            stderr.trim()
        ));
    }
    let envelope: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
        let stderr = String::from_utf8_lossy(&output.stderr);
        format!(
            "Python worker returned malformed JSON: {error}; stderr: {}",
            stderr.trim()
        )
    })?;
    let status = envelope.get("code").and_then(Value::as_u64).unwrap_or(500) as u16;
    let reason = reason_phrase(status).to_string();
    let mut headers = HashMap::new();
    if let Some(header_map) = envelope.get("headers").and_then(Value::as_object) {
        for (key, value) in header_map {
            if let Some(text) = value.as_str() {
                headers.insert(key.to_ascii_lowercase(), text.to_string());
            }
        }
    }
    let body = if envelope
        .get("is_json")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        serde_json::to_vec(envelope.get("body").unwrap_or(&Value::Null))
            .map_err(|error| format!("Could not encode Python worker JSON body: {error}"))?
    } else {
        let encoded = envelope
            .get("body_base64")
            .and_then(Value::as_str)
            .unwrap_or("");
        general_purpose::STANDARD
            .decode(encoded)
            .map_err(|error| format!("Could not decode Python worker bytes: {error}"))?
    };
    Ok(BackendBytesResponse {
        status,
        reason,
        headers,
        body,
    })
}

fn reason_phrase(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        409 => "Conflict",
        422 => "Unprocessable Entity",
        500 => "Internal Server Error",
        _ => "",
    }
}

pub fn backend_request_bytes(
    method: &str,
    path: &str,
    body: Option<Value>,
    _base_url: Option<String>,
) -> Result<BackendBytesResponse, String> {
    backend_worker_request_bytes(method, path, body)
}

#[tauri::command]
pub fn native_backend_json(
    state: State<'_, crate::native_library::NativeLibraryState>,
    method: String,
    path: String,
    body: Option<Value>,
    base_url: Option<String>,
) -> Result<Value, String> {
    if let Some(response) =
        native_routes::try_handle_native_json(state, &method, &path, body.clone())?
    {
        return Ok(response);
    }
    let response = backend_request_bytes(&method, &path, body, base_url)?;
    let parsed = if response.body.is_empty() {
        json!({})
    } else {
        serde_json::from_slice::<Value>(&response.body)
            .map_err(|error| format!("Python worker returned non-JSON data: {error}"))?
    };
    if !(200..300).contains(&response.status) {
        let message = parsed
            .get("detail")
            .or_else(|| parsed.get("message"))
            .or_else(|| parsed.get("error"))
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("{} {}", response.status, response.reason));
        return Err(message);
    }
    Ok(parsed)
}
