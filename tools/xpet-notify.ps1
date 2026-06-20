# DesktopXPet CLI 接入脚本 (PowerShell 版)
# 用于 Claude Code / OpenCode / 任意 CLI 工具推送状态到桌面宠物
#
# 用法:
#   .\xpet-notify.ps1 -Tool claude-code -Status working -Summary "Generating code..."
#   .\xpet-notify.ps1 -Tool opencode -Status completed -Summary "Done"
#   .\xpet-notify.ps1 -Tool aider -Status error -Summary "API limited"

param(
    [Parameter(Mandatory=$true)]
    [string]$Tool,

    [Parameter(Mandatory=$true)]
    [ValidateSet('idle','working','error','completed')]
    [string]$Status,

    [string]$Summary = "No description"
)

$ConfigFile = Join-Path $env:USERPROFILE ".xpet\config.json"

if (-not (Test-Path $ConfigFile)) {
    Write-Error "DesktopXPet config not found at $ConfigFile"
    exit 1
}

$Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$Token = $Config.token
$Port = if ($Config.port) { $Config.port } else { 9527 }

if (-not $Token) {
    Write-Error "DesktopXPet token not found in config"
    exit 1
}

$Body = @{
    tool = $Tool
    status = $Status
    summary = $Summary
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/status" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{ "x-pet-token" = $Token } `
        -Body $Body `
        -TimeoutSec 3 | Out-Null
} catch {
    Write-Error "Failed to push status: $_"
    exit 1
}
