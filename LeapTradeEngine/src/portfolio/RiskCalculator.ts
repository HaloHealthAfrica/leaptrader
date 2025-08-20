import { Portfolio, Position, RiskMetrics, DataProvider } from '../types';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';

export class RiskCalculator {
  private dataClients: {
    twelvedata: DataProvider;
    alpaca: DataProvider;
    tradier: DataProvider;
  };

  // Monte Carlo simulation parameters
  private readonly SIMULATION_DAYS = 252; // 1 year
  private readonly SIMULATION_ITERATIONS = 10000;
  private readonly CONFIDENCE_LEVELS = [0.95, 0.99];

  constructor(dataClients: any) {
    this.dataClients = dataClients;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing risk calculator...');
    logger.info('Risk calculator initialized');
  }

  async calculatePortfolioRisk(portfolio: Portfolio): Promise<RiskMetrics> {
    const cacheKey = `portfolio-risk:${portfolio.id}:${Date.now().toString().slice(0, -4)}`; // Cache for ~10 seconds
    const cached = cache.get<RiskMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      logger.info(`Calculating risk metrics for portfolio: ${portfolio.id}`);

      // Get historical data for all positions
      const historicalReturns = await this.getPortfolioHistoricalReturns(portfolio);
      
      // Calculate basic risk metrics
      const basicMetrics = this.calculateBasicRiskMetrics(historicalReturns, portfolio);
      
      // Calculate Value at Risk
      const var95 = this.calculateVaR(historicalReturns, portfolio.totalValue, 0.95);
      const var99 = this.calculateVaR(historicalReturns, portfolio.totalValue, 0.99);
      
      // Calculate Expected Shortfall (Conditional VaR)
      const expectedShortfall = this.calculateExpectedShortfall(historicalReturns, portfolio.totalValue, 0.95);
      
      // Calculate correlation metrics
      const correlationMetrics = await this.calculateCorrelationMetrics(portfolio);
      
      // Greeks-based risk metrics
      const greeksRisk = this.calculateGreeksRisk(portfolio);

      const riskMetrics: RiskMetrics = {
        var95,
        var99,
        expectedShortfall,
        maxDrawdown: basicMetrics.maxDrawdown,
        beta: correlationMetrics.beta,
        correlation: correlationMetrics.correlation,
        volatility: basicMetrics.volatility,
        sharpeRatio: basicMetrics.sharpeRatio,
        sortinoRatio: basicMetrics.sortinoRatio,
        calmarRatio: basicMetrics.calmarRatio,
        ...greeksRisk
      };

      cache.set(cacheKey, riskMetrics, 30); // Cache for 30 seconds
      return riskMetrics;
    } catch (error) {
      logger.error(`Error calculating portfolio risk:`, error);
      throw error;
    }
  }

  private async getPortfolioHistoricalReturns(portfolio: Portfolio): Promise<number[]> {
    const returns: number[] = [];
    const positionReturns: { [symbol: string]: number[] } = {};

    // Get historical data for each unique symbol
    const uniqueSymbols = [...new Set(portfolio.positions.map(p => p.symbol))];
    
    for (const symbol of uniqueSymbols) {
      try {
        const historicalData = await this.dataClients.twelvedata.getHistoricalData(symbol, '1year');
        const symbolReturns = this.calculateReturns(historicalData.data.map(d => d.close));
        positionReturns[symbol] = symbolReturns;
      } catch (error) {
        logger.warn(`Could not fetch historical data for ${symbol}:`, error);
        // Use synthetic returns as fallback
        positionReturns[symbol] = this.generateSyntheticReturns(252, 0.0003, 0.02); // ~8% annual return, 20% volatility
      }
    }

    // Calculate portfolio returns based on position weights
    const maxLength = Math.max(...Object.values(positionReturns).map(r => r.length));
    
    for (let i = 0; i < maxLength; i++) {
      let portfolioReturn = 0;
      let totalWeight = 0;

      for (const position of portfolio.positions) {
        const positionWeight = position.marketValue / portfolio.totalValue;
        const symbolReturns = positionReturns[position.symbol];
        
        if (symbolReturns && i < symbolReturns.length) {
          // Adjust for option leverage (approximation)
          const leverage = Math.abs(position.delta || 0.5) * 2; // Rough leverage estimate
          portfolioReturn += symbolReturns[i] * positionWeight * leverage;
          totalWeight += positionWeight;
        }
      }

      if (totalWeight > 0) {
        returns.push(portfolioReturn);
      }
    }

    return returns;
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(dailyReturn);
    }
    
    return returns;
  }

  private generateSyntheticReturns(count: number, meanReturn: number, volatility: number): number[] {
    const returns: number[] = [];
    
    for (let i = 0; i < count; i++) {
      // Box-Muller transformation for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      
      returns.push(meanReturn + z * volatility);
    }
    
    return returns;
  }

  private calculateBasicRiskMetrics(returns: number[], portfolio: Portfolio): any {
    if (returns.length === 0) {
      return {
        volatility: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        maxDrawdown: 0
      };
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance * 252); // Annualized volatility

    // Calculate maximum drawdown
    const cumulativeReturns = [];
    let cumulative = 1;
    for (const dailyReturn of returns) {
      cumulative *= (1 + dailyReturn);
      cumulativeReturns.push(cumulative);
    }

    let maxDrawdown = 0;
    let peak = cumulativeReturns[0];
    
    for (const value of cumulativeReturns) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Sharpe Ratio (assuming risk-free rate of 2%)
    const riskFreeRate = 0.02;
    const excessReturn = (mean * 252) - riskFreeRate;
    const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0;

    // Sortino Ratio (downside deviation)
    const downSideReturns = returns.filter(r => r < 0);
    const downSideVariance = downSideReturns.length > 0 ? 
      downSideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downSideReturns.length : 0;
    const downSideDeviation = Math.sqrt(downSideVariance * 252);
    const sortinoRatio = downSideDeviation > 0 ? excessReturn / downSideDeviation : 0;

    // Calmar Ratio
    const calmarRatio = maxDrawdown > 0 ? (mean * 252) / maxDrawdown : 0;

    return {
      volatility,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown
    };
  }

  private calculateVaR(returns: number[], portfolioValue: number, confidence: number): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    const varReturn = sortedReturns[index] || 0;
    
    return Math.abs(varReturn * portfolioValue);
  }

  private calculateExpectedShortfall(returns: number[], portfolioValue: number, confidence: number): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const cutoffIndex = Math.floor((1 - confidence) * sortedReturns.length);
    
    if (cutoffIndex === 0) return Math.abs(sortedReturns[0] * portfolioValue);
    
    const tailReturns = sortedReturns.slice(0, cutoffIndex);
    const meanTailReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    
    return Math.abs(meanTailReturn * portfolioValue);
  }

  private async calculateCorrelationMetrics(portfolio: Portfolio): Promise<{ beta: number; correlation: number }> {
    try {
      // Use SPY as market benchmark
      const marketData = await this.dataClients.twelvedata.getHistoricalData('SPY', '1year');
      const marketReturns = this.calculateReturns(marketData.data.map(d => d.close));
      
      const portfolioReturns = await this.getPortfolioHistoricalReturns(portfolio);
      
      if (portfolioReturns.length === 0 || marketReturns.length === 0) {
        return { beta: 1.0, correlation: 0.5 };
      }

      // Align the arrays to same length
      const minLength = Math.min(portfolioReturns.length, marketReturns.length);
      const alignedPortfolioReturns = portfolioReturns.slice(-minLength);
      const alignedMarketReturns = marketReturns.slice(-minLength);

      // Calculate beta and correlation
      const beta = this.calculateBeta(alignedPortfolioReturns, alignedMarketReturns);
      const correlation = this.calculateCorrelation(alignedPortfolioReturns, alignedMarketReturns);

      return { beta, correlation };
    } catch (error) {
      logger.warn('Could not calculate correlation metrics, using defaults:', error);
      return { beta: 1.0, correlation: 0.5 };
    }
  }

  private calculateBeta(portfolioReturns: number[], marketReturns: number[]): number {
    if (portfolioReturns.length !== marketReturns.length || portfolioReturns.length === 0) {
      return 1.0;
    }

    const portfolioMean = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
    const marketMean = marketReturns.reduce((sum, r) => sum + r, 0) / marketReturns.length;

    let covariance = 0;
    let marketVariance = 0;

    for (let i = 0; i < portfolioReturns.length; i++) {
      const portfolioDeviation = portfolioReturns[i] - portfolioMean;
      const marketDeviation = marketReturns[i] - marketMean;
      
      covariance += portfolioDeviation * marketDeviation;
      marketVariance += marketDeviation * marketDeviation;
    }

    return marketVariance > 0 ? covariance / marketVariance : 1.0;
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) {
      return 0;
    }

    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < returns1.length; i++) {
      const dev1 = returns1[i] - mean1;
      const dev2 = returns2[i] - mean2;
      
      numerator += dev1 * dev2;
      sum1Sq += dev1 * dev1;
      sum2Sq += dev2 * dev2;
    }

    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateGreeksRisk(portfolio: Portfolio): any {
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;

    for (const position of portfolio.positions) {
      const positionValue = position.quantity * position.currentPrice;
      
      totalDelta += (position.delta || 0) * positionValue;
      totalGamma += (position.gamma || 0) * positionValue;
      totalTheta += (position.theta || 0) * positionValue;
      totalVega += (position.vega || 0) * positionValue;
    }

    // Calculate Greeks-based risk scores (0-10 scale)
    const deltaRisk = Math.min(10, Math.abs(totalDelta) / (portfolio.totalValue * 0.01)); // Risk if delta > 1% of portfolio per $1 move
    const gammaRisk = Math.min(10, Math.abs(totalGamma) / (portfolio.totalValue * 0.001)); // Gamma acceleration risk
    const thetaRisk = Math.min(10, Math.abs(totalTheta) / (portfolio.totalValue * 0.0005)); // Daily time decay risk
    const vegaRisk = Math.min(10, Math.abs(totalVega) / (portfolio.totalValue * 0.01)); // Volatility risk

    return {
      deltaRisk,
      gammaRisk,
      thetaRisk,
      vegaRisk,
      greeksScore: (deltaRisk + gammaRisk + thetaRisk + vegaRisk) / 4
    };
  }

  async calculatePositionRisk(position: Position, marketData?: any): Promise<{
    var95: number;
    maxLoss: number;
    breakEven: number;
    probabilityOfProfit: number;
  }> {
    try {
      const timeToExpiry = (position.expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      const positionValue = position.quantity * position.currentPrice;

      // Simple position VaR calculation
      const estimatedVolatility = 0.25; // Default 25% if no market data
      const dailyVol = estimatedVolatility / Math.sqrt(252);
      const var95 = positionValue * dailyVol * 1.645; // 95% confidence

      // Maximum loss calculation
      let maxLoss = positionValue; // Default to premium paid
      
      if (position.optionType === 'call') {
        maxLoss = positionValue; // Maximum loss is premium paid
      } else if (position.optionType === 'put') {
        maxLoss = positionValue; // Maximum loss is premium paid for long puts
      }

      // Break-even calculation
      let breakEven = position.strike;
      if (position.optionType === 'call' && position.quantity > 0) {
        breakEven = position.strike + position.entryPrice;
      } else if (position.optionType === 'put' && position.quantity > 0) {
        breakEven = position.strike - position.entryPrice;
      }

      // Simplified probability of profit (using delta as approximation)
      const probabilityOfProfit = Math.abs(position.delta || 0.5) * 100;

      return {
        var95,
        maxLoss,
        breakEven,
        probabilityOfProfit
      };
    } catch (error) {
      logger.error(`Error calculating position risk for ${position.symbol}:`, error);
      throw error;
    }
  }

  async stressTest(portfolio: Portfolio, scenarios: {
    marketShock: number; // percentage change
    volatilityShock: number; // percentage change in IV
    timeDecay: number; // days
  }[]): Promise<{
    scenario: string;
    portfolioValue: number;
    pnl: number;
    pnlPercent: number;
  }[]> {
    const results = [];

    for (const scenario of scenarios) {
      let stressedValue = 0;

      for (const position of portfolio.positions) {
        // Simulate stressed position value
        const currentPrice = position.currentPrice;
        const stressedPrice = currentPrice * (1 + scenario.marketShock);
        
        // Rough approximation of option value change
        const deltaEffect = (position.delta || 0) * (stressedPrice - currentPrice);
        const gammaEffect = (position.gamma || 0) * Math.pow(stressedPrice - currentPrice, 2) * 0.5;
        const thetaEffect = (position.theta || 0) * scenario.timeDecay;
        const vegaEffect = (position.vega || 0) * scenario.volatilityShock * position.impliedVolatility;

        const newOptionPrice = position.currentPrice + deltaEffect + gammaEffect + thetaEffect + vegaEffect;
        stressedValue += position.quantity * Math.max(0.01, newOptionPrice); // Minimum value of $0.01
      }

      // Add cash balance
      stressedValue += portfolio.cashBalance;

      const pnl = stressedValue - portfolio.totalValue;
      const pnlPercent = (pnl / portfolio.totalValue) * 100;

      results.push({
        scenario: `Market: ${(scenario.marketShock * 100).toFixed(0)}%, Vol: ${(scenario.volatilityShock * 100).toFixed(0)}%, Time: ${scenario.timeDecay}d`,
        portfolioValue: stressedValue,
        pnl,
        pnlPercent
      });
    }

    return results;
  }
}
