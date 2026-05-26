from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable

from .config import database_path


SCHEMA = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")


class ClosingConnection(sqlite3.Connection):
    """Connection helper that closes itself when used as a context manager."""

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        try:
            return bool(super().__exit__(exc_type, exc_value, traceback))
        finally:
            self.close()


def _apply_schema(conn: sqlite3.Connection) -> None:
    """Keep Python expert scripts usable even when Rust has not opened the DB yet."""

    conn.executescript(SCHEMA)
    conn.commit()


def connect(path: Path | None = None) -> sqlite3.Connection:
    db_path = path or database_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, factory=ClosingConnection)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    _apply_schema(conn)
    return conn


def init_db(conn: sqlite3.Connection | None = None) -> None:
    own_connection = conn is None
    active = conn or connect()
    try:
        _apply_schema(active)
    finally:
        if own_connection:
            active.close()


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def get_setting(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return None if row is None else row["value"]


def set_setting(conn: sqlite3.Connection, key: str, value: str | None) -> None:
    conn.execute(
        """
        INSERT INTO settings(key, value)
        VALUES(?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key, value),
    )


def invalidate_library_query_cache(conn: sqlite3.Connection) -> None:
    try:
        conn.execute("DELETE FROM library_query_cache")
    except sqlite3.OperationalError:
        pass
