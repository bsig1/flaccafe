from __future__ import annotations

import os
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.database import connect, init_db
from backend.app.main import app
from backend.app.scanner import path_key


def insert_track(path: Path, **overrides: object) -> int:
    values = {
        "path": str(path),
        "path_key": path_key(path),
        "title": overrides.get("title", path.stem),
        "artist": overrides.get("artist", "API Artist"),
        "album": overrides.get("album", "API Album"),
        "album_artist": overrides.get("album_artist", "API Artist"),
        "genre": overrides.get("genre", "Rock"),
        "year": overrides.get("year", 2024),
        "duration_seconds": overrides.get("duration_seconds", 180.0),
        "bitrate": overrides.get("bitrate"),
        "audio_fingerprint": overrides.get("audio_fingerprint"),
        "analysis_embedding": overrides.get("analysis_embedding"),
        "rating": overrides.get("rating"),
    }
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO tracks(
              path, path_key, title, artist, album, album_artist, genre, year,
              duration_seconds, bitrate, audio_fingerprint, analysis_embedding, rating, updated_at
            )
            VALUES(
              :path, :path_key, :title, :artist, :album, :album_artist, :genre,
              :year, :duration_seconds, :bitrate, :audio_fingerprint, :analysis_embedding, :rating, datetime('now')
            )
            """,
            values,
        )
        conn.commit()
        return int(cursor.lastrowid)


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

    def test_scan_endpoint_rejects_missing_folder(self) -> None:
        response = self.client.post("/scan", json={"folder_path": str(self.root / "Missing")})

        self.assertEqual(response.status_code, 400)

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

    def test_delete_endpoint_can_remove_file(self) -> None:
        audio_file = self.root / "delete-me.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        response = self.client.delete(f"/tracks/{track_id}?delete_file=true")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["deleted_file"])
        self.assertFalse(audio_file.exists())

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
            analysis_embedding=json.dumps([1.0, 0.0]),
        )
        second_id = insert_track(
            second,
            title="Duplicate Song",
            artist="Duplicate Artist",
            rating=3.0,
            bitrate=128000,
            audio_fingerprint="same-fast-fingerprint",
            analysis_embedding=json.dumps([0.95, 0.05]),
        )

        response = self.client.get("/library/health")

        self.assertEqual(response.status_code, 200)
        groups = response.json()["duplicate_groups"]
        duplicate = next(group for group in groups if group["key"] == "Duplicate Song - Duplicate Artist")
        self.assertEqual(duplicate["recommended_keep_id"], first_id)
        self.assertTrue(duplicate["shared_fingerprint"])
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
        for index in range(5):
            audio_file = self.root / f"queue-{index}.mp3"
            audio_file.write_bytes(b"audio")
            insert_track(
                audio_file,
                title=f"Queue {index}",
                artist=f"Artist {index % 2}",
                album=f"Album {index}",
                rating=5.0 if index == 0 else None,
                analysis_embedding=json.dumps([1.0, float(index)]),
                duration_seconds=180 + index,
            )

        response = self.client.post(
            "/autodj/generate",
            json={"queue_length": 4, "seed": 123, "temperature": 0.8, "unrated_exploration_percent": 25},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["tracks"]), 4)
        self.assertEqual(body["drift"]["total_tracks"], 4)
        self.assertGreaterEqual(body["drift"]["exploration_percent"], 0)
        self.assertIn("average_rating", body["drift"])

    def test_recommendation_profiles_round_trip_and_default(self) -> None:
        create_response = self.client.post(
            "/autodj/profiles",
            json={
                "name": "Late Night",
                "is_default": True,
                "settings": {"queue_length": 12, "temperature": 1.1, "artist_cooldown": 4},
            },
        )

        self.assertEqual(create_response.status_code, 200)
        profile = create_response.json()
        self.assertTrue(profile["is_default"])
        self.assertEqual(profile["settings"]["queue_length"], 12)

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

        delete_response = self.client.delete(f"/autodj/profiles/{second_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertNotIn(second_id, {item["id"] for item in delete_response.json()})


if __name__ == "__main__":
    unittest.main()
