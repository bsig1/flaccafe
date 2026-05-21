from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN_PATH = ROOT / "backend" / "app" / "main.py"
DOC_PATH = ROOT / "docs" / "backend-routes.md"
ROUTE_RE = re.compile(r"@app\.(get|post|patch|delete|head)\(\s*[\"']([^\"']+)[\"']")
DOC_ROUTE_RE = re.compile(r"`(GET|POST|PATCH|DELETE|HEAD)\s+([^`]+)`")


def route_key(method: str, path: str) -> str:
    return f"{method.upper()} {path}"


def main() -> int:
    source_routes = {
        route_key(method, path)
        for method, path in ROUTE_RE.findall(MAIN_PATH.read_text(encoding="utf-8"))
    }
    documented_routes = {
        route_key(method, path.strip())
        for method, path in DOC_ROUTE_RE.findall(DOC_PATH.read_text(encoding="utf-8"))
    }

    missing = sorted(source_routes - documented_routes)
    stale = sorted(documented_routes - source_routes)
    if not missing and not stale:
        print(f"Route docs are current: {len(source_routes)} routes documented.")
        return 0

    if missing:
        print("Missing from docs/backend-routes.md:")
        for route in missing:
            print(f"  - {route}")
    if stale:
        print("Documented but not present in backend/app/main.py:")
        for route in stale:
            print(f"  - {route}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
