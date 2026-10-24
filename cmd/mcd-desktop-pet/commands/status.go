package commands

import (
	"github.com/spf13/cobra"

	"mcd-desktop-pet/internal/embedder"
	"mcd-desktop-pet/internal/storage"
)

// NewStatusCommand returns the status command.
func NewStatusCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Check running status of server and desktop pet",
		Run: func(cmd *cobra.Command, args []string) {
			RunStatus()
		},
	}
}

// RunStatus outputs JSON status for server and pet.
func RunStatus() {
	fs, err := storage.NewFileStore("")
	if err != nil {
		PrintErrorJSON(err)
		return
	}

	cfg, _ := fs.LoadConfig()
	serverPid, _ := fs.ReadPID("server")
	port := GetActiveServerPort(fs)
	serverRunning := IsServerRunning(port)

	pm := embedder.NewProcessManager(fs)
	petRunning := pm.IsPetRunning()
	petPid, _ := fs.ReadPID("pet")

	PrintJSON(map[string]any{
		"server_running": serverRunning,
		"server_pid":     serverPid,
		"pet_running":    petRunning,
		"pet_pid":        petPid,
		"port":           port,
		"theme":          cfg.Theme,
	})
}
