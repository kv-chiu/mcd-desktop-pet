package pet

import (
	"fmt"
	"math/rand"
	"os"
	"sync"
	"time"

	"mcd-desktop-pet/internal/storage"
)

const PetStateFileName = "pet_state.json"

type ActionType string

const (
	ActionIdle  ActionType = "idle"
	ActionWave  ActionType = "wave"
	ActionJump  ActionType = "jump"
	ActionWalk  ActionType = "walk"
	ActionSpeak ActionType = "speak"
)

// State represents the runtime and persisted pet behavior and visibility state.
type State struct {
	Name               string     `json:"name"`
	CurrentAction      ActionType `json:"current_action"`
	SpeechText         string     `json:"speech_text,omitempty"`
	SpeechDuration     float64    `json:"speech_duration,omitempty"` // in seconds
	Visible            bool       `json:"visible"`                   // 桌面全量显隐控制
	LastInteractedTime time.Time  `json:"last_interacted_time"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// StateMachine manages pet behavior transitions, visibility, and persistence.
type StateMachine struct {
	mu        sync.RWMutex
	fileStore *storage.FileStore
	state     State
	onChange  func(s State)
}

// NewStateMachine creates a new pet StateMachine and restores saved state if available.
func NewStateMachine(fs *storage.FileStore, onChange func(s State)) (*StateMachine, error) {
	sm := &StateMachine{
		fileStore: fs,
		onChange:  onChange,
		state: State{
			Name:               "薯宝",
			CurrentAction:      ActionIdle,
			Visible:            true,
			LastInteractedTime: time.Now(),
			UpdatedAt:          time.Now(),
		},
	}

	if err := sm.load(); err != nil {
		return nil, err
	}

	return sm, nil
}

func (sm *StateMachine) load() error {
	var s State
	err := sm.fileStore.ReadJSON(PetStateFileName, &s)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to load pet state: %w", err)
	}

	if s.Name == "" {
		s.Name = "薯宝"
	}
	s.CurrentAction = ActionIdle // always start in idle
	sm.state = s
	return nil
}

func (sm *StateMachine) persist() error {
	sm.state.UpdatedAt = time.Now()
	return sm.fileStore.AtomicWriteJSON(PetStateFileName, sm.state)
}

// GetState returns a copy of current pet state.
func (sm *StateMachine) GetState() State {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.state
}

// SetAction changes the current pet action and triggers callback.
func (sm *StateMachine) SetAction(action ActionType, speech string, duration float64) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.state.CurrentAction = action
	sm.state.SpeechText = speech
	sm.state.SpeechDuration = duration
	sm.state.LastInteractedTime = time.Now()

	if err := sm.persist(); err != nil {
		return err
	}

	if sm.onChange != nil {
		sm.onChange(sm.state)
	}
	return nil
}

// OnActionCompleted is invoked when the expression/animation finishes in Godot.
func (sm *StateMachine) OnActionCompleted() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.state.CurrentAction = ActionIdle
	sm.state.SpeechText = ""
	sm.state.SpeechDuration = 0

	if err := sm.persist(); err != nil {
		return err
	}

	if sm.onChange != nil {
		sm.onChange(sm.state)
	}
	return nil
}

// OnClick handles user click interaction on the desktop pet.
func (sm *StateMachine) OnClick() (ActionType, error) {
	// Randomly trigger Wave or Jump, with friendly speech
	actions := []ActionType{ActionWave, ActionJump}
	speeches := []string{
		"你好呀！今天想吃点什么呢？🍟",
		"今天也是元气满满的一天！✨",
		"咔嚓！记下一条新便签吧！📝",
		"有任何待办都可以交给我哦！🍔",
	}

	chosenAction := actions[rand.Intn(len(actions))]
	chosenSpeech := speeches[rand.Intn(len(speeches))]

	err := sm.SetAction(chosenAction, chosenSpeech, 3.0)
	return chosenAction, err
}

// SetVisibility sets desktop visibility (pet + notes联动全量显隐).
func (sm *StateMachine) SetVisibility(visible bool) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.state.Visible = visible
	if err := sm.persist(); err != nil {
		return err
	}

	if sm.onChange != nil {
		sm.onChange(sm.state)
	}
	return nil
}

// ToggleVisibility toggles visibility.
func (sm *StateMachine) ToggleVisibility() (bool, error) {
	sm.mu.Lock()
	visible := !sm.state.Visible
	sm.state.Visible = visible
	err := sm.persist()
	sm.mu.Unlock()

	if err != nil {
		return visible, err
	}

	if sm.onChange != nil {
		sm.onChange(sm.GetState())
	}
	return visible, nil
}
