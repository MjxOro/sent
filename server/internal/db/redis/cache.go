// internal/db/redis/cache.go
package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/mjxoro/sent/server/internal/models"
)

const (
	defaultCacheDuration = 24 * time.Hour
	notificationDuration = 30 * 24 * time.Hour
	onlineStatusDuration = 5 * time.Minute

	// Key formats
	notificationKeyFormat = "user:notifications:%s"       // For storing notifications
	notificationCountKey  = "user:notifications:count:%s" // For unread counts
	onlineUserKeyFormat   = "user:online:%s"              // For online status
)

type Cache struct {
	client *Client
}

func NewCache(client *Client) *Cache {
	return &Cache{
		client: client,
	}
}

// StoreNotification stores any type of notification
func (c *Cache) StoreNotification(userID string, notification *models.NotificationResponse) error {
	key := fmt.Sprintf(notificationKeyFormat, userID)

	// Get existing notifications
	var notifications []*models.NotificationResponse
	err := c.Get(key, &notifications)
	if err != nil && err != redis.Nil {
		return fmt.Errorf("failed to get existing notifications: %w", err)
	}

	// Add new notification at the beginning (newest first)
	notifications = append([]*models.NotificationResponse{notification}, notifications...)

	// Trim if more than 100 notifications (or your desired limit)
	if len(notifications) > 100 {
		notifications = notifications[:100]
	}

	// Store updated notifications
	if err := c.Set(key, notifications, notificationDuration); err != nil {
		return fmt.Errorf("failed to store notifications: %w", err)
	}

	// Update unread count if notification is unread
	if !notification.IsRead {
		countKey := fmt.Sprintf(notificationCountKey, userID)
		ctx := context.Background()
		if err := c.client.Incr(ctx, countKey).Err(); err != nil {
			// Log error but don't fail the operation
			fmt.Printf("failed to increment unread count: %v\n", err)
		}
	}

	return nil
}

// GetNotifications retrieves all notifications for a user
func (c *Cache) GetNotifications(userID string) ([]*models.NotificationResponse, error) {
	key := fmt.Sprintf(notificationKeyFormat, userID)

	var notifications []*models.NotificationResponse
	err := c.Get(key, &notifications)
	if err == redis.Nil {
		return []*models.NotificationResponse{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get notifications: %w", err)
	}

	return notifications, nil
}

// MarkNotificationsRead marks multiple notifications as read
func (c *Cache) MarkNotificationsRead(userID string, notificationIDs []string) error {
	key := fmt.Sprintf(notificationKeyFormat, userID)

	// Get existing notifications
	var notifications []*models.NotificationResponse
	err := c.Get(key, &notifications)
	if err != nil && err != redis.Nil {
		return fmt.Errorf("failed to get notifications: %w", err)
	}

	// Create a map for quick lookup
	idMap := make(map[string]struct{})
	for _, id := range notificationIDs {
		idMap[id] = struct{}{}
	}

	// Update read status
	unreadCount := 0
	for _, n := range notifications {
		if _, shouldMark := idMap[n.ID]; shouldMark {
			n.IsRead = true
		}
		if !n.IsRead {
			unreadCount++
		}
	}

	// Store updated notifications
	if err := c.Set(key, notifications, notificationDuration); err != nil {
		return fmt.Errorf("failed to update notifications: %w", err)
	}

	// Update unread count
	countKey := fmt.Sprintf(notificationCountKey, userID)
	ctx := context.Background()
	if err := c.client.Set(ctx, countKey, unreadCount, notificationDuration).Err(); err != nil {
		// Log error but don't fail the operation
		fmt.Printf("failed to update unread count: %v\n", err)
	}

	return nil
}

// GetUnreadCount gets the number of unread notifications
func (c *Cache) GetUnreadCount(userID string) (int, error) {
	countKey := fmt.Sprintf(notificationCountKey, userID)
	ctx := context.Background()

	count, err := c.client.Get(ctx, countKey).Int()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}

	return count, nil
}

// DeleteNotification removes a notification
func (c *Cache) DeleteNotification(userID string, notificationID string) error {
	key := fmt.Sprintf(notificationKeyFormat, userID)

	// Get existing notifications
	var notifications []*models.NotificationResponse
	err := c.Get(key, &notifications)
	if err != nil && err != redis.Nil {
		return fmt.Errorf("failed to get notifications: %w", err)
	}

	// Find and remove notification
	found := false
	wasUnread := false
	updatedNotifications := make([]*models.NotificationResponse, 0, len(notifications))
	for _, n := range notifications {
		if n.ID == notificationID {
			found = true
			wasUnread = !n.IsRead
			continue
		}
		updatedNotifications = append(updatedNotifications, n)
	}

	if !found {
		return fmt.Errorf("notification not found")
	}

	// Store updated notifications
	if err := c.Set(key, updatedNotifications, notificationDuration); err != nil {
		return fmt.Errorf("failed to update notifications: %w", err)
	}

	// Update unread count if necessary
	if wasUnread {
		countKey := fmt.Sprintf(notificationCountKey, userID)
		ctx := context.Background()
		if err := c.client.Decr(ctx, countKey).Err(); err != nil {
			// Log error but don't fail the operation
			fmt.Printf("failed to decrement unread count: %v\n", err)
		}
	}

	return nil
}

// General Set method
func (c *Cache) Set(key string, value interface{}, expiration time.Duration) error {
	ctx := context.Background()
	jsonData, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	if expiration == 0 {
		expiration = defaultCacheDuration
	}

	return c.client.Set(ctx, key, jsonData, expiration).Err()
}

// General Get method
func (c *Cache) Get(key string, result interface{}) error {
	ctx := context.Background()
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, result)
}

// SetUserOnline marks a user as online
func (c *Cache) SetUserOnline(userID string, duration time.Duration) error {
	ctx := context.Background()
	key := fmt.Sprintf(onlineUserKeyFormat, userID)

	if duration == 0 {
		duration = onlineStatusDuration
	}

	if err := c.client.Set(ctx, key, "1", duration).Err(); err != nil {
		return fmt.Errorf("failed to set user online status: %w", err)
	}

	return nil
}

// GetUserOnlineStatus gets online status for multiple users
func (c *Cache) GetUserOnlineStatus(userIDs []string) (map[string]bool, error) {
	ctx := context.Background()
	result := make(map[string]bool)

	pipe := c.client.Pipeline()
	cmds := make(map[string]*redis.IntCmd)

	for _, userID := range userIDs {
		key := fmt.Sprintf(onlineUserKeyFormat, userID)
		cmds[userID] = pipe.Exists(ctx, key)
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check online status: %w", err)
	}

	for userID, cmd := range cmds {
		exists, err := cmd.Result()
		if err != nil {
			return nil, fmt.Errorf("failed to get result for user %s: %w", userID, err)
		}
		result[userID] = exists > 0
	}

	return result, nil
}
