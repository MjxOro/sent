// internal/service/friendship_service.go
package service

import (
	"errors"
	"fmt"
	"github.com/mjxoro/sent/server/internal/db/postgres"
	"github.com/mjxoro/sent/server/internal/db/redis"
	"github.com/mjxoro/sent/server/internal/models"
)

// FriendshipService handles friendship-related business logic
type FriendshipService struct {
	pgFriendship *postgres.Friendship
	pgUser       *postgres.User
	redisCache   *redis.Cache
	redisPubSub  *redis.PubSub
}

// NewFriendshipService creates a new friendship service
func NewFriendshipService(pgFriendship *postgres.Friendship, pgUser *postgres.User, redisCache *redis.Cache, redisPubSub *redis.PubSub) *FriendshipService {
	return &FriendshipService{
		pgFriendship: pgFriendship,
		pgUser:       pgUser,
		redisCache:   redisCache,
		redisPubSub:  redisPubSub,
	}
}

type NotificationPayload struct {
	Type     string      `json:"type"`
	UserID   string      `json:"user_id,omitempty"`
	UserName string      `json:"user_name,omitempty"`
	Data     interface{} `json:"data,omitempty"`
}

// SendFriendRequest sends a friend request from one user to another
func (s *FriendshipService) SendFriendRequest(userID, friendID string) (*models.Friendship, error) {
	// Validate users exist
	sender, err := s.pgUser.FindByID(userID)
	if err != nil {
		return nil, errors.New("sender user not found")
	}

	_, err = s.pgUser.FindByID(friendID)
	if err != nil {
		return nil, errors.New("recipient user not found")
	}

	// Check if friendship already exists
	existingFriendship, err := s.pgFriendship.FindByUserAndFriend(userID, friendID)
	if err == nil {
		// Friendship exists, handle based on status
		switch existingFriendship.Status {
		case models.FriendshipStatusPending:
			return nil, errors.New("friend request already pending")
		case models.FriendshipStatusAccepted:
			return nil, errors.New("already friends")
		case models.FriendshipStatusRejected:
			// Allow re-requesting after rejection, update status to pending
			err = s.pgFriendship.UpdateStatus(existingFriendship.ID, models.FriendshipStatusPending)
			if err != nil {
				return nil, err
			}
			// Send notification for the re-request
			notification := NotificationPayload{
				Type:     "friend_request",
				UserID:   userID,
				UserName: sender.Name,
				Data: map[string]interface{}{
					"friendship_id": existingFriendship.ID,
					"sender_avatar": sender.Avatar,
				},
			}

			channel := fmt.Sprintf("user:notify:%s", friendID)
			if err := s.redisPubSub.PublishMessage(channel, notification); err != nil {
				fmt.Printf("Failed to send friend request notification: %v", err)
			}
			return existingFriendship, nil
		case models.FriendshipStatusBlocked:
			return nil, errors.New("cannot send friend request")
		}
	}

	// Create new friendship
	friendship := &models.Friendship{
		UserID:   userID,
		FriendID: friendID,
		Status:   models.FriendshipStatusPending,
	}

	err = s.pgFriendship.Create(friendship)
	if err != nil {
		return nil, err
	}

	notification := NotificationPayload{
		Type:     "friend_request",
		UserID:   userID,
		UserName: sender.Name,
		Data: map[string]interface{}{
			"friendship_id": friendship.ID,
			"sender_avatar": sender.Avatar,
		},
	}

	channel := fmt.Sprintf("user:notify:%s", friendID)
	if err := s.redisPubSub.PublishMessage(channel, notification); err != nil {
		fmt.Printf("Failed to send friend request notification: %v", err)
	}

	return friendship, nil
}

// AcceptFriendRequest accepts a pending friend request
func (s *FriendshipService) AcceptFriendRequest(friendshipID, userID string) error {
	// Get friendship
	friendship, err := s.pgFriendship.FindByID(friendshipID)
	if err != nil {
		return errors.New("friendship not found")
	}

	// Verify the user is the recipient of the request
	if friendship.FriendID != userID {
		return errors.New("not authorized to accept this request")
	}

	// Verify the status is pending
	if friendship.Status != models.FriendshipStatusPending {
		return errors.New("friend request is not pending")
	}

	// Update status to accepted
	return s.pgFriendship.UpdateStatus(friendshipID, models.FriendshipStatusAccepted)
}

// RejectFriendRequest rejects a pending friend request
func (s *FriendshipService) RejectFriendRequest(friendshipID, userID string) error {
	// Get friendship
	friendship, err := s.pgFriendship.FindByID(friendshipID)
	if err != nil {
		return errors.New("friendship not found")
	}

	// Verify the user is the recipient of the request
	if friendship.FriendID != userID {
		return errors.New("not authorized to reject this request")
	}

	// Verify the status is pending
	if friendship.Status != models.FriendshipStatusPending {
		return errors.New("friend request is not pending")
	}

	// Update status to rejected
	return s.pgFriendship.UpdateStatus(friendshipID, models.FriendshipStatusRejected)
}

// BlockUser blocks another user
func (s *FriendshipService) BlockUser(userID, blockUserID string) error {
	// Check if friendship already exists
	friendship, err := s.pgFriendship.FindByUserAndFriend(userID, blockUserID)
	if err == nil {
		// Update existing relationship to blocked
		return s.pgFriendship.UpdateStatus(friendship.ID, models.FriendshipStatusBlocked)
	}

	// Create new blocked relationship
	friendship = &models.Friendship{
		UserID:   userID,
		FriendID: blockUserID,
		Status:   models.FriendshipStatusBlocked,
	}

	return s.pgFriendship.Create(friendship)
}

// UnblockUser removes a block on a user
func (s *FriendshipService) UnblockUser(userID, blockedUserID string) error {
	// Find the friendship
	friendship, err := s.pgFriendship.FindByUserAndFriend(userID, blockedUserID)
	if err != nil {
		return errors.New("relationship not found")
	}

	if friendship.Status != models.FriendshipStatusBlocked {
		return errors.New("user is not blocked")
	}

	// Verify the user is the one who blocked
	if friendship.UserID != userID {
		return errors.New("not authorized to unblock this user")
	}

	// Delete the friendship record
	return s.pgFriendship.Delete(friendship.ID)
}

// RemoveFriend removes a friend connection
func (s *FriendshipService) RemoveFriend(userID, friendID string) error {
	// Find the friendship
	friendship, err := s.pgFriendship.FindByUserAndFriend(userID, friendID)
	if err != nil {
		return errors.New("friendship not found")
	}

	if friendship.Status != models.FriendshipStatusAccepted {
		return errors.New("users are not friends")
	}

	// Delete the friendship record
	return s.pgFriendship.Delete(friendship.ID)
}

// GetFriends gets all accepted friends of a user
func (s *FriendshipService) GetFriends(userID string) ([]*models.FriendshipWithUser, error) {
	return s.pgFriendship.FindFriendsByUserID(userID, models.FriendshipStatusAccepted)
}

// GetPendingRequests gets all pending friend requests for a user
func (s *FriendshipService) GetPendingRequests(userID string) ([]*models.FriendshipWithUser, error) {
	return s.pgFriendship.FindPendingRequests(userID)
}

// GetAllRelationships gets all friendship relationships for a user
func (s *FriendshipService) GetAllRelationships(userID string) ([]*models.FriendshipWithUser, error) {
	return s.pgFriendship.FindAllUserRelationships(userID)
}

// GetNonFriends gets users who are not connected to the specified user
func (s *FriendshipService) GetNonFriends(userID string, limit, offset int) ([]*models.User, error) {
	return s.pgFriendship.FindNonFriends(userID, limit, offset)
}

// GetFriendshipStatus gets the status of friendship between two users
func (s *FriendshipService) GetFriendshipStatus(userID, otherUserID string) (models.FriendshipStatus, error) {
	friendship, err := s.pgFriendship.FindByUserAndFriend(userID, otherUserID)
	if err != nil {
		return "", errors.New("no relationship found")
	}

	return friendship.Status, nil
}
