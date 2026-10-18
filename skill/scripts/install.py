#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
McDonald's Desktop Pet - Skill Environment Setup & Self-Check Script
麦当劳桌宠 AI Agent 技能安装与环境初始化自检脚本

职责:
1. 检查 Python 运行环境
2. 检测本地中枢服务 (Server) 连通性与健康状态
3. 检查与引导配置麦当劳 MCP Token (~/.mcd-desktop-pet/config.json)
4. 自检 MCP 协议网关与 33 项官方工具就绪状态
5. 支持 --json 格式输出供 AI Agent 自动判定安装状态
"""

import sys
import os
import json
import urllib.request
import urllib.error
import argparse

DEFAULT_PORT = 3001
CONFIG_DIR = os.path.expanduser("~/.mcd-desktop-pet")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")


def read_local_config():
    """读取本地持久化配置文件"""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def write_local_config(data):
    """写入或更新本地持久化配置"""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    cfg = read_local_config()
    cfg.update(data)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg


def check_server_health(port):
    """检测中枢服务连通性"""
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
    """检测 MCP 工具可用性"""
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


def main():
    parser = argparse.ArgumentParser(description="麦当劳桌宠 Agent Skill 安装与环境自检")
    parser.add_argument("--token", help="设置麦当劳 MCP Authorization Token", default=None)
    parser.add_argument("--port", type=int, help="指定中枢服务监听端口 (默认读取配置或 3001)", default=None)
    parser.add_argument("--json", action="store_true", help="输出结构化 JSON 格式结果供 Agent 解析")
    args = parser.parse_args()

    cfg = read_local_config()
    port = args.port or cfg.get("port", DEFAULT_PORT)

    # 1. 检查 Python 版本
    py_ok = sys.version_info >= (3, 8)
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    # 2. 若传入新 Token，直接更新配置
    if args.token:
        cfg = write_local_config({"token": args.token.strip()})

    token = cfg.get("token", "")
    has_token = bool(token and token.strip())

    # 3. 检查中枢服务连通性
    server_running, server_data = check_server_health(port)

    # 4. 检查工具可用性
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
        result["next_steps"].append("启动中枢服务: 运行 start.sh / start.bat 或 mcd start / python skill/scripts/control.py server start")
    if not has_token:
        result["next_steps"].append("配置 MCP Token: 运行 python skill/scripts/install.py --token <你的麦当劳Token>")

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0 if overall_ready else 1)

    print("=" * 60)
    print("🍔 麦当劳桌宠 AI Agent Skill 安装与环境自检")
    print("=" * 60)
    print(f" Python 版本: {py_ver} [{'OK' if py_ok else 'WARN: 建议 >= 3.8'}]")
    print(f" 配置文件路径: {CONFIG_FILE}")
    print(f" MCP Token: {'[已配置]' if has_token else '[未配置 - 建议配置以调用线上麦当劳工具]'}")
    print(f" 中枢服务状态: {'[运行中 (Port ' + str(port) + ')]' if server_running else '[未运行]'}")
    if server_running:
        print(f" MCP 工具数量: {tools_count} 项官方工具已就绪")

    print("-" * 60)
    if overall_ready:
        print("🎉 恭喜！麦当劳桌宠与 Agent 技能环境已就绪，可随时通过 control.py 或自然语言操控桌宠与调用麦当劳工具！")
        sys.exit(0)
    else:
        print("💡 待处理事项:")
        for step in result["next_steps"]:
            print(f"  * {step}")
        print("-" * 60)
        sys.exit(1 if not server_running else 0)


if __name__ == "__main__":
    main()
