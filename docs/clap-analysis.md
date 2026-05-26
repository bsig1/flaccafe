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

The first analysis run downloads the configured Hugging Face model into `backend\models\clap` by default. The Analysis page lets you change the model id, cache directory, and number of seconds analyzed per track.

## Runtime Flow

Rust owns the Analysis page job state: candidate selection, progress, ETA, pause/resume/cancel, failure marking, and SQLite writes for completed analysis rows. During a batch, Rust starts `backend.app.clap_worker` as a persistent JSON-lines Python worker and sends one track at a time to it. That worker owns only the Python-specialist part: loading Transformers/Torch and returning CLAP genre, tag, and embedding data.

This split keeps the app-facing controller native and avoids paying Python/Torch startup for every track, while still leaving CLAP inference in the mature Python ecosystem.

## Default Model

The default model is `laion/clap-htsat-fused`, which Hugging Face exposes as a Transformers-compatible CLAP model for zero-shot audio classification and audio/text embeddings.

## AutoDJ

CLAP output is stored in SQLite only:

- `analysis_provider`
- `analysis_model`
- `analysis_genre`
- `analysis_genre_confidence`
- `analysis_genre_tags`
- `analysis_embedding`
- `analysis_updated_at`

AutoDJ uses CLAP embeddings for seed-track audio similarity when the Similarity slider is above zero. Embedded metadata genre is still used automatically.

To turn CLAP's predicted genre into editable metadata, use File Management > CLAP Genre Tags. Rust builds the preview and applies SQLite-only changes directly. If file writing is enabled, the apply step delegates the actual tag write to the Python mutagen worker, so audio files are only modified through the same safety path as manual metadata edits.
