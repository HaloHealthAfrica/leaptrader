import cron from 'node-cron';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { logger, logSystemHealth, logRiskEvent } from '../utils/logger';
import { cache } from '../utils/cache';
import { getMemoryUsage } from '../utils/helpers';

class MonitoringJob {
  private portfolioManager: PortfolioManager;
  private isRunning = false;
  private monitoringTasks: cron.ScheduledTask[] = [];
  private alertThresholds = {
    memoryUsage: 85, // percentage
    errorRate: 5, // percentage
    riskScore: 8.5, // out of 10
    drawdown: 0.15, // 15%
    var95: 100000 // $100k
  };

  constructor(portfolioManager: PortfolioManager) {
    this.portfolioManager = portfolioManager;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitoring job is already running');
      return;
    }

    logger.info('Starting monitoring job...');

    // System health monitoring every 5 minutes
    const systemHealthTask = cron.schedule('*/5 * * * *', async () => {
      await this.monitorSystemHealth();
    }, { scheduled: false });

    // Portfolio risk monitoring every 15 minutes during market hours
    const riskMonitoringTask = cron.schedule('*/15 9-16 * * 1-5', async () => {
      await this.monitorPortfolioRisk();
    }, { 
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Position monitoring every 30 minutes during market hours
    const positionMonitoringTask = cron.schedule('*/30 9-16 * * 1-5', async () => {
      await this.monitorPositions();
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Performance monitoring every hour
    const performanceTask = cron.schedule('0 * * * *', async () => {
      await this.monitorPerformance();
    }, { scheduled: false });

    // Daily summary at market close
    const dailySummaryTask = cron.schedule('30 16 * * 1-5', async () => {
      await this.generateDailySummary();
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Start all tasks
    this.monitoringTasks = [
      systemHealthTask,
      riskMonitoringTask,
      positionMonitoringTask,
      performanceTask,
      dailySummaryTask
    ];

    this.monitoringTasks.forEach(task => task.start());
    this.isRunning = true;

    // Run initial health check
    await this.monitorSystemHealth();

    logger.info('Monitoring job started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.monitoringTasks.forEach(task => task.stop());
    this.monitoringTasks = [];
    this.isRunning = false;

    logger.info('Monitoring job stopped');
  }

  private async monitorSystemHealth(): Promise<void> {
    try {
      const memoryUsage = getMemoryUsage();
      const processUptime = process.uptime();
      const cacheStats = cache.getStats();
      
      // Parse memory usage
      const heapUsedMB = parseFloat(memoryUsage.heapUsed.replace(' MB', ''));
      const heapTotalMB = parseFloat(memoryUsage.heapTotal.replace(' MB', ''));
      const memoryUtilization = (heapUsedMB / heapTotalMB) * 100;

      // Get error rate from recent logs
      const errorRate = await this.calculateErrorRate();
      
      // Connection status
      const connectionStatus = await this.checkConnections();

      const healthMetrics = {
        memoryUsage: memoryUtilization,
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        uptime: processUptime,
        cacheHitRate: cacheStats.hitRate,
        cacheKeys: cacheStats.keys,
        errorRate,
        connections: connectionStatus,
        timestamp: new Date()
      };

      // Log system health
      logSystemHealth(healthMetrics);

      // Store metrics for trending
      this.storeHealthMetrics(healthMetrics);

      // Check for alerts
      await this.checkSystemAlerts(healthMetrics);

    } catch (error) {
      logger.error('Error monitoring system health:', error);
    }
  }

  private async calculateErrorRate(): Promise<number> {
    // Simple error rate calculation based on cache
    const errorStats = cache.get('error_stats') || { total: 0, errors: 0 };
    return errorStats.total > 0 ? (errorStats.errors / errorStats.total) * 100 : 0;
  }

  private async checkConnections(): Promise<any> {
    // This would be injected or accessed differently in a real implementation
    return {
      database: true, // Placeholder
      marketData: true, // Placeholder
      brokers: true // Placeholder
    };
  }

  private storeHealthMetrics(metrics: any): void {
    // Store current metrics
    cache.set('latest_health_metrics', metrics, 3600);

    // Store in time series for trending
    const timeSeriesKey = `health_metrics:${new Date().toISOString().split('T')[0]}`;
    const existing = cache.get<any[]>(timeSeriesKey) || [];
    existing.push({
      timestamp: metrics.timestamp,
      memoryUsage: metrics.memoryUsage,
      errorRate: metrics.errorRate,
      cacheHitRate: metrics.cacheHitRate
    });

    // Keep only last 288 entries (24 hours * 12 5-minute intervals)
    if (existing.length > 288) {
      existing.shift();
    }

    cache.set(timeSeriesKey, existing, 86400); // Store for 24 hours
  }

  private async checkSystemAlerts(metrics: any): Promise<void> {
    const alerts: any[] = [];

    // Memory usage alert
    if (metrics.memoryUsage > this.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'system',
        severity: 'high',
        message: `High memory usage: ${metrics.memoryUsage.toFixed(1)}%`,
        metric: 'memoryUsage',
        value: metrics.memoryUsage,
        threshold: this.alertThresholds.memoryUsage
      });
    }

    // Error rate alert
    if (metrics.errorRate > this.alertThresholds.errorRate) {
      alerts.push({
        type: 'system',
        severity: 'medium',
        message: `High error rate: ${metrics.errorRate.toFixed(1)}%`,
        metric: 'errorRate',
        value: metrics.errorRate,
        threshold: this.alertThresholds.errorRate
      });
    }

    // Low cache hit rate alert
    if (metrics.cacheHitRate < 70) {
      alerts.push({
        type: 'system',
        severity: 'low',
        message: `Low cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`,
        metric: 'cacheHitRate',
        value: metrics.cacheHitRate,
        threshold: 70
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  private async monitorPortfolioRisk(): Promise<void> {
    try {
      logger.debug('Monitoring portfolio risk...');

      const portfolios = this.portfolioManager.getAllPortfolios();
      
      for (const portfolio of portfolios) {
        const riskMetrics = await this.portfolioManager.getPortfolioRisk(portfolio.id);
        const alerts = await this.checkRiskAlerts(portfolio, riskMetrics);
        
        // Store risk metrics
        this.storeRiskMetrics(portfolio.id, riskMetrics);
        
        // Process risk alerts
        for (const alert of alerts) {
          await this.processAlert(alert);
        }
      }

    } catch (error) {
      logger.error('Error monitoring portfolio risk:', error);
    }
  }

  private async checkRiskAlerts(portfolio: any, riskMetrics: any): Promise<any[]> {
    const alerts: any[] = [];

    // VaR alert
    if (riskMetrics.var95 > this.alertThresholds.var95) {
      alerts.push({
        type: 'risk',
        severity: 'high',
        message: `Portfolio VaR exceeds limit: ${riskMetrics.var95.toLocaleString()}`,
        portfolioId: portfolio.id,
        metric: 'var95',
        value: riskMetrics.var95,
        threshold: this.alertThresholds.var95
      });
    }

    // Drawdown alert
    if (riskMetrics.maxDrawdown > this.alertThresholds.drawdown) {
      alerts.push({
        type: 'risk',
        severity: 'critical',
        message: `Portfolio drawdown exceeds limit: ${(riskMetrics.maxDrawdown * 100).toFixed(1)}%`,
        portfolioId: portfolio.id,
        metric: 'maxDrawdown',
        value: riskMetrics.maxDrawdown,
        threshold: this.alertThresholds.drawdown
      });
    }

    // Beta risk alert
    if (Math.abs(riskMetrics.beta) > 2.0) {
      alerts.push({
        type: 'risk',
        severity: 'medium',
        message: `High portfolio beta: ${riskMetrics.beta.toFixed(2)}`,
        portfolioId: portfolio.id,
        metric: 'beta',
        value: riskMetrics.beta,
        threshold: 2.0
      });
    }

    return alerts;
  }

  private storeRiskMetrics(portfolioId: string, metrics: any): void {
    const timestamp = new Date();
    
    // Store latest metrics
    cache.set(`risk_metrics:${portfolioId}:latest`, {
      ...metrics,
      timestamp
    }, 3600);

    // Store in time series
    const timeSeriesKey = `risk_metrics:${portfolioId}:${timestamp.toISOString().split('T')[0]}`;
    const existing = cache.get<any[]>(timeSeriesKey) || [];
    existing.push({
      timestamp,
      var95: metrics.var95,
      maxDrawdown: metrics.maxDrawdown,
      beta: metrics.beta,
      volatility: metrics.volatility,
      sharpeRatio: metrics.sharpeRatio
    });

    // Keep only last 96 entries (24 hours * 4 15-minute intervals)
    if (existing.length > 96) {
      existing.shift();
    }

    cache.set(timeSeriesKey, existing, 86400);
  }

  private async monitorPositions(): Promise<void> {
    try {
      logger.debug('Monitoring individual positions...');

      const portfolios = this.portfolioManager.getAllPortfolios();
      
      for (const portfolio of portfolios) {
        const positions = portfolio.positions;
        
        for (const position of positions) {
          await this.monitorPosition(portfolio.id, position);
        }
      }

    } catch (error) {
      logger.error('Error monitoring positions:', error);
    }
  }

  private async monitorPosition(portfolioId: string, position: any): Promise<void> {
    try {
      const alerts: any[] = [];
      
      // P&L alerts
      const pnlPercent = parseFloat(position.pnlPercent || '0');
      
      if (pnlPercent <= -20) {
        alerts.push({
          type: 'position',
          severity: 'high',
          message: `Large loss in ${position.symbol}: ${pnlPercent.toFixed(1)}%`,
          portfolioId,
          positionId: position.id,
          symbol: position.symbol,
          metric: 'pnlPercent',
          value: pnlPercent,
          threshold: -20
        });
      }

      // Time decay alerts for options
      const timeToExpiry = (new Date(position.expirationDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      
      if (timeToExpiry <= 30) {
        alerts.push({
          type: 'position',
          severity: 'medium',
          message: `${position.symbol} expires in ${Math.ceil(timeToExpiry)} days`,
          portfolioId,
          positionId: position.id,
          symbol: position.symbol,
          metric: 'timeToExpiry',
          value: timeToExpiry,
          threshold: 30
        });
      }

      // Delta risk alerts
      const deltaRisk = Math.abs(parseFloat(position.delta || '0'));
      if (deltaRisk > 0.9) {
        alerts.push({
          type: 'position',
          severity: 'low',
          message: `High delta exposure in ${position.symbol}: ${deltaRisk.toFixed(2)}`,
          portfolioId,
          positionId: position.id,
          symbol: position.symbol,
          metric: 'delta',
          value: deltaRisk,
          threshold: 0.9
        });
      }

      // Process alerts
      for (const alert of alerts) {
        await this.processAlert(alert);
      }

      // Store position metrics
      this.storePositionMetrics(portfolioId, position);

    } catch (error) {
      logger.warn(`Error monitoring position ${position.symbol}:`, error.message);
    }
  }

  private storePositionMetrics(portfolioId: string, position: any): void {
    const key = `position_metrics:${portfolioId}:${position.id}`;
    const metrics = {
      symbol: position.symbol,
      pnl: parseFloat(position.pnl || '0'),
      pnlPercent: parseFloat(position.pnlPercent || '0'),
      delta: parseFloat(position.delta || '0'),
      currentPrice: parseFloat(position.currentPrice || '0'),
      timestamp: new Date()
    };

    cache.set(key, metrics, 3600);
  }

  private async monitorPerformance(): Promise<void> {
    try {
      logger.debug('Monitoring system performance...');

      // Monitor API response times
      const apiMetrics = await this.measureApiPerformance();
      
      // Monitor query performance
      const queryMetrics = await this.measureQueryPerformance();
      
      // Monitor cache performance
      const cacheMetrics = cache.getStats();

      const performanceMetrics = {
        api: apiMetrics,
        queries: queryMetrics,
        cache: cacheMetrics,
        timestamp: new Date()
      };

      // Store performance metrics
      cache.set('performance_metrics', performanceMetrics, 3600);

      // Check for performance alerts
      await this.checkPerformanceAlerts(performanceMetrics);

    } catch (error) {
      logger.error('Error monitoring performance:', error);
    }
  }

  private async measureApiPerformance(): Promise<any> {
    // Measure API response times
    const startTime = Date.now();
    
    try {
      // This would make actual API calls to measure response times
      // For now, simulate measurements
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const responseTime = Date.now() - startTime;
      
      return {
        avgResponseTime: responseTime,
        successRate: 100, // Placeholder
        requestCount: 1
      };
    } catch (error) {
      return {
        avgResponseTime: -1,
        successRate: 0,
        requestCount: 0
      };
    }
  }

  private async measureQueryPerformance(): Promise<any> {
    // Measure database/cache query performance
    const metrics = {
      avgQueryTime: 15, // ms - placeholder
      slowQueries: 0,
      totalQueries: 100
    };

    return metrics;
  }

  private async checkPerformanceAlerts(metrics: any): Promise<void> {
    const alerts: any[] = [];

    // Slow API response alert
    if (metrics.api.avgResponseTime > 5000) {
      alerts.push({
        type: 'performance',
        severity: 'medium',
        message: `Slow API response time: ${metrics.api.avgResponseTime}ms`,
        metric: 'apiResponseTime',
        value: metrics.api.avgResponseTime,
        threshold: 5000
      });
    }

    // Low API success rate alert
    if (metrics.api.successRate < 95) {
      alerts.push({
        type: 'performance',
        severity: 'high',
        message: `Low API success rate: ${metrics.api.successRate}%`,
        metric: 'apiSuccessRate',
        value: metrics.api.successRate,
        threshold: 95
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  private async processAlert(alert: any): Promise<void> {
    try {
      // Log the alert
      logRiskEvent(alert.severity, alert.message, alert);

      // Store alert for dashboard
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const alertRecord = {
        id: alertId,
        ...alert,
        timestamp: new Date(),
        acknowledged: false
      };

      // Store in active alerts
      cache.set(`alert:${alertId}`, alertRecord, 86400); // 24 hours

      // Add to alerts list
      const alertsList = cache.get<string[]>('active_alerts') || [];
      alertsList.push(alertId);
      
      // Keep only last 50 alerts
      if (alertsList.length > 50) {
        const removedAlert = alertsList.shift();
        if (removedAlert) {
          cache.del(`alert:${removedAlert}`);
        }
      }
      
      cache.set('active_alerts', alertsList, 86400);

      // Send notifications for critical alerts
      if (alert.severity === 'critical') {
        await this.sendCriticalAlertNotification(alert);
      }

    } catch (error) {
      logger.error('Error processing alert:', error);
    }
  }

  private async sendCriticalAlertNotification(alert: any): Promise<void> {
    // Implementation for sending notifications (email, Slack, etc.)
    logger.error(`CRITICAL ALERT: ${alert.message}`);
    
    // Store critical alert count
    const criticalCount = cache.get('critical_alerts_count') || 0;
    cache.set('critical_alerts_count', criticalCount + 1, 86400);
  }

  private async generateDailySummary(): Promise<void> {
    try {
      logger.info('Generating daily monitoring summary...');

      const portfolios = this.portfolioManager.getAllPortfolios();
      const systemHealth = cache.get('latest_health_metrics');
      const alerts = await this.getTodaysAlerts();

      const summary = {
        date: new Date().toISOString().split('T')[0],
        portfolios: portfolios.map(p => ({
          id: p.id,
          totalValue: p.totalValue,
          dailyPnL: p.dailyPnL,
          activePositions: p.positions.length
        })),
        systemHealth: {
          memoryUsage: systemHealth?.memoryUsage || 0,
          uptime: process.uptime(),
          errorRate: systemHealth?.errorRate || 0
        },
        alerts: {
          total: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        },
        performance: {
          cacheHitRate: systemHealth?.cacheHitRate || 0,
          avgResponseTime: cache.get('performance_metrics')?.api?.avgResponseTime || 0
        }
      };

      // Store daily summary
      const dateKey = new Date().toISOString().split('T')[0];
      cache.set(`daily_summary:${dateKey}`, summary, 86400 * 7); // Keep for 7 days
      cache.set('latest_daily_summary', summary, 86400);

      logger.info('Daily monitoring summary generated');

    } catch (error) {
      logger.error('Error generating daily summary:', error);
    }
  }

  private async getTodaysAlerts(): Promise<any[]> {
    const alertsList = cache.get<string[]>('active_alerts') || [];
    const alerts: any[] = [];
    
    const today = new Date().toISOString().split('T')[0];
    
    for (const alertId of alertsList) {
      const alert = cache.get(`alert:${alertId}`);
      if (alert && alert.timestamp && alert.timestamp.startsWith(today)) {
        alerts.push(alert);
      }
    }
    
    return alerts;
  }

  // Public methods for getting monitoring data
  getSystemHealth(): any {
    return cache.get('latest_health_metrics');
  }

  getActiveAlerts(): any[] {
    const alertsList = cache.get<string[]>('active_alerts') || [];
    const alerts: any[] = [];
    
    for (const alertId of alertsList) {
      const alert = cache.get(`alert:${alertId}`);
      if (alert && !alert.acknowledged) {
        alerts.push(alert);
      }
    }
    
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
  }

  acknowledgeAlert(alertId: string): void {
    const alert = cache.get(`alert:${alertId}`);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      cache.set(`alert:${alertId}`, alert, 86400);
    }
  }

  getPerformanceMetrics(): any {
    return cache.get('performance_metrics');
  }

  getDailySummary(date?: string): any {
    const dateKey = date || new Date().toISOString().split('T')[0];
    return cache.get(`daily_summary:${dateKey}`) || cache.get('latest_daily_summary');
  }

  getStatus(): {
    isRunning: boolean;
    activeTasks: number;
    systemHealth: any;
    activeAlerts: number;
  } {
    const health = this.getSystemHealth();
    const alerts = this.getActiveAlerts();
    
    return {
      isRunning: this.isRunning,
      activeTasks: this.monitoringTasks.length,
      systemHealth: health,
      activeAlerts: alerts.length
    };
  }
}

// Global instance
let monitoringJobInstance: MonitoringJob | null = null;

export function startMonitoringJob(portfolioManager: PortfolioManager): void {
  if (monitoringJobInstance) {
    logger.warn('Monitoring job already started');
    return;
  }

  monitoringJobInstance = new MonitoringJob(portfolioManager);
  monitoringJobInstance.start().catch(error => {
    logger.error('Failed to start monitoring job:', error);
  });
}

export function stopMonitoringJob(): void {
  if (monitoringJobInstance) {
    monitoringJobInstance.stop();
    monitoringJobInstance = null;
  }
}

export function getMonitoringJobStatus() {
  return monitoringJobInstance?.getStatus() || {
    isRunning: false,
    activeTasks: 0,
    systemHealth: null,
    activeAlerts: 0
  };
}

export function getSystemHealth() {
  return monitoringJobInstance?.getSystemHealth() || null;
}

export function getActiveAlerts() {
  return monitoringJobInstance?.getActiveAlerts() || [];
}

export function acknowledgeAlert(alertId: string): void {
  monitoringJobInstance?.acknowledgeAlert(alertId);
}
