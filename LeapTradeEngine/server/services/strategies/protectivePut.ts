import { InsertTradingSignal } from "@shared/schema";
import { SignalContext } from "../signalGenerator";

export class ProtectivePutStrategy {
  async generateSignal(context: SignalContext): Promise<InsertTradingSignal | null> {
    const { symbol, marketData, optionChain, fundamentalScore, technicalScore, strategyConfig } = context;
    
    // Filter for OTM puts (60-180 days to expiration)
    const protectivePuts = optionChain.filter(option => 
      option.type === 'put' && 
      this.getDaysToExpiration(option.expiration) >= 60 &&
      this.getDaysToExpiration(option.expiration) <= 180 &&
      option.strike < marketData.price * 0.98 // At least 2% OTM
    );
    
    if (protectivePuts.length === 0) {
      return null;
    }
    
    // Find the best protective put option
    const bestOption = this.findBestProtectivePutOption(protectivePuts, marketData.price);
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
      strategy: 'protective_put',
      action: 'buy',
      confidence,
      targetPrice: marketData.price * 1.10, // Conservative 10% upside
      stopPrice: bestOption.strike * 0.98, // Just below put strike
      reasoning: this.generateReasoning(context, bestOption),
      fundamentalScore,
      technicalScore,
      riskScore,
      expectedReturn,
      timeHorizon,
      createdAt: new Date(),
    };
  }
  
  private findBestProtectivePutOption(options: any[], stockPrice: number): any | null {
    const scoredOptions = options.map(option => {
      const protectionLevel = (stockPrice - option.strike) / stockPrice;
      const costPercent = option.ask / stockPrice;
      const liquidityScore = this.calculateLiquidityScore(option);
      const timeValue = this.getDaysToExpiration(option.expiration);
      
      // Balance protection level, cost, and liquidity
      const score = 
        (1 - protectionLevel) * 40 + // Prefer closer to current price
        (1 - costPercent) * 30 + // Prefer lower cost
        liquidityScore * 20 + // Good liquidity
        Math.min(timeValue / 30, 10) * 10; // Reasonable time to expiration
      
      return { option, score, protectionLevel, costPercent };
    });
    
    scoredOptions.sort((a, b) => b.score - a.score);
    return scoredOptions[0]?.option || null;
  }
  
  private calculateLiquidityScore(option: any): number {
    const bidAskSpread = option.ask - option.bid;
    const spreadPercent = bidAskSpread / option.last;
    const volumeScore = Math.min(5, option.volume / 10);
    const openInterestScore = Math.min(5, option.openInterest / 50);
    
    return Math.max(0, 10 - spreadPercent * 100) * 0.5 + volumeScore + openInterestScore;
  }
  
  private calculateConfidence(context: SignalContext, option: any): number {
    const { fundamentalScore, technicalScore, marketData } = context;
    
    let confidence = 0;
    
    // Higher fundamental score suggests upside potential (30%)
    confidence += fundamentalScore * 0.3;
    
    // Moderate technical score preferred (not overbought) (20%)
    const technicalWeight = technicalScore > 8 ? (10 - technicalScore) : technicalScore;
    confidence += technicalWeight * 0.2;
    
    // Cost efficiency (30%)
    const costPercent = option.ask / marketData.price;
    const costScore = Math.max(0, 10 - costPercent * 100); // Lower cost = higher score
    confidence += costScore * 0.3;
    
    // Liquidity (20%)
    const liquidityScore = this.calculateLiquidityScore(option);
    confidence += liquidityScore * 0.2;
    
    return Math.max(0, Math.min(10, confidence));
  }
  
  private calculateRiskScore(context: SignalContext, option: any): number {
    let risk = 4; // Moderate-low base risk for protective strategy
    
    const costPercent = option.ask / context.marketData.price;
    if (costPercent > 0.05) risk += 2; // Expensive protection
    
    const liquidityScore = this.calculateLiquidityScore(option);
    if (liquidityScore < 5) risk += 1;
    
    const timeToExp = this.getDaysToExpiration(option.expiration);
    if (timeToExp < 90) risk += 1; // Time decay risk
    
    return Math.max(1, Math.min(10, risk));
  }
  
  private calculateExpectedReturn(option: any, stockPrice: number): number {
    // Expected return is reduced by cost of protection
    const costPercent = option.ask / stockPrice;
    const expectedStockReturn = 0.10; // Assume 10% stock appreciation
    return (expectedStockReturn - costPercent) * 100;
  }
  
  private getDaysToExpiration(expiration: Date): number {
    return Math.floor((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }
  
  private generateReasoning(context: SignalContext, option: any): string {
    const { symbol, marketData } = context;
    const protectionLevel = ((marketData.price - option.strike) / marketData.price * 100).toFixed(1);
    const costPercent = (option.ask / marketData.price * 100).toFixed(2);
    const days = this.getDaysToExpiration(option.expiration);
    
    let reasoning = `Protective Put for ${symbol}: `;
    reasoning += `Downside protection ${protectionLevel}% below current price at $${option.strike} strike. `;
    reasoning += `Insurance cost: ${costPercent}% of position value for ${days} days coverage. `;
    
    if (context.fundamentalScore > 7) {
      reasoning += "Strong fundamentals justify holding with protection. ";
    }
    
    if (option.impliedVolatility < 0.3) {
      reasoning += "Reasonable option premiums make protection cost-effective. ";
    }
    
    return reasoning;
  }
}
