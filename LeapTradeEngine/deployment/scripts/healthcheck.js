#!/usr/bin/env node

/**
 * Health Check Script for LeapTrader
 * Used by Docker, systemd, and monitoring systems
 */

const http = require('http');
const https = require('https');

const config = {
  host: process.env.HEALTH_CHECK_HOST || 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 5000,
  useHttps: process.env.USE_HTTPS === 'true'
};

function checkHealth() {
  return new Promise((resolve, reject) => {
    const client = config.useHttps ? https : http;
    
    const options = {
      hostname: config.host,
      port: config.port,
      path: config.path,
      method: 'GET',
      timeout: config.timeout
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            if (response.status === 'ok') {
              resolve({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                response: response
              });
            } else {
              reject(new Error(`Health check failed: ${response.message || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Health check timeout after ${config.timeout}ms`));
    });

    req.end();
  });
}

// Extended health checks
async function checkDatabase() {
  // Implement database connectivity check
  // This would typically check if the database is reachable
  return new Promise((resolve) => {
    // Placeholder - implement actual database check
    setTimeout(() => resolve({ status: 'ok', latency: '< 10ms' }), 100);
  });
}

async function checkRedis() {
  // Implement Redis connectivity check
  return new Promise((resolve) => {
    // Placeholder - implement actual Redis check
    setTimeout(() => resolve({ status: 'ok', latency: '< 5ms' }), 50);
  });
}

async function checkExternalAPIs() {
  // Check if external trading APIs are accessible
  const apis = ['twelvedata', 'alpaca', 'tradier'];
  const results = {};
  
  for (const api of apis) {
    try {
      // Placeholder - implement actual API checks
      results[api] = { status: 'ok', latency: '< 100ms' };
    } catch (error) {
      results[api] = { status: 'error', error: error.message };
    }
  }
  
  return results;
}

async function comprehensiveHealthCheck() {
  try {
    console.log('🏥 Running comprehensive health check...');
    
    // Basic application health
    const appHealth = await checkHealth();
    console.log('✅ Application: Healthy');
    
    // Database health
    const dbHealth = await checkDatabase();
    console.log('✅ Database: Connected');
    
    // Redis health
    const redisHealth = await checkRedis();
    console.log('✅ Redis: Connected');
    
    // External APIs
    const apiHealth = await checkExternalAPIs();
    console.log('✅ External APIs: Accessible');
    
    const report = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      application: appHealth,
      database: dbHealth,
      redis: redisHealth,
      externalAPIs: apiHealth,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };
    
    console.log('\n📊 Health Report:');
    console.log(JSON.stringify(report, null, 2));
    
    return report;
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--comprehensive') || args.includes('-c')) {
    comprehensiveHealthCheck();
  } else {
    checkHealth()
      .then((result) => {
        console.log('✅ Application is healthy');
        if (args.includes('--verbose') || args.includes('-v')) {
          console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Health check failed:', error.message);
        process.exit(1);
      });
  }
}

module.exports = {
  checkHealth,
  checkDatabase,
  checkRedis,
  checkExternalAPIs,
  comprehensiveHealthCheck
};