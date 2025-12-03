#!/bin/bash

# ================================================================
# BikeDreams Backend - SSL Setup Script with Let's Encrypt
# ================================================================
#
# This script sets up SSL certificates using Certbot for production
#
# Prerequisites:
# - Domain DNS must point to this server's IP
# - Ports 80 and 443 must be open in AWS Security Group
# - Docker and docker-compose must be installed
#
# ================================================================

set -euo pipefail

# Configuration
DOMAIN="bikedreamsco.online"
EMAIL="admin@bikedreamsco.online"  # Change this to your email
CERT_DIR="/opt/bikedreams-backend/BikeDreamsBackend/ssl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}\")}" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

log "Starting SSL certificate setup for $DOMAIN"

# Create SSL directories
log "Creating SSL directories..."
mkdir -p "$CERT_DIR/certs"
mkdir -p "$CERT_DIR/private"
chmod 700 "$CERT_DIR/private"

# Install Certbot
log "Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
    log_success "Certbot installed"
else
    log_success "Certbot already installed"
fi

# Stop nginx container temporarily to free port 80
log "Stopping nginx container..."
cd "$PROJECT_ROOT"
docker-compose -f docker-compose.prod.yml stop nginx || true

# Generate SSL certificate using standalone mode
log "Generating SSL certificate for $DOMAIN..."
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$DOMAIN,www.$DOMAIN" \
    --keep-until-expiring \
    --preferred-challenges http

if [ $? -eq 0 ]; then
    log_success "SSL certificates generated successfully!"
else
    log_error "Failed to generate SSL certificates"
    log_warning "Make sure:"
    log_warning "  1. DNS records point to this server"
    log_warning "  2. Ports 80 and 443 are open in AWS Security Group"
    log_warning "  3. No other service is using port 80"
    exit 1
fi

# Copy certificates to project directory
log "Copying certificates to project directory..."
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem "$CERT_DIR/certs/bikedreams.crt"
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem "$CERT_DIR/private/bikedreams.key"
cp /etc/letsencrypt/live/$DOMAIN/chain.pem "$CERT_DIR/certs/bikedreams-chain.crt"

# Generate DH parameters for Perfect Forward Secrecy  
if [ ! -f "$CERT_DIR/certs/dhparam.pem" ]; then
    log "Generating DH parameters (this may take a while)..."
    openssl dhparam -out "$CERT_DIR/certs/dhparam.pem" 2048
    log_success "DH parameters generated"
else
    log_success "DH parameters already exist"
fi

# Set proper permissions
chmod 644 "$CERT_DIR/certs"/*.crt
chmod 644 "$CERT_DIR/certs"/*.pem
chmod 600 "$CERT_DIR/private"/*.key

log_success "Certificates copied and permissions set"

# Setup auto-renewal cron job
log "Setting up auto-renewal..."
CRON_CMD="0 0 1 * * certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERT_DIR/certs/bikedreams.crt && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $CERT_DIR/private/bikedreams.key && docker-compose -f $PROJECT_ROOT/docker-compose.prod.yml restart nginx'"

# Add to root crontab if not already there
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_CMD") | crontab -

log_success "Auto-renewal configured"

# Update nginx configuration to use HTTP for initial verification
log "Temporarily updating nginx config for HTTP verification..."
cat > "$PROJECT_ROOT/nginx-temp.conf" << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    upstream backend {
        server api:3001;
    }
    
    server {
        listen 80;
        server_name bikedreamsco.online www.bikedreamsco.online;
        
        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
EOF

# Restart containers with updated nginx
log "Starting services with SSL..."
cd "$PROJECT_ROOT"
docker-compose -f docker-compose.prod.yml up -d

log_success "SSL setup complete!"
log ""
log "Next steps:"
log "  1. Open ports 80 and 443 in AWS Security Group"
log "  2. Access your API at: https://$DOMAIN"
log "  3. Certificates will auto-renew on the 1st of each month"
log ""
log_success "Setup complete! 🎉"
