import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { MarketData, Order } from '../types';

export class AlpacaClient {
  private client: AxiosInstance;
  private dataClient: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.dataProviders.alpaca.baseUrl,
      headers: {
        'APCA-API-KEY-ID': config.dataProviders.alpaca.apiKey,
        'APCA-API-SECRET-KEY': config.dataProviders.alpaca.apiSecret,
      },
      timeout: 10000,
    });

    this.dataClient = axios.create({
      baseURL: config.dataProviders.alpaca.dataUrl,
      headers: {
        'APCA-API-KEY-ID': config.dataProviders.alpaca.apiKey,
        'APCA-API-SECRET-KEY': config.dataProviders.alpaca.apiSecret,
      },
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    const errorHandler = (error: any) => {
      logger.error('Alpaca API error:', error.response?.data || error.message);
      throw error;
    };

    this.client.interceptors.response.use(response => response, errorHandler);
    this.dataClient.interceptors.response.use(response => response, errorHandler);
  }

  async getAccount(): Promise<any> {
    try {
      const response = await this.client.get('/v2/account');
      return response.data;
    } catch (error) {
      logger.error('Failed to get account info:', error);
      throw error;
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const response = await this.client.get('/v2/positions');
      return response.data;
    } catch (error) {
      logger.error('Failed to get positions:', error);
      return [];
    }
  }

  async getOrders(status?: string): Promise<any[]> {
    try {
      const params = status ? { status } : {};
      const response = await this.client.get('/v2/orders', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get orders:', error);
      return [];
    }
  }

  async createOrder(orderData: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    time_in_force: 'day' | 'gtc' | 'ioc' | 'fok';
    limit_price?: number;
    stop_price?: number;
  }): Promise<any> {
    try {
      const response = await this.client.post('/v2/orders', orderData);
      logger.info(`Order created: ${orderData.side} ${orderData.qty} ${orderData.symbol}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create order:', error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.client.delete(`/v2/orders/${orderId}`);
      logger.info(`Order cancelled: ${orderId}`);
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  async getQuote(symbol: string): Promise<MarketData | null> {
    const cacheKey = `alpaca:quote:${symbol}`;
    const cached = cache.get<MarketData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.dataClient.get(`/v2/stocks/${symbol}/quotes/latest`);
      
      if (!response.data.quote) {
        return null;
      }

      const quote = response.data.quote;
      const data: MarketData = {
        symbol,
        price: (quote.bp + quote.ap) / 2, // Mid price
        volume: 0, // Quote doesn't include volume
        timestamp: new Date(quote.t),
      };

      cache.set(cacheKey, data, config.cache.marketDataTtl);
      return data;
    } catch (error) {
      logger.error(`Failed to get quote for ${symbol}:`, error);
      return null;
    }
  }

  async getLatestTrade(symbol: string): Promise<MarketData | null> {
    const cacheKey = `alpaca:trade:${symbol}`;
    const cached = cache.get<MarketData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.dataClient.get(`/v2/stocks/${symbol}/trades/latest`);
      
      if (!response.data.trade) {
        return null;
      }

      const trade = response.data.trade;
      const data: MarketData = {
        symbol,
        price: trade.p,
        volume: trade.s,
        timestamp: new Date(trade.t),
      };

      cache.set(cacheKey, data, config.cache.marketDataTtl);
      return data;
    } catch (error) {
      logger.error(`Failed to get latest trade for ${symbol}:`, error);
      return null;
    }
  }

  async getHistoricalBars(
    symbol: string,
    timeframe: string = '1Day',
    start?: Date,
    end?: Date
  ): Promise<any[] | null> {
    const cacheKey = `alpaca:bars:${symbol}:${timeframe}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const params: any = {
        symbols: symbol,
        timeframe,
      };

      if (start) params.start = start.toISOString();
      if (end) params.end = end.toISOString();

      const response = await this.dataClient.get('/v2/stocks/bars', { params });
      
      const bars = response.data.bars?.[symbol] || [];
      
      cache.set(cacheKey, bars, config.cache.marketDataTtl);
      return bars;
    } catch (error) {
      logger.error(`Failed to get historical bars for ${symbol}:`, error);
      return null;
    }
  }

  async getSnapshot(symbol: string): Promise<any | null> {
    try {
      const response = await this.dataClient.get(`/v2/stocks/${symbol}/snapshot`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get snapshot for ${symbol}:`, error);
      return null;
    }
  }

  async getOptionChain(symbol: string): Promise<any[] | null> {
    try {
      const response = await this.dataClient.get(`/v1beta1/options/snapshots/${symbol}`);
      return response.data.snapshots || [];
    } catch (error) {
      logger.error(`Failed to get option chain for ${symbol}:`, error);
      return null;
    }
  }

  async getClock(): Promise<any> {
    try {
      const response = await this.client.get('/v2/clock');
      return response.data;
    } catch (error) {
      logger.error('Failed to get market clock:', error);
      throw error;
    }
  }

  async getCalendar(start?: Date, end?: Date): Promise<any[]> {
    try {
      const params: any = {};
      if (start) params.start = start.toISOString().split('T')[0];
      if (end) params.end = end.toISOString().split('T')[0];

      const response = await this.client.get('/v2/calendar', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get market calendar:', error);
      return [];
    }
  }
}
