# 📦 LeapTrader Zip Deployment Guide - Hostinger VPS with Claude Code

Complete guide for deploying your LeapTrader application to Hostinger VPS using a zip file and Claude Code for development.

## 🎯 Overview

This method allows you to:
1. **Package** your entire application into a zip file
2. **Upload** it to your Hostinger VPS
3. **Deploy** automatically with Claude Code installed
4. **Develop** directly on the VPS using Claude Code

Perfect for when you want to work on the VPS directly or don't want to set up Git initially.

## 📋 What You Need

### **Local Machine:**
- Your LeapTrader project
- Bash shell (Git Bash on Windows, Terminal on Mac/Linux)
- SSH client

### **Hostinger VPS:**
- Ubuntu 20.04+ VPS
- Root or sudo access
- At least 2GB RAM

### **API Keys:**
- TwelveData API key
- Alpaca API key & secret  
- Tradier API key

## 🚀 Step 1: Create Deployment Package

Run this command in your LeapTrader project directory:

```bash
# Make the script executable
chmod +x deployment/scripts/create-zip.sh

# Create deployment package
./deployment/scripts/create-zip.sh
```

This creates: `leaptrader-deployment.zip` (ready to upload)

## 🚀 Step 2: Deploy to Hostinger VPS

### **Option A: Automated Deployment (Recommended)**

```bash
# Make deployment script executable
chmod +x deployment/scripts/zip-deploy.sh

# Deploy to VPS (replace with your VPS IP)
./deployment/scripts/zip-deploy.sh -h YOUR_VPS_IP -f leaptrader-deployment.zip
```

### **Option B: Manual Upload**

```bash
# Upload zip file
scp leaptrader-deployment.zip root@YOUR_VPS_IP:~/

# SSH to VPS
ssh root@YOUR_VPS_IP
```

## 🛠️ Step 3: VPS Setup Process

The script will ask you:

### **First Deployment:**
1. **"Is this the first deployment? (y/n)"** → Type `y`
2. Script will install:
   - Claude Code
   - Node.js 18
   - PostgreSQL 
   - Redis
   - Nginx
   - SSL certificates
   - Security setup

3. **Reboot required** → The script will tell you to reboot
   ```bash
   sudo reboot
   ```

### **Second Run (After Reboot):**
```bash
./deployment/scripts/zip-deploy.sh -h YOUR_VPS_IP -f leaptrader-deployment.zip
```

1. **"Is this the first deployment? (y/n)"** → Type `n`
2. Application will be uploaded and extracted
3. **"Continue with automated build? (y/n)"** → Type `y` for full automation

## 🔧 Step 4: Configure Your Application

### **Update Environment Variables:**

The script creates `.env` file. SSH to your VPS to update it:

```bash
ssh leaptrader@YOUR_VPS_IP
cd /var/www/leaptrader
nano .env
```

**Required configuration:**
```env
# Trading API Keys (REQUIRED)
TWELVEDATA_API_KEY=your_actual_key_here
ALPACA_API_KEY=your_actual_key_here  
ALPACA_SECRET_KEY=your_actual_secret_here
TRADIER_API_KEY=your_actual_key_here

# Security (REQUIRED)
JWT_SECRET=your-random-32-character-secret-key

# Domain (if you have one)
DOMAIN=your-domain.com
CORS_ORIGIN=https://your-domain.com
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

## 🌐 Step 5: Access Your Application

### **Without Domain:**
- Application: `http://YOUR_VPS_IP:3000`
- Health Check: `http://YOUR_VPS_IP:3000/api/health`

### **With Domain (Optional):**
1. **Point DNS to VPS:**
   - A Record: `@` → `YOUR_VPS_IP`
   - A Record: `www` → `YOUR_VPS_IP`

2. **The script will automatically configure SSL**

3. **Access at:** `https://your-domain.com`

## 💻 Step 6: Development with Claude Code

After deployment, you can develop directly on the VPS:

```bash
# SSH to VPS
ssh leaptrader@YOUR_VPS_IP

# Navigate to application
cd /var/www/leaptrader

# Start Claude Code
claude
```

### **What you can do with Claude Code on VPS:**
- ✅ Edit code directly on the server
- ✅ Install new packages
- ✅ Run builds and tests  
- ✅ Debug issues
- ✅ Update configurations
- ✅ Monitor logs and performance

## 🔍 Verification & Management

### **Check Application Status:**
```bash
# Application status
sudo systemctl status leaptrader

# View logs
sudo journalctl -u leaptrader -f

# Health check
curl http://localhost:3000/api/health
```

### **Restart Application:**
```bash
# After making changes
sudo systemctl restart leaptrader
```

### **Monitor Resources:**
```bash
# System monitoring
htop

# Disk space
df -h

# Memory usage  
free -m
```

## 🔄 Updating Your Application

### **For Code Changes:**
1. **Edit directly with Claude Code** on VPS, or
2. **Create new zip** and re-run deployment script

### **For Package Updates:**
```bash
cd /var/www/leaptrader
npm update
npm run build
sudo systemctl restart leaptrader
```

## 📊 Available Management Scripts

On your VPS (`/var/www/leaptrader/`):

```bash
# Monitor application health
./monitor.sh

# Create backup
./backup.sh

# View comprehensive health check
node deployment/scripts/healthcheck.js --comprehensive

# Update deployment
./deploy.sh
```

## 🚨 Troubleshooting

### **Application Won't Start:**
```bash
# Check logs
sudo journalctl -u leaptrader -n 50

# Check environment
cat .env

# Test manually
NODE_ENV=production node dist/server/index.js
```

### **Database Issues:**
```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Connect to database
psql -U leaptrader -d leaptrader
```

### **Port Issues:**
```bash
# Check what's using port 3000
sudo netstat -tlnp | grep :3000

# Check firewall
sudo ufw status
```

### **SSL Issues:**
```bash
# Check certificates
sudo certbot certificates

# Renew if needed
sudo certbot renew
```

## 📞 Support Commands

### **System Information:**
```bash
# System status
systemctl status leaptrader nginx postgresql redis

# Process information
ps aux | grep node

# Network connections
sudo netstat -tlnp
```

### **Log Locations:**
- Application: `/var/log/leaptrader/`
- Nginx: `/var/log/nginx/`
- System: `/var/log/syslog`

## 🎉 Success!

Your LeapTrader application is now running on Hostinger with Claude Code available for development!

**Key Benefits of This Setup:**
- ✅ **Full development environment** on VPS
- ✅ **Claude Code integration** for easy editing
- ✅ **Production-ready deployment** with monitoring
- ✅ **Automated SSL and security** setup
- ✅ **Easy updates and maintenance**

**Access Points:**
- **Application:** `https://your-domain.com` or `http://VPS_IP:3000`
- **Development:** `ssh leaptrader@VPS_IP` then `claude`
- **Monitoring:** Built-in health checks and monitoring

Happy trading and development! 📈💻