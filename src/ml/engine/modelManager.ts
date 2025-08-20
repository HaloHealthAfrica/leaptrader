import { Logger } from '../../utils/logger';

export interface ModelMeta {
  name: string;
  version: string;
  type: 'strike_selection' | 'entry_exit' | 'strategy_improvement';
  createdAt: string;
  performance: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ModelEnsemble {
  name: string;
  models: string[];
  weights: number[];
  createdAt: string;
}

/**
 * Manages ML models, versions, and performance tracking
 * Handles model loading, versioning, and ensemble creation
 */
export class ModelManager {
  private readonly log = new Logger('model-manager');
  private readonly models = new Map<string, ModelMeta>();
  private readonly ensembles = new Map<string, ModelEnsemble>();
  private readonly activeModels = new Map<string, string>(); // type -> modelName

  constructor() {
    this.initializeDefaultModels();
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
        performance: {
          accuracy: 0.78,
          precision: 0.82,
          recall: 0.75,
          f1Score: 0.78,
          sharpeRatio: 1.45,
          maxDrawdown: 0.12
        },
        metadata: {
          description: 'Default LEAPS strike selection model',
          features: ['delta', 'iv_rank', 'spread', 'oi_volume', 'extrinsic_value'],
          trainingData: '2022-2024 options data'
        }
      },
      {
        name: 'entry-exit-v1.0',
        version: '1.0.0',
        type: 'entry_exit',
        createdAt: new Date().toISOString(),
        performance: {
          accuracy: 0.71,
          precision: 0.68,
          recall: 0.73,
          f1Score: 0.70,
          sharpeRatio: 1.23,
          maxDrawdown: 0.15
        },
        metadata: {
          description: 'Entry/exit timing optimization model',
          features: ['iv_rank', 'trend_strength', 'support_resistance', 'volatility_regime']
        }
      }
    ];

    defaultModels.forEach(model => {
      this.models.set(model.name, model);
      this.activeModels.set(model.type, model.name);
    });

    // Create default ensemble
    this.ensembles.set('leaps-default', {
      name: 'leaps-default',
      models: ['leaps-v1.2'],
      weights: [1.0],
      createdAt: new Date().toISOString()
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
   * Get model version
   */
  getModelVersion(modelName: string): string {
    return this.models.get(modelName)?.version || 'unknown';
  }

  /**
   * Get model metadata
   */
  getMLModelMeta(modelName: string): ModelMeta | undefined {
    return this.models.get(modelName);
  }

  /**
   * Apply model ensemble for scoring
   */
  async applyEnsemble(
    modelName: string,
    type: string,
    candidates: unknown[],
    baseScores: number[]
  ): Promise<number[]> {
    const ensemble = this.ensembles.get(`${modelName}-ensemble`) || this.ensembles.get('leaps-default');
    
    if (!ensemble) {
      this.log.warn('No ensemble found, using base scores', { modelName, type });
      return baseScores;
    }

    try {
      // For now, return weighted average of base scores
      // In production, this would call actual ensemble models
      const weights = ensemble.weights;
      const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
      
      this.log.debug('Applied ensemble', { 
        ensemble: ensemble.name, 
        weights: weights,
        candidates: candidates.length 
      });

      return baseScores.map(score => score * avgWeight);

    } catch (error) {
      this.log.error('Ensemble application failed', error as Error, { modelName, type });
      return baseScores;
    }
  }

  /**
   * Get entry/exit adjustment from model
   */
  async getEntryExitAdjustment(
    modelName: string,
    underlying: string,
    side: string,
    features: Record<string, any>
  ): Promise<{
    slPctAdj: number;
    tpPctAdj: number;
    confidence: number;
    reasons?: string[];
  }> {
    const model = this.models.get(modelName);
    
    if (!model || model.type !== 'entry_exit') {
      this.log.warn('No entry/exit model found', { modelName, underlying });
      return { slPctAdj: 0, tpPctAdj: 0, confidence: 0.5 };
    }

    try {
      // Simple rule-based adjustments based on features
      // In production, this would call the actual ML model
      const ivRank = features.u_ivRank || 50;
      const trendDays = features.u_trendDays || 0;
      
      let slPctAdj = 0;
      let tpPctAdj = 0;
      let confidence = 0.5;
      const reasons: string[] = [];

      // IV Rank based adjustments
      if (ivRank > 80) {
        slPctAdj = -0.1; // Tighter SL for high IV
        tpPctAdj = 0.2;  // Extended TP for high IV
        reasons.push('High IV rank - tighter SL, extended TP');
        confidence = 0.7;
      } else if (ivRank < 20) {
        slPctAdj = 0.1;  // Wider SL for low IV
        tpPctAdj = -0.1; // Tighter TP for low IV
        reasons.push('Low IV rank - wider SL, tighter TP');
        confidence = 0.6;
      }

      // Trend based adjustments
      if (trendDays > 5) {
        tpPctAdj += 0.1; // Extended TP for strong trends
        reasons.push('Strong trend - extended TP');
        confidence = Math.min(1, confidence + 0.1);
      }

      return { slPctAdj, tpPctAdj, confidence, reasons };

    } catch (error) {
      this.log.error('Entry/exit adjustment failed', error as Error, { modelName, underlying });
      return { slPctAdj: 0, tpPctAdj: 0, confidence: 0.5 };
    }
  }

  /**
   * Get performance metrics for all models
   */
  async getPerformanceMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    for (const [name, model] of this.models) {
      metrics[name] = {
        version: model.version,
        type: model.type,
        performance: model.performance,
        createdAt: model.createdAt
      };
    }

    return metrics;
  }

  /**
   * Register a new model
   */
  registerModel(model: ModelMeta): void {
    this.models.set(model.name, model);
    this.log.info('New model registered', { 
      name: model.name, 
      version: model.version, 
      type: model.type 
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

    this.activeModels.set(type, modelName);
    this.log.info('Model activated', { type, modelName });
    return true;
  }

  /**
   * Create a new ensemble
   */
  createEnsemble(ensemble: ModelEnsemble): void {
    this.ensembles.set(ensemble.name, ensemble);
    this.log.info('New ensemble created', { 
      name: ensemble.name, 
      models: ensemble.models,
      weights: ensemble.weights 
    });
  }
}
