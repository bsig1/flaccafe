use base64::Engine;
use serde_json::{json, Value as JsonValue};
use sha1::{Digest as Sha1Digest, Sha1};
use sha2::Sha256;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Instant;
use tauri::http::{header, Method, Request, Response, StatusCode};
use time::OffsetDateTime;

use super::{app_storage_root, scan, tools};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Devices::Cdrom::{
    CDDA, CDROM_TOC, IOCTL_CDROM_RAW_READ, IOCTL_CDROM_READ_TOC, RAW_READ_INFO,
};
#[cfg(windows)]
use windows::Win32::Foundation::{CloseHandle, GENERIC_READ, HANDLE};
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    CreateFileW, GetDriveTypeW, GetLogicalDrives, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_MODE,
    FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
};
#[cfg(windows)]
use windows::Win32::System::IO::DeviceIoControl;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(not(windows))]
const CREATE_NO_WINDOW: u32 = 0;

const CD_FRAMES_PER_SECOND: i64 = 75;
const CD_MSF_OFFSET: i64 = 150;
const CDDA_SECTOR_SIZE: usize = 2352;
const CD_RAW_READ_OFFSET_SECTOR_SIZE: i64 = 2048;
const RIP_READ_SECTORS: i64 = 16;
const STREAM_READ_SECTORS: i64 = 15;
const MUSICBRAINZ_ROOT: &str = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE_ROOT: &str = "https://coverartarchive.org";
const USER_AGENT: &str = "FLAC Cafe/0.5 (https://github.com/bsig1/flaccafe)";

#[derive(Clone)]
struct TocEntry {
    track_number: i64,
    start_lba: i64,
    control: i64,
}

#[derive(Clone)]
struct DiscIdInfo {
    disc_id: String,
    toc: String,
    audio_track_count: i64,
}

#[derive(Clone)]
struct CdRipJob {
    job_id: String,
    drive_id: String,
    output_folder: String,
    output_format: String,
    status: String,
    phase: String,
    message: Option<String>,
    total_tracks: i64,
    processed_tracks: i64,
    ripped_tracks: i64,
    skipped_tracks: i64,
    current_track: Option<String>,
    errors: Vec<String>,
    log: Vec<String>,
    verification: Vec<JsonValue>,
    started_at: String,
    finished_at: Option<String>,
    started_instant: Instant,
    cancel_requested: bool,
    error: Option<String>,
}

impl CdRipJob {
    fn snapshot(&self) -> JsonValue {
        let elapsed_seconds = self.started_instant.elapsed().as_secs_f64();
        let percent = if self.total_tracks > 0 {
            ((self.processed_tracks as f64 / self.total_tracks as f64) * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };
        let eta_seconds = if self.status == "running" && self.processed_tracks > 0 {
            let seconds_per_track = elapsed_seconds / self.processed_tracks as f64;
            Some(((self.total_tracks - self.processed_tracks).max(0) as f64) * seconds_per_track)
        } else if self.status == "completed" {
            Some(0.0)
        } else {
            None
        };
        json!({
            "job_id": self.job_id,
            "drive_id": self.drive_id,
            "output_folder": self.output_folder,
            "output_format": self.output_format,
            "status": self.status,
            "phase": self.phase,
            "message": self.message,
            "total_tracks": self.total_tracks,
            "processed_tracks": self.processed_tracks,
            "ripped_tracks": self.ripped_tracks,
            "skipped_tracks": self.skipped_tracks,
            "current_track": self.current_track,
            "errors": self.errors.iter().rev().take(50).cloned().collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>(),
            "log": self.log.iter().rev().take(80).cloned().collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>(),
            "verification": self.verification,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "elapsed_seconds": elapsed_seconds,
            "eta_seconds": eta_seconds,
            "percent": percent,
            "error": self.error,
        })
    }
}

static ACTIVE_STREAM_TOKENS: OnceLock<Mutex<HashMap<String, HashSet<String>>>> = OnceLock::new();
static CD_RIP_JOBS: OnceLock<Mutex<HashMap<String, CdRipJob>>> = OnceLock::new();

fn stream_tokens() -> &'static Mutex<HashMap<String, HashSet<String>>> {
    ACTIVE_STREAM_TOKENS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn rip_jobs() -> &'static Mutex<HashMap<String, CdRipJob>> {
    CD_RIP_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn utc_now() -> String {
    scan::utc_now()
}

fn normalize_drive_id(value: &str) -> Option<String> {
    let text = value.trim();
    if text.is_empty() {
        return None;
    }
    if let Some(rest) = text.strip_prefix(r"\\.\") {
        return normalize_drive_id(rest);
    }
    let mut chars = text.chars();
    let first = chars.next()?;
    if first.is_ascii_alphabetic() {
        return Some(format!("{}:", first.to_ascii_uppercase()));
    }
    Some(text.to_string())
}

fn drive_letter(value: &str) -> Option<char> {
    normalize_drive_id(value)?.chars().next()
}

fn cd_tool_dir() -> PathBuf {
    app_storage_root().join("tools").join("cd-rip")
}

fn executable_name(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

fn path_candidates(name: &str) -> Vec<PathBuf> {
    let executable = executable_name(name);
    let mut candidates = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(folder) = exe.parent() {
            candidates.push(folder.join("tools").join("cd-rip").join(&executable));
            candidates.push(folder.join("tools").join(&executable));
            if let Some(parent) = folder.parent() {
                candidates.push(parent.join("tools").join("cd-rip").join(&executable));
                candidates.push(parent.join("tools").join(&executable));
            }
        }
    }
    candidates.push(cd_tool_dir().join(&executable));
    candidates.push(app_storage_root().join("tools").join(&executable));
    if let Some(root) = super::repo_root() {
        candidates.push(
            root.join("backend")
                .join("tools")
                .join("cd-rip")
                .join(&executable),
        );
        candidates.push(root.join("tools").join("cd-rip").join(&executable));
    }
    if let Some(path) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|folder| folder.join(&executable)));
    }
    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .filter(|path| {
            let key = path.to_string_lossy().to_ascii_lowercase();
            seen.insert(key)
        })
        .collect()
}

fn tool_version(path: &Path) -> Option<String> {
    for flag in ["--version", "-version"] {
        let mut command = Command::new(path);
        command.arg(flag);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let output = command.output().ok()?;
        if !output.status.success() {
            continue;
        }
        let text = if output.stdout.is_empty() {
            String::from_utf8_lossy(&output.stderr)
        } else {
            String::from_utf8_lossy(&output.stdout)
        };
        if let Some(line) = text.lines().map(str::trim).find(|line| !line.is_empty()) {
            return Some(line.to_string());
        }
    }
    None
}

fn tool_status(name: &str, purpose: &str) -> JsonValue {
    let candidates = path_candidates(name);
    let resolved = candidates
        .iter()
        .find(|path| path.is_file())
        .and_then(|path| path.canonicalize().ok().or_else(|| Some(path.clone())));
    json!({
        "name": name,
        "purpose": purpose,
        "available": resolved.is_some(),
        "path": resolved.as_ref().map(|path| path.to_string_lossy().to_string()),
        "version": resolved.as_deref().and_then(tool_version),
        "checked_paths": candidates.iter().take(8).map(|path| path.to_string_lossy().to_string()).collect::<Vec<_>>(),
    })
}

fn active_playback_drive_ids() -> Vec<String> {
    stream_tokens()
        .lock()
        .map(|tokens| {
            let mut drives = tokens
                .iter()
                .filter(|(_, token_set)| !token_set.is_empty())
                .map(|(drive, _)| drive.clone())
                .collect::<Vec<_>>();
            drives.sort();
            drives
        })
        .unwrap_or_default()
}

fn active_rip_drive_ids() -> Vec<String> {
    rip_jobs()
        .lock()
        .map(|jobs| {
            let mut drives = jobs
                .values()
                .filter(|job| !matches!(job.status.as_str(), "completed" | "failed" | "canceled"))
                .filter_map(|job| normalize_drive_id(&job.drive_id))
                .collect::<Vec<_>>();
            drives.sort();
            drives.dedup();
            drives
        })
        .unwrap_or_default()
}

fn active_rip_for_drive(drive_id: &str) -> bool {
    let normalized = normalize_drive_id(drive_id);
    rip_jobs()
        .lock()
        .map(|jobs| {
            jobs.values().any(|job| {
                !matches!(job.status.as_str(), "completed" | "failed" | "canceled")
                    && normalize_drive_id(&job.drive_id) == normalized
            })
        })
        .unwrap_or(false)
}

fn replace_stream_token(drive_id: &str, token: &str) {
    let normalized = normalize_drive_id(drive_id).unwrap_or_else(|| drive_id.to_string());
    if let Ok(mut tokens) = stream_tokens().lock() {
        let mut set = HashSet::new();
        set.insert(token.to_string());
        tokens.insert(normalized, set);
    }
}

fn stream_token_current(drive_id: &str, token: &str) -> bool {
    let normalized = normalize_drive_id(drive_id).unwrap_or_else(|| drive_id.to_string());
    stream_tokens()
        .lock()
        .map(|tokens| {
            tokens
                .get(&normalized)
                .is_some_and(|set| set.contains(token))
        })
        .unwrap_or(false)
}

fn clear_stream_tokens(drive_id: Option<&str>) {
    if let Ok(mut tokens) = stream_tokens().lock() {
        if let Some(drive_id) = drive_id {
            if let Some(normalized) = normalize_drive_id(drive_id) {
                tokens.remove(&normalized);
            }
        } else {
            tokens.clear();
        }
    }
}

fn track_entries_for_drive(drive_id: &str) -> Vec<JsonValue> {
    let Some(letter) = drive_letter(drive_id) else {
        return Vec::new();
    };
    let root = PathBuf::from(format!("{letter}:\\"));
    let mut tracks = fs::read_dir(root)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let is_cda = path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("cda"));
            if !is_cda {
                return None;
            }
            let stem = path.file_stem()?.to_str()?;
            let digits = stem
                .chars()
                .filter(|character| character.is_ascii_digit())
                .collect::<String>();
            let track_number = digits.parse::<i64>().ok().unwrap_or(0).max(1);
            Some(json!({
                "track_number": track_number,
                "disc_number": 1,
                "title": format!("Track {track_number:02}"),
                "artist": JsonValue::Null,
                "duration_seconds": JsonValue::Null,
                "source_label": path.file_name().and_then(|value| value.to_str()).unwrap_or("CD audio"),
            }))
        })
        .collect::<Vec<_>>();
    tracks.sort_by_key(|track| {
        track
            .get("track_number")
            .and_then(JsonValue::as_i64)
            .unwrap_or(0)
    });
    tracks
}

#[cfg(windows)]
fn windows_cd_drives() -> Vec<JsonValue> {
    let active = active_playback_drive_ids()
        .into_iter()
        .collect::<HashSet<_>>();
    let mut drives = Vec::new();
    unsafe {
        let mask = GetLogicalDrives();
        for index in 0..26 {
            if mask & (1 << index) == 0 {
                continue;
            }
            let letter = (b'A' + index as u8) as char;
            let root_text = format!("{letter}:\\");
            let wide = root_text.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
            if GetDriveTypeW(PCWSTR(wide.as_ptr())) != 5 {
                continue;
            }
            let drive_id = format!("{letter}:");
            let playback_active = active.contains(&drive_id);
            let tracks = if playback_active {
                Vec::new()
            } else {
                track_entries_for_drive(&drive_id)
            };
            drives.push(json!({
                "id": drive_id,
                "path": root_text,
                "label": format!("CD Drive ({drive_id})"),
                "volume_name": JsonValue::Null,
                "media_loaded": playback_active || !tracks.is_empty(),
                "track_count": if tracks.is_empty() { JsonValue::Null } else { json!(tracks.len()) },
                "tracks": tracks,
            }));
        }
    }
    drives
}

#[cfg(not(windows))]
fn windows_cd_drives() -> Vec<JsonValue> {
    Vec::new()
}

