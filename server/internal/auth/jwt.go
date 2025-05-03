// internal/auth/jwt.go
package auth

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

// JWTService handles JWT operations
type JWTService struct {
	secretKey     string
	tokenDuration time.Duration
}

// TokenClaims represents the claims in the JWT
type TokenClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
	jwt.RegisteredClaims
}

// NewJWTService creates a new JWT service
func NewJWTService() *JWTService {
	// Get secret from environment variable or use a default for development
	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "your-secret-key-change-in-production"
	}

	// Set token duration (1 day by default)
	tokenDuration := 24 * time.Hour

	return &JWTService{
		secretKey:     secretKey,
		tokenDuration: tokenDuration,
	}
}

// GenerateToken creates a new JWT token
func (s *JWTService) GenerateToken(userID, email, name, avatar string) (string, error) {
	// Create the claims
	claims := TokenClaims{
		UserID: userID,
		Email:  email,
		Name:   name,
		Avatar: avatar,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.tokenDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	// Create token with claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Generate encoded token
	return token.SignedString([]byte(s.secretKey))
}

// ValidateToken validates the JWT token
func (s *JWTService) ValidateToken(tokenString string) (*TokenClaims, error) {
	// Parse the token
	token, err := jwt.ParseWithClaims(
		tokenString,
		&TokenClaims{},
		func(token *jwt.Token) (interface{}, error) {
			// Validate the signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(s.secretKey), nil
		},
	)

	if err != nil {
		return nil, err
	}

	// Validate the token and return the claims
	if claims, ok := token.Claims.(*TokenClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// GenerateRefreshToken creates a longer-lasting refresh token
func (s *JWTService) GenerateRefreshToken(userID string) (string, error) {
	// Set refresh token duration (30 days)
	refreshDuration := 30 * 24 * time.Hour

	// Create the claims
	claims := TokenClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(refreshDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	// Create token with claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Generate encoded token
	return token.SignedString([]byte(s.secretKey))
}

// GetRefreshTokenExpiry returns the expiry time for refresh tokens
func (s *JWTService) GetRefreshTokenExpiry() time.Time {
	return time.Now().Add(30 * 24 * time.Hour)
}
