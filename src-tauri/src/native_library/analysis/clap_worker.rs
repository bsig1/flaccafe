use serde::Deserialize;
use serde_json::{json, Value as JsonValue};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Stdio};

use super::AnalysisCandidate;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Deserialize)]
struct ClapWorkerEnvelope {
    status: String,
    analysis: Option<JsonValue>,
    error: Option<String>,
}

pub(super) struct ClapWorker {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl ClapWorker {
    pub(super) fn start() -> Result<Self, String> {
        crate::python_worker::record_python_worker_action("clap_worker_stream");
        let mut command = crate::python_worker::python_module_command(
            "backend.app.clap_worker",
            "--clap-worker",
        )?;
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let mut child = command
            .spawn()
            .map_err(|error| format!("Could not start CLAP worker: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "CLAP worker stdin was unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "CLAP worker stdout was unavailable".to_string())?;
        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }

    pub(super) fn analyze(&mut self, track: &AnalysisCandidate) -> Result<JsonValue, String> {
        let payload = json!({
            "command": "analyze",
            "track_id": track.id,
            "path": track.path,
        });
        writeln!(
            self.stdin,
            "{}",
            serde_json::to_string(&payload)
                .map_err(|error| format!("Could not encode CLAP request: {error}"))?
        )
        .map_err(|error| format!("Could not send track to CLAP worker: {error}"))?;
        self.stdin
            .flush()
            .map_err(|error| format!("Could not flush CLAP worker request: {error}"))?;
        let mut line = String::new();
        let bytes = self
            .stdout
            .read_line(&mut line)
            .map_err(|error| format!("Could not read CLAP worker response: {error}"))?;
        if bytes == 0 {
            return Err("CLAP worker exited before returning a result".to_string());
        }
        let response =
            serde_json::from_str::<ClapWorkerEnvelope>(line.trim()).map_err(|error| {
                format!(
                    "CLAP worker returned malformed JSON: {error}; raw response: {}",
                    line.trim()
                )
            })?;
        if response.status == "ok" {
            response
                .analysis
                .ok_or_else(|| "CLAP worker omitted analysis data".to_string())
        } else {
            Err(response
                .error
                .unwrap_or_else(|| "CLAP worker failed".to_string()))
        }
    }

    pub(super) fn shutdown(&mut self) -> Result<(), String> {
        let payload = json!({ "command": "shutdown" });
        let _ = writeln!(self.stdin, "{}", payload);
        let _ = self.stdin.flush();
        let _ = self.child.wait();
        Ok(())
    }
}

impl Drop for ClapWorker {
    fn drop(&mut self) {
        if self.child.try_wait().ok().flatten().is_none() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}
