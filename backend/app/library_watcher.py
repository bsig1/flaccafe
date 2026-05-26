from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Lock, Thread
from typing import Any, Literal

from .database import connect, get_setting, invalidate_library_query_cache, set_setting
from .scanner import (
    ensure_album,
    AudioFileSnapshot,
    file_fingerprint,
    file_state,
    is_path_under_folder,
    iter_audio_files,
    native_file_snapshots,
    path_key,
    read_metadata_cached,
    upsert_track,
)


WATCHER_DEFAULT_INTERVAL_SECONDS = 45
WATCHER_MIN_INTERVAL_SECONDS = 10
WATCHER_MAX_INTERVAL_SECONDS = 3600
WATCHER_DEFAULT_LIMIT = 300

ChangeType = Literal["added", "modified", "removed", "moved"]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def clamp_interval(value: int | None) -> int:
    if value is None:
        return WATCHER_DEFAULT_INTERVAL_SECONDS
    return max(WATCHER_MIN_INTERVAL_SECONDS, min(WATCHER_MAX_INTERVAL_SECONDS, int(value)))


def folder_watch_counts(changes: list["FolderWatchChange"]) -> dict[str, int]:
    counts = {"added": 0, "modified": 0, "removed": 0, "moved": 0}
    for change in changes:
        counts[change.change_type] += 1
    return counts


def stable_change_id(
    change_type: ChangeType,
    track_id: int | None,
    old_path: str | None,
    new_path: str | None,
    file_modified_at: str | None,
) -> str:
    digest = hashlib.sha1()
    digest.update(change_type.encode("utf-8"))
    digest.update(str(track_id or "").encode("utf-8"))
    digest.update((old_path or "").encode("utf-8", errors="ignore"))
    digest.update((new_path or "").encode("utf-8", errors="ignore"))
    digest.update((file_modified_at or "").encode("utf-8", errors="ignore"))
    return digest.hexdigest()[:16]


def notification_signature(changes: list["FolderWatchChange"]) -> str | None:
    if not changes:
        return None
    digest = hashlib.sha1()
    for change_id in sorted(change.id for change in changes):
        digest.update(change_id.encode("utf-8"))
    return digest.hexdigest()[:16]


def notification_message(counts: dict[str, int]) -> str:
    labels = {
        "added": "added",
        "modified": "modified",
        "moved": "moved",
        "removed": "removed",
    }
    parts = [f"{count} {labels[key]}" for key, count in counts.items() if count]
    return ", ".join(parts) if parts else "No pending folder changes"


def maybe_add_notification(state: FolderWatchState, changes: list["FolderWatchChange"]) -> None:
    signature = notification_signature(changes)
    if signature is None:
        state.last_notification_signature = None
        return
    if signature == state.last_notification_signature:
        return
    counts = folder_watch_counts(changes)
    created_at = utc_now()
    pending_count = len(changes)
    state.notifications.append(
        FolderWatchNotification(
            id=f"watch-{signature}",
            created_at=created_at,
            title=f"{pending_count} pending folder change{'' if pending_count == 1 else 's'}",
            message=notification_message(counts),
            pending_count=pending_count,
            counts=counts,
        )
    )
    state.notifications = state.notifications[-50:]
    state.last_notification_signature = signature


@dataclass(frozen=True)
class FolderWatchChange:
    id: str
    change_type: ChangeType
    track_id: int | None = None
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    old_path: str | None = None
    new_path: str | None = None
    previous_modified_at: str | None = None
    file_modified_at: str | None = None
    file_size: int | None = None
    detected_at: str = field(default_factory=utc_now)
    summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "change_type": self.change_type,
            "track_id": self.track_id,
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "old_path": self.old_path,
            "new_path": self.new_path,
            "previous_modified_at": self.previous_modified_at,
            "file_modified_at": self.file_modified_at,
            "file_size": self.file_size,
            "detected_at": self.detected_at,
            "summary": self.summary,
        }


@dataclass
class FolderWatchNotification:
    id: str
    created_at: str
    title: str
    message: str
    pending_count: int
    counts: dict[str, int]
    acknowledged: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at,
            "title": self.title,
            "message": self.message,
            "pending_count": self.pending_count,
            "counts": dict(self.counts),
            "acknowledged": self.acknowledged,
        }


@dataclass
class FolderWatchState:
    enabled: bool = False
    folder_path: str | None = None
    status: str = "stopped"
    interval_seconds: int = WATCHER_DEFAULT_INTERVAL_SECONDS
    last_checked_at: str | None = None
    next_check_at: str | None = None
    pending: list[FolderWatchChange] = field(default_factory=list)
    total_pending: int = 0
    notifications: list[FolderWatchNotification] = field(default_factory=list)
    last_notification_signature: str | None = None
    error: str | None = None

    def snapshot(self, limit: int = WATCHER_DEFAULT_LIMIT) -> dict[str, Any]:
        changes = self.pending[: max(0, limit)]
        counts = folder_watch_counts(self.pending)
        return {
            "enabled": self.enabled,
            "folder_path": self.folder_path,
            "status": self.status,
            "interval_seconds": self.interval_seconds,
            "last_checked_at": self.last_checked_at,
            "next_check_at": self.next_check_at,
            "pending_count": self.total_pending,
            "counts": counts,
            "changes": [change.to_dict() for change in changes],
            "notifications": [notification.to_dict() for notification in self.notifications[-20:]],
            "error": self.error,
        }


_state = FolderWatchState()
_lock = Lock()
_stop_event = Event()
_thread: Thread | None = None


def track_text(row: dict[str, Any], field_name: str) -> str | None:
    value = row.get(field_name)
    text = "" if value is None else str(value).strip()
    return text or None


def change_summary(change_type: ChangeType, row: dict[str, Any] | None, path: Path | None = None) -> str:
    if change_type == "added":
        return f"New file: {path.name if path else 'audio file'}"
    if change_type == "modified":
        return "Metadata or file timestamp changed"
    if change_type == "removed":
        return "Tracked file is missing from disk"
    if change_type == "moved":
        return "Likely rename or move, matched by fast audio fingerprint"
    return track_text(row or {}, "title") or "Pending library change"


def file_states_for_folder(
    folder: Path,
    file_snapshots: list[AudioFileSnapshot] | None = None,
) -> dict[str, tuple[Path, str, int]]:
    states: dict[str, tuple[Path, str, int]] = {}
    if file_snapshots is None:
        candidates = [(audio_path, None, None) for audio_path in sorted(iter_audio_files(folder), key=lambda item: str(item).lower())]
    else:
        candidates = [
            (snapshot.path, snapshot.modified_at, snapshot.file_size)
            for snapshot in sorted(file_snapshots, key=lambda item: str(item.path).lower())
            if is_path_under_folder(str(snapshot.path), folder)
        ]
    for audio_path, snapshot_modified_at, snapshot_file_size in candidates:
        try:
            if snapshot_modified_at is not None and snapshot_file_size is not None:
                modified_at, file_size = snapshot_modified_at, snapshot_file_size
            else:
                modified_at, file_size = file_state(audio_path)
            states[path_key(audio_path)] = (audio_path, modified_at, file_size)
        except OSError:
            continue
    return states


def library_tracks_under_folder(conn, folder: Path) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, path, path_key, title, artist, album, file_modified_at, audio_fingerprint
        FROM tracks
        """
    ).fetchall()
    return [dict(row) for row in rows if is_path_under_folder(row["path"], folder)]


def new_change(
    change_type: ChangeType,
    *,
    row: dict[str, Any] | None = None,
    old_path: str | None = None,
    new_path: str | None = None,
    previous_modified_at: str | None = None,
    file_modified_at: str | None = None,
    file_size: int | None = None,
    detected_at: str,
) -> FolderWatchChange:
    track_id = int(row["id"]) if row and row.get("id") is not None else None
    path_for_summary = Path(new_path) if new_path else None
    return FolderWatchChange(
        id=stable_change_id(change_type, track_id, old_path, new_path, file_modified_at),
        change_type=change_type,
        track_id=track_id,
        title=track_text(row or {}, "title"),
        artist=track_text(row or {}, "artist"),
        album=track_text(row or {}, "album"),
        old_path=old_path,
        new_path=new_path,
        previous_modified_at=previous_modified_at,
        file_modified_at=file_modified_at,
        file_size=file_size,
        detected_at=detected_at,
        summary=change_summary(change_type, row, path_for_summary),
    )


def detect_folder_changes(
    folder_path: str,
    file_snapshots: list[AudioFileSnapshot] | None = None,
) -> list[FolderWatchChange]:
    folder = Path(folder_path).expanduser().resolve()
    if not folder.exists() or not folder.is_dir():
        raise ValueError(f"Folder does not exist: {folder}")

    detected_at = utc_now()
    file_states = file_states_for_folder(folder, file_snapshots=file_snapshots)

    with connect() as conn:
        tracked_rows = library_tracks_under_folder(conn, folder)

    rows_by_key = {row["path_key"]: row for row in tracked_rows}
    missing_rows: list[dict[str, Any]] = []
    snapshot_is_authoritative = file_snapshots is not None
    for row in tracked_rows:
        row_key = row["path_key"]
        if row_key not in file_states or (not snapshot_is_authoritative and not Path(row["path"]).exists()):
            missing_rows.append(row)

    added_keys = set(file_states) - set(rows_by_key)
    consumed_added_keys: set[str] = set()
    consumed_missing_track_ids: set[int] = set()
    changes: list[FolderWatchChange] = []

    missing_by_fingerprint: dict[str, list[dict[str, Any]]] = {}
    for row in missing_rows:
        fingerprint = track_text(row, "audio_fingerprint")
        if fingerprint:
            missing_by_fingerprint.setdefault(fingerprint, []).append(row)

    # New unknown files are fingerprinted only against missing tracks so a rename
    # preserves ratings, play counts, playlists, and analysis instead of becoming
    # a delete plus add.
    for key in sorted(added_keys):
        audio_path, modified_at, file_size = file_states[key]
        try:
            fingerprint = file_fingerprint(audio_path)
        except OSError:
            continue
        candidates = missing_by_fingerprint.get(fingerprint) or []
        while candidates:
            row = candidates.pop(0)
            track_id = int(row["id"])
            if track_id in consumed_missing_track_ids:
                continue
            consumed_added_keys.add(key)
            consumed_missing_track_ids.add(track_id)
            changes.append(
                new_change(
                    "moved",
                    row=row,
                    old_path=row["path"],
                    new_path=str(audio_path),
                    previous_modified_at=row.get("file_modified_at"),
                    file_modified_at=modified_at,
                    file_size=file_size,
                    detected_at=detected_at,
                )
            )
            break

    for row in missing_rows:
        if int(row["id"]) in consumed_missing_track_ids:
            continue
        changes.append(
            new_change(
                "removed",
                row=row,
                old_path=row["path"],
                previous_modified_at=row.get("file_modified_at"),
                detected_at=detected_at,
            )
        )

    for key, row in rows_by_key.items():
        if key not in file_states:
            continue
        audio_path, modified_at, file_size = file_states[key]
        previous_modified_at = row.get("file_modified_at")
        if previous_modified_at == modified_at:
            continue
        changes.append(
            new_change(
                "modified",
                row=row,
                old_path=row["path"],
                new_path=str(audio_path),
                previous_modified_at=previous_modified_at,
                file_modified_at=modified_at,
                file_size=file_size,
                detected_at=detected_at,
            )
        )

    for key in sorted(added_keys - consumed_added_keys):
        audio_path, modified_at, file_size = file_states[key]
        changes.append(
            new_change(
                "added",
                new_path=str(audio_path),
                file_modified_at=modified_at,
                file_size=file_size,
                detected_at=detected_at,
            )
        )

    priority = {"moved": 0, "removed": 1, "modified": 2, "added": 3}
    return sorted(changes, key=lambda change: (priority[change.change_type], change.old_path or change.new_path or ""))


def delete_orphan_albums(conn) -> None:
    conn.execute(
        """
        DELETE FROM albums
        WHERE id NOT IN (
            SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL
        )
        """
    )


def apply_moved_track(conn, change: FolderWatchChange) -> int:
    if change.track_id is None or not change.new_path:
        raise ValueError("Move change is missing a track id or target path")
    new_path = Path(change.new_path).expanduser()
    if not new_path.exists() or not new_path.is_file():
        raise ValueError("Moved file is missing from disk")

    metadata = read_metadata_cached(conn, new_path)
    existing = conn.execute("SELECT id, rating FROM tracks WHERE id = ?", (change.track_id,)).fetchone()
    if existing is None:
        raise ValueError("Moved track is no longer in the library")

    conflict = conn.execute(
        "SELECT id FROM tracks WHERE path_key = ? AND id <> ?",
        (metadata["path_key"], change.track_id),
    ).fetchone()
    if conflict is not None:
        raise ValueError(f"Target path is already tracked by #{conflict['id']}")

    album_id = ensure_album(conn, metadata)
    rating = existing["rating"] if existing["rating"] is not None else metadata.get("rating")
    values = {
        **metadata,
        "album_id": album_id,
        "rating": rating,
        "track_id": change.track_id,
        "now": utc_now(),
    }
    conn.execute(
        """
        UPDATE tracks
        SET path = :path,
            path_key = :path_key,
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
            bitrate = :bitrate,
            replaygain_track_gain_db = :replaygain_track_gain_db,
            replaygain_album_gain_db = :replaygain_album_gain_db,
            replaygain_track_peak = :replaygain_track_peak,
            replaygain_album_peak = :replaygain_album_peak,
            audio_fingerprint = :audio_fingerprint,
            rating = :rating,
            file_modified_at = :file_modified_at,
            updated_at = :now
        WHERE id = :track_id
        """,
        values,
    )
    return change.track_id


def apply_single_change(conn, change: FolderWatchChange) -> str:
    if change.change_type == "removed":
        if change.track_id is None:
            raise ValueError("Remove change is missing a track id")
        row = conn.execute("SELECT path FROM tracks WHERE id = ?", (change.track_id,)).fetchone()
        if row is None:
            return "skipped"
        if Path(row["path"]).exists():
            raise ValueError("File exists again; refresh pending changes")
        conn.execute("DELETE FROM tracks WHERE id = ?", (change.track_id,))
        return "removed"

    if change.change_type == "moved":
        apply_moved_track(conn, change)
        return "moved"

    target_path = change.new_path or change.old_path
    if not target_path:
        raise ValueError("Change is missing a file path")
    audio_path = Path(target_path).expanduser()
    if not audio_path.exists() or not audio_path.is_file():
        raise ValueError("Audio file is missing from disk")
    result = upsert_track(conn, read_metadata_cached(conn, audio_path))
    return "inserted" if result == "inserted" else "updated"


def get_folder_watch_status(limit: int = WATCHER_DEFAULT_LIMIT) -> dict[str, Any]:
    with _lock:
        return _state.snapshot(limit)


def acknowledge_folder_watch_notifications(
    notification_ids: list[str] | None = None,
    all_notifications: bool = False,
    limit: int = WATCHER_DEFAULT_LIMIT,
) -> dict[str, Any]:
    wanted = set(notification_ids or [])
    with _lock:
        for notification in _state.notifications:
            if all_notifications or notification.id in wanted:
                notification.acknowledged = True
        return _state.snapshot(limit)


def refresh_folder_watch_now(
    folder_path: str | None = None,
    limit: int = WATCHER_DEFAULT_LIMIT,
    native_files: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    with _lock:
        folder = folder_path or _state.folder_path
        interval_seconds = _state.interval_seconds
        _state.status = "scanning"
        _state.error = None

    if not folder:
        with connect() as conn:
            folder = get_setting(conn, "library_path")
    if not folder:
        with _lock:
            _state.enabled = False
            _state.status = "stopped"
            _state.folder_path = None
            _state.pending = []
            _state.total_pending = 0
            _state.last_checked_at = utc_now()
            _state.next_check_at = None
            return _state.snapshot(limit)

    try:
        changes = detect_folder_changes(folder, file_snapshots=native_file_snapshots(native_files))
        checked_at = utc_now()
        next_check = datetime.fromtimestamp(time.time() + interval_seconds, timezone.utc).replace(microsecond=0).isoformat()
        with _lock:
            _state.folder_path = str(Path(folder).expanduser().resolve())
            _state.pending = changes
            _state.total_pending = len(changes)
            maybe_add_notification(_state, changes)
            _state.status = "idle" if _state.enabled else "stopped"
            _state.last_checked_at = checked_at
            _state.next_check_at = next_check if _state.enabled else None
            _state.error = None
            return _state.snapshot(limit)
    except Exception as exc:
        with _lock:
            _state.status = "error"
            _state.error = str(exc)
            _state.last_checked_at = utc_now()
            _state.next_check_at = None
            return _state.snapshot(limit)


def apply_folder_watch_changes(
    change_ids: list[str] | None = None,
    apply_all: bool = False,
    limit: int = WATCHER_DEFAULT_LIMIT,
) -> dict[str, Any]:
    with _lock:
        folder = _state.folder_path
        pending = list(_state.pending)

    if not folder:
        raise ValueError("No watched library folder is configured")

    wanted_ids = set(change_ids or [])
    selected = pending if apply_all else [change for change in pending if change.id in wanted_ids]
    if not selected:
        return {
            "applied": 0,
            "inserted": 0,
            "updated": 0,
            "removed": 0,
            "moved": 0,
            "skipped": 0,
            "errors": [],
            "status": get_folder_watch_status(limit),
        }

    counts = {"inserted": 0, "updated": 0, "removed": 0, "moved": 0, "skipped": 0}
    errors: list[str] = []
    with connect() as conn:
        for change in selected:
            try:
                outcome = apply_single_change(conn, change)
                counts[outcome] += 1
            except Exception as exc:
                errors.append(f"{change.summary}: {exc}")
        if counts["inserted"] or counts["updated"] or counts["removed"] or counts["moved"]:
            invalidate_library_query_cache(conn)
        delete_orphan_albums(conn)
        set_setting(conn, "library_path", folder)
        conn.commit()

    status = refresh_folder_watch_now(folder, limit)
    applied = counts["inserted"] + counts["updated"] + counts["removed"] + counts["moved"]
    return {
        "applied": applied,
        "inserted": counts["inserted"],
        "updated": counts["updated"],
        "removed": counts["removed"],
        "moved": counts["moved"],
        "skipped": counts["skipped"],
        "errors": errors,
        "status": status,
    }


def _watch_loop() -> None:
    while not _stop_event.is_set():
        with _lock:
            folder = _state.folder_path
            interval_seconds = _state.interval_seconds
        if folder:
            refresh_folder_watch_now(folder)
        if _stop_event.wait(interval_seconds):
            break


def start_folder_watcher(
    folder_path: str,
    interval_seconds: int | None = None,
    limit: int = WATCHER_DEFAULT_LIMIT,
    native_files: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    global _thread
    folder = str(Path(folder_path).expanduser().resolve())
    interval = clamp_interval(interval_seconds)

    stop_folder_watcher(update_setting=False)
    _stop_event.clear()
    with _lock:
        _state.enabled = True
        _state.folder_path = folder
        _state.interval_seconds = interval
        _state.status = "idle"
        _state.error = None
        _state.next_check_at = datetime.fromtimestamp(time.time() + interval, timezone.utc).replace(microsecond=0).isoformat()

    _thread = Thread(target=_watch_loop, name="flac-cafe-folder-watch", daemon=True)
    _thread.start()
    refresh_folder_watch_now(folder, limit, native_files=native_files)
    return get_folder_watch_status(limit)


def stop_folder_watcher(update_setting: bool = True, limit: int = WATCHER_DEFAULT_LIMIT) -> dict[str, Any]:
    global _thread
    _stop_event.set()
    thread = _thread
    if thread and thread.is_alive():
        thread.join(timeout=1.0)
    _thread = None
    with _lock:
        _state.enabled = False
        _state.status = "stopped"
        _state.next_check_at = None
    if update_setting:
        with connect() as conn:
            set_setting(conn, "folder_watch_enabled", "0")
            conn.commit()
    return get_folder_watch_status(limit)


def start_folder_watcher_from_settings() -> dict[str, Any]:
    with connect() as conn:
        folder = get_setting(conn, "library_path")
        enabled = get_setting(conn, "folder_watch_enabled")
        interval_text = get_setting(conn, "folder_watch_interval_seconds")
    if enabled == "0" or not folder:
        return get_folder_watch_status()
    try:
        interval = int(interval_text) if interval_text else WATCHER_DEFAULT_INTERVAL_SECONDS
    except ValueError:
        interval = WATCHER_DEFAULT_INTERVAL_SECONDS
    return start_folder_watcher(folder, interval)
