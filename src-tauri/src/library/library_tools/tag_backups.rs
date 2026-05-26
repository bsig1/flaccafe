fn tag_backup_dir() -> PathBuf {
    app_storage_root().join("exports").join("tag-backups")
}

fn timestamp_for_file() -> String {
    let now = OffsetDateTime::now_utc();
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        now.year(),
        u8::from(now.month()),
        now.day(),
        now.hour(),
        now.minute(),
        now.second()
    )
}

fn utc_now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .replace_microsecond(0)
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn resolve_tag_backup_path(
    backup_path: Option<String>,
    default_name: Option<String>,
) -> Result<PathBuf, String> {
    let trimmed = backup_path.unwrap_or_default().trim().to_string();
    let mut target = if trimmed.is_empty() {
        tag_backup_dir()
            .join(default_name.ok_or_else(|| "Tag backup path is required".to_string())?)
    } else {
        let path = PathBuf::from(trimmed);
        if path.is_absolute() {
            path
        } else {
            tag_backup_dir().join(path)
        }
    };
    if target
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| !value.eq_ignore_ascii_case("json"))
        .unwrap_or(true)
    {
        target.set_extension("json");
    }
    Ok(target)
}

fn json_string_map(values: &BTreeMap<String, Option<String>>) -> JsonValue {
    let mut object = serde_json::Map::new();
    for (key, value) in values {
        object.insert(key.clone(), json_string(value.clone()));
    }
    JsonValue::Object(object)
}

fn track_backup_json(track: &DesktopTrack, path_key: Option<String>) -> JsonValue {
    let mut object = serde_json::Map::new();
    for field in TRACK_BACKUP_FIELDS {
        let value = match *field {
            "id" => json!(track.id),
            "path" => json!(track.path.as_str()),
            "title" => json!(track.title.as_deref()),
            "artist" => json!(track.artist.as_deref()),
            "album" => json!(track.album.as_deref()),
            "album_artist" => json!(track.album_artist.as_deref()),
            "track_number" => json!(track.track_number),
            "disc_number" => json!(track.disc_number),
            "genre" => json!(track.genre.as_deref()),
            "analysis_provider" => json!(track.analysis_provider.as_deref()),
            "analysis_model" => json!(track.analysis_model.as_deref()),
            "analysis_genre" => json!(track.analysis_genre.as_deref()),
            "analysis_genre_confidence" => json!(track.analysis_genre_confidence),
            "analysis_genre_tags" => json!(track.analysis_genre_tags.as_deref()),
            "analysis_embedding" => json!(track.analysis_embedding.as_deref()),
            "analysis_updated_at" => json!(track.analysis_updated_at.as_deref()),
            "year" => json!(track.year),
            "duration_seconds" => json!(track.duration_seconds),
            "bitrate" => json!(track.bitrate),
            "replaygain_track_gain_db" => json!(track.replaygain_track_gain_db),
            "replaygain_album_gain_db" => json!(track.replaygain_album_gain_db),
            "replaygain_track_peak" => json!(track.replaygain_track_peak),
            "replaygain_album_peak" => json!(track.replaygain_album_peak),
            "audio_fingerprint" => json!(track.audio_fingerprint.as_deref()),
            "acoustic_fingerprint" => json!(track.acoustic_fingerprint.as_deref()),
            "acoustic_fingerprint_updated_at" => {
                json!(track.acoustic_fingerprint_updated_at.as_deref())
            }
            "rating" => json!(track.rating),
            "play_count" => json!(track.play_count),
            "skip_count" => json!(track.skip_count),
            "last_played_at" => json!(track.last_played_at.as_deref()),
            "last_skipped_at" => json!(track.last_skipped_at.as_deref()),
            "date_added" => json!(track.date_added.as_str()),
            "file_modified_at" => json!(track.file_modified_at.as_deref()),
            _ => JsonValue::Null,
        };
        object.insert((*field).to_string(), value);
    }
    object.insert("path_key".to_string(), json_string(path_key));
    JsonValue::Object(object)
}

fn core_metadata_json(track: &DesktopTrack) -> JsonValue {
    json!({
        "title": track.title.as_deref(),
        "artist": track.artist.as_deref(),
        "album": track.album.as_deref(),
        "album_artist": track.album_artist.as_deref(),
        "track_number": track.track_number,
        "disc_number": track.disc_number,
        "genre": track.genre.as_deref(),
        "year": track.year,
        "rating": track.rating,
    })
}

fn path_keys_for_tracks(
    connection: &Connection,
    track_ids: &[i64],
) -> Result<BTreeMap<i64, Option<String>>, String> {
    let mut result = track_ids
        .iter()
        .map(|id| (*id, None))
        .collect::<BTreeMap<_, _>>();
    if track_ids.is_empty() {
        return Ok(result);
    }
    let placeholders = vec!["?"; track_ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT id, path_key FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare Rust tag-backup path-key query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(track_ids.iter()), |row| {
            Ok((
                row.get::<_, i64>("id")?,
                row.get::<_, Option<String>>("path_key")?,
            ))
        })
        .map_err(|error| format!("Could not read Rust tag-backup path keys: {error}"))?;
    for row in rows {
        let (id, path_key) =
            row.map_err(|error| format!("Could not decode Rust tag-backup path key: {error}"))?;
        result.insert(id, path_key);
    }
    Ok(result)
}

fn load_tag_backup(path: &Path) -> Result<JsonValue, String> {
    if !path.is_file() {
        return Err("Tag backup file does not exist".to_string());
    }
    let text =
        fs::read_to_string(path).map_err(|error| format!("Could not read tag backup: {error}"))?;
    let payload = serde_json::from_str::<JsonValue>(&text)
        .map_err(|error| format!("Could not read tag backup: {error}"))?;
    if !payload
        .get("format")
        .and_then(JsonValue::as_str)
        .is_some_and(|format| format == "flac-cafe-tag-backup-v1")
    {
        return Err("Unsupported tag backup format".to_string());
    }
    Ok(payload)
}

fn backup_entry_track(
    connection: &Connection,
    entry: &serde_json::Map<String, JsonValue>,
    allowed_ids: Option<&HashSet<i64>>,
) -> Result<Option<DesktopTrack>, String> {
    let Some(track) = entry.get("track").and_then(JsonValue::as_object) else {
        return Ok(None);
    };
    if let Some(track_id) = track.get("id").and_then(JsonValue::as_i64) {
        if allowed_ids.is_none_or(|ids| ids.contains(&track_id)) {
            let found = connection
                .query_row(
                    &format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE id = ?"),
                    params![track_id],
                    track_from_row,
                )
                .optional()
                .map_err(|error| format!("Could not read tag backup track by id: {error}"))?;
            if found.is_some() {
                return Ok(found);
            }
        }
    }
    if let Some(path_key) = track
        .get("path_key")
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let found = connection
            .query_row(
                &format!("SELECT {TRACK_COLUMNS} FROM tracks WHERE path_key = ?"),
                params![path_key],
                track_from_row,
            )
            .optional()
            .map_err(|error| format!("Could not read tag backup track by path key: {error}"))?;
        if let Some(track) = found {
            if allowed_ids.is_none_or(|ids| ids.contains(&track.id)) {
                return Ok(Some(track));
            }
        }
    }
    Ok(None)
}

fn tag_json_values_equal(current: &JsonValue, restored: &JsonValue) -> bool {
    if current.is_null() && restored.is_null() {
        return true;
    }
    if restored.is_number() && !current.is_null() {
        if let (Some(left), Some(right)) = (coerce_f64(current), coerce_f64(restored)) {
            return (left - right).abs() < 1e-9;
        }
        return false;
    }
    current == restored
}

fn backup_current_values(
    track: &DesktopTrack,
    custom_tags: &BTreeMap<String, Option<String>>,
    include_custom_tags: bool,
) -> JsonValue {
    let mut object = serde_json::Map::new();
    if let JsonValue::Object(core) = core_metadata_json(track) {
        object.extend(core);
    }
    if include_custom_tags {
        for (key, value) in custom_tags {
            object.insert(format!("custom:{key}"), json_string(value.clone()));
        }
    }
    JsonValue::Object(object)
}

fn restored_backup_values(
    entry: &serde_json::Map<String, JsonValue>,
    restore_custom_tags: bool,
) -> Result<JsonValue, String> {
    let mut object = serde_json::Map::new();
    if let Some(metadata) = entry.get("metadata").and_then(JsonValue::as_object) {
        for field in TAG_CORE_FIELDS {
            if let Some(value) = metadata.get(*field) {
                object.insert((*field).to_string(), value.clone());
            }
        }
    }
    if restore_custom_tags {
        if let Some(custom_tags) = entry.get("custom_tags").and_then(JsonValue::as_object) {
            for (key, value) in custom_tags {
                let clean = clean_custom_tag_key(key)?;
                object.insert(format!("custom:{clean}"), value.clone());
            }
        }
    }
    Ok(JsonValue::Object(object))
}

fn tag_backup_undo_payload(
    track: &DesktopTrack,
    custom_tags: &BTreeMap<String, Option<String>>,
    changed_fields: &[String],
) -> JsonValue {
    let mut track_object = serde_json::Map::new();
    if let JsonValue::Object(core) = core_metadata_json(track) {
        track_object.extend(core);
    }
    track_object.insert("id".to_string(), json!(track.id));
    track_object.insert("path".to_string(), json!(track.path.as_str()));
    json!({
        "source": "tag_backup_restore",
        "track": JsonValue::Object(track_object),
        "custom_tags": json_string_map(custom_tags),
        "changed_fields": changed_fields,
    })
}

fn write_tag_backup_restore_undo(
    connection: &Connection,
    batch_id: &str,
    track: &DesktopTrack,
    custom_tags: &BTreeMap<String, Option<String>>,
    changed_fields: &[String],
) -> Result<(), String> {
    let title = track
        .title
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            Path::new(&track.path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("track")
        });
    let payload = tag_backup_undo_payload(track, custom_tags, changed_fields);
    connection
        .execute(
            "INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
             VALUES(?, 'tag_backup_restore', ?, ?)",
            params![
                batch_id,
                format!("Restored tag backup for {title}"),
                payload.to_string()
            ],
        )
        .map_err(|error| format!("Could not write tag backup undo entry: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn create_tag_backup(
    _state: State<'_, DesktopLibraryState>,
    backup_path: Option<String>,
    track_ids: Option<Vec<i64>>,
    include_custom_tags: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopTagBackupResponse, String> {
    let limit = limit.unwrap_or(100_000).clamp(1, 500_000);
    let include_custom_tags = include_custom_tags.unwrap_or(true);
    let created_at = utc_now_rfc3339();
    let target = resolve_tag_backup_path(
        backup_path,
        Some(format!("flac-cafe-tags-{}.json", timestamp_for_file())),
    )?;
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, Some(limit))?;
    let ids = tracks.iter().map(|track| track.id).collect::<Vec<_>>();
    let path_keys = path_keys_for_tracks(&connection, &ids)?;
    let custom_by_track = if include_custom_tags {
        custom_tags_for_tracks(&connection, &ids)?
    } else {
        BTreeMap::new()
    };
    let mut custom_tag_count = 0i64;
    let tracks_json = tracks
        .iter()
        .map(|track| {
            let custom_tags = custom_by_track.get(&track.id).cloned().unwrap_or_default();
            custom_tag_count += custom_tags.len() as i64;
            json!({
                "track": track_backup_json(track, path_keys.get(&track.id).cloned().flatten()),
                "metadata": core_metadata_json(track),
                "custom_tags": json_string_map(&custom_tags),
            })
        })
        .collect::<Vec<_>>();
    let payload = json!({
        "format": "flac-cafe-tag-backup-v1",
        "created_at": created_at,
        "track_count": tracks_json.len(),
        "include_custom_tags": include_custom_tags,
        "tracks": tracks_json,
    });
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create tag backup folder {}: {error}",
                parent.display()
            )
        })?;
    }
    let text = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Could not encode tag backup: {error}"))?;
    fs::write(&target, text).map_err(|error| format!("Could not write tag backup: {error}"))?;
    Ok(DesktopTagBackupResponse {
        backup_path: target.to_string_lossy().to_string(),
        track_count: tracks_json.len() as i64,
        custom_tag_count,
        created_at,
    })
}

#[tauri::command]
pub fn list_tag_backups(
    _state: State<'_, DesktopLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<DesktopTagBackupSummary>, String> {
    let limit = limit.unwrap_or(30).clamp(1, 200);
    let folder = tag_backup_dir();
    if !folder.is_dir() {
        return Ok(Vec::new());
    }
    let mut entries = fs::read_dir(&folder)
        .map_err(|error| {
            format!(
                "Could not read tag backup folder {}: {error}",
                folder.display()
            )
        })?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("json"))
            {
                let modified = entry
                    .metadata()
                    .and_then(|metadata| metadata.modified())
                    .ok();
                Some((path, modified))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| right.1.cmp(&left.1));

    let mut summaries = Vec::new();
    for (path, _) in entries.into_iter().take(limit) {
        let metadata = fs::metadata(&path).ok();
        let payload = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<JsonValue>(&text).ok());
        let created_at = payload
            .as_ref()
            .and_then(|value| value.get("created_at"))
            .and_then(JsonValue::as_str)
            .map(ToOwned::to_owned);
        let track_count = payload
            .as_ref()
            .and_then(|value| value.get("track_count"))
            .and_then(JsonValue::as_i64)
            .unwrap_or(0);
        summaries.push(DesktopTagBackupSummary {
            backup_path: path.to_string_lossy().to_string(),
            file_name: path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string(),
            track_count,
            created_at,
            size_bytes: metadata.map(|value| value.len() as i64).unwrap_or(0),
        });
    }
    Ok(summaries)
}

#[tauri::command]
pub fn restore_tag_backup(
    _state: State<'_, DesktopLibraryState>,
    backup_path: String,
    track_ids: Option<Vec<i64>>,
    missing_only: Option<bool>,
    restore_custom_tags: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopTagBackupRestoreResponse, String> {
    let limit = limit.unwrap_or(10_000).clamp(1, 100_000);
    let source = resolve_tag_backup_path(Some(backup_path), None)?;
    let payload = load_tag_backup(&source)?;
    let entries = payload
        .get("tracks")
        .and_then(JsonValue::as_array)
        .ok_or_else(|| "Tag backup has no tracks".to_string())?;
    let entries = entries.iter().take(limit).collect::<Vec<_>>();
    let allowed_ids =
        track_ids.map(|ids| ids.into_iter().filter(|id| *id > 0).collect::<HashSet<_>>());
    let missing_only = missing_only.unwrap_or(false);
    let restore_custom_tags = restore_custom_tags.unwrap_or(true);
    let apply = apply.unwrap_or(false);
    let batch_id = format!("tag-backup-restore-{}", timestamp_for_file());
    let connection = open_database()?;

    let mut previews = Vec::new();
    let mut errors = Vec::new();
    let mut matched = 0i64;
    let mut changed = 0i64;
    let mut applied = 0i64;
    for entry in &entries {
        let mut preview = DesktopTagBackupRestorePreview {
            track_id: None,
            path: None,
            matched: false,
            changed_fields: Vec::new(),
            current: json!({}),
            restored: json!({}),
            applied: false,
            error: None,
        };
        let Some(entry_object) = entry.as_object() else {
            continue;
        };
        match (|| -> Result<(), String> {
            let Some(track) = backup_entry_track(&connection, entry_object, allowed_ids.as_ref())?
            else {
                return Err("No library track matched this backup entry".to_string());
            };
            preview.track_id = Some(track.id);
            preview.path = Some(track.path.clone());
            preview.matched = true;
            matched += 1;
            let current_custom = custom_tags_for_tracks(&connection, &[track.id])?
                .remove(&track.id)
                .unwrap_or_default();
            let current = backup_current_values(&track, &current_custom, restore_custom_tags);
            let restored = restored_backup_values(entry_object, restore_custom_tags)?;
            let mut changed_fields = Vec::new();
            if let Some(restored_object) = restored.as_object() {
                for (field, restored_value) in restored_object {
                    let current_value = tag_field_value(&track, &current_custom, field)?;
                    if missing_only && !value_missing(&current_value) {
                        continue;
                    }
                    if !tag_json_values_equal(&current_value, restored_value) {
                        changed_fields.push(field.clone());
                    }
                }
            }
            changed_fields.sort();
            preview.current = current;
            preview.restored = restored.clone();
            preview.changed_fields = changed_fields.clone();
            if !changed_fields.is_empty() {
                changed += 1;
            }
            if apply && !changed_fields.is_empty() {
                write_tag_backup_restore_undo(
                    &connection,
                    &batch_id,
                    &track,
                    &current_custom,
                    &changed_fields,
                )?;
                let restored_object = restored
                    .as_object()
                    .ok_or_else(|| "Tag backup restored values are invalid".to_string())?;
                for field in &changed_fields {
                    if let Some(value) = restored_object.get(field) {
                        apply_tag_update(&connection, track.id, field, value)?;
                    }
                }
                preview.applied = true;
                applied += 1;
            }
            Ok(())
        })() {
            Ok(()) => {}
            Err(error) => {
                preview.error = Some(error.clone());
                errors.push(error);
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(DesktopTagBackupRestoreResponse {
        backup_path: source.to_string_lossy().to_string(),
        total: entries.len() as i64,
        matched,
        changed,
        applied,
        errors: errors.into_iter().take(100).collect(),
        previews,
    })
}
