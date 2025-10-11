#!/bin/bash

# ================================================================
# BikeDreams Backend - Security Tests Runner
# ================================================================
#
# This script executes the complete security test suite including:
# - Unit tests for security components
# - Integration tests with security focus
# - Penetration testing suite
# - Load testing for security endpoints
# - Configuration validation
# - Dependency vulnerability scanning
#
# Usage:
#   ./run-security-tests.sh [options]
#
# Options:
#   --ci                   Run in CI mode (no interactive prompts)
#   --verbose              Enable verbose output
#   --report=FORMAT        Generate report (html, junit, json)
#   --coverage             Include coverage analysis
#   --skip-load            Skip load testing
#   --skip-pentest         Skip penetration testing
#   --timeout=SECONDS      Set test timeout (default: 300)
#
# ================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CI_MODE="${CI_MODE:-false}"
VERBOSE="${VERBOSE:-false}"
REPORT_FORMAT="${REPORT_FORMAT:-html}"
INCLUDE_COVERAGE="${INCLUDE_COVERAGE:-false}"
SKIP_LOAD="${SKIP_LOAD:-false}"
SKIP_PENTEST="${SKIP_PENTEST:-false}"
TEST_TIMEOUT="${TEST_TIMEOUT:-300}"

# Test directories
TESTS_DIR="$PROJECT_ROOT/src/tests"
REPORTS_DIR="$PROJECT_ROOT/test-reports"
COVERAGE_DIR="$PROJECT_ROOT/coverage"

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
    echo "          BikeDreams Backend Security Test Suite"
    echo "================================================================"
    echo "Environment: ${NODE_ENV:-development}"
    echo "Time: $(date)"
    echo "Reports: $REPORTS_DIR"
    echo "================================================================"
    echo -e "${NC}"
}

# Error handling
trap 'handle_error $? $LINENO' ERR

handle_error() {
    local exit_code=$1
    local line_number=$2
    log_error "Security tests failed at line $line_number with exit code $exit_code"
    
    if [[ -f "$REPORTS_DIR/security-summary.json" ]]; then
        log_info "Test results available in: $REPORTS_DIR/security-summary.json"
    fi
    
    exit $exit_code
}

# Utility functions
confirm_action() {
    local message="$1"
    if [[ "$CI_MODE" == "true" ]]; then
        return 0
    fi
    
    read -p "$message (y/N): " -r
    [[ $REPLY =~ ^[Yy]$ ]]
}

check_dependencies() {
    log "Checking test dependencies"
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check required packages
    local required_packages=("jest" "supertest" "@types/jest")
    
    for package in "${required_packages[@]}"; do
        if ! npm list "$package" &> /dev/null; then
            log_warning "Required package not found: $package"
            log_info "Installing missing dependencies..."
            npm install
            break
        fi
    done
    
    log_success "All dependencies are available"
}

setup_test_environment() {
    log "Setting up test environment"
    
    # Create directories
    mkdir -p "$REPORTS_DIR" "$COVERAGE_DIR"
    
    # Set environment variables for testing
    export NODE_ENV=test
    export LOG_LEVEL=error
    export JEST_TIMEOUT=$((TEST_TIMEOUT * 1000))
    
    # Clear previous reports
    rm -f "$REPORTS_DIR"/*.{xml,json,html} 2>/dev/null || true
    
    log_success "Test environment ready"
}

run_unit_security_tests() {
    log "Running unit security tests"
    
    local test_files=(
        "auth-security.test.ts"
        "validation-security.test.ts"
        "middleware-security.test.ts"
        "encryption.test.ts"
    )
    
    local jest_args=(
        "--testTimeout=$((TEST_TIMEOUT * 1000))"
        "--testMatch='**/*security*.test.ts'"
        "--testPathPattern=unit"
        "--reporters=default"
        "--reporters=jest-junit"
        "--reporters=jest-html-reporters"
    )
    
    if [[ "$INCLUDE_COVERAGE" == "true" ]]; then
        jest_args+=("--coverage" "--coverageDirectory=$COVERAGE_DIR/unit")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        jest_args+=("--verbose")
    fi
    
    # Run Jest with security focus
    JEST_JUNIT_OUTPUT_DIR="$REPORTS_DIR" \
    JEST_JUNIT_OUTPUT_NAME="security-unit-tests.xml" \
        npx jest "${jest_args[@]}" || {
        log_error "Unit security tests failed"
        return 1
    }
    
    log_success "Unit security tests completed"
}

run_integration_security_tests() {
    log "Running integration security tests"
    
    local jest_args=(
        "--testTimeout=$((TEST_TIMEOUT * 1000))"
        "--testMatch='**/*integration*security*.test.ts'"
        "--testPathPattern=integration"
        "--runInBand"  # Run tests serially for integration tests
        "--reporters=default"
        "--reporters=jest-junit"
        "--reporters=jest-html-reporters"
    )
    
    if [[ "$INCLUDE_COVERAGE" == "true" ]]; then
        jest_args+=("--coverage" "--coverageDirectory=$COVERAGE_DIR/integration")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        jest_args+=("--verbose")
    fi
    
    # Run integration tests
    JEST_JUNIT_OUTPUT_DIR="$REPORTS_DIR" \
    JEST_JUNIT_OUTPUT_NAME="security-integration-tests.xml" \
        npx jest "${jest_args[@]}" || {
        log_error "Integration security tests failed"
        return 1
    }
    
    log_success "Integration security tests completed"
}

run_penetration_tests() {
    if [[ "$SKIP_PENTEST" == "true" ]]; then
        log_warning "Skipping penetration tests (--skip-pentest flag)"
        return 0
    fi
    
    log "Running penetration tests"
    
    # Check if we have the penetration test suite
    if [[ ! -f "$TESTS_DIR/penetration/pentest.test.ts" ]]; then
        log_warning "Penetration test suite not found, skipping..."
        return 0
    fi
    
    local jest_args=(
        "--testTimeout=$((TEST_TIMEOUT * 2 * 1000))"  # Double timeout for pentest
        "--testMatch='**/*pentest*.test.ts'"
        "--testPathPattern=penetration"
        "--runInBand"
        "--reporters=default"
        "--reporters=jest-junit"
    )
    
    if [[ "$VERBOSE" == "true" ]]; then
        jest_args+=("--verbose")
    fi
    
    JEST_JUNIT_OUTPUT_DIR="$REPORTS_DIR" \
    JEST_JUNIT_OUTPUT_NAME="security-penetration-tests.xml" \
        npx jest "${jest_args[@]}" || {
        log_error "Penetration tests failed"
        return 1
    }
    
    log_success "Penetration tests completed"
}

run_load_security_tests() {
    if [[ "$SKIP_LOAD" == "true" ]]; then
        log_warning "Skipping load tests (--skip-load flag)"
        return 0
    fi
    
    log "Running security-focused load tests"
    
    # Check if we have the load test suite
    if [[ ! -f "$TESTS_DIR/load/security-load.test.ts" ]]; then
        log_warning "Security load test suite not found, skipping..."
        return 0
    fi
    
    local jest_args=(
        "--testTimeout=$((TEST_TIMEOUT * 3 * 1000))"  # Triple timeout for load tests
        "--testMatch='**/*load*security*.test.ts'"
        "--testPathPattern=load"
        "--runInBand"
        "--reporters=default"
        "--reporters=jest-junit"
    )
    
    if [[ "$VERBOSE" == "true" ]]; then
        jest_args+=("--verbose")
    fi
    
    JEST_JUNIT_OUTPUT_DIR="$REPORTS_DIR" \
    JEST_JUNIT_OUTPUT_NAME="security-load-tests.xml" \
        npx jest "${jest_args[@]}" || {
        log_error "Security load tests failed"
        return 1
    }
    
    log_success "Security load tests completed"
}

run_dependency_security_scan() {
    log "Running dependency security scan"
    
    # npm audit
    log_info "Running npm audit..."
    if ! npm audit --audit-level=moderate --json > "$REPORTS_DIR/npm-audit.json" 2>&1; then
        log_warning "npm audit found vulnerabilities"
        
        # Show critical/high vulnerabilities
        if command -v jq &> /dev/null; then
            local critical_high=$(jq -r '.vulnerabilities | to_entries[] | select(.value.severity == "critical" or .value.severity == "high") | .key' "$REPORTS_DIR/npm-audit.json" 2>/dev/null || echo "")
            if [[ -n "$critical_high" ]]; then
                log_error "Critical/High vulnerabilities found:"
                echo "$critical_high"
                return 1
            fi
        fi
    else
        log_success "No significant vulnerabilities found in dependencies"
    fi
    
    # Optional: Snyk scan if available
    if command -v snyk &> /dev/null; then
        log_info "Running Snyk security scan..."
        snyk test --json > "$REPORTS_DIR/snyk-scan.json" || {
            log_warning "Snyk scan found issues (this might be expected)"
        }
    fi
    
    log_success "Dependency security scan completed"
}

run_configuration_security_check() {
    log "Running configuration security checks"
    
    local config_issues=0
    
    # Check environment files
    local env_files=(".env" ".env.production" ".env.example")
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$env_file" ]]; then
            log_info "Checking $env_file..."
            
            # Check for exposed secrets (basic patterns)
            local secret_patterns=(
                "password=.*[^A-Z0-9]"
                "secret=.*[^A-Z0-9]"
                "key=.*[^A-Z0-9]"
                "token=.*[^A-Z0-9]"
            )
            
            for pattern in "${secret_patterns[@]}"; do
                if grep -qi "$pattern" "$PROJECT_ROOT/$env_file" 2>/dev/null; then
                    log_warning "Potential exposed secret pattern in $env_file"
                    ((config_issues++))
                fi
            done
        fi
    done
    
    # Check Docker security
    if [[ -f "$PROJECT_ROOT/Dockerfile" ]]; then
        log_info "Checking Dockerfile security..."
        
        if grep -q "USER root" "$PROJECT_ROOT/Dockerfile" 2>/dev/null; then
            log_warning "Dockerfile runs as root user"
            ((config_issues++))
        fi
        
        if ! grep -q "USER " "$PROJECT_ROOT/Dockerfile" 2>/dev/null; then
            log_warning "Dockerfile doesn't specify non-root user"
            ((config_issues++))
        fi
    fi
    
    # Generate configuration report
    cat > "$REPORTS_DIR/config-security.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "issues_found": $config_issues,
  "status": "$([ $config_issues -eq 0 ] && echo "PASS" || echo "WARNING")",
  "details": "Configuration security check completed"
}
EOF
    
    if [[ $config_issues -gt 0 ]]; then
        log_warning "Configuration security check found $config_issues potential issues"
    else
        log_success "Configuration security check passed"
    fi
}

generate_security_report() {
    log "Generating comprehensive security report"
    
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local report_file="$REPORTS_DIR/security-summary.json"
    
    # Collect test results
    local unit_results="UNKNOWN"
    local integration_results="UNKNOWN"
    local pentest_results="UNKNOWN"
    local load_results="UNKNOWN"
    
    # Parse JUnit XML files for results
    if [[ -f "$REPORTS_DIR/security-unit-tests.xml" ]]; then
        unit_results=$(grep -o 'failures="[0-9]*"' "$REPORTS_DIR/security-unit-tests.xml" | cut -d'"' -f2)
        unit_results=$([ "$unit_results" = "0" ] && echo "PASS" || echo "FAIL")
    fi
    
    if [[ -f "$REPORTS_DIR/security-integration-tests.xml" ]]; then
        integration_results=$(grep -o 'failures="[0-9]*"' "$REPORTS_DIR/security-integration-tests.xml" | cut -d'"' -f2)
        integration_results=$([ "$integration_results" = "0" ] && echo "PASS" || echo "FAIL")
    fi
    
    # Generate comprehensive report
    cat > "$report_file" << EOF
{
  "security_test_summary": {
    "timestamp": "$timestamp",
    "environment": "${NODE_ENV:-unknown}",
    "test_suite_version": "1.0.0",
    "results": {
      "unit_tests": {
        "status": "$unit_results",
        "report_file": "security-unit-tests.xml"
      },
      "integration_tests": {
        "status": "$integration_results",
        "report_file": "security-integration-tests.xml"
      },
      "penetration_tests": {
        "status": "$pentest_results",
        "report_file": "security-penetration-tests.xml"
      },
      "load_tests": {
        "status": "$load_results",
        "report_file": "security-load-tests.xml"
      },
      "dependency_scan": {
        "report_file": "npm-audit.json"
      },
      "configuration_check": {
        "report_file": "config-security.json"
      }
    },
    "overall_status": "$([ "$unit_results$integration_results" = "PASSPASS" ] && echo "PASS" || echo "FAIL")"
  }
}
EOF
    
    # Generate HTML report if requested
    if [[ "$REPORT_FORMAT" == "html" ]]; then
        generate_html_report
    fi
    
    log_success "Security report generated: $report_file"
}

generate_html_report() {
    local html_file="$REPORTS_DIR/security-report.html"
    
    cat > "$html_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BikeDreams Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        .status-warning { color: #ffc107; font-weight: bold; }
        .test-section { margin: 20px 0; padding: 15px; border-left: 4px solid #007bff; background-color: #f8f9fa; }
        .test-section h3 { margin-top: 0; color: #333; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-card { padding: 15px; border-radius: 5px; text-align: center; }
        .summary-card.pass { background-color: #d4edda; border: 1px solid #c3e6cb; }
        .summary-card.fail { background-color: #f8d7da; border: 1px solid #f5c6cb; }
        .summary-card.warning { background-color: #fff3cd; border: 1px solid #ffeaa7; }
        .timestamp { text-align: center; color: #666; font-size: 0.9em; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 BikeDreams Security Test Report</h1>
            <p>Comprehensive Security Testing Results</p>
        </div>
        
        <div class="summary">
            <div class="summary-card" id="unit-card">
                <h3>Unit Tests</h3>
                <p id="unit-status">Loading...</p>
            </div>
            <div class="summary-card" id="integration-card">
                <h3>Integration Tests</h3>
                <p id="integration-status">Loading...</p>
            </div>
            <div class="summary-card" id="pentest-card">
                <h3>Penetration Tests</h3>
                <p id="pentest-status">Loading...</p>
            </div>
            <div class="summary-card" id="load-card">
                <h3>Load Tests</h3>
                <p id="load-status">Loading...</p>
            </div>
        </div>
        
        <div class="test-section">
            <h3>🧪 Test Execution Summary</h3>
            <p><strong>Environment:</strong> <span id="environment">Loading...</span></p>
            <p><strong>Execution Time:</strong> <span id="timestamp">Loading...</span></p>
            <p><strong>Overall Status:</strong> <span id="overall-status">Loading...</span></p>
        </div>
        
        <div class="test-section">
            <h3>📊 Detailed Results</h3>
            <p>Detailed test results are available in the following files:</p>
            <ul>
                <li><strong>Unit Tests:</strong> security-unit-tests.xml</li>
                <li><strong>Integration Tests:</strong> security-integration-tests.xml</li>
                <li><strong>Dependency Scan:</strong> npm-audit.json</li>
                <li><strong>Configuration Check:</strong> config-security.json</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Generated by BikeDreams Security Test Suite</p>
        </div>
    </div>
    
    <script>
        // Load and display results from JSON
        fetch('./security-summary.json')
            .then(response => response.json())
            .then(data => {
                const results = data.security_test_summary.results;
                
                // Update status indicators
                updateStatus('unit', results.unit_tests.status);
                updateStatus('integration', results.integration_tests.status);
                updateStatus('pentest', results.penetration_tests.status);
                updateStatus('load', results.load_tests.status);
                
                // Update summary info
                document.getElementById('environment').textContent = data.security_test_summary.environment;
                document.getElementById('timestamp').textContent = new Date(data.security_test_summary.timestamp).toLocaleString();
                document.getElementById('overall-status').textContent = data.security_test_summary.overall_status;
                document.getElementById('overall-status').className = getStatusClass(data.security_test_summary.overall_status);
            })
            .catch(error => {
                console.error('Error loading test results:', error);
            });
        
        function updateStatus(testType, status) {
            const statusElement = document.getElementById(testType + '-status');
            const cardElement = document.getElementById(testType + '-card');
            
            statusElement.textContent = status;
            statusElement.className = getStatusClass(status);
            cardElement.classList.add(getCardClass(status));
        }
        
        function getStatusClass(status) {
            switch(status) {
                case 'PASS': return 'status-pass';
                case 'FAIL': return 'status-fail';
                default: return 'status-warning';
            }
        }
        
        function getCardClass(status) {
            switch(status) {
                case 'PASS': return 'pass';
                case 'FAIL': return 'fail';
                default: return 'warning';
            }
        }
    </script>
</body>
</html>
EOF
    
    log_success "HTML report generated: $html_file"
}

show_test_summary() {
    log "Security Test Execution Summary"
    
    if [[ -f "$REPORTS_DIR/security-summary.json" ]]; then
        echo
        log_info "📊 Test Results:"
        
        if command -v jq &> /dev/null; then
            jq -r '.security_test_summary.results | to_entries[] | "  \(.key): \(.value.status)"' "$REPORTS_DIR/security-summary.json"
            echo
            local overall_status=$(jq -r '.security_test_summary.overall_status' "$REPORTS_DIR/security-summary.json")
            if [[ "$overall_status" == "PASS" ]]; then
                log_success "Overall Status: $overall_status"
            else
                log_error "Overall Status: $overall_status"
            fi
        else
            log_info "Install 'jq' for better report parsing"
            cat "$REPORTS_DIR/security-summary.json"
        fi
        
        echo
        log_info "📁 Reports available in: $REPORTS_DIR"
        if [[ -f "$REPORTS_DIR/security-report.html" ]]; then
            log_info "🌐 Open security-report.html in your browser for detailed results"
        fi
    else
        log_error "Security summary report not found"
        return 1
    fi
}

# Command line argument parsing
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --ci)
                CI_MODE="true"
                shift
                ;;
            --verbose)
                VERBOSE="true"
                shift
                ;;
            --report=*)
                REPORT_FORMAT="${1#*=}"
                shift
                ;;
            --coverage)
                INCLUDE_COVERAGE="true"
                shift
                ;;
            --skip-load)
                SKIP_LOAD="true"
                shift
                ;;
            --skip-pentest)
                SKIP_PENTEST="true"
                shift
                ;;
            --timeout=*)
                TEST_TIMEOUT="${1#*=}"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

show_usage() {
    echo "BikeDreams Backend Security Tests"
    echo
    echo "Usage: $0 [options]"
    echo
    echo "Options:"
    echo "  --ci                   Run in CI mode (no interactive prompts)"
    echo "  --verbose              Enable verbose output"
    echo "  --report=FORMAT        Generate report (html, junit, json)"
    echo "  --coverage             Include coverage analysis"
    echo "  --skip-load            Skip load testing"
    echo "  --skip-pentest         Skip penetration testing"
    echo "  --timeout=SECONDS      Set test timeout (default: 300)"
    echo "  --help, -h             Show this help message"
    echo
}

# Main execution
main() {
    parse_arguments "$@"
    
    print_banner
    
    cd "$PROJECT_ROOT"
    
    # Pre-execution checks
    check_dependencies
    setup_test_environment
    
    # Execute test suites
    log "Starting comprehensive security test execution"
    
    local start_time=$(date +%s)
    local failed_tests=0
    
    # Run each test suite
    run_unit_security_tests || ((failed_tests++))
    run_integration_security_tests || ((failed_tests++))
    run_penetration_tests || ((failed_tests++))
    run_load_security_tests || ((failed_tests++))
    run_dependency_security_scan || ((failed_tests++))
    run_configuration_security_check || ((failed_tests++))
    
    # Generate reports
    generate_security_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo
    log_info "⏱️  Total execution time: ${duration}s"
    
    # Show summary
    show_test_summary
    
    # Final status
    if [[ $failed_tests -eq 0 ]]; then
        log_success "🎉 All security tests completed successfully!"
        exit 0
    else
        log_error "❌ $failed_tests test suite(s) failed"
        exit 1
    fi
}

# Run main function
main "$@"
