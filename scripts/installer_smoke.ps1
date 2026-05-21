$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $Root "src-tauri\tauri.conf.json"
$BuildScript = Join-Path $Root "scripts\build_msi.ps1"
$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

if ($Config.productName -ne "FLAC Cafe") {
    throw "Unexpected productName '$($Config.productName)'."
}

if (-not $Config.bundle.active) {
    throw "Tauri bundle is not active."
}

$BackendResource = $Config.bundle.resources.PSObject.Properties |
    Where-Object { $_.Name -eq "../dist-backend/flaccafe-backend.exe" -and $_.Value -eq "flaccafe-backend.exe" }
if (-not $BackendResource) {
    throw "Bundled backend resource is missing from tauri.conf.json."
}

foreach ($Icon in $Config.bundle.icon) {
    $IconPath = Join-Path $Root "src-tauri\$Icon"
    if (-not (Test-Path $IconPath)) {
        throw "Missing app icon: $IconPath"
    }
}

$BuildText = Get-Content $BuildScript -Raw
foreach ($Needle in @("--noconsole", "--exclude-module torch", "--exclude-module transformers", "--exclude-module librosa")) {
    if (-not $BuildText.Contains($Needle)) {
        throw "MSI build script is missing expected packaging guard: $Needle"
    }
}

Write-Host "Installer smoke check passed for FLAC Cafe $($Config.version)."
