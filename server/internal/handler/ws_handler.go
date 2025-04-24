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
	}

	// Validate Token then decode to get user id

	claims, err := h.jwtService.ValidateToken(token)
	userID := claims.UserID

	// Get user info
	user, err := h.userService.GetByID(userID)
	if err != nil {
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

	// Start server-side goroutines
	go h.handleMessages(client, user)
	go client.WritePump()
}

// handleMessages handles incoming messages from a client
func (h *WSHandler) handleMessages(client *websocket.Client, user *models.User) {
	defer func() {
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

		// Parse the raw client message
		var clientMsg ClientMessage
		if err := json.Unmarshal(msgBytes, &clientMsg); err != nil {
			log.Printf("Error parsing message: %v", err)
			continue
		}

		// Process different message types
		switch clientMsg.Type {
		case "create_thread":
			// Handle thread creation with server-side UUID
			var createData struct {
				Title string `json:"title"`
			}

			if err := json.Unmarshal(clientMsg.Data, &createData); err != nil {
				log.Printf("Error parsing thread creation data: %v", err)
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

		case "subscribe":
			// Handle room subscription
			if clientMsg.RoomID == "" {
				continue
			}

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
				continue
			}

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
				continue
			}

			// Verify client is in the room
			if !client.IsInRoom(clientMsg.RoomID) {
				log.Printf("Client %s attempted to send message to room %s without subscription", client.ID, clientMsg.RoomID)
				continue
			}

			// Save message to database
			dbMsg, err := h.chatService.SendMessage(clientMsg.RoomID, user.ID, clientMsg.Content)
			if err != nil {
				log.Printf("Error saving message: %v", err)
				continue
			}

			// Create response message
			respMsg := websocket.Message{
				Type:      "message",
				RoomID:    clientMsg.RoomID,
				UserID:    user.ID,
				Content:   clientMsg.Content,
				Timestamp: dbMsg.CreatedAt,
				Data:      json.RawMessage(fmt.Sprintf(`{"id":"%s","user_name":"%s"}`, dbMsg.ID, user.Name)),
			}

			respBytes, _ := json.Marshal(respMsg)

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

		case "typing":
			// Handle typing indicator
			if clientMsg.RoomID == "" {
				continue
			}

			// Verify client is in the room
			if !client.IsInRoom(clientMsg.RoomID) {
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
			typingMsg := websocket.Message{
				Type:      "typing",
				RoomID:    clientMsg.RoomID,
				UserID:    user.ID,
				Timestamp: time.Now(),
				Data:      json.RawMessage(fmt.Sprintf(`{"user_name":"%s","is_typing":%t}`, user.Name, typingData.IsTyping)),
			}

			typingBytes, _ := json.Marshal(typingMsg)

			// Broadcast to all clients in the room
			h.hub.Broadcast <- &websocket.Message{
				RoomID: clientMsg.RoomID,
				Data:   typingBytes,
				Client: client,
			}

		case "read":
			// Handle read receipts
			if clientMsg.RoomID == "" {
				continue
			}

			// Verify client is in the room
			if !client.IsInRoom(clientMsg.RoomID) {
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
			readMsg := websocket.Message{
				Type:      "read",
				RoomID:    clientMsg.RoomID,
				UserID:    user.ID,
				Timestamp: time.Now(),
				Data:      clientMsg.Data, // Pass through the message IDs
			}

			readBytes, _ := json.Marshal(readMsg)

			// Broadcast to all clients in the room
			h.hub.Broadcast <- &websocket.Message{
				RoomID: clientMsg.RoomID,
				Data:   readBytes,
				Client: client,
			}
		}
	}
}

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

	// Reverse the order to send oldest first
	for i := len(messages) - 1; i >= 0; i-- {
		msg := messages[i]

		// Create history message - now we can use msg.UserName directly
		historyMsg := websocket.Message{
			Type:      "message",
			RoomID:    roomID,
			UserID:    msg.UserID,
			Content:   msg.Content,
			Timestamp: msg.CreatedAt,
			Data:      json.RawMessage(fmt.Sprintf(`{"id":"%s","user_name":"%s","history":true}`, msg.ID, msg.UserName)),
		}

		historyBytes, _ := json.Marshal(historyMsg)

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
