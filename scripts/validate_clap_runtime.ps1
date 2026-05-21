param(
    [switch]$RequireInstalled
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = "python"
}

$env:FLAC_CAFE_USE_ML_RUNTIME = "1"
$PreviousPythonPath = $env:PYTHONPATH
if ($PreviousPythonPath) {
    $env:PYTHONPATH = "$Root$([System.IO.Path]::PathSeparator)$PreviousPythonPath"
} else {
    $env:PYTHONPATH = $Root
}

$Code = @'
import importlib
import json
import os
import sys

from backend.app.ml_runtime import activate_ml_runtime, runtime_status

activated = activate_ml_runtime(force=True)
status = runtime_status(include_bootstrap=True)
checks = {}
for name in ("torch", "transformers", "librosa", "soundfile", "soxr"):
    try:
        module = importlib.import_module(name)
        checks[name] = {"ok": True, "version": getattr(module, "__version__", None)}
    except Exception as exc:
        checks[name] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

print(json.dumps({"activated": activated, "status": status, "checks": checks}, indent=2, sort_keys=True))
missing = [name for name, result in checks.items() if not result["ok"]]
if status["runtime_exists"] and missing:
    raise SystemExit("CLAP runtime exists but failed imports: " + ", ".join(missing))
'@

$TempScript = Join-Path ([System.IO.Path]::GetTempPath()) ("flac-cafe-clap-validate-{0}.py" -f ([System.Guid]::NewGuid().ToString("N")))
Set-Content -LiteralPath $TempScript -Value $Code -Encoding UTF8
try {
    $Output = & $Python $TempScript
    $ExitCode = $LASTEXITCODE
    Write-Host $Output
}
finally {
    Remove-Item -LiteralPath $TempScript -Force -ErrorAction SilentlyContinue
    $env:PYTHONPATH = $PreviousPythonPath
}

if ($ExitCode -ne 0) {
    exit $ExitCode
}

$Parsed = $Output | ConvertFrom-Json
if ($RequireInstalled -and -not $Parsed.status.runtime_exists) {
    throw "CLAP runtime is required but was not found."
}

if (-not $Parsed.status.runtime_exists) {
    Write-Host "Optional CLAP runtime is not installed; validation passed in optional mode."
}
