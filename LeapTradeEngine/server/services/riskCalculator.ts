import { RiskMetrics, InsertRiskMetrics, Portfolio, Position } from "@shared/schema";
import { storage } from "../storage";
import { MarketDataService } from "./marketData";

export class RiskCalculatorService {
  private marketDataService: MarketDataService;

  constructor() {
    this.marketDataService = new MarketDataService();
  }

  async calculateRiskMetrics(portfolioId: string): Promise<RiskMetrics> {
    const portfolio = await storage.getPortfolio(portfolioId);
    const positions = await storage.getPositionsByPortfolio(portfolioId);

    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const var95 = await this.calculateVaR(positions, 0.95);
    const expectedShortfall = await this.calculateExpectedShortfall(positions, 0.95);
    const beta = await this.calculatePortfolioBeta(positions);
    const correlationRisk = await this.calculateCorrelationRisk(positions);
    const concentrationRisk = this.calculateConcentrationRisk(positions, portfolio.totalValue);
    const liquidityRisk = await this.calculateLiquidityRisk(positions);
    const greeksExposure = await this.calculateGreeksExposure(positions);
    const stressTests = await this.performStressTests(positions);

    const riskMetrics: InsertRiskMetrics = {
      portfolioId,
      var95,
      expectedShortfall,
      beta,
      correlationRisk,
      concentrationRisk,
      liquidityRisk,
      greeksExposure,
      stressTests,
      timestamp: new Date(),
    };

    return await storage.createRiskMetrics(riskMetrics);
  }

  private async calculateVaR(positions: Position[], confidenceLevel: number): Promise<number> {
    if (positions.length === 0) return 0;

    // Simplified VaR calculation using parametric method
    const returns = await this.getHistoricalReturns(positions);
    const portfolioVariance = this.calculatePortfolioVariance(returns);
    const portfolioStdDev = Math.sqrt(portfolioVariance);

    // Z-score for given confidence level
    const zScore = confidenceLevel === 0.95 ? 1.645 : 2.33; // 95% or 99%
    
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    return -totalValue * portfolioStdDev * zScore;
  }

  private async calculateExpectedShortfall(positions: Position[], confidenceLevel: number): Promise<number> {
    const var95 = await this.calculateVaR(positions, confidenceLevel);
    // Simplified ES calculation - typically 1.3x VaR for normal distribution
    return var95 * 1.3;
  }

  private async calculatePortfolioBeta(positions: Position[]): Promise<number> {
    if (positions.length === 0) return 1.0;

    // Simplified beta calculation
    // In production, would use regression analysis against market index
    const symbols = [...new Set(positions.map(pos => pos.symbol))];
    const betas = await Promise.all(symbols.map(symbol => this.getSymbolBeta(symbol)));
    
    const weights = positions.map(pos => pos.marketValue);
    const totalValue = weights.reduce((sum, weight) => sum + weight, 0);
    
    if (totalValue === 0) return 1.0;

    let weightedBeta = 0;
    for (let i = 0; i < symbols.length; i++) {
      const symbolPositions = positions.filter(pos => pos.symbol === symbols[i]);
      const symbolValue = symbolPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
      const weight = symbolValue / totalValue;
      weightedBeta += betas[i] * weight;
    }

    return weightedBeta;
  }

  private async getSymbolBeta(symbol: string): Promise<number> {
    // Simplified beta estimation - in production would calculate from historical data
    const betaMap: Record<string, number> = {
      'AAPL': 1.2,
      'MSFT': 0.9,
      'GOOGL': 1.1,
      'AMZN': 1.3,
      'TSLA': 2.0,
      'META': 1.4,
      'NVDA': 1.8,
      'NFLX': 1.2,
    };
    
    return betaMap[symbol] || 1.0;
  }

  private async calculateCorrelationRisk(positions: Position[]): Promise<number> {
    if (positions.length < 2) return 0;

    // Simplified correlation risk calculation
    // High correlation increases portfolio risk
    const symbols = [...new Set(positions.map(pos => pos.symbol))];
    const correlationMatrix = await this.buildCorrelationMatrix(symbols);
    
    // Average correlation as risk measure
    let totalCorrelation = 0;
    let pairs = 0;
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        totalCorrelation += Math.abs(correlationMatrix[i][j]);
        pairs++;
      }
    }
    
    return pairs > 0 ? (totalCorrelation / pairs) * 10 : 0; // Scale to 0-10
  }

  private async buildCorrelationMatrix(symbols: string[]): Promise<number[][]> {
    // Simplified correlation matrix - in production would calculate from historical data
    const n = symbols.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Set diagonal to 1 (perfect self-correlation)
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
    }
    
    // Simplified correlations based on sector relationships
    const techSymbols = ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA'];
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let correlation = 0.3; // Default moderate correlation
        
        // Higher correlation for tech stocks
        if (techSymbols.includes(symbols[i]) && techSymbols.includes(symbols[j])) {
          correlation = 0.7;
        }
        
        matrix[i][j] = correlation;
        matrix[j][i] = correlation;
      }
    }
    
    return matrix;
  }

  private calculateConcentrationRisk(positions: Position[], totalValue: number): number {
    if (positions.length === 0 || totalValue === 0) return 0;

    // Calculate Herfindahl index for concentration
    const weights = positions.map(pos => pos.marketValue / totalValue);
    const herfindahlIndex = weights.reduce((sum, weight) => sum + weight * weight, 0);
    
    // Convert to risk score (0-10)
    return Math.min(10, herfindahlIndex * 10);
  }

  private async calculateLiquidityRisk(positions: Position[]): Promise<number> {
    if (positions.length === 0) return 0;

    // Simplified liquidity risk based on position sizes and market cap
    let totalLiquidityScore = 0;
    
    for (const position of positions) {
      const marketData = await this.marketDataService.getQuote(position.symbol);
      const dailyVolume = marketData?.volume || 1000000; // Default if not available
      
      // Calculate days to liquidate position
      const daysToLiquidate = Math.abs(position.quantity) / (dailyVolume * 0.1); // 10% of daily volume
      
      // Higher days = higher risk
      const liquidityScore = Math.min(10, daysToLiquidate);
      totalLiquidityScore += liquidityScore;
    }
    
    return totalLiquidityScore / positions.length;
  }

  private async calculateGreeksExposure(positions: Position[]): Promise<{
    totalDelta: number;
    totalGamma: number;
    totalTheta: number;
    totalVega: number;
  }> {
    // For options positions, sum up the Greeks
    const optionPositions = positions.filter(pos => pos.type === 'option');
    
    if (optionPositions.length === 0) {
      return {
        totalDelta: 0,
        totalGamma: 0,
        totalTheta: 0,
        totalVega: 0,
      };
    }

    // Simplified Greeks calculation - would use real option Greeks in production
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;

    for (const position of optionPositions) {
      // Estimate Greeks based on position characteristics
      const delta = position.side === 'long' ? 0.5 : -0.5;
      const gamma = 0.1;
      const theta = -0.05;
      const vega = 0.2;
      
      totalDelta += delta * position.quantity;
      totalGamma += gamma * position.quantity;
      totalTheta += theta * position.quantity;
      totalVega += vega * position.quantity;
    }

    return {
      totalDelta,
      totalGamma,
      totalTheta,
      totalVega,
    };
  }

  private async performStressTests(positions: Position[]): Promise<{
    market10Down: number;
    market20Down: number;
    volatilityShock: number;
  }> {
    if (positions.length === 0) {
      return {
        market10Down: 0,
        market20Down: 0,
        volatilityShock: 0,
      };
    }

    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    
    // Estimate portfolio impact under stress scenarios
    const avgBeta = await this.calculatePortfolioBeta(positions);
    
    const market10Down = -totalValue * 0.10 * avgBeta;
    const market20Down = -totalValue * 0.20 * avgBeta;
    const volatilityShock = -totalValue * 0.05; // 5% impact from vol shock
    
    return {
      market10Down,
      market20Down,
      volatilityShock,
    };
  }

  private async getHistoricalReturns(positions: Position[]): Promise<number[][]> {
    // Simplified historical returns - in production would fetch real data
    // Return mock data for demonstration
    return positions.map(() => Array(30).fill(0).map(() => (Math.random() - 0.5) * 0.04));
  }

  private calculatePortfolioVariance(returns: number[][]): number {
    if (returns.length === 0) return 0;
    
    // Simplified variance calculation
    const portfolioReturns = returns[0].map((_, i) => 
      returns.reduce((sum, assetReturns) => sum + assetReturns[i], 0) / returns.length
    );
    
    const mean = portfolioReturns.reduce((sum, ret) => sum + ret, 0) / portfolioReturns.length;
    const variance = portfolioReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / portfolioReturns.length;
    
    return variance;
  }

  async getLatestRiskMetrics(portfolioId: string): Promise<RiskMetrics | null> {
    return await storage.getLatestRiskMetrics(portfolioId);
  }

  async updateRiskMetrics(portfolioId: string): Promise<RiskMetrics> {
    return await this.calculateRiskMetrics(portfolioId);
  }
}
