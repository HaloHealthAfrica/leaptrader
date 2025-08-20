import cron from 'node-cron';
import { DataProvider, ScreeningResult, TradingSignal } from '../types';
import { LeapsStrategy } from '../strategy/LeapsStrategy';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { retry, processBatch } from '../utils/helpers';

interface DataClients {
  twelvedata: DataProvider;
  alpaca: DataProvider;
  tradier: DataProvider;
}

class ScreeningJob {
  private dataClients: DataClients;
  private strategy: LeapsStrategy;
  private isRunning = false;
  private currentTask: cron.ScheduledTask | null = null;
  
  // Universe of symbols to screen
  private screeningUniverse: string[] = [
    // Large Cap Tech
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'ADBE', 'CRM', 'ORCL', 'IBM',
    'INTC', 'AMD', 'QCOM', 'AVGO', 'TXN', 'INTU', 'NOW', 'SNOW', 'PLTR', 'COIN',
    
    // Financial
    'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BRK.B', 'V', 'MA', 'AXP',
    'COF', 'USB', 'PNC', 'TFC', 'BK', 'STT', 'SCHW', 'SPGI', 'MCO', 'ICE',
    
    // Healthcare & Pharma
    'JNJ', 'PFE', 'UNH', 'ABT', 'TMO', 'DHR', 'BMY', 'ABBV', 'MRK', 'LLY',
    'GILD', 'AMGN', 'BIIB', 'CVS', 'CI', 'HUM', 'ANTM', 'ZTS', 'DXCM', 'ISRG',
    
    // Consumer
    'AMZN', 'WMT', 'HD', 'LOW', 'TGT', 'COST', 'NKE', 'SBUX', 'MCD', 'DIS',
    'NFLX', 'CMCSA', 'VZ', 'T', 'TMUS', 'KO', 'PEP', 'PG', 'UL', 'PM',
    
    // Industrial & Energy
    'CAT', 'BA', 'GE', 'MMM', 'HON', 'UPS', 'FDX', 'LMT', 'RTX', 'NOC',
    'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'HAL', 'OXY', 'MPC', 'PSX', 'VLO',
    
    // ETFs
    'SPY', 'QQQ', 'IWM', 'EFA', 'EEM', 'VTI', 'VOO', 'VEA', 'VWO', 'GLD'
  ];

  constructor(dataClients: DataClients, strategy: LeapsStrategy) {
    this.dataClients = dataClients;
    this.strategy = strategy;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Screening job is already running');
      return;
    }

    logger.info('Starting screening job...');

    // Schedule screening runs
    // Daily screening at 6:00 AM EST (before market open)
    this.currentTask = cron.schedule('0 6 * * 1-5', async () => {
      await this.runDailyScreening();
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Intraday screening every 2 hours during market hours
    cron.schedule('0 10,12,14,16 * * 1-5', async () => {
      await this.runIntradayScreening();
    }, {
      timezone: 'America/New_York'
    });

    // Weekly deep screening on Sundays at 8:00 AM EST
    cron.schedule('0 8 * * 0', async () => {
      await this.runWeeklyScreening();
    }, {
      timezone: 'America/New_York'
    });

    this.currentTask.start();
    this.isRunning = true;

    // Run initial screening
    await this.runDailyScreening();

    logger.info('Screening job started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.currentTask) {
      this.currentTask.stop();
      this.currentTask = null;
    }

    this.isRunning = false;
    logger.info('Screening job stopped');
  }

  private async runDailyScreening(): Promise<void> {
    try {
      logger.info('Starting daily screening process...');
      const startTime = Date.now();

      // Screen for LEAPS opportunities
      const results = await this.screenForLeapsOpportunities();
      
      // Generate signals from screening results
      const signals = await this.generateSignalsFromResults(results);
      
      // Store results
      await this.storeScreeningResults(results, signals);
      
      const duration = Date.now() - startTime;
      logger.info(`Daily screening completed in ${duration}ms. Found ${signals.length} signals.`);

      // Update screening statistics
      this.updateScreeningStats('daily', duration, signals.length);

    } catch (error) {
      logger.error('Error in daily screening:', error);
    }
  }

  private async runIntradayScreening(): Promise<void> {
    try {
      logger.info('Starting intraday screening...');
      
      // Focus on symbols that showed signals in daily screening
      const existingSignals = await this.getExistingSignals();
      const symbolsToUpdate = existingSignals.map(s => s.symbol);
      
      if (symbolsToUpdate.length === 0) {
        logger.info('No existing signals to update');
        return;
      }

      // Update signals for existing positions
      const updatedSignals = await this.updateExistingSignals(symbolsToUpdate);
      
      logger.info(`Intraday screening completed. Updated ${updatedSignals.length} signals.`);

    } catch (error) {
      logger.error('Error in intraday screening:', error);
    }
  }

  private async runWeeklyScreening(): Promise<void> {
    try {
      logger.info('Starting weekly deep screening...');
      const startTime = Date.now();

      // Comprehensive screening with fundamental analysis
      const results = await this.runComprehensiveScreening();
      
      // Analyze market regime and sector rotation
      const marketAnalysis = await this.analyzeMarketRegime();
      
      // Generate weekly report
      await this.generateWeeklyReport(results, marketAnalysis);
      
      const duration = Date.now() - startTime;
      logger.info(`Weekly screening completed in ${duration}ms`);

    } catch (error) {
      logger.error('Error in weekly screening:', error);
    }
  }

  private async screenForLeapsOpportunities(): Promise<ScreeningResult[]> {
    logger.info(`Screening ${this.screeningUniverse.length} symbols for LEAPS opportunities...`);
    
    const results: ScreeningResult[] = [];
    
    // Process symbols in batches to avoid overwhelming APIs
    const batchResults = await processBatch(
      this.screeningUniverse,
      async (symbol) => await this.screenSymbol(symbol),
      10, // batch size
      200 // delay between batches (ms)
    );

    // Filter successful results
    for (const result of batchResults) {
      if (result && result.combinedScore >= 6.0) {
        results.push(result);
      }
    }

    // Sort by combined score
    results.sort((a, b) => b.combinedScore - a.combinedScore);
    
    logger.info(`Screening completed. ${results.length} symbols passed initial screening.`);
    return results.slice(0, 50); // Top 50 results
  }

  private async screenSymbol(symbol: string): Promise<ScreeningResult | null> {
    try {
      // Check cache first for recent screening results
      const cacheKey = `screening:${symbol}:${new Date().toDateString()}`;
      const cached = cache.get<ScreeningResult>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get fundamental analysis
      const fundamentalScreener = (this.strategy as any).fundamentalScreener;
      const fundamentals = await retry(
        () => fundamentalScreener.analyzeSymbol(symbol),
        { maxRetries: 2, baseDelay: 1000 }
      );

      // Get technical analysis
      const technicalScreener = (this.strategy as any).technicalScreener;
      const technicals = await retry(
        () => technicalScreener.analyzeSymbol(symbol),
        { maxRetries: 2, baseDelay: 1000 }
      );

      // Skip if scores are too low
      if (fundamentals.score < 5.0 || technicals.score < 5.0) {
        return null;
      }

      // Calculate combined score
      const combinedScore = (fundamentals.score * 0.6) + (technicals.score * 0.4);

      // Get LEAPS signals if score is promising
      let signals: TradingSignal[] = [];
      if (combinedScore >= 6.0) {
        signals = await this.strategy.generateSignals([symbol]);
      }

      const result: ScreeningResult = {
        symbol,
        fundamentals,
        technicals,
        combinedScore,
        rank: 0, // Will be set after sorting
        signals
      };

      // Cache result for the day
      cache.set(cacheKey, result, 86400); // 24 hours

      return result;

    } catch (error) {
      logger.warn(`Failed to screen ${symbol}:`, error.message);
      return null;
    }
  }

  private async generateSignalsFromResults(results: ScreeningResult[]): Promise<TradingSignal[]> {
    const allSignals: TradingSignal[] = [];
    
    for (const result of results) {
      if (result.signals && result.signals.length > 0) {
        // Filter signals by confidence threshold
        const highConfidenceSignals = result.signals.filter(s => s.confidence >= 7.0);
        allSignals.push(...highConfidenceSignals);
      }
    }
    
    // Sort by confidence and expected return
    allSignals.sort((a, b) => {
      const scoreA = a.confidence + (a.expectedReturn / 10);
      const scoreB = b.confidence + (b.expectedReturn / 10);
      return scoreB - scoreA;
    });
    
    return allSignals.slice(0, 25); // Top 25 signals
  }

  private async storeScreeningResults(results: ScreeningResult[], signals: TradingSignal[]): Promise<void> {
    // Store screening results
    const timestamp = new Date().toISOString();
    cache.set(`screening_results:${timestamp}`, results, 86400 * 7); // Keep for 7 days
    
    // Store latest results
    cache.set('latest_screening_results', results, 86400);
    cache.set('latest_screening_signals', signals, 86400);
    
    // Store by date for historical analysis
    const dateKey = new Date().toISOString().split('T')[0];
    cache.set(`screening:${dateKey}`, {
      results: results.slice(0, 20), // Top 20
      signals: signals.slice(0, 15), // Top 15 signals
      timestamp
    }, 86400 * 30); // Keep for 30 days
    
    logger.info(`Stored ${results.length} screening results and ${signals.length} signals`);
  }

  private async getExistingSignals(): Promise<TradingSignal[]> {
    const signals = cache.get<TradingSignal[]>('latest_screening_signals') || [];
    return signals.filter(s => s.action === 'buy' || s.action === 'sell');
  }

  private async updateExistingSignals(symbols: string[]): Promise<TradingSignal[]> {
    const updatedSignals: TradingSignal[] = [];
    
    for (const symbol of symbols) {
      try {
        const signals = await this.strategy.generateSignals([symbol]);
        updatedSignals.push(...signals);
      } catch (error) {
        logger.warn(`Failed to update signals for ${symbol}:`, error.message);
      }
    }
    
    // Update cache with new signals
    if (updatedSignals.length > 0) {
      cache.set('updated_signals', updatedSignals, 3600); // 1 hour
    }
    
    return updatedSignals;
  }

  private async runComprehensiveScreening(): Promise<ScreeningResult[]> {
    logger.info('Running comprehensive fundamental and technical screening...');
    
    // Expand universe for weekly screening
    const expandedUniverse = [
      ...this.screeningUniverse,
      // Add mid-cap stocks
      'SQ', 'ROKU', 'DOCU', 'ZM', 'SHOP', 'TWLO', 'OKTA', 'CRWD', 'NET', 'DDOG',
      'SNAP', 'PINS', 'UBER', 'LYFT', 'ABNB', 'DASH', 'RBLX', 'HOOD', 'SOFI', 'UPST'
    ];
    
    // Run screening with extended criteria
    const results = await processBatch(
      expandedUniverse,
      async (symbol) => await this.screenSymbolComprehensive(symbol),
      5, // smaller batch size for comprehensive analysis
      500 // longer delay
    );
    
    return results.filter(r => r !== null) as ScreeningResult[];
  }

  private async screenSymbolComprehensive(symbol: string): Promise<ScreeningResult | null> {
    try {
      // Run regular screening
      const result = await this.screenSymbol(symbol);
      if (!result) return null;
      
      // Add additional analysis for weekly screening
      const additionalMetrics = await this.getAdditionalMetrics(symbol);
      
      // Adjust score based on additional metrics
      const adjustedScore = this.adjustScoreWithAdditionalMetrics(
        result.combinedScore,
        additionalMetrics
      );
      
      return {
        ...result,
        combinedScore: adjustedScore
      };
      
    } catch (error) {
      logger.warn(`Comprehensive screening failed for ${symbol}:`, error.message);
      return null;
    }
  }

  private async getAdditionalMetrics(symbol: string): Promise<any> {
    // Get earnings calendar, analyst ratings, etc.
    try {
      const earnings = await (this.dataClients.twelvedata as any).getEarningsCalendar?.();
      const symbolEarnings = earnings?.filter((e: any) => e.symbol === symbol) || [];
      
      return {
        hasUpcomingEarnings: symbolEarnings.length > 0,
        earningsDate: symbolEarnings[0]?.date || null,
        // Add more metrics as needed
      };
    } catch (error) {
      return {};
    }
  }

  private adjustScoreWithAdditionalMetrics(baseScore: number, metrics: any): number {
    let adjustedScore = baseScore;
    
    // Reduce score if earnings are within 7 days (higher volatility)
    if (metrics.hasUpcomingEarnings && metrics.earningsDate) {
      const earningsDate = new Date(metrics.earningsDate);
      const daysDiff = (earningsDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      
      if (Math.abs(daysDiff) <= 7) {
        adjustedScore *= 0.9; // 10% penalty for earnings risk
      }
    }
    
    return Math.max(0, Math.min(10, adjustedScore));
  }

  private async analyzeMarketRegime(): Promise<any> {
    try {
      // Analyze broad market indicators
      const spyData = await this.dataClients.twelvedata.getHistoricalData('SPY', '3month');
      const vixQuote = await this.dataClients.twelvedata.getQuote('VIX');
      
      // Simple regime classification
      const recentPrices = spyData.data.slice(-20).map(d => d.close);
      const sma20 = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
      const currentPrice = recentPrices[recentPrices.length - 1];
      
      const regime = currentPrice > sma20 ? 'bullish' : 'bearish';
      const volatility = parseFloat(vixQuote?.price?.toString() || '20');
      const volatilityRegime = volatility > 25 ? 'high' : volatility < 15 ? 'low' : 'normal';
      
      return {
        trend: regime,
        volatility: volatilityRegime,
        vixLevel: volatility,
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.warn('Failed to analyze market regime:', error);
      return {
        trend: 'neutral',
        volatility: 'normal',
        vixLevel: 20,
        timestamp: new Date()
      };
    }
  }

  private async generateWeeklyReport(results: ScreeningResult[], marketAnalysis: any): Promise<void> {
    const report = {
      date: new Date().toISOString(),
      marketRegime: marketAnalysis,
      topOpportunities: results.slice(0, 10),
      sectorAnalysis: this.analyzeSectorDistribution(results),
      strategyRecommendations: this.generateStrategyRecommendations(marketAnalysis),
      riskWarnings: this.identifyRiskWarnings(results, marketAnalysis)
    };
    
    // Store weekly report
    const weekKey = this.getWeekKey();
    cache.set(`weekly_report:${weekKey}`, report, 86400 * 14); // Keep for 2 weeks
    cache.set('latest_weekly_report', report, 86400 * 7);
    
    logger.info('Weekly screening report generated');
  }

  private analyzeSectorDistribution(results: ScreeningResult[]): any {
    const sectorCounts: { [sector: string]: number } = {};
    
    // Simple sector mapping
    const sectorMap: { [symbol: string]: string } = {
      'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology',
      'JPM': 'Financial', 'BAC': 'Financial', 'GS': 'Financial',
      'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'UNH': 'Healthcare',
      // Add more mappings as needed
    };
    
    for (const result of results) {
      const sector = sectorMap[result.symbol] || 'Other';
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    }
    
    return sectorCounts;
  }

  private generateStrategyRecommendations(marketAnalysis: any): string[] {
    const recommendations: string[] = [];
    
    if (marketAnalysis.trend === 'bullish') {
      recommendations.push('Focus on stock replacement strategies with LEAPS calls');
      recommendations.push('Consider covered call strategies for income');
    } else {
      recommendations.push('Increase protective put allocation');
      recommendations.push('Consider iron condor strategies in range-bound markets');
    }
    
    if (marketAnalysis.volatility === 'high') {
      recommendations.push('Reduce position sizes due to high volatility');
      recommendations.push('Consider volatility-selling strategies');
    }
    
    return recommendations;
  }

  private identifyRiskWarnings(results: ScreeningResult[], marketAnalysis: any): string[] {
    const warnings: string[] = [];
    
    if (marketAnalysis.vixLevel > 30) {
      warnings.push('High volatility environment - increased risk');
    }
    
    if (results.length < 10) {
      warnings.push('Limited opportunities found - market may be overvalued');
    }
    
    return warnings;
  }

  private getWeekKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const week = Math.ceil(((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
    return `${year}-W${week}`;
  }

  private updateScreeningStats(type: string, duration: number, signalCount: number): void {
    const stats = cache.get('screening_stats') || {
      dailyRuns: 0,
      intradayRuns: 0,
      weeklyRuns: 0,
      avgDuration: {},
      totalSignals: 0
    };
    
    stats[`${type}Runs`]++;
    stats.avgDuration[type] = stats.avgDuration[type] || 0;
    stats.avgDuration[type] = (stats.avgDuration[type] + duration) / 2;
    stats.totalSignals += signalCount;
    stats.lastRun = new Date().toISOString();
    
    cache.set('screening_stats', stats, 86400 * 30); // Keep for 30 days
  }

  getStatus(): {
    isRunning: boolean;
    lastRun: Date | null;
    universeSize: number;
    stats: any;
  } {
    const stats = cache.get('screening_stats');
    
    return {
      isRunning: this.isRunning,
      lastRun: stats?.lastRun ? new Date(stats.lastRun) : null,
      universeSize: this.screeningUniverse.length,
      stats
    };
  }

  // Public methods for manual screening
  async runManualScreening(symbols: string[]): Promise<ScreeningResult[]> {
    logger.info(`Running manual screening for ${symbols.length} symbols...`);
    
    const results = await processBatch(
      symbols,
      async (symbol) => await this.screenSymbol(symbol),
      5,
      100
    );
    
    return results.filter(r => r !== null) as ScreeningResult[];
  }

  getLatestResults(): ScreeningResult[] {
    return cache.get<ScreeningResult[]>('latest_screening_results') || [];
  }

  getLatestSignals(): TradingSignal[] {
    return cache.get<TradingSignal[]>('latest_screening_signals') || [];
  }
}

// Global instance
let screeningJobInstance: ScreeningJob | null = null;

export function startScreeningJob(dataClients: DataClients, strategy: LeapsStrategy): void {
  if (screeningJobInstance) {
    logger.warn('Screening job already started');
    return;
  }

  screeningJobInstance = new ScreeningJob(dataClients, strategy);
  screeningJobInstance.start().catch(error => {
    logger.error('Failed to start screening job:', error);
  });
}

export function stopScreeningJob(): void {
  if (screeningJobInstance) {
    screeningJobInstance.stop();
    screeningJobInstance = null;
  }
}

export function getScreeningJobStatus() {
  return screeningJobInstance?.getStatus() || {
    isRunning: false,
    lastRun: null,
    universeSize: 0,
    stats: null
  };
}

export function getLatestScreeningResults(): ScreeningResult[] {
  return screeningJobInstance?.getLatestResults() || [];
}

export function getLatestScreeningSignals(): TradingSignal[] {
  return screeningJobInstance?.getLatestSignals() || [];
}
