from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("FLAC_CAFE_PACKAGED", "1")

_LOG_STREAMS = []


def _backend_log_path() -> Path:
    root = os.environ.get("LOCALAPPDATA")
    base = Path(root) if root else Path.home() / "AppData" / "Local"
    return base / "FLAC Cafe" / "logs" / "backend.log"


def _open_hidden_stream():
    try:
        path = _backend_log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        return path.open("a", encoding="utf-8", buffering=1)
    except OSError:
        return open(os.devnull, "w", encoding="utf-8")


def _ensure_console_streams() -> None:
    """PyInstaller --noconsole can leave stdout/stderr as None on Windows."""
    if sys.stdout is None:
        stream = _open_hidden_stream()
        _LOG_STREAMS.append(stream)
        sys.stdout = stream
    if sys.stderr is None:
        stream = _open_hidden_stream()
        _LOG_STREAMS.append(stream)
        sys.stderr = stream


_ensure_console_streams()

if not getattr(sys, "frozen", False):
    repo_root = Path(__file__).resolve().parents[1]
    repo_root_text = str(repo_root)
    if repo_root_text not in sys.path:
        sys.path.insert(0, repo_root_text)

from backend.app.startup_profile import mark

mark("desktop backend streams ready")

from backend.app.worker import main as worker_main


def main() -> int:
    return worker_main()


if __name__ == "__main__":
    raise SystemExit(main())
