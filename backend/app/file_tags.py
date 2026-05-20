from __future__ import annotations

from pathlib import Path

from mutagen import File as MutagenFile
from mutagen.flac import FLAC
from mutagen.id3 import ID3NoHeaderError, POPM, TXXX
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4, MP4FreeForm
from mutagen.oggopus import OggOpus
from mutagen.oggvorbis import OggVorbis


APP_RATING_EMAIL = "rating@flaccafe.local"
FMPS_RATING = "FMPS_Rating"
PLAIN_RATING = "RATING"


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
