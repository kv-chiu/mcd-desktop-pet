package extensions

import (
	"context"

	"github.com/spf13/cobra"
)

// 1. Menu Slot: 统一注册右键菜单项
type MenuItem struct {
	ID          string            `json:"id"`
	Label       string            `json:"label"`
	Icon        string            `json:"icon,omitempty"`
	Shortcut    string            `json:"shortcut,omitempty"`
	Order       int               `json:"order"`
	IsSeparator bool              `json:"is_separator,omitempty"`
	Action      string            `json:"action,omitempty"`
	Payload     map[string]any    `json:"payload,omitempty"`
	Children    []MenuItem        `json:"children,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// 2. Render Slot: 统一注册桌面展示元素与窗口模板
type RenderType string

const (
	RenderTypePetWindow  RenderType = "pet_window"
	RenderTypeNoteWindow RenderType = "note_window"
	RenderTypeMenuWindow RenderType = "menu_window"
	RenderTypeCustom     RenderType = "custom"
)

type RenderElement struct {
	ID          string         `json:"id"`
	Type        RenderType     `json:"type"`
	Title       string         `json:"title"`
	DefaultSize [2]int         `json:"default_size"`
	MinSize     [2]int         `json:"min_size"`
	MaxSize     [2]int         `json:"max_size"`
	Resizable   bool           `json:"resizable"`
	Draggable   bool           `json:"draggable"`
	AlwaysOnTop bool           `json:"always_on_top"`
	Properties  map[string]any `json:"properties,omitempty"`
}

// 3. Event / WS Slot: 统一注册跨端通信事件与处理器
type EventHandler func(ctx context.Context, clientID string, payload []byte) (any, error)

type EventDefinition struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Direction   string       `json:"direction"` // "c2s", "s2c", "bidirectional"
	Handler     EventHandler `json:"-"`
}

// 4. CLI Command Slot: 统一注册 CLI 命令
type CLICommandProvider func() *cobra.Command

// 5. Skill Slot: 统一注册面向 AI Agent 的自然语言意图映射规范
type SkillDefinition struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Intent      string   `json:"intent"`
	Description string   `json:"description"`
	Examples    []string `json:"examples"`
	CLIMapping  string   `json:"cli_mapping"`
}

// PluginInfo describes a module plugged into the 5-slot architecture.
// Even core/built-in capabilities (such as Sticky Notes) are represented as standard plugins.
type PluginInfo struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Version     string            `json:"version"`
	Description string            `json:"description"`
	Category    string            `json:"category"`
	IsBuiltin   bool              `json:"is_builtin"`
	Status      string            `json:"status"` // "active", "enabled", "standby"
	Icon        string            `json:"icon"`
	Slots       []string          `json:"slots"` // e.g. ["menu", "render", "event", "cli", "skill"]
	Author      string            `json:"author"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

