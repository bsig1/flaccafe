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

pub(crate) fn native_autodj_settings(settings: serde_json::Value) -> NativeAutoDjSettings {
    NativeAutoDjSettings {
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

fn native_autodj_avoid_rules_for_connection(
    connection: &Connection,
) -> Result<Vec<NativeAutoDjAvoidRule>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, scope, target_key, label, created_at, updated_at
             FROM autodj_avoid_rules
             ORDER BY scope, lower(label)",
        )
        .map_err(|error| format!("Could not prepare native AutoDJ avoid query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(NativeAutoDjAvoidRule {
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
        .map_err(|error| format!("Could not read native AutoDJ avoid rules: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native AutoDJ avoid rules: {error}"))
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
pub fn native_autodj_avoid_rules(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativeAutoDjAvoidRule>, String> {
    let connection = open_database()?;
    native_autodj_avoid_rules_for_connection(&connection)
}

#[tauri::command]
pub fn native_create_autodj_avoid_rule(
    _state: State<'_, NativeLibraryState>,
    scope: String,
    track_id: Option<i64>,
    value: Option<String>,
) -> Result<NativeAutoDjAvoidRule, String> {
    let mut connection = open_database()?;
    let (key, label) = avoid_key_and_label(&connection, &scope, track_id, value)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native AutoDJ avoid update: {error}"))?;
    transaction
        .execute(
            "INSERT INTO autodj_avoid_rules(scope, target_key, label)
             VALUES(?, ?, ?)
             ON CONFLICT(scope, target_key) DO UPDATE SET label = excluded.label, updated_at = datetime('now')",
            params![scope, key, label],
        )
        .map_err(|error| format!("Could not save native AutoDJ avoid rule: {error}"))?;
    let row = transaction
        .query_row(
            "SELECT id, scope, target_key, label, created_at, updated_at
             FROM autodj_avoid_rules
             WHERE scope = ? AND target_key = ?",
            params![scope, key],
            |row| {
                Ok(NativeAutoDjAvoidRule {
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
        .map_err(|error| format!("Could not read native AutoDJ avoid rule: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save native AutoDJ avoid transaction: {error}"))?;
    Ok(row)
}

#[tauri::command]
pub fn native_delete_autodj_avoid_rule(
    _state: State<'_, NativeLibraryState>,
    rule_id: i64,
) -> Result<Vec<NativeAutoDjAvoidRule>, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start native AutoDJ avoid delete: {error}"))?;
    transaction
        .execute(
            "DELETE FROM autodj_avoid_rules WHERE id = ?",
            params![rule_id],
        )
        .map_err(|error| format!("Could not delete native AutoDJ avoid rule: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Could not save native AutoDJ avoid delete: {error}"))?;
    native_autodj_avoid_rules_for_connection(&connection)
}

#[derive(Clone)]
struct NativeCandidateTrack {
    track: NativeTrack,
    feedback_score: f64,
    days_since_played: Option<f64>,
    days_since_skipped: Option<f64>,
}

#[derive(Clone)]
struct NativeCandidate {
    item: NativeCandidateTrack,
    score: f64,
    reason: String,
    breakdown: BTreeMap<String, f64>,
    artist_keys: HashSet<String>,
    album_key: String,
    is_unrated: bool,
    is_exploratory: bool,
}

struct NativeRng {
    state: u64,
}

impl NativeRng {
    fn new(seed: Option<i64>) -> Self {
        let fallback = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos() as u64)
            .unwrap_or(0x9e37_79b9_7f4a_7c15);
        Self {
            state: (seed.map(|value| value as u64).unwrap_or(fallback) ^ 0x9e37_79b9_7f4a_7c15)
                .max(1),
        }
    }

    fn next_u64(&mut self) -> u64 {
        let mut value = self.state;
        value ^= value >> 12;
        value ^= value << 25;
        value ^= value >> 27;
        self.state = value;
        value.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / ((1u64 << 53) as f64)
    }

    fn uniform(&mut self, min: f64, max: f64) -> f64 {
        min + (max - min) * self.next_f64()
    }
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

pub(super) fn round4(value: f64) -> f64 {
    (value * 10000.0).round() / 10000.0
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

pub(super) fn normalize_token(value: Option<&str>) -> String {
    value
        .unwrap_or_default()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn split_artist_tokens(value: Option<&str>) -> HashSet<String> {
    let mut cleaned = value.unwrap_or_default().replace('|', ";");
    for marker in [" feat. ", " feat ", " featuring ", " with "] {
        cleaned = cleaned.replace(marker, ";");
    }
    cleaned
        .split(|character| matches!(character, ';' | '/' | ',' | '+' | '&'))
        .map(|part| normalize_token(Some(part)))
        .filter(|part| !part.is_empty())
        .collect()
}

fn split_text_tokens(value: Option<&str>) -> HashSet<String> {
    value
        .unwrap_or_default()
        .split(|character| matches!(character, ';' | '/' | ',' | '|'))
        .map(|part| normalize_token(Some(part)))
        .filter(|part| !part.is_empty())
        .collect()
}

fn album_key(value: Option<&str>) -> String {
    normalize_token(value)
}

fn combined_genre(track: &NativeTrack) -> Option<String> {
    let mut values = Vec::new();
    for value in [&track.genre, &track.analysis_genre] {
        if let Some(value) = value {
            let trimmed = value.trim();
            if !trimmed.is_empty() && !values.iter().any(|existing: &String| existing == trimmed) {
                values.push(trimmed.to_string());
            }
        }
    }
    if values.is_empty() {
        None
    } else {
        Some(values.join("; "))
    }
}

fn base_rating_score(rating: Option<f64>) -> f64 {
    let Some(value) = rating else {
        return 0.2;
    };
    let anchors = [
        (0.5, -4.8),
        (1.0, -4.0),
        (2.0, -1.4),
        (3.0, 0.35),
        (4.0, 1.3),
        (5.0, 2.15),
    ];
    for window in anchors.windows(2) {
        let (left_rating, left_score) = window[0];
        let (right_rating, right_score) = window[1];
        if value >= left_rating && value <= right_rating {
            let progress = (value - left_rating) / (right_rating - left_rating);
            return left_score + (right_score - left_score) * progress;
        }
    }
    if value > anchors[anchors.len() - 1].0 {
        anchors[anchors.len() - 1].1
    } else {
        anchors[0].1
    }
}

fn track_is_longform(track: &NativeTrack) -> bool {
    let genre = track.genre.as_deref().unwrap_or_default().to_lowercase();
    let path = track.path.replace('\\', "/").to_lowercase();
    genre.contains("podcast")
        || path.contains("podcast")
        || genre.contains("audiobook")
        || genre.contains("audio book")
        || path.contains("audiobook")
        || path.contains("audio book")
        || path.contains("/books/")
}

fn track_is_familiar(track: &NativeTrack) -> bool {
    track.rating.is_some() || track.play_count > 0
}

fn track_is_exploratory(track: &NativeTrack) -> bool {
    !track_is_familiar(track) && (track.rating.is_none() || track.play_count == 0)
}

fn track_matches_avoid(
    track: &NativeTrack,
    avoid_rules: &HashMap<String, HashSet<String>>,
) -> bool {
    if avoid_rules
        .get("track")
        .is_some_and(|rules| rules.contains(&track.id.to_string()))
    {
        return true;
    }
    if avoid_rules
        .get("artist")
        .is_some_and(|rules| !rules.is_disjoint(&split_artist_tokens(track.artist.as_deref())))
    {
        return true;
    }
    if avoid_rules
        .get("album")
        .is_some_and(|rules| rules.contains(&album_key(track.album.as_deref())))
    {
        return true;
    }
    if avoid_rules.get("genre").is_some_and(|rules| {
        !rules.is_disjoint(&split_text_tokens(combined_genre(track).as_deref()))
    }) {
        return true;
    }
    false
}

pub(super) fn parse_embedding(value: Option<&str>) -> Option<Vec<f64>> {
    let raw = value?;
    let parsed = serde_json::from_str::<Vec<f64>>(raw).ok()?;
    if parsed.is_empty() {
        None
    } else {
        Some(parsed)
    }
}

pub(super) fn cosine_similarity(left: Option<&str>, right: Option<&str>) -> Option<f64> {
    let left = parse_embedding(left)?;
    let right = parse_embedding(right)?;
    if left.len() != right.len() {
        return None;
    }
    let dot: f64 = left.iter().zip(&right).map(|(a, b)| a * b).sum();
    let left_norm = left.iter().map(|value| value * value).sum::<f64>().sqrt();
    let right_norm = right.iter().map(|value| value * value).sum::<f64>().sqrt();
    if left_norm <= 0.0 || right_norm <= 0.0 {
        None
    } else {
        Some(dot / (left_norm * right_norm))
    }
}

pub(super) fn similarity_adjustment(
    track: &NativeTrack,
    seed_track: Option<&NativeTrack>,
    settings: &NativeAutoDjSettings,
) -> (f64, String) {
    let Some(seed_track) = seed_track else {
        return (0.0, String::new());
    };
    if track.id == seed_track.id || settings.similarity_weight <= 0.0 {
        return (0.0, String::new());
    }
    let mut score = 0.0;
    let mut reasons = Vec::new();
    if let Some(similarity) = cosine_similarity(
        track.analysis_embedding.as_deref(),
        seed_track.analysis_embedding.as_deref(),
    ) {
        if similarity > 0.0 {
            score += similarity * settings.audio_similarity_weight;
            reasons.push(format!("audio similarity {similarity:.2}"));
        }
    }
    if !split_artist_tokens(track.artist.as_deref())
        .is_disjoint(&split_artist_tokens(seed_track.artist.as_deref()))
    {
        score += settings.artist_similarity_weight;
        reasons.push("similar artist".to_string());
    }
    let album = album_key(track.album.as_deref());
    if !album.is_empty() && album == album_key(seed_track.album.as_deref()) {
        score += settings.album_similarity_weight;
        reasons.push("same album".to_string());
    }
    if !split_text_tokens(combined_genre(track).as_deref())
        .is_disjoint(&split_text_tokens(combined_genre(seed_track).as_deref()))
    {
        score += settings.genre_similarity_weight;
        reasons.push("similar genre".to_string());
    }
    if let (Some(year), Some(seed_year)) = (track.year, seed_track.year) {
        let distance = (year - seed_year).abs();
        if distance <= 2 {
            score += settings.year_similarity_weight;
            reasons.push("same era".to_string());
        } else if distance <= 6 {
            score += settings.year_similarity_weight * (0.2 / 0.45);
            reasons.push("nearby era".to_string());
        }
    }
    if let (Some(rating), Some(seed_rating)) = (track.rating, seed_track.rating) {
        if (rating - seed_rating).abs() <= 1.0 {
            score += settings.rating_similarity_weight;
            reasons.push("rating match".to_string());
        }
    }
    if reasons.is_empty() {
        (score, String::new())
    } else {
        (score, format!("seed {}", reasons.join("/")))
    }
}

fn score_candidate(
    item: NativeCandidateTrack,
    settings: &NativeAutoDjSettings,
    rng: &mut NativeRng,
    seed_track: Option<&NativeTrack>,
) -> NativeCandidate {
    let track = &item.track;
    let mut breakdown = BTreeMap::new();
    let mut score = base_rating_score(track.rating) * settings.rating_weight;
    breakdown.insert("rating".to_string(), round3(score));
    let mut reasons = vec![format!(
        "rating {}",
        track
            .rating
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unrated".to_string())
    )];

    let recency_score = if settings.recently_played_cooldown_days <= 0 {
        0.55
    } else if let Some(days) = item.days_since_played {
        if days < settings.recently_played_cooldown_days as f64 {
            -3.0 * (1.0 - (days / settings.recently_played_cooldown_days as f64))
        } else {
            0.55
        }
    } else {
        0.55
    };
    let recency_delta = recency_score * settings.recency_weight;
    score += recency_delta;
    breakdown.insert("recency".to_string(), round3(recency_delta));
    reasons.push(if recency_delta < 0.0 {
        "recently played penalty".to_string()
    } else {
        "not recently played".to_string()
    });

    if track.skip_count > 0 {
        let skip_delta = -((track.skip_count as f64) * 0.25).min(1.75) * settings.skip_weight;
        score += skip_delta;
        breakdown.insert("skips".to_string(), round3(skip_delta));
        reasons.push("skip penalty".to_string());
    }
    if let Some(days) = item.days_since_skipped {
        if days < 14.0 {
            let delta = -1.2 * (1.0 - days / 14.0) * settings.skip_weight;
            score += delta;
            breakdown.insert("recent_skip".to_string(), round3(delta));
            reasons.push("recent skip".to_string());
        }
    }
    if track.play_count > 0 {
        let delta = (track.play_count as f64)
            .ln_1p()
            .mul_add(0.18, 0.0)
            .min(0.9)
            * settings.play_history_weight;
        score += delta;
        breakdown.insert("plays".to_string(), round3(delta));
        reasons.push("play history".to_string());
    }
    if item.feedback_score > 0.0 {
        let delta = item
            .feedback_score
            .max(0.0)
            .ln_1p()
            .mul_add(0.45, 0.0)
            .min(1.4)
            * settings.feedback_weight;
        score += delta;
        breakdown.insert("manual_queue".to_string(), round3(delta));
        reasons.push("manual queue memory".to_string());
    }
    if track.rating.is_none() {
        let delta = 0.65 * settings.exploration_weight;
        score += delta;
        breakdown.insert("exploration".to_string(), round3(delta));
        reasons.push("exploration".to_string());
    }
    let (similarity, similarity_reason) = similarity_adjustment(track, seed_track, settings);
    if similarity != 0.0 {
        let delta = similarity * settings.similarity_weight;
        score += delta;
        breakdown.insert("similarity".to_string(), round3(delta));
        if !similarity_reason.is_empty() {
            reasons.push(similarity_reason);
        }
    }
    let random_delta = rng.uniform(-0.35, 0.35);
    score += random_delta;
    breakdown.insert("random".to_string(), round3(random_delta));
    breakdown.insert("total".to_string(), round3(score));

    NativeCandidate {
        artist_keys: split_artist_tokens(track.artist.as_deref()),
        album_key: album_key(track.album.as_deref()),
        is_unrated: track.rating.is_none(),
        is_exploratory: track_is_exploratory(track),
        item,
        score,
        reason: reasons.join(", "),
        breakdown,
    }
}

fn candidate_conflicts(
    candidate: &NativeCandidate,
    recent_artists: &[HashSet<String>],
    recent_albums: &[String],
) -> bool {
    let artist_conflict = !candidate.artist_keys.is_empty()
        && recent_artists
            .iter()
            .any(|recent| !recent.is_disjoint(&candidate.artist_keys));
    let album_conflict = !candidate.album_key.is_empty()
        && recent_albums
            .iter()
            .any(|recent| recent == &candidate.album_key);
    artist_conflict || album_conflict
}

fn repeat_artist_percent_for_tracks(tracks: &[NativeQueueTrack]) -> f64 {
    if tracks.is_empty() {
        return 0.0;
    }
    let unique_artists: HashSet<String> = tracks
        .iter()
        .flat_map(|track| {
            let tokens = split_artist_tokens(track.track.artist.as_deref());
            if tokens.is_empty() {
                HashSet::from([normalize_token(track.track.artist.as_deref())])
            } else {
                tokens
            }
        })
        .filter(|token| !token.is_empty())
        .collect();
    if unique_artists.is_empty() {
        0.0
    } else {
        ((tracks.len().saturating_sub(unique_artists.len())) as f64 / tracks.len() as f64) * 100.0
    }
}

fn target_drift_adjustment(
    selected: &[NativeQueueTrack],
    track: &NativeTrack,
    settings: &NativeAutoDjSettings,
) -> (f64, String) {
    let mut score = 0.0;
    let mut reasons = Vec::new();
    if let Some(target) = settings.target_unrated_percent {
        let target_fraction = target / 100.0;
        let current_unrated = selected
            .iter()
            .filter(|item| item.track.rating.is_none())
            .count();
        let current_fraction = if selected.is_empty() {
            0.0
        } else {
            current_unrated as f64 / selected.len() as f64
        };
        if track.rating.is_none() && current_fraction < target_fraction {
            score += 0.75;
            reasons.push("unrated target");
        } else if track.rating.is_some() && current_fraction < target_fraction {
            score -= 0.45;
            reasons.push("unrated target");
        }
    }
    if let Some(target) = settings.target_exploration_percent {
        let target_fraction = target / 100.0;
        let current = selected
            .iter()
            .filter(|item| track_is_exploratory(&item.track))
            .count();
        let current_fraction = if selected.is_empty() {
            0.0
        } else {
            current as f64 / selected.len() as f64
        };
        if track_is_exploratory(track) && current_fraction < target_fraction {
            score += 0.6;
            reasons.push("exploration target");
        } else if !track_is_exploratory(track) && current_fraction < target_fraction {
            score -= 0.35;
            reasons.push("exploration target");
        }
    }
    if let Some(max_repeat) = settings.max_repeat_artist_percent {
        let mut projected = selected.to_vec();
        projected.push(NativeQueueTrack {
            track: track.clone(),
            score: 0.0,
            reason: String::new(),
            score_breakdown: BTreeMap::new(),
        });
        let overage = repeat_artist_percent_for_tracks(&projected) - max_repeat;
        if overage > 0.0 {
            score -= (0.16 * overage).min(4.0);
            reasons.push("repeat artist target");
        }
    }
    (score, reasons.join(", "))
}

fn adjusted_candidate_for_queue(
    base: &NativeCandidate,
    queue: &[NativeQueueTrack],
    settings: &NativeAutoDjSettings,
    recent_artists: &[HashSet<String>],
    recent_albums: &[String],
    cooldown_penalty: bool,
) -> NativeCandidate {
    let mut adjusted = base.clone();
    let (drift_delta, drift_reason) =
        target_drift_adjustment(queue, &adjusted.item.track, settings);
    if drift_delta != 0.0 {
        adjusted.score += drift_delta;
        adjusted
            .breakdown
            .insert("targets".to_string(), round3(drift_delta));
        if !drift_reason.is_empty() {
            adjusted.reason.push_str(&format!(", {drift_reason}"));
        }
    }
    if cooldown_penalty && candidate_conflicts(base, recent_artists, recent_albums) {
        adjusted.score -= 2.0;
        adjusted.reason.push_str(", cooldown penalty");
    }
    adjusted
        .breakdown
        .insert("total".to_string(), round3(adjusted.score));
    adjusted
}

fn weighted_choice(candidates: &[NativeCandidate], temperature: f64, rng: &mut NativeRng) -> usize {
    let max_score = candidates
        .iter()
        .map(|candidate| candidate.score)
        .fold(f64::NEG_INFINITY, f64::max);
    let weights: Vec<f64> = candidates
        .iter()
        .map(|candidate| ((candidate.score - max_score) / temperature.max(0.05)).exp())
        .collect();
    let total: f64 = weights.iter().sum();
    let mut pick = rng.next_f64() * total;
    for (index, weight) in weights.iter().enumerate() {
        pick -= weight;
        if pick <= 0.0 {
            return index;
        }
    }
    candidates.len().saturating_sub(1)
}

fn candidate_to_queue_track(candidate: NativeCandidate) -> NativeQueueTrack {
    NativeQueueTrack {
        track: candidate.item.track,
        score: round3(candidate.score),
        reason: candidate.reason,
        score_breakdown: candidate.breakdown,
    }
}

fn read_autodj_candidates(connection: &Connection) -> Result<Vec<NativeCandidateTrack>, String> {
    let track_columns = qualified_track_columns("tracks");
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns},
                   COALESCE(SUM(recommendation_feedback.weight), 0) AS feedback_score,
                   julianday('now') - julianday(tracks.last_played_at) AS days_since_played,
                   julianday('now') - julianday(tracks.last_skipped_at) AS days_since_skipped
            FROM tracks
            LEFT JOIN recommendation_feedback ON recommendation_feedback.track_id = tracks.id
            GROUP BY tracks.id
            ORDER BY tracks.artist, tracks.album, tracks.disc_number, tracks.track_number, tracks.title
            "#
        ))
        .map_err(|error| format!("Could not prepare native AutoDJ candidates: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(NativeCandidateTrack {
                track: track_from_row(row)?,
                feedback_score: row.get::<_, Option<f64>>("feedback_score")?.unwrap_or(0.0),
                days_since_played: row.get("days_since_played")?,
                days_since_skipped: row.get("days_since_skipped")?,
            })
        })
        .map_err(|error| format!("Could not read native AutoDJ candidates: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode native AutoDJ candidates: {error}"))
}

fn read_autodj_avoid_rules(
    connection: &Connection,
) -> Result<HashMap<String, HashSet<String>>, String> {
    let mut avoid_rules: HashMap<String, HashSet<String>> = HashMap::from([
        ("track".to_string(), HashSet::new()),
        ("artist".to_string(), HashSet::new()),
        ("album".to_string(), HashSet::new()),
        ("genre".to_string(), HashSet::new()),
    ]);
    let mut statement = connection
        .prepare("SELECT scope, target_key FROM autodj_avoid_rules")
        .map_err(|error| format!("Could not prepare native AutoDJ avoid rules: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, Option<String>>("scope")?.unwrap_or_default(),
                row.get::<_, Option<String>>("target_key")?
                    .unwrap_or_default(),
            ))
        })
        .map_err(|error| format!("Could not read native AutoDJ avoid rules: {error}"))?;
    for row in rows {
        let (scope, target_key) =
            row.map_err(|error| format!("Could not decode native AutoDJ avoid rules: {error}"))?;
        avoid_rules.entry(scope).or_default().insert(target_key);
    }
    Ok(avoid_rules)
}

fn native_recommendation_drift(tracks: &[NativeQueueTrack]) -> NativeRecommendationDrift {
    let total = tracks.len();
    if total == 0 {
        return NativeRecommendationDrift::default();
    }
    let ratings: Vec<f64> = tracks
        .iter()
        .filter_map(|track| track.track.rating)
        .collect();
    let familiar = tracks
        .iter()
        .filter(|track| track_is_familiar(&track.track))
        .count();
    let exploratory = tracks
        .iter()
        .filter(|track| track_is_exploratory(&track.track))
        .count();
    let unique_artists: HashSet<String> = tracks
        .iter()
        .flat_map(|track| {
            let tokens = split_artist_tokens(track.track.artist.as_deref());
            if tokens.is_empty() {
                HashSet::from([normalize_token(track.track.artist.as_deref())])
            } else {
                tokens
            }
        })
        .filter(|token| !token.is_empty())
        .collect();
    let unique_albums: HashSet<String> = tracks
        .iter()
        .map(|track| album_key(track.track.album.as_deref()))
        .filter(|album| !album.is_empty())
        .collect();
    let clap_count = tracks
        .iter()
        .filter(|track| {
            track.track.analysis_provider.as_deref() == Some("clap")
                && track
                    .track
                    .analysis_embedding
                    .as_deref()
                    .is_some_and(|value| !value.is_empty())
        })
        .count();
    let repeat_artist_percent = if unique_artists.is_empty() {
        0.0
    } else {
        ((total.saturating_sub(unique_artists.len())) as f64 / total as f64) * 100.0
    };
    let mut drift = NativeRecommendationDrift {
        total_tracks: total as i64,
        familiar_percent: round2((familiar as f64 / total as f64) * 100.0),
        exploration_percent: round2((exploratory as f64 / total as f64) * 100.0),
        repeat_artist_percent: round2(repeat_artist_percent),
        unrated_percent: round2(
            (tracks
                .iter()
                .filter(|track| track.track.rating.is_none())
                .count() as f64
                / total as f64)
                * 100.0,
        ),
        clap_percent: round2((clap_count as f64 / total as f64) * 100.0),
        average_rating: if ratings.is_empty() {
            None
        } else {
            Some(round2(ratings.iter().sum::<f64>() / ratings.len() as f64))
        },
        unique_artists: unique_artists.len() as i64,
        unique_albums: unique_albums.len() as i64,
        warnings: Vec::new(),
    };
    if drift.repeat_artist_percent >= 35.0 {
        drift.warnings.push(
            "This queue leans repetitive by artist. Increase artist cooldown or temperature."
                .to_string(),
        );
    }
    if drift.exploration_percent >= 85.0 {
        drift
            .warnings
            .push("This queue is highly exploratory. Lower temperature or unrated exploration for a safer mix.".to_string());
    }
    if drift.familiar_percent >= 90.0 && drift.unrated_percent <= 5.0 {
        drift.warnings.push(
            "This queue is very familiar. Add a little unrated exploration for discovery."
                .to_string(),
        );
    }
    if drift.clap_percent <= 10.0 && drift.total_tracks >= 10 {
        drift
            .warnings
            .push("Few tracks use CLAP similarity. Analyze more music to improve sound-based recommendations.".to_string());
    }
    drift
}

fn record_native_recommendation_run(
    connection: &Connection,
    settings: &NativeAutoDjSettings,
    drift: &NativeRecommendationDrift,
    tracks: &[NativeQueueTrack],
) {
    let track_ids: Vec<i64> = tracks.iter().map(|track| track.track.id).collect();
    let _ = connection.execute(
        r#"
        INSERT INTO recommendation_runs(settings_json, drift_json, track_ids_json)
        VALUES(?, ?, ?)
        "#,
        params![
            serde_json::to_string(settings).unwrap_or_else(|_| "{}".to_string()),
            serde_json::to_string(drift).unwrap_or_else(|_| "{}".to_string()),
            serde_json::to_string(&track_ids).unwrap_or_else(|_| "[]".to_string())
        ],
    );
    let _ = connection.execute(
        r#"
        DELETE FROM recommendation_runs
        WHERE id NOT IN (
          SELECT id FROM recommendation_runs ORDER BY datetime(created_at) DESC, id DESC LIMIT 100
        )
        "#,
        [],
    );
}

#[tauri::command]
pub fn native_generate_autodj(
    _state: State<'_, NativeLibraryState>,
    settings: serde_json::Value,
) -> Result<NativeAutoDjResponse, String> {
    generate_autodj_response(settings)
}

pub(crate) fn generate_autodj_response(
    settings: serde_json::Value,
) -> Result<NativeAutoDjResponse, String> {
    const MAX_DYNAMIC_CANDIDATES: usize = 8_000;
    let settings = native_autodj_settings(settings);
    let connection = open_database()?;
    let mut rng = NativeRng::new(settings.seed);
    let avoid_rules = read_autodj_avoid_rules(&connection)?;
    let candidates = read_autodj_candidates(&connection)?;
    let seed_track = settings.seed_track_id.and_then(|seed_id| {
        candidates
            .iter()
            .find(|candidate| candidate.track.id == seed_id)
            .map(|candidate| candidate.track.clone())
    });
    let mut remaining: Vec<NativeCandidate> = candidates
        .into_iter()
        .filter(|candidate| !track_is_longform(&candidate.track))
        .filter(|candidate| !track_matches_avoid(&candidate.track, &avoid_rules))
        .filter(|candidate| match settings.minimum_rating {
            Some(minimum) => candidate
                .track
                .rating
                .is_some_and(|rating| rating >= minimum),
            None => true,
        })
        .map(|candidate| score_candidate(candidate, &settings, &mut rng, seed_track.as_ref()))
        .collect();
    if remaining.is_empty() && settings.minimum_rating.is_some() {
        remaining = read_autodj_candidates(&connection)?
            .into_iter()
            .filter(|candidate| !track_is_longform(&candidate.track))
            .filter(|candidate| !track_matches_avoid(&candidate.track, &avoid_rules))
            .map(|candidate| score_candidate(candidate, &settings, &mut rng, seed_track.as_ref()))
            .collect();
    }
    remaining.sort_by(|left, right| right.score.total_cmp(&left.score));

    let target_unrated_percent = settings
        .target_unrated_percent
        .unwrap_or(settings.unrated_exploration_percent);
    let target_unrated =
        ((settings.queue_length as f64 * target_unrated_percent / 100.0).round()) as usize;
    let target_exploratory = settings
        .target_exploration_percent
        .map(|value| ((settings.queue_length as f64 * value / 100.0).round()) as usize);
    let mut chosen_unrated = 0usize;
    let mut chosen_exploratory = 0usize;
    let mut queue = Vec::<NativeQueueTrack>::new();
    let mut recent_artists = Vec::<HashSet<String>>::new();
    let mut recent_albums = Vec::<String>::new();

    if let Some(seed_track) = seed_track {
        if settings.queue_length > 0 {
            let seed_item = NativeCandidateTrack {
                track: seed_track.clone(),
                feedback_score: 0.0,
                days_since_played: None,
                days_since_skipped: None,
            };
            let mut seed_candidate =
                score_candidate(seed_item, &settings, &mut rng, Some(&seed_track));
            seed_candidate.breakdown.insert("seed".to_string(), 1.0);
            seed_candidate
                .breakdown
                .insert("total".to_string(), round3(seed_candidate.score));
            seed_candidate.reason = format!("seed track, {}", seed_candidate.reason);
            if seed_track.rating.is_none() {
                chosen_unrated += 1;
            }
            if track_is_exploratory(&seed_track) {
                chosen_exploratory += 1;
            }
            recent_artists.insert(0, split_artist_tokens(seed_track.artist.as_deref()));
            recent_albums.insert(0, album_key(seed_track.album.as_deref()));
            queue.push(candidate_to_queue_track(seed_candidate));
            remaining.retain(|candidate| candidate.item.track.id != seed_track.id);
        }
    }

    while !remaining.is_empty() && queue.len() < settings.queue_length {
        let slots_left = settings.queue_length - queue.len();
        let must_pick_unrated = target_unrated.saturating_sub(chosen_unrated) >= slots_left;
        let must_pick_exploratory = target_exploratory
            .map(|target| target.saturating_sub(chosen_exploratory) >= slots_left)
            .unwrap_or(false);
        let mut pool: Vec<usize> = remaining
            .iter()
            .enumerate()
            .filter_map(|(index, candidate)| {
                if (!must_pick_unrated || candidate.is_unrated)
                    && (!must_pick_exploratory || candidate.is_exploratory)
                {
                    Some(index)
                } else {
                    None
                }
            })
            .collect();
        if pool.is_empty() {
            pool = (0..remaining.len()).collect();
        }
        let strict_pool: Vec<usize> = pool
            .iter()
            .copied()
            .filter(|index| {
                !candidate_conflicts(
                    &remaining[*index],
                    &recent_artists[..recent_artists.len().min(settings.artist_cooldown)],
                    &recent_albums[..recent_albums.len().min(settings.album_cooldown)],
                )
            })
            .collect();
        let apply_cooldown_penalty = strict_pool.is_empty();
        if !strict_pool.is_empty() {
            pool = strict_pool;
        }
        let shortlist: Vec<usize> = pool.into_iter().take(MAX_DYNAMIC_CANDIDATES).collect();
        let adjusted: Vec<NativeCandidate> = shortlist
            .iter()
            .map(|index| {
                adjusted_candidate_for_queue(
                    &remaining[*index],
                    &queue,
                    &settings,
                    &recent_artists[..recent_artists.len().min(settings.artist_cooldown)],
                    &recent_albums[..recent_albums.len().min(settings.album_cooldown)],
                    apply_cooldown_penalty,
                )
            })
            .collect();
        if adjusted.is_empty() {
            break;
        }
        let picked_adjusted_index =
            weighted_choice(&adjusted, settings.temperature, &mut rng).min(shortlist.len() - 1);
        let picked_remaining_index = shortlist[picked_adjusted_index];
        let picked = adjusted[picked_adjusted_index].clone();
        if picked.is_unrated {
            chosen_unrated += 1;
        }
        if picked.is_exploratory {
            chosen_exploratory += 1;
        }
        recent_artists.insert(0, picked.artist_keys.clone());
        recent_albums.insert(0, picked.album_key.clone());
        recent_artists.truncate(settings.artist_cooldown.max(1));
        recent_albums.truncate(settings.album_cooldown.max(1));
        queue.push(candidate_to_queue_track(picked));
        remaining.remove(picked_remaining_index);
    }

    let drift = native_recommendation_drift(&queue);
    record_native_recommendation_run(&connection, &settings, &drift, &queue);
    Ok(NativeAutoDjResponse {
        tracks: queue,
        settings,
        drift,
        source: "rust-sqlite".to_string(),
    })
}
