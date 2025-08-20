import { TradingSignal, InsertTradingSignal, MarketData, OptionData, StrategyConfig } from "@shared/schema";
import { storage } from "../storage";
import { MarketDataService } from "./marketData";
import { ProtectivePutStrategy } from "./strategies/protectivePut";
import { SimplifiedLongCallStrategy } from "./strategies/simplifiedLongCall";

export interface SignalContext {
  symbol: string;
  marketData: MarketData;
  optionChain: OptionData[];
  fundamentalScore: number;
  technicalScore: number;
  strategyConfig: StrategyConfig;
}

export class SignalGeneratorService {
  private marketDataService: MarketDataService;
  private strategies: Map<string, any>;

  constructor() {
    this.marketDataService = new MarketDataService();
    this.strategies = new Map([
      ['long_call_leaps', new SimplifiedLongCallStrategy()],
      ['protective_put', new ProtectivePutStrategy()],
    ]);
  }

  async generateSignals(): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];
    
    try {
      const enabledStrategies = await storage.getEnabledStrategies();
      
      for (const strategyConfig of enabledStrategies) {
        const strategySignals = await this.generateSignalsForStrategy(strategyConfig);
        signals.push(...strategySignals);
      }
      
      // Store all generated signals
      for (const signal of signals) {
        await storage.createTradingSignal(signal);
      }
      
    } catch (error) {
      console.error('Error generating signals:', error);
    }
    
    return signals;
  }

  private async generateSignalsForStrategy(strategyConfig: StrategyConfig): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];
    const strategy = this.strategies.get(strategyConfig.type);
    
    if (!strategy) {
      console.error(`Strategy ${strategyConfig.type} not found`);
      return signals;
    }

    try {
      // Get symbols based on screening criteria
      const symbols = await this.getScreenedSymbols(strategyConfig);
      
      for (const symbol of symbols) {
        const context = await this.buildSignalContext(symbol, strategyConfig);
        if (context) {
          const signal = await strategy.generateSignal(context);
          if (signal) {
            signals.push(signal);
          }
        }
      }
    } catch (error) {
      console.error(`Error generating signals for strategy ${strategyConfig.type}:`, error);
    }
    
    return signals;
  }

  private async getScreenedSymbols(strategyConfig: StrategyConfig): Promise<string[]> {
    // For now, return a predefined list of popular stocks
    // In production, this would implement sophisticated screening
    const popularSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
      'DIS', 'V', 'MA', 'JPM', 'JNJ', 'PG', 'HD', 'UNH', 'BAC', 'XOM'
    ];
    
    // Apply basic filtering based on strategy config
    const screening = strategyConfig.screening;
    let filteredSymbols = popularSymbols;
    
    // Here you would implement the actual screening logic
    // based on fundamental and technical criteria
    
    return filteredSymbols.slice(0, 10); // Limit to 10 symbols for demo
  }

  private async buildSignalContext(symbol: string, strategyConfig: StrategyConfig): Promise<SignalContext | null> {
    try {
      const marketData = await this.marketDataService.getQuote(symbol);
      if (!marketData) return null;
      
      const optionChain = await this.marketDataService.getOptionChain(symbol);
      
      // Calculate fundamental and technical scores
      const fundamentalScore = await this.calculateFundamentalScore(symbol);
      const technicalScore = await this.calculateTechnicalScore(symbol);
      
      return {
        symbol,
        marketData,
        optionChain,
        fundamentalScore,
        technicalScore,
        strategyConfig,
      };
    } catch (error) {
      console.error(`Error building context for ${symbol}:`, error);
      return null;
    }
  }

  private async calculateFundamentalScore(symbol: string): Promise<number> {
    // Simplified fundamental scoring
    // In production, this would analyze financial metrics
    try {
      // Mock fundamental analysis - would use real financial data
      const randomScore = Math.random() * 10;
      return Math.round(randomScore * 10) / 10;
    } catch (error) {
      console.error(`Error calculating fundamental score for ${symbol}:`, error);
      return 5.0; // Default neutral score
    }
  }

  private async calculateTechnicalScore(symbol: string): Promise<number> {
    // Simplified technical scoring
    // In production, this would analyze price action, indicators, etc.
    try {
      const historicalData = await this.marketDataService.getHistoricalData(symbol, '3month');
      
      if (historicalData.length === 0) {
        return 5.0; // Default neutral score
      }
      
      // Simple momentum calculation
      const recent = historicalData.slice(0, 5);
      const older = historicalData.slice(-5);
      
      const recentAvg = recent.reduce((sum, data) => sum + parseFloat(data.close), 0) / recent.length;
      const olderAvg = older.reduce((sum, data) => sum + parseFloat(data.close), 0) / older.length;
      
      const momentum = (recentAvg - olderAvg) / olderAvg;
      
      // Convert momentum to 0-10 score
      const score = 5 + (momentum * 50); // Amplify for visibility
      return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
    } catch (error) {
      console.error(`Error calculating technical score for ${symbol}:`, error);
      return 5.0; // Default neutral score
    }
  }

  async getActiveSignals(): Promise<TradingSignal[]> {
    return await storage.getActiveSignals();
  }

  async updateSignalStatus(signalId: string, status: 'active' | 'executed' | 'cancelled' | 'expired'): Promise<void> {
    await storage.updateTradingSignal(signalId, { status });
  }
}
