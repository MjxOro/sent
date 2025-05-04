FROM golang:latest

WORKDIR /server

# Set default build arg (will be overridden by docker-compose)
ARG GO_ENV=production

ENV GO111MODULE=on
ENV GOPROXY=direct

# Install Air for hot-reloading in development mode
RUN if [ "$GO_ENV" = "development" ]; then \
      go install github.com/air-verse/air@latest; \
    fi

# Copy and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy Air configuration for development
COPY .air.toml .air.toml

# Copy source code
COPY . .

# For production, build the optimized binary
RUN if [ "$GO_ENV" = "production" ]; then \
      CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o app ./cmd/api/main.go; \
    fi

# Expose port
EXPOSE 8080

# Set environment variable for binding address
ENV GIN_HOST=0.0.0.0

# Run the appropriate command based on environment
CMD if [ "$GO_ENV" = "production" ]; then \
      ./app; \
    else \
      air -c .air.toml; \
    fi
