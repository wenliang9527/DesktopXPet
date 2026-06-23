Add-Type -AssemblyName System.Drawing
$srcPath = 'd:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\icons\icon.png'
$img = [System.Drawing.Image]::FromFile($srcPath)
Write-Host "Source icon size: $($img.Width)x$($img.Height)"

# Create build directory if not exists
$buildDir = 'd:\WORK_VSCODE\Vibe-coding\DesktopXPet\build'
if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
    Write-Host "Created build directory"
}

# Generate icon.ico with multiple sizes (256, 128, 64, 48, 32, 16)
$sizes = @(256, 128, 64, 48, 32, 16)
$icoPath = Join-Path $buildDir 'icon.ico'

# Create a bitmap at 256x256 from the source image
$bmp256 = New-Object System.Drawing.Bitmap(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bmp256)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.DrawImage($img, 0, 0, 256, 256)
$graphics.Dispose()

# Save as PNG to a memory stream first, then write ICO header
$ms = New-Object System.IO.MemoryStream
$bmp256.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngData = $ms.ToArray()
$ms.Dispose()

# Write ICO file (simple single-image ICO with 256x256 PNG)
$fs = [System.IO.File]::Create($icoPath)
$writer = New-Object System.IO.BinaryWriter($fs)

# ICO header (6 bytes)
$writer.Write([UInt16]0)      # Reserved
$writer.Write([UInt16]1)      # Type (1 = ICO)
$writer.Write([UInt16]1)      # Number of images

# Directory entry (16 bytes)
$writer.Write([Byte]0)        # Width (0 = 256)
$writer.Write([Byte]0)        # Height (0 = 256)
$writer.Write([Byte]0)        # Color palette
$writer.Write([Byte]0)        # Reserved
$writer.Write([UInt16]1)      # Color planes
$writer.Write([UInt16]32)     # Bits per pixel
$writer.Write([UInt32]$pngData.Length)  # Image size
$writer.Write([UInt32]22)     # Offset to image data (6 + 16 = 22)

# Image data
$writer.Write($pngData)

$writer.Dispose()
$fs.Dispose()

Write-Host "Generated: $icoPath ($($pngData.Length + 22) bytes)"

# Also copy icon.png to build/ for Linux/Mac
Copy-Item $srcPath (Join-Path $buildDir 'icon.png') -Force
Write-Host "Copied icon.png to build/"

$img.Dispose()
Write-Host "Done!"
