---
name: mcd-desktop-pet
description: 麦当劳桌面宠物与 33 项官方 MCP 工具调用技能。支持通过自然语言操控桌宠动作动画、气泡对话、状态好感度，以及调用麦当劳官方 MCP 工具（领券、营养查询、订单、积分、活动日历等）。
---

# 麦当劳桌面宠物与 MCP 工具集 Agent 技能规范

本技能赋予 AI Agent（Claude Code、Cursor、Antigravity、Codex 等）直接理解麦当劳官方 MCP 协议并实时操控本地桌面宠物（Godot 4.x）的能力。

---

## 快速自检与初始化

在使用任何功能前，如不确定环境是否就绪，可首先运行自检脚本：

```bash
# 1. 环境连通性自检
python3 skill/scripts/install.py --json

# 2. 引导配置 Token (若尚未配置)
python3 skill/scripts/install.py --token "你的麦当劳Token"
```

---

## 常用控制指令速查 (通过 `control.py`)

所有指令均支持传入 `--json` 参数以获取规范化的 JSON 结构化输出。

### 1. 桌面宠物表现与互动 (Pet Control)

| 用户自然语言意图 | 对应 Agent 调用命令 |
| :--- | :--- |
| “让桌宠挥挥手，打个招呼” | `python3 skill/scripts/control.py pet --action wave --speech "主人好！"` |
| “桌宠跳一下” | `python3 skill/scripts/control.py pet --action jump` |
| “让桌宠说一句话：今天有半价麦辣鸡腿堡” | `python3 skill/scripts/control.py speak --text "今天有半价麦辣鸡腿堡！"` |
| “抚摸一下桌宠” / “和桌宠互动提升好感” | `python3 skill/scripts/control.py interact` |
| “查看桌宠当前好感度与状态” | `python3 skill/scripts/control.py status --json` |

### 2. 麦当劳 33 项官方 MCP 工具调用 (Tool Execution)

通过 `tool --name <TOOL_ID> --params '<JSON>'` 调用：

| 意图示例 | 工具 ID | 调用命令示例 |
| :--- | :--- | :--- |
| **查询餐品营养与热量** | `list-nutrition-foods` | `python3 skill/scripts/control.py tool --name list-nutrition-foods --params '{"keyword":"巨无霸"}'` |
| **一键自动绑定优惠券** | `auto-bind-coupons` | `python3 skill/scripts/control.py tool --name auto-bind-coupons` |
| **查询可用优惠券列表** | `available-coupons` | `python3 skill/scripts/control.py tool --name available-coupons` |
| **查询本月活动日历** | `campaign-calendar` | `python3 skill/scripts/control.py tool --name campaign-calendar --params '{"month":"2026-10"}'` |
| **查询会员积分** | `query-member-points` | `python3 skill/scripts/control.py tool --name query-member-points` |
| **查询历史订单** | `query-orders` | `python3 skill/scripts/control.py tool --name query-orders` |
| **查看附近麦当劳门店** | `nearby-stores` | `python3 skill/scripts/control.py tool --name nearby-stores --params '{"latitude":31.23,"longitude":121.47}'` |

> 提示：运行 `python3 skill/scripts/control.py tools` 可获取全部 33 项工具的详细输入参数结构与描述。

### 3. 中枢服务生命周期管理 (Server Lifecycle)

当本地中枢服务未运行时，Agent 可代用户调起后台中枢：

```bash
# 启动后台服务
python3 skill/scripts/control.py server start

# 停止后台服务
python3 skill/scripts/control.py server stop

# 检查服务健康度
python3 skill/scripts/control.py status
```

---

## Agent 交互规范准则

1. **组合联动响应**：当用户让 Agent 查询麦当劳优惠或点餐时，除了返回文本结果，Agent 应主动驱动桌宠播放对应反馈动作（如查到优惠券时让桌宠兴奋地跳跃并冒出对话气泡）。
2. **结构化优先**：Agent 调用脚本时建议始终带上 `--json` 参数，以便根据返回值中的 `ok`、`status`、`data` 精准判断执行结果。
3. **免依赖保证**：`control.py` 与 `install.py` 均完全基于 Python 3 标准库编写，无需执行 `pip install`，解压即用。
