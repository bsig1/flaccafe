$ErrorActionPreference = "Stop"

$Ports = @(1420, 8765)
$Connections = @()

foreach ($Port in $Ports) {
  $Connections += Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
}

$ProcessIds = $Connections |
  Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 } |
  Select-Object -ExpandProperty OwningProcess -Unique

if (-not $ProcessIds -or $ProcessIds.Count -eq 0) {
  $ProcessIds = foreach ($Port in $Ports) {
    netstat -ano |
      Select-String "127\.0\.0\.1:$Port\s+.*LISTENING\s+(\d+)" |
      ForEach-Object { [int]$_.Matches[0].Groups[1].Value }
  }
  $ProcessIds = $ProcessIds | Select-Object -Unique
}

if (-not $ProcessIds -or $ProcessIds.Count -eq 0) {
  Write-Host "No FLAC Cafe dev servers are listening on ports 1420 or 8765."
  exit 0
}

foreach ($ProcessId in $ProcessIds) {
  $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($Process) {
    Write-Host "Stopping $($Process.ProcessName) ($ProcessId)"
    Stop-Process -Id $ProcessId -Force
  }
}

Write-Host "Freed FLAC Cafe dev ports."
