from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
from pathlib import Path
from threading import Lock, Thread
from typing import Any
from uuid import uuid4

from .database import connect, set_setting
from .scanner import ScanStats, native_file_snapshots, scan_folder


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


@dataclass
class ScanJob:
    job_id: str
    folder_path: str
    folder_paths: list[str] = field(default_factory=list)
    save_library_paths: list[str] = field(default_factory=list)
    native_files: list[dict[str, Any]] | None = None
    native_scan_errors: list[str] = field(default_factory=list)
    status: str = "pending"
    total_files: int = 0
    processed_files: int = 0
    inserted: int = 0
    updated: int = 0
    removed: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    current_path: str | None = None
    started_at: datetime = field(default_factory=utc_now)
    finished_at: datetime | None = None
    error: str | None = None

    def snapshot(self) -> dict:
        now = self.finished_at or utc_now()
        elapsed_seconds = max(0.0, (now - self.started_at).total_seconds())
        percent = 0.0
        eta_seconds = None

        if self.total_files > 0:
            percent = min(100.0, (self.processed_files / self.total_files) * 100)
            if self.status == "scanning" and self.processed_files > 0:
                seconds_per_file = elapsed_seconds / self.processed_files
                eta_seconds = max(0.0, (self.total_files - self.processed_files) * seconds_per_file)
            elif self.status == "completed":
                eta_seconds = 0.0

        return {
            "job_id": self.job_id,
            "folder_path": self.folder_path,
            "folder_paths": self.folder_paths,
            "status": self.status,
            "total_files": self.total_files,
            "processed_files": self.processed_files,
            "inserted": self.inserted,
            "updated": self.updated,
            "removed": self.removed,
            "skipped": self.skipped,
            "errors": self.errors[-25:],
            "current_path": self.current_path,
            "started_at": iso(self.started_at),
            "finished_at": iso(self.finished_at),
            "elapsed_seconds": elapsed_seconds,
            "eta_seconds": eta_seconds,
            "percent": percent,
            "error": self.error,
        }


_jobs: dict[str, ScanJob] = {}
_lock = Lock()


def _copy_stats(job: ScanJob, stats: ScanStats, processed: int, total: int, current_path: Path | None) -> None:
    job.folder_path = stats.folder_path
    job.total_files = total
    job.processed_files = processed
    job.inserted = stats.inserted
    job.updated = stats.updated
    job.removed = stats.removed
    job.skipped = stats.skipped
    job.errors = stats.errors[:]
    job.current_path = None if current_path is None else str(current_path)


def _run_scan(job_id: str) -> None:
    completed = ScanStats(folder_path="")
    completed_total = 0

    def update_from_scan(
        stats: ScanStats,
        processed: int,
        total: int,
        current_path: Path | None,
        status: str,
    ) -> None:
        with _lock:
            job = _jobs[job_id]
            job.status = status
            aggregate = ScanStats(folder_path=job.folder_path)
            aggregate.scanned_files = completed.scanned_files + stats.scanned_files
            aggregate.inserted = completed.inserted + stats.inserted
            aggregate.updated = completed.updated + stats.updated
            aggregate.removed = completed.removed + stats.removed
            aggregate.skipped = completed.skipped + stats.skipped
            aggregate.errors = [*completed.errors, *stats.errors]
            _copy_stats(job, aggregate, completed_total + processed, completed_total + total, current_path)

    with _lock:
        job = _jobs[job_id]
        job.status = "counting"
        paths = job.folder_paths[:]
        native_files = None if job.native_files is None else list(job.native_files)
        native_scan_errors = list(job.native_scan_errors)
        completed.errors.extend(native_scan_errors)
        job.errors = native_scan_errors[-25:]

    try:
        file_snapshots = native_file_snapshots(native_files)
        for folder_path in paths:
            result = (
                scan_folder(folder_path, progress_callback=update_from_scan, file_snapshots=file_snapshots)
                if file_snapshots is not None
                else scan_folder(folder_path, progress_callback=update_from_scan)
            )
            completed.scanned_files += result.scanned_files
            completed.inserted += result.inserted
            completed.updated += result.updated
            completed.removed += result.removed
            completed.skipped += result.skipped
            completed.errors.extend(result.errors)
            completed_total += result.scanned_files
        with connect() as conn:
            saved_paths = job.save_library_paths or paths
            set_setting(conn, "library_path", saved_paths[0] if saved_paths else None)
            set_setting(conn, "library_paths_json", json.dumps(saved_paths, ensure_ascii=True))
            conn.commit()
        with _lock:
            job = _jobs[job_id]
            job.status = "completed"
            job.finished_at = utc_now()
            completed.folder_path = job.folder_path
            _copy_stats(job, completed, completed.scanned_files, completed.scanned_files, None)
    except Exception as exc:
        with _lock:
            job = _jobs[job_id]
            job.status = "failed"
            job.finished_at = utc_now()
            job.error = str(exc)
            job.current_path = None


def start_scan_job(
    folder_paths: str | list[str],
    save_library_paths: list[str] | None = None,
    native_files: list[dict[str, Any]] | None = None,
    native_scan_errors: list[str] | None = None,
) -> dict:
    paths = [folder_paths] if isinstance(folder_paths, str) else folder_paths
    paths = [str(Path(path).expanduser().resolve()) for path in paths if str(path).strip()]
    if not paths:
        raise ValueError("Choose at least one music folder")
    saved_paths = [
        str(Path(path).expanduser().resolve())
        for path in (save_library_paths or paths)
        if str(path).strip()
    ]
    job_id = uuid4().hex
    with _lock:
        _jobs[job_id] = ScanJob(
            job_id=job_id,
            folder_path="; ".join(paths),
            folder_paths=paths,
            save_library_paths=saved_paths,
            native_files=native_files,
            native_scan_errors=list(native_scan_errors or []),
        )

    thread = Thread(target=_run_scan, args=(job_id,), daemon=True)
    thread.start()
    return get_scan_job(job_id)


def get_scan_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else job.snapshot()
