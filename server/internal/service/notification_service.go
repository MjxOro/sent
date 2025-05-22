// internal/service/notification_service.go
package service

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mjxoro/sent/server/internal/db/postgres"
	"github.com/mjxoro/sent/server/internal/db/redis"
)

type NotificationService struct {
	cache  *redis.Cache
	pg     *postgres.DB
	pubsub *redis.PubSub
}

func NewNotificationService(cache *redis.Cache, pg *postgres.DB, pubsub *redis.PubSub) *NotificationService {
	return &NotificationService{
		cache:  cache,
		pg:     pg,
		pubsub: pubsub,
	}
}

// CreateNotification creates and stores a new notification
func (s *NotificationService) CreateNotification(userID, notificationType string, data interface{}) error {
	notification := redis.NotificationStatus{
		ID:        generateUUID(),
		Type:      notificationType,
		UserID:    userID,
		Data:      data,
		IsRead:    false,
		CreatedAt: time.Now(),
	}

	// Store in PostgreSQL first
	if err := s.pg.StoreNotification(notification); err != nil {
		return fmt.Errorf("failed to store notification in database: %w", err)
	}

	// Then cache in Redis
	if err := s.cache.StoreNotification(userID, notification); err != nil {
		// Log error but don't fail the operation
		fmt.Printf("failed to cache notification: %v\n", err)
	}

	// Publish real-time notification
	channel := fmt.Sprintf("user:notify:%s", userID)
	if err := s.pubsub.PublishMessage(channel, notification); err != nil {
		fmt.Printf("failed to publish notification: %v\n", err)
	}

	return nil
}

// GetUserNotifications gets all notifications for a user
func (s *NotificationService) GetUserNotifications(userID string) ([]redis.NotificationStatus, error) {
	// Try cache first
	notifications, err := s.cache.GetNotifications(userID)
	if err == nil {
		return notifications, nil
	}

	// On cache miss, get from database
	notifications, err = s.pg.GetNotifications(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get notifications from database: %w", err)
	}

	// Update cache
	if err := s.cache.StoreNotification(userID, notifications[0]); err != nil {
		fmt.Printf("failed to update notification cache: %v\n", err)
	}

	return notifications, nil
}

// MarkNotificationRead marks a notification as read
func (s *NotificationService) MarkNotificationRead(userID, notificationID string) error {
	// Update in database first
	if err := s.pg.MarkNotificationRead(userID, notificationID); err != nil {
		return fmt.Errorf("failed to mark notification as read in database: %w", err)
	}

	// Get current notifications from cache
	notifications, err := s.cache.GetNotifications(userID)
	if err == nil {
		// Update in cache if found
		for i := range notifications {
			if notifications[i].ID == notificationID {
				notifications[i].IsRead = true
				break
			}
		}
		if err := s.cache.StoreNotification(userID, notifications[0]); err != nil {
			fmt.Printf("failed to update notification cache: %v\n", err)
		}
	}

	return nil
}

// DeleteNotification deletes a notification
func (s *NotificationService) DeleteNotification(userID, notificationID string) error {
	// Delete from database first
	if err := s.pg.DeleteNotification(userID, notificationID); err != nil {
		return fmt.Errorf("failed to delete notification from database: %w", err)
	}

	// Get and update cache
	notifications, err := s.cache.GetNotifications(userID)
	if err == nil {
		updatedNotifications := make([]redis.NotificationStatus, 0)
		for _, n := range notifications {
			if n.ID != notificationID {
				updatedNotifications = append(updatedNotifications, n)
			}
		}
		if err := s.cache.StoreNotification(userID, updatedNotifications[0]); err != nil {
			fmt.Printf("failed to update notification cache: %v\n", err)
		}
	}

	return nil
}

// generateUUID generates a new UUID (implement this based on your UUID package)
func generateUUID() string {
	// Implement using your preferred UUID package
	return "uuid" // placeholder
}
