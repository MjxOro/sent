// internal/handler/auth_handler.go
package handler

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/mjxoro/sent/server/internal/auth"
	"github.com/mjxoro/sent/server/internal/models"
	"github.com/mjxoro/sent/server/internal/service"
	"net/http"
	"os"
)

// AuthHandler handles authentication requests
type AuthHandler struct {
	oauthService        *auth.OAuthService
	jwtService          *auth.JWTService
	userService         *service.UserService
	refreshTokenService *service.RefreshTokenService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(oauthService *auth.OAuthService, jwtService *auth.JWTService, userService *service.UserService, refreshTokenService *service.RefreshTokenService) *AuthHandler {
	return &AuthHandler{
		oauthService:        oauthService,
		jwtService:          jwtService,
		userService:         userService,
		refreshTokenService: refreshTokenService,
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
	user, err := h.userService.FindOrCreateFromOAuth(&models.User{
		OAuthID: userInfo.ID,
		Email:   userInfo.Email,
		Name:    userInfo.Name,
		Avatar:  userInfo.Picture,
	}, "google")
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

	// Generate refresh token
	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to generate refresh token",
		})
		return
	}

	// Store refresh token in database
	refreshExpiry := h.jwtService.GetRefreshTokenExpiry()
	err = h.refreshTokenService.Store(user.ID, refreshToken, refreshExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to store refresh token",
		})
		return
	}

	// Set access token cookie
	c.SetCookie(
		"auth_token", // name
		jwtToken,     // value
		3600*24,      // max age (24 hours)
		"/",          // path
		"",           // domain
		true,         // secure
		true,         // HTTP only
	)

	// Set refresh token cookie
	c.SetCookie(
		"refresh_token", // name
		refreshToken,    // value
		3600*24*30,      // max age (30 days)
		"/",             // path
		"",              // domain
		true,            // secure
		true,            // HTTP only
	)

	// Redirect to frontend
	redirectURI := os.Getenv("FRONTEND_URI")
	if redirectURI == "" {
		redirectURI = "http://localhost:3000/"
	}
	c.Redirect(http.StatusFound, fmt.Sprintf("%s/", redirectURI))
}

// RefreshToken handles refreshing an expired access token
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// Struct to bind JSON body
	var req struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}

	// Bind the JSON body to the struct
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "refresh_token is required in the request body"})
		return
	}

	fmt.Println(req.RefreshToken)
	// Validate refresh token
	claims, err := h.jwtService.ValidateToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	// Check if refresh token exists in database and is valid
	isValid, err := h.refreshTokenService.Validate(claims.UserID, req.RefreshToken)
	if err != nil || !isValid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token not valid"})
		return
	}

	// Get user information
	user, err := h.userService.GetByID(claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user"})
		return
	}

	// Generate new access token
	newAccessToken, err := h.jwtService.GenerateToken(user.ID, user.Email, user.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "token refreshed successfully", "auth_token": newAccessToken})
}
