from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, Thread
from uuid import uuid4

from .audio_conversion_jobs import audio_codec_args, creation_flags, resolve_ffmpeg_path, safe_component
from .config import APP_STORAGE_ROOT
from .database import connect
from .musicbrainz_autotag import artist_credit_phrase, cover_art_for_release, lookup_release, parse_year, search_releases, text_similarity


CD_OUTPUT_EXTENSIONS = {
    "flac": ".flac",
    "mp3": ".mp3",
    "wav": ".wav",
}

RIPPER_TOOLS = ("cdparanoia", "cdda2wav", "icedax")
EXTRA_VERIFIER_TOOLS = ("whipper", "accuraterip")
ENCODER_TOOLS = ("flac", "lame")


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


def cd_tool_dir() -> Path:
    return APP_STORAGE_ROOT / "tools" / "cd-rip"


def executable_name(name: str) -> str:
    return f"{name}.exe" if os.name == "nt" else name


def tool_candidate_paths(name: str) -> list[Path]:
    executable = executable_name(name)
    repo_root = Path(__file__).resolve().parents[2]
    candidates: list[Path] = [
        cd_tool_dir() / executable,
        APP_STORAGE_ROOT / "tools" / executable,
        repo_root / "tools" / "cd-rip" / executable,
        repo_root / "tools" / executable,
    ]
    which_path = shutil.which(executable) or shutil.which(name)
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


def tool_version(path: Path) -> str | None:
    for flag in ("--version", "-version"):
        try:
            result = subprocess.run(
                [str(path), flag],
                capture_output=True,
                text=True,
                timeout=8,
                creationflags=creation_flags(),
            )
        except (OSError, subprocess.SubprocessError):
            continue
        lines = (result.stdout or result.stderr or "").splitlines()
        if lines:
            return lines[0].strip()
    return None


def find_tool(name: str, purpose: str) -> dict:
    candidates = tool_candidate_paths(name)
    resolved = next((candidate.resolve() for candidate in candidates if candidate.exists() and candidate.is_file()), None)
    return {
        "name": name,
        "purpose": purpose,
        "available": resolved is not None,
        "path": str(resolved) if resolved else None,
        "version": tool_version(resolved) if resolved else None,
        "checked_paths": [str(candidate) for candidate in candidates[:8]],
    }


def cd_text_supported(tools: dict[str, dict]) -> bool:
    return bool(tools.get("cdda2wav", {}).get("available") or tools.get("icedax", {}).get("available"))


def secure_ripping_supported(tools: dict[str, dict]) -> bool:
    return bool(tools.get("cdparanoia", {}).get("available") or tools.get("cdda2wav", {}).get("available") or tools.get("icedax", {}).get("available"))


def accuraterip_supported(tools: dict[str, dict]) -> bool:
    return bool(tools.get("whipper", {}).get("available") or tools.get("accuraterip", {}).get("available"))


def powershell_cd_drives() -> list[dict]:
    command = [
        "powershell",
        "-NoProfile",
        "-Command",
        (
            "Get-CimInstance Win32_CDROMDrive | "
            "Select-Object Drive,Caption,MediaLoaded,VolumeName | "
            "ConvertTo-Json -Compress"
        ),
    ]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=8,
            creationflags=creation_flags(),
        )
    except (OSError, subprocess.SubprocessError):
        return []
    if result.returncode != 0 or not result.stdout.strip():
        return []
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    if isinstance(payload, dict):
        return [payload]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def root_from_drive_id(drive_id: str) -> Path | None:
    text = drive_id.strip()
    if not text:
        return None
    if re.fullmatch(r"[A-Za-z]:", text):
        text += "\\"
    try:
        return Path(text)
    except (OSError, ValueError):
        return None


def cda_tracks_for_drive(drive_id: str) -> list[dict]:
    root = root_from_drive_id(drive_id)
    if root is None:
        return []
    try:
        files = sorted(root.glob("*.cda"))
    except OSError:
        return []
    tracks: list[dict] = []
    for index, path in enumerate(files, start=1):
        match = re.search(r"(\d+)", path.stem)
        track_number = int(match.group(1)) if match else index
        tracks.append(
            {
                "track_number": track_number,
                "title": f"Track {track_number:02d}",
                "artist": None,
                "duration_seconds": None,
                "source_label": path.name,
            }
        )
    return sorted(tracks, key=lambda item: item["track_number"])


def detect_cd_drives() -> list[dict]:
    drives: list[dict] = []
    if os.name == "nt":
        for item in powershell_cd_drives():
            drive_id = str(item.get("Drive") or "").strip()
            if not drive_id:
                continue
            tracks = cda_tracks_for_drive(drive_id)
            drives.append(
                {
                    "id": drive_id,
                    "path": f"{drive_id}\\",
                    "label": str(item.get("Caption") or drive_id),
                    "volume_name": item.get("VolumeName"),
                    "media_loaded": bool(item.get("MediaLoaded")) or bool(tracks),
                    "track_count": len(tracks) or None,
                    "tracks": tracks,
                }
            )
    else:
        for candidate in ("/dev/cdrom", "/dev/sr0"):
            path = Path(candidate)
            if path.exists():
                drives.append(
                    {
                        "id": candidate,
                        "path": candidate,
                        "label": candidate,
                        "volume_name": None,
                        "media_loaded": True,
                        "track_count": None,
                        "tracks": [],
                    }
                )
    return drives


def cd_rip_setup() -> dict:
    with connect() as conn:
        ffmpeg_path, _configured, _candidates = resolve_ffmpeg_path(conn)
    tool_entries = [
        find_tool("cdparanoia", "secure CD audio extraction"),
        find_tool("cdda2wav", "CD audio extraction and CD-Text"),
        find_tool("icedax", "CD audio extraction and CD-Text"),
        find_tool("whipper", "external AccurateRip-capable full-disc ripping"),
        find_tool("accuraterip", "external AccurateRip verifier"),
        find_tool("flac", "optional FLAC encoder"),
        find_tool("lame", "optional MP3 encoder"),
    ]
    tools = {tool["name"]: tool for tool in tool_entries}
    drives = detect_cd_drives()
    secure_available = secure_ripping_supported(tools)
    basic_available = secure_available or ffmpeg_path is not None
    return {
        "available": basic_available and ffmpeg_path is not None,
        "tool_directory": str(cd_tool_dir()),
        "drives": drives,
        "tools": tool_entries,
        "ffmpeg_available": ffmpeg_path is not None,
        "ffmpeg_path": str(ffmpeg_path) if ffmpeg_path else None,
        "secure_ripping_available": secure_available,
        "cd_text_available": cd_text_supported(tools),
        "accuraterip_available": accuraterip_supported(tools),
        "message": (
            "CD ripping tools are ready."
            if secure_available and ffmpeg_path is not None
            else "Install cdparanoia/cdda2wav plus FFmpeg for secure FLAC/MP3 ripping."
        ),
        "warnings": cd_setup_warnings(tools, ffmpeg_path is not None),
    }


def cd_setup_warnings(tools: dict[str, dict], ffmpeg_available: bool) -> list[str]:
    warnings: list[str] = []
    if not secure_ripping_supported(tools):
        warnings.append("Secure extraction requires cdparanoia, cdda2wav, or icedax in PATH or the FLAC Cafe CD tool folder.")
    if not ffmpeg_available:
        warnings.append("FLAC/MP3 encoding requires FFmpeg configured in Audio Conversion.")
    if not accuraterip_supported(tools):
        warnings.append("Official AccurateRip verification is not available; rip jobs will still write local SHA-256 verification hashes.")
    if not cd_text_supported(tools):
        warnings.append("CD-Text reading requires cdda2wav or icedax.")
    return warnings


def release_tracks(release: dict) -> list[dict]:
    tracks: list[dict] = []
    for disc_index, medium in enumerate(release.get("media") or [], start=1):
        if not isinstance(medium, dict):
            continue
        for item in medium.get("tracks") or []:
            if not isinstance(item, dict):
                continue
            recording = item.get("recording") if isinstance(item.get("recording"), dict) else {}
            position = item.get("position") or item.get("number") or len(tracks) + 1
            try:
                track_number = int(str(position).split(".")[-1])
            except (TypeError, ValueError):
                track_number = len(tracks) + 1
            title = item.get("title") or recording.get("title") or f"Track {track_number:02d}"
            length_ms = item.get("length") or recording.get("length")
            duration_seconds = None
            try:
                duration_seconds = round(float(length_ms) / 1000, 3) if length_ms else None
            except (TypeError, ValueError):
                duration_seconds = None
            tracks.append(
                {
                    "track_number": track_number,
                    "disc_number": disc_index,
                    "title": title,
                    "artist": artist_credit_phrase(item.get("artist-credit") or recording.get("artist-credit")),
                    "duration_seconds": duration_seconds,
                    "source_label": "MusicBrainz",
                }
            )
    return tracks


def release_artist(release: dict) -> str | None:
    return artist_credit_phrase(release.get("artist-credit"))


def release_candidate(release: dict, query_album: str | None, query_artist: str | None) -> dict:
    release_id = str(release.get("id") or "")
    tracks = release_tracks(release)
    title = release.get("title")
    artist = release_artist(release)
    confidence_parts = []
    if query_album:
        confidence_parts.append(text_similarity(query_album, title))
    if query_artist:
        confidence_parts.append(text_similarity(query_artist, artist))
    confidence = sum(confidence_parts) / len(confidence_parts) if confidence_parts else 0.0
    artwork = cover_art_for_release(release_id) if release_id else None
    return {
        "release_id": release_id,
        "title": title,
        "artist": artist,
        "date": release.get("date"),
        "year": parse_year(release.get("date")),
        "country": release.get("country"),
        "track_count": len(tracks),
        "confidence": round(confidence, 3),
        "artwork_thumbnail_url": artwork.get("thumbnail_url") if artwork else None,
        "tracks": tracks,
    }


def lookup_cd_metadata(request: object) -> dict:
    setup = cd_rip_setup()
    album_title = (getattr(request, "album_title", None) or "").strip()
    album_artist = (getattr(request, "album_artist", None) or "").strip()
    release_id = (getattr(request, "release_id", None) or "").strip()
    limit = int(getattr(request, "limit", 5))
    releases: list[dict] = []
    source = "none"
    if release_id:
        release = lookup_release(release_id)
        if release:
            releases = [release]
            source = "MusicBrainz release"
    elif album_title:
        found = search_releases(album_title, album_artist or None, limit)
        for item in found:
            item_id = item.get("id")
            if not item_id:
                continue
            release = lookup_release(str(item_id))
            if release:
                releases.append(release)
        source = "MusicBrainz search"

    candidates = [release_candidate(release, album_title or None, album_artist or None) for release in releases]
    candidates.sort(key=lambda item: (-item["confidence"], abs((item["track_count"] or 0) - requested_drive_track_count(request))))
    return {
        "drive_id": getattr(request, "drive_id", None),
        "source": source,
        "query": {"album_title": album_title or None, "album_artist": album_artist or None, "release_id": release_id or None},
        "candidates": candidates,
        "cd_text_available": bool(setup["cd_text_available"]),
        "disc_id": None,
        "message": (
            f"Found {len(candidates)} MusicBrainz candidate{'s' if len(candidates) != 1 else ''}."
            if candidates
            else "No MusicBrainz match found. You can still rip with manual track names."
        ),
        "warnings": setup["warnings"],
    }


def requested_drive_track_count(request: object) -> int:
    drive_id = getattr(request, "drive_id", None)
    if not drive_id:
        return 0
    return len(cda_tracks_for_drive(str(drive_id)))


def selected_ripper(secure_mode: bool) -> dict | None:
    setup = cd_rip_setup()
    tools = {tool["name"]: tool for tool in setup["tools"]}
    for name in ("cdparanoia", "cdda2wav", "icedax"):
        tool = tools.get(name)
        if tool and tool.get("available"):
            return tool
    if not secure_mode and setup["ffmpeg_available"]:
        return {"name": "ffmpeg", "path": setup["ffmpeg_path"], "available": True, "purpose": "basic CD extraction"}
    return None


def track_metadata_map(request: object) -> dict[int, dict]:
    tracks = getattr(request, "tracks", None) or []
    mapped: dict[int, dict] = {}
    for item in tracks:
        if isinstance(item, dict):
            data = item
        elif hasattr(item, "model_dump"):
            data = item.model_dump()
        else:
            data = dict(item)
        try:
            track_number = int(data.get("track_number"))
        except (TypeError, ValueError):
            continue
        mapped[track_number] = data
    return mapped


def selected_track_numbers(request: object) -> list[int]:
    requested = getattr(request, "track_numbers", None)
    if requested:
        return sorted(dict.fromkeys(int(number) for number in requested if int(number) > 0))
    mapped = track_metadata_map(request)
    if mapped:
        return sorted(mapped)
    drive_id = getattr(request, "drive_id", None)
    if drive_id:
        detected = cda_tracks_for_drive(str(drive_id))
        if detected:
            return [int(track["track_number"]) for track in detected]
    raise ValueError("Choose at least one CD track to rip.")


def metadata_for_track(request: object, track_number: int) -> dict:
    mapped = track_metadata_map(request)
    data = dict(mapped.get(track_number) or {})
    data.setdefault("track_number", track_number)
    data.setdefault("disc_number", 1)
    data.setdefault("title", f"Track {track_number:02d}")
    if getattr(request, "album_title", None):
        data.setdefault("album", getattr(request, "album_title"))
    if getattr(request, "album_artist", None):
        data.setdefault("album_artist", getattr(request, "album_artist"))
        data.setdefault("artist", getattr(request, "album_artist"))
    if getattr(request, "year", None):
        data.setdefault("year", getattr(request, "year"))
    if getattr(request, "genre", None):
        data.setdefault("genre", getattr(request, "genre"))
    return data


def cd_target_path(request: object, track: dict) -> Path:
    output_folder = Path(getattr(request, "output_folder")).expanduser().resolve()
    output_format = getattr(request, "output_format")
    extension = CD_OUTPUT_EXTENSIONS[output_format]
    album_artist = safe_component(track.get("album_artist") or track.get("artist"), "Unknown Artist")
    album = safe_component(track.get("album") or getattr(request, "album_title", None), "Unknown Album")
    title = safe_component(track.get("title"), f"Track {int(track.get('track_number') or 0):02d}")
    try:
        number = int(track.get("track_number") or 0)
    except (TypeError, ValueError):
        number = 0
    prefix = f"{number:02d} - " if number > 0 else ""
    return output_folder / album_artist / album / f"{prefix}{title}{extension}"


def run_cd_command(command: list[str]) -> str:
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        creationflags=creation_flags(),
    )
    output = "\n".join(part for part in [completed.stderr, completed.stdout] if part).strip()
    if completed.returncode != 0:
        raise RuntimeError(output[-2000:] or f"{Path(command[0]).name} exited with {completed.returncode}")
    return output[-4000:]


def rip_wav_command(ripper: dict, drive_id: str, track_number: int, wav_path: Path, secure_mode: bool) -> list[str]:
    name = str(ripper["name"])
    path = str(ripper["path"])
    if name == "cdparanoia":
        command = [path, "-d", drive_id]
        if secure_mode:
            command.append("-X")
        command.extend([str(track_number), str(wav_path)])
        return command
    if name in {"cdda2wav", "icedax"}:
        command = [path, "-D", drive_id, "-t", str(track_number), "-O", "wav"]
        if secure_mode:
            command.append("-paranoia")
        command.append(str(wav_path))
        return command
    if name == "ffmpeg":
        return [
            path,
            "-hide_banner",
            "-y",
            "-f",
            "libcdio",
            "-i",
            drive_id,
            "-map",
            f"0:a:{max(0, track_number - 1)}",
            "-vn",
            "-c:a",
            "pcm_s16le",
            str(wav_path),
        ]
    raise RuntimeError(f"Unsupported CD ripper tool: {name}")


def metadata_args(track: dict) -> list[str]:
    fields = {
        "title": track.get("title"),
        "artist": track.get("artist"),
        "album": track.get("album"),
        "album_artist": track.get("album_artist"),
        "genre": track.get("genre"),
        "date": track.get("year"),
        "track": track.get("track_number"),
        "disc": track.get("disc_number"),
    }
    args: list[str] = []
    for key, value in fields.items():
        if value is not None and str(value).strip():
            args.extend(["-metadata", f"{key}={value}"])
    return args


def encode_cd_command(ffmpeg_path: Path, wav_path: Path, target_path: Path, request: object, track: dict) -> list[str]:
    command = [
        str(ffmpeg_path),
        "-hide_banner",
        "-y" if getattr(request, "overwrite") else "-n",
        "-i",
        str(wav_path),
        "-vn",
    ]
    command.extend(metadata_args(track))
    command.extend(audio_codec_args(getattr(request, "output_format"), getattr(request, "bitrate_kbps", None)))
    command.append(str(target_path))
    return command


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verification_for(path: Path, track_number: int, accurate_available: bool) -> dict:
    return {
        "track_number": track_number,
        "path": str(path),
        "sha256": sha256_file(path),
        "bytes": path.stat().st_size,
        "accuraterip_checked": False,
        "accuraterip_match": None,
        "message": (
            "Official AccurateRip-capable tool was detected, but this job stored local verification only."
            if accurate_available
            else "Local SHA-256 verification written; install an AccurateRip-capable tool for database matching."
        ),
    }


@dataclass
class CdRipJob:
    job_id: str
    drive_id: str
    output_folder: str
    output_format: str
    status: str = "pending"
    phase: str = "queued"
    message: str | None = "Waiting to start"
    total_tracks: int = 0
    processed_tracks: int = 0
    ripped_tracks: int = 0
    skipped_tracks: int = 0
    current_track: str | None = None
    errors: list[str] = field(default_factory=list)
    log: list[str] = field(default_factory=list)
    verification: list[dict] = field(default_factory=list)
    started_at: datetime = field(default_factory=utc_now)
    finished_at: datetime | None = None
    elapsed_seconds: float = 0.0
    eta_seconds: float | None = None
    percent: float = 0.0
    cancel_requested: bool = False
    error: str | None = None

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
            "drive_id": self.drive_id,
            "output_folder": self.output_folder,
            "output_format": self.output_format,
            "status": self.status,
            "phase": self.phase,
            "message": self.message,
            "total_tracks": self.total_tracks,
            "processed_tracks": self.processed_tracks,
            "ripped_tracks": self.ripped_tracks,
            "skipped_tracks": self.skipped_tracks,
            "current_track": self.current_track,
            "errors": self.errors[-50:],
            "log": self.log[-80:],
            "verification": self.verification,
            "started_at": iso(self.started_at),
            "finished_at": iso(self.finished_at),
            "elapsed_seconds": elapsed_seconds,
            "eta_seconds": eta_seconds,
            "percent": percent,
            "error": self.error,
        }


_jobs: dict[str, CdRipJob] = {}
_lock = Lock()


def _run_cd_rip_job(job_id: str, request: object) -> None:
    temp_files: list[Path] = []
    try:
        drive_id = str(getattr(request, "drive_id")).strip()
        output_format = getattr(request, "output_format")
        secure_mode = bool(getattr(request, "secure_mode"))
        verify = bool(getattr(request, "verify"))
        overwrite = bool(getattr(request, "overwrite"))
        ripper = selected_ripper(secure_mode)
        if ripper is None:
            raise RuntimeError("No compatible CD ripping tool was found.")
        with connect() as conn:
            ffmpeg_path, _configured, _candidates = resolve_ffmpeg_path(conn)
        if output_format != "wav" and ffmpeg_path is None:
            raise RuntimeError("FFmpeg is required to encode ripped CD audio to FLAC or MP3.")
        track_numbers = selected_track_numbers(request)
        accurate_available = bool(cd_rip_setup()["accuraterip_available"])
        with _lock:
            job = _jobs[job_id]
            job.status = "running"
            job.phase = "ripping"
            job.total_tracks = len(track_numbers)
            job.message = f"Ripping {len(track_numbers)} CD track{'s' if len(track_numbers) != 1 else ''}."
            job.log.append(f"Using {ripper['name']} for extraction.")

        work_dir = Path(getattr(request, "output_folder")).expanduser().resolve() / ".flac-cafe-rip-work"
        work_dir.mkdir(parents=True, exist_ok=True)
        for index, track_number in enumerate(track_numbers, start=1):
            with _lock:
                job = _jobs[job_id]
                if job.cancel_requested:
                    job.status = "canceled"
                    job.phase = "canceled"
                    job.message = "CD rip canceled."
                    job.finished_at = utc_now()
                    job.current_track = None
                    return
                job.current_track = f"Track {track_number:02d}"
                job.message = f"Ripping track {index} of {len(track_numbers)}"

            track = metadata_for_track(request, track_number)
            target = cd_target_path(request, track)
            wav_path = work_dir / f"{job_id}-track-{track_number:02d}.wav"
            temp_files.append(wav_path)
            try:
                if target.exists() and not overwrite:
                    with _lock:
                        job = _jobs[job_id]
                        job.skipped_tracks += 1
                        job.errors.append(f"{target}: target exists")
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                output = run_cd_command(rip_wav_command(ripper, drive_id, track_number, wav_path, secure_mode))
                if output:
                    with _lock:
                        _jobs[job_id].log.append(output)
                if output_format == "wav":
                    if target.exists() and overwrite:
                        target.unlink()
                    wav_path.replace(target)
                    if wav_path in temp_files:
                        temp_files.remove(wav_path)
                else:
                    if ffmpeg_path is None:
                        raise RuntimeError("FFmpeg was not found.")
                    run_cd_command(encode_cd_command(ffmpeg_path, wav_path, target, request, track))
                if verify:
                    report = verification_for(target, track_number, accurate_available)
                    with _lock:
                        _jobs[job_id].verification.append(report)
                with _lock:
                    _jobs[job_id].ripped_tracks += 1
            except Exception as exc:
                with _lock:
                    job = _jobs[job_id]
                    job.skipped_tracks += 1
                    job.errors.append(f"Track {track_number:02d}: {exc}")
            finally:
                with _lock:
                    _jobs[job_id].processed_tracks = index

        with _lock:
            job = _jobs[job_id]
            job.status = "completed"
            job.phase = "completed"
            job.message = f"Ripped {job.ripped_tracks} track{'s' if job.ripped_tracks != 1 else ''}."
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
    finally:
        for path in temp_files:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass


def start_cd_rip_job(request: object) -> dict:
    output_folder = Path(getattr(request, "output_folder")).expanduser()
    job_id = uuid4().hex
    with _lock:
        _jobs[job_id] = CdRipJob(
            job_id=job_id,
            drive_id=str(getattr(request, "drive_id")),
            output_folder=str(output_folder),
            output_format=getattr(request, "output_format"),
        )
    thread = Thread(target=_run_cd_rip_job, args=(job_id, request), name="flac-cafe-cd-rip", daemon=True)
    thread.start()
    return get_cd_rip_job(job_id) or {"job_id": job_id, "status": "pending"}


def get_cd_rip_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else job.snapshot()


def cancel_cd_rip_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        if job.status not in {"completed", "failed", "canceled"}:
            job.cancel_requested = True
            job.status = "canceling"
            job.phase = "canceling"
            job.message = "Cancel requested. The current track will finish first."
        return job.snapshot()


def mci_command(command: str) -> None:
    if os.name != "nt":
        raise RuntimeError("CD playback is currently implemented for Windows only.")
    import ctypes

    buffer = ctypes.create_unicode_buffer(512)
    result = ctypes.windll.winmm.mciSendStringW(command, buffer, len(buffer), None)
    if result != 0:
        error_text = ctypes.create_unicode_buffer(512)
        ctypes.windll.winmm.mciGetErrorStringW(result, error_text, len(error_text))
        raise RuntimeError(error_text.value or f"MCI command failed: {result}")


def play_cd_track(track_number: int) -> dict:
    if track_number < 1:
        raise RuntimeError("Track number must be 1 or higher.")
    mci_command("close flac_cafe_cd")
    mci_command("open cdaudio alias flac_cafe_cd")
    mci_command("set flac_cafe_cd time format tmsf")
    mci_command(f"play flac_cafe_cd from {track_number}:0:0")
    return {"status": "playing", "track_number": track_number, "message": f"Playing CD track {track_number}."}


def stop_cd_playback() -> dict:
    mci_command("stop flac_cafe_cd")
    mci_command("close flac_cafe_cd")
    return {"status": "stopped", "track_number": None, "message": "CD playback stopped."}
