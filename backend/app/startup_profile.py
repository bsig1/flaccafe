from __future__ import annotations

import os
import time
from pathlib import Path

_T0 = float(os.environ.setdefault("FLAC_CAFE_STARTUP_T0", str(time.perf_counter())))
_LAST = _T0


def _log_path() -> Path:
    root = os.environ.get("LOCALAPPDATA")
    base = Path(root) if root else Path.home() / "AppData" / "Local"
    return base / "FLAC Cafe" / "logs" / "backend.log"


def mark(label: str) -> None:
    """Append a small startup timing breadcrumb without needing logging configured."""
    configured = os.environ.get("FLAC_CAFE_STARTUP_PROFILE")
    enabled = os.environ.get("FLAC_CAFE_PACKAGED") == "1" if configured is None else configured.lower() not in {
        "0",
        "false",
        "no",
        "off",
    }
    if not enabled:
        return

    global _LAST
    now = time.perf_counter()
    elapsed = now - _T0
    delta = now - _LAST
    _LAST = now
    try:
        path = _log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8", buffering=1) as handle:
            handle.write(f"[startup] +{elapsed:.3f}s (+{delta:.3f}s) {label}\n")
    except OSError:
        pass
