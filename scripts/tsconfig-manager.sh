#!/bin/bash

# ==============================================
# BikeDreams Backend - TypeScript Configuration Manager
# ==============================================
#
# This script helps manage TypeScript configurations
# for different environments and build processes.
#
# Usage:
#   ./scripts/tsconfig-manager.sh [command] [environment]
#
# Commands:
#   build       - Build TypeScript for specific environment
#   check       - Type check without emitting files
#   watch       - Watch mode for development
#   clean       - Clean build output
#   validate    - Validate TypeScript configuration
#   list        - List available configurations
#
# Environments:
#   development, staging, production, test, all
#
# ==============================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Available environments
AVAILABLE_ENVS=("development" "staging" "production" "test" "all")

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
    for valid_env in "${AVAILABLE_ENVS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done
    return 1
}

# Get TypeScript config file path
get_tsconfig_file() {
    local env="$1"
    if [[ "$env" == "all" ]]; then
        echo ""
    else
        echo "tsconfig.$env.json"
    fi
}

# Get output directory
get_output_dir() {
    local env="$1"
    case "$env" in
        "development") echo "dist/dev" ;;
        "staging") echo "dist/staging" ;;
        "production") echo "dist/production" ;;
        "test") echo "dist/test" ;;
        "all") echo "dist" ;;
        *) echo "dist" ;;
    esac
}

# Build TypeScript for specific environment
build_typescript() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        log_info "Available environments: ${AVAILABLE_ENVS[*]}"
        exit 1
    fi
    
    local tsconfig_file=$(get_tsconfig_file "$env")
    local output_dir=$(get_output_dir "$env")
    
    log "Building TypeScript for $env environment"
    
    # Check if config file exists
    if [[ "$env" != "all" && ! -f "$PROJECT_ROOT/$tsconfig_file" ]]; then
        log_error "TypeScript config file not found: $tsconfig_file"
        exit 1
    fi
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Build based on environment
    if [[ "$env" == "all" ]]; then
        log_info "Building all environments..."
        npm run build:all
    else
        log_info "Building with config: $tsconfig_file"
        tsc --project "$tsconfig_file"
    fi
    
    # Check if build was successful
    if [[ $? -eq 0 ]]; then
        log_success "TypeScript build completed for $env"
        log_info "Output directory: $output_dir"
    else
        log_error "TypeScript build failed for $env"
        exit 1
    fi
}

# Type check without emitting files
check_typescript() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local tsconfig_file=$(get_tsconfig_file "$env")
    
    log "Type checking TypeScript for $env environment"
    
    # Check if config file exists
    if [[ "$env" != "all" && ! -f "$PROJECT_ROOT/$tsconfig_file" ]]; then
        log_error "TypeScript config file not found: $tsconfig_file"
        exit 1
    fi
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Type check based on environment
    if [[ "$env" == "all" ]]; then
        log_info "Type checking all environments..."
        for env_name in "development" "staging" "production" "test"; do
            log_info "Checking $env_name..."
            tsc --noEmit --project "tsconfig.$env_name.json"
        done
    else
        log_info "Type checking with config: $tsconfig_file"
        tsc --noEmit --project "$tsconfig_file"
    fi
    
    # Check if type check was successful
    if [[ $? -eq 0 ]]; then
        log_success "TypeScript type check passed for $env"
    else
        log_error "TypeScript type check failed for $env"
        exit 1
    fi
}

# Watch mode for development
watch_typescript() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local tsconfig_file=$(get_tsconfig_file "$env")
    
    log "Starting TypeScript watch mode for $env environment"
    
    # Check if config file exists
    if [[ "$env" != "all" && ! -f "$PROJECT_ROOT/$tsconfig_file" ]]; then
        log_error "TypeScript config file not found: $tsconfig_file"
        exit 1
    fi
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Start watch mode
    if [[ "$env" == "all" ]]; then
        log_warning "Watch mode not supported for 'all' environment"
        log_info "Use specific environment instead"
        exit 1
    else
        log_info "Watching with config: $tsconfig_file"
        tsc --watch --project "$tsconfig_file"
    fi
}

# Clean build output
clean_build() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local output_dir=$(get_output_dir "$env")
    
    log "Cleaning build output for $env environment"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Clean based on environment
    if [[ "$env" == "all" ]]; then
        log_info "Cleaning all build outputs..."
        rm -rf dist/
        log_success "All build outputs cleaned"
    else
        log_info "Cleaning output directory: $output_dir"
        rm -rf "$output_dir"
        log_success "Build output cleaned for $env"
    fi
}

# Validate TypeScript configuration
validate_config() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local tsconfig_file=$(get_tsconfig_file "$env")
    
    log "Validating TypeScript configuration for $env environment"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Validate based on environment
    if [[ "$env" == "all" ]]; then
        log_info "Validating all configurations..."
        for env_name in "development" "staging" "production" "test"; do
            log_info "Validating $env_name..."
            if [[ -f "tsconfig.$env_name.json" ]]; then
                tsc --showConfig --project "tsconfig.$env_name.json" > /dev/null
                if [[ $? -eq 0 ]]; then
                    log_success "Configuration valid: tsconfig.$env_name.json"
                else
                    log_error "Configuration invalid: tsconfig.$env_name.json"
                    exit 1
                fi
            else
                log_warning "Configuration file not found: tsconfig.$env_name.json"
            fi
        done
    else
        if [[ -f "$tsconfig_file" ]]; then
            log_info "Validating configuration: $tsconfig_file"
            tsc --showConfig --project "$tsconfig_file" > /dev/null
            if [[ $? -eq 0 ]]; then
                log_success "Configuration valid: $tsconfig_file"
            else
                log_error "Configuration invalid: $tsconfig_file"
                exit 1
            fi
        else
            log_error "Configuration file not found: $tsconfig_file"
            exit 1
        fi
    fi
}

# List available configurations
list_configs() {
    log "Available TypeScript configurations:"
    
    for env in "${AVAILABLE_ENVS[@]}"; do
        local tsconfig_file=$(get_tsconfig_file "$env")
        local output_dir=$(get_output_dir "$env")
        
        if [[ "$env" == "all" ]]; then
            log_info "  $env (builds all environments)"
        elif [[ -f "$PROJECT_ROOT/$tsconfig_file" ]]; then
            log_success "  $env (tsconfig.$env.json -> $output_dir)"
        else
            log_warning "  $env (tsconfig.$env.json not found)"
        fi
    done
}

# Show usage information
show_usage() {
    echo "BikeDreams Backend TypeScript Configuration Manager"
    echo
    echo "Usage: $0 [command] [environment]"
    echo
    echo "Commands:"
    echo "  build <env>      Build TypeScript for specific environment"
    echo "  check <env>      Type check without emitting files"
    echo "  watch <env>      Watch mode for development"
    echo "  clean <env>      Clean build output"
    echo "  validate <env>   Validate TypeScript configuration"
    echo "  list             List available configurations"
    echo "  help             Show this help message"
    echo
    echo "Environments:"
    echo "  development      Development environment"
    echo "  staging          Staging environment"
    echo "  production       Production environment"
    echo "  test             Test environment"
    echo "  all              All environments (build only)"
    echo
    echo "Examples:"
    echo "  $0 build development"
    echo "  $0 check production"
    echo "  $0 watch development"
    echo "  $0 clean all"
    echo "  $0 validate staging"
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "build")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required for build command"
                show_usage
                exit 1
            fi
            build_typescript "$2"
            ;;
        "check")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required for check command"
                show_usage
                exit 1
            fi
            check_typescript "$2"
            ;;
        "watch")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required for watch command"
                show_usage
                exit 1
            fi
            watch_typescript "$2"
            ;;
        "clean")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required for clean command"
                show_usage
                exit 1
            fi
            clean_build "$2"
            ;;
        "validate")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required for validate command"
                show_usage
                exit 1
            fi
            validate_config "$2"
            ;;
        "list")
            list_configs
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


