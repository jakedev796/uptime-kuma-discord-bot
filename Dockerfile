# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

# Build
COPY src ./src
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built app (make sure dist exists)
COPY --from=builder /app/dist ./dist

# Create a data directory now (final perms fixed at runtime)
RUN mkdir -p /app/data

# Install su-exec for privilege drop and wget for health checks
RUN apk add --no-cache su-exec wget

# Add entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Encourage a named volume by default (optional but nice)
VOLUME ["/app/data"]

# Default PUID/PGID can be overridden at runtime
ENV PUID=1001 PGID=1001 DATA_DIR=/app/data HEALTH_PORT=3000

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]