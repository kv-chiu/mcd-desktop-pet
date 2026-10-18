---
name: mcd-desktop-pet
description: 麦当劳桌面宠物与 33 项官方 MCP 工具调用技能。使用标准 CLI (mcd) 命令替代繁琐底层的 HTTP/JSON 原生命令，支持通过自然语言一键操控桌宠动画、气泡对话、好感度互动，以及调用麦当劳官方工具（领券、营养查询、积分、活动日历等）。
---

# 麦当劳桌面宠物与 MCP 工具集 Agent 技能规范

本技能赋予 AI Agent（Claude Code、Cursor、Antigravity、Codex 等）通过**极简的标准化 CLI 指令 (`mcd`)** 理解麦当劳官方 MCP 协议并实时操控本地桌面宠物（Godot 4.x）的能力，**彻底替代复杂易错的原生 HTTP/JSON 命令**。

---

## 一、 核心原则：用标准化 CLI 替代复杂原生命令

* **无需拼装底层 HTTP 请求**：不需要构造繁琐的 JSON Header、转义字符或记忆长 URL 路径。
* **Agent 友好输出**：所有指令均支持 `--json` 参数，输出结构化数据供 Agent 精准解析。
* **调用方式**：
  * 全局安装环境：直接执行 `mcd <command> [options]`
  * 解压发布包环境：直接执行 `./mcd <command> [options]`（Windows 下执行 `.\mcd.bat`）

---

## 二、 常用控制指令速查 (CLI 一键直达)

### 1. 桌面宠物表现与互动 (Pet Control)

| 用户自然语言意图 | 标准化 CLI 指令 (首选推荐) | 指令说明 |
| :--- | :--- | :--- |
| **“让桌宠挥挥手打个招呼”** | `mcd pet wave --speech "主人好！" --json` | 播放挥手动画并显示文字气泡 |
| **“桌宠跳一下”** | `mcd pet jump --json` | 触发跳跃动作 |
| **“让桌宠冒气泡说话”** | `mcd speak "今天有半价麦辣鸡腿堡！" --json` | 弹出对话气泡 |
| **“抚摸桌宠 / 和桌宠互动”** | `mcd interact --json` | 亲密互动，好感度上升并触发欢呼动画 |
| **“查看桌宠当前好感度与状态”** | `mcd pet state --json` | 查询好感度数值、等级与当前动作 |

---

### 2. 麦当劳官方业务与 MCP 工具 (McDonald's MCP)

| 用户自然语言意图 | 标准化 CLI 指令 (首选推荐) | 指令说明 |
| :--- | :--- | :--- |
| **“查一下巨无霸/汉堡的热量和营养”** | `mcd nutrition 巨无霸 --json` | 极速查询餐品热量、蛋白质、脂肪、碳水 |
| **“一键帮我领取今天的麦当劳优惠券”** | `mcd coupon auto-bind --json` | 自动领取并绑定所有可用券，桌宠同步反馈 |
| **“看看我的账户里有哪些可用优惠券”** | `mcd coupon list --json` | 列出当前已领取的可用优惠券与折扣 |
| **“查看麦当劳本月活动日历”** | `mcd calendar --json` | 查询本月促销活动日历（可加月份: `mcd calendar 2026-10`） |
| **“查询麦当劳所有 33 项可用工具”** | `mcd tools --json` | 列出全部 33 项官方工具定义与参数结构 |
| **“调用指定 MCP 工具”** | `mcd tool <toolId> '<jsonParams>' --json` | 通用工具调用（如: `mcd tool nearby-stores '{"latitude":31.23,"longitude":121.47}'`） |

---

### 3. 中枢服务与配置管理 (Server & Config)

| 操作意图 | 标准化 CLI 指令 | 说明 |
| :--- | :--- | :--- |
| **启动中枢服务** | `mcd start` | 后台守护进程启动中枢服务 (默认 3001 端口) |
| **停止中枢服务** | `mcd stop` | 优雅停止中枢服务进程并释放资源 |
| **查看服务状态与连接** | `mcd status --json` | 查看进程 PID、运行时间、桌宠 WebSocket 连通情况 |
| **设置麦当劳 MCP Token** | `mcd config set-token "<你的Token>" --json` | 一键持久化保存鉴权 Token |

---

## 三、 免环境兜底方案 (Fallback)

在极端轻量容器或尚未配置 CLI 的终端中，Agent 也可使用系统原生工具作为备选兜底：

1. **直接 curl 调用**：
   * 触发动作：`curl -s -X POST http://127.0.0.1:3001/api/pet/action -H "Content-Type: application/json" -d '{"action":"wave","speech":"你好"}'`
   * 查询营养：`curl -s "http://127.0.0.1:3001/api/tools/quick/nutrition?keyword=巨无霸"`
2. **免依赖轻量脚本**：
   * macOS / Linux：`./skill/scripts/control.sh pet wave "你好"`
   * Windows：`powershell -File .\skill\scripts\control.ps1 pet wave "你好"`

---

## 四、 Agent 响应交互准则

1. **组合联动响应**：当执行点餐、查券等麦当劳业务时，除了向用户汇报数据，建议**联动调用一条桌宠动作**（如查到优惠券时让桌宠 `jump` 或 `wave` 并说出恭喜语），带给用户生动的桌宠陪伴体验。
2. **结构化优先**：命令均带上 `--json` 参数，以便根据返回值中的 `success`、`message`、`data` 精准判断执行状态。
