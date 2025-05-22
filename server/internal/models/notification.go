// internal/models/notification.go
package models

import (
	"time"
)

// NotificationType defines the type of notification
type NotificationType string

const (
	NotificationTypeMessage       NotificationType = "message"
	NotificationTypeFriendRequest NotificationType = "friend_request"
	NotificationTypeChatInvite    NotificationType = "chat_invite"
)

// BaseNotification represents the common fields for all notifications
type BaseNotification struct {
	ID        string           `json:"id" db:"id"`
	Type      NotificationType `json:"type" db:"type"`
	UserID    string           `json:"user_id" db:"user_id"` // recipient
	IsRead    bool             `json:"is_read" db:"is_read"`
	CreatedAt time.Time        `json:"created_at" db:"created_at"`
}

// MessageNotification represents a message notification
type MessageNotification struct {
	BaseNotification
	MessageID string `json:"message_id" db:"message_id"`
	RoomID    string `json:"room_id" db:"room_id"`
	SenderID  string `json:"sender_id" db:"sender_id"`
	Content   string `json:"content" db:"content"`
	// Joined fields from related tables
	SenderName   string `json:"sender_name" db:"sender_name"`
	SenderAvatar string `json:"sender_avatar" db:"sender_avatar"`
	RoomName     string `json:"room_name" db:"room_name"`
}

// FriendRequestNotification represents a friend request notification
type FriendRequestNotification struct {
	BaseNotification
	FriendshipID string `json:"friendship_id" db:"friendship_id"`
	RequesterID  string `json:"requester_id" db:"requester_id"`
	// Joined fields from related tables
	RequesterName   string `json:"requester_name" db:"requester_name"`
	RequesterAvatar string `json:"requester_avatar" db:"requester_avatar"`
}

// ChatInviteNotification represents a chat invitation notification
type ChatInviteNotification struct {
	BaseNotification
	RoomID    string `json:"room_id" db:"room_id"`
	InviterID string `json:"inviter_id" db:"inviter_id"`
	// Joined fields from related tables
	RoomName      string `json:"room_name" db:"room_name"`
	InviterName   string `json:"inviter_name" db:"inviter_name"`
	InviterAvatar string `json:"inviter_avatar" db:"inviter_avatar"`
}

// RoomMemberNotificationState tracks notification state for room members
type RoomMemberNotificationState struct {
	ID                string `json:"id" db:"id"`
	RoomID            string `json:"room_id" db:"room_id"`
	UserID            string `json:"user_id" db:"user_id"`
	LastReadMessageID string `json:"last_read_message_id" db:"last_read_message_id"`
	UnreadCount       int    `json:"unread_count" db:"unread_count"`
}

// NewMessageNotification creates a new message notification
func NewMessageNotification(userID, messageID, roomID, senderID, content string) *MessageNotification {
	return &MessageNotification{
		BaseNotification: BaseNotification{
			ID:        generateUUID(), // implement this based on your UUID package
			Type:      NotificationTypeMessage,
			UserID:    userID,
			IsRead:    false,
			CreatedAt: time.Now(),
		},
		MessageID: messageID,
		RoomID:    roomID,
		SenderID:  senderID,
		Content:   content,
	}
}

// NewFriendRequestNotification creates a new friend request notification
func NewFriendRequestNotification(userID, friendshipID, requesterID string) *FriendRequestNotification {
	return &FriendRequestNotification{
		BaseNotification: BaseNotification{
			ID:        generateUUID(),
			Type:      NotificationTypeFriendRequest,
			UserID:    userID,
			IsRead:    false,
			CreatedAt: time.Now(),
		},
		FriendshipID: friendshipID,
		RequesterID:  requesterID,
	}
}

// NewChatInviteNotification creates a new chat invite notification
func NewChatInviteNotification(userID, roomID, inviterID string) *ChatInviteNotification {
	return &ChatInviteNotification{
		BaseNotification: BaseNotification{
			ID:        generateUUID(),
			Type:      NotificationTypeChatInvite,
			UserID:    userID,
			IsRead:    false,
			CreatedAt: time.Now(),
		},
		RoomID:    roomID,
		InviterID: inviterID,
	}
}

// ToBaseNotification converts any notification type to BaseNotification
func (n *MessageNotification) ToBaseNotification() *BaseNotification {
	return &n.BaseNotification
}

func (n *FriendRequestNotification) ToBaseNotification() *BaseNotification {
	return &n.BaseNotification
}

func (n *ChatInviteNotification) ToBaseNotification() *BaseNotification {
	return &n.BaseNotification
}

// For Redis caching/WebSocket, you might want to convert to a generic format
type NotificationResponse struct {
	ID        string           `json:"id"`
	Type      NotificationType `json:"type"`
	UserID    string           `json:"user_id"`
	IsRead    bool             `json:"is_read"`
	CreatedAt time.Time        `json:"created_at"`
	Data      interface{}      `json:"data"`
}

// ToResponse converts notifications to response format
func (n *MessageNotification) ToResponse() *NotificationResponse {
	return &NotificationResponse{
		ID:        n.ID,
		Type:      n.Type,
		UserID:    n.UserID,
		IsRead:    n.IsRead,
		CreatedAt: n.CreatedAt,
		Data: map[string]interface{}{
			"message_id":    n.MessageID,
			"room_id":       n.RoomID,
			"sender_id":     n.SenderID,
			"content":       n.Content,
			"sender_name":   n.SenderName,
			"sender_avatar": n.SenderAvatar,
			"room_name":     n.RoomName,
		},
	}
}

func (n *FriendRequestNotification) ToResponse() *NotificationResponse {
	return &NotificationResponse{
		ID:        n.ID,
		Type:      n.Type,
		UserID:    n.UserID,
		IsRead:    n.IsRead,
		CreatedAt: n.CreatedAt,
		Data: map[string]interface{}{
			"friendship_id":    n.FriendshipID,
			"requester_id":     n.RequesterID,
			"requester_name":   n.RequesterName,
			"requester_avatar": n.RequesterAvatar,
		},
	}
}

func (n *ChatInviteNotification) ToResponse() *NotificationResponse {
	return &NotificationResponse{
		ID:        n.ID,
		Type:      n.Type,
		UserID:    n.UserID,
		IsRead:    n.IsRead,
		CreatedAt: n.CreatedAt,
		Data: map[string]interface{}{
			"room_id":        n.RoomID,
			"inviter_id":     n.InviterID,
			"room_name":      n.RoomName,
			"inviter_name":   n.InviterName,
			"inviter_avatar": n.InviterAvatar,
		},
	}
}

// generateUUID generates a new UUID (implement this based on your UUID package)
func generateUUID() string {
	// Implement using your preferred UUID package
	return "uuid" // placeholder
}
