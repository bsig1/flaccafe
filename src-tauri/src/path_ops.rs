use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Instant;

const DEFAULT_AUDIO_EXTENSIONS: &[&str] =
    &["flac", "mp3", "m4a", "ogg", "opus", "wav", "aiff", "aif"];

#[derive(Serialize)]
pub struct NativePathInfo {
    input_path: String,
    exists: bool,
    is_file: bool,
    is_dir: bool,
    canonical_path: Option<String>,
    parent_path: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
pub struct NativeAudioPath {
    path: String,
    modified_ms: Option<u128>,
    size_bytes: u64,
}

#[derive(Serialize)]
pub struct NativeAudioScanResponse {
    folders: Vec<String>,
    total_files: usize,
    total_bytes: u64,
    elapsed_ms: u128,
    files: Vec<NativeAudioPath>,
    errors: Vec<String>,
}

#[derive(Serialize)]
pub struct NativeRecycleResponse {
    requested: usize,
    recycled: usize,
    missing: usize,
    errors: Vec<String>,
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn normalized_extensions(extensions: Option<Vec<String>>) -> HashSet<String> {
    let source = extensions.unwrap_or_else(|| {
        DEFAULT_AUDIO_EXTENSIONS
            .iter()
            .map(|value| value.to_string())
            .collect()
    });
    source
        .into_iter()
        .map(|extension| {
            extension
                .trim()
                .trim_start_matches('.')
                .to_ascii_lowercase()
        })
        .filter(|extension| !extension.is_empty())
        .collect()
}

fn is_audio_path(path: &Path, extensions: &HashSet<String>) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extensions.contains(&extension.to_ascii_lowercase()))
        .unwrap_or(false)
}

#[tauri::command]
pub fn native_path_info(path: String) -> NativePathInfo {
    let input = PathBuf::from(path.trim());
    let exists = input.exists();
    let metadata = input.metadata();
    let canonical = input.canonicalize();
    NativePathInfo {
        input_path: path,
        exists,
        is_file: metadata
            .as_ref()
            .map(|value| value.is_file())
            .unwrap_or(false),
        is_dir: metadata
            .as_ref()
            .map(|value| value.is_dir())
            .unwrap_or(false),
        canonical_path: canonical.as_ref().ok().map(|value| path_to_string(value)),
        parent_path: input.parent().map(path_to_string),
        error: metadata.err().map(|error| error.to_string()),
    }
}

#[tauri::command]
pub fn native_scan_audio_paths(
    paths: Vec<String>,
    extensions: Option<Vec<String>>,
    include_files: Option<bool>,
    limit: Option<usize>,
) -> NativeAudioScanResponse {
    let started = Instant::now();
    let extensions = normalized_extensions(extensions);
    let include_files = include_files.unwrap_or(false);
    let limit = limit.unwrap_or(5000);
    let mut files = Vec::new();
    let mut total_files = 0usize;
    let mut total_bytes = 0u64;
    let mut errors = Vec::new();
    let mut folders = Vec::new();

    for raw_path in paths {
        let root = PathBuf::from(raw_path.trim());
        match root.canonicalize() {
            Ok(canonical) if canonical.is_dir() => {
                folders.push(path_to_string(&canonical));
                let mut stack = vec![canonical];
                while let Some(folder) = stack.pop() {
                    let entries = match std::fs::read_dir(&folder) {
                        Ok(entries) => entries,
                        Err(error) => {
                            errors.push(format!("{}: {error}", path_to_string(&folder)));
                            continue;
                        }
                    };
                    for entry in entries {
                        let entry = match entry {
                            Ok(entry) => entry,
                            Err(error) => {
                                errors.push(format!("{}: {error}", path_to_string(&folder)));
                                continue;
                            }
                        };
                        let path = entry.path();
                        let metadata = match entry.metadata() {
                            Ok(metadata) => metadata,
                            Err(error) => {
                                errors.push(format!("{}: {error}", path_to_string(&path)));
                                continue;
                            }
                        };
                        if metadata.is_dir() {
                            stack.push(path);
                            continue;
                        }
                        if !metadata.is_file() || !is_audio_path(&path, &extensions) {
                            continue;
                        }
                        total_files += 1;
                        total_bytes = total_bytes.saturating_add(metadata.len());
                        if include_files && files.len() < limit {
                            let modified_ms = metadata
                                .modified()
                                .ok()
                                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|duration| duration.as_millis());
                            files.push(NativeAudioPath {
                                path: path_to_string(&path),
                                modified_ms,
                                size_bytes: metadata.len(),
                            });
                        }
                    }
                }
            }
            Ok(canonical) => errors.push(format!("{} is not a folder", path_to_string(&canonical))),
            Err(error) => errors.push(format!("{}: {error}", root.display())),
        }
    }

    NativeAudioScanResponse {
        folders,
        total_files,
        total_bytes,
        elapsed_ms: started.elapsed().as_millis(),
        files,
        errors,
    }
}

#[tauri::command]
pub fn native_recycle_paths(paths: Vec<String>) -> NativeRecycleResponse {
    let requested = paths.len();
    let mut recycled = 0usize;
    let mut missing = 0usize;
    let mut errors = Vec::new();

    for raw_path in paths {
        let path = PathBuf::from(raw_path.trim());
        if !path.exists() {
            missing += 1;
            continue;
        }
        if !path.is_file() {
            errors.push(format!("{}: path is not a file", path.display()));
            continue;
        }
        match recycle_file(&path) {
            Ok(()) => recycled += 1,
            Err(error) => errors.push(format!("{}: {error}", path.display())),
        }
    }

    NativeRecycleResponse {
        requested,
        recycled,
        missing,
        errors,
    }
}

#[cfg(windows)]
fn recycle_file(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{
        SHFileOperationW, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_NOERRORUI, FOF_SILENT,
        FOF_WANTNUKEWARNING, FO_DELETE, SHFILEOPSTRUCTW,
    };

    let resolved = path
        .canonicalize()
        .map_err(|error| format!("Could not resolve path: {error}"))?;
    let mut from: Vec<u16> = resolved.as_os_str().encode_wide().collect();
    from.push(0);
    from.push(0);

    let flags =
        FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT | FOF_WANTNUKEWARNING;
    let mut operation = SHFILEOPSTRUCTW {
        hwnd: Default::default(),
        wFunc: FO_DELETE,
        pFrom: PCWSTR(from.as_ptr()),
        pTo: PCWSTR::null(),
        fFlags: flags.0 as u16,
        fAnyOperationsAborted: Default::default(),
        hNameMappings: Default::default(),
        lpszProgressTitle: PCWSTR::null(),
    };

    let result = unsafe { SHFileOperationW(&mut operation) };
    if result != 0 {
        return Err(format!(
            "Could not move file to the Recycle Bin (shell error {result})"
        ));
    }
    if operation.fAnyOperationsAborted.as_bool() {
        return Err("Recycle Bin operation was canceled".to_string());
    }
    if resolved.exists() {
        return Err("Recycle Bin operation completed, but the file is still present".to_string());
    }
    Ok(())
}

#[cfg(not(windows))]
fn recycle_file(_path: &Path) -> Result<(), String> {
    Err("Moving files to the Recycle Bin is currently only available on Windows.".to_string())
}

#[cfg(test)]
mod tests {
    use super::{is_audio_path, native_path_info, normalized_extensions};
    use std::path::Path;

    #[test]
    fn matches_audio_extensions_case_insensitively() {
        let extensions = normalized_extensions(Some(vec![".FLAC".to_string(), "mp3".to_string()]));
        assert!(is_audio_path(Path::new("song.FLAC"), &extensions));
        assert!(is_audio_path(Path::new("song.mp3"), &extensions));
        assert!(!is_audio_path(Path::new("cover.jpg"), &extensions));
    }

    #[test]
    fn reports_missing_path_without_throwing() {
        let info = native_path_info("Z:/definitely/not/here.flac".to_string());
        assert!(!info.exists);
        assert!(!info.is_file);
        assert!(!info.is_dir);
    }
}
