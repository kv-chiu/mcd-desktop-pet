#!/usr/bin/env bash
# 麦当劳桌宠与 Agent 技能自检与配置脚本 (POSIX Shell 零依赖版)
# 无需 Python，通过系统原生 curl 进行环境自检与 Token 配置

set -e

PORT="${MCD_PORT:-3001}"
CONFIG_FILE="$HOME/.mcd-desktop-pet/config.json"
TOKEN_ARG="$1"

if [ -f "$CONFIG_FILE" ]; then
  READ_PORT=$(grep -o '"port"[^,}]*' "$CONFIG_FILE" 2>/dev/null | grep -o '[0-9]*' || true)
  if [ -n "$READ_PORT" ] && [ "$READ_PORT" -gt 0 ] 2>/dev/null; then
    PORT="$READ_PORT"
  fi
fi

BASE_URL="http://127.0.0.1:${PORT}"

echo "======================================================"
echo "🍔 麦当劳桌宠 Agent 技能自检 (Shell 零依赖版)"
echo "======================================================"

# 1. 如果传入了 Token 参数，则直接配置
if [ -n "$TOKEN_ARG" ]; then
  echo "🔑 正在设置麦当劳 MCP Token..."
  CFG_RES=$(curl -s -X POST "${BASE_URL}/api/config" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN_ARG\"}" 2>/dev/null || true)
  echo "✅ Token 已提交配置"
fi

# 2. 检测中枢服务连通性
echo "🔍 检查中枢服务 (Port: $PORT)..."
HEALTH=$(curl -s --connect-timeout 2 "${BASE_URL}/api/health" 2>/dev/null || true)

if [ -n "$HEALTH" ] && echo "$HEALTH" | grep -q "status"; then
  echo "✅ 中枢服务运行正常！"
  
  # 3. 检查工具可用数量
  TOOLS=$(curl -s --connect-timeout 2 "${BASE_URL}/api/tools" 2>/dev/null || true)
  COUNT=$(echo "$TOOLS" | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")
  echo "📦 MCP 工具就绪状态: $COUNT 项官方工具可用"
  
  # 4. 检查当前 Token 状态
  CFG=$(curl -s --connect-timeout 2 "${BASE_URL}/api/config" 2>/dev/null || true)
  if echo "$CFG" | grep -q '"hasToken":true'; then
    echo "🎉 MCP Token: [已配置] 官方云端接口可正常调用"
  else
    echo "⚠️  MCP Token: [未配置] 建议运行: $0 <你的麦当劳Token> 完成鉴权配置"
  fi
  echo "======================================================"
  echo "🎉 技能环境就绪！可随时使用 ./skill/scripts/control.sh 或原生 curl 操控桌宠与调用麦当劳工具。"
else
  echo "❌ 中枢服务未响应 (端口 $PORT)"
  echo "💡 请先运行 ./start.sh 或双击启动桌面宠物服务。"
  exit 1
fi
