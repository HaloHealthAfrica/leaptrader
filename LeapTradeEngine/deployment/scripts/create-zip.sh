#!/bin/bash

# Create deployment-ready zip file for LeapTrader
# This script packages your application for upload to Hostinger VPS

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Configuration
PROJECT_NAME="LeapTrader"
OUTPUT_DIR="./dist-deploy"
ZIP_NAME="leaptrader-deployment.zip"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create output directory
log "Creating deployment package..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Copy essential files and directories
log "Copying project files..."

# Core application files
cp -r client "$OUTPUT_DIR/" 2>/dev/null || true
cp -r server "$OUTPUT_DIR/" 2>/dev/null || true
cp -r src "$OUTPUT_DIR/" 2>/dev/null || true
cp -r shared "$OUTPUT_DIR/" 2>/dev/null || true
cp -r config "$OUTPUT_DIR/" 2>/dev/null || true

# Package files
cp package*.json "$OUTPUT_DIR/"

# Configuration files
cp tsconfig.json "$OUTPUT_DIR/" 2>/dev/null || true
cp tailwind.config.ts "$OUTPUT_DIR/" 2>/dev/null || true
cp vite.config.ts "$OUTPUT_DIR/" 2>/dev/null || true
cp postcss.config.js "$OUTPUT_DIR/" 2>/dev/null || true
cp drizzle.config.ts "$OUTPUT_DIR/" 2>/dev/null || true
cp components.json "$OUTPUT_DIR/" 2>/dev/null || true

# Deployment scripts
cp -r deployment "$OUTPUT_DIR/"

# Environment template
if [ -f ".env.example" ]; then
    cp .env.example "$OUTPUT_DIR/"
else
    log "Creating .env.example template..."
    cat > "$OUTPUT_DIR/.env.example" << 'EOF'
# LeapTrader Production Environment Configuration

# Server Configuration
NODE_ENV=production
PORT=3000
DOMAIN=your-domain.com

# Database Configuration
DATABASE_URL=postgresql://leaptrader:secure_password@localhost:5432/leaptrader
POSTGRES_DB=leaptrader
POSTGRES_USER=leaptrader
POSTGRES_PASSWORD=secure_password

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=redis_password

# API Keys (replace with your actual keys)
TWELVEDATA_API_KEY=your_twelvedata_api_key
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
TRADIER_API_KEY=your_tradier_api_key

# Security
JWT_SECRET=your-random-32-character-secret-key
CORS_ORIGIN=https://your-domain.com

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
EOF
fi

# Create README for deployment
log "Creating deployment README..."
cat > "$OUTPUT_DIR/DEPLOYMENT.md" << 'EOF'
# LeapTrader Deployment Package

This package contains your LeapTrader LEAPS options trading system ready for deployment.

## Quick Deployment to Hostinger VPS

### Prerequisites
- Hostinger VPS with Ubuntu 20.04+
- SSH access to your VPS
- Domain name (optional)

### Deployment Steps

1. **Upload this zip file to your VPS using the zip-deploy script:**
   ```bash
   chmod +x deployment/scripts/zip-deploy.sh
   ./deployment/scripts/zip-deploy.sh -h YOUR_VPS_IP -f leaptrader-deployment.zip
   ```

2. **Or manually upload and extract:**
   ```bash
   scp leaptrader-deployment.zip user@vps-ip:~/
   ssh user@vps-ip
   unzip leaptrader-deployment.zip
   cd LeapTradeEngine
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   nano .env
   # Add your API keys and configuration
   ```

4. **Install dependencies and build:**
   ```bash
   npm ci --only=production
   npm run build
   cd client && npm ci && npm run build && cd ..
   ```

5. **Start the application:**
   ```bash
   npm start
   ```

## Configuration Required

Update the following in your `.env` file:

- `TWELVEDATA_API_KEY` - Your TwelveData API key
- `ALPACA_API_KEY` - Your Alpaca API key  
- `ALPACA_SECRET_KEY` - Your Alpaca secret key
- `TRADIER_API_KEY` - Your Tradier API key
- `JWT_SECRET` - Random 32+ character string
- `DOMAIN` - Your domain name (if applicable)

## Features Included

- ✅ Simplified LEAPS strategies (Long Calls & Protective Puts)
- ✅ Real-time market data integration
- ✅ Advanced options screening
- ✅ Risk management system
- ✅ Web-based dashboard
- ✅ Production deployment scripts

## Support

For deployment issues, check the logs:
```bash
sudo journalctl -u leaptrader -f
```

Happy trading! 📈
EOF

# Create deployment manifest
log "Creating deployment manifest..."
cat > "$OUTPUT_DIR/deployment-manifest.json" << EOF
{
  "package": "$PROJECT_NAME",
  "version": "1.0.0",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "timestamp": "$TIMESTAMP",
  "type": "production-deployment",
  "strategies": ["long_call_leaps", "protective_put"],
  "requirements": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0",
    "os": "linux",
    "memory": "2GB",
    "storage": "10GB"
  },
  "services": {
    "database": "postgresql",
    "cache": "redis", 
    "webserver": "nginx",
    "process_manager": "systemd"
  },
  "ports": {
    "application": 3000,
    "database": 5432,
    "redis": 6379
  }
}
EOF

# Clean up development files
log "Cleaning up development files..."
find "$OUTPUT_DIR" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find "$OUTPUT_DIR" -name ".git*" -delete 2>/dev/null || true
find "$OUTPUT_DIR" -name "*.log" -delete 2>/dev/null || true
find "$OUTPUT_DIR" -name ".DS_Store" -delete 2>/dev/null || true
find "$OUTPUT_DIR" -name "Thumbs.db" -delete 2>/dev/null || true

# Create the zip file
log "Creating zip file..."
cd "$OUTPUT_DIR"
zip -r "../$ZIP_NAME" . -q
cd ..

# Cleanup temp directory
rm -rf "$OUTPUT_DIR"

# Get file size
FILE_SIZE=$(du -h "$ZIP_NAME" | cut -f1)

log "✅ Deployment package created successfully!"
echo ""
echo -e "${BLUE}📦 Package Details:${NC}"
echo "   File: $ZIP_NAME"
echo "   Size: $FILE_SIZE"
echo "   Location: $(pwd)/$ZIP_NAME"
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "1. Upload to your VPS using the zip-deploy script:"
echo "   chmod +x deployment/scripts/zip-deploy.sh"
echo "   ./deployment/scripts/zip-deploy.sh -h YOUR_VPS_IP -f $ZIP_NAME"
echo ""
echo "2. Or manually upload and follow the DEPLOYMENT.md instructions"
echo ""
echo -e "${BLUE}📋 What's included:${NC}"
echo "   ✅ Complete LeapTrader application"
echo "   ✅ Deployment automation scripts"
echo "   ✅ Environment configuration templates"
echo "   ✅ Production build configurations"
echo "   ✅ Monitoring and health check tools"
echo ""