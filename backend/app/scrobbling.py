from __future__ import annotations

import csv
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any
from urllib import parse, request as urlrequest

from .database import connect, rows_to_dicts


LISTENBRAINZ_SUBMIT_URL = "https://api.listenbrainz.org/1/submit-listens"
LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/"
LASTFM_AUTH_URL = "https://www.last.fm/api/auth/"


def account_row(service: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM scrobble_accounts WHERE service = ?", (service,)).fetchone()
    return dict(row) if row else {"service": service, "enabled": 0, "username": None, "token": None, "api_key": None, "api_secret": None, "session_key": None, "updated_at": None}


def list_accounts() -> list[dict[str, Any]]:
    return [account_row("listenbrainz"), account_row("lastfm")]


def save_account(service: str, request: object) -> dict[str, Any]:
    data = request.model_dump(mode="json", exclude_unset=True) if hasattr(request, "model_dump") else dict(request)
    existing = account_row(service)

    def merged_text(field: str) -> Any:
        return data[field] if field in data else existing.get(field)

    enabled = data.get("enabled")
    if enabled is None:
        enabled = bool(existing.get("enabled"))

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO scrobble_accounts(service, enabled, username, token, api_key, api_secret, session_key, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(service) DO UPDATE SET
              enabled = excluded.enabled,
              username = excluded.username,
              token = excluded.token,
              api_key = excluded.api_key,
              api_secret = excluded.api_secret,
              session_key = excluded.session_key,
              updated_at = datetime('now')
            """,
            (
                service,
                1 if enabled else 0,
                merged_text("username"),
                merged_text("token"),
                merged_text("api_key"),
                merged_text("api_secret"),
                merged_text("session_key"),
            ),
        )
        conn.commit()
    return account_row(service)


def queue_history(service: str, limit: int) -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                """
                SELECT play_events.id AS event_id, play_events.timestamp, tracks.id AS track_id,
                       tracks.title, tracks.artist, tracks.album, tracks.album_artist
                FROM play_events
                JOIN tracks ON tracks.id = play_events.track_id
                WHERE play_events.event_type = 'played'
                  AND coalesce(tracks.artist, '') != ''
                  AND coalesce(tracks.title, '') != ''
                ORDER BY play_events.timestamp DESC
                LIMIT ?
                """,
                (limit,),
            )
        )
        inserted = 0
        for row in rows:
            timestamp = parse_timestamp(row["timestamp"])
            cursor = conn.execute(
                """
                INSERT INTO scrobble_outbox(
                  service, track_id, event_type, artist, title, album, album_artist, listened_at
                )
                SELECT ?, ?, 'played', ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM scrobble_outbox
                  WHERE service = ? AND track_id = ? AND event_type = 'played' AND listened_at = ?
                )
                """,
                (
                    service,
                    row["track_id"],
                    row["artist"],
                    row["title"],
                    row["album"],
                    row["album_artist"],
                    timestamp,
                    service,
                    row["track_id"],
                    timestamp,
                ),
            )
            inserted += cursor.rowcount
        conn.commit()
    return {"queued": inserted, "considered": len(rows)}


def parse_timestamp(value: str | None) -> int:
    if not value:
        return int(time.time())
    text = value.replace("Z", "+00:00")
    try:
        from datetime import datetime

        return int(datetime.fromisoformat(text).timestamp())
    except ValueError:
        return int(time.time())


def outbox(limit: int) -> list[dict[str, Any]]:
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                """
                SELECT *
                FROM scrobble_outbox
                ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END,
                         created_at DESC
                LIMIT ?
                """,
                (limit,),
            )
        )


def listenbrainz_payload(rows: list[dict[str, Any]]) -> dict[str, Any]:
    payload = []
    for row in rows:
        payload.append(
            {
                "listened_at": int(row["listened_at"] or time.time()),
                "track_metadata": {
                    "artist_name": row["artist"],
                    "track_name": row["title"],
                    "release_name": row.get("album"),
                    "additional_info": {
                        "submission_client": "FLAC Cafe",
                        "media_player": "FLAC Cafe",
                        "music_service": "local files",
                    },
                },
            }
        )
    return {"listen_type": "import", "payload": payload}


def post_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> None:
    req = urlrequest.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urlrequest.urlopen(req, timeout=15) as response:
        if response.status >= 400:
            raise RuntimeError(f"HTTP {response.status}")


def lastfm_signature(params: dict[str, Any], secret: str) -> str:
    pieces = []
    for key in sorted(k for k in params if k not in {"format", "callback"}):
        pieces.append(f"{key}{params[key]}")
    pieces.append(secret)
    return hashlib.md5("".join(pieces).encode("utf-8")).hexdigest()


def clean_secret(value: Any) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


def configured_lastfm_credentials() -> tuple[str | None, str | None]:
    return (
        clean_secret(os.environ.get("FLAC_CAFE_LASTFM_API_KEY") or os.environ.get("LASTFM_API_KEY")),
        clean_secret(os.environ.get("FLAC_CAFE_LASTFM_API_SECRET") or os.environ.get("LASTFM_API_SECRET")),
    )


def resolve_lastfm_credentials(api_key: str | None = None, api_secret: str | None = None) -> tuple[str, str]:
    # Last.fm browser auth still needs application credentials. Packaged builds can
    # provide them through FLAC_CAFE_LASTFM_* so users only see the browser flow;
    # dev builds can fall back to saved or manually entered credentials.
    explicit_key = clean_secret(api_key)
    explicit_secret = clean_secret(api_secret)
    if explicit_key and explicit_secret:
        return explicit_key, explicit_secret

    configured_key, configured_secret = configured_lastfm_credentials()
    if configured_key and configured_secret:
        return configured_key, configured_secret

    saved = account_row("lastfm")
    saved_key = clean_secret(saved.get("api_key"))
    saved_secret = clean_secret(saved.get("api_secret"))
    if saved_key and saved_secret:
        return saved_key, saved_secret

    raise RuntimeError(
        "Last.fm app credentials are not configured for this build. "
        "Set FLAC_CAFE_LASTFM_API_KEY and FLAC_CAFE_LASTFM_API_SECRET, "
        "or add your Last.fm API key and shared secret in Settings -> API Keys."
    )


def post_form(url: str, params: dict[str, Any]) -> None:
    req = urlrequest.Request(
        url,
        data=parse.urlencode(params).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlrequest.urlopen(req, timeout=15) as response:
        if response.status >= 400:
            raise RuntimeError(f"HTTP {response.status}")


def lastfm_api_post(params: dict[str, Any]) -> dict[str, Any]:
    req = urlrequest.Request(
        LASTFM_API_URL,
        data=parse.urlencode(params).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlrequest.urlopen(req, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if isinstance(payload, dict) and payload.get("error"):
        raise RuntimeError(str(payload.get("message") or f"Last.fm error {payload.get('error')}"))
    if not isinstance(payload, dict):
        raise RuntimeError("Last.fm returned an unexpected response")
    return payload


def start_lastfm_login(api_key: str | None = None, api_secret: str | None = None) -> dict[str, Any]:
    key, secret = resolve_lastfm_credentials(api_key, api_secret)
    params: dict[str, Any] = {
        "method": "auth.getToken",
        "api_key": key,
        "format": "json",
    }
    params["api_sig"] = lastfm_signature(params, secret)
    payload = lastfm_api_post(params)
    token = str(payload.get("token") or "").strip()
    if not token:
        raise RuntimeError("Last.fm did not return an auth token")
    return {
        "token": token,
        "auth_url": f"{LASTFM_AUTH_URL}?{parse.urlencode({'api_key': key, 'token': token})}",
    }


def complete_lastfm_login(api_key: str | None, api_secret: str | None, token: str, enabled: bool = True) -> dict[str, Any]:
    key, secret = resolve_lastfm_credentials(api_key, api_secret)
    cleaned_token = token.strip()
    if not cleaned_token:
        raise RuntimeError("Last.fm approved token is required")
    params: dict[str, Any] = {
        "method": "auth.getSession",
        "api_key": key,
        "token": cleaned_token,
        "format": "json",
    }
    params["api_sig"] = lastfm_signature(params, secret)
    payload = lastfm_api_post(params)
    session = payload.get("session") if isinstance(payload.get("session"), dict) else {}
    session_key = str(session.get("key") or "").strip()
    username = str(session.get("name") or "").strip() or None
    if not session_key:
        raise RuntimeError("Last.fm did not return a session key")
    return save_account(
        "lastfm",
        {
            "enabled": enabled,
            "username": username,
            "api_key": key,
            "api_secret": secret,
            "session_key": session_key,
        },
    )


def submit_listenbrainz(rows: list[dict[str, Any]], account: dict[str, Any]) -> None:
    token = account.get("token")
    if not token:
        raise RuntimeError("ListenBrainz token is missing")
    post_json(LISTENBRAINZ_SUBMIT_URL, listenbrainz_payload(rows), {"Authorization": f"Token {token}"})


def submit_lastfm(row: dict[str, Any], account: dict[str, Any]) -> None:
    api_key = account.get("api_key")
    api_secret = account.get("api_secret")
    session_key = account.get("session_key")
    if not api_key or not api_secret or not session_key:
        raise RuntimeError("Last.fm API key, shared secret, and session key are required")
    method = "track.love" if row["event_type"] == "loved" else "track.scrobble"
    params: dict[str, Any] = {
        "method": method,
        "api_key": api_key,
        "sk": session_key,
        "artist": row["artist"],
        "track": row["title"],
        "format": "json",
    }
    if row["event_type"] == "played":
        params["timestamp"] = int(row["listened_at"] or time.time())
        if row.get("album"):
            params["album"] = row["album"]
        if row.get("album_artist"):
            params["albumArtist"] = row["album_artist"]
    params["api_sig"] = lastfm_signature(params, api_secret)
    post_form(LASTFM_API_URL, params)


def mark_submitted(row_ids: list[int]) -> None:
    with connect() as conn:
        conn.executemany(
            """
            UPDATE scrobble_outbox
            SET status = 'submitted', attempts = attempts + 1, last_error = NULL, submitted_at = datetime('now')
            WHERE id = ?
            """,
            [(row_id,) for row_id in row_ids],
        )
        conn.commit()


def mark_failed(row_ids: list[int], error: str) -> None:
    with connect() as conn:
        conn.executemany(
            """
            UPDATE scrobble_outbox
            SET status = 'failed', attempts = attempts + 1, last_error = ?
            WHERE id = ?
            """,
            [(error[:500], row_id) for row_id in row_ids],
        )
        conn.commit()


def submit_outbox(service: str, limit: int) -> dict[str, Any]:
    account = account_row(service)
    if not account.get("enabled"):
        raise RuntimeError(f"{service} scrobbling is not enabled")
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                """
                SELECT *
                FROM scrobble_outbox
                WHERE service = ? AND status IN ('pending', 'failed')
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (service, limit),
            )
        )
    submitted = 0
    failed = 0
    errors: list[str] = []
    if service == "listenbrainz":
        playable = [row for row in rows if row["event_type"] == "played"]
        if playable:
            ids = [int(row["id"]) for row in playable]
            try:
                submit_listenbrainz(playable, account)
                mark_submitted(ids)
                submitted += len(ids)
            except Exception as exc:
                mark_failed(ids, str(exc))
                failed += len(ids)
                errors.append(str(exc))
    else:
        for row in rows:
            try:
                submit_lastfm(row, account)
                mark_submitted([int(row["id"])])
                submitted += 1
            except Exception as exc:
                mark_failed([int(row["id"])], str(exc))
                failed += 1
                errors.append(str(exc))
    return {"submitted": submitted, "failed": failed, "errors": errors[:10]}


def set_loved(track_id: int, loved: bool, source: str = "local") -> dict[str, Any] | None:
    with connect() as conn:
        track = conn.execute("SELECT id, artist, title, album, album_artist FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if track is None:
            return None
        conn.execute(
            """
            INSERT INTO track_loves(track_id, loved, source, updated_at)
            VALUES(?, ?, ?, datetime('now'))
            ON CONFLICT(track_id) DO UPDATE SET loved = excluded.loved, source = excluded.source, updated_at = datetime('now')
            """,
            (track_id, 1 if loved else 0, source),
        )
        if loved and track["artist"] and track["title"]:
            conn.execute(
                """
                INSERT INTO scrobble_outbox(service, track_id, event_type, artist, title, album, album_artist, listened_at)
                VALUES('lastfm', ?, 'loved', ?, ?, ?, ?, ?)
                """,
                (track_id, track["artist"], track["title"], track["album"], track["album_artist"], int(time.time())),
            )
        conn.commit()
        row = conn.execute("SELECT * FROM track_loves WHERE track_id = ?", (track_id,)).fetchone()
    return dict(row) if row else None


def loved_tracks(limit: int) -> list[dict[str, Any]]:
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                """
                SELECT track_loves.track_id, track_loves.loved, track_loves.source, track_loves.updated_at,
                       tracks.title, tracks.artist, tracks.album
                FROM track_loves
                JOIN tracks ON tracks.id = track_loves.track_id
                WHERE track_loves.loved = 1
                ORDER BY track_loves.updated_at DESC
                LIMIT ?
                """,
                (limit,),
            )
        )


def import_history_csv(path: str, apply: bool, limit: int) -> dict[str, Any]:
    csv_path = Path(path).expanduser()
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    previews: list[dict[str, Any]] = []
    updated = 0
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, start=1):
            if index > limit:
                break
            artist = row.get("artist") or row.get("Artist")
            title = row.get("title") or row.get("Title") or row.get("track") or row.get("Track")
            if not artist or not title:
                previews.append({"row": index, "matched": False, "error": "artist/title required"})
                continue
            with connect() as conn:
                track = conn.execute(
                    """
                    SELECT id, play_count, rating
                    FROM tracks
                    WHERE lower(coalesce(artist, '')) = lower(?) AND lower(coalesce(title, '')) = lower(?)
                    ORDER BY id
                    LIMIT 1
                    """,
                    (artist, title),
                ).fetchone()
                if track is None:
                    previews.append({"row": index, "matched": False, "artist": artist, "title": title})
                    continue
                changes: dict[str, Any] = {}
                if row.get("play_count"):
                    changes["play_count"] = int(float(row["play_count"]))
                if row.get("rating"):
                    changes["rating"] = float(row["rating"])
                if row.get("loved", "").strip().lower() in {"1", "true", "yes", "love", "loved"}:
                    changes["loved"] = True
                if apply and changes:
                    if "play_count" in changes or "rating" in changes:
                        conn.execute(
                            """
                            UPDATE tracks
                            SET play_count = coalesce(?, play_count),
                                rating = coalesce(?, rating),
                                updated_at = datetime('now')
                            WHERE id = ?
                            """,
                            (changes.get("play_count"), changes.get("rating"), track["id"]),
                        )
                    if changes.get("loved"):
                        conn.execute(
                            """
                            INSERT INTO track_loves(track_id, loved, source, updated_at)
                            VALUES(?, 1, 'history-import', datetime('now'))
                            ON CONFLICT(track_id) DO UPDATE SET loved = 1, source = 'history-import', updated_at = datetime('now')
                            """,
                            (track["id"],),
                        )
                    conn.commit()
                    updated += 1
                previews.append({"row": index, "matched": True, "track_id": track["id"], "changes": changes})
    return {"total": len(previews), "updated": updated, "previews": previews}
