#!/bin/bash

# ================================================================
# SSL Certificate Generation Script for BikeDreams Backend
# ================================================================
#
# This script generates SSL certificates for development and provides
# instructions for production certificate setup.
#
# Usage:
#   ./generate-ssl-certs.sh [dev|prod-info]
#
# dev      - Generate self-signed certificates for development
# prod-info - Display instructions for production certificates
#
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/ssl"
DOMAIN="${DOMAIN:-api.bikedreams.com}"
COUNTRY="${COUNTRY:-US}"
STATE="${STATE:-California}"
CITY="${CITY:-San Francisco}"
ORG="${ORG:-BikeDreams}"
ORG_UNIT="${ORG_UNIT:-IT Department}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${PURPLE}"
    echo "================================================================"
    echo "        BikeDreams SSL Certificate Generator"
    echo "================================================================"
    echo -e "${NC}"
}

print_section() {
    echo -e "${CYAN}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_dependencies() {
    print_section "Checking Dependencies"
    
    if ! command -v openssl &> /dev/null; then
        print_error "OpenSSL is not installed. Please install it first."
        exit 1
    fi
    
    print_success "OpenSSL is installed: $(openssl version)"
}

create_directories() {
    print_section "Creating Directory Structure"
    
    mkdir -p "$CERTS_DIR"/{certs,private,csr,conf}
    chmod 700 "$CERTS_DIR/private"
    
    print_success "Created certificate directories"
    print_info "Certificates will be stored in: $CERTS_DIR"
}

generate_dhparam() {
    print_section "Generating DH Parameters"
    
    if [ ! -f "$CERTS_DIR/certs/dhparam.pem" ]; then
        print_info "Generating 2048-bit DH parameters (this may take a while)..."
        openssl dhparam -out "$CERTS_DIR/certs/dhparam.pem" 2048
        print_success "Generated DH parameters"
    else
        print_warning "DH parameters already exist, skipping..."
    fi
}

create_openssl_config() {
    print_section "Creating OpenSSL Configuration"
    
    cat > "$CERTS_DIR/conf/openssl.cnf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
C=$COUNTRY
ST=$STATE
L=$CITY
O=$ORG
OU=$ORG_UNIT
CN=$DOMAIN

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
DNS.3 = localhost
DNS.4 = api.localhost
IP.1 = 127.0.0.1
IP.2 = ::1

[v3_ext]
authorityKeyIdentifier=keyid,issuer:always
basicConstraints=CA:FALSE
keyUsage=keyEncipherment,dataEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt_names
EOF
    
    print_success "Created OpenSSL configuration"
}

generate_dev_certificates() {
    print_section "Generating Development Certificates"
    
    # Generate private key
    print_info "Generating private key..."
    openssl genrsa -out "$CERTS_DIR/private/bikedreams.key" 2048
    chmod 600 "$CERTS_DIR/private/bikedreams.key"
    
    # Generate certificate signing request
    print_info "Generating certificate signing request..."
    openssl req -new \
        -key "$CERTS_DIR/private/bikedreams.key" \
        -out "$CERTS_DIR/csr/bikedreams.csr" \
        -config "$CERTS_DIR/conf/openssl.cnf"
    
    # Generate self-signed certificate
    print_info "Generating self-signed certificate..."
    openssl x509 -req \
        -days 365 \
        -in "$CERTS_DIR/csr/bikedreams.csr" \
        -signkey "$CERTS_DIR/private/bikedreams.key" \
        -out "$CERTS_DIR/certs/bikedreams.crt" \
        -extensions v3_ext \
        -extfile "$CERTS_DIR/conf/openssl.cnf"
    
    # Create chain certificate (self-signed, so same as cert)
    cp "$CERTS_DIR/certs/bikedreams.crt" "$CERTS_DIR/certs/bikedreams-chain.crt"
    
    print_success "Generated development certificates"
    print_warning "These are SELF-SIGNED certificates for development only!"
}

verify_certificates() {
    print_section "Verifying Certificates"
    
    print_info "Certificate details:"
    openssl x509 -in "$CERTS_DIR/certs/bikedreams.crt" -text -noout | grep -A 1 "Subject:"
    openssl x509 -in "$CERTS_DIR/certs/bikedreams.crt" -text -noout | grep -A 3 "Subject Alternative Name:"
    
    print_info "Certificate validity:"
    openssl x509 -in "$CERTS_DIR/certs/bikedreams.crt" -noout -dates
    
    print_success "Certificate verification complete"
}

setup_docker_volumes() {
    print_section "Setting up Docker Volume Configuration"
    
    cat > "$PROJECT_ROOT/docker-compose.ssl.yml" << EOF
# SSL Certificate volumes for Docker Compose
# Add this to your main docker-compose.yml or use with:
# docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml up

version: '3.8'
services:
  nginx:
    volumes:
      - ./ssl/certs:/etc/ssl/certs:ro
      - ./ssl/private:/etc/ssl/private:ro
EOF
    
    print_success "Created Docker Compose SSL configuration"
}

show_dev_instructions() {
    print_section "Development Setup Instructions"
    
    echo -e "${GREEN}"
    echo "✓ Development SSL certificates have been generated successfully!"
    echo
    echo "Next steps:"
    echo "1. Update your docker-compose.prod.yml to include SSL volumes:"
    echo "   docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml up"
    echo
    echo "2. Trust the certificate in your browser/system:"
    echo "   - Certificate location: $CERTS_DIR/certs/bikedreams.crt"
    echo "   - Add to your browser's trusted certificates or system keychain"
    echo
    echo "3. Update your hosts file (optional):"
    echo "   echo '127.0.0.1 api.bikedreams.com' >> /etc/hosts"
    echo
    echo "4. Test the certificate:"
    echo "   curl -k https://localhost/"
    echo -e "${NC}"
}

show_production_info() {
    print_section "Production Certificate Setup Guide"
    
    echo -e "${YELLOW}"
    echo "🚨 IMPORTANT: For production, use certificates from a trusted CA!"
    echo
    echo "Recommended Certificate Authorities:"
    echo "• Let's Encrypt (free): https://letsencrypt.org/"
    echo "• Cloudflare SSL (free with Cloudflare)"
    echo "• DigiCert, GlobalSign, Sectigo (commercial)"
    echo
    echo "Let's Encrypt with Certbot:"
    echo "1. Install Certbot:"
    echo "   sudo apt-get install certbot python3-certbot-nginx"
    echo
    echo "2. Generate certificate:"
    echo "   sudo certbot --nginx -d $DOMAIN"
    echo
    echo "3. Auto-renewal setup:"
    echo "   sudo crontab -e"
    echo "   # Add: 0 12 * * * /usr/bin/certbot renew --quiet"
    echo
    echo "Cloudflare SSL (if using Cloudflare):"
    echo "1. Go to Cloudflare Dashboard > SSL/TLS"
    echo "2. Choose 'Full (strict)' encryption mode"
    echo "3. Generate Origin Certificate"
    echo "4. Download and place in ssl/ directory"
    echo
    echo "Manual Certificate Installation:"
    echo "1. Place certificate files in ssl/ directory:"
    echo "   ssl/certs/bikedreams.crt        (your certificate)"
    echo "   ssl/private/bikedreams.key      (private key)"
    echo "   ssl/certs/bikedreams-chain.crt  (full certificate chain)"
    echo "   ssl/certs/dhparam.pem           (DH parameters)"
    echo
    echo "2. Set proper permissions:"
    echo "   chmod 644 ssl/certs/*.crt ssl/certs/*.pem"
    echo "   chmod 600 ssl/private/*.key"
    echo
    echo "3. Test SSL configuration:"
    echo "   https://www.ssllabs.com/ssltest/"
    echo -e "${NC}"
    
    print_section "Security Checklist for Production"
    echo -e "${CYAN}"
    echo "□ Certificate from trusted CA installed"
    echo "□ Private key properly secured (600 permissions)"
    echo "□ HSTS header configured (max-age=63072000)"
    echo "□ OCSP stapling enabled"
    echo "□ Strong cipher suites configured"
    echo "□ TLS 1.2+ only (disable 1.0/1.1)"
    echo "□ Certificate auto-renewal configured"
    echo "□ Monitoring for certificate expiration"
    echo "□ Backup of private keys secured"
    echo -e "${NC}"
}

create_cert_monitoring_script() {
    print_section "Creating Certificate Monitoring Script"
    
    cat > "$PROJECT_ROOT/scripts/check-ssl-expiry.sh" << 'EOF'
#!/bin/bash
# SSL Certificate Expiry Checker
# Usage: ./check-ssl-expiry.sh [domain] [days_warning]

DOMAIN=${1:-api.bikedreams.com}
WARNING_DAYS=${2:-30}

check_certificate_expiry() {
    local domain=$1
    local warning_days=$2
    
    # Get certificate expiry date
    expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
    
    if [ -z "$expiry_date" ]; then
        echo "ERROR: Could not retrieve certificate for $domain"
        return 1
    fi
    
    # Convert to epoch time
    expiry_epoch=$(date -d "$expiry_date" +%s)
    current_epoch=$(date +%s)
    warning_epoch=$((current_epoch + (warning_days * 24 * 3600)))
    
    days_remaining=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    echo "Certificate for $domain:"
    echo "  Expires: $expiry_date"
    echo "  Days remaining: $days_remaining"
    
    if [ $expiry_epoch -lt $current_epoch ]; then
        echo "  Status: EXPIRED ❌"
        return 2
    elif [ $expiry_epoch -lt $warning_epoch ]; then
        echo "  Status: EXPIRES SOON ⚠️"
        return 3
    else
        echo "  Status: VALID ✅"
        return 0
    fi
}

check_certificate_expiry "$DOMAIN" "$WARNING_DAYS"
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/check-ssl-expiry.sh"
    print_success "Created SSL certificate monitoring script"
}

show_usage() {
    echo "Usage: $0 [dev|prod-info]"
    echo
    echo "Commands:"
    echo "  dev       - Generate self-signed certificates for development"
    echo "  prod-info - Show production certificate setup instructions"
    echo
    echo "Environment variables:"
    echo "  DOMAIN    - Domain name (default: api.bikedreams.com)"
    echo "  COUNTRY   - Country code (default: US)"
    echo "  STATE     - State/Province (default: California)"
    echo "  CITY      - City (default: San Francisco)"
    echo "  ORG       - Organization (default: BikeDreams)"
    echo "  ORG_UNIT  - Organizational Unit (default: IT Department)"
}

main() {
    print_banner
    
    case "${1:-dev}" in
        "dev")
            check_dependencies
            create_directories
            create_openssl_config
            generate_dhparam
            generate_dev_certificates
            verify_certificates
            setup_docker_volumes
            create_cert_monitoring_script
            show_dev_instructions
            ;;
        "prod-info")
            show_production_info
            create_cert_monitoring_script
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
