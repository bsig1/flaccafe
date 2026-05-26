fn regex_tag_preset_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DesktopRegexTagPreset> {
    Ok(DesktopRegexTagPreset {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        field: row.get::<_, Option<String>>("field")?.unwrap_or_default(),
        pattern: row.get::<_, Option<String>>("pattern")?.unwrap_or_default(),
        replacement: row
            .get::<_, Option<String>>("replacement")?
            .unwrap_or_default(),
        case_sensitive: row.get::<_, Option<i64>>("case_sensitive")?.unwrap_or(0) != 0,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn virtual_tag_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DesktopVirtualTagDefinition> {
    Ok(DesktopVirtualTagDefinition {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        expression: row
            .get::<_, Option<String>>("expression")?
            .unwrap_or_default(),
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn parse_playlist_ids(raw: Option<String>) -> Vec<i64> {
    let Some(raw) = raw else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<serde_json::Value>>(&raw)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| {
            value.as_i64().or_else(|| {
                value
                    .as_str()
                    .and_then(|text| text.trim().parse::<i64>().ok())
            })
        })
        .filter(|value| *value > 0)
        .collect()
}

fn parse_playlist_rules(raw: Option<String>) -> serde_json::Value {
    raw.and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| json!({}))
}

fn device_sync_profile_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<DesktopDeviceSyncProfile> {
    Ok(DesktopDeviceSyncProfile {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        target_folder: row
            .get::<_, Option<String>>("target_folder")?
            .unwrap_or_default(),
        device_kind: row
            .get::<_, Option<String>>("device_kind")?
            .unwrap_or_else(|| "folder".to_string()),
        music_subfolder: row
            .get::<_, Option<String>>("music_subfolder")?
            .unwrap_or_else(|| "Music".to_string()),
        playlist_subfolder: row
            .get::<_, Option<String>>("playlist_subfolder")?
            .unwrap_or_else(|| "Playlists".to_string()),
        playlist_ids: parse_playlist_ids(row.get("playlist_ids_json")?),
        playlist_rules: parse_playlist_rules(row.get("playlist_rules_json")?),
        copy_files: row.get::<_, Option<i64>>("copy_files")?.unwrap_or(1) != 0,
        export_playlists: row.get::<_, Option<i64>>("export_playlists")?.unwrap_or(1) != 0,
        preserve_structure: row
            .get::<_, Option<i64>>("preserve_structure")?
            .unwrap_or(1)
            != 0,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn android_presets() -> Vec<DesktopDeviceSyncProfilePayload> {
    vec![
        DesktopDeviceSyncProfilePayload {
            name: "Generic Android Music Folder".to_string(),
            target_folder: String::new(),
            device_kind: "android_folder".to_string(),
            music_subfolder: "Music".to_string(),
            playlist_subfolder: "Playlists".to_string(),
            playlist_ids: Vec::new(),
            playlist_rules: json!({"relative_paths": true, "playlist_format": "m3u8"}),
            copy_files: true,
            export_playlists: true,
            preserve_structure: false,
        },
        DesktopDeviceSyncProfilePayload {
            name: "Poweramp Android".to_string(),
            target_folder: String::new(),
            device_kind: "android_folder".to_string(),
            music_subfolder: "Music".to_string(),
            playlist_subfolder: "Playlists".to_string(),
            playlist_ids: Vec::new(),
            playlist_rules: json!({"relative_paths": true, "playlist_format": "m3u8", "path_style": "android"}),
            copy_files: true,
            export_playlists: true,
            preserve_structure: false,
        },
        DesktopDeviceSyncProfilePayload {
            name: "USB Drive Mirror".to_string(),
            target_folder: String::new(),
            device_kind: "usb".to_string(),
            music_subfolder: "Music".to_string(),
            playlist_subfolder: "Playlists".to_string(),
            playlist_ids: Vec::new(),
            playlist_rules: json!({"relative_paths": true, "playlist_format": "m3u8"}),
            copy_files: true,
            export_playlists: true,
            preserve_structure: true,
        },
    ]
}

fn list_device_sync_profiles_for_connection(
    connection: &Connection,
) -> Result<Vec<DesktopDeviceSyncProfile>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                   playlist_ids_json, playlist_rules_json, copy_files, export_playlists,
                   preserve_structure, created_at, updated_at
            FROM device_sync_profiles
            ORDER BY lower(name)
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust device sync profile query: {error}"))?;
    let rows = statement
        .query_map([], device_sync_profile_from_row)
        .map_err(|error| format!("Could not read Rust device sync profiles: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust device sync profiles: {error}"))
}

fn device_sync_profile_by_id(
    connection: &Connection,
    profile_id: i64,
) -> Result<DesktopDeviceSyncProfile, String> {
    connection
        .query_row(
            r#"
            SELECT id, name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                   playlist_ids_json, playlist_rules_json, copy_files, export_playlists,
                   preserve_structure, created_at, updated_at
            FROM device_sync_profiles
            WHERE id = ?
            "#,
            params![profile_id],
            device_sync_profile_from_row,
        )
        .map_err(|error| format!("Device sync profile not found: {error}"))
}

fn device_sync_profile_by_name(
    connection: &Connection,
    name: &str,
) -> Result<DesktopDeviceSyncProfile, String> {
    connection
        .query_row(
            r#"
            SELECT id, name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                   playlist_ids_json, playlist_rules_json, copy_files, export_playlists,
                   preserve_structure, created_at, updated_at
            FROM device_sync_profiles
            WHERE lower(name) = lower(?)
            ORDER BY id DESC
            LIMIT 1
            "#,
            params![name],
            device_sync_profile_from_row,
        )
        .map_err(|error| format!("Device sync profile not found: {error}"))
}

