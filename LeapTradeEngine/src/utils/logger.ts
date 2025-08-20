import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level}]: ${message}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console logging
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // File logging
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory already exists or creation failed
}

// Add method to create child loggers with context
export function createChildLogger(context: string) {
  return logger.child({ context });
}

// Performance logging utilities
export function logPerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await fn();
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      logger.info(`${operation} completed in ${duration.toFixed(2)}ms`);
      resolve(result);
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      logger.error(`${operation} failed after ${duration.toFixed(2)}ms:`, error);
      reject(error);
    }
  });
}

// Structured logging for trading events
export function logTradingEvent(
  event: string,
  data: {
    symbol?: string;
    strategy?: string;
    quantity?: number;
    price?: number;
    orderId?: string;
    [key: string]: any;
  }
) {
  logger.info(`Trading Event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
}

// Risk event logging
export function logRiskEvent(
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string,
  data?: any
) {
  const logLevel = {
    low: 'info',
    medium: 'warn', 
    high: 'error',
    critical: 'error'
  }[severity];
  
  logger[logLevel](`Risk Alert [${severity.toUpperCase()}]: ${message}`, data);
}

// System health logging
export function logSystemHealth(metrics: {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  errorRate: number;
  [key: string]: any;
}) {
  logger.info('System Health Check', {
    ...metrics,
    timestamp: new Date().toISOString()
  });
}

export default logger;
