#!/bin/bash

# ==============================================
# BikeDreams Backend - Database Manager
# ==============================================
#
# This script helps manage database operations
# for different environments (development, staging, production).
#
# Usage:
#   ./scripts/db-manager.sh [command] [environment] [options]
#
# Commands:
#   setup        - Setup database for environment
#   migrate      - Run database migrations
#   seed         - Seed database with data
#   reset        - Reset database
#   backup       - Backup database
#   restore      - Restore database
#   status       - Show database status
#   health       - Check database health
#   optimize     - Optimize database
#   monitor      - Monitor database performance
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

# Get environment-specific configuration
get_env_config() {
    local env="$1"
    case "$env" in
        "dev")
            echo "development"
            ;;
        "staging")
            echo "staging"
            ;;
        "prod")
            echo "production"
            ;;
        *)
            log_error "Invalid environment: $env"
            exit 1
            ;;
    esac
}

# Get database URL for environment
get_db_url() {
    local env="$1"
    local env_file=".env.$(get_env_config "$env")"
    
    if [[ ! -f "$env_file" ]]; then
        log_error "Environment file not found: $env_file"
        exit 1
    fi
    
    # Extract DATABASE_URL from environment file
    grep "^DATABASE_URL=" "$env_file" | cut -d'=' -f2- | tr -d '"'
}

# Get Prisma schema file for environment
get_prisma_schema() {
    local env="$1"
    case "$env" in
        "dev")
            echo "prisma/schema.development.prisma"
            ;;
        "staging")
            echo "prisma/schema.staging.prisma"
            ;;
        "prod")
            echo "prisma/schema.production.prisma"
            ;;
        *)
            echo "prisma/schema.prisma"
            ;;
    esac
}

# Setup database for environment
setup_database() {
    local env="$1"
    local force="${2:-false}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    local prisma_schema=$(get_prisma_schema "$env")
    
    log "Setting up database for $env environment"
    
    # Check if schema file exists
    if [[ ! -f "$prisma_schema" ]]; then
        log_error "Prisma schema file not found: $prisma_schema"
        exit 1
    fi
    
    # Copy environment-specific schema to main schema
    cp "$prisma_schema" "prisma/schema.prisma"
    
    # Generate Prisma client
    log "Generating Prisma client for $env environment"
    bun run prisma:generate
    
    # Run migrations
    log "Running database migrations for $env environment"
    if [[ "$force" == "true" ]]; then
        bun run prisma:migrate:dev
    else
        bun run prisma:migrate:deploy
    fi
    
    log_success "Database setup completed for $env environment"
}

# Run database migrations
run_migrations() {
    local env="$1"
    local force="${2:-false}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Running database migrations for $env environment"
    
    # Copy environment-specific schema to main schema
    local prisma_schema=$(get_prisma_schema "$env")
    cp "$prisma_schema" "prisma/schema.prisma"
    
    # Generate Prisma client
    bun run prisma:generate
    
    # Run migrations
    if [[ "$force" == "true" ]]; then
        bun run prisma:migrate:dev
    else
        bun run prisma:migrate:deploy
    fi
    
    log_success "Database migrations completed for $env environment"
}

# Seed database with data
seed_database() {
    local env="$1"
    local force="${2:-false}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Seeding database for $env environment"
    
    # Check if seed script exists
    if [[ ! -f "src/scripts/seed.ts" ]]; then
        log_warning "Seed script not found: src/scripts/seed.ts"
        return 0
    fi
    
    # Run seed script
    if [[ "$env" == "dev" ]]; then
        bun run --env-file=".env.development" src/scripts/seed.ts
    elif [[ "$env" == "staging" ]]; then
        bun run --env-file=".env.staging" src/scripts/seed.ts
    elif [[ "$env" == "prod" ]]; then
        bun run --env-file=".env.production" src/scripts/seed.ts
    fi
    
    log_success "Database seeding completed for $env environment"
}

# Reset database
reset_database() {
    local env="$1"
    local force="${2:-false}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    if [[ "$env" == "prod" && "$force" != "true" ]]; then
        log_error "Production database reset requires --force flag"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Resetting database for $env environment"
    
    # Copy environment-specific schema to main schema
    local prisma_schema=$(get_prisma_schema "$env")
    cp "$prisma_schema" "prisma/schema.prisma"
    
    # Generate Prisma client
    bun run prisma:generate
    
    # Reset database
    bun run prisma:migrate:reset --force
    
    log_success "Database reset completed for $env environment"
}

# Backup database
backup_database() {
    local env="$1"
    local backup_dir="${2:-./backups}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/backup_${env}_${timestamp}.sql"
    
    log "Creating database backup for $env environment"
    
    # Create backup directory
    mkdir -p "$backup_dir"
    
    # Get database URL
    local db_url=$(get_db_url "$env")
    
    # Extract connection details
    local db_host=$(echo "$db_url" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$db_url" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local db_name=$(echo "$db_url" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    local db_user=$(echo "$db_url" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local db_password=$(echo "$db_url" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Create backup
    PGPASSWORD="$db_password" pg_dump \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=plain \
        > "$backup_file"
    
    # Compress backup
    gzip "$backup_file"
    
    log_success "Database backup created: ${backup_file}.gz"
}

# Restore database
restore_database() {
    local env="$1"
    local backup_file="$2"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Restoring database for $env environment from $backup_file"
    
    # Get database URL
    local db_url=$(get_db_url "$env")
    
    # Extract connection details
    local db_host=$(echo "$db_url" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$db_url" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local db_name=$(echo "$db_url" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    local db_user=$(echo "$db_url" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local db_password=$(echo "$db_url" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Restore database
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | PGPASSWORD="$db_password" psql \
            -h "$db_host" \
            -p "$db_port" \
            -U "$db_user" \
            -d "$db_name"
    else
        PGPASSWORD="$db_password" psql \
            -h "$db_host" \
            -p "$db_port" \
            -U "$db_user" \
            -d "$db_name" \
            -f "$backup_file"
    fi
    
    log_success "Database restore completed for $env environment"
}

# Show database status
show_status() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Database status for $env environment"
    
    # Get database URL
    local db_url=$(get_db_url "$env")
    
    # Extract connection details
    local db_host=$(echo "$db_url" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$db_url" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local db_name=$(echo "$db_url" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    local db_user=$(echo "$db_url" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local db_password=$(echo "$db_url" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Check connection
    if PGPASSWORD="$db_password" pg_isready -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name"; then
        log_success "Database connection successful"
    else
        log_error "Database connection failed"
        exit 1
    fi
    
    # Show database info
    echo
    log_info "Database Information:"
    echo "  Host: $db_host"
    echo "  Port: $db_port"
    echo "  Database: $db_name"
    echo "  User: $db_user"
    
    # Show migration status
    echo
    log_info "Migration Status:"
    bun run prisma:migrate:status
    
    # Show table information
    echo
    log_info "Table Information:"
    PGPASSWORD="$db_password" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -c "\dt"
}

# Check database health
check_health() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Checking database health for $env environment"
    
    # Get database URL
    local db_url=$(get_db_url "$env")
    
    # Extract connection details
    local db_host=$(echo "$db_url" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$db_url" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local db_name=$(echo "$db_url" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    local db_user=$(echo "$db_url" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local db_password=$(echo "$db_url" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Check connection
    if ! PGPASSWORD="$db_password" pg_isready -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name"; then
        log_error "Database connection failed"
        exit 1
    fi
    
    # Check database size
    local db_size=$(PGPASSWORD="$db_password" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -t -c "SELECT pg_size_pretty(pg_database_size('$db_name'));")
    
    # Check active connections
    local active_connections=$(PGPASSWORD="$db_password" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")
    
    # Check table count
    local table_count=$(PGPASSWORD="$db_password" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    echo
    log_info "Database Health Report:"
    echo "  Connection: ✓ OK"
    echo "  Database Size: $db_size"
    echo "  Active Connections: $active_connections"
    echo "  Table Count: $table_count"
    
    log_success "Database health check completed"
}

# Optimize database
optimize_database() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Optimizing database for $env environment"
    
    # Get database URL
    local db_url=$(get_db_url "$env")
    
    # Extract connection details
    local db_host=$(echo "$db_url" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$db_url" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local db_name=$(echo "$db_url" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    local db_user=$(echo "$db_url" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local db_password=$(echo "$db_url" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Analyze tables
    log "Analyzing tables..."
    PGPASSWORD="$db_password" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -c "ANALYZE;"
    
    # Vacuum tables
    log "Vacuuming tables..."
    PGPASSWORD="$db_password" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -c "VACUUM;"
    
    # Reindex tables
    log "Reindexing tables..."
    PGPASSWORD="$db_password" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -c "REINDEX DATABASE $db_name;"
    
    log_success "Database optimization completed for $env environment"
}

# Monitor database performance
monitor_database() {
    local env="$1"
    local duration="${2:-60}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Monitoring database performance for $env environment (${duration}s)"
    
    # Get database URL
    local db_url=$(get_db_url "$env")
    
    # Extract connection details
    local db_host=$(echo "$db_url" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$db_url" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local db_name=$(echo "$db_url" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    local db_user=$(echo "$db_url" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local db_password=$(echo "$db_url" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Monitor for specified duration
    for ((i=1; i<=duration; i++)); do
        echo -n "."
        sleep 1
    done
    echo
    
    # Show performance metrics
    log_info "Performance Metrics:"
    PGPASSWORD="$db_password" psql \
        -h "$db_host" \
        -p "$db_port" \
        -U "$db_user" \
        -d "$db_name" \
        -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
    
    log_success "Database monitoring completed"
}

# Show usage information
show_usage() {
    echo "BikeDreams Backend Database Manager"
    echo
    echo "Usage: $0 [command] [environment] [options]"
    echo
    echo "Commands:"
    echo "  setup <env> [--force]     Setup database for environment"
    echo "  migrate <env> [--force]   Run database migrations"
    echo "  seed <env> [--force]      Seed database with data"
    echo "  reset <env> [--force]     Reset database"
    echo "  backup <env> [dir]        Backup database"
    echo "  restore <env> <file>      Restore database"
    echo "  status <env>              Show database status"
    echo "  health <env>              Check database health"
    echo "  optimize <env>            Optimize database"
    echo "  monitor <env> [duration]  Monitor database performance"
    echo "  help                      Show this help message"
    echo
    echo "Environments:"
    echo "  dev, staging, prod"
    echo
    echo "Examples:"
    echo "  $0 setup dev"
    echo "  $0 migrate staging --force"
    echo "  $0 backup prod ./backups"
    echo "  $0 restore dev ./backups/backup_dev_20241201_120000.sql.gz"
    echo "  $0 health prod"
    echo "  $0 monitor staging 120"
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "setup")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            setup_database "$2" "${3:-false}"
            ;;
        "migrate")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            run_migrations "$2" "${3:-false}"
            ;;
        "seed")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            seed_database "$2" "${3:-false}"
            ;;
        "reset")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            reset_database "$2" "${3:-false}"
            ;;
        "backup")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            backup_database "$2" "${3:-./backups}"
            ;;
        "restore")
            if [[ $# -lt 3 ]]; then
                log_error "Environment and backup file required"
                show_usage
                exit 1
            fi
            restore_database "$2" "$3"
            ;;
        "status")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            show_status "$2"
            ;;
        "health")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            check_health "$2"
            ;;
        "optimize")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            optimize_database "$2"
            ;;
        "monitor")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            monitor_database "$2" "${3:-60}"
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
