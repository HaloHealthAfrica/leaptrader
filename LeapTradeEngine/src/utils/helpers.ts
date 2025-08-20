import { randomBytes } from 'crypto';
import { logger } from './logger';

/**
 * Generate unique ID
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Rate limiter utility
 */
export function rateLimiter(maxRequests: number, windowMs: number) {
  const requests: number[] = [];
  
  return async function (): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the window
    while (requests.length > 0 && requests[0] <= now - windowMs) {
      requests.shift();
    }
    
    // Check if we've exceeded the limit
    if (requests.length >= maxRequests) {
      const oldestRequest = requests[0];
      const waitTime = oldestRequest + windowMs - now;
      
      logger.debug(`Rate limit hit, waiting ${waitTime}ms`);
      await sleep(waitTime);
      
      // Recursive call after waiting
      return rateLimiter(maxRequests, windowMs)();
    }
    
    // Add current request
    requests.push(now);
  };
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry utility with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    onRetry
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
      
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }
      
      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private timeoutMs: number = 60000,
    private resetTimeoutMs: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.canAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        this.timeoutPromise()
      ]);
      
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async timeoutPromise(): Promise<never> {
    await sleep(this.timeoutMs);
    throw new Error('Circuit breaker timeout');
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      logger.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  private canAttemptReset(): boolean {
    return this.lastFailureTime !== null && 
           (Date.now() - this.lastFailureTime) >= this.resetTimeoutMs;
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Debounce utility
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), waitMs);
  };
}

/**
 * Throttle utility
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limitMs);
    }
  };
}

/**
 * Deep clone utility
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const clonedObj = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Format currency
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  minimumFractionDigits = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(
  value: number,
  decimals = 2,
  includeSign = true
): string {
  const formatted = value.toFixed(decimals);
  return includeSign && value > 0 ? `+${formatted}%` : `${formatted}%`;
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Moving average calculation
 */
export function calculateMovingAverage(values: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  
  return result;
}

/**
 * Standard deviation calculation
 */
export function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Check if market is open
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Convert to EST (market timezone)
  const estOffset = -5; // EST is UTC-5 (adjust for DST as needed)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const est = new Date(utc + (estOffset * 3600000));
  
  const hours = est.getHours();
  const minutes = est.getMinutes();
  const currentTime = hours * 100 + minutes;
  
  // Market hours: 9:30 AM - 4:00 PM EST
  return currentTime >= 930 && currentTime <= 1600;
}

/**
 * Get next market open time
 */
export function getNextMarketOpen(): Date {
  const now = new Date();
  let nextOpen = new Date(now);
  
  // Set to 9:30 AM EST
  nextOpen.setHours(9, 30, 0, 0);
  
  // If it's past market hours today or it's weekend, move to next business day
  if (now.getHours() >= 16 || now.getDay() === 0 || now.getDay() === 6) {
    nextOpen.setDate(nextOpen.getDate() + 1);
    
    // Skip weekends
    while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }
  }
  
  return nextOpen;
}

/**
 * Batch array processing
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize = 10,
  delayMs = 100
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(processor);
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.warn('Batch processing error:', result.reason);
      }
    }
    
    // Delay between batches to avoid overwhelming APIs
    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }
  
  return results;
}

/**
 * Memory usage monitoring
 */
export function getMemoryUsage(): {
  rss: string;
  heapTotal: string;
  heapUsed: string;
  external: string;
} {
  const usage = process.memoryUsage();
  
  return {
    rss: `${Math.round(usage.rss / 1024 / 1024 * 100) / 100} MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
    external: `${Math.round(usage.external / 1024 / 1024 * 100) / 100} MB`
  };
}
