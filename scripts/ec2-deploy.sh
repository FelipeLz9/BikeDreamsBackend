#!/bin/bash

# ================================================================
# BikeDreams Backend - EC2 Deployment Script
# ================================================================
#
# This script handles deployment on AWS EC2 instances
#
# Usage:
#   ./ec2-deploy.sh [options]
#
# Options:
#   --branch=BRANCH     Git branch to deploy (default: main)
#   --skip-backup       Skip database backup
#   --force             Force deployment without confirmation
#
# ================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
FORCE_DEPLOY="${FORCE_DEPLOY:-false}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="${PROJECT_ROOT}/backups"
MAX_BACKUPS=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ $1${NC}"
}

print_banner() {
    echo -e "${BLUE}"
    echo "================================================================"
    echo "         BikeDreams Backend - EC2 Deployment"
    echo "================================================================"
    echo "Branch: $DEPLOY_BRANCH"
    echo "Time: $(date)"
    echo "================================================================"
    echo -e "${NC}"
}

# Error handling
trap 'handle_error $? $LINENO' ERR

handle_error() {
    local exit_code=$1
    local line_number=$2
    log_error "Deployment failed at line $line_number with exit code $exit_code"
    
    if [[ "$FORCE_DEPLOY" != "true" ]]; then
        read -p "Do you want to attempt rollback? (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rollback_deployment
        fi
    fi
    
    exit $exit_code
}

# Confirm action
confirm_action() {
    local message="$1"
    if [[ "$FORCE_DEPLOY" == "true" ]]; then
        return 0
    fi
    
    read -p "$message (y/N): " -r
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Pre-deployment checks
validate_environment() {
    log "Validating environment..."
    
    # Check if in project directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "Not in project root directory"
    fi
    
    # Check for .env.production
    if [[ ! -f "$PROJECT_ROOT/.env.production" ]]; then
        log_error ".env.production file not found"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
    fi
    
    log_success "Environment validation passed"
}

# Pull latest code
pull_latest_code() {
    log "Pulling latest code from Git..."
    
    cd "$PROJECT_ROOT"
    
    # Stash any local changes
    if ! git diff-index --quiet HEAD --; then
        log_warning "Stashing local changes"
        git stash
    fi
    
    # Fetch and pull
    git fetch origin
    git checkout "$DEPLOY_BRANCH"
    git pull origin "$DEPLOY_BRANCH"
    
    local commit=$(git rev-parse --short HEAD)
    log_success "Code updated to commit: $commit"
}

# Create backup
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log_warning "Skipping backup (--skip-backup flag)"
        return 0
    fi
    
    log "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup database if PostgreSQL container is running
    if docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "Up"; then
        log_info "Backing up PostgreSQL database..."
        docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" exec -T postgres pg_dumpall -U postgres > "$backup_path/database.sql" 2>/dev/null || {
            log_warning "Database backup failed or database not running"
        }
    else
        log_warning "PostgreSQL container not running, skipping database backup"
    fi
    
    # Backup environment file
    cp "$PROJECT_ROOT/.env.production" "$backup_path/" 2>/dev/null || true
    
    # Save version info
    echo "BACKUP_DATE=$(date)" > "$backup_path/version.info"
    echo "GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" >> "$backup_path/version.info"
    echo "GIT_BRANCH=$DEPLOY_BRANCH" >> "$backup_path/version.info"
    
    # Compress backup
    cd "$BACKUP_DIR"
    tar -czf "${backup_name}.tar.gz" "$backup_name"
    rm -rf "$backup_name"
    
    log_success "Backup created: ${backup_name}.tar.gz"
    
    # Cleanup old backups
    ls -t backup_*.tar.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f 2>/dev/null || true
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build images
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    
    log_success "Docker images built successfully"
}

# Deploy services
deploy_services() {
    log "Deploying services..."
    
    cd "$PROJECT_ROOT"
    
    # Stop existing services
    log_info "Stopping existing services..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans
    
    # Start services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_success "Services deployed"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres &> /dev/null; then
            log_success "Database is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Database failed to become ready"
    fi
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    docker-compose -f "$COMPOSE_FILE" exec -T api bun run prisma:generate || true
    
    # Push database schema
    log_info "Pushing database schema..."
    docker-compose -f "$COMPOSE_FILE" exec -T api bun run prisma:push || true
    
    log_success "Database migrations completed"
}

# Health checks
check_health() {
    log "Performing health checks..."
    
    local max_attempts=60
    local attempt=0
    local health_url="http://localhost:3001/health"
    
    log_info "Waiting for API to be healthy..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$health_url" > /dev/null 2>&1; then
            log_success "API is healthy"
            
            # Show health status
            local health_response=$(curl -s "$health_url")
            echo "$health_response" | jq . 2>/dev/null || echo "$health_response"
            
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 2
        
        if [ $((attempt % 10)) -eq 0 ]; then
            log_info "Still waiting... ($attempt/$max_attempts)"
        fi
    done
    
    log_error "Health check failed after $max_attempts attempts"
    
    # Show logs for debugging
    log_warning "Showing API logs:"
    docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" logs --tail=50 api
    
    return 1
}

# Rollback deployment
rollback_deployment() {
    log "Starting rollback..."
    
    local latest_backup=$(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No backup found for rollback"
        return 1
    fi
    
    log_info "Rolling back to: $(basename "$latest_backup")"
    
    # Extract backup
    cd "$BACKUP_DIR"
    local backup_dir=$(basename "$latest_backup" .tar.gz)
    tar -xzf "$latest_backup"
    
    # Restore database if backup exists
    if [[ -f "$backup_dir/database.sql" ]]; then
        log_info "Restoring database..."
        cat "$backup_dir/database.sql" | docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" exec -T postgres psql -U postgres || {
            log_warning "Database restore failed"
        }
    fi
    
    # Restart services
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" restart
    
    # Cleanup
    rm -rf "$BACKUP_DIR/$backup_dir"
    
    log_success "Rollback completed"
}

# Show deployment status
show_status() {
    log "Deployment Status"
    
    cd "$PROJECT_ROOT"
    
    echo ""
    echo "=== Services ==="
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    echo "=== Resource Usage ==="
    docker stats --no-stream $(docker-compose -f "$COMPOSE_FILE" ps -q) 2>/dev/null || echo "No containers running"
    
    echo ""
    echo "=== Health Status ==="
    curl -s http://localhost:3001/health | jq . 2>/dev/null || echo "API not responding"
    
    echo ""
    echo "=== Recent Logs ==="
    docker-compose -f "$COMPOSE_FILE" logs --tail=20 api
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --branch=*)
                DEPLOY_BRANCH="${1#*=}"
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP="true"
                shift
                ;;
            --force)
                FORCE_DEPLOY="true"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                ;;
        esac
    done
}

# Main deployment process
deploy() {
    print_banner
    
    log "Starting deployment process..."
    
    # Pre-deployment
    validate_environment
    
    # Show summary
    echo ""
    log_info "Deployment Summary:"
    log_info "  Branch: $DEPLOY_BRANCH"
    log_info "  Skip Backup: $SKIP_BACKUP"
    log_info "  Force Deploy: $FORCE_DEPLOY"
    echo ""
    
    if ! confirm_action "Proceed with deployment?"; then
        log_info "Deployment cancelled"
        exit 0
    fi
    
    # Execute deployment
    pull_latest_code
    create_backup
    build_images
    deploy_services
    run_migrations
    check_health
    
    log_success "Deployment completed successfully! 🚀"
    
    # Show status
    show_status
}

# Main entry point
main() {
    parse_arguments "$@"
    deploy
}

# Run main function
main "$@"
