package notes

import (
	"fmt"
	"math/rand"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"mcd-desktop-pet/internal/storage"
)

const NotesFileName = "notes.json"

type NoteStatus string

const (
	StatusActive   NoteStatus = "active"
	StatusArchived NoteStatus = "archived"
	StatusAll      NoteStatus = "all"
)

// Note represents an individual sticky note item.
type Note struct {
	ID          string     `json:"id"`
	OrderNumber string     `json:"order_number"` // e.g. "#042" (used in McDonald's receipt theme)
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	Media       []string   `json:"media,omitempty"` // media file names in storage/media
	Position    [2]int     `json:"position"`        // [x, y]
	Size        [2]int     `json:"size"`            // [width, height]
	Status      NoteStatus `json:"status"`          // "active" | "archived"
	Theme       string     `json:"theme,omitempty"` // overrides global theme if set
	Pinned      bool       `json:"pinned"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	ArchivedAt  *time.Time `json:"archived_at,omitempty"`
}

// Summary returns a brief text summary of the note.
func (n *Note) Summary() string {
	if n.Title != "" {
		return n.Title
	}
	runes := []rune(n.Content)
	if len(runes) > 30 {
		return string(runes[:30]) + "..."
	}
	if len(runes) == 0 {
		return "(空便签)"
	}
	return string(runes)
}

type CreateNoteRequest struct {
	Title    string   `json:"title,omitempty"`
	Content  string   `json:"content"`
	Media    []string `json:"media,omitempty"`
	Position [2]int   `json:"position,omitempty"`
	Size     [2]int   `json:"size,omitempty"`
	Pinned   bool     `json:"pinned,omitempty"`
	Theme    string   `json:"theme,omitempty"`
}

type UpdateNoteRequest struct {
	Title    *string   `json:"title,omitempty"`
	Content  *string   `json:"content,omitempty"`
	Media    *[]string `json:"media,omitempty"`
	Position *[2]int   `json:"position,omitempty"`
	Size     *[2]int   `json:"size,omitempty"`
	Pinned   *bool     `json:"pinned,omitempty"`
	Theme    *string   `json:"theme,omitempty"`
}

// Manager handles in-memory and persistent note lifecycle.
type Manager struct {
	mu        sync.RWMutex
	fileStore *storage.FileStore
	notes     map[string]*Note
}

// NewManager creates a note Manager and loads existing notes from disk.
func NewManager(fs *storage.FileStore) (*Manager, error) {
	mgr := &Manager{
		fileStore: fs,
		notes:     make(map[string]*Note),
	}

	if err := mgr.load(); err != nil {
		return nil, err
	}

	return mgr, nil
}

func (m *Manager) load() error {
	var list []*Note
	err := m.fileStore.ReadJSON(NotesFileName, &list)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to load notes: %w", err)
	}

	for _, n := range list {
		if n.Status == "" {
			n.Status = StatusActive
		}
		if n.Size[0] == 0 || n.Size[1] == 0 {
			n.Size = [2]int{280, 320}
		}
		m.notes[n.ID] = n
	}
	return nil
}

func (m *Manager) persist() error {
	list := make([]*Note, 0, len(m.notes))
	for _, n := range m.notes {
		list = append(list, n)
	}
	return m.fileStore.AtomicWriteJSON(NotesFileName, list)
}

// CreateNote creates and persists a new note.
func (m *Manager) CreateNote(req CreateNoteRequest) (*Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	orderNum := fmt.Sprintf("#%03d", rand.Intn(900)+100)

	size := req.Size
	if size[0] <= 0 || size[1] <= 0 {
		size = [2]int{280, 320}
	}

	note := &Note{
		ID:          fmt.Sprintf("note_%s", uuid.New().String()[:8]),
		OrderNumber: orderNum,
		Title:       req.Title,
		Content:     req.Content,
		Media:       req.Media,
		Position:    req.Position,
		Size:        size,
		Status:      StatusActive,
		Theme:       req.Theme,
		Pinned:      req.Pinned,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	m.notes[note.ID] = note
	if err := m.persist(); err != nil {
		delete(m.notes, note.ID)
		return nil, fmt.Errorf("failed to save note: %w", err)
	}

	return note, nil
}

// GetNote retrieves a note by ID.
func (m *Manager) GetNote(id string) (*Note, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	note, ok := m.notes[id]
	if !ok {
		return nil, fmt.Errorf("note with id %q not found", id)
	}
	return note, nil
}

// ListNotes lists notes filtered by status ("active", "archived", or "all").
func (m *Manager) ListNotes(status NoteStatus) ([]*Note, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if status == "" {
		status = StatusAll
	}

	result := make([]*Note, 0)
	for _, n := range m.notes {
		if status == StatusAll || n.Status == status {
			result = append(result, n)
		}
	}

	// Sort newest first
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	return result, nil
}

// UpdateNote updates attributes of an existing note.
func (m *Manager) UpdateNote(id string, req UpdateNoteRequest) (*Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	note, ok := m.notes[id]
	if !ok {
		return nil, fmt.Errorf("note with id %q not found", id)
	}

	if req.Title != nil {
		note.Title = *req.Title
	}
	if req.Content != nil {
		note.Content = *req.Content
	}
	if req.Media != nil {
		note.Media = *req.Media
	}
	if req.Position != nil {
		note.Position = *req.Position
	}
	if req.Size != nil {
		note.Size = *req.Size
	}
	if req.Pinned != nil {
		note.Pinned = *req.Pinned
	}
	if req.Theme != nil {
		note.Theme = *req.Theme
	}
	note.UpdatedAt = time.Now()

	if err := m.persist(); err != nil {
		return nil, fmt.Errorf("failed to update note %s: %w", id, err)
	}

	return note, nil
}

// ArchiveNote archives a note (completed / stamped).
func (m *Manager) ArchiveNote(id string) (*Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	note, ok := m.notes[id]
	if !ok {
		return nil, fmt.Errorf("note with id %q not found", id)
	}

	now := time.Now()
	note.Status = StatusArchived
	note.ArchivedAt = &now
	note.UpdatedAt = now

	if err := m.persist(); err != nil {
		return nil, fmt.Errorf("failed to archive note %s: %w", id, err)
	}

	return note, nil
}

// RestoreNote restores an archived note back to active state.
func (m *Manager) RestoreNote(id string) (*Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	note, ok := m.notes[id]
	if !ok {
		return nil, fmt.Errorf("note with id %q not found", id)
	}

	now := time.Now()
	note.Status = StatusActive
	note.ArchivedAt = nil
	note.UpdatedAt = now

	if err := m.persist(); err != nil {
		return nil, fmt.Errorf("failed to restore note %s: %w", id, err)
	}

	return note, nil
}

// DeleteNote permanently removes a note.
func (m *Manager) DeleteNote(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.notes[id]; !ok {
		return fmt.Errorf("note with id %q not found", id)
	}

	delete(m.notes, id)
	return m.persist()
}

// UpdatePositionSize updates a note's screen coordinate and window size (reported by desktop client).
func (m *Manager) UpdatePositionSize(id string, pos [2]int, size [2]int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	note, ok := m.notes[id]
	if !ok {
		return fmt.Errorf("note with id %q not found", id)
	}

	note.Position = pos
	if size[0] > 0 && size[1] > 0 {
		note.Size = size
	}
	note.UpdatedAt = time.Now()
	return m.persist()
}
