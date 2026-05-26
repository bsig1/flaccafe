use super::*;

fn wikipedia_summary_url(title: &str) -> String {
    format!(
        "https://en.wikipedia.org/api/rest_v1/page/summary/{}",
        urlencoding::encode(title)
    )
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
        from_cache: false,
        updated_at: Some(scan::utc_now()),
        error: None,
    }))
}

fn wikipedia_search_titles(query: &str) -> Result<Vec<String>, String> {
    let search = format!("{query} musician OR band");
    let url = format!(
        "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch={}",
        urlencoding::encode(&search)
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
    Ok(payload
        .get("query")
        .and_then(|query| query.get("search"))
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("title").and_then(serde_json::Value::as_str))
        .map(str::to_string)
        .collect())
}

fn fetch_artist_info(query: &str) -> Result<DesktopArtistInfoResponse, String> {
    if let Some(info) = wikipedia_page_summary(query)? {
        return Ok(info);
    }
    for title in wikipedia_search_titles(query)? {
        if let Some(info) = wikipedia_page_summary(&title)? {
            return Ok(DesktopArtistInfoResponse {
                query: query.to_string(),
                ..info
            });
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
        from_cache: false,
        updated_at: Some(updated_at),
        error: info.error.clone(),
    })
}

#[tauri::command]
pub fn artist_info(
    _state: State<'_, DesktopLibraryState>,
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
        Ok(DesktopArtistInfoResponse {
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
            from_cache: true,
            updated_at: row.get("updated_at")?,
            error: None,
        })
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
                    Ok(DesktopArtistInfoResponse {
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
                        from_cache: true,
                        updated_at: row.get("updated_at")?,
                        error: None,
                    })
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
pub fn artist_local_tracks(
    _state: State<'_, DesktopLibraryState>,
    name: String,
    limit: Option<usize>,
) -> Result<Vec<DesktopTrack>, String> {
    let artist = primary_artist_name(&name);
    if artist.trim().is_empty() {
        return Err("Artist name is required".to_string());
    }
    let limit = limit.unwrap_or(100).clamp(1, 20_000);
    let connection = open_database()?;
    let artist_expr = "
        trim(
          CASE
            WHEN instr(coalesce(tracks.artist, ''), ';') > 0 THEN substr(coalesce(tracks.artist, ''), 1, instr(coalesce(tracks.artist, ''), ';') - 1)
            WHEN instr(coalesce(tracks.artist, ''), '|') > 0 THEN substr(coalesce(tracks.artist, ''), 1, instr(coalesce(tracks.artist, ''), '|') - 1)
            ELSE coalesce(tracks.artist, '')
          END
        )
    ";
    let mut statement = connection
        .prepare(&format!(
            r#"
            SELECT {track_columns}
            FROM tracks
            WHERE lower({artist_expr}) = lower(?)
              AND {music_filter}
            ORDER BY coalesce(year, 9999) ASC,
                     lower(coalesce(album, '')) ASC,
                     coalesce(disc_number, 0) ASC,
                     coalesce(track_number, 0) ASC,
                     lower(coalesce(title, '')) ASC
            LIMIT ?
            "#,
            track_columns = TRACK_COLUMNS,
            music_filter = music_only_clause()
        ))
        .map_err(|error| format!("Could not prepare Rust artist track query: {error}"))?;
    let rows = statement
        .query_map(params![artist, limit as i64], track_from_row)
        .map_err(|error| format!("Could not read Rust artist tracks: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust artist tracks: {error}"))
}

#[tauri::command]
pub fn clear_artist_cache(
    _state: State<'_, DesktopLibraryState>,
) -> Result<serde_json::Value, String> {
    let connection = open_database()?;
    let deleted = connection
        .execute("DELETE FROM artist_info_cache", [])
        .map_err(|error| format!("Could not clear Rust artist cache: {error}"))?;
    Ok(json!({ "deleted": deleted as i64 }))
}
