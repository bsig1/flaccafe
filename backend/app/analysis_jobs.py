from __future__ import annotations

import time
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock, Thread
from uuid import uuid4

from .audiobooks import audiobook_where_clause
from .clap_analysis import ClapAnalyzer, load_config, model_cached, save_track_analysis
from .database import connect, invalidate_library_query_cache, rows_to_dicts
from .content_filters import podcast_where_clause


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


@dataclass
class AudioAnalysisJob:
    job_id: str
    status: str = "pending"
    phase: str | None = "queued"
    message: str | None = "Waiting to start"
    total_tracks: int = 0
    processed_tracks: int = 0
    analyzed: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    failed_tracks: list[dict] = field(default_factory=list)
    current_track: str | None = None
    model_cached_at_start: bool | None = None
    started_at: datetime = field(default_factory=utc_now)
    finished_at: datetime | None = None
    error: str | None = None
    pause_requested: bool = False
    cancel_requested: bool = False

    def snapshot(self) -> dict:
        now = self.finished_at or utc_now()
        elapsed_seconds = max(0.0, (now - self.started_at).total_seconds())
        percent = 0.0
        eta_seconds = None
        if self.total_tracks > 0:
            percent = min(100.0, (self.processed_tracks / self.total_tracks) * 100)
            if self.status == "running" and self.processed_tracks > 0:
                seconds_per_track = elapsed_seconds / self.processed_tracks
                eta_seconds = max(0.0, (self.total_tracks - self.processed_tracks) * seconds_per_track)
            elif self.status == "completed":
                eta_seconds = 0.0

        return {
            "job_id": self.job_id,
            "status": self.status,
            "phase": self.phase,
            "message": self.message,
            "total_tracks": self.total_tracks,
            "processed_tracks": self.processed_tracks,
            "analyzed": self.analyzed,
            "skipped": self.skipped,
            "errors": self.errors[-25:],
            "failed_tracks": self.failed_tracks[-50:],
            "current_track": self.current_track,
            "model_cached_at_start": self.model_cached_at_start,
            "started_at": iso(self.started_at),
            "finished_at": iso(self.finished_at),
            "elapsed_seconds": elapsed_seconds,
            "eta_seconds": eta_seconds,
            "percent": percent,
            "error": self.error,
        }


_jobs: dict[str, AudioAnalysisJob] = {}
_lock = Lock()


def _candidate_tracks(
    limit: int | None,
    overwrite: bool,
    only_missing: bool,
    track_ids: list[int] | None,
) -> list[dict]:
    clauses = [
        "path IS NOT NULL",
        "trim(path) <> ''",
        f"NOT {audiobook_where_clause()}",
        f"NOT {podcast_where_clause()}",
    ]
    params: list[object] = []
    if track_ids is not None:
        unique_ids = list(dict.fromkeys(int(track_id) for track_id in track_ids))
        if not unique_ids:
            return []
        clauses.append(f"id IN ({','.join('?' for _ in unique_ids)})")
        params.extend(unique_ids)
    if only_missing:
        clauses.append(
            """
            (analysis_genre IS NULL OR trim(analysis_genre) = ''
             OR analysis_embedding IS NULL OR trim(analysis_embedding) = '')
            """
        )
    if not overwrite:
        clauses.append("(analysis_updated_at IS NULL OR analysis_provider IS NULL OR analysis_provider <> 'clap')")
    where = " AND ".join(clauses)
    query = f"""
        SELECT id, path, title, artist, album
        FROM tracks
        WHERE {where}
        ORDER BY datetime(date_added) DESC, id ASC
    """
    if limit is not None:
        query += " LIMIT ?"
        params.append(limit)
    with connect() as conn:
        return rows_to_dicts(conn.execute(query, params))


def _terminal(status: str) -> bool:
    return status in {"completed", "failed", "canceled"}


def _cancel_requested(job_id: str) -> bool:
    with _lock:
        return _jobs[job_id].cancel_requested


def _wait_if_paused(job_id: str) -> bool:
    while True:
        with _lock:
            job = _jobs[job_id]
            if job.cancel_requested:
                return False
            paused = job.pause_requested
            if paused:
                job.status = "paused"
                job.phase = "paused"
                job.message = "Paused. Resume to continue analysis."
            else:
                if job.status == "paused":
                    job.status = "running"
                    job.phase = "analyzing"
                    job.message = "Resuming audio analysis."
                return True
        time.sleep(0.25)


def _run_job(
    job_id: str,
    limit: int | None,
    overwrite: bool,
    only_missing: bool,
    track_ids: list[int] | None,
) -> None:
    try:
        candidates = _candidate_tracks(limit, overwrite, only_missing, track_ids)
        config = load_config()
        cached = model_cached(config)
        with _lock:
            job = _jobs[job_id]
            job.status = "running"
            job.phase = "preparing"
            job.total_tracks = len(candidates)
            job.model_cached_at_start = cached
            job.message = (
                "Loading cached CLAP model."
                if cached
                else "Downloading and loading CLAP model. First run can take a while."
            )

        if not candidates:
            with _lock:
                job = _jobs[job_id]
                job.status = "completed"
                job.phase = "completed"
                job.message = "No tracks needed analysis."
                job.finished_at = utc_now()
                job.current_track = None
            return

        if _cancel_requested(job_id):
            with _lock:
                job = _jobs[job_id]
                job.status = "canceled"
                job.phase = "canceled"
                job.message = "Analysis canceled before model load."
                job.finished_at = utc_now()
            return

        analyzer = ClapAnalyzer()
        if _cancel_requested(job_id):
            with _lock:
                job = _jobs[job_id]
                job.status = "canceled"
                job.phase = "canceled"
                job.message = "Analysis canceled."
                job.finished_at = utc_now()
            return

        for index, track in enumerate(candidates, start=1):
            if not _wait_if_paused(job_id):
                with _lock:
                    job = _jobs[job_id]
                    job.status = "canceled"
                    job.phase = "canceled"
                    job.message = "Analysis canceled."
                    job.finished_at = utc_now()
                    job.current_track = None
                return

            with _lock:
                job = _jobs[job_id]
                job.status = "running"
                job.phase = "analyzing"
                job.current_track = f"{track.get('title') or track.get('path')}"
                job.processed_tracks = index - 1
                job.message = f"Analyzing {index} of {len(candidates)}"
            try:
                analysis = analyzer.analyze_path(track["path"])
                save_track_analysis(int(track["id"]), analysis)
                with _lock:
                    _jobs[job_id].analyzed += 1
            except Exception as exc:
                message = str(exc)
                with connect() as conn:
                    conn.execute(
                        """
                        UPDATE tracks
                        SET analysis_provider = 'clap_failed',
                            analysis_model = NULL,
                            analysis_genre = NULL,
                            analysis_genre_confidence = NULL,
                            analysis_genre_tags = ?,
                            analysis_embedding = NULL,
                            analysis_updated_at = datetime('now'),
                            updated_at = datetime('now')
                        WHERE id = ?
                        """,
                        (json.dumps({"error": message}, ensure_ascii=True), int(track["id"])),
                    )
                    invalidate_library_query_cache(conn)
                    conn.commit()
                with _lock:
                    job = _jobs[job_id]
                    job.skipped += 1
                    job.errors.append(f"{track.get('path')}: {message}")
                    job.failed_tracks.append(
                        {
                            "track_id": track.get("id"),
                            "path": track.get("path"),
                            "title": track.get("title"),
                            "message": message,
                        }
                    )
            finally:
                with _lock:
                    _jobs[job_id].processed_tracks = index

        with _lock:
            job = _jobs[job_id]
            job.status = "completed"
            job.phase = "completed"
            job.message = f"Analyzed {job.analyzed} tracks."
            job.finished_at = utc_now()
            job.current_track = None
    except Exception as exc:
        with _lock:
            job = _jobs[job_id]
            job.status = "failed"
            job.phase = "failed"
            job.finished_at = utc_now()
            job.error = str(exc)
            job.message = str(exc)
            job.current_track = None


def start_audio_analysis_job(
    limit: int | None = None,
    overwrite: bool = False,
    only_missing: bool = True,
    track_ids: list[int] | None = None,
) -> dict:
    job_id = uuid4().hex
    with _lock:
        _jobs[job_id] = AudioAnalysisJob(job_id=job_id)
    thread = Thread(target=_run_job, args=(job_id, limit, overwrite, only_missing, track_ids), daemon=True)
    thread.start()
    return get_audio_analysis_job(job_id)


def get_audio_analysis_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else job.snapshot()


def pause_audio_analysis_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        if not _terminal(job.status):
            job.pause_requested = True
            job.message = "Pause requested. Current track will finish first."
        return job.snapshot()


def resume_audio_analysis_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        if not _terminal(job.status):
            job.pause_requested = False
            job.status = "running"
            job.phase = "analyzing"
            job.message = "Resuming audio analysis."
        return job.snapshot()


def cancel_audio_analysis_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        if not _terminal(job.status):
            job.cancel_requested = True
            job.status = "canceling"
            job.phase = "canceling"
            job.message = "Cancel requested. Current operation will stop at the next safe point."
        return job.snapshot()
