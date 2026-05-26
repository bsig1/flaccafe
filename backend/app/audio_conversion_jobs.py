from __future__ import annotations

import os
import re
import shutil
import subprocess
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, Thread
from uuid import uuid4

from .config import APP_STORAGE_ROOT
from .database import connect, get_setting, rows_to_dicts
from .file_tags import read_track_artwork, write_track_artwork


TRACK_SELECT_COLUMNS = """
    id, path, title, artist, album, album_artist, track_number,
    disc_number, genre, year, duration_seconds, bitrate, rating,
    date_added, file_modified_at
"""

OUTPUT_EXTENSIONS = {
    "flac": ".flac",
    "mp3": ".mp3",
    "m4a": ".m4a",
    "opus": ".opus",
    "wav": ".wav",
}

DEFAULT_BITRATES = {
    "mp3": 320,
    "m4a": 256,
    "opus": 160,
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


def creation_flags() -> int:
    return getattr(subprocess, "CREATE_NO_WINDOW", 0)


def ffmpeg_tool_dir() -> Path:
    return APP_STORAGE_ROOT / "tools" / "ffmpeg"


def ffmpeg_candidate_paths(configured_path: str | None = None) -> list[Path]:
    executable = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    repo_root = Path(__file__).resolve().parents[2]
    candidates: list[Path] = []
    if configured_path:
        configured = Path(configured_path).expanduser()
        candidates.append(configured / executable if configured.is_dir() else configured)
    candidates.extend(
        [
            ffmpeg_tool_dir() / executable,
            APP_STORAGE_ROOT / "tools" / executable,
            repo_root / "tools" / "ffmpeg" / executable,
            repo_root / "tools" / executable,
        ]
    )
    which_path = shutil.which("ffmpeg")
    if which_path:
        candidates.append(Path(which_path))

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        try:
            key = str(candidate.expanduser().resolve()).lower()
        except OSError:
            key = str(candidate.expanduser()).lower()
        if key not in seen:
            seen.add(key)
            unique.append(candidate.expanduser())
    return unique


def resolve_ffmpeg_path(conn=None) -> tuple[Path | None, str | None, list[Path]]:
    configured = get_setting(conn, "ffmpeg_path") if conn is not None else None
    candidates = ffmpeg_candidate_paths(configured)
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate.resolve(), configured, candidates
    return None, configured, candidates


def ffmpeg_version(ffmpeg_path: Path) -> str | None:
    try:
        result = subprocess.run(
            [str(ffmpeg_path), "-version"],
            capture_output=True,
            text=True,
            timeout=8,
            creationflags=creation_flags(),
        )
    except (OSError, subprocess.SubprocessError):
        return None
    first_line = (result.stdout or result.stderr or "").splitlines()
    return first_line[0].strip() if first_line else None


def ffmpeg_status(conn) -> dict:
    resolved, configured, candidates = resolve_ffmpeg_path(conn)
    version = ffmpeg_version(resolved) if resolved else None
    errors: list[str] = []
    if configured and resolved is None:
        errors.append(f"Saved FFmpeg path was not found: {configured}")
    return {
        "available": resolved is not None,
        "configured_path": configured,
        "resolved_path": str(resolved) if resolved else None,
        "version": version,
        "tool_directory": str(ffmpeg_tool_dir()),
        "checked_paths": [str(candidate) for candidate in candidates[:12]],
        "message": (
            "FFmpeg is ready for audio conversion."
            if resolved
            else "FFmpeg was not found. Save an ffmpeg.exe path or place it in the FLAC Cafe tool folder."
        ),
        "errors": errors,
    }


def safe_component(value: object, fallback: str) -> str:
    text = str(value or "").strip() or fallback
    text = re.sub(r"[<>:\"/\\|?*\x00-\x1f]+", "_", text)
    text = re.sub(r"\s+", " ", text).strip(" .")
    return text[:120] or fallback


def selected_tracks(track_ids: list[int] | None, limit: int | None) -> list[dict]:
    params: list[object] = []
    where = ""
    if track_ids:
        unique_ids = list(dict.fromkeys(int(track_id) for track_id in track_ids))
        if not unique_ids:
            return []
        where = f"WHERE id IN ({','.join('?' for _ in unique_ids)})"
        params.extend(unique_ids)
    limit_clause = ""
    if limit is not None:
        limit_clause = "LIMIT ?"
        params.append(limit)
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_SELECT_COLUMNS}
                FROM tracks
                {where}
                ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                         coalesce(disc_number, 0), coalesce(track_number, 0),
                         lower(coalesce(title, ''))
                {limit_clause}
                """,
                params,
            )
        )


def conversion_target_path(
    track: dict,
    target_folder: Path,
    output_format: str,
    preserve_structure: bool,
    library_root: Path | None,
) -> Path:
    source = Path(track["path"]).expanduser()
    extension = OUTPUT_EXTENSIONS[output_format]
    if preserve_structure and library_root is not None:
        try:
            return (target_folder / source.resolve().relative_to(library_root)).with_suffix(extension).resolve()
        except (OSError, ValueError):
            pass
    album_artist = safe_component(track.get("album_artist") or track.get("artist"), "Unknown Artist")
    album = safe_component(track.get("album"), "Unknown Album")
    filename = safe_component(track.get("title") or source.stem, source.stem) + extension
    return (target_folder / album_artist / album / filename).resolve()


def source_size_bytes(source: Path) -> int | None:
    try:
        return source.stat().st_size if source.exists() and source.is_file() else None
    except OSError:
        return None


def decoded_pcm_size_bytes(track: dict, request: object) -> int | None:
    duration = track.get("duration_seconds")
    if duration is None or float(duration) <= 0:
        return None
    sample_rate = int(getattr(request, "sample_rate_hz", None) or 44_100)
    channels = 2
    bytes_per_sample = 2
    return int(sample_rate * channels * bytes_per_sample * float(duration))


def estimate_output_size(track: dict, source: Path, request: object, input_size: int | None) -> tuple[int | None, str]:
    output_format = str(getattr(request, "output_format"))
    duration = track.get("duration_seconds")
    source_extension = source.suffix.lower().lstrip(".")
    if output_format in {"mp3", "m4a", "opus"}:
        if duration is None or float(duration) <= 0:
            return None, "Needs duration metadata for bitrate-based estimate."
        bitrate = int(getattr(request, "bitrate_kbps", None) or DEFAULT_BITRATES.get(output_format) or 192)
        return int((bitrate * 1000 / 8) * float(duration)), f"Estimated from {bitrate} kbps target bitrate."
    if output_format == "wav":
        pcm_size = decoded_pcm_size_bytes(track, request)
        if pcm_size is None:
            return None, "Needs duration metadata for PCM estimate."
        return pcm_size + 44, "Estimated as 16-bit stereo PCM."
    if output_format == "flac":
        pcm_size = decoded_pcm_size_bytes(track, request)
        if pcm_size is None:
            return None, "Needs duration metadata for FLAC estimate."
        estimate = int(pcm_size * 0.60)
        if source_extension in {"mp3", "m4a", "aac", "opus", "ogg"}:
            return estimate, "Lossy-to-FLAC usually expands and does not recover quality."
        if source_extension == "flac" and input_size:
            return input_size, "FLAC-to-FLAC is estimated near the current file size."
        return estimate, "Estimated around 60% of decoded PCM size."
    return None, "Unsupported estimate."


def size_ratio(estimated_output: int | None, input_size: int | None) -> float | None:
    if estimated_output is None or input_size is None or input_size <= 0:
        return None
    return estimated_output / input_size


def conversion_preview(request: object) -> dict:
    target_folder = Path(getattr(request, "target_folder")).expanduser().resolve()
    with connect() as conn:
        library_path = get_setting(conn, "library_path")
    library_root = Path(library_path).expanduser().resolve() if library_path else None
    tracks = selected_tracks(getattr(request, "track_ids"), getattr(request, "limit"))
    changes = []
    for track in tracks:
        source = Path(track["path"]).expanduser()
        target = conversion_target_path(
            track,
            target_folder,
            getattr(request, "output_format"),
            getattr(request, "preserve_structure"),
            library_root,
        )
        error = None
        if not source.exists():
            error = "Source file is missing"
        collision = target.exists() and not getattr(request, "overwrite")
        input_size = source_size_bytes(source)
        estimated_output, estimate_note = estimate_output_size(track, source, request, input_size)
        changes.append(
            {
                "track_id": int(track["id"]),
                "title": track.get("title"),
                "artist": track.get("artist"),
                "source_path": str(source),
                "target_path": str(target),
                "source_size_bytes": input_size,
                "estimated_output_size_bytes": estimated_output,
                "estimated_size_change_bytes": (
                    estimated_output - input_size
                    if estimated_output is not None and input_size is not None
                    else None
                ),
                "estimated_size_ratio": size_ratio(estimated_output, input_size),
                "estimate_note": estimate_note,
                "changed": source.resolve() != target,
                "collision": collision,
                "error": error,
            }
        )
    source_total = sum(change["source_size_bytes"] or 0 for change in changes)
    estimated_total = sum(change["estimated_output_size_bytes"] or 0 for change in changes)
    estimable_outputs = sum(1 for change in changes if change["estimated_output_size_bytes"] is not None)
    return {
        "target_folder": str(target_folder),
        "total": len(changes),
        "changed_count": sum(1 for change in changes if change["changed"] and not change["error"]),
        "collisions": sum(1 for change in changes if change["collision"]),
        "source_size_bytes": source_total or None,
        "estimated_output_size_bytes": estimated_total or None,
        "estimated_size_change_bytes": (
            estimated_total - source_total
            if source_total and estimated_total
            else None
        ),
        "estimated_size_ratio": (
            estimated_total / source_total
            if source_total and estimated_total
            else None
        ),
        "estimated_tracks": estimable_outputs,
        "changes": changes,
    }


def audio_codec_args(output_format: str, bitrate_kbps: int | None) -> list[str]:
    bitrate = bitrate_kbps or DEFAULT_BITRATES.get(output_format)
    if output_format == "flac":
        return ["-c:a", "flac"]
    if output_format == "mp3":
        return ["-c:a", "libmp3lame", "-b:a", f"{bitrate or 320}k"]
    if output_format == "m4a":
        return ["-c:a", "aac", "-b:a", f"{bitrate or 256}k"]
    if output_format == "opus":
        return ["-c:a", "libopus", "-b:a", f"{bitrate or 160}k"]
    if output_format == "wav":
        return ["-c:a", "pcm_s16le"]
    raise ValueError(f"Unsupported output format: {output_format}")


def ffmpeg_command(ffmpeg_path: Path, source: Path, target: Path, request: object) -> list[str]:
    command = [
        str(ffmpeg_path),
        "-hide_banner",
        "-y" if getattr(request, "overwrite") else "-n",
        "-i",
        str(source),
        "-map",
        "0:a:0",
        "-vn",
    ]
    command.extend(["-map_metadata", "0" if getattr(request, "copy_tags") else "-1"])
    if getattr(request, "normalize_volume"):
        command.extend(["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"])
    command.extend(audio_codec_args(getattr(request, "output_format"), getattr(request, "bitrate_kbps")))
    sample_rate = getattr(request, "sample_rate_hz")
    if sample_rate:
        command.extend(["-ar", str(sample_rate)])
    command.append(str(target))
    return command


def copy_converted_artwork(source: Path, target: Path, request: object) -> str | None:
    if not getattr(request, "copy_artwork") or getattr(request, "output_format") == "wav":
        return None
    artwork = read_track_artwork(source)
    if artwork is None:
        return None
    data, media_type = artwork
    write_track_artwork(target, data, media_type)
    return "embedded"


def run_ffmpeg_command(command: list[str]) -> None:
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        creationflags=creation_flags(),
    )
    if completed.returncode != 0:
        output = "\n".join(part for part in [completed.stderr, completed.stdout] if part).strip()
        raise RuntimeError(output[-1200:] or f"FFmpeg exited with {completed.returncode}")


@dataclass
class AudioConversionJob:
    job_id: str
    target_folder: str
    output_format: str
    status: str = "pending"
    phase: str = "queued"
    message: str | None = "Waiting to start"
    total_tracks: int = 0
    processed_tracks: int = 0
    converted: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    current_track: str | None = None
    started_at: datetime = field(default_factory=utc_now)
    finished_at: datetime | None = None
    error: str | None = None
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
            "target_folder": self.target_folder,
            "output_format": self.output_format,
            "status": self.status,
            "phase": self.phase,
            "message": self.message,
            "total_tracks": self.total_tracks,
            "processed_tracks": self.processed_tracks,
            "converted": self.converted,
            "skipped": self.skipped,
            "errors": self.errors[-50:],
            "current_track": self.current_track,
            "started_at": iso(self.started_at),
            "finished_at": iso(self.finished_at),
            "elapsed_seconds": elapsed_seconds,
            "eta_seconds": eta_seconds,
            "percent": percent,
            "error": self.error,
        }


_jobs: dict[str, AudioConversionJob] = {}
_lock = Lock()


def _run_conversion_job(job_id: str, request: object) -> None:
    try:
        with connect() as conn:
            ffmpeg_path, _configured, _candidates = resolve_ffmpeg_path(conn)
            library_path = get_setting(conn, "library_path")
        if ffmpeg_path is None:
            raise RuntimeError("FFmpeg was not found. Save an ffmpeg.exe path before starting conversion.")

        target_folder = Path(getattr(request, "target_folder")).expanduser().resolve()
        library_root = Path(library_path).expanduser().resolve() if library_path else None
        tracks = selected_tracks(getattr(request, "track_ids"), getattr(request, "limit"))
        with _lock:
            job = _jobs[job_id]
            job.status = "running"
            job.phase = "transcoding"
            job.total_tracks = len(tracks)
            job.message = f"Converting {len(tracks)} track{'s' if len(tracks) != 1 else ''}."

        for index, track in enumerate(tracks, start=1):
            with _lock:
                job = _jobs[job_id]
                if job.cancel_requested:
                    job.status = "canceled"
                    job.phase = "canceled"
                    job.message = "Conversion canceled."
                    job.finished_at = utc_now()
                    job.current_track = None
                    return
                job.current_track = track.get("title") or track.get("path")
                job.message = f"Converting {index} of {len(tracks)}"

            source = Path(track["path"]).expanduser()
            target = conversion_target_path(
                track,
                target_folder,
                getattr(request, "output_format"),
                getattr(request, "preserve_structure"),
                library_root,
            )
            try:
                if not source.exists():
                    raise FileNotFoundError("Source file is missing")
                if target.exists() and not getattr(request, "overwrite"):
                    with _lock:
                        _jobs[job_id].skipped += 1
                        _jobs[job_id].errors.append(f"{target}: target exists")
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                run_ffmpeg_command(ffmpeg_command(ffmpeg_path, source, target, request))
                try:
                    copy_converted_artwork(source, target, request)
                except Exception as exc:
                    with _lock:
                        _jobs[job_id].errors.append(f"{source.name}: converted, but artwork copy failed: {exc}")
                with _lock:
                    _jobs[job_id].converted += 1
            except Exception as exc:
                with _lock:
                    job = _jobs[job_id]
                    job.skipped += 1
                    job.errors.append(f"{source.name}: {exc}")
            finally:
                with _lock:
                    _jobs[job_id].processed_tracks = index

        with _lock:
            job = _jobs[job_id]
            job.status = "completed"
            job.phase = "completed"
            job.message = f"Converted {job.converted} track{'s' if job.converted != 1 else ''}."
            job.finished_at = utc_now()
            job.current_track = None
    except Exception as exc:
        with _lock:
            job = _jobs[job_id]
            job.status = "failed"
            job.phase = "failed"
            job.message = str(exc)
            job.error = str(exc)
            job.finished_at = utc_now()
            job.current_track = None


def start_audio_conversion_job(request: object) -> dict:
    job_id = uuid4().hex
    with _lock:
        _jobs[job_id] = AudioConversionJob(
            job_id=job_id,
            target_folder=str(Path(getattr(request, "target_folder")).expanduser()),
            output_format=getattr(request, "output_format"),
        )
    thread = Thread(target=_run_conversion_job, args=(job_id, request), name="flac-cafe-audio-conversion", daemon=True)
    thread.start()
    return get_audio_conversion_job(job_id) or {"job_id": job_id, "status": "pending"}


def get_audio_conversion_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else job.snapshot()


def cancel_audio_conversion_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        if job.status not in {"completed", "failed", "canceled"}:
            job.cancel_requested = True
            job.status = "canceling"
            job.phase = "canceling"
            job.message = "Cancel requested. The current file will finish first."
        return job.snapshot()
