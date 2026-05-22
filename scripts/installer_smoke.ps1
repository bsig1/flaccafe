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

$CleanupFragment = Join-Path $Root "src-tauri\wix\cleanup-appdata.wxs"
if (-not (Test-Path $CleanupFragment)) {
    throw "Missing MSI uninstall cleanup fragment: $CleanupFragment"
}

$FragmentRefs = @($Config.bundle.windows.wix.fragmentPaths)
if ($FragmentRefs -notcontains "wix/cleanup-appdata.wxs") {
    throw "tauri.conf.json does not reference the MSI uninstall cleanup fragment."
}

$ComponentRefs = @($Config.bundle.windows.wix.componentRefs)
if ($ComponentRefs -notcontains "FlacCafeAppDataCleanupMarker") {
    throw "tauri.conf.json does not reference the MSI cleanup marker component."
}

$CleanupText = Get-Content $CleanupFragment -Raw
foreach ($Needle in @("FlacCafeAppDataCleanupMarker", "PromptRemoveFlacCafeAppData", "Before=`"RemoveFiles`"", "RemoveFlacCafeAppData", "FLACCAFE_REMOVE_APPDATA", "%LOCALAPPDATA%\FLAC Cafe")) {
    if (-not $CleanupText.Contains($Needle)) {
        throw "MSI cleanup fragment is missing expected uninstall behavior: $Needle"
    }
}

Write-Host "Installer smoke check passed for FLAC Cafe $($Config.version)."
