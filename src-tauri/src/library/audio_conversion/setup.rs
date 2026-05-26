use rusqlite::{params_from_iter, ToSql};
use serde_json::Value as JsonValue;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Instant;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::storage::{app_storage_root, get_setting, open_database, set_setting};
use super::types::*;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const FFMPEG_WINDOWS_URL: &str = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
const DOWNLOAD_CHUNK_SIZE: usize = 1024 * 1024;
const OUTPUT_EXTENSIONS: &[(&str, &str)] = &[
    ("flac", ".flac"),
    ("mp3", ".mp3"),
    ("m4a", ".m4a"),
    ("opus", ".opus"),
    ("wav", ".wav"),
];

const TRACK_SELECT_COLUMNS: &str = "
    id, path, title, artist, album, album_artist, duration_seconds
";

#[derive(Clone)]
struct ConversionTrack {
    id: i64,
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    duration_seconds: Option<f64>,
}

#[derive(Clone)]
struct ConversionRequest {
    target_folder: PathBuf,
    output_format: String,
    track_ids: Option<Vec<i64>>,
    preserve_structure: bool,
    copy_tags: bool,
    copy_artwork: bool,
    normalize_volume: bool,
    overwrite: bool,
    sample_rate_hz: Option<i64>,
    bitrate_kbps: Option<i64>,
    limit: Option<usize>,
}

#[derive(Clone)]
struct AudioConversionJob {
    job_id: String,
    request: ConversionRequest,
    status: String,
    phase: String,
    message: Option<String>,
    total_tracks: i64,
    processed_tracks: i64,
    converted: i64,
    skipped: i64,
    errors: Vec<String>,
    current_track: Option<String>,
    started_at: String,
    finished_at: Option<String>,
    started_instant: Instant,
    error: Option<String>,
    cancel_requested: bool,
}

enum ConvertStatus {
    Converted,
    Canceled,
}

#[derive(Clone)]
struct FfmpegInstallJob {
    job_id: String,
    source_url: String,
    status: String,
    message: String,
    current_step: i64,
    total_steps: i64,
    bytes_downloaded: i64,
    total_bytes: Option<i64>,
    tool_directory: String,
    log: Vec<String>,
    started_at: String,
    finished_at: Option<String>,
    started_instant: Instant,
    error: Option<String>,
}

static FFMPEG_INSTALL_JOBS: OnceLock<Mutex<std::collections::HashMap<String, FfmpegInstallJob>>> =
    OnceLock::new();
static FFMPEG_INSTALL_COUNTER: AtomicU64 = AtomicU64::new(1);
static AUDIO_CONVERSION_JOBS: OnceLock<
    Mutex<std::collections::HashMap<String, AudioConversionJob>>,
> = OnceLock::new();
static AUDIO_CONVERSION_COUNTER: AtomicU64 = AtomicU64::new(1);

pub(crate) fn audio_conversion_preview(
    body: JsonValue,
) -> Result<DesktopAudioConversionPreviewResponse, String> {
    let request = ConversionRequest::from_body(&body)?;
    let connection = open_database()?;
    let library_root = get_setting(&connection, "library_path").map(PathBuf::from);
    let tracks = selected_tracks(&connection, request.track_ids.as_deref(), request.limit)?;

    let mut changes = Vec::new();
    for track in tracks {
        let source = PathBuf::from(&track.path);
        let target = conversion_target_path(
            &track,
            &request.target_folder,
            &request.output_format,
            request.preserve_structure,
            library_root.as_deref(),
        );
        let input_size = source_size_bytes(&source);
        let (estimated_output, estimate_note) =
            estimate_output_size(&track, &source, &request, input_size);
        let error = if source.is_file() {
            None
        } else {
            Some("Source file is missing".to_string())
        };
        let collision = target.exists() && !request.overwrite;
        changes.push(DesktopAudioConversionChange {
            track_id: track.id,
            title: track.title,
            artist: track.artist,
            source_path: source.to_string_lossy().to_string(),
            target_path: target.to_string_lossy().to_string(),
            source_size_bytes: input_size,
            estimated_output_size_bytes: estimated_output,
            estimated_size_change_bytes: match (estimated_output, input_size) {
                (Some(output), Some(input)) => Some(output - input),
                _ => None,
            },
            estimated_size_ratio: size_ratio(estimated_output, input_size),
            estimate_note: Some(estimate_note),
            changed: absolute_path(&source) != absolute_path(&target),
            collision,
            error,
        });
    }

    let source_total: i64 = changes
        .iter()
        .filter_map(|change| change.source_size_bytes)
        .sum();
    let estimated_total: i64 = changes
        .iter()
        .filter_map(|change| change.estimated_output_size_bytes)
        .sum();
    let estimated_tracks = changes
        .iter()
        .filter(|change| change.estimated_output_size_bytes.is_some())
        .count() as i64;
    let changed_count = changes
        .iter()
        .filter(|change| change.changed && change.error.is_none())
        .count() as i64;
    let collisions = changes.iter().filter(|change| change.collision).count() as i64;

    Ok(DesktopAudioConversionPreviewResponse {
        target_folder: request.target_folder.to_string_lossy().to_string(),
        total: changes.len() as i64,
        changed_count,
        collisions,
        source_size_bytes: (source_total > 0).then_some(source_total),
        estimated_output_size_bytes: (estimated_total > 0).then_some(estimated_total),
        estimated_size_change_bytes: if source_total > 0 && estimated_total > 0 {
            Some(estimated_total - source_total)
        } else {
            None
        },
        estimated_size_ratio: if source_total > 0 && estimated_total > 0 {
            Some(estimated_total as f64 / source_total as f64)
        } else {
            None
        },
        estimated_tracks,
        changes,
    })
}

pub(crate) fn start_audio_conversion(
    body: JsonValue,
) -> Result<DesktopAudioConversionProgress, String> {
    let request = ConversionRequest::from_body(&body)?;
    let ffmpeg_path = resolved_ffmpeg_path()?.ok_or_else(|| {
        "FFmpeg was not found. Save an ffmpeg.exe path before starting conversion.".to_string()
    })?;
    let job_id = new_audio_conversion_job_id();
    let job = AudioConversionJob {
        job_id: job_id.clone(),
        request,
        status: "pending".to_string(),
        phase: "queued".to_string(),
        message: Some("Waiting to start".to_string()),
        total_tracks: 0,
        processed_tracks: 0,
        converted: 0,
        skipped: 0,
        errors: Vec::new(),
        current_track: None,
        started_at: utc_now(),
        finished_at: None,
        started_instant: Instant::now(),
        error: None,
        cancel_requested: false,
    };
    let response = job.snapshot();
    audio_jobs()
        .lock()
        .map_err(|_| "Audio conversion job registry is unavailable".to_string())?
        .insert(job_id.clone(), job);
    thread::spawn(move || run_audio_conversion_thread(job_id, ffmpeg_path));
    Ok(response)
}

pub(crate) fn audio_conversion_progress(
    job_id: String,
) -> Result<DesktopAudioConversionProgress, String> {
    let jobs = audio_jobs()
        .lock()
        .map_err(|_| "Audio conversion job registry is unavailable".to_string())?;
    jobs.get(&job_id)
        .map(AudioConversionJob::snapshot)
        .ok_or_else(|| "Audio conversion job not found".to_string())
}

pub(crate) fn cancel_audio_conversion(
    job_id: String,
) -> Result<DesktopAudioConversionProgress, String> {
    {
        let mut jobs = audio_jobs()
            .lock()
            .map_err(|_| "Audio conversion job registry is unavailable".to_string())?;
        let job = jobs
            .get_mut(&job_id)
            .ok_or_else(|| "Audio conversion job not found".to_string())?;
        if !matches!(job.status.as_str(), "completed" | "failed" | "canceled") {
            job.cancel_requested = true;
            job.status = "canceling".to_string();
            job.phase = "canceling".to_string();
            job.message = Some("Cancel requested. The current file will finish first.".to_string());
        }
    }
    audio_conversion_progress(job_id)
}

