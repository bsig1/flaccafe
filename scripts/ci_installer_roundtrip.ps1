param(
    [string]$MsiPath = "",
    [switch]$AllowAppDataCleanup
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

if (-not $MsiPath) {
    $MsiPath = Get-ChildItem -Path (Join-Path $Root "src-tauri\target\release\bundle\msi") -Filter "*.msi" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 |
        ForEach-Object { $_.FullName }
}

if (-not $MsiPath -or -not (Test-Path -LiteralPath $MsiPath)) {
    throw "MSI not found. Pass -MsiPath or build one with npm.cmd run package:msi."
}

$IsCi = $env:CI -eq "true" -or $env:GITHUB_ACTIONS -eq "true"
if (-not $AllowAppDataCleanup -and -not $IsCi) {
    throw "This script uninstalls FLAC Cafe and removes %LOCALAPPDATA%\FLAC Cafe. Re-run with -AllowAppDataCleanup only on a disposable profile."
}

$InstallDir = Join-Path $env:ProgramFiles "FLAC Cafe"
$AppExe = Join-Path $InstallDir "flac-cafe.exe"
$BackendExe = Join-Path $InstallDir "flaccafe-backend\flaccafe-backend.exe"
$AppDataDir = Join-Path $env:LOCALAPPDATA "FLAC Cafe"
$Marker = Join-Path $AppDataDir "ci-uninstall-marker.txt"
$Port = 18765
$BackendProcess = $null

function Invoke-Msi {
    param([string[]]$Arguments)
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $Arguments -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -notin @(0, 3010)) {
        throw "msiexec failed with exit code $($process.ExitCode): $($Arguments -join ' ')"
    }
}

function Wait-BackendHealth {
    $deadline = (Get-Date).AddSeconds(30)
    do {
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
            if ($response.status -eq "ok") {
                return
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    } while ((Get-Date) -lt $deadline)
    throw "Packaged backend did not answer /health on port $Port."
}

try {
    New-Item -ItemType Directory -Force -Path $AppDataDir | Out-Null
    Set-Content -LiteralPath $Marker -Value "cleanup-check" -Encoding UTF8

    Write-Host "Installing $MsiPath"
    Invoke-Msi -Arguments @("/i", "`"$MsiPath`"", "/qn", "/norestart")

    foreach ($Path in @($AppExe, $BackendExe)) {
        if (-not (Test-Path -LiteralPath $Path)) {
            throw "Installed file missing: $Path"
        }
    }

    $env:FLAC_CAFE_PORT = [string]$Port
    $BackendProcess = Start-Process -FilePath $BackendExe -PassThru -WindowStyle Hidden
    Wait-BackendHealth
}
finally {
    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:\FLAC_CAFE_PORT -ErrorAction SilentlyContinue
}

Write-Host "Uninstalling $MsiPath with app data cleanup enabled"
Invoke-Msi -Arguments @("/x", "`"$MsiPath`"", "/qn", "/norestart", "FLACCAFE_REMOVE_APPDATA=1")

if (Test-Path -LiteralPath $AppExe) {
    throw "Application executable still exists after uninstall: $AppExe"
}
if (Test-Path -LiteralPath $Marker) {
    throw "AppData cleanup marker still exists after uninstall: $Marker"
}

Write-Host "MSI install/uninstall round-trip passed."
