export interface PortfolioMetrics {
  totalValue: number;
  cashAvailable: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export interface StrategyPerformance {
  strategy: string;
  totalPnl: number;
  totalPositions: number;
  winningPositions: number;
  winRate: number;
}

export interface RiskAnalytics {
  portfolioBeta: number;
  maxDrawdown: number;
  sharpeRatio: number;
  var95: number;
  greeksExposure: string;
  riskScore: number;
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen: Date | null;
  nextClose: Date | null;
  currentTime: Date;
}

export interface SignalFilter {
  strategy?: string;
  symbol?: string;
  status?: string;
  minConfidence?: number;
  timeToExpiry?: string;
}
