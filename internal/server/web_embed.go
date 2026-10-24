package server

import (
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
)

var globalWebFS fs.FS

// SetWebFS sets the global filesystem for the web UI.
func SetWebFS(f fs.FS) {
	globalWebFS = f
}

// SpaHandler serves static assets from embedded fs.FS with SPA Fallback to index.html.
func SpaHandler(staticFS fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if staticFS == nil {
			http.Error(w, "Web UI assets not embedded", http.StatusNotFound)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		// Try opening requested file
		file, err := staticFS.Open(path)
		if err != nil {
			// SPA Fallback: serve index.html for non-existent routes
			indexFile, indexErr := staticFS.Open("index.html")
			if indexErr != nil {
				http.NotFound(w, r)
				return
			}
			defer indexFile.Close()

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = io.Copy(w, indexFile)
			return
		}
		defer file.Close()

		stat, err := file.Stat()
		if err != nil || stat.IsDir() {
			// Directory request fallback
			indexFile, indexErr := staticFS.Open("index.html")
			if indexErr != nil {
				http.NotFound(w, r)
				return
			}
			defer indexFile.Close()

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = io.Copy(w, indexFile)
			return
		}

		// Set proper Content-Type
		ext := filepath.Ext(path)
		mimeType := mime.TypeByExtension(ext)
		if mimeType != "" {
			w.Header().Set("Content-Type", mimeType)
		}

		if rs, ok := file.(io.ReadSeeker); ok {
			http.ServeContent(w, r, stat.Name(), stat.ModTime(), rs)
		} else {
			_, _ = io.Copy(w, file)
		}
	})
}
