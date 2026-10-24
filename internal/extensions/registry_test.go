package extensions

import (
	"context"
	"testing"

	"github.com/spf13/cobra"
)

func TestRegistrySlots(t *testing.T) {
	reg := NewRegistry()

	// 1. Menu Slot
	reg.RegisterMenuItem(MenuItem{ID: "exit", Label: "退出", Order: 100})
	reg.RegisterMenuItem(MenuItem{ID: "new_note", Label: "新建便利贴", Order: 10})
	reg.RegisterMenuItem(MenuItem{ID: "history", Label: "历史便签盒", Order: 20})

	items := reg.GetMenuItems()
	if len(items) != 3 {
		t.Fatalf("expected 3 menu items, got %d", len(items))
	}
	if items[0].ID != "new_note" || items[1].ID != "history" || items[2].ID != "exit" {
		t.Errorf("menu items not properly sorted by order: %+v", items)
	}

	// 2. Render Slot
	reg.RegisterRender(RenderElement{
		ID:          "note_window",
		Type:        RenderTypeNoteWindow,
		Title:       "Sticky Note",
		DefaultSize: [2]int{280, 320},
	})
	if r, ok := reg.GetRender("note_window"); !ok || r.Title != "Sticky Note" {
		t.Errorf("failed to retrieve render element")
	}

	// 3. Event Slot
	handled := false
	reg.RegisterEvent(EventDefinition{
		Name:      "THEME_CHANGED",
		Direction: "s2c",
		Handler: func(ctx context.Context, clientID string, payload []byte) (any, error) {
			handled = true
			return "ok", nil
		},
	})
	ev, ok := reg.GetEvent("THEME_CHANGED")
	if !ok {
		t.Fatalf("failed to retrieve event")
	}
	res, err := ev.Handler(context.Background(), "test-client", nil)
	if err != nil || !handled || res != "ok" {
		t.Errorf("event handler execution failed: res=%v, err=%v", res, err)
	}

	// 4. CLI Slot
	reg.RegisterCLI(func() *cobra.Command {
		return &cobra.Command{
			Use:   "dummy",
			Short: "Dummy command",
		}
	})
	rootCmd := &cobra.Command{Use: "root"}
	reg.AttachCLICommands(rootCmd)
	found := false
	for _, c := range rootCmd.Commands() {
		if c.Use == "dummy" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("dummy CLI command was not attached")
	}

	// 5. Skill Slot
	reg.RegisterSkill(SkillDefinition{
		ID:         "create_note",
		Name:       "Create Note",
		Intent:     "帮我创建便利贴",
		CLIMapping: "mcd-desktop-pet note create --text",
	})
	skills := reg.ListSkills()
	if len(skills) != 1 || skills[0].ID != "create_note" {
		t.Errorf("skill registration failed: %+v", skills)
	}
}
