import { MarketData } from "@shared/schema";

export class AlpacaClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ALPACA_API_KEY || '';
    this.apiSecret = process.env.ALPACA_SECRET_KEY || '';
    this.baseUrl = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';
  }

  private getHeaders() {
    return {
      'APCA-API-KEY-ID': this.apiKey,
      'APCA-API-SECRET-KEY': this.apiSecret,
      'Content-Type': 'application/json',
    };
  }

  async getQuote(symbol: string): Promise<MarketData | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v2/stocks/${symbol}/quotes/latest`,
        { headers: this.getHeaders() }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const quote = data.quote;

      if (!quote) {
        return null;
      }

      return {
        id: `${symbol}-${Date.now()}`,
        symbol,
        price: (quote.bid_price + quote.ask_price) / 2,
        volume: quote.bid_size + quote.ask_size,
        timestamp: new Date(quote.timestamp),
      };
    } catch (error) {
      console.error(`Alpaca API error for ${symbol}:`, error);
      return null;
    }
  }

  async getMarketStatus(): Promise<{ isOpen: boolean; nextOpen?: Date; nextClose?: Date }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v2/clock`,
        { headers: this.getHeaders() }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      return {
        isOpen: data.is_open,
        nextOpen: data.next_open ? new Date(data.next_open) : undefined,
        nextClose: data.next_close ? new Date(data.next_close) : undefined,
      };
    } catch (error) {
      console.error('Alpaca market status error:', error);
      return { isOpen: false };
    }
  }

  async getAccount(): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v2/account`,
        { headers: this.getHeaders() }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Alpaca account error:', error);
      return null;
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v2/positions`,
        { headers: this.getHeaders() }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Alpaca positions error:', error);
      return [];
    }
  }

  async createOrder(orderData: any): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v2/orders`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(orderData),
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Alpaca order creation error:', error);
      throw error;
    }
  }
}
