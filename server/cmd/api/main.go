// cmd/api/main.go
package main

import (
	"log"
	"os"
	"time"
	
	"github.com/gin-gonic/gin"
	"github.com/gin-contrib/cors"
	"github.com/joho/godotenv"
	"github.com/mjxoro/sent/server/internal/auth"
	"github.com/mjxoro/sent/server/internal/config"
	"github.com/mjxoro/sent/server/internal/handler"
	"github.com/mjxoro/sent/server/internal/service"
)

func main() {
	// Load environment variables
	err := godotenv.Load("configs/app.env")
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}
	
	// Load application configuration
	cfg := config.Load()
	
	// Initialize services
	oauthService := auth.NewOAuthService(cfg)
	jwtService := auth.NewJWTService()
	
	// Create a mock user service for now (replace with real implementation later)
	userService := &service.UserService{}
	
	// Initialize handlers
	authHandler := handler.NewAuthHandler(oauthService, jwtService, userService)
	
	// Set Gin mode
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	
	// Create router
	r := gin.Default()
	
	// Add CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"}, // Your frontend URL
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	
	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})
	
	// API routes
	api := r.Group("/api")
	{
		// Auth routes
		authRoutes := api.Group("/auth")
		{
			authRoutes.GET("/login", authHandler.Login)
			authRoutes.GET("/callback", authHandler.Callback)
		}
		
		// Protected routes
		protected := api.Group("/")
		protected.Use(auth.AuthMiddleware(jwtService))
		{
			protected.GET("/profile", func(c *gin.Context) {
				userID, _ := c.Get("userID")
				name, _ := c.Get("name")
				email, _ := c.Get("email")
				
				c.JSON(200, gin.H{
					"id":    userID,
					"name":  name,
					"email": email,
				})
			})
		}
	}
	
	// Start server
	port := cfg.Server.Port
	log.Printf("Server starting on :%s\n", port)
	r.Run(":" + port)
}
