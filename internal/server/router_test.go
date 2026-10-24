package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"mcd-desktop-pet/internal/extensions"
	"mcd-desktop-pet/internal/notes"
	"mcd-desktop-pet/internal/pet"
	"mcd-desktop-pet/internal/storage"
	"mcd-desktop-pet/internal/ws"
)

func setupTestServer(t *testing.T) (*Server, func()) {
	tempDir, err := os.MkdirTemp("", "mcd-test-server-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	fs, err := storage.NewFileStore(tempDir)
	if err != nil {
		t.Fatalf("failed to init FileStore: %v", err)
	}

	notesMgr, err := notes.NewManager(fs)
	if err != nil {
		t.Fatalf("failed to init NotesManager: %v", err)
	}

	reg := extensions.NewRegistry()
	wsHub := ws.NewHub(reg)
	petSM, err := pet.NewStateMachine(fs, nil)
	if err != nil {
		t.Fatalf("failed to init PetSM: %v", err)
	}

	srv := NewServer(fs, notesMgr, petSM, wsHub, reg)
	cleanup := func() {
		os.RemoveAll(tempDir)
	}
	return srv, cleanup
}

func TestServerHealthAndPet(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Health check
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	// 2. Pet state
	req = httptest.NewRequest(http.MethodGet, "/api/pet/state", nil)
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	// 3. Pet click
	req = httptest.NewRequest(http.MethodPost, "/api/pet/click", nil)
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestServerNotesCRUD(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Create note
	body := []byte(`{"title":"麦麦脆汁鸡","content":"两块装加九角肉汁"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/notes", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var createdNote notes.Note
	if err := json.Unmarshal(rec.Body.Bytes(), &createdNote); err != nil {
		t.Fatalf("failed to unmarshal note: %v", err)
	}

	// 2. Archive note
	req = httptest.NewRequest(http.MethodPost, "/api/notes/"+createdNote.ID+"/archive", nil)
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// 3. Restore note
	req = httptest.NewRequest(http.MethodPost, "/api/notes/"+createdNote.ID+"/restore", nil)
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// 4. Delete note
	req = httptest.NewRequest(http.MethodDelete, "/api/notes/"+createdNote.ID, nil)
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestServerThemeConfig(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	// Default theme should be mcdonalds
	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	var cfg storage.AppConfig
	_ = json.Unmarshal(rec.Body.Bytes(), &cfg)
	if cfg.Theme != storage.ThemeMcDonalds {
		t.Errorf("expected default theme %s, got %s", storage.ThemeMcDonalds, cfg.Theme)
	}

	// Switch theme to pure
	body := []byte(`{"theme":"pure"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/config/theme", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Check reloaded config
	req = httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	_ = json.Unmarshal(rec.Body.Bytes(), &cfg)
	if cfg.Theme != storage.ThemePure {
		t.Errorf("expected updated theme %s, got %s", storage.ThemePure, cfg.Theme)
	}
}

func TestServerScaleConfig(t *testing.T) {
	srv, cleanup := setupTestServer(t)
	defer cleanup()

	// Default scale should be 1.0
	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	var cfg storage.AppConfig
	_ = json.Unmarshal(rec.Body.Bytes(), &cfg)
	if cfg.PetScale != 1.0 {
		t.Errorf("expected default scale 1.0, got %f", cfg.PetScale)
	}

	// Update scale via /api/config/scale
	body := []byte(`{"scale": 1.25}`)
	req = httptest.NewRequest(http.MethodPost, "/api/config/scale", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Check reloaded config
	req = httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	_ = json.Unmarshal(rec.Body.Bytes(), &cfg)
	if cfg.PetScale != 1.25 {
		t.Errorf("expected updated scale 1.25, got %f", cfg.PetScale)
	}

	// Test clamping below 0.5 -> 0.5
	body = []byte(`{"scale": 0.2}`)
	req = httptest.NewRequest(http.MethodPost, "/api/pet/scale", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	req = httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec = httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	_ = json.Unmarshal(rec.Body.Bytes(), &cfg)
	if cfg.PetScale != 0.5 {
		t.Errorf("expected clamped scale 0.5, got %f", cfg.PetScale)
	}
}
