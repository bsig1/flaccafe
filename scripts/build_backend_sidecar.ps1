param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$DistRoot = Join-Path $Root "dist-backend"
$OneFileBackend = Join-Path $DistRoot "flaccafe-backend.exe"
$OneDirBackend = Join-Path $DistRoot "flaccafe-backend"
$SchemaData = "$(Join-Path $Root "backend\app\schema.sql");backend\app"

if (-not (Test-Path $Python)) {
    throw "Missing Python virtual environment at $Python. Run the backend setup first."
}

$Arguments = @(
    "-m", "PyInstaller",
    "--noconfirm",
    "--name", "flaccafe-backend",
    "--onedir",
    "--noconsole",
    "--distpath", "dist-backend",
    "--workpath", "build-backend",
    "--specpath", "build-backend",
    "--hidden-import", "timeit",
    "--hidden-import", "aifc",
    "--hidden-import", "audioop",
    "--hidden-import", "cProfile",
    "--hidden-import", "bdb",
    "--hidden-import", "cmd",
    "--hidden-import", "code",
    "--hidden-import", "codeop",
    "--hidden-import", "ctypes.util",
    "--hidden-import", "ctypes.wintypes",
    "--hidden-import", "configparser",
    "--hidden-import", "doctest",
    "--hidden-import", "filecmp",
    "--hidden-import", "fileinput",
    "--hidden-import", "pdb",
    "--hidden-import", "profile",
    "--hidden-import", "pstats",
    "--hidden-import", "pickletools",
    "--hidden-import", "sndhdr",
    "--hidden-import", "sunau",
    "--hidden-import", "unittest",
    "--hidden-import", "unittest.mock",
    "--hidden-import", "wave",
    "--hidden-import", "backend.app.clap_analysis",
    "--hidden-import", "backend.app.clap_expert",
    "--hidden-import", "backend.app.clap_worker",
    "--hidden-import", "backend.app.config",
    "--hidden-import", "backend.app.database",
    "--hidden-import", "backend.app.ml_runtime",
    "--hidden-import", "backend.app.startup_profile",
    "--add-data", $SchemaData,
    "--exclude-module", "fastapi",
    "--exclude-module", "starlette",
    "--exclude-module", "uvicorn",
    "--exclude-module", "httpx",
    "--exclude-module", "torch",
    "--exclude-module", "transformers",
    "--exclude-module", "librosa",
    "--exclude-module", "soundfile",
    "--exclude-module", "scipy",
    "--exclude-module", "sklearn",
    "--exclude-module", "numba",
    "--exclude-module", "llvmlite",
    "--exclude-module", "numpy",
    "--exclude-module", "pandas",
    "--exclude-module", "matplotlib",
    "backend\desktop_backend.py"
)

if ($Clean) {
    $Arguments = @("-m", "PyInstaller", "--clean") + $Arguments[2..($Arguments.Count - 1)]
}

Push-Location $Root
try {
    if ($Clean) {
        Remove-Item -LiteralPath $OneFileBackend -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $OneDirBackend -Recurse -Force -ErrorAction SilentlyContinue
    }

    & $Python @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller failed with exit code $LASTEXITCODE."
    }

    $BackendExe = Join-Path $OneDirBackend "flaccafe-backend.exe"
    if (-not (Test-Path $BackendExe)) {
        throw "PyInstaller completed without producing $BackendExe."
    }
    Write-Host "Backend sidecar ready: $BackendExe"
}
finally {
    Pop-Location
}
