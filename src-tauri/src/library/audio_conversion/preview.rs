
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
