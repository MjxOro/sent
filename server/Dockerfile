FROM golang:latest

# Set destination for COPY
WORKDIR /app

# Set build argument for environment
ARG GO_ENV=production

# Download Go modules
COPY go.mod go.sum ./
RUN go mod download

# Install Air for hot-reloading in development mode
RUN if [ "$GO_ENV" = "development" ]; then \
      go install github.com/air-verse/air@latest; \
    fi

# Copy the source code
COPY . .

# Build for production
RUN if [ "$GO_ENV" = "production" ]; then \
      CGO_ENABLED=0 GOOS=linux go build -o /app-binary ./cmd/api/main.go; \
    fi

# Document port
EXPOSE 8080

# Set environment variable for binding address
ENV GIN_HOST=0.0.0.0

# Run
CMD if [ "$GO_ENV" = "production" ]; then \
      go run scripts/migrations/run.go && \
      /app-binary; \
    else \
      air -c .air.toml; \
    fi
