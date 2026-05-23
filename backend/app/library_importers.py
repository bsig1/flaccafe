from __future__ import annotations

import csv
import plistlib
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from .database import connect, rows_to_dicts
from .scanner import path_key


SUPPORTED_SOURCES = {"musicbee", "itunes", "windows_media_player"}


@dataclass
class ImportedLibraryStat:
    row_number: int
    source: str
    path: str | None = None
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    rating: float | None = None
    play_count: int | None = None
    last_played_at: str | None = None
    error: str | None = None


def _header_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _row_value(row: dict[str, Any], *aliases: str) -> Any:
    keyed = {_header_key(str(key)): value for key, value in row.items()}
    for alias in aliases:
        value = keyed.get(_header_key(alias))
        if value is not None and str(value).strip():
            return value
    return None


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _file_location(value: Any) -> str | None:
    text = _clean_text(value)
    if not text:
        return None
    if text.lower().startswith("file:"):
        parsed = urlparse(text)
        path = unquote(parsed.path)
        if parsed.netloc:
            path = f"//{parsed.netloc}{path}"
        if re.match(r"^/[a-zA-Z]:", path):
            path = path[1:]
        return str(Path(path))
    return text


def _rating(value: Any) -> float | None:
    text = _clean_text(value)
    if not text:
        return None
    text = text.replace("%", "").replace("stars", "").replace("star", "").strip()
    if "/" in text:
        left, right = text.split("/", 1)
        try:
            number = float(left.strip()) / max(float(right.strip()), 1.0) * 5.0
        except ValueError:
            return None
    else:
        try:
            number = float(text)
        except ValueError:
            return None
    if number <= 0:
        return None
    if number > 5:
        number = number / 20.0
    number = max(0.5, min(5.0, number))
    return round(number * 2) / 2


def _play_count(value: Any) -> int | None:
    text = _clean_text(value)
    if not text:
        return None
    try:
        return max(0, int(float(text)))
    except ValueError:
        return None


def _timestamp(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        stamp = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return stamp.astimezone(timezone.utc).isoformat()
    text = _clean_text(value)
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        stamp = datetime.fromisoformat(normalized)
        stamp = stamp if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)
        return stamp.astimezone(timezone.utc).isoformat()
    except ValueError:
        return text


def _musicbee_csv(path: Path, limit: int) -> list[ImportedLibraryStat]:
    records: list[ImportedLibraryStat] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, start=2):
            if len(records) >= limit:
                break
            records.append(
                ImportedLibraryStat(
                    row_number=row_number,
                    source="musicbee",
                    path=_file_location(_row_value(row, "path", "file path", "filename", "file", "location", "url")),
                    title=_clean_text(_row_value(row, "title", "track", "name")),
                    artist=_clean_text(_row_value(row, "artist", "album artist", "artists")),
                    album=_clean_text(_row_value(row, "album")),
                    rating=_rating(_row_value(row, "rating", "stars", "score")),
                    play_count=_play_count(_row_value(row, "play count", "plays", "played", "playcount")),
                    last_played_at=_timestamp(_row_value(row, "last played", "last played at", "lastplayed")),
                )
            )
    return records


def _itunes_xml(path: Path, limit: int) -> list[ImportedLibraryStat]:
    with path.open("rb") as handle:
        payload = plistlib.load(handle)
    tracks = payload.get("Tracks", {}) if isinstance(payload, dict) else {}
    records: list[ImportedLibraryStat] = []
    for index, track in enumerate(tracks.values(), start=1):
        if len(records) >= limit:
            break
        if not isinstance(track, dict):
            continue
        records.append(
            ImportedLibraryStat(
                row_number=index,
                source="itunes",
                path=_file_location(track.get("Location")),
                title=_clean_text(track.get("Name")),
                artist=_clean_text(track.get("Artist") or track.get("Album Artist")),
                album=_clean_text(track.get("Album")),
                rating=_rating(track.get("Rating")),
                play_count=_play_count(track.get("Play Count")),
                last_played_at=_timestamp(track.get("Play Date UTC") or track.get("Play Date")),
            )
        )
    return records


def _windows_media_player_xml(path: Path, limit: int) -> list[ImportedLibraryStat]:
    tree = ET.parse(path)
    records: list[ImportedLibraryStat] = []
    for index, element in enumerate(tree.iter(), start=1):
        if len(records) >= limit:
            break
        if element.tag.split("}")[-1].lower() != "media":
            continue
        attrs = {_header_key(key): value for key, value in element.attrib.items()}
        records.append(
            ImportedLibraryStat(
                row_number=index,
                source="windows_media_player",
                path=_file_location(attrs.get("src") or attrs.get("path") or attrs.get("href")),
                title=_clean_text(attrs.get("title") or attrs.get("name")),
                artist=_clean_text(attrs.get("artist") or attrs.get("author")),
                album=_clean_text(attrs.get("album")),
                rating=_rating(attrs.get("userrating") or attrs.get("rating")),
                play_count=_play_count(attrs.get("playcount") or attrs.get("plays")),
                last_played_at=_timestamp(attrs.get("lastplayed") or attrs.get("lastplayedat")),
            )
        )
    return records


def parse_import_file(source: str, import_path: str, limit: int) -> list[ImportedLibraryStat]:
    normalized_source = source.strip().lower()
    if normalized_source not in SUPPORTED_SOURCES:
        raise ValueError("Unsupported importer source")
    path = Path(import_path).expanduser()
    if not path.exists() or not path.is_file():
        raise ValueError("Import file does not exist")
    if normalized_source == "musicbee":
        return _musicbee_csv(path, limit)
    if normalized_source == "itunes":
        return _itunes_xml(path, limit)
    return _windows_media_player_xml(path, limit)


def _artist_title_key(artist: str | None, title: str | None) -> str | None:
    if not artist or not title:
        return None
    return f"{artist.strip().lower()}|{title.strip().lower()}"


def _track_lookup() -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                """
                SELECT id, path, path_key, title, artist, album, rating, play_count, last_played_at
                FROM tracks
                """
            )
        )
    by_path = {str(row["path_key"]): row for row in rows if row.get("path_key")}
    by_artist_title: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = _artist_title_key(row.get("artist"), row.get("title"))
        if key and key not in by_artist_title:
            by_artist_title[key] = row
    return by_path, by_artist_title


def _match_track(record: ImportedLibraryStat, by_path: dict[str, dict[str, Any]], by_artist_title: dict[str, dict[str, Any]]) -> tuple[dict[str, Any] | None, str | None]:
    if record.path:
        key = path_key(Path(record.path))
        if key in by_path:
            return by_path[key], "path"
    title_key = _artist_title_key(record.artist, record.title)
    if title_key and title_key in by_artist_title:
        return by_artist_title[title_key], "artist_title"
    return None, None


def import_library_stats(source: str, import_path: str, apply: bool, missing_only: bool, limit: int) -> dict[str, Any]:
    records = parse_import_file(source, import_path, limit)
    by_path, by_artist_title = _track_lookup()
    previews: list[dict[str, Any]] = []
    applied = 0
    matched = 0
    changed = 0
    errors = 0

    with connect() as conn:
        for record in records:
            track, matched_by = _match_track(record, by_path, by_artist_title)
            changed_fields: list[str] = []
            update_values: dict[str, Any] = {}
            error = record.error
            if track is None:
                error = error or "No matching local track"
                errors += 1
            else:
                matched += 1
                if record.rating is not None and (not missing_only or track.get("rating") is None):
                    if track.get("rating") != record.rating:
                        update_values["rating"] = record.rating
                        changed_fields.append("rating")
                if record.play_count is not None and (not missing_only or int(track.get("play_count") or 0) == 0):
                    if int(track.get("play_count") or 0) != record.play_count:
                        update_values["play_count"] = record.play_count
                        changed_fields.append("play_count")
                if record.last_played_at and (not missing_only or not track.get("last_played_at")):
                    if track.get("last_played_at") != record.last_played_at:
                        update_values["last_played_at"] = record.last_played_at
                        changed_fields.append("last_played_at")
                if changed_fields:
                    changed += 1
                    if apply:
                        assignments = ", ".join(f"{field} = :{field}" for field in update_values)
                        conn.execute(
                            f"UPDATE tracks SET {assignments}, updated_at = datetime('now') WHERE id = :track_id",
                            {**update_values, "track_id": int(track["id"])},
                        )
                        applied += 1
            previews.append(
                {
                    "row_number": record.row_number,
                    "source": record.source,
                    "path": record.path,
                    "title": record.title,
                    "artist": record.artist,
                    "album": record.album,
                    "track_id": int(track["id"]) if track else None,
                    "matched_by": matched_by,
                    "imported_rating": record.rating,
                    "imported_play_count": record.play_count,
                    "imported_last_played_at": record.last_played_at,
                    "current_rating": track.get("rating") if track else None,
                    "current_play_count": int(track.get("play_count") or 0) if track else None,
                    "current_last_played_at": track.get("last_played_at") if track else None,
                    "changed_fields": changed_fields,
                    "error": error,
                }
            )
        if apply:
            conn.commit()

    return {
        "source": source,
        "import_path": import_path,
        "total_rows": len(records),
        "matched": matched,
        "changed": changed,
        "applied": applied,
        "errors": errors,
        "previews": previews,
    }
