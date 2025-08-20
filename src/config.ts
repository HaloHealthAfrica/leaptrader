import { ConfigurationSettings, MLModelConfig } from './core/types';

/**
 * Central configuration management for the LeapTrader system
 * Environment-aware configuration with validation and type safety
 */

// Environment detection
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';
const IS_TEST = NODE_ENV === 'test';

// Core system configuration
export const CONFIG: SystemConfig = {
  env: NODE_ENV,
  isProduction: IS_PRODUCTION,
  isDevelopment: IS_DEVELOPMENT,
  isTest: IS_TEST,
  
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
      credentials: true
    }
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'sqlite:./leaptrader.db',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    ssl: process.env.DB_SSL === 'true'
  },

  // Trading configuration
  trading: {
    paperTrading: process.env.PAPER_TRADING !== 'false', // Default to paper trading
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '10000'),
    maxPortfolioRisk: parseFloat(process.env.MAX_PORTFOLIO_RISK || '0.05'), // 5%
    stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '0.10'), // 10%
    takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '0.25'), // 25%
    
    riskLimits: {
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '10000'),
      maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '0.20'), // 20%
      stopLoss: parseFloat(process.env.STOP_LOSS_PERCENT || '0.10')
    },
    
    tradingHours: {
      start: process.env.TRADING_START || '09:30',
      end: process.env.TRADING_END || '16:00',
      timezone: process.env.TRADING_TIMEZONE || 'America/New_York'
    },

    // Default screening criteria for LEAPS
    defaultScreening: {
      fundamental: {
        minMarketCap: 1000000000, // $1B minimum
        maxMarketCap: undefined,
        minPE: 5,
        maxPE: 50,
        sectors: ['Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical']
      },
      technical: {
        rsi: { min: 30, max: 70 },
        macd: 'bullish',
        trend: 'up'
      },
      options: {
        minIV: 0.15, // 15% minimum implied volatility
        maxIV: 0.60, // 60% maximum implied volatility
        minDelta: 0.30, // 30 delta minimum for LEAPS
        maxDelta: 0.80, // 80 delta maximum
        minDTE: 365, // LEAPS minimum 1 year
        maxDTE: 730 // LEAPS maximum 2 years
      }
    }
  },

  // Data provider configuration
  dataProviders: {
    primary: process.env.PRIMARY_DATA_PROVIDER || 'alpaca',
    fallback: process.env.FALLBACK_DATA_PROVIDER || 'tradier',
    
    alpaca: {
      apiKey: process.env.ALPACA_API_KEY || '',
      apiSecret: process.env.ALPACA_API_SECRET || '',
      baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
      enabled: process.env.ALPACA_ENABLED !== 'false'
    },
    
    tradier: {
      apiKey: process.env.TRADIER_API_KEY || '',
      baseUrl: process.env.TRADIER_BASE_URL || 'https://sandbox.tradier.com',
      enabled: process.env.TRADIER_ENABLED !== 'false'
    },
    
    twelveData: {
      apiKey: process.env.TWELVEDATA_API_KEY || '',
      baseUrl: process.env.TWELVEDATA_BASE_URL || 'https://api.twelvedata.com',
      enabled: process.env.TWELVEDATA_ENABLED !== 'false'
    },

    // Cache settings
    cache: {
      optionChainTtl: parseInt(process.env.OPTION_CHAIN_CACHE_TTL || '30000'), // 30 seconds
      quoteTtl: parseInt(process.env.QUOTE_CACHE_TTL || '5000'), // 5 seconds
      underlyingTtl: parseInt(process.env.UNDERLYING_CACHE_TTL || '10000') // 10 seconds
    }
  },

  // ML Model configuration
  ml: {
    enabled: process.env.ML_ENABLED !== 'false',
    serviceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
    
    models: {
      strikeSelection: {
        name: 'strike-selection',
        version: process.env.STRIKE_MODEL_VERSION || 'v1.0',
        enabled: process.env.STRIKE_MODEL_ENABLED !== 'false',
        endpoint: '/api/v1/score-strikes'
      },
      entryExit: {
        name: 'entry-exit',
        version: process.env.ENTRY_EXIT_MODEL_VERSION || 'v1.0',
        enabled: process.env.ENTRY_EXIT_MODEL_ENABLED !== 'false',
        endpoint: '/api/v1/score-entry-exit'
      },
      riskAssessment: {
        name: 'risk-assessment',
        version: process.env.RISK_MODEL_VERSION || 'v1.0',
        enabled: process.env.RISK_MODEL_ENABLED !== 'false',
        endpoint: '/api/v1/assess-risk'
      }
    },

    // Circuit breaker settings for ML service
    circuitBreaker: {
      failureThreshold: parseInt(process.env.ML_CIRCUIT_BREAKER_THRESHOLD || '5'),
      resetTimeoutMs: parseInt(process.env.ML_CIRCUIT_BREAKER_TIMEOUT || '60000'), // 1 minute
      requestTimeoutMs: parseInt(process.env.ML_REQUEST_TIMEOUT || '30000') // 30 seconds
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT || 'json',
    destination: process.env.LOG_DESTINATION || 'console',
    enableMetrics: process.env.ENABLE_METRICS !== 'false'
  },

  // Performance monitoring
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
    
    alerts: {
      errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '0.05'), // 5%
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME || '5000'), // 5 seconds
      cpuThreshold: parseFloat(process.env.ALERT_CPU_THRESHOLD || '0.80'), // 80%
      memoryThreshold: parseFloat(process.env.ALERT_MEMORY_THRESHOLD || '0.85') // 85%
    }
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    rateLimiting: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyLength: 32
    }
  },

  // Feature flags
  features: {
    enableBacktesting: process.env.ENABLE_BACKTESTING !== 'false',
    enablePaperTrading: process.env.ENABLE_PAPER_TRADING !== 'false',
    enableLiveTrading: process.env.ENABLE_LIVE_TRADING === 'true',
    enableMLPredictions: process.env.ENABLE_ML_PREDICTIONS !== 'false',
    enableRealTimeData: process.env.ENABLE_REAL_TIME_DATA !== 'false',
    enableAdvancedCharts: process.env.ENABLE_ADVANCED_CHARTS !== 'false'
  }
};

// Validation
export function validateConfig(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required environment variables in production
  if (IS_PRODUCTION) {
    const requiredVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'ALPACA_API_KEY',
      'ALPACA_API_SECRET'
    ];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }

    // Check if using default JWT secret in production
    if (CONFIG.security.jwtSecret === 'your-secret-key-change-in-production') {
      errors.push('Default JWT secret is being used in production');
    }
  }

  // Validate numeric ranges
  if (CONFIG.trading.maxPortfolioRisk <= 0 || CONFIG.trading.maxPortfolioRisk >= 1) {
    errors.push('maxPortfolioRisk must be between 0 and 1');
  }

  if (CONFIG.trading.stopLossPercent <= 0 || CONFIG.trading.stopLossPercent >= 1) {
    errors.push('stopLossPercent must be between 0 and 1');
  }

  // Check data provider configuration
  if (!CONFIG.dataProviders.alpaca.apiKey && !CONFIG.dataProviders.tradier.apiKey) {
    warnings.push('No data provider API keys configured - system will use mock data');
  }

  // Check ML configuration
  if (CONFIG.ml.enabled && !CONFIG.ml.serviceUrl) {
    warnings.push('ML enabled but no service URL configured');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Environment-specific configuration getters
export function getDataProviderConfig(provider: string): any {
  switch (provider.toLowerCase()) {
    case 'alpaca':
      return CONFIG.dataProviders.alpaca;
    case 'tradier':
      return CONFIG.dataProviders.tradier;
    case 'twelvedata':
      return CONFIG.dataProviders.twelveData;
    default:
      throw new Error(`Unknown data provider: ${provider}`);
  }
}

export function getMLModelConfig(modelName: string): MLModelConfig | null {
  const model = CONFIG.ml.models[modelName as keyof typeof CONFIG.ml.models];
  if (!model) return null;

  return {
    name: model.name,
    version: model.version,
    enabled: model.enabled,
    parameters: {},
    endpoints: {
      inference: `${CONFIG.ml.serviceUrl}${model.endpoint}`,
      health: `${CONFIG.ml.serviceUrl}/health`
    }
  };
}

// Configuration interfaces
export interface SystemConfig {
  env: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  server: ServerConfig;
  database: DatabaseConfig;
  trading: TradingConfig;
  dataProviders: DataProviderConfig;
  ml: MLConfig;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  features: FeatureFlags;
}

interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
}

interface DatabaseConfig {
  url: string;
  maxConnections: number;
  ssl: boolean;
}

interface TradingConfig {
  paperTrading: boolean;
  maxPositionSize: number;
  maxPortfolioRisk: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  riskLimits: ConfigurationSettings['riskLimits'];
  tradingHours: ConfigurationSettings['tradingHours'];
  defaultScreening: any;
}

interface DataProviderConfig {
  primary: string;
  fallback: string;
  alpaca: {
    apiKey: string;
    apiSecret: string;
    baseUrl: string;
    enabled: boolean;
  };
  tradier: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
  twelveData: {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
  };
  cache: {
    optionChainTtl: number;
    quoteTtl: number;
    underlyingTtl: number;
  };
}

interface MLConfig {
  enabled: boolean;
  serviceUrl: string;
  models: {
    [key: string]: {
      name: string;
      version: string;
      enabled: boolean;
      endpoint: string;
    };
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
    requestTimeoutMs: number;
  };
}

interface LoggingConfig {
  level: string;
  format: string;
  destination: string;
  enableMetrics: boolean;
}

interface MonitoringConfig {
  enabled: boolean;
  metricsPort: number;
  healthCheckInterval: number;
  alerts: {
    errorRate: number;
    responseTime: number;
    cpuThreshold: number;
    memoryThreshold: number;
  };
}

interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
  };
}

interface FeatureFlags {
  enableBacktesting: boolean;
  enablePaperTrading: boolean;
  enableLiveTrading: boolean;
  enableMLPredictions: boolean;
  enableRealTimeData: boolean;
  enableAdvancedCharts: boolean;
}

interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export default CONFIG;