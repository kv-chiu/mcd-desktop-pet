package commands

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/spf13/cobra"

	"mcd-desktop-pet/internal/embedder"
	"mcd-desktop-pet/internal/extensions"
	"mcd-desktop-pet/internal/notes"
	"mcd-desktop-pet/internal/pet"
	"mcd-desktop-pet/internal/server"
	"mcd-desktop-pet/internal/storage"
	"mcd-desktop-pet/internal/ws"
	"mcd-desktop-pet/web"
)

// NewServeCommand creates the internal background server command.
func NewServeCommand() *cobra.Command {
	return &cobra.Command{
		Use:    "__serve",
		Hidden: true, // internal background daemon
		Run: func(cmd *cobra.Command, args []string) {
			RunServerDaemon()
		},
	}
}

// RunServerDaemon starts the HTTP & WebSocket server, loads config, and runs until terminated.
func RunServerDaemon() {
	fs, err := storage.NewFileStore("")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialize storage: %v\n", err)
		os.Exit(1)
	}

	cfg, err := fs.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Set embedded web filesystem
	if subFS, err := web.GetSubFS(); err == nil {
		server.SetWebFS(subFS)
	}

	notesMgr, err := notes.NewManager(fs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialize notes: %v\n", err)
		os.Exit(1)
	}

	reg := extensions.Default()
	wsHub := ws.NewHub(reg)

	petSM, err := pet.NewStateMachine(fs, func(s pet.State) {
		wsHub.Broadcast("pet_state_update", s)
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialize pet state machine: %v\n", err)
		os.Exit(1)
	}

	// Register WebSocket message handlers
	wsHub.On("pet_click", func(client *ws.Client, msg ws.Message, raw []byte) {
		action, _ := petSM.OnClick()
		wsHub.Broadcast("pet_action", map[string]any{
			"action": action,
			"state":  petSM.GetState(),
		})
	})
	wsHub.On("action_completed", func(client *ws.Client, msg ws.Message, raw []byte) {
		_ = petSM.OnActionCompleted()
		wsHub.Broadcast("pet_state_update", petSM.GetState())
	})
	wsHub.On("toggle_visibility", func(client *ws.Client, msg ws.Message, raw []byte) {
		visible, _ := petSM.ToggleVisibility()
		wsHub.Broadcast("visibility_changed", map[string]bool{"visible": visible})
	})
	wsHub.On("note_position_sync", func(client *ws.Client, msg ws.Message, raw []byte) {
		if m, ok := msg.Payload.(map[string]any); ok {
			id, _ := m["id"].(string)
			if id != "" {
				var pos, size [2]int
				if p, ok := m["position"].([]any); ok && len(p) == 2 {
					pos = [2]int{int(p[0].(float64)), int(p[1].(float64))}
				}
				if s, ok := m["size"].([]any); ok && len(s) == 2 {
					size = [2]int{int(s[0].(float64)), int(s[1].(float64))}
				}
				_ = notesMgr.UpdatePositionSize(id, pos, size)
			}
		}
	})

	srv := server.NewServer(fs, notesMgr, petSM, wsHub, reg)
	shutdownTriggered := make(chan struct{}, 1)
	srv.SetOnShutdown(func() {
		select {
		case shutdownTriggered <- struct{}{}:
		default:
		}
	})

	listener, actualPort, err := ListenWithFallback(cfg.Port, 100)
	if err != nil {
		fmt.Fprintf(os.Stderr, "server failed to listen: %v\n", err)
		os.Exit(1)
	}

	// If port shifted due to conflict, update config and notify
	if actualPort != cfg.Port {
		cfg.Port = actualPort
		_ = fs.SaveConfig(cfg)
	}

	// Record active port and PID
	_ = fs.WritePort(actualPort)
	_ = fs.WritePID("server", os.Getpid())

	httpServer := &http.Server{
		Handler: srv.Router(),
	}

	// Handle graceful shutdown
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, shutdownSignals...)

	go func() {
		if err := httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "server error: %v\n", err)
			os.Exit(1)
		}
	}()

	select {
	case <-stopChan:
	case <-shutdownTriggered:
		// Allow Godot pet client brief moment to exit cleanly on its own
		time.Sleep(300 * time.Millisecond)
	}

	// Stop desktop pet if running
	pm := embedder.NewProcessManager(fs)
	_ = pm.Stop()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(ctx)
	_ = fs.RemovePID("server")
	_ = fs.RemovePort()
	os.Exit(0)
}
