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

function Test-PythonExpertHealth {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("flaccafe-clap-expert-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    $stdinPath = Join-Path $tempDir "stdin.json"
    $stdoutPath = Join-Path $tempDir "stdout.jsonl"
    $stderrPath = Join-Path $tempDir "stderr.txt"
    try {
        Set-Content -LiteralPath $stdinPath -Value '{"command":"status"}' -NoNewline -Encoding ASCII
        $process = Start-Process `
            -FilePath $BackendExe `
            -ArgumentList @("--clap-expert") `
            -RedirectStandardInput $stdinPath `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -Wait `
            -PassThru `
            -WindowStyle Hidden
        $output = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { "" }
        $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { "" }
        if ($process.ExitCode -ne 0) {
            throw "Packaged Python CLAP expert exited with $($process.ExitCode). stdout: $output stderr: $stderr"
        }
        if (-not $output.Trim()) {
            throw "Packaged Python CLAP expert returned no stdout. stderr: $stderr"
        }
        try {
            $response = $output | ConvertFrom-Json
        }
        catch {
            throw "Packaged Python CLAP expert returned malformed JSON. stdout: $output stderr: $stderr error: $($_.Exception.Message)"
        }
    }
    finally {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($response.status -ne "ok" -or $null -eq $response.body.installed) {
        throw "Packaged Python CLAP expert did not answer status correctly: $output"
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

    Test-PythonExpertHealth
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
