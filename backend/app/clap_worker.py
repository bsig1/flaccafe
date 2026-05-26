from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path
from typing import Any

from .clap_analysis import ClapAnalyzer


def _json_line(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    """Persistent CLAP analysis worker used by Rust-owned analysis jobs.

    The protocol is newline-delimited JSON. Rust sends one track at a time and
    this process keeps the CLAP model warm between requests.
    """
    analyzer: ClapAnalyzer | None = None
    for raw_line in sys.stdin:
        request: Any = {}
        try:
            request = json.loads(raw_line)
            command = str(request.get("command") or "analyze")
            if command == "shutdown":
                _json_line({"status": "ok", "message": "shutdown"})
                return 0
            if command != "analyze":
                _json_line({"status": "error", "error": f"Unknown command: {command}"})
                continue

            track_id = int(request["track_id"])
            path = Path(str(request["path"]))
            if analyzer is None:
                analyzer = ClapAnalyzer()
            analysis = analyzer.analyze_path(path)
            _json_line(
                {
                    "status": "ok",
                    "track_id": track_id,
                    "analysis": {
                        "genre": analysis.genre,
                        "confidence": analysis.confidence,
                        "tags": analysis.tags,
                        "embedding": analysis.embedding,
                        "provider": analysis.provider,
                        "model": analysis.model,
                        "updated_at": analysis.updated_at,
                    },
                }
            )
        except Exception as exc:  # noqa: BLE001 - propagate expert-worker failures to Rust.
            _json_line(
                {
                    "status": "error",
                    "track_id": request.get("track_id") if isinstance(request, dict) else None,
                    "path": request.get("path") if isinstance(request, dict) else None,
                    "error": str(exc),
                    "traceback": traceback.format_exc(limit=8),
                }
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
