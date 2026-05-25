from __future__ import annotations

import math
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .audio_conversion_jobs import creation_flags, resolve_ffmpeg_path
from .database import connect, get_setting, invalidate_library_query_cache, rows_to_dicts
from .file_tags import write_replaygain_tags
from .scanner import path_key


TRACK_VOLUME_COLUMNS = """
    id, path, title, artist, album, album_artist, duration_seconds,
    replaygain_track_gain_db, replaygain_album_gain_db,
    replaygain_track_peak, replaygain_album_peak, genre
"""

REPLAYGAIN_REFERENCE_INTEGRATED = -18.0
I_LINE_RE = re.compile(r"\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS", re.IGNORECASE)
PEAK_LINE_RE = re.compile(r"\bPeak:\s*(-?\d+(?:\.\d+)?)\s*dB(?:FS|TP)?", re.IGNORECASE)
TRUE_SETTING_VALUES = {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class LoudnessScan:
    integrated: float
    peak: float | None


def parse_ffmpeg_ebur128(output: str) -> LoudnessScan:
    """Read the final FFmpeg ebur128 summary values from stderr."""
    loudness_matches = I_LINE_RE.findall(output)
    if not loudness_matches:
        raise ValueError("FFmpeg did not report integrated loudness")
    peak_matches = PEAK_LINE_RE.findall(output)
    peak = None
    if peak_matches:
        try:
            peak = 10 ** (float(peak_matches[-1]) / 20)
        except ValueError:
            peak = None
    return LoudnessScan(integrated=float(loudness_matches[-1]), peak=peak)


def track_gain_from_loudness(integrated: float) -> float:
    return round(REPLAYGAIN_REFERENCE_INTEGRATED - integrated, 2)


def album_loudness(scans: list[tuple[LoudnessScan, float | None]]) -> float | None:
    if not scans:
        return None
    weighted_energy = 0.0
    total_duration = 0.0
    for scan, duration in scans:
        weight = max(1.0, float(duration or 180.0))
        weighted_energy += weight * (10 ** (scan.integrated / 10))
        total_duration += weight
    if total_duration <= 0 or weighted_energy <= 0:
        return None
    return 10 * math.log10(weighted_energy / total_duration)


def scan_loudness(ffmpeg_path: Path, source: Path, duration_seconds: float | None = None) -> LoudnessScan:
    timeout = max(45, min(300, int(float(duration_seconds or 180.0) * 3 + 30)))
    try:
        result = subprocess.run(
            [
                str(ffmpeg_path),
                "-hide_banner",
                "-nostdin",
                "-nostats",
                "-i",
                str(source),
                "-vn",
                "-sn",
                "-dn",
                "-filter:a",
                "ebur128=peak=true",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=creation_flags(),
        )
    except subprocess.TimeoutExpired as exc:
        raise ValueError("FFmpeg loudness scan timed out") from exc
    except OSError as exc:
        raise ValueError(f"Could not start FFmpeg: {exc}") from exc

    output = "\n".join(part for part in [result.stderr, result.stdout] if part)
    if result.returncode != 0 and "Integrated loudness" not in output:
        detail = output.strip().splitlines()[-1] if output.strip() else f"exit code {result.returncode}"
        raise ValueError(f"FFmpeg could not scan this file: {detail}")
    return parse_ffmpeg_ebur128(output)


def selected_volume_tracks(conn, track_ids: list[int] | None, limit: int) -> list[dict[str, Any]]:
    if track_ids:
        unique_ids = list(dict.fromkeys(int(track_id) for track_id in track_ids))
        if not unique_ids:
            return []
        placeholders = ",".join("?" for _ in unique_ids)
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_VOLUME_COLUMNS}
                FROM tracks
                WHERE id IN ({placeholders})
                ORDER BY lower(coalesce(artist, '')), lower(coalesce(album, '')),
                         coalesce(disc_number, 0), coalesce(track_number, 0),
                         lower(coalesce(title, ''))
                LIMIT ?
                """,
                [*unique_ids, limit],
            )
        )

    return rows_to_dicts(
        conn.execute(
            f"""
            SELECT {TRACK_VOLUME_COLUMNS}
            FROM tracks
            WHERE lower(coalesce(genre, '')) NOT IN ('audiobook', 'podcast')
            ORDER BY datetime(date_added) DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
    )


def album_key(track: dict[str, Any]) -> tuple[str, str]:
    artist = str(track.get("album_artist") or track.get("artist") or "").strip().casefold()
    album = str(track.get("album") or "").strip().casefold()
    return artist, album


def value_changed(current: object, proposed: float | None, tolerance: float) -> bool:
    if proposed is None:
        return False
    if current is None:
        return True
    try:
        return abs(float(current) - proposed) > tolerance
    except (TypeError, ValueError):
        return True


def volume_preview(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "track_id": int(row["id"]),
        "path": str(row["path"]),
        "title": row.get("title"),
        "artist": row.get("artist"),
        "album": row.get("album"),
        "current_track_gain_db": row.get("replaygain_track_gain_db"),
        "proposed_track_gain_db": None,
        "current_track_peak": row.get("replaygain_track_peak"),
        "proposed_track_peak": None,
        "current_album_gain_db": row.get("replaygain_album_gain_db"),
        "proposed_album_gain_db": None,
        "current_album_peak": row.get("replaygain_album_peak"),
        "proposed_album_peak": None,
        "changed": False,
        "applied": False,
        "error": None,
    }


def mark_volume_changed(preview: dict[str, Any]) -> bool:
    changed = (
        value_changed(preview["current_track_gain_db"], preview["proposed_track_gain_db"], 0.05)
        or value_changed(preview["current_track_peak"], preview["proposed_track_peak"], 0.0005)
        or value_changed(preview["current_album_gain_db"], preview["proposed_album_gain_db"], 0.05)
        or value_changed(preview["current_album_peak"], preview["proposed_album_peak"], 0.0005)
    )
    preview["changed"] = changed
    return changed


def manual_volume_previews(
    rows: list[dict[str, Any]],
    track_gain_db: float | None,
    track_peak: float | None,
    album_gain_db: float | None,
    album_peak: float | None,
) -> list[dict[str, Any]]:
    previews: list[dict[str, Any]] = []
    for row in rows:
        preview = volume_preview(row)
        preview["proposed_track_gain_db"] = None if track_gain_db is None else round(float(track_gain_db), 2)
        preview["proposed_track_peak"] = None if track_peak is None else round(float(track_peak), 6)
        preview["proposed_album_gain_db"] = None if album_gain_db is None else round(float(album_gain_db), 2)
        preview["proposed_album_peak"] = None if album_peak is None else round(float(album_peak), 6)
        mark_volume_changed(preview)
        previews.append(preview)
    return previews


def applied_value(preview: dict[str, Any], proposed_key: str, current_key: str, manual_mode: bool) -> float | None:
    proposed = preview.get(proposed_key)
    if proposed is not None or not manual_mode:
        return proposed if isinstance(proposed, (int, float)) else None
    current = preview.get(current_key)
    return current if isinstance(current, (int, float)) else None


def build_volume_tag_response(
    track_ids: list[int] | None,
    mode: str,
    apply: bool,
    write_to_file: bool | None,
    limit: int,
    manual_track_gain_db: float | None = None,
    manual_track_peak: float | None = None,
    manual_album_gain_db: float | None = None,
    manual_album_peak: float | None = None,
) -> dict[str, Any]:
    with connect() as conn:
        should_write_to_file = bool(write_to_file) if write_to_file is not None else get_setting(conn, "write_ratings_to_files") in TRUE_SETTING_VALUES
        rows = selected_volume_tracks(conn, track_ids, limit)
        errors: list[str] = []
        ffmpeg_path: Path | None = None
        checked_paths: list[str] = []

        if mode == "manual":
            if all(value is None for value in [manual_track_gain_db, manual_track_peak, manual_album_gain_db, manual_album_peak]):
                errors.append("Enter at least one manual gain or peak value.")
            previews = manual_volume_previews(rows, manual_track_gain_db, manual_track_peak, manual_album_gain_db, manual_album_peak)
        else:
            ffmpeg_path, _configured, candidates = resolve_ffmpeg_path(conn)
            checked_paths = [str(candidate) for candidate in candidates[:12]]
            if ffmpeg_path is None:
                return {
                    "total": 0,
                    "changed": 0,
                    "applied": 0,
                    "errors": [
                        "FFmpeg is required for volume tag analysis. Install it from File Management > Audio Conversion."
                    ],
                    "previews": [],
                    "ffmpeg_path": None,
                    "checked_paths": checked_paths,
                }
            previews = []
            group_scans: dict[tuple[str, str], list[tuple[LoudnessScan, float | None]]] = {}

            for row in rows:
                source = Path(str(row["path"]))
                preview = volume_preview(row)
                if not source.exists():
                    preview["error"] = "File is missing on disk"
                    errors.append(f"{source}: file is missing on disk")
                    previews.append(preview)
                    continue
                try:
                    scan = scan_loudness(ffmpeg_path, source, row.get("duration_seconds"))
                except ValueError as exc:
                    message = str(exc)
                    preview["error"] = message
                    errors.append(f"{source.name}: {message}")
                    previews.append(preview)
                    continue
                group_scans.setdefault(album_key(row), []).append((scan, row.get("duration_seconds")))
                preview["proposed_track_gain_db"] = track_gain_from_loudness(scan.integrated)
                preview["proposed_track_peak"] = scan.peak
                previews.append(preview)

            album_values: dict[tuple[str, str], tuple[float | None, float | None]] = {}
            for key, scans in group_scans.items():
                loudness = album_loudness(scans)
                album_gain = round(REPLAYGAIN_REFERENCE_INTEGRATED - loudness, 2) if loudness is not None else None
                peaks = [scan.peak for scan, _duration in scans if scan.peak is not None]
                album_values[key] = (album_gain, max(peaks) if peaks else None)

            row_by_id = {int(row["id"]): row for row in rows}
            for preview in previews:
                row = row_by_id.get(int(preview["track_id"]))
                if row is None or preview.get("error"):
                    continue
                proposed_album_gain, proposed_album_peak = album_values.get(album_key(row), (None, None))
                preview["proposed_album_gain_db"] = proposed_album_gain
                preview["proposed_album_peak"] = proposed_album_peak
                mark_volume_changed(preview)

        if errors and not previews:
            return {
                "total": 0,
                "changed": 0,
                "applied": 0,
                "errors": errors[:100],
                "previews": [],
                "ffmpeg_path": str(ffmpeg_path) if ffmpeg_path else None,
                "checked_paths": checked_paths,
            }

        applied = 0
        row_by_id = {int(row["id"]): row for row in rows}
        for preview in previews:
            track_id = int(preview["track_id"])
            row = row_by_id.get(track_id)
            if row is None or preview.get("error"):
                continue
            if not apply or not preview.get("changed"):
                continue

            source = Path(str(row["path"]))
            applied_track_gain = applied_value(preview, "proposed_track_gain_db", "current_track_gain_db", mode == "manual")
            applied_track_peak = applied_value(preview, "proposed_track_peak", "current_track_peak", mode == "manual")
            applied_album_gain = applied_value(preview, "proposed_album_gain_db", "current_album_gain_db", mode == "manual")
            applied_album_peak = applied_value(preview, "proposed_album_peak", "current_album_peak", mode == "manual")
            file_modified_at = None
            if should_write_to_file:
                try:
                    write_replaygain_tags(
                        source,
                        applied_track_gain,
                        applied_track_peak,
                        applied_album_gain,
                        applied_album_peak,
                    )
                    if source.exists():
                        file_modified_at = datetime.fromtimestamp(source.stat().st_mtime, timezone.utc).replace(microsecond=0).isoformat()
                except (OSError, ValueError) as exc:
                    message = str(exc)
                    preview["error"] = message
                    errors.append(f"{source.name}: {message}")
                    continue

            conn.execute(
                """
                UPDATE tracks
                SET replaygain_track_gain_db = ?,
                    replaygain_track_peak = ?,
                    replaygain_album_gain_db = ?,
                    replaygain_album_peak = ?,
                    file_modified_at = coalesce(?, file_modified_at),
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (
                    applied_track_gain,
                    applied_track_peak,
                    applied_album_gain,
                    applied_album_peak,
                    file_modified_at,
                    track_id,
                ),
            )
            conn.execute("DELETE FROM track_metadata_cache WHERE path_key = ?", (path_key(source),))
            preview["applied"] = True
            applied += 1

        if applied:
            invalidate_library_query_cache(conn)
        conn.commit()

    return {
        "total": len(previews),
        "changed": sum(1 for preview in previews if preview.get("changed")),
        "applied": applied,
        "errors": errors[:100],
        "previews": previews,
        "ffmpeg_path": str(ffmpeg_path) if ffmpeg_path else None,
        "checked_paths": checked_paths if ffmpeg_path is None else [],
    }
