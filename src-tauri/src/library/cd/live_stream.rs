pub fn prepare_cd_playback_track(body: JsonValue) -> Result<JsonValue, String> {
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
    let duration = cd_track_duration(&drive_id, track_number)?;
    let track = track_metadata(&body, track_number);
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
        "audio_url": JsonValue::Null,
        "is_preview": true,
    });
    Ok(json!({
        "status": "prepared",
        "track_number": track_number,
        "message": format!("Prepared CD track {track_number:02}."),
        "track": preview_track,
    }))
}

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

pub fn prepare_cd_playback_wav(
    drive_id: &str,
    track_number: i64,
    title: Option<&str>,
) -> Result<PathBuf, String> {
    let drive_id =
        normalize_drive_id(drive_id).ok_or_else(|| "Choose a CD drive first.".to_string())?;
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
