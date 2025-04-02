// internal/auth/oauth.go
package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/yourusername/your-repo-name/server/internal/config"
	"golang.org/x/oauth2"
)

// OAuthService handles OAuth authentication
type OAuthService struct {
	config      *config.Config
	oauthConfig *oauth2.Config
}

// UserInfo represents user information from the OAuth provider
type UserInfo struct {
	ID            string `json:"sub"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// NewOAuthService creates a new OAuth service
func NewOAuthService(config *config.Config) *OAuthService {
	oauthConfig := &oauth2.Config{
		ClientID:     config.OAuth.ClientID,
		ClientSecret: config.OAuth.ClientSecret,
		RedirectURL:  config.OAuth.RedirectURL,
		Scopes:       config.OAuth.Scopes,
		Endpoint: oauth2.Endpoint{
			AuthURL:  config.OAuth.AuthURL,
			TokenURL: config.OAuth.TokenURL,
		},
	}

	return &OAuthService{
		config:      config,
		oauthConfig: oauthConfig,
	}
}

// GenerateStateOauthCookie creates a state parameter and stores it in a cookie
func (s *OAuthService) GenerateStateOauthCookie(w http.ResponseWriter) string {
	// Generate random state
	b := make([]byte, 16)
	rand.Read(b)
	state := base64.URLEncoding.EncodeToString(b)
	
	// Create cookie
	expiration := time.Now().Add(365 * 24 * time.Hour)
	cookie := http.Cookie{
		Name:     "oauthstate",
		Value:    state,
		Expires:  expiration,
		HttpOnly: true,
		Path:     "/",
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
	http.SetCookie(w, &cookie)

	return state
}

// GetLoginURL returns the OAuth provider's login URL
func (s *OAuthService) GetLoginURL(state string) string {
	return s.oauthConfig.AuthCodeURL(state)
}

// Exchange exchanges the authorization code for a token
func (s *OAuthService) Exchange(code string) (*oauth2.Token, error) {
	ctx := context.Background()
	return s.oauthConfig.Exchange(ctx, code)
}

// GetUserInfo fetches the user's information from the OAuth provider
func (s *OAuthService) GetUserInfo(token *oauth2.Token) (*UserInfo, error) {
	if !token.Valid() {
		return nil, errors.New("invalid token")
	}

	client := s.oauthConfig.Client(context.Background(), token)
	resp, err := client.Get(s.config.OAuth.UserInfoURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user info request failed with status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var userInfo UserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}
