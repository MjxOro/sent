// internal/service/chat_service.go
package service

import (
	"encoding/json"
	"fmt"
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
func (s *ChatService) CreateRoom(name, description string, isPrivate bool, creatorID string) (*models.Room, error) {
	room := &models.Room{
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
	if err := s.pgRoom.AddMember(room.ID, creatorID, "admin", true); err != nil {
		return nil, err
	}

	return room, nil
}

// CreateDirectMessageRoom creates a direct message room between two users
func (s *ChatService) CreateDirectMessageRoom(user1ID, user2ID string) (*models.Room, error) {
	// Check if DM room already exists
	room, err := s.pgRoom.FindDMRoom(user1ID, user2ID)
	if err == nil {
		// Room exists, return it
		return room, nil
	}

	// Create new DM room
	room = &models.Room{
		Name:      "", // DMs don't need names
		IsPrivate: true,
		Type:      "direct",
		CreatorID: user1ID,
	}

	if err := s.pgRoom.Create(room); err != nil {
		return nil, err
	}

	// Add both users as members
	if err := s.pgRoom.AddMember(room.ID, user1ID, "member", true); err != nil {
		return nil, err
	}
	if err := s.pgRoom.AddMember(room.ID, user2ID, "member", false); err != nil {
		return nil, err
	}

	return room, nil
}

// GetUserRooms gets all rooms a user is a member of
func (s *ChatService) GetUserRooms(userID string) ([]*models.Room, error) {
	return s.pgRoom.FindRoomsByUserID(userID)
}

// GetRoomMembers gets all members of a room
func (s *ChatService) GetRoomMembers(roomID string) ([]*models.User, error) {
	return s.pgRoom.GetRoomMembers(roomID)
}

// SendMessage sends a message to a room
func (s *ChatService) SendMessage(roomID, userID, content string) (*models.Message, error) {
	// Create message in database
	message := &models.Message{
		RoomID:  roomID,
		UserID:  userID,
		Content: content,
	}

	if err := s.pgMessage.Create(message); err != nil {
		return nil, err
	}

	// Publish message to Redis for real-time delivery
	ctx := s.redisClient.Context()

	messageData, err := json.Marshal(map[string]any{
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
// Updated to return MessageDTO with user information
func (s *ChatService) GetRoomMessages(roomID string, limit, offset int) ([]*models.MessageDTO, error) {
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

// GetRoomDetails gets details of a room
func (s *ChatService) GetRoomDetails(roomID string) (*models.Room, error) {
	return s.pgRoom.FindByID(roomID)
}

// IsUserMemberOfRoom checks if a user is a member of a room
func (s *ChatService) IsUserMemberOfRoom(userID, roomID string) (bool, error) {
	// Get members of the room
	members, err := s.pgRoom.GetRoomMembers(roomID)
	if err != nil {
		return false, err
	}

	// Check if user is in the member list
	for _, member := range members {
		if member.ID == userID {
			return true, nil
		}
	}

	return false, nil
}

// DeleteRoom deletes a room if the user is the creator
func (s *ChatService) DeleteRoom(roomID, userID string) error {
	// Get room details to check creator
	room, err := s.pgRoom.FindByID(roomID)
	if err != nil {
		return err
	}

	// Check if user is the creator
	if room.CreatorID != userID {
		return fmt.Errorf("unauthorized: only the room creator can delete this room")
	}

	// Delete the room
	return s.pgRoom.Delete(roomID)
}
