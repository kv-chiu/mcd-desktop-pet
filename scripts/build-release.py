#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
McDonald's Desktop Pet - Release Packaging & Build Automation Script
麦当劳桌宠一键跨平台打包与发布脚本

职责:
1. 编译全栈项目 (@mcd/shared, web 前端 Vite, server 中枢服务, cli 命令行)
2. 使用 esbuild 将 server 与 cli 打包为单文件独立零依赖 bundle (server.bundle.mjs, cli.bundle.mjs)
3. 自动导出 Godot 4.x 桌面宠物客户端 (Windows .exe, macOS .app Universal, Linux .x86_64)
4. 组装多端开箱即用发布包 (Windows, macOS, Linux, AI Agent Skill 独立包)
5. 自动植入一键启停脚本 (start.sh, start.bat, stop.sh, stop.bat) 与详细使用手册
6. 生成最终压缩归档 (.zip, .tar.gz) 与 SHA-256 校验和清单
"""

import sys
import os
import shutil
import subprocess
import argparse
import hashlib
import json
import zipfile
import tarfile
import platform


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")
RELEASE_DIR = os.path.join(DIST_DIR, "release")


def log(msg, prefix="[*]"):
    print(f"\033[1;34m{prefix}\033[0m {msg}")


def log_success(msg):
    print(f"\033[1;32m[✓]\033[0m {msg}")


def log_warn(msg):
    print(f"\033[1;33m[!]\033[0m {msg}")


def log_error(msg):
    print(f"\033[1;31m[✗]\033[0m {msg}")


def run_cmd(cmd, cwd=PROJECT_ROOT, check=True, env=None):
    """运行外部命令并实时输出"""
    log(f"执行命令: {' '.join(cmd) if isinstance(cmd, list) else cmd} (cwd: {os.path.relpath(cwd, PROJECT_ROOT)})")
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)

    ret = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), env=merged_env)
    if check and ret.returncode != 0:
        log_error(f"命令执行失败，退出码: {ret.returncode}")
        sys.exit(ret.returncode)
    return ret.returncode == 0


def get_version():
    """从 package.json 获取版本号"""
    pkg_path = os.path.join(PROJECT_ROOT, "package.json")
    try:
        with open(pkg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("version", "1.0.0")
    except Exception:
        return "1.0.0"


def find_godot_executable():
    """查找本地可用的 Godot 4 执行文件"""
    if os.environ.get("GODOT_BIN"):
        return os.environ.get("GODOT_BIN")
    candidates = [
        shutil.which("godot"),
        shutil.which("godot4"),
        "/opt/homebrew/bin/godot",
        "/usr/local/bin/godot",
        "C:\\Program Files\\Godot\\Godot_v4.exe",
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None


def calculate_sha256(filepath):
    """计算文件 SHA-256 哈希值"""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


# ===================== 构建阶段 =====================

def build_shared():
    log("【阶段 1/5】编译跨端共享库 @mcd/shared...")
    run_cmd(["pnpm", "-C", "shared", "build"])
    log_success("@mcd/shared 编译完成")


def build_web():
    log("【阶段 2/5】构建 React 19 可视化大屏前端产物 (web/dist)...")
    run_cmd(["pnpm", "-C", "web", "build"])
    web_dist = os.path.join(PROJECT_ROOT, "web", "dist")
    if not os.path.exists(os.path.join(web_dist, "index.html")):
        log_error("Web 前端构建产物不存在 index.html")
        sys.exit(1)
    log_success("Web 控制台静态产物构建成功")


def bundle_server_and_cli():
    log("【阶段 3/5】使用 esbuild 将 server 与 cli 打包为零依赖独立 bundle...")
    bundle_dir = os.path.join(DIST_DIR, "bundle")
    os.makedirs(bundle_dir, exist_ok=True)

    banner_arg = '--banner:js=import { createRequire as __createRequire } from "module"; const require = __createRequire(import.meta.url);'

    # 1. 打包 server
    server_entry = os.path.join(PROJECT_ROOT, "server", "src", "index.ts")
    server_out = os.path.join(bundle_dir, "server.bundle.mjs")
    run_cmd([
        "npx", "esbuild", server_entry,
        "--bundle",
        "--platform=node",
        "--target=node20",
        "--format=esm",
        banner_arg,
        f"--outfile={server_out}"
    ])

    # 2. 打包 cli
    cli_entry = os.path.join(PROJECT_ROOT, "cli", "src", "index.ts")
    cli_out = os.path.join(bundle_dir, "cli.bundle.mjs")
    run_cmd([
        "npx", "esbuild", cli_entry,
        "--bundle",
        "--platform=node",
        "--target=node20",
        "--format=esm",
        banner_arg,
        f"--outfile={cli_out}"
    ])

    log_success("Server 与 CLI 零依赖独立 bundle 打包完成")


def export_godot(target_platform, godot_bin):
    """使用 Godot 4 导出桌面宠物客户端"""
    desktop_dir = os.path.join(PROJECT_ROOT, "desktop")
    dist_desktop = os.path.join(DIST_DIR, "desktop")
    os.makedirs(dist_desktop, exist_ok=True)

    if not godot_bin:
        log_warn("未检测到 Godot 4 引擎，无法导出桌宠客户端；仅打包服务时可显式使用 --skip-godot")
        return False

    log(f"使用 Godot 导出 [{target_platform}] 桌面宠物客户端...")

    if target_platform == "windows":
        out_path = os.path.join(dist_desktop, "windows", "McdDesktopPet.exe")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        ok = run_cmd([godot_bin, "--headless", "--path", desktop_dir, "--export-release", "Windows Desktop", out_path], check=False)
        return ok and os.path.exists(out_path)

    elif target_platform == "macos":
        out_zip = os.path.join(dist_desktop, "macos", "McdDesktopPet.zip")
        os.makedirs(os.path.dirname(out_zip), exist_ok=True)
        ok = run_cmd([godot_bin, "--headless", "--path", desktop_dir, "--export-release", "macOS", out_zip], check=False)
        if ok and os.path.exists(out_zip):
            # 解压出 .app
            app_dir = os.path.join(dist_desktop, "macos", "McdDesktopPet.app")
            if os.path.exists(app_dir):
                shutil.rmtree(app_dir)
            with zipfile.ZipFile(out_zip, 'r') as zf:
                zf.extractall(os.path.dirname(out_zip))
            return os.path.exists(app_dir)
        return False

    elif target_platform == "linux":
        out_path = os.path.join(dist_desktop, "linux", "McdDesktopPet.x86_64")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        ok = run_cmd([godot_bin, "--headless", "--path", desktop_dir, "--export-release", "Linux", out_path], check=False)
        return ok and os.path.exists(out_path)

    return False


# ===================== 启动脚本模板 =====================

START_SH_TEMPLATE = """#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "======================================================"
echo "🍔 启动麦当劳桌宠系统 (McDonald's Desktop Pet)"
echo "======================================================"

# 1. 检查 Node.js 运行环境
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 错误: 未检测到 Node.js 运行环境！"
  echo "💡 提示: 请先安装 Node.js (推荐 LTS 版本: https://nodejs.org)，安装后双击即可直接运行。"
  exit 1
fi

# 2. 启动后台中枢服务
export MCD_WEB_DIR="$DIR/server/web"
echo "🚀 正在启动中枢服务 (Port: 3001)..."
node "$DIR/server/server.bundle.mjs" > "$DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$DIR/.server.pid"
echo "✅ 中枢服务已在后台运行 (PID: $SERVER_PID)"

# 等待服务就绪
sleep 1.2

# 3. 唤起桌面宠物客户端
if [ -d "$DIR/McdDesktopPet.app" ]; then
  echo "🐾 正在唤起桌面宠物 (macOS)..."
  open "$DIR/McdDesktopPet.app"
elif [ -f "$DIR/McdDesktopPet.x86_64" ]; then
  echo "🐾 正在唤起桌面宠物 (Linux)..."
  chmod +x "$DIR/McdDesktopPet.x86_64"
  "$DIR/McdDesktopPet.x86_64" >/dev/null 2>&1 &
fi

# 4. 在默认浏览器打开可视化控制大屏
echo "🌐 正在打开 Web 控制大屏: http://localhost:3001"
if command -v open >/dev/null 2>&1; then
  open "http://localhost:3001"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:3001"
fi

echo "======================================================"
echo "🎉 麦当劳桌宠系统已全面就绪！"
echo "💡 如需停止服务，请直接运行 ./stop.sh"
echo "======================================================"
"""

STOP_SH_TEMPLATE = """#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🛑 正在停止麦当劳桌宠及中枢服务..."

# 停止中枢服务
if [ -f "$DIR/.server.pid" ]; then
  PID=$(cat "$DIR/.server.pid")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    echo "✅ 已停止中枢服务进程 (PID: $PID)"
  fi
  rm -f "$DIR/.server.pid"
fi

# 停止桌宠客户端
pkill -f "McdDesktopPet" 2>/dev/null || true
echo "✅ 麦当劳桌宠与中枢服务已全部停止。"
"""

START_BAT_TEMPLATE = """@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ======================================================
echo 🍔 启动麦当劳桌宠系统 (McDonald's Desktop Pet)
echo ======================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js 运行环境！
    echo 💡 提示: 请前往 https://nodejs.org 下载安装 Node.js (推荐 LTS 版本) 后再次双击运行。
    pause
    exit /b 1
)

set MCD_WEB_DIR=%~dp0server\\web

echo 🚀 正在启动中枢服务 (Port: 3001)...
start /b "" node "%~dp0server\\server.bundle.mjs" > "%~dp0server.log" 2>&1

timeout /t 2 /nobreak >nul

if exist "%~dp0McdDesktopPet.exe" (
    echo 🐾 正在唤起桌面宠物客户端...
    start "" "%~dp0McdDesktopPet.exe"
)

echo 🌐 正在打开 Web 控制大屏...
start http://localhost:3001

echo ======================================================
echo 🎉 麦当劳桌宠系统已全面就绪！
echo 💡 如需退出，请双击运行 stop.bat
echo ======================================================
"""

STOP_BAT_TEMPLATE = """@echo off
chcp 65001 >nul
setlocal
echo 🛑 正在停止麦当劳桌宠及中枢服务...

taskkill /F /IM McdDesktopPet.exe >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo ✅ 麦当劳桌宠与中枢服务已全部停止。
"""

README_TEMPLATE = """# 🍔 麦当劳智能桌面宠物 (McDonald's Desktop Pet) - 开箱即用版

欢迎使用麦当劳智能桌面宠物！本发布包为开箱即用免环境配置版本。

---

## 🚀 极速开箱使用方式

### 方式一：一键双击启动（普通用户首选）

* **macOS / Linux 用户**：
  在终端或双击运行 `./start.sh`，系统将自动拉起中枢服务、唤醒桌面宠物并在浏览器打开控制台。
  如需停止，运行 `./stop.sh` 即可。
* **Windows 用户**：
  直接双击 `start.bat` 即可一键启动；关闭时双击 `stop.bat`。

---

### 方式二：AI Agent / Skill 即用（开发者与 Agent 用户）

如果您使用 **Claude Code**、**Cursor**、**Antigravity** 等大模型 Agent，可直接将包内的 `skill/` 目录导入您的 Agent 技能库中：

1. **环境自检与引导配置 Token**：
   ```bash
   python3 skill/scripts/install.py --token "你的麦当劳Token"
   ```
2. **通过 Agent 自然语言或命令行控制桌宠与麦当劳工具**：
   ```bash
   # 驱动桌宠动作与说话
   python3 skill/scripts/control.py pet --action wave --speech "主人下午好！"
   
   # 查询麦当劳餐品营养热量
   python3 skill/scripts/control.py tool --name list-nutrition-foods --params '{"keyword":"巨无霸"}'
   
   # 一键领取可用优惠券
   python3 skill/scripts/control.py tool --name auto-bind-coupons
   ```

---

## 📦 目录结构说明

```text
├── McdDesktopPet(.app/.exe)   # Godot 4.x 桌面宠物客户端本体 (原生透明窗口)
├── server/                    # 零依赖内置中枢服务
│   ├── server.bundle.mjs      # 单文件全量中枢后端
│   ├── cli.bundle.mjs         # 单文件命令行控制工具
│   └── web/                   # React 19 可视化大屏前端静态资源 (由 server 直接托管)
├── skill/                     # AI Agent 扩展技能包
│   ├── SKILL.md               # 技能规范与 Agent 提示词描述
│   └── scripts/
│       ├── install.py         # 智能安装与环境自检
│       └── control.py         # 统一控制中枢
├── start.sh / start.bat       # 一键启动脚本
├── stop.sh / stop.bat         # 一键停止脚本
└── README.md                  # 本说明文档
```
"""


# ===================== 组装与打包阶段 =====================

def assemble_platform_package(target_platform, version):
    """组装特定平台的解压即用 Release 文件夹"""
    pkg_name = f"mcd-desktop-pet-{target_platform}-v{version}"
    pkg_dir = os.path.join(RELEASE_DIR, pkg_name)

    if os.path.exists(pkg_dir):
        shutil.rmtree(pkg_dir)
    os.makedirs(pkg_dir, exist_ok=True)

    log(f"组装发布包: {pkg_name} ...")

    # 1. 复制 server 和 cli bundle
    server_dest = os.path.join(pkg_dir, "server")
    os.makedirs(server_dest, exist_ok=True)

    shutil.copy2(
        os.path.join(DIST_DIR, "bundle", "server.bundle.mjs"),
        os.path.join(server_dest, "server.bundle.mjs")
    )
    shutil.copy2(
        os.path.join(DIST_DIR, "bundle", "cli.bundle.mjs"),
        os.path.join(server_dest, "cli.bundle.mjs")
    )

    # 2. 复制 Web 前端静态产物
    web_dest = os.path.join(server_dest, "web")
    shutil.copytree(os.path.join(PROJECT_ROOT, "web", "dist"), web_dest)

    # 3. 复制 skill 技能包
    skill_dest = os.path.join(pkg_dir, "skill")
    shutil.copytree(os.path.join(PROJECT_ROOT, "skill"), skill_dest)

    # 4. 复制桌宠可执行程序
    dist_desktop = os.path.join(DIST_DIR, "desktop")
    if target_platform == "macos":
        app_src = os.path.join(dist_desktop, "macos", "McdDesktopPet.app")
        if os.path.exists(app_src):
            shutil.copytree(app_src, os.path.join(pkg_dir, "McdDesktopPet.app"), symlinks=True)
        else:
            log_warn(f"未在 {app_src} 找到 macOS 桌宠客户端产物")

    elif target_platform == "windows":
        exe_src = os.path.join(dist_desktop, "windows", "McdDesktopPet.exe")
        if os.path.exists(exe_src):
            shutil.copy2(exe_src, os.path.join(pkg_dir, "McdDesktopPet.exe"))
        else:
            log_warn(f"未在 {exe_src} 找到 Windows 桌宠客户端产物")

    elif target_platform == "linux":
        bin_src = os.path.join(dist_desktop, "linux", "McdDesktopPet.x86_64")
        if os.path.exists(bin_src):
            shutil.copy2(bin_src, os.path.join(pkg_dir, "McdDesktopPet.x86_64"))
            os.chmod(os.path.join(pkg_dir, "McdDesktopPet.x86_64"), 0o755)
        else:
            log_warn(f"未在 {bin_src} 找到 Linux 桌宠客户端产物")

    # 5. 写入一键 CLI 快捷入口 (替代复杂底层原生命令)
    if target_platform in ("macos", "linux"):
        mcd_sh = os.path.join(pkg_dir, "mcd")
        with open(mcd_sh, "w", encoding="utf-8") as f:
            f.write("#!/usr/bin/env bash\nDIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"\nexec node \"$DIR/server/cli.bundle.mjs\" \"$@\"\n")
        os.chmod(mcd_sh, 0o755)

        start_sh = os.path.join(pkg_dir, "start.sh")
        with open(start_sh, "w", encoding="utf-8") as f:
            f.write(START_SH_TEMPLATE)
        os.chmod(start_sh, 0o755)

        stop_sh = os.path.join(pkg_dir, "stop.sh")
        with open(stop_sh, "w", encoding="utf-8") as f:
            f.write(STOP_SH_TEMPLATE)
        os.chmod(stop_sh, 0o755)

    if target_platform == "windows":
        with open(os.path.join(pkg_dir, "mcd.bat"), "w", encoding="utf-8") as f:
            f.write("@echo off\r\nnode \"%~dp0server\\cli.bundle.mjs\" %*\r\n")
        with open(os.path.join(pkg_dir, "start.bat"), "w", encoding="utf-8") as f:
            f.write(START_BAT_TEMPLATE)
        with open(os.path.join(pkg_dir, "stop.bat"), "w", encoding="utf-8") as f:
            f.write(STOP_BAT_TEMPLATE)

    with open(os.path.join(pkg_dir, "README.md"), "w", encoding="utf-8") as f:
        f.write(README_TEMPLATE)

    log_success(f"发布包组装完成: {pkg_dir}")
    return pkg_dir


def assemble_standalone_skill(version):
    """组装独立的 AI Agent Skill 技能分发包"""
    pkg_name = f"mcd-desktop-pet-skill-v{version}"
    pkg_dir = os.path.join(RELEASE_DIR, pkg_name)

    if os.path.exists(pkg_dir):
        shutil.rmtree(pkg_dir)
    os.makedirs(pkg_dir, exist_ok=True)

    log(f"组装独立 Agent Skill 技能包: {pkg_name} ...")
    shutil.copy2(os.path.join(PROJECT_ROOT, "skill", "SKILL.md"), os.path.join(pkg_dir, "SKILL.md"))

    scripts_dest = os.path.join(pkg_dir, "scripts")
    shutil.copytree(os.path.join(PROJECT_ROOT, "skill", "scripts"), scripts_dest)

    skill_readme = """# 麦当劳桌面宠物 & MCP Agent 技能包

本技能包专为 AI Agent（Claude Code、Antigravity、Cursor、Codex 等）设计。

## 安装与快速使用
1. 将此目录整体复制到您的 AI Agent skills 目录下。
2. 运行环境自检与引导配置：
   ```bash
   python3 scripts/install.py --token <麦当劳Token>
   ```
3. 通过自然语言或 `scripts/control.py` 操控麦当劳工具与桌宠。
"""
    with open(os.path.join(pkg_dir, "README.md"), "w", encoding="utf-8") as f:
        f.write(skill_readme)

    log_success(f"独立 Agent Skill 技能包组装完成: {pkg_dir}")
    return pkg_dir


def create_archive(source_dir, format_type):
    """将目录打包为 .zip 或 .tar.gz"""
    base_name = os.path.basename(source_dir)
    parent_dir = os.path.dirname(source_dir)

    if format_type == "zip":
        archive_path = os.path.join(parent_dir, f"{base_name}.zip")
        log(f"正在压缩生成: {os.path.basename(archive_path)} ...")
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, parent_dir)
                    zf.write(full_path, rel_path)
        log_success(f"压缩完成: {archive_path}")
        return archive_path

    elif format_type == "tar.gz":
        archive_path = os.path.join(parent_dir, f"{base_name}.tar.gz")
        log(f"正在压缩生成: {os.path.basename(archive_path)} ...")
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(source_dir, arcname=base_name)
        log_success(f"压缩完成: {archive_path}")
        return archive_path


# ===================== 主控制流程 =====================

def main():
    parser = argparse.ArgumentParser(
        description="🍔 麦当劳桌宠发布打包脚本 (McDonald's Pet Build & Release Automation)"
    )
    parser.add_argument(
        "--platform",
        choices=["all", "windows", "macos", "linux", "current"],
        default="current",
        help="目标打包平台 (默认: 当前操作系统)"
    )
    parser.add_argument("--skip-godot", action="store_true", help="跳过 Godot 客户端导出步骤")
    parser.add_argument("--skip-web", action="store_true", help="跳过 Web 前端构建步骤")
    parser.add_argument("--skip-bundle", action="store_true", help="跳过 esbuild 单文件打包步骤")
    parser.add_argument("--create-archives", action="store_true", default=True, help="生成最终压缩包 (.zip / .tar.gz)")
    parser.add_argument("--clean", action="store_true", help="打包前清理 dist/release 目录")

    args = parser.parse_args()

    version = get_version()
    print("=" * 65)
    print(f"🍔 麦当劳智能桌面宠物 发布构建系统 v{version}")
    print("=" * 65)

    if args.clean and os.path.exists(RELEASE_DIR):
        log(f"清理历史发布产物: {RELEASE_DIR}")
        shutil.rmtree(RELEASE_DIR)
    os.makedirs(RELEASE_DIR, exist_ok=True)

    # 1. 确定目标平台
    current_sys = platform.system().lower()
    if args.platform == "current":
        if "darwin" in current_sys:
            target_platforms = ["macos"]
        elif "windows" in current_sys:
            target_platforms = ["windows"]
        else:
            target_platforms = ["linux"]
    elif args.platform == "all":
        target_platforms = ["windows", "macos", "linux"]
    else:
        target_platforms = [args.platform]

    log(f"本次构建目标平台: {', '.join(target_platforms)}")

    # 2. 基础编译
    build_shared()

    if not args.skip_web:
        build_web()

    if not args.skip_bundle:
        bundle_server_and_cli()

    # 3. Godot 导出
    godot_bin = find_godot_executable()
    if not args.skip_godot:
        for p in target_platforms:
            if not export_godot(p, godot_bin):
                log_error(f"[{p}] Godot 导出失败，停止发布，避免生成缺少桌宠客户端的安装包")
                sys.exit(1)

    # 4. 组装发布包
    log("【阶段 4/5】组装多端开箱即用发布分发目录...")
    assembled_dirs = []
    for p in target_platforms:
        d = assemble_platform_package(p, version)
        assembled_dirs.append((p, d))

    # 组装独立 Skill 包
    skill_dir = assemble_standalone_skill(version)

    # 5. 生成最终压缩包与校验和
    log("【阶段 5/5】生成压缩包与 SHA-256 校验和清单...")
    archives = []
    for p, d in assembled_dirs:
        fmt = "zip" if p in ("windows", "macos") else "tar.gz"
        arc = create_archive(d, fmt)
        archives.append(arc)

    skill_arc = create_archive(skill_dir, "zip")
    archives.append(skill_arc)

    # 计算校验和
    checksum_file = os.path.join(RELEASE_DIR, "checksums.sha256")
    with open(checksum_file, "w", encoding="utf-8") as f:
        for arc in archives:
            sha = calculate_sha256(arc)
            fname = os.path.basename(arc)
            f.write(f"{sha}  {fname}\n")
            print(f"  🔑 {fname} -> {sha}")

    print("\n" + "=" * 65)
    log_success("🎉 所有发布包构建打包完成！产物位于 dist/release:")
    for arc in archives:
        print(f"  📦 {os.path.basename(arc)} ({os.path.getsize(arc) / (1024*1024):.2f} MB)")
    print(f"  📄 校验清单: {os.path.basename(checksum_file)}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
