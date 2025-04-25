// internal/db/postgres/friendship.go
package postgres

import (
	"time"

	"github.com/mjxoro/sent/server/internal/models"
)

// Friendship handles database operations for friendships
type Friendship struct {
	db *DB
}

// NewFriendship creates a new friendship repository
func NewFriendship(db *DB) *Friendship {
	return &Friendship{
		db: db,
	}
}

// Create creates a new friendship request
func (r *Friendship) Create(friendship *models.Friendship) error {
	query := `
		INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`

	now := time.Now()
	friendship.CreatedAt = now
	friendship.UpdatedAt = now

	return r.db.QueryRow(
		query,
		friendship.UserID,
		friendship.FriendID,
		friendship.Status,
		friendship.CreatedAt,
		friendship.UpdatedAt,
	).Scan(&friendship.ID)
}

// FindByID finds a friendship by ID
func (r *Friendship) FindByID(id string) (*models.Friendship, error) {
	query := `SELECT * FROM friendships WHERE id = $1`

	var friendship models.Friendship
	err := r.db.Get(&friendship, query, id)
	if err != nil {
		return nil, err
	}

	return &friendship, nil
}

// FindByUserAndFriend finds a friendship between two users
func (r *Friendship) FindByUserAndFriend(userID, friendID string) (*models.Friendship, error) {
	query := `
		SELECT * FROM friendships 
		WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
	`

	var friendship models.Friendship
	err := r.db.Get(&friendship, query, userID, friendID)
	if err != nil {
		return nil, err
	}

	return &friendship, nil
}

// FindFriendsByUserID finds all friends of a user with specified status
func (r *Friendship) FindFriendsByUserID(userID string, status models.FriendshipStatus) ([]*models.FriendshipWithUser, error) {
	query := `
		SELECT 
			f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
			u.name as friend_name, u.email as friend_email, u.avatar as friend_avatar
		FROM friendships f
		JOIN users u ON (
			CASE 
				WHEN f.user_id = $1 THEN f.friend_id = u.id
				WHEN f.friend_id = $1 THEN f.user_id = u.id
			END
		)
		WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = $2
		ORDER BY u.name ASC
	`

	var friends []*models.FriendshipWithUser
	err := r.db.Select(&friends, query, userID, status)
	if err != nil {
		return nil, err
	}

	return friends, nil
}

// FindAllUserRelationships finds all friendship relationships for a user
func (r *Friendship) FindAllUserRelationships(userID string) ([]*models.FriendshipWithUser, error) {
	query := `
		SELECT 
			f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
			u.name as friend_name, u.email as friend_email, u.avatar as friend_avatar
		FROM friendships f
		JOIN users u ON (
			CASE 
				WHEN f.user_id = $1 THEN f.friend_id = u.id
				WHEN f.friend_id = $1 THEN f.user_id = u.id
			END
		)
		WHERE f.user_id = $1 OR f.friend_id = $1
		ORDER BY f.status, u.name ASC
	`

	var friends []*models.FriendshipWithUser
	err := r.db.Select(&friends, query, userID)
	if err != nil {
		return nil, err
	}

	return friends, nil
}

// FindPendingRequests finds all pending friend requests for a user
func (r *Friendship) FindPendingRequests(userID string) ([]*models.FriendshipWithUser, error) {
	query := `
		SELECT 
			f.id, f.user_id, f.friend_id, f.status, f.created_at, f.updated_at,
			u.name as friend_name, u.email as friend_email, u.avatar as friend_avatar
		FROM friendships f
		JOIN users u ON f.user_id = u.id
		WHERE f.friend_id = $1 AND f.status = 'pending'
		ORDER BY f.created_at DESC
	`

	var requests []*models.FriendshipWithUser
	err := r.db.Select(&requests, query, userID)
	if err != nil {
		return nil, err
	}

	return requests, nil
}

// UpdateStatus updates the status of a friendship
func (r *Friendship) UpdateStatus(id string, status models.FriendshipStatus) error {
	query := `
		UPDATE friendships
		SET status = $1, updated_at = $2
		WHERE id = $3
	`

	now := time.Now()

	_, err := r.db.Exec(query, status, now, id)
	return err
}

// Delete deletes a friendship
func (r *Friendship) Delete(id string) error {
	query := `DELETE FROM friendships WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// FindNonFriends finds users who are not friends with the specified user
func (r *Friendship) FindNonFriends(userID string, limit, offset int) ([]*models.User, error) {
	query := `
		SELECT u.* FROM users u
		WHERE u.id != $1
		AND NOT EXISTS (
			SELECT 1 FROM friendships f
			WHERE (f.user_id = $1 AND f.friend_id = u.id) 
			OR (f.friend_id = $1 AND f.user_id = u.id)
		)
		ORDER BY u.name ASC
		LIMIT $2 OFFSET $3
	`

	var users []*models.User
	err := r.db.Select(&users, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}

	return users, nil
}
