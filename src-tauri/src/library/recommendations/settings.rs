use super::types::*;
use super::{open_database, qualified_track_columns, track_by_id, track_from_row};
use rusqlite::{params, Connection};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
fn number_setting(
    settings: &serde_json::Value,
    key: &str,
    default: f64,
    min: f64,
    max: f64,
) -> f64 {
    settings
        .get(key)
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(default)
        .clamp(min, max)
}

fn int_setting(settings: &serde_json::Value, key: &str, default: i64, min: i64, max: i64) -> i64 {
    settings
        .get(key)
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(default)
        .clamp(min, max)
}

fn optional_number_setting(
    settings: &serde_json::Value,
    key: &str,
    min: f64,
    max: f64,
) -> Option<f64> {
    settings
        .get(key)
        .and_then(serde_json::Value::as_f64)
        .map(|value| value.clamp(min, max))
}

fn optional_int_setting(settings: &serde_json::Value, key: &str) -> Option<i64> {
    settings.get(key).and_then(serde_json::Value::as_i64)
}

pub(crate) fn autodj_settings(settings: serde_json::Value) -> DesktopAutoDjSettings {
    DesktopAutoDjSettings {
        queue_length: int_setting(&settings, "queue_length", 25, 1, 200) as usize,
        temperature: number_setting(&settings, "temperature", 0.8, 0.05, 5.0),
        artist_cooldown: int_setting(&settings, "artist_cooldown", 6, 0, 50) as usize,
        album_cooldown: int_setting(&settings, "album_cooldown", 10, 0, 100) as usize,
        unrated_exploration_percent: number_setting(
            &settings,
            "unrated_exploration_percent",
            12.0,
            0.0,
            80.0,
        ),
        target_unrated_percent: optional_number_setting(
            &settings,
            "target_unrated_percent",
            0.0,
            80.0,
        ),
        target_exploration_percent: optional_number_setting(
            &settings,
            "target_exploration_percent",
            0.0,
            100.0,
        ),
        max_repeat_artist_percent: optional_number_setting(
            &settings,
            "max_repeat_artist_percent",
            0.0,
            95.0,
        ),
        minimum_rating: optional_number_setting(&settings, "minimum_rating", 0.5, 5.0),
        recently_played_cooldown_days: int_setting(
            &settings,
            "recently_played_cooldown_days",
            14,
            0,
            3650,
        ),
        seed_track_id: optional_int_setting(&settings, "seed_track_id"),
        similarity_weight: number_setting(&settings, "similarity_weight", 0.0, 0.0, 5.0),
        rating_weight: number_setting(&settings, "rating_weight", 1.0, 0.0, 5.0),
        recency_weight: number_setting(&settings, "recency_weight", 1.0, 0.0, 5.0),
        skip_weight: number_setting(&settings, "skip_weight", 1.0, 0.0, 5.0),
        exploration_weight: number_setting(&settings, "exploration_weight", 1.0, 0.0, 5.0),
        play_history_weight: number_setting(&settings, "play_history_weight", 0.7, 0.0, 5.0),
        feedback_weight: number_setting(&settings, "feedback_weight", 0.8, 0.0, 5.0),
        audio_similarity_weight: number_setting(
            &settings,
            "audio_similarity_weight",
            2.2,
            0.0,
            5.0,
        ),
        artist_similarity_weight: number_setting(
            &settings,
            "artist_similarity_weight",
            1.6,
            0.0,
            5.0,
        ),
        album_similarity_weight: number_setting(
            &settings,
            "album_similarity_weight",
            0.9,
            0.0,
            5.0,
        ),
        genre_similarity_weight: number_setting(
            &settings,
            "genre_similarity_weight",
            0.85,
            0.0,
            5.0,
        ),
        year_similarity_weight: number_setting(&settings, "year_similarity_weight", 0.45, 0.0, 5.0),
        rating_similarity_weight: number_setting(
            &settings,
            "rating_similarity_weight",
            0.25,
            0.0,
            5.0,
        ),
        seed: optional_int_setting(&settings, "seed"),
    }
}

fn autodj_avoid_rules_for_connection(
    connection: &Connection,
) -> Result<Vec<DesktopAutoDjAvoidRule>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, scope, target_key, label, created_at, updated_at
             FROM autodj_avoid_rules
             ORDER BY scope, lower(label)",
        )
        .map_err(|error| format!("Could not prepare Rust AutoDJ avoid query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(DesktopAutoDjAvoidRule {
                id: row.get("id")?,
                scope: row.get::<_, Option<String>>("scope")?.unwrap_or_default(),
                target_key: row
                    .get::<_, Option<String>>("target_key")?
                    .unwrap_or_default(),
                label: row.get::<_, Option<String>>("label")?.unwrap_or_default(),
                created_at: row
                    .get::<_, Option<String>>("created_at")?
                    .unwrap_or_default(),
                updated_at: row
                    .get::<_, Option<String>>("updated_at")?
                    .unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Could not read Rust AutoDJ avoid rules: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust AutoDJ avoid rules: {error}"))
}

fn avoid_key_and_label(
    connection: &Connection,
    scope: &str,
    track_id: Option<i64>,
    value: Option<String>,
) -> Result<(String, String), String> {
    let track = match track_id {
        Some(track_id) => Some(track_by_id(connection, track_id)?),
        None => None,
    };
    let value = value.unwrap_or_default().trim().to_string();
    match scope {
        "track" => {
            let track = track.ok_or_else(|| "Track avoid rules require track_id".to_string())?;
            let label = format!(
                "{} - {}",
                track.title.as_deref().unwrap_or("Untitled"),
                track.artist.as_deref().unwrap_or("Unknown artist")
            );
            Ok((track.id.to_string(), label))
        }
        "artist" => {
            let label = if value.is_empty() {
                track
                    .as_ref()
                    .and_then(|track| track.artist.clone())
                    .unwrap_or_default()
            } else {
                value
            };
            let key = split_artist_tokens(Some(&label))
                .into_iter()
                .min()
                .unwrap_or_else(|| normalize_token(Some(&label)));
            if key.is_empty() {
                return Err("No artist value available".to_string());
            }
            Ok((key, label))
        }
        "album" => {
            let label = if value.is_empty() {
                track
                    .as_ref()
                    .and_then(|track| track.album.clone())
                    .unwrap_or_default()
            } else {
                value
            };
            let key = album_key(Some(&label));
            if key.is_empty() {
                return Err("No album value available".to_string());
            }
            Ok((key, label))
        }
        "genre" => {
            let label = if value.is_empty() {
                track
                    .as_ref()
                    .and_then(|track| track.analysis_genre.clone().or(track.genre.clone()))
                    .unwrap_or_default()
            } else {
                value
            };
            let key = split_text_tokens(Some(&label))
                .into_iter()
                .min()
                .unwrap_or_else(|| normalize_token(Some(&label)));
            if key.is_empty() {
                return Err("No genre value available".to_string());
            }
            Ok((key, label))
        }
        _ => Err("Unsupported AutoDJ avoid scope".to_string()),
    }
}

#[tauri::command]
pub fn autodj_avoid_rules(
    _state: State<'_, DesktopLibraryState>,
) -> Result<Vec<DesktopAutoDjAvoidRule>, String> {
    let connection = open_database()?;
    autodj_avoid_rules_for_connection(&connection)
}

#[tauri::command]
pub fn create_autodj_avoid_rule(
    _state: State<'_, DesktopLibraryState>,
    scope: String,
    track_id: Option<i64>,
    value: Option<String>,
) -> Result<DesktopAutoDjAvoidRule, String> {
    let mut connection = open_database()?;
    let (key, label) = avoid_key_and_label(&connection, &scope, track_id, value)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust AutoDJ avoid update: {error}"))?;
    transaction
        .execute(
            "INSERT INTO autodj_avoid_rules(scope, target_key, label)
             VALUES(?, ?, ?)
             ON CONFLICT(scope, target_key) DO UPDATE SET label = excluded.label, updated_at = datetime('now')",
            params![scope, key, label],
        )
        .map_err(|error| format!("Could not save Rust AutoDJ avoid rule: {error}"))?;
    let row = transaction
        .query_row(
            "SELECT id, scope, target_key, label, created_at, updated_at
             FROM autodj_avoid_rules
             WHERE scope = ? AND target_key = ?",
            params![scope, key],
            |row| {
                Ok(DesktopAutoDjAvoidRule {
                    id: row.get("id")?,
                    scope: row.get::<_, Option<String>>("scope")?.unwrap_or_default(),
                    target_key: row
                        .get::<_, Option<String>>("target_key")?
                        .unwrap_or_default(),
                    label: row.get::<_, Option<String>>("label")?.unwrap_or_default(),
                    created_at: row
                        .get::<_, Option<String>>("created_at")?
                        .unwrap_or_default(),
                    updated_at: row
                        .get::<_, Option<String>>("updated_at")?
                        .unwrap_or_default(),
                })
            },
        )
        .map_err(|error| format!("Could not read Rust AutoDJ avoid rule: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust AutoDJ avoid transaction: {error}"))?;
    Ok(row)
}

#[tauri::command]
pub fn delete_autodj_avoid_rule(
    _state: State<'_, DesktopLibraryState>,
    rule_id: i64,
) -> Result<Vec<DesktopAutoDjAvoidRule>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust AutoDJ avoid delete: {error}"))?;
    transaction
        .execute(
            "DELETE FROM autodj_avoid_rules WHERE id = ?",
            params![rule_id],
        )
        .map_err(|error| format!("Could not delete Rust AutoDJ avoid rule: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save Rust AutoDJ avoid delete: {error}"))?;
    autodj_avoid_rules_for_connection(&connection)
}

