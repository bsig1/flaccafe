$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $Root "src-tauri\tauri.conf.json"
$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

Push-Location $Root
try {
    $Range = ""
    if ($env:GITHUB_BASE_REF) {
        git fetch origin $env:GITHUB_BASE_REF --depth=80 | Out-Null
        $Range = "origin/$env:GITHUB_BASE_REF..HEAD"
    }

    $Changes = if ($Range) {
        git log $Range --pretty=format:"- %s"
    } else {
        git log -n 30 --pretty=format:"- %s"
    }
    if (-not $Changes -or $Changes.Count -eq 0) {
        $Changes = @("- No commit summaries found for this preview.")
    }

    $Preview = @(
        "# FLAC Cafe changelog preview"
        ""
        "- Version: $($Config.version)"
        "- Generated: $((Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz"))"
        ""
        "## Changes"
        ""
    ) + $Changes

    $PreviewPath = Join-Path $Root "docs\release-notes\preview.md"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PreviewPath) | Out-Null
    $Preview | Set-Content -LiteralPath $PreviewPath -Encoding UTF8

    if ($env:GITHUB_STEP_SUMMARY) {
        $Preview | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding UTF8
    }

    Write-Host "Changelog preview ready: $PreviewPath"
}
finally {
    Pop-Location
}
