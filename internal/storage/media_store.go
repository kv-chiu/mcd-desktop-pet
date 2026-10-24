package storage

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// MediaStore manages media storage (e.g. pasted screenshots and attachments) for notes.
type MediaStore struct {
	fileStore *FileStore
}

// NewMediaStore creates a MediaStore associated with the given FileStore.
func NewMediaStore(fs *FileStore) *MediaStore {
	return &MediaStore{fileStore: fs}
}

// SaveBytes computes sha256 of data, writes it to media/<hash>.<ext>, and returns the filename.
func (ms *MediaStore) SaveBytes(data []byte, ext string) (string, error) {
	if len(data) == 0 {
		return "", fmt.Errorf("empty media data")
	}

	cleanExt := strings.TrimPrefix(ext, ".")
	if cleanExt == "" {
		cleanExt = "png"
	}

	hash := sha256.Sum256(data)
	filename := fmt.Sprintf("%s.%s", hex.EncodeToString(hash[:]), cleanExt)
	destPath := filepath.Join(ms.fileStore.MediaDir(), filename)

	// If file already exists with same sha256, skip re-writing
	if _, err := os.Stat(destPath); err == nil {
		return filename, nil
	}

	tmpPath := fmt.Sprintf("%s.tmp.%d", destPath, os.Getpid())
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write media file %s: %w", tmpPath, err)
	}

	if err := os.Rename(tmpPath, destPath); err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("failed to save media file %s: %w", destPath, err)
	}

	return filename, nil
}

// SaveBase64 decodes data URI or raw base64 string and saves it.
func (ms *MediaStore) SaveBase64(base64Str string) (string, error) {
	ext := "png"
	raw := base64Str

	// Handle data URL prefix, e.g. "data:image/jpeg;base64,..."
	if idx := strings.Index(base64Str, ","); idx != -1 {
		header := base64Str[:idx]
		raw = base64Str[idx+1:]
		if strings.Contains(header, "image/jpeg") || strings.Contains(header, "image/jpg") {
			ext = "jpg"
		} else if strings.Contains(header, "image/gif") {
			ext = "gif"
		} else if strings.Contains(header, "image/webp") {
			ext = "webp"
		}
	}

	data, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return "", fmt.Errorf("invalid base64 media content: %w", err)
	}

	return ms.SaveBytes(data, ext)
}

// GetPath returns the absolute filesystem path for a media filename.
func (ms *MediaStore) GetPath(filename string) string {
	cleanName := filepath.Base(filename)
	return filepath.Join(ms.fileStore.MediaDir(), cleanName)
}

// ReadBytes reads the binary data for a given media filename.
func (ms *MediaStore) ReadBytes(filename string) ([]byte, error) {
	return os.ReadFile(ms.GetPath(filename))
}
