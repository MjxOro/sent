// internal/handler/auth_handler.go
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/your-repo-name/server/internal/auth"
	"github.com/yourusername/your-repo-name/server/internal/model"
	"github.com/yourusername/your-repo-name/server/internal/service"
)

// AuthHandler handles authentication requests
type AuthHandler struct {
	oauthService *auth.OAuthService
	jwtService   *auth.JWTService
	userService  *service.UserService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(oauthService *auth.OAuthService, jwtService *auth.JWTService, userService *service.UserService) *AuthHandler {
	return &AuthHandler{
		oauthService: oauthService,
		jwtService:   jwtService,
		userService:  userService,
	}
}

// Login initiates the OAuth flow
func (h *AuthHandler) Login(c *gin.Context) {
	// Generate state parameter and store it in a cookie
	state := h.oauthService.GenerateStateOauthCookie(c.Writer)
	
	// Redirect to the OAuth provider's login page
	url := h.oauthService.GetLoginURL(state)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

// Callback handles the OAuth callback
func (h *AuthHandler) Callback(c *gin.Context) {
	// Get the state parameter from the request
	state := c.Query("state")
	
	// Get the state cookie
	oauthState, err := c.Cookie("oauthstate")
	if err != nil || state != oauthState {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid oauth state",
		})
		return
	}
	
	// Get the authorization code
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "code not found",
		})
		return
	}
	
	// Exchange the code for a token
	token, err := h.oauthService.Exchange(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to exchange token",
		})
		return
	}
	
	// Get user info from the token
	userInfo, err := h.oauthService.GetUserInfo(token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get user info",
		})
		return
	}
	
	// Check if user exists and create if not
	user, err := h.userService.FindOrCreateUser(&model.User{
		OAuthID:  userInfo.ID,
		Email:    userInfo.Email,
		Name:     userInfo.Name,
		Provider: "google", // or whichever provider you're using
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to process user",
		})
		return
	}
	
	// Generate JWT token
	jwtToken, err := h.jwtService.GenerateToken(user.ID, user.Email, user.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to generate token",
		})
		return
	}
	
	// Return the token or redirect to frontend with token
	// For API usage:
	c.JSON(http.StatusOK, gin.H{
		"token": jwtToken,
	})
	
	// For webapp redirect (uncomment this and comment the JSON response above)
	// c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("http://your-frontend-url/?token=%s", jwtToken))
}
