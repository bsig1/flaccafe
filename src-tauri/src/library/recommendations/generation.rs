fn recommendation_drift(tracks: &[DesktopQueueTrack]) -> DesktopRecommendationDrift {
    let total = tracks.len();
    if total == 0 {
        return DesktopRecommendationDrift::default();
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
    let mut drift = DesktopRecommendationDrift {
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

fn record_recommendation_run(
    connection: &Connection,
    settings: &DesktopAutoDjSettings,
    drift: &DesktopRecommendationDrift,
    tracks: &[DesktopQueueTrack],
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
pub fn generate_autodj(
    _state: State<'_, DesktopLibraryState>,
    settings: serde_json::Value,
) -> Result<DesktopAutoDjResponse, String> {
    generate_autodj_response(settings)
}

pub(crate) fn generate_autodj_response(
    settings: serde_json::Value,
) -> Result<DesktopAutoDjResponse, String> {
    const MAX_DYNAMIC_CANDIDATES: usize = 8_000;
    let settings = autodj_settings(settings);
    let connection = open_database()?;
    let mut rng = DesktopRng::new(settings.seed);
    let avoid_rules = read_autodj_avoid_rules(&connection)?;
    let candidates = read_autodj_candidates(&connection)?;
    let seed_track = settings.seed_track_id.and_then(|seed_id| {
        candidates
            .iter()
            .find(|candidate| candidate.track.id == seed_id)
            .map(|candidate| candidate.track.clone())
    });
    let mut remaining: Vec<DesktopCandidate> = candidates
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
    let mut queue = Vec::<DesktopQueueTrack>::new();
    let mut queue_stats = QueueSelectionStats::default();
    let mut recent_artists = Vec::<HashSet<String>>::new();
    let mut recent_albums = Vec::<String>::new();

    if let Some(seed_track) = seed_track {
        if settings.queue_length > 0 {
            let seed_item = DesktopCandidateTrack {
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
            queue_stats.push_track(&seed_track);
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
        let recent_artist_window =
            &recent_artists[..recent_artists.len().min(settings.artist_cooldown)];
        let recent_album_window = &recent_albums[..recent_albums.len().min(settings.album_cooldown)];
        let mut shortlist = Vec::with_capacity(MAX_DYNAMIC_CANDIDATES.min(remaining.len()));
        let mut relaxed_shortlist = Vec::with_capacity(MAX_DYNAMIC_CANDIDATES.min(remaining.len()));
        for (index, candidate) in remaining.iter().enumerate() {
            if (must_pick_unrated && !candidate.is_unrated)
                || (must_pick_exploratory && !candidate.is_exploratory)
            {
                continue;
            }
            if relaxed_shortlist.len() < MAX_DYNAMIC_CANDIDATES {
                relaxed_shortlist.push(index);
            }
            if shortlist.len() < MAX_DYNAMIC_CANDIDATES
                && !candidate_conflicts(candidate, recent_artist_window, recent_album_window)
            {
                shortlist.push(index);
            }
        }
        if relaxed_shortlist.is_empty() {
            for index in 0..remaining.len().min(MAX_DYNAMIC_CANDIDATES) {
                relaxed_shortlist.push(index);
            }
            shortlist = relaxed_shortlist
                .iter()
                .copied()
                .filter(|index| {
                    !candidate_conflicts(&remaining[*index], recent_artist_window, recent_album_window)
                })
                .collect();
        }
        let apply_cooldown_penalty = shortlist.is_empty();
        if apply_cooldown_penalty {
            shortlist = relaxed_shortlist;
        }
        let adjusted_scores: Vec<f64> = shortlist
            .iter()
            .map(|index| {
                adjusted_candidate_score(
                    &remaining[*index],
                    &queue_stats,
                    &settings,
                    recent_artist_window,
                    recent_album_window,
                    apply_cooldown_penalty,
                )
            })
            .collect();
        if adjusted_scores.is_empty() {
            break;
        }
        let picked_adjusted_index = weighted_choice_by_score(
            &adjusted_scores,
            settings.temperature,
            &mut rng,
        )
        .min(shortlist.len() - 1);
        let picked_remaining_index = shortlist[picked_adjusted_index];
        let picked = adjusted_candidate_for_queue(
            &remaining[picked_remaining_index],
            &queue_stats,
            &settings,
            recent_artist_window,
            recent_album_window,
            apply_cooldown_penalty,
        );
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
        queue_stats.push_track(&picked.item.track);
        queue.push(candidate_to_queue_track(picked));
        remaining.remove(picked_remaining_index);
    }

    let drift = recommendation_drift(&queue);
    record_recommendation_run(&connection, &settings, &drift, &queue);
    Ok(DesktopAutoDjResponse {
        tracks: queue,
        settings,
        drift,
        source: "rust-sqlite".to_string(),
    })
}
