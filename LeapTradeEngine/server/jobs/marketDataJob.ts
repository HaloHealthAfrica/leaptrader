import { MarketDataService } from "../services/marketData";
import { storage } from "../storage";

export class MarketDataJob {
  private marketDataService: MarketDataService;
  private isRunning = false;

  constructor() {
    this.marketDataService = new MarketDataService();
  }

  async start(): Promise<void> {
    console.log('Starting market data job...');
    this.isRunning = true;

    // Update market data every 30 seconds during market hours
    setInterval(async () => {
      if (this.isRunning) {
        await this.updateMarketData();
      }
    }, 30000);

    // Initial update
    await this.updateMarketData();
  }

  stop(): void {
    console.log('Stopping market data job...');
    this.isRunning = false;
  }

  private async updateMarketData(): Promise<void> {
    try {
      // Check if market is open
      const marketStatus = await this.marketDataService.getMarketStatus();
      if (!marketStatus.isOpen) {
        console.log('Market is closed, skipping data update');
        return;
      }

      // Get all unique symbols from positions and signals
      const symbols = await this.getAllActiveSymbols();
      
      if (symbols.length === 0) {
        console.log('No active symbols to update');
        return;
      }

      console.log(`Updating market data for ${symbols.length} symbols...`);

      // Update quotes in batches
      const batchSize = 10;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        await this.updateSymbolBatch(batch);
        
        // Small delay between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('Market data update completed');
    } catch (error) {
      console.error('Error updating market data:', error);
    }
  }

  private async getAllActiveSymbols(): Promise<string[]> {
    const symbolSet = new Set<string>();

    // Get symbols from active positions
    const positions = await storage.getAllPositions();
    const activePositions = positions.filter(pos => !pos.closeDate);
    activePositions.forEach(pos => symbolSet.add(pos.symbol));

    // Get symbols from active signals
    const activeSignals = await storage.getActiveSignals();
    activeSignals.forEach(signal => symbolSet.add(signal.symbol));

    // Add popular symbols for screening
    const popularSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
      'DIS', 'V', 'MA', 'JPM', 'JNJ', 'PG', 'HD', 'UNH', 'BAC', 'XOM'
    ];
    popularSymbols.forEach(symbol => symbolSet.add(symbol));

    return Array.from(symbolSet);
  }

  private async updateSymbolBatch(symbols: string[]): Promise<void> {
    try {
      const quotes = await this.marketDataService.getMultipleQuotes(symbols);
      
      for (const quote of quotes) {
        // Update or create market data
        const existing = await storage.getMarketData(quote.symbol);
        if (existing) {
          await storage.updateMarketData(existing.id, {
            price: quote.price,
            volume: quote.volume,
            timestamp: new Date(),
          });
        } else {
          await storage.createMarketData({
            symbol: quote.symbol,
            price: quote.price,
            volume: quote.volume,
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error(`Error updating batch ${symbols.join(', ')}:`, error);
    }
  }

  async updateOptionChains(): Promise<void> {
    try {
      console.log('Updating option chains...');
      
      const symbols = await this.getAllActiveSymbols();
      const stockSymbols = symbols.filter(symbol => symbol.length <= 5); // Filter out option symbols
      
      for (const symbol of stockSymbols.slice(0, 5)) { // Limit to 5 symbols to avoid rate limits
        try {
          const optionChain = await this.marketDataService.getOptionChain(symbol);
          
          for (const option of optionChain) {
            const existing = await storage.getOptionData(option.symbol);
            if (existing) {
              await storage.updateOptionData(existing.id, {
                bid: option.bid,
                ask: option.ask,
                last: option.last,
                volume: option.volume,
                impliedVolatility: option.impliedVolatility,
                delta: option.delta,
                gamma: option.gamma,
                theta: option.theta,
                vega: option.vega,
                rho: option.rho,
              });
            } else {
              await storage.createOptionData({
                symbol: option.symbol,
                underlying: option.underlying,
                strike: option.strike,
                expiration: option.expiration,
                type: option.type,
                bid: option.bid,
                ask: option.ask,
                last: option.last,
                volume: option.volume,
                openInterest: option.openInterest,
                impliedVolatility: option.impliedVolatility,
                delta: option.delta,
                gamma: option.gamma,
                theta: option.theta,
                vega: option.vega,
                rho: option.rho,
              });
            }
          }
          
          console.log(`Updated option chain for ${symbol}: ${optionChain.length} options`);
          
          // Delay between symbols to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Error updating option chain for ${symbol}:`, error);
        }
      }
      
      console.log('Option chain update completed');
    } catch (error) {
      console.error('Error updating option chains:', error);
    }
  }

  // Run option chain updates less frequently (every 5 minutes)
  startOptionChainUpdates(): void {
    setInterval(async () => {
      if (this.isRunning) {
        await this.updateOptionChains();
      }
    }, 300000); // 5 minutes
  }
}
