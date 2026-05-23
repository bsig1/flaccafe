from __future__ import annotations

import email.utils
import mimetypes
import re
import shutil
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import request as urlrequest

from .config import EXPORT_DIR
from .database import connect, rows_to_dicts
from .library_tools import sanitize_path_component
from .scanner import file_fingerprint, file_modified_at, path_key, read_metadata, upsert_track


PODCAST_TIMEOUT_SECONDS = 20


def default_podcast_folder() -> Path:
    return EXPORT_DIR / "podcasts"


def podcast_where_clause() -> str:
    return """
    (
      lower(coalesce(tracks.genre, '')) LIKE '%podcast%'
      OR lower(tracks.path) LIKE '%podcast%'
      OR lower(tracks.path) LIKE '%\\podcasts\\%'
      OR lower(tracks.path) LIKE '%/podcasts/%'
    )
    """


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    return re.sub(r"\s+", " ", value).strip() or None


def child_text(element: ET.Element, names: tuple[str, ...]) -> str | None:
    for child in list(element):
        local = child.tag.split("}", 1)[-1].casefold()
        if local in names:
            return clean_text(child.text)
    return None


def first_link(element: ET.Element) -> str | None:
    for child in list(element):
        local = child.tag.split("}", 1)[-1].casefold()
        if local == "link":
            href = child.attrib.get("href")
            return clean_text(href or child.text)
    return None


def enclosure_url(element: ET.Element) -> str | None:
    for child in list(element):
        local = child.tag.split("}", 1)[-1].casefold()
        if local == "enclosure":
            return clean_text(child.attrib.get("url"))
        if local == "link" and child.attrib.get("rel") == "enclosure":
            return clean_text(child.attrib.get("href"))
    return None


def parse_duration(value: str | None) -> float | None:
    if not value:
        return None
    text = value.strip()
    if text.isdigit():
        return float(text)
    parts = text.split(":")
    try:
        numbers = [float(part) for part in parts]
    except ValueError:
        return None
    if len(numbers) == 3:
        return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    if len(numbers) == 2:
        return numbers[0] * 60 + numbers[1]
    return numbers[0] if numbers else None


def parse_date(value: str | None) -> str | None:
    if not value:
        return None
    parsed = email.utils.parsedate_to_datetime(value)
    if parsed is None:
        return clean_text(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def fetch_feed(feed_url: str) -> bytes:
    req = urlrequest.Request(feed_url, headers={"User-Agent": "FLAC Cafe/0.2.1 podcast module"})
    with urlrequest.urlopen(req, timeout=PODCAST_TIMEOUT_SECONDS) as response:
        return response.read()


def parse_feed(payload: bytes, feed_url: str) -> dict[str, Any]:
    root = ET.fromstring(payload)
    channel = root.find("channel")
    if channel is None:
        channel = root
    title = child_text(channel, ("title",)) or feed_url
    description = child_text(channel, ("description", "subtitle", "summary"))
    site_url = first_link(channel)
    episode_elements = channel.findall("item") or [item for item in root.findall("{*}entry")]
    episodes: list[dict[str, Any]] = []
    for index, item in enumerate(episode_elements, start=1):
        title_text = child_text(item, ("title",)) or f"Episode {index}"
        guid = child_text(item, ("guid", "id")) or enclosure_url(item) or title_text
        episodes.append(
            {
                "guid": guid,
                "title": title_text,
                "description": child_text(item, ("description", "summary", "subtitle")),
                "audio_url": enclosure_url(item),
                "published_at": parse_date(child_text(item, ("pubdate", "published", "updated"))),
                "duration_seconds": parse_duration(child_text(item, ("duration",))),
            }
        )
    return {"title": title, "description": description, "site_url": site_url, "episodes": episodes}


def row_to_subscription(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **row,
        "auto_download": bool(row["auto_download"]),
        "episode_count": int(row.get("episode_count") or 0),
        "downloaded_count": int(row.get("downloaded_count") or 0),
    }


def list_subscriptions() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                """
                SELECT podcast_subscriptions.*,
                       COUNT(podcast_episodes.id) AS episode_count,
                       SUM(CASE WHEN podcast_episodes.download_status = 'downloaded' THEN 1 ELSE 0 END) AS downloaded_count
                FROM podcast_subscriptions
                LEFT JOIN podcast_episodes ON podcast_episodes.subscription_id = podcast_subscriptions.id
                GROUP BY podcast_subscriptions.id
                ORDER BY lower(podcast_subscriptions.title)
                """
            )
        )
    return [row_to_subscription(row) for row in rows]


def upsert_subscription(request: object, subscription_id: int | None = None) -> dict[str, Any] | None:
    data = request.model_dump(mode="json") if hasattr(request, "model_dump") else dict(request)
    feed_url = str(data.get("feed_url") or "").strip()
    title = str(data.get("title") or feed_url).strip() or feed_url
    with connect() as conn:
        if subscription_id is None:
            cursor = conn.execute(
                """
                INSERT INTO podcast_subscriptions(title, feed_url, site_url, description, auto_download, download_folder)
                VALUES(?, ?, ?, ?, ?, ?)
                ON CONFLICT(feed_url) DO UPDATE SET
                  title = excluded.title,
                  site_url = excluded.site_url,
                  description = excluded.description,
                  auto_download = excluded.auto_download,
                  download_folder = excluded.download_folder,
                  updated_at = datetime('now')
                """,
                (
                    title,
                    feed_url,
                    data.get("site_url"),
                    data.get("description"),
                    1 if data.get("auto_download") else 0,
                    data.get("download_folder"),
                ),
            )
            row_id = int(cursor.lastrowid or 0)
            if row_id == 0:
                existing = conn.execute("SELECT id FROM podcast_subscriptions WHERE feed_url = ?", (feed_url,)).fetchone()
                row_id = int(existing["id"]) if existing else 0
        else:
            cursor = conn.execute(
                """
                UPDATE podcast_subscriptions
                SET title = ?, feed_url = ?, site_url = ?, description = ?, auto_download = ?,
                    download_folder = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (
                    title,
                    feed_url,
                    data.get("site_url"),
                    data.get("description"),
                    1 if data.get("auto_download") else 0,
                    data.get("download_folder"),
                    subscription_id,
                ),
            )
            if cursor.rowcount == 0:
                return None
            row_id = subscription_id
        conn.commit()
        row = conn.execute("SELECT *, 0 AS episode_count, 0 AS downloaded_count FROM podcast_subscriptions WHERE id = ?", (row_id,)).fetchone()
    return row_to_subscription(dict(row)) if row else None


def delete_subscription(subscription_id: int) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM podcast_subscriptions WHERE id = ?", (subscription_id,))
        conn.commit()
        return cursor.rowcount > 0


def refresh_subscription(subscription_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM podcast_subscriptions WHERE id = ?", (subscription_id,)).fetchone()
        if row is None:
            return None
        subscription = dict(row)
    feed = parse_feed(fetch_feed(subscription["feed_url"]), subscription["feed_url"])
    title = feed["title"] or subscription["title"]
    with connect() as conn:
        conn.execute(
            """
            UPDATE podcast_subscriptions
            SET title = ?, site_url = ?, description = ?, last_checked_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?
            """,
            (title, feed.get("site_url"), feed.get("description"), subscription_id),
        )
        inserted = 0
        updated = 0
        for episode in feed["episodes"]:
            cursor = conn.execute(
                """
                INSERT INTO podcast_episodes(subscription_id, guid, title, description, audio_url, published_at, duration_seconds)
                VALUES(?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(subscription_id, guid) DO UPDATE SET
                  title = excluded.title,
                  description = excluded.description,
                  audio_url = excluded.audio_url,
                  published_at = excluded.published_at,
                  duration_seconds = excluded.duration_seconds,
                  updated_at = datetime('now')
                """,
                (
                    subscription_id,
                    episode["guid"],
                    episode["title"],
                    episode.get("description"),
                    episode.get("audio_url"),
                    episode.get("published_at"),
                    episode.get("duration_seconds"),
                ),
            )
            if cursor.lastrowid:
                inserted += 1
            else:
                updated += 1
        conn.commit()
    return {
        "subscription": next(item for item in list_subscriptions() if item["id"] == subscription_id),
        "inserted": inserted,
        "updated": updated,
        "total": len(feed["episodes"]),
    }


def list_episodes(subscription_id: int | None, limit: int) -> list[dict[str, Any]]:
    params: list[Any] = []
    where = ""
    if subscription_id:
        where = "WHERE subscription_id = ?"
        params.append(subscription_id)
    params.append(limit)
    with connect() as conn:
        return rows_to_dicts(
            conn.execute(
                f"""
                SELECT podcast_episodes.*, podcast_subscriptions.title AS subscription_title
                FROM podcast_episodes
                JOIN podcast_subscriptions ON podcast_subscriptions.id = podcast_episodes.subscription_id
                {where}
                ORDER BY coalesce(podcast_episodes.published_at, podcast_episodes.created_at) DESC, podcast_episodes.id DESC
                LIMIT ?
                """,
                params,
            )
        )


def episode_with_subscription(conn, episode_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT podcast_episodes.*, podcast_subscriptions.title AS subscription_title,
               podcast_subscriptions.download_folder AS subscription_download_folder
        FROM podcast_episodes
        JOIN podcast_subscriptions ON podcast_subscriptions.id = podcast_episodes.subscription_id
        WHERE podcast_episodes.id = ?
        """,
        (episode_id,),
    ).fetchone()
    return dict(row) if row else None


def episode_extension(audio_url: str | None) -> str:
    if not audio_url:
        return ".mp3"
    guess, _encoding = mimetypes.guess_type(audio_url.split("?", 1)[0])
    ext = mimetypes.guess_extension(guess or "") if guess else None
    return ext or Path(audio_url.split("?", 1)[0]).suffix or ".mp3"


def podcast_track_metadata(path: Path, episode: dict[str, Any]) -> dict[str, Any]:
    try:
        metadata = read_metadata(path)
    except Exception:
        metadata = {
            "path": str(path.resolve()),
            "path_key": path_key(path),
            "title": episode.get("title") or path.stem,
            "artist": episode.get("subscription_title"),
            "album": episode.get("subscription_title"),
            "album_artist": episode.get("subscription_title"),
            "track_number": None,
            "disc_number": None,
            "genre": "Podcast",
            "year": None,
            "duration_seconds": episode.get("duration_seconds"),
            "bitrate": None,
            "replaygain_track_gain_db": None,
            "replaygain_album_gain_db": None,
            "replaygain_track_peak": None,
            "replaygain_album_peak": None,
            "audio_fingerprint": file_fingerprint(path),
            "rating": None,
            "file_modified_at": file_modified_at(path),
        }

    metadata["title"] = metadata.get("title") or episode.get("title") or path.stem
    metadata["artist"] = metadata.get("artist") or episode.get("subscription_title")
    metadata["album"] = metadata.get("album") or episode.get("subscription_title")
    metadata["album_artist"] = metadata.get("album_artist") or episode.get("subscription_title")
    metadata["genre"] = "Podcast"
    metadata["duration_seconds"] = metadata.get("duration_seconds") or episode.get("duration_seconds")
    return metadata


def ensure_episode_track(episode_id: int) -> int | None:
    with connect() as conn:
        episode = episode_with_subscription(conn, episode_id)
        if episode is None:
            return None
        if episode.get("track_id"):
            track = conn.execute("SELECT id FROM tracks WHERE id = ?", (episode["track_id"],)).fetchone()
            if track is not None:
                return int(track["id"])
        if not episode.get("local_path"):
            raise ValueError("Download the episode before adding it to the local collection")

        path = Path(episode["local_path"]).expanduser()
        if not path.exists() or not path.is_file():
            raise ValueError("Downloaded podcast file is missing")

        metadata = podcast_track_metadata(path, episode)
        upsert_track(conn, metadata)
        row = conn.execute("SELECT id FROM tracks WHERE path_key = ?", (metadata["path_key"],)).fetchone()
        if row is None:
            raise ValueError("Could not add podcast episode to the local collection")
        track_id = int(row["id"])
        conn.execute(
            "UPDATE podcast_episodes SET track_id = ?, updated_at = datetime('now') WHERE id = ?",
            (track_id, episode_id),
        )
        conn.commit()
        return track_id


def download_episode(episode_id: int, download_folder: str | None = None) -> dict[str, Any] | None:
    with connect() as conn:
        episode = episode_with_subscription(conn, episode_id)
        if episode is None:
            return None
    if not episode.get("audio_url"):
        raise ValueError("Episode has no downloadable audio URL")
    folder = Path(download_folder or episode.get("subscription_download_folder") or default_podcast_folder()).expanduser()
    resolved_folder = folder.resolve()
    using_default_folder = resolved_folder == default_podcast_folder().resolve()
    target = folder / sanitize_path_component(episode["subscription_title"]) / f"{sanitize_path_component(episode['title'])}{episode_extension(episode.get('audio_url'))}"
    target.parent.mkdir(parents=True, exist_ok=True)
    req = urlrequest.Request(episode["audio_url"], headers={"User-Agent": "FLAC Cafe/0.2.1 podcast downloader"})
    with urlrequest.urlopen(req, timeout=PODCAST_TIMEOUT_SECONDS) as response, target.open("wb") as handle:
        shutil.copyfileobj(response, handle)
    with connect() as conn:
        conn.execute(
            """
            UPDATE podcast_episodes
            SET local_path = ?, download_status = 'downloaded', downloaded_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?
            """,
            (str(target), episode_id),
        )
        conn.commit()
    if using_default_folder:
        ensure_episode_track(episode_id)
    with connect() as conn:
        return episode_with_subscription(conn, episode_id)
