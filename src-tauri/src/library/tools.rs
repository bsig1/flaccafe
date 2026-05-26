use super::types::*;
use super::{
    app_storage_root, get_setting, open_database, repo_root, set_setting, track_from_row,
    TRACK_COLUMNS,
};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(not(windows))]
const CREATE_NO_WINDOW: u32 = 0;

fn executable_name(base: &str) -> &'static str {
    match (cfg!(windows), base) {
        (true, "ffmpeg") => "ffmpeg.exe",
        (true, "fpcalc") => "fpcalc.exe",
        (_, "ffmpeg") => "ffmpeg",
        _ => "fpcalc",
    }
}

fn tool_dir(tool: &str) -> PathBuf {
    app_storage_root().join("tools").join(tool)
}

fn maybe_file(path: PathBuf, executable: &str) -> PathBuf {
    if path.is_dir() {
        path.join(executable)
    } else {
        path
    }
}

fn path_candidates_from_env(executable: &str) -> Vec<PathBuf> {
    std::env::var_os("PATH")
        .map(|path| {
            std::env::split_paths(&path)
                .map(|folder| folder.join(executable))
                .collect()
        })
        .unwrap_or_default()
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for path in paths {
        let key = path
            .canonicalize()
            .unwrap_or_else(|_| path.clone())
            .to_string_lossy()
            .to_ascii_lowercase();
        if seen.insert(key) {
            unique.push(path);
        }
    }
    unique
}

fn current_exe_tool_candidates(tool: &str, executable: &str) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(folder) = exe.parent() {
            candidates.push(folder.join("tools").join(tool).join(executable));
            candidates.push(folder.join("tools").join(executable));
            if let Some(parent) = folder.parent() {
                candidates.push(parent.join("tools").join(tool).join(executable));
                candidates.push(parent.join("tools").join(executable));
            }
        }
    }
    candidates
}

fn ffmpeg_candidates(configured_path: Option<&str>) -> Vec<PathBuf> {
    let executable = executable_name("ffmpeg");
    let mut candidates = Vec::new();
    if let Some(configured_path) = configured_path.filter(|value| !value.trim().is_empty()) {
        candidates.push(maybe_file(
            PathBuf::from(configured_path.trim()),
            executable,
        ));
    }
    candidates.push(tool_dir("ffmpeg").join(executable));
    candidates.push(app_storage_root().join("tools").join(executable));
    if let Some(root) = repo_root() {
        candidates.push(root.join("tools").join("ffmpeg").join(executable));
        candidates.push(root.join("tools").join(executable));
    }
    candidates.extend(path_candidates_from_env(executable));
    dedupe_paths(candidates)
}

fn chromaprint_candidates(configured_path: Option<&str>) -> Vec<PathBuf> {
    let executable = executable_name("fpcalc");
    let mut candidates = Vec::new();
    if let Some(configured_path) = configured_path.filter(|value| !value.trim().is_empty()) {
        candidates.push(maybe_file(
            PathBuf::from(configured_path.trim()),
            executable,
        ));
    }
    candidates.extend(current_exe_tool_candidates("chromaprint", executable));
    candidates.push(tool_dir("chromaprint").join(executable));
    candidates.push(app_storage_root().join("tools").join(executable));
    if let Some(root) = repo_root() {
        candidates.push(
            root.join("backend")
                .join("tools")
                .join("chromaprint")
                .join(executable),
        );
        candidates.push(root.join("backend").join("tools").join(executable));
        candidates.push(root.join("tools").join("chromaprint").join(executable));
        candidates.push(root.join("tools").join(executable));
    }
    candidates.extend(path_candidates_from_env(executable));
    dedupe_paths(candidates)
}

fn resolve_tool(candidates: &[PathBuf]) -> Option<PathBuf> {
    candidates
        .iter()
        .find(|path| path.exists() && path.is_file())
        .and_then(|path| path.canonicalize().ok().or_else(|| Some(path.clone())))
}

fn resolved_chromaprint_path() -> Result<(Option<PathBuf>, Vec<PathBuf>), String> {
    let connection = open_database()?;
    let configured = get_setting(&connection, "chromaprint_fpcalc_path");
    let candidates = chromaprint_candidates(configured.as_deref());
    let resolved = resolve_tool(&candidates);
    Ok((resolved, candidates))
}

fn tool_version(path: &Path, arg: &str, timeout_label: &str) -> Option<String> {
    let mut command = Command::new(path);
    command.arg(arg);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command.output().ok()?;
    let text = String::from_utf8_lossy(if output.stdout.is_empty() {
        &output.stderr
    } else {
        &output.stdout
    });
    text.lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .or_else(|| Some(format!("{timeout_label} is available")))
}

fn status_response(
    configured_path: Option<String>,
    candidates: Vec<PathBuf>,
    resolved: Option<PathBuf>,
    version: Option<String>,
    tool_directory: PathBuf,
    ready_message: &str,
    missing_message: String,
) -> DesktopToolSetupResponse {
    let mut errors = Vec::new();
    if configured_path
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
        && resolved.is_none()
    {
        errors.push(format!(
            "Saved tool path was not found: {}",
            configured_path.as_deref().unwrap_or_default()
        ));
    }
    DesktopToolSetupResponse {
        available: resolved.is_some(),
        configured_path,
        resolved_path: resolved.map(|path| path.to_string_lossy().to_string()),
        version,
        tool_directory: tool_directory.to_string_lossy().to_string(),
        checked_paths: candidates
            .into_iter()
            .take(24)
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        message: if errors.is_empty() {
            ready_message.to_string()
        } else {
            missing_message
        },
        errors,
    }
}

pub(crate) fn resolved_ffmpeg_tool_path() -> Result<(Option<PathBuf>, Vec<PathBuf>), String> {
    let connection = open_database()?;
    let configured = get_setting(&connection, "ffmpeg_path");
    let candidates = ffmpeg_candidates(configured.as_deref());
    let resolved = resolve_tool(&candidates);
    Ok((resolved, candidates))
}

pub(crate) fn ffmpeg_setup_status() -> Result<DesktopToolSetupResponse, String> {
    let connection = open_database()?;
    let configured = get_setting(&connection, "ffmpeg_path");
    let candidates = ffmpeg_candidates(configured.as_deref());
    let resolved = resolve_tool(&candidates);
    let version = resolved
        .as_deref()
        .and_then(|path| tool_version(path, "-version", "FFmpeg"));
    Ok(status_response(
        configured,
        candidates,
        resolved,
        version,
        tool_dir("ffmpeg"),
        "FFmpeg is ready for audio conversion.",
        "FFmpeg was not found. Save an ffmpeg.exe path or place it in the FLAC Cafe tool folder."
            .to_string(),
    ))
}

fn chromaprint_status() -> Result<DesktopToolSetupResponse, String> {
    let connection = open_database()?;
    let configured = get_setting(&connection, "chromaprint_fpcalc_path");
    let candidates = chromaprint_candidates(configured.as_deref());
    let resolved = resolve_tool(&candidates);
    let version = resolved
        .as_deref()
        .and_then(|path| tool_version(path, "-version", "fpcalc"));
    Ok(status_response(
        configured,
        candidates,
        resolved,
        version,
        tool_dir("chromaprint"),
        "Chromaprint fpcalc is ready for acoustic fingerprint analysis.",
        format!(
            "fpcalc was not found in the bundled tools, saved path, or PATH. You can still place fpcalc.exe in {}.",
            tool_dir("chromaprint").display()
        ),
    ))
}

fn save_tool_path(
    setting_key: &str,
    raw_path: Option<String>,
    executable: &str,
    invalid_message: &str,
    status: fn() -> Result<DesktopToolSetupResponse, String>,
) -> Result<DesktopToolSetupResponse, String> {
    let connection = open_database()?;
    let text = raw_path.unwrap_or_default().trim().to_string();
    if text.is_empty() {
        set_setting(&connection, setting_key, None)?;
        return status();
    }
    let candidate = maybe_file(PathBuf::from(&text), executable);
    if !candidate.exists() || !candidate.is_file() {
        let mut response = status()?;
        response.configured_path = Some(text);
        response.errors.push(format!(
            "{} was not found at {}",
            executable.trim_end_matches(".exe"),
            candidate.display()
        ));
        response.message = invalid_message.to_string();
        return Ok(response);
    }
    let resolved = candidate.canonicalize().unwrap_or(candidate);
    set_setting(
        &connection,
        setting_key,
        Some(resolved.to_string_lossy().as_ref()),
    )?;
    Ok(status()?)
}

#[tauri::command]
pub fn audio_conversion_setup(
    _state: State<'_, DesktopLibraryState>,
) -> Result<DesktopToolSetupResponse, String> {
    ffmpeg_setup_status()
}

#[tauri::command]
pub fn save_audio_conversion_setup(
    _state: State<'_, DesktopLibraryState>,
    ffmpeg_path: Option<String>,
) -> Result<DesktopToolSetupResponse, String> {
    save_tool_path(
        "ffmpeg_path",
        ffmpeg_path,
        executable_name("ffmpeg"),
        "The saved path was not valid. Choose ffmpeg.exe or put it in the FLAC Cafe tool folder.",
        ffmpeg_setup_status,
    )
}

#[tauri::command]
pub fn chromaprint_setup(
    _state: State<'_, DesktopLibraryState>,
) -> Result<DesktopToolSetupResponse, String> {
    chromaprint_status()
}

#[tauri::command]
pub fn save_chromaprint_setup(
    _state: State<'_, DesktopLibraryState>,
    fpcalc_path: Option<String>,
) -> Result<DesktopToolSetupResponse, String> {
    save_tool_path(
        "chromaprint_fpcalc_path",
        fpcalc_path,
        executable_name("fpcalc"),
        "The saved path was not valid. Choose fpcalc.exe or put it in the FLAC Cafe tool folder.",
        chromaprint_status,
    )
}

fn acoustic_fingerprint_for_path(path: &Path, fpcalc_path: &Path) -> Result<String, String> {
    let mut command = Command::new(fpcalc_path);
    command.arg("-json").arg(path);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command
        .output()
        .map_err(|error| format!("Could not run fpcalc: {error}"))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(if output.stderr.is_empty() {
            &output.stdout
        } else {
            &output.stderr
        })
        .trim()
        .to_string();
        return Err(if message.is_empty() {
            "fpcalc failed".to_string()
        } else {
            message
        });
    }
    let payload = serde_json::from_slice::<serde_json::Value>(&output.stdout)
        .map_err(|error| format!("fpcalc returned invalid JSON: {error}"))?;
    payload
        .get("fingerprint")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "fpcalc did not return a fingerprint".to_string())
}

fn acoustic_fingerprint_tracks(
    track_ids: Option<Vec<i64>>,
    limit: usize,
) -> Result<Vec<DesktopTrack>, String> {
    let connection = open_database()?;
    if let Some(track_ids) = track_ids.filter(|ids| !ids.is_empty()) {
        let mut unique = Vec::new();
        for id in track_ids.into_iter().filter(|id| *id > 0) {
            if !unique.contains(&id) {
                unique.push(id);
            }
        }
        if unique.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = vec!["?"; unique.len()].join(",");
        let mut statement = connection
            .prepare(&format!(
                "SELECT {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders}) LIMIT ?"
            ))
            .map_err(|error| format!("Could not prepare fingerprint selected tracks: {error}"))?;
        let mut params = unique
            .iter()
            .map(|id| id as &dyn rusqlite::ToSql)
            .collect::<Vec<_>>();
        let limit_value = limit as i64;
        params.push(&limit_value);
        let rows = statement
            .query_map(rusqlite::params_from_iter(params), track_from_row)
            .map_err(|error| format!("Could not read fingerprint selected tracks: {error}"))?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode fingerprint selected tracks: {error}"));
    }
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS}
             FROM tracks
             WHERE acoustic_fingerprint IS NULL OR trim(acoustic_fingerprint) = ''
             ORDER BY datetime(date_added) DESC, id DESC
             LIMIT ?"
        ))
        .map_err(|error| format!("Could not prepare fingerprint candidate query: {error}"))?;
    let rows = statement
        .query_map([limit as i64], track_from_row)
        .map_err(|error| format!("Could not read fingerprint candidates: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode fingerprint candidates: {error}"))
}

#[tauri::command]
pub fn acoustic_fingerprint_pass(
    _state: State<'_, DesktopLibraryState>,
    track_ids: Option<Vec<i64>>,
    overwrite: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopAcousticFingerprintResponse, String> {
    let limit = limit.unwrap_or(200).clamp(1, 10_000);
    let overwrite = overwrite.unwrap_or(false);
    let (fpcalc_path, candidates) = resolved_chromaprint_path()?;
    let Some(fpcalc_path) = fpcalc_path else {
        let mut errors = vec![format!(
            "Chromaprint fpcalc was not found. Save a path in File Management or place fpcalc.exe in {}.",
            tool_dir("chromaprint").display()
        )];
        errors.extend(
            candidates
                .into_iter()
                .take(12)
                .map(|path| format!("Checked: {}", path.display())),
        );
        return Ok(DesktopAcousticFingerprintResponse {
            tool_available: false,
            processed: 0,
            updated: 0,
            skipped: 0,
            skipped_reasons: Vec::new(),
            errors,
        });
    };
    let tracks = acoustic_fingerprint_tracks(track_ids, limit)?;
    let connection = open_database()?;
    let mut processed = 0i64;
    let mut updated = 0i64;
    let mut skipped = 0i64;
    let mut skipped_reasons = Vec::new();
    let mut errors = Vec::new();
    for track in tracks {
        if track
            .acoustic_fingerprint
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
            && !overwrite
        {
            skipped += 1;
            skipped_reasons.push(format!(
                "{}: already has an acoustic fingerprint; enable overwrite to refresh it",
                track.title.as_deref().unwrap_or(&track.path)
            ));
            continue;
        }
        processed += 1;
        let path = PathBuf::from(&track.path);
        if !path.is_file() {
            errors.push(format!("{}: missing file", track.path));
            continue;
        }
        match acoustic_fingerprint_for_path(&path, &fpcalc_path) {
            Ok(fingerprint) => {
                connection
                    .execute(
                        "UPDATE tracks
                         SET acoustic_fingerprint = ?,
                             acoustic_fingerprint_updated_at = datetime('now'),
                             updated_at = datetime('now')
                         WHERE id = ?",
                        rusqlite::params![fingerprint, track.id],
                    )
                    .map_err(|error| format!("Could not save acoustic fingerprint: {error}"))?;
                updated += 1;
            }
            Err(error) => errors.push(format!(
                "{}: {error}",
                track.title.as_deref().unwrap_or(&track.path)
            )),
        }
    }
    if updated > 0 {
        let _ = connection.execute("DELETE FROM library_query_cache", []);
    }
    Ok(DesktopAcousticFingerprintResponse {
        tool_available: true,
        processed,
        updated,
        skipped,
        skipped_reasons: skipped_reasons.into_iter().take(100).collect(),
        errors: errors.into_iter().take(100).collect(),
    })
}
