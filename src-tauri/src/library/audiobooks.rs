use super::*;

#[tauri::command]
pub fn audiobooks(
    _state: State<'_, DesktopLibraryState>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<DesktopAudiobookListResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    let offset = offset.unwrap_or(0);
    let audiobook_filter = audiobook_where_clause();
    let track_columns = qualified_track_columns("tracks");
    let total = connection
        .query_row(
            &format!("SELECT COUNT(*) AS count FROM tracks WHERE {audiobook_filter}"),
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not count audiobooks: {error}"))?;
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns},
                   audiobook_progress.position_seconds,
                   audiobook_progress.duration_seconds AS saved_duration_seconds,
                   audiobook_progress.updated_at AS progress_updated_at,
                   COUNT(DISTINCT audiobook_bookmarks.id) AS bookmark_count,
                   COUNT(DISTINCT audiobook_chapters.id) AS chapter_count
            FROM tracks
            LEFT JOIN audiobook_progress ON audiobook_progress.track_id = tracks.id
            LEFT JOIN audiobook_bookmarks ON audiobook_bookmarks.track_id = tracks.id
            LEFT JOIN audiobook_chapters ON audiobook_chapters.track_id = tracks.id
            WHERE {audiobook_filter}
            GROUP BY tracks.id
            ORDER BY lower(coalesce(tracks.album_artist, tracks.artist, '')),
                     lower(coalesce(tracks.album, '')),
                     coalesce(tracks.disc_number, 0),
                     coalesce(tracks.track_number, 0),
                     lower(coalesce(tracks.title, ''))
            LIMIT ? OFFSET ?
            "#
        ))
        .map_err(|error| format!("Could not prepare audiobook query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64, offset as i64], |row| {
            let mut track = track_from_row(row)?;
            let position_seconds = row
                .get::<_, Option<f64>>("position_seconds")?
                .unwrap_or(0.0);
            let saved_duration_seconds: Option<f64> = row.get("saved_duration_seconds")?;
            let effective_duration = saved_duration_seconds.or(track.duration_seconds);
            track.duration_seconds = effective_duration;
            Ok(DesktopAudiobookTrack {
                track,
                position_seconds,
                progress_percent: progress_percent(position_seconds, effective_duration),
                bookmark_count: row.get::<_, Option<i64>>("bookmark_count")?.unwrap_or(0),
                chapter_count: row.get::<_, Option<i64>>("chapter_count")?.unwrap_or(0),
                progress_updated_at: row.get("progress_updated_at")?,
            })
        })
        .map_err(|error| format!("Could not read audiobooks: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode audiobooks: {error}"))?;
    Ok(DesktopAudiobookListResponse { total, tracks })
}

#[tauri::command]
pub fn update_audiobook_progress(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
    position_seconds: f64,
    duration_seconds: Option<f64>,
) -> Result<DesktopAudiobookProgressResponse, String> {
    if position_seconds < 0.0 || duration_seconds.is_some_and(|value| value < 0.0) {
        return Err("Audiobook progress cannot be negative".to_string());
    }
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start audiobook progress update: {error}"))?;
    let track_duration: Option<f64> = transaction
        .query_row(
            "SELECT duration_seconds FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .map_err(|_| "Audiobook track not found".to_string())?;
    let duration = duration_seconds.or(track_duration);
    transaction
        .execute(
            r#"
            INSERT INTO audiobook_progress(track_id, position_seconds, duration_seconds, updated_at)
            VALUES(?, ?, ?, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET
              position_seconds = excluded.position_seconds,
              duration_seconds = excluded.duration_seconds,
              updated_at = datetime('now')
            "#,
            params![track_id, position_seconds.max(0.0), duration],
        )
        .map_err(|error| format!("Could not save audiobook progress: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit audiobook progress: {error}"))?;
    connection
        .query_row(
            "SELECT track_id, position_seconds, duration_seconds, updated_at FROM audiobook_progress WHERE track_id = ?",
            params![track_id],
            |row| {
                Ok(DesktopAudiobookProgressResponse {
                    track_id: row.get("track_id")?,
                    position_seconds: row.get("position_seconds")?,
                    duration_seconds: row.get("duration_seconds")?,
                    updated_at: row.get("updated_at")?,
                })
            },
        )
        .map_err(|error| format!("Could not read audiobook progress: {error}"))
}

#[tauri::command]
pub fn track_resume_progress(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
) -> Result<Option<DesktopAudiobookProgressResponse>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            "SELECT track_id, position_seconds, duration_seconds, updated_at
             FROM audiobook_progress
             WHERE track_id = ?",
        )
        .map_err(|error| format!("Could not prepare resume progress query: {error}"))?;
    let mut rows = statement
        .query_map(params![track_id], |row| {
            Ok(DesktopAudiobookProgressResponse {
                track_id: row.get("track_id")?,
                position_seconds: row.get("position_seconds")?,
                duration_seconds: row.get("duration_seconds")?,
                updated_at: row.get("updated_at")?,
            })
        })
        .map_err(|error| format!("Could not read resume progress: {error}"))?;
    match rows.next() {
        Some(row) => row
            .map(Some)
            .map_err(|error| format!("Could not decode resume progress: {error}")),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn audiobook_bookmarks(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
) -> Result<Vec<DesktopAudiobookBookmark>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            "SELECT id, track_id, position_seconds, label, note, created_at
             FROM audiobook_bookmarks
             WHERE track_id = ?
             ORDER BY position_seconds, id",
        )
        .map_err(|error| format!("Could not prepare audiobook bookmark query: {error}"))?;
    let rows = statement
        .query_map(params![track_id], audiobook_bookmark_from_row)
        .map_err(|error| format!("Could not read audiobook bookmarks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode audiobook bookmarks: {error}"))
}

#[tauri::command]
pub fn create_audiobook_bookmark(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
    position_seconds: f64,
    label: Option<String>,
    note: Option<String>,
) -> Result<DesktopAudiobookBookmark, String> {
    if position_seconds < 0.0 {
        return Err("Audiobook bookmark position cannot be negative".to_string());
    }
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start audiobook bookmark insert: {error}"))?;
    let present: Option<i64> = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .ok();
    if present.is_none() {
        return Err("Audiobook track not found".to_string());
    }
    let label = clean_optional_text(label).unwrap_or_else(|| "Bookmark".to_string());
    let cursor = transaction
        .execute(
            "INSERT INTO audiobook_bookmarks(track_id, position_seconds, label, note) VALUES(?, ?, ?, ?)",
            params![track_id, position_seconds.max(0.0), label, clean_optional_text(note)],
        )
        .map_err(|error| format!("Could not save audiobook bookmark: {error}"))?;
    let bookmark_id = transaction.last_insert_rowid();
    if cursor == 0 {
        return Err("Could not save audiobook bookmark".to_string());
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit audiobook bookmark: {error}"))?;
    connection
        .query_row(
            "SELECT id, track_id, position_seconds, label, note, created_at FROM audiobook_bookmarks WHERE id = ?",
            params![bookmark_id],
            audiobook_bookmark_from_row,
        )
        .map_err(|error| format!("Could not read audiobook bookmark: {error}"))
}

#[tauri::command]
pub fn delete_audiobook_bookmark(
    _state: State<'_, DesktopLibraryState>,
    bookmark_id: i64,
) -> Result<DesktopDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM audiobook_bookmarks WHERE id = ?",
            params![bookmark_id],
        )
        .map_err(|error| format!("Could not delete audiobook bookmark: {error}"))?;
    if deleted == 0 {
        return Err("Audiobook bookmark not found".to_string());
    }
    Ok(DesktopDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn audiobook_chapters(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
) -> Result<Vec<DesktopAudiobookChapter>, String> {
    let connection = open_database()?;
    audiobook_chapters_for_connection(&connection, track_id)
}

fn audiobook_chapters_for_connection(
    connection: &Connection,
    track_id: i64,
) -> Result<Vec<DesktopAudiobookChapter>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, track_id, chapter_index, title, start_seconds, end_seconds, created_at, updated_at
             FROM audiobook_chapters
             WHERE track_id = ?
             ORDER BY chapter_index",
        )
        .map_err(|error| format!("Could not prepare audiobook chapter query: {error}"))?;
    let rows = statement
        .query_map(params![track_id], audiobook_chapter_from_row)
        .map_err(|error| format!("Could not read audiobook chapters: {error}"))?;
    let chapters = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode audiobook chapters: {error}"))?;
    if !chapters.is_empty() {
        return Ok(chapters);
    }
    let fallback: Option<(Option<String>, Option<f64>)> = connection
        .query_row(
            "SELECT title, duration_seconds FROM tracks WHERE id = ?",
            params![track_id],
            |row| Ok((row.get("title")?, row.get("duration_seconds")?)),
        )
        .ok();
    let Some((title, duration_seconds)) = fallback else {
        return Ok(Vec::new());
    };
    Ok(vec![DesktopAudiobookChapter {
        id: None,
        track_id: Some(track_id),
        chapter_index: 1,
        title: title
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "Chapter 1".to_string()),
        start_seconds: 0.0,
        end_seconds: duration_seconds,
        created_at: None,
        updated_at: None,
    }])
}

#[tauri::command]
pub fn save_audiobook_chapters(
    _state: State<'_, DesktopLibraryState>,
    track_id: i64,
    chapters: Vec<serde_json::Value>,
) -> Result<Vec<DesktopAudiobookChapter>, String> {
    if chapters.len() > 500 {
        return Err("Audiobook chapters are limited to 500 entries".to_string());
    }
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start audiobook chapter update: {error}"))?;
    let present: Option<i64> = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get(0),
        )
        .ok();
    if present.is_none() {
        return Err("Audiobook track not found".to_string());
    }
    transaction
        .execute(
            "DELETE FROM audiobook_chapters WHERE track_id = ?",
            params![track_id],
        )
        .map_err(|error| format!("Could not replace audiobook chapters: {error}"))?;
    for (index, chapter) in chapters.iter().enumerate() {
        let chapter_index = chapter
            .get("chapter_index")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or((index + 1) as i64)
            .max(1);
        let title = chapter
            .get("title")
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format!("Chapter {}", index + 1));
        let start_seconds = chapter
            .get("start_seconds")
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(0.0)
            .max(0.0);
        let end_seconds = chapter
            .get("end_seconds")
            .and_then(serde_json::Value::as_f64)
            .filter(|value| *value >= 0.0);
        transaction
            .execute(
                "INSERT INTO audiobook_chapters(track_id, chapter_index, title, start_seconds, end_seconds) VALUES(?, ?, ?, ?, ?)",
                params![track_id, chapter_index, title, start_seconds, end_seconds],
            )
            .map_err(|error| format!("Could not save audiobook chapter: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit audiobook chapters: {error}"))?;
    audiobook_chapters(_state, track_id)
}

pub fn export_audiobook_sync_metadata(
    track_ids: Option<Vec<i64>>,
    limit: Option<usize>,
) -> Result<DesktopAudiobookSyncExportResponse, String> {
    let limit = limit.unwrap_or(10_000).clamp(1, 100_000);
    let connection = open_database()?;
    let audiobook_filter = audiobook_where_clause();
    let mut query_params: Vec<Value> = Vec::new();
    let id_filter = if let Some(track_ids) = track_ids {
        let ids = track_ids
            .into_iter()
            .filter(|track_id| *track_id > 0)
            .collect::<Vec<_>>();
        if ids.is_empty() {
            String::new()
        } else {
            query_params.extend(ids.iter().copied().map(Value::Integer));
            format!(
                " AND tracks.id IN ({})",
                std::iter::repeat("?")
                    .take(ids.len())
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
    } else {
        String::new()
    };
    query_params.push(Value::Integer(limit as i64));
    let mut statement = connection
        .prepare(&format!(
            "
            SELECT
                tracks.id AS id,
                tracks.path AS path,
                tracks.title AS title,
                tracks.artist AS artist,
                tracks.album AS album,
                tracks.album_artist AS album_artist,
                tracks.track_number AS track_number,
                tracks.disc_number AS disc_number,
                tracks.genre AS genre,
                tracks.year AS year,
                tracks.duration_seconds AS duration_seconds,
                tracks.rating AS rating,
                tracks.play_count AS play_count,
                tracks.last_played_at AS last_played_at,
                tracks.date_added AS date_added,
                audiobook_progress.position_seconds AS position_seconds,
                audiobook_progress.updated_at AS progress_updated_at
            FROM tracks
            LEFT JOIN audiobook_progress ON audiobook_progress.track_id = tracks.id
            WHERE {audiobook_filter}
              {id_filter}
            ORDER BY lower(coalesce(tracks.album_artist, tracks.artist, '')),
                     lower(coalesce(tracks.album, '')),
                     coalesce(tracks.track_number, 0)
            LIMIT ?
            "
        ))
        .map_err(|error| format!("Could not prepare audiobook sync export: {error}"))?;
    let track_rows = statement
        .query_map(params_from_iter(query_params), |row| {
            row_to_json_object(
                row,
                &[
                    "id",
                    "path",
                    "title",
                    "artist",
                    "album",
                    "album_artist",
                    "track_number",
                    "disc_number",
                    "genre",
                    "year",
                    "duration_seconds",
                    "rating",
                    "play_count",
                    "last_played_at",
                    "date_added",
                    "position_seconds",
                    "progress_updated_at",
                ],
            )
        })
        .map_err(|error| format!("Could not read audiobook sync export rows: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode audiobook sync export rows: {error}"))?;

    let mut payload_tracks = Vec::new();
    for track in track_rows {
        let track_id = track
            .get("id")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or(0);
        payload_tracks.push(json!({
            "track": track,
            "bookmarks": audiobook_bookmarks_json(&connection, track_id)?,
            "chapters": audiobook_chapters_json(&connection, track_id)?,
        }));
    }
    let generated_at = scan::utc_now();
    let export_dir = app_storage_root().join("exports");
    std::fs::create_dir_all(&export_dir).map_err(|error| {
        format!(
            "Could not create audiobook sync export folder {}: {error}",
            export_dir.display()
        )
    })?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let target = export_dir.join(format!("flac-cafe-audiobook-sync-{stamp}.json"));
    let payload = json!({
        "generated_at": generated_at,
        "format": "flac-cafe-audiobook-sync-v1",
        "tracks": payload_tracks,
    });
    let text = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Could not encode audiobook sync export: {error}"))?;
    std::fs::write(&target, text).map_err(|error| {
        format!(
            "Could not write audiobook sync export {}: {error}",
            target.display()
        )
    })?;
    Ok(DesktopAudiobookSyncExportResponse {
        export_path: target.to_string_lossy().to_string(),
        track_count: payload
            .get("tracks")
            .and_then(serde_json::Value::as_array)
            .map(|tracks| tracks.len() as i64)
            .unwrap_or(0),
        generated_at,
    })
}

fn audiobook_bookmarks_json(
    connection: &Connection,
    track_id: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, track_id, position_seconds, label, note, created_at
             FROM audiobook_bookmarks
             WHERE track_id = ?
             ORDER BY position_seconds ASC, id ASC",
        )
        .map_err(|error| format!("Could not prepare audiobook bookmark export: {error}"))?;
    let rows = statement
        .query_map(params![track_id], |row| {
            row_to_json_object(
                row,
                &[
                    "id",
                    "track_id",
                    "position_seconds",
                    "label",
                    "note",
                    "created_at",
                ],
            )
        })
        .map_err(|error| format!("Could not read audiobook bookmark export: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode audiobook bookmark export: {error}"))
}

fn audiobook_chapters_json(
    connection: &Connection,
    track_id: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let chapters = audiobook_chapters_for_connection(connection, track_id)?;
    serde_json::to_value(chapters)
        .map(|value| value.as_array().cloned().unwrap_or_default())
        .map_err(|error| format!("Could not encode audiobook chapters: {error}"))
}
