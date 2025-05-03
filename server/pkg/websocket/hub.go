// pkg/websocket/hub.go
package websocket

// Subscription represents a client subscription to a room
type Subscription struct {
	Client *Client
	Room   string
}

// Hub maintains the set of active clients and broadcasts messages to them
type Hub struct {
	// Registered clients
	Clients map[*Client]bool

	// Registered clients by room
	Rooms map[string]map[*Client]bool

	// Register requests from clients
	Register chan *Client

	// Unregister requests from clients
	Unregister chan *Client

	// Subscribe clients to rooms
	Subscribe chan *Subscription

	// Unsubscribe clients from rooms
	Unsubscribe chan *Subscription

	// Inbound messages from clients
	Broadcast chan *Message
}

// NewHub creates a new Hub
func NewHub() *Hub {
	return &Hub{
		Clients:     make(map[*Client]bool),
		Rooms:       make(map[string]map[*Client]bool),
		Register:    make(chan *Client),
		Unregister:  make(chan *Client),
		Subscribe:   make(chan *Subscription),
		Unsubscribe: make(chan *Subscription),
		Broadcast:   make(chan *Message),
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			// Register new client
			h.Clients[client] = true

		case client := <-h.Unregister:
			// Unregister client from all rooms
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)

				// Remove from all rooms
				for room := range client.Rooms {
					if _, ok := h.Rooms[room]; ok {
						delete(h.Rooms[room], client)

						// If room is empty, delete it
						if len(h.Rooms[room]) == 0 {
							delete(h.Rooms, room)
						}
					}
				}

				close(client.Send)
			}

		case subscription := <-h.Subscribe:
			// Create room if it doesn't exist
			if _, ok := h.Rooms[subscription.Room]; !ok {
				h.Rooms[subscription.Room] = make(map[*Client]bool)
			}

			// Add client to room
			h.Rooms[subscription.Room][subscription.Client] = true

			// Update client's room list
			subscription.Client.JoinRoom(subscription.Room)

		case unsubscription := <-h.Unsubscribe:
			// Remove client from room
			if _, ok := h.Rooms[unsubscription.Room]; ok {
				delete(h.Rooms[unsubscription.Room], unsubscription.Client)

				// If room is empty, delete it
				if len(h.Rooms[unsubscription.Room]) == 0 {
					delete(h.Rooms, unsubscription.Room)
				}

				// Update client's room list
				unsubscription.Client.LeaveRoom(unsubscription.Room)
			}

		case message := <-h.Broadcast:
			// For messages with a specific room, broadcast to that room only
			if message.RoomID != "" {
				if _, ok := h.Rooms[message.RoomID]; ok {
					for client := range h.Rooms[message.RoomID] {
						// Don't send message back to sender
						if client != message.Client {
							select {
							case client.Send <- message.Data:
							default:
								close(client.Send)
								delete(h.Rooms[message.RoomID], client)
								delete(h.Clients, client)

								// If room is empty, delete it
								if len(h.Rooms[message.RoomID]) == 0 {
									delete(h.Rooms, message.RoomID)
								}
							}
						}
					}
				}
			}
		}
	}
}
