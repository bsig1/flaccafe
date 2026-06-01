# CLAP Audio Analysis

FLAC Cafe can optionally use CLAP through Hugging Face Transformers to analyze local audio files.

The base app does not require CLAP. Scanning, playback, ratings, playlists, and AutoDJ still work without the optional ML stack.

## ML Runtime

The Analysis page has an **Install CLAP** action. It prompts for:

- **CPU**: smaller and most compatible.
- **NVIDIA CUDA**: larger, but faster on supported NVIDIA GPUs.

In packaged MSI builds, FLAC Cafe creates an app-managed Python virtual environment at:

```text
%LOCALAPPDATA%\FLAC Cafe\ml-runtime
```

The bundled backend stays small and fixed. The optional CLAP/Torch packages are installed into that runtime so the user can choose CPU or NVIDIA CUDA after installing the app. The runtime creator needs a matching Python version available through the Windows Python launcher or `python` on PATH. This build uses Python 3.12.

Development and packaged runners use `FLAC_CAFE_ML_RUNTIME_DIR`, `FLAC_CAFE_USE_ML_RUNTIME`, and `FLAC_CAFE_BOOTSTRAP_PYTHON` when overriding the managed runtime. Older `LOCAL_AUTODJ_*` names are still accepted only as migration fallbacks.

For manual development installs, use one of these:

```powershell
# CPU Torch
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-clap.txt

# NVIDIA CUDA Torch
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu128
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-clap.txt
```

The first analysis run downloads the configured Hugging Face model into `backend\models\clap` by default. The Analysis page lets you change the model id, cache directory, song sample count, and batch size.

## Runtime Flow

Rust owns the Analysis page job state: runtime status/config/install job tracking, candidate selection, progress, ETA, pause/resume/cancel, failure marking, and SQLite writes for completed analysis rows. For setup and status checks, Rust starts `backend.app.clap_expert` as a one-shot JSON subprocess so Python can do the Torch/package/runtime-specific work. During a batch, Rust starts `backend.app.clap_worker` as a persistent JSON-lines Python worker and sends batches of track paths to it. That worker owns only the Python-specialist part: loading Transformers/Torch and returning CLAP genre, mood, tag, and embedding data.

This split keeps the app-facing controller Rust and avoids paying Python/Torch startup for every track, while still leaving CLAP inference in the mature Python ecosystem.

## Sampling And Batching

CLAP analysis uses 10-second audio windows. The Song Samples setting controls how many windows are spread across each track. This better matches CLAP-style short-window classification than one long excerpt, and it reduces the "everything is Latin/house/R&B" bias that appeared when the analysis listened to a single section.

The Batch Size setting is track count. Internally the worker batches audio windows, so Rust caps the effective track batch to keep the total number of windows per request under a fixed limit. For example, a high sample count may reduce the effective track batch even if the slider is set higher.

Advanced CLAP Settings includes a log that captures worker startup, effective batch caps, per-batch progress, and compact failure messages. The UI no longer shows a toast for every analyzed track.

## Default Model

The default model is `laion/clap-htsat-fused`, which Hugging Face exposes as a Transformers-compatible CLAP model for zero-shot audio classification and audio/text embeddings.

## AutoDJ

CLAP output is stored in SQLite only:

- `analysis_provider`
- `analysis_model`
- `analysis_genre`
- `analysis_genre_confidence`
- `analysis_genre_tags`
- `analysis_mood`
- `analysis_mood_confidence`
- `analysis_mood_tags`
- `analysis_embedding`
- `analysis_updated_at`

AutoDJ uses CLAP embeddings for seed-track audio similarity when the Similarity slider is above zero. It also uses CLAP mood vectors for mood similarity and explicit mood seeds when those controls are enabled. Embedded metadata genre is still used automatically.

To turn CLAP's predicted genre into editable metadata, use File Management > CLAP Genre Tags. Rust builds the preview and applies SQLite-only changes directly. If file writing is enabled, common metadata writes go through the Rust/Lofty tag writer, so audio files are modified through the same safety path as manual metadata edits.

The genre-copy tool is intentionally stricter than the similarity vector. Broad labels such as `latin`, `house`, and `r&b` need a stronger confidence/margin before they are copied into editable genre metadata, but the full tag vector remains useful for similarity and AutoDJ scoring.
