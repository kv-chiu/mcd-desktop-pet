package commands

import (
	"os"

	"github.com/spf13/cobra"

	"mcd-desktop-pet/internal/embedder"
	"mcd-desktop-pet/internal/storage"
)

// NewStopCommand returns the stop command.
func NewStopCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "stop",
		Short: "Stop the background server and desktop pet",
		Run: func(cmd *cobra.Command, args []string) {
			RunStop()
		},
	}
}

// RunStop terminates server and pet processes.
func RunStop() {
	fs, err := storage.NewFileStore("")
	if err != nil {
		PrintErrorJSON(err)
		return
	}

	pm := embedder.NewProcessManager(fs)
	_ = pm.Stop()

	serverStopped := false
	serverPid, err := fs.ReadPID("server")
	if err == nil && serverPid > 0 {
		if proc, err := os.FindProcess(serverPid); err == nil {
			_ = killProcess(proc)
			serverStopped = true
		}
		_ = fs.RemovePID("server")
	}
	_ = fs.RemovePort()

	PrintJSON(map[string]any{
		"status":         "stopped",
		"server_stopped": serverStopped,
		"pet_stopped":    true,
	})
}
