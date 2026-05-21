$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
  $Python = $VenvPython
} else {
  $Python = "python"
}

Set-Location $Root

$DefaultMlRuntime = Join-Path $env:LOCALAPPDATA "FLAC Cafe\ml-runtime"
if (-not $env:FLAC_CAFE_ML_RUNTIME_DIR) {
  $env:FLAC_CAFE_ML_RUNTIME_DIR = $DefaultMlRuntime
}
$env:FLAC_CAFE_USE_ML_RUNTIME = "1"

& $Python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8765 --reload
