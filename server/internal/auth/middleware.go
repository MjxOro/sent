// internal/auth/middleware.go
package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware creates middleware for JWT authentication
func AuthMiddleware(jwtService *JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// First check Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			// Check if the header has the Bearer prefix
			headerParts := strings.Split(authHeader, " ")
			if len(headerParts) == 2 && headerParts[0] == "Bearer" {
				tokenString = headerParts[1]
			}
		}

		// If no token in header, check cookie
		if tokenString == "" {
			cookie, err := c.Cookie("auth_token")
			if err == nil {
				tokenString = cookie
			}
		}

		// If still no token, return unauthorized
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}

		// Validate the token
		claims, err := jwtService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// Set the user ID in the context
		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("name", claims.Name)
		c.Next()
	}
}
