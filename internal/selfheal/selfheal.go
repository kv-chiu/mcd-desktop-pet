package selfheal

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

const (
	pathMarkerStart = "# >>> mcd-desktop-pet cli >>>"
	pathMarkerEnd   = "# <<< mcd-desktop-pet cli <<<"
)

// EnsureSelfHealing inspects the current executable location and ensures that
// the CLI shortcuts/symlinks and user PATH always point to this active binary.
// If the application was moved, renamed, or upgraded, the shortcuts are atomically updated.
func EnsureSelfHealing() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	canonicalExe, err := filepath.EvalSymlinks(exePath)
	if err == nil && canonicalExe != "" {
		exePath = canonicalExe
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get user home dir: %w", err)
	}

	return HealWithHome(exePath, homeDir)
}

// HealWithHome executes the self-healing routine for a given executable and home directory.
func HealWithHome(exePath, homeDir string) error {
	if runtime.GOOS == "windows" {
		return healWindows(exePath, homeDir)
	}
	return healUnix(exePath, homeDir)
}

func healUnix(exePath, homeDir string) error {
	localBin := filepath.Join(homeDir, ".local", "bin")
	appBin := filepath.Join(homeDir, ".mcd-desktop-pet", "bin")

	// Target 1: ~/.local/bin/mcd-desktop-pet
	_ = updateSymlink(exePath, filepath.Join(localBin, "mcd-desktop-pet"))

	// Target 2: ~/.mcd-desktop-pet/bin/mcd-desktop-pet
	_ = updateSymlink(exePath, filepath.Join(appBin, "mcd-desktop-pet"))

	// Ensure PATH in Unix shell rc files
	ensureUnixShellPath(homeDir, localBin, appBin)

	return nil
}

func updateSymlink(targetExe, linkPath string) error {
	if err := os.MkdirAll(filepath.Dir(linkPath), 0o755); err != nil {
		return err
	}

	curTarget, err := os.Readlink(linkPath)
	if err == nil {
		if curTarget == targetExe {
			// Already pointing to the exact current binary, no-op
			return nil
		}
		// Outdated target or moved location: remove and recreate
		_ = os.Remove(linkPath)
	} else if !os.IsNotExist(err) {
		// Existing non-symlink file or corrupted link
		_ = os.Remove(linkPath)
	}

	return os.Symlink(targetExe, linkPath)
}

func ensureUnixShellPath(homeDir, localBin, appBin string) {
	rcFiles := []string{
		filepath.Join(homeDir, ".zshrc"),
		filepath.Join(homeDir, ".bashrc"),
		filepath.Join(homeDir, ".bash_profile"),
		filepath.Join(homeDir, ".profile"),
	}

	for _, rc := range rcFiles {
		content, err := os.ReadFile(rc)
		if err != nil {
			// File doesn't exist, don't create nonexistent rc files unnecessarily
			continue
		}

		if strings.Contains(string(content), pathMarkerStart) {
			continue
		}

		// Append PATH configuration block
		injection := fmt.Sprintf("\n%s\nexport PATH=\"%s:%s:$PATH\"\n%s\n",
			pathMarkerStart, localBin, appBin, pathMarkerEnd)

		f, err := os.OpenFile(rc, os.O_APPEND|os.O_WRONLY, 0o644)
		if err == nil {
			_, _ = f.WriteString(injection)
			_ = f.Close()
		}
	}
}

func healWindows(exePath, homeDir string) error {
	appBin := filepath.Join(homeDir, ".mcd-desktop-pet", "bin")
	_ = os.MkdirAll(appBin, 0o755)

	// Create/Update mcd-desktop-pet.cmd wrapper
	cmdWrapper := fmt.Sprintf("@echo off\r\n\"%s\" %%*\r\n", exePath)
	targetFile := filepath.Join(appBin, "mcd-desktop-pet.cmd")
	existing, err := os.ReadFile(targetFile)
	if err != nil || string(existing) != cmdWrapper {
		_ = os.WriteFile(targetFile, []byte(cmdWrapper), 0o755)
	}

	// Try symlink as well if supported/permitted
	exeSymlink := filepath.Join(appBin, "mcd-desktop-pet.exe")
	curTarget, err := os.Readlink(exeSymlink)
	if err == nil {
		if curTarget != exePath {
			_ = os.Remove(exeSymlink)
			_ = os.Symlink(exePath, exeSymlink)
		}
	} else if os.IsNotExist(err) {
		_ = os.Symlink(exePath, exeSymlink)
	}

	// Ensure appBin in User PATH
	ensureWindowsUserPath(appBin)

	return nil
}

func ensureWindowsUserPath(binDir string) {
	normBin := filepath.Clean(binDir)
	psCmd := fmt.Sprintf(`
	$p = [Environment]::GetEnvironmentVariable('Path', 'User')
	if (-not $p) {
		[Environment]::SetEnvironmentVariable('Path', '%s', 'User')
	} elseif (-not ($p.Split(';') -contains '%s')) {
		$newPath = $p.TrimEnd(';') + ';%s'
		[Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
	}
	`, normBin, normBin, normBin)

	cmd := exec.Command("powershell", "-NoProfile", "-Command", psCmd)
	_ = cmd.Run()
}
