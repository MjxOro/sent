/server
├── cmd/
│ └── api/ # API server
│ └── main.go # Main entry point
├── internal/ # Private application code
│ ├── auth/ # Authentication
│ │ ├── middleware.go # Auth middleware
│ │ ├── oauth.go # OAuth implementation
│ │ └── jwt.go # JWT utilities
│ ├── config/ # Configuration
│ │ └── config.go # App configuration
│ ├── handler/ # HTTP handlers
│ │ ├── auth_handler.go # Auth endpoints
│ │ ├── user_handler.go # User-related endpoints
│ │ ├── chat_handler.go # Chat-related endpoints
│ │ └── ws_handler.go # WebSocket handler
│ ├── model/ # Data models
│ │ ├── user.go # User model
│ │ ├── message.go # Message model
│ │ └── room.go # Chat room model
│ ├── db/ # Database operations
│ │ ├── postgres/ # PostgreSQL
│ │ │ ├── connection.go
│ │ │ ├── user.go
│ │ │ ├── message.go
│ │ │ └── room.go
│ │ └── redis/ # Redis
│ │ ├── connection.go
│ │ ├── cache.go
│ │ └── pubsub.go
│ └── service/ # Business logic
│ ├── auth_service.go # Auth business logic
│ ├── user_service.go # User business logic
│ └── chat_service.go # Chat business logic
├── pkg/ # Public libraries
│ └── websocket/ # WebSocket implementation
│ ├── client.go # WebSocket client
│ ├── hub.go # WebSocket hub
│ └── message.go # WebSocket message handling
├── configs/ # Configuration files
├── scripts/ # Scripts for development
│ └── migrations/ # Database migrations
├── .gitignore
├── go.mod
└── go.sum
