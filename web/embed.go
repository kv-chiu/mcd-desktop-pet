package web

import (
	"embed"
	"io/fs"
)

// DistFS embeds all production build assets from the dist directory.
//
//go:embed all:dist
var DistFS embed.FS

// GetSubFS returns the sub-filesystem scoped to "dist".
func GetSubFS() (fs.FS, error) {
	return fs.Sub(DistFS, "dist")
}
