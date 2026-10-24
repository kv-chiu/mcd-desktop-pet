package main

import (
	"github.com/spf13/cobra"

	"mcd-desktop-pet/cmd/mcd-desktop-pet/commands"
	"mcd-desktop-pet/internal/extensions"
	"mcd-desktop-pet/internal/selfheal"
)

func main() {
	reg := extensions.Default()

	// Register built-in 5-Slot items
	registerBuiltinSlots(reg)

	rootCmd := &cobra.Command{
		Use:   "mcd-desktop-pet",
		Short: "McDonald's Desktop Pet & Sticky Note System",
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			if cmd.Name() != "__serve" {
				_ = selfheal.EnsureSelfHealing()
			}
		},
		// 无参数运行严格等同于 start (点击运行与 CLI start 共用同一启动流程)
		Run: func(cmd *cobra.Command, args []string) {
			commands.RunStart()
		},
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	// Register CLI commands via CLI Command Slot
	reg.AttachCLICommands(rootCmd)

	// Hidden internal worker
	rootCmd.AddCommand(commands.NewServeCommand())

	if err := rootCmd.Execute(); err != nil {
		commands.PrintErrorJSON(err)
	}
}

// registerBuiltinSlots statically registers built-in modules into the 5-slot architecture.
func registerBuiltinSlots(reg *extensions.Registry) {
	// 1. Menu Slot
	reg.RegisterMenuItem(extensions.MenuItem{
		ID:       "new_note",
		Label:    "📝 新建便利贴",
		Shortcut: "Ctrl+N",
		Order:    10,
		Action:   "create_note",
	})
	reg.RegisterMenuItem(extensions.MenuItem{
		ID:       "history_notes",
		Label:    "📦 历史便签盒",
		Shortcut: "Ctrl+B",
		Order:    20,
		Action:   "open_web",
	})
	reg.RegisterMenuItem(extensions.MenuItem{
		ID:          "sep1",
		IsSeparator: true,
		Order:       30,
	})
	reg.RegisterMenuItem(extensions.MenuItem{
		ID:     "toggle_theme",
		Label:  "🎨 切换外观主题",
		Order:  40,
		Action: "toggle_theme",
	})
	reg.RegisterMenuItem(extensions.MenuItem{
		ID:     "toggle_visibility",
		Label:  "👁️ 显示 / 隐藏桌面全部内容",
		Order:  50,
		Action: "toggle_visibility",
	})
	reg.RegisterMenuItem(extensions.MenuItem{
		ID:     "settings",
		Label:  "⚙️ 偏好设置",
		Order:  60,
		Action: "open_settings",
	})
	reg.RegisterMenuItem(extensions.MenuItem{
		ID:     "exit",
		Label:  "🚪 退出",
		Order:  100,
		Action: "exit",
	})

	// 2. Render Slot
	reg.RegisterRender(extensions.RenderElement{
		ID:          "pet_window",
		Type:        extensions.RenderTypePetWindow,
		Title:       "Desktop Pet",
		DefaultSize: [2]int{200, 200},
		MinSize:     [2]int{100, 100},
		MaxSize:     [2]int{400, 400},
		Resizable:   false,
		Draggable:   true,
		AlwaysOnTop: true,
	})
	reg.RegisterRender(extensions.RenderElement{
		ID:          "note_window",
		Type:        extensions.RenderTypeNoteWindow,
		Title:       "Sticky Note",
		DefaultSize: [2]int{280, 320},
		MinSize:     [2]int{200, 200},
		MaxSize:     [2]int{600, 800},
		Resizable:   true,
		Draggable:   true,
		AlwaysOnTop: true,
	})

	// 3. CLI Slot
	reg.RegisterCLI(commands.NewStartCommand)
	reg.RegisterCLI(commands.NewStopCommand)
	reg.RegisterCLI(commands.NewStatusCommand)
	reg.RegisterCLI(commands.NewWebCommand)
	reg.RegisterCLI(commands.NewNoteCommand)

	// 4. Skill Slot
	reg.RegisterSkill(extensions.SkillDefinition{
		ID:          "create_note",
		Name:        "创建便利贴",
		Intent:      "记录备忘、便签或灵感",
		Description: "在桌面上新建一张便利贴",
		Examples:    []string{"帮我记一张便签：明天下午开会", "提醒我买麦辣鸡腿堡"},
		CLIMapping:  "mcd-desktop-pet note create --text \"<内容>\"",
	})
	reg.RegisterSkill(extensions.SkillDefinition{
		ID:          "list_notes",
		Name:        "查看便签列表",
		Intent:      "查看桌面上的活动或已存档便签",
		Description: "列出活动/已归档/全部便利贴",
		Examples:    []string{"看看我有哪些便签", "列出已归档的便签"},
		CLIMapping:  "mcd-desktop-pet note list --status <active|archived|all>",
	})
	reg.RegisterSkill(extensions.SkillDefinition{
		ID:          "archive_note",
		Name:        "便签归档",
		Intent:      "便签标记完成或盖章出餐",
		Description: "将便利贴归档入便签盒",
		Examples:    []string{"把便签 1 归档", "标记完成便签"},
		CLIMapping:  "mcd-desktop-pet note archive <id>",
	})
	reg.RegisterSkill(extensions.SkillDefinition{
		ID:          "restore_note",
		Name:        "便签贴回桌面",
		Intent:      "从便签盒恢复便签至桌面",
		Description: "将已存档便签重新贴回桌面",
		Examples:    []string{"把刚才的便签贴回桌面"},
		CLIMapping:  "mcd-desktop-pet note restore <id>",
	})
	reg.RegisterSkill(extensions.SkillDefinition{
		ID:          "delete_note",
		Name:        "删除便签",
		Intent:      "彻底删除便利贴",
		Description: "彻底删除指定便利贴",
		Examples:    []string{"删掉这个便签"},
		CLIMapping:  "mcd-desktop-pet note delete <id>",
	})

	// 5. Plugin Registry (All features, even built-in, are registered as plugins leveraging the 5 slots)
	reg.RegisterPlugin(extensions.PluginInfo{
		ID:          "sticky_notes",
		Name:        "便利贴插件 (Sticky Notes)",
		Version:     "v1.0.0",
		Description: "基于 5-Slot 插槽架构构建的独立桌面便利贴插件，支持图文混排、剪贴板截图粘贴、主题撕纸与便签盒大屏归档。",
		Category:    "productivity",
		IsBuiltin:   true,
		Status:      "active",
		Icon:        "receipt",
		Slots:       []string{"menu", "render", "event", "cli", "skill"},
		Author:      "Core Team",
		Metadata: map[string]string{
			"component": "Godot SubWindow",
			"storage":   "~/.mcd-desktop-pet/notes.json",
			"hotkey":    "Ctrl+N / Cmd+V",
		},
	})
	reg.RegisterPlugin(extensions.PluginInfo{
		ID:          "desktop_pet",
		Name:        "桌宠本体 (Desktop Pet)",
		Version:     "v1.0.0",
		Description: "桌面实体渲染与高情感陪伴状态机插件，支持待机呼吸、打招呼、跳跃、漫步巡航与桌面全量联动显隐。",
		Category:    "companion",
		IsBuiltin:   true,
		Status:      "active",
		Icon:        "sparkles",
		Slots:       []string{"menu", "render", "event", "cli"},
		Author:      "Core Team",
		Metadata: map[string]string{
			"renderer": "Godot 4.x Transparent Window",
			"theme":    "mcdonalds / pure",
		},
	})
	reg.RegisterPlugin(extensions.PluginInfo{
		ID:          "agent_skills",
		Name:        "AI Agent 技能集成 (Agent Skills)",
		Version:     "v1.0.0",
		Description: "面向 Claude Code、Cursor、Antigravity 等大模型 Agent 的自然语言意图映射规范插件，标准化输出 SKILL.md。",
		Category:    "ai",
		IsBuiltin:   true,
		Status:      "active",
		Icon:        "terminal",
		Slots:       []string{"cli", "skill"},
		Author:      "Core Team",
		Metadata: map[string]string{
			"standard": "AI Agent CLI Contract",
			"spec":     "skill/SKILL.md",
		},
	})
	reg.RegisterPlugin(extensions.PluginInfo{
		ID:          "mcd_mcp",
		Name:        "麦当劳 33 项 MCP 工具集 (McDonald's MCP)",
		Version:     "v1.0.0",
		Description: "麦当劳官方 33 项餐饮与会员生态 MCP 工具集插槽，提供小票生成、点餐、优惠券与门店定位（待命就绪状态）。",
		Category:    "business",
		IsBuiltin:   false,
		Status:      "standby",
		Icon:        "store",
		Slots:       []string{"menu", "cli", "skill"},
		Author:      "McDonald's MCP Team",
		Metadata: map[string]string{
			"tools_count": "33",
			"protocol":    "Model Context Protocol",
		},
	})
	reg.RegisterPlugin(extensions.PluginInfo{
		ID:          "system_tray",
		Name:        "系统托盘与自愈守护 (Tray & Self-Heal)",
		Version:     "v1.0.0",
		Description: "跨平台托盘常驻控制器、全量显隐联动与终端 PATH 软链接自愈守护插件。",
		Category:    "system",
		IsBuiltin:   true,
		Status:      "active",
		Icon:        "activity",
		Slots:       []string{"menu", "event", "cli"},
		Author:      "Core Team",
		Metadata: map[string]string{
			"platform": "macOS / Windows",
			"bin_heal": "~/.local/bin/mcd-desktop-pet",
		},
	})
}

