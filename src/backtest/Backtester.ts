import { Logger } from '../utils/logger';
import { MLEngine } from '../core/ports';
import { OptionsDataRouter } from '../data/OptionsDataRouter';
import { ContractSelector } from '../strategy/leaps/ContractSelector';
import { FeatureBuilder } from '../features/FeatureBuilder';
// import { PortfolioManager } from '../portfolio/PortfolioManager'; // Not currently used

interface ContractData {
  symbol: string;
  underlying: string;
  right: string;
  strike: number;
  expiration: string;
  bid?: number;
  ask?: number;
  volume: number;
  openInterest: number;
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
}

interface TradingOpportunity {
  contract: ContractData;
  mlScore?: number;
  mlConfidence?: number;
}

interface ExitResult {
  date: string;
  exitPrice: number;
  reason: 'tp' | 'sl' | 'expiry' | 'manual';
}

interface SymbolStats {
  symbol: string;
  trades: number;
  wins: number;
  pnl: number;
  avgReturn: number;
  winRate?: number;
}

interface BacktestSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgReturnPerTrade: number;
  maxConsecutiveLosses: number;
}

interface Trade {
  date: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  holdDays: number;
  exitReason: 'tp' | 'sl' | 'expiry' | 'manual';
  mlScore?: number;
  mlConfidence?: number;
}

interface SymbolPerformance {
  symbol: string;
  trades: number;
  winRate: number;
  pnl: number;
  avgReturn: number;
}

export interface BacktestParams {
  symbols: string[];
  start: string; // ISO date
  end: string;   // ISO date
  side: 'long_call' | 'long_put';
  useML: boolean;
  ivRankGate?: [number, number]; // e.g., only trade when 20<=IVR<=80
  initialCapital: number;
  maxPositions: number;
  positionSizePercent: number;
}

export interface BacktestResult {
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    maxDrawdown: number;
    sharpeRatio: number;
    sortinoRatio: number;
    avgReturnPerTrade: number;
    maxConsecutiveLosses: number;
  };
  trades: Array<{
    date: string;
    symbol: string;
    side: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    holdDays: number;
    exitReason: 'tp' | 'sl' | 'expiry' | 'manual';
    mlScore?: number;
    mlConfidence?: number;
  }>;
  equity: Array<{
    date: string;
    value: number;
    drawdown: number;
  }>;
  bySymbol: Array<{
    symbol: string;
    trades: number;
    winRate: number;
    pnl: number;
    avgReturn: number;
  }>;
}

/**
 * Runs ML-enhanced backtests for LEAPS strategies
 * Compares rule-based vs ML-enhanced performance
 */
export class Backtester {
  private readonly log = new Logger('backtester');
  private readonly featureBuilder: FeatureBuilder;

  constructor(
    private readonly router: OptionsDataRouter,
    private readonly ml?: MLEngine
  ) {
    this.featureBuilder = new FeatureBuilder();
  }

  /**
   * Run a comprehensive backtest with optional ML enhancement
   */
  async run(params: BacktestParams): Promise<BacktestResult> {
    try {
      this.log.info('Starting backtest', { 
        symbols: params.symbols, 
        period: `${params.start} to ${params.end}`,
        useML: params.useML 
      });

      // For backtest, we don't use the complex ContractSelector
      const results: BacktestResult = {
        summary: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalPnL: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          sortinoRatio: 0,
          avgReturnPerTrade: 0,
          maxConsecutiveLosses: 0
        },
        trades: [],
        equity: [],
        bySymbol: []
      };

      let currentCapital = params.initialCapital;
      let maxCapital = currentCapital;
      let consecutiveLosses = 0;
      let maxConsecutiveLosses = 0;

      // Simulate trading day by day
      const dates = this.generateDateRange(params.start, params.end);
      
      for (const date of dates) {
        // Check if we should look for new opportunities
        if (results.trades.length < params.maxPositions) {
          for (const symbol of params.symbols) {
            try {
              const opportunity = await this.findOpportunity(
                symbol, 
                date, 
                params
              );

              if (opportunity) {
                const trade = await this.simulateTrade(
                  opportunity,
                  date,
                  params,
                  currentCapital
                );

                if (trade) {
                  results.trades.push(trade);
                  currentCapital += trade.pnl;
                  maxCapital = Math.max(maxCapital, currentCapital);

                  // Update consecutive losses
                  if (trade.pnl > 0) {
                    consecutiveLosses = 0;
                  } else {
                    consecutiveLosses++;
                    maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
                  }

                  // Update equity curve
                  results.equity.push({
                    date,
                    value: currentCapital,
                    drawdown: (maxCapital - currentCapital) / maxCapital
                  });
                }
              }
            } catch (error) {
              this.log.warn('Error processing symbol in backtest', error as Error, { symbol, date });
            }
          }
        }

        // Update existing positions
        results.trades = await this.updateExistingPositions(
          results.trades,
          date,
          params
        );
      }

      // Calculate final statistics
      results.summary = this.calculateSummary(results.trades, params.initialCapital);
      results.bySymbol = this.calculateBySymbol(results.trades);

      this.log.info('Backtest completed', {
        totalTrades: results.summary.totalTrades,
        winRate: results.summary.winRate.toFixed(2),
        totalPnL: results.summary.totalPnL.toFixed(2),
        sharpeRatio: results.summary.sharpeRatio.toFixed(2)
      });

      return results;

    } catch (error) {
      this.log.error('Backtest failed', error as Error, { params });
      throw error;
    }
  }

  /**
   * Find trading opportunity for a symbol on a given date
   */
  private async findOpportunity(
    symbol: string,
    date: string,
    params: BacktestParams
  ): Promise<TradingOpportunity | null> {
    try {
      // Get historical option chain (simplified - in production use historical data)
      const chain = await this.getHistoricalChain(symbol, date);
      if (!chain || chain.length === 0) return null;

      // Build selection criteria - simplified for backtest
      const selection = {
        symbol,
        side: params.side,
        minDelta: 0.5,
        maxDelta: 0.8,
        minDaysToExp: 90,
        maxDaysToExp: 730
      };
      
      // Apply IV Rank gate if specified
      if (params.ivRankGate) {
        const [minIVR, maxIVR] = params.ivRankGate;
        // In production, get historical IV Rank for this date
        const ivRank = 50; // Placeholder
        if (ivRank < minIVR || ivRank > maxIVR) return null;
      }

      // Use simple selection for backtest
      const pick: TradingOpportunity | null = chain && chain.length > 0 && chain[0] ? {
        contract: chain[0],
        mlScore: Math.random() * 0.5 + 0.5, // Mock score
        mlConfidence: Math.random() * 0.3 + 0.7 // Mock confidence
      } : null;

      return pick;

    } catch (error) {
      this.log.debug('No opportunity found', { symbol, date, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Simulate a trade from entry to exit
   */
  private async simulateTrade(
    opportunity: TradingOpportunity,
    entryDate: string,
    params: BacktestParams,
    currentCapital: number
  ): Promise<Trade | null> {
    try {
      const positionSize = (params.positionSizePercent / 100) * currentCapital;
      const contract = opportunity.contract;
      const entryPrice = ((contract.bid || 0) + (contract.ask || 0)) / 2;
      const quantity = Math.floor(positionSize / (entryPrice * 100));

      if (quantity <= 0) return null;

      // Simulate exit conditions
      const exitResult = await this.simulateExit(
        contract,
        entryDate,
        entryPrice,
        params
      );

      if (!exitResult) return null;

      const pnl = (exitResult.exitPrice - entryPrice) * quantity * 100;
      const holdDays = this.daysBetween(entryDate, exitResult.date);

      return {
        date: entryDate,
        symbol: contract.symbol,
        side: params.side,
        entryPrice,
        exitPrice: exitResult.exitPrice,
        quantity,
        pnl,
        holdDays,
        exitReason: exitResult.reason,
        mlScore: opportunity.mlScore,
        mlConfidence: opportunity.mlConfidence
      };

    } catch (error) {
      this.log.error('Trade simulation failed', error as Error, { opportunity, entryDate });
      return null;
    }
  }

  /**
   * Simulate exit conditions for a position
   */
  private async simulateExit(
    contract: ContractData,
    entryDate: string,
    entryPrice: number,
    params: BacktestParams
  ): Promise<ExitResult | null> {
    try {
      // Simplified exit simulation - in production use historical price data
      const maxHoldDays = 365; // Max hold for LEAPS
      const stopLoss = entryPrice * 0.65; // 35% stop loss
      const takeProfit = entryPrice * 2.0; // 100% take profit

      // Simulate daily price movements
      for (let day = 1; day <= maxHoldDays; day++) {
        const currentDate = this.addDays(entryDate, day);
        const currentPrice = this.simulatePrice(entryPrice, day, params.side);

        // Check exit conditions
        if (currentPrice <= stopLoss) {
          return { date: currentDate, exitPrice: stopLoss, reason: 'sl' as const };
        }
        if (currentPrice >= takeProfit) {
          return { date: currentDate, exitPrice: takeProfit, reason: 'tp' as const };
        }
        if (day === maxHoldDays) {
          return { date: currentDate, exitPrice: currentPrice, reason: 'expiry' as const };
        }
      }

      return null;

    } catch (error) {
      this.log.error('Exit simulation failed', error as Error, { contract, entryDate });
      return null;
    }
  }

  /**
   * Simulate price movement (simplified - replace with historical data)
   */
  private simulatePrice(entryPrice: number, days: number, side: string): number {
    // Simple random walk with drift
    const drift = side === 'long_call' ? 0.0001 : -0.0001; // Daily drift
    const volatility = 0.02; // Daily volatility
    
    let price = entryPrice;
    for (let i = 0; i < days; i++) {
      const random = (Math.random() - 0.5) * 2; // -1 to 1
      price *= (1 + drift + random * volatility);
    }
    
    return Math.max(0.01, price); // Ensure positive price
  }

  /**
   * Update existing positions (check for exits)
   */
  private async updateExistingPositions(
    trades: Trade[],
    currentDate: string,
    params: BacktestParams
  ): Promise<Trade[]> {
    // In production, this would check actual exit conditions
    // For now, return trades as-is
    return trades;
  }

  /**
   * Calculate backtest summary statistics
   */
  private calculateSummary(trades: Trade[], initialCapital: number): BacktestSummary {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        avgReturnPerTrade: 0,
        maxConsecutiveLosses: 0
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const returns = trades.map(t => t.pnl / (t.entryPrice * t.quantity * 100));

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: winningTrades.length / trades.length,
      totalPnL,
      maxDrawdown: this.calculateMaxDrawdown(trades, initialCapital),
      sharpeRatio: this.calculateSharpeRatio(returns),
      sortinoRatio: this.calculateSortinoRatio(returns),
      avgReturnPerTrade: totalPnL / trades.length,
      maxConsecutiveLosses: this.calculateMaxConsecutiveLosses(trades)
    };
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(trades: Trade[], initialCapital: number): number {
    let peak = initialCapital;
    let maxDrawdown = 0;
    let currentCapital = initialCapital;

    for (const trade of trades) {
      currentCapital += trade.pnl;
      if (currentCapital > peak) {
        peak = currentCapital;
      }
      const drawdown = (peak - currentCapital) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev === 0 ? 0 : avgReturn / stdDev;
  }

  /**
   * Calculate Sortino ratio
   */
  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < avgReturn);
    
    if (downsideReturns.length === 0) return 0;
    
    const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / downsideReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);
    
    return downsideDeviation === 0 ? 0 : avgReturn / downsideDeviation;
  }

  /**
   * Calculate maximum consecutive losses
   */
  private calculateMaxConsecutiveLosses(trades: Trade[]): number {
    let current = 0;
    let max = 0;

    for (const trade of trades) {
      if (trade.pnl <= 0) {
        current++;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }

    return max;
  }

  /**
   * Calculate statistics by symbol
   */
  private calculateBySymbol(trades: Trade[]): SymbolPerformance[] {
    const bySymbol = new Map<string, SymbolStats>();

    for (const trade of trades) {
      if (!bySymbol.has(trade.symbol)) {
        bySymbol.set(trade.symbol, {
          symbol: trade.symbol,
          trades: 0,
          wins: 0,
          pnl: 0,
          avgReturn: 0
        });
      }

      const stats = bySymbol.get(trade.symbol);
      if (stats) {
        stats.trades++;
        stats.pnl += trade.pnl;
        if (trade.pnl > 0) stats.wins++;
      }
    }

    // Calculate averages
    for (const stats of bySymbol.values()) {
      stats.winRate = stats.trades > 0 ? stats.wins / stats.trades : 0;
      stats.avgReturn = stats.trades > 0 ? stats.pnl / stats.trades : 0;
    }

    return Array.from(bySymbol.values()).map(stats => ({
      symbol: stats.symbol,
      trades: stats.trades,
      winRate: stats.winRate ?? 0,
      pnl: stats.pnl,
      avgReturn: stats.avgReturn
    }));
  }

  /**
   * Generate date range for backtest
   */
  private generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (dateStr) dates.push(dateStr);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  /**
   * Add days to a date string
   */
  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    const isoString = date.toISOString();
    const datePart = isoString.split('T')[0];
    return datePart ?? isoString;
  }

  /**
   * Calculate days between two date strings
   */
  private daysBetween(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get historical option chain (placeholder - replace with actual data)
   */
  private async getHistoricalChain(symbol: string, date: string): Promise<ContractData[]> {
    // In production, this would fetch historical option data
    // For now, return a mock chain
    return [
      {
        symbol: `${symbol}-C-100-2025-01-17`,
        underlying: symbol,
        right: 'call',
        strike: 100,
        expiration: '2025-01-17',
        bid: 5.0,
        ask: 5.5,
        volume: 1000,
        openInterest: 2000,
        greeks: { delta: 0.65, gamma: 0.02, theta: -0.03, vega: 0.12 }
      }
    ];
  }
}
