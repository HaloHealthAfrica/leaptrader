import { Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import {
  insertMarketDataSchema,
  insertOptionDataSchema,
  insertPortfolioSchema,
  insertPositionSchema,
  insertTradingSignalSchema,
  insertOrderSchema,
  insertRiskMetricsSchema,
  insertStrategyConfigSchema,
} from "@shared/schema";
import { MarketDataService } from "./services/marketData";
import { SignalGeneratorService } from "./services/signalGenerator";
import { PortfolioManagerService } from "./services/portfolioManager";
import { RiskCalculatorService } from "./services/riskCalculator";
import { OrderExecutorService } from "./services/orderExecutor";
import { MarketDataJob } from "./jobs/marketDataJob";
import { ScreeningJob } from "./jobs/screeningJob";
import { MonitoringJob } from "./jobs/monitoringJob";

// Initialize services
const marketDataService = new MarketDataService();
const signalGenerator = new SignalGeneratorService();
const portfolioManager = new PortfolioManagerService();
const riskCalculator = new RiskCalculatorService();
const orderExecutor = new OrderExecutorService();
const marketDataJob = new MarketDataJob();
const screeningJob = new ScreeningJob();
const monitoringJob = new MonitoringJob();

// Start background jobs
marketDataJob.start();
marketDataJob.startOptionChainUpdates();
screeningJob.start();
monitoringJob.start();

export function registerRoutes(app: any) {
  // Health check
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Market Data Routes
  app.get("/api/market-data", async (req: Request, res: Response) => {
    try {
      const marketData = await storage.getAllMarketData();
      res.json(marketData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  app.get("/api/market-data/:symbol", async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const marketData = await storage.getMarketData(symbol.toUpperCase());
      
      if (!marketData) {
        // Try to fetch from external API
        const quote = await marketDataService.getQuote(symbol.toUpperCase());
        if (quote) {
          const stored = await storage.createMarketData({
            symbol: quote.symbol,
            price: quote.price,
            volume: quote.volume,
            marketCap: quote.marketCap,
            pe: quote.pe,
            beta: quote.beta,
            timestamp: quote.timestamp,
          });
          res.json(stored);
        } else {
          res.status(404).json({ error: "Market data not found" });
        }
      } else {
        res.json(marketData);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  app.get("/api/market-data/:symbol/options", async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const { expiration } = req.query;
      
      const optionChain = await marketDataService.getOptionChain(
        symbol.toUpperCase(),
        expiration as string
      );
      
      res.json(optionChain);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch option chain" });
    }
  });

  app.get("/api/market-status", async (req: Request, res: Response) => {
    try {
      const status = await marketDataService.getMarketStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch market status" });
    }
  });

  // Portfolio Routes
  app.get("/api/portfolios", async (req: Request, res: Response) => {
    try {
      const portfolios = await storage.getAllPortfolios();
      res.json(portfolios);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  app.post("/api/portfolios", async (req: Request, res: Response) => {
    try {
      const validatedData = insertPortfolioSchema.parse(req.body);
      const portfolio = await storage.createPortfolio(validatedData);
      res.status(201).json(portfolio);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create portfolio" });
      }
    }
  });

  app.get("/api/portfolios/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const portfolio = await storage.getPortfolio(id);
      
      if (!portfolio) {
        res.status(404).json({ error: "Portfolio not found" });
        return;
      }
      
      res.json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.get("/api/portfolios/:id/summary", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const summary = await portfolioManager.getPortfolioSummary(id);
      
      if (!summary) {
        res.status(404).json({ error: "Portfolio not found" });
        return;
      }
      
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio summary" });
    }
  });

  app.post("/api/portfolios/:id/update-values", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updatedPortfolio = await portfolioManager.updateSinglePortfolio(id);
      
      if (!updatedPortfolio) {
        res.status(404).json({ error: "Portfolio not found" });
        return;
      }
      
      res.json(updatedPortfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to update portfolio values" });
    }
  });

  // Position Routes
  app.get("/api/portfolios/:portfolioId/positions", async (req: Request, res: Response) => {
    try {
      const { portfolioId } = req.params;
      const positions = await storage.getPositionsByPortfolio(portfolioId);
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  app.post("/api/portfolios/:portfolioId/positions", async (req: Request, res: Response) => {
    try {
      const { portfolioId } = req.params;
      const validatedData = insertPositionSchema.omit({ portfolioId: true }).parse(req.body);
      const position = await portfolioManager.addPosition(portfolioId, validatedData);
      res.status(201).json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create position" });
      }
    }
  });

  // Trading Signal Routes
  app.get("/api/signals", async (req: Request, res: Response) => {
    try {
      const { status, strategy } = req.query;
      
      let signals;
      if (status === 'active') {
        signals = await storage.getActiveSignals();
      } else if (strategy) {
        signals = await storage.getSignalsByStrategy(strategy as string);
      } else {
        signals = await storage.getAllTradingSignals();
      }
      
      res.json(signals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch signals" });
    }
  });

  app.post("/api/signals/generate", async (req: Request, res: Response) => {
    try {
      const signals = await signalGenerator.generateSignals();
      res.json({ count: signals.length, signals });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate signals" });
    }
  });

  app.post("/api/signals", async (req: Request, res: Response) => {
    try {
      const validatedData = insertTradingSignalSchema.parse(req.body);
      const signal = await storage.createTradingSignal(validatedData);
      res.status(201).json(signal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create signal" });
      }
    }
  });

  app.patch("/api/signals/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const signal = await storage.updateTradingSignal(id, updates);
      
      if (!signal) {
        res.status(404).json({ error: "Signal not found" });
        return;
      }
      
      res.json(signal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update signal" });
    }
  });

  // Order Routes
  app.get("/api/orders", async (req: Request, res: Response) => {
    try {
      const { portfolioId, status } = req.query;
      
      let orders;
      if (portfolioId) {
        orders = await storage.getOrdersByPortfolio(portfolioId as string);
      } else if (status) {
        orders = await storage.getOrdersByStatus(status as string);
      } else {
        orders = await storage.getAllOrders();
      }
      
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(validatedData);
      
      // Process the order immediately
      await orderExecutor.processOrder(order.id);
      
      const processedOrder = await storage.getOrder(order.id);
      res.status(201).json(processedOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create order" });
      }
    }
  });

  app.post("/api/signals/:signalId/execute", async (req: Request, res: Response) => {
    try {
      const { signalId } = req.params;
      const { portfolioId, quantity } = req.body;
      
      if (!portfolioId || !quantity) {
        res.status(400).json({ error: "portfolioId and quantity are required" });
        return;
      }
      
      const order = await orderExecutor.executeSignal(signalId, portfolioId, quantity);
      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to execute signal" });
    }
  });

  // Risk Management Routes
  app.get("/api/portfolios/:portfolioId/risk", async (req: Request, res: Response) => {
    try {
      const { portfolioId } = req.params;
      const riskMetrics = await storage.getLatestRiskMetrics(portfolioId);
      
      if (!riskMetrics) {
        // Calculate new risk metrics if none exist
        const newRiskMetrics = await riskCalculator.calculateRiskMetrics(portfolioId);
        res.json(newRiskMetrics);
      } else {
        res.json(riskMetrics);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch risk metrics" });
    }
  });

  app.post("/api/portfolios/:portfolioId/risk/calculate", async (req: Request, res: Response) => {
    try {
      const { portfolioId } = req.params;
      const riskMetrics = await riskCalculator.calculateRiskMetrics(portfolioId);
      res.json(riskMetrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate risk metrics" });
    }
  });

  // Strategy Configuration Routes
  app.get("/api/strategies", async (req: Request, res: Response) => {
    try {
      const { type, enabled } = req.query;
      
      let strategies;
      if (type) {
        strategies = await storage.getStrategyConfigsByType(type as string);
      } else if (enabled === 'true') {
        strategies = await storage.getEnabledStrategies();
      } else {
        strategies = await storage.getAllStrategyConfigs();
      }
      
      res.json(strategies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch strategies" });
    }
  });

  app.post("/api/strategies", async (req: Request, res: Response) => {
    try {
      const validatedData = insertStrategyConfigSchema.parse(req.body);
      const strategy = await storage.createStrategyConfig(validatedData);
      res.status(201).json(strategy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create strategy" });
      }
    }
  });

  app.patch("/api/strategies/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const strategy = await storage.updateStrategyConfig(id, updates);
      
      if (!strategy) {
        res.status(404).json({ error: "Strategy not found" });
        return;
      }
      
      res.json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to update strategy" });
    }
  });

  // System Monitoring Routes
  app.get("/api/system/status", async (req: Request, res: Response) => {
    try {
      const marketStatus = await marketDataService.getMarketStatus();
      const portfolios = await storage.getAllPortfolios();
      const activeSignals = await storage.getActiveSignals();
      const pendingOrders = await storage.getOrdersByStatus('pending');
      
      res.json({
        market: marketStatus,
        portfolios: portfolios.length,
        activeSignals: activeSignals.length,
        pendingOrders: pendingOrders.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system status" });
    }
  });

  // Initialize default data if needed
  app.post("/api/initialize", async (req: Request, res: Response) => {
    try {
      // Create default portfolio if none exists
      const portfolios = await storage.getAllPortfolios();
      if (portfolios.length === 0) {
        await portfolioManager.createDefaultPortfolio();
      }

      // Create default strategy configurations
      const strategies = await storage.getAllStrategyConfigs();
      if (strategies.length === 0) {
        await createDefaultStrategies();
      }

      res.json({ message: "System initialized successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to initialize system" });
    }
  });
}

async function createDefaultStrategies() {
  const defaultStrategies = [
    {
      name: "Stock Replacement LEAPS",
      type: "stock_replacement" as const,
      enabled: true,
      parameters: {
        minDelta: 0.6,
        maxDelta: 0.8,
        minDaysToExpiration: 300,
        maxCost: 50000,
      },
      riskParams: {
        maxPositionSize: 0.1,
        stopLoss: 0.15,
        profitTarget: 0.25,
        maxDrawdown: 0.1,
      },
      screening: {
        fundamental: {
          minMarketCap: 10000000000,
          minVolume: 1000000,
        },
        technical: {
          rsi: { min: 30, max: 70 },
        },
        options: {
          minImpliedVolatility: 0.15,
          maxImpliedVolatility: 0.8,
          minDaysToExpiration: 300,
        },
      },
    },
    {
      name: "Covered Call Income",
      type: "covered_call" as const,
      enabled: true,
      parameters: {
        minPremium: 0.5,
        targetOTM: 0.05,
        maxDaysToExpiration: 60,
      },
      riskParams: {
        maxPositionSize: 0.15,
        stopLoss: 0.1,
        profitTarget: 0.1,
        maxDrawdown: 0.08,
      },
      screening: {
        fundamental: {
          minMarketCap: 5000000000,
          minVolume: 500000,
        },
      },
    },
    {
      name: "Protective Put Hedging",
      type: "protective_put" as const,
      enabled: true,
      parameters: {
        maxCost: 0.05,
        minProtection: 0.05,
        targetDaysToExpiration: 120,
      },
      riskParams: {
        maxPositionSize: 0.2,
        stopLoss: 0.02,
        profitTarget: 0.15,
        maxDrawdown: 0.05,
      },
      screening: {
        fundamental: {
          minMarketCap: 1000000000,
        },
      },
    },
    {
      name: "Iron Condor Premium",
      type: "iron_condor" as const,
      enabled: true,
      parameters: {
        minCredit: 0.3,
        targetWidth: 10,
        maxDaysToExpiration: 45,
      },
      riskParams: {
        maxPositionSize: 0.05,
        stopLoss: 0.5,
        profitTarget: 0.5,
        maxDrawdown: 0.1,
      },
      screening: {
        options: {
          minImpliedVolatility: 0.25,
        },
      },
    },
  ];

  for (const strategyData of defaultStrategies) {
    await storage.createStrategyConfig(strategyData);
  }
}
