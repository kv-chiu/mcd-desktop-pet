---
name: mcd-desktop-pet
description: 麦当劳桌面宠物与 33 项官方 MCP 工具调用技能。使用标准 CLI (mcd) 命令替代繁琐底层的 HTTP/JSON 原生命令，支持通过自然语言一键操控桌宠动画、气泡对话、好感度互动，以及调用麦当劳官方工具（领券、营养查询、积分、活动日历等）。安装时自动将 CLI 加入系统 PATH，并提供完整干净卸载说明。
---

# 麦当劳桌面宠物与 MCP 工具集 Agent 技能规范

本技能赋予 AI Agent（Claude Code、Cursor、Antigravity、Codex 等）通过**极简的标准化 CLI 指令 (`mcd`)** 理解麦当劳官方 MCP 协议并实时操控本地桌面宠物（Godot 4.x）的能力，**彻底替代复杂易错的原生 HTTP/JSON 命令**。

---

## 一、 技能安装与环境变量自动配置 (Installation)

在引入或首次使用本技能时，运行安装脚本即可**自动完成环境自检，并将 `mcd` CLI 永久注入系统环境变量 PATH**：

```bash
# 推荐方式 1: Python 环境一键自检并自动配置 PATH
python3 skill/scripts/install.py --token "<你的麦当劳Token>"

# 推荐方式 2: macOS / Linux (原生 Shell 零依赖，自动写入 ~/.zshrc 或 ~/.bashrc)
./skill/scripts/install.sh "<你的麦当劳Token>"

# 推荐方式 3: Windows (PowerShell 零依赖，自动写入 Windows User PATH)
powershell -File .\skill\scripts\install.ps1 -Token "<你的麦当劳Token>"
```

安装完成后，任意终端直接键入 `mcd --help` 即可全局生效！

---

## 二、 核心原则：用标准化 CLI 替代复杂原生命令

* **无需拼装底层 HTTP 请求**：不需要构造繁琐的 JSON Header、转义字符或记忆长 URL 路径。
* **Agent 友好输出**：所有指令均支持 `--json` 参数，输出结构化数据供 Agent 精准解析。
* **调用方式**：
  * 全局安装环境：直接执行 `mcd <command> [options]`
  * 解压发布包环境：直接执行 `./mcd <command> [options]`（Windows 下执行 `.\mcd.bat`）

---

## 三、 常用控制指令速查 (CLI 一键直达)

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

## 四、 干净卸载指南 (Clean Uninstall Guide)

如果用户需要卸载本技能或清理本地环境，提供了自动化脚本与完全透明的手动清理方法：

### 1. 一键自动化干净卸载

卸载脚本将**自动终止后台进程、从系统环境变量 PATH 中擦除相关配置、删除软链接并清理入口文件**：

```bash
# 方式 1: Python 环境卸载 (追加 --purge 可同时清除历史配置与 Token)
python3 skill/scripts/uninstall.py [--purge]

# 方式 2: macOS / Linux 原生 Shell 一键卸载
./skill/scripts/uninstall.sh [--purge]

# 方式 3: Windows PowerShell 一键卸载
powershell -File .\skill\scripts\uninstall.ps1 [-Purge]
```

### 2. 手动彻底清理说明 (透明公开)

若用户希望手动逐项确认并清理，只需执行以下 4 步：

1. **停止运行中的服务与桌宠**：
   ```bash
   mcd stop
   pkill -f "McdDesktopPet" 2>/dev/null || true
   ```
2. **清理 Shell 配置文件中的 PATH 注入**：
   检查并删除 `~/.zshrc` 或 `~/.bashrc` 中的如下标记块：
   ```bash
   # >>> mcd-desktop-pet cli >>>
   export PATH="$HOME/.mcd-desktop-pet/bin:$PATH"
   # <<< mcd-desktop-pet cli <<<
   ```
3. **移除本地数据与缓存目录**：
   ```bash
   rm -rf ~/.mcd-desktop-pet
   rm -f ~/.local/bin/mcd
   ```
4. **移除 Skill 扩展包**：
   从您的 Agent 技能库目录中删除 `skill/` 或对应的 `mcd-desktop-pet/` 文件夹即可。

---

## 五、 Agent 响应交互准则

1. **组合联动响应**：当执行点餐、查券等麦当劳业务时，除了向用户汇报数据，建议**联动调用一条桌宠动作**（如查到优惠券时让桌宠 `jump` 或 `wave` 并说出恭喜语），带给用户生动的桌宠陪伴体验。
2. **结构化优先**：命令均带上 `--json` 参数，以便根据返回值中的 `success`、`message`、`data` 精准判断执行状态。
