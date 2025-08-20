/**
 * PM2 Configuration for LeapTrader Production
 * Alternative to systemd for process management
 */

module.exports = {
  apps: [
    {
      name: 'leaptrader-api',
      script: 'dist/server/index.js',
      cwd: '/var/www/leaptrader',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Logging
      log_file: '/var/log/leaptrader/combined.log',
      out_file: '/var/log/leaptrader/out.log',
      error_file: '/var/log/leaptrader/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Memory management
      max_memory_restart: '512M',
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_interval: 30000,
      
      // Auto restart on file changes (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'dist'],
      
      // Source map support
      source_map_support: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      
      // Custom configuration
      node_args: ['--max-old-space-size=512'],
      
      // Monitoring
      pmx: true,
      
      // Auto restart conditions
      autorestart: true,
      
      // Cron restart (daily at 3 AM)
      cron_restart: '0 3 * * *',
      
      // Merge logs
      merge_logs: true,
      
      // Time format
      time: true
    },
    
    // Background jobs process
    {
      name: 'leaptrader-jobs',
      script: 'dist/jobs/index.js',
      cwd: '/var/www/leaptrader',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production',
        JOB_WORKER: 'true'
      },
      
      log_file: '/var/log/leaptrader/jobs.log',
      
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 10000,
      
      max_memory_restart: '256M',
      
      autorestart: true,
      watch: false,
      
      cron_restart: '0 4 * * *'
    }
  ],
  
  // Deploy configuration
  deploy: {
    production: {
      user: 'leaptrader',
      host: 'your-vps-ip',
      ref: 'origin/main',
      repo: 'https://github.com/HaloHealthAfrica/leaptrader.git',
      path: '/var/www/leaptrader',
      
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    }
  }
};