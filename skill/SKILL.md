---
name: mcd-desktop-pet
description: 便利贴桌面宠物标准化 CLI 与 AI Agent 技能包。通过标准 CLI 指令 (mcd-desktop-pet) 操控桌面宠物并进行便利贴备忘的增删改查、归档出餐与贴回桌面。所有 CLI 命令默认输出纯 JSON 格式，供 AI Agent 直接精准解析。
---

# 便利贴桌面宠物 Agent 技能规范 (mcd-desktop-pet)

本技能赋予 AI Agent（Claude Code、Cursor、Antigravity、Codex 等）通过**标准化统一命令行工具 (`mcd-desktop-pet`)** 操控本地桌面宠物与管理桌面便利贴系统的能力。

---

## 一、 核心交互规范

1. **统一小写命令行**：CLI 命令严格采用全小写 `mcd-desktop-pet`（Windows 下为 `mcd-desktop-pet.exe` 或 `mcd-desktop-pet.cmd`），无任何短别名，保持标志唯一确定。
2. **默认 JSON 输出**：所有 CLI 命令的结果均**默认输出为纯 JSON**，标准输出（stdout）严格保留给 JSON 结果，诊断日志统一输出至标准错误（stderr）。AI Agent **无需追加 `--json`** 即可直接解析。
3. **确定性退出码**：
   - 成功：退出码为 `0`，标准输出输出有效 JSON 对象或数组。
   - 失败：非零退出码，标准输出输出统一错误结构 `{"error": "错误原因说明"}`。
4. **统一入口与复用**：无参数运行主程序严格等同于 `mcd-desktop-pet start`。若服务或桌宠已在运行中，`start` 会自动复用已有实例，避免重复创建。

---

## 二、 自然语言意图到 CLI 命令映射表

### 1. 便利贴生命周期管理 (Note Operations)

| 用户自然语言意图 | 标准 CLI 命令 | 说明与返回结构 |
| :--- | :--- | :--- |
| **“帮我记一张便签：明天下午 3 点开会”** | `mcd-desktop-pet note create --text "明天下午 3 点开会"` | 创建便签，返回 `{"id": "note_xxx", "summary": "...", "status": "active"}` |
| **“新建带标题便签：待办事项”** | `mcd-desktop-pet note create --title "待办" --text "买麦辣鸡腿堡"` | 创建带标题便签 |
| **“列出当前桌面上的活动便签”** | `mcd-desktop-pet note list --status active` | 返回当前悬浮在桌面上的便签列表 `[{"id": "...", "summary": "...", "status": "active"}]` |
| **“查看已经归档出餐的历史便签”** | `mcd-desktop-pet note list --status archived` | 返回已出餐/归档的历史便签列表 |
| **“查看全部便签（含活动与归档）”** | `mcd-desktop-pet note list --status all` | 返回所有便签清单 |
| **“把这条便签归档（标记完成/出餐）”** | `mcd-desktop-pet note archive <id>` | 标记归档出餐，桌宠端将触发印章砸印动效并收起，返回归档后状态 |
| **“把这张历史便签重新贴回桌面”** | `mcd-desktop-pet note restore <id>` | 从便签盒恢复并贴回桌面，重新在桌面悬浮展示 |
| **“彻底删除这张便签”** | `mcd-desktop-pet note delete <id>` | 彻底删除便签数据，返回 `{"id": "note_xxx", "deleted": true}` |

---

### 2. 系统生命周期与控制台 (System & Web)

| 用户自然语言意图 | 标准 CLI 命令 | 说明与行为 |
| :--- | :--- | :--- |
| **“启动桌面宠物”** | `mcd-desktop-pet start` | 统一启动中枢服务与桌宠客户端；若已运行则直接复用 |
| **“停止 / 退出桌面宠物”** | `mcd-desktop-pet stop` | 优雅停止中枢服务与桌宠表现层进程，清理 PID 锁 |
| **“检查桌宠和服务当前运行状态”** | `mcd-desktop-pet status` | 返回 `{"server_running": bool, "pet_running": bool, "port": 23301, "theme": "mcdonalds"}` |
| **“打开历史便签盒 / 管理控制台”** | `mcd-desktop-pet web` | **按需启动**：若服务未启动会自动在后台拉起服务（无需启动桌宠），并在浏览器打开全屏瀑布流大屏 |

---

## 三、 Agent 场景演练与调用范式

### 场景 1：用户让 Agent 记录灵感或待办
> **用户输入**：“帮我记一张便签：周五前要完成文档评审”
> **Agent 执行**：
> ```bash
> mcd-desktop-pet note create --text "周五前要完成文档评审"
> ```
> **CLI 输出 (stdout)**：
> ```json
> {
>   "id": "note_5fa21d9b",
>   "summary": "周五前要完成文档评审",
>   "status": "active"
> }
> ```
> **Agent 回复**：“已经帮您在桌面上贴好新便签：‘周五前要完成文档评审’（流水号 note_5fa21d9b）📝✨”

---

### 场景 2：用户让 Agent 查看当前便签并归档完成项
> **用户输入**：“看看我桌面上有什么便签，把刚才评审文档的那张归档了”
> **Agent 执行 1**：
> ```bash
> mcd-desktop-pet note list --status active
> ```
> **CLI 输出 1**：
> ```json
> [
>   {
>     "id": "note_5fa21d9b",
>     "summary": "周五前要完成文档评审",
>     "status": "active"
>   }
> ]
> ```
> **Agent 执行 2**：
> ```bash
> mcd-desktop-pet note archive note_5fa21d9b
> ```
> **CLI 输出 2**：
> ```json
> {
>   "id": "note_5fa21d9b",
>   "summary": "周五前要完成文档评审",
>   "status": "archived"
> }
> ```
> **Agent 回复**：“查找到桌面上有一张便签‘周五前要完成文档评审’，已为您盖章出餐并安全归档至历史便签盒！🍟✓”

---

### 场景 3：快速检查运行状态与打开大屏
> **用户输入**：“桌宠还在跑吗？帮我打开便签大屏”
> **Agent 执行 1**：
> ```bash
> mcd-desktop-pet status
> ```
> **Agent 执行 2**：
> ```bash
> mcd-desktop-pet web
> ```
> **Agent 回复**：“当前中枢服务正常运行中。已在您的浏览器中打开历史便签盒大屏，您可以在瀑布流中浏览所有历史备忘与出餐记录！🌐”

---

## 四、 交付形态与直接调用指引 (Delivery & Invocation)

本项目交付物为**完全自包含的独立预编译二进制与应用包**，**无需执行任何安装、配置或卸载脚本**，下载即用：

- **macOS**：交付单应用包 `mcd-desktop-pet.app`。双击直接启动桌宠；AI Agent 或终端可直接带参数调用包内主程序：
  ```bash
  # 直接调用应用包内主程序（默认输出 JSON）
  /Applications/mcd-desktop-pet.app/Contents/MacOS/mcd-desktop-pet note create --text "待办事项"
  /Applications/mcd-desktop-pet.app/Contents/MacOS/mcd-desktop-pet note list --status active
  /Applications/mcd-desktop-pet.app/Contents/MacOS/mcd-desktop-pet status
  ```
  *(若已将应用包主程序创建符号链接至 `/usr/local/bin` 或系统 `PATH`，可简写为 `mcd-desktop-pet`)*

- **Windows**：交付单可执行文件 `mcd-desktop-pet.exe`。双击直接启动桌宠；AI Agent 或终端可直接在命令行调用：
  ```powershell
  # 直接调用可执行文件（默认输出 JSON）
  .\mcd-desktop-pet.exe note create --text "待办事项"
  .\mcd-desktop-pet.exe note list --status active
  .\mcd-desktop-pet.exe status
  ```

---

## 五、 错误处理与规范约定

1. **退出码机制**：所有命令成功时返回退出码 `0`，失败时返回非零退出码。
2. **错误响应格式**：当命令执行遇到错误时，标准输出均返回标准的 JSON 错误结构，便于 Agent 准确捕获：
   ```json
   {
     "error": "note not found: note_xxx"
   }
   ```
3. **静默与纯粹性**：Go 主程序在 CLI 模式下，标准输出（stdout）严格保留给机器可解析的 JSON 结果，任何运维诊断日志统一打到标准错误（stderr），AI Agent 可直接使用 `JSON.parse()` 解析结果。


