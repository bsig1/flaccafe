from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import APP_STORAGE_ROOT, PROJECT_ROOT


MANIFEST_NAMES = ("flac-cafe-extension.json", "extension.json", "manifest.json")
VALID_KINDS = {"skin", "plugin", "importer", "visualizer", "integration"}


def user_extensions_dir() -> Path:
    return APP_STORAGE_ROOT / "extensions"


def bundled_extensions_dir() -> Path:
    return PROJECT_ROOT / "extensions"


def extension_search_dirs() -> list[Path]:
    dirs = [user_extensions_dir()]
    bundled = bundled_extensions_dir()
    if bundled not in dirs:
        dirs.append(bundled)
    return dirs


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _manifest_payload(manifest_path: Path, directory: Path) -> dict[str, Any]:
    errors: list[str] = []
    try:
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raw = {}
        errors.append(f"Could not read manifest: {exc}")

    kind = str(raw.get("kind") or "plugin").strip().lower()
    if kind not in VALID_KINDS:
        errors.append(f"Unknown extension kind '{kind}'")

    extension_id = str(raw.get("id") or directory.name).strip()
    name = str(raw.get("name") or extension_id).strip()
    version = str(raw.get("version") or "0.0.0").strip()
    entry = raw.get("entry")
    entry_path: str | None = None
    if entry:
        candidate = (directory / str(entry)).resolve()
        try:
            candidate.relative_to(directory.resolve())
            entry_path = str(candidate)
            if not candidate.exists():
                errors.append("Entry file does not exist")
        except ValueError:
            errors.append("Entry must stay inside the extension folder")

    return {
        "id": extension_id,
        "name": name,
        "version": version,
        "kind": kind,
        "description": str(raw.get("description") or "").strip() or None,
        "author": str(raw.get("author") or "").strip() or None,
        "homepage": str(raw.get("homepage") or "").strip() or None,
        "entry": str(entry) if entry else None,
        "entry_path": entry_path,
        "directory": str(directory),
        "manifest_path": str(manifest_path),
        "capabilities": _string_list(raw.get("capabilities")),
        "permissions": _string_list(raw.get("permissions")),
        "enabled": bool(raw.get("enabled", True)),
        "valid": not errors and bool(extension_id and name),
        "errors": errors,
    }


def discover_extensions(search_dirs: list[Path] | None = None, create_user_dir: bool = True) -> dict[str, Any]:
    user_dir = user_extensions_dir()
    if create_user_dir:
        user_dir.mkdir(parents=True, exist_ok=True)
    directories = search_dirs or extension_search_dirs()
    extensions: list[dict[str, Any]] = []
    seen: set[str] = set()

    for base_dir in directories:
        if not base_dir.exists():
            continue
        for candidate in sorted((path for path in base_dir.iterdir() if path.is_dir()), key=lambda path: path.name.lower()):
            manifest_path = next((candidate / name for name in MANIFEST_NAMES if (candidate / name).exists()), None)
            if manifest_path is None:
                continue
            payload = _manifest_payload(manifest_path, candidate)
            dedupe_key = f"{payload['id']}:{payload['directory']}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            extensions.append(payload)

    return {
        "user_extensions_dir": str(user_dir),
        "search_directories": [str(path) for path in directories],
        "manifest_names": list(MANIFEST_NAMES),
        "extensions": extensions,
    }
