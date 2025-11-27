#!/bin/bash

# ==============================================
# BikeDreams Backend - Scripts Manager
# ==============================================
#
# This script helps manage and discover available npm scripts
# for different environments and use cases.
#
# Usage:
#   ./scripts/scripts-manager.sh [command] [category] [environment]
#
# Commands:
#   list        - List all available scripts
#   search      - Search for specific scripts
#   run         - Run a script with environment
#   help        - Show help for a specific script
#   validate    - Validate script syntax
#   docs        - Generate documentation
#
# Categories:
#   dev, build, start, test, db, admin, docker, env, ts, util, monitor, ci, maintenance
#
# ==============================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PACKAGE_JSON="$PROJECT_ROOT/package.json"

# Available categories
CATEGORIES=("dev" "build" "start" "test" "db" "admin" "docker" "env" "ts" "util" "monitor" "ci" "maintenance")

# Available environments
ENVIRONMENTS=("development" "staging" "production" "test")

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

# Check if category is valid
is_valid_category() {
    local category="$1"
    for valid_category in "${CATEGORIES[@]}"; do
        if [[ "$category" == "$valid_category" ]]; then
            return 0
        fi
    done
    return 1
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

# Extract scripts from package.json
extract_scripts() {
    if [[ ! -f "$PACKAGE_JSON" ]]; then
        log_error "package.json not found"
        exit 1
    fi
    
    # Extract scripts section using node
    node -e "
        const pkg = require('$PACKAGE_JSON');
        const scripts = pkg.scripts || {};
        Object.keys(scripts).forEach(key => {
            if (!key.startsWith('/*')) {
                console.log(key + '|' + scripts[key]);
            }
        });
    "
}

# List all available scripts
list_scripts() {
    local category="${1:-all}"
    
    log "Available npm scripts"
    
    if [[ "$category" == "all" ]]; then
        log_info "All scripts:"
        extract_scripts | while IFS='|' read -r script command; do
            if [[ -n "$script" && -n "$command" ]]; then
                echo "  $script"
            fi
        done
    else
        if ! is_valid_category "$category"; then
            log_error "Invalid category: $category"
            log_info "Available categories: ${CATEGORIES[*]}"
            exit 1
        fi
        
        log_info "Scripts for category: $category"
        extract_scripts | while IFS='|' read -r script command; do
            if [[ -n "$script" && -n "$command" && "$script" =~ ^$category ]]; then
                echo "  $script"
            fi
        done
    fi
}

# Search for specific scripts
search_scripts() {
    local search_term="$1"
    
    if [[ -z "$search_term" ]]; then
        log_error "Search term required"
        exit 1
    fi
    
    log "Searching for scripts containing: $search_term"
    
    extract_scripts | while IFS='|' read -r script command; do
        if [[ -n "$script" && -n "$command" && ("$script" =~ $search_term || "$command" =~ $search_term) ]]; then
            echo "  $script: $command"
        fi
    done
}

# Run a script with environment
run_script() {
    local script="$1"
    local env="${2:-}"
    
    if [[ -z "$script" ]]; then
        log_error "Script name required"
        exit 1
    fi
    
    # Check if script exists
    local script_exists=false
    extract_scripts | while IFS='|' read -r script_name command; do
        if [[ "$script_name" == "$script" ]]; then
            script_exists=true
            break
        fi
    done
    
    if [[ "$script_exists" == "false" ]]; then
        log_error "Script not found: $script"
        log_info "Use 'list' command to see available scripts"
        exit 1
    fi
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Run script with environment if specified
    if [[ -n "$env" ]]; then
        if ! is_valid_env "$env"; then
            log_error "Invalid environment: $env"
            log_info "Available environments: ${ENVIRONMENTS[*]}"
            exit 1
        fi
        
        log "Running script '$script' with environment '$env'"
        NODE_ENV="$env" npm run "$script"
    else
        log "Running script '$script'"
        npm run "$script"
    fi
}

# Show help for a specific script
show_help() {
    local script="$1"
    
    if [[ -z "$script" ]]; then
        log_error "Script name required"
        exit 1
    fi
    
    # Get script command
    local command=$(extract_scripts | grep "^$script|" | cut -d'|' -f2)
    
    if [[ -z "$command" ]]; then
        log_error "Script not found: $script"
        exit 1
    fi
    
    log "Help for script: $script"
    echo
    echo "Command: $command"
    echo
    
    # Provide context-specific help
    case "$script" in
        "dev"|"dev:*")
            echo "Development scripts for local development with hot reloading"
            echo "Usage: npm run $script"
            echo "Environment: development"
            ;;
        "build"|"build:*")
            echo "Build scripts for compiling TypeScript to JavaScript"
            echo "Usage: npm run $script"
            echo "Output: dist/ directory"
            ;;
        "start"|"start:*")
            echo "Start scripts for running the application"
            echo "Usage: npm run $script"
            echo "Environment: production (unless specified)"
            ;;
        "test"|"test:*")
            echo "Testing scripts for running Jest tests"
            echo "Usage: npm run $script"
            echo "Environment: test"
            ;;
        "db"|"db:*")
            echo "Database scripts for Prisma operations"
            echo "Usage: npm run $script"
            echo "Requires: Database connection"
            ;;
        "docker"|"docker:*")
            echo "Docker scripts for containerization"
            echo "Usage: npm run $script"
            echo "Requires: Docker installed"
            ;;
        *)
            echo "General purpose script"
            echo "Usage: npm run $script"
            ;;
    esac
}

# Validate script syntax
validate_scripts() {
    log "Validating npm scripts syntax"
    
    # Check if package.json is valid JSON
    if ! node -e "JSON.parse(require('fs').readFileSync('$PACKAGE_JSON', 'utf8'))" 2>/dev/null; then
        log_error "package.json is not valid JSON"
        exit 1
    fi
    
    # Check for common script issues
    local issues=0
    
    extract_scripts | while IFS='|' read -r script command; do
        if [[ -n "$script" && -n "$command" ]]; then
            # Check for missing semicolons in chained commands
            if [[ "$command" =~ && && ! "$command" =~ \; ]]; then
                log_warning "Script '$script' might need semicolons in chained commands"
                ((issues++))
            fi
            
            # Check for potential security issues
            if [[ "$command" =~ rm\ -rf.*node_modules ]]; then
                log_warning "Script '$script' contains potentially dangerous rm -rf command"
                ((issues++))
            fi
        fi
    done
    
    if [[ $issues -eq 0 ]]; then
        log_success "All scripts validated successfully"
    else
        log_warning "Found $issues potential issues"
    fi
}

# Generate documentation
generate_docs() {
    local output_file="${1:-SCRIPTS-DOCUMENTATION.md}"
    
    log "Generating scripts documentation: $output_file"
    
    cat > "$output_file" << 'EOF'
# 📜 Scripts Documentation - BikeDreams Backend

This document provides comprehensive documentation for all available npm scripts in the BikeDreams Backend project.

## 📋 Script Categories

### 🚀 Development Scripts
Scripts for local development with hot reloading and debugging.

### 🏗️ Build Scripts
Scripts for compiling TypeScript to JavaScript for different environments.

### ▶️ Start Scripts
Scripts for running the application in different environments.

### 🧪 Testing Scripts
Scripts for running tests with different configurations and environments.

### 🗄️ Database Scripts
Scripts for database operations using Prisma.

### 👑 Admin Scripts
Scripts for managing admin users and permissions.

### 🐳 Docker Scripts
Scripts for containerization and Docker operations.

### 🌍 Environment Scripts
Scripts for managing environment configurations.

### 🔧 TypeScript Scripts
Scripts for TypeScript compilation and type checking.

### 🛠️ Utility Scripts
General purpose utility scripts for maintenance and cleanup.

### 📊 Monitoring Scripts
Scripts for monitoring application health and performance.

### 🔄 CI/CD Scripts
Scripts for continuous integration and deployment.

### 🔧 Maintenance Scripts
Scripts for system maintenance and optimization.

## 📖 Usage Examples

### Development
```bash
# Start development server
npm run dev

# Start with environment file
npm run dev:env

# Start with debugging
npm run dev:debug

# Start staging environment
npm run dev:staging
```

### Building
```bash
# Build for production
npm run build:prod

# Build for development
npm run build:dev

# Build all environments
npm run build:all

# Clean build
npm run build:clean:prod
```

### Testing
```bash
# Run all tests
npm run test

# Run tests for specific environment
npm run test:dev
npm run test:staging
npm run test:prod

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:dev
npm run db:migrate:staging
npm run db:migrate:prod

# Reset database
npm run db:reset:dev

# Create admin user
npm run admin:create:dev
```

### Docker Operations
```bash
# Build Docker image
npm run docker:build:prod

# Run with Docker Compose
npm run docker:compose:prod

# View logs
npm run docker:logs:prod

# Clean up
npm run docker:clean
```

## 🔍 Finding Scripts

Use the scripts manager to find and run scripts:

```bash
# List all scripts
./scripts/scripts-manager.sh list

# List scripts by category
./scripts/scripts-manager.sh list dev
./scripts/scripts-manager.sh list test

# Search for specific scripts
./scripts/scripts-manager.sh search "coverage"
./scripts/scripts-manager.sh search "docker"

# Get help for a script
./scripts/scripts-manager.sh help "test:coverage"

# Run a script with environment
./scripts/scripts-manager.sh run "test:coverage" "development"
```

## ⚠️ Important Notes

1. **Environment Variables**: Most scripts use environment-specific files (.env.development, .env.staging, etc.)
2. **Prerequisites**: Some scripts require specific tools (Docker, Prisma, etc.)
3. **Permissions**: Some scripts may require specific permissions
4. **Dependencies**: Ensure all dependencies are installed before running scripts

## 🆘 Troubleshooting

### Common Issues

1. **Script not found**: Use `npm run` to list available scripts
2. **Permission denied**: Check file permissions and user access
3. **Environment not found**: Ensure environment files exist
4. **Dependencies missing**: Run `npm install` first

### Getting Help

- Use `./scripts/scripts-manager.sh help <script-name>` for specific help
- Check the main README.md for general project information
- Review environment setup documentation

EOF

    # Add script details
    echo "" >> "$output_file"
    echo "## 📝 Complete Script List" >> "$output_file"
    echo "" >> "$output_file"
    
    extract_scripts | while IFS='|' read -r script command; do
        if [[ -n "$script" && -n "$command" && ! "$script" =~ ^/\* ]]; then
            echo "### $script" >> "$output_file"
            echo "\`\`\`bash" >> "$output_file"
            echo "npm run $script" >> "$output_file"
            echo "\`\`\`" >> "$output_file"
            echo "" >> "$output_file"
            echo "**Command:** \`$command\`" >> "$output_file"
            echo "" >> "$output_file"
        fi
    done
    
    log_success "Documentation generated: $output_file"
}

# Show usage information
show_usage() {
    echo "BikeDreams Backend Scripts Manager"
    echo
    echo "Usage: $0 [command] [category] [environment]"
    echo
    echo "Commands:"
    echo "  list <category>     List available scripts (all or by category)"
    echo "  search <term>       Search for scripts containing term"
    echo "  run <script> <env>  Run a script with optional environment"
    echo "  help <script>       Show help for a specific script"
    echo "  validate            Validate script syntax"
    echo "  docs [file]         Generate documentation"
    echo "  help                Show this help message"
    echo
    echo "Categories:"
    echo "  dev, build, start, test, db, admin, docker, env, ts, util, monitor, ci, maintenance"
    echo
    echo "Environments:"
    echo "  development, staging, production, test"
    echo
    echo "Examples:"
    echo "  $0 list dev"
    echo "  $0 search coverage"
    echo "  $0 run test:coverage development"
    echo "  $0 help build:prod"
    echo "  $0 validate"
    echo "  $0 docs"
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "list")
            list_scripts "${2:-all}"
            ;;
        "search")
            if [[ $# -lt 2 ]]; then
                log_error "Search term required"
                show_usage
                exit 1
            fi
            search_scripts "$2"
            ;;
        "run")
            if [[ $# -lt 2 ]]; then
                log_error "Script name required"
                show_usage
                exit 1
            fi
            run_script "$2" "${3:-}"
            ;;
        "help")
            if [[ $# -lt 2 ]]; then
                show_usage
            else
                show_help "$2"
            fi
            ;;
        "validate")
            validate_scripts
            ;;
        "docs")
            generate_docs "${2:-SCRIPTS-DOCUMENTATION.md}"
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
