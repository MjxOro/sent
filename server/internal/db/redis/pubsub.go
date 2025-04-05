// internal/db/redis/pubsub.go
package redis

import (
	"context"
	"encoding/json"
	"log"
)

// PubSub handles Redis pub/sub messaging
type PubSub struct {
	client *Client
}

// NewPubSub creates a new PubSub instance
func NewPubSub(client *Client) *PubSub {
	return &PubSub{
		client: client,
	}
}

// PublishMessage publishes a message to a channel
func (ps *PubSub) PublishMessage(channel string, message interface{}) error {
	ctx := context.Background()

	// Convert message to JSON
	jsonData, err := json.Marshal(message)
	if err != nil {
		return err
	}

	// Publish to Redis
	return ps.client.Publish(ctx, channel, jsonData).Err()
}

// Subscribe subscribes to a channel and handles incoming messages
func (ps *PubSub) Subscribe(channel string, handler func([]byte)) {
	ctx := context.Background()

	// Subscribe to the channel
	pubsub := ps.client.Subscribe(ctx, channel)
	defer pubsub.Close()

	// Listen for messages
	ch := pubsub.Channel()

	log.Printf("Subscribed to Redis channel: %s", channel)

	for msg := range ch {
		handler([]byte(msg.Payload))
	}
}

// SubscribeToRooms subscribes to multiple room channels
func (ps *PubSub) SubscribeToRooms(roomIDs []string, handler func(string, []byte)) {
	ctx := context.Background()

	channels := make([]string, len(roomIDs))
	for i, roomID := range roomIDs {
		channels[i] = "chat:room:" + roomID
	}

	// Subscribe to multiple channels
	pubsub := ps.client.Subscribe(ctx, channels...)
	defer pubsub.Close()

	// Listen for messages
	ch := pubsub.Channel()

	log.Printf("Subscribed to %d Redis channels", len(channels))

	for msg := range ch {
		// Extract room ID from channel
		roomChannel := msg.Channel
		roomID := roomChannel[10:] // Skip "chat:room:"

		handler(roomID, []byte(msg.Payload))
	}
}
