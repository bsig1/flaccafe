$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
  $Python = $VenvPython
} else {
  $Python = "python"
}

Set-Location $Root

$payload = '{"action":"health","params":{},"body":null}'
$output = $payload | & $Python -m backend.app.worker
$response = $output | ConvertFrom-Json

if (-not $response.ok -or $response.code -ne 200 -or $response.body.status -ne "ok") {
  throw "Python worker health check failed: $output"
}

Write-Host "Python worker health check passed."
Write-Host 'FLAC Cafe no longer starts a Python HTTP backend. Use `npm run desktop` for the Rust-to-Python worker path.'
