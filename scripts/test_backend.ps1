$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (Test-Path $venvPython) {
  & $venvPython -m unittest discover -s backend/tests
} else {
  python -m unittest discover -s backend/tests
}
