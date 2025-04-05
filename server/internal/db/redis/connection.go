// internal/db/redis/connection.go
package redis

import (
	"context"
	"fmt"
	"log"

	"github.com/go-redis/redis/v8"
	"github.com/mjxoro/sent/server/internal/config"
)

// Client represents the Redis client
type Client struct {
	*redis.Client
}

// NewClient creates a new Redis client
func NewClient(cfg *config.Config) (*Client, error) {

	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Redis.Host, cfg.Redis.Port),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// Test the connection
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("Connected to Redis")
	return &Client{client}, nil
}

// Close closes the Redis client
func (c *Client) Close() error {
	return c.Client.Close()
}
