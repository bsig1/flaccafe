$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
  $Python = $VenvPython
} else {
  $Python = "python"
}

$NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($NpmCommand) {
  $Npm = $NpmCommand.Source
} elseif (Test-Path "C:\Program Files\nodejs\npm.cmd") {
  $Npm = "C:\Program Files\nodejs\npm.cmd"
} else {
  throw "npm.cmd was not found. Install Node.js or add npm to PATH."
}

function Test-Backend {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8765/health" -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-BackendCurrent {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8765/openapi.json" -UseBasicParsing -TimeoutSec 2
    return $response.Content.Contains("/analysis/clap/install")
  } catch {
    return $false
  }
}

function Test-Frontend {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:1420" -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Stop-Port {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  $processIds = $connections |
    Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 } |
    Select-Object -ExpandProperty OwningProcess -Unique

  if (-not $processIds -or $processIds.Count -eq 0) {
    $processIds = netstat -ano |
      Select-String "127\.0\.0\.1:$Port\s+.*LISTENING\s+(\d+)" |
      ForEach-Object { [int]$_.Matches[0].Groups[1].Value } |
      Select-Object -Unique
  }

  foreach ($processId in $processIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

function Get-PortProcesses {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  $processIds = $connections |
    Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
  }
}

function Test-BackendDevProcess {
  $processes = @(Get-PortProcesses -Port 8765)
  if ($processes.Count -eq 0) {
    return $false
  }

  foreach ($process in $processes) {
    $name = [string]$process.Name
    $commandLine = [string]$process.CommandLine
    if ($name -notmatch "python" -or $commandLine -notmatch "uvicorn" -or $commandLine -notmatch "backend\.app\.main:app") {
      return $false
    }
  }

  return $true
}

Set-Location $Root

$DefaultMlRuntime = Join-Path $env:LOCALAPPDATA "FLAC Cafe\ml-runtime"
if (-not $env:LOCAL_AUTODJ_ML_RUNTIME_DIR) {
  $env:LOCAL_AUTODJ_ML_RUNTIME_DIR = $DefaultMlRuntime
}
$env:LOCAL_AUTODJ_USE_ML_RUNTIME = "1"

$BackendProcess = $null
$BackendStartedThisRun = $false
if ((Test-Backend) -and ((-not (Test-BackendCurrent)) -or (-not (Test-BackendDevProcess)))) {
  Write-Host "Restarting stale backend on http://127.0.0.1:8765."
  Stop-Port -Port 8765
  Start-Sleep -Milliseconds 500
}

if (-not (Test-Backend)) {
  $BackendProcess = Start-Process `
    -FilePath $Python `
    -ArgumentList @("-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8765") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru
  $BackendStartedThisRun = $true

  for ($i = 0; $i -lt 40; $i++) {
    if (Test-Backend) {
      break
    }
    Start-Sleep -Milliseconds 250
  }

  if (-not (Test-Backend)) {
    if ($BackendProcess -and -not $BackendProcess.HasExited) {
      Stop-Process -Id $BackendProcess.Id -Force
    }
    throw "Backend did not become ready on http://127.0.0.1:8765."
  }
}

if (Test-Frontend) {
  Write-Host "FLAC Cafe is already running."
  Write-Host "UI:      http://127.0.0.1:1420"
  Write-Host "Backend: http://127.0.0.1:8765"
  Write-Host ""
  Write-Host "Run scripts\stop_dev.ps1 if you want to free those ports."
  if ($BackendStartedThisRun -and $BackendProcess -and -not $BackendProcess.HasExited) {
    Write-Host "Keeping the backend alive in this dev session."
    Wait-Process -Id $BackendProcess.Id
  }
  exit 0
}

try {
  & $Npm run frontend:dev
} finally {
  if ($BackendProcess -and -not $BackendProcess.HasExited) {
    Stop-Process -Id $BackendProcess.Id -Force
  }
}
