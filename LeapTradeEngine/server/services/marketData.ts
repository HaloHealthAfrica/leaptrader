import { MarketData, OptionData } from "@shared/schema";
import { TwelvedataClient } from "./dataProviders/twelvedata";
import { AlpacaClient } from "./dataProviders/alpaca";
import { TradierClient } from "./dataProviders/tradier";

export class MarketDataService {
  private twelvedata: TwelvedataClient;
  private alpaca: AlpacaClient;
  private tradier: TradierClient;

  constructor() {
    this.twelvedata = new TwelvedataClient();
    this.alpaca = new AlpacaClient();
    this.tradier = new TradierClient();
  }

  async getQuote(symbol: string): Promise<MarketData | null> {
    try {
      // Try Twelvedata first
      const quote = await this.twelvedata.getQuote(symbol);
      if (quote) return quote;

      // Fallback to Alpaca
      const alpacaQuote = await this.alpaca.getQuote(symbol);
      if (alpacaQuote) return alpacaQuote;

      // Final fallback to Tradier
      return await this.tradier.getQuote(symbol);
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  async getOptionChain(symbol: string, expiration?: string): Promise<OptionData[]> {
    try {
      // Use Tradier for options data as it has comprehensive options API
      return await this.tradier.getOptionChain(symbol, expiration);
    } catch (error) {
      console.error(`Error fetching option chain for ${symbol}:`, error);
      return [];
    }
  }

  async getHistoricalData(symbol: string, period: string = '1year'): Promise<any[]> {
    try {
      return await this.twelvedata.getHistoricalData(symbol, period);
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }

  async searchSymbols(query: string): Promise<any[]> {
    try {
      return await this.twelvedata.searchSymbols(query);
    } catch (error) {
      console.error(`Error searching symbols for ${query}:`, error);
      return [];
    }
  }

  async getMarketStatus(): Promise<{ isOpen: boolean; nextOpen?: Date; nextClose?: Date }> {
    try {
      return await this.alpaca.getMarketStatus();
    } catch (error) {
      console.error('Error fetching market status:', error);
      return { isOpen: false };
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<MarketData[]> {
    const promises = symbols.map(symbol => this.getQuote(symbol));
    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<MarketData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }
}
