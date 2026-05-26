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

function Invoke-Msi {
    param([string[]]$Arguments)
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $Arguments -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -notin @(0, 3010)) {
        throw "msiexec failed with exit code $($process.ExitCode): $($Arguments -join ' ')"
    }
}

function Test-PythonWorkerHealth {
    $payload = '{"action":"health","params":{},"body":null}'
    $output = $payload | & $BackendExe --worker-once
    $response = $output | ConvertFrom-Json
    if (-not $response.ok -or $response.code -ne 200 -or $response.body.status -ne "ok") {
        throw "Packaged Python worker did not answer health correctly: $output"
    }
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

    Test-PythonWorkerHealth
}
finally {
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
