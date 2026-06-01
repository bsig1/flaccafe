use rusqlite::{params, params_from_iter, ToSql};
use serde_json::{json, Value as JsonValue};
use std::path::Path;

use super::{body_bool, body_f64, body_i64, body_i64_vec};
use crate::library::storage::{open_database, truthy_setting};
use crate::library::types::{DesktopClapGenreTagPreview, DesktopClapGenreTagResponse};
use crate::library::{metadata, normalized_path_key};

const DEFAULT_CLAP_GENRE_COPY_CONFIDENCE: f64 = 0.45;
const DEFAULT_CLAP_GENRE_COPY_MARGIN: f64 = 0.08;
const BIAS_PRONE_CLAP_GENRE_COPY_CONFIDENCE: f64 = 0.55;
const BIAS_PRONE_CLAP_GENRE_COPY_MARGIN: f64 = 0.14;
// These broad labels showed up too often in local testing, so copying them into
// editable genre tags requires a stronger lead over the runner-up.
const BIAS_PRONE_CLAP_GENRES: &[&str] = &["r&b", "latin", "house"];

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
    tag_scores: Option<String>,
}

struct ClapGenreCopyGate {
    allowed: bool,
    runner_up_genre: Option<String>,
    match_margin: Option<f64>,
    blocked_reason: Option<String>,
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
        "SELECT id, path, title, artist, album, genre, analysis_genre, analysis_genre_confidence, analysis_genre_tags
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
                tag_scores: row.get("analysis_genre_tags")?,
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
        let candidate_changed = !proposed_genre.is_empty()
            && (!request.missing_only || current_genre.is_empty())
            && normalize_genre_token(&current_genre) != normalize_genre_token(&proposed_genre);
        let copy_gate = if candidate_changed {
            clap_genre_copy_gate(
                &proposed_genre,
                confidence,
                row.tag_scores.as_deref(),
                request.min_confidence,
            )
        } else {
            ClapGenreCopyGate::allowed()
        };
        let changed = candidate_changed && copy_gate.allowed;
        let mut preview = DesktopClapGenreTagPreview {
            track_id: row.id,
            title: row.title,
            artist: row.artist,
            album: row.album,
            current_genre: (!current_genre.is_empty()).then_some(current_genre),
            proposed_genre: (!proposed_genre.is_empty()).then_some(proposed_genre.clone()),
            confidence,
            runner_up_genre: copy_gate.runner_up_genre,
            match_margin: copy_gate.match_margin,
            copy_blocked_reason: copy_gate.blocked_reason,
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
    let blocked = previews
        .iter()
        .filter(|preview| preview.copy_blocked_reason.is_some() && preview.error.is_none())
        .count() as i64;
    Ok(DesktopClapGenreTagResponse {
        total: previews.len() as i64,
        matched,
        changed,
        blocked,
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
                .unwrap_or(DEFAULT_CLAP_GENRE_COPY_CONFIDENCE)
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

impl ClapGenreCopyGate {
    fn allowed() -> Self {
        Self {
            allowed: true,
            runner_up_genre: None,
            match_margin: None,
            blocked_reason: None,
        }
    }

    fn blocked(
        reason: String,
        runner_up_genre: Option<String>,
        match_margin: Option<f64>,
    ) -> Self {
        Self {
            allowed: false,
            runner_up_genre,
            match_margin,
            blocked_reason: Some(reason),
        }
    }
}

fn clap_genre_copy_gate(
    proposed_genre: &str,
    confidence: Option<f64>,
    tag_scores: Option<&str>,
    requested_min_confidence: f64,
) -> ClapGenreCopyGate {
    let ranked_scores = ranked_clap_genre_scores(tag_scores);
    if ranked_scores.is_empty() {
        return ClapGenreCopyGate::blocked(
            "blocked: CLAP score vector is missing".to_string(),
            None,
            None,
        );
    }

    let (top_genre, top_score) = &ranked_scores[0];
    let runner_up = ranked_scores.get(1);
    let runner_up_genre = runner_up.map(|(genre, _)| genre.clone());
    let runner_up_score = runner_up.map(|(_, score)| *score);
    let margin = runner_up_score.map(|score| top_score - score);
    if normalize_genre_token(top_genre) != normalize_genre_token(proposed_genre) {
        return ClapGenreCopyGate::blocked(
            "blocked: stored top genre no longer matches the CLAP score vector".to_string(),
            runner_up_genre,
            margin,
        );
    }

    let confidence = confidence.unwrap_or(*top_score);
    let (required_confidence, required_margin) =
        clap_genre_copy_thresholds(proposed_genre, requested_min_confidence);
    if confidence < required_confidence {
        return ClapGenreCopyGate::blocked(
            format!(
                "blocked: needs at least {}% confidence",
                (required_confidence * 100.0).round() as i64
            ),
            runner_up_genre,
            margin,
        );
    }
    let Some(margin) = margin else {
        return ClapGenreCopyGate::blocked(
            "blocked: needs a runner-up score to verify margin".to_string(),
            runner_up_genre,
            None,
        );
    };
    if margin < required_margin {
        return ClapGenreCopyGate::blocked(
            format!(
                "blocked: needs a {} point lead over the runner-up",
                (required_margin * 100.0).round() as i64
            ),
            runner_up_genre,
            Some(margin),
        );
    }

    ClapGenreCopyGate {
        allowed: true,
        runner_up_genre,
        match_margin: Some(margin),
        blocked_reason: None,
    }
}

fn clap_genre_copy_thresholds(genre: &str, requested_min_confidence: f64) -> (f64, f64) {
    if is_bias_prone_clap_genre(genre) {
        (
            requested_min_confidence.max(BIAS_PRONE_CLAP_GENRE_COPY_CONFIDENCE),
            BIAS_PRONE_CLAP_GENRE_COPY_MARGIN,
        )
    } else {
        (
            requested_min_confidence.max(DEFAULT_CLAP_GENRE_COPY_CONFIDENCE),
            DEFAULT_CLAP_GENRE_COPY_MARGIN,
        )
    }
}

fn is_bias_prone_clap_genre(genre: &str) -> bool {
    let normalized = normalize_genre_token(genre);
    BIAS_PRONE_CLAP_GENRES
        .iter()
        .any(|candidate| normalize_genre_token(candidate) == normalized)
}

fn ranked_clap_genre_scores(tag_scores: Option<&str>) -> Vec<(String, f64)> {
    let Some(tag_scores) = tag_scores.map(str::trim).filter(|value| !value.is_empty()) else {
        return Vec::new();
    };
    let Ok(JsonValue::Object(scores)) = serde_json::from_str::<JsonValue>(tag_scores) else {
        return Vec::new();
    };
    let mut ranked = scores
        .into_iter()
        .filter_map(|(genre, value)| value.as_f64().map(|score| (genre, score)))
        .collect::<Vec<_>>();
    ranked.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    ranked
}

fn normalize_genre_token(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_gate_blocks_bias_prone_genres_without_clear_margin() {
        let gate = clap_genre_copy_gate(
            "latin",
            Some(0.57),
            Some(r#"{"latin":0.57,"dance pop":0.49,"pop":0.44}"#),
            0.45,
        );

        assert!(!gate.allowed);
        assert_eq!(gate.runner_up_genre.as_deref(), Some("dance pop"));
        assert!(gate.blocked_reason.unwrap().contains("runner-up"));
    }

    #[test]
    fn copy_gate_allows_bias_prone_genres_with_strong_margin() {
        let gate = clap_genre_copy_gate(
            "latin",
            Some(0.62),
            Some(r#"{"latin":0.62,"dance pop":0.39,"pop":0.35}"#),
            0.45,
        );

        assert!(gate.allowed);
        assert!(gate.match_margin.unwrap() > 0.14);
    }

    #[test]
    fn copy_gate_uses_default_margin_for_other_genres() {
        let gate = clap_genre_copy_gate(
            "alternative rock",
            Some(0.48),
            Some(r#"{"alternative rock":0.48,"indie rock":0.37,"rock":0.32}"#),
            0.45,
        );

        assert!(gate.allowed);
    }
}
