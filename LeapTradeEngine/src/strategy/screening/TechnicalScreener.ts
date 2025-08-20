import { DataProvider, TechnicalMetrics, HistoricalData } from '../../types';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/cache';

export class TechnicalScreener {
  private dataClients: {
    twelvedata: DataProvider;
    alpaca: DataProvider;
    tradier: DataProvider;
  };

  // Technical indicator weights for scoring
  private weights = {
    rsi: 0.15,
    macd: 0.20,
    movingAverages: 0.15,
    bollingerBands: 0.10,
    momentum: 0.15,
    volatility: 0.10,
    volume: 0.15
  };

  constructor(dataClients: any) {
    this.dataClients = dataClients;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing technical screener...');
    logger.info('Technical screener initialized');
  }

  async analyzeSymbol(symbol: string): Promise<TechnicalMetrics> {
    const cacheKey = `technical:${symbol}`;
    const cached = cache.get<TechnicalMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get historical data for technical analysis
      const historicalData = await this.dataClients.twelvedata.getHistoricalData(symbol, '6month', '1day');
      
      if (!historicalData.data || historicalData.data.length < 50) {
        throw new Error('Insufficient historical data for technical analysis');
      }

      // Calculate technical indicators
      const indicators = await this.calculateTechnicalIndicators(historicalData);
      
      // Calculate composite technical score
      const score = this.calculateTechnicalScore(indicators);

      const metrics: TechnicalMetrics = {
        symbol,
        rsi: indicators.rsi,
        macd: indicators.macd,
        macdSignal: indicators.macdSignal,
        bollingerUpper: indicators.bollingerUpper,
        bollingerLower: indicators.bollingerLower,
        sma20: indicators.sma20,
        sma50: indicators.sma50,
        sma200: indicators.sma200,
        momentum: indicators.momentum,
        volatility: indicators.volatility,
        score
      };

      cache.set(cacheKey, metrics, 1800); // Cache for 30 minutes
      return metrics;
    } catch (error) {
      logger.error(`Error analyzing technical indicators for ${symbol}:`, error);
      
      // Return default metrics with low score
      return {
        symbol,
        rsi: 50,
        macd: 0,
        macdSignal: 0,
        bollingerUpper: 0,
        bollingerLower: 0,
        sma20: 0,
        sma50: 0,
        sma200: 0,
        momentum: 0,
        volatility: 0,
        score: 0
      };
    }
  }

  private async calculateTechnicalIndicators(historicalData: HistoricalData): Promise<any> {
    const prices = historicalData.data.map(d => d.close);
    const highs = historicalData.data.map(d => d.high);
    const lows = historicalData.data.map(d => d.low);
    const volumes = historicalData.data.map(d => d.volume);
    
    if (prices.length < 50) {
      throw new Error('Insufficient data for technical analysis');
    }

    const currentPrice = prices[prices.length - 1];
    
    // RSI (14-period)
    const rsi = this.calculateRSI(prices, 14);
    
    // MACD (12, 26, 9)
    const macd = this.calculateMACD(prices, 12, 26, 9);
    
    // Moving Averages
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const sma200 = this.calculateSMA(prices, 200);
    
    // Bollinger Bands (20-period, 2 std dev)
    const bollinger = this.calculateBollingerBands(prices, 20, 2);
    
    // Momentum (10-period rate of change)
    const momentum = this.calculateMomentum(prices, 10);
    
    // Volatility (20-period standard deviation)
    const volatility = this.calculateVolatility(prices, 20);

    return {
      rsi: rsi[rsi.length - 1],
      macd: macd.macd[macd.macd.length - 1],
      macdSignal: macd.signal[macd.signal.length - 1],
      bollingerUpper: bollinger.upper[bollinger.upper.length - 1],
      bollingerLower: bollinger.lower[bollinger.lower.length - 1],
      sma20: sma20[sma20.length - 1],
      sma50: sma50[sma50.length - 1],
      sma200: sma200[sma200.length - 1],
      momentum: momentum[momentum.length - 1],
      volatility: volatility[volatility.length - 1],
      currentPrice
    };
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  }

  private calculateMACD(prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): any {
    const emaFast = this.calculateEMA(prices, fastPeriod);
    const emaSlow = this.calculateEMA(prices, slowPeriod);
    
    const macdLine: number[] = [];
    for (let i = 0; i < emaFast.length; i++) {
      if (i < emaSlow.length) {
        macdLine.push(emaFast[i] - emaSlow[i]);
      }
    }
    
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine.map((m, i) => i < signalLine.length ? m - signalLine[i] : 0)
    };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    ema[0] = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b);
      sma.push(sum / period);
    }
    
    return sma;
  }

  private calculateBollingerBands(prices: number[], period: number, stdDev: number): any {
    const sma = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      
      const smaIndex = i - period + 1;
      if (smaIndex < sma.length) {
        upper.push(sma[smaIndex] + (std * stdDev));
        lower.push(sma[smaIndex] - (std * stdDev));
      }
    }
    
    return { upper, lower };
  }

  private calculateMomentum(prices: number[], period: number): number[] {
    const momentum: number[] = [];
    
    for (let i = period; i < prices.length; i++) {
      momentum.push(((prices[i] - prices[i - period]) / prices[i - period]) * 100);
    }
    
    return momentum;
  }

  private calculateVolatility(prices: number[], period: number): number[] {
    const volatility: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const returns = [];
      
      for (let j = 1; j < slice.length; j++) {
        returns.push((slice[j] - slice[j - 1]) / slice[j - 1]);
      }
      
      const mean = returns.reduce((a, b) => a + b) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
      volatility.push(Math.sqrt(variance) * Math.sqrt(252)); // Annualized volatility
    }
    
    return volatility;
  }

  private calculateTechnicalScore(indicators: any): number {
    let totalScore = 0;
    let totalWeight = 0;

    // RSI Score (30-70 range is ideal, extreme values are concerning)
    const rsiScore = this.scoreRSI(indicators.rsi);
    totalScore += rsiScore * this.weights.rsi;
    totalWeight += this.weights.rsi;

    // MACD Score (bullish when MACD > signal)
    const macdScore = this.scoreMACDCrossover(indicators.macd, indicators.macdSignal);
    totalScore += macdScore * this.weights.macd;
    totalWeight += this.weights.macd;

    // Moving Average Score (bullish when price > MA and shorter MA > longer MA)
    const maScore = this.scoreMovingAverages(indicators.currentPrice, indicators.sma20, indicators.sma50, indicators.sma200);
    totalScore += maScore * this.weights.movingAverages;
    totalWeight += this.weights.movingAverages;

    // Bollinger Bands Score
    const bbScore = this.scoreBollingerPosition(indicators.currentPrice, indicators.bollingerUpper, indicators.bollingerLower);
    totalScore += bbScore * this.weights.bollingerBands;
    totalWeight += this.weights.bollingerBands;

    // Momentum Score
    const momentumScore = this.scoreMomentum(indicators.momentum);
    totalScore += momentumScore * this.weights.momentum;
    totalWeight += this.weights.momentum;

    // Volatility Score (moderate volatility is preferred)
    const volScore = this.scoreVolatility(indicators.volatility);
    totalScore += volScore * this.weights.volatility;
    totalWeight += this.weights.volatility;

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private scoreRSI(rsi: number): number {
    if (rsi >= 40 && rsi <= 60) {
      return 10; // Neutral zone - good for LEAP strategies
    } else if (rsi >= 30 && rsi <= 70) {
      return 8; // Normal range
    } else if (rsi > 70 && rsi <= 80) {
      return 6; // Overbought but not extreme
    } else if (rsi >= 20 && rsi < 30) {
      return 6; // Oversold but not extreme
    } else {
      return 3; // Extreme levels
    }
  }

  private scoreMACDCrossover(macd: number, signal: number): number {
    const diff = macd - signal;
    
    if (diff > 0) {
      return Math.min(10, 7 + (diff * 10)); // Bullish crossover
    } else {
      return Math.max(0, 7 + (diff * 10)); // Bearish crossover
    }
  }

  private scoreMovingAverages(price: number, sma20: number, sma50: number, sma200: number): number {
    let score = 0;
    
    // Price above moving averages
    if (price > sma20) score += 2;
    if (price > sma50) score += 2;
    if (price > sma200) score += 2;
    
    // Moving average alignment (bullish when shorter > longer)
    if (sma20 > sma50) score += 2;
    if (sma50 > sma200) score += 2;
    
    return score;
  }

  private scoreBollingerPosition(price: number, upper: number, lower: number): number {
    const bandwidth = upper - lower;
    const position = (price - lower) / bandwidth;
    
    if (position >= 0.2 && position <= 0.8) {
      return 10; // Good position within bands
    } else if (position < 0.1 || position > 0.9) {
      return 5; // Near extremes - potential reversal
    } else {
      return 7; // Moderate position
    }
  }

  private scoreMomentum(momentum: number): number {
    if (momentum > 5 && momentum < 25) {
      return 10; // Good positive momentum
    } else if (momentum > 0 && momentum <= 5) {
      return 8; // Mild positive momentum
    } else if (momentum >= -5 && momentum <= 0) {
      return 6; // Neutral to slightly negative
    } else if (momentum < -5 && momentum > -15) {
      return 4; // Negative momentum
    } else {
      return 2; // Extreme momentum (could be unsustainable)
    }
  }

  private scoreVolatility(volatility: number): number {
    // Moderate volatility is preferred for LEAPS strategies
    if (volatility >= 0.15 && volatility <= 0.35) {
      return 10; // Ideal volatility range
    } else if (volatility >= 0.10 && volatility < 0.15) {
      return 7; // Low volatility
    } else if (volatility > 0.35 && volatility <= 0.50) {
      return 7; // Elevated volatility
    } else if (volatility < 0.10) {
      return 5; // Very low volatility
    } else {
      return 3; // Very high volatility
    }
  }

  async screenUniverse(symbols: string[]): Promise<TechnicalMetrics[]> {
    const results: TechnicalMetrics[] = [];
    
    logger.info(`Screening ${symbols.length} symbols for technical quality`);

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

    logger.info(`Technical screening completed. ${results.length} symbols passed screening`);
    return results;
  }

  getScreeningCriteria() {
    return {
      minRSI: 25,
      maxRSI: 75,
      minTechnicalScore: 6.0,
      preferredVolatility: { min: 0.15, max: 0.35 },
      requireBullishMA: false, // LEAPS can work in various market conditions
      minMomentum: -10
    };
  }
}
