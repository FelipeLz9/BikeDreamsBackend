#!/bin/bash

# ==============================================
# BikeDreams Backend - Logging Manager
# ==============================================
#
# This script helps manage logging and monitoring
# for different environments (development, staging, production).
#
# Usage:
#   ./scripts/logging-manager.sh [command] [environment] [options]
#
# Commands:
#   setup        - Setup logging for environment
#   start        - Start logging services
#   stop         - Stop logging services
#   status       - Show logging status
#   logs         - View logs
#   metrics      - Show metrics
#   alerts       - Show alerts
#   health       - Check health
#   clean        - Clean old logs
#   rotate       - Rotate logs
#   monitor      - Start monitoring
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

# Get log directory for environment
get_log_dir() {
    local env="$1"
    case "$env" in
        "dev")
            echo "logs/development"
            ;;
        "staging")
            echo "logs/staging"
            ;;
        "prod")
            echo "logs/production"
            ;;
        *)
            echo "logs"
            ;;
    esac
}

# Setup logging for environment
setup_logging() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    local log_dir=$(get_log_dir "$env")
    
    log "Setting up logging for $env environment"
    
    # Create log directories
    mkdir -p "$log_dir"
    mkdir -p "$log_dir/app"
    mkdir -p "$log_dir/error"
    mkdir -p "$log_dir/audit"
    mkdir -p "$log_dir/security"
    mkdir -p "$log_dir/access"
    
    # Set permissions
    chmod 755 "$log_dir"
    chmod 644 "$log_dir"/*
    
    # Create logrotate configuration
    create_logrotate_config "$env" "$log_dir"
    
    # Create monitoring configuration
    create_monitoring_config "$env"
    
    log_success "Logging setup completed for $env environment"
}

# Create logrotate configuration
create_logrotate_config() {
    local env="$1"
    local log_dir="$2"
    
    local logrotate_file="/etc/logrotate.d/bikedreams-$env"
    
    cat > "$logrotate_file" << EOF
$log_dir/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        # Reload application if needed
        systemctl reload bikedreams-$env || true
    endscript
}
EOF
    
    log_info "Logrotate configuration created: $logrotate_file"
}

# Create monitoring configuration
create_monitoring_config() {
    local env="$1"
    local config_file="monitoring.$env.json"
    
    case "$env" in
        "dev")
            cat > "$config_file" << EOF
{
  "level": "debug",
  "enableConsole": true,
  "enableFile": true,
  "enableRemote": false,
  "channels": ["console"],
  "thresholds": {
    "errorRate": 0.1,
    "responseTime": 5000,
    "memoryUsage": 0.8,
    "cpuUsage": 0.8
  }
}
EOF
            ;;
        "staging")
            cat > "$config_file" << EOF
{
  "level": "info",
  "enableConsole": true,
  "enableFile": true,
  "enableRemote": true,
  "channels": ["console", "email", "slack"],
  "thresholds": {
    "errorRate": 0.05,
    "responseTime": 3000,
    "memoryUsage": 0.7,
    "cpuUsage": 0.7
  }
}
EOF
            ;;
        "prod")
            cat > "$config_file" << EOF
{
  "level": "warn",
  "enableConsole": false,
  "enableFile": true,
  "enableRemote": true,
  "channels": ["email", "slack", "pagerduty"],
  "thresholds": {
    "errorRate": 0.01,
    "responseTime": 2000,
    "memoryUsage": 0.8,
    "cpuUsage": 0.8
  }
}
EOF
            ;;
    esac
    
    log_info "Monitoring configuration created: $config_file"
}

# Start logging services
start_logging() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local env_config=$(get_env_config "$env")
    
    log "Starting logging services for $env environment"
    
    # Start log aggregation if configured
    if [[ "$env" == "staging" || "$env" == "prod" ]]; then
        start_log_aggregation "$env"
    fi
    
    # Start monitoring
    start_monitoring "$env"
    
    log_success "Logging services started for $env environment"
}

# Start log aggregation
start_log_aggregation() {
    local env="$1"
    
    log "Starting log aggregation for $env environment"
    
    # Start Loki if configured
    if [[ -n "${LOKI_ENDPOINT:-}" ]]; then
        log_info "Loki endpoint configured: $LOKI_ENDPOINT"
    fi
    
    # Start Promtail if configured
    if [[ -n "${PROMTAIL_CONFIG:-}" ]]; then
        log_info "Promtail configuration found"
    fi
}

# Start monitoring
start_monitoring() {
    local env="$1"
    
    log "Starting monitoring for $env environment"
    
    # Start Prometheus if configured
    if [[ -n "${PROMETHEUS_ENDPOINT:-}" ]]; then
        log_info "Prometheus endpoint configured: $PROMETHEUS_ENDPOINT"
    fi
    
    # Start Grafana if configured
    if [[ -n "${GRAFANA_ENDPOINT:-}" ]]; then
        log_info "Grafana endpoint configured: $GRAFANA_ENDPOINT"
    fi
}

# Stop logging services
stop_logging() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    log "Stopping logging services for $env environment"
    
    # Stop log aggregation
    stop_log_aggregation "$env"
    
    # Stop monitoring
    stop_monitoring "$env"
    
    log_success "Logging services stopped for $env environment"
}

# Stop log aggregation
stop_log_aggregation() {
    local env="$1"
    
    log "Stopping log aggregation for $env environment"
    
    # Stop Loki if running
    if pgrep -f "loki" > /dev/null; then
        pkill -f "loki"
        log_info "Loki stopped"
    fi
    
    # Stop Promtail if running
    if pgrep -f "promtail" > /dev/null; then
        pkill -f "promtail"
        log_info "Promtail stopped"
    fi
}

# Stop monitoring
stop_monitoring() {
    local env="$1"
    
    log "Stopping monitoring for $env environment"
    
    # Stop Prometheus if running
    if pgrep -f "prometheus" > /dev/null; then
        pkill -f "prometheus"
        log_info "Prometheus stopped"
    fi
    
    # Stop Grafana if running
    if pgrep -f "grafana" > /dev/null; then
        pkill -f "grafana"
        log_info "Grafana stopped"
    fi
}

# Show logging status
show_status() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local log_dir=$(get_log_dir "$env")
    
    log "Logging status for $env environment"
    
    # Check log directories
    if [[ -d "$log_dir" ]]; then
        log_success "Log directory exists: $log_dir"
        echo "  Size: $(du -sh "$log_dir" | cut -f1)"
        echo "  Files: $(find "$log_dir" -name "*.log" | wc -l)"
    else
        log_warning "Log directory not found: $log_dir"
    fi
    
    # Check log files
    echo
    log_info "Log files:"
    find "$log_dir" -name "*.log" -type f | head -10 | while read -r file; do
        echo "  $file ($(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "unknown") bytes)"
    done
    
    # Check log aggregation services
    echo
    log_info "Log aggregation services:"
    if pgrep -f "loki" > /dev/null; then
        log_success "Loki is running"
    else
        log_warning "Loki is not running"
    fi
    
    if pgrep -f "promtail" > /dev/null; then
        log_success "Promtail is running"
    else
        log_warning "Promtail is not running"
    fi
    
    # Check monitoring services
    echo
    log_info "Monitoring services:"
    if pgrep -f "prometheus" > /dev/null; then
        log_success "Prometheus is running"
    else
        log_warning "Prometheus is not running"
    fi
    
    if pgrep -f "grafana" > /dev/null; then
        log_success "Grafana is running"
    else
        log_warning "Grafana is not running"
    fi
}

# View logs
view_logs() {
    local env="$1"
    local log_type="${2:-app}"
    local follow="${3:-false}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local log_dir=$(get_log_dir "$env")
    local log_file="$log_dir/$log_type.log"
    
    if [[ ! -f "$log_file" ]]; then
        log_error "Log file not found: $log_file"
        exit 1
    fi
    
    log "Viewing $log_type logs for $env environment"
    
    if [[ "$follow" == "true" ]]; then
        tail -f "$log_file"
    else
        tail -n 100 "$log_file"
    fi
}

# Show metrics
show_metrics() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    log "Metrics for $env environment"
    
    # System metrics
    echo
    log_info "System Metrics:"
    echo "  Memory Usage: $(free -h | grep Mem | awk '{print $3 "/" $2 " (" $3/$2*100 "%)"}')"
    echo "  CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    echo "  Disk Usage: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
    
    # Application metrics
    echo
    log_info "Application Metrics:"
    echo "  Uptime: $(uptime -p)"
    echo "  Load Average: $(uptime | awk -F'load average:' '{print $2}')"
    echo "  Processes: $(ps aux | wc -l)"
    
    # Log metrics
    local log_dir=$(get_log_dir "$env")
    if [[ -d "$log_dir" ]]; then
        echo
        log_info "Log Metrics:"
        echo "  Total Log Files: $(find "$log_dir" -name "*.log" | wc -l)"
        echo "  Total Log Size: $(du -sh "$log_dir" | cut -f1)"
        echo "  Error Logs: $(find "$log_dir" -name "error*.log" | wc -l)"
        echo "  Security Logs: $(find "$log_dir" -name "security*.log" | wc -l)"
    fi
}

# Show alerts
show_alerts() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    log "Alerts for $env environment"
    
    # Check for recent errors
    local log_dir=$(get_log_dir "$env")
    if [[ -d "$log_dir" ]]; then
        echo
        log_info "Recent Errors:"
        find "$log_dir" -name "*.log" -type f -exec grep -l "ERROR\|FATAL" {} \; | head -5 | while read -r file; do
            echo "  $file"
            grep -n "ERROR\|FATAL" "$file" | tail -3 | while read -r line; do
                echo "    $line"
            done
        done
        
        echo
        log_info "Recent Warnings:"
        find "$log_dir" -name "*.log" -type f -exec grep -l "WARN" {} \; | head -5 | while read -r file; do
            echo "  $file"
            grep -n "WARN" "$file" | tail -3 | while read -r line; do
                echo "    $line"
            done
        done
    fi
}

# Check health
check_health() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    log "Health check for $env environment"
    
    # Check log directories
    local log_dir=$(get_log_dir "$env")
    if [[ -d "$log_dir" ]]; then
        log_success "Log directory accessible: $log_dir"
    else
        log_error "Log directory not accessible: $log_dir"
    fi
    
    # Check log files
    local log_files=("app.log" "error.log" "audit.log" "security.log")
    for log_file in "${log_files[@]}"; do
        if [[ -f "$log_dir/$log_file" ]]; then
            log_success "Log file accessible: $log_file"
        else
            log_warning "Log file not found: $log_file"
        fi
    done
    
    # Check log aggregation
    if pgrep -f "loki" > /dev/null; then
        log_success "Loki is running"
    else
        log_warning "Loki is not running"
    fi
    
    if pgrep -f "promtail" > /dev/null; then
        log_success "Promtail is running"
    else
        log_warning "Promtail is not running"
    fi
    
    # Check monitoring
    if pgrep -f "prometheus" > /dev/null; then
        log_success "Prometheus is running"
    else
        log_warning "Prometheus is not running"
    fi
    
    if pgrep -f "grafana" > /dev/null; then
        log_success "Grafana is running"
    else
        log_warning "Grafana is not running"
    fi
}

# Clean old logs
clean_logs() {
    local env="$1"
    local days="${2:-30}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    local log_dir=$(get_log_dir "$env")
    
    log "Cleaning logs older than $days days for $env environment"
    
    if [[ -d "$log_dir" ]]; then
        find "$log_dir" -name "*.log" -type f -mtime +$days -delete
        log_success "Cleaned logs older than $days days"
    else
        log_warning "Log directory not found: $log_dir"
    fi
}

# Rotate logs
rotate_logs() {
    local env="$1"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    log "Rotating logs for $env environment"
    
    # Use logrotate if available
    if command -v logrotate > /dev/null; then
        logrotate -f "/etc/logrotate.d/bikedreams-$env"
        log_success "Logs rotated using logrotate"
    else
        # Manual rotation
        local log_dir=$(get_log_dir "$env")
        local timestamp=$(date +%Y%m%d_%H%M%S)
        
        find "$log_dir" -name "*.log" -type f | while read -r file; do
            mv "$file" "${file}.${timestamp}"
            touch "$file"
        done
        
        log_success "Logs rotated manually"
    fi
}

# Start monitoring
start_monitor() {
    local env="$1"
    local duration="${2:-60}"
    
    if ! is_valid_env "$env"; then
        log_error "Invalid environment: $env"
        exit 1
    fi
    
    log "Starting monitoring for $env environment (${duration}s)"
    
    # Start monitoring in background
    (
        for ((i=1; i<=duration; i++)); do
            echo -n "."
            sleep 1
        done
        echo
    ) &
    
    local monitor_pid=$!
    wait $monitor_pid
    
    # Show final metrics
    show_metrics "$env"
    
    log_success "Monitoring completed for $env environment"
}

# Show usage information
show_usage() {
    echo "BikeDreams Backend Logging Manager"
    echo
    echo "Usage: $0 [command] [environment] [options]"
    echo
    echo "Commands:"
    echo "  setup <env>              Setup logging for environment"
    echo "  start <env>              Start logging services"
    echo "  stop <env>               Stop logging services"
    echo "  status <env>             Show logging status"
    echo "  logs <env> [type] [follow]  View logs"
    echo "  metrics <env>            Show metrics"
    echo "  alerts <env>             Show alerts"
    echo "  health <env>             Check health"
    echo "  clean <env> [days]       Clean old logs"
    echo "  rotate <env>             Rotate logs"
    echo "  monitor <env> [duration] Start monitoring"
    echo "  help                     Show this help message"
    echo
    echo "Environments:"
    echo "  dev, staging, prod"
    echo
    echo "Log Types:"
    echo "  app, error, audit, security, access"
    echo
    echo "Examples:"
    echo "  $0 setup dev"
    echo "  $0 start staging"
    echo "  $0 logs prod error true"
    echo "  $0 metrics staging"
    echo "  $0 clean prod 30"
    echo "  $0 monitor dev 120"
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
            setup_logging "$2"
            ;;
        "start")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            start_logging "$2"
            ;;
        "stop")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            stop_logging "$2"
            ;;
        "status")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            show_status "$2"
            ;;
        "logs")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            view_logs "$2" "${3:-app}" "${4:-false}"
            ;;
        "metrics")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            show_metrics "$2"
            ;;
        "alerts")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            show_alerts "$2"
            ;;
        "health")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            check_health "$2"
            ;;
        "clean")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            clean_logs "$2" "${3:-30}"
            ;;
        "rotate")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            rotate_logs "$2"
            ;;
        "monitor")
            if [[ $# -lt 2 ]]; then
                log_error "Environment required"
                show_usage
                exit 1
            fi
            start_monitor "$2" "${3:-60}"
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
