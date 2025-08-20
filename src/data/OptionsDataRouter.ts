import { OptionContract, MarketData } from '../core/types';
import { Logger } from '../utils/logger';

/**
 * Options Data Router - Manages routing and aggregation of options data
 * from multiple data providers with failover and caching capabilities
 */
export class OptionsDataRouter {
  private readonly log = new Logger('options-data-router');
  private providers: OptionsDataProvider[] = [];
  private cache = new Map<string, CachedOptionData>();
  private readonly cacheTimeout = 30000; // 30 seconds

  constructor(providers: OptionsDataProvider[] = []) {
    this.providers = providers;
    this.log.info('OptionsDataRouter initialized', { providerCount: providers.length });
  }

  /**
   * Add a data provider to the routing chain
   */
  addProvider(provider: OptionsDataProvider, priority: number = 0): void {
    this.providers.push({ ...provider, priority });
    // Sort by priority (higher priority first)
    this.providers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.log.info('Data provider added', { 
      name: provider.name, 
      priority,
      totalProviders: this.providers.length 
    });
  }

  /**
   * Get option chain for a symbol with failover
   */
  async getOptionChain(symbol: string, expiration?: string): Promise<OptionContract[]> {
    const cacheKey = `chain:${symbol}:${expiration || 'all'}`;
    
    // Check cache first
    const cached = this.getFromCache<OptionContract[]>(cacheKey);
    if (cached) {
      this.log.debug('Option chain served from cache', { symbol, expiration });
      return cached;
    }

    let lastError: Error | null = null;
    
    // Try each provider in priority order
    for (const provider of this.providers) {
      try {
        this.log.debug('Fetching option chain', { symbol, provider: provider.name });
        
        const options = await provider.getOptionChain(symbol, expiration);
        
        if (options && options.length > 0) {
          // Cache the result
          this.setCache(cacheKey, options);
          
          this.log.info('Option chain fetched successfully', { 
            symbol, 
            provider: provider.name,
            optionCount: options.length 
          });
          
          return options;
        }
        
      } catch (error) {
        lastError = error as Error;
        this.log.warn('Provider failed for option chain', lastError, { 
          symbol, 
          provider: provider.name 
        });
        continue;
      }
    }

    // All providers failed
    const error = new Error(`Failed to fetch option chain for ${symbol} from all providers`);
    this.log.error('All providers failed for option chain', error, { 
      symbol, 
      providerCount: this.providers.length,
      lastError: lastError?.message 
    });
    
    throw error;
  }

  /**
   * Get real-time option quote
   */
  async getOptionQuote(symbol: string): Promise<OptionContract> {
    const cacheKey = `quote:${symbol}`;
    
    // Check cache first (shorter timeout for quotes)
    const cached = this.getFromCache<OptionContract>(cacheKey, 5000); // 5 second cache
    if (cached) {
      this.log.debug('Option quote served from cache', { symbol });
      return cached;
    }

    let lastError: Error | null = null;
    
    for (const provider of this.providers) {
      try {
        this.log.debug('Fetching option quote', { symbol, provider: provider.name });
        
        const quote = await provider.getOptionQuote(symbol);
        
        if (quote) {
          // Cache with shorter timeout for real-time data
          this.setCache(cacheKey, quote, 5000);
          
          this.log.debug('Option quote fetched successfully', { 
            symbol, 
            provider: provider.name,
            bid: quote.bid,
            ask: quote.ask 
          });
          
          return quote;
        }
        
      } catch (error) {
        lastError = error as Error;
        this.log.warn('Provider failed for option quote', lastError, { 
          symbol, 
          provider: provider.name 
        });
        continue;
      }
    }

    const error = new Error(`Failed to fetch option quote for ${symbol} from all providers`);
    this.log.error('All providers failed for option quote', error, { 
      symbol, 
      lastError: lastError?.message 
    });
    
    throw error;
  }

  /**
   * Get underlying market data
   */
  async getUnderlyingData(symbol: string): Promise<MarketData> {
    const cacheKey = `underlying:${symbol}`;
    
    const cached = this.getFromCache<MarketData>(cacheKey, 10000); // 10 second cache
    if (cached) {
      this.log.debug('Underlying data served from cache', { symbol });
      return cached;
    }

    let lastError: Error | null = null;
    
    for (const provider of this.providers) {
      try {
        if (!provider.getUnderlyingData) continue;
        
        this.log.debug('Fetching underlying data', { symbol, provider: provider.name });
        
        const data = await provider.getUnderlyingData(symbol);
        
        if (data) {
          this.setCache(cacheKey, data, 10000);
          
          this.log.debug('Underlying data fetched successfully', { 
            symbol, 
            provider: provider.name,
            price: data.price 
          });
          
          return data;
        }
        
      } catch (error) {
        lastError = error as Error;
        this.log.warn('Provider failed for underlying data', lastError, { 
          symbol, 
          provider: provider.name 
        });
        continue;
      }
    }

    const error = new Error(`Failed to fetch underlying data for ${symbol} from all providers`);
    this.log.error('All providers failed for underlying data', error, { 
      symbol, 
      lastError: lastError?.message 
    });
    
    throw error;
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<ProviderHealthStatus[]> {
    const results: ProviderHealthStatus[] = [];
    
    for (const provider of this.providers) {
      try {
        const startTime = Date.now();
        
        if (provider.healthCheck) {
          await provider.healthCheck();
        } else {
          // Simple test with a known symbol
          await provider.getOptionQuote('SPY240119C00400000');
        }
        
        const responseTime = Date.now() - startTime;
        
        results.push({
          name: provider.name,
          healthy: true,
          responseTime,
          error: null
        });
        
      } catch (error) {
        results.push({
          name: provider.name,
          healthy: false,
          responseTime: -1,
          error: (error as Error).message
        });
      }
    }
    
    this.log.info('Provider health check completed', { 
      total: results.length,
      healthy: results.filter(r => r.healthy).length 
    });
    
    return results;
  }

  /**
   * Clear cache for a specific symbol or all
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      this.log.info('All cache cleared');
      return;
    }
    
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.log.info('Cache cleared for pattern', { pattern, deletedKeys: keysToDelete.length });
  }

  /**
   * Get provider statistics
   */
  getProviderStats(): ProviderStats[] {
    return this.providers.map(provider => ({
      name: provider.name,
      priority: provider.priority || 0,
      enabled: provider.enabled !== false,
      lastUsed: provider.lastUsed || null,
      successCount: provider.successCount || 0,
      errorCount: provider.errorCount || 0
    }));
  }

  private getFromCache<T>(key: string, customTimeout?: number): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const timeout = customTimeout || this.cacheTimeout;
    const isExpired = Date.now() - cached.timestamp > timeout;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  private setCache<T>(key: string, data: T, customTimeout?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      timeout: customTimeout || this.cacheTimeout
    });
  }
}

export interface OptionsDataProvider {
  name: string;
  priority?: number;
  enabled?: boolean;
  lastUsed?: string;
  successCount?: number;
  errorCount?: number;
  
  getOptionChain(symbol: string, expiration?: string): Promise<OptionContract[]>;
  getOptionQuote(symbol: string): Promise<OptionContract>;
  getUnderlyingData?(symbol: string): Promise<MarketData>;
  healthCheck?(): Promise<void>;
}

export interface CachedOptionData {
  data: unknown;
  timestamp: number;
  timeout: number;
}

export interface ProviderHealthStatus {
  name: string;
  healthy: boolean;
  responseTime: number;
  error: string | null;
}

export interface ProviderStats {
  name: string;
  priority: number;
  enabled: boolean;
  lastUsed: string | null;
  successCount: number;
  errorCount: number;
}

export default OptionsDataRouter;