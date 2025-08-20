import { SimplifiedLeapsConfig } from '../src/strategy/SimplifiedLeapsOrchestrator';

/**
 * Simplified LEAPS Configuration - Optimized for Long Calls and Protective Puts
 */

// Production Configuration
export const productionConfig: SimplifiedLeapsConfig = {
  dataClients: {
    // Data provider configurations will be injected at runtime
    twelvedata: null as any,
    alpaca: null as any, 
    tradier: null as any
  },
  preferences: {
    longCallWeight: 0.7, // 70% preference for long calls vs protective puts
    protectionLevel: 'moderate', // Balanced protection approach
    timeHorizonPreference: 'long', // Focus on true LEAPS (1+ years)
    maxPositionsPerSymbol: 2 // Max 2 positions per symbol (1 call + 1 put)
  },
  riskLimits: {
    maxSinglePositionSize: 0.15, // 15% max per position
    maxTotalAllocation: 0.80, // 80% max total options allocation
    minLiquidityScore: 5.0, // Minimum liquidity requirement
    maxIVThreshold: 0.75 // Max 75th percentile IV rank
  }
};

// Conservative Configuration - Lower risk, higher quality requirements
export const conservativeConfig: SimplifiedLeapsConfig = {
  dataClients: {
    twelvedata: null as any,
    alpaca: null as any,
    tradier: null as any
  },
  preferences: {
    longCallWeight: 0.6, // Balanced approach
    protectionLevel: 'conservative', // Higher protection requirements
    timeHorizonPreference: 'long',
    maxPositionsPerSymbol: 1 // Single best position per symbol
  },
  riskLimits: {
    maxSinglePositionSize: 0.10, // 10% max per position
    maxTotalAllocation: 0.60, // 60% max total allocation
    minLiquidityScore: 6.0, // Higher liquidity requirement
    maxIVThreshold: 0.60 // Lower IV threshold
  }
};

// Aggressive Configuration - Higher risk tolerance, more opportunities
export const aggressiveConfig: SimplifiedLeapsConfig = {
  dataClients: {
    twelvedata: null as any,
    alpaca: null as any,
    tradier: null as any
  },
  preferences: {
    longCallWeight: 0.8, // Strong preference for calls
    protectionLevel: 'aggressive', // Minimal protection requirements
    timeHorizonPreference: 'mixed', // Mix of time horizons
    maxPositionsPerSymbol: 3 // Allow more positions per symbol
  },
  riskLimits: {
    maxSinglePositionSize: 0.20, // 20% max per position
    maxTotalAllocation: 0.90, // 90% max total allocation
    minLiquidityScore: 4.0, // Lower liquidity requirement
    maxIVThreshold: 0.85 // Higher IV tolerance
  }
};

// Strategy-specific thresholds
export const strategyThresholds = {
  longCallLeaps: {
    minFundamentalScore: 6.5,
    minTechnicalScore: 6.0,
    minConfidence: 7.0,
    preferredDeltaRange: [0.60, 0.80],
    preferredTimeRange: [365, 730], // 1-2 years
    maxCostPercent: 0.15 // Max 15% of position value
  },
  protectivePut: {
    minFundamentalScore: 5.5,
    minTechnicalScore: 4.0, // Can use in poor technical environments
    minConfidence: 6.0,
    preferredDeltaRange: [-0.35, -0.15],
    preferredTimeRange: [90, 365], // 3 months to 1 year
    maxCostPercent: 0.05 // Max 5% of position value for protection
  }
};

// Market condition adjustments
export const marketConditionAdjustments = {
  highVolatility: {
    // VIX > 25 or high IV environment
    longCallWeight: 0.5, // Reduce call preference
    protectionLevel: 'conservative', // Increase protection
    ivThresholdAdjustment: -0.10 // Lower IV threshold
  },
  lowVolatility: {
    // VIX < 15 or low IV environment  
    longCallWeight: 0.8, // Increase call preference
    protectionLevel: 'aggressive', // Reduce protection
    ivThresholdAdjustment: 0.10 // Higher IV threshold
  },
  uptrend: {
    // Strong bullish market
    longCallWeight: 0.85,
    protectionLevel: 'aggressive'
  },
  downtrend: {
    // Bearish market
    longCallWeight: 0.3,
    protectionLevel: 'conservative'
  }
};

// Portfolio allocation rules
export const allocationRules = {
  // Sector diversification
  maxSectorAllocation: 0.30, // Max 30% in any sector
  
  // Symbol concentration
  maxSymbolAllocation: 0.15, // Max 15% in any single symbol
  
  // Strategy balance
  minProtectionRatio: 0.20, // Min 20% in protective strategies
  
  // Time diversification
  timeHorizonDistribution: {
    short: 0.20, // 3-12 months
    medium: 0.40, // 1-2 years
    long: 0.40 // 2+ years
  }
};

// Risk management parameters
export const riskManagement = {
  stopLoss: {
    longCalls: 0.30, // 30% stop loss on calls
    protectivePuts: 0.50 // 50% stop loss on puts
  },
  profitTargets: {
    longCalls: 0.75, // 75% profit target
    protectivePuts: 0.25 // 25% profit target (if puts gain value)
  },
  positionSizing: {
    kellyFraction: 0.25, // Conservative Kelly criterion
    maxPositionRisk: 0.15, // Max 15% risk per position
    portfolioHeatLevel: 0.80 // Max 80% portfolio heat
  },
  rebalancing: {
    frequency: 'weekly',
    thresholds: {
      profitTaking: 0.50, // Take profits at 50%
      lossControl: 0.25, // Control losses at 25%
      deltaAdjustment: 0.20 // Adjust when delta changes by 20%
    }
  }
};

// Screening criteria for symbol selection
export const screeningCriteria = {
  fundamental: {
    minMarketCap: 5_000_000_000, // $5B minimum
    maxPERatio: 40,
    minROE: 0.10, // 10%
    maxDebtToEquity: 1.0,
    minCurrentRatio: 1.0
  },
  technical: {
    minRSI: 25,
    maxRSI: 75,
    minVolume: 1_000_000, // 1M daily volume
    minPrice: 20, // $20 minimum stock price
    maxPrice: 500 // $500 maximum for practical options
  },
  options: {
    minOpenInterest: 100,
    minVolume: 50,
    maxBidAskSpread: 0.10, // 10% max spread
    minDTE: 30, // 30 days minimum
    maxDTE: 1095 // 3 years maximum
  }
};

export default {
  production: productionConfig,
  conservative: conservativeConfig,
  aggressive: aggressiveConfig,
  thresholds: strategyThresholds,
  marketAdjustments: marketConditionAdjustments,
  allocation: allocationRules,
  risk: riskManagement,
  screening: screeningCriteria
};