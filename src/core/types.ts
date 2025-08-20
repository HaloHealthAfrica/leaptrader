/**
 * Core type definitions for the LeapTrader system
 * Shared types used across multiple modules
 */

export interface OptionContract {
  symbol: string;
  underlying: string;
  strike: number;
  expiration: string; // ISO date string
  right: 'call' | 'put';
  bid?: number;
  ask?: number;
  last?: number;
  volume?: number;
  openInterest?: number;
  iv?: number; // implied volatility
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
}

export interface LeapsPick {
  id: string;
  underlying: string;
  contract: OptionContract;
  strategy: 'long_call' | 'long_put' | 'covered_call' | 'protective_put';
  confidence: number; // 0-1
  targetPrice?: number;
  stopPrice?: number;
  timeHorizon: number; // days
  riskReward: {
    risk: number;
    reward: number;
    ratio: number;
  };
  rationale: string[];
  metadata: {
    selectedAt: string; // ISO timestamp
    expiresAt: string; // ISO timestamp
    source: string; // ML model version or manual
    features?: Record<string, any>;
  };
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  change?: number;
  changePercent?: number;
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL?: number;
  side: 'long' | 'short';
  type: 'stock' | 'option';
  openedAt: string;
  closedAt?: string;
}

export interface Portfolio {
  id: string;
  name: string;
  totalValue: number;
  cashBalance: number;
  positions: Position[];
  performance: {
    totalReturn: number;
    totalReturnPercent: number;
    dayChange: number;
    dayChangePercent: number;
  };
}

export interface RiskMetrics {
  var95: number; // Value at Risk
  maxDrawdown: number;
  sharpeRatio: number;
  beta: number;
  correlation: number;
}

export interface BacktestResult {
  strategy: string;
  period: {
    start: string;
    end: string;
  };
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  trades: number;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  signal: 'buy' | 'sell' | 'hold';
  strength: number; // 0-100
  timestamp: string;
  metadata: Record<string, any>;
}

export interface ConfigurationSettings {
  riskLimits: {
    maxPositionSize: number;
    maxDrawdown: number;
    stopLoss: number;
  };
  tradingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  apiKeys: Record<string, string>;
}

export interface MLModelConfig {
  name: string;
  version: string;
  enabled: boolean;
  parameters: Record<string, any>;
  endpoints?: {
    training?: string;
    inference: string;
    health: string;
  };
}

export interface ScreeningCriteria {
  fundamental?: {
    minMarketCap?: number;
    maxMarketCap?: number;
    minPE?: number;
    maxPE?: number;
    sectors?: string[];
  };
  technical?: {
    rsi?: { min?: number; max?: number };
    macd?: 'bullish' | 'bearish' | 'neutral';
    trend?: 'up' | 'down' | 'sideways';
  };
  options?: {
    minIV?: number;
    maxIV?: number;
    minDelta?: number;
    maxDelta?: number;
    minDTE?: number;
    maxDTE?: number;
  };
}

export interface ScreeningResult {
  symbol: string;
  score: number;
  matchedCriteria: string[];
  data: MarketData;
  recommendation: 'buy' | 'sell' | 'hold';
}