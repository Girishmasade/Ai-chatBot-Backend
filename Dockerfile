# ==========================================
# Multi-Stage Dockerfile for AI ChatBot Server
# ==========================================

# ── Stage 1: Build Stage ──────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for compilation)
RUN npm ci

# Copy configuration and source files
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript / bundle server using esbuild
RUN npm run build

# ── Stage 2: Production Runner ────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Production environment configuration
ENV NODE_ENV=production
ENV PORT=5500

# Install curl for container health checks
RUN apk add --no-cache curl

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript bundle from builder stage
COPY --from=builder /app/dist ./dist

# Create and switch to non-root user for security best practices
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

# Expose backend API and WebSocket port
EXPOSE 5500

# Periodic container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5500/health || exit 1

# Start the Node.js server
CMD ["node", "dist/server.js"]
