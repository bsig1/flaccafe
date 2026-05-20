from __future__ import annotations

import json
import math
import random
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .database import connect, rows_to_dicts
from .schemas import AutoDjRequest


ARTIST_SPLIT_RE = re.compile(
    r"\s*(?:;|/|,|\+|&|\bfeat\.?\b|\bfeaturing\b|\bwith\b)\s*",
    re.IGNORECASE,
)


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def normalize_token(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").casefold()).strip()


def artist_tokens(value: str | None) -> set[str]:
    if not value:
        return set()
    return {normalize_token(part) for part in ARTIST_SPLIT_RE.split(value) if normalize_token(part)}


def text_tokens(value: str | None) -> set[str]:
    if not value:
        return set()
    return {normalize_token(part) for part in re.split(r"\s*(?:;|/|,|\|)\s*", value) if normalize_token(part)}


def parse_embedding(value: object) -> list[float] | None:
    if not value:
        return None
    try:
        raw = json.loads(str(value))
    except (TypeError, ValueError):
        return None
    if not isinstance(raw, list):
        return None
    embedding: list[float] = []
    for item in raw:
        if not isinstance(item, (int, float)):
            return None
        embedding.append(float(item))
    return embedding if embedding else None


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float | None:
    if not left or not right or len(left) != len(right):
        return None
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm <= 0 or right_norm <= 0:
        return None
    return dot / (left_norm * right_norm)


def combined_genre(track: dict[str, Any]) -> str | None:
    values = [
        str(value).strip()
        for value in (track.get("genre"), track.get("analysis_genre"))
        if value and str(value).strip()
    ]
    return "; ".join(dict.fromkeys(values)) if values else None


def album_token(value: str | None) -> str:
    return normalize_token(value)


def base_rating_score(rating: float | None) -> float:
    # Ratings matter, but the curve is intentionally not steep enough to turn
    # AutoDJ into "all 5-star songs forever." Unrated tracks start near a weak
    # 3-star so exploration can still win sometimes.
    if rating is None:
        return 0.2
    anchors = [
        (0.5, -4.8),
        (1.0, -4.0),
        (2.0, -1.4),
        (3.0, 0.35),
        (4.0, 1.3),
        (5.0, 2.15),
    ]
    value = float(rating)
    for (left_rating, left_score), (right_rating, right_score) in zip(anchors, anchors[1:]):
        if left_rating <= value <= right_rating:
            span = right_rating - left_rating
            progress = (value - left_rating) / span if span else 0
            return left_score + (right_score - left_score) * progress
    return anchors[-1][1] if value > anchors[-1][0] else anchors[0][1]


def recently_played_adjustment(track: dict[str, Any], cooldown_days: int, now: datetime) -> tuple[float, str]:
    last_played = parse_timestamp(track.get("last_played_at"))
    if cooldown_days <= 0 or last_played is None:
        return 0.55, "stale or unplayed"

    age = now - last_played.astimezone(timezone.utc)
    if age < timedelta(days=cooldown_days):
        remaining = 1 - (age.total_seconds() / timedelta(days=cooldown_days).total_seconds())
        return -3.0 * remaining, "recently played penalty"
    return 0.55, "not recently played"


def score_track(
    track: dict[str, Any],
    request: AutoDjRequest,
    now: datetime,
    rng: random.Random,
    seed_track: dict[str, Any] | None,
) -> tuple[float, str]:
    score = base_rating_score(track.get("rating"))
    reason_parts = [f"rating {track.get('rating') or 'unrated'}"]

    recency_score, recency_reason = recently_played_adjustment(
        track, request.recently_played_cooldown_days, now
    )
    score += recency_score
    reason_parts.append(recency_reason)

    skip_count = int(track.get("skip_count") or 0)
    if skip_count:
        score -= min(1.75, skip_count * 0.25)
        reason_parts.append("skip penalty")

    if track.get("rating") is None:
        score += 0.65
        reason_parts.append("exploration")

    if seed_track and request.similarity_weight > 0:
        similarity, similarity_reason = similarity_adjustment(track, seed_track)
        if similarity:
            score += similarity * request.similarity_weight
            reason_parts.append(similarity_reason)

    # A small jitter prevents the same library from producing identical queues
    # every time while still letting temperature control most of the surprise.
    score += rng.uniform(-0.35, 0.35)
    return score, ", ".join(reason_parts)


@dataclass
class Candidate:
    track: dict[str, Any]
    score: float
    reason: str


def weighted_choice(candidates: list[Candidate], temperature: float, rng: random.Random) -> Candidate:
    max_score = max(candidate.score for candidate in candidates)
    weights = [
        math.exp((candidate.score - max_score) / max(temperature, 0.05))
        for candidate in candidates
    ]
    total = sum(weights)
    pick = rng.random() * total
    running = 0.0
    for candidate, weight in zip(candidates, weights):
        running += weight
        if running >= pick:
            return candidate
    return candidates[-1]


def conflicts_with_cooldown(
    track: dict[str, Any],
    recent_artists: list[set[str]],
    recent_albums: list[str],
) -> bool:
    artists = artist_tokens(track.get("artist"))
    album = album_token(track.get("album"))
    artist_conflict = bool(artists and any(artists & recent for recent in recent_artists))
    album_conflict = bool(album and album in recent_albums)
    return artist_conflict or album_conflict


def similarity_adjustment(track: dict[str, Any], seed_track: dict[str, Any]) -> tuple[float, str]:
    # Similarity is a nudge, not a hard filter. CLAP embeddings compare the
    # actual audio when available; metadata still helps for unanalyzed tracks.
    if track["id"] == seed_track["id"]:
        return 0.0, ""

    score = 0.0
    reasons: list[str] = []
    audio_similarity = cosine_similarity(
        parse_embedding(track.get("analysis_embedding")),
        parse_embedding(seed_track.get("analysis_embedding")),
    )
    if audio_similarity is not None and audio_similarity > 0:
        score += audio_similarity * 2.2
        reasons.append(f"audio similarity {audio_similarity:.2f}")

    if artist_tokens(track.get("artist")) & artist_tokens(seed_track.get("artist")):
        score += 1.6
        reasons.append("similar artist")

    album = album_token(track.get("album"))
    if album and album == album_token(seed_track.get("album")):
        score += 0.9
        reasons.append("same album")

    genre_overlap = text_tokens(combined_genre(track)) & text_tokens(combined_genre(seed_track))
    if genre_overlap:
        score += 0.85
        reasons.append("similar genre")

    year = track.get("year")
    seed_year = seed_track.get("year")
    if isinstance(year, int) and isinstance(seed_year, int):
        distance = abs(year - seed_year)
        if distance <= 2:
            score += 0.45
            reasons.append("same era")
        elif distance <= 6:
            score += 0.2
            reasons.append("nearby era")

    rating = track.get("rating")
    seed_rating = seed_track.get("rating")
    if isinstance(rating, (int, float)) and isinstance(seed_rating, (int, float)) and abs(rating - seed_rating) <= 1:
        score += 0.25
        reasons.append("rating match")

    return score, "seed " + "/".join(reasons) if reasons else ""


def generate_queue(request: AutoDjRequest) -> list[dict[str, Any]]:
    rng = random.Random(request.seed)
    now = datetime.now(timezone.utc)
    with connect() as conn:
        tracks = rows_to_dicts(
            conn.execute(
                """
                SELECT id, path, title, artist, album, album_artist, track_number,
                       disc_number, genre, analysis_provider, analysis_model, analysis_genre,
                       analysis_genre_confidence, analysis_genre_tags, analysis_embedding,
                       analysis_updated_at, year, duration_seconds,
                       rating, play_count, skip_count, last_played_at, last_skipped_at,
                       date_added, file_modified_at
                FROM tracks
                ORDER BY artist, album, disc_number, track_number, title
                """
            )
        )
        seed_track = None
        if request.seed_track_id is not None:
            seed_track = conn.execute(
                """
                SELECT id, path, title, artist, album, album_artist, track_number,
                       disc_number, genre, analysis_provider, analysis_model, analysis_genre,
                       analysis_genre_confidence, analysis_genre_tags, analysis_embedding,
                       analysis_updated_at, year, duration_seconds,
                       rating, play_count, skip_count, last_played_at, last_skipped_at,
                       date_added, file_modified_at
                FROM tracks
                WHERE id = ?
                """,
                (request.seed_track_id,),
            ).fetchone()
            seed_track = dict(seed_track) if seed_track else None

    if not tracks:
        return []

    remaining = tracks[:]
    if seed_track and len(remaining) > 1:
        remaining = [track for track in remaining if track["id"] != seed_track["id"]]
    queue: list[dict[str, Any]] = []
    recent_artists: list[set[str]] = []
    recent_albums: list[str] = []
    target_unrated = round(request.queue_length * request.unrated_exploration_percent / 100)
    chosen_unrated = 0

    while remaining and len(queue) < request.queue_length:
        slots_left = request.queue_length - len(queue)
        unrated_needed = max(0, target_unrated - chosen_unrated)
        must_pick_unrated = unrated_needed >= slots_left

        pool = [track for track in remaining if not must_pick_unrated or track.get("rating") is None]
        if not pool:
            pool = remaining

        strict_pool = [
            track
            for track in pool
            if not conflicts_with_cooldown(
                track,
                recent_artists[: request.artist_cooldown],
                recent_albums[: request.album_cooldown],
            )
        ]
        if strict_pool:
            pool = strict_pool

        candidates = [
            Candidate(track=track, score=score, reason=reason)
            for track in pool
            for score, reason in [score_track(track, request, now, rng, seed_track)]
        ]

        if not strict_pool:
            # If the library is tiny or dominated by one artist, do not dead-end
            # the queue. Apply a meaningful penalty instead of hard exclusion.
            for candidate in candidates:
                if conflicts_with_cooldown(
                    candidate.track,
                    recent_artists[: request.artist_cooldown],
                    recent_albums[: request.album_cooldown],
                ):
                    candidate.score -= 2.0
                    candidate.reason += ", cooldown penalty"

        picked = weighted_choice(candidates, request.temperature, rng)
        selected = {**picked.track, "score": round(picked.score, 3), "reason": picked.reason}
        queue.append(selected)
        remaining = [track for track in remaining if track["id"] != picked.track["id"]]

        if picked.track.get("rating") is None:
            chosen_unrated += 1
        recent_artists.insert(0, artist_tokens(picked.track.get("artist")))
        recent_albums.insert(0, album_token(picked.track.get("album")))
        recent_artists = recent_artists[: max(1, request.artist_cooldown)]
        recent_albums = recent_albums[: max(1, request.album_cooldown)]

    return queue


def event_metadata(**values: Any) -> str:
    return json.dumps(values, ensure_ascii=True, sort_keys=True)
