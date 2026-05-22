from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from typing import Any

AUTO_REVIEW_FIELDS = {
    "title",
    "artist",
    "album",
    "album_artist",
    "genre",
    "path",
    "year",
    "rating",
    "duration_seconds",
}
AUTO_REVIEW_MATCH_TYPES = {
    "contains",
    "equals",
    "starts_with",
    "ends_with",
    "regex",
    "is_empty",
    "is_not_empty",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def inbox_counts(conn: sqlite3.Connection) -> tuple[int, int]:
    row = conn.execute(
        """
        SELECT
            sum(CASE WHEN coalesce(track_inbox_state.status, 'new') = 'new' THEN 1 ELSE 0 END) AS total_new,
            sum(CASE WHEN track_inbox_state.status = 'reviewed' THEN 1 ELSE 0 END) AS total_reviewed
        FROM tracks
        LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
        """
    ).fetchone()
    return int(row["total_new"] or 0), int(row["total_reviewed"] or 0)


def clean_rule_payload(payload: Any) -> dict[str, Any]:
    field = str(getattr(payload, "field", "")).strip()
    match_type = str(getattr(payload, "match_type", "")).strip()
    if field not in AUTO_REVIEW_FIELDS:
        raise ValueError(f"Unsupported auto-review field: {field}")
    if match_type not in AUTO_REVIEW_MATCH_TYPES:
        raise ValueError(f"Unsupported auto-review match type: {match_type}")
    value = str(getattr(payload, "value", "") or "").strip()
    if match_type not in {"is_empty", "is_not_empty"} and not value:
        raise ValueError("Auto-review rules need a value unless they test for empty fields")
    return {
        "name": str(getattr(payload, "name", "")).strip(),
        "enabled": 1 if bool(getattr(payload, "enabled", True)) else 0,
        "field": field,
        "match_type": match_type,
        "value": value,
        "note": (str(getattr(payload, "note", "") or "").strip() or None),
    }


def rule_from_row(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    record = dict(row)
    record["enabled"] = bool(record.get("enabled"))
    return record


def list_auto_review_rules(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [
        rule_from_row(row)
        for row in conn.execute(
            """
            SELECT id, name, enabled, field, match_type, value, note, created_at, updated_at
            FROM inbox_auto_review_rules
            ORDER BY enabled DESC, lower(name), id
            """
        )
    ]


def create_auto_review_rule(conn: sqlite3.Connection, payload: Any) -> dict[str, Any]:
    cleaned = clean_rule_payload(payload)
    if not cleaned["name"]:
        raise ValueError("Name the auto-review rule")
    now = utc_now()
    cursor = conn.execute(
        """
        INSERT INTO inbox_auto_review_rules(name, enabled, field, match_type, value, note, created_at, updated_at)
        VALUES(:name, :enabled, :field, :match_type, :value, :note, :now, :now)
        """,
        {**cleaned, "now": now},
    )
    return get_auto_review_rule(conn, int(cursor.lastrowid))


def update_auto_review_rule(conn: sqlite3.Connection, rule_id: int, payload: Any) -> dict[str, Any]:
    cleaned = clean_rule_payload(payload)
    if not cleaned["name"]:
        raise ValueError("Name the auto-review rule")
    conn.execute(
        """
        UPDATE inbox_auto_review_rules
        SET name = :name,
            enabled = :enabled,
            field = :field,
            match_type = :match_type,
            value = :value,
            note = :note,
            updated_at = :now
        WHERE id = :id
        """,
        {**cleaned, "id": rule_id, "now": utc_now()},
    )
    return get_auto_review_rule(conn, rule_id)


def get_auto_review_rule(conn: sqlite3.Connection, rule_id: int) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT id, name, enabled, field, match_type, value, note, created_at, updated_at
        FROM inbox_auto_review_rules
        WHERE id = ?
        """,
        (rule_id,),
    ).fetchone()
    if row is None:
        raise KeyError("Auto-review rule not found")
    return rule_from_row(row)


def delete_auto_review_rule(conn: sqlite3.Connection, rule_id: int) -> bool:
    cursor = conn.execute("DELETE FROM inbox_auto_review_rules WHERE id = ?", (rule_id,))
    return bool(cursor.rowcount)


def track_candidate(row_or_metadata: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    record = dict(row_or_metadata)
    return {field: record.get(field) for field in AUTO_REVIEW_FIELDS}


def rule_value(candidate: dict[str, Any], field: str) -> str:
    value = candidate.get(field)
    return "" if value is None else str(value).strip()


def auto_review_rule_matches(rule: dict[str, Any], candidate: dict[str, Any]) -> bool:
    value = rule_value(candidate, str(rule["field"]))
    match_type = str(rule["match_type"])
    needle = str(rule.get("value") or "").strip()
    if match_type == "is_empty":
        return value == ""
    if match_type == "is_not_empty":
        return value != ""
    if not needle:
        return False
    value_folded = value.casefold()
    needle_folded = needle.casefold()
    if match_type == "contains":
        return needle_folded in value_folded
    if match_type == "equals":
        return value_folded == needle_folded
    if match_type == "starts_with":
        return value_folded.startswith(needle_folded)
    if match_type == "ends_with":
        return value_folded.endswith(needle_folded)
    if match_type == "regex":
        try:
            return re.search(needle, value, flags=re.IGNORECASE) is not None
        except re.error:
            return False
    return False


def first_matching_auto_review_rule(conn: sqlite3.Connection, metadata: dict[str, Any]) -> dict[str, Any] | None:
    candidate = track_candidate(metadata)
    for rule in list_auto_review_rules(conn):
        if rule["enabled"] and auto_review_rule_matches(rule, candidate):
            return rule
    return None


def save_track_note_if_empty(conn: sqlite3.Connection, track_id: int, note: str | None) -> None:
    text = (note or "").strip()
    if not text:
        return
    row = conn.execute("SELECT note FROM track_inbox_notes WHERE track_id = ?", (track_id,)).fetchone()
    if row is not None and str(row["note"]).strip():
        return
    conn.execute(
        """
        INSERT INTO track_inbox_notes(track_id, note, updated_at)
        VALUES(?, ?, ?)
        ON CONFLICT(track_id) DO UPDATE SET
          note = excluded.note,
          updated_at = excluded.updated_at
        """,
        (track_id, text, utc_now()),
    )


def save_inbox_note(conn: sqlite3.Connection, track_id: int, note: str | None) -> dict[str, Any] | None:
    track = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if track is None:
        raise KeyError("Track not found")
    text = (note or "").strip()
    if not text:
        conn.execute("DELETE FROM track_inbox_notes WHERE track_id = ?", (track_id,))
        return None
    now = utc_now()
    conn.execute(
        """
        INSERT INTO track_inbox_notes(track_id, note, updated_at)
        VALUES(?, ?, ?)
        ON CONFLICT(track_id) DO UPDATE SET
          note = excluded.note,
          updated_at = excluded.updated_at
        """,
        (track_id, text, now),
    )
    return {"track_id": track_id, "note": text, "updated_at": now}


def list_inbox_notes(conn: sqlite3.Connection, track_ids: list[int] | None = None) -> list[dict[str, Any]]:
    if track_ids is not None and not track_ids:
        return []
    params: list[Any] = []
    where = ""
    if track_ids is not None:
        placeholders = ",".join("?" for _ in track_ids)
        where = f"WHERE track_id IN ({placeholders})"
        params = list(track_ids)
    return [
        dict(row)
        for row in conn.execute(
            f"""
            SELECT track_id, note, updated_at
            FROM track_inbox_notes
            {where}
            ORDER BY datetime(updated_at) DESC, track_id DESC
            """,
            params,
        )
    ]


def mark_track_for_inbox(conn: sqlite3.Connection, track_id: int, metadata: dict[str, Any]) -> dict[str, Any] | None:
    now = utc_now()
    rule = first_matching_auto_review_rule(conn, metadata)
    if rule is None:
        conn.execute(
            """
            INSERT OR REPLACE INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
            VALUES(?, 'new', NULL, ?)
            """,
            (track_id, now),
        )
        return None

    conn.execute(
        """
        INSERT OR REPLACE INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
        VALUES(?, 'reviewed', ?, ?)
        """,
        (track_id, now, now),
    )
    save_track_note_if_empty(conn, track_id, rule.get("note"))
    return rule


def apply_auto_review_rules_to_new_tracks(conn: sqlite3.Connection, rule_id: int | None = None) -> int:
    rules = [get_auto_review_rule(conn, rule_id)] if rule_id is not None else list_auto_review_rules(conn)
    enabled_rules = [rule for rule in rules if rule["enabled"]]
    if not enabled_rules:
        return 0

    updated = 0
    rows = conn.execute(
        """
        SELECT tracks.id, tracks.path, tracks.title, tracks.artist, tracks.album, tracks.album_artist,
               tracks.genre, tracks.year, tracks.rating, tracks.duration_seconds
        FROM tracks
        LEFT JOIN track_inbox_state ON track_inbox_state.track_id = tracks.id
        WHERE coalesce(track_inbox_state.status, 'new') = 'new'
        """
    ).fetchall()
    now = utc_now()
    for row in rows:
        candidate = track_candidate(row)
        matched_rule = next((rule for rule in enabled_rules if auto_review_rule_matches(rule, candidate)), None)
        if matched_rule is None:
            continue
        track_id = int(row["id"])
        conn.execute(
            """
            INSERT INTO track_inbox_state(track_id, status, reviewed_at, updated_at)
            VALUES(?, 'reviewed', ?, ?)
            ON CONFLICT(track_id) DO UPDATE SET
              status = 'reviewed',
              reviewed_at = excluded.reviewed_at,
              updated_at = excluded.updated_at
            """,
            (track_id, now, now),
        )
        save_track_note_if_empty(conn, track_id, matched_rule.get("note"))
        updated += 1
    return updated
