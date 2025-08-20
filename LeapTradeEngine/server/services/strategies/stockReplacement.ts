import { TradingSignal, InsertTradingSignal } from "@shared/schema";
import { SignalContext } from "../signalGenerator";

export class StockReplacementStrategy {
  async generateSignal(context: SignalContext): Promise<InsertTradingSignal | null> {
    const { symbol, marketData, optionChain, fundamentalScore, technicalScore, strategyConfig } = context;
    
    // Filter for LEAP calls (>300 days to expiration)
    const leapCalls = optionChain.filter(option => 
      option.type === 'call' && 
      this.getDaysToExpiration(option.expiration) > 300 &&
      option.delta >= 0.6 && option.delta <= 0.8 // Optimal delta range
    );
    
    if (leapCalls.length === 0) {
      return null;
    }
    
    // Find the best LEAP call option
    const bestOption = this.findBestStockReplacementOption(leapCalls, marketData.price);
    if (!bestOption) {
      return null;
    }
    
    // Calculate confidence based on multiple factors
    const confidence = this.calculateConfidence(context, bestOption);
    
    // Only generate signal if confidence is above threshold
    if (confidence < 6.0) {
      return null;
    }
    
    const riskScore = this.calculateRiskScore(context, bestOption);
    const expectedReturn = this.calculateExpectedReturn(bestOption, marketData.price);
    const timeHorizon = this.getDaysToExpiration(bestOption.expiration);
    
    return {
      symbol,
      strategy: 'stock_replacement',
      action: 'buy',
      confidence,
      targetPrice: marketData.price * 1.15, // 15% upside target
      stopPrice: marketData.price * 0.85, // 15% stop loss
      reasoning: this.generateReasoning(context, bestOption),
      fundamentalScore,
      technicalScore,
      riskScore,
      expectedReturn,
      timeHorizon,
      createdAt: new Date(),
    };
  }
  
  private findBestStockReplacementOption(options: any[], stockPrice: number): any | null {
    // Sort by best value proposition (considering delta, time value, liquidity)
    const scoredOptions = options.map(option => {
      const moneyness = stockPrice / option.strike;
      const timeValue = option.last - Math.max(0, stockPrice - option.strike);
      const liquidityScore = this.calculateLiquidityScore(option);
      
      // Prefer deep ITM options with good liquidity and reasonable time value
      const score = 
        (moneyness - 1) * 10 + // Favor deep ITM
        liquidityScore * 2 + // Weight liquidity heavily
        (1 - timeValue / option.last) * 5; // Prefer lower time value premium
      
      return { option, score };
    });
    
    scoredOptions.sort((a, b) => b.score - a.score);
    return scoredOptions[0]?.option || null;
  }
  
  private calculateLiquidityScore(option: any): number {
    const bidAskSpread = option.ask - option.bid;
    const spreadPercent = bidAskSpread / option.last;
    const volumeScore = Math.min(5, option.volume / 20);
    const openInterestScore = Math.min(5, option.openInterest / 100);
    
    return Math.max(0, 10 - spreadPercent * 100) * 0.5 + volumeScore + openInterestScore;
  }
  
  private calculateConfidence(context: SignalContext, option: any): number {
    const { fundamentalScore, technicalScore, marketData } = context;
    
    let confidence = 0;
    
    // Fundamental component (30%)
    confidence += fundamentalScore * 0.3;
    
    // Technical component (30%)
    confidence += technicalScore * 0.3;
    
    // Option-specific factors (40%)
    const moneyness = marketData.price / option.strike;
    const moneynessScore = moneyness > 1.15 ? 10 : moneyness > 1.1 ? 8 : 6;
    
    const liquidityScore = this.calculateLiquidityScore(option);
    const timeScore = this.getDaysToExpiration(option.expiration) > 500 ? 8 : 6;
    
    confidence += (moneynessScore * 0.15 + liquidityScore * 0.15 + timeScore * 0.1);
    
    return Math.max(0, Math.min(10, confidence));
  }
  
  private calculateRiskScore(context: SignalContext, option: any): number {
    let risk = 5; // Base moderate risk
    
    const timeToExp = this.getDaysToExpiration(option.expiration);
    if (timeToExp < 365) risk += 2; // Higher risk for shorter LEAPS
    
    const liquidityScore = this.calculateLiquidityScore(option);
    if (liquidityScore < 5) risk += 2; // Higher risk for illiquid options
    
    if (option.impliedVolatility > 0.5) risk += 1; // Higher risk with high IV
    
    return Math.max(1, Math.min(10, risk));
  }
  
  private calculateExpectedReturn(option: any, stockPrice: number): number {
    const leverage = stockPrice / option.last;
    const expectedStockReturn = 0.15; // Assume 15% stock appreciation
    return expectedStockReturn * leverage;
  }
  
  private getDaysToExpiration(expiration: Date): number {
    return Math.floor((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }
  
  private generateReasoning(context: SignalContext, option: any): string {
    const { symbol, marketData, fundamentalScore, technicalScore } = context;
    const leverage = Math.round(marketData.price / option.last * 10) / 10;
    const days = this.getDaysToExpiration(option.expiration);
    
    let reasoning = `Stock Replacement LEAP for ${symbol}: `;
    reasoning += `Deep ITM call provides ${leverage}x leverage with ${days} days to expiration. `;
    
    if (fundamentalScore > 7) {
      reasoning += "Strong fundamental outlook supports long-term position. ";
    }
    
    if (technicalScore > 7) {
      reasoning += "Positive technical momentum adds conviction. ";
    }
    
    reasoning += `Delta of ${option.delta.toFixed(2)} offers good directional exposure while reducing capital requirements by ${Math.round((1 - option.last/marketData.price) * 100)}%.`;
    
    return reasoning;
  }
}
