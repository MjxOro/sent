FROM node:22.14-alpine
WORKDIR /app
 
# Set default build arg
ARG NODE_ENV=production
 
# Create directories with full permissions
RUN mkdir -p /app/.next/static/development && \
    mkdir -p /app/.next/static/chunks && \
    mkdir -p /app/.next/server && \
    mkdir -p /app/.next/cache && \
    chmod -R 777 /app && \
    chmod -R 777 /app/.next
 
# Copy package files first for better caching
COPY package.json package-lock.json* ./
  
# Install ALL dependencies (including dev)
RUN npm i --prefer-offline --no-audit --include=dev

# Copy the rest of the code
COPY . .
 
# Ensure permissions again after copy
RUN chmod -R 777 /app && \
    chmod -R 777 /app/.next
 
# Build the app if in production mode
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm run build; \
    fi
 
# Expose port
EXPOSE 3000
 
# Set hostname to bind to all interfaces
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
 
# Run the app
CMD if [ "$NODE_ENV" = "production" ]; then \
      npm start; \
    else \
      chmod -R 777 /app && npm run dev -- -H 0.0.0.0; \
    fi
