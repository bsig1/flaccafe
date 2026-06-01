fn score_candidate(
    item: DesktopCandidateTrack,
    settings: &DesktopAutoDjSettings,
    rng: &mut DesktopRng,
    seed_track: Option<&DesktopTrack>,
) -> DesktopCandidate {
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
    let (mood_seed_delta, mood_seed_reason) = mood_seed_adjustment(track, settings);
    if mood_seed_delta != 0.0 {
        score += mood_seed_delta;
        breakdown.insert("mood_seed".to_string(), round3(mood_seed_delta));
        if !mood_seed_reason.is_empty() {
            reasons.push(mood_seed_reason);
        }
    }
    let (decade_seed_delta, decade_seed_reason) = decade_seed_adjustment(track, seed_track, settings);
    if decade_seed_delta != 0.0 {
        score += decade_seed_delta;
        breakdown.insert("decade_seed".to_string(), round3(decade_seed_delta));
        reasons.push(decade_seed_reason);
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

    DesktopCandidate {
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

fn decade_seed_adjustment(
    track: &DesktopTrack,
    seed_track: Option<&DesktopTrack>,
    settings: &DesktopAutoDjSettings,
) -> (f64, String) {
    let Some(seed_track) = seed_track else {
        return (0.0, String::new());
    };
    if track.id == seed_track.id {
        return (0.0, String::new());
    }
    let (Some(year), Some(seed_year)) = (track.year, seed_track.year) else {
        return (0.0, String::new());
    };
    if year / 10 != seed_year / 10 {
        return (0.0, String::new());
    }
    if settings
        .mood_avoid_seeds
        .iter()
        .any(|seed| seed == "same decade")
    {
        return (-settings.mood_avoid_weight, "avoid same decade".to_string());
    }
    if settings.mood_seeds.iter().any(|seed| seed == "same decade") {
        return (settings.mood_seed_weight, "same decade".to_string());
    }
    (0.0, String::new())
}

fn candidate_conflicts(
    candidate: &DesktopCandidate,
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

#[derive(Default)]
struct QueueSelectionStats {
    len: usize,
    unrated: usize,
    exploratory: usize,
    artist_keys: HashSet<String>,
}

impl QueueSelectionStats {
    fn push_track(&mut self, track: &DesktopTrack) {
        self.len += 1;
        if track.rating.is_none() {
            self.unrated += 1;
        }
        if track_is_exploratory(track) {
            self.exploratory += 1;
        }
        let tokens = split_artist_tokens(track.artist.as_deref());
        if tokens.is_empty() {
            let fallback = normalize_token(track.artist.as_deref());
            if !fallback.is_empty() {
                self.artist_keys.insert(fallback);
            }
        } else {
            self.artist_keys.extend(tokens.into_iter().filter(|token| !token.is_empty()));
        }
    }
}

fn target_drift_adjustment(
    selected: &QueueSelectionStats,
    candidate: &DesktopCandidate,
    settings: &DesktopAutoDjSettings,
) -> (f64, String) {
    let mut score = 0.0;
    let mut reasons = Vec::new();
    if let Some(target) = settings.target_unrated_percent {
        let target_fraction = target / 100.0;
        let current_fraction = if selected.len == 0 {
            0.0
        } else {
            selected.unrated as f64 / selected.len as f64
        };
        if candidate.is_unrated && current_fraction < target_fraction {
            score += 0.75;
            reasons.push("unrated target");
        } else if !candidate.is_unrated && current_fraction < target_fraction {
            score -= 0.45;
            reasons.push("unrated target");
        }
    }
    if let Some(target) = settings.target_exploration_percent {
        let target_fraction = target / 100.0;
        let current_fraction = if selected.len == 0 {
            0.0
        } else {
            selected.exploratory as f64 / selected.len as f64
        };
        if candidate.is_exploratory && current_fraction < target_fraction {
            score += 0.6;
            reasons.push("exploration target");
        } else if !candidate.is_exploratory && current_fraction < target_fraction {
            score -= 0.35;
            reasons.push("exploration target");
        }
    }
    if let Some(max_repeat) = settings.max_repeat_artist_percent {
        let mut projected_unique = selected.artist_keys.len();
        for token in &candidate.artist_keys {
            if !selected.artist_keys.contains(token) {
                projected_unique += 1;
            }
        }
        let projected_len = selected.len + 1;
        let projected_repeat_percent = if projected_len == 0 {
            0.0
        } else {
            ((projected_len.saturating_sub(projected_unique)) as f64 / projected_len as f64)
                * 100.0
        };
        let overage = projected_repeat_percent - max_repeat;
        if overage > 0.0 {
            score -= (0.16 * overage).min(4.0);
            reasons.push("repeat artist target");
        }
    }
    (score, reasons.join(", "))
}

fn adjusted_candidate_for_queue(
    base: &DesktopCandidate,
    queue_stats: &QueueSelectionStats,
    settings: &DesktopAutoDjSettings,
    recent_artists: &[HashSet<String>],
    recent_albums: &[String],
    cooldown_penalty: bool,
) -> DesktopCandidate {
    let mut adjusted = base.clone();
    let (drift_delta, drift_reason) = target_drift_adjustment(queue_stats, &adjusted, settings);
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

fn adjusted_candidate_score(
    base: &DesktopCandidate,
    queue_stats: &QueueSelectionStats,
    settings: &DesktopAutoDjSettings,
    recent_artists: &[HashSet<String>],
    recent_albums: &[String],
    cooldown_penalty: bool,
) -> f64 {
    let (drift_delta, _) = target_drift_adjustment(queue_stats, base, settings);
    let cooldown_delta = if cooldown_penalty && candidate_conflicts(base, recent_artists, recent_albums)
    {
        -2.0
    } else {
        0.0
    };
    base.score + drift_delta + cooldown_delta
}

fn weighted_choice_by_score(
    scores: &[f64],
    temperature: f64,
    rng: &mut DesktopRng,
) -> usize {
    let max_score = scores.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let temperature = temperature.max(0.05);
    let total: f64 = scores
        .iter()
        .map(|score| ((*score - max_score) / temperature).exp())
        .sum();
    let mut pick = rng.next_f64() * total;
    for (index, score) in scores.iter().enumerate() {
        let weight = ((*score - max_score) / temperature).exp();
        pick -= weight;
        if pick <= 0.0 {
            return index;
        }
    }
    scores.len().saturating_sub(1)
}

fn candidate_to_queue_track(candidate: DesktopCandidate) -> DesktopQueueTrack {
    DesktopQueueTrack {
        track: candidate.item.track,
        score: round3(candidate.score),
        reason: candidate.reason,
        score_breakdown: candidate.breakdown,
    }
}

fn read_autodj_candidates(connection: &Connection) -> Result<Vec<DesktopCandidateTrack>, String> {
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
        .map_err(|error| format!("Could not prepare Rust AutoDJ candidates: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(DesktopCandidateTrack {
                track: track_from_row(row)?,
                feedback_score: row.get::<_, Option<f64>>("feedback_score")?.unwrap_or(0.0),
                days_since_played: row.get("days_since_played")?,
                days_since_skipped: row.get("days_since_skipped")?,
            })
        })
        .map_err(|error| format!("Could not read Rust AutoDJ candidates: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust AutoDJ candidates: {error}"))
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
        .map_err(|error| format!("Could not prepare Rust AutoDJ avoid rules: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, Option<String>>("scope")?.unwrap_or_default(),
                row.get::<_, Option<String>>("target_key")?
                    .unwrap_or_default(),
            ))
        })
        .map_err(|error| format!("Could not read Rust AutoDJ avoid rules: {error}"))?;
    for row in rows {
        let (scope, target_key) =
            row.map_err(|error| format!("Could not decode Rust AutoDJ avoid rules: {error}"))?;
        avoid_rules.entry(scope).or_default().insert(target_key);
    }
    Ok(avoid_rules)
}

