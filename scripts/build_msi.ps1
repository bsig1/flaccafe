$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Missing Python virtual environment at $Python. Run the backend setup first."
}

function Invoke-WixLinkWithoutIce {
    param([datetime]$BuildStarted)

    $WixTools = Join-Path $env:LOCALAPPDATA "tauri\WixTools314"
    $Light = Join-Path $WixTools "light.exe"
    $WixDir = Join-Path $Root "src-tauri\target\release\wix\x64"
    $WixObj = Join-Path $WixDir "main.wixobj"
    $Locale = Join-Path $WixDir "locale.wxl"
    $Output = Join-Path $WixDir "output.msi"

    if (-not (Test-Path $Light)) {
        throw "WiX light.exe was not found at $Light."
    }
    if (-not (Test-Path $WixObj)) {
        throw "Tauri MSI build failed before producing $WixObj."
    }
    if ((Get-Item $WixObj).LastWriteTime -lt $BuildStarted.AddSeconds(-5)) {
        throw "Tauri MSI build failed and the WiX object is stale."
    }

    Write-Host "Retrying WiX link with ICE validation suppressed because Windows Installer validation is unavailable."
    Push-Location $WixDir
    try {
        & $Light -sval `
            -ext (Join-Path $WixTools "WixUIExtension.dll") `
            -ext (Join-Path $WixTools "WixUtilExtension.dll") `
            -o $Output `
            -cultures:en-us `
            -loc $Locale `
            *.wixobj
        if ($LASTEXITCODE -ne 0) {
            throw "WiX light.exe fallback failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    $Config = Get-Content (Join-Path $Root "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
    $BundleDir = Join-Path $Root "src-tauri\target\release\bundle\msi"
    $MsiPath = Join-Path $BundleDir ("{0}_{1}_x64_en-US.msi" -f $Config.productName, $Config.version)
    New-Item -ItemType Directory -Force -Path $BundleDir | Out-Null
    Copy-Item -LiteralPath $Output -Destination $MsiPath -Force
    return Get-Item $MsiPath
}

Push-Location $Root
try {
    $BuildStarted = Get-Date

    & $Python -m PyInstaller --noconfirm --clean `
        --name flaccafe-backend `
        --onefile `
        --noconsole `
        --distpath dist-backend `
        --workpath build-backend `
        --specpath build-backend `
        --hidden-import timeit `
        --hidden-import ctypes.util `
        --hidden-import pickletools `
        --exclude-module torch `
        --exclude-module transformers `
        --exclude-module librosa `
        --exclude-module soundfile `
        --exclude-module scipy `
        --exclude-module sklearn `
        --exclude-module numba `
        --exclude-module llvmlite `
        --exclude-module numpy `
        --exclude-module pandas `
        --exclude-module matplotlib `
        backend\desktop_backend.py
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller failed with exit code $LASTEXITCODE."
    }

    & npm.cmd run tauri -- build --bundles msi
    if ($LASTEXITCODE -ne 0) {
        $Msi = Invoke-WixLinkWithoutIce -BuildStarted $BuildStarted
    } else {
        $Msi = Get-ChildItem -Path "src-tauri\target\release\bundle\msi" -Filter "*.msi" |
            Where-Object { $_.LastWriteTime -ge $BuildStarted.AddSeconds(-5) } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
    }

    if ($null -eq $Msi) {
        throw "MSI build completed without producing a fresh .msi file."
    }

    Write-Host "MSI ready: $($Msi.FullName)"
}
finally {
    Pop-Location
}
