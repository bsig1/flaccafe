from __future__ import annotations

import csv
import os
import json
import plistlib
import subprocess
import tempfile
import time
import unittest
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.database import connect, init_db, set_setting
from backend.app.extensions import discover_extensions
from backend.app.main import app, fetch_artist_info_from_wikipedia, recent_backend_error_summary, recommendation_drift
from backend.app.scanner import ScanStats, file_fingerprint, file_modified_at, path_key


def insert_track(path: Path, **overrides: object) -> int:
    values = {
        "path": str(path),
        "path_key": path_key(path),
        "title": overrides.get("title", path.stem),
        "artist": overrides.get("artist", "API Artist"),
        "album": overrides.get("album", "API Album"),
        "album_artist": overrides.get("album_artist", "API Artist"),
        "album_id": overrides.get("album_id"),
        "track_number": overrides.get("track_number"),
        "disc_number": overrides.get("disc_number"),
        "genre": overrides.get("genre", "Rock"),
        "year": overrides.get("year", 2024),
        "duration_seconds": overrides.get("duration_seconds", 180.0),
        "bitrate": overrides.get("bitrate"),
        "audio_fingerprint": overrides.get("audio_fingerprint"),
        "acoustic_fingerprint": overrides.get("acoustic_fingerprint"),
        "analysis_embedding": overrides.get("analysis_embedding"),
        "rating": overrides.get("rating"),
    }
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO tracks(
              path, path_key, title, artist, album, album_artist, album_id, track_number, disc_number, genre, year,
              duration_seconds, bitrate, audio_fingerprint, acoustic_fingerprint, analysis_embedding, rating, updated_at
            )
            VALUES(
              :path, :path_key, :title, :artist, :album, :album_artist, :album_id, :track_number, :disc_number, :genre,
              :year, :duration_seconds, :bitrate, :audio_fingerprint, :acoustic_fingerprint, :analysis_embedding, :rating, datetime('now')
            )
            """,
            values,
        )
        conn.commit()
        return int(cursor.lastrowid)


def canonical_path(path: str | Path) -> Path:
    """Normalize Windows short/long temp paths before comparing test paths."""
    return Path(path).expanduser().resolve(strict=False)


class ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        os.environ["MUSIC_REC_DB"] = str(self.root / "music.sqlite3")
        init_db()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        os.environ.pop("MUSIC_REC_DB", None)
        self.temp_dir.cleanup()

    def test_health_settings_and_diagnostics_endpoints(self) -> None:
        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["status"], "ok")

        settings = self.client.get("/settings")
        self.assertEqual(settings.status_code, 200)
        self.assertTrue(settings.json()["database_path"].endswith("music.sqlite3"))

        diagnostics = self.client.get("/diagnostics/startup")
        self.assertEqual(diagnostics.status_code, 200)
        self.assertIn("items", diagnostics.json())

    def test_reset_local_data_requires_confirmation_and_keeps_backup(self) -> None:
        track_id = insert_track(self.root / "song.flac", title="Reset Me")
        lyrics_dir = self.root / "lyrics"
        lyrics_dir.mkdir(parents=True, exist_ok=True)
        (lyrics_dir / f"{track_id}.lrc").write_text("[00:01.00]Reset", encoding="utf-8")
        with connect() as conn:
            set_setting(conn, "library_path", str(self.root / "Music"))
            conn.commit()

        rejected = self.client.post("/settings/reset-local-data", json={"confirmation": "nope"})
        self.assertEqual(rejected.status_code, 400)
        with connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM tracks").fetchone()[0], 1)

        response = self.client.post("/settings/reset-local-data", json={"confirmation": "RESET"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["reset"])
        self.assertTrue(Path(body["backup_path"]).exists())
        self.assertTrue(Path(body["database_path"]).exists())
        self.assertFalse(lyrics_dir.exists())
        with connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM tracks").fetchone()[0], 0)
            self.assertIsNone(conn.execute("SELECT value FROM settings WHERE key = 'library_path'").fetchone())

    def test_settings_can_store_and_clear_acoustid_key_without_returning_secret(self) -> None:
        saved = self.client.patch("/settings", json={"acoustid_api_key": "client-key-123"})
        self.assertEqual(saved.status_code, 200)
        self.assertTrue(saved.json()["acoustid_api_key_configured"])
        self.assertNotIn("client-key-123", json.dumps(saved.json()))
        with connect() as conn:
            self.assertEqual(conn.execute("SELECT value FROM settings WHERE key = 'acoustid_api_key'").fetchone()["value"], "client-key-123")

        cleared = self.client.patch("/settings", json={"clear_acoustid_api_key": True})
        self.assertEqual(cleared.status_code, 200)
        self.assertFalse(cleared.json()["acoustid_api_key_configured"])

    def test_settings_can_store_lastfm_credentials_without_returning_secrets(self) -> None:
        saved = self.client.patch(
            "/settings",
            json={"lastfm_api_key": "lastfm-key", "lastfm_api_secret": "lastfm-secret"},
        )

        self.assertEqual(saved.status_code, 200)
        self.assertTrue(saved.json()["lastfm_api_credentials_configured"])
        self.assertEqual(saved.json()["lastfm_api_credentials_source"], "saved")
        self.assertNotIn("lastfm-key", json.dumps(saved.json()))
        self.assertNotIn("lastfm-secret", json.dumps(saved.json()))
        with connect() as conn:
            row = conn.execute("SELECT api_key, api_secret FROM scrobble_accounts WHERE service = 'lastfm'").fetchone()
        self.assertEqual(row["api_key"], "lastfm-key")
        self.assertEqual(row["api_secret"], "lastfm-secret")

        cleared = self.client.patch("/settings", json={"clear_lastfm_api_credentials": True})
        self.assertEqual(cleared.status_code, 200)
        self.assertFalse(cleared.json()["lastfm_api_credentials_configured"])

    def test_recent_backend_errors_ignores_windows_connection_reset_noise(self) -> None:
        log_path = self.root / "backend.log"
        log_path.write_text(
            "\n".join(
                [
                    "2026-05-24 09:01:45,843 ERROR asyncio: Exception in callback _ProactorBasePipeTransport._call_connection_lost(None)",
                    "handle: <Handle _ProactorBasePipeTransport._call_connection_lost(None)>",
                    "Traceback (most recent call last):",
                    "  File \"C:\\Program Files\\Python312\\Lib\\asyncio\\events.py\", line 84, in _run",
                    "ConnectionResetError: [WinError 10054] An existing connection was forcibly closed by the remote host",
                ]
            ),
            encoding="utf-8",
        )

        self.assertIsNone(recent_backend_error_summary(log_path=log_path))

    def test_recent_backend_errors_keeps_actionable_tracebacks(self) -> None:
        log_path = self.root / "backend.log"
        log_path.write_text(
            "\n".join(
                [
                    "2026-05-24 09:01:45,843 ERROR flac_cafe.backend: Something failed",
                    "Traceback (most recent call last):",
                    "RuntimeError: real problem",
                ]
            ),
            encoding="utf-8",
        )

        summary = recent_backend_error_summary(log_path=log_path)
        self.assertIsNotNone(summary)
        self.assertIn("Something failed", summary or "")

    def test_support_bundle_endpoint_creates_zip(self) -> None:
        response = self.client.post("/diagnostics/support-bundle")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertGreaterEqual(body["file_count"], 3)
        bundle_path = Path(body["bundle_path"])
        self.assertTrue(bundle_path.exists())
        bundle_path.unlink(missing_ok=True)

    def test_support_bundle_includes_redacted_scan_error_sample(self) -> None:
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO scan_error_samples(path_hash, folder_hash, extension, message)
                VALUES('pathhash', 'folderhash', '.flac', 'synthetic scan failure')
                """
            )
            conn.commit()

        response = self.client.post("/diagnostics/support-bundle")

        self.assertEqual(response.status_code, 200)
        bundle_path = Path(response.json()["bundle_path"])
        with zipfile.ZipFile(bundle_path) as archive:
            payload = json.loads(archive.read("scan-errors.sample.redacted.json"))
        self.assertEqual(payload[0]["path_hash"], "pathhash")
        self.assertEqual(payload[0]["message"], "synthetic scan failure")
        self.assertNotIn(str(self.root), json.dumps(payload))
        bundle_path.unlink(missing_ok=True)

    def test_default_track_page_cache_is_saved_and_invalidated_by_rating(self) -> None:
        first_id = insert_track(self.root / "first.mp3", title="First", artist="Alpha", rating=3)
        insert_track(self.root / "second.mp3", title="Second", artist="Beta", rating=4)

        first_page = self.client.get("/tracks/page?limit=150&offset=0&sort_by=artist&sort_direction=asc")
        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(first_page.json()["total"], 2)

        with connect() as conn:
            cache_rows = conn.execute("SELECT cache_key, total, payload_json FROM library_query_cache").fetchall()
        cache_by_key = {row["cache_key"]: row for row in cache_rows}
        self.assertEqual(cache_by_key["tracks.default-count.v1"]["total"], 2)
        self.assertEqual(len(json.loads(cache_by_key["tracks.default-page.v1:150"]["payload_json"])), 2)

        updated = self.client.patch(f"/tracks/{first_id}/rating", json={"rating": 4.5})
        self.assertEqual(updated.status_code, 200)
        with connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) AS count FROM library_query_cache").fetchone()["count"], 0)

        second_page = self.client.get("/tracks/page?limit=150&offset=0&sort_by=artist&sort_direction=asc")
        self.assertEqual(second_page.status_code, 200)
        self.assertEqual(second_page.json()["tracks"][0]["rating"], 4.5)
        with connect() as conn:
            self.assertGreater(conn.execute("SELECT count(*) AS count FROM library_query_cache").fetchone()["count"], 0)

    def test_tracks_batch_restores_tracks_in_requested_order(self) -> None:
        first_id = insert_track(self.root / "first.mp3", title="First", artist="Alpha")
        second_id = insert_track(self.root / "second.mp3", title="Second", artist="Beta")

        response = self.client.post("/tracks/batch", json={"track_ids": [second_id, first_id, second_id, 99999, -5]})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual([track["id"] for track in body["tracks"]], [second_id, first_id])
        self.assertEqual(body["missing_ids"], [99999])

    def test_scan_endpoint_rejects_missing_folder(self) -> None:
        response = self.client.post("/scan", json={"folder_path": str(self.root / "Missing")})

        self.assertEqual(response.status_code, 400)

    def test_scan_endpoint_accepts_multiple_library_folders(self) -> None:
        folder_a = self.root / "Music A"
        folder_b = self.root / "Music B"
        folder_a.mkdir()
        folder_b.mkdir()

        def fake_scan(folder_path: str) -> ScanStats:
            folder = Path(folder_path)
            return ScanStats(
                folder_path=str(folder),
                scanned_files=2 if folder == folder_a.resolve() else 3,
                inserted=1,
                updated=1,
            )

        with patch("backend.app.main.scan_folder", side_effect=fake_scan) as scan_folder:
            response = self.client.post(
                "/scan",
                json={
                    "folder_path": str(folder_a),
                    "folder_paths": [str(folder_a), str(folder_b)],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["folder_paths"], [str(folder_a.resolve()), str(folder_b.resolve())])
        self.assertEqual(body["scanned_files"], 5)
        self.assertEqual(body["inserted"], 2)
        self.assertEqual(body["updated"], 2)
        self.assertEqual(scan_folder.call_count, 2)

        settings = self.client.get("/settings")
        self.assertEqual(settings.status_code, 200)
        self.assertEqual(settings.json()["library_paths"], [str(folder_a.resolve()), str(folder_b.resolve())])

    def test_remove_library_source_removes_tracks_but_keeps_files(self) -> None:
        folder_a = self.root / "Music A"
        folder_b = self.root / "Music B"
        folder_a.mkdir()
        folder_b.mkdir()
        removed_file = folder_a / "remove-me.mp3"
        nested_removed_file = folder_a / "Disc 1" / "remove-me-too.flac"
        kept_file = folder_b / "keep-me.mp3"
        nested_removed_file.parent.mkdir()
        for audio_file in [removed_file, nested_removed_file, kept_file]:
            audio_file.write_bytes(b"audio")

        removed_id = insert_track(removed_file)
        nested_removed_id = insert_track(nested_removed_file)
        kept_id = insert_track(kept_file)
        with connect() as conn:
            set_setting(conn, "library_path", str(folder_a.resolve()))
            set_setting(conn, "library_paths_json", json.dumps([str(folder_a.resolve()), str(folder_b.resolve())]))
            for audio_file in [removed_file, nested_removed_file, kept_file]:
                conn.execute(
                    """
                    INSERT INTO track_metadata_cache(path_key, path, file_modified_at, file_size, metadata_json)
                    VALUES(?, ?, 'now', ?, '{}')
                    """,
                    (path_key(audio_file), str(audio_file), audio_file.stat().st_size),
                )
                conn.execute(
                    """
                    INSERT INTO artwork_cache(path_key, path, file_modified_at, file_size, media_type, data)
                    VALUES(?, ?, 'now', ?, 'image/jpeg', ?)
                    """,
                    (path_key(audio_file), str(audio_file), audio_file.stat().st_size, b"art"),
                )
            conn.commit()

        response = self.client.post("/settings/library-sources/remove", json={"path": str(folder_a)})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["removed_tracks"], 2)
        self.assertEqual(body["removed_metadata_cache"], 2)
        self.assertEqual(body["removed_artwork_cache"], 2)
        self.assertEqual(body["library_paths"], [str(folder_b.resolve())])
        self.assertTrue(removed_file.exists())
        self.assertTrue(nested_removed_file.exists())
        self.assertTrue(kept_file.exists())
        with connect() as conn:
            removed_rows = conn.execute(
                "SELECT id FROM tracks WHERE id IN (?, ?)",
                (removed_id, nested_removed_id),
            ).fetchall()
            kept_row = conn.execute("SELECT id FROM tracks WHERE id = ?", (kept_id,)).fetchone()
            removed_cache = conn.execute(
                "SELECT path_key FROM track_metadata_cache WHERE path_key IN (?, ?)",
                (path_key(removed_file), path_key(nested_removed_file)),
            ).fetchall()
            kept_cache = conn.execute(
                "SELECT path_key FROM track_metadata_cache WHERE path_key = ?",
                (path_key(kept_file),),
            ).fetchone()
        self.assertEqual(removed_rows, [])
        self.assertIsNotNone(kept_row)
        self.assertEqual(removed_cache, [])
        self.assertIsNotNone(kept_cache)

    def test_rating_endpoint_updates_track(self) -> None:
        audio_file = self.root / "rated.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        response = self.client.patch(f"/tracks/{track_id}/rating", json={"rating": 4.5})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rating"], 4.5)

    def test_metadata_endpoint_updates_library_row(self) -> None:
        audio_file = self.root / "metadata.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, album="Old Album")

        response = self.client.patch(
            f"/tracks/{track_id}/metadata",
            json={"title": "New Title", "album": "New Album", "year": 2025},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["title"], "New Title")
        self.assertEqual(body["album"], "New Album")
        self.assertEqual(body["year"], 2025)

    def test_sync_metadata_endpoint_refreshes_tags_from_file(self) -> None:
        audio_file = self.root / "sync-tags.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Old Title", artist="Old Artist", album="Old Album", rating=4.0)
        missing_id = track_id + 999
        metadata = {
            "path": str(audio_file.resolve()),
            "path_key": path_key(audio_file),
            "title": "File Title",
            "artist": "File Artist",
            "album": "File Album",
            "album_artist": "File Album Artist",
            "track_number": 7,
            "disc_number": 1,
            "genre": "Pop",
            "year": 2026,
            "duration_seconds": 241.0,
            "bitrate": 320000,
            "replaygain_track_gain_db": None,
            "replaygain_album_gain_db": None,
            "replaygain_track_peak": None,
            "replaygain_album_peak": None,
            "audio_fingerprint": "fresh-file-fingerprint",
            "rating": 2.0,
            "file_modified_at": file_modified_at(audio_file),
        }

        with connect() as conn:
            conn.execute(
                """
                INSERT INTO track_metadata_cache(path_key, path, file_modified_at, file_size, metadata_json)
                VALUES(?, ?, ?, ?, '{}')
                """,
                (path_key(audio_file), str(audio_file), metadata["file_modified_at"], audio_file.stat().st_size),
            )
            conn.commit()

        with patch("backend.app.main.read_metadata", return_value=metadata):
            response = self.client.post("/tracks/sync-metadata", json={"track_ids": [track_id, missing_id]})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["synced_track_ids"], [track_id])
        self.assertEqual(body["synced_count"], 1)
        self.assertEqual(body["missing_track_ids"], [missing_id])
        with connect() as conn:
            row = conn.execute(
                "SELECT title, artist, album, album_artist, track_number, genre, rating FROM tracks WHERE id = ?",
                (track_id,),
            ).fetchone()
            cache_row = conn.execute("SELECT path_key FROM track_metadata_cache WHERE path_key = ?", (path_key(audio_file),)).fetchone()
        self.assertEqual(row["title"], "File Title")
        self.assertEqual(row["artist"], "File Artist")
        self.assertEqual(row["album"], "File Album")
        self.assertEqual(row["album_artist"], "File Album Artist")
        self.assertEqual(row["track_number"], 7)
        self.assertEqual(row["genre"], "Pop")
        self.assertEqual(row["rating"], 4.0)
        self.assertIsNone(cache_row)

    def test_write_metadata_to_files_previews_and_applies_database_tags(self) -> None:
        audio_file = self.root / "write-tags.flac"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Database Title", artist="Database Artist", album="Database Album", rating=4.5)
        file_metadata = {
            "path": str(audio_file.resolve()),
            "path_key": path_key(audio_file),
            "title": "File Title",
            "artist": "File Artist",
            "album": "File Album",
            "album_artist": "File Artist",
            "track_number": None,
            "disc_number": None,
            "genre": "Rock",
            "year": 2024,
            "duration_seconds": 180.0,
            "bitrate": None,
            "replaygain_track_gain_db": None,
            "replaygain_album_gain_db": None,
            "replaygain_track_peak": None,
            "replaygain_album_peak": None,
            "audio_fingerprint": "fingerprint",
            "rating": 2.0,
            "file_modified_at": file_modified_at(audio_file),
        }

        with patch("backend.app.main.read_metadata", return_value=file_metadata), patch(
            "backend.app.main.write_track_metadata"
        ) as write_metadata, patch("backend.app.main.write_track_rating") as write_rating:
            preview = self.client.post(
                "/library/tools/write-metadata-to-files",
                json={"track_ids": [track_id], "include_metadata": True, "include_rating": True},
            )
            legacy_preview = self.client.post(
                "/tracks/write-metadata-to-files",
                json={"track_ids": [track_id], "include_metadata": True, "include_rating": True},
            )

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(legacy_preview.status_code, 200)
        preview_body = preview.json()
        self.assertEqual(preview_body["changed"], 1)
        self.assertIn("title", preview_body["previews"][0]["changed_fields"])
        self.assertIn("rating", preview_body["previews"][0]["changed_fields"])
        write_metadata.assert_not_called()
        write_rating.assert_not_called()

        with patch("backend.app.main.read_metadata", return_value=file_metadata), patch(
            "backend.app.main.write_track_metadata"
        ) as write_metadata, patch("backend.app.main.write_track_rating") as write_rating:
            applied = self.client.post(
                "/library/tools/write-metadata-to-files",
                json={"track_ids": [track_id], "include_metadata": True, "include_rating": True, "apply": True},
            )

        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.json()["applied"], 1)
        write_metadata.assert_called_once()
        self.assertEqual(write_metadata.call_args.args[0], audio_file)
        self.assertEqual(write_metadata.call_args.args[1]["title"], "Database Title")
        write_rating.assert_called_once_with(audio_file, 4.5)

        undo_batches = self.client.get("/library/tools/undo-batches")
        self.assertEqual(undo_batches.status_code, 200)
        batch = next((item for item in undo_batches.json() if item["action_type"] == "sqlite_file_tag_write"), None)
        self.assertIsNotNone(batch)
        with patch("backend.app.main.write_track_metadata") as write_metadata, patch(
            "backend.app.main.write_track_rating"
        ) as write_rating:
            restored = self.client.post(f"/library/tools/undo-batches/{batch['batch_id']}/restore")

        self.assertEqual(restored.status_code, 200)
        self.assertTrue(restored.json()["restored"])
        write_metadata.assert_called_once()
        self.assertEqual(write_metadata.call_args.args[0], audio_file)
        self.assertEqual(write_metadata.call_args.args[1]["title"], "File Title")
        write_rating.assert_called_once_with(audio_file, 2.0)

    def test_track_listings_hide_audiobooks_but_audiobooks_remain_listed(self) -> None:
        music_file = self.root / "Music" / "song.mp3"
        book_file = self.root / "Audiobooks" / "book.mp3"
        music_file.parent.mkdir(parents=True)
        book_file.parent.mkdir(parents=True)
        music_file.write_bytes(b"audio")
        book_file.write_bytes(b"audio")
        music_id = insert_track(music_file, title="Song", genre="Rock")
        book_id = insert_track(book_file, title="Book", genre="Audiobook")

        track_page = self.client.get("/tracks/page")
        self.assertEqual(track_page.status_code, 200)
        self.assertEqual(track_page.json()["total"], 1)
        self.assertEqual(track_page.json()["tracks"][0]["id"], music_id)

        legacy_tracks = self.client.get("/tracks")
        self.assertEqual(legacy_tracks.status_code, 200)
        self.assertEqual([track["id"] for track in legacy_tracks.json()], [music_id])

        audiobooks = self.client.get("/audiobooks")
        self.assertEqual(audiobooks.status_code, 200)
        self.assertEqual(audiobooks.json()["total"], 1)
        self.assertEqual(audiobooks.json()["tracks"][0]["id"], book_id)

    def test_track_page_supports_advanced_search_filters(self) -> None:
        music_dir = self.root / "Advanced Search"
        music_dir.mkdir()
        favorite = music_dir / "favorite.flac"
        unrated = music_dir / "unrated.mp3"
        missing = music_dir / "missing.opus"
        favorite.write_bytes(b"audio")
        unrated.write_bytes(b"audio")
        missing.write_bytes(b"audio")
        favorite_id = insert_track(
            favorite,
            title="Fuzzy Favorite",
            artist="Advanced Artist",
            album="Filter Album",
            genre="Synth Pop",
            year=1999,
            duration_seconds=245,
            rating=4.5,
        )
        unrated_id = insert_track(
            unrated,
            title="Deep Cut",
            artist="Other Artist",
            album="Other Album",
            genre="Jazz",
            year=2024,
            duration_seconds=180,
            rating=None,
        )
        missing_id = insert_track(
            missing,
            title="Needs Tags",
            artist="",
            album="",
            genre="",
            year=None,
            duration_seconds=60,
            rating=None,
        )

        filtered = self.client.get(
            "/tracks/page",
            params={
                "artist": "advanced",
                "album": "filter",
                "genre": "synth",
                "extension": "flac",
                "min_rating": 4,
                "year_from": 1990,
                "year_to": 2000,
                "min_duration": 200,
            },
        )
        self.assertEqual(filtered.status_code, 200)
        self.assertEqual([track["id"] for track in filtered.json()["tracks"]], [favorite_id])

        unrated_response = self.client.get("/tracks/page", params={"rating_state": "unrated"})
        self.assertEqual(unrated_response.status_code, 200)
        unrated_ids = [track["id"] for track in unrated_response.json()["tracks"]]
        self.assertIn(unrated_id, unrated_ids)
        self.assertNotIn(favorite_id, unrated_ids)

        missing_response = self.client.get("/tracks/page", params={"missing_metadata": "true"})
        self.assertEqual(missing_response.status_code, 200)
        self.assertIn(missing_id, [track["id"] for track in missing_response.json()["tracks"]])

    def test_infer_tags_from_filename_preview_and_apply(self) -> None:
        music_dir = self.root / "Music"
        audio_file = music_dir / "Daft Punk - Random Access Memories [2013]" / "01 - Daft Punk - Give Life Back To Music.mp3"
        audio_file.parent.mkdir(parents=True)
        audio_file.write_bytes(b"audio")
        track_id = insert_track(
            audio_file,
            title=None,
            artist=None,
            album=None,
            album_artist=None,
            genre=None,
            year=None,
        )
        with connect() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES('library_path', ?)", (str(music_dir),))
            conn.commit()

        response = self.client.post(
            "/library/tools/infer-tags",
            json={
                "track_ids": [track_id],
                "pattern": "<Album Artist> - <Album> [<Year>]/<Track#> - <Artist> - <Title>",
                "missing_only": True,
                "apply": True,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["matches"], 1)
        self.assertEqual(body["applied"], 1)
        with connect() as conn:
            row = conn.execute(
                "SELECT title, artist, album, album_artist, track_number, year FROM tracks WHERE id = ?",
                (track_id,),
            ).fetchone()
        self.assertEqual(row["title"], "Give Life Back To Music")
        self.assertEqual(row["artist"], "Daft Punk")
        self.assertEqual(row["album"], "Random Access Memories")
        self.assertEqual(row["album_artist"], "Daft Punk")
        self.assertEqual(row["track_number"], 1)
        self.assertEqual(row["year"], 2013)

    def test_organize_files_preview_and_apply_moves_file_and_updates_path(self) -> None:
        source = self.root / "loose.mp3"
        source.write_bytes(b"audio")
        track_id = insert_track(
            source,
            title="A Good Song",
            artist="The Artist",
            album="The Album",
            album_artist="The Artist",
            track_number=3,
            year=2025,
        )
        target_root = self.root / "Organized"

        preview = self.client.post(
            "/library/tools/organize-files",
            json={
                "track_ids": [track_id],
                "base_folder": str(target_root),
                "template": "<Album Artist>/<Album> (<Year>)/<Track#> - <Title>",
            },
        )
        self.assertEqual(preview.status_code, 200)
        self.assertTrue(preview.json()["changes"][0]["changed"])

        response = self.client.post(
            "/library/tools/organize-files",
            json={
                "track_ids": [track_id],
                "base_folder": str(target_root),
                "template": "<Album Artist>/<Album> (<Year>)/<Track#> - <Title>",
                "apply": True,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["applied"], 1)
        new_path = target_root / "The Artist" / "The Album (2025)" / "03 - A Good Song.mp3"
        self.assertFalse(source.exists())
        self.assertTrue(new_path.exists())
        with connect() as conn:
            row = conn.execute("SELECT path FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(canonical_path(row["path"]), canonical_path(new_path))

        undo = self.client.get("/library/tools/undo-log")
        self.assertEqual(undo.status_code, 200)
        self.assertIsNotNone(undo.json()[0]["batch_id"])
        batches = self.client.get("/library/tools/undo-batches")
        self.assertEqual(batches.status_code, 200)
        self.assertEqual(batches.json()[0]["batch_id"], undo.json()[0]["batch_id"])
        self.assertEqual(batches.json()[0]["entries"], 1)

        restore = self.client.post(f"/library/tools/undo-batches/{batches.json()[0]['batch_id']}/restore")
        self.assertEqual(restore.status_code, 200)
        self.assertTrue(restore.json()["restored"])
        self.assertEqual(restore.json()["batch_id"], batches.json()[0]["batch_id"])
        self.assertTrue(source.exists())
        self.assertFalse(new_path.exists())
        with connect() as conn:
            restored = conn.execute("SELECT path FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(canonical_path(restored["path"]), canonical_path(source))

    def test_organize_files_can_auto_rename_collisions_and_clean_empty_source_folders(self) -> None:
        music_dir = self.root / "Music"
        source = music_dir / "Loose" / "loose.mp3"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"audio")
        track_id = insert_track(
            source,
            title="A Good Song",
            artist="The Artist",
            album="The Album",
            album_artist="The Artist",
            track_number=3,
            year=2025,
        )
        with connect() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES('library_path', ?)", (str(music_dir),))
            conn.commit()
        target_root = self.root / "Organized"
        existing_target = target_root / "The Artist" / "The Album (2025)" / "03 - A Good Song.mp3"
        existing_target.parent.mkdir(parents=True)
        existing_target.write_bytes(b"already here")

        response = self.client.post(
            "/library/tools/organize-files",
            json={
                "track_ids": [track_id],
                "base_folder": str(target_root),
                "template": "<Album Artist>/<Album> (<Year>)/<Track#> - <Title>",
                "collision_strategy": "auto_rename",
                "cleanup_empty_folders": True,
                "apply": True,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["applied"], 1)
        self.assertEqual(body["removed_empty_folders"], 1)
        renamed_target = target_root / "The Artist" / "The Album (2025)" / "03 - A Good Song (2).mp3"
        self.assertTrue(existing_target.exists())
        self.assertTrue(renamed_target.exists())
        self.assertFalse(source.parent.exists())
        with connect() as conn:
            row = conn.execute("SELECT path FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(canonical_path(row["path"]), canonical_path(renamed_target))

    def test_file_organization_report_exports_preview_json(self) -> None:
        source = self.root / "report-me.mp3"
        source.write_bytes(b"audio")
        track_id = insert_track(source, title="Report Song", artist="Reporter", album="Reports", album_artist="Reporter", year=2026)
        report_path = self.root / "move-report.json"

        response = self.client.post(
            "/library/tools/organize-files/report",
            json={
                "track_ids": [track_id],
                "base_folder": str(self.root / "Organized"),
                "template": "<Album Artist>/<Album>/<Title>",
                "report_path": str(report_path),
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(report_path.exists())
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["changed_count"], 1)
        self.assertEqual(payload["changes"][0]["track_id"], track_id)

        read_response = self.client.post("/library/tools/reports/read", json={"report_path": str(report_path)})
        self.assertEqual(read_response.status_code, 200)
        self.assertTrue(read_response.json()["exists"])
        self.assertEqual(read_response.json()["parsed_json"]["changed_count"], 1)

    def test_metadata_csv_export_and_import_updates_editable_fields(self) -> None:
        audio_file = self.root / "csv-track.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Old Title", artist="Old Artist", rating=None)
        csv_path = self.root / "metadata.csv"

        export_response = self.client.post(
            "/library/tools/export-metadata-csv",
            json={"track_ids": [track_id], "csv_path": str(csv_path)},
        )
        self.assertEqual(export_response.status_code, 200)
        self.assertTrue(csv_path.exists())
        self.assertEqual(export_response.json()["track_count"], 1)

        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
            fieldnames = list(rows[0].keys())
        rows[0]["title"] = "CSV Title"
        rows[0]["artist"] = "CSV Artist"
        rows[0]["rating"] = "4.5"
        with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        preview = self.client.post(
            "/library/tools/import-metadata-csv",
            json={"csv_path": str(csv_path), "missing_only": False, "apply": False},
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["matched"], 1)
        self.assertEqual(preview.json()["changed"], 1)
        self.assertIn("title", preview.json()["previews"][0]["changed_fields"])
        self.assertIn("rating", preview.json()["previews"][0]["changed_fields"])

        apply_response = self.client.post(
            "/library/tools/import-metadata-csv",
            json={"csv_path": str(csv_path), "missing_only": False, "apply": True},
        )
        self.assertEqual(apply_response.status_code, 200)
        self.assertEqual(apply_response.json()["applied"], 1)
        with connect() as conn:
            row = conn.execute("SELECT title, artist, rating FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["title"], "CSV Title")
        self.assertEqual(row["artist"], "CSV Artist")
        self.assertEqual(row["rating"], 4.5)

        report_response = self.client.post(
            "/library/tools/import-metadata-csv/report",
            json={"csv_path": str(csv_path), "missing_only": False},
        )
        self.assertEqual(report_response.status_code, 200)
        report_path = Path(report_response.json()["report_path"])
        self.assertTrue(report_path.exists())
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["csv_path"], str(csv_path))
        self.assertEqual(payload["matched"], 1)
        self.assertIn("previews", payload)
        report_path.unlink(missing_ok=True)

    def test_metadata_csv_import_supports_column_maps_blank_clearing_and_undo_log(self) -> None:
        audio_file = self.root / "mapped-csv-track.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Old Title", album="Old Album", rating=2.0)
        csv_path = self.root / "mapped.csv"
        with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["id", "Name", "AlbumName", "Stars"])
            writer.writeheader()
            writer.writerow({"id": track_id, "Name": "Mapped Title", "AlbumName": "", "Stars": "5"})

        preview = self.client.post(
            "/library/tools/import-metadata-csv",
            json={
                "csv_path": str(csv_path),
                "column_map": {"title": "Name", "album": "AlbumName", "rating": "Stars"},
                "missing_only": False,
                "clear_blank_fields": True,
                "apply": False,
            },
        )
        self.assertEqual(preview.status_code, 200)
        body = preview.json()
        self.assertEqual(body["changed"], 1)
        self.assertEqual(set(body["previews"][0]["changed_fields"]), {"album", "rating", "title"})
        self.assertIn("album", body["previews"][0]["conflict_fields"])

        apply_response = self.client.post(
            "/library/tools/import-metadata-csv",
            json={
                "csv_path": str(csv_path),
                "column_map": {"title": "Name", "album": "AlbumName", "rating": "Stars"},
                "missing_only": False,
                "clear_blank_fields": True,
                "apply": True,
            },
        )
        self.assertEqual(apply_response.status_code, 200)
        with connect() as conn:
            row = conn.execute("SELECT title, album, rating FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["title"], "Mapped Title")
        self.assertIsNone(row["album"])
        self.assertEqual(row["rating"], 5.0)

        undo = self.client.get("/library/tools/undo-log")
        self.assertEqual(undo.status_code, 200)
        self.assertEqual(undo.json()[0]["action_type"], "csv_metadata_import")

        restore = self.client.post(f"/library/tools/undo-log/{undo.json()[0]['id']}/restore")
        self.assertEqual(restore.status_code, 200)
        self.assertTrue(restore.json()["restored"])
        with connect() as conn:
            restored = conn.execute("SELECT title, album, rating FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(restored["title"], "Old Title")
        self.assertEqual(restored["album"], "Old Album")
        self.assertEqual(restored["rating"], 2.0)

    def test_regex_tag_replace_preview_apply_and_undo(self) -> None:
        audio_file = self.root / "regex-track.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, artist="Artist feat. Guest")

        preview = self.client.post(
            "/library/tools/regex-tags",
            json={
                "field": "artist",
                "pattern": r"\s+feat\..*$",
                "replacement": "",
                "track_ids": [track_id],
            },
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["changed"], 1)
        self.assertEqual(preview.json()["previews"][0]["replacement"], "Artist")

        apply_response = self.client.post(
            "/library/tools/regex-tags",
            json={
                "field": "artist",
                "pattern": r"\s+feat\..*$",
                "replacement": "",
                "track_ids": [track_id],
                "apply": True,
            },
        )
        self.assertEqual(apply_response.status_code, 200)
        self.assertEqual(apply_response.json()["applied"], 1)
        with connect() as conn:
            row = conn.execute("SELECT artist FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["artist"], "Artist")

        undo = self.client.get("/library/tools/undo-log")
        self.assertEqual(undo.status_code, 200)
        self.assertEqual(undo.json()[0]["action_type"], "regex_metadata_replace")
        restore = self.client.post(f"/library/tools/undo-log/{undo.json()[0]['id']}/restore")
        self.assertEqual(restore.status_code, 200)
        with connect() as conn:
            restored = conn.execute("SELECT artist FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(restored["artist"], "Artist feat. Guest")

    def test_advanced_tag_tools_custom_virtual_copy_swap_regex_presets_and_undo(self) -> None:
        audio_file = self.root / "advanced-tags.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, artist="Artist", album_artist="Album Artist", genre="Rock", year=1995)

        preset = self.client.post(
            "/library/tools/regex-presets",
            json={
                "name": "Drop featured artist",
                "field": "artist",
                "pattern": r"\s+feat\..*$",
                "replacement": "",
                "case_sensitive": False,
            },
        )
        self.assertEqual(preset.status_code, 200)
        self.assertEqual(preset.json()["name"], "Drop featured artist")
        presets = self.client.get("/library/tools/regex-presets")
        self.assertEqual(presets.status_code, 200)
        self.assertEqual(len(presets.json()), 1)

        custom = self.client.post(
            "/library/tools/custom-tags",
            json={"tag_key": "Mood", "value": "Focus", "track_ids": [track_id], "apply": True},
        )
        self.assertEqual(custom.status_code, 200)
        self.assertEqual(custom.json()["applied"], 1)
        with connect() as conn:
            row = conn.execute(
                "SELECT tag_value FROM track_custom_tags WHERE track_id = ? AND tag_key = 'Mood'",
                (track_id,),
            ).fetchone()
        self.assertEqual(row["tag_value"], "Focus")

        virtual = self.client.post(
            "/library/tools/virtual-tags",
            json={"name": "Listening Shelf", "expression": "<Album Artist> / <Custom:Mood> / <Decade>"},
        )
        self.assertEqual(virtual.status_code, 200)
        preview_virtual = self.client.post(
            "/library/tools/virtual-tags/preview",
            json={"expression": "<Album Artist> / <Custom:Mood> / <Decade>", "track_ids": [track_id]},
        )
        self.assertEqual(preview_virtual.status_code, 200)
        self.assertEqual(preview_virtual.json()["previews"][0]["value"], "Album Artist / Focus / 1990s")

        copy_preview = self.client.post(
            "/library/tools/copy-swap-tags",
            json={
                "action": "copy",
                "source_field": "custom:Mood",
                "target_field": "genre",
                "track_ids": [track_id],
            },
        )
        self.assertEqual(copy_preview.status_code, 200)
        self.assertEqual(copy_preview.json()["changed"], 1)
        copy_apply = self.client.post(
            "/library/tools/copy-swap-tags",
            json={
                "action": "copy",
                "source_field": "custom:Mood",
                "target_field": "genre",
                "track_ids": [track_id],
                "apply": True,
            },
        )
        self.assertEqual(copy_apply.status_code, 200)
        self.assertEqual(copy_apply.json()["applied"], 1)
        with connect() as conn:
            row = conn.execute("SELECT genre FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["genre"], "Focus")

        undo = self.client.get("/library/tools/undo-log")
        self.assertEqual(undo.status_code, 200)
        self.assertEqual(undo.json()[0]["action_type"], "advanced_tag_edit")
        restore = self.client.post(f"/library/tools/undo-log/{undo.json()[0]['id']}/restore")
        self.assertEqual(restore.status_code, 200)
        self.assertTrue(restore.json()["restored"])
        with connect() as conn:
            restored = conn.execute("SELECT genre FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(restored["genre"], "Rock")

    def test_tag_backup_restore_round_trip(self) -> None:
        audio_file = self.root / "backup-tags.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Original Title", genre="Soul", rating=4.0)
        with connect() as conn:
            conn.execute(
                "INSERT INTO track_custom_tags(track_id, tag_key, tag_value) VALUES(?, 'Mood', 'Warm')",
                (track_id,),
            )
            conn.commit()

        backup_path = self.root / "tags-backup.json"
        backup = self.client.post(
            "/library/tools/tag-backups",
            json={"backup_path": str(backup_path), "track_ids": [track_id], "include_custom_tags": True},
        )
        self.assertEqual(backup.status_code, 200)
        self.assertTrue(backup_path.exists())
        self.assertEqual(backup.json()["track_count"], 1)
        self.assertEqual(backup.json()["custom_tag_count"], 1)

        with connect() as conn:
            conn.execute("UPDATE tracks SET title = 'Changed Title', genre = 'Pop', rating = 2 WHERE id = ?", (track_id,))
            conn.execute(
                """
                UPDATE track_custom_tags
                SET tag_value = 'Cold'
                WHERE track_id = ? AND tag_key = 'Mood'
                """,
                (track_id,),
            )
            conn.commit()

        preview = self.client.post(
            "/library/tools/tag-backups/restore",
            json={"backup_path": str(backup_path), "track_ids": [track_id], "restore_custom_tags": True},
        )
        self.assertEqual(preview.status_code, 200)
        self.assertIn("title", preview.json()["previews"][0]["changed_fields"])
        self.assertIn("custom:Mood", preview.json()["previews"][0]["changed_fields"])

        restore = self.client.post(
            "/library/tools/tag-backups/restore",
            json={
                "backup_path": str(backup_path),
                "track_ids": [track_id],
                "restore_custom_tags": True,
                "apply": True,
            },
        )
        self.assertEqual(restore.status_code, 200)
        self.assertEqual(restore.json()["applied"], 1)
        with connect() as conn:
            row = conn.execute("SELECT title, genre, rating FROM tracks WHERE id = ?", (track_id,)).fetchone()
            custom = conn.execute(
                "SELECT tag_value FROM track_custom_tags WHERE track_id = ? AND tag_key = 'Mood'",
                (track_id,),
            ).fetchone()
        self.assertEqual(row["title"], "Original Title")
        self.assertEqual(row["genre"], "Soul")
        self.assertEqual(row["rating"], 4.0)
        self.assertEqual(custom["tag_value"], "Warm")

    def test_inbox_review_tracks_marks_new_rows_reviewed(self) -> None:
        audio_file = self.root / "inbox-track.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        inbox = self.client.get("/library/inbox")
        self.assertEqual(inbox.status_code, 200)
        self.assertEqual(inbox.json()["total_new"], 1)
        self.assertEqual(inbox.json()["tracks"][0]["id"], track_id)

        review = self.client.post("/library/inbox/review", json={"track_ids": [track_id]})
        self.assertEqual(review.status_code, 200)
        self.assertEqual(review.json()["updated"], 1)
        self.assertEqual(review.json()["total_new"], 0)

    def test_inbox_notes_and_auto_review_rules(self) -> None:
        audio_file = self.root / "podcast.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Talk", genre="Podcast")
        with connect() as conn:
            conn.execute(
                "INSERT INTO track_inbox_state(track_id, status, updated_at) VALUES(?, 'new', datetime('now'))",
                (track_id,),
            )
            conn.commit()

        note = self.client.patch(
            f"/library/inbox/notes/{track_id}",
            json={"note": "Check spoken-word import before it joins AutoDJ."},
        )
        self.assertEqual(note.status_code, 200)
        self.assertEqual(note.json()["note"], "Check spoken-word import before it joins AutoDJ.")

        rule = self.client.post(
            "/library/inbox/auto-review-rules",
            json={
                "name": "Auto-review podcasts",
                "enabled": True,
                "field": "genre",
                "match_type": "equals",
                "value": "Podcast",
                "note": "Auto-reviewed by podcast rule",
                "apply_existing": True,
            },
        )
        self.assertEqual(rule.status_code, 200)
        self.assertEqual(rule.json()["applied"], 1)
        self.assertEqual(rule.json()["total_new"], 0)

        inbox = self.client.get("/library/inbox")
        self.assertEqual(inbox.status_code, 200)
        self.assertEqual(inbox.json()["total_new"], 0)
        self.assertEqual(inbox.json()["auto_review_rules"][0]["name"], "Auto-review podcasts")
        with connect() as conn:
            state = conn.execute("SELECT status FROM track_inbox_state WHERE track_id = ?", (track_id,)).fetchone()
            stored_note = conn.execute("SELECT note FROM track_inbox_notes WHERE track_id = ?", (track_id,)).fetchone()
        self.assertEqual(state["status"], "reviewed")
        self.assertEqual(stored_note["note"], "Check spoken-word import before it joins AutoDJ.")

    def test_playlist_import_supports_pls_xspf_wpl_and_itunes_xml(self) -> None:
        first = self.root / "playlist-a.mp3"
        second = self.root / "playlist-b.mp3"
        first.write_bytes(b"a")
        second.write_bytes(b"b")
        insert_track(first)
        insert_track(second)

        playlist_files = {
            "From PLS": (
                self.root / "list.pls",
                f"[playlist]\nFile1={first.name}\nFile2={second.name}\n",
            ),
            "From XSPF": (
                self.root / "list.xspf",
                (
                    '<playlist xmlns="http://xspf.org/ns/0/1/">'
                    "<trackList>"
                    f"<track><location>{first.as_uri()}</location></track>"
                    f"<track><location>{second.as_uri()}</location></track>"
                    "</trackList></playlist>"
                ),
            ),
            "From WPL": (
                self.root / "list.wpl",
                f'<smil><body><seq><media src="{first.name}" /><media src="{second.name}" /></seq></body></smil>',
            ),
            "From iTunes XML": (
                self.root / "itunes.xml",
                (
                    '<?xml version="1.0" encoding="UTF-8"?>'
                    "<plist><dict><key>Tracks</key><dict>"
                    f"<key>1</key><dict><key>Location</key><string>{first.as_uri()}</string></dict>"
                    f"<key>2</key><dict><key>Location</key><string>{second.as_uri()}</string></dict>"
                    "</dict></dict></plist>"
                ),
            ),
        }

        for name, (path, payload) in playlist_files.items():
            path.write_text(payload, encoding="utf-8")
            response = self.client.post("/playlists/import", json={"playlist_path": str(path), "name": name})
            self.assertEqual(response.status_code, 200, name)
            self.assertEqual(response.json()["track_count"], 2, name)

    def test_device_sync_previews_and_copies_playlist_folder(self) -> None:
        first = self.root / "Music" / "Artist" / "Album" / "sync-a.mp3"
        second = self.root / "Music" / "Artist" / "Album" / "sync-b.mp3"
        first.parent.mkdir(parents=True)
        first.write_bytes(b"a")
        second.write_bytes(b"b")
        first_id = insert_track(first, title="Sync A")
        second_id = insert_track(second, title="Sync B")
        with connect() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES('library_path', ?)", (str(self.root / "Music"),))
            conn.execute("INSERT INTO playlists(name) VALUES('Road Player')")
            playlist_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
            conn.execute("INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES(?, ?, 1)", (playlist_id, first_id))
            conn.execute("INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES(?, ?, 2)", (playlist_id, second_id))
            conn.commit()

        target = self.root / "Device"
        preview = self.client.post(
            "/library/tools/device-sync",
            json={"target_folder": str(target), "playlist_ids": [playlist_id], "apply": False},
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["total_tracks"], 2)
        self.assertEqual(preview.json()["changed_files"], 2)
        self.assertFalse((target / "Artist" / "Album" / "sync-a.mp3").exists())

        applied = self.client.post(
            "/library/tools/device-sync",
            json={"target_folder": str(target), "playlist_ids": [playlist_id], "apply": True},
        )
        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.json()["copied_files"], 2)
        self.assertEqual(applied.json()["playlists_written"], 1)
        self.assertTrue((target / "Music" / "Artist" / "Album" / "sync-a.mp3").exists())
        playlist_path = target / "Playlists" / "Road Player.m3u8"
        self.assertTrue(playlist_path.exists())
        self.assertIn("sync-a.mp3", playlist_path.read_text(encoding="utf-8"))

    def test_device_sync_profiles_and_device_detection(self) -> None:
        with patch(
            "backend.app.device_sync_profiles.windows_removable_devices",
            return_value=[
                {
                    "id": "E:",
                    "label": "Phone SD",
                    "root_path": "E:\\",
                    "device_kind": "usb",
                    "drive_type": 2,
                    "size_bytes": 1000,
                    "free_bytes": 500,
                    "writable": True,
                    "hint": "USB/removable",
                }
            ],
        ):
            devices = self.client.get("/library/tools/device-sync/devices")
        self.assertEqual(devices.status_code, 200)
        self.assertEqual(devices.json()["devices"][0]["root_path"], "E:\\")

        created = self.client.post(
            "/library/tools/device-sync/profiles",
            json={
                "name": "Phone",
                "target_folder": "E:\\",
                "device_kind": "android_folder",
                "music_subfolder": "Music",
                "playlist_subfolder": "Playlists",
                "playlist_ids": [1, 2],
                "playlist_rules": {"relative_paths": True},
                "copy_files": True,
                "export_playlists": True,
                "preserve_structure": False,
            },
        )
        self.assertEqual(created.status_code, 200)
        self.assertEqual(created.json()["playlist_ids"], [1, 2])
        profile_id = created.json()["id"]

        updated = self.client.patch(
            f"/library/tools/device-sync/profiles/{profile_id}",
            json={
                "name": "Phone",
                "target_folder": "F:\\Music",
                "device_kind": "usb",
                "music_subfolder": "Library",
                "playlist_subfolder": "Lists",
                "playlist_ids": [2],
                "playlist_rules": {"relative_paths": True},
                "copy_files": True,
                "export_playlists": False,
                "preserve_structure": True,
            },
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["music_subfolder"], "Library")
        profiles = self.client.get("/library/tools/device-sync/profiles")
        self.assertEqual(profiles.status_code, 200)
        self.assertEqual(profiles.json()["profiles"][0]["target_folder"], "F:\\Music")
        self.assertGreaterEqual(len(profiles.json()["presets"]), 1)

        deleted = self.client.delete(f"/library/tools/device-sync/profiles/{profile_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertTrue(deleted.json()["deleted"])

    def test_audio_conversion_preview_and_job_builds_ffmpeg_command(self) -> None:
        music_dir = self.root / "Music"
        album_dir = music_dir / "Artist" / "Album"
        album_dir.mkdir(parents=True)
        source = album_dir / "song.flac"
        source.write_bytes(b"flac")
        track_id = insert_track(
            source,
            title="Song",
            artist="Artist",
            album="Album",
            album_artist="Artist",
            track_number=1,
        )
        target = self.root / "Converted"
        ffmpeg = self.root / "ffmpeg.exe"
        ffmpeg.write_bytes(b"fake")
        with connect() as conn:
            set_setting(conn, "library_path", str(music_dir))
            conn.commit()

        setup = self.client.patch("/library/tools/audio-conversion/setup", json={"ffmpeg_path": str(ffmpeg)})
        self.assertEqual(setup.status_code, 200)
        self.assertTrue(setup.json()["available"])

        request = {
            "target_folder": str(target),
            "output_format": "mp3",
            "track_ids": [track_id],
            "preserve_structure": True,
            "copy_tags": True,
            "copy_artwork": True,
            "normalize_volume": True,
            "sample_rate_hz": 48000,
            "bitrate_kbps": 192,
            "overwrite": True,
        }
        preview = self.client.post("/library/tools/audio-conversion/preview", json=request)
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["changed_count"], 1)
        self.assertTrue(preview.json()["changes"][0]["target_path"].endswith(r"Artist\Album\song.mp3"))

        commands: list[list[str]] = []

        def fake_ffmpeg(command: list[str]) -> None:
            commands.append(command)
            Path(command[-1]).parent.mkdir(parents=True, exist_ok=True)
            Path(command[-1]).write_bytes(b"mp3")

        with patch("backend.app.audio_conversion_jobs.run_ffmpeg_command", side_effect=fake_ffmpeg):
            started = self.client.post("/library/tools/audio-conversion/jobs", json=request)
            self.assertEqual(started.status_code, 200)
            job_id = started.json()["job_id"]
            latest = None
            for _ in range(30):
                latest = self.client.get(f"/library/tools/audio-conversion/jobs/{job_id}")
                self.assertEqual(latest.status_code, 200)
                if latest.json()["status"] in {"completed", "failed", "canceled"}:
                    break
                time.sleep(0.05)

        self.assertIsNotNone(latest)
        self.assertEqual(latest.json()["status"], "completed")
        self.assertEqual(latest.json()["converted"], 1)
        self.assertTrue((target / "Artist" / "Album" / "song.mp3").exists())
        self.assertEqual(len(commands), 1)
        command_text = " ".join(commands[0])
        self.assertIn("-map_metadata 0", command_text)
        self.assertIn("loudnorm=I=-16:TP=-1.5:LRA=11", command_text)
        self.assertIn("-ar 48000", command_text)
        self.assertIn("libmp3lame", command_text)
        self.assertIn("-b:a 192k", command_text)
        self.assertIn("-vn", command_text)
        self.assertNotIn("0:v?", command_text)

    def test_cd_rip_setup_reports_drives_and_tools(self) -> None:
        ffmpeg = self.root / "ffmpeg.exe"
        ffmpeg.write_bytes(b"fake")

        def fake_tool(name: str, purpose: str) -> dict:
            return {
                "name": name,
                "purpose": purpose,
                "available": name in {"cdparanoia", "cdda2wav"},
                "path": str(self.root / f"{name}.exe") if name in {"cdparanoia", "cdda2wav"} else None,
                "version": f"{name} test" if name in {"cdparanoia", "cdda2wav"} else None,
                "checked_paths": [],
            }

        with (
            patch("backend.app.cd_ripping.detect_cd_drives", return_value=[
                {
                    "id": "D:",
                    "path": "D:\\",
                    "label": "Test CD Drive",
                    "volume_name": "Test Disc",
                    "media_loaded": True,
                    "track_count": 2,
                    "tracks": [
                        {"track_number": 1, "title": "Track 01"},
                        {"track_number": 2, "title": "Track 02"},
                    ],
                }
            ]),
            patch("backend.app.cd_ripping.find_tool", side_effect=fake_tool),
            patch("backend.app.cd_ripping.resolve_ffmpeg_path", return_value=(ffmpeg, None, [ffmpeg])),
        ):
            response = self.client.get("/library/tools/cd-rip/setup")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["secure_ripping_available"])
        self.assertTrue(body["cd_text_available"])
        self.assertTrue(body["ffmpeg_available"])
        self.assertEqual(body["drives"][0]["id"], "D:")
        self.assertEqual(body["drives"][0]["track_count"], 2)

    def test_cd_rip_prefers_native_windows_reader_when_available(self) -> None:
        from backend.app import cd_ripping

        fake_setup = {
            "tools": [
                {"name": "windows_cdda", "purpose": "native", "available": True, "path": "Windows DeviceIoControl"},
                {"name": "cdda2wav", "purpose": "legacy", "available": True, "path": str(self.root / "cdda2wav.exe")},
            ],
            "ffmpeg_available": True,
            "ffmpeg_path": str(self.root / "ffmpeg.exe"),
        }

        with patch("backend.app.cd_ripping.cd_rip_setup", return_value=fake_setup):
            ripper = cd_ripping.selected_ripper(True)

        self.assertIsNotNone(ripper)
        self.assertEqual(ripper["name"], "windows_cdda")
        self.assertEqual(cd_ripping.windows_device_path("D:"), "\\\\.\\D:")

    def test_cd_playback_ignores_closed_alias_and_uses_selected_drive(self) -> None:
        from backend.app import cd_ripping

        commands: list[str] = []

        def fake_mci(command: str) -> None:
            commands.append(command)
            if command == "close flac_cafe_cd":
                raise RuntimeError("The specified device is not open or is not recognized by MCI.")

        with patch("backend.app.cd_ripping.mci_command", side_effect=fake_mci):
            response = cd_ripping.play_cd_track(2, "D:")

        self.assertEqual(response["status"], "playing")
        self.assertIn('open "D:" type cdaudio alias flac_cafe_cd', commands)
        self.assertIn("play flac_cafe_cd from 2:0:0:0", commands)

    def test_cd_playback_route_returns_main_player_live_track(self) -> None:
        with patch(
            "backend.app.main.prepare_cd_live_track",
            return_value={
                "status": "prepared",
                "track_number": 3,
                "message": "Playing CD track 03.",
                "track": {
                    "id": -123,
                    "path": "cdda://E:/track/03",
                    "title": "CD Song",
                    "artist": "CD Artist",
                    "album": "CD Album",
                    "album_artist": "CD Artist",
                    "track_number": 3,
                    "disc_number": 1,
                    "genre": "CD Preview",
                    "date_added": "2026-05-24T00:00:00+00:00",
                    "file_modified_at": None,
                    "audio_url": "/library/tools/cd-rip/playback/live/audio?drive_id=E%3A&track_number=3",
                    "is_preview": True,
                },
            },
        ) as live_mock:
            response = self.client.post(
                "/library/tools/cd-rip/playback/play",
                json={
                    "drive_id": "E:",
                    "track_number": 3,
                    "album_title": "CD Album",
                    "album_artist": "CD Artist",
                    "tracks": [{"track_number": 3, "title": "CD Song", "artist": "CD Artist"}],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["track"]["is_preview"])
        self.assertEqual(body["track"]["id"], -123)
        self.assertIn("/library/tools/cd-rip/playback/live/audio", body["track"]["audio_url"])
        live_mock.assert_called_once()

    def test_cd_playback_route_returns_clear_error_when_drive_unavailable(self) -> None:
        with patch("backend.app.main.prepare_cd_live_track", side_effect=FileNotFoundError(2, "Could not open CD drive D:")):
            response = self.client.post(
                "/library/tools/cd-rip/playback/play",
                json={"drive_id": "D:", "track_number": 1},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Could not open CD drive D:", response.json()["detail"])
        self.assertIn("Refresh CD drives", response.json()["detail"])

    def test_cd_playback_route_blocks_during_active_rip(self) -> None:
        with (
            patch(
                "backend.app.main.active_cd_rip_job_for_drive",
                return_value={"job_id": "job-1", "drive_id": "D:", "status": "running"},
            ),
            patch("backend.app.main.prepare_cd_live_track") as live_mock,
        ):
            response = self.client.post(
                "/library/tools/cd-rip/playback/play",
                json={"drive_id": "D:", "track_number": 1},
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("CD ripping is active", response.json()["detail"])
        live_mock.assert_not_called()

    def test_cd_rip_secure_request_allows_native_windows_reader(self) -> None:
        fake_setup = {
            "ffmpeg_available": True,
            "secure_ripping_available": False,
            "tools": [
                {"name": "windows_cdda", "available": True},
                {"name": "cdda2wav", "available": False},
            ],
        }
        with (
            patch("backend.app.main.cd_rip_setup", return_value=fake_setup),
            patch("backend.app.main.start_cd_rip_job", return_value={"job_id": "job-1", "status": "pending"}) as start_mock,
        ):
            response = self.client.post(
                "/library/tools/cd-rip/jobs",
                json={
                    "drive_id": "D:",
                    "output_folder": str(self.root / "rips"),
                    "output_format": "flac",
                    "track_numbers": [1],
                    "secure_mode": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["job_id"], "job-1")
        start_mock.assert_called_once()

    def test_cd_rip_start_blocks_duplicate_active_drive_job(self) -> None:
        fake_setup = {
            "ffmpeg_available": True,
            "secure_ripping_available": True,
            "tools": [{"name": "windows_cdda", "available": True}],
        }
        with (
            patch("backend.app.main.cd_rip_setup", return_value=fake_setup),
            patch("backend.app.main.active_cd_rip_job_for_drive", return_value={"job_id": "job-1", "drive_id": "D:", "status": "running"}),
            patch("backend.app.main.start_cd_rip_job") as start_mock,
        ):
            response = self.client.post(
                "/library/tools/cd-rip/jobs",
                json={
                    "drive_id": "D:",
                    "output_folder": str(self.root / "rips"),
                    "output_format": "wav",
                    "track_numbers": [1],
                    "secure_mode": False,
                },
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("already active", response.json()["detail"])
        start_mock.assert_not_called()

    def test_cd_rip_start_blocks_live_playback_on_drive(self) -> None:
        fake_setup = {
            "ffmpeg_available": True,
            "secure_ripping_available": True,
            "tools": [{"name": "windows_cdda", "available": True}],
        }
        with (
            patch("backend.app.main.cd_rip_setup", return_value=fake_setup),
            patch("backend.app.main.active_cd_rip_job_for_drive", return_value=None),
            patch("backend.app.main.active_cd_playback_for_drive", return_value=True),
            patch("backend.app.main.start_cd_rip_job") as start_mock,
        ):
            response = self.client.post(
                "/library/tools/cd-rip/jobs",
                json={
                    "drive_id": "D:",
                    "output_folder": str(self.root / "rips"),
                    "output_format": "wav",
                    "track_numbers": [1],
                    "secure_mode": False,
                },
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("CD playback is active", response.json()["detail"])
        start_mock.assert_not_called()

    def test_cd_rip_start_preserves_live_playback_tokens(self) -> None:
        from backend.app import cd_ripping
        from types import SimpleNamespace

        cd_ripping.clear_cd_live_stream_tokens()
        cd_ripping.register_cd_live_stream_token("D:", "playing")
        request = SimpleNamespace(
            drive_id="D:",
            output_folder=str(self.root / "rips"),
            output_format="wav",
        )
        response = {"job_id": ""}
        try:
            with patch("backend.app.cd_ripping.Thread") as thread_class:
                thread_class.return_value.start.return_value = None
                response = cd_ripping.start_cd_rip_job(request)

            self.assertTrue(cd_ripping.cd_live_stream_is_current("D:", "playing"))
            self.assertEqual(response["status"], "pending")
        finally:
            cd_ripping.clear_cd_live_stream_tokens()
            cd_ripping._jobs.pop(response["job_id"], None)

    def test_cd_live_audio_streams_wav_response(self) -> None:
        with (
            patch("backend.app.main.cd_live_wav_content_length", return_value=47),
            patch("backend.app.main.cd_live_wav_stream", return_value=iter([b"RIFF", b"audio"])),
        ):
            response = self.client.get("/library/tools/cd-rip/playback/live/audio?drive_id=D%3A&track_number=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "audio/wav")
        self.assertNotIn("content-length", response.headers)
        self.assertEqual(response.content, b"RIFFaudio")

    def test_cd_live_tokens_allow_prepared_queue_tracks(self) -> None:
        from backend.app import cd_ripping

        cd_ripping.clear_cd_live_stream_tokens()
        try:
            cd_ripping.register_cd_live_stream_token("D:", "first")
            cd_ripping.register_cd_live_stream_token("D:", "second")

            self.assertTrue(cd_ripping.cd_live_stream_is_current("D:", "first"))
            self.assertTrue(cd_ripping.cd_live_stream_is_current("D:", "second"))
        finally:
            cd_ripping.clear_cd_live_stream_tokens()

    def test_cd_live_audio_stale_token_returns_short_silent_wav(self) -> None:
        from backend.app import cd_ripping

        cd_ripping.clear_cd_live_stream_tokens()
        with patch("backend.app.main.cd_live_wav_content_length", return_value=44):
            response = self.client.get(
                "/library/tools/cd-rip/playback/live/audio?drive_id=D%3A&track_number=1&token=stale",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "audio/wav")
        self.assertNotIn("content-length", response.headers)
        self.assertEqual(len(response.content), 44)
        self.assertTrue(response.content.startswith(b"RIFF"))

    def test_cd_rip_metadata_uses_musicbrainz_release_tracks(self) -> None:
        search_release = {"id": "release-1", "title": "Lookup Album"}
        release = {
            "id": "release-1",
            "title": "Lookup Album",
            "artist-credit": [{"name": "Lookup Artist"}],
            "date": "2001-05-01",
            "country": "US",
            "media": [
                {
                    "tracks": [
                        {"position": 1, "title": "First Song", "length": 180000, "artist-credit": [{"name": "Lookup Artist"}]},
                        {"position": 2, "title": "Second Song", "length": 200000, "artist-credit": [{"name": "Lookup Artist"}]},
                    ],
                }
            ],
        }
        fake_setup = {
            "available": True,
            "tool_directory": str(self.root),
            "drives": [],
            "tools": [],
            "ffmpeg_available": True,
            "ffmpeg_path": str(self.root / "ffmpeg.exe"),
            "secure_ripping_available": True,
            "cd_text_available": True,
            "accuraterip_available": False,
            "message": "ready",
            "warnings": [],
        }

        with (
            patch("backend.app.cd_ripping.cd_rip_setup", return_value=fake_setup),
            patch("backend.app.cd_ripping.search_releases", return_value=[search_release]),
            patch("backend.app.cd_ripping.lookup_release", return_value=release),
            patch("backend.app.cd_ripping.cover_art_for_release", return_value={"thumbnail_url": "https://example.test/cover.jpg"}),
        ):
            response = self.client.post(
                "/library/tools/cd-rip/metadata",
                json={"drive_id": "D:", "album_title": "Lookup Album", "album_artist": "Lookup Artist"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["candidates"][0]["release_id"], "release-1")
        self.assertEqual(body["candidates"][0]["year"], 2001)
        self.assertEqual(body["candidates"][0]["tracks"][0]["title"], "First Song")
        self.assertEqual(body["candidates"][0]["tracks"][1]["duration_seconds"], 200.0)

    def test_cd_rip_job_writes_target_and_verification(self) -> None:
        target = self.root / "Rips"
        ffmpeg = self.root / "ffmpeg.exe"
        ripper = self.root / "cdparanoia.exe"
        ffmpeg.write_bytes(b"fake")
        ripper.write_bytes(b"fake")
        fake_setup = {
            "available": True,
            "tool_directory": str(self.root),
            "drives": [],
            "tools": [
                {"name": "cdparanoia", "purpose": "secure", "available": True, "path": str(ripper), "version": None, "checked_paths": []},
            ],
            "ffmpeg_available": True,
            "ffmpeg_path": str(ffmpeg),
            "secure_ripping_available": True,
            "cd_text_available": False,
            "accuraterip_available": False,
            "message": "ready",
            "warnings": [],
        }

        commands: list[list[str]] = []

        def fake_cd_command(command: list[str]) -> str:
            commands.append(command)
            output = Path(command[-1])
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(b"audio")
            return "ok"

        request = {
            "drive_id": "D:",
            "output_folder": str(target),
            "output_format": "flac",
            "track_numbers": [1],
            "tracks": [{"track_number": 1, "title": "First Song", "artist": "Artist"}],
            "album_title": "Album",
            "album_artist": "Artist",
            "year": 2001,
            "secure_mode": True,
            "verify": True,
            "overwrite": True,
        }

        with (
            patch("backend.app.main.cd_rip_setup", return_value=fake_setup),
            patch("backend.app.cd_ripping.cd_rip_setup", return_value=fake_setup),
            patch("backend.app.cd_ripping.resolve_ffmpeg_path", return_value=(ffmpeg, None, [ffmpeg])),
            patch("backend.app.cd_ripping.run_cd_command", side_effect=fake_cd_command),
        ):
            started = self.client.post("/library/tools/cd-rip/jobs", json=request)
            self.assertEqual(started.status_code, 200)
            job_id = started.json()["job_id"]
            latest = None
            for _ in range(30):
                latest = self.client.get(f"/library/tools/cd-rip/jobs/{job_id}")
                self.assertEqual(latest.status_code, 200)
                if latest.json()["status"] in {"completed", "failed", "canceled"}:
                    break
                time.sleep(0.05)

        self.assertIsNotNone(latest)
        self.assertEqual(latest.json()["status"], "completed")
        self.assertEqual(latest.json()["ripped_tracks"], 1)
        self.assertEqual(latest.json()["verification"][0]["track_number"], 1)
        self.assertTrue((target / "Artist" / "Album" / "01 - First Song.flac").exists())
        self.assertGreaterEqual(len(commands), 2)
        self.assertIn("-metadata title=First Song", " ".join(commands[-1]))

    def test_audiobook_progress_bookmarks_chapters_and_sync_export(self) -> None:
        audio_file = self.root / "Audiobooks" / "Author" / "book.mp3"
        audio_file.parent.mkdir(parents=True)
        audio_file.write_bytes(b"audio")
        track_id = insert_track(
            audio_file,
            title="Book",
            artist="Author",
            album="Book Album",
            genre="Audiobook",
            duration_seconds=3600,
        )

        listing = self.client.get("/audiobooks")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()["total"], 1)
        self.assertEqual(listing.json()["tracks"][0]["id"], track_id)

        progress = self.client.patch(
            f"/audiobooks/{track_id}/progress",
            json={"position_seconds": 120, "duration_seconds": 3600},
        )
        self.assertEqual(progress.status_code, 200)
        self.assertEqual(progress.json()["position_seconds"], 120)

        bookmark = self.client.post(
            f"/audiobooks/{track_id}/bookmarks",
            json={"position_seconds": 125, "label": "Good part", "note": "Remember this"},
        )
        self.assertEqual(bookmark.status_code, 200)
        bookmark_id = bookmark.json()["id"]
        bookmarks = self.client.get(f"/audiobooks/{track_id}/bookmarks")
        self.assertEqual(bookmarks.status_code, 200)
        self.assertEqual(bookmarks.json()[0]["label"], "Good part")

        chapters = self.client.put(
            f"/audiobooks/{track_id}/chapters",
            json={
                "chapters": [
                    {"chapter_index": 1, "title": "Opening", "start_seconds": 0, "end_seconds": 600},
                    {"chapter_index": 2, "title": "Middle", "start_seconds": 600, "end_seconds": None},
                ],
            },
        )
        self.assertEqual(chapters.status_code, 200)
        self.assertEqual(len(chapters.json()), 2)

        export = self.client.post("/audiobooks/sync-export", json={"track_ids": [track_id]})
        self.assertEqual(export.status_code, 200)
        export_path = Path(export.json()["export_path"])
        self.assertTrue(export_path.exists())
        payload = json.loads(export_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["tracks"][0]["track"]["id"], track_id)
        self.assertEqual(payload["tracks"][0]["bookmarks"][0]["label"], "Good part")
        export_path.unlink(missing_ok=True)

        deleted = self.client.delete(f"/audiobooks/bookmarks/{bookmark_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertTrue(deleted.json()["deleted"])

    def test_podcast_subscription_refresh_and_download(self) -> None:
        media = self.root / "episode.mp3"
        media.write_bytes(b"podcast audio")
        feed = self.root / "feed.xml"
        feed.write_text(
            f"""<?xml version="1.0"?>
            <rss version="2.0"><channel>
              <title>Test Cast</title>
              <description>Local feed</description>
              <item>
                <title>Episode One</title>
                <guid>episode-one</guid>
                <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
                <itunes:duration xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">12:34</itunes:duration>
                <enclosure url="{media.as_uri()}" type="audio/mpeg" />
              </item>
            </channel></rss>""",
            encoding="utf-8",
        )
        download_folder = self.root / "Podcasts"

        created = self.client.post(
            "/podcasts/subscriptions",
            json={"title": "Pending", "feed_url": feed.as_uri(), "download_folder": str(download_folder)},
        )
        self.assertEqual(created.status_code, 200)
        subscription_id = created.json()["id"]

        refreshed = self.client.post(f"/podcasts/subscriptions/{subscription_id}/refresh")
        self.assertEqual(refreshed.status_code, 200)
        self.assertEqual(refreshed.json()["subscription"]["title"], "Test Cast")
        self.assertEqual(canonical_path(refreshed.json()["subscription"]["effective_download_folder"]), canonical_path(download_folder / "Test Cast"))
        self.assertEqual(refreshed.json()["total"], 1)

        episodes = self.client.get(f"/podcasts/episodes?subscription_id={subscription_id}")
        self.assertEqual(episodes.status_code, 200)
        self.assertEqual(episodes.json()[0]["title"], "Episode One")
        episode_id = episodes.json()[0]["id"]

        downloaded = self.client.post(f"/podcasts/episodes/{episode_id}/download", json={})
        self.assertEqual(downloaded.status_code, 200)
        local_path = Path(downloaded.json()["local_path"])
        self.assertTrue(local_path.exists())
        self.assertEqual(canonical_path(local_path.parent), canonical_path(download_folder / "Test Cast"))
        self.assertEqual(local_path.read_bytes(), b"podcast audio")

        deleted = self.client.delete(f"/podcasts/subscriptions/{subscription_id}?delete_files=true")
        self.assertEqual(deleted.status_code, 200)
        self.assertTrue(deleted.json()["deleted"])
        self.assertEqual(deleted.json()["deleted_files"], 1)
        self.assertFalse(local_path.exists())

    def test_default_podcast_download_adds_podcast_track_outside_main_library(self) -> None:
        media = self.root / "default-episode.mp3"
        media.write_bytes(b"podcast audio")
        feed = self.root / "default-feed.xml"
        feed.write_text(
            f"""<?xml version="1.0"?>
            <rss version="2.0"><channel>
              <title>Default Cast</title>
              <item>
                <title>Default Episode</title>
                <guid>default-episode</guid>
                <enclosure url="{media.as_uri()}" type="audio/mpeg" />
              </item>
            </channel></rss>""",
            encoding="utf-8",
        )

        created = self.client.post(
            "/podcasts/subscriptions",
            json={"title": "Default Cast", "feed_url": feed.as_uri(), "download_folder": None},
        )
        self.assertEqual(created.status_code, 200)
        self.assertEqual(Path(created.json()["effective_download_folder"]).name, "Default Cast")
        subscription_id = created.json()["id"]

        folder = self.client.post(f"/podcasts/subscriptions/{subscription_id}/folder")
        self.assertEqual(folder.status_code, 200)
        self.assertTrue(Path(folder.json()["path"]).exists())
        self.assertEqual(Path(folder.json()["path"]).name, "Default Cast")

        refreshed = self.client.post(f"/podcasts/subscriptions/{subscription_id}/refresh")
        self.assertEqual(refreshed.status_code, 200)
        episodes = self.client.get(f"/podcasts/episodes?subscription_id={subscription_id}")
        episode_id = episodes.json()[0]["id"]

        downloaded = self.client.post(f"/podcasts/episodes/{episode_id}/download", json={})
        self.assertEqual(downloaded.status_code, 200)
        track_id = downloaded.json()["track_id"]
        self.assertIsNotNone(track_id)

        track = self.client.get(f"/tracks/{track_id}")
        self.assertEqual(track.status_code, 200)
        self.assertEqual(track.json()["genre"], "Podcast")
        self.assertEqual(track.json()["title"], "Default Episode")
        self.assertIsNone(track.json()["album"])

        main_library = self.client.get("/tracks/page")
        self.assertEqual(main_library.status_code, 200)
        self.assertEqual(main_library.json()["total"], 0)

        ensured = self.client.post(f"/podcasts/episodes/{episode_id}/track")
        self.assertEqual(ensured.status_code, 200)
        self.assertEqual(ensured.json()["id"], track_id)

        local_path = Path(downloaded.json()["local_path"])
        deleted = self.client.delete(f"/podcasts/episodes/{episode_id}/download")
        self.assertEqual(deleted.status_code, 200)
        self.assertTrue(deleted.json()["deleted_file"])
        self.assertFalse(local_path.exists())
        self.assertIsNone(deleted.json()["episode"]["local_path"])
        self.assertIsNone(deleted.json()["episode"]["track_id"])
        missing_track = self.client.get(f"/tracks/{track_id}")
        self.assertEqual(missing_track.status_code, 404)

    def test_radio_station_bookmarks_and_played_timestamp(self) -> None:
        created = self.client.post(
            "/radio/stations",
            json={
                "name": "Test Radio",
                "stream_url": "https://example.test/live.mp3",
                "homepage_url": "https://example.test",
                "genre": "Jazz",
                "notes": "Late night",
            },
        )
        self.assertEqual(created.status_code, 200)
        station_id = created.json()["id"]

        stations = self.client.get("/radio/stations")
        self.assertEqual(stations.status_code, 200)
        self.assertEqual(stations.json()[0]["name"], "Test Radio")

        played = self.client.post(f"/radio/stations/{station_id}/played")
        self.assertEqual(played.status_code, 200)
        self.assertIsNotNone(played.json()["last_played_at"])

        updated = self.client.patch(
            f"/radio/stations/{station_id}",
            json={
                "name": "Updated Radio",
                "stream_url": "https://example.test/live.mp3",
                "genre": "Ambient",
            },
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["name"], "Updated Radio")

        deleted = self.client.delete(f"/radio/stations/{station_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertTrue(deleted.json()["deleted"])

    def test_lastfm_login_start_returns_authorization_url(self) -> None:
        with patch("backend.app.scrobbling.lastfm_api_post", return_value={"token": "token-123"}):
            response = self.client.post(
                "/scrobbling/lastfm/login/start",
                json={"api_key": "api-key", "api_secret": "shared-secret"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["token"], "token-123")
        self.assertIn("last.fm/api/auth", body["auth_url"])
        self.assertIn("api_key=api-key", body["auth_url"])
        self.assertIn("token=token-123", body["auth_url"])

    def test_lastfm_login_start_uses_configured_credentials(self) -> None:
        with (
            patch.dict(
                os.environ,
                {
                    "FLAC_CAFE_LASTFM_API_KEY": "env-key",
                    "FLAC_CAFE_LASTFM_API_SECRET": "env-secret",
                },
                clear=False,
            ),
            patch("backend.app.scrobbling.lastfm_api_post", return_value={"token": "token-123"}) as lastfm_post,
        ):
            response = self.client.post("/scrobbling/lastfm/login/start", json={})

        self.assertEqual(response.status_code, 200)
        self.assertIn("api_key=env-key", response.json()["auth_url"])
        params = lastfm_post.call_args.args[0]
        self.assertEqual(params["api_key"], "env-key")

    def test_lastfm_login_complete_saves_session_key(self) -> None:
        with patch(
            "backend.app.scrobbling.lastfm_api_post",
            return_value={"session": {"key": "session-key", "name": "listener"}},
        ):
            response = self.client.post(
                "/scrobbling/lastfm/login/complete",
                json={
                    "api_key": "api-key",
                    "api_secret": "shared-secret",
                    "token": "approved-token",
                    "enabled": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        account = response.json()["account"]
        self.assertEqual(account["service"], "lastfm")
        self.assertTrue(account["enabled"])
        self.assertEqual(account["username"], "listener")
        self.assertEqual(account["session_key"], "session-key")

        accounts = self.client.get("/scrobbling/accounts")
        self.assertEqual(accounts.status_code, 200)
        lastfm = next(item for item in accounts.json() if item["service"] == "lastfm")
        self.assertEqual(lastfm["username"], "listener")
        self.assertEqual(lastfm["session_key"], "session-key")

    def test_lastfm_account_patch_preserves_saved_credentials(self) -> None:
        created = self.client.patch(
            "/scrobbling/accounts/lastfm",
            json={
                "enabled": True,
                "api_key": "api-key",
                "api_secret": "shared-secret",
                "session_key": "session-key",
            },
        )
        self.assertEqual(created.status_code, 200)

        updated = self.client.patch("/scrobbling/accounts/lastfm", json={"enabled": False})

        self.assertEqual(updated.status_code, 200)
        account = updated.json()
        self.assertFalse(account["enabled"])
        self.assertEqual(account["api_key"], "api-key")
        self.assertEqual(account["api_secret"], "shared-secret")
        self.assertEqual(account["session_key"], "session-key")

    def test_scrobbling_outbox_loved_tracks_and_history_import(self) -> None:
        audio_file = self.root / "scrobble.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Scrobble Song", artist="Scrobble Artist", album="Scrobble Album")
        with connect() as conn:
            conn.execute(
                "INSERT INTO play_events(track_id, event_type, timestamp) VALUES(?, 'played', '2024-01-01T00:00:00+00:00')",
                (track_id,),
            )
            conn.commit()

        account = self.client.patch(
            "/scrobbling/accounts/listenbrainz",
            json={"enabled": True, "token": "token"},
        )
        self.assertEqual(account.status_code, 200)
        self.assertTrue(account.json()["enabled"])

        queued = self.client.post("/scrobbling/outbox/queue-history", json={"service": "listenbrainz", "limit": 20})
        self.assertEqual(queued.status_code, 200)
        self.assertEqual(queued.json()["queued"], 1)

        with patch("backend.app.scrobbling.submit_listenbrainz") as submit:
            submitted = self.client.post("/scrobbling/outbox/submit", json={"service": "listenbrainz", "limit": 20})
        self.assertEqual(submitted.status_code, 200)
        self.assertEqual(submitted.json()["submitted"], 1)
        submit.assert_called_once()

        love = self.client.patch(f"/scrobbling/tracks/{track_id}/love", json={"loved": True})
        self.assertEqual(love.status_code, 200)
        self.assertTrue(love.json()["loved"])
        loved = self.client.get("/scrobbling/loved")
        self.assertEqual(loved.status_code, 200)
        self.assertEqual(loved.json()[0]["track_id"], track_id)

        history_csv = self.root / "history.csv"
        history_csv.write_text("artist,title,play_count,rating,loved\nScrobble Artist,Scrobble Song,7,4.5,true\n", encoding="utf-8")
        preview = self.client.post("/scrobbling/import-history", json={"csv_path": str(history_csv), "apply": False})
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["total"], 1)
        applied = self.client.post("/scrobbling/import-history", json={"csv_path": str(history_csv), "apply": True})
        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.json()["updated"], 1)
        with connect() as conn:
            row = conn.execute("SELECT play_count, rating FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["play_count"], 7)
        self.assertEqual(row["rating"], 4.5)

    def test_history_stats_summarizes_play_and_skip_counts(self) -> None:
        first = self.root / "history-a.mp3"
        second = self.root / "history-b.mp3"
        first.write_bytes(b"audio")
        second.write_bytes(b"audio")
        first_id = insert_track(first, title="History A", artist="Stats Artist", duration_seconds=180.0)
        second_id = insert_track(second, title="History B", artist="Stats Artist", duration_seconds=60.0)
        with connect() as conn:
            conn.execute("UPDATE tracks SET play_count = 3, skip_count = 1 WHERE id = ?", (first_id,))
            conn.execute("UPDATE tracks SET play_count = 1, skip_count = 4 WHERE id = ?", (second_id,))
            conn.execute("INSERT INTO play_events(track_id, event_type) VALUES(?, 'played')", (first_id,))
            conn.execute("INSERT INTO play_events(track_id, event_type) VALUES(?, 'skipped')", (second_id,))
            conn.execute("INSERT INTO play_events(track_id, event_type) VALUES(?, 'rated')", (first_id,))
            conn.commit()

        response = self.client.get("/history/stats?limit=1")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total_play_count"], 4)
        self.assertEqual(body["total_skip_count"], 5)
        self.assertEqual(body["total_play_events"], 1)
        self.assertEqual(body["total_skip_events"], 1)
        self.assertEqual(body["total_rated_events"], 1)
        self.assertEqual(body["unique_played_tracks"], 2)
        self.assertEqual(body["unique_skipped_tracks"], 2)
        self.assertEqual(body["total_listened_seconds"], 600)
        self.assertEqual(body["top_played"][0]["track"]["id"], first_id)
        self.assertEqual(body["top_skipped"][0]["track"]["id"], second_id)

    def test_gapless_validation_reports_adjacent_pairs(self) -> None:
        album_dir = self.root / "Album"
        album_dir.mkdir()
        first = album_dir / "01.flac"
        second = album_dir / "02.flac"
        first.write_bytes(b"not real audio")
        second.write_bytes(b"not real audio")
        first_id = insert_track(first, title="One", artist="Artist", album="Album", track_number=1)
        second_id = insert_track(second, title="Two", artist="Artist", album="Album", track_number=2)

        response = self.client.post(
            "/playback/gapless/validate",
            json={"track_ids": [first_id, second_id]},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["pair_count"], 1)
        self.assertEqual(body["pairs"][0]["left_track_id"], first_id)
        self.assertFalse(body["pairs"][0]["sample_accurate_ready"])
        self.assertTrue(body["pairs"][0]["warnings"])

    def test_clap_coverage_excludes_audiobooks_and_podcasts(self) -> None:
        music = self.root / "music.flac"
        analyzed = self.root / "analyzed.flac"
        audiobook = self.root / "Audiobooks" / "book.flac"
        podcast = self.root / "Podcasts" / "episode.mp3"
        audiobook.parent.mkdir()
        podcast.parent.mkdir()
        for path in [music, analyzed, audiobook, podcast]:
            path.write_bytes(b"audio")
        insert_track(music, title="Music", genre="Rock")
        analyzed_id = insert_track(analyzed, title="Analyzed", genre="Rock")
        insert_track(audiobook, title="Book", genre="Audiobook")
        podcast_id = insert_track(podcast, title="Episode", genre="Podcast")
        with connect() as conn:
            conn.execute(
                "UPDATE tracks SET analysis_provider = 'clap', analysis_embedding = '[0.1]' WHERE id = ?",
                (analyzed_id,),
            )
            conn.execute(
                "UPDATE tracks SET analysis_provider = 'clap_failed' WHERE id = ?",
                (podcast_id,),
            )
            conn.commit()

        response = self.client.get("/analysis/clap/coverage")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total_tracks"], 2)
        self.assertEqual(body["analyzed_tracks"], 1)
        self.assertEqual(body["unanalyzed_tracks"], 1)
        self.assertEqual(body["failed_tracks"], 0)

    def test_audio_analysis_candidates_exclude_linked_podcast_episode(self) -> None:
        from backend.app.analysis_jobs import _candidate_tracks

        music = self.root / "music.flac"
        episode = self.root / "download.mp3"
        music.write_bytes(b"music")
        episode.write_bytes(b"podcast")
        music_id = insert_track(music, title="Music", genre="Rock")
        episode_id = insert_track(episode, title="Talk Episode", artist="Feed", album=None, genre="Talk")
        with connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO podcast_subscriptions(title, feed_url)
                VALUES('Feed', 'https://example.test/feed.xml')
                """
            )
            subscription_id = int(cursor.lastrowid)
            conn.execute(
                """
                INSERT INTO podcast_episodes(subscription_id, track_id, guid, title, local_path, download_status)
                VALUES(?, ?, 'episode-1', 'Talk Episode', ?, 'downloaded')
                """,
                (subscription_id, episode_id, str(episode)),
            )
            conn.commit()

        candidates = _candidate_tracks(limit=50, overwrite=True, only_missing=False, track_ids=None)
        candidate_ids = {int(track["id"]) for track in candidates}

        self.assertIn(music_id, candidate_ids)
        self.assertNotIn(episode_id, candidate_ids)
        self.assertEqual(_candidate_tracks(limit=50, overwrite=True, only_missing=False, track_ids=[episode_id]), [])

    def test_album_list_groups_same_album_across_year_variants(self) -> None:
        album_dir = self.root / "Grouped Album"
        album_dir.mkdir()
        original = album_dir / "01.flac"
        bonus = album_dir / "15.flac"
        original.write_bytes(b"one")
        bonus.write_bytes(b"bonus")
        with connect() as conn:
            first_album = conn.execute(
                "INSERT INTO albums(album, album_artist, year) VALUES('Sports', 'Modern Baseball', 2012)"
            )
            second_album = conn.execute(
                "INSERT INTO albums(album, album_artist, year) VALUES('Sports', 'Modern Baseball', 2015)"
            )
            first_album_id = int(first_album.lastrowid)
            second_album_id = int(second_album.lastrowid)
            conn.commit()
        insert_track(
            original,
            title="Original",
            artist="Modern Baseball",
            album="Sports",
            album_artist="Modern Baseball",
            album_id=first_album_id,
            year=2012,
            track_number=1,
        )
        insert_track(
            bonus,
            title="Bonus Demo",
            artist="Modern Baseball",
            album="Sports",
            album_artist="Modern Baseball",
            album_id=second_album_id,
            year=2015,
            track_number=15,
        )

        albums = self.client.get("/albums", params={"search": "sports"})

        self.assertEqual(albums.status_code, 200)
        body = albums.json()
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["track_count"], 2)
        self.assertEqual(body[0]["years"], [2012, 2015])
        self.assertEqual(body[0]["edition_count"], 2)

        tracks = self.client.get(f"/albums/{body[0]['id']}/tracks")
        self.assertEqual(tracks.status_code, 200)
        self.assertEqual([track["title"] for track in tracks.json()], ["Original", "Bonus Demo"])

    def test_albums_include_completion_estimate_from_track_numbers(self) -> None:
        album_dir = self.root / "Completion Album"
        album_dir.mkdir()
        first = album_dir / "01.mp3"
        third = album_dir / "03.mp3"
        first.write_bytes(b"one")
        third.write_bytes(b"three")
        with connect() as conn:
            cursor = conn.execute("INSERT INTO albums(album, album_artist, year) VALUES('Completion Album', 'Artist', 2026)")
            album_id = int(cursor.lastrowid)
            conn.commit()
        insert_track(first, title="One", artist="Artist", album="Completion Album", album_artist="Artist", album_id=album_id, track_number=1)
        insert_track(third, title="Three", artist="Artist", album="Completion Album", album_artist="Artist", album_id=album_id, track_number=3)

        response = self.client.get("/albums")

        self.assertEqual(response.status_code, 200)
        album = next(item for item in response.json() if item["id"] == album_id)
        self.assertEqual(album["track_count"], 2)
        self.assertEqual(album["expected_track_count"], 3)
        self.assertEqual(album["missing_track_count"], 1)

    def test_album_completion_lookup_persists_musicbrainz_track_count(self) -> None:
        album_dir = self.root / "Lookup Album"
        album_dir.mkdir()
        first = album_dir / "01.mp3"
        second = album_dir / "02.mp3"
        first.write_bytes(b"one")
        second.write_bytes(b"two")
        with connect() as conn:
            cursor = conn.execute("INSERT INTO albums(album, album_artist, year) VALUES('Lookup Album', 'Lookup Artist', 2026)")
            album_id = int(cursor.lastrowid)
            conn.commit()
        insert_track(first, title="One", artist="Lookup Artist", album="Lookup Album", album_artist="Lookup Artist", album_id=album_id, track_number=1)
        insert_track(second, title="Two", artist="Lookup Artist", album="Lookup Album", album_artist="Lookup Artist", album_id=album_id, track_number=2)
        release = {
            "id": "release-lookup",
            "title": "Lookup Album",
            "artist-credit": [{"name": "Lookup Artist"}],
            "date": "2026-02-01",
            "media": [
                {
                    "position": 1,
                    "tracks": [
                        {"number": "1", "title": "One", "recording": {"id": "r1"}},
                        {"number": "2", "title": "Two", "recording": {"id": "r2"}},
                        {"number": "3", "title": "Three", "recording": {"id": "r3"}},
                        {"number": "4", "title": "Four", "recording": {"id": "r4"}},
                    ],
                }
            ],
        }

        with patch("backend.app.main.search_releases", return_value=[{"id": "release-lookup"}]), patch(
            "backend.app.main.lookup_release",
            return_value=release,
        ):
            response = self.client.post(f"/albums/{album_id}/completion-lookup")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["expected_track_count"], 4)
        self.assertEqual(body["missing_track_count"], 2)
        self.assertEqual(body["source"], "MusicBrainz")

        albums_response = self.client.get("/albums")
        self.assertEqual(albums_response.status_code, 200)
        album = next(item for item in albums_response.json() if item["id"] == album_id)
        self.assertEqual(album["expected_track_count"], 4)
        self.assertEqual(album["missing_track_count"], 2)
        self.assertEqual(album["completion_release_id"], "release-lookup")

    def test_album_completion_lookup_falls_back_when_album_artist_is_too_strict(self) -> None:
        album_dir = self.root / "Lookup Fallback"
        album_dir.mkdir()
        first = album_dir / "01.mp3"
        second = album_dir / "02.mp3"
        first.write_bytes(b"one")
        second.write_bytes(b"two")
        with connect() as conn:
            cursor = conn.execute(
                "INSERT INTO albums(album, album_artist, year) VALUES('Lookup Fallback', 'Lookup Artist feat. Guest', 2026)"
            )
            album_id = int(cursor.lastrowid)
            conn.commit()
        insert_track(
            first,
            title="One",
            artist="Lookup Artist",
            album="Lookup Fallback",
            album_artist="Lookup Artist feat. Guest",
            album_id=album_id,
            track_number=1,
        )
        insert_track(
            second,
            title="Two",
            artist="Lookup Artist",
            album="Lookup Fallback",
            album_artist="Lookup Artist feat. Guest",
            album_id=album_id,
            track_number=2,
        )
        release = {
            "id": "release-fallback",
            "title": "Lookup Fallback",
            "artist-credit": [{"name": "Lookup Artist"}],
            "date": "2026",
            "media": [
                {
                    "position": 1,
                    "tracks": [
                        {"number": "1", "title": "One", "recording": {"id": "r1"}},
                        {"number": "2", "title": "Two", "recording": {"id": "r2"}},
                        {"number": "3", "title": "Three", "recording": {"id": "r3"}},
                    ],
                }
            ],
        }
        calls: list[tuple[str, str | None]] = []

        def fake_search(album: str, artist: str | None, limit: int) -> list[dict]:
            calls.append((album, artist))
            return [{"id": "release-fallback"}] if artist == "Lookup Artist" else []

        with patch("backend.app.main.search_releases", side_effect=fake_search), patch(
            "backend.app.main.lookup_release",
            return_value=release,
        ):
            response = self.client.post(f"/albums/{album_id}/completion-lookup")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["expected_track_count"], 3)
        self.assertIn(("Lookup Fallback", "Lookup Artist"), calls)

    def test_extension_discovery_validates_manifests(self) -> None:
        extension_dir = self.root / "extensions"
        package_dir = extension_dir / "example"
        package_dir.mkdir(parents=True)
        (package_dir / "theme.json").write_text("{}", encoding="utf-8")
        (package_dir / "extension.json").write_text(
            json.dumps(
                {
                    "id": "flac-cafe.test",
                    "name": "Test Skin",
                    "version": "1.0.0",
                    "kind": "skin",
                    "entry": "theme.json",
                    "capabilities": ["theme-palette"],
                }
            ),
            encoding="utf-8",
        )

        response = discover_extensions([extension_dir], create_user_dir=False)

        self.assertEqual(response["extensions"][0]["id"], "flac-cafe.test")
        self.assertTrue(response["extensions"][0]["valid"])
        self.assertEqual(response["extensions"][0]["capabilities"], ["theme-palette"])

    def test_library_stats_importers_preview_and_apply(self) -> None:
        musicbee_file = self.root / "musicbee.mp3"
        itunes_file = self.root / "itunes.mp3"
        wmp_file = self.root / "wmp.mp3"
        musicbee_file.write_bytes(b"musicbee")
        itunes_file.write_bytes(b"itunes")
        wmp_file.write_bytes(b"wmp")
        musicbee_id = insert_track(musicbee_file, title="MusicBee Song", artist="Import Artist")
        itunes_id = insert_track(itunes_file, title="iTunes Song", artist="Import Artist")
        wmp_id = insert_track(wmp_file, title="WMP Song", artist="Import Artist")

        musicbee_csv = self.root / "musicbee.csv"
        with musicbee_csv.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["Path", "Title", "Artist", "Rating", "Play Count"])
            writer.writeheader()
            writer.writerow(
                {
                    "Path": str(musicbee_file),
                    "Title": "MusicBee Song",
                    "Artist": "Import Artist",
                    "Rating": "80",
                    "Play Count": "9",
                }
            )

        preview = self.client.post(
            "/library/importers/stats",
            json={"source": "musicbee", "import_path": str(musicbee_csv), "apply": False},
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["matched"], 1)
        self.assertEqual(preview.json()["changed"], 1)

        itunes_xml = self.root / "itunes.xml"
        with itunes_xml.open("wb") as handle:
            plistlib.dump(
                {
                    "Tracks": {
                        "1": {
                            "Name": "iTunes Song",
                            "Artist": "Import Artist",
                            "Location": itunes_file.as_uri(),
                            "Rating": 100,
                            "Play Count": 4,
                            "Play Date UTC": datetime(2024, 1, 2, tzinfo=timezone.utc),
                        }
                    }
                },
                handle,
            )

        wmp_xml = self.root / "library.wpl"
        wmp_xml.write_text(
            f'<smil><body><seq><media src="{wmp_file}" title="WMP Song" artist="Import Artist" userRating="60" playCount="5" /></seq></body></smil>',
            encoding="utf-8",
        )

        for source, import_file in [
            ("musicbee", musicbee_csv),
            ("itunes", itunes_xml),
            ("windows_media_player", wmp_xml),
        ]:
            response = self.client.post(
                "/library/importers/stats",
                json={"source": source, "import_path": str(import_file), "apply": True},
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["applied"], 1)

        with connect() as conn:
            rows = {
                row["id"]: row
                for row in conn.execute(
                    "SELECT id, rating, play_count, last_played_at FROM tracks WHERE id IN (?, ?, ?)",
                    (musicbee_id, itunes_id, wmp_id),
                )
            }
        self.assertEqual(rows[musicbee_id]["rating"], 4.0)
        self.assertEqual(rows[musicbee_id]["play_count"], 9)
        self.assertEqual(rows[itunes_id]["rating"], 5.0)
        self.assertEqual(rows[itunes_id]["play_count"], 4)
        self.assertTrue(rows[itunes_id]["last_played_at"])
        self.assertEqual(rows[wmp_id]["rating"], 3.0)
        self.assertEqual(rows[wmp_id]["play_count"], 5)

    def test_duplicate_actions_can_remove_selected_and_export_reports(self) -> None:
        first = self.root / "dup-action-a.mp3"
        second = self.root / "dup-action-b.mp3"
        first.write_bytes(b"a")
        second.write_bytes(b"b")
        first_id = insert_track(first, title="Dup", artist="Artist", audio_fingerprint="same")
        second_id = insert_track(second, title="Dup", artist="Artist", audio_fingerprint="same")
        report_path = self.root / "duplicates.json"

        report = self.client.post(
            "/library/duplicates/action",
            json={"action": "export_report", "track_ids": [first_id, second_id], "report_path": str(report_path)},
        )
        self.assertEqual(report.status_code, 200)
        self.assertTrue(report_path.exists())
        self.assertGreaterEqual(report.json()["affected"], 1)

        remove = self.client.post(
            "/library/duplicates/action",
            json={"action": "remove_selected", "track_ids": [second_id], "delete_files": False},
        )
        self.assertEqual(remove.status_code, 200)
        self.assertEqual(remove.json()["removed_track_ids"], [second_id])
        self.assertTrue(second.exists())
        with connect() as conn:
            remaining = conn.execute("SELECT count(*) AS count FROM tracks WHERE id = ?", (second_id,)).fetchone()["count"]
        self.assertEqual(remaining, 0)

        undo = self.client.get("/library/tools/undo-log")
        restore = self.client.post(f"/library/tools/undo-log/{undo.json()[0]['id']}/restore")
        self.assertEqual(restore.status_code, 200)
        self.assertTrue(restore.json()["restored"])
        with connect() as conn:
            restored = conn.execute("SELECT count(*) AS count FROM tracks WHERE id = ?", (second_id,)).fetchone()["count"]
        self.assertEqual(restored, 1)

    def test_duplicate_review_fetches_arbitrary_track_ids(self) -> None:
        first = self.root / "review-a.mp3"
        second = self.root / "review-b.mp3"
        first.write_bytes(b"a")
        second.write_bytes(b"b")
        first_id = insert_track(first, title="Review", artist="Artist", rating=4.0, bitrate=256000)
        second_id = insert_track(second, title="Review", artist="Artist", rating=2.0, bitrate=128000)

        response = self.client.post(
            "/library/duplicates/review",
            json={"track_ids": [first_id, second_id, 999999], "groups": [[first_id, second_id]]},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual([track["id"] for track in body["tracks"]], [first_id, second_id])
        self.assertEqual(body["missing_track_ids"], [999999])
        self.assertEqual(body["groups"][0]["recommended_keep_id"], first_id)

    def test_acoustic_fingerprint_pass_reports_missing_tool_and_updates_when_available(self) -> None:
        audio_file = self.root / "fingerprint.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        with patch("backend.app.main.fpcalc_candidate_paths", return_value=[self.root / "missing-fpcalc.exe"]):
            missing = self.client.post("/library/tools/acoustic-fingerprints", json={"track_ids": [track_id]})
        self.assertEqual(missing.status_code, 200)
        self.assertFalse(missing.json()["tool_available"])

        fake_fpcalc = self.root / "path-fpcalc.exe"
        fake_fpcalc.write_bytes(b"not a real executable")
        with patch("backend.app.main.fpcalc_candidate_paths", return_value=[fake_fpcalc]), patch(
            "backend.app.main.acoustic_fingerprint_for_path",
            return_value="acoustic-token",
        ):
            updated = self.client.post("/library/tools/acoustic-fingerprints", json={"track_ids": [track_id]})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["updated"], 1)
        with connect() as conn:
            row = conn.execute("SELECT acoustic_fingerprint FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["acoustic_fingerprint"], "acoustic-token")

        with patch("backend.app.main.fpcalc_candidate_paths", return_value=[fake_fpcalc]):
            skipped = self.client.post("/library/tools/acoustic-fingerprints", json={"track_ids": [track_id]})
        self.assertEqual(skipped.status_code, 200)
        self.assertEqual(skipped.json()["updated"], 0)
        self.assertEqual(skipped.json()["skipped"], 1)
        self.assertIn("already has an acoustic fingerprint", skipped.json()["skipped_reasons"][0])

    def test_chromaprint_setup_can_use_saved_fpcalc_path_without_path(self) -> None:
        fake_fpcalc = self.root / "fpcalc.exe"
        fake_fpcalc.write_bytes(b"not a real executable")
        audio_file = self.root / "configured-fingerprint.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        setup = self.client.patch(
            "/library/tools/acoustic-fingerprints/setup",
            json={"fpcalc_path": str(fake_fpcalc)},
        )
        self.assertEqual(setup.status_code, 200)
        self.assertTrue(setup.json()["available"])
        self.assertEqual(canonical_path(setup.json()["resolved_path"]), canonical_path(fake_fpcalc))

        with patch("backend.app.main.shutil.which", return_value=None), patch(
            "backend.app.main.acoustic_fingerprint_for_path",
            return_value="configured-token",
        ) as fingerprint:
            updated = self.client.post("/library/tools/acoustic-fingerprints", json={"track_ids": [track_id]})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["updated"], 1)
        fingerprint.assert_called_once()
        self.assertEqual(canonical_path(fingerprint.call_args.args[1]), canonical_path(fake_fpcalc))

    def test_chromaprint_candidates_include_tauri_sibling_resource_folder(self) -> None:
        from backend.app import main as main_module

        packaged_backend = self.root / "Program Files" / "FLAC Cafe" / "flaccafe-backend" / "flaccafe-backend.exe"
        packaged_backend.parent.mkdir(parents=True)
        packaged_backend.write_bytes(b"exe")
        expected = packaged_backend.parent.parent / "tools" / "chromaprint" / "fpcalc.exe"

        with patch.object(main_module.sys, "executable", str(packaged_backend)):
            candidates = main_module.fpcalc_candidate_paths()

        self.assertIn(canonical_path(expected), [canonical_path(candidate) for candidate in candidates])

    def test_chromaprint_subprocesses_run_without_console_window(self) -> None:
        from backend.app import main as main_module

        fake_fpcalc = self.root / "fpcalc.exe"
        fake_track = self.root / "track.flac"
        fake_fpcalc.write_bytes(b"exe")
        fake_track.write_bytes(b"audio")

        version_result = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout="fpcalc version test\n",
            stderr="",
        )
        fingerprint_result = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps({"fingerprint": "fingerprint-token"}),
            stderr="",
        )

        with patch("backend.app.main.hidden_subprocess_creation_flags", return_value=12345), patch(
            "backend.app.main.subprocess.run",
            side_effect=[version_result, fingerprint_result],
        ) as run:
            self.assertEqual(main_module.fpcalc_version(fake_fpcalc), "fpcalc version test")
            self.assertEqual(main_module.acoustic_fingerprint_for_path(fake_track, str(fake_fpcalc)), "fingerprint-token")

        self.assertEqual(run.call_args_list[0].kwargs["creationflags"], 12345)
        self.assertEqual(run.call_args_list[1].kwargs["creationflags"], 12345)

    def test_clear_library_caches_endpoint_removes_derived_rows(self) -> None:
        audio_file = self.root / "cached.mp3"
        audio_file.write_bytes(b"audio")
        with connect() as conn:
            conn.execute(
                "INSERT INTO artist_info_cache(artist_key, artist_name, summary) VALUES('artist', 'Artist', 'Summary')"
            )
            conn.execute(
                """
                INSERT INTO track_metadata_cache(path_key, path, file_modified_at, file_size, metadata_json)
                VALUES('cache-key', ?, 'now', 1, '{}')
                """,
                (str(audio_file),),
            )
            conn.execute(
                """
                INSERT INTO artwork_cache(path_key, path, file_modified_at, file_size, media_type, data)
                VALUES('art-key', ?, 'now', 1, 'image/jpeg', ?)
                """,
                (str(audio_file), b"art"),
            )
            conn.execute(
                "INSERT INTO recommendation_runs(settings_json, drift_json, track_ids_json) VALUES('{}', '{}', '[]')"
            )
            conn.commit()

        response = self.client.post(
            "/library/maintenance/clear",
            json={"targets": ["artist", "artwork", "metadata", "recommendation_history"]},
        )

        self.assertEqual(response.status_code, 200)
        cleared = response.json()["cleared"]
        self.assertEqual(cleared["artist"], 1)
        self.assertEqual(cleared["artwork"], 1)
        self.assertEqual(cleared["metadata"], 1)
        self.assertEqual(cleared["recommendation_history"], 1)

    def test_wikipedia_lookup_ranks_hyphenated_artist_page(self) -> None:
        def fake_wikipedia_request(params: dict[str, object]) -> dict:
            if params.get("titles"):
                return {"query": {"pages": [{"missing": True}]}}
            return {
                "query": {
                    "pages": [
                        {
                            "title": "Anne-Marie discography",
                            "extract": "The discography of Anne-Marie consists of albums and singles.",
                            "fullurl": "https://en.wikipedia.org/wiki/Anne-Marie_discography",
                        },
                        {
                            "title": "Ann Marie",
                            "extract": "Joann Marie Slater, known as Ann Marie, is an American singer and rapper.",
                            "fullurl": "https://en.wikipedia.org/wiki/Ann_Marie",
                        },
                        {
                            "title": "Anne-Marie",
                            "extract": "Anne-Marie Rose Nicholson is an English singer and songwriter.",
                            "fullurl": "https://en.wikipedia.org/wiki/Anne-Marie",
                        },
                    ]
                }
            }

        with patch("backend.app.main.wikipedia_request", side_effect=fake_wikipedia_request):
            info = fetch_artist_info_from_wikipedia("Anne-Marie")

        self.assertEqual(info["artist_name"], "Anne-Marie")
        self.assertEqual(info["page_url"], "https://en.wikipedia.org/wiki/Anne-Marie")

    def test_delete_endpoint_can_remove_file(self) -> None:
        audio_file = self.root / "delete-me.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        response = self.client.delete(f"/tracks/{track_id}?delete_file=true")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["deleted_file"])
        self.assertFalse(audio_file.exists())

    def test_bulk_delete_endpoint_removes_tracks_in_one_request(self) -> None:
        first_file = self.root / "bulk-delete-a.mp3"
        second_file = self.root / "bulk-delete-b.flac"
        kept_file = self.root / "bulk-keep.mp3"
        for audio_file in [first_file, second_file, kept_file]:
            audio_file.write_bytes(b"audio")
        first_id = insert_track(first_file)
        second_id = insert_track(second_file)
        kept_id = insert_track(kept_file)
        with connect() as conn:
            for audio_file in [first_file, second_file, kept_file]:
                conn.execute(
                    """
                    INSERT INTO track_metadata_cache(path_key, path, file_modified_at, file_size, metadata_json)
                    VALUES(?, ?, 'now', ?, '{}')
                    """,
                    (path_key(audio_file), str(audio_file), audio_file.stat().st_size),
                )
            conn.commit()

        response = self.client.post(
            "/tracks/delete",
            json={"track_ids": [first_id, second_id], "delete_file": False},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["removed_count"], 2)
        self.assertEqual(body["removed_track_ids"], [first_id, second_id])
        self.assertEqual(body["deleted_files"], 0)
        self.assertTrue(first_file.exists())
        self.assertTrue(second_file.exists())
        with connect() as conn:
            removed_rows = conn.execute(
                "SELECT id FROM tracks WHERE id IN (?, ?)",
                (first_id, second_id),
            ).fetchall()
            kept_row = conn.execute("SELECT id FROM tracks WHERE id = ?", (kept_id,)).fetchone()
            removed_cache = conn.execute(
                "SELECT path_key FROM track_metadata_cache WHERE path_key IN (?, ?)",
                (path_key(first_file), path_key(second_file)),
            ).fetchall()
            undo_rows = conn.execute(
                "SELECT id FROM bulk_action_undo_log WHERE action_type = 'track_remove'"
            ).fetchall()
        self.assertEqual(removed_rows, [])
        self.assertIsNotNone(kept_row)
        self.assertEqual(removed_cache, [])
        self.assertEqual(len(undo_rows), 2)

    def test_restore_endpoint_rescans_removed_track(self) -> None:
        audio_file = self.root / "restore-me.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)
        self.client.delete(f"/tracks/{track_id}?delete_file=false")

        with patch(
            "backend.app.main.read_metadata",
            return_value={
                "path": str(audio_file),
                "path_key": path_key(audio_file),
                "title": "Restored",
                "artist": "API Artist",
                "album": "API Album",
                "album_artist": "API Artist",
                "track_number": None,
                "disc_number": None,
                "genre": "Rock",
                "year": 2024,
                "duration_seconds": 180.0,
                "rating": None,
                "file_modified_at": None,
            },
        ):
            response = self.client.post("/tracks/restore", json={"path": str(audio_file), "rating": 4.0})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["path"], str(audio_file))
        self.assertEqual(body["rating"], 4.0)

    def test_folder_watch_detects_adds_moves_and_deletes(self) -> None:
        old_file = self.root / "old-name.mp3"
        old_file.write_bytes(b"same-audio" * 2048)
        moved_fingerprint = file_fingerprint(old_file)
        insert_track(old_file, title="Moved Song", audio_fingerprint=moved_fingerprint)
        moved_file = self.root / "new-name.mp3"
        old_file.rename(moved_file)

        missing_file = self.root / "missing.mp3"
        missing_file.write_bytes(b"missing-audio")
        insert_track(missing_file, title="Missing Song")
        missing_file.unlink()

        added_file = self.root / "added.mp3"
        added_file.write_bytes(b"brand-new-audio")

        with connect() as conn:
            set_setting(conn, "library_path", str(self.root))
            conn.commit()

        response = self.client.post("/library/watch/refresh", json={"folder_path": str(self.root), "limit": 50})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["counts"]["moved"], 1)
        self.assertEqual(body["counts"]["removed"], 1)
        self.assertEqual(body["counts"]["added"], 1)
        self.assertEqual(body["pending_count"], 3)
        latest_notification = body["notifications"][-1]
        self.assertEqual(latest_notification["pending_count"], 3)
        self.assertIn("added", latest_notification["message"])

        ack = self.client.post(
            "/library/watch/notifications/ack",
            json={"notification_ids": [latest_notification["id"]]},
        )
        self.assertEqual(ack.status_code, 200)
        acknowledged = {notification["id"]: notification["acknowledged"] for notification in ack.json()["notifications"]}
        self.assertTrue(acknowledged[latest_notification["id"]])

    def test_folder_watch_apply_removes_missing_track(self) -> None:
        audio_file = self.root / "gone.mp3"
        audio_file.write_bytes(b"gone-audio")
        track_id = insert_track(audio_file, title="Gone Song")
        audio_file.unlink()

        with connect() as conn:
            set_setting(conn, "library_path", str(self.root))
            conn.commit()

        refresh = self.client.post("/library/watch/refresh", json={"folder_path": str(self.root)})
        self.assertEqual(refresh.status_code, 200)
        self.assertEqual(refresh.json()["counts"]["removed"], 1)

        response = self.client.post("/library/watch/apply", json={"apply_all": True})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["removed"], 1)
        with connect() as conn:
            row = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertIsNone(row)

    def test_folder_watch_apply_move_preserves_rating(self) -> None:
        old_file = self.root / "before.mp3"
        old_file.write_bytes(b"move-me" * 2048)
        moved_fingerprint = file_fingerprint(old_file)
        track_id = insert_track(old_file, title="Before", rating=4.5, audio_fingerprint=moved_fingerprint)
        moved_file = self.root / "after.mp3"
        old_file.rename(moved_file)

        with connect() as conn:
            set_setting(conn, "library_path", str(self.root))
            conn.commit()

        refresh = self.client.post("/library/watch/refresh", json={"folder_path": str(self.root)})
        self.assertEqual(refresh.status_code, 200)
        moved_ids = [
            change["id"]
            for change in refresh.json()["changes"]
            if change["change_type"] == "moved"
        ]
        self.assertEqual(len(moved_ids), 1)

        metadata = {
            "path": str(moved_file),
            "path_key": path_key(moved_file),
            "title": "After",
            "artist": "API Artist",
            "album": "API Album",
            "album_artist": "API Artist",
            "track_number": None,
            "disc_number": None,
            "genre": "Rock",
            "year": 2024,
            "duration_seconds": 180.0,
            "bitrate": 320000,
            "replaygain_track_gain_db": None,
            "replaygain_album_gain_db": None,
            "replaygain_track_peak": None,
            "replaygain_album_peak": None,
            "audio_fingerprint": moved_fingerprint,
            "rating": None,
            "file_modified_at": file_modified_at(moved_file),
        }
        with patch("backend.app.library_watcher.read_metadata_cached", return_value=metadata):
            response = self.client.post("/library/watch/apply", json={"change_ids": moved_ids})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["moved"], 1)
        with connect() as conn:
            row = conn.execute("SELECT path, title, rating FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["path"], str(moved_file))
        self.assertEqual(row["title"], "After")
        self.assertEqual(row["rating"], 4.5)

    def test_musicbrainz_auto_tag_track_preview_and_apply_with_artwork(self) -> None:
        audio_file = self.root / "song.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Known Song", artist=None, album=None, genre=None, year=None)
        recording = {
            "id": "recording-1",
            "score": "100",
            "title": "Known Song",
            "artist-credit": [{"name": "Known Artist"}],
            "releases": [
                {
                    "id": "release-1",
                    "title": "Known Album",
                    "date": "2022-04-01",
                    "artist-credit": [{"name": "Known Artist"}],
                }
            ],
        }

        with patch("backend.app.musicbrainz_autotag.search_recordings", return_value=[recording]), patch(
            "backend.app.musicbrainz_autotag.cover_art_for_release",
            return_value={"image_url": "https://cover.example/front.jpg", "thumbnail_url": "https://cover.example/thumb.jpg"},
        ):
            preview = self.client.post(
                "/library/tools/autotag",
                json={"mode": "track", "track_ids": [track_id], "missing_only": True, "include_artwork": True},
            )

        self.assertEqual(preview.status_code, 200)
        preview_body = preview.json()
        self.assertEqual(preview_body["matched"], 1)
        self.assertEqual(preview_body["artwork_matches"], 1)
        self.assertIn("artist", preview_body["previews"][0]["changed_fields"])
        self.assertIn("album", preview_body["previews"][0]["changed_fields"])
        self.assertIn("year", preview_body["previews"][0]["changed_fields"])

        with patch("backend.app.musicbrainz_autotag.search_recordings", return_value=[recording]), patch(
            "backend.app.musicbrainz_autotag.cover_art_for_release",
            return_value={"image_url": "https://cover.example/front.jpg", "thumbnail_url": "https://cover.example/thumb.jpg"},
        ), patch("backend.app.main.download_cover_art", return_value=(b"image-bytes", "image/jpeg")):
            applied = self.client.post(
                "/library/tools/autotag",
                json={
                    "mode": "track",
                    "track_ids": [track_id],
                    "missing_only": True,
                    "include_artwork": True,
                    "save_artwork": True,
                    "apply": True,
                },
            )

        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.json()["applied"], 1)
        self.assertEqual(applied.json()["artwork_saved"], 1)
        with connect() as conn:
            row = conn.execute(
                """
                SELECT tracks.artist, tracks.album, tracks.year, albums.artwork_path
                FROM tracks
                LEFT JOIN albums ON albums.id = tracks.album_id
                WHERE tracks.id = ?
                """,
                (track_id,),
            ).fetchone()
        self.assertEqual(row["artist"], "Known Artist")
        self.assertEqual(row["album"], "Known Album")
        self.assertEqual(row["year"], 2022)
        self.assertTrue(Path(row["artwork_path"]).exists())

    def test_auto_tag_uses_acoustid_fingerprint_lookup_when_configured(self) -> None:
        audio_file = self.root / "no-tears.flac"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(
            audio_file,
            title="no tears left to cr",
            artist="Ariana Grande",
            album="Sweetener",
            acoustic_fingerprint="fingerprint-token",
            duration_seconds=207.0,
        )
        recording = {
            "id": "acoustid-recording",
            "_acoustid_score": 0.98,
            "score": 98,
            "title": "no tears left to cry",
            "artist-credit": [{"name": "Ariana Grande"}],
            "releases": [
                {
                    "id": "sweetener-release",
                    "title": "Sweetener",
                    "date": "2018-08-17",
                    "artist-credit": [{"name": "Ariana Grande"}],
                    "release-group": {"primary-type": "Album", "secondary-types": []},
                }
            ],
        }
        with connect() as conn:
            set_setting(conn, "acoustid_api_key", "client-key-123")
            conn.commit()

        with patch("backend.app.musicbrainz_autotag.lookup_acoustid_recordings", return_value=[recording]) as lookup, patch(
            "backend.app.musicbrainz_autotag.search_recordings"
        ) as search_recordings, patch("backend.app.musicbrainz_autotag.cover_art_for_release", return_value=None):
            response = self.client.post(
                "/library/tools/autotag",
                json={"mode": "track", "track_ids": [track_id], "missing_only": False, "include_artwork": False},
            )

        self.assertEqual(response.status_code, 200)
        lookup.assert_called_once()
        self.assertEqual(lookup.call_args.args[0], "client-key-123")
        search_recordings.assert_not_called()
        preview = response.json()["previews"][0]
        self.assertEqual(preview["source"], "AcoustID + MusicBrainz")
        self.assertEqual(preview["recording_id"], "acoustid-recording")
        self.assertEqual(preview["proposed"]["title"], "no tears left to cry")
        self.assertIn("title", preview["changed_fields"])

    def test_fingerprint_only_auto_tag_does_not_fall_back_to_metadata_search(self) -> None:
        audio_file = self.root / "wrong-tags.flac"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(
            audio_file,
            title="Existing Metadata Title",
            artist="Existing Metadata Artist",
            album="Existing Metadata Album",
            acoustic_fingerprint="fingerprint-token",
            duration_seconds=207.0,
        )
        with connect() as conn:
            set_setting(conn, "acoustid_api_key", "client-key-123")
            conn.commit()

        with patch("backend.app.musicbrainz_autotag.lookup_acoustid_recordings", return_value=[]) as lookup, patch(
            "backend.app.musicbrainz_autotag.search_recordings"
        ) as search_recordings:
            response = self.client.post(
                "/library/tools/autotag",
                json={
                    "mode": "track",
                    "track_ids": [track_id],
                    "missing_only": False,
                    "include_artwork": False,
                    "fingerprint_only": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        lookup.assert_called_once()
        search_recordings.assert_not_called()
        body = response.json()
        self.assertEqual(body["matched"], 0)
        preview = body["previews"][0]
        self.assertEqual(preview["source"], "AcoustID + MusicBrainz")
        self.assertIn("No AcoustID recording match", preview["error"])

    def test_musicbrainz_auto_tag_prefers_artist_release_over_compilation(self) -> None:
        audio_file = self.root / "positions.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(
            audio_file,
            title="positions",
            artist="Ariana Grande",
            album="Wrong Album",
            genre="Wrong Genre",
            year=None,
        )
        recordings = [
            {
                "id": "compilation-recording",
                "score": "100",
                "title": "Positions",
                "artist-credit": [{"name": "Ariana Grande"}],
                "releases": [
                    {
                        "id": "compilation-release",
                        "title": "NRJ Music Awards 2021",
                        "date": "2021-02-27",
                        "status": "Official",
                        "artist-credit": [{"name": "Various Artists"}],
                        "release-group": {"primary-type": "Album", "secondary-types": ["Compilation"]},
                    }
                ],
            },
            {
                "id": "artist-recording",
                "score": "100",
                "title": "positions",
                "artist-credit": [{"name": "Ariana Grande"}],
                "releases": [
                    {
                        "id": "artist-release",
                        "title": "positions",
                        "date": "2021-07-22",
                        "status": "Official",
                        "artist-credit": [{"name": "Ariana Grande"}],
                        "release-group": {"primary-type": "Single", "secondary-types": []},
                    }
                ],
            },
        ]

        with patch("backend.app.musicbrainz_autotag.search_recordings", return_value=recordings), patch(
            "backend.app.musicbrainz_autotag.cover_art_for_release",
            return_value=None,
        ):
            response = self.client.post(
                "/library/tools/autotag",
                json={"mode": "track", "track_ids": [track_id], "missing_only": False, "include_artwork": False},
            )

        self.assertEqual(response.status_code, 200)
        preview = response.json()["previews"][0]
        self.assertEqual(preview["release_id"], "artist-release")
        self.assertEqual(preview["proposed"]["album"], "positions")
        self.assertIn("album", preview["changed_fields"])

    def test_musicbrainz_auto_tag_write_to_file_flag_controls_file_writes(self) -> None:
        audio_file = self.root / "autotag-file-write.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Known Song", artist="Known Artist", album=None, genre=None, year=None)
        recording = {
            "id": "recording-1",
            "score": "100",
            "title": "Known Song",
            "artist-credit": [{"name": "Known Artist"}],
            "releases": [
                {
                    "id": "release-1",
                    "title": "Known Album",
                    "date": "2022",
                    "artist-credit": [{"name": "Known Artist"}],
                }
            ],
        }
        with connect() as conn:
            set_setting(conn, "write_ratings_to_files", "1")
            conn.commit()

        with patch("backend.app.musicbrainz_autotag.search_recordings", return_value=[recording]), patch(
            "backend.app.musicbrainz_autotag.cover_art_for_release",
            return_value=None,
        ), patch("backend.app.main.write_track_metadata") as write_metadata:
            response = self.client.post(
                "/library/tools/autotag",
                json={
                    "mode": "track",
                    "track_ids": [track_id],
                    "missing_only": True,
                    "include_artwork": False,
                    "write_to_file": False,
                    "apply": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["applied"], 1)
        write_metadata.assert_not_called()

        with connect() as conn:
            conn.execute("UPDATE tracks SET album = 'Wrong Album', year = NULL WHERE id = ?", (track_id,))
            conn.commit()

        with patch("backend.app.musicbrainz_autotag.search_recordings", return_value=[recording]), patch(
            "backend.app.musicbrainz_autotag.cover_art_for_release",
            return_value=None,
        ), patch("backend.app.main.write_track_metadata") as write_metadata:
            response = self.client.post(
                "/library/tools/autotag",
                json={
                    "mode": "track",
                    "track_ids": [track_id],
                    "missing_only": False,
                    "include_artwork": False,
                    "write_to_file": True,
                    "apply": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        write_metadata.assert_called_once()

    def test_musicbrainz_auto_tag_album_mode_matches_track_numbers(self) -> None:
        first_file = self.root / "one.mp3"
        second_file = self.root / "two.mp3"
        first_file.write_bytes(b"one")
        second_file.write_bytes(b"two")
        first_id = insert_track(first_file, title="Placeholder 1", artist="Album Artist", album="Album Title", track_number=1)
        second_id = insert_track(second_file, title="Placeholder 2", artist="Album Artist", album="Album Title", track_number=2)
        release = {
            "id": "release-album",
            "title": "Album Title",
            "date": "2020",
            "artist-credit": [{"name": "Album Artist"}],
            "media": [
                {
                    "position": 1,
                    "tracks": [
                        {"number": "1", "title": "Real Opener", "recording": {"id": "rec-1", "title": "Real Opener"}},
                        {"number": "2", "title": "Real Closer", "recording": {"id": "rec-2", "title": "Real Closer"}},
                    ],
                }
            ],
        }

        with patch("backend.app.musicbrainz_autotag.search_releases", return_value=[{"id": "release-album", "score": "100"}]), patch(
            "backend.app.musicbrainz_autotag.lookup_release",
            return_value=release,
        ), patch("backend.app.musicbrainz_autotag.cover_art_for_release", return_value=None):
            response = self.client.post(
                "/library/tools/autotag",
                json={"mode": "album", "track_ids": [first_id, second_id], "missing_only": False, "include_artwork": False},
            )

        self.assertEqual(response.status_code, 200)
        proposals = {preview["track_id"]: preview["proposed"]["title"] for preview in response.json()["previews"]}
        self.assertEqual(proposals[first_id], "Real Opener")
        self.assertEqual(proposals[second_id], "Real Closer")

    def test_clap_genre_tags_preview_and_apply(self) -> None:
        audio_file = self.root / "clap-genre.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Genre Candidate", artist="CLAP Artist", album="CLAP Album", genre=None)
        with connect() as conn:
            conn.execute(
                """
                UPDATE tracks
                SET analysis_provider = 'clap', analysis_genre = 'electronic', analysis_genre_confidence = 0.82
                WHERE id = ?
                """,
                (track_id,),
            )
            conn.commit()

        preview = self.client.post(
            "/library/tools/clap-genre-tags",
            json={"track_ids": [track_id], "missing_only": True, "min_confidence": 0.5},
        )

        self.assertEqual(preview.status_code, 200)
        preview_body = preview.json()
        self.assertEqual(preview_body["matched"], 1)
        self.assertEqual(preview_body["changed"], 1)
        self.assertEqual(preview_body["previews"][0]["proposed_genre"], "electronic")
        self.assertFalse(preview_body["previews"][0]["applied"])

        applied = self.client.post(
            "/library/tools/clap-genre-tags",
            json={"track_ids": [track_id], "missing_only": True, "min_confidence": 0.5, "apply": True},
        )

        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.json()["applied"], 1)
        with connect() as conn:
            genre = conn.execute("SELECT genre FROM tracks WHERE id = ?", (track_id,)).fetchone()["genre"]
        self.assertEqual(genre, "electronic")

    def test_library_health_duplicate_groups_include_keep_recommendation(self) -> None:
        first = self.root / "duplicate-a.mp3"
        second = self.root / "duplicate-b.mp3"
        first.write_bytes(b"duplicate-a")
        second.write_bytes(b"duplicate-b")
        first_id = insert_track(
            first,
            title="Duplicate Song",
            artist="Duplicate Artist",
            rating=5.0,
            bitrate=320000,
            audio_fingerprint="same-fast-fingerprint",
            acoustic_fingerprint="same-acoustic-fingerprint",
            analysis_embedding=json.dumps([1.0, 0.0]),
        )
        second_id = insert_track(
            second,
            title="Duplicate Song",
            artist="Duplicate Artist",
            rating=3.0,
            bitrate=128000,
            audio_fingerprint="same-fast-fingerprint",
            acoustic_fingerprint="same-acoustic-fingerprint",
            analysis_embedding=json.dumps([0.95, 0.05]),
        )

        response = self.client.get("/library/health")

        self.assertEqual(response.status_code, 200)
        groups = response.json()["duplicate_groups"]
        duplicate = next(group for group in groups if group["key"] == "Duplicate Song - Duplicate Artist")
        self.assertEqual(duplicate["recommended_keep_id"], first_id)
        self.assertTrue(duplicate["shared_fingerprint"])
        self.assertTrue(duplicate["shared_acoustic_fingerprint"])
        self.assertEqual(duplicate["bitrate_spread"], 192000)
        self.assertEqual({track["id"] for track in duplicate["tracks"]}, {first_id, second_id})

    def test_similar_tracks_endpoint_ranks_audio_neighbor(self) -> None:
        seed_file = self.root / "seed.mp3"
        close_file = self.root / "close.mp3"
        far_file = self.root / "far.mp3"
        for audio_file in (seed_file, close_file, far_file):
            audio_file.write_bytes(b"audio")
        seed_id = insert_track(seed_file, title="Seed", artist="Seed Artist", analysis_embedding=json.dumps([1.0, 0.0]))
        close_id = insert_track(
            close_file,
            title="Close",
            artist="Different Artist",
            genre="Rock",
            analysis_embedding=json.dumps([0.98, 0.02]),
        )
        insert_track(
            far_file,
            title="Far",
            artist="Other Artist",
            genre="Jazz",
            analysis_embedding=json.dumps([0.0, 1.0]),
        )

        response = self.client.get(f"/tracks/{seed_id}/similar")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertGreaterEqual(len(body), 1)
        self.assertEqual(body[0]["id"], close_id)
        self.assertGreater(body[0]["audio_similarity"], 0.9)

    def test_autodj_generate_returns_drift_summary(self) -> None:
        seed_track_id = None
        for index in range(5):
            audio_file = self.root / f"queue-{index}.mp3"
            audio_file.write_bytes(b"audio")
            track_id = insert_track(
                audio_file,
                title=f"Queue {index}",
                artist=f"Artist {index % 2}",
                album=f"Album {index}",
                rating=5.0 if index == 0 else None,
                analysis_embedding=json.dumps([1.0, float(index)]),
                duration_seconds=180 + index,
            )
            if index == 0:
                seed_track_id = track_id

        response = self.client.post(
            "/autodj/generate",
            json={
                "queue_length": 4,
                "seed": 123,
                "seed_track_id": seed_track_id,
                "temperature": 0.8,
                "unrated_exploration_percent": 25,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["tracks"]), 4)
        self.assertEqual(body["tracks"][0]["id"], seed_track_id)
        self.assertIn("seed track", body["tracks"][0]["reason"])
        self.assertEqual(body["drift"]["total_tracks"], 4)
        self.assertGreaterEqual(body["drift"]["exploration_percent"], 0)
        self.assertIn("average_rating", body["drift"])

        history = self.client.get("/autodj/history")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["drift"]["total_tracks"], 4)
        self.assertEqual(len(history.json()[0]["track_ids"]), 4)

    def test_recommendation_drift_counts_rated_unplayed_as_familiar(self) -> None:
        tracks = [
            {"id": index, "artist": f"Artist {index}", "album": f"Album {index}", "rating": 3.0, "play_count": 0}
            for index in range(4)
        ]

        drift = recommendation_drift(tracks)

        self.assertEqual(drift.familiar_percent, 100)
        self.assertEqual(drift.exploration_percent, 0)

    def test_recommendation_profiles_round_trip_and_default(self) -> None:
        create_response = self.client.post(
            "/autodj/profiles",
            json={
                "name": "Late Night",
                "is_default": True,
                "settings": {
                    "queue_length": 12,
                    "temperature": 1.1,
                    "artist_cooldown": 4,
                    "target_unrated_percent": 15,
                    "max_repeat_artist_percent": 20,
                },
            },
        )

        self.assertEqual(create_response.status_code, 200)
        profile = create_response.json()
        self.assertTrue(profile["is_default"])
        self.assertEqual(profile["settings"]["queue_length"], 12)
        self.assertEqual(profile["settings"]["target_unrated_percent"], 15)
        self.assertEqual(profile["settings"]["max_repeat_artist_percent"], 20)

        second_response = self.client.post(
            "/autodj/profiles",
            json={"name": "Deep Cuts", "settings": {"queue_length": 20, "unrated_exploration_percent": 30}},
        )
        self.assertEqual(second_response.status_code, 200)
        second_id = second_response.json()["id"]

        default_response = self.client.post(f"/autodj/profiles/{second_id}/default")
        self.assertEqual(default_response.status_code, 200)
        defaults = [item for item in default_response.json() if item["is_default"]]
        self.assertEqual(len(defaults), 1)
        self.assertEqual(defaults[0]["name"], "Deep Cuts")

        compare_response = self.client.post(
            "/autodj/profiles/compare",
            json={"profile_ids": [profile["id"], second_id], "seed": 7},
        )
        self.assertEqual(compare_response.status_code, 200)
        self.assertEqual({item["profile"]["name"] for item in compare_response.json()}, {"Late Night", "Deep Cuts"})

        export_response = self.client.post(
            "/autodj/profiles/compare/export",
            json={"profile_ids": [profile["id"], second_id], "seed": 7},
        )
        self.assertEqual(export_response.status_code, 200)
        export_path = Path(export_response.json()["export_path"])
        self.assertTrue(export_path.exists())
        payload = json.loads(export_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["seed"], 7)
        self.assertEqual(len(payload["comparisons"]), 2)

        import_response = self.client.post(
            "/autodj/profiles/compare/import",
            json={"report_path": str(export_path)},
        )
        self.assertEqual(import_response.status_code, 200)
        self.assertEqual(import_response.json()["seed"], 7)
        self.assertEqual(len(import_response.json()["comparisons"]), 2)
        export_path.unlink(missing_ok=True)

        delete_response = self.client.delete(f"/autodj/profiles/{second_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertNotIn(second_id, {item["id"] for item in delete_response.json()})

    def test_recommendation_ab_test_records_chosen_queue_feedback(self) -> None:
        track_ids = []
        for index in range(6):
            audio_file = self.root / f"ab-{index}.mp3"
            audio_file.write_bytes(b"audio")
            track_ids.append(
                insert_track(
                    audio_file,
                    title=f"AB {index}",
                    artist=f"Artist {index}",
                    rating=4.0 if index % 2 else None,
                    duration_seconds=180,
                )
            )

        response = self.client.post(
            "/autodj/ab-test",
            json={
                "seed": 42,
                "base_settings": {
                    "queue_length": 4,
                    "temperature": 0.7,
                    "target_exploration_percent": 25,
                    "max_repeat_artist_percent": 25,
                },
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual({queue["label"] for queue in body["queues"]}, {"A", "B"})
        chosen_ids = [track["id"] for track in body["queues"][0]["tracks"]]

        choose_response = self.client.post(
            "/autodj/ab-test/choose",
            json={
                "test_id": body["test_id"],
                "chosen_label": "A",
                "chosen_track_ids": chosen_ids,
                "feedback_weight": 0.4,
            },
        )

        self.assertEqual(choose_response.status_code, 200)
        self.assertEqual(choose_response.json()["inserted_feedback"], len(chosen_ids))
        with connect() as conn:
            total_weight = conn.execute("SELECT ROUND(SUM(weight), 2) AS total FROM recommendation_feedback").fetchone()["total"]
        self.assertEqual(total_weight, round(len(chosen_ids) * 0.4, 2))

    def test_artwork_endpoint_caches_embedded_artwork(self) -> None:
        audio_file = self.root / "artwork.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        with patch("backend.app.main.embedded_artwork", return_value=(b"image-bytes", "image/jpeg")) as artwork:
            first = self.client.get(f"/tracks/{track_id}/artwork")
            second = self.client.get(f"/tracks/{track_id}/artwork")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.content, b"image-bytes")
        artwork.assert_called_once()

    def test_album_artwork_candidates_choose_sidecar_and_serve_image(self) -> None:
        album_dir = self.root / "Music" / "Album"
        album_dir.mkdir(parents=True)
        audio_file = album_dir / "song.mp3"
        audio_file.write_bytes(b"audio")
        cover = album_dir / "cover.jpg"
        cover.write_bytes(b"cover-bytes")
        with connect() as conn:
            conn.execute("INSERT INTO albums(album, album_artist, year) VALUES('Art Album', 'Art Artist', 2026)")
            album_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
            conn.commit()
        insert_track(audio_file, album="Art Album", album_artist="Art Artist", album_id=album_id)

        candidates = self.client.get(f"/albums/{album_id}/artwork-candidates")
        self.assertEqual(candidates.status_code, 200)
        self.assertTrue(any(item["path"] == str(cover.resolve()) for item in candidates.json()["candidates"]))

        selected = self.client.patch(f"/albums/{album_id}/artwork", json={"artwork_path": str(cover)})
        self.assertEqual(selected.status_code, 200)
        self.assertEqual(selected.json()["artwork_path"], str(cover.resolve()))

        image = self.client.get(f"/albums/{album_id}/artwork")
        self.assertEqual(image.status_code, 200)
        self.assertEqual(image.content, b"cover-bytes")

    def test_album_artwork_web_search_saves_sidecar_and_embeds_files(self) -> None:
        album_dir = self.root / "Music" / "Web Album"
        album_dir.mkdir(parents=True)
        first_file = album_dir / "one.mp3"
        second_file = album_dir / "two.mp3"
        first_file.write_bytes(b"one")
        second_file.write_bytes(b"two")
        with connect() as conn:
            conn.execute("INSERT INTO albums(album, album_artist, year) VALUES('Web Album', 'Web Artist', 2026)")
            album_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
            conn.commit()
        insert_track(first_file, album="Web Album", album_artist="Web Artist", album_id=album_id)
        insert_track(second_file, album="Web Album", album_artist="Web Artist", album_id=album_id)

        with patch(
            "backend.app.main.search_releases",
            return_value=[
                {
                    "id": "release-web",
                    "title": "Web Album",
                    "artist-credit-phrase": "Web Artist",
                    "date": "2026-01-01",
                }
            ],
        ), patch(
            "backend.app.main.cover_art_for_release",
            return_value={"image_url": "https://cover.example/front.jpg", "thumbnail_url": "https://cover.example/thumb.jpg"},
        ):
            search = self.client.get(f"/albums/{album_id}/artwork-search")

        self.assertEqual(search.status_code, 200)
        self.assertEqual(search.json()["candidates"][0]["source"], "web")
        self.assertEqual(search.json()["candidates"][0]["release_id"], "release-web")

        with patch("backend.app.main.download_cover_art", return_value=(b"web-cover", "image/jpeg")), patch(
            "backend.app.main.write_track_artwork"
        ) as write_artwork:
            saved = self.client.patch(
                f"/albums/{album_id}/artwork",
                json={
                    "artwork_url": "https://cover.example/front.jpg",
                    "save_web_as_sidecar": True,
                    "embed_to_files": True,
                    "sidecar_filename": "cover-web",
                },
            )

        self.assertEqual(saved.status_code, 200)
        body = saved.json()
        self.assertEqual(body["embedded_updated"], 2)
        self.assertEqual(write_artwork.call_count, 2)
        artwork_path = Path(body["artwork_path"])
        self.assertTrue(artwork_path.exists())
        self.assertEqual(artwork_path.read_bytes(), b"web-cover")

    def test_artwork_collision_preview_and_apply_creates_album_specific_sidecars(self) -> None:
        album_dir = self.root / "Music" / "Split Folder"
        album_dir.mkdir(parents=True)
        shared_cover = album_dir / "cover.jpg"
        shared_cover.write_bytes(b"shared-cover")
        first_file = album_dir / "album-a.mp3"
        second_file = album_dir / "album-b.mp3"
        first_file.write_bytes(b"one")
        second_file.write_bytes(b"two")
        with connect() as conn:
            conn.execute("INSERT INTO albums(album, album_artist, year) VALUES('Album A', 'Artist A', 2026)")
            first_album_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
            conn.execute("INSERT INTO albums(album, album_artist, year) VALUES('Album B', 'Artist B', 2026)")
            second_album_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
            conn.commit()
        insert_track(first_file, album="Album A", album_artist="Artist A", album_id=first_album_id)
        insert_track(second_file, album="Album B", album_artist="Artist B", album_id=second_album_id)

        with patch("backend.app.main.embedded_artwork", return_value=None):
            preview = self.client.post("/library/tools/artwork-collisions", json={"limit": 10})

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["total"], 2)

        with patch("backend.app.main.embedded_artwork", return_value=None):
            applied = self.client.post("/library/tools/artwork-collisions", json={"limit": 10, "apply": True})

        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.json()["repaired"], 2)
        with connect() as conn:
            paths = [
                Path(row["artwork_path"])
                for row in conn.execute("SELECT artwork_path FROM albums ORDER BY album").fetchall()
            ]
        self.assertEqual(len(paths), 2)
        self.assertTrue(all(path.exists() for path in paths))
        self.assertTrue(all(path != shared_cover for path in paths))
        self.assertEqual({path.read_bytes() for path in paths}, {b"shared-cover"})

    def test_lyrics_endpoint_prefers_database_edits(self) -> None:
        audio_file = self.root / "lyrics.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        saved = self.client.patch(
            f"/tracks/{track_id}/lyrics",
            json={"lyrics": "line one\nline two", "target": "database", "is_synced": False},
        )
        fetched = self.client.get(f"/tracks/{track_id}/lyrics")

        self.assertEqual(saved.status_code, 200)
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()["lyrics"], "line one\nline two")
        self.assertEqual(fetched.json()["source"], "database:manual")

    def test_lyrics_fetch_endpoint_returns_lrclib_text(self) -> None:
        audio_file = self.root / "fetch-lyrics.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Fetch Song", artist="Fetch Artist", album="Fetch Album")

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self) -> bytes:
                return json.dumps({"syncedLyrics": "[00:01.00] hello", "plainLyrics": "hello"}).encode("utf-8")

        with patch("backend.app.main.urlrequest.urlopen", return_value=FakeResponse()):
            response = self.client.post(f"/tracks/{track_id}/lyrics/fetch")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lyrics"], "[00:01.00] hello")
        self.assertTrue(response.json()["is_synced"])

    def test_lyrics_fetch_can_cache_synced_lrc_sidecar(self) -> None:
        audio_file = self.root / "cached-lyrics.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Cached Song", artist="Cached Artist", album="Cached Album")
        with connect() as conn:
            set_setting(conn, "auto_write_fetched_lyrics_sidecars", "1")
            conn.commit()

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self) -> bytes:
                return json.dumps({"syncedLyrics": "[00:01.00] cached", "plainLyrics": "cached"}).encode("utf-8")

        with patch("backend.app.main.urlrequest.urlopen", return_value=FakeResponse()):
            response = self.client.post(f"/tracks/{track_id}/lyrics/fetch")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["source"], "sidecar-cache:lrclib:synced")
        sidecar_path = Path(body["sidecar_path"])
        self.assertEqual(sidecar_path.suffix, ".lrc")
        self.assertTrue(sidecar_path.exists())
        self.assertNotEqual(sidecar_path.parent, audio_file.parent)
        self.assertEqual(sidecar_path.read_text(encoding="utf-8").strip(), "[00:01.00] cached")

        fetched = self.client.get(f"/tracks/{track_id}/lyrics")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()["lyrics"], "[00:01.00] cached")
        self.assertEqual(Path(fetched.json()["sidecar_path"]), sidecar_path)


if __name__ == "__main__":
    unittest.main()
