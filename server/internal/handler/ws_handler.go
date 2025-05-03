// internal/handler/ws_handler.go
package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	gorillaWs "github.com/gorilla/websocket"
	"github.com/mjxoro/sent/server/internal/auth"
	"github.com/mjxoro/sent/server/internal/models"
	"github.com/mjxoro/sent/server/internal/service"
	"github.com/mjxoro/sent/server/pkg/websocket"
)

// WSHandler handles WebSocket connections
type WSHandler struct {
	hub         *websocket.Hub
	chatService *service.ChatService
	userService *service.UserService
	jwtService  *auth.JWTService
}

// NewWSHandler creates a new WebSocket handler
func NewWSHandler(
	hub *websocket.Hub,
	chatService *service.ChatService,
	userService *service.UserService,
	jwtService *auth.JWTService,
) *WSHandler {
	return &WSHandler{
		hub:         hub,
		chatService: chatService,
		userService: userService,
		jwtService:  jwtService,
	}
}

// ClientMessage represents a message from the client
type ClientMessage struct {
	Type    string          `json:"type"`
	RoomID  string          `json:"room_id"`
	Content string          `json:"content,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// ServerResponse represents responses to the client
type ServerResponse struct {
	Type      string          `json:"type"`
	Success   bool            `json:"success"`
	Message   string          `json:"message,omitempty"`
	RoomID    string          `json:"room_id,omitempty"`
	ThreadID  string          `json:"thread_id,omitempty"`
	MessageID string          `json:"message_id,omitempty"`
	Data      json.RawMessage `json:"data,omitempty"`
}

// HandleConnection handles WebSocket connections
func (h *WSHandler) HandleConnection(c *gin.Context) {
	// Grab token from params
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return // Added return statement
	}

	// Validate Token then decode to get user id
	claims, err := h.jwtService.ValidateToken(token)
	if err != nil {
		log.Printf("Invalid token: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return // Added return statement
	}

	userID := claims.UserID

	// Get user info
	user, err := h.userService.GetByID(userID)
	if err != nil {
		log.Printf("User not found: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user"})
		return
	}

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
	client := websocket.NewClient(h.hub, conn, userID)
	h.hub.Register <- client

	// Log the successful connection
	log.Printf("WebSocket connection established for user: %s (%s)", user.Name, userID)

	// Start server-side goroutines
	go h.handleMessages(client, user)
	go client.WritePump()
}

// handleMessages handles incoming messages from a client
func (h *WSHandler) handleMessages(client *websocket.Client, user *models.User) {
	defer func() {
		// Recover from any panics
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in handleMessages: %v", r)
		}

		h.hub.Unregister <- client
		client.Conn.Close()

		// For each room the client was in, send a left message
		for roomID := range client.Rooms {
			leftMsg := websocket.Message{
				Type:      "system",
				RoomID:    roomID,
				UserID:    user.ID,
				Action:    "left",
				Timestamp: time.Now(),
				Data:      json.RawMessage(fmt.Sprintf(`{"user_name":"%s"}`, user.Name)),
				Client:    client,
			}

			leftMsgBytes, _ := json.Marshal(leftMsg)

			h.hub.Broadcast <- &websocket.Message{
				Type:   "system",
				RoomID: roomID,
				Data:   leftMsgBytes,
				Client: client,
			}
		}
	}()

	for {
		_, msgBytes, err := client.Conn.ReadMessage()
		if err != nil {
			if gorillaWs.IsUnexpectedCloseError(err, gorillaWs.CloseGoingAway, gorillaWs.CloseAbnormalClosure) {
				log.Printf("Error: %v", err)
			}
			break
		}

		// Log the raw message for debugging
		log.Printf("Received raw message from client %s: %s", client.ID, string(msgBytes))

		// Parse the raw client message
		var clientMsg ClientMessage
		if err := json.Unmarshal(msgBytes, &clientMsg); err != nil {
			log.Printf("Error parsing message: %v, raw message: %s", err, string(msgBytes))
			// Send error response to client
			errResp := ServerResponse{
				Type:    "error",
				Success: false,
				Message: "Invalid message format",
			}
			errRespBytes, _ := json.Marshal(errResp)
			client.Send <- errRespBytes
			continue
		}

		log.Printf("Parsed message from client %s: %+v", client.ID, clientMsg)

		// Process different message types
		switch clientMsg.Type {
		case "create_thread":
			// Handle thread creation with server-side UUID
			var createData struct {
				Title string `json:"title"`
			}

			if err := json.Unmarshal(clientMsg.Data, &createData); err != nil {
				log.Printf("Error parsing thread creation data: %v", err)
				// Send error response
				errResp := ServerResponse{
					Type:    "thread_created",
					Success: false,
					Message: "Invalid thread creation data",
				}
				errRespBytes, _ := json.Marshal(errResp)
				client.Send <- errRespBytes
				continue
			}

			// Create the thread in database
			// UUID is generated inside CreateRoom method
			room, err := h.chatService.CreateRoom(createData.Title, "", false, user.ID)
			if err != nil {
				log.Printf("Error creating room: %v", err)

				// Send error response
				errResp := ServerResponse{
					Type:    "thread_created",
					Success: false,
					Message: "Failed to create thread",
				}
				errRespBytes, _ := json.Marshal(errResp)
				client.Send <- errRespBytes
				continue
			}

			// Send response with the new thread ID
			response := ServerResponse{
				Type:     "thread_created",
				Success:  true,
				ThreadID: room.ID,
				RoomID:   room.ID, // Same as thread ID in this case
				Data:     json.RawMessage(fmt.Sprintf(`{"title":"%s"}`, createData.Title)),
			}

			responseBytes, _ := json.Marshal(response)
			client.Send <- responseBytes
			log.Printf("Thread created: %s", room.ID)

		case "subscribe":
			// Handle room subscription
			if clientMsg.RoomID == "" {
				log.Printf("Subscribe message missing room_id from client %s", client.ID)
				continue
			}

			log.Printf("Client %s subscribing to room %s", client.ID, clientMsg.RoomID)

			// Subscribe client to room
			h.hub.Subscribe <- &websocket.Subscription{
				Client: client,
				Room:   clientMsg.RoomID,
			}

			// Send a joined message to the room
			joinedMsg := websocket.Message{
				Type:      "system",
				RoomID:    clientMsg.RoomID,
				UserID:    user.ID,
				Action:    "joined",
				Timestamp: time.Now(),
				Data:      json.RawMessage(fmt.Sprintf(`{"user_name":"%s"}`, user.Name)),
			}

			joinedBytes, _ := json.Marshal(joinedMsg)

			// Broadcast to all clients in the room
			h.hub.Broadcast <- &websocket.Message{
				RoomID: clientMsg.RoomID,
				Data:   joinedBytes,
				Client: client,
			}

			// Send recent messages history to the client
			go h.sendRoomHistory(client, clientMsg.RoomID)

		case "unsubscribe":
			// Handle room unsubscription
			if clientMsg.RoomID == "" {
				log.Printf("Unsubscribe message missing room_id from client %s", client.ID)
				continue
			}

			log.Printf("Client %s unsubscribing from room %s", client.ID, clientMsg.RoomID)

			// Unsubscribe client from room
			h.hub.Unsubscribe <- &websocket.Subscription{
				Client: client,
				Room:   clientMsg.RoomID,
			}

			// Send a left message to the room
			leftMsg := websocket.Message{
				Type:      "system",
				RoomID:    clientMsg.RoomID,
				UserID:    user.ID,
				Action:    "left",
				Timestamp: time.Now(),
				Data:      json.RawMessage(fmt.Sprintf(`{"user_name":"%s"}`, user.Name)),
			}

			leftBytes, _ := json.Marshal(leftMsg)

			// Broadcast to all clients in the room
			h.hub.Broadcast <- &websocket.Message{
				RoomID: clientMsg.RoomID,
				Data:   leftBytes,
				Client: client,
			}

		case "message":
			// Handle chat message
			if clientMsg.RoomID == "" || clientMsg.Content == "" {
				log.Printf("Message missing room_id or content from client %s", client.ID)
				continue
			}

			// Verify client is in the room
			if !client.IsInRoom(clientMsg.RoomID) {
				log.Printf("Client %s attempted to send message to room %s without subscription", client.ID, clientMsg.RoomID)
				// Send error response
				errResp := ServerResponse{
					Type:    "message_sent",
					Success: false,
					RoomID:  clientMsg.RoomID,
					Message: "Not subscribed to room",
				}
				errRespBytes, _ := json.Marshal(errResp)
				client.Send <- errRespBytes
				continue
			}

			log.Printf("Client %s sending message to room %s: %s", client.ID, clientMsg.RoomID, clientMsg.Content)

			// Save message to database
			dbMsg, err := h.chatService.SendMessage(clientMsg.RoomID, user.ID, clientMsg.Content)
			if err != nil {
				log.Printf("Error saving message: %v", err)
				// Send error response
				errResp := ServerResponse{
					Type:    "message_sent",
					Success: false,
					RoomID:  clientMsg.RoomID,
					Message: "Failed to save message",
				}
				errRespBytes, _ := json.Marshal(errResp)
				client.Send <- errRespBytes
				continue
			}

			// FIX: Create a proper message object with all fields directly in the main structure
			// Don't nest important fields in the Data property
			messageObj := map[string]interface{}{
				"type":        "message",
				"id":          dbMsg.ID,
				"room_id":     clientMsg.RoomID,
				"user_id":     user.ID,
				"content":     clientMsg.Content,
				"created_at":  dbMsg.CreatedAt,
				"updated_at":  dbMsg.UpdatedAt,
				"user_name":   user.Name,
				"user_avatar": user.Avatar,
			}

			respBytes, _ := json.Marshal(messageObj)

			// Send confirmation back to the sender with the message ID
			confirmMsg := ServerResponse{
				Type:      "message_sent",
				Success:   true,
				RoomID:    clientMsg.RoomID,
				MessageID: dbMsg.ID,
			}
			confirmBytes, _ := json.Marshal(confirmMsg)
			client.Send <- confirmBytes

			// Broadcast to all clients in the room
			h.hub.Broadcast <- &websocket.Message{
				RoomID: clientMsg.RoomID,
				Data:   respBytes,
				Client: client,
			}

			log.Printf("Message broadcast to room %s, message ID: %s", clientMsg.RoomID, dbMsg.ID)

		case "typing":
			// Handle typing indicator
			if clientMsg.RoomID == "" {
				log.Printf("Typing message missing room_id from client %s", client.ID)
				continue
			}

			// Verify client is in the room
			if !client.IsInRoom(clientMsg.RoomID) {
				log.Printf("Client %s attempted to send typing indicator to room %s without subscription", client.ID, clientMsg.RoomID)
				continue
			}

			// Extract typing status from data
			var typingData struct {
				IsTyping bool `json:"is_typing"`
			}

			if err := json.Unmarshal(clientMsg.Data, &typingData); err != nil {
				log.Printf("Error parsing typing data: %v", err)
				continue
			}

			// Create typing message
			typingObj := map[string]interface{}{
				"type":      "typing",
				"room_id":   clientMsg.RoomID,
				"user_id":   user.ID,
				"timestamp": time.Now(),
				"data": map[string]interface{}{
					"user_name": user.Name,
					"is_typing": typingData.IsTyping,
				},
			}

			typingBytes, _ := json.Marshal(typingObj)

			// Broadcast to all clients in the room
			h.hub.Broadcast <- &websocket.Message{
				RoomID: clientMsg.RoomID,
				Data:   typingBytes,
				Client: client,
			}

		case "read":
			// Handle read receipts
			if clientMsg.RoomID == "" {
				log.Printf("Read message missing room_id from client %s", client.ID)
				continue
			}

			// Verify client is in the room
			if !client.IsInRoom(clientMsg.RoomID) {
				log.Printf("Client %s attempted to send read receipt to room %s without subscription", client.ID, clientMsg.RoomID)
				continue
			}

			// Extract message IDs from data
			var readData struct {
				MessageIDs []string `json:"message_ids"`
			}

			if err := json.Unmarshal(clientMsg.Data, &readData); err != nil {
				log.Printf("Error parsing read data: %v", err)
				continue
			}

			// Mark each message as read
			for _, msgID := range readData.MessageIDs {
				if err := h.chatService.MarkMessageAsRead(msgID, user.ID); err != nil {
					log.Printf("Error marking message as read: %v", err)
				}
			}

			// Create read message
			readObj := map[string]interface{}{
				"type":        "read",
				"room_id":     clientMsg.RoomID,
				"user_id":     user.ID,
				"timestamp":   time.Now(),
				"message_ids": readData.MessageIDs,
			}

			readBytes, _ := json.Marshal(readObj)

			// Broadcast to all clients in the room
			h.hub.Broadcast <- &websocket.Message{
				RoomID: clientMsg.RoomID,
				Data:   readBytes,
				Client: client,
			}

		default:
			log.Printf("Unknown message type from client %s: %s", client.ID, clientMsg.Type)
		}
	}
}

// sendRoomHistory sends recent message history to a new client
// server/internal/handler/ws_handler.go

// sendRoomHistory sends recent message history to a new client
func (h *WSHandler) sendRoomHistory(client *websocket.Client, roomID string) {
	// Get recent messages for the room (e.g., last 50)
	messages, err := h.chatService.GetRoomMessages(roomID, 50, 0)
	if err != nil {
		log.Printf("Error fetching room messages: %v", err)
		return
	}

	// Check if we have messages
	if len(messages) == 0 {
		return
	}

	// No need to reverse the order - messages now come from the server newest first
	// and we'll send them in that same order to maintain consistency
	for _, msg := range messages {
		historyObj := map[string]interface{}{
			"type":        "message",
			"id":          msg.ID,
			"room_id":     roomID,
			"user_id":     msg.UserID,
			"content":     msg.Content,
			"created_at":  msg.CreatedAt,
			"updated_at":  msg.UpdatedAt,
			"user_name":   msg.UserName,
			"user_avatar": msg.UserAvatar,
			"history":     true,
		}

		historyBytes, _ := json.Marshal(historyObj)

		// Send directly to the client
		select {
		case client.Send <- historyBytes:
		default:
			// If client's buffer is full, stop sending history
			return
		}

		// Small delay to avoid flooding the client
		time.Sleep(5 * time.Millisecond)
	}
}
