import cron from 'node-cron';
import { DataProvider } from '../types';
import { logger } from '../utils/logger';
import { cache, marketDataCache } from '../utils/cache';
import { retry } from '../utils/helpers';

interface DataClients {
  twelvedata: DataProvider;
  alpaca: DataProvider;
  tradier: DataProvider;
}

class MarketDataJob {
  private dataClients: DataClients;
  private isRunning = false;
  private currentTask: cron.ScheduledTask | null = null;
  private updateInterval = 30000; // 30 seconds for active market hours
  private symbols: string[] = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK.B',
    'V', 'JNJ', 'WMT', 'JPM', 'PG', 'UNH', 'MA', 'HD', 'BAC', 'ABBV',
    'PFE', 'KO', 'AVGO', 'PEP', 'TMO', 'COST', 'DIS', 'ABT', 'ADBE',
    'CRM', 'VZ', 'NFLX', 'INTC', 'CMCSA', 'NKE', 'QCOM', 'T', 'CVX',
    'XOM', 'DHR', 'NEE', 'LLY', 'TXN', 'PM', 'UPS', 'LOW', 'BMY', 'HON',
    'ORCL', 'IBM', 'MDT', 'GE', 'CAT', 'GS', 'AMD', 'MRK', 'SPGI'
  ];

  constructor(dataClients: DataClients) {
    this.dataClients = dataClients;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Market data job is already running');
      return;
    }

    logger.info('Starting market data collection job...');

    // Schedule during market hours (9:30 AM - 4:00 PM EST, Mon-Fri)
    this.currentTask = cron.schedule('*/30 9-16 * * 1-5', async () => {
      await this.collectMarketData();
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Start the scheduled task
    this.currentTask.start();
    this.isRunning = true;

    // Also run immediately if market is open
    if (this.isMarketOpen()) {
      await this.collectMarketData();
    }

    // Schedule pre-market data collection (8:00 AM EST)
    cron.schedule('0 8 * * 1-5', async () => {
      logger.info('Collecting pre-market data...');
      await this.collectPreMarketData();
    }, {
      timezone: 'America/New_York'
    });

    // Schedule after-hours data collection (6:00 PM EST)
    cron.schedule('0 18 * * 1-5', async () => {
      logger.info('Collecting after-hours data...');
      await this.collectAfterHoursData();
    }, {
      timezone: 'America/New_York'
    });

    logger.info('Market data job started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.currentTask) {
      this.currentTask.stop();
      this.currentTask = null;
    }

    this.isRunning = false;
    logger.info('Market data job stopped');
  }

  private async collectMarketData(): Promise<void> {
    try {
      logger.info('Starting market data collection cycle...');
      const startTime = Date.now();

      // Collect quotes for all symbols
      await this.collectQuotes();

      // Collect option chains for popular symbols
      await this.collectOptionChains();

      // Collect fundamental data (less frequently)
      if (this.shouldCollectFundamentals()) {
        await this.collectFundamentals();
      }

      const duration = Date.now() - startTime;
      logger.info(`Market data collection completed in ${duration}ms`);

      // Update collection statistics
      this.updateCollectionStats(duration);

    } catch (error) {
      logger.error('Error in market data collection:', error);
    }
  }

  private async collectQuotes(): Promise<void> {
    logger.debug('Collecting quotes for symbols...');
    
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      batches.push(this.symbols.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(symbol => this.collectQuoteForSymbol(symbol))
      );
      
      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async collectQuoteForSymbol(symbol: string): Promise<void> {
    try {
      // Try primary data source first (Twelvedata)
      let quote = await retry(
        () => this.dataClients.twelvedata.getQuote(symbol),
        { maxRetries: 2, baseDelay: 500 }
      );

      if (!quote) {
        // Fallback to Alpaca
        quote = await this.dataClients.alpaca.getQuote(symbol);
      }

      if (quote) {
        // Store in cache with 30-second TTL
        marketDataCache.set(`quote:${symbol}`, quote, 30);
        
        // Store price history for trend analysis
        const priceHistory = marketDataCache.get<number[]>(`price_history:${symbol}`) || [];
        priceHistory.push(quote.price);
        
        // Keep only last 100 prices
        if (priceHistory.length > 100) {
          priceHistory.shift();
        }
        
        marketDataCache.set(`price_history:${symbol}`, priceHistory, 300);
        
        logger.debug(`Updated quote for ${symbol}: $${quote.price}`);
      }
    } catch (error) {
      logger.warn(`Failed to collect quote for ${symbol}:`, error.message);
    }
  }

  private async collectOptionChains(): Promise<void> {
    logger.debug('Collecting option chains...');
    
    // Focus on most liquid symbols for option chains
    const optionSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'SPY', 'QQQ', 'IWM'];
    
    for (const symbol of optionSymbols) {
      try {
        await this.collectOptionChainForSymbol(symbol);
      } catch (error) {
        logger.warn(`Failed to collect option chain for ${symbol}:`, error.message);
      }
    }
  }

  private async collectOptionChainForSymbol(symbol: string): Promise<void> {
    try {
      // Get next few expiration dates
      const expirationDates = this.getNextExpirationDates(3);
      
      for (const expiration of expirationDates) {
        const optionChain = await retry(
          () => this.dataClients.tradier.getOptionChain(symbol, expiration),
          { maxRetries: 2, baseDelay: 1000 }
        );

        if (optionChain) {
          // Store option chain with 5-minute TTL
          const cacheKey = `option_chain:${symbol}:${expiration.toISOString().split('T')[0]}`;
          marketDataCache.set(cacheKey, optionChain, 300);
          
          logger.debug(`Updated option chain for ${symbol} ${expiration.toISOString().split('T')[0]}`);
        }
      }
    } catch (error) {
      logger.warn(`Failed to collect option chain for ${symbol}:`, error.message);
    }
  }

  private async collectFundamentals(): Promise<void> {
    logger.debug('Collecting fundamental data...');
    
    // Only collect fundamentals for a subset of symbols each cycle
    const symbolsToUpdate = this.getSymbolsForFundamentalUpdate();
    
    for (const symbol of symbolsToUpdate) {
      try {
        await this.collectFundamentalForSymbol(symbol);
      } catch (error) {
        logger.warn(`Failed to collect fundamentals for ${symbol}:`, error.message);
      }
    }
  }

  private async collectFundamentalForSymbol(symbol: string): Promise<void> {
    try {
      // Check if we have recent fundamental data
      const existingData = cache.get(`fundamentals:${symbol}`);
      if (existingData) {
        return; // Skip if we have recent data
      }

      const fundamentals = await retry(
        () => (this.dataClients.twelvedata as any).getFundamentals?.(symbol),
        { maxRetries: 2, baseDelay: 2000 }
      );

      if (fundamentals) {
        // Store fundamental data with 1-hour TTL
        cache.set(`fundamentals:${symbol}`, fundamentals, 3600);
        logger.debug(`Updated fundamentals for ${symbol}`);
      }
    } catch (error) {
      logger.warn(`Failed to collect fundamentals for ${symbol}:`, error.message);
    }
  }

  private async collectPreMarketData(): Promise<void> {
    try {
      logger.info('Collecting pre-market data...');
      
      // Focus on most active pre-market symbols
      const preMarketSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'SPY', 'QQQ'];
      
      for (const symbol of preMarketSymbols) {
        try {
          const quote = await this.dataClients.alpaca.getQuote(symbol);
          if (quote) {
            marketDataCache.set(`premarket:${symbol}`, quote, 300);
          }
        } catch (error) {
          logger.warn(`Failed to collect pre-market data for ${symbol}:`, error.message);
        }
      }
    } catch (error) {
      logger.error('Error collecting pre-market data:', error);
    }
  }

  private async collectAfterHoursData(): Promise<void> {
    try {
      logger.info('Collecting after-hours data...');
      
      // Collect end-of-day data and prepare for next day
      await this.collectEndOfDayData();
      await this.cleanupOldData();
      
    } catch (error) {
      logger.error('Error collecting after-hours data:', error);
    }
  }

  private async collectEndOfDayData(): Promise<void> {
    for (const symbol of this.symbols) {
      try {
        // Get final quote of the day
        const quote = await this.dataClients.twelvedata.getQuote(symbol);
        if (quote) {
          marketDataCache.set(`eod:${symbol}`, quote, 86400); // Store for 24 hours
        }

        // Get daily historical data
        const historical = await this.dataClients.twelvedata.getHistoricalData(symbol, '1day');
        if (historical && historical.data.length > 0) {
          const latestBar = historical.data[historical.data.length - 1];
          marketDataCache.set(`daily_bar:${symbol}`, latestBar, 86400);
        }
      } catch (error) {
        logger.warn(`Failed to collect EOD data for ${symbol}:`, error.message);
      }
    }
  }

  private cleanupOldData(): void {
    logger.info('Cleaning up old market data...');
    
    // Get all market data cache keys
    const keys = marketDataCache.keys();
    let cleanedCount = 0;
    
    for (const key of keys) {
      // Remove old price history and temporary data
      if (key.includes('temp_') || key.includes('old_')) {
        marketDataCache.del(key);
        cleanedCount++;
      }
    }
    
    logger.info(`Cleaned up ${cleanedCount} old cache entries`);
  }

  private shouldCollectFundamentals(): boolean {
    // Collect fundamentals every 15 minutes during market hours
    const now = new Date();
    return now.getMinutes() % 15 === 0;
  }

  private getSymbolsForFundamentalUpdate(): string[] {
    // Rotate through symbols to avoid hitting rate limits
    const now = new Date();
    const minute = now.getMinutes();
    const batchSize = 5;
    const startIndex = (Math.floor(minute / 15) * batchSize) % this.symbols.length;
    
    return this.symbols.slice(startIndex, startIndex + batchSize);
  }

  private getNextExpirationDates(count: number): Date[] {
    const dates: Date[] = [];
    const now = new Date();
    
    // Start from next Friday
    let date = new Date(now);
    date.setDate(date.getDate() + ((5 - date.getDay() + 7) % 7));
    
    for (let i = 0; i < count; i++) {
      dates.push(new Date(date));
      date.setDate(date.getDate() + 7); // Next Friday
    }
    
    return dates;
  }

  private isMarketOpen(): boolean {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Weekend check
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Convert to EST
    const estOffset = -5; // EST is UTC-5
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const est = new Date(utc + (estOffset * 3600000));
    
    const hours = est.getHours();
    const minutes = est.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    // Market hours: 9:30 AM - 4:00 PM EST
    return currentTime >= 930 && currentTime <= 1600;
  }

  private updateCollectionStats(duration: number): void {
    const stats = cache.get('market_data_stats') || {
      collectionsToday: 0,
      avgDuration: 0,
      lastCollection: null,
      errors: 0
    };
    
    stats.collectionsToday++;
    stats.avgDuration = (stats.avgDuration * (stats.collectionsToday - 1) + duration) / stats.collectionsToday;
    stats.lastCollection = new Date().toISOString();
    
    cache.set('market_data_stats', stats, 86400); // Store for 24 hours
  }

  getStatus(): {
    isRunning: boolean;
    lastCollection: Date | null;
    symbolsTracked: number;
    cacheKeys: number;
    stats: any;
  } {
    const stats = cache.get('market_data_stats');
    
    return {
      isRunning: this.isRunning,
      lastCollection: stats?.lastCollection ? new Date(stats.lastCollection) : null,
      symbolsTracked: this.symbols.length,
      cacheKeys: marketDataCache.keys().length,
      stats
    };
  }
}

// Global instance
let marketDataJobInstance: MarketDataJob | null = null;

export function startMarketDataJob(dataClients: DataClients): void {
  if (marketDataJobInstance) {
    logger.warn('Market data job already started');
    return;
  }

  marketDataJobInstance = new MarketDataJob(dataClients);
  marketDataJobInstance.start().catch(error => {
    logger.error('Failed to start market data job:', error);
  });
}

export function stopMarketDataJob(): void {
  if (marketDataJobInstance) {
    marketDataJobInstance.stop();
    marketDataJobInstance = null;
  }
}

export function getMarketDataJobStatus() {
  return marketDataJobInstance?.getStatus() || {
    isRunning: false,
    lastCollection: null,
    symbolsTracked: 0,
    cacheKeys: 0,
    stats: null
  };
}
