pub fn cd_metadata(body: JsonValue) -> Result<JsonValue, String> {
    let mut warnings = Vec::new();
    let drive_id = json_string(&body, "drive_id").or_else(|| json_string(&body, "driveId"));
    let album_title = json_string(&body, "album_title")
        .or_else(|| json_string(&body, "albumTitle"))
        .unwrap_or_default();
    let album_artist = json_string(&body, "album_artist")
        .or_else(|| json_string(&body, "albumArtist"))
        .unwrap_or_default();
    let release_id = json_string(&body, "release_id")
        .or_else(|| json_string(&body, "releaseId"))
        .unwrap_or_default();
    let limit = json_i64(&body, "limit").unwrap_or(5).clamp(1, 10);
    let mut releases = Vec::new();
    let mut source = "none".to_string();
    let mut disc = None;
    if !release_id.trim().is_empty() {
        if let Some(release) = lookup_release(release_id.trim())? {
            releases.push(release);
            source = "MusicBrainz release".to_string();
        }
    } else if let Some(drive_id) = drive_id.as_deref().and_then(normalize_drive_id) {
        match disc_id_for_drive(&drive_id) {
            Ok(info) => {
                match lookup_discid_releases(&info) {
                    Ok(found) => {
                        releases = found;
                        source = "MusicBrainz Disc ID".to_string();
                    }
                    Err(error) => warnings.push(error),
                }
                disc = Some(info);
            }
            Err(error) => warnings.push(format!(
                "Could not calculate the MusicBrainz Disc ID for {drive_id}: {error}"
            )),
        }
    }
    if releases.is_empty() && release_id.trim().is_empty() && !album_title.trim().is_empty() {
        releases = search_releases(
            album_title.trim(),
            (!album_artist.trim().is_empty()).then_some(album_artist.trim()),
            limit,
        )?;
        source = "MusicBrainz search".to_string();
    }
    let expected_track_count = drive_id
        .as_deref()
        .map(track_entries_for_drive)
        .map(|tracks| tracks.len() as i64)
        .unwrap_or(0);
    let mut candidates = releases
        .iter()
        .map(|release| {
            let mut candidate = release_candidate(
                release,
                (!album_title.trim().is_empty()).then_some(album_title.trim()),
                (!album_artist.trim().is_empty()).then_some(album_artist.trim()),
            );
            if source == "MusicBrainz Disc ID" {
                candidate["confidence"] = json!(1.0);
            }
            candidate
        })
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        let left_conf = left
            .get("confidence")
            .and_then(JsonValue::as_f64)
            .unwrap_or(0.0);
        let right_conf = right
            .get("confidence")
            .and_then(JsonValue::as_f64)
            .unwrap_or(0.0);
        right_conf
            .partial_cmp(&left_conf)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                let left_delta = (left
                    .get("track_count")
                    .and_then(JsonValue::as_i64)
                    .unwrap_or(0)
                    - expected_track_count)
                    .abs();
                let right_delta = (right
                    .get("track_count")
                    .and_then(JsonValue::as_i64)
                    .unwrap_or(0)
                    - expected_track_count)
                    .abs();
                left_delta.cmp(&right_delta)
            })
    });
    let message = if candidates.is_empty() {
        if source == "MusicBrainz Disc ID" {
            "No MusicBrainz Disc ID match found. Try album/artist search or submit this Disc ID with Picard."
        } else {
            "No MusicBrainz match found. You can still rip with manual track names."
        }
    } else {
        "Found MusicBrainz metadata candidates."
    };
    Ok(json!({
        "drive_id": drive_id,
        "source": source,
        "query": {
            "album_title": if album_title.trim().is_empty() { None } else { Some(album_title.trim().to_string()) },
            "album_artist": if album_artist.trim().is_empty() { None } else { Some(album_artist.trim().to_string()) },
            "release_id": if release_id.trim().is_empty() { None } else { Some(release_id.trim().to_string()) },
            "disc_id": disc.as_ref().map(|disc| disc.disc_id.clone()),
            "disc_audio_track_count": disc.as_ref().map(|disc| disc.audio_track_count),
        },
        "candidates": candidates,
        "cd_text_available": false,
        "disc_id": disc.as_ref().map(|disc| disc.disc_id.clone()),
        "message": message,
        "warnings": warnings,
    }))
}

fn output_extension(format: &str) -> &'static str {
    match format {
        "mp3" => ".mp3",
        "wav" => ".wav",
        _ => ".flac",
    }
}

fn safe_component(value: Option<&str>, fallback: &str) -> String {
    let text = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback);
    let cleaned = text
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .chars()
        .take(120)
        .collect::<String>();
    if cleaned.is_empty() {
        fallback.to_string()
    } else {
        cleaned
    }
}

fn track_metadata(body: &JsonValue, track_number: i64) -> JsonValue {
    let mapped = body
        .get("tracks")
        .and_then(JsonValue::as_array)
        .and_then(|tracks| {
            tracks.iter().find(|track| {
                track
                    .get("track_number")
                    .or_else(|| track.get("trackNumber"))
                    .and_then(JsonValue::as_i64)
                    == Some(track_number)
            })
        })
        .cloned()
        .unwrap_or_else(|| json!({}));
    let album_title = json_string(body, "album_title").or_else(|| json_string(body, "albumTitle"));
    let album_artist =
        json_string(body, "album_artist").or_else(|| json_string(body, "albumArtist"));
    let year = json_i64(body, "year");
    let genre = json_string(body, "genre");
    json!({
        "track_number": track_number,
        "disc_number": mapped.get("disc_number").or_else(|| mapped.get("discNumber")).and_then(JsonValue::as_i64).unwrap_or(1),
        "title": mapped.get("title").and_then(JsonValue::as_str).map(str::to_string).unwrap_or_else(|| format!("Track {track_number:02}")),
        "artist": mapped.get("artist").and_then(JsonValue::as_str).map(str::to_string).or(album_artist.clone()),
        "album": album_title,
        "album_artist": album_artist,
        "year": year,
        "genre": genre,
        "duration_seconds": mapped.get("duration_seconds").or_else(|| mapped.get("durationSeconds")).and_then(JsonValue::as_f64),
    })
}

fn selected_track_numbers(body: &JsonValue, drive_id: &str) -> Result<Vec<i64>, String> {
    if let Some(numbers) = body
        .get("track_numbers")
        .or_else(|| body.get("trackNumbers"))
        .and_then(JsonValue::as_array)
    {
        let mut values = numbers
            .iter()
            .filter_map(JsonValue::as_i64)
            .filter(|value| *value > 0)
            .collect::<Vec<_>>();
        values.sort();
        values.dedup();
        if !values.is_empty() {
            return Ok(values);
        }
    }
    if let Some(tracks) = body.get("tracks").and_then(JsonValue::as_array) {
        let mut values = tracks
            .iter()
            .filter_map(|track| {
                track
                    .get("track_number")
                    .or_else(|| track.get("trackNumber"))
                    .and_then(JsonValue::as_i64)
            })
            .filter(|value| *value > 0)
            .collect::<Vec<_>>();
        values.sort();
        values.dedup();
        if !values.is_empty() {
            return Ok(values);
        }
    }
    let detected = track_entries_for_drive(drive_id)
        .into_iter()
        .filter_map(|track| track.get("track_number").and_then(JsonValue::as_i64))
        .collect::<Vec<_>>();
    if detected.is_empty() {
        Err("Choose at least one CD track.".to_string())
    } else {
        Ok(detected)
    }
}

fn cd_target_path(body: &JsonValue, track: &JsonValue) -> Result<PathBuf, String> {
    let output_folder = json_string(body, "output_folder")
        .or_else(|| json_string(body, "outputFolder"))
        .ok_or_else(|| "Output folder is required".to_string())?;
    let output_format = json_string(body, "output_format")
        .or_else(|| json_string(body, "outputFormat"))
        .unwrap_or_else(|| "flac".to_string());
    let album_artist = safe_component(
        track
            .get("album_artist")
            .or_else(|| track.get("artist"))
            .and_then(JsonValue::as_str),
        "Unknown Artist",
    );
    let album = safe_component(
        track.get("album").and_then(JsonValue::as_str),
        "Unknown Album",
    );
    let title = safe_component(track.get("title").and_then(JsonValue::as_str), "Track");
    let number = track
        .get("track_number")
        .and_then(JsonValue::as_i64)
        .unwrap_or(0);
    let prefix = if number > 0 {
        format!("{number:02} - ")
    } else {
        String::new()
    };
    Ok(PathBuf::from(output_folder)
        .join(album_artist)
        .join(album)
        .join(format!(
            "{prefix}{title}{}",
            output_extension(&output_format)
        )))
}

fn write_wav_header(writer: &mut impl Write, data_size: u32) -> Result<(), String> {
    let channels = 2u16;
    let sample_rate = 44_100u32;
    let bits_per_sample = 16u16;
    let block_align = channels * bits_per_sample / 8;
    let byte_rate = sample_rate * block_align as u32;
    writer
        .write_all(b"RIFF")
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&(36u32.saturating_add(data_size)).to_le_bytes())
        .map_err(|error| error.to_string())?;
    writer
        .write_all(b"WAVEfmt ")
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&16u32.to_le_bytes())
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&1u16.to_le_bytes())
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&channels.to_le_bytes())
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&sample_rate.to_le_bytes())
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&byte_rate.to_le_bytes())
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&block_align.to_le_bytes())
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&bits_per_sample.to_le_bytes())
        .map_err(|error| error.to_string())?;
    writer
        .write_all(b"data")
        .map_err(|error| error.to_string())?;
    writer
        .write_all(&data_size.to_le_bytes())
        .map_err(|error| error.to_string())
}

fn rip_track_to_wav(drive_id: &str, track_number: i64, wav_path: &Path) -> Result<String, String> {
    #[cfg(windows)]
    {
        let handle = open_cd_handle(drive_id)?;
        let entries = read_toc(handle.0)?;
        let (start_lba, total_sectors) = track_bounds_from_entries(&entries, track_number)?;
        if let Some(parent) = wav_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create rip work folder: {error}"))?;
        }
        let mut file = fs::File::create(wav_path)
            .map_err(|error| format!("Could not create WAV file: {error}"))?;
        write_wav_header(
            &mut file,
            (total_sectors as usize * CDDA_SECTOR_SIZE) as u32,
        )?;
        let mut current = start_lba;
        let mut remaining = total_sectors;
        while remaining > 0 {
            let sectors = RIP_READ_SECTORS.min(remaining);
            let mut data = read_cdda(handle.0, current, sectors)?;
            let expected = sectors as usize * CDDA_SECTOR_SIZE;
            data.resize(expected, 0);
            file.write_all(&data)
                .map_err(|error| format!("Could not write WAV data: {error}"))?;
            current += sectors;
            remaining -= sectors;
        }
        Ok(format!(
            "Read track {track_number:02} with Windows CDDA ({total_sectors} sectors)."
        ))
    }
    #[cfg(not(windows))]
    {
        let _ = (drive_id, track_number, wav_path);
        Err("Windows CDDA ripping is only available on Windows.".to_string())
    }
}

fn metadata_args(track: &JsonValue) -> Vec<String> {
    let fields = [
        (
            "title",
            track
                .get("title")
                .and_then(JsonValue::as_str)
                .map(str::to_string),
        ),
        (
            "artist",
            track
                .get("artist")
                .and_then(JsonValue::as_str)
                .map(str::to_string),
        ),
        (
            "album",
            track
                .get("album")
                .and_then(JsonValue::as_str)
                .map(str::to_string),
        ),
        (
            "album_artist",
            track
                .get("album_artist")
                .and_then(JsonValue::as_str)
                .map(str::to_string),
        ),
        (
            "genre",
            track
                .get("genre")
                .and_then(JsonValue::as_str)
                .map(str::to_string),
        ),
        (
            "date",
            track
                .get("year")
                .and_then(JsonValue::as_i64)
                .map(|value| value.to_string()),
        ),
        (
            "track",
            track
                .get("track_number")
                .and_then(JsonValue::as_i64)
                .map(|value| value.to_string()),
        ),
        (
            "disc",
            track
                .get("disc_number")
                .and_then(JsonValue::as_i64)
                .map(|value| value.to_string()),
        ),
    ];
    let mut args = Vec::new();
    for (key, value) in fields {
        if let Some(value) = value.filter(|value| !value.trim().is_empty()) {
            args.push("-metadata".to_string());
            args.push(format!("{key}={value}"));
        }
    }
    args
}

fn audio_codec_args(output_format: &str, bitrate_kbps: Option<i64>) -> Vec<String> {
    match output_format {
        "mp3" => vec![
            "-c:a".to_string(),
            "libmp3lame".to_string(),
            "-b:a".to_string(),
            format!("{}k", bitrate_kbps.unwrap_or(320)),
        ],
        "wav" => vec!["-c:a".to_string(), "pcm_s16le".to_string()],
        _ => vec!["-c:a".to_string(), "flac".to_string()],
    }
}

fn run_command(mut command: Command) -> Result<String, String> {
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command
        .output()
        .map_err(|error| format!("Could not start command: {error}"))?;
    let text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    );
    if output.status.success() {
        Ok(text
            .lines()
            .rev()
            .take(20)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n"))
    } else {
        Err(text
            .lines()
            .rev()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .unwrap_or("Command failed")
            .to_string())
    }
}

fn encode_track(
    ffmpeg_path: &Path,
    wav_path: &Path,
    target: &Path,
    body: &JsonValue,
    track: &JsonValue,
) -> Result<(), String> {
    let output_format = json_string(body, "output_format")
        .or_else(|| json_string(body, "outputFormat"))
        .unwrap_or_else(|| "flac".to_string());
    let overwrite = json_bool(body, "overwrite").unwrap_or(false);
    let bitrate = json_i64(body, "bitrate_kbps").or_else(|| json_i64(body, "bitrateKbps"));
    let mut command = Command::new(ffmpeg_path);
    command
        .arg("-hide_banner")
        .arg(if overwrite { "-y" } else { "-n" })
        .arg("-i")
        .arg(wav_path)
        .arg("-vn");
    command.args(metadata_args(track));
    command.args(audio_codec_args(&output_format, bitrate));
    command.arg(target);
    run_command(command).map(|_| ())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file =
        fs::File::open(path).map_err(|error| format!("Could not verify ripped file: {error}"))?;
    let mut digest = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not verify ripped file: {error}"))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

