$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($NpmCommand) {
  $Npm = $NpmCommand.Source
} elseif (Test-Path "C:\Program Files\nodejs\npm.cmd") {
  $Npm = "C:\Program Files\nodejs\npm.cmd"
} else {
  throw "npm.cmd was not found. Install Node.js or add npm to PATH."
}

Set-Location $Root

$DefaultMlRuntime = Join-Path $env:LOCALAPPDATA "FLAC Cafe\ml-runtime"
if (-not $env:FLAC_CAFE_ML_RUNTIME_DIR) {
  $env:FLAC_CAFE_ML_RUNTIME_DIR = $DefaultMlRuntime
}
$env:FLAC_CAFE_USE_ML_RUNTIME = "1"

Write-Host "Starting FLAC Cafe desktop dev. Python is used as a one-shot worker, not an HTTP server."
& $Npm run desktop
