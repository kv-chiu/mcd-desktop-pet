#!/usr/bin/env bash
# 麦当劳桌宠与 MCP 工具 Agent 控制桥梁 (POSIX Shell 零外部依赖版)
# 使用系统自带 curl 发送请求，无需 Python、Node 或任何第三方库

set -e

PORT="${MCD_PORT:-3001}"
CONFIG_FILE="$HOME/.mcd-desktop-pet/config.json"

if [ -f "$CONFIG_FILE" ]; then
  READ_PORT=$(grep -o '"port"[^,}]*' "$CONFIG_FILE" 2>/dev/null | grep -o '[0-9]*' || true)
  if [ -n "$READ_PORT" ] && [ "$READ_PORT" -gt 0 ] 2>/dev/null; then
    PORT="$READ_PORT"
  fi
fi

BASE_URL="http://127.0.0.1:${PORT}"

show_help() {
  cat << EOF
🍔 麦当劳桌宠控制脚本 (Shell 零依赖版)
用法: $0 <command> [options]

命令列表:
  pet <action> [speech] [duration]    控制桌宠动作 (wave, jump, idle, speak)
  speak <text> [duration]             推送对话气泡
  interact                            与桌宠互动(抚摸)
  tool <tool_id> [json_params]        执行麦当劳 MCP 工具
  tools                               查询所有 33 项 MCP 工具
  status                              查看桌宠与服务状态
  config-token <token>                设置麦当劳 MCP Token
  health                              检测中枢服务连通性
EOF
}

CMD="$1"
shift || true

case "$CMD" in
  pet)
    ACTION="${1:-wave}"
    SPEECH="$2"
    DURATION="${3:-3.0}"
    if [ -n "$SPEECH" ]; then
      PAYLOAD="{\"action\":\"$ACTION\",\"speech\":\"$SPEECH\",\"duration\":$DURATION}"
    else
      PAYLOAD="{\"action\":\"$ACTION\",\"duration\":$DURATION}"
    fi
    curl -s -X POST "${BASE_URL}/api/pet/action" -H "Content-Type: application/json" -d "$PAYLOAD"
    echo ""
    ;;

  speak)
    TEXT="$1"
    DURATION="${2:-4.0}"
    if [ -z "$TEXT" ]; then
      echo '{"ok":false,"error":"请提供说话内容: ./control.sh speak <text>"}'
      exit 1
    fi
    curl -s -X POST "${BASE_URL}/api/pet/speak" -H "Content-Type: application/json" -d "{\"text\":\"$TEXT\",\"duration\":$DURATION}"
    echo ""
    ;;

  interact)
    curl -s -X POST "${BASE_URL}/api/pet/interact" -H "Content-Type: application/json" -d "{}"
    echo ""
    ;;

  tool)
    TOOL_NAME="$1"
    PARAMS="${2:-{}}"
    if [ -z "$TOOL_NAME" ]; then
      echo '{"ok":false,"error":"请提供工具名称: ./control.sh tool <tool_name> [json_params]"}'
      exit 1
    fi
    curl -s -X POST "${BASE_URL}/api/tools/${TOOL_NAME}" -H "Content-Type: application/json" -d "$PARAMS"
    echo ""
    ;;

  tools)
    curl -s "${BASE_URL}/api/tools"
    echo ""
    ;;

  status)
    HEALTH=$(curl -s "${BASE_URL}/api/health" 2>/dev/null || echo '{"running":false}')
    STATE=$(curl -s "${BASE_URL}/api/pet/state" 2>/dev/null || echo '{"pet":null}')
    echo "{\"server\":$HEALTH,\"pet\":$STATE}"
    ;;

  config-token)
    TOKEN="$1"
    if [ -z "$TOKEN" ]; then
      echo '{"ok":false,"error":"请提供 Token: ./control.sh config-token <token>"}'
      exit 1
    fi
    curl -s -X POST "${BASE_URL}/api/config" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\"}"
    echo ""
    ;;

  health)
    curl -s "${BASE_URL}/api/health"
    echo ""
    ;;

  *)
    show_help
    exit 0
    ;;
esac
