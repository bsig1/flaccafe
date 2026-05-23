from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import EXPORT_DIR
from .database import connect, rows_to_dicts


AUDIOBOOK_TRACK_COLUMNS = """
    tracks.id, tracks.path, tracks.title, tracks.artist, tracks.album, tracks.album_artist,
    tracks.track_number, tracks.disc_number, tracks.genre, tracks.year, tracks.duration_seconds,
    tracks.rating, tracks.play_count, tracks.last_played_at, tracks.date_added
"""


def utc_stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def audiobook_where_clause() -> str:
    return """
    (
      lower(coalesce(tracks.genre, '')) LIKE '%audiobook%'
      OR lower(coalesce(tracks.genre, '')) LIKE '%audio book%'
      OR lower(tracks.path) LIKE '%audiobook%'
      OR lower(tracks.path) LIKE '%audio book%'
      OR lower(tracks.path) LIKE '%\\books\\%'
      OR lower(tracks.path) LIKE '%/books/%'
    )
    """


def progress_percent(position: float | None, duration: float | None) -> float:
    if not position or not duration or duration <= 0:
        return 0.0
    return max(0.0, min(100.0, (float(position) / float(duration)) * 100))


def list_audiobooks(limit: int, offset: int) -> dict[str, Any]:
    with connect() as conn:
        total = conn.execute(f"SELECT COUNT(*) AS count FROM tracks WHERE {audiobook_where_clause()}").fetchone()["count"]
        rows = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {AUDIOBOOK_TRACK_COLUMNS},
                       audiobook_progress.position_seconds,
                       audiobook_progress.duration_seconds AS saved_duration_seconds,
                       audiobook_progress.updated_at AS progress_updated_at,
                       COUNT(DISTINCT audiobook_bookmarks.id) AS bookmark_count,
                       COUNT(DISTINCT audiobook_chapters.id) AS chapter_count
                FROM tracks
                LEFT JOIN audiobook_progress ON audiobook_progress.track_id = tracks.id
                LEFT JOIN audiobook_bookmarks ON audiobook_bookmarks.track_id = tracks.id
                LEFT JOIN audiobook_chapters ON audiobook_chapters.track_id = tracks.id
                WHERE {audiobook_where_clause()}
                GROUP BY tracks.id
                ORDER BY lower(coalesce(tracks.album_artist, tracks.artist, '')),
                         lower(coalesce(tracks.album, '')),
                         coalesce(tracks.disc_number, 0),
                         coalesce(tracks.track_number, 0),
                         lower(coalesce(tracks.title, ''))
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            )
        )
    tracks = []
    for row in rows:
        duration = row.get("saved_duration_seconds") or row.get("duration_seconds")
        tracks.append(
            {
                **row,
                "duration_seconds": duration,
                "position_seconds": row.get("position_seconds") or 0,
                "progress_percent": progress_percent(row.get("position_seconds"), duration),
                "bookmark_count": int(row.get("bookmark_count") or 0),
                "chapter_count": int(row.get("chapter_count") or 0),
            }
        )
    return {"total": int(total), "tracks": tracks}


def upsert_audiobook_progress(track_id: int, position_seconds: float, duration_seconds: float | None) -> dict[str, Any] | None:
    with connect() as conn:
        track = conn.execute("SELECT id, duration_seconds FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if track is None:
            return None
        duration = duration_seconds if duration_seconds is not None else track["duration_seconds"]
        conn.execute(
            """
            INSERT INTO audiobook_progress(track_id, position_seconds, duration_seconds, updated_at)
            VALUES(?, ?, ?, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET
              position_seconds = excluded.position_seconds,
              duration_seconds = excluded.duration_seconds,
              updated_at = datetime('now')
            """,
            (track_id, max(0.0, position_seconds), duration),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM audiobook_progress WHERE track_id = ?", (track_id,)).fetchone()
    return dict(row) if row else None


def list_bookmarks(track_id: int) -> list[dict[str, Any]]:
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                """
                SELECT id, track_id, position_seconds, label, note, created_at
                FROM audiobook_bookmarks
                WHERE track_id = ?
                ORDER BY position_seconds, id
                """,
                (track_id,),
            )
        )


def add_bookmark(track_id: int, position_seconds: float, label: str, note: str | None) -> dict[str, Any] | None:
    with connect() as conn:
        if conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone() is None:
            return None
        cursor = conn.execute(
            """
            INSERT INTO audiobook_bookmarks(track_id, position_seconds, label, note)
            VALUES(?, ?, ?, ?)
            """,
            (track_id, max(0.0, position_seconds), label.strip() or "Bookmark", note),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM audiobook_bookmarks WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row) if row else None


def delete_bookmark(bookmark_id: int) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM audiobook_bookmarks WHERE id = ?", (bookmark_id,))
        conn.commit()
        return cursor.rowcount > 0


def list_chapters(track_id: int) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                """
                SELECT id, track_id, chapter_index, title, start_seconds, end_seconds, created_at, updated_at
                FROM audiobook_chapters
                WHERE track_id = ?
                ORDER BY chapter_index
                """,
                (track_id,),
            )
        )
        if rows:
            return rows
        track = conn.execute("SELECT id, title, duration_seconds FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if track is None:
        return []
    return [
        {
            "id": None,
            "track_id": track_id,
            "chapter_index": 1,
            "title": track["title"] or "Chapter 1",
            "start_seconds": 0,
            "end_seconds": track["duration_seconds"],
            "created_at": None,
            "updated_at": None,
        }
    ]


def replace_chapters(track_id: int, chapters: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    with connect() as conn:
        if conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone() is None:
            return None
        conn.execute("DELETE FROM audiobook_chapters WHERE track_id = ?", (track_id,))
        for index, chapter in enumerate(chapters, start=1):
            conn.execute(
                """
                INSERT INTO audiobook_chapters(track_id, chapter_index, title, start_seconds, end_seconds)
                VALUES(?, ?, ?, ?, ?)
                """,
                (
                    track_id,
                    int(chapter.get("chapter_index") or index),
                    str(chapter.get("title") or f"Chapter {index}").strip(),
                    max(0.0, float(chapter.get("start_seconds") or 0)),
                    chapter.get("end_seconds"),
                ),
            )
        conn.commit()
    return list_chapters(track_id)


def audiobook_sync_export(track_ids: list[int] | None, limit: int) -> dict[str, Any]:
    params: list[Any] = []
    where = audiobook_where_clause()
    if track_ids:
        ids = list(dict.fromkeys(track_ids))
        where += f" AND tracks.id IN ({','.join('?' for _ in ids)})"
        params.extend(ids)
    params.append(limit)
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {AUDIOBOOK_TRACK_COLUMNS},
                       audiobook_progress.position_seconds,
                       audiobook_progress.updated_at AS progress_updated_at
                FROM tracks
                LEFT JOIN audiobook_progress ON audiobook_progress.track_id = tracks.id
                WHERE {where}
                ORDER BY lower(coalesce(tracks.album_artist, tracks.artist, '')),
                         lower(coalesce(tracks.album, '')),
                         coalesce(tracks.track_number, 0)
                LIMIT ?
                """,
                params,
            )
        )
        payload_tracks = []
        for row in rows:
            track_id = int(row["id"])
            payload_tracks.append(
                {
                    "track": row,
                    "bookmarks": list_bookmarks(track_id),
                    "chapters": list_chapters(track_id),
                }
            )
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    target = EXPORT_DIR / f"flac-cafe-audiobook-sync-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    payload = {
        "generated_at": utc_stamp(),
        "format": "flac-cafe-audiobook-sync-v1",
        "tracks": payload_tracks,
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"export_path": str(target), "track_count": len(payload_tracks), "generated_at": payload["generated_at"]}
