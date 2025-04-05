// pkg/websocket/message.go
package websocket

// Message represents a message in the chat system
type Message struct {
	Data   []byte
	Room   string
	Client *Client
}
