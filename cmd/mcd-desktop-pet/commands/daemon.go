package commands

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"time"

	"mcd-desktop-pet/internal/storage"
)

// IsProcessAlive checks if a process with given PID exists and is running.
func IsProcessAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return isProcessAlive(process)
}

// IsServerRunning checks if the server is responding to health check.
func IsServerRunning(port int) bool {
	client := http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Get(fmt.Sprintf("http://localhost:%d/api/health", port))
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// GetActiveServerPort determines the active port for the server.
// Priority:
// 1. Port saved in run/server.port if responsive
// 2. Port configured in config.json if responsive
// 3. Probing consecutive range [preferredPort, preferredPort+20] to catch auto-shifted servers
// 4. Default to config.Port or storage.DefaultPort
func GetActiveServerPort(fs *storage.FileStore) int {
	// 1. Runtime server.port
	if p, err := fs.ReadPort(); err == nil && p > 0 {
		if IsServerRunning(p) {
			return p
		}
	}

	// 2. config.json port
	cfg, err := fs.LoadConfig()
	preferredPort := storage.DefaultPort
	if err == nil && cfg.Port > 0 {
		preferredPort = cfg.Port
		if IsServerRunning(preferredPort) {
			return preferredPort
		}
	}

	// 3. Probing consecutive range in case server auto-shifted
	for i := 1; i <= 20; i++ {
		candidate := preferredPort + i
		if candidate <= 65535 && IsServerRunning(candidate) {
			return candidate
		}
	}

	return preferredPort
}

// ListenWithFallback attempts to bind a TCP listener starting at startPort.
// If the port is already occupied (conflict), it automatically shifts to startPort+1, +2, etc.
// Returns the active listener and the actual port bound.
func ListenWithFallback(startPort int, maxAttempts int) (net.Listener, int, error) {
	if startPort <= 0 {
		startPort = storage.DefaultPort
	}
	if maxAttempts <= 0 {
		maxAttempts = 100
	}

	for i := 0; i < maxAttempts; i++ {
		candidate := startPort + i
		if candidate > 65535 {
			break
		}
		addr := fmt.Sprintf(":%d", candidate)
		listener, err := net.Listen("tcp", addr)
		if err == nil {
			tcpAddr, ok := listener.Addr().(*net.TCPAddr)
			if ok {
				return listener, tcpAddr.Port, nil
			}
			return listener, candidate, nil
		}
	}
	return nil, 0, fmt.Errorf("failed to bind to any available port from %d to %d", startPort, startPort+maxAttempts-1)
}

// EnsureServerStarted ensures the server background daemon is running.
func EnsureServerStarted(fs *storage.FileStore) (int, error) {
	port := GetActiveServerPort(fs)
	if IsServerRunning(port) {
		pid, _ := fs.ReadPID("server")
		return pid, nil
	}

	// Spawn background server daemon
	exePath, err := os.Executable()
	if err != nil {
		return 0, fmt.Errorf("unable to determine executable path: %w", err)
	}

	cmd := exec.Command(exePath, "__serve")
	cmd.SysProcAttr = getSysProcAttr()
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return 0, fmt.Errorf("failed to start server process: %w", err)
	}

	_ = fs.WritePID("server", cmd.Process.Pid)

	// Wait up to 3 seconds for server to be ready on active port
	start := time.Now()
	for time.Since(start) < 3*time.Second {
		activePort := GetActiveServerPort(fs)
		if IsServerRunning(activePort) {
			return cmd.Process.Pid, nil
		}
		time.Sleep(100 * time.Millisecond)
	}

	return cmd.Process.Pid, nil
}

// DoServerRequest performs an HTTP request to the local server.
func DoServerRequest(method, path string, body any, result any) error {
	fs, err := storage.NewFileStore("")
	if err != nil {
		return err
	}
	port := GetActiveServerPort(fs)

	url := fmt.Sprintf("http://localhost:%d%s", port, path)

	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBytes, _ := io.ReadAll(resp.Body)
		var errObj struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(respBytes, &errObj) == nil && errObj.Error != "" {
			return fmt.Errorf("%s", errObj.Error)
		}
		return fmt.Errorf("server error: HTTP %d", resp.StatusCode)
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}
