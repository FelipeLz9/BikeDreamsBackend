#!/bin/bash

# ================================================================
# BikeDreams Backend - AWS EC2 Initial Setup Script
# ================================================================
#
# This script configures a fresh EC2 instance with all required
# dependencies for running the BikeDreams backend.
#
# Usage:
#   sudo bash ec2-setup.sh
#
# Requirements:
#   - Ubuntu 20.04+ or Amazon Linux 2
#   - Root or sudo access
#
# ================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/bikedreams-backend}"
DOCKER_COMPOSE_VERSION="2.24.0"

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
    exit 1
}

print_banner() {
    echo -e "${BLUE}"
    echo "================================================================"
    echo "     BikeDreams Backend - EC2 Instance Setup"
    echo "================================================================"
    echo "This script will install and configure:"
    echo "  - Docker & Docker Compose"
    echo "  - System dependencies"
    echo "  - Firewall rules (UFW)"
    echo "  - Deployment directory structure"
    echo "  - Log rotation"
    echo "================================================================"
    echo -e "${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root or with sudo"
    fi
}

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
        log "Detected OS: $OS $VERSION"
    else
        log_error "Cannot detect operating system"
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        apt-get update -y
        apt-get upgrade -y
        log_success "System packages updated"
    elif [[ "$OS" == "amzn" ]] || [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]]; then
        yum update -y
        log_success "System packages updated"
    else
        log_warning "Unknown OS, skipping system update"
    fi
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        apt-get install -y \
            curl \
            wget \
            git \
            jq \
            unzip \
            ca-certificates \
            gnupg \
            lsb-release \
            apt-transport-https \
            software-properties-common \
            ufw \
            htop \
            vim \
            nano
    elif [[ "$OS" == "amzn" ]] || [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]]; then
        yum install -y \
            curl \
            wget \
            git \
            jq \
            unzip \
            ca-certificates \
            vim \
            nano
    fi
    
    log_success "System dependencies installed"
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    if command -v docker &> /dev/null; then
        log_warning "Docker is already installed"
        docker --version
        return 0
    fi
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        # Add Docker's official GPG key
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        
        # Add Docker repository
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
          $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker
        apt-get update -y
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
    elif [[ "$OS" == "amzn" ]]; then
        # Amazon Linux 2
        amazon-linux-extras install docker -y
        yum install -y docker
    else
        log_error "Unsupported OS for Docker installation"
    fi
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    # Add deploy user to docker group
    usermod -aG docker "$DEPLOY_USER"
    
    log_success "Docker installed successfully"
    docker --version
}

# Install Docker Compose
install_docker_compose() {
    log "Installing Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        log_warning "Docker Compose is already installed"
        docker-compose --version
        return 0
    fi
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log_success "Docker Compose installed successfully"
    docker-compose --version
}

# Configure Docker daemon
configure_docker() {
    log "Configuring Docker daemon..."
    
    mkdir -p /etc/docker
    
    cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "userland-proxy": false,
  "live-restore": true,
  "default-address-pools": [
    {
      "base": "172.17.0.0/12",
      "size": 24
    }
  ]
}
EOF
    
    systemctl restart docker
    log_success "Docker daemon configured"
}

# Setup firewall
setup_firewall() {
    log "Configuring UFW firewall..."
    
    if ! command -v ufw &> /dev/null; then
        log_warning "UFW not available, skipping firewall configuration"
        return 0
    fi
    
    # Reset UFW to default
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow 22/tcp comment 'SSH'
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # Allow API port (if different)
    ufw allow 3001/tcp comment 'BikeDreams API'
    
    # Enable UFW
    ufw --force enable
    
    log_success "Firewall configured"
    ufw status
}

# Create deployment directory structure
setup_deployment_directory() {
    log "Setting up deployment directory structure..."
    
    # Create main deployment directory
    mkdir -p "$DEPLOY_DIR"
    
    # Create subdirectories
    mkdir -p "$DEPLOY_DIR/backups"
    mkdir -p "$DEPLOY_DIR/logs"
    mkdir -p "$DEPLOY_DIR/ssl"
    mkdir -p "$DEPLOY_DIR/data/postgres"
    mkdir -p "$DEPLOY_DIR/data/redis"
    
    # Set ownership
    chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"
    
    # Set permissions
    chmod 755 "$DEPLOY_DIR"
    chmod 700 "$DEPLOY_DIR/ssl"
    chmod 755 "$DEPLOY_DIR/backups"
    chmod 755 "$DEPLOY_DIR/logs"
    chmod 700 "$DEPLOY_DIR/data"
    
    log_success "Deployment directory structure created at $DEPLOY_DIR"
}

# Setup log rotation
setup_log_rotation() {
    log "Configuring log rotation..."
    
    cat > /etc/logrotate.d/bikedreams-backend <<EOF
$DEPLOY_DIR/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 $DEPLOY_USER $DEPLOY_USER
    sharedscripts
    postrotate
        docker-compose -f $DEPLOY_DIR/docker-compose.prod.yml restart nginx > /dev/null 2>&1 || true
    endscript
}
EOF
    
    log_success "Log rotation configured"
}

# Install Node.js (optional, for running scripts)
install_nodejs() {
    log "Installing Node.js..."
    
    if command -v node &> /dev/null; then
        log_warning "Node.js is already installed"
        node --version
        return 0
    fi
    
    # Install Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        apt-get install -y nodejs
    elif [[ "$OS" == "amzn" ]] || [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]]; then
        yum install -y nodejs
    fi
    
    log_success "Node.js installed successfully"
    node --version
    npm --version
}

# Install Bun runtime
install_bun() {
    log "Installing Bun runtime..."
    
    if command -v bun &> /dev/null; then
        log_warning "Bun is already installed"
        bun --version
        return 0
    fi
    
    # Install Bun as deploy user
    su - "$DEPLOY_USER" -c "curl -fsSL https://bun.sh/install | bash"
    
    # Add Bun to PATH for all users
    echo 'export BUN_INSTALL="$HOME/.bun"' >> /etc/profile.d/bun.sh
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /etc/profile.d/bun.sh
    
    log_success "Bun runtime installed successfully"
}

# Setup system limits
configure_system_limits() {
    log "Configuring system limits..."
    
    cat >> /etc/security/limits.conf <<EOF

# BikeDreams Backend limits
$DEPLOY_USER soft nofile 65536
$DEPLOY_USER hard nofile 65536
$DEPLOY_USER soft nproc 4096
$DEPLOY_USER hard nproc 4096
EOF
    
    log_success "System limits configured"
}

# Setup automatic security updates
setup_auto_updates() {
    log "Configuring automatic security updates..."
    
    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        apt-get install -y unattended-upgrades
        dpkg-reconfigure -plow unattended-upgrades
        log_success "Automatic security updates enabled"
    else
        log_warning "Automatic updates not configured for this OS"
    fi
}

# Create deployment helper script
create_helper_scripts() {
    log "Creating helper scripts..."
    
    # Create quick status check script
    cat > "$DEPLOY_DIR/status.sh" <<'EOF'
#!/bin/bash
cd /opt/bikedreams-backend
echo "=== Docker Containers ==="
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "=== Resource Usage ==="
docker stats --no-stream
echo ""
echo "=== Disk Usage ==="
df -h | grep -E '(Filesystem|/$|/opt)'
echo ""
echo "=== Memory Usage ==="
free -h
EOF
    
    chmod +x "$DEPLOY_DIR/status.sh"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR/status.sh"
    
    log_success "Helper scripts created"
}

# Print summary
print_summary() {
    echo -e "${GREEN}"
    echo "================================================================"
    echo "           EC2 Instance Setup Completed Successfully!"
    echo "================================================================"
    echo -e "${NC}"
    echo "Installation Summary:"
    echo "  ✓ Docker: $(docker --version)"
    echo "  ✓ Docker Compose: $(docker-compose --version)"
    echo "  ✓ Deployment directory: $DEPLOY_DIR"
    echo "  ✓ Firewall configured (UFW)"
    echo "  ✓ Log rotation configured"
    echo ""
    echo "Next Steps:"
    echo "  1. Clone your repository to $DEPLOY_DIR"
    echo "  2. Create .env.production file with your configuration"
    echo "  3. Configure GitHub Secrets for CI/CD"
    echo "  4. Push to main branch to trigger deployment"
    echo ""
    echo "Useful Commands:"
    echo "  - Check status: $DEPLOY_DIR/status.sh"
    echo "  - View logs: docker-compose -f $DEPLOY_DIR/docker-compose.prod.yml logs -f"
    echo "  - Restart services: docker-compose -f $DEPLOY_DIR/docker-compose.prod.yml restart"
    echo ""
    echo -e "${YELLOW}⚠ Important: Log out and log back in for Docker group changes to take effect${NC}"
    echo "================================================================"
}

# Main execution
main() {
    print_banner
    
    check_root
    detect_os
    update_system
    install_dependencies
    install_docker
    install_docker_compose
    configure_docker
    setup_firewall
    setup_deployment_directory
    setup_log_rotation
    install_nodejs
    install_bun
    configure_system_limits
    setup_auto_updates
    create_helper_scripts
    
    print_summary
}

# Run main function
main "$@"
