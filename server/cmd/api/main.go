// cmd/api/main.go (update)
package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/mjxoro/sent/server/internal/auth"
	"github.com/mjxoro/sent/server/internal/config"
	"github.com/mjxoro/sent/server/internal/db/postgres"
	"github.com/mjxoro/sent/server/internal/db/redis"
	"github.com/mjxoro/sent/server/internal/handler"
	"github.com/mjxoro/sent/server/internal/service"
	"github.com/mjxoro/sent/server/pkg/websocket"
)

func main() {
	// Load environment variables
	err := godotenv.Load("configs/app.env")
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	// Load application configuration
	cfg := config.Load()

	// Initialize database connections
	pgDB, err := postgres.NewDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pgDB.Close()

	redisClient, err := redis.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Initialize repositories
	pgUser := postgres.NewUser(pgDB)
	pgRoom := postgres.NewRoom(pgDB)
	pgMessage := postgres.NewMessage(pgDB)
	pgRefreshToken := postgres.NewRefreshToken(pgDB)

	// Initialize services
	userService := service.NewUserService(pgUser)
	chatService := service.NewChatService(pgRoom, pgMessage, redisClient)
	refreshTokenService := service.NewRefreshTokenService(pgRefreshToken)

	// Initialize auth services
	oauthService := auth.NewOAuthService(cfg)
	jwtService := auth.NewJWTService()

	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Initialize handlers
	authHandler := handler.NewAuthHandler(oauthService, jwtService, userService, refreshTokenService)
	wsHandler := handler.NewWSHandler(hub, chatService, userService, jwtService)

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
			authRoutes.POST("/refresh_token", authHandler.RefreshToken)
		}

		// Protected routes
		protected := api.Group("/")
		protected.Use(auth.AuthMiddleware(jwtService))
		{
			// User routes
			protected.GET("/user/profile", func(c *gin.Context) {
				userID := c.GetString("userID")
				user, err := userService.GetByID(userID)
				if err != nil {
					c.JSON(404, gin.H{"error": "user not found"})
					return
				}
				c.JSON(200, user)
			})

			// Room routes
			protected.GET("/rooms", func(c *gin.Context) {
				userID := c.GetString("userID")
				rooms, err := chatService.GetUserRooms(userID)
				if err != nil {
					c.JSON(500, gin.H{"error": "failed to get rooms"})
					return
				}
				c.JSON(200, rooms)
			})

			protected.POST("/rooms", func(c *gin.Context) {
				userID := c.GetString("userID")
				var req struct {
					Name        string `json:"name" binding:"required"`
					Description string `json:"description"`
					IsPrivate   bool   `json:"is_private"`
				}
				if err := c.ShouldBindJSON(&req); err != nil {
					c.JSON(400, gin.H{"error": err.Error()})
					return
				}

				room, err := chatService.CreateRoom(req.Name, req.Description, req.IsPrivate, userID)
				if err != nil {
					c.JSON(500, gin.H{"error": "failed to create room"})
					return
				}
				c.JSON(201, room)
			})

			protected.POST("/dm/:userId", func(c *gin.Context) {
				userID := c.GetString("userID")
				targetUserID := c.Param("userId")

				room, err := chatService.CreateDirectMessageRoom(userID, targetUserID)
				if err != nil {
					c.JSON(500, gin.H{"error": "failed to create DM room"})
					return
				}
				c.JSON(201, room)
			})

			protected.GET("/rooms/:roomId/messages", func(c *gin.Context) {
				roomID := c.Param("roomId")
				limit := 50
				offset := 0

				if limitParam := c.Query("limit"); limitParam != "" {
					if _, err := fmt.Sscanf(limitParam, "%d", &limit); err != nil {
						limit = 50
					}
				}

				if offsetParam := c.Query("offset"); offsetParam != "" {
					if _, err := fmt.Sscanf(offsetParam, "%d", &offset); err != nil {
						offset = 0
					}
				}

				messages, err := chatService.GetRoomMessages(roomID, limit, offset)
				if err != nil {
					c.JSON(500, gin.H{"error": "failed to get messages"})
					return
				}
				c.JSON(200, messages)
			})

			// WebSocket endpoint - Single connection for all rooms
			protected.GET("/ws", wsHandler.HandleConnection)
		}
		protected.GET("/rooms/:roomId", func(c *gin.Context) {
			userID := c.GetString("userID")
			roomID := c.Param("roomId")

			// Get room details
			room, err := chatService.GetRoomDetails(roomID)
			if err != nil {
				c.JSON(404, gin.H{"error": "room not found"})
				return
			}

			// Check if user is a member of the room
			isMember, err := chatService.IsUserMemberOfRoom(userID, roomID)
			if err != nil || !isMember {
				c.JSON(403, gin.H{"error": "access denied"})
				return
			}

			// Return room details
			c.JSON(200, room)
		})
	}

	// Start server
	port := cfg.Server.Port
	log.Printf("Server starting on :%s\n", port)
	r.Run(":" + port)
}
