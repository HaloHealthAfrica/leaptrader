import { Logger } from '../utils/logger';

export interface ModelMeta {
  name: string;
  version: string;
  type: 'strike_selection' | 'entry_exit' | 'strategy_improvement';
  createdAt: string;
  lastUpdated: string;
  status: 'active' | 'deprecated' | 'testing';
  performance: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    totalTrades?: number;
    winRate?: number;
    avgReturn?: number;
  };
  metadata?: Record<string, any>;
  deployment: {
    environment: 'development' | 'staging' | 'production';
    region?: string;
    instance?: string;
    health: 'healthy' | 'degraded' | 'unhealthy';
    lastHealthCheck: string;
  };
}

export interface ModelUsage {
  modelName: string;
  timestamp: string;
  requestType: 'strike_scoring' | 'entry_exit' | 'backtest';
  responseTime: number;
  success: boolean;
  error?: string;
  inputFeatures: Record<string, any>;
  outputScore?: number;
  confidence?: number;
}

export interface ModelPerformance {
  modelName: string;
  period: '1h' | '1d' | '1w' | '1m';
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    avgScore?: number;
    avgConfidence?: number;
    errorRate: number;
  };
  timestamp: string;
}

/**
 * Tracks model versions, performance, and provides telemetry for the ML system
 * Enables model monitoring, A/B testing, and performance analysis
 */
export class ModelRegistry {
  private readonly log = new Logger('model-registry');
  private readonly models = new Map<string, ModelMeta>();
  private readonly usage = new Map<string, ModelUsage[]>();
  private readonly performance = new Map<string, ModelPerformance[]>();
  private readonly activeModels = new Map<string, string>(); // type -> modelName

  constructor() {
    this.initializeDefaultModels();
    this.startHealthMonitoring();
  }

  /**
   * Initialize default models for the system
   */
  private initializeDefaultModels(): void {
    const defaultModels: ModelMeta[] = [
      {
        name: 'leaps-v1.2',
        version: '1.2.0',
        type: 'strike_selection',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'active',
        performance: {
          accuracy: 0.78,
          precision: 0.82,
          recall: 0.75,
          f1Score: 0.78,
          sharpeRatio: 1.45,
          maxDrawdown: 0.12,
          totalTrades: 1250,
          winRate: 0.68,
          avgReturn: 0.15
        },
        metadata: {
          description: 'Default LEAPS strike selection model',
          features: ['delta', 'iv_rank', 'spread', 'oi_volume', 'extrinsic_value'],
          trainingData: '2022-2024 options data',
          algorithm: 'gradient_boosting',
          hyperparameters: {
            learning_rate: 0.1,
            max_depth: 6,
            n_estimators: 100
          }
        },
        deployment: {
          environment: 'production',
          region: 'us-east-1',
          instance: 'ml-engine-001',
          health: 'healthy',
          lastHealthCheck: new Date().toISOString()
        }
      },
      {
        name: 'entry-exit-v1.0',
        version: '1.0.0',
        type: 'entry_exit',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'active',
        performance: {
          accuracy: 0.71,
          precision: 0.68,
          recall: 0.73,
          f1Score: 0.70,
          sharpeRatio: 1.23,
          maxDrawdown: 0.15,
          totalTrades: 890,
          winRate: 0.65,
          avgReturn: 0.12
        },
        metadata: {
          description: 'Entry/exit timing optimization model',
          features: ['iv_rank', 'trend_strength', 'support_resistance', 'volatility_regime'],
          algorithm: 'random_forest',
          hyperparameters: {
            n_estimators: 200,
            max_depth: 10,
            min_samples_split: 5
          }
        },
        deployment: {
          environment: 'production',
          region: 'us-east-1',
          instance: 'ml-engine-001',
          health: 'healthy',
          lastHealthCheck: new Date().toISOString()
        }
      }
    ];

    defaultModels.forEach(model => {
      this.models.set(model.name, model);
      this.activeModels.set(model.type, model.name);
      this.usage.set(model.name, []);
      this.performance.set(model.name, []);
    });

    this.log.info('Default models initialized', {
      models: Array.from(this.models.keys()),
      activeTypes: Array.from(this.activeModels.entries())
    });
  }

  /**
   * Get active model for a specific type
   */
  getActiveModel(type: string): string | undefined {
    return this.activeModels.get(type);
  }

  /**
   * Get all active models
   */
  getActiveModels(): Record<string, string> {
    return Object.fromEntries(this.activeModels);
  }

  /**
   * Get model metadata
   */
  getModelMeta(modelName: string): ModelMeta | undefined {
    return this.models.get(modelName);
  }

  /**
   * Get model version
   */
  getModelVersion(modelName: string): string {
    return this.models.get(modelName)?.version || 'unknown';
  }

  /**
   * Register a new model
   */
  registerModel(model: ModelMeta): void {
    this.models.set(model.name, model);
    this.usage.set(model.name, []);
    this.performance.set(model.name, []);
    
    this.log.info('New model registered', { 
      name: model.name, 
      version: model.version, 
      type: model.type,
      status: model.status
    });
  }

  /**
   * Activate a model for a specific type
   */
  activateModel(type: string, modelName: string): boolean {
    if (!this.models.has(modelName)) {
      this.log.warn('Cannot activate unknown model', { type, modelName });
      return false;
    }

    const previousModel = this.activeModels.get(type);
    this.activeModels.set(type, modelName);
    
    this.log.info('Model activated', { 
      type, 
      modelName, 
      previousModel: previousModel || 'none'
    });

    // Update model status
    const model = this.models.get(modelName);
    if (model) {
      model.status = 'active';
      model.lastUpdated = new Date().toISOString();
    }

    return true;
  }

  /**
   * Record model usage for telemetry
   */
  recordUsage(usage: ModelUsage): void {
    const modelUsage = this.usage.get(usage.modelName) || [];
    modelUsage.push(usage);
    
    // Keep only last 1000 usage records per model
    if (modelUsage.length > 1000) {
      modelUsage.splice(0, modelUsage.length - 1000);
    }
    
    this.usage.set(usage.modelName, modelUsage);
    
    this.log.debug('Model usage recorded', {
      model: usage.modelName,
      type: usage.requestType,
      responseTime: usage.responseTime,
      success: usage.success
    });
  }

  /**
   * Update model performance metrics
   */
  updatePerformance(modelName: string, performance: ModelPerformance): void {
    const modelPerformance = this.performance.get(modelName) || [];
    modelPerformance.push(performance);
    
    // Keep only last 100 performance records per model
    if (modelPerformance.length > 100) {
      modelPerformance.splice(0, modelPerformance.length - 100);
    }
    
    this.performance.set(modelName, modelPerformance);
    
    this.log.debug('Model performance updated', {
      model: modelName,
      period: performance.period,
      totalRequests: performance.metrics.totalRequests,
      errorRate: performance.metrics.errorRate
    });
  }

  /**
   * Get performance metrics for a model
   */
  getModelPerformance(modelName: string, period: string): ModelPerformance | undefined {
    const modelPerformance = this.performance.get(modelName) || [];
    return modelPerformance
      .filter(p => p.period === period)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  /**
   * Get all performance metrics
   */
  async getPerformanceMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    for (const [name, model] of this.models) {
      const latestPerformance = this.performance.get(name) || [];
      const latest = latestPerformance.length > 0 ? latestPerformance[latestPerformance.length - 1] : null;
      
      metrics[name] = {
        version: model.version,
        type: model.type,
        status: model.status,
        performance: model.performance,
        createdAt: model.createdAt,
        lastUpdated: model.lastUpdated,
        deployment: model.deployment,
        latestMetrics: latest
      };
    }

    return metrics;
  }

  /**
   * Get model health status
   */
  getModelHealth(modelName: string): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    const model = this.models.get(modelName);
    return model?.deployment.health || 'unknown';
  }

  /**
   * Update model health status
   */
  updateModelHealth(modelName: string, health: 'healthy' | 'degraded' | 'unhealthy'): void {
    const model = this.models.get(modelName);
    if (model) {
      model.deployment.health = health;
      model.deployment.lastHealthCheck = new Date().toISOString();
      
      this.log.info('Model health updated', { modelName, health });
    }
  }

  /**
   * Get model usage statistics
   */
  getModelUsageStats(modelName: string, hours: number = 24): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    errorRate: number;
  } {
    const modelUsage = this.usage.get(modelName) || [];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const recentUsage = modelUsage.filter(u => new Date(u.timestamp) > cutoff);
    
    if (recentUsage.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        errorRate: 0
      };
    }

    const totalRequests = recentUsage.length;
    const successfulRequests = recentUsage.filter(u => u.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const avgResponseTime = recentUsage.reduce((sum, u) => sum + u.responseTime, 0) / totalRequests;
    const errorRate = failedRequests / totalRequests;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      errorRate
    };
  }

  /**
   * Start health monitoring for all models
   */
  private startHealthMonitoring(): void {
    // Monitor model health every 5 minutes
    setInterval(() => {
      this.checkModelHealth();
    }, 5 * 60 * 1000);
  }

  /**
   * Check health of all models
   */
  private async checkModelHealth(): Promise<void> {
    for (const [name, model] of this.models) {
      try {
        // In production, this would make actual health checks to ML services
        // For now, simulate health checks
        const health = await this.simulateHealthCheck(model);
        this.updateModelHealth(name, health);
      } catch (error) {
        this.log.error('Health check failed', error as Error, { modelName: name });
        this.updateModelHealth(name, 'unhealthy');
      }
    }
  }

  /**
   * Simulate health check (replace with actual health check logic)
   */
  private async simulateHealthCheck(model: ModelMeta): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    // Simulate 95% healthy, 4% degraded, 1% unhealthy
    const random = Math.random();
    if (random < 0.95) return 'healthy';
    if (random < 0.99) return 'degraded';
    return 'unhealthy';
  }

  /**
   * Get models by type
   */
  getModelsByType(type: string): ModelMeta[] {
    return Array.from(this.models.values()).filter(m => m.type === type);
  }

  /**
   * Get deprecated models
   */
  getDeprecatedModels(): ModelMeta[] {
    return Array.from(this.models.values()).filter(m => m.status === 'deprecated');
  }

  /**
   * Mark model as deprecated
   */
  deprecateModel(modelName: string): boolean {
    const model = this.models.get(modelName);
    if (!model) return false;

    model.status = 'deprecated';
    model.lastUpdated = new Date().toISOString();
    
    this.log.info('Model deprecated', { modelName, type: model.type });
    return true;
  }

  /**
   * Get model comparison data for A/B testing
   */
  getModelComparison(model1: string, model2: string, period: string = '1d'): {
    model1: ModelPerformance | undefined;
    model2: ModelPerformance | undefined;
    comparison: {
      responseTimeDiff: number;
      errorRateDiff: number;
      scoreDiff?: number;
      confidenceDiff?: number;
    };
  } {
    const perf1 = this.getModelPerformance(model1, period);
    const perf2 = this.getModelPerformance(model2, period);

    if (!perf1 || !perf2) {
      return { model1: perf1, model2: perf2, comparison: { responseTimeDiff: 0, errorRateDiff: 0 } };
    }

    const responseTimeDiff = perf1.metrics.avgResponseTime - perf2.metrics.avgResponseTime;
    const errorRateDiff = perf1.metrics.errorRate - perf2.metrics.errorRate;
    const scoreDiff = (perf1.metrics.avgScore || 0) - (perf2.metrics.avgScore || 0);
    const confidenceDiff = (perf1.metrics.avgConfidence || 0) - (perf2.metrics.avgConfidence || 0);

    return {
      model1: perf1,
      model2: perf2,
      comparison: {
        responseTimeDiff,
        errorRateDiff,
        scoreDiff,
        confidenceDiff
      }
    };
  }
}
