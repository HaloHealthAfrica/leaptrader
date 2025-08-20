import { InsertTradingSignal } from "@shared/schema";
import { SignalContext } from "../signalGenerator";

export class CoveredCallStrategy {
  async generateSignal(context: SignalContext): Promise<InsertTradingSignal | null> {
    const { symbol, marketData, optionChain, fundamentalScore, technicalScore, strategyConfig } = context;
    
    // Filter for OTM calls (30-60 days to expiration)
    const shortTermCalls = optionChain.filter(option => 
      option.type === 'call' && 
      this.getDaysToExpiration(option.expiration) >= 30 &&
      this.getDaysToExpiration(option.expiration) <= 60 &&
      option.strike > marketData.price * 1.02 // At least 2% OTM
    );
    
    if (shortTermCalls.length === 0) {
      return null;
    }
    
    // Find the best covered call option
    const bestOption = this.findBestCoveredCallOption(shortTermCalls, marketData.price);
    if (!bestOption) {
      return null;
    }
    
    // Calculate confidence
    const confidence = this.calculateConfidence(context, bestOption);
    
    if (confidence < 6.0) {
      return null;
    }
    
    const riskScore = this.calculateRiskScore(context, bestOption);
    const expectedReturn = this.calculateExpectedReturn(bestOption, marketData.price);
    const timeHorizon = this.getDaysToExpiration(bestOption.expiration);
    
    return {
      symbol,
      strategy: 'covered_call',
      action: 'sell',
      confidence,
      targetPrice: bestOption.strike, // Assignment target
      stopPrice: marketData.price * 0.95, // 5% stop on underlying
      reasoning: this.generateReasoning(context, bestOption),
      fundamentalScore,
      technicalScore,
      riskScore,
      expectedReturn,
      timeHorizon,
      createdAt: new Date(),
    };
  }
  
  private findBestCoveredCallOption(options: any[], stockPrice: number): any | null {
    const scoredOptions = options.map(option => {
      const annualizedReturn = this.calculateAnnualizedReturn(option, stockPrice);
      const liquidityScore = this.calculateLiquidityScore(option);
      const probabilityITM = this.estimateProbabilityITM(option, stockPrice);
      
      // Balance premium collection with assignment probability
      const score = annualizedReturn * 0.6 + liquidityScore * 0.3 - probabilityITM * 0.1;
      
      return { option, score, annualizedReturn };
    });
    
    scoredOptions.sort((a, b) => b.score - a.score);
    return scoredOptions[0]?.option || null;
  }
  
  private calculateAnnualizedReturn(option: any, stockPrice: number): number {
    const premium = option.bid; // Use bid price for conservative estimate
    const daysToExp = this.getDaysToExpiration(option.expiration);
    const returnPercent = premium / stockPrice;
    return (returnPercent * 365 / daysToExp) * 100; // Annualized percentage
  }
  
  private calculateLiquidityScore(option: any): number {
    const bidAskSpread = option.ask - option.bid;
    const spreadPercent = bidAskSpread / option.last;
    const volumeScore = Math.min(5, option.volume / 10);
    const openInterestScore = Math.min(5, option.openInterest / 50);
    
    return Math.max(0, 10 - spreadPercent * 100) * 0.5 + volumeScore + openInterestScore;
  }
  
  private estimateProbabilityITM(option: any, stockPrice: number): number {
    // Simplified probability calculation using delta
    return Math.abs(option.delta) * 100;
  }
  
  private calculateConfidence(context: SignalContext, option: any): number {
    const { fundamentalScore, technicalScore, marketData } = context;
    
    let confidence = 0;
    
    // Lower fundamental score is better for covered calls (neutral outlook)
    confidence += (10 - fundamentalScore) * 0.2;
    
    // Lower technical score is better (sideways/down trending)
    confidence += (10 - technicalScore) * 0.2;
    
    // Premium collection attractiveness (40%)
    const annualizedReturn = this.calculateAnnualizedReturn(option, marketData.price);
    const premiumScore = Math.min(10, annualizedReturn / 3); // Scale to 0-10
    confidence += premiumScore * 0.4;
    
    // Liquidity (20%)
    const liquidityScore = this.calculateLiquidityScore(option);
    confidence += liquidityScore * 0.2;
    
    return Math.max(0, Math.min(10, confidence));
  }
  
  private calculateRiskScore(context: SignalContext, option: any): number {
    let risk = 3; // Lower base risk for covered calls
    
    const probabilityITM = this.estimateProbabilityITM(option, context.marketData.price);
    if (probabilityITM > 30) risk += 2; // Higher assignment risk
    
    const liquidityScore = this.calculateLiquidityScore(option);
    if (liquidityScore < 5) risk += 1;
    
    if (option.impliedVolatility < 0.2) risk += 1; // Low premium environment
    
    return Math.max(1, Math.min(10, risk));
  }
  
  private calculateExpectedReturn(option: any, stockPrice: number): number {
    return this.calculateAnnualizedReturn(option, stockPrice);
  }
  
  private getDaysToExpiration(expiration: Date): number {
    return Math.floor((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }
  
  private generateReasoning(context: SignalContext, option: any): string {
    const { symbol, marketData } = context;
    const annualizedReturn = this.calculateAnnualizedReturn(option, marketData.price);
    const days = this.getDaysToExpiration(option.expiration);
    const otmPercent = ((option.strike - marketData.price) / marketData.price * 100).toFixed(1);
    
    let reasoning = `Covered Call on ${symbol}: `;
    reasoning += `Sell ${otmPercent}% OTM call expiring in ${days} days for ${annualizedReturn.toFixed(1)}% annualized return. `;
    reasoning += `Strike at $${option.strike} provides ${otmPercent}% upside participation while collecting $${option.bid.toFixed(2)} premium. `;
    
    if (option.impliedVolatility > 0.3) {
      reasoning += "Elevated IV enhances premium collection. ";
    }
    
    return reasoning;
  }
}
