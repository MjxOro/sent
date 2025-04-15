// internal/db/postgres/user.go
package postgres

import (
	"github.com/mjxoro/sent/server/internal/models"
	"time"
)

// User handles database operations for users
type User struct {
	db *DB
}

// NewUser creates a new user
func NewUser(db *DB) *User {
	return &User{
		db: db,
	}
}

// FindByID finds a user by ID
func (r *User) FindByID(id string) (*model.User, error) {
	query := `SELECT * FROM users WHERE id = $1`
	var user model.User
	err := r.db.Get(&user, query, id)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmail finds a user by email
func (r *User) FindByEmail(email string) (*model.User, error) {
	query := `SELECT * FROM users WHERE email = $1`
	var user model.User
	err := r.db.Get(&user, query, email)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByOAuthID finds a user by OAuth ID and provider
func (r *User) FindByOAuthID(oauthID string, provider string) (*model.User, error) {
	query := `SELECT * FROM users WHERE oauth_id = $1 AND provider = $2`
	var user model.User
	err := r.db.Get(&user, query, oauthID, provider)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Create creates a new user
func (r *User) Create(user *model.User) error {
	query := `
		INSERT INTO users (email, name, oauth_id, provider, avatar, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now
	return r.db.QueryRow(
		query,
		user.Email,
		user.Name,
		user.OAuthID,
		user.Provider,
		user.Avatar,
		user.CreatedAt,
		user.UpdatedAt,
	).Scan(&user.ID)
}

// Update updates a user
func (r *User) Update(user *model.User) error {
	query := `
		UPDATE users
		SET email = $1, name = $2, avatar = $3, updated_at = $4
		WHERE id = $5
	`
	user.UpdatedAt = time.Now()
	_, err := r.db.Exec(
		query,
		user.Email,
		user.Name,
		user.Avatar,
		user.UpdatedAt,
		user.ID,
	)
	return err
}
