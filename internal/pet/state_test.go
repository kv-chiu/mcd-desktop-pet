package pet

import (
	"os"
	"testing"

	"mcd-desktop-pet/internal/storage"
)

func TestPetStateMachine(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mcd-test-pet-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	fs, err := storage.NewFileStore(tempDir)
	if err != nil {
		t.Fatalf("failed to init FileStore: %v", err)
	}

	changeCount := 0
	sm, err := NewStateMachine(fs, func(s State) {
		changeCount++
	})
	if err != nil {
		t.Fatalf("NewStateMachine failed: %v", err)
	}

	// Initial check
	state := sm.GetState()
	if state.CurrentAction != ActionIdle || !state.Visible {
		t.Errorf("unexpected initial state: %+v", state)
	}

	// Set action
	if err := sm.SetAction(ActionWave, "Hello", 2.5); err != nil {
		t.Fatalf("SetAction failed: %v", err)
	}
	state = sm.GetState()
	if state.CurrentAction != ActionWave || state.SpeechText != "Hello" {
		t.Errorf("state not updated properly: %+v", state)
	}

	// Action completed -> returns to idle
	if err := sm.OnActionCompleted(); err != nil {
		t.Fatalf("OnActionCompleted failed: %v", err)
	}
	state = sm.GetState()
	if state.CurrentAction != ActionIdle || state.SpeechText != "" {
		t.Errorf("expected idle after complete: %+v", state)
	}

	// Visibility toggle
	visible, err := sm.ToggleVisibility()
	if err != nil || visible != false {
		t.Fatalf("expected visible=false, got %v, err: %v", visible, err)
	}
	if sm.GetState().Visible != false {
		t.Errorf("expected state.Visible == false")
	}

	// Persistence reload
	sm2, err := NewStateMachine(fs, nil)
	if err != nil {
		t.Fatalf("reload StateMachine failed: %v", err)
	}
	if sm2.GetState().Visible != false {
		t.Errorf("expected reloaded state to have Visible == false")
	}

	if changeCount < 3 {
		t.Errorf("expected at least 3 change notifications, got %d", changeCount)
	}
}
