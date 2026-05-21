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

import uvicorn

from backend.app.main import app


def main() -> None:
    port = int(os.environ.get("FLAC_CAFE_PORT") or os.environ.get("LOCAL_AUTODJ_PORT", "8765"))
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_config=None,
        log_level="warning",
        access_log=False,
    )


if __name__ == "__main__":
    main()
