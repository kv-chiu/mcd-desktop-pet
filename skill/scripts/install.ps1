# 麦当劳桌宠与 Agent 技能安装与 PATH 自动配置脚本 (Windows PowerShell 版)
param (
    [string]$Token = "",
    [switch]$Uninstall,
    [switch]$Purge
)

$HomeDir = $HOME
$ConfigDir = Join-Path $HomeDir ".mcd-desktop-pet"
$BinDir = Join-Path $ConfigDir "bin"
$ScriptDir = $PSScriptRoot

if ($Uninstall) {
    & (Join-Path $ScriptDir "uninstall.ps1") -Purge:$Purge
    exit $LASTEXITCODE
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "🍔 麦当劳桌宠 Agent 技能安装与环境配置 (Windows)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. 确保目录存在
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

# 2. 查找并拷贝 cli.bundle.mjs
$candidates = @(
    (Join-Path $ScriptDir "..\..\server\cli.bundle.mjs"),
    (Join-Path $ScriptDir "..\server\cli.bundle.mjs"),
    (Join-Path $ScriptDir "..\..\dist\bundle\cli.bundle.mjs"),
    (Join-Path $ScriptDir "..\..\cli\dist\index.js")
)

$bundleSrc = $null
foreach ($c in $candidates) {
    if (Test-Path $c) {
        $bundleSrc = (Resolve-Path $c).Path
        break
    }
}

$destBundle = Join-Path $BinDir "cli.bundle.mjs"
if ($bundleSrc -and (Test-Path $bundleSrc)) {
    Copy-Item -Path $bundleSrc -Destination $destBundle -Force
}

# 3. 创建 mcd.cmd
$cmdContent = @"
@echo off
set "DIR=%~dp0"
if exist "%DIR%cli.bundle.mjs" (
  node "%DIR%cli.bundle.mjs" %*
) else (
  node "$destBundle" %*
)
"@
Set-Content -Path (Join-Path $BinDir "mcd.cmd") -Value $cmdContent -Encoding ASCII

# 4. 自动持久化加入 Windows User PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$normalizedBin = (Resolve-Path $BinDir).Path
if (-not $userPath -or $userPath -notlike "*$normalizedBin*") {
    $newPath = if ($userPath) { "$userPath;$normalizedBin" } else { $normalizedBin }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "✔ PATH 环境变量已自动持久化添加至 Windows 用户变量: $normalizedBin" -ForegroundColor Green
} else {
    Write-Host "✔ PATH 环境变量已就绪: $normalizedBin" -ForegroundColor Green
}

# 5. 配置 Token
if ($Token) {
    $cfgBody = @{ token = $Token } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/config" -Method Post -Body $cfgBody -ContentType "application/json" | Out-Null
        Write-Host "✔ 麦当劳 MCP Token 已提交配置" -ForegroundColor Green
    } catch {
        Write-Host "ℹ 服务尚未运行，Token 将在服务启动后由配置文件加载" -ForegroundColor Gray
    }
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "🎉 安装完成！新打开的 PowerShell / CMD 窗口可直接输入 'mcd --help'！" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
