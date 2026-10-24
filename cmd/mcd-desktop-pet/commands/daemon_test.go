package commands

import (
	"fmt"
	"net"
	"os"
	"testing"

	"mcd-desktop-pet/internal/storage"
)

func TestListenWithFallback(t *testing.T) {
	// First occupy a starting port
	baseListener, err := net.Listen("tcp", ":0")
	if err != nil {
		t.Fatalf("failed to bind test listener: %v", err)
	}
	defer baseListener.Close()

	occupiedPort := baseListener.Addr().(*net.TCPAddr).Port

	// Now call ListenWithFallback starting from occupiedPort
	fallbackListener, actualPort, err := ListenWithFallback(occupiedPort, 10)
	if err != nil {
		t.Fatalf("ListenWithFallback failed: %v", err)
	}
	defer fallbackListener.Close()

	if actualPort <= occupiedPort {
		t.Errorf("expected actualPort > %d, got %d", occupiedPort, actualPort)
	}
}

func TestGetActiveServerPort(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mcd-daemon-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	fs, err := storage.NewFileStore(tempDir)
	if err != nil {
		t.Fatalf("NewFileStore failed: %v", err)
	}

	// 1. When nothing is running and no config, returns DefaultPort
	port := GetActiveServerPort(fs)
	if port != storage.DefaultPort {
		t.Errorf("expected %d, got %d", storage.DefaultPort, port)
	}

	// 2. When config has a custom port but server is not running, returns configured port
	customPort := 25000
	cfg, _ := fs.LoadConfig()
	cfg.Port = customPort
	_ = fs.SaveConfig(cfg)

	port = GetActiveServerPort(fs)
	if port != customPort {
		t.Errorf("expected %d, got %d", customPort, port)
	}
	_ = fmt.Sprintf("tested %d", port)
}
