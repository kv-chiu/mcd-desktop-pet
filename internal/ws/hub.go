package ws

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"mcd-desktop-pet/internal/extensions"
)

// MessageHandler handles incoming typed messages.
type MessageHandler func(client *Client, msg Message, raw []byte)

// Hub maintains the set of active clients and broadcasts messages.
type Hub struct {
	mu         sync.RWMutex
	clients    map[*Client]bool
	handlers   map[string]MessageHandler
	extensions *extensions.Registry
}

// NewHub creates a new WebSocket Hub.
func NewHub(reg *extensions.Registry) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		handlers:   make(map[string]MessageHandler),
		extensions: reg,
	}
}

// Register adds a new client.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = true
}

// Unregister removes a client.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.send)
	}
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// HasDesktopClient returns true if at least one desktop client is connected.
func (h *Hub) HasDesktopClient() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c.clientType == "desktop" {
			return true
		}
	}
	return false
}

// On registers a custom message type handler.
func (h *Hub) On(msgType string, handler MessageHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.handlers[msgType] = handler
}

// HandleMessage routes incoming message to registered handlers or extension slot.
func (h *Hub) HandleMessage(client *Client, msg Message, raw []byte) {
	h.mu.RLock()
	handler, ok := h.handlers[msg.Type]
	h.mu.RUnlock()

	if ok {
		handler(client, msg, raw)
		return
	}

	// Check extension slot
	if h.extensions != nil {
		if ev, ok := h.extensions.GetEvent(msg.Type); ok && ev.Handler != nil {
			var payloadBytes []byte
			if msg.Payload != nil {
				payloadBytes, _ = json.Marshal(msg.Payload)
			}
			_, _ = ev.Handler(context.Background(), client.id, payloadBytes)
		}
	}
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(msgType string, payload any) {
	envelope := Message{
		Type:      msgType,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Payload:   payload,
	}

	data, err := json.Marshal(envelope)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.send <- data:
		default:
			// client channel is full
		}
	}
}

// SendToType sends a message to clients of a specific type (e.g. "desktop").
func (h *Hub) SendToType(clientType string, msgType string, payload any) {
	envelope := Message{
		Type:      msgType,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Payload:   payload,
	}

	data, err := json.Marshal(envelope)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.clientType == clientType {
			select {
			case client.send <- data:
			default:
			}
		}
	}
}
