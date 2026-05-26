from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTES_PATH = ROOT / "src-tauri" / "src" / "python_worker" / "routes" / "table.rs"
DOC_PATH = ROOT / "docs" / "backend-routes.md"
ROUTE_RE = re.compile(
    r'PythonRoute\s*\{\s*method:\s*"(?P<method>[^"]+)",\s*'
    r'template:\s*"(?P<path>[^"]+)",\s*'
    r'action:\s*"(?P<action>[^"]+)",\s*\}',
    re.S,
)
DOC_ROUTE_RE = re.compile(r"`(GET|POST|PATCH|DELETE|HEAD)\s+([^`]+)`")


def route_key(method: str, path: str) -> str:
    return f"{method.upper()} {path}"


def main() -> int:
    source_routes = {
        route_key(match.group("method"), match.group("path"))
        for match in ROUTE_RE.finditer(ROUTES_PATH.read_text(encoding="utf-8"))
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
        print(f"Documented but not present in {ROUTES_PATH.relative_to(ROOT)}:")
        for route in stale:
            print(f"  - {route}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
