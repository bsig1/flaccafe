use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::prelude::*;
use lofty::tag::items::popularimeter::{Popularimeter, StarRating};
use lofty::tag::{ItemKey, Tag};
use serde_json::{json, Map, Value as JsonValue};
use sha1::{Digest, Sha1};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
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

pub(crate) fn read_scan_metadata_results(files: &[AudioSnapshot]) -> Vec<JsonValue> {
    files
        .iter()
        .map(|snapshot| {
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
        })
        .collect()
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
            return Some(f64::from(rating.rating() as u8));
        }
    }
    text_for_keys(tags, &[ItemKey::Popularimeter])
        .and_then(|value| parse_loose_number(&value))
        .and_then(|value| normalize_rating(Some(value)))
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

#[cfg(test)]
mod tests {
    use super::*;

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
    fn maps_file_rating_to_common_popularimeter_star() {
        assert_eq!(star_rating_from_f64(0.5), StarRating::One);
        assert_eq!(star_rating_from_f64(2.5), StarRating::Three);
        assert_eq!(star_rating_from_f64(5.0), StarRating::Five);
    }
}
