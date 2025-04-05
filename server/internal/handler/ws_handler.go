// internal/handler/ws_handler.go (update)
package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	gorillaWs "github.com/gorilla/websocket"
	"github.com/mjxoro/sent/server/internal/service"
	"github.com/mjxoro/sent/server/pkg/websocket"
)

// WSHandler handles WebSocket connections
type WSHandler struct {
	hub         *websocket.Hub
	chatService *service.ChatService
	userService *service.UserService
}

// NewWSHandler creates a new WebSocket handler
func NewWSHandler(
	hub *websocket.Hub,
	chatService *service.ChatService,
	userService *service.UserService,
) *WSHandler {
	return &WSHandler{
		hub:         hub,
		chatService: chatService,
		userService: userService,
	}
}

// MessagePayload represents a message from the client
type MessagePayload struct {
	Type    string          `json:"type"`
	Content string          `json:"content"`
	RoomID  string          `json:"room_id"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// HandleConnection handles WebSocket connections
func (h *WSHandler) HandleConnection(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		// Fall back to query parameter for testing
		userID = c.Query("user_id")
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
	}

	roomID := c.Param("roomId")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room ID is required"})
		return
	}

	// Get user info
	user, err := h.userService.GetByID(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user"})
		return
	}

	// Check if user is a member of the room
	// This could be added later for more security

	upgrader := gorillaWs.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			// For development, allow all origins
			return true
		},
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Error upgrading connection: %v", err)
		return
	}

	// Create client and register with hub
	client := websocket.NewClient(h.hub, conn, userID, roomID)
	h.hub.Register <- client

	// Send user joined message to room
	joinMsg := map[string]interface{}{
		"type":      "system",
		"action":    "joined",
		"user_id":   user.ID,
		"user_name": user.Name,
		"room_id":   roomID,
		"timestamp": time.Now(),
	}
	joinMsgBytes, _ := json.Marshal(joinMsg)
	h.hub.Broadcast <- &websocket.Message{
		Data:   joinMsgBytes,
		Room:   roomID,
		Client: client,
	}

	// Handle incoming messages
	go func() {
		defer func() {
			h.hub.Unregister <- client
			conn.Close()

			// Send user left message
			leftMsg := map[string]interface{}{
				"type":      "system",
				"action":    "left",
				"user_id":   user.ID,
				"user_name": user.Name,
				"room_id":   roomID,
				"timestamp": time.Now(),
			}
			leftMsgBytes, _ := json.Marshal(leftMsg)
			h.hub.Broadcast <- &websocket.Message{
				Data:   leftMsgBytes,
				Room:   roomID,
				Client: client,
			}
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				if gorillaWs.IsUnexpectedCloseError(err, gorillaWs.CloseGoingAway, gorillaWs.CloseAbnormalClosure) {
					log.Printf("Error: %v", err)
				}
				break
			}

			// Parse message
			var payload MessagePayload
			if err := json.Unmarshal(message, &payload); err != nil {
				log.Printf("Error parsing message: %v", err)
				continue
			}

			// Handle different message types
			switch payload.Type {
			case "message":
				// Save message to database
				dbMsg, err := h.chatService.SendMessage(roomID, userID, payload.Content)
				if err != nil {
					log.Printf("Error saving message: %v", err)
					continue
				}

				// Prepare message for broadcasting
				broadcastMsg := map[string]interface{}{
					"id":        dbMsg.ID,
					"type":      "message",
					"content":   payload.Content,
					"user_id":   user.ID,
					"user_name": user.Name,
					"room_id":   roomID,
					"timestamp": dbMsg.CreatedAt,
				}
				broadcastMsgBytes, _ := json.Marshal(broadcastMsg)

				// Broadcast to all clients in room
				h.hub.Broadcast <- &websocket.Message{
					Data:   broadcastMsgBytes,
					Room:   roomID,
					Client: client,
				}

			case "typing":
				// Broadcast typing indicator
				typingMsg := map[string]interface{}{
					"type":      "typing",
					"user_id":   user.ID,
					"user_name": user.Name,
					"room_id":   roomID,
					"timestamp": time.Now(),
				}
				typingMsgBytes, _ := json.Marshal(typingMsg)

				h.hub.Broadcast <- &websocket.Message{
					Data:   typingMsgBytes,
					Room:   roomID,
					Client: client,
				}

			case "read":
				// Mark messages as read
				// Extract message IDs from payload data
				var readData struct {
					MessageIDs []string `json:"message_ids"`
				}
				if err := json.Unmarshal(payload.Data, &readData); err != nil {
					log.Printf("Error parsing read data: %v", err)
					continue
				}

				// Mark each message as read
				for _, msgID := range readData.MessageIDs {
					if err := h.chatService.MarkMessageAsRead(msgID, userID); err != nil {
						log.Printf("Error marking message as read: %v", err)
					}
				}
			}
		}
	}()

	// Start client write pump
	go client.WritePump()
}
