import { Logger } from '../../utils/logger';
import { MLEngine, StrikeScoringRequest, StrikeScoringResponse, EntryExitRequest, EntryExitResponse } from '../../core/ports';
import { FeatureBuilder } from '../../features/FeatureBuilder';
import { ModelManager } from './modelManager';
import { StrikeOptimizer } from './strikeOptimizer';
import { EntryExitModel } from './entryExitModel';

/**
 * Core ML Engine that orchestrates all ML models and predictions
 * Provides a unified interface for strike selection, entry/exit optimization, and strategy improvement
 */
export class MLEngineCore implements MLEngine {
  private readonly log = new Logger('ml-engine');
  private readonly featureBuilder: FeatureBuilder;
  private readonly modelManager: ModelManager;
  private readonly strikeOptimizer: StrikeOptimizer;
  private readonly entryExitModel: EntryExitModel;

  constructor() {
    this.featureBuilder = new FeatureBuilder();
    this.modelManager = new ModelManager();
    this.strikeOptimizer = new StrikeOptimizer();
    this.entryExitModel = new EntryExitModel();
    
    this.log.info('ML Engine initialized', {
      featureVersion: FeatureBuilder.VERSION,
      activeModels: this.modelManager.getActiveModels()
    });
  }

  /**
   * Score option candidates for strike selection (0..1). Higher is better.
   * Integrates multiple models for robust scoring
   */
  async scoreStrike(req: StrikeScoringRequest): Promise<StrikeScoringResponse> {
    try {
      this.log.debug('Scoring strikes', { 
        model: req.model, 
        candidates: req.candidates.length,
        underlying: req.selectionContext.side 
      });

      // Build features for all candidates
      const candidatesWithFeatures = req.candidates.map(candidate => ({
        ...candidate,
        features: this.featureBuilder.buildCombinedFeatures(
          {
            symbol: candidate.contract.underlying,
            spot: req.underlyingSpot,
            ivRank: req.selectionContext.ivRank
          },
          candidate.contract
        )
      }));

      // Get strike optimization scores
      const strikeScores = await this.strikeOptimizer.scoreCandidates(
        candidatesWithFeatures,
        req.selectionContext
      );

      // Apply model ensemble if available
      const ensembleScores = await this.modelManager.applyEnsemble(
        req.model,
        'strike_selection',
        candidatesWithFeatures,
        strikeScores
      );

      const scored = req.candidates.map((candidate, index) => {
        const ensembleScore = ensembleScores[index];
        const strikeScore = strikeScores[index];
        const finalScore = ensembleScore ?? strikeScore ?? 0.5;
        
        return {
          symbol: candidate.contract.symbol,
          score: finalScore,
          reasons: this.generateStrikeReasons(candidate.contract, finalScore)
        };
      });

      this.log.info('Strike scoring completed', { 
        model: req.model, 
        scored: scored.length,
        avgScore: scored.reduce((sum, s) => sum + s.score, 0) / scored.length
      });

      return {
        model: req.model,
        version: this.modelManager.getModelVersion(req.model),
        scored
      };

    } catch (error) {
      this.log.error('Strike scoring failed', error as Error, { request: req });
      throw error;
    }
  }

  /**
   * Suggest entry/exit thresholds; returns target SL/TP modifiers and confidence
   */
  async scoreEntryExit(req: EntryExitRequest): Promise<EntryExitResponse> {
    try {
      this.log.debug('Scoring entry/exit', { 
        model: req.model, 
        underlying: req.underlying,
        side: req.side 
      });

      // Get base entry/exit recommendations
      const baseRecommendation = await this.entryExitModel.getRecommendation(
        req.underlying,
        req.side,
        req.features
      );

      // Apply model-specific adjustments
      const modelAdjustment = await this.modelManager.getEntryExitAdjustment(
        req.model,
        req.underlying,
        req.side,
        req.features
      );

      const slPctAdj = baseRecommendation.slPctAdj + (modelAdjustment.slPctAdj ?? 0);
      const tpPctAdj = baseRecommendation.tpPctAdj + (modelAdjustment.tpPctAdj ?? 0);
      const baseConfidence = baseRecommendation.confidence ?? 0;
      const modelConfidence = modelAdjustment.confidence ?? 0;
      const confidence = Math.min(1, (baseConfidence + modelConfidence) / 2);

      this.log.info('Entry/exit scoring completed', { 
        model: req.model,
        slPctAdj,
        tpPctAdj,
        confidence
      });

      return {
        model: req.model,
        version: this.modelManager.getModelVersion(req.model),
        slPctAdj,
        tpPctAdj,
        confidence,
        reasons: [
          `Base: ${baseRecommendation.reasons?.join(', ')}`,
          `Model adjustment: ${modelAdjustment.reasons?.join(', ')}`
        ].filter(Boolean)
      };

    } catch (error) {
      this.log.error('Entry/exit scoring failed', error as Error, { request: req });
      throw error;
    }
  }

  /**
   * Generate human-readable reasons for strike selection
   */
  private generateStrikeReasons(contract: {
    greeks?: { delta?: number };
    openInterest?: number;
  }, score: number): string[] {
    const reasons: string[] = [];
    
    if (score > 0.8) reasons.push('High ML confidence');
    else if (score > 0.6) reasons.push('Good ML confidence');
    else if (score > 0.4) reasons.push('Moderate ML confidence');
    else reasons.push('Low ML confidence');

    if (contract.greeks?.delta !== undefined) {
      reasons.push(`Delta: ${Math.abs(contract.greeks.delta).toFixed(2)}`);
    }

    if (contract.openInterest !== undefined && contract.openInterest > 1000) {
      reasons.push('High open interest');
    }

    return reasons;
  }

  /**
   * Get feature builder for external use
   */
  getFeatureBuilder(): FeatureBuilder {
    return this.featureBuilder;
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(): Promise<Record<string, any>> {
    return this.modelManager.getPerformanceMetrics();
  }
}
