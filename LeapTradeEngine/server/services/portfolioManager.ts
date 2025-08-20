import { Portfolio, Position, InsertPosition, MarketData } from "@shared/schema";
import { storage } from "../storage";
import { MarketDataService } from "./marketData";

export class PortfolioManagerService {
  private marketDataService: MarketDataService;

  constructor() {
    this.marketDataService = new MarketDataService();
  }

  async createDefaultPortfolio(): Promise<Portfolio> {
    const portfolio = await storage.createPortfolio({
      name: "LEAP Trading Portfolio",
      totalValue: 1000000, // $1M starting capital
      cashBalance: 1000000,
      performance: {
        totalReturn: 0,
        totalReturnPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
      },
      risk: {
        beta: 1.0,
        var: 0,
        exposureByStrategy: {},
        exposureBySector: {},
      },
    });

    return portfolio;
  }

  async updatePortfolioValues(): Promise<void> {
    const portfolios = await storage.getAllPortfolios();
    
    for (const portfolio of portfolios) {
      await this.updateSinglePortfolio(portfolio.id);
    }
  }

  async updateSinglePortfolio(portfolioId: string): Promise<Portfolio | null> {
    const portfolio = await storage.getPortfolio(portfolioId);
    if (!portfolio) return null;

    const positions = await storage.getPositionsByPortfolio(portfolioId);
    if (positions.length === 0) return portfolio;

    // Get current market data for all positions
    const symbols = [...new Set(positions.map(pos => pos.symbol))];
    const marketData = await this.marketDataService.getMultipleQuotes(symbols);
    const priceMap = new Map(marketData.map(data => [data.symbol, data.price]));

    let totalValue = portfolio.cashBalance;
    let totalUnrealizedPnL = 0;
    let totalRealizedPnL = 0;

    // Update each position with current market prices
    for (const position of positions) {
      const currentPrice = priceMap.get(position.symbol) || position.currentPrice;
      const marketValue = Math.abs(position.quantity) * currentPrice;
      const unrealizedPnL = this.calculateUnrealizedPnL(position, currentPrice);

      await storage.updatePosition(position.id, {
        currentPrice,
        marketValue,
        unrealizedPnL,
      });

      totalValue += marketValue;
      totalUnrealizedPnL += unrealizedPnL;
      totalRealizedPnL += position.realizedPnL;
    }

    // Calculate performance metrics
    const initialValue = 1000000; // Starting capital
    const totalReturn = totalValue - initialValue;
    const totalReturnPercent = (totalReturn / initialValue) * 100;

    // Calculate day change (simplified)
    const dayChange = totalUnrealizedPnL * 0.1; // Estimate
    const dayChangePercent = (dayChange / totalValue) * 100;

    // Update portfolio
    const updatedPortfolio = await storage.updatePortfolio(portfolioId, {
      totalValue,
      performance: {
        totalReturn,
        totalReturnPercent,
        dayChange,
        dayChangePercent,
        maxDrawdown: this.calculateMaxDrawdown(portfolio),
        sharpeRatio: this.calculateSharpeRatio(portfolio),
        winRate: await this.calculateWinRate(portfolioId),
      },
      risk: {
        ...portfolio.risk,
        exposureByStrategy: await this.calculateStrategyExposure(portfolioId),
        exposureBySector: await this.calculateSectorExposure(portfolioId),
      },
    });

    return updatedPortfolio;
  }

  private calculateUnrealizedPnL(position: Position, currentPrice: number): number {
    const direction = position.side === 'long' ? 1 : -1;
    return direction * position.quantity * (currentPrice - position.entryPrice);
  }

  private calculateMaxDrawdown(portfolio: Portfolio): number {
    // Simplified calculation - in production would track historical values
    return Math.min(0, portfolio.performance.totalReturnPercent * 0.3);
  }

  private calculateSharpeRatio(portfolio: Portfolio): number {
    // Simplified calculation - in production would use historical returns
    const riskFreeRate = 0.05; // 5% risk-free rate
    const excessReturn = portfolio.performance.totalReturnPercent / 100 - riskFreeRate;
    const volatility = Math.abs(portfolio.performance.totalReturnPercent) / 100 * 0.2; // Estimate
    return volatility > 0 ? excessReturn / volatility : 0;
  }

  private async calculateWinRate(portfolioId: string): Promise<number> {
    const positions = await storage.getPositionsByPortfolio(portfolioId);
    const closedPositions = positions.filter(pos => pos.closeDate);
    
    if (closedPositions.length === 0) return 0;
    
    const winningPositions = closedPositions.filter(pos => pos.realizedPnL > 0);
    return (winningPositions.length / closedPositions.length) * 100;
  }

  private async calculateStrategyExposure(portfolioId: string): Promise<Record<string, number>> {
    const positions = await storage.getPositionsByPortfolio(portfolioId);
    const portfolio = await storage.getPortfolio(portfolioId);
    
    if (!portfolio) return {};

    const strategyExposure: Record<string, number> = {};
    
    for (const position of positions) {
      if (position.strategyId) {
        const signals = await storage.getAllTradingSignals();
        const signal = signals.find(s => s.id === position.strategyId);
        
        if (signal) {
          const strategy = signal.strategy;
          const exposure = (position.marketValue / portfolio.totalValue) * 100;
          strategyExposure[strategy] = (strategyExposure[strategy] || 0) + exposure;
        }
      }
    }
    
    return strategyExposure;
  }

  private async calculateSectorExposure(portfolioId: string): Promise<Record<string, number>> {
    const positions = await storage.getPositionsByPortfolio(portfolioId);
    const portfolio = await storage.getPortfolio(portfolioId);
    
    if (!portfolio) return {};

    // Simplified sector mapping - in production would use real sector data
    const sectorMap: Record<string, string> = {
      'AAPL': 'Technology',
      'MSFT': 'Technology',
      'GOOGL': 'Technology',
      'AMZN': 'Consumer',
      'TSLA': 'Automotive',
      'META': 'Technology',
      'NVDA': 'Technology',
      'NFLX': 'Media',
    };

    const sectorExposure: Record<string, number> = {};
    
    for (const position of positions) {
      const sector = sectorMap[position.symbol] || 'Other';
      const exposure = (position.marketValue / portfolio.totalValue) * 100;
      sectorExposure[sector] = (sectorExposure[sector] || 0) + exposure;
    }
    
    return sectorExposure;
  }

  async addPosition(portfolioId: string, positionData: Omit<InsertPosition, 'portfolioId'>): Promise<Position> {
    return await storage.createPosition({
      ...positionData,
      portfolioId,
    });
  }

  async closePosition(positionId: string, closePrice: number): Promise<Position | null> {
    const position = await storage.getPosition(positionId);
    if (!position) return null;

    const realizedPnL = this.calculateUnrealizedPnL(position, closePrice);
    
    return await storage.updatePosition(positionId, {
      closeDate: new Date(),
      currentPrice: closePrice,
      realizedPnL,
      unrealizedPnL: 0,
    });
  }

  async getPortfolioSummary(portfolioId: string): Promise<any> {
    const portfolio = await storage.getPortfolio(portfolioId);
    const positions = await storage.getPositionsByPortfolio(portfolioId);
    const activeSignals = await storage.getActiveSignals();

    if (!portfolio) return null;

    return {
      portfolio,
      positionCount: positions.length,
      activeSignalCount: activeSignals.length,
      positions: positions.slice(0, 10), // Recent positions
    };
  }
}
