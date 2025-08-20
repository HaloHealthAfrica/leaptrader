import { Portfolio, Position, RiskMetrics, RiskLimits, RiskAlert, DataProvider } from '../types';
import { RiskCalculator } from './RiskCalculator';
import { PositionSizer } from './PositionSizer';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';

export interface PortfolioManagerConfig {
  dataClients: {
    twelvedata: DataProvider;
    alpaca: DataProvider;
    tradier: DataProvider;
  };
  riskLimits: RiskLimits;
}

export class PortfolioManager {
  private riskCalculator: RiskCalculator;
  private positionSizer: PositionSizer;
  private dataClients: any;
  private riskLimits: RiskLimits;
  private portfolios: Map<string, Portfolio> = new Map();
  private activeAlerts: Map<string, RiskAlert> = new Map();
  private isRunning = false;

  constructor(config: PortfolioManagerConfig) {
    this.dataClients = config.dataClients;
    this.riskLimits = config.riskLimits;
    this.riskCalculator = new RiskCalculator(config.dataClients);
    this.positionSizer = new PositionSizer(config.riskLimits);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing portfolio manager...');
      
      await this.riskCalculator.initialize();
      await this.positionSizer.initialize();

      // Load existing portfolios (in production, from database)
      await this.loadPortfolios();

      this.isRunning = true;
      logger.info('Portfolio manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize portfolio manager:', error);
      throw error;
    }
  }

  private async loadPortfolios(): Promise<void> {
    // In production, this would load from database
    // For now, create a default portfolio
    const defaultPortfolio: Portfolio = {
      id: 'main-portfolio',
      totalValue: 2500000,
      cashBalance: 250000,
      marginUsed: 0,
      positions: [],
      dailyPnL: 0,
      totalReturn: 0.15, // 15% YTD
      maxDrawdown: 0.08, // 8% max drawdown
      sharpeRatio: 2.1,
      beta: 1.15,
      alpha: 0.05
    };

    this.portfolios.set(defaultPortfolio.id, defaultPortfolio);
  }

  async updatePortfolio(portfolioId: string, positions: Position[]): Promise<void> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    try {
      // Update positions
      portfolio.positions = positions;

      // Recalculate portfolio metrics
      await this.recalculatePortfolioMetrics(portfolio);

      // Check risk limits
      await this.checkRiskLimits(portfolio);

      // Update portfolio
      this.portfolios.set(portfolioId, portfolio);

      logger.info(`Portfolio ${portfolioId} updated with ${positions.length} positions`);
    } catch (error) {
      logger.error(`Error updating portfolio ${portfolioId}:`, error);
      throw error;
    }
  }

  private async recalculatePortfolioMetrics(portfolio: Portfolio): Promise<void> {
    let totalValue = portfolio.cashBalance;
    let dailyPnL = 0;

    // Calculate position values and P&L
    for (const position of portfolio.positions) {
      const currentValue = position.quantity * position.currentPrice;
      const entryValue = position.quantity * position.entryPrice;
      
      totalValue += currentValue;
      position.marketValue = currentValue;
      position.unrealizedPnL = currentValue - entryValue;
      dailyPnL += position.unrealizedPnL;
    }

    portfolio.totalValue = totalValue;
    portfolio.dailyPnL = dailyPnL;

    // Calculate risk metrics
    const riskMetrics = await this.riskCalculator.calculatePortfolioRisk(portfolio);
    portfolio.maxDrawdown = riskMetrics.maxDrawdown;
    portfolio.sharpeRatio = riskMetrics.sharpeRatio;
    portfolio.beta = riskMetrics.beta;
  }

  async addPosition(portfolioId: string, position: Position): Promise<void> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    try {
      // Validate position size
      const positionValue = position.quantity * position.currentPrice;
      const portfolioValue = portfolio.totalValue;
      const positionWeight = positionValue / portfolioValue;

      if (positionWeight > this.riskLimits.maxPositionSize) {
        throw new Error(`Position size (${(positionWeight * 100).toFixed(1)}%) exceeds limit (${(this.riskLimits.maxPositionSize * 100).toFixed(1)}%)`);
      }

      // Check if position already exists
      const existingIndex = portfolio.positions.findIndex(p => 
        p.symbol === position.symbol && 
        p.strike === position.strike && 
        p.expiration.getTime() === position.expiration.getTime()
      );

      if (existingIndex >= 0) {
        // Update existing position
        const existing = portfolio.positions[existingIndex];
        existing.quantity += position.quantity;
        existing.currentPrice = position.currentPrice;
        existing.updatedAt = new Date();
        
        logger.info(`Updated existing position: ${position.symbol} quantity: ${existing.quantity}`);
      } else {
        // Add new position
        portfolio.positions.push(position);
        logger.info(`Added new position: ${position.symbol} ${position.optionType} ${position.strike} ${position.expiration.toISOString().split('T')[0]}`);
      }

      // Recalculate portfolio metrics
      await this.recalculatePortfolioMetrics(portfolio);

      // Check risk limits
      await this.checkRiskLimits(portfolio);

    } catch (error) {
      logger.error(`Error adding position to portfolio ${portfolioId}:`, error);
      throw error;
    }
  }

  async removePosition(portfolioId: string, positionId: string): Promise<void> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    const positionIndex = portfolio.positions.findIndex(p => p.id === positionId);
    if (positionIndex === -1) {
      throw new Error(`Position ${positionId} not found`);
    }

    const position = portfolio.positions[positionIndex];
    portfolio.positions.splice(positionIndex, 1);

    // Update cash balance (assuming position was closed at current price)
    const proceeds = position.quantity * position.currentPrice;
    portfolio.cashBalance += proceeds;

    logger.info(`Removed position: ${position.symbol} for $${proceeds.toLocaleString()}`);

    // Recalculate portfolio metrics
    await this.recalculatePortfolioMetrics(portfolio);
  }

  async calculatePositionSize(
    portfolioId: string,
    symbol: string,
    strategy: string,
    optionPrice: number,
    confidence: number
  ): Promise<{ quantity: number; reasoning: string }> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    try {
      const positionSize = await this.positionSizer.calculateOptimalSize({
        portfolioValue: portfolio.totalValue,
        availableCash: portfolio.cashBalance,
        optionPrice,
        confidence,
        strategy,
        existingPositions: portfolio.positions,
        symbol,
        riskLimits: this.riskLimits
      });

      return positionSize;
    } catch (error) {
      logger.error(`Error calculating position size for ${symbol}:`, error);
      throw error;
    }
  }

  private async checkRiskLimits(portfolio: Portfolio): Promise<void> {
    const riskMetrics = await this.riskCalculator.calculatePortfolioRisk(portfolio);
    const alerts: RiskAlert[] = [];

    // Check VaR limit
    if (riskMetrics.var95 > this.riskLimits.maxPortfolioVaR) {
      alerts.push({
        id: `var-limit-${Date.now()}`,
        type: 'portfolio',
        severity: 'high',
        message: `Portfolio VaR (${riskMetrics.var95.toLocaleString()}) exceeds limit (${this.riskLimits.maxPortfolioVaR.toLocaleString()})`,
        metric: 'var95',
        currentValue: riskMetrics.var95,
        threshold: this.riskLimits.maxPortfolioVaR,
        recommendations: [
          'Reduce position sizes',
          'Hedge existing positions',
          'Close high-risk positions'
        ],
        createdAt: new Date()
      });
    }

    // Check drawdown limit
    if (riskMetrics.maxDrawdown > this.riskLimits.maxDrawdown) {
      alerts.push({
        id: `drawdown-limit-${Date.now()}`,
        type: 'portfolio',
        severity: 'critical',
        message: `Portfolio drawdown (${(riskMetrics.maxDrawdown * 100).toFixed(1)}%) exceeds limit (${(this.riskLimits.maxDrawdown * 100).toFixed(1)}%)`,
        metric: 'maxDrawdown',
        currentValue: riskMetrics.maxDrawdown * 100,
        threshold: this.riskLimits.maxDrawdown * 100,
        recommendations: [
          'Immediate risk reduction required',
          'Close losing positions',
          'Add portfolio hedges'
        ],
        createdAt: new Date()
      });
    }

    // Check beta limit
    if (riskMetrics.beta > this.riskLimits.maxBeta) {
      alerts.push({
        id: `beta-limit-${Date.now()}`,
        type: 'portfolio',
        severity: 'medium',
        message: `Portfolio beta (${riskMetrics.beta.toFixed(2)}) exceeds limit (${this.riskLimits.maxBeta.toFixed(2)})`,
        metric: 'beta',
        currentValue: riskMetrics.beta,
        threshold: this.riskLimits.maxBeta,
        recommendations: [
          'Add low-beta positions',
          'Reduce high-beta exposure',
          'Consider defensive strategies'
        ],
        createdAt: new Date()
      });
    }

    // Process alerts
    for (const alert of alerts) {
      this.activeAlerts.set(alert.id, alert);
      logger.warn(`Risk alert generated: ${alert.message}`);
    }
  }

  async getPortfolioRisk(portfolioId: string): Promise<RiskMetrics> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    return await this.riskCalculator.calculatePortfolioRisk(portfolio);
  }

  async getPortfolioGreeks(portfolioId: string): Promise<{
    totalDelta: number;
    totalGamma: number;
    totalTheta: number;
    totalVega: number;
  }> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;

    for (const position of portfolio.positions) {
      totalDelta += (position.delta || 0) * position.quantity;
      totalGamma += (position.gamma || 0) * position.quantity;
      totalTheta += (position.theta || 0) * position.quantity;
      totalVega += (position.vega || 0) * position.quantity;
    }

    return { totalDelta, totalGamma, totalTheta, totalVega };
  }

  async optimizePortfolio(portfolioId: string): Promise<{
    recommendations: string[];
    expectedImprovement: {
      sharpeRatio: number;
      expectedReturn: number;
      riskReduction: number;
    };
  }> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    const recommendations: string[] = [];
    let expectedSharpeImprovement = 0;
    let expectedReturnImprovement = 0;
    let riskReduction = 0;

    try {
      // Analyze current portfolio
      const riskMetrics = await this.riskCalculator.calculatePortfolioRisk(portfolio);
      const greeks = await this.getPortfolioGreeks(portfolioId);

      // Check for concentration risk
      const concentrationAnalysis = this.analyzeConcentration(portfolio);
      if (concentrationAnalysis.isConcentrated) {
        recommendations.push('Reduce concentration in top holdings');
        riskReduction += 0.02; // 2% risk reduction
      }

      // Check for Greeks imbalance
      if (Math.abs(greeks.totalDelta) > portfolio.totalValue * 0.0001) {
        recommendations.push('Rebalance delta exposure');
        expectedSharpeImprovement += 0.1;
      }

      if (greeks.totalTheta < -portfolio.totalValue * 0.0001) {
        recommendations.push('Reduce time decay exposure');
        riskReduction += 0.01;
      }

      // Check for correlation risk
      const correlationRisk = await this.analyzeCorrelationRisk(portfolio);
      if (correlationRisk.isHigh) {
        recommendations.push('Diversify across uncorrelated assets');
        riskReduction += 0.03;
      }

      // Check for volatility exposure
      if (Math.abs(greeks.totalVega) > portfolio.totalValue * 0.001) {
        recommendations.push('Hedge volatility exposure');
        expectedSharpeImprovement += 0.15;
      }

      return {
        recommendations,
        expectedImprovement: {
          sharpeRatio: expectedSharpeImprovement,
          expectedReturn: expectedReturnImprovement,
          riskReduction
        }
      };
    } catch (error) {
      logger.error(`Error optimizing portfolio ${portfolioId}:`, error);
      throw error;
    }
  }

  private analyzeConcentration(portfolio: Portfolio): { isConcentrated: boolean; topHoldings: string[] } {
    const symbolWeights: { [symbol: string]: number } = {};
    
    for (const position of portfolio.positions) {
      const weight = position.marketValue / portfolio.totalValue;
      symbolWeights[position.symbol] = (symbolWeights[position.symbol] || 0) + weight;
    }

    const sortedWeights = Object.entries(symbolWeights)
      .sort(([,a], [,b]) => b - a);

    const top5Weight = sortedWeights.slice(0, 5).reduce((sum, [,weight]) => sum + weight, 0);
    const isConcentrated = top5Weight > 0.6; // More than 60% in top 5 holdings

    return {
      isConcentrated,
      topHoldings: sortedWeights.slice(0, 5).map(([symbol]) => symbol)
    };
  }

  private async analyzeCorrelationRisk(portfolio: Portfolio): Promise<{ isHigh: boolean; avgCorrelation: number }> {
    // Simplified correlation analysis
    // In production, would calculate actual correlations between holdings
    
    const sectorWeights: { [sector: string]: number } = {};
    
    for (const position of portfolio.positions) {
      const sector = this.getSectorForSymbol(position.symbol);
      const weight = position.marketValue / portfolio.totalValue;
      sectorWeights[sector] = (sectorWeights[sector] || 0) + weight;
    }

    const maxSectorWeight = Math.max(...Object.values(sectorWeights));
    const isHigh = maxSectorWeight > 0.4; // More than 40% in single sector

    return {
      isHigh,
      avgCorrelation: maxSectorWeight // Approximation
    };
  }

  private getSectorForSymbol(symbol: string): string {
    // Simple sector mapping - in production would use external data
    const sectorMap: { [symbol: string]: string } = {
      'AAPL': 'Technology',
      'MSFT': 'Technology',
      'GOOGL': 'Technology',
      'TSLA': 'Automotive',
      'NVDA': 'Technology',
      'JPM': 'Finance',
      'JNJ': 'Healthcare',
      'XOM': 'Energy'
    };
    
    return sectorMap[symbol] || 'Other';
  }

  getPortfolio(portfolioId: string): Portfolio | undefined {
    return this.portfolios.get(portfolioId);
  }

  getAllPortfolios(): Portfolio[] {
    return Array.from(this.portfolios.values());
  }

  getActiveAlerts(): RiskAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  async dismissAlert(alertId: string): Promise<void> {
    if (this.activeAlerts.delete(alertId)) {
      logger.info(`Alert ${alertId} dismissed`);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      portfoliosCount: this.portfolios.size,
      totalValue: Array.from(this.portfolios.values())
        .reduce((sum, p) => sum + p.totalValue, 0),
      activeAlerts: this.activeAlerts.size,
      lastUpdate: new Date()
    };
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('Portfolio manager stopped');
  }
}
