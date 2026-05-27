use super::*;

const WIKIPEDIA_SHORT_SUMMARY_WORDS: usize = 70;
const WIKIPEDIA_EXTENDED_SUMMARY_WORDS: usize = 260;
const WIKIPEDIA_HIGH_CONFIDENCE: f64 = 0.85;
const WIKIPEDIA_SEARCH_LIMIT: usize = 5;
const WIKIPEDIA_MAX_CANDIDATE_SUMMARIES: usize = 8;

fn wikipedia_summary_url(title: &str) -> String {
    format!(
        "https://en.wikipedia.org/api/rest_v1/page/summary/{}",
        urlencoding::encode(title)
    )
}

fn wikipedia_extract_url(title: &str) -> String {
    format!(
        "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles={}",
        urlencoding::encode(title)
    )
}

fn word_count(value: &str) -> usize {
    value.split_whitespace().filter(|word| !word.is_empty()).count()
}

fn truncate_words(value: &str, max_words: usize) -> String {
    let words = value.split_whitespace().collect::<Vec<_>>();
    if words.len() <= max_words {
        return value.trim().to_string();
    }
    format!("{}...", words[..max_words].join(" "))
}

fn wikipedia_page_extract(title: &str) -> Result<Option<String>, String> {
    let response = match ureq::get(&wikipedia_extract_url(title))
        .set(
            "User-Agent",
            "FLAC Cafe/0.5 (https://github.com/bsig1/flaccafe)",
        )
        .call()
    {
        Ok(response) => response,
        Err(ureq::Error::Status(404, _)) => return Ok(None),
        Err(error) => return Err(format!("Wikipedia extended lookup failed: {error}")),
    };
    let payload = response
        .into_json::<serde_json::Value>()
        .map_err(|error| format!("Wikipedia extended lookup returned invalid JSON: {error}"))?;
    Ok(payload
        .get("query")
        .and_then(|query| query.get("pages"))
        .and_then(serde_json::Value::as_object)
        .and_then(|pages| pages.values().next())
        .and_then(|page| page.get("extract"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| truncate_words(value, WIKIPEDIA_EXTENDED_SUMMARY_WORDS)))
}

fn wikipedia_page_summary(title: &str) -> Result<Option<DesktopArtistInfoResponse>, String> {
    let response = match ureq::get(&wikipedia_summary_url(title))
        .set(
            "User-Agent",
            "FLAC Cafe/0.5 (https://github.com/bsig1/flaccafe)",
        )
        .call()
    {
        Ok(response) => response,
        Err(ureq::Error::Status(404, _)) => return Ok(None),
        Err(error) => return Err(format!("Wikipedia lookup failed: {error}")),
    };
    let payload = response
        .into_json::<serde_json::Value>()
        .map_err(|error| format!("Wikipedia returned invalid JSON: {error}"))?;
    let summary = payload
        .get("extract")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let page_type = payload
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    if summary.is_none() || page_type.eq_ignore_ascii_case("disambiguation") {
        return Ok(None);
    }
    let artist_name = payload
        .get("title")
        .and_then(serde_json::Value::as_str)
        .unwrap_or(title)
        .to_string();
    let image_url = payload
        .get("thumbnail")
        .and_then(|value| value.get("source"))
        .or_else(|| {
            payload
                .get("originalimage")
                .and_then(|value| value.get("source"))
        })
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let page_url = payload
        .get("content_urls")
        .and_then(|value| value.get("desktop"))
        .and_then(|value| value.get("page"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    Ok(Some(DesktopArtistInfoResponse {
        artist_name,
        query: title.to_string(),
        summary,
        image_url,
        page_url,
        source: Some("Wikipedia".to_string()),
        found: true,
        confidence: 0.0,
        from_cache: false,
        updated_at: Some(scan::utc_now()),
        error: None,
    }))
}

fn enrich_wikipedia_summary(
    mut info: DesktopArtistInfoResponse,
) -> Result<DesktopArtistInfoResponse, String> {
    if info
        .summary
        .as_deref()
        .is_none_or(|value| word_count(value) >= WIKIPEDIA_SHORT_SUMMARY_WORDS)
    {
        return Ok(info);
    }
    if let Some(extended) = wikipedia_page_extract(&info.artist_name)? {
        if info
            .summary
            .as_deref()
            .is_none_or(|current| word_count(&extended) > word_count(current))
        {
            info.summary = Some(extended);
        }
    }
    Ok(info)
}

fn wikipedia_search_titles(search: &str, limit: usize) -> Result<Vec<String>, String> {
    let mut titles = Vec::new();
    let url = format!(
        "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit={}&srnamespace=0&srsearch={}",
        limit.clamp(1, 10),
        urlencoding::encode(search)
    );
    let response = ureq::get(&url)
        .set(
            "User-Agent",
            "FLAC Cafe/0.5 (https://github.com/bsig1/flaccafe)",
        )
        .call()
        .map_err(|error| format!("Wikipedia search failed: {error}"))?;
    let payload = response
        .into_json::<serde_json::Value>()
        .map_err(|error| format!("Wikipedia search returned invalid JSON: {error}"))?;
    for title in payload
        .get("query")
        .and_then(|query| query.get("search"))
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("title").and_then(serde_json::Value::as_str))
    {
        if !titles
            .iter()
            .any(|existing: &String| existing.eq_ignore_ascii_case(title))
        {
            titles.push(title.to_string());
        }
    }
    Ok(titles)
}

fn normalized_artist_lookup(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_alphanumeric() {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn text_contains_any(text: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| text.contains(needle))
}

fn artist_summary_score(query: &str, info: &DesktopArtistInfoResponse) -> i64 {
    let query_normalized = normalized_artist_lookup(query);
    let title_normalized = normalized_artist_lookup(&info.artist_name);
    let summary = info.summary.as_deref().unwrap_or_default().to_lowercase();
    let page_url = info.page_url.as_deref().unwrap_or_default().to_lowercase();
    let mut score = 0;

    if title_normalized == query_normalized {
        score += 220;
    } else if title_normalized.contains(&query_normalized) {
        score += 90;
    } else if query_normalized.contains(&title_normalized) {
        score += 45;
    }
    if page_url.contains("(musician)") || page_url.contains("(singer)") || page_url.contains("(band)") {
        score += 40;
    }
    if text_contains_any(
        &summary,
        &[
            "singer",
            "songwriter",
            "musician",
            "band",
            "duo",
            "rapper",
            "record producer",
            "pop",
            "rock",
            "album",
            "music",
        ],
    ) {
        score += 70;
    }
    if text_contains_any(
        &summary,
        &[
            "footballer",
            "politician",
            "cricketer",
            "basketball",
            "baseball",
            "wrestler",
            "bishop",
            "military",
        ],
    ) {
        score -= 90;
    }
    if title_normalized.contains("discography") || title_normalized.contains("song") {
        score -= 80;
    }
    score
}

fn artist_summary_confidence(score: i64) -> f64 {
    ((score.max(0) as f64) / 330.0).clamp(0.0, 1.0)
}

fn is_high_confidence_artist_score(score: i64) -> bool {
    artist_summary_confidence(score) >= WIKIPEDIA_HIGH_CONFIDENCE
}

fn finalize_artist_info_candidate(
    query: &str,
    info: DesktopArtistInfoResponse,
    score: i64,
) -> Result<DesktopArtistInfoResponse, String> {
    let mut response = DesktopArtistInfoResponse {
        query: query.to_string(),
        ..info
    };
    response.confidence = artist_summary_confidence(score);
    enrich_wikipedia_summary(response)
}

fn response_confidence(query: &str, info: &DesktopArtistInfoResponse) -> f64 {
    if !info.found {
        return 0.0;
    }
    if info
        .source
        .as_deref()
        .is_some_and(|source| source.contains(":manual"))
    {
        return 1.0;
    }
    artist_summary_confidence(artist_summary_score(query, info))
}

fn with_artist_confidence(
    query: &str,
    mut info: DesktopArtistInfoResponse,
) -> DesktopArtistInfoResponse {
    info.confidence = response_confidence(query, &info);
    info
}

fn wikipedia_title_from_input(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Wikipedia title or URL is required".to_string());
    }
    let raw_title = if let Some(index) = trimmed.find("/wiki/") {
        &trimmed[index + "/wiki/".len()..]
    } else if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Err("Use a Wikipedia page URL or page title".to_string());
    } else {
        trimmed
    };
    let raw_title = raw_title
        .split(['?', '#'])
        .next()
        .unwrap_or(raw_title)
        .trim();
    let decoded = urlencoding::decode(raw_title)
        .map_err(|error| format!("Could not decode Wikipedia title: {error}"))?;
    let title = decoded.replace('_', " ").trim().to_string();
    if title.is_empty() {
        return Err("Wikipedia title or URL is required".to_string());
    }
    Ok(title)
}

fn artist_lookup_components(value: &str) -> Vec<String> {
    let text = value
        .replace(['\u{2010}', '\u{2011}', '\u{2012}', '\u{2013}', '\u{2014}'], "-")
        .to_lowercase();
    let mut hard_split_text = text;
    for marker in [
        " featuring ",
        " feat. ",
        " feat ",
        " ft. ",
        " ft ",
        " with ",
    ] {
        hard_split_text = hard_split_text.replace(marker, ";");
    }
    hard_split_text
        .split([';', '|', ','])
        .flat_map(split_ambiguous_artist_connectors)
        .map(|part| normalized_artist_lookup(&part))
        .filter(|part| !part.is_empty())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect()
}

fn split_ambiguous_artist_connectors(value: &str) -> Vec<String> {
    let mut remaining = value.trim();
    let mut names = Vec::new();
    while !remaining.is_empty() {
        let Some((index, marker_len)) = ambiguous_artist_connector(remaining) else {
            names.push(remaining.to_string());
            break;
        };
        let left = remaining[..index].trim();
        let right = remaining[index + marker_len..].trim();
        if left.is_empty() || right.is_empty() || starts_with_artist_article(right) {
            names.push(remaining.to_string());
            break;
        }
        names.push(left.to_string());
        remaining = right;
    }
    names
}

fn ambiguous_artist_connector(value: &str) -> Option<(usize, usize)> {
    [" & ", " + ", " \u{00d7} ", " x "]
        .iter()
        .filter_map(|marker| value.find(marker).map(|index| (index, marker.len())))
        .min_by_key(|(index, _)| *index)
}

fn starts_with_artist_article(value: &str) -> bool {
    let trimmed = value.trim_start();
    trimmed.starts_with("the ") || trimmed.starts_with("a ") || trimmed.starts_with("an ")
}

fn artist_tag_matches_lookup(query: &str, value: Option<&str>) -> bool {
    let Some(value) = value else {
        return false;
    };
    let query = normalized_artist_lookup(query);
    if query.is_empty() {
        return false;
    }
    normalized_artist_lookup(value) == query
        || artist_lookup_components(value)
            .iter()
            .any(|component| component == &query)
}

fn track_matches_artist_lookup(track: &DesktopTrack, artist: &str) -> bool {
    artist_tag_matches_lookup(artist, track.artist.as_deref())
        || artist_tag_matches_lookup(artist, track.album_artist.as_deref())
}

fn fetch_artist_info(query: &str) -> Result<DesktopArtistInfoResponse, String> {
    let mut candidates: Vec<(i64, DesktopArtistInfoResponse)> = Vec::new();
    let mut seen_titles = HashSet::new();
    if let Some(info) = wikipedia_page_summary(query)? {
        seen_titles.insert(info.artist_name.to_lowercase());
        let score = artist_summary_score(query, &info);
        if is_high_confidence_artist_score(score) {
            return finalize_artist_info_candidate(query, info, score);
        }
        candidates.push((score, info));
    }

    let search_batches = [
        vec![format!("\"{query}\" musician"), format!("\"{query}\" band")],
        vec![format!("\"{query}\" singer")],
        vec![format!("{query} musician OR band"), query.to_string()],
    ];
    let mut checked_summaries = 0usize;
    for searches in search_batches {
        for search in searches {
            if checked_summaries >= WIKIPEDIA_MAX_CANDIDATE_SUMMARIES {
                break;
            }
            for title in wikipedia_search_titles(&search, WIKIPEDIA_SEARCH_LIMIT)? {
                if checked_summaries >= WIKIPEDIA_MAX_CANDIDATE_SUMMARIES {
                    break;
                }
                if !seen_titles.insert(title.to_lowercase()) {
                    continue;
                }
                checked_summaries += 1;
                let Some(info) = wikipedia_page_summary(&title)? else {
                    continue;
                };
                let score = artist_summary_score(query, &info);
                if is_high_confidence_artist_score(score) {
                    return finalize_artist_info_candidate(query, info, score);
                }
                candidates.push((score, info));
            }
        }
        if candidates
            .iter()
            .any(|(score, _)| is_high_confidence_artist_score(*score))
            || checked_summaries >= WIKIPEDIA_MAX_CANDIDATE_SUMMARIES
        {
            break;
        }
    }
    if let Some((score, info)) = candidates.into_iter().max_by_key(|(score, _)| *score) {
        if score > 0 {
            return finalize_artist_info_candidate(query, info, score);
        }
    }
    Ok(DesktopArtistInfoResponse {
        artist_name: query.to_string(),
        query: query.to_string(),
        summary: None,
        image_url: None,
        page_url: None,
        source: Some("Wikipedia".to_string()),
        found: false,
        confidence: 0.0,
        from_cache: false,
        updated_at: Some(scan::utc_now()),
        error: Some("No artist info found".to_string()),
    })
}

fn save_artist_info_cache(
    connection: &Connection,
    key: &str,
    query: &str,
    info: &DesktopArtistInfoResponse,
) -> Result<DesktopArtistInfoResponse, String> {
    let updated_at = scan::utc_now();
    connection
        .execute(
            r#"
            INSERT INTO artist_info_cache(
              artist_key, artist_name, summary, image_url, page_url, source, updated_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(artist_key) DO UPDATE SET
              artist_name = excluded.artist_name,
              summary = excluded.summary,
              image_url = excluded.image_url,
              page_url = excluded.page_url,
              source = excluded.source,
              updated_at = excluded.updated_at
            "#,
            params![
                key,
                &info.artist_name,
                &info.summary,
                &info.image_url,
                &info.page_url,
                &info.source,
                updated_at
            ],
        )
        .map_err(|error| format!("Could not save artist info cache: {error}"))?;
    Ok(DesktopArtistInfoResponse {
        artist_name: info.artist_name.clone(),
        query: query.to_string(),
        summary: info.summary.clone(),
        image_url: info.image_url.clone(),
        page_url: info.page_url.clone(),
        source: info.source.clone(),
        found: info.found,
        confidence: info.confidence,
        from_cache: false,
        updated_at: Some(updated_at),
        error: info.error.clone(),
    })
}

async fn run_artist_task<T: Send + 'static>(
    label: &'static str,
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("{label} worker failed: {error}"))?
}

fn artist_info_inner(
    name: String,
    refresh: Option<bool>,
) -> Result<DesktopArtistInfoResponse, String> {
    let query = primary_artist_name(&name);
    if query.trim().is_empty() {
        return Err("Artist name is required".to_string());
    }
    let connection = open_database()?;
    let refresh = refresh.unwrap_or(false);
    let sql = if refresh {
        "SELECT artist_name, summary, image_url, page_url, source, updated_at
         FROM artist_info_cache
         WHERE artist_key = ?"
    } else {
        "SELECT artist_name, summary, image_url, page_url, source, updated_at
         FROM artist_info_cache
         WHERE artist_key = ? AND updated_at >= datetime('now', '-30 days')"
    };
    let key = artist_cache_key(&query);
    if let Ok(response) = connection.query_row(sql, params![&key], |row| {
        let summary: Option<String> = row.get("summary")?;
        let response = DesktopArtistInfoResponse {
            artist_name: row
                .get::<_, Option<String>>("artist_name")?
                .unwrap_or_else(|| query.clone()),
            query: query.clone(),
            summary: summary.clone(),
            image_url: row.get("image_url")?,
            page_url: row.get("page_url")?,
            source: row.get("source")?,
            found: summary
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty()),
            confidence: 0.0,
            from_cache: true,
            updated_at: row.get("updated_at")?,
            error: None,
        };
        Ok(with_artist_confidence(&query, response))
    }) {
        return Ok(response);
    }
    let fetched = match fetch_artist_info(&query) {
        Ok(info) => info,
        Err(error) => {
            if let Ok(mut stale) = connection.query_row(
                "SELECT artist_name, summary, image_url, page_url, source, updated_at
                 FROM artist_info_cache
                 WHERE artist_key = ?",
                params![&key],
                |row| {
                    let summary: Option<String> = row.get("summary")?;
                    let response = DesktopArtistInfoResponse {
                        artist_name: row
                            .get::<_, Option<String>>("artist_name")?
                            .unwrap_or_else(|| query.clone()),
                        query: query.clone(),
                        summary: summary.clone(),
                        image_url: row.get("image_url")?,
                        page_url: row.get("page_url")?,
                        source: row.get("source")?,
                        found: summary
                            .as_deref()
                            .is_some_and(|value| !value.trim().is_empty()),
                        confidence: 0.0,
                        from_cache: true,
                        updated_at: row.get("updated_at")?,
                        error: None,
                    };
                    Ok(with_artist_confidence(&query, response))
                },
            ) {
                stale.error = Some(error);
                return Ok(stale);
            }
            return Err(error);
        }
    };
    save_artist_info_cache(&connection, &key, &query, &fetched)
}

#[tauri::command]
pub async fn artist_info(
    name: String,
    refresh: Option<bool>,
) -> Result<DesktopArtistInfoResponse, String> {
    run_artist_task("Artist info", move || artist_info_inner(name, refresh)).await
}

pub fn artist_info_blocking(
    _state: State<'_, DesktopLibraryState>,
    name: String,
    refresh: Option<bool>,
) -> Result<DesktopArtistInfoResponse, String> {
    artist_info_inner(name, refresh)
}

fn save_artist_info_override_inner(
    name: String,
    wikipedia_title_or_url: String,
) -> Result<DesktopArtistInfoResponse, String> {
    let query = primary_artist_name(&name);
    if query.trim().is_empty() {
        return Err("Artist name is required".to_string());
    }
    let title = wikipedia_title_from_input(&wikipedia_title_or_url)?;
    let mut info = enrich_wikipedia_summary(
        wikipedia_page_summary(&title)?
            .ok_or_else(|| "Wikipedia page not found or has no usable summary".to_string())?,
    )?;
    info.query = query.clone();
    info.source = Some("Wikipedia:manual".to_string());
    info.confidence = 1.0;
    let connection = open_database()?;
    let key = artist_cache_key(&query);
    save_artist_info_cache(&connection, &key, &query, &info)
}

#[tauri::command]
pub async fn save_artist_info_override(
    name: String,
    wikipedia_title_or_url: String,
) -> Result<DesktopArtistInfoResponse, String> {
    run_artist_task("Artist info override", move || {
        save_artist_info_override_inner(name, wikipedia_title_or_url)
    })
    .await
}

fn artist_local_tracks_inner(
    name: String,
    limit: Option<usize>,
) -> Result<Vec<DesktopTrack>, String> {
    let artist = primary_artist_name(&name);
    if artist.trim().is_empty() {
        return Err("Artist name is required".to_string());
    }
    let limit = limit.unwrap_or(100).clamp(1, 20_000);
    let candidate_limit = (limit.saturating_mul(20)).clamp(250, 5_000);
    let (artist_clauses, mut query_params) = fuzzy_sql_parts("coalesce(artist, '')", &artist);
    let (album_artist_clauses, album_artist_params) =
        fuzzy_sql_parts("coalesce(album_artist, '')", &artist);
    let mut search_clauses = Vec::new();
    if !artist_clauses.is_empty() {
        search_clauses.push(format!("({})", artist_clauses.join(" AND ")));
    }
    if !album_artist_clauses.is_empty() {
        search_clauses.push(format!("({})", album_artist_clauses.join(" AND ")));
        query_params.extend(album_artist_params);
    }
    if search_clauses.is_empty() {
        return Ok(Vec::new());
    }
    query_params.push(Value::Integer(candidate_limit as i64));
    let connection = open_database()?;
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns}
            FROM tracks
            WHERE {music_filter}
              AND ({search_filter})
            ORDER BY coalesce(year, 9999) ASC,
                     lower(coalesce(album, '')) ASC,
                     coalesce(disc_number, 0) ASC,
                     coalesce(track_number, 0) ASC,
                     lower(coalesce(title, '')) ASC
            LIMIT ?
            "#,
            track_columns = TRACK_COLUMNS,
            music_filter = music_only_clause(),
            search_filter = search_clauses.join(" OR ")
        ))
        .map_err(|error| format!("Could not prepare Rust artist track query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(query_params), track_from_row)
        .map_err(|error| format!("Could not read Rust artist tracks: {error}"))?;
    let mut tracks = Vec::new();
    for row in rows {
        let track = row.map_err(|error| format!("Could not decode Rust artist tracks: {error}"))?;
        if track_matches_artist_lookup(&track, &artist) {
            tracks.push(track);
            if tracks.len() >= limit {
                break;
            }
        }
    }
    Ok(tracks)
}

#[tauri::command]
pub async fn artist_local_tracks(
    name: String,
    limit: Option<usize>,
) -> Result<Vec<DesktopTrack>, String> {
    run_artist_task("Artist local tracks", move || {
        artist_local_tracks_inner(name, limit)
    })
    .await
}

pub fn artist_local_tracks_blocking(
    _state: State<'_, DesktopLibraryState>,
    name: String,
    limit: Option<usize>,
) -> Result<Vec<DesktopTrack>, String> {
    artist_local_tracks_inner(name, limit)
}

fn clear_artist_cache_inner() -> Result<serde_json::Value, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute("DELETE FROM artist_info_cache", [])
        .map_err(|error| format!("Could not clear Rust artist cache: {error}"))?;
    Ok(json!({ "deleted": deleted as i64 }))
}

#[tauri::command]
pub async fn clear_artist_cache() -> Result<serde_json::Value, String> {
    run_artist_task("Clear artist cache", clear_artist_cache_inner).await
}

pub fn clear_artist_cache_blocking(
    _state: State<'_, DesktopLibraryState>,
) -> Result<serde_json::Value, String> {
    clear_artist_cache_inner()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sorted_artist_components(value: &str) -> Vec<String> {
        let mut components = artist_lookup_components(value);
        components.sort();
        components
    }

    #[test]
    fn natural_ampersand_artist_names_stay_together() {
        assert_eq!(
            sorted_artist_components("King Gizzard & the Lizard Wizard"),
            vec!["king gizzard the lizard wizard".to_string()]
        );
    }

    #[test]
    fn collaboration_artist_names_split_for_lookup() {
        assert_eq!(
            sorted_artist_components("AnnenMayKantereit & Giant Rooks"),
            vec!["annenmaykantereit".to_string(), "giant rooks".to_string()]
        );
        assert_eq!(
            sorted_artist_components("Clean Bandit feat. Sean Paul & Anne-Marie"),
            vec![
                "anne marie".to_string(),
                "clean bandit".to_string(),
                "sean paul".to_string(),
            ]
        );
    }

    #[test]
    fn full_ambiguous_artist_names_can_still_match_local_tracks() {
        assert!(artist_tag_matches_lookup(
            "Simon & Garfunkel",
            Some("Simon & Garfunkel")
        ));
        assert!(artist_tag_matches_lookup(
            "Earth, Wind & Fire",
            Some("Earth, Wind & Fire")
        ));
        assert!(artist_tag_matches_lookup(
            "Anne-Marie",
            Some("Clean Bandit feat. Sean Paul & Anne-Marie")
        ));
    }
}
