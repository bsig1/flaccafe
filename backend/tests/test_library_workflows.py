from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.database import connect, get_setting, init_db, set_setting
from backend.app.scanner import path_key, read_metadata_cached, remove_missing_tracks


def insert_track(path: Path, **overrides: object) -> int:
    values = {
        "path": str(path),
        "path_key": path_key(path),
        "title": overrides.get("title", path.stem),
        "artist": overrides.get("artist", "Test Artist"),
        "album": overrides.get("album", "Test Album"),
        "album_artist": overrides.get("album_artist", "Test Artist"),
        "genre": overrides.get("genre", "Rock"),
        "year": overrides.get("year", 2024),
        "duration_seconds": overrides.get("duration_seconds", 180.0),
        "rating": overrides.get("rating"),
    }
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO tracks(
              path, path_key, title, artist, album, album_artist, genre, year,
              duration_seconds, rating, updated_at
            )
            VALUES(
              :path, :path_key, :title, :artist, :album, :album_artist, :genre,
              :year, :duration_seconds, :rating, datetime('now')
            )
            """,
            values,
        )
        conn.commit()
        return int(cursor.lastrowid)


class LibraryWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        os.environ["MUSIC_REC_DB"] = str(self.root / "music.sqlite3")
        init_db()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()
        os.environ.pop("MUSIC_REC_DB", None)

    def test_remove_missing_tracks_prunes_deleted_files_inside_scanned_folder(self) -> None:
        music_dir = self.root / "Music"
        music_dir.mkdir()
        existing_file = music_dir / "existing.mp3"
        missing_file = music_dir / "missing.mp3"
        existing_file.write_bytes(b"existing")
        missing_file.write_bytes(b"missing")
        existing_id = insert_track(existing_file)
        missing_id = insert_track(missing_file)
        missing_file.unlink()

        with connect() as conn:
            removed = remove_missing_tracks(conn, music_dir)
            conn.commit()
            rows = conn.execute("SELECT id FROM tracks ORDER BY id").fetchall()

        self.assertEqual(removed, 1)
        self.assertEqual([int(row["id"]) for row in rows], [existing_id])
        self.assertNotEqual(existing_id, missing_id)

    def test_remove_missing_tracks_can_use_native_snapshot_keys(self) -> None:
        music_dir = self.root / "Music"
        music_dir.mkdir()
        kept_file = music_dir / "kept.mp3"
        removed_file = music_dir / "removed.mp3"
        kept_file.write_bytes(b"kept")
        removed_file.write_bytes(b"still-present")
        kept_id = insert_track(kept_file)
        removed_id = insert_track(removed_file)

        with connect() as conn:
            removed = remove_missing_tracks(conn, music_dir, current_path_keys={path_key(kept_file)})
            conn.commit()
            rows = conn.execute("SELECT id FROM tracks ORDER BY id").fetchall()

        self.assertEqual(removed, 1)
        self.assertEqual([int(row["id"]) for row in rows], [kept_id])
        self.assertTrue(removed_file.exists())
        self.assertNotEqual(kept_id, removed_id)

    def test_delete_track_can_remove_the_database_row_and_audio_file(self) -> None:
        from backend.app.main import delete_track

        audio_file = self.root / "delete-me.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)

        result = delete_track(track_id, delete_file=True)

        self.assertTrue(result.removed_from_library)
        self.assertTrue(result.deleted_file)
        self.assertFalse(audio_file.exists())
        with connect() as conn:
            row = conn.execute("SELECT id FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertIsNone(row)

    def test_rating_write_setting_calls_audio_tag_writer(self) -> None:
        from backend.app.main import update_rating
        from backend.app.schemas import RatingRequest

        audio_file = self.root / "rated.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file)
        with connect() as conn:
            set_setting(conn, "write_ratings_to_files", "1")
            conn.commit()

        with patch("backend.app.main.write_track_rating") as write_rating:
            updated = update_rating(track_id, RatingRequest(rating=4.5))

        write_rating.assert_called_once_with(audio_file, 4.5)
        self.assertEqual(updated["rating"], 4.5)
        with connect() as conn:
            self.assertEqual(get_setting(conn, "write_ratings_to_files"), "1")
            row = conn.execute("SELECT rating FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["rating"], 4.5)

    def test_metadata_write_setting_calls_audio_tag_writer_and_updates_album(self) -> None:
        from backend.app.main import update_track_metadata
        from backend.app.schemas import TrackMetadataUpdateRequest

        audio_file = self.root / "metadata.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, album="Old Album", year=2020)
        with connect() as conn:
            set_setting(conn, "write_ratings_to_files", "1")
            conn.commit()

        request = TrackMetadataUpdateRequest(
            title="New Title",
            artist="New Artist",
            album="New Album",
            album_artist="New Artist",
            track_number=2,
            disc_number=1,
            genre="Synthpop",
            year=2025,
        )
        with patch("backend.app.main.write_track_metadata") as write_metadata:
            updated = update_track_metadata(track_id, request)

        write_metadata.assert_called_once()
        self.assertEqual(write_metadata.call_args.args[0], audio_file)
        self.assertEqual(write_metadata.call_args.args[1]["title"], "New Title")
        self.assertEqual(updated["title"], "New Title")
        self.assertEqual(updated["album"], "New Album")
        self.assertEqual(updated["year"], 2025)
        with connect() as conn:
            row = conn.execute(
                "SELECT album_id FROM tracks WHERE id = ?",
                (track_id,),
            ).fetchone()
        self.assertIsNotNone(row["album_id"])

    def test_metadata_update_can_write_file_when_request_overrides_setting(self) -> None:
        from backend.app.main import update_track_metadata
        from backend.app.schemas import TrackMetadataUpdateRequest

        audio_file = self.root / "metadata-override.mp3"
        audio_file.write_bytes(b"audio")
        track_id = insert_track(audio_file, title="Old Title")
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO track_metadata_cache(path_key, path, file_modified_at, file_size, metadata_json)
                VALUES(?, ?, datetime('now'), ?, '{}')
                """,
                (path_key(audio_file), str(audio_file), audio_file.stat().st_size),
            )
            conn.commit()

        request = TrackMetadataUpdateRequest(title="New Title", write_to_file=True)
        with patch("backend.app.main.write_track_metadata") as write_metadata:
            updated = update_track_metadata(track_id, request)

        write_metadata.assert_called_once()
        self.assertEqual(write_metadata.call_args.args[0], audio_file)
        self.assertEqual(write_metadata.call_args.args[1]["title"], "New Title")
        self.assertEqual(updated["title"], "New Title")
        with connect() as conn:
            cache_row = conn.execute(
                "SELECT path_key FROM track_metadata_cache WHERE path_key = ?",
                (path_key(audio_file),),
            ).fetchone()
        self.assertIsNone(cache_row)

    def test_file_metadata_writer_can_clear_empty_easy_tags(self) -> None:
        from backend.app.file_tags import write_track_metadata

        class FakeTags(dict):
            def pop(self, key):  # pragma: no cover - this intentionally lacks a default argument.
                return super().pop(key)

        class FakeAudio:
            def __init__(self) -> None:
                self.tags = FakeTags({"title": ["Old Title"], "artist": ["Old Artist"]})
                self.saved = False

            def add_tags(self) -> None:
                self.tags = FakeTags()

            def save(self) -> None:
                self.saved = True

        fake_audio = FakeAudio()
        audio_file = self.root / "clear-empty.flac"
        audio_file.write_bytes(b"audio")

        with patch("backend.app.file_tags.MutagenFile", return_value=fake_audio):
            write_track_metadata(audio_file, {"title": None, "artist": "New Artist"})

        self.assertNotIn("title", fake_audio.tags)
        self.assertEqual(fake_audio.tags["artist"], ["New Artist"])
        self.assertTrue(fake_audio.saved)

    def test_metadata_cache_reuses_unchanged_file_tags(self) -> None:
        audio_file = self.root / "cached.flac"
        audio_file.write_bytes(b"audio")
        metadata = {
            "path": str(audio_file.resolve()),
            "path_key": path_key(audio_file),
            "title": "Cached",
            "artist": "Cache Artist",
            "album": "Cache Album",
            "album_artist": "Cache Artist",
            "track_number": None,
            "disc_number": None,
            "genre": "Rock",
            "year": 2026,
            "duration_seconds": 120.0,
            "bitrate": None,
            "audio_fingerprint": "fingerprint",
            "rating": None,
            "file_modified_at": None,
        }

        with connect() as conn, patch("backend.app.scanner.read_metadata", return_value=metadata) as read_metadata:
            first = read_metadata_cached(conn, audio_file)
            second = read_metadata_cached(conn, audio_file)

        self.assertEqual(first["title"], "Cached")
        self.assertEqual(second["title"], "Cached")
        read_metadata.assert_called_once_with(audio_file)


if __name__ == "__main__":
    unittest.main()
