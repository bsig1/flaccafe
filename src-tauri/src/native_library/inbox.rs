use super::types::*;
use super::{open_database, qualified_track_columns, track_from_row};
use regex::RegexBuilder;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use tauri::State;

const AUTO_REVIEW_FIELDS: &[&str] = &[
    "title",
    "artist",
    "album",
    "album_artist",
    "genre",
    "path",
    "year",
    "rating",
    "duration_seconds",
];
const AUTO_REVIEW_MATCH_TYPES: &[&str] = &[
    "contains",
    "equals",
    "starts_with",
    "ends_with",
    "regex",
    "is_empty",
    "is_not_empty",
];

fn inbox_counts(connection: &Connection) -> Result<(i64, i64), String> {
    connection
        .query_row(
            r#"
            SELECT
                sum(CASE WHEN coalesce(track_inbox_state.status, 'new') = 'new' THEN 1 ELSE 0 END) AS total_new,
                sum(CASE WHEN track_inbox_state.status = 'reviewed' THEN 1 ELSE 0 END) AS total_reviewed
            FROM tracks
            LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
            "#,
            [],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>("total_new")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("total_reviewed")?.unwrap_or(0),
                ))
            },
        )
        .map_err(|error| format!("Could not count Rust inbox tracks: {error}"))
}

fn inbox_note_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeInboxTrackNote> {
    Ok(NativeInboxTrackNote {
        track_id: row.get("track_id")?,
        note: row.get::<_, Option<String>>("note")?.unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn inbox_rule_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativeInboxAutoReviewRule> {
    Ok(NativeInboxAutoReviewRule {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        enabled: row.get::<_, Option<i64>>("enabled")?.unwrap_or(0) != 0,
        field: row.get::<_, Option<String>>("field")?.unwrap_or_default(),
        match_type: row
            .get::<_, Option<String>>("match_type")?
            .unwrap_or_default(),
        value: row.get::<_, Option<String>>("value")?.unwrap_or_default(),
        note: row.get("note")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn list_inbox_notes(
    connection: &Connection,
    track_ids: &[i64],
) -> Result<Vec<NativeInboxTrackNote>, String> {
    if track_ids.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = vec!["?"; track_ids.len()].join(",");
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT track_id, note, updated_at
            FROM track_inbox_notes
            WHERE track_id IN ({placeholders})
            ORDER BY datetime(updated_at) DESC, track_id DESC
            "#
        ))
        .map_err(|error| format!("Could not prepare Rust inbox note query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(track_ids.iter()), inbox_note_from_row)
        .map_err(|error| format!("Could not read Rust inbox notes: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust inbox notes: {error}"))
}

fn list_auto_review_rules(
    connection: &Connection,
) -> Result<Vec<NativeInboxAutoReviewRule>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, enabled, field, match_type, value, note, created_at, updated_at
            FROM inbox_auto_review_rules
            ORDER BY enabled DESC, lower(name), id
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust inbox auto-review query: {error}"))?;
    let rows = statement
        .query_map([], inbox_rule_from_row)
        .map_err(|error| format!("Could not read Rust inbox auto-review rules: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust inbox auto-review rules: {error}"))
}

fn auto_review_rule_by_id(
    connection: &Connection,
    rule_id: i64,
) -> Result<NativeInboxAutoReviewRule, String> {
    connection
        .query_row(
            r#"
            SELECT id, name, enabled, field, match_type, value, note, created_at, updated_at
            FROM inbox_auto_review_rules
            WHERE id = ?
            "#,
            params![rule_id],
            inbox_rule_from_row,
        )
        .map_err(|_| "Auto-review rule not found".to_string())
}

fn clean_rule_parts(
    name: String,
    enabled: Option<bool>,
    field: String,
    match_type: String,
    value: Option<String>,
    note: Option<String>,
) -> Result<(String, i64, String, String, String, Option<String>), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Name the auto-review rule".to_string());
    }
    let field = field.trim().to_string();
    if !AUTO_REVIEW_FIELDS.contains(&field.as_str()) {
        return Err(format!("Unsupported auto-review field: {field}"));
    }
    let match_type = match_type.trim().to_string();
    if !AUTO_REVIEW_MATCH_TYPES.contains(&match_type.as_str()) {
        return Err(format!("Unsupported auto-review match type: {match_type}"));
    }
    let value = value.unwrap_or_default().trim().to_string();
    if !matches!(match_type.as_str(), "is_empty" | "is_not_empty") && value.is_empty() {
        return Err("Auto-review rules need a value unless they test for empty fields".to_string());
    }
    let note = note
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty());
    Ok((
        name.chars().take(160).collect(),
        if enabled.unwrap_or(true) { 1 } else { 0 },
        field,
        match_type,
        value.chars().take(500).collect(),
        note.map(|text| text.chars().take(1000).collect()),
    ))
}

fn candidate_value(row: &rusqlite::Row<'_>, field: &str) -> rusqlite::Result<String> {
    match field {
        "year" => Ok(row
            .get::<_, Option<i64>>("year")?
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "rating" => Ok(row
            .get::<_, Option<f64>>("rating")?
            .map(|value| value.to_string())
            .unwrap_or_default()),
        "duration_seconds" => Ok(row
            .get::<_, Option<f64>>("duration_seconds")?
            .map(|value| value.to_string())
            .unwrap_or_default()),
        _ => Ok(row
            .get::<_, Option<String>>(field)?
            .unwrap_or_default()
            .trim()
            .to_string()),
    }
}

fn rule_matches(rule: &NativeInboxAutoReviewRule, value: &str) -> bool {
    let needle = rule.value.trim();
    match rule.match_type.as_str() {
        "is_empty" => value.trim().is_empty(),
        "is_not_empty" => !value.trim().is_empty(),
        "contains" => value
            .to_ascii_lowercase()
            .contains(&needle.to_ascii_lowercase()),
        "equals" => value.eq_ignore_ascii_case(needle),
        "starts_with" => value
            .to_ascii_lowercase()
            .starts_with(&needle.to_ascii_lowercase()),
        "ends_with" => value
            .to_ascii_lowercase()
            .ends_with(&needle.to_ascii_lowercase()),
        "regex" => RegexBuilder::new(needle)
            .case_insensitive(true)
            .build()
            .map(|pattern| pattern.is_match(value))
            .unwrap_or(false),
        _ => false,
    }
}

fn save_note_if_empty(
    connection: &Connection,
    track_id: i64,
    note: Option<&str>,
) -> Result<(), String> {
    let Some(note) = note.map(str::trim).filter(|text| !text.is_empty()) else {
        return Ok(());
    };
    let existing = connection
        .query_row(
            "SELECT note FROM track_inbox_notes WHERE track_id = ?",
            params![track_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|error| format!("Could not read Rust inbox note: {error}"))?
        .flatten()
        .unwrap_or_default();
    if !existing.trim().is_empty() {
        return Ok(());
    }
    connection
        .execute(
            r#"
            INSERT INTO track_inbox_notes(track_id, note, updated_at)
            VALUES(?, ?, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET
              note = excluded.note,
              updated_at = excluded.updated_at
            "#,
            params![track_id, note],
        )
        .map_err(|error| format!("Could not save Rust auto-review note: {error}"))?;
    Ok(())
}

fn apply_auto_review_rule(connection: &Connection, rule_id: i64) -> Result<i64, String> {
    let rule = auto_review_rule_by_id(connection, rule_id)?;
    if !rule.enabled {
        return Ok(0);
    }
    let mut statement = connection
        .prepare(
            r#"
            SELECT tracks.id, tracks.path, tracks.title, tracks.artist, tracks.album, tracks.album_artist,
                   tracks.genre, tracks.year, tracks.rating, tracks.duration_seconds
            FROM tracks
            LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
            WHERE coalesce(track_inbox_state.status, 'new') = 'new'
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust auto-review scan: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, i64>("id")?, candidate_value(row, &rule.field)?))
        })
        .map_err(|error| format!("Could not read Rust auto-review scan: {error}"))?;
    let mut updated = 0i64;
    for row in rows {
        let (track_id, value) =
            row.map_err(|error| format!("Could not decode Rust auto-review row: {error}"))?;
        if !rule_matches(&rule, &value) {
            continue;
        }
        connection
            .execute(
                r#"
                INSERT INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
                VALUES(?, 'reviewed', datetime('now'), datetime('now'))
                ON CONFLICT(track_id) DO UPDATE SET
                  status = 'reviewed',
                  reviewed_at = excluded.reviewed_at,
                  updated_at = excluded.updated_at
                "#,
                params![track_id],
            )
            .map_err(|error| format!("Could not mark Rust auto-review match: {error}"))?;
        save_note_if_empty(connection, track_id, rule.note.as_deref())?;
        updated += 1;
    }
    Ok(updated)
}

#[tauri::command]
pub fn native_inbox(
    _state: State<'_, NativeLibraryState>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<NativeInboxResponse, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    let offset = offset.unwrap_or(0);
    let (total_new, total_reviewed) = inbox_counts(&connection)?;
    let track_columns = qualified_track_columns("tracks");
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns}
            FROM tracks
            LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
            WHERE coalesce(track_inbox_state.status, 'new') = 'new'
            ORDER BY datetime(tracks.date_added) DESC, tracks.id DESC
            LIMIT ? OFFSET ?
            "#
        ))
        .map_err(|error| format!("Could not prepare Rust inbox query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64, offset as i64], track_from_row)
        .map_err(|error| format!("Could not read Rust inbox tracks: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust inbox tracks: {error}"))?;
    let track_ids: Vec<i64> = tracks.iter().map(|track| track.id).collect();
    let notes = list_inbox_notes(&connection, &track_ids)?;
    let auto_review_rules = list_auto_review_rules(&connection)?;

    Ok(NativeInboxResponse {
        tracks,
        notes,
        auto_review_rules,
        total_new,
        total_reviewed,
        limit,
        offset,
    })
}

#[tauri::command]
pub fn native_update_inbox_note(
    _state: State<'_, NativeLibraryState>,
    track_id: i64,
    note: Option<String>,
) -> Result<Option<NativeInboxTrackNote>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust inbox note update: {error}"))?;
    let exists = transaction
        .query_row(
            "SELECT id FROM tracks WHERE id = ?",
            params![track_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| format!("Could not verify Rust inbox track: {error}"))?
        .is_some();
    if !exists {
        return Err("Track not found".to_string());
    }
    let text = note.unwrap_or_default().trim().to_string();
    if text.is_empty() {
        transaction
            .execute(
                "DELETE FROM track_inbox_notes WHERE track_id = ?",
                params![track_id],
            )
            .map_err(|error| format!("Could not delete Rust inbox note: {error}"))?;
        transaction
            .commit()
            .map_err(|error| format!("Could not save Rust inbox note delete: {error}"))?;
        return Ok(None);
    }
    transaction
        .execute(
            r#"
            INSERT INTO track_inbox_notes(track_id, note, updated_at)
            VALUES(?, ?, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET
              note = excluded.note,
              updated_at = excluded.updated_at
            "#,
            params![track_id, text],
        )
        .map_err(|error| format!("Could not save Rust inbox note: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit Rust inbox note: {error}"))?;

    let note = connection
        .query_row(
            "SELECT track_id, note, updated_at FROM track_inbox_notes WHERE track_id = ?",
            params![track_id],
            inbox_note_from_row,
        )
        .map_err(|error| format!("Could not read saved Rust inbox note: {error}"))?;
    Ok(Some(note))
}

#[tauri::command]
pub fn native_review_inbox(
    _state: State<'_, NativeLibraryState>,
    track_ids: Option<Vec<i64>>,
    all_new: Option<bool>,
) -> Result<NativeInboxReviewResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust inbox review: {error}"))?;
    let updated = if all_new.unwrap_or(false) {
        let before_new = transaction
            .query_row(
                r#"
                SELECT sum(CASE WHEN coalesce(track_inbox_state.status, 'new') = 'new' THEN 1 ELSE 0 END)
                FROM tracks
                LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
                "#,
                [],
                |row| Ok(row.get::<_, Option<i64>>(0)?.unwrap_or(0)),
            )
            .map_err(|error| format!("Could not count Rust inbox review candidates: {error}"))?;
        transaction
            .execute(
                r#"
                INSERT INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
                SELECT tracks.id, 'reviewed', datetime('now'), datetime('now')
                FROM tracks
                LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
                WHERE track_inbox_state.track_id IS NULL
                "#,
                [],
            )
            .map_err(|error| format!("Could not seed Rust inbox review states: {error}"))?;
        transaction
            .execute(
                r#"
                UPDATE track_inbox_state
                SET status = 'reviewed',
                    reviewed_at = datetime('now'),
                    updated_at = datetime('now')
                WHERE status <> 'reviewed'
                "#,
                [],
            )
            .map_err(|error| format!("Could not review Rust inbox tracks: {error}"))?;
        before_new
    } else {
        let unique_ids: Vec<i64> = track_ids
            .unwrap_or_default()
            .into_iter()
            .filter(|id| *id > 0)
            .fold(Vec::new(), |mut ids, id| {
                if !ids.contains(&id) {
                    ids.push(id);
                }
                ids
            });
        if unique_ids.is_empty() {
            0
        } else {
            let placeholders = vec!["?"; unique_ids.len()].join(",");
            let mut existing_statement = transaction
                .prepare(&format!(
                    "SELECT id FROM tracks WHERE id IN ({placeholders})"
                ))
                .map_err(|error| {
                    format!("Could not prepare Rust inbox review track query: {error}")
                })?;
            let existing_rows = existing_statement
                .query_map(params_from_iter(unique_ids.iter()), |row| {
                    row.get::<_, i64>(0)
                })
                .map_err(|error| format!("Could not read Rust inbox review tracks: {error}"))?;
            let existing_ids = existing_rows
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|error| format!("Could not decode Rust inbox review tracks: {error}"))?;
            drop(existing_statement);

            let mut updated = 0i64;
            for track_id in existing_ids {
                let row_count = transaction
                    .execute(
                        r#"
                        INSERT INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
                        VALUES(?, 'reviewed', datetime('now'), datetime('now'))
                        ON CONFLICT(track_id) DO UPDATE SET
                          status = 'reviewed',
                          reviewed_at = excluded.reviewed_at,
                          updated_at = excluded.updated_at
                        WHERE track_inbox_state.status <> 'reviewed'
                        "#,
                        params![track_id],
                    )
                    .map_err(|error| {
                        format!("Could not mark Rust inbox track reviewed: {error}")
                    })?;
                updated += row_count as i64;
            }
            updated
        }
    };
    transaction
        .commit()
        .map_err(|error| format!("Could not commit Rust inbox review: {error}"))?;
    let (total_new, total_reviewed) = inbox_counts(&connection)?;
    Ok(NativeInboxReviewResponse {
        updated,
        total_new,
        total_reviewed,
    })
}

#[tauri::command]
pub fn native_inbox_auto_review_rules(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativeInboxAutoReviewRule>, String> {
    let connection = open_database()?;
    list_auto_review_rules(&connection)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn native_create_inbox_auto_review_rule(
    _state: State<'_, NativeLibraryState>,
    name: String,
    enabled: Option<bool>,
    field: String,
    match_type: String,
    value: Option<String>,
    note: Option<String>,
    apply_existing: Option<bool>,
) -> Result<NativeInboxAutoReviewRuleApplyResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust auto-review rule create: {error}"))?;
    let (name, enabled, field, match_type, value, note) =
        clean_rule_parts(name, enabled, field, match_type, value, note)?;
    transaction
        .execute(
            r#"
            INSERT INTO inbox_auto_review_rules(name, enabled, field, match_type, value, note, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            "#,
            params![name, enabled, field, match_type, value, note],
        )
        .map_err(|error| format!("Could not create Rust auto-review rule: {error}"))?;
    let rule_id = transaction.last_insert_rowid();
    let applied = if apply_existing.unwrap_or(false) {
        apply_auto_review_rule(&transaction, rule_id)?
    } else {
        0
    };
    let rule = auto_review_rule_by_id(&transaction, rule_id)?;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit Rust auto-review rule: {error}"))?;
    let (total_new, total_reviewed) = inbox_counts(&connection)?;
    Ok(NativeInboxAutoReviewRuleApplyResponse {
        rule,
        applied,
        total_new,
        total_reviewed,
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn native_update_inbox_auto_review_rule(
    _state: State<'_, NativeLibraryState>,
    rule_id: i64,
    name: String,
    enabled: Option<bool>,
    field: String,
    match_type: String,
    value: Option<String>,
    note: Option<String>,
    apply_existing: Option<bool>,
) -> Result<NativeInboxAutoReviewRuleApplyResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust auto-review rule update: {error}"))?;
    let (name, enabled, field, match_type, value, note) =
        clean_rule_parts(name, enabled, field, match_type, value, note)?;
    let updated = transaction
        .execute(
            r#"
            UPDATE inbox_auto_review_rules
            SET name = ?, enabled = ?, field = ?, match_type = ?, value = ?, note = ?, updated_at = datetime('now')
            WHERE id = ?
            "#,
            params![name, enabled, field, match_type, value, note, rule_id],
        )
        .map_err(|error| format!("Could not update Rust auto-review rule: {error}"))?;
    if updated == 0 {
        return Err("Auto-review rule not found".to_string());
    }
    let applied = if apply_existing.unwrap_or(false) {
        apply_auto_review_rule(&transaction, rule_id)?
    } else {
        0
    };
    let rule = auto_review_rule_by_id(&transaction, rule_id)?;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit Rust auto-review rule update: {error}"))?;
    let (total_new, total_reviewed) = inbox_counts(&connection)?;
    Ok(NativeInboxAutoReviewRuleApplyResponse {
        rule,
        applied,
        total_new,
        total_reviewed,
    })
}

#[tauri::command]
pub fn native_delete_inbox_auto_review_rule(
    _state: State<'_, NativeLibraryState>,
    rule_id: i64,
) -> Result<NativeInboxAutoReviewRuleDeleteResponse, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute(
            "DELETE FROM inbox_auto_review_rules WHERE id = ?",
            params![rule_id],
        )
        .map_err(|error| format!("Could not delete Rust auto-review rule: {error}"))?
        > 0;
    let (total_new, total_reviewed) = inbox_counts(&connection)?;
    Ok(NativeInboxAutoReviewRuleDeleteResponse {
        deleted,
        total_new,
        total_reviewed,
    })
}
