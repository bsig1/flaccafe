use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Map, Value as JsonValue};
use std::path::Path;
use tauri::State;

use super::types::*;
use super::{album_artwork, metadata, open_database, scan, DesktopLibraryState};

const MUSICBRAINZ_ROOT: &str = "https://musicbrainz.org/ws/2";
const ACOUSTID_ROOT: &str = "https://api.acoustid.org/v2";
const COVER_ART_ARCHIVE_ROOT: &str = "https://coverartarchive.org";
const USER_AGENT: &str = "FLAC Cafe/0.5 (https://github.com/bsig1/flaccafe)";

#[tauri::command]
pub fn auto_tag_musicbrainz(
    state: State<'_, DesktopLibraryState>,
    body: JsonValue,
) -> Result<DesktopAutoTagResponse, String> {
    let track_ids = json_i64_vec(&body, "track_ids")
        .or_else(|| json_i64_vec(&body, "trackIds"))
        .unwrap_or_default();
    let album_id = json_i64(&body, "album_id").or_else(|| json_i64(&body, "albumId"));
    let apply = json_bool(&body, "apply").unwrap_or(false);
    let missing_only = json_bool(&body, "missing_only")
        .or_else(|| json_bool(&body, "missingOnly"))
        .unwrap_or(true);
    let fingerprint_only = json_bool(&body, "fingerprint_only")
        .or_else(|| json_bool(&body, "fingerprintOnly"))
        .unwrap_or(false);
    let write_to_file = json_bool(&body, "write_to_file")
        .or_else(|| json_bool(&body, "writeToFile"))
        .unwrap_or(false);
    let limit = json_usize(&body, "limit").unwrap_or(50).clamp(1, 500);
    let connection = open_database()?;
    let tracks = autotag_tracks(&connection, track_ids, album_id, limit)?;
    let acoustid_key = setting_text(&connection, "acoustid_api_key");
    drop(connection);

    let mut previews = Vec::new();
    let mut errors = Vec::new();
    let mut matched = 0i64;
    let mut changed = 0i64;
    let mut applied = 0i64;

    for track in tracks {
        let match_result = if fingerprint_only || track.acoustic_fingerprint.is_some() {
            match acoustid_key.as_deref() {
                Some(key) => lookup_acoustid_track(&track, key).or_else(|error| {
                    if fingerprint_only {
                        Err(error)
                    } else {
                        lookup_musicbrainz_track(&track)
                    }
                }),
                None if fingerprint_only => {
                    Err("AcoustID API key is required for fingerprint-only matching".to_string())
                }
                None => lookup_musicbrainz_track(&track),
            }
        } else {
            lookup_musicbrainz_track(&track)
        };
        match match_result {
            Ok(Some(proposal)) => {
                matched += 1;
                let current = track_current_json(&track);
                let proposed = proposal.proposed.clone();
                let changed_fields = changed_fields(&current, &proposed, missing_only);
                if !changed_fields.is_empty() {
                    changed += 1;
                }
                let mut applied_here = false;
                if apply && !changed_fields.is_empty() {
                    apply_tag_proposal(
                        state.clone(),
                        track.id,
                        &track.path,
                        &current,
                        &proposed,
                        &changed_fields,
                        write_to_file,
                    )?;
                    applied += 1;
                    applied_here = true;
                }
                previews.push(DesktopAutoTagPreview {
                    track_id: track.id,
                    path: track.path.clone(),
                    current,
                    proposed: JsonValue::Object(proposed),
                    changed_fields,
                    confidence: proposal.confidence,
                    match_type: proposal.match_type,
                    source: proposal.source,
                    release_id: proposal.release_id,
                    release_title: proposal.release_title,
                    recording_id: proposal.recording_id,
                    artwork_url: proposal.artwork_url,
                    artwork_thumbnail_url: proposal.artwork_thumbnail_url,
                    applied: applied_here,
                    artwork_saved: false,
                    error: None,
                });
            }
            Ok(None) => previews.push(DesktopAutoTagPreview {
                track_id: track.id,
                path: track.path.clone(),
                current: track_current_json(&track),
                proposed: json!({}),
                changed_fields: Vec::new(),
                confidence: 0.0,
                match_type: "track".to_string(),
                source: "MusicBrainz".to_string(),
                release_id: None,
                release_title: None,
                recording_id: None,
                artwork_url: None,
                artwork_thumbnail_url: None,
                applied: false,
                artwork_saved: false,
                error: Some("No match found".to_string()),
            }),
            Err(error) => {
                errors.push(error.clone());
                previews.push(DesktopAutoTagPreview {
                    track_id: track.id,
                    path: track.path.clone(),
                    current: track_current_json(&track),
                    proposed: json!({}),
                    changed_fields: Vec::new(),
                    confidence: 0.0,
                    match_type: "track".to_string(),
                    source: "MusicBrainz".to_string(),
                    release_id: None,
                    release_title: None,
                    recording_id: None,
                    artwork_url: None,
                    artwork_thumbnail_url: None,
                    applied: false,
                    artwork_saved: false,
                    error: Some(error),
                });
            }
        }
    }
    Ok(DesktopAutoTagResponse {
        total: previews.len() as i64,
        matched,
        changed,
        applied,
        artwork_matches: previews
            .iter()
            .filter(|preview| preview.artwork_url.is_some())
            .count() as i64,
        artwork_saved: 0,
        errors: errors.into_iter().take(10).collect(),
        previews,
    })
}

#[tauri::command]
pub fn lookup_album_completion(
    _state: State<'_, DesktopLibraryState>,
    album_id: i64,
) -> Result<DesktopAlbumCompletionLookupResponse, String> {
    let connection = open_database()?;
    let (album, artist, local_count): (Option<String>, Option<String>, i64) = connection
        .query_row(
            "SELECT albums.album, albums.album_artist, COUNT(tracks.id)
             FROM albums
             LEFT JOIN tracks ON tracks.album_id = albums.id
             WHERE albums.id = ?
             GROUP BY albums.id",
            params![album_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Album not found".to_string())?;
    let Some(album_name) = album.filter(|value| !value.trim().is_empty()) else {
        return Ok(save_album_completion(
            &connection,
            album_id,
            None,
            None,
            None,
            0.0,
            Some("Album title is missing".to_string()),
            local_count,
        )?);
    };
    let release = search_release_for_album(&album_name, artist.as_deref())?;
    let Some(release) = release else {
        return Ok(save_album_completion(
            &connection,
            album_id,
            None,
            None,
            None,
            0.0,
            Some("No MusicBrainz release match found".to_string()),
            local_count,
        )?);
    };
    save_album_completion(
        &connection,
        album_id,
        release.expected_track_count,
        release.release_id,
        release.release_title,
        release.confidence,
        None,
        local_count,
    )
}

pub fn album_artwork_candidates(album_id: i64) -> Result<JsonValue, String> {
    let connection = open_database()?;
    Ok(json!({
        "album_id": album_id,
        "candidates": album_artwork::album_artwork_candidates(&connection, album_id)?,
    }))
}

pub fn search_album_artwork(album_id: i64) -> Result<JsonValue, String> {
    let connection = open_database()?;
    let (album, artist, release_id): (Option<String>, Option<String>, Option<String>) = connection
        .query_row(
            "SELECT album, album_artist, completion_release_id FROM albums WHERE id = ?",
            params![album_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Album not found".to_string())?;
    let mut candidates = Vec::new();
    let mut errors = Vec::new();
    let release_id = release_id.or_else(|| {
        album
            .as_deref()
            .and_then(|album| {
                search_release_for_album(album, artist.as_deref())
                    .ok()
                    .flatten()
            })
            .and_then(|release| release.release_id)
    });
    if let Some(release_id) = release_id {
        candidates.push(DesktopAlbumArtworkCandidate {
            source: "web".to_string(),
            label: "Cover Art Archive".to_string(),
            path: None,
            track_id: None,
            artwork_url: Some(format!(
                "{COVER_ART_ARCHIVE_ROOT}/release/{release_id}/front"
            )),
            thumbnail_url: Some(format!(
                "{COVER_ART_ARCHIVE_ROOT}/release/{release_id}/front-250"
            )),
            release_id: Some(release_id),
            media_type: Some("image/jpeg".to_string()),
            size_bytes: None,
            modified_at: None,
            selected: false,
        });
    } else {
        errors.push("No MusicBrainz release match found for artwork search".to_string());
    }
    Ok(json!({
        "album_id": album_id,
        "candidates": candidates,
        "errors": errors,
    }))
}

pub fn artwork_collision_repair(body: JsonValue) -> Result<JsonValue, String> {
    Ok(json!({
        "apply": json_bool(&body, "apply").unwrap_or(false),
        "issues": [],
        "repaired": 0,
        "errors": [],
    }))
}

struct TagProposal {
    proposed: Map<String, JsonValue>,
    confidence: f64,
    match_type: String,
    source: String,
    release_id: Option<String>,
    release_title: Option<String>,
    recording_id: Option<String>,
    artwork_url: Option<String>,
    artwork_thumbnail_url: Option<String>,
}

struct ReleaseMatch {
    release_id: Option<String>,
    release_title: Option<String>,
    expected_track_count: Option<i64>,
    confidence: f64,
}

fn autotag_tracks(
    connection: &Connection,
    track_ids: Vec<i64>,
    album_id: Option<i64>,
    limit: usize,
) -> Result<Vec<DesktopTrack>, String> {
    if !track_ids.is_empty() {
        let placeholders = vec!["?"; track_ids.len()].join(",");
        let mut statement = connection
            .prepare(&format!(
                "SELECT {} FROM tracks WHERE id IN ({placeholders}) ORDER BY id LIMIT ?",
                super::TRACK_COLUMNS
            ))
            .map_err(|error| format!("Could not prepare autotag track query: {error}"))?;
        let mut params = track_ids
            .into_iter()
            .map(rusqlite::types::Value::from)
            .collect::<Vec<_>>();
        params.push(rusqlite::types::Value::from(limit as i64));
        let rows = statement
            .query_map(rusqlite::params_from_iter(params), super::track_from_row)
            .map_err(|error| format!("Could not read autotag tracks: {error}"))?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode autotag tracks: {error}"));
    }
    if let Some(album_id) = album_id {
        let mut statement = connection
            .prepare(&format!(
                "SELECT {} FROM tracks WHERE album_id = ? ORDER BY coalesce(disc_number, 0), coalesce(track_number, 0), id LIMIT ?",
                super::TRACK_COLUMNS
            ))
            .map_err(|error| format!("Could not prepare album autotag query: {error}"))?;
        let rows = statement
            .query_map(params![album_id, limit as i64], super::track_from_row)
            .map_err(|error| format!("Could not read album autotag tracks: {error}"))?;
        return rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| format!("Could not decode album autotag tracks: {error}"));
    }
    let mut statement = connection
        .prepare(&format!(
            "SELECT {} FROM tracks
             WHERE title IS NULL OR artist IS NULL OR album IS NULL OR genre IS NULL
             ORDER BY date_added DESC LIMIT ?",
            super::TRACK_COLUMNS
        ))
        .map_err(|error| format!("Could not prepare missing-metadata autotag query: {error}"))?;
    let rows = statement
        .query_map(params![limit as i64], super::track_from_row)
        .map_err(|error| format!("Could not read autotag tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode autotag tracks: {error}"))
}

fn lookup_musicbrainz_track(track: &DesktopTrack) -> Result<Option<TagProposal>, String> {
    let title = track
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Track title is required for MusicBrainz lookup".to_string())?;
    let mut query = format!("recording:\"{title}\"");
    if let Some(artist) = track
        .artist
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        query.push_str(&format!(" AND artist:\"{artist}\""));
    }
    let url = format!(
        "{MUSICBRAINZ_ROOT}/recording?fmt=json&limit=1&inc=artist-credits+releases&query={}",
        urlencoding::encode(&query)
    );
    let payload = get_json(&url, "MusicBrainz")?;
    let recording = payload
        .get("recordings")
        .and_then(JsonValue::as_array)
        .and_then(|items| items.first());
    Ok(recording.map(recording_to_proposal))
}

fn lookup_acoustid_track(
    track: &DesktopTrack,
    api_key: &str,
) -> Result<Option<TagProposal>, String> {
    let fingerprint = track
        .acoustic_fingerprint
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Track has no stored acoustic fingerprint".to_string())?;
    let duration = track.duration_seconds.unwrap_or(0.0).round().max(1.0) as i64;
    let url = format!(
        "{ACOUSTID_ROOT}/lookup?format=json&client={}&meta=recordings+releases+tracks&duration={duration}&fingerprint={}",
        urlencoding::encode(api_key),
        urlencoding::encode(fingerprint)
    );
    let payload = get_json(&url, "AcoustID")?;
    let result = payload
        .get("results")
        .and_then(JsonValue::as_array)
        .and_then(|items| items.first());
    let recording = result
        .and_then(|item| item.get("recordings"))
        .and_then(JsonValue::as_array)
        .and_then(|items| items.first());
    let Some(recording) = recording else {
        return Ok(None);
    };
    let mut proposal = recording_to_proposal(recording);
    proposal.source = "AcoustID".to_string();
    proposal.confidence = result
        .and_then(|item| item.get("score"))
        .and_then(JsonValue::as_f64)
        .unwrap_or(proposal.confidence);
    Ok(Some(proposal))
}

fn recording_to_proposal(recording: &JsonValue) -> TagProposal {
    let mut proposed = Map::new();
    if let Some(title) = recording.get("title").and_then(JsonValue::as_str) {
        proposed.insert("title".to_string(), json!(title));
    }
    if let Some(artist) = artist_credit(recording) {
        proposed.insert("artist".to_string(), json!(artist.clone()));
        proposed.insert("album_artist".to_string(), json!(artist));
    }
    let release = recording
        .get("releases")
        .and_then(JsonValue::as_array)
        .and_then(|items| items.first());
    let release_id = release
        .and_then(|release| release.get("id"))
        .and_then(JsonValue::as_str)
        .map(str::to_string);
    let release_title = release
        .and_then(|release| release.get("title"))
        .and_then(JsonValue::as_str)
        .map(str::to_string);
    if let Some(album) = release_title.as_deref() {
        proposed.insert("album".to_string(), json!(album));
    }
    if let Some(date) = release
        .and_then(|release| release.get("date"))
        .and_then(JsonValue::as_str)
    {
        if let Some(year) = parse_year(date) {
            proposed.insert("year".to_string(), json!(year));
        }
    }
    TagProposal {
        proposed,
        confidence: recording
            .get("score")
            .and_then(JsonValue::as_f64)
            .map(|value| (value / 100.0).clamp(0.0, 1.0))
            .unwrap_or(0.8),
        match_type: "track".to_string(),
        source: "MusicBrainz".to_string(),
        release_id: release_id.clone(),
        release_title,
        recording_id: recording
            .get("id")
            .and_then(JsonValue::as_str)
            .map(str::to_string),
        artwork_url: release_id
            .as_deref()
            .map(|id| format!("{COVER_ART_ARCHIVE_ROOT}/release/{id}/front")),
        artwork_thumbnail_url: release_id
            .as_deref()
            .map(|id| format!("{COVER_ART_ARCHIVE_ROOT}/release/{id}/front-250")),
    }
}

fn search_release_for_album(
    album: &str,
    artist: Option<&str>,
) -> Result<Option<ReleaseMatch>, String> {
    let mut query = format!("release:\"{album}\"");
    if let Some(artist) = artist.map(str::trim).filter(|value| !value.is_empty()) {
        query.push_str(&format!(" AND artist:\"{artist}\""));
    }
    let url = format!(
        "{MUSICBRAINZ_ROOT}/release?fmt=json&limit=1&inc=media&query={}",
        urlencoding::encode(&query)
    );
    let payload = get_json(&url, "MusicBrainz")?;
    let release = payload
        .get("releases")
        .and_then(JsonValue::as_array)
        .and_then(|items| items.first());
    Ok(release.map(|release| ReleaseMatch {
        release_id: release
            .get("id")
            .and_then(JsonValue::as_str)
            .map(str::to_string),
        release_title: release
            .get("title")
            .and_then(JsonValue::as_str)
            .map(str::to_string),
        expected_track_count: release_track_count(release),
        confidence: release
            .get("score")
            .and_then(JsonValue::as_f64)
            .map(|value| (value / 100.0).clamp(0.0, 1.0))
            .unwrap_or(0.8),
    }))
}

fn save_album_completion(
    connection: &Connection,
    album_id: i64,
    expected_track_count: Option<i64>,
    release_id: Option<String>,
    release_title: Option<String>,
    confidence: f64,
    error: Option<String>,
    local_count: i64,
) -> Result<DesktopAlbumCompletionLookupResponse, String> {
    let checked_at = scan::utc_now();
    connection
        .execute(
            "UPDATE albums
             SET completion_expected_track_count = ?,
                 completion_source = ?,
                 completion_release_id = ?,
                 completion_release_title = ?,
                 completion_checked_at = ?
             WHERE id = ?",
            params![
                expected_track_count,
                if expected_track_count.is_some() {
                    Some("MusicBrainz")
                } else {
                    None
                },
                release_id,
                release_title,
                checked_at,
                album_id
            ],
        )
        .map_err(|error| format!("Could not save album completion lookup: {error}"))?;
    Ok(DesktopAlbumCompletionLookupResponse {
        album_id,
        expected_track_count,
        missing_track_count: expected_track_count
            .map(|expected| expected.saturating_sub(local_count))
            .unwrap_or(0),
        source: expected_track_count.map(|_| "MusicBrainz".to_string()),
        release_id: connection
            .query_row(
                "SELECT completion_release_id FROM albums WHERE id = ?",
                params![album_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .ok()
            .flatten()
            .flatten(),
        release_title: connection
            .query_row(
                "SELECT completion_release_title FROM albums WHERE id = ?",
                params![album_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .ok()
            .flatten()
            .flatten(),
        confidence,
        checked_at: Some(checked_at),
        error,
    })
}

fn apply_tag_proposal(
    state: State<'_, DesktopLibraryState>,
    track_id: i64,
    path: &str,
    current: &JsonValue,
    proposed: &Map<String, JsonValue>,
    changed_fields: &[String],
    write_to_file: bool,
) -> Result<(), String> {
    let mut update = Map::new();
    for field in changed_fields {
        if let Some(value) = proposed.get(field) {
            update.insert(field.clone(), value.clone());
        }
    }
    if write_to_file {
        let mut merged = current.as_object().cloned().unwrap_or_default();
        for (field, value) in &update {
            merged.insert(field.clone(), value.clone());
        }
        metadata::write_common_metadata(Path::new(path), &merged)?;
    }
    let _ = super::update_track_metadata(state, track_id, update, Some(false))?;
    Ok(())
}

fn changed_fields(
    current: &JsonValue,
    proposed: &Map<String, JsonValue>,
    missing_only: bool,
) -> Vec<String> {
    let current = current.as_object().cloned().unwrap_or_default();
    proposed
        .iter()
        .filter_map(|(field, value)| {
            let new_text = json_scalar_text(value);
            let old_text = current.get(field).and_then(json_scalar_text);
            if missing_only
                && old_text
                    .as_deref()
                    .map(str::trim)
                    .filter(|v| !v.is_empty())
                    .is_some()
            {
                return None;
            }
            (new_text != old_text
                && new_text
                    .as_deref()
                    .map(str::trim)
                    .filter(|v| !v.is_empty())
                    .is_some())
            .then(|| field.clone())
        })
        .collect()
}

fn track_current_json(track: &DesktopTrack) -> JsonValue {
    json!({
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "album_artist": track.album_artist,
        "track_number": track.track_number,
        "disc_number": track.disc_number,
        "genre": track.genre,
        "year": track.year,
    })
}

fn artist_credit(recording: &JsonValue) -> Option<String> {
    recording
        .get("artist-credit")
        .and_then(JsonValue::as_array)
        .map(|credits| {
            credits
                .iter()
                .filter_map(|credit| {
                    credit
                        .get("artist")
                        .and_then(|artist| artist.get("name"))
                        .and_then(JsonValue::as_str)
                        .or_else(|| credit.get("name").and_then(JsonValue::as_str))
                })
                .collect::<Vec<_>>()
                .join("; ")
        })
        .filter(|value| !value.trim().is_empty())
}

fn release_track_count(release: &JsonValue) -> Option<i64> {
    let media = release.get("media").and_then(JsonValue::as_array)?;
    let total = media
        .iter()
        .filter_map(|medium| {
            medium
                .get("track-count")
                .or_else(|| medium.get("track_count"))
                .and_then(JsonValue::as_i64)
        })
        .sum::<i64>();
    (total > 0).then_some(total)
}

fn get_json(url: &str, label: &str) -> Result<JsonValue, String> {
    let response = ureq::get(url)
        .set("User-Agent", USER_AGENT)
        .call()
        .map_err(|error| format!("{label} lookup failed: {error}"))?;
    response
        .into_json::<JsonValue>()
        .map_err(|error| format!("{label} returned invalid JSON: {error}"))
}

fn setting_text(connection: &Connection, key: &str) -> Option<String> {
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?",
            params![key],
            |row| row.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn parse_year(value: &str) -> Option<i64> {
    value.get(0..4)?.parse::<i64>().ok()
}

fn json_scalar_text(value: &JsonValue) -> Option<String> {
    match value {
        JsonValue::String(text) => Some(text.trim().to_string()).filter(|text| !text.is_empty()),
        JsonValue::Number(number) => Some(number.to_string()),
        JsonValue::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

fn json_i64(value: &JsonValue, key: &str) -> Option<i64> {
    value.get(key).and_then(JsonValue::as_i64)
}

fn json_usize(value: &JsonValue, key: &str) -> Option<usize> {
    value
        .get(key)
        .and_then(JsonValue::as_u64)
        .and_then(|value| usize::try_from(value).ok())
}

fn json_bool(value: &JsonValue, key: &str) -> Option<bool> {
    match value.get(key)? {
        JsonValue::Bool(value) => Some(*value),
        JsonValue::String(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

fn json_i64_vec(value: &JsonValue, key: &str) -> Option<Vec<i64>> {
    value.get(key).and_then(JsonValue::as_array).map(|items| {
        items
            .iter()
            .filter_map(JsonValue::as_i64)
            .filter(|value| *value > 0)
            .collect()
    })
}
