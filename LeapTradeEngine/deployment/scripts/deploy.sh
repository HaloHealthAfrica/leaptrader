#!/bin/bash

# LeapTrader Automated Deployment Script
# This script automates the entire deployment process to Hostinger VPS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/yourusername/leaptrader.git"  # Update this
VPS_USER="your-vps-user"  # Update this
VPS_HOST="your-vps-ip"    # Update this
VPS_APP_DIR="/var/www/leaptrader"
LOCAL_BUILD_DIR="./dist"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command_exists "node"; then
        error "Node.js is not installed"
    fi
    
    if ! command_exists "npm"; then
        error "npm is not installed"
    fi
    
    if ! command_exists "git"; then
        error "git is not installed"
    fi
    
    if ! command_exists "ssh"; then
        error "ssh is not installed"
    fi
    
    if ! command_exists "rsync"; then
        error "rsync is not installed"
    fi
    
    log "✅ Prerequisites check passed"
}

# Build application locally
build_application() {
    log "Building application locally..."
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci
    
    # Build server
    log "Building server..."
    npm run build
    
    # Build client
    log "Building client..."
    cd client
    npm ci
    npm run build
    cd ..
    
    log "✅ Application built successfully"
}

# Test VPS connection
test_vps_connection() {
    log "Testing VPS connection..."
    
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_HOST" exit 2>/dev/null; then
        error "Cannot connect to VPS. Please check your SSH configuration."
    fi
    
    log "✅ VPS connection successful"
}

# Create deployment package
create_deployment_package() {
    log "Creating deployment package..."
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    PACKAGE_DIR="$TEMP_DIR/leaptrader"
    
    mkdir -p "$PACKAGE_DIR"
    
    # Copy built files
    cp -r dist "$PACKAGE_DIR/"
    cp -r client/dist "$PACKAGE_DIR/client/"
    cp package.json "$PACKAGE_DIR/"
    cp package-lock.json "$PACKAGE_DIR/"
    
    # Copy configuration files
    cp -r config "$PACKAGE_DIR/" 2>/dev/null || true
    cp -r deployment "$PACKAGE_DIR/"
    
    # Create production package.json
    cat > "$PACKAGE_DIR/package.prod.json" <<EOF
{
  "name": "leaptrader-production",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/server/index.js",
    "health": "node deployment/scripts/healthcheck.js"
  },
  "dependencies": {
$(cat package.json | jq -r '.dependencies | to_entries[] | "    \"" + .key + "\": \"" + .value + "\","' | sed '$s/,$//')
  }
}
EOF
    
    echo "$PACKAGE_DIR"
}

# Deploy to VPS
deploy_to_vps() {
    local package_dir=$1
    
    log "Deploying to VPS..."
    
    # Create backup on VPS
    log "Creating backup on VPS..."
    ssh "$VPS_USER@$VPS_HOST" "
        if [ -d $VPS_APP_DIR ]; then
            sudo cp -r $VPS_APP_DIR $VPS_APP_DIR.backup.\$(date +%Y%m%d_%H%M%S)
        fi
    "
    
    # Stop application
    log "Stopping application..."
    ssh "$VPS_USER@$VPS_HOST" "sudo systemctl stop leaptrader || true"
    
    # Sync files
    log "Syncing files..."
    rsync -avz --delete "$package_dir/" "$VPS_USER@$VPS_HOST:$VPS_APP_DIR/"
    
    # Install production dependencies
    log "Installing production dependencies..."
    ssh "$VPS_USER@$VPS_HOST" "
        cd $VPS_APP_DIR
        cp package.prod.json package.json
        npm ci --only=production
    "
    
    # Set permissions
    ssh "$VPS_USER@$VPS_HOST" "
        sudo chown -R $VPS_USER:$VPS_USER $VPS_APP_DIR
        chmod +x $VPS_APP_DIR/deployment/scripts/*.sh
    "
    
    # Start application
    log "Starting application..."
    ssh "$VPS_USER@$VPS_HOST" "sudo systemctl start leaptrader"
    
    # Wait for startup
    sleep 10
    
    # Check health
    log "Checking application health..."
    if ssh "$VPS_USER@$VPS_HOST" "curl -f http://localhost:3000/api/health"; then
        log "✅ Application deployed and running successfully"
    else
        error "❌ Application health check failed"
    fi
}

# Setup SSL certificate
setup_ssl() {
    log "Setting up SSL certificate..."
    
    read -p "Enter your domain name: " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        warn "No domain provided, skipping SSL setup"
        return
    fi
    
    ssh "$VPS_USER@$VPS_HOST" "
        # Update nginx configuration with domain
        sudo sed -i 's/server_name _;/server_name $DOMAIN;/' /etc/nginx/sites-available/leaptrader
        sudo nginx -t && sudo systemctl reload nginx
        
        # Get SSL certificate
        sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    "
    
    log "✅ SSL certificate configured for $DOMAIN"
}

# Main deployment flow
main() {
    echo -e "${BLUE}"
    echo "🚀 LeapTrader Deployment Script"
    echo "================================="
    echo -e "${NC}"
    
    # Check if this is first deployment
    read -p "Is this the first deployment? (y/n): " FIRST_DEPLOY
    
    if [ "$FIRST_DEPLOY" = "y" ] || [ "$FIRST_DEPLOY" = "Y" ]; then
        log "Starting first-time deployment..."
        
        # Get VPS details
        read -p "Enter VPS IP address: " VPS_HOST
        read -p "Enter VPS username: " VPS_USER
        
        # Test connection
        test_vps_connection
        
        # Run VPS setup
        log "Running VPS setup script..."
        scp deployment/scripts/setup-vps.sh "$VPS_USER@$VPS_HOST:~/"
        ssh "$VPS_USER@$VPS_HOST" "chmod +x setup-vps.sh && ./setup-vps.sh"
        
        log "VPS setup completed. Please configure your .env file on the VPS."
        read -p "Press enter when you've configured the .env file..."
    fi
    
    # Regular deployment
    check_prerequisites
    build_application
    
    PACKAGE_DIR=$(create_deployment_package)
    deploy_to_vps "$PACKAGE_DIR"
    
    # Cleanup
    rm -rf "$PACKAGE_DIR"
    
    # Optional SSL setup
    read -p "Do you want to set up SSL? (y/n): " SETUP_SSL
    if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
        setup_ssl
    fi
    
    echo -e "${GREEN}"
    echo "🎉 Deployment completed successfully!"
    echo "======================================"
    echo -e "${NC}"
    echo "Your LeapTrader application is now running on your Hostinger VPS"
    echo
    echo "Next steps:"
    echo "1. Configure your API keys in the VPS .env file"
    echo "2. Set up your domain DNS if you haven't already"
    echo "3. Monitor the application logs: ssh $VPS_USER@$VPS_HOST 'sudo journalctl -u leaptrader -f'"
    echo
    echo "Application URL: http://$VPS_HOST:3000"
    echo "Health check: http://$VPS_HOST:3000/api/health"
}

# Run main function
main "$@"