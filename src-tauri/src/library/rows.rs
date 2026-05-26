use super::*;

pub(super) const TRACK_COLUMNS: &str = "
    id, path, title, artist, album, album_artist,
    track_number, disc_number, genre, analysis_provider, analysis_model,
    analysis_genre, analysis_genre_confidence, analysis_genre_tags,
    analysis_embedding, analysis_updated_at, year, duration_seconds, bitrate,
    replaygain_track_gain_db, replaygain_album_gain_db, replaygain_track_peak,
    replaygain_album_peak, audio_fingerprint, acoustic_fingerprint,
    acoustic_fingerprint_updated_at, rating, play_count, skip_count,
    last_played_at, last_skipped_at, date_added, file_modified_at
";

pub(super) fn qualified_track_columns(alias: &str) -> String {
    TRACK_COLUMNS
        .split(',')
        .map(str::trim)
        .filter(|column| !column.is_empty())
        .map(|column| format!("{alias}.{column} AS {column}"))
        .collect::<Vec<_>>()
        .join(", ")
}

pub(super) fn track_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DesktopTrack> {
    Ok(DesktopTrack {
        id: row.get("id")?,
        path: row.get("path")?,
        title: row.get("title")?,
        artist: row.get("artist")?,
        album: row.get("album")?,
        album_artist: row.get("album_artist")?,
        track_number: row.get("track_number")?,
        disc_number: row.get("disc_number")?,
        genre: row.get("genre")?,
        analysis_provider: row.get("analysis_provider")?,
        analysis_model: row.get("analysis_model")?,
        analysis_genre: row.get("analysis_genre")?,
        analysis_genre_confidence: row.get("analysis_genre_confidence")?,
        analysis_genre_tags: row.get("analysis_genre_tags")?,
        analysis_embedding: row.get("analysis_embedding")?,
        analysis_updated_at: row.get("analysis_updated_at")?,
        year: row.get("year")?,
        duration_seconds: row.get("duration_seconds")?,
        bitrate: row.get("bitrate")?,
        replaygain_track_gain_db: row.get("replaygain_track_gain_db")?,
        replaygain_album_gain_db: row.get("replaygain_album_gain_db")?,
        replaygain_track_peak: row.get("replaygain_track_peak")?,
        replaygain_album_peak: row.get("replaygain_album_peak")?,
        audio_fingerprint: row.get("audio_fingerprint")?,
        acoustic_fingerprint: row.get("acoustic_fingerprint")?,
        acoustic_fingerprint_updated_at: row.get("acoustic_fingerprint_updated_at")?,
        rating: row.get("rating")?,
        play_count: row.get::<_, Option<i64>>("play_count")?.unwrap_or(0),
        skip_count: row.get::<_, Option<i64>>("skip_count")?.unwrap_or(0),
        last_played_at: row.get("last_played_at")?,
        last_skipped_at: row.get("last_skipped_at")?,
        date_added: row
            .get::<_, Option<String>>("date_added")?
            .unwrap_or_else(|| "".to_string()),
        file_modified_at: row.get("file_modified_at")?,
    })
}

pub(super) fn radio_station_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<DesktopRadioStation> {
    Ok(DesktopRadioStation {
        id: row.get("id")?,
        name: row.get::<_, Option<String>>("name")?.unwrap_or_default(),
        stream_url: row
            .get::<_, Option<String>>("stream_url")?
            .unwrap_or_default(),
        homepage_url: row.get("homepage_url")?,
        genre: row.get("genre")?,
        notes: row.get("notes")?,
        last_played_at: row.get("last_played_at")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

pub(super) fn audiobook_bookmark_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<DesktopAudiobookBookmark> {
    Ok(DesktopAudiobookBookmark {
        id: row.get("id")?,
        track_id: row.get("track_id")?,
        position_seconds: row
            .get::<_, Option<f64>>("position_seconds")?
            .unwrap_or(0.0),
        label: row.get::<_, Option<String>>("label")?.unwrap_or_default(),
        note: row.get("note")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
    })
}

pub(super) fn audiobook_chapter_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<DesktopAudiobookChapter> {
    Ok(DesktopAudiobookChapter {
        id: row.get("id")?,
        track_id: row.get("track_id")?,
        chapter_index: row.get::<_, Option<i64>>("chapter_index")?.unwrap_or(1),
        title: row
            .get::<_, Option<String>>("title")?
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "Chapter".to_string()),
        start_seconds: row.get::<_, Option<f64>>("start_seconds")?.unwrap_or(0.0),
        end_seconds: row.get("end_seconds")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub(super) fn progress_percent(position_seconds: f64, duration_seconds: Option<f64>) -> f64 {
    let Some(duration_seconds) = duration_seconds else {
        return 0.0;
    };
    if position_seconds <= 0.0 || duration_seconds <= 0.0 {
        0.0
    } else {
        ((position_seconds / duration_seconds) * 100.0).clamp(0.0, 100.0)
    }
}

pub(super) fn audiobook_where_clause() -> &'static str {
    "
    (
      lower(coalesce(tracks.genre, '')) LIKE '%audiobook%'
      OR lower(coalesce(tracks.genre, '')) LIKE '%audio book%'
      OR lower(tracks.path) LIKE '%audiobook%'
      OR lower(tracks.path) LIKE '%audio book%'
      OR lower(tracks.path) LIKE '%\\books\\%'
      OR lower(tracks.path) LIKE '%/books/%'
    )
    "
}

pub(super) fn clean_required_text(value: String, label: &str) -> Result<String, String> {
    let cleaned = value.trim().to_string();
    if cleaned.is_empty() {
        Err(format!("{label} is required"))
    } else {
        Ok(cleaned)
    }
}

pub(super) fn clean_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}
