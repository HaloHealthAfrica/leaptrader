import { TradingSignal, StrategyConfig, LeapsCriteria, DataProvider, OptionChain, Quote } from '../types';
import { FundamentalScreener } from './screening/FundamentalScreener';
import { TechnicalScreener } from './screening/TechnicalScreener';
import { SignalGenerator } from './signals/SignalGenerator';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';

export interface LeapsStrategyConfig {
  dataClients: {
    twelvedata: DataProvider;
    alpaca: DataProvider;
    tradier: DataProvider;
  };
  config: {
    leaps: LeapsCriteria;
    screening: {
      fundamentalWeight: number;
      technicalWeight: number;
      minMarketCap: number;
      maxPERatio: number;
      minVolume: number;
    };
  };
}

export class LeapsStrategy {
  private fundamentalScreener: FundamentalScreener;
  private technicalScreener: TechnicalScreener;
  private signalGenerator: SignalGenerator;
  private activeSignals: Map<string, TradingSignal> = new Map();
  private isRunning = false;

  // Simplified strategy configurations - Long Calls and Protective Puts only
  private strategyConfigs: Map<string, StrategyConfig> = new Map([
    ['long_call_leaps', {
      name: 'Long Call LEAPS',
      type: 'long_call_leaps', 
      criteria: {
        minTimeToExpiry: 365, // 1+ years for LEAPS
        maxTimeToExpiry: 1095, // 3 years max
        minDelta: 0.50, // Broader delta range for flexibility
        maxDelta: 0.85,
        minImpliedVolatility: 0.15,
        maxImpliedVolatility: 0.50,
        minLiquidity: 50 // Lower liquidity requirement for LEAPS
      },
      riskParams: {
        maxPositionSize: 0.20, // Higher allocation for long positions
        stopLoss: 0.30, // 30% stop loss
        profitTarget: 0.75 // 75% profit target
      }
    }],
    ['protective_put', {
      name: 'Protective Put',
      type: 'protective_put',
      criteria: {
        minTimeToExpiry: 90, // 3+ months minimum
        maxTimeToExpiry: 730, // Up to 2 years
        minDelta: -0.40, // Broader range for protection levels
        maxDelta: -0.10,
        minImpliedVolatility: 0.15,
        maxImpliedVolatility: 0.50, // Higher IV tolerance
        minLiquidity: 50 // Lower liquidity requirement
      },
      riskParams: {
        maxPositionSize: 0.15, // Moderate allocation for protection
        stopLoss: 0.50, // 50% stop on protection cost
        profitTarget: 0.20 // 20% profit if puts gain value
      }
    }]
  ]);

  constructor(private config: LeapsStrategyConfig) {
    this.fundamentalScreener = new FundamentalScreener(config.dataClients);
    this.technicalScreener = new TechnicalScreener(config.dataClients);
    this.signalGenerator = new SignalGenerator({
      fundamentalScreener: this.fundamentalScreener,
      technicalScreener: this.technicalScreener,
      dataClients: config.dataClients
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing LEAPS strategy...');
      
      await this.fundamentalScreener.initialize();
      await this.technicalScreener.initialize();
      await this.signalGenerator.initialize();

      this.isRunning = true;
      logger.info('LEAPS strategy initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize LEAPS strategy:', error);
      throw error;
    }
  }

  async generateSignals(symbols: string[]): Promise<TradingSignal[]> {
    if (!this.isRunning) {
      throw new Error('Strategy not initialized');
    }

    const signals: TradingSignal[] = [];

    try {
      logger.info(`Generating signals for ${symbols.length} symbols`);

      for (const symbol of symbols) {
        try {
          const symbolSignals = await this.analyzeSymbol(symbol);
          signals.push(...symbolSignals);
        } catch (error) {
          logger.warn(`Failed to analyze ${symbol}:`, error);
        }
      }

      // Update active signals
      signals.forEach(signal => {
        this.activeSignals.set(signal.id, signal);
      });

      logger.info(`Generated ${signals.length} signals`);
      return signals;
    } catch (error) {
      logger.error('Error generating signals:', error);
      throw error;
    }
  }

  private async analyzeSymbol(symbol: string): Promise<TradingSignal[]> {
    const cacheKey = `analysis:${symbol}`;
    const cached = cache.get<TradingSignal[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const signals: TradingSignal[] = [];

    try {
      // Get fundamental and technical scores
      const fundamentalScore = await this.fundamentalScreener.analyzeSymbol(symbol);
      const technicalScore = await this.technicalScreener.analyzeSymbol(symbol);

      // Skip if scores are too low
      if (fundamentalScore.score < 6.0 || technicalScore.score < 6.0) {
        return [];
      }

      // Get current quote and option chains
      const quote = await this.config.dataClients.tradier.getQuote(symbol);
      
      // Analyze each strategy
      for (const [strategyName, strategyConfig] of this.strategyConfigs) {
        try {
          const strategySignals = await this.analyzeStrategy(
            symbol,
            strategyConfig,
            quote,
            fundamentalScore.score,
            technicalScore.score
          );
          signals.push(...strategySignals);
        } catch (error) {
          logger.warn(`Failed to analyze ${strategyName} for ${symbol}:`, error);
        }
      }

      cache.set(cacheKey, signals, 600); // Cache for 10 minutes
      return signals;
    } catch (error) {
      logger.error(`Error analyzing symbol ${symbol}:`, error);
      return [];
    }
  }

  private async analyzeStrategy(
    symbol: string,
    config: StrategyConfig,
    quote: Quote,
    fundamentalScore: number,
    technicalScore: number
  ): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];

    try {
      // Get available expiration dates
      const expirationDates = await this.getValidExpirationDates(symbol, config.criteria);
      
      for (const expiration of expirationDates) {
        try {
          const optionChain = await this.config.dataClients.tradier.getOptionChain(symbol, expiration);
          const strategySignals = await this.analyzeOptionChain(
            symbol,
            config,
            optionChain,
            quote,
            fundamentalScore,
            technicalScore
          );
          signals.push(...strategySignals);
        } catch (error) {
          logger.warn(`Failed to analyze option chain for ${symbol} ${expiration.toISOString()}:`, error);
        }
      }

      return signals;
    } catch (error) {
      logger.error(`Error analyzing strategy ${config.name} for ${symbol}:`, error);
      return [];
    }
  }

  private async analyzeOptionChain(
    symbol: string,
    config: StrategyConfig,
    optionChain: OptionChain,
    quote: Quote,
    fundamentalScore: number,
    technicalScore: number
  ): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];

    try {
      const options = config.type === 'stock_replacement' ? optionChain.calls : 
                    config.type === 'protective_put' ? optionChain.puts :
                    [...optionChain.calls, ...optionChain.puts];

      for (const option of options) {
        if (this.meetsLeapsCriteria(option, config.criteria, optionChain.expiration)) {
          const signal = await this.signalGenerator.generateSignal({
            symbol,
            strategy: config.name,
            option,
            quote,
            fundamentalScore,
            technicalScore,
            strategyConfig: config
          });

          if (signal && signal.confidence >= 7.0) {
            signals.push(signal);
          }
        }
      }

      return signals;
    } catch (error) {
      logger.error('Error analyzing option chain:', error);
      return [];
    }
  }

  private meetsLeapsCriteria(option: any, criteria: LeapsCriteria, expiration: Date): boolean {
    const timeToExpiry = (expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000); // days

    return (
      timeToExpiry >= criteria.minTimeToExpiry &&
      timeToExpiry <= criteria.maxTimeToExpiry &&
      Math.abs(option.delta) >= Math.abs(criteria.minDelta) &&
      Math.abs(option.delta) <= Math.abs(criteria.maxDelta) &&
      option.impliedVolatility >= criteria.minImpliedVolatility &&
      option.impliedVolatility <= criteria.maxImpliedVolatility &&
      option.openInterest >= criteria.minLiquidity &&
      option.bid > 0 && option.ask > 0
    );
  }

  private async getValidExpirationDates(symbol: string, criteria: LeapsCriteria): Promise<Date[]> {
    try {
      // Get available expiration dates from Tradier (it supports options)
      const dates = await (this.config.dataClients.tradier as any).getExpirationDates?.(symbol) || [];
      const now = new Date();
      const minDate = new Date(now.getTime() + criteria.minTimeToExpiry * 24 * 60 * 60 * 1000);
      const maxDate = new Date(now.getTime() + criteria.maxTimeToExpiry * 24 * 60 * 60 * 1000);

      return dates
        .map((date: string) => new Date(date))
        .filter((date: Date) => date >= minDate && date <= maxDate)
        .slice(0, 5); // Limit to first 5 valid dates
    } catch (error) {
      logger.warn(`Could not get expiration dates for ${symbol}, using defaults`);
      
      // Fallback: generate common LEAP expiration dates
      const dates = [];
      const now = new Date();
      
      // Next January (annual LEAP expiration)
      const nextJan = new Date(now.getFullYear() + 1, 0, 15); // 3rd Friday of January
      if (nextJan.getTime() - now.getTime() >= criteria.minTimeToExpiry * 24 * 60 * 60 * 1000) {
        dates.push(nextJan);
      }
      
      // January after next
      const jan2 = new Date(now.getFullYear() + 2, 0, 15);
      if (jan2.getTime() - now.getTime() <= criteria.maxTimeToExpiry * 24 * 60 * 60 * 1000) {
        dates.push(jan2);
      }
      
      return dates;
    }
  }

  async updateSignal(signalId: string, updates: Partial<TradingSignal>): Promise<void> {
    const signal = this.activeSignals.get(signalId);
    if (!signal) {
      throw new Error(`Signal ${signalId} not found`);
    }

    const updatedSignal = { ...signal, ...updates };
    this.activeSignals.set(signalId, updatedSignal);

    logger.info(`Signal ${signalId} updated`);
  }

  async removeSignal(signalId: string): Promise<void> {
    if (this.activeSignals.delete(signalId)) {
      logger.info(`Signal ${signalId} removed`);
    } else {
      logger.warn(`Signal ${signalId} not found for removal`);
    }
  }

  getActiveSignals(): TradingSignal[] {
    return Array.from(this.activeSignals.values());
  }

  getStrategyConfig(strategyType: string): StrategyConfig | undefined {
    return this.strategyConfigs.get(strategyType);
  }

  async evaluateExistingPositions(positions: any[]): Promise<{
    hold: string[];
    close: string[];
    adjust: string[];
  }> {
    const recommendations = {
      hold: [] as string[],
      close: [] as string[],
      adjust: [] as string[]
    };

    for (const position of positions) {
      try {
        const evaluation = await this.evaluatePosition(position);
        
        switch (evaluation.action) {
          case 'hold':
            recommendations.hold.push(position.id);
            break;
          case 'close':
            recommendations.close.push(position.id);
            break;
          case 'adjust':
            recommendations.adjust.push(position.id);
            break;
        }
      } catch (error) {
        logger.warn(`Failed to evaluate position ${position.id}:`, error);
      }
    }

    return recommendations;
  }

  private async evaluatePosition(position: any): Promise<{ action: string; reason: string }> {
    const timeToExpiry = (new Date(position.expirationDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    const currentPnL = parseFloat(position.pnl || '0');
    const pnlPercent = parseFloat(position.pnlPercent || '0');

    // Get current market conditions
    const quote = await this.config.dataClients.tradier.getQuote(position.symbol);
    const fundamentalScore = await this.fundamentalScreener.analyzeSymbol(position.symbol);
    const technicalScore = await this.technicalScreener.analyzeSymbol(position.symbol);

    // Decision logic
    if (pnlPercent >= 50) {
      return { action: 'close', reason: 'Profit target reached' };
    }

    if (pnlPercent <= -25) {
      return { action: 'close', reason: 'Stop loss triggered' };
    }

    if (timeToExpiry < 30) {
      return { action: 'close', reason: 'Approaching expiration' };
    }

    if (fundamentalScore.score < 5.0 || technicalScore.score < 5.0) {
      return { action: 'close', reason: 'Deteriorating conditions' };
    }

    if (Math.abs(parseFloat(position.delta)) < 0.30 && position.strategy === 'Stock Replacement') {
      return { action: 'adjust', reason: 'Delta too low, consider rolling' };
    }

    return { action: 'hold', reason: 'Position within parameters' };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeSignals: this.activeSignals.size,
      strategies: Array.from(this.strategyConfigs.keys()),
      lastAnalysis: new Date()
    };
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.activeSignals.clear();
    logger.info('LEAPS strategy stopped');
  }
}
