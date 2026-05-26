fn apply_metadata_results(
    stats: &mut DesktopScanResult,
    folder: &Path,
    results: &[JsonValue],
    requested_files: &[AudioSnapshot],
    processed: &mut usize,
    mut local_job: Option<&mut DesktopScanJob>,
    registry_job_id: Option<&str>,
) -> Result<(), String> {
    let connection = open_database()?;
    let mut requested_by_path = requested_files
        .iter()
        .map(|snapshot| (snapshot.path_text.to_ascii_lowercase(), snapshot))
        .collect::<HashMap<_, _>>();
    for result in results {
        let path_text = result
            .get("path")
            .and_then(JsonValue::as_str)
            .unwrap_or_default()
            .to_string();
        let snapshot = requested_by_path
            .remove(&path_text.to_ascii_lowercase())
            .or_else(|| {
                if requested_files.is_empty() {
                    None
                } else {
                    requested_files.get(*processed % requested_files.len())
                }
            });
        if let Some(error) = result.get("error").and_then(JsonValue::as_str) {
            stats.skipped += 1;
            let label = snapshot
                .map(|snapshot| snapshot.path_text.clone())
                .unwrap_or_else(|| path_text.clone());
            let message = format!("{label}: {error}");
            stats.errors.push(message.clone());
            record_scan_error(
                &connection,
                folder,
                snapshot.map(|item| item.path.as_path()),
                &message,
            );
        } else if let Some(metadata) = result.get("metadata").and_then(JsonValue::as_object) {
            match upsert_track(&connection, metadata) {
                Ok("inserted") => stats.inserted += 1,
                Ok(_) => stats.updated += 1,
                Err(error) => {
                    stats.skipped += 1;
                    let label = snapshot
                        .map(|snapshot| snapshot.path_text.clone())
                        .unwrap_or_else(|| path_text.clone());
                    let message = format!("{label}: {error}");
                    stats.errors.push(message.clone());
                    record_scan_error(
                        &connection,
                        folder,
                        snapshot.map(|item| item.path.as_path()),
                        &message,
                    );
                }
            }
        }
        *processed += 1;
        update_job(local_job.as_deref_mut(), registry_job_id, |job| {
            job.processed_files = *processed;
            job.inserted = stats.inserted;
            job.updated = stats.updated;
            job.skipped = stats.skipped;
            job.errors = stats.errors.clone();
        })?;
    }
    clear_library_query_cache(&connection);
    Ok(())
}

pub(crate) fn upsert_track(
    connection: &Connection,
    metadata: &serde_json::Map<String, JsonValue>,
) -> Result<&'static str, String> {
    let path = required_text(metadata, "path")?;
    let path_key = required_text(metadata, "path_key")?;
    let album_id = ensure_album(connection, metadata)?;
    let now = utc_now();
    let existing = connection
        .query_row(
            "SELECT id, rating FROM tracks WHERE path_key = ?",
            params![path_key],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<f64>>(1)?)),
        )
        .ok();
    if let Some((_, existing_rating)) = existing {
        let rating = existing_rating.or_else(|| json_f64(metadata, "rating"));
        connection
            .execute(
                "
                UPDATE tracks
                SET path = ?,
                    title = ?,
                    artist = ?,
                    album = ?,
                    album_artist = ?,
                    album_id = ?,
                    track_number = ?,
                    disc_number = ?,
                    genre = ?,
                    year = ?,
                    duration_seconds = ?,
                    bitrate = ?,
                    replaygain_track_gain_db = ?,
                    replaygain_album_gain_db = ?,
                    replaygain_track_peak = ?,
                    replaygain_album_peak = ?,
                    audio_fingerprint = ?,
                    rating = ?,
                    file_modified_at = ?,
                    updated_at = ?
                WHERE path_key = ?
                ",
                params![
                    path,
                    json_string(metadata, "title"),
                    json_string(metadata, "artist"),
                    json_string(metadata, "album"),
                    json_string(metadata, "album_artist"),
                    album_id,
                    json_i64(metadata, "track_number"),
                    json_i64(metadata, "disc_number"),
                    json_string(metadata, "genre"),
                    json_i64(metadata, "year"),
                    json_f64(metadata, "duration_seconds"),
                    json_i64(metadata, "bitrate"),
                    json_f64(metadata, "replaygain_track_gain_db"),
                    json_f64(metadata, "replaygain_album_gain_db"),
                    json_f64(metadata, "replaygain_track_peak"),
                    json_f64(metadata, "replaygain_album_peak"),
                    json_string(metadata, "audio_fingerprint"),
                    rating,
                    json_string(metadata, "file_modified_at"),
                    now,
                    path_key,
                ],
            )
            .map_err(|error| format!("Could not update track metadata: {error}"))?;
        Ok("updated")
    } else {
        connection
            .execute(
                "
                INSERT INTO tracks(
                  path, path_key, title, artist, album, album_artist, album_id,
                  track_number, disc_number, genre, year, duration_seconds, rating,
                  bitrate, replaygain_track_gain_db, replaygain_album_gain_db,
                  replaygain_track_peak, replaygain_album_peak, audio_fingerprint,
                  file_modified_at, date_added, updated_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ",
                params![
                    path,
                    path_key,
                    json_string(metadata, "title"),
                    json_string(metadata, "artist"),
                    json_string(metadata, "album"),
                    json_string(metadata, "album_artist"),
                    album_id,
                    json_i64(metadata, "track_number"),
                    json_i64(metadata, "disc_number"),
                    json_string(metadata, "genre"),
                    json_i64(metadata, "year"),
                    json_f64(metadata, "duration_seconds"),
                    json_f64(metadata, "rating"),
                    json_i64(metadata, "bitrate"),
                    json_f64(metadata, "replaygain_track_gain_db"),
                    json_f64(metadata, "replaygain_album_gain_db"),
                    json_f64(metadata, "replaygain_track_peak"),
                    json_f64(metadata, "replaygain_album_peak"),
                    json_string(metadata, "audio_fingerprint"),
                    json_string(metadata, "file_modified_at"),
                    now,
                    now,
                ],
            )
            .map_err(|error| format!("Could not insert track metadata: {error}"))?;
        mark_track_for_inbox(connection, connection.last_insert_rowid(), &now)?;
        Ok("inserted")
    }
}

pub(crate) fn update_track_from_metadata(
    connection: &Connection,
    track_id: i64,
    metadata: &serde_json::Map<String, JsonValue>,
) -> Result<(), String> {
    let path = required_text(metadata, "path")?;
    let path_key = required_text(metadata, "path_key")?;
    let album_id = ensure_album(connection, metadata)?;
    let existing_rating = connection
        .query_row(
            "SELECT rating FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get::<_, Option<f64>>(0),
        )
        .map_err(|_| "Moved track is no longer in the library".to_string())?;
    let rating = existing_rating.or_else(|| json_f64(metadata, "rating"));
    connection
        .execute(
            "
            UPDATE tracks
            SET path = ?,
                path_key = ?,
                title = ?,
                artist = ?,
                album = ?,
                album_artist = ?,
                album_id = ?,
                track_number = ?,
                disc_number = ?,
                genre = ?,
                year = ?,
                duration_seconds = ?,
                bitrate = ?,
                replaygain_track_gain_db = ?,
                replaygain_album_gain_db = ?,
                replaygain_track_peak = ?,
                replaygain_album_peak = ?,
                audio_fingerprint = ?,
                rating = ?,
                file_modified_at = ?,
                updated_at = ?
            WHERE id = ?
            ",
            params![
                path,
                path_key,
                json_string(metadata, "title"),
                json_string(metadata, "artist"),
                json_string(metadata, "album"),
                json_string(metadata, "album_artist"),
                album_id,
                json_i64(metadata, "track_number"),
                json_i64(metadata, "disc_number"),
                json_string(metadata, "genre"),
                json_i64(metadata, "year"),
                json_f64(metadata, "duration_seconds"),
                json_i64(metadata, "bitrate"),
                json_f64(metadata, "replaygain_track_gain_db"),
                json_f64(metadata, "replaygain_album_gain_db"),
                json_f64(metadata, "replaygain_track_peak"),
                json_f64(metadata, "replaygain_album_peak"),
                json_string(metadata, "audio_fingerprint"),
                rating,
                json_string(metadata, "file_modified_at"),
                utc_now(),
                track_id,
            ],
        )
        .map_err(|error| format!("Could not update moved track metadata: {error}"))?;
    Ok(())
}

pub(crate) fn ensure_album(
    connection: &Connection,
    metadata: &serde_json::Map<String, JsonValue>,
) -> Result<Option<i64>, String> {
    let album = json_string(metadata, "album").filter(|value| !value.trim().is_empty());
    let Some(album) = album else {
        return Ok(None);
    };
    let album_artist =
        json_string(metadata, "album_artist").or_else(|| json_string(metadata, "artist"));
    let year = json_i64(metadata, "year");
    connection
        .execute(
            "INSERT OR IGNORE INTO albums(album, album_artist, year) VALUES(?, ?, ?)",
            params![album, album_artist, year],
        )
        .map_err(|error| format!("Could not create album row: {error}"))?;
    let album_id = connection
        .query_row(
            "SELECT id FROM albums WHERE album IS ? AND album_artist IS ? AND year IS ?",
            params![album, album_artist, year],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not look up album row: {error}"))?;
    Ok(Some(album_id))
}

