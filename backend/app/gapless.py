from __future__ import annotations

from pathlib import Path
from typing import Any

from mutagen import File as MutagenFile

from .database import connect, rows_to_dicts


TRACK_COLUMNS = """
    id, path, title, artist, album, album_artist, track_number, disc_number, duration_seconds
"""


def track_audio_shape(path: str) -> dict[str, Any]:
    source = Path(path)
    shape = {
        "codec": source.suffix.lower().lstrip(".") or None,
        "sample_rate": None,
        "channels": None,
        "bits_per_sample": None,
        "duration_seconds": None,
        "estimated_samples": None,
        "error": None,
    }
    if not source.exists():
        shape["error"] = "File is missing"
        return shape
    try:
        audio = MutagenFile(source)
    except Exception as exc:
        shape["error"] = f"Could not inspect audio: {exc}"
        return shape
    info = getattr(audio, "info", None)
    if info is None:
        shape["error"] = "No audio stream info found"
        return shape
    sample_rate = getattr(info, "sample_rate", None)
    duration = getattr(info, "length", None)
    shape.update(
        {
            "sample_rate": int(sample_rate) if sample_rate else None,
            "channels": getattr(info, "channels", None),
            "bits_per_sample": getattr(info, "bits_per_sample", None) or getattr(info, "bits_per_sample", None),
            "duration_seconds": float(duration) if duration else None,
        }
    )
    if sample_rate and duration:
        shape["estimated_samples"] = int(round(float(duration) * int(sample_rate)))
    return shape


def pair_verdict(left_shape: dict[str, Any], right_shape: dict[str, Any]) -> tuple[bool, list[str]]:
    warnings: list[str] = []
    if left_shape.get("error"):
        warnings.append(str(left_shape["error"]))
    if right_shape.get("error"):
        warnings.append(str(right_shape["error"]))
    for key, label in [("codec", "codec"), ("sample_rate", "sample rate"), ("channels", "channel count")]:
        if left_shape.get(key) != right_shape.get(key):
            warnings.append(f"Different {label}")
    if left_shape.get("estimated_samples") is None or right_shape.get("estimated_samples") is None:
        warnings.append("Sample counts could not be estimated")
    compatible = not warnings
    return compatible, warnings


def gapless_validate(track_ids: list[int] | None, album_id: int | None, limit: int) -> dict[str, Any]:
    params: list[Any] = []
    where = ""
    ordered_ids: dict[int, int] = {}
    if track_ids:
        ids = list(dict.fromkeys(track_ids))
        ordered_ids = {track_id: index for index, track_id in enumerate(ids)}
        where = f"WHERE id IN ({','.join('?' for _ in ids)})"
        params.extend(ids)
    elif album_id:
        where = "WHERE album_id = ?"
        params.append(album_id)
    params.append(limit)
    with connect() as conn:
        tracks = rows_to_dicts(
            conn.execute(
                f"""
                SELECT {TRACK_COLUMNS}
                FROM tracks
                {where}
                ORDER BY lower(coalesce(album_artist, artist, '')),
                         lower(coalesce(album, '')),
                         coalesce(disc_number, 0),
                         coalesce(track_number, 0),
                         lower(coalesce(title, ''))
                LIMIT ?
                """,
                params,
            )
        )
    if ordered_ids:
        tracks.sort(key=lambda track: ordered_ids.get(int(track["id"]), len(ordered_ids)))
    shapes = {int(track["id"]): track_audio_shape(track["path"]) for track in tracks}
    pairs = []
    for left, right in zip(tracks, tracks[1:]):
        left_shape = shapes[int(left["id"])]
        right_shape = shapes[int(right["id"])]
        compatible, warnings = pair_verdict(left_shape, right_shape)
        pairs.append(
            {
                "left_track_id": int(left["id"]),
                "right_track_id": int(right["id"]),
                "left_title": left.get("title"),
                "right_title": right.get("title"),
                "left_shape": left_shape,
                "right_shape": right_shape,
                "metadata_compatible": compatible,
                "warnings": warnings,
                "sample_accurate_ready": compatible,
            }
        )
    return {
        "track_count": len(tracks),
        "pair_count": len(pairs),
        "sample_accurate_ready_count": sum(1 for pair in pairs if pair["sample_accurate_ready"]),
        "pairs": pairs,
        "message": (
            "Adjacent tracks have matching codec/output metadata."
            if pairs and all(pair["sample_accurate_ready"] for pair in pairs)
            else "Need at least two tracks before validating gapless transitions."
            if not pairs
            else "Some adjacent tracks need review before claiming gapless-safe playback."
        ),
    }
