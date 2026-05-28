use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::*;
use lofty::tag::items::popularimeter::{Popularimeter, StarRating};
use lofty::tag::{ItemKey, Tag};
use serde_json::{json, Map, Value as JsonValue};
use sha1::{Digest, Sha1};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::scan::{path_key, AudioSnapshot};

const EDITABLE_METADATA_FIELDS: &[&str] = &[
    "title",
    "artist",
    "album",
    "album_artist",
    "track_number",
    "disc_number",
    "genre",
    "year",
];
const SCAN_METADATA_PARALLEL_THRESHOLD: usize = 16;
const SCAN_METADATA_MAX_WORKERS: usize = 4;

pub(crate) fn read_scan_metadata_results(files: &[AudioSnapshot]) -> Vec<JsonValue> {
    let worker_count = scan_metadata_worker_count(files.len());
    if worker_count <= 1 {
        return files.iter().map(read_scan_snapshot_metadata).collect();
    }

    let chunk_size = files.len().div_ceil(worker_count);
    thread::scope(|scope| {
        let handles = files
            .chunks(chunk_size)
            .map(|chunk| {
                let handle = scope.spawn(move || {
                    chunk
                        .iter()
                        .map(read_scan_snapshot_metadata)
                        .collect::<Vec<_>>()
                });
                (chunk, handle)
            })
            .collect::<Vec<_>>();
        handles
            .into_iter()
            .flat_map(|(chunk, handle)| match handle.join() {
                Ok(results) => results,
                Err(_) => chunk
                    .iter()
                    .map(|snapshot| {
                        json!({
                            "path": snapshot.path_text,
                            "error": "Metadata worker stopped unexpectedly",
                        })
                    })
                    .collect::<Vec<_>>(),
            })
            .collect()
    })
}

fn scan_metadata_worker_count(file_count: usize) -> usize {
    if file_count < SCAN_METADATA_PARALLEL_THRESHOLD {
        return 1;
    }
    thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(1)
        .min(SCAN_METADATA_MAX_WORKERS)
        .min(file_count)
}

fn read_scan_snapshot_metadata(snapshot: &AudioSnapshot) -> JsonValue {
    match read_file_metadata(
        &snapshot.path,
        Some(snapshot.path_text.clone()),
        Some(snapshot.path_key.clone()),
        snapshot.modified_at.clone(),
        snapshot.size_bytes,
    ) {
        Ok(metadata) => json!({ "path": snapshot.path_text, "metadata": metadata }),
        Err(error) => json!({ "path": snapshot.path_text, "error": error }),
    }
}

pub(crate) fn read_file_metadata_result(path: &Path) -> JsonValue {
    let path_text = path.to_string_lossy().to_string();
    match read_file_metadata(path, Some(path_text.clone()), None, None, None) {
        Ok(metadata) => json!({ "path": path_text, "metadata": metadata }),
        Err(error) => json!({ "path": path_text, "error": error }),
    }
}

pub(crate) fn write_common_metadata(
    path: &Path,
    metadata: &Map<String, JsonValue>,
) -> Result<(), String> {
    let mut tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("Could not read audio tags with Lofty: {error}"))?;
    ensure_primary_tag(&mut tagged_file)?;
    {
        let has_primary_tag = tagged_file.primary_tag().is_some();
        let tag = if has_primary_tag {
            tagged_file.primary_tag_mut()
        } else {
            tagged_file.first_tag_mut()
        }
        .ok_or_else(|| "Could not create a writable tag for this file".to_string())?;
        for field in EDITABLE_METADATA_FIELDS {
            if let Some(value) = metadata.get(*field) {
                write_metadata_field(tag, field, value);
            }
        }
        tag.remove_empty();
    }
    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|error| format!("Could not save audio tags with Lofty: {error}"))
}

pub(crate) fn write_common_rating(path: &Path, rating: Option<f64>) -> Result<(), String> {
    let mut tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("Could not read audio rating tags with Lofty: {error}"))?;
    ensure_primary_tag(&mut tagged_file)?;
    {
        let has_primary_tag = tagged_file.primary_tag().is_some();
        let tag = if has_primary_tag {
            tagged_file.primary_tag_mut()
        } else {
            tagged_file.first_tag_mut()
        }
        .ok_or_else(|| "Could not create a writable tag for this file".to_string())?;
        tag.remove_key(ItemKey::Popularimeter);
        if let Some(rating) = normalize_rating(rating) {
            // Lofty's cross-format popularimeter is whole-star only. The app
            // keeps the exact half-star value in SQLite; file writes use the
            // nearest common on-file representation that other players read.
            let star = star_rating_from_f64(rating);
            let popularimeter = Popularimeter::musicbee(star, 0);
            tag.insert_text(ItemKey::Popularimeter, popularimeter.to_string());
        }
        tag.remove_empty();
    }
    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|error| format!("Could not save audio rating tags with Lofty: {error}"))
}

pub(crate) fn read_embedded_artwork(path: &Path) -> Result<Option<(Vec<u8>, String)>, String> {
    if !path.exists() || !path.is_file() {
        return Ok(None);
    }
    let tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("Could not read embedded artwork with Lofty: {error}"))?;
    for tag in ordered_tags(&tagged_file) {
        if let Some(picture) = tag.pictures().first() {
            let media_type = picture
                .mime_type()
                .map(|mime| mime.as_str().to_string())
                .unwrap_or_else(|| "image/jpeg".to_string());
            return Ok(Some((picture.data().to_vec(), media_type)));
        }
    }
    Ok(None)
}

pub(crate) fn write_embedded_artwork(
    path: &Path,
    bytes: Vec<u8>,
    media_type: &str,
) -> Result<(), String> {
    let mut tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("Could not read audio artwork tags with Lofty: {error}"))?;
    ensure_primary_tag(&mut tagged_file)?;
    {
        let has_primary_tag = tagged_file.primary_tag().is_some();
        let tag = if has_primary_tag {
            tagged_file.primary_tag_mut()
        } else {
            tagged_file.first_tag_mut()
        }
        .ok_or_else(|| "Could not create a writable artwork tag for this file".to_string())?;
        tag.remove_picture_type(PictureType::CoverFront);
        let picture = Picture::unchecked(bytes)
            .pic_type(PictureType::CoverFront)
            .mime_type(MimeType::from_str(media_type))
            .description("Cover")
            .build();
        tag.push_picture(picture);
        tag.remove_empty();
    }
    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|error| format!("Could not save embedded artwork with Lofty: {error}"))
}

pub(crate) fn read_embedded_lyrics(path: &Path) -> Result<Option<(String, bool)>, String> {
    if !path.exists() || !path.is_file() {
        return Ok(None);
    }
    let tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("Could not read embedded lyrics with Lofty: {error}"))?;
    let tags = ordered_tags(&tagged_file);
    if let Some(lyrics) = text_for_keys(&tags, &[ItemKey::Lyrics]) {
        let is_synced = looks_like_lrc(&lyrics);
        return Ok(Some((lyrics, is_synced)));
    }
    if let Some(lyrics) = text_for_keys(&tags, &[ItemKey::UnsyncLyrics]) {
        return Ok(Some((lyrics, false)));
    }
    Ok(None)
}

pub(crate) fn write_embedded_lyrics(
    path: &Path,
    lyrics: Option<&str>,
    is_synced: bool,
) -> Result<(), String> {
    let mut tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("Could not read embedded lyrics with Lofty: {error}"))?;
    ensure_primary_tag(&mut tagged_file)?;
    {
        let has_primary_tag = tagged_file.primary_tag().is_some();
        let tag = if has_primary_tag {
            tagged_file.primary_tag_mut()
        } else {
            tagged_file.first_tag_mut()
        }
        .ok_or_else(|| "Could not create a writable lyric tag for this file".to_string())?;
        tag.remove_key(ItemKey::Lyrics);
        tag.remove_key(ItemKey::UnsyncLyrics);
        if let Some(text) = lyrics.map(str::trim).filter(|text| !text.is_empty()) {
            // Lofty maps synced ID3 lyrics to format-specific binary frames,
            // so LRC text is stored in the common lyrics key. FLAC/MP4/Vorbis
            // readers preserve the timestamps as plain text.
            let key = if is_synced {
                ItemKey::Lyrics
            } else {
                ItemKey::UnsyncLyrics
            };
            tag.insert_text(key, text.to_string());
        }
        tag.remove_empty();
    }
    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|error| format!("Could not save embedded lyrics with Lofty: {error}"))
}

pub(crate) fn write_replaygain_tags(
    path: &Path,
    track_gain_db: Option<f64>,
    track_peak: Option<f64>,
    album_gain_db: Option<f64>,
    album_peak: Option<f64>,
) -> Result<(), String> {
    let mut tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("Could not read ReplayGain tags with Lofty: {error}"))?;
    ensure_primary_tag(&mut tagged_file)?;
    {
        let has_primary_tag = tagged_file.primary_tag().is_some();
        let tag = if has_primary_tag {
            tagged_file.primary_tag_mut()
        } else {
            tagged_file.first_tag_mut()
        }
        .ok_or_else(|| "Could not create a writable ReplayGain tag for this file".to_string())?;
        write_gain_key(tag, ItemKey::ReplayGainTrackGain, track_gain_db);
        write_number_key(tag, ItemKey::ReplayGainTrackPeak, track_peak);
        write_gain_key(tag, ItemKey::ReplayGainAlbumGain, album_gain_db);
        write_number_key(tag, ItemKey::ReplayGainAlbumPeak, album_peak);
        tag.remove_empty();
    }
    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|error| format!("Could not save ReplayGain tags with Lofty: {error}"))
}

fn read_file_metadata(
    path: &Path,
    path_text: Option<String>,
    path_key_text: Option<String>,
    modified_at: Option<String>,
    size_bytes: Option<i64>,
) -> Result<Map<String, JsonValue>, String> {
    if !path.exists() || !path.is_file() {
        return Err("Audio file is missing on disk".to_string());
    }
    let tagged_file = lofty::read_from_path(path)
        .map_err(|error| format!("Could not read audio metadata with Lofty: {error}"))?;
    let properties = tagged_file.properties();
    let tags = ordered_tags(&tagged_file);
    let fallback_title = path
        .file_stem()
        .and_then(|name| name.to_str())
        .map(str::to_string);

    let mut metadata = Map::new();
    metadata.insert(
        "path".to_string(),
        json!(path_text.unwrap_or_else(|| path.to_string_lossy().to_string())),
    );
    metadata.insert(
        "path_key".to_string(),
        json!(path_key_text.unwrap_or_else(|| path_key(path))),
    );
    metadata.insert(
        "title".to_string(),
        json!(text_for_keys(&tags, &[ItemKey::TrackTitle]).or(fallback_title)),
    );
    metadata.insert(
        "artist".to_string(),
        json!(text_for_keys(
            &tags,
            &[ItemKey::TrackArtist, ItemKey::TrackArtists]
        )),
    );
    metadata.insert(
        "album".to_string(),
        json!(text_for_keys(&tags, &[ItemKey::AlbumTitle])),
    );
    metadata.insert(
        "album_artist".to_string(),
        json!(text_for_keys(
            &tags,
            &[ItemKey::AlbumArtist, ItemKey::AlbumArtists]
        )),
    );
    metadata.insert(
        "track_number".to_string(),
        json!(int_for_keys(&tags, &[ItemKey::TrackNumber])),
    );
    metadata.insert(
        "disc_number".to_string(),
        json!(int_for_keys(&tags, &[ItemKey::DiscNumber])),
    );
    metadata.insert(
        "genre".to_string(),
        json!(text_for_keys(&tags, &[ItemKey::Genre])),
    );
    metadata.insert("year".to_string(), json!(year_for_tags(&tags)));
    metadata.insert(
        "duration_seconds".to_string(),
        json!(properties.duration().as_secs_f64()),
    );
    metadata.insert("rating".to_string(), json!(rating_for_tags(&tags)));
    metadata.insert(
        "bitrate".to_string(),
        json!(bitrate_bits_per_second(
            properties.audio_bitrate().or(properties.overall_bitrate())
        )),
    );
    metadata.insert(
        "replaygain_track_gain_db".to_string(),
        json!(gain_for_keys(&tags, &[ItemKey::ReplayGainTrackGain])),
    );
    metadata.insert(
        "replaygain_album_gain_db".to_string(),
        json!(gain_for_keys(&tags, &[ItemKey::ReplayGainAlbumGain])),
    );
    metadata.insert(
        "replaygain_track_peak".to_string(),
        json!(number_for_keys(&tags, &[ItemKey::ReplayGainTrackPeak])),
    );
    metadata.insert(
        "replaygain_album_peak".to_string(),
        json!(number_for_keys(&tags, &[ItemKey::ReplayGainAlbumPeak])),
    );
    metadata.insert(
        "audio_fingerprint".to_string(),
        json!(file_fingerprint(path, size_bytes)?),
    );
    metadata.insert(
        "file_modified_at".to_string(),
        json!(modified_at.or_else(|| modified_time_iso(path))),
    );
    Ok(metadata)
}

fn ordered_tags(tagged_file: &lofty::file::TaggedFile) -> Vec<&Tag> {
    let mut tags = Vec::new();
    if let Some(primary) = tagged_file.primary_tag() {
        tags.push(primary);
    }
    for tag in tagged_file.tags() {
        if !tags.iter().any(|existing| std::ptr::eq(*existing, tag)) {
            tags.push(tag);
        }
    }
    tags
}

fn ensure_primary_tag(tagged_file: &mut lofty::file::TaggedFile) -> Result<(), String> {
    if tagged_file.primary_tag_mut().is_some() || tagged_file.first_tag_mut().is_some() {
        return Ok(());
    }
    let tag_type = tagged_file.primary_tag_type();
    if !tagged_file.tag_support(tag_type).is_writable() {
        return Err("Writing tags is not supported for this file type yet".to_string());
    }
    tagged_file.insert_tag(Tag::new(tag_type));
    Ok(())
}

fn text_for_keys(tags: &[&Tag], keys: &[ItemKey]) -> Option<String> {
    for tag in tags {
        for key in keys {
            let values = tag
                .get_strings(*key)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>();
            if !values.is_empty() {
                return Some(values.join("; "));
            }
        }
    }
    None
}

fn int_for_keys(tags: &[&Tag], keys: &[ItemKey]) -> Option<i64> {
    text_for_keys(tags, keys).and_then(|value| parse_int_prefix(&value))
}

fn number_for_keys(tags: &[&Tag], keys: &[ItemKey]) -> Option<f64> {
    text_for_keys(tags, keys).and_then(|value| parse_loose_number(&value))
}

fn gain_for_keys(tags: &[&Tag], keys: &[ItemKey]) -> Option<f64> {
    text_for_keys(tags, keys).and_then(|value| parse_loose_number(&value.replace("dB", "")))
}

fn year_for_tags(tags: &[&Tag]) -> Option<i64> {
    for tag in tags {
        if let Some(date) = tag.date() {
            return Some(i64::from(date.year));
        }
    }
    text_for_keys(
        tags,
        &[
            ItemKey::RecordingDate,
            ItemKey::Year,
            ItemKey::ReleaseDate,
            ItemKey::OriginalReleaseDate,
        ],
    )
    .and_then(|value| parse_year(&value))
}

fn rating_for_tags(tags: &[&Tag]) -> Option<f64> {
    for tag in tags {
        if let Some(rating) = tag.ratings().next() {
            return Some(star_rating_to_f64(rating.rating()));
        }
    }
    text_for_keys(tags, &[ItemKey::Popularimeter]).and_then(|value| parse_file_rating_text(&value))
}

fn star_rating_to_f64(rating: StarRating) -> f64 {
    match rating {
        StarRating::One => 1.0,
        StarRating::Two => 2.0,
        StarRating::Three => 3.0,
        StarRating::Four => 4.0,
        StarRating::Five => 5.0,
    }
}

fn parse_file_rating_text(value: &str) -> Option<f64> {
    let text = value.trim();
    if text.is_empty() {
        return None;
    }

    if let Some((_, rest)) = text.split_once('|') {
        if let Some(rating_text) = rest.split('|').next() {
            if let Some(rating) =
                parse_loose_number(rating_text).and_then(normalize_file_rating_value)
            {
                return Some(rating);
            }
        }
    }

    parse_loose_number(text).and_then(normalize_file_rating_value)
}

fn normalize_file_rating_value(value: f64) -> Option<f64> {
    if !value.is_finite() || value <= 0.0 {
        return None;
    }

    if value <= 5.0 {
        return normalize_rating(Some(value));
    }

    let rating = if value <= 20.0 {
        1.0
    } else if value <= 40.0 {
        2.0
    } else if value <= 60.0 {
        3.0
    } else if value <= 80.0 {
        4.0
    } else if value <= 100.0 {
        5.0
    } else if value <= 128.0 {
        3.0
    } else if value <= 196.0 {
        4.0
    } else if value <= 255.0 {
        5.0
    } else {
        return None;
    };

    Some(rating)
}

fn parse_int_prefix(value: &str) -> Option<i64> {
    let text = value.trim();
    let candidate = text.split('/').next().unwrap_or(text).trim();
    let digits = candidate
        .chars()
        .skip_while(|character| !character.is_ascii_digit())
        .take_while(|character| character.is_ascii_digit())
        .collect::<String>();
    digits.parse::<i64>().ok()
}

fn parse_year(value: &str) -> Option<i64> {
    let chars = value.chars().collect::<Vec<_>>();
    for window in chars.windows(4) {
        if window.iter().all(|character| character.is_ascii_digit()) {
            let candidate = window.iter().collect::<String>();
            if let Ok(year) = candidate.parse::<i64>() {
                if (1900..=2099).contains(&year) {
                    return Some(year);
                }
            }
        }
    }
    None
}

fn parse_loose_number(value: &str) -> Option<f64> {
    let mut started = false;
    let mut buffer = String::new();
    for character in value.trim().chars() {
        if character.is_ascii_digit() || matches!(character, '.' | '-' | '+') {
            started = true;
            buffer.push(character);
        } else if started {
            break;
        }
    }
    buffer.parse::<f64>().ok()
}

fn normalize_rating(value: Option<f64>) -> Option<f64> {
    let rating = value?;
    if !rating.is_finite() {
        return None;
    }
    let rating = (rating * 2.0).round() / 2.0;
    Some(rating.clamp(0.5, 5.0))
}

fn star_rating_from_f64(value: f64) -> StarRating {
    match value.round().clamp(1.0, 5.0) as i64 {
        1 => StarRating::One,
        2 => StarRating::Two,
        3 => StarRating::Three,
        4 => StarRating::Four,
        _ => StarRating::Five,
    }
}

fn bitrate_bits_per_second(kilobits_per_second: Option<u32>) -> Option<i64> {
    kilobits_per_second.map(|value| i64::from(value) * 1000)
}

fn file_fingerprint(path: &Path, size_hint: Option<i64>) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|error| format!("Could not fingerprint file: {error}"))?;
    let size = size_hint
        .and_then(|value| (value >= 0).then_some(value as u64))
        .or_else(|| fs::metadata(path).ok().map(|metadata| metadata.len()))
        .unwrap_or(0);
    let mut hasher = Sha1::new();
    hasher.update(size.to_string().as_bytes());
    if size > 0 {
        for offset in fingerprint_offsets(size) {
            file.seek(SeekFrom::Start(offset))
                .map_err(|error| format!("Could not seek while fingerprinting file: {error}"))?;
            let mut buffer = vec![0u8; 65_536.min(size.saturating_sub(offset) as usize)];
            if !buffer.is_empty() {
                let bytes_read = file.read(&mut buffer).map_err(|error| {
                    format!("Could not read while fingerprinting file: {error}")
                })?;
                hasher.update(&buffer[..bytes_read]);
            }
        }
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn fingerprint_offsets(size: u64) -> Vec<u64> {
    vec![
        0,
        size.saturating_div(2).saturating_sub(32_768),
        size.saturating_sub(65_536),
    ]
}

pub(crate) fn modified_time_iso(path: &Path) -> Option<String> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    system_time_to_iso(modified)
}

fn system_time_to_iso(value: SystemTime) -> Option<String> {
    let duration = value.duration_since(UNIX_EPOCH).ok()?;
    OffsetDateTime::from_unix_timestamp(duration.as_secs() as i64)
        .ok()
        .and_then(|timestamp| timestamp.format(&Rfc3339).ok())
}

fn json_text(value: &JsonValue) -> Option<String> {
    match value {
        JsonValue::Null => None,
        JsonValue::String(text) => Some(text.trim().to_string()).filter(|text| !text.is_empty()),
        _ => Some(value.to_string()),
    }
}

fn write_metadata_field(tag: &mut Tag, field: &str, value: &JsonValue) {
    match field {
        "title" => write_text_key(tag, ItemKey::TrackTitle, value),
        "artist" => write_text_key(tag, ItemKey::TrackArtist, value),
        "album" => write_text_key(tag, ItemKey::AlbumTitle, value),
        "album_artist" => write_text_key(tag, ItemKey::AlbumArtist, value),
        "track_number" => write_int_key(tag, ItemKey::TrackNumber, value),
        "disc_number" => write_int_key(tag, ItemKey::DiscNumber, value),
        "genre" => write_text_key(tag, ItemKey::Genre, value),
        "year" => write_year(tag, value),
        _ => {}
    }
}

fn write_text_key(tag: &mut Tag, key: ItemKey, value: &JsonValue) {
    tag.remove_key(key);
    if let Some(text) = json_text(value) {
        tag.insert_text(key, text);
    }
}

fn write_int_key(tag: &mut Tag, key: ItemKey, value: &JsonValue) {
    tag.remove_key(key);
    let value = value
        .as_i64()
        .or_else(|| value.as_f64().map(|number| number.round() as i64))
        .or_else(|| value.as_str().and_then(|text| parse_int_prefix(text)));
    if let Some(value) = value.filter(|value| *value > 0) {
        tag.insert_text(key, value.to_string());
    }
}

fn write_year(tag: &mut Tag, value: &JsonValue) {
    tag.remove_key(ItemKey::RecordingDate);
    tag.remove_key(ItemKey::Year);
    let year = value
        .as_i64()
        .or_else(|| value.as_f64().map(|number| number.round() as i64))
        .or_else(|| value.as_str().and_then(parse_year));
    if let Some(year) = year.filter(|year| (0..=9999).contains(year)) {
        tag.insert_text(ItemKey::RecordingDate, format!("{year:04}"));
    }
}

fn write_gain_key(tag: &mut Tag, key: ItemKey, value: Option<f64>) {
    tag.remove_key(key);
    if let Some(value) = value.filter(|value| value.is_finite()) {
        tag.insert_text(key, format!("{value:.2} dB"));
    }
}

fn write_number_key(tag: &mut Tag, key: ItemKey, value: Option<f64>) {
    tag.remove_key(key);
    if let Some(value) = value.filter(|value| value.is_finite()) {
        tag.insert_text(key, format!("{value:.6}"));
    }
}

fn looks_like_lrc(text: &str) -> bool {
    text.lines().any(|line| {
        let line = line.trim_start();
        line.len() >= 8
            && line.as_bytes().first() == Some(&b'[')
            && line
                .get(1..3)
                .is_some_and(|part| part.chars().all(|c| c.is_ascii_digit()))
            && line.get(3..4) == Some(":")
            && line
                .get(4..6)
                .is_some_and(|part| part.chars().all(|c| c.is_ascii_digit()))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const REPAIR_RATINGS_DB_ENV: &str = "FLAC_CAFE_REPAIR_RATINGS_DB";

    #[test]
    fn parses_messy_track_numbers_and_years() {
        assert_eq!(parse_int_prefix("03/12"), Some(3));
        assert_eq!(parse_int_prefix("Disc 2"), Some(2));
        assert_eq!(parse_year("released 2024-02-01"), Some(2024));
        assert_eq!(parse_year("1888 remaster"), None);
    }

    #[test]
    fn normalizes_half_star_ratings_for_sqlite() {
        assert_eq!(normalize_rating(Some(4.26)), Some(4.5));
        assert_eq!(normalize_rating(Some(0.1)), Some(0.5));
        assert_eq!(normalize_rating(Some(9.0)), Some(5.0));
        assert_eq!(normalize_rating(None), None);
    }

    #[test]
    fn normalizes_common_file_rating_scales() {
        assert_eq!(normalize_file_rating_value(1.0), Some(1.0));
        assert_eq!(normalize_file_rating_value(4.5), Some(4.5));
        assert_eq!(normalize_file_rating_value(20.0), Some(1.0));
        assert_eq!(normalize_file_rating_value(40.0), Some(2.0));
        assert_eq!(normalize_file_rating_value(60.0), Some(3.0));
        assert_eq!(normalize_file_rating_value(80.0), Some(4.0));
        assert_eq!(normalize_file_rating_value(100.0), Some(5.0));
        assert_eq!(normalize_file_rating_value(128.0), Some(3.0));
        assert_eq!(normalize_file_rating_value(196.0), Some(4.0));
        assert_eq!(normalize_file_rating_value(255.0), Some(5.0));
        assert_eq!(normalize_file_rating_value(0.0), None);
        assert_eq!(normalize_file_rating_value(999.0), None);
    }

    #[test]
    fn parses_popularimeter_text_without_clamping_to_five_stars() {
        assert_eq!(parse_file_rating_text("MusicBee|4|0"), Some(4.0));
        assert_eq!(parse_file_rating_text("40"), Some(2.0));
        assert_eq!(parse_file_rating_text("RATING=80"), Some(4.0));
    }

    #[test]
    fn maps_file_rating_to_common_popularimeter_star() {
        assert_eq!(star_rating_from_f64(0.5), StarRating::One);
        assert_eq!(star_rating_from_f64(2.5), StarRating::Three);
        assert_eq!(star_rating_from_f64(5.0), StarRating::Five);
    }

    #[test]
    #[ignore]
    fn repair_installed_db_ratings_from_file_tags() {
        let db_path = std::env::var(REPAIR_RATINGS_DB_ENV)
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| panic!("Set {REPAIR_RATINGS_DB_ENV} to the installed database"));
        let connection = rusqlite::Connection::open(&db_path)
            .unwrap_or_else(|error| panic!("Could not open {}: {error}", db_path.display()));
        connection
            .busy_timeout(std::time::Duration::from_secs(10))
            .expect("Could not set SQLite busy timeout");

        let before_five_star_count: i64 = connection
            .query_row(
                "SELECT count(*) FROM tracks WHERE abs(coalesce(rating, -1) - 5.0) < 0.001",
                [],
                |row| row.get(0),
            )
            .expect("Could not count existing five-star ratings");
        let before_rated_count: i64 = connection
            .query_row(
                "SELECT count(*) FROM tracks WHERE rating IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .expect("Could not count existing ratings");

        let backup_path = db_path.with_extension(format!(
            "ratings-backup-{}.sqlite3",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("Clock before Unix epoch")
                .as_secs()
        ));
        connection
            .execute(
                "VACUUM main INTO ?1",
                [backup_path.to_string_lossy().as_ref()],
            )
            .unwrap_or_else(|error| {
                panic!("Could not back up DB to {}: {error}", backup_path.display())
            });

        let mut statement = connection
            .prepare("SELECT id, path, rating FROM tracks ORDER BY id")
            .expect("Could not prepare track rating repair query");
        let tracks = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<f64>>(2)?,
                ))
            })
            .expect("Could not query tracks")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("Could not read tracks");
        drop(statement);

        let mut updates = Vec::new();
        let mut missing = 0usize;
        let mut unreadable = 0usize;
        let mut without_file_rating = 0usize;
        for (index, (track_id, path, current_rating)) in tracks.iter().enumerate() {
            if index > 0 && index % 250 == 0 {
                println!("checked {index}/{} tracks", tracks.len());
            }
            let path = Path::new(path);
            if !path.is_file() {
                missing += 1;
                continue;
            }
            match read_rating_from_file(path) {
                Ok(Some(file_rating)) => {
                    let changed = current_rating
                        .map(|rating| (rating - file_rating).abs() >= 0.001)
                        .unwrap_or(true);
                    if changed {
                        updates.push((*track_id, file_rating));
                    }
                }
                Ok(None) => without_file_rating += 1,
                Err(error) => {
                    unreadable += 1;
                    eprintln!("rating repair skipped {}: {error}", path.display());
                }
            }
        }

        let mut connection = connection;
        let transaction = connection
            .transaction()
            .expect("Could not start rating repair transaction");
        {
            let mut update = transaction
                .prepare("UPDATE tracks SET rating = ?1, updated_at = datetime('now') WHERE id = ?2")
                .expect("Could not prepare rating repair update");
            for (track_id, rating) in &updates {
                update
                    .execute(rusqlite::params![rating, track_id])
                    .expect("Could not update repaired track rating");
            }
        }
        transaction
            .commit()
            .expect("Could not commit repaired track ratings");
        crate::library::refresh_library_derived_data(&connection)
            .expect("Could not refresh derived library data after rating repair");

        let after_five_star_count: i64 = connection
            .query_row(
                "SELECT count(*) FROM tracks WHERE abs(coalesce(rating, -1) - 5.0) < 0.001",
                [],
                |row| row.get(0),
            )
            .expect("Could not count repaired five-star ratings");
        println!(
            "rating repair complete: backup={}, tracks={}, changed={}, missing={}, unreadable={}, no_file_rating={}, five_star_before={}, five_star_after={}, rated_before={}",
            backup_path.display(),
            tracks.len(),
            updates.len(),
            missing,
            unreadable,
            without_file_rating,
            before_five_star_count,
            after_five_star_count,
            before_rated_count
        );
    }

    fn read_rating_from_file(path: &Path) -> Result<Option<f64>, String> {
        let tagged_file = lofty::read_from_path(path)
            .map_err(|error| format!("Could not read audio metadata with Lofty: {error}"))?;
        let tags = ordered_tags(&tagged_file);
        Ok(rating_for_tags(&tags))
    }
}
