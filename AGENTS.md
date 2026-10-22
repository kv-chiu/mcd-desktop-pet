# 项目架构与核心设计规范

本文档为麦当劳桌面宠物与 MCP 工具系统（McDonald's Desktop Pet）的核心架构规范，作为各端开发、重构与 AI Agent 协作的单一事实源（Single Source of Truth）。

---

## 1. 架构总览与技术演进

### 1.1 核心目标与技术选型
系统定位为**麦当劳官方 33 项 MCP 工具集与桌面宠物的一体化集成系统**。
当前架构核心演进目标是**使用 Go 语言全面取代原有 Node.js 技术栈**（Hono + Commander.js），重构中枢服务（Server）与命令行工具（CLI），实现全平台**单一原生可执行文件（Single Executable）**分发：
- **完全零运行依赖**：彻底摆脱 Node.js/npm 环境要求，用户下载单文件双击即用。
- **资源占用极低**：Go 编译型二进制内存常驻仅 10MB~20MB（对比 Node.js 60MB~100MB+）。
- **极简一体化分发**：利用 Go 1.16+ `embed.FS`，将 React 19 Web 控制台与 Godot 桌宠运行时资产编译期直接嵌入单一二进制宿主内部。
- **全平台交付**：提供 Windows (`McdDesktopPet.exe`) 与 macOS (`McdDesktopPet.app` / `McdDesktopPet`) 的极简单一可执行文件分发包。

### 1.2 项目工程目录结构

```text
mcd-desktop-pet/
├── cmd/
│   └── mcd/                     # Go 一体化主程序入口 (CLI + Server + 调度宿主)
│       ├── main.go              # Cobra 根命令与启动模式调度
│       └── commands/            # CLI 子命令实现 (server, pet, coupon, tools, config 等)
├── internal/                    # Go 核心内部业务逻辑 (不对外导出)
│   ├── server/                  # HTTP 核心服务、REST API 路由与 WebUI 静态内嵌托管
│   │   ├── router.go            # API 路由分发 (/api/pet, /api/tools, /api/config, /api/system)
│   │   └── web_embed.go         # //go:embed 托管 React 19 SPA 静态资源并提供 SPA Fallback
│   ├── ws/                      # WebSocket Event Hub (桌面双向通信、事件广播与心跳保活)
│   │   ├── hub.go               # 连接池管理与消息广播
│   │   └── client.go            # 客户端连接抽象与协议编解码
│   ├── mcp/                     # 麦当劳官方 MCP Streamable HTTP 协议网关
│   │   ├── client.go            # JSON-RPC 2.0 传输、Mcp-Session-Id 会话与 Token 鉴权
│   │   ├── tools.go             # 33 项官方工具定义与参数映射
│   │   └── evaluator.go         # 传输层/RPC层/工具层/业务层 四层状态评估引擎
│   ├── pet/                     # 桌宠业务状态机 (当前动作、对话气泡调度)
│   │   └── state.go
│   ├── storage/                 # 用户本地数据原子化持久化 (~/.mcd-desktop-pet/)
│   │   └── file_store.go        # 配置、桌宠状态、历史记录原子写入
│   └── embedder/                # Godot 桌宠运行时资产内嵌与释放调度
│       └── desktop_embed.go     # //go:embed 内嵌 Godot 导出产物，双击启动时自动释放/拉起
├── desktop/                     # 桌宠客户端本体 (Godot 4.x)
│   ├── project.godot            # Godot 项目配置 (透明窗口、无边框置顶、鼠标穿透)
│   ├── scenes/                  # 桌宠场景与 UI 节点
│   ├── scripts/                 # GDScript 逻辑 (行为状态机、动作过渡、WebSocket 客户端)
│   └── assets/                  # 角色 Sprite 序列帧动画与音效
├── web/                         # 可视化管理控制台 (React 19 + Vite)
│   ├── src/                     # 可视化大屏组件 (33 项 MCP 工具大屏、配置、桌宠外观)
│   └── dist/                    # 前端生产构建静态产物 (交付给 Go 内嵌)
├── shared/                      # 跨端共享协议与元数据 (@mcd/shared)
│   ├── src/
│   │   ├── types/               # MCP JSON-RPC、WebSocket 协议与桌宠状态数据结构
│   │   └── constants/           # 33 项官方 MCP 工具单一事实源定义
│   └── package.json
├── skill/                       # 面向 AI Agent (Claude Code / Cursor / Codex 等) 的技能包
│   ├── SKILL.md                 # Agent 技能规范与自然语言指令映射指引
│   └── scripts/                 # 安装配置与控制辅助脚本
├── scripts/                     # 工程化与跨平台自动化脚本
│   └── build-release.py         # 一键跨平台单一可执行文件构建打包流水线
└── .github/                     # 自动化持续集成
    └── workflows/
        └── release.yml          # GitHub Actions 多系统跨平台编译发布工作流
```

---

## 2. 模块职责与边界规范

### 2.1 Go 一体化主程序 (`cmd/mcd/` & `internal/`)
* **定位**：全平台**唯一交付的主宿主可执行文件**（统一命名为 `McdDesktopPet`，Windows 下为 `McdDesktopPet.exe`，macOS 下为 `McdDesktopPet.app` 内主二进制或 `McdDesktopPet`）。
* **职责**：
  * **统一模式调度**：无参数直接双击运行时自动进入 **GUI 模式**（静默拉起后台服务并唤起桌面宠物）；终端带参数运行时进入 **CLI 模式**。
  * **MCP 协议网关**（`internal/mcp/`）：封装麦当劳官方 Streamable HTTP 协议，严格维护 JSON-RPC 2.0 握手、`Mcp-Session-Id` 会话、Authorization Token 鉴权以及 33 项官方工具的高可用调用。
  * **WebSocket 事件中心**（`internal/ws/`）：充当系统 Event Bus。将 CLI、Web 或 AI Agent 的控制意图实时推送给 Godot 桌宠播放对应动作动画。
  * **RESTful 业务 API**（`internal/server/`）：提供标准 HTTP 接口（`/api/pet/*`、`/api/tools/*`、`/api/config/*`、`/api/health`）。
  * **内嵌 WebUI 托管**（`internal/server/web_embed.go`）：使用 `go:embed` 直接内嵌托管 React 19 构建产物，实现单端口兼具 API 与管理控制台页面（支持 SPA 404 回退）。
  * **桌宠生命周期管理**（`internal/embedder/`）：内嵌 Godot 运行时资产，在本地数据目录进行 SHA256 校验缓存，安全拉起与监控桌宠渲染进程，并在退出时优雅终止。
  * **数据持久化**（`internal/storage/`）：在用户主目录 `~/.mcd-desktop-pet/` 中通过**原子写入**方式维护配置文件、桌宠状态（动作与交互）及历史记录。

### 2.2 桌宠表现层客户端 (`desktop/`)
* **定位**：纯表现层桌面宠物渲染端，基于 **Godot 4.x** 开发。
* **职责**：
  * **桌面渲染**：透明背景窗口、无边框置顶展示、鼠标拖拽移动与透明区域点击交互穿透。
  * **动画与表现**：待机（Idle）、行走（Walk）、跳跃（Jump）、挥手（Wave）等 Sprite 序列帧动画与音效播放。
  * **对话气泡**：接收并展示提示信息（如：“主人，今天有麦麦半价券！”、“正在帮您下单”）。
  * **网络边界**：**不直接请求外部麦当劳 MCP 服务**，仅通过本地 WebSocket 连接 Go 中枢服务，监听动作指令并上报本地点击事件。

### 2.3 可视化管理控制台 (`web/`)
* **定位**：图形化管理控制大屏，基于 **React 19 + Vite**。
* **职责**：
  * **MCP 工具大屏**：提供 33 项官方 MCP 工具的可视化调用（营养成分分析、活动日历、优惠券卡片、积分商城等）。
  * **桌宠配置与管理**：提供可视化的 Token 设置、桌宠外观切换、系统状态与日志监控。
  * **分发交付**：构建生成的静态资源（`web/dist/`）在发布流水线中交由 Go 编译器内嵌打包，运行时无需独立前端服务。

### 2.4 面向 AI Agent 技能集成 (`skill/`)
* **定位**：面向大模型 Agent（Claude Code、Cursor、Antigravity、Codex 等）的标准化技能集成包。
* **职责**：
  * 将用户的自然语言意图无缝映射到底层标准化 CLI 指令（例如：将“查汉堡热量”映射为 `mcd nutrition 汉堡 --json`）。
  * 依托 `--json` 结构化输出能力，让 AI Agent 精准捕获工具执行状态与桌宠反馈。
  * [skill/SKILL.md](file:///Users/kvchiu/project/mcd-mcp-webui/skill/SKILL.md)：提供规范的元数据、场景说明与命令清单，指导 AI 正确操控系统。

---

## 3. 架构拓扑与交互流向

```mermaid
flowchart TD
    subgraph SingleBinary[单一交付可执行文件 (McdDesktopPet / McdDesktopPet.exe)]
        direction TB
        Entry[用户双击启动 / 终端命令入口]
        CLI[Go CLI 命令行解析 (Cobra)]
        Server[Go 中枢服务核心]
        EmbedWeb[静态资源托管 (go:embed WebUI)]
        EmbedDesktop[桌宠资产包 (go:embed Desktop)]
        WSHub[WebSocket Hub]
        MCPEngine[MCP Client (JSON-RPC 2.0)]
        Storage[本地持久化存储 (~/.mcd-desktop-pet/)]

        Entry -->|带命令行参数| CLI
        Entry -->|无参数直接双击| Server
        CLI -. 本地调用 / HTTP .-> Server
        Server --- EmbedWeb
        Server --- Storage
        Server --> WSHub
        Server --> MCPEngine
        Server -. 释放与调度 .-> EmbedDesktop
    end

    subgraph RuntimePet[桌宠渲染进程 (运行时自动拉起)]
        Godot[Godot 4.x 桌面宠物客户端]
    end

    subgraph External[外部服务]
        MCD_API[麦当劳官方 MCP Streamable HTTP 服务]
    end

    User[用户终端 / AI Agent / 浏览器] --> Entry
    WSHub <-- 双向 WebSocket 通信 (ws://localhost:3001/ws) --> Godot
    MCPEngine -- Streamable HTTP (JSON-RPC 2.0) --> MCD_API
    EmbedDesktop -. 运行拉起 .-> Godot
```

---

## 4. 四层状态评估模型 (Four-Layer Evaluation Model)

为确保 AI Agent 与桌宠在调用麦当劳 33 项 MCP 工具时反馈准确，严禁仅凭 HTTP 200 即判定成功，必须通过统一的**四层状态评估模型**：

1. **传输层 (Transport Layer)**：网络 HTTP 状态码校验（如 200, 400, 404, 500）。
2. **RPC 协议层 (JSON-RPC Layer)**：JSON-RPC 2.0 协议格式检验，排查语法错误或缺失 `result`/`error`。
3. **工具执行层 (Tool Layer)**：检查上游工具执行标识（`result.isError` 与内容完整性）。
4. **业务层 (Business Layer)**：解析具体业务返回值，精准区分为 `full_success`（完全成功）、`partial_success`（部分成功）、`failure`（失败）与 `unknown`（未知状态）。

> **约束原则**：桌宠的庆祝动画（如 `jump` 跳跃）与积极播报**仅允许在业务层判定为 `full_success` 时触发**；出现部分成功或失败时，如实反馈错误信息并触发 `wave` 或 `idle`，绝不虚假庆祝。

---

## 5. 单一可执行文件发布形态

系统发布包彻底告别多文件散落压缩包与批处理脚本，全平台交付单一可执行文件：

| 平台 | 交付形态 | 运行模式 | 特性与用户体验 |
| :--- | :--- | :--- | :--- |
| **Windows** | `McdDesktopPet.exe`（单文件） | 双击即玩 / CLI 命令行 | 内嵌 WebUI 与 Godot 运行时，双击直接运行，终端带参数即作为 CLI 工具 |
| **macOS** | `McdDesktopPet.app` / `McdDesktopPet` | 桌面 App 拖入即用 / CLI | 符合 macOS 规范的单应用交付，自动注册命令行工具符号链接 |

---

## 6. 构建与发布流水线

### 6.1 本地跨平台打包 ([scripts/build-release.py](file:///Users/kvchiu/project/mcd-mcp-webui/scripts/build-release.py))
打包流水线遵循以下阶段：
1. **编译前端静态产物**：构建 `web/` 生成生产静态文件至 `web/dist/`。
2. **导出 Godot 客户端**：调用 Godot 4 引擎导出对应目标平台的桌宠客户端（Windows PCK/EXE、macOS APP）。
3. **Go 编译与内嵌**：利用 `go:embed` 将前端产物与桌宠客户端资产打包进 Go 主程序 `cmd/mcd`，交叉编译输出独立无依赖的单一可执行文件。
4. **校验与签名**：生成 SHA-256 校验和并输出最终 Release 产物。

### 6.2 CI/CD 自动化 ([.github/workflows/release.yml](file:///Users/kvchiu/project/mcd-mcp-webui/.github/workflows/release.yml))
- 监听 Git Tag（如 `v1.0.0`）推送，触发 Windows x64 与 macOS (arm64 / amd64) 构建矩阵。
- 自动化运行单测与集成测试，构建单可执行文件并自动创建 GitHub Release。
