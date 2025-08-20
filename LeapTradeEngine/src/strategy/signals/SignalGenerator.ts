import { TradingSignal, Quote, FundamentalMetrics, TechnicalMetrics, StrategyConfig } from '../../types';
import { FundamentalScreener } from '../screening/FundamentalScreener';
import { TechnicalScreener } from '../screening/TechnicalScreener';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/helpers';

export interface SignalGeneratorConfig {
  fundamentalScreener: FundamentalScreener;
  technicalScreener: TechnicalScreener;
  dataClients: {
    twelvedata: any;
    alpaca: any;
    tradier: any;
  };
}

export interface SignalContext {
  symbol: string;
  strategy: string;
  option: any;
  quote: Quote;
  fundamentalScore: number;
  technicalScore: number;
  strategyConfig: StrategyConfig;
}

export class SignalGenerator {
  private fundamentalScreener: FundamentalScreener;
  private technicalScreener: TechnicalScreener;
  private dataClients: any;

  constructor(config: SignalGeneratorConfig) {
    this.fundamentalScreener = config.fundamentalScreener;
    this.technicalScreener = config.technicalScreener;
    this.dataClients = config.dataClients;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing signal generator...');
    logger.info('Signal generator initialized');
  }

  async generateSignal(context: SignalContext): Promise<TradingSignal | null> {
    try {
      const {
        symbol,
        strategy,
        option,
        quote,
        fundamentalScore,
        technicalScore,
        strategyConfig
      } = context;

      // Calculate strategy-specific metrics
      const strategyMetrics = await this.calculateStrategyMetrics(context);
      
      // Determine signal action
      const action = this.determineSignalAction(strategyMetrics, strategyConfig);
      if (!action) {
        return null;
      }

      // Calculate confidence score
      const confidence = this.calculateConfidence(context, strategyMetrics);
      
      // Calculate target and stop prices
      const priceTargets = this.calculatePriceTargets(context, strategyMetrics);
      
      // Generate reasoning
      const reasoning = this.generateReasoning(context, strategyMetrics, action);

      const signal: TradingSignal = {
        id: generateId(),
        symbol,
        strategy,
        action,
        confidence,
        targetPrice: priceTargets.target,
        stopPrice: priceTargets.stop,
        reasoning,
        fundamentalScore,
        technicalScore,
        riskScore: this.calculateRiskScore(context, strategyMetrics),
        expectedReturn: priceTargets.expectedReturn,
        timeHorizon: this.calculateTimeHorizon(option.expiration),
        createdAt: new Date()
      };

      logger.info(`Generated signal: ${signal.id} for ${symbol} (${strategy}) with ${confidence.toFixed(1)}% confidence`);
      return signal;
    } catch (error) {
      logger.error('Error generating signal:', error);
      return null;
    }
  }

  private async calculateStrategyMetrics(context: SignalContext): Promise<any> {
    const { symbol, option, quote, strategyConfig } = context;
    
    const timeToExpiry = (option.expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000); // days
    const moneyness = option.strike / quote.price;
    const intrinsicValue = Math.max(0, 
      option.optionType === 'call' ? quote.price - option.strike : option.strike - quote.price
    );
    const timeValue = option.lastPrice - intrinsicValue;
    
    // Get historical volatility for comparison
    const historicalData = await this.dataClients.twelvedata.getHistoricalData(symbol, '3month');
    const historicalVol = this.calculateHistoricalVolatility(historicalData.data);

    return {
      timeToExpiry,
      moneyness,
      intrinsicValue,
      timeValue,
      historicalVolatility: historicalVol,
      ivRank: this.calculateIVRank(option.impliedVolatility, historicalVol),
      liquidityScore: this.calculateLiquidityScore(option),
      deltaAdjustedPrice: option.lastPrice / Math.abs(option.delta || 0.5),
      timeDecayRate: option.theta / option.lastPrice,
      volatilityEdge: option.impliedVolatility - historicalVol
    };
  }

  private calculateHistoricalVolatility(prices: any[]): number {
    if (prices.length < 20) return 0.25; // Default 25%

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i].close / prices[i-1].close));
    }

    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private calculateIVRank(impliedVol: number, historicalVol: number): number {
    // Simplified IV rank - in production, you'd use 52-week IV range
    return Math.min(100, Math.max(0, (impliedVol / historicalVol - 0.8) * 250));
  }

  private calculateLiquidityScore(option: any): number {
    const bidAskSpread = (option.ask - option.bid) / option.lastPrice;
    const volumeScore = Math.min(10, option.volume / 100);
    const openInterestScore = Math.min(10, option.openInterest / 500);
    const spreadScore = Math.max(0, 10 - bidAskSpread * 100);

    return (volumeScore + openInterestScore + spreadScore) / 3;
  }

  private determineSignalAction(metrics: any, config: StrategyConfig): 'buy' | 'sell' | 'hold' | null {
    const { type } = config;
    
    switch (type) {
      case 'long_call_leaps':
        return this.determineLongCallLeapsAction(metrics);
      case 'protective_put':
        return this.determineProtectivePutAction(metrics);
      default:
        return null;
    }
  }

  private determineLongCallLeapsAction(metrics: any): 'buy' | 'sell' | 'hold' | null {
    // Long Call LEAPS strategy - flexible delta range for various market outlooks
    if (metrics.liquidityScore > 4 && // Reasonable liquidity
        metrics.timeToExpiry > 365 && // True LEAPS (1+ year)
        metrics.ivRank < 80 && // Not excessively expensive
        ((metrics.moneyness >= 0.85 && metrics.moneyness <= 1.15) || // ITM to slightly OTM range
         (metrics.moneyness < 0.85 && metrics.ivRank < 60))) { // Deep ITM with reasonable IV
      return 'buy';
    }
    return null;
  }

  private determineProtectivePutAction(metrics: any): 'buy' | 'sell' | 'hold' | null {
    // Enhanced protective put strategy - flexible protection levels
    if (metrics.liquidityScore > 4 && // Reasonable liquidity 
        metrics.timeToExpiry > 90 && // At least 3 months
        metrics.timeToExpiry < 730 && // Up to 2 years
        metrics.ivRank < 85 && // Not excessively expensive
        ((metrics.moneyness >= 0.85 && metrics.moneyness <= 0.98) || // Standard OTM protection
         (metrics.moneyness < 0.85 && metrics.ivRank < 60))) { // Deep OTM with reasonable IV
      return 'buy';
    }
    return null;
  }

  private calculateConfidence(context: SignalContext, metrics: any): number {
    const { fundamentalScore, technicalScore, strategyConfig } = context;
    
    let confidence = 0;

    // Fundamental component (30%)
    confidence += fundamentalScore * 3;

    // Technical component (30%)
    confidence += technicalScore * 3;

    // Strategy-specific metrics (40%)
    const strategyScore = this.calculateStrategyScore(context, metrics);
    confidence += strategyScore * 4;

    // Adjustments based on market conditions
    const marketAdjustment = this.calculateMarketAdjustment(metrics);
    confidence *= marketAdjustment;

    return Math.max(0, Math.min(10, confidence));
  }

  private calculateStrategyScore(context: SignalContext, metrics: any): number {
    const { strategyConfig } = context;
    let score = 5; // Base score

    // Liquidity adjustment
    score += (metrics.liquidityScore - 5) * 0.3;

    // Time value preservation
    if (metrics.timeToExpiry > 180) {
      score += 1; // LEAPS benefit from longer time
    }

    // IV edge
    if (Math.abs(metrics.volatilityEdge) < 0.05) {
      score += 0.5; // Fair IV
    } else if (metrics.volatilityEdge < -0.1) {
      score += 1; // Cheap options
    }

    // Moneyness appropriateness for strategy
    const idealMoneyness = this.getIdealMoneyness(strategyConfig.type);
    const moneynessDeviation = Math.abs(metrics.moneyness - idealMoneyness);
    score -= moneynessDeviation * 2;

    return Math.max(0, Math.min(10, score));
  }

  private getIdealMoneyness(strategyType: string): number {
    switch (strategyType) {
      case 'long_call_leaps': return 0.95; // Slightly ITM to ATM for balance
      case 'protective_put': return 0.90; // Slightly OTM for cost efficiency
      default: return 1.00;
    }
  }

  private calculateMarketAdjustment(metrics: any): number {
    let adjustment = 1.0;

    // High volatility penalty for long strategies
    if (metrics.ivRank > 80) {
      adjustment *= 0.9;
    }

    // Low liquidity penalty
    if (metrics.liquidityScore < 4) {
      adjustment *= 0.8;
    }

    // Very short time penalty for LEAPS
    if (metrics.timeToExpiry < 90) {
      adjustment *= 0.85;
    }

    return adjustment;
  }

  private calculatePriceTargets(context: SignalContext, metrics: any): {
    target: number;
    stop: number;
    expectedReturn: number;
  } {
    const { quote, option, strategyConfig } = context;
    const currentPrice = quote.price;
    
    let targetPrice: number;
    let stopPrice: number;

    switch (strategyConfig.type) {
      case 'long_call_leaps':
        targetPrice = currentPrice * (1 + strategyConfig.riskParams.profitTarget);
        stopPrice = currentPrice * (1 - strategyConfig.riskParams.stopLoss);
        break;
      case 'protective_put':
        targetPrice = currentPrice * 1.15; // Moderate upside target with protection
        stopPrice = option.strike * 0.98; // Just below put strike for protection
        break;
      default:
        targetPrice = currentPrice * 1.15;
        stopPrice = currentPrice * 0.85;
    }

    const expectedReturn = ((targetPrice - currentPrice) / currentPrice) * 100;

    return {
      target: Math.round(targetPrice * 100) / 100,
      stop: Math.round(stopPrice * 100) / 100,
      expectedReturn: Math.round(expectedReturn * 100) / 100
    };
  }

  private calculateRiskScore(context: SignalContext, metrics: any): number {
    let riskScore = 5; // Baseline moderate risk

    // Time decay risk
    if (metrics.timeToExpiry < 60) {
      riskScore += 2;
    } else if (metrics.timeToExpiry > 365) {
      riskScore -= 1;
    }

    // Volatility risk
    if (metrics.ivRank > 70) {
      riskScore += 1;
    } else if (metrics.ivRank < 30) {
      riskScore -= 1;
    }

    // Liquidity risk
    if (metrics.liquidityScore < 4) {
      riskScore += 2;
    } else if (metrics.liquidityScore > 7) {
      riskScore -= 1;
    }

    // Moneyness risk
    if (metrics.moneyness < 0.70 || metrics.moneyness > 1.30) {
      riskScore += 1;
    }

    return Math.max(1, Math.min(10, riskScore));
  }

  private calculateTimeHorizon(expiration: Date): number {
    return Math.ceil((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }

  private generateReasoning(context: SignalContext, metrics: any, action: string): string {
    const { symbol, strategy, fundamentalScore, technicalScore } = context;
    
    let reasoning = `${action.toUpperCase()} ${symbol} ${strategy}: `;
    
    // Add fundamental reasoning
    if (fundamentalScore > 7) {
      reasoning += "Strong fundamentals with solid financials. ";
    } else if (fundamentalScore > 5) {
      reasoning += "Decent fundamental backdrop. ";
    }

    // Add technical reasoning
    if (technicalScore > 7) {
      reasoning += "Positive technical setup with favorable momentum. ";
    } else if (technicalScore > 5) {
      reasoning += "Neutral to positive technical indicators. ";
    }

    // Add strategy-specific reasoning
    switch (strategy) {
      case 'Long Call LEAPS':
        const leverageRatio = metrics.moneyness < 1 ? (1 / metrics.moneyness).toFixed(1) : 'Moderate';
        reasoning += `LEAPS call provides ${leverageRatio}x leverage exposure with ${metrics.timeToExpiry.toFixed(0)} days to expiration. `;
        if (metrics.moneyness < 0.9) {
          reasoning += 'Deep ITM position offers stock-like exposure with lower capital requirement. ';
        } else if (metrics.moneyness > 1.1) {
          reasoning += 'OTM position offers high leverage potential with controlled risk. ';
        }
        break;
      case 'Protective Put':
        const protectionLevel = (100 - metrics.moneyness * 100).toFixed(0);
        reasoning += `Downside protection ${protectionLevel}% below current price with ${metrics.timeToExpiry.toFixed(0)} days coverage. `;
        reasoning += `Insurance cost represents ${((1 - metrics.moneyness) * 100).toFixed(1)}% of position value. `;
        break;
    }

    // Add risk factors if present
    if (metrics.liquidityScore < 5) {
      reasoning += " Note: Limited liquidity may impact execution.";
    }
    if (metrics.ivRank > 80) {
      reasoning += " Caution: Elevated implied volatility.";
    }

    return reasoning;
  }
}
