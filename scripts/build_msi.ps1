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

function Get-ReleaseLabel {
    $Config = Get-Content (Join-Path $Root "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
    try {
        $Package = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
        if ($Package.version) {
            return [string]$Package.version
        }
    }
    catch {
        return [string]$Config.version
    }
    return [string]$Config.version
}

function Copy-MsiWithReleaseLabel {
    param([System.IO.FileInfo]$Msi)

    $Config = Get-Content (Join-Path $Root "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
    $ReleaseLabel = Get-ReleaseLabel
    if ($ReleaseLabel -eq $Config.version) {
        return $Msi
    }

    $BundleDir = Join-Path $Root "src-tauri\target\release\bundle\msi"
    $LabeledPath = Join-Path $BundleDir ("{0}_{1}_x64_en-US.msi" -f $Config.productName, $ReleaseLabel)
    Copy-Item -LiteralPath $Msi.FullName -Destination $LabeledPath -Force
    return Get-Item $LabeledPath
}

function Write-ReleaseNotes {
    param([System.IO.FileInfo]$Msi)

    $Config = Get-Content (Join-Path $Root "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
    $ReleaseLabel = Get-ReleaseLabel
    $NotesDir = Join-Path $Root "docs\release-notes"
    New-Item -ItemType Directory -Force -Path $NotesDir | Out-Null
    $NotesPath = Join-Path $NotesDir ("v{0}.md" -f $ReleaseLabel)

    $Changes = @()
    try {
        $Changes = & git -C $Root log -n 20 --pretty=format:"- %s"
    }
    catch {
        $Changes = @("- Built from the current working tree.")
    }
    if (-not $Changes -or $Changes.Count -eq 0) {
        $Changes = @("- Built from the current working tree.")
    }

    $Groups = [ordered]@{
        "Features" = New-Object System.Collections.Generic.List[string]
        "Fixes" = New-Object System.Collections.Generic.List[string]
        "Packaging" = New-Object System.Collections.Generic.List[string]
        "Other" = New-Object System.Collections.Generic.List[string]
    }
    foreach ($Change in $Changes) {
        $Text = [string]$Change
        if ($Text -match "(?i)^-\s*(fix|fixes|bugfix)(\(.+\))?:") {
            $Groups["Fixes"].Add($Text)
        }
        elseif ($Text -match "(?i)^-\s*(build|ci|chore|release)(\(.+\))?:") {
            $Groups["Packaging"].Add($Text)
        }
        elseif ($Text -match "(?i)^-\s*(feat|feature)(\(.+\))?:") {
            $Groups["Features"].Add($Text)
        }
        elseif ($Text -match "(?i)\b(fix|bug|crash|error|repair)\b") {
            $Groups["Fixes"].Add($Text)
        }
        elseif ($Text -match "(?i)\b(msi|installer|package|release|wix|build)\b") {
            $Groups["Packaging"].Add($Text)
        }
        elseif ($Text -match "(?i)\b(add|implement|feature|support|enable)\b") {
            $Groups["Features"].Add($Text)
        }
        else {
            $Groups["Other"].Add($Text)
        }
    }

    $ReleaseNotes = @(
        "# FLAC Cafe $ReleaseLabel"
        ""
        "- Built: $((Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz"))"
        "- Installer: $($Msi.FullName)"
        "- Size: $([math]::Round($Msi.Length / 1MB, 2)) MB"
    )
    if ($ReleaseLabel -ne $Config.version) {
        $ReleaseNotes += "- Windows MSI product version: $($Config.version)"
    }
    foreach ($GroupName in $Groups.Keys) {
        if ($Groups[$GroupName].Count -eq 0) {
            continue
        }
        $ReleaseNotes += ""
        $ReleaseNotes += "## $GroupName"
        $ReleaseNotes += ""
        $ReleaseNotes += $Groups[$GroupName]
    }
    $ReleaseNotes | Set-Content -LiteralPath $NotesPath -Encoding UTF8

    Write-Host "Release notes ready: $NotesPath"
}

Push-Location $Root
try {
    $BuildStarted = Get-Date

    & (Join-Path $Root "scripts\build_backend_sidecar.ps1") -Clean

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

    $ReleaseMsi = Copy-MsiWithReleaseLabel -Msi $Msi
    Write-Host "MSI ready: $($ReleaseMsi.FullName)"
    Write-ReleaseNotes -Msi $ReleaseMsi
}
finally {
    Pop-Location
}
