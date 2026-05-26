#[tauri::command]
pub fn regex_tag_presets(
    _state: State<'_, DesktopLibraryState>,
) -> Result<Vec<DesktopRegexTagPreset>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, field, pattern, replacement, case_sensitive, created_at, updated_at
            FROM regex_tag_presets
            ORDER BY lower(name)
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust regex preset query: {error}"))?;
    let rows = statement
        .query_map([], regex_tag_preset_from_row)
        .map_err(|error| format!("Could not read Rust regex presets: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust regex presets: {error}"))
}

#[tauri::command]
pub fn save_regex_tag_preset(
    _state: State<'_, DesktopLibraryState>,
    name: String,
    field: String,
    pattern: String,
    replacement: Option<String>,
    case_sensitive: Option<bool>,
) -> Result<DesktopRegexTagPreset, String> {
    let name = non_empty_trimmed(name, "Regex preset name", 80)?;
    let field = field.trim().to_string();
    if !REGEX_PRESET_FIELDS.contains(&field.as_str()) {
        return Err("Unsupported regex preset field".to_string());
    }
    let pattern = non_empty_trimmed(pattern, "Regex pattern", 500)?;
    let replacement = replacement
        .unwrap_or_default()
        .chars()
        .take(500)
        .collect::<String>();
    let connection = open_database()?;
    connection
        .execute(
            r#"
            INSERT INTO regex_tag_presets(name, field, pattern, replacement, case_sensitive, updated_at)
            VALUES(?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(name) DO UPDATE SET
              field = excluded.field,
              pattern = excluded.pattern,
              replacement = excluded.replacement,
              case_sensitive = excluded.case_sensitive,
              updated_at = datetime('now')
            "#,
            params![
                name,
                field,
                pattern,
                replacement,
                if case_sensitive.unwrap_or(false) { 1 } else { 0 }
            ],
        )
        .map_err(|error| format!("Could not save Rust regex preset: {error}"))?;
    connection
        .query_row(
            r#"
            SELECT id, name, field, pattern, replacement, case_sensitive, created_at, updated_at
            FROM regex_tag_presets
            WHERE lower(name) = lower(?)
            "#,
            params![name],
            regex_tag_preset_from_row,
        )
        .map_err(|error| format!("Could not read saved Rust regex preset: {error}"))
}

#[tauri::command]
pub fn delete_regex_tag_preset(
    _state: State<'_, DesktopLibraryState>,
    preset_id: i64,
) -> Result<DesktopDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM regex_tag_presets WHERE id = ?",
            params![preset_id],
        )
        .map_err(|error| format!("Could not delete Rust regex preset: {error}"))?;
    if deleted == 0 {
        return Err("Regex preset was not found".to_string());
    }
    Ok(DesktopDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn virtual_tags(
    _state: State<'_, DesktopLibraryState>,
) -> Result<Vec<DesktopVirtualTagDefinition>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, expression, created_at, updated_at
            FROM virtual_tag_definitions
            ORDER BY lower(name)
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust virtual tag query: {error}"))?;
    let rows = statement
        .query_map([], virtual_tag_from_row)
        .map_err(|error| format!("Could not read Rust virtual tags: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust virtual tags: {error}"))
}

#[tauri::command]
pub fn save_virtual_tag(
    _state: State<'_, DesktopLibraryState>,
    name: String,
    expression: String,
) -> Result<DesktopVirtualTagDefinition, String> {
    let name = non_empty_trimmed(name, "Virtual tag name", 80)?;
    let expression = non_empty_trimmed(expression, "Virtual tag expression", 500)?;
    let connection = open_database()?;
    connection
        .execute(
            r#"
            INSERT INTO virtual_tag_definitions(name, expression, updated_at)
            VALUES(?, ?, datetime('now'))
            ON CONFLICT(name) DO UPDATE SET
              expression = excluded.expression,
              updated_at = datetime('now')
            "#,
            params![name, expression],
        )
        .map_err(|error| format!("Could not save Rust virtual tag: {error}"))?;
    connection
        .query_row(
            r#"
            SELECT id, name, expression, created_at, updated_at
            FROM virtual_tag_definitions
            WHERE lower(name) = lower(?)
            "#,
            params![name],
            virtual_tag_from_row,
        )
        .map_err(|error| format!("Could not read saved Rust virtual tag: {error}"))
}

#[tauri::command]
pub fn delete_virtual_tag(
    _state: State<'_, DesktopLibraryState>,
    definition_id: i64,
) -> Result<DesktopDeletedResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM virtual_tag_definitions WHERE id = ?",
            params![definition_id],
        )
        .map_err(|error| format!("Could not delete Rust virtual tag: {error}"))?;
    if deleted == 0 {
        return Err("Virtual tag was not found".to_string());
    }
    Ok(DesktopDeletedResponse { deleted: true })
}

#[tauri::command]
pub fn infer_filename_tags(
    _state: State<'_, DesktopLibraryState>,
    pattern: String,
    track_ids: Option<Vec<i64>>,
    missing_only: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopFilenameTagInferenceResponse, String> {
    let connection = open_database()?;
    let missing_only = missing_only.unwrap_or(true);
    let apply = apply.unwrap_or(false);
    let limit = limit.unwrap_or(200).clamp(1, 10_000);
    let library_root = super::get_setting(&connection, "library_path")
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from);
    let tracks = select_tool_tracks(&connection, track_ids, Some(limit))?;
    let mut previews = Vec::new();
    let mut matches = 0i64;
    let mut applied = 0i64;
    for track in tracks {
        let current = filename_current_metadata(&track);
        let inferred = infer_metadata_from_filename(
            Path::new(&track.path),
            &pattern,
            library_root.as_deref(),
        )?
        .unwrap_or_else(|| json!({}));
        let matched = inferred
            .as_object()
            .is_some_and(|object| !object.is_empty());
        if matched {
            matches += 1;
        }
        let changed_fields = if matched {
            filename_changed_fields(&current, &inferred, missing_only)
        } else {
            Vec::new()
        };
        let mut preview = DesktopFilenameTagInferencePreview {
            track_id: track.id,
            path: track.path.clone(),
            matched,
            current,
            inferred: inferred.clone(),
            changed_fields: changed_fields.clone(),
            accepted: true,
            applied: false,
            error: None,
        };
        if apply && !changed_fields.is_empty() {
            for field in &changed_fields {
                if let Some(value) = inferred.get(field) {
                    if let Err(error) = update_core_field(&connection, track.id, field, value) {
                        preview.error = Some(error);
                        break;
                    }
                }
            }
            if preview.error.is_none() {
                preview.applied = true;
                applied += 1;
            }
        }
        previews.push(preview);
    }
    if apply && applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(DesktopFilenameTagInferenceResponse {
        total: previews.len() as i64,
        matches,
        applied,
        previews,
    })
}

