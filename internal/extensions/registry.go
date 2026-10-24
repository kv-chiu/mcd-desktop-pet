package extensions

import (
	"sort"
	"sync"

	"github.com/spf13/cobra"
)

// Registry manages the registration and lookup for all 5 extension slots.
type Registry struct {
	mu sync.RWMutex

	menuItems []MenuItem
	renders   map[string]RenderElement
	events    map[string]EventDefinition
	cliCmds   []CLICommandProvider
	skills    map[string]SkillDefinition
	plugins   map[string]PluginInfo
}

var defaultRegistry = NewRegistry()

// Default returns the global default registry instance.
func Default() *Registry {
	return defaultRegistry
}

// NewRegistry creates a new isolated registry.
func NewRegistry() *Registry {
	return &Registry{
		menuItems: make([]MenuItem, 0),
		renders:   make(map[string]RenderElement),
		events:    make(map[string]EventDefinition),
		cliCmds:   make([]CLICommandProvider, 0),
		skills:    make(map[string]SkillDefinition),
		plugins:   make(map[string]PluginInfo),
	}
}

// RegisterMenuItem registers an item for Menu Slot.
func (r *Registry) RegisterMenuItem(item MenuItem) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.menuItems = append(r.menuItems, item)
}

// GetMenuItems returns all registered menu items sorted by Order.
func (r *Registry) GetMenuItems() []MenuItem {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items := make([]MenuItem, len(r.menuItems))
	copy(items, r.menuItems)
	sort.Slice(items, func(i, j int) bool {
		return items[i].Order < items[j].Order
	})
	return items
}

// RegisterRender registers a render element template for Render Slot.
func (r *Registry) RegisterRender(render RenderElement) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.renders[render.ID] = render
}

// GetRender retrieves a render element by ID.
func (r *Registry) GetRender(id string) (RenderElement, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	render, ok := r.renders[id]
	return render, ok
}

// ListRenders returns all registered render element templates.
func (r *Registry) ListRenders() []RenderElement {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]RenderElement, 0, len(r.renders))
	for _, render := range r.renders {
		list = append(list, render)
	}
	return list
}

// RegisterEvent registers an event definition for Event / WS Slot.
func (r *Registry) RegisterEvent(event EventDefinition) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events[event.Name] = event
}

// GetEvent retrieves an event definition by name.
func (r *Registry) GetEvent(name string) (EventDefinition, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ev, ok := r.events[name]
	return ev, ok
}

// ListEvents returns all registered event definitions.
func (r *Registry) ListEvents() []EventDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]EventDefinition, 0, len(r.events))
	for _, ev := range r.events {
		list = append(list, ev)
	}
	return list
}

// RegisterCLI registers a CLI command provider for CLI Slot.
func (r *Registry) RegisterCLI(provider CLICommandProvider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cliCmds = append(r.cliCmds, provider)
}

// AttachCLICommands attaches all registered commands to the root Cobra command.
func (r *Registry) AttachCLICommands(rootCmd *cobra.Command) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, provider := range r.cliCmds {
		if cmd := provider(); cmd != nil {
			rootCmd.AddCommand(cmd)
		}
	}
}

// RegisterSkill registers a skill mapping definition for Skill Slot.
func (r *Registry) RegisterSkill(skill SkillDefinition) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.skills[skill.ID] = skill
}

// ListSkills returns all registered skill definitions.
func (r *Registry) ListSkills() []SkillDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]SkillDefinition, 0, len(r.skills))
	for _, s := range r.skills {
		list = append(list, s)
	}
	return list
}

// RegisterPlugin registers a module/plugin in the 5-slot architecture.
func (r *Registry) RegisterPlugin(plugin PluginInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.plugins[plugin.ID] = plugin
}

// ListPlugins returns all registered plugins.
func (r *Registry) ListPlugins() []PluginInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]PluginInfo, 0, len(r.plugins))
	for _, p := range r.plugins {
		list = append(list, p)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].IsBuiltin != list[j].IsBuiltin {
			return list[i].IsBuiltin // built-in first
		}
		return list[i].ID < list[j].ID
	})
	return list
}

// GetPlugin retrieves a plugin by ID.
func (r *Registry) GetPlugin(id string) (PluginInfo, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.plugins[id]
	return p, ok
}

