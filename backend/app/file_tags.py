from __future__ import annotations

import base64
from pathlib import Path

from mutagen import File as MutagenFile
from mutagen.flac import FLAC
from mutagen.flac import Picture
from mutagen.id3 import APIC, ID3NoHeaderError, POPM, TXXX, USLT
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4, MP4Cover, MP4FreeForm
from mutagen.oggopus import OggOpus
from mutagen.oggvorbis import OggVorbis


APP_RATING_EMAIL = "rating@flaccafe.local"
FMPS_RATING = "FMPS_Rating"
PLAIN_RATING = "RATING"

REPLAYGAIN_TEXT_KEYS = {
    "track_gain": ["REPLAYGAIN_TRACK_GAIN", "replaygain_track_gain", "track_gain"],
    "track_peak": ["REPLAYGAIN_TRACK_PEAK", "replaygain_track_peak", "track_peak"],
    "album_gain": ["REPLAYGAIN_ALBUM_GAIN", "replaygain_album_gain", "album_gain"],
    "album_peak": ["REPLAYGAIN_ALBUM_PEAK", "replaygain_album_peak", "album_peak"],
}

METADATA_KEY_MAP = {
    "title": "title",
    "artist": "artist",
    "album": "album",
    "album_artist": "albumartist",
    "track_number": "tracknumber",
    "disc_number": "discnumber",
    "genre": "genre",
    "year": "date",
}


def normalize_rating(value: float | None) -> float | None:
    if value is None:
        return None
    rating = round(float(value) * 2) / 2
    return max(0.5, min(5.0, rating))


def rating_percent(value: float | None) -> str | None:
    rating = normalize_rating(value)
    if rating is None:
        return None
    return str(round((rating / 5.0) * 100))


def fmps_value(value: float | None) -> str | None:
    rating = normalize_rating(value)
    if rating is None:
        return None
    return f"{rating / 5.0:.3f}"


def _remove_text_keys(tags: object, keys: list[str]) -> None:
    for key in keys:
        try:
            if key in tags:  # type: ignore[operator]
                del tags[key]  # type: ignore[index]
        except Exception:
            continue


def _matching_text_keys(tags: object, keys: list[str]) -> list[str]:
    wanted = {key.lower() for key in keys}
    try:
        return [str(existing) for existing in tags.keys() if str(existing).lower() in wanted]  # type: ignore[attr-defined]
    except Exception:
        return keys


def _write_vorbis_rating(audio: FLAC | OggVorbis | OggOpus, rating: float | None) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create Vorbis-style tags")

    _remove_text_keys(audio.tags, [PLAIN_RATING, PLAIN_RATING.lower(), FMPS_RATING, FMPS_RATING.lower()])
    percent = rating_percent(rating)
    fmps = fmps_value(rating)
    if percent is not None and fmps is not None:
        audio.tags[PLAIN_RATING] = [percent]
        audio.tags[FMPS_RATING] = [fmps]
    audio.save()


def _write_mp3_rating(audio: MP3, rating: float | None) -> None:
    try:
        tags = audio.tags
        if tags is None:
            audio.add_tags()
            tags = audio.tags
    except ID3NoHeaderError:
        audio.add_tags()
        tags = audio.tags

    if tags is None:
        raise ValueError("Could not create ID3 tags")

    tags.delall(f"POPM:{APP_RATING_EMAIL}")
    for frame in list(tags.getall("TXXX")):
        if frame.desc in {FMPS_RATING, PLAIN_RATING, "FLAC Cafe Rating"}:
            tags.delall(f"TXXX:{frame.desc}")

    percent = rating_percent(rating)
    fmps = fmps_value(rating)
    if percent is not None and fmps is not None:
        popm_rating = max(1, min(255, round((normalize_rating(rating) or 0) / 5.0 * 255)))
        tags.add(POPM(email=APP_RATING_EMAIL, rating=popm_rating, count=0))
        tags.add(TXXX(encoding=3, desc=PLAIN_RATING, text=[percent]))
        tags.add(TXXX(encoding=3, desc=FMPS_RATING, text=[fmps]))
        tags.add(TXXX(encoding=3, desc="FLAC Cafe Rating", text=[str(normalize_rating(rating))]))
    audio.save()


def _write_mp4_rating(audio: MP4, rating: float | None) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create MP4 tags")

    keys = [
        "----:com.apple.iTunes:RATING",
        "----:com.apple.iTunes:FMPS_Rating",
        "----:com.apple.iTunes:FLAC Cafe Rating",
    ]
    _remove_text_keys(audio.tags, keys)
    percent = rating_percent(rating)
    fmps = fmps_value(rating)
    normalized = normalize_rating(rating)
    if percent is not None and fmps is not None and normalized is not None:
        audio.tags["----:com.apple.iTunes:RATING"] = [MP4FreeForm(percent.encode("utf-8"))]
        audio.tags["----:com.apple.iTunes:FMPS_Rating"] = [MP4FreeForm(fmps.encode("utf-8"))]
        audio.tags["----:com.apple.iTunes:FLAC Cafe Rating"] = [MP4FreeForm(str(normalized).encode("utf-8"))]
    audio.save()


def write_track_rating(path: Path, rating: float | None) -> None:
    if not path.exists() or not path.is_file():
        raise ValueError("Audio file is missing on disk")

    audio = MutagenFile(path)
    if audio is None:
        raise ValueError("Could not read audio tags")

    if isinstance(audio, (FLAC, OggVorbis, OggOpus)):
        _write_vorbis_rating(audio, rating)
        return
    if isinstance(audio, MP3):
        _write_mp3_rating(audio, rating)
        return
    if isinstance(audio, MP4):
        _write_mp4_rating(audio, rating)
        return

    raise ValueError(f"Writing ratings is not supported for {path.suffix or 'this file type'} yet")


def _gain_text(value: float | None) -> str | None:
    return None if value is None else f"{float(value):+.2f} dB"


def _peak_text(value: float | None) -> str | None:
    return None if value is None else f"{max(0.0, float(value)):.6f}"


def _replaygain_tag_values(
    track_gain_db: float | None,
    track_peak: float | None,
    album_gain_db: float | None,
    album_peak: float | None,
) -> dict[str, str | None]:
    return {
        "track_gain": _gain_text(track_gain_db),
        "track_peak": _peak_text(track_peak),
        "album_gain": _gain_text(album_gain_db),
        "album_peak": _peak_text(album_peak),
    }


def _write_vorbis_replaygain_tags(
    audio: FLAC | OggVorbis | OggOpus,
    values: dict[str, str | None],
) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create Vorbis-style tags")

    for logical_key, value in values.items():
        keys = REPLAYGAIN_TEXT_KEYS[logical_key]
        _remove_text_keys(audio.tags, _matching_text_keys(audio.tags, keys))
        if value is not None:
            audio.tags[keys[0]] = [value]
    audio.save()


def _write_mp3_replaygain_tags(audio: MP3, values: dict[str, str | None]) -> None:
    try:
        tags = audio.tags
        if tags is None:
            audio.add_tags()
            tags = audio.tags
    except ID3NoHeaderError:
        audio.add_tags()
        tags = audio.tags

    if tags is None:
        raise ValueError("Could not create ID3 tags")

    for logical_key, value in values.items():
        descriptions = REPLAYGAIN_TEXT_KEYS[logical_key]
        for frame in list(tags.getall("TXXX")):
            if str(frame.desc).lower() in {description.lower() for description in descriptions}:
                tags.delall(f"TXXX:{frame.desc}")
        if value is not None:
            tags.add(TXXX(encoding=3, desc=descriptions[1], text=[value]))
    audio.save()


def _write_mp4_replaygain_tags(audio: MP4, values: dict[str, str | None]) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create MP4 tags")

    for logical_key, value in values.items():
        freeform_keys = [f"----:com.apple.iTunes:{key}" for key in REPLAYGAIN_TEXT_KEYS[logical_key]]
        _remove_text_keys(audio.tags, _matching_text_keys(audio.tags, freeform_keys))
        if value is not None:
            audio.tags[freeform_keys[1]] = [MP4FreeForm(value.encode("utf-8"))]
    audio.save()


def write_replaygain_tags(
    path: Path,
    track_gain_db: float | None,
    track_peak: float | None,
    album_gain_db: float | None = None,
    album_peak: float | None = None,
) -> None:
    if not path.exists() or not path.is_file():
        raise ValueError("Audio file is missing on disk")

    audio = MutagenFile(path)
    if audio is None:
        raise ValueError("Could not read audio tags")

    values = _replaygain_tag_values(track_gain_db, track_peak, album_gain_db, album_peak)
    if isinstance(audio, (FLAC, OggVorbis, OggOpus)):
        _write_vorbis_replaygain_tags(audio, values)
        return
    if isinstance(audio, MP3):
        _write_mp3_replaygain_tags(audio, values)
        return
    if isinstance(audio, MP4):
        _write_mp4_replaygain_tags(audio, values)
        return

    raise ValueError(f"Writing volume tags is not supported for {path.suffix or 'this file type'} yet")


def _metadata_value(value: object) -> list[str] | None:
    if value is None:
        return None
    text = str(value).strip()
    return [text] if text else None


def _remove_easy_tag(tags: object, tag_key: str) -> None:
    try:
        if tag_key in tags:  # type: ignore[operator]
            del tags[tag_key]  # type: ignore[index]
    except Exception:
        # Some mutagen tag maps vary in deletion behavior. Missing keys should
        # not make clearing an empty metadata field fail the whole save.
        return


def write_track_metadata(path: Path, metadata: dict[str, object]) -> None:
    if not path.exists() or not path.is_file():
        raise ValueError("Audio file is missing on disk")

    audio = MutagenFile(path, easy=True)
    if audio is None:
        raise ValueError("Could not read audio tags")

    if audio.tags is None:
        try:
            audio.add_tags()
        except Exception as exc:
            raise ValueError(f"Writing metadata is not supported for {path.suffix or 'this file type'} yet") from exc
    if audio.tags is None:
        raise ValueError("Could not create audio tags")

    for field, tag_key in METADATA_KEY_MAP.items():
        if field not in metadata:
            continue
        value = _metadata_value(metadata[field])
        try:
            if value is None:
                _remove_easy_tag(audio.tags, tag_key)
            else:
                audio.tags[tag_key] = value
        except Exception as exc:
            raise ValueError(f"Could not write {field} to {path.suffix or 'this file type'}") from exc

    audio.save()


def _custom_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _custom_mp4_key(key: str) -> str:
    return f"----:com.apple.iTunes:{key}"


def _write_vorbis_custom_tags(audio: FLAC | OggVorbis | OggOpus, tags: dict[str, object | None]) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create Vorbis-style tags")

    for key, raw_value in tags.items():
        value = _custom_text(raw_value)
        matching_keys = [existing for existing in audio.tags.keys() if str(existing).lower() == key.lower()]
        _remove_text_keys(audio.tags, matching_keys or [key])
        if value is not None:
            audio.tags[key] = [value]
    audio.save()


def _write_mp3_custom_tags(audio: MP3, tags: dict[str, object | None]) -> None:
    try:
        id3_tags = audio.tags
        if id3_tags is None:
            audio.add_tags()
            id3_tags = audio.tags
    except ID3NoHeaderError:
        audio.add_tags()
        id3_tags = audio.tags

    if id3_tags is None:
        raise ValueError("Could not create ID3 tags")

    for key, raw_value in tags.items():
        value = _custom_text(raw_value)
        for frame in list(id3_tags.getall("TXXX")):
            if str(frame.desc).lower() == key.lower():
                id3_tags.delall(f"TXXX:{frame.desc}")
        if value is not None:
            id3_tags.add(TXXX(encoding=3, desc=key, text=[value]))
    audio.save()


def _write_mp4_custom_tags(audio: MP4, tags: dict[str, object | None]) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create MP4 tags")

    for key, raw_value in tags.items():
        value = _custom_text(raw_value)
        mp4_key = _custom_mp4_key(key)
        matching_keys = [existing for existing in audio.tags.keys() if str(existing).lower() == mp4_key.lower()]
        _remove_text_keys(audio.tags, matching_keys or [mp4_key])
        if value is not None:
            audio.tags[mp4_key] = [MP4FreeForm(value.encode("utf-8"))]
    audio.save()


def write_custom_tags(path: Path, tags: dict[str, object | None]) -> None:
    if not path.exists() or not path.is_file():
        raise ValueError("Audio file is missing on disk")
    if not tags:
        return

    audio = MutagenFile(path)
    if audio is None:
        raise ValueError("Could not read audio tags")

    if isinstance(audio, (FLAC, OggVorbis, OggOpus)):
        _write_vorbis_custom_tags(audio, tags)
        return
    if isinstance(audio, MP3):
        _write_mp3_custom_tags(audio, tags)
        return
    if isinstance(audio, MP4):
        _write_mp4_custom_tags(audio, tags)
        return

    raise ValueError(f"Writing custom tags is not supported for {path.suffix or 'this file type'} yet")


def _picture_block(data: bytes, media_type: str) -> Picture:
    picture = Picture()
    picture.type = 3
    picture.mime = media_type if media_type in {"image/jpeg", "image/png"} else "image/jpeg"
    picture.desc = "Cover"
    picture.data = data
    return picture


def _first_tag_value(value: object) -> object:
    if isinstance(value, (list, tuple)):
        return value[0] if value else None
    return value


def read_track_artwork(path: Path) -> tuple[bytes, str] | None:
    if not path.exists() or not path.is_file():
        return None

    audio = MutagenFile(path)
    if audio is None:
        return None

    if isinstance(audio, FLAC):
        for picture in audio.pictures or []:
            if getattr(picture, "data", None):
                return picture.data, picture.mime or "image/jpeg"

    tags = audio.tags
    if tags is None:
        return None

    getall = getattr(tags, "getall", None)
    if callable(getall):
        for picture in getall("APIC"):
            data = getattr(picture, "data", None)
            if data:
                return data, getattr(picture, "mime", None) or "image/jpeg"

    try:
        covers = _first_tag_value(tags.get("covr"))  # type: ignore[attr-defined]
    except Exception:
        covers = None
    if covers:
        media_type = "image/png" if getattr(covers, "imageformat", None) == MP4Cover.FORMAT_PNG else "image/jpeg"
        return bytes(covers), media_type

    try:
        encoded_pictures = tags.get("metadata_block_picture", []) or []  # type: ignore[attr-defined]
    except Exception:
        encoded_pictures = []
    for encoded_picture in encoded_pictures:
        try:
            picture = Picture(base64.b64decode(encoded_picture))
        except Exception:
            continue
        if picture.data:
            return picture.data, picture.mime or "image/jpeg"

    try:
        coverart = _first_tag_value(tags.get("coverart"))  # type: ignore[attr-defined]
        covermime = _first_tag_value(tags.get("coverartmime"))  # type: ignore[attr-defined]
    except Exception:
        coverart = None
        covermime = None
    if isinstance(coverart, str):
        try:
            return base64.b64decode(coverart), str(covermime or "image/jpeg")
        except Exception:
            return None

    return None


def _write_flac_artwork(audio: FLAC, data: bytes, media_type: str) -> None:
    preserved = [picture for picture in (audio.pictures or []) if getattr(picture, "type", None) != 3]
    audio.clear_pictures()
    for picture in preserved:
        audio.add_picture(picture)
    audio.add_picture(_picture_block(data, media_type))
    audio.save()


def _write_mp3_artwork(audio: MP3, data: bytes, media_type: str) -> None:
    try:
        tags = audio.tags
        if tags is None:
            audio.add_tags()
            tags = audio.tags
    except ID3NoHeaderError:
        audio.add_tags()
        tags = audio.tags

    if tags is None:
        raise ValueError("Could not create ID3 tags")

    tags.delall("APIC")
    tags.add(APIC(encoding=3, mime=media_type, type=3, desc="Cover", data=data))
    audio.save()


def _write_mp4_artwork(audio: MP4, data: bytes, media_type: str) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create MP4 tags")

    image_format = MP4Cover.FORMAT_PNG if media_type == "image/png" else MP4Cover.FORMAT_JPEG
    audio.tags["covr"] = [MP4Cover(data, imageformat=image_format)]
    audio.save()


def _write_vorbis_artwork(audio: OggVorbis | OggOpus, data: bytes, media_type: str) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create Vorbis-style tags")

    _remove_text_keys(audio.tags, ["metadata_block_picture", "coverart", "coverartmime"])
    encoded = base64.b64encode(_picture_block(data, media_type).write()).decode("ascii")
    audio.tags["metadata_block_picture"] = [encoded]
    audio.save()


def write_track_artwork(path: Path, data: bytes, media_type: str) -> None:
    if not path.exists() or not path.is_file():
        raise ValueError("Audio file is missing on disk")
    if media_type not in {"image/jpeg", "image/png"}:
        raise ValueError("Embedded artwork writes support JPEG and PNG")

    audio = MutagenFile(path)
    if audio is None:
        raise ValueError("Could not read audio tags")

    if isinstance(audio, FLAC):
        _write_flac_artwork(audio, data, media_type)
        return
    if isinstance(audio, MP3):
        _write_mp3_artwork(audio, data, media_type)
        return
    if isinstance(audio, MP4):
        _write_mp4_artwork(audio, data, media_type)
        return
    if isinstance(audio, (OggVorbis, OggOpus)):
        _write_vorbis_artwork(audio, data, media_type)
        return

    raise ValueError(f"Writing artwork is not supported for {path.suffix or 'this file type'} yet")


def _write_vorbis_lyrics(audio: FLAC | OggVorbis | OggOpus, lyrics: str, is_synced: bool) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create Vorbis-style tags")

    _remove_text_keys(audio.tags, ["LYRICS", "lyrics", "UNSYNCEDLYRICS", "unsyncedlyrics", "SYNCEDLYRICS", "syncedlyrics"])
    audio.tags["SYNCEDLYRICS" if is_synced else "LYRICS"] = [lyrics]
    audio.save()


def _write_mp3_lyrics(audio: MP3, lyrics: str, is_synced: bool) -> None:
    try:
        tags = audio.tags
        if tags is None:
            audio.add_tags()
            tags = audio.tags
    except ID3NoHeaderError:
        audio.add_tags()
        tags = audio.tags

    if tags is None:
        raise ValueError("Could not create ID3 tags")

    tags.delall("USLT")
    for frame in list(tags.getall("TXXX")):
        if "lyric" in str(frame.desc).lower():
            tags.delall(f"TXXX:{frame.desc}")

    if is_synced:
        tags.add(TXXX(encoding=3, desc="SYNCEDLYRICS", text=[lyrics]))
    else:
        tags.add(USLT(encoding=3, lang="eng", desc="", text=lyrics))
    audio.save()


def _write_mp4_lyrics(audio: MP4, lyrics: str, is_synced: bool) -> None:
    if audio.tags is None:
        audio.add_tags()
    if audio.tags is None:
        raise ValueError("Could not create MP4 tags")

    _remove_text_keys(audio.tags, ["\xa9lyr", "----:com.apple.iTunes:SYNCEDLYRICS"])
    if is_synced:
        audio.tags["----:com.apple.iTunes:SYNCEDLYRICS"] = [MP4FreeForm(lyrics.encode("utf-8"))]
    else:
        audio.tags["\xa9lyr"] = [lyrics]
    audio.save()


def write_track_lyrics(path: Path, lyrics: str, is_synced: bool = False) -> None:
    if not path.exists() or not path.is_file():
        raise ValueError("Audio file is missing on disk")

    cleaned = lyrics.strip()
    if not cleaned:
        raise ValueError("Lyrics are empty")

    audio = MutagenFile(path)
    if audio is None:
        raise ValueError("Could not read audio tags")

    if isinstance(audio, (FLAC, OggVorbis, OggOpus)):
        _write_vorbis_lyrics(audio, cleaned, is_synced)
        return
    if isinstance(audio, MP3):
        _write_mp3_lyrics(audio, cleaned, is_synced)
        return
    if isinstance(audio, MP4):
        _write_mp4_lyrics(audio, cleaned, is_synced)
        return

    raise ValueError(f"Writing lyrics is not supported for {path.suffix or 'this file type'} yet")
