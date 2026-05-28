from __future__ import annotations

import importlib
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


class ClapExpertTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        os.environ["FLAC_CAFE_DATA_DIR"] = str(root)
        os.environ["MUSIC_REC_DB"] = str(root / "data" / "music.sqlite3")

        import backend.app.config as config
        import backend.app.database as database
        import backend.app.clap_analysis as clap_analysis
        import backend.app.clap_expert as clap_expert
        import backend.app.clap_worker as clap_worker

        self.config = importlib.reload(config)
        self.database = importlib.reload(database)
        self.clap_analysis = importlib.reload(clap_analysis)
        self.clap_expert = importlib.reload(clap_expert)
        self.clap_worker = importlib.reload(clap_worker)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _run_expert(self, payload: dict) -> list[dict]:
        stdout = io.StringIO()
        stdin = io.StringIO(json.dumps(payload))
        with patch("sys.stdin", stdin), redirect_stdout(stdout):
            self.assertEqual(self.clap_expert.main(), 0)
        return [
            json.loads(line)
            for line in stdout.getvalue().splitlines()
            if line.strip()
        ]

    def test_status_returns_a_json_envelope(self) -> None:
        messages = self._run_expert({"command": "status"})

        self.assertEqual(messages[-1]["status"], "ok")
        self.assertIn("installed", messages[-1]["body"])
        self.assertIn("model_id", messages[-1]["body"])

    def test_save_config_persists_clap_settings(self) -> None:
        messages = self._run_expert(
            {
                "command": "save_config",
                "model_id": "example/clap",
                "samples_per_track": 5,
            }
        )

        self.assertEqual(messages[-1]["status"], "ok")
        self.assertEqual(messages[-1]["body"]["model_id"], "example/clap")
        self.assertEqual(messages[-1]["body"]["samples_per_track"], 5)
        self.assertEqual(messages[-1]["body"]["sample_window_seconds"], 10.0)

    def test_legacy_max_duration_maps_to_ten_second_samples(self) -> None:
        messages = self._run_expert(
            {
                "command": "save_config",
                "max_duration_seconds": 45,
            }
        )

        self.assertEqual(messages[-1]["status"], "ok")
        self.assertEqual(messages[-1]["body"]["samples_per_track"], 5)
        self.assertEqual(messages[-1]["body"]["max_duration_seconds"], 50.0)

    def test_sample_offsets_use_centered_windows(self) -> None:
        offsets = self.clap_analysis.sample_offsets(180, 3)

        self.assertEqual([round(value) for value in offsets], [25, 85, 145])

    def test_analysis_payload_includes_mood_vector(self) -> None:
        analysis = self.clap_analysis.AudioAnalysis(
            genre="pop",
            confidence=0.5,
            tags={"pop": 0.5},
            mood="energetic",
            mood_confidence=0.4,
            mood_tags={"energetic": 0.4, "happy": 0.3},
            embedding=[0.1, 0.2],
            provider="clap",
            model="test-model",
            updated_at="2026-05-28T00:00:00+00:00",
        )

        payload = self.clap_analysis.analysis_to_payload(analysis)

        self.assertEqual(payload["mood"], "energetic")
        self.assertEqual(payload["mood_tags"]["happy"], 0.3)

    def test_unknown_command_reports_failure_without_crashing(self) -> None:
        messages = self._run_expert({"command": "missing"})

        self.assertEqual(messages[-1]["status"], "failed")
        self.assertIn("Unknown CLAP expert command", messages[-1]["message"])

    def test_managed_runtime_status_checks_external_site_packages(self) -> None:
        runtime = Path(self.temp_dir.name) / "ml-runtime"
        site_packages = runtime / "Lib" / "site-packages"
        site_packages.mkdir(parents=True)
        (runtime / "Scripts").mkdir()
        (runtime / "Scripts" / "python.exe").write_text("", encoding="utf-8")
        package_bodies = {
            "torch": "__version__ = 'test'\nclass cuda:\n    @staticmethod\n    def is_available():\n        return False\n",
            "transformers": "",
            "librosa": "",
            "soundfile": "",
            "soxr": "",
        }
        for name, body in package_bodies.items():
            package_dir = site_packages / name
            package_dir.mkdir()
            (package_dir / "__init__.py").write_text(body, encoding="utf-8")

        previous_path = list(sys.path)
        previous_use_runtime = os.environ.get("FLAC_CAFE_USE_ML_RUNTIME")
        previous_runtime_dir = os.environ.get("FLAC_CAFE_ML_RUNTIME_DIR")
        os.environ["FLAC_CAFE_USE_ML_RUNTIME"] = "1"
        os.environ["FLAC_CAFE_ML_RUNTIME_DIR"] = str(runtime)
        try:
            with patch.object(self.clap_analysis.importlib.util, "find_spec", return_value=None):
                status = self.clap_analysis.status(deep=True)
        finally:
            sys.path[:] = previous_path
            if previous_use_runtime is None:
                os.environ.pop("FLAC_CAFE_USE_ML_RUNTIME", None)
            else:
                os.environ["FLAC_CAFE_USE_ML_RUNTIME"] = previous_use_runtime
            if previous_runtime_dir is None:
                os.environ.pop("FLAC_CAFE_ML_RUNTIME_DIR", None)
            else:
                os.environ["FLAC_CAFE_ML_RUNTIME_DIR"] = previous_runtime_dir

        self.assertTrue(status["installed"])

    def test_missing_dependency_message_includes_import_errors(self) -> None:
        message = self.clap_expert._missing_dependency_message(
            {
                "dependencies": {"torch": False, "transformers": False},
                "dependency_errors": {"torch": "missing fbgemm.dll"},
            }
        )

        self.assertIsNotNone(message)
        self.assertIn("torch, transformers", message)
        self.assertIn("missing fbgemm.dll", message)

    def test_resolves_lossy_unicode_audio_filename(self) -> None:
        folder = Path(self.temp_dir.name) / "music"
        folder.mkdir()
        real_path = folder / "Gemini Moon - Reneé Rapp - Snow Angel .flac"
        real_path.write_bytes(b"placeholder")
        lossy_path = folder / "Gemini Moon - Rene? Rapp - Snow Angel .flac"

        resolved = self.clap_analysis.resolve_audio_path(lossy_path)

        self.assertEqual(resolved, real_path)

    def test_resolves_mojibake_audio_filename_with_surrogateescape(self) -> None:
        folder = Path(self.temp_dir.name) / "music"
        folder.mkdir()
        real_name = "\uac15\ub0a8\uc2a4\ud0c0\uc77c.flac"
        real_path = folder / real_name
        real_path.write_bytes(b"placeholder")
        mojibake_name = real_name.encode("utf-8").decode("cp1252", errors="surrogateescape")
        mojibake_path = folder / mojibake_name

        resolved = self.clap_analysis.resolve_audio_path(mojibake_path)

        self.assertEqual(resolved, real_path)

    def test_worker_json_line_replaces_lone_surrogates(self) -> None:
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            self.clap_worker._json_line({"status": "error", "path": "bad\udc9d.flac"})

        line = stdout.getvalue().strip()
        self.assertNotIn("\\udc9d", line.lower())
        self.assertEqual(json.loads(line)["path"], "bad\ufffd.flac")


if __name__ == "__main__":
    unittest.main()
