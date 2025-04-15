// internal/service/refresh_token_service.go
package service

import (
	"github.com/mjxoro/sent/server/internal/db/postgres"
	"time"
)

// RefreshTokenService handles refresh token business logic
type RefreshTokenService struct {
	pgRefreshToken *postgres.RefreshToken
}

// NewRefreshTokenService creates a new refresh token service
func NewRefreshTokenService(pgRefreshToken *postgres.RefreshToken) *RefreshTokenService {
	return &RefreshTokenService{
		pgRefreshToken: pgRefreshToken,
	}
}

// Store stores a refresh token for a user
func (s *RefreshTokenService) Store(userID, token string, expiresAt time.Time) error {
	return s.pgRefreshToken.Store(userID, token, expiresAt)
}

// Validate checks if a refresh token is valid
func (s *RefreshTokenService) Validate(userID, token string) (bool, error) {
	return s.pgRefreshToken.Validate(userID, token)
}

// Revoke revokes a refresh token
func (s *RefreshTokenService) Revoke(userID, token string) error {
	return s.pgRefreshToken.Revoke(userID, token)
}

// RevokeAllForUser revokes all refresh tokens for a user
func (s *RefreshTokenService) RevokeAllForUser(userID string) error {
	return s.pgRefreshToken.RevokeAllForUser(userID)
}
