import { Logger } from '../utils/logger';
import { Portfolio, Position, OptionContract, RiskMetrics } from '../core/types';

/**
 * Portfolio Manager - Manages positions, risk, and portfolio-level operations
 * Provides portfolio construction, position sizing, and risk management capabilities
 */
export class PortfolioManager {
  private readonly log = new Logger('portfolio-manager');
  private positions: Map<string, Position> = new Map();

  constructor(private portfolioId: string) {
    this.log.info('PortfolioManager initialized', { portfolioId });
  }

  /**
   * Add a position to the portfolio
   */
  addPosition(position: Position): void {
    this.positions.set(position.id, position);
    this.log.info('Position added to portfolio', { 
      portfolioId: this.portfolioId,
      positionId: position.id,
      symbol: position.symbol,
      quantity: position.quantity
    });
  }

  /**
   * Remove a position from the portfolio
   */
  removePosition(positionId: string): boolean {
    const removed = this.positions.delete(positionId);
    if (removed) {
      this.log.info('Position removed from portfolio', { 
        portfolioId: this.portfolioId,
        positionId 
      });
    }
    return removed;
  }

  /**
   * Update position with current market data
   */
  updatePosition(positionId: string, currentPrice: number): void {
    const position = this.positions.get(positionId);
    if (!position) {
      this.log.warn('Position not found for update', { positionId });
      return;
    }

    const oldPrice = position.currentPrice;
    position.currentPrice = currentPrice;
    position.marketValue = position.quantity * currentPrice;
    position.unrealizedPnL = (currentPrice - position.entryPrice) * position.quantity;

    this.log.debug('Position updated', {
      positionId,
      symbol: position.symbol,
      oldPrice,
      newPrice: currentPrice,
      unrealizedPnL: position.unrealizedPnL
    });
  }

  /**
   * Get current portfolio snapshot
   */
  getPortfolio(): Portfolio {
    const positions = Array.from(this.positions.values());
    const totalValue = this.calculateTotalValue(positions);
    const performance = this.calculatePerformance(positions, totalValue);

    return {
      id: this.portfolioId,
      name: `Portfolio ${this.portfolioId}`,
      totalValue,
      cashBalance: 0, // TODO: Track cash balance separately
      positions,
      performance
    };
  }

  /**
   * Calculate total portfolio value
   */
  private calculateTotalValue(positions: Position[]): number {
    return positions.reduce((total, position) => total + position.marketValue, 0);
  }

  /**
   * Calculate portfolio performance metrics
   */
  private calculatePerformance(positions: Position[], totalValue: number): Portfolio['performance'] {
    const totalCost = positions.reduce((total, position) => 
      total + (position.entryPrice * Math.abs(position.quantity)), 0);
    
    const totalUnrealized = positions.reduce((total, position) => 
      total + position.unrealizedPnL, 0);
    
    const totalRealized = positions.reduce((total, position) => 
      total + (position.realizedPnL || 0), 0);
    
    const totalReturn = totalUnrealized + totalRealized;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    return {
      totalReturn,
      totalReturnPercent,
      dayChange: 0, // TODO: Calculate day change
      dayChangePercent: 0
    };
  }

  /**
   * Get all positions
   */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  /**
   * Get positions by symbol
   */
  getPositionsBySymbol(symbol: string): Position[] {
    return this.getAllPositions().filter(position => position.symbol === symbol);
  }

  /**
   * Calculate position size for new trades
   */
  calculatePositionSize(
    symbol: string, 
    price: number, 
    riskAmount: number,
    stopLossPrice?: number
  ): number {
    // If stop loss is provided, calculate position size based on risk
    if (stopLossPrice) {
      const riskPerShare = Math.abs(price - stopLossPrice);
      if (riskPerShare > 0) {
        return Math.floor(riskAmount / riskPerShare);
      }
    }

    // Default: calculate based on maximum position value
    const maxPositionValue = riskAmount * 10; // 10x leverage example
    return Math.floor(maxPositionValue / price);
  }

  /**
   * Calculate portfolio risk metrics
   */
  calculateRiskMetrics(): RiskMetrics {
    const positions = this.getAllPositions();
    const totalValue = this.calculateTotalValue(positions);
    
    // Simple risk calculations - can be enhanced with more sophisticated models
    const var95 = totalValue * 0.05; // 5% VaR approximation
    const maxDrawdown = this.calculateMaxDrawdown(positions);
    const sharpeRatio = this.calculateSharpeRatio(positions);
    const beta = this.calculateBeta(positions);
    const correlation = this.calculateCorrelation(positions);

    return {
      var95,
      maxDrawdown,
      sharpeRatio,
      beta,
      correlation
    };
  }

  /**
   * Calculate maximum drawdown (simplified)
   */
  private calculateMaxDrawdown(positions: Position[]): number {
    // Simplified calculation - in practice would need historical data
    const totalUnrealized = positions.reduce((total, pos) => total + pos.unrealizedPnL, 0);
    return totalUnrealized < 0 ? Math.abs(totalUnrealized) : 0;
  }

  /**
   * Calculate Sharpe ratio (simplified)
   */
  private calculateSharpeRatio(positions: Position[]): number {
    // Simplified calculation - would need returns history and risk-free rate
    const avgReturn = 0.10; // 10% assumed average return
    const volatility = 0.15; // 15% assumed volatility
    const riskFreeRate = 0.02; // 2% risk-free rate
    
    return (avgReturn - riskFreeRate) / volatility;
  }

  /**
   * Calculate portfolio beta (simplified)
   */
  private calculateBeta(positions: Position[]): number {
    // Simplified - would need correlation with market index
    return 1.0; // Assume market neutral
  }

  /**
   * Calculate average correlation between positions (simplified)
   */
  private calculateCorrelation(positions: Position[]): number {
    // Simplified - would need actual correlation matrix
    return 0.3; // Assume moderate correlation
  }

  /**
   * Check if adding a position would violate risk limits
   */
  checkRiskLimits(
    newPosition: Partial<Position>, 
    maxPositionSize: number,
    maxPortfolioRisk: number
  ): { allowed: boolean; reason?: string } {
    const currentTotalValue = this.calculateTotalValue(this.getAllPositions());
    const newPositionValue = (newPosition.quantity || 0) * (newPosition.currentPrice || 0);
    
    // Check individual position size limit
    if (newPositionValue > maxPositionSize) {
      return {
        allowed: false,
        reason: `Position size ${newPositionValue} exceeds maximum ${maxPositionSize}`
      };
    }

    // Check portfolio concentration limit
    const newTotalValue = currentTotalValue + newPositionValue;
    const concentrationRisk = newPositionValue / newTotalValue;
    
    if (concentrationRisk > maxPortfolioRisk) {
      return {
        allowed: false,
        reason: `Position concentration ${(concentrationRisk * 100).toFixed(1)}% exceeds maximum ${(maxPortfolioRisk * 100).toFixed(1)}%`
      };
    }

    return { allowed: true };
  }

  /**
   * Get portfolio statistics
   */
  getStatistics(): PortfolioStatistics {
    const positions = this.getAllPositions();
    const totalValue = this.calculateTotalValue(positions);
    
    return {
      totalPositions: positions.length,
      totalValue,
      longPositions: positions.filter(p => p.side === 'long').length,
      shortPositions: positions.filter(p => p.side === 'short').length,
      optionPositions: positions.filter(p => p.type === 'option').length,
      stockPositions: positions.filter(p => p.type === 'stock').length,
      totalUnrealizedPnL: positions.reduce((total, p) => total + p.unrealizedPnL, 0),
      totalRealizedPnL: positions.reduce((total, p) => total + (p.realizedPnL || 0), 0),
      largestPosition: Math.max(...positions.map(p => p.marketValue)),
      smallestPosition: Math.min(...positions.map(p => p.marketValue))
    };
  }
}

export interface PortfolioStatistics {
  totalPositions: number;
  totalValue: number;
  longPositions: number;
  shortPositions: number;
  optionPositions: number;
  stockPositions: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  largestPosition: number;
  smallestPosition: number;
}

export default PortfolioManager;