// File: server/internal/handler/notification_handler.go

package handler

import (
	"fmt"
	"github.com/mjxoro/sent/server/internal/db/redis" // For PubSub
	"github.com/mjxoro/sent/server/pkg/websocket"     // For Client
)

type NotificationHandler struct {
	redisPubSub *redis.PubSub
}

func NewNotificationHandler(redisPubSub *redis.PubSub) *NotificationHandler {
	return &NotificationHandler{
		redisPubSub: redisPubSub,
	}
}

// You might also want to add some notification types
type NotificationType string

const (
	NotificationTypeRoomAdded     NotificationType = "room_added"
	NotificationTypeMessage       NotificationType = "message"
	NotificationTypeFriendRequest NotificationType = "friend_request"
)

type NotificationPayload struct {
	Type    NotificationType `json:"type"`
	RoomID  string           `json:"room_id,omitempty"`
	Message string           `json:"message,omitempty"`
	Data    interface{}      `json:"data,omitempty"`
}

func (h *NotificationHandler) HandleUserNotifications(client *websocket.Client, userID string) {
	channel := fmt.Sprintf("user:notify:%s", userID)
	fmt.Printf("Subscribing to notification channel: %s\n", channel)

	// Create a done channel for clean shutdown
	done := make(chan struct{})
	defer close(done)

	// Use a separate error channel
	errChan := make(chan error, 1)

	// Start subscription in a goroutine
	go func() {
		h.redisPubSub.Subscribe(channel, func(message []byte) {
			// Check if client is still valid
			if client == nil {
				errChan <- fmt.Errorf("client is nil")
				return
			}

			select {
			case <-done:
				return
			default:
				// Try to send the message
				select {
				case client.Send <- message:
					fmt.Printf("Sent notification to user %s\n", userID)
				case <-client.Done:
					// Client disconnected
					return
				default:
					// Channel is full or closed
					fmt.Printf("Failed to send notification: channel full or closed\n")
					return
				}
			}
		}, done)
	}()

	// Wait for either client disconnect or error
	select {
	case <-client.Done:
		fmt.Printf("Client %s disconnected, stopping notification handler\n", userID)
	case err := <-errChan:
		fmt.Printf("Error in notification handler for user %s: %v\n", userID, err)
	}
}

// Add method to send notifications
func (h *NotificationHandler) SendNotification(userID string, payload NotificationPayload) error {
	channel := fmt.Sprintf("user:notify:%s", userID)
	return h.redisPubSub.PublishMessage(channel, payload)
}
