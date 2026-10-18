#!/usr/bin/env bash
# 麦当劳桌宠与 Agent 技能安装、自检与 PATH 自动配置脚本 (POSIX Shell 零依赖版)
# 自动将 mcd CLI 加入环境变量，配置 Token 与健康状态自检

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${MCD_PORT:-3001}"
HOME_DIR="$HOME"
CONFIG_DIR="$HOME_DIR/.mcd-desktop-pet"
BIN_DIR="$CONFIG_DIR/bin"
CONFIG_FILE="$CONFIG_DIR/config.json"

if [ "$1" = "--uninstall" ]; then
  exec "$DIR/uninstall.sh" "${@:2}"
fi

TOKEN_ARG=""
if [ -n "$1" ] && [ "$1" != "--token" ]; then
  TOKEN_ARG="$1"
elif [ "$1" = "--token" ] && [ -n "$2" ]; then
  TOKEN_ARG="$2"
fi

echo "======================================================"
echo "🍔 麦当劳桌宠 Agent 技能安装与环境配置 (Shell 版)"
echo "======================================================"

# 1. 自动配置 CLI 独立入口并加入 PATH 环境变量
mkdir -p "$BIN_DIR"

# 查找可用的 CLI bundle
CLI_BUNDLE=""
for candidate in \
  "$DIR/../../server/cli.bundle.mjs" \
  "$DIR/../server/cli.bundle.mjs" \
  "$DIR/../../dist/bundle/cli.bundle.mjs" \
  "$DIR/../../cli/dist/index.js"; do
  if [ -f "$candidate" ]; then
    CLI_BUNDLE="$(cd "$(dirname "$candidate")" && pwd)/$(basename "$candidate")"
    break
  fi
done

if [ -n "$CLI_BUNDLE" ]; then
  cp "$CLI_BUNDLE" "$BIN_DIR/cli.bundle.mjs"
fi

MCD_BIN="$BIN_DIR/mcd"
cat << 'EOF' > "$MCD_BIN"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$DIR/cli.bundle.mjs" ]; then
  exec node "$DIR/cli.bundle.mjs" "$@"
else
  echo "Error: cli.bundle.mjs not found in $DIR" >&2
  exit 1
fi
EOF
chmod +x "$MCD_BIN"

# 写入 shell 配置文件
ADDED_RC=""
for rc in "$HOME_DIR/.zshrc" "$HOME_DIR/.bashrc" "$HOME_DIR/.bash_profile"; do
  if [ -f "$rc" ]; then
    if ! grep -q "# >>> mcd-desktop-pet cli >>>" "$rc"; then
      cat << EOF >> "$rc"

# >>> mcd-desktop-pet cli >>>
export PATH="$BIN_DIR:\$PATH"
# <<< mcd-desktop-pet cli <<<
EOF
      ADDED_RC="$ADDED_RC $(basename "$rc")"
    fi
  fi
done

# 如果 ~/.local/bin 存在，创建软链接
if [ -d "$HOME_DIR/.local/bin" ]; then
  ln -sf "$MCD_BIN" "$HOME_DIR/.local/bin/mcd" 2>/dev/null || true
fi

echo "✔ CLI 执行入口已安装: $MCD_BIN"
if [ -n "$ADDED_RC" ]; then
  echo "✔ PATH 环境变量已自动写入:$ADDED_RC"
else
  echo "✔ PATH 环境变量已配置就绪"
fi

# 2. 如果传入了 Token 参数，则直接配置
if [ -f "$CONFIG_FILE" ]; then
  READ_PORT=$(grep -o '"port"[^,}]*' "$CONFIG_FILE" 2>/dev/null | grep -o '[0-9]*' || true)
  if [ -n "$READ_PORT" ] && [ "$READ_PORT" -gt 0 ] 2>/dev/null; then
    PORT="$READ_PORT"
  fi
fi
BASE_URL="http://127.0.0.1:${PORT}"

if [ -n "$TOKEN_ARG" ]; then
  echo "🔑 正在设置麦当劳 MCP Token..."
  curl -s -X POST "${BASE_URL}/api/config" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN_ARG\"}" >/dev/null 2>&1 || true
  echo "✔ Token 已提交配置"
fi

# 3. 检测中枢服务连通性
echo "🔍 检查中枢服务 (Port: $PORT)..."
HEALTH=$(curl -s --connect-timeout 2 "${BASE_URL}/api/health" 2>/dev/null || true)

if [ -n "$HEALTH" ] && echo "$HEALTH" | grep -q "status"; then
  echo "✔ 中枢服务运行正常"
  TOOLS=$(curl -s --connect-timeout 2 "${BASE_URL}/api/tools" 2>/dev/null || true)
  COUNT=$(echo "$TOOLS" | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")
  echo "✔ MCP 官方工具数量: $COUNT 项已就绪"
else
  echo "ℹ 中枢服务未在后台运行 (可执行 'mcd start' 启动)"
fi

echo "======================================================"
echo "🎉 安装完成！在终端直接输入 'mcd --help' 即可开始使用。"
echo "💡 若在当前终端未找到 mcd，可运行 'source ~/.zshrc' (或 ~/.bashrc) 立即生效。"
echo "======================================================"
