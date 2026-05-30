pub fn prepare_cd_live_track(body: JsonValue) -> Result<JsonValue, String> {
    let drive_id = json_string(&body, "drive_id")
        .or_else(|| json_string(&body, "driveId"))
        .and_then(|value| normalize_drive_id(&value))
        .ok_or_else(|| "Choose a CD drive first.".to_string())?;
    if active_rip_for_drive(&drive_id) {
        return Err("Stop the active rip before playing this CD drive.".to_string());
    }
    let track_number = json_i64(&body, "track_number")
        .or_else(|| json_i64(&body, "trackNumber"))
        .unwrap_or(1)
        .max(1);
    let token = format!("{:x}", OffsetDateTime::now_utc().unix_timestamp_nanos());
    replace_stream_token(&drive_id, &token);
    let duration = cd_track_duration(&drive_id, track_number)?;
    let track = track_metadata(&body, track_number);
    let letter = drive_letter(&drive_id).unwrap_or('C');
    let audio_url =
        format!("flaccafe-media://localhost/cd-live-audio/{letter}/{track_number}/{token}");
    let preview_track = json!({
        "id": -((OffsetDateTime::now_utc().unix_timestamp_nanos().unsigned_abs() % 2_000_000_000) as i64) - 1,
        "path": format!("cdda://{drive_id}/track/{track_number:02}"),
        "title": track.get("title").cloned().unwrap_or_else(|| json!(format!("Track {track_number:02}"))),
        "artist": track.get("artist").cloned().unwrap_or(JsonValue::Null),
        "album": track.get("album").cloned().unwrap_or(JsonValue::Null),
        "album_artist": track.get("album_artist").cloned().unwrap_or(JsonValue::Null),
        "track_number": track_number,
        "disc_number": track.get("disc_number").and_then(JsonValue::as_i64).unwrap_or(1),
        "genre": track.get("genre").cloned().unwrap_or_else(|| json!("CD Preview")),
        "analysis_provider": JsonValue::Null,
        "analysis_model": JsonValue::Null,
        "analysis_genre": JsonValue::Null,
        "analysis_genre_confidence": JsonValue::Null,
        "analysis_genre_tags": JsonValue::Null,
        "analysis_mood": JsonValue::Null,
        "analysis_mood_confidence": JsonValue::Null,
        "analysis_mood_tags": JsonValue::Null,
        "analysis_embedding": JsonValue::Null,
        "analysis_updated_at": JsonValue::Null,
        "year": track.get("year").cloned().unwrap_or(JsonValue::Null),
        "duration_seconds": duration,
        "bitrate": 1_411_200,
        "replaygain_track_gain_db": JsonValue::Null,
        "replaygain_album_gain_db": JsonValue::Null,
        "replaygain_track_peak": JsonValue::Null,
        "replaygain_album_peak": JsonValue::Null,
        "audio_fingerprint": JsonValue::Null,
        "acoustic_fingerprint": JsonValue::Null,
        "acoustic_fingerprint_updated_at": JsonValue::Null,
        "rating": JsonValue::Null,
        "play_count": 0,
        "skip_count": 0,
        "last_played_at": JsonValue::Null,
        "last_skipped_at": JsonValue::Null,
        "date_added": utc_now(),
        "file_modified_at": JsonValue::Null,
        "audio_url": audio_url,
        "is_preview": true,
    });
    Ok(json!({
        "status": "prepared",
        "track_number": track_number,
        "message": format!("Playing CD track {track_number:02}."),
        "track": preview_track,
    }))
}

const CD_STREAM_RANGE_CHUNK_BYTES: u64 = 1024 * 1024;

fn cd_track_duration(drive_id: &str, track_number: i64) -> Result<f64, String> {
    #[cfg(windows)]
    {
        let handle = open_cd_handle(drive_id)?;
        let entries = read_toc(handle.0)?;
        let (_start, sectors) = track_bounds_from_entries(&entries, track_number)?;
        Ok(sectors as f64 / CD_FRAMES_PER_SECOND as f64)
    }
    #[cfg(not(windows))]
    {
        let _ = (drive_id, track_number);
        Err("Windows CDDA playback is only available on Windows.".to_string())
    }
}

pub fn stop_cd_playback() -> JsonValue {
    clear_stream_tokens(None);
    json!({
        "status": "stopped",
        "track_number": JsonValue::Null,
        "message": "CD playback stopped.",
        "track": JsonValue::Null,
    })
}

pub fn prepare_cd_playback_wav(
    drive_id: &str,
    track_number: i64,
    title: Option<&str>,
) -> Result<PathBuf, String> {
    let drive_id = normalize_drive_id(drive_id)
        .ok_or_else(|| "Choose a CD drive first.".to_string())?;
    if active_rip_for_drive(&drive_id) {
        return Err("Stop the active rip before playing this CD drive.".to_string());
    }
    let safe_title = title
        .map(sanitize_cd_cache_part)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("track_{track_number:02}"));
    let safe_drive = sanitize_cd_cache_part(&drive_id);
    let cache_dir = std::env::temp_dir()
        .join("flac-cafe")
        .join("cd-playback-cache")
        .join(safe_drive);
    fs::create_dir_all(&cache_dir)
        .map_err(|error| format!("Could not create CD playback cache: {error}"))?;
    let wav_path = cache_dir.join(format!("{track_number:02}_{safe_title}.wav"));
    if wav_path.exists() && wav_path.is_file() {
        return Ok(wav_path);
    }
    let partial_path = cache_dir.join(format!("{track_number:02}_{safe_title}.wav.part"));
    rip_track_to_wav(&drive_id, track_number, &partial_path)?;
    fs::rename(&partial_path, &wav_path)
        .map_err(|error| format!("Could not finalize CD playback WAV: {error}"))?;
    Ok(wav_path)
}

fn sanitize_cd_cache_part(value: &str) -> String {
    let mut output = String::new();
    for character in value.chars() {
        if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
            output.push(character);
        } else {
            output.push('_');
        }
    }
    let trimmed = output.trim_matches('_');
    if trimmed.is_empty() {
        "cd".to_string()
    } else {
        trimmed.chars().take(80).collect()
    }
}

fn wav_header_bytes(data_size: usize) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(44);
    let _ = write_wav_header(&mut bytes, data_size as u32);
    bytes
}

fn response_with_status(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(message.as_bytes().to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn range_not_satisfiable(total_len: u64) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::RANGE_NOT_SATISFIABLE)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::CONTENT_RANGE, format!("bytes */{total_len}"))
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(
            header::ACCESS_CONTROL_EXPOSE_HEADERS,
            "Accept-Ranges, Content-Length, Content-Range",
        )
        .body(b"Requested range is not satisfiable".to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn parse_range_header(value: Option<&str>, total_len: u64) -> Option<(u64, u64)> {
    let raw = value?.trim().strip_prefix("bytes=")?;
    let (start, end) = raw.split_once('-')?;
    if start.is_empty() {
        let suffix = end.parse::<u64>().ok()?;
        let start = total_len.saturating_sub(suffix);
        return Some((start, total_len.saturating_sub(1)));
    }
    let start = start.parse::<u64>().ok()?;
    if start >= total_len {
        return None;
    }
    let end = if end.is_empty() {
        total_len.saturating_sub(1)
    } else {
        end.parse::<u64>().ok()?.min(total_len.saturating_sub(1))
    };
    (end >= start).then_some((start, end))
}

fn capped_audio_range_end(start: u64, requested_end: u64) -> u64 {
    requested_end.min(start.saturating_add(CD_STREAM_RANGE_CHUNK_BYTES - 1))
}

pub fn serve_cd_live_audio(
    request: &Request<Vec<u8>>,
    drive_letter: &str,
    track_number: i64,
    token: &str,
) -> Response<Vec<u8>> {
    let drive_id = format!(
        "{}:",
        drive_letter.trim_end_matches(':').to_ascii_uppercase()
    );
    if !stream_token_current(&drive_id, token) {
        return response_with_status(StatusCode::GONE, "CD stream is stale");
    }
    #[cfg(windows)]
    {
        let handle = match open_cd_handle(&drive_id) {
            Ok(handle) => handle,
            Err(error) => return response_with_status(StatusCode::NOT_FOUND, &error),
        };
        let entries = match read_toc(handle.0) {
            Ok(entries) => entries,
            Err(error) => return response_with_status(StatusCode::NOT_FOUND, &error),
        };
        let (start_lba, total_sectors) = match track_bounds_from_entries(&entries, track_number) {
            Ok(bounds) => bounds,
            Err(error) => return response_with_status(StatusCode::NOT_FOUND, &error),
        };
        let data_size = total_sectors as usize * CDDA_SECTOR_SIZE;
        let total_len = 44u64 + data_size as u64;
        if request.method() == Method::HEAD {
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "audio/wav")
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CACHE_CONTROL, "no-store")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .header(
                    header::ACCESS_CONTROL_EXPOSE_HEADERS,
                    "Accept-Ranges, Content-Length, Content-Range",
                )
                .header(header::CONTENT_LENGTH, total_len.to_string())
                .body(Vec::new())
                .unwrap_or_else(|_| Response::new(Vec::new()));
        }
        let range_header = request
            .headers()
            .get(header::RANGE)
            .and_then(|value| value.to_str().ok());
        let range = if range_header.is_some() {
            match parse_range_header(range_header, total_len) {
                Some(range) => Some(range),
                None => return range_not_satisfiable(total_len),
            }
        } else {
            None
        };
        let (start, end, status) = match range {
            Some((start, end)) => (start, capped_audio_range_end(start, end), StatusCode::PARTIAL_CONTENT),
            None => (0, total_len.saturating_sub(1), StatusCode::OK),
        };
        let body = cd_virtual_wav_range(
            handle.0,
            start_lba,
            total_sectors,
            start as usize,
            end as usize,
        );
        let mut builder = Response::builder()
            .status(status)
            .header(header::CONTENT_TYPE, "audio/wav")
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CACHE_CONTROL, "no-store")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(
                header::ACCESS_CONTROL_EXPOSE_HEADERS,
                "Accept-Ranges, Content-Length, Content-Range",
            )
            .header(header::CONTENT_LENGTH, body.len().to_string());
        if status == StatusCode::PARTIAL_CONTENT {
            builder = builder.header(
                header::CONTENT_RANGE,
                format!("bytes {start}-{end}/{total_len}"),
            );
        }
        builder
            .body(body)
            .unwrap_or_else(|_| Response::new(Vec::new()))
    }
    #[cfg(not(windows))]
    {
        let _ = (request, track_number, token);
        response_with_status(
            StatusCode::NOT_FOUND,
            "CD live audio is only available on Windows.",
        )
    }
}

#[cfg(windows)]
fn cd_virtual_wav_range(
    handle: HANDLE,
    start_lba: i64,
    total_sectors: i64,
    start: usize,
    end: usize,
) -> Vec<u8> {
    let data_size = total_sectors as usize * CDDA_SECTOR_SIZE;
    let header = wav_header_bytes(data_size);
    let total_len = 44 + data_size;
    if start >= total_len || end < start {
        return Vec::new();
    }
    let end = end.min(total_len - 1);
    let mut output = Vec::with_capacity(end - start + 1);
    if start < 44 {
        let header_end = end.min(43);
        output.extend_from_slice(&header[start..=header_end]);
    }
    if end >= 44 {
        let data_start = start.max(44) - 44;
        let data_end = end - 44;
        let first_sector = data_start / CDDA_SECTOR_SIZE;
        let last_sector = data_end / CDDA_SECTOR_SIZE;
        let mut sector = first_sector;
        while sector <= last_sector {
            let batch = STREAM_READ_SECTORS.min((last_sector - sector + 1) as i64);
            let mut bytes = read_cdda(handle, start_lba + sector as i64, batch)
                .unwrap_or_else(|_| vec![0u8; batch as usize * CDDA_SECTOR_SIZE]);
            bytes.resize(batch as usize * CDDA_SECTOR_SIZE, 0);
            let sector_data_start = sector * CDDA_SECTOR_SIZE;
            let slice_start = data_start.saturating_sub(sector_data_start);
            let slice_end = (data_end - sector_data_start + 1).min(bytes.len());
            if slice_start < slice_end {
                output.extend_from_slice(&bytes[slice_start..slice_end]);
            }
            sector += batch as usize;
        }
    }
    output
}

fn json_string(value: &JsonValue, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn json_i64(value: &JsonValue, key: &str) -> Option<i64> {
    value.get(key).and_then(|value| {
        value
            .as_i64()
            .or_else(|| value.as_str()?.parse::<i64>().ok())
    })
}

fn json_bool(value: &JsonValue, key: &str) -> Option<bool> {
    match value.get(key)? {
        JsonValue::Bool(value) => Some(*value),
        JsonValue::String(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

#[cfg(test)]
mod cd_live_stream_tests {
    use super::{capped_audio_range_end, parse_range_header, CD_STREAM_RANGE_CHUNK_BYTES};

    #[test]
    fn open_ended_ranges_parse_to_the_virtual_track_end() {
        assert_eq!(
            parse_range_header(Some("bytes=0-"), 12_000_000),
            Some((0, 11_999_999))
        );
    }

    #[test]
    fn cd_live_audio_ranges_are_capped_for_webview_streaming() {
        assert_eq!(
            capped_audio_range_end(0, 12_000_000),
            CD_STREAM_RANGE_CHUNK_BYTES - 1
        );
    }
}
