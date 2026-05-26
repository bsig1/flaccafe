from __future__ import annotations

import importlib.util
import io
import sqlite3
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest.mock import patch


class PythonBoundaryTests(unittest.TestCase):
    def test_removed_http_controller_modules_are_not_importable(self) -> None:
        removed_modules = [
            "backend.app.main",
            "backend.app.worker",
            "backend.app.worker_types",
            "backend.app.schemas",
            "backend.app.scanner",
            "backend.app.recommender",
        ]

        for module_name in removed_modules:
            with self.subTest(module=module_name):
                self.assertIsNone(importlib.util.find_spec(module_name))

    def test_database_helper_uses_schema_file(self) -> None:
        from backend.app.database import connect, get_setting, set_setting

        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "music.sqlite3"
            with connect(db_path) as conn:
                set_setting(conn, "example", "yes")
                conn.commit()

            raw = sqlite3.connect(db_path)
            try:
                table = raw.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tracks'"
                ).fetchone()
                self.assertIsNotNone(table)
            finally:
                raw.close()

            with connect(db_path) as conn:
                self.assertEqual(get_setting(conn, "example"), "yes")

    def test_desktop_backend_no_longer_starts_a_python_http_worker(self) -> None:
        import backend.desktop_backend as desktop_backend

        with patch("sys.argv", ["desktop_backend.py"]):
            with redirect_stderr(io.StringIO()):
                self.assertEqual(desktop_backend.main(), 2)


if __name__ == "__main__":
    unittest.main()
