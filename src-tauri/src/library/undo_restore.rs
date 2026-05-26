fn json_sql_value(value: Option<&serde_json::Value>) -> Value {
    match value {
        Some(serde_json::Value::Null) | None => Value::Null,
        Some(serde_json::Value::Bool(value)) => Value::Integer(if *value { 1 } else { 0 }),
        Some(serde_json::Value::Number(value)) => {
            if let Some(integer) = value.as_i64() {
                Value::Integer(integer)
            } else if let Some(float) = value.as_f64() {
                Value::Real(float)
            } else {
                Value::Null
            }
        }
        Some(serde_json::Value::String(value)) => {
            if value.trim().is_empty() {
                Value::Null
            } else {
                Value::Text(value.clone())
            }
        }
        Some(value) => Value::Text(value.to_string()),
    }
}

fn json_i64(value: Option<&serde_json::Value>) -> Option<i64> {
    value.and_then(|value| {
        value
            .as_i64()
            .or_else(|| value.as_f64().map(|number| number.round() as i64))
            .or_else(|| {
                value
                    .as_str()
                    .and_then(|text| text.trim().parse::<i64>().ok())
            })
    })
}

fn json_f64(value: Option<&serde_json::Value>) -> Option<f64> {
    value.and_then(|value| {
        value.as_f64().or_else(|| {
            value
                .as_str()
                .and_then(|text| text.trim().parse::<f64>().ok())
        })
    })
}

fn json_text(value: Option<&serde_json::Value>) -> Option<String> {
    value.and_then(|value| match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(text) => {
            Some(text.trim().to_string()).filter(|text| !text.is_empty())
        }
        _ => Some(value.to_string()),
    })
}

fn update_track_metadata_field(
    connection: &Connection,
    track_id: i64,
    field: &str,
    value: Option<&serde_json::Value>,
) -> Result<(), String> {
    match field {
        "title" | "artist" | "album" | "album_artist" | "genre" => {
            let sql = match field {
                "title" => "UPDATE tracks SET title = ?, updated_at = datetime('now') WHERE id = ?",
                "artist" => {
                    "UPDATE tracks SET artist = ?, updated_at = datetime('now') WHERE id = ?"
                }
                "album" => "UPDATE tracks SET album = ?, updated_at = datetime('now') WHERE id = ?",
                "album_artist" => {
                    "UPDATE tracks SET album_artist = ?, updated_at = datetime('now') WHERE id = ?"
                }
                _ => "UPDATE tracks SET genre = ?, updated_at = datetime('now') WHERE id = ?",
            };
            connection
                .execute(sql, params![json_text(value), track_id])
                .map_err(|error| format!("Could not restore metadata field {field}: {error}"))?;
        }
        "track_number" | "disc_number" | "year" => {
            let sql = match field {
                "track_number" => {
                    "UPDATE tracks SET track_number = ?, updated_at = datetime('now') WHERE id = ?"
                }
                "disc_number" => {
                    "UPDATE tracks SET disc_number = ?, updated_at = datetime('now') WHERE id = ?"
                }
                _ => "UPDATE tracks SET year = ?, updated_at = datetime('now') WHERE id = ?",
            };
            connection
                .execute(sql, params![json_i64(value), track_id])
                .map_err(|error| format!("Could not restore metadata field {field}: {error}"))?;
        }
        "rating" => {
            let rating = json_f64(value).filter(|rating| (0.5..=5.0).contains(rating));
            connection
                .execute(
                    "UPDATE tracks SET rating = ?, updated_at = datetime('now') WHERE id = ?",
                    params![rating, track_id],
                )
                .map_err(|error| format!("Could not restore rating: {error}"))?;
        }
        _ => return Err(format!("Undo does not support metadata field {field}")),
    }
    Ok(())
}

fn update_track_custom_tag(
    connection: &Connection,
    track_id: i64,
    tag_key: &str,
    value: Option<&serde_json::Value>,
) -> Result<(), String> {
    let key = tag_key.trim();
    if key.is_empty() {
        return Err("Custom tag name is required".to_string());
    }
    connection
        .execute(
            "DELETE FROM track_custom_tags WHERE track_id = ? AND lower(tag_key) = lower(?)",
            params![track_id, key],
        )
        .map_err(|error| format!("Could not clear restored custom tag: {error}"))?;
    if let Some(value) = json_text(value) {
        connection
            .execute(
                "INSERT INTO track_custom_tags(track_id, tag_key, tag_value, updated_at) VALUES(?, ?, ?, datetime('now'))",
                params![track_id, key, value],
            )
            .map_err(|error| format!("Could not restore custom tag: {error}"))?;
    }
    Ok(())
}

fn restore_metadata_snapshot(
    connection: &Connection,
    track: &serde_json::Map<String, serde_json::Value>,
    fields: &[String],
) -> Result<Vec<i64>, Vec<String>> {
    let track_id = json_i64(track.get("id")).unwrap_or(0);
    if track_id <= 0 {
        return Err(vec!["Undo payload is missing track id".to_string()]);
    }
    let exists = connection
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .is_some();
    if !exists {
        return Err(vec![format!(
            "Track {track_id} is no longer in the library"
        )]);
    }
    let mut errors = Vec::new();
    for field in fields {
        if let Some(custom_key) = field.strip_prefix("custom:") {
            if let Some(custom_tags) = track
                .get("custom_tags")
                .and_then(serde_json::Value::as_object)
            {
                if let Err(error) = update_track_custom_tag(
                    connection,
                    track_id,
                    custom_key,
                    custom_tags.get(custom_key),
                ) {
                    errors.push(error);
                }
            }
            continue;
        }
        if let Err(error) =
            update_track_metadata_field(connection, track_id, field, track.get(field))
        {
            errors.push(error);
        }
    }
    if errors.is_empty() {
        clear_library_query_cache(connection);
        Ok(vec![track_id])
    } else {
        Err(errors)
    }
}

fn restore_advanced_snapshot(
    connection: &Connection,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<i64>, Vec<String>> {
    let Some(track) = payload.get("track").and_then(serde_json::Value::as_object) else {
        return Err(vec!["Undo payload is missing track metadata".to_string()]);
    };
    let custom_tags = payload
        .get("custom_tags")
        .and_then(serde_json::Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mut merged = track.clone();
    merged.insert(
        "custom_tags".to_string(),
        serde_json::Value::Object(custom_tags),
    );
    let fields = payload
        .get("changed_fields")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|items| !items.is_empty())
        .unwrap_or_else(|| {
            vec![
                "title".to_string(),
                "artist".to_string(),
                "album".to_string(),
                "album_artist".to_string(),
                "track_number".to_string(),
                "disc_number".to_string(),
                "genre".to_string(),
                "year".to_string(),
                "rating".to_string(),
            ]
        });
    restore_metadata_snapshot(connection, &merged, &fields)
}

fn restore_changed_metadata(
    connection: &Connection,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<i64>, Vec<String>> {
    let Some(track) = payload.get("track").and_then(serde_json::Value::as_object) else {
        return Err(vec!["Undo payload is missing track metadata".to_string()]);
    };
    let Some(changes) = payload
        .get("changes")
        .and_then(serde_json::Value::as_object)
    else {
        return Err(vec!["Undo payload is missing changed fields".to_string()]);
    };
    let fields = changes.keys().cloned().collect::<Vec<_>>();
    restore_metadata_snapshot(connection, track, &fields)
}

fn restore_file_organization_entry(
    connection: &Connection,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<i64>, Vec<String>> {
    let track_id = json_i64(payload.get("track_id")).unwrap_or(0);
    let source = json_text(payload.get("to")).unwrap_or_default();
    let target = json_text(payload.get("from")).unwrap_or_default();
    if track_id <= 0 || source.is_empty() || target.is_empty() {
        return Err(vec!["Undo payload is missing file move details".to_string()]);
    }
    let source_path = PathBuf::from(&source);
    let target_path = PathBuf::from(&target);
    if !source_path.exists() {
        return Err(vec![format!(
            "Moved file is missing: {}",
            source_path.display()
        )]);
    }
    if target_path.exists() {
        return Err(vec![format!(
            "Original path already exists: {}",
            target_path.display()
        )]);
    }
    if !connection
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .is_some()
    {
        return Err(vec![format!(
            "Track {track_id} is no longer in the library"
        )]);
    }
    if let Some(parent) = target_path.parent() {
        if let Err(error) = std::fs::create_dir_all(parent) {
            return Err(vec![format!("Could not create original folder: {error}")]);
        }
    }
    if let Err(error) = std::fs::rename(&source_path, &target_path) {
        return Err(vec![format!("Could not move file back: {error}")]);
    }
    let old_key =
        json_text(payload.get("new_path_key")).unwrap_or_else(|| normalized_path_key(&source));
    let restored_key =
        json_text(payload.get("previous_path_key")).unwrap_or_else(|| normalized_path_key(&target));
    connection
        .execute(
            "UPDATE tracks SET path = ?, path_key = ?, file_modified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
            params![target_path.to_string_lossy().to_string(), restored_key, track_id],
        )
        .map_err(|error| vec![format!("Could not restore organized track path: {error}")])?;
    let _ = connection.execute(
        "DELETE FROM track_metadata_cache WHERE path_key IN (?, ?)",
        params![old_key, normalized_path_key(&target_path.to_string_lossy())],
    );
    clear_library_query_cache(connection);
    Ok(vec![track_id])
}

fn restore_removed_track_entry(
    connection: &Connection,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> Result<Vec<i64>, Vec<String>> {
    let Some(track) = payload.get("track").and_then(serde_json::Value::as_object) else {
        return Err(vec![
            "Undo payload is missing removed track data".to_string()
        ]);
    };
    let track_id = json_i64(track.get("id")).unwrap_or(0);
    let path = json_text(track.get("path")).unwrap_or_default();
    if track_id <= 0 || path.is_empty() {
        return Err(vec![
            "Undo payload is missing removed track id or path".to_string()
        ]);
    }
    let track_path = PathBuf::from(&path);
    if !track_path.exists() {
        return Err(vec![format!(
            "Audio file no longer exists: {}",
            track_path.display()
        )]);
    }
    let restored_key =
        json_text(track.get("path_key")).unwrap_or_else(|| normalized_path_key(&path));
    if connection
        .query_row(
            "SELECT id FROM tracks WHERE id = ? OR path_key = ?",
            params![track_id, restored_key],
            |row| row.get::<_, i64>(0),
        )
        .ok()
        .is_some()
    {
        return Err(vec![format!(
            "Track id or path is already present in the library: {track_id}"
        )]);
    }
    const RESTORE_COLUMNS: &[&str] = &[
        "id",
        "path",
        "path_key",
        "title",
        "artist",
        "album",
        "album_artist",
        "album_id",
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
        "updated_at",
    ];
    let placeholders = vec!["?"; RESTORE_COLUMNS.len()].join(",");
    let values = RESTORE_COLUMNS
        .iter()
        .map(|column| {
            if *column == "path_key" {
                Value::Text(restored_key.clone())
            } else {
                json_sql_value(track.get(*column))
            }
        })
        .collect::<Vec<_>>();
    connection
        .execute(
            &format!(
                "INSERT INTO tracks({}) VALUES({})",
                RESTORE_COLUMNS.join(", "),
                placeholders
            ),
            params_from_iter(values),
        )
        .map_err(|error| vec![format!("Could not restore removed track: {error}")])?;
    clear_library_query_cache(connection);
    Ok(vec![track_id])
}

fn restore_bulk_undo_entry_payload(
    connection: &Connection,
    action_type: &str,
    payload: &serde_json::Value,
) -> Result<Vec<i64>, Vec<String>> {
    let Some(payload) = payload.as_object() else {
        return Err(vec!["Undo payload is invalid".to_string()]);
    };
    match action_type {
        "csv_metadata_import" | "regex_metadata_replace" | "musicbrainz_auto_tag" => {
            restore_changed_metadata(connection, payload)
        }
        "advanced_tag_edit" | "tag_backup_restore" => {
            restore_advanced_snapshot(connection, payload)
        }
        "file_organization" => restore_file_organization_entry(connection, payload),
        "track_remove" => restore_removed_track_entry(connection, payload),
        "sqlite_file_tag_write" => Err(vec![
            "Restoring audio-file tag writes still requires the Python tag writer".to_string(),
        ]),
        _ => Err(vec![format!("Undo is not supported for {action_type}")]),
    }
}

#[tauri::command]
pub fn restore_bulk_undo_batch(
    _state: State<'_, DesktopLibraryState>,
    batch_id: String,
) -> Result<DesktopBulkUndoRestoreResponse, String> {
    let mut connection = open_database()?;
    let rows = {
        let mut statement = connection
            .prepare(
                "SELECT id, batch_id, action_type, summary, payload_json, created_at
                 FROM bulk_action_undo_log
                 WHERE batch_id = ?
                   AND action_type IN (
                     'csv_metadata_import', 'regex_metadata_replace', 'musicbrainz_auto_tag',
                     'file_organization', 'track_remove', 'advanced_tag_edit', 'tag_backup_restore'
                   )
                 ORDER BY id DESC",
            )
            .map_err(|error| format!("Could not prepare Rust undo batch restore: {error}"))?;
        let rows = statement
            .query_map(params![batch_id.trim()], |row| {
                Ok((
                    row.get::<_, i64>("id")?,
                    row.get::<_, Option<String>>("action_type")?
                        .unwrap_or_default(),
                    row.get::<_, Option<String>>("payload_json")?
                        .unwrap_or_default(),
                ))
            })
            .map_err(|error| format!("Could not read Rust undo batch: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode Rust undo batch: {error}"))?
    };
    if rows.is_empty() {
        return Err("Undo batch was not found".to_string());
    }
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust undo batch restore: {error}"))?;
    let mut affected = Vec::<i64>::new();
    let mut errors = Vec::<String>::new();
    let action_type = rows
        .first()
        .map(|(_, action_type, _)| action_type.clone())
        .unwrap_or_default();
    for (entry_id, row_action, payload_text) in rows {
        let payload = match serde_json::from_str::<serde_json::Value>(&payload_text) {
            Ok(payload) => payload,
            Err(_) => {
                errors.push(format!("Entry {entry_id}: invalid payload"));
                continue;
            }
        };
        match restore_bulk_undo_entry_payload(&transaction, &row_action, &payload) {
            Ok(track_ids) => affected.extend(track_ids),
            Err(entry_errors) => {
                errors.extend(
                    entry_errors
                        .into_iter()
                        .map(|error| format!("Entry {entry_id}: {error}")),
                );
            }
        }
    }
    let restored = errors.is_empty();
    if !affected.is_empty() {
        let unique = affected
            .iter()
            .copied()
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        let payload = json!({
            "restored_batch_id": batch_id,
            "restored_action_type": action_type,
            "affected_track_ids": unique,
            "errors": errors,
        });
        let _ = transaction.execute(
            "INSERT INTO bulk_action_undo_log(action_type, summary, payload_json)
             VALUES('undo_restore', ?, ?)",
            params![format!("Restored batch {batch_id}"), payload.to_string()],
        );
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit Rust undo batch restore: {error}"))?;
    let mut unique = Vec::new();
    for track_id in affected {
        if !unique.contains(&track_id) {
            unique.push(track_id);
        }
    }
    Ok(DesktopBulkUndoRestoreResponse {
        entry_id: 0,
        batch_id: Some(batch_id),
        action_type,
        restored,
        affected_track_ids: unique,
        errors: errors.into_iter().take(100).collect(),
    })
}

#[tauri::command]
pub fn restore_bulk_undo_entry(
    _state: State<'_, DesktopLibraryState>,
    entry_id: i64,
) -> Result<DesktopBulkUndoRestoreResponse, String> {
    let mut connection = open_database()?;
    let (batch_id, action_type, summary, payload_text) = connection
        .query_row(
            "SELECT batch_id, action_type, summary, payload_json
             FROM bulk_action_undo_log
             WHERE id = ?",
            params![entry_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>("batch_id")?,
                    row.get::<_, Option<String>>("action_type")?
                        .unwrap_or_default(),
                    row.get::<_, Option<String>>("summary")?.unwrap_or_default(),
                    row.get::<_, Option<String>>("payload_json")?
                        .unwrap_or_default(),
                ))
            },
        )
        .map_err(|_| "Undo log entry was not found".to_string())?;
    let payload = serde_json::from_str::<serde_json::Value>(&payload_text)
        .map_err(|_| "Undo log entry payload is invalid".to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust undo restore: {error}"))?;
    let (affected, errors) =
        match restore_bulk_undo_entry_payload(&transaction, &action_type, &payload) {
            Ok(track_ids) => (track_ids, Vec::new()),
            Err(errors) => (Vec::new(), errors),
        };
    let restored = errors.is_empty();
    if restored {
        let payload = json!({
            "restored_entry_id": entry_id,
            "restored_batch_id": batch_id,
            "restored_action_type": action_type,
            "affected_track_ids": affected,
        });
        let _ = transaction.execute(
            "INSERT INTO bulk_action_undo_log(action_type, summary, payload_json)
             VALUES('undo_restore', ?, ?)",
            params![format!("Restored {summary}"), payload.to_string()],
        );
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit Rust undo restore: {error}"))?;
    Ok(DesktopBulkUndoRestoreResponse {
        entry_id,
        batch_id,
        action_type,
        restored,
        affected_track_ids: affected,
        errors,
    })
}

fn track_by_id(connection: &Connection, track_id: i64) -> Result<DesktopTrack, String> {
    connection
        .query_row(
            &format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?"),
            params![track_id],
            track_from_row,
        )
        .map_err(|error| format!("Track not found: {error}"))
}


