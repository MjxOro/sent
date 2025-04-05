// internal/service/chat_service.go
package service

import (
	"encoding/json"
	"github.com/mjxoro/sent/server/internal/db/postgres"
	"github.com/mjxoro/sent/server/internal/db/redis"
	"github.com/mjxoro/sent/server/internal/models"
)

// ChatService handles chat-related business logic
type ChatService struct {
	pgRoom      *postgres.Room
	pgMessage   *postgres.Message
	redisClient *redis.Client
}

// NewChatService creates a new chat service
func NewChatService(pgRoom *postgres.Room, pgMessage *postgres.Message, redisClient *redis.Client) *ChatService {
	return &ChatService{
		pgRoom:      pgRoom,
		pgMessage:   pgMessage,
		redisClient: redisClient,
	}
}

// CreateRoom creates a new chat room
func (s *ChatService) CreateRoom(name, description string, isPrivate bool, creatorID string) (*model.Room, error) {
	room := &model.Room{
		Name:        name,
		Description: description,
		IsPrivate:   isPrivate,
		Type:        "group",
		CreatorID:   creatorID,
	}

	if err := s.pgRoom.Create(room); err != nil {
		return nil, err
	}

	// Add creator as member with admin role
	if err := s.pgRoom.AddMember(room.ID, creatorID, "admin"); err != nil {
		return nil, err
	}

	return room, nil
}

// CreateDirectMessageRoom creates a direct message room between two users
func (s *ChatService) CreateDirectMessageRoom(user1ID, user2ID string) (*model.Room, error) {
	// Check if DM room already exists
	room, err := s.pgRoom.FindDMRoom(user1ID, user2ID)
	if err == nil {
		// Room exists, return it
		return room, nil
	}

	// Create new DM room
	room = &model.Room{
		Name:      "", // DMs don't need names
		IsPrivate: true,
		Type:      "direct",
		CreatorID: user1ID,
	}

	if err := s.pgRoom.Create(room); err != nil {
		return nil, err
	}

	// Add both users as members
	if err := s.pgRoom.AddMember(room.ID, user1ID, "member"); err != nil {
		return nil, err
	}
	if err := s.pgRoom.AddMember(room.ID, user2ID, "member"); err != nil {
		return nil, err
	}

	return room, nil
}

// GetUserRooms gets all rooms a user is a member of
func (s *ChatService) GetUserRooms(userID string) ([]*model.Room, error) {
	return s.pgRoom.FindRoomsByUserID(userID)
}

// GetRoomMembers gets all members of a room
func (s *ChatService) GetRoomMembers(roomID string) ([]*model.User, error) {
	return s.pgRoom.GetRoomMembers(roomID)
}

// SendMessage sends a message to a room
func (s *ChatService) SendMessage(roomID, userID, content string) (*model.Message, error) {
	// Create message in database
	message := &model.Message{
		RoomID:  roomID,
		UserID:  userID,
		Content: content,
	}

	if err := s.pgMessage.Create(message); err != nil {
		return nil, err
	}

	// Publish message to Redis for real-time delivery
	ctx := s.redisClient.Context()

	messageData, err := json.Marshal(map[string]interface{}{
		"id":        message.ID,
		"room_id":   message.RoomID,
		"user_id":   message.UserID,
		"content":   message.Content,
		"timestamp": message.CreatedAt,
	})
	if err != nil {
		return nil, err
	}

	// Publish to Redis channel for this room
	s.redisClient.Publish(ctx, "chat:room:"+roomID, messageData)

	return message, nil
}

// GetRoomMessages gets messages from a room with pagination
func (s *ChatService) GetRoomMessages(roomID string, limit, offset int) ([]*model.Message, error) {
	return s.pgMessage.FindByRoomID(roomID, limit, offset)
}

// MarkMessageAsRead marks a message as read by a user
func (s *ChatService) MarkMessageAsRead(messageID, userID string) error {
	return s.pgMessage.MarkAsRead(messageID, userID)
}

// GetUnreadCount gets the count of unread messages in a room for a user
func (s *ChatService) GetUnreadCount(roomID, userID string) (int, error) {
	return s.pgMessage.GetUnreadCount(roomID, userID)
}
