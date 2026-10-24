package commands

import (
	"fmt"
	"os/exec"
	"runtime"

	"github.com/spf13/cobra"

	"mcd-desktop-pet/internal/storage"
)

// NewWebCommand returns the web command.
func NewWebCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "web",
		Short: "Open the web dashboard in browser (auto-starts server if needed)",
		Run: func(cmd *cobra.Command, args []string) {
			RunWeb()
		},
	}
}

// RunWeb opens the web dashboard, starting the server if necessary without requiring desktop pet.
func RunWeb() {
	fs, err := storage.NewFileStore("")
	if err != nil {
		PrintErrorJSON(err)
		return
	}

	port := GetActiveServerPort(fs)
	wasRunning := IsServerRunning(port)
	if !wasRunning {
		_, err := EnsureServerStarted(fs)
		if err != nil {
			PrintErrorJSON(err)
			return
		}
		port = GetActiveServerPort(fs)
	}

	url := fmt.Sprintf("http://localhost:%d", port)
	_ = openBrowser(url)

	PrintJSON(map[string]any{
		"status":         "opened",
		"url":            url,
		"server_started": !wasRunning,
	})
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
