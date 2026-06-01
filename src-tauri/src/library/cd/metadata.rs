pub fn cd_setup() -> Result<JsonValue, String> {
    let ffmpeg = tools::ffmpeg_setup_status()?;
    let mut tool_entries = vec![
        json!({
            "name": "windows_cdda",
            "purpose": "Windows CD audio extraction",
            "available": cfg!(windows),
            "path": if cfg!(windows) { Some("Windows DeviceIoControl") } else { None },
            "version": if cfg!(windows) { Some("Windows CD-ROM raw read") } else { None },
            "checked_paths": Vec::<String>::new(),
        }),
        tool_status("cdparanoia", "secure CD audio extraction"),
        tool_status("cdda2wav", "CD audio extraction and CD-Text"),
        tool_status("icedax", "CD audio extraction and CD-Text"),
        tool_status("whipper", "external AccurateRip-capable full-disc ripping"),
        tool_status("accuraterip", "external AccurateRip verifier"),
        tool_status("flac", "optional FLAC encoder"),
        tool_status("lame", "optional MP3 encoder"),
    ];
    let secure_available = cfg!(windows)
        || tool_entries.iter().any(|tool| {
            matches!(
                tool.get("name").and_then(JsonValue::as_str),
                Some("cdparanoia" | "cdda2wav" | "icedax")
            ) && tool
                .get("available")
                .and_then(JsonValue::as_bool)
                .unwrap_or(false)
        });
    let cd_text_available = tool_entries.iter().any(|tool| {
        matches!(
            tool.get("name").and_then(JsonValue::as_str),
            Some("cdda2wav" | "icedax")
        ) && tool
            .get("available")
            .and_then(JsonValue::as_bool)
            .unwrap_or(false)
    });
    let accuraterip_available = tool_entries.iter().any(|tool| {
        matches!(
            tool.get("name").and_then(JsonValue::as_str),
            Some("whipper" | "accuraterip")
        ) && tool
            .get("available")
            .and_then(JsonValue::as_bool)
            .unwrap_or(false)
    });
    let drives = windows_cd_drives();
    let mut warnings = Vec::new();
    if !ffmpeg.available {
        warnings.push(
            "FLAC/MP3 encoding requires FFmpeg configured in Optional Dependencies.".to_string(),
        );
    }
    if !cd_text_available {
        warnings.push("CD-Text reading requires cdda2wav or icedax.".to_string());
    }
    if !cfg!(windows) && !secure_available {
        warnings
            .push("CD extraction requires cdparanoia, cdda2wav, or icedax on this OS.".to_string());
    }
    tool_entries.shrink_to_fit();
    Ok(json!({
        "available": secure_available && ffmpeg.available,
        "tool_directory": cd_tool_dir().to_string_lossy().to_string(),
        "drives": drives,
        "tools": tool_entries,
        "ffmpeg_available": ffmpeg.available,
        "ffmpeg_path": ffmpeg.resolved_path,
        "secure_ripping_available": secure_available,
        "cd_text_available": cd_text_available,
        "accuraterip_available": accuraterip_available,
        "active_rip_drive_ids": active_rip_drive_ids(),
        "message": if secure_available && ffmpeg.available {
            "CD tools are ready."
        } else {
            "CD playback can use Windows CDDA when a disc is inserted; FLAC/MP3 ripping needs FFmpeg."
        },
        "warnings": warnings,
    }))
}

fn msf_to_lba(address: [u8; 4]) -> i64 {
    (address[1] as i64 * 60 * CD_FRAMES_PER_SECOND)
        + (address[2] as i64 * CD_FRAMES_PER_SECOND)
        + address[3] as i64
        - CD_MSF_OFFSET
}

#[cfg(windows)]
struct CdHandle(HANDLE);

#[cfg(windows)]
impl Drop for CdHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

#[cfg(windows)]
fn open_cd_handle(drive_id: &str) -> Result<CdHandle, String> {
    let letter = drive_letter(drive_id).ok_or_else(|| "CD drive is required".to_string())?;
    let device = format!(r"\\.\{}:", letter.to_ascii_uppercase());
    let wide = device.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let handle = unsafe {
        CreateFileW(
            PCWSTR(wide.as_ptr()),
            GENERIC_READ.0,
            FILE_SHARE_MODE(FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0),
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            None,
        )
    }
    .map_err(|error| format!("Could not open CD drive {drive_id}: {error}"))?;
    Ok(CdHandle(handle))
}

#[cfg(not(windows))]
fn open_cd_handle(_drive_id: &str) -> Result<(), String> {
    Err("Windows CDDA access is only available on Windows.".to_string())
}

#[cfg(windows)]
fn read_toc(handle: HANDLE) -> Result<Vec<TocEntry>, String> {
    let mut toc = CDROM_TOC::default();
    let mut returned = 0u32;
    unsafe {
        DeviceIoControl(
            handle,
            IOCTL_CDROM_READ_TOC,
            None,
            0,
            Some((&mut toc as *mut CDROM_TOC).cast()),
            std::mem::size_of::<CDROM_TOC>() as u32,
            Some(&mut returned),
            None,
        )
    }
    .map_err(|error| format!("Could not read CD table of contents: {error}"))?;
    let toc_length = ((toc.Length[0] as usize) << 8) + toc.Length[1] as usize;
    let mut entry_count = toc_length.saturating_sub(2) / std::mem::size_of_val(&toc.TrackData[0]);
    if entry_count == 0 {
        entry_count = (toc.LastTrack.saturating_sub(toc.FirstTrack) as usize).saturating_add(2);
    }
    let mut entries = toc
        .TrackData
        .iter()
        .take(entry_count.min(100))
        .filter_map(|item| {
            let track_number = item.TrackNumber as i64;
            (track_number > 0).then(|| TocEntry {
                track_number,
                start_lba: msf_to_lba(item.Address),
                control: (item._bitfield & 0x0f) as i64,
            })
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.start_lba);
    Ok(entries)
}

#[cfg(not(windows))]
fn read_toc(_handle: ()) -> Result<Vec<TocEntry>, String> {
    Err("Windows CDDA access is only available on Windows.".to_string())
}

fn track_bounds_from_entries(
    entries: &[TocEntry],
    track_number: i64,
) -> Result<(i64, i64), String> {
    let index = entries
        .iter()
        .position(|entry| entry.track_number == track_number)
        .ok_or_else(|| {
            format!("Track {track_number:02} was not found in the CD table of contents.")
        })?;
    let next = entries
        .get(index + 1)
        .ok_or_else(|| format!("Track {track_number:02} has no following lead-out entry."))?;
    let track = &entries[index];
    if track.control & 0x04 != 0 {
        return Err(format!(
            "Track {track_number:02} is a data track, not CD audio."
        ));
    }
    let start_lba = track.start_lba.max(0);
    let total_sectors = next.start_lba.max(start_lba) - start_lba;
    if total_sectors <= 0 {
        return Err(format!(
            "Track {track_number:02} has no readable CDDA sectors."
        ));
    }
    Ok((start_lba, total_sectors))
}

#[cfg(windows)]
fn read_cdda(handle: HANDLE, start_lba: i64, sector_count: i64) -> Result<Vec<u8>, String> {
    let sector_count = sector_count.max(0) as u32;
    let mut info = RAW_READ_INFO {
        DiskOffset: start_lba.max(0) * CD_RAW_READ_OFFSET_SECTOR_SIZE,
        SectorCount: sector_count,
        TrackMode: CDDA,
    };
    let mut buffer = vec![0u8; sector_count as usize * CDDA_SECTOR_SIZE];
    let mut returned = 0u32;
    unsafe {
        DeviceIoControl(
            handle,
            IOCTL_CDROM_RAW_READ,
            Some((&mut info as *mut RAW_READ_INFO).cast()),
            std::mem::size_of::<RAW_READ_INFO>() as u32,
            Some(buffer.as_mut_ptr().cast()),
            buffer.len() as u32,
            Some(&mut returned),
            None,
        )
    }
    .map_err(|error| format!("Could not read CDDA sector {start_lba}: {error}"))?;
    buffer.truncate(returned as usize);
    Ok(buffer)
}

#[cfg(not(windows))]
fn read_cdda(_handle: (), _start_lba: i64, _sector_count: i64) -> Result<Vec<u8>, String> {
    Err("Windows CDDA access is only available on Windows.".to_string())
}

fn disc_id_info(entries: &[TocEntry]) -> Result<DiscIdInfo, String> {
    let mut audio = entries
        .iter()
        .filter(|entry| (1..=99).contains(&entry.track_number) && entry.control & 0x04 == 0)
        .cloned()
        .collect::<Vec<_>>();
    if audio.is_empty() {
        return Err("No audio tracks were found in the CD table of contents.".to_string());
    }
    audio.sort_by_key(|entry| entry.track_number);
    let first_track = audio.first().unwrap().track_number;
    let last_track = audio.last().unwrap().track_number;
    let mut offsets_by_number = HashMap::new();
    for entry in &audio {
        offsets_by_number.insert(entry.track_number, entry.start_lba + CD_MSF_OFFSET);
    }
    let leadout = entries
        .iter()
        .find(|entry| entry.track_number == 0xAA)
        .map(|entry| entry.start_lba + CD_MSF_OFFSET)
        .or_else(|| {
            entries
                .iter()
                .filter(|entry| entry.track_number > last_track)
                .min_by_key(|entry| entry.track_number)
                .map(|entry| entry.start_lba + CD_MSF_OFFSET)
        })
        .ok_or_else(|| "The CD table of contents did not include a lead-out offset.".to_string())?;
    let mut frame_offsets = vec![0i64; 100];
    frame_offsets[0] = leadout;
    for (track_number, offset) in &offsets_by_number {
        if (1..=99).contains(track_number) {
            frame_offsets[*track_number as usize] = *offset;
        }
    }
    let mut sha1 = Sha1::new();
    sha1.update(format!("{first_track:02X}").as_bytes());
    sha1.update(format!("{last_track:02X}").as_bytes());
    for offset in &frame_offsets {
        sha1.update(format!("{offset:08X}").as_bytes());
    }
    let disc_id = base64::engine::general_purpose::STANDARD
        .encode(sha1.finalize())
        .replace('+', ".")
        .replace('/', "_")
        .replace('=', "-");
    let ordered_offsets = audio
        .iter()
        .map(|entry| offsets_by_number[&entry.track_number])
        .collect::<Vec<_>>();
    let toc = std::iter::once(first_track)
        .chain(std::iter::once(last_track))
        .chain(std::iter::once(leadout))
        .chain(ordered_offsets)
        .map(|part| part.to_string())
        .collect::<Vec<_>>()
        .join(" ");
    Ok(DiscIdInfo {
        disc_id,
        toc,
        audio_track_count: audio.len() as i64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disc_id_toc_uses_last_audio_track_number() {
        let entries = vec![
            TocEntry {
                track_number: 2,
                start_lba: 0,
                control: 0,
            },
            TocEntry {
                track_number: 3,
                start_lba: 15_000,
                control: 0,
            },
            TocEntry {
                track_number: 4,
                start_lba: 30_000,
                control: 0,
            },
            TocEntry {
                track_number: 0xAA,
                start_lba: 45_000,
                control: 0,
            },
        ];

        let info = disc_id_info(&entries).expect("disc id info");

        assert!(info.toc.starts_with("2 4 45150 "));
        assert!(!info.toc.starts_with("2 3 "));
        assert_eq!(info.audio_track_count, 3);
    }
}

fn disc_id_for_drive(drive_id: &str) -> Result<DiscIdInfo, String> {
    #[cfg(windows)]
    {
        let handle = open_cd_handle(drive_id)?;
        let entries = read_toc(handle.0)?;
        disc_id_info(&entries)
    }
    #[cfg(not(windows))]
    {
        let _ = drive_id;
        Err("MusicBrainz Disc ID lookup requires Windows CDDA access in this build.".to_string())
    }
}

fn get_json(url: &str, label: &str) -> Result<JsonValue, String> {
    ureq::get(url)
        .set("User-Agent", USER_AGENT)
        .call()
        .map_err(|error| format!("{label} lookup failed: {error}"))?
        .into_json::<JsonValue>()
        .map_err(|error| format!("{label} returned invalid JSON: {error}"))
}

fn artist_credit(value: Option<&JsonValue>) -> Option<String> {
    value
        .and_then(JsonValue::as_array)
        .map(|credits| {
            credits
                .iter()
                .filter_map(|credit| {
                    credit
                        .get("artist")
                        .and_then(|artist| artist.get("name"))
                        .and_then(JsonValue::as_str)
                        .or_else(|| credit.get("name").and_then(JsonValue::as_str))
                })
                .collect::<Vec<_>>()
                .join("; ")
        })
        .filter(|value| !value.trim().is_empty())
}

fn parse_year(value: Option<&str>) -> Option<i64> {
    value?.get(0..4)?.parse::<i64>().ok()
}

fn text_similarity(left: &str, right: Option<&str>) -> f64 {
    let Some(right) = right else {
        return 0.0;
    };
    let left = left.to_lowercase();
    let right = right.to_lowercase();
    if left == right {
        return 1.0;
    }
    if right.contains(&left) || left.contains(&right) {
        return 0.82;
    }
    let left_words = left.split_whitespace().collect::<HashSet<_>>();
    let right_words = right.split_whitespace().collect::<HashSet<_>>();
    if left_words.is_empty() || right_words.is_empty() {
        return 0.0;
    }
    let shared = left_words.intersection(&right_words).count() as f64;
    let total = left_words.union(&right_words).count() as f64;
    shared / total
}

fn release_tracks(release: &JsonValue) -> Vec<JsonValue> {
    let mut tracks = Vec::new();
    for (disc_index, medium) in release
        .get("media")
        .and_then(JsonValue::as_array)
        .into_iter()
        .flatten()
        .enumerate()
    {
        for item in medium
            .get("tracks")
            .and_then(JsonValue::as_array)
            .into_iter()
            .flatten()
        {
            let recording = item.get("recording").unwrap_or(&JsonValue::Null);
            let position = item
                .get("position")
                .or_else(|| item.get("number"))
                .and_then(|value| {
                    value
                        .as_i64()
                        .or_else(|| value.as_str()?.parse::<i64>().ok())
                })
                .unwrap_or(tracks.len() as i64 + 1);
            let title = item
                .get("title")
                .or_else(|| recording.get("title"))
                .and_then(JsonValue::as_str)
                .unwrap_or("Track");
            let duration_seconds = item
                .get("length")
                .or_else(|| recording.get("length"))
                .and_then(JsonValue::as_f64)
                .map(|ms| (ms / 1000.0 * 1000.0).round() / 1000.0);
            tracks.push(json!({
                "track_number": position,
                "disc_number": disc_index as i64 + 1,
                "title": title,
                "artist": artist_credit(item.get("artist-credit").or_else(|| recording.get("artist-credit"))),
                "duration_seconds": duration_seconds,
                "source_label": "MusicBrainz",
            }));
        }
    }
    tracks
}

fn release_candidate(
    release: &JsonValue,
    query_album: Option<&str>,
    query_artist: Option<&str>,
) -> JsonValue {
    let release_id = release.get("id").and_then(JsonValue::as_str).unwrap_or("");
    let title = release.get("title").and_then(JsonValue::as_str);
    let artist = artist_credit(release.get("artist-credit"));
    let tracks = release_tracks(release);
    let mut confidence_parts = Vec::new();
    if let Some(album) = query_album {
        confidence_parts.push(text_similarity(album, title));
    }
    if let Some(query_artist) = query_artist {
        confidence_parts.push(text_similarity(query_artist, artist.as_deref()));
    }
    let confidence = if confidence_parts.is_empty() {
        0.0
    } else {
        confidence_parts.iter().sum::<f64>() / confidence_parts.len() as f64
    };
    let date = release.get("date").and_then(JsonValue::as_str);
    json!({
        "release_id": release_id,
        "title": title,
        "artist": artist,
        "date": date,
        "year": parse_year(date),
        "country": release.get("country").and_then(JsonValue::as_str),
        "track_count": tracks.len(),
        "confidence": (confidence * 1000.0).round() / 1000.0,
        "artwork_thumbnail_url": if release_id.is_empty() { None } else { Some(format!("{COVER_ART_ARCHIVE_ROOT}/release/{release_id}/front-250")) },
        "tracks": tracks,
    })
}

fn lookup_release(release_id: &str) -> Result<Option<JsonValue>, String> {
    let url = format!(
        "{MUSICBRAINZ_ROOT}/release/{}?fmt=json&inc=artist-credits+media+recordings",
        urlencoding::encode(release_id)
    );
    match get_json(&url, "MusicBrainz") {
        Ok(value) => Ok(Some(value)),
        Err(error) if error.contains("404") => Ok(None),
        Err(error) => Err(error),
    }
}

fn search_releases(
    album: &str,
    artist: Option<&str>,
    limit: i64,
) -> Result<Vec<JsonValue>, String> {
    let mut query = format!("release:\"{album}\"");
    if let Some(artist) = artist.map(str::trim).filter(|value| !value.is_empty()) {
        query.push_str(&format!(" AND artist:\"{artist}\""));
    }
    let url = format!(
        "{MUSICBRAINZ_ROOT}/release?fmt=json&limit={}&inc=artist-credits+media+recordings&query={}",
        limit.clamp(1, 10),
        urlencoding::encode(&query)
    );
    let payload = get_json(&url, "MusicBrainz")?;
    Ok(payload
        .get("releases")
        .and_then(JsonValue::as_array)
        .cloned()
        .unwrap_or_default())
}

fn lookup_discid_releases(disc: &DiscIdInfo) -> Result<Vec<JsonValue>, String> {
    let url = format!(
        "{MUSICBRAINZ_ROOT}/discid/{}?fmt=json&toc={}&inc=artist-credits+media+recordings",
        urlencoding::encode(&disc.disc_id),
        urlencoding::encode(&disc.toc)
    );
    let payload = get_json(&url, "MusicBrainz")?;
    Ok(payload
        .get("releases")
        .and_then(JsonValue::as_array)
        .cloned()
        .unwrap_or_default())
}

