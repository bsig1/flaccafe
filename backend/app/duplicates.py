from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .recommender import cosine_similarity, parse_embedding
from .scanner import path_key
from .schemas import DuplicateGroup


def duplicate_keep_recommendation(tracks: list[dict]) -> tuple[int | None, str | None]:
    if not tracks:
        return None, None

    def score(track: dict) -> float:
        value = 0.0
        if track.get("rating") is not None:
            value += float(track["rating"]) * 100
        if track.get("bitrate"):
            value += min(80, int(track["bitrate"]) / 4000)
        if track.get("audio_fingerprint"):
            value += 20
        if track.get("acoustic_fingerprint"):
            value += 25
        if track.get("analysis_embedding"):
            value += 15
        if track.get("duration_seconds"):
            value += 8
        if Path(track["path"]).exists():
            value += 10
        value -= len(str(track.get("path") or "")) / 1000
        return value

    selected = max(tracks, key=score)
    reasons: list[str] = []
    if selected.get("rating") is not None:
        reasons.append(f"{selected['rating']} star rating")
    if selected.get("bitrate"):
        reasons.append(f"{round(int(selected['bitrate']) / 1000)} kbps")
    if selected.get("analysis_embedding"):
        reasons.append("has CLAP analysis")
    if selected.get("audio_fingerprint"):
        reasons.append("has file fingerprint")
    if selected.get("acoustic_fingerprint"):
        reasons.append("has acoustic fingerprint")
    return int(selected["id"]), ", ".join(reasons) if reasons else "best available metadata"


def average_embedding_similarity(tracks: list[dict]) -> float | None:
    embeddings = [parse_embedding(track.get("analysis_embedding")) for track in tracks]
    embeddings = [embedding for embedding in embeddings if embedding]
    if len(embeddings) < 2:
        return None
    values: list[float] = []
    for index, left in enumerate(embeddings):
        for right in embeddings[index + 1 :]:
            similarity = cosine_similarity(left, right)
            if similarity is not None:
                values.append(similarity)
    return round(sum(values) / len(values), 4) if values else None


def duplicate_group_ignore_key(tracks: list[dict]) -> str:
    identity = sorted(
        str(track.get("path_key") or path_key(Path(str(track.get("path") or ""))) or track.get("id")).lower()
        for track in tracks
    )
    payload = json.dumps(identity, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def duplicate_group_from_tracks(key: str, tracks: list[dict], base_reason: str) -> DuplicateGroup:
    durations = [
        float(track["duration_seconds"])
        for track in tracks
        if isinstance(track.get("duration_seconds"), (int, float))
    ]
    bitrates = [int(track["bitrate"]) for track in tracks if isinstance(track.get("bitrate"), int)]
    fingerprints = [track.get("audio_fingerprint") for track in tracks if track.get("audio_fingerprint")]
    acoustic_fingerprints = [track.get("acoustic_fingerprint") for track in tracks if track.get("acoustic_fingerprint")]
    duration_spread = round(max(durations) - min(durations), 3) if len(durations) >= 2 else None
    bitrate_spread = max(bitrates) - min(bitrates) if len(bitrates) >= 2 else None
    shared_fingerprint = bool(fingerprints and len(set(fingerprints)) < len(fingerprints))
    shared_acoustic_fingerprint = bool(acoustic_fingerprints and len(set(acoustic_fingerprints)) < len(acoustic_fingerprints))
    path_roots = sorted({str(Path(track["path"]).parent) for track in tracks if track.get("path")})[:6]
    analyzed_tracks = sum(1 for track in tracks if track.get("analysis_embedding"))
    keep_id, keep_reason = duplicate_keep_recommendation(tracks)
    reasons = [base_reason]
    if shared_fingerprint:
        reasons.append("matching fingerprint")
    if shared_acoustic_fingerprint:
        reasons.append("matching acoustic fingerprint")
    if duration_spread is not None:
        reasons.append("same duration" if duration_spread <= 2 else f"duration spread {duration_spread:.1f}s")
    if bitrate_spread is not None:
        reasons.append("same bitrate" if bitrate_spread == 0 else f"bitrate spread {round(bitrate_spread / 1000)} kbps")
    if analyzed_tracks:
        reasons.append(f"{analyzed_tracks}/{len(tracks)} analyzed")
    return DuplicateGroup(
        key=key,
        ignore_key=duplicate_group_ignore_key(tracks),
        tracks=tracks,
        match_reason=", ".join(reasons),
        recommended_keep_id=keep_id,
        recommendation_reason=keep_reason,
        duration_spread_seconds=duration_spread,
        bitrate_spread=bitrate_spread,
        shared_fingerprint=shared_fingerprint,
        shared_acoustic_fingerprint=shared_acoustic_fingerprint,
        average_audio_similarity=average_embedding_similarity(tracks),
        path_roots=path_roots,
        analyzed_tracks=analyzed_tracks,
    )
