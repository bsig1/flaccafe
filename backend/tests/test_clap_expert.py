from __future__ import annotations

import importlib
import io
import json
import os
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

        self.config = importlib.reload(config)
        self.database = importlib.reload(database)
        self.clap_analysis = importlib.reload(clap_analysis)
        self.clap_expert = importlib.reload(clap_expert)

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
                "max_duration_seconds": 12,
            }
        )

        self.assertEqual(messages[-1]["status"], "ok")
        self.assertEqual(messages[-1]["body"]["model_id"], "example/clap")
        self.assertEqual(messages[-1]["body"]["max_duration_seconds"], 12)

    def test_unknown_command_reports_failure_without_crashing(self) -> None:
        messages = self._run_expert({"command": "missing"})

        self.assertEqual(messages[-1]["status"], "failed")
        self.assertIn("Unknown CLAP expert command", messages[-1]["message"])


if __name__ == "__main__":
    unittest.main()
