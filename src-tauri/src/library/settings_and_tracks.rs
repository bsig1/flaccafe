#[tauri::command]
pub fn health() -> Result<DesktopStatusResponse, String> {
    Ok(DesktopStatusResponse {
        status: "ok".to_string(),
    })
}

#[tauri::command]
pub fn settings(_state: State<'_, DesktopLibraryState>) -> Result<DesktopSettingsResponse, String> {
    let connection = open_database()?;
    let library_paths = read_library_paths(&connection);
    let library_path =
        get_setting(&connection, "library_path").or_else(|| library_paths.first().cloned());
    let acoustid_api_key_configured = get_setting(&connection, "acoustid_api_key")
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty());
    let lastfm_saved_configured = connection
        .query_row(
            "SELECT coalesce(api_key, ''), coalesce(api_secret, '') FROM scrobble_accounts WHERE service = 'lastfm'",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .ok()
        .is_some_and(|(key, secret)| !key.trim().is_empty() && !secret.trim().is_empty());
    let lastfm_env_configured = env::var("FLAC_CAFE_LASTFM_API_KEY")
        .or_else(|_| env::var("LASTFM_API_KEY"))
        .ok()
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
        && env::var("FLAC_CAFE_LASTFM_API_SECRET")
            .or_else(|_| env::var("LASTFM_API_SECRET"))
            .ok()
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty());
    let lastfm_api_credentials_source = match (lastfm_env_configured, lastfm_saved_configured) {
        (true, true) => Some("environment+saved".to_string()),
        (true, false) => Some("environment".to_string()),
        (false, true) => Some("saved".to_string()),
        (false, false) => None,
    };
    Ok(DesktopSettingsResponse {
        library_path,
        library_paths,
        database_path: database_path().to_string_lossy().to_string(),
        suggested_music_path: suggested_music_path(),
        write_ratings_to_files: truthy_setting(&connection, "write_ratings_to_files", false),
        auto_write_fetched_lyrics_sidecars: truthy_setting(
            &connection,
            "auto_write_fetched_lyrics_sidecars",
            true,
        ),
        cd_auto_lookup_metadata: truthy_setting(&connection, "cd_auto_lookup_metadata", true),
        acoustid_api_key_configured,
        lastfm_api_credentials_configured: lastfm_api_credentials_source.is_some(),
        lastfm_api_credentials_source,
        extra: json!({ "clap": { "deferred": true }, "source": "rust-sqlite" }),
    })
}

#[tauri::command]
pub fn update_settings(
    state: State<'_, DesktopLibraryState>,
    write_ratings_to_files: Option<bool>,
    auto_write_fetched_lyrics_sidecars: Option<bool>,
    cd_auto_lookup_metadata: Option<bool>,
    acoustid_api_key: Option<String>,
    clear_acoustid_api_key: Option<bool>,
    lastfm_api_key: Option<String>,
    lastfm_api_secret: Option<String>,
    clear_lastfm_api_credentials: Option<bool>,
) -> Result<DesktopSettingsResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start settings update: {error}"))?;
    if let Some(value) = write_ratings_to_files {
        set_setting(
            &transaction,
            "write_ratings_to_files",
            Some(if value { "1" } else { "0" }),
        )?;
    }
    if let Some(value) = auto_write_fetched_lyrics_sidecars {
        set_setting(
            &transaction,
            "auto_write_fetched_lyrics_sidecars",
            Some(if value { "1" } else { "0" }),
        )?;
    }
    if let Some(value) = cd_auto_lookup_metadata {
        set_setting(
            &transaction,
            "cd_auto_lookup_metadata",
            Some(if value { "1" } else { "0" }),
        )?;
    }
    if clear_acoustid_api_key.unwrap_or(false) {
        set_setting(&transaction, "acoustid_api_key", None)?;
    } else if let Some(value) = acoustid_api_key {
        let cleaned = value.trim().to_string();
        set_setting(
            &transaction,
            "acoustid_api_key",
            if cleaned.is_empty() {
                None
            } else {
                Some(cleaned.as_str())
            },
        )?;
    }
    if clear_lastfm_api_credentials.unwrap_or(false) {
        transaction
            .execute(
                "INSERT INTO scrobble_accounts(service, enabled, api_key, api_secret, updated_at)
                 VALUES('lastfm', 0, NULL, NULL, datetime('now'))
                 ON CONFLICT(service) DO UPDATE SET api_key = NULL, api_secret = NULL, updated_at = excluded.updated_at",
                [],
            )
            .map_err(|error| format!("Could not clear Last.fm credentials: {error}"))?;
    } else if lastfm_api_key.is_some() || lastfm_api_secret.is_some() {
        let existing = transaction
            .query_row(
                "SELECT coalesce(api_key, ''), coalesce(api_secret, '') FROM scrobble_accounts WHERE service = 'lastfm'",
                [],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .unwrap_or_else(|_| ("".to_string(), "".to_string()));
        let key = lastfm_api_key.unwrap_or(existing.0).trim().to_string();
        let secret = lastfm_api_secret.unwrap_or(existing.1).trim().to_string();
        transaction
            .execute(
                "INSERT INTO scrobble_accounts(service, api_key, api_secret, updated_at)
                 VALUES('lastfm', ?, ?, datetime('now'))
                 ON CONFLICT(service) DO UPDATE SET api_key = excluded.api_key, api_secret = excluded.api_secret, updated_at = excluded.updated_at",
                params![
                    if key.is_empty() { None } else { Some(key.as_str()) },
                    if secret.is_empty() { None } else { Some(secret.as_str()) }
                ],
            )
            .map_err(|error| format!("Could not save Last.fm credentials: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save settings: {error}"))?;
    settings(state)
}

#[tauri::command]
pub fn remove_library_source(
    _state: State<'_, DesktopLibraryState>,
    path: String,
) -> Result<DesktopLibrarySourceRemoveResponse, String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("Library source path is required".to_string());
    }

    let source_path = PathBuf::from(trimmed_path);
    let source_key = normalized_path_key(&source_path.to_string_lossy());
    let mut connection = open_database()?;
    let mut library_paths = read_library_paths(&connection);
    // Removing a source is a SQLite/cache cleanup only. Audio files stay on disk
    // unless the user chooses an explicit destructive file operation elsewhere.
    let track_rows = {
        let mut statement = connection
            .prepare("SELECT path, path_key FROM tracks")
            .map_err(|error| format!("Could not prepare library source cleanup: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| format!("Could not read tracks for library source cleanup: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode tracks for library source cleanup: {error}"))?
            .into_iter()
            .filter(|(track_path, _)| path_under_source(track_path, &source_path))
            .collect::<Vec<_>>()
    };

    library_paths.retain(|saved_path| normalized_path_key(saved_path) != source_key);
    let library_paths_json =
        serde_json::to_string(&library_paths).unwrap_or_else(|_| "[]".to_string());

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start library source cleanup: {error}"))?;
    let mut removed_metadata_cache = 0i64;
    let mut removed_artwork_cache = 0i64;
    let mut removed_tracks = 0i64;
    for (track_path, path_key) in &track_rows {
        removed_metadata_cache += transaction
            .execute(
                "DELETE FROM track_metadata_cache WHERE path_key = ?",
                params![path_key],
            )
            .map_err(|error| format!("Could not clear metadata cache for removed source: {error}"))?
            as i64;
        let artwork_cache_key = format!("v2:{path_key}");
        removed_artwork_cache += transaction
            .execute(
                "DELETE FROM artwork_cache WHERE path = ? OR path_key = ? OR path_key = ?",
                params![track_path, path_key, artwork_cache_key],
            )
            .map_err(|error| format!("Could not clear artwork cache for removed source: {error}"))?
            as i64;
        removed_tracks += transaction
            .execute("DELETE FROM tracks WHERE path_key = ?", params![path_key])
            .map_err(|error| format!("Could not remove tracks for library source: {error}"))?
            as i64;
    }
    set_setting(
        &transaction,
        "library_path",
        library_paths.first().map(String::as_str),
    )?;
    set_setting(
        &transaction,
        "library_paths_json",
        Some(library_paths_json.as_str()),
    )?;
    transaction
        .commit()
        .map_err(|error| format!("Could not finish library source cleanup: {error}"))?;

    if removed_tracks > 0 {
        refresh_library_derived_data(&connection)?;
    } else {
        clear_library_query_cache(&connection);
    }

    Ok(DesktopLibrarySourceRemoveResponse {
        path: trimmed_path.to_string(),
        library_paths,
        removed_tracks,
        removed_metadata_cache,
        removed_artwork_cache,
        message: if removed_tracks > 0 {
            format!("Removed {removed_tracks} track(s) from the library source.")
        } else {
            "Removed library source. No tracks were associated with it.".to_string()
        },
    })
}

#[tauri::command]
pub fn track(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
) -> Result<DesktopTrack, String> {
    let connection = open_database()?;
    track_by_id(&connection, track_id)
}

#[tauri::command]
pub fn tracks_batch(
    _state: State<'_, DesktopLibraryState>,
    track_ids: Vec<i64>,
) -> Result<DesktopTrackBatchResponse, String> {
    let connection = open_database()?;
    let unique_ids: Vec<i64> = track_ids
        .into_iter()
        .filter(|track_id| *track_id > 0)
        .collect::<Vec<_>>()
        .into_iter()
        .fold(Vec::new(), |mut ids, id| {
            if !ids.contains(&id) {
                ids.push(id);
            }
            ids
        });
    if unique_ids.is_empty() {
        return Ok(DesktopTrackBatchResponse {
            tracks: Vec::new(),
            missing_ids: Vec::new(),
        });
    }
    let placeholders = vec!["?"; unique_ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare Rust batch track query: {error}"))?;
    let rows = statement
        .query_map(
            params_from_iter(unique_ids.iter().copied().map(Value::Integer)),
            track_from_row,
        )
        .map_err(|error| format!("Could not read Rust batch tracks: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust batch tracks: {error}"))?;
    let mut by_id: HashMap<i64, DesktopTrack> =
        tracks.into_iter().map(|track| (track.id, track)).collect();
    let mut ordered = Vec::new();
    let mut missing_ids = Vec::new();
    for id in unique_ids {
        if let Some(track) = by_id.remove(&id) {
            ordered.push(track);
        } else {
            missing_ids.push(id);
        }
    }
    Ok(DesktopTrackBatchResponse {
        tracks: ordered,
        missing_ids,
    })
}

#[tauri::command]
pub fn similar_tracks(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
    limit: Option<usize>,
) -> Result<Vec<DesktopSimilarTrack>, String> {
    let connection = open_database()?;
    let seed_track = track_by_id(&connection, track_id)?;
    if parse_embedding(seed_track.analysis_embedding.as_deref()).is_none() {
        return Ok(Vec::new());
    }
    let limit = limit.unwrap_or(12).clamp(1, 50);
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS}
             FROM tracks
             WHERE id <> ?
               AND analysis_embedding IS NOT NULL
               AND trim(analysis_embedding) <> ''
               AND {music_filter}",
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare Rust similar-track query: {error}"))?;
    let rows = statement
        .query_map(params![track_id], track_from_row)
        .map_err(|error| format!("Could not read Rust similar tracks: {error}"))?;
    let mut candidates = Vec::new();
    let settings = autodj_settings(json!({ "similarity_weight": 1.0 }));
    for row in rows {
        let track = row.map_err(|error| format!("Could not decode Rust similar track: {error}"))?;
        let (mut score, reason) = similarity_adjustment(&track, Some(&seed_track), &settings);
        let Some(audio_similarity) = cosine_similarity(
            track.analysis_embedding.as_deref(),
            seed_track.analysis_embedding.as_deref(),
        ) else {
            continue;
        };
        if audio_similarity > 0.0 {
            score += audio_similarity;
        }
        if score <= 0.0 {
            continue;
        }
        candidates.push(DesktopSimilarTrack {
            track,
            similarity_score: round4(score),
            similarity_reason: if reason.is_empty() {
                "CLAP audio similarity".to_string()
            } else {
                reason
            },
            audio_similarity: Some(round4(audio_similarity)),
        });
    }
    candidates.sort_by(|left, right| {
        right
            .similarity_score
            .partial_cmp(&left.similarity_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                right
                    .track
                    .rating
                    .partial_cmp(&left.track.rating)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| right.track.bitrate.cmp(&left.track.bitrate))
    });
    candidates.truncate(limit);
    Ok(candidates)
}

#[derive(Clone)]
struct SimilarAlbumCandidate {
    summary: DesktopAlbumSummary,
    vector_sum: Vec<f64>,
    analyzed_tracks: i64,
}

#[derive(Clone)]
struct SimilarArtistCandidate {
    summary: DesktopArtistSummary,
    vector_sum: Vec<f64>,
    analyzed_tracks: i64,
}

fn add_embedding(vector_sum: &mut Vec<f64>, analyzed_tracks: &mut i64, raw: Option<&str>) {
    let Some(vector) = parse_embedding(raw) else {
        return;
    };
    if vector_sum.is_empty() {
        *vector_sum = vector;
        *analyzed_tracks = 1;
        return;
    }
    if vector_sum.len() != vector.len() {
        return;
    }
    for (target, value) in vector_sum.iter_mut().zip(vector) {
        *target += value;
    }
    *analyzed_tracks += 1;
}

fn average_vector(vector_sum: &[f64], analyzed_tracks: i64) -> Option<Vec<f64>> {
    if vector_sum.is_empty() || analyzed_tracks <= 0 {
        return None;
    }
    Some(
        vector_sum
            .iter()
            .map(|value| value / analyzed_tracks as f64)
            .collect(),
    )
}

fn cosine_vector_similarity(left: &[f64], right: &[f64]) -> Option<f64> {
    if left.len() != right.len() || left.is_empty() {
        return None;
    }
    let dot: f64 = left.iter().zip(right).map(|(a, b)| a * b).sum();
    let left_norm = left.iter().map(|value| value * value).sum::<f64>().sqrt();
    let right_norm = right.iter().map(|value| value * value).sum::<f64>().sqrt();
    if left_norm <= 0.0 || right_norm <= 0.0 {
        None
    } else {
        Some(dot / (left_norm * right_norm))
    }
}

fn sample_size_adjusted_similarity(score: f64, analyzed_tracks: i64) -> f64 {
    if score <= 0.0 {
        return score;
    }
    let sample_count = analyzed_tracks.max(0) as f64;
    if sample_count <= 0.0 {
        return 0.0;
    }
    // Single-track artists/albums can look deceptively close because one CLAP
    // embedding has no internal variance. This confidence curve lets them show
    // only when the raw match is very strong while multi-track groups converge
    // quickly toward the real cosine score.
    let confidence = 1.0 - (-sample_count / 3.0).exp();
    score * confidence
}

#[tauri::command]
pub fn similar_albums(
    _state: State<'_, DesktopLibraryState>,
    album_id: i64,
    limit: Option<usize>,
) -> Result<Vec<DesktopSimilarAlbum>, String> {
    let connection = open_database()?;
    ensure_library_derived_data_current(&connection)?;
    let limit = limit.unwrap_or(8).clamp(1, 50);
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT
                album_summaries.id,
                album_summaries.album,
                album_summaries.album_artist,
                album_summaries.year,
                album_summaries.years_csv,
                album_summaries.album_ids_csv,
                album_summaries.edition_count,
                album_summaries.artwork_path,
                album_summaries.artwork_locked,
                album_summaries.track_count,
                album_summaries.expected_track_count,
                album_summaries.missing_track_count,
                album_summaries.duration_seconds,
                album_summaries.average_rating,
                album_summaries.artwork_track_id,
                album_summaries.completion_expected_track_count,
                album_summaries.completion_source,
                album_summaries.completion_release_id,
                album_summaries.completion_release_title,
                album_summaries.completion_checked_at,
                tracks.analysis_embedding
            FROM album_summaries
            JOIN albums
              ON lower(trim(coalesce(albums.album, ''))) = lower(trim(coalesce(album_summaries.album, '')))
             AND lower(trim(coalesce(albums.album_artist, ''))) = lower(trim(coalesce(album_summaries.album_artist, '')))
            JOIN tracks ON tracks.album_id = albums.id
            WHERE tracks.analysis_embedding IS NOT NULL
              AND trim(tracks.analysis_embedding) <> ''
              AND {music_filter}
            "#,
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare Rust similar-album query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                album_summary_from_row(row)?,
                row.get::<_, Option<String>>("analysis_embedding")?,
            ))
        })
        .map_err(|error| format!("Could not read Rust similar albums: {error}"))?;
    let mut groups: BTreeMap<i64, SimilarAlbumCandidate> = BTreeMap::new();
    for row in rows {
        let (summary, embedding) =
            row.map_err(|error| format!("Could not decode Rust similar album: {error}"))?;
        let entry = groups.entry(summary.id).or_insert_with(|| SimilarAlbumCandidate {
            summary,
            vector_sum: Vec::new(),
            analyzed_tracks: 0,
        });
        add_embedding(
            &mut entry.vector_sum,
            &mut entry.analyzed_tracks,
            embedding.as_deref(),
        );
    }

    let Some(seed) = groups.get(&album_id) else {
        return Ok(Vec::new());
    };
    let Some(seed_vector) = average_vector(&seed.vector_sum, seed.analyzed_tracks) else {
        return Ok(Vec::new());
    };
    let mut candidates = Vec::new();
    for (candidate_id, candidate) in groups {
        if candidate_id == album_id {
            continue;
        }
        let Some(candidate_vector) =
            average_vector(&candidate.vector_sum, candidate.analyzed_tracks)
        else {
            continue;
        };
        let Some(score) = cosine_vector_similarity(&candidate_vector, &seed_vector) else {
            continue;
        };
        let adjusted_score = sample_size_adjusted_similarity(score, candidate.analyzed_tracks);
        if adjusted_score <= 0.0 {
            continue;
        }
        candidates.push(DesktopSimilarAlbum {
            album: candidate.summary,
            similarity_score: round4(adjusted_score),
            analyzed_tracks: candidate.analyzed_tracks,
        });
    }
    candidates.sort_by(|left, right| {
        right
            .similarity_score
            .partial_cmp(&left.similarity_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| right.album.average_rating.partial_cmp(&left.album.average_rating).unwrap_or(std::cmp::Ordering::Equal))
            .then_with(|| right.album.track_count.cmp(&left.album.track_count))
    });
    candidates.truncate(limit);
    Ok(candidates)
}

#[tauri::command]
pub fn similar_artists(
    _state: State<'_, DesktopLibraryState>,
    artist_name: String,
    limit: Option<usize>,
) -> Result<Vec<DesktopSimilarArtist>, String> {
    let connection = open_database()?;
    ensure_library_derived_data_current(&connection)?;
    let limit = limit.unwrap_or(8).clamp(1, 50);
    let artist_expr = primary_artist_sql("tracks");
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT
                artist_summaries.name,
                artist_summaries.track_count,
                artist_summaries.album_count,
                artist_summaries.duration_seconds,
                artist_summaries.average_rating,
                artist_summaries.play_count,
                artist_summaries.skip_count,
                artist_summaries.first_year,
                artist_summaries.last_year,
                artist_summaries.artwork_track_id,
                tracks.analysis_embedding
            FROM artist_summaries
            JOIN tracks ON lower({artist_expr}) = lower(artist_summaries.name)
            WHERE tracks.analysis_embedding IS NOT NULL
              AND trim(tracks.analysis_embedding) <> ''
              AND {music_filter}
            "#,
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare Rust similar-artist query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                artist_summary_from_row(row)?,
                row.get::<_, Option<String>>("analysis_embedding")?,
            ))
        })
        .map_err(|error| format!("Could not read Rust similar artists: {error}"))?;
    let mut groups: BTreeMap<String, SimilarArtistCandidate> = BTreeMap::new();
    for row in rows {
        let (summary, embedding) =
            row.map_err(|error| format!("Could not decode Rust similar artist: {error}"))?;
        let key = normalize_token(Some(&summary.name));
        if key.is_empty() {
            continue;
        }
        let entry = groups.entry(key).or_insert_with(|| SimilarArtistCandidate {
            summary,
            vector_sum: Vec::new(),
            analyzed_tracks: 0,
        });
        add_embedding(
            &mut entry.vector_sum,
            &mut entry.analyzed_tracks,
            embedding.as_deref(),
        );
    }

    let seed_key = normalize_token(Some(&artist_name));
    let Some(seed) = groups.get(&seed_key) else {
        return Ok(Vec::new());
    };
    let Some(seed_vector) = average_vector(&seed.vector_sum, seed.analyzed_tracks) else {
        return Ok(Vec::new());
    };
    let mut candidates = Vec::new();
    for (candidate_key, candidate) in groups {
        if candidate_key == seed_key {
            continue;
        }
        let Some(candidate_vector) =
            average_vector(&candidate.vector_sum, candidate.analyzed_tracks)
        else {
            continue;
        };
        let Some(score) = cosine_vector_similarity(&candidate_vector, &seed_vector) else {
            continue;
        };
        let adjusted_score = sample_size_adjusted_similarity(score, candidate.analyzed_tracks);
        if adjusted_score <= 0.0 {
            continue;
        }
        candidates.push(DesktopSimilarArtist {
            artist: candidate.summary,
            similarity_score: round4(adjusted_score),
            analyzed_tracks: candidate.analyzed_tracks,
        });
    }
    candidates.sort_by(|left, right| {
        right
            .similarity_score
            .partial_cmp(&left.similarity_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| right.artist.play_count.cmp(&left.artist.play_count))
            .then_with(|| right.artist.track_count.cmp(&left.artist.track_count))
    });
    candidates.truncate(limit);
    Ok(candidates)
}

fn row_to_json_object(
    row: &rusqlite::Row<'_>,
    columns: &[&str],
) -> rusqlite::Result<serde_json::Value> {
    let mut object = serde_json::Map::new();
    for column in columns {
        let value: Value = row.get(*column)?;
        object.insert((*column).to_string(), sqlite_value_to_json(value));
    }
    Ok(serde_json::Value::Object(object))
}

fn sqlite_value_to_json(value: Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Integer(value) => json!(value),
        Value::Real(value) => json!(value),
        Value::Text(value) => serde_json::Value::String(value),
        Value::Blob(_) => serde_json::Value::String("[blob]".to_string()),
    }
}

#[tauri::command]
pub fn loved_tracks(
    _state: State<'_, DesktopLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<DesktopLovedTrack>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(100).clamp(1, 1000);
    let mut statement = connection
        .prepare(
            "SELECT track_loves.track_id, track_loves.loved, track_loves.source, track_loves.updated_at,
                    tracks.title, tracks.artist, tracks.album
             FROM track_loves
             JOIN tracks ON tracks.id = track_loves.track_id
             WHERE track_loves.loved = 1
             ORDER BY datetime(track_loves.updated_at) DESC
             LIMIT ?",
        )
        .map_err(|error| format!("Could not prepare Rust loved-track query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], |row| {
            Ok(DesktopLovedTrack {
                track_id: row.get("track_id")?,
                loved: row.get::<_, Option<i64>>("loved")?.unwrap_or(0) != 0,
                source: row
                    .get::<_, Option<String>>("source")?
                    .unwrap_or_else(|| "local".to_string()),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
                title: row.get("title")?,
                artist: row.get("artist")?,
                album: row.get("album")?,
            })
        })
        .map_err(|error| format!("Could not read Rust loved tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust loved tracks: {error}"))
}

#[tauri::command]
pub fn update_track_rating(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
    rating: Option<f64>,
) -> Result<DesktopTrack, String> {
    if let Some(value) = rating {
        let is_half_star = ((value * 2.0).round() - (value * 2.0)).abs() < f64::EPSILON;
        if !(0.5..=5.0).contains(&value) || !is_half_star {
            return Err("Rating must be a half-star value from 0.5 to 5.".to_string());
        }
    }
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust rating update: {error}"))?;
    let changed = transaction
        .execute(
            "UPDATE tracks
             SET rating = ?,
                 updated_at = datetime('now')
             WHERE id = ?",
            params![rating, track_id],
        )
        .map_err(|error| format!("Could not update Rust rating: {error}"))?;
    if changed == 0 {
        return Err("Track not found".to_string());
    }
    transaction
        .execute(
            "INSERT INTO play_events(track_id, event_type, metadata_json) VALUES(?, 'rated', ?)",
            params![track_id, json!({ "rating": rating }).to_string()],
        )
        .map_err(|error| format!("Could not record Rust rating event: {error}"))?;
    clear_library_query_cache(&transaction);
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust rating update: {error}"))?;
    track_by_id(&connection, track_id)
}

pub fn update_track_metadata(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
    updates: serde_json::Map<String, serde_json::Value>,
    write_to_file: Option<bool>,
) -> Result<DesktopTrack, String> {
    let clean_updates = updates
        .into_iter()
        .filter(|(field, _)| {
            matches!(
                field.as_str(),
                "title"
                    | "artist"
                    | "album"
                    | "album_artist"
                    | "track_number"
                    | "disc_number"
                    | "genre"
                    | "year"
            )
        })
        .collect::<serde_json::Map<_, _>>();
    let mut connection = open_database()?;
    if clean_updates.is_empty() {
        return track_by_id(&connection, track_id);
    }
    let mut current = track_to_metadata_map(&track_by_id(&connection, track_id)?);
    for (field, value) in clean_updates {
        current.insert(field, value);
    }
    let should_write_to_file = write_to_file
        .unwrap_or_else(|| truthy_setting(&connection, "write_ratings_to_files", false));
    let path = current
        .get("path")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Track path is missing".to_string())?
        .to_string();
    let mut file_modified_at = None;
    if should_write_to_file {
        metadata::write_common_metadata(Path::new(&path), &current)?;
        file_modified_at = metadata::modified_time_iso(Path::new(&path));
    }
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start track metadata update: {error}"))?;
    let album_id = scan::ensure_album(&transaction, &current)?;
    transaction
        .execute(
            "
            UPDATE tracks
            SET title = ?,
                artist = ?,
                album = ?,
                album_artist = ?,
                album_id = ?,
                track_number = ?,
                disc_number = ?,
                genre = ?,
                year = ?,
                file_modified_at = coalesce(?, file_modified_at),
                updated_at = datetime('now')
            WHERE id = ?
            ",
            params![
                json_text(current.get("title")),
                json_text(current.get("artist")),
                json_text(current.get("album")),
                json_text(current.get("album_artist")),
                album_id,
                json_i64(current.get("track_number")),
                json_i64(current.get("disc_number")),
                json_text(current.get("genre")),
                json_i64(current.get("year")),
                file_modified_at,
                track_id,
            ],
        )
        .map_err(|error| format!("Could not update track metadata: {error}"))?;
    transaction
        .execute(
            "DELETE FROM track_metadata_cache WHERE path_key = ?",
            params![normalized_path_key(&path)],
        )
        .map_err(|error| format!("Could not clear metadata cache: {error}"))?;
    scan::cleanup_orphan_albums(&transaction)?;
    clear_library_query_cache(&transaction);
    transaction
        .commit()
        .map_err(|error| format!("Could not save track metadata update: {error}"))?;
    track_by_id(&connection, track_id)
}

fn track_to_metadata_map(track: &DesktopTrack) -> serde_json::Map<String, serde_json::Value> {
    let mut values = serde_json::Map::new();
    values.insert("path".to_string(), json!(track.path));
    values.insert("title".to_string(), json!(track.title.as_deref()));
    values.insert("artist".to_string(), json!(track.artist.as_deref()));
    values.insert("album".to_string(), json!(track.album.as_deref()));
    values.insert(
        "album_artist".to_string(),
        json!(track.album_artist.as_deref()),
    );
    values.insert("track_number".to_string(), json!(track.track_number));
    values.insert("disc_number".to_string(), json!(track.disc_number));
    values.insert("genre".to_string(), json!(track.genre.as_deref()));
    values.insert("year".to_string(), json!(track.year));
    values
}

fn mark_track_event(track_id: i64, event_type: &str) -> Result<DesktopTrack, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start playback event: {error}"))?;
    let present: Option<i64> = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .ok();
    if present.is_none() {
        return Err("Track not found".to_string());
    }
    let (count_column, timestamp_column) = if event_type == "played" {
        ("play_count", "last_played_at")
    } else {
        ("skip_count", "last_skipped_at")
    };
    transaction
        .execute(
            &format!(
                "UPDATE tracks
                 SET {count_column} = coalesce({count_column}, 0) + 1,
                     {timestamp_column} = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
                     updated_at = datetime('now')
                 WHERE id = ?"
            ),
            params![track_id],
        )
        .map_err(|error| format!("Could not update Rust {event_type} event: {error}"))?;
    transaction
        .execute(
            "INSERT INTO play_events(track_id, event_type, metadata_json) VALUES(?, ?, ?)",
            params![
                track_id,
                event_type,
                json!({ "source": "player" }).to_string()
            ],
        )
        .map_err(|error| format!("Could not record Rust {event_type} event: {error}"))?;
    clear_library_query_cache(&transaction);
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust {event_type} event: {error}"))?;
    track_by_id(&connection, track_id)
}

#[tauri::command]
pub fn mark_track_played(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
) -> Result<DesktopTrack, String> {
    mark_track_event(track_id, "played")
}

#[tauri::command]
pub fn mark_track_skipped(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
) -> Result<DesktopTrack, String> {
    mark_track_event(track_id, "skipped")
}

