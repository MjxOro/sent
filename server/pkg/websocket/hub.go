// pkg/websocket/hub.go
package websocket

// Hub maintains the set of active clients and broadcasts messages to them
type Hub struct {
	// Registered clients by room
	Rooms map[string]map[*Client]bool

	// Register requests from clients
	Register chan *Client

	// Unregister requests from clients
	Unregister chan *Client

	// Inbound messages from clients
	Broadcast chan *Message
}

// NewHub creates a new Hub
func NewHub() *Hub {
	return &Hub{
		Rooms:      make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan *Message),
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			// Create room if it doesn't exist
			if _, ok := h.Rooms[client.Room]; !ok {
				h.Rooms[client.Room] = make(map[*Client]bool)
			}
			// Register client in room
			h.Rooms[client.Room][client] = true

		case client := <-h.Unregister:
			// If client is in this room
			if _, ok := h.Rooms[client.Room]; ok {
				if _, ok := h.Rooms[client.Room][client]; ok {
					delete(h.Rooms[client.Room], client)
					close(client.Send)
					
					// If room is empty, delete it
					if len(h.Rooms[client.Room]) == 0 {
						delete(h.Rooms, client.Room)
					}
				}
			}

		case message := <-h.Broadcast:
			// Broadcast message to all clients in the room
			if _, ok := h.Rooms[message.Room]; ok {
				for client := range h.Rooms[message.Room] {
					// Don't send message back to sender
					if client != message.Client {
						select {
						case client.Send <- message.Data:
						default:
							close(client.Send)
							delete(h.Rooms[message.Room], client)
							
							// If room is empty, delete it
							if len(h.Rooms[message.Room]) == 0 {
								delete(h.Rooms, message.Room)
							}
						}
					}
				}
			}
		}
	}
}
