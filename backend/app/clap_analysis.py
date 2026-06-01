from __future__ import annotations

import importlib
from importlib.machinery import PathFinder
import importlib.util
import math
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import MODEL_DIR
from .database import connect, get_setting, set_setting
from .ml_runtime import activate_ml_runtime, ml_runtime_site_packages, runtime_status, use_managed_ml_runtime


DEFAULT_MODEL_ID = "laion/clap-htsat-fused"
DEFAULT_CACHE_DIR = MODEL_DIR / "clap"
DEFAULT_SAMPLES_PER_TRACK = 3
MAX_SAMPLES_PER_TRACK = 8
CLAP_SAMPLE_WINDOW_SECONDS = 10.0
MAX_REASONABLE_TRACK_DURATION_SECONDS = 6 * 60 * 60

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
MOOD_LABELS = [
    "energetic",
    "calm",
    "happy",
    "sad",
    "melancholic",
    "dark",
    "bright",
    "aggressive",
    "mellow",
    "romantic",
    "angry",
    "dreamy",
    "tense",
    "playful",
    "dramatic",
    "danceable",
    "acoustic",
]
MOOD_LABEL_BIAS = {}
DEPENDENCY_NAMES = ("torch", "transformers", "librosa", "soundfile", "soxr")


@dataclass(frozen=True)
class ClapConfig:
    model_id: str
    cache_dir: Path
    samples_per_track: int
    sample_window_seconds: float = CLAP_SAMPLE_WINDOW_SECONDS

    @property
    def max_duration_seconds(self) -> float:
        return float(self.samples_per_track) * self.sample_window_seconds


@dataclass
class AudioAnalysis:
    genre: str | None
    confidence: float | None
    tags: dict[str, float]
    mood: str | None
    mood_confidence: float | None
    mood_tags: dict[str, float]
    embedding: list[float]
    provider: str
    model: str
    updated_at: str


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _path_setting(conn, key: str, fallback: Path) -> Path:
    value = get_setting(conn, key)
    return Path(value).expanduser() if value else fallback


def _int_setting(conn, key: str) -> int | None:
    value = get_setting(conn, key)
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def _bounded_samples_per_track(value: int | float | str | None) -> int:
    if value is None:
        return DEFAULT_SAMPLES_PER_TRACK
    try:
        numeric = int(round(float(value)))
    except (TypeError, ValueError):
        return DEFAULT_SAMPLES_PER_TRACK
    return max(1, min(MAX_SAMPLES_PER_TRACK, numeric))


def _samples_from_duration_seconds(value: int | float | str | None) -> int:
    if value is None:
        return DEFAULT_SAMPLES_PER_TRACK
    try:
        duration = float(value)
    except (TypeError, ValueError):
        return DEFAULT_SAMPLES_PER_TRACK
    samples = math.ceil(max(CLAP_SAMPLE_WINDOW_SECONDS, duration) / CLAP_SAMPLE_WINDOW_SECONDS)
    return _bounded_samples_per_track(samples)


def load_config() -> ClapConfig:
    with connect() as conn:
        model_id = get_setting(conn, "clap_model_id") or DEFAULT_MODEL_ID
        cache_dir = _path_setting(conn, "clap_cache_dir", DEFAULT_CACHE_DIR)
        samples_per_track = _int_setting(conn, "clap_samples_per_track")
        if samples_per_track is None:
            samples_per_track = _samples_from_duration_seconds(
                get_setting(conn, "clap_max_duration_seconds")
            )
    return ClapConfig(
        model_id=model_id,
        cache_dir=cache_dir,
        samples_per_track=_bounded_samples_per_track(samples_per_track),
    )


def save_config(
    model_id: str | None = None,
    cache_dir: str | None = None,
    max_duration_seconds: float | None = None,
    samples_per_track: int | None = None,
) -> ClapConfig:
    with connect() as conn:
        if model_id is not None:
            set_setting(conn, "clap_model_id", model_id.strip() or None)
        if cache_dir is not None:
            set_setting(conn, "clap_cache_dir", str(Path(cache_dir).expanduser()) if cache_dir.strip() else None)
        if samples_per_track is not None or max_duration_seconds is not None:
            bounded_samples = (
                _bounded_samples_per_track(samples_per_track)
                if samples_per_track is not None
                else _samples_from_duration_seconds(max_duration_seconds)
            )
            set_setting(conn, "clap_samples_per_track", str(bounded_samples))
            set_setting(conn, "clap_max_duration_seconds", str(bounded_samples * CLAP_SAMPLE_WINDOW_SECONDS))
        conn.commit()
    return load_config()


def _python_import_spec(name: str):
    try:
        return importlib.util.find_spec(name)
    except (ImportError, ValueError):
        return None


def _managed_runtime_import_spec(name: str):
    site_packages = ml_runtime_site_packages()
    if site_packages is not None and site_packages.exists():
        spec = PathFinder.find_spec(name, [str(site_packages)])
        if spec is not None:
            return spec
    return _python_import_spec(name)


def _dependency_import_spec(name: str):
    return _managed_runtime_import_spec(name) if use_managed_ml_runtime() else _python_import_spec(name)


def quick_dependency_status() -> dict[str, bool]:
    if use_managed_ml_runtime():
        return {name: _managed_runtime_import_spec(name) is not None for name in DEPENDENCY_NAMES}

    return {name: _python_import_spec(name) is not None for name in DEPENDENCY_NAMES}


def dependency_status() -> dict[str, bool]:
    activated = activate_ml_runtime()
    if use_managed_ml_runtime() and not activated:
        return {name: False for name in DEPENDENCY_NAMES}
    return {name: _dependency_import_spec(name) is not None for name in DEPENDENCY_NAMES}


def dependencies_installed() -> bool:
    deps = dependency_status()
    return all(deps.values()) and not dependency_errors()


def dependency_errors() -> dict[str, str]:
    activated = activate_ml_runtime()
    if use_managed_ml_runtime() and not activated:
        return {}
    errors: dict[str, str] = {}
    for name in DEPENDENCY_NAMES:
        if _dependency_import_spec(name) is None:
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
    if _dependency_import_spec("transformers") is None or "transformers" in dependency_errors():
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


def quick_model_cached(config: ClapConfig) -> bool:
    cache_dir = config.cache_dir.expanduser()
    if not cache_dir.exists():
        return False
    model_cache = cache_dir / f"models--{config.model_id.replace('/', '--')}"
    if (model_cache / "config.json").exists():
        return True
    if any(model_cache.glob("snapshots/*/config.json")):
        return True
    return False


def status(deep: bool = False) -> dict[str, Any]:
    config = load_config()
    if deep:
        activate_ml_runtime()
        deps, errors = _dependency_ready_status()
    else:
        deps = quick_dependency_status()
        errors = {}
    installed = all(deps.values())
    runtime = runtime_status(include_bootstrap=deep and not installed)
    cached = (model_cached(config) if deep else quick_model_cached(config)) if deps.get("transformers") else False
    torch_version = None
    torch_device = runtime.get("runtime_device") if not deep else None
    cuda_available = False
    cuda_device_name = None

    if deep and deps.get("torch"):
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
                "Install matching Python or set FLAC_CAFE_BOOTSTRAP_PYTHON."
            )
        else:
            message = f"CLAP dependencies are not installed yet: {missing}."
        if errors:
            first_name, first_error = next(iter(errors.items()))
            message = f"{message} {first_name} import failed: {first_error}"
    elif cached:
        message = "CLAP audio analysis is ready."
    elif not deep:
        message = "CLAP runtime appears installed. Verifying details in the background."
    else:
        message = "CLAP dependencies are installed. The model will download on first analysis if it is not cached."

    return {
        "installed": installed,
        "dependencies": deps,
        "dependency_errors": errors,
        "model_id": config.model_id,
        "cache_dir": str(config.cache_dir),
        "max_duration_seconds": config.max_duration_seconds,
        "samples_per_track": config.samples_per_track,
        "max_samples_per_track": MAX_SAMPLES_PER_TRACK,
        "sample_window_seconds": config.sample_window_seconds,
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


def _normalized_path_text(value: str) -> str:
    return unicodedata.normalize("NFC", value)


def _mojibake_repair_candidates(value: str) -> list[str]:
    candidates = [value, _normalized_path_text(value)]
    for source_encoding, errors in (("cp1252", "strict"), ("cp1252", "surrogateescape")):
        try:
            repaired = value.encode(source_encoding, errors=errors).decode("utf-8")
            candidates.extend([repaired, _normalized_path_text(repaired)])
        except UnicodeError:
            pass

    unique: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate not in seen:
            unique.append(candidate)
            seen.add(candidate)
    return unique


def _lossy_name_pattern(name: str) -> re.Pattern[str] | None:
    if "?" not in name and "\ufffd" not in name:
        return None
    parts = []
    for character in _normalized_path_text(name):
        if character in {"?", "\ufffd"}:
            parts.append(".")
        else:
            parts.append(re.escape(character))
    return re.compile("^" + "".join(parts) + "$", re.IGNORECASE)


def resolve_audio_path(path: str | Path) -> Path:
    """Resolve visually-equivalent or lossy Unicode filenames before audio load."""
    original = Path(path)
    for candidate_text in _mojibake_repair_candidates(str(original)):
        candidate = Path(candidate_text)
        if candidate.exists():
            return candidate

    parent = original.parent
    if not parent.exists():
        return original

    target_keys = {
        _normalized_path_text(Path(candidate_text).name).casefold()
        for candidate_text in _mojibake_repair_candidates(str(original))
    }
    lossy_patterns = [
        pattern
        for candidate_text in _mojibake_repair_candidates(str(original))
        if (pattern := _lossy_name_pattern(Path(candidate_text).name)) is not None
    ]

    matches = []
    try:
        siblings = list(parent.iterdir())
    except OSError:
        return original
    for sibling in siblings:
        if not sibling.is_file():
            continue
        sibling_name = _normalized_path_text(sibling.name)
        if sibling_name.casefold() in target_keys or any(
            pattern.match(sibling_name) for pattern in lossy_patterns
        ):
            matches.append(sibling)

    return matches[0] if len(matches) == 1 else original


def sample_offsets(
    duration_seconds: float | None,
    samples_per_track: int,
    window_seconds: float = CLAP_SAMPLE_WINDOW_SECONDS,
) -> list[float]:
    # CLAP was trained around short windows, so spread fixed-size samples across
    # the song instead of feeding one long excerpt that can bias toward a section.
    count = _bounded_samples_per_track(samples_per_track)
    if duration_seconds is None or duration_seconds <= 0:
        return [0.0]
    max_start = max(0.0, duration_seconds - window_seconds)
    if max_start <= 0:
        return [0.0]

    offsets: list[float] = []
    seen: set[float] = set()
    for index in range(count):
        center = duration_seconds * ((index + 0.5) / count)
        offset = min(max(center - (window_seconds / 2.0), 0.0), max_start)
        key = round(offset, 3)
        if key not in seen:
            offsets.append(offset)
            seen.add(key)
    return offsets or [0.0]


def _average_rows(rows: list[list[float]]) -> list[float]:
    if not rows:
        return []
    width = len(rows[0])
    return [
        sum(float(row[index]) for row in rows) / len(rows)
        for index in range(width)
    ]


def _apply_label_bias(probabilities: list[float], labels: list[str], bias: dict[str, float]) -> list[float]:
    if not probabilities:
        return probabilities
    adjusted = [
        max(0.0, value * bias.get(label, 1.0))
        for value, label in zip(probabilities, labels, strict=False)
    ]
    total = sum(adjusted)
    if total <= 0:
        return probabilities
    return [value / total for value in adjusted]


def _normalized_average_embedding(rows: list[list[float]]) -> list[float]:
    averaged = _average_rows(rows)
    norm = math.sqrt(sum(value * value for value in averaged))
    if norm <= 1e-12:
        return [round(float(value), 6) for value in averaged]
    return [round(float(value / norm), 6) for value in averaged]


def _exception_chain_message(exc: BaseException) -> str:
    messages: list[str] = []
    current: BaseException | None = exc
    while current is not None:
        detail = str(current).strip()
        text = f"{type(current).__name__}: {detail}" if detail else type(current).__name__
        if text not in messages:
            messages.append(text)
        current = current.__cause__ or current.__context__
    return " -> ".join(messages)


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
        try:
            processor_class = transformers.ClapProcessor
            model_class = transformers.ClapModel
            self.processor = processor_class.from_pretrained(
                self.config.model_id,
                cache_dir=str(self.config.cache_dir),
            )
            self.model = model_class.from_pretrained(
                self.config.model_id,
                cache_dir=str(self.config.cache_dir),
            ).to(self.device)
        except Exception as exc:
            raise RuntimeError(f"Could not load CLAP model runtime: {_exception_chain_message(exc)}") from exc
        self.model.eval()
        self.sample_rate = int(
            getattr(getattr(self.processor, "feature_extractor", None), "sampling_rate", 48000)
            or 48000
        )
        self.genre_prompts = [f"This audio is a {label} song." for label in GENRE_LABELS]
        self.mood_prompts = [f"This music sounds {label}." for label in MOOD_LABELS]
        self.prompts = self.genre_prompts + self.mood_prompts

    def analyze_path(self, path: str | Path, top_n: int = 8) -> AudioAnalysis:
        audio_samples = self._load_audio_samples(path)
        return self._analyze_track_samples(audio_samples, top_n)

    def analyze_many(self, tracks: list[dict[str, Any]], top_n: int = 8) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        loaded: list[tuple[int, int, list[Any]]] = []
        for index, track in enumerate(tracks):
            track_id = int(track["track_id"])
            path = str(track["path"])
            try:
                loaded.append((index, track_id, self._load_audio_samples(path)))
                results.append({"status": "pending", "track_id": track_id, "path": path})
            except Exception as exc:  # noqa: BLE001 - return per-track analysis failures.
                results.append(
                    {
                        "status": "error",
                        "track_id": track_id,
                        "path": path,
                        "error": str(exc),
                    }
                )

        if not loaded:
            return results

        audio_batch: list[Any] = []
        sample_ranges: list[tuple[int, int, int, int]] = []
        for index, track_id, audio_samples in loaded:
            start = len(audio_batch)
            audio_batch.extend(audio_samples)
            sample_ranges.append((index, track_id, start, len(audio_batch)))

        # Flatten all windows into one model call, then slice the probability
        # rows back to each track. This is where CPU/GPU batching pays off.
        genre_probability_rows, mood_probability_rows, embeddings = self._analyze_audio_features(audio_batch)
        updated_at = utc_now()
        for index, track_id, start, end in sample_ranges:
            analysis = self._analysis_from_features(
                genre_probability_rows[start:end],
                mood_probability_rows[start:end],
                embeddings[start:end],
                top_n,
                updated_at,
            )
            results[index] = {
                "status": "ok",
                "track_id": track_id,
                "analysis": analysis_to_payload(analysis),
            }
        return results

    def _audio_duration_seconds(self, path: Path) -> float | None:
        try:
            soundfile = importlib.import_module("soundfile")
            info = soundfile.info(str(path))
            sample_rate = float(getattr(info, "samplerate", 0) or 0)
            frames = float(getattr(info, "frames", 0) or 0)
            if sample_rate > 0 and frames > 0:
                duration = frames / sample_rate
                if 0 < duration <= MAX_REASONABLE_TRACK_DURATION_SECONDS:
                    return duration
        except Exception:
            pass

        try:
            duration = float(self.librosa.get_duration(path=str(path)))
        except TypeError:
            try:
                duration = float(self.librosa.get_duration(filename=str(path)))
            except Exception:
                return None
        except Exception:
            return None
        return duration if 0 < duration <= MAX_REASONABLE_TRACK_DURATION_SECONDS else None

    def _load_audio_samples(self, path: str | Path) -> list[Any]:
        resolved_path = resolve_audio_path(path)
        if not resolved_path.is_file():
            raise FileNotFoundError(f"Audio file does not exist: {path}")
        offsets = sample_offsets(
            self._audio_duration_seconds(resolved_path),
            self.config.samples_per_track,
            self.config.sample_window_seconds,
        )
        audio_samples = []
        errors = []
        # Keep usable windows even if one offset fails; bad files should not
        # poison the whole batch when a later section can still decode.
        for offset in offsets:
            try:
                audio, _sample_rate = self.librosa.load(
                    str(resolved_path),
                    sr=self.sample_rate,
                    mono=True,
                    offset=offset,
                    duration=self.config.sample_window_seconds,
                )
                if getattr(audio, "size", 0) > 0:
                    audio_samples.append(audio)
            except Exception as exc:  # noqa: BLE001 - keep other readable windows.
                errors.append(f"{offset:.2f}s: {_exception_chain_message(exc)}")
        if not audio_samples:
            detail = "; ".join(errors[-3:])
            if detail:
                raise RuntimeError(f"Audio decoder returned no samples. Decoder errors: {detail}")
            raise RuntimeError("Audio decoder returned no samples.")
        return audio_samples

    def _analyze_track_samples(self, audio_samples: list[Any], top_n: int) -> AudioAnalysis:
        genre_probability_rows, mood_probability_rows, embeddings = self._analyze_audio_features(audio_samples)
        return self._analysis_from_features(genre_probability_rows, mood_probability_rows, embeddings, top_n, utc_now())

    def _analyze_audio_features(self, audio_batch: list[Any]) -> tuple[list[list[float]], list[list[float]], list[list[float]]]:
        inputs = _processor_call(
            self.processor,
            audio=audio_batch,
            text=self.prompts,
            sampling_rate=self.sample_rate,
            return_tensors="pt",
            padding=True,
        )
        inputs = _to_device(inputs, self.device)

        with self.torch.inference_mode():
            outputs = self.model(**inputs)
            logits = outputs.logits_per_audio
            genre_logits = logits[:, :len(GENRE_LABELS)]
            mood_logits = logits[:, len(GENRE_LABELS):]
            genre_probability_rows = genre_logits.softmax(dim=-1).detach().cpu().tolist()
            mood_probability_rows = mood_logits.softmax(dim=-1).detach().cpu().tolist()
            audio_embeds = outputs.audio_embeds
            audio_embeds = audio_embeds / audio_embeds.norm(dim=-1, keepdim=True).clamp(min=1e-12)
            embeddings = audio_embeds.detach().cpu().tolist()

        return genre_probability_rows, mood_probability_rows, embeddings

    def _analysis_from_features(
        self,
        genre_probability_rows: list[list[float]],
        mood_probability_rows: list[list[float]],
        embeddings: list[list[float]],
        top_n: int,
        updated_at: str,
    ) -> AudioAnalysis:
        genre_probabilities = _average_rows(genre_probability_rows)
        mood_probabilities = _apply_label_bias(
            _average_rows(mood_probability_rows),
            MOOD_LABELS,
            MOOD_LABEL_BIAS,
        )
        embedding = _normalized_average_embedding(embeddings)
        tags = self._top_tags(genre_probabilities, GENRE_LABELS, top_n)
        genre, confidence = next(iter(tags.items()), (None, None))
        mood_tags = self._top_tags(mood_probabilities, MOOD_LABELS, len(MOOD_LABELS))
        mood, mood_confidence = next(iter(mood_tags.items()), (None, None))
        return AudioAnalysis(
            genre=genre,
            confidence=confidence,
            tags=tags,
            mood=mood,
            mood_confidence=mood_confidence,
            mood_tags=mood_tags,
            embedding=embedding,
            provider="clap",
            model=self.config.model_id,
            updated_at=updated_at,
        )

    def _top_tags(self, probabilities: list[float], labels: list[str], top_n: int) -> dict[str, float]:
        ranked = sorted(enumerate(probabilities), key=lambda item: item[1], reverse=True)[:top_n]
        return {
            labels[index]: round(float(score), 6)
            for index, score in ranked
            if index < len(labels)
        }


def analysis_to_payload(analysis: AudioAnalysis) -> dict[str, Any]:
    return {
        "genre": analysis.genre,
        "confidence": analysis.confidence,
        "tags": analysis.tags,
        "mood": analysis.mood,
        "mood_confidence": analysis.mood_confidence,
        "mood_tags": analysis.mood_tags,
        "embedding": analysis.embedding,
        "provider": analysis.provider,
        "model": analysis.model,
        "updated_at": analysis.updated_at,
    }
