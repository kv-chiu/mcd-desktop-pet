param (
    [switch]$Purge
)

$HomeDir = $HOME
$ConfigDir = Join-Path $HomeDir ".mcd-desktop-pet"
$BinDir = Join-Path $ConfigDir "bin"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "🧹 麦当劳桌宠 Skill & CLI 干净卸载程序 (Windows)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

Get-Process -Name "McdDesktopPet" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$pidFile = Join-Path $ConfigDir "server.pid"
if (Test-Path $pidFile) {
    try {
        $raw = Get-Content -Path $pidFile -Raw | ConvertFrom-Json
        if ($raw.pid) {
            Stop-Process -Id $raw.pid -Force -ErrorAction SilentlyContinue
            Write-Host "✔ 已终止中枢服务进程 (PID: $($raw.pid))" -ForegroundColor Green
        }
    } catch {}
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath) {
    $normalizedBin = if (Test-Path $BinDir) { (Resolve-Path $BinDir).Path } else { $BinDir }
    $parts = $userPath.Split(";") | Where-Object { $_ -and $_ -ne $normalizedBin -and $_ -ne $BinDir }
    $newPath = $parts -join ";"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "✔ 已从 Windows 用户环境变量 PATH 中移除: $BinDir" -ForegroundColor Green
}

if (Test-Path $BinDir) {
    Remove-Item -Path $BinDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✔ 已清理独立 CLI 执行入口目录: $BinDir" -ForegroundColor Green
}

if ($Purge -and (Test-Path $ConfigDir)) {
    Remove-Item -Path $ConfigDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✔ 已彻底抹除用户配置与历史数据: $ConfigDir" -ForegroundColor Green
} else {
    Write-Host "ℹ 保留了用户 Token 与配置数据 ($ConfigDir)。如需完全抹除，可追加 -Purge 参数" -ForegroundColor Gray
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "🎉 干净卸载完成！请在新打开的终端中输入相应命令验证。" -ForegroundColor Green
Write-Host "💡 提示: 请从您的 AI Agent skills 目录中删除整个 skill 文件夹即可完成全部清理。" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan
