from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from mutagen import File as MutagenFile

from .config import SUPPORTED_EXTENSIONS
from .database import connect, set_setting


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def path_key(path: Path) -> str:
    return os.path.normcase(str(path.resolve()))


def first_text(tags: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = tags.get(key)
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            cleaned = [str(item).strip() for item in value if str(item).strip()]
            if cleaned:
                return "; ".join(cleaned)
        text = str(value).strip()
        if text:
            return text
    return None


def first_int(tags: dict[str, Any], *keys: str) -> int | None:
    text = first_text(tags, *keys)
    if not text:
        return None
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else None


def parse_year(tags: dict[str, Any]) -> int | None:
    text = first_text(tags, "date", "year", "originaldate", "releasedate")
    if not text:
        return None
    match = re.search(r"(19|20)\d{2}", text)
    return int(match.group(0)) if match else None


def parse_rating(tags: dict[str, Any]) -> float | None:
    text = first_text(tags, "rating", "fmps_rating", "popularimeter")
    if not text:
        return None
    try:
        value = float(text.split(";")[0].strip())
    except ValueError:
        return None

    if value <= 0:
        return None
    if 0 < value <= 1:
        stars = value * 5
    elif 1 <= value <= 5:
        stars = value
    elif 5 < value <= 100:
        stars = value / 20
    else:
        return None
    return max(0.5, min(5.0, round(stars * 2) / 2))


def read_metadata(path: Path) -> dict[str, Any]:
    audio = MutagenFile(path, easy=True)
    if audio is None:
        raise ValueError("mutagen could not identify file")

    tags = dict(audio.tags or {})
    duration = None
    if getattr(audio, "info", None) is not None and getattr(audio.info, "length", None):
        duration = float(audio.info.length)

    fallback_title = path.stem
    return {
        "path": str(path.resolve()),
        "path_key": path_key(path),
        "title": first_text(tags, "title") or fallback_title,
        "artist": first_text(tags, "artist", "artists", "performer"),
        "album": first_text(tags, "album"),
        "album_artist": first_text(tags, "albumartist", "album_artist"),
        "track_number": first_int(tags, "tracknumber", "track"),
        "disc_number": first_int(tags, "discnumber", "disc"),
        "genre": first_text(tags, "genre"),
        "year": parse_year(tags),
        "duration_seconds": duration,
        "rating": parse_rating(tags),
        "file_modified_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
    }


@dataclass
class ScanStats:
    folder_path: str
    scanned_files: int = 0
    inserted: int = 0
    updated: int = 0
    removed: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


ScanProgressCallback = Callable[[ScanStats, int, int, Path | None, str], None]


def iter_audio_files(folder: Path) -> list[Path]:
    return [
        path
        for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]


def ensure_album(conn, metadata: dict[str, Any]) -> int | None:
    album = metadata.get("album")
    if not album:
        return None
    album_artist = metadata.get("album_artist") or metadata.get("artist")
    year = metadata.get("year")
    conn.execute(
        """
        INSERT OR IGNORE INTO albums(album, album_artist, year)
        VALUES(?, ?, ?)
        """,
        (album, album_artist, year),
    )
    row = conn.execute(
        """
        SELECT id FROM albums
        WHERE album IS ? AND album_artist IS ? AND year IS ?
        """,
        (album, album_artist, year),
    ).fetchone()
    return None if row is None else int(row["id"])


def upsert_track(conn, metadata: dict[str, Any]) -> str:
    album_id = ensure_album(conn, metadata)
    existing = conn.execute(
        "SELECT id, rating FROM tracks WHERE path_key = ?", (metadata["path_key"],)
    ).fetchone()
    now = utc_now()

    if existing is None:
        conn.execute(
            """
            INSERT INTO tracks(
              path, path_key, title, artist, album, album_artist, album_id,
              track_number, disc_number, genre, year, duration_seconds, rating,
              file_modified_at, date_added, updated_at
            )
            VALUES(
              :path, :path_key, :title, :artist, :album, :album_artist, :album_id,
              :track_number, :disc_number, :genre, :year, :duration_seconds, :rating,
              :file_modified_at, :now, :now
            )
            """,
            {**metadata, "album_id": album_id, "now": now},
        )
        return "inserted"

    # Keep user-edited SQLite ratings authoritative after the first scan.
    rating = existing["rating"] if existing["rating"] is not None else metadata.get("rating")
    conn.execute(
        """
        UPDATE tracks
        SET path = :path,
            title = :title,
            artist = :artist,
            album = :album,
            album_artist = :album_artist,
            album_id = :album_id,
            track_number = :track_number,
            disc_number = :disc_number,
            genre = :genre,
            year = :year,
            duration_seconds = :duration_seconds,
            rating = :rating,
            file_modified_at = :file_modified_at,
            updated_at = :now
        WHERE path_key = :path_key
        """,
        {**metadata, "album_id": album_id, "rating": rating, "now": now},
    )
    return "updated"


def is_path_under_folder(path_text: str, folder: Path) -> bool:
    try:
        path = Path(path_text).expanduser().resolve(strict=False)
    except OSError:
        return False
    folder_key = os.path.normcase(str(folder))
    path_key_text = os.path.normcase(str(path))
    return path_key_text == folder_key or path_key_text.startswith(folder_key + os.sep)


def remove_missing_tracks(conn, folder: Path) -> int:
    rows = conn.execute("SELECT id, path FROM tracks").fetchall()
    missing_ids: list[int] = []
    for row in rows:
        if not is_path_under_folder(row["path"], folder):
            continue
        if not Path(row["path"]).exists():
            missing_ids.append(int(row["id"]))

    for track_id in missing_ids:
        conn.execute("DELETE FROM tracks WHERE id = ?", (track_id,))

    if missing_ids:
        conn.execute(
            """
            DELETE FROM albums
            WHERE id NOT IN (
                SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL
            )
            """
        )
    return len(missing_ids)


def scan_folder(
    folder_path: str,
    progress_callback: ScanProgressCallback | None = None,
) -> ScanStats:
    folder = Path(folder_path).expanduser().resolve()
    if not folder.exists() or not folder.is_dir():
        raise ValueError(f"Folder does not exist: {folder}")

    stats = ScanStats(folder_path=str(folder))
    files = iter_audio_files(folder)
    stats.scanned_files = len(files)
    if progress_callback:
        progress_callback(stats, 0, len(files), None, "scanning")

    with connect() as conn:
        for index, audio_path in enumerate(files, start=1):
            if progress_callback:
                progress_callback(stats, index - 1, len(files), audio_path, "scanning")
            try:
                result = upsert_track(conn, read_metadata(audio_path))
                if result == "inserted":
                    stats.inserted += 1
                else:
                    stats.updated += 1
            except Exception as exc:  # Keep one bad file from stopping a library scan.
                stats.skipped += 1
                stats.errors.append(f"{audio_path}: {exc}")
            if progress_callback:
                progress_callback(stats, index, len(files), audio_path, "scanning")
        if progress_callback:
            progress_callback(stats, len(files), len(files), None, "cleaning")
        stats.removed = remove_missing_tracks(conn, folder)
        set_setting(conn, "library_path", str(folder))
        conn.commit()

    if progress_callback:
        progress_callback(stats, len(files), len(files), None, "completed")
    return stats
