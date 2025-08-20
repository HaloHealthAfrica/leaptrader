import express from "express";
import { config } from "./config";
import { logger } from "./utils/logger";
import { setupScheduledJobs } from "./jobs";
import { PortfolioManager } from "./portfolio/PortfolioManager";
import { SignalGenerator } from "./strategy/signals/SignalGenerator";
import { OrderExecutor } from "./execution/OrderExecutor";

const app = express();

class LeapTradingEngine {
  private portfolioManager: PortfolioManager;
  private signalGenerator: SignalGenerator;
  private orderExecutor: OrderExecutor;

  constructor() {
    this.portfolioManager = new PortfolioManager();
    this.signalGenerator = new SignalGenerator();
    this.orderExecutor = new OrderExecutor();
  }

  async initialize() {
    logger.info("Initializing LEAP Trading Engine...");
    
    try {
      // Initialize components
      await this.portfolioManager.initialize();
      await this.signalGenerator.initialize();
      await this.orderExecutor.initialize();
      
      // Setup scheduled jobs
      setupScheduledJobs();
      
      logger.info("LEAP Trading Engine initialized successfully");
      return true;
    } catch (error) {
      logger.error("Failed to initialize LEAP Trading Engine:", error);
      return false;
    }
  }

  async start() {
    const initialized = await this.initialize();
    if (!initialized) {
      process.exit(1);
    }

    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`LEAP Trading Engine running on port ${port}`);
    });
  }

  async shutdown() {
    logger.info("Shutting down LEAP Trading Engine...");
    // Cleanup logic here
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Start the engine
const engine = new LeapTradingEngine();
engine.start().catch((error) => {
  logger.error("Failed to start LEAP Trading Engine:", error);
  process.exit(1);
});

export { LeapTradingEngine };
