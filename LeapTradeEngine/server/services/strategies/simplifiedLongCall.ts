import { InsertTradingSignal } from "@shared/schema";
import { SignalContext } from "../signalGenerator";

export class SimplifiedLongCallStrategy {
  async generateSignal(context: SignalContext): Promise<InsertTradingSignal | null> {
    const { symbol, marketData, optionChain, fundamentalScore, technicalScore, strategyConfig } = context;
    
    // Filter for LEAP calls (365+ days to expiration) with flexible delta range
    const leapCalls = optionChain.filter(option => 
      option.type === 'call' && 
      this.getDaysToExpiration(option.expiration) >= 365 &&
      this.getDaysToExpiration(option.expiration) <= 1095 && // Max 3 years
      option.delta >= 0.50 && option.delta <= 0.85 // Flexible delta range
    );
    
    if (leapCalls.length === 0) {
      return null;
    }
    
    // Find the best LEAP call option
    const bestOption = this.findBestLongCallOption(leapCalls, marketData.price);
    if (!bestOption) {
      return null;
    }
    
    // Calculate confidence based on multiple factors
    const confidence = this.calculateConfidence(context, bestOption);
    
    // Enhanced threshold for long calls (higher requirement)
    if (confidence < 6.5) {
      return null;
    }
    
    const riskScore = this.calculateRiskScore(context, bestOption);
    const expectedReturn = this.calculateExpectedReturn(bestOption, marketData.price);
    const timeHorizon = this.getDaysToExpiration(bestOption.expiration);
    
    return {
      symbol,
      strategy: 'long_call_leaps',
      action: 'buy',
      confidence,
      targetPrice: marketData.price * 1.25, // 25% upside target
      stopPrice: marketData.price * 0.70, // 30% stop loss (option premium loss)
      reasoning: this.generateReasoning(context, bestOption),
      fundamentalScore,
      technicalScore,
      riskScore,
      expectedReturn,
      timeHorizon,
      createdAt: new Date(),
    };
  }
  
  private findBestLongCallOption(options: any[], stockPrice: number): any | null {
    // Score options based on multiple factors for long LEAPS calls
    const scoredOptions = options.map(option => {
      const moneyness = option.strike / stockPrice;
      const timeValue = option.ask - Math.max(0, stockPrice - option.strike);
      const liquidityScore = this.calculateLiquidityScore(option);
      const leverage = this.calculateLeverage(option, stockPrice);
      
      // Scoring weights for long calls
      const deltaScore = this.scoreDelta(option.delta); // 30%
      const moneynessScore = this.scoreMoneyness(moneyness); // 25%
      const timeValueScore = this.scoreTimeValue(timeValue, option.ask); // 20%
      const liquidityWeight = liquidityScore * 0.15; // 15%
      const leverageScore = this.scoreLeverage(leverage) * 0.10; // 10%
      
      const totalScore = 
        deltaScore * 0.30 + 
        moneynessScore * 0.25 + 
        timeValueScore * 0.20 + 
        liquidityWeight + 
        leverageScore;
      
      return { option, score: totalScore, leverage, moneyness };
    });
    
    scoredOptions.sort((a, b) => b.score - a.score);
    return scoredOptions[0]?.option || null;
  }
  
  private scoreDelta(delta: number): number {
    // Optimal delta range for long calls: 0.60-0.80
    if (delta >= 0.60 && delta <= 0.80) {
      return 10; // Perfect range
    } else if (delta >= 0.50 && delta < 0.60) {
      return 8; // Good but lower leverage
    } else if (delta > 0.80 && delta <= 0.90) {
      return 7; // High delta, expensive but safe
    } else {
      return 4; // Outside optimal range
    }
  }
  
  private scoreMoneyness(moneyness: number): number {
    // Prefer slightly ITM to ATM calls for LEAPS
    if (moneyness >= 0.95 && moneyness <= 1.05) {
      return 10; // ATM to slightly ITM/OTM
    } else if (moneyness >= 0.85 && moneyness < 0.95) {
      return 9; // ITM with good leverage
    } else if (moneyness > 1.05 && moneyness <= 1.15) {
      return 8; // Slightly OTM
    } else if (moneyness < 0.85) {
      return 6; // Deep ITM, less leverage
    } else {
      return 4; // Too far OTM
    }
  }
  
  private scoreTimeValue(timeValue: number, optionPrice: number): number {
    const timeValuePercent = timeValue / optionPrice;
    // Prefer reasonable time value (not too expensive)
    if (timeValuePercent >= 0.20 && timeValuePercent <= 0.40) {
      return 10; // Reasonable time premium
    } else if (timeValuePercent >= 0.10 && timeValuePercent < 0.20) {
      return 8; // Low time premium
    } else if (timeValuePercent > 0.40 && timeValuePercent <= 0.60) {
      return 6; // High time premium
    } else {
      return 3; // Very expensive or very cheap (suspicious)
    }
  }
  
  private scoreLeverage(leverage: number): number {
    // Optimal leverage for LEAPS: 3-8x
    if (leverage >= 3 && leverage <= 8) {
      return 10;
    } else if (leverage >= 2 && leverage < 3) {
      return 7;
    } else if (leverage > 8 && leverage <= 12) {
      return 7;
    } else {
      return 4;
    }
  }
  
  private calculateLeverage(option: any, stockPrice: number): number {
    return stockPrice / option.ask;
  }
  
  private calculateLiquidityScore(option: any): number {
    const bidAskSpread = option.ask - option.bid;
    const spreadPercent = bidAskSpread / option.ask;
    const volumeScore = Math.min(5, (option.volume || 0) / 20);
    const openInterestScore = Math.min(5, (option.openInterest || 0) / 100);
    
    // Penalty for wide spreads
    const spreadPenalty = Math.max(0, 5 - spreadPercent * 50);
    
    return volumeScore + openInterestScore + spreadPenalty;
  }
  
  private calculateConfidence(context: SignalContext, option: any): number {
    const { fundamentalScore, technicalScore, marketData } = context;
    
    let confidence = 0;
    
    // Fundamental strength is important for long positions (35%)
    confidence += fundamentalScore * 0.35;
    
    // Technical momentum supports long calls (30%)
    confidence += technicalScore * 0.30;
    
    // Option-specific factors (35%)
    const leverage = this.calculateLeverage(option, marketData.price);
    const leverageScore = this.scoreLeverage(leverage) / 10 * 0.15;
    
    const deltaScore = this.scoreDelta(option.delta) / 10 * 0.10;
    
    const liquidityScore = this.calculateLiquidityScore(option) / 15 * 0.10;
    
    confidence += leverageScore + deltaScore + liquidityScore;
    
    return Math.max(0, Math.min(10, confidence));
  }
  
  private calculateRiskScore(context: SignalContext, option: any): number {
    let risk = 5; // Base moderate risk for long options
    
    const timeToExp = this.getDaysToExpiration(option.expiration);
    if (timeToExp < 500) risk += 1; // Shorter LEAPS have higher risk
    
    const liquidityScore = this.calculateLiquidityScore(option);
    if (liquidityScore < 8) risk += 1;
    
    const leverage = this.calculateLeverage(option, context.marketData.price);
    if (leverage > 10) risk += 1; // High leverage = higher risk
    
    if (option.impliedVolatility > 0.50) risk += 1; // High IV = expensive
    
    // Fundamental/technical risk
    if (context.fundamentalScore < 6) risk += 1;
    if (context.technicalScore < 6) risk += 1;
    
    return Math.max(1, Math.min(10, risk));
  }
  
  private calculateExpectedReturn(option: any, stockPrice: number): number {
    const leverage = this.calculateLeverage(option, stockPrice);
    const expectedStockReturn = 0.20; // Assume 20% stock appreciation over LEAPS horizon
    return expectedStockReturn * leverage;
  }
  
  private getDaysToExpiration(expiration: Date): number {
    return Math.floor((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }
  
  private generateReasoning(context: SignalContext, option: any): string {
    const { symbol, marketData, fundamentalScore, technicalScore } = context;
    const leverage = Math.round(this.calculateLeverage(option, marketData.price) * 10) / 10;
    const days = this.getDaysToExpiration(option.expiration);
    const moneyness = option.strike / marketData.price;
    
    let reasoning = `Long Call LEAPS on ${symbol}: `;
    
    // Position characteristics
    reasoning += `${leverage}x leverage with ${days} days to expiration. `;
    
    if (moneyness < 1.0) {
      reasoning += `ITM call at $${option.strike} provides intrinsic value protection. `;
    } else if (moneyness <= 1.1) {
      reasoning += `Near-money call at $${option.strike} offers balanced risk/reward. `;
    } else {
      reasoning += `OTM call at $${option.strike} provides maximum leverage potential. `;
    }
    
    // Fundamental support
    if (fundamentalScore > 7.5) {
      reasoning += "Excellent fundamentals support long-term growth thesis. ";
    } else if (fundamentalScore > 6.5) {
      reasoning += "Strong fundamentals justify long position. ";
    } else if (fundamentalScore > 5.5) {
      reasoning += "Adequate fundamentals for leveraged position. ";
    }
    
    // Technical support
    if (technicalScore > 7.5) {
      reasoning += "Strong technical momentum favors call options. ";
    } else if (technicalScore > 6.5) {
      reasoning += "Positive technical setup supports upside. ";
    }
    
    // Risk factors
    if (option.impliedVolatility > 0.40) {
      reasoning += "Note: Elevated IV increases option premium. ";
    }
    
    const liquidityScore = this.calculateLiquidityScore(option);
    if (liquidityScore < 8) {
      reasoning += "Consider wider spreads due to lower liquidity. ";
    }
    
    return reasoning.trim();
  }
}