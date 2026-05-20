$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $PSScriptRoot
$IconDir = Join-Path $Root "src-tauri\icons"
New-Item -ItemType Directory -Force -Path $IconDir | Out-Null

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-LocalAutoDjBitmap {
  param([int]$Size)

  $bmp = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $scale = [float]$Size
  $pad = [Math]::Max(1, $Size * 0.055)
  $radius = $Size * 0.18
  $rect = [System.Drawing.RectangleF]::new($pad, $pad, $Size - ($pad * 2), $Size - ($pad * 2))
  $bgPath = New-RoundedRectanglePath $rect.X $rect.Y $rect.Width $rect.Height $radius
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 18, 20, 23),
    [System.Drawing.Color]::FromArgb(255, 31, 38, 45),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $graphics.FillPath($bgBrush, $bgPath)

  $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(110, 121, 217, 143), [Math]::Max(1, $Size * 0.018))
  $graphics.DrawPath($borderPen, $bgPath)

  $discCenterX = $Size * 0.39
  $discCenterY = $Size * 0.49
  $discRadius = $Size * 0.27
  $discRect = [System.Drawing.RectangleF]::new($discCenterX - $discRadius, $discCenterY - $discRadius, $discRadius * 2, $discRadius * 2)
  $discBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $discRect,
    [System.Drawing.Color]::FromArgb(255, 42, 49, 58),
    [System.Drawing.Color]::FromArgb(255, 11, 13, 16),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $graphics.FillEllipse($discBrush, $discRect)
  $graphics.DrawEllipse([System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(230, 121, 217, 143), [Math]::Max(1, $Size * 0.026)), $discRect)

  $ringRadius = $discRadius * 0.58
  $ringRect = [System.Drawing.RectangleF]::new($discCenterX - $ringRadius, $discCenterY - $ringRadius, $ringRadius * 2, $ringRadius * 2)
  $graphics.DrawEllipse([System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 244, 246, 248), [Math]::Max(1, $Size * 0.012)), $ringRect)

  $holeRadius = $discRadius * 0.18
  $holeRect = [System.Drawing.RectangleF]::new($discCenterX - $holeRadius, $discCenterY - $holeRadius, $holeRadius * 2, $holeRadius * 2)
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 244, 246, 248)), $holeRect)
  $graphics.FillEllipse(
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 121, 217, 143)),
    [System.Drawing.RectangleF]::new($discCenterX - ($holeRadius * 0.45), $discCenterY - ($holeRadius * 0.45), $holeRadius * 0.9, $holeRadius * 0.9)
  )

  $playBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 240, 180, 91))
  $playPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $playPath.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.54, $Size * 0.31),
    [System.Drawing.PointF]::new($Size * 0.78, $Size * 0.50),
    [System.Drawing.PointF]::new($Size * 0.54, $Size * 0.69)
  ))
  $graphics.FillPath($playBrush, $playPath)

  $barBrushes = @(
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 121, 217, 143)),
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 240, 180, 91)),
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 121, 217, 143))
  )
  $barWidth = [Math]::Max(2, $Size * 0.045)
  $barBase = $Size * 0.80
  $barHeights = @(($Size * 0.15), ($Size * 0.23), ($Size * 0.11))
  $barXs = @(($Size * 0.23), ($Size * 0.31), ($Size * 0.47))
  for ($i = 0; $i -lt $barXs.Length; $i++) {
    $barPath = New-RoundedRectanglePath $barXs[$i] ($barBase - $barHeights[$i]) $barWidth $barHeights[$i] ($barWidth / 2)
    $graphics.FillPath($barBrushes[$i], $barPath)
    $barPath.Dispose()
  }

  $bgBrush.Dispose()
  $bgPath.Dispose()
  $borderPen.Dispose()
  $discBrush.Dispose()
  $playBrush.Dispose()
  $playPath.Dispose()
  foreach ($brush in $barBrushes) {
    $brush.Dispose()
  }
  $graphics.Dispose()

  return $bmp
}

function Save-Png {
  param(
    [int]$Size,
    [string]$Path
  )

  $bitmap = New-LocalAutoDjBitmap $Size
  try {
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $bitmap.Dispose()
  }
}

function New-PngBytes {
  param([int]$Size)

  $bitmap = New-LocalAutoDjBitmap $Size
  $stream = [System.IO.MemoryStream]::new()
  try {
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return $stream.ToArray()
  } finally {
    $stream.Dispose()
    $bitmap.Dispose()
  }
}

function Write-UInt16 {
  param([System.IO.BinaryWriter]$Writer, [int]$Value)
  $Writer.Write([uint16]$Value)
}

function Write-UInt32 {
  param([System.IO.BinaryWriter]$Writer, [int]$Value)
  $Writer.Write([uint32]$Value)
}

Save-Png 32 (Join-Path $IconDir "32x32.png")
Save-Png 128 (Join-Path $IconDir "128x128.png")
Save-Png 256 (Join-Path $IconDir "128x128@2x.png")
Save-Png 512 (Join-Path $IconDir "icon.png")

$icoSizes = @(16, 24, 32, 48, 64, 128, 256)
$entries = foreach ($size in $icoSizes) {
  [pscustomobject]@{
    Size = $size
    Bytes = New-PngBytes $size
  }
}

$icoPath = Join-Path $IconDir "icon.ico"
$fileStream = [System.IO.File]::Create($icoPath)
$writer = [System.IO.BinaryWriter]::new($fileStream)
try {
  Write-UInt16 $writer 0
  Write-UInt16 $writer 1
  Write-UInt16 $writer $entries.Count

  $offset = 6 + (16 * $entries.Count)
  foreach ($entry in $entries) {
    $writer.Write([byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
    $writer.Write([byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    Write-UInt16 $writer 1
    Write-UInt16 $writer 32
    Write-UInt32 $writer $entry.Bytes.Length
    Write-UInt32 $writer $offset
    $offset += $entry.Bytes.Length
  }

  foreach ($entry in $entries) {
    $writer.Write([byte[]]$entry.Bytes)
  }
} finally {
  $writer.Dispose()
  $fileStream.Dispose()
}

Write-Host "Generated FLAC Cafe icons in $IconDir"
