import { storage } from "../storage";
import { SignalGeneratorService } from "../services/signalGenerator";
import { MarketDataService } from "../services/marketData";
import { logger } from "../utils/logger";

export class ScreeningJob {
  private signalGenerator: SignalGeneratorService;
  private marketDataService: MarketDataService;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.signalGenerator = new SignalGeneratorService();
    this.marketDataService = new MarketDataService();
  }

  async start(): Promise<void> {
    logger.info('Starting screening job...');
    this.isRunning = true;

    // Run screening every 4 hours during market hours, every 12 hours when closed
    const scheduleScreening = async () => {
      const marketStatus = await this.marketDataService.getMarketStatus();
      const interval = marketStatus.isOpen ? 4 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000; // 4h or 12h

      if (this.intervalId) {
        clearTimeout(this.intervalId);
      }

      this.intervalId = setTimeout(async () => {
        if (this.isRunning) {
          await this.runScreening();
          scheduleScreening(); // Schedule next run
        }
      }, interval);
    };

    // Initial screening run
    await this.runScreening();
    
    // Schedule recurring runs
    scheduleScreening();

    logger.info('Screening job started');
  }

  stop(): void {
    logger.info('Stopping screening job...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    logger.info('Screening job stopped');
  }

  private async runScreening(): Promise<void> {
    try {
      logger.info('Starting market screening cycle...');

      // Get all enabled strategies
      const enabledStrategies = await storage.getEnabledStrategies();
      
      if (enabledStrategies.length === 0) {
        logger.warn('No enabled strategies found for screening');
        return;
      }

      logger.info(`Running screening for ${enabledStrategies.length} strategies`);

      // Generate new signals
      const newSignals = await this.signalGenerator.generateSignals();
      
      logger.info(`Generated ${newSignals.length} new signals`);

      // Clean up old expired signals
      await this.cleanupExpiredSignals();

      // Update signal statistics
      await this.updateSignalStatistics();

      logger.info('Screening cycle completed successfully');
    } catch (error) {
      logger.error('Error during screening cycle:', error);
    }
  }

  private async cleanupExpiredSignals(): Promise<void> {
    try {
      const allSignals = await storage.getAllTradingSignals();
      const now = new Date();
      
      let cleanedCount = 0;
      
      for (const signal of allSignals) {
        // Mark signals as expired if their time horizon has passed
        if (signal.status === 'active' && signal.timeHorizon) {
          const signalAge = (now.getTime() - signal.createdAt.getTime()) / (24 * 60 * 60 * 1000);
          
          if (signalAge > signal.timeHorizon) {
            await storage.updateTradingSignal(signal.id, { status: 'expired' });
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Marked ${cleanedCount} signals as expired`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired signals:', error);
    }
  }

  private async updateSignalStatistics(): Promise<void> {
    try {
      const allSignals = await storage.getAllTradingSignals();
      
      const stats = {
        total: allSignals.length,
        active: allSignals.filter(s => s.status === 'active').length,
        executed: allSignals.filter(s => s.status === 'executed').length,
        expired: allSignals.filter(s => s.status === 'expired').length,
        cancelled: allSignals.filter(s => s.status === 'cancelled').length,
      };

      const strategyStats = allSignals.reduce((acc, signal) => {
        if (!acc[signal.strategy]) {
          acc[signal.strategy] = { count: 0, avgConfidence: 0, avgReturn: 0 };
        }
        acc[signal.strategy].count++;
        acc[signal.strategy].avgConfidence += signal.confidence;
        acc[signal.strategy].avgReturn += signal.expectedReturn || 0;
        return acc;
      }, {} as Record<string, any>);

      // Calculate averages
      Object.keys(strategyStats).forEach(strategy => {
        const stat = strategyStats[strategy];
        stat.avgConfidence = stat.avgConfidence / stat.count;
        stat.avgReturn = stat.avgReturn / stat.count;
      });

      logger.info('Signal statistics updated:', { stats, strategyStats });
    } catch (error) {
      logger.error('Error updating signal statistics:', error);
    }
  }

  async performFundamentalScreening(symbols: string[]): Promise<{ symbol: string; score: number }[]> {
    const results: { symbol: string; score: number }[] = [];
    
    try {
      for (const symbol of symbols) {
        const marketData = await this.marketDataService.getQuote(symbol);
        
        if (!marketData) continue;
        
        // Simple fundamental scoring based on available metrics
        let score = 5.0; // Base score
        
        // Market cap scoring (prefer large caps)
        if (marketData.marketCap && marketData.marketCap > 100e9) score += 1.5; // >$100B
        else if (marketData.marketCap && marketData.marketCap > 10e9) score += 1.0; // >$10B
        else if (marketData.marketCap && marketData.marketCap > 1e9) score += 0.5; // >$1B
        
        // PE ratio scoring (prefer reasonable valuations)
        if (marketData.pe && marketData.pe > 0) {
          if (marketData.pe < 15) score += 1.0;
          else if (marketData.pe < 25) score += 0.5;
          else if (marketData.pe > 50) score -= 1.0;
        }
        
        // Beta scoring (prefer moderate volatility)
        if (marketData.beta !== undefined) {
          if (marketData.beta >= 0.8 && marketData.beta <= 1.2) score += 0.5;
          else if (marketData.beta > 2.0) score -= 1.0;
        }
        
        // Volume scoring (prefer liquid stocks)
        if (marketData.volume > 1e6) score += 0.5; // >1M daily volume
        
        results.push({ symbol, score: Math.max(0, Math.min(10, score)) });
      }
    } catch (error) {
      logger.error('Error in fundamental screening:', error);
    }
    
    return results;
  }

  async performTechnicalScreening(symbols: string[]): Promise<{ symbol: string; score: number }[]> {
    const results: { symbol: string; score: number }[] = [];
    
    try {
      for (const symbol of symbols) {
        const historicalData = await this.marketDataService.getHistoricalData(symbol, '3month');
        
        if (historicalData.length < 20) {
          results.push({ symbol, score: 5.0 }); // Default neutral score
          continue;
        }
        
        let score = 5.0; // Base score
        
        // Simple moving average analysis
        const recentPrices = historicalData.slice(0, 10).map(d => parseFloat(d.close));
        const olderPrices = historicalData.slice(-10).map(d => parseFloat(d.close));
        
        const recentAvg = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
        const olderAvg = olderPrices.reduce((a, b) => a + b) / olderPrices.length;
        
        // Momentum scoring
        const momentum = (recentAvg - olderAvg) / olderAvg;
        if (momentum > 0.05) score += 2.0; // Strong uptrend
        else if (momentum > 0.02) score += 1.0; // Moderate uptrend
        else if (momentum < -0.05) score -= 2.0; // Strong downtrend
        else if (momentum < -0.02) score -= 1.0; // Moderate downtrend
        
        // Volatility analysis
        const returns = [];
        for (let i = 1; i < recentPrices.length; i++) {
          returns.push((recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1]);
        }
        
        const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
        
        // Prefer moderate volatility for options trading
        if (volatility > 0.02 && volatility < 0.08) score += 1.0;
        else if (volatility > 0.15) score -= 1.0; // Too volatile
        
        results.push({ symbol, score: Math.max(0, Math.min(10, score)) });
      }
    } catch (error) {
      logger.error('Error in technical screening:', error);
    }
    
    return results;
  }

  async performOptionsScreening(symbols: string[]): Promise<{ symbol: string; score: number }[]> {
    const results: { symbol: string; score: number }[] = [];
    
    try {
      for (const symbol of symbols) {
        const optionChain = await this.marketDataService.getOptionChain(symbol);
        
        if (optionChain.length === 0) {
          results.push({ symbol, score: 0 }); // No options available
          continue;
        }
        
        let score = 5.0; // Base score
        
        // Count LEAPS options (>300 days to expiration)
        const leapsOptions = optionChain.filter(option => {
          const daysToExp = (option.expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
          return daysToExp > 300;
        });
        
        if (leapsOptions.length > 20) score += 2.0; // Good LEAPS selection
        else if (leapsOptions.length > 10) score += 1.0;
        else if (leapsOptions.length === 0) score -= 3.0; // No LEAPS
        
        // Average implied volatility analysis
        const avgIV = optionChain.reduce((sum, opt) => sum + opt.impliedVolatility, 0) / optionChain.length;
        
        if (avgIV > 0.15 && avgIV < 0.5) score += 1.0; // Good IV range for LEAPS
        else if (avgIV > 0.8) score -= 1.0; // Too high IV
        else if (avgIV < 0.1) score -= 0.5; // Too low IV
        
        // Volume and open interest analysis
        const avgVolume = optionChain.reduce((sum, opt) => sum + opt.volume, 0) / optionChain.length;
        const avgOI = optionChain.reduce((sum, opt) => sum + opt.openInterest, 0) / optionChain.length;
        
        if (avgVolume > 100 && avgOI > 500) score += 1.0; // Good liquidity
        else if (avgVolume < 10 || avgOI < 50) score -= 1.0; // Poor liquidity
        
        results.push({ symbol, score: Math.max(0, Math.min(10, score)) });
      }
    } catch (error) {
      logger.error('Error in options screening:', error);
    }
    
    return results;
  }

  async getScreeningCandidates(): Promise<string[]> {
    // Return a curated list of screening candidates
    // In production, this could be dynamically updated based on market conditions
    return [
      // Large Cap Tech
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'NFLX', 'ADBE', 'CRM', 'ORCL',
      
      // Large Cap Finance
      'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'V', 'MA', 'AXP', 'BLK',
      
      // Large Cap Healthcare
      'JNJ', 'PFE', 'UNH', 'ABBV', 'BMY', 'MRK', 'CVS', 'AMGN', 'GILD', 'LLY',
      
      // Large Cap Consumer
      'TSLA', 'HD', 'DIS', 'NKE', 'MCD', 'SBUX', 'KO', 'PEP', 'WMT', 'TGT',
      
      // Large Cap Industrial
      'BA', 'CAT', 'GE', 'MMM', 'HON', 'UPS', 'FDX', 'LMT', 'RTX', 'DE',
      
      // ETFs for broader strategies
      'SPY', 'QQQ', 'IWM', 'XLF', 'XLK', 'XLE', 'XLV', 'XLI', 'XLP', 'XLU'
    ];
  }

  async runCustomScreening(criteria: any): Promise<any[]> {
    try {
      const candidates = await this.getScreeningCandidates();
      
      // Apply fundamental screening if criteria specified
      let fundamentalResults: { symbol: string; score: number }[] = [];
      if (criteria.fundamental) {
        fundamentalResults = await this.performFundamentalScreening(candidates);
      }
      
      // Apply technical screening if criteria specified
      let technicalResults: { symbol: string; score: number }[] = [];
      if (criteria.technical) {
        technicalResults = await this.performTechnicalScreening(candidates);
      }
      
      // Apply options screening if criteria specified
      let optionsResults: { symbol: string; score: number }[] = [];
      if (criteria.options) {
        optionsResults = await this.performOptionsScreening(candidates);
      }
      
      // Combine results
      const combinedResults = candidates.map(symbol => {
        const fundamental = fundamentalResults.find(r => r.symbol === symbol)?.score || 5.0;
        const technical = technicalResults.find(r => r.symbol === symbol)?.score || 5.0;
        const options = optionsResults.find(r => r.symbol === symbol)?.score || 5.0;
        
        const compositeScore = (fundamental + technical + options) / 3;
        
        return {
          symbol,
          fundamentalScore: fundamental,
          technicalScore: technical,
          optionsScore: options,
          compositeScore,
        };
      });
      
      // Sort by composite score and return top results
      return combinedResults
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, 50); // Return top 50 candidates
        
    } catch (error) {
      logger.error('Error in custom screening:', error);
      return [];
    }
  }
}
