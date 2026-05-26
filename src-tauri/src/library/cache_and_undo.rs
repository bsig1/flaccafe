#[tauri::command]
pub fn clear_library_caches(
    _state: State<'_, DesktopLibraryState>,
    targets: Vec<String>,
) -> Result<DesktopCacheClearResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust cache clear: {error}"))?;
    let mut cleared = BTreeMap::new();
    for target in targets {
        let table = match target.as_str() {
            "artist" => "artist_info_cache",
            "artwork" => "artwork_cache",
            "metadata" => "track_metadata_cache",
            "recommendation_history" => "recommendation_runs",
            "scan_errors" => "scan_error_samples",
            _ => return Err(format!("Unsupported cache target: {target}")),
        };
        if cleared.contains_key(&target) {
            continue;
        }
        let count = transaction
            .execute(&format!("DELETE FROM {table}"), [])
            .map_err(|error| format!("Could not clear Rust cache target {target}: {error}"))?;
        cleared.insert(target, count as i64);
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust cache clear: {error}"))?;
    Ok(DesktopCacheClearResponse { cleared })
}

#[tauri::command]
pub fn bulk_undo_log(
    _state: State<'_, DesktopLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<DesktopBulkUndoLogEntry>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(30).clamp(1, 200);
    let mut statement = connection
        .prepare(
            "SELECT id, batch_id, action_type, summary, payload_json, created_at
             FROM bulk_action_undo_log
             ORDER BY datetime(created_at) DESC, id DESC
             LIMIT ?",
        )
        .map_err(|error| format!("Could not prepare Rust undo log query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], |row| {
            let payload_text = row
                .get::<_, Option<String>>("payload_json")?
                .unwrap_or_default();
            let payload = serde_json::from_str(&payload_text).unwrap_or_else(|_| json!({}));
            Ok(DesktopBulkUndoLogEntry {
                id: row.get("id")?,
                batch_id: row.get("batch_id")?,
                action_type: row
                    .get::<_, Option<String>>("action_type")?
                    .unwrap_or_default(),
                summary: row.get::<_, Option<String>>("summary")?.unwrap_or_default(),
                payload,
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Could not read Rust undo log: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust undo log: {error}"))
}

#[tauri::command]
pub fn bulk_undo_batches(
    _state: State<'_, DesktopLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<DesktopBulkUndoBatchEntry>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(30).clamp(1, 200);
    let mut statement = connection
        .prepare(
            "SELECT batch_id,
                    action_type,
                    count(*) AS entries,
                    min(created_at) AS first_created_at,
                    max(created_at) AS last_created_at,
                    min(summary) AS summary
             FROM bulk_action_undo_log
             WHERE batch_id IS NOT NULL AND trim(batch_id) <> ''
               AND action_type IN (
                 'csv_metadata_import', 'regex_metadata_replace', 'musicbrainz_auto_tag',
                 'file_organization', 'track_remove', 'advanced_tag_edit', 'tag_backup_restore',
                 'sqlite_file_tag_write'
               )
             GROUP BY batch_id, action_type
             ORDER BY datetime(max(created_at)) DESC, max(id) DESC
             LIMIT ?",
        )
        .map_err(|error| format!("Could not prepare Rust undo batch query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], |row| {
            Ok(DesktopBulkUndoBatchEntry {
                batch_id: row
                    .get::<_, Option<String>>("batch_id")?
                    .unwrap_or_default(),
                action_type: row
                    .get::<_, Option<String>>("action_type")?
                    .unwrap_or_default(),
                entries: row.get::<_, Option<i64>>("entries")?.unwrap_or(0),
                summary: row.get::<_, Option<String>>("summary")?.unwrap_or_default(),
                first_created_at: row
                    .get::<_, Option<String>>("first_created_at")?
                    .unwrap_or_default(),
                last_created_at: row
                    .get::<_, Option<String>>("last_created_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Could not read Rust undo batches: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust undo batches: {error}"))
}

