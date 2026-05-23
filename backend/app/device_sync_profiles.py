from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from .audio_conversion_jobs import creation_flags
from .database import connect, rows_to_dicts


ANDROID_PRESETS = [
    {
        "name": "Generic Android Music Folder",
        "target_folder": "",
        "device_kind": "android_folder",
        "music_subfolder": "Music",
        "playlist_subfolder": "Playlists",
        "playlist_ids": [],
        "playlist_rules": {"relative_paths": True, "playlist_format": "m3u8"},
        "copy_files": True,
        "export_playlists": True,
        "preserve_structure": False,
    },
    {
        "name": "Poweramp Android",
        "target_folder": "",
        "device_kind": "android_folder",
        "music_subfolder": "Music",
        "playlist_subfolder": "Playlists",
        "playlist_ids": [],
        "playlist_rules": {"relative_paths": True, "playlist_format": "m3u8", "path_style": "android"},
        "copy_files": True,
        "export_playlists": True,
        "preserve_structure": False,
    },
    {
        "name": "USB Drive Mirror",
        "target_folder": "",
        "device_kind": "usb",
        "music_subfolder": "Music",
        "playlist_subfolder": "Playlists",
        "playlist_ids": [],
        "playlist_rules": {"relative_paths": True, "playlist_format": "m3u8"},
        "copy_files": True,
        "export_playlists": True,
        "preserve_structure": True,
    },
]


def safe_json_load(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def row_to_profile(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "target_folder": row["target_folder"],
        "device_kind": row["device_kind"],
        "music_subfolder": row["music_subfolder"],
        "playlist_subfolder": row["playlist_subfolder"],
        "playlist_ids": [int(value) for value in safe_json_load(row.get("playlist_ids_json"), []) if str(value).isdigit()],
        "playlist_rules": safe_json_load(row.get("playlist_rules_json"), {}),
        "copy_files": bool(row["copy_files"]),
        "export_playlists": bool(row["export_playlists"]),
        "preserve_structure": bool(row["preserve_structure"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_device_sync_profiles() -> dict[str, list[dict[str, Any]]]:
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                """
                SELECT *
                FROM device_sync_profiles
                ORDER BY lower(name)
                """
            )
        )
    return {
        "profiles": [row_to_profile(row) for row in rows],
        "presets": ANDROID_PRESETS,
    }


def payload_dict(request: object) -> dict[str, Any]:
    data = request.model_dump(mode="json") if hasattr(request, "model_dump") else dict(request)
    data["playlist_ids_json"] = json.dumps(data.get("playlist_ids") or [])
    data["playlist_rules_json"] = json.dumps(data.get("playlist_rules") or {}, ensure_ascii=False, sort_keys=True)
    data["copy_files"] = 1 if data.get("copy_files", True) else 0
    data["export_playlists"] = 1 if data.get("export_playlists", True) else 0
    data["preserve_structure"] = 1 if data.get("preserve_structure", True) else 0
    return data


def save_device_sync_profile(request: object, profile_id: int | None = None) -> dict[str, Any] | None:
    data = payload_dict(request)
    with connect() as conn:
        if profile_id is None:
            cursor = conn.execute(
                """
                INSERT INTO device_sync_profiles(
                  name, target_folder, device_kind, music_subfolder, playlist_subfolder,
                  playlist_ids_json, playlist_rules_json, copy_files, export_playlists, preserve_structure
                )
                VALUES(
                  :name, :target_folder, :device_kind, :music_subfolder, :playlist_subfolder,
                  :playlist_ids_json, :playlist_rules_json, :copy_files, :export_playlists, :preserve_structure
                )
                ON CONFLICT(name) DO UPDATE SET
                  target_folder = excluded.target_folder,
                  device_kind = excluded.device_kind,
                  music_subfolder = excluded.music_subfolder,
                  playlist_subfolder = excluded.playlist_subfolder,
                  playlist_ids_json = excluded.playlist_ids_json,
                  playlist_rules_json = excluded.playlist_rules_json,
                  copy_files = excluded.copy_files,
                  export_playlists = excluded.export_playlists,
                  preserve_structure = excluded.preserve_structure,
                  updated_at = datetime('now')
                """,
                data,
            )
            row_id = int(cursor.lastrowid or 0)
            if row_id == 0:
                existing = conn.execute("SELECT id FROM device_sync_profiles WHERE name = ?", (data["name"],)).fetchone()
                row_id = int(existing["id"]) if existing else 0
        else:
            cursor = conn.execute(
                """
                UPDATE device_sync_profiles
                SET name = :name,
                    target_folder = :target_folder,
                    device_kind = :device_kind,
                    music_subfolder = :music_subfolder,
                    playlist_subfolder = :playlist_subfolder,
                    playlist_ids_json = :playlist_ids_json,
                    playlist_rules_json = :playlist_rules_json,
                    copy_files = :copy_files,
                    export_playlists = :export_playlists,
                    preserve_structure = :preserve_structure,
                    updated_at = datetime('now')
                WHERE id = :profile_id
                """,
                {**data, "profile_id": profile_id},
            )
            if cursor.rowcount == 0:
                return None
            row_id = profile_id
        conn.commit()
        row = conn.execute("SELECT * FROM device_sync_profiles WHERE id = ?", (row_id,)).fetchone()
    return row_to_profile(dict(row)) if row else None


def delete_device_sync_profile(profile_id: int) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM device_sync_profiles WHERE id = ?", (profile_id,))
        conn.commit()
        return cursor.rowcount > 0


def windows_removable_devices() -> list[dict[str, Any]]:
    command = [
        "powershell",
        "-NoProfile",
        "-Command",
        (
            "Get-CimInstance Win32_LogicalDisk | "
            "Where-Object {$_.DriveType -in 2,3} | "
            "Select-Object DeviceID,VolumeName,DriveType,Size,FreeSpace | "
            "ConvertTo-Json -Compress"
        ),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=8, creationflags=creation_flags())
    except (OSError, subprocess.SubprocessError):
        return []
    if result.returncode != 0 or not result.stdout.strip():
        return []
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    items = [payload] if isinstance(payload, dict) else payload if isinstance(payload, list) else []
    devices: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        drive_type = int(item.get("DriveType") or 0)
        device_id = str(item.get("DeviceID") or "").strip()
        if not device_id:
            continue
        root = f"{device_id}\\"
        kind = "usb" if drive_type == 2 else "folder"
        devices.append(
            {
                "id": device_id,
                "label": item.get("VolumeName") or ("Removable Drive" if drive_type == 2 else "Local Drive"),
                "root_path": root,
                "device_kind": kind,
                "drive_type": drive_type,
                "size_bytes": item.get("Size"),
                "free_bytes": item.get("FreeSpace"),
                "writable": Path(root).exists(),
                "hint": "USB/removable" if drive_type == 2 else "Mounted local folder",
            }
        )
    return devices


def detected_device_sync_devices() -> dict[str, Any]:
    devices = windows_removable_devices() if os.name == "nt" else []
    return {
        "devices": devices,
        "mtp_supported": False,
        "message": (
            f"Found {len(devices)} mounted drive{'s' if len(devices) != 1 else ''}."
            if devices
            else "No mounted USB/music device folders detected. Android MTP devices need a mounted folder target for now."
        ),
    }
