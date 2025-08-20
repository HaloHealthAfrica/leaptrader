// Market Data Types
export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  beta?: number;
  timestamp: Date;
}

export interface OptionData {
  symbol: string;
  underlying: string;
  strike: number;
  expiration: Date;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

// Strategy Types
export interface StrategySignal {
  id: string;
  symbol: string;
  strategy: StrategyType;
  action: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-100
  entry: {
    price: number;
    timestamp: Date;
  };
  target: {
    price: number;
    probability: number;
  };
  stop: {
    price: number;
    type: 'fixed' | 'trailing';
  };
  position: {
    quantity: number;
    value: number;
  };
  expiration: Date;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  metadata: Record<string, any>;
}

export type StrategyType = 
  | 'stock_replacement' 
  | 'covered_call' 
  | 'protective_put' 
  | 'iron_condor'
  | 'long_straddle'
  | 'short_strangle';

// Portfolio Types
export interface Position {
  id: string;
  portfolioId: string;
  symbol: string;
  type: 'stock' | 'option';
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  openDate: Date;
  closeDate?: Date;
  strategyId?: string;
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
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
  };
  risk: {
    beta: number;
    var: number;
    exposureByStrategy: Record<string, number>;
    exposureBySector: Record<string, number>;
  };
}

// Risk Management Types
export interface RiskMetrics {
  portfolioId: string;
  var95: number; // Value at Risk 95%
  expectedShortfall: number;
  beta: number;
  correlationRisk: number;
  concentrationRisk: number;
  liquidityRisk: number;
  greeksExposure: {
    totalDelta: number;
    totalGamma: number;
    totalTheta: number;
    totalVega: number;
  };
  stressTests: {
    market10Down: number;
    market20Down: number;
    volatilityShock: number;
  };
}

export interface RiskLimits {
  maxPositionSize: number;
  maxSectorExposure: number;
  maxStrategyExposure: number;
  maxVar: number;
  maxDrawdown: number;
  maxLeverage: number;
}

// Order Types
export interface Order {
  id: string;
  portfolioId: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  createdAt: Date;
  filledAt?: Date;
  filledQuantity: number;
  filledPrice?: number;
  strategyId?: string;
}

// Screening Types
export interface ScreeningCriteria {
  fundamental?: {
    minMarketCap?: number;
    maxMarketCap?: number;
    minPeRatio?: number;
    maxPeRatio?: number;
    minVolume?: number;
    sectors?: string[];
  };
  technical?: {
    rsi?: { min?: number; max?: number };
    macd?: 'bullish' | 'bearish';
    bollingerBands?: 'oversold' | 'overbought' | 'neutral';
    movingAverage?: {
      period: number;
      position: 'above' | 'below';
    };
  };
  options?: {
    minImpliedVolatility?: number;
    maxImpliedVolatility?: number;
    minDelta?: number;
    maxDelta?: number;
    minDaysToExpiration?: number;
    maxDaysToExpiration?: number;
  };
}

export interface ScreeningResult {
  symbol: string;
  score: number;
  matchedCriteria: string[];
  fundamentalData: MarketData;
  technicalIndicators: Record<string, number>;
  optionChain?: OptionData[];
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

// Event Types
export interface MarketEvent {
  type: 'earnings' | 'dividend' | 'split' | 'merger' | 'ipo';
  symbol: string;
  date: Date;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface SystemEvent {
  type: 'order_filled' | 'position_opened' | 'position_closed' | 'risk_limit_breach' | 'signal_generated';
  timestamp: Date;
  data: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// Configuration Types
export interface StrategyConfig {
  name: string;
  enabled: boolean;
  parameters: Record<string, any>;
  riskLimits: Partial<RiskLimits>;
  screening: ScreeningCriteria;
}

export interface BacktestResult {
  strategyId: string;
  period: {
    start: Date;
    end: Date;
  };
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
  };
  trades: Array<{
    symbol: string;
    entry: Date;
    exit: Date;
    pnl: number;
    duration: number;
  }>;
}
