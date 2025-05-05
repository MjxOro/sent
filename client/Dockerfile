FROM node:20.14-alpine
WORKDIR /app

# Set default build arg (will be overridden by docker-compose)
ARG NODE_ENV=production

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies based on environment with retries
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm ci --prefer-offline --no-audit --no-fund --progress=false || npm ci --prefer-offline --no-audit --no-fund --progress=false || npm ci; \
    else \
      npm install --prefer-offline --no-audit --no-fund --progress=false || npm install --prefer-offline --no-audit --no-fund --progress=false || npm install; \
    fi

# Copy the rest of the code
COPY . .

# Create .next directory with proper permissions
RUN mkdir -p .next && chmod -R 777 .next

# Build the app for production if needed
RUN if [ "$NODE_ENV" = "production" ]; then \
      NODE_ENV=production npm run build; \
    fi

# Expose port
EXPOSE 3000

# Set hostname to bind to all interfaces
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Run the appropriate command based on environment
CMD if [ "$NODE_ENV" = "production" ]; then \
      npm start; \
    else \
      npm run dev -- -H 0.0.0.0; \
    fi
