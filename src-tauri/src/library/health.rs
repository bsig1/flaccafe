use super::*;

#[tauri::command]
pub fn library_health(
    _state: State<'_, DesktopLibraryState>,
    limit: Option<usize>,
) -> Result<DesktopLibraryHealthResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(300).clamp(1, 2000);
    let all_tracks = select_tracks_by_ids_or_limit(&connection, None, 100_000)?;
    let mut missing_files = Vec::new();
    for track in &all_tracks {
        if !Path::new(&track.path).exists() {
            missing_files.push(track.clone());
            if missing_files.len() >= limit {
                break;
            }
        }
    }

    let missing_metadata_query = format!(
        "SELECT {TRACK_COLUMNS} FROM tracks WHERE {music_filter} AND (title IS NULL OR trim(title) = '' OR artist IS NULL OR trim(artist) = '' OR album IS NULL OR trim(album) = '' OR ((genre IS NULL OR trim(genre) = '') AND (analysis_genre IS NULL OR trim(analysis_genre) = ''))) ORDER BY date_added DESC LIMIT ?",
        music_filter = music_only_clause()
    );
    let missing_metadata_total: i64 = connection
        .query_row(
            &format!(
                "SELECT count(*) FROM tracks WHERE {music_filter} AND (title IS NULL OR trim(title) = '' OR artist IS NULL OR trim(artist) = '' OR album IS NULL OR trim(album) = '' OR ((genre IS NULL OR trim(genre) = '') AND (analysis_genre IS NULL OR trim(analysis_genre) = '')))",
                music_filter = music_only_clause()
            ),
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let mut statement = connection
        .prepare(&missing_metadata_query)
        .map_err(|error| format!("Could not prepare Rust missing metadata query: {error}"))?;
    let missing_metadata = statement
        .query_map(params![limit as i64], track_from_row)
        .map_err(|error| format!("Could not read Rust missing metadata: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust missing metadata: {error}"))?;

    let unrated_query = format!(
        "SELECT {TRACK_COLUMNS} FROM tracks WHERE {music_filter} AND rating IS NULL ORDER BY date_added DESC LIMIT ?",
        music_filter = music_only_clause()
    );
    let mut unrated_statement = connection
        .prepare(&unrated_query)
        .map_err(|error| format!("Could not prepare Rust unrated query: {error}"))?;
    let unrated_tracks = unrated_statement
        .query_map(params![limit as i64], track_from_row)
        .map_err(|error| format!("Could not read Rust unrated tracks: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust unrated tracks: {error}"))?;

    let mut groups: HashMap<String, Vec<DesktopTrack>> = HashMap::new();
    for track in all_tracks {
        let title = normalize_token(track.title.as_deref());
        let artist = normalize_token(track.artist.as_deref());
        if title.is_empty() || artist.is_empty() {
            continue;
        }
        groups
            .entry(format!("{artist} - {title}"))
            .or_default()
            .push(track);
    }
    let duplicate_group_total = groups.values().filter(|tracks| tracks.len() > 1).count() as i64;
    let mut duplicate_groups = Vec::new();
    for (key, mut tracks) in groups.into_iter().filter(|(_, tracks)| tracks.len() > 1) {
        tracks.sort_by(|left, right| {
            right
                .bitrate
                .unwrap_or(0)
                .cmp(&left.bitrate.unwrap_or(0))
                .then_with(|| {
                    right
                        .rating
                        .unwrap_or(0.0)
                        .total_cmp(&left.rating.unwrap_or(0.0))
                })
        });
        let recommended_keep_id = tracks.first().map(|track| track.id);
        let durations: Vec<f64> = tracks
            .iter()
            .filter_map(|track| track.duration_seconds)
            .collect();
        let duration_spread_seconds = if durations.len() >= 2 {
            Some(
                durations.iter().copied().fold(f64::NEG_INFINITY, f64::max)
                    - durations.iter().copied().fold(f64::INFINITY, f64::min),
            )
        } else {
            None
        };
        let bitrates: Vec<i64> = tracks.iter().filter_map(|track| track.bitrate).collect();
        let bitrate_spread = if bitrates.len() >= 2 {
            Some(bitrates.iter().max().unwrap_or(&0) - bitrates.iter().min().unwrap_or(&0))
        } else {
            None
        };
        let fingerprints: HashSet<String> = tracks
            .iter()
            .filter_map(|track| track.audio_fingerprint.clone())
            .filter(|value| !value.trim().is_empty())
            .collect();
        let acoustic_fingerprints: HashSet<String> = tracks
            .iter()
            .filter_map(|track| track.acoustic_fingerprint.clone())
            .filter(|value| !value.trim().is_empty())
            .collect();
        let path_roots: HashSet<String> = tracks
            .iter()
            .map(|track| file_path_root(&track.path))
            .collect();
        let analyzed_tracks = tracks
            .iter()
            .filter(|track| {
                track
                    .analysis_embedding
                    .as_deref()
                    .is_some_and(|value| !value.is_empty())
            })
            .count() as i64;
        duplicate_groups.push(DesktopDuplicateGroup {
            ignore_key: format!("duplicate:{key}"),
            key,
            tracks,
            match_reason: "same normalized artist and title".to_string(),
            recommended_keep_id,
            recommendation_reason: Some("highest bitrate/rating".to_string()),
            duration_spread_seconds,
            bitrate_spread,
            shared_fingerprint: fingerprints.len() == 1 && !fingerprints.is_empty(),
            shared_acoustic_fingerprint: acoustic_fingerprints.len() == 1
                && !acoustic_fingerprints.is_empty(),
            average_audio_similarity: None,
            path_roots: path_roots.into_iter().collect(),
            analyzed_tracks,
        });
        if duplicate_groups.len() >= limit {
            break;
        }
    }

    let ignored_duplicate_group_total = connection
        .query_row(
            "SELECT count(*) FROM library_health_ignores WHERE kind = 'duplicate'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);
    Ok(DesktopLibraryHealthResponse {
        missing_files,
        missing_metadata,
        duplicate_groups,
        unrated_tracks,
        missing_metadata_total,
        duplicate_group_total,
        ignored_duplicate_group_total,
    })
}

fn duplicate_group_from_tracks(
    key: String,
    mut tracks: Vec<DesktopTrack>,
) -> DesktopDuplicateGroup {
    tracks.sort_by(|left, right| {
        right
            .bitrate
            .unwrap_or(0)
            .cmp(&left.bitrate.unwrap_or(0))
            .then_with(|| {
                right
                    .rating
                    .unwrap_or(0.0)
                    .total_cmp(&left.rating.unwrap_or(0.0))
            })
    });
    let recommended_keep_id = tracks.first().map(|track| track.id);
    let durations: Vec<f64> = tracks
        .iter()
        .filter_map(|track| track.duration_seconds)
        .collect();
    let duration_spread_seconds = if durations.len() >= 2 {
        Some(
            durations.iter().copied().fold(f64::NEG_INFINITY, f64::max)
                - durations.iter().copied().fold(f64::INFINITY, f64::min),
        )
    } else {
        None
    };
    let bitrates: Vec<i64> = tracks.iter().filter_map(|track| track.bitrate).collect();
    let bitrate_spread = if bitrates.len() >= 2 {
        Some(bitrates.iter().max().unwrap_or(&0) - bitrates.iter().min().unwrap_or(&0))
    } else {
        None
    };
    let fingerprints: HashSet<String> = tracks
        .iter()
        .filter_map(|track| track.audio_fingerprint.clone())
        .filter(|value| !value.trim().is_empty())
        .collect();
    let acoustic_fingerprints: HashSet<String> = tracks
        .iter()
        .filter_map(|track| track.acoustic_fingerprint.clone())
        .filter(|value| !value.trim().is_empty())
        .collect();
    let path_roots: HashSet<String> = tracks
        .iter()
        .map(|track| file_path_root(&track.path))
        .collect();
    let analyzed_tracks = tracks
        .iter()
        .filter(|track| {
            track
                .analysis_embedding
                .as_deref()
                .is_some_and(|value| !value.is_empty())
        })
        .count() as i64;
    let mut similarity_total = 0.0f64;
    let mut similarity_pairs = 0i64;
    for left_index in 0..tracks.len() {
        for right_index in (left_index + 1)..tracks.len() {
            if let Some(score) = cosine_similarity(
                tracks[left_index].analysis_embedding.as_deref(),
                tracks[right_index].analysis_embedding.as_deref(),
            ) {
                similarity_total += score;
                similarity_pairs += 1;
            }
        }
    }
    let average_audio_similarity = if similarity_pairs > 0 {
        Some((similarity_total / similarity_pairs as f64 * 10_000.0).round() / 10_000.0)
    } else {
        None
    };
    DesktopDuplicateGroup {
        ignore_key: format!("duplicate:{key}"),
        key,
        tracks,
        match_reason: "same normalized artist and title".to_string(),
        recommended_keep_id,
        recommendation_reason: Some("highest bitrate/rating".to_string()),
        duration_spread_seconds,
        bitrate_spread,
        shared_fingerprint: fingerprints.len() == 1 && !fingerprints.is_empty(),
        shared_acoustic_fingerprint: acoustic_fingerprints.len() == 1
            && !acoustic_fingerprints.is_empty(),
        average_audio_similarity,
        path_roots: path_roots.into_iter().collect(),
        analyzed_tracks,
    }
}

pub(super) fn tracks_by_id_map(
    connection: &Connection,
    ids: &[i64],
) -> Result<(HashMap<i64, DesktopTrack>, Vec<i64>), String> {
    if ids.is_empty() {
        return Ok((HashMap::new(), Vec::new()));
    }
    let placeholders = vec!["?"; ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare Rust duplicate review track query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(ids.iter()), track_from_row)
        .map_err(|error| format!("Could not read Rust duplicate review tracks: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust duplicate review tracks: {error}"))?;
    let map: HashMap<i64, DesktopTrack> =
        tracks.into_iter().map(|track| (track.id, track)).collect();
    let missing = ids
        .iter()
        .copied()
        .filter(|id| !map.contains_key(id))
        .collect();
    Ok((map, missing))
}

#[tauri::command]
pub fn duplicate_review(
    _state: State<'_, DesktopLibraryState>,
    track_ids: Option<Vec<i64>>,
    groups: Option<Vec<Vec<i64>>>,
    limit: Option<usize>,
) -> Result<DesktopDuplicateReviewResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(300).clamp(1, 2_000);
    let requested_groups = groups.unwrap_or_default();
    let mut requested_ids: Vec<i64> = track_ids.unwrap_or_default();
    for group in &requested_groups {
        requested_ids.extend(group.iter().copied());
    }
    requested_ids.retain(|id| *id > 0);
    requested_ids.sort_unstable();
    requested_ids.dedup();

    let (track_map, missing_track_ids) = tracks_by_id_map(&connection, &requested_ids)?;
    let mut tracks: Vec<DesktopTrack> = track_map.values().cloned().collect();
    tracks.sort_by(|left, right| left.id.cmp(&right.id));

    let mut duplicate_groups = Vec::new();
    if !requested_groups.is_empty() {
        for group in requested_groups {
            let group_tracks: Vec<DesktopTrack> = group
                .into_iter()
                .filter_map(|id| track_map.get(&id).cloned())
                .collect();
            if group_tracks.len() >= 2 {
                let key = group_tracks
                    .first()
                    .and_then(|track| {
                        Some(format!(
                            "{} - {}",
                            track.artist.as_deref().unwrap_or("Unknown Artist"),
                            track.title.as_deref().unwrap_or("Untitled")
                        ))
                    })
                    .unwrap_or_else(|| "Selected duplicate group".to_string());
                duplicate_groups.push(duplicate_group_from_tracks(key, group_tracks));
            }
        }
    } else {
        let source_tracks = if tracks.is_empty() {
            let mut statement = connection
                .prepare(&format!(
                    "SELECT {TRACK_COLUMNS} FROM tracks WHERE {music_filter} ORDER BY lower(coalesce(artist, '')), lower(coalesce(title, '')) LIMIT ?",
                    music_filter = music_only_clause()
                ))
                .map_err(|error| format!("Could not prepare Rust duplicate candidate query: {error}"))?;
            let rows = statement
                .query_map(params![limit as i64], track_from_row)
                .map_err(|error| format!("Could not read Rust duplicate candidates: {error}"))?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|error| format!("Could not decode Rust duplicate candidates: {error}"))?;
            rows
        } else {
            tracks.clone()
        };
        let mut grouped: HashMap<String, Vec<DesktopTrack>> = HashMap::new();
        for track in source_tracks {
            let title = normalize_token(track.title.as_deref());
            let artist = normalize_token(track.artist.as_deref());
            if title.is_empty() || artist.is_empty() {
                continue;
            }
            grouped
                .entry(format!("{artist} - {title}"))
                .or_default()
                .push(track);
        }
        for (key, group_tracks) in grouped.into_iter().filter(|(_, tracks)| tracks.len() >= 2) {
            duplicate_groups.push(duplicate_group_from_tracks(key, group_tracks));
            if duplicate_groups.len() >= limit {
                break;
            }
        }
    }

    Ok(DesktopDuplicateReviewResponse {
        tracks,
        groups: duplicate_groups,
        missing_track_ids,
    })
}

fn duplicate_action_batch_id(prefix: &str) -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("{prefix}-{stamp}")
}

fn resolve_json_tool_output_path(path: Option<String>, default_name: String) -> PathBuf {
    let trimmed = path.as_deref().map(str::trim).unwrap_or_default();
    let mut target = if trimmed.is_empty() {
        app_storage_root().join("exports").join(default_name)
    } else {
        let candidate = PathBuf::from(trimmed);
        if candidate.is_absolute() {
            candidate
        } else {
            app_storage_root().join("exports").join(candidate)
        }
    };
    if target
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| !extension.eq_ignore_ascii_case("json"))
        .unwrap_or(true)
    {
        target.set_extension("json");
    }
    target
}

fn remove_duplicate_tracks_from_library(
    connection: &Connection,
    track_ids: Vec<i64>,
    batch_id: &str,
    delete_files: bool,
) -> Result<(Vec<i64>, Vec<String>, i64), String> {
    let mut unique_ids = Vec::new();
    for track_id in track_ids.into_iter().filter(|track_id| *track_id > 0) {
        if !unique_ids.contains(&track_id) {
            unique_ids.push(track_id);
        }
    }
    if unique_ids.is_empty() {
        return Ok((Vec::new(), Vec::new(), 0));
    }
    const REMOVE_COLUMNS: &[&str] = &[
        "path_key",
        "id",
        "path",
        "title",
        "artist",
        "album",
        "album_artist",
        "track_number",
        "disc_number",
        "genre",
        "analysis_provider",
        "analysis_model",
        "analysis_genre",
        "analysis_genre_confidence",
        "analysis_genre_tags",
        "analysis_embedding",
        "analysis_updated_at",
        "year",
        "duration_seconds",
        "bitrate",
        "replaygain_track_gain_db",
        "replaygain_album_gain_db",
        "replaygain_track_peak",
        "replaygain_album_peak",
        "audio_fingerprint",
        "acoustic_fingerprint",
        "acoustic_fingerprint_updated_at",
        "rating",
        "play_count",
        "skip_count",
        "last_played_at",
        "last_skipped_at",
        "date_added",
        "file_modified_at",
    ];
    let placeholders = vec!["?"; unique_ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT path_key, {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare duplicate removal query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(unique_ids.iter()), |row| {
            row_to_json_object(row, REMOVE_COLUMNS)
        })
        .map_err(|error| format!("Could not read duplicate removal tracks: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode duplicate removal tracks: {error}"))?;
    let by_id = rows
        .into_iter()
        .filter_map(|track| {
            track
                .get("id")
                .and_then(serde_json::Value::as_i64)
                .map(|id| (id, track))
        })
        .collect::<HashMap<_, _>>();
    let mut removed = Vec::new();
    let mut errors = Vec::new();
    let mut deleted_files = 0i64;
    for track_id in unique_ids {
        let Some(track) = by_id.get(&track_id) else {
            errors.push(format!("Track {track_id} was not found"));
            continue;
        };
        if delete_files {
            if let Some(path) = track.get("path").and_then(serde_json::Value::as_str) {
                let path = PathBuf::from(path);
                if path.exists() && path.is_file() {
                    match trash::delete(&path) {
                        Ok(()) => deleted_files += 1,
                        Err(error) => {
                            errors.push(format!(
                                "Could not send {} to the recycle bin: {error}",
                                path.display()
                            ));
                            continue;
                        }
                    }
                }
            }
        }
        let summary = track
            .get("title")
            .and_then(serde_json::Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .or_else(|| track.get("path").and_then(serde_json::Value::as_str))
            .unwrap_or("track");
        let payload = json!({"track": track, "delete_file": delete_files});
        connection
            .execute(
                "INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
                 VALUES(?, 'track_remove', ?, ?)",
                params![batch_id, format!("Removed {summary}"), payload.to_string()],
            )
            .map_err(|error| format!("Could not write duplicate removal undo log: {error}"))?;
        if let Some(path_key) = track.get("path_key").and_then(serde_json::Value::as_str) {
            let _ = connection.execute(
                "DELETE FROM track_metadata_cache WHERE path_key = ?",
                params![path_key],
            );
            let _ = connection.execute(
                "DELETE FROM artwork_cache WHERE path_key = ?",
                params![path_key],
            );
        }
        connection
            .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
            .map_err(|error| format!("Could not remove duplicate track {track_id}: {error}"))?;
        removed.push(track_id);
    }
    if !removed.is_empty() {
        scan::cleanup_orphan_albums(connection)?;
        clear_library_query_cache(connection);
    }
    Ok((removed, errors, deleted_files))
}

pub fn duplicate_action(
    state: State<'_, DesktopLibraryState>,
    action: String,
    track_ids: Option<Vec<i64>>,
    groups: Option<Vec<Vec<i64>>>,
    report_path: Option<String>,
    ignore_key: Option<String>,
    ignore_label: Option<String>,
    delete_files: Option<bool>,
) -> Result<DesktopDuplicateActionResponse, String> {
    let action = action.trim().to_string();
    let track_ids = track_ids.unwrap_or_default();
    let groups = groups.unwrap_or_default();
    match action.as_str() {
        "clear_ignored" => {
            let connection = open_database()?;
            let affected = connection
                .execute(
                    "DELETE FROM library_health_ignores WHERE kind = 'duplicate'",
                    [],
                )
                .map_err(|error| format!("Could not clear duplicate ignores: {error}"))?
                as i64;
            Ok(DesktopDuplicateActionResponse {
                action,
                affected,
                removed_track_ids: Vec::new(),
                deleted_files: 0,
                report_path: None,
                errors: Vec::new(),
            })
        }
        "ignore" => {
            let connection = open_database()?;
            let mut errors = Vec::new();
            let mut ignore_key = ignore_key
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
            if ignore_key.is_none() && !track_ids.is_empty() {
                let (track_map, missing) = tracks_by_id_map(&connection, &track_ids)?;
                errors.extend(
                    missing
                        .into_iter()
                        .map(|track_id| format!("Track {track_id} was not found")),
                );
                let tracks = track_map.into_values().collect::<Vec<_>>();
                if tracks.len() >= 2 {
                    let label = ignore_label
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .unwrap_or("Ignored duplicate group");
                    ignore_key =
                        Some(duplicate_group_from_tracks(label.to_string(), tracks).ignore_key);
                }
            }
            let Some(ignore_key) = ignore_key else {
                return Err("Choose a duplicate group to ignore".to_string());
            };
            let label = ignore_label
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("Ignored duplicate group");
            connection
                .execute(
                    "INSERT INTO library_health_ignores(kind, ignore_key, label)
                     VALUES('duplicate', ?, ?)
                     ON CONFLICT(kind, ignore_key) DO UPDATE SET
                       label = excluded.label,
                       created_at = datetime('now')",
                    params![ignore_key, label],
                )
                .map_err(|error| format!("Could not ignore duplicate group: {error}"))?;
            Ok(DesktopDuplicateActionResponse {
                action,
                affected: 1,
                removed_track_ids: Vec::new(),
                deleted_files: 0,
                report_path: None,
                errors,
            })
        }
        "export_report" => {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_secs())
                .unwrap_or(0);
            let target = resolve_json_tool_output_path(
                report_path,
                format!("flac-cafe-duplicates-{stamp}.json"),
            );
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Could not create duplicate report folder {}: {error}",
                        parent.display()
                    )
                })?;
            }
            let selected = track_ids.into_iter().collect::<HashSet<_>>();
            let mut review = duplicate_review(state, None, None, Some(500))?;
            if !selected.is_empty() {
                review.groups.retain(|group| {
                    group
                        .tracks
                        .iter()
                        .any(|track| selected.contains(&track.id))
                });
            }
            let payload = json!({
                "generated_at": scan::utc_now(),
                "groups": review.groups,
            });
            let text = serde_json::to_string_pretty(&payload)
                .map_err(|error| format!("Could not encode duplicate report: {error}"))?;
            std::fs::write(&target, text)
                .map_err(|error| format!("Could not write duplicate report: {error}"))?;
            Ok(DesktopDuplicateActionResponse {
                action,
                affected: payload
                    .get("groups")
                    .and_then(serde_json::Value::as_array)
                    .map(|groups| groups.len() as i64)
                    .unwrap_or(0),
                removed_track_ids: Vec::new(),
                deleted_files: 0,
                report_path: Some(target.to_string_lossy().to_string()),
                errors: Vec::new(),
            })
        }
        "keep_best" | "remove_selected" => {
            let mut connection = open_database()?;
            let transaction = connection
                .transaction()
                .map_err(|error| format!("Could not start duplicate action: {error}"))?;
            let ids_to_remove = if action == "keep_best" {
                let candidate_groups = if groups.is_empty() && !track_ids.is_empty() {
                    vec![track_ids.clone()]
                } else {
                    groups.clone()
                };
                let mut remove_ids = Vec::new();
                for group in candidate_groups {
                    let unique = group
                        .into_iter()
                        .filter(|track_id| *track_id > 0)
                        .collect::<HashSet<_>>()
                        .into_iter()
                        .collect::<Vec<_>>();
                    if unique.len() < 2 {
                        continue;
                    }
                    let (track_map, _) = tracks_by_id_map(&transaction, &unique)?;
                    let group_tracks = track_map.into_values().collect::<Vec<_>>();
                    let keep_id = duplicate_group_from_tracks(
                        "Selected duplicate group".to_string(),
                        group_tracks.clone(),
                    )
                    .recommended_keep_id;
                    remove_ids.extend(
                        group_tracks
                            .into_iter()
                            .filter(|track| Some(track.id) != keep_id)
                            .map(|track| track.id),
                    );
                }
                remove_ids
            } else {
                track_ids.clone()
            };
            let batch_id = duplicate_action_batch_id(if action == "keep_best" {
                "duplicate-keep"
            } else {
                "duplicate-remove"
            });
            let (removed_track_ids, errors, deleted_files) = remove_duplicate_tracks_from_library(
                &transaction,
                ids_to_remove,
                &batch_id,
                delete_files.unwrap_or(false),
            )?;
            transaction
                .commit()
                .map_err(|error| format!("Could not commit duplicate action: {error}"))?;
            Ok(DesktopDuplicateActionResponse {
                action,
                affected: removed_track_ids.len() as i64,
                removed_track_ids,
                deleted_files,
                report_path: None,
                errors,
            })
        }
        _ => Err("Unsupported duplicate action".to_string()),
    }
}
