import { 
  MarketData, OptionData, Position, Portfolio, TradingSignal, Order, RiskMetrics, StrategyConfig,
  InsertMarketData, InsertOptionData, InsertPosition, InsertPortfolio, InsertTradingSignal, InsertOrder, InsertRiskMetrics, InsertStrategyConfig
} from "@shared/schema";

export interface IStorage {
  // Market Data
  createMarketData(data: InsertMarketData): Promise<MarketData>;
  getMarketData(symbol: string): Promise<MarketData | undefined>;
  getAllMarketData(): Promise<MarketData[]>;
  updateMarketData(id: string, data: Partial<MarketData>): Promise<MarketData | undefined>;
  deleteMarketData(id: string): Promise<boolean>;

  // Option Data
  createOptionData(data: InsertOptionData): Promise<OptionData>;
  getOptionData(symbol: string): Promise<OptionData | undefined>;
  getOptionChain(underlying: string): Promise<OptionData[]>;
  getAllOptionData(): Promise<OptionData[]>;
  updateOptionData(id: string, data: Partial<OptionData>): Promise<OptionData | undefined>;
  deleteOptionData(id: string): Promise<boolean>;

  // Portfolios
  createPortfolio(data: InsertPortfolio): Promise<Portfolio>;
  getPortfolio(id: string): Promise<Portfolio | undefined>;
  getAllPortfolios(): Promise<Portfolio[]>;
  updatePortfolio(id: string, data: Partial<Portfolio>): Promise<Portfolio | undefined>;
  deletePortfolio(id: string): Promise<boolean>;

  // Positions
  createPosition(data: InsertPosition): Promise<Position>;
  getPosition(id: string): Promise<Position | undefined>;
  getPositionsByPortfolio(portfolioId: string): Promise<Position[]>;
  getAllPositions(): Promise<Position[]>;
  updatePosition(id: string, data: Partial<Position>): Promise<Position | undefined>;
  deletePosition(id: string): Promise<boolean>;

  // Trading Signals
  createTradingSignal(data: InsertTradingSignal): Promise<TradingSignal>;
  getTradingSignal(id: string): Promise<TradingSignal | undefined>;
  getActiveSignals(): Promise<TradingSignal[]>;
  getSignalsByStrategy(strategy: string): Promise<TradingSignal[]>;
  getAllTradingSignals(): Promise<TradingSignal[]>;
  updateTradingSignal(id: string, data: Partial<TradingSignal>): Promise<TradingSignal | undefined>;
  deleteTradingSignal(id: string): Promise<boolean>;

  // Orders
  createOrder(data: InsertOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByPortfolio(portfolioId: string): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  updateOrder(id: string, data: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;

  // Risk Metrics
  createRiskMetrics(data: InsertRiskMetrics): Promise<RiskMetrics>;
  getRiskMetrics(id: string): Promise<RiskMetrics | undefined>;
  getRiskMetricsByPortfolio(portfolioId: string): Promise<RiskMetrics[]>;
  getLatestRiskMetrics(portfolioId: string): Promise<RiskMetrics | undefined>;
  getAllRiskMetrics(): Promise<RiskMetrics[]>;
  updateRiskMetrics(id: string, data: Partial<RiskMetrics>): Promise<RiskMetrics | undefined>;
  deleteRiskMetrics(id: string): Promise<boolean>;

  // Strategy Configs
  createStrategyConfig(data: InsertStrategyConfig): Promise<StrategyConfig>;
  getStrategyConfig(id: string): Promise<StrategyConfig | undefined>;
  getStrategyConfigsByType(type: string): Promise<StrategyConfig[]>;
  getEnabledStrategies(): Promise<StrategyConfig[]>;
  getAllStrategyConfigs(): Promise<StrategyConfig[]>;
  updateStrategyConfig(id: string, data: Partial<StrategyConfig>): Promise<StrategyConfig | undefined>;
  deleteStrategyConfig(id: string): Promise<boolean>;
}

class MemStorage implements IStorage {
  private marketData = new Map<string, MarketData>();
  private optionData = new Map<string, OptionData>();
  private portfolios = new Map<string, Portfolio>();
  private positions = new Map<string, Position>();
  private tradingSignals = new Map<string, TradingSignal>();
  private orders = new Map<string, Order>();
  private riskMetrics = new Map<string, RiskMetrics>();
  private strategyConfigs = new Map<string, StrategyConfig>();

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Market Data methods
  async createMarketData(data: InsertMarketData): Promise<MarketData> {
    const id = this.generateId();
    const marketData: MarketData = { ...data, id };
    this.marketData.set(id, marketData);
    return marketData;
  }

  async getMarketData(symbol: string): Promise<MarketData | undefined> {
    return Array.from(this.marketData.values()).find(data => data.symbol === symbol);
  }

  async getAllMarketData(): Promise<MarketData[]> {
    return Array.from(this.marketData.values());
  }

  async updateMarketData(id: string, data: Partial<MarketData>): Promise<MarketData | undefined> {
    const existing = this.marketData.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.marketData.set(id, updated);
    return updated;
  }

  async deleteMarketData(id: string): Promise<boolean> {
    return this.marketData.delete(id);
  }

  // Option Data methods
  async createOptionData(data: InsertOptionData): Promise<OptionData> {
    const id = this.generateId();
    const optionData: OptionData = { ...data, id };
    this.optionData.set(id, optionData);
    return optionData;
  }

  async getOptionData(symbol: string): Promise<OptionData | undefined> {
    return Array.from(this.optionData.values()).find(data => data.symbol === symbol);
  }

  async getOptionChain(underlying: string): Promise<OptionData[]> {
    return Array.from(this.optionData.values()).filter(data => data.underlying === underlying);
  }

  async getAllOptionData(): Promise<OptionData[]> {
    return Array.from(this.optionData.values());
  }

  async updateOptionData(id: string, data: Partial<OptionData>): Promise<OptionData | undefined> {
    const existing = this.optionData.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.optionData.set(id, updated);
    return updated;
  }

  async deleteOptionData(id: string): Promise<boolean> {
    return this.optionData.delete(id);
  }

  // Portfolio methods
  async createPortfolio(data: InsertPortfolio): Promise<Portfolio> {
    const id = this.generateId();
    const portfolio: Portfolio = { ...data, id };
    this.portfolios.set(id, portfolio);
    return portfolio;
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    return this.portfolios.get(id);
  }

  async getAllPortfolios(): Promise<Portfolio[]> {
    return Array.from(this.portfolios.values());
  }

  async updatePortfolio(id: string, data: Partial<Portfolio>): Promise<Portfolio | undefined> {
    const existing = this.portfolios.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.portfolios.set(id, updated);
    return updated;
  }

  async deletePortfolio(id: string): Promise<boolean> {
    return this.portfolios.delete(id);
  }

  // Position methods
  async createPosition(data: InsertPosition): Promise<Position> {
    const id = this.generateId();
    const position: Position = { ...data, id };
    this.positions.set(id, position);
    return position;
  }

  async getPosition(id: string): Promise<Position | undefined> {
    return this.positions.get(id);
  }

  async getPositionsByPortfolio(portfolioId: string): Promise<Position[]> {
    return Array.from(this.positions.values()).filter(pos => pos.portfolioId === portfolioId);
  }

  async getAllPositions(): Promise<Position[]> {
    return Array.from(this.positions.values());
  }

  async updatePosition(id: string, data: Partial<Position>): Promise<Position | undefined> {
    const existing = this.positions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.positions.set(id, updated);
    return updated;
  }

  async deletePosition(id: string): Promise<boolean> {
    return this.positions.delete(id);
  }

  // Trading Signal methods
  async createTradingSignal(data: InsertTradingSignal): Promise<TradingSignal> {
    const id = this.generateId();
    const signal: TradingSignal = { ...data, id };
    this.tradingSignals.set(id, signal);
    return signal;
  }

  async getTradingSignal(id: string): Promise<TradingSignal | undefined> {
    return this.tradingSignals.get(id);
  }

  async getActiveSignals(): Promise<TradingSignal[]> {
    return Array.from(this.tradingSignals.values()).filter(signal => signal.status === 'active');
  }

  async getSignalsByStrategy(strategy: string): Promise<TradingSignal[]> {
    return Array.from(this.tradingSignals.values()).filter(signal => signal.strategy === strategy);
  }

  async getAllTradingSignals(): Promise<TradingSignal[]> {
    return Array.from(this.tradingSignals.values());
  }

  async updateTradingSignal(id: string, data: Partial<TradingSignal>): Promise<TradingSignal | undefined> {
    const existing = this.tradingSignals.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.tradingSignals.set(id, updated);
    return updated;
  }

  async deleteTradingSignal(id: string): Promise<boolean> {
    return this.tradingSignals.delete(id);
  }

  // Order methods
  async createOrder(data: InsertOrder): Promise<Order> {
    const id = this.generateId();
    const order: Order = { ...data, id };
    this.orders.set(id, order);
    return order;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByPortfolio(portfolioId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.portfolioId === portfolioId);
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async updateOrder(id: string, data: Partial<Order>): Promise<Order | undefined> {
    const existing = this.orders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.orders.set(id, updated);
    return updated;
  }

  async deleteOrder(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }

  // Risk Metrics methods
  async createRiskMetrics(data: InsertRiskMetrics): Promise<RiskMetrics> {
    const id = this.generateId();
    const metrics: RiskMetrics = { ...data, id };
    this.riskMetrics.set(id, metrics);
    return metrics;
  }

  async getRiskMetrics(id: string): Promise<RiskMetrics | undefined> {
    return this.riskMetrics.get(id);
  }

  async getRiskMetricsByPortfolio(portfolioId: string): Promise<RiskMetrics[]> {
    return Array.from(this.riskMetrics.values()).filter(metrics => metrics.portfolioId === portfolioId);
  }

  async getLatestRiskMetrics(portfolioId: string): Promise<RiskMetrics | undefined> {
    const metrics = await this.getRiskMetricsByPortfolio(portfolioId);
    return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  async getAllRiskMetrics(): Promise<RiskMetrics[]> {
    return Array.from(this.riskMetrics.values());
  }

  async updateRiskMetrics(id: string, data: Partial<RiskMetrics>): Promise<RiskMetrics | undefined> {
    const existing = this.riskMetrics.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.riskMetrics.set(id, updated);
    return updated;
  }

  async deleteRiskMetrics(id: string): Promise<boolean> {
    return this.riskMetrics.delete(id);
  }

  // Strategy Config methods
  async createStrategyConfig(data: InsertStrategyConfig): Promise<StrategyConfig> {
    const id = this.generateId();
    const config: StrategyConfig = { ...data, id };
    this.strategyConfigs.set(id, config);
    return config;
  }

  async getStrategyConfig(id: string): Promise<StrategyConfig | undefined> {
    return this.strategyConfigs.get(id);
  }

  async getStrategyConfigsByType(type: string): Promise<StrategyConfig[]> {
    return Array.from(this.strategyConfigs.values()).filter(config => config.type === type);
  }

  async getEnabledStrategies(): Promise<StrategyConfig[]> {
    return Array.from(this.strategyConfigs.values()).filter(config => config.enabled);
  }

  async getAllStrategyConfigs(): Promise<StrategyConfig[]> {
    return Array.from(this.strategyConfigs.values());
  }

  async updateStrategyConfig(id: string, data: Partial<StrategyConfig>): Promise<StrategyConfig | undefined> {
    const existing = this.strategyConfigs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data };
    this.strategyConfigs.set(id, updated);
    return updated;
  }

  async deleteStrategyConfig(id: string): Promise<boolean> {
    return this.strategyConfigs.delete(id);
  }
}

export const storage = new MemStorage();
