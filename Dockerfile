# ==============================================
# BikeDreams Backend - Production Dockerfile
# ==============================================

# Build stage
FROM oven/bun:1.1-alpine as builder

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 bikedreams \
    && adduser --system --uid 1001 --ingroup bikedreams bun

# Copy package files first (better caching)
COPY --chown=bun:bikedreams package.json bun.lockb ./
COPY --chown=bun:bikedreams prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY --chown=bun:bikedreams src ./src/
COPY --chown=bun:bikedreams tsconfig.json ./

# Generate Prisma client
RUN bunx prisma generate

# Production stage
FROM oven/bun:1.1-alpine as production

# Install security updates and required packages
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/* \
    && addgroup --system --gid 1001 bikedreams \
    && adduser --system --uid 1001 --ingroup bikedreams bun

WORKDIR /app

# Copy from builder stage
COPY --from=builder --chown=bun:bikedreams /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bikedreams /app/src ./src
COPY --from=builder --chown=bun:bikedreams /app/prisma ./prisma
COPY --from=builder --chown=bun:bikedreams /app/package.json ./
COPY --from=builder --chown=bun:bikedreams /app/tsconfig.json ./

# Create required directories with proper permissions
RUN mkdir -p /app/uploads /app/logs /app/logs/security && \
    chown -R bun:bikedreams /app/uploads /app/logs && \
    chmod 755 /app/uploads /app/logs && \
    chmod 750 /app/logs/security

# Set security-focused file permissions
RUN find /app -type f -name "*.ts" -exec chmod 644 {} \; && \
    find /app -type d -exec chmod 755 {} \;

# Remove unnecessary files for security
RUN rm -rf /tmp/* /var/tmp/* /root/.bun

# Security: Run as non-root user
USER bun

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3001

# Health check with better configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Security labels
LABEL maintainer="BikeDreams Team <dev@example.com>" \
      version="1.0" \
      description="BikeDreams Backend API - Production" \
      security.scan="enabled"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["bun", "run", "start"]
