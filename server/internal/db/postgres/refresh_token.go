// internal/db/postgres/refresh_token.go
package postgres

import (
	"time"
)

// RefreshToken handles database operations for refresh tokens
type RefreshToken struct {
	db *DB
}

// NewRefreshToken creates a new refresh token repository
func NewRefreshToken(db *DB) *RefreshToken {
	return &RefreshToken{
		db: db,
	}
}

// Store stores a refresh token for a user
func (r *RefreshToken) Store(userID, token string, expiresAt time.Time) error {
	query := `
		INSERT INTO refresh_tokens (user_id, token, expires_at)
		VALUES ($1, $2, $3)
	`
	_, err := r.db.Exec(query, userID, token, expiresAt)
	return err
}

// Validate checks if a refresh token is valid for a user
func (r *RefreshToken) Validate(userID, token string) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM refresh_tokens 
			WHERE user_id = $1 
			AND token = $2 
			AND expires_at > NOW() 
			AND is_revoked = false
		)
	`
	var exists bool
	err := r.db.QueryRow(query, userID, token).Scan(&exists)
	return exists, err
}

// Revoke marks a refresh token as revoked
func (r *RefreshToken) Revoke(userID, token string) error {
	query := `
		UPDATE refresh_tokens
		SET is_revoked = true
		WHERE user_id = $1 AND token = $2
	`
	_, err := r.db.Exec(query, userID, token)
	return err
}

// RevokeAllForUser revokes all refresh tokens for a user
func (r *RefreshToken) RevokeAllForUser(userID string) error {
	query := `
		UPDATE refresh_tokens
		SET is_revoked = true
		WHERE user_id = $1
	`
	_, err := r.db.Exec(query, userID)
	return err
}
