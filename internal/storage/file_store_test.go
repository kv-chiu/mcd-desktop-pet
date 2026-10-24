package storage

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func TestStorageFileAndMedia(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mcd-test-storage-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	fs, err := NewFileStore(tempDir)
	if err != nil {
		t.Fatalf("failed to init FileStore: %v", err)
	}

	// 1. Config tests
	cfg, err := fs.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}
	if cfg.Theme != ThemeMcDonalds {
		t.Errorf("expected default theme %s, got %s", ThemeMcDonalds, cfg.Theme)
	}
	if cfg.Port != DefaultPort {
		t.Errorf("expected default port %d, got %d", DefaultPort, cfg.Port)
	}

	// Change theme to pure
	cfg.Theme = ThemePure
	if err := fs.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig failed: %v", err)
	}
	loadedCfg, err := fs.LoadConfig()
	if err != nil || loadedCfg.Theme != ThemePure {
		t.Fatalf("expected updated theme %s, got %s, err: %v", ThemePure, loadedCfg.Theme, err)
	}

	// 2. PID tests
	if err := fs.WritePID("server", 12345); err != nil {
		t.Fatalf("WritePID failed: %v", err)
	}
	pid, err := fs.ReadPID("server")
	if err != nil || pid != 12345 {
		t.Fatalf("ReadPID expected 12345, got %d, err: %v", pid, err)
	}
	if err := fs.RemovePID("server"); err != nil {
		t.Fatalf("RemovePID failed: %v", err)
	}
	if _, err := fs.ReadPID("server"); !os.IsNotExist(err) {
		t.Fatalf("expected os.ErrNotExist after RemovePID, got %v", err)
	}

	// 3. MediaStore tests
	ms := NewMediaStore(fs)
	testContent := []byte("hello png image data")
	filename, err := ms.SaveBytes(testContent, "png")
	if err != nil {
		t.Fatalf("SaveBytes failed: %v", err)
	}

	readBack, err := ms.ReadBytes(filename)
	if err != nil || string(readBack) != string(testContent) {
		t.Fatalf("ReadBytes mismatch or error: %v", err)
	}

	// Base64 save test with data URL
	b64Data := base64.StdEncoding.EncodeToString([]byte("jpeg image sample"))
	dataUri := "data:image/jpeg;base64," + b64Data
	fnJpg, err := ms.SaveBase64(dataUri)
	if err != nil {
		t.Fatalf("SaveBase64 failed: %v", err)
	}
	if filepath.Ext(fnJpg) != ".jpg" {
		t.Errorf("expected extension .jpg, got %s", filepath.Ext(fnJpg))
	}
}

func TestPortPersistence(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mcd-port-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	fs, err := NewFileStore(tempDir)
	if err != nil {
		t.Fatalf("NewFileStore failed: %v", err)
	}

	// Should fail before written
	if _, err := fs.ReadPort(); err == nil {
		t.Errorf("expected error reading non-existent port")
	}

	// Write port
	if err := fs.WritePort(23305); err != nil {
		t.Fatalf("WritePort failed: %v", err)
	}

	// Read port
	port, err := fs.ReadPort()
	if err != nil {
		t.Fatalf("ReadPort failed: %v", err)
	}
	if port != 23305 {
		t.Errorf("expected port 23305, got %d", port)
	}

	// Remove port
	if err := fs.RemovePort(); err != nil {
		t.Fatalf("RemovePort failed: %v", err)
	}
	if _, err := fs.ReadPort(); err == nil {
		t.Errorf("expected error after RemovePort")
	}
}
