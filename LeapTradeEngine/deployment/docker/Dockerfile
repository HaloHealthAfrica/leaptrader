# Multi-stage Dockerfile for LeapTrader LEAPS System
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies stage
FROM base AS deps
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --only=production && npm cache clean --force

# Builder stage
FROM base AS builder
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci

# Copy source code
COPY . .
COPY client ./client

# Build the application
RUN npm run build
RUN cd client && npm run build

# Production stage
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules

# Copy configuration files
COPY --from=builder /app/config ./config
COPY --from=builder /app/deployment/scripts ./scripts

# Set permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node scripts/healthcheck.js

EXPOSE 3000

CMD ["node", "dist/server/index.js"]