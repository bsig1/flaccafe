from __future__ import annotations

import json
import importlib
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from .config import APP_STORAGE_ROOT


RUNTIME_DIR_NAME = "ml-runtime"
RUNTIME_METADATA_FILE = "runtime.json"
REQUIRED_PYTHON = f"{sys.version_info.major}.{sys.version_info.minor}"

_ACTIVATED_RUNTIME: Path | None = None
_DLL_DIRECTORIES: list[object] = []


@dataclass(frozen=True)
class BootstrapPython:
    command: list[str]
    version: str

    @property
    def display(self) -> str:
        return " ".join(self.command)


def ml_runtime_dir() -> Path:
    configured = os.environ.get("LOCAL_AUTODJ_ML_RUNTIME_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    return APP_STORAGE_ROOT / RUNTIME_DIR_NAME


def ml_runtime_python() -> Path:
    root = ml_runtime_dir()
    if os.name == "nt":
        return root / "Scripts" / "python.exe"
    return root / "bin" / "python"


def ml_runtime_site_packages() -> Path | None:
    root = ml_runtime_dir()
    windows_path = root / "Lib" / "site-packages"
    if windows_path.exists():
        return windows_path
    candidates = sorted((root / "lib").glob("python*/site-packages"))
    return candidates[0] if candidates else windows_path


def use_managed_ml_runtime() -> bool:
    return (
        getattr(sys, "frozen", False)
        or os.environ.get("LOCAL_AUTODJ_USE_ML_RUNTIME") == "1"
        or bool(os.environ.get("LOCAL_AUTODJ_ML_RUNTIME_DIR"))
    )


def _creationflags() -> int:
    return getattr(subprocess, "CREATE_NO_WINDOW", 0)


def _candidate_commands() -> list[list[str]]:
    candidates: list[list[str]] = []
    configured = os.environ.get("LOCAL_AUTODJ_BOOTSTRAP_PYTHON")
    if configured:
        candidates.append([configured])

    base_executable = getattr(sys, "_base_executable", None)
    if base_executable and Path(base_executable).exists() and Path(base_executable) != Path(sys.executable):
        candidates.append([base_executable])

    if os.name == "nt":
        candidates.append(["py", f"-{REQUIRED_PYTHON}"])

    candidates.extend([["python"], ["python3"]])
    return candidates


def _command_exists(command: list[str]) -> bool:
    executable = command[0]
    return Path(executable).exists() or shutil.which(executable) is not None


def _read_python_version(command: list[str]) -> str | None:
    if not _command_exists(command):
        return None
    try:
        result = subprocess.run(
            [
                *command,
                "-c",
                "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=_creationflags(),
        )
    except Exception:
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def find_bootstrap_python() -> BootstrapPython | None:
    for command in _candidate_commands():
        version = _read_python_version(command)
        if version == REQUIRED_PYTHON:
            return BootstrapPython(command=command, version=version)
    return None


def _metadata_path() -> Path:
    return ml_runtime_dir() / RUNTIME_METADATA_FILE


def read_runtime_metadata() -> dict:
    try:
        return json.loads(_metadata_path().read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_runtime_metadata(device: str, bootstrap_python: BootstrapPython | None = None) -> None:
    root = ml_runtime_dir()
    root.mkdir(parents=True, exist_ok=True)
    metadata = {
        "device": device,
        "python_version": REQUIRED_PYTHON,
        "bootstrap_python": bootstrap_python.display if bootstrap_python else None,
        "runtime_python": str(ml_runtime_python()),
    }
    _metadata_path().write_text(json.dumps(metadata, indent=2, sort_keys=True), encoding="utf-8")


def _add_dll_directory(path: Path) -> None:
    if not path.exists() or not hasattr(os, "add_dll_directory"):
        return
    path_text = str(path)
    current_path = os.environ.get("PATH", "")
    if path_text.lower() not in current_path.lower().split(os.pathsep):
        os.environ["PATH"] = path_text + os.pathsep + current_path
    try:
        _DLL_DIRECTORIES.append(os.add_dll_directory(path_text))
    except OSError:
        return


def activate_ml_runtime(force: bool = False) -> bool:
    global _ACTIVATED_RUNTIME

    if not use_managed_ml_runtime():
        return False

    root = ml_runtime_dir()
    python_path = ml_runtime_python()
    site_packages = ml_runtime_site_packages()
    if not python_path.exists() or site_packages is None or not site_packages.exists():
        return False

    if _ACTIVATED_RUNTIME == root and not force:
        return True

    site_text = str(site_packages)
    if site_text not in sys.path:
        sys.path.insert(0, site_text)
        importlib.invalidate_caches()

    _add_dll_directory(root / "Scripts")
    _add_dll_directory(root / "Library" / "bin")
    _add_dll_directory(site_packages / "torch" / "lib")
    for libs_dir in site_packages.glob("*.libs"):
        _add_dll_directory(libs_dir)

    _ACTIVATED_RUNTIME = root
    return True


def runtime_status(include_bootstrap: bool = False) -> dict:
    root = ml_runtime_dir()
    python_path = ml_runtime_python()
    metadata = read_runtime_metadata()
    bootstrap = find_bootstrap_python() if include_bootstrap else None
    return {
        "runtime_managed": use_managed_ml_runtime(),
        "runtime_exists": python_path.exists(),
        "runtime_dir": str(root),
        "runtime_python": str(python_path) if python_path.exists() else None,
        "runtime_python_version": metadata.get("python_version"),
        "runtime_device": metadata.get("device"),
        "install_supported": bootstrap is not None if include_bootstrap else True,
        "bootstrap_python": bootstrap.display if bootstrap else None,
        "required_python": REQUIRED_PYTHON,
    }
