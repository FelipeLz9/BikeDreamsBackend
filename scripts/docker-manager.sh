#!/bin/bash

# ==============================================
# BikeDreams Backend - Docker Manager
# ==============================================
#
# This script helps manage Docker containers and services
# for different environments (development, staging, production).
#
# Usage:
#   ./scripts/docker-manager.sh [command] [environment] [service]
#
# Commands:
#   build        - Build Docker images
#   up           - Start services
#   down         - Stop services
#   restart      - Restart services
#   logs         - View logs
#   status       - Show status
#   clean        - Clean up containers and images
#   shell        - Access container shell
#   exec         - Execute command in container
#   backup       - Backup data
#   restore      - Restore data
#
# Environments:
#   dev, staging, prod
#
# ==============================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Available environments
ENVIRONMENTS=("dev" "staging" "prod")

# Available services
SERVICES=("api" "postgres" "redis" "nginx" "adminer" "redis-commander" "mailhog" "prometheus" "grafana" "loki" "backup")

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

# Check if environment is valid
is_valid_env() {
    local env="$1"
    for valid_env in "${ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done
    return 1
}

# Check if service is valid
is_valid_service() {
    local service="$1"
    for valid_service in "${SERVICES[@]}"; do
        if [[ "$service" == "$valid_service" ]]; then
            return 0
        fi
    done
    return 1
}

# Get compose file for environment
get_compose_file() {
    local env="$1"
    case "$env" in
        "dev")
            echo "docker-compose.dev.yml"
            ;;
        "staging")
            echo "docker-compose.staging.yml"
            ;;
        "prod")
            echo "docker-compose.prod.yml"
            ;;
        *)
            log_error "Invalid environment: $env"
            exit 1
            ;;
    esac
}

# Build Docker images
build_images() {
    local env="${1:-dev}"
    local service="${2:-}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    
    log "Building Docker images for $env environment"
    
    if [[ -n "$service" ]]; then
        if ! is_valid_service "$service"; then
            log_error "Invalid service: $service"
            exit 1
        fi
        log "Building service: $service"
        docker-compose -f "$compose_file" build "$service"
    else
        log "Building all services"
        docker-compose -f "$compose_file" build
    fi
    
    log_success "Build completed for $env environment"
}

# Start services
start_services() {
    local env="${1:-dev}"
    local service="${2:-}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    
    log "Starting services for $env environment"
    
    if [[ -n "$service" ]]; then
        if ! is_valid_service "$service"; then
            log_error "Invalid service: $service"
            exit 1
        fi
        log "Starting service: $service"
        docker-compose -f "$compose_file" up -d "$service"
    else
        log "Starting all services"
        docker-compose -f "$compose_file" up -d
    fi
    
    log_success "Services started for $env environment"
}

# Stop services
stop_services() {
    local env="${1:-dev}"
    local service="${2:-}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    
    log "Stopping services for $env environment"
    
    if [[ -n "$service" ]]; then
        if ! is_valid_service "$service"; then
            log_error "Invalid service: $service"
            exit 1
        fi
        log "Stopping service: $service"
        docker-compose -f "$compose_file" stop "$service"
    else
        log "Stopping all services"
        docker-compose -f "$compose_file" down
    fi
    
    log_success "Services stopped for $env environment"
}

# Restart services
restart_services() {
    local env="${1:-dev}"
    local service="${2:-}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    
    log "Restarting services for $env environment"
    
    if [[ -n "$service" ]]; then
        if ! is_valid_service "$service"; then
            log_error "Invalid service: $service"
            exit 1
        fi
        log "Restarting service: $service"
        docker-compose -f "$compose_file" restart "$service"
    else
        log "Restarting all services"
        docker-compose -f "$compose_file" restart
    fi
    
    log_success "Services restarted for $env environment"
}

# View logs
view_logs() {
    local env="${1:-dev}"
    local service="${2:-}"
    local follow="${3:-false}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env"
    
    log "Viewing logs for $env environment"
    
    if [[ -n "$service" ]]; then
        if ! is_valid_service "$service"; then
            log_error "Invalid service: $service"
            exit 1
        fi
        log "Viewing logs for service: $service"
        if [[ "$follow" == "true" ]]; then
            docker-compose -f "$compose_file" logs -f "$service"
        else
            docker-compose -f "$compose_file" logs "$service"
        fi
    else
        log "Viewing logs for all services"
        if [[ "$follow" == "true" ]]; then
            docker-compose -f "$compose_file" logs -f
        else
            docker-compose -f "$compose_file" logs
        fi
    fi
}

# Show status
show_status() {
    local env="${1:-dev}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    
    log "Status for $env environment"
    echo
    docker-compose -f "$compose_file" ps
    echo
    log_info "Container resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# Clean up
clean_up() {
    local env="${1:-all}"
    local force="${2:-false}"
    
    log "Cleaning up Docker resources"
    
    if [[ "$env" == "all" ]]; then
        log "Cleaning up all environments"
        for env_name in "${ENVIRONMENTS[@]}"; do
            local compose_file=$(get_compose_file "$env_name")
            if [[ -f "$compose_file" ]]; then
                log "Cleaning up $env_name environment"
                docker-compose -f "$compose_file" down -v --remove-orphans
            fi
        done
    else
        if ! is_valid_env "$env"; then
            log_error "Invalid environment: $env"
            exit 1
        fi
        
        local compose_file=$(get_compose_file "$env")
        log "Cleaning up $env environment"
        docker-compose -f "$compose_file" down -v --remove-orphans
    fi
    
    if [[ "$force" == "true" ]]; then
        log "Force cleaning up unused resources"
        docker system prune -f
        docker volume prune -f
        docker network prune -f
    fi
    
    log_success "Cleanup completed"
}

# Access container shell
access_shell() {
    local env="${1:-dev}"
    local service="${2:-api}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    if ! is_valid_service "$service"; then
        log_error "Invalid service: $service"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    local container_name="bikedreams-${service}-${env}"
    
    log "Accessing shell for $service in $env environment"
    docker-compose -f "$compose_file" exec "$service" sh
}

# Execute command in container
execute_command() {
    local env="${1:-dev}"
    local service="${2:-api}"
    local command="${3:-}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    if ! is_valid_service "$service"; then
        log_error "Invalid service: $service"
        exit 1
    fi
    
    if [[ -z "$command" ]]; then
        log_error "Command required"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    
    log "Executing command in $service ($env): $command"
    docker-compose -f "$compose_file" exec "$service" sh -c "$command"
}

# Backup data
backup_data() {
    local env="${1:-dev}"
    local backup_dir="${2:-./backups}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$backup_dir/backup_${env}_${timestamp}"
    
    log "Creating backup for $env environment"
    mkdir -p "$backup_path"
    
    # Backup database
    log "Backing up database"
    docker-compose -f "$compose_file" exec -T postgres pg_dump -U bikedreams_user bikedreams_${env} > "$backup_path/database.sql"
    
    # Backup uploads
    log "Backing up uploads"
    docker-compose -f "$compose_file" exec -T api tar -czf - /app/uploads > "$backup_path/uploads.tar.gz"
    
    # Backup logs
    log "Backing up logs"
    docker-compose -f "$compose_file" exec -T api tar -czf - /app/logs > "$backup_path/logs.tar.gz"
    
    log_success "Backup created: $backup_path"
}

# Restore data
restore_data() {
    local env="${1:-dev}"
    local backup_path="${2:-}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    if [[ -z "$backup_path" ]]; then
        log_error "Backup path required"
        exit 1
    fi
    
    if [[ ! -d "$backup_path" ]]; then
        log_error "Backup path not found: $backup_path"
        exit 1
    fi
    
    local compose_file=$(get_compose_file "$env")
    
    log "Restoring data for $env environment from $backup_path"
    
    # Restore database
    if [[ -f "$backup_path/database.sql" ]]; then
        log "Restoring database"
        docker-compose -f "$compose_file" exec -T postgres psql -U bikedreams_user -d bikedreams_${env} < "$backup_path/database.sql"
    fi
    
    # Restore uploads
    if [[ -f "$backup_path/uploads.tar.gz" ]]; then
        log "Restoring uploads"
        docker-compose -f "$compose_file" exec -T api tar -xzf - -C / < "$backup_path/uploads.tar.gz"
    fi
    
    # Restore logs
    if [[ -f "$backup_path/logs.tar.gz" ]]; then
        log "Restoring logs"
        docker-compose -f "$compose_file" exec -T api tar -xzf - -C / < "$backup_path/logs.tar.gz"
    fi
    
    log_success "Data restored for $env environment"
}

# Show usage information
show_usage() {
    echo "BikeDreams Backend Docker Manager"
    echo
    echo "Usage: $0 [command] [environment] [service] [options]"
    echo
    echo "Commands:"
    echo "  build <env> [service]     Build Docker images"
    echo "  up <env> [service]        Start services"
    echo "  down <env> [service]      Stop services"
    echo "  restart <env> [service]   Restart services"
    echo "  logs <env> [service] [follow]  View logs"
    echo "  status <env>              Show status"
    echo "  clean <env> [force]       Clean up containers and images"
    echo "  shell <env> [service]     Access container shell"
    echo "  exec <env> <service> <cmd>  Execute command in container"
    echo "  backup <env> [dir]        Backup data"
    echo "  restore <env> <path>      Restore data"
    echo "  help                      Show this help message"
    echo
    echo "Environments:"
    echo "  dev, staging, prod"
    echo
    echo "Services:"
    echo "  api, postgres, redis, nginx, adminer, redis-commander, mailhog, prometheus, grafana, loki, backup"
    echo
    echo "Examples:"
    echo "  $0 build dev"
    echo "  $0 up staging api"
    echo "  $0 logs prod api true"
    echo "  $0 shell dev postgres"
    echo "  $0 exec dev api 'npm run test'"
    echo "  $0 backup prod ./backups"
    echo "  $0 clean all true"
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "build")
            build_images "${2:-dev}" "${3:-}"
            ;;
        "up")
            start_services "${2:-dev}" "${3:-}"
            ;;
        "down")
            stop_services "${2:-dev}" "${3:-}"
            ;;
        "restart")
            restart_services "${2:-dev}" "${3:-}"
            ;;
        "logs")
            view_logs "${2:-dev}" "${3:-}" "${4:-false}"
            ;;
        "status")
            show_status "${2:-dev}"
            ;;
        "clean")
            clean_up "${2:-all}" "${3:-false}"
            ;;
        "shell")
            access_shell "${2:-dev}" "${3:-api}"
            ;;
        "exec")
            execute_command "${2:-dev}" "${3:-api}" "${4:-}"
            ;;
        "backup")
            backup_data "${2:-dev}" "${3:-./backups}"
            ;;
        "restore")
            restore_data "${2:-dev}" "${3:-}"
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

