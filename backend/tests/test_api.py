from __future__ import annotations

import csv
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
              path, path_key, title, artist, album, album_artist, track_number, disc_number, genre, year,
              duration_seconds, bitrate, audio_fingerprint, acoustic_fingerprint, analysis_embedding, rating, updated_at
            )
            VALUES(
              :path, :path_key, :title, :artist, :album, :album_artist, :track_number, :disc_number, :genre,
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
        export_path.unlink(missing_ok=True)

        delete_response = self.client.delete(f"/autodj/profiles/{second_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertNotIn(second_id, {item["id"] for item in delete_response.json()})

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
