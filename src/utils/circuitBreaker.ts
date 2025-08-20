import { Logger } from './logger';

/**
 * Circuit Breaker implementation for fault tolerance and system protection
 * Prevents cascade failures by monitoring error rates and temporarily blocking requests
 */
export class CircuitBreaker {
  private readonly log = new Logger('circuit-breaker');
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(private readonly config: CircuitBreakerConfig) {
    this.log.info('Circuit breaker initialized', { 
      name: config.name,
      failureThreshold: config.failureThreshold,
      resetTimeout: config.resetTimeoutMs 
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        const error = new CircuitBreakerError(
          `Circuit breaker ${this.config.name} is OPEN. Next attempt in ${
            Math.ceil((this.nextAttemptTime - Date.now()) / 1000)
          } seconds`
        );
        this.log.warn('Request blocked - circuit breaker OPEN', error, {
          name: this.config.name,
          nextAttemptIn: this.nextAttemptTime - Date.now()
        });
        throw error;
      }
      
      // Transition to HALF_OPEN for testing
      this.transitionTo('HALF_OPEN');
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
      
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute operation with timeout protection
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.timeoutMs) {
      return await operation();
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }

    this.log.debug('Operation succeeded', {
      name: this.config.name,
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount
    });
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Check if error should be ignored for circuit breaker logic
    if (this.shouldIgnoreError(error)) {
      this.log.debug('Error ignored by circuit breaker', error, {
        name: this.config.name
      });
      return;
    }

    this.log.warn('Operation failed', error, {
      name: this.config.name,
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold
    });

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN state should open the circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Check if error should be ignored for circuit breaker logic
   */
  private shouldIgnoreError(error: Error): boolean {
    if (!this.config.ignoredErrors) return false;
    
    return this.config.ignoredErrors.some(ignoredError => {
      if (typeof ignoredError === 'string') {
        return error.message.includes(ignoredError);
      }
      return error instanceof ignoredError;
    });
  }

  /**
   * Transition circuit breaker to a new state
   */
  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    switch (newState) {
      case 'OPEN':
        this.nextAttemptTime = Date.now() + this.config.resetTimeoutMs;
        break;
      case 'HALF_OPEN':
        this.successCount = 0;
        break;
      case 'CLOSED':
        this.failureCount = 0;
        this.successCount = 0;
        break;
    }

    this.log.info('Circuit breaker state changed', {
      name: this.config.name,
      from: oldState,
      to: newState,
      failureCount: this.failureCount,
      nextAttemptTime: newState === 'OPEN' ? new Date(this.nextAttemptTime).toISOString() : null
    });

    // Call state change callback if provided
    if (this.config.onStateChange) {
      try {
        this.config.onStateChange(oldState, newState, this.getStats());
      } catch (error) {
        this.log.error('State change callback failed', error as Error, {
          name: this.config.name
        });
      }
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.config.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null,
      failureRate: this.calculateFailureRate(),
      config: {
        failureThreshold: this.config.failureThreshold,
        resetTimeoutMs: this.config.resetTimeoutMs,
        successThreshold: this.config.successThreshold,
        timeoutMs: this.config.timeoutMs
      }
    };
  }

  /**
   * Calculate current failure rate
   */
  private calculateFailureRate(): number {
    const totalRequests = this.failureCount + this.successCount;
    if (totalRequests === 0) return 0;
    return this.failureCount / totalRequests;
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.log.info('Circuit breaker manually reset', { name: this.config.name });
    this.transitionTo('CLOSED');
  }

  /**
   * Force circuit breaker to OPEN state
   */
  forceOpen(): void {
    this.log.warn('Circuit breaker manually forced OPEN', { name: this.config.name });
    this.transitionTo('OPEN');
  }

  /**
   * Check if circuit breaker is currently allowing requests
   */
  isRequestAllowed(): boolean {
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      return true;
    }
    
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      return true; // Will transition to HALF_OPEN on next request
    }
    
    return false;
  }
}

/**
 * Circuit Breaker Factory for creating and managing multiple circuit breakers
 */
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreaker>();
  private static readonly log = new Logger('circuit-breaker-factory');

  /**
   * Get or create a circuit breaker instance
   */
  static getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const defaultConfig: CircuitBreakerConfig = {
      name,
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      successThreshold: 3,
      timeoutMs: 30000, // 30 seconds
      ...config
    };

    const breaker = new CircuitBreaker(defaultConfig);
    this.breakers.set(name, breaker);
    
    this.log.info('New circuit breaker created', { name, config: defaultConfig });
    return breaker;
  }

  /**
   * Get all circuit breaker statistics
   */
  static getAllStats(): CircuitBreakerStats[] {
    return Array.from(this.breakers.values()).map(breaker => breaker.getStats());
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.log.info('Resetting all circuit breakers', { count: this.breakers.size });
    this.breakers.forEach(breaker => breaker.reset());
  }

  /**
   * Remove a circuit breaker instance
   */
  static removeBreaker(name: string): boolean {
    const removed = this.breakers.delete(name);
    if (removed) {
      this.log.info('Circuit breaker removed', { name });
    }
    return removed;
  }
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Number of failures before opening
  resetTimeoutMs: number; // Time to wait before attempting HALF_OPEN
  successThreshold: number; // Number of successes needed to close from HALF_OPEN
  timeoutMs?: number; // Request timeout
  ignoredErrors?: (string | ErrorConstructor)[]; // Errors to ignore for circuit breaker logic
  onStateChange?: (oldState: CircuitBreakerState, newState: CircuitBreakerState, stats: CircuitBreakerStats) => void;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: string | null;
  nextAttemptTime: string | null;
  failureRate: number;
  config: {
    failureThreshold: number;
    resetTimeoutMs: number;
    successThreshold: number;
    timeoutMs?: number;
  };
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export default CircuitBreaker;