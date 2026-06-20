$proc = Start-Process -FilePath "node" -ArgumentList "node_modules\.bin\electron-vite.cmd","dev" -WorkingDirectory "D:\WORK_VSCODE\Vibe-coding\DesktopXPet" -PassThru -NoNewWindow
Write-Host "Started PID: $($proc.Id)"
Start-Sleep -Seconds 12
$health = Invoke-RestMethod -Uri "http://127.0.0.1:9527/api/health" -Method Get -ErrorAction SilentlyContinue
Write-Host "Health: $health"
