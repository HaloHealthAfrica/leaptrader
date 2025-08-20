import { OptionContract, LeapsPick, ScreeningCriteria } from '../../core/types';
import { Logger } from '../../utils/logger';
import { FeatureBuilder } from '../../features/FeatureBuilder';

/**
 * LEAPS Contract Selector - Specialized logic for selecting long-term option contracts
 * Focuses on contracts with >365 days to expiration and strategic positioning
 */
export class ContractSelector {
  private readonly log = new Logger('leaps-contract-selector');
  private readonly featureBuilder = new FeatureBuilder();

  constructor(private config: ContractSelectorConfig = {}) {
    this.log.info('LEAPS ContractSelector initialized', { config });
  }

  /**
   * Select optimal LEAPS contracts from available options
   */
  async selectContracts(
    symbol: string,
    options: OptionContract[],
    criteria: LEAPSSelectionCriteria
  ): Promise<LEAPSSelection> {
    try {
      this.log.info('Starting LEAPS contract selection', { 
        symbol, 
        totalOptions: options.length,
        criteria 
      });

      // Filter for LEAPS (>365 days to expiration)
      const leapsOptions = this.filterForLEAPS(options);
      this.log.debug('LEAPS options filtered', { 
        symbol, 
        leapsCount: leapsOptions.length,
        originalCount: options.length 
      });

      if (leapsOptions.length === 0) {
        return {
          symbol,
          selections: [],
          metadata: {
            totalAnalyzed: options.length,
            leapsAvailable: 0,
            selectionReason: 'No LEAPS contracts available'
          }
        };
      }

      // Apply screening criteria
      const screened = this.applyScreeningCriteria(leapsOptions, criteria);
      this.log.debug('Screening criteria applied', { 
        symbol, 
        screenedCount: screened.length 
      });

      // Score and rank contracts
      const scored = await this.scoreContracts(symbol, screened, criteria);
      
      // Select top contracts based on strategy
      const selections = this.selectTopContracts(scored, criteria);

      this.log.info('LEAPS contract selection completed', { 
        symbol, 
        totalAnalyzed: options.length,
        finalSelections: selections.length 
      });

      return {
        symbol,
        selections,
        metadata: {
          totalAnalyzed: options.length,
          leapsAvailable: leapsOptions.length,
          screenedCount: screened.length,
          selectionReason: `Selected ${selections.length} optimal LEAPS contracts`
        }
      };

    } catch (error) {
      this.log.error('LEAPS contract selection failed', error as Error, { symbol });
      throw error;
    }
  }

  /**
   * Filter options to only include LEAPS (>365 days to expiration)
   */
  private filterForLEAPS(options: OptionContract[]): OptionContract[] {
    const now = Date.now();
    const oneYear = 365 * 24 * 60 * 60 * 1000; // 365 days in milliseconds

    return options.filter(option => {
      const expirationTime = new Date(option.expiration).getTime();
      const timeToExpiration = expirationTime - now;
      return timeToExpiration > oneYear;
    });
  }

  /**
   * Apply screening criteria to filter contracts
   */
  private applyScreeningCriteria(
    options: OptionContract[], 
    criteria: LEAPSSelectionCriteria
  ): OptionContract[] {
    return options.filter(option => {
      // Delta range check
      if (criteria.deltaRange) {
        const delta = Math.abs(option.greeks?.delta ?? 0);
        if (delta < criteria.deltaRange[0] || delta > criteria.deltaRange[1]) {
          return false;
        }
      }

      // DTE range check (for LEAPS, typically 365-730 days)
      if (criteria.dteRange) {
        const dte = Math.ceil((new Date(option.expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        if (dte < criteria.dteRange[0] || dte > criteria.dteRange[1]) {
          return false;
        }
      }

      // IV range check
      if (criteria.ivRange && option.iv) {
        if (option.iv < criteria.ivRange[0] || option.iv > criteria.ivRange[1]) {
          return false;
        }
      }

      // Liquidity requirements
      if (criteria.minVolume && (option.volume ?? 0) < criteria.minVolume) {
        return false;
      }

      if (criteria.minOpenInterest && (option.openInterest ?? 0) < criteria.minOpenInterest) {
        return false;
      }

      // Option type filter
      if (criteria.optionTypes && !criteria.optionTypes.includes(option.right)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Score contracts using multiple factors
   */
  private async scoreContracts(
    symbol: string,
    options: OptionContract[],
    criteria: LEAPSSelectionCriteria
  ): Promise<ScoredContract[]> {
    // Get current spot price (mock for now)
    const spotPrice = await this.getCurrentSpotPrice(symbol);

    return options.map(contract => {
      const score = this.calculateContractScore(contract, spotPrice, criteria);
      const features = this.featureBuilder.buildContractFeatures(spotPrice, contract);

      return {
        contract,
        score,
        features,
        insights: this.generateContractInsights(contract, spotPrice, criteria)
      };
    }).sort((a, b) => b.score - a.score); // Sort by score descending
  }

  /**
   * Calculate a comprehensive score for a contract
   */
  private calculateContractScore(
    contract: OptionContract,
    spotPrice: number,
    criteria: LEAPSSelectionCriteria
  ): number {
    let score = 0;
    const weights = {
      delta: 0.25,
      liquidity: 0.20,
      timeValue: 0.20,
      spread: 0.15,
      moneyness: 0.10,
      iv: 0.10
    };

    // Delta score - prefer contracts in target delta range
    if (criteria.deltaRange && contract.greeks?.delta) {
      const delta = Math.abs(contract.greeks.delta);
      const [minDelta, maxDelta] = criteria.deltaRange;
      const targetDelta = (minDelta + maxDelta) / 2;
      const deltaDistance = Math.abs(delta - targetDelta);
      const deltaScore = Math.max(0, 1 - deltaDistance / 0.3); // Normalize to 0-1
      score += deltaScore * weights.delta;
    }

    // Liquidity score - based on volume and open interest
    const volume = contract.volume ?? 0;
    const openInterest = contract.openInterest ?? 0;
    const liquidityScore = Math.min(1, (volume / 1000 + openInterest / 5000) / 2);
    score += liquidityScore * weights.liquidity;

    // Time value score - prefer options with reasonable time decay
    const dte = Math.ceil((new Date(contract.expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const timeValueScore = Math.min(1, dte / 730); // Normalize against 2 years max
    score += timeValueScore * weights.timeValue;

    // Spread score - prefer tighter spreads
    if (contract.bid && contract.ask && contract.bid > 0) {
      const spread = contract.ask - contract.bid;
      const mid = (contract.bid + contract.ask) / 2;
      const spreadPct = spread / mid;
      const spreadScore = Math.max(0, 1 - spreadPct / 0.1); // Penalty for >10% spread
      score += spreadScore * weights.spread;
    }

    // Moneyness score - prefer slightly OTM for calls, slightly ITM for puts
    const moneyness = contract.strike / spotPrice;
    let moneynessScore = 0;
    if (contract.right === 'call') {
      // Prefer 5-15% OTM calls
      if (moneyness >= 1.05 && moneyness <= 1.15) {
        moneynessScore = 1;
      } else if (moneyness >= 1.0 && moneyness <= 1.25) {
        moneynessScore = 0.7;
      } else {
        moneynessScore = 0.3;
      }
    } else if (contract.right === 'put') {
      // Prefer 5-15% OTM puts
      if (moneyness >= 0.85 && moneyness <= 0.95) {
        moneynessScore = 1;
      } else if (moneyness >= 0.75 && moneyness <= 1.0) {
        moneynessScore = 0.7;
      } else {
        moneynessScore = 0.3;
      }
    }
    score += moneynessScore * weights.moneyness;

    // IV score - prefer reasonable IV levels
    if (contract.iv) {
      let ivScore = 0;
      if (contract.iv >= 0.20 && contract.iv <= 0.40) {
        ivScore = 1; // Moderate IV is ideal
      } else if (contract.iv >= 0.15 && contract.iv <= 0.50) {
        ivScore = 0.7;
      } else {
        ivScore = 0.3;
      }
      score += ivScore * weights.iv;
    }

    return Math.min(1, Math.max(0, score)); // Clamp to 0-1 range
  }

  /**
   * Select top contracts based on strategy requirements
   */
  private selectTopContracts(
    scoredContracts: ScoredContract[],
    criteria: LEAPSSelectionCriteria
  ): LeapsPick[] {
    const maxSelections = criteria.maxSelections || 3;
    const minScore = criteria.minScore || 0.6;

    const qualified = scoredContracts.filter(sc => sc.score >= minScore);
    const selected = qualified.slice(0, maxSelections);

    return selected.map((sc, index) => ({
      id: `leaps-${sc.contract.symbol}-${index + 1}`,
      underlying: sc.contract.underlying,
      contract: sc.contract,
      strategy: criteria.strategy || 'long_call',
      confidence: sc.score,
      timeHorizon: Math.ceil((new Date(sc.contract.expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      riskReward: this.calculateRiskReward(sc.contract),
      rationale: sc.insights,
      metadata: {
        selectedAt: new Date().toISOString(),
        expiresAt: sc.contract.expiration,
        source: 'contract-selector-v1.0',
        features: sc.features
      }
    }));
  }

  /**
   * Calculate risk/reward metrics for a contract
   */
  private calculateRiskReward(contract: OptionContract): { risk: number; reward: number; ratio: number } {
    const premium = contract.ask || contract.last || 0;
    const intrinsicValue = Math.max(0, 
      contract.right === 'call' ? 0 : contract.strike // Simplified calculation
    );
    
    // Risk is the premium paid
    const risk = premium;
    
    // Reward is potential upside (simplified)
    const reward = contract.strike * 0.2; // Assume 20% move potential
    
    const ratio = reward / Math.max(risk, 0.01);

    return { risk, reward, ratio };
  }

  /**
   * Generate insights for a contract selection
   */
  private generateContractInsights(
    contract: OptionContract,
    spotPrice: number,
    criteria: LEAPSSelectionCriteria
  ): string[] {
    const insights: string[] = [];

    const dte = Math.ceil((new Date(contract.expiration).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    insights.push(`${dte} days to expiration - long-term LEAPS position`);

    if (contract.greeks?.delta) {
      const delta = Math.abs(contract.greeks.delta);
      insights.push(`Delta ${delta.toFixed(3)} provides ${(delta * 100).toFixed(1)}% exposure to underlying moves`);
    }

    const moneyness = contract.strike / spotPrice;
    if (contract.right === 'call') {
      if (moneyness > 1.1) {
        insights.push('Significantly out-of-the-money call - high leverage potential');
      } else if (moneyness > 1.0) {
        insights.push('Out-of-the-money call - balanced risk/reward');
      } else {
        insights.push('In-the-money call - lower leverage, higher probability');
      }
    }

    if (contract.volume && contract.volume > 100) {
      insights.push(`Good liquidity with ${contract.volume} daily volume`);
    } else {
      insights.push('Limited liquidity - consider larger spreads');
    }

    if (contract.iv && contract.iv > 0.3) {
      insights.push('High implied volatility - expensive premium but good for protection');
    } else if (contract.iv && contract.iv < 0.2) {
      insights.push('Low implied volatility - attractive premium levels');
    }

    return insights;
  }

  /**
   * Mock function to get current spot price
   * In production, this would call a real data provider
   */
  private async getCurrentSpotPrice(symbol: string): Promise<number> {
    // Mock implementation - replace with real data provider
    const mockPrices: Record<string, number> = {
      'AAPL': 150,
      'MSFT': 300,
      'GOOGL': 2500,
      'TSLA': 200,
      'SPY': 400
    };
    
    return mockPrices[symbol] || 100;
  }
}

export interface ContractSelectorConfig {
  enabledStrategies?: string[];
  defaultMaxSelections?: number;
  defaultMinScore?: number;
}

export interface LEAPSSelectionCriteria {
  strategy?: 'long_call' | 'long_put' | 'covered_call' | 'protective_put';
  deltaRange?: [number, number];
  dteRange?: [number, number]; // Days to expiration
  ivRange?: [number, number]; // Implied volatility range
  minVolume?: number;
  minOpenInterest?: number;
  optionTypes?: ('call' | 'put')[];
  maxSelections?: number;
  minScore?: number;
}

export interface ScoredContract {
  contract: OptionContract;
  score: number;
  features: Record<string, any>;
  insights: string[];
}

export interface LEAPSSelection {
  symbol: string;
  selections: LeapsPick[];
  metadata: {
    totalAnalyzed: number;
    leapsAvailable: number;
    screenedCount?: number;
    selectionReason: string;
  };
}

export default ContractSelector;