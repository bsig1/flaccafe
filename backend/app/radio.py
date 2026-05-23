from __future__ import annotations

from typing import Any

from .database import connect, rows_to_dicts


def list_radio_stations() -> list[dict[str, Any]]:
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                """
                SELECT id, name, stream_url, homepage_url, genre, notes, last_played_at, created_at, updated_at
                FROM radio_stations
                ORDER BY coalesce(last_played_at, '') DESC, lower(name)
                """
            )
        )


def save_radio_station(request: object, station_id: int | None = None) -> dict[str, Any] | None:
    data = request.model_dump(mode="json") if hasattr(request, "model_dump") else dict(request)
    name = str(data.get("name") or "").strip()
    stream_url = str(data.get("stream_url") or "").strip()
    with connect() as conn:
        if station_id is None:
            cursor = conn.execute(
                """
                INSERT INTO radio_stations(name, stream_url, homepage_url, genre, notes)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(stream_url) DO UPDATE SET
                  name = excluded.name,
                  homepage_url = excluded.homepage_url,
                  genre = excluded.genre,
                  notes = excluded.notes,
                  updated_at = datetime('now')
                """,
                (name, stream_url, data.get("homepage_url"), data.get("genre"), data.get("notes")),
            )
            row_id = int(cursor.lastrowid or 0)
            if row_id == 0:
                existing = conn.execute("SELECT id FROM radio_stations WHERE stream_url = ?", (stream_url,)).fetchone()
                row_id = int(existing["id"]) if existing else 0
        else:
            cursor = conn.execute(
                """
                UPDATE radio_stations
                SET name = ?, stream_url = ?, homepage_url = ?, genre = ?, notes = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (name, stream_url, data.get("homepage_url"), data.get("genre"), data.get("notes"), station_id),
            )
            if cursor.rowcount == 0:
                return None
            row_id = station_id
        conn.commit()
        row = conn.execute("SELECT * FROM radio_stations WHERE id = ?", (row_id,)).fetchone()
    return dict(row) if row else None


def delete_radio_station(station_id: int) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM radio_stations WHERE id = ?", (station_id,))
        conn.commit()
        return cursor.rowcount > 0


def mark_radio_station_played(station_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        cursor = conn.execute(
            """
            UPDATE radio_stations
            SET last_played_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?
            """,
            (station_id,),
        )
        if cursor.rowcount == 0:
            return None
        conn.commit()
        row = conn.execute("SELECT * FROM radio_stations WHERE id = ?", (station_id,)).fetchone()
    return dict(row) if row else None
