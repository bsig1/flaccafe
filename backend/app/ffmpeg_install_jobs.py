from __future__ import annotations

import os
import shutil
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, Thread
from urllib import error as urlerror
from urllib import request as urlrequest
from uuid import uuid4

from .audio_conversion_jobs import ffmpeg_status, ffmpeg_tool_dir
from .database import connect, set_setting


FFMPEG_WINDOWS_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
CHUNK_SIZE = 1024 * 1024


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


@dataclass
class FfmpegInstallJob:
    job_id: str
    source_url: str
    status: str = "pending"
    message: str = "Waiting to install FFmpeg."
    current_step: int = 0
    total_steps: int = 3
    bytes_downloaded: int = 0
    total_bytes: int | None = None
    tool_directory: str = field(default_factory=lambda: str(ffmpeg_tool_dir()))
    log: list[str] = field(default_factory=list)
    started_at: datetime = field(default_factory=utc_now)
    finished_at: datetime | None = None
    error: str | None = None

    def snapshot(self) -> dict:
        now = self.finished_at or utc_now()
        elapsed_seconds = max(0.0, (now - self.started_at).total_seconds())
        return {
            "job_id": self.job_id,
            "status": self.status,
            "message": self.message,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "bytes_downloaded": self.bytes_downloaded,
            "total_bytes": self.total_bytes,
            "download_url": self.source_url,
            "tool_directory": self.tool_directory,
            "log": self.log[-80:],
            "started_at": iso(self.started_at),
            "finished_at": iso(self.finished_at),
            "elapsed_seconds": elapsed_seconds,
            "percent": self._percent(),
            "error": self.error,
        }

    def _percent(self) -> float:
        if self.status == "completed":
            return 100.0
        if self.current_step <= 0:
            return 1.0
        if self.current_step == 1:
            if self.total_bytes and self.total_bytes > 0:
                return min(82.0, 5.0 + (self.bytes_downloaded / self.total_bytes) * 77.0)
            return min(75.0, 5.0 + (self.bytes_downloaded / CHUNK_SIZE) * 2.0)
        if self.current_step == 2:
            return 88.0
        if self.current_step == 3:
            return 96.0
        return min(99.0, (self.current_step / max(1, self.total_steps)) * 100.0)


_jobs: dict[str, FfmpegInstallJob] = {}
_lock = Lock()


def _update(job_id: str, **changes: object) -> None:
    with _lock:
        job = _jobs[job_id]
        for key, value in changes.items():
            setattr(job, key, value)


def _log(job_id: str, line: str) -> None:
    clean = line.strip()
    if not clean:
        return
    with _lock:
        job = _jobs[job_id]
        job.log.append(clean)
        job.log = job.log[-200:]


def _content_length(response: object) -> int | None:
    try:
        raw = response.headers.get("Content-Length")  # type: ignore[attr-defined]
    except AttributeError:
        raw = None
    try:
        return int(raw) if raw else None
    except ValueError:
        return None


def _download_archive(job_id: str, source_url: str, archive_path: Path) -> None:
    _update(job_id, current_step=1, message="Downloading FFmpeg essentials...")
    api_request = urlrequest.Request(source_url, headers={"User-Agent": "FLAC-Cafe"})
    with urlrequest.urlopen(api_request, timeout=180) as response:
        _update(job_id, total_bytes=_content_length(response))
        with archive_path.open("wb") as target:
            while True:
                chunk = response.read(CHUNK_SIZE)
                if not chunk:
                    break
                target.write(chunk)
                with _lock:
                    job = _jobs[job_id]
                    job.bytes_downloaded += len(chunk)
                    downloaded_mb = job.bytes_downloaded / 1_048_576
                    if job.total_bytes:
                        total_mb = job.total_bytes / 1_048_576
                        job.message = f"Downloading FFmpeg essentials ({downloaded_mb:.1f} / {total_mb:.1f} MB)..."
                    else:
                        job.message = f"Downloading FFmpeg essentials ({downloaded_mb:.1f} MB)..."


def _extract_tools(job_id: str, archive_path: Path, tool_dir: Path) -> None:
    _update(job_id, current_step=2, message="Extracting FFmpeg tools...")
    with zipfile.ZipFile(archive_path) as archive:
        members_by_name = {Path(name).name.lower(): name for name in archive.namelist()}
        if "ffmpeg.exe" not in members_by_name:
            raise OSError("Downloaded archive did not contain ffmpeg.exe")
        for executable in ["ffmpeg.exe", "ffprobe.exe", "ffplay.exe"]:
            member = members_by_name.get(executable)
            if member:
                _log(job_id, f"Extracting {executable}")
                with archive.open(member) as source, (tool_dir / executable).open("wb") as target:
                    shutil.copyfileobj(source, target)


def _configure_ffmpeg(job_id: str, tool_dir: Path) -> None:
    _update(job_id, current_step=3, message="Saving FFmpeg path...")
    ffmpeg_path = tool_dir / "ffmpeg.exe"
    with connect() as conn:
        set_setting(conn, "ffmpeg_path", str(ffmpeg_path.resolve()))
        conn.commit()
        status = ffmpeg_status(conn)
    if not status["available"]:
        raise RuntimeError("FFmpeg was extracted, but FLAC Cafe could not validate ffmpeg.exe.")


def _run_job(job_id: str) -> None:
    archive_path: Path | None = None
    try:
        with _lock:
            job = _jobs[job_id]
            job.status = "running"
            job.message = "Preparing FFmpeg install..."
            source_url = job.source_url

        if os.name != "nt":
            raise RuntimeError("Guided FFmpeg install is currently Windows-only. Save an ffmpeg path instead.")

        tool_dir = ffmpeg_tool_dir()
        archive_path = tool_dir / "ffmpeg-release-essentials.zip"
        tool_dir.mkdir(parents=True, exist_ok=True)

        _download_archive(job_id, source_url, archive_path)
        _extract_tools(job_id, archive_path, tool_dir)
        _configure_ffmpeg(job_id, tool_dir)
        archive_path.unlink(missing_ok=True)

        with _lock:
            job = _jobs[job_id]
            job.status = "completed"
            job.message = "FFmpeg was installed for FLAC Cafe."
            job.current_step = job.total_steps
            job.finished_at = utc_now()
            job.error = None
    except (OSError, zipfile.BadZipFile, TimeoutError, urlerror.URLError, RuntimeError) as exc:
        if archive_path is not None:
            archive_path.unlink(missing_ok=True)
        with _lock:
            job = _jobs[job_id]
            job.status = "failed"
            job.message = "Could not install FFmpeg automatically."
            job.error = f"{exc} Source: {job.source_url}"
            job.finished_at = utc_now()
    except Exception as exc:
        if archive_path is not None:
            archive_path.unlink(missing_ok=True)
        with _lock:
            job = _jobs[job_id]
            job.status = "failed"
            job.message = "Could not install FFmpeg automatically."
            job.error = str(exc)
            job.finished_at = utc_now()


def start_ffmpeg_install_job(source_url: str | None = None) -> dict:
    job_id = uuid4().hex
    with _lock:
        _jobs[job_id] = FfmpegInstallJob(job_id=job_id, source_url=source_url or FFMPEG_WINDOWS_URL)
    thread = Thread(target=_run_job, args=(job_id,), name="flac-cafe-ffmpeg-install", daemon=True)
    thread.start()
    return get_ffmpeg_install_job(job_id) or {"job_id": job_id, "status": "pending"}


def get_ffmpeg_install_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else job.snapshot()
