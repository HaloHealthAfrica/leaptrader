import { InsertTradingSignal } from "@shared/schema";
import { SignalContext } from "../signalGenerator";

export class IronCondorStrategy {
  async generateSignal(context: SignalContext): Promise<InsertTradingSignal | null> {
    const { symbol, marketData, optionChain, fundamentalScore, technicalScore, strategyConfig } = context;
    
    // Filter for options 30-45 days to expiration
    const shortTermOptions = optionChain.filter(option => 
      this.getDaysToExpiration(option.expiration) >= 30 &&
      this.getDaysToExpiration(option.expiration) <= 45
    );
    
    if (shortTermOptions.length < 4) {
      return null; // Need at least 4 options for iron condor
    }
    
    // Find the best iron condor setup
    const condorSetup = this.findBestIronCondorSetup(shortTermOptions, marketData.price);
    if (!condorSetup) {
      return null;
    }
    
    // Calculate confidence
    const confidence = this.calculateConfidence(context, condorSetup);
    
    if (confidence < 6.0) {
      return null;
    }
    
    const riskScore = this.calculateRiskScore(context, condorSetup);
    const expectedReturn = this.calculateExpectedReturn(condorSetup);
    const timeHorizon = this.getDaysToExpiration(condorSetup.expiration);
    
    return {
      symbol,
      strategy: 'iron_condor',
      action: 'sell',
      confidence,
      targetPrice: condorSetup.upperBreakeven,
      stopPrice: condorSetup.lowerBreakeven,
      reasoning: this.generateReasoning(context, condorSetup),
      fundamentalScore,
      technicalScore,
      riskScore,
      expectedReturn,
      timeHorizon,
      createdAt: new Date(),
    };
  }
  
  private findBestIronCondorSetup(options: any[], stockPrice: number): any | null {
    const calls = options.filter(opt => opt.type === 'call');
    const puts = options.filter(opt => opt.type === 'put');
    
    if (calls.length < 2 || puts.length < 2) {
      return null;
    }
    
    // Group by expiration
    const expirations = [...new Set(options.map(opt => opt.expiration.getTime()))];
    
    let bestSetup = null;
    let bestScore = -Infinity;
    
    for (const expTime of expirations) {
      const expiration = new Date(expTime);
      const expCalls = calls.filter(opt => opt.expiration.getTime() === expTime);
      const expPuts = puts.filter(opt => opt.expiration.getTime() === expTime);
      
      const setup = this.constructIronCondor(expCalls, expPuts, stockPrice, expiration);
      if (setup) {
        const score = this.scoreIronCondor(setup, stockPrice);
        if (score > bestScore) {
          bestScore = score;
          bestSetup = setup;
        }
      }
    }
    
    return bestSetup;
  }
  
  private constructIronCondor(calls: any[], puts: any[], stockPrice: number, expiration: Date): any | null {
    // Find OTM options around current price
    const otmCalls = calls.filter(call => call.strike > stockPrice * 1.02).sort((a, b) => a.strike - b.strike);
    const otmPuts = puts.filter(put => put.strike < stockPrice * 0.98).sort((a, b) => b.strike - a.strike);
    
    if (otmCalls.length < 2 || otmPuts.length < 2) {
      return null;
    }
    
    // Select strikes for iron condor
    const shortCall = otmCalls[0]; // Closest OTM call
    const longCall = otmCalls[Math.min(2, otmCalls.length - 1)]; // Further OTM call
    const shortPut = otmPuts[0]; // Closest OTM put
    const longPut = otmPuts[Math.min(2, otmPuts.length - 1)]; // Further OTM put
    
    // Calculate net credit
    const netCredit = (shortCall.bid + shortPut.bid) - (longCall.ask + longPut.ask);
    
    if (netCredit <= 0) {
      return null; // Must collect net credit
    }
    
    return {
      shortCall,
      longCall,
      shortPut,
      longPut,
      netCredit,
      maxProfit: netCredit,
      maxLoss: (longCall.strike - shortCall.strike) - netCredit,
      upperBreakeven: shortCall.strike + netCredit,
      lowerBreakeven: shortPut.strike - netCredit,
      expiration,
    };
  }
  
  private scoreIronCondor(setup: any, stockPrice: number): number {
    const returnOnRisk = setup.maxProfit / setup.maxLoss;
    const probabilityOfSuccess = this.calculateProbabilityOfSuccess(setup, stockPrice);
    const liquidityScore = this.calculateCondorLiquidityScore(setup);
    
    return returnOnRisk * 30 + probabilityOfSuccess * 50 + liquidityScore * 20;
  }
  
  private calculateProbabilityOfSuccess(setup: any, stockPrice: number): number {
    // Estimate probability that stock stays between breakevens
    const range = setup.upperBreakeven - setup.lowerBreakeven;
    const currentPosition = (stockPrice - setup.lowerBreakeven) / range;
    
    // Simple normal distribution approximation
    // Assume stock has reasonable chance of staying in wide range
    const rangePercent = range / stockPrice;
    return Math.min(100, rangePercent * 200); // Scale to percentage
  }
  
  private calculateCondorLiquidityScore(setup: any): number {
    const options = [setup.shortCall, setup.longCall, setup.shortPut, setup.longPut];
    const avgLiquidityScore = options.reduce((sum, opt) => {
      const bidAskSpread = opt.ask - opt.bid;
      const spreadPercent = bidAskSpread / opt.last;
      const volumeScore = Math.min(5, opt.volume / 5);
      return sum + Math.max(0, 10 - spreadPercent * 100) * 0.5 + volumeScore;
    }, 0) / options.length;
    
    return avgLiquidityScore;
  }
  
  private calculateConfidence(context: SignalContext, setup: any): number {
    const { fundamentalScore, technicalScore } = context;
    
    let confidence = 0;
    
    // Neutral market outlook preferred (40%)
    const neutralScore = 10 - Math.abs(fundamentalScore - 5) - Math.abs(technicalScore - 5);
    confidence += neutralScore * 0.4;
    
    // Return/risk ratio (30%)
    const returnRiskScore = Math.min(10, (setup.maxProfit / setup.maxLoss) * 10);
    confidence += returnRiskScore * 0.3;
    
    // Probability of success (20%)
    const probScore = this.calculateProbabilityOfSuccess(setup, context.marketData.price) / 10;
    confidence += probScore * 0.2;
    
    // Liquidity (10%)
    const liquidityScore = this.calculateCondorLiquidityScore(setup);
    confidence += liquidityScore * 0.1;
    
    return Math.max(0, Math.min(10, confidence));
  }
  
  private calculateRiskScore(context: SignalContext, setup: any): number {
    let risk = 6; // Moderate base risk
    
    const returnRiskRatio = setup.maxProfit / setup.maxLoss;
    if (returnRiskRatio < 0.2) risk += 2; // Poor risk/reward
    
    const liquidityScore = this.calculateCondorLiquidityScore(setup);
    if (liquidityScore < 5) risk += 2; // Liquidity risk
    
    const timeToExp = this.getDaysToExpiration(setup.expiration);
    if (timeToExp < 30) risk += 1; // Time decay acceleration
    
    return Math.max(1, Math.min(10, risk));
  }
  
  private calculateExpectedReturn(setup: any): number {
    const returnOnCapital = (setup.maxProfit / setup.maxLoss) * 100;
    const timeToExp = this.getDaysToExpiration(setup.expiration);
    return (returnOnCapital * 365 / timeToExp); // Annualized
  }
  
  private getDaysToExpiration(expiration: Date): number {
    return Math.floor((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }
  
  private generateReasoning(context: SignalContext, setup: any): string {
    const { symbol } = context;
    const returnRisk = (setup.maxProfit / setup.maxLoss * 100).toFixed(0);
    const days = this.getDaysToExpiration(setup.expiration);
    const range = ((setup.upperBreakeven - setup.lowerBreakeven) / context.marketData.price * 100).toFixed(1);
    
    let reasoning = `Iron Condor on ${symbol}: `;
    reasoning += `Collect $${setup.netCredit.toFixed(2)} credit for ${returnRisk}% max return in ${days} days. `;
    reasoning += `Profit zone: $${setup.lowerBreakeven.toFixed(2)} - $${setup.upperBreakeven.toFixed(2)} (${range}% range). `;
    
    if (setup.maxProfit / setup.maxLoss > 0.3) {
      reasoning += "Attractive risk/reward profile in range-bound market. ";
    }
    
    return reasoning;
  }
}
