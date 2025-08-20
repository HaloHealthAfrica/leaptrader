#!/bin/bash

# LeapTrader Zip-Based Deployment Script for Hostinger VPS
# Deploy from a zipped application using Claude Code

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Configuration
VPS_USER="leaptrader"
VPS_HOST=""
APP_DIR="/var/www/leaptrader"
TEMP_DIR="/tmp/leaptrader-deploy"
ZIP_FILE=""

# Function to display usage
usage() {
    echo -e "${BLUE}LeapTrader Zip Deployment Script${NC}"
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --host VPS_IP          VPS IP address or hostname"
    echo "  -u, --user USERNAME        SSH username (default: leaptrader)"
    echo "  -f, --file ZIP_FILE        Path to zip file"
    echo "  --help                     Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 -h 192.168.1.100 -f leaptrader.zip"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            VPS_HOST="$2"
            shift 2
            ;;
        -u|--user)
            VPS_USER="$2"
            shift 2
            ;;
        -f|--file)
            ZIP_FILE="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Interactive mode if parameters not provided
if [ -z "$VPS_HOST" ]; then
    read -p "Enter VPS IP address: " VPS_HOST
fi

if [ -z "$ZIP_FILE" ]; then
    read -p "Enter path to zip file: " ZIP_FILE
fi

# Validate inputs
if [ -z "$VPS_HOST" ]; then
    error "VPS host is required"
fi

if [ -z "$ZIP_FILE" ]; then
    error "Zip file is required"
fi

if [ ! -f "$ZIP_FILE" ]; then
    error "Zip file not found: $ZIP_FILE"
fi

# Test VPS connection
test_connection() {
    log "Testing connection to $VPS_USER@$VPS_HOST..."
    
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_HOST" exit 2>/dev/null; then
        error "Cannot connect to VPS. Please ensure SSH access is configured."
    fi
    
    log "✅ Connection successful"
}

# Install Claude Code on VPS
install_claude_code() {
    log "Installing Claude Code on VPS..."
    
    ssh "$VPS_USER@$VPS_HOST" << 'EOF'
        # Check if Claude Code is already installed
        if command -v claude &> /dev/null; then
            echo "Claude Code is already installed"
            claude --version
        else
            echo "Installing Claude Code..."
            
            # Install Claude Code using the official installer
            curl -fsSL https://claude.ai/install.sh | bash
            
            # Add to PATH for current session
            export PATH="$HOME/.claude/bin:$PATH"
            
            # Add to shell profile
            echo 'export PATH="$HOME/.claude/bin:$PATH"' >> ~/.bashrc
            
            # Verify installation
            if command -v claude &> /dev/null; then
                echo "✅ Claude Code installed successfully"
                claude --version
            else
                echo "❌ Failed to install Claude Code"
                exit 1
            fi
        fi
EOF
    
    log "✅ Claude Code setup complete"
}

# Setup VPS environment
setup_vps() {
    log "Setting up VPS environment..."
    
    # Upload and run the VPS setup script
    scp deployment/scripts/setup-vps.sh "$VPS_USER@$VPS_HOST:~/"
    
    ssh "$VPS_USER@$VPS_HOST" << 'EOF'
        chmod +x setup-vps.sh
        ./setup-vps.sh
EOF
    
    log "✅ VPS environment setup complete"
}

# Upload and extract application
upload_application() {
    log "Uploading application zip file..."
    
    # Upload zip file
    scp "$ZIP_FILE" "$VPS_USER@$VPS_HOST:~/leaptrader.zip"
    
    # Extract and setup on VPS
    ssh "$VPS_USER@$VPS_HOST" << EOF
        # Create application directory
        sudo mkdir -p $APP_DIR
        sudo chown $VPS_USER:$VPS_USER $APP_DIR
        
        # Create temp directory
        mkdir -p $TEMP_DIR
        cd $TEMP_DIR
        
        # Extract zip file
        unzip -q ~/leaptrader.zip
        
        # Find the extracted directory (handle different zip structures)
        if [ -d "LeapTradeEngine" ]; then
            SOURCE_DIR="LeapTradeEngine"
        elif [ -d "leaptrader" ]; then
            SOURCE_DIR="leaptrader"
        else
            # If no specific directory, assume files are in root
            SOURCE_DIR="."
        fi
        
        # Copy files to application directory
        cp -r \$SOURCE_DIR/* $APP_DIR/
        
        # Cleanup
        rm -rf $TEMP_DIR
        rm ~/leaptrader.zip
        
        echo "✅ Application extracted successfully"
EOF
    
    log "✅ Application uploaded and extracted"
}

# Setup application with Claude Code
setup_application() {
    log "Setting up application with Claude Code..."
    
    ssh "$VPS_USER@$VPS_HOST" << EOF
        cd $APP_DIR
        
        # Initialize Claude Code in the directory
        claude init
        
        # Create environment file if it doesn't exist
        if [ ! -f .env ]; then
            cp .env.example .env 2>/dev/null || cat > .env << 'ENVEOF'
# LeapTrader Production Environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://leaptrader:secure_password@localhost:5432/leaptrader

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=\$(openssl rand -base64 32)

# API Keys (update these)
TWELVEDATA_API_KEY=your_key_here
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_secret_here
TRADIER_API_KEY=your_key_here
ENVEOF
        fi
        
        echo "✅ Application setup complete"
        echo "📝 Please update the API keys in .env file"
        echo "📍 Location: $APP_DIR/.env"
EOF
    
    log "✅ Application setup with Claude Code complete"
}

# Build and deploy application
build_and_deploy() {
    log "Building and deploying application..."
    
    ssh "$VPS_USER@$VPS_HOST" << EOF
        cd $APP_DIR
        
        # Install dependencies
        npm ci --only=production
        
        # Build application
        npm run build
        
        # Build client if it exists
        if [ -d "client" ]; then
            cd client
            npm ci --only=production
            npm run build
            cd ..
        fi
        
        # Set proper permissions
        sudo chown -R $VPS_USER:$VPS_USER $APP_DIR
        
        echo "✅ Application built successfully"
EOF
    
    log "✅ Build complete"
}

# Start application
start_application() {
    log "Starting application..."
    
    ssh "$VPS_USER@$VPS_HOST" << 'EOF'
        # Start the application service
        sudo systemctl daemon-reload
        sudo systemctl enable leaptrader
        sudo systemctl start leaptrader
        
        # Wait a moment for startup
        sleep 5
        
        # Check status
        if sudo systemctl is-active --quiet leaptrader; then
            echo "✅ Application started successfully"
            
            # Test health endpoint
            if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
                echo "✅ Health check passed"
            else
                echo "⚠️ Health check failed - application may still be starting"
            fi
        else
            echo "❌ Failed to start application"
            sudo systemctl status leaptrader
            exit 1
        fi
EOF
    
    log "✅ Application started"
}

# Configure domain and SSL
configure_domain() {
    read -p "Do you have a domain name to configure? (y/n): " HAS_DOMAIN
    
    if [ "$HAS_DOMAIN" = "y" ] || [ "$HAS_DOMAIN" = "Y" ]; then
        read -p "Enter your domain name: " DOMAIN
        
        if [ ! -z "$DOMAIN" ]; then
            log "Configuring domain: $DOMAIN"
            
            ssh "$VPS_USER@$VPS_HOST" << EOF
                # Update nginx configuration
                sudo sed -i 's/server_name _;/server_name $DOMAIN www.$DOMAIN;/' /etc/nginx/sites-available/leaptrader
                sudo nginx -t && sudo systemctl reload nginx
                
                # Get SSL certificate
                sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
                
                echo "✅ Domain configured: https://$DOMAIN"
EOF
            
            log "✅ Domain and SSL configured"
        fi
    fi
}

# Main deployment process
main() {
    echo -e "${BLUE}"
    echo "🚀 LeapTrader Zip-Based Deployment"
    echo "=================================="
    echo "VPS: $VPS_HOST"
    echo "User: $VPS_USER" 
    echo "Zip: $ZIP_FILE"
    echo -e "${NC}"
    
    # Check if this is first deployment
    read -p "Is this the first deployment to this VPS? (y/n): " FIRST_DEPLOY
    
    if [ "$FIRST_DEPLOY" = "y" ] || [ "$FIRST_DEPLOY" = "Y" ]; then
        test_connection
        install_claude_code
        setup_vps
        
        warn "VPS setup complete. Please reboot the VPS now and run this script again."
        echo "Command: sudo reboot"
        exit 0
    fi
    
    # Regular deployment
    test_connection
    upload_application
    setup_application
    
    log "Application uploaded. You can now use Claude Code on the VPS to continue setup."
    
    read -p "Continue with automated build and deployment? (y/n): " AUTO_DEPLOY
    
    if [ "$AUTO_DEPLOY" = "y" ] || [ "$AUTO_DEPLOY" = "Y" ]; then
        build_and_deploy
        start_application
        configure_domain
        
        echo -e "${GREEN}"
        echo "🎉 Deployment Complete!"
        echo "======================="
        echo "Your LeapTrader application is now running!"
        echo ""
        echo "Access your application:"
        echo "• Local: http://$VPS_HOST:3000"
        echo "• Health: http://$VPS_HOST:3000/api/health"
        echo ""
        echo "SSH to VPS for Claude Code development:"
        echo "ssh $VPS_USER@$VPS_HOST"
        echo "cd $APP_DIR"
        echo "claude"
        echo -e "${NC}"
    else
        echo -e "${BLUE}"
        echo "📝 Manual Setup Instructions:"
        echo "=============================="
        echo "1. SSH to your VPS: ssh $VPS_USER@$VPS_HOST"
        echo "2. Navigate to app: cd $APP_DIR"
        echo "3. Start Claude Code: claude"
        echo "4. Update .env with your API keys"
        echo "5. Build and start the application"
        echo -e "${NC}"
    fi
}

# Run main function
main "$@"