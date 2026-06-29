Add-Type -AssemblyName System.Drawing

$root = "d:\WORK_VSCODE\Vibe-coding\DesktopXPet\resources\skins"

function DrawFrame($g, $img, $index, $fw, $fh, $scaleX, $scaleY, $offsetY) {
    $g.TranslateTransform($index * $fw + $fw / 2, $fh + $offsetY)
    $g.ScaleTransform($scaleX, $scaleY)
    $g.DrawImage($img, -$fw / 2, -$fh, $fw, $fh)
    $g.ResetTransform()
}

function GenerateJumpSheet($skin, $frameW, $frameH) {
    $srcPath = "$root\$skin\idle.png"
    $dstPath = "$root\$skin\jump.png"
    $src = [System.Drawing.Image]::FromFile($srcPath)

    $frame1 = New-Object System.Drawing.Bitmap($frameW, $frameH)
    $g0 = [System.Drawing.Graphics]::FromImage($frame1)
    $g0.DrawImage($src, 0, 0, [System.Drawing.Rectangle]::new(0, 0, $frameW, $frameH), [System.Drawing.GraphicsUnit]::Pixel)
    $g0.Dispose()

    $dst = New-Object System.Drawing.Bitmap($frameW * 4, $frameH)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.Clear([System.Drawing.Color]::Transparent)

    # 蹲下蓄力
    DrawFrame $g $frame1 0 $frameW $frameH 1.0 0.85 0
    # 起跳伸展
    DrawFrame $g $frame1 1 $frameW $frameH 1.0 1.05 -6
    # 空中
    DrawFrame $g $frame1 2 $frameW $frameH 1.0 1.0 -14
    # 落地缓冲
    DrawFrame $g $frame1 3 $frameW $frameH 1.0 0.92 0

    $dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dst.Dispose()
    $frame1.Dispose()
    $src.Dispose()
    Write-Host "Generated $dstPath"
}

function GenerateJumpStatic($skin, $squash = 0.88) {
    $srcPath = "$root\$skin\idle.png"
    $dstPath = "$root\$skin\jump.png"
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $w = $src.Width
    $h = $src.Height

    $dst = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)

    # 半蹲蓄力：底部对齐，垂直压缩
    $newH = $h * $squash
    $y = $h - $newH
    $g.DrawImage($src, 0, $y, $w, $newH)

    $dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dst.Dispose()
    $src.Dispose()
    Write-Host "Generated $dstPath"
}

# default-cat: 像素精灵图 128x128 4帧
GenerateJumpSheet "default-cat" 128 128

# butterfly-swordsman: 像素立绘 128x128
GenerateJumpStatic "butterfly-swordsman" 0.88

# reze / professional-team / butterfly-swordsman-hd: HD 立绘 384x384
GenerateJumpStatic "reze" 0.90
GenerateJumpStatic "professional-team" 0.90
GenerateJumpStatic "butterfly-swordsman-hd" 0.90
