from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock, Thread
from uuid import uuid4

from .clap_analysis import dependency_status
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


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


@dataclass
class ClapInstallJob:
    job_id: str
    device: str
    force: bool = False
    status: str = "pending"
    message: str | None = "Waiting to install CLAP dependencies."
    current_step: int = 0
    total_steps: int = 3
    current_command: str | None = None
    log: list[str] = field(default_factory=list)
    started_at: datetime = field(default_factory=utc_now)
    finished_at: datetime | None = None
    error: str | None = None

    def snapshot(self) -> dict:
        now = self.finished_at or utc_now()
        elapsed_seconds = max(0.0, (now - self.started_at).total_seconds())
        percent = 0.0
        if self.total_steps > 0:
            percent = min(100.0, (self.current_step / self.total_steps) * 100)
        if self.status == "completed":
            percent = 100.0
        return {
            "job_id": self.job_id,
            "device": self.device,
            "force": self.force,
            "status": self.status,
            "message": self.message,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "current_command": self.current_command,
            "log": self.log[-80:],
            "started_at": iso(self.started_at),
            "finished_at": iso(self.finished_at),
            "elapsed_seconds": elapsed_seconds,
            "percent": percent,
            "error": self.error,
        }


_jobs: dict[str, ClapInstallJob] = {}
_lock = Lock()


def _append_log(job_id: str, line: str) -> None:
    clean = line.strip()
    if not clean:
        return
    with _lock:
        job = _jobs[job_id]
        job.log.append(clean)
        job.log = job.log[-200:]


def _run_command(job_id: str, label: str, command: list[str]) -> None:
    with _lock:
        job = _jobs[job_id]
        job.current_command = label
        job.message = label
        job.log.append("> " + " ".join(command))

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
        _append_log(job_id, line)
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"{label} failed with exit code {return_code}.")


def _pip_install_command(
    python: str,
    packages: list[str],
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


def _run_job(job_id: str) -> None:
    try:
        with _lock:
            job = _jobs[job_id]
            job.status = "running"
            job.message = "Installing CLAP dependencies."

        if use_managed_ml_runtime():
            bootstrap = find_bootstrap_python()
            if bootstrap is None:
                raise RuntimeError(
                    f"CLAP needs Python {sys.version_info.major}.{sys.version_info.minor} on PATH to create "
                    "the ML runtime. Install matching Python or set LOCAL_AUTODJ_BOOTSTRAP_PYTHON."
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
            ("Updating runtime pip", [runtime_python, "-m", "pip", "install", "--disable-pip-version-check", "--no-cache-dir", "--upgrade", "pip"]),
            (
                "Installing Torch for CPU" if _jobs[job_id].device == "cpu" else "Installing Torch for NVIDIA CUDA",
                _pip_install_command(
                    runtime_python,
                    ["torch"],
                    force=_jobs[job_id].force,
                    index_url=TORCH_INDEX_URLS[_jobs[job_id].device],
                ),
            ),
            (
                "Installing CLAP audio packages",
                _pip_install_command(runtime_python, BASE_PACKAGES, force=_jobs[job_id].force),
            ),
        ]
        with _lock:
            _jobs[job_id].total_steps = len(steps)

        for index, (label, command) in enumerate(steps, start=1):
            _run_command(job_id, label, command)
            with _lock:
                _jobs[job_id].current_step = index

        if use_managed_ml_runtime():
            write_runtime_metadata(_jobs[job_id].device, bootstrap)
            repair_runtime_python_dlls(bootstrap)
            activate_ml_runtime(force=True)

        deps = dependency_status()
        missing = [name for name, installed in deps.items() if not installed]
        if missing:
            raise RuntimeError(f"Install finished, but these CLAP dependencies are still missing: {', '.join(missing)}.")

        with _lock:
            job = _jobs[job_id]
            job.status = "completed"
            job.message = "CLAP dependencies installed."
            job.finished_at = utc_now()
            job.current_command = None
    except Exception as exc:
        with _lock:
            job = _jobs[job_id]
            job.status = "failed"
            job.message = str(exc)
            job.error = str(exc)
            job.finished_at = utc_now()
            job.current_command = None


def start_clap_install_job(device: str, force: bool = False) -> dict:
    if device not in TORCH_INDEX_URLS:
        raise ValueError("device must be cpu or cuda")
    job_id = uuid4().hex
    with _lock:
        _jobs[job_id] = ClapInstallJob(job_id=job_id, device=device, force=force)
    thread = Thread(target=_run_job, args=(job_id,), daemon=True)
    thread.start()
    return get_clap_install_job(job_id)


def get_clap_install_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else job.snapshot()
