package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

const (
	DefaultDirName = ".mcd-desktop-pet"
	ConfigFileName = "config.json"
	DefaultPort    = 23301
	ThemeMcDonalds = "mcdonalds"
	ThemePure      = "pure"
)

// AppConfig represents persistent application configuration.
type AppConfig struct {
	Theme        string  `json:"theme"`
	Port         int     `json:"port"`
	AutoStart    bool    `json:"auto_start"`
	SoundEnabled bool    `json:"sound_enabled"`
	Volume       int     `json:"volume"`
	PetScale     float64 `json:"pet_scale"`
}

// DefaultConfig returns the default application configuration.
func DefaultConfig() AppConfig {
	return AppConfig{
		Theme:        ThemeMcDonalds,
		Port:         DefaultPort,
		AutoStart:    false,
		SoundEnabled: true,
		Volume:       80,
		PetScale:     1.0,
	}
}

// FileStore manages atomic JSON read/write persistence on the local filesystem.
type FileStore struct {
	mu      sync.RWMutex
	baseDir string
}

// NewFileStore creates a FileStore instance.
// If customDir is empty, it uses ~/.mcd-desktop-pet or MCD_DATA_DIR.
func NewFileStore(customDir string) (*FileStore, error) {
	dir := customDir
	if dir == "" {
		if envDir := os.Getenv("MCD_DATA_DIR"); envDir != "" {
			dir = envDir
		} else {
			home, err := os.UserHomeDir()
			if err != nil {
				return nil, fmt.Errorf("unable to determine user home directory: %w", err)
			}
			dir = filepath.Join(home, DefaultDirName)
		}
	}

	// Ensure required subdirectories exist
	subdirs := []string{"", "media", "bin", "run", "logs"}
	for _, sub := range subdirs {
		target := filepath.Join(dir, sub)
		if err := os.MkdirAll(target, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory %s: %w", target, err)
		}
	}

	return &FileStore{baseDir: dir}, nil
}

// BaseDir returns the root storage directory.
func (fs *FileStore) BaseDir() string {
	return fs.baseDir
}

// LogsDir returns the logs directory path.
func (fs *FileStore) LogsDir() string {
	return filepath.Join(fs.baseDir, "logs")
}

// MediaDir returns the media directory path.
func (fs *FileStore) MediaDir() string {
	return filepath.Join(fs.baseDir, "media")
}

// BinDir returns the runtime binary cache directory.
func (fs *FileStore) BinDir() string {
	return filepath.Join(fs.baseDir, "bin")
}

// RunDir returns the process pid directory.
func (fs *FileStore) RunDir() string {
	return filepath.Join(fs.baseDir, "run")
}

// AtomicWriteJSON marshals data to indented JSON and writes it atomically via temporary file rename.
func (fs *FileStore) AtomicWriteJSON(filename string, data any) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	targetPath := filepath.Join(fs.baseDir, filename)
	tmpPath := fmt.Sprintf("%s.tmp.%d", targetPath, os.Getpid())

	if err := os.WriteFile(tmpPath, bytes, 0644); err != nil {
		return fmt.Errorf("failed to write tmp file %s: %w", tmpPath, err)
	}

	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to rename %s to %s: %w", tmpPath, targetPath, err)
	}

	return nil
}

// ReadJSON reads and unmarshals JSON from a file. If file does not exist, returns os.ErrNotExist.
func (fs *FileStore) ReadJSON(filename string, target any) error {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	targetPath := filepath.Join(fs.baseDir, filename)
	data, err := os.ReadFile(targetPath)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("failed to unmarshal JSON from %s: %w", targetPath, err)
	}

	return nil
}

// LoadConfig loads the application config, or writes default config if it doesn't exist yet.
func (fs *FileStore) LoadConfig() (AppConfig, error) {
	var cfg AppConfig
	err := fs.ReadJSON(ConfigFileName, &cfg)
	if err != nil {
		if os.IsNotExist(err) {
			cfg = DefaultConfig()
			if saveErr := fs.AtomicWriteJSON(ConfigFileName, cfg); saveErr != nil {
				return cfg, saveErr
			}
			return cfg, nil
		}
		return cfg, err
	}

	// Fallback check for missing theme and scale
	if cfg.Theme == "" {
		cfg.Theme = ThemeMcDonalds
	}
	if cfg.Port == 0 || cfg.Port == 3001 {
		cfg.Port = DefaultPort
	}
	if cfg.PetScale <= 0 {
		cfg.PetScale = 1.0
	} else if cfg.PetScale < 0.5 {
		cfg.PetScale = 0.5
	} else if cfg.PetScale > 2.0 {
		cfg.PetScale = 2.0
	}

	return cfg, nil
}

// SaveConfig atomically updates config.json.
func (fs *FileStore) SaveConfig(cfg AppConfig) error {
	if cfg.Theme == "" {
		cfg.Theme = ThemeMcDonalds
	}
	if cfg.Port == 0 {
		cfg.Port = DefaultPort
	}
	if cfg.PetScale <= 0 {
		cfg.PetScale = 1.0
	} else if cfg.PetScale < 0.5 {
		cfg.PetScale = 0.5
	} else if cfg.PetScale > 2.0 {
		cfg.PetScale = 2.0
	}
	return fs.AtomicWriteJSON(ConfigFileName, cfg)
}

// WritePID atomically writes a process ID to a .pid file in the run directory.
func (fs *FileStore) WritePID(name string, pid int) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	targetPath := filepath.Join(fs.RunDir(), fmt.Sprintf("%s.pid", name))
	tmpPath := fmt.Sprintf("%s.tmp.%d", targetPath, os.Getpid())

	if err := os.WriteFile(tmpPath, []byte(strconv.Itoa(pid)), 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, targetPath)
}

// ReadPID reads a process ID from a .pid file.
func (fs *FileStore) ReadPID(name string) (int, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	targetPath := filepath.Join(fs.RunDir(), fmt.Sprintf("%s.pid", name))
	data, err := os.ReadFile(targetPath)
	if err != nil {
		return 0, err
	}

	pidStr := strings.TrimSpace(string(data))
	pid, err := strconv.Atoi(pidStr)
	if err != nil {
		return 0, fmt.Errorf("invalid PID string %q: %w", pidStr, err)
	}

	return pid, nil
}

// RemovePID removes the .pid file.
func (fs *FileStore) RemovePID(name string) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	targetPath := filepath.Join(fs.RunDir(), fmt.Sprintf("%s.pid", name))
	err := os.Remove(targetPath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// WritePort atomically writes the active server port to server.port in the run directory.
func (fs *FileStore) WritePort(port int) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	targetPath := filepath.Join(fs.RunDir(), "server.port")
	tmpPath := fmt.Sprintf("%s.tmp.%d", targetPath, os.Getpid())

	if err := os.WriteFile(tmpPath, []byte(strconv.Itoa(port)), 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, targetPath)
}

// ReadPort reads the active server port from server.port in the run directory.
func (fs *FileStore) ReadPort() (int, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	targetPath := filepath.Join(fs.RunDir(), "server.port")
	data, err := os.ReadFile(targetPath)
	if err != nil {
		return 0, err
	}

	portStr := strings.TrimSpace(string(data))
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return 0, fmt.Errorf("invalid port string %q: %w", portStr, err)
	}

	return port, nil
}

// RemovePort removes the server.port file.
func (fs *FileStore) RemovePort() error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	targetPath := filepath.Join(fs.RunDir(), "server.port")
	err := os.Remove(targetPath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
