import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { MarketData, OptionData } from '../types';

export class TwelvedataClient {
  private client: AxiosInstance;
  private rateLimitRemaining: number = 55;
  private rateLimitReset: Date = new Date();

  constructor() {
    this.client = axios.create({
      baseURL: config.dataProviders.twelvedata.baseUrl,
      timeout: 10000,
      params: {
        apikey: config.dataProviders.twelvedata.apiKey,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.response.use(
      (response) => {
        // Update rate limit info from headers
        const remaining = response.headers['x-ratelimit-remaining'];
        const reset = response.headers['x-ratelimit-reset'];
        
        if (remaining) this.rateLimitRemaining = parseInt(remaining);
        if (reset) this.rateLimitReset = new Date(parseInt(reset) * 1000);

        return response;
      },
      (error) => {
        logger.error('Twelvedata API error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  private async checkRateLimit(): Promise<void> {
    if (this.rateLimitRemaining <= 1) {
      const waitTime = this.rateLimitReset.getTime() - Date.now();
      if (waitTime > 0) {
        logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  async getQuote(symbol: string): Promise<MarketData | null> {
    const cacheKey = `quote:${symbol}`;
    const cached = cache.get<MarketData>(cacheKey);
    if (cached) return cached;

    try {
      await this.checkRateLimit();
      
      const response = await this.client.get('/quote', {
        params: { symbol, interval: '1min' }
      });

      if (response.data.status === 'error') {
        logger.error(`Twelvedata quote error for ${symbol}:`, response.data.message);
        return null;
      }

      const data: MarketData = {
        symbol,
        price: parseFloat(response.data.close),
        volume: parseInt(response.data.volume),
        timestamp: new Date(response.data.datetime),
      };

      cache.set(cacheKey, data, config.cache.marketDataTtl);
      return data;
    } catch (error) {
      logger.error(`Failed to get quote for ${symbol}:`, error);
      return null;
    }
  }

  async getHistoricalPrices(
    symbol: string, 
    interval: string = '1day', 
    outputsize: number = 100
  ): Promise<Array<{ date: Date; open: number; high: number; low: number; close: number; volume: number }> | null> {
    const cacheKey = `historical:${symbol}:${interval}:${outputsize}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      await this.checkRateLimit();
      
      const response = await this.client.get('/time_series', {
        params: { 
          symbol, 
          interval, 
          outputsize,
          order: 'DESC'
        }
      });

      if (response.data.status === 'error') {
        logger.error(`Twelvedata historical data error for ${symbol}:`, response.data.message);
        return null;
      }

      const values = response.data.values?.map((item: any) => ({
        date: new Date(item.datetime),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseInt(item.volume),
      })) || [];

      cache.set(cacheKey, values, config.cache.marketDataTtl);
      return values;
    } catch (error) {
      logger.error(`Failed to get historical data for ${symbol}:`, error);
      return null;
    }
  }

  async getCompanyProfile(symbol: string): Promise<any | null> {
    const cacheKey = `profile:${symbol}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) return cached;

    try {
      await this.checkRateLimit();
      
      const response = await this.client.get('/profile', {
        params: { symbol }
      });

      if (response.data.status === 'error') {
        logger.error(`Twelvedata profile error for ${symbol}:`, response.data.message);
        return null;
      }

      cache.set(cacheKey, response.data, config.cache.fundamentalTtl);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get company profile for ${symbol}:`, error);
      return null;
    }
  }

  async getStatistics(symbol: string): Promise<any | null> {
    const cacheKey = `statistics:${symbol}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) return cached;

    try {
      await this.checkRateLimit();
      
      const response = await this.client.get('/statistics', {
        params: { symbol }
      });

      if (response.data.status === 'error') {
        logger.error(`Twelvedata statistics error for ${symbol}:`, response.data.message);
        return null;
      }

      cache.set(cacheKey, response.data, config.cache.fundamentalTtl);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get statistics for ${symbol}:`, error);
      return null;
    }
  }

  async getTechnicalIndicator(
    symbol: string,
    indicator: string,
    params: Record<string, any> = {}
  ): Promise<any | null> {
    const cacheKey = `technical:${symbol}:${indicator}:${JSON.stringify(params)}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) return cached;

    try {
      await this.checkRateLimit();
      
      const response = await this.client.get(`/${indicator}`, {
        params: {
          symbol,
          interval: '1day',
          ...params
        }
      });

      if (response.data.status === 'error') {
        logger.error(`Twelvedata ${indicator} error for ${symbol}:`, response.data.message);
        return null;
      }

      cache.set(cacheKey, response.data, config.cache.marketDataTtl);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get ${indicator} for ${symbol}:`, error);
      return null;
    }
  }

  getRateLimitStatus(): { remaining: number; reset: Date } {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset,
    };
  }
}
