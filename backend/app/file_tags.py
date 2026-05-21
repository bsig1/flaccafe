from __future__ import annotations

from pathlib import Path

from mutagen import File as MutagenFile
from mutagen.flac import FLAC
from mutagen.id3 import ID3NoHeaderError, POPM, TXXX, USLT
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4, MP4FreeForm
from mutagen.oggopus import OggOpus
from mutagen.oggvorbis import OggVorbis


APP_RATING_EMAIL = "rating@flaccafe.local"
FMPS_RATING = "FMPS_Rating"
PLAIN_RATING = "RATING"

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


def _metadata_value(value: object) -> list[str] | None:
    if value is None:
        return None
    text = str(value).strip()
    return [text] if text else None


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
                audio.tags.pop(tag_key, None)
            else:
                audio.tags[tag_key] = value
        except Exception as exc:
            raise ValueError(f"Could not write {field} to {path.suffix or 'this file type'}") from exc

    audio.save()


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
