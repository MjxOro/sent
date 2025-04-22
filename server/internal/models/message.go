// internal/models/message.go
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

// MessageDTO represents a message with user information
type MessageDTO struct {
	// Message fields
	ID        string    `json:"id" db:"id"`
	RoomID    string    `json:"room_id" db:"room_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`

	// User fields
	UserName   string `json:"user_name" db:"user_name"`
	UserAvatar string `json:"user_avatar" db:"user_avatar"`
}

// ToMessage converts a MessageDTO to a Message
func (dto *MessageDTO) ToMessage() *Message {
	return &Message{
		ID:        dto.ID,
		RoomID:    dto.RoomID,
		UserID:    dto.UserID,
		Content:   dto.Content,
		CreatedAt: dto.CreatedAt,
		UpdatedAt: dto.UpdatedAt,
	}
}

// MessageStatus represents message read status
type MessageStatus struct {
	MessageID string    `json:"message_id" db:"message_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	IsRead    bool      `json:"is_read" db:"is_read"`
	ReadAt    time.Time `json:"read_at" db:"read_at"`
}
