from __future__ import annotations

import json
import subprocess
import sys
from typing import Any

from .clap_analysis import save_config, status as clap_status
from .ml_runtime import (
    activate_ml_runtime,
    find_bootstrap_python,
    ml_runtime_dir,
    ml_runtime_python,
    repair_runtime_python_dlls,
    use_managed_ml_runtime,
    write_runtime_metadata,
)


BASE_PACKAGES = ["transformers", "librosa", "soundfile", "numpy"]
TORCH_INDEX_URLS = {
    "cpu": "https://download.pytorch.org/whl/cpu",
    "cuda": "https://download.pytorch.org/whl/cu128",
}


def _emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _pip_install_command(
    python: str,
    packages: list[str],
    *,
    force: bool = False,
    index_url: str | None = None,
) -> list[str]:
    command = [
        python,
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "--no-cache-dir",
    ]
    if force:
        command.append("--force-reinstall")
    command.extend(packages)
    if index_url:
        command.extend(["--index-url", index_url])
    return command


def _run_command(label: str, command: list[str]) -> None:
    _emit({"status": "log", "message": "> " + " ".join(command)})
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    process = subprocess.Popen(
        command,
        cwd=None,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=creationflags,
    )
    assert process.stdout is not None
    for line in process.stdout:
        clean = line.strip()
        if clean:
            _emit({"status": "log", "message": clean})
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"{label} failed with exit code {return_code}.")


def _install(payload: dict[str, Any]) -> None:
    device = str(payload.get("device") or "cpu").strip().lower()
    if device not in TORCH_INDEX_URLS:
        raise ValueError("device must be cpu or cuda")
    force = bool(payload.get("force"))

    if use_managed_ml_runtime():
        bootstrap = find_bootstrap_python()
        if bootstrap is None:
            raise RuntimeError(
                f"CLAP needs Python {sys.version_info.major}.{sys.version_info.minor} on PATH to create "
                "the ML runtime. Install matching Python or set FLAC_CAFE_BOOTSTRAP_PYTHON."
            )
        runtime_root = ml_runtime_dir()
        runtime_python = str(ml_runtime_python())
        runtime_root.mkdir(parents=True, exist_ok=True)
        setup_steps = [
            ("Creating ML runtime", [*bootstrap.command, "-m", "venv", str(runtime_root)]),
        ]
    else:
        bootstrap = None
        runtime_python = sys.executable
        setup_steps = []

    steps = [
        *setup_steps,
        (
            "Updating runtime pip",
            [
                runtime_python,
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-cache-dir",
                "--upgrade",
                "pip",
            ],
        ),
        (
            "Installing Torch for CPU" if device == "cpu" else "Installing Torch for NVIDIA CUDA",
            _pip_install_command(
                runtime_python,
                ["torch"],
                force=force,
                index_url=TORCH_INDEX_URLS[device],
            ),
        ),
        (
            "Installing CLAP audio packages",
            _pip_install_command(runtime_python, BASE_PACKAGES, force=force),
        ),
    ]

    _emit(
        {
            "status": "running",
            "message": "Installing CLAP dependencies.",
            "current_step": 0,
            "total_steps": len(steps),
        }
    )
    for index, (label, command) in enumerate(steps, start=1):
        _emit(
            {
                "status": "running",
                "message": label,
                "current_step": index - 1,
                "total_steps": len(steps),
                "current_command": label,
            }
        )
        _run_command(label, command)
        _emit(
            {
                "status": "running",
                "message": f"{label} complete.",
                "current_step": index,
                "total_steps": len(steps),
                "current_command": None,
            }
        )

    if use_managed_ml_runtime():
        write_runtime_metadata(device, bootstrap)
        repair_runtime_python_dlls(bootstrap)
        activate_ml_runtime(force=True)

    ready = clap_status(deep=True)
    missing = [name for name, installed in ready.get("dependencies", {}).items() if not installed]
    if missing:
        raise RuntimeError(
            "Install finished, but these CLAP dependencies are still missing: "
            + ", ".join(missing)
            + "."
        )

    _emit(
        {
            "status": "completed",
            "message": "CLAP dependencies installed.",
            "current_step": len(steps),
            "total_steps": len(steps),
            "body": ready,
        }
    )


def _handle(payload: dict[str, Any]) -> None:
    command = str(payload.get("command") or "").strip()
    if command == "status":
        _emit({"status": "ok", "body": clap_status(deep=bool(payload.get("deep")))})
    elif command == "save_config":
        save_config(
            model_id=payload.get("model_id"),
            cache_dir=payload.get("cache_dir"),
            max_duration_seconds=payload.get("max_duration_seconds"),
        )
        _emit({"status": "ok", "body": clap_status(deep=bool(payload.get("deep")))})
    elif command == "install":
        _install(payload)
    else:
        raise ValueError(f"Unknown CLAP expert command: {command or '<empty>'}")


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        if not isinstance(payload, dict):
            raise ValueError("CLAP expert request must be a JSON object")
        _handle(payload)
    except Exception as exc:
        _emit({"status": "failed", "message": str(exc), "error": str(exc)})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
