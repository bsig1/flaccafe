use super::*;

const REPLAYGAIN_REFERENCE_INTEGRATED: f64 = -18.0;

#[derive(Clone, Copy)]
struct LoudnessScan {
    integrated: f64,
    peak: Option<f64>,
}

fn volume_value_changed(current: Option<f64>, proposed: Option<f64>, tolerance: f64) -> bool {
    match proposed {
        None => false,
        Some(proposed) if !proposed.is_finite() => false,
        Some(proposed) => current
            .map(|current| (current - proposed).abs() > tolerance)
            .unwrap_or(true),
    }
}

fn volume_changed(preview: &DesktopVolumeTagPreview) -> bool {
    volume_value_changed(
        preview.current_track_gain_db,
        preview.proposed_track_gain_db,
        0.05,
    ) || volume_value_changed(
        preview.current_track_peak,
        preview.proposed_track_peak,
        0.0005,
    ) || volume_value_changed(
        preview.current_album_gain_db,
        preview.proposed_album_gain_db,
        0.05,
    ) || volume_value_changed(
        preview.current_album_peak,
        preview.proposed_album_peak,
        0.0005,
    )
}

fn parse_ffmpeg_ebur128(output: &str) -> Result<LoudnessScan, String> {
    let loudness_re = regex::Regex::new(r"(?i)\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS")
        .map_err(|error| format!("Could not build loudness parser: {error}"))?;
    let peak_re = regex::Regex::new(r"(?i)\bPeak:\s*(-?\d+(?:\.\d+)?)\s*dB(?:FS|TP)?")
        .map_err(|error| format!("Could not build peak parser: {error}"))?;
    let integrated = loudness_re
        .captures_iter(output)
        .filter_map(|captures| captures.get(1).and_then(|m| m.as_str().parse::<f64>().ok()))
        .last()
        .ok_or_else(|| "FFmpeg did not report integrated loudness".to_string())?;
    let peak = peak_re
        .captures_iter(output)
        .filter_map(|captures| captures.get(1).and_then(|m| m.as_str().parse::<f64>().ok()))
        .last()
        .map(|db| 10f64.powf(db / 20.0));
    Ok(LoudnessScan { integrated, peak })
}

fn scan_loudness(ffmpeg_path: &Path, track: &DesktopTrack) -> Result<LoudnessScan, String> {
    let source = Path::new(&track.path);
    if !source.exists() || !source.is_file() {
        return Err("File is missing on disk".to_string());
    }
    let mut command = Command::new(ffmpeg_path);
    command.args([
        "-hide_banner",
        "-nostdin",
        "-nostats",
        "-i",
        &track.path,
        "-vn",
        "-sn",
        "-dn",
        "-filter:a",
        "ebur128=peak=true",
        "-f",
        "null",
        "-",
    ]);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command
        .output()
        .map_err(|error| format!("Could not start FFmpeg: {error}"))?;
    let text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    );
    if !output.status.success() && !text.contains("Integrated loudness") {
        let detail = text
            .lines()
            .rev()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .unwrap_or("FFmpeg failed");
        return Err(format!("FFmpeg could not scan this file: {detail}"));
    }
    parse_ffmpeg_ebur128(&text)
}

fn track_gain_from_loudness(integrated: f64) -> f64 {
    round_to(REPLAYGAIN_REFERENCE_INTEGRATED - integrated, 2)
}

fn album_loudness(scans: &[(LoudnessScan, Option<f64>)]) -> Option<f64> {
    if scans.is_empty() {
        return None;
    }
    let mut weighted_energy = 0.0;
    let mut total_duration = 0.0;
    for (scan, duration) in scans {
        let weight = duration.unwrap_or(180.0).max(1.0);
        weighted_energy += weight * 10f64.powf(scan.integrated / 10.0);
        total_duration += weight;
    }
    (total_duration > 0.0 && weighted_energy > 0.0)
        .then(|| 10.0 * (weighted_energy / total_duration).log10())
}

fn volume_album_key(track: &DesktopTrack) -> (String, String) {
    (
        track
            .album_artist
            .as_deref()
            .or(track.artist.as_deref())
            .unwrap_or("")
            .trim()
            .to_lowercase(),
        track.album.as_deref().unwrap_or("").trim().to_lowercase(),
    )
}

fn round_to(value: f64, places: i32) -> f64 {
    let factor = 10f64.powi(places);
    (value * factor).round() / factor
}

fn applied_volume_value(
    proposed: Option<f64>,
    current: Option<f64>,
    manual_mode: bool,
) -> Option<f64> {
    if proposed.is_some() || !manual_mode {
        proposed
    } else {
        current
    }
}

#[tauri::command]
pub fn volume_tags_preview(
    _state: State<'_, DesktopLibraryState>,
    track_ids: Option<Vec<i64>>,
    mode: Option<String>,
    write_to_file: Option<bool>,
    manual_track_gain_db: Option<f64>,
    manual_track_peak: Option<f64>,
    manual_album_gain_db: Option<f64>,
    manual_album_peak: Option<f64>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopVolumeTagResponse, String> {
    let connection = open_database()?;
    let mode = mode.unwrap_or_else(|| "manual".to_string());
    let manual_mode = mode.eq_ignore_ascii_case("manual");
    let tracks = select_tracks_by_ids_or_limit(
        &connection,
        track_ids,
        limit
            .unwrap_or(if manual_mode { 200 } else { 50 })
            .clamp(1, 10_000),
    )?;
    let mut previews = Vec::new();
    let apply = apply.unwrap_or(false);
    let should_write_to_file = write_to_file
        .unwrap_or_else(|| truthy_setting(&connection, "write_ratings_to_files", false));
    let mut applied = 0i64;
    let mut errors = Vec::new();
    let mut ffmpeg_path = None;
    let mut checked_paths = Vec::new();

    if manual_mode
        && manual_track_gain_db.is_none()
        && manual_track_peak.is_none()
        && manual_album_gain_db.is_none()
        && manual_album_peak.is_none()
    {
        errors.push("Enter at least one manual gain or peak value.".to_string());
    }

    for track in &tracks {
        previews.push(DesktopVolumeTagPreview {
            track_id: track.id,
            path: track.path.clone(),
            title: track.title.clone(),
            artist: track.artist.clone(),
            album: track.album.clone(),
            current_track_gain_db: track.replaygain_track_gain_db,
            proposed_track_gain_db: None,
            current_track_peak: track.replaygain_track_peak,
            proposed_track_peak: None,
            current_album_gain_db: track.replaygain_album_gain_db,
            proposed_album_gain_db: None,
            current_album_peak: track.replaygain_album_peak,
            proposed_album_peak: None,
            changed: false,
            applied: false,
            error: None,
        });
    }

    if manual_mode {
        for preview in &mut previews {
            preview.proposed_track_gain_db = manual_track_gain_db.map(|value| round_to(value, 2));
            preview.proposed_track_peak = manual_track_peak.map(|value| round_to(value, 6));
            preview.proposed_album_gain_db = manual_album_gain_db.map(|value| round_to(value, 2));
            preview.proposed_album_peak = manual_album_peak.map(|value| round_to(value, 6));
            preview.changed = volume_changed(preview);
        }
    } else {
        let (resolved_ffmpeg, candidates) = tools::resolved_ffmpeg_tool_path()?;
        checked_paths = candidates
            .iter()
            .take(12)
            .map(|path| path.to_string_lossy().to_string())
            .collect();
        let Some(path) = resolved_ffmpeg else {
            return Ok(DesktopVolumeTagResponse {
                total: 0,
                changed: 0,
                applied: 0,
                errors: vec![
                    "FFmpeg is required for volume tag analysis. Install it from File Management > Optional Dependencies."
                        .to_string(),
                ],
                previews: Vec::new(),
                ffmpeg_path: None,
                checked_paths,
            });
        };
        ffmpeg_path = Some(path.to_string_lossy().to_string());
        let mut group_scans: HashMap<(String, String), Vec<(LoudnessScan, Option<f64>)>> =
            HashMap::new();
        let mut scans_by_id: HashMap<i64, LoudnessScan> = HashMap::new();
        for (index, track) in tracks.iter().enumerate() {
            match scan_loudness(&path, track) {
                Ok(scan) => {
                    scans_by_id.insert(track.id, scan);
                    group_scans
                        .entry(volume_album_key(track))
                        .or_default()
                        .push((scan, track.duration_seconds));
                    previews[index].proposed_track_gain_db =
                        Some(track_gain_from_loudness(scan.integrated));
                    previews[index].proposed_track_peak = scan.peak.map(|value| round_to(value, 6));
                }
                Err(error) => {
                    previews[index].error = Some(error.clone());
                    errors.push(format!(
                        "{}: {error}",
                        Path::new(&track.path)
                            .file_name()
                            .and_then(|value| value.to_str())
                            .unwrap_or(&track.path)
                    ));
                }
            }
        }
        let album_values = group_scans
            .iter()
            .map(|(key, scans)| {
                let gain = album_loudness(scans)
                    .map(|loudness| round_to(REPLAYGAIN_REFERENCE_INTEGRATED - loudness, 2));
                let peak = scans
                    .iter()
                    .filter_map(|(scan, _)| scan.peak)
                    .reduce(f64::max)
                    .map(|value| round_to(value, 6));
                (key.clone(), (gain, peak))
            })
            .collect::<HashMap<_, _>>();
        for (index, track) in tracks.iter().enumerate() {
            if !scans_by_id.contains_key(&track.id) {
                continue;
            }
            let (album_gain, album_peak) = album_values
                .get(&volume_album_key(track))
                .copied()
                .unwrap_or((None, None));
            previews[index].proposed_album_gain_db = album_gain;
            previews[index].proposed_album_peak = album_peak;
            previews[index].changed = volume_changed(&previews[index]);
        }
    }

    let track_by_id = tracks
        .iter()
        .map(|track| (track.id, track))
        .collect::<HashMap<_, _>>();
    for preview in &mut previews {
        if apply && preview.changed {
            let Some(track) = track_by_id.get(&preview.track_id) else {
                continue;
            };
            let applied_track_gain = applied_volume_value(
                preview.proposed_track_gain_db,
                preview.current_track_gain_db,
                manual_mode,
            );
            let applied_track_peak = applied_volume_value(
                preview.proposed_track_peak,
                preview.current_track_peak,
                manual_mode,
            );
            let applied_album_gain = applied_volume_value(
                preview.proposed_album_gain_db,
                preview.current_album_gain_db,
                manual_mode,
            );
            let applied_album_peak = applied_volume_value(
                preview.proposed_album_peak,
                preview.current_album_peak,
                manual_mode,
            );
            let mut file_modified_at = None;
            if should_write_to_file {
                let path = Path::new(&track.path);
                match metadata::write_replaygain_tags(
                    path,
                    applied_track_gain,
                    applied_track_peak,
                    applied_album_gain,
                    applied_album_peak,
                ) {
                    Ok(()) => {
                        file_modified_at = metadata::modified_time_iso(path);
                    }
                    Err(error) => {
                        let message = format!("{}: {error}", preview.path);
                        preview.error = Some(message.clone());
                        errors.push(message);
                        continue;
                    }
                }
            }
            match connection.execute(
                r#"
                UPDATE tracks
                SET replaygain_track_gain_db = ?,
                    replaygain_track_peak = ?,
                    replaygain_album_gain_db = ?,
                    replaygain_album_peak = ?,
                    file_modified_at = coalesce(?, file_modified_at),
                    updated_at = datetime('now')
                WHERE id = ?
                "#,
                params![
                    applied_track_gain,
                    applied_track_peak,
                    applied_album_gain,
                    applied_album_peak,
                    file_modified_at,
                    preview.track_id
                ],
            ) {
                Ok(_) => {
                    preview.applied = true;
                    applied += 1;
                    let _ = connection.execute(
                        "DELETE FROM track_metadata_cache WHERE path_key = ?",
                        params![normalized_path_key(&track.path)],
                    );
                }
                Err(error) => {
                    let message = format!("{}: {error}", preview.path);
                    preview.error = Some(message.clone());
                    errors.push(message);
                }
            }
        }
    }
    if applied > 0 {
        clear_library_query_cache(&connection);
    }
    let changed = previews.iter().filter(|preview| preview.changed).count() as i64;
    let has_ffmpeg_path = ffmpeg_path.is_some();
    Ok(DesktopVolumeTagResponse {
        total: previews.len() as i64,
        changed,
        applied,
        errors,
        previews,
        ffmpeg_path,
        checked_paths: if has_ffmpeg_path {
            Vec::new()
        } else {
            checked_paths
        },
    })
}
