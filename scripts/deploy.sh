#!/bin/bash

# ================================================================
# BikeDreams Backend - Production Deployment Script
# ================================================================
#
# This script handles complete deployment automation including:
# - Environment validation
# - Pre-deployment checks
# - Database migrations
# - Docker build and deployment
# - Health checks
# - Rollback capabilities
# - Post-deployment verification
#
# Usage:
#   ./deploy.sh [command] [options]
#
# Commands:
#   deploy      - Full deployment process
#   rollback    - Rollback to previous version
#   health      - Check application health
#   logs        - Show application logs
#   status      - Show deployment status
#
# Options:
#   --env=ENV           - Target environment (staging/production)
#   --version=VERSION   - Specific version to deploy
#   --skip-tests        - Skip test execution
#   --skip-backup       - Skip database backup
#   --force             - Force deployment without confirmations
#
# ================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_ENV="${DEPLOY_ENV:-production}"
VERSION="${VERSION:-$(date +%Y%m%d_%H%M%S)}"
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
FORCE_DEPLOY="${FORCE_DEPLOY:-false}"

# Docker configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
IMAGE_NAME="${IMAGE_NAME:-bikedreams-backend}"
COMPOSE_FILE="docker-compose.prod.yml"

# Health check configuration
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-5}"

# Backup configuration
BACKUP_DIR="${PROJECT_ROOT}/backups"
MAX_BACKUPS="${MAX_BACKUPS:-5}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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
    echo -e "${PURPLE}"
    echo "================================================================"
    echo "             BikeDreams Backend Deployment"
    echo "================================================================"
    echo "Environment: $DEPLOY_ENV"
    echo "Version: $VERSION"
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

# Utility functions
confirm_action() {
    local message="$1"
    if [[ "$FORCE_DEPLOY" == "true" ]]; then
        return 0
    fi
    
    read -p "$message (y/N): " -r
    [[ $REPLY =~ ^[Yy]$ ]]
}

wait_for_service() {
    local service_url="$1"
    local timeout="$2"
    local interval="$3"
    local elapsed=0
    
    log_info "Waiting for service to be healthy at $service_url"
    
    while [ $elapsed -lt $timeout ]; do
        if curl -sf "$service_url" > /dev/null 2>&1; then
            log_success "Service is healthy"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        log_info "Waiting... ($elapsed/${timeout}s)"
    done
    
    log_error "Service failed to become healthy within ${timeout}s"
    return 1
}

# Pre-deployment checks
validate_environment() {
    log "Validating deployment environment"
    
    # Check required files
    local required_files=(
        "$PROJECT_ROOT/.env.$DEPLOY_ENV"
        "$PROJECT_ROOT/$COMPOSE_FILE"
        "$PROJECT_ROOT/Dockerfile"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check disk space
    local available_space=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
    local min_space=1048576  # 1GB in KB
    
    if [[ $available_space -lt $min_space ]]; then
        log_warning "Low disk space: $(($available_space / 1024))MB available"
        if ! confirm_action "Continue with low disk space?"; then
            exit 1
        fi
    fi
    
    log_success "Environment validation passed"
}

check_dependencies() {
    log "Checking system dependencies"
    
    local dependencies=("curl" "jq" "git")
    
    for dep in "${dependencies[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Required dependency not found: $dep"
            exit 1
        fi
    done
    
    log_success "All dependencies are available"
}

check_git_status() {
    log "Checking Git status"
    
    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        cd "$PROJECT_ROOT"
        
        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD --; then
            log_warning "There are uncommitted changes in the repository"
            if ! confirm_action "Continue with uncommitted changes?"; then
                exit 1
            fi
        fi
        
        # Get current branch and commit
        local branch=$(git rev-parse --abbrev-ref HEAD)
        local commit=$(git rev-parse --short HEAD)
        
        log_info "Current branch: $branch"
        log_info "Current commit: $commit"
        
        # Update VERSION with commit hash if not specified
        if [[ "$VERSION" == "$(date +%Y%m%d_%H%M%S)" ]]; then
            VERSION="${branch}-${commit}-$(date +%Y%m%d_%H%M%S)"
        fi
    else
        log_warning "Not a Git repository"
    fi
    
    log_success "Git status check completed"
}

# Testing
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests (--skip-tests flag)"
        return 0
    fi
    
    log "Running test suite"
    
    cd "$PROJECT_ROOT"
    
    # Run unit tests
    if [[ -f "package.json" ]] && command -v npm &> /dev/null; then
        log_info "Running JavaScript/TypeScript tests"
        npm test
    fi
    
    # Run security tests if available
    if [[ -f "scripts/run-security-tests.sh" ]]; then
        log_info "Running security tests"
        bash scripts/run-security-tests.sh --ci
    fi
    
    log_success "All tests passed"
}

# Backup operations
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log_warning "Skipping backup (--skip-backup flag)"
        return 0
    fi
    
    log "Creating deployment backup"
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_name="backup_${DEPLOY_ENV}_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Backup database
    if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log_info "Backing up PostgreSQL database"
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dumpall -U postgres > "$backup_path/database.sql"
        
        if [[ -s "$backup_path/database.sql" ]]; then
            log_success "Database backup created"
        else
            log_error "Database backup is empty"
            return 1
        fi
    fi
    
    # Backup environment files
    cp "$PROJECT_ROOT/.env.$DEPLOY_ENV" "$backup_path/"
    
    # Backup current version info
    echo "VERSION=$VERSION" > "$backup_path/version.info"
    echo "BACKUP_DATE=$(date)" >> "$backup_path/version.info"
    echo "GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" >> "$backup_path/version.info"
    
    # Compress backup
    cd "$BACKUP_DIR"
    tar -czf "${backup_name}.tar.gz" "$backup_name"
    rm -rf "$backup_name"
    
    log_success "Backup created: ${backup_name}.tar.gz"
    
    # Cleanup old backups
    cleanup_old_backups
}

cleanup_old_backups() {
    log_info "Cleaning up old backups (keeping last $MAX_BACKUPS)"
    
    cd "$BACKUP_DIR"
    ls -t backup_${DEPLOY_ENV}_*.tar.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
}

# Docker operations
build_images() {
    log "Building Docker images"
    
    cd "$PROJECT_ROOT"
    
    # Build with version tag
    local image_tag="${IMAGE_NAME}:${VERSION}"
    if [[ -n "$DOCKER_REGISTRY" ]]; then
        image_tag="${DOCKER_REGISTRY}/${image_tag}"
    fi
    
    # Build image
    docker build \
        --tag "$image_tag" \
        --tag "${IMAGE_NAME}:latest" \
        --build-arg VERSION="$VERSION" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        .
    
    log_success "Docker image built: $image_tag"
    
    # Push to registry if configured
    if [[ -n "$DOCKER_REGISTRY" ]]; then
        log_info "Pushing image to registry"
        docker push "$image_tag"
        log_success "Image pushed to registry"
    fi
}

deploy_services() {
    log "Deploying services"
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables
    export DEPLOY_ENV
    export VERSION
    
    # Deploy with docker-compose
    docker-compose -f "$COMPOSE_FILE" pull
    docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans
    
    log_success "Services deployed"
}

run_migrations() {
    log "Running database migrations"
    
    cd "$PROJECT_ROOT"
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready"
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -h localhost -p 5432 -U postgres
    
    # Run migrations if migration script exists
    if [[ -f "scripts/migrate.sh" ]]; then
        log_info "Running migration script"
        bash scripts/migrate.sh
    else
        log_info "No migration script found, skipping"
    fi
    
    log_success "Database migrations completed"
}

# Health checks
check_application_health() {
    log "Performing health checks"
    
    # Wait for application to start
    wait_for_service "$HEALTH_CHECK_URL" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"
    
    # Additional health checks
    local health_response=$(curl -s "$HEALTH_CHECK_URL" || echo "{}")
    local status=$(echo "$health_response" | jq -r '.status // "unknown"')
    
    if [[ "$status" != "ok" && "$status" != "healthy" ]]; then
        log_error "Health check failed: $status"
        return 1
    fi
    
    # Check database connectivity
    if echo "$health_response" | jq -e '.database' &>/dev/null; then
        local db_status=$(echo "$health_response" | jq -r '.database.status // "unknown"')
        if [[ "$db_status" != "ok" && "$db_status" != "connected" ]]; then
            log_error "Database health check failed: $db_status"
            return 1
        fi
        log_success "Database connection healthy"
    fi
    
    # Check Redis connectivity if available
    if echo "$health_response" | jq -e '.redis' &>/dev/null; then
        local redis_status=$(echo "$health_response" | jq -r '.redis.status // "unknown"')
        if [[ "$redis_status" != "ok" && "$redis_status" != "connected" ]]; then
            log_warning "Redis health check failed: $redis_status"
        else
            log_success "Redis connection healthy"
        fi
    fi
    
    log_success "All health checks passed"
}

# Rollback functionality
rollback_deployment() {
    log "Starting rollback process"
    
    local latest_backup=$(ls -t "$BACKUP_DIR"/backup_${DEPLOY_ENV}_*.tar.gz 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No backup found for rollback"
        return 1
    fi
    
    log_info "Rolling back to: $(basename "$latest_backup")"
    
    if ! confirm_action "Proceed with rollback?"; then
        return 1
    fi
    
    # Extract backup
    cd "$BACKUP_DIR"
    local backup_dir=$(basename "$latest_backup" .tar.gz)
    tar -xzf "$latest_backup"
    
    # Restore database
    if [[ -f "$backup_dir/database.sql" ]]; then
        log_info "Restoring database"
        cat "$backup_dir/database.sql" | docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" exec -T postgres psql -U postgres
        log_success "Database restored"
    fi
    
    # Restore environment file
    if [[ -f "$backup_dir/.env.$DEPLOY_ENV" ]]; then
        cp "$backup_dir/.env.$DEPLOY_ENV" "$PROJECT_ROOT/"
    fi
    
    # Restart services
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" restart
    
    # Health check after rollback
    if check_application_health; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback completed but health checks failed"
        return 1
    fi
    
    # Cleanup
    rm -rf "$BACKUP_DIR/$backup_dir"
}

# Monitoring and logging
show_logs() {
    local service="${1:-}"
    local lines="${2:-100}"
    
    cd "$PROJECT_ROOT"
    
    if [[ -n "$service" ]]; then
        docker-compose -f "$COMPOSE_FILE" logs --tail="$lines" -f "$service"
    else
        docker-compose -f "$COMPOSE_FILE" logs --tail="$lines" -f
    fi
}

show_status() {
    log "Deployment Status"
    
    cd "$PROJECT_ROOT"
    
    echo
    echo "Services:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo
    echo "Resource Usage:"
    docker stats --no-stream $(docker-compose -f "$COMPOSE_FILE" ps -q)
    
    echo
    echo "Health Status:"
    if curl -s "$HEALTH_CHECK_URL" | jq . 2>/dev/null; then
        log_success "Health check endpoint responding"
    else
        log_error "Health check endpoint not responding"
    fi
}

# Main deployment process
deploy() {
    print_banner
    
    log "Starting deployment process"
    
    # Pre-deployment checks
    validate_environment
    check_dependencies
    check_git_status
    
    # Show deployment summary
    echo
    log_info "Deployment Summary:"
    log_info "  Environment: $DEPLOY_ENV"
    log_info "  Version: $VERSION"
    log_info "  Skip Tests: $SKIP_TESTS"
    log_info "  Skip Backup: $SKIP_BACKUP"
    log_info "  Force Deploy: $FORCE_DEPLOY"
    echo
    
    if ! confirm_action "Proceed with deployment?"; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
    
    # Execute deployment steps
    run_tests
    create_backup
    build_images
    deploy_services
    run_migrations
    check_application_health
    
    log_success "Deployment completed successfully!"
    log_info "Version $VERSION is now live in $DEPLOY_ENV"
    
    # Show final status
    show_status
}

# Command line argument parsing
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env=*)
                DEPLOY_ENV="${1#*=}"
                shift
                ;;
            --version=*)
                VERSION="${1#*=}"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS="true"
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
                break
                ;;
        esac
    done
}

show_usage() {
    echo "BikeDreams Backend Deployment Script"
    echo
    echo "Usage: $0 [command] [options]"
    echo
    echo "Commands:"
    echo "  deploy      Full deployment process (default)"
    echo "  rollback    Rollback to previous version"
    echo "  health      Check application health"
    echo "  logs        Show application logs [service] [lines]"
    echo "  status      Show deployment status"
    echo "  help        Show this help message"
    echo
    echo "Options:"
    echo "  --env=ENV           Target environment (staging/production)"
    echo "  --version=VERSION   Specific version to deploy"
    echo "  --skip-tests        Skip test execution"
    echo "  --skip-backup       Skip database backup"
    echo "  --force             Force deployment without confirmations"
    echo
    echo "Environment Variables:"
    echo "  DEPLOY_ENV          Target environment"
    echo "  DOCKER_REGISTRY     Docker registry URL"
    echo "  HEALTH_CHECK_URL    Health check endpoint"
    echo
}

# Main script entry point
main() {
    parse_arguments "$@"
    
    local command="${1:-deploy}"
    
    case "$command" in
        "deploy")
            deploy
            ;;
        "rollback")
            rollback_deployment
            ;;
        "health")
            check_application_health
            ;;
        "logs")
            show_logs "$2" "$3"
            ;;
        "status")
            show_status
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
