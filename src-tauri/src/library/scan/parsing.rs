fn parse_scan_snapshot(body: &JsonValue) -> (Option<Vec<AudioSnapshot>>, Vec<String>) {
    let Some(snapshot) = body.get("snapshot").and_then(JsonValue::as_object) else {
        return (None, Vec::new());
    };
    let files = snapshot
        .get("files")
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(AudioSnapshot::from_worker_json)
                .collect::<Vec<_>>()
        });
    let errors = snapshot
        .get("errors")
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(JsonValue::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    (files, errors)
}

fn normalize_folder_path(value: &str) -> Result<PathBuf, String> {
    let cleaned = value.trim();
    if cleaned.is_empty() {
        return Err("Choose at least one music folder".to_string());
    }
    Ok(PathBuf::from(normalize_path_text(Path::new(cleaned))))
}

pub(crate) fn normalize_path_text(path: &Path) -> String {
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    };
    let resolved = path.canonicalize().unwrap_or(path);
    clean_windows_verbatim(&resolved.to_string_lossy())
}

fn clean_windows_verbatim(value: &str) -> String {
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = value.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        value.to_string()
    }
}

pub(crate) fn path_key(path: &Path) -> String {
    path_key_text(&normalize_path_text(path))
}

pub(crate) fn path_key_text(value: &str) -> String {
    if cfg!(windows) {
        value.to_ascii_lowercase()
    } else {
        value.to_string()
    }
}

pub(crate) fn path_is_under_folder(path: &Path, folder: &Path) -> bool {
    let path_key_value = path_key(path);
    let mut folder_key = path_key(folder);
    if path_key_value == folder_key {
        return true;
    }
    if !folder_key.ends_with(std::path::MAIN_SEPARATOR) {
        folder_key.push(std::path::MAIN_SEPARATOR);
    }
    path_key_value.starts_with(&folder_key)
}

pub(crate) fn is_supported_audio_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| format!(".{}", extension.to_ascii_lowercase()))
        .map(|extension| SUPPORTED_EXTENSIONS.contains(&extension.as_str()))
        .unwrap_or(false)
}

fn system_time_to_iso(value: SystemTime) -> Option<String> {
    let datetime = OffsetDateTime::from(value).replace_microsecond(0).ok()?;
    Some(format_py_utc(datetime))
}

fn epoch_millis_to_iso(value: i64) -> Option<String> {
    OffsetDateTime::from_unix_timestamp(value.div_euclid(1000))
        .ok()
        .map(|datetime| format_py_utc(datetime.replace_microsecond(0).unwrap_or(datetime)))
}

pub(crate) fn utc_now() -> String {
    format_py_utc(
        OffsetDateTime::now_utc()
            .replace_microsecond(0)
            .unwrap_or_else(|_| OffsetDateTime::now_utc()),
    )
}

fn format_py_utc(value: OffsetDateTime) -> String {
    value
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
        .trim_end_matches('Z')
        .to_string()
        + "+00:00"
}

fn new_job_id() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("{now:x}{:x}", std::process::id())
}

fn body_string(body: &JsonValue, key: &str) -> Option<String> {
    body.get(key)
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn body_string_vec(body: &JsonValue, key: &str) -> Vec<String> {
    body.get(key)
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(JsonValue::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn json_string(metadata: &serde_json::Map<String, JsonValue>, key: &str) -> Option<String> {
    metadata
        .get(key)
        .and_then(JsonValue::as_str)
        .map(str::to_string)
        .or_else(|| {
            metadata
                .get(key)
                .filter(|value| value.is_number())
                .map(JsonValue::to_string)
        })
}

fn required_text(
    metadata: &serde_json::Map<String, JsonValue>,
    key: &str,
) -> Result<String, String> {
    json_string(metadata, key)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("Metadata field {key} is missing"))
}

fn json_i64(metadata: &serde_json::Map<String, JsonValue>, key: &str) -> Option<i64> {
    metadata.get(key).and_then(|value| {
        value
            .as_i64()
            .or_else(|| value.as_u64().and_then(|value| i64::try_from(value).ok()))
            .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()))
    })
}

fn json_f64(metadata: &serde_json::Map<String, JsonValue>, key: &str) -> Option<f64> {
    metadata.get(key).and_then(|value| {
        value
            .as_f64()
            .or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok()))
    })
}

fn anonymized_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    value.chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_python_style_utc_timestamp() {
        let text = epoch_millis_to_iso(1_700_000_000_123).unwrap();
        assert!(text.ends_with("+00:00"));
        assert!(!text.ends_with('Z'));
    }

    #[test]
    fn detects_supported_audio_extensions_case_insensitively() {
        assert!(is_supported_audio_path(Path::new("Song.FLAC")));
        assert!(is_supported_audio_path(Path::new("Song.mp3")));
        assert!(!is_supported_audio_path(Path::new("cover.jpg")));
    }
}

