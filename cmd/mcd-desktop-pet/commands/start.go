package commands

import (
	"github.com/spf13/cobra"

	"mcd-desktop-pet/internal/embedder"
	"mcd-desktop-pet/internal/selfheal"
	"mcd-desktop-pet/internal/storage"
)

// NewStartCommand returns the start command.
func NewStartCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "start",
		Short: "Start the background server and desktop pet",
		Run: func(cmd *cobra.Command, args []string) {
			RunStart()
		},
	}
}

// RunStart starts both the server and desktop pet, reusing existing instances if running.
func RunStart() {
	_ = selfheal.EnsureSelfHealing()

	fs, err := storage.NewFileStore("")

	if err != nil {
		PrintErrorJSON(err)
		return
	}

	cfg, err := fs.LoadConfig()
	if err != nil {
		PrintErrorJSON(err)
		return
	}

	port := GetActiveServerPort(fs)
	alreadyRunning := IsServerRunning(port)
	serverPid, err := EnsureServerStarted(fs)
	if err != nil {
		PrintErrorJSON(err)
		return
	}
	port = GetActiveServerPort(fs)

	pm := embedder.NewProcessManager(fs)
	petWasRunning := pm.IsPetRunning()
	if !petWasRunning {
		// Launch pet
		_ = pm.Start()
	}

	statusStr := "started"
	if alreadyRunning && petWasRunning {
		statusStr = "already_running"
	}

	PrintJSON(map[string]any{
		"status":      statusStr,
		"server_pid":  serverPid,
		"pet_running": pm.IsPetRunning(),
		"port":        port,
		"theme":       cfg.Theme,
	})
}
