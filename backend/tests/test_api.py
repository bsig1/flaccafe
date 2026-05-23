from __future__ import annotations

import csv
import os
import json
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.database import connect, init_db, set_setting
from backend.app.main import app
from backend.app.scanner import file_fingerprint, file_modified_at, path_key


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
        self.assertEqual(Path(row["path"]), new_path)

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
        self.assertEqual(Path(restored["path"]), source)

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
        self.assertEqual(Path(row["path"]), renamed_target)

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
        self.assertIn("0:v?", command_text)

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
        self.assertEqual(refreshed.json()["total"], 1)

        episodes = self.client.get(f"/podcasts/episodes?subscription_id={subscription_id}")
        self.assertEqual(episodes.status_code, 200)
        self.assertEqual(episodes.json()[0]["title"], "Episode One")
        episode_id = episodes.json()[0]["id"]

        downloaded = self.client.post(f"/podcasts/episodes/{episode_id}/download", json={})
        self.assertEqual(downloaded.status_code, 200)
        local_path = Path(downloaded.json()["local_path"])
        self.assertTrue(local_path.exists())
        self.assertEqual(local_path.read_bytes(), b"podcast audio")

        deleted = self.client.delete(f"/podcasts/subscriptions/{subscription_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertTrue(deleted.json()["deleted"])

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

        with patch("backend.app.main.shutil.which", return_value=None):
            missing = self.client.post("/library/tools/acoustic-fingerprints", json={"track_ids": [track_id]})
        self.assertEqual(missing.status_code, 200)
        self.assertFalse(missing.json()["tool_available"])

        fake_fpcalc = self.root / "path-fpcalc.exe"
        fake_fpcalc.write_bytes(b"not a real executable")
        with patch("backend.app.main.shutil.which", return_value=str(fake_fpcalc)), patch(
            "backend.app.main.acoustic_fingerprint_for_path",
            return_value="acoustic-token",
        ):
            updated = self.client.post("/library/tools/acoustic-fingerprints", json={"track_ids": [track_id]})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["updated"], 1)
        with connect() as conn:
            row = conn.execute("SELECT acoustic_fingerprint FROM tracks WHERE id = ?", (track_id,)).fetchone()
        self.assertEqual(row["acoustic_fingerprint"], "acoustic-token")

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
        self.assertEqual(Path(setup.json()["resolved_path"]), fake_fpcalc)

        with patch("backend.app.main.shutil.which", return_value=None), patch(
            "backend.app.main.acoustic_fingerprint_for_path",
            return_value="configured-token",
        ) as fingerprint:
            updated = self.client.post("/library/tools/acoustic-fingerprints", json={"track_ids": [track_id]})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["updated"], 1)
        fingerprint.assert_called_once()
        self.assertEqual(Path(fingerprint.call_args.args[1]), fake_fpcalc)

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

        history = self.client.get("/autodj/history")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["drift"]["total_tracks"], 4)
        self.assertEqual(len(history.json()[0]["track_ids"]), 4)

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


if __name__ == "__main__":
    unittest.main()
