#!/bin/bash

# LeapTrader VPS Setup Script for Hostinger
# This script sets up a production environment for the LEAPS trading system

set -e

echo "🚀 Setting up LeapTrader on Hostinger VPS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root for security reasons"
fi

# Update system
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
log "Installing essential packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    htop \
    ufw \
    fail2ban \
    nginx \
    certbot \
    python3-certbot-nginx \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install Node.js 18 LTS
log "Installing Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node_version=$(node --version)
npm_version=$(npm --version)
log "Node.js version: $node_version"
log "NPM version: $npm_version"

# Install PM2 globally
log "Installing PM2 process manager..."
sudo npm install -g pm2

# Install Docker
log "Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
log "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
log "Creating application directory..."
sudo mkdir -p /var/www/leaptrader
sudo chown $USER:$USER /var/www/leaptrader

# Set up firewall
log "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# Configure fail2ban
log "Configuring fail2ban..."
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create swap file if not exists (for VPS with limited RAM)
if [ ! -f /swapfile ]; then
    log "Creating swap file..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# Create systemd service for LeapTrader
log "Creating systemd service..."
sudo tee /etc/systemd/system/leaptrader.service > /dev/null <<EOF
[Unit]
Description=LeapTrader LEAPS Trading System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/var/www/leaptrader
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

# Logging
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=leaptrader

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
sudo systemctl daemon-reload
sudo systemctl enable leaptrader

# Create log directory
sudo mkdir -p /var/log/leaptrader
sudo chown $USER:$USER /var/log/leaptrader

# Configure logrotate
sudo tee /etc/logrotate.d/leaptrader > /dev/null <<EOF
/var/log/leaptrader/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        sudo systemctl reload leaptrader || true
    endscript
}
EOF

# Create nginx configuration
log "Creating nginx configuration..."
sudo tee /etc/nginx/sites-available/leaptrader > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/api/health;
    }
}
EOF

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/leaptrader /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# Create environment file template
log "Creating environment template..."
tee /var/www/leaptrader/.env.example > /dev/null <<EOF
# LeapTrader Production Environment Configuration

# Server Configuration
NODE_ENV=production
PORT=3000
DOMAIN=your-domain.com

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/leaptrader
POSTGRES_DB=leaptrader
POSTGRES_USER=leaptrader
POSTGRES_PASSWORD=your-secure-password

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# API Keys (replace with your actual keys)
TWELVEDATA_API_KEY=your-twelvedata-key
ALPACA_API_KEY=your-alpaca-key
ALPACA_SECRET_KEY=your-alpaca-secret
TRADIER_API_KEY=your-tradier-key

# Security
JWT_SECRET=your-jwt-secret-key-min-32-characters
CORS_ORIGIN=https://your-domain.com

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
EOF

# Create deployment script
log "Creating deployment script..."
tee /var/www/leaptrader/deploy.sh > /dev/null <<'EOF'
#!/bin/bash

# LeapTrader Deployment Script
set -e

echo "🚀 Deploying LeapTrader..."

# Pull latest code
git pull origin main

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Run database migrations if needed
# npm run migrate

# Restart application
sudo systemctl restart leaptrader

# Check status
sudo systemctl status leaptrader

echo "✅ Deployment complete!"
EOF

chmod +x /var/www/leaptrader/deploy.sh

# Create backup script
log "Creating backup script..."
tee /var/www/leaptrader/backup.sh > /dev/null <<'EOF'
#!/bin/bash

# LeapTrader Backup Script
BACKUP_DIR="/var/backups/leaptrader"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump leaptrader > $BACKUP_DIR/database_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/leaptrader

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /var/www/leaptrader/backup.sh

# Add backup to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/leaptrader/backup.sh") | crontab -

# Create monitoring script
log "Creating monitoring script..."
tee /var/www/leaptrader/monitor.sh > /dev/null <<'EOF'
#!/bin/bash

# LeapTrader Monitoring Script

# Check if service is running
if ! sudo systemctl is-active --quiet leaptrader; then
    echo "LeapTrader service is not running. Attempting to restart..."
    sudo systemctl restart leaptrader
    
    # Send alert (replace with your notification method)
    # curl -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
    #      -d chat_id=$TELEGRAM_CHAT_ID \
    #      -d text="⚠️ LeapTrader service was down and has been restarted"
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "WARNING: Disk usage is at ${DISK_USAGE}%"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ $MEMORY_USAGE -gt 80 ]; then
    echo "WARNING: Memory usage is at ${MEMORY_USAGE}%"
fi

# Check application health
if ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "WARNING: Application health check failed"
fi
EOF

chmod +x /var/www/leaptrader/monitor.sh

# Add monitoring to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/leaptrader/monitor.sh") | crontab -

# Final instructions
log "VPS setup completed successfully!"
echo
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Copy your application code to /var/www/leaptrader"
echo "2. Configure environment variables in /var/www/leaptrader/.env"
echo "3. Set up your domain DNS to point to this server"
echo "4. Run: sudo certbot --nginx -d your-domain.com"
echo "5. Start the application: sudo systemctl start leaptrader"
echo
echo -e "${BLUE}📁 Important Directories:${NC}"
echo "• Application: /var/www/leaptrader"
echo "• Logs: /var/log/leaptrader"
echo "• Backups: /var/backups/leaptrader"
echo "• Nginx config: /etc/nginx/sites-available/leaptrader"
echo
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "• Check app status: sudo systemctl status leaptrader"
echo "• View logs: sudo journalctl -u leaptrader -f"
echo "• Deploy updates: ./deploy.sh"
echo "• Monitor system: ./monitor.sh"
echo "• Create backup: ./backup.sh"
echo
echo -e "${GREEN}✅ Setup complete! Please reboot your VPS now.${NC}"