from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path
from typing import Any

from .clap_analysis import ClapAnalyzer, analysis_to_payload


def _json_safe_text(value: str) -> str:
    # Windows paths can arrive with lone surrogate escapes from lossy filenames.
    # JSON-lines output must stay parseable so Rust can record a per-track error.
    return "".join("\ufffd" if 0xD800 <= ord(character) <= 0xDFFF else character for character in value)


def _json_safe(value: Any) -> Any:
    if isinstance(value, str):
        return _json_safe_text(value)
    if isinstance(value, dict):
        return {
            _json_safe_text(key) if isinstance(key, str) else key: _json_safe(nested)
            for key, nested in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_json_safe(nested) for nested in value]
    return value


def _json_line(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(_json_safe(payload), ensure_ascii=True) + "\n")
    sys.stdout.flush()


def _single_result_payload(track_id: int, analysis: Any) -> dict[str, Any]:
    return {
        "status": "ok",
        "track_id": track_id,
        "analysis": analysis_to_payload(analysis),
    }


def main() -> int:
    """Persistent CLAP analysis worker used by Rust-owned analysis jobs.

    The protocol is newline-delimited JSON. Rust sends batches of track paths
    and this process keeps the CLAP model warm between requests.
    """
    analyzer: ClapAnalyzer | None = None
    for raw_line in sys.stdin:
        raw_line = raw_line.lstrip("\ufeff").strip()
        if not raw_line:
            continue
        request: Any = {}
        try:
            request = json.loads(raw_line)
            command = str(request.get("command") or "analyze")
            if command == "shutdown":
                _json_line({"status": "ok", "message": "shutdown"})
                return 0
            if command not in {"analyze", "analyze_many"}:
                _json_line({"status": "error", "error": f"Unknown command: {command}"})
                continue

            if analyzer is None:
                analyzer = ClapAnalyzer()
            if command == "analyze_many":
                tracks = request.get("tracks")
                if not isinstance(tracks, list):
                    raise ValueError("analyze_many requires a tracks array")
                _json_line({"status": "ok", "results": analyzer.analyze_many(tracks)})
            else:
                track_id = int(request["track_id"])
                path = Path(str(request["path"]))
                analysis = analyzer.analyze_path(path)
                _json_line(_single_result_payload(track_id, analysis))
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
