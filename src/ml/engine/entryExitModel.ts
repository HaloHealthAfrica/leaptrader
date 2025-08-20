import { Logger } from '../../utils/logger';

export interface EntryExitRecommendation {
  slPctAdj: number;    // Stop loss percentage adjustment
  tpPctAdj: number;    // Take profit percentage adjustment
  confidence: number;   // Confidence level 0-1
  reasons?: string[];   // Explanation for recommendations
}

export interface MarketRegime {
  volatility: 'low' | 'medium' | 'high';
  trend: 'bullish' | 'bearish' | 'sideways';
  momentum: 'strong' | 'weak' | 'reversing';
}

/**
 * Provides entry/exit timing recommendations based on market conditions
 * Uses ML features to optimize stop loss and take profit levels
 */
export class EntryExitModel {
  private readonly log = new Logger('entry-exit-model');

  /**
   * Get entry/exit recommendation for a specific underlying and strategy
   */
  async getRecommendation(
    underlying: string,
    side: 'long_call' | 'long_put',
    features: Record<string, any>
  ): Promise<EntryExitRecommendation> {
    try {
      this.log.debug('Getting entry/exit recommendation', { underlying, side });

      // Analyze market regime
      const regime = this.analyzeMarketRegime(features);
      
      // Get base recommendations
      const baseRecommendation = this.getBaseRecommendation(side, regime);
      
      // Apply feature-based adjustments
      const adjustedRecommendation = this.applyFeatureAdjustments(
        baseRecommendation,
        features,
        regime
      );

      this.log.debug('Entry/exit recommendation generated', {
        underlying,
        side,
        regime,
        slPctAdj: adjustedRecommendation.slPctAdj,
        tpPctAdj: adjustedRecommendation.tpPctAdj,
        confidence: adjustedRecommendation.confidence
      });

      return adjustedRecommendation;

    } catch (error) {
      this.log.error('Entry/exit recommendation failed', error as Error, { underlying, side });
      return {
        slPctAdj: 0,
        tpPctAdj: 0,
        confidence: 0.5,
        reasons: ['Error generating recommendation - using defaults']
      };
    }
  }

  /**
   * Analyze market regime based on features
   */
  private analyzeMarketRegime(features: Record<string, any>): MarketRegime {
    const ivRank = features.u_ivRank || 50;
    const rsi14 = features.u_rsi14 || 50;
    const trendDays = features.u_trendDays || 0;
    const atr14 = features.u_atr14 || 0;

    // Volatility regime
    let volatility: 'low' | 'medium' | 'high' = 'medium';
    if (ivRank < 30) volatility = 'low';
    else if (ivRank > 70) volatility = 'high';

    // Trend regime
    let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    if (trendDays > 5) trend = 'bullish';
    else if (trendDays < -5) trend = 'bearish';

    // Momentum regime
    let momentum: 'strong' | 'weak' | 'reversing' = 'weak';
    if (rsi14 > 70 || rsi14 < 30) momentum = 'reversing';
    else if (Math.abs(trendDays) > 3) momentum = 'strong';

    return { volatility, trend, momentum };
  }

  /**
   * Get base recommendations based on strategy side and market regime
   */
  private getBaseRecommendation(
    side: 'long_call' | 'long_put',
    regime: MarketRegime
  ): EntryExitRecommendation {
    let slPctAdj = 0;
    let tpPctAdj = 0;
    let confidence = 0.6;
    const reasons: string[] = [];

    // Base adjustments for strategy side
    if (side === 'long_call') {
      // Calls: tighter SL in bearish markets, wider in bullish
      if (regime.trend === 'bearish') {
        slPctAdj = -0.1; // Tighter SL
        reasons.push('Bearish trend - tighter SL for calls');
      } else if (regime.trend === 'bullish') {
        slPctAdj = 0.1; // Wider SL
        reasons.push('Bullish trend - wider SL for calls');
      }

      // Calls: extended TP in strong momentum
      if (regime.momentum === 'strong') {
        tpPctAdj = 0.2;
        reasons.push('Strong momentum - extended TP for calls');
      }
    } else {
      // Puts: tighter SL in bullish markets, wider in bearish
      if (regime.trend === 'bullish') {
        slPctAdj = -0.1; // Tighter SL
        reasons.push('Bullish trend - tighter SL for puts');
      } else if (regime.trend === 'bearish') {
        slPctAdj = 0.1; // Wider SL
        reasons.push('Bearish trend - wider SL for puts');
      }

      // Puts: extended TP in strong momentum
      if (regime.momentum === 'strong') {
        tpPctAdj = 0.2;
        reasons.push('Strong momentum - extended TP for puts');
      }
    }

    // Volatility-based adjustments
    if (regime.volatility === 'high') {
      slPctAdj += 0.05; // Wider SL in high volatility
      tpPctAdj += 0.1;  // Extended TP in high volatility
      reasons.push('High volatility - wider SL, extended TP');
      confidence += 0.1;
    } else if (regime.volatility === 'low') {
      slPctAdj -= 0.05; // Tighter SL in low volatility
      tpPctAdj -= 0.05; // Tighter TP in low volatility
      reasons.push('Low volatility - tighter SL/TP');
      confidence += 0.05;
    }

    return {
      slPctAdj: Math.max(-0.3, Math.min(0.3, slPctAdj)), // Clamp to reasonable range
      tpPctAdj: Math.max(-0.2, Math.min(0.5, tpPctAdj)), // Clamp to reasonable range
      confidence: Math.min(1, confidence),
      reasons
    };
  }

  /**
   * Apply feature-based adjustments to base recommendations
   */
  private applyFeatureAdjustments(
    base: EntryExitRecommendation,
    features: Record<string, any>,
    regime: MarketRegime
  ): EntryExitRecommendation {
    let { slPctAdj, tpPctAdj, confidence } = base;
    const reasons = [...(base.reasons || [])];

    // IV Rank specific adjustments
    const ivRank = features.u_ivRank || 50;
    if (ivRank > 80) {
      slPctAdj -= 0.05; // Tighter SL in very high IV
      tpPctAdj += 0.1;  // Extended TP in very high IV
      reasons.push('Very high IV rank - tighter SL, extended TP');
      confidence += 0.1;
    } else if (ivRank < 20) {
      slPctAdj += 0.05; // Wider SL in very low IV
      tpPctAdj -= 0.05; // Tighter TP in very low IV
      reasons.push('Very low IV rank - wider SL, tighter TP');
      confidence += 0.05;
    }

    // RSI-based momentum adjustments
    const rsi14 = features.u_rsi14 || 50;
    if (rsi14 > 80 || rsi14 < 20) {
      // Extreme RSI - potential reversal
      slPctAdj += 0.05; // Wider SL for potential reversal
      reasons.push('Extreme RSI - wider SL for potential reversal');
      confidence += 0.05;
    }

    // Trend strength adjustments
    const trendDays = features.u_trendDays || 0;
    if (Math.abs(trendDays) > 7) {
      // Very strong trend
      tpPctAdj += 0.1;
      reasons.push('Very strong trend - extended TP');
      confidence += 0.1;
    }

    // ATR-based volatility adjustments
    const atr14 = features.u_atr14 || 0;
    if (atr14 > 0) {
      // Normalize ATR to price for percentage adjustment
      const atrPct = atr14 / (features.u_spot || 100);
      if (atrPct > 0.05) { // High ATR
        slPctAdj += 0.03; // Slightly wider SL
        reasons.push('High ATR - wider SL for volatility');
      }
    }

    return {
      slPctAdj: Math.max(-0.4, Math.min(0.4, slPctAdj)), // Clamp to reasonable range
      tpPctAdj: Math.max(-0.3, Math.min(0.6, tpPctAdj)), // Clamp to reasonable range
      confidence: Math.min(1, confidence),
      reasons
    };
  }

  /**
   * Get confidence boost for specific market conditions
   */
  private getConfidenceBoost(features: Record<string, any>, regime: MarketRegime): number {
    let boost = 0;

    // High confidence for clear market conditions
    if (regime.trend !== 'sideways' && regime.momentum === 'strong') {
      boost += 0.2;
    }

    // High confidence for extreme IV conditions
    const ivRank = features.u_ivRank || 50;
    if (ivRank < 20 || ivRank > 80) {
      boost += 0.1;
    }

    // High confidence for strong trends
    const trendDays = features.u_trendDays || 0;
    if (Math.abs(trendDays) > 5) {
      boost += 0.1;
    }

    return boost;
  }

  /**
   * Validate recommendation parameters
   */
  validateRecommendation(recommendation: EntryExitRecommendation): boolean {
    const { slPctAdj, tpPctAdj, confidence } = recommendation;

    // Check bounds
    if (slPctAdj < -0.5 || slPctAdj > 0.5) return false;
    if (tpPctAdj < -0.5 || tpPctAdj > 1.0) return false;
    if (confidence < 0 || confidence > 1) return false;

    // Check logical consistency
    if (Math.abs(slPctAdj) > 0.3 && confidence < 0.7) return false;
    if (Math.abs(tpPctAdj) > 0.3 && confidence < 0.6) return false;

    return true;
  }
}
