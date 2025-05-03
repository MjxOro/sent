// pkg/websocket/message.go
package websocket

import (
	"encoding/json"
	"time"
)

// Message represents a message in the chat system
type Message struct {
	// Core message fields
	Type      string    `json:"type"`              // message, typing, system, subscribe, unsubscribe, etc.
	RoomID    string    `json:"room_id"`           // Which room this message belongs to
	UserID    string    `json:"user_id,omitempty"` // Who sent the message
	Content   string    `json:"content,omitempty"` // For chat messages
	Timestamp time.Time `json:"timestamp"`         // When the message was sent

	// Optional fields
	Action string          `json:"action,omitempty"` // For system messages (joined, left)
	Data   json.RawMessage `json:"data,omitempty"`   // Additional data specific to message type

	// Reference to the client (not serialized)
	Client *Client `json:"-"` // Not sent over the wire
}

// NewMessage creates a new message
func NewMessage(msgType string, roomID string, client *Client) *Message {
	return &Message{
		Type:      msgType,
		RoomID:    roomID,
		UserID:    client.ID,
		Timestamp: time.Now(),
		Client:    client,
	}
}
