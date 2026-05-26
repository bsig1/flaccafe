#[tauri::command]
pub fn tracks_page(
    _state: State<'_, DesktopLibraryState>,
    search: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    sort_by: Option<String>,
    sort_direction: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    genre: Option<String>,
    path: Option<String>,
    extension: Option<String>,
    rating_state: Option<String>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    year_from: Option<i64>,
    year_to: Option<i64>,
    min_duration: Option<f64>,
    max_duration: Option<f64>,
    missing_metadata: Option<bool>,
) -> Result<DesktopTrackPage, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(150).clamp(1, 100_000);
    let offset = offset.unwrap_or(0);
    let search = search.unwrap_or_default();
    let sort_by_value = sort_by.unwrap_or_else(|| "artist".to_string());
    let sort_direction_value = sort_direction.unwrap_or_default();
    let cache_key = should_cache_page(limit).then(|| {
        query_cache_key(
            "tracks_page",
            json!({
                "search": &search,
                "limit": limit,
                "offset": offset,
                "sort_by": &sort_by_value,
                "sort_direction": &sort_direction_value,
                "artist": artist.as_deref(),
                "album": album.as_deref(),
                "genre": genre.as_deref(),
                "path": path.as_deref(),
                "extension": extension.as_deref(),
                "rating_state": rating_state.as_deref(),
                "min_rating": min_rating,
                "max_rating": max_rating,
                "year_from": year_from,
                "year_to": year_to,
                "min_duration": min_duration,
                "max_duration": max_duration,
                "missing_metadata": missing_metadata,
            }),
        )
    });
    if let Some(cache_key) = cache_key.as_deref() {
        if let Some(page) = read_cached_query::<DesktopTrackPage>(&connection, cache_key) {
            return Ok(page);
        }
    }
    if !search.trim().is_empty() {
        ensure_tracks_fts_current(&connection)?;
    }
    let use_fts = !search.trim().is_empty() && tracks_fts_available(&connection);
    let fts_query = if use_fts {
        fts_search_query(&search)
    } else {
        None
    };
    let (where_clause, params) = track_where_clause(
        if fts_query.is_some() { "" } else { &search },
        artist.as_deref(),
        album.as_deref(),
        genre.as_deref(),
        path.as_deref(),
        extension.as_deref(),
        rating_state.as_deref(),
        min_rating,
        max_rating,
        year_from,
        year_to,
        min_duration,
        max_duration,
        missing_metadata,
    );
    let from_clause = "tracks";
    let fts_where_clause = if fts_query.is_some() {
        format!(
            "WHERE id IN (SELECT rowid FROM tracks_fts WHERE tracks_fts MATCH ?) AND {}",
            where_clause.trim_start_matches("WHERE ")
        )
    } else {
        where_clause.clone()
    };
    let direction = if sort_direction_value.eq_ignore_ascii_case("desc") {
        "DESC"
    } else {
        "ASC"
    };
    let order_clause = format!(
        "ORDER BY {} {direction}, lower(coalesce(artist, '')) ASC, lower(coalesce(album, '')) ASC, disc_number ASC, track_number ASC, lower(coalesce(title, '')) ASC, id ASC",
        sort_expression(&sort_by_value)
    );

    let mut query_params = Vec::new();
    if let Some(query) = fts_query.as_deref() {
        query_params.push(Value::Text(query.to_string()));
    }
    query_params.extend(params.clone());

    let total = if fts_query.is_none()
        && search.trim().is_empty()
        && artist.is_none()
        && album.is_none()
        && genre.is_none()
        && path.is_none()
        && extension.is_none()
        && rating_state
            .as_deref()
            .map(|value| value.eq_ignore_ascii_case("any"))
            .unwrap_or(true)
        && min_rating.is_none()
        && max_rating.is_none()
        && year_from.is_none()
        && year_to.is_none()
        && min_duration.is_none()
        && max_duration.is_none()
        && !missing_metadata.unwrap_or(false)
    {
        cached_music_track_count(&connection).unwrap_or_else(|| {
            connection
                .query_row(
                    &format!("SELECT count(*) FROM tracks {where_clause}"),
                    params_from_iter(params.clone()),
                    |row| row.get(0),
                )
                .unwrap_or(0)
        })
    } else {
        connection
            .query_row(
                &format!("SELECT count(*) FROM {from_clause} {fts_where_clause}"),
                params_from_iter(query_params.clone()),
                |row| row.get(0),
            )
            .map_err(|error| format!("Could not count Rust tracks: {error}"))?
    };

    query_params.push(Value::Integer(limit as i64));
    query_params.push(Value::Integer(offset as i64));
    let mut statement = connection
        .prepare(&format!(
            "SELECT {TRACK_COLUMNS} FROM {from_clause} {fts_where_clause} {order_clause} LIMIT ? OFFSET ?"
        ))
        .map_err(|error| format!("Could not prepare Rust track query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(query_params), track_from_row)
        .map_err(|error| format!("Could not read Rust track page: {error}"))?;
    let tracks = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust track page: {error}"))?;
    let page = DesktopTrackPage {
        tracks,
        total,
        limit,
        offset,
        source: "rust-sqlite".to_string(),
    };
    if let Some(cache_key) = cache_key.as_deref() {
        write_cached_query(&connection, cache_key, &page, Some(total));
    }
    Ok(page)
}

#[tauri::command]
pub fn clap_coverage(
    _state: State<'_, DesktopLibraryState>,
) -> Result<DesktopAudioAnalysisCoverage, String> {
    let connection = open_database()?;
    let row = connection
        .query_row(
            &format!(
                r#"
                SELECT
                    count(*) AS total_tracks,
                    sum(
                        CASE
                            WHEN analysis_provider = 'clap'
                             AND analysis_embedding IS NOT NULL
                             AND trim(analysis_embedding) <> ''
                            THEN 1 ELSE 0
                        END
                    ) AS analyzed_tracks,
                    sum(CASE WHEN analysis_provider = 'clap_failed' THEN 1 ELSE 0 END) AS failed_tracks
                FROM tracks
                WHERE {music_filter}
                "#,
                music_filter = music_only_clause()
            ),
            [],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>("total_tracks")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("analyzed_tracks")?.unwrap_or(0),
                    row.get::<_, Option<i64>>("failed_tracks")?.unwrap_or(0),
                ))
            },
        )
        .map_err(|error| format!("Could not read Rust CLAP coverage: {error}"))?;
    let (total_tracks, analyzed_tracks, failed_tracks) = row;
    let coverage_percent = if total_tracks > 0 {
        ((analyzed_tracks as f64 / total_tracks as f64) * 10_000.0).round() / 100.0
    } else {
        0.0
    };
    Ok(DesktopAudioAnalysisCoverage {
        total_tracks,
        analyzed_tracks,
        unanalyzed_tracks: (total_tracks - analyzed_tracks).max(0),
        failed_tracks,
        coverage_percent,
        provider: "clap".to_string(),
    })
}

#[tauri::command]
pub fn albums(
    _state: State<'_, DesktopLibraryState>,
    search: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<DesktopAlbumSummary>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(20_000).clamp(1, 20_000);
    let offset = offset.unwrap_or(0);
    let search_value = search.unwrap_or_default();
    let cache_key = should_cache_page(limit).then(|| {
        query_cache_key(
            "albums",
            json!({
                "search": &search_value,
                "limit": limit,
                "offset": offset,
            }),
        )
    });
    if let Some(cache_key) = cache_key.as_deref() {
        if let Some(albums) = read_cached_query::<Vec<DesktopAlbumSummary>>(&connection, cache_key)
        {
            return Ok(albums);
        }
    }
    ensure_library_derived_data_current(&connection)?;
    let (where_parts, mut query_params) = fuzzy_sql_parts("search_text", &search_value);
    let where_clause = if where_parts.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_parts.join(" AND "))
    };
    query_params.push(Value::Integer(limit as i64));
    query_params.push(Value::Integer(offset as i64));

    let album_sql = format!(
        r#"
            SELECT
                id,
                album,
                album_artist,
                year,
                years_csv,
                album_ids_csv,
                edition_count,
                artwork_path,
                track_count,
                expected_track_count,
                missing_track_count,
                duration_seconds,
                average_rating,
                artwork_track_id,
                completion_expected_track_count,
                completion_source,
                completion_release_id,
                completion_release_title,
                completion_checked_at
            FROM album_summaries
            {where_clause}
            ORDER BY sort_album_artist ASC,
                     sort_year ASC,
                     sort_album ASC,
                     id ASC
            LIMIT ? OFFSET ?
            "#,
        where_clause = where_clause
    );
    let mut statement = connection
        .prepare(&album_sql)
        .map_err(|error| format!("Could not prepare Rust albums query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(query_params), |row| {
            let years = csv_ints(row.get("years_csv")?);
            let album_ids = csv_ints(row.get("album_ids_csv")?);
            let year = years.first().copied().or(row.get("year")?);
            Ok(DesktopAlbumSummary {
                id: row.get("id")?,
                album: row.get("album")?,
                album_artist: row.get("album_artist")?,
                year,
                years,
                edition_count: if album_ids.is_empty() {
                    row.get::<_, Option<i64>>("edition_count")?.unwrap_or(1)
                } else {
                    album_ids.len() as i64
                },
                album_ids,
                artwork_path: row.get("artwork_path")?,
                track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
                expected_track_count: row.get("expected_track_count")?,
                missing_track_count: row
                    .get::<_, Option<i64>>("missing_track_count")?
                    .unwrap_or(0),
                duration_seconds: row.get("duration_seconds")?,
                average_rating: row.get("average_rating")?,
                artwork_track_id: row.get("artwork_track_id")?,
                completion_expected_track_count: row.get("completion_expected_track_count")?,
                completion_source: row.get("completion_source")?,
                completion_release_id: row.get("completion_release_id")?,
                completion_release_title: row.get("completion_release_title")?,
                completion_checked_at: row.get("completion_checked_at")?,
            })
        })
        .map_err(|error| format!("Could not read Rust albums: {error}"))?;
    let albums = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust albums: {error}"))?;
    if let Some(cache_key) = cache_key.as_deref() {
        write_cached_query(&connection, cache_key, &albums, Some(albums.len() as i64));
    }
    Ok(albums)
}

#[tauri::command]
pub fn artists(
    _state: State<'_, DesktopLibraryState>,
    search: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<DesktopArtistSummary>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(20_000).clamp(1, 20_000);
    let offset = offset.unwrap_or(0);
    let search_value = search.unwrap_or_default();
    let cache_key = should_cache_page(limit).then(|| {
        query_cache_key(
            "artists",
            json!({
                "search": &search_value,
                "limit": limit,
                "offset": offset,
            }),
        )
    });
    if let Some(cache_key) = cache_key.as_deref() {
        if let Some(artists) =
            read_cached_query::<Vec<DesktopArtistSummary>>(&connection, cache_key)
        {
            return Ok(artists);
        }
    }
    ensure_library_derived_data_current(&connection)?;
    let (where_parts, mut query_params) = fuzzy_sql_parts("search_text", &search_value);
    let where_clause = if where_parts.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_parts.join(" AND "))
    };
    query_params.push(Value::Integer(limit as i64));
    query_params.push(Value::Integer(offset as i64));

    let artist_sql = format!(
        r#"
            SELECT
                name,
                track_count,
                album_count,
                duration_seconds,
                average_rating,
                play_count,
                skip_count,
                first_year,
                last_year,
                artwork_track_id
            FROM artist_summaries
            {where_clause}
            ORDER BY sort_name ASC, name ASC
            LIMIT ? OFFSET ?
            "#,
        where_clause = where_clause
    );
    let mut statement = connection
        .prepare(&artist_sql)
        .map_err(|error| format!("Could not prepare Rust artists query: {error}"))?;
    let rows = statement
        .query_map(params_from_iter(query_params), |row| {
            Ok(DesktopArtistSummary {
                name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
                track_count: row.get::<_, Option<i64>>("track_count")?.unwrap_or(0),
                album_count: row.get::<_, Option<i64>>("album_count")?.unwrap_or(0),
                duration_seconds: row.get("duration_seconds")?,
                average_rating: row.get("average_rating")?,
                play_count: row.get::<_, Option<i64>>("play_count")?.unwrap_or(0),
                skip_count: row.get::<_, Option<i64>>("skip_count")?.unwrap_or(0),
                first_year: row.get("first_year")?,
                last_year: row.get("last_year")?,
                artwork_track_id: row.get("artwork_track_id")?,
            })
        })
        .map_err(|error| format!("Could not read Rust artists: {error}"))?;
    let artists = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust artists: {error}"))?;
    if let Some(cache_key) = cache_key.as_deref() {
        write_cached_query(&connection, cache_key, &artists, Some(artists.len() as i64));
    }
    Ok(artists)
}

#[tauri::command]
pub fn album_tracks(
    _state: State<'_, DesktopLibraryState>,
    album_id: i64,
) -> Result<Vec<DesktopTrack>, String> {
    let connection = open_database()?;
    album_tracks_by_id(&connection, album_id)
}

#[tauri::command]
pub fn library_stats(
    _state: State<'_, DesktopLibraryState>,
) -> Result<DesktopLibraryStatsResponse, String> {
    let connection = open_database()?;
    let cache_key = "ui:library_stats:v2";
    if let Some(stats) = read_cached_query::<DesktopLibraryStatsResponse>(&connection, cache_key) {
        return Ok(stats);
    }
    ensure_library_derived_data_current(&connection)?;
    let stats = read_library_stats_cache(&connection).or_else(|_| {
        refresh_library_stats_cache(&connection)?;
        read_library_stats_cache(&connection)
    })?;
    write_cached_query(&connection, cache_key, &stats, Some(stats.total_tracks));
    Ok(stats)
}

fn read_library_stats_cache(
    connection: &Connection,
) -> Result<DesktopLibraryStatsResponse, String> {
    connection
        .query_row(
            r#"
            SELECT
                total_tracks,
                total_albums,
                total_artists,
                total_playlists,
                rated_tracks,
                unrated_tracks,
                total_duration_seconds,
                played_events,
                skipped_events
            FROM library_stats_cache
            WHERE id = 1
            "#,
            [],
            |row| {
                Ok(DesktopLibraryStatsResponse {
                    total_tracks: row.get::<_, Option<i64>>("total_tracks")?.unwrap_or(0),
                    total_albums: row.get::<_, Option<i64>>("total_albums")?.unwrap_or(0),
                    total_artists: row.get::<_, Option<i64>>("total_artists")?.unwrap_or(0),
                    total_playlists: row.get::<_, Option<i64>>("total_playlists")?.unwrap_or(0),
                    rated_tracks: row.get::<_, Option<i64>>("rated_tracks")?.unwrap_or(0),
                    unrated_tracks: row.get::<_, Option<i64>>("unrated_tracks")?.unwrap_or(0),
                    total_duration_seconds: row.get("total_duration_seconds")?,
                    played_events: row.get::<_, Option<i64>>("played_events")?.unwrap_or(0),
                    skipped_events: row.get::<_, Option<i64>>("skipped_events")?.unwrap_or(0),
                })
            },
        )
        .map_err(|error| format!("Could not read Rust library stats: {error}"))
}

