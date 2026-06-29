Add-Type -AssemblyName System.Drawing

$root = "d:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\skins\default-cat"
$srcPath = "$root\idle.png"
$dstPath = "$root\jump.png"

$src = [System.Drawing.Image]::FromFile($srcPath)
[int]$frameW = 128
[int]$frameH = 128

# 提取第一帧
$frame1 = New-Object -TypeName System.Drawing.Bitmap -ArgumentList $frameW, $frameH
$g0 = [System.Drawing.Graphics]::FromImage($frame1)
$srcRect = New-Object -TypeName System.Drawing.Rectangle -ArgumentList 0, 0, $frameW, $frameH
$dstRect = New-Object -TypeName System.Drawing.Rectangle -ArgumentList 0, 0, $frameW, $frameH
$g0.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g0.Dispose()

$dstW = $frameW * 4
$dst = New-Object -TypeName System.Drawing.Bitmap -ArgumentList $dstW, $frameH
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.Clear([System.Drawing.Color]::Transparent)

function DrawFrame($idx, $sy, $oy) {
    $cx = $idx * $frameW + $frameW / 2
    $cy = $frameH + $oy
    $g.TranslateTransform($cx, $cy)
    $g.ScaleTransform(1.0, $sy)
    $g.DrawImage($frame1, -$frameW / 2, -$frameH, $frameW, $frameH)
    $g.ResetTransform()
}

# 蹲下蓄力
DrawFrame 0 0.85 0
# 起跳伸展
DrawFrame 1 1.05 -6
# 空中
DrawFrame 2 1.0 -14
# 落地缓冲
DrawFrame 3 0.92 0

$dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
$frame1.Dispose()
$src.Dispose()
Write-Host "Generated $dstPath"
