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

	h.redisPubSub.Subscribe(channel, func(message []byte) {
		if client != nil && client.Send != nil {
			client.Send <- message
		}
	})
}

// Add method to send notifications
func (h *NotificationHandler) SendNotification(userID string, payload NotificationPayload) error {
	channel := fmt.Sprintf("user:notify:%s", userID)
	return h.redisPubSub.PublishMessage(channel, payload)
}
