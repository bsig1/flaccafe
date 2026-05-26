from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from threading import Lock
from typing import Any, Literal
from urllib import parse, request as urlrequest


MUSICBRAINZ_ROOT = "https://musicbrainz.org/ws/2"
COVER_ART_ROOT = "https://coverartarchive.org"
ACOUSTID_ROOT = "https://api.acoustid.org/v2"
USER_AGENT = "FLAC Cafe/0.4.0 (local library auto-tag preview; https://github.com/)"
REQUEST_TIMEOUT_SECONDS = 12
REQUEST_SPACING_SECONDS = 1.05

AutoTagMode = Literal["album", "track"]
AUTO_TAG_FIELDS = ("title", "artist", "album", "album_artist", "track_number", "disc_number", "genre", "year")

_request_lock = Lock()
_last_request_at = 0.0


def normalized_text(value: object) -> str:
    text = "" if value is None else str(value)
    text = text.casefold()
    text = re.sub(r"[\W_]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def text_similarity(left: object, right: object) -> float:
    left_text = normalized_text(left)
    right_text = normalized_text(right)
    if not left_text or not right_text:
        return 0.0
    if left_text == right_text:
        return 1.0
    return SequenceMatcher(None, left_text, right_text).ratio()


def parse_year(value: object) -> int | None:
    if value is None:
        return None
    match = re.search(r"(19|20)\d{2}", str(value))
    return int(match.group(0)) if match else None


def first_int(value: object) -> int | None:
    if value is None:
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group(0)) if match else None


def artist_credit_phrase(credit: object) -> str | None:
    if not isinstance(credit, list):
        return None
    parts: list[str] = []
    for item in credit:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not name and isinstance(item.get("artist"), dict):
            name = item["artist"].get("name")
        if name:
            parts.append(str(name))
        joinphrase = item.get("joinphrase")
        if joinphrase:
            parts.append(str(joinphrase))
    text = "".join(parts).strip()
    return text or None


def genre_name(*sources: object) -> str | None:
    candidates: list[tuple[int, str]] = []
    for source in sources:
        if not isinstance(source, list):
            continue
        for item in source:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            try:
                count = int(item.get("count") or 0)
            except (TypeError, ValueError):
                count = 0
            candidates.append((count, name))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], item[1].casefold()))
    return candidates[0][1]


def value_missing(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def values_equal(left: object, right: object) -> bool:
    if left is None and right is None:
        return True
    if isinstance(left, (int, float)) or isinstance(right, (int, float)):
        try:
            return float(left) == float(right)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return False
    return normalized_text(left) == normalized_text(right)


def metadata_changes(current: dict[str, Any], proposed: dict[str, Any], missing_only: bool) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    for field_name in AUTO_TAG_FIELDS:
        value = proposed.get(field_name)
        if value_missing(value):
            continue
        current_value = current.get(field_name)
        if missing_only and not value_missing(current_value):
            continue
        if not values_equal(current_value, value):
            changes[field_name] = value
    return changes


def json_get(url: str) -> dict[str, Any] | None:
    global _last_request_at
    with _request_lock:
        elapsed = time.monotonic() - _last_request_at
        if elapsed < REQUEST_SPACING_SECONDS:
            time.sleep(REQUEST_SPACING_SECONDS - elapsed)
        request = urlrequest.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
        )
        _last_request_at = time.monotonic()
    try:
        with urlrequest.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            if response.status == 404:
                return None
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None


def json_post_form(url: str, data: dict[str, object]) -> dict[str, Any] | None:
    global _last_request_at
    encoded = parse.urlencode(data).encode("utf-8")
    with _request_lock:
        elapsed = time.monotonic() - _last_request_at
        if elapsed < REQUEST_SPACING_SECONDS:
            time.sleep(REQUEST_SPACING_SECONDS - elapsed)
        request = urlrequest.Request(
            url,
            data=encoded,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": USER_AGENT,
            },
        )
        _last_request_at = time.monotonic()
    try:
        with urlrequest.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None


def musicbrainz_get(resource: str, params: dict[str, object]) -> dict[str, Any] | None:
    query = parse.urlencode({**params, "fmt": "json"})
    return json_get(f"{MUSICBRAINZ_ROOT}/{resource}?{query}")


def lookup_acoustid_recordings(
    api_key: str | None,
    fingerprint: object,
    duration_seconds: object,
    limit: int,
) -> list[dict[str, Any]]:
    key = (api_key or "").strip()
    fingerprint_text = str(fingerprint or "").strip()
    if not key or not fingerprint_text:
        return []
    try:
        duration = int(round(float(duration_seconds)))
    except (TypeError, ValueError):
        return []
    if duration <= 0:
        return []

    payload = json_post_form(
        f"{ACOUSTID_ROOT}/lookup",
        {
            "client": key,
            "duration": duration,
            "fingerprint": fingerprint_text,
            "meta": "recordingids",
            "format": "json",
        },
    )
    if not payload or payload.get("status") != "ok":
        return []

    recording_scores: dict[str, float] = {}
    for result in payload.get("results") or []:
        if not isinstance(result, dict):
            continue
        try:
            score = float(result.get("score") or 0)
        except (TypeError, ValueError):
            score = 0.0
        for recording in result.get("recordings") or []:
            if not isinstance(recording, dict):
                continue
            recording_id = str(recording.get("id") or "").strip()
            if recording_id and score > recording_scores.get(recording_id, 0.0):
                recording_scores[recording_id] = score

    recordings: list[dict[str, Any]] = []
    for recording_id, acoustid_score in sorted(recording_scores.items(), key=lambda item: item[1], reverse=True)[:limit]:
        recording = musicbrainz_get(
            f"recording/{recording_id}",
            {"inc": "releases+artist-credits+genres+tags+release-groups"},
        )
        if not recording:
            continue
        recording["_acoustid_score"] = acoustid_score
        recording["score"] = max(float(recording.get("score") or 0), acoustid_score * 100)
        recordings.append(recording)
    return recordings


def musicbrainz_phrase(value: object) -> str:
    return str(value or "").replace("\\", "\\\\").replace('"', '\\"')


def search_releases(album: str, artist: str | None, limit: int) -> list[dict[str, Any]]:
    terms = [f'release:"{musicbrainz_phrase(album)}"']
    if artist:
        terms.append(f'artist:"{musicbrainz_phrase(artist)}"')
    payload = musicbrainz_get("release", {"query": " AND ".join(terms), "limit": max(1, min(10, limit))})
    releases = payload.get("releases") if payload else []
    return [release for release in releases if isinstance(release, dict)]


def lookup_release(release_id: str) -> dict[str, Any] | None:
    return musicbrainz_get(
        f"release/{release_id}",
        {"inc": "recordings+artist-credits+release-groups+genres+tags+media"},
    )


def lookup_discid_releases(disc_id: str, toc: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, object] = {
        "inc": "recordings+artist-credits+release-groups",
        "cdstubs": "no",
    }
    if toc:
        params["toc"] = toc
    payload = musicbrainz_get(f"discid/{disc_id or '-'}", params)
    releases = payload.get("releases") if payload else []
    return [release for release in releases if isinstance(release, dict)]


def search_recordings(title: str, artist: str | None, limit: int) -> list[dict[str, Any]]:
    terms = [f'recording:"{musicbrainz_phrase(title)}"']
    if artist:
        terms.append(f'artist:"{musicbrainz_phrase(artist)}"')
    payload = musicbrainz_get("recording", {"query": " AND ".join(terms), "limit": max(1, min(10, limit))})
    recordings = payload.get("recordings") if payload else []
    return [recording for recording in recordings if isinstance(recording, dict)]


def cover_art_for_release(release_id: str) -> dict[str, Any] | None:
    payload = json_get(f"{COVER_ART_ROOT}/release/{release_id}/")
    images = payload.get("images") if payload else []
    if not isinstance(images, list):
        return None
    front = next((image for image in images if isinstance(image, dict) and image.get("front")), None)
    image = front or next((image for image in images if isinstance(image, dict)), None)
    if not isinstance(image, dict):
        return None
    thumbnails = image.get("thumbnails") if isinstance(image.get("thumbnails"), dict) else {}
    return {
        "image_url": image.get("image"),
        "thumbnail_url": thumbnails.get("500") or thumbnails.get("large") or thumbnails.get("250") or image.get("image"),
        "types": image.get("types") or [],
    }


@dataclass
class AutoTagPreview:
    track_id: int
    path: str
    current: dict[str, Any]
    proposed: dict[str, Any] = field(default_factory=dict)
    changed_fields: list[str] = field(default_factory=list)
    confidence: float = 0.0
    match_type: AutoTagMode = "track"
    source: str = "MusicBrainz"
    release_id: str | None = None
    release_title: str | None = None
    recording_id: str | None = None
    artwork_url: str | None = None
    artwork_thumbnail_url: str | None = None
    applied: bool = False
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "track_id": self.track_id,
            "path": self.path,
            "current": self.current,
            "proposed": self.proposed,
            "changed_fields": self.changed_fields,
            "confidence": self.confidence,
            "match_type": self.match_type,
            "source": self.source,
            "release_id": self.release_id,
            "release_title": self.release_title,
            "recording_id": self.recording_id,
            "artwork_url": self.artwork_url,
            "artwork_thumbnail_url": self.artwork_thumbnail_url,
            "applied": self.applied,
            "error": self.error,
        }


def current_metadata(track: dict[str, Any]) -> dict[str, Any]:
    return {field_name: track.get(field_name) for field_name in AUTO_TAG_FIELDS}


def release_track_entries(release: dict[str, Any]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for medium in release.get("media") or []:
        if not isinstance(medium, dict):
            continue
        disc_number = first_int(medium.get("position"))
        for track in medium.get("tracks") or []:
            if not isinstance(track, dict):
                continue
            recording = track.get("recording") if isinstance(track.get("recording"), dict) else {}
            entries.append(
                {
                    "disc_number": disc_number,
                    "track_number": first_int(track.get("number") or track.get("position")),
                    "title": track.get("title") or recording.get("title"),
                    "artist": artist_credit_phrase(track.get("artist-credit")) or artist_credit_phrase(recording.get("artist-credit")),
                    "recording_id": recording.get("id"),
                    "genre": genre_name(recording.get("genres"), recording.get("tags")),
                }
            )
    return entries


def release_metadata(release: dict[str, Any], track_entry: dict[str, Any] | None = None) -> dict[str, Any]:
    release_group = release.get("release-group") if isinstance(release.get("release-group"), dict) else {}
    return {
        "title": track_entry.get("title") if track_entry else None,
        "artist": track_entry.get("artist") if track_entry else None,
        "album": release.get("title"),
        "album_artist": artist_credit_phrase(release.get("artist-credit")),
        "track_number": track_entry.get("track_number") if track_entry else None,
        "disc_number": track_entry.get("disc_number") if track_entry else None,
        "genre": (track_entry.get("genre") if track_entry else None) or genre_name(release.get("genres"), release.get("tags"), release_group.get("genres"), release_group.get("tags")),
        "year": parse_year(release.get("date") or release_group.get("first-release-date")),
    }


def recording_metadata(recording: dict[str, Any]) -> dict[str, Any]:
    return recording_release_metadata(recording)


def recording_release_metadata(recording: dict[str, Any], release: dict[str, Any] | None = None) -> dict[str, Any]:
    releases = [item for item in recording.get("releases") or [] if isinstance(item, dict)]
    selected_release = release or (releases[0] if releases else {})
    return {
        "title": recording.get("title"),
        "artist": artist_credit_phrase(recording.get("artist-credit")),
        "album": selected_release.get("title"),
        "album_artist": artist_credit_phrase(selected_release.get("artist-credit")),
        "track_number": None,
        "disc_number": None,
        "genre": genre_name(recording.get("genres"), recording.get("tags"), selected_release.get("genres"), selected_release.get("tags")),
        "year": parse_year(selected_release.get("date") or recording.get("first-release-date")),
    }


def release_artist(release: dict[str, Any]) -> str | None:
    return artist_credit_phrase(release.get("artist-credit"))


def release_is_compilation(release: dict[str, Any]) -> bool:
    artist = normalized_text(release_artist(release))
    release_group = release.get("release-group") if isinstance(release.get("release-group"), dict) else {}
    secondary_types = release_group.get("secondary-types") if isinstance(release_group.get("secondary-types"), list) else []
    return artist in {"various artists", "various"} or any(normalized_text(item) == "compilation" for item in secondary_types)


def recording_release_score(
    release: dict[str, Any],
    title: str,
    artist: str | None,
    current_album: object,
) -> float:
    release_title = release.get("title")
    release_artist_text = release_artist(release)
    artist_score = text_similarity(artist, release_artist_text) if artist else 0.5
    album_score = text_similarity(current_album, release_title)
    title_as_album_score = text_similarity(title, release_title) * 0.78
    title_score = max(album_score, title_as_album_score)

    release_group = release.get("release-group") if isinstance(release.get("release-group"), dict) else {}
    primary_type = normalized_text(release_group.get("primary-type"))
    type_bonus = 0.0
    if primary_type == "album":
        type_bonus = 0.08
    elif primary_type == "single":
        type_bonus = 0.06
    elif primary_type == "ep":
        type_bonus = 0.04

    artist_bonus = 0.18 if artist_score >= 0.85 else 0.0
    compilation_penalty = 0.35 if release_is_compilation(release) else 0.0
    official_bonus = 0.04 if normalized_text(release.get("status")) == "official" else 0.0
    date_bonus = 0.02 if release.get("date") else 0.0
    return max(
        0.0,
        min(
            1.0,
            (artist_score * 0.42)
            + (title_score * 0.34)
            + artist_bonus
            + type_bonus
            + official_bonus
            + date_bonus
            - compilation_penalty,
        ),
    )


def best_recording_match(
    recordings: list[dict[str, Any]],
    title: str,
    artist: str | None,
    current_album: object,
) -> tuple[dict[str, Any], dict[str, Any] | None, float]:
    def base_recording_score(recording: dict[str, Any]) -> float:
        try:
            mb_score = float(recording.get("score") or 0) / 100
        except (TypeError, ValueError):
            mb_score = 0.0
        return (
            text_similarity(title, recording.get("title")) * 0.48
            + (text_similarity(artist, artist_credit_phrase(recording.get("artist-credit"))) if artist else 0.5) * 0.34
            + mb_score * 0.18
        )

    best: tuple[dict[str, Any], dict[str, Any] | None, float] | None = None
    for recording in recordings:
        base_score = base_recording_score(recording)
        releases = [release for release in recording.get("releases") or [] if isinstance(release, dict)]
        if not releases:
            score = base_score * 0.72
            candidate = (recording, None, score)
            if best is None or candidate[2] > best[2]:
                best = candidate
            continue
        for release in releases:
            release_score = recording_release_score(release, title, artist, current_album)
            score = (base_score * 0.55) + (release_score * 0.45)
            candidate = (recording, release, score)
            if best is None or candidate[2] > best[2]:
                best = candidate
    if best is None:
        raise ValueError("No MusicBrainz recording match found")
    return best


def best_acoustid_recording_match(
    recordings: list[dict[str, Any]],
    artist: str | None,
    current_album: object,
) -> tuple[dict[str, Any], dict[str, Any] | None, float]:
    best: tuple[dict[str, Any], dict[str, Any] | None, float] | None = None
    for recording in recordings:
        try:
            acoustid_score = float(recording.get("_acoustid_score") or 0)
        except (TypeError, ValueError):
            acoustid_score = 0.0
        recording_artist = artist_credit_phrase(recording.get("artist-credit"))
        artist_score = text_similarity(artist, recording_artist) if artist else 0.75
        releases = [release for release in recording.get("releases") or [] if isinstance(release, dict)]
        if not releases:
            score = (acoustid_score * 0.82) + (artist_score * 0.18)
            candidate = (recording, None, score)
            if best is None or candidate[2] > best[2]:
                best = candidate
            continue
        for release in releases:
            release_score = recording_release_score(
                release,
                str(recording.get("title") or ""),
                artist or recording_artist,
                current_album,
            )
            score = (acoustid_score * 0.72) + (release_score * 0.18) + (artist_score * 0.1)
            candidate = (recording, release, score)
            if best is None or candidate[2] > best[2]:
                best = candidate
    if best is None:
        raise ValueError("No AcoustID recording match found")
    return best


def best_release_for_group(tracks: list[dict[str, Any]], candidate_limit: int) -> tuple[dict[str, Any] | None, float]:
    album = next((str(track.get("album") or "").strip() for track in tracks if str(track.get("album") or "").strip()), "")
    if not album:
        return None, 0.0
    artist = next(
        (
            str(track.get("album_artist") or track.get("artist") or "").strip()
            for track in tracks
            if str(track.get("album_artist") or track.get("artist") or "").strip()
        ),
        None,
    )
    best: tuple[dict[str, Any] | None, float] = (None, 0.0)
    for candidate in search_releases(album, artist, candidate_limit):
        release_id = str(candidate.get("id") or "")
        if not release_id:
            continue
        release = lookup_release(release_id) or candidate
        entries = release_track_entries(release)
        title_score = text_similarity(album, release.get("title"))
        artist_score = text_similarity(artist, artist_credit_phrase(release.get("artist-credit"))) if artist else 0.5
        count_score = 1.0 - min(1.0, abs(len(entries) - len(tracks)) / max(len(tracks), 1))
        try:
            mb_score = float(candidate.get("score") or 0) / 100
        except (TypeError, ValueError):
            mb_score = 0.0
        score = (title_score * 0.35) + (artist_score * 0.25) + (count_score * 0.2) + (mb_score * 0.2)
        if score > best[1]:
            best = (release, score)
    return best


def match_release_track(track: dict[str, Any], entries: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, float]:
    if not entries:
        return None, 0.0
    track_number = first_int(track.get("track_number"))
    disc_number = first_int(track.get("disc_number")) or 1
    if track_number is not None:
        for entry in entries:
            entry_disc = entry.get("disc_number") or 1
            if entry.get("track_number") == track_number and entry_disc == disc_number:
                return entry, max(0.65, text_similarity(track.get("title"), entry.get("title")))
    best = max(entries, key=lambda entry: text_similarity(track.get("title"), entry.get("title")))
    return best, text_similarity(track.get("title"), best.get("title"))


def preview_album_group(
    tracks: list[dict[str, Any]],
    missing_only: bool,
    candidate_limit: int,
    include_artwork: bool,
    acoustid_api_key: str | None = None,
) -> list[AutoTagPreview]:
    release, release_score = best_release_for_group(tracks, candidate_limit)
    if not release:
        return [
            preview_track(track, missing_only, candidate_limit, include_artwork, acoustid_api_key)
            for track in tracks
        ]

    artwork = cover_art_for_release(str(release.get("id"))) if include_artwork and release.get("id") else None
    entries = release_track_entries(release)
    previews: list[AutoTagPreview] = []
    for track in tracks:
        entry, track_score = match_release_track(track, entries)
        proposed = release_metadata(release, entry)
        if proposed.get("artist") is None:
            proposed["artist"] = proposed.get("album_artist")
        changes = metadata_changes(current_metadata(track), proposed, missing_only)
        confidence = round(max(0.0, min(1.0, (release_score * 0.7) + (track_score * 0.3))), 3)
        previews.append(
            AutoTagPreview(
                track_id=int(track["id"]),
                path=str(track["path"]),
                current=current_metadata(track),
                proposed=proposed,
                changed_fields=list(changes),
                confidence=confidence,
                match_type="album",
                release_id=release.get("id"),
                release_title=release.get("title"),
                recording_id=entry.get("recording_id") if entry else None,
                artwork_url=artwork.get("image_url") if artwork else None,
                artwork_thumbnail_url=artwork.get("thumbnail_url") if artwork else None,
            )
        )
    return previews


def preview_track(
    track: dict[str, Any],
    missing_only: bool,
    candidate_limit: int,
    include_artwork: bool,
    acoustid_api_key: str | None = None,
    fingerprint_only: bool = False,
) -> AutoTagPreview:
    current = current_metadata(track)
    artist = str(track.get("artist") or "").strip() or None
    if fingerprint_only and not str(track.get("acoustic_fingerprint") or "").strip():
        return AutoTagPreview(
            track_id=int(track["id"]),
            path=str(track["path"]),
            current=current,
            source="AcoustID + MusicBrainz",
            error="No acoustic fingerprint stored. Run Analyze Fingerprints first.",
        )
    if fingerprint_only and not (acoustid_api_key or "").strip():
        return AutoTagPreview(
            track_id=int(track["id"]),
            path=str(track["path"]),
            current=current,
            source="AcoustID + MusicBrainz",
            error="AcoustID API key is required for fingerprint-only tag lookup.",
        )

    acoustid_recordings = lookup_acoustid_recordings(
        acoustid_api_key,
        track.get("acoustic_fingerprint"),
        track.get("duration_seconds"),
        candidate_limit,
    )
    if acoustid_recordings:
        try:
            recording, release, score = best_acoustid_recording_match(acoustid_recordings, artist, track.get("album"))
            confidence = round(max(0.0, min(1.0, score)), 3)
            release = release or {}
            proposed = recording_release_metadata(recording, release)
            release_id = release.get("id")
            artwork = cover_art_for_release(str(release_id)) if include_artwork and release_id else None
            changes = metadata_changes(current_metadata(track), proposed, missing_only)
            return AutoTagPreview(
                track_id=int(track["id"]),
                path=str(track["path"]),
                current=current,
                proposed=proposed,
                changed_fields=list(changes),
                confidence=confidence,
                match_type="track",
                source="AcoustID + MusicBrainz",
                release_id=release_id,
                release_title=release.get("title"),
                recording_id=recording.get("id"),
                artwork_url=artwork.get("image_url") if artwork else None,
                artwork_thumbnail_url=artwork.get("thumbnail_url") if artwork else None,
            )
        except ValueError:
            if fingerprint_only:
                return AutoTagPreview(
                    track_id=int(track["id"]),
                    path=str(track["path"]),
                    current=current,
                    source="AcoustID + MusicBrainz",
                    error="No AcoustID recording match found for this fingerprint.",
                )

    if fingerprint_only:
        return AutoTagPreview(
            track_id=int(track["id"]),
            path=str(track["path"]),
            current=current,
            source="AcoustID + MusicBrainz",
            error="No AcoustID recording match found for this fingerprint.",
        )

    title = str(track.get("title") or Path(str(track.get("path") or "")).stem).strip()
    if not title:
        return AutoTagPreview(
            track_id=int(track["id"]),
            path=str(track["path"]),
            current=current,
            error="Track has no title to search",
        )
    recordings = search_recordings(title, artist, candidate_limit)
    if not recordings:
        return AutoTagPreview(
            track_id=int(track["id"]),
            path=str(track["path"]),
            current=current,
            error="No MusicBrainz recording match found",
        )

    try:
        recording, release, score = best_recording_match(recordings, title, artist, track.get("album"))
    except ValueError:
        return AutoTagPreview(
            track_id=int(track["id"]),
            path=str(track["path"]),
            current=current,
            error="No MusicBrainz recording match found",
        )
    confidence = round(max(0.0, min(1.0, score)), 3)
    release = release or {}
    proposed = recording_release_metadata(recording, release)
    release_id = release.get("id")
    artwork = cover_art_for_release(str(release_id)) if include_artwork and release_id else None
    changes = metadata_changes(current_metadata(track), proposed, missing_only)
    return AutoTagPreview(
        track_id=int(track["id"]),
        path=str(track["path"]),
        current=current,
        proposed=proposed,
        changed_fields=list(changes),
        confidence=confidence,
        match_type="track",
        release_id=release_id,
        release_title=release.get("title"),
        recording_id=recording.get("id"),
        artwork_url=artwork.get("image_url") if artwork else None,
        artwork_thumbnail_url=artwork.get("thumbnail_url") if artwork else None,
    )


def album_group_key(track: dict[str, Any]) -> tuple[str, str]:
    album = normalized_text(track.get("album")) or f"track:{track.get('id')}"
    artist = normalized_text(track.get("album_artist") or track.get("artist"))
    return album, artist


def preview_auto_tags(
    tracks: list[dict[str, Any]],
    mode: AutoTagMode,
    missing_only: bool,
    candidate_limit: int = 3,
    include_artwork: bool = True,
    acoustid_api_key: str | None = None,
    fingerprint_only: bool = False,
) -> list[dict[str, Any]]:
    if mode == "track" or fingerprint_only:
        return [
            preview_track(track, missing_only, candidate_limit, include_artwork, acoustid_api_key, fingerprint_only).to_dict()
            for track in tracks
        ]

    groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for track in tracks:
        groups.setdefault(album_group_key(track), []).append(track)

    previews: list[dict[str, Any]] = []
    for group_tracks in groups.values():
        previews.extend(
            preview.to_dict()
            for preview in preview_album_group(group_tracks, missing_only, candidate_limit, include_artwork, acoustid_api_key)
        )
    return previews
