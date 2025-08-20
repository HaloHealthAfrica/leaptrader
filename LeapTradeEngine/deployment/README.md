# 🚀 LeapTrader Deployment Guide - Hostinger VPS

Complete deployment guide for deploying your LeapTrader LEAPS options trading system to a Hostinger VPS using Claude Code.

## 📋 Prerequisites

- Hostinger VPS (Ubuntu 20.04+ recommended)
- Domain name (optional but recommended)
- SSH access to your VPS
- Git repository for your code

## 🎯 Quick Start (Automated Deployment)

### Option 1: Git-Based Deployment (Recommended)

```bash
# Make deployment script executable
chmod +x deployment/scripts/git-deploy.sh

# Deploy from GitHub repository
./deployment/scripts/git-deploy.sh -h YOUR_VPS_IP -r https://github.com/HaloHealthAfrica/leaptrader.git
```

### Option 2: Zip-Based Deployment

```bash
# Create deployment package
chmod +x deployment/scripts/create-zip.sh
./deployment/scripts/create-zip.sh

# Deploy to VPS
chmod +x deployment/scripts/zip-deploy.sh
./deployment/scripts/zip-deploy.sh -h YOUR_VPS_IP -f leaptrader-deployment.zip
```

**Git-based deployment benefits:**
- Eliminates zip file uploads
- Version control integration  
- Easy updates with `git pull`
- Better change tracking

**Both scripts will:**
- Set up the VPS environment
- Install Claude Code for development
- Deploy and start your application
- Configure SSL (optional)

### Option 2: Manual Step-by-Step

## 📝 Step 1: Prepare Your VPS

### 1.1 Connect to your Hostinger VPS
```bash
ssh root@your-vps-ip
```

### 1.2 Create a non-root user
```bash
adduser leaptrader
usermod -aG sudo leaptrader
su - leaptrader
```

### 1.3 Set up SSH key authentication (recommended)
```bash
# On your local machine
ssh-copy-id leaptrader@your-vps-ip

# Test connection
ssh leaptrader@your-vps-ip
```

## 📝 Step 2: Run VPS Setup Script

### 2.1 Copy setup script to VPS
```bash
scp deployment/scripts/setup-vps.sh leaptrader@your-vps-ip:~/
```

### 2.2 Run setup script
```bash
ssh leaptrader@your-vps-ip
chmod +x setup-vps.sh
./setup-vps.sh
```

This will install:
- Node.js 18 LTS
- PM2 process manager
- Docker & Docker Compose
- Nginx web server
- PostgreSQL database
- Redis cache
- SSL certificates (Certbot)
- Firewall configuration
- Monitoring tools

### 2.3 Reboot VPS
```bash
sudo reboot
```

## 📝 Step 3: Configure Environment

### 3.1 Create environment file
```bash
cd /var/www/leaptrader
cp .env.example .env
nano .env
```

### 3.2 Configure your API keys and settings
```env
# Server Configuration
NODE_ENV=production
PORT=3000
DOMAIN=your-domain.com

# Database
DATABASE_URL=postgresql://leaptrader:your-password@localhost:5432/leaptrader

# Redis
REDIS_URL=redis://localhost:6379

# Trading API Keys
TWELVEDATA_API_KEY=your-twelvedata-key
ALPACA_API_KEY=your-alpaca-key
ALPACA_SECRET_KEY=your-alpaca-secret
TRADIER_API_KEY=your-tradier-key

# Security
JWT_SECRET=your-jwt-secret-32-chars-minimum
CORS_ORIGIN=https://your-domain.com
```

## 📝 Step 4: Deploy Your Application

### 4.1 Using Git (Recommended)
```bash
cd /var/www
git clone https://github.com/HaloHealthAfrica/leaptrader.git leaptrader
cd leaptrader/LeapTradeEngine
npm ci --only=production
npm run build
```

### 4.2 Using SCP (Alternative)
```bash
# From your local machine
scp -r dist/ leaptrader@your-vps-ip:/var/www/leaptrader/
scp -r client/dist/ leaptrader@your-vps-ip:/var/www/leaptrader/client/
scp package*.json leaptrader@your-vps-ip:/var/www/leaptrader/
```

## 📝 Step 5: Start Your Application

### 5.1 Using systemd (Simple)
```bash
sudo systemctl start leaptrader
sudo systemctl enable leaptrader
sudo systemctl status leaptrader
```

### 5.2 Using PM2 (Advanced)
```bash
pm2 start deployment/scripts/pm2.config.js
pm2 save
pm2 startup
```

## 📝 Step 6: Configure Your Domain

### 6.1 Point your domain to the VPS
In your domain registrar:
- Create A record: `@` → `your-vps-ip`
- Create A record: `www` → `your-vps-ip`

### 6.2 Set up SSL certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 📝 Step 7: Verify Deployment

### 7.1 Check application health
```bash
curl http://localhost:3000/api/health
curl https://your-domain.com/api/health
```

### 7.2 View logs
```bash
sudo journalctl -u leaptrader -f
```

### 7.3 Monitor system
```bash
./monitor.sh
```

## 🔧 Management Commands

### Application Management
```bash
# Start/Stop/Restart
sudo systemctl start leaptrader
sudo systemctl stop leaptrader
sudo systemctl restart leaptrader

# View status and logs
sudo systemctl status leaptrader
sudo journalctl -u leaptrader -f

# Using PM2
pm2 start leaptrader-api
pm2 stop leaptrader-api
pm2 restart leaptrader-api
pm2 logs leaptrader-api
```

### Database Management
```bash
# Connect to database
psql -U leaptrader -d leaptrader

# Backup database
pg_dump leaptrader > backup.sql

# Restore database
psql -U leaptrader -d leaptrader < backup.sql
```

### Nginx Management
```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔄 Updating Your Application

### Automated Update
```bash
./deploy.sh
```

### Manual Update
```bash
cd /var/www/leaptrader
git pull origin main
npm ci --only=production
npm run build
sudo systemctl restart leaptrader
```

## 📊 Monitoring & Maintenance

### System Monitoring
```bash
# Check system resources
htop
df -h
free -m

# Check application health
./monitor.sh

# Run comprehensive health check
node deployment/scripts/healthcheck.js --comprehensive
```

### Log Management
```bash
# View application logs
sudo journalctl -u leaptrader -f

# View nginx logs
sudo tail -f /var/log/nginx/access.log

# View system logs
sudo tail -f /var/log/syslog
```

### Backup Management
```bash
# Create backup
./backup.sh

# List backups
ls -la /var/backups/leaptrader/

# Restore from backup
sudo systemctl stop leaptrader
# Restore files and database
sudo systemctl start leaptrader
```

## 🔒 Security Best Practices

### Firewall Configuration
```bash
# Check firewall status
sudo ufw status

# Allow specific ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
```

### SSL/TLS Configuration
```bash
# Auto-renew SSL certificates
sudo systemctl enable certbot.timer

# Test SSL renewal
sudo certbot renew --dry-run
```

### Security Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js packages
npm audit fix
```

## 🚨 Troubleshooting

### Common Issues

#### Application won't start
```bash
# Check logs
sudo journalctl -u leaptrader -n 50

# Check environment variables
sudo systemctl show leaptrader --property Environment

# Test application manually
cd /var/www/leaptrader
NODE_ENV=production node dist/server/index.js
```

#### Database connection issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
psql -U leaptrader -d leaptrader -c "SELECT NOW();"
```

#### Nginx issues
```bash
# Test nginx configuration
sudo nginx -t

# Check nginx status
sudo systemctl status nginx

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

#### SSL certificate issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates
sudo certbot renew
```

### Performance Issues

#### High memory usage
```bash
# Check memory usage
free -m
ps aux --sort=-%mem | head

# Restart application
sudo systemctl restart leaptrader
```

#### High CPU usage
```bash
# Check CPU usage
top
htop

# Check PM2 processes
pm2 monit
```

#### Disk space issues
```bash
# Check disk usage
df -h

# Clean up logs
sudo journalctl --vacuum-time=7d

# Clean up old backups
find /var/backups/leaptrader -type f -mtime +30 -delete
```

## 📞 Support

### Log Files Locations
- Application logs: `/var/log/leaptrader/`
- System logs: `/var/log/syslog`
- Nginx logs: `/var/log/nginx/`
- Database logs: `/var/log/postgresql/`

### Useful Commands Reference
```bash
# System status
systemctl status leaptrader
systemctl status nginx
systemctl status postgresql
systemctl status redis

# Process monitoring
ps aux | grep node
netstat -tlnp | grep :3000

# File permissions
ls -la /var/www/leaptrader/
sudo chown -R leaptrader:leaptrader /var/www/leaptrader/

# Environment check
printenv | grep NODE
cat /var/www/leaptrader/.env
```

## 🎉 Congratulations!

Your LeapTrader LEAPS options trading system is now successfully deployed on your Hostinger VPS! 

**Your application is available at:**
- HTTP: `http://your-vps-ip:3000`
- HTTPS: `https://your-domain.com` (if configured)

**API Health Check:**
- `https://your-domain.com/api/health`

Remember to:
1. Configure your trading API keys
2. Set up monitoring alerts
3. Regularly backup your data
4. Keep your system updated
5. Monitor application performance

Happy trading! 📈