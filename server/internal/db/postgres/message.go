// internal/db/postgres/message.go
package postgres

import (
	"github.com/mjxoro/sent/server/internal/models"
	"time"
)

// Message handles database operations for messages
type Message struct {
	db *DB
}

// NewMessage creates a new message repository
func NewMessage(db *DB) *Message {
	return &Message{
		db: db,
	}
}

// Create creates a new message
func (r *Message) Create(message *models.Message) error {
	query := `
		INSERT INTO messages (room_id, user_id, content, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`

	now := time.Now()
	message.CreatedAt = now
	message.UpdatedAt = now

	return r.db.QueryRow(
		query,
		message.RoomID,
		message.UserID,
		message.Content,
		message.CreatedAt,
		message.UpdatedAt,
	).Scan(&message.ID)
}

// FindByRoomID finds messages in a room with pagination
// Now returns MessageDTO with user information and in chronological order (oldest first)
func (r *Message) FindByRoomID(roomID string, limit, offset int) ([]*models.MessageDTO, error) {
	query := `
		SELECT m.id, m.room_id, m.user_id, m.content, m.created_at, m.updated_at,
		       u.name as user_name, u.avatar as user_avatar
		FROM messages m
		JOIN users u ON m.user_id = u.id
		WHERE m.room_id = $1
		ORDER BY m.created_at ASC
		LIMIT $2 OFFSET $3
	`

	var messages []*models.MessageDTO
	err := r.db.Select(&messages, query, roomID, limit, offset)
	if err != nil {
		return nil, err
	}

	return messages, nil
}

// FindByID finds a message by ID
func (r *Message) FindByID(id string) (*models.Message, error) {
	query := `SELECT * FROM messages WHERE id = $1`

	var message models.Message
	err := r.db.Get(&message, query, id)
	if err != nil {
		return nil, err
	}

	return &message, nil
}

// MarkAsRead marks a message as read by a user
func (r *Message) MarkAsRead(messageID, userID string) error {
	query := `
		INSERT INTO message_status (message_id, user_id, is_read, read_at)
		VALUES ($1, $2, true, $3)
		ON CONFLICT (message_id, user_id) 
		DO UPDATE SET is_read = true, read_at = $3
	`

	now := time.Now()

	_, err := r.db.Exec(query, messageID, userID, now)
	return err
}

// GetUnreadCount gets the count of unread messages in a room for a user
func (r *Message) GetUnreadCount(roomID, userID string) (int, error) {
	query := `
		SELECT COUNT(m.id)
		FROM messages m
		LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = $2
		WHERE m.room_id = $1
		AND (ms.is_read = false OR ms.is_read IS NULL)
	`

	var count int
	err := r.db.QueryRow(query, roomID, userID).Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}
