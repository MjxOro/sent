// internal/service/user_service.go
package service

import (
	"time"

	"github.com/mjxoro/sent/server/internal/db/postgres"
	"github.com/mjxoro/sent/server/internal/models"
)

// UserService handles user-related business logic
type UserService struct {
	pgUser *postgres.User
}

// NewUserService creates a new user service
func NewUserService(pgUser *postgres.User) *UserService {
	return &UserService{
		pgUser: pgUser,
	}
}

// GetByID gets a user by ID
func (s *UserService) GetByID(id string) (*model.User, error) {
	return s.pgUser.FindByID(id)
}

// FindByEmail gets a user by email
func (s *UserService) FindByEmail(email string) (*model.User, error) {
	return s.pgUser.FindByEmail(email)
}

// FindOrCreateFromOAuth finds or creates a user from OAuth data
func (s *UserService) FindOrCreateFromOAuth(userInput *model.User, provider string) (*model.User, error) {
	// Try to find user by OAuth ID and provider
	user, err := s.pgUser.FindByOAuthID(userInput.OAuthID, provider)
	if err == nil {
		// User exists, return it
		return user, nil
	}

	// User not found, try to find by email
	user, err = s.pgUser.FindByEmail(user.Email)
	if err == nil {
		// User exists with this email but different OAuth provider
		// Update the OAuth ID if it's from the same provider
		if user.Provider == provider {
			user.OAuthID = userInput.OAuthID
			if err := s.pgUser.Update(user); err != nil {
				return nil, err
			}
		}
		return user, nil
	}

	// User not found, create new one
	user = &model.User{
		Email:     userInput.Email,
		Name:      userInput.Name,
		OAuthID:   userInput.OAuthID,
		Provider:  provider,
		Avatar:    userInput.Avatar,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.pgUser.Create(user); err != nil {
		return nil, err
	}

	return user, nil
}
