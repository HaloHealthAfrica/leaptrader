import { MarketData } from "@shared/schema";

export class TwelvedataClient {
  private apiKey: string;
  private baseUrl = 'https://api.twelvedata.com';

  constructor() {
    this.apiKey = process.env.TWELVEDATA_API_KEY || '';
  }

  async getQuote(symbol: string): Promise<MarketData | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/quote?symbol=${symbol}&apikey=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }

      return {
        id: `${symbol}-${Date.now()}`,
        symbol,
        price: parseFloat(data.close),
        volume: parseInt(data.volume) || 0,
        marketCap: data.market_cap ? parseFloat(data.market_cap) : undefined,
        pe: data.pe_ratio ? parseFloat(data.pe_ratio) : undefined,
        beta: data.beta ? parseFloat(data.beta) : undefined,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`Twelvedata API error for ${symbol}:`, error);
      return null;
    }
  }

  async getHistoricalData(symbol: string, period: string = '1year'): Promise<any[]> {
    try {
      const interval = period === '1day' ? '1min' : '1day';
      const response = await fetch(
        `${this.baseUrl}/time_series?symbol=${symbol}&interval=${interval}&apikey=${this.apiKey}&outputsize=5000`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }

      return data.values || [];
    } catch (error) {
      console.error(`Twelvedata historical data error for ${symbol}:`, error);
      return [];
    }
  }

  async searchSymbols(query: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/symbol_search?symbol=${query}&apikey=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }

      return data.data || [];
    } catch (error) {
      console.error(`Twelvedata search error for ${query}:`, error);
      return [];
    }
  }

  async getFundamentals(symbol: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/fundamentals?symbol=${symbol}&apikey=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }

      return data;
    } catch (error) {
      console.error(`Twelvedata fundamentals error for ${symbol}:`, error);
      return null;
    }
  }
}
