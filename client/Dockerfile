# Use a lightweight Node.js image
FROM node:22.14-alpine

# Set working directory
WORKDIR /app

# Set default build arg
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies (include dev dependencies regardless of environment)
RUN npm ci --include=dev --prefer-offline

# Copy the rest of the application files
COPY . .

# Create .next directory with proper permissions
RUN mkdir -p .next/cache .next/server .next/static && chmod -R 777 .next

# Build the application if in production mode
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm run build; \
    fi

# Use a non-root user for security
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
RUN chown -R nextjs:nextjs /app
USER nextjs

# Expose the port
EXPOSE 3000

# Set hostname to bind to all interfaces
ENV HOSTNAME=0.0.0.0

# Set the command based on environment
CMD if [ "$NODE_ENV" = "production" ]; then \
      npm start; \
    else \
      npm run dev; \
    fi
