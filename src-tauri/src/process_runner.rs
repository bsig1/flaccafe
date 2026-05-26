use serde::Serialize;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize)]
pub struct DesktopToolRunResponse {
    executable: String,
    args: Vec<String>,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    elapsed_ms: u128,
    timed_out: bool,
}

#[derive(Serialize)]
pub struct DesktopAudioConversionSupervisionResponse {
    executable: String,
    args: Vec<String>,
    exit_code: Option<i32>,
    elapsed_ms: u128,
    timed_out: bool,
    succeeded: bool,
    input_path: Option<String>,
    output_path: Option<String>,
    input_size_bytes: Option<u64>,
    output_size_bytes: Option<u64>,
    output_to_input_ratio: Option<f64>,
    stdout: String,
    stderr_tail: String,
}

fn hidden_command(executable: &str) -> Command {
    let mut command = Command::new(executable);
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn run_hidden_tool(
    executable: String,
    args: Vec<String>,
    timeout_ms: Option<u64>,
) -> Result<DesktopToolRunResponse, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(15_000).clamp(250, 10 * 60 * 1000));
    let started = Instant::now();
    let mut child = hidden_command(&executable)
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start {executable}: {error}"))?;

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                let output = child
                    .wait_with_output()
                    .map_err(|error| format!("Could not collect {executable} output: {error}"))?;
                return Ok(DesktopToolRunResponse {
                    executable,
                    args,
                    exit_code: output.status.code(),
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    elapsed_ms: started.elapsed().as_millis(),
                    timed_out: false,
                });
            }
            Ok(None) if started.elapsed() >= timeout => {
                let _ = child.kill();
                let output = child.wait_with_output().map_err(|error| {
                    format!("Could not stop {executable} after timeout: {error}")
                })?;
                return Ok(DesktopToolRunResponse {
                    executable,
                    args,
                    exit_code: output.status.code(),
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    elapsed_ms: started.elapsed().as_millis(),
                    timed_out: true,
                });
            }
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(error) => return Err(format!("Could not monitor {executable}: {error}")),
        }
    }
}

fn file_size(path: &Option<String>) -> Option<u64> {
    path.as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .and_then(|path| path.metadata().ok())
        .map(|metadata| metadata.len())
}

#[tauri::command]
pub fn run_tool(
    executable: String,
    args: Option<Vec<String>>,
    timeout_ms: Option<u64>,
) -> Result<DesktopToolRunResponse, String> {
    run_hidden_tool(executable, args.unwrap_or_default(), timeout_ms)
}

#[tauri::command]
pub fn supervise_audio_conversion(
    executable: String,
    args: Option<Vec<String>>,
    input_path: Option<String>,
    output_path: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<DesktopAudioConversionSupervisionResponse, String> {
    let result = run_hidden_tool(executable, args.unwrap_or_default(), timeout_ms)?;
    let input_size_bytes = file_size(&input_path);
    let output_size_bytes = file_size(&output_path);
    let output_to_input_ratio = match (input_size_bytes, output_size_bytes) {
        (Some(input), Some(output)) if input > 0 => Some(output as f64 / input as f64),
        _ => None,
    };
    let stderr_tail = result
        .stderr
        .chars()
        .rev()
        .take(8000)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    Ok(DesktopAudioConversionSupervisionResponse {
        executable: result.executable,
        args: result.args,
        exit_code: result.exit_code,
        elapsed_ms: result.elapsed_ms,
        timed_out: result.timed_out,
        succeeded: result.exit_code == Some(0) && !result.timed_out,
        input_path,
        output_path,
        input_size_bytes,
        output_size_bytes,
        output_to_input_ratio,
        stdout: result.stdout,
        stderr_tail,
    })
}
