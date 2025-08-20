import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Logger utility for the LEAPS Trading System
 * Provides structured logging with correlation IDs and redaction
 */
export class Logger {
  private readonly pinoLogger: pino.Logger;
  private static readonly correlationStorage = new AsyncLocalStorage<string>();

  constructor(context: string) {
    this.pinoLogger = pino({
      name: context,
      level: process.env.LOG_LEVEL || 'info',
      redact: {
        paths: [
          'password',
          'token',
          'apiKey',
          'secret',
          'authorization'
        ],
        remove: true
      },
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => {
          const correlationId = Logger.correlationStorage.getStore();
          if (correlationId) {
            object.correlationId = correlationId;
          }
          return object;
        }
      }
    });
  }

  /**
   * Set correlation ID for the current async context
   */
  static setCorrelationId(id: string): void {
    Logger.correlationStorage.enterWith(id);
  }

  /**
   * Get current correlation ID
   */
  static getCorrelationId(): string | undefined {
    return Logger.correlationStorage.getStore();
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    // Create child logger with the same context name plus '-child' suffix
    const childPinoLogger = this.pinoLogger.child(context);
    const childLogger = Object.create(Logger.prototype);
    Object.defineProperty(childLogger, 'pinoLogger', {
      value: childPinoLogger,
      writable: false,
      enumerable: false,
      configurable: false
    });
    return childLogger as Logger;
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.pinoLogger.debug(message, ...args);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    this.pinoLogger.info(message, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.pinoLogger.warn(message, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, ...args: unknown[]): void {
    if (error) {
      this.pinoLogger.error({ err: error }, message, ...args);
    } else {
      this.pinoLogger.error(message, ...args);
    }
  }

  /**
   * Log fatal message
   */
  fatal(message: string, ...args: unknown[]): void {
    this.pinoLogger.fatal(message, ...args);
  }
}
