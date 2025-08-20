import { MarketData, OptionData } from "@shared/schema";

export class TradierClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.TRADIER_API_KEY || '';
    this.baseUrl = process.env.TRADIER_BASE_URL || 'https://api.tradier.com';
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json',
    };
  }

  async getQuote(symbol: string): Promise<MarketData | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/markets/quotes?symbols=${symbol}`,
        { headers: this.getHeaders() }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const quote = data.quotes?.quote;

      if (!quote) {
        return null;
      }

      return {
        id: `${symbol}-${Date.now()}`,
        symbol: quote.symbol,
        price: quote.last || quote.close,
        volume: quote.volume || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`Tradier API error for ${symbol}:`, error);
      return null;
    }
  }

  async getOptionChain(symbol: string, expiration?: string): Promise<OptionData[]> {
    try {
      // First get available expirations if not provided
      if (!expiration) {
        const expirationsResponse = await fetch(
          `${this.baseUrl}/v1/markets/options/expirations?symbol=${symbol}`,
          { headers: this.getHeaders() }
        );
        
        if (!expirationsResponse.ok) {
          throw new Error(`HTTP error! status: ${expirationsResponse.status}`);
        }
        
        const expirationsData = await expirationsResponse.json();
        const expirations = expirationsData.expirations?.date || [];
        
        if (expirations.length === 0) {
          return [];
        }
        
        // Use the first available expiration
        expiration = expirations[0];
      }

      const response = await fetch(
        `${this.baseUrl}/v1/markets/options/chains?symbol=${symbol}&expiration=${expiration}`,
        { headers: this.getHeaders() }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const options = data.options?.option || [];

      return options.map((option: any) => ({
        id: `${option.symbol}-${Date.now()}`,
        symbol: option.symbol,
        underlying: symbol,
        strike: option.strike,
        expiration: new Date(option.expiration_date),
        type: option.option_type as 'call' | 'put',
        bid: option.bid,
        ask: option.ask,
        last: option.last,
        volume: option.volume || 0,
        openInterest: option.open_interest || 0,
        impliedVolatility: option.implied_volatility || 0,
        delta: option.greeks?.delta || 0,
        gamma: option.greeks?.gamma || 0,
        theta: option.greeks?.theta || 0,
        vega: option.greeks?.vega || 0,
        rho: option.greeks?.rho || 0,
      }));
    } catch (error) {
      console.error(`Tradier option chain error for ${symbol}:`, error);
      return [];
    }
  }

  async getOptionQuotes(symbols: string[]): Promise<OptionData[]> {
    try {
      const symbolsString = symbols.join(',');
      const response = await fetch(
        `${this.baseUrl}/v1/markets/quotes?symbols=${symbolsString}`,
        { headers: this.getHeaders() }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const quotes = Array.isArray(data.quotes?.quote) ? data.quotes.quote : [data.quotes?.quote].filter(Boolean);

      return quotes.map((quote: any) => ({
        id: `${quote.symbol}-${Date.now()}`,
        symbol: quote.symbol,
        underlying: quote.underlying || '',
        strike: quote.strike || 0,
        expiration: new Date(quote.expiration_date || Date.now()),
        type: quote.option_type as 'call' | 'put' || 'call',
        bid: quote.bid,
        ask: quote.ask,
        last: quote.last,
        volume: quote.volume || 0,
        openInterest: quote.open_interest || 0,
        impliedVolatility: quote.implied_volatility || 0,
        delta: quote.greeks?.delta || 0,
        gamma: quote.greeks?.gamma || 0,
        theta: quote.greeks?.theta || 0,
        vega: quote.greeks?.vega || 0,
        rho: quote.greeks?.rho || 0,
      }));
    } catch (error) {
      console.error('Tradier option quotes error:', error);
      return [];
    }
  }
}
