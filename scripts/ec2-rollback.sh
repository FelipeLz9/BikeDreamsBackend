#!/bin/bash

# ================================================================
# BikeDreams Backend - EC2 Rollback Script
# ================================================================
#
# This script handles rollback to the previous deployment
#
# Usage:
#   ./ec2-rollback.sh [backup_file]
#
# ================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
COMPOSE_FILE="docker-compose.prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
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

print_banner() {
    echo -e "${BLUE}"
    echo "================================================================"
    echo "         BikeDreams Backend - Rollback Process"
    echo "================================================================"
    echo "Time: $(date)"
    echo "================================================================"
    echo -e "${NC}"
}

# Find latest backup
find_latest_backup() {
    local latest_backup=$(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No backup found in $BACKUP_DIR"
        exit 1
    fi
    
    echo "$latest_backup"
}

# List available backups
list_backups() {
    log "Available backups:"
    echo ""
    
    local count=1
    for backup in $(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null); do
        local size=$(du -h "$backup" | cut -f1)
        local date=$(basename "$backup" | sed 's/backup_//' | sed 's/.tar.gz//')
        echo "  $count. $date ($size)"
        count=$((count + 1))
    done
    
    echo ""
}

# Rollback process
rollback() {
    local backup_file="${1:-}"
    
    print_banner
    
    # If no backup specified, use latest
    if [[ -z "$backup_file" ]]; then
        backup_file=$(find_latest_backup)
        log "Using latest backup: $(basename "$backup_file")"
    elif [[ ! -f "$backup_file" ]]; then
        # Check if it's in backup directory
        if [[ -f "$BACKUP_DIR/$backup_file" ]]; then
            backup_file="$BACKUP_DIR/$backup_file"
        else
            log_error "Backup file not found: $backup_file"
            exit 1
        fi
    fi
    
    log "Starting rollback from: $(basename "$backup_file")"
    
    # Confirm rollback
    read -p "Are you sure you want to rollback? This will restore the previous state. (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Rollback cancelled"
        exit 0
    fi
    
    # Extract backup
    log "Extracting backup..."
    cd "$BACKUP_DIR"
    local backup_name=$(basename "$backup_file" .tar.gz)
    tar -xzf "$backup_file"
    
    if [[ ! -d "$backup_name" ]]; then
        log_error "Failed to extract backup"
        exit 1
    fi
    
    log_success "Backup extracted"
    
    # Show backup info
    if [[ -f "$backup_name/version.info" ]]; then
        log "Backup information:"
        cat "$backup_name/version.info"
        echo ""
    fi
    
    # Stop current services
    log "Stopping current services..."
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down
    log_success "Services stopped"
    
    # Restore database
    if [[ -f "$BACKUP_DIR/$backup_name/database.sql" ]]; then
        log "Restoring database..."
        
        # Start only PostgreSQL
        docker-compose -f "$COMPOSE_FILE" up -d postgres
        
        # Wait for database
        sleep 10
        
        # Restore database
        cat "$BACKUP_DIR/$backup_name/database.sql" | \
            docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres
        
        if [[ $? -eq 0 ]]; then
            log_success "Database restored"
        else
            log_error "Database restore failed"
            # Continue anyway
        fi
    else
        log_warning "No database backup found, skipping database restore"
    fi
    
    # Restore environment file
    if [[ -f "$BACKUP_DIR/$backup_name/.env.production" ]]; then
        log "Restoring environment file..."
        cp "$BACKUP_DIR/$backup_name/.env.production" "$PROJECT_ROOT/"
        log_success "Environment file restored"
    fi
    
    # Restart all services
    log "Restarting all services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    log_success "Services restarted"
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 15
    
    # Health check
    log "Performing health check..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
            log_success "API is healthy!"
            curl -s http://localhost:3001/health | jq . 2>/dev/null || true
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warning "Health check timeout, but services are running"
    fi
    
    # Cleanup extracted backup
    rm -rf "$BACKUP_DIR/$backup_name"
    
    # Show final status
    echo ""
    log_success "Rollback completed!"
    echo ""
    log "Current service status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log "To verify the rollback:"
    echo "  - Check API: curl http://localhost:3001/health"
    echo "  - View logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "  - Check containers: docker-compose -f $COMPOSE_FILE ps"
}

# Show usage
show_usage() {
    echo "BikeDreams Backend - Rollback Script"
    echo ""
    echo "Usage: $0 [backup_file]"
    echo ""
    echo "Options:"
    echo "  backup_file    Optional: specific backup file to restore"
    echo "                 If not provided, uses the latest backup"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Rollback to latest backup"
    echo "  $0 backup_20231201_143022.tar.gz     # Rollback to specific backup"
    echo ""
}

# Main entry point
main() {
    if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    if [[ "${1:-}" == "--list" ]]; then
        list_backups
        exit 0
    fi
    
    rollback "${1:-}"
}

# Run main function
main "$@"
