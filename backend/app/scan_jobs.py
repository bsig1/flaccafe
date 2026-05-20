from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, Thread
from uuid import uuid4

from .scanner import ScanStats, scan_folder


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


@dataclass
class ScanJob:
    job_id: str
    folder_path: str
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
            _copy_stats(job, stats, processed, total, current_path)

    with _lock:
        job = _jobs[job_id]
        job.status = "counting"

    try:
        result = scan_folder(job.folder_path, progress_callback=update_from_scan)
        with _lock:
            job = _jobs[job_id]
            job.status = "completed"
            job.finished_at = utc_now()
            _copy_stats(job, result, result.scanned_files, result.scanned_files, None)
    except Exception as exc:
        with _lock:
            job = _jobs[job_id]
            job.status = "failed"
            job.finished_at = utc_now()
            job.error = str(exc)
            job.current_path = None


def start_scan_job(folder_path: str) -> dict:
    job_id = uuid4().hex
    with _lock:
        _jobs[job_id] = ScanJob(job_id=job_id, folder_path=folder_path)

    thread = Thread(target=_run_scan, args=(job_id,), daemon=True)
    thread.start()
    return get_scan_job(job_id)


def get_scan_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else job.snapshot()
