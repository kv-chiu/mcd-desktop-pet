#!/usr/bin/env python3
# -*- coding: utf-8 -*-



import sys
import os
import json
import time
import argparse
import urllib.request
import urllib.error
import subprocess

CONFIG_FILE = os.path.expanduser("~/.mcd-desktop-pet/config.json")
DEFAULT_PORT = 3001

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'

def colored(text: str, color: str) -> str:
    if not sys.stdout.isatty():
        return text
    return f"{color}{text}{Colors.RESET}"

SCENARIO_STEPS = [
    {
        "phase": 1,
        "title": "⏰ 步骤 1: 离午休还有 10 分钟提醒",
        "description": "桌宠向主人挥手打招呼，温馨提醒即将进入午休，准备选餐",
        "action": "wave",
        "speech": "主人，还有 10 分钟就要午休啦！忙碌了一上午辛苦啦，该想想中午吃什么咯~🍟",
        "duration": 4.5,
        "simulate_tool": None
    },
    {
        "phase": 2,
        "title": "🎫 步骤 2: 推荐今日麦麦优惠券",
        "description": "桌宠蹦跳推荐今日专属折扣，随后自动为主人领取入包 (两阶段连贯时序)",
        "action": "jump",
        "speech": "为您发现了今日专属优惠：【超值半价巨无霸套餐】与【新地买一赠一】已就绪！🎫",
        "duration": 4.5,
        "follow_up": {
            "delay": 3.8,
            "action": "wave",
            "speech": "主人！麦当劳优惠券已全部为您自动领取好啦！🎉",
            "duration": 4.5,
            "simulate_tool": {
                "toolName": "auto-bind-coupons",
                "scenario": "coupon-full-success",
                "notifyPet": False
            }
        }
    },
    {
        "phase": 3,
        "title": "🍔 步骤 3: 推荐午餐商品与营养搭配",
        "description": "桌宠气泡推荐金牌套餐，营养与热量科学均衡",
        "action": "speak",
        "speech": "今日主厨推荐：【巨无霸 + 麦麦脆汁鸡 + 零度可乐】，热量适中、高蛋白满满元气！🍔🍗🥤",
        "duration": 5.0,
        "simulate_tool": {
            "toolName": "list-nutrition-foods",
            "scenario": "nutrition-success",
            "notifyPet": False
        }
    },
    {
        "phase": 4,
        "title": "🛒 步骤 4: 模拟确认下单",
        "description": "模拟提交麦乐送外卖订单，桌宠欢呼备餐",
        "action": "jump",
        "speech": "下单成功！外卖订单号 #MCD-8204，麦麦厨房正在加速备餐中~✨",
        "duration": 4.5,
        "simulate_tool": {
            "toolName": "create-order",
            "scenario": "order-full-success",
            "notifyPet": False
        }
    },
    {
        "phase": 5,
        "title": "🛵 步骤 5: 备餐完毕与等送达中",
        "description": "骑手接单配送中，实时告知外卖动态",
        "action": "wave",
        "speech": "骑手小哥已经取餐出发啦，飞速送往您的工位中~🛵💨 预计 15 分钟内送达！",
        "duration": 4.5,
        "simulate_tool": None
    },
    {
        "phase": 6,
        "title": "🎉 步骤 6: 外卖送达前台提醒",
        "description": "桌宠兴奋跳跃，提醒主人下楼取餐享用午饭",
        "action": "jump",
        "speech": "叮咚！您的麦当劳外卖已送达前台，快去趁热享用美味午餐吧！😋🎉",
        "duration": 5.0,
        "simulate_tool": None
    }
]

def get_server_port() -> int:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                if isinstance(cfg.get("port"), int) and cfg["port"] > 0:
                    return cfg["port"]
        except Exception:
            pass
    return DEFAULT_PORT

def get_lunch_config() -> tuple:
    time_str = "12:00"
    advance_min = 10
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                if isinstance(cfg.get("lunchTime"), str) and cfg["lunchTime"]:
                    time_str = cfg["lunchTime"]
                if isinstance(cfg.get("lunchAdvanceMinutes"), int) and cfg["lunchAdvanceMinutes"] > 0:
                    advance_min = cfg["lunchAdvanceMinutes"]
        except Exception:
            pass
    return time_str, advance_min

def check_server_status(port: int) -> bool:
    url = f"http://127.0.0.1:{port}/api/health"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "mcd-mock-tester/1.0"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            return resp.status == 200
    except Exception:
        return False

def http_post(port: int, path: str, payload: dict) -> dict:
    url = f"http://127.0.0.1:{port}{path}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "mcd-mock-tester/1.0"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return json.loads(err_body)
        except Exception:
            return {"error": err_body, "status": e.code}
    except Exception as e:
        return {"error": str(e)}

def auto_start_server(port: int) -> bool:
    print(colored("正在尝试自动启动中枢服务...", Colors.YELLOW))
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cli_bin = os.path.join(root_dir, "cli", "dist", "index.js")
    
    if os.path.exists(cli_bin):
        cmd = ["node", cli_bin, "start", "-p", str(port)]
    else:
        cmd = ["pnpm", "-C", os.path.join(root_dir, "server"), "start"]
        
    try:
        subprocess.run(cmd, cwd=root_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(10):
            time.sleep(0.5)
            if check_server_status(port):
                return True
    except Exception as e:
        print(colored(f"自动启动失败: {e}", Colors.RED))
    return False

def run_step(port: int, step: dict, is_json: bool = False, fast_mode: bool = False) -> bool:
    phase = step["phase"]
    title = step["title"]
    action = step["action"]
    speech = step["speech"]
    duration = step["duration"]
    simulate_tool = step.get("simulate_tool")
    follow_up = step.get("follow_up")

    if not is_json:
        print("\n" + colored(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", Colors.CYAN))
        print(colored(f"{title}", Colors.BOLD + Colors.GREEN))
        print(colored(f"说明: {step['description']}", Colors.DIM))
        print(f"动作: {colored(action, Colors.YELLOW)}  |  持续: {colored(str(duration) + 's', Colors.YELLOW)}")
        print(f"气泡: {colored(speech, Colors.CYAN)}")

    payload = {
        "action": action,
        "duration": duration,
        "speech": speech
    }
    res = http_post(port, "/api/pet/action", payload)

    if simulate_tool:
        sim_res = http_post(port, "/api/tools/simulate", simulate_tool)
        if not is_json:
            print(colored(f"└─ [MCP 模拟] 触发工具 {simulate_tool['toolName']} (场景: {simulate_tool['scenario']})", Colors.DIM))

    if follow_up:
        fu_delay = 0.3 if fast_mode else follow_up.get("delay", 3.8)
        if not is_json:
            print(colored(f"   ⏳ 留白 {fu_delay} 秒让主人看清优惠，随后播报领券结果...", Colors.DIM))
        time.sleep(fu_delay)

        fu_action = follow_up.get("action", "wave")
        fu_speech = follow_up.get("speech", "")
        fu_dur = follow_up.get("duration", 4.5)
        fu_tool = follow_up.get("simulate_tool")

        if not is_json:
            print(colored(f"   ➔ [连贯跟进] 动作: {colored(fu_action, Colors.YELLOW)}  |  气泡: {colored(fu_speech, Colors.GREEN)}", Colors.BOLD))

        http_post(port, "/api/pet/action", {
            "action": fu_action,
            "duration": fu_dur,
            "speech": fu_speech
        })

        if fu_tool:
            http_post(port, "/api/tools/simulate", fu_tool)
            if not is_json:
                print(colored(f"   └─ [MCP 模拟] 触发工具 {fu_tool['toolName']} (场景: {fu_tool['scenario']})", Colors.DIM))

    if is_json:
        print(json.dumps({
            "phase": phase,
            "title": title,
            "action": action,
            "speech": speech,
            "follow_up": follow_up,
            "result": res
        }, ensure_ascii=False))

    return bool(res.get("success", False))

def main():
    parser = argparse.ArgumentParser(
        description="🍔 麦当劳桌宠 - 午休与点餐送达全流程模拟测试脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""示例:
  python3 scripts/mock-lunch-scenario.py           # 自动演练所有步骤 (每步间隔 4 秒)
  python3 scripts/mock-lunch-scenario.py --step    # 单步模式，按回车键演练下一步
  python3 scripts/mock-lunch-scenario.py --delay 2 # 加快播放速度 (间隔 2 秒)
  python3 scripts/mock-lunch-scenario.py --phase 2 # 仅测试第 2 步 (优惠券两阶段推荐与领券)
"""
    )
    parser.add_argument("-p", "--port", type=int, help="中枢服务端口 (默认读取本地配置或 3001)")
    parser.add_argument("-w", "--wait", type=float, default=5.0, help="启动前倒计时等待秒数 (默认 5.0 秒，设为 0 可直接启动)")
    parser.add_argument("-d", "--delay", type=float, default=4.0, help="步骤之间自动等待秒数 (默认 4.0)")
    parser.add_argument("-s", "--step", action="store_true", help="交互式单步执行模式 (按回车进入下一步)")
    parser.add_argument("--phase", type=int, choices=range(1, 7), help="仅执行指定的阶段编号 (1 到 6)")
    parser.add_argument("--fast", action="store_true", help="极速测试模式 (0.3s 间隔且跳过等待，用于自动化测试)")
    parser.add_argument("--auto-start", action="store_true", help="如果服务未启动，自动尝试后台启动")
    parser.add_argument("--json", action="store_true", help="以 JSON 格式输出每步结果")

    args = parser.parse_args()
    port = args.port or get_server_port()
    delay = 0.3 if args.fast else args.delay
    init_wait = 0.0 if (args.fast or args.step) else args.wait

    if not args.json:
        print(colored("==================================================", Colors.HEADER + Colors.BOLD))
        print(colored("🍔 麦当劳桌宠 - 午餐全流程模拟演练脚本", Colors.HEADER + Colors.BOLD))
        print(colored(f"目标端口: {port}  |  启动等待: {init_wait}s  |  模式: {'单步回车' if args.step else f'自动间隔 {delay}s'}", Colors.DIM))
        print(colored("==================================================", Colors.HEADER + Colors.BOLD))

    if not check_server_status(port):
        if args.auto_start:
            if not auto_start_server(port):
                print(colored(f"❌ 无法连接到桌宠中枢服务 (http://127.0.0.1:{port})，自动启动失败！", Colors.RED))
                sys.exit(1)
        else:
            print(colored(f"❌ 未检测到正在运行的桌宠中枢服务 (端口 {port})", Colors.RED))
            print(colored("\n💡 请先启动中枢服务后再运行本测试脚本：", Colors.YELLOW))
            print(colored("   方式 1: 在根目录下执行  pnpm dev:server", Colors.CYAN))
            print(colored("   方式 2: 使用 CLI 启动   mcd start", Colors.CYAN))
            print(colored("   方式 3: 加上自动启动参数 python3 scripts/mock-lunch-scenario.py --auto-start", Colors.CYAN))
            print(colored("\n（此时若 Godot 桌宠客户端已启动，会实时看到小宝弹出气泡并做出对应动作）\n", Colors.DIM))
            sys.exit(1)

    current_lunch_time, current_advance_min = get_lunch_config()
    SCENARIO_STEPS[0]["title"] = f"⏰ 步骤 1: 离午休还有 {current_advance_min} 分钟提醒"
    SCENARIO_STEPS[0]["speech"] = f"主人，还有 {current_advance_min} 分钟就要午休（{current_lunch_time}）啦！忙碌了一上午辛苦啦，该想想中午吃什么咯~🍟"

    if init_wait > 0 and not args.json:
        wait_int = int(init_wait) if init_wait.is_integer() else init_wait
        print(colored(f"\n⏳ 脚本将在 {wait_int} 秒后正式启动（留出时间方便您切换视角观察桌宠）...", Colors.YELLOW))
        remaining = init_wait
        while remaining > 0:
            step_sleep = min(1.0, remaining)
            sys.stdout.write(colored(f"\r倒计时: {int(remaining)} 秒...", Colors.CYAN))
            sys.stdout.flush()
            time.sleep(step_sleep)
            remaining -= step_sleep
        sys.stdout.write("\r" + " " * 35 + "\r")
        sys.stdout.flush()
        print(colored("🚀 演练正式开始！请留意屏幕上的桌宠动作与气泡：", Colors.BOLD + Colors.GREEN))

    steps_to_run = SCENARIO_STEPS
    if args.phase:
        steps_to_run = [s for s in SCENARIO_STEPS if s["phase"] == args.phase]

    total = len(steps_to_run)
    for idx, step in enumerate(steps_to_run, start=1):
        if args.step and not args.phase:
            try:
                input(colored(f"\n👉 按 [Enter] 回车键触发 {step['title']} (Ctrl+C 退出)...", Colors.BOLD + Colors.YELLOW))
            except (KeyboardInterrupt, EOFError):
                print("\n已中止演练。")
                sys.exit(0)

        run_step(port, step, is_json=args.json, fast_mode=args.fast)

        if not args.step and idx < total:
            if not args.json:
                print(colored(f"⏳ 等待 {delay} 秒进入下一阶段...", Colors.DIM))
            time.sleep(delay)

    if not args.json:
        print("\n" + colored(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", Colors.GREEN))
        print(colored("✨ 午餐全流程模拟演练圆满完成！", Colors.BOLD + Colors.GREEN))
        print(colored("桌宠已依次完成：午休提醒 ➔ 优惠券推荐与领券 ➔ 商品推荐 ➔ 模拟下单 ➔ 等送达 ➔ 送达提醒", Colors.DIM))
        print(colored(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", Colors.GREEN))

if __name__ == "__main__":
    main()
