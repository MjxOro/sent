// internal/model/message.go
package model

import "time"

// Message represents a chat message
type Message struct {
	ID        string    `json:"id" db:"id"`
	RoomID    string    `json:"room_id" db:"room_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// MessageStatus represents message read status
type MessageStatus struct {
	MessageID string    `json:"message_id" db:"message_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	IsRead    bool      `json:"is_read" db:"is_read"`
	ReadAt    time.Time `json:"read_at" db:"read_at"`
}
