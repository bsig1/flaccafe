from __future__ import annotations

import importlib
import importlib.util
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import MODEL_DIR
from .database import connect, get_setting, set_setting
from .ml_runtime import activate_ml_runtime, runtime_status, use_managed_ml_runtime


DEFAULT_MODEL_ID = "laion/clap-htsat-fused"
DEFAULT_CACHE_DIR = MODEL_DIR / "clap"
DEFAULT_MAX_DURATION_SECONDS = 45.0

GENRE_LABELS = [
    "rock",
    "alternative rock",
    "indie rock",
    "pop",
    "dance pop",
    "synthpop",
    "pop punk",
    "punk rock",
    "emo",
    "metal",
    "hard rock",
    "hip hop",
    "trap",
    "r&b",
    "soul",
    "electronic",
    "house",
    "techno",
    "drum and bass",
    "ambient",
    "country",
    "folk",
    "singer-songwriter",
    "acoustic",
    "jazz",
    "blues",
    "classical",
    "soundtrack",
    "reggae",
    "latin",
]


@dataclass(frozen=True)
class ClapConfig:
    model_id: str
    cache_dir: Path
    max_duration_seconds: float


@dataclass
class AudioAnalysis:
    genre: str | None
    confidence: float | None
    tags: dict[str, float]
    embedding: list[float]
    provider: str
    model: str
    updated_at: str


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _path_setting(conn, key: str, fallback: Path) -> Path:
    value = get_setting(conn, key)
    return Path(value).expanduser() if value else fallback


def _float_setting(conn, key: str, fallback: float) -> float:
    value = get_setting(conn, key)
    if not value:
        return fallback
    try:
        return float(value)
    except ValueError:
        return fallback


def load_config() -> ClapConfig:
    with connect() as conn:
        model_id = get_setting(conn, "clap_model_id") or DEFAULT_MODEL_ID
        cache_dir = _path_setting(conn, "clap_cache_dir", DEFAULT_CACHE_DIR)
        max_duration = _float_setting(
            conn,
            "clap_max_duration_seconds",
            DEFAULT_MAX_DURATION_SECONDS,
        )
    return ClapConfig(
        model_id=model_id,
        cache_dir=cache_dir,
        max_duration_seconds=max(5.0, min(180.0, max_duration)),
    )


def save_config(
    model_id: str | None = None,
    cache_dir: str | None = None,
    max_duration_seconds: float | None = None,
) -> ClapConfig:
    with connect() as conn:
        if model_id is not None:
            set_setting(conn, "clap_model_id", model_id.strip() or None)
        if cache_dir is not None:
            set_setting(conn, "clap_cache_dir", str(Path(cache_dir).expanduser()) if cache_dir.strip() else None)
        if max_duration_seconds is not None:
            bounded = max(5.0, min(180.0, float(max_duration_seconds)))
            set_setting(conn, "clap_max_duration_seconds", str(bounded))
        conn.commit()
    return load_config()


def dependency_status() -> dict[str, bool]:
    activate_ml_runtime()
    return {
        "torch": importlib.util.find_spec("torch") is not None,
        "transformers": importlib.util.find_spec("transformers") is not None,
        "librosa": importlib.util.find_spec("librosa") is not None,
        "soundfile": importlib.util.find_spec("soundfile") is not None,
    }


def dependencies_installed() -> bool:
    deps = dependency_status()
    return all(deps.values()) and not dependency_errors()


def dependency_errors() -> dict[str, str]:
    activate_ml_runtime()
    errors: dict[str, str] = {}
    for name in ("torch", "transformers", "librosa", "soundfile"):
        if importlib.util.find_spec(name) is None:
            continue
        try:
            importlib.import_module(name)
        except Exception as exc:
            errors[name] = str(exc)
    return errors


def _dependency_ready_status() -> tuple[dict[str, bool], dict[str, str]]:
    deps = dependency_status()
    errors = dependency_errors()
    for name in errors:
        deps[name] = False
    return deps, errors


def model_cached(config: ClapConfig) -> bool:
    activate_ml_runtime()
    if importlib.util.find_spec("transformers") is None or "transformers" in dependency_errors():
        return False
    try:
        transformers_utils = importlib.import_module("transformers.utils")
        transformers_utils.cached_file(
            config.model_id,
            "config.json",
            cache_dir=str(config.cache_dir),
            local_files_only=True,
        )
        return True
    except Exception:
        return False


def status() -> dict[str, Any]:
    activate_ml_runtime()
    config = load_config()
    deps, errors = _dependency_ready_status()
    installed = all(deps.values())
    runtime = runtime_status(include_bootstrap=not installed)
    cached = model_cached(config) if deps.get("transformers") else False
    torch_version = None
    torch_device = None
    cuda_available = False
    cuda_device_name = None

    if deps.get("torch"):
        try:
            torch = importlib.import_module("torch")
            torch_version = getattr(torch, "__version__", None)
            cuda_available = bool(torch.cuda.is_available())
            torch_device = "cuda" if cuda_available else "cpu"
            if cuda_available and torch.cuda.device_count() > 0:
                cuda_device_name = torch.cuda.get_device_name(0)
        except Exception as exc:
            torch_device = "unknown"
            errors["torch"] = str(exc)

    if not installed:
        missing = ", ".join(name for name, present in deps.items() if not present)
        if use_managed_ml_runtime() and not runtime["runtime_exists"]:
            message = "CLAP ML runtime is not installed yet. Choose CPU or NVIDIA CUDA to install it."
        elif use_managed_ml_runtime() and not runtime["install_supported"]:
            message = (
                f"CLAP needs Python {runtime['required_python']} to create the ML runtime. "
                "Install matching Python or set LOCAL_AUTODJ_BOOTSTRAP_PYTHON."
            )
        else:
            message = f"CLAP dependencies are not installed yet: {missing}."
        if errors:
            first_name, first_error = next(iter(errors.items()))
            message = f"{message} {first_name} import failed: {first_error}"
    elif cached:
        message = "CLAP audio analysis is ready."
    else:
        message = "CLAP dependencies are installed. The model will download on first analysis if it is not cached."

    return {
        "installed": installed,
        "dependencies": deps,
        "dependency_errors": errors,
        "model_id": config.model_id,
        "cache_dir": str(config.cache_dir),
        "max_duration_seconds": config.max_duration_seconds,
        "model_cached": cached,
        "torch_version": torch_version,
        "torch_device": torch_device,
        "cuda_available": cuda_available,
        "cuda_device_name": cuda_device_name,
        **runtime,
        "message": message,
    }


def _to_device(batch: Any, device: str) -> dict[str, Any]:
    return {
        key: value.to(device) if hasattr(value, "to") else value
        for key, value in batch.items()
    }


def _processor_call(processor: Any, audio: Any | None = None, **kwargs: Any) -> Any:
    if audio is None:
        return processor(**kwargs)
    try:
        return processor(audio=audio, **kwargs)
    except TypeError:
        return processor(audios=audio, **kwargs)


class ClapAnalyzer:
    def __init__(self, config: ClapConfig | None = None) -> None:
        activate_ml_runtime()
        self.config = config or load_config()
        if not dependencies_installed():
            raise RuntimeError("CLAP dependencies are not installed. Use Install CLAP to create the ML runtime.")

        torch = importlib.import_module("torch")
        librosa = importlib.import_module("librosa")
        transformers = importlib.import_module("transformers")

        self.torch = torch
        self.librosa = librosa
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.config.cache_dir.mkdir(parents=True, exist_ok=True)
        self.processor = transformers.ClapProcessor.from_pretrained(
            self.config.model_id,
            cache_dir=str(self.config.cache_dir),
        )
        self.model = transformers.ClapModel.from_pretrained(
            self.config.model_id,
            cache_dir=str(self.config.cache_dir),
        ).to(self.device)
        self.model.eval()
        self.sample_rate = int(
            getattr(getattr(self.processor, "feature_extractor", None), "sampling_rate", 48000)
            or 48000
        )
        self.prompts = [f"a {label} song" for label in GENRE_LABELS]

    def analyze_path(self, path: str | Path, top_n: int = 8) -> AudioAnalysis:
        audio, _sample_rate = self.librosa.load(
            str(path),
            sr=self.sample_rate,
            mono=True,
            duration=self.config.max_duration_seconds,
        )
        if getattr(audio, "size", 0) <= 0:
            raise RuntimeError("Audio decoder returned no samples.")

        inputs = _processor_call(
            self.processor,
            audio=audio,
            text=self.prompts,
            sampling_rate=self.sample_rate,
            return_tensors="pt",
            padding=True,
        )
        inputs = _to_device(inputs, self.device)

        with self.torch.inference_mode():
            outputs = self.model(**inputs)
            probabilities = outputs.logits_per_audio.softmax(dim=-1)[0].detach().cpu().tolist()
            audio_embeds = outputs.audio_embeds
            audio_embeds = audio_embeds / audio_embeds.norm(dim=-1, keepdim=True).clamp(min=1e-12)
            embedding = audio_embeds[0].detach().cpu().tolist()

        tags = self._top_tags(probabilities, top_n)
        genre, confidence = next(iter(tags.items()), (None, None))
        return AudioAnalysis(
            genre=genre,
            confidence=confidence,
            tags=tags,
            embedding=[round(float(value), 6) for value in embedding],
            provider="clap",
            model=self.config.model_id,
            updated_at=utc_now(),
        )

    def _top_tags(self, probabilities: list[float], top_n: int) -> dict[str, float]:
        ranked = sorted(enumerate(probabilities), key=lambda item: item[1], reverse=True)[:top_n]
        return {
            GENRE_LABELS[index]: round(float(score), 6)
            for index, score in ranked
            if index < len(GENRE_LABELS)
        }


def save_track_analysis(track_id: int, analysis: AudioAnalysis) -> None:
    with connect() as conn:
        conn.execute(
            """
            UPDATE tracks
            SET analysis_provider = ?,
                analysis_model = ?,
                analysis_genre = ?,
                analysis_genre_confidence = ?,
                analysis_genre_tags = ?,
                analysis_embedding = ?,
                analysis_updated_at = ?,
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (
                analysis.provider,
                analysis.model,
                analysis.genre,
                analysis.confidence,
                json.dumps(analysis.tags, ensure_ascii=True, sort_keys=True),
                json.dumps(analysis.embedding, ensure_ascii=True),
                analysis.updated_at,
                track_id,
            ),
        )
        conn.commit()
