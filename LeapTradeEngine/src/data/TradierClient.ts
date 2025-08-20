import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { MarketData, OptionData } from '../types';

export class TradierClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.dataProviders.tradier.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.dataProviders.tradier.accessToken}`,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Tradier API error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async getQuote(symbol: string): Promise<MarketData | null> {
    const cacheKey = `tradier:quote:${symbol}`;
    const cached = cache.get<MarketData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(`/v1/markets/quotes`, {
        params: { symbols: symbol }
      });

      const quote = response.data.quotes?.quote;
      if (!quote) return null;

      const data: MarketData = {
        symbol: quote.symbol,
        price: quote.last || quote.close,
        volume: quote.volume,
        timestamp: new Date(),
      };

      cache.set(cacheKey, data, config.cache.marketDataTtl);
      return data;
    } catch (error) {
      logger.error(`Failed to get quote for ${symbol}:`, error);
      return null;
    }
  }

  async getOptionChain(symbol: string, expiration?: string): Promise<OptionData[] | null> {
    const cacheKey = `tradier:options:${symbol}:${expiration || 'all'}`;
    const cached = cache.get<OptionData[]>(cacheKey);
    if (cached) return cached;

    try {
      const params: any = { symbol };
      if (expiration) params.expiration = expiration;

      const response = await this.client.get('/v1/markets/options/chains', { params });
      
      const options = response.data.options?.option || [];
      const optionData: OptionData[] = options.map((opt: any) => ({
        symbol: opt.symbol,
        underlying: opt.underlying,
        strike: opt.strike,
        expiration: new Date(opt.expiration_date),
        type: opt.option_type as 'call' | 'put',
        bid: opt.bid,
        ask: opt.ask,
        last: opt.last,
        volume: opt.volume,
        openInterest: opt.open_interest,
        impliedVolatility: opt.implied_volatility || 0,
        delta: opt.greeks?.delta || 0,
        gamma: opt.greeks?.gamma || 0,
        theta: opt.greeks?.theta || 0,
        vega: opt.greeks?.vega || 0,
        rho: opt.greeks?.rho || 0,
      }));

      cache.set(cacheKey, optionData, config.cache.marketDataTtl);
      return optionData;
    } catch (error) {
      logger.error(`Failed to get option chain for ${symbol}:`, error);
      return null;
    }
  }

  async getOptionExpirations(symbol: string): Promise<string[] | null> {
    const cacheKey = `tradier:expirations:${symbol}`;
    const cached = cache.get<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get('/v1/markets/options/expirations', {
        params: { symbol }
      });

      const expirations = response.data.expirations?.date || [];
      
      cache.set(cacheKey, expirations, config.cache.fundamentalTtl);
      return expirations;
    } catch (error) {
      logger.error(`Failed to get option expirations for ${symbol}:`, error);
      return null;
    }
  }

  async getHistoricalPrices(
    symbol: string, 
    interval: string = 'daily',
    start?: Date,
    end?: Date
  ): Promise<any[] | null> {
    const cacheKey = `tradier:history:${symbol}:${interval}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const params: any = { symbol, interval };
      if (start) params.start = start.toISOString().split('T')[0];
      if (end) params.end = end.toISOString().split('T')[0];

      const response = await this.client.get('/v1/markets/history', { params });
      
      const history = response.data.history?.day || [];
      
      cache.set(cacheKey, history, config.cache.marketDataTtl);
      return history;
    } catch (error) {
      logger.error(`Failed to get historical data for ${symbol}:`, error);
      return null;
    }
  }

  async getGreeks(symbol: string, expiration: string): Promise<any[] | null> {
    const cacheKey = `tradier:greeks:${symbol}:${expiration}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get('/beta/markets/options/strikes', {
        params: { symbol, expiration }
      });

      const strikes = response.data.strikes?.strike || [];
      
      cache.set(cacheKey, strikes, config.cache.marketDataTtl);
      return strikes;
    } catch (error) {
      logger.error(`Failed to get greeks for ${symbol}:`, error);
      return null;
    }
  }

  async placeOrder(orderData: {
    account_id: string;
    symbol: string;
    side: 'buy' | 'sell' | 'buy_to_open' | 'sell_to_close';
    quantity: number;
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    duration: 'day' | 'gtc' | 'pre' | 'post';
    price?: number;
    stop?: number;
  }): Promise<any> {
    try {
      const response = await this.client.post(
        `/v1/accounts/${orderData.account_id}/orders`,
        orderData
      );
      
      logger.info(`Tradier order placed: ${orderData.side} ${orderData.quantity} ${orderData.symbol}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to place Tradier order:', error);
      throw error;
    }
  }

  async getPositions(accountId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/positions`);
      return response.data.positions?.position || [];
    } catch (error) {
      logger.error('Failed to get Tradier positions:', error);
      return [];
    }
  }

  async getOrders(accountId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/orders`);
      return response.data.orders?.order || [];
    } catch (error) {
      logger.error('Failed to get Tradier orders:', error);
      return [];
    }
  }

  async getAccount(accountId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountId}/balances`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Tradier account:', error);
      throw error;
    }
  }

  async getMarketStatus(): Promise<any> {
    try {
      const response = await this.client.get('/v1/markets/clock');
      return response.data.clock;
    } catch (error) {
      logger.error('Failed to get market status:', error);
      throw error;
    }
  }
}
