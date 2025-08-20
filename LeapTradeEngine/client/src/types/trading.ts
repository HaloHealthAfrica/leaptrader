export interface MarketData {
  id: string;
  symbol: string;
  price: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  beta?: number;
  timestamp: Date;
}

export interface OptionData {
  id: string;
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

export interface TradingSignal {
  id: string;
  symbol: string;
  strategy: 'long_call_leaps' | 'protective_put';
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  targetPrice?: number;
  stopPrice?: number;
  reasoning?: string;
  fundamentalScore: number;
  technicalScore: number;
  riskScore: number;
  expectedReturn?: number;
  timeHorizon?: number;
  createdAt: Date;
  status?: 'active' | 'executed' | 'cancelled' | 'expired';
}

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

export interface RiskMetrics {
  id: string;
  portfolioId: string;
  var95: number;
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
  timestamp: Date;
}

export interface StrategyConfig {
  id: string;
  name: string;
  type: 'long_call_leaps' | 'protective_put';
  enabled: boolean;
  parameters: Record<string, any>;
  riskParams: {
    maxPositionSize: number;
    stopLoss: number;
    profitTarget: number;
    maxDrawdown: number;
  };
  screening: {
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
    };
    options?: {
      minImpliedVolatility?: number;
      maxImpliedVolatility?: number;
      minDelta?: number;
      maxDelta?: number;
      minDaysToExpiration?: number;
      maxDaysToExpiration?: number;
    };
  };
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: Date;
  nextClose?: Date;
}

export interface SystemStatus {
  market: MarketStatus;
  portfolios: number;
  activeSignals: number;
  pendingOrders: number;
  timestamp: string;
}
