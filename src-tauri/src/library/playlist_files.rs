use super::*;

pub(super) struct ParsedPlaylistEntries {
    pub(super) entries: Vec<String>,
    pub(super) local_paths: Vec<PathBuf>,
}

fn read_playlist_text(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path)
        .map_err(|error| format!("Could not read playlist {}: {error}", path.display()))?;
    match String::from_utf8(bytes.clone()) {
        Ok(text) => Ok(text.trim_start_matches('\u{feff}').to_string()),
        Err(_) => Ok(bytes.into_iter().map(char::from).collect()),
    }
}

fn percent_decode_text(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = &input[index + 1..index + 3];
            if let Ok(value) = u8::from_str_radix(hex, 16) {
                output.push(value);
                index += 3;
                continue;
            }
        }
        output.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&output).to_string()
}

fn xml_unescape_text(input: &str) -> String {
    input
        .trim()
        .trim_start_matches("<![CDATA[")
        .trim_end_matches("]]>")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn looks_like_windows_drive_path(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() >= 3 && bytes[1] == b':' && (bytes[2] == b'\\' || bytes[2] == b'/')
}

fn uri_scheme(text: &str) -> Option<String> {
    let colon_index = text.find(':')?;
    if colon_index == 1 && text.as_bytes().first().is_some_and(u8::is_ascii_alphabetic) {
        return None;
    }
    let scheme = &text[..colon_index];
    if scheme
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
    {
        Some(scheme.to_ascii_lowercase())
    } else {
        None
    }
}

pub(super) fn playlist_entry_path(entry: &str, base_folder: &Path) -> Option<PathBuf> {
    let text = entry.trim().trim_matches('"').trim_matches('\'');
    if text.is_empty() {
        return None;
    }
    if looks_like_windows_drive_path(text) {
        return Some(PathBuf::from(percent_decode_text(text)));
    }
    if text.to_ascii_lowercase().starts_with("file://") {
        let without_scheme = &text[7..];
        let (host, path_part) = if let Some(separator) = without_scheme.find('/') {
            (&without_scheme[..separator], &without_scheme[separator..])
        } else {
            ("", without_scheme)
        };
        let mut decoded = percent_decode_text(path_part);
        if decoded.starts_with('/') && looks_like_windows_drive_path(&decoded[1..]) {
            decoded = decoded[1..].to_string();
        }
        if !host.is_empty() && !host.eq_ignore_ascii_case("localhost") {
            decoded = format!("//{host}{decoded}");
        }
        return Some(PathBuf::from(decoded));
    }
    if let Some(scheme) = uri_scheme(text) {
        if matches!(scheme.as_str(), "http" | "https" | "icy") {
            return None;
        }
        return None;
    }
    let candidate = PathBuf::from(percent_decode_text(text));
    if candidate.is_absolute() {
        Some(candidate)
    } else {
        Some(base_folder.join(candidate))
    }
}

fn playlist_values_from_regex(content: &str, pattern: &str) -> Result<Vec<String>, String> {
    let regex =
        regex::Regex::new(pattern).map_err(|error| format!("Invalid playlist parser: {error}"))?;
    Ok(regex
        .captures_iter(content)
        .filter_map(|capture| {
            capture
                .get(1)
                .map(|value| xml_unescape_text(value.as_str()))
        })
        .filter(|value| !value.trim().is_empty())
        .collect())
}

pub(super) fn parse_playlist_entries(
    path: &Path,
    content: &str,
) -> Result<ParsedPlaylistEntries, String> {
    let base_folder = path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let suffix = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let entries = match suffix.as_str() {
        "m3u" | "m3u8" => content
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .map(str::to_string)
            .collect::<Vec<_>>(),
        "pls" => content
            .lines()
            .filter_map(|line| {
                let (key, value) = line.split_once('=')?;
                key.trim()
                    .to_ascii_lowercase()
                    .starts_with("file")
                    .then(|| value.trim().to_string())
            })
            .collect::<Vec<_>>(),
        "xspf" => playlist_values_from_regex(
            content,
            r"(?is)<(?:\w+:)?location[^>]*>(.*?)</(?:\w+:)?location>",
        )?,
        "wpl" => {
            let mut values = playlist_values_from_regex(
                content,
                r#"(?is)<(?:\w+:)?media\b[^>]*\bsrc\s*=\s*"([^"]+)""#,
            )?;
            values.extend(playlist_values_from_regex(
                content,
                r#"(?is)<(?:\w+:)?media\b[^>]*\bsrc\s*=\s*'([^']+)'"#,
            )?);
            values
        }
        "xml" => playlist_values_from_regex(
            content,
            r"(?is)<(?:\w+:)?key[^>]*>\s*Location\s*</(?:\w+:)?key>\s*<(?:\w+:)?string[^>]*>(.*?)</(?:\w+:)?string>",
        )?,
        _ => {
            return Err(
                "Supported playlist imports: .m3u, .m3u8, .pls, .xspf, .wpl, and iTunes .xml"
                    .to_string(),
            );
        }
    };
    let local_paths = entries
        .iter()
        .filter_map(|entry| playlist_entry_path(entry, &base_folder))
        .collect();
    Ok(ParsedPlaylistEntries {
        entries,
        local_paths,
    })
}

#[tauri::command]
pub fn parse_playlist(playlist_path: String) -> Result<DesktopPlaylistParseResponse, String> {
    let path = PathBuf::from(playlist_path.trim());
    if !path.is_file() {
        return Err(format!("Playlist file does not exist: {}", path.display()));
    }
    let content = read_playlist_text(&path)?;
    let parsed = parse_playlist_entries(&path, &content)?;
    let base_folder = path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut local_paths = Vec::new();
    let mut errors = Vec::new();
    for resolved in parsed.local_paths {
        if resolved.exists() {
            local_paths.push(resolved.to_string_lossy().to_string());
        } else {
            errors.push(format!("Missing playlist entry: {}", resolved.display()));
        }
    }
    Ok(DesktopPlaylistParseResponse {
        playlist_path: path.to_string_lossy().to_string(),
        base_folder: base_folder.to_string_lossy().to_string(),
        entries: parsed.entries,
        local_paths,
        errors,
    })
}

pub fn import_playlist(
    playlist_path: String,
    name: Option<String>,
) -> Result<DesktopPlaylistSummary, String> {
    let path = PathBuf::from(playlist_path.trim());
    if !path.is_file() {
        return Err(format!("Playlist file does not exist: {}", path.display()));
    }
    let content = read_playlist_text(&path)?;
    let parsed = parse_playlist_entries(&path, &content)?;
    let base_name = name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            path.file_stem()
                .and_then(|value| value.to_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "Imported Playlist".to_string());
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust playlist import: {error}"))?;
    let mut playlist_name = base_name.clone();
    let mut suffix = 2;
    while transaction
        .query_row(
            "SELECT id FROM playlists WHERE name = ?",
            params![playlist_name],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .is_some()
    {
        playlist_name = format!("{base_name} {suffix}");
        suffix += 1;
    }
    transaction
        .execute(
            "INSERT INTO playlists(name) VALUES(?)",
            params![playlist_name],
        )
        .map_err(|error| format!("Could not create imported playlist: {error}"))?;
    let playlist_id = transaction.last_insert_rowid();

    let keys = parsed
        .local_paths
        .iter()
        .map(|path| normalized_path_key(&path.to_string_lossy()))
        .collect::<Vec<_>>();
    let found_tracks = {
        let mut found = HashMap::new();
        let mut statement = transaction
            .prepare("SELECT id FROM tracks WHERE path_key = ?")
            .map_err(|error| {
                format!("Could not prepare imported playlist track lookup: {error}")
            })?;
        for key in &keys {
            if let Ok(track_id) = statement.query_row(params![key], |row| row.get::<_, i64>(0)) {
                found.insert(key.clone(), track_id);
            }
        }
        found
    };
    let mut position = 0i64;
    for key in keys {
        let Some(track_id) = found_tracks.get(&key).copied() else {
            continue;
        };
        position += 1;
        transaction
            .execute(
                "INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position) VALUES(?, ?, ?)",
                params![playlist_id, track_id, position],
            )
            .map_err(|error| format!("Could not add imported playlist track: {error}"))?;
    }
    compact_playlist_positions(&transaction, playlist_id)?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save imported playlist: {error}"))?;
    playlist_summary_by_id(&connection, playlist_id)
}

#[tauri::command]
pub fn export_m3u(
    playlist_path: String,
    track_paths: Vec<String>,
) -> Result<DesktopExportResponse, String> {
    let path = PathBuf::from(playlist_path.trim());
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create playlist folder {}: {error}",
                parent.display()
            )
        })?;
    }
    let mut text = String::from("#EXTM3U\n");
    for track_path in &track_paths {
        text.push_str(track_path);
        text.push('\n');
    }
    std::fs::write(&path, text)
        .map_err(|error| format!("Could not write playlist {}: {error}", path.display()))?;
    Ok(DesktopExportResponse {
        playlist_path: path.to_string_lossy().to_string(),
        track_count: track_paths.len() as i64,
    })
}
