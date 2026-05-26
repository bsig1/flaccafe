use rusqlite::{params, params_from_iter, ToSql};
use serde_json::{json, Value as JsonValue};
use std::path::Path;

use super::{body_bool, body_f64, body_i64, body_i64_vec};
use crate::library::storage::{open_database, truthy_setting};
use crate::library::types::{DesktopClapGenreTagPreview, DesktopClapGenreTagResponse};
use crate::library::{metadata, normalized_path_key};

struct ClapGenreTagRequest {
    track_ids: Option<Vec<i64>>,
    missing_only: bool,
    min_confidence: f64,
    apply: bool,
    write_to_file: Option<bool>,
    limit: usize,
}

struct ClapGenreTagRow {
    id: i64,
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    genre: Option<String>,
    analysis_genre: Option<String>,
    confidence: Option<f64>,
}

pub(crate) fn clap_genre_tags(body: JsonValue) -> Result<DesktopClapGenreTagResponse, String> {
    let request = ClapGenreTagRequest::from_body(&body);
    let connection = open_database()?;
    let mut clauses = vec![
        "analysis_provider = 'clap'".to_string(),
        "analysis_genre IS NOT NULL".to_string(),
        "trim(analysis_genre) <> ''".to_string(),
    ];
    let mut params: Vec<Box<dyn ToSql>> = Vec::new();
    let mut unique_ids = Vec::new();
    if let Some(track_ids) = request.track_ids.as_deref().filter(|ids| !ids.is_empty()) {
        for id in track_ids.iter().copied().filter(|id| *id > 0) {
            if !unique_ids.contains(&id) {
                unique_ids.push(id);
            }
        }
        if !unique_ids.is_empty() {
            clauses.push(format!("id IN ({})", vec!["?"; unique_ids.len()].join(",")));
            params.extend(
                unique_ids
                    .iter()
                    .copied()
                    .map(|id| Box::new(id) as Box<dyn ToSql>),
            );
        }
    }
    params.push(Box::new(request.limit as i64));
    let sql = format!(
        "SELECT id, path, title, artist, album, genre, analysis_genre, analysis_genre_confidence
         FROM tracks
         WHERE {}
         ORDER BY datetime(date_added) DESC, id DESC
         LIMIT ?",
        clauses.join(" AND ")
    );
    let param_refs = params
        .iter()
        .map(|value| value.as_ref())
        .collect::<Vec<&dyn ToSql>>();
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Could not prepare CLAP genre tag query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(param_refs), |row| {
            Ok(ClapGenreTagRow {
                id: row.get("id")?,
                path: row.get("path")?,
                title: row.get("title")?,
                artist: row.get("artist")?,
                album: row.get("album")?,
                genre: row.get("genre")?,
                analysis_genre: row.get("analysis_genre")?,
                confidence: row.get("analysis_genre_confidence")?,
            })
        })
        .map_err(|error| format!("Could not read CLAP genre tag rows: {error}"))?;
    let rows = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode CLAP genre tag rows: {error}"))?;
    drop(statement);

    let found_ids = rows.iter().map(|row| row.id).collect::<Vec<_>>();
    let mut previews = Vec::new();
    let mut applied = 0i64;
    let mut errors = Vec::new();
    for row in rows {
        let current_genre = row.genre.unwrap_or_default().trim().to_string();
        let proposed_genre = row.analysis_genre.unwrap_or_default().trim().to_string();
        let confidence = row.confidence;
        let changed = !proposed_genre.is_empty()
            && (!request.missing_only || current_genre.is_empty())
            && normalize_genre_token(&current_genre) != normalize_genre_token(&proposed_genre)
            && confidence.is_none_or(|value| value >= request.min_confidence);
        let mut preview = DesktopClapGenreTagPreview {
            track_id: row.id,
            title: row.title,
            artist: row.artist,
            album: row.album,
            current_genre: (!current_genre.is_empty()).then_some(current_genre),
            proposed_genre: (!proposed_genre.is_empty()).then_some(proposed_genre.clone()),
            confidence,
            changed,
            applied: false,
            error: None,
        };
        if request.apply && changed {
            match apply_clap_genre_tag(&connection, row.id, &proposed_genre, request.write_to_file)
            {
                Ok(()) => {
                    preview.applied = true;
                    applied += 1;
                }
                Err(error) => {
                    preview.error = Some(error.clone());
                    errors.push(format!(
                        "{}: {error}",
                        preview
                            .title
                            .as_deref()
                            .filter(|value| !value.trim().is_empty())
                            .unwrap_or(&row.path)
                    ));
                }
            }
        }
        previews.push(preview);
    }
    for missing_id in unique_ids.into_iter().filter(|id| !found_ids.contains(id)) {
        errors.push(format!(
            "Track {missing_id} was not found or has no CLAP genre analysis"
        ));
    }
    let matched = previews
        .iter()
        .filter(|preview| preview.proposed_genre.is_some() && preview.error.is_none())
        .count() as i64;
    let changed = previews.iter().filter(|preview| preview.changed).count() as i64;
    Ok(DesktopClapGenreTagResponse {
        total: previews.len() as i64,
        matched,
        changed,
        applied,
        errors: errors.into_iter().take(100).collect(),
        previews,
    })
}

fn apply_clap_genre_tag(
    connection: &rusqlite::Connection,
    track_id: i64,
    genre: &str,
    write_to_file: Option<bool>,
) -> Result<(), String> {
    let should_write_file = write_to_file
        .unwrap_or_else(|| truthy_setting(connection, "write_ratings_to_files", false));
    let mut file_modified_at = None;
    if should_write_file {
        let (path, title, artist, album, album_artist, track_number, disc_number, year) =
            connection
                .query_row(
                    "
                    SELECT path, title, artist, album, album_artist, track_number, disc_number, year
                    FROM tracks
                    WHERE id = ?
                    ",
                    params![track_id],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, Option<String>>(1)?,
                            row.get::<_, Option<String>>(2)?,
                            row.get::<_, Option<String>>(3)?,
                            row.get::<_, Option<String>>(4)?,
                            row.get::<_, Option<i64>>(5)?,
                            row.get::<_, Option<i64>>(6)?,
                            row.get::<_, Option<i64>>(7)?,
                        ))
                    },
                )
                .map_err(|error| {
                    format!("Could not load track before writing genre tag: {error}")
                })?;
        let mut fields = serde_json::Map::new();
        fields.insert("title".to_string(), json!(title));
        fields.insert("artist".to_string(), json!(artist));
        fields.insert("album".to_string(), json!(album));
        fields.insert("album_artist".to_string(), json!(album_artist));
        fields.insert("track_number".to_string(), json!(track_number));
        fields.insert("disc_number".to_string(), json!(disc_number));
        fields.insert("year".to_string(), json!(year));
        fields.insert("genre".to_string(), json!(genre));
        metadata::write_common_metadata(Path::new(&path), &fields)?;
        file_modified_at = metadata::modified_time_iso(Path::new(&path));
        connection
            .execute(
                "DELETE FROM track_metadata_cache WHERE path_key = ?",
                params![normalized_path_key(&path)],
            )
            .map_err(|error| format!("Could not clear metadata cache: {error}"))?;
    }
    connection
        .execute(
            "UPDATE tracks SET genre = ?, file_modified_at = coalesce(?, file_modified_at), updated_at = datetime('now') WHERE id = ?",
            params![genre, file_modified_at, track_id],
        )
        .map_err(|error| format!("Could not apply CLAP genre tag: {error}"))?;
    let _ = connection.execute("DELETE FROM library_query_cache", []);
    Ok(())
}

impl ClapGenreTagRequest {
    fn from_body(body: &JsonValue) -> Self {
        Self {
            track_ids: body_i64_vec(body, "track_ids").or_else(|| body_i64_vec(body, "trackIds")),
            missing_only: body_bool(body, "missing_only")
                .or_else(|| body_bool(body, "missingOnly"))
                .unwrap_or(true),
            min_confidence: body_f64(body, "min_confidence")
                .or_else(|| body_f64(body, "minConfidence"))
                .unwrap_or(0.35)
                .clamp(0.0, 1.0),
            apply: body_bool(body, "apply").unwrap_or(false),
            write_to_file: body_bool(body, "write_to_file")
                .or_else(|| body_bool(body, "writeToFile")),
            limit: body_i64(body, "limit")
                .filter(|value| *value > 0)
                .and_then(|value| usize::try_from(value).ok())
                .unwrap_or(200)
                .clamp(1, 10_000),
        }
    }
}

fn normalize_genre_token(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}
