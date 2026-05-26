use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Instant;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone)]
struct ClapInstallJob {
    job_id: String,
    device: String,
    force: bool,
    status: String,
    message: Option<String>,
    current_step: i64,
    total_steps: i64,
    current_command: Option<String>,
    log: Vec<String>,
    started_at: String,
    finished_at: Option<String>,
    started_instant: Instant,
    error: Option<String>,
}

static CLAP_INSTALL_JOBS: OnceLock<Mutex<HashMap<String, ClapInstallJob>>> = OnceLock::new();
static CLAP_INSTALL_COUNTER: AtomicU64 = AtomicU64::new(1);

pub(crate) fn clap_status(deep: bool) -> Result<JsonValue, String> {
    clap_status_value(deep)
}

pub(crate) fn clap_status_value(deep: bool) -> Result<JsonValue, String> {
    clap_expert_json(
        "clap_expert_status",
        json!({ "command": "status", "deep": deep }),
    )
}

pub(crate) fn update_clap_config(body: JsonValue) -> Result<JsonValue, String> {
    clap_expert_json(
        "clap_expert_config",
        json!({
            "command": "save_config",
            "model_id": body_string(&body, "model_id").or_else(|| body_string(&body, "modelId")),
            "cache_dir": body_string(&body, "cache_dir").or_else(|| body_string(&body, "cacheDir")),
            "max_duration_seconds": body_f64(&body, "max_duration_seconds")
                .or_else(|| body_f64(&body, "maxDurationSeconds")),
        }),
    )
}

pub(crate) fn start_clap_install(body: JsonValue) -> Result<JsonValue, String> {
    let device = body_string(&body, "device")
        .unwrap_or_else(|| "cpu".to_string())
        .to_ascii_lowercase();
    if !matches!(device.as_str(), "cpu" | "cuda") {
        return Err("device must be cpu or cuda".to_string());
    }
    let force = body_bool(&body, "force").unwrap_or(false);
    let job_id = new_install_job_id();
    let job = ClapInstallJob {
        job_id: job_id.clone(),
        device: device.clone(),
        force,
        status: "pending".to_string(),
        message: Some("Waiting to install CLAP dependencies.".to_string()),
        current_step: 0,
        total_steps: 3,
        current_command: None,
        log: Vec::new(),
        started_at: utc_now(),
        finished_at: None,
        started_instant: Instant::now(),
        error: None,
    };
    let response = job.snapshot();
    install_jobs()
        .lock()
        .map_err(|_| "CLAP install job registry is unavailable".to_string())?
        .insert(job_id.clone(), job);
    thread::spawn(move || run_install_thread(job_id, device, force));
    Ok(response)
}

pub(crate) fn get_clap_install(job_id: String) -> Result<JsonValue, String> {
    let jobs = install_jobs()
        .lock()
        .map_err(|_| "CLAP install job registry is unavailable".to_string())?;
    jobs.get(&job_id)
        .map(ClapInstallJob::snapshot)
        .ok_or_else(|| "CLAP install job not found".to_string())
}

fn run_install_thread(job_id: String, device: String, force: bool) {
    let result = run_install_expert(&job_id, &device, force);
    if let Err(error) = result {
        let _ = update_install_job(&job_id, |job| {
            if !terminal(&job.status) {
                job.status = "failed".to_string();
                job.message = Some(error.clone());
                job.error = Some(error);
                job.finished_at = Some(utc_now());
                job.current_command = None;
            }
        });
    }
}

fn run_install_expert(job_id: &str, device: &str, force: bool) -> Result<(), String> {
    crate::python_worker::record_python_worker_action("clap_expert_install");
    let mut command =
        crate::python_worker::python_module_command("backend.app.clap_expert", "--clap-expert")?;
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start CLAP expert: {error}"))?;
    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "CLAP expert stdin was unavailable".to_string())?;
        let payload = json!({ "command": "install", "device": device, "force": force });
        writeln!(
            stdin,
            "{}",
            serde_json::to_string(&payload)
                .map_err(|error| format!("Could not encode CLAP install request: {error}"))?
        )
        .map_err(|error| format!("Could not send CLAP install request: {error}"))?;
    }
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "CLAP expert stdout was unavailable".to_string())?;
    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|error| format!("Could not read CLAP expert output: {error}"))?;
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<JsonValue>(line.trim()) {
            Ok(event) => apply_install_event(job_id, &event)?,
            Err(_) => append_install_log(job_id, line.trim()),
        }
    }
    let status = child
        .wait()
        .map_err(|error| format!("Could not wait for CLAP expert: {error}"))?;
    if !status.success() {
        return Err(format!("CLAP expert exited with status {status}."));
    }
    let snapshot = get_clap_install(job_id.to_string())?;
    let status = snapshot
        .get("status")
        .and_then(JsonValue::as_str)
        .unwrap_or("failed");
    if status == "failed" {
        return Err(snapshot
            .get("error")
            .or_else(|| snapshot.get("message"))
            .and_then(JsonValue::as_str)
            .unwrap_or("CLAP install failed.")
            .to_string());
    }
    if status != "completed" {
        return Err(format!(
            "CLAP install ended before reporting completion (status: {status})."
        ));
    }
    Ok(())
}

fn apply_install_event(job_id: &str, event: &JsonValue) -> Result<(), String> {
    let status = event
        .get("status")
        .and_then(JsonValue::as_str)
        .unwrap_or("running");
    if status == "log" {
        if let Some(message) = event.get("message").and_then(JsonValue::as_str) {
            append_install_log(job_id, message);
        }
        return Ok(());
    }
    update_install_job(job_id, |job| {
        job.status = match status {
            "ok" => "completed".to_string(),
            other => other.to_string(),
        };
        if let Some(message) = event.get("message").and_then(JsonValue::as_str) {
            job.message = Some(message.to_string());
        }
        if let Some(error) = event.get("error").and_then(JsonValue::as_str) {
            job.error = Some(error.to_string());
            job.message = Some(error.to_string());
        }
        if let Some(step) = event.get("current_step").and_then(JsonValue::as_i64) {
            job.current_step = step.max(0);
        }
        if let Some(total) = event.get("total_steps").and_then(JsonValue::as_i64) {
            job.total_steps = total.max(0);
        }
        if event.get("current_command").is_some() {
            job.current_command = event
                .get("current_command")
                .and_then(JsonValue::as_str)
                .map(ToString::to_string);
        }
        if terminal(&job.status) {
            job.finished_at.get_or_insert_with(utc_now);
            job.current_command = None;
        }
    })
}

fn clap_expert_json(action_name: &str, payload: JsonValue) -> Result<JsonValue, String> {
    crate::python_worker::record_python_worker_action(action_name);
    let mut command =
        crate::python_worker::python_module_command("backend.app.clap_expert", "--clap-expert")?;
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start CLAP expert: {error}"))?;
    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "CLAP expert stdin was unavailable".to_string())?;
        writeln!(
            stdin,
            "{}",
            serde_json::to_string(&payload)
                .map_err(|error| format!("Could not encode CLAP expert request: {error}"))?
        )
        .map_err(|error| format!("Could not send CLAP expert request: {error}"))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|error| format!("Could not read CLAP expert response: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let event = stdout
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .ok_or_else(|| {
            format!(
                "CLAP expert returned no response{}",
                if stderr.trim().is_empty() {
                    "".to_string()
                } else {
                    format!(": {}", stderr.trim())
                }
            )
        })?;
    let event = serde_json::from_str::<JsonValue>(event.trim())
        .map_err(|error| format!("CLAP expert returned malformed JSON: {error}"))?;
    let status = event
        .get("status")
        .and_then(JsonValue::as_str)
        .unwrap_or("failed");
    if status == "ok" || status == "completed" {
        Ok(event.get("body").cloned().unwrap_or(event))
    } else {
        Err(event
            .get("error")
            .or_else(|| event.get("message"))
            .and_then(JsonValue::as_str)
            .unwrap_or("CLAP expert failed.")
            .to_string())
    }
}

fn install_jobs() -> &'static Mutex<HashMap<String, ClapInstallJob>> {
    CLAP_INSTALL_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn update_install_job<T>(
    job_id: &str,
    updater: impl FnOnce(&mut ClapInstallJob) -> T,
) -> Result<T, String> {
    let mut jobs = install_jobs()
        .lock()
        .map_err(|_| "CLAP install job registry is unavailable".to_string())?;
    let job = jobs
        .get_mut(job_id)
        .ok_or_else(|| "CLAP install job not found".to_string())?;
    Ok(updater(job))
}

fn append_install_log(job_id: &str, line: &str) {
    if line.trim().is_empty() {
        return;
    }
    let _ = update_install_job(job_id, |job| {
        job.log.push(line.trim().to_string());
        if job.log.len() > 200 {
            let excess = job.log.len() - 200;
            job.log.drain(0..excess);
        }
    });
}

impl ClapInstallJob {
    fn snapshot(&self) -> JsonValue {
        let elapsed_seconds = self.started_instant.elapsed().as_secs_f64();
        let mut percent = if self.total_steps > 0 {
            ((self.current_step as f64 / self.total_steps as f64) * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };
        if self.status == "completed" {
            percent = 100.0;
        }
        let log = self
            .log
            .iter()
            .rev()
            .take(80)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>();
        json!({
            "job_id": self.job_id,
            "device": self.device,
            "force": self.force,
            "status": self.status,
            "message": self.message,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "current_command": self.current_command,
            "log": log,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "elapsed_seconds": elapsed_seconds,
            "percent": percent,
            "error": self.error,
        })
    }
}

fn new_install_job_id() -> String {
    let counter = CLAP_INSTALL_COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = OffsetDateTime::now_utc().unix_timestamp_nanos();
    format!("clap-install-{now:x}-{counter:x}")
}

fn utc_now() -> String {
    OffsetDateTime::now_utc()
        .replace_microsecond(0)
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn terminal(status: &str) -> bool {
    matches!(status, "completed" | "failed" | "canceled")
}

fn body_string(body: &JsonValue, key: &str) -> Option<String> {
    body.get(key)
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn body_bool(body: &JsonValue, key: &str) -> Option<bool> {
    match body.get(key) {
        Some(JsonValue::Bool(value)) => Some(*value),
        Some(JsonValue::String(value)) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

fn body_f64(body: &JsonValue, key: &str) -> Option<f64> {
    match body.get(key) {
        Some(JsonValue::Number(value)) => value.as_f64(),
        Some(JsonValue::String(value)) => value.trim().parse().ok(),
        _ => None,
    }
}
