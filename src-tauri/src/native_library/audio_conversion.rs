use rusqlite::{params_from_iter, ToSql};
use serde_json::{json, Value as JsonValue};
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

pub(crate) fn native_audio_conversion_preview(
    body: JsonValue,
) -> Result<NativeAudioConversionPreviewResponse, String> {
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
        changes.push(NativeAudioConversionChange {
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

    Ok(NativeAudioConversionPreviewResponse {
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

pub(crate) fn native_start_audio_conversion(
    body: JsonValue,
) -> Result<NativeAudioConversionProgress, String> {
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

pub(crate) fn native_audio_conversion_progress(
    job_id: String,
) -> Result<NativeAudioConversionProgress, String> {
    let jobs = audio_jobs()
        .lock()
        .map_err(|_| "Audio conversion job registry is unavailable".to_string())?;
    jobs.get(&job_id)
        .map(AudioConversionJob::snapshot)
        .ok_or_else(|| "Audio conversion job not found".to_string())
}

pub(crate) fn native_cancel_audio_conversion(
    job_id: String,
) -> Result<NativeAudioConversionProgress, String> {
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
    native_audio_conversion_progress(job_id)
}

fn run_audio_conversion_thread(job_id: String, ffmpeg_path: PathBuf) {
    let result = run_audio_conversion(&job_id, &ffmpeg_path);
    let mut jobs = match audio_jobs().lock() {
        Ok(jobs) => jobs,
        Err(_) => return,
    };
    if let Some(job) = jobs.get_mut(&job_id) {
        match result {
            Ok(()) if job.status != "canceled" => {
                job.status = "completed".to_string();
                job.phase = "completed".to_string();
                job.message = Some(format!(
                    "Converted {} track{}.",
                    job.converted,
                    if job.converted == 1 { "" } else { "s" }
                ));
                job.current_track = None;
                job.finished_at = Some(utc_now());
                job.error = None;
            }
            Ok(()) => {}
            Err(error) => {
                job.status = "failed".to_string();
                job.phase = "failed".to_string();
                job.message = Some(error.clone());
                job.error = Some(error);
                job.current_track = None;
                job.finished_at = Some(utc_now());
            }
        }
    }
}

fn run_audio_conversion(job_id: &str, ffmpeg_path: &Path) -> Result<(), String> {
    let request = update_audio_job(job_id, |job| job.request.clone())?;
    let connection = open_database()?;
    let library_root = get_setting(&connection, "library_path").map(PathBuf::from);
    let tracks = selected_tracks(&connection, request.track_ids.as_deref(), request.limit)?;
    drop(connection);
    update_audio_job(job_id, |job| {
        job.status = "running".to_string();
        job.phase = "transcoding".to_string();
        job.total_tracks = tracks.len() as i64;
        job.message = Some(format!(
            "Converting {} track{}.",
            tracks.len(),
            if tracks.len() == 1 { "" } else { "s" }
        ));
    })?;

    for (index, track) in tracks.iter().enumerate() {
        if update_audio_job(job_id, |job| job.cancel_requested)? {
            update_audio_job(job_id, |job| {
                job.status = "canceled".to_string();
                job.phase = "canceled".to_string();
                job.message = Some("Conversion canceled.".to_string());
                job.current_track = None;
                job.finished_at = Some(utc_now());
            })?;
            return Ok(());
        }

        let source = PathBuf::from(&track.path);
        let target = conversion_target_path(
            track,
            &request.target_folder,
            &request.output_format,
            request.preserve_structure,
            library_root.as_deref(),
        );
        update_audio_job(job_id, |job| {
            job.current_track = Some(track.title.clone().unwrap_or_else(|| track.path.clone()));
            job.message = Some(format!("Converting {} of {}", index + 1, tracks.len()));
        })?;

        let outcome = convert_one_track(ffmpeg_path, &request, &source, &target)
            .and_then(|_| copy_converted_artwork_if_needed(&request, &source, &target));
        update_audio_job(job_id, |job| {
            match outcome {
                Ok(artwork_warning) => {
                    job.converted += 1;
                    if let Some(warning) = artwork_warning {
                        job.errors.push(warning);
                    }
                }
                Err(error) => {
                    job.skipped += 1;
                    let name = source
                        .file_name()
                        .and_then(|value| value.to_str())
                        .map(str::to_string)
                        .unwrap_or_else(|| source.to_string_lossy().to_string());
                    job.errors.push(format!("{name}: {error}"));
                }
            }
            if job.errors.len() > 50 {
                let excess = job.errors.len() - 50;
                job.errors.drain(0..excess);
            }
            job.processed_tracks = (index + 1) as i64;
        })?;
    }
    Ok(())
}

fn convert_one_track(
    ffmpeg_path: &Path,
    request: &ConversionRequest,
    source: &Path,
    target: &Path,
) -> Result<(), String> {
    if !source.is_file() {
        return Err("Source file is missing".to_string());
    }
    if target.exists() && !request.overwrite {
        return Err("target exists".to_string());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create target folder: {error}"))?;
    }
    let args = ffmpeg_args(source, target, request);
    let mut command = std::process::Command::new(ffmpeg_path);
    command.args(&args);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command
        .output()
        .map_err(|error| format!("Could not start FFmpeg: {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        let text = String::from_utf8_lossy(if output.stderr.is_empty() {
            &output.stdout
        } else {
            &output.stderr
        });
        let tail = text
            .chars()
            .rev()
            .take(1200)
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>();
        Err(if tail.trim().is_empty() {
            format!("FFmpeg exited with {:?}", output.status.code())
        } else {
            tail.trim().to_string()
        })
    }
}

fn ffmpeg_args(source: &Path, target: &Path, request: &ConversionRequest) -> Vec<String> {
    let mut args = vec![
        "-hide_banner".to_string(),
        if request.overwrite { "-y" } else { "-n" }.to_string(),
        "-i".to_string(),
        source.to_string_lossy().to_string(),
        "-map".to_string(),
        "0:a:0".to_string(),
        "-vn".to_string(),
        "-map_metadata".to_string(),
        if request.copy_tags { "0" } else { "-1" }.to_string(),
    ];
    if request.normalize_volume {
        args.extend([
            "-af".to_string(),
            "loudnorm=I=-16:TP=-1.5:LRA=11".to_string(),
        ]);
    }
    args.extend(audio_codec_args(
        &request.output_format,
        request.bitrate_kbps,
    ));
    if let Some(sample_rate) = request.sample_rate_hz {
        args.extend(["-ar".to_string(), sample_rate.to_string()]);
    }
    args.push(target.to_string_lossy().to_string());
    args
}

fn audio_codec_args(output_format: &str, bitrate_kbps: Option<i64>) -> Vec<String> {
    match output_format {
        "flac" => vec!["-c:a".to_string(), "flac".to_string()],
        "mp3" => vec![
            "-c:a".to_string(),
            "libmp3lame".to_string(),
            "-b:a".to_string(),
            format!("{}k", bitrate_kbps.unwrap_or(320)),
        ],
        "m4a" => vec![
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            format!("{}k", bitrate_kbps.unwrap_or(256)),
        ],
        "opus" => vec![
            "-c:a".to_string(),
            "libopus".to_string(),
            "-b:a".to_string(),
            format!("{}k", bitrate_kbps.unwrap_or(160)),
        ],
        "wav" => vec!["-c:a".to_string(), "pcm_s16le".to_string()],
        _ => Vec::new(),
    }
}

fn copy_converted_artwork_if_needed(
    request: &ConversionRequest,
    source: &Path,
    target: &Path,
) -> Result<Option<String>, String> {
    if !request.copy_artwork || request.output_format == "wav" {
        return Ok(None);
    }
    match crate::python_worker::call_python_action_json(
        "copy_converted_artwork",
        json!({}),
        Some(json!({
            "source_path": source.to_string_lossy(),
            "target_path": target.to_string_lossy(),
            "output_format": request.output_format,
        })),
    ) {
        Ok(_) => Ok(None),
        Err(error) => Ok(Some(format!(
            "{}: converted, but artwork copy failed: {error}",
            source
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("track")
        ))),
    }
}

fn audio_jobs() -> &'static Mutex<std::collections::HashMap<String, AudioConversionJob>> {
    AUDIO_CONVERSION_JOBS.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

fn update_audio_job<T>(
    job_id: &str,
    update: impl FnOnce(&mut AudioConversionJob) -> T,
) -> Result<T, String> {
    let mut jobs = audio_jobs()
        .lock()
        .map_err(|_| "Audio conversion job registry is unavailable".to_string())?;
    let job = jobs
        .get_mut(job_id)
        .ok_or_else(|| "Audio conversion job not found".to_string())?;
    Ok(update(job))
}

fn new_audio_conversion_job_id() -> String {
    let counter = AUDIO_CONVERSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = OffsetDateTime::now_utc().unix_timestamp_nanos();
    format!("convert-{now:x}-{counter:x}")
}

fn resolved_ffmpeg_path() -> Result<Option<PathBuf>, String> {
    let connection = open_database()?;
    let configured = get_setting(&connection, "ffmpeg_path");
    let executable = if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let mut candidates = Vec::new();
    if let Some(configured) = configured
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        let path = PathBuf::from(configured.trim());
        candidates.push(if path.is_dir() {
            path.join(executable)
        } else {
            path
        });
    }
    candidates.push(ffmpeg_tool_dir().join(executable));
    candidates.push(app_storage_root().join("tools").join(executable));
    if let Some(paths) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&paths).map(|path| path.join(executable)));
    }
    Ok(candidates
        .into_iter()
        .find(|path| path.is_file())
        .map(|path| path.canonicalize().unwrap_or(path)))
}

impl AudioConversionJob {
    fn snapshot(&self) -> NativeAudioConversionProgress {
        let elapsed_seconds = self.started_instant.elapsed().as_secs_f64();
        let percent = if self.total_tracks > 0 {
            ((self.processed_tracks as f64 / self.total_tracks as f64) * 100.0).min(100.0)
        } else if self.status == "completed" {
            100.0
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
        NativeAudioConversionProgress {
            job_id: self.job_id.clone(),
            target_folder: self.request.target_folder.to_string_lossy().to_string(),
            output_format: self.request.output_format.clone(),
            status: self.status.clone(),
            phase: Some(self.phase.clone()),
            message: self.message.clone(),
            total_tracks: self.total_tracks,
            processed_tracks: self.processed_tracks,
            converted: self.converted,
            skipped: self.skipped,
            errors: self
                .errors
                .iter()
                .rev()
                .take(50)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect(),
            current_track: self.current_track.clone(),
            started_at: self.started_at.clone(),
            finished_at: self.finished_at.clone(),
            elapsed_seconds,
            eta_seconds,
            percent,
            error: self.error.clone(),
        }
    }
}

pub(crate) fn native_start_ffmpeg_install(
    body: JsonValue,
) -> Result<NativeAudioConversionInstallProgress, String> {
    let source_url = body_string(&body, "source_url")
        .or_else(|| body_string(&body, "sourceUrl"))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| FFMPEG_WINDOWS_URL.to_string());
    let job_id = new_install_job_id();
    let job = FfmpegInstallJob {
        job_id: job_id.clone(),
        source_url,
        status: "pending".to_string(),
        message: "Waiting to install FFmpeg.".to_string(),
        current_step: 0,
        total_steps: 3,
        bytes_downloaded: 0,
        total_bytes: None,
        tool_directory: ffmpeg_tool_dir().to_string_lossy().to_string(),
        log: Vec::new(),
        started_at: utc_now(),
        finished_at: None,
        started_instant: Instant::now(),
        error: None,
    };
    let response = job.snapshot();
    install_jobs()
        .lock()
        .map_err(|_| "FFmpeg install job registry is unavailable".to_string())?
        .insert(job_id.clone(), job);
    thread::spawn(move || run_ffmpeg_install_thread(job_id));
    Ok(response)
}

pub(crate) fn native_ffmpeg_install_progress(
    job_id: String,
) -> Result<NativeAudioConversionInstallProgress, String> {
    let jobs = install_jobs()
        .lock()
        .map_err(|_| "FFmpeg install job registry is unavailable".to_string())?;
    jobs.get(&job_id)
        .map(FfmpegInstallJob::snapshot)
        .ok_or_else(|| "FFmpeg install job not found".to_string())
}

fn run_ffmpeg_install_thread(job_id: String) {
    let archive_path = ffmpeg_tool_dir().join("ffmpeg-release-essentials.zip");
    let result = run_ffmpeg_install(&job_id, &archive_path);
    let mut jobs = match install_jobs().lock() {
        Ok(jobs) => jobs,
        Err(_) => return,
    };
    if let Some(job) = jobs.get_mut(&job_id) {
        match result {
            Ok(()) => {
                job.status = "completed".to_string();
                job.message = "FFmpeg was installed for FLAC Cafe.".to_string();
                job.current_step = job.total_steps;
                job.finished_at = Some(utc_now());
                job.error = None;
            }
            Err(error) => {
                let _ = fs::remove_file(&archive_path);
                job.status = "failed".to_string();
                job.message = "Could not install FFmpeg automatically.".to_string();
                job.error = Some(format!("{error} Source: {}", job.source_url));
                job.finished_at = Some(utc_now());
            }
        }
    }
}

fn run_ffmpeg_install(job_id: &str, archive_path: &Path) -> Result<(), String> {
    if !cfg!(windows) {
        return Err(
            "Guided FFmpeg install is currently Windows-only. Save an ffmpeg path instead."
                .to_string(),
        );
    }
    let tool_dir = ffmpeg_tool_dir();
    fs::create_dir_all(&tool_dir)
        .map_err(|error| format!("Could not create FFmpeg tool folder: {error}"))?;
    let source_url = update_install_job(job_id, |job| {
        job.status = "running".to_string();
        job.message = "Preparing FFmpeg install...".to_string();
        job.source_url.clone()
    })?;
    download_ffmpeg_archive(job_id, &source_url, archive_path)?;
    extract_ffmpeg_tools(job_id, archive_path, &tool_dir)?;
    configure_ffmpeg_path(job_id, &tool_dir)?;
    let _ = fs::remove_file(archive_path);
    Ok(())
}

fn download_ffmpeg_archive(
    job_id: &str,
    source_url: &str,
    archive_path: &Path,
) -> Result<(), String> {
    update_install_job(job_id, |job| {
        job.current_step = 1;
        job.message = "Downloading FFmpeg essentials...".to_string();
    })?;
    let response = ureq::get(source_url)
        .set("User-Agent", "FLAC-Cafe")
        .timeout(std::time::Duration::from_secs(180))
        .call()
        .map_err(|error| format!("Could not download FFmpeg: {error}"))?;
    let total_bytes = response
        .header("Content-Length")
        .and_then(|value| value.parse::<i64>().ok());
    update_install_job(job_id, |job| {
        job.total_bytes = total_bytes;
    })?;
    let mut reader = response.into_reader();
    let mut target = fs::File::create(archive_path)
        .map_err(|error| format!("Could not create FFmpeg archive: {error}"))?;
    let mut buffer = vec![0u8; DOWNLOAD_CHUNK_SIZE];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|error| format!("Could not read FFmpeg download: {error}"))?;
        if read == 0 {
            break;
        }
        target
            .write_all(&buffer[..read])
            .map_err(|error| format!("Could not write FFmpeg archive: {error}"))?;
        update_install_job(job_id, |job| {
            job.bytes_downloaded += read as i64;
            let downloaded_mb = job.bytes_downloaded as f64 / 1_048_576.0;
            job.message = if let Some(total) = job.total_bytes {
                format!(
                    "Downloading FFmpeg essentials ({downloaded_mb:.1} / {:.1} MB)...",
                    total as f64 / 1_048_576.0
                )
            } else {
                format!("Downloading FFmpeg essentials ({downloaded_mb:.1} MB)...")
            };
        })?;
    }
    Ok(())
}

fn extract_ffmpeg_tools(job_id: &str, archive_path: &Path, tool_dir: &Path) -> Result<(), String> {
    update_install_job(job_id, |job| {
        job.current_step = 2;
        job.message = "Extracting FFmpeg tools...".to_string();
    })?;
    let file = fs::File::open(archive_path)
        .map_err(|error| format!("Could not open FFmpeg archive: {error}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("Downloaded FFmpeg archive was not readable: {error}"))?;
    let mut members = std::collections::HashMap::new();
    for index in 0..archive.len() {
        let name = archive
            .by_index(index)
            .map_err(|error| format!("Could not inspect FFmpeg archive: {error}"))?
            .name()
            .to_string();
        if let Some(file_name) = Path::new(&name)
            .file_name()
            .and_then(|value| value.to_str())
        {
            members.insert(file_name.to_ascii_lowercase(), index);
        }
    }
    if !members.contains_key("ffmpeg.exe") {
        return Err("Downloaded archive did not contain ffmpeg.exe".to_string());
    }
    for executable in ["ffmpeg.exe", "ffprobe.exe", "ffplay.exe"] {
        let Some(index) = members.get(executable).copied() else {
            continue;
        };
        update_install_job(job_id, |job| {
            job.log.push(format!("Extracting {executable}"));
            if job.log.len() > 200 {
                let excess = job.log.len() - 200;
                job.log.drain(0..excess);
            }
        })?;
        let mut source = archive
            .by_index(index)
            .map_err(|error| format!("Could not read {executable} from archive: {error}"))?;
        let mut target = fs::File::create(tool_dir.join(executable))
            .map_err(|error| format!("Could not create {executable}: {error}"))?;
        std::io::copy(&mut source, &mut target)
            .map_err(|error| format!("Could not extract {executable}: {error}"))?;
    }
    Ok(())
}

fn configure_ffmpeg_path(job_id: &str, tool_dir: &Path) -> Result<(), String> {
    let ffmpeg_path = tool_dir.join("ffmpeg.exe");
    if !ffmpeg_path.is_file() {
        return Err("FFmpeg was extracted, but ffmpeg.exe was missing.".to_string());
    }
    update_install_job(job_id, |job| {
        job.current_step = 3;
        job.message = "Saving FFmpeg path...".to_string();
    })?;
    let connection = open_database()?;
    set_setting(
        &connection,
        "ffmpeg_path",
        Some(ffmpeg_path.to_string_lossy().as_ref()),
    )?;
    Ok(())
}

fn install_jobs() -> &'static Mutex<std::collections::HashMap<String, FfmpegInstallJob>> {
    FFMPEG_INSTALL_JOBS.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

fn update_install_job<T>(
    job_id: &str,
    update: impl FnOnce(&mut FfmpegInstallJob) -> T,
) -> Result<T, String> {
    let mut jobs = install_jobs()
        .lock()
        .map_err(|_| "FFmpeg install job registry is unavailable".to_string())?;
    let job = jobs
        .get_mut(job_id)
        .ok_or_else(|| "FFmpeg install job not found".to_string())?;
    Ok(update(job))
}

fn new_install_job_id() -> String {
    let counter = FFMPEG_INSTALL_COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = OffsetDateTime::now_utc().unix_timestamp_nanos();
    format!("ffmpeg-{now:x}-{counter:x}")
}

fn ffmpeg_tool_dir() -> PathBuf {
    app_storage_root().join("tools").join("ffmpeg")
}

fn utc_now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

impl FfmpegInstallJob {
    fn snapshot(&self) -> NativeAudioConversionInstallProgress {
        let elapsed_seconds = self.started_instant.elapsed().as_secs_f64();
        NativeAudioConversionInstallProgress {
            job_id: self.job_id.clone(),
            status: self.status.clone(),
            message: self.message.clone(),
            current_step: self.current_step,
            total_steps: self.total_steps,
            bytes_downloaded: self.bytes_downloaded,
            total_bytes: self.total_bytes,
            download_url: Some(self.source_url.clone()),
            tool_directory: self.tool_directory.clone(),
            log: self
                .log
                .iter()
                .rev()
                .take(80)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect(),
            started_at: Some(self.started_at.clone()),
            finished_at: self.finished_at.clone(),
            elapsed_seconds,
            percent: self.percent(),
            error: self.error.clone(),
        }
    }

    fn percent(&self) -> f64 {
        if self.status == "completed" {
            return 100.0;
        }
        if self.current_step <= 0 {
            return 1.0;
        }
        match self.current_step {
            1 => {
                if let Some(total) = self.total_bytes.filter(|value| *value > 0) {
                    (5.0 + (self.bytes_downloaded as f64 / total as f64) * 77.0).min(82.0)
                } else {
                    (5.0 + (self.bytes_downloaded as f64 / DOWNLOAD_CHUNK_SIZE as f64) * 2.0)
                        .min(75.0)
                }
            }
            2 => 88.0,
            3 => 96.0,
            _ => ((self.current_step as f64 / self.total_steps.max(1) as f64) * 100.0).min(99.0),
        }
    }
}

impl ConversionRequest {
    fn from_body(body: &JsonValue) -> Result<Self, String> {
        let target_folder = body_string(body, "target_folder")
            .or_else(|| body_string(body, "targetFolder"))
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "target_folder is required".to_string())?;
        let output_format = body_string(body, "output_format")
            .or_else(|| body_string(body, "outputFormat"))
            .unwrap_or_else(|| "flac".to_string())
            .to_ascii_lowercase();
        if output_extension(&output_format).is_none() {
            return Err(format!("Unsupported output format: {output_format}"));
        }
        Ok(Self {
            target_folder: absolute_path(&PathBuf::from(target_folder.trim())),
            output_format,
            track_ids: body_i64_vec(body, "track_ids").or_else(|| body_i64_vec(body, "trackIds")),
            preserve_structure: body_bool(body, "preserve_structure")
                .or_else(|| body_bool(body, "preserveStructure"))
                .unwrap_or(true),
            copy_tags: body_bool(body, "copy_tags")
                .or_else(|| body_bool(body, "copyTags"))
                .unwrap_or(true),
            copy_artwork: body_bool(body, "copy_artwork")
                .or_else(|| body_bool(body, "copyArtwork"))
                .unwrap_or(true),
            normalize_volume: body_bool(body, "normalize_volume")
                .or_else(|| body_bool(body, "normalizeVolume"))
                .unwrap_or(false),
            overwrite: body_bool(body, "overwrite").unwrap_or(false),
            sample_rate_hz: body_i64(body, "sample_rate_hz")
                .or_else(|| body_i64(body, "sampleRateHz"))
                .filter(|value| (8_000..=384_000).contains(value)),
            bitrate_kbps: body_i64(body, "bitrate_kbps")
                .or_else(|| body_i64(body, "bitrateKbps"))
                .filter(|value| (32..=1411).contains(value)),
            limit: body_i64(body, "limit").and_then(|value| usize::try_from(value).ok()),
        })
    }
}

fn selected_tracks(
    connection: &rusqlite::Connection,
    track_ids: Option<&[i64]>,
    limit: Option<usize>,
) -> Result<Vec<ConversionTrack>, String> {
    let mut params: Vec<Box<dyn ToSql>> = Vec::new();
    let mut where_clause = String::new();
    if let Some(track_ids) = track_ids.filter(|ids| !ids.is_empty()) {
        let mut unique = Vec::new();
        for id in track_ids.iter().copied().filter(|id| *id > 0) {
            if !unique.contains(&id) {
                unique.push(id);
            }
        }
        if unique.is_empty() {
            return Ok(Vec::new());
        }
        where_clause = format!("WHERE id IN ({})", vec!["?"; unique.len()].join(","));
        params.extend(unique.into_iter().map(|id| Box::new(id) as Box<dyn ToSql>));
    }
    let limit_clause = if limit.is_some() { "LIMIT ?" } else { "" };
    if let Some(limit) = limit {
        params.push(Box::new(limit as i64));
    }
    let sql = format!(
        "SELECT {TRACK_SELECT_COLUMNS}
         FROM tracks
         {where_clause}
         ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                  coalesce(disc_number, 0), coalesce(track_number, 0),
                  lower(coalesce(title, ''))
         {limit_clause}"
    );
    let param_refs = params
        .iter()
        .map(|value| value.as_ref())
        .collect::<Vec<&dyn ToSql>>();
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Could not prepare audio conversion preview: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(param_refs), |row| {
            Ok(ConversionTrack {
                id: row.get("id")?,
                path: row.get("path")?,
                title: row.get("title")?,
                artist: row.get("artist")?,
                album: row.get("album")?,
                album_artist: row.get("album_artist")?,
                duration_seconds: row.get("duration_seconds")?,
            })
        })
        .map_err(|error| format!("Could not read audio conversion preview tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode audio conversion preview tracks: {error}"))
}

fn output_extension(output_format: &str) -> Option<&'static str> {
    OUTPUT_EXTENSIONS
        .iter()
        .find_map(|(format, extension)| (*format == output_format).then_some(*extension))
}

fn safe_component(value: Option<&str>, fallback: &str) -> String {
    let mut text = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string();
    for bad in ['<', '>', ':', '"', '/', '\\', '|', '?', '*'] {
        text = text.replace(bad, "_");
    }
    text = text
        .chars()
        .map(|ch| if ch.is_control() { ' ' } else { ch })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches([' ', '.'])
        .to_string();
    if text.is_empty() {
        fallback.to_string()
    } else {
        text.chars().take(120).collect()
    }
}

fn conversion_target_path(
    track: &ConversionTrack,
    target_folder: &Path,
    output_format: &str,
    preserve_structure: bool,
    library_root: Option<&Path>,
) -> PathBuf {
    let source = PathBuf::from(&track.path);
    let extension = output_extension(output_format).unwrap_or(".flac");
    if preserve_structure {
        if let Some(root) = library_root {
            if let Some(relative) = relative_to(&source, root) {
                return absolute_path(&target_folder.join(relative))
                    .with_extension(&extension[1..]);
            }
        }
    }
    let album_artist = safe_component(
        track.album_artist.as_deref().or(track.artist.as_deref()),
        "Unknown Artist",
    );
    let album = safe_component(track.album.as_deref(), "Unknown Album");
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("track");
    let filename = format!(
        "{}{}",
        safe_component(track.title.as_deref(), stem),
        extension
    );
    absolute_path(&target_folder.join(album_artist).join(album).join(filename))
}

fn relative_to(source: &Path, root: &Path) -> Option<PathBuf> {
    let source_abs = absolute_path(source);
    let root_abs = absolute_path(root);
    source_abs.strip_prefix(root_abs).ok().map(PathBuf::from)
}

fn source_size_bytes(source: &Path) -> Option<i64> {
    source
        .metadata()
        .ok()
        .filter(|metadata| metadata.is_file())
        .and_then(|metadata| i64::try_from(metadata.len()).ok())
}

fn decoded_pcm_size_bytes(track: &ConversionTrack, request: &ConversionRequest) -> Option<i64> {
    let duration = track.duration_seconds.filter(|value| *value > 0.0)?;
    let sample_rate = request.sample_rate_hz.unwrap_or(44_100);
    let channels = 2i64;
    let bytes_per_sample = 2i64;
    Some((sample_rate as f64 * channels as f64 * bytes_per_sample as f64 * duration) as i64)
}

fn estimate_output_size(
    track: &ConversionTrack,
    source: &Path,
    request: &ConversionRequest,
    input_size: Option<i64>,
) -> (Option<i64>, String) {
    let source_extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match request.output_format.as_str() {
        "mp3" | "m4a" | "opus" => {
            let Some(duration) = track.duration_seconds.filter(|value| *value > 0.0) else {
                return (
                    None,
                    "Needs duration metadata for bitrate-based estimate.".to_string(),
                );
            };
            let bitrate =
                request
                    .bitrate_kbps
                    .unwrap_or_else(|| match request.output_format.as_str() {
                        "mp3" => 320,
                        "m4a" => 256,
                        "opus" => 160,
                        _ => 192,
                    });
            (
                Some(((bitrate as f64 * 1000.0 / 8.0) * duration) as i64),
                format!("Estimated from {bitrate} kbps target bitrate."),
            )
        }
        "wav" => match decoded_pcm_size_bytes(track, request) {
            Some(size) => (
                Some(size + 44),
                "Estimated as 16-bit stereo PCM.".to_string(),
            ),
            None => (
                None,
                "Needs duration metadata for PCM estimate.".to_string(),
            ),
        },
        "flac" => {
            let Some(pcm_size) = decoded_pcm_size_bytes(track, request) else {
                return (
                    None,
                    "Needs duration metadata for FLAC estimate.".to_string(),
                );
            };
            let estimate = (pcm_size as f64 * 0.60) as i64;
            if matches!(
                source_extension.as_str(),
                "mp3" | "m4a" | "aac" | "opus" | "ogg"
            ) {
                (
                    Some(estimate),
                    "Lossy-to-FLAC usually expands and does not recover quality.".to_string(),
                )
            } else if source_extension == "flac" {
                (
                    input_size.or(Some(estimate)),
                    "FLAC-to-FLAC is estimated near the current file size.".to_string(),
                )
            } else {
                (
                    Some(estimate),
                    "Estimated around 60% of decoded PCM size.".to_string(),
                )
            }
        }
        _ => (None, "Unsupported estimate.".to_string()),
    }
}

fn size_ratio(estimated_output: Option<i64>, input_size: Option<i64>) -> Option<f64> {
    match (estimated_output, input_size) {
        (Some(output), Some(input)) if input > 0 => Some(output as f64 / input as f64),
        _ => None,
    }
}

fn absolute_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| {
        if path.is_absolute() {
            path.to_path_buf()
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(path)
        }
    })
}

fn body_field<'a>(body: &'a JsonValue, key: &str) -> Option<&'a JsonValue> {
    body.as_object()?.get(key)
}

fn body_string(body: &JsonValue, key: &str) -> Option<String> {
    body_field(body, key)?.as_str().map(ToString::to_string)
}

fn body_bool(body: &JsonValue, key: &str) -> Option<bool> {
    match body_field(body, key)? {
        JsonValue::Bool(value) => Some(*value),
        JsonValue::Number(value) => Some(value.as_i64()? != 0),
        JsonValue::String(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

fn body_i64(body: &JsonValue, key: &str) -> Option<i64> {
    match body_field(body, key)? {
        JsonValue::Number(value) => value.as_i64(),
        JsonValue::String(value) => value.trim().parse().ok(),
        _ => None,
    }
}

fn body_i64_vec(body: &JsonValue, key: &str) -> Option<Vec<i64>> {
    Some(
        body_field(body, key)?
            .as_array()?
            .iter()
            .filter_map(|value| match value {
                JsonValue::Number(number) => number.as_i64(),
                JsonValue::String(text) => text.trim().parse().ok(),
                _ => None,
            })
            .collect(),
    )
}
