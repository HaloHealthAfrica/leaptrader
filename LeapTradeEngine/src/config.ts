import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '8000', 10),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'memory',
  },

  // Data provider API keys
  dataProviders: {
    twelvedata: {
      apiKey: process.env.TWELVEDATA_API_KEY || 'demo',
      baseUrl: 'https://api.twelvedata.com',
      rateLimitPerMinute: 55, // Free tier limit
    },
    alpaca: {
      apiKey: process.env.ALPACA_API_KEY || 'demo',
      apiSecret: process.env.ALPACA_API_SECRET || 'demo',
      baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
      dataUrl: 'https://data.alpaca.markets',
    },
    tradier: {
      accessToken: process.env.TRADIER_ACCESS_TOKEN || 'demo',
      baseUrl: 'https://sandbox.tradier.com',
      accountId: process.env.TRADIER_ACCOUNT_ID || 'demo',
    },
  },

  // Trading configuration
  trading: {
    maxPositionsPerStrategy: 20,
    maxPortfolioRisk: 0.05, // 5% max portfolio risk
    defaultPositionSize: 0.02, // 2% per position
    minDaysToExpiration: 30,
    maxDaysToExpiration: 1095, // 3 years for LEAPS
    requiredDelta: {
      min: 0.5,
      max: 0.8,
    },
    riskFreeRate: 0.05, // 5% annual risk-free rate
  },

  // Strategy configuration
  strategies: {
    stockReplacement: {
      enabled: true,
      minDelta: 0.6,
      maxDelta: 0.8,
      targetDte: 365,
    },
    coveredCall: {
      enabled: true,
      maxDelta: 0.3,
      targetDte: 30,
    },
    protectivePut: {
      enabled: true,
      maxDelta: 0.3,
      targetDte: 90,
    },
    ironCondor: {
      enabled: true,
      wingWidth: 10,
      targetDte: 45,
    },
  },

  // Screening configuration
  screening: {
    fundamental: {
      minMarketCap: 1000000000, // $1B
      maxPeRatio: 30,
      minVolume: 1000000,
    },
    technical: {
      rsiOverbought: 70,
      rsiOversold: 30,
      bollinger: {
        period: 20,
        stdDev: 2,
      },
      macd: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      },
    },
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/trading.log',
    maxSize: '100MB',
    maxFiles: 5,
  },

  // Cache configuration
  cache: {
    ttl: 300, // 5 minutes default TTL
    marketDataTtl: 60, // 1 minute for market data
    fundamentalTtl: 3600, // 1 hour for fundamental data
  },

  // Job scheduling
  jobs: {
    marketData: {
      enabled: true,
      schedule: '*/1 * * * *', // Every minute during market hours
    },
    screening: {
      enabled: true,
      schedule: '0 9 * * 1-5', // 9 AM weekdays
    },
    monitoring: {
      enabled: true,
      schedule: '*/5 * * * *', // Every 5 minutes
    },
    riskAssessment: {
      enabled: true,
      schedule: '0 */4 * * *', // Every 4 hours
    },
  },
};

export type Config = typeof config;
