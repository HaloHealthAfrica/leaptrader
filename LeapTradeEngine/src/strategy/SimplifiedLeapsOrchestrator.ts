import { TradingSignal, Quote, FundamentalMetrics, TechnicalMetrics } from '../types';
import { FundamentalScreener } from './screening/FundamentalScreener';
import { TechnicalScreener } from './screening/TechnicalScreener';
import { SignalGenerator, SignalContext } from './signals/SignalGenerator';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';

/**
 * Simplified LEAPS Orchestrator - Focused on Long Calls and Protective Puts
 * Optimized workflow for the two core strategies
 */
export interface SimplifiedLeapsConfig {
  dataClients: {
    twelvedata: any;
    alpaca: any;
    tradier: any;
  };
  preferences: {
    longCallWeight: number; // 0.0 to 1.0 - allocation preference for long calls
    protectionLevel: 'conservative' | 'moderate' | 'aggressive'; // Put protection aggressiveness
    timeHorizonPreference: 'long' | 'mixed'; // LEAPS time horizon preference
    maxPositionsPerSymbol: number;
  };
  riskLimits: {
    maxSinglePositionSize: number;
    maxTotalAllocation: number;
    minLiquidityScore: number;
    maxIVThreshold: number;
  };
}

export interface StrategyRecommendation {
  symbol: string;
  primaryStrategy: 'long_call' | 'protective_put' | 'both';
  callSignal?: TradingSignal;
  putSignal?: TradingSignal;
  reasoning: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  timeHorizon: number;
  totalCapitalRequired: number;
}

export class SimplifiedLeapsOrchestrator {
  private fundamentalScreener: FundamentalScreener;
  private technicalScreener: TechnicalScreener;
  private signalGenerator: SignalGenerator;
  private isInitialized = false;

  // Strategy performance weights
  private readonly strategyWeights = {
    longCall: {
      fundamentalMin: 6.5, // Higher fundamental requirement for long positions
      technicalMin: 6.0,
      ivRankMax: 75,
      liquidityMin: 5
    },
    protectivePut: {
      fundamentalMin: 5.5, // Lower requirement since it's protection
      technicalMin: 4.0, // Can use puts even in poor technical environment
      ivRankMax: 85,
      liquidityMin: 4
    }
  };

  constructor(private config: SimplifiedLeapsConfig) {
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
      logger.info('Initializing Simplified LEAPS Orchestrator...');
      
      await this.fundamentalScreener.initialize();
      await this.technicalScreener.initialize();
      await this.signalGenerator.initialize();

      this.isInitialized = true;
      logger.info('Simplified LEAPS Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Simplified LEAPS Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Generate recommendations for a list of symbols
   */
  async generateRecommendations(symbols: string[]): Promise<StrategyRecommendation[]> {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized');
    }

    const recommendations: StrategyRecommendation[] = [];

    logger.info(`Generating simplified LEAPS recommendations for ${symbols.length} symbols`);

    for (const symbol of symbols) {
      try {
        const recommendation = await this.analyzeSymbolForRecommendation(symbol);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      } catch (error) {
        logger.warn(`Failed to analyze ${symbol}:`, error);
      }
    }

    // Sort by confidence and risk-adjusted return
    recommendations.sort((a, b) => {
      const aScore = a.confidence * (a.riskLevel === 'low' ? 1.2 : a.riskLevel === 'medium' ? 1.0 : 0.8);
      const bScore = b.confidence * (b.riskLevel === 'low' ? 1.2 : b.riskLevel === 'medium' ? 1.0 : 0.8);
      return bScore - aScore;
    });

    logger.info(`Generated ${recommendations.length} recommendations`);
    return recommendations;
  }

  /**
   * Analyze a single symbol and determine the best strategy approach
   */
  private async analyzeSymbolForRecommendation(symbol: string): Promise<StrategyRecommendation | null> {
    const cacheKey = `recommendation:${symbol}`;
    const cached = cache.get<StrategyRecommendation>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get fundamental and technical analysis
      const [fundamentalMetrics, technicalMetrics] = await Promise.all([
        this.fundamentalScreener.analyzeSymbol(symbol),
        this.technicalScreener.analyzeSymbol(symbol)
      ]);

      // Early exit if scores are too low
      if (fundamentalMetrics.score < 4.0 && technicalMetrics.score < 4.0) {
        return null;
      }

      // Get market data
      const quote = await this.config.dataClients.tradier.getQuote(symbol);
      
      // Determine strategy suitability
      const strategySuitability = this.evaluateStrategySuitability(
        fundamentalMetrics, 
        technicalMetrics
      );

      // Generate signals for applicable strategies
      const signals = await this.generateApplicableSignals(
        symbol,
        quote,
        fundamentalMetrics,
        technicalMetrics,
        strategySuitability
      );

      if (signals.callSignal || signals.putSignal) {
        const recommendation = this.createRecommendation(
          symbol,
          signals,
          fundamentalMetrics,
          technicalMetrics,
          strategySuitability
        );

        cache.set(cacheKey, recommendation, 1800); // Cache for 30 minutes
        return recommendation;
      }

      return null;
    } catch (error) {
      logger.error(`Error analyzing ${symbol} for recommendation:`, error);
      return null;
    }
  }

  /**
   * Evaluate which strategies are suitable for the given market conditions
   */
  private evaluateStrategySuitability(
    fundamental: FundamentalMetrics,
    technical: TechnicalMetrics
  ): { longCallSuitable: boolean; protectivePutSuitable: boolean } {
    const longCallSuitable = 
      fundamental.score >= this.strategyWeights.longCall.fundamentalMin &&
      technical.score >= this.strategyWeights.longCall.technicalMin;

    const protectivePutSuitable = 
      fundamental.score >= this.strategyWeights.protectivePut.fundamentalMin &&
      technical.score >= this.strategyWeights.protectivePut.technicalMin;

    return { longCallSuitable, protectivePutSuitable };
  }

  /**
   * Generate signals for applicable strategies
   */
  private async generateApplicableSignals(
    symbol: string,
    quote: Quote,
    fundamental: FundamentalMetrics,
    technical: TechnicalMetrics,
    suitability: { longCallSuitable: boolean; protectivePutSuitable: boolean }
  ): Promise<{ callSignal?: TradingSignal; putSignal?: TradingSignal }> {
    const signals: { callSignal?: TradingSignal; putSignal?: TradingSignal } = {};

    // Get option chains for analysis (mock implementation)
    const optionChains = await this.getOptionChainsForAnalysis(symbol);

    // Generate long call signal if suitable
    if (suitability.longCallSuitable && optionChains.calls.length > 0) {
      const bestCall = this.selectBestCallOption(optionChains.calls, quote.price);
      if (bestCall) {
        const callContext: SignalContext = {
          symbol,
          strategy: 'Long Call LEAPS',
          option: bestCall,
          quote,
          fundamentalScore: fundamental.score,
          technicalScore: technical.score,
          strategyConfig: {
            name: 'Long Call LEAPS',
            type: 'long_call_leaps',
            criteria: {
              minTimeToExpiry: 365,
              maxTimeToExpiry: 1095,
              minDelta: 0.50,
              maxDelta: 0.85,
              minImpliedVolatility: 0.15,
              maxImpliedVolatility: 0.50,
              minLiquidity: 50
            },
            riskParams: {
              maxPositionSize: 0.20,
              stopLoss: 0.30,
              profitTarget: 0.75
            }
          }
        };

        signals.callSignal = await this.signalGenerator.generateSignal(callContext);
      }
    }

    // Generate protective put signal if suitable
    if (suitability.protectivePutSuitable && optionChains.puts.length > 0) {
      const bestPut = this.selectBestPutOption(optionChains.puts, quote.price);
      if (bestPut) {
        const putContext: SignalContext = {
          symbol,
          strategy: 'Protective Put',
          option: bestPut,
          quote,
          fundamentalScore: fundamental.score,
          technicalScore: technical.score,
          strategyConfig: {
            name: 'Protective Put',
            type: 'protective_put',
            criteria: {
              minTimeToExpiry: 90,
              maxTimeToExpiry: 730,
              minDelta: -0.40,
              maxDelta: -0.10,
              minImpliedVolatility: 0.15,
              maxImpliedVolatility: 0.50,
              minLiquidity: 50
            },
            riskParams: {
              maxPositionSize: 0.15,
              stopLoss: 0.50,
              profitTarget: 0.20
            }
          }
        };

        signals.putSignal = await this.signalGenerator.generateSignal(putContext);
      }
    }

    return signals;
  }

  /**
   * Create final recommendation from generated signals
   */
  private createRecommendation(
    symbol: string,
    signals: { callSignal?: TradingSignal; putSignal?: TradingSignal },
    fundamental: FundamentalMetrics,
    technical: TechnicalMetrics,
    suitability: { longCallSuitable: boolean; protectivePutSuitable: boolean }
  ): StrategyRecommendation {
    const { callSignal, putSignal } = signals;
    
    // Determine primary strategy based on signals and preferences
    let primaryStrategy: 'long_call' | 'protective_put' | 'both';
    let confidence: number;
    let totalCapital = 0;

    if (callSignal && putSignal) {
      // Both strategies viable - use preferences
      if (this.config.preferences.longCallWeight > 0.6) {
        primaryStrategy = 'long_call';
        confidence = callSignal.confidence;
      } else if (this.config.preferences.longCallWeight < 0.4) {
        primaryStrategy = 'protective_put';
        confidence = putSignal.confidence;
      } else {
        primaryStrategy = 'both';
        confidence = (callSignal.confidence + putSignal.confidence) / 2;
      }
    } else if (callSignal) {
      primaryStrategy = 'long_call';
      confidence = callSignal.confidence;
    } else if (putSignal) {
      primaryStrategy = 'protective_put';
      confidence = putSignal.confidence;
    } else {
      throw new Error('No viable signals generated');
    }

    // Calculate capital requirements
    if (callSignal) {
      totalCapital += this.estimateOptionCost(callSignal);
    }
    if (putSignal) {
      totalCapital += this.estimateOptionCost(putSignal);
    }

    // Determine risk level
    const riskLevel = this.assessRiskLevel(fundamental, technical, signals);
    
    // Generate reasoning
    const reasoning = this.generateRecommendationReasoning(
      symbol,
      primaryStrategy,
      fundamental,
      technical,
      signals
    );

    // Calculate time horizon
    const timeHorizon = Math.max(
      callSignal?.timeHorizon || 0,
      putSignal?.timeHorizon || 0
    );

    return {
      symbol,
      primaryStrategy,
      callSignal,
      putSignal,
      reasoning,
      confidence,
      riskLevel,
      timeHorizon,
      totalCapitalRequired: totalCapital
    };
  }

  /**
   * Mock function to get option chains - replace with real implementation
   */
  private async getOptionChainsForAnalysis(symbol: string): Promise<{
    calls: any[];
    puts: any[];
  }> {
    // Mock implementation - replace with real option chain data
    return {
      calls: [
        {
          strike: 100,
          expiration: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
          bid: 8.50,
          ask: 8.80,
          last: 8.65,
          volume: 150,
          openInterest: 2500,
          delta: 0.65,
          impliedVolatility: 0.28,
          optionType: 'call'
        }
      ],
      puts: [
        {
          strike: 95,
          expiration: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          bid: 3.20,
          ask: 3.40,
          last: 3.30,
          volume: 80,
          openInterest: 1200,
          delta: -0.25,
          impliedVolatility: 0.26,
          optionType: 'put'
        }
      ]
    };
  }

  private selectBestCallOption(calls: any[], stockPrice: number): any | null {
    // Simple selection logic - prefer slightly ITM to ATM calls with good liquidity
    return calls
      .filter(call => call.volume > 50 && call.openInterest > 500)
      .sort((a, b) => Math.abs(a.strike - stockPrice) - Math.abs(b.strike - stockPrice))[0] || null;
  }

  private selectBestPutOption(puts: any[], stockPrice: number): any | null {
    // Simple selection logic - prefer OTM puts with reasonable cost
    return puts
      .filter(put => put.strike < stockPrice * 0.95 && put.volume > 30)
      .sort((a, b) => b.strike - a.strike)[0] || null;
  }

  private estimateOptionCost(signal: TradingSignal): number {
    // Mock implementation - estimate based on signal data
    return 1000; // $1000 per option position
  }

  private assessRiskLevel(
    fundamental: FundamentalMetrics,
    technical: TechnicalMetrics,
    signals: { callSignal?: TradingSignal; putSignal?: TradingSignal }
  ): 'low' | 'medium' | 'high' {
    const avgScore = (fundamental.score + technical.score) / 2;
    const avgRisk = ((signals.callSignal?.riskScore || 5) + (signals.putSignal?.riskScore || 5)) / 2;

    if (avgScore > 7.5 && avgRisk < 4) return 'low';
    if (avgScore > 6.0 && avgRisk < 6) return 'medium';
    return 'high';
  }

  private generateRecommendationReasoning(
    symbol: string,
    primaryStrategy: 'long_call' | 'protective_put' | 'both',
    fundamental: FundamentalMetrics,
    technical: TechnicalMetrics,
    signals: { callSignal?: TradingSignal; putSignal?: TradingSignal }
  ): string {
    let reasoning = `${symbol} analysis: `;

    // Fundamental reasoning
    if (fundamental.score > 7) {
      reasoning += 'Strong fundamental metrics support long-term growth. ';
    } else if (fundamental.score > 5) {
      reasoning += 'Decent fundamentals provide adequate foundation. ';
    }

    // Technical reasoning
    if (technical.score > 7) {
      reasoning += 'Positive technical momentum favors upside strategies. ';
    } else if (technical.score < 5) {
      reasoning += 'Weak technicals suggest defensive positioning. ';
    }

    // Strategy-specific reasoning
    switch (primaryStrategy) {
      case 'long_call':
        reasoning += 'Recommend LEAPS calls for leveraged upside exposure. ';
        break;
      case 'protective_put':
        reasoning += 'Recommend protective puts for downside protection. ';
        break;
      case 'both':
        reasoning += 'Recommend collar strategy with calls and puts for balanced exposure. ';
        break;
    }

    return reasoning;
  }

  getConfiguration(): SimplifiedLeapsConfig {
    return { ...this.config };
  }

  async stop(): Promise<void> {
    this.isInitialized = false;
    logger.info('Simplified LEAPS Orchestrator stopped');
  }
}