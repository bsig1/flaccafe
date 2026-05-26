from __future__ import annotations

import json
import importlib
import os
import shutil
import site
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
_CURRENT_ENV_DLLS_ADDED = False


@dataclass(frozen=True)
class BootstrapPython:
    command: list[str]
    version: str
    executable: str | None = None
    prefix: str | None = None
    base_prefix: str | None = None

    @property
    def display(self) -> str:
        return " ".join(self.command)

    @property
    def dll_directories(self) -> list[Path]:
        paths: list[Path] = []
        for value in (self.executable, self.prefix, self.base_prefix):
            if not value:
                continue
            path = Path(value)
            paths.append(path.parent if path.is_file() else path)
        return paths


def ml_runtime_dir() -> Path:
    configured = os.environ.get("FLAC_CAFE_ML_RUNTIME_DIR") or os.environ.get("LOCAL_AUTODJ_ML_RUNTIME_DIR")
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
        or os.environ.get("FLAC_CAFE_USE_ML_RUNTIME") == "1"
        or os.environ.get("LOCAL_AUTODJ_USE_ML_RUNTIME") == "1"
        or bool(os.environ.get("FLAC_CAFE_ML_RUNTIME_DIR"))
        or bool(os.environ.get("LOCAL_AUTODJ_ML_RUNTIME_DIR"))
    )


def _creationflags() -> int:
    return getattr(subprocess, "CREATE_NO_WINDOW", 0)


def _candidate_commands() -> list[list[str]]:
    candidates: list[list[str]] = []
    configured = os.environ.get("FLAC_CAFE_BOOTSTRAP_PYTHON") or os.environ.get("LOCAL_AUTODJ_BOOTSTRAP_PYTHON")
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


def _read_python_details(command: list[str]) -> BootstrapPython | None:
    if not _command_exists(command):
        return None
    try:
        result = subprocess.run(
            [
                *command,
                "-c",
                (
                    "import json, sys; "
                    "print(json.dumps({"
                    "'version': f'{sys.version_info.major}.{sys.version_info.minor}', "
                    "'executable': sys.executable, "
                    "'prefix': sys.prefix, "
                    "'base_prefix': sys.base_prefix"
                    "}))"
                ),
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
    try:
        details = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    version = str(details.get("version") or "").strip()
    if not version:
        return None
    return BootstrapPython(
        command=command,
        version=version,
        executable=details.get("executable"),
        prefix=details.get("prefix"),
        base_prefix=details.get("base_prefix"),
    )


def find_bootstrap_python() -> BootstrapPython | None:
    for command in _candidate_commands():
        bootstrap = _read_python_details(command)
        if bootstrap and bootstrap.version == REQUIRED_PYTHON:
            return bootstrap
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
        "bootstrap_executable": bootstrap_python.executable if bootstrap_python else None,
        "bootstrap_prefix": bootstrap_python.prefix if bootstrap_python else None,
        "bootstrap_base_prefix": bootstrap_python.base_prefix if bootstrap_python else None,
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


def _add_runtime_dll_directories(site_packages: Path) -> None:
    """Expose DLL folders from the managed ML runtime before importing torch/audio libs."""
    common_candidates = [
        site_packages / "torch" / "lib",
        site_packages / "soxr",
        site_packages / "soxr.libs",
        site_packages / "soundfile",
        site_packages / "_soundfile_data",
        site_packages / "soundfile.libs",
        site_packages / "numpy.libs",
        site_packages / "scipy.libs",
        site_packages / "sklearn.libs",
        site_packages / "llvmlite.libs",
    ]
    for candidate in common_candidates:
        _add_dll_directory(candidate)

    for libs_dir in site_packages.rglob("*.libs"):
        _add_dll_directory(libs_dir)


def _metadata_dll_directories(metadata: dict) -> list[Path]:
    paths: list[Path] = []
    for key in ("bootstrap_executable", "bootstrap_prefix", "bootstrap_base_prefix"):
        value = metadata.get(key)
        if not value:
            continue
        path = Path(str(value))
        paths.append(path.parent if path.is_file() else path)
    return paths


def _bootstrap_python_dll_directories() -> list[Path]:
    metadata = read_runtime_metadata()
    paths = _metadata_dll_directories(metadata)
    if not paths:
        bootstrap = find_bootstrap_python()
        if bootstrap:
            paths.extend(bootstrap.dll_directories)
    expanded: list[Path] = []
    for path in paths:
        expanded.extend([path, path / "DLLs", path / "Library" / "bin"])
    return expanded


def repair_runtime_python_dlls(bootstrap_python: BootstrapPython | None = None) -> list[str]:
    if os.name != "nt":
        return []

    sources = bootstrap_python.dll_directories if bootstrap_python else _bootstrap_python_dll_directories()
    destinations = [ml_runtime_dir(), ml_runtime_dir() / "Scripts"]
    dll_names = ["python3.dll", f"python{sys.version_info.major}{sys.version_info.minor}.dll"]
    copied: list[str] = []

    for dll_name in dll_names:
        source = next((directory / dll_name for directory in sources if (directory / dll_name).exists()), None)
        if source is None:
            continue
        for destination_dir in destinations:
            try:
                destination_dir.mkdir(parents=True, exist_ok=True)
                destination = destination_dir / dll_name
                if not destination.exists() or source.stat().st_mtime > destination.stat().st_mtime:
                    shutil.copy2(source, destination)
                    copied.append(str(destination))
            except OSError:
                continue
    return copied


def add_current_python_dll_directories() -> None:
    """Expose binary package DLL folders for the active Python environment."""
    candidates: list[Path] = []
    try:
        candidates.extend(Path(path) for path in site.getsitepackages())
    except Exception:
        pass
    try:
        user_site = site.getusersitepackages()
        if user_site:
            candidates.append(Path(user_site))
    except Exception:
        pass

    for candidate in candidates:
        if candidate.exists():
            _add_runtime_dll_directories(candidate)


def activate_ml_runtime(force: bool = False) -> bool:
    global _ACTIVATED_RUNTIME, _CURRENT_ENV_DLLS_ADDED

    if not use_managed_ml_runtime():
        if force or not _CURRENT_ENV_DLLS_ADDED:
            add_current_python_dll_directories()
            _CURRENT_ENV_DLLS_ADDED = True
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
    repair_runtime_python_dlls()
    for candidate in _bootstrap_python_dll_directories():
        _add_dll_directory(candidate)
    _add_runtime_dll_directories(site_packages)

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
