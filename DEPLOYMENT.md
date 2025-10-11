# BikeDreams Backend - Production Deployment Guide

This comprehensive guide covers the complete deployment process for the BikeDreams backend from development to production.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Database Setup](#database-setup)
- [Docker Configuration](#docker-configuration)
- [NGINX Configuration](#nginx-configuration)
- [Security Configuration](#security-configuration)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment Process](#deployment-process)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## Overview

The BikeDreams backend uses a modern, secure deployment architecture with:

- **Docker & Docker Compose** for containerization
- **NGINX** as reverse proxy with advanced security
- **PostgreSQL 15** as primary database
- **Redis** for caching and sessions
- **SSL/TLS** encryption with HSTS
- **Automated CI/CD** with GitHub Actions
- **Comprehensive security** headers and monitoring
- **Automated backups** and rollback capabilities

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04+ / CentOS 8+ / Amazon Linux 2
- **CPU**: 2+ cores (4+ recommended for production)
- **Memory**: 4GB+ RAM (8GB+ recommended for production)
- **Storage**: 20GB+ SSD (50GB+ recommended for production)
- **Network**: Public IP with ports 80, 443, 22 accessible

### Software Requirements

```bash
# Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Essential tools
sudo apt update
sudo apt install -y curl jq git openssl nginx certbot python3-certbot-nginx
```

### Domain & DNS Setup

1. **Domain Registration**: Register your domain (e.g., `bikedreams.com`)
2. **DNS Configuration**:
   ```
   A     api.bikedreams.com          -> YOUR_SERVER_IP
   A     api-staging.bikedreams.com  -> YOUR_STAGING_IP (optional)
   ```

## Environment Setup

### 1. Clone Repository

```bash
# Production server
sudo mkdir -p /opt/bikedreams-backend
sudo chown $USER:$USER /opt/bikedreams-backend
cd /opt/bikedreams-backend
git clone https://github.com/your-org/bikedreams-backend.git .
```

### 2. Environment Configuration

```bash
# Copy and configure production environment
cp .env.example .env.production

# Edit production environment
nano .env.production
```

**Critical Environment Variables** (update these!):

```bash
# Application
NODE_ENV=production
PORT=3001
API_VERSION=v1

# Security
JWT_SECRET=YOUR_SUPER_SECURE_JWT_SECRET_HERE
JWT_REFRESH_SECRET=YOUR_SUPER_SECURE_REFRESH_SECRET_HERE
ENCRYPTION_KEY=YOUR_32_CHARACTER_ENCRYPTION_KEY

# Database
DATABASE_URL=postgresql://bikedreams_user:SECURE_PASSWORD@postgres:5432/bikedreams
POSTGRES_USER=bikedreams_user
POSTGRES_PASSWORD=SECURE_DATABASE_PASSWORD
POSTGRES_DB=bikedreams

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=SECURE_REDIS_PASSWORD

# SSL/TLS
SSL_CERT_PATH=/etc/ssl/certs/bikedreams.crt
SSL_KEY_PATH=/etc/ssl/private/bikedreams.key

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
HEALTH_CHECK_TOKEN=secure_health_check_token
```

## SSL/TLS Configuration

### Option 1: Let's Encrypt (Recommended for Production)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot certonly --standalone -d api.bikedreams.com

# Certificates will be in:
# /etc/letsencrypt/live/api.bikedreams.com/fullchain.pem
# /etc/letsencrypt/live/api.bikedreams.com/privkey.pem

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Self-Signed (Development Only)

```bash
# Generate development certificates
./scripts/generate-ssl-certs.sh dev

# Trust certificate (for local development)
sudo cp ssl/certs/bikedreams.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

### Certificate Installation

```bash
# Create SSL directories
sudo mkdir -p /etc/ssl/certs /etc/ssl/private
sudo chmod 700 /etc/ssl/private

# For Let's Encrypt
sudo cp /etc/letsencrypt/live/api.bikedreams.com/fullchain.pem /etc/ssl/certs/bikedreams.crt
sudo cp /etc/letsencrypt/live/api.bikedreams.com/privkey.pem /etc/ssl/private/bikedreams.key
sudo cp /etc/letsencrypt/live/api.bikedreams.com/chain.pem /etc/ssl/certs/bikedreams-chain.crt

# Generate DH parameters (this takes time)
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# Set permissions
sudo chmod 644 /etc/ssl/certs/*.crt /etc/ssl/certs/*.pem
sudo chmod 600 /etc/ssl/private/*.key
```

## Database Setup

### 1. Initialize Database

```bash
# Start PostgreSQL container for initialization
docker-compose -f docker-compose.prod.yml up postgres -d

# Wait for database to be ready
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres

# Run initialization scripts
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres < scripts/postgres-init.sql
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres < scripts/postgres-security.sql
```

### 2. Database Migrations

```bash
# Create migration script
cat > scripts/migrate.sh << 'EOF'
#!/bin/bash
set -e

echo "Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d bikedreams -c "
-- Add your migration SQL here
-- Example:
-- CREATE TABLE IF NOT EXISTS version_info (
--     version VARCHAR(50) PRIMARY KEY,
--     applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
"
echo "Migrations completed successfully"
EOF

chmod +x scripts/migrate.sh
```

## Docker Configuration

### 1. Production Docker Compose

The `docker-compose.prod.yml` file is already configured with:

- **Multi-stage builds** for optimized images
- **Security hardening** with non-root users
- **Health checks** for all services
- **Resource limits** and reservations
- **Logging configuration** with rotation
- **Secrets management** via environment files

### 2. Build and Deploy

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## NGINX Configuration

### 1. Update Domain Name

Edit `nginx.conf` and update the server name:

```nginx
server {
    listen 443 ssl http2 default_server;
    server_name api.bikedreams.com;  # Update this
    # ... rest of configuration
}
```

### 2. Deploy NGINX Configuration

```bash
# Test configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload if configuration is valid
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Security Configuration

### 1. Firewall Setup

```bash
# UFW Firewall (Ubuntu)
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### 2. System Hardening

```bash
# Disable unused services
sudo systemctl disable apache2 2>/dev/null || true
sudo systemctl disable mysql 2>/dev/null || true

# Update system
sudo apt update && sudo apt upgrade -y

# Install security updates automatically
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. Docker Security

```bash
# Add user to docker group (avoid running as root)
sudo usermod -aG docker $USER

# Set Docker daemon security options in /etc/docker/daemon.json
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "userland-proxy": false,
  "experimental": false,
  "live-restore": true
}
EOF

sudo systemctl restart docker
```

## CI/CD Pipeline

### 1. GitHub Secrets Configuration

Add these secrets to your GitHub repository:

```
# Production Deployment
PRODUCTION_SSH_KEY          # Private SSH key for production server
PRODUCTION_HOST             # Production server IP/hostname
PRODUCTION_USER             # SSH username for production

# Staging Deployment (optional)
STAGING_SSH_KEY             # Private SSH key for staging server
STAGING_HOST                # Staging server IP/hostname
STAGING_USER                # SSH username for staging

# Notifications
SLACK_WEBHOOK_URL           # Slack webhook for deployment notifications
CODECOV_TOKEN              # Codecov token for coverage reports

# Container Registry
GITHUB_TOKEN               # Automatically available, used for GHCR
```

### 2. Branch Strategy

- **`main`** → Production deployments
- **`develop`** → Staging deployments
- **`feature/*`** → Development and testing
- **`release/*`** → Release candidates

### 3. Deploy via CI/CD

```bash
# Push to main branch triggers production deployment
git checkout main
git merge develop
git push origin main

# Monitor deployment in GitHub Actions
# Check https://github.com/your-org/bikedreams-backend/actions
```

## Deployment Process

### Manual Deployment

```bash
# Using the deployment script
./scripts/deploy.sh --env=production --version=$(git rev-parse --short HEAD)

# With options
./scripts/deploy.sh deploy --env=production --skip-tests --force
```

### Deployment Steps Explained

1. **Pre-deployment Checks**
   - Environment validation
   - Dependencies check
   - Git status verification

2. **Testing**
   - Unit tests
   - Integration tests
   - Security tests

3. **Backup Creation**
   - Database backup
   - Configuration backup
   - Version information

4. **Build & Deploy**
   - Docker image build
   - Service deployment
   - Database migrations

5. **Health Checks**
   - Application health verification
   - Database connectivity
   - Redis connectivity (if applicable)

6. **Post-deployment**
   - Status reporting
   - Cleanup of old backups

### Rollback Process

```bash
# Automatic rollback on failure
./scripts/deploy.sh rollback

# Manual rollback to specific backup
ls backups/
./scripts/deploy.sh rollback --backup=backup_production_20231201_143022.tar.gz
```

## Monitoring & Maintenance

### 1. Health Monitoring

```bash
# Check application health
curl -f https://api.bikedreams.com/health

# Check SSL certificate
./scripts/check-ssl-expiry.sh api.bikedreams.com 30

# Monitor services
docker-compose -f docker-compose.prod.yml ps
docker stats
```

### 2. Log Management

```bash
# View application logs
./scripts/deploy.sh logs api 100

# View NGINX logs
./scripts/deploy.sh logs nginx 50

# View all logs
docker-compose -f docker-compose.prod.yml logs --tail=200 -f
```

### 3. Performance Monitoring

```bash
# System resources
htop
df -h
free -m

# Database performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d bikedreams -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
"
```

### 4. Backup Management

```bash
# Manual backup
./scripts/deploy.sh backup

# List backups
ls -la backups/

# Backup cleanup (keeps last 5 backups)
find backups/ -name "backup_production_*.tar.gz" -mtime +7 -delete
```

### 5. Security Monitoring

```bash
# Check failed authentication attempts
docker-compose -f docker-compose.prod.yml exec nginx grep "401\|403" /var/log/nginx/access.log | tail -20

# Monitor rate limiting
docker-compose -f docker-compose.prod.yml exec nginx grep "429" /var/log/nginx/access.log | tail -10

# Check SSL configuration
nmap --script ssl-enum-ciphers -p 443 api.bikedreams.com
```

## Troubleshooting

### Common Issues

#### 1. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/ssl/certs/bikedreams.crt -text -noout

# Test SSL connection
openssl s_client -connect api.bikedreams.com:443 -servername api.bikedreams.com

# Renew Let's Encrypt certificate
sudo certbot renew --dry-run
```

#### 2. Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test database connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d bikedreams -c "SELECT version();"
```

#### 3. Container Issues

```bash
# Check container health
docker-compose -f docker-compose.prod.yml ps

# Restart unhealthy services
docker-compose -f docker-compose.prod.yml restart api

# Check resource usage
docker stats --no-stream

# Clean up unused resources
docker system prune -f
```

#### 4. NGINX Issues

```bash
# Test NGINX configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Check NGINX logs
docker-compose -f docker-compose.prod.yml logs nginx

# Reload NGINX configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Performance Optimization

#### 1. Database Optimization

```sql
-- Check database performance
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY n_distinct DESC;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM bikes WHERE status = 'available';
```

#### 2. Redis Optimization

```bash
# Check Redis status
docker-compose -f docker-compose.prod.yml exec redis redis-cli INFO

# Monitor Redis memory usage
docker-compose -f docker-compose.prod.yml exec redis redis-cli INFO memory
```

#### 3. Application Optimization

```bash
# Monitor application metrics
curl -s https://api.bikedreams.com/metrics | grep -E "(response_time|memory_usage|cpu_usage)"

# Check memory leaks
docker stats --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```

### Disaster Recovery

#### 1. Complete System Restore

```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restore from backup
tar -xzf backups/backup_production_YYYYMMDD_HHMMSS.tar.gz
./scripts/deploy.sh restore --backup=backup_production_YYYYMMDD_HHMMSS

# Verify restoration
./scripts/deploy.sh health
```

#### 2. Database Recovery

```bash
# Restore database only
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres < backup_database.sql

# Verify data integrity
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d bikedreams -c "SELECT COUNT(*) FROM bikes;"
```

### Contact & Support

For deployment support and issues:

- **Documentation**: Check this deployment guide
- **Logs**: Always include relevant logs when reporting issues
- **Health Status**: Run `./scripts/deploy.sh health` before reporting
- **System Info**: Include server specs and Docker versions

---

## Quick Reference Commands

```bash
# Deploy to production
./scripts/deploy.sh --env=production

# Check health
./scripts/deploy.sh health

# View logs
./scripts/deploy.sh logs

# Rollback
./scripts/deploy.sh rollback

# Generate SSL certificates (dev)
./scripts/generate-ssl-certs.sh dev

# Check SSL expiry
./scripts/check-ssl-expiry.sh api.bikedreams.com

# Run security tests
./scripts/run-security-tests.sh

# Backup database
./scripts/deploy.sh backup
```

This completes the comprehensive deployment guide for BikeDreams backend. The setup provides enterprise-grade security, monitoring, and deployment automation suitable for production use.
