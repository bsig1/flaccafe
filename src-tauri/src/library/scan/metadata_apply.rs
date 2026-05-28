fn apply_metadata_results(
    connection: &mut Connection,
    stats: &mut DesktopScanResult,
    folder: &Path,
    results: &[JsonValue],
    requested_files: &[AudioSnapshot],
    processed: &mut usize,
    mut local_job: Option<&mut DesktopScanJob>,
    registry_job_id: Option<&str>,
) -> Result<(), String> {
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start scan metadata transaction: {error}"))?;
    let mut requested_by_path = requested_files
        .iter()
        .map(|snapshot| (snapshot.path_text.to_ascii_lowercase(), snapshot))
        .collect::<HashMap<_, _>>();
    {
        let mut writer = ScanMetadataWriter::new(&transaction)?;
        let mut pending_progress = 0usize;
        let mut last_progress_at = Instant::now();
        for (index, result) in results.iter().enumerate() {
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
                    &transaction,
                    folder,
                    snapshot.map(|item| item.path.as_path()),
                    &message,
                );
            } else if let Some(metadata) = result.get("metadata").and_then(JsonValue::as_object) {
                match writer.upsert_track(metadata) {
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
                            &transaction,
                            folder,
                            snapshot.map(|item| item.path.as_path()),
                            &message,
                        );
                    }
                }
            }
            *processed += 1;
            pending_progress += 1;
            let is_last = index + 1 == results.len();
            if pending_progress >= 25
                || last_progress_at.elapsed() >= Duration::from_millis(250)
                || is_last
            {
                update_job(local_job.as_deref_mut(), registry_job_id, |job| {
                    job.processed_files = *processed;
                    job.inserted = stats.inserted;
                    job.updated = stats.updated;
                    job.skipped = stats.skipped;
                    job.errors = stats.errors.clone();
                })?;
                pending_progress = 0;
                last_progress_at = Instant::now();
            }
        }
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit scan metadata transaction: {error}"))?;
    Ok(())
}

pub(crate) fn upsert_track(
    connection: &Connection,
    metadata: &serde_json::Map<String, JsonValue>,
) -> Result<&'static str, String> {
    let mut writer = ScanMetadataWriter::new(connection)?;
    writer.upsert_track(metadata)
}

struct ScanMetadataWriter<'connection> {
    connection: &'connection Connection,
    existing_track: Statement<'connection>,
    local_rating_event: Statement<'connection>,
    insert_album: Statement<'connection>,
    select_album: Statement<'connection>,
    update_track: Statement<'connection>,
    insert_track: Statement<'connection>,
}

impl<'connection> ScanMetadataWriter<'connection> {
    fn new(connection: &'connection Connection) -> Result<Self, String> {
        Ok(Self {
            connection,
            existing_track: connection
                .prepare("SELECT id, rating FROM tracks WHERE path_key = ?")
                .map_err(|error| format!("Could not prepare existing track lookup: {error}"))?,
            local_rating_event: connection
                .prepare("SELECT 1 FROM play_events WHERE track_id = ? AND event_type = 'rated' LIMIT 1")
                .map_err(|error| format!("Could not prepare local rating event lookup: {error}"))?,
            insert_album: connection
                .prepare("INSERT OR IGNORE INTO albums(album, album_artist, year) VALUES(?, ?, ?)")
                .map_err(|error| format!("Could not prepare album insert: {error}"))?,
            select_album: connection
                .prepare("SELECT id FROM albums WHERE album IS ? AND album_artist IS ? AND year IS ?")
                .map_err(|error| format!("Could not prepare album lookup: {error}"))?,
            update_track: connection
                .prepare(
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
                )
                .map_err(|error| format!("Could not prepare track metadata update: {error}"))?,
            insert_track: connection
                .prepare(
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
                )
                .map_err(|error| format!("Could not prepare track metadata insert: {error}"))?,
        })
    }

    fn upsert_track(
        &mut self,
        metadata: &serde_json::Map<String, JsonValue>,
    ) -> Result<&'static str, String> {
        let path = required_text(metadata, "path")?;
        let path_key = required_text(metadata, "path_key")?;
        let album_id = self.ensure_album(metadata)?;
        let now = utc_now();
        let existing = self
            .existing_track
            .query_row(params![path_key.as_str()], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, Option<f64>>(1)?))
            })
            .optional()
            .map_err(|error| format!("Could not look up existing track metadata: {error}"))?;
        if let Some((track_id, existing_rating)) = existing {
            let rating = self.rating_for_scan(track_id, existing_rating, json_f64(metadata, "rating"))?;
            self.update_track
                .execute(params![
                    path.as_str(),
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
                    now.as_str(),
                    path_key.as_str(),
                ])
                .map_err(|error| format!("Could not update track metadata: {error}"))?;
            Ok("updated")
        } else {
            self.insert_track
                .execute(params![
                    path.as_str(),
                    path_key.as_str(),
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
                    now.as_str(),
                    now.as_str(),
                ])
                .map_err(|error| format!("Could not insert track metadata: {error}"))?;
            mark_track_for_inbox(self.connection, self.connection.last_insert_rowid(), &now)?;
            Ok("inserted")
        }
    }

    fn rating_for_scan(
        &mut self,
        track_id: i64,
        existing_rating: Option<f64>,
        metadata_rating: Option<f64>,
    ) -> Result<Option<f64>, String> {
        let has_local_rating_event =
            if is_bad_imported_five_star_repair_candidate(existing_rating, metadata_rating) {
                self.has_local_rating_event(track_id)?
            } else {
                false
            };
        Ok(scan_rating_after_bad_five_star_repair(
            existing_rating,
            metadata_rating,
            has_local_rating_event,
        ))
    }

    fn has_local_rating_event(&mut self, track_id: i64) -> Result<bool, String> {
        self.local_rating_event
            .query_row(params![track_id], |_| Ok(()))
            .optional()
            .map(|row| row.is_some())
            .map_err(|error| format!("Could not check local rating edits: {error}"))
    }

    fn ensure_album(
        &mut self,
        metadata: &serde_json::Map<String, JsonValue>,
    ) -> Result<Option<i64>, String> {
        let Some((album, album_artist, year)) = album_identity(metadata) else {
            return Ok(None);
        };
        self.insert_album
            .execute(params![album.as_str(), album_artist.as_deref(), year])
            .map_err(|error| format!("Could not create album row: {error}"))?;
        let album_id = self
            .select_album
            .query_row(params![album.as_str(), album_artist.as_deref(), year], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(|error| format!("Could not look up album row: {error}"))?;
        Ok(Some(album_id))
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
    let metadata_rating = json_f64(metadata, "rating");
    let has_local_rating_event =
        if is_bad_imported_five_star_repair_candidate(existing_rating, metadata_rating) {
            has_local_rating_event(connection, track_id)?
        } else {
            false
        };
    let rating = scan_rating_after_bad_five_star_repair(
        existing_rating,
        metadata_rating,
        has_local_rating_event,
    );
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

fn has_local_rating_event(connection: &Connection, track_id: i64) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT 1 FROM play_events WHERE track_id = ? AND event_type = 'rated' LIMIT 1",
            params![track_id],
            |_| Ok(()),
        )
        .optional()
        .map(|row| row.is_some())
        .map_err(|error| format!("Could not check local rating edits: {error}"))
}

fn scan_rating_after_bad_five_star_repair(
    existing_rating: Option<f64>,
    metadata_rating: Option<f64>,
    has_local_rating_event: bool,
) -> Option<f64> {
    if is_bad_imported_five_star_repair_candidate(existing_rating, metadata_rating)
        && !has_local_rating_event
    {
        metadata_rating
    } else {
        existing_rating.or(metadata_rating)
    }
}

fn is_bad_imported_five_star_repair_candidate(
    existing_rating: Option<f64>,
    metadata_rating: Option<f64>,
) -> bool {
    matches!(
        (existing_rating, metadata_rating),
        (Some(existing), Some(scanned))
            if (existing - 5.0).abs() < f64::EPSILON && scanned < 5.0
    )
}

#[cfg(test)]
mod metadata_apply_tests {
    use super::*;

    #[test]
    fn only_replaces_unedited_imported_five_star_ratings() {
        assert_eq!(
            scan_rating_after_bad_five_star_repair(Some(5.0), Some(2.0), false),
            Some(2.0)
        );
        assert_eq!(
            scan_rating_after_bad_five_star_repair(Some(5.0), Some(2.0), true),
            Some(5.0)
        );
        assert_eq!(
            scan_rating_after_bad_five_star_repair(Some(4.0), Some(2.0), false),
            Some(4.0)
        );
        assert_eq!(
            scan_rating_after_bad_five_star_repair(Some(5.0), Some(5.0), false),
            Some(5.0)
        );
    }
}

pub(crate) fn ensure_album(
    connection: &Connection,
    metadata: &serde_json::Map<String, JsonValue>,
) -> Result<Option<i64>, String> {
    let Some((album, album_artist, year)) = album_identity(metadata) else {
        return Ok(None);
    };
    connection
        .execute(
            "INSERT OR IGNORE INTO albums(album, album_artist, year) VALUES(?, ?, ?)",
            params![album.as_str(), album_artist.as_deref(), year],
        )
        .map_err(|error| format!("Could not create album row: {error}"))?;
    let album_id = connection
        .query_row(
            "SELECT id FROM albums WHERE album IS ? AND album_artist IS ? AND year IS ?",
            params![album.as_str(), album_artist.as_deref(), year],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not look up album row: {error}"))?;
    Ok(Some(album_id))
}

fn album_identity(
    metadata: &serde_json::Map<String, JsonValue>,
) -> Option<(String, Option<String>, Option<i64>)> {
    let album = json_string(metadata, "album").filter(|value| !value.trim().is_empty())?;
    let album_artist =
        json_string(metadata, "album_artist").or_else(|| json_string(metadata, "artist"));
    Some((album, album_artist, json_i64(metadata, "year")))
}

