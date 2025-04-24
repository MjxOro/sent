// Add a type field to the Room model
package models

import "time"

type Room struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	CreatorID   string    `json:"creator_id" db:"creator_id"`
	IsPrivate   bool      `json:"is_private" db:"is_private"`
	Type        string    `json:"type" db:"type"` // "group" or "direct"
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
