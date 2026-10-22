#!/usr/bin/env python3
# -*- coding: utf-8 -*-


import sys
import os
import json
import time
import argparse
import subprocess
import urllib.request
import urllib.error

DEFAULT_PORT = 3001
CONFIG_FILE = os.path.expanduser("~/.mcd-desktop-pet/config.json")
PID_FILE = os.path.expanduser("~/.mcd-desktop-pet/server.pid")


def get_server_port():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                if isinstance(cfg.get("port"), int) and cfg["port"] > 0:
                    return cfg["port"]
        except Exception:
            pass
    return DEFAULT_PORT


def http_request(path, method="GET", data=None, port=None, timeout=10.0):
    port = port or get_server_port()
    url = f"http://127.0.0.1:{port}{path}"

    headers = {
        "User-Agent": "mcd-agent-control/1.0",
        "Content-Type": "application/json"
    }

    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status_code = response.status
            body_str = response.read().decode("utf-8")
            try:
                body_json = json.loads(body_str)
            except Exception:
                body_json = {"raw": body_str}
            return {
                "ok": True,
                "status": status_code,
                "data": body_json
            }
    except urllib.error.HTTPError as e:
        err_str = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_str)
        except Exception:
            err_json = {"error": err_str}
        return {
            "ok": False,
            "status": e.code,
            "error": err_json
        }
    except Exception as e:
        return {
            "ok": False,
            "status": 0,
            "error": f"连接中枢服务失败: {str(e)}。请确认服务是否已启动 (端口 {port})"
        }



def cmd_pet_action(args, port):
    action = args.action
    duration = args.duration
    speech = args.speech
    payload = {
        "action": action,
        "duration": duration,
        "speech": speech
    }
    res = http_request("/api/pet/action", method="POST", data=payload, port=port)
    return res


def cmd_pet_speak(args, port):
    payload = {
        "text": args.text,
        "duration": args.duration
    }
    res = http_request("/api/pet/speak", method="POST", data=payload, port=port)
    return res


def cmd_pet_interact(args, port):
    res = http_request("/api/pet/interact", method="POST", data={}, port=port)
    return res


def cmd_status(args, port):
    health_res = http_request("/api/health", method="GET", port=port, timeout=3.0)
    pet_res = http_request("/api/pet/state", method="GET", port=port, timeout=3.0)

    return {
        "ok": health_res.get("ok", False),
        "server": health_res.get("data") if health_res.get("ok") else {"error": health_res.get("error")},
        "pet": pet_res.get("data") if pet_res.get("ok") else {"error": pet_res.get("error")},
    }



def cmd_list_tools(args, port):
    res = http_request("/api/tools", method="GET", port=port)
    return res


def cmd_execute_tool(args, port):
    tool_name = args.name
    params = {}
    if args.params:
        try:
            params = json.loads(args.params)
        except Exception as e:
            return {"ok": False, "error": f"参数不是有效的 JSON 字符串: {str(e)}"}

    res = http_request(f"/api/tools/{tool_name}", method="POST", data=params, port=port, timeout=20.0)
    return res



def find_server_executable():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(script_dir, "../../server/server.bundle.mjs"),
        os.path.join(script_dir, "../server/server.bundle.mjs"),
        os.path.join(script_dir, "../../server/dist/index.js"),
        os.path.join(script_dir, "../dist/bundle/server.bundle.mjs"),
        os.path.abspath(os.path.join(script_dir, "../../dist/bundle/server.bundle.mjs")),
        os.path.abspath(os.path.join(script_dir, "../../server/dist/index.js")),
        os.path.abspath(os.path.join(script_dir, "../../server/src/index.ts")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def cmd_server_start(args, port):
    entry = find_server_executable()
    if not entry:
        return {"ok": False, "error": "未找到本地 server 执行文件，请确认在项目或发布包目录下"}

    health = http_request("/api/health", method="GET", port=port, timeout=1.0)
    if health.get("ok"):
        return {"ok": True, "message": f"中枢服务已在运行中 (端口 {port})", "data": health.get("data")}

    is_ts = entry.endswith(".ts")
    cmd = ["npx", "tsx", entry] if is_ts else ["node", entry]
    try:
        env = os.environ.copy()
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env,
            start_new_session=True
        )
        for _ in range(15):
            time.sleep(0.3)
            h = http_request("/api/health", method="GET", port=port, timeout=0.8)
            if h.get("ok"):
                return {"ok": True, "message": f"中枢服务启动成功 (PID: {proc.pid}, 端口: {port})", "pid": proc.pid}
        return {"ok": True, "message": f"中枢服务已启动后台进程 (PID: {proc.pid})，正在初始化", "pid": proc.pid}
    except Exception as e:
        return {"ok": False, "error": f"启动服务失败: {str(e)}"}


def cmd_server_stop(args, port):
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                pid = data.get("pid")
                if pid:
                    import signal
                    os.kill(pid, signal.SIGTERM)
                    time.sleep(0.5)
                    try:
                        os.kill(pid, 0)
                        os.kill(pid, signal.SIGKILL)
                    except OSError:
                        pass
                    if os.path.exists(PID_FILE):
                        os.remove(PID_FILE)
                    return {"ok": True, "message": f"已停止服务进程 (PID: {pid})"}
        except Exception as e:
            return {"ok": False, "error": f"停止服务异常: {str(e)}"}
    return {"ok": True, "message": "服务未在运行或无 PID 文件记录"}



def main():
    parser = argparse.ArgumentParser(
        description="🍔 麦当劳桌宠 AI Agent 统一控制桥梁 (McDonald's Pet Agent Bridge)"
    )
    parser.add_argument("--port", type=int, help="指定中枢服务监听端口 (默认自动读取配置或 3001)")
    parser.add_argument("--json", action="store_true", help="强制输出格式化 JSON 结果 (供 Agent 快速解析)")

    subparsers = parser.add_subparsers(dest="command", help="子指令")

    pet_parser = subparsers.add_parser("pet", help="控制桌宠动作与表现")
    pet_parser.add_argument("--action", choices=["idle", "wave", "jump", "speak"], default="wave", help="动作类型")
    pet_parser.add_argument("--duration", type=float, default=3.0, help="动作持续时间(秒)")
    pet_parser.add_argument("--speech", type=str, help="附加说话文本气泡")

    speak_parser = subparsers.add_parser("speak", help="推送对话气泡")
    speak_parser.add_argument("--text", required=True, help="说话文本内容")
    speak_parser.add_argument("--duration", type=float, default=4.0, help="气泡显示时间(秒)")

    subparsers.add_parser("interact", help="与桌宠互动(抚摸)")

    subparsers.add_parser("status", help="查看中枢服务健康度与桌宠当前状态")

    subparsers.add_parser("tools", help="查询麦当劳 33 项官方工具目录")

    tool_parser = subparsers.add_parser("tool", help="执行指定的麦当劳 MCP 工具")
    tool_parser.add_argument("--name", required=True, help="MCP 工具 ID (例如: list-nutrition-foods, auto-bind-coupons)")
    tool_parser.add_argument("--params", default="{}", help="工具输入参数 JSON 字符串 (例如: '{\"keyword\":\"汉堡\"}')")

    server_parser = subparsers.add_parser("server", help="中枢服务后台控制")
    server_sub = server_parser.add_subparsers(dest="server_action")
    server_sub.add_parser("start", help="启动中枢服务")
    server_sub.add_parser("stop", help="停止中枢服务")
    server_sub.add_parser("status", help="检查服务状态")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    port = args.port or get_server_port()
    result = None

    if args.command == "pet":
        result = cmd_pet_action(args, port)
    elif args.command == "speak":
        result = cmd_pet_speak(args, port)
    elif args.command == "interact":
        result = cmd_pet_interact(args, port)
    elif args.command == "status":
        result = cmd_status(args, port)
    elif args.command == "tools":
        result = cmd_list_tools(args, port)
    elif args.command == "tool":
        result = cmd_execute_tool(args, port)
    elif args.command == "server":
        if args.server_action == "start":
            result = cmd_server_start(args, port)
        elif args.server_action == "stop":
            result = cmd_server_stop(args, port)
        else:
            result = cmd_status(args, port)
    else:
        result = {"ok": False, "error": f"未知命令: {args.command}"}

    if args.json or not sys.stdout.isatty():
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if isinstance(result, dict) and "data" in result and isinstance(result["data"], dict):
            print(json.dumps(result["data"], ensure_ascii=False, indent=2))
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
