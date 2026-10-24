package embedder

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"

	"mcd-desktop-pet/internal/storage"
)

var (
	// EmbeddedDesktopFS can be set during release build to embed Godot export bundle.
	EmbeddedDesktopFS fs.FS
)

// ProcessManager manages the lifecycle of the desktop Godot process.
type ProcessManager struct {
	mu        sync.Mutex
	fileStore *storage.FileStore
	cmd       *exec.Cmd
}

// NewProcessManager creates a ProcessManager.
func NewProcessManager(fs *storage.FileStore) *ProcessManager {
	return &ProcessManager{fileStore: fs}
}

// IsPetRunning checks if Godot desktop process is currently active.
func (pm *ProcessManager) IsPetRunning() bool {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pid, err := pm.fileStore.ReadPID("pet")
	if err != nil || pid <= 0 {
		return false
	}

	// Check if process is still alive
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	if isProcessRunning(process) {
		return true
	}

	// Stale pid file
	_ = pm.fileStore.RemovePID("pet")
	return false
}

// Start launches the Godot desktop process.
// If already running, returns nil without launching a duplicate instance.
func (pm *ProcessManager) Start() error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.isPetRunningLocked() {
		return nil
	}

	execPath, args, err := pm.resolveDesktopExecutable()
	if err != nil {
		return err
	}

	cmd := exec.Command(execPath, args...)
	cmd.SysProcAttr = getDesktopSysProcAttr()

	activePort, portErr := pm.fileStore.ReadPort()
	if portErr != nil || activePort <= 0 {
		if cfg, err := pm.fileStore.LoadConfig(); err == nil && cfg.Port > 0 {
			activePort = cfg.Port
		} else {
			activePort = storage.DefaultPort
		}
	}
	cmd.Env = append(os.Environ(), fmt.Sprintf("MCD_SERVER_PORT=%d", activePort))

	if os.Getenv("MCD_DEBUG") == "1" {
		cmd.Stdout = os.Stderr
		cmd.Stderr = os.Stderr
	} else {
		logDir := pm.fileStore.LogsDir()
		logPath := filepath.Join(logDir, "desktop.log")
		logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
		if err == nil {
			cmd.Stdout = logFile
			cmd.Stderr = logFile
		}
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start desktop pet process: %w", err)
	}

	pm.cmd = cmd
	_ = pm.fileStore.WritePID("pet", cmd.Process.Pid)

	// Clean up PID on process exit
	go func() {
		_ = cmd.Wait()
		pm.mu.Lock()
		defer pm.mu.Unlock()
		pm.cmd = nil
		_ = pm.fileStore.RemovePID("pet")
	}()

	return nil
}

// Stop gracefully terminates the desktop Godot process.
func (pm *ProcessManager) Stop() error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pid, err := pm.fileStore.ReadPID("pet")
	if err != nil || pid <= 0 {
		return nil
	}

	process, err := os.FindProcess(pid)
	if err != nil {
		_ = pm.fileStore.RemovePID("pet")
		return nil
	}

	// Terminate process
	_ = terminateProcess(process)

	// Clean up PID file
	_ = pm.fileStore.RemovePID("pet")
	pm.cmd = nil
	return nil
}

func (pm *ProcessManager) isPetRunningLocked() bool {
	pid, err := pm.fileStore.ReadPID("pet")
	if err != nil || pid <= 0 {
		return false
	}
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return isProcessRunning(process)
}

// resolveDesktopExecutable finds or extracts the desktop pet executable.
func (pm *ProcessManager) resolveDesktopExecutable() (string, []string, error) {
	// If embedded assets exist, extract to binDir if hash differs
	if EmbeddedDesktopFS != nil {
		binPath, err := pm.extractEmbeddedDesktop()
		if err == nil && binPath != "" {
			return binPath, nil, nil
		}
	}

	// In development, check if local `desktop/` directory exists
	// Look up "godot" command
	godotPath, err := exec.LookPath("godot")
	if err == nil {
		// Check for desktop/project.godot relative to current working dir or executable
		candidates := []string{
			"desktop",
			"../desktop",
			"../../desktop",
		}
		for _, cand := range candidates {
			proj := filepath.Join(cand, "project.godot")
			if _, err := os.Stat(proj); err == nil {
				absCand, _ := filepath.Abs(cand)
				return godotPath, []string{"--path", absCand}, nil
			}
		}
	}

	// Check if a prebuilt binary exists in bin directory
	binName := "mcd-pet-runtime"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}
	localBin := filepath.Join(pm.fileStore.BinDir(), binName)
	if _, err := os.Stat(localBin); err == nil {
		return localBin, nil, nil
	}

	return "", nil, fmt.Errorf("godot desktop client runtime not found (neither embedded nor local godot project)")
}

func (pm *ProcessManager) extractEmbeddedDesktop() (string, error) {
	// Check embedded files
	entries, err := fs.ReadDir(EmbeddedDesktopFS, ".")
	if err != nil || len(entries) == 0 {
		return "", fmt.Errorf("embedded desktop filesystem empty")
	}

	binName := "mcd-pet-runtime"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}
	targetPath := filepath.Join(pm.fileStore.BinDir(), binName)

	// Check if we need to extract by computing checksum
	var srcFile fs.File
	var srcEntryName string
	for _, entry := range entries {
		if !entry.IsDir() {
			srcEntryName = entry.Name()
			srcFile, _ = EmbeddedDesktopFS.Open(entry.Name())
			break
		}
	}
	if srcFile == nil {
		return "", fmt.Errorf("no executable in embedded desktop FS")
	}
	defer srcFile.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, srcFile); err != nil {
		return "", err
	}
	expectedHash := hex.EncodeToString(hasher.Sum(nil))

	// Compare with existing binary if present
	if existingData, err := os.ReadFile(targetPath); err == nil {
		existingHash := sha256.Sum256(existingData)
		if hex.EncodeToString(existingHash[:]) == expectedHash {
			return targetPath, nil
		}
	}

	// Extract new binary
	srcFile2, err := EmbeddedDesktopFS.Open(srcEntryName)
	if err != nil {
		return "", err
	}
	defer srcFile2.Close()

	tmpPath := fmt.Sprintf("%s.tmp.%d", targetPath, os.Getpid())
	out, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(out, srcFile2); err != nil {
		_ = out.Close()
		_ = os.Remove(tmpPath)
		return "", err
	}
	_ = out.Close()

	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return "", err
	}

	return targetPath, nil
}
