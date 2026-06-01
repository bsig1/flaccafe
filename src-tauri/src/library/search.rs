use rusqlite::types::Value;

fn compact_sql_expression(expression: &str) -> String {
    let mut compact = format!("lower({expression})");
    for character in [
        " ", "-", "_", ".", "'", "\"", "/", "\\", "(", ")", "[", "]", "{", "}", ":", ";", ",", "&",
        "+",
    ] {
        let escaped = character.replace('\'', "''");
        compact = format!("replace({compact}, '{escaped}', '')");
    }
    compact
}

pub(super) fn search_terms(search: &str) -> Vec<String> {
    search
        .split(|character: char| character.is_whitespace() || "/\\,;:_()[]{}|".contains(character))
        .map(|term| term.trim().to_lowercase())
        .filter(|term| !term.is_empty())
        .take(8)
        .collect()
}

pub(super) fn fuzzy_sql_parts(expression: &str, search: &str) -> (Vec<String>, Vec<Value>) {
    let compact_expression = compact_sql_expression(expression);
    let mut clauses = Vec::new();
    let mut params = Vec::new();
    for term in search_terms(search) {
        let compact_term: String = term
            .chars()
            .filter(|character| character.is_ascii_alphanumeric())
            .collect();
        clauses.push(format!(
            "(lower({expression}) LIKE ? OR {compact_expression} LIKE ?)"
        ));
        params.push(Value::Text(format!("%{term}%")));
        params.push(Value::Text(format!(
            "%{}%",
            if compact_term.is_empty() {
                &term
            } else {
                &compact_term
            }
        )));
    }
    (clauses, params)
}

pub(super) fn csv_ints(value: Option<String>) -> Vec<i64> {
    let mut values: Vec<i64> = value
        .unwrap_or_default()
        .split(',')
        .filter_map(|item| item.trim().parse::<i64>().ok())
        .collect();
    values.sort_unstable();
    values.dedup();
    values
}

pub(super) fn music_only_clause() -> &'static str {
    "
    NOT (
      lower(coalesce(genre, '')) LIKE '%audiobook%'
      OR lower(coalesce(genre, '')) LIKE '%audio book%'
      OR lower(path) LIKE '%audiobook%'
      OR lower(path) LIKE '%audio book%'
      OR lower(path) LIKE '%\\books\\%'
      OR lower(path) LIKE '%/books/%'
    )
    AND NOT (
      lower(coalesce(genre, '')) LIKE '%podcast%'
      OR lower(path) LIKE '%podcast%'
      OR lower(path) LIKE '%\\podcasts\\%'
      OR lower(path) LIKE '%/podcasts/%'
      OR EXISTS (
        SELECT 1
        FROM podcast_episodes
        WHERE podcast_episodes.track_id = tracks.id
           OR (
             podcast_episodes.local_path IS NOT NULL
             AND lower(podcast_episodes.local_path) = lower(tracks.path)
           )
      )
    )
    "
}

fn add_fuzzy_filter(
    clauses: &mut Vec<String>,
    params: &mut Vec<Value>,
    expression: &str,
    value: Option<&str>,
) {
    let Some(value) = value else {
        return;
    };
    let compact_expression = compact_sql_expression(expression);
    for term in search_terms(value) {
        let compact_term: String = term
            .chars()
            .filter(|character| character.is_ascii_alphanumeric())
            .collect();
        clauses.push(format!(
            "(lower({expression}) LIKE ? OR {compact_expression} LIKE ?)"
        ));
        params.push(Value::Text(format!("%{term}%")));
        params.push(Value::Text(format!(
            "%{}%",
            if compact_term.is_empty() {
                &term
            } else {
                &compact_term
            }
        )));
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) fn track_where_clause(
    search: &str,
    artist: Option<&str>,
    album: Option<&str>,
    genre: Option<&str>,
    mood: Option<&str>,
    path: Option<&str>,
    extension: Option<&str>,
    rating_state: Option<&str>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    year_from: Option<i64>,
    year_to: Option<i64>,
    min_duration: Option<f64>,
    max_duration: Option<f64>,
    missing_metadata: Option<bool>,
) -> (String, Vec<Value>) {
    let expression = "coalesce(title, '') || ' ' || coalesce(artist, '') || ' ' ||
                    coalesce(album, '') || ' ' || coalesce(album_artist, '') || ' ' ||
                    coalesce(genre, '') || ' ' || coalesce(analysis_genre, '') || ' ' ||
                    coalesce(analysis_genre_tags, '') || ' ' ||
                    coalesce(analysis_mood, '') || ' ' ||
                    coalesce(analysis_mood_tags, '') || ' ' ||
                    coalesce(path, '')";
    let compact_expression = compact_sql_expression(expression);
    let mut clauses = vec![music_only_clause().to_string()];
    let mut params = Vec::new();
    for term in search_terms(search) {
        let compact_term: String = term
            .chars()
            .filter(|character| character.is_ascii_alphanumeric())
            .collect();
        clauses.push(format!(
            "(lower({expression}) LIKE ? OR {compact_expression} LIKE ?)"
        ));
        params.push(Value::Text(format!("%{term}%")));
        params.push(Value::Text(format!(
            "%{}%",
            if compact_term.is_empty() {
                &term
            } else {
                &compact_term
            }
        )));
    }
    add_fuzzy_filter(
        &mut clauses,
        &mut params,
        "coalesce(artist, '') || ' ' || coalesce(album_artist, '')",
        artist,
    );
    add_fuzzy_filter(&mut clauses, &mut params, "coalesce(album, '')", album);
    add_fuzzy_filter(
        &mut clauses,
        &mut params,
        "coalesce(genre, '') || ' ' || coalesce(analysis_genre, '') || ' ' || coalesce(analysis_genre_tags, '') || ' ' || coalesce(analysis_mood, '')",
        genre,
    );
    add_fuzzy_filter(
        &mut clauses,
        &mut params,
        "coalesce(analysis_mood, '') || ' ' || coalesce(analysis_mood_tags, '')",
        mood,
    );
    add_fuzzy_filter(&mut clauses, &mut params, "coalesce(path, '')", path);
    if let Some(extension) = extension
        .map(|value| {
            value
                .trim()
                .trim_start_matches('.')
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .collect::<String>()
                .to_lowercase()
        })
        .filter(|value| !value.is_empty())
    {
        clauses.push("lower(path) LIKE ?".to_string());
        params.push(Value::Text(format!("%.{extension}")));
    }
    match rating_state
        .unwrap_or("any")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "rated" => clauses.push("rating IS NOT NULL".to_string()),
        "unrated" => clauses.push("rating IS NULL".to_string()),
        _ => {}
    }
    if let Some(value) = min_rating {
        clauses.push("rating >= ?".to_string());
        params.push(Value::Real(value));
    }
    if let Some(value) = max_rating {
        clauses.push("rating <= ?".to_string());
        params.push(Value::Real(value));
    }
    if let Some(value) = year_from {
        clauses.push("year >= ?".to_string());
        params.push(Value::Integer(value));
    }
    if let Some(value) = year_to {
        clauses.push("year <= ?".to_string());
        params.push(Value::Integer(value));
    }
    if let Some(value) = min_duration {
        clauses.push("duration_seconds >= ?".to_string());
        params.push(Value::Real(value));
    }
    if let Some(value) = max_duration {
        clauses.push("duration_seconds <= ?".to_string());
        params.push(Value::Real(value));
    }
    if missing_metadata.unwrap_or(false) {
        clauses.push(
            "(
                coalesce(title, '') = ''
                OR coalesce(artist, '') = ''
                OR coalesce(album, '') = ''
                OR coalesce(genre, '') = ''
                OR year IS NULL
            )"
            .to_string(),
        );
    }
    (format!("WHERE {}", clauses.join(" AND ")), params)
}

pub(super) fn article_sort_expression(expression: &str) -> String {
    let normalized = format!("lower(trim(coalesce({expression}, '')))");
    format!(
        "CASE
            WHEN {normalized} LIKE 'the %' THEN substr({normalized}, 5)
            WHEN {normalized} LIKE 'an %' THEN substr({normalized}, 4)
            WHEN {normalized} LIKE 'a %' THEN substr({normalized}, 3)
            ELSE {normalized}
         END"
    )
}

pub(super) fn sort_expression(sort_by: &str) -> String {
    match sort_by {
        "title" => article_sort_expression("title"),
        "artist" => article_sort_expression("artist"),
        "album" => article_sort_expression("album"),
        "album_artist" => article_sort_expression("album_artist"),
        "genre" => article_sort_expression("genre"),
        "analysis_genre" => article_sort_expression("analysis_genre"),
        "analysis_genre_confidence" => "coalesce(analysis_genre_confidence, -1)".to_string(),
        "analysis_mood" => article_sort_expression("analysis_mood"),
        "analysis_mood_confidence" => "coalesce(analysis_mood_confidence, -1)".to_string(),
        "year" => "coalesce(year, -1)".to_string(),
        "duration" => "coalesce(duration_seconds, 0)".to_string(),
        "rating" => "coalesce(rating, -1)".to_string(),
        "play_count" => "coalesce(play_count, 0)".to_string(),
        "skip_count" => "coalesce(skip_count, 0)".to_string(),
        "last_played_at" => "coalesce(last_played_at, '')".to_string(),
        "date_added" => "coalesce(date_added, '')".to_string(),
        "path" => article_sort_expression("path"),
        "bitrate" => "coalesce(bitrate, 0)".to_string(),
        _ => article_sort_expression("artist"),
    }
}
