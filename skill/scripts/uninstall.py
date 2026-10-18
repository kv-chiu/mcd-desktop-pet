#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
McDonald's Desktop Pet - Skill & CLI Uninstaller
麦当劳桌宠 AI Agent 技能与 CLI 环境变量干净卸载脚本

职责:
1. 优雅停止后台中枢服务与桌宠进程
2. 从系统 PATH 环境变量中彻底移除 mcd CLI (清理 ~/.zshrc, ~/.bashrc, Windows User PATH 等)
3. 清理 ~/.local/bin/mcd 符号链接与 ~/.mcd-desktop-pet/bin 可执行入口
4. 提供 --purge 选项以选择性完全清理本地配置与缓存 (~/.mcd-desktop-pet)
5. 输出详细的卸载检查结果与手动确认指引
"""

import sys
import os
import re
import json
import shutil
import subprocess
import argparse
import platform

HOME_DIR = os.path.expanduser("~")
DATA_DIR = os.path.join(HOME_DIR, ".mcd-desktop-pet")
BIN_DIR = os.path.join(DATA_DIR, "bin")
PID_FILE = os.path.join(DATA_DIR, "server.pid")

PATH_MARKER_START = "# >>> mcd-desktop-pet cli >>>"
PATH_MARKER_END = "# <<< mcd-desktop-pet cli <<<"


def stop_running_service():
    """停止后台运行的中枢服务"""
    stopped = False
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                pid = data.get("pid")
                if pid:
                    import signal
                    os.kill(pid, signal.SIGTERM)
                    stopped = True
        except Exception:
            pass
        try:
            os.remove(PID_FILE)
        except Exception:
            pass

    # 停止 Godot 桌宠进程
    if platform.system() != "Windows":
        try:
            subprocess.run(["pkill", "-f", "McdDesktopPet"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
    return stopped


def clean_unix_shell_configs():
    """从 Unix 常见 shell rc 文件中彻底清理环境变量配置"""
    candidates = [
        os.path.join(HOME_DIR, ".zshrc"),
        os.path.join(HOME_DIR, ".bashrc"),
        os.path.join(HOME_DIR, ".bash_profile"),
        os.path.join(HOME_DIR, ".profile"),
    ]

    cleaned_files = []
    pattern = rf"\n?{re.escape(PATH_MARKER_START)}[\s\S]*?{re.escape(PATH_MARKER_END)}\n?"

    for rc in candidates:
        if os.path.exists(rc):
            try:
                with open(rc, "r", encoding="utf-8") as f:
                    content = f.read()
                if PATH_MARKER_START in content:
                    new_content = re.sub(pattern, "\n", content)
                    with open(rc, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    cleaned_files.append(rc)
            except Exception as e:
                print(f"[!] 清理 {rc} 失败: {e}", file=sys.stderr)

    return cleaned_files


def clean_unix_symlinks():
    """清理常见用户 bin 目录下的符号链接"""
    symlink_candidates = [
        os.path.join(HOME_DIR, ".local", "bin", "mcd"),
        "/usr/local/bin/mcd",
    ]
    removed = []
    for link in symlink_candidates:
        if os.path.islink(link) or os.path.exists(link):
            try:
                os.remove(link)
                removed.append(link)
            except Exception:
                pass
    return removed


def clean_windows_user_path():
    """从 Windows 用户环境变量 PATH 中移除 ~/.mcd-desktop-pet/bin"""
    cleaned = False
    if platform.system() == "Windows":
        target = os.path.normpath(BIN_DIR)
        ps_cmd = f"""
        $p = [Environment]::GetEnvironmentVariable('Path', 'User')
        if ($p -and $p.Contains('{target}')) {{
            $parts = $p.Split(';') | Where-Object {{ $_ -and $_ -ne '{target}' }}
            $newPath = $parts -join ';'
            [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
            Write-Output "OK"
        }}
        """
        try:
            res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
            if "OK" in res.stdout:
                cleaned = True
        except Exception:
            pass
    return cleaned


def main():
    parser = argparse.ArgumentParser(description="麦当劳桌宠 AI Agent 技能与 CLI 干净卸载工具")
    parser.add_argument("--purge", action="store_true", help="完全清理所有本地配置、历史记录与好感度数据 (~/.mcd-desktop-pet)")
    parser.add_argument("--json", action="store_true", help="以结构化 JSON 格式输出卸载结果")

    args = parser.parse_args()

    # 1. 停止运行中的进程
    stopped_service = stop_running_service()

    # 2. 清理环境变量配置与链接
    cleaned_rc_files = []
    cleaned_symlinks = []
    cleaned_windows_path = False

    if platform.system() == "Windows":
        cleaned_windows_path = clean_windows_user_path()
    else:
        cleaned_rc_files = clean_unix_shell_configs()
        cleaned_symlinks = clean_unix_symlinks()

    # 3. 清理 ~/.mcd-desktop-pet/bin
    bin_removed = False
    if os.path.exists(BIN_DIR):
        try:
            shutil.rmtree(BIN_DIR)
            bin_removed = True
        except Exception:
            pass

    # 4. 可选彻底清理整个 ~/.mcd-desktop-pet
    purged_data = False
    if args.purge and os.path.exists(DATA_DIR):
        try:
            shutil.rmtree(DATA_DIR)
            purged_data = True
        except Exception:
            pass

    result = {
        "success": True,
        "service_stopped": stopped_service,
        "path_cleaned": {
            "shell_configs": cleaned_rc_files,
            "symlinks": cleaned_symlinks,
            "windows_user_path": cleaned_windows_path,
            "bin_dir_removed": bin_removed
        },
        "data_purged": purged_data,
        "remaining_manual_steps": [
            "从您的 AI Agent skills 目录中删除整个 skill 文件夹 (例如: rm -rf ~/.claude/skills/mcd-desktop-pet 或 .agents/skills/mcd-desktop-pet)",
            "在当前终端中执行 'hash -r' (bash) 或 'rehash' (zsh) 刷新命令缓存"
        ]
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print("=" * 60)
    print("🧹 麦当劳桌宠 Skill & CLI 干净卸载完成")
    print("=" * 60)
    if stopped_service:
        print("  ✔ 已终止正在运行的中枢服务与桌宠进程")
    if cleaned_rc_files:
        print(f"  ✔ 已从 Shell 配置文件中移除 PATH 环境变量: {', '.join(cleaned_rc_files)}")
    if cleaned_symlinks:
        print(f"  ✔ 已移除符号链接: {', '.join(cleaned_symlinks)}")
    if cleaned_windows_path:
        print("  ✔ 已从 Windows 用户环境变量 PATH 中移除 CLI 路径")
    if bin_removed:
        print(f"  ✔ 已清理独立 CLI 执行入口目录: {BIN_DIR}")
    if purged_data:
        print(f"  ✔ 已彻底清理用户配置与历史数据: {DATA_DIR}")
    else:
        print(f"  ℹ 保留了用户 Token 与配置数据 ({DATA_DIR})。如需完全抹除，可追加 --purge 参数")

    print("-" * 60)
    print("💡 手动收尾指引:")
    print("  1. 从您的 AI Agent skills 目录中移除本 skill 目录")
    print("  2. 在当前已打开的终端中输入 'hash -r' 或 'rehash' 即可立即生效\n")


if __name__ == "__main__":
    main()
