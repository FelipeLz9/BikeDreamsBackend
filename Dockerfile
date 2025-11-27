# ==============================================
# BikeDreams Backend - Multi-Stage Dockerfile
# ==============================================
# This Dockerfile supports multiple environments:
# - development: Hot reloading, debugging, dev tools
# - staging: Production-like with monitoring
# - production: Optimized for production

# ==============================================
# Base Stage - Common dependencies and setup
# ==============================================
FROM oven/bun:1.1-alpine as base

# Install security updates and common tools
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 bikedreams \
    && adduser --system --uid 1001 --ingroup bikedreams bun

# Copy package files first (better caching)
COPY --chown=bun:bikedreams package.json bun.lockb ./
COPY --chown=bun:bikedreams prisma ./prisma/

# Install all dependencies (including dev dependencies)
RUN bun install --frozen-lockfile

# Copy source code
COPY --chown=bun:bikedreams src ./src/
COPY --chown=bun:bikedreams tsconfig*.json ./
COPY --chown=bun:bikedreams prisma ./prisma/

# Generate Prisma client
RUN bun run prisma:generate

# ==============================================
# Development Stage
# ==============================================
FROM base as development

# Install development tools
RUN apk add --no-cache \
    git \
    vim \
    htop \
    && rm -rf /var/cache/apk/*

# Set development environment
ENV NODE_ENV=development
ENV LOG_LEVEL=debug
ENV ENABLE_DEBUG=true
ENV ENABLE_SWAGGER=true
ENV WATCH_MODE=true

# Expose ports
EXPOSE 3001 9229

# Create directories for development
RUN mkdir -p /app/logs /app/uploads /app/tmp

# Set permissions
RUN chown -R bun:bikedreams /app

# Switch to non-root user
USER bun

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Default command for development
CMD ["bun", "run", "dev:env"]

# ==============================================
# Staging Stage
# ==============================================
FROM base as staging

# Set staging environment
ENV NODE_ENV=staging
ENV LOG_LEVEL=info
ENV ENABLE_DEBUG=false
ENV ENABLE_SWAGGER=true
ENV ENABLE_METRICS=true

# Build the application for staging
RUN bun run build:staging

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Expose ports
EXPOSE 3001 9090

# Create directories for staging
RUN mkdir -p /app/logs /app/uploads /app/tmp

# Set permissions
RUN chown -R bun:bikedreams /app

# Switch to non-root user
USER bun

# Health check for staging
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Default command for staging
CMD ["bun", "run", "start:staging"]

# ==============================================
# Production Stage
# ==============================================
FROM base as production

# Set production environment
ENV NODE_ENV=production
ENV LOG_LEVEL=warn
ENV ENABLE_DEBUG=false
ENV ENABLE_SWAGGER=false
ENV ENABLE_METRICS=true

# Build the application for production
RUN bun run build:prod

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Remove development files
RUN rm -rf /app/src /app/tsconfig*.json /app/prisma /app/node_modules/.cache

# Expose ports
EXPOSE 3001

# Create directories for production
RUN mkdir -p /app/logs /app/uploads /app/tmp

# Set permissions
RUN chown -R bun:bikedreams /app

# Switch to non-root user
USER bun

# Health check for production
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Default command for production
CMD ["bun", "run", "start:prod"]

# ==============================================
# Builder Stage - For building the application
# ==============================================
FROM base as builder

# Set build environment
ENV NODE_ENV=production

# Build the application
RUN bun run build:prod

# ==============================================
# Final Production Stage - Minimal image
# ==============================================
FROM oven/bun:1.1-alpine as final

# Install only essential packages
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 bikedreams \
    && adduser --system --uid 1001 --ingroup bikedreams bun

# Copy built application from builder stage
COPY --from=builder --chown=bun:bikedreams /app/dist /app/dist
COPY --from=builder --chown=bun:bikedreams /app/node_modules /app/node_modules
COPY --from=builder --chown=bun:bikedreams /app/package.json /app/package.json
COPY --from=builder --chown=bun:bikedreams /app/prisma /app/prisma

# Set production environment
ENV NODE_ENV=production
ENV LOG_LEVEL=warn
ENV ENABLE_DEBUG=false
ENV ENABLE_SWAGGER=false
ENV ENABLE_METRICS=true

# Expose ports
EXPOSE 3001

# Create directories
RUN mkdir -p /app/logs /app/uploads /app/tmp

# Set permissions
RUN chown -R bun:bikedreams /app

# Switch to non-root user
USER bun

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Default command
CMD ["bun", "run", "start:prod"]