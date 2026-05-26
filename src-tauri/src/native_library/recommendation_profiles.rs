use super::recommendations::{generate_autodj_response, native_autodj_settings};
use super::types::*;
use super::{app_storage_root, open_database};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

fn value_from_text(text: Option<String>, fallback: serde_json::Value) -> serde_json::Value {
    text.and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .unwrap_or(fallback)
}

fn drift_number(value: &serde_json::Value, key: &str) -> f64 {
    value
        .get(key)
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(0.0)
}

fn drift_i64(value: &serde_json::Value, key: &str) -> i64 {
    value
        .get(key)
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0)
}

fn native_recommendation_drift_from_value(value: serde_json::Value) -> NativeRecommendationDrift {
    let warnings = value
        .get("warnings")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default();
    NativeRecommendationDrift {
        total_tracks: drift_i64(&value, "total_tracks"),
        familiar_percent: drift_number(&value, "familiar_percent"),
        exploration_percent: drift_number(&value, "exploration_percent"),
        repeat_artist_percent: drift_number(&value, "repeat_artist_percent"),
        unrated_percent: drift_number(&value, "unrated_percent"),
        clap_percent: drift_number(&value, "clap_percent"),
        average_rating: value
            .get("average_rating")
            .and_then(serde_json::Value::as_f64),
        unique_artists: drift_i64(&value, "unique_artists"),
        unique_albums: drift_i64(&value, "unique_albums"),
        warnings,
    }
}

fn recommendation_profile_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<NativeRecommendationProfile> {
    let settings_json = value_from_text(row.get("settings_json")?, json!({}));
    Ok(NativeRecommendationProfile {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        settings: native_autodj_settings(settings_json),
        is_default: row.get::<_, Option<i64>>("is_default")?.unwrap_or(0) != 0,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn raw_profile_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<(NativeRecommendationProfile, serde_json::Value)> {
    let settings_json = value_from_text(row.get("settings_json")?, json!({}));
    Ok((
        NativeRecommendationProfile {
            id: row.get("id")?,
            name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
            settings: native_autodj_settings(settings_json.clone()),
            is_default: row.get::<_, Option<i64>>("is_default")?.unwrap_or(0) != 0,
            created_at: row
                .get::<_, Option<String>>("created_at")?
                .unwrap_or_default(),
            updated_at: row
                .get::<_, Option<String>>("updated_at")?
                .unwrap_or_default(),
        },
        settings_json,
    ))
}

fn recommendation_run_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<NativeRecommendationRun> {
    let settings_json = value_from_text(row.get("settings_json")?, json!({}));
    let drift_json = value_from_text(row.get("drift_json")?, json!({}));
    let track_ids = row
        .get::<_, Option<String>>("track_ids_json")?
        .and_then(|raw| serde_json::from_str::<Vec<i64>>(&raw).ok())
        .unwrap_or_default();
    Ok(NativeRecommendationRun {
        id: row.get("id")?,
        settings: native_autodj_settings(settings_json),
        drift: native_recommendation_drift_from_value(drift_json),
        track_ids,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
    })
}

fn list_profiles_for_connection(
    connection: &Connection,
) -> Result<Vec<NativeRecommendationProfile>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, settings_json, is_default, created_at, updated_at
            FROM recommendation_profiles
            ORDER BY is_default DESC, lower(name) ASC
            "#,
        )
        .map_err(|error| {
            format!("Could not prepare native recommendation profile query: {error}")
        })?;
    let rows = statement
        .query_map([], recommendation_profile_from_row)
        .map_err(|error| format!("Could not read native recommendation profiles: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native recommendation profiles: {error}"))
}

fn profile_by_id(
    connection: &Connection,
    profile_id: i64,
) -> Result<NativeRecommendationProfile, String> {
    connection
        .query_row(
            r#"
            SELECT id, name, settings_json, is_default, created_at, updated_at
            FROM recommendation_profiles
            WHERE id = ?
            "#,
            params![profile_id],
            recommendation_profile_from_row,
        )
        .map_err(|error| format!("Recommendation profile not found: {error}"))
}

fn profile_by_name(
    connection: &Connection,
    name: &str,
) -> Result<NativeRecommendationProfile, String> {
    connection
        .query_row(
            r#"
            SELECT id, name, settings_json, is_default, created_at, updated_at
            FROM recommendation_profiles
            WHERE lower(name) = lower(?)
            ORDER BY id DESC
            LIMIT 1
            "#,
            params![name],
            recommendation_profile_from_row,
        )
        .map_err(|error| format!("Recommendation profile not found: {error}"))
}

#[tauri::command]
pub fn native_recommendation_profiles(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativeRecommendationProfile>, String> {
    let connection = open_database()?;
    list_profiles_for_connection(&connection)
}

#[tauri::command]
pub fn native_recommendation_history(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
) -> Result<Vec<NativeRecommendationRun>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(30).clamp(1, 100);
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, settings_json, drift_json, track_ids_json, created_at
            FROM recommendation_runs
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ?
            "#,
        )
        .map_err(|error| {
            format!("Could not prepare native recommendation history query: {error}")
        })?;
    let rows = statement
        .query_map(params![limit as i64], recommendation_run_from_row)
        .map_err(|error| format!("Could not read native recommendation history: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native recommendation history: {error}"))
}

#[tauri::command]
pub fn native_save_recommendation_profile(
    _state: State<'_, NativeLibraryState>,
    profile_id: Option<i64>,
    name: String,
    settings: serde_json::Value,
    is_default: Option<bool>,
) -> Result<NativeRecommendationProfile, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Profile name is required".to_string());
    }
    let is_default = is_default.unwrap_or(false);
    let settings_json = serde_json::to_string(&settings)
        .map_err(|error| format!("Could not serialize recommendation profile settings: {error}"))?;
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native recommendation profile save: {error}"))?;
    if is_default {
        transaction
            .execute("UPDATE recommendation_profiles SET is_default = 0", [])
            .map_err(|error| {
                format!("Could not clear native default recommendation profile: {error}")
            })?;
    }
    match profile_id {
        Some(profile_id) => {
            let exists = transaction
                .query_row(
                    "SELECT id FROM recommendation_profiles WHERE id = ?",
                    params![profile_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()
                .map_err(|error| {
                    format!("Could not verify native recommendation profile: {error}")
                })?
                .is_some();
            if !exists {
                return Err("Recommendation profile not found".to_string());
            }
            transaction
                .execute(
                    r#"
                    UPDATE recommendation_profiles
                    SET name = ?, settings_json = ?, is_default = ?, updated_at = datetime('now')
                    WHERE id = ?
                    "#,
                    params![
                        name,
                        settings_json,
                        if is_default { 1 } else { 0 },
                        profile_id
                    ],
                )
                .map_err(|error| {
                    format!("Could not update native recommendation profile: {error}")
                })?;
        }
        None => {
            transaction
                .execute(
                    r#"
                    INSERT INTO recommendation_profiles(name, settings_json, is_default)
                    VALUES(?, ?, ?)
                    ON CONFLICT(name) DO UPDATE SET
                      settings_json = excluded.settings_json,
                      is_default = excluded.is_default,
                      updated_at = datetime('now')
                    "#,
                    params![name, settings_json, if is_default { 1 } else { 0 }],
                )
                .map_err(|error| {
                    format!("Could not save native recommendation profile: {error}")
                })?;
        }
    }
    if is_default {
        transaction
            .execute(
                "UPDATE recommendation_profiles SET is_default = CASE WHEN lower(name) = lower(?) THEN 1 ELSE 0 END",
                params![name],
            )
            .map_err(|error| format!("Could not mark native default recommendation profile: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit native recommendation profile save: {error}"))?;

    match profile_id {
        Some(profile_id) => profile_by_id(&connection, profile_id),
        None => profile_by_name(&connection, &name),
    }
}

#[tauri::command]
pub fn native_set_default_recommendation_profile(
    _state: State<'_, NativeLibraryState>,
    profile_id: i64,
) -> Result<Vec<NativeRecommendationProfile>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native default profile update: {error}"))?;
    let exists = transaction
        .query_row(
            "SELECT id FROM recommendation_profiles WHERE id = ?",
            params![profile_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| format!("Could not verify native recommendation profile: {error}"))?
        .is_some();
    if !exists {
        return Err("Recommendation profile not found".to_string());
    }
    transaction
        .execute(
            "UPDATE recommendation_profiles SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END",
            params![profile_id],
        )
        .map_err(|error| {
            format!("Could not save native default recommendation profile: {error}")
        })?;
    transaction.commit().map_err(|error| {
        format!("Could not commit native default recommendation profile: {error}")
    })?;
    list_profiles_for_connection(&connection)
}

#[tauri::command]
pub fn native_delete_recommendation_profile(
    _state: State<'_, NativeLibraryState>,
    profile_id: i64,
) -> Result<Vec<NativeRecommendationProfile>, String> {
    let connection = open_database()?;
    connection
        .execute(
            "DELETE FROM recommendation_profiles WHERE id = ?",
            params![profile_id],
        )
        .map_err(|error| format!("Could not delete native recommendation profile: {error}"))?;
    list_profiles_for_connection(&connection)
}

#[tauri::command]
pub fn native_record_recommendation_feedback(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    event_type: String,
    weight: Option<f64>,
) -> Result<NativeStatusResponse, String> {
    if !matches!(
        event_type.as_str(),
        "play_next" | "add_to_queue" | "manual_play"
    ) {
        return Err("Unsupported recommendation feedback event".to_string());
    }
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native recommendation feedback save: {error}"))?;
    let exists = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| format!("Could not verify native recommendation feedback track: {error}"))?
        .is_some();
    if !exists {
        return Err("Track not found".to_string());
    }
    transaction
        .execute(
            r#"
            INSERT INTO recommendation_feedback(track_id, event_type, weight)
            VALUES(?, ?, ?)
            "#,
            params![track_id, event_type, weight.unwrap_or(1.0)],
        )
        .map_err(|error| format!("Could not record native recommendation feedback: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit native recommendation feedback: {error}"))?;
    Ok(NativeStatusResponse {
        status: "ok".to_string(),
    })
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn now_label() -> String {
    format!("{}", now_epoch())
}

fn test_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("rust-{nanos:x}")
}

fn set_json_number(settings: &mut serde_json::Value, key: &str, value: i64) {
    if !settings.is_object() {
        *settings = json!({});
    }
    if let Some(object) = settings.as_object_mut() {
        object.insert(key.to_string(), json!(value));
    }
}

fn set_json_optional_number(settings: &mut serde_json::Value, key: &str, value: Option<i64>) {
    if !settings.is_object() {
        *settings = json!({});
    }
    if let Some(object) = settings.as_object_mut() {
        object.insert(
            key.to_string(),
            value
                .map(serde_json::Value::from)
                .unwrap_or(serde_json::Value::Null),
        );
    }
}

fn challenger_settings(base: &serde_json::Value) -> serde_json::Value {
    let base_settings = native_autodj_settings(base.clone());
    let mut challenger = base.clone();
    if !challenger.is_object() {
        challenger = json!({});
    }
    if let Some(object) = challenger.as_object_mut() {
        object.insert(
            "temperature".to_string(),
            json!((base_settings.temperature + 0.35).min(5.0)),
        );
        object.insert(
            "unrated_exploration_percent".to_string(),
            json!((base_settings.unrated_exploration_percent + 8.0).min(80.0)),
        );
        object.insert(
            "target_unrated_percent".to_string(),
            json!(base_settings
                .target_unrated_percent
                .unwrap_or(base_settings.unrated_exploration_percent)
                .max(base_settings.unrated_exploration_percent + 8.0)
                .min(80.0)),
        );
        object.insert(
            "target_exploration_percent".to_string(),
            json!(base_settings
                .target_exploration_percent
                .unwrap_or(45.0)
                .max(35.0)
                .min(100.0)),
        );
        if base_settings.max_repeat_artist_percent.is_none() {
            object.insert("max_repeat_artist_percent".to_string(), json!(25.0));
        }
    }
    challenger
}

#[tauri::command]
pub fn native_create_recommendation_ab_test(
    _state: State<'_, NativeLibraryState>,
    base_settings: serde_json::Value,
    challenger_settings_json: Option<serde_json::Value>,
    seed_track_id: Option<i64>,
    seed: Option<i64>,
) -> Result<NativeRecommendationAbTestResponse, String> {
    let seed = seed.unwrap_or_else(|| now_epoch() % 1_000_000);
    let mut base = base_settings;
    set_json_number(&mut base, "seed", seed);
    if seed_track_id.is_some() {
        set_json_optional_number(&mut base, "seed_track_id", seed_track_id);
    }
    let mut challenger = challenger_settings_json.unwrap_or_else(|| challenger_settings(&base));
    set_json_number(&mut challenger, "seed", seed + 1);
    if seed_track_id.is_some() {
        set_json_optional_number(&mut challenger, "seed_track_id", seed_track_id);
    }
    let queue_a = generate_autodj_response(base)?;
    let queue_b = generate_autodj_response(challenger)?;
    Ok(NativeRecommendationAbTestResponse {
        test_id: test_id(),
        generated_at: now_label(),
        queues: vec![
            NativeRecommendationAbQueue {
                label: "A".to_string(),
                settings: queue_a.settings,
                drift: queue_a.drift,
                tracks: queue_a.tracks,
            },
            NativeRecommendationAbQueue {
                label: "B".to_string(),
                settings: queue_b.settings,
                drift: queue_b.drift,
                tracks: queue_b.tracks,
            },
        ],
    })
}

#[tauri::command]
pub fn native_choose_recommendation_ab_test(
    _state: State<'_, NativeLibraryState>,
    chosen_label: String,
    chosen_track_ids: Vec<i64>,
    feedback_weight: Option<f64>,
) -> Result<NativeRecommendationAbChoiceResponse, String> {
    if !matches!(chosen_label.as_str(), "A" | "B") {
        return Err("Choose queue A or B".to_string());
    }
    let mut unique_ids = Vec::<i64>::new();
    for track_id in chosen_track_ids.into_iter().filter(|id| *id > 0) {
        if !unique_ids.contains(&track_id) {
            unique_ids.push(track_id);
        }
    }
    if unique_ids.is_empty() {
        return Ok(NativeRecommendationAbChoiceResponse {
            status: "ok".to_string(),
            chosen_label,
            inserted_feedback: 0,
        });
    }
    let connection = open_database()?;
    let placeholders = vec!["?"; unique_ids.len()].join(",");
    let existing = {
        let mut statement = connection
            .prepare(&format!(
                "SELECT id FROM tracks WHERE id IN ({placeholders})"
            ))
            .map_err(|error| {
                format!("Could not prepare native A/B feedback track lookup: {error}")
            })?;
        let rows = statement
            .query_map(rusqlite::params_from_iter(unique_ids.iter()), |row| {
                row.get::<_, i64>(0)
            })
            .map_err(|error| format!("Could not read native A/B feedback tracks: {error}"))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native A/B feedback tracks: {error}"))?
    };
    let mut inserted = 0i64;
    for track_id in unique_ids {
        if !existing.contains(&track_id) {
            continue;
        }
        let count = connection
            .execute(
                "INSERT INTO recommendation_feedback(track_id, event_type, weight)
                 VALUES(?, 'add_to_queue', ?)",
                params![track_id, feedback_weight.unwrap_or(1.0)],
            )
            .map_err(|error| format!("Could not record native A/B feedback: {error}"))?;
        inserted += count as i64;
    }
    Ok(NativeRecommendationAbChoiceResponse {
        status: "ok".to_string(),
        chosen_label,
        inserted_feedback: inserted,
    })
}

fn selected_profile_rows(
    connection: &Connection,
    profile_ids: Option<Vec<i64>>,
) -> Result<Vec<(NativeRecommendationProfile, serde_json::Value)>, String> {
    if let Some(profile_ids) = profile_ids.filter(|ids| !ids.is_empty()) {
        let unique_ids =
            profile_ids
                .into_iter()
                .filter(|id| *id > 0)
                .fold(Vec::<i64>::new(), |mut ids, id| {
                    if !ids.contains(&id) {
                        ids.push(id);
                    }
                    ids
                });
        if unique_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = vec!["?"; unique_ids.len()].join(",");
        let mut statement = connection
            .prepare(&format!(
                "SELECT id, name, settings_json, is_default, created_at, updated_at
                 FROM recommendation_profiles
                 WHERE id IN ({placeholders})
                 ORDER BY is_default DESC, lower(name) ASC"
            ))
            .map_err(|error| {
                format!("Could not prepare native profile comparison query: {error}")
            })?;
        let rows = statement
            .query_map(
                rusqlite::params_from_iter(unique_ids.iter()),
                raw_profile_from_row,
            )
            .map_err(|error| format!("Could not read native profile comparison rows: {error}"))?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode native profile comparison rows: {error}"));
    }
    let mut statement = connection
        .prepare(
            "SELECT id, name, settings_json, is_default, created_at, updated_at
             FROM recommendation_profiles
             ORDER BY is_default DESC, lower(name) ASC
             LIMIT 8",
        )
        .map_err(|error| format!("Could not prepare native profile comparison query: {error}"))?;
    let rows = statement
        .query_map([], raw_profile_from_row)
        .map_err(|error| format!("Could not read native profile comparison rows: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native profile comparison rows: {error}"))
}

fn build_profile_comparisons(
    profile_ids: Option<Vec<i64>>,
    seed_track_id: Option<i64>,
    seed: Option<i64>,
) -> Result<Vec<NativeRecommendationProfileComparison>, String> {
    let connection = open_database()?;
    let rows = selected_profile_rows(&connection, profile_ids)?;
    let mut comparisons = Vec::new();
    for (profile, mut settings_json) in rows.into_iter().take(8) {
        set_json_optional_number(&mut settings_json, "seed_track_id", seed_track_id);
        if let Some(seed) = seed {
            set_json_number(&mut settings_json, "seed", seed);
        }
        let generated = generate_autodj_response(settings_json)?;
        comparisons.push(NativeRecommendationProfileComparison {
            profile,
            drift: generated.drift,
            top_tracks: generated.tracks.into_iter().take(5).collect(),
        });
    }
    Ok(comparisons)
}

#[tauri::command]
pub fn native_compare_recommendation_profiles(
    _state: State<'_, NativeLibraryState>,
    profile_ids: Option<Vec<i64>>,
    seed_track_id: Option<i64>,
    seed: Option<i64>,
) -> Result<Vec<NativeRecommendationProfileComparison>, String> {
    build_profile_comparisons(profile_ids, seed_track_id, seed)
}

#[tauri::command]
pub fn native_export_recommendation_profile_comparison(
    _state: State<'_, NativeLibraryState>,
    profile_ids: Option<Vec<i64>>,
    seed_track_id: Option<i64>,
    seed: Option<i64>,
) -> Result<NativeRecommendationProfileComparisonExportResponse, String> {
    let comparisons = build_profile_comparisons(profile_ids, seed_track_id, seed)?;
    let export_dir = app_storage_root().join("exports");
    std::fs::create_dir_all(&export_dir)
        .map_err(|error| format!("Could not create export folder: {error}"))?;
    let target = export_dir.join(format!("flac-cafe-profile-comparison-{}.json", now_epoch()));
    let payload = json!({
        "generated_at": now_label(),
        "seed": seed,
        "seed_track_id": seed_track_id,
        "comparisons": comparisons,
    });
    let text = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Could not serialize profile comparison: {error}"))?;
    std::fs::write(&target, text)
        .map_err(|error| format!("Could not write profile comparison: {error}"))?;
    Ok(NativeRecommendationProfileComparisonExportResponse {
        export_path: target.to_string_lossy().to_string(),
        profile_count: payload
            .get("comparisons")
            .and_then(serde_json::Value::as_array)
            .map(|items| items.len() as i64)
            .unwrap_or(0),
    })
}

#[tauri::command]
pub fn native_import_recommendation_profile_comparison(
    _state: State<'_, NativeLibraryState>,
    report_path: String,
) -> Result<NativeRecommendationProfileComparisonImportResponse, String> {
    let path = std::path::PathBuf::from(report_path.trim());
    if !path.exists() || !path.is_file() {
        return Err("Recommendation comparison report not found".to_string());
    }
    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("Could not read comparison report: {error}"))?;
    let payload = serde_json::from_str::<serde_json::Value>(&text)
        .map_err(|error| format!("Could not read comparison report: {error}"))?;
    let raw = payload
        .get("comparisons")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "Comparison report is missing a comparisons list".to_string())?;
    let mut comparisons = Vec::new();
    for item in raw {
        comparisons.push(
            serde_json::from_value::<NativeRecommendationProfileComparison>(item.clone())
                .map_err(|error| format!("Invalid comparison entry: {error}"))?,
        );
    }
    Ok(NativeRecommendationProfileComparisonImportResponse {
        report_path: path.to_string_lossy().to_string(),
        generated_at: payload
            .get("generated_at")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
        seed: payload.get("seed").and_then(serde_json::Value::as_i64),
        seed_track_id: payload
            .get("seed_track_id")
            .and_then(serde_json::Value::as_i64),
        comparisons,
    })
}
