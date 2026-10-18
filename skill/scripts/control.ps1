# 麦当劳桌宠与 MCP 工具 Agent 控制桥梁 (Windows PowerShell 零依赖版)
# 专为 Windows 环境打造，基于系统内置 PowerShell / curl.exe，无需 Python 或 Node

param (
    [Parameter(Position=0)]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$Arg1 = "",

    [Parameter(Position=2)]
    [string]$Arg2 = "",

    [Parameter(Position=3)]
    [string]$Arg3 = ""
)

$Port = 3001
$ConfigFile = Join-Path $HOME ".mcd-desktop-pet\config.json"
if (Test-Path $ConfigFile) {
    try {
        $raw = Get-Content -Path $ConfigFile -Raw | ConvertFrom-Json
        if ($raw.port -and $raw.port -gt 0) {
            $Port = $raw.port
        }
    } catch {}
}

$BaseUrl = "http://127.0.0.1:$Port"

switch ($Command.ToLower()) {
    "pet" {
        $action = if ($Arg1) { $Arg1 } else { "wave" }
        $speech = $Arg2
        $duration = if ($Arg3) { [double]$Arg3 } else { 3.0 }
        
        $body = @{
            action = $action
            duration = $duration
        }
        if ($speech) { $body["speech"] = $speech }
        $json = $body | ConvertTo-Json -Compress
        
        Invoke-RestMethod -Uri "$BaseUrl/api/pet/action" -Method Post -Body $json -ContentType "application/json" | ConvertTo-Json -Depth 5
    }

    "speak" {
        if (-not $Arg1) {
            Write-Error "请提供说话内容: .\control.ps1 speak <text>"
            exit 1
        }
        $duration = if ($Arg2) { [double]$Arg2 } else { 4.0 }
        $body = @{ text = $Arg1; duration = $duration } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "$BaseUrl/api/pet/speak" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 5
    }

    "interact" {
        Invoke-RestMethod -Uri "$BaseUrl/api/pet/interact" -Method Post -Body "{}" -ContentType "application/json" | ConvertTo-Json -Depth 5
    }

    "tool" {
        if (-not $Arg1) {
            Write-Error "请提供工具名: .\control.ps1 tool <tool_id> [json_params]"
            exit 1
        }
        $params = if ($Arg2) { $Arg2 } else { "{}" }
        Invoke-RestMethod -Uri "$BaseUrl/api/tools/$Arg1" -Method Post -Body $params -ContentType "application/json" | ConvertTo-Json -Depth 5
    }

    "tools" {
        Invoke-RestMethod -Uri "$BaseUrl/api/tools" -Method Get | ConvertTo-Json -Depth 5
    }

    "status" {
        $health = try { Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get } catch { @{ running = $false } }
        $pet = try { Invoke-RestMethod -Uri "$BaseUrl/api/pet/state" -Method Get } catch { @{ pet = $null } }
        @{ server = $health; pet = $pet } | ConvertTo-Json -Depth 5
    }

    "config-token" {
        if (-not $Arg1) {
            Write-Error "请提供 Token: .\control.ps1 config-token <token>"
            exit 1
        }
        $body = @{ token = $Arg1 } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "$BaseUrl/api/config" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 5
    }

    "health" {
        Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get | ConvertTo-Json -Depth 5
    }

    default {
        Write-Host @"
🍔 麦当劳桌宠控制脚本 (Windows PowerShell 零外部依赖版)
用法: .\control.ps1 <command> [args]

命令列表:
  pet <action> [speech] [duration]    控制桌宠动作 (wave, jump, idle, speak)
  speak <text> [duration]             推送对话气泡
  interact                            与桌宠互动(抚摸)
  tool <tool_id> [json_params]        执行麦当劳 MCP 工具
  tools                               查询所有 33 项 MCP 工具
  status                              查看桌宠与服务状态
  config-token <token>                设置麦当劳 MCP Token
  health                              检测中枢服务连通性
"@
    }
}
