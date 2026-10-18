#!/usr/bin/env bash
# 麦当劳桌宠与 Agent 技能干净卸载脚本 (POSIX Shell 零依赖版)
# 彻底清理 PATH 环境变量、符号链接并可选清理本地数据目录

set -e

HOME_DIR="$HOME"
CONFIG_DIR="$HOME_DIR/.mcd-desktop-pet"
BIN_DIR="$CONFIG_DIR/bin"
PID_FILE="$CONFIG_DIR/server.pid"
PURGE_DATA=false

if [ "$1" = "--purge" ]; then
  PURGE_DATA=true
fi

echo "======================================================"
echo "🧹 麦当劳桌宠 Skill & CLI 干净卸载程序"
echo "======================================================"

# 1. 停止运行中的进程
if [ -f "$PID_FILE" ]; then
  PID=$(grep -o '[0-9]*' "$PID_FILE" 2>/dev/null | head -n 1 || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    echo "✔ 已终止正在运行的中枢服务进程 (PID: $PID)"
  fi
  rm -f "$PID_FILE"
fi

pkill -f "McdDesktopPet" 2>/dev/null || true

# 2. 从 Shell 配置文件中移除 PATH 环境变量
CLEANED_RC=""
for rc in "$HOME_DIR/.zshrc" "$HOME_DIR/.bashrc" "$HOME_DIR/.bash_profile" "$HOME_DIR/.profile"; do
  if [ -f "$rc" ] && grep -q "# >>> mcd-desktop-pet cli >>>" "$rc"; then
    # 使用 sed 清理标记块
    sed -i.bak '/# >>> mcd-desktop-pet cli >>>/,/# <<< mcd-desktop-pet cli <<</d' "$rc" 2>/dev/null || \
      sed -i '' '/# >>> mcd-desktop-pet cli >>>/,/# <<< mcd-desktop-pet cli <<</d' "$rc" 2>/dev/null || true
    rm -f "${rc}.bak"
    CLEANED_RC="$CLEANED_RC $(basename "$rc")"
  fi
done

if [ -n "$CLEANED_RC" ]; then
  echo "✔ 已从 Shell 配置文件中移除 PATH 配置:$CLEANED_RC"
fi

# 3. 移除符号链接
if [ -L "$HOME_DIR/.local/bin/mcd" ] || [ -f "$HOME_DIR/.local/bin/mcd" ]; then
  rm -f "$HOME_DIR/.local/bin/mcd"
  echo "✔ 已移除符号链接: $HOME_DIR/.local/bin/mcd"
fi

# 4. 清理 bin 目录
if [ -d "$BIN_DIR" ]; then
  rm -rf "$BIN_DIR"
  echo "✔ 已清理独立 CLI 执行入口目录: $BIN_DIR"
fi

# 5. 可选清理整个配置与数据目录
if [ "$PURGE_DATA" = true ]; then
  if [ -d "$CONFIG_DIR" ]; then
    rm -rf "$CONFIG_DIR"
    echo "✔ 已彻底抹除用户配置与历史数据: $CONFIG_DIR"
  fi
else
  echo "ℹ 保留了用户 Token 与配置数据 ($CONFIG_DIR)。如需完全抹除，可追加 --purge 参数"
fi

echo "======================================================"
echo "🎉 干净卸载完成！"
echo "💡 手动收尾指引:"
echo "  1. 从您的 AI Agent skills 目录中移除本 skill 目录"
echo "  2. 在当前已打开的终端中输入 'hash -r' (bash) 或 'rehash' (zsh) 立即刷新命令缓存"
echo "======================================================"
