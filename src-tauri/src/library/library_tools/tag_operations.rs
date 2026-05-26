#[tauri::command]
pub fn custom_tags(
    _state: State<'_, DesktopLibraryState>,
    action: Option<String>,
    tag_key: String,
    value: Option<String>,
    track_ids: Option<Vec<i64>>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopCustomTagBatchResponse, String> {
    let action = action.unwrap_or_else(|| "set".to_string());
    let tag_key = clean_custom_tag_key(&tag_key)?;
    let requested_value = if action == "delete" {
        None
    } else {
        value
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty())
    };
    let apply = apply.unwrap_or(false);
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, limit)?;
    let ids: Vec<i64> = tracks.iter().map(|track| track.id).collect();
    let custom_by_track = custom_tags_for_tracks(&connection, &ids)?;
    let mut previews = Vec::new();
    let mut changed = 0i64;
    let mut applied = 0i64;
    for track in tracks {
        let current = custom_tag_value(
            custom_by_track
                .get(&track.id)
                .unwrap_or(&Default::default()),
            &tag_key,
        );
        let changed_here = current != requested_value;
        let mut preview = DesktopCustomTagBatchPreview {
            track_id: track.id,
            path: track.path,
            tag_key: tag_key.clone(),
            current,
            value: requested_value.clone(),
            changed: changed_here,
            applied: false,
            error: None,
        };
        if changed_here {
            changed += 1;
            if apply {
                match update_custom_tag(&connection, track.id, &tag_key, requested_value.clone()) {
                    Ok(()) => {
                        preview.applied = true;
                        applied += 1;
                    }
                    Err(error) => preview.error = Some(error),
                }
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(DesktopCustomTagBatchResponse {
        total: previews.len() as i64,
        changed,
        applied,
        previews,
    })
}

fn virtual_tag_value(
    token: &str,
    track: &DesktopTrack,
    custom_tags: &std::collections::BTreeMap<String, Option<String>>,
) -> Result<String, String> {
    let key = token.trim();
    if key.to_ascii_lowercase().starts_with("custom:") {
        let custom_key =
            clean_custom_tag_key(key.split_once(':').map(|(_, rest)| rest).unwrap_or(""))?;
        return Ok(custom_tag_value(custom_tags, &custom_key).unwrap_or_default());
    }
    match tag_field_alias(key).as_str() {
        "title" => Ok(track.title.clone().unwrap_or_default()),
        "artist" => Ok(track.artist.clone().unwrap_or_default()),
        "album" => Ok(track.album.clone().unwrap_or_default()),
        "album_artist" => Ok(track.album_artist.clone().unwrap_or_default()),
        "track_number" => Ok(track
            .track_number
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "disc_number" => Ok(track
            .disc_number
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "genre" => Ok(track.genre.clone().unwrap_or_default()),
        "year" => Ok(track
            .year
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "rating" => Ok(track
            .rating
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "album_artist_or_artist" | "albumartistorartist" => Ok(track
            .album_artist
            .clone()
            .or_else(|| track.artist.clone())
            .unwrap_or_default()),
        "filename" => Ok(std::path::Path::new(&track.path)
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string()),
        "folder" => Ok(std::path::Path::new(&track.path)
            .parent()
            .and_then(|path| path.file_name())
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string()),
        "extension" => Ok(std::path::Path::new(&track.path)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()),
        "decade" => Ok(track
            .year
            .map(|year| format!("{}s", (year / 10) * 10))
            .unwrap_or_default()),
        "rating_bucket" => Ok(match track.rating {
            Some(value) if value >= 4.5 => "Favorite",
            Some(value) if value >= 3.5 => "Liked",
            Some(value) if value >= 2.5 => "Neutral",
            Some(_) => "Low priority",
            None => "Unrated",
        }
        .to_string()),
        _ => Err(format!("Unknown token: {token}")),
    }
}

#[tauri::command]
pub fn virtual_tag_preview(
    _state: State<'_, DesktopLibraryState>,
    expression: String,
    track_ids: Option<Vec<i64>>,
    limit: Option<usize>,
) -> Result<DesktopVirtualTagPreviewResponse, String> {
    let token_re = Regex::new(r"<([^<>]+)>|\{([^{}]+)\}")
        .map_err(|error| format!("Could not compile virtual tag parser: {error}"))?;
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, limit)?;
    let ids: Vec<i64> = tracks.iter().map(|track| track.id).collect();
    let custom_by_track = custom_tags_for_tracks(&connection, &ids)?;
    let mut previews = Vec::new();
    for track in tracks {
        let custom_tags = custom_by_track.get(&track.id).cloned().unwrap_or_default();
        let mut error = None;
        let mut rendered = String::new();
        let mut last = 0usize;
        for captures in token_re.captures_iter(&expression) {
            let Some(full) = captures.get(0) else {
                continue;
            };
            rendered.push_str(&expression[last..full.start()]);
            let token = captures
                .get(1)
                .or_else(|| captures.get(2))
                .map(|value| value.as_str())
                .unwrap_or_default();
            match virtual_tag_value(token, &track, &custom_tags) {
                Ok(value) => rendered.push_str(&value),
                Err(message) => {
                    error = Some(message);
                    rendered.clear();
                    break;
                }
            }
            last = full.end();
        }
        if error.is_none() {
            rendered.push_str(&expression[last..]);
        }
        previews.push(DesktopVirtualTagPreview {
            track_id: track.id,
            path: track.path,
            title: track.title,
            value: if error.is_none() {
                Some(rendered)
            } else {
                None
            },
            error,
        });
    }
    Ok(DesktopVirtualTagPreviewResponse {
        expression,
        total: previews.len() as i64,
        previews,
    })
}

#[tauri::command]
pub fn copy_swap_tags(
    _state: State<'_, DesktopLibraryState>,
    action: Option<String>,
    source_field: String,
    target_field: String,
    track_ids: Option<Vec<i64>>,
    missing_only: Option<bool>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopTagFieldCopySwapResponse, String> {
    parse_tag_field_ref(&source_field)?;
    parse_tag_field_ref(&target_field)?;
    if source_field
        .trim()
        .eq_ignore_ascii_case(target_field.trim())
    {
        return Err("Choose two different fields".to_string());
    }
    let action = action.unwrap_or_else(|| "copy".to_string());
    let apply = apply.unwrap_or(false);
    let missing_only = missing_only.unwrap_or(false);
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, limit)?;
    let ids: Vec<i64> = tracks.iter().map(|track| track.id).collect();
    let custom_by_track = custom_tags_for_tracks(&connection, &ids)?;
    let mut previews = Vec::new();
    let mut changed = 0i64;
    let mut applied = 0i64;
    for track in tracks {
        let custom_tags = custom_by_track.get(&track.id).cloned().unwrap_or_default();
        let current_source = tag_field_value(&track, &custom_tags, &source_field)?;
        let current_target = tag_field_value(&track, &custom_tags, &target_field)?;
        let mut new_source = if action == "swap" {
            current_target.clone()
        } else {
            current_source.clone()
        };
        let mut new_target = current_source.clone();
        if action != "swap" && missing_only && !value_missing(&current_target) {
            new_target = current_target.clone();
        }
        if action != "swap" {
            new_source = current_source.clone();
        }
        let changed_here = new_source != current_source || new_target != current_target;
        let mut preview = DesktopTagFieldCopySwapPreview {
            track_id: track.id,
            path: track.path,
            source_field: source_field.clone(),
            target_field: target_field.clone(),
            current_source,
            current_target,
            new_source: new_source.clone(),
            new_target: new_target.clone(),
            changed: changed_here,
            applied: false,
            error: None,
        };
        if changed_here {
            changed += 1;
            if apply {
                let result = (|| {
                    apply_tag_update(&connection, track.id, &target_field, &new_target)?;
                    if action == "swap" {
                        apply_tag_update(&connection, track.id, &source_field, &new_source)?;
                    }
                    Ok::<(), String>(())
                })();
                match result {
                    Ok(()) => {
                        preview.applied = true;
                        applied += 1;
                    }
                    Err(error) => preview.error = Some(error),
                }
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(DesktopTagFieldCopySwapResponse {
        total: previews.len() as i64,
        changed,
        applied,
        previews,
    })
}

#[tauri::command]
pub fn regex_tags(
    _state: State<'_, DesktopLibraryState>,
    field: String,
    pattern: String,
    replacement: String,
    case_sensitive: Option<bool>,
    track_ids: Option<Vec<i64>>,
    apply: Option<bool>,
    limit: Option<usize>,
) -> Result<DesktopTagRegexReplaceResponse, String> {
    let (_, field_name) = parse_tag_field_ref(&field)?;
    if !REGEX_PRESET_FIELDS.contains(&field_name.as_str()) {
        return Err("Regex tag replacement only supports text metadata fields".to_string());
    }
    let expression = RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive.unwrap_or(false))
        .build()
        .map_err(|error| format!("Invalid regular expression: {error}"))?;
    let apply = apply.unwrap_or(false);
    let connection = open_database()?;
    let tracks = select_tool_tracks(&connection, track_ids, limit)?;
    let mut previews = Vec::new();
    let mut changed = 0i64;
    let mut applied = 0i64;
    for track in tracks {
        let current = match field_name.as_str() {
            "title" => track.title.clone(),
            "artist" => track.artist.clone(),
            "album" => track.album.clone(),
            "album_artist" => track.album_artist.clone(),
            "genre" => track.genre.clone(),
            _ => None,
        };
        let replacement_value = current.as_ref().map(|text| {
            expression
                .replace_all(text, replacement.as_str())
                .to_string()
        });
        let changed_here = current.is_some() && replacement_value != current;
        let mut preview = DesktopTagRegexReplacePreview {
            track_id: track.id,
            path: track.path,
            field: field_name.clone(),
            current,
            replacement: replacement_value.clone(),
            changed: changed_here,
            applied: false,
            error: None,
        };
        if changed_here {
            changed += 1;
            if apply {
                match apply_tag_update(
                    &connection,
                    track.id,
                    &field_name,
                    &json_string(replacement_value),
                ) {
                    Ok(()) => {
                        preview.applied = true;
                        applied += 1;
                    }
                    Err(error) => preview.error = Some(error),
                }
            }
        }
        previews.push(preview);
    }
    if applied > 0 {
        clear_query_cache(&connection);
    }
    Ok(DesktopTagRegexReplaceResponse {
        total: previews.len() as i64,
        changed,
        applied,
        previews,
    })
}

