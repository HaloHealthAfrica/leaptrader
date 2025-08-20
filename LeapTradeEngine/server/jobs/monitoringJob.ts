import { storage } from "../storage";
import { MarketDataService } from "../services/marketData";
import { PortfolioManagerService } from "../services/portfolioManager";
import { RiskCalculatorService } from "../services/riskCalculator";
import { OrderExecutorService } from "../services/orderExecutor";
import { logger, logSystemHealth, logRiskEvent } from "../utils/logger";

export class MonitoringJob {
  private marketDataService: MarketDataService;
  private portfolioManager: PortfolioManagerService;
  private riskCalculator: RiskCalculatorService;
  private orderExecutor: OrderExecutorService;
  private isRunning = false;

  // Performance metrics
  private metrics = {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    activeConnections: 0,
  };

  constructor() {
    this.marketDataService = new MarketDataService();
    this.portfolioManager = new PortfolioManagerService();
    this.riskCalculator = new RiskCalculatorService();
    this.orderExecutor = new OrderExecutorService();
  }

  async start(): Promise<void> {
    logger.info('Starting monitoring job...');
    this.isRunning = true;

    // Health checks every 30 seconds
    setInterval(async () => {
      if (this.isRunning) {
        await this.performHealthChecks();
      }
    }, 30000);

    // Risk monitoring every 2 minutes
    setInterval(async () => {
      if (this.isRunning) {
        await this.monitorRiskLevels();
      }
    }, 120000);

    // Portfolio monitoring every 5 minutes
    setInterval(async () => {
      if (this.isRunning) {
        await this.monitorPortfolios();
      }
    }, 300000);

    // System metrics every 1 minute
    setInterval(async () => {
      if (this.isRunning) {
        await this.collectSystemMetrics();
      }
    }, 60000);

    // Order monitoring every 10 seconds
    setInterval(async () => {
      if (this.isRunning) {
        await this.monitorOrders();
      }
    }, 10000);

    // Signal monitoring every 3 minutes
    setInterval(async () => {
      if (this.isRunning) {
        await this.monitorSignals();
      }
    }, 180000);

    logger.info('Monitoring job started');
  }

  stop(): void {
    logger.info('Stopping monitoring job...');
    this.isRunning = false;
    logger.info('Monitoring job stopped');
  }

  private async performHealthChecks(): Promise<void> {
    try {
      const healthStatus = {
        timestamp: new Date(),
        services: {
          marketData: await this.checkMarketDataHealth(),
          database: await this.checkDatabaseHealth(),
          orderExecution: await this.checkOrderExecutionHealth(),
          riskManagement: await this.checkRiskManagementHealth(),
        },
        system: await this.getSystemHealth(),
      };

      // Log overall health status
      const unhealthyServices = Object.entries(healthStatus.services)
        .filter(([_, status]) => !status.healthy)
        .map(([service, _]) => service);

      if (unhealthyServices.length > 0) {
        logRiskEvent('medium', `Health check failed for services: ${unhealthyServices.join(', ')}`, healthStatus);
      }

      // Store health metrics for dashboard
      this.updateHealthMetrics(healthStatus);

    } catch (error) {
      logger.error('Error performing health checks:', error);
      logRiskEvent('high', 'Health check system failure', { error: error.message });
    }
  }

  private async checkMarketDataHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      const marketStatus = await this.marketDataService.getMarketStatus();
      const latency = Date.now() - startTime;

      if (!marketStatus) {
        return { healthy: false, error: 'Market status unavailable' };
      }

      return { healthy: true, latency };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  private async checkDatabaseHealth(): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
    try {
      const startTime = Date.now();
      await storage.getAllPortfolios();
      const responseTime = Date.now() - startTime;

      return { healthy: true, responseTime };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  private async checkOrderExecutionHealth(): Promise<{ healthy: boolean; pendingOrders?: number; error?: string }> {
    try {
      const pendingOrders = await storage.getOrdersByStatus('pending');
      const stuckOrders = pendingOrders.filter(order => {
        const ageMs = Date.now() - order.createdAt.getTime();
        return ageMs > 5 * 60 * 1000; // Orders pending for more than 5 minutes
      });

      if (stuckOrders.length > 0) {
        logRiskEvent('medium', `${stuckOrders.length} orders stuck in pending state`, { stuckOrders: stuckOrders.map(o => o.id) });
      }

      return { 
        healthy: stuckOrders.length === 0, 
        pendingOrders: pendingOrders.length,
        error: stuckOrders.length > 0 ? `${stuckOrders.length} stuck orders` : undefined
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  private async checkRiskManagementHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const portfolios = await storage.getAllPortfolios();
      
      for (const portfolio of portfolios) {
        try {
          await this.riskCalculator.getLatestRiskMetrics(portfolio.id);
        } catch (error) {
          return { healthy: false, error: `Risk calculation failed for portfolio ${portfolio.id}` };
        }
      }

      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  private async getSystemHealth(): Promise<any> {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  private async monitorRiskLevels(): Promise<void> {
    try {
      const portfolios = await storage.getAllPortfolios();

      for (const portfolio of portfolios) {
        const riskMetrics = await this.riskCalculator.getLatestRiskMetrics(portfolio.id);
        
        if (!riskMetrics) continue;

        // Check various risk thresholds
        await this.checkRiskThresholds(portfolio, riskMetrics);
      }
    } catch (error) {
      logger.error('Error monitoring risk levels:', error);
    }
  }

  private async checkRiskThresholds(portfolio: any, riskMetrics: any): Promise<void> {
    // VaR threshold check
    const varThreshold = portfolio.totalValue * 0.02; // 2% of portfolio value
    if (Math.abs(riskMetrics.var95) > varThreshold) {
      logRiskEvent('high', 
        `VaR threshold exceeded for portfolio ${portfolio.id}`, 
        { 
          portfolioId: portfolio.id,
          var95: riskMetrics.var95,
          threshold: varThreshold,
          percentage: (Math.abs(riskMetrics.var95) / portfolio.totalValue) * 100
        }
      );
    }

    // Concentration risk check
    if (riskMetrics.concentrationRisk > 7) {
      logRiskEvent('medium', 
        `High concentration risk detected in portfolio ${portfolio.id}`,
        {
          portfolioId: portfolio.id,
          concentrationRisk: riskMetrics.concentrationRisk
        }
      );
    }

    // Liquidity risk check
    if (riskMetrics.liquidityRisk > 8) {
      logRiskEvent('medium',
        `High liquidity risk detected in portfolio ${portfolio.id}`,
        {
          portfolioId: portfolio.id,
          liquidityRisk: riskMetrics.liquidityRisk
        }
      );
    }

    // Greeks exposure check
    if (Math.abs(riskMetrics.greeksExposure.totalDelta) > 100) {
      logRiskEvent('low',
        `High delta exposure in portfolio ${portfolio.id}`,
        {
          portfolioId: portfolio.id,
          totalDelta: riskMetrics.greeksExposure.totalDelta
        }
      );
    }
  }

  private async monitorPortfolios(): Promise<void> {
    try {
      await this.portfolioManager.updatePortfolioValues();
      
      const portfolios = await storage.getAllPortfolios();
      
      for (const portfolio of portfolios) {
        // Check for significant drawdowns
        if (portfolio.performance.totalReturnPercent < -15) {
          logRiskEvent('high',
            `Significant drawdown detected in portfolio ${portfolio.id}`,
            {
              portfolioId: portfolio.id,
              drawdown: portfolio.performance.totalReturnPercent
            }
          );
        }

        // Check for low cash levels
        const cashPercentage = (portfolio.cashBalance / portfolio.totalValue) * 100;
        if (cashPercentage < 5) {
          logRiskEvent('medium',
            `Low cash levels in portfolio ${portfolio.id}`,
            {
              portfolioId: portfolio.id,
              cashPercentage
            }
          );
        }
      }
    } catch (error) {
      logger.error('Error monitoring portfolios:', error);
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      this.metrics.memoryUsage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      this.metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to milliseconds

      // Calculate error rate
      this.metrics.errorCount = this.metrics.errorCount || 0;
      this.metrics.requestCount = this.metrics.requestCount || 0;
      const errorRate = this.metrics.requestCount > 0 ? 
        (this.metrics.errorCount / this.metrics.requestCount) * 100 : 0;

      logSystemHealth({
        memoryUsage: this.metrics.memoryUsage,
        cpuUsage: this.metrics.cpuUsage,
        activeConnections: this.metrics.activeConnections,
        errorRate,
        uptime: process.uptime(),
        requestCount: this.metrics.requestCount,
      });

      // Alert on high resource usage
      if (this.metrics.memoryUsage > 80) {
        logRiskEvent('medium', 'High memory usage detected', { memoryUsage: this.metrics.memoryUsage });
      }

      if (errorRate > 5) {
        logRiskEvent('high', 'High error rate detected', { errorRate });
      }

    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  private async monitorOrders(): Promise<void> {
    try {
      // Process any pending orders
      await this.orderExecutor.processAllPendingOrders();

      // Check for orders that have been pending too long
      const pendingOrders = await storage.getOrdersByStatus('pending');
      const staleOrders = pendingOrders.filter(order => {
        const ageMinutes = (Date.now() - order.createdAt.getTime()) / (1000 * 60);
        return ageMinutes > 10; // Orders pending for more than 10 minutes
      });

      if (staleOrders.length > 0) {
        logger.warn(`Found ${staleOrders.length} stale orders`);
        
        for (const order of staleOrders) {
          logRiskEvent('medium', 
            `Order ${order.id} has been pending for too long`,
            { orderId: order.id, symbol: order.symbol, age: Date.now() - order.createdAt.getTime() }
          );
        }
      }
    } catch (error) {
      logger.error('Error monitoring orders:', error);
    }
  }

  private async monitorSignals(): Promise<void> {
    try {
      const activeSignals = await storage.getActiveSignals();
      
      // Check for signals with very low confidence that are still active
      const lowConfidenceSignals = activeSignals.filter(signal => signal.confidence < 4);
      
      if (lowConfidenceSignals.length > 0) {
        logRiskEvent('low',
          `${lowConfidenceSignals.length} active signals with low confidence`,
          { signals: lowConfidenceSignals.map(s => ({ id: s.id, symbol: s.symbol, confidence: s.confidence })) }
        );
      }

      // Check for signals that haven't been executed in a long time
      const staleSignals = activeSignals.filter(signal => {
        const ageHours = (Date.now() - signal.createdAt.getTime()) / (1000 * 60 * 60);
        return ageHours > 24; // Signals older than 24 hours
      });

      if (staleSignals.length > 0) {
        logger.info(`Found ${staleSignals.length} stale signals that may need attention`);
      }

    } catch (error) {
      logger.error('Error monitoring signals:', error);
    }
  }

  private updateHealthMetrics(healthStatus: any): void {
    // Store health metrics for dashboard display
    // In a production system, this would typically go to a time-series database
    logger.debug('Health metrics updated', healthStatus);
  }

  // Method to increment request counter (would be called from routes)
  incrementRequestCount(): void {
    this.metrics.requestCount++;
  }

  // Method to increment error counter (would be called from error handlers)
  incrementErrorCount(): void {
    this.metrics.errorCount++;
  }

  // Method to update response time (would be called from middleware)
  updateResponseTime(responseTime: number): void {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime + responseTime) / 2;
  }

  // Get current metrics for dashboard
  getMetrics(): any {
    return { ...this.metrics };
  }
}
