import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";

// Market Data Types
export const marketDataSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  price: z.number(),
  volume: z.number(),
  marketCap: z.number().optional(),
  pe: z.number().optional(),
  beta: z.number().optional(),
  timestamp: z.date(),
});

export const optionDataSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  underlying: z.string(),
  strike: z.number(),
  expiration: z.date(),
  type: z.enum(['call', 'put']),
  bid: z.number(),
  ask: z.number(),
  last: z.number(),
  volume: z.number(),
  openInterest: z.number(),
  impliedVolatility: z.number(),
  delta: z.number(),
  gamma: z.number(),
  theta: z.number(),
  vega: z.number(),
  rho: z.number(),
});

// Portfolio Types
export const positionSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  symbol: z.string(),
  type: z.enum(['stock', 'option']),
  side: z.enum(['long', 'short']),
  quantity: z.number(),
  entryPrice: z.number(),
  currentPrice: z.number(),
  marketValue: z.number(),
  unrealizedPnL: z.number(),
  realizedPnL: z.number(),
  openDate: z.date(),
  closeDate: z.date().optional(),
  strategyId: z.string().optional(),
});

export const portfolioSchema = z.object({
  id: z.string(),
  name: z.string(),
  totalValue: z.number(),
  cashBalance: z.number(),
  performance: z.object({
    totalReturn: z.number(),
    totalReturnPercent: z.number(),
    dayChange: z.number(),
    dayChangePercent: z.number(),
    maxDrawdown: z.number(),
    sharpeRatio: z.number(),
    winRate: z.number(),
  }),
  risk: z.object({
    beta: z.number(),
    var: z.number(),
    exposureByStrategy: z.record(z.number()),
    exposureBySector: z.record(z.number()),
  }),
});

// Trading Signal Types
export const tradingSignalSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  strategy: z.enum(['stock_replacement', 'covered_call', 'protective_put', 'iron_condor']),
  action: z.enum(['buy', 'sell', 'hold']),
  confidence: z.number().min(0).max(10),
  targetPrice: z.number(),
  stopPrice: z.number(),
  reasoning: z.string(),
  fundamentalScore: z.number(),
  technicalScore: z.number(),
  riskScore: z.number(),
  expectedReturn: z.number(),
  timeHorizon: z.number(),
  createdAt: z.date(),
  status: z.enum(['active', 'executed', 'cancelled', 'expired']).default('active'),
});

// Order Types
export const orderSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  symbol: z.string(),
  type: z.enum(['market', 'limit', 'stop', 'stop_limit']),
  side: z.enum(['buy', 'sell']),
  quantity: z.number(),
  price: z.number().optional(),
  stopPrice: z.number().optional(),
  timeInForce: z.enum(['day', 'gtc', 'ioc', 'fok']),
  status: z.enum(['pending', 'filled', 'partial', 'cancelled', 'rejected']),
  createdAt: z.date(),
  filledAt: z.date().optional(),
  filledQuantity: z.number().default(0),
  filledPrice: z.number().optional(),
  strategyId: z.string().optional(),
});

// Risk Metrics Types
export const riskMetricsSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  var95: z.number(),
  expectedShortfall: z.number(),
  beta: z.number(),
  correlationRisk: z.number(),
  concentrationRisk: z.number(),
  liquidityRisk: z.number(),
  greeksExposure: z.object({
    totalDelta: z.number(),
    totalGamma: z.number(),
    totalTheta: z.number(),
    totalVega: z.number(),
  }),
  stressTests: z.object({
    market10Down: z.number(),
    market20Down: z.number(),
    volatilityShock: z.number(),
  }),
  timestamp: z.date(),
});

// Strategy Config Types
export const strategyConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['stock_replacement', 'covered_call', 'protective_put', 'iron_condor']),
  enabled: z.boolean(),
  parameters: z.record(z.any()),
  riskParams: z.object({
    maxPositionSize: z.number(),
    stopLoss: z.number(),
    profitTarget: z.number(),
    maxDrawdown: z.number(),
  }),
  screening: z.object({
    fundamental: z.object({
      minMarketCap: z.number().optional(),
      maxMarketCap: z.number().optional(),
      minPeRatio: z.number().optional(),
      maxPeRatio: z.number().optional(),
      minVolume: z.number().optional(),
      sectors: z.array(z.string()).optional(),
    }).optional(),
    technical: z.object({
      rsi: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
      }).optional(),
      macd: z.enum(['bullish', 'bearish']).optional(),
    }).optional(),
    options: z.object({
      minImpliedVolatility: z.number().optional(),
      maxImpliedVolatility: z.number().optional(),
      minDelta: z.number().optional(),
      maxDelta: z.number().optional(),
      minDaysToExpiration: z.number().optional(),
      maxDaysToExpiration: z.number().optional(),
    }).optional(),
  }),
});

// Insert schemas
export const insertMarketDataSchema = createInsertSchema(marketDataSchema).omit({ id: true });
export const insertOptionDataSchema = createInsertSchema(optionDataSchema).omit({ id: true });
export const insertPositionSchema = createInsertSchema(positionSchema).omit({ id: true });
export const insertPortfolioSchema = createInsertSchema(portfolioSchema).omit({ id: true });
export const insertTradingSignalSchema = createInsertSchema(tradingSignalSchema).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orderSchema).omit({ id: true });
export const insertRiskMetricsSchema = createInsertSchema(riskMetricsSchema).omit({ id: true });
export const insertStrategyConfigSchema = createInsertSchema(strategyConfigSchema).omit({ id: true });

// Types
export type MarketData = z.infer<typeof marketDataSchema>;
export type OptionData = z.infer<typeof optionDataSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Portfolio = z.infer<typeof portfolioSchema>;
export type TradingSignal = z.infer<typeof tradingSignalSchema>;
export type Order = z.infer<typeof orderSchema>;
export type RiskMetrics = z.infer<typeof riskMetricsSchema>;
export type StrategyConfig = z.infer<typeof strategyConfigSchema>;

export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type InsertOptionData = z.infer<typeof insertOptionDataSchema>;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type InsertTradingSignal = z.infer<typeof insertTradingSignalSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertRiskMetrics = z.infer<typeof insertRiskMetricsSchema>;
export type InsertStrategyConfig = z.infer<typeof insertStrategyConfigSchema>;
