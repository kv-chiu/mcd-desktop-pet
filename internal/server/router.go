package server

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"mcd-desktop-pet/internal/extensions"
	"mcd-desktop-pet/internal/notes"
	"mcd-desktop-pet/internal/pet"
	"mcd-desktop-pet/internal/storage"
	"mcd-desktop-pet/internal/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for desktop pet local access
	},
}

// Server holds core services and HTTP router.
type Server struct {
	fileStore  *storage.FileStore
	mediaStore *storage.MediaStore
	notesMgr   *notes.Manager
	petSM      *pet.StateMachine
	wsHub      *ws.Hub
	registry   *extensions.Registry
	router     *chi.Mux
	startTime  time.Time
	onShutdown func()
}

// SetOnShutdown sets callback invoked on graceful exit request.
func (s *Server) SetOnShutdown(fn func()) {
	s.onShutdown = fn
}

// NewServer initializes Server and routes.
func NewServer(
	fs *storage.FileStore,
	notesMgr *notes.Manager,
	petSM *pet.StateMachine,
	wsHub *ws.Hub,
	reg *extensions.Registry,
) *Server {
	s := &Server{
		fileStore:  fs,
		mediaStore: storage.NewMediaStore(fs),
		notesMgr:   notesMgr,
		petSM:      petSM,
		wsHub:      wsHub,
		registry:   reg,
		router:     chi.NewRouter(),
		startTime:  time.Now(),
	}

	s.setupRoutes()
	return s
}

// Router returns the chi router.
func (s *Server) Router() http.Handler {
	return s.router
}

func (s *Server) setupRoutes() {
	r := s.router

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// WebSocket Endpoint
	r.Get("/ws", s.handleWebSocket)

	// REST API Routes
	r.Route("/api", func(api chi.Router) {
		api.Get("/health", s.handleHealth)

		// Pet
		api.Route("/pet", func(pr chi.Router) {
			pr.Get("/state", s.handleGetPetState)
			pr.Post("/action", s.handleSetPetAction)
			pr.Post("/click", s.handlePetClick)
			pr.Post("/visibility", s.handleSetVisibility)
			pr.Post("/visibility/toggle", s.handleToggleVisibility)
			pr.Post("/scale", s.handleSetPetScale)
		})

		// Notes
		api.Route("/notes", func(nr chi.Router) {
			nr.Get("/", s.handleListNotes)
			nr.Post("/", s.handleCreateNote)
			nr.Get("/{id}", s.handleGetNote)
			nr.Put("/{id}", s.handleUpdateNote)
			nr.Delete("/{id}", s.handleDeleteNote)
			nr.Post("/{id}/archive", s.handleArchiveNote)
			nr.Post("/{id}/restore", s.handleRestoreNote)
			nr.Post("/{id}/position", s.handleUpdateNotePosition)

			// Media
			nr.Post("/media", s.handleUploadMedia)
			nr.Get("/media/{filename}", s.handleGetMedia)
		})

		// Config
		api.Route("/config", func(cr chi.Router) {
			cr.Get("/", s.handleGetConfig)
			cr.Put("/", s.handleSaveConfig)
			cr.Post("/theme", s.handleSetTheme)
			cr.Post("/scale", s.handleSetPetScale)
		})

		// Menu & Extensions
		api.Get("/menu", s.handleGetMenu)
		api.Get("/renders", s.handleGetRenders)
		api.Get("/plugins", s.handleGetPlugins)

		// System
		api.Route("/system", func(sr chi.Router) {
			sr.Post("/exit", s.handleSystemExit)
		})
	})

	// Static SPA fallback
	if globalWebFS != nil {
		r.Handle("/*", SpaHandler(globalWebFS))
	} else {
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte("<h1>McDonald's Desktop Pet Go Server</h1><p>API is active.</p>"))
		})
	}
}

// JSON helpers
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}

// WebSocket handler
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	clientID := uuid.New().String()
	client := ws.NewClient(s.wsHub, conn, clientID)
	s.wsHub.Register(client)

	// Send current pet state and theme on connect
	petState := s.petSM.GetState()
	cfg, _ := s.fileStore.LoadConfig()
	menuItems := s.registry.GetMenuItems()

	initData := map[string]any{
		"pet_state": petState,
		"theme":     cfg.Theme,
		"scale":     cfg.PetScale,
		"pet_scale": cfg.PetScale,
		"menu":      menuItems,
	}

	envelope := ws.Message{
		Type:      "init",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Payload:   initData,
	}
	if b, err := json.Marshal(envelope); err == nil {
		client.WritePump() // start write pump in goroutine below
		_ = conn.WriteMessage(websocket.TextMessage, b)
	}

	go client.WritePump()
	go client.ReadPump()
}

// Health check
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	hasDesktop := s.wsHub.HasDesktopClient()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"uptime_seconds": time.Since(s.startTime).Seconds(),
		"pet_running":    hasDesktop,
		"version":        "1.0.0",
		"connections":    s.wsHub.ClientCount(),
	})
}

// Pet handlers
func (s *Server) handleGetPetState(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.petSM.GetState())
}

func (s *Server) handleSetPetAction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Action   pet.ActionType `json:"action"`
		Speech   string         `json:"speech"`
		Duration float64        `json:"duration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.petSM.SetAction(req.Action, req.Speech, req.Duration); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.wsHub.Broadcast("pet_action", s.petSM.GetState())
	writeJSON(w, http.StatusOK, s.petSM.GetState())
}

func (s *Server) handlePetClick(w http.ResponseWriter, r *http.Request) {
	action, err := s.petSM.OnClick()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	state := s.petSM.GetState()
	s.wsHub.Broadcast("pet_action", state)
	writeJSON(w, http.StatusOK, map[string]any{
		"action": action,
		"state":  state,
	})
}

func (s *Server) handleSetVisibility(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Visible bool `json:"visible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.petSM.SetVisibility(req.Visible); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.wsHub.Broadcast("visibility_changed", map[string]bool{"visible": req.Visible})
	writeJSON(w, http.StatusOK, map[string]bool{"visible": req.Visible})
}

func (s *Server) handleToggleVisibility(w http.ResponseWriter, r *http.Request) {
	visible, err := s.petSM.ToggleVisibility()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.wsHub.Broadcast("visibility_changed", map[string]bool{"visible": visible})
	writeJSON(w, http.StatusOK, map[string]bool{"visible": visible})
}

// Notes handlers
func (s *Server) handleListNotes(w http.ResponseWriter, r *http.Request) {
	statusQuery := r.URL.Query().Get("status")
	list, err := s.notesMgr.ListNotes(notes.NoteStatus(statusQuery))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleCreateNote(w http.ResponseWriter, r *http.Request) {
	var req notes.CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	note, err := s.notesMgr.CreateNote(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.wsHub.Broadcast("note_created", note)
	writeJSON(w, http.StatusCreated, note)
}

func (s *Server) handleGetNote(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	note, err := s.notesMgr.GetNote(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, note)
}

func (s *Server) handleUpdateNote(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req notes.UpdateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	note, err := s.notesMgr.UpdateNote(id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.wsHub.Broadcast("note_updated", note)
	writeJSON(w, http.StatusOK, note)
}

func (s *Server) handleDeleteNote(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.notesMgr.DeleteNote(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	s.wsHub.Broadcast("note_deleted", map[string]string{"id": id})
	writeJSON(w, http.StatusOK, map[string]string{"id": id, "deleted": "true"})
}

func (s *Server) handleArchiveNote(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	note, err := s.notesMgr.ArchiveNote(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	s.wsHub.Broadcast("note_archived", note)
	writeJSON(w, http.StatusOK, note)
}

func (s *Server) handleRestoreNote(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	note, err := s.notesMgr.RestoreNote(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	s.wsHub.Broadcast("note_restored", note)
	writeJSON(w, http.StatusOK, note)
}

func (s *Server) handleUpdateNotePosition(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Position [2]int `json:"position"`
		Size     [2]int `json:"size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.notesMgr.UpdatePositionSize(id, req.Position, req.Size); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.wsHub.Broadcast("note_position_sync", map[string]any{
		"id":       id,
		"position": req.Position,
		"size":     req.Size,
	})
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

// Media handlers
func (s *Server) handleUploadMedia(w http.ResponseWriter, r *http.Request) {
	contentType := r.Header.Get("Content-Type")

	var filename string
	var err error

	if strings.HasPrefix(contentType, "application/json") {
		var req struct {
			Data string `json:"data"` // base64 / data URL
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid json")
			return
		}
		filename, err = s.mediaStore.SaveBase64(req.Data)
	} else if strings.HasPrefix(contentType, "multipart/form-data") {
		file, header, parseErr := r.FormFile("file")
		if parseErr != nil {
			writeError(w, http.StatusBadRequest, "missing form file")
			return
		}
		defer file.Close()

		data, readErr := io.ReadAll(file)
		if readErr != nil {
			writeError(w, http.StatusInternalServerError, "failed to read file")
			return
		}
		ext := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(header.Filename)), ".")
		filename, err = s.mediaStore.SaveBytes(data, ext)
	} else {
		// Raw binary
		data, readErr := io.ReadAll(r.Body)
		if readErr != nil || len(data) == 0 {
			writeError(w, http.StatusBadRequest, "missing binary body")
			return
		}
		filename, err = s.mediaStore.SaveBytes(data, "png")
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"filename": filename,
		"url":      "/api/notes/media/" + filename,
	})
}

func (s *Server) handleGetMedia(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	path := s.mediaStore.GetPath(filename)
	http.ServeFile(w, r, path)
}

// Config handlers
func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := s.fileStore.LoadConfig()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) handleSaveConfig(w http.ResponseWriter, r *http.Request) {
	var cfg storage.AppConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	oldCfg, _ := s.fileStore.LoadConfig()
	if err := s.fileStore.SaveConfig(cfg); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if oldCfg.Theme != cfg.Theme {
		s.wsHub.Broadcast("THEME_CHANGED", map[string]string{"theme": cfg.Theme})
	}
	if oldCfg.PetScale != cfg.PetScale && cfg.PetScale > 0 {
		s.wsHub.Broadcast("PET_SCALE_CHANGED", map[string]any{"scale": cfg.PetScale, "pet_scale": cfg.PetScale})
	}

	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) handleSetTheme(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Theme string `json:"theme"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Theme == "" {
		writeError(w, http.StatusBadRequest, "theme is required")
		return
	}

	cfg, err := s.fileStore.LoadConfig()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	cfg.Theme = req.Theme
	if err := s.fileStore.SaveConfig(cfg); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.wsHub.Broadcast("THEME_CHANGED", map[string]string{"theme": cfg.Theme})
	writeJSON(w, http.StatusOK, map[string]string{"theme": cfg.Theme})
}

func (s *Server) handleSetPetScale(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Scale    float64 `json:"scale"`
		PetScale float64 `json:"pet_scale"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	targetScale := req.Scale
	if targetScale <= 0 {
		targetScale = req.PetScale
	}
	if targetScale <= 0 {
		writeError(w, http.StatusBadRequest, "valid scale is required")
		return
	}
	if targetScale < 0.5 {
		targetScale = 0.5
	} else if targetScale > 2.0 {
		targetScale = 2.0
	}

	cfg, err := s.fileStore.LoadConfig()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	cfg.PetScale = targetScale
	if err := s.fileStore.SaveConfig(cfg); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.wsHub.Broadcast("PET_SCALE_CHANGED", map[string]any{"scale": cfg.PetScale, "pet_scale": cfg.PetScale})
	writeJSON(w, http.StatusOK, map[string]any{"scale": cfg.PetScale, "pet_scale": cfg.PetScale})
}

// Menu and Renders
func (s *Server) handleGetMenu(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.registry.GetMenuItems())
}

func (s *Server) handleGetRenders(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.registry.ListRenders())
}

func (s *Server) handleGetPlugins(w http.ResponseWriter, r *http.Request) {
	plugins := s.registry.ListPlugins()
	writeJSON(w, http.StatusOK, map[string]any{
		"plugins": plugins,
		"total":   len(plugins),
	})
}

func (s *Server) handleSystemExit(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "shutting_down"})
	if s.onShutdown != nil {
		go func() {
			time.Sleep(100 * time.Millisecond)
			s.onShutdown()
		}()
	}
}
