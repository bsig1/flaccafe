from __future__ import annotations

import base64
import shutil
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib import error as urlerror
from urllib import parse, request

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from mutagen import File as MutagenFile
from mutagen.flac import Picture
from mutagen.mp4 import MP4Cover

from .config import EXPORT_DIR, database_path
from .database import connect, get_setting, init_db, rows_to_dicts, set_setting
from .file_tags import write_track_rating
from .analysis_jobs import (
    cancel_audio_analysis_job,
    get_audio_analysis_job,
    pause_audio_analysis_job,
    resume_audio_analysis_job,
    start_audio_analysis_job,
)
from .clap_analysis import save_config as save_clap_config
from .clap_analysis import status as clap_status
from .clap_install_jobs import get_clap_install_job, start_clap_install_job
from .playlist import export_m3u
from .recommender import event_metadata, generate_queue
from .scanner import path_key, scan_folder
from .scan_jobs import get_scan_job, start_scan_job
from .schemas import (
    AlbumSummary,
    ArtistInfoResponse,
    AudioAnalysisCoverage,
    AudioAnalysisProgress,
    AudioAnalysisStartRequest,
    AudioAnalysisStartResponse,
    AutoDjRequest,
    AutoDjResponse,
    BackupResponse,
    ClapInstallProgress,
    ClapInstallRequest,
    ClapInstallStartResponse,
    DuplicateGroup,
    ExportRequest,
    ExportResponse,
    ClapConfigRequest,
    ClapStatusResponse,
    LibraryHealthResponse,
    LibraryStatsResponse,
    LyricsResponse,
    PlaylistCreateRequest,
    PlaylistImportRequest,
    PlaylistMoveRequest,
    PlaylistSummary,
    PlaylistTrackRequest,
    PlayEventEntry,
    RatingRequest,
    ScanRequest,
    ScanProgress,
    ScanResult,
    ScanStartResponse,
    SettingsUpdateRequest,
    SettingsResponse,
    SmartPlaylistCreateRequest,
    SmartPlaylistRule,
    SmartPlaylistSummary,
    Track,
    TrackDeleteResponse,
    TrackPage,
)


MEDIA_TYPES = {
    ".flac": "audio/flac",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".wav": "audio/wav",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
}

IMAGE_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

TRUE_SETTING_VALUES = {"1", "true", "yes", "on"}

TRACK_COLUMNS = """
    id, path, title, artist, album, album_artist, track_number,
    disc_number, genre, analysis_provider, analysis_model, analysis_genre,
    analysis_genre_confidence, analysis_genre_tags, analysis_updated_at,
    year, duration_seconds,
    rating, play_count, skip_count, last_played_at, last_skipped_at,
    date_added, file_modified_at
"""

TRACK_JOIN_COLUMNS = """
    tracks.id AS id, tracks.path AS path, tracks.title AS title,
    tracks.artist AS artist, tracks.album AS album, tracks.album_artist AS album_artist,
    tracks.track_number AS track_number, tracks.disc_number AS disc_number,
    tracks.genre AS genre, tracks.analysis_provider AS analysis_provider,
    tracks.analysis_model AS analysis_model, tracks.analysis_genre AS analysis_genre,
    tracks.analysis_genre_confidence AS analysis_genre_confidence,
    tracks.analysis_genre_tags AS analysis_genre_tags,
    tracks.analysis_updated_at AS analysis_updated_at,
    tracks.year AS year, tracks.duration_seconds AS duration_seconds,
    tracks.rating AS rating, tracks.play_count AS play_count, tracks.skip_count AS skip_count,
    tracks.last_played_at AS last_played_at, tracks.last_skipped_at AS last_skipped_at,
    tracks.date_added AS date_added, tracks.file_modified_at AS file_modified_at
"""

TRACK_SORTS = {
    "path": "lower(coalesce(path, ''))",
    "title": "lower(coalesce(title, ''))",
    "artist": "lower(coalesce(artist, ''))",
    "album": "lower(coalesce(album, ''))",
    "album_artist": "lower(coalesce(album_artist, ''))",
    "track_number": "coalesce(track_number, -1)",
    "disc_number": "coalesce(disc_number, -1)",
    "genre": "lower(coalesce(analysis_genre, genre, ''))",
    "analysis_genre": "lower(coalesce(analysis_genre, ''))",
    "analysis_genre_confidence": "coalesce(analysis_genre_confidence, -1)",
    "analysis_provider": "lower(coalesce(analysis_provider, ''))",
    "analysis_updated_at": "coalesce(analysis_updated_at, '')",
    "year": "coalesce(year, -1)",
    "rating": "coalesce(rating, -1)",
    "duration_seconds": "coalesce(duration_seconds, -1)",
    "play_count": "coalesce(play_count, 0)",
    "skip_count": "coalesce(skip_count, 0)",
    "last_played_at": "coalesce(last_played_at, '')",
    "last_skipped_at": "coalesce(last_skipped_at, '')",
    "date_added": "coalesce(date_added, '')",
    "file_modified_at": "coalesce(file_modified_at, '')",
}

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
WIKIPEDIA_USER_AGENT = "FLACCafe/0.1 (local desktop music app)"


def get_track_path(track_id: int) -> Path:
    with connect() as conn:
        row = conn.execute(
            "SELECT path FROM tracks WHERE id = ?",
            (track_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")

    path = Path(row["path"])
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    return path


def setting_enabled(value: str | None) -> bool:
    return (value or "").strip().lower() in TRUE_SETTING_VALUES


def get_write_ratings_to_files(conn) -> bool:
    return setting_enabled(get_setting(conn, "write_ratings_to_files"))


def delete_orphan_albums(conn) -> None:
    conn.execute(
        """
        DELETE FROM albums
        WHERE id NOT IN (
            SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL
        )
        """
    )


def track_where_clause(search: str) -> tuple[str, list[object]]:
    if not search.strip():
        return "", []
    return (
        """
        WHERE lower(coalesce(title, '') || ' ' || coalesce(artist, '') || ' ' ||
                    coalesce(album, '') || ' ' || coalesce(genre, '') || ' ' ||
                    coalesce(analysis_genre, '')) LIKE ?
        """,
        [f"%{search.strip().lower()}%"],
    )


def track_order_clause(sort_by: str, sort_direction: str) -> str:
    sort_expression = TRACK_SORTS.get(sort_by, TRACK_SORTS["artist"])
    direction = "DESC" if sort_direction.lower() == "desc" else "ASC"
    return (
        f"ORDER BY {sort_expression} {direction}, "
        "lower(coalesce(artist, '')) ASC, lower(coalesce(album, '')) ASC, "
        "disc_number ASC, track_number ASC, lower(coalesce(title, '')) ASC, id ASC"
    )


def query_tracks(
    search: str,
    limit: int | None,
    offset: int,
    sort_by: str,
    sort_direction: str,
) -> tuple[list[dict], int]:
    where_clause, params = track_where_clause(search)
    order_clause = track_order_clause(sort_by, sort_direction)
    query = f"SELECT {TRACK_COLUMNS} FROM tracks {where_clause} {order_clause}"
    query_params = list(params)
    if limit is not None:
        query += " LIMIT ? OFFSET ?"
        query_params.extend([limit, offset])
    elif offset:
        query += " LIMIT -1 OFFSET ?"
        query_params.append(offset)

    with connect() as conn:
        total = conn.execute(f"SELECT count(*) AS count FROM tracks {where_clause}", params).fetchone()["count"]
        rows = rows_to_dicts(conn.execute(query, query_params))
    return rows, total


def playlist_tracks(playlist_id: int) -> list[dict]:
    with connect() as conn:
        row = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Playlist not found")
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_JOIN_COLUMNS}
                FROM playlist_tracks
                JOIN tracks ON tracks.id = playlist_tracks.track_id
                WHERE playlist_tracks.playlist_id = ?
                ORDER BY playlist_tracks.position ASC, playlist_tracks.id ASC
                """,
                (playlist_id,),
            )
        )


def compact_playlist_positions(conn, playlist_id: int) -> None:
    rows = conn.execute(
        """
        SELECT id
        FROM playlist_tracks
        WHERE playlist_id = ?
        ORDER BY position ASC, id ASC
        """,
        (playlist_id,),
    ).fetchall()
    for position, row in enumerate(rows, start=1):
        conn.execute(
            "UPDATE playlist_tracks SET position = ? WHERE id = ?",
            (position, row["id"]),
        )


SMART_PRESETS: dict[str, SmartPlaylistRule] = {
    "favorites": SmartPlaylistRule(min_rating=4, not_played_days=7, limit=200),
    "discovery": SmartPlaylistRule(unrated_only=True, limit=200),
    "deep_cuts": SmartPlaylistRule(min_rating=3, max_play_count=1, not_played_days=14, limit=200),
    "recently_added": SmartPlaylistRule(recently_added_days=45, limit=200),
    "unrated": SmartPlaylistRule(unrated_only=True, limit=200),
    "missing_metadata": SmartPlaylistRule(missing_metadata=True, limit=200),
    "duplicates": SmartPlaylistRule(duplicate_only=True, limit=300),
}


def preset_rule(name: str | None) -> SmartPlaylistRule | None:
    if not name:
        return None
    preset = SMART_PRESETS.get(name.strip().casefold())
    return preset.model_copy(update={"preset": name}) if preset else None


def smart_rule_sql(rule: SmartPlaylistRule) -> tuple[str, list[object]]:
    preset = preset_rule(rule.preset)
    if preset:
        rule = preset.model_copy(
            update={key: value for key, value in rule.model_dump().items() if value not in (None, False, "")}
        )

    clauses: list[str] = []
    params: list[object] = []

    def contains(column: str, value: str | None) -> None:
        if value and value.strip():
            clauses.append(f"lower(coalesce({column}, '')) LIKE ?")
            params.append(f"%{value.strip().lower()}%")

    contains(
        "coalesce(title, '') || ' ' || coalesce(artist, '') || ' ' || coalesce(album, '') || ' ' || coalesce(genre, '') || ' ' || coalesce(analysis_genre, '')",
        rule.search,
    )
    contains("artist", rule.artist)
    contains("album", rule.album)
    contains("coalesce(genre, '') || ' ' || coalesce(analysis_genre, '')", rule.genre)

    if rule.unrated_only:
        clauses.append("rating IS NULL")
    if rule.min_rating is not None:
        clauses.append("rating >= ?")
        params.append(rule.min_rating)
    if rule.max_rating is not None:
        clauses.append("rating <= ?")
        params.append(rule.max_rating)
    if rule.not_played_days is not None:
        clauses.append("(last_played_at IS NULL OR datetime(last_played_at) <= datetime('now', ?))")
        params.append(f"-{rule.not_played_days} days")
    if rule.recently_added_days is not None:
        clauses.append("datetime(date_added) >= datetime('now', ?)")
        params.append(f"-{rule.recently_added_days} days")
    if rule.max_play_count is not None:
        clauses.append("play_count <= ?")
        params.append(rule.max_play_count)
    if rule.min_year is not None:
        clauses.append("year >= ?")
        params.append(rule.min_year)
    if rule.max_year is not None:
        clauses.append("year <= ?")
        params.append(rule.max_year)
    if rule.missing_metadata:
        clauses.append(
            """
            (title IS NULL OR trim(title) = '' OR artist IS NULL OR trim(artist) = ''
             OR album IS NULL OR trim(album) = ''
             OR (genre IS NULL OR trim(genre) = '')
                AND (analysis_genre IS NULL OR trim(analysis_genre) = ''))
            """
        )
    if rule.duplicate_only:
        clauses.append(
            """
            id IN (
                SELECT duplicate_tracks.id
                FROM tracks AS duplicate_tracks
                JOIN (
                    SELECT lower(coalesce(title, '')) AS duplicate_title,
                           lower(coalesce(artist, '')) AS duplicate_artist
                    FROM tracks
                    GROUP BY duplicate_title, duplicate_artist
                    HAVING count(*) > 1 AND duplicate_title <> ''
                ) duplicate_keys
                ON lower(coalesce(duplicate_tracks.title, '')) = duplicate_keys.duplicate_title
                AND lower(coalesce(duplicate_tracks.artist, '')) = duplicate_keys.duplicate_artist
            )
            """
        )

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


def smart_tracks(rule: SmartPlaylistRule) -> list[dict]:
    where, params = smart_rule_sql(rule)
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                {where}
                ORDER BY coalesce(rating, 0) DESC,
                         datetime(coalesce(last_played_at, '1970-01-01')) ASC,
                         datetime(date_added) DESC,
                         lower(coalesce(artist, '')) ASC,
                         lower(coalesce(album, '')) ASC,
                         coalesce(disc_number, 0) ASC,
                         coalesce(track_number, 0) ASC
                LIMIT ?
                """,
                [*params, rule.limit],
            )
        )


def parse_m3u_paths(playlist_path: str) -> list[Path]:
    path = Path(playlist_path).expanduser().resolve()
    if not path.exists() or not path.is_file():
        raise ValueError(f"Playlist file does not exist: {path}")

    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except UnicodeDecodeError:
        lines = path.read_text(encoding="latin-1", errors="ignore").splitlines()

    paths: list[Path] = []
    for line in lines:
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        candidate = Path(text)
        if not candidate.is_absolute():
            candidate = (path.parent / candidate).resolve()
        paths.append(candidate)
    return paths


def track_response(conn, track_id: int) -> dict:
    row = conn.execute(
        f"""
        SELECT {TRACK_COLUMNS}
        FROM tracks
        WHERE id = ?
        """,
        (track_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return dict(row)


def first_tag_value(value: object) -> object | None:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def tag_get(tags: object, key: str, default: object | None = None) -> object | None:
    if not hasattr(tags, "get"):
        return default
    try:
        return tags.get(key, default)
    except (KeyError, ValueError):
        return default


def embedded_artwork(path: Path) -> tuple[bytes, str] | None:
    try:
        audio = MutagenFile(path)
    except Exception:
        return None

    if audio is None:
        return None

    # FLAC stores pictures as parsed Picture objects on the file object.
    for picture in getattr(audio, "pictures", []) or []:
        data = getattr(picture, "data", None)
        if data:
            return data, getattr(picture, "mime", None) or "image/jpeg"

    tags = getattr(audio, "tags", None)
    if not tags:
        return None

    # MP3/ID3 stores embedded artwork in APIC frames.
    getall = getattr(tags, "getall", None)
    if callable(getall):
        for picture in getall("APIC"):
            data = getattr(picture, "data", None)
            if data:
                return data, getattr(picture, "mime", None) or "image/jpeg"

    # MP4/M4A uses the covr atom. Mutagen exposes each cover as bytes with a format marker.
    covers = first_tag_value(tag_get(tags, "covr"))
    if covers:
        media_type = "image/png" if getattr(covers, "imageformat", None) == MP4Cover.FORMAT_PNG else "image/jpeg"
        return bytes(covers), media_type

    # Ogg/Vorbis often stores a base64-encoded FLAC Picture block.
    encoded_pictures = tag_get(tags, "metadata_block_picture", []) or []
    for encoded_picture in encoded_pictures:
        try:
            picture = Picture(base64.b64decode(encoded_picture))
        except Exception:
            continue
        if picture.data:
            return picture.data, picture.mime or "image/jpeg"

    # Some older taggers use coverart/coverartmime fields instead.
    coverart = first_tag_value(tag_get(tags, "coverart"))
    if isinstance(coverart, str):
        try:
            data = base64.b64decode(coverart)
        except Exception:
            return None
        covermime = first_tag_value(tag_get(tags, "coverartmime"))
        return data, str(covermime or "image/jpeg")

    return None


def sidecar_artwork(path: Path) -> tuple[bytes, str] | None:
    preferred_names = {"cover", "folder", "front", "album", "albumart", "albumartsmall"}
    try:
        candidates = sorted(path.parent.iterdir(), key=lambda candidate: candidate.name.lower())
    except OSError:
        return None

    for candidate in candidates:
        suffix = candidate.suffix.lower()
        if suffix not in IMAGE_MEDIA_TYPES or not candidate.is_file():
            continue
        if candidate.stem.replace(" ", "").lower() in preferred_names:
            try:
                return candidate.read_bytes(), IMAGE_MEDIA_TYPES[suffix]
            except OSError:
                return None
    return None


def normalize_lyrics(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        try:
            value = value.decode("utf-8")
        except UnicodeDecodeError:
            value = value.decode("latin-1", errors="ignore")
    if isinstance(value, (list, tuple)):
        parts = [normalize_lyrics(item) for item in value]
        text = "\n".join(part for part in parts if part)
    else:
        text = str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "").strip()
    return text or None


def looks_synced(text: str | None) -> bool:
    if not text:
        return False
    return "[" in text and "]" in text and any(char.isdigit() for char in text[:40])


def embedded_lyrics(path: Path) -> tuple[str, str, bool] | None:
    try:
        audio = MutagenFile(path)
    except Exception:
        return None

    tags = getattr(audio, "tags", None) if audio is not None else None
    if not tags:
        return None

    getall = getattr(tags, "getall", None)
    if callable(getall):
        # MusicBee writes unsynced MP3 lyrics into standard ID3 USLT frames.
        for frame in getall("USLT"):
            text = normalize_lyrics(getattr(frame, "text", None))
            if text:
                return text, "embedded:USLT", False

        for frame in getall("SYLT"):
            entries = getattr(frame, "text", None)
            if entries:
                lines = []
                for entry in entries:
                    if isinstance(entry, tuple) and len(entry) >= 2:
                        lines.append(f"[{entry[1] / 1000:.2f}] {entry[0]}")
                    else:
                        normalized = normalize_lyrics(entry)
                        if normalized:
                            lines.append(normalized)
                text = normalize_lyrics(lines)
                if text:
                    return text, "embedded:SYLT", True

        # Some taggers store custom lyrics in TXXX frames.
        for frame in getall("TXXX"):
            description = str(getattr(frame, "desc", "")).lower()
            if "lyric" not in description:
                continue
            text = normalize_lyrics(getattr(frame, "text", None))
            if text:
                return text, f"embedded:TXXX:{getattr(frame, 'desc', 'lyrics')}", looks_synced(text)

    if hasattr(tags, "get"):
        exact_keys = [
            "\xa9lyr",
            "lyrics",
            "unsyncedlyrics",
            "unsynced lyrics",
            "syncedlyrics",
            "synced lyrics",
            "lyric",
        ]
        for key in exact_keys:
            text = normalize_lyrics(tag_get(tags, key))
            if text:
                return text, f"embedded:{key}", looks_synced(text)

        for key in tags.keys():
            key_text = str(key)
            if "lyric" not in key_text.lower():
                continue
            text = normalize_lyrics(tag_get(tags, key_text))
            if text:
                return text, f"embedded:{key_text}", looks_synced(text)

    return None


def sidecar_lyrics(path: Path) -> tuple[str, str, bool] | None:
    candidates = [
        path.with_suffix(".lrc"),
        path.with_suffix(".txt"),
        path.with_name(f"{path.stem}.lyrics.lrc"),
        path.with_name(f"{path.stem}.lyrics.txt"),
    ]
    for candidate in candidates:
        if not candidate.exists() or not candidate.is_file():
            continue
        try:
            text = candidate.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            text = candidate.read_text(encoding="latin-1", errors="ignore")
        except OSError:
            continue
        normalized = normalize_lyrics(text)
        if normalized:
            return normalized, f"sidecar:{candidate.name}", candidate.suffix.lower() == ".lrc" or looks_synced(normalized)
    return None


def primary_artist_name(value: str) -> str:
    artist = re.split(r"\s*[;|]\s*", value, maxsplit=1)[0].strip()
    artist = re.split(r"\s+\b(feat\.?|featuring|with)\b\s+", artist, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    return artist or value.strip()


def artist_cache_key(artist_name: str) -> str:
    return f"v2:{primary_artist_name(artist_name).casefold()}"


def wikipedia_request(params: dict[str, object]) -> dict:
    url = f"{WIKIPEDIA_API_URL}?{parse.urlencode(params)}"
    api_request = request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Api-User-Agent": WIKIPEDIA_USER_AGENT,
            "User-Agent": WIKIPEDIA_USER_AGENT,
        },
    )
    with request.urlopen(api_request, timeout=6) as response:
        return json.loads(response.read().decode("utf-8"))


def is_music_summary(summary: str) -> bool:
    music_terms = [
        "band",
        "singer",
        "songwriter",
        "musician",
        "rapper",
        "record producer",
        "musical group",
        "rock",
        "pop",
        "hip hop",
        "country music",
        "electronic music",
        "jazz",
        "album",
        "grammy",
    ]
    text = summary.casefold()
    return any(term in text for term in music_terms)


def page_to_artist_info(page: dict, fallback_name: str) -> dict[str, str | None] | None:
    summary = str(page.get("extract") or "").strip()
    if not summary or not is_music_summary(summary):
        return None
    thumbnail = page.get("thumbnail") or {}
    return {
        "artist_name": str(page.get("title") or fallback_name),
        "summary": summary,
        "image_url": thumbnail.get("source"),
        "page_url": page.get("fullurl"),
        "source": "Wikipedia",
    }


def fetch_wikipedia_page_by_title(artist_name: str) -> dict[str, str | None] | None:
    payload = wikipedia_request(
        {
            "action": "query",
            "titles": artist_name,
            "prop": "extracts|pageimages|info",
            "exintro": 1,
            "explaintext": 1,
            "exchars": 1600,
            "piprop": "thumbnail",
            "pithumbsize": 900,
            "inprop": "url",
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
        },
    )
    for page in payload.get("query", {}).get("pages", []):
        if page.get("missing"):
            continue
        info = page_to_artist_info(page, artist_name)
        if info:
            return info
    return None


def fetch_artist_info_from_wikipedia(artist_name: str) -> dict[str, str | None]:
    exact_match = fetch_wikipedia_page_by_title(artist_name)
    if exact_match:
        return exact_match

    search_terms = [
        f'"{artist_name}" band',
        f'"{artist_name}" musical group',
        f'"{artist_name}" musician',
        f'"{artist_name}" singer songwriter',
        artist_name,
    ]

    for search_term in search_terms:
        payload = wikipedia_request(
            {
                "action": "query",
                "generator": "search",
                "gsrsearch": search_term,
                "gsrlimit": 1,
                "prop": "extracts|pageimages|info",
                "exintro": 1,
                "explaintext": 1,
                "exchars": 1400,
                "piprop": "thumbnail",
                "pithumbsize": 900,
                "inprop": "url",
                "redirects": 1,
                "format": "json",
                "formatversion": 2,
            },
        )
        pages = payload.get("query", {}).get("pages", [])
        if not pages:
            continue
        info = page_to_artist_info(pages[0], artist_name)
        if info:
            return info

    return {
        "artist_name": artist_name,
        "summary": None,
        "image_url": None,
        "page_url": None,
        "source": "Wikipedia",
    }


def cached_artist_info(artist_name: str, refresh: bool) -> ArtistInfoResponse | None:
    query_name = primary_artist_name(artist_name)
    key = artist_cache_key(query_name)
    cache_age_clause = "" if refresh else "AND updated_at >= datetime('now', '-30 days')"
    with connect() as conn:
        row = conn.execute(
            f"""
            SELECT artist_name, summary, image_url, page_url, source, updated_at
            FROM artist_info_cache
            WHERE artist_key = ? {cache_age_clause}
            """,
            (key,),
        ).fetchone()

    if row is None:
        return None

    return ArtistInfoResponse(
        artist_name=row["artist_name"],
        query=query_name,
        summary=row["summary"],
        image_url=row["image_url"],
        page_url=row["page_url"],
        source=row["source"],
        found=bool(row["summary"]),
        from_cache=True,
        updated_at=row["updated_at"],
    )


def stale_artist_info(artist_name: str, error: str) -> ArtistInfoResponse | None:
    query_name = primary_artist_name(artist_name)
    key = artist_cache_key(query_name)
    with connect() as conn:
        row = conn.execute(
            """
            SELECT artist_name, summary, image_url, page_url, source, updated_at
            FROM artist_info_cache
            WHERE artist_key = ?
            """,
            (key,),
        ).fetchone()

    if row is None:
        return None

    return ArtistInfoResponse(
        artist_name=row["artist_name"],
        query=query_name,
        summary=row["summary"],
        image_url=row["image_url"],
        page_url=row["page_url"],
        source=row["source"],
        found=bool(row["summary"]),
        from_cache=True,
        updated_at=row["updated_at"],
        error=error,
    )


def save_artist_info(query_name: str, info: dict[str, str | None]) -> ArtistInfoResponse:
    key = artist_cache_key(query_name)
    updated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    with connect() as conn:
        conn.execute(
            """
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
            """,
            (
                key,
                info.get("artist_name") or query_name,
                info.get("summary"),
                info.get("image_url"),
                info.get("page_url"),
                info.get("source"),
                updated_at,
            ),
        )
        conn.commit()

    return ArtistInfoResponse(
        artist_name=info.get("artist_name") or query_name,
        query=query_name,
        summary=info.get("summary"),
        image_url=info.get("image_url"),
        page_url=info.get("page_url"),
        source=info.get("source"),
        found=bool(info.get("summary")),
        from_cache=False,
        updated_at=updated_at,
    )


app = FastAPI(title="FLAC Cafe")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/settings", response_model=SettingsResponse)
def get_settings() -> SettingsResponse:
    with connect() as conn:
        library_path = get_setting(conn, "library_path")
        write_ratings_to_files = get_write_ratings_to_files(conn)
    return SettingsResponse(
        library_path=library_path,
        database_path=str(database_path()),
        write_ratings_to_files=write_ratings_to_files,
        extra={"clap": clap_status()},
    )


@app.patch("/settings", response_model=SettingsResponse)
def update_settings(request: SettingsUpdateRequest) -> SettingsResponse:
    with connect() as conn:
        if request.write_ratings_to_files is not None:
            set_setting(conn, "write_ratings_to_files", "1" if request.write_ratings_to_files else "0")
        conn.commit()
    return get_settings()


@app.get("/analysis/clap/status", response_model=ClapStatusResponse)
def get_clap_status() -> dict:
    return clap_status()


@app.post("/analysis/clap/install", response_model=ClapInstallStartResponse)
def install_clap_dependencies(request: ClapInstallRequest) -> dict:
    return start_clap_install_job(device=request.device, force=request.force)


@app.get("/analysis/clap/install/{job_id}", response_model=ClapInstallProgress)
def get_clap_install(job_id: str) -> dict:
    job = get_clap_install_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="CLAP install job not found")
    return job


@app.get("/analysis/clap/coverage", response_model=AudioAnalysisCoverage)
def get_clap_coverage() -> AudioAnalysisCoverage:
    with connect() as conn:
        row = conn.execute(
            """
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
            """
        ).fetchone()
    total = int(row["total_tracks"] or 0)
    analyzed = int(row["analyzed_tracks"] or 0)
    failed = int(row["failed_tracks"] or 0)
    return AudioAnalysisCoverage(
        total_tracks=total,
        analyzed_tracks=analyzed,
        unanalyzed_tracks=max(0, total - analyzed),
        failed_tracks=failed,
        coverage_percent=round((analyzed / total) * 100, 2) if total else 0.0,
    )


@app.patch("/analysis/clap/config", response_model=ClapStatusResponse)
def update_clap_config(request: ClapConfigRequest) -> dict:
    save_clap_config(
        model_id=request.model_id,
        cache_dir=request.cache_dir,
        max_duration_seconds=request.max_duration_seconds,
    )
    return clap_status()


@app.post("/analysis/clap/start", response_model=AudioAnalysisStartResponse)
def start_clap_audio_analysis(request: AudioAnalysisStartRequest) -> dict:
    status = clap_status()
    if not status["installed"]:
        raise HTTPException(status_code=400, detail=status["message"] or "CLAP is not ready")
    return start_audio_analysis_job(
        limit=request.limit,
        overwrite=request.overwrite,
        only_missing=request.only_missing,
        track_ids=request.track_ids,
    )


@app.get("/analysis/clap/jobs/{job_id}", response_model=AudioAnalysisProgress)
def get_clap_audio_analysis(job_id: str) -> dict:
    job = get_audio_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/analysis/clap/jobs/{job_id}/pause", response_model=AudioAnalysisProgress)
def pause_clap_audio_analysis(job_id: str) -> dict:
    job = pause_audio_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/analysis/clap/jobs/{job_id}/resume", response_model=AudioAnalysisProgress)
def resume_clap_audio_analysis(job_id: str) -> dict:
    job = resume_audio_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/analysis/clap/jobs/{job_id}/cancel", response_model=AudioAnalysisProgress)
def cancel_clap_audio_analysis(job_id: str) -> dict:
    job = cancel_audio_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/settings/backup", response_model=BackupResponse)
def backup_database() -> BackupResponse:
    source = database_path()
    if not source.exists():
        raise HTTPException(status_code=404, detail="Database does not exist yet")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = EXPORT_DIR / f"flac-cafe-backup-{stamp}.sqlite"
    shutil.copy2(source, target)
    return BackupResponse(backup_path=str(target))


@app.get("/tracks", response_model=list[Track])
def list_tracks(
    search: str = "",
    limit: int | None = Query(default=None, ge=1, le=100000),
    offset: int = Query(default=0, ge=0),
    sort_by: str = "artist",
    sort_direction: str = "asc",
) -> list[dict]:
    tracks, _total = query_tracks(search, limit, offset, sort_by, sort_direction)
    return tracks


@app.get("/tracks/page", response_model=TrackPage)
def list_track_page(
    search: str = "",
    limit: int = Query(default=150, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    sort_by: str = "artist",
    sort_direction: str = "asc",
) -> TrackPage:
    tracks, total = query_tracks(search, limit, offset, sort_by, sort_direction)
    return TrackPage(tracks=tracks, total=total, limit=limit, offset=offset)


@app.get("/tracks/{track_id}", response_model=Track)
def get_track(track_id: int) -> dict:
    with connect() as conn:
        return track_response(conn, track_id)


@app.delete("/tracks/{track_id}", response_model=TrackDeleteResponse)
def delete_track(track_id: int, delete_file: bool = False) -> TrackDeleteResponse:
    with connect() as conn:
        row = conn.execute("SELECT id, path FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Track not found")

        path = Path(row["path"])
        file_missing = not path.exists()
        deleted_file = False
        if delete_file and not file_missing:
            if not path.is_file():
                raise HTTPException(status_code=400, detail="Track path is not a file")
            try:
                path.unlink()
                deleted_file = True
            except OSError as exc:
                raise HTTPException(status_code=400, detail=f"Could not delete audio file: {exc}") from exc

        conn.execute("DELETE FROM tracks WHERE id = ?", (track_id,))
        delete_orphan_albums(conn)
        conn.commit()

    return TrackDeleteResponse(
        track_id=track_id,
        removed_from_library=True,
        deleted_file=deleted_file,
        file_missing=file_missing,
    )


@app.get("/history", response_model=list[PlayEventEntry])
def play_history(limit: int = Query(default=200, ge=1, le=1000)) -> list[PlayEventEntry]:
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT
                play_events.id AS event_id,
                play_events.track_id,
                play_events.event_type,
                play_events.timestamp,
                play_events.metadata_json,
                {TRACK_JOIN_COLUMNS}
            FROM play_events
            LEFT JOIN tracks ON tracks.id = play_events.track_id
            ORDER BY datetime(play_events.timestamp) DESC, play_events.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    events: list[PlayEventEntry] = []
    for row in rows:
        track = None
        if row["id"] is not None:
            track = {column: row[column] for column in Track.model_fields}
        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except json.JSONDecodeError:
            metadata = {}
        events.append(
            PlayEventEntry(
                id=row["event_id"],
                track_id=row["track_id"],
                event_type=row["event_type"],
                timestamp=row["timestamp"],
                metadata=metadata,
                track=track,
            )
        )
    return events


@app.get("/library/stats", response_model=LibraryStatsResponse)
def library_stats() -> LibraryStatsResponse:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT
                count(*) AS total_tracks,
                count(DISTINCT album_id) AS total_albums,
                count(DISTINCT lower(coalesce(artist, ''))) AS total_artists,
                sum(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) AS rated_tracks,
                sum(CASE WHEN rating IS NULL THEN 1 ELSE 0 END) AS unrated_tracks,
                sum(duration_seconds) AS total_duration_seconds
            FROM tracks
            """
        ).fetchone()
        total_playlists = conn.execute("SELECT count(*) AS count FROM playlists").fetchone()["count"]
        played_events = conn.execute(
            "SELECT count(*) AS count FROM play_events WHERE event_type = 'played'"
        ).fetchone()["count"]
        skipped_events = conn.execute(
            "SELECT count(*) AS count FROM play_events WHERE event_type = 'skipped'"
        ).fetchone()["count"]
    return LibraryStatsResponse(
        total_tracks=row["total_tracks"] or 0,
        total_albums=row["total_albums"] or 0,
        total_artists=row["total_artists"] or 0,
        total_playlists=total_playlists or 0,
        rated_tracks=row["rated_tracks"] or 0,
        unrated_tracks=row["unrated_tracks"] or 0,
        total_duration_seconds=row["total_duration_seconds"],
        played_events=played_events or 0,
        skipped_events=skipped_events or 0,
    )


@app.get("/library/health", response_model=LibraryHealthResponse)
def library_health(limit: int = Query(default=80, ge=1, le=500)) -> LibraryHealthResponse:
    with connect() as conn:
        missing_files = [
            track
            for track in rows_to_dicts(
                conn.execute(
                    f"""
                    SELECT {TRACK_COLUMNS}
                    FROM tracks
                    ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), lower(coalesce(title, ''))
                    """
                )
            )
            if not Path(track["path"]).exists()
        ][:limit]
        missing = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE title IS NULL OR trim(title) = '' OR artist IS NULL OR trim(artist) = ''
                   OR album IS NULL OR trim(album) = ''
                   OR ((genre IS NULL OR trim(genre) = '')
                       AND (analysis_genre IS NULL OR trim(analysis_genre) = ''))
                ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')), lower(coalesce(title, ''))
                LIMIT ?
                """,
                (limit,),
            )
        )
        unrated = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE rating IS NULL
                ORDER BY datetime(date_added) DESC, lower(coalesce(artist, '')), lower(coalesce(title, ''))
                LIMIT ?
                """,
                (limit,),
            )
        )
        duplicate_keys = conn.execute(
            """
            SELECT lower(coalesce(title, '')) AS title_key,
                   lower(coalesce(artist, '')) AS artist_key,
                   coalesce(title, 'Untitled') || ' - ' || coalesce(artist, 'Unknown Artist') AS display_key
            FROM tracks
            GROUP BY title_key, artist_key
            HAVING count(*) > 1 AND title_key <> ''
            ORDER BY count(*) DESC, display_key ASC
            LIMIT 20
            """
        ).fetchall()
        duplicates: list[DuplicateGroup] = []
        for key in duplicate_keys:
            tracks = rows_to_dicts(
                conn.execute(
                    f"""
                    SELECT {TRACK_COLUMNS}
                    FROM tracks
                    WHERE lower(coalesce(title, '')) = ? AND lower(coalesce(artist, '')) = ?
                    ORDER BY path ASC
                    LIMIT ?
                    """,
                    (key["title_key"], key["artist_key"], limit),
                )
            )
            duplicates.append(DuplicateGroup(key=key["display_key"], tracks=tracks))
    return LibraryHealthResponse(
        missing_files=missing_files,
        missing_metadata=missing,
        duplicate_groups=duplicates,
        unrated_tracks=unrated,
    )


@app.get("/smart-playlists/presets", response_model=dict[str, SmartPlaylistRule])
def smart_playlist_presets() -> dict[str, SmartPlaylistRule]:
    return SMART_PRESETS


@app.get("/smart-playlists", response_model=list[SmartPlaylistSummary])
def list_smart_playlists() -> list[SmartPlaylistSummary]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, rule_json, created_at, updated_at
            FROM smart_playlists
            ORDER BY lower(name) ASC
            """
        ).fetchall()
    return [
        SmartPlaylistSummary(
            id=row["id"],
            name=row["name"],
            rule=SmartPlaylistRule(**json.loads(row["rule_json"])),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]


@app.post("/smart-playlists", response_model=SmartPlaylistSummary)
def create_smart_playlist(request: SmartPlaylistCreateRequest) -> SmartPlaylistSummary:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Smart playlist name is required")
    rule_json = json.dumps(request.rule.model_dump(), ensure_ascii=True, sort_keys=True)
    with connect() as conn:
        try:
            conn.execute(
                "INSERT INTO smart_playlists(name, rule_json) VALUES(?, ?)",
                (name, rule_json),
            )
            conn.commit()
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="A smart playlist with that name already exists") from exc
        row = conn.execute(
            "SELECT id, name, rule_json, created_at, updated_at FROM smart_playlists WHERE name = ?",
            (name,),
        ).fetchone()
    return SmartPlaylistSummary(
        id=row["id"],
        name=row["name"],
        rule=SmartPlaylistRule(**json.loads(row["rule_json"])),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.delete("/smart-playlists/{smart_playlist_id}", response_model=list[SmartPlaylistSummary])
def delete_smart_playlist(smart_playlist_id: int) -> list[SmartPlaylistSummary]:
    with connect() as conn:
        row = conn.execute("SELECT id FROM smart_playlists WHERE id = ?", (smart_playlist_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Smart playlist not found")
        conn.execute("DELETE FROM smart_playlists WHERE id = ?", (smart_playlist_id,))
        conn.commit()
    return list_smart_playlists()


@app.post("/smart-playlists/preview", response_model=list[Track])
def preview_smart_playlist(rule: SmartPlaylistRule) -> list[dict]:
    return smart_tracks(rule)


@app.get("/smart-playlists/{smart_playlist_id}/tracks", response_model=list[Track])
def get_smart_playlist_tracks(smart_playlist_id: int) -> list[dict]:
    with connect() as conn:
        row = conn.execute("SELECT rule_json FROM smart_playlists WHERE id = ?", (smart_playlist_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    return smart_tracks(SmartPlaylistRule(**json.loads(row["rule_json"])))


@app.get("/albums", response_model=list[AlbumSummary])
def list_albums(
    search: str = "",
    limit: int = Query(default=5000, ge=1, le=20000),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    where_clause = ""
    params: list[object] = []
    if search.strip():
        where_clause = """
        WHERE lower(coalesce(albums.album, '') || ' ' || coalesce(albums.album_artist, '')) LIKE ?
        """
        params.append(f"%{search.strip().lower()}%")

    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT
                    albums.id,
                    albums.album,
                    albums.album_artist,
                    albums.year,
                    count(tracks.id) AS track_count,
                    sum(tracks.duration_seconds) AS duration_seconds,
                    avg(tracks.rating) AS average_rating,
                    min(tracks.id) AS artwork_track_id
                FROM albums
                JOIN tracks ON tracks.album_id = albums.id
                {where_clause}
                GROUP BY albums.id
                ORDER BY lower(coalesce(albums.album_artist, '')) ASC,
                         coalesce(albums.year, 9999) ASC,
                         lower(coalesce(albums.album, '')) ASC
                LIMIT ? OFFSET ?
                """,
                [*params, limit, offset],
            )
        )


@app.get("/albums/{album_id}/tracks", response_model=list[Track])
def album_tracks(album_id: int) -> list[dict]:
    with connect() as conn:
        row = conn.execute("SELECT id FROM albums WHERE id = ?", (album_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Album not found")
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE album_id = ?
                ORDER BY coalesce(disc_number, 0) ASC,
                         coalesce(track_number, 0) ASC,
                         lower(coalesce(title, '')) ASC,
                         id ASC
                """,
                (album_id,),
            )
        )


@app.get("/playlists", response_model=list[PlaylistSummary])
def list_playlists() -> list[dict]:
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                """
                SELECT
                    playlists.id,
                    playlists.name,
                    count(playlist_tracks.track_id) AS track_count,
                    sum(tracks.duration_seconds) AS duration_seconds,
                    playlists.created_at,
                    playlists.updated_at
                FROM playlists
                LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
                LEFT JOIN tracks ON tracks.id = playlist_tracks.track_id
                GROUP BY playlists.id
                ORDER BY lower(playlists.name) ASC
                """
            )
        )


@app.post("/playlists", response_model=PlaylistSummary)
def create_playlist(request: PlaylistCreateRequest) -> dict:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Playlist name is required")
    with connect() as conn:
        try:
            conn.execute("INSERT INTO playlists(name) VALUES(?)", (name,))
            conn.commit()
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="A playlist with that name already exists") from exc
        row = conn.execute(
            """
            SELECT id, name, 0 AS track_count, NULL AS duration_seconds, created_at, updated_at
            FROM playlists
            WHERE name = ?
            """,
            (name,),
        ).fetchone()
    return dict(row)


@app.delete("/playlists/{playlist_id}", response_model=list[PlaylistSummary])
def delete_playlist(playlist_id: int) -> list[dict]:
    with connect() as conn:
        row = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Playlist not found")
        conn.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
        conn.commit()
    return list_playlists()


@app.get("/playlists/{playlist_id}/tracks", response_model=list[Track])
def get_playlist_tracks(playlist_id: int) -> list[dict]:
    return playlist_tracks(playlist_id)


@app.post("/playlists/{playlist_id}/tracks", response_model=list[Track])
def add_playlist_tracks(playlist_id: int, request: PlaylistTrackRequest) -> list[dict]:
    seen: set[int] = set()
    track_ids = [track_id for track_id in request.track_ids if not (track_id in seen or seen.add(track_id))]
    with connect() as conn:
        playlist = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        if playlist is None:
            raise HTTPException(status_code=404, detail="Playlist not found")
        existing_tracks = {
            row["id"]
            for row in conn.execute(
                f"SELECT id FROM tracks WHERE id IN ({','.join('?' for _ in track_ids)})",
                track_ids,
            )
        }
        missing = [track_id for track_id in track_ids if track_id not in existing_tracks]
        if missing:
            raise HTTPException(status_code=404, detail=f"Track not found: {missing[0]}")

        max_position = conn.execute(
            "SELECT coalesce(max(position), 0) AS position FROM playlist_tracks WHERE playlist_id = ?",
            (playlist_id,),
        ).fetchone()["position"]
        position = int(max_position)
        for track_id in track_ids:
            position += 1
            conn.execute(
                """
                INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position)
                VALUES(?, ?, ?)
                """,
                (playlist_id, track_id, position),
            )
        compact_playlist_positions(conn, playlist_id)
        conn.execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
            (playlist_id,),
        )
        conn.commit()
    return playlist_tracks(playlist_id)


@app.delete("/playlists/{playlist_id}/tracks/{track_id}", response_model=list[Track])
def remove_playlist_track(playlist_id: int, track_id: int) -> list[dict]:
    with connect() as conn:
        playlist = conn.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
        if playlist is None:
            raise HTTPException(status_code=404, detail="Playlist not found")
        conn.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
            (playlist_id, track_id),
        )
        compact_playlist_positions(conn, playlist_id)
        conn.execute(
            "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
            (playlist_id,),
        )
        conn.commit()
    return playlist_tracks(playlist_id)


@app.patch("/playlists/{playlist_id}/tracks/{track_id}/move", response_model=list[Track])
def move_playlist_track(playlist_id: int, track_id: int, request: PlaylistMoveRequest) -> list[dict]:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, position
            FROM playlist_tracks
            WHERE playlist_id = ? AND track_id = ?
            """,
            (playlist_id, track_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Playlist track not found")
        operator = "<" if request.direction == "up" else ">"
        ordering = "DESC" if request.direction == "up" else "ASC"
        swap = conn.execute(
            f"""
            SELECT id, position
            FROM playlist_tracks
            WHERE playlist_id = ? AND position {operator} ?
            ORDER BY position {ordering}
            LIMIT 1
            """,
            (playlist_id, row["position"]),
        ).fetchone()
        if swap is not None:
            conn.execute("UPDATE playlist_tracks SET position = ? WHERE id = ?", (swap["position"], row["id"]))
            conn.execute("UPDATE playlist_tracks SET position = ? WHERE id = ?", (row["position"], swap["id"]))
            conn.execute("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?", (playlist_id,))
            conn.commit()
    return playlist_tracks(playlist_id)


@app.post("/playlists/{playlist_id}/export", response_model=ExportResponse)
def export_playlist(playlist_id: int, request: ExportRequest | None = None) -> ExportResponse:
    tracks = playlist_tracks(playlist_id)
    try:
        path, count = export_m3u(
            [track["id"] for track in tracks],
            request.playlist_path if request else None,
        )
        return ExportResponse(playlist_path=str(path), track_count=count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/playlists/import", response_model=PlaylistSummary)
def import_playlist(request: PlaylistImportRequest) -> dict:
    try:
        imported_paths = parse_m3u_paths(request.playlist_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    source = Path(request.playlist_path).expanduser()
    base_name = (request.name or source.stem or "Imported Playlist").strip()
    if not base_name:
        base_name = "Imported Playlist"

    keys = [path_key(path) for path in imported_paths]
    with connect() as conn:
        name = base_name
        suffix = 2
        while conn.execute("SELECT id FROM playlists WHERE name = ?", (name,)).fetchone() is not None:
            name = f"{base_name} {suffix}"
            suffix += 1

        conn.execute("INSERT INTO playlists(name) VALUES(?)", (name,))
        playlist_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        if keys:
            placeholders = ",".join("?" for _ in keys)
            found = {
                row["path_key"]: row["id"]
                for row in conn.execute(
                    f"SELECT id, path_key FROM tracks WHERE path_key IN ({placeholders})",
                    keys,
                )
            }
        else:
            found = {}

        position = 0
        for key in keys:
            track_id = found.get(key)
            if track_id is None:
                continue
            position += 1
            conn.execute(
                """
                INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position)
                VALUES(?, ?, ?)
                """,
                (playlist_id, track_id, position),
            )
        compact_playlist_positions(conn, playlist_id)
        conn.commit()
        row = conn.execute(
            """
            SELECT
                playlists.id,
                playlists.name,
                count(playlist_tracks.track_id) AS track_count,
                sum(tracks.duration_seconds) AS duration_seconds,
                playlists.created_at,
                playlists.updated_at
            FROM playlists
            LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
            LEFT JOIN tracks ON tracks.id = playlist_tracks.track_id
            WHERE playlists.id = ?
            GROUP BY playlists.id
            """,
            (playlist_id,),
        ).fetchone()
    return dict(row)


@app.post("/scan", response_model=ScanResult)
def scan_library(request: ScanRequest) -> ScanResult:
    try:
        return ScanResult(**scan_folder(request.folder_path).__dict__)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/scan/start", response_model=ScanStartResponse)
def start_scan_library(request: ScanRequest) -> dict:
    try:
        job = start_scan_job(request.folder_path)
        return {
            "job_id": job["job_id"],
            "folder_path": job["folder_path"],
            "status": job["status"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/scan/jobs/{job_id}", response_model=ScanProgress)
def get_scan_progress(job_id: str) -> dict:
    job = get_scan_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return job


@app.patch("/tracks/{track_id}/rating", response_model=Track)
def update_rating(track_id: int, request: RatingRequest) -> dict:
    with connect() as conn:
        row = conn.execute("SELECT id, path FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Track not found")

        file_modified_at = None
        if get_write_ratings_to_files(conn):
            try:
                path = Path(row["path"])
                write_track_rating(path, request.rating)
                if path.exists():
                    file_modified_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat()
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            except OSError as exc:
                raise HTTPException(status_code=400, detail=f"Could not write rating to file: {exc}") from exc

        conn.execute(
            """
            UPDATE tracks
            SET rating = ?,
                file_modified_at = coalesce(?, file_modified_at),
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (request.rating, file_modified_at, track_id),
        )
        conn.execute(
            """
            INSERT INTO play_events(track_id, event_type, metadata_json)
            VALUES(?, 'rated', ?)
            """,
            (track_id, event_metadata(rating=request.rating)),
        )
        conn.commit()
        updated = conn.execute(
            f"""
            SELECT {TRACK_COLUMNS}
            FROM tracks
            WHERE id = ?
            """,
            (track_id,),
        ).fetchone()
    return dict(updated)


@app.head("/tracks/{track_id}/audio")
@app.get("/tracks/{track_id}/audio")
def stream_track_audio(track_id: int) -> FileResponse:
    path = get_track_path(track_id)
    return FileResponse(
        path,
        media_type=MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream"),
    )


@app.get("/tracks/{track_id}/artwork")
def track_artwork(track_id: int) -> Response:
    path = get_track_path(track_id)
    artwork = embedded_artwork(path) or sidecar_artwork(path)
    if artwork is None:
        raise HTTPException(status_code=404, detail="No embedded artwork found")

    data, media_type = artwork
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@app.get("/tracks/{track_id}/lyrics", response_model=LyricsResponse)
def track_lyrics(track_id: int) -> LyricsResponse:
    path = get_track_path(track_id)
    found = embedded_lyrics(path) or sidecar_lyrics(path)
    if found is None:
        return LyricsResponse(track_id=track_id)

    lyrics, source, is_synced = found
    return LyricsResponse(track_id=track_id, lyrics=lyrics, source=source, is_synced=is_synced)


@app.get("/artists/info", response_model=ArtistInfoResponse)
def artist_info(name: str, refresh: bool = False) -> ArtistInfoResponse:
    query_name = primary_artist_name(name)
    if not query_name:
        raise HTTPException(status_code=400, detail="Artist name is required")

    cached = cached_artist_info(query_name, refresh)
    if cached is not None:
        return cached

    try:
        info = fetch_artist_info_from_wikipedia(query_name)
    except (OSError, TimeoutError, urlerror.URLError, json.JSONDecodeError) as exc:
        stale = stale_artist_info(query_name, str(exc))
        if stale is not None:
            return stale
        return ArtistInfoResponse(
            artist_name=query_name,
            query=query_name,
            source="Wikipedia",
            found=False,
            error="Artist lookup is unavailable right now.",
        )

    return save_artist_info(query_name, info)


@app.delete("/artists/cache")
def clear_artist_cache() -> dict[str, int]:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM artist_info_cache")
        conn.commit()
    return {"deleted": cursor.rowcount if cursor.rowcount is not None else 0}


@app.get("/artists/local-tracks", response_model=list[Track])
def artist_local_tracks(
    name: str,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict]:
    artist = primary_artist_name(name)
    if not artist:
        raise HTTPException(status_code=400, detail="Artist name is required")
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                WHERE lower(coalesce(artist, '')) LIKE ?
                ORDER BY coalesce(rating, 0) DESC,
                         play_count DESC,
                         skip_count ASC,
                         lower(coalesce(album, '')) ASC,
                         coalesce(disc_number, 0) ASC,
                         coalesce(track_number, 0) ASC
                LIMIT ?
                """,
                (f"%{artist.lower()}%", limit),
            )
        )


@app.post("/tracks/{track_id}/played", response_model=Track)
def mark_track_played(track_id: int) -> dict:
    played_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    with connect() as conn:
        row = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Track not found")

        conn.execute(
            """
            UPDATE tracks
            SET play_count = play_count + 1,
                last_played_at = ?,
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (played_at, track_id),
        )
        conn.execute(
            """
            INSERT INTO play_events(track_id, event_type, metadata_json)
            VALUES(?, 'played', ?)
            """,
            (track_id, event_metadata(source="player")),
        )
        conn.commit()
        updated = conn.execute(
            f"""
            SELECT {TRACK_COLUMNS}
            FROM tracks
            WHERE id = ?
            """,
            (track_id,),
        ).fetchone()
    return dict(updated)


@app.post("/tracks/{track_id}/skipped", response_model=Track)
def mark_track_skipped(track_id: int) -> dict:
    skipped_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    with connect() as conn:
        row = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Track not found")

        conn.execute(
            """
            UPDATE tracks
            SET skip_count = skip_count + 1,
                last_skipped_at = ?,
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (skipped_at, track_id),
        )
        conn.execute(
            """
            INSERT INTO play_events(track_id, event_type, metadata_json)
            VALUES(?, 'skipped', ?)
            """,
            (track_id, event_metadata(source="player")),
        )
        conn.commit()
        updated = conn.execute(
            f"""
            SELECT {TRACK_COLUMNS}
            FROM tracks
            WHERE id = ?
            """,
            (track_id,),
        ).fetchone()
    return dict(updated)


@app.post("/autodj/generate", response_model=AutoDjResponse)
def generate_autodj(request: AutoDjRequest) -> AutoDjResponse:
    return AutoDjResponse(tracks=generate_queue(request), settings=request)


@app.post("/autodj/export", response_model=ExportResponse)
def export_autodj(request: ExportRequest) -> ExportResponse:
    try:
        path, count = export_m3u(request.track_ids, request.playlist_path)
        return ExportResponse(playlist_path=str(path), track_count=count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
