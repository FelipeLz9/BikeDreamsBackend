#!/bin/bash

# ==============================================
# BikeDreams Backend - Environment Manager
# ==============================================
#
# This script helps manage environment configurations
# for different deployment environments.
#
# Usage:
#   ./scripts/env-manager.sh [command] [environment]
#
# Commands:
#   setup     - Setup environment from template
#   validate  - Validate environment configuration
#   list      - List available environments
#   copy      - Copy environment configuration
#   reset     - Reset environment to defaults
#
# Environments:
#   development, staging, production, test
#
# ==============================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_TEMPLATE="$PROJECT_ROOT/env.example"

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

# Available environments
AVAILABLE_ENVS=("development" "staging" "production" "test")

# Check if environment is valid
is_valid_env() {
    local env="$1"
    for valid_env in "${AVAILABLE_ENVS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done
    return 1
}

# Get environment file path
get_env_file() {
    local env="$1"
    echo "$PROJECT_ROOT/.env.$env"
}

# Get template file path
get_template_file() {
    local env="$1"
    echo "$PROJECT_ROOT/env.$env"
}

# Setup environment from template
setup_environment() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        log_info "Available environments: ${AVAILABLE_ENVS[*]}"
        exit 1
    fi
    
    local env_file=$(get_env_file "$env")
    local template_file=$(get_template_file "$env")
    
    log "Setting up $env environment"
    
    # Check if template exists
    if [[ ! -f "$template_file" ]]; then
        log_error "Template file not found: $template_file"
        exit 1
    fi
    
    # Check if environment file already exists
    if [[ -f "$env_file" ]]; then
        log_warning "Environment file already exists: $env_file"
        read -p "Do you want to overwrite it? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Setup cancelled"
            exit 0
        fi
    fi
    
    # Copy template to environment file
    cp "$template_file" "$env_file"
    
    # Make environment file readable only by owner
    chmod 600 "$env_file"
    
    log_success "Environment $env setup complete"
    log_info "Environment file: $env_file"
    log_warning "Remember to update the configuration values for your specific setup"
}

# Validate environment configuration
validate_environment() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        log_info "Available environments: ${AVAILABLE_ENVS[*]}"
        exit 1
    fi
    
    local env_file=$(get_env_file "$env")
    
    log "Validating $env environment configuration"
    
    # Check if environment file exists
    if [[ ! -f "$env_file" ]]; then
        log_error "Environment file not found: $env_file"
        log_info "Run 'setup $env' to create it"
        exit 1
    fi
    
    # Check file permissions
    local perms=$(stat -c "%a" "$env_file" 2>/dev/null || stat -f "%OLp" "$env_file" 2>/dev/null)
    if [[ "$perms" != "600" ]]; then
        log_warning "Environment file permissions are not secure (current: $perms, should be 600)"
        log_info "Run 'chmod 600 $env_file' to fix"
    fi
    
    # Check for required variables
    local required_vars=(
        "NODE_ENV"
        "PORT"
        "HOST"
        "DATABASE_URL"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required variables: ${missing_vars[*]}"
        exit 1
    fi
    
    # Check for placeholder values
    local placeholder_vars=()
    
    while IFS= read -r line; do
        if [[ "$line" =~ ^[A-Z_]+=.*(your_|CHANGE_ME_|PRODUCTION_).* ]]; then
            local var_name=$(echo "$line" | cut -d'=' -f1)
            placeholder_vars+=("$var_name")
        fi
    done < "$env_file"
    
    if [[ ${#placeholder_vars[@]} -gt 0 ]]; then
        log_warning "Variables with placeholder values: ${placeholder_vars[*]}"
        log_info "Update these values before deployment"
    fi
    
    log_success "Environment $env validation complete"
}

# List available environments
list_environments() {
    log "Available environments:"
    
    for env in "${AVAILABLE_ENVS[@]}"; do
        local env_file=$(get_env_file "$env")
        local template_file=$(get_template_file "$env")
        
        if [[ -f "$env_file" ]]; then
            log_success "  $env (configured)"
        elif [[ -f "$template_file" ]]; then
            log_info "  $env (template available)"
        else
            log_warning "  $env (no template)"
        fi
    done
}

# Copy environment configuration
copy_environment() {
    local source_env="$1"
    local target_env="$2"
    
    if ! is_valid_env "$source_env"; then
        log_error "Invalid source environment: $source_env"
        exit 1
    fi
    
    if ! is_valid_env "$target_env"; then
        log_error "Invalid target environment: $target_env"
        exit 1
    fi
    
    local source_file=$(get_env_file "$source_env")
    local target_file=$(get_env_file "$target_env")
    
    log "Copying $source_env configuration to $target_env"
    
    # Check if source file exists
    if [[ ! -f "$source_file" ]]; then
        log_error "Source environment file not found: $source_file"
        exit 1
    fi
    
    # Check if target file exists
    if [[ -f "$target_file" ]]; then
        log_warning "Target environment file already exists: $target_file"
        read -p "Do you want to overwrite it? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Copy cancelled"
            exit 0
        fi
    fi
    
    # Copy file
    cp "$source_file" "$target_file"
    chmod 600 "$target_file"
    
    log_success "Configuration copied from $source_env to $target_env"
    log_warning "Remember to update environment-specific values"
}

# Reset environment to defaults
reset_environment() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_file=$(get_env_file "$env")
    local template_file=$(get_template_file "$env")
    
    log "Resetting $env environment to defaults"
    
    # Check if template exists
    if [[ ! -f "$template_file" ]]; then
        log_error "Template file not found: $template_file"
        exit 1
    fi
    
    # Check if environment file exists
    if [[ ! -f "$env_file" ]]; then
        log_info "Environment file does not exist, creating from template"
    else
        log_warning "This will overwrite the existing environment file"
        read -p "Are you sure? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Reset cancelled"
            exit 0
        fi
    fi
    
    # Copy template to environment file
    cp "$template_file" "$env_file"
    chmod 600 "$env_file"
    
    log_success "Environment $env reset to defaults"
}

# Show usage information
show_usage() {
    echo "BikeDreams Backend Environment Manager"
    echo
    echo "Usage: $0 [command] [environment] [target_environment]"
    echo
    echo "Commands:"
    echo "  setup <env>           Setup environment from template"
    echo "  validate <env>        Validate environment configuration"
    echo "  list                  List available environments"
    echo "  copy <src> <dst>      Copy environment configuration"
    echo "  reset <env>           Reset environment to defaults"
    echo "  help                  Show this help message"
    echo
    echo "Environments:"
    echo "  development           Local development environment"
    echo "  staging               Staging environment"
    echo "  production            Production environment"
    echo "  test                  Test environment"
    echo
    echo "Examples:"
    echo "  $0 setup development"
    echo "  $0 validate production"
    echo "  $0 copy development staging"
    echo "  $0 reset test"
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "setup")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required for setup command"
                show_usage
                exit 1
            fi
            setup_environment "$2"
            ;;
        "validate")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required for validate command"
                show_usage
                exit 1
            fi
            validate_environment "$2"
            ;;
        "list")
            list_environments
            ;;
        "copy")
            if [[ $# -lt 3 ]]; then
                log_error "Source and target environments required for copy command"
                show_usage
                exit 1
            fi
            copy_environment "$2" "$3"
            ;;
        "reset")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required for reset command"
                show_usage
                exit 1
            fi
            reset_environment "$2"
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


