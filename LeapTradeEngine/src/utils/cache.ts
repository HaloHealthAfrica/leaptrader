import NodeCache from 'node-cache';
import { logger } from './logger';

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  size: number;
}

class CacheManager {
  private cache: NodeCache;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    keys: 0,
    size: 0
  };

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300, // Default 5 minutes TTL
      checkperiod: 60, // Check for expired keys every 60 seconds
      maxKeys: 1000, // Maximum number of keys
      deleteOnExpire: true,
      useClones: false // Better performance, but be careful with mutable objects
    });

    // Set up event listeners
    this.cache.on('set', (key: string, value: any) => {
      this.stats.keys = this.cache.keys().length;
      logger.debug(`Cache SET: ${key}`);
    });

    this.cache.on('del', (key: string, value: any) => {
      this.stats.keys = this.cache.keys().length;
      logger.debug(`Cache DEL: ${key}`);
    });

    this.cache.on('expired', (key: string, value: any) => {
      this.stats.keys = this.cache.keys().length;
      logger.debug(`Cache EXPIRED: ${key}`);
    });

    this.cache.on('flush', () => {
      this.stats = { hits: 0, misses: 0, keys: 0, size: 0 };
      logger.debug('Cache FLUSHED');
    });
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    
    if (value !== undefined) {
      this.stats.hits++;
      logger.debug(`Cache HIT: ${key}`);
      return value;
    } else {
      this.stats.misses++;
      logger.debug(`Cache MISS: ${key}`);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    try {
      const success = this.cache.set(key, value, ttl || 0);
      if (success) {
        logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'})`);
      }
      return success;
    } catch (error) {
      logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  del(key: string): number {
    return this.cache.del(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get multiple keys
   */
  mget<T>(keys: string[]): { [key: string]: T } {
    return this.cache.mget(keys);
  }

  /**
   * Set multiple key-value pairs
   */
  mset<T>(keyValuePairs: Array<{ key: string; val: T; ttl?: number }>): boolean {
    return this.cache.mset(keyValuePairs);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.flushAll();
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      keys: this.cache.keys().length,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Get or set pattern - useful for expensive operations
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cachedValue = this.get<T>(key);
    
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    try {
      const freshValue = await fetchFunction();
      this.set(key, freshValue, ttl);
      return freshValue;
    } catch (error) {
      logger.error(`Error in getOrSet for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Namespace-aware cache operations
   */
  namespace(prefix: string) {
    return {
      get: <T>(key: string) => this.get<T>(`${prefix}:${key}`),
      set: <T>(key: string, value: T, ttl?: number) => 
        this.set(`${prefix}:${key}`, value, ttl),
      del: (key: string) => this.del(`${prefix}:${key}`),
      has: (key: string) => this.has(`${prefix}:${key}`),
      clear: () => {
        const keys = this.keys().filter(k => k.startsWith(`${prefix}:`));
        keys.forEach(k => this.del(k));
      }
    };
  }

  /**
   * TTL-based cache warming
   */
  warm<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number,
    refreshPercent = 0.8
  ): void {
    const refreshTime = ttl * refreshPercent * 1000; // Convert to milliseconds
    
    setTimeout(async () => {
      try {
        const freshValue = await fetchFunction();
        this.set(key, freshValue, ttl);
        logger.debug(`Cache warmed: ${key}`);
        
        // Schedule next refresh
        this.warm(key, fetchFunction, ttl, refreshPercent);
      } catch (error) {
        logger.error(`Cache warming failed for ${key}:`, error);
      }
    }, refreshTime);
  }

  /**
   * Batch operations with error handling
   */
  batch() {
    const operations: Array<() => void> = [];
    
    return {
      set: <T>(key: string, value: T, ttl?: number) => {
        operations.push(() => this.set(key, value, ttl));
        return this;
      },
      del: (key: string) => {
        operations.push(() => this.del(key));
        return this;
      },
      execute: () => {
        const results: boolean[] = [];
        for (const operation of operations) {
          try {
            operation();
            results.push(true);
          } catch (error) {
            logger.error('Batch operation failed:', error);
            results.push(false);
          }
        }
        return results;
      }
    };
  }
}

// Create singleton instance
export const cache = new CacheManager();

// Specialized cache instances for different data types
export const marketDataCache = cache.namespace('market');
export const fundamentalCache = cache.namespace('fundamental');
export const technicalCache = cache.namespace('technical');
export const riskCache = cache.namespace('risk');
export const orderCache = cache.namespace('order');

// Cache monitoring
setInterval(() => {
  const stats = cache.getStats();
  if (stats.keys > 0) {
    logger.debug('Cache Stats:', stats);
  }
}, 300000); // Log stats every 5 minutes

export default cache;
