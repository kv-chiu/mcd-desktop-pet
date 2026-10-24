package selfheal

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestHealWithHome_Unix(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Skipping unix-specific test on windows")
	}

	tempDir := t.TempDir()
	homeDir := filepath.Join(tempDir, "home")
	_ = os.MkdirAll(homeDir, 0o755)

	// Create fake shell rc
	zshrc := filepath.Join(homeDir, ".zshrc")
	_ = os.WriteFile(zshrc, []byte("# existing config\n"), 0o644)

	// 1. Initial location
	exe1 := filepath.Join(tempDir, "v1", "mcd-desktop-pet")
	_ = os.MkdirAll(filepath.Dir(exe1), 0o755)
	_ = os.WriteFile(exe1, []byte("#!/bin/sh\necho v1\n"), 0o755)

	err := HealWithHome(exe1, homeDir)
	if err != nil {
		t.Fatalf("HealWithHome failed: %v", err)
	}

	localLink := filepath.Join(homeDir, ".local", "bin", "mcd-desktop-pet")
	target, err := os.Readlink(localLink)
	if err != nil {
		t.Fatalf("Readlink failed: %v", err)
	}
	if target != exe1 {
		t.Errorf("Expected link target %s, got %s", exe1, target)
	}

	// Verify shell rc injection
	rcBytes, _ := os.ReadFile(zshrc)
	if !strings.Contains(string(rcBytes), pathMarkerStart) {
		t.Errorf("Expected PATH injection in zshrc, got:\n%s", string(rcBytes))
	}

	// 2. Binary moves to a new location (e.g. moved from Downloads to /Applications)
	exe2 := filepath.Join(tempDir, "v2_Applications", "mcd-desktop-pet")
	_ = os.MkdirAll(filepath.Dir(exe2), 0o755)
	_ = os.WriteFile(exe2, []byte("#!/bin/sh\necho v2\n"), 0o755)

	err = HealWithHome(exe2, homeDir)
	if err != nil {
		t.Fatalf("Second HealWithHome failed: %v", err)
	}

	// Verify self-healing: link target should now be updated to exe2!
	target2, err := os.Readlink(localLink)
	if err != nil {
		t.Fatalf("Readlink after move failed: %v", err)
	}
	if target2 != exe2 {
		t.Errorf("Self-healing failed: expected link to update to %s, but got %s", exe2, target2)
	}

	// 3. Re-running when already matching should be idempotent and no error
	err = HealWithHome(exe2, homeDir)
	if err != nil {
		t.Fatalf("Third HealWithHome failed: %v", err)
	}
}

func TestHealWindows_Wrappers(t *testing.T) {
	tempDir := t.TempDir()
	homeDir := filepath.Join(tempDir, "home")

	exe1 := filepath.Join(tempDir, "v1", "mcd-desktop-pet.exe")
	_ = os.MkdirAll(filepath.Dir(exe1), 0o755)
	_ = os.WriteFile(exe1, []byte("fake exe"), 0o755)

	err := healWindows(exe1, homeDir)
	if err != nil {
		t.Fatalf("healWindows failed: %v", err)
	}

	cmdFile := filepath.Join(homeDir, ".mcd-desktop-pet", "bin", "mcd-desktop-pet.cmd")
	content, err := os.ReadFile(cmdFile)
	if err != nil {
		t.Fatalf("ReadFile failed: %v", err)
	}
	if !strings.Contains(string(content), exe1) {
		t.Errorf("Expected cmd wrapper to point to %s, got:\n%s", exe1, string(content))
	}

	// Move to new location
	exe2 := filepath.Join(tempDir, "v2", "mcd-desktop-pet.exe")
	_ = os.MkdirAll(filepath.Dir(exe2), 0o755)
	_ = os.WriteFile(exe2, []byte("fake exe 2"), 0o755)

	err = healWindows(exe2, homeDir)
	if err != nil {
		t.Fatalf("healWindows 2 failed: %v", err)
	}

	content2, _ := os.ReadFile(cmdFile)
	if !strings.Contains(string(content2), exe2) {
		t.Errorf("Expected cmd wrapper to self-heal to %s, got:\n%s", exe2, string(content2))
	}
}
