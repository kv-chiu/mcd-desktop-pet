#!/usr/bin/env python3
# -*- coding: utf-8 -*-


import sys
import os
import shutil
import json
import urllib.request
import urllib.error
import argparse
import platform
import subprocess

DEFAULT_PORT = 3001
HOME_DIR = os.path.expanduser("~")
CONFIG_DIR = os.path.join(HOME_DIR, ".mcd-desktop-pet")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
BIN_DIR = os.path.join(CONFIG_DIR, "bin")

PATH_MARKER_START = "# >>> mcd-desktop-pet cli >>>"
PATH_MARKER_END = "# <<< mcd-desktop-pet cli <<<"


def read_local_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def write_local_config(data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    cfg = read_local_config()
    cfg.update(data)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg


def check_server_health(port):
    url = f"http://127.0.0.1:{port}/api/health"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "mcd-skill-installer/1.0"})
        with urllib.request.urlopen(req, timeout=2.5) as response:
            if response.status == 200:
                body = json.loads(response.read().decode("utf-8"))
                return True, body
    except Exception as e:
        return False, str(e)
    return False, "未知响应"


def check_tools_catalog(port):
    url = f"http://127.0.0.1:{port}/api/tools"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "mcd-skill-installer/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as response:
            if response.status == 200:
                body = json.loads(response.read().decode("utf-8"))
                count = body.get("count", 0)
                return True, count
    except Exception as e:
        return False, str(e)
    return False, 0


def find_cli_bundle():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "../.."))

    candidates = [
        os.path.join(script_dir, "../../server/cli.bundle.mjs"),
        os.path.join(script_dir, "../server/cli.bundle.mjs"),
        os.path.join(project_root, "dist", "bundle", "cli.bundle.mjs"),
        os.path.join(project_root, "cli", "dist", "index.js"),
        os.path.join(BIN_DIR, "cli.bundle.mjs"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None


def setup_cli_in_path():
    os.makedirs(BIN_DIR, exist_ok=True)
    bundle_src = find_cli_bundle()

    installed_bundle = os.path.join(BIN_DIR, "cli.bundle.mjs")
    if bundle_src and bundle_src != installed_bundle:
        shutil.copy2(bundle_src, installed_bundle)

    mcd_script = os.path.join(BIN_DIR, "mcd")
    sh_content = f"""#!/usr/bin/env bash
DIR="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
if [ -f "$DIR/cli.bundle.mjs" ]; then
  exec node "$DIR/cli.bundle.mjs" "$@"
else
  exec node "{installed_bundle}" "$@"
fi
"""
    with open(mcd_script, "w", encoding="utf-8") as f:
        f.write(sh_content)
    try:
        os.chmod(mcd_script, 0o755)
    except Exception:
        pass

    mcd_cmd = os.path.join(BIN_DIR, "mcd.cmd")
    cmd_content = f"""@echo off
set "DIR=%~dp0"
if exist "%DIR%cli.bundle.mjs" (
  node "%DIR%cli.bundle.mjs" %*
) else (
  node "{installed_bundle}" %*
)
"""
    with open(mcd_cmd, "w", encoding="utf-8") as f:
        f.write(cmd_content)

    added_to_files = []
    symlink_created = None
    windows_path_updated = False

    if platform.system() == "Windows":
        target = os.path.normpath(BIN_DIR)
        ps_cmd = f"""
        $p = [Environment]::GetEnvironmentVariable('Path', 'User')
        if ($p -notlike '*{target}*') {{
            $newPath = if ($p) {{ "$p;{target}" }} else {{ "{target}" }}
            [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
            Write-Output "UPDATED"
        }}
        """
        try:
            res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
            if "UPDATED" in res.stdout:
                windows_path_updated = True
        except Exception:
            pass
    else:
        export_line = f'{PATH_MARKER_START}\nexport PATH="{BIN_DIR}:$PATH"\n{PATH_MARKER_END}\n'
        rc_files = [
            os.path.join(HOME_DIR, ".zshrc"),
            os.path.join(HOME_DIR, ".bashrc"),
            os.path.join(HOME_DIR, ".bash_profile"),
        ]
        for rc in rc_files:
            if os.path.exists(rc):
                try:
                    with open(rc, "r", encoding="utf-8") as f:
                        text = f.read()
                    if PATH_MARKER_START not in text:
                        with open(rc, "a", encoding="utf-8") as f:
                            f.write("\n" + export_line)
                        added_to_files.append(rc)
                except Exception:
                    pass

        local_bin = os.path.join(HOME_DIR, ".local", "bin")
        if os.path.exists(local_bin):
            symlink_path = os.path.join(local_bin, "mcd")
            try:
                if os.path.exists(symlink_path) or os.path.islink(symlink_path):
                    os.remove(symlink_path)
                os.symlink(mcd_script, symlink_path)
                symlink_created = symlink_path
            except Exception:
                pass

    return {
        "bin_dir": BIN_DIR,
        "mcd_entry": mcd_script if platform.system() != "Windows" else mcd_cmd,
        "added_to_shell_files": added_to_files,
        "symlink_created": symlink_created,
        "windows_path_updated": windows_path_updated
    }


def main():
    parser = argparse.ArgumentParser(description="麦当劳桌宠 Agent Skill 安装、自检与 PATH 自动配置")
    parser.add_argument("--token", help="设置麦当劳 MCP Authorization Token", default=None)
    parser.add_argument("--port", type=int, help="指定中枢服务监听端口 (默认读取配置或 3001)", default=None)
    parser.add_argument("--skip-path", action="store_true", help="跳过自动配置 PATH 环境变量")
    parser.add_argument("--uninstall", action="store_true", help="调用干净卸载流程")
    parser.add_argument("--purge", action="store_true", help="配合 --uninstall 完全清理数据")
    parser.add_argument("--json", action="store_true", help="输出结构化 JSON 格式结果供 Agent 解析")

    args = parser.parse_args()

    if args.uninstall:
        uninstall_script = os.path.join(os.path.dirname(__file__), "uninstall.py")
        cmd = [sys.executable, uninstall_script]
        if args.purge:
            cmd.append("--purge")
        if args.json:
            cmd.append("--json")
        subprocess.run(cmd)
        return

    cfg = read_local_config()
    port = args.port or cfg.get("port", DEFAULT_PORT)

    py_ok = sys.version_info >= (3, 8)
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    if args.token:
        cfg = write_local_config({"token": args.token.strip()})

    token = cfg.get("token", "")
    has_token = bool(token and token.strip())

    path_info = None
    if not args.skip_path:
        path_info = setup_cli_in_path()

    server_running, server_data = check_server_health(port)
    tools_ready = False
    tools_count = 0
    if server_running:
        tools_ready, tools_count = check_tools_catalog(port)

    overall_ready = server_running and has_token

    result = {
        "installed": True,
        "ready": overall_ready,
        "python": {
            "version": py_ver,
            "compatible": py_ok
        },
        "path_configured": bool(path_info),
        "cli_info": path_info,
        "config": {
            "config_path": CONFIG_FILE,
            "has_token": has_token,
            "port": port
        },
        "server": {
            "running": server_running,
            "port": port,
            "detail": server_data if server_running else None
        },
        "mcp_tools": {
            "ready": tools_ready,
            "count": tools_count
        },
        "next_steps": []
    }

    if not server_running:
        result["next_steps"].append("启动中枢服务: 运行 start.sh / start.bat 或 mcd start")
    if not has_token:
        result["next_steps"].append("配置 MCP Token: 运行 mcd config set-token <你的Token> 或 python3 skill/scripts/install.py --token <你的Token>")

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0 if overall_ready else 1)

    print("=" * 60)
    print("🍔 麦当劳桌宠 AI Agent Skill 安装与环境初始化")
    print("=" * 60)
    print(f" Python 版本: {py_ver} [{'OK' if py_ok else 'WARN: 建议 >= 3.8'}]")
    if path_info:
        print(f" CLI 执行入口: {path_info['mcd_entry']}")
        if path_info.get("added_to_shell_files"):
            print(f" PATH 环境变量: 已自动写入 {', '.join(path_info['added_to_shell_files'])}")
        elif path_info.get("windows_path_updated"):
            print(" PATH 环境变量: 已自动添加至 Windows User PATH")
        else:
            print(" PATH 环境变量: 已存在或已就绪")
    print(f" 配置文件路径: {CONFIG_FILE}")
    print(f" MCP Token: {'[已配置]' if has_token else '[未配置 - 建议配置以调用线上麦当劳工具]'}")
    print(f" 中枢服务状态: {'[运行中 (Port ' + str(port) + ')]' if server_running else '[未运行]'}")
    if server_running:
        print(f" MCP 工具数量: {tools_count} 项官方工具已就绪")

    print("-" * 60)
    if overall_ready:
        print("🎉 恭喜！麦当劳桌宠与 Agent 技能已就绪！")
        print("💡 您现在可以直接在终端输入 'mcd --help' 体验完整的桌宠与麦当劳功能！")
        sys.exit(0)
    else:
        print("💡 待处理事项:")
        for step in result["next_steps"]:
            print(f"  * {step}")
        print("-" * 60)
        sys.exit(1 if not server_running else 0)


if __name__ == "__main__":
    main()
