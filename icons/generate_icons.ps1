# 生成 Element Locator 图标
Add-Type -AssemblyName System.Drawing

$sizes = @(16, 48, 128)

foreach($size in $sizes) {
    # 创建位图
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    
    # 紫色背景
    $graphics.Clear([System.Drawing.Color]::FromArgb(102, 126, 234))
    
    # 绘制白色圆圈
    $penWidth = [Math]::Max(2, $size / 16)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penWidth)
    
    $center = $size / 2
    $radius = $size / 3
    
    # 外圈
    $graphics.DrawEllipse($pen, $center - $radius, $center - $radius, $radius * 2, $radius * 2)
    
    # 中圈
    $radius2 = $radius * 0.6
    $graphics.DrawEllipse($pen, $center - $radius2, $center - $radius2, $radius2 * 2, $radius2 * 2)
    
    # 内圆（实心）
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $radius3 = $radius * 0.3
    $graphics.FillEllipse($brush, $center - $radius3, $center - $radius3, $radius3 * 2, $radius3 * 2)
    
    # 保存
    $filename = "icon$size.png"
    $bmp.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "✓ 已生成: $filename ($size x $size)"
    
    # 释放资源
    $brush.Dispose()
    $pen.Dispose()
    $graphics.Dispose()
    $bmp.Dispose()
}

Write-Host "`n所有图标生成完成！" -ForegroundColor Green