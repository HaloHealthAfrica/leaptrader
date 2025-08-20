import { Logger } from '../../utils/logger';
import { OptionContract } from '../../core/types';

export interface StrikeSelectionContext {
  side: 'long_call' | 'long_put';
  deltaRange: [number, number];
  dteRange: [number, number];
  ivRank?: number;
}

export interface CandidateWithFeatures {
  contract: OptionContract;
  features: Record<string, number | string | boolean>;
}

/**
 * Optimizes strike selection using ML features and heuristics
 * Provides scoring for option candidates based on multiple factors
 */
export class StrikeOptimizer {
  private readonly log = new Logger('strike-optimizer');

  /**
   * Score candidates for strike selection
   * Returns scores from 0-1 where higher is better
   */
  async scoreCandidates(
    candidates: CandidateWithFeatures[],
    context: StrikeSelectionContext
  ): Promise<number[]> {
    try {
      this.log.debug('Scoring strike candidates', { 
        count: candidates.length, 
        side: context.side,
        deltaRange: context.deltaRange 
      });

      const scores = candidates.map(candidate => 
        this.calculateStrikeScore(candidate, context)
      );

      this.log.debug('Strike scoring completed', { 
        scores: scores.map(s => s.toFixed(3)),
        avgScore: (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(3)
      });

      return scores;

    } catch (error) {
      this.log.error('Strike scoring failed', error as Error, { context });
      // Return neutral scores on error
      return candidates.map(() => 0.5);
    }
  }

  /**
   * Calculate individual strike score based on features and context
   */
  private calculateStrikeScore(
    candidate: CandidateWithFeatures,
    context: StrikeSelectionContext
  ): number {
    const { contract, features } = candidate;
    const { side, deltaRange, dteRange, ivRank } = context;

    let score = 0.5; // Base neutral score
    const factors: string[] = [];

    // 1. Delta alignment (most important)
    const deltaScore = this.scoreDeltaAlignment(contract, deltaRange, side);
    score += deltaScore * 0.3; // 30% weight
    factors.push(`Delta: ${deltaScore.toFixed(3)}`);

    // 2. DTE alignment
    const dteScore = this.scoreDTEAlignment(contract, dteRange);
    score += dteScore * 0.2; // 20% weight
    factors.push(`DTE: ${dteScore.toFixed(3)}`);

    // 3. Liquidity and spread
    const liquidityScore = this.scoreLiquidity(contract);
    score += liquidityScore * 0.2; // 20% weight
    factors.push(`Liquidity: ${liquidityScore.toFixed(3)}`);

    // 4. IV Rank optimization
    const ivScore = this.scoreIVRankOptimization(contract, ivRank, side);
    score += ivScore * 0.15; // 15% weight
    factors.push(`IV Rank: ${ivScore.toFixed(3)}`);

    // 5. Extrinsic value optimization
    const extrinsicScore = this.scoreExtrinsicValue(contract, features);
    score += extrinsicScore * 0.15; // 15% weight
    factors.push(`Extrinsic: ${extrinsicScore.toFixed(3)}`);

    // Ensure score is between 0 and 1
    score = Math.max(0, Math.min(1, score));

    this.log.debug('Strike score calculated', { 
      symbol: contract.symbol, 
      score: score.toFixed(3), 
      factors 
    });

    return score;
  }

  /**
   * Score delta alignment with target range
   */
  private scoreDeltaAlignment(
    contract: OptionContract,
    targetRange: [number, number],
    side: string
  ): number {
    const delta = Math.abs(contract.greeks?.delta ?? 0);
    if (delta === 0) return 0;

    const [minDelta, maxDelta] = targetRange;
    const targetMid = (minDelta + maxDelta) / 2;
    const distance = Math.abs(delta - targetMid);
    const range = maxDelta - minDelta;

    // Perfect score if delta is in the middle of target range
    if (distance === 0) return 1.0;

    // Score decreases as distance increases
    const score = Math.max(0, 1 - (distance / (range * 0.5)));
    return score;
  }

  /**
   * Score DTE alignment with target range
   */
  private scoreDTEAlignment(contract: OptionContract, targetRange: [number, number]): number {
    const dte = Math.ceil((new Date(contract.expiration).getTime() - Date.now()) / 86400000);
    const [minDte, maxDte] = targetRange;
    const targetMid = (minDte + maxDte) / 2;
    const distance = Math.abs(dte - targetMid);
    const range = maxDte - minDte;

    if (distance === 0) return 1.0;
    const score = Math.max(0, 1 - (distance / (range * 0.5)));
    return score;
  }

  /**
   * Score liquidity based on volume, OI, and spread
   */
  private scoreLiquidity(contract: OptionContract): number {
    const volume = contract.volume ?? 0;
    const oi = contract.openInterest ?? 0;
    const bid = contract.bid ?? 0;
    const ask = contract.ask ?? 0;

    // Volume score (0-0.4)
    const volumeScore = Math.min(0.4, volume / 1000);

    // OI score (0-0.3)
    const oiScore = Math.min(0.3, oi / 2000);

    // Spread score (0-0.3)
    let spreadScore = 0.3;
    if (bid > 0 && ask > 0) {
      const spreadPct = ((ask - bid) / ((ask + bid) / 2)) * 100;
      spreadScore = Math.max(0, 0.3 - (spreadPct / 50));
    }

    return volumeScore + oiScore + spreadScore;
  }

  /**
   * Score IV Rank optimization based on strategy side
   */
  private scoreIVRankOptimization(
    contract: OptionContract,
    ivRank?: number,
    side?: string
  ): number {
    if (ivRank === undefined) return 0.5;

    // For calls: prefer lower IV (cheaper premiums)
    // For puts: prefer higher IV (more protection)
    if (side === 'long_call') {
      if (ivRank < 30) return 1.0;      // Very cheap
      if (ivRank < 50) return 0.8;      // Cheap
      if (ivRank < 70) return 0.6;      // Moderate
      return 0.4;                        // Expensive
    } else if (side === 'long_put') {
      if (ivRank > 80) return 1.0;      // Very expensive (good for puts)
      if (ivRank > 60) return 0.8;      // Expensive
      if (ivRank > 40) return 0.6;      // Moderate
      return 0.4;                        // Cheap
    }

    return 0.5; // Neutral for unknown side
  }

  /**
   * Score extrinsic value optimization
   */
  private scoreExtrinsicValue(
    contract: OptionContract,
    features: Record<string, any>
  ): number {
    const extrinsicPerDelta = features.c_extrinsicPerDelta || 0;
    const moneyness = features.c_moneyness || 1;

    // Prefer lower extrinsic value per delta (more efficient)
    let extrinsicScore = 0.5;
    if (extrinsicPerDelta > 0) {
      // Lower is better, so invert and normalize
      extrinsicScore = Math.max(0, 1 - (extrinsicPerDelta / 10));
    }

    // Prefer slightly OTM options (moneyness > 1 for calls, < 1 for puts)
    let moneynessScore = 0.5;
    if (contract.right === 'call' && moneyness > 1.02) {
      moneynessScore = 1.0; // Slightly OTM calls
    } else if (contract.right === 'put' && moneyness < 0.98) {
      moneynessScore = 1.0; // Slightly OTM puts
    } else if (Math.abs(moneyness - 1) < 0.05) {
      moneynessScore = 0.7; // Near ATM
    }

    return (extrinsicScore + moneynessScore) / 2;
  }

  /**
   * Get optimization insights for a candidate
   */
  getOptimizationInsights(
    candidate: CandidateWithFeatures,
    context: StrikeSelectionContext
  ): string[] {
    const insights: string[] = [];
    const { contract } = candidate;

    // Delta insights
    const delta = Math.abs(contract.greeks?.delta ?? 0);
    const [minDelta, maxDelta] = context.deltaRange;
    if (delta < minDelta) {
      insights.push(`Delta ${delta.toFixed(2)} below target range ${minDelta}-${maxDelta}`);
    } else if (delta > maxDelta) {
      insights.push(`Delta ${delta.toFixed(2)} above target range ${minDelta}-${maxDelta}`);
    }

    // DTE insights
    const dte = Math.ceil((new Date(contract.expiration).getTime() - Date.now()) / 86400000);
    const [minDte, maxDte] = context.dteRange;
    if (dte < minDte) {
      insights.push(`DTE ${dte} below target range ${minDte}-${maxDte}`);
    } else if (dte > maxDte) {
      insights.push(`DTE ${dte} above target range ${minDte}-${maxDte}`);
    }

    // Liquidity insights
    if ((contract.volume ?? 0) < 100) {
      insights.push('Low volume - consider higher volume alternatives');
    }
    if ((contract.openInterest ?? 0) < 500) {
      insights.push('Low open interest - limited liquidity');
    }

    return insights;
  }
}
