import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MLEngineCore } from '../../src/ml/engine/mlEngine';
import { ModelManager } from '../../src/ml/engine/modelManager';
import { StrikeOptimizer } from '../../src/ml/engine/strikeOptimizer';
import { EntryExitModel } from '../../src/ml/engine/entryExitModel';
import { FeatureBuilder } from '../../src/features/FeatureBuilder';
import { OptionContract, OptionRight } from '../../src/core/types';

// Mock the logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn()
  }))
}));

describe('ML Engine Integration Tests', () => {
  let mlEngine: MLEngineCore;
  let modelManager: ModelManager;
  let strikeOptimizer: StrikeOptimizer;
  let entryExitModel: EntryExitModel;
  let featureBuilder: FeatureBuilder;

  beforeEach(() => {
    modelManager = new ModelManager();
    strikeOptimizer = new StrikeOptimizer();
    entryExitModel = new EntryExitModel();
    featureBuilder = new FeatureBuilder();
    mlEngine = new MLEngineCore();
  });

  describe('FeatureBuilder', () => {
    it('should build consistent features for the same input', () => {
      const underlying = { symbol: 'AAPL', spot: 150, ivRank: 45, rsi14: 65, atr14: 2.5, trendDays: 3 };
      const contract: OptionContract = {
        symbol: 'AAPL-C-160-2025-01-17',
        underlying: 'AAPL',
        right: 'call' as OptionRight,
        strike: 160,
        expiration: '2025-01-17',
        bid: 8.5,
        ask: 9.0,
        volume: 1500,
        openInterest: 2500,
        greeks: { delta: 0.68, gamma: 0.02, theta: -0.03, vega: 0.15 }
      };

      const features1 = featureBuilder.buildCombinedFeatures(underlying, contract);
      const features2 = featureBuilder.buildCombinedFeatures(underlying, contract);

      expect(features1).toEqual(features2);
      expect(features1._spec).toBe(FeatureBuilder.VERSION);
      expect(features1.u_symbol).toBe('AAPL');
      expect(features1.c_symbol).toBe('AAPL-C-160-2025-01-17');
      expect(features1.c_delta).toBe(0.68);
    });

    it('should handle missing optional features gracefully', () => {
      const underlying = { symbol: 'TSLA', spot: 200 };
      const contract: OptionContract = {
        symbol: 'TSLA-P-180-2025-01-17',
        underlying: 'TSLA',
        right: 'put' as OptionRight,
        strike: 180,
        expiration: '2025-01-17',
        bid: 12.0,
        ask: 12.5,
        volume: 800,
        openInterest: 1200
      };

      const features = featureBuilder.buildCombinedFeatures(underlying, contract);
      
      expect(features.u_ivRank).toBe(-1);
      expect(features.u_rsi14).toBe(-1);
      expect(features.u_atr14).toBe(-1);
      expect(features.u_trendDays).toBe(0);
      expect(features.c_iv).toBe(-1);
      expect(features.c_delta).toBe(0);
    });
  });

  describe('StrikeOptimizer', () => {
    it('should score candidates based on delta alignment', async () => {
      const candidates = [
        {
          contract: {
            symbol: 'AAPL-C-150-2025-01-17',
            underlying: 'AAPL',
            right: 'call' as OptionRight,
            strike: 150,
            expiration: '2025-01-17',
            bid: 15.0,
            ask: 15.5,
            volume: 2000,
            openInterest: 3000,
            greeks: { delta: 0.65, gamma: 0.02, theta: -0.03, vega: 0.12 }
          },
          features: { c_delta: 0.65, c_spreadPct: 3.2, c_oi: 3000, c_vol: 2000 }
        },
        {
          contract: {
            symbol: 'AAPL-C-160-2025-01-17',
            underlying: 'AAPL',
            right: 'call' as OptionRight,
            strike: 160,
            expiration: '2025-01-17',
            bid: 8.5,
            ask: 9.0,
            volume: 1500,
            openInterest: 2500,
            greeks: { delta: 0.55, gamma: 0.02, theta: -0.03, vega: 0.15 }
          },
          features: { c_delta: 0.55, c_spreadPct: 5.7, c_oi: 2500, c_vol: 1500 }
        }
      ];

      const context = {
        side: 'long_call' as const,
        deltaRange: [0.55, 0.70] as [number, number],
        dteRange: [365, 730] as [number, number],
        ivRank: 45
      };

      const scores = await strikeOptimizer.scoreCandidates(candidates, context);
      
      expect(scores).toHaveLength(2);
      expect(scores[0]).toBeGreaterThan(0);
      expect(scores[1]).toBeGreaterThan(0);
      
      // First candidate should score higher due to better delta alignment
      expect(scores[0]).toBeGreaterThan(scores[1]);
    });

    it('should handle candidates with missing greeks', async () => {
      const candidates = [
        {
          contract: {
            symbol: 'AAPL-C-150-2025-01-17',
            underlying: 'AAPL',
            right: 'call' as OptionRight,
            strike: 150,
            expiration: '2025-01-17',
            bid: 15.0,
            ask: 15.5,
            volume: 2000,
            openInterest: 3000
          },
          features: { c_delta: 0, c_spreadPct: 3.2, c_oi: 3000, c_vol: 2000 }
        }
      ];

      const context = {
        side: 'long_call' as const,
        deltaRange: [0.55, 0.70] as [number, number],
        dteRange: [365, 730] as [number, number]
      };

      const scores = await strikeOptimizer.scoreCandidates(candidates, context);
      
      expect(scores).toHaveLength(1);
      expect(scores[0]).toBeGreaterThanOrEqual(0);
      expect(scores[0]).toBeLessThanOrEqual(1);
    });
  });

  describe('EntryExitModel', () => {
    it('should provide recommendations for long calls', async () => {
      const features = {
        u_ivRank: 75,
        u_rsi14: 60,
        u_trendDays: 4,
        u_atr14: 2.0
      };

      const recommendation = await entryExitModel.getRecommendation('AAPL', 'long_call', features);
      
      expect(recommendation.slPctAdj).toBeGreaterThanOrEqual(-0.4);
      expect(recommendation.slPctAdj).toBeLessThanOrEqual(0.4);
      expect(recommendation.tpPctAdj).toBeGreaterThanOrEqual(-0.3);
      expect(recommendation.tpPctAdj).toBeLessThanOrEqual(0.6);
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
      expect(recommendation.reasons).toBeDefined();
      expect(recommendation.reasons!.length).toBeGreaterThan(0);
    });

    it('should provide recommendations for long puts', async () => {
      const features = {
        u_ivRank: 25,
        u_rsi14: 40,
        u_trendDays: -3,
        u_atr14: 1.5
      };

      const recommendation = await entryExitModel.getRecommendation('SPY', 'long_put', features);
      
      expect(recommendation.slPctAdj).toBeGreaterThanOrEqual(-0.4);
      expect(recommendation.slPctAdj).toBeLessThanOrEqual(0.4);
      expect(recommendation.tpPctAdj).toBeGreaterThanOrEqual(-0.3);
      expect(recommendation.tpPctAdj).toBeLessThanOrEqual(0.6);
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle extreme market conditions', async () => {
      const features = {
        u_ivRank: 95, // Very high IV
        u_rsi14: 85,  // Very high RSI
        u_trendDays: 8, // Very strong trend
        u_atr14: 4.0  // High volatility
      };

      const recommendation = await entryExitModel.getRecommendation('QQQ', 'long_call', features);
      
      // Should have higher confidence for extreme conditions
      expect(recommendation.confidence).toBeGreaterThan(0.6);
      expect(recommendation.reasons).toContain(expect.stringContaining('High IV rank'));
      expect(recommendation.reasons).toContain(expect.stringContaining('Strong trend'));
    });
  });

  describe('ModelManager', () => {
    it('should manage model versions correctly', () => {
      const modelName = 'test-model-v1.0';
      const modelMeta = {
        name: modelName,
        version: '1.0.0',
        type: 'strike_selection' as const,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'testing' as const,
        performance: { accuracy: 0.75 },
        deployment: {
          environment: 'development' as const,
          health: 'healthy' as const,
          lastHealthCheck: new Date().toISOString()
        }
      };

      modelManager.registerModel(modelMeta);
      
      expect(modelManager.getModelMeta(modelName)).toEqual(modelMeta);
      expect(modelManager.getModelVersion(modelName)).toBe('1.0.0');
    });

    it('should activate models correctly', () => {
      const modelName = 'leaps-v1.2';
      const result = modelManager.activateModel('strike_selection', modelName);
      
      expect(result).toBe(true);
      expect(modelManager.getActiveModel('strike_selection')).toBe(modelName);
    });

    it('should provide performance metrics', async () => {
      const metrics = await modelManager.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
      
      // Check that default models are included
      expect(metrics['leaps-v1.2']).toBeDefined();
      expect(metrics['entry-exit-v1.0']).toBeDefined();
    });
  });

  describe('ML Engine Core', () => {
    it('should score strikes with ML integration', async () => {
      const request = {
        model: 'leaps-v1.2',
        asOf: new Date().toISOString(),
        underlyingSpot: 150,
        selectionContext: {
          side: 'long_call' as const,
          deltaRange: [0.55, 0.70] as [number, number],
          dteRange: [365, 730] as [number, number],
          ivRank: 45
        },
        candidates: [
          {
            contract: {
              symbol: 'AAPL-C-150-2025-01-17',
              underlying: 'AAPL',
              right: 'call' as OptionRight,
              strike: 150,
              expiration: '2025-01-17',
              bid: 15.0,
              ask: 15.5,
              volume: 2000,
              openInterest: 3000,
              greeks: { delta: 0.65, gamma: 0.02, theta: -0.03, vega: 0.12 }
            }
          }
        ]
      };

      const response = await mlEngine.scoreStrike(request);
      
      expect(response.model).toBe('leaps-v1.2');
      expect(response.scored).toHaveLength(1);
      expect(response.scored[0].score).toBeGreaterThanOrEqual(0);
      expect(response.scored[0].score).toBeLessThanOrEqual(1);
      expect(response.scored[0].reasons).toBeDefined();
    });

    it('should provide entry/exit recommendations', async () => {
      const request = {
        model: 'entry-exit-v1.0',
        asOf: new Date().toISOString(),
        underlying: 'AAPL',
        side: 'long_call' as const,
        features: {
          u_ivRank: 65,
          u_rsi14: 55,
          u_trendDays: 2,
          u_atr14: 1.8
        }
      };

      const response = await mlEngine.scoreEntryExit(request);
      
      expect(response.model).toBe('entry-exit-v1.0');
      expect(response.slPctAdj).toBeGreaterThanOrEqual(-0.4);
      expect(response.slPctAdj).toBeLessThanOrEqual(0.4);
      expect(response.tpPctAdj).toBeGreaterThanOrEqual(-0.3);
      expect(response.tpPctAdj).toBeLessThanOrEqual(0.6);
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide feature builder access', () => {
      const featureBuilder = mlEngine.getFeatureBuilder();
      expect(featureBuilder).toBeDefined();
      expect(featureBuilder.VERSION).toBe(FeatureBuilder.VERSION);
    });

    it('should provide model metrics', async () => {
      const metrics = await mlEngine.getModelMetrics();
      expect(metrics).toBeDefined();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });
  });
});
