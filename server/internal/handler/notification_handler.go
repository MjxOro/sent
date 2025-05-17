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

	// Start subscription in a goroutine with cancellation
	go func() {
		h.redisPubSub.Subscribe(channel, func(message []byte) {
			select {
			case <-done:
				return
			default:
				// Only try to send if client is still connected
				if client != nil && client.Send != nil {
					select {
					case client.Send <- message:
						fmt.Printf("Sent notification to user %s\n", userID)
					default:
						fmt.Printf("Failed to send notification: channel full or closed\n")
						return
					}
				}
			}
		})
	}()

	// Wait for client to disconnect - FIXED THIS LINE
	<-client.Done // We just read from the channel instead of trying to call it
}

// Add method to send notifications
func (h *NotificationHandler) SendNotification(userID string, payload NotificationPayload) error {
	channel := fmt.Sprintf("user:notify:%s", userID)
	return h.redisPubSub.PublishMessage(channel, payload)
}
