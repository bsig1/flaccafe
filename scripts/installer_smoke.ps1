$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $Root "src-tauri\tauri.conf.json"
$BuildScript = Join-Path $Root "scripts\build_msi.ps1"
$SidecarBuildScript = Join-Path $Root "scripts\build_backend_sidecar.ps1"
$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

if ($Config.productName -ne "FLAC Cafe") {
    throw "Unexpected productName '$($Config.productName)'."
}

if (-not $Config.bundle.active) {
    throw "Tauri bundle is not active."
}

$BackendResource = $Config.bundle.resources.PSObject.Properties |
    Where-Object { $_.Name -eq "../dist-backend/flaccafe-backend" -and $_.Value -eq "flaccafe-backend" }
if (-not $BackendResource) {
    throw "Bundled backend resource is missing from tauri.conf.json."
}

$FpcalcResource = $Config.bundle.resources.PSObject.Properties |
    Where-Object { $_.Name -eq "../backend/tools/chromaprint/fpcalc.exe" -and $_.Value -eq "tools/chromaprint/fpcalc.exe" }
if (-not $FpcalcResource) {
    throw "Bundled Chromaprint fpcalc resource is missing from tauri.conf.json."
}

foreach ($Icon in $Config.bundle.icon) {
    $IconPath = Join-Path $Root "src-tauri\$Icon"
    if (-not (Test-Path $IconPath)) {
        throw "Missing app icon: $IconPath"
    }
}

$FpcalcPath = Join-Path $Root "backend\tools\chromaprint\fpcalc.exe"
if (-not (Test-Path $FpcalcPath)) {
    throw "Missing bundled Chromaprint fpcalc executable: $FpcalcPath"
}

$BuildText = Get-Content $BuildScript -Raw
if (-not $BuildText.Contains("build_backend_sidecar.ps1")) {
    throw "MSI build script does not call the backend sidecar builder."
}

$SidecarBuildText = Get-Content $SidecarBuildScript -Raw
foreach ($Needle in @('"--noconsole"', '"--exclude-module", "torch"', '"--exclude-module", "transformers"', '"--exclude-module", "librosa"')) {
    if (-not $SidecarBuildText.Contains($Needle)) {
        throw "Backend sidecar build script is missing expected packaging guard: $Needle"
    }
}

foreach ($Needle in @('"--exclude-module", "fastapi"', '"--exclude-module", "starlette"', '"--exclude-module", "uvicorn"', '"--exclude-module", "httpx"')) {
    if (-not $SidecarBuildText.Contains($Needle)) {
        throw "Backend sidecar build script is missing expected no-HTTP-framework guard: $Needle"
    }
}

foreach ($Needle in @('"--onedir"', '"--name", "flaccafe-backend"', '"--distpath", "dist-backend"')) {
    if (-not $SidecarBuildText.Contains($Needle)) {
        throw "Backend sidecar build script is missing expected output setting: $Needle"
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
