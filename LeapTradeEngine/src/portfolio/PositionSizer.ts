import { Position, RiskLimits } from '../types';
import { logger } from '../utils/logger';

export interface PositionSizingInput {
  portfolioValue: number;
  availableCash: number;
  optionPrice: number;
  confidence: number;
  strategy: string;
  existingPositions: Position[];
  symbol: string;
  riskLimits: RiskLimits;
}

export interface PositionSizingResult {
  quantity: number;
  reasoning: string;
}

export class PositionSizer {
  private riskLimits: RiskLimits;

  // Position sizing models
  private readonly MODELS = {
    FIXED_FRACTIONAL: 'fixed_fractional',
    KELLY_CRITERION: 'kelly_criterion',
    VOLATILITY_ADJUSTED: 'volatility_adjusted',
    CONFIDENCE_WEIGHTED: 'confidence_weighted'
  };

  constructor(riskLimits: RiskLimits) {
    this.riskLimits = riskLimits;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing position sizer...');
    logger.info('Position sizer initialized');
  }

  async calculateOptimalSize(input: PositionSizingInput): Promise<PositionSizingResult> {
    try {
      logger.info(`Calculating position size for ${input.symbol} (${input.strategy})`);

      // Apply multiple sizing models and take the most conservative
      const sizingResults = await Promise.all([
        this.calculateFixedFractionalSize(input),
        this.calculateConfidenceWeightedSize(input),
        this.calculateVolatilityAdjustedSize(input),
        this.calculateRiskLimitSize(input)
      ]);

      // Take the minimum size (most conservative approach)
      const minSize = Math.min(...sizingResults.map(r => r.quantity));
      const finalQuantity = Math.max(0, Math.floor(minSize));

      // Generate comprehensive reasoning
      const reasoning = this.generateSizingReasoning(input, sizingResults, finalQuantity);

      logger.info(`Calculated position size: ${finalQuantity} contracts for ${input.symbol}`);

      return {
        quantity: finalQuantity,
        reasoning
      };
    } catch (error) {
      logger.error(`Error calculating position size for ${input.symbol}:`, error);
      throw error;
    }
  }

  private async calculateFixedFractionalSize(input: PositionSizingInput): Promise<PositionSizingResult> {
    // Fixed fractional model - risk a fixed percentage of portfolio per trade
    const riskPerTrade = this.getRiskPerTradeByStrategy(input.strategy);
    const dollarRisk = input.portfolioValue * riskPerTrade;
    
    // For options, risk is typically the premium paid
    const quantity = Math.floor(dollarRisk / input.optionPrice);

    return {
      quantity,
      reasoning: `Fixed fractional (${(riskPerTrade * 100).toFixed(1)}% risk): ${quantity} contracts`
    };
  }

  private async calculateConfidenceWeightedSize(input: PositionSizingInput): Promise<PositionSizingResult> {
    // Adjust position size based on signal confidence
    const baseRisk = this.getRiskPerTradeByStrategy(input.strategy);
    
    // Scale risk based on confidence (confidence is 0-10 scale)
    const confidenceMultiplier = Math.max(0.5, Math.min(2.0, input.confidence / 7.5));
    const adjustedRisk = baseRisk * confidenceMultiplier;
    
    const dollarRisk = input.portfolioValue * adjustedRisk;
    const quantity = Math.floor(dollarRisk / input.optionPrice);

    return {
      quantity,
      reasoning: `Confidence weighted (${input.confidence.toFixed(1)}/10): ${quantity} contracts`
    };
  }

  private async calculateVolatilityAdjustedSize(input: PositionSizingInput): Promise<PositionSizingResult> {
    // Adjust position size based on implied volatility and strategy
    const baseRisk = this.getRiskPerTradeByStrategy(input.strategy);
    
    // Estimate implied volatility effect on position sizing
    // Higher IV = more expensive options = smaller position sizes
    const estimatedIV = 0.25; // Default 25% if not provided
    const volAdjustment = Math.max(0.5, Math.min(1.5, 0.25 / estimatedIV));
    
    const adjustedRisk = baseRisk * volAdjustment;
    const dollarRisk = input.portfolioValue * adjustedRisk;
    const quantity = Math.floor(dollarRisk / input.optionPrice);

    return {
      quantity,
      reasoning: `Volatility adjusted: ${quantity} contracts`
    };
  }

  private async calculateRiskLimitSize(input: PositionSizingInput): Promise<PositionSizingResult> {
    // Ensure position doesn't exceed various risk limits
    
    // 1. Maximum position size limit
    const maxPositionValue = input.portfolioValue * this.riskLimits.maxPositionSize;
    const maxQuantityBySize = Math.floor(maxPositionValue / input.optionPrice);

    // 2. Available cash limit
    const maxQuantityByCash = Math.floor(input.availableCash / input.optionPrice);

    // 3. Symbol concentration limit
    const existingSymbolExposure = this.calculateSymbolExposure(input.symbol, input.existingPositions, input.portfolioValue);
    const remainingSymbolCapacity = Math.max(0, this.riskLimits.maxPositionSize - existingSymbolExposure);
    const maxQuantityByConcentration = Math.floor((input.portfolioValue * remainingSymbolCapacity) / input.optionPrice);

    // 4. Strategy-specific limits
    const maxQuantityByStrategy = this.getMaxQuantityByStrategy(input);

    const minQuantity = Math.min(
      maxQuantityBySize,
      maxQuantityByCash,
      maxQuantityByConcentration,
      maxQuantityByStrategy
    );

    return {
      quantity: minQuantity,
      reasoning: `Risk limits: Position(${maxQuantityBySize}), Cash(${maxQuantityByCash}), Concentration(${maxQuantityByConcentration}), Strategy(${maxQuantityByStrategy})`
    };
  }

  private getRiskPerTradeByStrategy(strategy: string): number {
    // Risk per trade as percentage of portfolio by strategy type
    const riskByStrategy: { [key: string]: number } = {
      'Stock Replacement': 0.08,    // 8% - higher risk/reward LEAP calls
      'Covered Call': 0.05,         // 5% - lower risk income strategy
      'Protective Put': 0.03,       // 3% - insurance/hedge positions
      'Iron Condor': 0.04,          // 4% - defined risk strategy
      'default': 0.05               // 5% default
    };

    return riskByStrategy[strategy] || riskByStrategy['default'];
  }

  private calculateSymbolExposure(symbol: string, positions: Position[], portfolioValue: number): number {
    let totalExposure = 0;
    
    for (const position of positions) {
      if (position.symbol === symbol) {
        totalExposure += position.marketValue;
      }
    }
    
    return totalExposure / portfolioValue;
  }

  private getMaxQuantityByStrategy(input: PositionSizingInput): number {
    // Strategy-specific maximum position limits
    const { strategy, portfolioValue, optionPrice } = input;
    
    switch (strategy) {
      case 'Stock Replacement':
        // For LEAP calls, limit to 20% of portfolio per position
        return Math.floor((portfolioValue * 0.20) / optionPrice);
      
      case 'Covered Call':
        // For covered calls, typically sell calls on existing stock positions
        // Limit based on underlying holdings
        return Math.floor((portfolioValue * 0.15) / optionPrice);
      
      case 'Protective Put':
        // Insurance positions, typically smaller sizes
        return Math.floor((portfolioValue * 0.10) / optionPrice);
      
      case 'Iron Condor':
        // Defined risk strategies, can be larger due to limited risk
        return Math.floor((portfolioValue * 0.12) / optionPrice);
      
      default:
        return Math.floor((portfolioValue * 0.10) / optionPrice);
    }
  }

  private generateSizingReasoning(
    input: PositionSizingInput,
    results: PositionSizingResult[],
    finalQuantity: number
  ): string {
    let reasoning = `Position sizing for ${input.symbol} (${input.strategy}):\n`;
    
    // Add individual model results
    results.forEach((result, index) => {
      const modelNames = ['Fixed Fractional', 'Confidence Weighted', 'Volatility Adjusted', 'Risk Limits'];
      reasoning += `• ${modelNames[index]}: ${result.quantity} contracts\n`;
    });
    
    reasoning += `\nSelected: ${finalQuantity} contracts (most conservative approach)\n`;
    
    // Add additional context
    const positionValue = finalQuantity * input.optionPrice;
    const portfolioPercentage = (positionValue / input.portfolioValue) * 100;
    
    reasoning += `Position value: $${positionValue.toLocaleString()} (${portfolioPercentage.toFixed(2)}% of portfolio)\n`;
    
    // Add warnings if applicable
    if (finalQuantity === 0) {
      reasoning += `⚠️ Zero position size - risk limits prevent trade`;
    } else if (portfolioPercentage > 15) {
      reasoning += `⚠️ Large position size (>${15}% of portfolio)`;
    }
    
    // Add confidence context
    reasoning += `Signal confidence: ${input.confidence.toFixed(1)}/10`;
    
    return reasoning;
  }

  // Kelly Criterion calculation (advanced position sizing)
  private calculateKellySize(input: PositionSizingInput, winRate: number, avgWin: number, avgLoss: number): number {
    // Kelly Fraction = (bp - q) / b
    // where b = odds received on the bet, p = probability of winning, q = probability of losing
    
    const b = avgWin / avgLoss; // Odds
    const p = winRate; // Win probability
    const q = 1 - p; // Loss probability
    
    const kellyFraction = (b * p - q) / b;
    
    // Apply Kelly fraction but cap at reasonable limits (typically 25% max)
    const cappedKelly = Math.max(0, Math.min(0.25, kellyFraction));
    
    const dollarAmount = input.portfolioValue * cappedKelly;
    return Math.floor(dollarAmount / input.optionPrice);
  }

  // Position sizing for different market regimes
  async calculateRegimeAdjustedSize(input: PositionSizingInput, marketRegime: 'bull' | 'bear' | 'sideways'): Promise<PositionSizingResult> {
    const baseSize = await this.calculateOptimalSize(input);
    
    // Adjust based on market regime
    const regimeMultipliers = {
      bull: 1.2,    // Slightly larger positions in bull markets
      bear: 0.8,    // Smaller positions in bear markets
      sideways: 1.0 // Normal sizing in sideways markets
    };
    
    const adjustedQuantity = Math.floor(baseSize.quantity * regimeMultipliers[marketRegime]);
    
    return {
      quantity: adjustedQuantity,
      reasoning: `${baseSize.reasoning}\nMarket regime adjustment (${marketRegime}): ${adjustedQuantity} contracts`
    };
  }

  // Diversification-aware position sizing
  calculateDiversifiedSize(input: PositionSizingInput): PositionSizingResult {
    // Check correlation with existing positions
    const sectorExposure = this.calculateSectorExposure(input.symbol, input.existingPositions, input.portfolioValue);
    
    // Reduce size if already heavily exposed to this sector
    let diversificationMultiplier = 1.0;
    if (sectorExposure > 0.3) { // More than 30% sector exposure
      diversificationMultiplier = 0.7; // Reduce position by 30%
    } else if (sectorExposure > 0.4) { // More than 40% sector exposure
      diversificationMultiplier = 0.5; // Reduce position by 50%
    }
    
    const baseQuantity = Math.floor((input.portfolioValue * this.getRiskPerTradeByStrategy(input.strategy)) / input.optionPrice);
    const adjustedQuantity = Math.floor(baseQuantity * diversificationMultiplier);
    
    return {
      quantity: adjustedQuantity,
      reasoning: `Diversification adjusted: ${adjustedQuantity} contracts (sector exposure: ${(sectorExposure * 100).toFixed(1)}%)`
    };
  }

  private calculateSectorExposure(symbol: string, positions: Position[], portfolioValue: number): number {
    // Simplified sector mapping - in production would use external data service
    const sectorMap: { [key: string]: string } = {
      'AAPL': 'Technology',
      'MSFT': 'Technology',
      'GOOGL': 'Technology',
      'TSLA': 'Automotive',
      'NVDA': 'Technology',
      'JPM': 'Finance',
      'JNJ': 'Healthcare',
      'XOM': 'Energy'
    };
    
    const targetSector = sectorMap[symbol] || 'Other';
    let sectorExposure = 0;
    
    for (const position of positions) {
      const positionSector = sectorMap[position.symbol] || 'Other';
      if (positionSector === targetSector) {
        sectorExposure += position.marketValue;
      }
    }
    
    return sectorExposure / portfolioValue;
  }
}
