#[derive(Clone)]
struct DesktopCandidateTrack {
    track: DesktopTrack,
    feedback_score: f64,
    days_since_played: Option<f64>,
    days_since_skipped: Option<f64>,
}

#[derive(Clone)]
struct DesktopCandidate {
    item: DesktopCandidateTrack,
    score: f64,
    reason: String,
    breakdown: BTreeMap<String, f64>,
    artist_keys: HashSet<String>,
    album_key: String,
    is_unrated: bool,
    is_exploratory: bool,
}

struct DesktopRng {
    state: u64,
}

impl DesktopRng {
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

fn combined_genre(track: &DesktopTrack) -> Option<String> {
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

fn track_is_longform(track: &DesktopTrack) -> bool {
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

fn track_is_familiar(track: &DesktopTrack) -> bool {
    track.rating.is_some() || track.play_count > 0
}

fn track_is_exploratory(track: &DesktopTrack) -> bool {
    !track_is_familiar(track) && (track.rating.is_none() || track.play_count == 0)
}

fn track_matches_avoid(
    track: &DesktopTrack,
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
    track: &DesktopTrack,
    seed_track: Option<&DesktopTrack>,
    settings: &DesktopAutoDjSettings,
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

