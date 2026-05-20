from __future__ import annotations

import os
import sys
from pathlib import Path


APP_NAME = "FLAC Cafe"
LEGACY_APP_NAME = "Local AutoDJ"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"


def app_data_root(app_name: str) -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / app_name
    return Path.home() / "AppData" / "Local" / app_name


def storage_root() -> Path:
    configured = os.environ.get("FLAC_CAFE_DATA_DIR") or os.environ.get("LOCAL_AUTODJ_DATA_DIR")
    if configured:
        return Path(configured).expanduser().resolve()

    if getattr(sys, "frozen", False) or os.environ.get("LOCAL_AUTODJ_PACKAGED") == "1":
        current = app_data_root(APP_NAME)
        legacy = app_data_root(LEGACY_APP_NAME)
        return legacy if legacy.exists() and not current.exists() else current

    return BACKEND_ROOT


APP_STORAGE_ROOT = storage_root()
DATA_DIR = APP_STORAGE_ROOT / "data"
EXPORT_DIR = APP_STORAGE_ROOT / "exports"
MODEL_DIR = APP_STORAGE_ROOT / "models"


def database_path() -> Path:
    configured = os.environ.get("MUSIC_REC_DB")
    if configured:
        return Path(configured).expanduser().resolve()
    return DATA_DIR / "music.sqlite3"


SUPPORTED_EXTENSIONS = {
    ".flac",
    ".mp3",
    ".m4a",
    ".ogg",
    ".opus",
    ".wav",
    ".aiff",
    ".aif",
}
