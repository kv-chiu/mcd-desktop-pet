## 项目架构

```text
mcd-desktop-pet/
├── desktop/                  # 桌宠本体 (Godot 4.x)
│   ├── project.godot
│   ├── scenes/
│   ├── scripts/
│   └── assets/
├── server/                   # 核心中枢服务 (Hono)
│   ├── src/
│   │   ├── mcp/
│   │   ├── ws/
│   │   ├── routes/
│   │   └── storage/
│   └── package.json
├── web/                      # 可视化控制台 (React 19 + Vite)
│   ├── src/
│   └── package.json
├── shared/                   # 跨端共享协议与元数据 (@mcd/shared)
│   ├── src/
│   │   ├── types/            # MCP JSON-RPC、WebSocket 协议与桌宠状态类型
│   │   └── constants/        # 33 项官方工具单一事实源 (Single Source of Truth)
│   └── package.json
├── cli/                      # 终端命令行工具
├── skill/                    # AI Agent 技能集成
│   ├── SKILL.md
│   └── scripts/
│       ├── install.py
│       └── control.py
├── scripts/                  # 构建发布脚本
│   └── build-release.py
└── .github/                  # CI/CD 自动化
    └── workflows/
        └── release.yml
```

---

## 模块细节说明

### desktop/
* **定位**：桌宠客户端本体，使用 **Godot 4.x** 开发。
* **职责**：
  * **桌面渲染**：透明背景窗口、无边框置顶展示、鼠标拖拽移动与点击交互穿透。
  * **动画与表现**：桌宠常规待机（Idle）、行走（Walk）、跳跃（Jump）、挥手（Wave）等 Sprite 动画与音效播放。
  * **对话气泡**：接收并展示提示信息（如：“主人，今天有麦麦半价券！”、“正在帮您下单”）。
  * **网络通信**：通过内置客户端连接 `server` 的 WebSocket 服务，实时监听动作指令；必要时发起 HTTP 请求拉取数据。

### server/
* **定位**：整个项目的**核心中枢服务**（基于 **Hono** 轻量后端）。
* **职责**：
  * **MCP 协议网关**（`src/mcp/`）：封装麦当劳官方 Streamable HTTP 协议（JSON-RPC 2.0），自动维护握手、`Mcp-Session-Id` 会话、Token 鉴权、限流保护与 33 项官方工具调用。
  * **WebSocket 事件中心**（`src/ws/`）：充当系统 Event Bus。接收来自 Web、CLI 或 Skill 的动作触发请求，实时广播推送给 `desktop` 播放对应动画。
  * **RESTful 业务 API**（`src/routes/`）：对外暴露简化标准的 HTTP 接口（如 `/api/tools/:name`、`/api/pet/action`），供 Web、CLI、Skill 以及第三方客户端调用。
  * **数据与状态持久化**（`src/storage/`）：统一在用户本地目录（如 `~/.mcd-desktop-pet/`）持久化存储 MCP Token、桌宠状态（心情与动作）、偏好设置与订单历史。

### web/
* **定位**：桌面宠物的**图形化管理控制台**（基于 **React 19 + Vite**）。
* **职责**：
  * **可视化控制台**：提供 33 项官方 MCP 工具的可视化调用大屏（营养成分分析、活动日历、优惠券卡片、积分商城等）。
  * **桌宠配置与管理**：提供可视化的 Token 设置、桌宠皮肤/外观切换、互动参数调整与状态监控。
  * **按需打开**：作为可选的 Web 面板，用户挂机时无需打开，只在需要深度操作时使用。

### cli/
* **定位**：**终端命令行工具**。
* **职责**：
  * **用户终端操作**：开发者及终端用户可通过命令行快速启停服务、执行点餐、自动领券、查看积分、查看订单等。
  * **Agent 控制桥梁**：作为面向 **AI Agent / Skill** 的标准化底层 CLI 控制接口，提供结构化输入输出（如 `--json` 格式），方便大模型 Agent 在执行 Skill 时直接通过终端命令精准控制桌宠动作与 MCP 业务。
  * **状态监控**：实时查看后台 `server` 服务运行状态、WebSocket 连接情况及桌宠当前状态。

### skill/
* **定位**：面向 **AI Agent**（如 Claude Code、Codex 等）的技能扩展包。
* **职责**：
  * 允许大模型 Agent 通过自然语言直接理解麦当劳 MCP 能力并操控桌面宠物。
  * 将用户的自然语言意图转化为对底层 `cli/` 工具的标准化调用。

#### skill/SKILL.md
* 符合 Agent 技能规范的描述文档，包含技能元数据、使用场景、工具定义与调用指引，教导 AI 如何通过 `cli/` 与控制脚本触发麦当劳功能与桌宠指令。

#### skill/scripts/install.py
* 技能安装与环境初始化脚本，负责检查本地 `server` 服务连通性、引导设置 MCP Token 与依赖自检。

### scripts/build-release.py
* **定位**：**一键跨平台打包脚本**。
* **职责**：
  * 自动构建导出 Godot 客户端（Windows `.exe` / macOS `.app` / Linux）。
  * 构建 Web 前端产物。
  * 打包 `server` 独立可执行文件或打包环境。
  * 组装最终多端解压即用的 Release 压缩包。

### .github/workflows/release.yml
* **定位**：**GitHub Actions 自动化发布流水线**。
* **职责**：
  * 监听 Git Tag 推送，自动触发多系统（Windows、macOS、Linux）构建矩阵。
  * 自动化执行测试、打包，并自动将安装包产物发布到 GitHub Releases。
