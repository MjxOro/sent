// internal/models/friendship.go
package models

import "time"

// FriendshipStatus defines the status of a friendship
type FriendshipStatus string

// Friendship status constants
const (
	FriendshipStatusPending  FriendshipStatus = "pending"
	FriendshipStatusAccepted FriendshipStatus = "accepted"
	FriendshipStatusRejected FriendshipStatus = "rejected"
	FriendshipStatusBlocked  FriendshipStatus = "blocked"
)

// Friendship represents a friendship relationship between users
type Friendship struct {
	ID        string           `json:"id" db:"id"`
	UserID    string           `json:"user_id" db:"user_id"`
	FriendID  string           `json:"friend_id" db:"friend_id"`
	Status    FriendshipStatus `json:"status" db:"status"`
	CreatedAt time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt time.Time        `json:"updated_at" db:"updated_at"`
}

// FriendshipWithUser represents a friendship with details about the friend
type FriendshipWithUser struct {
	Friendship
	FriendName   string `json:"friend_name" db:"friend_name"`
	FriendEmail  string `json:"friend_email" db:"friend_email"`
	FriendAvatar string `json:"friend_avatar" db:"friend_avatar"`
}
