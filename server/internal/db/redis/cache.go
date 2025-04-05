// internal/db/redis/cache.go
package redis

import (
	"context"
	"encoding/json"
	"time"
)

// Cache handles Redis caching operations
type Cache struct {
	client *Client
}

// NewCache creates a new Cache instance
func NewCache(client *Client) *Cache {
	return &Cache{
		client: client,
	}
}

// Set stores a value in the cache with an expiration time
func (c *Cache) Set(key string, value interface{}, expiration time.Duration) error {
	ctx := context.Background()

	// Convert value to JSON
	jsonData, err := json.Marshal(value)
	if err != nil {
		return err
	}

	// Store in Redis
	return c.client.Set(ctx, key, jsonData, expiration).Err()
}

// Get retrieves a value from the cache and unmarshals it into the result
func (c *Cache) Get(key string, result interface{}) error {
	ctx := context.Background()

	// Get from Redis
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}

	// Unmarshal into result
	return json.Unmarshal(data, result)
}

// Delete removes a key from the cache
func (c *Cache) Delete(key string) error {
	ctx := context.Background()
	return c.client.Del(ctx, key).Err()
}

// Exists checks if a key exists in the cache
func (c *Cache) Exists(key string) (bool, error) {
	ctx := context.Background()
	result, err := c.client.Exists(ctx, key).Result()
	return result > 0, err
}

// GetUserOnlineStatus gets the online status of users
func (c *Cache) GetUserOnlineStatus(userIDs []string) (map[string]bool, error) {
	ctx := context.Background()
	result := make(map[string]bool)

	for _, userID := range userIDs {
		key := "user:online:" + userID
		exists, err := c.client.Exists(ctx, key).Result()
		if err != nil {
			return nil, err
		}
		result[userID] = exists > 0
	}

	return result, nil
}

// SetUserOnline marks a user as online with a TTL
func (c *Cache) SetUserOnline(userID string, duration time.Duration) error {
	ctx := context.Background()
	key := "user:online:" + userID
	return c.client.Set(ctx, key, "1", duration).Err()
}

// GetUnreadMessageCount gets the cached unread message count for a user in a room
func (c *Cache) GetUnreadMessageCount(userID, roomID string) (int, error) {
	ctx := context.Background()
	key := "unread:" + userID + ":" + roomID

	count, err := c.client.Get(ctx, key).Int()
	if err != nil {
		return 0, err
	}

	return count, nil
}

// IncrementUnreadCount increments the unread message count for a user in a room
func (c *Cache) IncrementUnreadCount(userID, roomID string) error {
	ctx := context.Background()
	key := "unread:" + userID + ":" + roomID

	return c.client.Incr(ctx, key).Err()
}

// ResetUnreadCount resets the unread message count for a user in a room
func (c *Cache) ResetUnreadCount(userID, roomID string) error {
	ctx := context.Background()
	key := "unread:" + userID + ":" + roomID

	return c.client.Set(ctx, key, 0, 0).Err()
}
