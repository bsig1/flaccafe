use rusqlite::types::Value as SqlValue;
use rusqlite::{params, params_from_iter, Connection};
use serde_json::{json, Value as JsonValue};
use std::path::{Path, PathBuf};
use tauri::State;

use super::metadata;
use super::scan;
use super::types::*;
use super::{open_database, track_by_id, TRACK_COLUMNS};

const REMOVE_COLUMNS: &[&str] = &[
    "path_key",
    "id",
    "path",
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

struct RemovalPlan {
    id: i64,
    path: String,
    path_key: String,
    title: Option<String>,
    snapshot: JsonValue,
}

pub fn native_delete_track(
    state: State<'_, NativeLibraryState>,
    track_id: i64,
    delete_file: bool,
) -> Result<NativeTrackDeleteResponse, String> {
    let response = native_delete_tracks(state, vec![track_id], delete_file)?;
    Ok(NativeTrackDeleteResponse {
        track_id,
        removed_from_library: response.removed_track_ids.contains(&track_id),
        deleted_file: response.deleted_files > 0,
        file_missing: response.missing_track_ids.contains(&track_id),
    })
}

pub fn native_delete_tracks(
    _state: State<'_, NativeLibraryState>,
    track_ids: Vec<i64>,
    delete_file: bool,
) -> Result<NativeTracksDeleteResponse, String> {
    let mut unique_ids = Vec::new();
    for track_id in track_ids.into_iter().filter(|track_id| *track_id > 0) {
        if !unique_ids.contains(&track_id) {
            unique_ids.push(track_id);
        }
    }
    if unique_ids.is_empty() {
        return Ok(NativeTracksDeleteResponse {
            removed_track_ids: Vec::new(),
            removed_count: 0,
            deleted_files: 0,
            missing_track_ids: Vec::new(),
            errors: Vec::new(),
        });
    }

    let mut connection = open_database()?;
    let plans = removal_plans(&connection, &unique_ids)?;
    let mut errors = Vec::new();
    for missing in unique_ids
        .iter()
        .filter(|id| !plans.iter().any(|plan| &plan.id == *id))
    {
        errors.push(format!("Track {missing} was not found"));
    }

    let mut deleted_files = 0i64;
    let mut missing_track_ids = Vec::new();
    let mut removable = Vec::new();
    for plan in plans {
        if delete_file {
            let path = PathBuf::from(&plan.path);
            if path.exists() && path.is_file() {
                match trash::delete(&path) {
                    Ok(()) => deleted_files += 1,
                    Err(error) => {
                        errors.push(format!(
                            "Could not send {} to the recycle bin: {error}",
                            path.display()
                        ));
                        continue;
                    }
                }
            } else {
                missing_track_ids.push(plan.id);
            }
        }
        removable.push(plan);
    }

    let batch_id = format!("track-delete-{}", unix_seconds());
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start track delete: {error}"))?;
    let mut removed_track_ids = Vec::new();
    for plan in &removable {
        let summary = plan
            .title
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(&plan.path);
        transaction
            .execute(
                "INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
                 VALUES(?, 'track_remove', ?, ?)",
                params![
                    batch_id,
                    format!("Deleted {summary}"),
                    json!({"track": plan.snapshot, "delete_file": delete_file}).to_string()
                ],
            )
            .map_err(|error| format!("Could not save delete undo entry: {error}"))?;
        let _ = transaction.execute(
            "DELETE FROM track_metadata_cache WHERE path_key = ?",
            params![plan.path_key],
        );
        let _ = transaction.execute(
            "DELETE FROM artwork_cache WHERE path_key = ?",
            params![plan.path_key],
        );
        let removed = transaction
            .execute("DELETE FROM tracks WHERE id = ?", params![plan.id])
            .map_err(|error| format!("Could not remove track {}: {error}", plan.id))?;
        if removed > 0 {
            removed_track_ids.push(plan.id);
        }
    }
    if !removed_track_ids.is_empty() {
        scan::cleanup_orphan_albums(&transaction)?;
        scan::clear_library_query_cache(&transaction);
    }
    transaction
        .commit()
        .map_err(|error| format!("Could not commit track delete: {error}"))?;

    Ok(NativeTracksDeleteResponse {
        removed_count: removed_track_ids.len() as i64,
        removed_track_ids,
        deleted_files,
        missing_track_ids,
        errors,
    })
}

pub fn native_restore_track(
    _state: State<'_, NativeLibraryState>,
    path: String,
    rating: Option<f64>,
) -> Result<NativeTrack, String> {
    let path = PathBuf::from(path.trim());
    if !path.exists() || !path.is_file() {
        return Err("Audio file does not exist".to_string());
    }
    let result = metadata::read_file_metadata_result(&path);
    let metadata = result
        .get("metadata")
        .and_then(JsonValue::as_object)
        .ok_or_else(|| {
            result
                .get("error")
                .and_then(JsonValue::as_str)
                .unwrap_or("Could not read file metadata")
                .to_string()
        })?;
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start track restore: {error}"))?;
    scan::upsert_track(&transaction, metadata)?;
    let path_key = metadata
        .get("path_key")
        .and_then(JsonValue::as_str)
        .ok_or_else(|| "Restored file did not produce a path key".to_string())?;
    let track_id = transaction
        .query_row(
            "SELECT id FROM tracks WHERE path_key = ?",
            params![path_key],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not read restored track: {error}"))?;
    if let Some(rating) = rating {
        transaction
            .execute(
                "UPDATE tracks SET rating = ?, updated_at = datetime('now') WHERE id = ?",
                params![rating, track_id],
            )
            .map_err(|error| format!("Could not restore track rating: {error}"))?;
    }
    scan::clear_library_query_cache(&transaction);
    transaction
        .commit()
        .map_err(|error| format!("Could not commit track restore: {error}"))?;
    track_by_id(&connection, track_id)
}

pub fn native_sync_track_metadata_from_files(
    _state: State<'_, NativeLibraryState>,
    track_ids: Vec<i64>,
) -> Result<NativeTrackMetadataSyncResponse, String> {
    let connection = open_database()?;
    let mut synced_track_ids = Vec::new();
    let mut missing_track_ids = Vec::new();
    let mut errors = Vec::new();
    let ids = unique_positive_ids(track_ids);
    for track_id in ids {
        let row = connection
            .query_row(
                "SELECT path FROM tracks WHERE id = ?",
                params![track_id],
                |row| row.get::<_, String>(0),
            )
            .ok();
        let Some(path_text) = row else {
            missing_track_ids.push(track_id);
            continue;
        };
        let path = Path::new(&path_text);
        if !path.exists() {
            missing_track_ids.push(track_id);
            continue;
        }
        let result = metadata::read_file_metadata_result(path);
        if let Some(error) = result.get("error").and_then(JsonValue::as_str) {
            errors.push(format!("{path_text}: {error}"));
            continue;
        }
        let Some(metadata) = result.get("metadata").and_then(JsonValue::as_object) else {
            errors.push(format!("{path_text}: metadata read returned no data"));
            continue;
        };
        match scan::update_track_from_metadata(&connection, track_id, metadata) {
            Ok(()) => synced_track_ids.push(track_id),
            Err(error) => errors.push(format!("{path_text}: {error}")),
        }
    }
    if !synced_track_ids.is_empty() {
        scan::cleanup_orphan_albums(&connection)?;
        scan::clear_library_query_cache(&connection);
    }
    Ok(NativeTrackMetadataSyncResponse {
        synced_count: synced_track_ids.len() as i64,
        synced_track_ids,
        missing_track_ids,
        errors,
    })
}

fn removal_plans(connection: &Connection, ids: &[i64]) -> Result<Vec<RemovalPlan>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = vec!["?"; ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            "SELECT path_key, album_id, updated_at, {TRACK_COLUMNS} FROM tracks WHERE id IN ({placeholders})"
        ))
        .map_err(|error| format!("Could not prepare delete query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(ids.iter()), |row| {
            let id = row.get::<_, i64>("id")?;
            let path = row.get::<_, String>("path")?;
            let path_key = row.get::<_, String>("path_key")?;
            let title = row.get::<_, Option<String>>("title")?;
            let snapshot = row_to_json_object(row, REMOVE_COLUMNS)?;
            Ok(RemovalPlan {
                id,
                path,
                path_key,
                title,
                snapshot,
            })
        })
        .map_err(|error| format!("Could not read tracks for delete: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode tracks for delete: {error}"))
}

fn row_to_json_object(
    row: &rusqlite::Row<'_>,
    columns: &[&str],
) -> rusqlite::Result<serde_json::Value> {
    let mut object = serde_json::Map::new();
    for column in columns {
        let value: SqlValue = row.get(*column)?;
        object.insert((*column).to_string(), sqlite_value_to_json(value));
    }
    Ok(serde_json::Value::Object(object))
}

fn sqlite_value_to_json(value: SqlValue) -> serde_json::Value {
    match value {
        SqlValue::Null => serde_json::Value::Null,
        SqlValue::Integer(value) => json!(value),
        SqlValue::Real(value) => json!(value),
        SqlValue::Text(value) => serde_json::Value::String(value),
        SqlValue::Blob(_) => serde_json::Value::String("[blob]".to_string()),
    }
}

fn unique_positive_ids(track_ids: Vec<i64>) -> Vec<i64> {
    let mut unique = Vec::new();
    for track_id in track_ids.into_iter().filter(|track_id| *track_id > 0) {
        if !unique.contains(&track_id) {
            unique.push(track_id);
        }
    }
    unique
}

fn unix_seconds() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}
