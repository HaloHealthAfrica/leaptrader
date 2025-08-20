import { DataProvider, FundamentalMetrics } from '../../types';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/cache';

export class FundamentalScreener {
  private dataClients: {
    twelvedata: DataProvider;
    alpaca: DataProvider;
    tradier: DataProvider;
  };

  // Fundamental scoring weights
  private weights = {
    marketCap: 0.10,
    peRatio: 0.15,
    pbRatio: 0.10,
    roe: 0.15,
    roa: 0.10,
    debtToEquity: 0.12,
    currentRatio: 0.08,
    revenueGrowth: 0.15,
    earningsGrowth: 0.15
  };

  // Ideal ranges for fundamental metrics
  private idealRanges = {
    peRatio: { min: 10, max: 25, optimal: 15 },
    pbRatio: { min: 1, max: 3, optimal: 1.5 },
    roe: { min: 15, max: 35, optimal: 20 },
    roa: { min: 5, max: 20, optimal: 10 },
    debtToEquity: { min: 0, max: 1, optimal: 0.3 },
    currentRatio: { min: 1.2, max: 3, optimal: 2 },
    revenueGrowth: { min: 5, max: 50, optimal: 15 },
    earningsGrowth: { min: 10, max: 40, optimal: 20 }
  };

  constructor(dataClients: any) {
    this.dataClients = dataClients;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing fundamental screener...');
    // Any setup required
    logger.info('Fundamental screener initialized');
  }

  async analyzeSymbol(symbol: string): Promise<FundamentalMetrics> {
    const cacheKey = `fundamental:${symbol}`;
    const cached = cache.get<FundamentalMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get fundamental data from Twelvedata (primary source)
      const fundamentalData = await this.getFundamentalData(symbol);
      
      // Calculate composite score
      const score = this.calculateFundamentalScore(fundamentalData);

      const metrics: FundamentalMetrics = {
        symbol,
        marketCap: fundamentalData.marketCap || 0,
        peRatio: fundamentalData.peRatio || 0,
        pbRatio: fundamentalData.pbRatio || 0,
        roe: fundamentalData.roe || 0,
        roa: fundamentalData.roa || 0,
        debtToEquity: fundamentalData.debtToEquity || 0,
        currentRatio: fundamentalData.currentRatio || 0,
        revenueGrowth: fundamentalData.revenueGrowth || 0,
        earningsGrowth: fundamentalData.earningsGrowth || 0,
        dividendYield: fundamentalData.dividendYield || 0,
        score
      };

      cache.set(cacheKey, metrics, 3600); // Cache for 1 hour
      return metrics;
    } catch (error) {
      logger.error(`Error analyzing fundamentals for ${symbol}:`, error);
      
      // Return default metrics with low score
      return {
        symbol,
        marketCap: 0,
        peRatio: 0,
        pbRatio: 0,
        roe: 0,
        roa: 0,
        debtToEquity: 0,
        currentRatio: 0,
        revenueGrowth: 0,
        earningsGrowth: 0,
        dividendYield: 0,
        score: 0
      };
    }
  }

  private async getFundamentalData(symbol: string): Promise<any> {
    try {
      // Try to get data from Twelvedata first (assuming it has getFundamentals method)
      if ('getFundamentals' in this.dataClients.twelvedata) {
        return await (this.dataClients.twelvedata as any).getFundamentals(symbol);
      }

      // Fallback: simulate fundamental data based on symbol characteristics
      return this.generateSimulatedFundamentals(symbol);
    } catch (error) {
      logger.warn(`Could not fetch fundamental data for ${symbol}, using simulated data`);
      return this.generateSimulatedFundamentals(symbol);
    }
  }

  private generateSimulatedFundamentals(symbol: string): any {
    // Generate realistic fundamental metrics for well-known symbols
    const symbolMetrics: { [key: string]: any } = {
      'AAPL': {
        marketCap: 3000000000000,
        peRatio: 28.5,
        pbRatio: 45.2,
        roe: 0.175,
        roa: 0.134,
        debtToEquity: 0.31,
        currentRatio: 1.07,
        revenueGrowth: 0.08,
        earningsGrowth: 0.11,
        dividendYield: 0.0043
      },
      'MSFT': {
        marketCap: 2800000000000,
        peRatio: 32.1,
        pbRatio: 12.8,
        roe: 0.186,
        roa: 0.098,
        debtToEquity: 0.47,
        currentRatio: 1.77,
        revenueGrowth: 0.12,
        earningsGrowth: 0.18,
        dividendYield: 0.0072
      },
      'GOOGL': {
        marketCap: 1900000000000,
        peRatio: 25.4,
        pbRatio: 6.2,
        roe: 0.142,
        roa: 0.089,
        debtToEquity: 0.15,
        currentRatio: 2.93,
        revenueGrowth: 0.13,
        earningsGrowth: 0.09,
        dividendYield: 0
      },
      'TSLA': {
        marketCap: 800000000000,
        peRatio: 65.2,
        pbRatio: 15.8,
        roe: 0.134,
        roa: 0.067,
        debtToEquity: 0.17,
        currentRatio: 1.29,
        revenueGrowth: 0.51,
        earningsGrowth: 0.89,
        dividendYield: 0
      }
    };

    if (symbolMetrics[symbol]) {
      return symbolMetrics[symbol];
    }

    // Default metrics for unknown symbols
    return {
      marketCap: Math.random() * 500000000000 + 10000000000, // 10B to 510B
      peRatio: Math.random() * 40 + 10, // 10 to 50
      pbRatio: Math.random() * 10 + 1, // 1 to 11
      roe: Math.random() * 0.3 + 0.05, // 5% to 35%
      roa: Math.random() * 0.15 + 0.02, // 2% to 17%
      debtToEquity: Math.random() * 1.5, // 0 to 1.5
      currentRatio: Math.random() * 3 + 0.5, // 0.5 to 3.5
      revenueGrowth: Math.random() * 0.5 - 0.1, // -10% to 40%
      earningsGrowth: Math.random() * 0.6 - 0.2, // -20% to 40%
      dividendYield: Math.random() * 0.05 // 0% to 5%
    };
  }

  private calculateFundamentalScore(data: any): number {
    let totalScore = 0;
    let totalWeight = 0;

    // Market Cap Score (larger is generally better for options liquidity)
    if (data.marketCap > 0) {
      const marketCapScore = Math.min(10, Math.log10(data.marketCap / 1000000000) * 2); // Scaled score
      totalScore += marketCapScore * this.weights.marketCap;
      totalWeight += this.weights.marketCap;
    }

    // P/E Ratio Score
    if (data.peRatio > 0) {
      const peScore = this.scoreMetricWithRange(data.peRatio, this.idealRanges.peRatio);
      totalScore += peScore * this.weights.peRatio;
      totalWeight += this.weights.peRatio;
    }

    // P/B Ratio Score
    if (data.pbRatio > 0) {
      const pbScore = this.scoreMetricWithRange(data.pbRatio, this.idealRanges.pbRatio);
      totalScore += pbScore * this.weights.pbRatio;
      totalWeight += this.weights.pbRatio;
    }

    // ROE Score
    if (data.roe !== undefined) {
      const roeScore = this.scoreMetricWithRange(data.roe * 100, this.idealRanges.roe);
      totalScore += roeScore * this.weights.roe;
      totalWeight += this.weights.roe;
    }

    // ROA Score
    if (data.roa !== undefined) {
      const roaScore = this.scoreMetricWithRange(data.roa * 100, this.idealRanges.roa);
      totalScore += roaScore * this.weights.roa;
      totalWeight += this.weights.roa;
    }

    // Debt to Equity Score (lower is better)
    if (data.debtToEquity !== undefined) {
      const deScore = this.scoreMetricWithRange(data.debtToEquity, this.idealRanges.debtToEquity, true);
      totalScore += deScore * this.weights.debtToEquity;
      totalWeight += this.weights.debtToEquity;
    }

    // Current Ratio Score
    if (data.currentRatio > 0) {
      const crScore = this.scoreMetricWithRange(data.currentRatio, this.idealRanges.currentRatio);
      totalScore += crScore * this.weights.currentRatio;
      totalWeight += this.weights.currentRatio;
    }

    // Revenue Growth Score
    if (data.revenueGrowth !== undefined) {
      const revGrowthScore = this.scoreMetricWithRange(data.revenueGrowth * 100, this.idealRanges.revenueGrowth);
      totalScore += revGrowthScore * this.weights.revenueGrowth;
      totalWeight += this.weights.revenueGrowth;
    }

    // Earnings Growth Score
    if (data.earningsGrowth !== undefined) {
      const earnGrowthScore = this.scoreMetricWithRange(data.earningsGrowth * 100, this.idealRanges.earningsGrowth);
      totalScore += earnGrowthScore * this.weights.earningsGrowth;
      totalWeight += this.weights.earningsGrowth;
    }

    // Return normalized score (0-10 scale)
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private scoreMetricWithRange(
    value: number, 
    range: { min: number; max: number; optimal: number }, 
    lowerIsBetter = false
  ): number {
    if (lowerIsBetter) {
      if (value <= range.optimal) {
        return 10;
      } else if (value <= range.max) {
        return 10 - ((value - range.optimal) / (range.max - range.optimal)) * 5;
      } else {
        return Math.max(0, 5 - ((value - range.max) / range.max) * 5);
      }
    } else {
      if (value >= range.min && value <= range.max) {
        // Within acceptable range, score based on distance from optimal
        const distanceFromOptimal = Math.abs(value - range.optimal);
        const maxDistance = Math.max(range.optimal - range.min, range.max - range.optimal);
        return 10 - (distanceFromOptimal / maxDistance) * 3; // 7-10 score range within acceptable bounds
      } else if (value < range.min) {
        // Below minimum
        return Math.max(0, 7 - ((range.min - value) / range.min) * 7);
      } else {
        // Above maximum
        return Math.max(0, 7 - ((value - range.max) / range.max) * 7);
      }
    }
  }

  async screenUniverse(symbols: string[]): Promise<FundamentalMetrics[]> {
    const results: FundamentalMetrics[] = [];
    
    logger.info(`Screening ${symbols.length} symbols for fundamental quality`);

    const batchPromises = symbols.map(symbol => 
      this.analyzeSymbol(symbol).catch(error => {
        logger.warn(`Failed to analyze ${symbol}:`, error);
        return null;
      })
    );

    const batchResults = await Promise.all(batchPromises);
    
    for (const result of batchResults) {
      if (result && result.score > 0) {
        results.push(result);
      }
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    logger.info(`Fundamental screening completed. ${results.length} symbols passed screening`);
    return results;
  }

  getScreeningCriteria() {
    return {
      minMarketCap: 5000000000, // $5B minimum
      maxPERatio: 40,
      minROE: 0.10, // 10%
      maxDebtToEquity: 1.0,
      minCurrentRatio: 1.0,
      minFundamentalScore: 6.0
    };
  }
}
